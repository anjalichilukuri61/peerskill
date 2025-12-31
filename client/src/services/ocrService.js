import { createWorker } from 'tesseract.js';

/**
 * Robustly validates and extracts details from college ID cards using confidence-based scoring.
 * @param {File|string} imageSource - The image file or URL to scan.
 * @returns {Promise<{isValid: boolean, details: {name: string, rollNumber: string, department: string}, score: number, reasons: string[], text: string}>}
 */
export const verifySrgecIdCard = async (imageSource) => {
    console.log("--- STARTING ROBUST ID VERIFICATION ---");
    let worker = null;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('OCR Timeout: Extraction took too long (60s).')), 60000);
    });

    try {
        const ocrPromise = (async () => {
            worker = await createWorker('eng', 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR Progress: ${(m.progress * 100).toFixed(0)}%`);
                    }
                }
            });

            console.log("Worker initialized, starting recognition...");
            const { data: { text } } = await worker.recognize(imageSource);
            console.log("Recognition complete.");

            await worker.terminate();
            worker = null;

            // 1. DATA NORMALIZATION
            const rawText = text || '';
            console.log("RAW OCR TEXT:\n", rawText);

            // Normalize: Uppercase, trim, replace common OCR misreads
            const normalizedText = rawText.toUpperCase()
                .replace(/[|]/g, 'I') // Replace pipes with I
                .replace(/[^A-Z0-9\n\s.-]/g, ' '); // Clean special chars mostly

            const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // 2. CONFIDENCE SCORING
            let score = 0;
            const reasons = [];
            const details = { name: '', rollNumber: '', department: '' };

            // A. COLLEGE DETECTION (+40)
            const collegeKeywords = [
                'SESHADRI', 'RAO', 'GUDLAVALLERU', 'ENGINEERING', 'COLLEGE',
                'GECG', 'SRGEC', 'AUTONOMOUS', 'SR GUDLAVALLERU'
            ];
            const collegeMatches = collegeKeywords.filter(k => normalizedText.includes(k));

            if (collegeMatches.length >= 2 || normalizedText.includes('GUDLAVALLERU') || normalizedText.includes('SRGEC')) {
                score += 40;
                console.log("DEBUG: College detected. Matches:", collegeMatches);
            } else {
                reasons.push("College name not clearly detected.");
            }

            // B. ROLL NUMBER DETECTION (+30)
            // Pattern: 5 digits + 1 letter + 4 digits (e.g., 21481A0544)
            // More lenient regex to handle slight OCR misreads (e.g., O for 0, S for 5)
            // We first clean typical misreads for the regex check
            const cleanedTextForRoll = normalizedText.replace(/O/g, '0').replace(/S/g, '5').replace(/I/g, '1');
            const rollMatch = cleanedTextForRoll.match(/\b(\d{5}[0-9A-Z]\d{4})\b/i);

            if (rollMatch) {
                details.rollNumber = rollMatch[1].toUpperCase();
                score += 30;
                console.log("DEBUG: Roll Number detected:", details.rollNumber);
            } else {
                reasons.push("ID Number (Roll No) not detected.");
            }

            // C. STUDENT NAME DETECTION (+30)
            // Look for full uppercase lines that don't contain college keywords or numbers
            const filterKeywords = ['COLLEGE', 'ENGINEERING', 'SESSION', 'INSTITUTE', 'AUTONOMOUS', 'AFFILIATION', 'PRADESH', 'IDENTITY', 'STUDENT'];
            const nameCandidate = lines.find(line =>
                line.length > 3 &&
                !/\d/.test(line) &&
                !filterKeywords.some(k => line.includes(k)) &&
                line === line.toUpperCase()
            );

            if (nameCandidate) {
                details.name = nameCandidate;
                score += 30;
                console.log("DEBUG: Name detected:", details.name);
            } else {
                // Fallback: Check if we have a roll number, look above it
                if (details.rollNumber) {
                    const rollIndex = lines.findIndex(l => l.includes(details.rollNumber));
                    if (rollIndex > 0) {
                        const aboveLine = lines[rollIndex - 1];
                        if (aboveLine.length > 3 && !/\d/.test(aboveLine)) {
                            details.name = aboveLine;
                            score += 30;
                            console.log("DEBUG: Name detected (fallback):", details.name);
                        }
                    }
                }
            }

            if (!details.name) {
                reasons.push("Student name not clearly detected.");
            }

            // D. ISOLATION TEST (Fallback / Confidence boost)
            // If the text is long enough and we have at least one solid hit, boost it
            if (normalizedText.length > 150 && score > 0) {
                console.log("DEBUG: Isolation boost applied (High text volume).");
                score += 10;
            }

            // 3. FINAL VALIDATION
            const isValid = score >= 60;
            console.log(`--- VERIFICATION RESULT: ${isValid} (Score: ${score}) ---`);

            return {
                isValid,
                details,
                score,
                reasons: isValid ? [] : reasons,
                text: rawText
            };
        })();

        return await Promise.race([ocrPromise, timeoutPromise]);

    } catch (error) {
        console.error('OCR Overhaul Error:', error);
        if (worker) {
            try { await worker.terminate(); } catch (e) { }
        }
        return {
            isValid: false,
            details: { name: '', rollNumber: '', department: '' },
            score: 0,
            reasons: [error.message || 'System error during OCR scanning.'],
            text: ''
        };
    }
};
