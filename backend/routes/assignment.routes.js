// backend/routes/assignment.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const assignmentController = require('../controllers/assignment.controller');

// All routes require authentication
router.use(authMiddleware);

// ============ LECTURER ROUTES ============
// Create assignment
router.post('/', assignmentController.createAssignment);

// Get assignments for lecturer's courses
router.get('/lecturer', assignmentController.getLecturerAssignments);

// Get assignments for a specific course
router.get('/course/:courseCode', assignmentController.getCourseAssignments);

// Update assignment
router.put('/:id', assignmentController.updateAssignment);

// Delete assignment
router.delete('/:id', assignmentController.deleteAssignment);

// ============ STUDENT ROUTES ============
// Get all assignments for student's enrolled courses
router.get('/all', assignmentController.getStudentAssignments);

// Get single assignment by ID
router.get('/:id', assignmentController.getAssignmentById);

module.exports = router;