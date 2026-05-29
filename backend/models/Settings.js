// backend/models/Settings.js
const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    activeSession: {
        type: String,
        required: true,
        default: '2025-2026'
    },
    activeSemester: {
        type: String,
        enum: ['Harmattan', 'Rain'],
        required: true,
        default: 'Harmattan'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Singleton pattern - only one settings document
settingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({
            activeSession: '2025-2026',
            activeSemester: 'Harmattan'
        });
    }
    return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);