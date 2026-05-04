const Tenant = require('../models/Tenant');
const Connector = require('../models/Connector');
const Conversation = require('../models/Conversation');

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // check every hour

async function deleteStaleConversations() {
  try {
    // Tenant-level retention (deletes entire conversations)
    const tenants = await Tenant.find({ 'retention.enabled': true, 'retention.days': { $gt: 0 } }).lean();
    for (const tenant of tenants) {
      const cutoff = new Date(Date.now() - tenant.retention.days * 24 * 60 * 60 * 1000);
      const result = await Conversation.deleteMany({ tenantId: tenant._id, lastActivity: { $lt: cutoff } });
      if (result.deletedCount > 0) {
        console.log(`[Retention] Tenant "${tenant.name}": deleted ${result.deletedCount} conversations older than ${tenant.retention.days} days`);
      }
    }

    // Connector-level retention (full delete or messages-only wipe)
    const connectors = await Connector.find({ 'retention.enabled': true, 'retention.days': { $gt: 0 } }).lean();
    for (const connector of connectors) {
      const cutoff = new Date(Date.now() - connector.retention.days * 24 * 60 * 60 * 1000);
      if (connector.retention.deleteMode === 'messages') {
        const result = await Conversation.updateMany(
          { connectorId: connector._id, lastActivity: { $lt: cutoff } },
          { $set: { messages: [] } }
        );
        if (result.modifiedCount > 0) {
          console.log(`[Retention] Connector "${connector._id}": cleared messages in ${result.modifiedCount} conversations`);
        }
      } else {
        const result = await Conversation.deleteMany({ connectorId: connector._id, lastActivity: { $lt: cutoff } });
        if (result.deletedCount > 0) {
          console.log(`[Retention] Connector "${connector._id}": deleted ${result.deletedCount} conversations`);
        }
      }
    }
  } catch (err) {
    console.error('[Retention] Error:', err.message);
  }
}

setInterval(deleteStaleConversations, CHECK_INTERVAL_MS);
deleteStaleConversations();
console.log('[Retention] Started — checks every hour');

module.exports = { deleteStaleConversations };
