// backend/config/email.js
const nodemailer = require('nodemailer');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set as environment variables.');
}

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    family: 4, // force IPv4 — fixes ENETUNREACH on networks with broken IPv6 routing
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ... keep the rest of your emailTemplates and sendEmail exactly as before

// Email templates (same as before, just using SendGrid)
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
    },

    // OTP verification email
    otpVerification: (name, otp) => {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fb; border-radius: 10px;">
                <div style="text-align: center; padding: 20px; background-color: #2a7a4b; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">Verify Your Email</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; text-align: center;">
                    <h2 style="color: #2a7a4b;">Hello ${name},</h2>
                    <p>Use the code below to verify your email address:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2a7a4b; padding: 20px; background: #e8f5e9; border-radius: 8px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p style="color: #64748b;">This code expires in 10 minutes.</p>
                    <p style="color: #64748b;">If you didn't request this, you can safely ignore this email.</p>
                </div>
            </div>
        `;
    },

    // Sent to enrolled students when a lecturer creates an assignment
    assignmentCreated: (studentName, assignmentTitle, courseName, dueDate, dueTime, totalMarks) => {
        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f7fb; border-radius: 10px;">
                <div style="text-align: center; padding: 20px; background-color: #2a7a4b; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0;">New Assignment Posted</h1>
                </div>
                <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
                    <h2 style="color: #2a7a4b;">Hello ${studentName},</h2>
                    <p>A new assignment has been posted for one of your courses:</p>
                    <p><strong>Course:</strong> ${courseName}</p>
                    <p><strong>Assignment:</strong> ${assignmentTitle}</p>
                    <p><strong>Due:</strong> ${dueDate} at ${dueTime}</p>
                    <p><strong>Total Marks:</strong> ${totalMarks}</p>
                    <div style="margin-top: 30px; text-align: center;">
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/assgnment.html" style="background-color: #2a7a4b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Assignment</a>
                    </div>
                </div>
            </div>
        `;
    }
};

// Send email function using SendGrid
const sendEmail = async (to, subject, html) => {
    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`   Subject: ${subject}`);

    if (!sendGridApiKey) {
        console.error('❌ Cannot send email: SENDGRID_API_KEY not configured');
        return false;
    }

    try {
        const msg = {
            to: to,
            from: fromEmail, // Must be a verified sender in SendGrid
            subject: subject,
            html: html
        };

        const response = await sgMail.send(msg);
        console.log(`✅ Email sent successfully to ${to}`);
        console.log(`   Status Code: ${response[0]?.statusCode || 'N/A'}`);
        return true;
    } catch (error) {
        console.error(`❌ Email sending FAILED for ${to}:`);
        
        if (error.response) {
            console.error(`   Status: ${error.response.statusCode}`);
            console.error(`   Body: ${JSON.stringify(error.response.body, null, 2)}`);
        } else {
            console.error(`   Error: ${error.message}`);
        }
        return false;
    }
};

module.exports = { sendEmail, emailTemplates };