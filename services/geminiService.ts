
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

// "Nuclear" Regex Extraction: Finds text inside any tag ending in 't' (like <w:t>, <a:t>, <t>)
// This ignores XML namespaces and attributes, ensuring we catch all text content.
const extractTextFromXmlContent = (xmlContent: string): string => {
    // Regex explanation:
    // < : start of tag
    // (?:[\w:]+)? : optional namespace prefix (e.g. "w:", "a:", or nothing)
    // t : tag name ends in 't' (standard for text in Office XML)
    // [^>]* : any attributes
    // > : end of opening tag
    // (.*?) : capture the text content (non-greedy)
    // <\/ : start of closing tag
    const regex = /<(?:\w+:)?t[^>]*>(.*?)<\/(?:\w+:)?t>/g;
    
    let match;
    let extracted = "";
    
    // Iterate through all matches
    while ((match = regex.exec(xmlContent)) !== null) {
        if (match[1]) {
            extracted += match[1] + " ";
        }
    }
    
    return extracted;
};

const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Try main document
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
            
            // Sort naturally (1, 2, 10 instead of 1, 10, 2)
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

        // 2. Extract Speaker Notes (often contain the script)
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
  content: string, // This is the metadata (Title, Course, etc.)
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
                return "⚠️ **Insufficient Text Content**\n\nWe couldn't extract enough text from this Word document. It might be empty or contain only images.\n\n**Tip:** Convert to PDF for better results.";
            }
            // Combine Metadata + Extracted Text
            parts.push({ text: `Document Metadata:\n${content}\n\nDocument Content:\n${text}` });
        } else if (isPowerPoint) {
            const text = await extractTextFromPptx(fileBase64);
            if (!text || text.length < 50) {
                return "⚠️ **Insufficient Text Content**\n\nWe couldn't extract text from this presentation. It likely contains images of text (scanned slides). \n\n**Tip:** Convert to PDF and upload the PDF.";
            }
            // Combine Metadata + Extracted Text
            parts.push({ text: `Presentation Metadata:\n${content}\n\nPresentation Slides & Notes:\n${text}` });
        } else if (isPDF || isImage) {
            // Native support - Add metadata as text, file as inlineData
            parts.push({ text: `Analyze the following document/image. Metadata: ${content}` });
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
        } else {
            return `⚠️ **Format Not Supported**\n\nAI Summarization supports PDF, Images, Word (.docx), and PowerPoint (.pptx).`;
        }
    } else {
        // No file, just text content (Metadata or Mock content)
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
      promptText = `Generate 5-10 flashcards based on the material.`;
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
      promptText = `Generate 5 multiple-choice questions based on the material.`;
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
            parts.push({ text: `${promptText}\n\nMetadata: ${content}\n\nContent:\n${text}` });
        } else if (isPowerPoint) {
            const text = await extractTextFromPptx(fileBase64);
            if (!text || text.length < 50) return [];
            parts.push({ text: `${promptText}\n\nMetadata: ${content}\n\nContent:\n${text}` });
        } else if (isPDF || isImage) {
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
            parts.push({ text: `${promptText}\n\nMetadata: ${content}` });
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
