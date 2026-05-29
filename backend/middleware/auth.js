// backend/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided. Please login.'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'futo_secret_key');
        
        // Find user by id and ensure token matches stored role
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found. Please login again.'
            });
        }
        
        // Verify role matches if specified in token
        if (decoded.role && user.role !== decoded.role) {
            return res.status(403).json({
                success: false,
                message: 'Role mismatch. Please login again.'
            });
        }
        
        req.user = user;
        req.token = token;
        next();
        
    } catch (error) {
        console.error('Auth error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please login again.'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please login again.'
            });
        }
        
        res.status(401).json({
            success: false,
            message: 'Authentication failed. Please login.'
        });
    }
};

// Role-specific middleware
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. ${roles.join(' or ')} role required.`
            });
        }
        
        next();
    };
};

module.exports = { authMiddleware, requireRole };