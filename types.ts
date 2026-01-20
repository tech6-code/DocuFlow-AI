import React from "react";

export type Page =
  | "dashboard"
  | "bankStatements"
  | "invoicesAndBills"
  | "emiratesId"
  | "passport"
  | "visa"
  | "tradeLicense"
  | "rolesAndPermissions"
  | "userManagement"
  | "departments"
  | "customers"
  | "bankStatementAnalysis"
  | "projectFinancialOverview"
  | "projectVatFiling"
  | "projectCtFiling"
  | "projectRegistration"
  | "projectAuditReport"
  | "settings"
  | "auditLogs"
  | "integrations";

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
  subtotal?: number; // Amount before tax
  taxRate?: number; // VAT/Tax Rate in %
  taxAmount?: number; // The VAT/tax amount
  total: number; // Net amount for the line (including tax)
}

export interface Invoice {
  invoiceId: string;
  vendorName: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  totalBeforeTax?: number;
  totalTax?: number;
  zeroRated?: number; // Amount subject to 0% VAT
  totalAmount: number;

  // Converted AED values
  totalBeforeTaxAED?: number;
  totalTaxAED?: number;
  zeroRatedAED?: number;
  totalAmountAED?: number;

  currency: string;
  lineItems: LineItem[];
  invoiceType: "sales" | "purchase";
  vendorTrn?: string;
  customerTrn?: string;
  confidence?: number; // Overall extraction confidence score (0-100)
  isVerified?: boolean; // User verification status
}

// A generic type for results display
export type ExtractedDataValue =
  | string
  | number
  | string[]
  | { [key: string]: string | number };

export type ExtractedDataObject = {
  documentType: string;
  documentTitle: string;
  data: { [key: string]: ExtractedDataValue };
};

// Types for Roles and Permissions
export interface Permission {
  id: string; // e.g., 'users:create'
  label: string; // e.g., 'Create Users'
  description: string;
  category: string; // e.g., 'User Management'
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  isEditable: boolean;
}

// Type for Document History
export interface DocumentHistoryItem {
  id: string;
  type: string;
  title: string;
  processedAt: string; // ISO string date
  pageCount?: number;
  processedBy: string;
  // Optional fields for bank statement data
  transactions?: Transaction[];
  summary?: BankStatementSummary;
  currency?: string;
  analysis?: AnalysisResult;
  // Optional fields for invoice data
  salesInvoices?: Invoice[];
  purchaseInvoices?: Invoice[];
  // Optional fields for other documents
  extractedData?: ExtractedDataObject[];
}

// Type for Users
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Added optional password field
  roleId: string;
  departmentId: string;
}

// Type for Contact Persons
export interface ContactPerson {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  workPhone: string;
  mobile: string;
}

// Type for Shareholders
export interface Shareholder {
  ownerType: "Individual" | "Corporate";
  name: string;
  nationality: string;
  percentage: number;
}

// Type for Customer Documents
export interface CustomerDocument {
  id: string;
  customerId: string;
  uploaderId: string;
  documentType: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
}

export interface DocumentUploadPayload {
  documentType: string;
  file: File;
}

// Type for Customers
export interface Customer {
  id: string;
  cifNumber?: string;
  type: "business" | "individual";
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  workPhone: string;
  mobile: string;
  currency: string;
  language: string;

  // Business Details
  entityType?: string;
  entitySubType?: string;
  incorporationDate?: string;
  tradeLicenseAuthority?: string;
  tradeLicenseNumber?: string;
  tradeLicenseIssueDate?: string;
  tradeLicenseExpiryDate?: string;
  businessActivity?: string;
  isFreezone?: boolean;
  freezoneName?: string;
  shareholders?: Shareholder[];
  authorisedSignatories?: string;
  shareCapital?: string;

  // Address
  billingAddress: string;
  shippingAddress: string;

  // Other Details
  remarks: string;

  // Tax & Financials
  taxTreatment: string; // VAT Registered, Non VAT Registered, etc.
  trn: string; // VAT TRN
  vatRegisteredDate?: string;
  firstVatFilingPeriod?: string;
  vatFilingDueDate?: string;
  vatReportingPeriod?: "Monthly" | "Quarterly";

  corporateTaxTreatment?: string; // Corporate Tax Registered, Not Registered
  corporateTaxTrn?: string; // Corporate Tax Registration Number
  corporateTaxRegisteredDate?: string;
  corporateTaxPeriod?: string;
  firstCorporateTaxPeriodStart?: string;
  firstCorporateTaxPeriodEnd?: string;
  corporateTaxFilingDueDate?: string;

  businessRegistrationNumber?: string; // Business License / Registration Number
  placeOfSupply: string;
  openingBalance: number;
  paymentTerms: string;

  // Meta
  ownerId?: string; // Links to a User
  portalAccess: boolean;

  // Contacts
  contactPersons?: ContactPerson[];

  // Documents
  documents?: CustomerDocument[];
  custom_data?: Record<string, any>;
}

// Type for Departments
export interface Department {
  id: string;
  name: string;
  address?: string; // Optional address field just in case
}

// Type for Companies (CT Filing)
export interface Company {
  id: string;
  name: string;
  address: string;
  trn: string;
  corporateTaxTrn?: string; // Corporate Tax Registration Number
  incorporationDate: string;
  shareCapital?: string;
  businessType: string;
  financialYear: string;
  reportingPeriod: string;
  periodStart?: string;
  periodEnd?: string;
  dueDate?: string;

  // Specific fields for Corporate Tax auto-calculation
  ctPeriodStart?: string;
  ctPeriodEnd?: string;
  ctDueDate?: string;

}

// Type for Bank Statement Summary
export interface BankStatementSummary {
  accountHolder: string;
  accountNumber: string;
  statementPeriod: string;
  openingBalance?: number;
  closingBalance?: number;
  originalOpeningBalance?: number;
  originalClosingBalance?: number;
  totalWithdrawals: number;
  totalDeposits: number;
}

// Types for Bank Statement Analysis
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

// Type for Trial Balance
export interface TrialBalanceEntry {
  account: string;
  debit: number;
  credit: number;
  baseDebit?: number;
  baseCredit?: number;
  currency?: string;
}

export interface FinancialStatements {
  statementOfComprehensiveIncome: string;
  statementOfFinancialPosition: string;
  statementOfCashFlows: string;
  notesToFinancialStatements: string;
  independentAuditorReport: string;
}

// Types for Opening Balances
export interface OpeningBalanceAccount {
  name: string;
  debit: number;
  credit: number;
  isNew?: boolean; // to handle new account rows
  subCategory?: string; // used for grouping similar to Trial Balance subheaders
}

export interface OpeningBalanceCategory {
  category: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  accounts: OpeningBalanceAccount[];
}

// New Types for Notifications and Audit Logs
export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
}

export interface AuditLog {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  status: "Success" | "Failed";
}

export interface CtType {
  id: string;
  name: string;
}

export interface CtFilingPeriod {
  id: string;
  userId: string;
  customerId: string;
  ctTypeId: string;
  periodFrom: string;
  periodTo: string;
  dueDate: string;
  status: string;
  createdAt?: string;
}

export interface WorkingNoteEntry {
  description: string;
  amount: number;
  originalAmount?: number;
  currency?: string;
}

export interface Lead {
  id: string;
  date: string;
  companyName: string;
  brand?: string;
  mobileNumber: string;
  email: string;
  leadSource: string;
  status: string;
  serviceRequired?: string;
  leadQualification?: string;
  leadOwner?: string; // User ID
  remarks?: string;
  lastContact?: string; // Date ISO
  closingCycle?: string;
  closingDate?: string; // Date ISO
  createdAt?: string;
  custom_data?: Record<string, any>;
  documents?: AttachedDocument[];
}

export interface AttachedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 string
  uploadDate: string;
}

export interface SalesSettingItem {
  id: string;
  name: string;
}

export interface SalesSettings {
  leadSources: SalesSettingItem[];
  servicesRequired: SalesSettingItem[];
  leadQualifications: SalesSettingItem[];
  brands: SalesSettingItem[];
  leadOwners: SalesSettingItem[];
  services: string[];
  serviceClosedOptions: string[];
  paymentStatusOptions: string[];
}

export interface DealFollowUp {
  id: string;
  dealId: string;
  created: string; // ISO date
  nextFollowUp: string; // ISO date
  startTime: string; // Time string
  sendReminder: boolean;
  remindBefore: number;
  remindUnit: 'Day(s)' | 'Hour(s)' | 'Minute(s)';
  remark: string;
  status: 'Pending' | 'Completed' | 'Cancelled';
}

export interface DealNote {
  id: string;
  dealId: string;
  title: string;
  detail: string; // Rich text HTML
  created: string; // ISO date
}

export interface DealDocument {
  id: string;
  dealId: string;
  uploaderId: string;
  documentType: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
}

export interface DealHistoryItem {
  id: string;
  type: 'FollowUp' | 'Note' | 'Document' | 'Deal';
  action: string; // e.g., 'created', 'updated'
  date: string;
  userId: string;
  userName: string;
  userAvatar?: string; // Optional avatar URL
  details?: string;
  metadata?: any; // For storing extra info like file name or note title
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
  documents?: AttachedDocument[]; // Legacy
  dealDocuments?: DealDocument[]; // New real documents
  followUps?: DealFollowUp[];
  notes?: DealNote[];
}
