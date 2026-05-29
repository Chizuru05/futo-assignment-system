// backend/controllers/admin.controller.js
const User = require('../models/User');
const Course = require('../models/Course');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');
const LecturerCourse = require('../models/LecturerCourse');
const Settings = require('../models/Settings');

// Helper to get active settings
async function getActiveSettings() {
    const settings = await Settings.getSettings();
    return {
        session: settings.activeSession,
        semester: settings.activeSemester
    };
}

// ============ USER MANAGEMENT ============

exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getUsersByRole = async (req, res) => {
    try {
        const { role } = req.params;
        if (!['student', 'lecturer', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }
        
        const users = await User.find({ role }).select('-password').sort({ fullName: 1 });
        res.status(200).json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error('Get users by role error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Get user by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (user.role === 'student') {
            await Enrollment.deleteMany({ studentId: id });
            await Submission.deleteMany({ studentId: id });
        } else if (user.role === 'lecturer') {
            await LecturerCourse.deleteMany({ lecturerId: id });
            await Assignment.deleteMany({ lecturerId: id });
        }
        
        await User.findByIdAndDelete(id);
        
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// ============ GET LECTURER'S REGISTERED COURSES - FIXED ============
exports.getLecturerCourses = async (req, res) => {
    try {
        const { lecturerId } = req.params;
        const { session, semester } = req.query;
        
        const lecturer = await User.findById(lecturerId);
        if (!lecturer || lecturer.role !== 'lecturer') {
            return res.status(404).json({ success: false, message: 'Lecturer not found' });
        }
        
        let activeSession = session;
        let activeSemester = semester;
        if (!activeSession || !activeSemester) {
            const settings = await getActiveSettings();
            activeSession = settings.session;
            activeSemester = settings.semester;
        }
        
        console.log('=== GET LECTURER COURSES ===');
        console.log('Lecturer:', lecturer.fullName);
        console.log('Session:', activeSession);
        console.log('Semester:', activeSemester);
        
        // For 2026-2027, return empty array immediately
        if (activeSession !== '2025-2026') {
            return res.status(200).json({
                success: true,
                count: 0,
                courses: [],
                lecturerName: lecturer.fullName
            });
        }
        
        // FIXED: Filter by semester as well
        const lecturerCourses = await LecturerCourse.find({ 
            lecturerId: lecturerId, 
            status: 'active',
            semester: activeSemester  // Add semester filter
        });
        
        console.log(`Found ${lecturerCourses.length} courses for ${activeSemester} semester`);
        
        const courses = lecturerCourses.map(lc => ({
            courseId: lc.courseId,
            courseCode: lc.courseCode,
            courseTitle: lc.courseTitle,
            level: lc.level,
            credits: lc.credits,
            semester: lc.semester
        }));
        
        res.status(200).json({
            success: true,
            count: courses.length,
            courses,
            lecturerName: lecturer.fullName
        });
        
    } catch (error) {
        console.error('Get lecturer courses error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// ============ STUDENT MANAGEMENT ============

exports.getStudentsGrouped = async (req, res) => {
    try {
        const { session, semester } = req.query;
        
        let activeSession = session;
        let activeSemester = semester;
        if (!activeSession || !activeSemester) {
            const settings = await getActiveSettings();
            activeSession = settings.session;
            activeSemester = settings.semester;
        }
        
        if (activeSession !== '2025-2026') {
            return res.status(200).json({
                success: true,
                data: [],
                activeSession,
                activeSemester
            });
        }
        
        const enrollments = await Enrollment.find({
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).populate('studentId', 'fullName email matricNumber level')
          .populate('courseId', 'courseCode courseTitle level semester');
        
        const groupedByLevel = {};
        
        for (const enrollment of enrollments) {
            const student = enrollment.studentId;
            const course = enrollment.courseId;
            
            if (!student || !course) continue;
            
            const level = student.level || '500';
            
            if (!groupedByLevel[level]) {
                groupedByLevel[level] = {
                    level: level,
                    students: {},
                    totalStudents: 0
                };
            }
            
            const courseKey = course.courseCode;
            if (!groupedByLevel[level].students[courseKey]) {
                groupedByLevel[level].students[courseKey] = {
                    courseCode: course.courseCode,
                    courseTitle: course.courseTitle,
                    semester: course.semester,
                    students: []
                };
            }
            
            const existingStudent = groupedByLevel[level].students[courseKey].students.find(
                s => s.id === student._id.toString()
            );
            
            if (!existingStudent) {
                groupedByLevel[level].students[courseKey].students.push({
                    id: student._id,
                    name: student.fullName,
                    matricNumber: student.matricNumber,
                    email: student.email,
                    level: student.level
                });
                groupedByLevel[level].totalStudents++;
            }
        }
        
        const result = [];
        for (const level of Object.keys(groupedByLevel).sort((a, b) => parseInt(a) - parseInt(b))) {
            const levelData = groupedByLevel[level];
            const coursesArray = [];
            
            for (const courseCode of Object.keys(levelData.students)) {
                coursesArray.push(levelData.students[courseCode]);
            }
            
            result.push({
                level: level,
                courses: coursesArray,
                totalStudents: levelData.totalStudents
            });
        }
        
        res.status(200).json({
            success: true,
            data: result,
            activeSession,
            activeSemester
        });
        
    } catch (error) {
        console.error('Get students grouped error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// ============ COURSE MANAGEMENT ============

exports.getAllCourses = async (req, res) => {
    try {
        const { session, semester } = req.query;
        
        let activeSession = session;
        let activeSemester = semester;
        
        if (!activeSession || activeSession === '' || activeSession === 'all') {
            const settings = await getActiveSettings();
            activeSession = settings.session;
        }
        if (!activeSemester || activeSemester === '' || activeSemester === 'all') {
            const settings = await getActiveSettings();
            activeSemester = settings.semester;
        }
        
        console.log('=== GET ALL COURSES ===');
        console.log('Session:', activeSession);
        console.log('Semester:', activeSemester);
        
        if (activeSession !== '2025-2026') {
            return res.status(200).json({
                success: true,
                count: 0,
                courses: [],
                activeSession,
                activeSemester
            });
        }
        
        const query = {
            $or: [
                { semester: activeSemester },
                { semester: 'Both' }
            ]
        };
        
        const courses = await Course.find(query).sort({ level: 1, courseCode: 1 });
        
        console.log(`Found ${courses.length} courses for ${activeSemester}`);
        
        res.status(200).json({
            success: true,
            count: courses.length,
            courses,
            activeSession,
            activeSemester
        });
    } catch (error) {
        console.error('Get all courses error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getCourseById = async (req, res) => {
    try {
        const { id } = req.params;
        const course = await Course.findById(id);
        
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        res.status(200).json({ success: true, course });
    } catch (error) {
        console.error('Get course by ID error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createCourse = async (req, res) => {
    try {
        const { courseCode, courseTitle, level, credits, description } = req.body;
        
        const activeSettings = await getActiveSettings();
        const activeSemester = activeSettings.semester;
        
        if (!courseCode || !courseTitle || !level) {
            return res.status(400).json({ 
                success: false, 
                message: 'Course code, title, and level are required' 
            });
        }
        
        const existing = await Course.findOne({ 
            courseCode: courseCode.toUpperCase()
        });
        
        if (existing) {
            return res.status(400).json({ 
                success: false, 
                message: 'Course code already exists' 
            });
        }
        
        const course = new Course({
            courseCode: courseCode.toUpperCase(),
            courseTitle,
            level,
            semester: activeSemester,
            credits: credits || 3,
            description: description || ''
        });
        
        await course.save();
        
        res.status(201).json({ 
            success: true, 
            message: `Course created successfully for ${activeSemester} semester`, 
            course 
        });
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

exports.updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { courseTitle, level, credits, description } = req.body;
        
        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        if (courseTitle) course.courseTitle = courseTitle;
        if (level) course.level = level;
        if (credits) course.credits = credits;
        if (description !== undefined) course.description = description;
        
        await course.save();
        
        res.status(200).json({
            success: true,
            message: 'Course updated successfully',
            course
        });
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        
        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        
        const enrollments = await Enrollment.countDocuments({ courseId: id });
        if (enrollments > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete course: ${enrollments} student(s) are enrolled`
            });
        }
        
        const lecturerAssignments = await LecturerCourse.countDocuments({ courseId: id });
        if (lecturerAssignments > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete course: ${lecturerAssignments} lecturer(s) are assigned`
            });
        }
        
        await Course.findByIdAndDelete(id);
        
        res.status(200).json({ 
            success: true, 
            message: 'Course deleted successfully' 
        });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// ============ STATISTICS ============

exports.getStats = async (req, res) => {
    try {
        const { session, semester } = req.query;
        
        let activeSession = session;
        let activeSemester = semester;
        if (!activeSession || !activeSemester) {
            const settings = await getActiveSettings();
            activeSession = settings.session;
            activeSemester = settings.semester;
        }
        
        console.log('=== GET STATS ===');
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        if (activeSession !== '2025-2026') {
            console.log('Showing zeros for new session:', activeSession);
            return res.status(200).json({
                success: true,
                stats: {
                    courses: 0,
                    students: 0,
                    lecturers: 0
                },
                activeSession,
                activeSemester
            });
        }
        
        const courses = await Course.find({
            $or: [
                { semester: activeSemester },
                { semester: 'Both' }
            ]
        });
        const totalCourses = courses.length;
        
        const students = await Enrollment.find({
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).distinct('studentId');
        const totalStudents = students.length;
        
        const totalLecturers = await User.countDocuments({ role: 'lecturer' });
        
        console.log(`Stats: Courses=${totalCourses}, Students=${totalStudents}, Lecturers=${totalLecturers}`);
        
        res.status(200).json({
            success: true,
            stats: {
                courses: totalCourses,
                students: totalStudents,
                lecturers: totalLecturers
            },
            activeSession,
            activeSemester
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};