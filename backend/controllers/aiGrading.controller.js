// backend/controllers/aiGrading.controller.js
const crypto = require('crypto');
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

// Submissions that still need an AI draft: pending, and no draft saved yet.
// Batch runs skip drafts so a restarted job never grades the same student twice.
const NEEDS_DRAFT = { status: 'pending', aiFeedback: '' };

// In-memory grading jobs (cleared when the server restarts)
const JOB_TTL_MS = 60 * 60 * 1000;
const jobs = new Map();

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

// Grade one submission and save the AI result as a draft (does NOT change status or email anyone)
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
    return assignment.lecturerId.toString() === String(user.id) || user.role === 'admin';
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Remove finished jobs after an hour so memory doesn't grow forever
function pruneJobs() {
    const cutoff = Date.now() - JOB_TTL_MS;
    for (const [id, job] of jobs) {
        if (job.status === 'finished' && job.finishedAtMs < cutoff) jobs.delete(id);
    }
}

// Grades one submission, retrying once after a rate-limit (429) response
async function gradeWithRetry(submission, assignment) {
    try {
        return await gradeOne(submission, assignment);
    } catch (err) {
        if (err.status !== 429) throw err;
        await sleep(20000);
        return gradeOne(submission, assignment);
    }
}

// Runs in the background: grades submissions one at a time and records progress on the job
async function runGradingJob(job, submissions, assignmentMap) {
    for (const submission of submissions) {
        const assignment = assignmentMap.get(String(submission.assignmentId));
        try {
            if (!assignment) throw new Error('Assignment not found');
            await gradeWithRetry(submission, assignment);
            job.graded++;
        } catch (err) {
            job.failed++;
            job.failures.push({
                submissionId: String(submission._id),
                studentName: submission.studentName,
                reason: err.message
            });
            console.error(`Batch grading failed for ${submission._id}:`, err.message);
        }
        job.done++;
        await sleep(1000); // stay under Gemini rate limits
    }

    job.status = 'finished';
    job.finishedAt = new Date();
    job.finishedAtMs = Date.now();
    console.log(`Grading job ${job.id} finished: ${job.graded} drafted, ${job.failed} failed`);
}

// Creates a job and starts it in the background. Returns immediately.
function startGradingJob(lecturerId, submissions, assignmentMap, label) {
    pruneJobs();

    // Only one running job per lecturer
    for (const existing of jobs.values()) {
        if (existing.lecturerId === String(lecturerId) && existing.status === 'running') {
            const err = new Error('A grading job is already running. Wait for it to finish.');
            err.status = 409;
            err.jobId = existing.id;
            throw err;
        }
    }

    const job = {
        id: crypto.randomUUID(),
        lecturerId: String(lecturerId),
        label,
        status: 'running',
        total: submissions.length,
        done: 0,
        graded: 0,
        failed: 0,
        failures: [],
        startedAt: new Date(),
        finishedAt: null,
        finishedAtMs: null
    };
    jobs.set(job.id, job);

    runGradingJob(job, submissions, assignmentMap).catch(err => {
        console.error('Grading job crashed:', err);
        job.status = 'finished';
        job.finishedAt = new Date();
        job.finishedAtMs = Date.now();
    });

    return job;
}

function sendError(res, error) {
    console.error('AI grading error:', error.message);
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
    const message = status === 429
        ? 'The AI is busy right now. Wait a minute and try again.'
        : error.message;
    res.status(status).json({ success: false, message, jobId: error.jobId });
}

// AI grade a single submission (saves a draft; use Release on the card to send it)
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
        sendError(res, error);
    }
};

// POST /api/ai-grade/assignment/:assignmentId
// Starts a background job for every pending submission of one assignment
exports.aiGradeAllSubmissions = async (req, res) => {
    try {
        const assignment = await Assignment.findById(req.params.assignmentId).select('+markingScheme.text');
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }
        if (!canGrade(assignment, req.user)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const submissions = await Submission.find({ assignmentId: assignment._id, ...NEEDS_DRAFT });
        if (submissions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No pending submissions need an AI draft',
                jobId: null,
                total: 0
            });
        }

        const assignmentMap = new Map([[assignment._id.toString(), assignment]]);
        const job = startGradingJob(req.user.id, submissions, assignmentMap, assignment.title);

        res.status(202).json({
            success: true,
            message: `AI grading started for ${job.total} submission(s)`,
            jobId: job.id,
            total: job.total
        });

    } catch (error) {
        sendError(res, error);
    }
};

// POST /api/ai-grade/course
// Body: { course, session, semester }. Starts a job for every pending submission in the course.
exports.aiGradeCoursePending = async (req, res) => {
    try {
        const { course, session, semester } = req.body || {};
        if (!course) {
            return res.status(400).json({ success: false, message: 'Course is required' });
        }

        const filter = { course };
        if (session) filter.session = session;
        if (semester) filter.semester = semester;
        if (req.user.role !== 'admin') filter.lecturerId = req.user.id;

        const assignments = await Assignment.find(filter).select('+markingScheme.text');
        if (assignments.length === 0) {
            return res.status(404).json({ success: false, message: 'No assignments found for this course' });
        }

        const assignmentMap = new Map(assignments.map(a => [a._id.toString(), a]));
        const submissions = await Submission.find({
            assignmentId: { $in: assignments.map(a => a._id) },
            ...NEEDS_DRAFT
        });

        if (submissions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No pending submissions need an AI draft',
                jobId: null,
                total: 0
            });
        }

        const job = startGradingJob(req.user.id, submissions, assignmentMap, `course ${course}`);

        res.status(202).json({
            success: true,
            message: `AI grading started for ${job.total} submission(s) in ${course}`,
            jobId: job.id,
            total: job.total
        });

    } catch (error) {
        sendError(res, error);
    }
};

// POST /api/ai-grade/submissions
// Body: { submissionIds: [...] }. Used by the top bar, which grades what the filters show.
exports.aiGradeSelectedSubmissions = async (req, res) => {
    try {
        const ids = (req.body?.submissionIds || []).filter(id => /^[0-9a-fA-F]{24}$/.test(String(id)));
        if (ids.length === 0) {
            return res.status(400).json({ success: false, message: 'No submissions selected' });
        }

        const submissions = await Submission.find({ _id: { $in: ids }, ...NEEDS_DRAFT });
        if (submissions.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No pending submissions need an AI draft',
                jobId: null,
                total: 0
            });
        }

        const assignmentIds = [...new Set(submissions.map(s => String(s.assignmentId)))];
        const assignments = await Assignment.find({ _id: { $in: assignmentIds } }).select('+markingScheme.text');

        for (const assignment of assignments) {
            if (!canGrade(assignment, req.user)) {
                return res.status(403).json({ success: false, message: 'Access denied' });
            }
        }

        const assignmentMap = new Map(assignments.map(a => [a._id.toString(), a]));
        const job = startGradingJob(req.user.id, submissions, assignmentMap, 'the selected submissions');

        res.status(202).json({
            success: true,
            message: `AI grading started for ${job.total} submission(s)`,
            jobId: job.id,
            total: job.total
        });

    } catch (error) {
        sendError(res, error);
    }
};

// GET /api/ai-grade/jobs/:jobId
// Progress for a grading job. Only the lecturer who started it (or an admin) can see it.
exports.getGradingJob = (req, res) => {
    const job = jobs.get(req.params.jobId);
    const isOwner = job && (job.lecturerId === String(req.user.id) || req.user.role === 'admin');

    if (!job || !isOwner) {
        return res.status(404).json({ success: false, message: 'Grading job not found' });
    }

    const { id, label, status, total, done, graded, failed, failures, startedAt, finishedAt } = job;
    res.status(200).json({
        success: true,
        job: { id, label, status, total, done, graded, failed, failures, startedAt, finishedAt }
    });
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