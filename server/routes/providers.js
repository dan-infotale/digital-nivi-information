const express = require('express');
const SystemSettings = require('../models/SystemSettings');
const { requireAnyAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAnyAuth);

router.get('/', async (req, res) => {
  const s = await SystemSettings.findOne().lean();
  res.json((s?.llmProviders || []).map(p => ({ _id: p._id, name: p.name, model: p.model })));
});

module.exports = router;
