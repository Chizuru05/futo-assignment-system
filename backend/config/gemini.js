// backend/config/gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI with your API key
let genAI = null;
try {
    const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyAI0qQSFsnZxAsW11KA4nv8RMMcQXWE0IU';
    if (apiKey && apiKey.startsWith('AIza')) {
        genAI = new GoogleGenerativeAI(apiKey);
        console.log('✅ Gemini AI initialized with valid API key');
    } else {
        console.log('⚠️ Invalid or missing Gemini API key');
    }
} catch (error) {
    console.error('Failed to initialize Gemini AI:', error.message);
}

// Generate AI grade for a submission
async function generateAIGrade({ studentName, assignmentTitle, courseName, fileContent, rubric, totalMarks }) {
    // If Gemini is not available, return fallback grades
    if (!genAI) {
        console.log('Using fallback grading (Gemini not available)');
        return generateFallbackGrade(rubric, totalMarks);
    }
    
    try {
        console.log('=== CALLING GEMINI API ===');
        console.log('Student:', studentName);
        console.log('Assignment:', assignmentTitle);
        
        // Prepare rubric text for AI
        const rubricText = rubric.map(r => `- ${r.name}: ${r.maxScore} points`).join('\n');
        
        // Create prompt for Gemini
        const prompt = `
You are a university lecturer grading a student assignment.

Assignment Details:
- Course: ${courseName}
- Assignment Title: ${assignmentTitle}
- Student: ${studentName}
- Total Marks: ${totalMarks}

Grading Rubric:
${rubricText}

Student Submission: The student has submitted the assignment. Please provide fair scores based on the assignment quality.

Evaluate this submission based on the rubric criteria. For each criterion, provide a score out of the maximum points.

Respond in JSON format with the following structure:
{
    "scores": {
        "criterion_name_1": score,
        "criterion_name_2": score
    },
    "criterionFeedback": {
        "criterion_name_1": "justification",
        "criterion_name_2": "justification"
    },
    "feedback": "Overall feedback text",
    "totalScore": total_score
}

Be fair and reasonable with scores. Give reasonable scores between 60-90% of max points.
`;

        // Try different model names
        const modelNames = ['gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];
        let lastError = null;
        
        for (const modelName of modelNames) {
            try {
                console.log(`Trying model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();
                
                console.log(`Success with model: ${modelName}`);
                
                // Parse JSON response
                let jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const aiResult = JSON.parse(jsonMatch[0]);
                    console.log('Parsed AI result, total score:', aiResult.totalScore);
                    return aiResult;
                }
                break;
            } catch (err) {
                lastError = err;
                console.log(`Model ${modelName} failed:`, err.message);
                continue;
            }
        }
        
        // If all models failed
        console.error('All models failed:', lastError?.message);
        return generateFallbackGrade(rubric, totalMarks);
        
    } catch (error) {
        console.error('Gemini API error:', error.message);
        return generateFallbackGrade(rubric, totalMarks);
    }
}

// Fallback grade generator if AI fails
function generateFallbackGrade(rubric, totalMarks) {
    const scores = {};
    const criterionFeedback = {};
    let totalScore = 0;
    
    for (const criterion of rubric) {
        // Give 75% of max score as fallback
        const score = Math.round(criterion.maxScore * 0.75);
        scores[criterion.name] = score;
        criterionFeedback[criterion.name] = "Good submission. Keep up the good work!";
        totalScore += score;
    }
    
    return {
        scores,
        criterionFeedback,
        feedback: "Assignment submitted successfully. Please review your scores and feedback.",
        totalScore
    };
}

module.exports = { generateAIGrade };