const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true },
  metaConnectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'MetaConnection', required: true },
  botBackendId: { type: mongoose.Schema.Types.ObjectId, ref: 'BotBackend', required: true },
  active: { type: Boolean, default: true },
  welcomeMessage:     { type: String, default: '' },
  unsupportedMessage: { type: String, default: '' },
  autoCloseMinutes:   { type: Number, default: 15 },
  autoCloseMessage:   { type: String, default: '' },
  suppressBotGreeting:          { type: Boolean, default: false },
  greetingClassifierProvider:   { type: String, default: '' },
  rewriteEnabled:               { type: Boolean, default: false },
  rewritePrompt:                { type: String, default: '' },
  rewriteProvider:              { type: String, default: '' },
  retention: {
    enabled:    { type: Boolean, default: false },
    days:       { type: Number, default: 90 },
    deleteMode: { type: String, enum: ['full', 'messages'], default: 'full' },
  },
  createdAt: { type: Date, default: Date.now },
});
module.exports = mongoose.model('Connector', schema);
