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

module.exports = router;
