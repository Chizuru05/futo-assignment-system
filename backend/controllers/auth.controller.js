// backend/controllers/auth.controller.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET || 'futo_secret_key', {
        expiresIn: '30d'
    });
};

// Register user
exports.register = async (req, res) => {
    try {
        const { fullName, email, password, role, matricNumber, level, staffId, rank, department } = req.body;

        console.log('=== REGISTRATION REQUEST ===');
        console.log('Role:', role);
        console.log('Email:', email);

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        let userData = {
            fullName,
            email,
            password,
            role,
            department: department || 'Information Technology'
        };

        if (role === 'student') {
            if (!matricNumber) {
                return res.status(400).json({ success: false, message: 'Matric number required' });
            }

            // Validate matric: exactly 11 digits, starts with 2021, ends with 2
            if (matricNumber.length !== 11 ||
                !/^[0-9]+$/.test(matricNumber) ||
                !matricNumber.endsWith('2')
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid matric number. Must be exactly 11 digits and end with 2 (e.g., 20211263362)'
                });
            }

            // Check if matric already exists
            const existingMatric = await User.findOne({ matricNumber });
            if (existingMatric) {
                return res.status(400).json({ success: false, message: 'Matric number already registered' });
            }

            userData.matricNumber = matricNumber;
            userData.level = level || '500';

        } else if (role === 'lecturer') {
            if (!staffId) {
                return res.status(400).json({ success: false, message: 'Staff ID required' });
            }
            userData.staffId = staffId;
            userData.rank = rank || 'Lecturer';
        }

        const user = new User(userData);
        await user.save();

        const token = generateToken(user._id, user.role);

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json({
            success: true,
            message: 'Account created successfully.',
            user: userResponse,
            token,
            role: user.role
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        console.log('=== LOGIN REQUEST ===');
        console.log('Identifier:', identifier);

        // Find user by email, matricNumber, or staffId
        let user = await User.findOne({ email: identifier });
        if (!user) user = await User.findOne({ matricNumber: identifier });
        if (!user) user = await User.findOne({ staffId: identifier });

        if (!user) {
            console.log('❌ User not found:', identifier);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        console.log('✅ User found:', user.fullName, '| Role:', user.role);

        // Check lecturer approval
        if (user.role === 'lecturer') {
            if (!user.isApproved) {
                return res.status(401).json({
                    success: false,
                    message: 'Your account is pending approval. Please wait for admin approval.'
                });
            }
            if (!user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'Your account is not active. Please contact admin.'
                });
            }
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match:', isMatch);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(user._id, user.role);

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: userResponse,
            token,
            role: user.role
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Logout
exports.logout = async (req, res) => {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};