require('dotenv').config({ path: '../.env' });
const path = require('path');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const webhookRoutes = require('./routes/webhook');
const apiRoutes = require('./routes/api');

// Validate required env vars at startup
const REQUIRED_ENV = ['MONGODB_URI', 'WHATSAPP_API_URL', 'WHATSAPP_TOKEN', 'WEBHOOK_VERIFY_TOKEN'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`[Startup] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  const mongoState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: mongoose.connection.readyState === 1 ? 'ok' : 'degraded',
    mongo: mongoState[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
});

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected — will attempt to reconnect');
});
mongoose.connection.on('reconnected', () => {
  console.log('[MongoDB] Reconnected');
});

// Catch unhandled errors so the process doesn't crash silently
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught exception:', err);
  process.exit(1);
});

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[MongoDB] Connected');
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
      console.log(`[Webhook] URL: http://localhost:${PORT}/webhook`);
    });
  })
  .catch(err => {
    console.error('[MongoDB] Connection error:', err.message);
    process.exit(1);
  });
