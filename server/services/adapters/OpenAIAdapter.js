const { createClient, chatCompletion } = require('../llm');
const KnowledgeBase = require('../../models/KnowledgeBase');
const SystemSettings = require('../../models/SystemSettings');
const { embedTexts, retrieveTopK } = require('../rag');

class OpenAIAdapter {
  constructor(botConfig, provider) {
    this.config = botConfig;
    this.provider = provider;
    this.client = createClient(provider);
  }

  async initialize() {}

  async sendMessage(conversation, text, knowledgeBaseId = null) {
    let systemPrompt = this.config.systemPrompt || 'You are a helpful assistant.';
    systemPrompt += '\n\nFormatting: Always begin your response with a 1-2 sentence summary as a standalone paragraph, then elaborate with details.';

    if (knowledgeBaseId) {
      try {
        const settings = await SystemSettings.findOne().lean();
        const embCfg = settings?.embeddingConfig;
        if (embCfg?.baseUrl && embCfg?.model) {
          const kb = await KnowledgeBase.findById(knowledgeBaseId).lean();
          if (kb && kb.documents.length > 0) {
            const [queryEmbedding] = await embedTexts([text], embCfg);
            const topK = this.config.topK || 5;
            const chunks = retrieveTopK(queryEmbedding, kb.documents, topK);
            if (chunks.length > 0) {
              systemPrompt += '\n\n---\nRelevant context:\n' + chunks.join('\n\n');
            }
          }
        }
      } catch (err) {
        console.warn('[CustomAgent] RAG retrieval failed, continuing without context:', err.message);
      }
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.openaiHistory,
      { role: 'user', content: text },
    ];

    const response = await chatCompletion(this.provider, {
      messages,
      temperature: this.config.temperature ?? 0.7,
    }, { client: this.client });

    const reply = response.choices[0]?.message?.content || 'לא התקבלה תשובה.';

    conversation.openaiHistory.push(
      { role: 'user', content: text },
      { role: 'assistant', content: reply }
    );

    return reply;
  }
}

module.exports = OpenAIAdapter;
