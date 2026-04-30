const express = require('express');
const BotBackend = require('../models/BotBackend');
const SystemSettings = require('../models/SystemSettings');
const { requireTenantUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireTenantUser);

function scrubSecrets(item) {
  const obj = item.toObject ? item.toObject() : { ...item };
  if (obj.config?.apiKey) obj.config = { ...obj.config, apiKey: '***' };
  return obj;
}

router.get('/', async (req, res) => {
  const items = await BotBackend.find({ tenantId: req.user.tenantId }).lean();
  res.json(items.map(scrubSecrets));
});

router.post('/', async (req, res) => {
  const { name, type, config, knowledgeBaseId } = req.body;
  if (!name || !type || !config) return res.status(400).json({ error: 'name, type and config required' });
  const item = await BotBackend.create({ tenantId: req.user.tenantId, name, type, config, knowledgeBaseId: knowledgeBaseId || null });
  res.status(201).json(scrubSecrets(item));
});

router.put('/:id', async (req, res) => {
  const { name, config, knowledgeBaseId } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (config !== undefined) {
    // Preserve existing apiKey if client sends '***'
    if (config.apiKey === '***') {
      const existing = await BotBackend.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
      if (existing) config.apiKey = existing.config.apiKey;
    }
    update.config = config;
  }
  if (knowledgeBaseId !== undefined) update.knowledgeBaseId = knowledgeBaseId || null;
  const item = await BotBackend.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    update,
    { new: true }
  );
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(scrubSecrets(item));
});

router.delete('/:id', async (req, res) => {
  await BotBackend.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
  res.json({ ok: true });
});

router.post('/:id/test', async (req, res) => {
  const item = await BotBackend.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });

  if (item.type === 'nivi') {
    const NiviAdapter = require('../services/adapters/NiviAdapter');
    try {
      const adapter = new NiviAdapter(item.config);
      const ids = adapter.generateIds();
      await adapter.initialize({ niviUserId: ids.niviUserId, niviSessionId: ids.niviSessionId });
      return res.json({ ok: true, name: 'Session created successfully' });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.detail || err.response?.data?.message || err.message;
      return res.json({ ok: false, error: `${status ? `${status}: ` : ''}${message}` });
    }
  }

  if (item.type === 'custom_agent') {
    const OpenAI = require('openai');
    const settings = await SystemSettings.findOne().lean();
    const provider = settings?.llmProviders?.find(p => p._id.toString() === item.config?.providerId?.toString());
    if (!provider) return res.json({ ok: false, error: 'LLM provider not found' });
    try {
      const client = new OpenAI({ baseURL: provider.baseUrl || undefined, apiKey: provider.apiKey || 'no-key' });
      const response = await client.chat.completions.create({
        model: provider.model || 'gpt-4o',
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      });
      const reply = response.choices[0]?.message?.content || 'ok';
      return res.json({ ok: true, name: `Model responded: "${reply}"` });
    } catch (err) {
      const status = err.status || err.response?.status;
      return res.json({ ok: false, error: `${status ? `${status}: ` : ''}${err.message}` });
    }
  }

  res.json({ ok: false, error: 'Unknown backend type' });
});

module.exports = router;
