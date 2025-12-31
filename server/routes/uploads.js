const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { auth, bucket } = require('../firebase');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  }
});

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Upload token verification failed:', error);
    res.status(403).json({ error: 'Unauthorized' });
  }
};

router.post('/college-id', verifyToken, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.message === 'Only image uploads are allowed') {
        return res.status(400).json({ error: err.message });
      }
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
      }
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Failed to process upload' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const extension = req.file.originalname.split('.').pop() || 'png';
      const fileName = `college_ids/${req.user.uid}-${Date.now()}-${uuidv4()}.${extension}`;
      const file = bucket.file(fileName);

      await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        resumable: false,
        public: false
      });

      const [downloadURL] = await file.getSignedUrl({
        action: 'read',
        expires: '2100-01-01'
      });

      res.status(201).json({
        filePath: fileName,
        downloadURL
      });
    } catch (error) {
      console.error('Firebase Storage upload failed:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });
});

module.exports = router;
