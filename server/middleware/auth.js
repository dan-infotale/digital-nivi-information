const { verifyToken } = require('../services/auth');

function getToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

function requireSystemAdmin(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'system_admin') return res.status(403).json({ error: 'Forbidden' });
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireTenantUser(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyToken(token);
    if (payload.type !== 'tenant_user') return res.status(403).json({ error: 'Forbidden' });
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Allows both system_admin and tenant_user — caller checks req.admin or req.user
function requireAnyAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = verifyToken(token);
    if (payload.type === 'system_admin') req.admin = payload;
    else if (payload.type === 'tenant_user') req.user = payload;
    else return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireSystemAdmin, requireTenantUser, requireAnyAuth };
