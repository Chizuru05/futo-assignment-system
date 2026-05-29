// backend/config/email.js
const nodemailer = require('nodemailer');

// Email transporter configuration with your credentials
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'qualituo4@gmail.com',
        pass: process.env.EMAIL_PASS || 'uoge sdev yynv zmag'
    }
});

// Email templates
const emailTemplates = {
    // Welcome email template
    welcome: (name, role) => {
        const roleText = role === 'student' ? 'student' : (role === 'lecturer' ? 'lecturer' : 'administrator');
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fb; border-radius: 10px;">
                <div style="text-align: center; padding: 20px; background-color: #2a7a4b; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Welcome to FUTO</h1>
                    <p style="color: #e8f5e9; margin: 5px 0 0;">Department of Information Technology</p>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #2a7a4b; margin-top: 0;">Hello ${name},</h2>
                    <p>Welcome to the FUTO IT Department Learning Management System!</p>
                    <p>Your account has been successfully created as a <strong>${roleText}</strong>.</p>
                    <p>You can now log in to the platform to:</p>
                    <ul>
                        ${role === 'student' ? `
                            <li>Register for courses</li>
                            <li>View and submit assignments</li>
                            <li>Check your grades</li>
                            <li>Track your academic progress</li>
                        ` : role === 'lecturer' ? `
                            <li>Create and manage assignments</li>
                            <li>Grade student submissions</li>
                            <li>View course analytics</li>
                            <li>Communicate with students</li>
                        ` : `
                            <li>Manage the platform</li>
                            <li>Oversee all users and courses</li>
                            <li>Generate reports</li>
                        `}
                    </ul>
                    <p>If you have any questions, please contact the IT department.</p>
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b;">
                        <p>© 2025 FUTO Department of Information Technology</p>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Submission confirmation email
    submissionConfirmation: (studentName, assignmentTitle, courseName, submittedDate, fileCount) => {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fb; border-radius: 10px;">
                <div style="text-align: center; padding: 20px; background-color: #2a7a4b; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Submission Received</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #2a7a4b;">Hello ${studentName},</h2>
                    <p>Your assignment submission has been received successfully!</p>
                    <p><strong>Course:</strong> ${courseName}</p>
                    <p><strong>Assignment:</strong> ${assignmentTitle}</p>
                    <p><strong>Submitted on:</strong> ${submittedDate}</p>
                    <p><strong>Files uploaded:</strong> ${fileCount}</p>
                    <p>Your submission will be reviewed by your lecturer. You will receive a notification when grades are released.</p>
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/assgnment.html" style="background-color: #2a7a4b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Submissions</a>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Grade released email
    gradeReleased: (studentName, assignmentTitle, courseName, score, totalMarks, percentage, feedback) => {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fb; border-radius: 10px;">
                <div style="text-align: center; padding: 20px; background-color: #2a7a4b; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Grade Released</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #2a7a4b;">Hello ${studentName},</h2>
                    <p>Your grade for the following assignment has been released:</p>
                    <p><strong>Course:</strong> ${courseName}</p>
                    <p><strong>Assignment:</strong> ${assignmentTitle}</p>
                    <p><strong>Your Score:</strong> ${score}/${totalMarks} (${percentage}%)</p>
                    <p><strong>Feedback:</strong> ${feedback || 'No specific feedback provided.'}</p>
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/assgnment.html" style="background-color: #2a7a4b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Grades</a>
                    </div>
                </div>
            </div>
        `;
    }
};

// Send email function
const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: `"FUTO IT Department" <${process.env.EMAIL_USER || 'qualituo4@gmail.com'}>`,
            to,
            subject,
            html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email error:', error);
        return false;
    }
};

module.exports = { sendEmail, emailTemplates };