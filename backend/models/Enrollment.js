// backend/models/Enrollment.js
const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true
    },
    courseCode: {
        type: String,
        required: true
    },
    courseTitle: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        default: 3
    },
    level: {
        type: String,
        required: true
    },
    session: {
        type: String,
        required: true,
        default: '2025-2026'
    },
    semester: {
        type: String,
        enum: ['Harmattan', 'Rain'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'dropped', 'completed'],
        default: 'active'
    },
    enrolledAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);