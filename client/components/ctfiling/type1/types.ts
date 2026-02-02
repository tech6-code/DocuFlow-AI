import React from 'react';
import { Transaction, TrialBalanceEntry, FinancialStatements, Company, BankStatementSummary } from '../../../types';

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
            { label: '23. Taxable Income / (Tax Loss) for the Tax Period (AED)', field: 'taxableIncomeTaxPeriod', type: 'number', highlight: true },
            { label: '24. Corporate Tax Liability (AED)', field: 'corporateTaxLiability', type: 'number', highlight: true },
            { label: '25. Tax Credits', field: 'taxCredits', type: 'number' },
            { label: '26. Tax Payable (AED)', field: 'corporateTaxPayable', type: 'number', highlight: true }
        ]
    },
    {
        id: 'declaration',
        title: 'Review and Declaration',
        iconName: 'ClipboardCheckIcon',
        fields: [
            { label: 'First Name in English', field: 'declarationFirstNameEn' },
            { label: 'First Name in Arabic', field: 'declarationFirstNameAr' },
            { label: 'Last Name in English', field: 'declarationLastNameEn' },
            { label: 'Last Name in Arabic', field: 'declarationLastNameAr' },
            { label: 'Mobile Number', field: 'declarationMobile' },
            { label: 'Email ID', field: 'declarationEmail' },
            { label: 'Date of Submission', field: 'declarationDate' },
            { label: 'Confirm who the Tax Return is being prepared by', field: 'preparedBy' },
            { label: 'I confirm the Declaration', field: 'declarationConfirmed' }
        ]
    }
];


export interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

export interface CtType1Context {
    // Current Step (from URL or parent state)
    currentStep: number;

    // Core Data
    transactions: Transaction[];
    editedTransactions: Transaction[];
    setEditedTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;

    // Trial Balance & Audit Report
    trialBalance: TrialBalanceEntry[] | null;
    auditReport: FinancialStatements | null;
    isGeneratingTrialBalance: boolean;
    isGeneratingAuditReport: boolean;
    reportsError: string | null;

    // Handlers
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onGenerateTrialBalance: (transactions: Transaction[]) => void;
    onGenerateAuditReport: (trialBalance: TrialBalanceEntry[], companyName: string) => void;

    // Metadata
    currency: string;
    companyName: string;
    company: Company | null;
    onReset: () => void;

    // Step 1 & 2 Shared Metadata
    uniqueFiles: string[];

    // Step 1 Specific State
    selectedFileFilter: string;
    setSelectedFileFilter: React.Dispatch<React.SetStateAction<string>>;
    filePreviews: Record<string, string[]>;

    // Step 2 Specific State
    summaryFileFilter: string;
    setSummaryFileFilter: React.Dispatch<React.SetStateAction<string>>;
    summaryData: any[];
    reconciliationData: any[];
    overallSummary: any;

    // Handlers
    handleExportStepSummary: () => void;
    handleSummarizationContinue: () => void;
    handleBack: () => void;

    // Step 3 Specific State
    additionalFiles: File[];
    setAdditionalFiles: React.Dispatch<React.SetStateAction<File[]>>;
    vatProcessingStatus: string;
    isVatProcessing: boolean;
    handleVatUploadContinue: () => void;

    // Step 4 Specific State
    vatStepData: any;
    vatManualAdjustments: Record<string, Record<string, string>>;
    handleVatAdjustmentChange: (periodId: string, field: string, value: string) => void;
    handleExportVatSummary: () => void;
    handleVatSummarizationContinue: () => void;

    // Step 5 Specific State
    openingBalancesData: any;
    setOpeningBalancesData: React.Dispatch<React.SetStateAction<any>>;
    handleOpeningBalancesComplete: () => void;
    openingBalanceFiles: File[];
    setOpeningBalanceFiles: React.Dispatch<React.SetStateAction<File[]>>;
    handleExtractOpeningBalances: () => void;
    isExtractingOpeningBalances: boolean;
    handleExportOpeningBalances: () => void;

    // Step 6 Specific State
    adjustedTrialBalance: TrialBalanceEntry[] | null;
    setShowGlobalAddAccountModal: (val: boolean) => void;
    openTbSection: string | null;
    setOpenTbSection: (val: string | null) => void;
    handleOpenWorkingNote: (label: string) => void;
    handleCellChange: (label: string, field: 'debit' | 'credit', value: string) => void;
    handleExportStep4: () => void;
    handleContinueToProfitAndLoss: () => void;
    customRows: { parent: string, subParent?: string, label: string }[];
    breakdowns: Record<string, BreakdownEntry[]>;

    handleDownloadPDF: () => void;
    isDownloadingPdf: boolean;

    // Step 7 Specific State
    pnlStructure: any;
    pnlWorkingNotes: Record<string, BreakdownEntry[]>;
    handlePnlChange: (id: string, field: 'currentYear' | 'previousYear', value: number) => void;
    handleExportStepPnl: () => void;
    handleAddPnlAccount: (mainCat: string, subCat: string, name: string) => void;
    handleUpdatePnlWorkingNote: (accountId: string, notes: any[]) => void;
    handleContinueToBalanceSheet: () => void;
    computedValues: { pnl: any; bs: any };

    // Step 8 Specific State
    bsStructure: any;
    bsWorkingNotes: Record<string, BreakdownEntry[]>;
    handleBalanceSheetChange: (id: string, field: 'currentYear' | 'previousYear', value: number) => void;
    handleExportStepBS: () => void;
    handleAddBsAccount: (mainCat: string, subCat: string, name: string) => void;
    handleUpdateBsWorkingNote: (accountId: string, notes: any[]) => void;
    handleContinueToLOU: () => void;

    // Step 9 Specific State
    louFiles: File[];
    setLouFiles: React.Dispatch<React.SetStateAction<File[]>>;
    handleContinueToQuestionnaire: () => void;

    // Step 10 Specific State
    questionnaireAnswers: Record<string, string>;
    setQuestionnaireAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleContinueToReport: () => void;

    // Step 11 Specific State
    ftaFormValues: any;
    reportForm: any;
    handleReportFormChange: (field: string, value: any) => void;
    handleExportStepReport: () => void;
    openReportSection: string | null;
    setOpenReportSection: (val: string | null) => void;

    // Shared State for Steps
    customCategories: string[];
    setCustomCategories: React.Dispatch<React.SetStateAction<string[]>>;
    balanceValidation: {
        isValid: boolean;
        diff: number;
        actualClosing: number;
        calculatedClosing: number;
        currency: string;
        anyInvalid?: boolean;
    };
    activeSummary: any;

    // Step 1 Specific State (some of these might be moved to local step state if they don't need to be shared)
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    filterCategory: string;
    setFilterCategory: React.Dispatch<React.SetStateAction<string>>;
    isAutoCategorizing: boolean;
    bulkCategory: string;
    setBulkCategory: React.Dispatch<React.SetStateAction<string>>;
    selectedIndices: Set<number>;
    setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
    findText: string;
    setFindText: React.Dispatch<React.SetStateAction<string>>;
    replaceCategory: string;
    setReplaceCategory: React.Dispatch<React.SetStateAction<string>>;
    showPreviewPanel: boolean;
    setShowPreviewPanel: React.Dispatch<React.SetStateAction<boolean>>;
    previewPage: number;
    setPreviewPage: React.Dispatch<React.SetStateAction<number>>;

    // Handlers (extracted from CtType1Results)
    handleCategorySelection: (val: string, options: { type: 'row' | 'bulk' | 'filter' | 'replace', rowIndex?: number }) => void;
    handleAutoCategorize: () => void;
    handleBulkApplyCategory: () => void;
    handleBulkDelete: () => void;
    handleFindReplace: () => void;
    handleSelectAll: (checked: boolean) => void;
    handleSelectRow: (index: number, checked: boolean) => void;
    handleDeleteTransaction: (index: number) => void;
    handleExportStep1: () => void;
    handleConfirmCategories: () => void;
    handleClearFilters: () => void;
}

export const CT_TYPE1_ACCOUNT_MAPPING: Record<string, string> = {
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

export const CT_TYPE1_TB_STRUCTURE = [
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

export interface CtType1Context {
    // Current Step (from URL or parent state)
    currentStep: number;

    // Core Data
    transactions: Transaction[];
    editedTransactions: Transaction[];
    setEditedTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;

    // Trial Balance & Audit Report
    trialBalance: TrialBalanceEntry[] | null;
    auditReport: FinancialStatements | null;
    isGeneratingTrialBalance: boolean;
    isGeneratingAuditReport: boolean;
    reportsError: string | null;

    // Handlers
    onUpdateTransactions: (transactions: Transaction[]) => void;
    onGenerateTrialBalance: (transactions: Transaction[]) => void;
    onGenerateAuditReport: (trialBalance: TrialBalanceEntry[], companyName: string) => void;

    // Metadata
    currency: string;
    companyName: string;
    company: Company | null;
    onReset: () => void;

    // Step 1 & 2 Shared Metadata
    uniqueFiles: string[];

    // Step 1 Specific State
    selectedFileFilter: string;
    setSelectedFileFilter: React.Dispatch<React.SetStateAction<string>>;
    filePreviews: Record<string, string[]>;

    // Step 2 Specific State
    summaryFileFilter: string;
    setSummaryFileFilter: React.Dispatch<React.SetStateAction<string>>;
    summaryData: any[];
    reconciliationData: any[];
    overallSummary: any;

    // Handlers
    handleExportStepSummary: () => void;
    handleSummarizationContinue: () => void;
    handleBack: () => void;

    // Step 3 Specific State
    additionalFiles: File[];
    setAdditionalFiles: React.Dispatch<React.SetStateAction<File[]>>;
    vatProcessingStatus: string;
    isVatProcessing: boolean;
    handleVatUploadContinue: () => void;

    // Step 4 Specific State
    vatStepData: any;
    vatManualAdjustments: Record<string, Record<string, string>>;
    handleVatAdjustmentChange: (periodId: string, field: string, value: string) => void;
    handleExportVatSummary: () => void;
    handleVatSummarizationContinue: () => void;

    // Step 5 Specific State
    openingBalancesData: any;
    setOpeningBalancesData: React.Dispatch<React.SetStateAction<any>>;
    handleOpeningBalancesComplete: () => void;
    openingBalanceFiles: File[];
    setOpeningBalanceFiles: React.Dispatch<React.SetStateAction<File[]>>;
    handleExtractOpeningBalances: () => void;
    isExtractingOpeningBalances: boolean;
    handleExportOpeningBalances: () => void;

    // Step 6 Specific State
    adjustedTrialBalance: TrialBalanceEntry[] | null;
    setShowGlobalAddAccountModal: (val: boolean) => void;
    openTbSection: string | null;
    setOpenTbSection: (val: string | null) => void;
    handleOpenWorkingNote: (label: string) => void;
    handleCellChange: (label: string, field: 'debit' | 'credit', value: string) => void;
    handleExportStep4: () => void;
    handleContinueToProfitAndLoss: () => void;
    customRows: { parent: string, subParent?: string, label: string }[];
    breakdowns: Record<string, BreakdownEntry[]>;

    handleDownloadPDF: () => void;
    isDownloadingPdf: boolean;

    // Step 7 Specific State
    pnlStructure: any;
    pnlWorkingNotes: Record<string, BreakdownEntry[]>;
    handlePnlChange: (id: string, field: 'currentYear' | 'previousYear', value: number) => void;
    handleExportStepPnl: () => void;
    handleAddPnlAccount: (mainCat: string, subCat: string, name: string) => void;
    handleUpdatePnlWorkingNote: (accountId: string, notes: any[]) => void;
    handleContinueToBalanceSheet: () => void;
    computedValues: { pnl: any; bs: any };

    // Step 8 Specific State
    bsStructure: any;
    bsWorkingNotes: Record<string, BreakdownEntry[]>;
    handleBalanceSheetChange: (id: string, field: 'currentYear' | 'previousYear', value: number) => void;
    handleExportStepBS: () => void;
    handleAddBsAccount: (mainCat: string, subCat: string, name: string) => void;
    handleUpdateBsWorkingNote: (accountId: string, notes: any[]) => void;
    handleContinueToLOU: () => void;

    // Step 9 Specific State
    louFiles: File[];
    setLouFiles: React.Dispatch<React.SetStateAction<File[]>>;
    handleContinueToQuestionnaire: () => void;

    // Step 10 Specific State
    questionnaireAnswers: Record<string, string>;
    setQuestionnaireAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleContinueToReport: () => void;

    // Step 11 Specific State
    ftaFormValues: any;
    reportForm: any;
    handleReportFormChange: (field: string, value: any) => void;
    handleExportStepReport: () => void;
    openReportSection: string | null;
    setOpenReportSection: (val: string | null) => void;

    // Shared State for Steps
    customCategories: string[];
    setCustomCategories: React.Dispatch<React.SetStateAction<string[]>>;
    balanceValidation: {
        isValid: boolean;
        diff: number;
        actualClosing: number;
        calculatedClosing: number;
        currency: string;
        anyInvalid?: boolean;
    };
    activeSummary: any;

    // Step 1 Specific State
    searchTerm: string;
    setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
    filterCategory: string;
    setFilterCategory: React.Dispatch<React.SetStateAction<string>>;
    isAutoCategorizing: boolean;
    bulkCategory: string;
    setBulkCategory: React.Dispatch<React.SetStateAction<string>>;
    selectedIndices: Set<number>;
    setSelectedIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
    findText: string;
    setFindText: React.Dispatch<React.SetStateAction<string>>;
    replaceCategory: string;
    setReplaceCategory: React.Dispatch<React.SetStateAction<string>>;
    showPreviewPanel: boolean;
    setShowPreviewPanel: React.Dispatch<React.SetStateAction<boolean>>;
    previewPage: number;
    setPreviewPage: React.Dispatch<React.SetStateAction<number>>;

    // Handlers
    handleCategorySelection: (val: string, options: { type: 'row' | 'bulk' | 'filter' | 'replace', rowIndex?: number }) => void;
    handleAutoCategorize: () => void;
    handleBulkApplyCategory: () => void;
    handleBulkDelete: () => void;
    handleFindReplace: () => void;
    handleSelectAll: (checked: boolean) => void;
    handleSelectRow: (index: number, checked: boolean) => void;
    handleDeleteTransaction: (index: number) => void;
    handleExportStep1: () => void;
    handleConfirmCategories: () => void;
    handleClearFilters: () => void;
}
