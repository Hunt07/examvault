
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

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
        if (match[1]) {
            extracted += match[1] + " ";
        }
    }
    return extracted;
};

export const extractTextFromDocx = async (fileBase64: string): Promise<string> => {
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

export const extractTextFromPptx = async (fileBase64: string): Promise<string> => {
    try {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        const arrayBuffer = base64ToArrayBuffer(cleanBase64);
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        let extractedText = "";
        const slideFolder = zip.folder("ppt/slides");
        if (slideFolder) {
            const slideFiles: any[] = [];
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
        return extractedText.trim();
    } catch (e) {
        console.error("PPTX Extraction failed", e);
        return "";
    }
};

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string,
  extractedText?: string
): Promise<string> => {
  try {
    const systemInstruction = `You are an expert academic assistant for "ExamVault". Your task is to analyze the provided study material and create a highly informative, concise summary for a university student.
    
    Sections:
    - **Key Concepts:** Bulleted list of terms.
    - **Main Takeaways:** 2-3 summary sentences.
    - **Potential Exam Questions:** 3 practice questions.`;

    const parts: any[] = [];
    if (extractedText) {
        parts.push({ text: `Document Metadata:\n${content}\n\nDocument Content:\n${extractedText}` });
    } else if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts.push({ text: `Analyze this document. Metadata: ${content}` });
        parts.push({ inlineData: { data: cleanBase64, mimeType } });
    } else {
        parts.push({ text: `Analyze this material:\n${content}` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
        contents: { parts }
    });

    return response.text || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "Error generating summary. Please check your connection.";
  }
};

export const generateStudySet = async (
  content: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string,
  extractedText?: string
): Promise<any> => {
  try {
    let promptText = setType === 'flashcards' 
        ? `Generate 5-10 flashcards (term/definition).` 
        : `Generate 5 multiple-choice questions (question/options/correctAnswer).`;

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
    if (extractedText) {
        parts.push({ text: `${promptText}\n\nContent:\n${extractedText}` });
    } else if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts.push({ text: promptText });
        parts.push({ inlineData: { data: cleanBase64, mimeType } });
    } else {
        parts.push({ text: `${promptText}\n\nMaterial:\n${content}` });
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: {
            responseMimeType: "application/json",
            responseSchema: schema
        },
        contents: { parts }
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error(`Error generating ${setType}:`, error);
    return [];
  }
};
