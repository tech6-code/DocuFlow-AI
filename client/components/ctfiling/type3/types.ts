
import React from 'react';
import { Transaction, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, Company, WorkingNoteEntry as GlobalWorkingNoteEntry } from '../../../types';
import { ProfitAndLossItem } from '../../ProfitAndLossStep';
import { BalanceSheetItem } from '../../BalanceSheetStep';

export type WorkingNoteEntry = GlobalWorkingNoteEntry;
export type { ProfitAndLossItem, BalanceSheetItem };
export type { TrialBalanceEntry, OpeningBalanceCategory, Transaction, FinancialStatements, Company };

export interface ICtType3Context {
    currentStep: number;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;

    // Data
    trialBalance: TrialBalanceEntry[] | null;
    auditReport: FinancialStatements | null;
    company: Company | null;
    currency: string;
    companyName: string;

    // State
    openingBalancesData: OpeningBalanceCategory[];
    setOpeningBalancesData: React.Dispatch<React.SetStateAction<OpeningBalanceCategory[]>>;
    adjustedTrialBalance: TrialBalanceEntry[] | null;
    setAdjustedTrialBalance: React.Dispatch<React.SetStateAction<TrialBalanceEntry[] | null>>;
    additionalFiles: File[];
    setAdditionalFiles: React.Dispatch<React.SetStateAction<File[]>>;
    additionalDetails: Record<string, any>;
    setAdditionalDetails: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    vatManualAdjustments: Record<string, Record<string, string>>;
    setVatManualAdjustments: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>;
    openingBalanceFiles: File[];
    setOpeningBalanceFiles: React.Dispatch<React.SetStateAction<File[]>>;
    summaryFileFilter: string;

    isExtracting: boolean;
    setIsExtracting: React.Dispatch<React.SetStateAction<boolean>>;
    isExtractingOpeningBalances: boolean;
    setIsExtractingOpeningBalances: React.Dispatch<React.SetStateAction<boolean>>;
    louFiles: File[];
    setLouFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isExtractingTB: boolean;
    setIsExtractingTB: React.Dispatch<React.SetStateAction<boolean>>;
    extractionStatus: string;
    setExtractionStatus: React.Dispatch<React.SetStateAction<string>>;
    extractionAlert: { type: 'error' | 'warning' | 'success', message: string } | null;
    setExtractionAlert: React.Dispatch<React.SetStateAction<{ type: 'error' | 'warning' | 'success', message: string } | null>>;
    questionnaireAnswers: Record<number, string>;
    setQuestionnaireAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
    openTbSection: string | null;
    setOpenTbSection: React.Dispatch<React.SetStateAction<string | null>>;
    openReportSection: string | null;
    setOpenReportSection: React.Dispatch<React.SetStateAction<string | null>>;
    showVatConfirm: boolean;
    setShowVatConfirm: React.Dispatch<React.SetStateAction<boolean>>;

    // Auto populate trigger
    autoPopulateTrigger: number;
    setAutoPopulateTrigger: React.Dispatch<React.SetStateAction<number>>;

    // Working Notes
    obWorkingNotes: Record<string, WorkingNoteEntry[]>;
    setObWorkingNotes: React.Dispatch<React.SetStateAction<Record<string, WorkingNoteEntry[]>>>;
    tbWorkingNotes: Record<string, { description: string, debit: number, credit: number }[]>;
    setTbWorkingNotes: React.Dispatch<React.SetStateAction<Record<string, { description: string, debit: number, credit: number }[]>>>;
    pnlWorkingNotes: Record<string, WorkingNoteEntry[]>;
    setPnlWorkingNotes: React.Dispatch<React.SetStateAction<Record<string, WorkingNoteEntry[]>>>;
    bsWorkingNotes: Record<string, WorkingNoteEntry[]>;
    setBsWorkingNotes: React.Dispatch<React.SetStateAction<Record<string, WorkingNoteEntry[]>>>;

    // Global Account Modal
    showGlobalAddAccountModal: boolean;
    setShowGlobalAddAccountModal: React.Dispatch<React.SetStateAction<boolean>>;
    newGlobalAccountMain: string;
    setNewGlobalAccountMain: React.Dispatch<React.SetStateAction<string>>;
    newGlobalAccountName: string;
    setNewGlobalAccountName: React.Dispatch<React.SetStateAction<string>>;

    // Report Form
    reportForm: any;
    setReportForm: React.Dispatch<React.SetStateAction<any>>;
    ftaFormValues: any;

    // Financial Values
    pnlValues: Record<string, { currentYear: number; previousYear: number }>;
    setPnlValues: React.Dispatch<React.SetStateAction<Record<string, { currentYear: number; previousYear: number }>>>;
    balanceSheetValues: Record<string, { currentYear: number; previousYear: number }>;
    setBalanceSheetValues: React.Dispatch<React.SetStateAction<Record<string, { currentYear: number; previousYear: number }>>>;
    pnlStructure: ProfitAndLossItem[];
    setPnlStructure: React.Dispatch<React.SetStateAction<ProfitAndLossItem[]>>;
    bsStructure: BalanceSheetItem[];
    setBsStructure: React.Dispatch<React.SetStateAction<BalanceSheetItem[]>>;

    // Global Worker State
    workingNoteModalOpen: boolean;
    setWorkingNoteModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    currentWorkingAccount: string | null;
    setCurrentWorkingAccount: React.Dispatch<React.SetStateAction<string | null>>;
    tempBreakdown: any[];
    setTempBreakdown: React.Dispatch<React.SetStateAction<any[]>>;

    // Derived Data
    vatStepData: any;
    bankVatData: any;

    // Props / Handlers
    isGeneratingTrialBalance: boolean;
    isGeneratingAuditReport: boolean;
    reportsError: string | null;
    onGenerateTrialBalance: (transactions: Transaction[]) => void;
    onGenerateAuditReport: (trialBalance: TrialBalanceEntry[], companyName: string) => void;
    onReset: () => void;

    handleBack: () => void;
}

export const CtType3Context = React.createContext<ICtType3Context>({} as ICtType3Context);

export const useCtType3 = () => React.useContext(CtType3Context);

// Re-export constants
export const PNL_ITEMS: ProfitAndLossItem[] = [
    { id: 'revenue', label: 'Revenue', description: 'Total revenue from operations', type: 'credit', isHeader: false },
    { id: 'cost_of_revenue', label: 'Cost of Revenue', description: 'Direct costs attributable to revenue', type: 'debit', isHeader: false },
    { id: 'gross_profit', label: 'Gross Profit', description: 'Revenue less Cost of Revenue', type: 'total', isHeader: false },
    { id: 'administrative_expenses', label: 'General and Administrative Expenses', description: 'Operating expenses', type: 'debit', isHeader: false },
    { id: 'finance_costs', label: 'Finance Costs', description: 'Interest and other finance charges', type: 'debit', isHeader: false },
    { id: 'depreciation_ppe', label: 'Depreciation of PPE', description: 'Depreciation charges', type: 'debit', isHeader: false },
    { id: 'profit_loss_year', label: 'Net Profit / (Loss) for the Year', description: 'Net profit after tax', type: 'total', isHeader: false },
    { id: 'other_comprehensive_income', label: 'Other Comprehensive Income', description: 'Other comprehensive income items', type: 'credit', isHeader: true },
    { id: 'total_comprehensive_income', label: 'Total Comprehensive Income', description: 'Total income for the period', type: 'total', isHeader: false }
];

export const BS_ITEMS: BalanceSheetItem[] = [
    { id: 'assets', label: 'Assets', description: '', type: 'header', isHeader: true },
    { id: 'non_current_assets', label: 'Non-Current Assets', description: '', type: 'header', isHeader: true },
    { id: 'property_plant_equipment', label: 'Property, Plant and Equipment', description: 'Tangible assets', type: 'debit', isHeader: false },
    { id: 'total_non_current_assets', label: 'Total Non-Current Assets', description: '', type: 'total', isHeader: false },
    { id: 'current_assets', label: 'Current Assets', description: '', type: 'header', isHeader: true },
    { id: 'trade_receivables', label: 'Trade and Other Receivables', description: 'Amounts due from customers', type: 'debit', isHeader: false },
    { id: 'cash_bank_balances', label: 'Cash and Bank Balances', description: 'Liquid assets', type: 'debit', isHeader: false },
    { id: 'total_current_assets', label: 'Total Current Assets', description: '', type: 'total', isHeader: false },
    { id: 'total_assets', label: 'Total Assets', description: '', type: 'total', isHeader: false },

    { id: 'equity_liabilities', label: 'Equity and Liabilities', description: '', type: 'header', isHeader: true },
    { id: 'equity', label: 'Equity', description: '', type: 'header', isHeader: true },
    { id: 'share_capital', label: 'Share Capital', description: 'Capital invested by shareholders', type: 'credit', isHeader: false },
    { id: 'retained_earnings', label: 'Retained Earnings', description: 'Accumulated profits', type: 'credit', isHeader: false },
    { id: 'shareholders_current_accounts', label: 'Shareholders\' Current Accounts', description: 'Amounts due to/from shareholders', type: 'credit', isHeader: false },
    { id: 'total_equity', label: 'Total Equity', description: '', type: 'total', isHeader: false },

    { id: 'liabilities', label: 'Liabilities', description: '', type: 'header', isHeader: true },
    { id: 'non_current_liabilities', label: 'Non-Current Liabilities', description: '', type: 'header', isHeader: true },
    { id: 'total_non_current_liabilities', label: 'Total Non-Current Liabilities', description: '', type: 'total', isHeader: false },

    { id: 'current_liabilities', label: 'Current Liabilities', description: '', type: 'header', isHeader: true },
    { id: 'trade_other_payables', label: 'Trade and Other Payables', description: 'Amounts due to suppliers', type: 'credit', isHeader: false },
    { id: 'provisions_corporate_tax', label: 'Provisions for Corporate Tax', description: 'Tax liability provision', type: 'credit', isHeader: false },
    { id: 'total_current_liabilities', label: 'Total Current Liabilities', description: '', type: 'total', isHeader: false },
    { id: 'total_liabilities', label: 'Total Liabilities', description: '', type: 'total', isHeader: false },
    { id: 'total_equity_liabilities', label: 'Total Equity and Liabilities', description: '', type: 'total', isHeader: false }
];

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
        title: 'Corporate Tax Return Information',
        iconName: 'InformationCircleIcon',
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
        iconName: 'IdentificationIcon',
        fields: [
            { label: 'Taxable Person Name in English', field: 'taxableNameEn' },
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
        title: 'Statement of Profit or Loss',
        iconName: 'IncomeIcon',
        fields: [
            { label: 'Operating Revenue (AED)', field: 'operatingRevenue', type: 'number' },
            { label: 'Expenditure incurred in deriving operating revenue (AED)', field: 'derivingRevenueExpenses', type: 'number' },
            { label: 'Gross Profit / Loss (AED)', field: 'grossProfit', type: 'number', highlight: true },
            { label: '--- Non-operating Expense ---', field: '_header_non_op', type: 'header' },
            { label: 'Salaries, wages and related charges (AED)', field: 'salaries', type: 'number' },
            { label: 'Depreciation and amortisation (AED)', field: 'depreciation', type: 'number' },
            { label: 'Fines and penalties (AED)', field: 'fines', type: 'number' },
            { label: 'Donations (AED)', field: 'donations', type: 'number' },
            { label: 'Client entertainment expenses (AED)', field: 'entertainment', type: 'number' },
            { label: 'Other expenses (AED)', field: 'otherExpenses', type: 'number' },
            { label: 'Non-operating expenses (Excluding other items listed below) (AED)', field: 'nonOpExpensesExcl', type: 'number', highlight: true },
            { label: '--- Non-operating Revenue ---', field: '_header_non_op_rev', type: 'header' },
            { label: 'Dividends received (AED)', field: 'dividendsReceived', type: 'number' },
            { label: 'Other non-operating Revenue (AED)', field: 'otherNonOpRevenue', type: 'number' },
            { label: '--- Other Items ---', field: '_header_other', type: 'header' },
            { label: 'Interest Income (AED)', field: 'interestIncome', type: 'number' },
            { label: 'Interest Expenditure (AED)', field: 'interestExpense', type: 'number' },
            { label: 'Net Interest Income / (Expense) (AED)', field: 'netInterest', type: 'number', highlight: true },
            { label: 'Gains on disposal of assets (AED)', field: 'gainAssetDisposal', type: 'number' },
            { label: 'Losses on disposal of assets (AED)', field: 'lossAssetDisposal', type: 'number' },
            { label: 'Net gains / (losses) on disposal of assets (AED)', field: 'netGainsAsset', type: 'number', highlight: true },
            { label: 'Foreign exchange gains (AED)', field: 'forexGain', type: 'number' },
            { label: 'Foreign exchange losses (AED)', field: 'forexLoss', type: 'number' },
            { label: 'Net Gains / (losses) on foreign exchange (AED)', field: 'netForex', type: 'number', highlight: true },
            { label: 'Net profit / (loss) (AED)', field: 'netProfit', type: 'number', highlight: true },
            { label: '--- Statement of other Comprehensive Income ---', field: '_header_oci', type: 'header' },
            { label: 'Income that will not be reclassified to the income statement (AED)', field: 'ociIncomeNoRec', type: 'number' },
            { label: 'Losses that will not be reclassified to the income statement (AED)', field: 'ociLossNoRec', type: 'number' },
            { label: 'Income that may be reclassified to the income statement (AED)', field: 'ociIncomeRec', type: 'number' },
            { label: 'Losses that may be reclassified to the income statement (AED)', field: 'ociLossRec', type: 'number' },
            { label: 'Other income reported in other comprehensive income for the year, net of tax (AED)', field: 'ociOtherIncome', type: 'number' },
            { label: 'Other losses reported in other comprehensive income for the year, net of tax (AED)', field: 'ociOtherLoss', type: 'number' },
            { label: 'Total comprehensive income for the year (AED)', field: 'totalComprehensiveIncome', type: 'number', highlight: true }
        ]
    },
    {
        id: 'financial-position',
        title: 'Statement of Financial Position',
        iconName: 'AssetIcon',
        fields: [
            { label: '--- Assets ---', field: '_header_assets', type: 'header' },
            { label: 'Total current assets (AED)', field: 'totalCurrentAssets', type: 'number', highlight: true },
            { label: '--- Non Current Assets ---', field: '_header_non_current_assets', type: 'header' },
            { label: 'Property, Plant and Equipment (AED)', field: 'ppe', type: 'number' },
            { label: 'Intangible assets (AED)', field: 'intangibleAssets', type: 'number' },
            { label: 'Financial assets (AED)', field: 'financialAssets', type: 'number' },
            { label: 'Other non-current assets (AED)', field: 'otherNonCurrentAssets', type: 'number' },
            { label: 'Total non-current assets (AED)', field: 'totalNonCurrentAssets', type: 'number', highlight: true },
            { label: 'Total assets (AED)', field: 'totalAssets', type: 'number', highlight: true },
            { label: '--- Liabilities ---', field: '_header_liabilities', type: 'header' },
            { label: 'Total current liabilities (AED)', field: 'totalCurrentLiabilities', type: 'number', highlight: true },
            { label: 'Total non-current liabilities (AED)', field: 'totalNonCurrentLiabilities', type: 'number', highlight: true },
            { label: 'Total liabilities (AED)', field: 'totalLiabilities', type: 'number', highlight: true },
            { label: '--- Equity ---', field: '_header_equity', type: 'header' },
            { label: 'Share capital (AED)', field: 'shareCapital', type: 'number' },
            { label: 'Retained earnings (AED)', field: 'retainedEarnings', type: 'number' },
            { label: 'Other equity (AED)', field: 'otherEquity', type: 'number' },
            { label: 'Total equity (AED)', field: 'totalEquity', type: 'number', highlight: true },
            { label: 'Total equity and liabilities (AED)', field: 'totalEquityLiabilities', type: 'number', highlight: true }
        ]
    },
    {
        id: 'other-data',
        title: 'Other Data',
        iconName: 'ListBulletIcon',
        fields: [
            { label: 'Average number of employees during the Tax Period', field: 'avgEmployees', type: 'number' },
            { label: 'Earnings Before Interest, Tax, Depreciation and Amortisation (EBITDA) (AED)', field: 'ebitda', type: 'number', highlight: true },
            { label: 'Have the financial statements been audited?', field: 'audited' }
        ]
    },
    {
        id: 'tax-summary',
        title: 'Tax Summary',
        iconName: 'ChartBarIcon',
        fields: [
            { label: '--- Accounting Income ---', field: '_header_acc_inc', type: 'header' },
            { label: '1. Accounting Income for the Tax Period (AED)', field: 'accountingIncomeTaxPeriod', type: 'number' },
            { label: '--- Accounting Adjustments ---', field: '_header_acc_adj', type: 'header' },
            { label: '2. Share of profits / (losses) relating to investments accounted for under the Equity Method of Accounting (AED)', field: 'shareProfitsEquity', type: 'number' },
            { label: '3. Accounting net profits / (losses) derived from Unincorporated Partnerships (AED)', field: 'accountingNetProfitsUninc', type: 'number' },
            { label: '4. Gains / (losses) on the disposal of an interest in an Unincorporated Partnership which meets the conditions of the Participation Exemption (AED)', field: 'gainsDisposalUninc', type: 'number' },
            { label: '5. Gains / (losses) reported in the Financial Statements that would not subsequently be recognised in the income statement (AED)', field: 'gainsLossesReportedFS', type: 'number' },
            { label: '6. Realisation basis adjustments (AED)', field: 'realisationBasisAdj', type: 'number' },
            { label: '7. Transitional adjustments (AED)', field: 'transitionalAdj', type: 'number' },
            { label: '--- Exempt Income ---', field: '_header_exempt_inc', type: 'header' },
            { label: '8. Dividends and profit distributions received from UAE Resident Persons (AED)', field: 'dividendsResident', type: 'number' },
            { label: '9. Income / (losses) from Participating Interests (AED)', field: 'incomeParticipatingInterests', type: 'number' },
            { label: '10. Taxable Income / (Tax Losses) from Foreign Permanent Establishments (AED)', field: 'taxableIncomeForeignPE', type: 'number' },
            { label: '11. Income / (losses) from international aircraft / shipping (AED)', field: 'incomeIntlAircraftShipping', type: 'number' },
            { label: '--- Reliefs ---', field: '_header_reliefs', type: 'header' },
            { label: '12. Adjustments arising from transfers within a Qualifying Group (AED)', field: 'adjQualifyingGroup', type: 'number' },
            { label: '13. Adjustments arising from Business Restructuring Relief (AED)', field: 'adjBusinessRestructuring', type: 'number' },
            { label: '--- Non-deductible Expenditure ---', field: '_header_non_ded_exp', type: 'header' },
            { label: '14. Adjustments for non-deductible expenditure (AED)', field: 'adjNonDeductibleExp', type: 'number' },
            { label: '15. Adjustments for Interest expenditure (AED)', field: 'adjInterestExp', type: 'number' },
            { label: '--- Other adjustments ---', field: '_header_other_adj_tax', type: 'header' },
            { label: '16. Adjustments for transactions with Related Parties and Connected Persons (AED)', field: 'adjRelatedParties', type: 'number' },
            { label: '17. Adjustments for income and expenditure derived from Qualifying Investment Funds (AED)', field: 'adjQualifyingInvestmentFunds', type: 'number' },
            { label: '18. Other adjustments (AED)', field: 'otherAdjustmentsTax', type: 'number' },
            { label: '--- Tax Liability and Tax Credits ---', field: '_header_tax_lia_cred', type: 'header' },
            { label: '19. Taxable Income / (Tax Loss) before any Tax Loss adjustments (AED)', field: 'taxableIncomeBeforeAdj', type: 'number' },
            { label: '20. Tax Losses utilised in the current tax Period (AED)', field: 'taxLossesUtilised', type: 'number' },
            { label: '21. Tax Losses claimed from other group entities (AED)', field: 'taxLossesClaimed', type: 'number' },
            { label: '22. Pre-Grouping Tax Losses (AED)', field: 'preGroupingLosses', type: 'number' },
            { label: '23. Taxable Income / (Tax Loss) for the Tax Period (AED)', field: 'taxableIncomeTaxPeriod', type: 'number', highlight: true },
            { label: '24. Corporate Tax Liability (AED)', field: 'corporateTaxLiability', type: 'number', highlight: true },
            { label: '25. Tax Credits (AED)', field: 'taxCredits', type: 'number' },
            { label: '26. Corporate Tax Payable (AED)', field: 'corporateTaxPayable', type: 'number', highlight: true }
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

export const CT_REPORTS_ACCOUNTS: Record<string, string> = {
    // Income
    'Sales Revenue': 'Income',
    'Sales to related Parties': 'Income',
    'Dividends received': 'Income',
    'Other non-operating Revenue': 'Income',
    'Other Operating Income': 'Income',
    'Interest Income': 'Income',
    'Interest from Related Parties': 'Income',
    // Expenses
    'Direct Cost (COGS)': 'Expenses',
    'Purchases from Related Parties': 'Expenses',
    'Salaries & Wages': 'Expenses',
    'Staff Benefits': 'Expenses',
    'Depreciation': 'Expenses',
    'Amortization – Intangibles': 'Expenses',
    'Office Supplies & Stationery': 'Expenses',
    'Repairs & Maintenance': 'Expenses',
    'Insurance Expense': 'Expenses',
    'Marketing & Advertising': 'Expenses',
    'Professional Fees': 'Expenses',
    'Legal Fees': 'Expenses',
    'IT & Software Subscriptions': 'Expenses',
    'Fuel Expenses': 'Expenses',
    'Transportation & Logistics': 'Expenses',
    'Bank Charges': 'Expenses',
    'VAT Expense (non-recoverable)': 'Expenses',
    'Corporate Tax Expense': 'Expenses',
    'Government Fees & Licenses': 'Expenses',
    'Bad Debt Expense': 'Expenses',
    'Miscellaneous Expense': 'Expenses',
    'Interest Expense': 'Expenses',
    'Interest to Related Parties': 'Expenses',
    // Assets
    'Cash on Hand': 'Assets',
    'Bank Accounts': 'Assets',
    'Accounts Receivable': 'Assets',
    'Due from related Parties': 'Assets',
    'Prepaid Expenses': 'Assets',
    'Deposits': 'Assets',
    'VAT Recoverable (Input VAT)': 'Assets',
    'Inventory – Goods': 'Assets',
    'Work-in-Progress – Services': 'Assets',
    'Property, Plant & Equipment': 'Assets',
    'Furniture & Equipment': 'Assets',
    'Vehicles': 'Assets',
    // Liabilities
    'Accounts Payable': 'Liabilities',
    'Due to Related Parties': 'Liabilities',
    'Accrued Expenses': 'Liabilities',
    'Advances from Customers': 'Liabilities',
    'Short-Term Loans': 'Liabilities',
    'VAT Payable (Output VAT)': 'Liabilities',
    'Corporate Tax Payable': 'Liabilities',
    'Long-Term Liabilities': 'Liabilities',
    'Long-Term Loans': 'Liabilities',
    'Loans from Related Parties': 'Liabilities',
    'Employee End-of-Service Benefits Provision': 'Liabilities',
    // Equity
    'Share Capital / Owner’s Equity': 'Equity'
};

export const formatNumber = (amount: number | null | undefined) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    if (Math.abs(amount) < 0.01) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;
