import { Type, Part } from "@google/genai";
import { Transaction, TrialBalanceEntry } from "./types";
import { ai, callAiWithRetry, safeJsonParse } from "./utils";

export const generateTrialBalance = async (transactions: Transaction[]) => {
    return { trialBalance: [] };
};

export const generateAuditReport = async (trialBalance: TrialBalanceEntry[], companyName: string) => {
    const prompt = `Generate IFRS audit report for ${companyName} from trial balance: ${JSON.stringify(trialBalance)}. Return JSON.`;
    const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" } }));
    return { report: safeJsonParse(res.text || "") };
};

export const extractTrialBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
    const prompt = `EXHAUSTIVE TRIAL BALANCE EXTRACTION TASK: Analyze the provided document and extract EVERY account row with its Debit and Credit amounts.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            entries: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { account: { type: Type.STRING }, debit: { type: Type.NUMBER, nullable: true }, credit: { type: Type.NUMBER, nullable: true } }, required: ["account"] } }
        },
        required: ["entries"],
    };
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [...imageParts, { text: prompt }] }, config: { responseMimeType: "application/json", responseSchema: schema } }));
        const data = safeJsonParse(res.text || "");
        if (!data || !Array.isArray(data.entries)) return [];
        return data.entries.map((e: any) => ({ account: e.account || "Unknown", debit: Number(e.debit) || 0, credit: Number(e.credit) || 0 }));
    } catch (e) { console.error("Error extracting trial balance:", e); return []; }
};

export const auditReportSchema = { type: Type.OBJECT, properties: { generalInformation: { type: Type.OBJECT, properties: { companyName: { type: Type.STRING } } } } }; // simplified

export const extractAuditReportDetails = async (imageParts: Part[]): Promise<Record<string, any>> => {
    const prompt = `Extract detailed information from the Audit Report.`;
    try {
        const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [...imageParts, { text: prompt }] }, config: { responseMimeType: "application/json" } }));
        return safeJsonParse(res.text || "{}") || {};
    } catch (e) { console.error("Error extracting audit report details:", e); return {}; }
};
