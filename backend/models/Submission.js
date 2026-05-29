// backend/models/Submission.js
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    size: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        default: ''
    },
    originalName: {
        type: String,
        default: ''
    }
});

const submissionSchema = new mongoose.Schema({
    assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Assignment',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    studentName: {
        type: String,
        required: true
    },
    matricNumber: {
        type: String,
        required: true
    },
    files: [fileSchema],
    scores: {
        type: Map,
        of: Number,
        default: {}
    },
    feedback: {
        type: String,
        default: ''
    },
    totalScore: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'graded', 'draft'],
        default: 'pending'
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
    submittedAt: {
        type: Date,
        default: Date.now
    },
    gradedAt: {
        type: Date
    },
    aiScores: {
        type: Map,
        of: Number,
        default: {}
    },
    aiFeedback: {
        type: String,
        default: ''
    },
    aiTotalScore: {
        type: Number,
        default: 0
    }
});

// Indexes for efficient queries
submissionSchema.index({ studentId: 1, session: 1, semester: 1 });
submissionSchema.index({ assignmentId: 1, session: 1, semester: 1 });
submissionSchema.index({ status: 1, session: 1, semester: 1 });

module.exports = mongoose.model('Submission', submissionSchema);