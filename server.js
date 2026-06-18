// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./backend/config/db');
const authRoutes = require('./backend/routes/auth.routes');
const profileRoutes = require('./backend/routes/profile.routes');
const assignmentRoutes = require('./backend/routes/assignment.routes');
const submissionRoutes = require('./backend/routes/submission.routes');
const courseRoutes = require('./backend/routes/course.routes');
const aiGradingRoutes = require('./backend/routes/aiGrading.routes');
const adminRoutes = require('./backend/routes/admin.routes');
const settingsRoutes = require('./backend/routes/settings.routes');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log all requests in development
app.use((req, res, next) => {
    console.log(`📝 ${req.method} ${req.url}`);
    next();
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api', courseRoutes);
app.use('/api/ai-grade', aiGradingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({ 
        message: 'FUTO Assignment Management API is running!',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth',
            profile: '/api/profile',
            assignments: '/api/assignments',
            submissions: '/api/submissions',
            courses: '/api/courses',
            aiGrade: '/api/ai-grade',
            admin: '/api/admin',
            settings: '/api/settings'
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: err.message || 'Internal server error' 
    });
});

// 404 handler
app.use((req, res) => {
    console.log(`❌ 404: ${req.method} ${req.url}`);
    res.status(404).json({ 
        success: false, 
        message: `Route ${req.method} ${req.url} not found` 
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📚 Available routes:`);
    console.log(`   POST /api/auth/register - Register user`);
    console.log(`   POST /api/auth/login - Login user`);
    console.log(`   POST /api/auth/lecturer-apply - Apply as lecturer`);
    console.log(`   GET /api/admin/pending-applications - Get pending applications`);
    console.log(`   PUT /api/admin/approve-lecturer/:id - Approve lecturer`);
    console.log(`   PUT /api/admin/reject-lecturer/:id - Reject lecturer`);
});