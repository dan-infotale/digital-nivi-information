const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const KnowledgeBase = require('../models/KnowledgeBase');
const SystemSettings = require('../models/SystemSettings');
const { requireTenantUser } = require('../middleware/auth');
const { chunkText, embedTexts } = require('../services/rag');

const router = express.Router();
router.use(requireTenantUser);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  const items = await KnowledgeBase.aggregate([
    { $match: { tenantId: new mongoose.Types.ObjectId(req.user.tenantId) } },
    { $project: {
      name: 1, createdAt: 1,
      documentCount: { $size: { $ifNull: ['$documents', []] } },
      documents: {
        $map: {
          input: { $ifNull: ['$documents', []] },
          as: 'd',
          in: {
            _id: '$$d._id',
            filename: '$$d.filename',
            uploadedAt: '$$d.uploadedAt',
            chunkCount: { $size: { $ifNull: ['$$d.chunks', []] } },
          },
        },
      },
    }},
  ]);
  res.json(items);
});

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const kb = await KnowledgeBase.create({ tenantId: req.user.tenantId, name });
  res.status(201).json(kb);
});

router.put('/:id', async (req, res) => {
  const { name } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  const kb = await KnowledgeBase.findOneAndUpdate({ _id: req.params.id, tenantId: req.user.tenantId }, update, { new: true });
  if (!kb) return res.status(404).json({ error: 'Not found' });
  res.json(kb);
});

router.delete('/:id', async (req, res) => {
  await KnowledgeBase.findOneAndDelete({ _id: req.params.id, tenantId: req.user.tenantId });
  res.json({ ok: true });
});

// ── Document upload ───────────────────────────────────────────────────────────

router.post('/:id/documents', upload.single('file'), async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!kb) return res.status(404).json({ error: 'Not found' });
  if (!req.file) return res.status(400).json({ error: 'File required' });

  let text = '';
  const mime = req.file.mimetype;

  if (mime === 'application/pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(req.file.buffer);
    text = data.text;
  } else {
    text = req.file.buffer.toString('utf-8');
  }

  const chunks = chunkText(text);
  let chunkDocs = chunks.map(c => ({ text: c, embedding: [], metadata: { source: req.file.originalname } }));

  const settings = await SystemSettings.findOne().lean();
  const embCfg = settings?.embeddingConfig;
  if (embCfg?.baseUrl && embCfg?.model) {
    try {
      const embeddings = await embedTexts(chunks, embCfg);
      chunkDocs = chunkDocs.map((c, i) => ({ ...c, embedding: embeddings[i] || [] }));
    } catch (err) {
      console.warn('[KB] Embedding failed, storing chunks without embeddings:', err.message);
    }
  }

  kb.documents.push({ filename: req.file.originalname, chunks: chunkDocs });
  await kb.save();

  res.status(201).json({ ok: true, filename: req.file.originalname, chunks: chunkDocs.length });
});

router.delete('/:id/documents/:docId', async (req, res) => {
  const kb = await KnowledgeBase.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
  if (!kb) return res.status(404).json({ error: 'Not found' });
  kb.documents = kb.documents.filter(d => d._id.toString() !== req.params.docId);
  await kb.save();
  res.json({ ok: true });
});

module.exports = router;
