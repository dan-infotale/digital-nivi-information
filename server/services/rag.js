const OpenAI = require('openai');

const CHUNK_SIZE = 600;
const CHUNK_OVERLAP = 80;

function chunkText(text) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + CHUNK_SIZE).trim());
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks.filter(c => c.length > 20);
}

async function embedTexts(texts, embeddingConfig) {
  const client = new OpenAI({
    baseURL: embeddingConfig.baseUrl || undefined,
    apiKey: embeddingConfig.apiKey || 'no-key',
  });
  const response = await client.embeddings.create({
    model: embeddingConfig.model || 'text-embedding-3-small',
    input: texts,
  });
  return response.data.map(d => d.embedding);
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function retrieveTopK(queryEmbedding, documents, topK = 5) {
  const allChunks = [];
  for (const doc of documents) {
    for (const chunk of doc.chunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        allChunks.push({
          text: chunk.text,
          score: cosineSimilarity(queryEmbedding, chunk.embedding),
        });
      }
    }
  }
  allChunks.sort((a, b) => b.score - a.score);
  return allChunks.slice(0, topK).map(c => c.text);
}

module.exports = { chunkText, embedTexts, retrieveTopK };
