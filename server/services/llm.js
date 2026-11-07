// Shared LLM access for all OpenAI-compatible providers.
//
// Classic models (gpt-4o, Llama, etc.) accept `max_tokens` and any `temperature`.
// Newer reasoning models (GPT-5 family, o-series — e.g. on Azure AI Foundry) reject both:
// they need `max_completion_tokens` and only allow the default temperature.
// We send the classic form first; if the provider rejects a parameter, we adapt, retry,
// and remember the adaptation per provider+model so later calls go right the first time.

const OpenAI = require('openai');

// `${baseUrl}|${model}` → { useMaxCompletionTokens, dropTemperature, dropReasoningEffort }
const learned = new Map();

// Users often paste the full endpoint they see in the portal — strip the operation path.
function normalizeBaseUrl(url) {
  if (!url) return undefined;
  return url.trim().replace(/\/+$/, '').replace(/\/(responses|chat\/completions|completions)$/i, '');
}

function createClient(provider) {
  const baseURL = normalizeBaseUrl(provider.baseUrl);
  const apiKey = provider.apiKey || 'no-key';
  // Azure accepts the key as `api-key`; send it alongside the standard Bearer header.
  const isAzure = /\.azure\.com/i.test(baseURL || '');
  return new OpenAI({
    baseURL,
    apiKey,
    defaultHeaders: isAzure && provider.apiKey ? { 'api-key': provider.apiKey } : undefined,
  });
}

function applyLearned(params, l, reasoningEffort) {
  const p = { ...params };
  if (l.useMaxCompletionTokens && p.max_tokens != null) {
    p.max_completion_tokens = p.max_completion_tokens ?? p.max_tokens;
    delete p.max_tokens;
  }
  if (l.dropTemperature) delete p.temperature;
  // Reasoning models spend completion tokens on thinking — keep it short when the caller asks
  if (l.useMaxCompletionTokens && reasoningEffort && !l.dropReasoningEffort) {
    p.reasoning_effort = reasoningEffort;
  }
  return p;
}

// Which parameter did the provider reject? Returns 'max_tokens' | 'temperature' | 'reasoning_effort' | null
function rejectedParam(err) {
  if ((err.status || err.response?.status) !== 400) return null;
  const param = err.param || err.error?.param;
  const msg = `${err.message || ''} ${err.error?.message || ''}`.toLowerCase();
  for (const name of ['max_tokens', 'temperature', 'reasoning_effort']) {
    if (param === name) return name;
  }
  if (/unsupported|not supported|does not support|unrecognized|unknown/.test(msg)) {
    if (msg.includes("'max_tokens'") || msg.includes('max_completion_tokens')) return 'max_tokens';
    if (msg.includes('temperature')) return 'temperature';
    if (msg.includes('reasoning_effort')) return 'reasoning_effort';
  }
  return null;
}

// ── AWS Bedrock (Converse API — works with every Bedrock chat model) ──────────────────────
//
// Auth, first match wins:
//   1. awsAccessKeyId + awsSecretAccessKey (IAM user keys)
//   2. apiKey → Bedrock API key (bearer token)
//   3. nothing → the AWS default chain (env vars, instance/task role, ~/.aws)

const isBedrock = provider => provider?.type === 'bedrock';

// A provider is usable if it has something to connect with
function isUsableProvider(provider) {
  if (!provider) return false;
  if (isBedrock(provider)) return !!(provider.region && provider.model);
  return !!(provider.baseUrl || provider.apiKey);
}

const bedrockClients = new Map();
function bedrockClient(provider) {
  const key = [provider.region, provider.awsAccessKeyId, provider.awsSecretAccessKey, provider.apiKey].join('|');
  let c = bedrockClients.get(key);
  if (!c) {
    const { BedrockRuntimeClient } = require('@aws-sdk/client-bedrock-runtime');
    const config = { region: provider.region };
    if (provider.awsAccessKeyId && provider.awsSecretAccessKey) {
      config.credentials = { accessKeyId: provider.awsAccessKeyId, secretAccessKey: provider.awsSecretAccessKey };
    } else if (provider.apiKey) {
      config.token = { token: provider.apiKey };
      config.authSchemePreference = ['httpBearerAuth'];
    }
    c = new BedrockRuntimeClient(config);
    bedrockClients.set(key, c);
  }
  return c;
}

const textOf = content => (Array.isArray(content)
  ? content.map(p => (typeof p === 'string' ? p : p?.text || '')).join('')
  : String(content ?? ''));

// Translate an OpenAI-style request to Converse, and the answer back to OpenAI shape,
// so callers don't care which provider type they're using.
async function bedrockChatCompletion(provider, params) {
  const { ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
  const system = [];
  const messages = [];
  for (const m of params.messages || []) {
    const text = textOf(m.content);
    if (m.role === 'system' || m.role === 'developer') {
      if (text) system.push({ text });
      continue;
    }
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const last = messages[messages.length - 1];
    // Converse requires alternating roles — merge consecutive same-role messages
    if (last && last.role === role) last.content[0].text += `\n\n${text}`;
    else messages.push({ role, content: [{ text: text || ' ' }] });
  }

  const inferenceConfig = {};
  const maxTokens = params.max_completion_tokens ?? params.max_tokens;
  if (maxTokens != null) inferenceConfig.maxTokens = maxTokens;
  if (params.temperature != null) inferenceConfig.temperature = params.temperature;

  const res = await bedrockClient(provider).send(new ConverseCommand({
    modelId: params.model || provider.model,
    messages,
    system: system.length ? system : undefined,
    inferenceConfig,
  }));

  // Some models return reasoning blocks before the text — keep only the text
  const content = (res.output?.message?.content || []).map(b => b.text || '').join('');
  return {
    choices: [{
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: res.stopReason === 'max_tokens' ? 'length' : 'stop',
    }],
    usage: res.usage,
  };
}

/**
 * chat.completions.create that works with OpenAI-compatible providers (classic and reasoning
 * models) and AWS Bedrock. Always returns the OpenAI response shape.
 * @param provider  { type?, baseUrl, apiKey, model, region?, awsAccessKeyId?, awsSecretAccessKey? }
 * @param params    standard chat.completions params (model defaults to provider.model)
 * @param options   { client, reasoningEffort } — reasoningEffort is only sent to models that
 *                  turned out to need max_completion_tokens (i.e. reasoning models)
 */
async function chatCompletion(provider, params, { client, reasoningEffort } = {}) {
  if (isBedrock(provider)) return bedrockChatCompletion(provider, params);
  const c = client || createClient(provider);
  const model = params.model || provider.model || 'gpt-4o';
  const key = `${normalizeBaseUrl(provider.baseUrl) || 'openai'}|${model}`;
  const l = learned.get(key) || {};

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await c.chat.completions.create(applyLearned({ ...params, model }, l, reasoningEffort));
    } catch (err) {
      const bad = rejectedParam(err);
      let changed = false;
      if (bad === 'max_tokens' && !l.useMaxCompletionTokens) changed = l.useMaxCompletionTokens = true;
      else if (bad === 'temperature' && !l.dropTemperature) changed = l.dropTemperature = true;
      else if (bad === 'reasoning_effort' && !l.dropReasoningEffort) changed = l.dropReasoningEffort = true;
      if (!changed) throw err;
      learned.set(key, l);
      console.warn(`[LLM] ${model}: provider rejected "${bad}" — adapting and retrying (${JSON.stringify(l)})`);
    }
  }
}

module.exports = { createClient, chatCompletion, normalizeBaseUrl, isUsableProvider };
