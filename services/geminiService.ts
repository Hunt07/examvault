
import { GoogleGenAI, Type } from "@google/genai";

const MODEL_NAME = "gemini-3-flash-preview";

// Helper to get the AI instance
const getAI = () => {
  // @ts-ignore
  const apiKey = process.env.API_KEY;
  
  // Return null if no key, allowing the service functions to handle the fallback
  if (!apiKey) return null;
  
  return new GoogleGenAI({ apiKey });
};

// Fallback generators
const getFallbackSummary = () => {
  return `## ⚠️ AI Service Unavailable
  
We couldn't connect to the AI service (Gemini) to generate a live summary. This usually happens if the **API Key** is missing or invalid.

### Document Snapshot (Simulated)
Based on the file metadata, this resource likely covers:
- **Core Concepts:** Fundamental definitions related to the course subject.
- **Key Methodologies:** Standard frameworks and problem-solving techniques.
- **Exam Topics:** Common questions found in past years.

*To enable live AI features, please verify your API_KEY configuration in the .env file.*`;
};

const getFallbackFlashcards = () => [
  { term: "API Key", definition: "A unique identifier used to authenticate a user, developer, or calling program to an API." },
  { term: "Fallback Mode", definition: "A strategy to ensure the application continues to function (even with limited features) when a primary service fails." },
  { term: "Gemini", definition: "Google's most capable AI model, used here to analyze documents." }
];

const getFallbackQuiz = () => [
  {
    question: "Why are you seeing this fallback quiz?",
    options: ["The API Key is missing", "The internet is down", "The AI is sleeping", "All of the above"],
    correctAnswer: "The API Key is missing"
  }
];

export const summarizeContent = async (
  content: string, 
  fileBase64?: string, 
  mimeType?: string
): Promise<string> => {
  try {
    const ai = getAI();
    if (!ai) return getFallbackSummary();

    const textPrompt = `You are an expert academic assistant. Your task is to analyze the provided study material and create a highly informative, concise summary for a university student, formatted in markdown.

Based on the following material, please provide the summary with these exact sections:
- **Key Concepts:** A bulleted list of the most important terms, definitions, and concepts.
- **Main Takeaways:** 2-3 sentences summarizing the core message or conclusions.
- **Potential Exam Questions:** A numbered list of 2-3 sample questions that could be asked on an exam based on this material.`;

    let parts: any[] = [];

    if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.replace(/^data:.+;base64,/, '');
        parts = [
            { text: textPrompt },
            { inlineData: { mimeType: mimeType, data: cleanBase64 } }
        ];
    } else {
        parts = [{ text: `${textPrompt}\n\nMaterial to analyze:\n---\n${content}\n---` }];
    }

    const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts }
    });
    
    return response.text || getFallbackSummary();
  } catch (error) {
    console.error("Gemini Error:", error);
    return getFallbackSummary();
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
    if (!ai) return setType === 'flashcards' ? getFallbackFlashcards() : getFallbackQuiz();

    let promptText;
    let schema;

    if (setType === 'flashcards') {
      promptText = `Analyze the provided study material and generate a set of 5-8 flashcards.`;
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
            { inlineData: { mimeType: mimeType, data: cleanBase64 } }
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
    if (!text) throw new Error("Empty response");
    
    return JSON.parse(text);
  } catch (error) {
    console.error(`Gemini Error (${setType}):`, error);
    return setType === 'flashcards' ? getFallbackFlashcards() : getFallbackQuiz();
  }
};
