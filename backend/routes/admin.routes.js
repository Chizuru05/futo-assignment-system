const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');
const lecturerApplicationController = require('../controllers/lecturerApplication.controller');

router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    next();
});

// User Management
router.get('/users/all', adminController.getAllUsers);
router.get('/users/role/:role', adminController.getUsersByRole);
router.get('/users/:id', adminController.getUserById);
router.delete('/users/:id', adminController.deleteUser);

// Lecturer Courses
router.get('/lecturer/:lecturerId/courses', adminController.getLecturerCourses);

// Student Management
router.get('/students/grouped', adminController.getStudentsGrouped);

// Course Management
router.get('/courses/all', adminController.getAllCourses);
router.get('/courses/:id', adminController.getCourseById);
router.post('/courses', adminController.createCourse);
router.put('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);

// Statistics
router.get('/stats', adminController.getStats);

// Lecturer Applications
router.get('/pending-applications', lecturerApplicationController.getPendingApplications);
router.put('/approve-lecturer/:id', lecturerApplicationController.approveLecturer);
router.put('/reject-lecturer/:id', lecturerApplicationController.rejectLecturer);
router.post('/create-admin', lecturerApplicationController.createAdmin);

module.exports = router;