// backend/routes/profile.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const profileController = require('../controllers/profile.controller');
const upload = require('../config/upload');

// All profile routes require authentication
router.use(authMiddleware);

// Profile routes
router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.post('/picture', upload.single('profilePic'), profileController.updateProfilePicture);
router.post('/change-password', profileController.changePassword);

module.exports = router;