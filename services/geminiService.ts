
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
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
        'text/plain',
        'text/csv', 
        'text/markdown',
        'text/html',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' // pptx
    ];
    if (supportedExact.includes(mimeType)) return true;
    if (mimeType.startsWith('image/')) return true;
    // Gemini 1.5/2.5 supports audio/video natively too
    if (mimeType.startsWith('audio/')) return true;
    if (mimeType.startsWith('video/')) return true;
    return false;
};

// Helper: Convert Base64 string to ArrayBuffer
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// Helper: Extract text from DOCX
const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value || "";
    } catch (e) {
        console.error("DOCX Extraction failed", e);
        return "";
    }
};

// Helper: Extract text from PPTX
const extractTextFromPptx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        const slideFiles: any[] = [];
        const slideFolder = zip.folder("ppt/slides");
        
        if (slideFolder) {
            slideFolder.forEach((relativePath: string, file: any) => {
                if (relativePath.match(/slide\d+\.xml/)) {
                    slideFiles.push({ path: relativePath, file: file });
                }
            });
        }

        if (slideFiles.length === 0) return "";

        // Sort slides naturally
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.path.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.path.match(/\d+/)?.[0] || "0");
            return numA - numB;
        });

        let extractedText = "";
        const parser = new DOMParser();

        for (const slide of slideFiles) {
            const xmlContent = await slide.file.async("string");
            const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
            
            let textNodes = Array.from(xmlDoc.getElementsByTagName("a:t"));
            if (textNodes.length === 0) {
                textNodes = Array.from(xmlDoc.getElementsByTagName("t"));
            }

            const slideText = textNodes
                .map((node: any) => node.textContent)
                .join(" ")
                .replace(/\s+/g, ' ')
                .trim();
            
            if (slideText.length > 0) {
                extractedText += `[Slide ${slide.path.match(/\d+/)?.[0]}]: ${slideText}\n\n`;
            }
        }
        return extractedText;
    } catch (e) {
        console.error("PPTX Extraction failed", e);
        return "";
    }
};

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  if (!ai || !apiKey) {
      return "Configuration Error: API Key is missing. Please ensure VITE_API_KEY is set in your .env.local file.";
  }

  try {
    const systemInstruction = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown.
    
    If the content is a document (PDF, Word, PPT), analyze the visible text and structure.
    If the file content appears empty or unreadable, explicitly state that.

    The summary MUST include these exact sections:
    - **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
    - **Main Takeaways:** 2-3 sentences summarizing the core message.
    - **Potential Exam Questions:** A numbered list of 3 sample questions.`;

    const parts: any[] = [];
    
    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) {
            return "⚠️ **Format Not Supported**\n\nAI Summarization is available for PDFs, Images, Word (.docx), and PowerPoint (.pptx).";
        }

        // For Office documents, try local extraction first as it can be more reliable for text-heavy content
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            if (extractedText && extractedText.length > 50) {
                parts.push({ text: `Analyze the following document content:\n\n${extractedText}` });
            } else {
                // Fallback to sending binary if extraction fails (though Gemini might not support docx binary directly, text is safer)
                 return "⚠️ **Insufficient Content**\n\nCould not extract text from this Word document.";
            }
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            if (extractedText && extractedText.length > 50) {
                parts.push({ text: `Analyze the following presentation slides:\n\n${extractedText}` });
            } else {
                 return "⚠️ **Insufficient Content**\n\nCould not extract text from this PowerPoint.";
            }
        } else {
            // PDF, Image, etc. - Send as Inline Data
            // Strip the Data URI prefix if present to get raw base64
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
            parts.push({ text: "Analyze the above document." });
        }
    } else {
        parts.push({ text: `\n\nMaterial to analyze:\n---\n${content}\n---` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.3, // Lower temperature for more factual summaries
        },
        contents: { parts } // Wrap in parts object
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('403') || error.message?.includes('API key')) return "Error: Invalid or revoked API Key.";
    if (error.message?.includes('429')) return "Error: Quota exceeded. Please try again later.";
    return "Could not generate summary. Please check your Internet connection.";
  }
};

export const generateStudySet = async (
  content: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  if (!ai || !apiKey) return [];
  
  try {
    let promptText;
    let schema;

    if (setType === 'flashcards') {
      promptText = `Analyze the provided study material and generate 5-10 flashcards.`;
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
      promptText = `Analyze the provided study material and generate a 5-question multiple-choice quiz.`;
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
    
    if (fileBase64 && mimeType) {
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            parts.push({ text: `${promptText}\n\nMaterial:\n${extractedText}` });
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            parts.push({ text: `${promptText}\n\nMaterial:\n${extractedText}` });
        } else {
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
            parts.push({ text: promptText });
        }
    } else {
        parts.push({ text: `${promptText}\n\nMaterial:\n---\n${content}\n---` });
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

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  if (!ai || !apiKey) return "Error: API Key missing.";
  try {
    const cleanBase64 = base64Data.replace(/^data:.+;base64,/, '');
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType, data: cleanBase64 } },
                { text: "Analyze this image from a study document. Describe key info." }
            ]
        }
    });
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Error describing image:", error);
    return "Could not generate a description.";
  }
};
