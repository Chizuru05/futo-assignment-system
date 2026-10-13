// backend/routes/aiGrading.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const aiGradingController = require('../controllers/aiGrading.controller');

// All AI grading routes require authentication
router.use(authMiddleware);

// Grade one submission (saves a draft)
router.post('/submission/:submissionId', aiGradingController.aiGradeSubmission);

// Start a background job for all pending submissions of one assignment
router.post('/assignment/:assignmentId', aiGradingController.aiGradeAllSubmissions);

// Start a background job for all pending submissions in a course
router.post('/course', aiGradingController.aiGradeCoursePending);

// Start a background job for a specific list of submissions (the filtered list)
router.post('/submissions', aiGradingController.aiGradeSelectedSubmissions);

// Check progress of a background job
router.get('/jobs/:jobId', aiGradingController.getGradingJob);

// Get AI grading status
router.get('/status/:submissionId', aiGradingController.getGradingStatus);

module.exports = router;