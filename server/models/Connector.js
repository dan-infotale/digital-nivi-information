const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  metaConnectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MetaConnection', required: true },
  botBackendId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotBackend', required: true },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Connector', schema);
