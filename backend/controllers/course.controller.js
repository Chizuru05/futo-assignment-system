// backend/controllers/course.controller.js
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LecturerCourse = require('../models/LecturerCourse');

// ============ GET COURSES BY LEVEL ============
exports.getCoursesByLevel = async (req, res) => {
    try {
        const { level, semester } = req.query;
        
        let query = {};
        if (level) query.level = level;
        if (semester) query.semester = { $in: [semester, 'Both'] };
        
        const courses = await Course.find(query).sort({ courseCode: 1 });
        
        res.status(200).json({
            success: true,
            count: courses.length,
            courses
        });
        
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============ GET ALL COURSES ============
exports.getAllCourses = async (req, res) => {
    try {
        const courses = await Course.find().sort({ level: 1, courseCode: 1 });
        
        res.status(200).json({
            success: true,
            count: courses.length,
            courses
        });
        
    } catch (error) {
        console.error('Get all courses error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============ GET COURSE BY ID ============
exports.getCourseById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const course = await Course.findById(id);
        
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        
        res.status(200).json({
            success: true,
            course
        });
        
    } catch (error) {
        console.error('Get course by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============ CREATE COURSE ============
exports.createCourse = async (req, res) => {
    try {
        const { courseCode, courseTitle, level, semester, description, credits } = req.body;
        
        const existingCourse = await Course.findOne({ courseCode });
        if (existingCourse) {
            return res.status(400).json({
                success: false,
                message: 'Course code already exists'
            });
        }
        
        const course = new Course({
            courseCode,
            courseTitle,
            level,
            semester: semester || 'Both',
            description: description || '',
            credits: credits || 3
        });
        
        await course.save();
        
        res.status(201).json({
            success: true,
            message: 'Course created successfully',
            course
        });
        
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============ UPDATE COURSE ============
exports.updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const { courseCode, courseTitle, level, semester, description, credits } = req.body;
        
        const course = await Course.findById(id);
        
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        
        // Update fields
        if (courseCode) course.courseCode = courseCode;
        if (courseTitle) course.courseTitle = courseTitle;
        if (level) course.level = level;
        if (semester) course.semester = semester;
        if (description !== undefined) course.description = description;
        if (credits) course.credits = credits;
        
        await course.save();
        
        res.status(200).json({
            success: true,
            message: 'Course updated successfully',
            course
        });
        
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============ DELETE COURSE ============
exports.deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;
        
        const course = await Course.findById(id);
        
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }
        
        // Check if course has any enrollments
        const enrollments = await Enrollment.countDocuments({ courseId: id });
        if (enrollments > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete course: ${enrollments} students are enrolled`
            });
        }
        
        // Check if any lecturer is assigned to this course
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
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// ============ BULK CREATE COURSES ============
exports.bulkCreateCourses = async (req, res) => {
    try {
        const courses = req.body.courses;
        let created = 0;
        let skipped = 0;
        
        if (!courses || !courses.length) {
            return res.status(400).json({
                success: false,
                message: 'No courses provided'
            });
        }
        
        for (const course of courses) {
            const existing = await Course.findOne({ courseCode: course.courseCode });
            if (!existing) {
                await Course.create({
                    ...course,
                    semester: course.semester || 'Both',
                    credits: course.credits || 3
                });
                created++;
            } else {
                skipped++;
            }
        }
        
        res.status(201).json({
            success: true,
            message: `${created} courses created, ${skipped} already existed`,
            created,
            skipped
        });
        
    } catch (error) {
        console.error('Bulk create error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};