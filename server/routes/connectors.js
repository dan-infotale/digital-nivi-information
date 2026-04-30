const express = require('express');
const Connector = require('../models/Connector');
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
  const item = await Connector.create({ tenantId: req.user.tenantId, name, metaConnectionId, botBackendId, active: active !== false });
  res.status(201).json(item);
});

router.put('/:id', async (req, res) => {
  const { name, metaConnectionId, botBackendId, active } = req.body;
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
