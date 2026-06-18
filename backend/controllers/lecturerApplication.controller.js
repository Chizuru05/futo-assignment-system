// backend/controllers/lecturerApplication.controller.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Submit lecturer application
exports.applyLecturer = async (req, res) => {
    try {
        const { fullName, email, staffId, department, rank, specialization, password } = req.body;

        console.log('=== LECTURER APPLICATION SUBMISSION ===');
        console.log('Name:', fullName);
        console.log('Email:', email);
        console.log('Staff ID:', staffId);
        console.log('Rank:', rank);

        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email }, { staffId }] 
        });
        
        if (existingUser) {
            console.log('❌ User already exists:', existingUser.email);
            return res.status(400).json({
                success: false,
                message: 'A user with this email or staff ID already exists.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create pending lecturer with all required fields
        const lecturer = new User({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            staffId: staffId.trim(),
            department: department || 'Information Technology',
            rank: rank || 'Lecturer',
            specialization: specialization || '',
            role: 'lecturer',
            isActive: false,
            isApproved: false,
            status: 'pending'
        });

        await lecturer.save();
        
        console.log('✅ Lecturer application saved successfully!');
        console.log('   ID:', lecturer._id);
        console.log('   Name:', lecturer.fullName);
        console.log('   Status:', lecturer.status);

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
        console.error('❌ Lecturer application error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application.',
            error: error.message
        });
    }
};

// Get ALL applications (Admin only) - UPDATED to return all applications
exports.getPendingApplications = async (req, res) => {
    try {
        console.log('=== FETCHING ALL LECTURER APPLICATIONS ===');
        
        // Get ALL lecturers (not just pending)
        const allLecturers = await User.find({
            role: 'lecturer'
        }).select('-password').sort({ createdAt: -1 });

        const pending = allLecturers.filter(l => l.status === 'pending' || l.isApproved === false);
        const approved = allLecturers.filter(l => l.status === 'approved' || l.isApproved === true);

        console.log(`✅ Total: ${allLecturers.length} | Pending: ${pending.length} | Approved: ${approved.length}`);
        
        if (allLecturers.length > 0) {
            allLecturers.forEach((lecturer, index) => {
                console.log(`   ${index + 1}. ${lecturer.fullName} (${lecturer.email}) - Status: ${lecturer.status || 'pending'}`);
            });
        }

        res.status(200).json({
            success: true,
            count: allLecturers.length,
            data: allLecturers,
            stats: {
                pending: pending.length,
                approved: approved.length,
                total: allLecturers.length
            }
        });
    } catch (error) {
        console.error('❌ Get applications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch applications.',
            error: error.message
        });
    }
};

// Approve lecturer application (Admin only)
exports.approveLecturer = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('=== APPROVING LECTURER APPLICATION ===');
        console.log('ID:', id);

        const lecturer = await User.findById(id);
        
        if (!lecturer) {
            console.log('❌ Lecturer not found');
            return res.status(404).json({
                success: false,
                message: 'Lecturer not found.'
            });
        }

        if (lecturer.role !== 'lecturer') {
            console.log('❌ User is not a lecturer');
            return res.status(400).json({
                success: false,
                message: 'User is not a lecturer.'
            });
        }

        if (lecturer.status === 'approved') {
            console.log('⚠️ Lecturer already approved');
            return res.status(400).json({
                success: false,
                message: 'This lecturer has already been approved.'
            });
        }

        // Update lecturer status
        lecturer.isActive = true;
        lecturer.isApproved = true;
        lecturer.status = 'approved';
        await lecturer.save();

        console.log('✅ Lecturer approved successfully!');
        console.log('   Name:', lecturer.fullName);
        console.log('   Email:', lecturer.email);
        console.log('   Staff ID:', lecturer.staffId);

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
        console.error('❌ Approve lecturer error:', error);
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

        console.log('=== REJECTING LECTURER APPLICATION ===');
        console.log('ID:', id);

        const lecturer = await User.findById(id);
        
        if (!lecturer) {
            console.log('❌ Lecturer not found');
            return res.status(404).json({
                success: false,
                message: 'Lecturer not found.'
            });
        }

        if (lecturer.role !== 'lecturer') {
            console.log('❌ User is not a lecturer');
            return res.status(400).json({
                success: false,
                message: 'User is not a lecturer.'
            });
        }

        if (lecturer.status === 'rejected') {
            console.log('⚠️ Lecturer already rejected');
            return res.status(400).json({
                success: false,
                message: 'This lecturer has already been rejected.'
            });
        }

        // Update lecturer status
        lecturer.status = 'rejected';
        lecturer.isActive = false;
        lecturer.isApproved = false;
        await lecturer.save();

        console.log('❌ Lecturer rejected');
        console.log('   Name:', lecturer.fullName);
        console.log('   Email:', lecturer.email);

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
        console.error('❌ Reject lecturer error:', error);
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

        console.log('=== CREATING ADMIN ===');
        console.log('Name:', fullName);
        console.log('Email:', email);

        // Verify admin secret code
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'FUTO-ADMIN-2025';
        if (secretCode !== ADMIN_SECRET) {
            console.log('❌ Invalid admin secret code');
            return res.status(403).json({
                success: false,
                message: 'Invalid admin secret code.'
            });
        }

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log('❌ Admin already exists');
            return res.status(400).json({
                success: false,
                message: 'Admin with this email already exists.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin
        const admin = new User({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            department: department || 'Information Technology',
            role: 'admin',
            isActive: true,
            isApproved: true,
            status: 'active'
        });

        await admin.save();

        console.log('✅ Admin created successfully!');
        console.log('   Name:', admin.fullName);
        console.log('   Email:', admin.email);

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
        console.error('❌ Create admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create admin.',
            error: error.message
        });
    }
};