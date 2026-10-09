// backend/controllers/studentOnboarding.controller.js
const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Settings = require('../models/Settings');

const LEVELS = ['100', '200', '300', '400', '500'];

async function getActive() {
    const s = await Settings.getSettings();
    return { session: s.activeSession, semester: s.activeSemester };
}

function cleanRow(row) {
    return {
        matricNumber: String(row.matricNumber || '').trim(),
        fullName: String(row.fullName || '').trim(),
        level: String(row.level || '').replace(/[^0-9]/g, ''),
        email: String(row.email || '').trim().toLowerCase()
    };
}

function checkRow(row) {
    if (!row.matricNumber) return 'Matric number is required';
    if (!row.fullName) return 'Full name is required';
    if (!LEVELS.includes(row.level)) return 'Level must be 100, 200, 300, 400 or 500';
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Email is not valid';
    return null;
}

// Enroll the student in every course for their level in the active session/semester.
// Without this, the student's assignments page stays empty.
async function enrollInLevelCourses(student, semester) {
    const courses = await Course.find({
        level: student.level,
        semester: { $in: [semester, 'Both'] }
    });
    if (courses.length === 0) return 0;

    const docs = courses.map(c => ({
        studentId: student._id,
        courseId: c._id,
        courseCode: c.courseCode,
        level: student.level,
        session: student.admissionSession,
        semester,
        status: 'active'
    }));

    await Enrollment.insertMany(docs, { ordered: false });
    return docs.length;
}

async function createStudent(row, active) {
    const data = cleanRow(row);
    const problem = checkRow(data);
    if (problem) return { status: 'error', message: problem };

    const dupQuery = [{ matricNumber: data.matricNumber }];
    if (data.email) dupQuery.push({ email: data.email });

    const existing = await User.findOne({ $or: dupQuery });
    if (existing) {
        return { status: 'skipped', message: 'Already exists (matric number or email in use)' };
    }

    const student = await User.create({
        fullName: data.fullName,
        matricNumber: data.matricNumber,
        email: data.email || undefined,
        password: data.matricNumber,      // default password = matric number
        role: 'student',
        level: data.level,
        admissionSession: active.session,
        status: 'active',
        isActive: true,
        emailVerified: true,              // admin-created, so no OTP step
        otp: null,
        otpExpiry: null,
        mustChangePassword: true
    });

    let enrolled = 0;
    try {
        enrolled = await enrollInLevelCourses(student, active.semester);
    } catch (err) {
        console.error(`Enrollment failed for ${data.matricNumber}:`, err.message);
    }

    return { status: 'created', message: `Created. Enrolled in ${enrolled} course(s)` };
}

// POST /api/onboard/students  (one student)
exports.addStudent = async (req, res) => {
    try {
        const active = await getActive();
        const result = await createStudent(req.body, active);

        const code = result.status === 'created' ? 201
            : result.status === 'skipped' ? 409 : 400;

        res.status(code).json({ success: result.status === 'created', ...result });
    } catch (error) {
        console.error('Add student error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/onboard/students/bulk  { students: [ {matricNumber, fullName, level, email}, ... ] }
exports.bulkAddStudents = async (req, res) => {
    try {
        const list = req.body.students;
        if (!Array.isArray(list) || list.length === 0) {
            return res.status(400).json({ success: false, message: 'No students provided' });
        }
        if (list.length > 500) {
            return res.status(400).json({ success: false, message: 'Import at most 500 students at a time' });
        }

        const active = await getActive();
        const results = [];

        for (let i = 0; i < list.length; i++) {
            try {
                const r = await createStudent(list[i], active);
                results.push({ line: i + 1, matricNumber: String(list[i].matricNumber || ''), ...r });
            } catch (err) {
                results.push({
                    line: i + 1,
                    matricNumber: String(list[i].matricNumber || ''),
                    status: 'error',
                    message: err.code === 11000 ? 'Duplicate matric number or email' : err.message
                });
            }
        }

        const count = s => results.filter(r => r.status === s).length;

        res.status(200).json({
            success: true,
            summary: { created: count('created'), skipped: count('skipped'), errors: count('error') },
            results
        });
    } catch (error) {
        console.error('Bulk add error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/onboard/students?level=500
exports.listStudents = async (req, res) => {
    try {
        const filter = { role: 'student' };
        if (req.query.level) filter.level = String(req.query.level);

        const students = await User.find(filter)
            .select('-password')
            .sort({ level: 1, fullName: 1 });

        res.status(200).json({ success: true, count: students.length, students });
    } catch (error) {
        console.error('List students error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};