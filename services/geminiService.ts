import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
if (!apiKey) {
  throw new Error("VITE_GEMINI_API_KEY is missing. Add it to .env.local and restart Vite.");
}

const genAI = new GoogleGenerativeAI(apiKey);

const MODEL = "gemini-1.5-pro";

/**
 * Shared helper to build Gemini input
 */
function buildParts(text: string, base64?: string, mimeType?: string) {
  const parts: any[] = [];

  const trimmed = (text ?? "").trim();
  if (trimmed.length > 0) parts.push({ text: trimmed });

  if (base64 && mimeType) {
    const data = base64.includes(",") ? base64.split(",")[1] : base64; // supports dataURL or raw base64
    parts.push({
      inlineData: {
        data,
        mimeType
      }
    });
  }

  // Ensure Gemini always receives at least something
  if (parts.length === 0) {
    parts.push({ text: "Summarize the attached document." });
  }

  return parts;
}

function stripJsonFences(raw: string) {
  const s = raw.trim();
  if (s.startsWith("```")) {
    return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  return s;
}

/**
 * Summarize document content ONLY (you are passing "" text when file bytes exist)
 */
export async function summarizeContent(
  text: string,
  base64?: string,
  mimeType?: string
): Promise<string> {
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
${text ? `\n\n${text}` : ""}
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
        parts: buildParts(
          `
${instruction}

Use the actual document content.
${text ? `\n\n${text}` : ""}
          `.trim(),
          base64,
          mimeType
        )
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
