import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import JSZip from "jszip";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";

/* ============================
   PDF.JS INIT
============================ */

const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* ============================
   API KEY (VITE SAFE)
============================ */

const apiKey: string =
  ((import.meta as any).env?.VITE_API_KEY as string) || "";

if (!apiKey) {
  console.warn("Gemini API key missing");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/* ============================
   MIME HELPERS (STRICT)
============================ */

const isImage = (mimeType: string): boolean =>
  mimeType.startsWith("image/");

const isPdf = (mimeType: string): boolean =>
  mimeType === "application/pdf";

const isDocx = (mimeType: string): boolean =>
  mimeType ===
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const isPptx = (mimeType: string): boolean =>
  mimeType ===
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/* ============================
   BASE64 → BUFFER
============================ */

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const clean = base64.replace(/^data:.+;base64,/, "");
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/* ============================
   PDF EXTRACTION
============================ */

const extractTextFromPdf = async (base64: string): Promise<string> => {
  try {
    const buffer = base64ToArrayBuffer(base64);
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;

    let text = "";
    const maxPages = Math.min(pdf.numPages, 20);

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }

    return text.trim();
  } catch (err) {
    console.error("PDF extraction failed", err);
    return "";
  }
};

/* ============================
   DOCX EXTRACTION
============================ */

const extractTextFromDocx = async (base64: string): Promise<string> => {
  try {
    const buffer = base64ToArrayBuffer(base64);
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value?.trim() || "";
  } catch (err) {
    console.error("DOCX extraction failed", err);
    return "";
  }
};

/* ============================
   PPTX EXTRACTION
============================ */

const extractTextFromPptx = async (base64: string): Promise<string> => {
  try {
    const buffer = base64ToArrayBuffer(base64);
    const zip = await JSZip.loadAsync(buffer);
    const slides = zip.folder("ppt/slides");

    if (!slides) return "";

    const texts: string[] = [];
    const parser = new DOMParser();

    for (const name of Object.keys(slides.files)) {
      if (!name.endsWith(".xml")) continue;
      const xml = await slides.files[name].async("string");
      const doc = parser.parseFromString(xml, "application/xml");
      doc.querySelectorAll("a\\:t, t").forEach((n) => {
        if (n.textContent) texts.push(n.textContent);
      });
    }

    return texts.join(" ").trim();
  } catch (err) {
    console.error("PPTX extraction failed", err);
    return "";
  }
};

/* ============================
   BUILD GEMINI PARTS
============================ */

const buildParts = async (
  fileBase64?: string,
  mimeType?: string,
  fallbackText?: string
): Promise<any[]> => {
  const parts: any[] = [];

  if (fileBase64 && mimeType) {
    // 🖼️ IMAGE
    if (isImage(mimeType)) {
      parts.push({
        inlineData: {
          data: fileBase64.replace(/^data:.+;base64,/, ""),
          mimeType,
        },
      });
      parts.push({
        text: "Analyze this image and extract all relevant study information.",
      });
      return parts;
    }

    // 📄 DOCUMENTS (TEXT ONLY)
    let text = "";

    if (isPdf(mimeType)) text = await extractTextFromPdf(fileBase64);
    if (isDocx(mimeType)) text = await extractTextFromDocx(fileBase64);
    if (isPptx(mimeType)) text = await extractTextFromPptx(fileBase64);

    if (!text || text.length < 50) {
      throw new Error("Document text extraction failed");
    }

    parts.push({
      text: `Analyze the following document:\n\n${text}`,
    });

    return parts;
  }

  parts.push({ text: fallbackText || "" });
  return parts;
};

/* ============================
   SUMMARY
============================ */

export const summarizeContent = async (
  content: string,
  fileBase64?: string,
  mimeType?: string
): Promise<string> => {
  if (!ai) return "Gemini not configured";

  try {
    const parts = await buildParts(fileBase64, mimeType, content);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: `
You are an expert academic assistant.
Return markdown with:
- **Key Concepts**
- **Main Takeaways**
- **Potential Exam Questions**
`,
        temperature: 0.3,
      },
    });

    return response.text || "No summary generated.";
  } catch (err: any) {
    console.error("Summary error", err);
    return err.message || "Failed to generate summary.";
  }
};

/* ============================
   FLASHCARDS / QUIZ
============================ */

export const generateStudySet = async (
  content: string,
  setType: "flashcards" | "quiz",
  fileBase64?: string,
  mimeType?: string
): Promise<any[]> => {
  if (!ai) return [];

  try {
    const parts = await buildParts(fileBase64, mimeType, content);

    const schema =
      setType === "flashcards"
        ? {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                term: { type: Type.STRING },
                definition: { type: Type.STRING },
              },
              required: ["term", "definition"],
            },
          }
        : {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctAnswer: { type: Type.STRING },
              },
              required: ["question", "options", "correctAnswer"],
            },
          };

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (err) {
    console.error("Study set error", err);
    return [];
  }
};
