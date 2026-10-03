// backend/controllers/export.controller.js
const ExcelJS = require('exceljs');
const Submission = require('../models/Submission');
const Assignment = require('../models/Assignment');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const Settings = require('../models/Settings');

// 1 -> A, 27 -> AA
function colLetter(n) {
    let s = '';
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

const GREEN = 'FF2A7A4B';
const thinBorder = {
    top: { style: 'thin' }, left: { style: 'thin' },
    bottom: { style: 'thin' }, right: { style: 'thin' }
};

// GET /api/submissions/lecturer/export?course=IFT501&session=2025-2026&semester=Harmattan
exports.exportCourseResults = async (req, res) => {
    try {
        if (req.user.role === 'student') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { course } = req.query;
        if (!course) {
            return res.status(400).json({ success: false, message: 'Course code is required' });
        }

        let { session, semester } = req.query;
        if (!session || !semester) {
            const s = await Settings.getSettings();
            session = session || s.activeSession;
            semester = semester || s.activeSemester;
        }

        // Only this lecturer's assignments (admins can export any)
        const assignmentQuery = { course, session, semester };
        if (req.user.role !== 'admin') assignmentQuery.lecturerId = req.user.id;

        const assignments = await Assignment.find(assignmentQuery);
        if (assignments.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No assignments found for ${course} (${session} ${semester})`
            });
        }

        // Assignment columns: alphabetical by title
        assignments.sort((a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }));

        const assignmentIds = assignments.map(a => a._id);

        const [submissions, enrollments] = await Promise.all([
            Submission.find({ assignmentId: { $in: assignmentIds }, session, semester }),
            Enrollment.find({ courseCode: course, session, semester, status: 'active' })
                .populate('studentId', 'fullName matricNumber')
        ]);

        // Build student map: start with the full class roster
        const studentMap = new Map();
        for (const enr of enrollments) {
            if (!enr.studentId) continue; // user was deleted
            const key = enr.studentId._id.toString();
            studentMap.set(key, {
                name: enr.studentId.fullName || 'Unknown',
                matric: enr.studentId.matricNumber || '',
                subs: {}
            });
        }

        // Attach submissions (and add anyone who submitted but isn't on the roster)
        for (const sub of submissions) {
            const key = sub.studentId.toString();
            if (!studentMap.has(key)) {
                studentMap.set(key, { name: sub.studentName, matric: sub.matricNumber, subs: {} });
            }
            studentMap.get(key).subs[sub.assignmentId.toString()] = sub;
        }

        if (studentMap.size === 0) {
            return res.status(404).json({
                success: false,
                message: `No enrolled students or submissions found for ${course}`
            });
        }

        // Rows: alphabetical by student name
        const students = [...studentMap.values()].sort((a, b) =>
            (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
        );

        // Header block details
        const lecturer = await User.findById(req.user.id);
        const lecturerName = lecturer?.fullName || 'Lecturer';
        const department = lecturer?.department || 'Information Technology';
        const courseTitle = assignments[0].courseName || '';
        const maxTotal = assignments.reduce((sum, a) => sum + (a.totalMarks || 0), 0);

        // ---------- Build workbook ----------
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'FUTO Assignment System';
        const ws = workbook.addWorksheet(course.slice(0, 31));

        const firstAssignCol = 4;
        const lastAssignCol = 3 + assignments.length;
        const totalCol = lastAssignCol + 1;
        const percentCol = lastAssignCol + 2;
        const lastCol = colLetter(percentCol);

        // Column widths
        ws.getColumn(1).width = 6;
        ws.getColumn(2).width = 34;
        ws.getColumn(3).width = 18;
        for (let c = firstAssignCol; c <= lastAssignCol; c++) ws.getColumn(c).width = 20;
        ws.getColumn(totalCol).width = 12;
        ws.getColumn(percentCol).width = 14;

        // Header block (rows 1-5)
        const headerLines = [
            { text: 'FEDERAL UNIVERSITY OF TECHNOLOGY OWERRI (FUTO)', size: 16, bold: true },
            { text: `Department of ${department}`, size: 13, bold: true },
            { text: `Course: ${course}${courseTitle ? ' - ' + courseTitle : ''}`, size: 12, bold: true },
            { text: `Session: ${session}   |   Semester: ${semester}`, size: 11, bold: false },
            { text: `Lecturer: ${lecturerName}`, size: 11, bold: false }
        ];
        headerLines.forEach((line, i) => {
            const r = i + 1;
            ws.mergeCells(`A${r}:${lastCol}${r}`);
            const cell = ws.getCell(`A${r}`);
            cell.value = line.text;
            cell.font = { size: line.size, bold: line.bold };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });

        // Table header row (row 7)
        const HEADER_ROW = 7;
        const headers = [
            'S/N', 'Full Name', 'Reg No',
            ...assignments.map(a => `${a.title} /${a.totalMarks || 0}`),
            `Total /${maxTotal}`,
            'Percentage (%)'
        ];
        const headerRow = ws.getRow(HEADER_ROW);
        headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
        headerRow.height = 36;
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = thinBorder;
        });

        // Data rows
        students.forEach((st, i) => {
            const rowNum = HEADER_ROW + 1 + i;
            const row = ws.getRow(rowNum);

            row.getCell(1).value = i + 1;
            row.getCell(2).value = st.name;
            row.getCell(3).value = st.matric;

            let runningTotal = 0;
            assignments.forEach((a, idx) => {
                const sub = st.subs[a._id.toString()];
                const cell = row.getCell(firstAssignCol + idx);
                if (!sub) {
                    cell.value = 'Not submitted';
                } else if (sub.status === 'graded') {
                    const score = sub.totalScore || 0;
                    cell.value = score;
                    runningTotal += score;
                } else {
                    cell.value = 'Pending';
                }
            });

            const firstL = colLetter(firstAssignCol);
            const lastL = colLetter(lastAssignCol);
            const totalL = colLetter(totalCol);
            const pct = maxTotal > 0 ? Math.round((runningTotal / maxTotal) * 1000) / 10 : 0;

            row.getCell(totalCol).value = {
                formula: `SUM(${firstL}${rowNum}:${lastL}${rowNum})`,
                result: runningTotal
            };
            row.getCell(percentCol).value = {
                formula: maxTotal > 0 ? `ROUND(${totalL}${rowNum}/${maxTotal}*100,1)` : '0',
                result: pct
            };

            // Styling
            for (let c = 1; c <= percentCol; c++) {
                const cell = row.getCell(c);
                cell.border = thinBorder;
                cell.alignment = {
                    horizontal: c === 2 ? 'left' : 'center',
                    vertical: 'middle'
                };
                if (cell.value === 'Pending' || cell.value === 'Not submitted') {
                    cell.font = { italic: true, color: { argb: 'FF94A3B8' } };
                }
            }
            row.getCell(totalCol).font = { bold: true };
            row.getCell(percentCol).font = { bold: true };
        });

        // Freeze header + first 3 columns
        ws.views = [{ state: 'frozen', xSplit: 3, ySplit: HEADER_ROW }];

        // ---------- Send ----------
        const safeCourse = course.replace(/[^a-zA-Z0-9_-]/g, '');
        const fileName = `${safeCourse}_Results_${session}_${semester}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export results error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: 'Failed to generate Excel file' });
        }
    }
};