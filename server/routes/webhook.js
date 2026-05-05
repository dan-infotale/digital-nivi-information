const express = require('express');
const OpenAI = require('openai');
const Connector = require('../models/Connector');
const MetaConnection = require('../models/MetaConnection');
const BotBackend = require('../models/BotBackend');
const Conversation = require('../models/Conversation');
const SystemSettings = require('../models/SystemSettings');
const { sendMessage, extractMessages } = require('../services/whatsapp');
const { createAdapter } = require('../services/adapters/AdapterFactory');
const { containsPii, redactPii } = require('../services/piiFilter');

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
      if (msg.type !== 'text') {
        withPhoneLock(`${connector._id}:${msg.from}`, () =>
          handleUnsupportedMessage(connector, msg).catch(err =>
            console.error(`[Webhook] Error handling unsupported message for ${msg.from}:`, err.message)
          )
        );
        continue;
      }
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

const UNSUPPORTED_TYPE_LABELS = {
  image: 'תמונות',
  audio: 'הודעות קוליות',
  voice: 'הודעות קוליות',
  video: 'סרטונים',
  document: 'מסמכים',
  sticker: 'מדבקות',
  contacts: 'אנשי קשר',
  location: 'שיתוף מיקום',
};

async function handleUnsupportedMessage(connector, { from, type }) {
  const meta = connector.metaConnectionId;
  const label = UNSUPPORTED_TYPE_LABELS[type] || 'תוכן זה';
  const msg = connector.unsupportedMessage ||
    `לא ניתן לצרף ${label} בשלב זה. אשמח להמשיך לסייע בהודעות כתובות.`;
  try {
    await sendMessage(meta, from, msg);
  } catch (err) {
    console.error(`[Webhook] Failed to send unsupported-type reply to ${from}:`, err.message);
  }
}

// Fast heuristic: catches bot self-introduction greetings without LLM
function looksLikeGreeting(text) {
  const lower = text.toLowerCase();
  const hasGreetingOpener = /^(שלום|היי|הי|בוקר טוב|ערב טוב)[,!. ]/.test(text);
  const hasBotName = lower.includes('ניבי') || lower.includes('עוזר הווירטואלי') || lower.includes('עוזרת הווירטואלית');
  const hasHelpOffer = lower.includes('אוכל לעזור') || lower.includes('אוכל לסייע') || lower.includes('כיצד אוכל');
  return hasGreetingOpener && hasBotName && hasHelpOffer;
}

async function isGreetingReply(userMessage, botReply, providerName) {
  // Fast path — no LLM call needed
  if (looksLikeGreeting(botReply)) {
    console.log(`[GreetingClassifier] heuristic=greeting for reply: ${botReply.slice(0, 80)}`);
    return true;
  }

  try {
    const settings = await SystemSettings.findOne().lean();
    const provider = providerName
      ? settings?.llmProviders?.find(p => p.name === providerName)
      : settings?.llmProviders?.[0];
    if (!provider?.baseUrl && !provider?.apiKey) return false;

    const client = new OpenAI({
      baseURL: provider.baseUrl || undefined,
      apiKey: provider.apiKey || 'no-key',
    });

    const result = await client.chat.completions.create({
      model: provider.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a binary classifier for chatbot messages. ' +
            'Your task: decide if the bot reply is a PURE greeting/introduction with NO substantive content — ' +
            'meaning it only introduces the bot and asks how to help, without answering the user\'s question at all. ' +
            'Examples of pure greetings: "שלום! אני ניבי, העוזרת הווירטואלית של Gov.il. במה אוכל לעזור לך היום?", "Hello! I\'m the virtual assistant, how can I help?" ' +
            'Examples of NON-greetings (even if they start with שלום): any reply that actually answers or addresses the user\'s question. ' +
            'Respond with ONLY the word "greeting" or "answer". No punctuation, no explanation.',
        },
        {
          role: 'user',
          content: `User message:\n${userMessage}\n\nBot reply:\n${botReply}`,
        },
      ],
      temperature: 0,
      max_tokens: 10,
    });

    const raw = result.choices[0]?.message?.content?.trim().toLowerCase() || '';
    console.log(`[GreetingClassifier] verdict="${raw}" for reply: ${botReply.slice(0, 80)}`);
    return raw.startsWith('greeting');
  } catch (err) {
    console.warn('[Webhook] Greeting classifier failed, allowing reply through:', err.message);
    return false;
  }
}

const NEW_SESSION_TRIGGERS = ['שיחה חדשה', 'התחל שיחה חדשה', 'new conversation', 'restart'];

function isNewSessionRequest(text) {
  return NEW_SESSION_TRIGGERS.some(t => text.trim().toLowerCase() === t.toLowerCase());
}

async function createNewConversation(connector, bot, from) {
  const conv = new Conversation({
    tenantId: connector.tenantId,
    connectorId: connector._id,
    phoneNumber: from,
  });
  if (bot.type === 'nivi') {
    const adapter = await createAdapter(bot);
    const ids = adapter.generateIds();
    conv.niviUserId = ids.niviUserId;
    conv.niviSessionId = ids.niviSessionId;
  }
  return conv;
}

async function handleMessage(connector, { from, text, messageId }) {
  const meta = connector.metaConnectionId;
  const bot = connector.botBackendId;

  // Only match active conversations — closed ones stay as historical records
  let conversation = await Conversation.findOne({ connectorId: connector._id, phoneNumber: from, status: 'active' });
  const isNew = !conversation;

  if (!conversation) {
    conversation = await createNewConversation(connector, bot, from);
  }

  // DB-level dedup
  if (conversation.messages.some(m => m.whatsappMessageId === messageId)) return;

  // PII/PCI guard — redact, warn user, skip bot (only if enabled on the bot backend)
  if (bot.config?.piiFilter && containsPii(text)) {
    const redacted = redactPii(text);
    conversation.messages.push({ direction: 'incoming', body: redacted, whatsappMessageId: messageId });
    conversation.lastActivity = new Date();
    await conversation.save();
    const warning = 'אנא המנע משליחה של מידע אישי בשיחה זו';
    conversation.messages.push({ direction: 'outgoing', body: warning });
    await conversation.save();
    await sendMessage(meta, from, warning);
    return;
  }

  // Handle new session request — close current conv, open a fresh document
  if (!isNew && isNewSessionRequest(text)) {
    conversation.messages.push({ direction: 'incoming', body: text, whatsappMessageId: messageId });
    conversation.lastActivity = new Date();
    conversation.status = 'closed';
    await conversation.save();

    const newConv = await createNewConversation(connector, bot, from);
    if (bot.type === 'nivi') {
      await newConv.save();
      try {
        await createAdapter(bot).then(a => a.initialize(newConv));
      } catch (err) {
        console.error(`[Webhook] New session init failed for ${from}:`, err.message);
        await sendError(meta, newConv, from, 'מצטערים, לא הצלחנו ליצור חיבור למערכת. אנא נסה שוב.');
        return;
      }
    }
    if (connector.welcomeMessage) {
      newConv.messages.push({ direction: 'outgoing', body: connector.welcomeMessage });
      newConv.lastActivity = new Date();
      await newConv.save();
      await sendMessage(meta, from, connector.welcomeMessage);
    }
    const confirmMsg = 'בוודאי! מתחילים שיחה חדשה. כיצד אוכל לעזור?';
    newConv.messages.push({ direction: 'outgoing', body: confirmMsg });
    newConv.lastActivity = new Date();
    await newConv.save();
    await sendMessage(meta, from, confirmMsg);
    return;
  }

  conversation.messages.push({ direction: 'incoming', body: text, whatsappMessageId: messageId });
  conversation.lastActivity = new Date();
  await conversation.save();

  if (isNew && connector.welcomeMessage) {
    conversation.messages.push({ direction: 'outgoing', body: connector.welcomeMessage });
    await conversation.save();
    await sendMessage(meta, from, connector.welcomeMessage);
  }

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

    // Suppress bot greeting on first message if enabled and connector already sent a welcome message
    if (isNew && connector.suppressBotGreeting && connector.welcomeMessage &&
        await isGreetingReply(text, reply, connector.greetingClassifierProvider)) {
      console.log(`[Webhook] Suppressed bot greeting for ${from} (suppressBotGreeting enabled)`);
      return;
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
