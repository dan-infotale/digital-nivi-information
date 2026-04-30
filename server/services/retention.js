const Tenant = require('../models/Tenant');
const Conversation = require('../models/Conversation');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

async function deleteStaleConversations() {
  try {
    const tenants = await Tenant.find({ 'retention.enabled': true, 'retention.days': { $gt: 0 } }).lean();

    for (const tenant of tenants) {
      const cutoff = new Date(Date.now() - tenant.retention.days * 24 * 60 * 60 * 1000);
      const result = await Conversation.deleteMany({
        tenantId: tenant._id,
        lastActivity: { $lt: cutoff },
      });
      if (result.deletedCount > 0) {
        console.log(`[Retention] Tenant "${tenant.name}": deleted ${result.deletedCount} conversations older than ${tenant.retention.days} days`);
      }
    }
  } catch (err) {
    console.error('[Retention] Error:', err.message);
  }
}

setInterval(deleteStaleConversations, CHECK_INTERVAL_MS);
deleteStaleConversations(); // run once on startup
console.log('[Retention] Started — checks every hour');

module.exports = { deleteStaleConversations };
