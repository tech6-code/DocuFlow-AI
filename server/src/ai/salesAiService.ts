import { Type } from "@google/genai";
import { Deal } from "./types";
import { ai, callAiWithRetry, safeJsonParse } from "./utils";

const leadScoreSchema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER }, rationale: { type: Type.STRING }, nextAction: { type: Type.STRING },
        qualityParams: { type: Type.OBJECT, properties: { budget: { type: Type.STRING }, authority: { type: Type.STRING }, need: { type: Type.STRING }, timeline: { type: Type.STRING } } }
    },
    required: ["score", "rationale", "nextAction"]
};

export const generateLeadScore = async (leadData: any): Promise<any> => {
    const prompt = `Analyze this sales lead and assign a score (0-100). LEAD DATA: ${JSON.stringify(leadData)}`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json", responseSchema: leadScoreSchema } }));
        return safeJsonParse(res.text || "{}");
    } catch (e) {
        console.error("Lead scoring error:", e);
        return { score: 0, rationale: "AI Analysis Failed", nextAction: "Review manually" };
    }
};

export const generateSalesEmail = async (context: any): Promise<string> => {
    const prompt = `Write a professional sales email based on context: ${JSON.stringify(context)}`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] } }));
        return res.text || "";
    } catch (e) { console.error("Email generation error:", e); return "Error generating email."; }
};

export const analyzeDealProbability = async (deal: Deal): Promise<any> => {
    const prompt = `Analyze this sales deal and predict the win probability. DEAL: ${JSON.stringify(deal)}`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" } }));
        return safeJsonParse(res.text || "") || { winProbability: 50, health: 'Medium', keyRisks: [], recommendedActions: [] };
    } catch (e) { console.error("Deal analysis error:", e); return { winProbability: 0, health: 'Low', keyRisks: ["Analysis Failed"], recommendedActions: [] }; }
};

export const parseSmartNotes = async (notes: string): Promise<Partial<Deal>> => {
    const prompt = `Extract structured deal data from these raw notes: "${notes}"`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" } }));
        return safeJsonParse(res.text || "") || {};
    } catch (e) { console.error("Smart note parsing error:", e); return {}; }
};

export const parseLeadSmartNotes = async (notes: string): Promise<Partial<any>> => {
    const prompt = `Extract structured lead data from these raw notes: "${notes}"`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" } }));
        return safeJsonParse(res.text || "") || {};
    } catch (e) { console.error("Lead smart note parsing error:", e); return {}; }
};

const dealScoreSchema = {
    type: Type.OBJECT,
    properties: { score: { type: Type.NUMBER }, rationale: { type: Type.STRING }, nextAction: { type: Type.STRING } },
    required: ["score", "rationale", "nextAction"]
};

export const generateDealScore = async (dealData: any): Promise<any> => {
    const prompt = `Analyze this sales deal and assign a score (0-100). DEAL DATA: ${JSON.stringify(dealData)}`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json", responseSchema: dealScoreSchema } }));
        return safeJsonParse(res.text || "{}");
    } catch (e) { console.error("Deal scoring error:", e); return { score: 0, rationale: "AI Analysis Failed", nextAction: "Review manually" }; }
};
