// backend/routes/aiGrading.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const aiGradingController = require('../controllers/aiGrading.controller');

// All AI grading routes require authentication
router.use(authMiddleware);

// AI Grade a submission
router.post('/submission/:submissionId', aiGradingController.aiGradeSubmission);

// AI Grade all pending submissions for an assignment
router.post('/assignment/:assignmentId', aiGradingController.aiGradeAllSubmissions);

// Get AI grading status
router.get('/status/:submissionId', aiGradingController.getGradingStatus);

module.exports = router;