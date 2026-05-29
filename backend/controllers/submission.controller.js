// backend/controllers/submission.controller.js
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const LecturerCourse = require('../models/LecturerCourse');
const Settings = require('../models/Settings');
const { sendEmail, emailTemplates } = require('../config/email');
const fs = require('fs');

// Helper to get active settings
async function getActiveSettings() {
    const settings = await Settings.getSettings();
    return {
        session: settings.activeSession,
        semester: settings.activeSemester
    };
}

// Student: Submit assignment with files
exports.submitAssignment = async (req, res) => {
    try {
        const { assignmentId, comments } = req.body;
        const files = req.files || [];
        
        // Get active settings
        const activeSettings = await getActiveSettings();
        
        console.log('=== SUBMIT ASSIGNMENT ===');
        console.log('Assignment ID:', assignmentId);
        console.log('Student ID:', req.user.id);
        console.log('Active Session:', activeSettings.session);
        console.log('Active Semester:', activeSettings.semester);
        
        if (!assignmentId) {
            if (files.length > 0) {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            }
            return res.status(400).json({
                success: false,
                message: 'Assignment ID is required'
            });
        }
        
        // Check if assignment exists and belongs to active session/semester
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            if (files.length > 0) {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            }
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        // Verify assignment belongs to active session/semester
        const assignmentSession = assignment.session || '2025-2026';
        const assignmentSemester = assignment.semester || 'Harmattan';
        
        if (assignmentSession !== activeSettings.session || assignmentSemester !== activeSettings.semester) {
            if (files.length > 0) {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            }
            return res.status(403).json({
                success: false,
                message: `This assignment is not available for current session (${activeSettings.session} ${activeSettings.semester})`
            });
        }
        
        // Check if already submitted
        const existingSubmission = await Submission.findOne({ 
            assignmentId, 
            studentId: req.user.id,
            session: activeSettings.session,
            semester: activeSettings.semester
        });
        
        if (existingSubmission) {
            if (files.length > 0) {
                files.forEach(file => {
                    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                });
            }
            return res.status(400).json({
                success: false,
                message: 'You have already submitted this assignment'
            });
        }
        
        // Get student details
        const student = await User.findById(req.user.id);
        const studentName = student.fullName || req.user.fullName || 'Unknown';
        const studentMatric = student.matricNumber || req.user.matricNumber || 'Unknown';
        
        // Process uploaded files
        const uploadedFiles = files.map(file => ({
            name: file.originalname,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            path: file.path,
            mimetype: file.mimetype,
            originalName: file.originalname
        }));
        
        const submission = new Submission({
            assignmentId,
            studentId: req.user.id,
            studentName: studentName,
            matricNumber: studentMatric,
            files: uploadedFiles,
            comments: comments || '',
            status: 'pending',
            session: activeSettings.session,
            semester: activeSettings.semester
        });
        
        await submission.save();
        
        // Send confirmation email
        try {
            const emailHtml = emailTemplates.submissionConfirmation(
                studentName,
                assignment.title,
                assignment.courseName,
                new Date().toLocaleString(),
                uploadedFiles.length
            );
            
            await sendEmail(
                student.email,
                `✅ Submission Received: ${assignment.title}`,
                emailHtml
            );
        } catch (emailError) {
            console.error('Submission email error:', emailError.message);
        }
        
        res.status(201).json({
            success: true,
            message: 'Assignment submitted successfully',
            submission: {
                _id: submission._id,
                assignmentId: submission.assignmentId,
                files: submission.files,
                status: submission.status,
                submittedAt: submission.submittedAt,
                session: submission.session,
                semester: submission.semester
            }
        });
        
    } catch (error) {
        console.error('Submit error:', error);
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            });
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Server error'
        });
    }
};

// Student: Get my submissions (filtered by active session/semester)
exports.getMySubmissions = async (req, res) => {
    try {
        // Get active settings
        const activeSettings = await getActiveSettings();
        
        console.log('=== GET MY SUBMISSIONS ===');
        console.log('Student ID:', req.user.id);
        console.log('Active Session:', activeSettings.session);
        console.log('Active Semester:', activeSettings.semester);
        
        // Get submissions for active session/semester only
        const submissions = await Submission.find({ 
            studentId: req.user.id,
            session: activeSettings.session,
            semester: activeSettings.semester
        }).populate('assignmentId', 'title courseName dueDate totalMarks rubric')
          .sort({ submittedAt: -1 });
        
        console.log(`Found ${submissions.length} submissions for ${activeSettings.session} ${activeSettings.semester}`);
        
        res.status(200).json({
            success: true,
            count: submissions.length,
            submissions,
            activeSession: activeSettings.session,
            activeSemester: activeSettings.semester
        });
        
    } catch (error) {
        console.error('Get my submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// Lecturer: Get submissions for an assignment
exports.getAssignmentSubmissions = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        
        // Get active settings
        const activeSettings = await getActiveSettings();
        
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        if (assignment.lecturerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        const submissions = await Submission.find({ 
            assignmentId,
            session: activeSettings.session,
            semester: activeSettings.semester
        }).sort({ submittedAt: -1 });
        
        res.status(200).json({
            success: true,
            count: submissions.length,
            submissions,
            assignment,
            activeSession: activeSettings.session,
            activeSemester: activeSettings.semester
        });
        
    } catch (error) {
        console.error('Get assignment submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Lecturer: Grade a submission
exports.gradeSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const { scores, feedback, totalScore } = req.body;
        
        const submission = await Submission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }
        
        const assignment = await Assignment.findById(submission.assignmentId);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        if (assignment.lecturerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        submission.scores = scores || {};
        submission.feedback = feedback || '';
        submission.totalScore = totalScore || 0;
        submission.status = 'graded';
        submission.gradedAt = new Date();
        
        await submission.save();
        
        // Send grade notification email
        try {
            const student = await User.findById(submission.studentId);
            const percentage = ((totalScore || 0) / assignment.totalMarks * 100).toFixed(1);
            
            const emailHtml = emailTemplates.gradeReleased(
                student.fullName,
                assignment.title,
                assignment.courseName,
                totalScore || 0,
                assignment.totalMarks,
                percentage,
                feedback
            );
            
            await sendEmail(
                student.email,
                `⭐ Grade Released: ${assignment.title}`,
                emailHtml
            );
        } catch (emailError) {
            console.error('Grade email error:', emailError.message);
        }
        
        res.status(200).json({
            success: true,
            message: 'Submission graded successfully',
            submission
        });
        
    } catch (error) {
        console.error('Grade submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Get single submission by ID
exports.getSubmissionById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }
        
        const submission = await Submission.findById(id)
            .populate('assignmentId', 'title courseName dueDate totalMarks rubric');
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }
        
        res.status(200).json({
            success: true,
            submission
        });
        
    } catch (error) {
        console.error('Get submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Get pending submissions count for lecturer (for badge)
exports.getPendingCount = async (req, res) => {
    try {
        const lecturerId = req.user.id;
        
        // Get active settings
        const activeSettings = await getActiveSettings();
        
        // Get lecturer's courses for active session/semester
        const lecturerCourses = await LecturerCourse.find({
            lecturerId,
            session: activeSettings.session,
            semester: activeSettings.semester,
            status: 'active'
        });
        
        const courseCodes = lecturerCourses.map(c => c.courseCode);
        
        if (courseCodes.length === 0) {
            return res.json({ success: true, count: 0 });
        }
        
        // Get assignments for these courses for active session/semester
        const assignments = await Assignment.find({
            course: { $in: courseCodes },
            session: activeSettings.session,
            semester: activeSettings.semester
        });
        
        const assignmentIds = assignments.map(a => a._id);
        
        if (assignmentIds.length === 0) {
            return res.json({ success: true, count: 0 });
        }
        
        // Count pending submissions
        const pendingCount = await Submission.countDocuments({
            assignmentId: { $in: assignmentIds },
            session: activeSettings.session,
            semester: activeSettings.semester,
            status: 'pending'
        });
        
        res.json({
            success: true,
            count: pendingCount,
            activeSession: activeSettings.session,
            activeSemester: activeSettings.semester
        });
        
    } catch (error) {
        console.error('Get pending count error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Download submission file
exports.downloadFile = async (req, res) => {
    try {
        const { submissionId, fileIndex } = req.params;
        
        const submission = await Submission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }
        
        const file = submission.files[parseInt(fileIndex)];
        if (!file) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }
        
        if (!fs.existsSync(file.path)) {
            return res.status(404).json({
                success: false,
                message: 'File not found on server'
            });
        }
        
        res.download(file.path, file.name);
        
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Get all submissions for lecturer (filtered by session/semester)
exports.getAllSubmissionsForLecturer = async (req, res) => {
    try {
        const lecturerId = req.user.id;
        const { session, semester } = req.query;
        
        // Get active settings if not provided
        let activeSession = session;
        let activeSemester = semester;
        
        if (!activeSession || !activeSemester) {
            const settings = await getActiveSettings();
            activeSession = settings.session;
            activeSemester = settings.semester;
        }
        
        console.log('=== GET ALL SUBMISSIONS FOR LECTURER ===');
        console.log('Lecturer ID:', lecturerId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);
        
        // Get courses the lecturer is teaching this session/semester
        const lecturerCourses = await LecturerCourse.find({
            lecturerId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).select('courseId courseCode');
        
        const courseCodes = lecturerCourses.map(lc => lc.courseCode);
        
        if (courseCodes.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                submissions: [],
                activeSession,
                activeSemester
            });
        }
        
        // Get assignments for those courses for active session/semester
        const assignments = await Assignment.find({
            course: { $in: courseCodes },
            session: activeSession,
            semester: activeSemester
        }).select('_id');
        
        const assignmentIds = assignments.map(a => a._id);
        
        if (assignmentIds.length === 0) {
            return res.status(200).json({
                success: true,
                count: 0,
                submissions: [],
                activeSession,
                activeSemester
            });
        }
        
        // Get submissions for those assignments for active session/semester
        const submissions = await Submission.find({
            assignmentId: { $in: assignmentIds },
            session: activeSession,
            semester: activeSemester
        }).populate('assignmentId', 'title courseName dueDate totalMarks rubric course')
          .sort({ submittedAt: -1 });
        
        console.log(`Found ${submissions.length} submissions for ${activeSession} ${activeSemester}`);
        
        res.status(200).json({
            success: true,
            count: submissions.length,
            submissions,
            activeSession,
            activeSemester
        });
        
    } catch (error) {
        console.error('Get all submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};