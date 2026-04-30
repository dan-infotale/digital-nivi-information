require('dotenv').config({ path: '../.env' });
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const REQUIRED_ENV = ['MONGODB_URI', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[Startup] Missing required env vars: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/meta-connections', require('./routes/meta-connections'));
app.use('/api/bot-backends', require('./routes/bot-backends'));
app.use('/api/connectors', require('./routes/connectors'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/knowledge-bases', require('./routes/knowledge-bases'));
app.use('/api/providers', require('./routes/providers'));
app.use('/webhook', require('./routes/webhook'));

app.get('/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded',
    mongo: states[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));

mongoose.connection.on('error', err => console.error('[MongoDB] Error:', err.message));
mongoose.connection.on('disconnected', () => console.warn('[MongoDB] Disconnected'));
mongoose.connection.on('reconnected', () => console.log('[MongoDB] Reconnected'));

process.on('unhandledRejection', reason => console.error('[Process] Unhandled rejection:', reason));
process.on('uncaughtException', err => { console.error('[Process] Uncaught exception:', err); process.exit(1); });

async function ensureInitialAdmin() {
  const SystemAdmin = require('./models/SystemAdmin');
  const { hashPassword } = require('./services/auth');
  const count = await SystemAdmin.countDocuments();
  if (count === 0 && process.env.INITIAL_ADMIN_EMAIL && process.env.INITIAL_ADMIN_PASSWORD) {
    await SystemAdmin.create({
      email: process.env.INITIAL_ADMIN_EMAIL,
      hashedPassword: await hashPassword(process.env.INITIAL_ADMIN_PASSWORD),
      name: 'Initial Admin',
    });
    console.log(`[Bootstrap] Created initial system admin: ${process.env.INITIAL_ADMIN_EMAIL}`);
  }
}

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('[MongoDB] Connected');
    await ensureInitialAdmin();
    require('./services/autoClose');
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Webhook] URLs: /webhook/<connectorId>`);
    });
  })
  .catch(err => {
    console.error('[MongoDB] Connection failed:', err.message);
    process.exit(1);
  });
