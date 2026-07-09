// backend/middleware/upload.js
const multer = require('multer');
const path = require('path');
const storage = require('../config/upload');

const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/x-zip-compressed',
    'text/plain',
    'text/javascript',
    'text/html',
    'text/css',
    'text/x-python',
    'text/x-java-source',
    'image/jpeg',
    'image/png',
    'image/jpg'
];

const allowedExtensions = ['.pdf', '.doc', '.docx', '.zip', '.txt', '.jpg', '.jpeg', '.png', '.js', '.html', '.css', '.py', '.java'];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.originalname}`), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB per file
        files: 5
    }
});

module.exports = upload;