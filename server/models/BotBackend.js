const mongoose = require('mongoose');
// config shape per type:
// nivi: { baseUrl: String }
// custom_agent: { providerId, systemPrompt, temperature?, topK? }
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['nivi', 'custom_agent'], required: true },
  config: { type: mongoose.Schema.Types.Mixed, required: true },
  knowledgeBaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeBase', default: null },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('BotBackend', schema);
