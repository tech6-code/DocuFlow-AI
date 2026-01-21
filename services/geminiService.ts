// geminiService.ts
import { supabase } from "./supabase";
import type {
    Transaction,
    Invoice,
    BankStatementSummary,
    AnalysisResult,
    TrialBalanceEntry,
    FinancialStatements,
    Deal,
} from "../types";

// Helper type for image parts since we removed GoogleGenAI import
export type Part = {
  inlineData: {
    mimeType: string;
    data: string;
  };
  text?: string;
};

// Removed exposed API Key check


/**
 * ExchangeRate API
 * (If you want, move this to process.env.EXCHANGE_RATE_API_KEY)
 */
const EXCHANGE_RATE_API_KEY = "83c63cdc03a8b532bb2476c8";

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
// Helper for edge function calls could go here, but using supabase.functions.invoke directly.
// callAiWithRetry removed.

/**
 * Exchange rate fetch with robust currency normalization
 */
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

    if (base === to.toUpperCase()) return 1;

    try {
        const response = await fetch(
            `https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/pair/${base}/${to}`
        );
        const data = await response.json();
        if (data?.result === "success" && typeof data?.conversion_rate === "number") {
            console.log(`Exchange rate fetched for ${base}->${to}: ${data.conversion_rate}`);
            return data.conversion_rate;
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

    // unclosed string
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

    // trailing comma
    repaired = repaired.replace(/,\s*$/, "");

    // truncated keywords
    if (repaired.match(/:\s*t[rue]*$/i)) repaired = repaired.replace(/t[rue]*$/i, "true");
    else if (repaired.match(/:\s*f[alse]*$/i)) repaired = repaired.replace(/f[alse]*$/i, "false");
    else if (repaired.match(/:\s*n[ull]*$/i)) repaired = repaired.replace(/n[ull]*$/i, "null");

    if (repaired.match(/"\s*:\s*$/)) repaired += "null";

    // balance braces/brackets
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
            return null;
        }
    }
};

/**
 * Date parsing + filtering
 */
export const parseTransactionDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let day: number, month: number, year: number;
        if (parts[0].length === 4) {
            // YYYY-MM-DD
            [year, month, day] = parts.map(Number);
        } else {
            // DD/MM/YYYY
            [day, month, year] = parts.map(Number);
        }
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
// Unified Bank Statement Schema and Prompt removed (moved to Edge Function)

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
    let finalSummary: BankStatementSummary = {
        accountHolder: null,
        accountNumber: null,
        statementPeriod: null,
        openingBalance: null,
        closingBalance: null,
        totalWithdrawals: null,
        totalDeposits: null,
    };
    let finalCurrency = "AED";

    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        const batchParts = imageParts.slice(i, i + BATCH_SIZE);

        try {
            // Rate limiting delay if needed
            if (i > 0) await new Promise((r) => setTimeout(r, 2000));

            const { data, error } = await supabase.functions.invoke('extract-bank-statement', {
                body: { imageParts: batchParts, startDate, endDate }
            });

            if (error) {
                 console.error(`[Gemini Service] Edge Function Error:`, error);
                 continue;
            }

            if (data?.transactions) {
                const batchTx = data.transactions.map((t: any) => ({
                    date: t.date || "",
                    description: t.description || "",
                    debit: Number(String(t.debit || "0").replace(/,/g, "")) || 0,
                    credit: Number(String(t.credit || "0").replace(/,/g, "")) || 0,
                    balance: Number(String(t.balance || "0").replace(/,/g, "")) || 0,
                    confidence: Number(t.confidence) || 0,
                    currency: t.currency || data.currency || "AED",
                }));
                allTransactions.push(...batchTx);
            }

            // Merge summary (prefer non-null values)
            if (data?.summary) {
                if (data.summary.accountHolder) finalSummary.accountHolder = data.summary.accountHolder;
                if (data.summary.accountNumber) finalSummary.accountNumber = data.summary.accountNumber;
                if (data.summary.statementPeriod) finalSummary.statementPeriod = data.summary.statementPeriod;
                // Take opening balance from first page if present
                if (finalSummary.openingBalance === null && (data.summary.openingBalance !== undefined && data.summary.openingBalance !== null)) {
                    finalSummary.openingBalance = data.summary.openingBalance;
                }
                // Take closing balance - we want the LAST non-null value found across all pages
                if (data.summary.closingBalance !== undefined && data.summary.closingBalance !== null) {
                    finalSummary.closingBalance = data.summary.closingBalance;
                }

                if (data.summary.totalWithdrawals !== undefined && data.summary.totalWithdrawals !== null) {
                    finalSummary.totalWithdrawals = (finalSummary.totalWithdrawals || 0) + data.summary.totalWithdrawals;
                }
                if (data.summary.totalDeposits !== undefined && data.summary.totalDeposits !== null) {
                    finalSummary.totalDeposits = (finalSummary.totalDeposits || 0) + data.summary.totalDeposits;
                }
            }

            if (data?.currency && data.currency !== "N/A" && data.currency !== "Unknown") {
                finalCurrency = data.currency;
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
        const tCurr = (t.currency || finalCurrency || "AED").toUpperCase();
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

    if (finalCurrency && finalCurrency.toUpperCase() !== "AED" && finalCurrency.toUpperCase() !== "N/A") {
        const rate = await fetchExchangeRate(finalCurrency, "AED");
        if (rate !== 1) {
            if (finalSummary.openingBalance !== null) finalSummary.openingBalance = Number((finalSummary.openingBalance * rate).toFixed(2));
            if (finalSummary.closingBalance !== null) finalSummary.closingBalance = Number((finalSummary.closingBalance * rate).toFixed(2));
            // Note: finalCurrency in the return object will become AED because we've converted the summary
            finalCurrency = "AED";
        }
    }

    const resultSummary: BankStatementSummary = {
        accountHolder: finalSummary.accountHolder || "N/A",
        accountNumber: finalSummary.accountNumber || "N/A",
        statementPeriod: finalSummary.statementPeriod || "N/A",
        openingBalance: finalSummary.openingBalance, // AED or original if no conversion
        closingBalance: finalSummary.closingBalance, // AED or original if no conversion
        originalOpeningBalance: originalOpeningBal,
        originalClosingBalance: originalClosingBal,
        totalWithdrawals: finalSummary.totalWithdrawals || processedTransactions.reduce((s, t) => s + (t.debit || 0), 0),
        totalDeposits: finalSummary.totalDeposits || processedTransactions.reduce((s, t) => s + (t.credit || 0), 0),
    };

    console.log(`[Gemini Service] Extraction success: ${processedTransactions.length} txns found.`);
    return { transactions: processedTransactions, summary: resultSummary, currency: finalCurrency };
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
// Invoice Schema and Prompt removed (moved to Edge Function)

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
            if (index > 0) await new Promise((r) => setTimeout(r, 1000));

            const { data, error } = await supabase.functions.invoke('extract-invoices', {
                body: { imageParts: batch, knowledgeBase, userCompanyName, userCompanyTrn }
            });

            if (error) {
                console.error(`Edge Function Error:`, error);
                return [];
            }

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
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "EmiratesID" } });
    return data;
};

export const extractPassportData = async (imageParts: Part[]) => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "Passport" } });
    return data;
};

export const extractVisaData = async (imageParts: Part[]) => {
   const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "Visa" } });
    return data;
};

export const extractTradeLicenseData = async (imageParts: Part[]) => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "TradeLicense" } });
    return data;
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
    // TODO: Migrate mixed document extraction to Edge Functions if needed.
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
};

/**
 * Analyze transactions (merged model choice)
 */
export const analyzeTransactions = async (
    transactions: Transaction[]
): Promise<{ analysis: AnalysisResult; categorizedTransactions: Transaction[] }> => {
     const { data, error } = await supabase.functions.invoke('analyze-finance', {
        body: { transactions, mode: 'analysis' }
    });

    if (error) {
        console.error("Analysis Error:", error);
         return {
            analysis: {
                spendingSummary: "Analysis failed",
                cashFlow: { totalIncome: 0, totalExpenses: 0, netCashFlow: 0 },
                recurringPayments: [],
            },
            categorizedTransactions: transactions,
        };
    }

    return {
        analysis: data.analysis || {
             spendingSummary: "Analysis failed",
             cashFlow: { totalIncome: 0, totalExpenses: 0, netCashFlow: 0 },
             recurringPayments: [],
        },
        categorizedTransactions: data.categorizedTransactions || transactions,
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

        try {
            const { data, error } = await supabase.functions.invoke('analyze-finance', {
                body: { mode: 'categorize', transactions: batchItems, coaStructure }
            });

            if (error) {
                console.error("Batch categorization Edge Function error:", error);
                continue;
            }

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
    const { data } = await supabase.functions.invoke('analyze-finance', { body: { mode: 'suggest', transaction } });
    return data || { category: "Uncategorized", reason: "No suggestion" };
};

/**
 * Trial balance + audit report generation
 */
export const generateTrialBalance = async (transactions: Transaction[]) => {
    return { trialBalance: [] };
};

export const generateAuditReport = async (trialBalance: TrialBalanceEntry[], companyName: string) => {
    const { data } = await supabase.functions.invoke('analyze-finance', { body: { mode: 'audit-report', trialBalance, companyName } });
    return { report: data };
};

/**
 * Business entity / certificates / generic extraction schemas
 */
export const extractLegalEntityDetails = async (imageParts: Part[]) => {
     const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "LegalEntity" } });
    return data;
};

export const extractGenericDetailsFromDocuments = async (imageParts: Part[]): Promise<Record<string, any>> => {
      const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "Generic" } });
    return data || {};
};

export const extractVat201Totals = async (imageParts: Part[]): Promise<{
    salesTotal: number;
    expensesTotal: number;
    periodFrom?: string;
    periodTo?: string;
}> => {
     const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "VAT201" } });
    return {
        salesTotal: data?.salesTotal || 0,
        expensesTotal: data?.expensesTotal || 0,
        periodFrom: data?.periodFrom || undefined,
        periodTo: data?.periodTo || undefined,
    };
};

export const extractBusinessEntityDetails = async (imageParts: Part[]) => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "BusinessEntity" } });
    return data;
};

export const extractTradeLicenseDetailsForCustomer = async (imageParts: Part[]) => {
     const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "TradeLicenseDetails" } });
    return data;
};

export const extractMoaDetails = async (imageParts: Part[]) => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "MoA" } });
    return data;
};

export const extractVatCertificateData = async (imageParts: Part[]) => {
     const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "VATCertificate" } });
    return data;
};

export const extractCorporateTaxCertificateData = async (imageParts: Part[]) => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "CorporateTaxCertificate" } });
    return data;
};

/**
 * Trial balance extraction (merged)
 */
export const extractTrialBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "TrialBalance" } });
    if (!data || !Array.isArray(data.entries)) return [];

    const parseVal = (v: any) => {
        if (v === null || v === undefined || v === '') return 0;
        const cleaned = String(v).replace(/,/g, '').replace(/[^-0-9.]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    };

    return data.entries.map((e: any) => ({
        account: e.account || "UnknownAccount",
        debit: parseVal(e.debit),
        credit: parseVal(e.credit),
        category: e.category || "Assets",
    }));
};

/**
 * Audit report detailed extraction (old file kept)
 */
// Note: auditReportSchema was removed as it's large and should be on the server.
export const extractAuditReportDetails = async (imageParts: Part[]): Promise<Record<string, any>> => {
    const { data } = await supabase.functions.invoke('extract-identity', { body: { imageParts, documentType: "AuditReport" } });
    return data || {};
};

/**
 * AI Sales Features
 */

export const generateLeadScore = async (leadData: any): Promise<any> => {
    const { data } = await supabase.functions.invoke('analyze-sales', { body: { mode: "lead-score", leadData } });
    return data || { score: 0, rationale: "AI Analysis Failed", nextAction: "Review manually" };
};

export const generateSalesEmail = async (context: {
    recipientName: string;
    companyName: string;
    dealStage?: string;
    goal: string;
    tone: string;
    keyPoints?: string[];
}): Promise<string> => {
    const { data } = await supabase.functions.invoke('analyze-sales', { body: { mode: "sales-email", ...context } });
    return data?.email || "Error generating email.";
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
     const { data } = await supabase.functions.invoke('analyze-sales', { body: { mode: "deal-probability", deal } });
    return data || { winProbability: 50, health: 'Medium', keyRisks: [], recommendedActions: [] };
};

/**
 * Smart Note Parsing
 */
export const parseSmartNotes = async (notes: string): Promise<Partial<Deal>> => {
    const { data } = await supabase.functions.invoke('analyze-sales', { body: { mode: "parse-notes", notes } });
    return data || {};
};

export const parseLeadSmartNotes = async (notes: string): Promise<Partial<any>> => {
     const { data } = await supabase.functions.invoke('analyze-sales', { body: { mode: "parse-lead-notes", notes } });
    return data || {};
};

export const generateDealScore = async (dealData: any): Promise<any> => {
     const { data } = await supabase.functions.invoke('analyze-sales', { body: { mode: "deal-score", dealData } });
    return data || { score: 0, rationale: "AI Analysis Failed", nextAction: "Review manually" };
};
