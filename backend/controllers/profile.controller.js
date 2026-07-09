const User = require('../models/User');
const bcrypt = require('bcryptjs');

exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const updates = req.body;
        
        const allowedUpdates = [
            'fullName', 'phone', 'dob', 'gender', 'nationality',
            'stateOfOrigin', 'lga', 'personalEmail', 'address',
            'guardianName', 'guardianRelation', 'guardianPhone',
            'guardianEmail', 'guardianAddress',
            'maritalStatus', 'altEmail', 'department', 'faculty',
            'specialization', 'bio', 'research', 'rank'
        ];
        
        const filteredUpdates = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                filteredUpdates[key] = updates[key];
            }
        }
        
        const user = await User.findByIdAndUpdate(
            userId,
            filteredUpdates,
            { new: true, runValidators: false }
        ).select('-password');
        
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        res.status(200).json({ success: true, message: 'Profile updated successfully', user });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

exports.updateProfilePicture = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        const profilePicUrl = req.file.path; // Cloudinary secure URL, ready to use as-is

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { profilePic: profilePicUrl },
            { new: true }
        ).select('-password');

        res.status(200).json({ success: true, message: 'Profile picture updated', profilePic: profilePicUrl, user });
    } catch (error) {
        console.error('Update profile picture error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Both current and new password are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        }
        const user = await User.findById(req.user.id);
        const isValid = await user.comparePassword(currentPassword);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        user.password = newPassword;
        await user.save();
        res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};