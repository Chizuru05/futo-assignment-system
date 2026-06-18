// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'lecturer', 'admin'], required: true },
    
    // Student-specific fields
    matricNumber: { type: String, unique: true, sparse: true },
    level: { type: String, enum: ['100', '200', '300', '400', '500'], default: '500' },
    
    // Lecturer-specific fields
    staffId: { type: String, unique: true, sparse: true },
    rank: { type: String, default: 'Lecturer' },
    
    // Common fields
    department: { type: String, default: 'Information Technology' },
    faculty: { type: String, default: 'Computing' },
    phone: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, default: '' },
    nationality: { type: String, default: 'Nigerian' },
    maritalStatus: { type: String, default: '' },
    altEmail: { type: String, default: '' },
    specialization: { type: String, default: '' },
    bio: { type: String, default: '' },
    research: { type: String, default: '' },
    profilePic: { type: String, default: '' },
    
    // Lecturer application fields
    isApproved: { type: Boolean, default: false },
    status: { 
        type: String, 
        enum: ['pending', 'approved', 'rejected', 'active'], 
        default: 'pending' 
    },
    isActive: { type: Boolean, default: false },
    
    // Student-specific
    stateOfOrigin: { type: String, default: '' },
    lga: { type: String, default: '' },
    personalEmail: { type: String, default: '' },
    address: { type: String, default: '' },
    admissionSession: { type: String, default: '' },
    guardianName: { type: String, default: '' },
    guardianRelation: { type: String, default: '' },
    guardianPhone: { type: String, default: '' },
    guardianEmail: { type: String, default: '' },
    guardianAddress: { type: String, default: '' },
    
    createdAt: { type: Date, default: Date.now }
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
    // Only hash if password is modified
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        console.error('Password comparison error:', error);
        return false;
    }
};

module.exports = mongoose.model('User', userSchema);