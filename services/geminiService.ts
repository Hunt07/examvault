
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
    if (!mimeType) return false;
    const supported = [
        'pdf', 'json', 'plain', 'csv', 'markdown', 'html', 'image', 'audio', 'video',
        'wordprocessingml', 'presentationml', 'msword', 'powerpoint' 
    ];
    return supported.some(t => mimeType.includes(t));
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// Generic XML Text Extractor (Namespace Agnostic, Tree Traversal & Regex Fallback)
const extractTextFromXmlContent = (xmlContent: string): string => {
    let extractedText = "";
    
    // Strategy 1: DOM Parser (Best for structure)
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        const textParts: string[] = [];

        // Get all elements
        const elements = xmlDoc.getElementsByTagName("*");
        
        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            // 't' = text in Word/PPT, 'v' = value in Excel
            if (el.localName === 't' || el.localName === 'v') {
                if (el.textContent) {
                    textParts.push(el.textContent);
                }
            }
        }
        extractedText = textParts.join(" ");
    } catch (e) {
        console.warn("DOM XML Parsing error", e);
    }

    // Strategy 2: Nuclear Regex (Fallback if DOM failed or returned almost nothing)
    // Matches content between > and < tags for things that look like text nodes (t or v)
    if (extractedText.length < 10) {
       // Look for <*:t>...</*:t> or just <t>...</t> ignoring attributes
       // Regex: < (optional namespace :) t (attributes) > (capture) < / (optional namespace :) t >
       const regex = /<(?:\w+:)?t[^>]*>(.*?)<\/(?:\w+:)?t>/g;
       let match;
       const parts = [];
       while ((match = regex.exec(xmlContent)) !== null) {
           parts.push(match[1]);
       }
       if (parts.length > 0) {
           extractedText = parts.join(" ");
       }
    }

    return extractedText;
};

const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        const documentXml = zip.file("word/document.xml");
        if (documentXml) {
            const xmlContent = await documentXml.async("string");
            return extractTextFromXmlContent(xmlContent);
        }
        return "";
    } catch (e) {
        console.error("DOCX Extraction failed", e);
        return "";
    }
};

const extractTextFromPptx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        let extractedText = "";

        // 1. Extract Slides
        const slideFolder = zip.folder("ppt/slides");
        if (slideFolder) {
            const slideFiles: any[] = [];
            slideFolder.forEach((relativePath, file) => {
                if (relativePath.match(/slide\d+\.xml/)) {
                    slideFiles.push({ path: relativePath, file: file });
                }
            });
            // Sort naturally: slide1, slide2, slide10
            slideFiles.sort((a, b) => {
                const numA = parseInt(a.path.match(/\d+/)?.[0] || "0");
                const numB = parseInt(b.path.match(/\d+/)?.[0] || "0");
                return numA - numB;
            });

            for (const slide of slideFiles) {
                const xmlContent = await slide.file.async("string");
                const text = extractTextFromXmlContent(xmlContent);
                if (text.trim().length > 0) {
                    extractedText += `[Slide ${slide.path.match(/\d+/)?.[0]}]: ${text}\n\n`;
                }
            }
        }

        // 2. Extract Notes (Speaker Notes) - vital for context
        const notesFolder = zip.folder("ppt/notesSlides");
        if (notesFolder) {
            let notesText = "";
            notesFolder.forEach(async (relativePath, file) => {
                 if (relativePath.match(/notesSlide\d+\.xml/)) {
                     const xmlContent = await file.async("string");
                     const text = extractTextFromXmlContent(xmlContent);
                     if (text.trim().length > 0) {
                         notesText += `[Note]: ${text}\n`;
                     }
                 }
            });
            if (notesText) {
                extractedText += "\n--- Speaker Notes ---\n" + notesText;
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
      return "Configuration Error: API Key is missing.";
  }

  try {
    const systemInstruction = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. 

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message.
- **Potential Exam Questions:** 3 sample questions that could be asked based on this material.`;

    const parts: any[] = [];
    
    // Check if it's a file
    if (fileBase64 && mimeType) {
        const isWord = mimeType.includes('wordprocessingml') || mimeType.includes('msword') || mimeType.includes('doc');
        const isPowerPoint = mimeType.includes('presentationml') || mimeType.includes('powerpoint') || mimeType.includes('ppt');
        const isPDF = mimeType.includes('pdf');
        const isImage = mimeType.startsWith('image/');

        if (isWord) {
            const text = await extractTextFromDocx(fileBase64);
            if (!text || text.length < 50) {
                return "⚠️ **Insufficient Text Content**\n\nWe couldn't extract enough text from this Word document. It might be empty or contain only non-text elements.\n\n**Tip:** Try converting it to PDF.";
            }
            parts.push({ text: `Analyze this document content:\n\n${text}` });
        } else if (isPowerPoint) {
            const text = await extractTextFromPptx(fileBase64);
            if (!text || text.length < 50) {
                return "⚠️ **Insufficient Text Content**\n\nWe couldn't extract text from this presentation. It likely contains scanned images of slides rather than editable text.\n\n**Tip:** Convert the PPT to PDF and upload the PDF.";
            }
            parts.push({ text: `Analyze these presentation slides:\n\n${text}` });
        } else if (isPDF || isImage) {
            // Native support
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
            parts.push({ text: "Analyze the document/image above." });
        } else {
            return `⚠️ **Format Not Supported**\n\nAI Summarization supports PDF, Images, Word (.docx), and PowerPoint (.pptx). \n\nDetected Type: ${mimeType}`;
        }
    } else {
        parts.push({ text: `\n\nMaterial to analyze:\n---\n${content}\n---` });
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
    if (error.message?.includes('429')) return "Error: Quota exceeded. Try again later.";
    return "Could not generate summary. Please check your connection.";
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
      promptText = `Generate 5-10 flashcards from the material.`;
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
      promptText = `Generate 5 multiple-choice questions from the material.`;
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
        const isWord = mimeType.includes('wordprocessingml') || mimeType.includes('doc');
        const isPowerPoint = mimeType.includes('presentationml') || mimeType.includes('ppt');
        const isPDF = mimeType.includes('pdf');
        const isImage = mimeType.startsWith('image/');

        if (isWord) {
            const text = await extractTextFromDocx(fileBase64);
            if (!text || text.length < 50) return []; 
            parts.push({ text: `${promptText}\n\nMaterial:\n${text}` });
        } else if (isPowerPoint) {
            const text = await extractTextFromPptx(fileBase64);
            if (!text || text.length < 50) return [];
            parts.push({ text: `${promptText}\n\nMaterial:\n${text}` });
        } else if (isPDF || isImage) {
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({ text: promptText });
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
        } else {
            return [];
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
                { text: "Analyze this image." }
            ]
        }
    });
    return response.text || "No description.";
  } catch (error) {
    return "Error describing image.";
  }
};
