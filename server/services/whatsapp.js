const axios = require('axios');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

const MAX_LENGTH = 4096;

async function sendMessage(to, text) {
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

module.exports = { sendMessage, extractMessages };
