// backend/utils/extractText.js
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const mammoth = require('mammoth');

async function extractText(file) {
    const name = (file.originalname || '').toLowerCase();

    if (name.endsWith('.pdf') || file.mimetype === 'application/pdf') {
        const data = await pdfParse(file.buffer);
        return (data.text || '').trim();
    }
    if (name.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return (result.value || '').trim();
    }
    if (name.endsWith('.txt') || file.mimetype === 'text/plain') {
        return file.buffer.toString('utf8').trim();
    }
    throw new Error('Unsupported file type. Use PDF, DOCX or TXT.');
}

module.exports = { extractText };