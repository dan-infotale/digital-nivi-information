const express = require('express');
const axios = require('axios');
const MetaConnection = require('../models/MetaConnection');
const { requireTenantUser } = require('../middleware/auth');
const { sendMessage } = require('../services/whatsapp');

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

router.post('/:id/test', async (req, res) => {
  const item = await MetaConnection.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  try {
    const phoneEndpoint = item.apiUrl.replace(/\/messages$/, '');
    const { data } = await axios.get(phoneEndpoint, {
      headers: { Authorization: `Bearer ${item.token}` },
      timeout: 8000,
    });
    res.json({ ok: true, name: data.verified_name || data.display_phone_number || data.id });
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    res.json({ ok: false, error: `${status ? `${status}: ` : ''}${message}` });
  }
});

router.post('/:id/send-test', async (req, res) => {
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ ok: false, error: 'to and text are required' });
  const item = await MetaConnection.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  try {
    await sendMessage(item, to, text);
    res.json({ ok: true });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    res.json({ ok: false, error: message });
  }
});

module.exports = router;
