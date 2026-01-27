import { GoogleGenAI } from "@google/genai";
import { Transaction } from "./types";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
}
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

if (!process.env.EXCHANGE_RATE_API_KEY) {
    throw new Error("EXCHANGE_RATE_API_KEY environment variable not set");
}
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

export const callAiWithRetry = async (
    apiCall: () => Promise<any>,
    retries = 7,
    delay = 15000
) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            const isRateLimit =
                error?.status === 429 ||
                error?.code === 429 ||
                error?.status === 503 ||
                error?.status === "RESOURCE_EXHAUSTED" ||
                (error?.message &&
                    (error.message.includes("429") ||
                        error.message.includes("quota") ||
                        error.message.includes("RESOURCE_EXHAUSTED") ||
                        error.message.includes("503"))) ||
                error?.error?.code === 429 ||
                error?.error?.status === "RESOURCE_EXHAUSTED" ||
                (typeof error === "string" && error.includes("429"));

            if (isRateLimit) {
                if (i === retries - 1) throw error;

                const backoffTime = delay * Math.pow(2, i) + Math.random() * 2000;
                console.warn(
                    `Rate limit hit (429/RESOURCE_EXHAUSTED). Retrying in ${Math.floor(
                        backoffTime / 1000
                    )}s... (Attempt ${i + 1}/${retries})`
                );
                await new Promise((resolve) => setTimeout(resolve, backoffTime));
            } else {
                throw error;
            }
        }
    }
};

const rateCache = new Map<string, number>();

export const fetchExchangeRate = async (from: string, to: string): Promise<number> => {
    if (!from || from === "N/A" || from.toUpperCase() === to.toUpperCase()) return 1;

    const symbolMap: Record<string, string> = {
        $: "USD", DOLLAR: "USD", US: "USD", "€": "EUR", EURO: "EUR", "£": "GBP",
        POUND: "GBP", STERLING: "GBP", "¥": "JPY", YEN: "JPY", "₹": "INR",
        RUPEE: "INR", SAR: "SAR", RIYAL: "SAR", AED: "AED", DIRHAM: "AED",
    };

    const cleanedKey = from.trim().toUpperCase();
    let base = cleanedKey.replace(/[^A-Z]/g, "");

    if (symbolMap[cleanedKey]) base = symbolMap[cleanedKey];
    else {
        for (const [k, v] of Object.entries(symbolMap)) {
            if (cleanedKey.includes(k)) {
                base = v;
                break;
            }
        }
    }

    if (!base || base.length !== 3) {
        console.warn(`Could not normalize currency from "${from}". Base determined as "${base}". Defaulting to 1.0.`);
        return 1;
    }

    const cacheKey = `${base}-${to.toUpperCase()}`;
    if (rateCache.has(cacheKey)) return rateCache.get(cacheKey)!;
    if (base === to.toUpperCase()) return 1;

    try {
        const response = await fetch(
            `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/pair/${base}/${to}`
        );
        const data = await response.json();
        if (data?.result === "success" && typeof data?.conversion_rate === "number") {
            const rate = data.conversion_rate;
            console.log(`Exchange rate fetched for ${base}->${to}: ${rate}`);
            rateCache.set(cacheKey, rate);
            return rate;
        }
        return 1;
    } catch (e) {
        console.error("Exchange rate fetch error:", e);
        return 1;
    }
};

export const cleanJsonText = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```\s*$/, "");
    return cleaned.trim();
};

export const tryRepairJson = (jsonString: string): string => {
    let repaired = jsonString.trim();
    if (!repaired) return "{}";

    let quoteCount = 0;
    let escape = false;
    for (let i = 0; i < repaired.length; i++) {
        if (repaired[i] === "\\" && !escape) { escape = true; continue; }
        if (repaired[i] === `"` && !escape) quoteCount++;
        escape = false;
    }
    if (quoteCount % 2 !== 0) repaired += `"`;

    repaired = repaired.replace(/,\s*$/, "");

    if (repaired.match(/:\s*t[rue]*$/i)) repaired = repaired.replace(/t[rue]*$/i, "true");
    else if (repaired.match(/:\s*f[alse]*$/i)) repaired = repaired.replace(/f[alse]*$/i, "false");
    else if (repaired.match(/:\s*n[ull]*$/i)) repaired = repaired.replace(/n[ull]*$/i, "null");

    if (repaired.match(/"\s*:\s*$/)) repaired += "null";

    if (repaired.endsWith('"')) {
        let j = repaired.length - 2;
        while (j >= 0 && (repaired[j] !== '"' || (j > 0 && repaired[j - 1] === "\\"))) j--;
        if (j >= 0) {
            let k = j - 1;
            while (k >= 0 && /\s/.test(repaired[k])) k--;
            if (k >= 0 && (repaired[k] === "{" || repaired[k] === ",")) repaired += ": null";
        }
    }

    const stack: string[] = [];
    let inString = false;
    escape = false;
    for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];
        if (c === "\\" && !escape) { escape = true; continue; }
        if (c === `"` && !escape) inString = !inString;
        escape = false;
        if (!inString) {
            if (c === "{") stack.push("}");
            if (c === "[") stack.push("]");
            if (c === "}" || c === "]") { if (stack.length > 0 && stack[stack.length - 1] === c) stack.pop(); }
        }
    }
    while (stack.length > 0) repaired += stack.pop();
    return repaired;
};

export const safeJsonParse = (text: string): any => {
    const cleaned = cleanJsonText(text);
    if (!cleaned) return null;
    try {
        return JSON.parse(cleaned);
    } catch {
        try {
            const repaired = tryRepairJson(cleaned);
            return JSON.parse(repaired);
        } catch (repairError) {
            console.error("JSON repair failed:", repairError);
            return null;
        }
    }
};

export const parseTransactionDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let day: number, month: number, year: number;
        if (parts[0].length === 4) { [year, month, day] = parts.map(Number); }
        else { [day, month, year] = parts.map(Number); }
        const d = new Date(year, month - 1, day);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

export const filterTransactionsByDate = (
    transactions: Transaction[],
    startDate?: string,
    endDate?: string
): Transaction[] => {
    if (!startDate && !endDate) return transactions;
    const start = startDate ? parseTransactionDate(startDate) : null;
    const end = endDate ? parseTransactionDate(endDate) : null;
    return transactions.filter((t) => {
        const tDate = parseTransactionDate(t.date);
        if (!tDate) return true;
        if (start && tDate < start) return false;
        if (end && tDate > end) return false;
        return true;
    });
};

export const deduplicateTransactions = (transactions: Transaction[]): Transaction[] => {
    if (!transactions || transactions.length === 0) return [];
    const result: Transaction[] = [];
    const seenHashes = new Set<string>();
    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;
        const balance = Number(t.balance) || 0;
        const desc = String(t.description || "").trim();
        const date = String(t.date || "").trim();
        const curr = String(t.currency || "").trim().toUpperCase();
        const hash = `${date}|${desc.toLowerCase()}|${debit.toFixed(2)}|${credit.toFixed(2)}|${balance.toFixed(2)}|${curr}`;
        if (seenHashes.has(hash)) continue;
        if (result.length > 0) {
            const lastIdx = result.length - 1;
            const prev = result[lastIdx];
            const prevBal = Number(prev.balance) || 0;
            const isPlaceholderDate = !date || date === "-" || date === "N/A" || date === ".." || date === ".";
            if (isPlaceholderDate) {
                result[lastIdx] = {
                    ...prev,
                    description: `${prev.description}${desc}`.trim(),
                    debit: prev.debit || debit,
                    credit: prev.credit || credit,
                    balance: balance || prev.balance,
                };
                continue;
            }
            if (debit === 0 && credit === 0 && balance !== 0 && Math.abs(balance - prevBal) < 0.01) continue;
            if (date === prev.date &&
                Math.abs(debit - (Number(prev.debit) || 0)) < 0.01 &&
                Math.abs(credit - (Number(prev.credit) || 0)) < 0.01 &&
                (balance === 0 || prevBal === 0 || Math.abs(balance - prevBal) < 0.01)) continue;
        }
        result.push({ ...t, date, debit, credit, balance, description: desc });
        seenHashes.add(hash);
    }
    return result;
};
