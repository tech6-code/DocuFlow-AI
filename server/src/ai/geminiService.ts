// geminiService.ts
import { GoogleGenAI, Type, Part } from "@google/genai";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
    Transaction,
    Invoice,
    BankStatementSummary,
    AnalysisResult,
    TrialBalanceEntry,
    FinancialStatements,
    Deal,
} from "./types";

/**
 * ENV
 */
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * ExchangeRate API
 */
if (!process.env.EXCHANGE_RATE_API_KEY) {
    throw new Error("EXCHANGE_RATE_API_KEY environment variable not set");
}
const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY;

/**
 * Constants for Entity Mapping
 */
export const ENTITY_TYPES = [
    "Legal Person - Incorporated (LLC)",
    "Legal Person - Foreign Business",
    "Legal Person - Club/ Association/ Society",
    "Legal Person - Charity",
    "Legal Person - Federal Government Entity",
    "Legal Person - Emirate Government Entity",
    "Legal Person - Other",
    "Partnership",
];

export const ENTITY_SUB_TYPES = [
    "UAE Private Company (Incl. an Establishment)",
    "Public Joint Stock Company",
    "Foundation",
    "Trust",
];

export const LICENSE_AUTHORITIES = [
    "Abu Dhabi Department of Economic Development (ADDED)",
    "Dubai Department of Economy and Tourism (DET)",
    "Sharjah Department of Economic Development (SEDD)",
    "Ajman Department of Economic Development (AjmanDED)",
    "Umm Al Quwain Department of Economic Development (UAQDED)",
    "Ras Al Khaimah Department of Economic Development (RAKDED)",
    "Fujairah Department of Economic Development (FujairahDED)",
    "Abu Dhabi Global Market (ADGM)",
    "Khalifa Industrial Zone Abu Dhabi (KIZAD)",
    "Masdar City Free Zone",
    "Twofour54 (Media Zone Authority)",
    "Jebel Ali Free Zone Authority (JAFZA)",
    "Dubai Multi Commodities Centre (DMCC)",
    "Dubai Airport Free Zone Authority (DAFZA)",
    "Dubai Silicon Oasis Authority (DSOA)",
    "Dubai International Financial Centre (DIFC)",
    "Dubai South Free Zone",
    "Sharjah Airport International Free Zone (SAIF Zone)",
    "Hamriyah Free Zone Authority (HFZA)",
    "Ajman Free Zone Authority (AFZA)",
    "Ras Al Khaimah EconomicZone (RAKEZ)",
    "RAK Free Trade Zone (FTZ)",
    "Fujairah Free Zone Authority (FFZA)",
    "Umm Al Quwain Free Trade Zone (UAQFTZ)",
    "Meydan Free Zone",
];

/**
 * Helper: API calls with exponential backoff for rate limits/quota
 */
const callAiWithRetry = async (
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

/**
 * Exchange rate fetch with robust currency normalization and caching
 */
const rateCache = new Map<string, number>();

const fetchExchangeRate = async (from: string, to: string): Promise<number> => {
    if (!from || from === "N/A" || from.toUpperCase() === to.toUpperCase()) return 1;

    const symbolMap: Record<string, string> = {
        $: "USD",
        DOLLAR: "USD",
        US: "USD",
        "€": "EUR",
        EURO: "EUR",
        "£": "GBP",
        POUND: "GBP",
        STERLING: "GBP",
        "¥": "JPY",
        YEN: "JPY",
        "₹": "INR",
        RUPEE: "INR",
        SAR: "SAR",
        RIYAL: "SAR",
        AED: "AED",
        DIRHAM: "AED",
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
        console.warn(
            `Could not normalize currency from "${from}". Base determined as "${base}". Defaulting to 1.0.`
        );
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
        console.warn(
            `ExchangeRate API failed for ${base}->${to}. Result: ${data?.result}. Falling back to 1.0.`
        );
        return 1;
    } catch (e) {
        console.error("Exchange rate fetch error:", e);
        return 1;
    }
};

/**
 * JSON cleanup + repair helpers
 */
const cleanJsonText = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```\s*$/, "");
    return cleaned.trim();
};

const tryRepairJson = (jsonString: string): string => {
    let repaired = jsonString.trim();
    if (!repaired) return "{}";

    // 1. Unclosed string
    let quoteCount = 0;
    let escape = false;
    for (let i = 0; i < repaired.length; i++) {
        if (repaired[i] === "\\" && !escape) {
            escape = true;
            continue;
        }
        if (repaired[i] === `"` && !escape) quoteCount++;
        escape = false;
    }
    if (quoteCount % 2 !== 0) repaired += `"`; // close quote

    // 2. Trailing comma
    repaired = repaired.replace(/,\s*$/, "");

    // 3. Truncated keywords
    if (repaired.match(/:\s*t[rue]*$/i)) repaired = repaired.replace(/t[rue]*$/i, "true");
    else if (repaired.match(/:\s*f[alse]*$/i)) repaired = repaired.replace(/f[alse]*$/i, "false");
    else if (repaired.match(/:\s*n[ull]*$/i)) repaired = repaired.replace(/n[ull]*$/i, "null");

    // 4. Truncated at colon
    if (repaired.match(/"\s*:\s*$/)) repaired += "null";

    // 5. NEW: Truncated after property name (e.g. {"key")
    if (repaired.endsWith('"')) {
        let j = repaired.length - 2;
        while (j >= 0 && (repaired[j] !== '"' || (j > 0 && repaired[j - 1] === "\\"))) j--;
        if (j >= 0) {
            let k = j - 1;
            while (k >= 0 && /\s/.test(repaired[k])) k--;
            if (k >= 0 && (repaired[k] === "{" || repaired[k] === ",")) {
                repaired += ": null";
            }
        }
    }

    // 6. Balance braces/brackets
    const stack: string[] = [];
    let inString = false;
    escape = false;

    for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];
        if (c === "\\" && !escape) {
            escape = true;
            continue;
        }
        if (c === `"` && !escape) inString = !inString;
        escape = false;

        if (!inString) {
            if (c === "{") stack.push("}");
            if (c === "[") stack.push("]");
            if (c === "}" || c === "]") {
                if (stack.length > 0 && stack[stack.length - 1] === c) stack.pop();
            }
        }
    }

    while (stack.length > 0) repaired += stack.pop();
    return repaired;
};

const safeJsonParse = (text: string): any => {
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
            console.error("Attempted repair of:", cleaned);
            console.error("Repaired string was:", tryRepairJson(cleaned));
            return null;
        }
    }
};

/**
 * Date parsing + filtering
 */
export const parseTransactionDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    const cleaned = dateStr.replace(/,/g, "").trim();

    // Try parsing named months explicitly (e.g., "12 Oct 2023" or "Oct 12 2023")
    const months: { [key: string]: number } = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        january: 0, february: 1, march: 2, april: 3, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };

    const parts = cleaned.split(/[\/\-\.\s]+/);

    if (parts.length >= 3) {
        // Check for text month
        const monthIdx = parts.findIndex(p => months[p.toLowerCase()] !== undefined);

        if (monthIdx !== -1) {
            const m = months[parts[monthIdx].toLowerCase()];
            let d = 1;
            let y = 1970;

            const numericParts = parts.filter((_, i) => i !== monthIdx).map(Number);
            if (numericParts.length >= 2) {
                // Heuristic: >1000 is year, <=31 is day
                const yearPart = numericParts.find(n => n > 1000);
                const dayPart = numericParts.find(n => n <= 31 && n !== yearPart); // First valid day

                if (yearPart) y = yearPart;
                if (dayPart) d = dayPart;

                // Edge case: if year is 2 digits (e.g. 23 -> 2023)
                if (y < 100) y += 2000;

                const dateObj = new Date(y, m, d);
                return isNaN(dateObj.getTime()) ? null : dateObj;
            }
        }

        // Numeric parsing (DD/MM/YYYY or YYYY-MM-DD)
        let day: number, month: number, year: number;
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            [year, month, day] = parts.map(Number);
        } else {
            // Assume DD/MM/YYYY as default for UAE/UK
            [day, month, year] = parts.map(Number);
        }

        // Handle 2 digit years if strictly numeric parse
        if (year < 100) year += 2000;

        const d = new Date(year, month - 1, day);
        return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(cleaned);
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
        if (!tDate) return true; // allow manual review

        if (start && tDate < start) return false;
        if (end && tDate > end) return false;
        return true;
    });
};

/**
 * Deduplication with split-line merging + running-balance header dedupe
 */
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
        const hash = `${date}|${desc.toLowerCase()}|${debit.toFixed(2)}|${credit.toFixed(
            2
        )}|${balance.toFixed(2)}|${curr}`;

        if (seenHashes.has(hash)) continue;

        if (result.length > 0) {
            const lastIdx = result.length - 1;
            const prev = result[lastIdx];
            const prevBal = Number(prev.balance) || 0;

            // multiline continuation
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

            // repeated balance header row
            if (debit === 0 && credit === 0 && balance !== 0 && Math.abs(balance - prevBal) < 0.01) {
                continue;
            }

            // consecutive OCR redundancy
            if (
                date === prev.date &&
                Math.abs(debit - (Number(prev.debit) || 0)) < 0.01 &&
                Math.abs(credit - (Number(prev.credit) || 0)) < 0.01 &&
                (balance === 0 || prevBal === 0 || Math.abs(balance - prevBal) < 0.01)
            ) {
                continue;
            }
        }

        result.push({ ...t, date, debit, credit, balance, description: desc });
        seenHashes.add(hash);
    }

    return result;
};

/**
 * CoA
 */
export const CHART_OF_ACCOUNTS = {
    Assets: {
        CurrentAssets: [
            "Cash on Hand",
            "Bank Accounts",
            "Accounts Receivable",
            "Due from related Parties",
            "Advances to Suppliers",
            "Prepaid Expenses",
            "Deposits",
            "Inventory – Goods",
            "Work-in-Progress – Services",
            "VAT Recoverable (Input VAT)",
        ],
        NonCurrentAssets: ["Furniture & Equipment", "Vehicles", "Intangibles (Software, Patents)", "Loans to related parties"],
        ContraAccounts: ["Accumulated Depreciation"],
    },
    Liabilities: {
        CurrentLiabilities: [
            "Accounts Payable",
            "Due to Related Parties",
            "Accrued Expenses",
            "Advances from Customers",
            "Short-Term Loans",
            "VAT Payable (Output VAT)",
            "Corporate Tax Payable",
        ],
        "Long-TermLiabilities": ["Long-Term Loans", "Loans from Related Parties", "Employee End-of-Service Benefits Provision"],
    },
    Equity: [
        "Share Capital / Owner’s Equity",
        "Retained Earnings",
        "Current Year Profit/Loss",
        "Dividends / Owner’s Drawings",
        "Owner's Current Account",
        "Investments in Subsidiaries / Associates",
    ],
    Income: {
        OperatingIncome: ["Sales Revenue", "Sales to related Parties"],
        OtherIncome: ["Other Operating Income", "Interest Income", "Miscellaneous Income", "Interest from Related Parties"],
    },
    Expenses: {
        DirectCosts: ["Direct Cost (COGS)", "Purchases from Related Parties"],
        OtherExpense: [
            "Salaries & Wages",
            "Staff Benefits",
            "Training & Development",
            "Rent Expense",
            "Utility - Electricity & Water",
            "Utility - Telephone & Internet",
            "Office Supplies & Stationery",
            "Repairs & Maintenance",
            "Insurance Expense",
            "Marketing & Advertising",
            "Travel & Entertainment",
            "Professional Fees",
            "Legal Fees",
            "IT & Software Subscriptions",
            "Fuel Expenses",
            "Transportation & Logistics",
            "Interest Expense",
            "Interest to Related Parties",
            "Bank Charges",
            "VAT Expense (non-recoverable)",
            "Corporate Tax Expense",
            "Government Fees & Licenses",
            "Depreciation",
            "Amortization – Intangibles",
            "Bad Debt Expense",
            "Miscellaneous Expense",
        ],
    },
};

export const TRANSACTION_CATEGORIES = [
    "Cash on Hand",
    "Bank Accounts",
    "Accounts Receivable",
    "Due from related Parties",
    "Advances to Suppliers",
    "Prepaid Expenses",
    "Deposits",
    "Inventory – Goods",
    "Work-in-Progress – Services",
    "VAT Recoverable (Input VAT)",
    "Furniture & Equipment",
    "Vehicles",
    "Intangibles (Software, Patents)",
    "Loans to related parties",
    "Accumulated Depreciation",
    "Accounts Payable",
    "Due to Related Parties",
    "Accrued Expenses",
    "Advances from Customers",
    "Short-Term Loans",
    "VAT Payable (Output VAT)",
    "Corporate Tax Payable",
    "Long-Term Loans",
    "Loans from Related Parties",
    "Employee End-of-Service Benefits Provision",
    "Share Capital / Owner’s Equity",
    "Retained Earnings",
    "Current Year Profit/Loss",
    "Dividends / Owner’s Drawings",
    "Owner's Current Account",
    "Investments in Subsidiaries / Associates",
    "Sales Revenue",
    "Sales to related Parties",
    "Other Operating Income",
    "Interest Income",
    "Miscellaneous Income",
    "Interest from Related Parties",
    "Direct Cost (COGS)",
    "Purchases from Related Parties",
    "Salaries & Wages",
    "Staff Benefits",
    "Training & Development",
    "Rent Expense",
    "Utility - Electricity & Water",
    "Utility - Telephone & Internet",
    "Office Supplies & Stationery",
    "Repairs & Maintenance",
    "Insurance Expense",
    "Marketing & Advertising",
    "Travel & Entertainment",
    "Professional Fees",
    "Legal Fees",
    "IT & Software Subscriptions",
    "Fuel Expenses",
    "Transportation & Logistics",
    "Interest Expense",
    "Interest to Related Parties",
    "Bank Charges",
    "VAT Expense (non-recoverable)",
    "Corporate Tax Expense",
    "Government Fees & Licenses",
    "Depreciation",
    "Amortization – Intangibles",
    "Bad Debt Expense",
    "Miscellaneous Expense",
];

/**
 * Invoice classifier (merged + improved)
 * - Sales: vendor matches user
 * - Purchase: customer matches user
 */
const classifyInvoice = (inv: Invoice, userCompanyName?: string, userCompanyTrn?: string): Invoice => {
    if (!userCompanyName && !userCompanyTrn) return inv;

    const clean = (s: string) => (s ? s.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "");
    const uTrn = clean(userCompanyTrn || "");
    const uName = (userCompanyName || "").toLowerCase().trim();
    const normU = uName.replace(/[^a-z0-9]/g, "");

    const vTrn = clean(inv.vendorTrn || "");
    const vName = (inv.vendorName || "").toLowerCase().trim();
    const normV = vName.replace(/[^a-z0-9]/g, "");

    const cTrn = clean(inv.customerTrn || "");
    const cName = (inv.customerName || "").toLowerCase().trim();
    const normC = cName.replace(/[^a-z0-9]/g, "");

    let isSales = false;
    let isPurchase = false;

    // TRN matching
    if (uTrn) {
        if (vTrn && (uTrn === vTrn || vTrn.includes(uTrn) || uTrn.includes(vTrn))) isSales = true;
        if (cTrn && (uTrn === cTrn || cTrn.includes(uTrn) || uTrn.includes(cTrn))) isPurchase = true;
    }

    // Name matching
    const tokenMatch = (a: string, b: string) => {
        const aTokens = a.split(/\s+/).filter((t) => t.length > 2);
        const bTokens = b.split(/\s+/);
        if (!aTokens.length) return false;
        const matchCount = aTokens.reduce((count, token) => count + (bTokens.some((bt) => bt.includes(token)) ? 1 : 0), 0);
        return matchCount / aTokens.length >= 0.6;
    };

    if (!isSales && !isPurchase && normU && normU.length > 2) {
        // Vendor => Sales
        if (normV.includes(normU) || normU.includes(normV) || tokenMatch(uName, vName)) isSales = true;

        // Customer => Purchase
        if (!isSales && (normC.includes(normU) || normU.includes(normC) || tokenMatch(uName, cName))) isPurchase = true;
    }

    if (isSales) inv.invoiceType = "sales";
    else if (isPurchase) inv.invoiceType = "purchase";

    return inv;
};

/**
 * Bank statement layout discovery schema (from old file)
 */
/**
 * Unified Bank Statement Schema (Single Pass)
 */
const unifiedBankStatementSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.OBJECT,
            properties: {
                accountHolder: { type: Type.STRING, nullable: true },
                accountNumber: { type: Type.STRING, nullable: true },
                statementPeriod: { type: Type.STRING, nullable: true },
                openingBalance: { type: Type.NUMBER, nullable: true, description: "Extract ONLY if explicitly present in text (e.g. Opening Balance, Balance Brought Forward). Do not calculate." },
                closingBalance: { type: Type.NUMBER, nullable: true, description: "Extract ONLY if explicitly present in text (e.g. Closing Balance, Ending Balance, Balance as at). Do not calculate." },
                totalWithdrawals: { type: Type.NUMBER, nullable: true },
                totalDeposits: { type: Type.NUMBER, nullable: true },
            },
            nullable: true,
        },
        transactions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "Transaction date (DD/MM/YYYY)" },
                    description: { type: Type.STRING, description: "Full transaction description" },
                    debit: { type: Type.STRING, description: "Debit/Withdrawal amount (string). Use 0.00 if empty." },
                    credit: { type: Type.STRING, description: "Credit/Deposit amount (string). Use 0.00 if empty." },
                    balance: { type: Type.STRING, description: "Running balance (string)", nullable: true }, // Made nullable
                    currency: { type: Type.STRING, description: "Currency of this specific transaction", nullable: true }, // Made nullable
                    category: { type: Type.STRING, description: "Transaction Category if present", nullable: true },
                    confidence: { type: Type.NUMBER, description: "0-100", nullable: true },
                },
                // Relaxed: balance and currency are NOT required strictly per row
                required: ["date", "description", "debit", "credit"],
            },
        },
        currency: { type: Type.STRING, nullable: true },
    },
    required: ["transactions", "currency"],
};

/**
 * Unified Prompt for Single-Pass Extraction
 */
const getUnifiedBankStatementPrompt = (startDate?: string, endDate?: string) => {
    // REMOVED STRICT DATE RESTRICTION TO PREVENT AI FROM HIDING DATA
    const dateContext = startDate && endDate ? `\nContext: Statement period is likely ${startDate} to ${endDate}, but EXTRACT ALL transactions found.` : "";

    return `Analyze this bank statement image and extract data into a structured JSON format.
${dateContext}INSTRUCTIONS:
1. **SUMMARY**: Extract Account Holder, Account Number, Period, Opening Balance, Closing Balance, Total Withdrawals, Total Deposits, and Currency.
   - **STRICT BALANCE EXTRACTION**: 
     - Look for keywords: “Closing Balance”, “Closing Available Balance”, “Ending Balance”, “Balance at End”, “Balance as at”, "Closing(Available) Balance", "Available Balance", "Final Balance", "Balance Forward".
     - Map the nearest numeric value to these labels.
     - Extract ONLY if explicitly written. DO NOT calculate or infer. If not found, return null.

2. **TRANSACTIONS**: Extract the transaction table row-by-row.
   - **Date**: Extract date in DD/MM/YYYY format.
   - **Description**: Capture the full description (merge multi-line descriptions if needed).
   - **Amounts**: valid numbers only.
     - **Debit** = Money OUT (Withdrawals, Payments, Charges, fees).
     - **Credit** = Money IN (Deposits, Refunds, salary, transfers in).
   - **Balance**: Extract the running balance ONLY IF present in a column. If no balance column exists, return null or 0.
   - **Currency**: Capture the currency as it appears for this specific transaction. If not explicitly per-row, return null (it will default to statement currency).
   - **Strict Column Mapping**: Use headers (e.g., "Withdrawals", "Deposits", "Debit", "Credit") to identify columns. 
     - "Debit/Dr/Withdrawal" -> Debit Column.
     - "Credit/Cr/Deposit" -> Credit Column.
     - If signs are used (e.g. -500), use context to determine if it's money out (Debit).

3. **CURRENCY DETECTION**: 
   - **DO NOT DEFAULT TO AED**. 
   - Identify the actual currency of each document/page by looking for:
     - ISO codes (AED, USD, EUR, INR, etc.)
     - Symbols ($, €, £, ₹, etc.)
     - Text like "Dirhams", "Dollars", "US Dollars", "Euro", etc.
   - Look in statement headers, column footers, or transaction rows.
   - If absolutely NO currency information is found, use "UNKNOWN".

4. **GENERAL**:
   - Return valid JSON matching the schema.
   - Do not hallucinate values.
${dateContext}`;
};

/**
 * Validates and fixes Debit/Credit swapping by running a "4-Way Race" to find the best mathematical fit.
 */
export const validateAndFixTransactionDirection = (transactions: Transaction[], initialOpeningBalance: number = 0): Transaction[] => {
    if (!transactions || transactions.length < 2) return transactions;

    // Filter to rows with balances for validation
    const rowsWithBalance = transactions.map((t, index) => ({ ...t, originalIndex: index })).filter(t => t.balance !== 0);

    if (rowsWithBalance.length < 2) {
        // Not enough rows to validate
        return transactions;
    }

    // Helper to calc error for a pair of rows given a config
    const calculatePairError = (
        prevBal: number,
        currBal: number,
        currDebit: number,
        currCredit: number,
        isSwapped: boolean
    ): number => {
        const actualDebit = isSwapped ? currCredit : currDebit;
        const actualCredit = isSwapped ? currDebit : currCredit;
        // Standard Logic: NewBalance = OldBalance + Credit - Debit
        const deltaOCR = currBal - prevBal;
        const deltaCalc = actualCredit - actualDebit;
        return Math.abs(deltaOCR - deltaCalc);
    };

    let errorAscNormal = 0;
    let errorAscSwapped = 0;
    let errorDescNormal = 0;
    let errorDescSwapped = 0;

    // Calculate errors
    for (let i = 1; i < rowsWithBalance.length; i++) {
        const rowOlder = rowsWithBalance[i - 1]; // "Prev" in list
        const rowNewer = rowsWithBalance[i];     // "Curr" in list

        // Model 1 & 2: Ascending (List is Old -> New)
        errorAscNormal += calculatePairError(rowOlder.balance, rowNewer.balance, rowNewer.debit || 0, rowNewer.credit || 0, false);
        errorAscSwapped += calculatePairError(rowOlder.balance, rowNewer.balance, rowNewer.debit || 0, rowNewer.credit || 0, true);

        // Model 3 & 4: Descending (List is New -> Old)
        errorDescNormal += calculatePairError(rowNewer.balance, rowOlder.balance, rowOlder.debit || 0, rowOlder.credit || 0, false);
        errorDescSwapped += calculatePairError(rowNewer.balance, rowOlder.balance, rowOlder.debit || 0, rowOlder.credit || 0, true);
    }

    const errors = [
        { name: "AscNormal", error: errorAscNormal, swap: false },
        { name: "AscSwapped", error: errorAscSwapped, swap: true },
        { name: "DescNormal", error: errorDescNormal, swap: false },
        { name: "DescSwapped", error: errorDescSwapped, swap: true },
    ];

    errors.sort((a, b) => a.error - b.error);
    const bestFit = errors[0];
    const bestNonSwap = errors.find(e => !e.swap);

    let shouldSwap = bestFit.swap;

    if (shouldSwap && bestNonSwap) {
        if (bestNonSwap.error < (rowsWithBalance.length * 0.5)) {
            shouldSwap = false;
        }
    }

    if (shouldSwap) {
        console.warn(`[Gemini Service] Validation DETECTED INCORRECT MAPPING (${bestFit.name}). Swapping columns.`);
        return transactions.map(t => ({
            ...t,
            debit: t.credit,
            credit: t.debit
        }));
    }

    return transactions;
};

/**
 * Extract Transactions from bank statement images (Unified Single-Pass)
 */
export const extractTransactionsFromImage = async (
    imageParts: Part[],
    startDate?: string,
    endDate?: string
): Promise<{ transactions: Transaction[]; summary: BankStatementSummary; currency: string }> => {
    console.log(`[Gemini Service] Extraction started. Image parts: ${imageParts.length}`);

    // Batch processing (1 page per batch to ensure high quality)
    const BATCH_SIZE = 1;
    let allTransactions: Transaction[] = [];
    let finalSummary = {
        accountHolder: null as string | null,
        accountNumber: null as string | null,
        statementPeriod: null as string | null,
        openingBalance: null as number | null,
        openingBalanceCurrency: null as string | null,
        closingBalance: null as number | null,
        closingBalanceCurrency: null as string | null,
        totalWithdrawalsAED: 0,
        totalDepositsAED: 0,
    };
    let lastKnownCurrency = "UNKNOWN";

    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        const batchParts = imageParts.slice(i, i + BATCH_SIZE);

        try {
            // Rate limiting delay if needed
            if (i > 0) await new Promise((r) => setTimeout(r, 2000));

            const response = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: { parts: [...batchParts, { text: getUnifiedBankStatementPrompt(startDate, endDate) }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: unifiedBankStatementSchema,
                        maxOutputTokens: 30000,
                        temperature: 0,
                    },
                })
            );

            const data = safeJsonParse(response.text || "");

            const pageCurrency = (data?.currency && data.currency !== "N/A" && data.currency !== "Unknown" && data.currency !== "UNKNOWN")
                ? data.currency.toUpperCase()
                : lastKnownCurrency;

            if (pageCurrency !== "UNKNOWN") {
                lastKnownCurrency = pageCurrency;
            }

            if (data?.transactions) {
                const batchTx = data.transactions.map((t: any) => ({
                    date: t.date || "",
                    description: t.description || "",
                    debit: Number(String(t.debit || "0").replace(/,/g, "")) || 0,
                    credit: Number(String(t.credit || "0").replace(/,/g, "")) || 0,
                    balance: Number(String(t.balance || "0").replace(/,/g, "")) || 0,
                    confidence: Number(t.confidence) || 0,
                    currency: t.currency || pageCurrency,
                }));
                allTransactions.push(...batchTx);
            }

            // Merge summary (prefer non-null values)
            if (data?.summary) {
                if (data.summary.accountHolder) finalSummary.accountHolder = data.summary.accountHolder;
                if (data.summary.accountNumber) finalSummary.accountNumber = data.summary.accountNumber;
                if (data.summary.statementPeriod) finalSummary.statementPeriod = data.summary.statementPeriod;

                // Track opening balance and its currency from the first page it appears on
                if (finalSummary.openingBalance === null && (data.summary.openingBalance !== undefined && data.summary.openingBalance !== null)) {
                    finalSummary.openingBalance = data.summary.openingBalance;
                    finalSummary.openingBalanceCurrency = pageCurrency;
                }

                // Track closing balance and its currency - we want the LAST non-null value
                if (data.summary.closingBalance !== undefined && data.summary.closingBalance !== null) {
                    finalSummary.closingBalance = data.summary.closingBalance;
                    finalSummary.closingBalanceCurrency = pageCurrency;
                }

                // Convert withdrawals and deposits to AED on the fly
                const rate = await fetchExchangeRate(pageCurrency, "AED");
                if (data.summary.totalWithdrawals) {
                    finalSummary.totalWithdrawalsAED += data.summary.totalWithdrawals * rate;
                }
                if (data.summary.totalDeposits) {
                    finalSummary.totalDepositsAED += data.summary.totalDeposits * rate;
                }
            }

        } catch (error) {
            console.error(`[Gemini Service] Batch extraction failed:`, error);
        }
    }

    // Post-processing
    let processedTransactions = deduplicateTransactions(allTransactions);

    // DETERMINISTIC VALIDATION: Only valid if we have an opening balance to anchor on
    // AND strict extraction is prioritized.
    // Use extracted opening balance if available, else 0 (but don't fail).
    const validationOpening = Number(finalSummary.openingBalance) || 0;

    // We still run validation to fix column swaps, but we trust the model's extraction more now due to strict prompt.
    // Use the function but maybe with less aggression? 
    // current validateAndFixTransactionDirection uses OCR deltas which is robust.
    processedTransactions = validateAndFixTransactionDirection(processedTransactions, validationOpening);

    if (startDate || endDate) {
        processedTransactions = filterTransactionsByDate(processedTransactions, startDate, endDate);
    }

    // NO manual recalculation of Opening/Closing Balance.
    // If they are null, they remain null.
    // UNLESS they are completely missing, we might sum up transactions if asked.. 
    // The requirement says "Opening Balance and Closing Balance are extracted strictly ... without deriving ... if .. not clearly present ... left empty".
    // So we do NOTHING here.

    // Currency conversion logic (now per-transaction and statement-level)
    processedTransactions = await Promise.all(processedTransactions.map(async (t) => {
        const tCurr = (t.currency || lastKnownCurrency || "AED").toUpperCase();
        if (tCurr !== "AED" && tCurr !== "N/A" && tCurr !== "UNKNOWN") {
            const rate = await fetchExchangeRate(tCurr, "AED");
            if (rate !== 1) {
                return {
                    ...t,
                    originalCurrency: tCurr,
                    originalDebit: t.debit,
                    originalCredit: t.credit,
                    originalBalance: t.balance,
                    debit: Number(((t.debit || 0) * rate).toFixed(2)),
                    credit: Number(((t.credit || 0) * rate).toFixed(2)),
                    balance: Number(((t.balance || 0) * rate).toFixed(2)),
                    currency: tCurr, // Keep original currency in the `currency` field for display
                };
            }
        }
        return { ...t, currency: tCurr };
    }));

    // Capture original balances before AED conversion
    const originalOpeningBal = finalSummary.openingBalance ?? undefined;
    const originalClosingBal = finalSummary.closingBalance ?? undefined;

    // Convert Opening Balance
    if (finalSummary.openingBalance !== null && finalSummary.openingBalanceCurrency && finalSummary.openingBalanceCurrency !== "AED" && finalSummary.openingBalanceCurrency !== "UNKNOWN") {
        const rate = await fetchExchangeRate(finalSummary.openingBalanceCurrency, "AED");
        finalSummary.openingBalance = Number((finalSummary.openingBalance * rate).toFixed(2));
    }

    // Convert Closing Balance
    if (finalSummary.closingBalance !== null && finalSummary.closingBalanceCurrency && finalSummary.closingBalanceCurrency !== "AED" && finalSummary.closingBalanceCurrency !== "UNKNOWN") {
        const rate = await fetchExchangeRate(finalSummary.closingBalanceCurrency, "AED");
        finalSummary.closingBalance = Number((finalSummary.closingBalance * rate).toFixed(2));
    }

    const resultCurrency = "AED";

    const resultSummary: BankStatementSummary = {
        accountHolder: finalSummary.accountHolder || "N/A",
        accountNumber: finalSummary.accountNumber || "N/A",
        statementPeriod: finalSummary.statementPeriod || "N/A",
        openingBalance: finalSummary.openingBalance, // AED
        closingBalance: finalSummary.closingBalance, // AED
        originalOpeningBalance: originalOpeningBal,
        originalClosingBalance: originalClosingBal,
        totalWithdrawals: Number(finalSummary.totalWithdrawalsAED.toFixed(2)),
        totalDeposits: Number(finalSummary.totalDepositsAED.toFixed(2)),
    };

    console.log(`[Gemini Service] Extraction success: ${processedTransactions.length} txns found. Final Currency: ${resultCurrency}`);
    return { transactions: processedTransactions, summary: resultSummary, currency: resultCurrency };
};

/**
 * Local rules (merged)
 */
const LOCAL_RULES = [
    { keywords: ["FTA", "FederalTaxAuthority", "VATPayment", "VATReturn", "TaxPayment"], category: "Liabilities|CurrentLiabilities|VAT Payable (Output VAT)" },
    { keywords: ["VATonCharges", "VATonFees", "TaxonCharges", "TaxonFees"], category: "Liabilities|CurrentLiabilities|VAT Payable (Output VAT)" },
    { keywords: ["DEWA", "SEWA", "Dubaielectricity"], category: "Expenses|OtherExpense|Utility - Electricity & Water" },
    { keywords: ["ENOC", "ADNOC", "EMARAT"], category: "Expenses|OtherExpense|Fuel Expenses" },
    { keywords: ["RTA", "Salik", "Emirates", "Careem"], category: "Expenses|OtherExpense|Travel & Entertainment" },
    { keywords: ["Google", "Facebook", "Godaddy", "DU", "MobileExpenses", "MYFATOORAH"], category: "Expenses|OtherExpense|IT & Software Subscriptions" },
    { keywords: ["ETISALAT", "Mobily", "EmiratestechnologyIntegrated"], category: "Expenses|OtherExpense|Utility - Telephone & Internet" },
    { keywords: ["Visaexpenses"], category: "Expenses|OtherExpense|Government Fees & Licenses" },
    { keywords: ["TASAREEH", "SmartDubai", "MOFA", "Dubai"], category: "Expenses|OtherExpense|Legal Fees" },
    { keywords: ["TheVATConsultant"], category: "Expenses|OtherExpense|Professional Fees" },
    { keywords: ["BookkeepingServices"], category: "Expenses|OtherExpense|Professional Fees" },
    { keywords: ["Salary", "ALansariexchange", "SIF", "WPS", "Payroll"], category: "Expenses|OtherExpense|Salaries & Wages" },
    { keywords: ["DirectorsRemuneration"], category: "Expenses|OtherExpense|Salaries & Wages" },
    { keywords: ["NetworkInternational", "POS"], category: "Income|OperatingIncome|Sales Revenue" },
    { keywords: ["Charges", "fee", "Remittance", "MonthlyrelationshipFee", "Subscription"], category: "Expenses|OtherExpense|Bank Charges" },
    { keywords: ["CashWithdrawal", "ATMWithdrawal", "CDMW", "ATMCWD", "CashWdl"], category: "Uncategorized" },
];

/**
 * Invoice schemas (merged)
 */
const lineItemSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING },
        quantity: { type: Type.NUMBER },
        unitPrice: { type: Type.NUMBER },
        subtotal: { type: Type.NUMBER },
        taxRate: { type: Type.NUMBER },
        taxAmount: { type: Type.NUMBER },
        total: { type: Type.NUMBER },
    },
    // Relaxed: quantity and unitPrice are often missing in simple receipts
    required: ["description", "total"],
};

const invoiceSchema = {
    type: Type.OBJECT,
    properties: {
        invoiceId: { type: Type.STRING },
        vendorName: { type: Type.STRING },
        customerName: { type: Type.STRING },
        invoiceDate: { type: Type.STRING },
        dueDate: { type: Type.STRING },
        totalBeforeTax: { type: Type.NUMBER },
        totalTax: { type: Type.NUMBER },
        zeroRated: { type: Type.NUMBER },
        totalAmount: { type: Type.NUMBER },
        totalBeforeTaxAED: { type: Type.NUMBER },
        totalTaxAED: { type: Type.NUMBER },
        zeroRatedAED: { type: Type.NUMBER },
        totalAmountAED: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        invoiceType: { type: Type.STRING, enum: ["sales", "purchase"] },
        vendorTrn: { type: Type.STRING },
        customerTrn: { type: Type.STRING },
        lineItems: { type: Type.ARRAY, items: lineItemSchema },
        confidence: { type: Type.NUMBER },
    },
    // Relaxed: invoiceId and lineItems are not strictly required effectively allowing summaries
    required: ["vendorName", "totalAmount", "invoiceDate"],
};

const multiInvoiceSchema = {
    type: Type.OBJECT,
    properties: {
        invoices: { type: Type.ARRAY, items: invoiceSchema },
    },
};

const getInvoicePrompt = (companyName?: string, companyTrn?: string) => {
    let contextInstruction = "";
    if (companyName || companyTrn) {
        contextInstruction = `UserCompany:"${companyName || "N/A"}" UserTRN:"${companyTrn || "N/A"}"
Rule1(Sales): If VENDOR Name/TRN matches UserCompany, it's 'sales'.
Rule2(Purchase): If CUSTOMER Name/TRN matches UserCompany, it's 'purchase'.`;
    }

    return `Extract invoice details from this document. Return JSON with "invoices" array.
${contextInstruction}

Fields:
- invoiceId
- invoiceDate (DD/MM/YYYY)
- vendorName
- vendorTrn
- customerName
- customerTrn
- totalBeforeTax
- totalTax
- totalAmount
- currency (AED, USD, etc.)
- lineItems (extract all rows)

Note:
- If foreign currency appears, you may compute AED using a 3.67 rate for USD only IF explicitly stated/needed, otherwise keep currency fields accurate.
Return ONLY valid JSON.`;
};

export const extractInvoicesData = async (
    imageParts: Part[],
    knowledgeBase: Invoice[] = [],
    userCompanyName?: string,
    userCompanyTrn?: string
): Promise<{ invoices: Invoice[] }> => {
    const BATCH_SIZE = 2;
    const MAX_CONCURRENT = 3;
    const chunkedParts: Part[][] = [];
    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        chunkedParts.push(imageParts.slice(i, i + BATCH_SIZE));
    }

    let allInvoices: Invoice[] = [];

    const processBatch = async (batch: Part[], index: number) => {
        try {
            const kbContext =
                knowledgeBase.length > 0
                    ? `Known vendors: ${JSON.stringify(
                        knowledgeBase.map((i) => ({
                            name: i.vendorName,
                            idPattern: (i.invoiceId || "").replace(/\d/g, "#"),
                        }))
                    )}.`
                    : "";

            const prompt = getInvoicePrompt(userCompanyName, userCompanyTrn) + "\n" + kbContext;

            if (index > 0) await new Promise((r) => setTimeout(r, 1000));

            const response = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [...batch, { text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: multiInvoiceSchema,
                        maxOutputTokens: 30000,
                        temperature: 0,
                    },
                })
            );

            const data = safeJsonParse(response.text || "");
            let batchInvoices: Invoice[] = [];

            if (data && Array.isArray(data.invoices)) batchInvoices = data.invoices;
            else if (data && data.invoiceId) batchInvoices = [data];

            return batchInvoices.map((inv: Invoice) => {
                if (!inv.totalTax && inv.lineItems?.length) {
                    inv.totalTax = inv.lineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
                }
                if (!inv.totalBeforeTax && inv.lineItems?.length) {
                    inv.totalBeforeTax = inv.lineItems.reduce(
                        (sum, item) => sum + (item.subtotal || item.quantity * item.unitPrice),
                        0
                    );
                }

                const calculatedTotal = (inv.totalBeforeTax || 0) + (inv.totalTax || 0);
                if (Math.abs((inv.totalAmount || 0) - calculatedTotal) > 1.0 && calculatedTotal > 0) {
                    if (!inv.totalAmount || inv.totalAmount === 0) inv.totalAmount = calculatedTotal;
                }

                inv.totalTax = inv.totalTax ? parseFloat(inv.totalTax.toFixed(2)) : 0;
                inv.totalBeforeTax = inv.totalBeforeTax ? parseFloat(inv.totalBeforeTax.toFixed(2)) : 0;
                inv.totalAmount = inv.totalAmount ? parseFloat(inv.totalAmount.toFixed(2)) : 0;

                inv.zeroRated = inv.zeroRated ? parseFloat(inv.zeroRated.toFixed(2)) : 0;

                inv.totalBeforeTaxAED =
                    inv.totalBeforeTaxAED != null
                        ? parseFloat(Number(inv.totalBeforeTaxAED).toFixed(2))
                        : inv.currency === "AED"
                            ? inv.totalBeforeTax
                            : 0;

                inv.totalTaxAED =
                    inv.totalTaxAED != null
                        ? parseFloat(Number(inv.totalTaxAED).toFixed(2))
                        : inv.currency === "AED"
                            ? inv.totalTax
                            : 0;

                inv.zeroRatedAED =
                    inv.zeroRatedAED != null
                        ? parseFloat(Number(inv.zeroRatedAED).toFixed(2))
                        : inv.currency === "AED"
                            ? inv.zeroRated
                            : 0;

                inv.totalAmountAED =
                    inv.totalAmountAED != null
                        ? parseFloat(Number(inv.totalAmountAED).toFixed(2))
                        : inv.currency === "AED"
                            ? inv.totalAmount
                            : 0;

                return classifyInvoice(inv, userCompanyName, userCompanyTrn);
            });
        } catch (error) {
            console.error(`Error extracting invoices batch ${index + 1}:`, error);
            return [];
        }
    };

    let cursor = 0;
    while (cursor < chunkedParts.length) {
        const slice = chunkedParts.slice(cursor, cursor + MAX_CONCURRENT);
        const results = await Promise.all(slice.map((batch, idx) => processBatch(batch, cursor + idx)));
        results.forEach(batchInvoices => {
            allInvoices.push(...batchInvoices);
        });
        cursor += MAX_CONCURRENT;
    }

    return { invoices: allInvoices };
};

/**
 * Simple doc extractors
 */
export const extractEmiratesIdData = async (imageParts: Part[]) => {
    const prompt = `Extract Emirates ID details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json", temperature: 0 },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractPassportData = async (imageParts: Part[]) => {
    const prompt = `Extract Passport details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json", temperature: 0 },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractVisaData = async (imageParts: Part[]) => {
    const prompt = `Extract Visa details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json", temperature: 0 },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractTradeLicenseData = async (imageParts: Part[]) => {
    const prompt = `Extract Trade License details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json", temperature: 0 },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractDataFromImage = async (parts: Part[], documentType: string) => {
    switch (documentType) {
        case "EmiratesID":
            return extractEmiratesIdData(parts);
        case "Passport":
            return extractPassportData(parts);
        case "Visa":
            return extractVisaData(parts);
        case "TradeLicense":
            return extractTradeLicenseData(parts);
        default:
            return extractGenericDetailsFromDocuments(parts);
    }
};

/**
 * Project documents extraction (merged):
 * - Uses Phase1 bank statement schema inside project schema
 * - Parses rawTransactionTableText using Phase2 prompt
 * - Extracts invoices + classifies
 */
const emiratesIdSchema = {
    type: Type.OBJECT,
    properties: {
        idNumber: { type: Type.STRING, nullable: true },
        name: { type: Type.STRING, nullable: true },
        dateofbirth: { type: Type.STRING, nullable: true },
        nationality: { type: Type.STRING, nullable: true },
        expirydate: { type: Type.STRING, nullable: true },
    },
};

const passportSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, nullable: true },
        passportNumber: { type: Type.STRING, nullable: true },
        nationality: { type: Type.STRING, nullable: true },
        dateOfExpiry: { type: Type.STRING, nullable: true },
    },
};

const visaSchema = {
    type: Type.OBJECT,
    properties: {
        idNumber: { type: Type.STRING, nullable: true },
        name: { type: Type.STRING, nullable: true },
        fileNumber: { type: Type.STRING, nullable: true },
        expiryDate: { type: Type.STRING, nullable: true },
    },
};

const tradeLicenseSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        licenseFormationDate: { type: Type.STRING, nullable: true },
        expiryDate: { type: Type.STRING, nullable: true },
        activities: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    },
};


export const extractProjectDocuments = async (
    imageParts: Part[],
    companyName?: string,
    companyTrn?: string
): Promise<{
    transactions: Transaction[];
    salesInvoices: Invoice[];
    purchaseInvoices: Invoice[];
    summary: BankStatementSummary | null;
    currency: string | null;
    emiratesIds: any[];
    passports: any[];
    visas: any[];
    tradeLicenses: any[];
}> => {
    // We add specific instruction for Bank Statement to ensure strictness even in mixed mode
    const prompt = `Analyze mixed documents for Company="${companyName || "Unknown"}", TRN="${companyTrn || "Unknown"}". 
Return a single JSON object with: bankStatement, salesInvoices, purchaseInvoices, emiratesIds, passports, visas, tradeLicenses.

IMPORTANT FOR BANK STATEMENTS:
- Extract Opening/Closing Balance ONLY if explicitly present. Do not calculate.
- Extract transactions with date, description, debit, credit, balance.
- return null for bankStatement if no bank statement is found.`;

    try {
        const projectSchema = {
            type: Type.OBJECT,
            properties: {
                bankStatement: unifiedBankStatementSchema, // Use unified schema directly
                salesInvoices: { type: Type.ARRAY, items: invoiceSchema },
                purchaseInvoices: { type: Type.ARRAY, items: invoiceSchema },
                emiratesIds: { type: Type.ARRAY, items: emiratesIdSchema },
                passports: { type: Type.ARRAY, items: passportSchema },
                visas: { type: Type.ARRAY, items: visaSchema },
                tradeLicenses: { type: Type.ARRAY, items: tradeLicenseSchema },
            },
            required: ["salesInvoices", "purchaseInvoices", "bankStatement"],
        };

        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...imageParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: projectSchema,
                    maxOutputTokens: 30000,
                    temperature: 0,
                },
            })
        );

        const data = safeJsonParse(response.text || "");
        if (!data) {
            return {
                transactions: [],
                salesInvoices: [],
                purchaseInvoices: [],
                summary: null,
                currency: null,
                emiratesIds: [],
                passports: [],
                visas: [],
                tradeLicenses: [],
            };
        }

        let allInvoices: Invoice[] = [...(data.salesInvoices || []), ...(data.purchaseInvoices || [])];
        if (companyName || companyTrn) {
            allInvoices = allInvoices.map((inv) => classifyInvoice(inv, companyName, companyTrn));
        }

        // Transactions now come directly from the unified extraction
        let allTransactions: Transaction[] = [];
        const mainCurrency = (data.bankStatement?.currency || "AED").toUpperCase();

        if (data.bankStatement && Array.isArray(data.bankStatement.transactions)) {
            allTransactions = await Promise.all(data.bankStatement.transactions.map(async (t: any) => {
                const tCurr = (t.currency || mainCurrency).toUpperCase();
                let debit = Number(String(t.debit || "0").replace(/,/g, "")) || 0;
                let credit = Number(String(t.credit || "0").replace(/,/g, "")) || 0;
                let balance = Number(String(t.balance || "0").replace(/,/g, "")) || 0;

                const originalDebit = debit;
                const originalCredit = credit;
                const originalBalance = balance;

                if (tCurr !== "AED" && tCurr !== "N/A" && tCurr !== "UNKNOWN") {
                    const rate = await fetchExchangeRate(tCurr, "AED");
                    debit = Number((debit * rate).toFixed(2));
                    credit = Number((credit * rate).toFixed(2));
                    balance = Number((balance * rate).toFixed(2));
                }

                const txn: Transaction = {
                    date: t.date || "",
                    description: t.description || "",
                    debit,
                    credit,
                    balance,
                    confidence: Number(t.confidence) || 0,
                    currency: tCurr,
                };

                if (tCurr !== "AED" && tCurr !== "N/A" && tCurr !== "UNKNOWN") {
                    txn.originalCurrency = tCurr;
                    txn.originalDebit = originalDebit;
                    txn.originalCredit = originalCredit;
                    txn.originalBalance = originalBalance;
                }

                return txn;
            }));
        }

        // Post-process transactions (dedup + direction fix)
        // We use the extracted opening balance for validation if available
        const extractedOpening = data.bankStatement?.summary?.openingBalance;
        const validationOpening = extractedOpening !== null && extractedOpening !== undefined ? Number(extractedOpening) : 0;

        const deduplicatedTransactions = deduplicateTransactions(allTransactions);
        const finalTransactions = validateAndFixTransactionDirection(deduplicatedTransactions, validationOpening);

        // Convert summary balances to AED if needed
        let finalSummary: BankStatementSummary | null = data.bankStatement?.summary || null;
        if (finalSummary && mainCurrency !== "AED" && mainCurrency !== "N/A" && mainCurrency !== "UNKNOWN") {
            const rate = await fetchExchangeRate(mainCurrency, "AED");
            if (finalSummary.openingBalance != null) {
                finalSummary.originalOpeningBalance = finalSummary.openingBalance;
                finalSummary.openingBalance = Number((finalSummary.openingBalance * rate).toFixed(2));
            }
            if (finalSummary.closingBalance != null) {
                finalSummary.originalClosingBalance = finalSummary.closingBalance;
                finalSummary.closingBalance = Number((finalSummary.closingBalance * rate).toFixed(2));
            }
            if (finalSummary.totalWithdrawals != null) finalSummary.totalWithdrawals = Number((finalSummary.totalWithdrawals * rate).toFixed(2));
            if (finalSummary.totalDeposits != null) finalSummary.totalDeposits = Number((finalSummary.totalDeposits * rate).toFixed(2));
        }

        return {
            transactions: finalTransactions,
            salesInvoices: allInvoices.filter((i) => i.invoiceType === "sales"),
            purchaseInvoices: allInvoices.filter((i) => i.invoiceType === "purchase"),
            summary: finalSummary,
            currency: "AED", // Explicitly report AED as the final result currency
            emiratesIds: data.emiratesIds || [],
            passports: data.passports || [],
            visas: data.visas || [],
            tradeLicenses: data.tradeLicenses || [],
        };
    } catch (error) {
        console.error("Project extraction error:", error);

        return {
            transactions: [],
            salesInvoices: [],
            purchaseInvoices: [],
            summary: null,
            currency: null,
            emiratesIds: [],
            passports: [],
            visas: [],
            tradeLicenses: [],
        };
    }
};

/**
 * Analyze transactions (merged model choice)
 */
export const analyzeTransactions = async (
    transactions: Transaction[]
): Promise<{ analysis: AnalysisResult; categorizedTransactions: Transaction[] }> => {
    const prompt = `Analyze transactions. Assign categories from: ${TRANSACTION_CATEGORIES.join(
        ","
    )}.
Calculate cashflow, identify recurring payments, provide spending summary.
Transactions: ${JSON.stringify(transactions.slice(0, 500))}...
Return JSON:
{
  "categorizedTransactions": [...],
  "analysis": {
    "spendingSummary": "...",
    "cashFlow": { "totalIncome": number, "totalExpenses": number, "netCashFlow": number },
    "recurringPayments": [{ "description": "...", "amount": number, "frequency": "..." }]
  }
}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            categorizedTransactions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING },
                        description: { type: Type.STRING },
                        debit: { type: Type.NUMBER },
                        credit: { type: Type.NUMBER },
                        balance: { type: Type.NUMBER },
                        confidence: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                    },
                },
            },
            analysis: {
                type: Type.OBJECT,
                properties: {
                    spendingSummary: { type: Type.STRING },
                    cashFlow: {
                        type: Type.OBJECT,
                        properties: {
                            totalIncome: { type: Type.NUMBER },
                            totalExpenses: { type: Type.NUMBER },
                            netCashFlow: { type: Type.NUMBER },
                        },
                        required: ["totalIncome", "totalExpenses", "netCashFlow"],
                    },
                    recurringPayments: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                                amount: { type: Type.NUMBER },
                                frequency: { type: Type.STRING },
                            },
                        },
                    },
                },
                required: ["spendingSummary", "cashFlow", "recurringPayments"],
            },
        },
        required: ["categorizedTransactions", "analysis"],
    };

    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );

    const data = safeJsonParse(response.text || "");

    return {
        analysis:
            data?.analysis || ({
                spendingSummary: "Analysis failed",
                cashFlow: { totalIncome: 0, totalExpenses: 0, netCashFlow: 0 },
                recurringPayments: [],
            } as any),
        categorizedTransactions: data?.categorizedTransactions || transactions,
    };
};

/**
 * Categorize Transactions by CoA (merged + reliable batching)
 */
export const categorizeTransactionsByCoA = async (transactions: Transaction[]): Promise<Transaction[]> => {
    // 1) Apply LOCAL_RULES first
    const updatedTransactions = transactions.map((t) => {
        const isUncategorized = !t.category || t.category.toUpperCase().includes("UNCATEGORIZED");
        if (!isUncategorized) return t;

        const desc = (t.description || "").toLowerCase();
        const isCredit = (t.credit || 0) > 0 && (t.credit || 0) > (t.debit || 0);

        const matchedRule = LOCAL_RULES.find((rule) => {
            if ((rule.category.startsWith("Expenses") || rule.category.startsWith("Assets")) && isCredit) return false;
            if ((rule.category.startsWith("Income") || rule.category.startsWith("Equity")) && !isCredit) return false;

            return rule.keywords.some((k) => {
                const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const pattern = new RegExp(`(^|[^a-z0-9])${escapedK}(?=[^a-z0-9]|$)`, "i");
                return pattern.test(desc);
            });
        });

        if (matchedRule) return { ...t, category: matchedRule.category };
        return t;
    });

    // 2) Build pending map for remaining uncategorized
    const pendingCategorizationMap = new Map<string, number[]>();
    updatedTransactions.forEach((t, index) => {
        const isUncategorized = !t.category || t.category.toUpperCase().includes("UNCATEGORIZED");
        if (isUncategorized) {
            const isCredit = (t.credit || 0) > 0 && (t.credit || 0) > (t.debit || 0);
            const type = isCredit ? "MoneyIn(Credit)" : "MoneyOut(Debit)";
            const key = JSON.stringify({ description: (t.description || "").trim(), type });
            if (!pendingCategorizationMap.has(key)) pendingCategorizationMap.set(key, []);
            pendingCategorizationMap.get(key)!.push(index);
        }
    });

    const uniqueKeys = Array.from(pendingCategorizationMap.keys());
    if (uniqueKeys.length === 0) return updatedTransactions;

    const coaStructure = JSON.stringify(CHART_OF_ACCOUNTS);

    // merged: safer batch size (4-10)
    const BATCH_SIZE = 8;

    for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
        const batchKeys = uniqueKeys.slice(i, i + BATCH_SIZE);
        const batchItems = batchKeys.map((k) => JSON.parse(k));

        const prompt = `You are a professional accountant.
Assign the most appropriate specific leaf-level category from the provided Chart of Accounts (CoA) to each transaction.

CoA Structure: ${coaStructure}
Transactions to categorize: ${JSON.stringify(batchItems)}

Rules:
1) DIRECTION:
- "MoneyIn(Credit)" must be 'Income', 'Equity', or 'Liabilities'. NEVER 'Expenses' or 'Assets'.
- "MoneyOut(Debit)" must be 'Expenses', 'Assets', or 'Liabilities'. NEVER 'Income' or 'Equity'.

2) SPECIAL:
- "ATMCashDeposit" (MoneyIn) -> "Income|OperatingIncome|SalesRevenue"
- "CashWithdrawal"/"ATMWithdrawal" (MoneyOut) -> "Uncategorized"

3) OUTPUT:
Return JSON with key "categories": array of strings.
Array length MUST be ${batchItems.length}.
You may return full path or leaf name.`;

        const schema = {
            type: Type.OBJECT,
            properties: { categories: { type: Type.ARRAY, items: { type: Type.STRING } } },
        };

        try {
            const response = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [{ text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        maxOutputTokens: 30000,
                        temperature: 0,
                    },
                })
            );

            const data = safeJsonParse(response.text || "");
            if (data && Array.isArray(data.categories)) {
                batchKeys.forEach((key, batchIndex) => {
                    const assignedCategory = data.categories[batchIndex];
                    if (!assignedCategory) return;

                    const indicesToUpdate = pendingCategorizationMap.get(key);
                    if (!indicesToUpdate) return;

                    indicesToUpdate.forEach((idx) => {
                        updatedTransactions[idx] = { ...updatedTransactions[idx], category: assignedCategory };
                    });
                });
            } else {
                console.error("AI response missing categories array:", data);
            }
        } catch (e) {
            console.error("Batch categorization error:", e);
        }
    }

    return updatedTransactions;
};

export const suggestCategoryForTransaction = async (
    transaction: Transaction,
    invoices: Invoice[]
): Promise<{ category: string; reason: string }> => {
    const prompt = `Suggest category for: "${transaction.description}".
Categories: ${TRANSACTION_CATEGORIES.join(",")}.
Return JSON: {"category":"...","reason":"..."}`;

    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", temperature: 0 },
        })
    );

    return safeJsonParse(response.text || "") || { category: "Uncategorized", reason: "No suggestion" };
};

/**
 * Trial balance + audit report generation
 */
export const generateTrialBalance = async (transactions: Transaction[]) => {
    return { trialBalance: [] };
};

export const generateAuditReport = async (trialBalance: TrialBalanceEntry[], companyName: string) => {
    const prompt = `Generate IFRS audit report for ${companyName} from trial balance: ${JSON.stringify(
        trialBalance
    )}.
Return JSON: {statementOfComprehensiveIncome, statementOfFinancialPosition, statementOfCashFlows, notesToFinancialStatements, independentAuditorReport}.
CRITICAL: All values must be text/string format (no nested objects).`;

    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", maxOutputTokens: 30000, temperature: 0 },
        })
    );

    return { report: safeJsonParse(response.text || "") };
};

/**
 * Business entity / certificates / generic extraction schemas
 */
const legalEntitySchema = {
    type: Type.OBJECT,
    properties: {
        shareCapital: { type: Type.NUMBER, nullable: true },
        shareholders: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, nullable: true },
                    percentage: { type: Type.NUMBER, nullable: true },
                    nationality: { type: Type.STRING, nullable: true },
                    ownerType: { type: Type.STRING, nullable: true },
                },
            },
            nullable: true,
        },
    },
};

const customerDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        entityType: { type: Type.STRING, nullable: true, enum: ENTITY_TYPES },
        entitySubType: { type: Type.STRING, nullable: true, enum: ENTITY_SUB_TYPES },
        incorporationDate: { type: Type.STRING, nullable: true },
        tradeLicenseAuthority: { type: Type.STRING, nullable: true },
        tradeLicenseNumber: { type: Type.STRING, nullable: true },
        tradeLicenseIssueDate: { type: Type.STRING, nullable: true },
        tradeLicenseExpiryDate: { type: Type.STRING, nullable: true },
        businessActivity: { type: Type.STRING, nullable: true },
        isFreezone: { type: Type.BOOLEAN, nullable: true },
        freezoneName: { type: Type.STRING, nullable: true },
        billingAddress: { type: Type.STRING, nullable: true },
        shareholders: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, nullable: true },
                    percentage: { type: Type.NUMBER, nullable: true },
                    nationality: { type: Type.STRING, nullable: true },
                    ownerType: { type: Type.STRING, nullable: true },
                },
            },
            nullable: true,
        },
        shareCapital: { type: Type.STRING, nullable: true },
        authorisedSignatories: { type: Type.STRING, nullable: true },
        trn: { type: Type.STRING, nullable: true },
        vatRegisteredDate: { type: Type.STRING, nullable: true },
        firstVatFilingPeriod: { type: Type.STRING, nullable: true },
        vatFilingDueDate: { type: Type.STRING, nullable: true },
        corporateTaxTreatment: { type: Type.STRING, nullable: true },
        corporateTaxTrn: { type: Type.STRING, nullable: true },
        corporateTaxRegisteredDate: { type: Type.STRING, nullable: true },
        corporateTaxPeriod: { type: Type.STRING, nullable: true },
        firstCorporateTaxPeriodStart: { type: Type.STRING, nullable: true },
        firstCorporateTaxPeriodEnd: { type: Type.STRING, nullable: true },
        corporateTaxFilingDueDate: { type: Type.STRING, nullable: true },
    },
};

const vatCertSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        trn: { type: Type.STRING, nullable: true },
        vatRegisteredDate: { type: Type.STRING, nullable: true },
        firstVatReturnPeriod: { type: Type.STRING, nullable: true },
        vatReturnDueDate: { type: Type.STRING, nullable: true },

        standardRatedSuppliesAmount: { type: Type.NUMBER, nullable: true },
        standardRatedSuppliesVatAmount: { type: Type.NUMBER, nullable: true },
        standardRatedExpensesAmount: { type: Type.NUMBER, nullable: true },
        standardRatedExpensesVatAmount: { type: Type.NUMBER, nullable: true },
    },
};

const vat201TotalsSchema = {
    type: Type.OBJECT,
    properties: {
        salesTotal: { type: Type.NUMBER, description: "Total amount of Sales/Supplies excluding VAT" },
        expensesTotal: { type: Type.NUMBER, description: "Total amount of Expenses/Purchases excluding VAT" },
        periodFrom: { type: Type.STRING, description: "VAT return period start date in DD/MM/YYYY format", nullable: true },
        periodTo: { type: Type.STRING, description: "VAT return period end date in DD/MM/YYYY format", nullable: true },
    },
    required: ["salesTotal", "expensesTotal"],
};

const ctCertSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        corporateTaxTrn: { type: Type.STRING, nullable: true },
        corporateTaxRegisteredDate: { type: Type.STRING, nullable: true },
        firstCorporateTaxPeriodStart: { type: Type.STRING, nullable: true },
        firstCorporateTaxPeriodEnd: { type: Type.STRING, nullable: true },
        corporateTaxFilingDueDate: { type: Type.STRING, nullable: true },
    },
};

export const extractLegalEntityDetails = async (imageParts: Part[]) => {
    const prompt = `Extract legal entity details (shareCapital, shareholders). Return JSON. If missing, return null values.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: legalEntitySchema,
                maxOutputTokens: 30000,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractGenericDetailsFromDocuments = async (imageParts: Part[]): Promise<Record<string, any>> => {
    const prompt = `Analyze document(s) and extract key information into a flat JSON object. Format dates as DD/MM/YYYY.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json", maxOutputTokens: 8192, temperature: 0 },
        })
    );
    return safeJsonParse(response.text || "{}") || {};
};

// Schema for detailed VAT extraction
const vat201DetailedSchema = {
    type: Type.OBJECT,
    properties: {
        periodFrom: { type: Type.STRING, description: "VAT Return Period Start Date (DD/MM/YYYY)", nullable: true },
        periodTo: { type: Type.STRING, description: "VAT Return Period End Date (DD/MM/YYYY)", nullable: true },
        sales: {
            type: Type.OBJECT,
            properties: {
                zeroRated: { type: Type.STRING, description: "Zero Rated Supplies amount (Box 4, 5, or similar). format: '1234.56'", nullable: true },
                standardRated: { type: Type.STRING, description: "Standard Rated Supplies Net Amount (Box 1). format: '1234.56'", nullable: true },
                vatAmount: { type: Type.STRING, description: "VAT on Standard Rated Supplies (Box 1). format: '1234.56'", nullable: true },
                total: { type: Type.STRING, description: "Total Sales/Outputs (Box 8 Net Amount). format: '1234.56'", nullable: true },
            },
            nullable: true
        },
        purchases: {
            type: Type.OBJECT,
            properties: {
                zeroRated: { type: Type.STRING, description: "Zero Rated Purchases (Box 10 or similar). format: '1234.56'", nullable: true },
                standardRated: { type: Type.STRING, description: "Standard Rated Expenses Net Amount (Box 9). format: '1234.56'", nullable: true },
                vatAmount: { type: Type.STRING, description: "VAT on Standard Rated Expenses (Box 9). format: '1234.56'", nullable: true },
                total: { type: Type.STRING, description: "Total Expenses/Inputs (Box 11 Net Amount). format: '1234.56'", nullable: true },
            },
            nullable: true
        },
        netVatPayable: { type: Type.STRING, description: "Net VAT Payable (+) or Refundable (-) (Box 14 or similar). format: '1234.56'", nullable: true }
    }
};

export const extractVat201Totals = async (imageParts: Part[]): Promise<{
    periodFrom?: string;
    periodTo?: string;
    sales: { zeroRated: number; standardRated: number; vatAmount: number; total: number };
    purchases: { zeroRated: number; standardRated: number; vatAmount: number; total: number };
    netVatPayable: number;
}> => {
    const prompt = `Analyze the uploaded VAT 201 return document (which may span multiple pages). 
    Extract the following strictly from the document structure (typically a table):

    1. **Period**: Start and End dates of the Tax Period (header section, often Box 4 for days/months/years or a range).

    2. **Sales (Outputs)**:
       - **Zero Rated**: Look for "Zero Rated Supplies" (Box 4) or "Exempt Supplies" (Box 5) or "Supplies subject to the reverse charge provisions" (Box 3). Sum them if multiple.
       - **Standard Rated (TV)**: Look for "Standard Rated Supplies" (Box 1) - Extract the "Amount (AED)" or "Net" column.
       - **VAT**: Look for "Standard Rated Supplies" (Box 1) - Extract the "VAT Amount" column.
       - **Total**: Look for "Totals" or "Total Outputs" (Box 8). Extract the "Amount (AED)" or "Net" column.

    3. **Purchases (Inputs)**:
       - **Zero Rated**: Look for "Zero Rated Expenses" or "Exempt Expenses" (Box 10). If explicit, extract.
       - **Standard Rated (TV)**: Look for "Standard Rated Expenses" (Box 9) - Extract the "Amount (AED)" or "Net".
       - **VAT**: Look for "Standard Rated Expenses" (Box 9) - Extract "VAT Amount".
       - **Total**: Look for "Totals" or "Total Inputs" (Box 11). Extract "Amount (AED)" or "Net".

    4. **Net VAT**:
       - "Net VAT Payable" or "Net VAT Repayable" (Box 14). Positive for Payable, Negative for Refundable.

    **Rules**:
    - **CRITICAL**: Return all amounts as STRINGS with NO COMMAS (e.g., "1234.56", not "1,234.56").
    - Use 0.00 if strictly missing.
    - If a field is not present (e.g. no zero rated), use "0".
    - Be precise with Box numbers as per UAE FTA VAT 201 form.
    `;

    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                // responseSchema: vat201DetailedSchema, // Commenting out Strict Schema for flexibility if needed, or use it if robust. 
                // Actually, let's keep strict schema but with STRING types.
                responseSchema: vat201DetailedSchema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );

    const data = safeJsonParse(response.text || "");

    // Helper to parse currency string
    const parseCurrency = (val: string | number | undefined | null): number => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        return parseFloat(val.replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
    };

    return {
        periodFrom: data?.periodFrom,
        periodTo: data?.periodTo,
        sales: {
            zeroRated: parseCurrency(data?.sales?.zeroRated),
            standardRated: parseCurrency(data?.sales?.standardRated),
            vatAmount: parseCurrency(data?.sales?.vatAmount),
            total: parseCurrency(data?.sales?.total)
        },
        purchases: {
            zeroRated: parseCurrency(data?.purchases?.zeroRated),
            standardRated: parseCurrency(data?.purchases?.standardRated),
            vatAmount: parseCurrency(data?.purchases?.vatAmount),
            total: parseCurrency(data?.purchases?.total)
        },
        netVatPayable: parseCurrency(data?.netVatPayable)
    };
};

export const extractBusinessEntityDetails = async (imageParts: Part[]) => {
    const prompt = `Extract business entity details from documents. Return JSON.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: customerDetailsSchema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractTradeLicenseDetailsForCustomer = async (imageParts: Part[]) => {
    const prompt = `Extract Trade License details for a UAE business customer profile.
IMPORTANT: Please be extremely precise and do not omit any details.

Fields to extract:
1. companyName: The full legal name of the company in English.
2. entityType: Map to ONE of: 
   - Legal Person - Incorporated (LLC)
   - Legal Person - Foreign Business
   - Legal Person - Club/ Association/ Society
   - Legal Person - Charity
   - Legal Person - Federal Government Entity
   - Legal Person - Emirate Government Entity
   - Legal Person - Other
   - Partnership
3. entitySubType: Map to ONE of:
   - UAE Private Company (Incl. an Establishment)
   - Public Joint Stock Company
   - Foundation
   - Trust
4. incorporationDate: Date of incorporation/formation (DD/MM/YYYY).
5. tradeLicenseAuthority: The issuing authority (e.g., Abu Dhabi Department of Economic Development (ADDED), Dubai Department of Economy and Tourism (DET), Sharjah Department of Economic Development (SEDD), ADGM, DIFC, etc.). Try to match the official name if possible.
6. tradeLicenseNumber: The formal license number.
7. tradeLicenseIssueDate: The date the current license was issued (DD/MM/YYYY).
8. tradeLicenseExpiryDate: The date the current license expires (DD/MM/YYYY).
9. businessActivity: A detailed list of activities as per the license (merged into a single string).
10. isFreezone: Set to true if the issuing authority is a Freezone or Designated Zone.
11. freezoneName: The specific name of the Freezone (if applicable).

Return JSON matching the customerDetailsSchema.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: customerDetailsSchema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractMoaDetails = async (imageParts: Part[]) => {
    const prompt = `Extract MoA details. Return JSON.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: customerDetailsSchema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractVatCertificateData = async (imageParts: Part[]) => {
    const prompt = `Analyze the document provided (VAT Registration Certificate or VAT Return).

If it is a VAT Registration Certificate:
- Extract companyName, trn (Tax Registration Number), and vatRegisteredDate.
- Use DD/MM/YYYY for dates.

If it is a VAT Return (Financials):
1) StandardRatedSupplies:
- Find breakdown by Emirate (AbuDhabi, Dubai, Sharjah, Ajman, UmmAlQuwain, RasAlKhaimah, Fujairah)
- Sum Amount(AED) => standardRatedSuppliesAmount
- Sum VATAmount(AED) => standardRatedSuppliesVatAmount
- If Total row exists for Box 1, prefer it if it matches sums.

2) StandardRatedExpenses (usually Box 9 or 10):
- Extract Amount(AED) => standardRatedExpensesAmount
- Extract VATAmount(AED) => standardRatedExpensesVatAmount

Return JSON exactly with keys:
- companyName
- trn
- vatRegisteredDate
- standardRatedSuppliesAmount
- standardRatedSuppliesVatAmount
- standardRatedExpensesAmount
- standardRatedExpensesVatAmount`;

    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: vatCertSchema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractCorporateTaxCertificateData = async (imageParts: Part[]) => {
    const prompt = `Extract Corporate Tax Registration Certificate details.

Fields to extract:
1. companyName: Full legal name.
2. corporateTaxTrn: Corporate Tax Registration Number.
3. corporateTaxRegisteredDate: Date of registration for CT (DD/MM/YYYY).
4. firstCorporateTaxPeriodStart: The start date of the first tax period (DD/MM/YYYY).
5. firstCorporateTaxPeriodEnd: The end date of the first tax period (DD/MM/YYYY).
6. corporateTaxFilingDueDate: The deadline for filing (DD/MM/YYYY).

Return JSON matching the ctCertSchema.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: ctCertSchema,
                maxOutputTokens: 30000,
                temperature: 0,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

/**
 * Opening Balance extraction (specialized)
 */
export const extractOpeningBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
    const BATCH_SIZE = 1; // Process 1 page at a time for maximum exhaustiveness
    const MAX_CONCURRENT = 3;

    // Chunk the parts
    const chunkedParts: Part[][] = [];
    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        chunkedParts.push(imageParts.slice(i, i + BATCH_SIZE));
    }

    let allEntries: TrialBalanceEntry[] = [];

    const processBatch = async (batch: Part[], index: number) => {
        const prompt = `ACT AS A DATA ENTRY AI.
    TASK: Extract table data EXACTLY as it appears in the document.
    CONTEXT: This is batch #${index + 1}.
    CRITICAL: EXTRACT EVERY SINGLE ROW. DO NOT SKIP ANY ROW. DO NOT SUMMARIZE.

    ### 1. COLUMN MAPPING (STRICT SEPARATION)
    - **Account Name**: Extract the text description.
    - **Debit Column**: Look for "Debit", "Net Debit", "Dr".
    - **Credit Column**: Look for "Credit", "Net Credit", "Cr".
    - **Separation**: A row typically has EITHER a Debit OR a Credit value.
    - **Single Column Handling**: If there is only ONE "Amount" column:
       - If followed by "Dr" or sign is positive (and context suggests debit), put in 'debit'.
       - If followed by "Cr", brackets "(100)", or sign is negative, put in 'credit'.

    ### 2. STRICT CATEGORIZATION (HEADER DRIVEN)
    You MUST determine the category based on the **SECTION HEADER** in the document.
    - Scan down the page/table.
    - Identify headers like "ASSETS", "LIABILITIES", "EQUITY", "EQUITIES", "INCOME", "EXPENSE", "EXPENSES" (or variations like "Current Assets", "Non-Current Liabilities").
    - **RULE**: All rows appearing *under* a header belong to that category until a new header is found.
    - **Map Headers to**: "Assets", "Liabilities", "Equity", "Income", "Expenses".
    - **ALWAYS OUTPUT CATEGORY** for every entry. If no headers exist, infer from account name.
    - If a page shows only one section title (e.g., "Expenses"), apply that category to every row on that page.
    
    **PRIORITY**:
    1. **Document Section Header** (Highest Priority). If a row is under "Current Assets", it is an "Assets".
    2. **Account Name Inference**: Only use if NO headers exist.

    ### 3. EXCLUSION RULES (CRITICAL)
    - **IGNORE** any row where the Account Name starts with "Total", "Grand Total", "Sum", "Difference", "Balance".
    - **IGNORE** page numbers or footer text.
    - **IGNORE** table headers like "Account", "Account Code", "Net Debit", "Net Credit", "Debit", "Credit".
    - **IGNORE** headers themselves as rows (unless you can't map them).

    ### 4. DATA INTEGRITY
    - **COPY NUMBERS EXACTLY**.
    - If a value is in the "Net Credit" column, put it in the credit field.

    ### 5. OUTPUT FORMAT
    Return a pure JSON object.
    { "entries": [{ "account": "Account Name", "debit": 100.00, "credit": 0, "category": "Assets" }] }`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                entries: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            account: { type: Type.STRING },
                            debit: { type: Type.NUMBER, nullable: true },
                            credit: { type: Type.NUMBER, nullable: true },
                            category: { type: Type.STRING, nullable: true },
                        },
                        required: ["account", "category"],
                    },
                },
            },
            required: ["entries"],
        };

        try {
            console.log(`[Gemini Service] processing batch ${index + 1}/${chunkedParts.length} with ${batch.length} parts...`);
            if (index > 0) await new Promise((r) => setTimeout(r, 1000)); // Rate limiting

            const response = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: { parts: [...batch, { text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        maxOutputTokens: 30000,
                        temperature: 0,
                    },
                })
            );

            const text = response.text || "";
            // LOGGING REDUCED to avoid stdout buffer crash
            console.log(`[Gemini Service] Batch ${index} Processing Complete.`);

            const data = safeJsonParse(text);
            if (!data || !Array.isArray(data.entries)) return [];

            // FILTER OUT TOTALS AND HEADERS CODE-SIDE AS SAFETY NET
            return data.entries
                .filter((e: any) => {
                    const name = (e.account || "").toLowerCase().trim();
                    const invalidPhrases = ["total assets", "total liabilities", "total equity", "total income", "total expenses", "grand total", "sum of", "difference between", "net profit", "net loss", "balance carried forward", "balance brought forward"];

                    const isSummary = invalidPhrases.some(p => name.includes(p));
                    // Allow extraction of all rows, even if zero, for exhaustiveness
                    return !isSummary && !name.includes("closing balance");
                })
                .map((e: any) => ({
                    account: e.account || "UnknownAccount",
                    debit: Number(e.debit) || 0,
                    credit: Number(e.credit) || 0,
                    category: e.category || null,
                }));
        } catch (error) {
            console.error(`Error extracting batch ${index}:`, error);
            return [];
        }
    };

    // Execute in chunks
    let cursor = 0;
    while (cursor < chunkedParts.length) {
        const slice = chunkedParts.slice(cursor, cursor + MAX_CONCURRENT);
        const results = await Promise.all(slice.map((batch, idx) => processBatch(batch, cursor + idx)));
        results.forEach(batchEntries => allEntries.push(...batchEntries));
        cursor += MAX_CONCURRENT;
    }

    console.log(`[Gemini Service] Total extracted raw entries: ${allEntries.length}`);
    return normalizeOpeningBalanceEntries(allEntries);
};

export const extractOpeningBalanceDataFromFiles = async (
    files: { buffer: Buffer; mimetype: string; originalname: string }[]
): Promise<TrialBalanceEntry[]> => {
    if (!files || files.length === 0) return [];

    const prompt = `ACT AS A DATA ENTRY AI.
TASK: Extract table data EXACTLY as it appears in the document.
CRITICAL: EXTRACT EVERY SINGLE ROW. DO NOT SKIP ANY ROW. DO NOT SUMMARIZE.

### 1. COLUMN MAPPING (STRICT SEPARATION)
- **Account Name**: Extract the text description.
- **Debit Column**: Look for "Debit", "Net Debit", "Dr".
- **Credit Column**: Look for "Credit", "Net Credit", "Cr".
- **Separation**: A row typically has EITHER a Debit OR a Credit value.
- **Single Column Handling**: If there is only ONE "Amount" column:
   - If followed by "Dr" or sign is positive (and context suggests debit), put in 'debit'.
   - If followed by "Cr", brackets "(100)", or sign is negative, put in 'credit'.

### 2. STRICT CATEGORIZATION (HEADER DRIVEN)
You MUST determine the category based on the **SECTION HEADER** in the document.
- Scan down the page/table.
- Identify headers like "ASSETS", "LIABILITIES", "EQUITY", "EQUITIES", "INCOME", "EXPENSE", "EXPENSES" (or variations like "Current Assets", "Non-Current Liabilities").
- **RULE**: All rows appearing *under* a header belong to that category until a new header is found.
- **Map Headers to**: "Assets", "Liabilities", "Equity", "Income", "Expenses".
- **ALWAYS OUTPUT CATEGORY** for every entry. If no headers exist, infer from account name.
- If a page shows only one section title (e.g., "Expenses"), apply that category to every row on that page.

### 3. EXCLUSION RULES (CRITICAL)
- **IGNORE** any row where the Account Name starts with "Total", "Grand Total", "Sum", "Difference", "Balance".
- **IGNORE** page numbers or footer text.
- **IGNORE** table headers like "Account", "Account Code", "Net Debit", "Net Credit", "Debit", "Credit".
- **IGNORE** headers themselves as rows (unless you can't map them).

### 4. DATA INTEGRITY
- **COPY NUMBERS EXACTLY**.
- If a value is in the "Net Credit" column, put it in the credit field.

### 5. OUTPUT FORMAT
Return a pure JSON object.
{ "entries": [{ "account": "Account Name", "debit": 100.00, "credit": 0, "category": "Assets" }] }`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            entries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        account: { type: Type.STRING },
                        debit: { type: Type.NUMBER, nullable: true },
                        credit: { type: Type.NUMBER, nullable: true },
                        category: { type: Type.STRING, nullable: true },
                    },
                    required: ["account", "category"],
                },
            },
        },
        required: ["entries"],
    };

    const fileParts: Part[] = [];
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "docuflow-ai-"));
    try {
        for (const file of files) {
            const safeName = file.originalname ? file.originalname.replace(/[^\w.\- ]/g, "_") : `upload-${Date.now()}.pdf`;
            const tmpPath = path.join(tmpDir, safeName);
            await fs.writeFile(tmpPath, file.buffer);
            const uploaded = await ai.files.upload({
                file: tmpPath,
                config: { mimeType: file.mimetype || "application/pdf" },
            });
            fileParts.push({
                fileData: {
                    fileUri: uploaded.uri,
                    mimeType: uploaded.mimeType || file.mimetype || "application/pdf",
                },
            });
        }

        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: { parts: [...fileParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    maxOutputTokens: 30000,
                    temperature: 0,
                },
            })
        );

        const data = safeJsonParse(response.text || "");
        if (!data || !Array.isArray(data.entries)) return [];

        const rawEntries: TrialBalanceEntry[] = data.entries.map((e: any) => ({
            account: e.account || "UnknownAccount",
            debit: Number(e.debit) || 0,
            credit: Number(e.credit) || 0,
            category: e.category || null,
        }));

        const mergedEntries: TrialBalanceEntry[] = [];
        for (let i = 0; i < rawEntries.length; i++) {
            const curr = rawEntries[i];
            const next = rawEntries[i + 1];
            const currHasAmount = (Number(curr.debit) || 0) > 0 || (Number(curr.credit) || 0) > 0;
            const nextHasAmount = next && ((Number(next.debit) || 0) > 0 || (Number(next.credit) || 0) > 0);
            const currName = String(curr.account || "").toLowerCase().trim();
            const isCurrHeader = ["assets", "asset", "liabilities", "liability", "equity", "equities", "income", "expense", "expenses", "in equity", "in equities", "in income", "in expense", "in expenses"].includes(currName);
            const isCurrTableHeader = ["account", "account code", "net debit", "net credit", "debit", "credit", "amount"].includes(currName);
            if (!currHasAmount && !isCurrHeader && !isCurrTableHeader && next && nextHasAmount) {
                mergedEntries.push({
                    ...next,
                    account: `${String(curr.account || "").trim()} ${String(next.account || "").trim()}`.trim(),
                    category: next.category || curr.category || null,
                });
                i += 1;
                continue;
            }
            mergedEntries.push(curr);
        }

        return normalizeOpeningBalanceEntries(mergedEntries);
    } finally {
        await fs.rm(tmpDir, { recursive: true, force: true });
    }
};

const normalizeOpeningBalanceEntries = (allEntries: TrialBalanceEntry[]): TrialBalanceEntry[] => {
    const normalizeOpeningBalanceCategory = (value?: string | null) => {
        if (!value) return null;
        const aiCat = value.toLowerCase().trim();
        if (aiCat === "assets" || aiCat.includes("asset")) return "Assets";
        if (aiCat === "liabilities" || aiCat.includes("liab") || aiCat.includes("payable")) return "Liabilities";
        if (aiCat === "equity" || aiCat.includes("equity") || aiCat.includes("capital")) return "Equity";
        if (aiCat === "income" || aiCat.includes("income") || aiCat.includes("revenue") || aiCat.includes("sales")) return "Income";
        if (aiCat === "expense" || aiCat === "expenses" || aiCat.includes("expense") || aiCat.includes("cost")) return "Expenses";
        return null;
    };

    const inferCategoryFromAccount = (account: string) => {
        const name = account.toLowerCase();
        if (name.includes("equity") || name.includes("capital") || name.includes("retained earnings") || name.includes("drawing") || name.includes("dividend") || name.includes("reserve") || name.includes("share")) {
            return "Equity";
        }
        if (name.includes("payable") || name.includes("loan") || name.includes("liability") || name.includes("due to") || name.includes("advance from") || name.includes("accrual") || name.includes("provision") || name.includes("vat output") || name.includes("tax payable") || name.includes("overdraft")) {
            return "Liabilities";
        }
        if (name.includes("expense") || name.includes("cost") || name.includes("salary") || name.includes("wages") || name.includes("rent") || name.includes("advertising") || name.includes("audit") || name.includes("bank charge") || name.includes("consulting") || name.includes("utilities") || name.includes("electricity") || name.includes("water") || name.includes("insurance") || name.includes("repair") || name.includes("maintenance") || name.includes("stationery") || name.includes("printing") || name.includes("postage") || name.includes("travel") || name.includes("ticket") || name.includes("accommodation") || name.includes("meal") || name.includes("entertainment") || name.includes("depreciation") || name.includes("amortization") || name.includes("bad debt") || name.includes("charity") || name.includes("donation") || name.includes("fine") || name.includes("penalty") || name.includes("freight") || name.includes("shipping") || name.includes("software") || name.includes("subscription") || name.includes("license") || name.includes("purchase") || name.includes("fees") || name.includes("fee") || name.includes("charges") || name.includes("round off") || name.includes("rta") || name.includes("salik") || name.includes("visa") || name.includes("vehicle rent") || name.includes("medical") || name.includes("cleaning") || name.includes("supplies") || name.includes("vat paid") || name.includes("sponsorship") || name.includes("t-shirt") || name.includes("t shirts") || name.includes("service charge") || name.includes("parking")) {
            return "Expenses";
        }
        if (name.includes("revenue") || name.includes("income") || name.includes("sale") || name.includes("turnover") || name.includes("commission") || name.includes("fee")) {
            return "Income";
        }
        return "Assets";
    };

    const headerCategoryMap: Record<string, string> = {
        assets: "Assets",
        asset: "Assets",
        liabilities: "Liabilities",
        liability: "Liabilities",
        equity: "Equity",
        equities: "Equity",
        "in equity": "Equity",
        "in equities": "Equity",
        income: "Income",
        "in income": "Income",
        expense: "Expenses",
        expenses: "Expenses",
        "in expense": "Expenses",
        "in expenses": "Expenses",
    };

    const isHeaderRow = (account: string) => {
        const key = account.toLowerCase().trim().replace(/\s+/g, " ");
        return Boolean(headerCategoryMap[key]);
    };

    let currentCategory: string | null = null;
    const headerPresent = allEntries.some((entry) => {
        const accountName = String(entry.account || "").toLowerCase().trim().replace(/\s+/g, " ");
        return Boolean(headerCategoryMap[accountName]);
    });
    const normalizedEntries: TrialBalanceEntry[] = [];

    allEntries.forEach((entry) => {
        const accountName = String(entry.account || "").trim();
        if (!accountName) return;

        if (isHeaderRow(accountName)) {
            currentCategory = headerCategoryMap[accountName.toLowerCase().trim().replace(/\s+/g, " ")];
            return;
        }

        const normalizedCategory = normalizeOpeningBalanceCategory(entry.category);
        const inferredCategory = inferCategoryFromAccount(accountName);
        const finalCategory = headerPresent
            ? (inferredCategory !== "Assets" && inferredCategory !== currentCategory ? inferredCategory : (currentCategory || inferredCategory))
            : (normalizedCategory || currentCategory || inferredCategory);

        normalizedEntries.push({
            ...entry,
            account: accountName,
            category: finalCategory,
        });
    });

    const shouldSkipEntry = (entry: TrialBalanceEntry) => {
        const name = String(entry.account || "").toLowerCase().trim();
        if (!name) return true;
        if ((Number(entry.debit) || 0) === 0 && (Number(entry.credit) || 0) === 0) return true;
        if (["account", "account code", "net debit", "net credit", "debit", "credit", "amount"].includes(name)) return true;
        if (name.includes("amount is displayed")) return true;
        if (name.startsWith("total") || name.startsWith("sub total") || name.startsWith("subtotal")) return true;
        if (name.includes("grand total") || name.includes("trial balance total")) return true;
        if (name.includes("total for trial balance")) return true;
        if (name.includes("total debit") || name.includes("total credit") || name.includes("total amount")) return true;
        if (name.includes("balance") || name.includes("difference") || name.includes("variance")) return true;
        if (name.includes("carried forward") || name.includes("brought forward")) return true;
        return false;
    };

    const uniqueEntries: TrialBalanceEntry[] = [];
    const seen = new Set<string>();
    normalizedEntries.forEach((entry) => {
        if (shouldSkipEntry(entry)) return;
        const key = `${entry.category || ""}|${entry.account}|${entry.debit || 0}|${entry.credit || 0}`;
        if (seen.has(key)) return;
        seen.add(key);
        uniqueEntries.push(entry);
    });

    return uniqueEntries;
};

/**
 * Trial balance extraction (merged)
 */
export const extractTrialBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
    const prompt = `EXHAUSTIVE TRIAL BALANCE EXTRACTION TASK:
Analyze the provided document and extract EVERY account row with its Debit and Credit amounts.

### CONTEXT:
Trial Balances often have various layouts. Look for columns labeled: "Account", "Description", "Debit", "Credit", "Amount", "Balance", "Net", "Closing".
Sometimes there are no headers. Infer columns based on the data: usually Text Column = Account, Number Column 1 = Debit, Number Column 2 = Credit (or vice versa).

### EXTRACTION RULES:
1) **Extract ALL Accounts**: Extract every single line item that looks like a ledger account.
2) **Ignore Totals/Summaries**: Do NOT extract rows like "Total", "Sub Total", "Grand Total", "Total Debit", "Total Credit", "Total Amount", "Trial Balance Total", "Balance", "Net Total".
3) **Multi-Column/Page**: Capture ALL rows from every section and every page.
4) **No Headers? No Problem**: If headers are missing, assume the largest text column is the Account Name.
5) **Precision**: Ensure numbers are extracted as-is.
6) **Strict Zero**: If a value is missing, empty, or unreadable, set it to 0.

### STANDARD ACCOUNT MAPPING:
Try to match extracted accounts to these standard labels if they represent the same concept:
[Sales Revenue, Sales to related Parties, Direct Cost (COGS), Purchases from Related Parties, Salaries & Wages, Staff Benefits, Depreciation, Amortization – Intangibles, Office Supplies & Stationery, Repairs & Maintenance, Insurance Expense, Marketing & Advertising, Professional Fees, Legal Fees, IT & Software Subscriptions, Fuel Expenses, Transportation & Logistics, Bank Charges, VAT Expense (non-recoverable), Corporate Tax Expense, Government Fees & Licenses, Bad Debt Expense, Miscellaneous Expense, Dividends received, Other non-operating Revenue, Other Operating Income, Interest Income, Interest from Related Parties, Interest Expense, Interest to Related Parties, Cash on Hand, Bank Accounts, Accounts Receivable, Due from related Parties, Prepaid Expenses, Deposits, VAT Recoverable (Input VAT), Inventory – Goods, Work-in-Progress – Services, Property, Plant & Equipment, Furniture & Equipment, Vehicles, Accounts Payable, Due to Related Parties, Accrued Expenses, Advances from Customers, Short-Term Loans, VAT Payable (Output VAT), Corporate Tax Payable, Long-Term Liabilities, Long-Term Loans, Loans from Related Parties, Employee End-of-Service Benefits Provision, Share Capital / Owner’s Equity]

### VALIDATION:
Check your own extraction: The sum of all Debits should ideally equal the sum of all Credits if the document is a complete Trial Balance.

Return JSON: { "entries": [{ "account": "...", "debit": number, "credit": number }] }`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            entries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        account: { type: Type.STRING },
                        debit: { type: Type.NUMBER, nullable: true },
                        credit: { type: Type.NUMBER, nullable: true },
                    },
                    required: ["account"],
                },
            },
        },
        required: ["entries"],
    };

    try {
        console.log(`[Gemini Service] Starting Trial Balance extraction with ${imageParts.length} parts...`);
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...imageParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    maxOutputTokens: 8192,
                    temperature: 0,
                },
            })
        );
        console.log(`[Gemini Service] TB extraction raw response:`, response.text?.substring(0, 500) + "...");

        const data = safeJsonParse(response.text || "");
        if (!data || !Array.isArray(data.entries)) return [];

        const shouldSkipTrialBalanceRow = (accountName: string) => {
            const name = accountName.toLowerCase().trim();
            if (!name) return true;
            if (name.startsWith("total")) return true;
            if (name.startsWith("sub total") || name.startsWith("subtotal")) return true;
            if (name.includes("grand total")) return true;
            if (name.includes("trial balance total")) return true;
            if (name.includes("total debit") || name.includes("total credit") || name.includes("total amount")) return true;
            if (name === "balance" || name.includes("closing balance") || name.includes("opening balance")) return true;
            if (name.includes("net total") || name.includes("net balance")) return true;
            return false;
        };

        return data.entries
            .filter((e: any) => !shouldSkipTrialBalanceRow(String(e.account || "")))
            .map((e: any) => ({
                account: e.account || "UnknownAccount",
                debit: Number(e.debit) || 0,
                credit: Number(e.credit) || 0,
            }));
    } catch (error) {
        console.error("Error extracting trial balance data:", error);
        return [];
    }
};

/**
 * Audit report detailed extraction (old file kept)
 */
const auditReportSchema = {
    type: Type.OBJECT,
    properties: {
        generalInformation: {
            type: Type.OBJECT,
            properties: {
                companyName: { type: Type.STRING },
                trn: { type: Type.STRING },
                incorporationDate: { type: Type.STRING },
                legalStatus: { type: Type.STRING },
                principalActivities: { type: Type.STRING },
                registeredOffice: { type: Type.STRING },
                management: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
        },
        auditorsReport: {
            type: Type.OBJECT,
            properties: {
                auditorName: { type: Type.STRING },
                opinionType: { type: Type.STRING },
                basisForOpinion: { type: Type.STRING },
                reportDate: { type: Type.STRING },
            },
        },
        managersReport: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                directorsHighlights: { type: Type.STRING },
            },
        },
        statementOfFinancialPosition: {
            type: Type.OBJECT,
            properties: {
                assets: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            items: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        description: { type: Type.STRING },
                                        amount: { type: Type.NUMBER, nullable: true },
                                        type: { type: Type.STRING, enum: ["header", "row", "total"], nullable: true }
                                    },
                                },
                            },
                        },
                    },
                },
                liabilities: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            items: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        description: { type: Type.STRING },
                                        amount: { type: Type.NUMBER, nullable: true },
                                        type: { type: Type.STRING, enum: ["header", "row", "total"], nullable: true }
                                    },
                                },
                            },
                        },
                    },
                },
                equity: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            amount: { type: Type.NUMBER, nullable: true },
                            type: { type: Type.STRING, enum: ["header", "row", "total"], nullable: true }
                        }
                    },
                },
                totalAssets: { type: Type.NUMBER },
                totalLiabilities: { type: Type.NUMBER },
                totalEquity: { type: Type.NUMBER },
                ppe: { type: Type.NUMBER },
                intangibleAssets: { type: Type.NUMBER },
                shareCapital: { type: Type.NUMBER },
                retainedEarnings: { type: Type.NUMBER },
            },
        },
        statementOfComprehensiveIncome: {
            type: Type.OBJECT,
            properties: {
                revenue: { type: Type.NUMBER },
                costOfSales: { type: Type.NUMBER },
                grossProfit: { type: Type.NUMBER },
                otherIncome: { type: Type.NUMBER },
                administrativeExpenses: { type: Type.NUMBER },
                salaries: { type: Type.NUMBER, description: "Salaries, wages and related charges" },
                depreciation: { type: Type.NUMBER, description: "Depreciation and amortisation" },
                fines: { type: Type.NUMBER, description: "Fines and penalties" },
                donations: { type: Type.NUMBER, description: "Donations" },
                entertainment: { type: Type.NUMBER, description: "Client entertainment expenses" },
                operatingProfit: { type: Type.NUMBER },
                financeCosts: { type: Type.NUMBER },
                interestIncome: { type: Type.NUMBER },
                dividendsReceived: { type: Type.NUMBER },
                gainAssetDisposal: { type: Type.NUMBER },
                lossAssetDisposal: { type: Type.NUMBER },
                forexGain: { type: Type.NUMBER },
                forexLoss: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                otherComprehensiveIncome: { type: Type.NUMBER },
                totalComprehensiveIncome: { type: Type.NUMBER },
                // Detailed items for structure preservation
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            amount: { type: Type.NUMBER, nullable: true },
                            type: { type: Type.STRING, enum: ["header", "row", "total"], nullable: true }
                        }
                    },
                },
            },
        },
        statementOfChangesInEquity: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING },
                rows: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            particulars: { type: Type.STRING },
                            shareCapital: { type: Type.NUMBER },
                            retainedEarnings: { type: Type.NUMBER },
                            total: { type: Type.NUMBER },
                        },
                    },
                },
            },
        },
        statementOfCashFlows: {
            type: Type.OBJECT,
            properties: {
                operatingActivities: { type: Type.NUMBER },
                investingActivities: { type: Type.NUMBER },
                financingActivities: { type: Type.NUMBER },
                netIncreaseInCash: { type: Type.NUMBER },
                cashAtStart: { type: Type.NUMBER },
                cashAtEnd: { type: Type.NUMBER },
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING, enum: ["Operating", "Investing", "Financing", "Other"] },
                            description: { type: Type.STRING },
                            amount: { type: Type.NUMBER, nullable: true },
                            type: { type: Type.STRING, enum: ["header", "row", "total"], nullable: true }
                        },
                    },
                },
            },
        },
        otherInformation: {
            type: Type.OBJECT,
            properties: {
                avgEmployees: { type: Type.NUMBER },
                ebitda: { type: Type.NUMBER },
            },
        },
    },
};

export const extractAuditReportDetails = async (imageParts: Part[]): Promise<Record<string, any>> => {
    const prompt = `EXHAUSTIVE AUDIT REPORT EXTRACTION TASK:
Analyze the provided Audit Report and extract information for the following 7 sections into the schema:
1) General Information
2) Auditor's Report
3) Manager's Report
4) Statement of Financial Position
5) Statement of Comprehensive Income
6) Statement of Changes in Equity
7) Statement of Cash Flows

STRICT REQUIREMENTS:
- **Exact Structure**: Preserve the document's structure. Capture every line item, heading, and subheading in the 'items' arrays.
- **Ordering**: Maintain the original order of items as they appear in the document statements.
- **Type Tagging**: Tag each item as 'header', 'row', or 'total'.
- **Specific Fields**: Also populate the specific named fields (e.g., 'revenue', 'totalAssets') for summary purposes.
- **Completeness**: ensuring NO sections or line items are omitted.
- Negative numbers in brackets => negative floats.
- Dates => DD/MM/YYYY.
- If missing, return empty arrays / null values.
Return ONLY valid JSON matching schema.`;

    try {
        console.log("[Gemini Service] Starting Audit Report extraction...");
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...imageParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: auditReportSchema,
                    maxOutputTokens: 30000,
                    temperature: 0,
                },
            })
        );
        console.log("[Gemini Service] Audit Report extraction completed.");

        return safeJsonParse(response.text || "{}") || {};
    } catch (error) {
        console.error("Error extracting audit report details:", error);
        return {};
    }
};

/**
 * AI Sales Features
 */

// Schema for Lead Scoring
const leadScoreSchema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER, description: "Lead score from 0 to 100" },
        rationale: { type: Type.STRING, description: "Explanation of why this score was assigned" },
        nextAction: { type: Type.STRING, description: "Recommended next step to move the lead forward" },
        qualityParams: {
            type: Type.OBJECT,
            properties: {
                budget: { type: Type.STRING, enum: ["Low", "Medium", "High", "Unknown"] },
                authority: { type: Type.STRING, enum: ["Decision Maker", "Influencer", "Gatekeeper", "Unknown"] },
                need: { type: Type.STRING, enum: ["Urgent", "Future", "Unclear"] },
                timeline: { type: Type.STRING, enum: ["Immediate", "Short-term", "Long-term", "Unclear"] },
            }
        }
    },
    required: ["score", "rationale", "nextAction"]
};

export const generateLeadScore = async (leadData: any): Promise<any> => {
    const prompt = `Analyze this sales lead and assign a score (0-100) based on quality and conversion probability.
    
    LEAD DATA:
    ${JSON.stringify(leadData, null, 2)}
    
    CRITERIA:
    - High Score (80-100): Clear budget, decision-maker, urgent need.
    - Medium Score (50-79): Interest but missing some BANT (Budget, Authority, Need, Timeline) criteria.
    - Low Score (0-49): Incomplete info, no clear intent, or poor fit.
    
    Return JSON matching the schema found in the system prompt.`;

    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: leadScoreSchema,
                },
            })
        );
        return safeJsonParse(response.text || "{}");
    } catch (error) {
        console.error("Lead scoring error:", error);
        return { score: 0, rationale: "AI Analysis Failed", nextAction: "Review manually" };
    }
};



export const generateSalesEmail = async (context: {
    recipientName: string;
    companyName: string;
    dealStage?: string;
    goal: string;
    tone: string;
    keyPoints?: string[];
}): Promise<string> => {
    const prompt = `Write a professional sales email.
    
    CONTEXT:
    - Recipient: ${context.recipientName} (${context.companyName})
    - Goal: ${context.goal}
    - Tone: ${context.tone}
    ${context.dealStage ? `- Deal Stage: ${context.dealStage}` : ''}
    ${context.keyPoints ? `- Key Points to Mention: ${context.keyPoints.join(", ")}` : ''}
    
    Only return the email body text. Do not include subject lines or placeholders unless necessary.`;

    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: { temperature: 0 },
            })
        );
        return response.text || "";
    } catch (error) {
        console.error("Email generation error:", error);
        return "Error generating email. Please try again.";
    }
};

/**
 * AI Deal Analysis
 */
export const analyzeDealProbability = async (deal: Deal): Promise<{
    winProbability: number;
    health: 'High' | 'Medium' | 'Low';
    keyRisks: string[];
    recommendedActions: string[];
}> => {
    const prompt = `Analyze this sales deal and predict the win probability.

    DEAL DATA:
    - Company: ${deal.companyName}
    - Amount: ${deal.serviceAmount} AED
    - Stage: ${deal.serviceClosed}
    - Payment Status: ${deal.paymentStatus}
    - Lead Source: ${deal.leadSource}
    - Remarks: ${deal.custom_data?.remarks || 'None'}
    
    CRITICAL: Analyze the "health" of this deal based on typical sales indicators.
    - Missing contact info = Risk.
    - "Pending" payment status = Risk if stage is supposed to be closed.
    - High amount = Needs more scrutiny.

    Return JSON:
    {
        "winProbability": number (0-100),
        "health": "High" | "Medium" | "Low",
        "keyRisks": ["risk1", "risk2"],
        "recommendedActions": ["action1", "action2"]
    }`;

    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json", temperature: 0 }
            })
        );
        return safeJsonParse(response.text || "") || { winProbability: 50, health: 'Medium', keyRisks: [], recommendedActions: [] };
    } catch (error) {
        console.error("Deal analysis error:", error);
        return { winProbability: 0, health: 'Low', keyRisks: ["Analysis Failed"], recommendedActions: [] };
    }
};

/**
 * Smart Note Parsing
 */
export const parseSmartNotes = async (notes: string): Promise<Partial<Deal>> => {
    const prompt = `Extract structured deal data from these raw notes.

    NOTES:
    "${notes}"

    Return JSON with any of these fields found:
    {
        "companyName": string,
        "serviceAmount": number,
        "serviceClosed": string,
        "closingDate": string (YYYY-MM-DD),
        "email": string,
        "contactNo": string,
        "remarks": string
    }`;

    // ... existing code ...
    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json", temperature: 0 }
            })
        );
        return safeJsonParse(response.text || "") || {};
    } catch (error) {
        console.error("Smart note parsing error:", error);
        return {};
    }
};

export const parseLeadSmartNotes = async (notes: string): Promise<Partial<any>> => {
    const prompt = `Extract structured lead data from these raw notes.
    
    NOTES:
    "${notes}"
    
    Return JSON with any of these fields found:
    {
        "companyName": string,
        "mobileNumber": string,
        "email": string,
        "leadSource": string,
        "status": string,
        "leadQualification": string,
        "remarks": string
    }`;

    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: { responseMimeType: "application/json" }
            })
        );
        return safeJsonParse(response.text || "") || {};
    } catch (error) {
        console.error("Lead smart note parsing error:", error);
        return {};
    }
};

// Schema for Deal Scoring
const dealScoreSchema = {
    type: Type.OBJECT,
    properties: {
        score: { type: Type.NUMBER, description: "Deal score from 0 to 100" },
        rationale: { type: Type.STRING, description: "Explanation of why this score was assigned" },
        nextAction: { type: Type.STRING, description: "Recommended next step to move the deal forward" }
    },
    required: ["score", "rationale", "nextAction"]
};

export const generateDealScore = async (dealData: any): Promise<any> => {
    const prompt = `Analyze this sales deal and assign a score (0-100) based on win probability and health.
    
    DEAL DATA:
    ${JSON.stringify(dealData, null, 2)}
    
    CRITERIA:
    - High Score (80-100): Clear budget, decision-maker, urgent need, closing soon.
    - Medium Score (50-79): Good potential but some risks or missing info.
    - Low Score (0-49): High risk, missing critical info, or stalled.
    
    Return JSON matching the schema:
    {
        "score": number, // 0-100
        "rationale": "string",
        "nextAction": "string"
    }`;

    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: dealScoreSchema,
                    temperature: 0,
                },
            })
        );
        return safeJsonParse(response.text || "{}");
    } catch (error) {
        console.error("Deal scoring error:", error);
        return { score: 0, rationale: "AI Analysis Failed", nextAction: "Review manually" };
    }
};
