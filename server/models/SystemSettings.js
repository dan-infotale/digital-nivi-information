const mongoose = require('mongoose');
const providerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  baseUrl: { type: String, default: '' },
  apiKey: { type: String, default: '' },
  model: { type: String, default: 'gpt-4o' },
});
const schema = new mongoose.Schema({
  embeddingConfig: {
    baseUrl: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    model: { type: String, default: 'text-embedding-3-small' },
  },
  llmProviders: [providerSchema],
}, { collection: 'system_settings' });
module.exports = mongoose.model('SystemSettings', schema);
