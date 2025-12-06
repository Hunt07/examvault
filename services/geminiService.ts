
// @ts-ignore
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  try {
    const textPrompt = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.
`;

    let requestContents: any;

    if (fileBase64 && mimeType) {
        // Remove data URL prefix if present for clean base64
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        
        requestContents = {
            parts: [
                { text: textPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: cleanBase64
                    }
                }
            ]
        };
    } else {
        requestContents = `${textPrompt}\n\nMaterial to analyze:\n---\n${content}\n---`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: requestContents,
    });

    return response.text || "No summary generated.";
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Could not generate summary at this time. Please try again later.";
  }
};

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  try {
    const textPart = {
      text: "Analyze this image from a study document. Describe the key information, including any text, diagrams, or main concepts. This will be used as a summary for other students."
    };

    // Remove data URL prefix if present for clean base64
    const cleanBase64 = base64Data.replace(/^data:.+;base64,/, '');

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType,
      },
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, imagePart] },
    });

    return response.text || "No description generated.";
  } catch (error) {
    console.error("Error describing image with Gemini:", error);
    return "Could not generate a description for the image at this time.";
  }
};

export const generateStudySet = async (
  content: string, 
  setType: 'flashcards' | 'quiz',
  fileBase64?: string, 
  mimeType?: string
): Promise<any> => {
  try {
    let textPrompt;
    let schema;

    if (setType === 'flashcards') {
      textPrompt = `Analyze the provided study material and generate a set of 5-10 flashcards as a JSON array. Each object in the array should have a 'term' (a key concept or question) and a 'definition' (a concise explanation or answer).`;
      schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING, description: 'The key term or question for the front of the flashcard.' },
            definition: { type: Type.STRING, description: 'The definition or answer for the back of the flashcard.' },
          },
          required: ['term', 'definition'],
        },
      };
    } else { // quiz
      textPrompt = `Analyze the provided study material and generate a 5-question multiple-choice quiz as a JSON array. Each object should have a 'question', an array of exactly 4 'options', and the 'correctAnswer' which must exactly match one of the strings in the 'options' array.`;
      schema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: 'The question for the quiz.' },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 4 possible answers.' },
            correctAnswer: { type: Type.STRING, description: 'The correct answer, which must be one of the strings from the options array.' },
          },
          required: ['question', 'options', 'correctAnswer'],
        },
      };
    }

    let requestContents: any;

    if (fileBase64 && mimeType) {
        // Remove data URL prefix if present for clean base64
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        
        requestContents = {
            parts: [
                { text: textPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: cleanBase64
                    }
                }
            ]
        };
    } else {
        requestContents = `${textPrompt}\n\nMaterial to analyze:\n---\n${content}\n---`;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: requestContents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error(`Error generating ${setType} with Gemini:`, error);
    return [];
  }
};
