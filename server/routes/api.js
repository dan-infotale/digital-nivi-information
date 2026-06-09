const express = require('express');
const Conversation = require('../models/Conversation');

const router = express.Router();

// Get all conversations (for dashboard)
router.get('/conversations', async (req, res) => {
  try {
    const conversations = await Conversation.find()
      .sort({ lastActivity: -1 })
      .select('phoneNumber lastActivity messages createdAt')
      .lean();

    const summary = conversations.map(c => ({
      _id: c._id,
      phoneNumber: c.phoneNumber,
      lastActivity: c.lastActivity,
      messageCount: c.messages.length,
      lastMessage: c.messages.length > 0
        ? c.messages[c.messages.length - 1].body.substring(0, 100)
        : '',
      createdAt: c.createdAt,
    }));

    res.json(summary);
  } catch (error) {
    console.error('[API] Get conversations error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get single conversation with all messages
router.get('/conversations/:id', async (req, res) => {
  try {
    if (!req.params.id.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Not found' });
    res.json(conversation);
  } catch (error) {
    console.error('[API] Get conversation error:', error.message);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Stats
router.get('/stats', async (req, res) => {
  try {
    const totalConversations = await Conversation.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayConversations = await Conversation.countDocuments({
      lastActivity: { $gte: today },
    });
    const totalMessages = await Conversation.aggregate([
      { $project: { count: { $size: '$messages' } } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]);

    res.json({
      totalConversations,
      todayConversations,
      totalMessages: totalMessages[0]?.total || 0,
    });
  } catch (error) {
    console.error('[API] Stats error:', error.message);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Check WhatsApp connection by calling the Meta Graph API
router.get('/check-connection', async (req, res) => {
  const axios = require('axios');
  const url = process.env.WHATSAPP_API_URL; // e.g. https://graph.facebook.com/v25.0/{phoneId}/messages
  const token = process.env.WHATSAPP_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ ok: false, error: 'WHATSAPP_API_URL or WHATSAPP_TOKEN not configured' });
  }

  // Derive the phone number ID endpoint from the messages URL
  const phoneEndpoint = url.replace(/\/messages$/, '');

  try {
    const { data } = await axios.get(phoneEndpoint, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 8000,
    });
    res.json({ ok: true, name: data.verified_name || data.display_phone_number || data.id });
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error?.message || err.message;
    res.json({ ok: false, error: `${status ? `${status}: ` : ''}${message}` });
  }
});

module.exports = router;
