import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const MODEL = "gemini-1.5-pro";

/**
 * Shared helper to build Gemini input
 */
function buildParts(
  text: string,
  base64?: string,
  mimeType?: string
) {
  const parts: any[] = [{ text }];

  if (base64 && mimeType) {
    const normalizedBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
    parts.push({
      inlineData: {
        data: normalizedBase64, // strip data:mime;base64, if present
        mimeType
      }
    });
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

${text}
          `,
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
Format:
[
  { "front": "Question", "back": "Answer" }
]
`
      : `
Generate multiple-choice quiz questions in JSON.
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
${text}
          `,
          base64,
          mimeType
        )
      }
    ]
  });

  // Gemini returns text — parse JSON safely
  const raw = result.response.text();

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to parse study set JSON:", raw);
    return [];
  }
}
