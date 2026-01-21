import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const apiKey =
  (import.meta as any).env?.VITE_API_KEY ||
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  "";

const genAI = new GoogleGenerativeAI(apiKey);

// Keep flash model (your old one)
const DEFAULT_MODEL = "gemini-1.5-flash";

function assertApiKey() {
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      "Missing API key. Set VITE_API_KEY (or VITE_GEMINI_API_KEY) in .env.local and restart Vite."
    );
  }
}

function canUseInlineData(mimeType?: string) {
  if (!mimeType) return false;
  if (mimeType === "application/pdf") return true;
  if (mimeType.startsWith("image/")) return true;
  return false; // DOCX/PPTX => prefer extracted text
}

function cleanBase64(dataUrlOrBase64: string) {
  return dataUrlOrBase64.replace(/^data:.+;base64,/, "");
}

export async function summarizeContent(
  content: string,
  fileBase64?: string,
  mimeType?: string
): Promise<string> {
  try {
    assertApiKey();
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    const textPrompt = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.
`;

    // ✅ If we have PDF/image bytes, send inlineData (works best)
    if (fileBase64 && mimeType && canUseInlineData(mimeType)) {
      const parts: any[] = [
        { text: textPrompt },
        {
          inlineData: {
            mimeType,
            data: cleanBase64(fileBase64),
          },
        },
      ];

      const result = await model.generateContent(parts);
      return result.response.text() || "No summary generated.";
    }

    // ✅ Otherwise send extracted text
    const parts: any[] = [
      {
        text: `${textPrompt}\n\nMaterial to analyze:\n---\n${content || ""}\n---`,
      },
    ];
    const result = await model.generateContent(parts);
    return result.response.text() || "No summary generated.";
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Could not generate summary. Please check your API key configuration (VITE_API_KEY / VITE_GEMINI_API_KEY).";
  }
}

export async function generateStudySet(
  content: string,
  setType: "flashcards" | "quiz",
  fileBase64?: string,
  mimeType?: string
): Promise<any> {
  try {
    assertApiKey();

    let promptText = "";
    let schema: any;

    if (setType === "flashcards") {
      promptText = `Analyze the provided study material and generate a set of 5-10 flashcards.`;
      schema = {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            term: { type: SchemaType.STRING },
            definition: { type: SchemaType.STRING },
          },
          required: ["term", "definition"],
        },
      };
    } else {
      promptText = `Analyze the provided study material and generate a 5-question multiple-choice quiz.`;
      schema = {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            question: { type: SchemaType.STRING },
            options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            correctAnswer: { type: SchemaType.STRING },
          },
          required: ["question", "options", "correctAnswer"],
        },
      };
    }

    const jsonModel = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    // ✅ If we have PDF/image bytes, send inlineData
    if (fileBase64 && mimeType && canUseInlineData(mimeType)) {
      const parts: any[] = [
        { text: promptText },
        {
          inlineData: {
            mimeType,
            data: cleanBase64(fileBase64),
          },
        },
      ];
      const result = await jsonModel.generateContent(parts);
      return JSON.parse(result.response.text());
    }

    // ✅ Otherwise send extracted text
    const parts: any[] = [{ text: `${promptText}\n\nMaterial to analyze:\n---\n${content || ""}\n---` }];
    const result = await jsonModel.generateContent(parts);
    return JSON.parse(result.response.text());
  } catch (error) {
    console.error(`Error generating ${setType} with Gemini:`, error);
    return [];
  }
}
