import React from 'react';
import { Transaction, Invoice, TrialBalanceEntry, FinancialStatements, Company, BankStatementSummary, WorkingNoteEntry } from '../../../types';

// Re-export types for use in other components
export type { Transaction, Invoice, TrialBalanceEntry, FinancialStatements, Company, BankStatementSummary, WorkingNoteEntry };

export const CT_QUESTIONS = [
    { id: 1, text: "Is the Taxable Person a partner in one or more Unincorporated Partnerships?" },
    { id: 2, text: "Is the Tax Return being completed by a Government Entity, Government Controlled Entity, Extractive Business or Non-Extractive Natural Resource Business?" },
    { id: 3, text: "Is the Taxable Person a member of a Multinational Enterprise Group?" },
    { id: 4, text: "Is the Taxable Person incorporated or otherwise established or recognised under the laws of the UAE or under the laws of a Free Zone?" },
    { id: 5, text: "Is the Taxable Person tax resident in a foreign jurisdiction under an applicable Double Taxation Agreement?" },
    { id: 6, text: "Would the Taxable Person like to make an election for Small Business Relief?" },
    { id: 7, text: "Did the Taxable Person transfer any assets or liabilities to a member of the same Qualifying Group during the Tax Period?" },
    { id: 8, text: "Did the Taxable Person transfer a Business or an independent part of a Business during the Tax Period under which Business Restructuring Relief may apply?" },
    { id: 9, text: "Does the Taxable Person have any Foreign Permanent Establishments?" },
    { id: 10, text: "Have the Financial Statements been audited?" },
    { id: 11, text: "Average number of employees during the Tax Period" },
    { id: 12, text: "Does the Taxable Person account for any investments under the Equity Method of Accounting?" },
    { id: 13, text: "Has the Taxable Person recognised any realised or unrealised gains or losses in the Financial Statements that will not subsequently be recognised in the Income Statement?" },
    { id: 14, text: "Has the Taxable Person held any Qualifying Immovable Property, Qualifying Intangible Assets or Qualifying Financial Assets or Qualifying Financial Liabilities during the Tax Period?" },
    { id: 15, text: "Has the Taxable Person incurred Net Interest Expenditure in the current Tax Period which together with any Net Interest Expenditure carried forward exceeds AED 12 million?" },
    { id: 16, text: "Does the Taxable Person wish to deduct any brought forward Net Interest Expenditure in the current Tax Period?" },
    { id: 17, text: "Were there any transactions with Related Parties in the current Tax Period?" },
    { id: 18, text: "Were there any gains / losses realised in the current Tax Period in relation to assets/liabilities previously received from a Related Party at a non-arms length price?" },
    { id: 19, text: "Were there any transactions with Connected Persons in the current Tax Period?" },
    { id: 20, text: "Has the Taxable Person been an Investor in a Qualifying Investment Fund in the current Tax Period or any previous Tax Periods?" },
    { id: 21, text: "Has the Taxable Person made an error in a prior Tax Period where the tax impact is AED 10,000 or less?" },
    { id: 22, text: "Any other adjustments not captured above?" },
    { id: 23, text: "Does the Taxable Person wish to claim Tax Losses from, or surrender Tax Losses to, another group entity?" },
    { id: 24, text: "Does the Taxable Person wish to use any available Tax Credits?" },
    { id: 25, text: "Have any estimated figures been included in the Corporate Tax Return?" }
];

export const REPORT_STRUCTURE = [
    {
        id: 'tax-return-info',
        title: 'Tax Return Information',
        iconName: 'InformationCircleIcon',
        fields: [
            { label: 'Due Date', field: 'dueDate' },
            { label: 'Tax Period Description', field: 'periodDescription' },
            { label: 'Period From', field: 'periodFrom' },
            { label: 'Period To', field: 'periodTo' },
            { label: 'Net Tax Position', field: 'netTaxPosition', labelPrefix: 'AED ' }
        ]
    },
    {
        id: 'taxpayer-details',
        title: 'Taxpayer Details',
        iconName: 'IdentificationIcon',
        fields: [
            { label: 'Name', field: 'taxableNameEn' },
            { label: 'Entity Type', field: 'entityType' },
            { label: 'Entity Sub-Type', field: 'entitySubType' },
            { label: 'TRN', field: 'trn' },
            { label: 'Primary Business', field: 'primaryBusiness' }
        ]
    },
    {
        id: 'address-details',
        title: 'Address Details',
        iconName: 'BuildingOfficeIcon',
        fields: [
            { label: 'Address', field: 'address', colSpan: true },
            { label: 'Mobile Number', field: 'mobileNumber' },
            { label: 'Landline Number', field: 'landlineNumber' },
            { label: 'Email ID', field: 'emailId' },
            { label: 'P.O.Box (Optional)', field: 'poBox' }
        ]
    },
    {
        id: 'profit-loss',
        title: 'Financial Results',
        iconName: 'IncomeIcon',
        fields: [
            { label: 'Operating Revenue', field: 'operatingRevenue', type: 'number' },
            { label: 'Expenditure Incurred', field: 'derivingRevenueExpenses', type: 'number' },
            { label: 'Gross Profit', field: 'grossProfit', type: 'number', highlight: true },
            { label: '--- Non-operating Expense ---', field: '_header_non_op', type: 'header' },
            { label: 'Salaries and wages', field: 'salaries', type: 'number' },
            { label: 'Depreciation and amortisation', field: 'depreciation', type: 'number' },
            { label: 'Fines and penalties', field: 'fines', type: 'number' },
            { label: 'Donations', field: 'donations', type: 'number' },
            { label: 'Client entertainment', field: 'entertainment', type: 'number' },
            { label: 'Other expenses', field: 'otherExpenses', type: 'number' },
            { label: 'Non-operating expenses', field: 'nonOpExpensesExcl', type: 'number', highlight: true },
            { label: '--- Non-operating Revenue ---', field: '_header_non_op_rev', type: 'header' },
            { label: 'Dividends received', field: 'dividendsReceived', type: 'number' },
            { label: 'Other non-operating Revenue', field: 'otherNonOpRevenue', type: 'number' },
            { label: '--- Other Items ---', field: '_header_other', type: 'header' },
            { label: 'Interest Income', field: 'interestIncome', type: 'number' },
            { label: 'Interest Expenditure', field: 'interestExpense', type: 'number' },
            { label: 'Net Interest Income / (Expense)', field: 'netInterest', type: 'number', highlight: true },
            { label: 'Gains on disposal of assets', field: 'gainAssetDisposal', type: 'number' },
            { label: 'Losses on disposal of assets', field: 'lossAssetDisposal', type: 'number' },
            { label: 'Net gains / (losses) on assets', field: 'netGainsAsset', type: 'number', highlight: true },
            { label: 'Foreign exchange gains', field: 'forexGain', type: 'number' },
            { label: 'Foreign exchange losses', field: 'forexLoss', type: 'number' },
            { label: 'Net Gains / (losses) on Forex', field: 'netForex', type: 'number', highlight: true },
            { label: 'Net Profit', field: 'netProfit', type: 'number', highlight: true },
            { label: '--- Other Comprehensive Income ---', field: '_header_oci', type: 'header' },
            { label: 'Income (Non-reclassified)', field: 'ociIncomeNoRec', type: 'number' },
            { label: 'Losses (Non-reclassified)', field: 'ociLossNoRec', type: 'number' },
            { label: 'Income (Reclassified)', field: 'ociIncomeRec', type: 'number' },
            { label: 'Losses (Reclassified)', field: 'ociLossRec', type: 'number' },
            { label: 'Other income (net of tax)', field: 'ociOtherIncome', type: 'number' },
            { label: 'Other losses (net of tax)', field: 'ociOtherLoss', type: 'number' },
            { label: 'Total comprehensive income', field: 'totalComprehensiveIncome', type: 'number', highlight: true }
        ]
    },
    {
        id: 'financial-position',
        title: 'Statement of Financial Position',
        iconName: 'AssetIcon',
        fields: [
            { label: '--- Assets ---', field: '_header_assets', type: 'header' },
            { label: 'Total current assets', field: 'totalCurrentAssets', type: 'number', highlight: true },
            { label: '--- Non Current Assets ---', field: '_header_non_current_assets', type: 'header' },
            { label: 'Property, Plant and Equipment', field: 'ppe', type: 'number' },
            { label: 'Intangible assets', field: 'intangibleAssets', type: 'number' },
            { label: 'Financial assets', field: 'financialAssets', type: 'number' },
            { label: 'Other non-current assets', field: 'otherNonCurrentAssets', type: 'number' },
            { label: 'Total non-current assets', field: 'totalNonCurrentAssets', type: 'number', highlight: true },
            { label: 'Total assets', field: 'totalAssets', type: 'number', highlight: true },
            { label: '--- Liabilities ---', field: '_header_liabilities', type: 'header' },
            { label: 'Total current liabilities', field: 'totalCurrentLiabilities', type: 'number', highlight: true },
            { label: 'Total non-current liabilities', field: 'totalNonCurrentLiabilities', type: 'number', highlight: true },
            { label: 'Total liabilities', field: 'totalLiabilities', type: 'number', highlight: true },
            { label: '--- Equity ---', field: '_header_equity', type: 'header' },
            { label: 'Share capital', field: 'shareCapital', type: 'number' },
            { label: 'Retained earnings', field: 'retainedEarnings', type: 'number' },
            { label: 'Other equity', field: 'otherEquity', type: 'number' },
            { label: 'Total equity', field: 'totalEquity', type: 'number', highlight: true },
            { label: 'Total equity and liabilities', field: 'totalEquityLiabilities', type: 'number', highlight: true }
        ]
    },
    {
        id: 'other-data',
        title: 'Other Data',
        iconName: 'ListBulletIcon',
        fields: [
            { label: 'Avg Employees during Period', field: 'avgEmployees', type: 'number' },
            { label: 'EBITDA', field: 'ebitda', type: 'number', highlight: true },
            { label: 'Audited Financials?', field: 'audited' }
        ]
    },
    {
        id: 'tax-summary',
        title: 'Tax Computation',
        iconName: 'ChartBarIcon',
        fields: [
            { label: '--- Accounting Income ---', field: '_header_acc_inc', type: 'header' },
            { label: '1. Accounting Income', field: 'accountingIncomeTaxPeriod', type: 'number' },
            { label: '--- Accounting Adjustments ---', field: '_header_acc_adj', type: 'header' },
            { label: '2. Share of profits / (losses) (Equity Method)', field: 'shareProfitsEquity', type: 'number' },
            { label: '3. Profits / (losses) from Uninc Partnerships', field: 'accountingNetProfitsUninc', type: 'number' },
            { label: '4. Gains / (losses) on Uninc Partnerships', field: 'gainsDisposalUninc', type: 'number' },
            { label: '5. Gains / (losses) not in income statement', field: 'gainsLossesReportedFS', type: 'number' },
            { label: '6. Realisation basis adjustments', field: 'realisationBasisAdj', type: 'number' },
            { label: '7. Transitional adjustments', field: 'transitionalAdj', type: 'number' },
            { label: '--- Exempt Income ---', field: '_header_exempt_inc', type: 'header' },
            { label: '8. Dividends from Resident Persons', field: 'dividendsResident', type: 'number' },
            { label: '9. Income / (losses) from Participating Interests', field: 'incomeParticipatingInterests', type: 'number' },
            { label: '10. Taxable Income from Foreign PE', field: 'taxableIncomeForeignPE', type: 'number' },
            { label: '11. Income from aircraft / shipping', field: 'incomeIntlAircraftShipping', type: 'number' },
            { label: '--- Reliefs ---', field: '_header_reliefs', type: 'header' },
            { label: '12. Qualifying Group adjustments', field: 'adjQualifyingGroup', type: 'number' },
            { label: '13. Business Restructuring Relief', field: 'adjBusinessRestructuring', type: 'number' },
            { label: '--- Non-deductible Expenditure ---', field: '_header_non_ded_exp', type: 'header' },
            { label: '14. Non-deductible expenditure adj', field: 'adjNonDeductibleExp', type: 'number' },
            { label: '15. Interest expenditure adj', field: 'adjInterestExp', type: 'number' },
            { label: '--- Other adjustments ---', field: '_header_other_adj_tax', type: 'header' },
            { label: '16. Related Parties transactions', field: 'adjRelatedParties', type: 'number' },
            { label: '17. Qualifying Investment Funds', field: 'adjQualifyingInvestmentFunds', type: 'number' },
            { label: '18. Other adjustments', field: 'otherAdjustmentsTax', type: 'number' },
            { label: '--- Tax Liability and Tax Credits ---', field: '_header_tax_lia_cred', type: 'header' },
            { label: '19. Taxable Income (Before Adj)', field: 'taxableIncomeBeforeAdj', type: 'number' },
            { label: '20. Tax Losses utilised', field: 'taxLossesUtilised', type: 'number' },
            { label: '21. Tax Losses claimed', field: 'taxLossesClaimed', type: 'number' },
            { label: '22. Pre-Grouping Tax Losses', field: 'preGroupingLosses', type: 'number' },
            { label: '23. Taxable Income', field: 'taxableIncomeTaxPeriod', type: 'number', highlight: true },
            { label: '24. Tax Liability', field: 'corporateTaxLiability', type: 'number', highlight: true },
            { label: '25. Tax Credits', field: 'taxCredits', type: 'number' },
            { label: '26. Tax Payable', field: 'corporateTaxPayable', type: 'number', highlight: true }
        ]
    },
    {
        id: 'declaration',
        title: 'Review and Declaration',
        iconName: 'ClipboardCheckIcon',
        fields: [
            { label: 'First Name (EN)', field: 'declarationFirstNameEn' },
            { label: 'First Name (AR)', field: 'declarationFirstNameAr' },
            { label: 'Last Name (EN)', field: 'declarationLastNameEn' },
            { label: 'Last Name (AR)', field: 'declarationLastNameAr' },
            { label: 'Mobile Number', field: 'declarationMobile' },
            { label: 'Email ID', field: 'declarationEmail' },
            { label: 'Date of Submission', field: 'declarationDate' },
            { label: 'Prepared By', field: 'preparedBy' },
            { label: 'Declaration Confirmed', field: 'declarationConfirmed' }
        ]
    }
];

export interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

export interface ICtType2Context {
    // Stage/Step
    currentStep: number;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;

    // Props
    appState: 'initial' | 'loading' | 'success' | 'error';
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
    companyTrn?: string;
    onReset: () => void;
    summary?: BankStatementSummary | null;
    company: Company | null;
    fileSummaries?: Record<string, BankStatementSummary>;
    statementFiles?: File[];
    invoiceFiles?: File[];
    onVatInvoiceFilesSelect: (files: File[]) => void;
    pdfPassword: string;
    onPasswordChange: (password: string) => void;
    onCompanyNameChange: (name: string) => void;
    onCompanyTrnChange: (trn: string) => void;
    onProcess?: (mode?: 'invoices' | 'all') => Promise<void> | void;
    progress: number;
    progressMessage: string;

    // State
    editedTransactions: Transaction[];
    setEditedTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    adjustedTrialBalance: TrialBalanceEntry[] | null;
    setAdjustedTrialBalance: React.Dispatch<React.SetStateAction<TrialBalanceEntry[] | null>>;
    openingBalancesData: TrialBalanceEntry[];
    setOpeningBalancesData: React.Dispatch<React.SetStateAction<TrialBalanceEntry[]>>;
    additionalFiles: File[];
    setAdditionalFiles: React.Dispatch<React.SetStateAction<File[]>>;
    additionalDetails: Record<string, any>;
    setAdditionalDetails: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    vatManualAdjustments: Record<string, Record<string, string>>;
    setVatManualAdjustments: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
    openingBalanceFiles: File[];
    setOpeningBalanceFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isExtracting: boolean;
    setIsExtracting: React.Dispatch<React.SetStateAction<boolean>>;
    isExtractingOpeningBalances: boolean;
    setIsExtractingOpeningBalances: React.Dispatch<React.SetStateAction<boolean>>;
    isExtractingTB: boolean;
    setIsExtractingTB: React.Dispatch<React.SetStateAction<boolean>>;
    louFiles: File[];
    setLouFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isAutoCategorizing: boolean;
    setIsAutoCategorizing: React.Dispatch<React.SetStateAction<boolean>>;
    isProcessingInvoices: boolean;
    setIsProcessingInvoices: React.Dispatch<React.SetStateAction<boolean>>;
    hasProcessedInvoices: boolean;
    setHasProcessedInvoices: React.Dispatch<React.SetStateAction<boolean>>;
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    filterCategory: string;
    setFilterCategory: React.Dispatch<React.SetStateAction<string>>;
    selectedFileFilter: string;
    setSelectedFileFilter: React.Dispatch<React.SetStateAction<string>>;
    summaryFileFilter: string;
    setSummaryFileFilter: React.Dispatch<React.SetStateAction<string>>;
    selectedIndices: Set<number>;
    setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
    findText: string;
    setFindText: React.Dispatch<React.SetStateAction<string>>;
    replaceCategory: string;
    setReplaceCategory: React.Dispatch<React.SetStateAction<string>>;
    bulkCategory: string;
    setBulkCategory: React.Dispatch<React.SetStateAction<string>>;
    customCategories: string[];
    setCustomCategories: React.Dispatch<React.SetStateAction<string[]>>;
    showAddCategoryModal: boolean;
    setShowAddCategoryModal: React.Dispatch<React.SetStateAction<boolean>>;
    newCategoryMain: string;
    setNewCategoryMain: React.Dispatch<React.SetStateAction<string>>;
    newCategorySub: string;
    setNewCategorySub: React.Dispatch<React.SetStateAction<string>>;
    newCategoryError: string | null;
    setNewCategoryError: React.Dispatch<React.SetStateAction<string | null>>;
    pendingCategoryContext: { type: 'row' | 'bulk' | 'replace' | 'filter'; rowIndex?: number; } | null;
    setPendingCategoryContext: React.Dispatch<React.SetStateAction<{ type: 'row' | 'bulk' | 'replace' | 'filter'; rowIndex?: number; } | null>>;
    openTbSection: string | null;
    setOpenTbSection: React.Dispatch<React.SetStateAction<string | null>>;
    openObSection: string | null;
    setOpenObSection: React.Dispatch<React.SetStateAction<string | null>>;
    openReportSection: string | null;
    setOpenReportSection: React.Dispatch<React.SetStateAction<string | null>>;
    showVatFlowModal: boolean;
    setShowVatFlowModal: React.Dispatch<React.SetStateAction<boolean>>;
    vatFlowQuestion: 1 | 2;
    setVatFlowQuestion: React.Dispatch<React.SetStateAction<1 | 2>>;
    breakdowns: Record<string, BreakdownEntry[]>;
    setBreakdowns: React.Dispatch<React.SetStateAction<Record<string, BreakdownEntry[]>>>;
    reconFilter: 'ALL' | 'Matched' | 'Unmatched';
    setReconFilter: React.Dispatch<React.SetStateAction<'ALL' | 'Matched' | 'Unmatched'>>;
    statementPreviewUrls: string[];
    invoicePreviewUrls: string[];
    showGlobalAddAccountModal: boolean;
    setShowGlobalAddAccountModal: React.Dispatch<React.SetStateAction<boolean>>;
    newGlobalAccountMain: string;
    setNewGlobalAccountMain: React.Dispatch<React.SetStateAction<string>>;
    newGlobalAccountChild: string;
    setNewGlobalAccountChild: React.Dispatch<React.SetStateAction<string>>;
    newGlobalAccountName: string;
    setNewGlobalAccountName: React.Dispatch<React.SetStateAction<string>>;
    previewPage: number;
    setPreviewPage: React.Dispatch<React.SetStateAction<number>>;
    showPreviewPanel: boolean;
    setShowPreviewPanel: React.Dispatch<React.SetStateAction<boolean>>;
    questionnaireAnswers: Record<number, string>;
    setQuestionnaireAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    pnlValues: Record<string, number>;
    setPnlValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    balanceSheetValues: Record<string, number>;
    setBalanceSheetValues: React.Dispatch<React.SetStateAction<Record<string, number>>>;
    pnlStructure: any;
    setPnlStructure: React.Dispatch<React.SetStateAction<any>>;
    bsStructure: any;
    setBsStructure: React.Dispatch<React.SetStateAction<any>>;
    pnlWorkingNotes: Record<string, WorkingNoteEntry[]>;
    setPnlWorkingNotes: React.Dispatch<React.SetStateAction<Record<string, WorkingNoteEntry[]>>>;
    bsWorkingNotes: Record<string, WorkingNoteEntry[]>;
    setBsWorkingNotes: React.Dispatch<React.SetStateAction<Record<string, WorkingNoteEntry[]>>>;
    reportForm: any;
    setReportForm: React.Dispatch<React.SetStateAction<any>>;
    isDownloadingPdf: boolean;
    setIsDownloadingPdf: React.Dispatch<React.SetStateAction<boolean>>;
    workingNoteModalOpen: boolean;
    setWorkingNoteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    currentWorkingAccount: string | null;
    setCurrentWorkingAccount: React.Dispatch<React.SetStateAction<string | null>>;
    tempBreakdown: BreakdownEntry[];
    setTempBreakdown: React.Dispatch<React.SetStateAction<BreakdownEntry[]>>;

    // Handlers
    handleOpenWorkingNote: (accountLabel: string) => void;
    uniqueFiles: string[];
    ftaFormValues: any;
    summaryData: any[];
    statementReconciliationData: any[];
    invoiceTotals: any;
    vatStepData: any;
    handleBack: () => void;
    handleCategorySelection?: (id: string, category: string) => void;
    handleBulkCategoryChange?: () => void;
    selectedTxs?: string[];
    setSelectedTxs?: React.Dispatch<React.SetStateAction<string[]>>;
    handleObCellChange: (account: string, field: 'debit' | 'credit', value: string) => void;
    handleExportStepOpeningBalances?: () => void;
    handleOpeningBalancesComplete?: () => void;
    obFileInputRef?: React.RefObject<HTMLInputElement>;
}

export const formatNumber = (amount: number | null | undefined) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    if (Math.abs(amount) < 0.01) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const roundAmount = (amount: number) => Math.round(Number(amount) || 0);

export const formatWholeNumber = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0';
    const rounded = roundAmount(amount);
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(rounded);
};

export const formatDate = (dateStr: any) => {
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
