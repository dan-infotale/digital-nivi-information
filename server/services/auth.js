const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const msal = require('@azure/msal-node');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = '7d';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

let _msalClient = null;
function getMsalClient() {
  if (!_msalClient && process.env.AZURE_CLIENT_ID) {
    _msalClient = new msal.ConfidentialClientApplication({
      auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
        authority: 'https://login.microsoftonline.com/common',
      },
    });
  }
  return _msalClient;
}

async function getEntraAuthUrl(state) {
  const client = getMsalClient();
  if (!client) throw new Error('Entra ID is not configured (missing AZURE_CLIENT_ID)');
  return client.getAuthCodeUrl({
    scopes: ['openid', 'profile', 'email'],
    redirectUri: process.env.AZURE_REDIRECT_URI,
    state,
  });
}

async function exchangeEntraCode(code) {
  const client = getMsalClient();
  if (!client) throw new Error('Entra ID is not configured');
  const result = await client.acquireTokenByCode({
    code,
    scopes: ['openid', 'profile', 'email'],
    redirectUri: process.env.AZURE_REDIRECT_URI,
  });
  return {
    oid: result.uniqueId,
    email: result.account?.username?.toLowerCase() || '',
    name: result.account?.name || '',
  };
}

module.exports = { signToken, verifyToken, hashPassword, comparePassword, getEntraAuthUrl, exchangeEntraCode };
