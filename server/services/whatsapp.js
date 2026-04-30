const axios = require('axios');

const MAX_LENGTH = 4096;

function cleanForWhatsApp(text) {
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '\n🔗 *$1*\n$2\n');
  text = text.replace(/\*(\d+\.)/g, '$1');
  text = text.replace(/\*\*(.+?)\*\*/g, '*$1*');
  const parts = text.split('*');
  if (parts.length > 1) {
    let result = '';
    let i = 0;
    while (i < parts.length) {
      result += parts[i];
      if (i + 1 < parts.length) {
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
  text = text.split('\n').map(l => l.trim()).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

async function sendMessage(metaConnection, to, text) {
  text = cleanForWhatsApp(text);
  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push(text.substring(i, i + MAX_LENGTH));
  }

  for (const chunk of chunks) {
    await axios.post(
      metaConnection.apiUrl,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: chunk } },
      {
        headers: {
          Authorization: `Bearer ${metaConnection.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    console.log(`[WhatsApp] Sent to ${to} via connection "${metaConnection.name}" (${chunk.length} chars)`);
  }
}

function extractMessages(body) {
  const messages = [];
  if (body.object === 'whatsapp_business_account' && body.entry) {
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
