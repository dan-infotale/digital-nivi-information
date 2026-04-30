const express = require('express');
const Conversation = require('../models/Conversation');
const { requireTenantUser } = require('../middleware/auth');

const router = express.Router();
router.use(requireTenantUser);

router.get('/', async (req, res) => {
  const filter = { tenantId: req.user.tenantId };
  if (req.query.connectorId) filter.connectorId = req.query.connectorId;

  const convs = await Conversation.find(filter)
    .sort({ lastActivity: -1 })
    .select('phoneNumber lastActivity messages connectorId createdAt')
    .populate('connectorId', 'name')
    .lean();

  res.json(convs.map(c => ({
    _id: c._id,
    phoneNumber: c.phoneNumber,
    lastActivity: c.lastActivity,
    createdAt: c.createdAt,
    messageCount: c.messages.length,
    lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1].body.substring(0, 100) : '',
    connector: c.connectorId,
  })));
});

router.get('/stats', async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalConversations, todayConversations, msgAgg] = await Promise.all([
    Conversation.countDocuments({ tenantId }),
    Conversation.countDocuments({ tenantId, lastActivity: { $gte: today } }),
    Conversation.aggregate([
      { $match: { tenantId: new (require('mongoose').Types.ObjectId)(tenantId) } },
      { $project: { count: { $size: '$messages' } } },
      { $group: { _id: null, total: { $sum: '$count' } } },
    ]),
  ]);

  res.json({
    totalConversations,
    todayConversations,
    totalMessages: msgAgg[0]?.total || 0,
  });
});

router.get('/:id', async (req, res) => {
  if (!req.params.id.match(/^[a-f\d]{24}$/i)) return res.status(400).json({ error: 'Invalid ID' });
  const conv = await Conversation.findOne({ _id: req.params.id, tenantId: req.user.tenantId })
    .populate('connectorId', 'name')
    .select('-openaiHistory');
  if (!conv) return res.status(404).json({ error: 'Not found' });
  res.json(conv);
});

router.delete('/:id', async (req, res) => {
  await Conversation.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
  res.json({ ok: true });
});

module.exports = router;
