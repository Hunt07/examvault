
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

// Robustly retrieve API Key
const getApiKey = (): string => {
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.VITE_API_KEY || process.env.API_KEY || "";
    }
  } catch (e) {}
  return "";
};

const apiKey = getApiKey();
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey: apiKey });
} else {
  console.warn("Gemini API Key is missing. AI features will be disabled.");
}

const isMimeTypeSupported = (mimeType: string): boolean => {
    const supportedExact = [
        'application/pdf',
        'application/json',
        'text/plain', 'text/csv', 'text/markdown', 'text/html',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
    ];
    return supportedExact.includes(mimeType) || mimeType.startsWith('image/') || mimeType.startsWith('audio/') || mimeType.startsWith('video/');
};

// Returns true if Gemini supports this mimeType natively via inlineData
const isInlineDataSupported = (mimeType: string): boolean => {
    return mimeType.startsWith('image/') || 
           mimeType === 'application/pdf' ||
           mimeType.startsWith('audio/') ||
           mimeType.startsWith('video/');
};

// Helper to extract text from Office Open XML files (docx, pptx)
const extractTextFromOfficeFile = async (base64: string, mimeType: string): Promise<string> => {
    try {
        const zip = new JSZip();
        // Load the zip content (docx and pptx are just zips)
        const content = await zip.loadAsync(base64, { base64: true });
        let text = "";

        if (mimeType.includes("wordprocessingml")) { // .docx
            // Parse word/document.xml
            const xml = await content.file("word/document.xml")?.async("string");
            if (xml) {
                // Extract text inside <w:t> tags
                const matches = xml.match(/<w:t[^>]*>(.*?)<\/w:t>/g);
                if (matches) {
                    text = matches.map(tag => tag.replace(/<[^>]+>/g, '')).join(" ");
                }
            }
        } else if (mimeType.includes("presentationml")) { // .pptx
            // Parse ppt/slides/slide*.xml
            const slideFiles = Object.keys(content.files).filter(f => f.match(/ppt\/slides\/slide\d+\.xml/));
            
            // Simple sort to try and keep slide order roughly correct
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)![0]);
                const numB = parseInt(b.match(/\d+/)![0]);
                return numA - numB;
            });

            for (const filename of slideFiles) {
                const xml = await content.file(filename)?.async("string");
                if (xml) {
                    // Extract text inside <a:t> tags
                    const matches = xml.match(/<a:t[^>]*>(.*?)<\/a:t>/g);
                    if (matches) {
                        text += `[Slide ${filename.match(/\d+/)}] ` + matches.map(tag => tag.replace(/<[^>]+>/g, '')).join(" ") + "\n\n";
                    }
                }
            }
        }
        return text || "Error: No text found in document XML.";
    } catch (error) {
        console.error("Failed to parse office file:", error);
        return "Error: Could not parse Office document. Ensure it is a valid .docx or .pptx file.";
    }
};

export const summarizeContent = async (
  textContext: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  if (!ai || !apiKey) {
      return "Configuration Error: API Key is missing.";
  }

  try {
    const systemInstruction = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown.

    Based on the material, provide:
    - **Key Concepts:** Bulleted list of terms and definitions.
    - **Main Takeaways:** 2-3 sentences summarizing the core message.
    - **Potential Exam Questions:** 3 sample questions.
    
    If the document seems to be a list of questions (like a past paper), provide the answers or a guide on how to solve them.`;

    const parts: any[] = [];
    
    // Always include metadata/context text
    if (textContext) {
        parts.push({ text: `Context/Metadata:\n${textContext}` });
    }

    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) {
            return "⚠️ Format Not Supported. Please convert to PDF, DOCX, PPTX, or Image.";
        }

        if (isInlineDataSupported(mimeType)) {
            // PDF/Image: Send directly
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
            parts.push({ text: "Analyze the above file." });
        } else {
            // DOCX/PPTX: Parse text client-side and send as text
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            const extractedText = await extractTextFromOfficeFile(cleanBase64, mimeType);
            parts.push({ text: `\n\n--- Extracted Document Content ---\n${extractedText}\n----------------------------------` });
        }
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: { systemInstruction },
        contents: { parts }
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('403') || error.message?.includes('API key')) return "Error: Invalid API Key.";
    if (error.message?.includes('429')) return "Error: Quota exceeded.";
    return "Could not generate summary. Please try again.";
  }
};

export const generateStudySet = async (
  textContext: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  if (!ai || !apiKey) return [];
  
  try {
    let promptText = setType === 'flashcards' 
        ? `Generate 5-10 flashcards (term/definition) based on the material.`
        : `Generate a 5-question multiple-choice quiz based on the material.`;

    let schema;
    if (setType === 'flashcards') {
      schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            definition: { type: Type.STRING },
          },
          required: ['term', 'definition'],
        },
      };
    } else {
      schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
            },
            required: ['question', 'options', 'correctAnswer'],
        }
      };
    }

    const parts: any[] = [];
    parts.push({ text: promptText });
    
    if (textContext) parts.push({ text: `Context: ${textContext}` });

    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) return [];

        if (isInlineDataSupported(mimeType)) {
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
        } else {
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            const extractedText = await extractTextFromOfficeFile(cleanBase64, mimeType);
            parts.push({ text: `\n\nDocument Content:\n${extractedText}` });
        }
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        },
        contents: { parts }
    });

    const text = response.text;
    return text ? JSON.parse(text) : [];
  } catch (error) {
    console.error(`Error generating ${setType}:`, error);
    return [];
  }
};
