const axios = require('axios');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const MAX_LENGTH = 4096;

// Clean Nivi's markdown formatting for WhatsApp
function cleanForWhatsApp(text) {
  // Remove stray leading asterisks before numbered items (e.g. "*1." → "1.")
  text = text.replace(/\*(\d+\.)/g, '$1');
  // Convert markdown bold **text** or *text* to WhatsApp bold *text*
  // First handle double asterisks
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  // Remove unmatched/orphan asterisks (not part of a *bold* pair)
  // Count asterisks — if odd number, strip all non-paired ones
  const parts = text.split('*');
  if (parts.length > 1) {
    // Rebuild: keep matched pairs, strip orphans
    let result = '';
    let i = 0;
    while (i < parts.length) {
      result += parts[i];
      if (i + 1 < parts.length) {
        // Check if the next segment looks like a bold word/phrase (non-empty, no newlines)
        const candidate = parts[i + 1];
        if (candidate && !candidate.includes('\n') && candidate.trim().length > 0) {
          result += '*' + candidate + '*';
          i += 2;
        } else {
          i += 1;
        }
      } else {
        i += 1;
      }
    }
    text = result;
  }
  return text.trim();
}

async function sendMessage(to, text) {
  text = cleanForWhatsApp(text);
  // Split into chunks if text exceeds WhatsApp's 4096 char limit
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push(text.substring(i, i + MAX_LENGTH));
  }

  for (const chunk of chunks) {
    try {
      await axios.post(
        WHATSAPP_API_URL,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: chunk },
        },
        {
          headers: {
            Authorization: `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      console.log(`[WhatsApp] Message sent to ${to} (${chunk.length} chars)`);
    } catch (error) {
      console.error('[WhatsApp] Send error:', error.response?.data || error.message);
      throw error;
    }
  }
}

function extractMessages(body) {
  const messages = [];
  if (
    body.object === 'whatsapp_business_account' &&
    body.entry
  ) {
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        if (change.field === 'messages' && change.value?.messages) {
          for (const msg of change.value.messages) {
            if (msg.type === 'text') {
              messages.push({
                from: msg.from,
                text: msg.text.body,
                messageId: msg.id,
                timestamp: msg.timestamp,
              });
            }
          }
        }
      }
    }
  }
  return messages;
}

module.exports = { sendMessage, extractMessages, cleanForWhatsApp };
