const express = require('express');
const Connector = require('../models/Connector');
const MetaConnection = require('../models/MetaConnection');
const BotBackend = require('../models/BotBackend');
const { requireTenantUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireTenantUser);

router.get('/', async (req, res) => {
  const items = await Connector.find({ tenantId: req.user.tenantId })
    .populate('metaConnectionId', 'name phoneNumberId')
    .populate('botBackendId', 'name type')
    .lean();
  res.json(items);
});

router.post('/', async (req, res) => {
  const { name, metaConnectionId, botBackendId, active } = req.body;
  if (!name || !metaConnectionId || !botBackendId) return res.status(400).json({ error: 'name, metaConnectionId and botBackendId required' });
  const tenantId = req.user.tenantId;
  const [meta, bot] = await Promise.all([
    MetaConnection.findOne({ _id: metaConnectionId, tenantId }),
    BotBackend.findOne({ _id: botBackendId, tenantId }),
  ]);
  if (!meta) return res.status(400).json({ error: 'Invalid META connection' });
  if (!bot) return res.status(400).json({ error: 'Invalid bot backend' });
  const item = await Connector.create({ tenantId, name, metaConnectionId, botBackendId, active: active !== false });
  res.status(201).json(item);
});

router.put('/:id', async (req, res) => {
  const { name, metaConnectionId, botBackendId, active } = req.body;
  const tenantId = req.user.tenantId;
  if (metaConnectionId !== undefined) {
    const meta = await MetaConnection.findOne({ _id: metaConnectionId, tenantId });
    if (!meta) return res.status(400).json({ error: 'Invalid META connection' });
  }
  if (botBackendId !== undefined) {
    const bot = await BotBackend.findOne({ _id: botBackendId, tenantId });
    if (!bot) return res.status(400).json({ error: 'Invalid bot backend' });
  }
  const update = {};
  if (name !== undefined) update.name = name;
  if (metaConnectionId !== undefined) update.metaConnectionId = metaConnectionId;
  if (botBackendId !== undefined) update.botBackendId = botBackendId;
  if (active !== undefined) update.active = active;
  const item = await Connector.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    update,
    { new: true }
  ).populate('metaConnectionId', 'name phoneNumberId').populate('botBackendId', 'name type');
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await Connector.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
  res.json({ ok: true });
});

module.exports = router;
