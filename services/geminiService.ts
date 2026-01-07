// geminiService.ts
import { GoogleGenAI, Type, Part } from "@google/genai";
import type {
    Transaction,
    Invoice,
    BankStatementSummary,
    AnalysisResult,
    TrialBalanceEntry,
    FinancialStatements,
} from "../types";

/**
 * ENV
 */
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

        const hash = `${date}|${desc.toLowerCase()}|${debit.toFixed(2)}|${credit.toFixed(
            2
        )}|${balance.toFixed(2)}`;

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
const statementLayoutSchema = {
    type: Type.OBJECT,
    properties: {
        columnMapping: {
            type: Type.OBJECT,
            properties: {
                dateIndex: { type: Type.NUMBER, description: "0-based index of Date column" },
                descriptionIndex: { type: Type.NUMBER, description: "0-based index of Description column" },
                debitIndex: { type: Type.NUMBER, description: "0-based index of Debit/Withdrawal column" },
                creditIndex: { type: Type.NUMBER, description: "0-based index of Credit/Deposit column" },
                balanceIndex: { type: Type.NUMBER, description: "0-based index of Running Balance column" },
            },
            required: ["dateIndex", "descriptionIndex", "debitIndex", "creditIndex", "balanceIndex"],
        },
        hasSeparateDebitCredit: { type: Type.BOOLEAN, description: "True if debit/credit are separate columns" },
        currency: { type: Type.STRING, description: "Detected currency (e.g., AED)" },
        bankName: { type: Type.STRING, description: "Detected bank name" },
        dateFormat: { type: Type.STRING, description: "Detected date format (e.g., DD/MM/YYYY)" },
    },
    required: ["columnMapping", "hasSeparateDebitCredit", "currency"],
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

/**
 * Transaction parsing schema (merged)
 */
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
                    debit: { type: Type.STRING, description: "Debit amount (string)" },
                    credit: { type: Type.STRING, description: "Credit amount (string)" },
                    balance: { type: Type.STRING, description: "Running balance (string)" },
                    confidence: { type: Type.NUMBER, description: "0-100", nullable: true },
                },
                required: ["date", "description", "debit", "credit", "balance"],
            },
        },
    },
    required: ["transactions"],
};

/**
 * Phase1 schema (merged):
 * - includes summary
 * - includes currency
 * - includes rawTransactionTableText (new flow)
 * - includes markdownTable (old flow)
 */
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
                totalDeposits: { type: Type.NUMBER, nullable: true },
            },
            nullable: true,
        },
        currency: { type: Type.STRING, nullable: true },
        rawTransactionTableText: { type: Type.STRING, nullable: true },
        markdownTable: { type: Type.STRING, nullable: true },
    },
};

/**
 * Phase1 prompt (merged) - tries to return both rawTransactionTableText + markdownTable when possible
 */
const getBankStatementPromptPhase1 = (layout?: StatementLayout, startDate?: string, endDate?: string) => {
    const layoutHint = layout
        ? `LAYOUTHINT: Date col=${layout.columnMapping.dateIndex}, Desc col=${layout.columnMapping.descriptionIndex}, Debit col=${layout.columnMapping.debitIndex}, Credit col=${layout.columnMapping.creditIndex}, Balance col=${layout.columnMapping.balanceIndex}.`
        : "";

    const dateRestriction = startDate && endDate ? `\nCRITICAL: Focus on period ${startDate} to ${endDate}.` : "";

    return `Analyze this bank statement image.

1) SUMMARY:
Extract AccountHolder, AccountNumber, Period, Opening/Closing Balances, TotalWithdrawals, TotalDeposits, and Currency.

2) RAW TRANSACTION TABLE TEXT:
Extract the complete unparsed text from the transaction table area (include all visible rows/columns).

3) MARKDOWN TABLE (if possible):
Extract the transaction table EXACTLY as it appears into a valid Markdown table:
- Each physical row must be one Markdown row.
- Do not skip rows.
- Maintain the column order exactly as seen.

${layoutHint}${dateRestriction}

Return ONLY valid JSON:
{
  "summary": {
    "accountHolder": "string|null",
    "accountNumber": "string|null",
    "statementPeriod": "string|null",
    "openingBalance": number|null,
    "closingBalance": number|null,
    "totalWithdrawals": number|null,
    "totalDeposits": number|null
  },
  "currency": "AED|null",
  "rawTransactionTableText": "string|null",
  "markdownTable": "string|null"
}

STRICT:
- Do NOT hallucinate. If unknown, return null.
- Map Debit/Withdrawal (Money Out) and Credit/Deposit (Money In) accurately.
- CRITICAL: "Debit" (or Withdrawal/Payment/Out) means MONEY LEAVING the account. "Credit" (or Deposit/Receipt/In) means MONEY ENTERING the account.
- Double check column headers carefully. Look for words like "Paid Out", "Withdrawals", "Debits" vs "Paid In", "Deposits", "Credits".
- If only one Amount column exists, preserve signs/labels (+/- or DR/CR) in the raw text and markdown.`;
};

/**
 * Phase2 prompt - parse rawTransactionTableText -> structured rows
 */
/**
 * Phase2 prompt - parse rawTransactionTableText -> structured rows
 */
const getBankStatementPromptPhase2 = (rawTableText: string, layout?: StatementLayout) => {
    const layoutHint = layout
        ? `LAYOUT HINT (from image analysis):
- Debit/Withdrawal is likely column index ${layout.columnMapping.debitIndex}
- Credit/Deposit is likely column index ${layout.columnMapping.creditIndex}
- Balance is likely column index ${layout.columnMapping.balanceIndex}
Use this hint to resolve ambiguity if headers are missing.`
        : "No layout hint available. Relly on headers and semantic logic.";

    return `Parse the following raw text (bank statement transaction table) into structured JSON transactions.

RAW_TRANSACTION_TABLE_TEXT_TO_PARSE:
${rawTableText}

${layoutHint}

STRICT:
1) Row-by-row parsing (no summarization).
2) Extract:
   - date (DD/MM/YYYY)
   - description
   - debit (string "0.00" if none)
   - credit (string "0.00" if none)
   - balance (string)
   - confidence (0-100)
3) Keep numeric fields as STRINGS (system will convert).
4) CRITICAL: "Debit" = MONEY OUT (Withdrawal/Payment), "Credit" = MONEY IN (Deposit/Receipt). DO NOT INTERCHANGE THEM.
5) IDENTIFICATION LOGIC:
   - "Payment", "Purchase", "Withdrawal", "Charge", "Debit", "Dr", "Out", "Fees", "Transfer to" -> Move value to DEBIT column.
   - "Deposit", "Received", "Inward", "Credit", "Cr", "Salary", "Interest earned", "Transfer from" -> Move value to CREDIT column.
6) If a transaction amount is negative in a single column, treat its absolute value as a "Debit" (Money Out).
7) Return ONLY:
{ "transactions": [ ... ] }`;
};

/**
 * Old Stage3 harmonization (markdown evidence -> structured rows)
 */
const getBankStatementHarmonizationPrompt = (combinedMarkdown: string, layout?: StatementLayout) => {
    return `The following are Markdown tables extracted from bank statement pages.

LAYOUT DETECTED:
- DateColumnIndex: ${layout?.columnMapping.dateIndex ?? "unknown"}
- DescriptionColumnIndex: ${layout?.columnMapping.descriptionIndex ?? "unknown"}
- DebitColumnIndex: ${layout?.columnMapping.debitIndex ?? "unknown"}
- CreditColumnIndex: ${layout?.columnMapping.creditIndex ?? "unknown"}
- BalanceColumnIndex: ${layout?.columnMapping.balanceIndex ?? "unknown"}
- SeparateDebit/Credit: ${layout?.hasSeparateDebitCredit ?? "unknown"}

TASK:
1) Convert Markdown rows into structured JSON transactions.
2) Use column indices above to identify fields.
3) MULTI-LINE: If a row has description but no date and it follows a valid transaction row, append description to previous transaction.
4) SIGNS: If debit/credit are in same column, use sign or labels (DR/CR/(-)) to determine type.
5) CRITICAL: Ensure Debit column contains Withdrawals/Payments (Money Out) and Credit column contains Deposits/Receipts (Money In). DO NOT SWAP THEM.
6) CLEANING: remove currency symbols (AED, $, £, SAR) from amount fields.

EVIDENCE:
${combinedMarkdown}

Return JSON matching the schema.`;
};

/**
 * Extract Transactions from bank statement images (MERGED):
 * - Layout discovery (old)
 * - Phase1 collects both raw text + markdown tables (old/new)
 * - Phase2 parses combined raw text (new)
 * - Stage3 fallback harmonizes markdown (old)
 * - Post-process: dedupe, date filter, balance rebuild, FX conversion
 */
export const extractTransactionsFromImage = async (
    imageParts: Part[],
    startDate?: string,
    endDate?: string
): Promise<{ transactions: Transaction[]; summary: BankStatementSummary; currency: string }> => {
    console.log(`[Gemini Service] extractTransactionsFromImage started. Image parts: ${imageParts.length}, Period: ${startDate} to ${endDate}`);
    const BATCH_SIZE = 1;
    const chunkedParts: Part[][] = [];
    for (let i = 0; i < imageParts.length; i += BATCH_SIZE) {
        chunkedParts.push(imageParts.slice(i, i + BATCH_SIZE));
    }

    // Stage1: layout discovery
    let layout: StatementLayout | undefined;
    try {
        const firstPage = chunkedParts[0];
        const layoutPrompt = `Analyze the table structure of this bank statement image. 
Identify the 0-based column indices for: Date, Description, Debit/Withdrawal, Credit/Deposit, Balance.

CRITICAL INSTRUCTIONS FOR DEBIT VS CREDIT:
- "Debit" / "Withdrawal" / "Money Out" / "Payment" / "Charge" / "Dr" -> means MONEY LEAVING the account.
- "Credit" / "Deposit" / "Money In" / "Receipt" / "Collection" / "Cr" -> means MONEY ENTERING the account.

Many bank statements list Debit before Credit, but some (like specific UAE banks) might swap them or use labels.
Examine the header text and row entries carefully to distinguish Money In from Money Out.

Return ONLY valid JSON matching the schema.`;

        const layoutResponse = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: { parts: [...firstPage, { text: layoutPrompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: statementLayoutSchema,
                },
            })
        );

        layout = safeJsonParse(layoutResponse.text || "") as StatementLayout;
    } catch (e) {
        console.warn("Layout discovery failed, proceeding without layout hints...", e);
    }

    // Phase1: collect raw text + markdown tables
    let allRawTransactionTableTexts: string[] = [];
    let allMarkdownTables: string[] = [];
    let finalSummary: BankStatementSummary | null = null;
    let finalCurrency = "AED";

    for (let i = 0; i < chunkedParts.length; i++) {
        const batchParts = chunkedParts[i];
        let phase1Data: any = null;
        let abortBatch = false;

        if (i > 0) await new Promise((r) => setTimeout(r, 12000));

        const promptPhase1 = getBankStatementPromptPhase1(layout, startDate, endDate);

        try {
            const responsePhase1 = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [...batchParts, { text: promptPhase1 }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: phase1BankStatementResponseSchema,
                        maxOutputTokens: 30000,
                        thinkingConfig: { thinkingBudget: 4000 },
                    },
                })
            );

            phase1Data = safeJsonParse(responsePhase1.text || "");
            if (phase1Data?.rawTransactionTableText) allRawTransactionTableTexts.push(phase1Data.rawTransactionTableText);
            if (phase1Data?.markdownTable) allMarkdownTables.push(phase1Data.markdownTable);

            if (phase1Data?.summary && (phase1Data.summary.accountNumber || phase1Data.summary.openingBalance !== undefined)) {
                if (!finalSummary) finalSummary = phase1Data.summary;
                else if (phase1Data.summary.closingBalance !== undefined)
                    finalSummary.closingBalance = phase1Data.summary.closingBalance;
            }

            if (phase1Data?.currency && phase1Data.currency !== "N/A" && phase1Data.currency !== "Unknown") {
                finalCurrency = phase1Data.currency;
            }
            console.log(`[Gemini Service] Page ${i + 1} Phase 1 extraction successful. Raw text length: ${phase1Data?.rawTransactionTableText?.length || 0}`);
        } catch (e: any) {
            console.warn(`Page ${i + 1} Phase1 extraction failed, fallback...`, e);
            if (e?.message?.includes("429") || e?.message?.includes("quota") || e?.status === 429) {
                abortBatch = true;
                await new Promise((resolve) => setTimeout(resolve, 45000));
            }
        }

        // Fallback Phase1
        if (phase1Data === null && !abortBatch) {
            try {
                const responsePhase1Fallback = await callAiWithRetry(() =>
                    ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: { parts: [...batchParts, { text: promptPhase1 + "\n\nCRITICAL: Return ONLY valid JSON." }] },
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: phase1BankStatementResponseSchema,
                            maxOutputTokens: 30000,
                        },
                    })
                );

                phase1Data = safeJsonParse(responsePhase1Fallback.text || "");
                if (phase1Data?.rawTransactionTableText) allRawTransactionTableTexts.push(phase1Data.rawTransactionTableText);
                if (phase1Data?.markdownTable) allMarkdownTables.push(phase1Data.markdownTable);

                if (phase1Data?.summary && (phase1Data.summary.accountNumber || phase1Data.summary.openingBalance !== undefined)) {
                    if (!finalSummary) finalSummary = phase1Data.summary;
                    else if (phase1Data.summary.closingBalance !== undefined)
                        finalSummary.closingBalance = phase1Data.summary.closingBalance;
                }

                if (phase1Data?.currency && phase1Data.currency !== "N/A" && phase1Data.currency !== "Unknown") {
                    finalCurrency = phase1Data.currency;
                }
            } catch (fallbackErr) {
                console.error(`Page ${i + 1} total Phase1 fallback failed:`, fallbackErr);
            }
        }
    }

    // Phase2: parse combined raw text -> transactions (preferred)
    let allTransactions: Transaction[] = [];

    if (allRawTransactionTableTexts.length > 0) {
        const combinedRawTableText = allRawTransactionTableTexts.join("\n").trim();
        if (combinedRawTableText) {
            try {
                const responsePhase2 = await callAiWithRetry(() =>
                    ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: { parts: [{ text: getBankStatementPromptPhase2(combinedRawTableText, layout) }] },
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: structuredTransactionSchema,
                            maxOutputTokens: 30000,
                            thinkingConfig: { thinkingBudget: 2000 },
                        },
                    })
                );

                const phase2Data = safeJsonParse(responsePhase2.text || "");
                if (phase2Data && Array.isArray(phase2Data.transactions)) {
                    allTransactions = phase2Data.transactions.map((t: any) => ({
                        date: t.date || "",
                        description: t.description || "",
                        debit: Number(String(t.debit || "0").replace(/,/g, "")) || 0,
                        credit: Number(String(t.credit || "0").replace(/,/g, "")) || 0,
                        balance: Number(String(t.balance || "0").replace(/,/g, "")) || 0,
                        confidence: Number(t.confidence) || 0,
                    }));
                }
            } catch (e) {
                console.error("Phase2 structured transaction parsing failed:", e);
            }
        }
    }

    // Stage3: fallback to harmonize markdown tables if Phase2 failed/empty
    if (allTransactions.length === 0 && allMarkdownTables.length > 0) {
        const combinedMarkdown = allMarkdownTables.join("\n\n---\n\n").trim();

        try {
            const response = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: { parts: [{ text: getBankStatementHarmonizationPrompt(combinedMarkdown, layout) }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: structuredTransactionSchema,
                        maxOutputTokens: 30000,
                    },
                })
            );

            const data = safeJsonParse(response.text || "");
            if (data?.transactions) {
                const parseAmt = (val: any) => {
                    const s = String(val || "0").replace(/,/g, "").trim();
                    const match = s.match(/-?\d+\.?\d*/);
                    return match ? Number(match[0]) : 0;
                };

                allTransactions = data.transactions.map((t: any) => ({
                    date: t.date || "",
                    description: t.description || "",
                    debit: parseAmt(t.debit),
                    credit: parseAmt(t.credit),
                    balance: parseAmt(t.balance),
                    confidence: Number(t.confidence) || 80,
                }));
            }
        } catch (e) {
            console.error("Stage3 markdown harmonization failed:", e);
        }
    }

    // Post-processing
    let processedTransactions = deduplicateTransactions(allTransactions);

    if (startDate || endDate) {
        processedTransactions = filterTransactionsByDate(processedTransactions, startDate, endDate);
    }

    // Balance reconstruction
    let calculatedOpening = Number(finalSummary?.openingBalance) || 0;
    let calculatedClosing = Number(finalSummary?.closingBalance) || 0;

    if (processedTransactions.length > 0) {
        let currentRunningBalance = calculatedOpening;

        const firstTx = processedTransactions[0];
        if (calculatedOpening === 0 && firstTx.balance !== 0) {
            calculatedOpening = Number((firstTx.balance - (firstTx.credit || 0) + (firstTx.debit || 0)).toFixed(2));
            currentRunningBalance = calculatedOpening;
        }

        processedTransactions = processedTransactions.map((t) => {
            currentRunningBalance = Number((currentRunningBalance - (t.debit || 0) + (t.credit || 0)).toFixed(2));
            const useOurBalance = t.balance === 0 || Math.abs((t.balance || 0) - currentRunningBalance) > 0.01;
            return { ...t, balance: useOurBalance ? currentRunningBalance : t.balance };
        });

        calculatedClosing = currentRunningBalance;
    }

    // Currency conversion to AED if needed
    if (finalCurrency && finalCurrency.toUpperCase() !== "AED" && finalCurrency.toUpperCase() !== "N/A" && finalCurrency.toUpperCase() !== "UNKNOWN") {
        const rate = await fetchExchangeRate(finalCurrency, "AED");
        if (rate !== 1) {
            processedTransactions = processedTransactions.map((t) => ({
                ...t,
                debit: Number(((t.debit || 0) * rate).toFixed(2)),
                credit: Number(((t.credit || 0) * rate).toFixed(2)),
                balance: Number(((t.balance || 0) * rate).toFixed(2)),
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
                totalDeposits: 0,
            },
            currency: "AED",
        };
    }

    const defaultSummary: BankStatementSummary = {
        accountHolder: finalSummary?.accountHolder || "N/A",
        accountNumber: finalSummary?.accountNumber || "N/A",
        statementPeriod: finalSummary?.statementPeriod || "N/A",
        openingBalance: calculatedOpening,
        closingBalance: calculatedClosing,
        totalWithdrawals: processedTransactions.reduce((s, t) => s + (t.debit || 0), 0),
        totalDeposits: processedTransactions.reduce((s, t) => s + (t.credit || 0), 0),
    };

    console.log(`[Gemini Service] extractTransactionsFromImage completed. Total transactions: ${processedTransactions.length}, Currency: ${finalCurrency}`);
    console.log(`[Gemini Service] Final Summary:`, JSON.stringify(defaultSummary, null, 2));

    return { transactions: processedTransactions, summary: defaultSummary, currency: finalCurrency };
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
    required: ["description", "quantity", "unitPrice", "total"],
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
    required: ["invoiceId", "vendorName", "totalAmount", "invoiceDate", "lineItems"],
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
    const BATCH_SIZE = 1;
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

            if (index > 0) await new Promise((r) => setTimeout(r, 12000));

            const response = await callAiWithRetry(() =>
                ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: { parts: [...batch, { text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: multiInvoiceSchema,
                        maxOutputTokens: 30000,
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

    for (let i = 0; i < chunkedParts.length; i++) {
        const results = await processBatch(chunkedParts[i], i);
        allInvoices.push(...results);
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
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json" },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractPassportData = async (imageParts: Part[]) => {
    const prompt = `Extract Passport details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json" },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractVisaData = async (imageParts: Part[]) => {
    const prompt = `Extract Visa details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json" },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractTradeLicenseData = async (imageParts: Part[]) => {
    const prompt = `Extract Trade License details. Return JSON with "documents" array.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json" },
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
    const prompt = `Analyze mixed documents for Company="${companyName || "Unknown"}", TRN="${companyTrn || "Unknown"
        }". Return a single JSON object with: bankStatement, salesInvoices, purchaseInvoices, emiratesIds, passports, visas, tradeLicenses.`;

    try {
        const projectSchema = {
            type: Type.OBJECT,
            properties: {
                bankStatement: phase1BankStatementResponseSchema,
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
                model: "gemini-3-flash-preview",
                contents: { parts: [...imageParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: projectSchema,
                    maxOutputTokens: 30000,
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

        let allTransactions: Transaction[] = [];
        const rawTableText = data.bankStatement?.rawTransactionTableText;

        if (rawTableText) {
            try {
                const responsePhase2 = await callAiWithRetry(() =>
                    ai.models.generateContent({
                        model: "gemini-2.5-flash",
                        contents: { parts: [{ text: getBankStatementPromptPhase2(rawTableText) }] },
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: structuredTransactionSchema,
                            maxOutputTokens: 30000,
                            thinkingConfig: { thinkingBudget: 2000 },
                        },
                    })
                );

                const phase2Data = safeJsonParse(responsePhase2.text || "");
                if (phase2Data && Array.isArray(phase2Data.transactions)) {
                    allTransactions = phase2Data.transactions.map((t: any) => ({
                        date: t.date || "",
                        description: t.description || "",
                        debit: Number(String(t.debit || "0").replace(/,/g, "")) || 0,
                        credit: Number(String(t.credit || "0").replace(/,/g, "")) || 0,
                        balance: Number(String(t.balance || "0").replace(/,/g, "")) || 0,
                        confidence: Number(t.confidence) || 0,
                    }));
                }
            } catch (e) {
                console.error("Phase2(ProjectDocuments) parsing failed:", e);
            }
        }

        const deduplicatedTransactions = deduplicateTransactions(allTransactions);

        return {
            transactions: deduplicatedTransactions,
            salesInvoices: allInvoices.filter((i) => i.invoiceType === "sales"),
            purchaseInvoices: allInvoices.filter((i) => i.invoiceType === "purchase"),
            summary: data.bankStatement?.summary || null,
            currency: data.bankStatement?.currency || null,
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
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                maxOutputTokens: 30000,
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
                    model: "gemini-3-flash-preview",
                    contents: { parts: [{ text: prompt }] },
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: schema,
                        maxOutputTokens: 30000,
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
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" },
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
            model: "gemini-3-flash-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json", maxOutputTokens: 30000 },
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
            model: "gemini-3-flash-preview",
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
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: { responseMimeType: "application/json", maxOutputTokens: 8192 },
        })
    );
    return safeJsonParse(response.text || "{}") || {};
};

export const extractBusinessEntityDetails = async (imageParts: Part[]) => {
    const prompt = `Extract business entity details from documents. Return JSON.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: customerDetailsSchema,
                maxOutputTokens: 30000,
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
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: customerDetailsSchema,
                maxOutputTokens: 30000,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

export const extractMoaDetails = async (imageParts: Part[]) => {
    const prompt = `Extract MoA details. Return JSON.`;
    const response = await callAiWithRetry(() =>
        ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: customerDetailsSchema,
                maxOutputTokens: 30000,
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
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: vatCertSchema,
                maxOutputTokens: 30000,
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
            model: "gemini-3-flash-preview",
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: ctCertSchema,
                maxOutputTokens: 30000,
            },
        })
    );
    return safeJsonParse(response.text || "");
};

/**
 * Trial balance extraction (merged)
 */
export const extractTrialBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
    const prompt = `EXHAUSTIVE TABLE EXTRACTION TASK:
Analyze this Trial Balance document and extract every account row with its Debit and Credit amounts.

STRICT:
1) Extract individual ledger account rows only.
2) Exclude total rows / repeating summary headers.
3) Map account name and debit/credit balances carefully.
4) Missing/zero => 0
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
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: { parts: [...imageParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    maxOutputTokens: 30000,
                    thinkingConfig: { thinkingBudget: 4000 },
                },
            })
        );

        const data = safeJsonParse(response.text || "");
        if (!data || !Array.isArray(data.entries)) return [];

        return data.entries.map((e: any) => ({
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
                                    properties: { description: { type: Type.STRING }, amount: { type: Type.NUMBER } },
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
                                    properties: { description: { type: Type.STRING }, amount: { type: Type.NUMBER } },
                                },
                            },
                        },
                    },
                },
                equity: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, amount: { type: Type.NUMBER } } },
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
                operatingProfit: { type: Type.NUMBER },
                financeCosts: { type: Type.NUMBER },
                netProfit: { type: Type.NUMBER },
                otherComprehensiveIncome: { type: Type.NUMBER },
                totalComprehensiveIncome: { type: Type.NUMBER },
                items: {
                    type: Type.ARRAY,
                    items: { type: Type.OBJECT, properties: { description: { type: Type.STRING }, amount: { type: Type.NUMBER } } },
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
                            amount: { type: Type.NUMBER },
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

STRICT:
- Capture every line item (no skipping/aggregation).
- Negative numbers in brackets => negative floats.
- Dates => DD/MM/YYYY.
- If missing, return empty arrays / null values.
Return ONLY valid JSON matching schema.`;

    try {
        const response = await callAiWithRetry(() =>
            ai.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: { parts: [...imageParts, { text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: auditReportSchema,
                    maxOutputTokens: 30000,
                },
            })
        );

        return safeJsonParse(response.text || "{}") || {};
    } catch (error) {
        console.error("Error extracting audit report details:", error);
        return {};
    }
};
