// backend/controllers/assignment.controller.js
const Assignment = require('../models/Assignment');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const LecturerCourse = require('../models/LecturerCourse');
const Submission = require('../models/Submission');
const Settings = require('../models/Settings');
const User = require('../models/User');
const { sendEmail, emailTemplates } = require('../config/email');
const { extractText } = require('../utils/extractText');

// Helper to get active settings
async function getActiveSettings() {
    const settings = await Settings.getSettings();
    return {
        session: settings.activeSession,
        semester: settings.activeSemester
    };
}

// Students must never receive any marking script info
function hideScriptFromStudents(query, req) {
    if (req.user && req.user.role === 'student') {
        query.select('-markingScheme');
    }
    return query;
}

// ============ CREATE ASSIGNMENT ============
exports.createAssignment = async (req, res) => {
    try {
        const {
            course, courseName, title, description, dueDate, dueDateISO,
            dueTime, totalMarks, rubric, allowMultipleFiles, allowLateSubmissions,
            session, semester
        } = req.body;

        const lecturerId = req.user.id;

        let activeSession = session;
        let activeSemester = semester;

        if (!activeSession || !activeSemester) {
            const settings = await getActiveSettings();
            activeSession = settings.session;
            activeSemester = settings.semester;
        }

        if (!course || !title || !dueDate || !totalMarks) {
            return res.status(400).json({
                success: false,
                message: 'Course, title, due date, and total marks are required'
            });
        }

        const assignment = new Assignment({
            course,
            courseName: courseName || course,
            title,
            description: description || '',
            dueDate,
            dueDateISO: dueDateISO || dueDate,
            dueTime: dueTime || '23:59',
            totalMarks,
            rubric: rubric || [],
            allowMultiple: allowMultipleFiles !== false,
            allowLate: allowLateSubmissions !== false,
            session: activeSession,
            semester: activeSemester,
            lecturerId
        });

        await assignment.save();

        console.log(`✅ Assignment created: ${title} for ${course} (${activeSession} ${activeSemester})`);

        // Respond right away — don't make the lecturer wait on email sending
        res.status(201).json({
            success: true,
            message: 'Assignment created successfully',
            assignment
        });

        // Fire-and-forget: notify enrolled students
        notifyEnrolledStudents(assignment, activeSession, activeSemester)
            .catch(err => console.error('Assignment notification error:', err.message));

    } catch (error) {
        console.error('Create assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// Helper — sends assignment-created email to all enrolled students
async function notifyEnrolledStudents(assignment, session, semester) {
    const enrollments = await Enrollment.find({
        courseCode: assignment.course,
        session,
        semester,
        status: 'active'
    });

    if (enrollments.length === 0) {
        console.log('No enrolled students to notify for', assignment.course);
        return;
    }

    const studentIds = enrollments.map(e => e.studentId);
    const students = await User.find({ _id: { $in: studentIds } });

    console.log(`Sending assignment notification to ${students.length} students...`);

    for (const student of students) {
        try {
            await sendEmail(
                student.email,
                `📘 New Assignment: ${assignment.title}`,
                emailTemplates.assignmentCreated(
                    student.fullName,
                    assignment.title,
                    assignment.courseName,
                    assignment.dueDate,
                    assignment.dueTime,
                    assignment.totalMarks
                )
            );
        } catch (err) {
            console.error(`Failed to email ${student.email}:`, err.message);
        }
    }
    console.log('✅ Assignment notifications complete');
}

// ============ GET ASSIGNMENTS FOR LECTURER (FILTERED BY ACTIVE SESSION/SEMESTER) ============
exports.getLecturerAssignments = async (req, res) => {
    try {
        const lecturerId = req.user.id;

        // Get active settings
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;

        console.log('=== GET LECTURER ASSIGNMENTS ===');
        console.log('Lecturer ID:', lecturerId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);

        // Get courses the lecturer is registered for in the ACTIVE session/semester
        const lecturerCourses = await LecturerCourse.find({
            lecturerId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).select('courseCode');

        const courseCodes = lecturerCourses.map(c => c.courseCode);
        console.log('Course codes for active semester:', courseCodes);

        if (courseCodes.length === 0) {
            return res.status(200).json({ success: true, assignments: [] });
        }

        // Get assignments ONLY for active session/semester
        // (markingScheme.text is select:false, so only hasScript/fileName/strictness come back here)
        const assignments = await Assignment.find({
            course: { $in: courseCodes },
            session: activeSession,
            semester: activeSemester
        }).sort({ dueDateISO: 1 });

        console.log(`Found ${assignments.length} assignments for lecturer (${activeSession} ${activeSemester})`);

        res.status(200).json({
            success: true,
            count: assignments.length,
            assignments,
            activeSession,
            activeSemester
        });

    } catch (error) {
        console.error('Get lecturer assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ GET ALL ASSIGNMENTS FOR STUDENT (FILTERED BY ACTIVE SESSION/SEMESTER) ============
exports.getStudentAssignments = async (req, res) => {
    try {
        const studentId = req.user.id;

        // Get active settings
        const activeSettings = await getActiveSettings();
        const activeSession = activeSettings.session;
        const activeSemester = activeSettings.semester;

        console.log('=== GET STUDENT ASSIGNMENTS ===');
        console.log('Student ID:', studentId);
        console.log('Active Session:', activeSession);
        console.log('Active Semester:', activeSemester);

        // Get student's enrolled courses for ACTIVE session/semester
        const enrollments = await Enrollment.find({
            studentId: studentId,
            session: activeSession,
            semester: activeSemester,
            status: 'active'
        }).select('courseCode');

        const courseCodes = enrollments.map(e => e.courseCode);
        console.log('Enrolled courses for active semester:', courseCodes);

        if (courseCodes.length === 0) {
            return res.status(200).json({
                success: true,
                assignments: [],
                count: 0,
                message: 'No courses enrolled for current session/semester',
                activeSession,
                activeSemester
            });
        }

        // Get assignments for active session/semester.
        // No .select() here: the schema already hides markingScheme.text,
        // and we remove the rest of markingScheme below.
        const assignments = await Assignment.find({
            course: { $in: courseCodes },
            session: activeSession,
            semester: activeSemester
        }).sort({ dueDateISO: 1 });

        console.log(`Found ${assignments.length} assignments for student (${activeSession} ${activeSemester})`);

        // Get this student's submissions for the ACTIVE session/semester only
        const submissions = await Submission.find({
            studentId: studentId,
            session: activeSession,
            semester: activeSemester
        }).select('assignmentId');

        // Skip any submission with no assignmentId, so one bad record can't crash the request
        const submittedIds = new Set(
            submissions
                .filter(s => s.assignmentId)
                .map(s => s.assignmentId.toString())
        );

        // Build the response and remove the marking script info so students never see it
        const assignmentsWithStatus = assignments.map(assignment => {
            const obj = assignment.toObject();
            delete obj.markingScheme;

            return {
                ...obj,
                submitted: submittedIds.has(assignment._id.toString())
            };
        });

        res.status(200).json({
            success: true,
            count: assignmentsWithStatus.length,
            assignments: assignmentsWithStatus,
            activeSession,
            activeSemester
        });

    } catch (error) {
        console.error('Get student assignments error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ============ GET ASSIGNMENT BY ID ============
exports.getAssignmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const query = Assignment.findById(id);
        hideScriptFromStudents(query, req);
        const assignment = await query;

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        res.status(200).json({
            success: true,
            assignment
        });

    } catch (error) {
        console.error('Get assignment by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ UPDATE ASSIGNMENT ============
exports.updateAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const lecturerId = req.user.id;

        const assignment = await Assignment.findById(id);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.lecturerId.toString() !== lecturerId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this assignment'
            });
        }

        // dueDateISO was missing before, so edited due dates never took effect for students
        const allowedUpdates = [
            'courseName', 'title', 'description', 'dueDate', 'dueDateISO', 'dueTime',
            'totalMarks', 'rubric', 'allowMultiple', 'allowLate', 'session', 'semester'
        ];
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                assignment[key] = updates[key];
            }
        }

        await assignment.save();

        res.status(200).json({
            success: true,
            message: 'Assignment updated successfully',
            assignment
        });

    } catch (error) {
        console.error('Update assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ DELETE ASSIGNMENT ============
exports.deleteAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const lecturerId = req.user.id;

        const assignment = await Assignment.findById(id);

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.lecturerId.toString() !== lecturerId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this assignment'
            });
        }

        const submissions = await Submission.countDocuments({ assignmentId: id });
        if (submissions > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete: ${submissions} student submission(s) exist`
            });
        }

        await Assignment.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Assignment deleted successfully'
        });

    } catch (error) {
        console.error('Delete assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ GET ASSIGNMENTS BY COURSE ============
exports.getCourseAssignments = async (req, res) => {
    try {
        const { courseCode } = req.params;
        const { session, semester } = req.query;

        let currentSession = session;
        let currentSemester = semester;

        if (!currentSession || !currentSemester) {
            const settings = await getActiveSettings();
            currentSession = settings.session;
            currentSemester = settings.semester;
        }

        const query = Assignment.find({
            course: courseCode,
            session: currentSession,
            semester: currentSemester
        }).sort({ dueDateISO: 1 });
        hideScriptFromStudents(query, req);
        const assignments = await query;

        res.status(200).json({
            success: true,
            count: assignments.length,
            assignments,
            activeSession: currentSession,
            activeSemester: currentSemester
        });

    } catch (error) {
        console.error('Get course assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ GET ASSIGNMENTS BY SESSION/SEMESTER (for admin) ============
exports.getAssignmentsBySession = async (req, res) => {
    try {
        const { session, semester } = req.query;

        const filter = {};
        if (session) filter.session = session;
        if (semester) filter.semester = semester;

        const query = Assignment.find(filter).sort({ createdAt: -1 });
        hideScriptFromStudents(query, req);
        const assignments = await query;

        res.status(200).json({
            success: true,
            count: assignments.length,
            assignments,
            filters: { session, semester }
        });

    } catch (error) {
        console.error('Get assignments by session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};

// ============ MARKING SCRIPT (lecturer only) ============
exports.saveMarkingScheme = async (req, res) => {
    try {
        const { id } = req.params;
        const assignment = await Assignment.findById(id);

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }
        if (assignment.lecturerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { text = '', strictness = 'balanced', clear } = req.body;

        // Remove the script
        if (clear === 'true') {
            assignment.markingScheme = {
                text: '',
                fileName: '',
                hasScript: false,
                strictness: 'balanced',
                updatedAt: new Date()
            };
            await assignment.save();
            return res.status(200).json({ success: true, message: 'Marking script removed' });
        }

        let extracted = '';
        let fileName = assignment.markingScheme?.fileName || '';

        if (req.file) {
            try {
                extracted = await extractText(req.file);
            } catch (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            if (extracted.length < 20) {
                return res.status(400).json({
                    success: false,
                    message: 'Could not read text from this file. If it is scanned or handwritten, type the key answers in the box instead.'
                });
            }
            fileName = req.file.originalname;
        }

        const finalText = [String(text).trim(), extracted].filter(Boolean).join('\n\n');
        if (!finalText) {
            return res.status(400).json({
                success: false,
                message: 'Upload a marking script file or type the key answers'
            });
        }

        assignment.markingScheme = {
            text: finalText.slice(0, 30000),
            fileName,
            hasScript: true,
            strictness: ['strict', 'balanced', 'flexible'].includes(strictness) ? strictness : 'balanced',
            updatedAt: new Date()
        };
        await assignment.save();

        res.status(200).json({
            success: true,
            message: 'Marking script saved',
            markingScheme: {
                fileName,
                hasScript: true,
                strictness: assignment.markingScheme.strictness,
                characters: finalText.length
            }
        });

    } catch (error) {
        console.error('Save marking scheme error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

exports.getMarkingScheme = async (req, res) => {
    try {
        // Only '+markingScheme.text' here: adding another field would turn this into an
        // inclusion-only query and drop fileName/hasScript/strictness
        const assignment = await Assignment.findById(req.params.id).select('+markingScheme.text');

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }
        if (assignment.lecturerId.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        res.status(200).json({
            success: true,
            markingScheme: {
                text: assignment.markingScheme?.text || '',
                fileName: assignment.markingScheme?.fileName || '',
                hasScript: !!assignment.markingScheme?.hasScript,
                strictness: assignment.markingScheme?.strictness || 'balanced'
            }
        });
    } catch (error) {
        console.error('Get marking scheme error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};