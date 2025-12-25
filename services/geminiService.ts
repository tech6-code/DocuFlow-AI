import { GoogleGenAI, Type, Part } from "@google/genai";
import type { Transaction, Invoice, BankStatementSummary, AnalysisResult, TrialBalanceEntry, FinancialStatements } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Exchange Rate API Configuration
const EXCHANGE_RATE_API_KEY = '83c63cdc03a8b532bb2476c8';

// Constants for Entity Mapping
const ENTITY_TYPES = [
    'Legal Person - Incorporated (LLC)',
    'Legal Person - Foreign Business',
    'Legal Person - Club/ Association/ Society',
    'Legal Person - Charity',
    'Legal Person - Federal Government Entity',
    'Legal Person - Emirate Government Entity',
    'Legal Person - Other',
    'Partnership'
];

const ENTITY_SUB_TYPES = [
    'UAE Private Company (Incl. an Establishment)',
    'Public Joint Stock Company',
    'Foundation',
    'Trust'
];

export const LICENSE_AUTHORITIES = [
    'Abu Dhabi Department of Economic Development (ADDED)',
    'Dubai Department of Economy and Tourism (DET)',
    'Sharjah Department of Economic Development (SEDD)',
    'Ajman Department of Economic Development (Ajman DED)',
    'Umm Al Quwain Department of Economic Development (UAQ DED)',
    'Ras Al Khaimah Department of Economic Development (RAK DED)',
    'Fujairah Department of Economic Development (Fujairah DED)',
    'Abu Dhabi Global Market (ADGM)',
    'Khalifa Industrial Zone Abu Dhabi (KIZAD)',
    'Masdar City Free Zone',
    'Twofour54 (Media Zone Authority)',
    'Jebel Ali Free Zone Authority (JAFZA)',
    'Dubai Multi Commodities Centre (DMCC)',
    'Dubai Airport Free Zone Authority (DAFZA)',
    'Dubai Silicon Oasis Authority (DSOA)',
    'Dubai International Financial Centre (DIFC)',
    'Dubai South Free Zone',
    'Sharjah Airport International Free Zone (SAIF Zone)',
    'Hamriyah Free Zone Authority (HFZA)',
    'Ajman Free Zone Authority (AFZA)',
    'Ras Al Khaimah Economic Zone (RAKEZ)',
    'RAK Free Trade Zone (FTZ)',
    'Fujairah Free Zone Authority (FFZA)',
    'Umm Al Quwain Free Trade Zone (UAQ FTZ)',
    'Meydan Free Zone'
];

// Helper to perform API calls with exponential backoff for rate limits
const callAiWithRetry = async (apiCall: () => Promise<any>, retries = 7, delay = 15000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await apiCall();
        } catch (error: any) {
            // Check for various forms of rate limit errors
            const isRateLimit =
                error?.status === 429 ||
                error?.code === 429 ||
                error?.status === 503 ||
                error?.status === 'RESOURCE_EXHAUSTED' ||
                (error?.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('503'))) ||
                (error?.error?.code === 429) ||
                (error?.error?.status === 'RESOURCE_EXHAUSTED') ||
                (typeof error === 'string' && error.includes('429'));

            if (isRateLimit) {
                if (i === retries - 1) throw error;
                // Increased exponential backoff: 15s, 30s, 60s... with jitter
                const backoffTime = (delay * Math.pow(2, i)) + (Math.random() * 2000);
                console.warn(`Rate limit hit (429/RESOURCE_EXHAUSTED). Retrying in ${Math.floor(backoffTime / 1000)}s... (Attempt ${i + 1}/${retries})`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            } else {
                throw error;
            }
        }
    }
};

// Improved Helper to fetch exchange rate with robust normalization
const fetchExchangeRate = async (from: string, to: string): Promise<number> => {
    if (!from || from === 'N/A' || from === to) return 1;

    // Normalize common currency symbols/words returned by AI
    let base = from.trim().toUpperCase().replace(/[^A-Z]/g, '');

    // Map specific symbols if cleaning removed them or if they are unique
    const symbolMap: Record<string, string> = {
        '$': 'USD', 'DOLLAR': 'USD', 'US': 'USD',
        '€': 'EUR', 'EURO': 'EUR',
        '£': 'GBP', 'POUND': 'GBP', 'STERLING': 'GBP',
        '¥': 'JPY', 'YEN': 'JPY',
        '₹': 'INR', 'RUPEE': 'INR',
        'SAR': 'SAR', 'RIYAL': 'SAR',
        'AED': 'AED', 'DIRHAM': 'AED'
    };

    // Try finding in map if exact match or if cleaned base is common word
    const cleanedKey = from.trim().toUpperCase();
    if (symbolMap[cleanedKey]) base = symbolMap[cleanedKey];
    else {
        // Look for substrings if it's messy like "AED Currency"
        for (const [key, value] of Object.entries(symbolMap)) {
            if (cleanedKey.includes(key)) {
                base = value;
                break;
            }
        }
    }

    if (!base || base.length !== 3) {
        console.warn(`Could not normalize currency from "${from}". Base determined as "${base}". Defaulting to 1.0.`);
        return 1;
    }

    if (base === to) return 1;

    try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/pair/${base}/${to}`);
        const data = await response.json();

        if (data.result === 'success' && typeof data.conversion_rate === 'number') {
            console.log(`Exchange rate fetched for ${base} -> ${to}: ${data.conversion_rate}`);
            return data.conversion_rate;
        }

        console.warn(`Exchange rate API response failed for ${base} -> ${to}. Result: ${data.result}. Falling back to 1.0.`);
        return 1;
    } catch (e) {
        console.error("Exchange rate fetch error:", e);
        return 1;
    }
};

// Helper to clean JSON text from markdown formatting
const cleanJsonText = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    // Remove markdown code blocks (start and end)
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```\s*$/, '');
    return cleaned.trim();
};

// Improved Helper to attempt repairing truncated JSON
const tryRepairJson = (jsonString: string): string => {
    let repaired = jsonString.trim();
    if (!repaired) return "{}";

    // 1. Handle unclosed string
    let quoteCount = 0;
    let escape = false;
    for (let i = 0; i < repaired.length; i++) {
        if (repaired[i] === '\\' && !escape) {
            escape = true;
            continue;
        }
        if (repaired[i] === '"' && !escape) {
            quoteCount++;
        }
        escape = false;
    }

    if (quoteCount % 2 !== 0) {
        repaired += '"';
    }

    // 2. Clean up trailing characters
    repaired = repaired.replace(/,\s*$/, '');

    // Fix truncated keywords
    if (repaired.match(/:\s*t[rue]*$/i)) repaired = repaired.replace(/t[rue]*$/i, 'true');
    else if (repaired.match(/:\s*f[alse]*$/i)) repaired = repaired.replace(/f[alse]*$/i, 'false');
    else if (repaired.match(/:\s*n[ull]*$/i)) repaired = repaired.replace(/n[ull]*$/i, 'null');

    if (repaired.match(/"\s*:\s*$/)) {
        repaired += ' null';
    }

    // 3. Balance brackets/braces
    const stack: string[] = [];
    let inString = false;
    escape = false;

    for (let i = 0; i < repaired.length; i++) {
        const c = repaired[i];
        if (c === '\\' && !escape) {
            escape = true;
            continue;
        }
        if (c === '"' && !escape) {
            inString = !inString;
        }
        escape = false;

        if (!inString) {
            if (c === '{') stack.push('}');
            if (c === '[') stack.push(']');
            if (c === '}' || c === ']') {
                if (stack.length > 0 && stack[stack.length - 1] === c) {
                    stack.pop();
                }
            }
        }
    }

    while (stack.length > 0) {
        repaired += stack.pop();
    }

    return repaired;
};

// Safe JSON parser that attempts repair on failure
const safeJsonParse = (text: string): any => {
    const cleaned = cleanJsonText(text);
    if (!cleaned) return null;

    try {
        return JSON.parse(cleaned);
    } catch (e) {
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
 * Utility to parse transaction dates for comparison.
 * Handles DD/MM/YYYY (common AI output) and YYYY-MM-DD (common system output).
 */
export const parseTransactionDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
        let day, month, year;
        if (parts[0].length === 4) { // YYYY-MM-DD
            [year, month, day] = parts.map(Number);
        } else { // DD/MM/YYYY
            [day, month, year] = parts.map(Number);
        }
        const d = new Date(year, month - 1, day);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Utility to filter transactions by a specific date range.
 */
export const filterTransactionsByDate = (transactions: Transaction[], startDate?: string, endDate?: string): Transaction[] => {
    if (!startDate && !endDate) return transactions;
    const start = startDate ? parseTransactionDate(startDate) : null;
    const end = endDate ? parseTransactionDate(endDate) : null;

    return transactions.filter(t => {
        const tDate = parseTransactionDate(t.date);
        if (!tDate) return true; // Keep if date is unknown to allow manual review
        if (start && tDate < start) return false;
        if (end && tDate > end) return false;
        return true;
    });
};

/**
 * Refined Utility to identify and remove duplicate transaction entries.
 * 1. Checks for exact matching hashes.
 * 2. Implements strict running balance logic validation.
 * 3. Detects and merges split transactions across records (common at page breaks).
 */
export const deduplicateTransactions = (transactions: Transaction[]): Transaction[] => {
    if (!transactions || transactions.length === 0) return [];

    const result: Transaction[] = [];
    const seenHashes = new Set<string>();

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];

        // Sanitize values
        const debit = Number(t.debit) || 0;
        const credit = Number(t.credit) || 0;
        const balance = Number(t.balance) || 0;
        const desc = (String(t.description || '')).trim();
        const date = (String(t.date || '')).trim();

        // 1. Strict Identity Hash Check (Duplicate Detection)
        // If balance is 0, we rely more on desc/amt/date.
        const hash = `${date}|${desc.toLowerCase()}|${debit.toFixed(2)}|${credit.toFixed(2)}|${balance.toFixed(2)}`;
        if (seenHashes.has(hash)) {
            continue;
        }

        if (result.length > 0) {
            const lastIdx = result.length - 1;
            const prev = result[lastIdx];
            const prevBal = Number(prev.balance) || 0;

            // 2. Handle Split Records (Page Breaks)
            // If current row has no valid date, it's almost certainly a multi-line continuation of the previous row's description
            const isPlaceholderDate = !date || date === '-' || date === 'N/A' || date === '..' || date === '.';
            if (isPlaceholderDate) {
                result[lastIdx] = {
                    ...prev,
                    description: `${prev.description} ${desc}`.trim(),
                    // Update amounts if they were previously zero but extracted here
                    debit: prev.debit || debit,
                    credit: prev.credit || credit,
                    // Take current balance if previous was missing
                    balance: balance || prev.balance
                };
                // Don't add a new hash for the continuation row
                continue;
            }

            // 3. Sequential Carry-Over/Header Deduplication
            // Rule: "If two consecutive line items result in the same calculated balance, treat the second entry as a duplicate."
            // This happens when the PDF repeats the balance as a header on the new page without a new transaction.
            if (debit === 0 && credit === 0 && balance !== 0 && Math.abs(balance - prevBal) < 0.01) {
                continue;
            }

            // 4. Sequential OCR Redundancy
            // Catch cases where the same row is extracted twice consecutively (end of page, start of next)
            // even if the description varies slightly due to noise.
            if (date === prev.date &&
                Math.abs(debit - prev.debit) < 0.01 &&
                Math.abs(credit - prev.credit) < 0.01 &&
                (balance === 0 || prevBal === 0 || Math.abs(balance - prevBal) < 0.01)) {
                continue;
            }
        }

        // Add sanitized transaction to result set
        result.push({
            ...t,
            date,
            debit,
            credit,
            balance,
            description: desc
        });
        seenHashes.add(hash);
    }

    return result;
};

/* Normalized CHART_OF_ACCOUNTS category names and labels for consistency across modules. */
export const CHART_OF_ACCOUNTS = {
    "Assets": {
        "Current Assets": [
            "Cash on Hand",
            "Bank Accounts",
            "Accounts Receivable",
            "Due from related Parties",
            "Advances to Suppliers",
            "Prepaid Expenses",
            "Deposits",
            "Inventory – Goods",
            "Work-in-Progress – Services",
            "VAT Recoverable (Input VAT)"
        ],
        "Non Current Assets": [
            "Furniture & Equipment",
            "Vehicles",
            "Intangibles (Software, Patents)",
            "Loans to related parties"
        ],
        "Contra Accounts": [
            "Accumulated Depreciation"
        ]
    },
    "Liabilities": {
        "Current Liabilities": [
            "Accounts Payable",
            "Due to Related Parties",
            "Accrued Expenses",
            "Advances from Customers",
            "Short-Term Loans",
            "VAT Payable (Output VAT)",
            "Corporate Tax Payable"
        ],
        "Long-Term Liabilities": [
            "Long-Term Loans",
            "Loans from Related Parties",
            "Employee End-of-Service Benefits Provision"
        ]
    },
    "Equity": [
        "Share Capital / Owner’s Equity",
        "Retained Earnings",
        "Current Year Profit/Loss",
        "Dividends / Owner’s Drawings",
        "Owner's Current Account",
        "Investments in Subsidiaries/Associates"
    ],
    "Income": {
        "Operating Income": [
            "Sales Revenue",
            "Sales to related Parties"
        ],
        "Other Income": [
            "Other Operating Income",
            "Interest Income",
            "Miscellaneous Income",
            "Interest from Related Parties"
        ]
    },
    "Expenses": {
        "Direct Costs": [
            "Direct Cost (COGS)",
            "Purchases from Related Parties"
        ],
        "Other Expense": [
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
            "Miscellaneous Expense"
        ]
    }
};

export const TRANSACTION_CATEGORIES = [
    'Cash on Hand', 'Bank Accounts', 'Accounts Receivable', 'Due from related Parties', 'Advances to Suppliers',
    'Prepaid Expenses', 'Deposits', 'Inventory – Goods', 'Work-in-Progress – Services', 'VAT Recoverable (Input VAT)',
    'Furniture & Equipment', 'Vehicles', 'Intangibles (Software, Patents)', 'Loans to related parties', 'Accumulated Depreciation',
    'Accounts Payable', 'Due to Related Parties', 'Accrued Expenses', 'Advances from Customers', 'Short-Term Loans',
    'VAT Payable (Output VAT)', 'Corporate Tax Payable', 'Long-Term Loans', 'Loans from Related Parties', 'Employee End-of-Service Benefits Provision',
    'Share Capital / Owner’s Equity', 'Retained Earnings', 'Current Year Profit/Loss', 'Dividends / Owner’s Drawings',
    "Owner's Current Account", 'Investments in Subsidiaries/Associates',
    'Sales Revenue', 'Sales to related Parties', 'Other Operating Income', 'Interest Income',
    'Miscellaneous Income', 'Interest from Related Parties',
    'Direct Cost (COGS)', 'Purchases from Related Parties',
    'Salaries & Wages', 'Staff Benefits', 'Training & Development', 'Rent Expense',
    'Utility - Electricity & Water', 'Utility - Telephone & Internet', 'Office Supplies & Stationery', 'Repairs & Maintenance',
    'Insurance Expense', 'Marketing & Advertising', 'Travel & Entertainment', 'Professional Fees', 'Legal Fees',
    'IT & Software Subscriptions', 'Fuel Expenses', 'Transportation & Logistics', 'Interest Expense', 'Interest to Related Parties',
    'Bank Charges', 'VAT Expense (non-recoverable)', 'Corporate Tax Expense', 'Government Fees & Licenses',
    'Depreciation', 'Amortization – Intangibles', 'Bad Debt Expense',
    'Miscellaneous Expense'
];

const classifyInvoice = (inv: Invoice, userCompanyName?: string, userCompanyTrn?: string): Invoice => {
    if (!userCompanyName && !userCompanyTrn) return inv;
    let isSales = false;
    const clean = (s: string) => s ? s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
    const uTrn = clean(userCompanyTrn || '');
    const vTrn = clean(inv.vendorTrn || '');
    const uName = userCompanyName ? userCompanyName.toLowerCase().trim() : '';
    const vName = inv.vendorName ? inv.vendorName.toLowerCase().trim() : '';

    if (uTrn && vTrn) {
        if (uTrn === vTrn) isSales = true;
        else if (uTrn.length > 5 && vTrn.length > 5 && (vTrn.includes(uTrn) || uTrn.includes(vTrn))) isSales = true;
    }
    if (!isSales && uName && vName && uName.length > 2) {
        const normU = uName.replace(/[^a-z0-9]/g, '');
        const normV = vName.replace(/[^a-z0-9]/g, '');
        if (normV.includes(normU) || normU.includes(normV)) isSales = true;
        else {
            const uTokens = uName.split(/\s+/).filter(t => t.length > 2);
            const vTokens = vName.split(/\s+/);
            if (uTokens.length > 0) {
                const matchCount = uTokens.reduce((count, token) => count + (vTokens.some(vt => vt.includes(token)) ? 1 : 0), 0);
                if (matchCount / uTokens.length >= 0.6) isSales = true;
            }
        }
    }
    inv.invoiceType = isSales ? 'sales' : 'purchase';
    return inv;
};

// Stage 1: Layout Discovery Schema
const statementLayoutSchema = {
    type: Type.OBJECT,
    properties: {
        columnMapping: {
            type: Type.OBJECT,
            properties: {
                dateIndex: { type: Type.NUMBER, description: "0-based index of the Date column" },
                descriptionIndex: { type: Type.NUMBER, description: "0-based index of the Description column" },
                debitIndex: { type: Type.NUMBER, description: "0-based index of the Debit/Withdrawal column" },
                creditIndex: { type: Type.NUMBER, description: "0-based index of the Credit/Deposit column" },
                balanceIndex: { type: Type.NUMBER, description: "0-based index of the Running Balance column" }
            },
            required: ['dateIndex', 'descriptionIndex', 'debitIndex', 'creditIndex', 'balanceIndex']
        },
        hasSeparateDebitCredit: { type: Type.BOOLEAN, description: "True if Debit and Credit are in separate columns" },
        currency: { type: Type.STRING, description: "Detected primary account currency (e.g., AED)" },
        bankName: { type: Type.STRING, description: "Detected bank name" },
        dateFormat: { type: Type.STRING, description: "Detected date format (e.g., DD/MM/YYYY)" }
    },
    required: ['columnMapping', 'hasSeparateDebitCredit', 'currency']
};

interface StatementLayout {
    columnMapping: {
        dateIndex: number;
        descriptionIndex: number;
        debitIndex: number;
        creditIndex: number;
        balanceIndex: number;
    };
    hasSeparateDebitCredit: boolean;
    currency: string;
    bankName?: string;
    dateFormat?: string;
}

// Phase 2 Schema: Structured Parsing from Markdown Evidence
const structuredTransactionSchema = {
    type: Type.OBJECT,
    properties: {
        transactions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    date: { type: Type.STRING, description: "Transaction date" },
                    description: { type: Type.STRING, description: "Full transaction description" },
                    debit: { type: Type.STRING, description: "Debit amount as string" },
                    credit: { type: Type.STRING, description: "Credit amount as string" },
                    balance: { type: Type.STRING, description: "Running Balance as string" },
                    confidence: { type: Type.NUMBER, description: "0-100" }
                },
                required: ['date', 'description', 'debit', 'credit', 'balance']
            }
        }
    },
    required: ['transactions']
};

// Phase 1 Schema: Extract summary + raw table text
const phase1BankStatementResponseSchema = {
    type: Type.OBJECT,
    properties: {
        summary: {
            type: Type.OBJECT,
            properties: {
                accountHolder: { type: Type.STRING, nullable: true },
                accountNumber: { type: Type.STRING, nullable: true },
                statementPeriod: { type: Type.STRING, nullable: true },
                openingBalance: { type: Type.NUMBER, nullable: true },
                closingBalance: { type: Type.NUMBER, nullable: true },
                totalWithdrawals: { type: Type.NUMBER, nullable: true },
                totalDeposits: { type: Type.NUMBER, nullable: true }
            },
            nullable: true
        },
        currency: { type: Type.STRING, nullable: true },
        rawTransactionTableText: { type: Type.STRING, description: "The full raw text content of the transaction table section", nullable: true }
    },
    // We don't require rawTransactionTableText at this phase, as sometimes there might be no transactions.
};

const getBankStatementPromptPhase1 = (layout?: StatementLayout) => {
    const layoutHint = layout
        ? `LAYOUT HINT: Date is col ${layout.columnMapping.dateIndex}, Desc is col ${layout.columnMapping.descriptionIndex}, Debit is col ${layout.columnMapping.debitIndex}, Credit is col ${layout.columnMapping.creditIndex}, Balance is col ${layout.columnMapping.balanceIndex}.`
        : "";

    return `Analyze this bank statement image.
1. SUMMARY: Extract Account Holder, Account Number, Period, Opening/Closing Balances, and Currency.
2. MARKDOWN TABLE: Extract the transaction table EXACTLY as it appears into a valid Markdown table format. 
   - Each physical row must be one Markdown row.
   - Do not skip any rows.
   - Maintain the column order exactly as seen.
   ${layoutHint}

Return a JSON object:
{
  "summary": { 
     "accountHolder": "string",
     "accountNumber": "string",
     "statementPeriod": "string",
     "openingBalance": number,
     "closingBalance": number,
     "totalWithdrawals": number,
     "totalDeposits": number
  },
  "currency": "AED",
  "markdownTable": "| Date | Description | Debit | Credit | Balance |\\n|---|---|---|---|---|\\n| ... | ... |"
}

STRICT INSTRUCTIONS:
- Extract 'openingBalance' and 'closingBalance' exactly as they appear in the document header/footer.
- Do NOT skip any transaction.
- Map Debit/Withdrawal and Credit/Deposit columns accurately. If there is only one 'Amount' column, use signs or (DR/CR) labels to split them.
`;
};

const getBankStatementPromptPhase2 = (rawTableText: string) => {
    return `Parse the following raw text, which represents a bank statement's transaction table. Extract each transaction row into a structured JSON object.

RAW TRANSACTION TABLE TEXT TO PARSE:
${rawTableText}

STRICT INSTRUCTIONS:
1. ROW-BY-ROW PARSING: Identify each distinct transaction row from the provided text.
2. COLUMN MAPPING: For each row, extract:
   - "date": Transaction date in DD/MM/YYYY format.
   - "description": The full transaction description.
   - "debit": The withdrawal/debit amount. If none, return "0.00".
   - "credit": The deposit/credit amount. If none, return "0.00".
   - "balance": The running balance after the transaction.
   - "confidence": A confidence score (0-100) for the row's extraction.
3. NUMERIC FIELDS AS STRINGS: 'debit', 'credit', and 'balance' should be extracted as strings (e.g., "123.45") as seen in the text, our system will convert them. Do NOT convert them to numbers here.
4. NO SUMMARIZATION: Only return the individual transaction rows.

Return a JSON object with a single key "transactions" which is an array of these transaction objects.`;
};

export const extractTransactionsFromImage = async (
    imageParts: Part[],
    startDate?: string,
    endDate?: string
): Promise<{ transactions: Transaction[], summary: BankStatementSummary, currency: string }> => {
    const BATCH_SIZE = 1;
    const chunkedParts = [];

    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        chunkedParts.push(imageParts.slice(i, i + BATCH_SIZE));
    }

    // STAGE 1: Discover Layout
    console.log("Stage 1: Discovering Statement Layout...");
    let layout: StatementLayout | undefined;
    try {
        const firstPage = chunkedParts[0];
        const layoutPrompt = `Analyze the table structure of this bank statement. Identify the 0-based column indices for: Date, Description, Debit/Withdrawal, Credit/Deposit, and Balance. 
        If Debit and Credit are in the same column with signs or labels, indicate that.
        Also detect the Currency and Bank Name.
        Return ONLY valid JSON matching the schema.`;

        const layoutResponse = await callAiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...firstPage, { text: layoutPrompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: statementLayoutSchema,
            },
        }));
        layout = safeJsonParse(layoutResponse.text || "");
        console.log("Detected Layout:", layout);
    } catch (e) {
        console.warn("Layout discovery failed, proceeding with generic defaults...", e);
    }

    let allMarkdownTables: string[] = [];
    let finalSummary: BankStatementSummary | null = null;
    let finalCurrency = "AED";

    console.log(`Starting Stage 2: Markdown Extraction. Total pages: ${imageParts.length}.`);

    for (let i = 0; i < chunkedParts.length; i++) {
        const batchParts = chunkedParts[i];
        let phase1Data: any = null;
        let abortBatch = false;

        console.log(`Processing page ${i + 1}/${chunkedParts.length} (Stage 2)...`);
        if (i > 0) await new Promise(r => setTimeout(r, 10000));

        const promptPhase1 = getBankStatementPromptPhase1(layout);

        try {
            const responsePhase1 = await callAiWithRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...batchParts, { text: promptPhase1 }] },
                config: {
                    responseMimeType: "application/json",
                    maxOutputTokens: 30000,
                },
            }));
            const rawTextPhase1 = responsePhase1.text || "";
            phase1Data = safeJsonParse(rawTextPhase1);

            if (phase1Data?.markdownTable) {
                allMarkdownTables.push(phase1Data.markdownTable);
            }
            if (phase1Data?.summary && (phase1Data.summary.accountNumber || phase1Data.summary.openingBalance !== undefined)) {
                if (!finalSummary) finalSummary = phase1Data.summary;
                else if (phase1Data.summary.closingBalance !== undefined) finalSummary.closingBalance = phase1Data.summary.closingBalance;
            }
            if (phase1Data?.currency && phase1Data.currency !== "N/A" && phase1Data.currency !== "Unknown") {
                finalCurrency = phase1Data.currency;
            }
        } catch (e: any) {
            console.warn(`Page ${i + 1} extraction failed...`, e);
            if (e?.message?.includes('429')) abortBatch = true;
        }

        if (phase1Data === null && !abortBatch) {
            try {
                const responsePhase1Fallback = await callAiWithRetry(() => ai.models.generateContent({
                    model: "gemini-1.5-flash",
                    contents: { parts: [...batchParts, { text: promptPhase1 }] },
                    config: { responseMimeType: "application/json", maxOutputTokens: 30000 },
                }));
                phase1Data = safeJsonParse(responsePhase1Fallback.text || "");
                if (phase1Data?.markdownTable) allMarkdownTables.push(phase1Data.markdownTable);
            } catch (e) {
                console.error(`Page ${i + 1} fallback failed:`, e);
            }
        }
    }

    let allTransactions: Transaction[] = [];

    // STAGE 3: Structured Harmonization
    if (allMarkdownTables.length > 0) {
        const combinedMarkdown = allMarkdownTables.join('\n\n---\n\n').trim();
        console.log("Stage 3: Harmonizing transactions from Markdown...");

        try {
            const harmonizationPrompt = `The following are Markdown tables extracted from bank statement pages.
            
            LAYOUT DETECTED:
            - Date Column Index: ${layout?.columnMapping.dateIndex}
            - Description Column Index: ${layout?.columnMapping.descriptionIndex}
            - Debit Column Index: ${layout?.columnMapping.debitIndex}
            - Credit Column Index: ${layout?.columnMapping.creditIndex}
            - Balance Column Index: ${layout?.columnMapping.balanceIndex}
            - Separate Debit/Credit: ${layout?.hasSeparateDebitCredit}
            
            TASK:
            1. Convert these Markdown rows into structured JSON transactions.
            2. For each row, use the column indices above to identify fields.
            3. HANDLING MULTI-LINE: If a row has a description but no date, and it follows a valid transaction row, append its description to the previous transaction.
            4. SIGNS: If Debit/Credit are in the same column, use the sign or labels (DR/CR/(-)) to determine the type.
            5. CLEANING: Remove any currency symbols (AED, $, £) from amount fields.
            
            EVIDENCE:
            ${combinedMarkdown}
            
            Return JSON matching the schema.`;

            const responsePhase2 = await callAiWithRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: harmonizationPrompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: structuredTransactionSchema,
                    maxOutputTokens: 30000,
                },
            }));
            const data = safeJsonParse(responsePhase2.text || "");
            if (data?.transactions) {
                allTransactions = data.transactions.map((t: any) => {
                    // Robust number parsing: ignore non-digit/dot characters except minus sign
                    const parseAmt = (val: any) => {
                        const s = String(val || '0').replace(/,/g, '').trim();
                        const match = s.match(/-?\d+\.?\d*/);
                        return match ? Number(match[0]) : 0;
                    };

                    return {
                        date: t.date || '',
                        description: t.description || '',
                        debit: parseAmt(t.debit),
                        credit: parseAmt(t.credit),
                        balance: parseAmt(t.balance),
                        confidence: Number(t.confidence) || 80
                    };
                });
                console.log(`Stage 3: Successfully harmonized ${allTransactions.length} transactions.`);
            }
        } catch (e) {
            console.error("Stage 3 Harmonization failed:", e);
        }
    }

    // Post-processing starts here on the collected allTransactions

    // 1. Deduplicate & Merge split records using strict balance logic
    let processedTransactions = deduplicateTransactions(allTransactions);

    // 2. Filter by date if requested (Post-processing check for 100% accuracy)
    if (startDate || endDate) {
        processedTransactions = filterTransactionsByDate(processedTransactions, startDate, endDate);
    }

    // 3. Robust Balance Reconstruction
    let calculatedOpening = Number(finalSummary?.openingBalance) || 0;
    let calculatedClosing = Number(finalSummary?.closingBalance) || 0;

    if (processedTransactions.length > 0) {
        let currentRunningBalance = calculatedOpening;

        // If summary opening balance was 0, but the first row HAS a balance, use first row's balance - direction
        const firstTx = processedTransactions[0];
        if (calculatedOpening === 0 && firstTx.balance !== 0) {
            calculatedOpening = Number((firstTx.balance - (firstTx.credit || 0) + (firstTx.debit || 0)).toFixed(2));
            currentRunningBalance = calculatedOpening;
        }

        processedTransactions = processedTransactions.map(t => {
            currentRunningBalance = Number((currentRunningBalance - (t.debit || 0) + (t.credit || 0)).toFixed(2));
            const useOurBalance = t.balance === 0 || Math.abs(t.balance - currentRunningBalance) > 0.01;
            return {
                ...t,
                balance: useOurBalance ? currentRunningBalance : t.balance
            };
        });

        calculatedClosing = currentRunningBalance;
    }

    // 4. Currency Conversion Logic
    if (finalCurrency && finalCurrency.toUpperCase() !== "AED" && finalCurrency.toUpperCase() !== "N/A" && finalCurrency.toUpperCase() !== "UNKNOWN") {
        const rate = await fetchExchangeRate(finalCurrency, "AED");
        if (rate !== 1) {
            console.log(`Converting data from ${finalCurrency} to AED at rate ${rate}...`);
            processedTransactions = processedTransactions.map(t => ({
                ...t,
                debit: Number((t.debit * rate).toFixed(2)),
                credit: Number((t.credit * rate).toFixed(2)),
                balance: Number((t.balance * rate).toFixed(2))
            }));
            calculatedOpening = Number((calculatedOpening * rate).toFixed(2));
            calculatedClosing = Number((calculatedClosing * rate).toFixed(2));
            finalCurrency = "AED";
        }
    }

    if (processedTransactions.length === 0 && !finalSummary) {
        return {
            transactions: [],
            summary: {
                accountHolder: "Unknown",
                accountNumber: "Unknown",
                statementPeriod: "Unknown",
                openingBalance: 0,
                closingBalance: 0,
                totalWithdrawals: 0,
                totalDeposits: 0
            },
            currency: "AED"
        };
    }

    const defaultSummary: BankStatementSummary = {
        accountHolder: finalSummary?.accountHolder || "N/A",
        accountNumber: finalSummary?.accountNumber || "N/A",
        statementPeriod: finalSummary?.statementPeriod || "N/A",
        openingBalance: calculatedOpening,
        closingBalance: calculatedClosing,
        totalWithdrawals: processedTransactions.reduce((s, t) => s + (t.debit || 0), 0),
        totalDeposits: processedTransactions.reduce((s, t) => s + (t.credit || 0), 0)
    };

    return {
        transactions: processedTransactions,
        summary: defaultSummary,
        currency: finalCurrency
    };
};

/* Updated LOCAL_RULES to use 'Income' instead of 'Revenues' to match CHART_OF_ACCOUNTS normalization. */
const LOCAL_RULES = [
    { keywords: ["FTA", "Federal Tax Authority", "VAT Payment", "VAT Return", "Tax Payment"], category: "Liabilities | Current Liabilities | VAT Payable (Output VAT)" },
    { keywords: ["VAT on Charges", "VAT on Fees", "Tax on Charges", "Tax on Fees"], category: "Liabilities | Current Liabilities | VAT Payable (Output VAT)" },
    { keywords: ["DEWA", "SEWA", "Dubai electricity"], category: "Expenses | Other Expense | Utility - Electricity & Water" },
    { keywords: ["ENOC", "ADNOC", "EMARAT"], category: "Expenses | Other Expense | Fuel Expenses" },
    { keywords: ["RTA", "Salik", "Emirates", "Careem"], category: "Expenses | Other Expense | Travel & Entertainment" },
    { keywords: ["Google", "Face book", "Facebook", "Godaddy", "DU", "Mobile Expenses", "MYFATOORAH"], category: "Expenses | Other Expense | IT & Software Subscriptions" },
    { keywords: ["ETISALAT", "Mobily", "Emirates technology Integrated"], category: "Expenses | Other Expense | Utility - Telephone & Internet" },
    { keywords: ["Visa expenses"], category: "Expenses | Other Expense | Government Fees & Licenses" },
    { keywords: ["TASAREEH", "Smart Dubai", "MOFA", "Dubai"], category: "Expenses | Other Expense | Legal Fees" },
    { keywords: ["The VAT Consultant"], category: "Expenses | Other Expense | Professional Fees" },
    { keywords: ["Book keeping Services"], category: "Expenses | Other Expense | Professional Fees" },
    { keywords: ["Salary", "AL ansari exchange", "SIF", "WPS", "Payroll"], category: "Expenses | Other Expense | Salaries & Wages" },
    { keywords: ["Directors Remuneration"], category: "Expenses | Other Expense | Salaries & Wages" },
    { keywords: ["Network International", "POS"], category: "Income | Operating Income | Sales Revenue" },
    { keywords: ["Charges", "fee", "Remittance", "Monthly relationship Fee", "Subscription"], category: "Expenses | Other Expense | Bank Charges" },
    { keywords: ["Cash Withdrawal", "ATM Withdrawal", "CDMW", "ATM CWD", "Cash Wdl"], category: "Uncategorized" },
];

export const extractInvoicesData = async (
    imageParts: Part[],
    knowledgeBase: Invoice[] = [],
    userCompanyName?: string,
    userCompanyTrn?: string
): Promise<{ invoices: Invoice[] }> => {
    const BATCH_SIZE = 1;
    const chunkedParts = [];
    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        chunkedParts.push(imageParts.slice(i, i + BATCH_SIZE));
    }
    let allInvoices: Invoice[] = [];
    const processBatch = async (batch: Part[], index: number) => {
        try {
            const kbContext = knowledgeBase.length > 0
                ? `Known vendors: ${JSON.stringify(knowledgeBase.map(i => ({ name: i.vendorName, idPattern: i.invoiceId.replace(/\d/g, '#') })))}.`
                : "";
            const prompt = getInvoicePrompt(userCompanyName, userCompanyTrn) + kbContext;

            if (index > 0) await new Promise(r => setTimeout(r, 12000));

            const response = await callAiWithRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...batch, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: multiInvoiceSchema,
                    maxOutputTokens: 30000,
                },
            }));
            const data = safeJsonParse(response.text || "");
            let batchInvoices: Invoice[] = [];
            if (data && Array.isArray(data.invoices)) {
                batchInvoices = data.invoices;
            } else if (data && data.invoiceId) {
                batchInvoices = [data];
            }
            return batchInvoices.map((inv: Invoice) => {
                if (!inv.totalTax && inv.lineItems?.length) {
                    inv.totalTax = inv.lineItems.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
                }
                if (!inv.totalBeforeTax && inv.lineItems?.length) {
                    inv.totalBeforeTax = inv.lineItems.reduce((sum, item) => sum + (item.subtotal || (item.quantity * item.unitPrice)), 0);
                }
                const calculatedTotal = (inv.totalBeforeTax || 0) + (inv.totalTax || 0);
                if (Math.abs(inv.totalAmount - calculatedTotal) > 1.0 && calculatedTotal > 0) {
                    if (inv.totalAmount === 0) inv.totalAmount = calculatedTotal;
                }
                if (inv.totalTax) inv.totalTax = parseFloat(inv.totalTax.toFixed(2));
                if (inv.totalBeforeTax) inv.totalBeforeTax = parseFloat(inv.totalBeforeTax.toFixed(2));
                inv.totalAmount = parseFloat(inv.totalAmount.toFixed(2));
                inv.zeroRated = inv.zeroRated ? parseFloat(inv.zeroRated.toFixed(2)) : 0;
                inv.totalBeforeTaxAED = inv.totalBeforeTaxAED ? parseFloat(inv.totalBeforeTaxAED.toFixed(2)) : (inv.currency === 'AED' ? inv.totalBeforeTax : 0);
                inv.totalTaxAED = inv.totalTaxAED ? parseFloat(inv.totalTaxAED.toFixed(2)) : (inv.currency === 'AED' ? inv.totalTax : 0);
                inv.zeroRatedAED = inv.zeroRatedAED ? parseFloat(inv.zeroRatedAED.toFixed(2)) : (inv.currency === 'AED' ? inv.zeroRated : 0);
                inv.totalAmountAED = inv.totalAmountAED ? parseFloat(inv.totalAmountAED.toFixed(2)) : (inv.currency === 'AED' ? inv.totalAmount : 0);
                return classifyInvoice(inv, userCompanyName, userCompanyTrn);
            });
        } catch (error) {
            console.error(`Error extracting invoices batch ${index + 1}:`, error);
            return [];
        }
    };

    for (let i = 0; i < chunkedParts.length; i++) {
        const results = await processBatch(chunkedParts[i], i);
        allInvoices.push(...results);
    }
    return { invoices: allInvoices };
};

const lineItemSchema = {
    type: Type.OBJECT,
    properties: {
        description: { type: Type.STRING },
        quantity: { type: Type.NUMBER },
        unitPrice: { type: Type.NUMBER },
        subtotal: { type: Type.NUMBER },
        taxRate: { type: Type.NUMBER },
        taxAmount: { type: Type.NUMBER },
        total: { type: Type.NUMBER }
    },
    required: ['description', 'quantity', 'unitPrice', 'total']
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
        invoiceType: { type: Type.STRING, enum: ['sales', 'purchase'] },
        vendorTrn: { type: Type.STRING },
        customerTrn: { type: Type.STRING },
        lineItems: { type: Type.ARRAY, items: lineItemSchema },
        confidence: { type: Type.NUMBER }
    },
    required: ['invoiceId', 'vendorName', 'totalAmount', 'invoiceDate', 'lineItems']
};

const multiInvoiceSchema = {
    type: Type.OBJECT,
    properties: {
        invoices: { type: Type.ARRAY, items: invoiceSchema }
    }
};

const getInvoicePrompt = (companyName?: string, companyTrn?: string) => {
    let contextInstruction = "";
    if (companyName || companyTrn) {
        contextInstruction = `
User Company: "${companyName || 'N/A'}"
User TRN: "${companyTrn || 'N/A'}"
Rule: If VENDOR matches User Company, it is 'sales'. Else 'purchase'.
`;
    }

    return `Extract invoice details from this document. Return JSON with "invoices" array.
${contextInstruction}
Fields: invoiceId, invoiceDate (DD/MM/YYYY), vendorName, customerName, totalBeforeTax, totalTax, totalAmount, currency.
Line Items: Extract all rows.
Convert to AED if foreign currency using a 3.67 rate for USD if applicable.
`;
};

export const extractEmiratesIdData = async (imageParts: Part[]) => {
    const prompt = `Extract Emirates ID details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    }));
    return safeJsonParse(response.text || "");
};

export const extractPassportData = async (imageParts: Part[]) => {
    const prompt = `Extract Passport details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    }));
    return safeJsonParse(response.text || "");
};

export const extractVisaData = async (imageParts: Part[]) => {
    const prompt = `Extract Visa details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    }));
    return safeJsonParse(response.text || "");
};

export const extractTradeLicenseData = async (imageParts: Part[]) => {
    const prompt = `Extract Trade License details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: { responseMimeType: "application/json" }
    }));
    return safeJsonParse(response.text || "");
};

export const extractDataFromImage = async (parts: Part[], documentType: string) => {
    switch (documentType) {
        case 'Emirates ID': return extractEmiratesIdData(parts);
        case 'Passport': return extractPassportData(parts);
        case 'Visa': return extractVisaData(parts);
        case 'Trade License': return extractTradeLicenseData(parts);
        default: return extractGenericDetailsFromDocuments(parts);
    }
};

const emiratesIdSchema = {
    type: Type.OBJECT,
    properties: {
        idNumber: { type: Type.STRING, nullable: true },
        name: { type: Type.STRING, nullable: true },
        // Fix: Wrap property names with spaces in double quotes.
        "date of birth": { type: Type.STRING, nullable: true },
        nationality: { type: Type.STRING, nullable: true },
        // Fix: Wrap property names with spaces in double quotes.
        "expiry date": { type: Type.STRING, nullable: true },
    }
};

const passportSchema = {
    type: Type.OBJECT,
    properties: {
        name: { type: Type.STRING, nullable: true },
        passportNumber: { type: Type.STRING, nullable: true },
        nationality: { type: Type.STRING, nullable: true },
        dateOfExpiry: { type: Type.STRING, nullable: true },
    }
};

const visaSchema = {
    type: Type.OBJECT,
    properties: {
        idNumber: { type: Type.STRING, nullable: true },
        name: { type: Type.STRING, nullable: true },
        fileNumber: { type: Type.STRING, nullable: true },
        expiryDate: { type: Type.STRING, nullable: true },
    }
};

const tradeLicenseSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        licenseFormationDate: { type: Type.STRING, nullable: true },
        expiryDate: { type: Type.STRING, nullable: true },
        activities: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
    }
};

export const extractProjectDocuments = async (imageParts: Part[], companyName?: string, companyTrn?: string): Promise<{
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
    const prompt = `Analyze mixed documents for Company="${companyName || "Unknown"}", TRN="${companyTrn || "Unknown"}".
    Return a single JSON object with: bankStatement, salesInvoices, purchaseInvoices, emiratesIds, passports, visas, tradeLicenses.
    `;

    try {
        const projectSchema = {
            type: Type.OBJECT,
            properties: {
                bankStatement: phase1BankStatementResponseSchema, // Use Phase 1 schema for bank statement
                salesInvoices: { type: Type.ARRAY, items: invoiceSchema },
                purchaseInvoices: { type: Type.ARRAY, items: invoiceSchema },
                emiratesIds: { type: Type.ARRAY, items: emiratesIdSchema },
                passports: { type: Type.ARRAY, items: passportSchema },
                visas: { type: Type.ARRAY, items: visaSchema },
                tradeLicenses: { type: Type.ARRAY, items: tradeLicenseSchema }
            },
            required: ['salesInvoices', 'purchaseInvoices', 'bankStatement']
        };

        const response = await callAiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: projectSchema,
                maxOutputTokens: 30000
            }
        }));

        const data = safeJsonParse(response.text || "");

        if (!data) return { transactions: [], salesInvoices: [], purchaseInvoices: [], summary: null, currency: null, emiratesIds: [], passports: [], visas: [], tradeLicenses: [] };

        let allInvoices: Invoice[] = [...(data.salesInvoices || []), ...(data.purchaseInvoices || [])];
        if (companyName || companyTrn) {
            allInvoices = allInvoices.map(inv => classifyInvoice(inv, companyName, companyTrn));
        }

        let allTransactions: Transaction[] = [];
        if (data.bankStatement?.rawTransactionTableText) {
            // Phase 2: Parse raw transaction table text into structured transactions
            const rawTableText = data.bankStatement.rawTransactionTableText;
            console.log("Phase 2: Parsing raw transaction table text for project documents:", rawTableText);
            try {
                const responsePhase2 = await callAiWithRetry(() => ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [{ text: getBankStatementPromptPhase2(rawTableText) }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: structuredTransactionSchema,
                        maxOutputTokens: 30000,
                        thinkingConfig: { thinkingBudget: 2000 }
                    },
                }));
                const phase2Data = safeJsonParse(responsePhase2.text || "");
                if (phase2Data && Array.isArray(phase2Data.transactions)) {
                    allTransactions = phase2Data.transactions.map((t: any) => ({
                        date: t.date || '',
                        description: t.description || '',
                        // Fix: Remove commas from numeric strings before converting to Number
                        debit: Number(String(t.debit).replace(/,/g, '')) || 0,
                        credit: Number(String(t.credit).replace(/,/g, '')) || 0,
                        balance: Number(String(t.balance).replace(/,/g, '')) || 0,
                        confidence: Number(t.confidence) || 0
                    }));
                }
            } catch (e) {
                console.error("Phase 2 (Project Documents) structured transaction parsing failed:", e);
            }
        }

        // Apply deduplication
        const deduplicatedTransactions = deduplicateTransactions(allTransactions);

        return {
            transactions: deduplicatedTransactions,
            salesInvoices: allInvoices.filter((i: Invoice) => i.invoiceType === 'sales'),
            purchaseInvoices: allInvoices.filter((i: Invoice) => i.invoiceType === 'purchase'),
            summary: data.bankStatement?.summary || null,
            currency: data.bankStatement?.currency || null,
            emiratesIds: data.emiratesIds || [],
            passports: data.passports || [],
            visas: data.visas || [],
            tradeLicenses: data.tradeLicenses || [],
        };

    } catch (error) {
        console.error("Project extraction error:", error);
        return { transactions: [], salesInvoices: [], purchaseInvoices: [], summary: null, currency: null, emiratesIds: [], passports: [], visas: [], tradeLicenses: [] };
    }
};

export const analyzeTransactions = async (transactions: Transaction[]): Promise<{ analysis: AnalysisResult, categorizedTransactions: Transaction[] }> => {
    const prompt = `Analyze transactions. Assign categories from: ${TRANSACTION_CATEGORIES.join(', ')}. Calculate cash flow. Identify recurring payments. Provide spending summary.
    Transactions: ${JSON.stringify(transactions.slice(0, 500))}...
    Return JSON: { "categorizedTransactions": [...], "analysis": { "spendingSummary": "...", "cashFlow": {...}, "recurringPayments": [...] } }`;

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
                        category: { type: Type.STRING }
                    }
                }
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
                            netCashFlow: { type: Type.NUMBER }
                        },
                        required: ['totalIncome', 'totalExpenses', 'netCashFlow']
                    },
                    recurringPayments: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                                amount: { type: Type.NUMBER },
                                frequency: { type: Type.STRING }
                            }
                        }
                    }
                },
                required: ['spendingSummary', 'cashFlow', 'recurringPayments']
            }
        },
        required: ['categorizedTransactions', 'analysis']
    };

    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            maxOutputTokens: 30000
        }
    }));

    const data = safeJsonParse(response.text || "");
    return {
        analysis: data?.analysis || { spendingSummary: "Analysis failed", cashFlow: { totalIncome: 0, totalExpenses: 0, netCashFlow: 0 }, recurringPayments: [] },
        categorizedTransactions: data?.categorizedTransactions || transactions
    };
};

export const categorizeTransactionsByCoA = async (transactions: Transaction[]): Promise<Transaction[]> => {
    console.log("Starting categorization with safety pause...");
    await new Promise(r => setTimeout(r, 10000));

    const updatedTransactions = transactions.map(t => {
        if (t.category && !t.category.includes("Uncategorized")) return t;
        const desc = t.description.toLowerCase();
        const isCredit = t.credit > 0 && t.credit > t.debit;

        const matchedRule = LOCAL_RULES.find(rule => {
            if (rule.category.startsWith('Expenses') || rule.category.startsWith('Assets')) {
                if (isCredit) return false;
            }
            if (rule.category.startsWith('Income') || rule.category.startsWith('Equity')) {
                if (!isCredit) return false;
            }

            return rule.keywords.some(k => {
                const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = new RegExp(`(^|[^a-z0-9])${escapedK}(?=[^a-z0-9]|$)`, 'i');
                return pattern.test(desc);
            });
        });

        if (matchedRule) {
            return { ...t, category: matchedRule.category };
        }
        return t;
    });

    const pendingCategorizationMap = new Map<string, number[]>();

    updatedTransactions.forEach((t, index) => {
        if (!t.category || t.category.includes('Uncategorized')) {
            const isCredit = t.credit > 0 && t.credit > t.debit;
            const type = isCredit ? 'Money In (Credit)' : 'Money Out (Debit)';
            const key = JSON.stringify({ description: t.description.trim(), type });

            if (!pendingCategorizationMap.has(key)) {
                pendingCategorizationMap.set(key, []);
            }
            pendingCategorizationMap.get(key)!.push(index);
        }
    });

    const uniqueKeys = Array.from(pendingCategorizationMap.keys());
    if (uniqueKeys.length === 0) return updatedTransactions;

    const BATCH_SIZE = 4;
    const coaStructure = JSON.stringify(CHART_OF_ACCOUNTS);

    for (let i = 0; i < uniqueKeys.length; i += BATCH_SIZE) {
        const batchKeys = uniqueKeys.slice(i, i + BATCH_SIZE);
        const batchItems = batchKeys.map(k => JSON.parse(k));

        const prompt = `Assign a "Category" to each transaction based on the Chart of Accounts (CoA).
        CoA: ${coaStructure}
        
        Transactions to categorize:
        ${JSON.stringify(batchItems)}
        
        Rules:
        1. CREDIT (Money In): Must be 'Income', 'Equity', or 'Liabilities'. NEVER 'Expenses' or 'Assets'.
        2. DEBIT (Money Out): Must be 'Expenses', 'Assets', or 'Liabilities'. NEVER 'Income' or 'Equity'.
        3. Specific case: For 'ATM Cash Deposit' (Money In), default to 'Income | Operating Income | Sales Revenue'.
        4. Specific case: For 'Cash Withdrawal' or 'ATM Withdrawal' (Money Out), return 'Uncategorized'.
        5. Return JSON object with key "categories" (array of strings).`;

        const schema = {
            type: Type.OBJECT,
            properties: {
                categories: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        };

        try {
            if (i > 0) await new Promise(r => setTimeout(r, 15000));

            const response = await callAiWithRetry(() => ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    maxOutputTokens: 30000
                }
            }));

            const data = safeJsonParse(response.text || "");

            if (data && Array.isArray(data.categories)) {
                batchKeys.forEach((key, batchIndex) => {
                    const assignedCategory = data.categories[batchIndex];
                    if (assignedCategory) {
                        const indicesToUpdate = pendingCategorizationMap.get(key);
                        if (indicesToUpdate) {
                            indicesToUpdate.forEach(idx => {
                                updatedTransactions[idx] = { ...updatedTransactions[idx], category: assignedCategory };
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.error(`Batch categorization error:`, e);
        }
    }

    return updatedTransactions;
};

export const suggestCategoryForTransaction = async (transaction: Transaction, invoices: Invoice[]): Promise<{ category: string, reason: string }> => {
    const prompt = `Suggest category for: "${transaction.description}".
    Categories: ${TRANSACTION_CATEGORIES.join(', ')}.
    Return JSON: { "category": "...", "reason": "..." }`;

    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: { responseMimeType: "application/json" }
    }));
    return safeJsonParse(response.text || "");
};

export const generateTrialBalance = async (transactions: Transaction[]) => {
    return { trialBalance: [] };
};

export const generateAuditReport = async (trialBalance: TrialBalanceEntry[], companyName: string) => {
    const prompt = `Generate IFRS audit report for ${companyName} from trial balance: ${JSON.stringify(trialBalance)}.
    Return JSON: { statementOfComprehensiveIncome, statementOfFinancialPosition, statementOfCashFlows, notesToFinancialStatements, independentAuditorReport }.
    CRITICAL: All values must be text/string format, not nested objects.`;

    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 30000
        }
    }));
    return { report: safeJsonParse(response.text || "") };
};

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
                    ownerType: { type: Type.STRING, nullable: true }
                }
            },
            nullable: true
        }
    }
};

const customerDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        entityType: {
            type: Type.STRING,
            nullable: true,
            enum: ENTITY_TYPES
        },
        entitySubType: {
            type: Type.STRING,
            nullable: true,
            enum: ENTITY_SUB_TYPES
        },
        incorporationDate: { type: Type.STRING, nullable: true },
        tradeLicenseAuthority: { type: Type.STRING, nullable: true },
        tradeLicenseNumber: { type: Type.STRING, nullable: true },
        tradeLicenseIssueDate: { type: Type.STRING, nullable: true },
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
                    ownerType: { type: Type.STRING, nullable: true }
                }
            },
            nullable: true
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
    }
};

const vatCertSchema = {
    type: Type.OBJECT,
    properties: {
        companyName: { type: Type.STRING, nullable: true },
        trn: { type: Type.STRING, nullable: true },
        vatRegisteredDate: { type: Type.STRING, nullable: true },
        firstVatReturnPeriod: { type: Type.STRING, nullable: true },
        vatReturnDueDate: { type: Type.STRING, nullable: true },
    }
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
    }
};

export const extractLegalEntityDetails = async (imageParts: Part[]) => {
    const prompt = `Extract legal entity details (shareCapital, shareholders). Return JSON. If values are missing, return null.`;
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: legalEntitySchema,
            maxOutputTokens: 30000
        }
    }));
    return safeJsonParse(response.text || "");
};

export const extractGenericDetailsFromDocuments = async (imageParts: Part[]): Promise<Record<string, any>> => {
    const prompt = `Analyze document(s) and extract key information into a flat JSON object. Format dates as DD/MM/YYYY.`;

    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192
        }
    }));
    return safeJsonParse(response.text || "{}");
};

export const extractBusinessEntityDetails = async (imageParts: Part[]) => {
    const prompt = `Extract business entity details from documents. Return JSON.`;

    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: customerDetailsSchema,
            maxOutputTokens: 30000
        }
    }));
    return safeJsonParse(response.text || "");
};

export const extractTradeLicenseDetailsForCustomer = async (imageParts: Part[]) => {
    const prompt = `Extract Trade License details for customer profile. Return JSON.`;

    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: customerDetailsSchema,
            maxOutputTokens: 30000
        }
    }));
    return safeJsonParse(response.text || "");
};

export const extractMoaDetails = async (imageParts: Part[]) => {
    const prompt = `Extract MoA details. Return JSON.`;
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: customerDetailsSchema,
            maxOutputTokens: 30000
        }
    }));
    return safeJsonParse(response.text || "");
};

export const extractVatCertificateData = async (imageParts: Part[]) => {
    const prompt = "Extract VAT Certificate details.";
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: vatCertSchema,
            maxOutputTokens: 30000
        }
    }));
    return safeJsonParse(response.text || "");
};

export const extractCorporateTaxCertificateData = async (imageParts: Part[]) => {
    const prompt = "Extract Corporate Tax Certificate details.";
    const response = await callAiWithRetry(() => ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [...imageParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: ctCertSchema,
            maxOutputTokens: 30000
        }
    }));
    return safeJsonParse(response.text || "");
};

/**
 * High-precision extraction of Trial Balance data from documents.
 */
export const extractTrialBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
    const prompt = `EXHAUSTIVE TABLE EXTRACTION TASK:
Analyze this Trial Balance document and extract every account row with its Debit and Credit amounts.

STRICT INSTRUCTIONS:
1. Extract individual ledger account rows only. 
2. Exclude total rows or summary headers if they repeat.
3. For each account, carefully map its name, and its debit or credit balance.
4. If a value is missing or zero, return 0.
5. Return the result in a JSON object containing an array of entries.`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            entries: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        account: { type: Type.STRING, description: "Account name or description" },
                        debit: { type: Type.NUMBER, nullable: true, description: "Debit balance" },
                        credit: { type: Type.NUMBER, nullable: true, description: "Credit balance" }
                    },
                    required: ['account']
                }
            }
        },
        required: ['entries']
    };

    try {
        const response = await callAiWithRetry(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                maxOutputTokens: 30000,
            }
        }));

        const data = safeJsonParse(response.text || "");
        if (!data || !Array.isArray(data.entries)) return [];

        return data.entries.map((e: any) => ({
            account: e.account || 'Unknown Account',
            debit: Number(e.debit) || 0,
            credit: Number(e.credit) || 0
        }));
    } catch (error) {
        console.error("Error extracting trial balance data:", error);
        return [];
    }
};