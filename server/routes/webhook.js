const express = require('express');
const { sendMessage, extractMessages } = require('../services/whatsapp');
const { createSession, sendToNivi, generateIds } = require('../services/nivi');
const Conversation = require('../models/Conversation');

const router = express.Router();

// Deduplicate: WhatsApp can send the same webhook multiple times
const processedMessages = new Set();
function isDuplicate(messageId) {
  if (processedMessages.has(messageId)) return true;
  processedMessages.add(messageId);
  // Clean up old entries every 1000 messages
  if (processedMessages.size > 1000) {
    const arr = [...processedMessages];
    arr.splice(0, 500);
    processedMessages.clear();
    arr.forEach(id => processedMessages.add(id));
  }
  return false;
}

// Per-phone-number lock to prevent concurrent processing for the same user
const phoneLocks = new Map();
async function withPhoneLock(phoneNumber, fn) {
  const prev = phoneLocks.get(phoneNumber) || Promise.resolve();
  const current = prev.then(fn, fn);
  phoneLocks.set(phoneNumber, current);
  try {
    return await current;
  } finally {
    if (phoneLocks.get(phoneNumber) === current) {
      phoneLocks.delete(phoneNumber);
    }
  }
}

// WhatsApp webhook verification (GET)
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('[Webhook] Verification successful');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// WhatsApp webhook incoming messages (POST)
router.post('/', async (req, res) => {
  // Respond immediately to WhatsApp - they require 200 within 5 seconds
  res.sendStatus(200);

  const messages = extractMessages(req.body);
  for (const msg of messages) {
    if (isDuplicate(msg.messageId)) {
      console.log(`[Webhook] Skipping duplicate message ${msg.messageId}`);
      continue;
    }
    // Serialize processing per phone number to prevent race conditions
    withPhoneLock(msg.from, async () => {
      try {
        await handleIncomingMessage(msg);
      } catch (error) {
        console.error(`[Webhook] Error handling message from ${msg.from}:`, error.message);
      }
    });
  }
});

async function sendErrorToUser(conversation, from, errorMsg) {
  try {
    conversation.messages.push({ direction: 'outgoing', body: errorMsg });
    await conversation.save();
    await sendMessage(from, errorMsg);
  } catch (sendErr) {
    console.error(`[Webhook] Failed to send error message to ${from}:`, sendErr.message);
  }
}

async function handleIncomingMessage({ from, text, messageId }) {
  console.log(`[Webhook] Message from ${from}: ${text}`);

  // Find or create conversation for this phone number
  let conversation;
  let isNewSession = false;

  try {
    conversation = await Conversation.findOne({ phoneNumber: from });
  } catch (error) {
    console.error(`[Webhook] DB lookup failed for ${from}:`, error.message);
    return;
  }

  if (!conversation) {
    const { userId, sessionId } = generateIds();
    conversation = new Conversation({
      phoneNumber: from,
      niviUserId: userId,
      niviSessionId: sessionId,
    });
    isNewSession = true;
  }

  // DB-level dedup: check if this messageId was already saved
  const alreadyProcessed = conversation.messages.some(
    m => m.whatsappMessageId === messageId
  );
  if (alreadyProcessed) {
    console.log(`[Webhook] Skipping already-processed message ${messageId}`);
    return;
  }

  // Save incoming message
  conversation.messages.push({
    direction: 'incoming',
    body: text,
    whatsappMessageId: messageId,
  });
  conversation.lastActivity = new Date();

  try {
    await conversation.save();
  } catch (error) {
    console.error(`[Webhook] Failed to save incoming message for ${from}:`, error.message);
    return;
  }

  // Create Nivi session if new
  if (isNewSession) {
    try {
      await createSession(conversation.niviUserId, conversation.niviSessionId);
    } catch (error) {
      console.error(`[Webhook] Failed to create Nivi session for ${from}:`, error.message);
      await sendErrorToUser(conversation, from, 'מצטערים, לא הצלחנו ליצור חיבור למערכת. אנא נסה שוב.');
      return;
    }
  }

  // Send to Nivi and get response
  try {
    const niviResponse = await sendToNivi(
      conversation.niviUserId,
      conversation.niviSessionId,
      text
    );

    // Save outgoing message
    conversation.messages.push({
      direction: 'outgoing',
      body: niviResponse,
    });
    conversation.lastActivity = new Date();
    await conversation.save();

    // Send response back via WhatsApp
    await sendMessage(from, niviResponse);
  } catch (error) {
    console.error(`[Webhook] Error for ${from}:`, error.message);
    let errorMsg;
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      errorMsg = 'מצטערים, המערכת לא הגיבה בזמן. אנא נסה שוב.';
    } else if (error.response?.status >= 500) {
      errorMsg = 'מצטערים, יש תקלה במערכת. אנא נסה שוב מאוחר יותר.';
    } else {
      errorMsg = 'מצטערים, אירעה שגיאה. אנא נסה שוב מאוחר יותר.';
    }
    await sendErrorToUser(conversation, from, errorMsg);
  }
}

module.exports = router;
