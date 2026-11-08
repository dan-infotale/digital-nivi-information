// Tags every log line written while handling a message with that message's context, so
// concurrent users can be told apart in the log (phone numbers may be redacted).
//
//   [msg:3f9a1c conv:6a1b2c3d] [Timing] ... question sent to Nivi at 0ms
//
// msg  = random id per incoming message (present from the very first line)
// conv = short conversation id (last 8 chars) — the same id shown in the Conversations screen
//
// AsyncLocalStorage carries the context through awaits, timers and callbacks, so no
// log call needs to pass it explicitly.

const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const storage = new AsyncLocalStorage();

const shortConvId = id => (id ? String(id).slice(-8) : null);

// Run fn with a fresh per-message context
function runForMessage(fn) {
  return storage.run({ msg: crypto.randomBytes(3).toString('hex'), conv: null }, fn);
}

// Attach the conversation once it's known (mutates the current context)
function setConversation(conversation) {
  const ctx = storage.getStore();
  if (ctx && conversation?._id) ctx.conv = shortConvId(conversation._id);
}

function prefix() {
  const ctx = storage.getStore();
  if (!ctx) return '';
  return `[msg:${ctx.msg}${ctx.conv ? ` conv:${ctx.conv}` : ''}] `;
}

module.exports = { runForMessage, setConversation, prefix, shortConvId };
