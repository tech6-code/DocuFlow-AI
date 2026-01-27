import { Type } from "@google/genai";
import { Transaction, AnalysisResult, Invoice } from "./types";
import { ai, callAiWithRetry, safeJsonParse } from "./utils";
import { TRANSACTION_CATEGORIES, CHART_OF_ACCOUNTS, LOCAL_RULES } from "./constants";

export const analyzeTransactions = async (
    transactions: Transaction[]
): Promise<{ analysis: AnalysisResult; categorizedTransactions: Transaction[] }> => {
    const prompt = `Analyze transactions. Assign categories from: ${TRANSACTION_CATEGORIES.join(",")}. Calculate cashflow, identify recurring payments, provide spending summary. Return JSON.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            categorizedTransactions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { date: { type: Type.STRING }, description: { type: Type.STRING }, debit: { type: Type.NUMBER }, credit: { type: Type.NUMBER }, balance: { type: Type.NUMBER }, category: { type: Type.STRING } } } },
            analysis: { type: Type.OBJECT, properties: { spendingSummary: { type: Type.STRING }, cashFlow: { type: Type.OBJECT, properties: { totalIncome: { type: Type.NUMBER }, totalExpenses: { type: Type.NUMBER }, netCashFlow: { type: Type.NUMBER } } }, recurringPayments: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, amount: { type: Type.NUMBER }, frequency: { type: Type.STRING } } } } } }
        }
    };
    const response = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json", responseSchema: schema } }));
    const data = safeJsonParse(response.text || "");
    return {
        analysis: data?.analysis || { spendingSummary: "Analysis failed", cashFlow: { totalIncome: 0, totalExpenses: 0, netCashFlow: 0 }, recurringPayments: [] },
        categorizedTransactions: data?.categorizedTransactions || transactions,
    };
};

export const categorizeTransactionsByCoA = async (transactions: Transaction[]): Promise<Transaction[]> => {
    const updatedTransactions = transactions.map((t) => {
        const isUncategorized = !t.category || t.category.toUpperCase().includes("UNCATEGORIZED");
        if (!isUncategorized) return t;
        const desc = (t.description || "").toLowerCase();
        const isCredit = (t.credit || 0) > 0 && (t.credit || 0) > (t.debit || 0);
        const matchedRule = LOCAL_RULES.find((rule) => {
            if ((rule.category.startsWith("Expenses") || rule.category.startsWith("Assets")) && isCredit) return false;
            if ((rule.category.startsWith("Income") || rule.category.startsWith("Equity")) && !isCredit) return false;
            return rule.keywords.some(k => new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "i").test(desc));
        });
        if (matchedRule) return { ...t, category: matchedRule.category };
        return t;
    });

    const pendingMap = new Map<string, number[]>();
    updatedTransactions.forEach((t, index) => {
        if (!t.category || t.category.toUpperCase().includes("UNCATEGORIZED")) {
            const key = JSON.stringify({ description: (t.description || "").trim(), type: (t.credit || 0) > (t.debit || 0) ? "MoneyIn(Credit)" : "MoneyOut(Debit)" });
            if (!pendingMap.has(key)) pendingMap.set(key, []);
            pendingMap.get(key)!.push(index);
        }
    });

    const uniqueKeys = Array.from(pendingMap.keys());
    if (uniqueKeys.length === 0) return updatedTransactions;

    const BATCH_SIZE = 8;
    for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
        const batchKeys = uniqueKeys.slice(i, i + BATCH_SIZE);
        const batchItems = batchKeys.map(k => JSON.parse(k));
        const prompt = `CoA: ${JSON.stringify(CHART_OF_ACCOUNTS)}\nCategorize: ${JSON.stringify(batchItems)}\nReturn JSON {categories: string[]}`;
        try {
            const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" } }));
            const data = safeJsonParse(res.text || "");
            if (data?.categories) {
                batchKeys.forEach((key, idx) => {
                    const cat = data.categories[idx];
                    if (cat) pendingMap.get(key)!.forEach(idx => { updatedTransactions[idx].category = cat; });
                });
            }
        } catch (e) { console.error("Batch categorization error:", e); }
    }
    return updatedTransactions;
};

export const suggestCategoryForTransaction = async (
    transaction: Transaction,
    invoices: Invoice[]
): Promise<{ category: string; reason: string }> => {
    const prompt = `Suggest category for: "${transaction.description}". Categories: ${TRANSACTION_CATEGORIES.join(",")}. Return JSON: {"category":"...","reason":"..."}`;
    const res = await callAiWithRetry(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: { parts: [{ text: prompt }] }, config: { responseMimeType: "application/json" } }));
    return safeJsonParse(res.text || "") || { category: "Uncategorized", reason: "No suggestion" };
};
