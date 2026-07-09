// backend/routes/submission.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const upload = require('../config/upload');
const submissionController = require('../controllers/submission.controller');

// All routes require authentication
router.use(authMiddleware);

// ============ GET ROUTES (no params) FIRST ============

// Student: Get my submissions (filtered by session/semester)
router.get('/my-submissions', submissionController.getMySubmissions);

// Get pending count for lecturer badge
router.get('/pending-count', submissionController.getPendingCount);
// Add this line after line 18 (before parameter routes)
router.get('/all', submissionController.getAllSubmissionsForLecturer);

// Get all submissions for lecturer (with query params)
router.get('/lecturer/all', submissionController.getAllSubmissionsForLecturer);

// ============ ROUTES WITH PARAMETERS ============

// Lecturer: Get submissions for a specific assignment
router.get('/assignment/:assignmentId', submissionController.getAssignmentSubmissions);

// Download submission file
router.get('/:submissionId/download/:fileIndex', submissionController.downloadFile);

// Get single submission by ID
router.get('/:id', submissionController.getSubmissionById);


// ============ POST/PUT ROUTES ============

// Student: Submit assignment
router.post('/', upload.array('files', 5), submissionController.submitAssignment);

// Lecturer: Grade a submission
router.put('/:submissionId/grade', submissionController.gradeSubmission);
// submission.routes.js — add near the grade route
router.post('/:submissionId/notify', submissionController.resendNotification);

module.exports = router;