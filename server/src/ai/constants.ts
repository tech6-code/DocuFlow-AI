import { Type } from "@google/genai";

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

// Transaction Categories and Chart of Accounts
export const TRANSACTION_CATEGORIES = [
    "Income|OperatingIncome|SalesRevenue",
    "Income|OperatingIncome|SalesToRelatedParties",
    "Income|OtherIncome|InterestIncome",
    "Income|OtherIncome|MiscellaneousIncome",
    "Expense|DirectCosts|COGS",
    "Expense|DirectCosts|PurchasesFromRelatedParties",
    "Expense|OtherExpense|SalariesAndWages",
    "Expense|OtherExpense|RentExpense",
    "Expense|OtherExpense|ProfessionalFees",
    "Uncategorized",
];

export const CHART_OF_ACCOUNTS = {
    "Income": ["Sales Revenue", "Other Income", "Interest Income"],
    "Expenses": ["Direct Cost (COGS)", "Salaries & Wages", "Rent", "Professional Fees", "Bank Charges"],
    "Assets": ["Cash on Hand", "Bank Accounts", "Accounts Receivable"],
    "Liabilities": ["Accounts Payable", "Loans"],
    "Equity": ["Share Capital", "Retained Earnings"]
};

// Local Matching Rules for Stage 1 Categorization
export const LOCAL_RULES = [
    { category: "Expense|OtherExpense|SalariesAndWages", keywords: ["salary", "wage", "payroll", "stps"] },
    { category: "Expense|OtherExpense|RentExpense", keywords: ["rent", "lease", "office rent"] },
    { category: "Expense|OtherExpense|ProfessionalFees", keywords: ["consultant", "legal", "audit", "professional"] },
    { category: "Expense|OtherExpense|Utilities", keywords: ["dewa", "etisalat", "du", "electricity", "water", "internet"] },
    { category: "Income|OperatingIncome|SalesRevenue", keywords: ["invoice", "payment from", "sales"] },
    { category: "Expense|DirectCosts|COGS", keywords: ["supplier", "purchase", "inventory"] },
];
