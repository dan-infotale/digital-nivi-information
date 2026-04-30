const express = require('express');
const SystemAdmin = require('../models/SystemAdmin');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { signToken, hashPassword, comparePassword, getEntraAuthUrl, exchangeEntraCode } = require('../services/auth');
const { requireSystemAdmin, requireTenantUser } = require('../middleware/auth');

const router = express.Router();

// ── Public tenant list ───────────────────────────────────────────────────────

router.get('/tenants', async (req, res) => {
  const tenants = await Tenant.find({}, '_id name slug').lean();
  res.json(tenants);
});

// ── System admin login ───────────────────────────────────────────────────────

router.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const admin = await SystemAdmin.findOne({ email: email.toLowerCase().trim() });
  if (!admin || !admin.hashedPassword) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(password, admin.hashedPassword);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ type: 'system_admin', adminId: admin._id, email: admin.email, name: admin.name });
  res.json({ token, user: { email: admin.email, name: admin.name, type: 'system_admin' } });
});

// ── Tenant user login ────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { email, password, tenantId } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (!tenantId) return res.status(400).json({ error: 'Tenant required' });

  const query = { email: email.toLowerCase().trim(), tenantId };
  const user = await User.findOne(query);
  if (!user || !user.hashedPassword) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(password, user.hashedPassword);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const tenant = await Tenant.findById(user.tenantId).lean();
  const token = signToken({ type: 'tenant_user', userId: user._id, tenantId: user.tenantId, email: user.email, name: user.name });
  res.json({ token, user: { email: user.email, name: user.name, type: 'tenant_user', tenantId: user.tenantId, tenantName: tenant?.name } });
});

// ── Entra ID ─────────────────────────────────────────────────────────────────

router.get('/entra/login', async (req, res) => {
  const loginType = req.query.type === 'admin' ? 'admin' : 'user';
  try {
    const stateObj = { type: loginType };
    if (req.query.tenantId) stateObj.tenantId = req.query.tenantId;
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    const url = await getEntraAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error('[Auth] Entra login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/entra/callback', async (req, res) => {
  const { code, state, error: entraError } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (entraError) {
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(entraError)}`);
  }

  try {
    const { type, tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const { oid, email, name } = await exchangeEntraCode(code);

    let token;
    if (type === 'admin') {
      const admin = await SystemAdmin.findOne({ $or: [{ entraOid: oid }, { email }] });
      if (!admin) return res.redirect(`${frontendUrl}/login?error=not_registered`);
      if (!admin.entraOid) { admin.entraOid = oid; await admin.save(); }
      token = signToken({ type: 'system_admin', adminId: admin._id, email: admin.email, name: admin.name });
    } else {
      const query = tenantId
        ? { tenantId, $or: [{ entraOid: oid }, { email }] }
        : { $or: [{ entraOid: oid }, { email }] };
      const user = await User.findOne(query);
      if (!user) return res.redirect(`${frontendUrl}/login?error=not_registered`);
      if (!user.entraOid) { user.entraOid = oid; await user.save(); }
      token = signToken({ type: 'tenant_user', userId: user._id, tenantId: user.tenantId, email: user.email, name: user.name || name });
    }

    res.redirect(`${frontendUrl}/auth/callback?token=${token}&type=${type}`);
  } catch (err) {
    console.error('[Auth] Entra callback error:', err.message);
    res.redirect(`${frontendUrl}/login?error=auth_failed`);
  }
});

// ── Whoami ───────────────────────────────────────────────────────────────────

router.get('/me/admin', requireSystemAdmin, (req, res) => {
  res.json({ ...req.admin, type: 'system_admin' });
});

router.get('/me', requireTenantUser, async (req, res) => {
  const tenant = await Tenant.findById(req.user.tenantId).lean();
  res.json({ ...req.user, type: 'tenant_user', tenantName: tenant?.name });
});

module.exports = router;
