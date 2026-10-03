// backend/controllers/aiGrading.controller.js
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const { generateAIGrade } = require('../config/gemini');
const { extractText } = require('../utils/extractText');

const MAX_TOTAL_BYTES = 18 * 1024 * 1024; // Gemini inline request limit is ~20MB
const MAX_TEXT_CHARS = 60000;
const INLINE_MIME = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp'
};

// Download the student's files from Cloudinary and prepare them for Gemini
async function readSubmissionFiles(submission) {
    const attachments = [];
    const textSections = [];
    const skipped = [];
    let totalBytes = 0;

    for (const file of submission.files || []) {
        const name = file.name || file.originalName || 'file';
        const ext = (name.split('.').pop() || '').toLowerCase();

        const isInline = !!INLINE_MIME[ext];
        const isText = ['docx', 'txt'].includes(ext);
        if (!isInline && !isText) {
            skipped.push(`${name} (.${ext} files can't be read by the AI)`);
            continue;
        }

        const response = await fetch(file.path);
        if (!response.ok) {
            const hint = response.status === 401 || response.status === 403
                ? ' In Cloudinary go to Settings > Security and enable "Allow delivery of PDF and ZIP files".'
                : '';
            const err = new Error(`Could not read "${name}" (HTTP ${response.status}).${hint}`);
            err.status = 502;
            throw err;
        }

        const buffer = Buffer.from(await response.arrayBuffer());

        if (isInline) {
            if (totalBytes + buffer.length > MAX_TOTAL_BYTES) {
                skipped.push(`${name} (too large for AI, max ~18MB total)`);
                continue;
            }
            totalBytes += buffer.length;
            attachments.push({ name, mimeType: INLINE_MIME[ext], base64: buffer.toString('base64') });
        } else {
            try {
                const text = await extractText({ buffer, originalname: name, mimetype: '' });
                if (text) textSections.push({ name, text: text.slice(0, MAX_TEXT_CHARS) });
                else skipped.push(`${name} (no readable text)`);
            } catch (e) {
                skipped.push(`${name} (${e.message})`);
            }
        }
    }

    return { attachments, textSections, skipped };
}

// Grade one submission and save the AI result on it
async function gradeOne(submission, assignment) {
    const { attachments, textSections, skipped } = await readSubmissionFiles(submission);

    if (attachments.length === 0 && textSections.length === 0) {
        const err = new Error(
            `No readable submission files.${skipped.length ? ' Skipped: ' + skipped.join('; ') : ''}`
        );
        err.status = 422;
        throw err;
    }

    const script = assignment.markingScheme?.hasScript ? (assignment.markingScheme.text || '') : '';

    const aiResult = await generateAIGrade({
        assignmentTitle: assignment.title,
        courseName: assignment.courseName || assignment.course,
        description: assignment.description,
        rubric: assignment.rubric || [],
        totalMarks: assignment.totalMarks || 100,
        markingScript: script,
        strictness: assignment.markingScheme?.strictness || 'balanced',
        attachments,
        textSections
    });

    submission.aiScores = aiResult.scores;
    submission.aiFeedback = aiResult.feedback;
    submission.aiTotalScore = aiResult.totalScore;
    await submission.save();

    return {
        ...aiResult,
        usedMarkingScript: !!script,
        skippedFiles: skipped
    };
}

function canGrade(assignment, user) {
    return assignment.lecturerId.toString() === user.id || user.role === 'admin';
}

// AI grade a single submission
exports.aiGradeSubmission = async (req, res) => {
    try {
        const { submissionId } = req.params;

        if (!submissionId || submissionId.length !== 24) {
            return res.status(400).json({ success: false, message: 'Invalid submission ID format' });
        }

        const submission = await Submission.findById(submissionId);
        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }

        // '+markingScheme.text' alone keeps every other field (it's select:false by default)
        const assignment = await Assignment.findById(submission.assignmentId).select('+markingScheme.text');
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        if (!canGrade(assignment, req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Re-grading is allowed only when the lecturer used "Edit Grade" (frontend sends regrade: true)
        const regrade = req.body?.regrade === true || req.body?.force === true;
        if (submission.status === 'graded' && !regrade) {
            return res.status(400).json({
                success: false,
                message: 'Submission is already graded. Click "Edit Grade" first to re-grade it.'
            });
        }

        console.log(`AI grading submission ${submissionId} (${assignment.title}), marking script: ${!!assignment.markingScheme?.hasScript}`);

        const aiResult = await gradeOne(submission, assignment);

        res.status(200).json({
            success: true,
            message: 'AI grading completed',
            aiResult: {
                scores: aiResult.scores,
                maxScores: aiResult.maxScores,
                feedback: aiResult.feedback,
                totalScore: aiResult.totalScore,
                criterionFeedback: aiResult.criterionFeedback,
                lowConfidence: aiResult.lowConfidence,
                warnings: [...aiResult.warnings, ...aiResult.skippedFiles.map(f => `Skipped: ${f}`)],
                usedMarkingScript: aiResult.usedMarkingScript
            }
        });

    } catch (error) {
        console.error('AI grading error:', error.message);
        const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
        const friendly = status === 429
            ? 'The AI is busy right now. Wait a minute and try again.'
            : error.message;
        res.status(status).json({ success: false, message: friendly });
    }
};

// AI grade all pending submissions for an assignment (one at a time, results saved as AI drafts only)
exports.aiGradeAllSubmissions = async (req, res) => {
    try {
        const { assignmentId } = req.params;

        const assignment = await Assignment.findById(assignmentId).select('+markingScheme.text');
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }
        if (!canGrade(assignment, req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const submissions = await Submission.find({ assignmentId, status: 'pending' });
        if (submissions.length === 0) {
            return res.status(200).json({ success: true, message: 'No pending submissions found', graded: 0, failed: 0 });
        }

        let graded = 0;
        const failures = [];

        for (const submission of submissions) {
            try {
                await gradeOne(submission, assignment);
                graded++;
            } catch (err) {
                console.error(`Failed to grade ${submission._id}:`, err.message);
                failures.push({ studentName: submission.studentName, reason: err.message });
            }
            await new Promise(r => setTimeout(r, 1000)); // stay under Gemini rate limits
        }

        res.status(200).json({
            success: true,
            message: `AI grading completed: ${graded} graded, ${failures.length} failed`,
            graded,
            failed: failures.length,
            failures
        });

    } catch (error) {
        console.error('AI grade all error:', error.message);
        res.status(500).json({ success: false, message: 'AI grading failed: ' + error.message });
    }
};

// Get AI grading status
exports.getGradingStatus = async (req, res) => {
    try {
        const { submissionId } = req.params;

        const submission = await Submission.findById(submissionId)
            .select('aiScores aiFeedback aiTotalScore status');

        if (!submission) {
            return res.status(404).json({ success: false, message: 'Submission not found' });
        }

        res.status(200).json({
            success: true,
            hasAIGrade: !!(submission.aiScores && submission.aiScores.size > 0),
            aiResult: {
                scores: submission.aiScores || {},
                feedback: submission.aiFeedback || '',
                totalScore: submission.aiTotalScore || 0
            },
            status: submission.status
        });

    } catch (error) {
        console.error('Get grading status error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};