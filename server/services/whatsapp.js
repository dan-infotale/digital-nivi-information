const axios = require('axios');

const MAX_LENGTH = 4096;

function cleanForWhatsApp(text) {
  // Preserve fenced code blocks — WhatsApp renders ```code``` natively
  const codeBlocks = [];
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) => {
    const ph = `\x00BLOCK${codeBlocks.length}\x00`;
    codeBlocks.push(`\`\`\`\n${code.trim()}\n\`\`\``);
    return ph;
  });

  // Italic first (before bold produces lone *) — markdown *text* → WhatsApp _text_
  // Negative lookahead/behind ensures we don't touch **bold**
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '_$1_');

  // Bold: **text** or __text__ → *text*  (runs after italic so output is safe)
  text = text.replace(/\*\*(.+?)\*\*/gs, '*$1*');
  text = text.replace(/__(.+?)__/gs, '*$1*');

  // Headings → *bold*  (runs after italic for same reason)
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '*$1*');

  // Strikethrough: ~~text~~ → ~text~
  text = text.replace(/~~(.+?)~~/g, '~$1~');

  // Links: [text](url) → text\nurl  (match any non-whitespace URL)
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1\n$2');

  // Horizontal rules → remove
  text = text.replace(/^[-*_]{3,}$/gm, '');

  // Bullet lists: - or * at line start → •
  text = text.replace(/^[ \t]*[-*]\s+/gm, '• ');

  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    text = text.replace(`\x00BLOCK${i}\x00`, block);
  });

  // Clean up whitespace
  text = text.split('\n').map(l => l.trimEnd()).join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

// Split text into [summary, rest] at the first paragraph break (\n\n).
// If no paragraph break exists, split after the first sentence.
// Returns an array of 1 or 2 strings.
function splitAtFirstParagraph(text) {
  const breakIdx = text.indexOf('\n\n');
  if (breakIdx !== -1) {
    const part1 = text.slice(0, breakIdx).trim();
    const part2 = text.slice(breakIdx + 2).trim();
    if (part1 && part2) return [part1, part2];
    return [text];
  }
  // No paragraph break — split after first sentence
  for (let i = 0; i < text.length - 1; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if ((ch === '.' || ch === '?' || ch === '!') && (next === ' ' || next === '\n')) {
      const part1 = text.slice(0, i + 1).trim();
      const part2 = text.slice(i + 1).trim();
      if (part1 && part2) return [part1, part2];
      break;
    }
  }
  return [text];
}

async function sendMessage(metaConnection, to, text) {
  text = cleanForWhatsApp(text);

  // Split into summary + details so the summary is always fully visible
  const parts = splitAtFirstParagraph(text);

  const chunks = [];
  for (const part of parts) {
    for (let i = 0; i < part.length; i += MAX_LENGTH) {
      chunks.push(part.substring(i, i + MAX_LENGTH));
    }
  }

  for (const chunk of chunks) {
    await axios.post(
      metaConnection.apiUrl,
      { messaging_product: 'whatsapp', to, type: 'text', text: { body: chunk, preview_url: true } },
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
                type: 'text',
              });
            } else if (['image', 'audio', 'video', 'document', 'sticker', 'voice', 'contacts', 'location'].includes(msg.type)) {
              messages.push({
                from: msg.from,
                text: null,
                messageId: msg.id,
                timestamp: msg.timestamp,
                type: msg.type,
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
