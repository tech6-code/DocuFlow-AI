
import {
    RefreshIcon,
    DocumentArrowDownIcon,
    CheckIcon,
    SparklesIcon,
    PlusIcon,
    ChevronLeftIcon,
    BriefcaseIcon,
    LightBulbIcon,
    MagnifyingGlassIcon,
    FunnelIcon,
    ArrowsRightLeftIcon,
    ClipboardCheckIcon,
    XMarkIcon,
    PencilIcon,
    ChevronRightIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    ArrowUpRightIcon,
    ScaleIcon,
    BanknotesIcon,
    IdentificationIcon,
    DocumentTextIcon,
    EyeIcon,
    ChartBarIcon,
    ChartPieIcon,
    TrashIcon,
    AssetIcon,
    IncomeIcon,
    ExpenseIcon,
    ChevronDownIcon,
    EquityIcon,
    ListBulletIcon,
    ExclamationTriangleIcon,
    DocumentDuplicateIcon,
    ArrowRightIcon,
    InformationCircleIcon,
    UserCircleIcon,
    ClockIcon,
    CalendarDaysIcon,
    BuildingOfficeIcon,
    ShieldCheckIcon,
    UploadIcon
} from './icons';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Transaction, Invoice, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, BankStatementSummary, Company } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { FileUploadArea } from './VatFilingUpload';
import { extractGenericDetailsFromDocuments, CHART_OF_ACCOUNTS, categorizeTransactionsByCoA, extractTrialBalanceData } from '../services/geminiService';
import type { Part } from '@google/genai';
import { InvoiceSummarizationView } from './InvoiceSummarizationView';
import { ReconciliationTable } from './ReconciliationTable';

declare const XLSX: any;

/* Fix: Added compressImage helper to handle image optimization for Gemini API inside CtType2Results. */
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            if (!event.target?.result) return reject(new Error("Could not read file."));
            img.src = event.target.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                const MAX_DIM = 1024;
                if (width > height) { if (width > MAX_DIM) { height *= MAX_DIM / width; width = MAX_DIM; } }
                else { if (height > MAX_DIM) { width *= MAX_DIM / height; height = MAX_DIM; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error("Could not get canvas context"));
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

/* Fix: Added fileToGenerativePart helper to convert files for Gemini extraction in VAT Summarization step. */
const fileToGenerativePart = async (file: File): Promise<Part> => {
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        if (context) await page.render({ canvasContext: context, viewport }).promise;
        return { inlineData: { data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1], mimeType: 'image/jpeg' } };
    }
    const data = await compressImage(file);
    return { inlineData: { data, mimeType: 'image/jpeg' } };
};

/* Helper to generate previews locally */
const generateFilePreviews = async (file: File): Promise<string[]> => {
    const urls: string[] = [];
    if (file.type === 'application/pdf') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            // @ts-ignore
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                if (context) {
                    await page.render({ canvasContext: context, viewport }).promise;
                    urls.push(canvas.toDataURL('image/jpeg', 0.8));
                }
            }
        } catch (e) {
            console.error("Error generating PDF preview:", e);
            // Fallback for failed PDF preview
            if (file.type.startsWith('image/')) {
                urls.push(URL.createObjectURL(file));
            } else {
                urls.push('file'); // Generic placeholder
            }
        }
    } else if (file.type.startsWith('image/')) {
        urls.push(URL.createObjectURL(file));
    } else {
        urls.push('file'); // Generic placeholder
    }
    return urls;
};

interface CtType2ResultsProps {
    appState: 'initial' | 'loading' | 'success' | 'error'; // Fix: Added appState to props
    transactions: Transaction[];
    salesInvoices: Invoice[];
    purchaseInvoices: Invoice[];
    trialBalance: TrialBalanceEntry[] | null;
    auditReport: FinancialStatements | null;
    isGeneratingTrialBalance: boolean;
    isGeneratingAuditReport: boolean;
    reportsError: string | null;
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onGenerateTrialBalance: (transactions: Transaction[]) => void;
    onGenerateAuditReport: (trialBalance: TrialBalanceEntry[], companyName: string) => void;
    currency: string;
    companyName: string;
    onReset: () => void;
    summary?: BankStatementSummary | null;
    previewUrls: string[]; // This is still passed but we manage internal previews now.
    company: Company | null;
    fileSummaries?: Record<string, BankStatementSummary>;
    statementFiles?: File[]; // Original statement files for previews
    invoiceFiles?: File[]; // Invoice files to be uploaded in new step
    onVatInvoiceFilesSelect: (files: File[]) => void; // Fix: Added onVatInvoiceFilesSelect to props
    pdfPassword: string; // Fix: Added pdfPassword to props
    onPasswordChange: (password: string) => void; // Fix: Added onPasswordChange to props
    onCompanyNameChange: (name: string) => void; // Fix: Added onCompanyNameChange to props
    onCompanyTrnChange: (trn: string) => void; // Fix: Added onCompanyTrnChange to props
    onProcess?: () => void; // To trigger overall processing in App.tsx
}

interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

const ResultsStatCard = ({ label, value, color = "text-white", icon }: { label: string, value: string, color?: string, icon?: React.ReactNode }) => (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-center justify-between shadow-sm">
        <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
        </div>
        {icon && <div className="text-gray-600 opacity-50">{icon}</div>}
    </div>
);

const formatNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    if (Math.abs(amount) < 0.01) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    if (typeof dateStr === 'object') {
        if (dateStr.year && dateStr.month && dateStr.day) {
            return `${String(dateStr.day).padStart(2, '0')}/${String(dateStr.month).padStart(2, '0')}/${dateStr.year}`;
        }
        return JSON.stringify(dateStr);
    }
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const getChildCategory = (category: string) => {
    if (!category) return '';
    const parts = category.split('|');
    return parts[parts.length - 1].trim();
};

const resolveCategoryPath = (category: string | undefined): string => {
    if (!category) return '';
    if (category.includes('|')) return category;
    for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
        if (Array.isArray(sub)) {
            if (sub.includes(category)) return `${main} | ${category}`;
        } else if (typeof sub === 'object') {
            for (const [subGroup, items] of Object.entries(sub)) {
                if ((items as string[]).includes(category)) {
                    return `${main} | ${subGroup} | ${category}`;
                }
            }
        }
    }
    return category;
};

// Step titles for the Stepper component
const getStepperSteps = () => [
    "Review Categories",
    "Summarization",
    "Upload Invoices", // New Step 3
    "Invoice Summarization", // New Step 4
    "Bank Reconciliation",
    "VAT/Additional Docs", // Renamed from "VAT Summarization" to better reflect the purpose here
    "Opening Balances",
    "Adjust Trial Balance",
    "Generate Final Report"
];

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = getStepperSteps();

    return (
        <div className="flex items-center w-full max-w-6xl mx-auto mb-8 overflow-x-auto pb-2">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isActive = currentStep === stepNumber;
                return (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center text-center z-10 px-2 min-w-[100px]">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-white border-white' :
                                    isActive ? 'border-white bg-gray-800' : 'border-gray-600 bg-gray-950'
                                }`}>
                                {isCompleted ? <CheckIcon className="w-6 h-6 text-black" /> : <span className={`font-bold text-lg ${isActive ? 'text-white' : 'text-gray-500'}`}>{stepNumber}</span>}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${isCompleted || isActive ? 'text-white' : 'text-gray-500'
                                }`}>{step}</p>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="flex-1 h-0.5 bg-gray-700 relative min-w-[20px]">
                                <div className={`absolute top-0 left-0 h-full bg-white transition-all duration-500`} style={{ width: isCompleted ? '100%' : '0%' }}></div>
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    );
};

export const CtType2Results: React.FC<CtType2ResultsProps> = (props) => {
    const {
        appState,
        transactions,
        salesInvoices,
        purchaseInvoices,
        trialBalance,
        auditReport,
        isGeneratingTrialBalance,
        isGeneratingAuditReport,
        reportsError,
        onUpdateTransactions,
        onGenerateTrialBalance,
        onGenerateAuditReport,
        currency,
        companyName,
        onReset,
        summary,
        company,
        fileSummaries,
        statementFiles,
        invoiceFiles,
        onVatInvoiceFilesSelect,
        pdfPassword,
        onPasswordChange,
        onCompanyNameChange,
        onCompanyTrnChange,
        onProcess
    } = props;

    const [currentStep, setCurrentStep] = useState(1);
    const [editedTransactions, setEditedTransactions] = useState<Transaction[]>([]);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(initialAccountData);
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    // Fix: Declared isAutoCategorizing state
    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [selectedFileFilter, setSelectedFileFilter] = useState<string>('ALL');
    const [summaryFileFilter, setSummaryFileFilter] = useState<string>('ALL');
    const [selectedIndices, setSelectedIndices] = useState(() => new Set<number>());
    const [findText, setFindText] = useState('');
    const [replaceCategory, setReplaceCategory] = useState('');
    const [bulkCategory, setBulkCategory] = useState('');
    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [newCategoryMain, setNewCategoryMain] = useState('');
    const [newCategorySub, setNewCategorySub] = useState('');
    const [pendingCategoryContext, setPendingCategoryContext] = useState<{ type: 'row' | 'bulk' | 'replace' | 'filter'; rowIndex?: number; } | null>(null);
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [showVatFlowModal, setShowVatFlowModal] = useState(false);
    const [vatFlowQuestion, setVatFlowQuestion] = useState<1 | 2>(1);
    const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownEntry[]>>({});
    const [reconFilter, setReconFilter] = useState<'ALL' | 'Matched' | 'Unmatched'>('ALL');
    const [statementPreviewUrls, setStatementPreviewUrls] = useState<string[]>([]);
    const [invoicePreviewUrls, setInvoicePreviewUrls] = useState<string[]>([]);

    // Global Add Account modal state
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountChild, setNewGlobalAccountChild] = useState('');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');

    // Questionnaire State
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});

    // Final Report Editable Form State
    const [reportForm, setReportForm] = useState<any>({});

    const tbFileInputRef = useRef<HTMLInputElement>(null);

    const uniqueFiles = useMemo(() => Array.from(new Set(editedTransactions.map(t => t.sourceFile).filter(Boolean))), [editedTransactions]);

    useEffect(() => {
        if (transactions && transactions.length > 0) setEditedTransactions([...transactions]);
    }, [transactions]);

    // Generate previews for statement files
    useEffect(() => {
        const generate = async () => {
            if (statementFiles && statementFiles.length > 0) {
                const urls: string[] = [];
                for (const file of statementFiles) {
                    const fileUrls = await generateFilePreviews(file);
                    urls.push(...fileUrls);
                }
                setStatementPreviewUrls(urls);
            } else {
                setStatementPreviewUrls([]);
            }
        };
        generate();
    }, [statementFiles]);

    // Generate previews for invoice files (newly added)
    useEffect(() => {
        const generate = async () => {
            if (invoiceFiles && invoiceFiles.length > 0) {
                const urls: string[] = [];
                for (const file of invoiceFiles) {
                    const fileUrls = await generateFilePreviews(file);
                    urls.push(...fileUrls);
                }
                setInvoicePreviewUrls(urls);
            } else {
                setInvoicePreviewUrls([]);
            }
        };
        generate();
    }, [invoiceFiles]);

    // Auto-advance step on successful processing from App.tsx
    useEffect(() => {
        // Fix: Use appState from props
        if (appState === 'success') {
            if (currentStep === 3) { // After "Upload Invoices" completes, move to "Invoice Summarization"
                setCurrentStep(4);
            } else if (currentStep === 1) { // If starting point is raw bank data + invoices already there
                setCurrentStep(1); // Stay on step 1, as transactions are now populated.
            }
        }
    }, [appState, currentStep]);

    // Handle initial reset state when appState is initial (e.g. fresh load or after a full reset from App.tsx)
    useEffect(() => {
        // Fix: Use appState from props
        if (appState === 'initial' && currentStep !== 1) {
            setCurrentStep(1);
        }
    }, [appState, currentStep]);

    // Calculate FTA Figures from Adjusted Trial Balance
    const ftaFormValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;

        const getSum = (labels: string[]) => {
            return labels.reduce((acc, curr) => {
                const item = adjustedTrialBalance.find(i => i.account === curr);
                if (!item) return acc;
                // Net value (Debit - Credit)
                return acc + (item.debit - item.credit);
            }, 0);
        };

        const getAbsSum = (labels: string[]) => Math.abs(getSum(labels));

        // --- Statement of Profit or Loss (First Image) ---
        const operatingRevenue = Math.abs(getSum(['Sales Revenue', 'Sales to related Parties']));
        const derivingRevenueExpenses = Math.abs(getSum(['Direct Cost (COGS)', 'Purchases from Related Parties']));
        const grossProfit = operatingRevenue - derivingRevenueExpenses;

        const salaries = Math.abs(getSum(['Salaries & Wages', 'Staff Benefits']));
        const depreciation = Math.abs(getSum(['Depreciation', 'Amortization – Intangibles']));
        const fines = Math.abs(getSum(['Fines and penalties']));
        const donations = Math.abs(getSum(['Donations']));
        const entertainment = Math.abs(getSum(['Travel & Entertainment', 'Client entertainment expenses']));
        const otherExpenses = Math.abs(getSum(['Office Supplies & Stationery', 'Repairs & Maintenance', 'Insurance Expense', 'Marketing & Advertising', 'Professional Fees', 'Legal Fees', 'IT & Software Subscriptions', 'Fuel Expenses', 'Transportation & Logistics', 'Bank Charges', 'VAT Expense (non-recoverable)', 'Corporate Tax Expense', 'Government Fees & Licenses', 'Bad Debt Expense', 'Miscellaneous Expense']));

        const nonOpExpensesExcl = salaries + depreciation + fines + donations + entertainment + otherExpenses;

        const dividendsReceived = Math.abs(getSum(['Dividends received']));
        const otherNonOpRevenue = Math.abs(getSum(['Other non-operating Revenue', 'Other Operating Income']));

        const interestIncome = Math.abs(getSum(['Interest Income', 'Interest from Related Parties']));
        const interestExpense = Math.abs(getSum(['Interest Expense', 'Interest to Related Parties']));
        const netInterest = interestIncome - interestExpense;

        const gainAssetDisposal = Math.abs(getSum(['Gains on disposal of assets']));
        const lossAssetDisposal = Math.abs(getSum(['Losses on disposal of assets']));
        const netGainsAsset = gainAssetDisposal - lossAssetDisposal;

        const forexGain = Math.abs(getSum(['Foreign exchange gains']));
        const forexLoss = Math.abs(getSum(['Foreign exchange losses']));
        const netForex = forexGain - forexLoss;

        const netProfit = grossProfit - nonOpExpensesExcl + dividendsReceived + otherNonOpRevenue + netInterest + netGainsAsset + netForex;

        // --- Statement of other Comprehensive Income (Second Image) ---
        const ociIncomeNoRec = 0;
        const ociLossNoRec = 0;
        const ociIncomeRec = 0;
        const ociLossRec = 0;
        const ociOtherIncome = 0;
        const ociOtherLoss = 0;
        const totalComprehensiveIncome = netProfit + ociIncomeNoRec - ociLossNoRec + ociIncomeRec - ociLossRec + ociOtherIncome - ociOtherLoss;

        // --- Statement of Financial Position (Consolidated - matching images) ---
        const totalCurrentAssets = Math.abs(getSum(['Cash on Hand', 'Bank Accounts', 'Accounts Receivable', 'Due from related Parties', 'Prepaid Expenses', 'Deposits', 'VAT Recoverable (Input VAT)', 'Inventory – Goods', 'Work-in-Progress – Services']));

        const ppe = Math.abs(getSum(['Property, Plant & Equipment', 'Furniture & Equipment', 'Vehicles']));
        const intangibleAssets = Math.abs(getSum(['Intangibles (Software, Patents)']));
        const financialAssets = Math.abs(getSum(['Investments in Subsidiaries/Associates']));
        const otherNonCurrentAssets = Math.abs(getSum(['Loans to related parties']));

        const totalNonCurrentAssets = ppe + intangibleAssets + financialAssets + otherNonCurrentAssets;
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;

        const totalCurrentLiabilities = Math.abs(getSum(['Accounts Payable', 'Due to Related Parties', 'Accrued Expenses', 'Advances from Customers', 'Short-Term Loans', 'VAT Payable (Output VAT)', 'Corporate Tax Payable']));
        const totalNonCurrentLiabilities = Math.abs(getSum(['Long-Term Liabilities', 'Long-Term Loans', 'Loans from Related Parties', 'Employee End-of-Service Benefits Provision']));
        const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

        const shareCapital = Math.abs(getSum(['Share Capital / Owner’s Equity']));
        const retainedEarnings = Math.abs(getSum(['Retained Earnings', 'Current Year Profit/Loss']));
        const otherEquity = Math.abs(getSum(['Dividends / Owner’s Drawings', "Owner's Current Account"]));
        const totalEquity = shareCapital + retainedEarnings + otherEquity;

        const totalEquityLiabilities = totalEquity + totalLiabilities;

        // --- Tax Calculation ---
        const taxableIncome = Math.max(0, netProfit);
        const threshold = 375000;
        const corporateTaxLiability = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;

        return {
            operatingRevenue, derivingRevenueExpenses, grossProfit,
            salaries, depreciation, fines, donations, entertainment, otherExpenses, nonOpExpensesExcl,
            dividendsReceived, otherNonOpRevenue,
            interestIncome, interestExpense, netInterest,
            gainAssetDisposal, lossAssetDisposal, netGainsAsset,
            forexGain, forexLoss, netForex,
            netProfit,
            ociIncomeNoRec, ociLossNoRec, ociIncomeRec, ociLossRec, ociOtherIncome, ociOtherLoss, totalComprehensiveIncome,
            totalCurrentAssets, ppe, intangibleAssets, financialAssets, otherNonCurrentAssets, totalNonCurrentAssets, totalAssets,
            totalCurrentLiabilities, totalNonCurrentLiabilities, totalLiabilities,
            shareCapital, retainedEarnings, otherEquity, totalEquity, totalEquityLiabilities,
            taxableIncome, corporateTaxLiability
        };
    }, [adjustedTrialBalance]);


    // Initialize reportForm when ftaFormValues change
    useEffect(() => {
        if (ftaFormValues) {
            setReportForm((prev: any) => ({
                ...prev,
                // Section 1
                referenceNumber: prev.referenceNumber || '230008048117',
                dueDate: prev.dueDate || company?.ctDueDate || '30/09/2025',
                periodDescription: prev.periodDescription || `Tax Year End ${company?.ctPeriodEnd?.split('/').pop() || '2024'}`,
                versionDescription: prev.versionDescription || 'Amendment/Voluntary Disclosure',
                periodFrom: prev.periodFrom || company?.ctPeriodStart || '01/01/2024',
                periodTo: prev.periodTo || company?.ctPeriodEnd || '31/12/2024',
                submissionDate: prev.submissionDate || '12/04/2025',
                netTaxPosition: ftaFormValues.corporateTaxLiability,
                downloadDateTime: prev.downloadDateTime || '09/12/2025 09:36:31',
                status: prev.status || 'Processed',
                // Section 2
                taxableNameEn: prev.taxableNameEn || companyName,
                taxableNameAr: prev.taxableNameAr || '',
                entityType: prev.entityType || 'Legal Person - Incorporated',
                entitySubType: prev.entitySubType || 'UAE Private Company (Incl Establishment)',
                trn: prev.trn || company?.trn || '',
                primaryBusiness: prev.primaryBusiness || 'General Trading activities',
                // Section 3
                address: prev.address || company?.address || '',
                mobileNumber: prev.mobileNumber || '+971...',
                landlineNumber: prev.landlineNumber || '+971...',
                emailId: prev.emailId || 'admin@docuflow.in',
                poBox: prev.poBox || '',
                // Section 4 (Profit or Loss - Image 1)
                operatingRevenue: ftaFormValues.operatingRevenue,
                derivingRevenueExpenses: ftaFormValues.derivingRevenueExpenses,
                grossProfit: ftaFormValues.grossProfit,
                salaries: ftaFormValues.salaries,
                depreciation: ftaFormValues.depreciation,
                fines: ftaFormValues.fines || 0,
                donations: ftaFormValues.donations || 0,
                entertainment: ftaFormValues.entertainment || 0,
                otherExpenses: ftaFormValues.otherExpenses,
                nonOpExpensesExcl: ftaFormValues.nonOpExpensesExcl,
                dividendsReceived: ftaFormValues.dividendsReceived || 0,
                otherNonOpRevenue: ftaFormValues.otherNonOpRevenue || 0,
                interestIncome: ftaFormValues.interestIncome || 0,
                interestExpense: ftaFormValues.interestExpense || 0,
                netInterest: ftaFormValues.netInterest,
                gainAssetDisposal: ftaFormValues.gainAssetDisposal || 0,
                lossAssetDisposal: ftaFormValues.lossAssetDisposal || 0,
                netGainsAsset: ftaFormValues.netGainsAsset,
                forexGain: ftaFormValues.forexGain || 0,
                forexLoss: ftaFormValues.forexLoss || 0,
                netForex: ftaFormValues.netForex,
                netProfit: ftaFormValues.netProfit,
                // Section 5 (OCI - Image 2)
                ociIncomeNoRec: ftaFormValues.ociIncomeNoRec || 0,
                ociLossNoRec: ftaFormValues.ociLossNoRec || 0,
                ociIncomeRec: ftaFormValues.ociIncomeRec || 0,
                ociLossRec: ftaFormValues.ociLossRec || 0,
                ociOtherIncome: ftaFormValues.ociOtherIncome || 0,
                ociOtherLoss: ftaFormValues.ociOtherLoss || 0,
                totalComprehensiveIncome: ftaFormValues.totalComprehensiveIncome,
                // Section 6 (SFP - Updated based on images)
                totalCurrentAssets: ftaFormValues.totalCurrentAssets,
                ppe: ftaFormValues.ppe,
                intangibleAssets: ftaFormValues.intangibleAssets,
                financialAssets: ftaFormValues.financialAssets,
                otherNonCurrentAssets: ftaFormValues.otherNonCurrentAssets,
                totalNonCurrentAssets: ftaFormValues.totalNonCurrentAssets,
                totalAssets: ftaFormValues.totalAssets,
                totalCurrentLiabilities: ftaFormValues.totalCurrentLiabilities,
                totalNonCurrentLiabilities: ftaFormValues.totalNonCurrentLiabilities,
                totalLiabilities: ftaFormValues.totalLiabilities,
                shareCapital: ftaFormValues.shareCapital,
                retainedEarnings: ftaFormValues.retainedEarnings,
                otherEquity: ftaFormValues.otherEquity,
                totalEquity: ftaFormValues.totalEquity,
                totalEquityLiabilities: ftaFormValues.totalEquityLiabilities,
                avgEmployees: prev.avgEmployees || 2.0,
                ebitda: prev.ebitda || 0,
                // Section 7
                audited: prev.audited || 'No',
                // Section 8 (Tax Summary - New Granular Fields)
                accountingIncomeTaxPeriod: ftaFormValues.netProfit,
                shareProfitsEquity: prev.shareProfitsEquity || 0,
                accountingNetProfitsUninc: prev.accountingNetProfitsUninc || 0,
                gainsDisposalUninc: prev.gainsDisposalUninc || 0,
                gainsLossesReportedFS: prev.gainsLossesReportedFS || 0,
                realisationBasisAdj: prev.realisationBasisAdj || 0,
                transitionalAdj: prev.transitionalAdj || 0,
                dividendsResident: prev.dividendsResident || 0,
                incomeParticipatingInterests: prev.incomeParticipatingInterests || 0,
                taxableIncomeForeignPE: prev.taxableIncomeForeignPE || 0,
                incomeIntlAircraftShipping: prev.incomeIntlAircraftShipping || 0,
                adjQualifyingGroup: prev.adjQualifyingGroup || 0,
                adjBusinessRestructuring: prev.adjBusinessRestructuring || 0,
                adjNonDeductibleExp: prev.adjNonDeductibleExp || 0,
                adjInterestExp: prev.adjInterestExp || 0,
                adjRelatedParties: prev.adjRelatedParties || 0,
                adjQualifyingInvestmentFunds: prev.adjQualifyingInvestmentFunds || 0,
                otherAdjustmentsTax: prev.otherAdjustmentsTax || 0,
                taxableIncomeBeforeAdj: ftaFormValues.taxableIncome,
                taxLossesUtilised: prev.taxLossesUtilised || 0,
                taxLossesClaimed: prev.taxLossesClaimed || 0,
                preGroupingLosses: prev.preGroupingLosses || 0,
                taxableIncomeTaxPeriod: ftaFormValues.taxableIncome,
                corporateTaxLiability: ftaFormValues.corporateTaxLiability,
                taxCredits: prev.taxCredits || 0,
                corporateTaxPayable: ftaFormValues.corporateTaxLiability,
                // Section 9
                declarationFirstNameEn: prev.declarationFirstNameEn || companyName.split(' ')[0],
                declarationFirstNameAr: prev.declarationFirstNameAr || '',
                declarationLastNameEn: prev.declarationLastNameEn || (companyName.split(' ').length > 1 ? companyName.split(' ')[1] : ''),
                declarationLastNameAr: prev.declarationLastNameAr || '',
                declarationMobile: prev.declarationMobile || '+971...',
                declarationEmail: prev.declarationEmail || 'admin@docuflow.in',
                declarationDate: prev.declarationDate || new Date().toLocaleDateString('en-GB'),
                preparedBy: prev.preparedBy || 'Taxable Person',
                declarationConfirmed: prev.declarationConfirmed || 'Yes'
            }));
        }
    }, [ftaFormValues, company, companyName]);


    const activeSummary = useMemo(() => {
        const currentKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        if (currentKey && fileSummaries && fileSummaries[currentKey]) {
            return fileSummaries[currentKey];
        }
        return summary;
    }, [selectedFileFilter, fileSummaries, summary, uniqueFiles]);

    const filteredTransactions = useMemo(() => {
        let txs = editedTransactions.map((t, i) => ({ ...t, originalIndex: i }));
        if (selectedFileFilter !== 'ALL') {
            txs = txs.filter(t => t.sourceFile === selectedFileFilter);
        }
        return txs.filter(t => {
            const desc = String(typeof t.description === 'string' ? t.description : JSON.stringify(t.description || '')).toLowerCase();
            const matchesSearch = desc.includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'ALL' || resolveCategoryPath(t.category) === filterCategory;
            return matchesSearch && matchesCategory;
        });
    }, [editedTransactions, searchTerm, filterCategory, selectedFileFilter]);

    const handleCategorySelection = useCallback((value: string, context: { type: 'row' | 'bulk' | 'replace' | 'filter', rowIndex?: number }) => {
        if (value === '__NEW__') {
            setPendingCategoryContext(context);
            setNewCategoryMain('');
            setNewCategorySub('');
            setShowAddCategoryModal(true);
        } else {
            if (context.type === 'row' && context.rowIndex !== undefined) {
                setEditedTransactions(prev => {
                    const updated = [...prev];
                    updated[context.rowIndex!] = { ...updated[context.rowIndex!], category: value };
                    return updated;
                });
            } else if (context.type === 'bulk') {
                setBulkCategory(value);
            } else if (context.type === 'replace') {
                setReplaceCategory(value);
            } else if (context.type === 'filter') {
                setFilterCategory(value);
            }
        }
    }, []);

    const handleSaveNewCategory = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (newCategoryMain && newCategorySub.trim()) {
            const formattedName = `${newCategoryMain} | ${newCategorySub.trim()}`;
            setCustomCategories(prev => [...prev, formattedName]);
            if (pendingCategoryContext) {
                handleCategorySelection(formattedName, pendingCategoryContext);
            }
            setShowAddCategoryModal(false);
            setPendingCategoryContext(null);
        }
    }, [newCategoryMain, newCategorySub, pendingCategoryContext, handleCategorySelection]);

    const renderCategoryOptions = useMemo(() => {
        const options: React.ReactNode[] = [];
        options.push(<option key="__NEW__" value="__NEW__" className="text-blue-400 font-bold bg-gray-900">+ Add New Category</option>);
        if (customCategories.length > 0) options.push(<optgroup label="Custom" key="Custom">{customCategories.map(c => <option key={c} value={c}>{getChildCategory(c)}</option>)}</optgroup>);
        Object.entries(CHART_OF_ACCOUNTS).forEach(([main, sub]) => {
            if (Array.isArray(sub)) options.push(<optgroup label={main} key={main}>{sub.map(item => <option key={`${main} | ${item}`} value={`${main} | ${item}`}>{item}</option>)}</optgroup>);
            else if (typeof sub === 'object') options.push(<optgroup label={main} key={main}>{Object.entries(sub).map(([sg, items]) => items.map(item => <option key={`${main} | ${sg} | ${item}`} value={`${main} | ${sg} | ${item}`}>{item}</option>))}</optgroup>);
        });
        return options;
    }, [customCategories]);

    const handleBack = useCallback(() => setCurrentStep(prev => prev - 1), []);
    const handleConfirmCategories = useCallback(() => { onUpdateTransactions(editedTransactions); setCurrentStep(2); }, [editedTransactions, onUpdateTransactions]);
    const handleConfirmSummarization = useCallback(() => setCurrentStep(3), []);

    const handleAutoCategorize = useCallback(async () => {
        if (editedTransactions.length === 0) return;
        // Fix: Use the declared setIsAutoCategorizing
        setIsAutoCategorizing(true);
        try {
            const categorized = await categorizeTransactionsByCoA(editedTransactions);
            setEditedTransactions(categorized);
        } catch (e) {
            console.error("Auto categorization failed:", e);
            alert("Failed to auto-categorize transactions. Please check your network and try again.");
        } finally {
            // Fix: Use the declared setIsAutoCategorizing
            setIsAutoCategorizing(false);
        }
    }, [editedTransactions]);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            const allIndices = new Set(filteredTransactions.map(t => t.originalIndex));
            setSelectedIndices(allIndices);
        } else {
            setSelectedIndices(new Set());
        }
    }, [filteredTransactions]);

    const handleSelectRow = useCallback((originalIndex: number, checked: boolean) => {
        const newSelected = new Set(selectedIndices);
        if (checked) {
            newSelected.add(originalIndex);
        } else {
            newSelected.delete(originalIndex);
        }
        setSelectedIndices(newSelected);
    }, [selectedIndices]);

    const handleBulkApplyCategory = useCallback(() => {
        if (!bulkCategory || selectedIndices.size === 0) return;
        setEditedTransactions(prev => {
            const updated = [...prev];
            selectedIndices.forEach(idx => {
                updated[idx] = { ...updated[idx], category: bulkCategory };
            });
            return updated;
        });
        setSelectedIndices(new Set());
        setBulkCategory('');
    }, [bulkCategory, selectedIndices]);

    const handleFindReplace = useCallback(() => {
        if (!searchTerm || !replaceCategory) return;

        // Identify which transactions are currently displayed based on all filters (Search, Category, File)
        const targetIndices = new Set(filteredTransactions.map(t => t.originalIndex));

        if (targetIndices.size === 0) return;

        setEditedTransactions(prev => prev.map((t, idx) => {
            if (targetIndices.has(idx)) {
                return { ...t, category: replaceCategory };
            }
            return t;
        }));

        const count = targetIndices.size;
        setSelectedIndices(new Set());
        setReplaceCategory('');
        if (count > 0) alert(`Updated categories for ${count} transactions.`);
    }, [searchTerm, replaceCategory, filteredTransactions]);

    const handleDeleteTransaction = useCallback((index: number) => {
        if (window.confirm("Are you sure you want to delete this transaction?")) {
            setEditedTransactions(prev => prev.filter((_, i) => i !== index));
            setSelectedIndices(prev => {
                const newSet = new Set<number>();
                prev.forEach(i => {
                    if (i < index) newSet.add(i);
                    if (i > index) newSet.add(i - 1);
                });
                return newSet;
            });
        }
    }, []);


    const subCategoryOptions = useMemo(() => {
        if (newGlobalAccountMain === 'Equity') return [];
        const section = CHART_OF_ACCOUNTS[newGlobalAccountMain as keyof typeof CHART_OF_ACCOUNTS];
        if (typeof section === 'object' && !Array.isArray(section)) {
            return Object.keys(section);
        }
        return [];
    }, [newGlobalAccountMain]);

    const handleGlobalAddAccount = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!newGlobalAccountName.trim() || !adjustedTrialBalance) return;

        const newEntry: TrialBalanceEntry = {
            account: newGlobalAccountName.trim(),
            debit: 0,
            credit: 0
        };

        setAdjustedTrialBalance(prev => {
            if (!prev) return [newEntry];
            const newTb = [...prev];
            const totalsIdx = newTb.findIndex(i => i.account === 'Totals');
            if (totalsIdx !== -1) {
                newTb.splice(totalsIdx, 0, newEntry);
            } else {
                newTb.push(newEntry);
            }
            return newTb;
        });
        setShowGlobalAddAccountModal(false);
        setNewGlobalAccountName('');
        setNewGlobalAccountChild('');
    }, [adjustedTrialBalance, newGlobalAccountName]);

    const handleReconContinue = useCallback(() => {
        setVatFlowQuestion(1);
        setShowVatFlowModal(true);
    }, []);

    const handleVatFlowAnswer = useCallback((answer: boolean) => {
        // Renumbered to match new step order
        if (vatFlowQuestion === 1) answer ? (setShowVatFlowModal(false), setCurrentStep(6)) : setVatFlowQuestion(2);
        else answer ? (setShowVatFlowModal(false), setCurrentStep(6)) : (setShowVatFlowModal(false), setCurrentStep(7));
    }, [vatFlowQuestion]);

    const handleExtractAdditionalData = useCallback(async () => {
        if (additionalFiles.length === 0) return;
        setIsExtracting(true);
        try {
            const parts = await Promise.all(additionalFiles.map(file => fileToGenerativePart(file)));
            const details = await extractGenericDetailsFromDocuments(parts);
            setAdditionalDetails(details || {});
        } catch (e) {
            console.error("Failed to extract additional details", e);
        } finally {
            setIsExtracting(false);
        }
    }, [additionalFiles]);

    const handleAdditionalDocsStepContinue = useCallback(() => {
        setCurrentStep(7); // Renumbered
    }, []);

    const reconciliationData = useMemo(() => {
        const results: { invoice: Invoice; transaction?: Transaction; status: 'Matched' | 'Unmatched' }[] = [];
        const usedTxIdx = new Set<number>();
        const allInvoices = [...salesInvoices, ...purchaseInvoices];
        allInvoices.forEach(inv => {
            const isSales = inv.invoiceType === 'sales';
            const targetAmt = inv.totalAmountAED || inv.totalAmount;
            const matchIdx = editedTransactions.findIndex((t, idx) => {
                if (usedTxIdx.has(idx)) return false;
                const txAmt = isSales ? (t.credit || 0) : (t.debit || 0);
                return Math.abs(txAmt - targetAmt) < 0.1;
            });
            if (matchIdx !== -1) {
                usedTxIdx.add(matchIdx);
                results.push({ invoice: inv, transaction: editedTransactions[matchIdx], status: 'Matched' });
            } else results.push({ invoice: inv, status: 'Unmatched' });
        });
        return results;
    }, [salesInvoices, purchaseInvoices, editedTransactions]);

    // Fix: Define handleExtractTrialBalance
    const handleExtractTrialBalance = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsExtractingTB(true);
        try {
            const part = await fileToGenerativePart(file);
            const extractedEntries = await extractTrialBalanceData([part]);

            if (extractedEntries && extractedEntries.length > 0) {
                setAdjustedTrialBalance(prev => {
                    const currentMap: Record<string, TrialBalanceEntry> = {};
                    (prev || []).forEach(item => {
                        if (item.account.toLowerCase() !== 'totals') {
                            currentMap[item.account.toLowerCase()] = item;
                        }
                    });

                    extractedEntries.forEach(extracted => {
                        currentMap[extracted.account.toLowerCase()] = extracted;
                    });

                    const newEntries = Object.values(currentMap);

                    const totalDebit = newEntries.reduce((s, i) => s + (Number(i.debit) || 0), 0);
                    const totalCredit = newEntries.reduce((s, i) => s + (Number(i.credit) || 0), 0);

                    return [...newEntries, { account: 'Totals', debit: totalDebit, credit: totalCredit }];
                });
            }
        } catch (err) {
            console.error("TB extraction failed", err);
            alert("Failed to extract data from Trial Balance. Please ensure the document is clear and try again.");
        } finally {
            setIsExtractingTB(false);
            if (tbFileInputRef.current) {
                tbFileInputRef.current.value = '';
            }
        }
    }, []);

    // Fix: Define handleCellChange
    const handleCellChange = useCallback((accountLabel: string, field: 'debit' | 'credit', value: string) => {
        const numValue = parseFloat(value) || 0;
        setAdjustedTrialBalance(prev => {
            if (!prev) return prev;
            const newBalance = [...prev];
            const existingIndex = newBalance.findIndex(item => item.account.toLowerCase() === accountLabel.toLowerCase());
            if (existingIndex > -1) {
                newBalance[existingIndex] = { ...newBalance[existingIndex], [field]: numValue };
            } else {
                const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
                const newItem = { account: accountLabel, debit: 0, credit: 0, [field]: numValue };
                if (totalsIdx > -1) newBalance.splice(totalsIdx, 0, newItem);
                else newBalance.push(newItem);
            }
            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const finalTotalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (finalTotalsIdx > -1) newBalance[finalTotalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
            else newBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });
            return newBalance;
        });
    }, []);

    const handleReportFormChange = useCallback((field: string, value: any) => {
        setReportForm((prev: any) => ({ ...prev, [field]: value }));
    }, []);

    // Fix: Moved ReportInput and ReportNumberInput outside renderStepX functions
    const ReportInput = ({ field, type = "text", className = "" }: { field: string, type?: string, className?: string }) => (
        <input
            type={type}
            value={reportForm[field] || ''}
            onChange={(e) => handleReportFormChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className={`w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 focus:ring-0 p-1 text-white transition-all text-xs font-medium outline-none ${className}`}
        />
    );

    const ReportNumberInput = ({ field, className = "" }: { field: string, className?: string }) => (
        <input
            type="number"
            step="0.01"
            value={reportForm[field] || 0}
            onChange={(e) => handleReportFormChange(field, parseFloat(e.target.value) || 0)}
            className={`w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 focus:ring-0 p-1 text-right font-mono text-white transition-all text-xs font-bold outline-none ${className}`}
        />
    );


    const renderStep1 = () => {
        const currentPreviewKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        const hasPreviews = !!(currentPreviewKey && statementPreviewUrls);

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <ResultsStatCard
                        label="Opening Balance"
                        value={activeSummary?.openingBalance !== undefined ? `${formatNumber(activeSummary.openingBalance)} ${currency}` : 'N/A'}
                        color="text-blue-300"
                        icon={<ArrowUpRightIcon className="w-4 h-4" />}
                    />
                    <ResultsStatCard
                        label="Closing Balance"
                        value={activeSummary?.closingBalance !== undefined ? `${formatNumber(activeSummary.closingBalance)} ${currency}` : 'N/A'}
                        color="text-purple-300"
                        icon={<ArrowDownIcon className="w-4 h-4" />}
                    />
                    <ResultsStatCard
                        label="Total Count"
                        value={String(filteredTransactions.length)}
                        icon={<ListBulletIcon className="w-5 h-5" />}
                    />
                    <ResultsStatCard
                        label="Uncategorized"
                        value={String(filteredTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length)}
                        color="text-red-400"
                        icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-400" />}
                    />
                    <ResultsStatCard
                        label="Files"
                        value={String(uniqueFiles.length)}
                        icon={<DocumentDuplicateIcon className="w-5 h-5" />}
                    />
                </div>

                <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-4">
                    <div className="flex flex-col xl:flex-row gap-4 justify-between mb-4">
                        <div className="flex flex-wrap gap-3 items-center flex-1">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <select
                                value={filterCategory}
                                onChange={(e) => handleCategorySelection(e.target.value, { type: 'filter' })}
                                className="py-2 px-3 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500 max-w-[200px]"
                            >
                                <option value="ALL">All Categories</option>
                                <option value="UNCATEGORIZED">Uncategorized Only</option>
                                {renderCategoryOptions}
                            </select>
                            <select
                                value={selectedFileFilter}
                                onChange={(e) => setSelectedFileFilter(e.target.value)}
                                className="py-2 px-3 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500 max-w-[200px]"
                            >
                                <option value="ALL">All Files</option>
                                {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            {(searchTerm || filterCategory !== 'ALL' || selectedFileFilter !== 'ALL') && (
                                <button onClick={() => { setSearchTerm(''); setFilterCategory('ALL'); setSelectedFileFilter('ALL'); }} className="text-sm text-red-400 hover:text-red-300">Clear</button>
                            )}
                        </div>

                        <div className="flex flex-wrap gap-2 items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
                            <span className="text-xs text-gray-400 font-semibold px-2">Bulk Actions:</span>
                            <select
                                value={bulkCategory}
                                onChange={(e) => handleCategorySelection(e.target.value, { type: 'bulk' })}
                                className="py-1.5 px-2 bg-gray-900 border border-gray-600 rounded text-xs text-white focus:outline-none"
                            >
                                <option value="">Select Category...</option>
                                {renderCategoryOptions}
                            </select>
                            <button
                                onClick={handleBulkApplyCategory}
                                disabled={!bulkCategory || selectedIndices.size === 0}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded disabled:opacity-50"
                            >
                                Apply
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 mb-4 bg-gray-800 p-2 rounded-lg border border-gray-700 items-center">
                        <span className="text-xs text-gray-400 font-semibold px-2">Find & Replace Category:</span>
                        <input
                            type="text"
                            placeholder="Description contains..."
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            className="py-1.5 px-2 bg-gray-900 border border-gray-600 rounded text-xs text-white focus:outline-none"
                        />
                        <ArrowRightIcon className="w-4 h-4 text-gray-500" />
                        <select
                            value={replaceCategory}
                            onChange={(e) => handleCategorySelection(e.target.value, { type: 'replace' })}
                            className="py-1.5 px-2 bg-gray-900 border border-gray-600 rounded text-xs text-white focus:outline-none"
                        >
                            <option value="">Select New Category...</option>
                            {renderCategoryOptions}
                        </select>
                        <button
                            onClick={handleFindReplace}
                            disabled={!findText || !replaceCategory}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded disabled:opacity-50"
                        >
                            Replace All
                        </button>
                        <div className="flex-1"></div>
                        <button
                            onClick={handleAutoCategorize}
                            // Fix: Use the declared isAutoCategorizing
                            disabled={isAutoCategorizing}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center disabled:opacity-50"
                        >
                            <SparklesIcon className="w-3 h-3 mr-1" />
                            {/* Fix: Use the declared isAutoCategorizing */}
                            {isAutoCategorizing ? 'Running AI...' : 'Auto-Categorize'}
                        </button>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px] relative">
                        <div className="flex-1 overflow-auto bg-black/20 rounded-lg border border-gray-700 min-h-[400px]">
                            <table className="w-full text-sm text-left text-gray-400">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                                checked={filteredTransactions.length > 0 && selectedIndices.size === filteredTransactions.length}
                                                className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-4 py-3">Date</th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 text-right">Debit</th>
                                        <th className="px-4 py-3 text-right">Credit</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.map((t) => (
                                        <tr key={t.originalIndex} className={`border-b border-gray-800 hover:bg-gray-800/50 ${selectedIndices.has(t.originalIndex) ? 'bg-blue-900/10' : ''}`}>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.has(t.originalIndex)}
                                                    onChange={(e) => handleSelectRow(t.originalIndex, e.target.checked)}
                                                    className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                                            <td className="px-4 py-2 text-white max-w-xs truncate" title={typeof t.description === 'string' ? t.description : JSON.stringify(t.description)}>
                                                {typeof t.description === 'string' ? t.description : JSON.stringify(t.description)}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-red-400">
                                                {t.debit > 0 ? formatNumber(t.debit) : '-'}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono text-green-400">
                                                {t.credit > 0 ? formatNumber(t.credit) : '-'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <select
                                                    value={t.category || ''}
                                                    onChange={(e) => handleCategorySelection(e.target.value, { type: 'row', rowIndex: t.originalIndex })}
                                                    className={`w-full bg-transparent text-xs p-1 rounded border ${(!t.category || t.category.toUpperCase().includes('UNCATEGORIZED')) ? 'border-red-500/50 text-red-300' : 'border-gray-700 text-gray-300'
                                                        } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none`}
                                                >
                                                    <option value="" disabled>Select...</option>
                                                    {renderCategoryOptions}
                                                </select>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button onClick={() => handleDeleteTransaction(t.originalIndex)} className="text-gray-600 hover:text-red-400">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-gray-500">No transactions found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {/* Removed preview panel for now as it needs a specific file to display, which is not tied to selectedFileFilter directly for combined statements. */}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-700">
                    <div className="text-sm text-gray-400">
                        <span className="text-white font-bold">{editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length}</span> uncategorized items remaining.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => { /* Handle export for step 1 */ }} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">
                            Download Work in Progress
                        </button>
                        <button onClick={handleConfirmCategories} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                            Continue to Summarization
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep2Summarization = () => (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Transaction Summary</h3>
                    <div className="flex items-center gap-3">
                        <select
                            value={summaryFileFilter}
                            onChange={(e) => setSummaryFileFilter(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded text-sm text-white px-3 py-1.5 focus:outline-none"
                        >
                            <option value="ALL">All Files</option>
                            {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <button onClick={() => { /* Handle Export Step Summary */ }} className="text-gray-400 hover:text-white"><DocumentArrowDownIcon className="w-5 h-5" /></button>
                    </div>
                </div>
                {/* Simplified Summary table, implement full logic if needed */}
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Accounts</th>
                                <th className="px-6 py-3 text-right">Debit</th>
                                <th className="px-6 py-3 text-right">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {/* Dummy data for now, replace with actual summarized data */}
                            {editedTransactions.map((t, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium">{t.category && !t.category.toUpperCase().includes('UNCATEGORIZED') ? t.category : 'Uncategorized'}</td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(t.debit || 0)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(t.credit || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <button onClick={handleConfirmSummarization} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                    Confirm & Continue
                </button>
            </div>
        </div>
    );

    const renderStep3UploadInvoices = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Upload Invoices & Bills</h2>
            <p className="text-gray-400">Upload your sales and purchase invoices for extraction and reconciliation.</p>
            <FileUploadArea
                title="Invoices & Bills"
                subtitle="Upload invoice PDF or image files."
                icon={<DocumentTextIcon className="w-6 h-6 mr-1" />}
                selectedFiles={invoiceFiles || []}
                onFilesSelect={onVatInvoiceFilesSelect}
            />
            {invoiceFiles && invoiceFiles.length > 0 && onProcess && (
                <div className="flex justify-end pt-4">
                    <button
                        onClick={onProcess}
                        className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        Extract Invoices
                    </button>
                </div>
            )}

            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                {/* Optionally enable 'Continue' even without files, assuming they might skip this if no invoices */}
                <button onClick={() => setCurrentStep(4)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                    Continue to Invoice Summary
                </button>
            </div>
        </div>
    );

    const renderStep4InvoiceSummarization = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Invoice Summarization</h2>
            <p className="text-gray-400">Review the extracted sales and purchase invoices.</p>
            <InvoiceSummarizationView
                salesInvoices={salesInvoices}
                purchaseInvoices={purchaseInvoices}
                currency={currency}
            />
            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <button onClick={() => setCurrentStep(5)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                    Continue to Bank Reconciliation
                </button>
            </div>
        </div>
    );

    const renderStep5BankReconciliation = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Bank Reconciliation</h2>
            <p className="text-gray-400">Match extracted invoices against bank statement transactions.</p>
            <ReconciliationTable
                invoices={[...salesInvoices, ...purchaseInvoices]}
                transactions={editedTransactions}
                currency={currency}
            />
            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <button onClick={handleReconContinue} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                    Continue to VAT/Additional Docs
                </button>
            </div>
        </div>
    );

    const renderStep6VatAdditionalDocs = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-500/5">
                            <ChartPieIcon className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">VAT Summarization / Additional Documents</h3>
                            <p className="text-gray-400 mt-1 max-w-2xl">Upload relevant VAT certificates, sales/purchase ledgers, or other supporting documents to extract additional financial details.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="min-h-[450px]">
                            <FileUploadArea
                                title="Upload Documents"
                                subtitle="VAT Returns, Ledgers, etc."
                                icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                                selectedFiles={additionalFiles}
                                onFilesSelect={setAdditionalFiles}
                            />
                        </div>
                        <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 flex flex-col min-h-[450px]">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <SparklesIcon className="w-5 h-5 text-blue-400" />
                                    <h4 className="text-lg font-bold text-white tracking-tight">Extracted Details</h4>
                                </div>
                                <button
                                    onClick={handleExtractAdditionalData}
                                    disabled={additionalFiles.length === 0 || isExtracting}
                                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isExtracting ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                            Extracting...
                                        </>
                                    ) : (
                                        'Extract Data'
                                    )}
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0F1D] rounded-xl border border-gray-800 p-6">
                                {Object.keys(additionalDetails).length > 0 ? (
                                    <ul className="space-y-4">
                                        {Object.entries(additionalDetails).map(([k, v]) => (
                                            <li key={k} className="flex justify-between items-start gap-4 border-b border-gray-800/50 pb-3 last:border-0 last:pb-0">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{k.replace(/_/g, ' ')}:</span>
                                                <span className="text-sm text-white text-right font-medium leading-relaxed">{String(v)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center">
                                        <LightBulbIcon className="w-12 h-12 text-gray-800 mb-4" />
                                        <p className="text-gray-600 font-medium max-w-[200px]">No data extracted yet. Click "Extract Data" after uploading files.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    {/* Optionally add export button for additional docs here */}
                    <button
                        onClick={handleAdditionalDocsStepContinue}
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                    >
                        Continue to Opening Balances
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep7OpeningBalances = () => (
        <div className="space-y-6">
            <OpeningBalances
                onComplete={() => setCurrentStep(8)}
                currency={currency}
                accountsData={openingBalancesData}
                onAccountsDataChange={setOpeningBalancesData}
                onExport={() => { /* Handle export for opening balances */ }}
            />
            <div className="flex justify-start">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
            </div>
        </div>
    );

    const renderStep8AdjustTrialBalance = () => {
        const ACCOUNT_MAPPING: Record<string, string> = {
            'Cash on Hand': 'Cash on Hand',
            'Bank Accounts': 'Bank Accounts',
            'Accounts Receivable': 'Accounts Receivable',
            'Due from related Parties': 'Due from related Parties',
            'Prepaid Expenses': 'Prepaid Expenses',
            'Advances to Suppliers': 'Prepaid Expenses',
            'Deposits': 'Deposits',
            'VAT Recoverable (Input VAT)': 'VAT Recoverable (Input VAT)',
            'Furniture & Equipment': 'Property, Plant & Equipment',
            'Vehicles': 'Property, Plant & Equipment',
            'Intangibles (Software, Patents)': 'Property, Plant & Equipment',
            'Accounts Payable': 'Accounts Payable',
            'Due to Related Parties': 'Due to Related Parties',
            'Accrued Expenses': 'Accrued Expenses',
            'VAT Payable (Output VAT)': 'VAT Payable (Output VAT)',
            'Long-Term Loans': 'Long-Term Liabilities',
            'Loans from Related Parties': 'Long-Term Liabilities',
            'Employee End-of-Service Benefits Provision': 'Long-Term Liabilities',
            'Share Capital / Owner’s Equity': 'Share Capital / Owner’s Equity',
            'Retained Earnings': 'Retained Earnings',
            'Current Year Profit/Loss': 'Retained Earnings',
            'Dividends / Owner’s Drawings': 'Dividends / Owner’s Drawings',
            "Owner's Current Account": "Owner's Current Account",
            'Sales Revenue': 'Sales Revenue',
            'Sales to related Parties': 'Sales Revenue',
            'Interest Income': 'Interest Income',
            'Interest from Related Parties': 'Interest Income',
            'Miscellaneous Income': 'Miscellaneous Income',
            'Other Operating Income': 'Miscellaneous Income',
            'Direct Cost (COGS)': 'Direct Cost (COGS)',
            'Purchases from Related Parties': 'Purchases from Related Parties',
            'Salaries & Wages': 'Salaries & Wages',
            'Staff Benefits': 'Salaries & Wages',
            'Training & Development': 'Training & Development',
            'Rent Expense': 'Rent Expense',
            'Utility - Electricity & Water': 'Utility - Electricity & Water',
            'Utility - Telephone & Internet': 'Utility - Telephone & Internet',
            'Office Supplies & Stationery': 'Office Supplies & Stationery',
            'Repairs & Maintenance': 'Repairs & Maintenance',
            'Insurance Expense': 'Insurance Expense',
            'Marketing & Advertising': 'Marketing & Advertising',
            'Travel & Entertainment': 'Travel & Entertainment',
            'Professional Fees (Audit, Consulting)': 'Professional Fees',
            'Legal Fees': 'Legal Fees',
            'IT & Software Subscriptions': 'IT & Software Subscriptions',
            'Fuel Expenses': 'Fuel Expenses',
            'Transportation & Logistics': 'Transportation & Logistics',
            'Interest Expense': 'Interest Expense',
            'Interest to Related Parties': 'Interest to Related Parties',
            'Bank Charges': 'Bank Charges',
            'Corporate Tax Expense': 'Corporate Tax Expense',
            'Government Fees & Licenses': 'Government Fees & Licenses',
            'Depreciation – Furniture & Equipment': 'Depreciation',
            'Depreciation – Vehicles': 'Depreciation',
            'Amortization – Intangibles': 'Depreciation',
            'VAT Expense (non-recoverable)': 'Miscellaneous Expense',
            'Bad Debt Expense': 'Miscellaneous Expense',
            'Miscellaneous Expense': 'Miscellaneous Expense'
        };

        const getIconForSection = (label: string) => {
            if (label.includes('Assets')) return AssetIcon;
            if (label.includes('Liabilities')) return ScaleIcon;
            if (label.includes('Incomes') || label.includes('Income')) return IncomeIcon;
            if (label.includes('Expenses')) return ExpenseIcon;
            if (label.includes('Equity')) return EquityIcon;
            return BriefcaseIcon;
        };

        const buckets: Record<string, { debit: number, credit: number, isCustom?: boolean }> = {};
        const structure = [
            { type: 'header', label: 'Assets' },
            { type: 'subheader', label: 'Current Assets' },
            { type: 'row', label: 'Cash on Hand' },
            { type: 'row', label: 'Bank Accounts' },
            { type: 'row', label: 'Accounts Receivable' },
            { type: 'row', label: 'Due from related Parties' },
            { type: 'row', label: 'Prepaid Expenses' },
            { type: 'row', label: 'Deposits' },
            { type: 'row', label: 'VAT Recoverable (Input VAT)' },
            { type: 'subheader', label: 'Non Current Asset' },
            { type: 'row', label: 'Property, Plant & Equipment' },

            { type: 'header', label: 'Liabilities' },
            { type: 'subheader', label: 'Current Liabilities' },
            { type: 'row', label: 'Accounts Payable' },
            { type: 'row', label: 'Due to Related Parties' },
            { type: 'row', label: 'Accrued Expenses' },
            { type: 'row', label: 'VAT Payable (Output VAT)' },
            { type: 'subheader', label: 'Long-Term Liabilities' },
            { type: 'row', label: 'Long-Term Liabilities' },

            { type: 'header', label: 'Equity' },
            { type: 'row', label: 'Share Capital / Owner’s Equity' },
            { type: 'row', label: 'Retained Earnings' },
            { type: 'row', label: 'Dividends / Owner’s Drawings' },
            { type: 'row', label: "Owner's Current Account" },

            { type: 'header', label: 'Income' },
            { type: 'subheader', label: 'Operating Income' },
            { type: 'row', label: 'Sales Revenue' },
            { type: 'subheader', label: 'Other Income' },
            { type: 'row', label: 'Interest Income' },
            { type: 'row', label: 'Miscellaneous Income' },

            { type: 'header', label: 'Expenses' },
            { type: 'subheader', label: 'Direct Costs' },
            { type: 'row', label: 'Direct Cost (COGS)' },
            { type: 'row', label: 'Purchases from Related Parties' },
            { type: 'subheader', label: 'Other Expense' },
            { type: 'row', label: 'Salaries & Wages' },
            { type: 'row', label: 'Training & Development' },
            { type: 'row', label: 'Rent Expense' },
            { type: 'row', label: 'Utility - Electricity & Water' },
            { type: 'row', label: 'Utility - Telephone & Internet' },
            { type: 'row', label: 'Office Supplies & Stationery' },
            { type: 'row', label: 'Repairs & Maintenance' },
            { type: 'row', label: 'Insurance Expense' },
            { type: 'row', label: 'Marketing & Advertising' },
            { type: 'row', label: 'Travel & Entertainment' },
            { type: 'row', label: 'Professional Fees' },
            { type: 'row', label: 'Legal Fees' },
            { type: 'row', label: 'IT & Software Subscriptions' },
            { type: 'row', label: 'Fuel Expenses' },
            { type: 'row', label: 'Transportation & Logistics' },
            { type: 'row', label: 'Interest Expense' },
            { type: 'row', label: 'Interest to Related Parties' },
            { type: 'row', label: 'Bank Charges' },
            { type: 'row', label: 'Corporate Tax Expense' },
            { type: 'row', label: 'Government Fees & Licenses' },
            { type: 'row', label: 'Depreciation' },
            { type: 'row', label: 'Miscellaneous Expense' },
        ];

        structure.forEach(item => {
            if (item.type === 'row' || item.type === 'subrow') {
                buckets[item.label] = { debit: 0, credit: 0 };
            }
        });

        if (adjustedTrialBalance) {
            adjustedTrialBalance.forEach(entry => {
                if (entry.account.toLowerCase() === 'totals') return;

                if (buckets[entry.account]) {
                    buckets[entry.account].debit += entry.debit;
                    buckets[entry.account].credit += entry.credit;
                }
                else if (ACCOUNT_MAPPING[entry.account] && buckets[ACCOUNT_MAPPING[entry.account]]) {
                    buckets[ACCOUNT_MAPPING[entry.account]].debit += entry.debit;
                    buckets[ACCOUNT_MAPPING[entry.account]].credit += entry.credit;
                }
                else {
                    buckets[entry.account] = { debit: entry.debit, credit: entry.credit, isCustom: true };
                }
            });
        }

        interface TbSection {
            title: string;
            icon: React.FC<React.SVGProps<SVGSVGElement>>;
            items: any[];
            totalDebit: number;
            totalCredit: number;
        }

        const sections: TbSection[] = [];
        let currentSection: TbSection | null = null;

        structure.forEach(item => {
            if (item.type === 'header') {
                if (currentSection) sections.push(currentSection);
                currentSection = {
                    title: item.label,
                    icon: getIconForSection(item.label),
                    items: [],
                    totalDebit: 0,
                    totalCredit: 0
                };
            } else if (currentSection) {
                if (item.type === 'subheader') {
                    currentSection.items.push(item);
                } else {
                    const vals = buckets[item.label] || { debit: 0, credit: 0 };
                    // const hasBreakdown = !!breakdowns[item.label]; // No breakdowns in this version
                    currentSection.items.push({ ...item, ...vals /*, hasBreakdown*/ });
                    currentSection.totalDebit += vals.debit;
                    currentSection.totalCredit += vals.credit;
                }
            }
        });
        if (currentSection) sections.push(currentSection);

        // Filter out totals row before iterating through sections
        const adjustedTrialBalanceExclTotals = (adjustedTrialBalance || []).filter(item => item.account.toLowerCase() !== 'totals');

        // Add custom accounts to appropriate sections
        adjustedTrialBalanceExclTotals.forEach(entry => {
            if (buckets[entry.account]?.isCustom) { // Check if it's a custom account added to buckets
                let targetSectionTitle = 'Expenses'; // Default to Expenses if no match
                for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
                    if (Array.isArray(details)) {
                        if (details.includes(entry.account)) { targetSectionTitle = mainCat; break; }
                    } else {
                        for (const [subGroup, accounts] of Object.entries(details)) {
                            if ((accounts as string[]).includes(entry.account)) { targetSectionTitle = mainCat; break; }
                        }
                    }
                }
                if (targetSectionTitle === 'Revenues') targetSectionTitle = 'Income'; // Standardize

                const targetSection = sections.find(s => s.title === targetSectionTitle);
                if (targetSection) {
                    // const hasBreakdown = !!breakdowns[entry.account]; // No breakdowns in this version
                    // Add only if not already in fixed structure and is custom
                    if (!targetSection.items.some((item: { label: string; }) => item.label === entry.account)) {
                        targetSection.items.push({ type: 'row', label: entry.account, debit: entry.debit, credit: entry.credit, isCustom: true /*, hasBreakdown*/ });
                        targetSection.totalDebit += entry.debit;
                        targetSection.totalCredit += entry.credit;
                    }
                }
            }
        });

        const grandTotal = sections.reduce((acc, curr) => ({ debit: acc.debit + curr.totalDebit, credit: acc.credit + curr.totalCredit }), { debit: 0, credit: 0 });

        return (
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 bg-gray-950 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Adjust Trial Balance</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" />
                        <button onClick={() => { /* Handle export step 2 */ }} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
                            <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export
                        </button>
                        <button onClick={() => tbFileInputRef.current?.click()} disabled={isExtractingTB} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md disabled:opacity-50">
                            {isExtractingTB ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Extracting...</> : <><UploadIcon className="w-5 h-5 mr-1.5" /> Upload TB</>}
                        </button>
                        <button onClick={() => setShowGlobalAddAccountModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md">
                            <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                        </button>
                    </div>
                </div>

                {isExtractingTB && <div className="p-10 border-b border-gray-800 bg-black/40"><LoadingIndicator progress={60} statusText="Gemini AI is reading your Trial Balance table..." /></div>}

                <div className="divide-y divide-gray-800">
                    {sections.map(sec => (
                        <div key={sec.title}>
                            <button onClick={() => setOpenTbSection(openTbSection === sec.title ? null : sec.title)} className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === sec.title ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}>
                                <div className="flex items-center space-x-3">{React.createElement(sec.icon, { className: "w-5 h-5 text-gray-400" })}<span className="font-bold text-white uppercase tracking-wide">{sec.title}</span></div>
                                {openTbSection === sec.title ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                            </button>
                            {openTbSection === sec.title && (
                                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead><tr className="bg-gray-800/30 text-gray-500 text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-gray-700/50">Account Name</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Debit</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Credit</th></tr></thead>
                                        <tbody>
                                            {sec.items.map((item: any, idx: number) => { // Cast item to any to avoid TS errors
                                                if (item.type === 'subheader') {
                                                    return (
                                                        <tr key={idx} className="bg-gray-900/50">
                                                            <td colSpan={3} className={`px-2 py-2 font-bold text-xs text-gray-400 border-b border-gray-800/50 pt-4 pb-1`}>
                                                                {item.label}
                                                            </td>
                                                        </tr>
                                                    );
                                                } else {
                                                    return (
                                                        <tr key={idx} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0">
                                                            <td className="py-2 px-4 text-gray-300 font-medium">{item.label}</td>
                                                            <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.debit || ''} onChange={e => handleCellChange(item.label, 'debit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs" /></td>
                                                            <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.credit || ''} onChange={e => handleCellChange(item.label, 'credit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs" /></td>
                                                        </tr>
                                                    );
                                                }
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-black border-t border-gray-800">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-12">
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Debit</p><p className="font-mono font-bold text-2xl text-white">{formatNumber(grandTotal.debit)}</p></div>
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Credit</p><p className="font-mono font-bold text-2xl text-white">{formatNumber(grandTotal.credit)}</p></div>
                        </div>
                        <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(grandTotal.debit - grandTotal.credit) < 0.1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                            {Math.abs(grandTotal.debit - grandTotal.credit) < 0.1 ? 'Balanced' : `Variance: ${formatNumber(grandTotal.debit - grandTotal.credit)}`}
                        </div>
                    </div>
                    <div className="flex justify-between mt-8 border-t border-gray-800 pt-6">
                        <button onClick={handleBack} className="text-gray-400 hover:text-white font-bold transition-colors">Back</button>
                        <button onClick={() => setCurrentStep(9)} disabled={Math.abs(grandTotal.debit - grandTotal.credit) > 0.1} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep9FinalReport = () => {
        if (!ftaFormValues) return null;

        const sections = [
            {
                id: 'tax-return-info',
                title: 'Corporate Tax Return Information',
                icon: InformationCircleIcon,
                fields: [
                    { label: 'Corporate Tax Return Due Date', field: 'dueDate' },
                    { label: 'Corporate Tax Period Description', field: 'periodDescription' },
                    { label: 'Period From', field: 'periodFrom' },
                    { label: 'Period To', field: 'periodTo' },
                    { label: 'Net Corporate Tax Position (AED)', field: 'netTaxPosition', labelPrefix: 'AED ' }
                ]
            },
            {
                id: 'taxpayer-details',
                title: 'Taxpayer Details',
                icon: IdentificationIcon,
                fields: [
                    { label: 'Taxable Person Name in English', field: 'taxableNameEn' },
                    { label: 'Entity Type', field: 'entityType' },
                    { label: 'TRN', field: 'trn' },
                    { label: 'Primary Business', field: 'primaryBusiness' }
                ]
            },
            {
                id: 'address-details',
                title: 'Address Details',
                icon: BuildingOfficeIcon,
                fields: [
                    { label: 'Address', field: 'address', colSpan: true },
                    { label: 'Mobile Number', field: 'mobileNumber' },
                    { label: 'Email ID', field: 'emailId' }
                ]
            },
            {
                id: 'profit-loss',
                title: 'Statement of Profit or Loss',
                icon: IncomeIcon,
                fields: [
                    { label: 'Operating Revenue (AED)', field: 'operatingRevenue', type: 'number' },
                    { label: 'Expenditure incurred in deriving operating revenue (AED)', field: 'derivingRevenueExpenses', type: 'number' },
                    { label: 'Gross Profit / Loss (AED)', field: 'grossProfit', type: 'number', highlight: true },
                    { label: '--- Non-operating Expense ---', field: '_header_non_op', type: 'header' },
                    { label: 'Salaries, wages and related charges (AED)', field: 'salaries', type: 'number' },
                    { label: 'Depreciation and amortisation (AED)', field: 'depreciation', type: 'number' },
                    { label: 'Other expenses (AED)', field: 'otherExpenses', type: 'number' },
                    { label: 'Non-operating expenses (Excluding other items listed below) (AED)', field: 'nonOpExpensesExcl', type: 'number', highlight: true },
                    { label: '--- Other Items ---', field: '_header_other', type: 'header' },
                    { label: 'Net Interest Income / (Expense) (AED)', field: 'netInterest', type: 'number', highlight: true },
                    { label: 'Net profit / (loss) (AED)', field: 'netProfit', type: 'number', highlight: true }
                ]
            },
            {
                id: 'financial-position',
                title: 'Statement of Financial Position',
                icon: AssetIcon,
                fields: [
                    { label: '--- Assets ---', field: '_header_assets', type: 'header' },
                    { label: 'Total current assets (AED)', field: 'totalCurrentAssets', type: 'number', highlight: true },
                    { label: 'Property, Plant and Equipment (AED)', field: 'ppe', type: 'number' },
                    { label: 'Total assets (AED)', field: 'totalAssets', type: 'number', highlight: true },
                    { label: '--- Liabilities ---', field: '_header_liabilities', type: 'header' },
                    { label: 'Total current liabilities (AED)', field: 'totalCurrentLiabilities', type: 'number', highlight: true },
                    { label: 'Total liabilities (AED)', field: 'totalLiabilities', type: 'number', highlight: true },
                    { label: '--- Equity ---', field: '_header_equity', type: 'header' },
                    { label: 'Share capital (AED)', field: 'shareCapital', type: 'number' },
                    { label: 'Total equity (AED)', field: 'totalEquity', type: 'number', highlight: true },
                    { label: 'Total equity and liabilities (AED)', field: 'totalEquityLiabilities', type: 'number', highlight: true }
                ]
            },
            {
                id: 'tax-summary',
                title: 'Tax Summary',
                icon: ChartBarIcon,
                fields: [
                    { label: '1. Accounting Income for the Tax Period (AED)', field: 'accountingIncomeTaxPeriod', type: 'number' },
                    { label: '23. Taxable Income / (Tax Loss) for the Tax Period (AED)', field: 'taxableIncomeTaxPeriod', type: 'number', highlight: true },
                    { label: '24. Corporate Tax Liability (AED)', field: 'corporateTaxLiability', type: 'number', highlight: true },
                    { label: '26. Corporate Tax Payable (AED)', field: 'corporateTaxPayable', type: 'number', highlight: true }
                ]
            },
            {
                id: 'declaration',
                title: 'Review and Declaration',
                icon: ClipboardCheckIcon,
                fields: [
                    { label: 'Date of Submission', field: 'declarationDate' },
                    { label: 'Confirm who the Tax Return is being prepared by', field: 'preparedBy' },
                    { label: 'I confirm the Declaration', field: 'declarationConfirmed' }
                ]
            }
        ];

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-[#0F172A] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden ring-1 ring-gray-800">
                    <div className="p-8 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0A0F1D] gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/30">
                                <SparklesIcon className="w-10 h-10 text-white" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Corporate Tax Return</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{reportForm.taxableNameEn}</p>
                                    <span className="h-1 w-1 bg-gray-700 rounded-full"></span>
                                    <p className="text-xs text-blue-400 font-mono">DRAFT READY</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button onClick={handleBack} className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-700 text-gray-500 hover:text-white rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-800">Back</button>
                            <button onClick={onReset} className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-700 text-gray-500 hover:text-white rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-800">Start Over</button>
                            <button onClick={() => { /* Handle final export */ }} className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                Generate & Export
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-800">
                        {sections.map(section => (
                            <div key={section.id} className="group">
                                <button
                                    onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)}
                                    className={`w-full flex items-center justify-between p-6 transition-all ${openReportSection === section.title ? 'bg-[#1E293B]/40' : 'hover:bg-[#1E293B]/20'}`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`p-2.5 rounded-xl border transition-all ${openReportSection === section.title ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-900 border-gray-700 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-400'}`}>
                                            <section.icon className="w-5 h-5" />
                                        </div>
                                        <span className={`font-black uppercase tracking-widest text-xs ${openReportSection === section.title ? 'text-white' : 'text-gray-400'}`}>{section.title}</span>
                                    </div>
                                    <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openReportSection === section.title ? 'rotate-180 text-white' : ''}`} />
                                </button>
                                {openReportSection === section.title && (
                                    <div className="p-8 bg-black/40 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-6 shadow-inner">
                                            {section.fields.map(f => {
                                                if (f.type === 'header') {
                                                    return (
                                                        <div key={f.field} className="md:col-span-2 pt-6 pb-2 border-b border-gray-800 mb-2">
                                                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={f.field} className={`flex flex-col py-3 border-b border-gray-800/50 last:border-0 ${f.colSpan ? 'md:col-span-2' : ''}`}>
                                                        <label className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${f.highlight ? 'text-blue-400' : 'text-gray-500'}`}>{f.label}</label>
                                                        {f.type === 'number' ? <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-300' : ''} /> : <ReportInput field={f.field} className={f.highlight ? 'text-blue-300' : ''} />}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-gray-950 border-t border-gray-800 text-center"><p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">This is a system generated document and does not require to be signed.</p></div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="bg-gray-900/50 backdrop-blur-md p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 shadow-inner group transition-transform hover:scale-105">
                        <BuildingOfficeIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">{companyName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-blue-400/80"><BriefcaseIcon className="w-3.5 h-3.5" /> TYPE 2 WORKFLOW (BANK + INVOICE)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50">
                        <RefreshIcon className="w-4 h-4 mr-2" /> Start Over
                    </button>
                </div>
            </div>

            <Stepper currentStep={currentStep} />

            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2Summarization()}
            {currentStep === 3 && renderStep3UploadInvoices()}
            {currentStep === 4 && renderStep4InvoiceSummarization()}
            {currentStep === 5 && renderStep5BankReconciliation()}
            {currentStep === 6 && renderStep6VatAdditionalDocs()}
            {currentStep === 7 && renderStep7OpeningBalances()}
            {currentStep === 8 && renderStep8AdjustTrialBalance()}
            {currentStep === 9 && renderStep9FinalReport()}

            {showVatFlowModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
                        <h3 className="font-bold mb-4 text-white text-center">{vatFlowQuestion === 1 ? 'VAT 201 Certificates Available?' : 'Sales/Purchase Ledgers Available?'}</h3>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleVatFlowAnswer(false)} className="px-6 py-2 border border-gray-700 rounded-lg text-white font-semibold hover:bg-gray-800 transition-colors uppercase text-xs">No</button>
                            <button onClick={() => handleVatFlowAnswer(true)} className="px-6 py-2 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-500 transition-colors uppercase text-xs">Yes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Add Account Modal */}
            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleGlobalAddAccount}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Main Category</label>
                                    <select
                                        value={newGlobalAccountMain}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNewGlobalAccountMain(val);
                                            setNewGlobalAccountChild('');
                                        }}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        required
                                    >
                                        <option value="Assets">Assets</option>
                                        <option value="Liabilities">Liabilities</option>
                                        <option value="Equity">Equity</option>
                                        <option value="Income">Income</option>
                                        <option value="Expenses">Expenses</option>
                                    </select>
                                </div>

                                {subCategoryOptions.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Child Category</label>
                                        <select
                                            value={newGlobalAccountChild}
                                            onChange={(e) => setNewGlobalAccountChild(e.target.value)}
                                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                            required
                                        >
                                            <option value="" disabled>Select Child Category...</option>
                                            {subCategoryOptions.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Account Name</label>
                                    <input
                                        type="text"
                                        value={newGlobalAccountName}
                                        onChange={(e) => setNewGlobalAccountName(e.target.value)}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="e.g. Project Development Fees"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-gray-800/50 border-t border-gray-800 flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowGlobalAddAccountModal(false)}
                                    className="px-5 py-2 text-sm text-gray-400 hover:text-white font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl shadow-lg transition-all"
                                >
                                    Add Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
