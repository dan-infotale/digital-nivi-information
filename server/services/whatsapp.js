const axios = require('axios');

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;

async function sendMessage(to, text) {
  try {
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`[WhatsApp] Message sent to ${to}`);
    return response.data;
  } catch (error) {
    console.error('[WhatsApp] Send error:', error.response?.data || error.message);
    throw error;
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
