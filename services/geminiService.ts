
import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

// Strictly initialize using the environment variable as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * Utility to convert a File object to Base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
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

export const extractTextFromDocx = async (file: File): Promise<string> => {
    try {
        const zip = await JSZip.loadAsync(file);
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

export const extractTextFromPptx = async (file: File): Promise<string> => {
    try {
        const zip = await JSZip.loadAsync(file);
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
        return extractedText.trim();
    } catch (e) {
        console.error("PPTX Extraction failed", e);
        return "";
    }
};

export const summarizeContent = async (
  metadata: string,
  fileBase64?: string, 
  mimeType?: string,
  extractedText?: string
): Promise<string> => {
  try {
    const systemInstruction = "You are an expert academic assistant. Analyze the material and provide a markdown summary with exactly these sections: **Key Concepts**, **Main Takeaways**, and **Potential Exam Questions** (3 questions).";
    const parts: any[] = [];
    
    // Prioritize extracted text (Office files)
    if (extractedText) {
        parts.push({ text: `Context: ${metadata}\n\nDocument Content:\n${extractedText}` });
    } else if (fileBase64 && mimeType) {
        parts.push({ text: `Analyze this material. Metadata: ${metadata}` });
        parts.push({ inlineData: { data: fileBase64.replace(/^data:.+;base64,/, ''), mimeType } });
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
    console.error("Gemini Error:", error);
    return "AI Summarization is currently unavailable. Please try again later.";
  }
};

export const generateStudySet = async (
  metadata: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string,
  extractedText?: string
): Promise<any> => {
  try {
    const promptText = setType === 'flashcards' 
        ? "Generate 5-10 flashcards (term and definition) based on this material." 
        : "Generate 5 multiple-choice questions (question, options array, and correctAnswer) based on this material.";
    
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
        parts.push({ text: promptText });
        parts.push({ inlineData: { data: fileBase64.replace(/^data:.+;base64,/, ''), mimeType } });
    } else {
        parts.push({ text: `${promptText}\n\nContext: ${metadata}` });
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { responseMimeType: "application/json", responseSchema: schema },
        contents: [{ role: 'user', parts }]
    });

    return response.text ? JSON.parse(response.text) : [];
  } catch (error) {
    console.error(`Error generating ${setType}:`, error);
    return [];
  }
};
