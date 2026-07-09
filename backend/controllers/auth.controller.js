// backend/controllers/auth.controller.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendEmail, emailTemplates } = require('../config/email');

const generateToken = (id, role) => {
    return jwt.sign({ id, role }, process.env.JWT_SECRET || 'futo_secret_key', {
        expiresIn: '30d'
    });
};

function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

// Register user
exports.register = async (req, res) => {
    try {
        const { fullName, email, password, role, matricNumber, level, staffId, rank, department } = req.body;

        console.log('=== REGISTRATION REQUEST ===');
        console.log('Role:', role);
        console.log('Email:', email);

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }

        let userData = {
            fullName,
            email,
            password,
            role,
            department: department || 'Information Technology',
            emailVerified: false
        };

        if (role === 'student') {
            if (!matricNumber) {
                return res.status(400).json({ success: false, message: 'Matric number required' });
            }
            if (matricNumber.length !== 11 || !/^[0-9]+$/.test(matricNumber) || !matricNumber.endsWith('2')) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid matric number. Must be exactly 11 digits and end with 2 (e.g., 20211263362)'
                });
            }
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

        // Generate OTP
        const otp = generateOTP();
        userData.otp = otp;
        userData.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const user = new User(userData);
        await user.save();

        // Send OTP email — failure here shouldn't block account creation
        try {
            await sendEmail(
                user.email,
                'Verify Your Email - FUTO IT Department',
                emailTemplates.otpVerification(user.fullName, otp)
            );
            console.log('✅ OTP email sent to', user.email);
        } catch (emailErr) {
            console.error('❌ OTP email failed:', emailErr.message);
        }

        // No token yet — must verify email first
        res.status(201).json({
            success: true,
            message: 'Account created. Please check your email for a verification code.',
            email: user.email,
            requiresVerification: true
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ success: false, message: 'Email and code are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.emailVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        if (!user.otp || user.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid verification code' });
        }

        if (!user.otpExpiry || user.otpExpiry < new Date()) {
            return res.status(400).json({ success: false, message: 'Verification code expired. Please request a new one.' });
        }

        user.emailVerified = true;
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        // Send welcome email now that they're verified — non-blocking
        sendEmail(
            user.email,
            'Welcome to FUTO IT Department',
            emailTemplates.welcome(user.fullName, user.role)
        ).catch(err => console.error('Welcome email failed:', err.message));

        // Lecturers still need admin approval before they can log in
        if (user.role === 'lecturer') {
            return res.status(200).json({
                success: true,
                message: 'Email verified! Your account is now awaiting admin approval before you can log in.',
                requiresApproval: true
            });
        }

        const token = generateToken(user._id, user.role);
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            message: 'Email verified successfully',
            user: userResponse,
            token,
            role: user.role
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        if (user.emailVerified) {
            return res.status(400).json({ success: false, message: 'Email already verified' });
        }

        const otp = generateOTP();
        user.otp = otp;
        user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await sendEmail(
            user.email,
            'Verify Your Email - FUTO IT Department',
            emailTemplates.otpVerification(user.fullName, otp)
        );

        res.status(200).json({ success: true, message: 'Verification code resent' });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        console.log('=== LOGIN REQUEST ===');
        console.log('Identifier:', identifier);

        let user = await User.findOne({ email: identifier });
        if (!user) user = await User.findOne({ matricNumber: identifier });
        if (!user) user = await User.findOne({ staffId: identifier });

        if (!user) {
            console.log('❌ User not found:', identifier);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        console.log('✅ User found:', user.fullName, '| Role:', user.role);

        // Block unverified emails
        if (!user.emailVerified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email before logging in.',
                requiresVerification: true,
                email: user.email
            });
        }

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

exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.logout = async (req, res) => {
    res.status(200).json({ success: true, message: 'Logged out successfully' });
};