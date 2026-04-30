const express = require('express');
const BotBackend = require('../models/BotBackend');
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

module.exports = router;
