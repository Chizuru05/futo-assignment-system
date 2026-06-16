const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const lecturerApplicationController = require('../controllers/lecturerApplication.controller');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/lecturer-apply', lecturerApplicationController.applyLecturer);

// Protected routes
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;