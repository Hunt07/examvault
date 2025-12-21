
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

// Strictly initialize using the environment variable as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64.replace(/^data:.+;base64,/, ''));
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

/**
 * "Nuclear" Regex Extraction: Finds text inside any tag ending in 't' (like <w:t>, <a:t>, <t>)
 */
const extractTextFromXmlContent = (xmlContent: string): string => {
    const regex = /<(?:\w+:)?t[^>]*>(.*?)<\/(?:\w+:)?t>/g;
    let match;
    let extracted = "";
    while ((match = regex.exec(xmlContent)) !== null) {
        if (match[1]) {
            extracted += match[1] + " ";
        }
    }
    return extracted;
};

const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
    try {
        const arrayBuffer = base64ToArrayBuffer(fileBase64);
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
        const arrayBuffer = base64ToArrayBuffer(fileBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        let extractedText = "";

        const slideFolder = zip.folder("ppt/slides");
        if (slideFolder) {
            const slideFiles: { path: string, file: any }[] = [];
            slideFolder.forEach((relativePath, file) => {
                if (relativePath.match(/slide\d+\.xml/)) {
                    slideFiles.push({ path: relativePath, file: file });
                }
            });
            
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

        const notesFolder = zip.folder("ppt/notesSlides");
        if (notesFolder) {
            let notesText = "";
            const noteFiles: any[] = [];
            notesFolder.forEach((relativePath, file) => {
                 if (relativePath.match(/notesSlide\d+\.xml/)) {
                     noteFiles.push(file);
                 }
            });
            for(const file of noteFiles) {
                const xmlContent = await file.async("string");
                const text = extractTextFromXmlContent(xmlContent);
                if (text.trim().length > 0) {
                    notesText += `[Note]: ${text}\n`;
                }
            }
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
  metadata: string,
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  try {
    const systemInstruction = "You are an expert academic assistant. Analyze the material and provide a markdown summary with exactly these sections: **Key Concepts**, **Main Takeaways**, and **Potential Exam Questions** (3 questions).";
    const parts: any[] = [];
    
    if (fileBase64 && mimeType) {
        const isWord = mimeType.includes('wordprocessingml') || mimeType.includes('msword') || mimeType.includes('doc');
        const isPowerPoint = mimeType.includes('presentationml') || mimeType.includes('powerpoint') || mimeType.includes('ppt');
        const isPDF = mimeType.includes('pdf');
        const isImage = mimeType.startsWith('image/');

        if (isWord) {
            const text = await extractTextFromDocx(fileBase64);
            parts.push({ text: `Metadata:\n${metadata}\n\nExtracted Word Content:\n${text || "No text could be extracted."}` });
        } else if (isPowerPoint) {
            const text = await extractTextFromPptx(fileBase64);
            parts.push({ text: `Metadata:\n${metadata}\n\nExtracted PowerPoint Content:\n${text || "No text could be extracted."}` });
        } else if (isPDF || isImage) {
            parts.push({ text: `Analyze this material. Metadata: ${metadata}` });
            parts.push({ inlineData: { data: fileBase64.replace(/^data:.+;base64,/, ''), mimeType } });
        } else {
            return "⚠️ Format not supported for AI Summarization. Please use PDF, Word, PowerPoint, or Images.";
        }
    } else {
        parts.push({ text: `Analyze this study material: ${metadata}` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
        contents: [{ role: 'user', parts }]
    });

    return response.text || "Summary generation returned no text.";
  } catch (error: any) {
    console.error("Gemini Summary Error:", error);
    return "AI Summarization is currently unavailable. Please check your file and try again.";
  }
};

export const generateStudySet = async (
  metadata: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  try {
    const promptText = setType === 'flashcards' 
        ? "Generate 5-10 flashcards (term and definition) based on this material." 
        : "Generate 5 multiple-choice questions (question, options array, and correctAnswer) based on this material.";
    
    const schema = setType === 'flashcards' ? {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            definition: { type: Type.STRING }
          },
          required: ['term', 'definition'],
        },
      } : {
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

    const parts: any[] = [];
    if (fileBase64 && mimeType) {
        if (mimeType.includes('word') || mimeType.includes('powerpoint')) {
            const text = mimeType.includes('word') ? await extractTextFromDocx(fileBase64) : await extractTextFromPptx(fileBase64);
            parts.push({ text: `${promptText}\n\nContent:\n${text || metadata}` });
        } else {
            parts.push({ text: `${promptText}\n\nMetadata: ${metadata}` });
            parts.push({ inlineData: { data: fileBase64.replace(/^data:.+;base64,/, ''), mimeType } });
        }
    } else {
        parts.push({ text: `${promptText}\n\nContext:\n${metadata}` });
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { 
            responseMimeType: "application/json", 
            responseSchema: schema 
        },
        contents: [{ role: 'user', parts }]
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error(`Error generating ${setType}:`, error);
    return [];
  }
};

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{
            role: 'user',
            parts: [
                { inlineData: { mimeType, data: base64Data.replace(/^data:.+;base64,/, '') } },
                { text: "Analyze this image for academic purposes." }
            ]
        }]
    });
    return response.text || "No description generated.";
  } catch (error) {
    return "Error describing image.";
  }
};
