// backend/controllers/lecturerApplication.controller.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Submit lecturer application
exports.applyLecturer = async (req, res) => {
    try {
        const { fullName, email, staffId, department, rank, specialization, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ $or: [{ email }, { staffId }] });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'A user with this email or staff ID already exists.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create pending lecturer
        const lecturer = new User({
            fullName,
            email,
            password: hashedPassword,
            staffId,
            department,
            rank,
            specialization,
            role: 'lecturer',
            isActive: false,
            isApproved: false,
            status: 'pending'
        });

        await lecturer.save();

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully. Awaiting admin approval.',
            data: {
                id: lecturer._id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                staffId: lecturer.staffId,
                status: lecturer.status
            }
        });
    } catch (error) {
        console.error('Lecturer application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application.',
            error: error.message
        });
    }
};

// Get all pending applications (Admin only)
exports.getPendingApplications = async (req, res) => {
    try {
        const pendingLecturers = await User.find({
            role: 'lecturer',
            isApproved: false,
            status: 'pending'
        }).select('-password');

        res.status(200).json({
            success: true,
            count: pendingLecturers.length,
            data: pendingLecturers
        });
    } catch (error) {
        console.error('Get pending applications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending applications.',
            error: error.message
        });
    }
};

// Approve lecturer application (Admin only)
exports.approveLecturer = async (req, res) => {
    try {
        const { id } = req.params;

        const lecturer = await User.findById(id);
        if (!lecturer) {
            return res.status(404).json({
                success: false,
                message: 'Lecturer not found.'
            });
        }

        if (lecturer.role !== 'lecturer') {
            return res.status(400).json({
                success: false,
                message: 'User is not a lecturer.'
            });
        }

        lecturer.isActive = true;
        lecturer.isApproved = true;
        lecturer.status = 'approved';
        await lecturer.save();

        // TODO: Send email notification to lecturer

        res.status(200).json({
            success: true,
            message: 'Lecturer application approved successfully.',
            data: {
                id: lecturer._id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                staffId: lecturer.staffId,
                status: lecturer.status
            }
        });
    } catch (error) {
        console.error('Approve lecturer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to approve lecturer.',
            error: error.message
        });
    }
};

// Reject lecturer application (Admin only)
exports.rejectLecturer = async (req, res) => {
    try {
        const { id } = req.params;

        const lecturer = await User.findById(id);
        if (!lecturer) {
            return res.status(404).json({
                success: false,
                message: 'Lecturer not found.'
            });
        }

        if (lecturer.role !== 'lecturer') {
            return res.status(400).json({
                success: false,
                message: 'User is not a lecturer.'
            });
        }

        lecturer.status = 'rejected';
        lecturer.isActive = false;
        lecturer.isApproved = false;
        await lecturer.save();

        // TODO: Send email notification to lecturer

        res.status(200).json({
            success: true,
            message: 'Lecturer application rejected.',
            data: {
                id: lecturer._id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                staffId: lecturer.staffId,
                status: lecturer.status
            }
        });
    } catch (error) {
        console.error('Reject lecturer error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reject lecturer.',
            error: error.message
        });
    }
};

// Create admin (Admin only)
exports.createAdmin = async (req, res) => {
    try {
        const { fullName, email, password, department, secretCode } = req.body;

        // Verify admin secret code
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'FUTO-ADMIN-2025';
        if (secretCode !== ADMIN_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'Invalid admin secret code.'
            });
        }

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'Admin with this email already exists.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin
        const admin = new User({
            fullName,
            email,
            password: hashedPassword,
            department,
            role: 'admin',
            isActive: true,
            isApproved: true,
            status: 'active'
        });

        await admin.save();

        res.status(201).json({
            success: true,
            message: 'Admin created successfully.',
            data: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create admin.',
            error: error.message
        });
    }
};