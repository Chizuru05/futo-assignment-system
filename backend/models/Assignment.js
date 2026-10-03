const mongoose = require('mongoose');

const rubricSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    maxScore: {
        type: Number,
        required: true,
        min: 1
    }
});

const assignmentSchema = new mongoose.Schema({
    course: {
        type: String,
        required: true
    },
    courseName: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    dueDate: {
        type: String,
        required: true
    },
    dueDateISO: {
        type: String,
        required: true
    },
    dueTime: {
        type: String,
        required: true
    },
    totalMarks: {
        type: Number,
        required: true,
        min: 1
    },
    rubric: [rubricSchema],
    allowMultiple: {
        type: Boolean,
        default: true
    },
    allowLate: {
        type: Boolean,
        default: true
    },
    // Lecturer-only answer guide for AI grading.
    // `text` is hidden by default (select: false) so students can never receive it.
    // To read it, use .select('+markingScheme.text')
    markingScheme: {
        text: { type: String, default: '', select: false },
        fileName: { type: String, default: '' },
        hasScript: { type: Boolean, default: false },
        strictness: {
            type: String,
            enum: ['strict', 'balanced', 'flexible'],
            default: 'balanced'
        },
        updatedAt: { type: Date }
    },
    session: {
        type: String,
        default: '2025-2026'
    },
    semester: {
        type: String,
        enum: ['Harmattan', 'Rain'],
        default: 'Harmattan'
    },
    lecturerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Assignment', assignmentSchema);