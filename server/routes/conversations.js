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
    .select('phoneNumber lastActivity messages connectorId createdAt status')
    .populate('connectorId', 'name')
    .lean();

  res.json(convs.map(c => ({
    _id: c._id,
    phoneNumber: c.phoneNumber,
    lastActivity: c.lastActivity,
    createdAt: c.createdAt,
    messageCount: c.messages.length,
    incomingCount: c.messages.filter(m => m.direction === 'incoming').length,
    outgoingCount: c.messages.filter(m => m.direction === 'outgoing').length,
    lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1].body.substring(0, 100) : '',
    connector: c.connectorId,
    status: c.status || 'active',
  })));
});

router.get('/stats', async (req, res) => {
  const tenantId = req.user.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tenantOid = new (require('mongoose').Types.ObjectId)(tenantId);

  const [totalConversations, todayConversations, msgAgg, durationAgg] = await Promise.all([
    Conversation.countDocuments({ tenantId }),
    Conversation.countDocuments({ tenantId, lastActivity: { $gte: today } }),
    Conversation.aggregate([
      { $match: { tenantId: tenantOid } },
      { $project: {
        incoming: { $size: { $filter: { input: '$messages', as: 'm', cond: { $eq: ['$$m.direction', 'incoming'] } } } },
        outgoing: { $size: { $filter: { input: '$messages', as: 'm', cond: { $eq: ['$$m.direction', 'outgoing'] } } } },
      }},
      { $group: { _id: null, incoming: { $sum: '$incoming' }, outgoing: { $sum: '$outgoing' } } },
    ]),
    Conversation.aggregate([
      { $match: { tenantId: tenantOid, createdAt: { $exists: true } } },
      { $project: { durationMs: { $subtract: ['$lastActivity', '$createdAt'] } } },
      { $group: { _id: null, avgMs: { $avg: '$durationMs' } } },
    ]),
  ]);

  const avgDurationMinutes = durationAgg[0]?.avgMs
    ? Math.round(durationAgg[0].avgMs / 60000)
    : 0;

  res.json({
    totalConversations,
    todayConversations,
    incomingMessages: msgAgg[0]?.incoming || 0,
    outgoingMessages: msgAgg[0]?.outgoing || 0,
    avgDurationMinutes,
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
