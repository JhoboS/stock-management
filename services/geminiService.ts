
import { GoogleGenAI, Type } from "@google/genai";
import { Product, AIAnalysisResult } from '../types';

/**
 * Generates a short marketing description for a product.
 * Uses 'gemini-3-flash-preview' for basic text tasks.
 */
export const generateProductDescription = async (name: string, category: string): Promise<string> => {
    try {
        // Initialize Gemini with the API key from process.env.API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Write a compelling, short marketing description (max 2 sentences) for a product named "${name}" in the category "${category}".`,
        });
        // Accessing generated text using the .text property
        return response.text || "No description generated.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Error generating description (Check API Key).";
    }
};

/**
 * Analyzes inventory data and provides strategic recommendations.
 * Uses 'gemini-3-pro-preview' for complex text tasks.
 */
export const analyzeInventory = async (products: Product[]): Promise<AIAnalysisResult> => {
    try {
        // Initialize Gemini with the API key from process.env.API_KEY
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
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
            model: 'gemini-3-pro-preview',
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

        // Extracting text output directly from GenerateContentResponse
        const jsonStr = response.text;
        if (jsonStr) {
             return JSON.parse(jsonStr.trim()) as AIAnalysisResult;
        }
        throw new Error("Empty response from AI");

    } catch (error) {
        console.error("Inventory Analysis Error:", error);
        return {
            summary: "Unable to analyze inventory. Please ensure your API key and network connection are active.",
            recommendations: ["Review stock levels manually", "Contact system administrator"],
            restockPriority: []
        };
    }
};
