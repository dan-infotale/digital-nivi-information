const express = require('express');
const Connector = require('../models/Connector');
const MetaConnection = require('../models/MetaConnection');
const BotBackend = require('../models/BotBackend');
const Conversation = require('../models/Conversation');
const { sendMessage, extractMessages } = require('../services/whatsapp');
const { createAdapter } = require('../services/adapters/AdapterFactory');

const router = express.Router();

// In-process dedup cache
const processedMessages = new Set();
function isDuplicate(id) {
  if (processedMessages.has(id)) return true;
  processedMessages.add(id);
  if (processedMessages.size > 1000) {
    const arr = [...processedMessages].slice(500);
    processedMessages.clear();
    arr.forEach(x => processedMessages.add(x));
  }
  return false;
}

// Per-phone serialization to prevent race conditions
const phoneLocks = new Map();
function withPhoneLock(key, fn) {
  const prev = phoneLocks.get(key) || Promise.resolve();
  const current = prev.then(fn, fn);
  phoneLocks.set(key, current);
  current.finally(() => {
    if (phoneLocks.get(key) === current) phoneLocks.delete(key);
  });
  return current;
}

// GET: WhatsApp webhook verification
router.get('/:connectorId', async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode !== 'subscribe') return res.sendStatus(403);

  try {
    const connector = await Connector.findById(req.params.connectorId).populate('metaConnectionId');
    if (!connector || !connector.active) return res.sendStatus(404);
    if (connector.metaConnectionId.verifyToken !== token) return res.sendStatus(403);
    console.log(`[Webhook] Verified connector: ${connector.name}`);
    res.status(200).send(challenge);
  } catch {
    res.sendStatus(500);
  }
});

// POST: Incoming WhatsApp messages
router.post('/:connectorId', async (req, res) => {
  res.sendStatus(200); // must respond within 5s

  try {
    const connector = await Connector.findById(req.params.connectorId)
      .populate('metaConnectionId')
      .populate('botBackendId');

    if (!connector || !connector.active) return;

    const messages = extractMessages(req.body);
    for (const msg of messages) {
      if (isDuplicate(msg.messageId)) continue;
      withPhoneLock(`${connector._id}:${msg.from}`, () =>
        handleMessage(connector, msg).catch(err =>
          console.error(`[Webhook] Unhandled error for ${msg.from}:`, err.message)
        )
      );
    }
  } catch (err) {
    console.error('[Webhook] Error processing request:', err.message);
  }
});

const NEW_SESSION_TRIGGERS = ['שיחה חדשה', 'התחל שיחה חדשה', 'new conversation', 'restart'];

function isNewSessionRequest(text) {
  return NEW_SESSION_TRIGGERS.some(t => text.trim().toLowerCase() === t.toLowerCase());
}

async function handleMessage(connector, { from, text, messageId }) {
  const meta = connector.metaConnectionId;
  const bot = connector.botBackendId;

  let conversation = await Conversation.findOne({ connectorId: connector._id, phoneNumber: from });
  const isNew = !conversation;

  if (!conversation) {
    conversation = new Conversation({
      tenantId: connector.tenantId,
      connectorId: connector._id,
      phoneNumber: from,
    });

    if (bot.type === 'nivi') {
      const adapter = await createAdapter(bot);
      const ids = adapter.generateIds();
      conversation.niviUserId = ids.niviUserId;
      conversation.niviSessionId = ids.niviSessionId;
    }
  }

  // DB-level dedup
  if (conversation.messages.some(m => m.whatsappMessageId === messageId)) return;

  // Re-open closed conversations
  if (conversation.status === 'closed') {
    conversation.status = 'active';
  }

  conversation.messages.push({ direction: 'incoming', body: text, whatsappMessageId: messageId });
  conversation.lastActivity = new Date();

  // Handle new session request
  if (!isNew && isNewSessionRequest(text)) {
    const adapter = await createAdapter(bot);
    if (bot.type === 'nivi') {
      const ids = adapter.generateIds();
      conversation.niviUserId = ids.niviUserId;
      conversation.niviSessionId = ids.niviSessionId;
      await conversation.save();
      try {
        await adapter.initialize(conversation);
      } catch (err) {
        console.error(`[Webhook] New session init failed for ${from}:`, err.message);
        await sendError(meta, conversation, from, 'מצטערים, לא הצלחנו ליצור חיבור למערכת. אנא נסה שוב.');
        return;
      }
    } else {
      conversation.openaiHistory = [];
      await conversation.save();
    }
    const confirmMsg = 'בוודאי! מתחילים שיחה חדשה. כיצד אוכל לעזור?';
    conversation.messages.push({ direction: 'outgoing', body: confirmMsg });
    conversation.lastActivity = new Date();
    await conversation.save();
    await sendMessage(meta, from, confirmMsg);
    return;
  }

  await conversation.save();

  const adapter = await createAdapter(bot);

  // Initialize session for new conversations that need it
  if (isNew && bot.type === 'nivi') {
    try {
      await adapter.initialize(conversation);
    } catch (err) {
      console.error(`[Webhook] Session init failed for ${from}:`, err.message);
      await sendError(meta, conversation, from, 'מצטערים, לא הצלחנו ליצור חיבור למערכת. אנא נסה שוב.');
      return;
    }
  }

  try {
    let reply;
    if (bot.type === 'custom_agent') {
      reply = await adapter.sendMessage(conversation, text, bot.knowledgeBaseId);
    } else {
      reply = await adapter.sendMessage(conversation, text);
    }

    if (isNew) {
      reply += '\n\n_להתחלת שיחה חדשה אנא הקלד "שיחה חדשה"_';
    }

    conversation.messages.push({ direction: 'outgoing', body: reply });
    conversation.lastActivity = new Date();
    await conversation.save();

    await sendMessage(meta, from, reply);
  } catch (err) {
    console.error(`[Webhook] Bot error for ${from}:`, err.message);
    let msg = 'מצטערים, אירעה שגיאה. אנא נסה שוב מאוחר יותר.';
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      msg = 'מצטערים, המערכת לא הגיבה בזמן. אנא נסה שוב.';
    } else if (err.response?.status >= 500) {
      msg = 'מצטערים, יש תקלה במערכת. אנא נסה שוב מאוחר יותר.';
    }
    await sendError(meta, conversation, from, msg);
  }
}

async function sendError(meta, conversation, from, msg) {
  try {
    conversation.messages.push({ direction: 'outgoing', body: msg });
    await conversation.save();
    await sendMessage(meta, from, msg);
  } catch (err) {
    console.error(`[Webhook] Failed to send error message to ${from}:`, err.message);
  }
}

module.exports = router;
