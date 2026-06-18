// backend/controllers/lecturerApplication.controller.js
const User = require('../models/User');

// Submit lecturer application
exports.applyLecturer = async (req, res) => {
    try {
        const { fullName, email, staffId, department, rank, specialization, password } = req.body;

        console.log('=== LECTURER APPLICATION SUBMISSION ===');
        console.log('Name:', fullName);
        console.log('Email:', email);
        console.log('Staff ID:', staffId);
        console.log('Rank:', rank);

        const existingUser = await User.findOne({ $or: [{ email }, { staffId }] });
        if (existingUser) {
            console.log('❌ User already exists:', existingUser.email);
            return res.status(400).json({
                success: false,
                message: 'A user with this email or staff ID already exists.'
            });
        }

        // DO NOT hash password manually — User model pre-save hook handles it
        const lecturer = new User({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password: password,        // plain text — model will hash it
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

// Get ALL applications (Admin only)
exports.getPendingApplications = async (req, res) => {
    try {
        console.log('=== FETCHING ALL LECTURER APPLICATIONS ===');

        const allLecturers = await User.find({ role: 'lecturer' })
            .select('-password')
            .sort({ createdAt: -1 });

        const pending = allLecturers.filter(l => l.status === 'pending' || l.isApproved === false);
        const approved = allLecturers.filter(l => l.status === 'approved' || l.isApproved === true);

        console.log(`✅ Total: ${allLecturers.length} | Pending: ${pending.length} | Approved: ${approved.length}`);

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

// Approve lecturer (Admin only)
exports.approveLecturer = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== APPROVING LECTURER ===', id);

        const lecturer = await User.findById(id);
        if (!lecturer) {
            return res.status(404).json({ success: false, message: 'Lecturer not found.' });
        }
        if (lecturer.role !== 'lecturer') {
            return res.status(400).json({ success: false, message: 'User is not a lecturer.' });
        }
        if (lecturer.status === 'approved') {
            return res.status(400).json({ success: false, message: 'Already approved.' });
        }

        lecturer.isActive = true;
        lecturer.isApproved = true;
        lecturer.status = 'approved';

        // Use updateOne to avoid triggering pre-save password re-hash
        await User.updateOne(
            { _id: id },
            { $set: { isActive: true, isApproved: true, status: 'approved' } }
        );

        console.log('✅ Lecturer approved:', lecturer.fullName);

        res.status(200).json({
            success: true,
            message: 'Lecturer approved successfully.',
            data: {
                id: lecturer._id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                staffId: lecturer.staffId,
                status: 'approved'
            }
        });
    } catch (error) {
        console.error('❌ Approve error:', error);
        res.status(500).json({ success: false, message: 'Failed to approve.', error: error.message });
    }
};

// Reject lecturer (Admin only)
exports.rejectLecturer = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('=== REJECTING LECTURER ===', id);

        const lecturer = await User.findById(id);
        if (!lecturer) {
            return res.status(404).json({ success: false, message: 'Lecturer not found.' });
        }
        if (lecturer.role !== 'lecturer') {
            return res.status(400).json({ success: false, message: 'User is not a lecturer.' });
        }
        if (lecturer.status === 'rejected') {
            return res.status(400).json({ success: false, message: 'Already rejected.' });
        }

        await User.updateOne(
            { _id: id },
            { $set: { isActive: false, isApproved: false, status: 'rejected' } }
        );

        console.log('❌ Lecturer rejected:', lecturer.fullName);

        res.status(200).json({
            success: true,
            message: 'Lecturer application rejected.',
            data: {
                id: lecturer._id,
                fullName: lecturer.fullName,
                email: lecturer.email,
                staffId: lecturer.staffId,
                status: 'rejected'
            }
        });
    } catch (error) {
        console.error('❌ Reject error:', error);
        res.status(500).json({ success: false, message: 'Failed to reject.', error: error.message });
    }
};

// Create admin (Admin only)
exports.createAdmin = async (req, res) => {
    try {
        const { fullName, email, password, department, secretCode } = req.body;

        console.log('=== CREATING ADMIN ===');
        console.log('Email:', email);

        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'FUTO-ADMIN-2025';
        if (secretCode !== ADMIN_SECRET) {
            return res.status(403).json({ success: false, message: 'Invalid admin secret code.' });
        }

        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Admin with this email already exists.' });
        }

        // DO NOT hash manually — model pre-save hook handles it
        const admin = new User({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            password: password,        // plain text — model will hash it
            department: department || 'Information Technology',
            role: 'admin',
            isActive: true,
            isApproved: true,
            status: 'active'
        });

        await admin.save();

        console.log('✅ Admin created:', admin.fullName);

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
        res.status(500).json({ success: false, message: 'Failed to create admin.', error: error.message });
    }
};