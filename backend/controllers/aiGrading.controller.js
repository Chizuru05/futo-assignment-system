// backend/controllers/aiGrading.controller.js
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const { generateAIGrade } = require('../config/gemini');

// AI Grade a single submission
exports.aiGradeSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;
        const lecturerId = req.user.id;
        
        console.log('=== AI GRADING REQUEST ===');
        console.log('Submission ID:', submissionId);
        console.log('Lecturer ID:', lecturerId);
        
        // Validate submissionId format
        if (!submissionId || submissionId.length !== 24) {
            return res.status(400).json({
                success: false,
                message: 'Invalid submission ID format'
            });
        }
        
        // Find submission
        const submission = await Submission.findById(submissionId)
            .populate('assignmentId', 'title rubric totalMarks course');
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }
        
        // Check if already graded
        if (submission.status === 'graded') {
            return res.status(400).json({
                success: false,
                message: 'Submission is already graded'
            });
        }
        
        const assignment = submission.assignmentId;
        const rubric = assignment.rubric || [];
        const totalMarks = assignment.totalMarks || 100;
        
        console.log('Assignment:', assignment.title);
        console.log('Rubric items:', rubric.length);
        
        // Generate AI grade
        const aiResult = await generateAIGrade({
            studentName: submission.studentName,
            assignmentTitle: assignment.title,
            courseName: assignment.course,
            fileContent: `Student: ${submission.studentName}\nAssignment: ${assignment.title}`,
            rubric: rubric,
            totalMarks: totalMarks
        });
        
        // Store AI results in submission (not yet saved as final grade)
        submission.aiScores = aiResult.scores;
        submission.aiFeedback = aiResult.feedback;
        submission.aiTotalScore = aiResult.totalScore;
        await submission.save();
        
        console.log('AI grading completed. Total score:', aiResult.totalScore);
        
        // Return the AI results
        res.status(200).json({
            success: true,
            message: 'AI grading completed',
            aiResult: {
                scores: aiResult.scores,
                feedback: aiResult.feedback,
                totalScore: aiResult.totalScore,
                criterionFeedback: aiResult.criterionFeedback || {}
            }
        });
        
    } catch (error) {
        console.error('AI grading error:', error);
        res.status(500).json({
            success: false,
            message: 'AI grading failed: ' + error.message
        });
    }
};

// AI Grade all pending submissions for an assignment
exports.aiGradeAllSubmissions = async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const lecturerId = req.user.id;
        
        console.log('=== AI GRADE ALL SUBMISSIONS ===');
        console.log('Assignment ID:', assignmentId);
        
        // Check if assignment exists
        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }
        
        // Verify ownership
        if (assignment.lecturerId.toString() !== lecturerId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // Get pending submissions
        const submissions = await Submission.find({
            assignmentId,
            status: 'pending'
        });
        
        if (submissions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No pending submissions found',
                graded: 0
            });
        }
        
        let graded = 0;
        let failed = 0;
        
        for (const submission of submissions) {
            try {
                const rubric = assignment.rubric || [];
                const totalMarks = assignment.totalMarks || 100;
                
                const aiResult = await generateAIGrade({
                    studentName: submission.studentName,
                    assignmentTitle: assignment.title,
                    courseName: assignment.course,
                    fileContent: `Student: ${submission.studentName}`,
                    rubric: rubric,
                    totalMarks: totalMarks
                });
                
                submission.aiScores = aiResult.scores;
                submission.aiFeedback = aiResult.feedback;
                submission.aiTotalScore = aiResult.totalScore;
                await submission.save();
                
                graded++;
            } catch (err) {
                console.error(`Failed to grade submission ${submission._id}:`, err.message);
                failed++;
            }
        }
        
        res.status(200).json({
            success: true,
            message: `AI grading completed: ${graded} graded, ${failed} failed`,
            graded,
            failed
        });
        
    } catch (error) {
        console.error('AI grade all error:', error);
        res.status(500).json({
            success: false,
            message: 'AI grading failed: ' + error.message
        });
    }
};

// Get AI grading status
exports.getGradingStatus = async (req, res) => {
    try {
        const { submissionId } = req.params;
        
        const submission = await Submission.findById(submissionId)
            .select('aiScores aiFeedback aiTotalScore status');
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }
        
        res.status(200).json({
            success: true,
            hasAIGrade: !!(submission.aiScores && Object.keys(submission.aiScores).length > 0),
            aiResult: {
                scores: submission.aiScores || {},
                feedback: submission.aiFeedback || '',
                totalScore: submission.aiTotalScore || 0
            },
            status: submission.status
        });
        
    } catch (error) {
        console.error('Get grading status error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
};