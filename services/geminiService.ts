import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-1.5-pro";

function getGenAI(): GoogleGenerativeAI {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  // IMPORTANT: Do NOT throw at module load time.
  // Only throw when user actually tries to call Gemini.
  if (!key || key.trim().length === 0) {
    throw new Error(
      "Missing VITE_GEMINI_API_KEY. Add it to .env.local (VITE_GEMINI_API_KEY=...) and restart Vite."
    );
  }

  return new GoogleGenerativeAI(key);
}

/**
 * Shared helper to build Gemini input
 */
function buildParts(text: string, base64?: string, mimeType?: string) {
  const parts: any[] = [];

  const trimmedText = (text ?? "").trim();
  if (trimmedText.length > 0) {
    parts.push({ text: trimmedText });
  }

  if (base64 && mimeType) {
    const data = base64.includes(",") ? base64.split(",")[1] : base64; // supports dataURL or raw base64
    parts.push({
      inlineData: {
        data,
        mimeType
      }
    });
  }

  // Ensure there's always at least one part
  if (parts.length === 0) {
    parts.push({ text: "Summarize the attached document." });
  }

  return parts;
}

/**
 * Summarize document or metadata
 */
export async function summarizeContent(
  text: string,
  base64?: string,
  mimeType?: string
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: MODEL });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: buildParts(
          `
You are an academic assistant.
Summarize the document clearly.
Include:
- Key topics
- Important formulas or concepts
- Exam-relevant points

${text ?? ""}
          `.trim(),
          base64,
          mimeType
        )
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
  const genAI = getGenAI();
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
`
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
`;

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: buildParts(
          `
${instruction}

Use the actual document content.
${text ?? ""}
          `.trim(),
          base64,
          mimeType
        )
      }
    ]
  });

  // Gemini returns text — parse JSON safely
  const raw = result.response.text().trim();

  // Strip code fences if Gemini ignores instructions
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse study set JSON:", raw);
    return [];
  }
}
