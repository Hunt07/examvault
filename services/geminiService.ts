
import { GoogleGenAI, Type } from "@google/genai";

// Use gemini-3-flash-preview for best speed/cost ratio in production
const MODEL_NAME = "gemini-3-flash-preview";

// Helper to get the AI instance lazily and safely.
const getAI = () => {
  // @ts-ignore
  // Access process.env.API_KEY directly. Vite replaces this with the string value.
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.error("Gemini API Key is missing. Please check your .env file or environment variables.");
    throw new Error("API Key is missing");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  try {
    const ai = getAI();
    const textPrompt = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.`;

    let parts: any[] = [];

    if (fileBase64 && mimeType) {
        // Remove data URL prefix if present for clean base64
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        
        parts = [
            { text: textPrompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: cleanBase64
                }
            }
        ];
    } else {
        parts = [{ text: `${textPrompt}\n\nMaterial to analyze:\n---\n${content}\n---` }];
    }

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts }
    });
    
    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Could not generate summary. Please check your API key and connection.";
  }
};

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const ai = getAI();
    // Remove data URL prefix if present for clean base64
    const cleanBase64 = base64Data.replace(/^data:.+;base64,/, '');

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
            parts: [
                { text: "Analyze this image from a study document. Describe the key information, including any text, diagrams, or main concepts." },
                { inlineData: { mimeType, data: cleanBase64 } }
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
  try {
    const ai = getAI();
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
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
            },
            required: ['question', 'options', 'correctAnswer'],
        }
      };
    }

    let parts: any[] = [];
    if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts = [
            { text: promptText },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: cleanBase64
                }
            }
        ];
    } else {
        parts = [{ text: `${promptText}\n\nMaterial to analyze:\n---\n${content}\n---` }];
    }
    
    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating ${setType} with Gemini:`, error);
    return [];
  }
};
