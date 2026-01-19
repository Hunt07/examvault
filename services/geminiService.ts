
import { GoogleGenAI, Type, Chat } from "@google/genai";
// @ts-ignore
import mammoth from "mammoth";
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

// Helper: Manual XML Text Extraction using DOMParser (Fallback)
const extractXmlTextByTag = (xmlString: string, tagName: string): string => {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const textNodes = xmlDoc.getElementsByTagName("*");
        let text = "";
        
        for (let i = 0; i < textNodes.length; i++) {
            const node = textNodes[i];
            // Check localName to ignore namespaces (e.g., 'w:t' -> 't', 'a:t' -> 't')
            if (node.localName === tagName) {
                if (node.textContent) {
                    text += node.textContent + " ";
                }
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
            if (text.length > 50) return text; // If we got a decent amount of text, return it
        } catch (err) {
            console.warn("Mammoth extraction failed, trying manual fallback", err);
        }

        // 2. Fallback: Manual XML Parsing of word/document.xml
        // This helps catch text in textboxes or headers that mammoth might skip
        const zip = await JSZip.loadAsync(arrayBuffer);
        const docXml = await zip.file("word/document.xml")?.async("string");
        
        if (docXml) {
            // 't' is the tag for text in WordXML (<w:t>)
            const manualText = extractXmlTextByTag(docXml, "t");
            if (manualText.length > 0) return manualText;
        }

        return "";
    } catch (e) {
        console.error("DOCX Extraction failed", e);
        throw new Error("Failed to extract text from Word document.");
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

        // Sort slides naturally (slide1, slide2, slide10...)
        xmlFiles.sort((a, b) => {
            const numA = parseInt(a.path.match(/slide(\d+)\.xml/)?.[1] || "0");
            const numB = parseInt(b.path.match(/slide(\d+)\.xml/)?.[1] || "0");
            return numA - numB;
        });

        let extractedText = "";
        
        for (const slide of xmlFiles) {
            const xmlContent = await slide.file.async("string");
            
            // Use DOMParser instead of Regex for robust XML handling
            // 't' is the tag for text in DrawingML (<a:t>)
            const slideText = extractXmlTextByTag(xmlContent, "t");

            if (slideText.trim()) {
                const slideNum = slide.path.match(/slide(\d+)\.xml/)?.[1];
                extractedText += `[Slide ${slideNum}]: ${slideText}\n\n`;
            }
        }
        
        return extractedText.trim();
    } catch (e) {
        console.error("PPTX Extraction failed", e);
        throw new Error("Failed to extract text from PowerPoint presentation.");
    }
};

// Unified helper to process content and file for AI consumption
const processContentForAI = async (
    content: string, 
    fileBase64?: string, 
    mimeType?: string
): Promise<{ parts: any[], error?: string }> => {
    const parts: any[] = [];

    if (fileBase64 && mimeType) {
        if (!isMimeTypeSupported(mimeType)) {
            return { parts, error: "Format not supported" };
        }

        // Branching logic for extraction
        if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const extractedText = await extractTextFromDocx(fileBase64);
            if (!extractedText || extractedText.length < 50) {
                return { parts, error: "Could not extract text from DOCX" };
            }
            parts.push({ text: `Analyze the following document content:\n\n${extractedText}\n\nMetadata Context:\n${content}` });
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
            const extractedText = await extractTextFromPptx(fileBase64);
            if (!extractedText || extractedText.length < 20) {
                return { parts, error: "Could not extract text from PPTX" };
            }
            parts.push({ text: `Analyze the following presentation slides:\n\n${extractedText}\n\nMetadata Context:\n${content}` });
        } else {
            // PDF or Image (Native Support)
            const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
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
    
    return { parts };
};

export const createChatSession = async (
    content: string,
    fileBase64?: string,
    mimeType?: string
): Promise<{ chat: Chat | null, initialError?: string }> => {
    if (!ai || !apiKey) {
        return { chat: null, initialError: "API Key Missing" };
    }

    const { parts, error } = await processContentForAI(content, fileBase64, mimeType);
    
    // We initiate the chat. 
    // We will inject the document in the history as the user's "first" hidden message or system instruction context
    // However, ai.chats.create doesn't support 'parts' in systemInstruction easily in all versions, 
    // and sending it as the first message is the most robust way to "load" the context.
    
    const systemInstruction = `You are an expert academic assistant for University students.
    You are currently assisting a student with a specific document.
    
    Your goal is to answer ANY questions they have about this document: summaries, quizzes, explanations, etc.
    
    If the document content is provided, analyze it deeply.
    If the document content is missing or unreadable, use the provided Metadata Context to answer as best as you can, but explicitly tell the student you couldn't read the file itself.
    
    Always be helpful, encouraging, and academic in tone. Use Markdown for formatting.`;

    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction }
    });

    try {
        // Prime the chat with the document content immediately.
        // This message acts as the "Context Loading" step.
        // We won't display this exchange in the UI.
        let primeMessage = parts;
        if (primeMessage.length === 0) {
             primeMessage = [{ text: `Metadata Context:\n${content}` }];
        }
        
        // Pass the parts array directly to the 'message' property
        await chat.sendMessage({ message: primeMessage });
        
        return { chat, initialError: error };
    } catch (e: any) {
        console.error("Failed to initialize chat with document", e);
        return { chat: null, initialError: "Failed to process document for chat." };
    }
};

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  if (!ai || !apiKey) return "Configuration Error: API Key missing.";

  try {
    const { parts, error } = await processContentForAI(content, fileBase64, mimeType);
    if (error) return `⚠️ ${error}`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: "You are an expert academic assistant. Summarize the provided content.",
        },
        contents: { parts }
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "Could not generate summary.";
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
    let promptText = setType === 'flashcards' 
        ? `Generate 5-10 flashcards (term/definition).`
        : `Generate 5 multiple-choice questions.`;
        
    let schema = setType === 'flashcards' 
        ? { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, definition: { type: Type.STRING } }, required: ['term', 'definition'] } }
        : { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, correctAnswer: { type: Type.STRING } }, required: ['question', 'options', 'correctAnswer'] } };

    const { parts, error } = await processContentForAI(content, fileBase64, mimeType);
    if (error) return []; // Or handle error appropriately

    // Append the specific instruction to the parts
    parts.push({ text: promptText });

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
