const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
  body: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  whatsappMessageId: String,
});

const conversationSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, index: true },
  niviUserId: { type: String, required: true },
  niviSessionId: { type: String, required: true },
  messages: [messageSchema],
  lastActivity: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Conversation', conversationSchema);
