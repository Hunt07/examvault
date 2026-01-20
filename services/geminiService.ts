import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
// @ts-ignore
import JSZip from "jszip";
// @ts-ignore
import * as pdfjsLib from "pdfjs-dist";

/* ============================
   PDF.js SETUP
============================ */
const pdfjs: any = (pdfjsLib as any).default || pdfjsLib;

if (pdfjs?.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

/* ============================
   GEMINI INIT (VITE SAFE)
============================ */
const apiKey: string =
  ((import.meta as any).env?.VITE_API_KEY as string) || "";

if (!apiKey) console.warn("❌ VITE_API_KEY missing");

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

/* ============================
   MIME HELPERS
============================ */
const isImage = (m: string) => m.startsWith("image/");
const isPdf = (m: string) => m === "application/pdf";
const isDocx = (m: string) =>
  m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const isPptx = (m: string) =>
  m === "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/* ============================
   BASE64 → BUFFER
============================ */
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  const clean = base64.replace(/^data:.+;base64,/, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/* ============================
   PDF EXTRACTION
============================ */
const extractPdf = async (b64: string): Promise<string> => {
  try {
    const pdf = await pdfjs
      .getDocument({ data: base64ToArrayBuffer(b64) })
      .promise;

    let text = "";
    const pages = Math.min(pdf.numPages, 20);

    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((x: any) => x.str).join(" ") + "\n";
    }
    return text.trim();
  } catch {
    return "";
  }
};

/* ============================
   DOCX EXTRACTION
============================ */
const extractDocx = async (b64: string): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({
      arrayBuffer: base64ToArrayBuffer(b64),
    });
    return result.value?.trim() || "";
  } catch {
    return "";
  }
};

/* ============================
   PPTX EXTRACTION
============================ */
const extractPptx = async (b64: string): Promise<string> => {
  try {
    const zip = await JSZip.loadAsync(base64ToArrayBuffer(b64));
    const slides = zip.folder("ppt/slides");
    if (!slides) return "";

    const parser = new DOMParser();
    const texts: string[] = [];

    for (const name of Object.keys(slides.files)) {
      if (!name.endsWith(".xml")) continue;
      const xml = await slides.files[name].async("string");
      const doc = parser.parseFromString(xml, "application/xml");
      doc.querySelectorAll("a\\:t, t").forEach((n) => {
        if (n.textContent) texts.push(n.textContent);
      });
    }

    return texts.join(" ").trim();
  } catch {
    return "";
  }
};

/* ============================
   BUILD PARTS (CRITICAL)
============================ */
const buildParts = async (
  base64?: string,
  mimeType?: string,
  fallback?: string
): Promise<any[]> => {
  const parts: any[] = [];

  if (base64 && mimeType) {
    // 🖼 IMAGE
    if (isImage(mimeType)) {
      parts.push({
        inlineData: {
          mimeType,
          data: base64.replace(/^data:.+;base64,/, ""),
        },
      });
      parts.push({ text: "Describe and extract study-relevant information." });
      return parts;
    }

    // 📄 DOCUMENTS (TEXT ONLY)
    let text = "";

    if (isPdf(mimeType)) text = await extractPdf(base64);
    if (isDocx(mimeType)) text = await extractDocx(base64);
    if (isPptx(mimeType)) text = await extractPptx(base64);

    if (!text || text.length < 30) {
      throw new Error("❌ File text extraction failed");
    }

    parts.push({ text });
    return parts;
  }

  parts.push({ text: fallback || "" });
  return parts;
};

/* ============================
   SUMMARY API
============================ */
export const summarizeContent = async (
  content: string,
  base64?: string,
  mimeType?: string
): Promise<string> => {
  if (!ai) return "Gemini not configured";

  try {
    const parts = await buildParts(base64, mimeType, content);

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0.3,
        systemInstruction: `
You are an academic assistant.
Return markdown with:
- Key Concepts
- Main Takeaways
- Potential Exam Questions
`,
      },
    });

    return res.text || "No output";
  } catch (e: any) {
    console.error(e);
    return e.message;
  }
};
export const generateStudySet = async (
  content: string,
  setType: "flashcards" | "quiz",
  base64?: string,
  mimeType?: string
): Promise<any[]> => {
  if (!ai) return [];

  try {
    const parts = await (async () => {
      // reuse internal logic without duplication
      const fallback = content || "";

      if (base64 && mimeType) {
        // image
        if (mimeType.startsWith("image/")) {
          return [
            {
              inlineData: {
                mimeType,
                data: base64.replace(/^data:.+;base64,/, ""),
              },
            },
            { text: `Generate ${setType} from this image.` },
          ];
        }

        // document
        let text = "";
        if (mimeType === "application/pdf") text = await extractPdf(base64);
        if (
          mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
          text = await extractDocx(base64);
        if (
          mimeType ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        )
          text = await extractPptx(base64);

        if (text) return [{ text }];
      }

      return [{ text: fallback }];
    })();

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
    console.error("generateStudySet error", err);
    return [];
  }
};
