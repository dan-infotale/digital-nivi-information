const mongoose = require('mongoose');
const chunkSchema = new mongoose.Schema({
  text: { type: String, required: true },
  embedding: { type: [Number], default: [] },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });
const documentSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  chunks: [chunkSchema],
});
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  embeddingConfig: {
    baseUrl: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    model: { type: String, default: 'text-embedding-3-small' },
  },
  documents: [documentSchema],
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('KnowledgeBase', schema);
