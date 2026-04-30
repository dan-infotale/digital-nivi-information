const Conversation = require('../models/Conversation');
const Connector = require('../models/Connector');
const MetaConnection = require('../models/MetaConnection');
const { sendMessage } = require('./whatsapp');

const CLOSE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
const CHECK_INTERVAL_MS = 60 * 1000;    // check every minute
const CLOSE_MESSAGE = 'תודה על פנייתך, הפניה נסגרה, נשמח לעמוד לשירותך בכל זמן';

async function closeInactiveConversations() {
  try {
    const cutoff = new Date(Date.now() - CLOSE_AFTER_MS);
    const stale = await Conversation.find({
      status: 'active',
      lastActivity: { $lt: cutoff },
    }).populate({ path: 'connectorId', populate: { path: 'metaConnectionId' } });

    for (const conv of stale) {
      try {
        const meta = conv.connectorId?.metaConnectionId;
        if (!meta) continue;

        await sendMessage(meta, conv.phoneNumber, CLOSE_MESSAGE);

        conv.messages.push({ direction: 'outgoing', body: CLOSE_MESSAGE });
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
console.log('[AutoClose] Started — closing conversations after 15 min inactivity');

module.exports = { closeInactiveConversations };
