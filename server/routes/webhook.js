const express = require('express');
const { sendMessage, extractMessages } = require('../services/whatsapp');
const { createSession, sendToNivi, generateIds } = require('../services/nivi');
const Conversation = require('../models/Conversation');

const router = express.Router();

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
    try {
      await handleIncomingMessage(msg);
    } catch (error) {
      console.error(`[Webhook] Error handling message from ${msg.from}:`, error.message);
    }
  }
});

async function handleIncomingMessage({ from, text, messageId }) {
  console.log(`[Webhook] Message from ${from}: ${text}`);

  // Find or create conversation for this phone number
  let conversation = await Conversation.findOne({ phoneNumber: from });
  let isNewSession = false;

  if (!conversation) {
    const { userId, sessionId } = generateIds();
    conversation = new Conversation({
      phoneNumber: from,
      niviUserId: userId,
      niviSessionId: sessionId,
    });
    isNewSession = true;
  }

  // Save incoming message
  conversation.messages.push({
    direction: 'incoming',
    body: text,
    whatsappMessageId: messageId,
  });
  conversation.lastActivity = new Date();
  await conversation.save();

  // Create Nivi session if new
  if (isNewSession) {
    try {
      await createSession(conversation.niviUserId, conversation.niviSessionId);
    } catch (error) {
      console.error(`[Webhook] Failed to create Nivi session for ${from}:`, error.message);
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
    console.error(`[Webhook] Nivi error for ${from}:`, error.message);
    const errorMsg = 'מצטערים, אירעה שגיאה. אנא נסה שוב מאוחר יותר.';
    conversation.messages.push({ direction: 'outgoing', body: errorMsg });
    await conversation.save();
    await sendMessage(from, errorMsg);
  }
}

module.exports = router;
