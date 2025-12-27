import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import JSZip from "jszip";

/* =========================
   API KEY HANDLING
========================= */
const getApiKey = (): string => {
  if (import.meta.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env.VITE_API_KEY || process.env.API_KEY || "";
    }
  } catch {}
  return "";
};

const apiKey = getApiKey();
let ai: GoogleGenAI | null = null;
if (apiKey) ai = new GoogleGenAI({ apiKey });
else console.warn("Gemini API Key missing. AI features disabled.");

/* =========================
   MIME SUPPORT
========================= */
const isMimeTypeSupported = (mimeType: string): boolean => {
  const supported = [
    "application/pdf",
    "text/plain",
    "text/csv",
    "text/markdown",
    "text/html",
    "application/json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ];
  if (supported.includes(mimeType)) return true;
  if (mimeType.startsWith("image/")) return true;
  if (mimeType.startsWith("audio/")) return true;
  if (mimeType.startsWith("video/")) return true;
  return false;
};

/* =========================
   UTILITIES
========================= */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  // Node + browser safe
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

const normalizeOfficeText = (text: string): string =>
  text.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const capText = (text: string, maxChars = 12000): string =>
  text.length > maxChars
    ? text.slice(0, maxChars) + "\n\n[Content truncated for analysis]"
    : text;

/* =========================
   XML TEXT EXTRACTION
   Node-safe regex-based
========================= */
const extractXmlTextByTag = (xml: string, tag: string): string => {
  const regex = new RegExp(`<[^:>]*:${tag}[^>]*>(.*?)</[^:>]*:${tag}>`, "g");
  let match;
  let text = "";
  while ((match = regex.exec(xml)) !== null) text += match[1] + " ";
  return text.replace(/<[^>]+>/g, "").trim();
};

/* =========================
   DOCX EXTRACTION
========================= */
const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
  const clean = fileBase64.replace(/^data:.+;base64,/, "");
  const buffer = base64ToArrayBuffer(clean);

  // Primary: Mammoth
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    if (result.value && result.value.length > 50) return result.value;
  } catch {}

  // Fallback: Manual XML
  try {
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (xml) return extractXmlTextByTag(xml, "t");
  } catch {}

  return "";
};

/* =========================
   PPTX EXTRACTION
========================= */
const extractTextFromPptx = async (fileBase64: string): Promise<string> => {
  const clean = fileBase64.replace(/^data:.+;base64,/, "");
  const buffer = base64ToArrayBuffer(clean);
  const zip = await JSZip.loadAsync(buffer);

  const slides: { path: string; file: any }[] = [];
  zip.forEach((path, file) => {
    if (
      /ppt\/slides\/slide\d+\.xml/i.test(path) ||
      /ppt\/slideLayouts\/slideLayout\d+\.xml/i.test(path) ||
      /ppt\/slideMasters\/slideMaster\d+\.xml/i.test(path)
    ) {
      slides.push({ path, file });
    }
  });

  slides.sort((a, b) => {
    const na = parseInt(a.path.match(/slide(\d+)/)?.[1] || "0");
    const nb = parseInt(b.path.match(/slide(\d+)/)?.[1] || "0");
    return na - nb;
  });

  let text = "";
  for (const slide of slides) {
    const xml = await slide.file.async("string");
    const slideText = extractXmlTextByTag(xml, "t");
    if (slideText.trim()) text += `[${slide.path}] ${slideText}\n\n`;
  }

  return text.trim();
};

/* =========================
   SUMMARY
========================= */
export const summarizeContent = async (
  content: string,
  fileBase64?: string,
  mimeType?: string
): Promise<string> => {
  if (!ai) return "Configuration error: API Key missing.";

  const systemInstruction = `
You are an expert academic assistant.
Create a concise markdown summary for exam preparation.

Sections:
- **Key Concepts**
- **Main Takeaways**
- **Potential Exam Questions**
`.trim();

  try {
    const parts: any[] = [];

    if (fileBase64 && mimeType) {
      if (!isMimeTypeSupported(mimeType)) return "Unsupported file format.";

      if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        let text = normalizeOfficeText(await extractTextFromDocx(fileBase64));
        text = capText(text);
        if (text.length < 50) return "No readable text found.";
        parts.push({ text: `Analyze this document:\n\n${text}` });
      } else if (
        mimeType ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) {
        let text = normalizeOfficeText(await extractTextFromPptx(fileBase64));
        text = capText(text);
        if (text.length < 20) return "No readable text found.";
        parts.push({ text: `Analyze these slides:\n\n${text}` });
      } else {
        const clean = fileBase64.replace(/^data:.+;base64,/, "");
        parts.push({ inlineData: { data: clean, mimeType } });
        parts.push({ text: "Analyze the above content." });
      }
    } else parts.push({ text: content });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { systemInstruction },
      contents: [{ role: "user", parts }],
    });

    return response.text || "No summary generated.";
  } catch (e) {
    console.error(e);
    return "Failed to generate summary.";
  }
};

/* =========================
   STUDY SET
========================= */
export const generateStudySet = async (
  content: string,
  setType: "flashcards" | "quiz",
  fileBase64?: string,
  mimeType?: string
): Promise<any[]> => {
  if (!ai) return [];

  const prompt =
    setType === "flashcards"
      ? "Generate 5–10 flashcards."
      : "Generate a 5-question multiple-choice quiz.";

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
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
            },
            required: ["question", "options", "correctAnswer"],
          },
        };

  try {
    const parts: any[] = [];

    if (fileBase64 && mimeType) {
      if (!isMimeTypeSupported(mimeType)) return [];

      if (mimeType.includes("wordprocessingml")) {
        let text = normalizeOfficeText(await extractTextFromDocx(fileBase64));
        text = capText(text);
        if (text.length < 50) return [];
        parts.push({ text: `${prompt}\n\n${text}` });
      } else if (mimeType.includes("presentationml")) {
        let text = normalizeOfficeText(await extractTextFromPptx(fileBase64));
        text = capText(text);
        if (text.length < 20) return [];
        parts.push({ text: `${prompt}\n\n${text}` });
      } else {
        const clean = fileBase64.replace(/^data:.+;base64,/, "");
        parts.push({ text: prompt });
        parts.push({ inlineData: { data: clean, mimeType } });
      }
    } else parts.push({ text: `${prompt}\n\n${content}` });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: { responseMimeType: "application/json", responseSchema: schema },
      contents: [{ role: "user", parts }],
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (e) {
    console.error(e);
    return [];
  }
};
