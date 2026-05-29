// backend/controllers/settings.controller.js
const Settings = require('../models/Settings');

// Get current settings
exports.getSettings = async (req, res) => {
    try {
        const settings = await Settings.getSettings();
        res.status(200).json({
            success: true,
            settings: {
                activeSession: settings.activeSession,
                activeSemester: settings.activeSemester,
                updatedAt: settings.updatedAt
            }
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Update settings (admin only)
exports.updateSettings = async (req, res) => {
    try {
        const { activeSession, activeSemester } = req.body;
        
        if (!activeSession || !activeSemester) {
            return res.status(400).json({
                success: false,
                message: 'Active session and semester are required'
            });
        }
        
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings();
        }
        
        settings.activeSession = activeSession;
        settings.activeSemester = activeSemester;
        settings.updatedBy = req.user.id;
        settings.updatedAt = new Date();
        
        await settings.save();
        
        res.status(200).json({
            success: true,
            message: 'Settings updated successfully',
            settings: {
                activeSession: settings.activeSession,
                activeSemester: settings.activeSemester
            }
        });
        
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};