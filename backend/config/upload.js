// backend/config/upload.js
const path = require('path');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinary');

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: (req, file) => {
        let folder = 'futo-lms/general';

        if (req.baseUrl && req.baseUrl.includes('submissions')) {
            folder = 'futo-lms/submissions';
        } else if (req.baseUrl && req.baseUrl.includes('assignments')) {
            folder = 'futo-lms/assignments';
        } else if (req.baseUrl && req.baseUrl.includes('profile')) {
            folder = 'futo-lms/profiles';
        }

        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);

        return {
            folder: folder,
            resource_type: 'auto',
            public_id: `${name}-${uniqueSuffix}`,
            format: ext.replace('.', '') || undefined
        };
    }
});

module.exports = storage;