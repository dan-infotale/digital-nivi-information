const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
  body: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  whatsappMessageId: String,
}, { _id: false });

const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  connectorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Connector', required: true, index: true },
  phoneNumber: { type: String, required: true, index: true },
  // Nivi-specific session identifiers
  niviUserId: { type: String, default: null },
  niviSessionId: { type: String, default: null },
  // OpenAI-compatible conversation history [{role, content}]
  openaiHistory: { type: Array, default: [] },
  messages: [messageSchema],
  status: { type: String, enum: ['active', 'closed'], default: 'active' },
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ connectorId: 1, phoneNumber: 1 }, { unique: true });

module.exports = mongoose.model('Conversation', schema);
