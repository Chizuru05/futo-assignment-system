// backend/controllers/lecturerCourse.controller.js
const LecturerCourse = require('../models/LecturerCourse');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const User = require('../models/User');
const Settings = require('../models/Settings');

// Helper to get active settings
async function getActiveSettings() {
    const settings = await Settings.getSettings();
    return {
        session: settings.activeSession,
        semester: settings.activeSemester
    };
}

// ============ LECTURER COURSE REGISTRATION ============

// Lecturer: Register courses they will teach
exports.registerCourses = async (req, res) => {
    try {
        const { courses } = req.body;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== LECTURER REGISTRATION DEBUG ===');
        console.log('Lecturer ID:', lecturerId);
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
            console.log(`Processing courseId: ${courseId}`);
            
            const course = await Course.findById(courseId);
            if (!course) {
                console.log(`❌ Course ${courseId} not found in database`);
                skipped.push({ courseId, reason: 'Course not found' });
                continue;
            }
            
            // Check if course semester matches active semester
            if (course.semester !== activeSemester && course.semester !== 'Both') {
                skipped.push({ courseId, courseCode: course.courseCode, reason: `Course not available for ${activeSemester} semester` });
                continue;
            }
            
            console.log(`✅ Found course: ${course.courseCode} (${course.courseTitle})`);
            
            // Check if already registered for this session/semester
            const existing = await LecturerCourse.findOne({
                lecturerId,
                courseId,
                session: activeSession,
                semester: activeSemester
            });
            
            if (!existing) {
                const registration = new LecturerCourse({
                    lecturerId,
                    courseId,
                    courseCode: course.courseCode,
                    courseTitle: course.courseTitle,
                    level: course.level,
                    credits: course.credits || 3,
                    session: activeSession,
                    semester: activeSemester,
                    status: 'active'
                });
                await registration.save();
                registrations.push(registration);
                console.log(`✅ Registered: ${course.courseCode}`);
            } else {
                console.log(`⚠️ Already registered: ${course.courseCode}`);
                skipped.push({ courseId, courseCode: course.courseCode, reason: 'Already registered' });
            }
        }
        
        console.log(`Total registered: ${registrations.length} courses`);
        
        res.status(201).json({
            success: true,
            message: `Registered ${registrations.length} course(s) successfully`,
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

// ============ UNREGISTER / DELETE COURSE ============

// Lecturer: Unregister from a course (DELETE)
exports.unregisterCourse = async (req, res) => {
    try {
        const { courseId } = req.body;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== UNREGISTER COURSE DEBUG ===');
        console.log('Lecturer ID:', lecturerId);
        console.log('Course ID:', courseId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        if (!courseId) {
            return res.status(400).json({
                success: false,
                error: 'Course ID is required'
            });
        }
        
        // Find the course registration
        const lecturerCourse = await LecturerCourse.findOne({
            lecturerId: lecturerId,
            courseId: courseId,
            session: activeSession,
            semester: activeSemester
        });
        
        if (!lecturerCourse) {
            return res.status(404).json({
                success: false,
                error: 'Course registration not found'
            });
        }
        
        // Check if there are any pending submissions or active assignments
        const activeAssignments = await Assignment.countDocuments({
            course: lecturerCourse.courseCode,
            dueDateISO: { $gte: new Date() }
        });
        
        const assignmentIds = await Assignment.find({ course: lecturerCourse.courseCode }).distinct('_id');
        const pendingSubmissions = await Submission.countDocuments({
            assignmentId: { $in: assignmentIds },
            status: 'pending'
        });
        
        let warning = '';
        if (activeAssignments > 0) {
            warning = `Warning: ${activeAssignments} active assignment(s) will be orphaned. `;
        }
        if (pendingSubmissions > 0) {
            warning += `${pendingSubmissions} pending submission(s) will need reassignment.`;
        }
        
        // Delete the registration
        const result = await LecturerCourse.findOneAndDelete({
            lecturerId: lecturerId,
            courseId: courseId,
            session: activeSession,
            semester: activeSemester
        });
        
        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Course registration not found during deletion'
            });
        }
        
        console.log(`✅ Unregistered from course: ${result.courseCode}`);
        
        res.json({
            success: true,
            message: `Successfully unregistered from ${result.courseCode}`,
            warning: warning || null,
            course: {
                courseCode: result.courseCode,
                courseTitle: result.courseTitle
            }
        });
        
    } catch (error) {
        console.error('Unregister course error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
};

// Lecturer: Unregister from multiple courses (bulk delete)
exports.bulkUnregisterCourses = async (req, res) => {
    try {
        const { courses } = req.body;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        if (!courses || courses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No courses selected for unregistration'
            });
        }
        
        const results = {
            successful: [],
            failed: []
        };
        
        for (const courseId of courses) {
            try {
                const result = await LecturerCourse.findOneAndDelete({
                    lecturerId: lecturerId,
                    courseId: courseId,
                    session: activeSession,
                    semester: activeSemester
                });
                
                if (result) {
                    results.successful.push({
                        courseId: courseId,
                        courseCode: result.courseCode
                    });
                } else {
                    results.failed.push({
                        courseId: courseId,
                        reason: 'Registration not found'
                    });
                }
            } catch (err) {
                results.failed.push({
                    courseId: courseId,
                    reason: err.message
                });
            }
        }
        
        res.json({
            success: true,
            message: `Unregistered from ${results.successful.length} course(s)`,
            results
        });
        
    } catch (error) {
        console.error('Bulk unregister error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
};

// ============ GET LECTURER COURSES ============

// Lecturer: Get my registered courses for current semester
exports.getMyCourses = async (req, res) => {
    try {
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== GET MY COURSES ===');
        console.log('Lecturer ID:', lecturerId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        let query = { 
            lecturerId, 
            status: 'active',
            session: activeSession,
            semester: activeSemester
        };
        
        const courses = await LecturerCourse.find(query).sort({ level: 1, courseCode: 1 });
        
        console.log(`Found ${courses.length} courses`);
        
        // Get student count and assignment stats for each course
        const coursesWithStats = await Promise.all(courses.map(async (course) => {
            const studentCount = await Enrollment.countDocuments({
                courseId: course.courseId,
                session: activeSession,
                semester: activeSemester,
                status: 'active'
            });
            
            const assignments = await Assignment.find({ course: course.courseCode });
            const assignmentCount = assignments.length;
            
            const pendingSubmissions = await Submission.countDocuments({
                assignmentId: { $in: assignments.map(a => a._id) },
                status: 'pending'
            });
            
            return {
                ...course.toObject(),
                studentCount,
                assignmentCount,
                pendingSubmissions
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

// Lecturer: Get available courses to register
exports.getAvailableCourses = async (req, res) => {
    try {
        const { level } = req.query;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== GET AVAILABLE COURSES FOR LECTURER ===');
        console.log('Lecturer ID:', lecturerId);
        console.log('Level:', level);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        // Get all courses for the specified level and active semester
        let query = { semester: activeSemester };
        if (level && level !== 'all') {
            query.level = level;
        }
        
        const allCourses = await Course.find(query).sort({ courseCode: 1 });
        
        // Get already registered courses for active session/semester
        const registered = await LecturerCourse.find({
            lecturerId,
            session: activeSession,
            semester: activeSemester
        }).select('courseId');
        
        const registeredIds = registered.map(r => r.courseId.toString());
        
        // Filter out already registered courses
        const availableCourses = allCourses.filter(c => !registeredIds.includes(c._id.toString()));
        
        res.status(200).json({
            success: true,
            count: availableCourses.length,
            courses: availableCourses,
            registeredCount: registeredIds.length,
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

// Lecturer: Get single course details with full stats
exports.getCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.params;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        // Verify lecturer teaches this course
        const lecturerCourse = await LecturerCourse.findOne({
            lecturerId,
            courseId,
            session: activeSession,
            semester: activeSemester
        });
        
        if (!lecturerCourse) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this course'
            });
        }
        
        // Get course details
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        
        // Get enrolled students
        const students = await Enrollment.find({
            courseId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).populate('studentId', 'fullName email matricNumber level');
        
        // Get assignments for this course
        const assignments = await Assignment.find({ course: course.courseCode })
            .sort({ createdAt: -1 });
        
        // Get submission stats
        const assignmentIds = assignments.map(a => a._id);
        const submissions = await Submission.find({
            assignmentId: { $in: assignmentIds }
        });
        
        const stats = {
            totalStudents: students.length,
            totalAssignments: assignments.length,
            totalSubmissions: submissions.length,
            pendingGrading: submissions.filter(s => s.status === 'pending').length,
            graded: submissions.filter(s => s.status === 'graded').length
        };
        
        res.status(200).json({
            success: true,
            course: {
                ...course.toObject(),
                lecturerCourse: lecturerCourse.toObject()
            },
            students: students.map(s => s.studentId),
            assignments,
            stats,
            activeSession,
            activeSemester
        });
        
    } catch (error) {
        console.error('Get course details error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// Lecturer: Update course status (active/completed/archived)
exports.updateCourseStatus = async (req, res) => {
    try {
        const { courseId } = req.params;
        const { status } = req.body;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        const validStatuses = ['active', 'completed', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be: active, completed, or archived'
            });
        }
        
        const lecturerCourse = await LecturerCourse.findOneAndUpdate(
            {
                lecturerId,
                courseId,
                session: activeSession,
                semester: activeSemester
            },
            { status },
            { new: true }
        );
        
        if (!lecturerCourse) {
            return res.status(404).json({
                success: false,
                message: 'Course registration not found'
            });
        }
        
        res.status(200).json({
            success: true,
            message: `Course status updated to ${status}`,
            course: lecturerCourse
        });
        
    } catch (error) {
        console.error('Update course status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ GET STUDENTS FOR LECTURER'S COURSES ============

// Get all students enrolled in lecturer's courses
exports.getMyStudents = async (req, res) => {
    try {
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        console.log('=== GET MY STUDENTS DEBUG ===');
        console.log('Lecturer ID:', lecturerId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        // Get all courses taught by this lecturer
        const lecturerCourses = await LecturerCourse.find({
            lecturerId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        });
        
        if (!lecturerCourses.length) {
            return res.status(200).json({
                success: true,
                students: [],
                message: 'No courses found for this lecturer'
            });
        }
        
        const courseIds = lecturerCourses.map(c => c.courseId);
        const courseCodes = lecturerCourses.map(c => c.courseCode);
        
        console.log('Teaching courses:', courseCodes);
        
        // Get all enrollments for these courses
        const enrollments = await Enrollment.find({
            courseId: { $in: courseIds },
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).populate('studentId', 'fullName email matricNumber level');
        
        if (!enrollments.length) {
            return res.status(200).json({
                success: true,
                students: [],
                message: 'No students enrolled in your courses'
            });
        }
        
        // Get all assignments for these courses
        const assignments = await Assignment.find({
            course: { $in: courseCodes }
        });
        
        // Get all submissions for these courses
        const submissions = await Submission.find({
            assignmentId: { $in: assignments.map(a => a._id) }
        });
        
        // Build student data (one row per enrollment)
        const students = [];
        
        for (const enrollment of enrollments) {
            const student = enrollment.studentId;
            if (!student) continue;
            
            const course = lecturerCourses.find(c => c.courseId.toString() === enrollment.courseId.toString());
            if (!course) continue;
            
            // Get course-specific assignments
            const courseAssignments = assignments.filter(a => a.course === course.courseCode);
            const courseAssignmentIds = courseAssignments.map(a => a._id);
            
            // Get student's submissions for this course
            const studentSubmissions = submissions.filter(s => 
                s.studentId.toString() === student._id.toString() && 
                courseAssignmentIds.includes(s.assignmentId.toString())
            );
            
            const submittedCount = studentSubmissions.length;
            const totalAssignments = courseAssignments.length;
            const pendingCount = studentSubmissions.filter(s => s.status === 'pending').length;
            
            let studentStatus = 'pending';
            if (submittedCount === totalAssignments && totalAssignments > 0) {
                studentStatus = 'completed';
            } else if (submittedCount > 0) {
                studentStatus = 'in-progress';
            }
            
            students.push({
                userId: student._id,
                name: student.fullName,
                email: student.email,
                matricNumber: student.matricNumber,
                level: student.level || '500',
                courseCode: course.courseCode,
                courseTitle: course.courseTitle,
                totalAssignments: totalAssignments,
                submittedCount: submittedCount,
                pendingSubmissions: pendingCount,
                status: studentStatus
            });
        }
        
        console.log(`Found ${students.length} student enrollments across ${courseCodes.length} courses`);
        
        res.status(200).json({
            success: true,
            count: students.length,
            students: students,
            courses: lecturerCourses.map(c => ({
                courseCode: c.courseCode,
                courseTitle: c.courseTitle,
                studentCount: enrollments.filter(e => e.courseId.toString() === c.courseId.toString()).length
            }))
        });
        
    } catch (error) {
        console.error('Get my students error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// Get specific student details with all courses
exports.getStudentDetails = async (req, res) => {
    try {
        const { studentId } = req.params;
        const lecturerId = req.user.id;
        
        // Get active settings from database
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;
        
        // Get lecturer's courses
        const lecturerCourses = await LecturerCourse.find({
            lecturerId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        });
        
        const courseIds = lecturerCourses.map(c => c.courseId);
        const courseCodes = lecturerCourses.map(c => c.courseCode);
        
        // Check if student is enrolled in any of lecturer's courses
        const enrollments = await Enrollment.find({
            studentId,
            courseId: { $in: courseIds },
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).populate('studentId', 'fullName email matricNumber level');
        
        if (!enrollments.length) {
            return res.status(404).json({
                success: false,
                message: 'Student not found in your courses'
            });
        }
        
        const student = enrollments[0].studentId;
        
        // Get all assignments for lecturer's courses
        const assignments = await Assignment.find({
            course: { $in: courseCodes }
        });
        
        // Get student's submissions
        const submissions = await Submission.find({
            studentId,
            assignmentId: { $in: assignments.map(a => a._id) }
        });
        
        // Build course progress
        const coursesProgress = [];
        let totalAssignments = 0;
        let totalSubmitted = 0;
        let totalPending = 0;
        
        for (const course of lecturerCourses) {
            const courseAssignments = assignments.filter(a => a.course === course.courseCode);
            const courseSubmissions = submissions.filter(s => 
                courseAssignments.some(a => a._id.toString() === s.assignmentId.toString())
            );
            
            coursesProgress.push({
                courseCode: course.courseCode,
                courseTitle: course.courseTitle,
                totalAssignments: courseAssignments.length,
                submittedCount: courseSubmissions.length,
                pendingGrading: courseSubmissions.filter(s => s.status === 'pending').length,
                graded: courseSubmissions.filter(s => s.status === 'graded').length
            });
            
            totalAssignments += courseAssignments.length;
            totalSubmitted += courseSubmissions.length;
            totalPending += courseSubmissions.filter(s => s.status === 'pending').length;
        }
        
        res.status(200).json({
            success: true,
            student: {
                userId: student._id,
                name: student.fullName,
                email: student.email,
                matricNumber: student.matricNumber,
                level: student.level || '500',
                courses: coursesProgress,
                totalAssignments,
                submittedCount: totalSubmitted,
                pendingSubmissions: totalPending
            }
        });
        
    } catch (error) {
        console.error('Get student details error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};