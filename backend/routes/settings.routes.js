// backend/routes/settings.routes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settings.controller');
const { authMiddleware } = require('../middleware/auth');

// Get settings (any authenticated user)
router.get('/', authMiddleware, settingsController.getSettings);

// Update settings (admin only)
router.put('/', authMiddleware, settingsController.updateSettings);

module.exports = router;