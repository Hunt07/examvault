
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
        // Office formats (via extraction)
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
        'image/jpeg',
        'image/png',
        'image/webp'
    ];
    return supportedExact.includes(mimeType) || mimeType.startsWith('image/') || mimeType.startsWith('text/');
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

// Helper: Manual XML Text Extraction using DOMParser (Fallback)
const extractXmlTextByTag = (xmlString: string, tagName: string): string => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const textNodes = xmlDoc.getElementsByTagName("*");
        let text = "";
        
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            if (node.localName === tagName && node.textContent) {
                text += node.textContent + " ";
            }
        }
        return text.trim();
    } catch (e) {
        console.error("XML Parse Error", e);
        return "";
    }
};

// Helper: Extract text from DOCX
const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        
        // 1. Try Mammoth (Standard Library)
        try {
            const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            const text = result.value.trim();
            if (text.length > 50) return text;
        } catch (err) {
            console.warn("Mammoth extraction failed, trying fallback", err);
        }

        // 2. Fallback: Manual XML Parsing of word/document.xml
        const zip = await JSZip.loadAsync(arrayBuffer);
        const docXml = await zip.file("word/document.xml")?.async("string");
        
        if (docXml) {
            const manualText = extractXmlTextByTag(docXml, "t"); // 't' is text tag in WordXML
            if (manualText.length > 0) return manualText;
        }

        return "";
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
        
        const xmlFiles: { path: string, file: any }[] = [];
        
        // Scan for slide XML files
        zip.forEach((relativePath, file) => {
            if (relativePath.match(/ppt\/slides\/slide\d+\.xml/i)) {
                xmlFiles.push({ path: relativePath, file: file });
            }
        });

        // Sort slides naturally
        xmlFiles.sort((a, b) => {
            const numA = parseInt(a.path.match(/slide(\d+)\.xml/)?.[1] || "0");
            const numB = parseInt(b.path.match(/slide(\d+)\.xml/)?.[1] || "0");
            return numA - numB;
        });

        let extractedText = "";
        
        for (const slide of xmlFiles) {
            const xmlContent = await slide.file.async("string");
            const slideText = extractXmlTextByTag(xmlContent, "t"); // 't' is text tag in DrawingML

            if (slideText.trim()) {
                const slideNum = slide.path.match(/slide(\d+)\.xml/)?.[1];
                extractedText += `[Slide ${slideNum}]: ${slideText}\n\n`;
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
      return "Configuration Error: API Key is missing. Please ensure VITE_API_KEY is set in your .env.local file and restart the server.";
  }

  try {
    const systemInstruction = `You are an expert academic assistant. Your PRIMARY task is to analyze the ACTUAL CONTENT of the provided file (PDF, Image, etc.).

    CRITICAL INSTRUCTIONS:
    1. READ the file content provided in the user's message.
    2. Do NOT rely solely on the "Metadata" context unless the file content is empty or unreadable.
    3. If the file content contradicts the metadata, trust the file content.
    4. Create a highly informative, concise summary for a university student, formatted in markdown.
    5. Focus on what's most important for exam preparation.

    Structure the summary with these exact sections:
    - **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts found IN THE DOCUMENT.
    - **Main Takeaways:** 2-3 sentences summarizing the core message of the document.
    - **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked based on this specific document's content.`;

    const parts: any[] = [];
    
    // Handle File Input
    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) {
            return "⚠️ **Format Not Supported**\n\nAI Summarization is available for **PDFs**, **Images**, **Word (.docx)**, and **PowerPoint (.pptx)**.\n\nLegacy binary formats like .doc and .ppt are not supported. Please convert them to the newer formats.";
        }

        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');

        // Branching logic for extraction
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            if (!extractedText || extractedText.length < 50) {
                return "⚠️ **No Readable Text Found**\n\nThe AI could not extract enough text from this Word document.\n\n**Possible reasons:**\n- The document contains scanned images instead of text.\n- The file is empty or corrupted.\n\n*Try converting the file to PDF first.*";
            }
            parts.push({ text: `Analyze the following document content:\n\n${extractedText}\n\nMetadata Context:\n${content}` });
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            if (!extractedText || extractedText.length < 20) {
                return "⚠️ **No Readable Text Found**\n\nThe AI could not extract text from this presentation.\n\n**Possible reasons:**\n- The slides contain only images or screenshots (scanned).\n- The text is inside complex shapes/SmartArt not supported by the extractor.\n\n*Try converting the file to PDF first for better results.*";
            }
            parts.push({ text: `Analyze the following presentation slides:\n\n${extractedText}\n\nMetadata Context:\n${content}` });
        } else {
            // PDF or Image (Native Support)
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
            // Include metadata/context to help the model if file content is ambiguous
            parts.push({ text: `Analyze the document attached above.\n\nMetadata Context (Use only if document is unclear):\n${content}` });
        }
    } else {
        // Metadata only fallback
        parts.push({ text: `\n\nContext/Metadata:\n---\n${content}\n---` });
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
      promptText = `Analyze the provided study material and generate a set of 5-10 flashcards based STRICTLY on its content.`;
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
      promptText = `Analyze the provided study material and generate a 5-question multiple-choice quiz based STRICTLY on its content.`;
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

        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');

        // Branching logic for extraction
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            if (!extractedText || extractedText.length < 50) return [];
            parts.push({ text: `${promptText}\n\nMaterial:\n${extractedText}\n\nContext:\n${content}` });
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            if (!extractedText || extractedText.length < 20) return [];
            parts.push({ text: `${promptText}\n\nMaterial:\n${extractedText}\n\nContext:\n${content}` });
        } else {
            // PDF or Image
            // Include metadata context
            parts.push({ text: `${promptText}\n\nMetadata Context:\n${content}` });
            
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: mimeType
                }
            });
        }
    } else {
        parts.push({ text: `${promptText}\n\nContext/Metadata:\n---\n${content}\n---` });
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
