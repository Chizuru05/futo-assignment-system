// backend/config/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const createDirectory = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = 'uploads/';
        
        // Determine folder based on route
        if (req.baseUrl && req.baseUrl.includes('submissions')) {
            uploadPath += 'submissions/';
        } else if (req.baseUrl && req.baseUrl.includes('assignments')) {
            uploadPath += 'assignments/';
        } else if (req.baseUrl && req.baseUrl.includes('profile')) {
            uploadPath += 'profiles/';
        } else {
            uploadPath += 'general/';
        }
        
        createDirectory(uploadPath);
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp-randomnumber-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        // Remove special characters from filename
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, cleanName + '-' + uniqueSuffix + ext);
    }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/x-zip-compressed',
        'text/plain',
        'image/jpeg',
        'image/png',
        'image/jpg'
    ];
    
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.zip', '.txt', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, ZIP, TXT, JPG, PNG'), false);
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: fileFilter
});

module.exports = upload;