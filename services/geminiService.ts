import { GoogleGenAI, Type } from "@google/genai";
// @ts-ignore
import JSZip from "jszip";

// Strictly initialize using the environment variable as per SDK guidelines
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
 * This is highly effective for extracting raw text from Office XML structures.
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
    const systemInstruction = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.`;

    const parts: any[] = [];
    
    // Prioritize pre-extracted text (DOCX/PPTX) to avoid CORS issues
    if (extractedText) {
        parts.push({ text: `Analyze this document content. Context: ${metadata}\n\nDocument Text:\n${extractedText}` });
    } else if (fileBase64 && mimeType) {
        // PDF/Images via Base64 (only for files small enough to be stored/passed)
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts.push({ inlineData: { data: cleanBase64, mimeType } });
        parts.push({ text: `Analyze the above document. Context: ${metadata}` });
    } else {
        parts.push({ text: `Analyze this material: ${metadata}` });
    }

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction },
        contents: [{ role: 'user', parts }]
    });

    return response.text || "Summary generation returned no text.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return "AI generation is currently unavailable. Please check your connection and try again.";
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
    let promptText = setType === 'flashcards' 
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
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts.push({ inlineData: { data: cleanBase64, mimeType } });
        parts.push({ text: promptText });
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