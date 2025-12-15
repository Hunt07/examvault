
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

// Robustly retrieve API Key
const getApiKey = (): string => {
  // 1. Try standard Vite injection (most likely source)
  // @ts-ignore
  if (import.meta.env && import.meta.env.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }

  // 2. Fallback for some cloud environments or alternative setups
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.VITE_API_KEY || process.env.API_KEY || "";
    }
  } catch (e) {
    // ignore
  }

  return "";
};

const apiKey = getApiKey();

// Initialize AI client conditionally
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
        // Office formats (via extraction)
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' // pptx
    ];
    if (supportedExact.includes(mimeType)) return true;
    if (mimeType.startsWith('image/')) return true;
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

// Helper: Generic XML Text Extractor (Namespace Agnostic)
// targetTag is the localName of the tag containing text (e.g., 't' for both docx and pptx)
const extractTextFromXmlContent = (xmlContent: string, targetTag: string = 't'): string => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, "application/xml");
    const textNodes: string[] = [];

    // XPath is robust but maybe overkill/slow for simple 't' tags. 
    // Let's use a TreeWalker or simple recursive search for robustness against namespaces.
    const elements = xmlDoc.getElementsByTagName("*");
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        // Check localName to ignore namespaces (w:t, a:t, etc.)
        if (el.localName === targetTag) {
            if (el.textContent) {
                textNodes.push(el.textContent);
            }
        }
    }
    return textNodes.join(" ");
};

// Helper: Extract text from DOCX (using JSZip + XML Parsing)
// Structure: word/document.xml -> w:body -> ... -> w:t
const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Main content is usually in word/document.xml
        const documentXml = zip.file("word/document.xml");
        if (!documentXml) {
            console.warn("word/document.xml not found in docx");
            return "";
        }

        const xmlContent = await documentXml.async("string");
        const extractedText = extractTextFromXmlContent(xmlContent, 't'); // w:t
        
        return extractedText.trim();
    } catch (e) {
        console.error("DOCX Extraction failed", e);
        return "";
    }
};

// Helper: Extract text from PPTX (using JSZip + XML Parsing)
// Structure: ppt/slides/slideX.xml -> ... -> a:t
const extractTextFromPptx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        const slideFiles: any[] = [];
        const slideFolder = zip.folder("ppt/slides");
        
        if (slideFolder) {
            slideFolder.forEach((relativePath, file) => {
                if (relativePath.match(/slide\d+\.xml/)) {
                    slideFiles.push({ path: relativePath, file: file });
                }
            });
        }

        if (slideFiles.length === 0) return "";

        // Sort slides naturally (slide1, slide2, slide10...)
        slideFiles.sort((a, b) => {
            const numA = parseInt(a.path.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.path.match(/\d+/)?.[0] || "0");
            return numA - numB;
        });

        let extractedText = "";

        for (const slide of slideFiles) {
            const xmlContent = await slide.file.async("string");
            const slideText = extractTextFromXmlContent(xmlContent, 't'); // a:t
            
            if (slideText.trim().length > 0) {
                // Formatting for the AI to understand slide separation
                extractedText += `[Slide ${slide.path.match(/\d+/)?.[0]}]: ${slideText}\n\n`;
            }
        }
        
        return extractedText.trim();
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
      console.error("Missing API Key");
      return "Configuration Error: API Key is missing. Please ensure VITE_API_KEY is set in your .env.local file and restart the server.";
  }

  try {
    const systemInstruction = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.`;

    const parts: any[] = [];
    
    // Handle File Input
    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) {
            return "⚠️ **Format Not Supported**\n\nAI Summarization is available for **PDFs**, **Images**, **Word (.docx)**, and **PowerPoint (.pptx)**.\n\nLegacy binary formats like .doc and .ppt are not supported. Please convert them to the newer formats.";
        }

        // Branching logic for extraction
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            if (!extractedText || extractedText.length < 50) {
                return "⚠️ **Insufficient Content**\n\nWe couldn't extract enough text from this Word document to generate a summary. It might contain mostly images, equations, or be empty. Try converting it to PDF first.";
            }
            parts.push({ text: `Analyze the following document content:\n\n${extractedText}` });
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            if (!extractedText || extractedText.length < 50) {
                return "⚠️ **Insufficient Content**\n\nWe couldn't extract enough text from this PowerPoint presentation. It likely contains images of text (scanned slides) rather than selectable text. \n\n**Tip:** Convert the PPT to PDF and upload the PDF for better results.";
            }
            parts.push({ text: `Analyze the following presentation slides:\n\n${extractedText}` });
        } else {
            // PDF or Image (Native Support)
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
            parts.push({ text: "Analyze the above document/image." });
        }
    } else {
        parts.push({ text: `\n\nMaterial to analyze:\n---\n${content}\n---` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
        },
        contents: { parts }
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('403') || error.message?.includes('API key')) {
        return "Error: Invalid or revoked API Key.";
    }
    if (error.message?.includes('429')) {
        return "Error: Quota exceeded. Please try again later.";
    }
    return "Could not generate summary. Please check your Internet connection or file integrity.";
  }
};

export const generateStudySet = async (
  content: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  if (!ai || !apiKey) {
      console.error("API Key missing");
      return [];
  }
  try {
    let promptText;
    let schema;

    if (setType === 'flashcards') {
      promptText = `Analyze the provided study material and generate a set of 5-10 flashcards.`;
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
                options: { 
                    type: Type.ARRAY, 
                    items: { type: Type.STRING } 
                },
                correctAnswer: { type: Type.STRING },
            },
            required: ['question', 'options', 'correctAnswer'],
        }
      };
    }

    const parts: any[] = [];
    
    // Handle File Input
    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) {
             console.warn("Unsupported MIME type for study set generation:", mimeType);
             return []; 
        }

        // Branching logic for extraction
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            if (!extractedText || extractedText.length < 50) return []; // Fail silently or handle in UI
            parts.push({ text: `${promptText}\n\nMaterial:\n${extractedText}` });
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            if (!extractedText || extractedText.length < 50) return []; // Fail silently or handle in UI
            parts.push({ text: `${promptText}\n\nMaterial:\n${extractedText}` });
        } else {
            // PDF or Image
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({ text: promptText });
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
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
    console.error(`Error generating ${setType} with Gemini:`, error);
    return [];
  }
};

// Kept for backward compatibility if needed elsewhere
export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  if (!ai || !apiKey) return "Error: API Key missing.";
  try {
    const cleanBase64 = base64Data.replace(/^data:.+;base64,/, '');
    const prompt = "Analyze this image from a study document. Describe the key information, including any text, diagrams, or main concepts.";

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
            parts: [
                { inlineData: { mimeType, data: cleanBase64 } },
                { text: prompt }
            ]
        }
    });

    return response.text || "No description generated.";
  } catch (error) {
    console.error("Error describing image with Gemini:", error);
    return "Could not generate a description for the image.";
  }
};
