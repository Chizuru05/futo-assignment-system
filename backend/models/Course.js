// backend/models/Course.js
const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    courseCode: {
        type: String,
        required: true,
        unique: true
    },
    courseTitle: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        default: 3
    },
    department: {
        type: String,
        default: 'Information Technology'
    },
    level: {
        type: String,
        enum: ['100', '200', '300', '400', '500'],
        required: true
    },
    semester: {
        type: String,
        enum: ['Harmattan', 'Rain', 'Both'],
        default: 'Both'
    },
    session: {
        type: String,
        required: true,
        default: '2025-2026'
    },
    description: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Course', courseSchema);