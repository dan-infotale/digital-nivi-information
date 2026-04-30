const express = require('express');
const SystemAdmin = require('../models/SystemAdmin');
const User = require('../models/User');
const Tenant = require('../models/Tenant');
const { signToken, hashPassword, comparePassword, getEntraAuthUrl, exchangeEntraCode } = require('../services/auth');
const { getOidcClient, getRedirectUri } = require('../services/oidc');
const { requireSystemAdmin, requireTenantUser } = require('../middleware/auth');

const router = express.Router();

// ── Public tenant list ───────────────────────────────────────────────────────

router.get('/tenants', async (req, res) => {
  const tenants = await Tenant.find({}, '_id name slug oidc').lean();
  res.json(tenants.map(t => ({
    _id: t._id,
    name: t.name,
    slug: t.slug,
    oidc: t.oidc?.enabled ? { enabled: true, label: t.oidc.label || 'SSO' } : undefined,
  })));
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

// ── Generic OIDC ─────────────────────────────────────────────────────────────

router.get('/oidc/login', async (req, res) => {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant?.oidc?.enabled) return res.status(400).json({ error: 'OIDC not enabled for this tenant' });
    const client = await getOidcClient(tenant);
    const state = Buffer.from(JSON.stringify({ tenantId })).toString('base64');
    const url = client.authorizationUrl({ scope: 'openid email profile', redirect_uri: getRedirectUri(), state });
    res.redirect(url);
  } catch (err) {
    console.error('[Auth] OIDC login error:', err.message);
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message)}`);
  }
});

router.get('/oidc/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const { state, error: oidcError } = req.query;
  if (oidcError) return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(oidcError)}`);
  try {
    const { tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());
    const tenant = await Tenant.findById(tenantId);
    if (!tenant?.oidc?.enabled) return res.redirect(`${frontendUrl}/login?error=oidc_not_configured`);

    const client = await getOidcClient(tenant);
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(getRedirectUri(), params, { state });
    const claims = tokenSet.claims();

    const sub = claims.sub;
    const email = (claims.email || '').toLowerCase().trim();
    const name = claims.name || claims.preferred_username || '';

    const orClauses = [];
    if (sub) orClauses.push({ oidcSub: sub });
    if (email) orClauses.push({ email });
    if (!orClauses.length) return res.redirect(`${frontendUrl}/login?error=no_identity`);

    const user = await User.findOne({ tenantId, $or: orClauses });
    if (!user) return res.redirect(`${frontendUrl}/login?error=not_registered`);
    if (!user.oidcSub && sub) { user.oidcSub = sub; await user.save(); }

    const token = signToken({ type: 'tenant_user', userId: user._id, tenantId: user.tenantId, email: user.email, name: user.name || name });
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&type=user`);
  } catch (err) {
    console.error('[Auth] OIDC callback error:', err.message);
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
