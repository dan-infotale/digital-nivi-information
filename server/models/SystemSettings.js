const mongoose = require('mongoose');
const providerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // 'openai' = any OpenAI-compatible endpoint (OpenAI, Azure AI Foundry, OpenRouter, Ollama…)
  // 'bedrock' = AWS Bedrock via the Converse API
  type: { type: String, enum: ['openai', 'bedrock'], default: 'openai' },
  baseUrl: { type: String, default: '' },
  apiKey: { type: String, default: '' }, // bedrock: optional Bedrock API key
  model: { type: String, default: 'gpt-4o' }, // bedrock: model ID or inference profile ID
  region: { type: String, default: '' }, // bedrock only
  awsAccessKeyId: { type: String, default: '' }, // bedrock only
  awsSecretAccessKey: { type: String, default: '' }, // bedrock only
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
