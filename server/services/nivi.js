const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const NIVI_BASE_URL = process.env.NIVI_BASE_URL || 'https://nivi.digital.gov.il/pub/cio/nivi/rest/agent/v3/agent';
const SESSION_URL = `${NIVI_BASE_URL}/apps/govilagent/users/{USER}/sessions/{SESSION}`;
const RUN_SSE_URL = `${NIVI_BASE_URL}/run_sse`;

// Create a new session for a user
async function createSession(userId, sessionId) {
  const url = SESSION_URL
    .replace('{USER}', encodeURIComponent(userId))
    .replace('{SESSION}', encodeURIComponent(sessionId));

  try {
    const response = await axios.post(url, {}, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    console.log(`[Nivi] Session created for user ${userId}, session ${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('[Nivi] Create session error:', error.response?.data || error.message);
    throw error;
  }
}

// Send message and collect SSE response
async function sendToNivi(userId, sessionId, messageText) {
  const response = await axios.post(
    RUN_SSE_URL,
    {
      appName: 'govilagent',
      userId,
      sessionId,
      newMessage: {
        role: 'user',
        parts: [{ text: messageText }],
      },
      streaming: true,
    },
    {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'stream',
      timeout: 60000,
    }
  );

  return new Promise((resolve, reject) => {
    let fullText = '';
    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      // Parse SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data:')) {
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            // Extract text from various possible response formats
            if (data.content?.parts) {
              for (const part of data.content.parts) {
                if (part.text) fullText += part.text;
              }
            } else if (data.text) {
              fullText += data.text;
            } else if (data.delta?.text) {
              fullText += data.delta.text;
            } else if (data.delta?.parts) {
              for (const part of data.delta.parts) {
                if (part.text) fullText += part.text;
              }
            }
          } catch {
            // Not JSON, might be plain text
            if (dataStr !== '[DONE]') fullText += dataStr;
          }
        }
      }
    });

    response.data.on('end', () => {
      // Process remaining buffer
      if (buffer.startsWith('data:')) {
        const dataStr = buffer.slice(5).trim();
        if (dataStr && dataStr !== '[DONE]') {
          try {
            const data = JSON.parse(dataStr);
            if (data.content?.parts) {
              for (const part of data.content.parts) {
                if (part.text) fullText += part.text;
              }
            } else if (data.text) {
              fullText += data.text;
            }
          } catch {
            fullText += dataStr;
          }
        }
      }

      console.log(`[Nivi] Response collected (${fullText.length} chars)`);
      resolve(fullText || 'לא התקבלה תשובה מהמערכת.');
    });

    response.data.on('error', (err) => {
      console.error('[Nivi] SSE stream error:', err.message);
      reject(err);
    });
  });
}

// Generate new user/session IDs
function generateIds() {
  return {
    userId: uuidv4(),
    sessionId: uuidv4(),
  };
}

module.exports = { createSession, sendToNivi, generateIds };
