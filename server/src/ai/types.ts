export interface Transaction {
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  confidence: number;
  currency: string;
  originalCurrency?: string;
  originalDebit?: number;
  originalCredit?: number;
  originalBalance?: number;
  category?: string;
  sourceFile?: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  total: number;
}

export interface Invoice {
  invoiceId: string;
  vendorName: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalBeforeTax?: number;
  totalTax?: number;
  zeroRated?: number;
  totalAmount: number;
  totalBeforeTaxAED?: number;
  totalTaxAED?: number;
  zeroRatedAED?: number;
  totalAmountAED?: number;
  currency: string;
  lineItems: LineItem[];
  invoiceType: "sales" | "purchase";
  vendorTrn?: string;
  customerTrn?: string;
  confidence?: number;
  isVerified?: boolean;
}

export interface BankStatementSummary {
  accountHolder: string | null;
  accountNumber: string | null;
  statementPeriod: string | null;
  openingBalance?: number | null;
  closingBalance?: number | null;
  originalOpeningBalance?: number;
  originalClosingBalance?: number;
  totalWithdrawals: number | null;
  totalDeposits: number | null;
  currency?: string | null;
}

export interface CashFlow {
  totalIncome: number;
  totalExpenses: number;
  netCashFlow: number;
}

export interface RecurringPayment {
  description: string;
  amount: number;
  frequency?: string;
}

export interface AnalysisResult {
  spendingSummary: string;
  cashFlow: CashFlow;
  recurringPayments: (string | RecurringPayment)[];
}

export interface TrialBalanceEntry {
  account: string;
  debit: number;
  credit: number;
  baseDebit?: number;
  baseCredit?: number;
  currency?: string;
  category?: string;
}

export interface FinancialStatements {
  statementOfComprehensiveIncome: string;
  statementOfFinancialPosition: string;
  statementOfCashFlows: string;
  notesToFinancialStatements: string;
  independentAuditorReport: string;
}

export interface Deal {
  id: string;
  cifNumber: string;
  date: string;
  name: string;
  companyName: string;
  brand: string;
  contactNo: string;
  email: string;
  leadSource: string;
  services: string;
  serviceClosed: string;
  serviceAmount: number;
  closingDate: string;
  paymentStatus: string;
  custom_data?: Record<string, any>;
}
