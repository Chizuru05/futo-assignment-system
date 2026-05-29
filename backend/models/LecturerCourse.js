// backend/models/LecturerCourse.js
const mongoose = require('mongoose');

const lecturerCourseSchema = new mongoose.Schema({
    lecturerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    courseCode: { type: String, required: true },
    courseTitle: { type: String, required: true },
    level: { type: String, required: true },
    credits: { type: Number, default: 3 },
    session: { type: String, required: true, default: '2025-2026' },
    semester: {
        type: String,
        enum: ['Harmattan', 'Rain'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'completed'],
        default: 'active'
    },
    assignedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('LecturerCourse', lecturerCourseSchema);