import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  // Check for Vite environment variable
  // Cast import.meta to any to avoid TypeScript error about 'env' property
  const meta = import.meta as any;
  if (typeof meta !== 'undefined' && meta.env && meta.env.VITE_API_KEY) {
    return meta.env.VITE_API_KEY;
  }
  // Check for process.env (safely)
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // ignore
  }
  return "";
};

const apiKey = getApiKey();
const ai = new GoogleGenAI({ apiKey: apiKey });

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  if (!apiKey) {
      return "Configuration Error: API Key is missing. Please ensure VITE_API_KEY is set in your .env file.";
  }

  try {
    const systemInstruction = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.`;

    const parts: any[] = [];
    
    if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts.push({
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        });
        parts.push({ text: "Analyze the above document/image." });
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
    return "Could not generate summary. Please check your Internet connection or API Key quota.";
  }
};

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  if (!apiKey) return "Error: API Key missing.";
  try {
    const cleanBase64 = base64Data.replace(/^data:.+;base64,/, '');
    const prompt = "Analyze this image from a study document. Describe the key information, including any text, diagrams, or main concepts. This will be used as a summary for other students.";

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

export const generateStudySet = async (
  content: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  if (!apiKey) {
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
    parts.push({ text: promptText });

    if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts.push({
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        });
    } else {
        parts.push({ text: `\n\nMaterial to analyze:\n---\n${content}\n---` });
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