const express = require('express');
const SystemAdmin = require('../models/SystemAdmin');
const SystemSettings = require('../models/SystemSettings');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const { requireSystemAdmin } = require('../middleware/auth');
const { hashPassword } = require('../services/auth');
const { invalidateOidcCache } = require('../services/oidc');

const router = express.Router();
router.use(requireSystemAdmin);

// ── System Admins ─────────────────────────────────────────────────────────────

router.get('/admins', async (req, res) => {
  const admins = await SystemAdmin.find().select('-hashedPassword').lean();
  res.json(admins);
});

router.post('/admins', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const data = { email, name: name || '' };
  if (password) data.hashedPassword = await hashPassword(password);
  try {
    const admin = await SystemAdmin.create(data);
    res.status(201).json({ _id: admin._id, email: admin.email, name: admin.name });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists' });
    throw err;
  }
});

router.put('/admins/:id', async (req, res) => {
  const { name, password } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (password) update.hashedPassword = await hashPassword(password);
  const admin = await SystemAdmin.findByIdAndUpdate(req.params.id, update, { new: true }).select('-hashedPassword');
  if (!admin) return res.status(404).json({ error: 'Not found' });
  res.json(admin);
});

router.delete('/admins/:id', async (req, res) => {
  if (req.admin.adminId === req.params.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  await SystemAdmin.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── Tenants ───────────────────────────────────────────────────────────────────

function scrubTenant(t) {
  return {
    ...t,
    oidc: t.oidc ? {
      enabled: t.oidc.enabled || false,
      discoveryUrl: t.oidc.discoveryUrl || '',
      clientId: t.oidc.clientId || '',
      clientSecret: t.oidc.clientSecret ? '***' : '',
      label: t.oidc.label || 'SSO',
    } : undefined,
  };
}

router.get('/tenants', async (req, res) => {
  const tenants = await Tenant.find().lean();
  res.json(tenants.map(scrubTenant));
});

router.post('/tenants', async (req, res) => {
  const { name, slug } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });
  try {
    const tenant = await Tenant.create({ name, slug });
    res.status(201).json(tenant);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Slug already exists' });
    throw err;
  }
});

router.put('/tenants/:id', async (req, res) => {
  const { name, slug, oidc } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (slug !== undefined) update.slug = slug;
  if (oidc !== undefined) {
    const existing = await Tenant.findById(req.params.id).lean();
    update.oidc = {
      enabled: !!oidc.enabled,
      discoveryUrl: oidc.discoveryUrl || '',
      clientId: oidc.clientId || '',
      clientSecret: oidc.clientSecret === '***' ? (existing?.oidc?.clientSecret || '') : (oidc.clientSecret || ''),
      label: oidc.label || 'SSO',
    };
    invalidateOidcCache(req.params.id);
  }
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!tenant) return res.status(404).json({ error: 'Not found' });
    res.json(scrubTenant(tenant));
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Slug already exists' });
    throw err;
  }
});

router.delete('/tenants/:id', async (req, res) => {
  await Tenant.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

// ── Tenant users ──────────────────────────────────────────────────────────────

router.get('/tenants/:id/users', async (req, res) => {
  const users = await User.find({ tenantId: req.params.id }).select('-hashedPassword').lean();
  res.json(users);
});

router.post('/tenants/:id/users', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const data = { tenantId: req.params.id, email, name: name || '' };
  if (password) data.hashedPassword = await hashPassword(password);
  try {
    const user = await User.create(data);
    res.status(201).json({ _id: user._id, email: user.email, name: user.name, tenantId: user.tenantId });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email already exists in this tenant' });
    throw err;
  }
});

router.put('/tenants/:tenantId/users/:userId', async (req, res) => {
  const { name, password } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (password) update.hashedPassword = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { _id: req.params.userId, tenantId: req.params.tenantId },
    update,
    { new: true }
  ).select('-hashedPassword');
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

router.delete('/tenants/:tenantId/users/:userId', async (req, res) => {
  await User.findOneAndDelete({ _id: req.params.userId, tenantId: req.params.tenantId });
  res.json({ ok: true });
});

// ── System Settings ───────────────────────────────────────────────────────────

function scrubSettings(s) {
  return {
    embeddingConfig: {
      baseUrl: s?.embeddingConfig?.baseUrl || '',
      apiKey: s?.embeddingConfig?.apiKey ? '***' : '',
      model: s?.embeddingConfig?.model || 'text-embedding-3-small',
    },
    llmProviders: (s?.llmProviders || []).map(p => ({
      _id: p._id,
      name: p.name,
      baseUrl: p.baseUrl || '',
      model: p.model || '',
      apiKey: p.apiKey ? '***' : '',
    })),
  };
}

router.get('/settings', async (req, res) => {
  const s = await SystemSettings.findOne().lean();
  res.json(scrubSettings(s));
});

router.put('/settings', async (req, res) => {
  const { embeddingConfig, llmProviders } = req.body;
  const existing = await SystemSettings.findOne();
  const update = {};

  if (embeddingConfig !== undefined) {
    update.embeddingConfig = {
      baseUrl: embeddingConfig.baseUrl ?? '',
      apiKey: embeddingConfig.apiKey === '***'
        ? (existing?.embeddingConfig?.apiKey || '')
        : (embeddingConfig.apiKey ?? ''),
      model: embeddingConfig.model || 'text-embedding-3-small',
    };
  }

  if (llmProviders !== undefined) {
    update.llmProviders = llmProviders.map(p => {
      if (p.apiKey === '***') {
        const ep = existing?.llmProviders?.find(x => x._id?.toString() === String(p._id));
        return { ...p, apiKey: ep?.apiKey || '' };
      }
      return p;
    });
  }

  const s = await SystemSettings.findOneAndUpdate({}, update, { upsert: true, new: true }).lean();
  res.json(scrubSettings(s));
});

module.exports = router;
