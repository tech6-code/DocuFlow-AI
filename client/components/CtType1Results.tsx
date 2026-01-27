import type { WorkingNoteEntry } from '../types';
import { createPortal } from 'react-dom';
import {
    AdjustmentsIcon,
    ArrowDownIcon,
    ArrowPathIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    ArrowUpRightIcon,
    AssetIcon,
    BanknotesIcon,
    BriefcaseIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    ChartPieIcon,
    CheckIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClipboardCheckIcon,
    ClockIcon,
    DocumentArrowDownIcon,
    DocumentDuplicateIcon,
    DocumentTextIcon,
    EquityIcon,
    ExclamationTriangleIcon,
    ExpenseIcon,
    EyeIcon,
    FunnelIcon,
    IdentificationIcon,
    IncomeIcon,
    InformationCircleIcon,
    LightBulbIcon,
    ListBulletIcon,
    MagnifyingGlassIcon,
    PencilIcon,
    PlusIcon,
    QuestionMarkCircleIcon,
    RefreshIcon,
    ScaleIcon,
    ShieldCheckIcon,
    SparklesIcon,
    TrashIcon,
    UserCircleIcon,
    XMarkIcon
} from './icons';
import {
    CtType1Step1,
    CtType1Step2,
    CtType1Step3,
    CtType1Step4,
    CtType1Step5,
    CtType1Step6,
    CtType1Step7,
    CtType1Step8,
    CtType1Step9,
    CtType1Step10,
    CtType1Step11
} from './ct-steps/index';
import {
    formatDecimalNumber,
    formatWholeNumber,
    getChildCategory,
    formatDate,
    getQuarter,
    parseDateString,
    getChildByValue,
    Stepper,
    ResultsStatCard,
    CategoryDropdown,
    resolveCategoryPath,
    applySheetStyling,
    CT_QUESTIONS,
    REPORT_STRUCTURE
} from './ct-steps/CtType1Shared';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Transaction, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, BankStatementSummary, Company } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { FileUploadArea } from './VatFilingUpload';
import { extractGenericDetailsFromDocuments, extractVat201Totals, CHART_OF_ACCOUNTS, categorizeTransactionsByCoA } from '../services/geminiService';
import { ProfitAndLossStep, PNL_ITEMS } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS } from './BalanceSheetStep';
import type { Part } from '@google/genai';

// This tells TypeScript that XLSX and pdfjsLib will be available on the window object
declare const XLSX: any;

interface CtType1ResultsProps {
    transactions: Transaction[];
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
    previewUrls: string[];
    company: Company | null;
    fileSummaries?: Record<string, BankStatementSummary>;
    statementFiles?: File[];
}

interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

const ResultsHeader: React.FC<{
    title: string,
    onExport: () => void,
    onReset: () => void,
    onEditCategoriesClick?: () => void,
    isExportDisabled?: boolean
}> = ({ title, onExport, onReset, onEditCategoriesClick, isExportDisabled }) => (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-white">{title} Results</h2>
            <p className="text-sm text-gray-400">Processing complete.</p>
        </div>
        <div className="flex items-center flex-wrap justify-center gap-3">
            {onEditCategoriesClick && (
                <button onClick={onEditCategoriesClick} className="flex items-center px-4 py-2 bg-gray-200 text-black font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm shadow-sm">
                    <PencilIcon className="w-5 h-5 mr-2" /> Edit Categories
                </button>
            )}
            <button
                onClick={onExport}
                disabled={isExportDisabled}
                className="flex items-center px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm disabled:opacity-50 disabled:grayscale"
            >
                <DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Export All
            </button>
            <button onClick={onReset} className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm">
                <RefreshIcon className="w-5 h-5 mr-2" /> Start Over
            </button>
        </div>
    </div>
);

// Shared components (ResultsStatCard, CategoryDropdown, Stepper) are imported from ./ct-steps/CtType1Shared



// Utility functions (parseDateString, etc.) are imported from ./ct-steps/CtType1Shared

const getStatementDateRange = (sourceFile: string, summary: any, transactions: Transaction[]) => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (summary?.statementPeriod) {
        const parts = summary.statementPeriod.split(/\s+to\s+|\s+-\s+/);
        if (parts.length === 2) {
            startDate = parseDateString(parts[0]);
            endDate = parseDateString(parts[1]);
        }
    }

    if (!startDate || !endDate) {
        const fileTxs = transactions.filter(t => t.sourceFile === sourceFile);
        if (fileTxs.length > 0) {
            const dates = fileTxs.map(t => parseDateString(t.date)).filter((d): d is Date => d !== null);
            if (dates.length > 0) {
                if (!startDate) startDate = new Date(Math.min(...dates.map(d => d.getTime())));
                if (!endDate) endDate = new Date(Math.max(...dates.map(d => d.getTime())));
            }
        }
    }

    return { startDate, endDate };
};


const renderReportField = (fieldValue: any) => {
    if (!fieldValue) return '';
    if (typeof fieldValue === 'object') {
        return JSON.stringify(fieldValue, null, 2);
    }
    return String(fieldValue);
};







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

const fileToGenerativeParts = async (file: File): Promise<Part[]> => {
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const parts: Part[] = [];

        // Limit to first 3 pages as VAT 201 totals are usually on page 1 or 2
        const pagesToProcess = Math.min(pdf.numPages, 3);

        for (let i = 1; i <= pagesToProcess; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            if (context) await page.render({ canvasContext: context, viewport }).promise;
            parts.push({
                inlineData: {
                    data: canvas.toDataURL('image/jpeg', 0.8).split(',')[1],
                    mimeType: 'image/jpeg'
                }
            });
        }
        return parts;
    }
    const data = await compressImage(file);
    return [{ inlineData: { data, mimeType: 'image/jpeg' } }];
};

const generateFilePreviews = async (file: File): Promise<string[]> => {
    const urls: string[] = [];
    if (file.type === 'application/pdf') {
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
    } else {
        urls.push(URL.createObjectURL(file));
    }
    return urls;
}

export const CtType1Results: React.FC<CtType1ResultsProps> = ({
    transactions,
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
    previewUrls: globalPreviewUrls,
    company,
    fileSummaries,
    statementFiles
}) => {

    const [currentStep, setCurrentStep] = useState(1); // ALWAYS start at step 1 for review
    const [editedTransactions, setEditedTransactions] = useState<Transaction[]>([]);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(initialAccountData);

    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [isExtracting, setIsExtracting] = useState(false);
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);
    const [louFiles, setLouFiles] = useState<File[]>([]);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);

    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [selectedFileFilter, setSelectedFileFilter] = useState<string>('ALL');
    const [summaryFileFilter, setSummaryFileFilter] = useState<string>('ALL'); // For Summarization Step
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [findText, setFindText] = useState('');
    const [replaceCategory, setReplaceCategory] = useState('');
    const [bulkCategory, setBulkCategory] = useState('');

    const [customCategories, setCustomCategories] = useState<string[]>([]);
    const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
    const [newCategoryMain, setNewCategoryMain] = useState('');
    const [newCategorySub, setNewCategorySub] = useState('');
    const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

    const [pendingCategoryContext, setPendingCategoryContext] = useState<{
        type: 'row' | 'bulk' | 'replace' | 'filter';
        rowIndex?: number;
    } | null>(null);

    const [filePreviews, setFilePreviews] = useState<Record<string, string[]>>({});
    const [previewPage, setPreviewPage] = useState(0);
    const [showPreviewPanel, setShowPreviewPanel] = useState(true);

    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [customRows, setCustomRows] = useState<{ parent: string, label: string }[]>([]);
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('');
    const [newGlobalAccountChild, setNewGlobalAccountChild] = useState('');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');

    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});

    // Dynamic Structure State
    const [pnlStructure, setPnlStructure] = useState<typeof PNL_ITEMS>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<typeof BS_ITEMS>(BS_ITEMS);

    // Working Notes State
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});

    // VAT Workflow Conditional Logic States
    const [showVatFlowModal, setShowVatFlowModal] = useState(false);
    const [vatFlowQuestion, setVatFlowQuestion] = useState<1 | 2>(1);

    // Working Notes / Breakdowns State
    const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownEntry[]>>({});
    const [workingNoteModalOpen, setWorkingNoteModalOpen] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);
    const [tempBreakdown, setTempBreakdown] = useState<BreakdownEntry[]>([]);

    // Questionnaire State
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});

    // Final Report Editable Form State
    const [reportForm, setReportForm] = useState<any>({});

    // Keep editedTransactions in sync with prop transactions on initial load and updates (Only when transactions prop changes)
    // CHANGED: Removed customCategories dependency to prevent global reset when adding a category
    useEffect(() => {
        const normalized = transactions.map(t => ({
            ...t,
            category: resolveCategoryPath(t.category, customCategories)
        }));
        setEditedTransactions(normalized);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transactions]);

    // NEW: When customCategories change (e.g. Discovery or User Add), intelligently update editedTransactions
    // This preserves manual edits while "recovering" previously invalid custom categories from source props
    useEffect(() => {
        setEditedTransactions(prev => {
            return prev.map((t, index) => {
                // 1. Try to resolve the CURRENT user-edited value
                const currentResolved = resolveCategoryPath(t.category, customCategories);
                if (currentResolved !== 'UNCATEGORIZED') {
                    return { ...t, category: currentResolved };
                }

                // 2. If current is invalid/Uncategorized, check if the ORIGINAL prop had a value that is NOW valid (Discovery case)
                // This recovers categories that were "Uncategorized" on load but are now known custom categories
                const originalProp = transactions[index];
                if (originalProp) {
                    const originalResolved = resolveCategoryPath(originalProp.category, customCategories);
                    if (originalResolved !== 'UNCATEGORIZED') {
                        return { ...t, category: originalResolved };
                    }
                }

                return t;
            });
        });
    }, [customCategories, transactions]);

    // NEW: Initialize custom categories from incoming transactions to prevent them from becoming UNCATEGORIZED
    useEffect(() => {
        if (transactions.length > 0) {
            const potentialCustom = new Set<string>();
            transactions.forEach(t => {
                if (t.category && t.category.includes('|')) {
                    // Check if it resolves with EMPTY custom categories (meaning it's in CoA)
                    // If it resolves to UNCATEGORIZED with empty custom cats, it must be a custom one we need to preserve
                    const isStandard = resolveCategoryPath(t.category, []) !== 'UNCATEGORIZED';
                    if (!isStandard) {
                        potentialCustom.add(t.category);
                    }
                }
            });

            if (potentialCustom.size > 0) {
                setCustomCategories(prev => {
                    const next = new Set([...prev, ...potentialCustom]);
                    return Array.from(next);
                });
            }
        }
    }, [transactions]);

    // Debug: Log editedTransactions whenever it updates
    useEffect(() => {
        // Log updated length for internal tracking if needed, otherwise skip
    }, [editedTransactions]);

    useEffect(() => {
        const generate = async () => {
            const previews: Record<string, string[]> = {};
            if (statementFiles && statementFiles.length > 0) {
                // console.log("Generating previews for", statementFiles.length, "files for CtType1Results component"); // Removed diagnostic log
                for (const file of statementFiles) {
                    try {
                        const urls = await generateFilePreviews(file);
                        previews[file.name] = urls;
                    } catch (e) {
                        console.error(`Failed to generate preview for ${file.name}`, e);
                    }
                }
            }
            setFilePreviews(previews);
        };
        generate();
    }, [statementFiles]);

    // Reset preview page when file selection changes
    useEffect(() => {
        setPreviewPage(0);
    }, [selectedFileFilter]);

    const structure = [
        { type: 'header', label: 'Assets' },
        { type: 'subheader', label: 'Current Assets' },
        { type: 'row', label: 'Cash on Hand' },
        { type: 'row', label: 'Bank Accounts' },
        { type: 'row', label: 'Accounts Receivable' },
        { type: 'row', label: 'Due from related Parties' },
        { type: 'row', label: 'Advances to Suppliers' },
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
        { type: 'row', label: 'Current Year Profit/Loss' },
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

    const categoriesMap = useMemo(() => {
        const groups: Record<string, string[]> = {};
        let currentHeader = '';
        structure.forEach(item => {
            if (item.type === 'header') {
                currentHeader = item.label;
                groups[currentHeader] = [];
            } else if (item.type === 'subheader' && currentHeader) {
                groups[currentHeader].push(item.label);
            }
        });
        return groups;
    }, [structure]);


    // Lifted Form Data Logic for FTA Report - Enhanced to match granular screenshot details
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
        const corporateTaxLiability = taxableIncome > threshold ? Math.round((taxableIncome - threshold) * 0.09) : 0;

        // SBR Logic: Use explicit Question 6 answer ("Yes" means relief claimed)
        const isReliefClaimed = questionnaireAnswers[6] === 'Yes';

        if (isReliefClaimed) {
            return {
                operatingRevenue: 0, derivingRevenueExpenses: 0, grossProfit: 0,
                salaries: 0, depreciation: 0, fines: 0, donations: 0, entertainment: 0, otherExpenses: 0, nonOpExpensesExcl: 0,
                dividendsReceived: 0, otherNonOpRevenue: 0,
                interestIncome: 0, interestExpense: 0, netInterest: 0,
                gainAssetDisposal: 0, lossAssetDisposal: 0, netGainsAsset: 0,
                forexGain: 0, forexLoss: 0, netForex: 0,
                netProfit: 0,
                ociIncomeNoRec: 0, ociLossNoRec: 0, ociIncomeRec: 0, ociLossRec: 0, ociOtherIncome: 0, ociOtherLoss: 0, totalComprehensiveIncome: 0,
                totalCurrentAssets: 0, ppe: 0, intangibleAssets: 0, financialAssets: 0, otherNonCurrentAssets: 0, totalNonCurrentAssets: 0, totalAssets: 0,
                totalCurrentLiabilities: 0, totalNonCurrentLiabilities: 0, totalLiabilities: 0,
                shareCapital: 0, retainedEarnings: 0, otherEquity: 0, totalEquity: 0, totalEquityLiabilities: 0,
                taxableIncome: 0, corporateTaxLiability: 0,
                actualOperatingRevenue: operatingRevenue
            };
        }

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
            taxableIncome, corporateTaxLiability,
            actualOperatingRevenue: operatingRevenue
        };
    }, [adjustedTrialBalance, questionnaireAnswers]);

    // Initialize reportForm when ftaFormValues change
    useEffect(() => {
        if (ftaFormValues) {
            setPnlValues(prev => {
                // Only populate if empty to avoid overwriting user edits, 
                // OR logically sync if we want it always tied. For now, let's pre-fill once.
                if (Object.keys(prev).length > 0) return prev;

                return {
                    revenue: { currentYear: ftaFormValues.operatingRevenue, previousYear: 0 },
                    cost_of_revenue: { currentYear: ftaFormValues.derivingRevenueExpenses, previousYear: 0 },
                    gross_profit: { currentYear: ftaFormValues.grossProfit, previousYear: 0 },
                    other_income: { currentYear: ftaFormValues.otherNonOpRevenue + ftaFormValues.dividendsReceived + ftaFormValues.interestIncome + ftaFormValues.gainAssetDisposal + ftaFormValues.forexGain, previousYear: 0 },
                    administrative_expenses: { currentYear: ftaFormValues.salaries + ftaFormValues.depreciation + ftaFormValues.otherExpenses, previousYear: 0 },

                    unrealised_gain_loss_fvtpl: { currentYear: 0, previousYear: 0 },
                    share_profits_associates: { currentYear: 0, previousYear: 0 },
                    gain_loss_revaluation_property: { currentYear: 0, previousYear: 0 },
                    impairment_losses_ppe: { currentYear: 0, previousYear: 0 },
                    impairment_losses_intangible: { currentYear: 0, previousYear: 0 },
                    business_promotion_selling: { currentYear: ftaFormValues.entertainment, previousYear: 0 },
                    foreign_exchange_loss: { currentYear: ftaFormValues.forexLoss, previousYear: 0 },
                    selling_distribution_expenses: { currentYear: 0, previousYear: 0 },
                    finance_costs: { currentYear: ftaFormValues.interestExpense, previousYear: 0 },
                    depreciation_ppe: { currentYear: ftaFormValues.depreciation, previousYear: 0 },
                    profit_loss_year: { currentYear: ftaFormValues.netProfit, previousYear: 0 },

                    provisions_corporate_tax: { currentYear: ftaFormValues.corporateTaxLiability, previousYear: 0 },
                    profit_after_tax: { currentYear: ftaFormValues.netProfit - ftaFormValues.corporateTaxLiability, previousYear: 0 }
                };
            });

            setBalanceSheetValues(prev => {
                if (Object.keys(prev).length > 0) return prev;

                return {
                    // Assets
                    property_plant_equipment: { currentYear: ftaFormValues.ppe, previousYear: 0 },
                    intangible_assets: { currentYear: ftaFormValues.intangibleAssets, previousYear: 0 },
                    long_term_investments: { currentYear: ftaFormValues.financialAssets, previousYear: 0 },
                    total_non_current_assets: { currentYear: ftaFormValues.totalNonCurrentAssets, previousYear: 0 },

                    cash_bank_balances: { currentYear: ftaFormValues.cashBankBalances || 0, previousYear: 0 },
                    inventories: { currentYear: ftaFormValues.inventories || 0, previousYear: 0 },
                    trade_receivables: { currentYear: ftaFormValues.tradeReceivables || 0, previousYear: 0 },
                    advances_deposits_receivables: { currentYear: ftaFormValues.otherCurrentAssets || 0, previousYear: 0 },
                    related_party_transactions_assets: { currentYear: 0, previousYear: 0 },
                    total_current_assets: { currentYear: ftaFormValues.totalCurrentAssets, previousYear: 0 },

                    total_assets: { currentYear: ftaFormValues.totalAssets, previousYear: 0 },

                    // Equity
                    share_capital: { currentYear: ftaFormValues.shareCapital, previousYear: 0 },
                    statutory_reserve: { currentYear: 0, previousYear: 0 },
                    retained_earnings: { currentYear: ftaFormValues.retainedEarnings, previousYear: 0 },
                    shareholders_current_accounts: { currentYear: ftaFormValues.otherEquity, previousYear: 0 },
                    total_equity: { currentYear: ftaFormValues.totalEquity, previousYear: 0 },

                    // Liabilities
                    employees_end_service_benefits: { currentYear: 0, previousYear: 0 },
                    bank_borrowings_non_current: { currentYear: ftaFormValues.totalNonCurrentLiabilities, previousYear: 0 },
                    total_non_current_liabilities: { currentYear: ftaFormValues.totalNonCurrentLiabilities, previousYear: 0 },

                    short_term_borrowings: { currentYear: 0, previousYear: 0 },
                    related_party_transactions_liabilities: { currentYear: 0, previousYear: 0 },
                    trade_other_payables: { currentYear: ftaFormValues.totalCurrentLiabilities, previousYear: 0 },
                    total_current_liabilities: { currentYear: ftaFormValues.totalCurrentLiabilities, previousYear: 0 },

                    total_liabilities: { currentYear: ftaFormValues.totalLiabilities, previousYear: 0 },
                    total_equity_liabilities: { currentYear: ftaFormValues.totalEquityLiabilities, previousYear: 0 }
                };
            });

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
                adjInterestExp: ftaFormValues.netInterest,
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

    // --- Computed Values for Live UI ---
    const computedValues = useMemo(() => {
        const pnl = { ...pnlValues };
        const bs = { ...balanceSheetValues };

        // P&L Calculations
        const rev = pnl['revenue']?.currentYear || 0;
        const cor = pnl['cost_of_revenue']?.currentYear || 0;
        const gp = rev - cor;

        const otherInc = (pnl['other_income']?.currentYear || 0) +
            (pnl['unrealised_gain_loss_fvtpl']?.currentYear || 0) +
            (pnl['share_profits_associates']?.currentYear || 0) +
            (pnl['gain_loss_revaluation_property']?.currentYear || 0);

        const expenses = (pnl['business_promotion_selling']?.currentYear || 0) +
            (pnl['foreign_exchange_loss']?.currentYear || 0) +
            (pnl['selling_distribution_expenses']?.currentYear || 0) +
            (pnl['administrative_expenses']?.currentYear || 0) +
            (pnl['finance_costs']?.currentYear || 0) +
            (pnl['depreciation_ppe']?.currentYear || 0) +
            (pnl['impairment_losses_ppe']?.currentYear || 0) +
            (pnl['impairment_losses_intangible']?.currentYear || 0);

        const netProfit = gp + otherInc - expenses;
        const provTax = pnl['provisions_corporate_tax']?.currentYear || 0;
        const profAfterTax = netProfit - provTax;

        // Balance Sheet Calculations
        const nca = (bs['property_plant_equipment']?.currentYear || 0) +
            (bs['intangible_assets']?.currentYear || 0) +
            (bs['long_term_investments']?.currentYear || 0);

        const ca = (bs['cash_bank_balances']?.currentYear || 0) +
            (bs['inventories']?.currentYear || 0) +
            (bs['trade_receivables']?.currentYear || 0) +
            (bs['advances_deposits_receivables']?.currentYear || 0) +
            (bs['related_party_transactions_assets']?.currentYear || 0);

        const totalAssets = nca + ca;

        const equity = (bs['share_capital']?.currentYear || 0) +
            (bs['statutory_reserve']?.currentYear || 0) +
            (bs['retained_earnings']?.currentYear || 100) + // Mock/Init fallback
            (bs['shareholders_current_accounts']?.currentYear || 0);

        const ncl = (bs['employees_end_service_benefits']?.currentYear || 0) +
            (bs['bank_borrowings_non_current']?.currentYear || 0);

        const cl = (bs['short_term_borrowings']?.currentYear || 0) +
            (bs['related_party_transactions_liabilities']?.currentYear || 0) +
            (bs['trade_other_payables']?.currentYear || 0);

        const totalLiabilities = ncl + cl;
        const totalEqLiab = equity + totalLiabilities;

        // Apply back to computed objects
        pnl['gross_profit'] = { currentYear: gp, previousYear: pnl['gross_profit']?.previousYear || 0 };
        pnl['profit_loss_year'] = { currentYear: netProfit, previousYear: pnl['profit_loss_year']?.previousYear || 0 };
        pnl['profit_after_tax'] = { currentYear: profAfterTax, previousYear: pnl['profit_after_tax']?.previousYear || 0 };

        bs['total_non_current_assets'] = { currentYear: nca, previousYear: bs['total_non_current_assets']?.previousYear || 0 };
        bs['total_current_assets'] = { currentYear: ca, previousYear: bs['total_current_assets']?.previousYear || 0 };
        bs['total_assets'] = { currentYear: totalAssets, previousYear: bs['total_assets']?.previousYear || 0 };
        bs['total_equity'] = { currentYear: equity, previousYear: bs['total_equity']?.previousYear || 0 };
        bs['total_non_current_liabilities'] = { currentYear: ncl, previousYear: bs['total_non_current_liabilities']?.previousYear || 0 };
        bs['total_current_liabilities'] = { currentYear: cl, previousYear: bs['total_current_liabilities']?.previousYear || 0 };
        bs['total_liabilities'] = { currentYear: totalLiabilities, previousYear: bs['total_liabilities']?.previousYear || 0 };
        bs['total_equity_liabilities'] = { currentYear: totalEqLiab, previousYear: bs['total_equity_liabilities']?.previousYear || 0 };

        return { pnl, bs };
    }, [pnlValues, balanceSheetValues]);

    const vatStepData = useMemo(() => {
        const fileResults = additionalDetails.vatFileResults || [];
        const quarters = {
            'Q1': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' },
            'Q2': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' },
            'Q3': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' },
            'Q4': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' }
        };

        fileResults.forEach((res: any) => {
            const q = getQuarter(res.periodFrom) as keyof typeof quarters;
            if (quarters[q]) {
                quarters[q].hasData = true;
                // Capture first seen dates for the quarter
                if (!quarters[q].startDate) quarters[q].startDate = res.periodFrom;
                if (!quarters[q].endDate) quarters[q].endDate = res.periodTo;

                quarters[q].sales.zero += (res.sales?.zeroRated || 0);
                quarters[q].sales.tv += (res.sales?.standardRated || 0);
                quarters[q].sales.vat += (res.sales?.vatAmount || 0);
                quarters[q].purchases.zero += (res.purchases?.zeroRated || 0);
                quarters[q].purchases.tv += (res.purchases?.standardRated || 0);
                quarters[q].purchases.vat += (res.purchases?.vatAmount || 0);
            }
        });

        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
        quarterKeys.forEach((q) => {
            const adj = vatManualAdjustments[q] || {};
            const qData = quarters[q as keyof typeof quarters];

            if (adj.salesZero !== undefined) qData.sales.zero = parseFloat(adj.salesZero) || 0;
            if (adj.salesTv !== undefined) qData.sales.tv = parseFloat(adj.salesTv) || 0;
            if (adj.salesVat !== undefined) qData.sales.vat = parseFloat(adj.salesVat) || 0;

            if (adj.purchasesZero !== undefined) qData.purchases.zero = parseFloat(adj.purchasesZero) || 0;
            if (adj.purchasesTv !== undefined) qData.purchases.tv = parseFloat(adj.purchasesTv) || 0;
            if (adj.purchasesVat !== undefined) qData.purchases.vat = parseFloat(adj.purchasesVat) || 0;

            qData.sales.total = qData.sales.zero + qData.sales.tv + qData.sales.vat;
            qData.purchases.total = qData.purchases.zero + qData.purchases.tv + qData.purchases.vat;
            qData.net = qData.sales.vat - qData.purchases.vat;
        });

        const grandTotals = quarterKeys.reduce((acc, q) => {
            const data = quarters[q as keyof typeof quarters];
            return {
                sales: {
                    zero: acc.sales.zero + data.sales.zero,
                    tv: acc.sales.tv + data.sales.tv,
                    vat: acc.sales.vat + data.sales.vat,
                    total: acc.sales.total + data.sales.total
                },
                purchases: {
                    zero: acc.purchases.zero + data.purchases.zero,
                    tv: acc.purchases.tv + data.purchases.tv,
                    vat: acc.purchases.vat + data.purchases.vat,
                    total: acc.purchases.total + data.purchases.total
                },
                net: acc.net + data.net
            };
        }, { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0 });

        return { quarters, grandTotals };
    }, [additionalDetails.vatFileResults, vatManualAdjustments]);

    const bankVatData = useMemo(() => {
        const quarters = {
            'Q1': { sales: 0, purchases: 0 },
            'Q2': { sales: 0, purchases: 0 },
            'Q3': { sales: 0, purchases: 0 },
            'Q4': { sales: 0, purchases: 0 }
        };

        editedTransactions.forEach(t => {
            const q = getQuarter(t.date) as keyof typeof quarters;
            if (quarters[q]) {
                const category = t.category || '';
                const isSales = category.startsWith('Income');
                const isPurchases = category.startsWith('Expenses');

                if (isSales) {
                    quarters[q].sales += (t.credit || 0) - (t.debit || 0); // Income is typically credit
                } else if (isPurchases) {
                    quarters[q].purchases += (t.debit || 0) - (t.credit || 0); // Expenses are typically debit
                }
            }
        });

        const grandTotals = Object.values(quarters).reduce((acc, q) => {
            return {
                sales: acc.sales + q.sales,
                purchases: acc.purchases + q.purchases
            };
        }, { sales: 0, purchases: 0 });

        return { quarters, grandTotals };
    }, [editedTransactions]);

    const getVatExportRows = useCallback((vatData: any) => {
        const { quarters, grandTotals } = vatData;
        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
        const rows: any[] = [];
        // headers
        rows.push(["", "SALES (OUTPUTS)", "", "", "", "PURCHASES (INPUTS)", "", "", "", "VAT LIABILITY/(REFUND)"]);
        rows.push(["PERIOD", "ZERO RATED", "STANDARD", "VAT", "TOTAL", "PERIOD", "ZERO RATED", "STANDARD", "VAT", "TOTAL", ""]);

        quarterKeys.forEach(q => {
            const data = quarters[q as keyof typeof quarters];
            rows.push([
                q, data.sales.zero, data.sales.tv, data.sales.vat, data.sales.total,
                q, data.purchases.zero, data.purchases.tv, data.purchases.vat, data.purchases.total,
                data.net
            ]);
        });

        // Totals row
        rows.push([
            "GRAND TOTAL", grandTotals.sales.zero, grandTotals.sales.tv, grandTotals.sales.vat, grandTotals.sales.total,
            "GRAND TOTAL", grandTotals.purchases.zero, grandTotals.purchases.tv, grandTotals.purchases.vat, grandTotals.purchases.total,
            grandTotals.net
        ]);
        return rows;
    }, []);

    useEffect(() => {
        if (auditReport && !isGeneratingAuditReport && currentStep === 5) {
            setCurrentStep(7); // Jump to report if already generated (adjusting for new step)
        }
    }, [auditReport, isGeneratingAuditReport, currentStep]);

    const handleBack = () => {
        if (currentStep === 4) {
            setCurrentStep(3);
        } else if (currentStep === 3) {
            setCurrentStep(2);
        } else if (currentStep === 5) {
            // If we came from VAT flow, go to Step 4, otherwise go to Step 2
            if (additionalFiles.length > 0) {
                setCurrentStep(4);
            } else {
                setCurrentStep(2);
            }
        } else {
            setCurrentStep(prev => Math.max(1, prev - 1));
        }
    };

    const handleDeleteTransaction = (index: number) => {
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
    };

    const handleBulkDelete = () => {
        if (selectedIndices.size === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIndices.size} transactions?`)) {
            setEditedTransactions(prev => prev.filter((_, i) => !selectedIndices.has(i)));
            setSelectedIndices(new Set());
        }
    };

    const handleCategorySelection = (
        value: string,
        context: { type: 'row' | 'bulk' | 'replace' | 'filter', rowIndex?: number },
        overrideCustomCategories?: string[]
    ) => {
        const catsToUse = overrideCustomCategories || customCategories;

        if (value === '__NEW__') {
            setPendingCategoryContext(context);
            setNewCategoryMain('');
            setNewCategorySub('');
            setNewCategoryError(null);
            setShowAddCategoryModal(true);
        } else {
            if (context.type === 'row' && context.rowIndex !== undefined) {
                setEditedTransactions(prev => {
                    const updated = [...prev];
                    updated[context.rowIndex!] = { ...updated[context.rowIndex!], category: resolveCategoryPath(value, catsToUse) };
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
    };

    const handleSaveNewCategory = (e: React.FormEvent) => {
        e.preventDefault();
        setNewCategoryError(null);

        if (!newCategoryMain || !newCategorySub.trim()) {
            setNewCategoryError("Please select a main category and enter a sub-category name.");
            return;
        }

        const formattedName = `${newCategoryMain} | ${newCategorySub.trim()}`;

        if (customCategories.includes(formattedName)) {
            setNewCategoryError("This category already exists.");
            return;
        }

        const existingDefault = CHART_OF_ACCOUNTS[newCategoryMain as keyof typeof CHART_OF_ACCOUNTS];
        if (existingDefault) {
            if (Array.isArray(existingDefault)) {
                if (existingDefault.some(sub => sub.toLowerCase() === newCategorySub.trim().toLowerCase())) {
                    setNewCategoryError("This category already exists in standard accounts.");
                    return;
                }
            }
        }

        const newCustomCategories = [...customCategories, formattedName];
        setCustomCategories(newCustomCategories);

        if (pendingCategoryContext) {
            handleCategorySelection(formattedName, pendingCategoryContext, newCustomCategories);
        }
        setShowAddCategoryModal(false);
        setPendingCategoryContext(null);
        setNewCategoryError(null);
    };

    const handleAutoCategorize = async () => {
        if (editedTransactions.length === 0) return;
        setIsAutoCategorizing(true);
        try {
            const categorized = await categorizeTransactionsByCoA(editedTransactions) as Transaction[];
            const normalized = categorized.map(t => ({
                ...t,
                category: resolveCategoryPath(t.category || 'UNCATEGORIZED', customCategories)
            }));
            setEditedTransactions(normalized);
        } catch (e) {
            console.error("Auto categorization failed:", e);
            alert("Failed to auto-categorize transactions. Please check your network and try again.");
        } finally {
            setIsAutoCategorizing(false);
        }
    };

    const handleConfirmCategories = () => {
        const uncategorizedCount = editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length;
        if (uncategorizedCount > 0) {
            alert(`Please categorize all ${uncategorizedCount} transactions before continuing.`);
            return;
        }

        onUpdateTransactions(editedTransactions);
        onGenerateTrialBalance(editedTransactions);
        setCurrentStep(2); // Go to Summarization
    };

    const handleSummarizationContinue = () => {
        setVatFlowQuestion(1);
        setShowVatFlowModal(true);
    };

    const handleVatFlowAnswer = (answer: boolean) => {
        if (vatFlowQuestion === 1) {
            if (answer) {
                setShowVatFlowModal(false);
                setCurrentStep(3); // To VAT Docs Upload
            } else {
                setVatFlowQuestion(2);
            }
        } else {
            if (answer) {
                setShowVatFlowModal(false);
                setCurrentStep(3); // To VAT Docs Upload
            } else {
                setShowVatFlowModal(false);
                setCurrentStep(5); // To Opening Balances (Skip Step 3 & 4)
            }
        }
    };

    const handleExtractAdditionalData = async () => {
        if (additionalFiles.length === 0) return;
        setIsExtracting(true);
        try {
            const results = await Promise.all(additionalFiles.map(async (file) => {
                const parts = await fileToGenerativeParts(file);
                // Extract per-file detailed VAT data
                const details = await extractVat201Totals(parts as any) as any;

                if (!details || (details.sales?.total === 0 && details.purchases?.total === 0 && details.netVatPayable === 0)) {
                    console.warn(`Extraction returned empty/null for ${file.name}`);
                }

                return {
                    fileName: file.name,
                    periodFrom: details.periodFrom,
                    periodTo: details.periodTo,
                    sales: {
                        zeroRated: details.sales?.zeroRated || 0,
                        standardRated: details.sales?.standardRated || 0,
                        vatAmount: details.sales?.vatAmount || 0,
                        total: details.sales?.total || 0
                    },
                    purchases: {
                        zeroRated: details.purchases?.zeroRated || 0,
                        standardRated: details.purchases?.standardRated || 0,
                        vatAmount: details.purchases?.vatAmount || 0,
                        total: details.purchases?.total || 0
                    },
                    netVatPayable: details.netVatPayable || 0
                };
            }));

            // Check if any significant data was extracted
            const anyData = results.some(r => r.sales.total > 0 || r.purchases.total > 0 || r.netVatPayable !== 0);
            if (!anyData) {
                alert("We couldn't extract any significant VAT data from the uploaded files. Please ensure they are valid VAT 201 returns and try again.");
                setIsExtracting(false);
                return;
            }

            setAdditionalDetails({ vatFileResults: results });
            setCurrentStep(4); // Automatically move to VAT Summarization on success
        } catch (e: any) {
            console.error("Failed to extract per-file VAT totals", e);
            alert(`VAT extraction failed: ${e.message || "Unknown error"}. Please try again.`);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleExtractOpeningBalances = async () => {
        if (openingBalanceFiles.length === 0) return;
        setIsExtractingOpeningBalances(true);
        try {
            const partsArray = await Promise.all(openingBalanceFiles.map(file => fileToGenerativeParts(file)));
            const allParts = partsArray.flat();
            const details = await extractGenericDetailsFromDocuments(allParts);

            if (details) {
                const newData = JSON.parse(JSON.stringify(openingBalancesData));
                Object.entries(details).forEach(([key, value]) => {
                    const amount = Math.round(parseFloat(String(value)) || 0);
                    if (amount === 0) return;

                    const normalizedKey = key.toLowerCase().replace(/_/g, ' ');

                    // Try to find a matching account in Assets, Liabilities, or Equity
                    let matched = false;
                    for (const category of newData) {
                        const account = category.accounts.find((acc: any) =>
                            acc.name.toLowerCase() === normalizedKey ||
                            normalizedKey.includes(acc.name.toLowerCase()) ||
                            acc.name.toLowerCase().includes(normalizedKey)
                        );

                        if (account) {
                            if (category.category === 'Assets') {
                                account.debit = amount;
                            } else {
                                account.credit = amount;
                            }
                            matched = true;
                            break;
                        }
                    }

                    // If no match found, add to "Other" subcategory in appropriate main category if possible
                    // For now we just skip if no direct match to keep it simple and safe.
                });
                setOpeningBalancesData(newData);
            }
        } catch (e) {
            console.error("Failed to extract opening balances", e);
        } finally {
            setIsExtractingOpeningBalances(false);
        }
    };

    const handleVatSummarizationContinue = () => {
        const shareCapitalKey = Object.keys(additionalDetails).find(k => k.toLowerCase().replace(/_/g, ' ').includes('share capital'));
        const shareCapitalValue = shareCapitalKey ? Math.round(parseFloat(String(additionalDetails[shareCapitalKey]))) : 0;

        if (shareCapitalValue > 0) {
            const newAccountsData = [...openingBalancesData];
            const equityCategory = newAccountsData.find(cat => cat.category === 'Equity');
            if (equityCategory) {
                let capitalAccount = equityCategory.accounts.find(acc => acc.name.toLowerCase().includes('share capital') || acc.name.toLowerCase().includes("owner's equity"));
                if (capitalAccount) {
                    capitalAccount.credit = shareCapitalValue;
                } else {
                    equityCategory.accounts.push({ name: 'Share Capital', debit: 0, credit: shareCapitalValue, isNew: true });
                }
            }
            setOpeningBalancesData(newAccountsData);
        }
        setCurrentStep(5); // To Opening Balances
    };

    const handleOpeningBalancesComplete = () => {
        // 1. Calculate actual total closing balance from bank statements
        const totalActualClosingBalance = reconciliationData.reduce((sum, r) => sum + (r.closingBalance || 0), 0);

        // 2. Map Opening Balances (Step 4)
        const obEntries: TrialBalanceEntry[] = openingBalancesData.flatMap(cat =>
            cat.accounts
                .filter(acc => acc.debit > 0 || acc.credit > 0)
                .map(acc => ({ account: acc.name, debit: acc.debit, credit: acc.credit }))
        );

        // 3. Map Summarized movements from Bank Transactions (Step 2)
        const summarizedMovements = summaryData;

        const combined: { [key: string]: { debit: number, credit: number } } = {};

        // Start with Opening Balances
        obEntries.forEach(item => {
            combined[item.account] = { debit: item.debit, credit: item.credit };
        });

        // Add Categorized Movements
        summarizedMovements.forEach(item => {
            if (combined[item.category]) {
                combined[item.category].debit += item.debit;
                combined[item.category].credit += item.credit;
            } else {
                combined[item.category] = { debit: item.debit, credit: item.credit };
            }
        });

        // 4. Set Bank Accounts to the actual total closing balance
        if (totalActualClosingBalance >= 0) {
            combined['Bank Accounts'] = { debit: totalActualClosingBalance, credit: 0 };
        } else {
            combined['Bank Accounts'] = { debit: 0, credit: Math.abs(totalActualClosingBalance) };
        }

        // 5. Final aggregate netting
        const combinedTrialBalance: TrialBalanceEntry[] = Object.entries(combined).map(([account, values]) => {
            const net = values.debit - values.credit;
            const debit = net > 0 ? Math.round(net) : 0;
            const credit = net < 0 ? Math.round(Math.abs(net)) : 0;
            return {
                account,
                debit,
                credit,
                baseDebit: debit,
                baseCredit: credit
            };
        });

        if (company?.shareCapital) {
            // Robust parsing of share capital (handles commas, currency symbols)
            const shareCapitalStr = String(company.shareCapital).replace(/,/g, '').match(/[\d.]+/)?.[0] || '0';
            const shareCapitalValue = Math.round(parseFloat(shareCapitalStr) || 0);

            if (shareCapitalValue > 0) {
                const normalize = (s: string) => s.replace(/['’]/g, "'").trim().toLowerCase();
                const targetName = normalize('Share Capital / Owner’s Equity');

                const shareCapitalIndex = combinedTrialBalance.findIndex(
                    entry => normalize(entry.account) === targetName
                );

                if (shareCapitalIndex > -1) {
                    // Update existing entry
                    combinedTrialBalance[shareCapitalIndex] = {
                        ...combinedTrialBalance[shareCapitalIndex],
                        credit: shareCapitalValue,
                        debit: 0,
                        baseDebit: 0,
                        baseCredit: shareCapitalValue
                    };
                } else {
                    // Add new entry
                    combinedTrialBalance.push({
                        account: 'Share Capital / Owner’s Equity',
                        debit: 0,
                        credit: shareCapitalValue,
                        baseDebit: 0,
                        baseCredit: shareCapitalValue
                    });
                }
            }
        }

        // Add Totals row
        const totalDebit = combinedTrialBalance.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = combinedTrialBalance.reduce((sum, item) => sum + item.credit, 0);
        combinedTrialBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });

        setAdjustedTrialBalance(combinedTrialBalance);
        setCurrentStep(6); // To Adjust TB
    };

    const handleOpenWorkingNote = (accountLabel: string) => {
        setCurrentWorkingAccount(accountLabel);
        const existing = breakdowns[accountLabel] || [];
        // Ensure at least one empty row or clone existing
        setTempBreakdown(existing.length > 0
            ? JSON.parse(JSON.stringify(existing))
            : [{ description: '', debit: 0, credit: 0 }]
        );
        setWorkingNoteModalOpen(true);
    };

    const handleSaveWorkingNote = () => {
        if (!currentWorkingAccount) return;

        // Filter out empty entries
        const validEntries = tempBreakdown.filter(e => e.description.trim() !== '' || e.debit > 0 || e.credit > 0);

        setBreakdowns(prev => ({
            ...prev,
            [currentWorkingAccount]: validEntries
        }));

        setWorkingNoteModalOpen(false);
    };

    // Effect to update adjustedTrialBalance when breakdowns change
    useEffect(() => {
        if (!adjustedTrialBalance) return;

        setAdjustedTrialBalance(prevData => {
            if (!prevData) return null;

            // 1. Update existing accounts
            let updatedData = prevData.map(item => {
                if (breakdowns[item.account]) {
                    const entries = breakdowns[item.account];
                    const noteDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const noteCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

                    const baseDebit = item.baseDebit || 0;
                    const baseCredit = item.baseCredit || 0;

                    const totalNet = (baseDebit + noteDebit) - (baseCredit + noteCredit);

                    return {
                        ...item,
                        debit: totalNet > 0 ? Math.round(totalNet) : 0,
                        credit: totalNet < 0 ? Math.round(Math.abs(totalNet)) : 0
                    };
                } else if (item.baseDebit !== undefined || item.baseCredit !== undefined) {
                    // Reset to base if notes generated no net change or were removed
                    return {
                        ...item,
                        debit: item.baseDebit || 0,
                        credit: item.baseCredit || 0
                    };
                }
                return item;
            });

            // 2. Identify and create missing accounts that have notes
            const existingAccounts = new Set(updatedData.map(i => i.account.toLowerCase()));

            Object.entries(breakdowns).forEach(([accountName, entries]) => {
                // If account exists (case-insensitive check), we already updated it above.
                // If account matches 'totals', skip it.
                if (existingAccounts.has(accountName.toLowerCase()) || accountName.toLowerCase() === 'totals') {
                    return;
                }

                // If notes exist for a non-existent account, create it.
                // Filter out empty notes first (though breakdowns usually stores clean data, safe to check total)
                const noteEntries = entries as BreakdownEntry[];
                const noteDebit = noteEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
                const noteCredit = noteEntries.reduce((sum, e) => sum + (e.credit || 0), 0);

                if (noteDebit > 0 || noteCredit > 0) {
                    const totalNet = noteDebit - noteCredit;
                    updatedData.push({
                        account: accountName,
                        baseDebit: 0,
                        baseCredit: 0,
                        debit: totalNet > 0 ? Math.round(totalNet) : 0,
                        credit: totalNet < 0 ? Math.round(Math.abs(totalNet)) : 0
                    });
                }
            });

            // 3. Re-calculate totals
            // Remove old Totals row if it exists to recalculate fresh
            updatedData = updatedData.filter(i => i.account.toLowerCase() !== 'totals');

            const totalDebit = updatedData.reduce((sum, item) => sum + (item.debit || 0), 0);
            const totalCredit = updatedData.reduce((sum, item) => sum + (item.credit || 0), 0);

            updatedData.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });

            return updatedData;
        });

    }, [breakdowns]);

    const handleWorkingNoteChange = (index: number, field: keyof BreakdownEntry, value: string | number) => {
        setTempBreakdown(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleVatAdjustmentChange = (quarter: string, field: string, value: string) => {
        setVatManualAdjustments(prev => ({
            ...prev,
            [quarter]: {
                ...(prev[quarter] || {}),
                [field]: value
            }
        }));
    };

    const handleAddBreakdownRow = () => {
        setTempBreakdown(prev => [...prev, { description: '', debit: 0, credit: 0 }]);
    };

    const handleRemoveBreakdownRow = (index: number) => {
        setTempBreakdown(prev => prev.filter((_, i) => i !== index));
    };



    const handleSaveGlobalAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGlobalAccountName.trim() || !newGlobalAccountMain) return;

        const parentToUse = newGlobalAccountChild || newGlobalAccountMain;

        // This part is specific to Type 1 workflow's customRows state, which is not directly used for Type 2/3.
        // It's safe to remove or ensure it doesn't cause issues if not needed.
        // setCustomRows(prev => [...prev, { parent: parentToUse, label: newGlobalAccountName.trim() }]);

        setAdjustedTrialBalance(prev => {
            if (!prev) return prev;
            const exists = prev.some(e => e.account.toLowerCase() === newGlobalAccountName.toLowerCase());
            if (exists) return prev;

            const newArr = [...prev];
            const totalsIndex = newArr.findIndex(i => i.account.toLowerCase() === 'totals');
            const newItem = {
                account: newGlobalAccountName.trim(),
                debit: 0,
                credit: 0,
                baseDebit: 0,
                baseCredit: 0
            };

            if (totalsIndex > -1) {
                newArr.splice(totalsIndex, 0, newItem);
            } else {
                newArr.push(newItem);
            }
            return newArr;
        });

        setShowGlobalAddAccountModal(false);
        setNewGlobalAccountName('');
        setNewGlobalAccountMain('');
        setNewGlobalAccountChild('');
    };

    const handleCellChange = (accountLabel: string, field: 'debit' | 'credit', value: string) => {
        const numValue = Math.round(parseFloat(value) || 0);
        const baseField = field === 'debit' ? 'baseDebit' : 'baseCredit';

        setAdjustedTrialBalance(prev => {
            if (!prev) return prev;
            const newBalance = [...prev];

            const existingIndex = newBalance.findIndex(item => item.account.toLowerCase() === accountLabel.toLowerCase());

            if (existingIndex > -1) {
                newBalance[existingIndex] = {
                    ...newBalance[existingIndex],
                    [field]: numValue,
                    [baseField]: numValue
                };
            } else {
                const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
                const newItem = {
                    account: accountLabel,
                    debit: 0,
                    credit: 0,
                    [field]: numValue,
                    baseDebit: 0,
                    baseCredit: 0,
                    [baseField]: numValue
                };
                if (totalsIdx > -1) {
                    newBalance.splice(totalsIdx, 0, newItem);
                } else {
                    newBalance.push(newItem);
                }
            }

            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);

            const finalTotalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (finalTotalsIdx > -1) {
                newBalance[finalTotalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
            } else {
                newBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });
            }

            return newBalance;
        });
    };

    const handlePnlChange = (id: string, year: 'currentYear' | 'previousYear', value: number) => {
        setPnlValues(prev => ({
            ...prev,
            [id]: {
                currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
            }
        }));
    };

    const handleBalanceSheetChange = (id: string, year: 'currentYear' | 'previousYear', value: number) => {
        setBalanceSheetValues(prev => ({
            ...prev,
            [id]: {
                currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
            }
        }));
    };

    const handleExportStepPnl = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Profit & Loss
        const data = pnlStructure.filter(i => i.type === 'item' || i.type === 'total').map(item => ({
            Item: item.label,
            'Current Year (AED)': computedValues.pnl[item.id]?.currentYear || 0,
            'Previous Year (AED)': computedValues.pnl[item.id]?.previousYear || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 25 }, { wch: 25 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");

        // Sheet 2: PNL - Working Notes
        const pnlNotesItems: any[] = [];
        Object.entries(pnlWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = pnlStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    pnlNotesItems.push({
                        "Linked Item": itemLabel,
                        "Description": n.description,
                        "Current Year (AED)": n.currentYearAmount ?? n.amount ?? 0,
                        "Previous Year (AED)": n.previousYearAmount ?? 0
                    });
                });
            }
        });

        if (pnlNotesItems.length > 0) {
            const wsNotes = XLSX.utils.json_to_sheet(pnlNotesItems);
            wsNotes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(wsNotes, 1);
            XLSX.utils.book_append_sheet(wb, wsNotes, "PNL - Working Notes");
        }

        XLSX.writeFile(wb, `${companyName || 'Company'}_ProfitAndLoss.xlsx`);
    };

    const handleExportStepBS = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Balance Sheet
        const data = bsStructure.filter(i => i.type === 'item' || i.type === 'total' || i.type === 'grand_total').map(item => ({
            Item: item.label,
            'Current Year (AED)': computedValues.bs[item.id]?.currentYear || 0,
            'Previous Year (AED)': computedValues.bs[item.id]?.previousYear || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 25 }, { wch: 25 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");

        // Sheet 2: BS - Working Notes
        const bsNotesItems: any[] = [];
        Object.entries(bsWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = bsStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    bsNotesItems.push({
                        "Linked Item": itemLabel,
                        "Description": n.description,
                        "Current Year (AED)": n.currentYearAmount ?? n.amount ?? 0,
                        "Previous Year (AED)": n.previousYearAmount ?? 0
                    });
                });
            }
        });

        if (bsNotesItems.length > 0) {
            const wsNotes = XLSX.utils.json_to_sheet(bsNotesItems);
            wsNotes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(wsNotes, 1);
            XLSX.utils.book_append_sheet(wb, wsNotes, "BS - Working Notes");
        }

        XLSX.writeFile(wb, `${companyName || 'Company'}_BalanceSheet.xlsx`);
    };

    const handleExportToExcel = () => {
        const workbook = XLSX.utils.book_new();
        const isSbrActive = questionnaireAnswers[6] === 'Yes';

        // --- Sheet 1: Step 1 - Review Categorization ---
        if (editedTransactions.length > 0) {
            const step1Data = editedTransactions.map(t => ({
                "Date": formatDate(t.date),
                "Category": getChildCategory(t.category || 'UNCATEGORIZED'),
                "Description": typeof t.description === 'string' ? t.description : JSON.stringify(t.description),
                "Source File": t.sourceFile || '-',
                "Currency (Orig)": t.originalCurrency || t.currency || 'AED',
                "Debit (Orig)": t.originalDebit || t.debit || 0,
                "Credit (Orig)": t.originalCredit || t.credit || 0,
                "Currency (AED)": "AED",
                "Debit (AED)": t.debit || 0,
                "Credit (AED)": t.credit || 0,
                "Balance (AED)": t.balance || 0,
                "Confidence": (t.confidence || 0) + '%'
            }));
            const ws1 = XLSX.utils.json_to_sheet(step1Data);
            ws1['!cols'] = [
                { wch: 12 }, { wch: 30 }, { wch: 50 }, { wch: 30 },
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
            ];
            applySheetStyling(ws1, 1, 0, '#,##0.00;[Red]-#,##0.00');
            XLSX.utils.book_append_sheet(workbook, ws1, 'Step 1 - Transactions');
        }

        // --- Sheet 2: Step 2 - Summarization & Reconciliation ---
        if (summaryData.length > 0) {
            const step2Data = summaryData.map(s => ({
                "Category": s.category,
                "Debit (AED)": s.debit,
                "Credit (AED)": s.credit
            }));
            // Add Total Row
            const totalDebit = summaryData.reduce((sum, d) => sum + d.debit, 0);
            const totalCredit = summaryData.reduce((sum, d) => sum + d.credit, 0);
            step2Data.push({
                "Category": "GRAND TOTAL",
                "Debit (AED)": totalDebit,
                "Credit (AED)": totalCredit
            });

            const ws2 = XLSX.utils.json_to_sheet(step2Data);
            ws2['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws2, 1, 1, '#,##0.00;[Red]-#,##0.00');
            XLSX.utils.book_append_sheet(workbook, ws2, 'Step 2 - Summary');

            // Sheet 2.5: Bank Reconciliation
            if (reconciliationData.length > 0) {
                const reconData = reconciliationData.map(r => ({
                    "File Name": r.fileName,
                    "Currency": r.currency,
                    "Opening Balance": r.openingBalance,
                    "Total Debit (-)": r.totalDebit,
                    "Total Credit (+)": r.totalCredit,
                    "Calculated Closing": r.calculatedClosing,
                    "Actual Closing (Extracted)": r.closingBalance,
                    "Difference": r.diff,
                    "Status": r.isValid ? "Balanced" : "Mismatch"
                }));

                if (reconciliationData.length > 1) {
                    reconData.push({
                        "File Name": "OVERALL TOTAL",
                        "Currency": "AED",
                        "Opening Balance": overallSummary?.openingBalance || 0,
                        "Total Debit (-)": reconciliationData.reduce((s, r) => s + r.totalDebit, 0),
                        "Total Credit (+)": reconciliationData.reduce((s, r) => s + r.totalCredit, 0),
                        "Calculated Closing": overallSummary?.closingBalance || 0,
                        "Actual Closing (Extracted)": overallSummary?.closingBalance || 0,
                        "Difference": 0,
                        "Status": reconciliationData.every(r => r.isValid) ? "Balanced" : "Mismatch"
                    });
                }
                const wsRecon = XLSX.utils.json_to_sheet(reconData);
                wsRecon['!cols'] = [{ wch: 40 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];
                applySheetStyling(wsRecon, 1, 0, '#,##0.00;[Red]-#,##0.00');
                XLSX.utils.book_append_sheet(workbook, wsRecon, 'Step 2.5 - Bank Reconciliation');
            }
        }

        // --- Sheet 3: Step 3 - VAT Docs Upload ---
        const vatFiles = additionalFiles.length > 0 ? additionalFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" })) : [{ "File Name": "No files uploaded", "Status": "-" }];
        const ws3 = XLSX.utils.json_to_sheet(vatFiles);
        ws3['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws3, 1);
        XLSX.utils.book_append_sheet(workbook, ws3, 'Step 3 - VAT Docs');

        // --- Sheet 4: Step 4 - VAT Summarization ---
        const vatRows = getVatExportRows(vatStepData);
        const wsVat = XLSX.utils.aoa_to_sheet(vatRows);
        wsVat['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        // Merges for headers
        wsVat['!merges'] = [
            { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }, // Sales merge
            { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } }  // Purchases merge
        ];
        applySheetStyling(wsVat, 2, 1);
        XLSX.utils.book_append_sheet(workbook, wsVat, 'Step 4 - VAT Summarization');

        // --- Sheet 5: Step 5 - Opening Balances ---
        if (openingBalancesData.length > 0) {
            const step5Data = openingBalancesData.flatMap(cat =>
                cat.accounts.map(acc => ({
                    Category: cat.category,
                    Account: acc.name,
                    Debit: acc.debit || null,
                    Credit: acc.credit || null
                }))
            );
            const ws5 = XLSX.utils.json_to_sheet(step5Data);
            ws5['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
            applySheetStyling(ws5, 1);
            XLSX.utils.book_append_sheet(workbook, ws5, 'Step 5 - Opening Balances');
        }

        // --- Sheet 6: Step 6 - Adjusted Trial Balance ---
        if (adjustedTrialBalance) {
            const step6Data = adjustedTrialBalance.map(item => ({
                Account: item.account,
                "Base Debit (AED)": item.baseDebit || 0,
                "Base Credit (AED)": item.baseCredit || 0,
                "Debit (AED)": item.debit || 0,
                "Credit (AED)": item.credit || 0
            }));

            // Add Total Row
            const totalBaseDebit = adjustedTrialBalance.reduce((sum, d) => sum + (d.baseDebit || 0), 0);
            const totalBaseCredit = adjustedTrialBalance.reduce((sum, d) => sum + (d.baseCredit || 0), 0);
            const totalDebit = adjustedTrialBalance.reduce((sum, d) => sum + d.debit, 0);
            const totalCredit = adjustedTrialBalance.reduce((sum, d) => sum + d.credit, 0);

            step6Data.push({
                Account: "GRAND TOTAL",
                "Base Debit (AED)": totalBaseDebit,
                "Base Credit (AED)": totalBaseCredit,
                "Debit (AED)": totalDebit,
                "Credit (AED)": totalCredit
            });

            const ws6 = XLSX.utils.json_to_sheet(step6Data);
            ws6['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
            applySheetStyling(ws6, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws6, "Step 6 - Trial Balance");

            // Sheet 6.5: TB - Working Notes
            const tbNotesItems: any[] = [];
            Object.entries(breakdowns).forEach(([account, entries]) => {
                const typedEntries = entries as BreakdownEntry[];
                if (typedEntries && typedEntries.length > 0) {
                    typedEntries.forEach(n => {
                        tbNotesItems.push({
                            "Linked Account": account,
                            "Description": n.description,
                            "Debit (AED)": n.debit,
                            "Credit (AED)": n.credit
                        });
                    });
                }
            });
            if (tbNotesItems.length > 0) {
                const ws6Notes = XLSX.utils.json_to_sheet(tbNotesItems);
                ws6Notes['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
                applySheetStyling(ws6Notes, 1);
                XLSX.utils.book_append_sheet(workbook, ws6Notes, "Step 6 - TB Working Notes");
            }
        }

        // --- Sheet 7: Step 7 - Profit & Loss (Vertical) ---
        const pnlRows: any[][] = [['PROFIT & LOSS STATEMENT'], ['Generated Date', new Date().toLocaleDateString()], []];
        pnlRows.push(['ITEM', 'CURRENT YEAR (AED)', 'PREVIOUS YEAR (AED)']); // Removed Working Notes column
        pnlStructure.forEach(item => {
            if (item.type === 'header') {
                pnlRows.push([item.label.toUpperCase()]);
            } else if (item.type === 'subsection_header') {
                pnlRows.push([`  ${item.label}`]);
            } else {
                const currentVal = pnlValues[item.id]?.currentYear || 0;
                const prevVal = pnlValues[item.id]?.previousYear || 0;
                pnlRows.push([item.label, currentVal, prevVal]);
            }
        });
        const ws7 = XLSX.utils.aoa_to_sheet(pnlRows);
        ws7['!cols'] = [{ wch: 50 }, { wch: 25 }, { wch: 25 }];
        applySheetStyling(ws7, 4);
        XLSX.utils.book_append_sheet(workbook, ws7, "Step 7 - Profit & Loss");

        // Sheet 7.5: PNL - Working Notes
        const pnlNotesForExport: any[] = [];
        Object.entries(pnlWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = pnlStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    pnlNotesForExport.push({
                        "Linked Item": itemLabel,
                        "Description": n.description,
                        "Current Year (AED)": n.currentYearAmount ?? n.amount ?? 0,
                        "Previous Year (AED)": n.previousYearAmount ?? 0
                    });
                });
            }
        });
        if (pnlNotesForExport.length > 0) {
            const ws7Notes = XLSX.utils.json_to_sheet(pnlNotesForExport);
            ws7Notes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws7Notes, 1);
            XLSX.utils.book_append_sheet(workbook, ws7Notes, "Step 7 - PNL Working Notes");
        }

        // --- Sheet 8: Step 8 - Balance Sheet (Vertical) ---
        const bsRows: any[][] = [['STATEMENT OF FINANCIAL POSITION'], ['Generated Date', new Date().toLocaleDateString()], []];
        bsRows.push(['ITEM', 'CURRENT YEAR (AED)', 'PREVIOUS YEAR (AED)']); // Removed Working Notes column
        bsStructure.forEach(item => {
            if (item.type === 'header') {
                bsRows.push([item.label.toUpperCase()]);
            } else if (item.type === 'subheader') {
                bsRows.push([`  ${item.label}`]);
            } else {
                const currentVal = balanceSheetValues[item.id]?.currentYear || 0;
                const prevVal = balanceSheetValues[item.id]?.previousYear || 0;
                bsRows.push([item.label, currentVal, prevVal]);
            }
        });
        const ws8 = XLSX.utils.aoa_to_sheet(bsRows);
        ws8['!cols'] = [{ wch: 50 }, { wch: 25 }, { wch: 25 }];
        applySheetStyling(ws8, 4);
        XLSX.utils.book_append_sheet(workbook, ws8, "Step 8 - Balance Sheet");

        // Sheet 8.5: BS - Working Notes
        const bsNotesForExport: any[] = [];
        Object.entries(bsWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = bsStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    bsNotesForExport.push({
                        "Linked Item": itemLabel,
                        "Description": n.description,
                        "Current Year (AED)": n.currentYearAmount ?? n.amount ?? 0,
                        "Previous Year (AED)": n.previousYearAmount ?? 0
                    });
                });
            }
        });
        if (bsNotesForExport.length > 0) {
            const ws8Notes = XLSX.utils.json_to_sheet(bsNotesForExport);
            ws8Notes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws8Notes, 1);
            XLSX.utils.book_append_sheet(workbook, ws8Notes, "Step 8 - BS Working Notes");
        }

        // --- Sheet 9: Step 9 - LOU ---
        const louData = louFiles.length > 0
            ? louFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const ws9 = XLSX.utils.json_to_sheet(louData);
        ws9['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws9, 1);
        XLSX.utils.book_append_sheet(workbook, ws9, "Step 9 - LOU");

        // --- Sheet 10: Step 10 - Questionnaire ---
        const qRows: any[][] = [['CORPORATE TAX QUESTIONNAIRE'], []];
        CT_QUESTIONS.forEach(q => {
            qRows.push([q.text, questionnaireAnswers[q.id] || '-']);
        });
        // Include revenue answers if applicable
        if (questionnaireAnswers['curr_revenue'] || questionnaireAnswers['prev_revenue']) {
            qRows.push([], ['SUPPLEMENTARY DATA', 'VALUE']);
            qRows.push(['Operating Revenue of Current Period', questionnaireAnswers['curr_revenue'] || '0.00']);
            qRows.push(['Operating Revenue for Previous Period', questionnaireAnswers['prev_revenue'] || '0.00']);
        }
        const ws10 = XLSX.utils.aoa_to_sheet(qRows);
        ws10['!cols'] = [{ wch: 80 }, { wch: 20 }];
        applySheetStyling(ws10, 1);
        XLSX.utils.book_append_sheet(workbook, ws10, "Step 10 - Questionnaire");

        // --- Sheet 11: Step 11 - Final Report ---
        // Ensure syncedReportData respects SBR
        const finalReportState = {
            ...reportForm,
            // Re-syncing logic to be extra safe in case Export All is called
            operatingRevenue: isSbrActive ? 0 : (computedValues.pnl['revenue']?.currentYear || reportForm.operatingRevenue || 0),
            derivingRevenueExpenses: isSbrActive ? 0 : (computedValues.pnl['cost_of_revenue']?.currentYear || reportForm.derivingRevenueExpenses || 0),
            grossProfit: isSbrActive ? 0 : (computedValues.pnl['gross_profit']?.currentYear || reportForm.grossProfit || 0),
            netProfit: isSbrActive ? 0 : (computedValues.pnl['profit_loss_year']?.currentYear || reportForm.netProfit || 0),
            // ... the rest of reportForm should already be synced via handleContinueToReport before reaching Step 11
        };

        const finalExportData = getFinalReportExportData(finalReportState);
        const ws11 = XLSX.utils.aoa_to_sheet(finalExportData);
        ws11['!cols'] = [{ wch: 60 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, ws11, "Step 11 - Final Report");

        XLSX.writeFile(workbook, `${companyName || 'Company'}_Complete_Filing.xlsx`);
    };

    const getFinalReportExportData = (overrides?: any) => {
        const isSbrActive = questionnaireAnswers[6] === 'Yes';
        const data: any[][] = [
            ["FEDERATION TAX AUTHORITY - CORPORATE TAX RETURN"],
            ["Generated Date", new Date().toLocaleDateString()],
            [],
        ];

        // Merge current reportForm with any overrides
        // If overrides are provided, we prefer them for the mapped fields
        const sourceData = overrides ? { ...reportForm, ...overrides } : reportForm;

        REPORT_STRUCTURE.forEach(section => {
            data.push([section.title.toUpperCase()]);
            section.fields.forEach(field => {
                if (field.type === 'header') {
                    data.push([field.label.replace(/---/g, '').trim().toUpperCase()]);
                } else {
                    let value = sourceData[field.field] !== undefined ? sourceData[field.field] : '';
                    if (isSbrActive && field.type === 'number') {
                        value = 0;
                    }
                    data.push([field.label.toUpperCase(), value]);
                }
            });
            data.push([]); // Gap between sections
        });

        return data;
    };

    const handleExportStepReport = () => {
        const finalExportData = getFinalReportExportData();
        const wsFinal = XLSX.utils.aoa_to_sheet(finalExportData);
        wsFinal['!cols'] = [{ wch: 60 }, { wch: 40 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsFinal, "Final Report");
        XLSX.writeFile(wb, `${companyName || 'Company'}_FinalReport_Step11.xlsx`);
    };

    const handleExportStep1 = () => {
        const wsData = editedTransactions.map(t => ({
            Date: formatDate(t.date),
            Description: typeof t.description === 'object' ? JSON.stringify(t.description) : t.description,
            Debit: t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0),
            Credit: t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0),
            Currency: t.currency || 'AED',
            "Debit (AED)": t.debit || 0,
            "Credit (AED)": t.credit || 0,
            Category: (t.category === 'UNCATEGORIZED' || !t.category) ? 'Uncategorized' : getChildCategory(resolveCategoryPath(t.category)),
            Confidence: (t.confidence || 0) + '%'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categorized Transactions");
        XLSX.writeFile(wb, `${companyName || 'Company'}_Transactions_Step1.xlsx`);
    };

    const handleExportStepSummary = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Account Summarization
        const summaryCurrency = summaryFileFilter === 'ALL' ? 'AED' : (reconciliationData[0]?.currency || 'AED');
        const wsData = summaryData.map(d => ({
            "Account": d.category,
            "Debit": d.debit,
            "Credit": d.credit,
            "Currency": summaryCurrency
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
        applySheetStyling(ws, 1, 1, '#,##0.00;[Red]-#,##0.00');
        XLSX.utils.book_append_sheet(wb, ws, "Account Summary");

        // Sheet 2: Bank Statement Reconciliation
        if (reconciliationData.length > 0) {
            const reconWsData = reconciliationData.map(r => ({
                "File Name": r.fileName,
                "Opening Balance": r.openingBalance,
                "Total Debit (-)": r.totalDebit,
                "Total Credit (+)": r.totalCredit,
                "Calculated Closing": r.calculatedClosing,
                "Actual Closing (Extracted)": r.closingBalance,
                "Difference": r.diff,
                "Status": r.isValid ? "Balanced" : "Mismatch",
                "Currency": r.currency
            }));

            if (summaryFileFilter === 'ALL' && reconciliationData.length > 1) {
                reconWsData.push({
                    "File Name": "OVERALL TOTAL",
                    "Opening Balance": overallSummary?.openingBalance || 0,
                    "Total Debit (-)": reconciliationData.reduce((s, r) => s + r.totalDebit, 0),
                    "Total Credit (+)": reconciliationData.reduce((s, r) => s + r.totalCredit, 0),
                    "Calculated Closing": overallSummary?.closingBalance || 0,
                    "Actual Closing (Extracted)": overallSummary?.closingBalance || 0,
                    "Difference": 0,
                    "Status": reconciliationData.every(r => r.isValid) ? "Balanced" : "Mismatch",
                    "Currency": "AED"
                });
            }

            const wsRecon = XLSX.utils.json_to_sheet(reconWsData);
            wsRecon['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 10 }];
            applySheetStyling(wsRecon, 1, 1, '#,##0.00;[Red]-#,##0.00');
            XLSX.utils.book_append_sheet(wb, wsRecon, "Bank Reconciliation");
        }

        XLSX.writeFile(wb, `${companyName || 'Company'}_Summarization_Step2.xlsx`);
    };

    const handleExportStep4VAT = () => {
        const vatRows = getVatExportRows(vatStepData);
        const ws = XLSX.utils.aoa_to_sheet(vatRows);
        ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        // Merges for headers
        ws['!merges'] = [
            { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }, // Sales merge
            { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } }  // Purchases merge
        ];
        applySheetStyling(ws, 2, 1);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VAT Summarization");
        XLSX.writeFile(wb, `${companyName || 'Company'}_VAT_Summarization_Step4.xlsx`);
    };

    const handleExportStep3 = () => {
        const flatData = openingBalancesData.flatMap(cat =>
            cat.accounts
                .filter(acc => acc.debit > 0 || acc.credit > 0)
                .map(acc => ({
                    Category: cat.category,
                    Account: acc.name,
                    Debit: acc.debit,
                    Credit: acc.credit
                }))
        );
        const ws = XLSX.utils.json_to_sheet(flatData);
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
        XLSX.writeFile(wb, `${companyName || 'Company'}_Opening_Balances_Step5.xlsx`);
    };

    const handleExportStep4 = () => {
        if (!adjustedTrialBalance) return;
        const wb = XLSX.utils.book_new();

        // Sheet 1: Trial Balance
        const data = adjustedTrialBalance.map(tb => ({
            Account: tb.account,
            "Base Debit": tb.baseDebit || 0,
            "Base Credit": tb.baseCredit || 0,
            Debit: tb.debit,
            Credit: tb.credit,
            Currency: tb.currency || 'AED'
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");

        // Sheet 2: TB - Working Notes
        const tbNotesItems: any[] = [];
        Object.entries(breakdowns).forEach(([account, entries]) => {
            const typedEntries = entries as BreakdownEntry[];
            if (typedEntries && typedEntries.length > 0) {
                typedEntries.forEach(n => {
                    tbNotesItems.push({
                        "Linked Account": account,
                        "Description": n.description,
                        "Debit (AED)": n.debit,
                        "Credit (AED)": n.credit
                    });
                });
            }
        });

        if (tbNotesItems.length > 0) {
            const wsNotes = XLSX.utils.json_to_sheet(tbNotesItems);
            wsNotes['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(wsNotes, 1);
            XLSX.utils.book_append_sheet(wb, wsNotes, "TB - Working Notes");
        }

        XLSX.writeFile(wb, `${companyName || 'Company'}_Trial_Balance_Step6.xlsx`);
    };

    const handleAddPnlAccount = (newItem: any) => {
        setPnlStructure(prev => {
            const newStruct = [...prev];
            // Find index of the section/header to insert after
            const index = newStruct.findIndex(i => i.id === newItem.sectionId);
            if (index !== -1) {
                // Insert after the section header (or find the last item of that section - simpler to just insert after header for now)
                // Better UX: insert at end of section?
                // For simplicity, let's insert after the header or the last item of that section.
                // Let's iterate to find the end of the section (before next header/total or end of list)
                let insertIndex = index + 1;
                while (insertIndex < newStruct.length && newStruct[insertIndex].type === 'item') {
                    insertIndex++;
                }
                newStruct.splice(insertIndex, 0, { ...newItem, sectionId: undefined });
            } else {
                newStruct.push(newItem);
            }
            return newStruct;
        });
        // Init value
        setPnlValues(prev => ({ ...prev, [newItem.id]: { currentYear: 0, previousYear: 0 } }));
    };

    const handleAddBsAccount = (newItem: any) => {
        setBsStructure(prev => {
            const newStruct = [...prev];
            const index = newStruct.findIndex(i => i.id === newItem.sectionId);
            if (index !== -1) {
                let insertIndex = index + 1;
                while (insertIndex < newStruct.length && newStruct[insertIndex].type === 'item') {
                    insertIndex++;
                }
                newStruct.splice(insertIndex, 0, { ...newItem, sectionId: undefined });
            } else {
                newStruct.push(newItem);
            }
            return newStruct;
        });
        setBalanceSheetValues(prev => ({ ...prev, [newItem.id]: { currentYear: 0, previousYear: 0 } }));
    };

    const handleUpdatePnlWorkingNote = (accountId: string, notes: WorkingNoteEntry[]) => {
        setPnlWorkingNotes(prev => ({ ...prev, [accountId]: notes }));

        // Recalculate values for this account
        const currentTotal = notes.reduce((sum, note) => sum + (note.currentYearAmount ?? note.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, note) => sum + (note.previousYearAmount ?? 0), 0);

        setPnlValues(prev => ({
            ...prev,
            [accountId]: {
                currentYear: currentTotal,
                previousYear: previousTotal
            }
        }));
        // Recalculate the value for this account
        const totals = notes.reduce(
            (sum, note) => {
                sum.currentYear += note.currentYearAmount ?? note.amount ?? 0;
                sum.previousYear += note.previousYearAmount ?? 0;
                return sum;
            },
            { currentYear: 0, previousYear: 0 }
        );
        setPnlValues(prev => ({ ...prev, [accountId]: totals }));
    };

    const handleUpdateBsWorkingNote = (accountId: string, notes: WorkingNoteEntry[]) => {
        setBsWorkingNotes(prev => ({ ...prev, [accountId]: notes }));

        // Recalculate
        const currentTotal = notes.reduce((sum, note) => sum + (note.currentYearAmount ?? note.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, note) => sum + (note.previousYearAmount ?? 0), 0);

        setBalanceSheetValues(prev => ({
            ...prev,
            [accountId]: {
                currentYear: currentTotal,
                previousYear: previousTotal
            }
        }));
    };

    // Account Mapping Functions for Auto-Population
    const mapTrialBalanceToPnl = (trialBalance: TrialBalanceEntry[]): { values: Record<string, { currentYear: number; previousYear: number }>, notes: Record<string, WorkingNoteEntry[]> } => {
        const pnlMapping: Record<string, { currentYear: number; previousYear: number }> = {};
        const pnlNotes: Record<string, WorkingNoteEntry[]> = {};

        const addNote = (key: string, description: string, amount: number) => {
            if (!pnlNotes[key]) pnlNotes[key] = [];
            pnlNotes[key].push({
                description,
                currentYearAmount: amount,
                previousYearAmount: 0,
                amount,
                currency: 'AED'
            });
        };

        trialBalance.forEach(entry => {
            const accountLower = entry.account.toLowerCase();
            const netAmount = entry.credit - entry.debit; // Positive for income, negative for expenses
            const noteAmount = entry.debit > entry.credit ? -Math.abs(entry.debit - entry.credit) : (entry.credit - entry.debit);

            // Note: For expenses, netAmount is negative. For notes, we usually want to show the magnitude or the signed value?
            // "Amount" in working notes usually sums up to the total.
            // If the P&L item expects a positive number for expense (e.g. Cost of Revenue = 5000), 
            // then we should probably store positive amounts if we treat them as "contributions to the line item".
            // However, typical P&L logic often treats expenses as negative or positive depending on presentation.
            // Let's stick to the convention: pnlMapping accumulates absolute values for display in the input fields usually?
            // Looking at existing logic: `currentYear: ... + Math.abs(netAmount)`.
            // So the value stored is POSITIVE. We should make sure notes sum to this POSITIVE value.
            // So use Math.abs(netAmount) for the note amount too.

            const absAmount = Math.abs(netAmount);
            if (absAmount === 0) return; // Skip zero impact accounts

            // Revenue
            // Keywords: Sales, Service Revenue, Commission Revenue, Rent Revenue, Interest Income
            if (accountLower.includes('sales') || accountLower.includes('service revenue') ||
                accountLower.includes('commission') || accountLower.includes('rent revenue') ||
                accountLower.includes('interest income') || (accountLower.includes('revenue') && !accountLower.includes('cost'))) {
                const key = 'revenue';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Cost of Revenue
            // Keywords: COGS, Cost of Goods Sold, Raw Material, Direct Labor, Factory Overhead, Freight Inwards, Carriage Inwards, Direct Cost, Purchase
            else if (accountLower.includes('cogs') || accountLower.includes('cost of goods') ||
                accountLower.includes('raw material') || accountLower.includes('direct labor') ||
                accountLower.includes('factory overhead') || accountLower.includes('freight inward') ||
                accountLower.includes('carriage inward') || accountLower.includes('direct cost') ||
                accountLower.includes('purchase')) {
                const key = 'cost_of_revenue';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Other Income
            // Keywords: Gain on Disposal, Dividend Received, Discount Received, Bad Debts Recovered, Miscellaneous Income
            else if (accountLower.includes('gain on disposal') || accountLower.includes('dividend received') ||
                accountLower.includes('discount received') || accountLower.includes('bad debts recovered') ||
                accountLower.includes('other income') || accountLower.includes('miscellaneous income')) {
                const key = 'other_income';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Unrealised Gain/Loss
            else if (accountLower.includes('unrealised') || accountLower.includes('fvtpl') || accountLower.includes('fair value')) {
                const key = 'unrealised_gain_loss_fvtpl';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Share of Profits
            else if (accountLower.includes('share of profit') || accountLower.includes('associate')) {
                const key = 'share_profits_associates';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Gain/Loss on Revaluation
            else if (accountLower.includes('revaluation') && (accountLower.includes('property') || accountLower.includes('investment'))) {
                const key = 'gain_loss_revaluation_property';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Impairment Losses PPE
            else if (accountLower.includes('impairment') && (accountLower.includes('equip') || accountLower.includes('machin') || accountLower.includes('land') || accountLower.includes('build'))) {
                const key = 'impairment_losses_ppe';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Impairment Losses Intangible
            else if (accountLower.includes('impairment') && (accountLower.includes('goodwill') || accountLower.includes('patent') || accountLower.includes('trademark'))) {
                const key = 'impairment_losses_intangible';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Business Promotion & Selling
            // Keywords: Advertising, Marketing, Sales Commission, Delivery, Freight Outwards, Travel, Entertainment
            else if (accountLower.includes('advertising') || accountLower.includes('marketing') ||
                accountLower.includes('sales commission') || accountLower.includes('delivery') ||
                accountLower.includes('freight outward') || accountLower.includes('travel') ||
                accountLower.includes('entertainment') || accountLower.includes('business promotion')) {
                const key = 'business_promotion_selling';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Foreign Exchange Loss
            else if (accountLower.includes('foreign exchange') || accountLower.includes('exchange rate') || accountLower.includes('forex')) {
                const key = 'foreign_exchange_loss';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Selling & Distribution Expenses
            // Keywords: Salaries for Sales, Warehouse Rent, Packaging, Shipping
            else if (accountLower.includes('sales staff') || accountLower.includes('warehouse rent') ||
                accountLower.includes('packaging') || accountLower.includes('shipping') || accountLower.includes('distribution')) {
                const key = 'selling_distribution_expenses';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Administrative Expenses
            // Keywords: Office Rent, Utilities, Office Supplies, Legal, Accounting, Admin Salaries, Insurance, General Expenses
            else if (accountLower.includes('office rent') || accountLower.includes('utility') ||
                accountLower.includes('electricity') || accountLower.includes('water') ||
                accountLower.includes('office supplie') || accountLower.includes('legal fee') ||
                accountLower.includes('accounting fee') || accountLower.includes('admin salar') ||
                accountLower.includes('insurance') || accountLower.includes('general expense') ||
                accountLower.includes('admin') || accountLower.includes('stationery') ||
                accountLower.includes('repair') || accountLower.includes('subscription') ||
                accountLower.includes('license') || accountLower.includes('professional') ||
                accountLower.includes('fee')) {
                const key = 'administrative_expenses';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Finance Costs
            // Keywords: Interest Expense, Bank Charges, Loan Interest
            else if (accountLower.includes('interest expense') || accountLower.includes('bank charge') ||
                accountLower.includes('loan interest') || accountLower.includes('finance cost')) {
                const key = 'finance_costs';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }

            // Depreciation
            else if (accountLower.includes('depreciation')) {
                const key = 'depreciation_ppe';
                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + absAmount,
                    previousYear: 0
                };
                addNote(key, entry.account, absAmount);
            }
        });

        return { values: pnlMapping, notes: pnlNotes };
    };

    const mapTrialBalanceToBalanceSheet = (trialBalance: TrialBalanceEntry[]): { values: Record<string, { currentYear: number; previousYear: number }>, notes: Record<string, WorkingNoteEntry[]> } => {
        const bsMapping: Record<string, { currentYear: number; previousYear: number }> = {};
        const bsNotes: Record<string, WorkingNoteEntry[]> = {};

        const addNote = (key: string, description: string, amount: number) => {
            if (!bsNotes[key]) bsNotes[key] = [];
            bsNotes[key].push({
                description,
                currentYearAmount: amount,
                previousYearAmount: 0,
                amount,
                currency: 'AED'
            });
        };

        trialBalance.forEach(entry => {
            const accountLower = entry.account.toLowerCase();
            const debitAmount = entry.debit;
            const creditAmount = entry.credit;

            // Logic implies that we map calculated values.
            // For notes, we want to know what this account contributed to the "Mapped Total".
            // Since we sum "debit - credit" or "credit - debit", the note needs to reflect the absolute contribution or the signed?
            // "Amount" in working notes usually sums to the total.
            // If total is 5000 (calculated as debits - credits), and an account had 6000 debit and 0 credit, it contributed 6000.
            // If another had 0 debit and 1000 credit, it contributed -1000.
            // The sum 6000 - 1000 = 5000. 
            // So we should verify if `WorkingNoteEntry` supports negative amounts or if we should just log the net balance.

            // --- ASSETS (Debit balance usually) ---

            // Cash and Bank Balances
            // Keywords: Cash, Bank
            if (accountLower.includes('cash') || accountLower.includes('bank')) {
                const key = 'cash_bank_balances';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Trade Receivables
            // Keywords: Accounts Receivable, Debtors, Bills Receivable
            else if (accountLower.includes('accounts receivable') || accountLower.includes('debtor') ||
                accountLower.includes('bills receivable') || accountLower.includes('receivable')) {
                const key = 'trade_receivables';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Inventories
            // Keywords: Inventory, Stock
            else if (accountLower.includes('inventory') || accountLower.includes('stock')) {
                const key = 'inventories';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Advances, Deposits and Other Receivables
            // Keywords: Prepaid, Office Supplies (asset), Advance, Deposit
            else if (accountLower.includes('prepaid') || accountLower.includes('advance') ||
                accountLower.includes('deposit') || (accountLower.includes('office supplies') && debitAmount > 0)) {
                const key = 'advances_deposits_receivables';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Marketable Securities (Current Asset)
            else if (accountLower.includes('marketable securit')) {
                const key = 'advances_deposits_receivables'; // Mapping to nearest current asset bucket if explicit Not Found
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Property, Plant & Equipment (Non-Current)
            // Keywords: Land, Building, Plant, Machinery, Equipment, Furniture, Fixture, Vehicles
            else if (accountLower.includes('land') || accountLower.includes('building') ||
                accountLower.includes('plant') || accountLower.includes('machiner') ||
                accountLower.includes('equipment') || accountLower.includes('furniture') ||
                accountLower.includes('fixture') || accountLower.includes('vehicle') ||
                accountLower.includes('ppe')) {
                const key = 'property_plant_equipment';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Intangible Assets
            // Keywords: Patent, Trademark, Copyright, Goodwill, License
            else if (accountLower.includes('patent') || accountLower.includes('trademark') ||
                accountLower.includes('copyright') || accountLower.includes('goodwill') ||
                accountLower.includes('license') || accountLower.includes('intangible')) {
                const key = 'intangible_assets';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Long-term Investments
            else if (accountLower.includes('long-term investment') || accountLower.includes('investment')) {
                const key = 'long_term_investments';
                const val = debitAmount - creditAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }


            // --- LIABILITIES (Credit balance usually) ---

            // Trade and Other Payables
            // Keywords: Accounts Payable, Creditors, Accrued Expenses, Unearned Revenue, Salaries Payable, Interest Payable
            else if (accountLower.includes('accounts payable') || accountLower.includes('creditor') ||
                accountLower.includes('bills payable') || accountLower.includes('payable') ||
                accountLower.includes('accrued') || accountLower.includes('unearned revenue')) {
                const key = 'trade_other_payables';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Short-term Borrowings
            // Keywords: Short-term Loans, Bank Overdraft, Current Portion of Long-term Debt
            else if (accountLower.includes('short-term loan') || accountLower.includes('overdraft') ||
                accountLower.includes('current portion')) {
                const key = 'short_term_borrowings';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Employees' End of Service Benefits
            else if (accountLower.includes('end of service') || accountLower.includes('gratuity') ||
                accountLower.includes('employee benefit')) {
                const key = 'employees_end_service_benefits';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Bank Borrowings - Non Current
            // Keywords: Long-term Bank Loans, Bonds Payable, Debentures, Lease Obligations
            else if (accountLower.includes('long-term') || accountLower.includes('bond') ||
                accountLower.includes('debenture') || accountLower.includes('lease') ||
                accountLower.includes('deferred tax')) {
                const key = 'bank_borrowings_non_current';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }


            // --- EQUITY ---

            // Share Capital
            // Keywords: Capital, Common Stock, Share Capital
            else if (accountLower.includes('share capital') || accountLower.includes('capital') ||
                accountLower.includes('common stock') || accountLower.includes('additional paid-in')) {
                const key = 'share_capital';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Retained Earnings
            // Keywords: Retained Earnings, Accumulated Profit
            else if (accountLower.includes('retained earnings') || accountLower.includes('accumulated profit')) {
                const key = 'retained_earnings';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Statutory Reserve
            else if (accountLower.includes('statutory reserve') || accountLower.includes('legal reserve') ||
                accountLower.includes('reserve')) {
                const key = 'statutory_reserve';
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }

            // Drawings (Shareholders' current accounts)
            else if (accountLower.includes('drawing') || accountLower.includes('owner')) {
                const key = 'shareholders_current_accounts';
                // Drawings usually debit balance, reducing equity
                const val = creditAmount - debitAmount;
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }
        });

        return { values: bsMapping, notes: bsNotes };
    };

    const handleContinueToProfitAndLoss = () => {
        // Auto-populate P&L from Trial Balance if available
        if (adjustedTrialBalance && adjustedTrialBalance.length > 0) {
            const result = mapTrialBalanceToPnl(adjustedTrialBalance);
            const mappedValues = result.values;
            const mappedNotes = result.notes;

            setPnlValues(prev => {
                const newValues = { ...prev };
                // Soft merge: Only overwrite if current value is 0 or missing, preserve manual edits
                Object.entries(mappedValues).forEach(([key, val]) => {
                    const prevVal = prev[key];
                    // If no previous data, or it's effectively zero/empty, populate it
                    if (!prevVal || (prevVal.currentYear === 0 && prevVal.previousYear === 0)) {
                        newValues[key] = val;
                    }
                });
                return newValues;
            });

            setPnlWorkingNotes(prev => {
                const newNotes = { ...prev };
                Object.entries(mappedNotes).forEach(([key, notes]) => {
                    // Only auto-populate notes if none exist for this account
                    if (!prev[key] || prev[key].length === 0) {
                        newNotes[key] = notes;
                    }
                });
                return newNotes;
            });
        }
        setCurrentStep(7);
    };

    const handleContinueToBalanceSheet = () => {
        // Auto-populate Balance Sheet from Trial Balance
        if (adjustedTrialBalance && adjustedTrialBalance.length > 0) {
            const result = mapTrialBalanceToBalanceSheet(adjustedTrialBalance);
            const mappedValues = result.values;
            const mappedNotes = result.notes;

            setBalanceSheetValues(prev => {
                const newValues = { ...prev };
                // Soft merge: Only overwrite if current value is 0 or missing, preserve manual edits
                Object.entries(mappedValues).forEach(([key, val]) => {
                    const prevVal = prev[key];
                    if (!prevVal || (prevVal.currentYear === 0 && prevVal.previousYear === 0)) {
                        newValues[key] = val;
                    }
                });
                return newValues;
            });

            setBsWorkingNotes(prev => {
                const newNotes = { ...prev };
                Object.entries(mappedNotes).forEach(([key, notes]) => {
                    // Only auto-populate notes if none exist for this account
                    if (!prev[key] || prev[key].length === 0) {
                        newNotes[key] = notes;
                    }
                });
                return newNotes;
            });
        }
        setCurrentStep(8);
    };

    const handleContinueToLOU = () => {
        setCurrentStep(9);
    };

    const handleContinueToQuestionnaire = () => {
        setCurrentStep(10);
    };

    const handleContinueToReport = () => {
        const isSbrActive = questionnaireAnswers[6] === 'Yes';

        // Sync P&L and Balance Sheet values to Report Form before viewing
        setReportForm((prev: any) => {
            const baseSync = {
                ...prev,
                // P&L Sync
                operatingRevenue: computedValues.pnl['revenue']?.currentYear || 0,
                derivingRevenueExpenses: computedValues.pnl['cost_of_revenue']?.currentYear || 0,
                grossProfit: computedValues.pnl['gross_profit']?.currentYear || 0,
                otherNonOpRevenue: computedValues.pnl['other_income']?.currentYear || 0, // Simplified mapping

                // Map specifics if they exist in P&L structure, otherwise allow manual override
                salaries: computedValues.pnl['administrative_expenses']?.currentYear ? (computedValues.pnl['administrative_expenses'].currentYear * 0.4) : (prev.salaries || 0), // Rough heuristic if not granular
                depreciation: computedValues.pnl['depreciation_ppe']?.currentYear || 0,

                // Allow P&L total to override netProfit if it differs (user edit authority)
                netProfit: computedValues.pnl['profit_loss_year']?.currentYear || prev.netProfit,

                // Balance Sheet Sync
                // Assets
                ppe: computedValues.bs['property_plant_equipment']?.currentYear || 0,
                intangibleAssets: computedValues.bs['intangible_assets']?.currentYear || 0,
                financialAssets: computedValues.bs['long_term_investments']?.currentYear || 0, // Mapped to Financial Assets
                otherNonCurrentAssets: computedValues.bs['total_non_current_assets']?.currentYear
                    ? (computedValues.bs['total_non_current_assets'].currentYear - (computedValues.bs['property_plant_equipment']?.currentYear || 0) - (computedValues.bs['intangible_assets']?.currentYear || 0))
                    : (prev.otherNonCurrentAssets || 0),

                totalCurrentAssets: computedValues.bs['total_current_assets']?.currentYear || 0,
                totalNonCurrentAssets: computedValues.bs['total_non_current_assets']?.currentYear || 0,
                totalAssets: computedValues.bs['total_assets']?.currentYear || 0,

                // Liabilities
                totalCurrentLiabilities: computedValues.bs['total_current_liabilities']?.currentYear || 0,
                totalNonCurrentLiabilities: computedValues.bs['total_non_current_liabilities']?.currentYear || 0,
                totalLiabilities: computedValues.bs['total_liabilities']?.currentYear || 0,

                // Equity
                shareCapital: computedValues.bs['share_capital']?.currentYear || 0,
                retainedEarnings: computedValues.bs['retained_earnings']?.currentYear || 0,
                otherEquity: computedValues.bs['shareholders_current_accounts']?.currentYear || 0,
                totalEquity: computedValues.bs['total_equity']?.currentYear || 0,
                totalEquityLiabilities: computedValues.bs['total_equity_liabilities']?.currentYear || 0,

                // Tax Calculation Sync
                accountingIncomeTaxPeriod: computedValues.pnl['profit_loss_year']?.currentYear || prev.accountingIncomeTaxPeriod,
                taxableIncomeBeforeAdj: computedValues.pnl['profit_loss_year']?.currentYear || prev.taxableIncomeBeforeAdj,
                taxableIncomeTaxPeriod: computedValues.pnl['profit_loss_year']?.currentYear || prev.taxableIncomeTaxPeriod, // Assuming no adjustments for now
            };

            if (isSbrActive) {
                // Force all numerical fields listed in REPORT_STRUCTURE to 0
                const zeroedData = { ...baseSync };
                REPORT_STRUCTURE.forEach(section => {
                    section.fields.forEach(field => {
                        if (field.type === 'number') {
                            zeroedData[field.field] = 0;
                        }
                    });
                });
                return zeroedData;
            }

            return baseSync;
        });
        setCurrentStep(11);
    };

    const filteredTransactions = useMemo(() => {
        let txs = editedTransactions.map((t, i) => ({ ...t, originalIndex: i }));

        if (selectedFileFilter !== 'ALL') {
            txs = txs.filter(t => t.sourceFile === selectedFileFilter);
        }

        txs = txs.filter(t => {
            const desc = typeof t.description === 'string' ? t.description : JSON.stringify(t.description || '');
            const matchesSearch = desc.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'ALL'
                ? true
                : filterCategory === 'UNCATEGORIZED'
                    ? (!t.category || t.category.toLowerCase().includes('uncategorized'))
                    : resolveCategoryPath(t.category) === filterCategory;
            return matchesSearch && matchesCategory;
        });
        if (txs.length === 0 && editedTransactions.length > 0) {
            // Optional: Handle edge case where all items are filtered out
        }
        return txs;
    }, [editedTransactions, searchTerm, filterCategory, selectedFileFilter]);

    const uniqueFiles = useMemo(() => {
        const files = new Set(editedTransactions.map(t => t.sourceFile).filter(Boolean));
        return Array.from(files) as string[];
    }, [editedTransactions]);

    const overallSummary = useMemo(() => {
        if (!uniqueFiles.length || !fileSummaries) return summary;

        // Consolidate balances by summing up converted AED values from all files
        const consolidatedOpening = uniqueFiles.reduce((sum, f) => sum + (fileSummaries[f]?.openingBalance || 0), 0);
        const consolidatedClosing = uniqueFiles.reduce((sum, f) => sum + (fileSummaries[f]?.closingBalance || 0), 0);

        return {
            accountHolder: fileSummaries[uniqueFiles[0]]?.accountHolder || '',
            accountNumber: 'Consolidated',
            statementPeriod: 'Multiple Files',
            openingBalance: consolidatedOpening,
            closingBalance: consolidatedClosing,
            // Original balances are not relevant for the consolidated view as it's mixed currency
            originalOpeningBalance: undefined,
            originalClosingBalance: undefined,
            totalWithdrawals: uniqueFiles.reduce((sum, f) => sum + (fileSummaries[f]?.totalWithdrawals || 0), 0),
            totalDeposits: uniqueFiles.reduce((sum, f) => sum + (fileSummaries[f]?.totalDeposits || 0), 0)
        };
    }, [uniqueFiles, fileSummaries, summary]);

    const summaryData = useMemo(() => {
        const isAllFiles = summaryFileFilter === 'ALL';
        const txsToSummarize = isAllFiles
            ? editedTransactions
            : editedTransactions.filter(t => t.sourceFile === summaryFileFilter);

        const groups: Record<string, { debit: number, credit: number }> = {};

        txsToSummarize.forEach(t => {
            const cat = getChildCategory(t.category || '(blank)');
            if (!groups[cat]) groups[cat] = { debit: 0, credit: 0 };

            // Use original amounts if a specific file is selected AND original amounts exist
            const debit = (!isAllFiles && t.originalDebit !== undefined) ? t.originalDebit : (t.debit || 0);
            const credit = (!isAllFiles && t.originalCredit !== undefined) ? t.originalCredit : (t.credit || 0);

            groups[cat].debit += debit;
            groups[cat].credit += credit;
        });

        return Object.entries(groups)
            .map(([cat, vals]) => ({ category: cat, ...vals }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [editedTransactions, summaryFileFilter]);

    const reconciliationData = useMemo(() => {
        const isAllFiles = summaryFileFilter === 'ALL';
        const filesToReconcile = isAllFiles ? uniqueFiles : uniqueFiles.filter(f => f === summaryFileFilter);

        return filesToReconcile.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);

            // AED Values
            const totalDebitAED = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCreditAED = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);
            const openingBalanceAED = stmtSummary?.openingBalance || 0;
            const closingBalanceAED = stmtSummary?.closingBalance || 0;
            const calculatedClosingAED = openingBalanceAED - totalDebitAED + totalCreditAED;

            // Original Values
            const hasOrig = fileTransactions.some(t => t.originalCurrency && t.originalCurrency !== 'AED');
            const currency = fileTransactions.find(t => t.originalCurrency)?.originalCurrency || 'AED';

            const totalDebitOrig = hasOrig ? fileTransactions.reduce((sum, t) => sum + (t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0)), 0) : totalDebitAED;
            const totalCreditOrig = hasOrig ? fileTransactions.reduce((sum, t) => sum + (t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0)), 0) : totalCreditAED;
            const openingBalanceOrig = hasOrig ? (stmtSummary?.originalOpeningBalance !== undefined ? stmtSummary.originalOpeningBalance : (stmtSummary?.openingBalance || 0)) : openingBalanceAED;
            const closingBalanceOrig = hasOrig ? (stmtSummary?.originalClosingBalance !== undefined ? stmtSummary.originalClosingBalance : (stmtSummary?.closingBalance || 0)) : closingBalanceAED;
            const calculatedClosingOrig = openingBalanceOrig - totalDebitOrig + totalCreditOrig;

            const diff = Math.abs(calculatedClosingOrig - closingBalanceOrig);

            return {
                fileName,
                openingBalance: openingBalanceAED,
                totalDebit: totalDebitAED,
                totalCredit: totalCreditAED,
                calculatedClosing: calculatedClosingAED,
                closingBalance: closingBalanceAED,
                originalOpeningBalance: openingBalanceOrig,
                originalTotalDebit: totalDebitOrig,
                originalTotalCredit: totalCreditOrig,
                originalCalculatedClosing: calculatedClosingOrig,
                originalClosingBalance: closingBalanceOrig,
                isValid: diff < 0.1,
                diff,
                currency,
                hasConversion: hasOrig && currency !== 'AED'
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions, summaryFileFilter]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIndices = new Set(filteredTransactions.map(t => t.originalIndex));
            setSelectedIndices(allIndices);
        } else {
            setSelectedIndices(new Set());
        }
    };

    const handleSelectRow = (originalIndex: number, checked: boolean) => {
        const newSelected = new Set(selectedIndices);
        if (checked) {
            newSelected.add(originalIndex);
        } else {
            newSelected.delete(originalIndex);
        }
        setSelectedIndices(newSelected);
    };

    const handleBulkApplyCategory = () => {
        if (!bulkCategory || selectedIndices.size === 0) return;
        setEditedTransactions(prev => {
            const updated = [...prev];
            selectedIndices.forEach(idx => {
                updated[idx] = { ...updated[idx], category: bulkCategory };
            });
            return updated;
        });
        setSelectedIndices(new Set());
    };

    const handleFindReplace = () => {
        if (!findText || !replaceCategory) return;
        let count = 0;
        setEditedTransactions(prev => prev.map(t => {
            if (t.description.toLowerCase().includes(findText.toLowerCase())) {
                count++;
                return { ...t, category: replaceCategory };
            }
            return t;
        }));
        setFindText('');
        if (count > 0) alert(`Updated categories for ${count} transactions.`);
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterCategory('ALL');
    };




    const activeSummary = useMemo(() => {
        if (selectedFileFilter === 'ALL') return overallSummary || summary;
        if (selectedFileFilter && fileSummaries && fileSummaries[selectedFileFilter]) {
            return fileSummaries[selectedFileFilter];
        }
        return summary;
    }, [selectedFileFilter, fileSummaries, summary, overallSummary]);

    const balanceValidation = useMemo(() => {
        if (!activeSummary || editedTransactions.length === 0) return { isValid: true, diff: 0 };

        // Filter transactions for the active summary file if a file filter is applied
        const relevantTxs = selectedFileFilter !== 'ALL'
            ? editedTransactions.filter(t => t.sourceFile === selectedFileFilter)
            : editedTransactions;

        if (relevantTxs.length === 0) return { isValid: true, diff: 0 };

        const opening = Number(activeSummary.openingBalance) || 0;
        const closing = Number(activeSummary.closingBalance) || 0;

        const sumDebit = relevantTxs.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
        const sumCredit = relevantTxs.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);

        const calculatedClosing = opening - sumDebit + sumCredit;
        const diff = Math.abs(calculatedClosing - closing);

        return {
            isValid: diff < 1.0, // Allow minor rounding differences
            diff,
            calculatedClosing,
            actualClosing: closing
        };
    }, [activeSummary, editedTransactions, selectedFileFilter]);

    const handleReportFormChange = (field: string, value: any) => {
        setReportForm((prev: any) => ({ ...prev, [field]: value }));
    };






    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <ResultsHeader
                title="Corporate Tax Filing"
                onExport={handleExportToExcel}
                onReset={onReset}
                isExportDisabled={currentStep !== 11}
            />
            <Stepper currentStep={currentStep} />
            {currentStep === 1 && (
                <CtType1Step1
                    transactions={transactions}
                    editedTransactions={editedTransactions}
                    setEditedTransactions={setEditedTransactions}
                    customCategories={customCategories}
                    summary={summary || null}
                    fileSummaries={fileSummaries}
                    uniqueFiles={transactions.reduce((acc: string[], t) => t.sourceFile && !acc.includes(t.sourceFile) ? [...acc, t.sourceFile] : acc, [])}
                    currency={currency}
                    filePreviews={filePreviews}
                    isAutoCategorizing={isAutoCategorizing}
                    handleAutoCategorize={handleAutoCategorize}
                    handleConfirmCategories={handleConfirmCategories}
                    handleExportStep1={handleExportStep1}
                    handleDeleteTransaction={(idx) => {
                        const newTxs = [...editedTransactions];
                        newTxs.splice(idx, 1);
                        setEditedTransactions(newTxs);
                    }}
                />
            )}
            {currentStep === 2 && (
                <CtType1Step2
                    editedTransactions={editedTransactions}
                    summary={summary || null}
                    fileSummaries={fileSummaries}
                    uniqueFiles={transactions.reduce((acc: string[], t) => t.sourceFile && !acc.includes(t.sourceFile) ? [...acc, t.sourceFile] : acc, [])}
                    currency={currency}
                    handleExportStepSummary={handleExportStepSummary}
                    handleBack={handleBack}
                    handleSummarizationContinue={handleSummarizationContinue}
                />
            )}
            {currentStep === 3 && (
                <CtType1Step3
                    additionalFiles={additionalFiles}
                    setAdditionalFiles={setAdditionalFiles}
                    isExtracting={isExtracting}
                    handleExtractAdditionalData={handleExtractAdditionalData}
                    handleBack={handleBack}
                    setCurrentStep={setCurrentStep}
                />
            )}
            {currentStep === 4 && (
                <CtType1Step4
                    vatFileResults={Object.values(additionalDetails).filter(d => (d as any).type === 'vat_return')}
                    vatManualAdjustments={vatManualAdjustments}
                    handleVatAdjustmentChange={(q, f, v) => {
                        setVatManualAdjustments(prev => ({
                            ...prev,
                            [q]: { ...prev[q], [f]: v }
                        }));
                    }}
                    handleBack={handleBack}
                    handleVatSummarizationContinue={handleVatSummarizationContinue}
                    editedTransactions={editedTransactions}
                    currency={currency}
                />
            )}
            {currentStep === 5 && (
                <CtType1Step5
                    openingBalancesData={openingBalancesData}
                    setOpeningBalancesData={setOpeningBalancesData}
                    openingBalanceFiles={openingBalanceFiles}
                    setOpeningBalanceFiles={setOpeningBalanceFiles}
                    isExtractingOpeningBalances={isExtractingOpeningBalances}
                    handleExtractOpeningBalances={handleExtractOpeningBalances}
                    handleBack={handleBack}
                    handleOpeningBalancesComplete={handleOpeningBalancesComplete}
                />
            )}
            {currentStep === 6 && (
                <CtType1Step6
                    adjustedTrialBalance={adjustedTrialBalance}
                    handleCellChange={handleCellChange}
                    handleOpenWorkingNote={handleOpenWorkingNote}
                    setShowGlobalAddAccountModal={setShowGlobalAddAccountModal}
                    handleBack={handleBack}
                    setCurrentStep={setCurrentStep}
                    breakdowns={breakdowns}
                />
            )}
            {currentStep === 7 && (
                <ProfitAndLossStep
                    onNext={handleContinueToBalanceSheet}
                    onBack={handleBack}
                    data={computedValues.pnl}
                    structure={pnlStructure}
                    onChange={handlePnlChange}
                    onExport={handleExportStepPnl}
                    onAddAccount={handleAddPnlAccount}
                    workingNotes={pnlWorkingNotes}
                    onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
                />
            )}
            {currentStep === 8 && (
                <BalanceSheetStep
                    onNext={handleContinueToLOU}
                    onBack={handleBack}
                    data={computedValues.bs}
                    structure={bsStructure}
                    onChange={handleBalanceSheetChange}
                    onExport={handleExportStepBS}
                    onAddAccount={handleAddBsAccount}
                    workingNotes={bsWorkingNotes}
                    onUpdateWorkingNotes={handleUpdateBsWorkingNote}
                />
            )}
            {currentStep === 9 && (
                <CtType1Step9
                    louFiles={louFiles}
                    setLouFiles={setLouFiles}
                    isAnalyzingLou={false} // Placeholder as it was simple upload before
                    handleAnalyzeLou={async () => { }} // Placeholder
                    handleBack={handleBack}
                    setCurrentStep={setCurrentStep}
                />
            )}
            {currentStep === 10 && (
                <CtType1Step10
                    questionnaireAnswers={questionnaireAnswers}
                    handleQuestionnaireChange={(idx, val) => {
                        setQuestionnaireAnswers(prev => ({ ...prev, [idx]: val }));
                    }}
                    handleBack={handleBack}
                    handleContinueToReport={handleContinueToReport}
                />
            )}
            {currentStep === 11 && (
                <CtType1Step11
                    reportForm={reportForm}
                    isGeneratingReport={false}
                    handleReportFormChange={(f, v) => {
                        setReportForm((prev: any) => ({ ...prev, [f]: v }));
                    }}
                    handleBack={handleBack}
                    handleGenerateFinalReport={async () => {
                        handleExportStepReport();
                    }}
                    questionnaireAnswers={questionnaireAnswers}
                />
            )}

            {showVatFlowModal && createPortal(
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100000] flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
                    <div className="bg-[#0F172A] rounded-3xl border border-gray-800 shadow-2xl w-full max-w-lg overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-50 pointer-events-none" />

                        <div className="p-10 text-center relative z-10">
                            <div className="w-20 h-20 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30 shadow-lg shadow-blue-500/20 animate-pulse">
                                <QuestionMarkCircleIcon className="w-10 h-10 text-blue-400" />
                            </div>

                            <h3 className="text-2xl font-black text-white mb-2 tracking-tight">
                                {vatFlowQuestion === 1 ? 'Do you have VAT 201 Certificates?' : 'Do you have Sales/Purchase Ledgers?'}
                            </h3>

                            <p className="text-gray-400 text-sm mb-10 max-w-xs mx-auto leading-relaxed">
                                {vatFlowQuestion === 1
                                    ? 'We can extract precise figures directly from your VAT returns if available.'
                                    : 'Supporting ledgers help in verifying transactions and improving accuracy.'}
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <button
                                    onClick={() => handleVatFlowAnswer(false)}
                                    className="px-8 py-4 border border-gray-700 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white font-bold rounded-2xl transition-all uppercase text-xs tracking-widest w-full sm:w-auto hover:border-gray-600"
                                >
                                    No, I don't
                                </button>
                                <button
                                    onClick={() => handleVatFlowAnswer(true)}
                                    className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-blue-900/30 transition-all uppercase text-xs tracking-widest transform hover:-translate-y-1 w-full sm:w-auto flex items-center justify-center gap-2 group/btn"
                                >
                                    <CheckIcon className="w-4 h-4" />
                                    Yes, I have them
                                </button>
                            </div>
                        </div>

                        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent bottom-0 absolute" />
                    </div>
                </div>,
                document.body
            )}

            {/* Working Note (Breakdown) Modal */}
            {workingNoteModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center">
                                    <ListBulletIcon className="w-5 h-5 mr-2 text-blue-400" />
                                    Working Note: <span className="text-blue-400 ml-1">{currentWorkingAccount}</span>
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Add breakdown details for this account.</p>
                            </div>
                            <button onClick={() => setWorkingNoteModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-800 border-b border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Description</th>
                                        <th className="px-4 py-3 text-right">Debit ({currency})</th>
                                        <th className="px-4 py-3 text-right rounded-tr-lg">Credit ({currency})</th>
                                        <th className="px-2 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {/* Base Amount Row (Read-Only) */}
                                    {(() => {
                                        const account = adjustedTrialBalance?.find(a => a.account === currentWorkingAccount);
                                        if (!account || (account.baseDebit === 0 && account.baseCredit === 0)) return null;
                                        return (
                                            <tr className="bg-blue-900/10 border-l-4 border-blue-500/50 group/base">
                                                <td className="px-4 py-3">
                                                    <span className="text-xs font-bold text-blue-400 uppercase tracking-widest italic flex items-center gap-2">
                                                        <InformationCircleIcon className="w-4 h-4" />
                                                        Amount brought forward from bank statement
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-400 text-sm">
                                                    {formatWholeNumber(account.baseDebit || 0)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-400 text-sm">
                                                    {formatWholeNumber(account.baseCredit || 0)}
                                                </td>
                                                <td className="px-2 py-3"></td>
                                            </tr>
                                        );
                                    })()}
                                    {tempBreakdown.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-gray-800/30">
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={entry.description}
                                                    onChange={(e) => {
                                                        const newTemp = [...tempBreakdown];
                                                        newTemp[idx].description = e.target.value;
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                                                    placeholder="Item description..."
                                                    autoFocus={idx === tempBreakdown.length - 1}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={entry.debit || ''}
                                                    onChange={(e) => {
                                                        const newTemp = [...tempBreakdown];
                                                        newTemp[idx].debit = parseFloat(e.target.value) || 0;
                                                        newTemp[idx].credit = 0; // Clear credit if debit is entered
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-right font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={entry.credit || ''}
                                                    onChange={(e) => {
                                                        const newTemp = [...tempBreakdown];
                                                        newTemp[idx].credit = parseFloat(e.target.value) || 0;
                                                        newTemp[idx].debit = 0; // Clear debit if credit is entered
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-right font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    onClick={() => {
                                                        const newTemp = tempBreakdown.filter((_, i) => i !== idx);
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="text-red-500 hover:text-red-400 p-1.5 hover:bg-red-900/20 rounded transition-colors"
                                                    title="Remove Entry"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {tempBreakdown.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-8 text-center text-gray-500 italic border-2 border-dashed border-gray-800 rounded-lg mt-2">
                                                No breakdown entries yet. Click "Add Entry" to start.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-blue-900/10 border-t-2 border-blue-900/30 font-bold text-white">
                                    <tr>
                                        <td className="px-4 py-3 text-right text-blue-300">Total:</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatWholeNumber(tempBreakdown.reduce((sum, item) => sum + (item.debit || 0), 0))}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatWholeNumber(tempBreakdown.reduce((sum, item) => sum + (item.credit || 0), 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>

                            <button
                                onClick={() => setTempBreakdown([...tempBreakdown, { description: '', debit: 0, credit: 0 }])}
                                className="w-full py-3 border border-dashed border-gray-600 rounded-xl text-gray-400 hover:text-white hover:border-gray-400 hover:bg-gray-800 transition-all flex items-center justify-center font-bold text-sm"
                            >
                                <PlusIcon className="w-5 h-5 mr-2" /> Add Entry
                            </button>
                        </div>

                        <div className="p-6 bg-gray-950 border-t border-gray-800 flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                                <span className="block font-bold text-gray-400">Note:</span>
                                <span >Saving will update the main account total automatically.</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setWorkingNoteModalOpen(false)}
                                    className="px-5 py-2.5 text-gray-400 hover:text-white font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveWorkingNote}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all transform active:scale-95 flex items-center"
                                >
                                    <CheckIcon className="w-5 h-5 mr-2" /> Save Breakdown
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Add Category Modal */}
            {showAddCategoryModal && createPortal(
                <div
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100000] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowAddCategoryModal(false);
                            setPendingCategoryContext(null);
                            setNewCategoryError(null);
                        }
                    }}
                >
                    <div className="bg-[#0F172A] rounded-3xl border border-gray-800 shadow-2xl w-full max-w-md overflow-hidden relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                        <div className="p-8 border-b border-gray-800 bg-[#0A0F1D] flex justify-between items-center relative">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">Add New Category</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Create a custom mapping</p>
                            </div>
                            <button
                                onClick={() => { setShowAddCategoryModal(false); setPendingCategoryContext(null); setNewCategoryError(null); }}
                                className="text-gray-500 hover:text-white transition-colors p-2 rounded-xl hover:bg-gray-800"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveNewCategory} className="relative">
                            <div className="p-8 space-y-6">
                                {newCategoryError && (
                                    <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-300 font-medium">{newCategoryError}</p>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Main Classification</label>
                                    <div className="relative group/input">
                                        <select
                                            value={newCategoryMain}
                                            onChange={(e) => setNewCategoryMain(e.target.value)}
                                            className="w-full p-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all appearance-none font-medium"
                                            required
                                        >
                                            <option value="">Select a Main Category...</option>
                                            {Object.keys(CHART_OF_ACCOUNTS).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronDownIcon className="w-4 h-4 text-gray-500 group-hover/input:text-gray-300 transition-colors" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Sub Category Name</label>
                                    <input
                                        type="text"
                                        value={newCategorySub}
                                        onChange={(e) => setNewCategorySub(e.target.value)}
                                        className="w-full p-4 bg-gray-900/50 border border-gray-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder-gray-600 font-medium"
                                        placeholder="e.g. Employee Wellness Direct Expenses"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-gray-950/80 border-t border-gray-800 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddCategoryModal(false); setPendingCategoryContext(null); setNewCategoryError(null); }}
                                    className="px-6 py-3 text-xs font-bold text-gray-400 hover:text-white uppercase tracking-wider transition-colors hover:bg-gray-800 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all w-full sm:w-auto"
                                >
                                    Create Category
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Global Add Account Modal */}
            {showGlobalAddAccountModal && createPortal(
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveGlobalAddAccount}>
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

                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Account Name</label>
                                    <input
                                        type="text"
                                        value={newGlobalAccountName}
                                        onChange={(e) => setNewGlobalAccountName(e.target.value)}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="e.g. Savings Account - HSBC"
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
                </div>,
                document.body
            )}
        </div>
    );
};
