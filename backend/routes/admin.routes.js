const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');
const lecturerApplicationController = require('../controllers/lecturerApplication.controller');

// All admin routes require authentication
router.use(authMiddleware);

// Admin only - check role
router.use((req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    next();
});

// ============ USER MANAGEMENT ============
router.get('/users/all', adminController.getAllUsers);
router.get('/users/role/:role', adminController.getUsersByRole);
router.get('/users/:id', adminController.getUserById);
router.delete('/users/:id', adminController.deleteUser);

// ============ LECTURER COURSES (FOR ADMIN) ============
router.get('/lecturer/:lecturerId/courses', adminController.getLecturerCourses);

// ============ STUDENT MANAGEMENT ============
router.get('/students/grouped', adminController.getStudentsGrouped);

// ============ COURSE MANAGEMENT ============
router.get('/courses/all', adminController.getAllCourses);
router.get('/courses/:id', adminController.getCourseById);
router.post('/courses', adminController.createCourse);
router.put('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);

// ============ STATISTICS ============
router.get('/stats', adminController.getStats);

// ============ LECTURER APPLICATIONS ============
// Get ALL applications (pending + approved + rejected)
router.get('/pending-applications', lecturerApplicationController.getPendingApplications);
// Approve lecturer
router.put('/approve-lecturer/:id', lecturerApplicationController.approveLecturer);
// Reject lecturer
router.put('/reject-lecturer/:id', lecturerApplicationController.rejectLecturer);
// Create admin
router.post('/create-admin', lecturerApplicationController.createAdmin);

module.exports = router;