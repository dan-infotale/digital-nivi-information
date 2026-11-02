const axios = require('axios');
const { StringDecoder } = require('string_decoder');
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
      let partialText = '';
      let buffer = '';
      const decoder = new StringDecoder('utf8');

      const handleLine = (line) => {
        if (!line.startsWith('data:')) return;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') return;
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          fullText += raw;
          return;
        }
        if (data.content?.parts) {
          const t = data.content.parts.map(p => p.text || '').join('');
          // Events with only function calls/responses carry no text — don't let them wipe the answer.
          if (!t) return;
          if (data.partial) {
            // Streaming chunk: accumulate deltas
            partialText += t;
            fullText = partialText;
          } else {
            // Final (aggregated) event replaces the streamed chunks
            fullText = t;
            partialText = '';
          }
        } else if (data.delta?.text) {
          fullText += data.delta.text;
        } else if (data.delta?.parts) {
          fullText += data.delta.parts.map(p => p.text || '').join('');
        } else if (data.text) {
          fullText += data.text;
        }
      };

      response.data.on('data', (chunk) => {
        buffer += decoder.write(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) handleLine(line.replace(/\r$/, ''));
      });

      response.data.on('end', () => {
        buffer += decoder.end(); // flush any remaining bytes
        // Last event may arrive without a trailing newline — process it too
        for (const line of buffer.split('\n')) handleLine(line.replace(/\r$/, ''));
        resolve(fullText || 'לא התקבלה תשובה מהמערכת.');
      });

      response.data.on('error', reject);
    });
  }
}

module.exports = NiviAdapter;
