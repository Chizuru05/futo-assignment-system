const multer = require('multer');
const path = require('path');
const fs = require('fs');

// create uploads folder if it doesn't exist
const createUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // separate folders for assignments and submissions
    const folder = req.baseUrl.includes('submissions')
      ? 'uploads/submissions'
      : 'uploads/assignments';

    createUploadDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    // format: timestamp-originalname (no spaces)
    const safeName = file.originalname.replace(/\s+/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

// File type validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'text/javascript',
    'text/html',
    'text/css',
    'text/x-python',
    'text/x-java-source'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.originalname}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 5                     // max 5 files
  }
});

module.exports = upload;