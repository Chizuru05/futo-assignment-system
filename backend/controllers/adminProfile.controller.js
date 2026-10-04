// backend/controllers/adminProfile.controller.js
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

const SAFE_SELECT = '-password -otp -otpExpiry';
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RULE = /^[0-9+\-\s()]{7,20}$/;

// Work out a Cloudinary public_id from a stored image URL (so old photos can be deleted)
function publicIdFromUrl(url) {
    if (!url || !url.includes('res.cloudinary.com') || !url.includes('/futo-lms/profiles/')) return null;
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/);
    return match ? decodeURIComponent(match[1]) : null;
}

async function deleteOldPicture(url) {
    const publicId = publicIdFromUrl(url);
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } catch (err) {
        console.error('Could not delete old profile picture:', err.message);
    }
}

// GET /api/admin-profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select(SAFE_SELECT);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// PUT /api/admin-profile
exports.updateProfile = async (req, res) => {
    try {
        const body = req.body || {};
        const clean = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);

        const fullName = clean(body.fullName, 100);
        const phone = clean(body.phone, 20);
        const department = clean(body.department, 100);
        const faculty = clean(body.faculty, 100);
        const gender = clean(body.gender, 10);
        const dob = clean(body.dob, 10);
        const nationality = clean(body.nationality, 60);
        const altEmail = clean(body.altEmail, 120).toLowerCase();
        const bio = clean(body.bio, 500);

        if (fullName.length < 2) {
            return res.status(400).json({ success: false, message: 'Full name must be at least 2 characters' });
        }
        if (phone && !PHONE_RULE.test(phone)) {
            return res.status(400).json({ success: false, message: 'Enter a valid phone number' });
        }
        if (altEmail && !EMAIL_RULE.test(altEmail)) {
            return res.status(400).json({ success: false, message: 'Enter a valid alternative email' });
        }
        if (gender && !['Male', 'Female'].includes(gender)) {
            return res.status(400).json({ success: false, message: 'Invalid gender value' });
        }
        if (dob) {
            const parsed = new Date(dob);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || isNaN(parsed) || parsed > new Date()) {
                return res.status(400).json({ success: false, message: 'Enter a valid date of birth' });
            }
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        user.fullName = fullName;
        user.phone = phone;
        user.department = department || user.department;
        user.faculty = faculty || user.faculty;
        user.gender = gender;
        user.dob = dob;
        user.nationality = nationality || user.nationality;
        user.altEmail = altEmail;
        user.bio = bio;

        await user.save();

        const safeUser = await User.findById(user._id).select(SAFE_SELECT);
        res.status(200).json({ success: true, message: 'Profile updated successfully', user: safeUser });

    } catch (error) {
        console.error('Update admin profile error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// POST /api/admin-profile/picture   (multipart field: avatar)
exports.uploadPicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image received' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const oldUrl = user.profilePic;
        user.profilePic = req.file.path; // Cloudinary secure URL
        await user.save();

        if (oldUrl && oldUrl !== user.profilePic) {
            deleteOldPicture(oldUrl); // fire and forget
        }

        res.status(200).json({
            success: true,
            message: 'Profile picture updated',
            profilePic: user.profilePic
        });

    } catch (error) {
        console.error('Upload admin picture error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// DELETE /api/admin-profile/picture
exports.removePicture = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const oldUrl = user.profilePic;
        user.profilePic = '';
        await user.save();

        if (oldUrl) deleteOldPicture(oldUrl);

        res.status(200).json({ success: true, message: 'Profile picture removed' });

    } catch (error) {
        console.error('Remove admin picture error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

// PUT /api/admin-profile/password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }
        if (!PASSWORD_RULE.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters with uppercase, lowercase and a number'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        const correct = await user.comparePassword(currentPassword);
        if (!correct) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        if (await user.comparePassword(newPassword)) {
            return res.status(400).json({ success: false, message: 'New password must be different from the current one' });
        }

        user.password = newPassword; // hashed by the pre-save hook in User.js
        await user.save();

        res.status(200).json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change admin password error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};