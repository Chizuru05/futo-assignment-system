// backend/routes/studentOnboarding.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/studentOnboarding.controller');

// Only logged-in admins can onboard students
router.use(authMiddleware, requireRole(['admin']));

router.get('/students', ctrl.listStudents);
router.post('/students', ctrl.addStudent);
router.post('/students/bulk', ctrl.bulkAddStudents);

module.exports = router;