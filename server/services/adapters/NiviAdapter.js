const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

async function withRetry(fn, { retries = 2, label = 'op' } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      const isTransient = !status || status >= 500 || err.code === 'ECONNABORTED';
      if (attempt < retries && isTransient) {
        const delay = 1000 * (attempt + 1);
        console.warn(`[Nivi] ${label} failed (attempt ${attempt + 1}), retrying in ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

class NiviAdapter {
  constructor(config) {
    const base = config.baseUrl.replace(/\/$/, '');
    this.sessionUrl = `${base}/apps/govilagent/users/{USER}/sessions/{SESSION}`;
    this.sseUrl = `${base}/run_sse`;
    this.headers = { 'Content-Type': 'application/json' };
  }

  generateIds() {
    return { niviUserId: uuidv4(), niviSessionId: uuidv4() };
  }

  async initialize(conversation) {
    const url = this.sessionUrl
      .replace('{USER}', encodeURIComponent(conversation.niviUserId))
      .replace('{SESSION}', encodeURIComponent(conversation.niviSessionId));

    await withRetry(
      () => axios.post(url, {}, { headers: this.headers, timeout: 15000 }),
      { label: 'createSession' }
    );
    console.log(`[Nivi] Session created: ${conversation.niviSessionId}`);
  }

  async sendMessage(conversation, text) {
    // If session expired, re-initialize and retry once
    try {
      return await this._doSendMessage(conversation, text);
    } catch (err) {
      if (err.response?.status === 401) {
        console.warn('[Nivi] Session expired, re-initializing...');
        await this.initialize(conversation);
        return await this._doSendMessage(conversation, text);
      }
      throw err;
    }
  }

  async _doSendMessage(conversation, text) {
    const response = await axios.post(
      this.sseUrl,
      {
        appName: 'govilagent',
        userId: conversation.niviUserId,
        sessionId: conversation.niviSessionId,
        newMessage: { role: 'user', parts: [{ text }] },
        streaming: true,
      },
      { headers: this.headers, responseType: 'stream', timeout: 60000 }
    );

    return new Promise((resolve, reject) => {
      let fullText = '';
      let buffer = '';

      response.data.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const data = JSON.parse(raw);
            if (data.content?.parts) {
              fullText = data.content.parts.map(p => p.text || '').join('');
            } else if (data.delta?.text) {
              fullText += data.delta.text;
            } else if (data.delta?.parts) {
              fullText += data.delta.parts.map(p => p.text || '').join('');
            } else if (data.text) {
              fullText += data.text;
            }
          } catch {
            if (raw !== '[DONE]') fullText += raw;
          }
        }
      });

      response.data.on('end', () => {
        resolve(fullText || 'לא התקבלה תשובה מהמערכת.');
      });

      response.data.on('error', reject);
    });
  }
}

module.exports = NiviAdapter;
