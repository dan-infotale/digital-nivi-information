const express = require('express');
const MetaConnection = require('../models/MetaConnection');
const { requireTenantUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireTenantUser);

router.get('/', async (req, res) => {
  const items = await MetaConnection.find({ tenantId: req.user.tenantId })
    .select('-token')
    .lean();
  res.json(items);
});

router.post('/', async (req, res) => {
  const { name, apiUrl, token, phoneNumberId, verifyToken } = req.body;
  if (!name || !apiUrl || !token || !phoneNumberId || !verifyToken) {
    return res.status(400).json({ error: 'All fields required' });
  }
  const item = await MetaConnection.create({ tenantId: req.user.tenantId, name, apiUrl, token, phoneNumberId, verifyToken });
  res.status(201).json({ ...item.toObject(), token: undefined });
});

router.put('/:id', async (req, res) => {
  const { name, apiUrl, token, phoneNumberId, verifyToken } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (apiUrl !== undefined) update.apiUrl = apiUrl;
  if (token !== undefined) update.token = token;
  if (phoneNumberId !== undefined) update.phoneNumberId = phoneNumberId;
  if (verifyToken !== undefined) update.verifyToken = verifyToken;
  const item = await MetaConnection.findOneAndUpdate(
    { _id: req.params.id, tenantId: req.user.tenantId },
    update,
    { new: true }
  ).select('-token');
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.delete('/:id', async (req, res) => {
  await MetaConnection.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
  res.json({ ok: true });
});

module.exports = router;
