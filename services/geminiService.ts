
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Initialize the Google Generative AI client
// Ensure your API key is correctly set in your environment variables (e.g., .env.local for Vercel)
const API_KEY = process.env.API_KEY || "AIzaSyCuNJIRcPQxT7hrPvZzqcTjD7VAQYio4-g";
const genAI = new GoogleGenerativeAI(API_KEY);

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  if (!API_KEY) {
    return "Configuration Error: API Key is missing. Please ensure process.env.API_KEY is configured.";
  }

  try {
    // Use gemini-1.5-flash for speed and efficiency
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const textPrompt = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown. The summary should be easy to digest and focus on what's most important for exam preparation.

Do not use generic phrases like "This document discusses..." or "The material covers...". Get straight to the point.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.
`;

    let promptParts: any[] = [textPrompt];

    if (fileBase64 && mimeType) {
        // Remove data URL prefix if present for clean base64
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        
        promptParts.push({
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        });
    } else {
        promptParts.push(`\n\nMaterial to analyze:\n---\n${content}\n---`);
    }

    const result = await model.generateContent(promptParts);
    const response = await result.response;
    return response.text() || "No summary generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('403') || error.message?.includes('API key')) {
        return "Error: Invalid or revoked API Key. The system administrator needs to update the API Key.";
    }
    return "Could not generate summary. Please check your Internet connection or API Key quota.";
  }
};

export const describeImage = async (base64Data: string, mimeType: string): Promise<string> => {
  if (!API_KEY) return "Error: API Key missing.";

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const textPart = "Analyze this image from a study document. Describe the key information, including any text, diagrams, or main concepts. This will be used as a summary for other students.";

    // Remove data URL prefix if present for clean base64
    const cleanBase64 = base64Data.replace(/^data:.+;base64,/, '');

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType,
      },
    };

    const result = await model.generateContent([textPart, imagePart]);
    const response = await result.response;
    return response.text() || "No description generated.";
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
  if (!API_KEY) {
      console.error("API Key missing for study set generation");
      return [];
  }

  try {
    let promptText;
    let schema;

    if (setType === 'flashcards') {
      promptText = `Analyze the provided study material and generate a set of 5-10 flashcards.`;
      schema = {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            term: { type: SchemaType.STRING },
            definition: { type: SchemaType.STRING },
          },
          required: ['term', 'definition'],
        },
      };
    } else {
      promptText = `Analyze the provided study material and generate a 5-question multiple-choice quiz.`;
      schema = {
        type: SchemaType.ARRAY,
        items: {
            type: SchemaType.OBJECT,
            properties: {
                question: { type: SchemaType.STRING },
                options: { 
                    type: SchemaType.ARRAY, 
                    items: { type: SchemaType.STRING } 
                },
                correctAnswer: { type: SchemaType.STRING },
            },
            required: ['question', 'options', 'correctAnswer'],
        }
      };
    }

    const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema
        }
    });

    let promptParts: any[] = [promptText];

    if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        promptParts.push({
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        });
    } else {
        promptParts.push(`\n\nMaterial to analyze:\n---\n${content}\n---`);
    }
    
    const result = await model.generateContent(promptParts);
    const response = await result.response;
    const text = response.text() || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating ${setType} with Gemini:`, error);
    return [];
  }
};
