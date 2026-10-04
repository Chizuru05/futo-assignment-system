// backend/routes/adminProfile.routes.js
const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const storage = require('../config/upload'); // Cloudinary storage; "profile" in the URL sends it to futo-lms/profiles
const controller = require('../controllers/adminProfile.controller');

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const uploadAvatar = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only JPG, PNG or WebP images are allowed'));
    }
});

// Everything here needs a logged-in admin
router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    res.status(403).json({ success: false, message: 'Admin access only' });
});

router.get('/', controller.getProfile);
router.put('/', controller.updateProfile);

router.post('/picture', (req, res, next) => {
    uploadAvatar.single('avatar')(req, res, (err) => {
        if (err) {
            const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5MB or smaller' : err.message;
            return res.status(400).json({ success: false, message });
        }
        next();
    });
}, controller.uploadPicture);

router.delete('/picture', controller.removePicture);
router.put('/password', controller.changePassword);

module.exports = router;