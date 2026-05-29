// backend/controllers/studentEnrollment.controller.js
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Settings = require('../models/Settings');

// Helper to get active settings
async function getActiveSettings() {
    const settings = await Settings.getSettings();
    return {
        session: settings.activeSession,
        semester: settings.activeSemester
    };
}

// ============ GET AVAILABLE COURSES FOR STUDENT ============
exports.getAvailableCourses = async (req, res) => {
    try {
        const { level } = req.query;
        const studentId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== GET AVAILABLE COURSES FOR STUDENT ===');
        console.log('Student ID:', studentId);
        console.log('Level:', level);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        // Get courses for the student's level and active semester
        let query = { semester: activeSemester };
        if (level && level !== 'all') {
            query.level = level;
        }
        
        const allCourses = await Course.find(query).sort({ courseCode: 1 });
        
        // Get already enrolled courses for active session/semester
        const enrolled = await Enrollment.find({
            studentId,
            session: activeSession,
            semester: activeSemester
        }).select('courseId');
        
        const enrolledIds = enrolled.map(e => e.courseId.toString());
        
        // Filter out already enrolled courses
        const availableCourses = allCourses.filter(c => !enrolledIds.includes(c._id.toString()));
        
        res.status(200).json({
            success: true,
            count: availableCourses.length,
            courses: availableCourses,
            enrolledCount: enrolledIds.length,
            totalCourses: allCourses.length,
            activeSession,
            activeSemester
        });
        
    } catch (error) {
        console.error('Get available courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ REGISTER COURSES FOR STUDENT ============
exports.registerCourses = async (req, res) => {
    try {
        const { courses } = req.body;
        const studentId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== STUDENT REGISTRATION DEBUG ===');
        console.log('Student ID:', studentId);
        console.log('Courses to register:', courses);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        if (!courses || courses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please select at least one course'
            });
        }
        
        const registrations = [];
        const skipped = [];
        
        for (const courseId of courses) {
            const course = await Course.findById(courseId);
            if (!course) {
                skipped.push({ courseId, reason: 'Course not found' });
                continue;
            }
            
            // Check if course semester matches active semester
            if (course.semester !== activeSemester) {
                skipped.push({ courseId, courseCode: course.courseCode, reason: `Course not available for ${activeSemester} semester` });
                continue;
            }
            
            // Check if already enrolled
            const existing = await Enrollment.findOne({
                studentId,
                courseId,
                session: activeSession,
                semester: activeSemester
            });
            
            if (!existing) {
                const registration = new Enrollment({
                    studentId,
                    courseId,
                    courseCode: course.courseCode,
                    courseTitle: course.courseTitle,
                    level: course.level,
                    session: activeSession,
                    semester: activeSemester,
                    status: 'active'
                });
                await registration.save();
                registrations.push(registration);
                console.log(`✅ Enrolled: ${course.courseCode}`);
            } else {
                skipped.push({ courseId, courseCode: course.courseCode, reason: 'Already enrolled' });
            }
        }
        
        console.log(`Total enrolled: ${registrations.length} courses`);
        
        res.status(201).json({
            success: true,
            message: `Enrolled in ${registrations.length} course(s) successfully`,
            registrations,
            skipped,
            activeSession,
            activeSemester
        });
        
    } catch (error) {
        console.error('Register courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ GET STUDENT'S ENROLLED COURSES ============
exports.getMyCourses = async (req, res) => {
    try {
        const studentId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        const enrollments = await Enrollment.find({
            studentId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).sort({ level: 1, courseCode: 1 });
        
        // Get assignment stats for each course
        const coursesWithStats = await Promise.all(enrollments.map(async (enrollment) => {
            const assignments = await Assignment.find({ course: enrollment.courseCode });
            const totalAssignments = assignments.length;
            
            const submissions = await Submission.find({
                studentId,
                assignmentId: { $in: assignments.map(a => a._id) }
            });
            
            const submittedCount = submissions.length;
            const gradedCount = submissions.filter(s => s.status === 'graded').length;
            
            let progressStatus = 'pending';
            if (submittedCount === totalAssignments && totalAssignments > 0) {
                progressStatus = 'completed';
            } else if (submittedCount > 0) {
                progressStatus = 'in-progress';
            }
            
            return {
                ...enrollment.toObject(),
                totalAssignments,
                submittedCount,
                gradedCount,
                progressStatus
            };
        }));
        
        res.status(200).json({
            success: true,
            count: coursesWithStats.length,
            courses: coursesWithStats,
            activeSession,
            activeSemester
        });
        
    } catch (error) {
        console.error('Get my courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ DROP COURSE (UNREGISTER) ============
exports.dropCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const studentId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== DROP COURSE DEBUG ===');
        console.log('Student ID:', studentId);
        console.log('Course ID:', courseId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        if (!courseId) {
            return res.status(400).json({
                success: false,
                error: 'Course ID is required'
            });
        }
        
        // Find the enrollment
        const enrollment = await Enrollment.findOne({
            studentId: studentId,
            courseId: courseId,
            session: activeSession,
            semester: activeSemester
        });
        
        if (!enrollment) {
            return res.status(404).json({
                success: false,
                error: 'Enrollment not found'
            });
        }
        
        // Check if there are any pending submissions
        const assignments = await Assignment.find({ course: enrollment.courseCode });
        const assignmentIds = assignments.map(a => a._id);
        
        const submissions = await Submission.find({
            studentId,
            assignmentId: { $in: assignmentIds },
            status: 'pending'
        });
        
        if (submissions.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot drop course: ${submissions.length} pending submission(s) need grading`
            });
        }
        
        // Delete the enrollment
        const result = await Enrollment.findOneAndDelete({
            studentId: studentId,
            courseId: courseId,
            session: activeSession,
            semester: activeSemester
        });
        
        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Enrollment not found during deletion'
            });
        }
        
        console.log(`✅ Dropped course: ${result.courseCode}`);
        
        res.json({
            success: true,
            message: `Successfully dropped ${result.courseCode}`,
            course: {
                courseCode: result.courseCode,
                courseTitle: result.courseTitle
            }
        });
        
    } catch (error) {
        console.error('Drop course error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
};