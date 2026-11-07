// Shared LLM access for all OpenAI-compatible providers.
//
// Classic models (gpt-4o, Llama, etc.) accept `max_tokens` and any `temperature`.
// Newer reasoning models (GPT-5 family, o-series — e.g. on Azure AI Foundry) reject both:
// they need `max_completion_tokens` and only allow the default temperature.
// We send the classic form first; if the provider rejects a parameter, we adapt, retry,
// and remember the adaptation per provider+model so later calls go right the first time.

const OpenAI = require('openai');

// `${baseUrl}|${model}` → { useMaxCompletionTokens, dropTemperature, effortIdx, dropReasoningEffort }
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
  // Always ask for the lowest reasoning the model accepts (faster replies). Models differ in
  // which values they accept, so we fall through the list as values get rejected; models
  // without reasoning reject the parameter entirely and we stop sending it.
  const effort = effortCandidates(reasoningEffort)[l.effortIdx || 0];
  if (effort && !l.dropReasoningEffort) p.reasoning_effort = effort;
  return p;
}

// Lowest first: 'none' (GPT-5.1+), 'minimal' (GPT-5), 'low' (o-series, gpt-oss, most others)
const LOWEST_REASONING = ['none', 'minimal', 'low'];
const effortCandidates = e => (Array.isArray(e) ? e : e ? [e] : []);

// Which parameter did the provider reject? Returns 'max_tokens' | 'temperature' | 'reasoning_effort' | null
// The parameter itself isn't recognised (vs. just this value being invalid)
function paramUnknown(err) {
  const msg = `${err.message || ''} ${err.error?.message || ''}`.toLowerCase();
  if (/value/.test(msg)) return false;
  return /unrecognized|unsupported parameter|unknown (parameter|field|argument)|extra inputs|not permitted|not allowed/.test(msg);
}

function rejectedParam(err) {
  const status = err.status || err.response?.status;
  if (status !== 400 && status !== 422) return null;
  const param = err.param || err.error?.param;
  const msg = `${err.message || ''} ${err.error?.message || ''}`.toLowerCase();
  for (const name of ['reasoning_effort', 'max_tokens', 'temperature']) {
    if (param === name) return name;
  }
  if (/unsupported|not supported|does not support|unrecognized|unknown|invalid|not allowed|not permitted|extra inputs/.test(msg)) {
    if (msg.includes('reasoning_effort') || msg.includes('reasoning effort')) return 'reasoning_effort';
    if (msg.includes("'max_tokens'") || msg.includes('max_completion_tokens')) return 'max_tokens';
    if (msg.includes('temperature')) return 'temperature';
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
 * @param options   { client, reasoningEffort } — reasoningEffort defaults to the lowest the model
 *                  accepts; models without reasoning stop receiving it after one rejection
 */
async function chatCompletion(provider, params, { client, reasoningEffort = LOWEST_REASONING } = {}) {
  if (isBedrock(provider)) return bedrockChatCompletion(provider, params);
  const c = client || createClient(provider);
  const model = params.model || provider.model || 'gpt-4o';
  const key = `${normalizeBaseUrl(provider.baseUrl) || 'openai'}|${model}`;
  const l = learned.get(key) || {};

  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await c.chat.completions.create(applyLearned({ ...params, model }, l, reasoningEffort));
    } catch (err) {
      const bad = rejectedParam(err);
      let changed = false;
      if (bad === 'max_tokens' && !l.useMaxCompletionTokens) changed = l.useMaxCompletionTokens = true;
      else if (bad === 'temperature' && !l.dropTemperature) changed = l.dropTemperature = true;
      else if (bad === 'reasoning_effort' && !l.dropReasoningEffort) {
        // Model has no reasoning at all → stop sending it. Otherwise only this value was
        // rejected → try the next one; give up on the parameter when the list runs out.
        l.effortIdx = (l.effortIdx || 0) + 1;
        if (paramUnknown(err) || l.effortIdx >= effortCandidates(reasoningEffort).length) l.dropReasoningEffort = true;
        changed = true;
      }
      if (!changed) throw err;
      learned.set(key, l);
      console.warn(`[LLM] ${model}: provider rejected "${bad}" — adapting and retrying (${JSON.stringify(l)})`);
    }
  }
}

module.exports = { createClient, chatCompletion, normalizeBaseUrl, isUsableProvider };
