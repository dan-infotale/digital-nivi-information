// LOG_REDACT=true → keep personal and vendor details out of the server log:
//   - phone numbers          → [redacted phone]
//   - message text (user questions, bot replies, rewrites, LLM output) → [redacted]
//   - model / provider names → [redacted]
// Timings, decisions and IDs stay, so the log is still useful for diagnosing latency.
//
// Two layers:
//   1. Helpers (text/model) used at the log calls that print content or provider details.
//   2. A console filter that catches phone numbers anywhere (incl. error payloads), plus any
//      model/provider name seen by the helpers that shows up in other messages (e.g. errors).

const util = require('util');

const enabled = /^(1|true|yes|on)$/i.test(String(process.env.LOG_REDACT || '').trim());

const PHONE_RE = /(?<![\w.-])\+?\d{10,15}(?![\w-])/g;
const knownNames = new Set();

// Message content — always hidden when redaction is on
const text = s => (enabled ? '[redacted]' : s);

// Model / provider name — hidden, and remembered so it's also scrubbed from other log lines
function model(name) {
  if (!enabled) return name;
  if (name && String(name).length >= 3) knownNames.add(String(name));
  return '[redacted]';
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function scrub(line) {
  let out = line.replace(PHONE_RE, '[redacted phone]');
  for (const name of knownNames) out = out.replace(new RegExp(escapeRe(name), 'g'), '[redacted]');
  return out;
}

function install() {
  if (!enabled || console.__redactInstalled) return;
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    const original = console[method].bind(console);
    console[method] = (...args) => original(scrub(util.format(...args)));
  }
  console.__redactInstalled = true;
  console.log('[Log] redaction ON (LOG_REDACT) — phone numbers, message text and model/provider names are hidden');
}

module.exports = { enabled, install, text, model };
