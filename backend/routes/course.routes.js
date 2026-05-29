// backend/routes/course.routes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const courseController = require('../controllers/course.controller');
const lecturerCourseController = require('../controllers/lecturerCourse.controller');
const studentEnrollmentController = require('../controllers/studentEnrollment.controller');

// All routes require authentication
router.use(authMiddleware);

// ============ COURSE MANAGEMENT ============
router.get('/courses/level', courseController.getCoursesByLevel);
router.get('/courses/all', courseController.getAllCourses);
router.post('/courses', courseController.createCourse);
router.post('/courses/bulk', courseController.bulkCreateCourses);
router.get('/courses/:id', courseController.getCourseById);
router.put('/courses/:id', courseController.updateCourse);
router.delete('/courses/:id', courseController.deleteCourse);

// ============ LECTURER COURSE REGISTRATION ============
router.get('/lecturer/courses/available', lecturerCourseController.getAvailableCourses);
router.post('/lecturer/courses/register', lecturerCourseController.registerCourses);
router.get('/lecturer/my-courses', lecturerCourseController.getMyCourses);
router.get('/lecturer/courses/:courseId', lecturerCourseController.getCourseDetails);
router.put('/lecturer/courses/:courseId/status', lecturerCourseController.updateCourseStatus);

// ============ LECTURER UNREGISTER FROM COURSE (DELETE) ============
router.delete('/lecturer/unregister-course', lecturerCourseController.unregisterCourse);
router.delete('/lecturer/unregister-courses/bulk', lecturerCourseController.bulkUnregisterCourses);

// ============ LECTURER STUDENT MANAGEMENT ============
router.get('/lecturer/students', lecturerCourseController.getMyStudents);
router.get('/lecturer/student/:studentId', lecturerCourseController.getStudentDetails);

// ============ STUDENT COURSE REGISTRATION ============
router.get('/student/courses/available', studentEnrollmentController.getAvailableCourses);
router.post('/student/courses/register', studentEnrollmentController.registerCourses);
router.get('/student/my-courses', studentEnrollmentController.getMyCourses);
router.delete('/student/drop-course', studentEnrollmentController.dropCourse);

module.exports = router;