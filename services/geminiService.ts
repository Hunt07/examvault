
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Initialize the Google Generative AI SDK
// Uses the API key from the environment variable as per strict guidelines.
const genAI = new GoogleGenerativeAI(process.env.API_KEY as string);

// Using gemini-1.5-flash for speed and efficiency
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

    const result = await model.generateContent(parts);
    const response = result.response;
    return response.text() || "No summary generated.";
  } catch (error) {
    console.error("Error generating summary with Gemini:", error);
    return "Could not generate summary at this time. Please check your API key settings.";
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

    const result = await model.generateContent([textPart, imagePart]);
    const response = result.response;
    return response.text() || "No description generated.";
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
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                correctAnswer: { type: SchemaType.STRING },
            },
            required: ['question', 'options', 'correctAnswer'],
        }
      };
    }

    // Initialize a model with generation config for JSON
    const jsonModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    });

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
    
    const result = await jsonModel.generateContent(parts);
    const response = result.response;
    const text = response.text() || "[]";
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`Error generating ${setType} with Gemini:`, error);
    return [];
  }
};
