// backend/controllers/auth.controller.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { sendEmail, emailTemplates } = require('../config/email');

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
            if (!matricNumber) return res.status(400).json({ success: false, message: 'Matric number required' });
            userData.matricNumber = matricNumber;
            userData.level = level || '500';
            // Students DO NOT get rank
        } else if (role === 'lecturer') {
            if (!staffId) return res.status(400).json({ success: false, message: 'Staff ID required' });
            userData.staffId = staffId;
            userData.rank = rank || 'Lecturer';
            // Lecturers DO NOT get level
        }
        // Admin - only basic fields, no level, no rank
        
        const user = new User(userData);
        await user.save();
        
        const token = generateToken(user._id, user.role);
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        // Send welcome email
        try {
            const emailHtml = emailTemplates.welcome(fullName, role);
            const emailSubject = `Welcome to FUTO Assignment System - ${role.charAt(0).toUpperCase() + role.slice(1)} Account`;
            
            await sendEmail(email, emailSubject, emailHtml);
            console.log(`✅ Welcome email sent to ${email}`);
        } catch (emailError) {
            console.error('❌ Failed to send welcome email:', emailError.message);
        }
        
        res.status(201).json({ 
            success: true, 
            message: 'Account created successfully. A welcome email has been sent to your email address.', 
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
        
        let user = await User.findOne({ email: identifier });
        if (!user) user = await User.findOne({ matricNumber: identifier });
        if (!user) user = await User.findOne({ staffId: identifier });
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const token = generateToken(user._id, user.role);
        
        const userResponse = user.toObject();
        delete userResponse.password;
        
        res.status(200).json({ success: true, message: 'Login successful', user: userResponse, token, role: user.role });
        
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