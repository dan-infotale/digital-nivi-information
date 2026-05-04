const Conversation = require('../models/Conversation');
const { sendMessage } = require('./whatsapp');

const CHECK_INTERVAL_MS = 60 * 1000; // check every minute
const DEFAULT_CLOSE_AFTER_MS = 15 * 60 * 1000;
const DEFAULT_CLOSE_MESSAGE = 'תודה על פנייתך, הפניה נסגרה, נשמח לעמוד לשירותך בכל זמן';

async function closeInactiveConversations() {
  try {
    // Pre-filter: inactive for at least 1 minute (per-connector timeout applied below)
    const minCutoff = new Date(Date.now() - 60 * 1000);
    const candidates = await Conversation.find({
      status: 'active',
      lastActivity: { $lt: minCutoff },
    }).populate({ path: 'connectorId', populate: { path: 'metaConnectionId' } });

    for (const conv of candidates) {
      try {
        const connector = conv.connectorId;
        const meta = connector?.metaConnectionId;
        if (!meta) continue;

        const closeAfterMs = (connector?.autoCloseMinutes ?? 15) * 60 * 1000;
        const elapsed = Date.now() - new Date(conv.lastActivity).getTime();
        if (elapsed < closeAfterMs) continue;

        const closeMsg = connector?.autoCloseMessage || DEFAULT_CLOSE_MESSAGE;

        await sendMessage(meta, conv.phoneNumber, closeMsg);

        conv.messages.push({ direction: 'outgoing', body: closeMsg });
        conv.status = 'closed';
        conv.lastActivity = new Date();
        await conv.save();

        console.log(`[AutoClose] Closed conversation ${conv._id} (${conv.phoneNumber})`);
      } catch (err) {
        console.error(`[AutoClose] Failed to close ${conv._id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[AutoClose] Error:', err.message);
  }
}

setInterval(closeInactiveConversations, CHECK_INTERVAL_MS);
console.log('[AutoClose] Started — per-connector inactivity timeout');

module.exports = { closeInactiveConversations };
