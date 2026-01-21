import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Keep your current model unless you want to swap it
const MODEL = "gemini-1.5-pro";

/**
 * Shared helper to build Gemini input
 */
function buildParts(text: string, base64?: string, mimeType?: string) {
  const parts: any[] = [];

  // Only include text part if it isn't empty/whitespace
  const trimmed = (text ?? "").trim();
  if (trimmed.length > 0) parts.push({ text: trimmed });

  if (base64 && mimeType) {
    parts.push({
      inlineData: {
        data: base64.includes(",") ? base64.split(",")[1] : base64, // supports raw or dataURL
        mimeType
      }
    });
  }

  // If both empty, still send something
  if (parts.length === 0) parts.push({ text: "Summarize the attached document." });

  return parts;
}

function stripJsonFences(raw: string) {
  const s = raw.trim();
  if (s.startsWith("```")) {
    return s
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }
  return s;
}

/**
 * Summarize document or metadata
 */
export async function summarizeContent(
  text: string,
  base64?: string,
  mimeType?: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `
You are an academic assistant.
Summarize the document clearly.
Include:
- Key topics
- Important formulas or concepts
- Exam-relevant points
`.trim();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: buildParts(`${prompt}\n\n${text ?? ""}`, base64, mimeType)
      }
    ]
  });

  return result.response.text();
}

/**
 * Generate flashcards OR quiz
 */
export async function generateStudySet(
  text: string,
  type: "flashcards" | "quiz",
  base64?: string,
  mimeType?: string
) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const instruction =
    type === "flashcards"
      ? `
Generate flashcards in JSON.
Return ONLY valid JSON (no markdown).
Format:
[
  { "front": "Question", "back": "Answer" }
]
`.trim()
      : `
Generate multiple-choice quiz questions in JSON.
Return ONLY valid JSON (no markdown).
Format:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0
  }
]
`.trim();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: buildParts(`${instruction}\n\nUse the actual document content.\n\n${text ?? ""}`, base64, mimeType)
      }
    ]
  });

  const raw = result.response.text();
  const cleaned = stripJsonFences(raw);

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse study set JSON:", raw);
    return [];
  }
}
