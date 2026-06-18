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
            if (!matricNumber) return res.status(400).json({ success: false, message: 'Matric number required' });
            userData.matricNumber = matricNumber;
            userData.level = level || '500';
        } else if (role === 'lecturer') {
            if (!staffId) return res.status(400).json({ success: false, message: 'Staff ID required' });
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
        console.log('Password provided:', password ? 'Yes' : 'No');
        
        // Find user by email, matricNumber, or staffId
        let user = await User.findOne({ email: identifier });
        if (!user) user = await User.findOne({ matricNumber: identifier });
        if (!user) user = await User.findOne({ staffId: identifier });
        
        if (!user) {
            console.log('❌ User not found for identifier:', identifier);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        console.log('✅ User found:', user.fullName);
        console.log('Role:', user.role);
        console.log('Status:', user.status);
        console.log('isActive:', user.isActive);
        console.log('isApproved:', user.isApproved);
        console.log('Email:', user.email);
        console.log('Staff ID:', user.staffId);
        console.log('Matric Number:', user.matricNumber);
        
        // Check if user is active (for lecturers, check if approved)
        if (user.role === 'lecturer') {
            if (!user.isApproved) {
                console.log('❌ Lecturer not approved');
                return res.status(401).json({ 
                    success: false, 
                    message: 'Your account is pending approval. Please wait for admin approval.' 
                });
            }
            if (!user.isActive) {
                console.log('❌ Lecturer not active');
                return res.status(401).json({ 
                    success: false, 
                    message: 'Your account is not active. Please contact admin.' 
                });
            }
            console.log('✅ Lecturer is approved and active');
        }
        
        // Check password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log('Password match result:', isMatch);
        
        if (!isMatch) {
            console.log('❌ Password does not match');
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        console.log('✅ Password matched! Login successful for:', user.fullName);
        
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