const NiviAdapter = require('./NiviAdapter');
const OpenAIAdapter = require('./OpenAIAdapter');
const SystemSettings = require('../../models/SystemSettings');

async function createAdapter(botBackend) {
  switch (botBackend.type) {
    case 'nivi':
      return new NiviAdapter(botBackend.config);
    case 'custom_agent': {
      const settings = await SystemSettings.findOne().lean();
      const provider = settings?.llmProviders?.find(
        p => p._id.toString() === String(botBackend.config.providerId)
      );
      if (!provider) throw new Error(`LLM provider not found: ${botBackend.config.providerId}`);
      return new OpenAIAdapter(botBackend.config, provider);
    }
    default:
      throw new Error(`Unknown bot backend type: ${botBackend.type}`);
  }
}

module.exports = { createAdapter };
