import { GoogleGenAI, Type } from "@google/genai";
import { Product, AIAnalysisResult } from '../types';

// Duplicate the safe env getter here to avoid circular deps or complex imports
const getApiKey = (): string => {
  try {
    // @ts-ignore
    if (import.meta?.env?.VITE_API_KEY) return import.meta.env.VITE_API_KEY;
    // @ts-ignore
    if (import.meta?.env?.API_KEY) return import.meta.env.API_KEY;
  } catch(e) {}

  try {
    if (typeof process !== 'undefined' && process.env) {
        return process.env.VITE_API_KEY || process.env.REACT_APP_API_KEY || process.env.API_KEY || '';
    }
  } catch(e) {}
  
  return '';
};

const getAIClient = () => {
    const key = getApiKey();
    if (!key) {
        throw new Error("API Key is missing. Please add VITE_API_KEY to environment variables.");
    }
    return new GoogleGenAI({ apiKey: key });
};

export const generateProductDescription = async (name: string, category: string): Promise<string> => {
    try {
        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Write a compelling, short marketing description (max 2 sentences) for a product named "${name}" in the category "${category}".`,
        });
        return response.text || "No description generated.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Error generating description (Check API Key).";
    }
};

export const analyzeInventory = async (products: Product[]): Promise<AIAnalysisResult> => {
    try {
        const ai = getAIClient();
        
        // Optimize payload size by sending only relevant fields
        const simplifiedInventory = products.map(p => ({
            name: p.name,
            qty: p.quantity,
            min: p.minStock,
            cat: p.category,
            price: p.price
        }));

        const prompt = `
        Act as an Inventory Expert. Analyze this stock data: ${JSON.stringify(simplifiedInventory)}.
        Provide a strategic summary, specific recommendations for restocking or sales, and a list of high-priority restock items.
        Return JSON data conforming to the schema.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        summary: { type: Type.STRING, description: "A brief 2-3 sentence overview of the stock health." },
                        recommendations: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "Actionable business advice based on data."
                        },
                        restockPriority: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "Names of products that urgently need restocking."
                        }
                    },
                    required: ["summary", "recommendations", "restockPriority"]
                }
            }
        });

        if (response.text) {
             return JSON.parse(response.text) as AIAnalysisResult;
        }
        throw new Error("Empty response from AI");

    } catch (error) {
        console.error("Inventory Analysis Error:", error);
        return {
            summary: "Unable to analyze inventory. Check if VITE_API_KEY is configured.",
            recommendations: ["Check Vercel Environment Variables", "Ensure VITE_API_KEY is set"],
            restockPriority: []
        };
    }
};