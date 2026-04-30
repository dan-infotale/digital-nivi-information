const { Issuer } = require('openid-client');

// Cache discovered clients per tenant; invalidated on config update
const clientCache = new Map();

function getRedirectUri() {
  return process.env.OIDC_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:3001'}/api/auth/oidc/callback`;
}

async function getOidcClient(tenant) {
  const cfg = tenant.oidc;
  if (!cfg?.enabled || !cfg.discoveryUrl || !cfg.clientId) {
    throw new Error('OIDC not configured for this tenant');
  }

  const key = tenant._id.toString();
  if (clientCache.has(key)) return clientCache.get(key);

  const issuer = await Issuer.discover(cfg.discoveryUrl);
  const client = new issuer.Client({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret || undefined,
    redirect_uris: [getRedirectUri()],
    response_types: ['code'],
  });

  clientCache.set(key, client);
  setTimeout(() => clientCache.delete(key), 60 * 60 * 1000); // 1h TTL
  return client;
}

function invalidateOidcCache(tenantId) {
  clientCache.delete(tenantId.toString());
}

module.exports = { getOidcClient, getRedirectUri, invalidateOidcCache };
