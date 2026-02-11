import type { Part } from "../utils/fileUtils";
import type {
  Transaction,
  Invoice,
  BankStatementSummary,
  AnalysisResult,
  TrialBalanceEntry,
  FinancialStatements,
  Deal
} from "../types";
import { apiFetch } from "./apiClient";

export const ENTITY_TYPES = [
  "Legal Person - Incorporated (LLC)",
  "Legal Person - Foreign Business",
  "Legal Person - Club/ Association/ Society",
  "Legal Person - Charity",
  "Legal Person - Federal Government Entity",
  "Legal Person - Emirate Government Entity",
  "Legal Person - Other",
  "Partnership"
];

export const ENTITY_SUB_TYPES = [
  "UAE Private Company (Incl. an Establishment)",
  "Public Joint Stock Company",
  "Foundation",
  "Trust"
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
  "Meydan Free Zone"
];

export const parseTransactionDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;

  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let day: number, month: number, year: number;
    if (parts[0].length === 4) {
      [year, month, day] = parts.map(Number);
    } else {
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
    const sourceFile = String(t.sourceFile || "").trim().toLowerCase();
    // Include source file to avoid cross-file dedupe in multi-upload scenarios.
    const hash = `${sourceFile}|${date}|${desc.toLowerCase()}|${debit.toFixed(2)}|${credit.toFixed(2)}|${balance.toFixed(2)}|${curr}${t.originalIndex !== undefined ? `|idx${t.originalIndex}` : ''}`;

    if (seenHashes.has(hash)) continue;

    if (result.length > 0) {
      const lastIdx = result.length - 1;
      const prev = result[lastIdx];
      const prevBal = Number(prev.balance) || 0;

      if (
        prev.date === t.date &&
        (prev.description || "").trim().length < 6 &&
        desc.length > (prev.description || "").trim().length &&
        prev.debit === 0 &&
        prev.credit === 0 &&
        prev.balance === 0
      ) {
        result[lastIdx] = { ...t };
        seenHashes.add(hash);
        continue;
      }

      if (
        prev.date === t.date &&
        (prev.description || "").trim().length < 6 &&
        desc.length > (prev.description || "").trim().length &&
        prev.debit === 0 &&
        prev.credit === 0 &&
        prev.balance === prevBal &&
        balance === prevBal
      ) {
        result[lastIdx] = { ...t };
        seenHashes.add(hash);
        continue;
      }
    }

    result.push(t);
    seenHashes.add(hash);
  }

  return result;
};

export const CHART_OF_ACCOUNTS = {
  Assets: {
    CurrentAssets: [
      "Cash on Hand",
      "Bank Accounts",
      "Accounts Receivable",
      "Advances to Suppliers",
      "Prepaid Expenses",
      "Inventory – Goods",
      "Work-in-Progress – Services",
      "VAT Recoverable (Input VAT)"
    ],
    NonCurrentAssets: [
      "Furniture & Equipment",
      "Vehicles",
      "Intangibles (Software, Patents)"
    ]
  },
  Liabilities: {
    CurrentLiabilities: [
      "Accounts Payable",
      "Accrued Expenses",
      "Advances from Customers",
      "Short-Term Loans",
      "VAT Payable (Output VAT)",
      "Corporate Tax Payable"
    ],
    NonCurrentLiabilities: [
      "Long-Term Loans",
      "Employee End-of-Service Benefits Provision"
    ]
  },
  Equity: [
    "Share Capital / Owner's Equity",
    "Retained Earnings",
    "Current Year Profit/Loss",
    "Dividends / Owner's Drawings",
    "Owner's Current Account"
  ],
  Income: {
    OperatingIncome: [
      "Sales Revenue – Goods",
      "Service Revenue"
    ],
    OtherIncome: [
      "Other Operating Income",
      "Interest Income",
      "Miscellaneous Income"
    ]
  },
  Expenses: {
    DirectCosts: [
      "Cost of Goods Sold (COGS)",
      "Direct Service Costs (Subcontractors, Project Costs)"
    ],
    OtherExpenses: [
      "Rent Expense",
      "Utilities (Electricity, Water, Internet)",
      "Office Supplies & Stationery",
      "Repairs & Maintenance",
      "Insurance Expense",
      "Marketing & Advertising",
      "Travel & Entertainment",
      "Professional Fees (Legal, Audit, Consulting)",
      "IT & Software Subscriptions",
      "Transportation & Logistics",
      "Bank Charges & Interest Expense",
      "Commission Expenses",
      "Salaries & Wages",
      "Staff Benefits (Medical, EOSB Contributions)",
      "Training & Development",
      "VAT Expense (non-recoverable)",
      "Corporate Tax Expense",
      "Government Fees & Licenses",
      "Depreciation – Furniture & Equipment",
      "Depreciation – Vehicles",
      "Amortization – Intangibles",
      "Bad Debt Expense",
      "Miscellaneous Expense"
    ]
  }
};

export const TRANSACTION_CATEGORIES = [
  "Cash on Hand",
  "Bank Accounts",
  "Accounts Receivable",
  "Advances to Suppliers",
  "Prepaid Expenses",
  "Inventory – Goods",
  "Work-in-Progress – Services",
  "VAT Recoverable (Input VAT)",
  "Furniture & Equipment",
  "Vehicles",
  "Intangibles (Software, Patents)",
  "Accounts Payable",
  "Accrued Expenses",
  "Advances from Customers",
  "Short-Term Loans",
  "VAT Payable (Output VAT)",
  "Corporate Tax Payable",
  "Long-Term Loans",
  "Employee End-of-Service Benefits Provision",
  "Share Capital / Owner's Equity",
  "Retained Earnings",
  "Current Year Profit/Loss",
  "Dividends / Owner's Drawings",
  "Owner's Current Account",
  "Sales Revenue – Goods",
  "Service Revenue",
  "Other Operating Income",
  "Interest Income",
  "Miscellaneous Income",
  "Cost of Goods Sold (COGS)",
  "Direct Service Costs (Subcontractors, Project Costs)",
  "Rent Expense",
  "Utilities (Electricity, Water, Internet)",
  "Office Supplies & Stationery",
  "Repairs & Maintenance",
  "Insurance Expense",
  "Marketing & Advertising",
  "Travel & Entertainment",
  "Professional Fees (Legal, Audit, Consulting)",
  "IT & Software Subscriptions",
  "Transportation & Logistics",
  "Bank Charges & Interest Expense",
  "Commission Expenses",
  "Salaries & Wages",
  "Staff Benefits (Medical, EOSB Contributions)",
  "Training & Development",
  "VAT Expense (non-recoverable)",
  "Corporate Tax Expense",
  "Government Fees & Licenses",
  "Depreciation – Furniture & Equipment",
  "Depreciation – Vehicles",
  "Amortization – Intangibles",
  "Bad Debt Expense",
  "Miscellaneous Expense"
];

const aiCall = async <T>(action: string, payload: Record<string, any>): Promise<T> => {
  const res = await apiFetch("/ai", {
    method: "POST",
    body: JSON.stringify({ action, payload })
  });
  return res.result as T;
};

export const extractTransactionsFromImage = async (
  imageParts: Part[],
  startDate?: string,
  endDate?: string
): Promise<{ transactions: Transaction[]; summary: BankStatementSummary; currency: string }> => {
  return aiCall("extractTransactionsFromImage", { imageParts, startDate, endDate });
};

export const extractTransactionsFromText = async (
  text: string,
  startDate?: string,
  endDate?: string
): Promise<{ transactions: Transaction[]; summary: BankStatementSummary; currency: string }> => {
  return aiCall("extractTransactionsFromText", { text, startDate, endDate });
};

export const extractInvoicesData = async (
  imageParts: Part[],
  knowledgeBase: Invoice[],
  companyName?: string,
  companyTrn?: string
): Promise<{ invoices: Invoice[] }> => {
  return aiCall("extractInvoicesData", { imageParts, knowledgeBase, companyName, companyTrn });
};

export const extractEmiratesIdData = async (imageParts: Part[]) => {
  return aiCall("extractEmiratesIdData", { imageParts });
};

export const extractPassportData = async (imageParts: Part[]) => {
  return aiCall("extractPassportData", { imageParts });
};

export const extractVisaData = async (imageParts: Part[]) => {
  return aiCall("extractVisaData", { imageParts });
};

export const extractTradeLicenseData = async (imageParts: Part[]) => {
  return aiCall("extractTradeLicenseData", { imageParts });
};

export const extractDataFromImage = async (parts: Part[], documentType: string) => {
  return aiCall("extractDataFromImage", { parts, documentType });
};

export const extractProjectDocuments = async (
  imageParts: Part[],
  companyName?: string,
  companyTrn?: string
) => {
  return aiCall("extractProjectDocuments", { imageParts, companyName, companyTrn });
};

export const analyzeTransactions = async (transactions: Transaction[]) => {
  return aiCall("analyzeTransactions", { transactions });
};

export const categorizeTransactionsByCoA = async (transactions: Transaction[]) => {
  return aiCall("categorizeTransactionsByCoA", { transactions });
};

export const generateTrialBalance = async (transactions: Transaction[]) => {
  return aiCall("generateTrialBalance", { transactions });
};

export const generateAuditReport = async (trialBalance: TrialBalanceEntry[], companyName: string): Promise<{ report: FinancialStatements }> => {
  return aiCall("generateAuditReport", { trialBalance, companyName });
};

export const extractLegalEntityDetails = async (imageParts: Part[]) => {
  return aiCall("extractLegalEntityDetails", { imageParts });
};




export const extractGenericDetailsFromDocuments = async (imageParts: Part[]): Promise<Record<string, any>> => {
  return aiCall("extractGenericDetailsFromDocuments", { imageParts });
};

export const extractVat201Totals = async (imageParts: Part[]) => {
  return aiCall("extractVat201Totals", { imageParts });
};

export const extractBusinessEntityDetails = async (imageParts: Part[]) => {
  return aiCall("extractBusinessEntityDetails", { imageParts });
};

export const extractTradeLicenseDetailsForCustomer = async (imageParts: Part[]) => {
  return aiCall("extractTradeLicenseDetailsForCustomer", { imageParts });
};

export const extractMoaDetails = async (imageParts: Part[]) => {
  return aiCall("extractMoaDetails", { imageParts });
};

export type VatCertificateDetails = {
  companyName?: string;
  trn?: string;
  vatRegisteredDate?: string;
  standardRatedSuppliesAmount?: number;
  standardRatedSuppliesVatAmount?: number;
  standardRatedExpensesAmount?: number;
  standardRatedExpensesVatAmount?: number;
};

export const extractVatCertificateData = async (imageParts: Part[]): Promise<VatCertificateDetails> => {
  return aiCall("extractVatCertificateData", { imageParts });
};

export const extractCorporateTaxCertificateData = async (imageParts: Part[]) => {
  return aiCall("extractCorporateTaxCertificateData", { imageParts });
};

export const extractOpeningBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
  return aiCall("extractOpeningBalanceData", { imageParts });
};

export const extractOpeningBalanceDataFromFiles = async (files: File[]): Promise<TrialBalanceEntry[]> => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const res = await apiFetch("/ai/opening-balance-files", {
    method: "POST",
    body: formData
  });
  return (res as any).result as TrialBalanceEntry[];
};

export const extractTrialBalanceData = async (imageParts: Part[]): Promise<TrialBalanceEntry[]> => {
  return aiCall("extractTrialBalanceData", { imageParts });
};

export const extractAuditReportDetails = async (imageParts: Part[]): Promise<Record<string, any>> => {
  return aiCall("extractAuditReportDetails", { imageParts });
};

export const generateLeadScore = async (leadData: any): Promise<any> => {
  return aiCall("generateLeadScore", { leadData });
};

export const generateSalesEmail = async (context: { companyName: string; painPoints: string[]; recipientName: string; services: string[]; tone: string; }) => {
  return aiCall("generateSalesEmail", { context });
};

export const analyzeDealProbability = async (deal: Deal): Promise<any> => {
  return aiCall("analyzeDealProbability", { deal });
};

export const parseSmartNotes = async (notes: string): Promise<Partial<Deal>> => {
  return aiCall("parseSmartNotes", { notes });
};

export const parseLeadSmartNotes = async (notes: string): Promise<Partial<any>> => {
  return aiCall("parseLeadSmartNotes", { notes });
};

export const generateDealScore = async (dealData: any): Promise<any> => {
  return aiCall("generateDealScore", { dealData });
};

