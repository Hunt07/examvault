
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

// Strictly use process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

const extractTextFromXmlContent = (xmlContent: string): string => {
    const regex = /<(?:\w+:)?t[^>]*>(.*?)<\/(?:\w+:)?t>/g;
    let match;
    let extracted = "";
    while ((match = regex.exec(xmlContent)) !== null) {
        if (match[1]) extracted += match[1] + " ";
    }
    return extracted;
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
        const slideFolder = zip.folder("ppt/slides");
        if (slideFolder) {
            const slideFiles: any[] = [];
            slideFolder.forEach((relativePath, file) => {
                if (relativePath.match(/slide\d+\.xml/)) slideFiles.push({ path: relativePath, file: file });
            });
            slideFiles.sort((a, b) => parseInt(a.path.match(/\d+/)?.[0] || "0") - parseInt(b.path.match(/\d+/)?.[0] || "0"));
            for (const slide of slideFiles) {
                const xmlContent = await slide.file.async("string");
                extractedText += `[Slide]: ${extractTextFromXmlContent(xmlContent)}\n\n`;
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
    const systemInstruction = "You are an expert academic assistant. Create a markdown summary with sections: Key Concepts, Main Takeaways, and 3 Potential Exam Questions.";
    const parts: any[] = [];
    
    if (fileBase64 && mimeType) {
        const isWord = mimeType.includes('wordprocessingml') || mimeType.includes('msword') || mimeType.includes('doc');
        const isPowerPoint = mimeType.includes('presentationml') || mimeType.includes('powerpoint') || mimeType.includes('ppt');
        const isNative = mimeType.includes('pdf') || mimeType.startsWith('image/');

        if (isWord) {
            const text = await extractTextFromDocx(fileBase64);
            parts.push({ text: `Document Info: ${metadata}\n\nContent: ${text || 'No text extracted'}` });
        } else if (isPowerPoint) {
            const text = await extractTextFromPptx(fileBase64);
            parts.push({ text: `Presentation Info: ${metadata}\n\nContent: ${text || 'No text extracted'}` });
        } else if (isNative) {
            parts.push({ text: `Analyze this material. Info: ${metadata}` });
            parts.push({ inlineData: { data: fileBase64.replace(/^data:.+;base64,/, ''), mimeType } });
        } else {
            return "⚠️ Format not supported for AI analysis.";
        }
    } else {
        parts.push({ text: `Analyze this material: ${metadata}` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
        contents: [{ role: 'user', parts }]
    });

    return response.text || "No summary could be generated.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return "AI is currently unavailable. Please try again later.";
  }
};

export const generateStudySet = async (
  metadata: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  try {
    const promptText = setType === 'flashcards' ? "Generate 5-8 flashcards (term and definition)." : "Generate 5 multiple-choice questions.";
    const schema = setType === 'flashcards' ? {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { term: { type: Type.STRING }, definition: { type: Type.STRING } },
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
            parts.push({ text: `${promptText}\n\nMaterial: ${text}` });
        } else {
            parts.push({ text: promptText });
            parts.push({ inlineData: { data: fileBase64.replace(/^data:.+;base64,/, ''), mimeType } });
        }
    } else {
        parts.push({ text: `${promptText}\n\nMaterial: ${metadata}` });
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { responseMimeType: "application/json", responseSchema: schema },
        contents: [{ role: 'user', parts }]
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error(`Error generating ${setType}:`, error);
    return [];
  }
};
