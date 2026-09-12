const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { designs } = require('../data/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
      return cb(new Error('Unsupported file type. Allowed: PNG, JPG, WEBP, SVG'));
    }
    cb(null, true);
  }
});

router.post('/', requireAuth, (req, res) => {
  upload.single('design')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const design = {
      id: uuidv4(),
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      isPublic: req.body.isPublic === 'true',
      createdAt: new Date().toISOString()
    };
    designs.push(design);
    res.status(201).json({ ...design, url: `/uploads/${design.filename}` });
  });
});

router.get('/mine', requireAuth, (req, res) => {
  const mine = designs.filter(d => d.userId === req.user.id)
    .map(d => ({ ...d, url: `/uploads/${d.filename}` }));
  res.json(mine);
});

router.get('/gallery', (req, res) => {
  const pub = designs.filter(d => d.isPublic)
    .map(d => ({ id: d.id, url: `/uploads/${d.filename}`, createdAt: d.createdAt }));
  res.json(pub);
});

module.exports = router;
