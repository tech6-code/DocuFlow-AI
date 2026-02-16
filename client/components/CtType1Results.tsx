import type { WorkingNoteEntry } from '../types';
import { createPortal } from 'react-dom';
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
    EyeSlashIcon,
    ChartBarIcon,
    ChartPieIcon,
    TrashIcon,
    AssetIcon,
    IncomeIcon,
    ExpenseIcon,
    ChevronDownIcon,
    ChevronUpIcon,
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
    QuestionMarkCircleIcon // Add QuestionMarkCircleIcon import
} from './icons';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Transaction, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, BankStatementSummary, FileBalance, Company } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { OpeningBalances, initialAccountData, initialAccountDataType1 } from './OpeningBalances';
import { OpeningBalancesType1 } from './OpeningBalancesType1';
import { FileUploadArea } from './VatFilingUpload';
import { extractGenericDetailsFromDocuments, extractVat201Totals, CHART_OF_ACCOUNTS, categorizeTransactionsByCoA } from '../services/geminiService';
import { ProfitAndLossStep, PNL_ITEMS } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS } from './BalanceSheetStep';
import { ctFilingService } from '../services/ctFilingService';
import { CategoryDropdown, getChildCategory } from './CategoryDropdown';
import type { Part } from '@google/genai';
import { useCtWorkflow } from '../hooks/useCtWorkflow';

// This tells TypeScript that XLSX and pdfjsLib will be available on the window object
declare const XLSX: any;

const ACCOUNT_MAPPING: Record<string, string> = {
    'Cash on Hand': 'Cash on Hand',
    'Bank Accounts': 'Bank Accounts',
    'Accounts Receivable': 'Accounts Receivable',
    'Advances to Suppliers': 'Prepaid Expenses',
    'Prepaid Expenses': 'Prepaid Expenses',
    'Inventory – Goods': 'Inventory – Goods',
    'Work-in-Progress – Services': 'Work-in-Progress – Services',
    'VAT Recoverable (Input VAT)': 'VAT Recoverable (Input VAT)',
    'Furniture & Equipment': 'Property, Plant & Equipment',
    'Vehicles': 'Property, Plant & Equipment',
    'Intangibles (Software, Patents)': 'Property, Plant & Equipment',
    'Accounts Payable': 'Accounts Payable',
    'Accrued Expenses': 'Accrued Expenses',
    'Advances from Customers': 'Advances from Customers',
    'Short-Term Loans': 'Short-Term Loans',
    'VAT Payable (Output VAT)': 'VAT Payable (Output VAT)',
    'Corporate Tax Payable': 'Corporate Tax Payable',
    'Long-Term Loans': 'Long-Term Liabilities',
    'Employee End-of-Service Benefits Provision': 'Long-Term Liabilities',
    'Share Capital / Owner’s Equity': 'Share Capital / Owner’s Equity',
    'Retained Earnings': 'Retained Earnings',
    'Current Year Profit/Loss': 'Retained Earnings',
    'Dividends / Owner’s Drawings': 'Dividends / Owner’s Drawings',
    "Owner's Current Account": "Owner's Current Account",
    'Sales Revenue – Goods': 'Sales Revenue',
    'Service Revenue': 'Sales Revenue',
    'Other Operating Income': 'Miscellaneous Income',
    'Interest Income': 'Interest Income',
    'Miscellaneous Income': 'Miscellaneous Income',
    'Cost of Goods Sold (COGS)': 'Direct Cost (COGS)',
    'Direct Service Costs (Subcontractors, Project Costs)': 'Direct Cost (COGS)',
    'Rent Expense': 'Rent Expense',
    'Utilities (Electricity, Water, Internet)': 'Utilities',
    'Office Supplies & Stationery': 'Office Supplies & Stationery',
    'Repairs & Maintenance': 'Repairs & Maintenance',
    'Insurance Expense': 'Insurance Expense',
    'Marketing & Advertising': 'Marketing & Advertising',
    'Travel & Entertainment': 'Travel & Entertainment',
    'Professional Fees (Legal, Audit, Consulting)': 'Professional Fees',
    'IT & Software Subscriptions': 'IT & Software Subscriptions',
    'Transportation & Logistics': 'Transportation & Logistics',
    'Bank Charges & Interest Expense': 'Bank Charges',
    'Commission Expenses': 'Miscellaneous Expense',
    'Salaries & Wages': 'Salaries & Wages',
    'Staff Benefits (Medical, EOSB Contributions)': 'Salaries & Wages',
    'Training & Development': 'Training & Development',
    'VAT Expense (non-recoverable)': 'Miscellaneous Expense',
    'Corporate Tax Expense': 'Corporate Tax Expense',
    'Government Fees & Licenses': 'Government Fees & Licenses',
    'Depreciation – Furniture & Equipment': 'Depreciation',
    'Depreciation – Vehicles': 'Depreciation',
    'Amortization – Intangibles': 'Depreciation',
    'Bad Debt Expense': 'Miscellaneous Expense',
    'Miscellaneous Expense': 'Miscellaneous Expense'
};

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
    conversionId: string | null;
    period?: { start: string; end: string } | null;
    periodId: string;
    ctTypeId: number;
    customerId: string;
}

interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

const formatDecimalNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatWholeNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const getRowBalance = (t: Transaction) => {
    const credit = t.originalCredit !== undefined ? t.originalCredit : t.credit;
    const debit = t.originalDebit !== undefined ? t.originalDebit : t.debit;
    return (credit || 0) - (debit || 0);
};

const CT_QUESTIONS = [
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

const REPORT_STRUCTURE = [
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

const ResultsStatCard = ({ label, value, secondaryValue, color = "text-white", secondaryColor = "text-gray-400", icon }: { label: string, value: React.ReactNode, secondaryValue?: string, color?: string, secondaryColor?: string, icon?: React.ReactNode }) => (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-center justify-between shadow-sm h-full">
        <div className="flex flex-col">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
            <div className={`text-base font-bold font-mono ${color}`}>{value}</div>
            {secondaryValue && <p className={`text-[10px] font-mono mt-0.5 ${secondaryColor}`}>{secondaryValue}</p>}
        </div>
        {icon && <div className="text-gray-600 opacity-50 ml-2">{icon}</div>}
    </div>
);



const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length === 3) {
        // Assume DD/MM/YYYY
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

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

const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    if (typeof dateStr === 'object') {
        if (dateStr.year && dateStr.month && dateStr.day) {
            return `${String(dateStr.day).padStart(2, '0')}/${String(dateStr.month).padStart(2, '0')}/${dateStr.year}`;
        }
        return JSON.stringify(dateStr);
    }
    // Check if already DD/MM/YYYY
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const getSortableDate = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal === 'object' && dateVal.year && dateVal.month && dateVal.day) {
        return new Date(dateVal.year, dateVal.month - 1, dateVal.day).getTime();
    }
    if (typeof dateVal === 'string') {
        const dmy = dateVal.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
        if (dmy) {
            return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1])).getTime();
        }
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? 0 : d.getTime();
};

const renderReportField = (fieldValue: any) => {
    if (!fieldValue) return '';
    if (typeof fieldValue === 'object') {
        return JSON.stringify(fieldValue, null, 2);
    }
    return String(fieldValue);
};

// Local CategoryDropdown and getChildCategory removed - now using shared component

const getQuarter = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length < 2) return 'Unknown';
    const month = parseInt(parts[1], 10);
    if (month >= 1 && month <= 3) return 'Q1';
    if (month >= 4 && month <= 6) return 'Q2';
    if (month >= 7 && month <= 9) return 'Q3';
    if (month >= 10 && month <= 12) return 'Q4';
    return 'Unknown';
};

// Helper for resolveCategoryPath to get the exact casing from CoA
const getChildByValue = (items: string[], normalizedValue: string): string => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[–—]/g, '-').replace(/['"“”]/g, '').replace(/&/g, 'and').replace(/\s+/g, ' ');
    return items.find(i => normalize(i) === normalizedValue) || normalizedValue;
};

const resolveCategoryPath = (category: string | undefined, customCategories: string[] = []): string => {
    if (!category || category === 'UNCATEGORIZED' || category === '') return 'UNCATEGORIZED';

    // Normalize function for fuzzy matching
    const normalize = (s: string) => s.trim().toLowerCase()
        .replace(/[–—]/g, '-') // Replace various dashes
        .replace(/['"“”]/g, '') // Remove quotes
        .replace(/&/g, 'and')
        .replace(/\s+/g, ' ');

    const normalizedInput = normalize(category);
    const mainCategories = ['assets', 'liabilities', 'equity', 'income', 'expenses'];
    const stripMainPrefix = (value: string) => {
        for (const main of mainCategories) {
            if (value.startsWith(main + ' ')) {
                return value.slice(main.length).trim();
            }
        }
        return value;
    };
    const normalizeSeparators = (value: string) =>
        value
            .replace(/[>\/]/g, '|')
            .replace(/\s+\|\s+/g, '|')
            .replace(/\s{2,}/g, ' ')
            .trim();

    // 1. Check Custom Categories First (Exact Match)
    if (customCategories && customCategories.length > 0) {
        // Direct match
        const directMatch = customCategories.find(c => normalize(c) === normalizedInput);
        if (directMatch) return directMatch;

        // Path match (if category is "Main | Sub", check if it matches a custom category)
        if (category.includes('|')) {
            const normalizedCat = normalize(category);
            const pathMatch = customCategories.find(c => normalize(c) === normalizedCat);
            if (pathMatch) return pathMatch;
        }
    }

    const normalizedPath = normalizeSeparators(category);

    // If it's already a path, try to validate the parts
    if (normalizedPath.includes('|')) {
        const parts = normalizedPath.split('|').map(p => normalize(p.trim()));
        const leaf = parts[parts.length - 1];

        // Check if the full path exists in CoA
        for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
            if (Array.isArray(sub)) {
                if (sub.some(item => normalize(item) === leaf)) return `${main} | ${getChildByValue(sub, leaf)}`;
            } else {
                for (const [subGroup, items] of Object.entries(sub)) {
                    if (items.some(item => normalize(item) === leaf)) return `${main} | ${subGroup} | ${getChildByValue(items, leaf)}`;
                }
            }
        }
    }

    // Direct leaf search (most common case for AI results)
    for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
        if (Array.isArray(sub)) {
            const found = sub.find(item => normalize(item) === normalizedInput);
            if (found) return `${main} | ${found}`;
        } else {
            for (const [subGroup, items] of Object.entries(sub)) {
                const found = items.find(item => normalize(item) === normalizedInput);
                if (found) return `${main} | ${subGroup} | ${found}`;
            }
        }
    }

    // Fallback: strip main prefix and try leaf match again
    const stripped = stripMainPrefix(normalizedInput).replace(/^[:\-\|]+/, '').trim();
    if (stripped && stripped !== normalizedInput) {
        for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
            if (Array.isArray(sub)) {
                const found = sub.find(item => normalize(item) === stripped);
                if (found) return `${main} | ${found}`;
            } else {
                for (const [subGroup, items] of Object.entries(sub)) {
                    const found = items.find(item => normalize(item) === stripped);
                    if (found) return `${main} | ${subGroup} | ${found}`;
                }
            }
        }
    }

    // Backup: Partial matching if exact normalization fails
    for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
        if (Array.isArray(sub)) {
            const found = sub.find(item => normalize(item).includes(normalizedInput) || normalizedInput.includes(normalize(item)));
            if (found) return `${main} | ${found}`;
        } else {
            for (const [subGroup, items] of Object.entries(sub)) {
                const found = items.find(item => normalize(item).includes(normalizedInput) || normalizedInput.includes(normalize(item)));
                if (found) return `${main} | ${subGroup} | ${found}`;
            }
        }
    }

    // Last resort: Check fuzzy match against custom categories
    if (customCategories && customCategories.length > 0) {
        const fuzzyMatch = customCategories.find(c => normalize(c).includes(normalizedInput) || normalizedInput.includes(normalize(c)));
        if (fuzzyMatch) return fuzzyMatch;
    }

    return 'UNCATEGORIZED';
};



const applySheetStyling = (worksheet: any, headerRows: number, totalRows: number = 0, customNumberFormat: string = '#,##0;[Red]-#,##0') => {
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { fgColor: { rgb: "FF111827" } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const totalStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FF374151" } } };
    const cellBorder = { style: 'thin', color: { rgb: "FF4B5563" } };
    const border = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const numberFormat = customNumberFormat;
    const quantityFormat = '#,##0';

    if (worksheet['!ref']) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                const cell = worksheet[cell_ref];

                if (!cell) continue;

                cell.s = { ...cell.s, border };

                if (R < headerRows) {
                    cell.s = { ...cell.s, ...headerStyle };
                } else if (totalRows > 0 && R >= range.e.r - (totalRows - 1)) {
                    cell.s = { ...cell.s, ...totalStyle };
                }

                if (typeof cell.v === 'number') {
                    const headerText = worksheet[XLSX.utils.encode_cell({ c: C, r: 0 })]?.v?.toLowerCase() || '';
                    if (headerText.includes('qty') || headerText.includes('quantity') || headerText.includes('confidence')) {
                        if (headerText.includes('confidence')) cell.z = '0"% "';
                        else cell.z = quantityFormat;
                    } else {
                        cell.z = numberFormat;
                    }
                    if (!cell.s) cell.s = {};
                    if (!cell.s.alignment) cell.s.alignment = {};
                    cell.s.alignment.horizontal = 'right';
                }
            }
        }
    }
};

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = [
        "Review Categories",
        "Summarization",
        "VAT Docs Upload",
        "VAT Summarization",
        "Opening Balances",
        "Adjust Trial Balance",
        "Profit & Loss",
        "Balance Sheet",
        "LOU Upload",
        "CT Questionnaire",
        "Generate Final Report"
    ];

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

const ReportInput = ({ field, type = "text", className = "", reportForm, onChange }: { field: string, type?: string, className?: string, reportForm: any, onChange: (field: string, value: any) => void }) => {
    const value = reportForm[field] || '';
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className={`w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 focus:ring-0 p-1 text-white transition-all text-xs font-medium outline-none ${className}`}
        />
    );
};

const ReportNumberInput = ({ field, className = "", reportForm, onChange }: { field: string, className?: string, reportForm: any, onChange: (field: string, value: any) => void }) => {
    const value = reportForm[field] || 0;
    return (
        <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => onChange(field, parseFloat(e.target.value) || 0)}
            className={`w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 focus:ring-0 p-1 text-right font-mono text-white transition-all text-xs font-bold outline-none ${className}`}
        />
    );
};

const ValidationWarning = ({ expected, actual }: { expected: number, actual: number }) => {
    if (Math.abs(expected - actual) > 1) {
        return (
            <div className="flex items-center text-[10px] text-orange-400 mt-1">
                <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                <span>Sum mismatch (Calc: {formatDecimalNumber(actual)})</span>
            </div>
        );
    }
    return null;
};

const VatEditableCell = ({
    periodId,
    field,
    value,
    vatManualAdjustments,
    onChange
}: {
    periodId: string,
    field: string,
    value: number,
    vatManualAdjustments: Record<string, Record<string, string>>,
    onChange: (periodId: string, field: string, value: string) => void
}) => {
    const displayValue = vatManualAdjustments[periodId]?.[field] ?? (value === 0 ? '' : value.toString());
    return (
        <input
            type="text"
            value={displayValue}
            onChange={(e) => onChange(periodId, field, e.target.value)}
            className="w-full bg-transparent text-right outline-none focus:bg-white/10 px-2 py-1 rounded transition-colors font-mono"
            placeholder="0.00"
        />
    );
};

const TbInput = ({
    label,
    field,
    value,
    hasBreakdown,
    onChange
}: {
    label: string,
    field: 'debit' | 'credit',
    value: number,
    hasBreakdown: boolean,
    onChange: (label: string, field: 'debit' | 'credit', value: string) => void
}) => {
    return (
        <input
            type="number"
            step="0.01"
            value={value !== 0 ? value : ''}
            onChange={(e) => onChange(label, field, e.target.value)}
            className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700 ${hasBreakdown ? 'bg-gray-900/50 border-blue-900/30' : 'hover:border-gray-500'}`}
            placeholder="0.00"
        />
    );
};

const getCoAListData = () => {
    const data: any[][] = [["Category", "Sub-Category", "Account Name"]];
    Object.entries(CHART_OF_ACCOUNTS).forEach(([category, section]) => {
        if (Array.isArray(section)) {
            section.forEach(name => {
                data.push([category, "-", name]);
            });
        } else {
            Object.entries(section as any).forEach(([subCategory, accounts]) => {
                (accounts as string[]).forEach(name => {
                    data.push([category, subCategory, name]);
                });
            });
        }
    });
    return data;
};

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
    statementFiles,
    periodId,
    ctTypeId,
    customerId,
    conversionId,
    period
}) => {

    const { saveStep, workflowData, loading: isWorkflowLoading } = useCtWorkflow({ conversionId });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isRestoring, setIsRestoring] = useState(true);

    const handleSaveStep = async (stepNumber: number, data: any, status: 'draft' | 'completed' | 'submitted' = 'completed') => {
        if (!customerId || !ctTypeId || !periodId) return;

        const stepNames: Record<number, string> = {
            1: 'categorization',
            2: 'summarization',
            3: 'vat_upload',
            4: 'vat_summarization',
            5: 'opening_balances',
            6: 'adjust_trial_balance',
            7: 'profit_loss',
            8: 'balance_sheet',
            9: 'lou_upload',
            10: 'questionnaire',
            11: 'final_report'
        };

        try {
            const stepName = stepNames[stepNumber] || `step_${stepNumber}`;
            const stepKey = `type-1_step-${stepNumber}_${stepName}`;
            await saveStep(stepKey, stepNumber, data, status);
        } catch (error) {
            console.error('Failed to save step:', error);
        }
    };

    // Hydration Effect
    useEffect(() => {
        if (!workflowData || workflowData.length === 0) {
            setIsRestoring(false);
            return;
        }

        const restoreData = () => {
            // Sort by step_number desc to get the latest step
            const sortedSteps = [...workflowData].sort((a: any, b: any) => b.step_number - a.step_number);
            const latestStep = sortedSteps[0];

            if (latestStep && !isManualNavigationRef.current) {
                // If the latest step is completed, it usually means the user moved to the next one
                if (latestStep.status === 'completed' && latestStep.step_number < 11) {
                    // Check for Step 2 -> 5 skip
                    const isStep2 = latestStep.step_number === 2;
                    if (isStep2 && latestStep.data?.skipVat) {
                        setCurrentStep(5);
                    } else {
                        setCurrentStep(latestStep.step_number + 1);
                    }
                } else {
                    setCurrentStep(latestStep.step_number);
                }
            }
            // Reset the flag after hydration
            isManualNavigationRef.current = false;

            // Restore data for each step
            for (const step of workflowData) {
                const stepNum = step.step_number;
                const data = step.data;

                if (stepNum === 1) {
                    if (data?.editedTransactions) {
                        onUpdateTransactions(data.editedTransactions);
                        setEditedTransactions(data.editedTransactions);
                    }
                    if (data?.summary && data.summary !== null) {
                        setPersistedSummary(data.summary);
                    }
                    if (data?.manualBalances) {
                        setManualBalances(data.manualBalances);
                    }
                }
                if (stepNum === 2) {
                    if (data?.summaryFileFilter) {
                        setSummaryFileFilter(data.summaryFileFilter);
                    }
                    if (data?.manualBalances) {
                        setManualBalances(data.manualBalances);
                    }
                    if (data?.conversionRates) {
                        setConversionRates(data.conversionRates);
                    }
                }
                if (stepNum === 5 && data?.openingBalancesData) {
                    const hydratedOb = (data.openingBalancesData as OpeningBalanceCategory[]).map(cat => ({
                        ...cat,
                        icon: getIconForSection(cat.category)
                    }));
                    setOpeningBalancesData(hydratedOb);
                }
                if (stepNum === 6) {
                    if (data?.adjustedTrialBalance) {
                        setAdjustedTrialBalance(data.adjustedTrialBalance);
                    }
                    if (data?.breakdowns) {
                        setBreakdowns(data.breakdowns);
                    }
                }
                if (stepNum === 7) {
                    if (data?.pnlValues) {
                        setPnlValues(data.pnlValues);
                    }
                    if (data?.pnlWorkingNotes) {
                        setPnlWorkingNotes(data.pnlWorkingNotes);
                    }
                    if (data?.pnlManualEdits) {
                        pnlManualEditsRef.current = new Set(data.pnlManualEdits);
                    }
                }
                if (stepNum === 8) {
                    if (data?.balanceSheetValues) {
                        setBalanceSheetValues(data.balanceSheetValues);
                    }
                    if (data?.bsWorkingNotes) {
                        setBsWorkingNotes(data.bsWorkingNotes);
                    }
                    if (data?.bsManualEdits) {
                        bsManualEditsRef.current = new Set(data.bsManualEdits);
                    }
                }
                if (stepNum === 10 && data?.questionnaireAnswers) {
                    setQuestionnaireAnswers(data.questionnaireAnswers);
                }
                if (stepNum === 11) {
                    if (data?.reportForm) {
                        setReportForm(data.reportForm);
                    }
                    if (data?.reportManualEdits) {
                        reportManualEditsRef.current = new Set(data.reportManualEdits);
                    }
                }
                if (stepNum === 3) {
                    if (data?.additionalDetails) {
                        setAdditionalDetails(data.additionalDetails);
                    }
                }
                if (stepNum === 4) {
                    if (data?.vatManualAdjustments) {
                        setVatManualAdjustments(data.vatManualAdjustments);
                    }
                }
            }
            setIsRestoring(false);
        };

        restoreData();
    }, [workflowData, onUpdateTransactions]);

    const [currentStep, setCurrentStep] = useState(1); // ALWAYS start at step 1 for review
    const [editedTransactions, setEditedTransactions] = useState<Transaction[]>([]);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(initialAccountDataType1);

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
    const [manualBalances, setManualBalances] = useState<Record<string, { opening?: number, closing?: number }>>({});
    const [persistedSummary, setPersistedSummary] = useState<BankStatementSummary | null>(null);
    const [conversionRates, setConversionRates] = useState<Record<string, string>>({});

    const handleRateConversion = useCallback((fileName: string, rateStr: string) => {
        setConversionRates(prev => ({ ...prev, [fileName]: rateStr }));

        const rate = parseFloat(rateStr);
        if (isNaN(rate) || rate <= 0) return;

        setEditedTransactions(prev => prev.map(t => {
            if (t.sourceFile !== fileName) return t;

            // Maintain original values
            const originalDebit = t.originalDebit !== undefined ? t.originalDebit : t.debit;
            const originalCredit = t.originalCredit !== undefined ? t.originalCredit : t.credit;

            return {
                ...t,
                originalDebit,
                originalCredit,
                debit: Number((originalDebit * rate).toFixed(2)),
                credit: Number((originalCredit * rate).toFixed(2))
            };
        }));
    }, []);

    const [sortColumn, setSortColumn] = useState<'date' | null>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [newCategoryMain, setNewCategoryMain] = useState('');
    const [newCategorySub, setNewCategorySub] = useState('');
    const importStep1InputRef = useRef<HTMLInputElement>(null);
    const importStep4InputRef = useRef<HTMLInputElement>(null);
    const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

    const [showUncategorizedAlert, setShowUncategorizedAlert] = useState(false);
    const [uncategorizedCount, setUncategorizedCount] = useState(0);

    const [pendingCategoryContext, setPendingCategoryContext] = useState<{
        type: 'row' | 'bulk' | 'replace' | 'filter';
        rowIndex?: number;
    } | null>(null);

    const [filePreviews, setFilePreviews] = useState<Record<string, string[]>>({});
    const [previewPage, setPreviewPage] = useState(0);
    const [showPreviewPanel, setShowPreviewPanel] = useState(false);

    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [customRows, setCustomRows] = useState<{ parent: string, subParent?: string, label: string }[]>([]);
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('');
    const [newGlobalAccountChild, setNewGlobalAccountChild] = useState('');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');

    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});

    // Manual edits tracking to prevent auto-population from overwriting user changes
    const pnlManualEditsRef = useRef<Set<string>>(new Set());
    const bsManualEditsRef = useRef<Set<string>>(new Set());
    const reportManualEditsRef = useRef<Set<string>>(new Set());

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

    // Navigation control ref - prevents hydration from overriding manual navigation
    const isManualNavigationRef = useRef(false);

    // Questionnaire State
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});

    // Final Report Editable Form State
    const [reportForm, setReportForm] = useState<any>({});
    const reportFormSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-save Step 11 (Final Report) data when user makes changes (debounced)
    useEffect(() => {
        // Only auto-save if we're on step 11 and reportForm has meaningful data
        if (currentStep === 11 && reportForm && Object.keys(reportForm).length > 0) {
            // Clear any existing timeout
            if (reportFormSaveTimeoutRef.current) {
                clearTimeout(reportFormSaveTimeoutRef.current);
            }

            // Debounce the save - only save 2 seconds after user stops editing
            reportFormSaveTimeoutRef.current = setTimeout(async () => {
                try {
                    await handleSaveStep(11, { reportForm }, 'completed');
                    console.log('[Step 11] Auto-saved final report data');
                } catch (error) {
                    console.error('[Step 11] Failed to auto-save:', error);
                }
            }, 2000);
        }

        // Cleanup timeout on unmount
        return () => {
            if (reportFormSaveTimeoutRef.current) {
                clearTimeout(reportFormSaveTimeoutRef.current);
            }
        };
    }, [currentStep, reportForm]);

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

    const handleReportFormChange = (field: string, value: any) => {
        setReportForm((prev: any) => {
            const updated = { ...prev, [field]: value };
            // Mark as manually edited so auto-calculation doesn't overwrite
            reportManualEditsRef.current.add(field);
            return updated;
        });
    };

    const structure = [
        { type: 'header', label: 'Assets' },
        { type: 'subheader', label: 'Current Assets' },
        { type: 'row', label: 'Cash on Hand' },
        { type: 'row', label: 'Bank Accounts' },
        { type: 'row', label: 'Accounts Receivable' },
        { type: 'row', label: 'Advances to Suppliers' },
        { type: 'row', label: 'Prepaid Expenses' },
        { type: 'row', label: 'Inventory – Goods' },
        { type: 'row', label: 'Work-in-Progress – Services' },
        { type: 'row', label: 'VAT Recoverable (Input VAT)' },
        { type: 'subheader', label: 'Non Current Asset' },
        { type: 'row', label: 'Property, Plant & Equipment' },

        { type: 'header', label: 'Liabilities' },
        { type: 'subheader', label: 'Current Liabilities' },
        { type: 'row', label: 'Accounts Payable' },
        { type: 'row', label: 'Accrued Expenses' },
        { type: 'row', label: 'Advances from Customers' },
        { type: 'row', label: 'Short-Term Loans' },
        { type: 'row', label: 'VAT Payable (Output VAT)' },
        { type: 'row', label: 'Corporate Tax Payable' },
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
        { type: 'subheader', label: 'Other Expense' },
        { type: 'row', label: 'Salaries & Wages' },
        { type: 'row', label: 'Training & Development' },
        { type: 'row', label: 'Rent Expense' },
        { type: 'row', label: 'Utilities' },
        { type: 'row', label: 'Office Supplies & Stationery' },
        { type: 'row', label: 'Repairs & Maintenance' },
        { type: 'row', label: 'Insurance Expense' },
        { type: 'row', label: 'Marketing & Advertising' },
        { type: 'row', label: 'Travel & Entertainment' },
        { type: 'row', label: 'Professional Fees' },
        { type: 'row', label: 'IT & Software Subscriptions' },
        { type: 'row', label: 'Transportation & Logistics' },
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

    const vatStepData = useMemo(() => {
        const fileResults = additionalDetails.vatFileResults || [];

        const periods = fileResults.map((res: any, index: number) => {
            // Create a stable ID for manual adjustments
            const periodId = `${res.periodFrom}_${res.periodTo}_${index}`;
            const adj = vatManualAdjustments[periodId] || {};

            const sales = {
                zero: adj.salesZero !== undefined ? parseFloat(adj.salesZero) || 0 : (res.sales?.zeroRated || 0),
                tv: adj.salesTv !== undefined ? parseFloat(adj.salesTv) || 0 : (res.sales?.standardRated || 0),
                vat: adj.salesVat !== undefined ? parseFloat(adj.salesVat) || 0 : (res.sales?.vatAmount || 0),
                total: 0
            };

            const purchases = {
                zero: adj.purchasesZero !== undefined ? parseFloat(adj.purchasesZero) || 0 : (res.purchases?.zeroRated || 0),
                tv: adj.purchasesTv !== undefined ? parseFloat(adj.purchasesTv) || 0 : (res.purchases?.standardRated || 0),
                vat: adj.purchasesVat !== undefined ? parseFloat(adj.purchasesVat) || 0 : (res.purchases?.vatAmount || 0),
                total: 0
            };

            // Strictly enforce totals
            sales.total = sales.zero + sales.tv + sales.vat;
            purchases.total = purchases.zero + purchases.tv + purchases.vat;

            return {
                id: periodId,
                periodFrom: res.periodFrom,
                periodTo: res.periodTo,
                sales,
                purchases,
                net: sales.vat - purchases.vat
            };
        });

        const grandTotals = periods.reduce((acc, p) => ({
            sales: {
                zero: acc.sales.zero + p.sales.zero,
                tv: acc.sales.tv + p.sales.tv,
                vat: acc.sales.vat + p.sales.vat,
                total: acc.sales.total + p.sales.total
            },
            purchases: {
                zero: acc.purchases.zero + p.purchases.zero,
                tv: acc.purchases.tv + p.purchases.tv,
                vat: acc.purchases.vat + p.purchases.vat,
                total: acc.purchases.total + p.purchases.total
            },
            net: acc.net + p.net
        }), { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0 });

        return { periods, grandTotals };
    }, [additionalDetails.vatFileResults, vatManualAdjustments]);

    const handleImportStep4VAT = useCallback(() => {
        importStep4InputRef.current?.click();
    }, []);

    const handleStep4FileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 3) {
                alert("The uploaded file does not appear to have the correct format.");
                return;
            }

            const newAdjustments: Record<string, Record<string, string>> = { ...vatManualAdjustments };
            let updatedCount = 0;

            for (let i = 2; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0 || row[0] === 'GRAND TOTAL') break;

                const periodLabel = row[0];
                if (!periodLabel) continue;

                const period = vatStepData.periods.find((p: any) => `${p.periodFrom} - ${p.periodTo}` === periodLabel);

                if (period) {
                    const adj: Record<string, string> = { ...newAdjustments[period.id] };

                    if (row[1] !== undefined) adj.salesZero = String(row[1]);
                    if (row[2] !== undefined) adj.salesTv = String(row[2]);
                    if (row[3] !== undefined) adj.salesVat = String(row[3]);

                    if (row[6] !== undefined) adj.purchasesZero = String(row[6]);
                    if (row[7] !== undefined) adj.purchasesTv = String(row[7]);
                    if (row[8] !== undefined) adj.purchasesVat = String(row[8]);

                    newAdjustments[period.id] = adj;
                    updatedCount++;
                }
            }

            if (updatedCount > 0) {
                setVatManualAdjustments(newAdjustments);
                alert(`Successfully imported VAT data for ${updatedCount} periods.`);
            } else {
                alert("No matching periods found in the uploaded file.");
            }
        } catch (error) {
            console.error("Error importing Step 4 VAT:", error);
            alert("Failed to parse the Excel file. Please ensure it is a valid VAT Summarization export.");
        } finally {
            event.target.value = '';
        }
    }, [vatManualAdjustments, vatStepData.periods]);

    const resolveAccountBucket = useCallback((accountName: string) => {
        const normalize = (s: string) => s.replace(/['’]/g, "'").trim().toLowerCase();
        const normAccount = normalize(accountName);

        // 1. Check exact match in structure
        let currentHeader = '';
        let currentSubheader = '';
        for (const item of structure) {
            if (item.type === 'header') currentHeader = item.label;
            else if (item.type === 'subheader') currentSubheader = item.label;
            else if (item.type === 'row' || item.type === 'subrow') {
                if (normalize(item.label) === normAccount) {
                    return { section: currentHeader, subheader: currentSubheader, label: item.label };
                }
            }
        }

        // 2. Check ACCOUNT_MAPPING
        const mappedName = (ACCOUNT_MAPPING as any)[accountName];
        if (mappedName) {
            const normMapped = normalize(mappedName);
            let h = '';
            let s = '';
            for (const item of structure) {
                if (item.type === 'header') h = item.label;
                else if (item.type === 'subheader') s = item.label;
                else if (item.type === 'row' || item.type === 'subrow') {
                    if (normalize(item.label) === normMapped) {
                        return { section: h, subheader: s, label: item.label };
                    }
                }
            }
        }

        // 3. Check customRows
        const customMatch = customRows.find(r => normalize(r.label) === normAccount);
        if (customMatch) {
            return { section: customMatch.parent, subheader: customMatch.subParent || '', label: customMatch.label };
        }

        // 4. Default by CHART_OF_ACCOUNTS keywords/arrays
        let targetSection = 'Expenses';
        for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
            if (Array.isArray(details)) {
                if (details.some(a => normalize(a) === normAccount)) { targetSection = mainCat; break; }
            } else {
                for (const [subGroup, accounts] of Object.entries(details as any)) {
                    if ((accounts as string[]).some(a => normalize(a) === normAccount)) { targetSection = mainCat; break; }
                }
            }
        }
        if (targetSection === 'Revenues') targetSection = 'Income';
        return { section: targetSection, subheader: '', label: accountName };
    }, [structure, customRows]);

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
            if (entry.account.toLowerCase() === 'totals') return;
            const bucket = resolveAccountBucket(entry.account);

            // STRICTNESS: Only map from Income and Expenses sections
            if (bucket.section !== 'Income' && bucket.section !== 'Expenses') return;

            const netAmount = entry.credit - entry.debit; // Positive for income, negative for expenses
            const absAmount = Math.abs(netAmount);
            if (absAmount === 0) return;

            const accountLower = entry.account.toLowerCase();
            let key = '';

            if (bucket.section === 'Income') {
                if (bucket.subheader === 'Operating Income' || accountLower.includes('sales') || (accountLower.includes('revenue') && !accountLower.includes('other'))) {
                    key = 'revenue';
                } else if (accountLower.includes('fvtpl') || (accountLower.includes('fair value') && (accountLower.includes('gain') || accountLower.includes('loss')))) {
                    key = 'unrealised_gain_loss_fvtpl';
                } else if (accountLower.includes('associate') || accountLower.includes('share of profit')) {
                    key = 'share_profits_associates';
                } else if (accountLower.includes('revaluation') && accountLower.includes('property')) {
                    key = 'gain_loss_revaluation_property';
                } else if (bucket.subheader === 'Other Income' || accountLower.includes('interest income') || accountLower.includes('other income') || accountLower.includes('miscellaneous')) {
                    key = 'other_income';
                } else {
                    key = 'revenue';
                }
            } else if (bucket.section === 'Expenses') {
                if (accountLower.includes('forex') || accountLower.includes('exchange loss') || accountLower.includes('exchange gain')) {
                    key = 'foreign_exchange_loss'; // Could be gain or loss, typically presented net in P&L
                } else if (accountLower.includes('impairment') && (accountLower.includes('ppe') || accountLower.includes('equipment'))) {
                    key = 'impairment_losses_ppe';
                } else if (accountLower.includes('impairment') && (accountLower.includes('intangible') || accountLower.includes('goodwill'))) {
                    key = 'impairment_losses_intangible';
                } else if (accountLower.includes('commission')) {
                    key = 'selling_distribution_expenses';
                } else if (accountLower.includes('depreciation') || accountLower.includes('amortization')) {
                    key = 'depreciation_ppe';
                } else if (accountLower.includes('interest expense') || accountLower.includes('bank charge') || accountLower.includes('finance cost') || accountLower.includes('borrowing cost')) {
                    key = 'finance_costs';
                } else if (accountLower.includes('advertising') || accountLower.includes('marketing') || accountLower.includes('promotion') || accountLower.includes('entertainment')) {
                    key = 'business_promotion_selling';
                } else if (accountLower.includes('corporate tax')) {
                    key = 'provisions_corporate_tax';
                } else if (bucket.subheader === 'Direct Costs' || accountLower.includes('cogs') || accountLower.includes('purchase')) {
                    key = 'cost_of_revenue';
                } else if (bucket.subheader === 'Other Expense' || accountLower.includes('salary') || accountLower.includes('rent') || accountLower.includes('utility')) {
                    key = 'administrative_expenses';
                } else {
                    key = 'administrative_expenses';
                }
            }

            if (key) {
                // For P&L, we determine direction based on section
                // Income accounts increase currentYear on Credit, Expenses increase on Debit
                const val = key === 'revenue' || key === 'other_income' || key === 'unrealised_gain_loss_fvtpl' || key === 'share_profits_associates' || key === 'gain_loss_revaluation_property'
                    ? netAmount
                    : -netAmount;

                pnlMapping[key] = {
                    currentYear: (pnlMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                addNote(key, entry.account, val);
            }
        });

        // Recalculate totals for consistency following IFRS structure
        const getValue = (id: string) => pnlMapping[id]?.currentYear || 0;

        const rev = getValue('revenue');
        const cost = getValue('cost_of_revenue');
        const gross = rev - cost;
        pnlMapping['gross_profit'] = { currentYear: gross, previousYear: 0 };

        const otherInc = getValue('other_income');
        const fvtpl = getValue('unrealised_gain_loss_fvtpl');
        const associates = getValue('share_profits_associates');
        const revalProp = getValue('gain_loss_revaluation_property');

        const impairmentPpe = getValue('impairment_losses_ppe');
        const impairmentInt = getValue('impairment_losses_intangible');
        const promo = getValue('business_promotion_selling');
        const forex = getValue('foreign_exchange_loss');
        const selling = getValue('selling_distribution_expenses');
        const admin = getValue('administrative_expenses');
        const finance = getValue('finance_costs');
        const depr = getValue('depreciation_ppe');

        // Net Profit before tax
        const netProfit = gross + otherInc + fvtpl + associates + revalProp
            - impairmentPpe - impairmentInt - promo - forex - selling - admin - finance - depr;

        pnlMapping['profit_loss_year'] = { currentYear: netProfit, previousYear: 0 };

        const tax = getValue('provisions_corporate_tax');
        pnlMapping['profit_after_tax'] = { currentYear: netProfit - tax, previousYear: 0 };

        // For IFRS reporting, if OCI is empty, Total Comprehensive Income equals Profit After Tax
        const oci = getValue('gain_revaluation_property') + getValue('share_gain_loss_revaluation_associates')
            + getValue('changes_fair_value_available_sale') + getValue('changes_fair_value_available_sale_reclassified')
            + getValue('exchange_difference_translating');

        pnlMapping['total_comprehensive_income'] = { currentYear: (netProfit - tax) + oci, previousYear: 0 };

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
            if (entry.account.toLowerCase() === 'totals') return;
            const bucket = resolveAccountBucket(entry.account);

            // STRICTNESS: Only map from Assets, Liabilities, and Equity sections
            if (bucket.section !== 'Assets' && bucket.section !== 'Liabilities' && bucket.section !== 'Equity') return;

            const accountLower = entry.account.toLowerCase();
            const debitAmount = entry.debit;
            const creditAmount = entry.credit;
            let key = '';
            let val = 0;

            if (bucket.section === 'Assets') {
                val = debitAmount - creditAmount;
                if (bucket.subheader === 'Current Assets') {
                    if (accountLower.includes('related') || accountLower.includes('due from')) key = 'related_party_transactions_assets';
                    else if (accountLower.includes('cash') || accountLower.includes('bank')) key = 'cash_bank_balances';
                    else if (accountLower.includes('receivable') || accountLower.includes('debtor')) key = 'trade_receivables';
                    else if (accountLower.includes('inventory') || accountLower.includes('stock')) key = 'inventories';
                    else key = 'advances_deposits_receivables';
                } else {
                    if (accountLower.includes('intangible') || accountLower.includes('goodwill') || accountLower.includes('patent')) key = 'intangible_assets';
                    else if (accountLower.includes('investment') || accountLower.includes('subsidiary') || accountLower.includes('associate') || accountLower.includes('long-term') || accountLower.includes('long term')) key = 'long_term_investments';
                    else key = 'property_plant_equipment';
                }
            } else if (bucket.section === 'Liabilities') {
                val = creditAmount - debitAmount;
                if (bucket.subheader === 'Current Liabilities') {
                    if (accountLower.includes('related') || accountLower.includes('due to')) key = 'related_party_transactions_liabilities';
                    else if (accountLower.includes('borrowing') || accountLower.includes('overdraft') || (accountLower.includes('loan') && accountLower.includes('short'))) key = 'short_term_borrowings';
                    else key = 'trade_other_payables';
                } else {
                    if (accountLower.includes('benefit') || accountLower.includes('gratuity') || accountLower.includes('end of service')) key = 'employees_end_service_benefits';
                    else key = 'bank_borrowings_non_current';
                }
            } else if (bucket.section === 'Equity') {
                val = creditAmount - debitAmount;
                if (accountLower.includes('capital')) key = 'share_capital';
                else if (accountLower.includes('retained earnings') || accountLower.includes('profit and loss') || (accountLower.includes('earnings') && !accountLower.includes('shareholder'))) key = 'retained_earnings';
                else if (accountLower.includes('reserve')) key = 'statutory_reserve';
                else key = 'shareholders_current_accounts';
            }

            if (key) {
                bsMapping[key] = {
                    currentYear: (bsMapping[key]?.currentYear || 0) + val,
                    previousYear: 0
                };
                if (val !== 0) addNote(key, entry.account, val);
            }
        });

        // Dynamic Totals Calculation
        const totals = calculateBalanceSheetTotals(bsMapping);
        Object.entries(totals).forEach(([totalId, totalVal]) => {
            bsMapping[totalId] = totalVal;
        });

        return { values: bsMapping, notes: bsNotes };
    };

    const calculateBalanceSheetTotals = useCallback((values: Record<string, { currentYear: number; previousYear: number }>) => {
        const calculateForYear = (year: 'currentYear' | 'previousYear') => {
            const getSectionTotal = (startId: string, endId: string) => {
                let total = 0;
                let counting = false;
                for (const item of bsStructure) {
                    if (item.id === startId) {
                        counting = true;
                        continue;
                    }
                    if (item.id === endId) break;
                    if (counting && item.type === 'item') {
                        total += (values[item.id]?.[year] || 0);
                    }
                }
                return total;
            };

            const totalNonCurrentAssets = getSectionTotal('non_current_assets_header', 'total_non_current_assets');
            const totalCurrentAssets = getSectionTotal('current_assets_header', 'total_current_assets');
            const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

            const totalEquity = getSectionTotal('equity_header', 'total_equity');
            const totalNonCurrentLiabilities = getSectionTotal('non_current_liabilities_header', 'total_non_current_liabilities');
            const totalCurrentLiabilities = getSectionTotal('current_liabilities_header', 'total_current_liabilities');

            const totalLiabilities = totalNonCurrentLiabilities + totalCurrentLiabilities;
            const totalEquityLiabilities = totalEquity + totalLiabilities;

            return {
                total_non_current_assets: totalNonCurrentAssets,
                total_current_assets: totalCurrentAssets,
                total_assets: totalAssets,
                total_equity: totalEquity,
                total_non_current_liabilities: totalNonCurrentLiabilities,
                total_current_liabilities: totalCurrentLiabilities,
                total_liabilities: totalLiabilities,
                total_equity_liabilities: totalEquityLiabilities
            };
        };

        const currentYearTotals = calculateForYear('currentYear');
        const previousYearTotals = calculateForYear('previousYear');

        const combinedTotals: Record<string, { currentYear: number; previousYear: number }> = {};
        Object.keys(currentYearTotals).forEach(key => {
            combinedTotals[key] = {
                currentYear: currentYearTotals[key as keyof typeof currentYearTotals],
                previousYear: previousYearTotals[key as keyof typeof previousYearTotals]
            };
        });

        return combinedTotals;
    }, [bsStructure]);


    // Lifted Form Data Logic for FTA Report - Enhanced to match granular screenshot details
    const ftaFormValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;

        const pnlResult = mapTrialBalanceToPnl(adjustedTrialBalance).values;
        const bsResult = mapTrialBalanceToBalanceSheet(adjustedTrialBalance).values;

        const getPnl = (key: string) => pnlResult[key]?.currentYear || 0;
        const getBs = (key: string) => bsResult[key]?.currentYear || 0;

        const isSbrActive = questionnaireAnswers[6] === 'Yes';

        const baseValues = {
            operatingRevenue: getPnl('revenue'),
            derivingRevenueExpenses: getPnl('cost_of_revenue'),
            grossProfit: getPnl('gross_profit'),
            salaries: getPnl('administrative_expenses') * 0.6,
            depreciation: getPnl('depreciation_ppe'),
            fines: 0,
            donations: 0,
            entertainment: getPnl('business_promotion_selling'),
            otherExpenses: getPnl('administrative_expenses') * 0.4 + getPnl('foreign_exchange_loss') + getPnl('impairment_losses_ppe') + getPnl('impairment_losses_intangible'),
            nonOpExpensesExcl: getPnl('administrative_expenses') + getPnl('selling_distribution_expenses') + getPnl('business_promotion_selling') + getPnl('finance_costs') + getPnl('depreciation_ppe') + getPnl('foreign_exchange_loss') + getPnl('impairment_losses_ppe') + getPnl('impairment_losses_intangible'),
            dividendsReceived: 0,
            otherNonOpRevenue: getPnl('other_income') + getPnl('unrealised_gain_loss_fvtpl') + getPnl('share_profits_associates') + getPnl('gain_loss_revaluation_property'),
            interestIncome: 0,
            interestExpense: getPnl('finance_costs'),
            netInterest: -getPnl('finance_costs'),
            gainAssetDisposal: 0,
            lossAssetDisposal: 0,
            netGainsAsset: 0,
            forexGain: 0,
            forexLoss: getPnl('foreign_exchange_loss'),
            netForex: -getPnl('foreign_exchange_loss'),
            netProfit: getPnl('profit_loss_year'),
            ociIncomeNoRec: 0, ociLossNoRec: 0, ociIncomeRec: 0, ociLossRec: 0, ociOtherIncome: 0, ociOtherLoss: 0,
            totalComprehensiveIncome: getPnl('total_comprehensive_income'),
            totalCurrentAssets: getBs('total_current_assets'),
            ppe: getBs('property_plant_equipment'),
            intangibleAssets: getBs('intangible_assets'),
            financialAssets: getBs('long_term_investments'),
            otherNonCurrentAssets: getBs('total_non_current_assets') - getBs('property_plant_equipment') - getBs('intangible_assets'),
            totalNonCurrentAssets: getBs('total_non_current_assets'),
            totalAssets: getBs('total_assets'),
            totalCurrentLiabilities: getBs('total_current_liabilities'),
            totalNonCurrentLiabilities: getBs('total_non_current_liabilities'),
            totalLiabilities: getBs('total_liabilities'),
            shareCapital: getBs('share_capital'),
            retainedEarnings: getBs('retained_earnings'),
            otherEquity: getBs('shareholders_current_accounts'),
            totalEquity: getBs('total_equity'),
            totalEquityLiabilities: getBs('total_equity_liabilities'),
            taxableIncome: Math.max(0, getPnl('profit_loss_year')),
            corporateTaxLiability: !isSbrActive && Math.max(0, getPnl('profit_loss_year')) > 375000
                ? (Math.max(0, getPnl('profit_loss_year')) - 375000) * 0.09
                : 0,
            actualOperatingRevenue: getPnl('revenue'),
            cashBankBalances: getBs('cash_bank_balances'),
            inventories: getBs('inventories'),
            tradeReceivables: getBs('trade_receivables'),
            otherCurrentAssets: getBs('advances_deposits_receivables')
        };

        if (isSbrActive) {
            const zeroed: any = { ...baseValues };
            Object.keys(zeroed).forEach(k => {
                if (k !== 'actualOperatingRevenue') zeroed[k] = 0;
            });
            return zeroed;
        }

        return baseValues;
    }, [adjustedTrialBalance, questionnaireAnswers]);

    // Initialize and Sync report values when ftaFormValues change
    useEffect(() => {
        if (ftaFormValues) {
            setPnlValues(prev => {
                const next = { ...prev };
                const updates: Record<string, { currentYear: number; previousYear: number }> = {
                    revenue: { currentYear: ftaFormValues.operatingRevenue, previousYear: 0 },
                    cost_of_revenue: { currentYear: ftaFormValues.derivingRevenueExpenses, previousYear: 0 },
                    gross_profit: { currentYear: ftaFormValues.grossProfit, previousYear: 0 },
                    other_income: { currentYear: ftaFormValues.otherNonOpRevenue, previousYear: 0 },
                    administrative_expenses: { currentYear: ftaFormValues.salaries + ftaFormValues.otherExpenses, previousYear: 0 },

                    unrealised_gain_loss_fvtpl: { currentYear: 0, previousYear: 0 }, // Handled in other_income above for summary sync
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
                    profit_after_tax: { currentYear: ftaFormValues.netProfit - ftaFormValues.corporateTaxLiability, previousYear: 0 },
                    total_comprehensive_income: { currentYear: ftaFormValues.totalComprehensiveIncome, previousYear: 0 }
                };

                Object.entries(updates).forEach(([key, value]) => {
                    if (!pnlManualEditsRef.current.has(key) || Object.keys(prev).length === 0) {
                        next[key] = value;
                    }
                });

                return next;
            });

            setBalanceSheetValues(prev => {
                const next = { ...prev };
                const updates: Record<string, { currentYear: number; previousYear: number }> = {
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

                Object.entries(updates).forEach(([key, value]) => {
                    if (!bsManualEditsRef.current.has(key) || Object.keys(prev).length === 0) {
                        next[key] = value;
                    }
                });

                return next;
            });
        }
    }, [ftaFormValues]);

    // MASTER DATA SYNC EFFECT - Ensure Step 11 Taxpayer & Address details are bound to selected company
    useEffect(() => {
        if (company) {
            setReportForm((prev: any) => {
                // If company changes, we want to update master data but potentially preserve manually entered financial data if any
                return {
                    ...prev,
                    taxableNameEn: company.name || prev.taxableNameEn || '',
                    trn: company.corporateTaxTrn || company.trn || prev.trn || '',
                    entityType: company.businessType || prev.entityType || 'Joint Stock Company',
                    entitySubType: company.entitySubType || prev.entitySubType || 'Private',
                    primaryBusiness: company.primaryBusiness || prev.primaryBusiness || 'General Trading',
                    address: company.address || prev.address || '',
                    mobileNumber: company.mobileNumber || prev.mobileNumber || '',
                    landlineNumber: company.landlineNumber || prev.landlineNumber || '',
                    emailId: company.emailId || prev.emailId || '',
                    poBox: company.poBox || prev.poBox || '',
                    periodFrom: company.ctPeriodStart || prev.periodFrom || '',
                    periodTo: company.ctPeriodEnd || prev.periodTo || '',
                    dueDate: company.ctDueDate || prev.dueDate || '',
                    periodDescription: company.ctPeriodStart && company.ctPeriodEnd
                        ? `Tax Period ${company.ctPeriodStart} to ${company.ctPeriodEnd}`
                        : (prev.periodDescription || '')
                };
            });
        }
    }, [company]);

    // --- Report Form Sync (Financial Data) ---
    useEffect(() => {
        const getPnl = (id: string) => computedValues.pnl[id]?.currentYear || 0;
        const getBs = (id: string) => computedValues.bs[id]?.currentYear || 0;

        setReportForm((prev: any) => {
            if (!prev) return prev;
            const next = { ...prev };
            const updates: any = {
                // Profit or Loss
                operatingRevenue: getPnl('revenue'),
                derivingRevenueExpenses: getPnl('cost_of_revenue'),
                grossProfit: getPnl('gross_profit'),
                salaries: getPnl('administrative_expenses') * 0.6,
                depreciation: getPnl('depreciation_ppe'),
                entertainment: getPnl('business_promotion_selling'),
                otherExpenses: getPnl('administrative_expenses') * 0.4 + getPnl('selling_distribution_expenses') + getPnl('foreign_exchange_loss') + getPnl('impairment_losses_ppe') + getPnl('impairment_losses_intangible'),
                nonOpExpensesExcl: getPnl('administrative_expenses') + getPnl('selling_distribution_expenses') + getPnl('business_promotion_selling') + getPnl('finance_costs') + getPnl('depreciation_ppe') + getPnl('foreign_exchange_loss') + getPnl('impairment_losses_ppe') + getPnl('impairment_losses_intangible'),
                finance_costs: getPnl('finance_costs'),
                netProfit: getPnl('profit_loss_year'),
                // OCI
                totalComprehensiveIncome: getPnl('total_comprehensive_income'),
                // SFP
                totalCurrentAssets: getBs('total_current_assets'),
                ppe: getBs('property_plant_equipment'),
                intangibleAssets: getBs('intangible_assets'),
                financialAssets: getBs('long_term_investments'),
                totalNonCurrentAssets: getBs('total_non_current_assets'),
                totalAssets: getBs('total_assets'),
                totalCurrentLiabilities: getBs('total_current_liabilities'),
                totalNonCurrentLiabilities: getBs('total_non_current_liabilities'),
                totalLiabilities: getBs('total_liabilities'),
                shareCapital: getBs('share_capital'),
                retainedEarnings: getBs('retained_earnings'),
                otherEquity: getBs('shareholders_current_accounts'),
                totalEquity: getBs('total_equity'),
                totalEquityLiabilities: getBs('total_equity_liabilities'),
                // Tax Summary
                accountingIncomeTaxPeriod: getPnl('profit_loss_year'),
                taxableIncomeBeforeAdj: getPnl('profit_loss_year'),
                taxableIncomeTaxPeriod: getPnl('profit_loss_year'),
                corporateTaxLiability: (questionnaireAnswers[6] !== 'Yes') && getPnl('profit_loss_year') > 375000
                    ? (getPnl('profit_loss_year') - 375000) * 0.09
                    : 0,
                corporateTaxPayable: (questionnaireAnswers[6] !== 'Yes') && getPnl('profit_loss_year') > 375000
                    ? (getPnl('profit_loss_year') - 375000) * 0.09
                    : 0,
            };

            Object.entries(updates).forEach(([field, value]) => {
                if (!reportManualEditsRef.current.has(field)) {
                    next[field] = value;
                }
            });

            return next;
        });
    }, [pnlValues, balanceSheetValues]);


    // --- Computed Values for Live UI ---
    const computedValues = useMemo(() => ({
        pnl: pnlValues,
        bs: balanceSheetValues
    }), [pnlValues, balanceSheetValues]);

    const bankVatData = useMemo(() => {
        // Simple grand totals from bank statements for comparison
        let totalSales = 0;
        let totalPurchases = 0;

        editedTransactions.forEach(t => {
            const category = t.category || '';
            const isSales = category.startsWith('Income');
            const isPurchases = category.startsWith('Expenses');

            if (isSales) {
                totalSales += (t.credit || 0) - (t.debit || 0);
            } else if (isPurchases) {
                totalPurchases += (t.debit || 0) - (t.credit || 0);
            }
        });

        return {
            grandTotals: {
                sales: totalSales,
                purchases: totalPurchases
            }
        };
    }, [editedTransactions]);

    const getVatExportRows = useCallback((vatData: any) => {
        const { periods, grandTotals } = vatData;
        const rows: any[] = [];
        // headers
        rows.push(["", "SALES (OUTPUTS)", "", "", "", "PURCHASES (INPUTS)", "", "", "", "VAT LIABILITY/(REFUND)"]);
        rows.push(["PERIOD", "ZERO RATED", "STANDARD", "VAT", "TOTAL", "PERIOD", "ZERO RATED", "STANDARD", "VAT", "TOTAL", ""]);

        periods.forEach((p: any) => {
            const periodLabel = `${p.periodFrom} - ${p.periodTo}`;
            rows.push([
                periodLabel, p.sales.zero, p.sales.tv, p.sales.vat, p.sales.total,
                periodLabel, p.purchases.zero, p.purchases.tv, p.purchases.vat, p.purchases.total,
                p.net
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
            isManualNavigationRef.current = true; // Prevent hydration from overriding
            setCurrentStep(7); // Jump to report if already generated (adjusting for new step)
        }
    }, [auditReport, isGeneratingAuditReport, currentStep]);

    const handleBack = () => {
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        if (currentStep === 4) {
            setCurrentStep(3);
        } else if (currentStep === 3) {
            setCurrentStep(2);
        } else if (currentStep === 5) {
            // If we came from VAT flow (data exists in additionalDetails), go to Step 4, otherwise go to Step 2
            if (additionalDetails.vatFileResults && additionalDetails.vatFileResults.length > 0) {
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

    const handleConfirmCategories = async () => {
        const uncategorizedCount = editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length;
        if (uncategorizedCount > 0) {
            alert(`Please categorize all ${uncategorizedCount} transactions before continuing.`);
            return;
        }

        // Prepare fileBalances for persistence (always all files + consolidated ALL row)
        const perFileBalances: FileBalance[] = allFileReconciliations.map(r => ({
            fileName: r.fileName,
            openingBalance: typeof r.openingBalance === 'number' ? r.openingBalance : 0,
            closingBalance: typeof r.closingBalance === 'number' ? r.closingBalance : 0,
            calculatedClosingBalance: typeof r.calculatedClosing === 'number' ? r.calculatedClosing : 0,
            totalDebit: typeof r.totalDebit === 'number' ? r.totalDebit : 0,
            totalCredit: typeof r.totalCredit === 'number' ? r.totalCredit : 0,
            isBalanced: r.isValid,
            status: r.isValid ? 'Balanced' : 'Mismatch',
            currency: r.currency || 'AED'
        }));
        const allFilesEntry: FileBalance = {
            fileName: 'ALL',
            openingBalance: perFileBalances.reduce((sum, r) => sum + (Number(r.openingBalance) || 0), 0),
            closingBalance: perFileBalances.reduce((sum, r) => sum + (Number(r.closingBalance) || 0), 0),
            calculatedClosingBalance: perFileBalances.reduce((sum, r) => sum + (Number(r.calculatedClosingBalance) || 0), 0),
            totalDebit: perFileBalances.reduce((sum, r) => sum + (Number(r.totalDebit) || 0), 0),
            totalCredit: perFileBalances.reduce((sum, r) => sum + (Number(r.totalCredit) || 0), 0),
            isBalanced: perFileBalances.every(r => r.isBalanced),
            status: perFileBalances.every(r => r.isBalanced) ? 'Balanced' : 'Mismatch',
            currency: 'AED'
        };
        const fileBalances: FileBalance[] = [...perFileBalances, allFilesEntry];

        const currentSummary = overallSummary || summary || persistedSummary || {
            accountHolder: '',
            accountNumber: '',
            statementPeriod: '',
            openingBalance: 0,
            closingBalance: 0,
            totalWithdrawals: 0,
            totalDeposits: 0
        };

        const updatedSummary: BankStatementSummary = {
            ...currentSummary,
            fileBalances
        };

        await handleSaveStep(1, {
            editedTransactions,
            summary: updatedSummary, // Save summary with fileBalances
            manualBalances // Save manual balance overrides
        }, 'completed');
        onUpdateTransactions(editedTransactions);
        onGenerateTrialBalance(editedTransactions);
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(2); // Go to Summarization
    };

    const handleSummarizationContinue = () => {
        setVatFlowQuestion(1);
        setShowVatFlowModal(true);
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
            await handleSaveStep(3, { additionalDetails: { vatFileResults: results } }, 'completed');
            isManualNavigationRef.current = true; // Prevent hydration from overriding
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

    const handleVatSummarizationContinue = async () => {
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
        await handleSaveStep(4, { vatManualAdjustments }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(5); // To Opening Balances
    };

    const handleOpeningBalancesComplete = async () => {
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
        await handleSaveStep(5, { openingBalancesData }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
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
                        credit: totalNet < 0 ? Math.round(Math.abs(totalNet)) : 0,
                        baseDebit: Math.round(baseDebit),
                        baseCredit: Math.round(baseCredit)
                    };
                } else if (item.baseDebit !== undefined || item.baseCredit !== undefined) {
                    // Reset to base if notes generated no net change or were removed
                    return {
                        ...item,
                        debit: Math.round(item.baseDebit || 0),
                        credit: Math.round(item.baseCredit || 0),
                        baseDebit: Math.round(item.baseDebit || 0),
                        baseCredit: Math.round(item.baseCredit || 0)
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

            // Sync to breakdowns real-time to update the main TB grid immediately
            if (currentWorkingAccount) {
                const validEntries = updated.filter(e => e.description.trim() !== '' || (Number(e.debit) || 0) > 0 || (Number(e.credit) || 0) > 0);
                setBreakdowns(prevB => ({
                    ...prevB,
                    [currentWorkingAccount]: validEntries
                }));
            }

            return updated;
        });
    };

    const handleVatAdjustmentChange = (periodId: string, field: string, value: string) => {
        setVatManualAdjustments(prev => {
            const currentUpdates: Record<string, string> = {
                ...(prev[periodId] || {}),
                [field]: value
            };

            // Requirement: VAT calculation at 5% on the Standard-Rated amount
            // When Standard Rated changes, automatically update the corresponding VAT field
            if (field === 'salesTv') {
                const amount = parseFloat(value) || 0;
                currentUpdates['salesVat'] = (amount * 0.05).toFixed(2);
            } else if (field === 'purchasesTv') {
                const amount = parseFloat(value) || 0;
                currentUpdates['purchasesVat'] = (amount * 0.05).toFixed(2);
            }

            return {
                ...prev,
                [periodId]: currentUpdates
            };
        });
    };

    const handleAddBreakdownRow = () => {
        setTempBreakdown(prev => [...prev, { description: '', debit: 0, credit: 0 }]);
    };

    const handleRemoveBreakdownRow = (index: number) => {
        setTempBreakdown(prev => {
            const updated = prev.filter((_, i) => i !== index);

            // Sync to breakdowns real-time
            if (currentWorkingAccount) {
                const validEntries = updated.filter(e => e.description.trim() !== '' || (Number(e.debit) || 0) > 0 || (Number(e.credit) || 0) > 0);
                setBreakdowns(prevB => ({
                    ...prevB,
                    [currentWorkingAccount]: validEntries
                }));
            }

            return updated;
        });
    };



    const handleSaveGlobalAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGlobalAccountName.trim() || !newGlobalAccountMain) return;

        const parentToUse = newGlobalAccountMain;
        const subParentToUse = newGlobalAccountChild;

        setCustomRows(prev => [...prev, { parent: parentToUse, subParent: subParentToUse, label: newGlobalAccountName.trim() }]);

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

    const handlePnlChange = (id: string, year: 'currentYear' | 'previousYear', value: number, skipAdjustment?: boolean) => {
        pnlManualEditsRef.current.add(id);
        setPnlValues(prev => {
            const next = {
                ...prev,
                [id]: {
                    currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                    previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
                }
            };

            // Cascading Updates
            const get = (key: string) => next[key]?.[year] || 0;
            const set = (key: string, val: number) => {
                if (!next[key]) next[key] = { currentYear: 0, previousYear: 0 };
                next[key][year] = val;
            };

            // Revenue/COGS -> Gross Profit
            if (id === 'revenue' || id === 'cost_of_revenue') {
                set('gross_profit', get('revenue') - get('cost_of_revenue'));
            }

            // GP/Income/Expenses -> Net Profit
            if (['revenue', 'cost_of_revenue', 'gross_profit', 'other_income', 'unrealised_gain_loss_fvtpl', 'share_profits_associates', 'gain_loss_revaluation_property', 'business_promotion_selling', 'foreign_exchange_loss', 'selling_distribution_expenses', 'administrative_expenses', 'finance_costs', 'depreciation_ppe', 'impairment_losses_ppe', 'impairment_losses_intangible'].includes(id)) {
                const gp = get('gross_profit');
                const otherInc = get('other_income') + get('unrealised_gain_loss_fvtpl') + get('share_profits_associates') + get('gain_loss_revaluation_property');
                const expenses = get('business_promotion_selling') + get('foreign_exchange_loss') + get('selling_distribution_expenses') + get('administrative_expenses') + get('finance_costs') + get('depreciation_ppe') + get('impairment_losses_ppe') + get('impairment_losses_intangible');
                set('profit_loss_year', gp + otherInc - expenses);
            }

            // Net Profit / Tax -> Profit After Tax
            if (['revenue', 'cost_of_revenue', 'gross_profit', 'other_income', 'unrealised_gain_loss_fvtpl', 'share_profits_associates', 'gain_loss_revaluation_property', 'business_promotion_selling', 'foreign_exchange_loss', 'selling_distribution_expenses', 'administrative_expenses', 'finance_costs', 'depreciation_ppe', 'impairment_losses_ppe', 'impairment_losses_intangible', 'profit_loss_year', 'provisions_corporate_tax'].includes(id)) {
                set('profit_after_tax', get('profit_loss_year') - get('provisions_corporate_tax'));
            }

            return next;
        });

        // Adjustment Note Logic
        if (!skipAdjustment && pnlWorkingNotes[id]) {
            const notes = pnlWorkingNotes[id];
            const currentTotal = notes.reduce((sum, n) => sum + (year === 'currentYear' ? (n.currentYearAmount ?? n.amount ?? 0) : (n.previousYearAmount || 0)), 0);

            if (Math.abs(currentTotal - value) > 0.01) {
                const diff = value - currentTotal;
                const adjustmentNote: WorkingNoteEntry = {
                    description: 'Manual Adjustment',
                    currentYearAmount: year === 'currentYear' ? diff : 0,
                    previousYearAmount: year === 'previousYear' ? diff : 0,
                    amount: year === 'currentYear' ? diff : 0,
                    currency: 'AED'
                };
                setPnlWorkingNotes(prev => ({ ...prev, [id]: [...notes, adjustmentNote] }));
            }
        }
    };

    const handleBalanceSheetChange = (id: string, year: 'currentYear' | 'previousYear', value: number, skipAdjustment?: boolean) => {
        bsManualEditsRef.current.add(id);
        setBalanceSheetValues(prev => {
            const updated = {
                ...prev,
                [id]: {
                    currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                    previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
                }
            };

            const totals = calculateBalanceSheetTotals(updated);
            Object.entries(totals).forEach(([totalId, totalValue]) => {
                if (!bsManualEditsRef.current.has(totalId)) {
                    updated[totalId] = totalValue;
                }
            });

            return updated;
        });

        // Adjustment Note Logic
        if (!skipAdjustment && bsWorkingNotes[id]) {
            const notes = bsWorkingNotes[id];
            const currentTotal = notes.reduce((sum, n) => sum + (year === 'currentYear' ? (n.currentYearAmount ?? n.amount ?? 0) : (n.previousYearAmount || 0)), 0);

            if (Math.abs(currentTotal - value) > 0.01) {
                const diff = value - currentTotal;
                const adjustmentNote: WorkingNoteEntry = {
                    description: 'Manual Adjustment',
                    currentYearAmount: year === 'currentYear' ? diff : 0,
                    previousYearAmount: year === 'previousYear' ? diff : 0,
                    amount: year === 'currentYear' ? diff : 0,
                    currency: 'AED'
                };
                setBsWorkingNotes(prev => ({ ...prev, [id]: [...notes, adjustmentNote] }));
            }
        }
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

        const txsToExport = selectedFileFilter === 'ALL'
            ? editedTransactions
            : editedTransactions.filter(t => t.sourceFile === selectedFileFilter);

        // --- Sheet 1: Step 1 - Review Categorization ---
        if (txsToExport.length > 0) {
            const step1Data = txsToExport.map(t => ({
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
        // Recalculate summary from exported transactions for consistency
        const summaryGroups: Record<string, { debit: number, credit: number }> = {};
        txsToExport.forEach(t => {
            const cat = (t.category === 'UNCATEGORIZED' || !t.category) ? 'Uncategorized' : getChildCategory(resolveCategoryPath(t.category, customCategories));
            if (!summaryGroups[cat]) summaryGroups[cat] = { debit: 0, credit: 0 };
            summaryGroups[cat].debit += (t.debit || 0);
            summaryGroups[cat].credit += (t.credit || 0);
        });

        const step2Data = Object.entries(summaryGroups).map(([cat, val]) => ({
            "Category": cat,
            "Debit (AED)": val.debit,
            "Credit (AED)": val.credit
        }));

        // Add Total Row
        const totalDebit = step2Data.reduce((sum, d) => sum + d["Debit (AED)"], 0);
        const totalCredit = step2Data.reduce((sum, d) => sum + d["Credit (AED)"], 0);
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
        const reconToExport = selectedFileFilter === 'ALL'
            ? reconciliationData
            : reconciliationData.filter(r => r.fileName === selectedFileFilter);

        if (reconToExport.length > 0) {
            const reconData = reconToExport.map(r => ({
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

            if (selectedFileFilter === 'ALL' && reconciliationData.length > 1) {
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
            operatingRevenue: (computedValues.pnl['revenue']?.currentYear || reportForm.operatingRevenue || 0),
            derivingRevenueExpenses: (computedValues.pnl['cost_of_revenue']?.currentYear || reportForm.derivingRevenueExpenses || 0),
            grossProfit: (computedValues.pnl['gross_profit']?.currentYear || reportForm.grossProfit || 0),
            netProfit: (computedValues.pnl['profit_loss_year']?.currentYear || reportForm.netProfit || 0),
            // ... the rest of reportForm should already be synced via handleContinueToReport before reaching Step 11
        };

        const finalExportData = getFinalReportExportData(finalReportState);
        const ws11 = XLSX.utils.aoa_to_sheet(finalExportData);
        ws11['!cols'] = [{ wch: 60 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, ws11, "Step 11 - Final Report");

        // --- Sheet 12: Chart of Accounts ---
        const coaData = getCoAListData();
        const wsCoa = XLSX.utils.aoa_to_sheet(coaData);
        wsCoa['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, wsCoa, "Chart of Accounts");

        const exportName = selectedFileFilter === 'ALL'
            ? `${companyName || 'Company'}_Complete_Filing.xlsx`
            : `${companyName || 'Company'}_Complete_Filing_${selectedFileFilter.replace(/\s+/g, '_')}.xlsx`;

        XLSX.writeFile(workbook, exportName);
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

    const handleImportStep1 = () => {
        importStep1InputRef.current?.click();
    };

    const detectTransactionSheet = (workbook: any) => {
        const requiredKeywords = ["date", "description", "debit", "credit"];

        const headersContainKeywords = (row: unknown[]) => {
            const normalizedRow = row.map(cell => String(cell ?? "").toLowerCase());
            return requiredKeywords.every(keyword =>
                normalizedRow.some(value => value.includes(keyword)),
            );
        };

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) continue;
            const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
            for (let i = 0; i < Math.min(5, rows.length); i += 1) {
                if (headersContainKeywords(rows[i])) {
                    return sheetName;
                }
            }
        }

        return workbook.SheetNames[0];
    };

    const handleStep1FileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const parseNumber = (value: any) => {
            if (value === undefined || value === null) return 0;
            const cleaned = String(value).replace(/,/g, '').trim();
            const num = Number(cleaned);
            return Number.isNaN(num) ? 0 : num;
        };

        const parseConfidence = (value: any) => {
            if (value === undefined || value === null) return 0;
            const cleaned = String(value).replace(/[^0-9.]/g, '').trim();
            const num = Number(cleaned);
            return Number.isNaN(num) ? 0 : Math.round(num);
        };

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = detectTransactionSheet(workbook);
            if (sheetName !== workbook.SheetNames[0]) {
                console.info(`[CtType1Results] Selected "${sheetName}" via auto-detect instead of the first tab.`);
            }
            const worksheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            const defaultSourceFile = selectedFileFilter !== 'ALL'
                ? selectedFileFilter
                : (editedTransactions[0]?.sourceFile || file.name);

            const mapped = rows.map((row) => {
                const rawCategory = String(row['Category'] || '').trim();
                const normalizedCategory =
                    rawCategory && rawCategory.toUpperCase() !== 'UNCATEGORIZED'
                        ? resolveCategoryPath(rawCategory, customCategories)
                        : 'UNCATEGORIZED';

                const debitValue = parseNumber(row['Debit'] ?? row['Debit (Orig)'] ?? row['Debit (AED)']);
                const creditValue = parseNumber(row['Credit'] ?? row['Credit (Orig)'] ?? row['Credit (AED)']);
                const detectedCurrency = String(row['Currency (Orig)'] ?? row['Currency'] ?? 'AED').trim() || 'AED';
                const sourceFromSheet = String(row['Source File'] ?? '').trim();
                const resolvedSourceFile = (sourceFromSheet && sourceFromSheet !== '-') ? sourceFromSheet : defaultSourceFile;

                return {
                    date: row['Date'] ? String(row['Date']) : '',
                    description: row['Description'] ? String(row['Description']) : '',
                    debit: debitValue,
                    credit: creditValue,
                    balance: parseNumber(row['Debit (AED)']) - parseNumber(row['Credit (AED)']),
                    currency: detectedCurrency,
                    originalCurrency: detectedCurrency,
                    category: normalizedCategory,
                    confidence: parseConfidence(row['Confidence']),
                    originalDebit: debitValue,
                    originalCredit: creditValue,
                    sourceFile: resolvedSourceFile,
                    originalIndex: 0
                } as Transaction;
            });

            const targetFiles = new Set(mapped.map(t => t.sourceFile).filter(Boolean));
            const merged = [
                ...editedTransactions.filter(t => !targetFiles.has(t.sourceFile || '')),
                ...mapped
            ].map((t, index) => ({ ...t, originalIndex: index }));

            setEditedTransactions(merged);
            setFilterCategory('ALL');
            onUpdateTransactions(merged);
        } catch (error) {
            console.error('Failed to import transactions:', error);
            alert('Unable to import the Excel data. Please use the exported template format.');
        } finally {
            if (event.target) event.target.value = '';
        }
    };

    const handleExportStep1 = () => {
        const txsToExport = selectedFileFilter === 'ALL'
            ? editedTransactions
            : editedTransactions.filter(t => t.sourceFile === selectedFileFilter);

        const wsData = txsToExport.map(t => ({
            "Source File": t.sourceFile || '-',
            Date: formatDate(t.date),
            Description: typeof t.description === 'object' ? JSON.stringify(t.description) : t.description,
            Debit: t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0),
            Credit: t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0),
            Currency: t.originalCurrency || t.currency || 'AED',
            "Debit (AED)": t.debit || 0,
            "Credit (AED)": t.credit || 0,
            Category: (t.category === 'UNCATEGORIZED' || !t.category) ? 'Uncategorized' : getChildCategory(resolveCategoryPath(t.category, customCategories)),
            Confidence: (t.confidence || 0) + '%'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 60 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categorized Transactions");

        // Append Chart of Accounts sheet
        const coaData = getCoAListData();
        const wsCoa = XLSX.utils.aoa_to_sheet(coaData);
        wsCoa['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsCoa, "Chart of Accounts");

        const exportName = selectedFileFilter === 'ALL'
            ? `${companyName || 'Company'}_Transactions_Step1.xlsx`
            : `${companyName || 'Company'}_Transactions_Step1_${selectedFileFilter.replace(/\s+/g, '_')}.xlsx`;

        XLSX.writeFile(wb, exportName);
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

    const importStep2InputRef = useRef<HTMLInputElement>(null);

    const handleImportStepSummary = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets["Bank Account Reconciliation Details"] || workbook.Sheets["Bank Reconciliation"] || workbook.Sheets[workbook.SheetNames.find((n: string) => n.toLowerCase().includes('reconciliation')) || workbook.SheetNames[0]];
            if (!sheet) {
                alert("Missing 'Bank Reconciliation' sheet in the imported file.");
                return;
            }

            const rows: any[] = XLSX.utils.sheet_to_json(sheet);
            let updatedCount = 0;

            setManualBalances(prev => {
                const newBalances = { ...prev };
                rows.forEach((row: any) => {
                    const fileName = row["File Name"];
                    if (fileName && fileName !== "OVERALL TOTAL") {
                        const opening = row["Opening Balance"] !== undefined ? Number(row["Opening Balance"]) : undefined;
                        const closing = row["Actual Closing (Extracted)"] !== undefined ? Number(row["Actual Closing (Extracted)"]) : undefined;

                        if (opening !== undefined || closing !== undefined) {
                            newBalances[fileName] = {
                                ...newBalances[fileName],
                                ...(opening !== undefined ? { opening } : {}),
                                ...(closing !== undefined ? { closing } : {})
                            };
                            updatedCount++;
                        }
                    }
                });
                return newBalances;
            });

            alert(`Successfully updated reconciliation data for ${updatedCount} files.`);
        } catch (error) {
            console.error('Import failed', error);
            alert("Failed to import reconciliation data. Please check the file format.");
        } finally {
            if (event.target) event.target.value = '';
        }
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

    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

    const handleDownloadPDF = async () => {
        setIsDownloadingPdf(true);
        try {
            // Save Step 11 data before generating PDF
            await handleSaveStep(11, {
                reportForm,
                reportManualEdits: Array.from(reportManualEditsRef.current)
            }, 'completed');
            console.log('[Step 11] Saved final report data before PDF download');

            // Extract a clean location from address if possible, otherwise default to DUBAI, UAE
            let locationText = 'DUBAI, UAE';
            if (reportForm.address) {
                const parts = reportForm.address.split(',').map((p: string) => p.trim());
                if (parts.length >= 2) {
                    locationText = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
                } else {
                    locationText = reportForm.address;
                }
            }

            const blob = await ctFilingService.downloadPdf({
                companyName: reportForm.taxableNameEn || companyName,
                period: `For the period: ${reportForm.periodFrom || '-'} to ${reportForm.periodTo || '-'}`,
                pnlStructure,
                pnlValues: computedValues.pnl,
                bsStructure,
                bsValues: computedValues.bs,
                location: locationText,
                pnlWorkingNotes,
                bsWorkingNotes
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(reportForm.taxableNameEn || companyName || 'Financial_Report').replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Download PDF error:', error);
            alert('Failed to generate PDF: ' + error.message);
        } finally {
            setIsDownloadingPdf(false);
        }
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
        const currentTotal = notes.reduce((sum, note) => sum + (note.currentYearAmount ?? note.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, note) => sum + (note.previousYearAmount ?? 0), 0);

        // Sync to P&L values without triggering manual adjustment loop
        handlePnlChange(accountId, 'currentYear', currentTotal, true);
        handlePnlChange(accountId, 'previousYear', previousTotal, true);
    };

    const handleUpdateBsWorkingNote = (accountId: string, notes: WorkingNoteEntry[]) => {
        setBsWorkingNotes(prev => ({ ...prev, [accountId]: notes }));
        const currentTotal = notes.reduce((sum, note) => sum + (note.currentYearAmount ?? note.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, note) => sum + (note.previousYearAmount ?? 0), 0);

        // Sync to Balance Sheet values without triggering manual adjustment loop
        handleBalanceSheetChange(accountId, 'currentYear', currentTotal, true);
        handleBalanceSheetChange(accountId, 'previousYear', previousTotal, true);
    };

    // Account Mapping Functions for Auto-Population

    const handleContinueToProfitAndLoss = async () => {
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
        await handleSaveStep(6, { adjustedTrialBalance, breakdowns }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(7);
    };

    const handleContinueToBalanceSheet = async () => {
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
        await handleSaveStep(7, {
            pnlValues,
            pnlWorkingNotes,
            pnlManualEdits: Array.from(pnlManualEditsRef.current)
        }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(8);
    };

    const handleContinueToLOU = async () => {
        await handleSaveStep(8, {
            balanceSheetValues,
            bsWorkingNotes,
            bsManualEdits: Array.from(bsManualEditsRef.current)
        }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(9);
    };

    const handleContinueToQuestionnaire = async () => {
        await handleSaveStep(9, { louFiles: [] }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(10);
    };

    const handleContinueToReport = async () => {
        const isSbrActive = questionnaireAnswers[6] === 'Yes';

        // Sync P&L and Balance Sheet values to Report Form before viewing
        setReportForm((prev: any) => {
            const next = { ...prev };
            const updates: any = {
                // P&L Sync
                operatingRevenue: computedValues.pnl['revenue']?.currentYear || 0,
                derivingRevenueExpenses: computedValues.pnl['cost_of_revenue']?.currentYear || 0,
                grossProfit: computedValues.pnl['gross_profit']?.currentYear || 0,
                otherNonOpRevenue: computedValues.pnl['other_income']?.currentYear || 0,

                salaries: computedValues.pnl['administrative_expenses']?.currentYear ? (computedValues.pnl['administrative_expenses'].currentYear * 0.4) : (prev.salaries || 0),
                depreciation: computedValues.pnl['depreciation_ppe']?.currentYear || 0,
                netProfit: computedValues.pnl['profit_loss_year']?.currentYear || prev.netProfit,

                // Balance Sheet Sync
                ppe: computedValues.bs['property_plant_equipment']?.currentYear || 0,
                intangibleAssets: computedValues.bs['intangible_assets']?.currentYear || 0,
                financialAssets: computedValues.bs['long_term_investments']?.currentYear || 0,
                otherNonCurrentAssets: computedValues.bs['total_non_current_assets']?.currentYear
                    ? (computedValues.bs['total_non_current_assets'].currentYear - (computedValues.bs['property_plant_equipment']?.currentYear || 0) - (computedValues.bs['intangible_assets']?.currentYear || 0))
                    : (prev.otherNonCurrentAssets || 0),

                totalCurrentAssets: computedValues.bs['total_current_assets']?.currentYear || 0,
                totalNonCurrentAssets: computedValues.bs['total_non_current_assets']?.currentYear || 0,
                totalAssets: computedValues.bs['total_assets']?.currentYear || 0,

                totalCurrentLiabilities: computedValues.bs['total_current_liabilities']?.currentYear || 0,
                totalNonCurrentLiabilities: computedValues.bs['total_non_current_liabilities']?.currentYear || 0,
                totalLiabilities: computedValues.bs['total_liabilities']?.currentYear || 0,

                shareCapital: computedValues.bs['share_capital']?.currentYear || 0,
                retainedEarnings: computedValues.bs['retained_earnings']?.currentYear || 0,
                otherEquity: computedValues.bs['shareholders_current_accounts']?.currentYear || 0,
                totalEquity: computedValues.bs['total_equity']?.currentYear || 0,
                totalEquityLiabilities: computedValues.bs['total_equity_liabilities']?.currentYear || 0,

                // Tax Calculation Sync
                accountingIncomeTaxPeriod: computedValues.pnl['profit_loss_year']?.currentYear || prev.accountingIncomeTaxPeriod,
                taxableIncomeBeforeAdj: computedValues.pnl['profit_loss_year']?.currentYear || prev.taxableIncomeBeforeAdj,
                taxableIncomeTaxPeriod: computedValues.pnl['profit_loss_year']?.currentYear || prev.taxableIncomeTaxPeriod,
                corporateTaxLiability: (questionnaireAnswers[6] !== 'Yes') && (computedValues.pnl['profit_loss_year']?.currentYear || 0) > 375000
                    ? ((computedValues.pnl['profit_loss_year']?.currentYear || 0) - 375000) * 0.09
                    : 0,
                corporateTaxPayable: (questionnaireAnswers[6] !== 'Yes') && (computedValues.pnl['profit_loss_year']?.currentYear || 0) > 375000
                    ? ((computedValues.pnl['profit_loss_year']?.currentYear || 0) - 375000) * 0.09
                    : 0,
            };

            Object.entries(updates).forEach(([field, value]) => {
                if (!reportManualEditsRef.current.has(field)) {
                    next[field] = value;
                }
            });

            return next;
        });
        await handleSaveStep(10, { questionnaireAnswers }, 'completed');
        isManualNavigationRef.current = true; // Prevent hydration from overriding
        setCurrentStep(11);
    };

    const transactionsWithRunningBalance = useMemo(() => {
        const fileGroups: Record<string, any[]> = {};
        editedTransactions.forEach((t, i) => {
            const file = t.sourceFile || 'unknown';
            if (!fileGroups[file]) fileGroups[file] = [];
            fileGroups[file].push({ ...t, originalIndex: i });
        });

        const txsWithBalance: any[] = [];

        Object.keys(fileGroups).forEach(fileName => {
            const group = fileGroups[fileName];
            // Sort by date. If same date, use original index to keep stable order.
            group.sort((a, b) => {
                const dateA = getSortableDate(a.date);
                const dateB = getSortableDate(b.date);
                if (dateA !== dateB) return dateA - dateB;
                return a.originalIndex - b.originalIndex;
            });

            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            let currentBalance = manualBalances[fileName]?.opening ?? (
                stmtSummary?.originalOpeningBalance !== undefined
                    ? stmtSummary.originalOpeningBalance
                    : (stmtSummary?.openingBalance || 0)
            );

            group.forEach(t => {
                const debit = t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0);
                const credit = t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0);
                // Formula: Opening Balance - Total Debit + Total Credit = Closing Balance
                currentBalance = currentBalance - debit + credit;
                t.runningBalance = currentBalance;
            });

            txsWithBalance.push(...group);
        });

        return txsWithBalance;
    }, [editedTransactions, fileSummaries, manualBalances]);

    const filteredTransactions = useMemo(() => {
        let txs = transactionsWithRunningBalance;

        if (selectedFileFilter !== 'ALL') {
            txs = txs.filter(t => t.sourceFile === selectedFileFilter);
        }

        txs = txs.filter(t => {
            const desc = String(typeof t.description === 'string' ? t.description : JSON.stringify(t.description || '')).toLowerCase();
            const matchesSearch = desc.includes(searchTerm.toLowerCase());
            const matchesCategory = filterCategory === 'ALL'
                ? true
                : filterCategory === 'UNCATEGORIZED'
                    ? (!t.category || t.category.toLowerCase().includes('uncategorized'))
                    : resolveCategoryPath(t.category) === filterCategory;
            return matchesSearch && matchesCategory;
        });

        if (sortColumn === 'date') {
            txs = [...txs].sort((a, b) => {
                const dateA = getSortableDate(a.date);
                const dateB = getSortableDate(b.date);
                if (dateA !== dateB) {
                    return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
                }
                return sortDirection === 'asc' ? a.originalIndex - b.originalIndex : b.originalIndex - a.originalIndex;
            });
        }

        if (txs.length === 0 && editedTransactions.length > 0) {
            // Optional: Handle edge case where all items are filtered out
        }
        return txs;
    }, [transactionsWithRunningBalance, searchTerm, filterCategory, selectedFileFilter, sortColumn, sortDirection]);

    const handleSort = (column: 'date') => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const uniqueFiles = useMemo(() => {
        const files = new Set(editedTransactions.map(t => t.sourceFile).filter(Boolean));
        return Array.from(files) as string[];
    }, [editedTransactions]);


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

    const allFileReconciliations = useMemo(() => {
        return uniqueFiles.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const persistedFileRec = persistedSummary?.fileBalances?.find(fb => fb.fileName === fileName);
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);

            // AED Values
            const totalDebitAED = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCreditAED = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);

            // Original Values
            const originalCurrency = fileTransactions.find(t => t.originalCurrency)?.originalCurrency
                || fileTransactions.find(t => t.currency)?.currency
                || 'AED';

            const openingBalanceOrig = manualBalances[fileName]?.opening ?? (stmtSummary?.originalOpeningBalance !== undefined
                ? stmtSummary.originalOpeningBalance
                : (stmtSummary?.openingBalance !== undefined ? stmtSummary.openingBalance : (persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0)));
            const closingBalanceOrig = manualBalances[fileName]?.closing ?? (stmtSummary?.originalClosingBalance !== undefined
                ? stmtSummary.originalClosingBalance
                : (stmtSummary?.closingBalance !== undefined ? stmtSummary.closingBalance : (persistedFileRec?.originalClosingBalance ?? persistedFileRec?.closingBalance ?? 0)));

            const rate = parseFloat(conversionRates[fileName] || '');
            const hasManualRate = !isNaN(rate) && rate > 0;

            const openingBalanceAED = manualBalances[fileName]?.opening !== undefined
                ? (hasManualRate ? manualBalances[fileName].opening * rate : manualBalances[fileName].opening)
                : (hasManualRate ? ((stmtSummary?.originalOpeningBalance ?? stmtSummary?.openingBalance ?? persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0) * rate) : (stmtSummary?.openingBalance || persistedFileRec?.openingBalance || openingBalanceOrig));

            const closingBalanceAED = manualBalances[fileName]?.closing !== undefined
                ? (hasManualRate ? manualBalances[fileName].closing * rate : manualBalances[fileName].closing)
                : (hasManualRate ? ((stmtSummary?.originalClosingBalance ?? stmtSummary?.closingBalance ?? persistedFileRec?.originalClosingBalance ?? persistedFileRec?.closingBalance ?? 0) * rate) : (stmtSummary?.closingBalance || persistedFileRec?.closingBalance || closingBalanceOrig));

            const totalDebitOrig = fileTransactions.reduce((sum, t) => sum + (t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0)), 0);
            const totalCreditOrig = fileTransactions.reduce((sum, t) => sum + (t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0)), 0);

            const calculatedClosingAED = openingBalanceAED - totalDebitAED + totalCreditAED;
            const calculatedClosingOrig = openingBalanceOrig - totalDebitOrig + totalCreditOrig;

            // Validation logic: prioritize original currency diff to avoid rounding errors
            const diffOrig = Math.abs(calculatedClosingOrig - closingBalanceOrig);
            const diffAED = Math.abs(calculatedClosingAED - closingBalanceAED);

            const hasOrig = originalCurrency !== 'AED' || hasManualRate;
            const mismatch = hasOrig ? diffOrig >= 0.1 : diffAED >= 1.0;

            const normalizedClosingAED = mismatch ? calculatedClosingAED : closingBalanceAED;
            const normalizedClosingOrig = mismatch ? calculatedClosingOrig : closingBalanceOrig;
            const normalizedDiffOrig = mismatch ? 0 : diffOrig;
            const isBalanced = mismatch ? false : true;
            const finalDiffOrig = diffOrig;
            const finalDiffAED = diffAED;

            return {
                fileName,
                openingBalance: openingBalanceAED,
                totalDebit: totalDebitAED,
                totalCredit: totalCreditAED,
                calculatedClosing: calculatedClosingAED,
                closingBalance: normalizedClosingAED,
                originalOpeningBalance: openingBalanceOrig,
                originalTotalDebit: totalDebitOrig,
                originalTotalCredit: totalCreditOrig,
                originalCalculatedClosing: calculatedClosingOrig,
                originalClosingBalance: normalizedClosingOrig,
                isValid: isBalanced,
                diff: hasOrig ? finalDiffOrig : finalDiffAED,
                diffOrig: finalDiffOrig,
                diffAED: finalDiffAED,
                currency: originalCurrency,
                hasConversion: hasOrig
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions, manualBalances, conversionRates, persistedSummary]);

    const overallSummary = useMemo(() => {
        if (!uniqueFiles.length || !fileSummaries) return summary || persistedSummary;

        // Take "Opening Balance" and "Calculated Closing" from allFileReconciliations
        const consolidatedOpening = allFileReconciliations.reduce((sum, r) => sum + r.openingBalance, 0);
        const consolidatedClosing = allFileReconciliations.reduce((sum, r) => sum + r.calculatedClosing, 0);

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
    }, [uniqueFiles, fileSummaries, summary, allFileReconciliations]);

    const reconciliationData = useMemo(() => {
        if (summaryFileFilter === 'ALL') return allFileReconciliations;
        return allFileReconciliations.filter(r => r.fileName === summaryFileFilter);
    }, [allFileReconciliations, summaryFileFilter]);

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
            const desc = t.description && typeof t.description === 'object' ? JSON.stringify(t.description) : String(t.description || '');
            if (desc.toLowerCase().includes(findText.toLowerCase())) {
                count++;
                return { ...t, category: resolveCategoryPath(replaceCategory, customCategories) };
            }
            return t;
        }));
        setFindText('');
        if (count > 0) alert(`Updated categories for ${count} transactions.`);
    };

    // VAT Flow Answer Handler - must be after summaryData and reconciliationData are defined
    const handleVatFlowAnswer = async (answer: boolean) => {
        console.log('[VAT Flow] handleVatFlowAnswer called with answer:', answer, 'question:', vatFlowQuestion);

        try {
            // Map all files reconciliation data + consolidated ALL row for persistence
            const perFileBalances: FileBalance[] = allFileReconciliations.map(r => ({
                fileName: r.fileName,
                openingBalance: typeof r.openingBalance === 'number' ? r.openingBalance : 0,
                closingBalance: typeof r.closingBalance === 'number' ? r.closingBalance : 0,
                calculatedClosingBalance: typeof r.calculatedClosing === 'number' ? r.calculatedClosing : 0,
                totalDebit: typeof r.totalDebit === 'number' ? r.totalDebit : 0,
                totalCredit: typeof r.totalCredit === 'number' ? r.totalCredit : 0,
                isBalanced: r.isValid,
                status: r.isValid ? 'Balanced' : 'Mismatch',
                currency: r.currency || 'AED',
                originalOpeningBalance: typeof r.originalOpeningBalance === 'number' ? r.originalOpeningBalance : 0,
                originalClosingBalance: typeof r.originalClosingBalance === 'number' ? r.originalClosingBalance : 0
            }));
            const allFilesEntry: FileBalance = {
                fileName: 'ALL',
                openingBalance: perFileBalances.reduce((sum, r) => sum + (Number(r.openingBalance) || 0), 0),
                closingBalance: perFileBalances.reduce((sum, r) => sum + (Number(r.closingBalance) || 0), 0),
                calculatedClosingBalance: perFileBalances.reduce((sum, r) => sum + (Number(r.calculatedClosingBalance) || 0), 0),
                totalDebit: perFileBalances.reduce((sum, r) => sum + (Number(r.totalDebit) || 0), 0),
                totalCredit: perFileBalances.reduce((sum, r) => sum + (Number(r.totalCredit) || 0), 0),
                isBalanced: perFileBalances.every(r => r.isBalanced),
                status: perFileBalances.every(r => r.isBalanced) ? 'Balanced' : 'Mismatch',
                currency: 'AED'
            };
            const fileBalances: FileBalance[] = [...perFileBalances, allFilesEntry];

            // Create updated summary object including fileBalances
            const baseSummary = overallSummary || summary || persistedSummary || {
                accountHolder: '',
                accountNumber: '',
                statementPeriod: '',
                openingBalance: 0,
                closingBalance: 0,
                totalWithdrawals: 0,
                totalDeposits: 0
            };

            const updatedSummary: BankStatementSummary = {
                ...baseSummary,
                fileBalances
            };

            const step2Data = {
                summaryData,
                reconciliationData,
                manualBalances,
                conversionRates,
                summaryFileFilter,
                summary: updatedSummary // Persist updated summary with file balances
            };

            console.log('[VAT Flow] Step 2 data prepared:', {
                summaryDataLength: summaryData?.length,
                reconciliationDataLength: reconciliationData?.length,
                hasManualBalances: Object.keys(manualBalances).length > 0
            });

            if (vatFlowQuestion === 1) {
                if (answer) {
                    console.log('[VAT Flow] Q1 Yes - Saving step 2 and going to step 3');
                    await handleSaveStep(2, step2Data, 'completed');
                    console.log('[VAT Flow] Step 2 saved successfully');
                    setShowVatFlowModal(false);
                    isManualNavigationRef.current = true; // Prevent hydration from overriding
                    setCurrentStep(3); // To VAT Docs Upload
                    console.log('[VAT Flow] Navigation to step 3 triggered');
                } else {
                    console.log('[VAT Flow] Q1 No - Showing question 2');
                    setVatFlowQuestion(2);
                }
            } else {
                if (answer) {
                    console.log('[VAT Flow] Q2 Yes - Saving step 2 and going to step 3');
                    await handleSaveStep(2, step2Data, 'completed');
                    console.log('[VAT Flow] Step 2 saved successfully');
                    setShowVatFlowModal(false);
                    isManualNavigationRef.current = true; // Prevent hydration from overriding
                    setCurrentStep(3); // To VAT Docs Upload
                    console.log('[VAT Flow] Navigation to step 3 triggered');
                } else {
                    console.log('[VAT Flow] Q2 No - Saving step 2 and going to step 5');
                    await handleSaveStep(2, { ...step2Data, skipVat: true }, 'completed');
                    console.log('[VAT Flow] Step 2 (with skipVat) saved successfully');
                    setShowVatFlowModal(false);
                    isManualNavigationRef.current = true; // Prevent hydration from overriding
                    setCurrentStep(5); // To Opening Balances (Skip Step 3 & 4)
                    console.log('[VAT Flow] Navigation to step 5 triggered');
                }
            }
        } catch (error) {
            console.error('[VAT Flow] Error in handleVatFlowAnswer:', error);
            alert(`Error saving step: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterCategory('ALL');
    };




    const activeSummary = useMemo(() => {
        if (selectedFileFilter === 'ALL') return overallSummary || summary || persistedSummary;

        const fileRec = allFileReconciliations.find(r => r.fileName === selectedFileFilter);
        if (fileRec) {
            const base = fileSummaries?.[selectedFileFilter];
            return {
                ...base,
                openingBalance: fileRec.openingBalance,
                closingBalance: fileRec.calculatedClosing, // Take from Calculated Closing
                originalOpeningBalance: fileRec.originalOpeningBalance,
                originalClosingBalance: fileRec.originalCalculatedClosing // Take from Calculated Closing
            };
        }
        return summary || persistedSummary;
    }, [selectedFileFilter, fileSummaries, summary, persistedSummary, overallSummary, allFileReconciliations]);

    const handleBalanceEdit = (type: 'opening' | 'closing', value: string) => {
        const targetFile = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles.length === 1 ? uniqueFiles[0] : null);
        if (!targetFile) return;

        const val = parseFloat(value.replace(/[^0-9.-]/g, '')) || 0;
        setManualBalances(prev => ({
            ...prev,
            [targetFile]: {
                ...prev[targetFile],
                [type]: val
            }
        }));
    };

    const handleSwapDebitCredit = (originalIndex: number) => {
        setEditedTransactions(prev => {
            const updated = [...prev];
            const t = { ...updated[originalIndex] };

            // Swap AED values
            const oldDebit = t.debit || 0;
            const oldCredit = t.credit || 0;
            t.debit = oldCredit;
            t.credit = oldDebit;

            // Swap Original values if they exist
            const oldOrigDebit = t.originalDebit;
            const oldOrigCredit = t.originalCredit;
            t.originalDebit = oldOrigCredit;
            t.originalCredit = oldOrigDebit;

            updated[originalIndex] = t;
            return updated;
        });
    };

    const renderStep1 = () => {
        const isAllFiles = selectedFileFilter === 'ALL';
        const isSingleFileMode = !isAllFiles || uniqueFiles.length === 1;

        const fileTransactions = isAllFiles ? editedTransactions : editedTransactions.filter(t => t.sourceFile === selectedFileFilter);
        const fileCurrency = (isSingleFileMode && uniqueFiles.length > 0) ?
            (
                (!isAllFiles
                    ? fileTransactions.find(t => t.originalCurrency)?.originalCurrency
                    : editedTransactions.filter(t => t.sourceFile === uniqueFiles[0]).find(t => t.originalCurrency)?.originalCurrency)
                || 'AED'
            ) : 'AED';
        const isMultiCurrency = !isAllFiles && fileCurrency !== 'AED';

        const activeSummary = isAllFiles ? overallSummary : allFileReconciliations.find(r => r.fileName === selectedFileFilter);
        const currentPreviewKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        const hasPreviews = !!(currentPreviewKey && filePreviews[currentPreviewKey]);
        const totalPagesForPreview = filePreviews[currentPreviewKey]?.length || 0;

        return (
            <div className="space-y-6">

                {/* Company Information Card */}
                {company && (
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 shadow-lg p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center border border-blue-500/30 flex-shrink-0">
                                <BuildingOfficeIcon className="w-6 h-6 text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Company Name</p>
                                        <p className="text-sm text-white font-medium">{company.name || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Corporate Tax TRN</p>
                                        <p className="text-sm text-blue-400 font-mono font-semibold">
                                            {company.corporateTaxTrn || company.trn || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Filing Period</p>
                                        <p className="text-sm text-white font-medium">
                                            {period?.start && period?.end
                                                ? `${period.start} - ${period.end}`
                                                : (company.ctPeriodStart && company.ctPeriodEnd
                                                    ? `${company.ctPeriodStart} - ${company.ctPeriodEnd}`
                                                    : 'N/A')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <ResultsStatCard
                        label="Opening Balance"
                        value={isSingleFileMode ? (
                            <div className="flex items-center gap-1 group/input relative">
                                <input
                                    type="text"
                                    key={`opening-${activeSummary?.openingBalance}-${fileCurrency}`}
                                    defaultValue={isMultiCurrency ? (activeSummary?.originalOpeningBalance?.toFixed(2) || '0.00') : (activeSummary?.openingBalance ? (activeSummary?.openingBalance).toFixed(2) : '0.00')}
                                    onBlur={(e) => handleBalanceEdit('opening', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleBalanceEdit('opening', (e.target as HTMLInputElement).value)}
                                    className="bg-slate-950/40 border border-slate-700/50 rounded px-2 py-0.5 w-full focus:outline-none focus:border-blue-500 text-blue-300 font-black font-mono transition-all pr-8"
                                />
                                <span className="absolute right-2 text-[9px] text-slate-500 font-bold">{isMultiCurrency ? fileCurrency : currency}</span>
                            </div>
                        ) : (
                            overallSummary?.openingBalance !== undefined
                                ? `${formatDecimalNumber(overallSummary.openingBalance)} AED`
                                : 'N/A'
                        )}
                        color="text-blue-300"
                        icon={<ArrowUpRightIcon className="w-4 h-4" />}
                    />
                    <ResultsStatCard
                        label="Closing Balance"
                        value={isSingleFileMode ? (
                            <div className="flex items-center gap-1 group/input relative">
                                <input
                                    type="text"
                                    key={`closing-${activeSummary?.closingBalance}-${fileCurrency}`}
                                    defaultValue={isMultiCurrency ? (activeSummary?.originalClosingBalance?.toFixed(2) || '0.00') : (activeSummary?.closingBalance ? (activeSummary?.closingBalance).toFixed(2) : '0.00')}
                                    onBlur={(e) => handleBalanceEdit('closing', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleBalanceEdit('closing', (e.target as HTMLInputElement).value)}
                                    className="bg-slate-950/40 border border-slate-700/50 rounded px-2 py-0.5 w-full focus:outline-none focus:border-purple-500 text-purple-300 font-black font-mono transition-all pr-8"
                                />
                                <span className="absolute right-2 text-[9px] text-slate-500 font-bold">{isMultiCurrency ? fileCurrency : currency}</span>
                            </div>
                        ) : (
                            overallSummary?.closingBalance !== undefined
                                ? `${formatDecimalNumber(overallSummary.closingBalance)} AED`
                                : 'N/A'
                        )}
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
                        value={String(filteredTransactions.filter(t => !t.category || t.category.toLowerCase().includes('uncategorized')).length)}
                        color="text-red-400"
                        icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-400" />}
                    />
                    < ResultsStatCard
                        label="Files"
                        value={String(uniqueFiles.length)}
                        icon={< DocumentDuplicateIcon className="w-5 h-5" />}
                    />
                </div >

                <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-2xl px-6 py-5 mb-6">
                    {/* Top Row: Global Filters */}
                    <div className="flex flex-nowrap items-center gap-4 mb-5 pb-5 border-b border-slate-700/20 overflow-x-auto">
                        <div className="flex items-center gap-2 text-slate-400 self-center">
                            <FunnelIcon className="w-5 h-5 text-slate-500/80" />
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap pt-0.5">Filters</span>
                        </div>

                        <div className="relative group self-center">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 h-10 bg-slate-950/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 w-64 transition-all"
                            />
                        </div>

                        <div className="flex items-center h-10 bg-slate-950/50 rounded-xl border border-slate-700 px-1 gap-1 self-center">
                            <CategoryDropdown
                                value={filterCategory}
                                onChange={(val) => handleCategorySelection(val, { type: 'filter' })}
                                customCategories={customCategories}
                                className="min-w-[180px]"
                                showAllOption={true}
                            />
                            <div className="w-px h-4 bg-slate-700"></div>
                            <select
                                value={selectedFileFilter}
                                onChange={(e) => setSelectedFileFilter(e.target.value)}
                                className="h-full px-3 bg-transparent border-none rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-0 max-w-[180px] cursor-pointer"
                            >
                                <option value="ALL">All Files</option>
                                {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>

                        {(searchTerm || filterCategory !== 'ALL' || selectedFileFilter !== 'ALL') && (
                            <button
                                onClick={handleClearFilters}
                                className="flex items-center gap-1.5 h-10 px-4 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-xl transition-all self-center"
                            >
                                <XMarkIcon className="w-4 h-4" />
                                Clear
                            </button>
                        )}

                        <div className="flex-1"></div>

                        <div className="flex items-center gap-4 flex-shrink-0">
                            <button
                                onClick={() => setShowPreviewPanel(!showPreviewPanel)}
                                className={`h-10 px-4 flex items-center gap-2 rounded-xl text-xs font-bold transition-all border ${showPreviewPanel ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-950/40 border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600'}`}
                            >
                                {showPreviewPanel ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                {showPreviewPanel ? 'Hide Preview' : 'Show Preview'}
                            </button>

                            <button
                                onClick={handleAutoCategorize}
                                disabled={isAutoCategorizing}
                                className={`h-10 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-xl shadow-indigo-500/10 flex items-center transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <SparklesIcon className="w-4 h-4 mr-2 text-violet-200" />
                                {isAutoCategorizing ? 'AI Analysis...' : 'Auto-Categorize'}
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Actions */}
                    <div className="flex flex-wrap items-center gap-8">
                        {/* Bulk Actions Group */}
                        <div className="flex items-center gap-4 bg-slate-950/20 px-4 h-12 rounded-2xl border border-slate-800/60 shadow-inner">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] whitespace-nowrap pt-0.5">Bulk Label</span>
                            <CategoryDropdown
                                value={bulkCategory}
                                onChange={(val) => handleCategorySelection(val, { type: 'bulk' })}
                                customCategories={customCategories}
                                className="min-w-[160px]"
                            />
                            <button
                                onClick={handleBulkApplyCategory}
                                disabled={!bulkCategory || selectedIndices.size === 0}
                                className="h-8 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-lg transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 shadow-lg shadow-indigo-600/10 active:scale-95"
                            >
                                Apply
                            </button>
                            <div className="w-px h-4 bg-slate-700/50 mx-1"></div>
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedIndices.size === 0}
                                className="h-8 px-4 border border-rose-500/20 text-rose-400/60 hover:border-rose-500 hover:bg-rose-500 hover:text-white text-[11px] font-black rounded-lg transition-all disabled:opacity-20 disabled:grayscale active:scale-95"
                            >
                                <TrashIcon className="w-3.5 h-3.5 inline mr-1.5" />
                                Delete ({selectedIndices.size})
                            </button>
                        </div>

                        {/* Find & Replace Group */}
                        <div className="flex items-center gap-4 bg-slate-950/20 px-4 h-12 rounded-2xl border border-slate-800/60 shadow-inner">
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] whitespace-nowrap pt-0.5">Search & Replace</span>
                            <input
                                type="text"
                                placeholder="Match..."
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                className="h-8 px-3 bg-slate-900/50 border border-slate-700/50 rounded-lg text-[11px] text-white focus:outline-none focus:border-emerald-500/50 transition-all w-32 placeholder:text-slate-600"
                            />
                            <ArrowRightIcon className="w-3.5 h-3.5 text-slate-700" />
                            <CategoryDropdown
                                value={replaceCategory}
                                onChange={(val) => handleCategorySelection(val, { type: 'replace' })}
                                customCategories={customCategories}
                                className="min-w-[160px]"
                            />
                            <button
                                onClick={handleFindReplace}
                                disabled={!findText || !replaceCategory}
                                className="h-8 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 shadow-lg shadow-emerald-600/10 active:scale-95"
                            >
                                Run
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6 h-[600px] relative">
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
                                        <th className="px-4 py-3 cursor-pointer hover:bg-gray-700/50 transition-colors group" onClick={() => handleSort('date')}>
                                            <div className="flex items-center gap-1">
                                                Date
                                                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {sortColumn === 'date' ? (
                                                        sortDirection === 'asc' ? <ChevronUpIcon className="w-3 h-3 text-blue-400" /> : <ChevronDownIcon className="w-3 h-3 text-blue-400" />
                                                    ) : (
                                                        <ChevronDownIcon className="w-3 h-3 text-gray-600" />
                                                    )}
                                                </div>
                                                {sortColumn === 'date' && (
                                                    <span className="sr-only">Sorted {sortDirection}</span>
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Debit {isMultiCurrency && `(${fileCurrency})`}</th>
                                        <th className="px-0 py-3 w-8"></th>
                                        <th className="px-4 py-3 text-right whitespace-nowrap">Credit {isMultiCurrency && `(${fileCurrency})`}</th>

                                        {selectedFileFilter !== 'ALL' && <th className="px-4 py-3 text-right whitespace-nowrap">Running Balance {isMultiCurrency && `(${fileCurrency})`}</th>}
                                        <th className="px-4 py-3">Currency</th>
                                        <th className="px-4 py-3">Category</th>
                                        <th className="px-4 py-3 w-10 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredTransactions.length > 0 ? (
                                        filteredTransactions.map((t) => {

                                            return (
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
                                                    <td className="px-4 py-2 text-right font-mono">
                                                        {t.originalDebit !== undefined ? (
                                                            <span className="text-red-400 text-xs">{formatDecimalNumber(t.originalDebit)}</span>
                                                        ) : (
                                                            <span className="text-red-400">{t.debit > 0 ? formatDecimalNumber(t.debit) : '-'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-0 py-2 text-center align-middle">
                                                        <button
                                                            onClick={() => handleSwapDebitCredit(t.originalIndex)}
                                                            className="text-gray-600 hover:text-blue-400 transition-colors p-1 rounded hover:bg-gray-800"
                                                            title="Swap Debit/Credit"
                                                        >
                                                            <ArrowsRightLeftIcon className="w-3 h-3" />
                                                        </button>
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono">
                                                        {t.originalCredit !== undefined ? (
                                                            <span className="text-green-400 text-xs">{formatDecimalNumber(t.originalCredit)}</span>
                                                        ) : (
                                                            <span className="text-green-400">{t.credit > 0 ? formatDecimalNumber(t.credit) : '-'}</span>
                                                        )}
                                                    </td>

                                                    {selectedFileFilter !== 'ALL' && (
                                                        <td className="px-4 py-2 text-right font-mono text-blue-300">
                                                            {formatDecimalNumber(t.runningBalance)}
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-2 text-[10px] text-gray-500 font-black uppercase tracking-widest text-center">
                                                        {isMultiCurrency ? fileCurrency : (t.originalCurrency || t.currency || 'AED')}
                                                    </td>
                                                    <td className="px-4 py-2">
                                                        <CategoryDropdown
                                                            value={t.category || 'UNCATEGORIZED'}
                                                            onChange={(val) => handleCategorySelection(val, { type: 'row', rowIndex: t.originalIndex })}
                                                            customCategories={customCategories}
                                                            className="w-full"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 text-center">
                                                        <button
                                                            onClick={() => handleDeleteTransaction(t.originalIndex)}
                                                            className="text-red-500/50 hover:text-red-500 transition-colors p-1"
                                                            title="Delete Transaction"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="text-center py-10 text-gray-500">No transactions found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {showPreviewPanel && hasPreviews && (
                            <div className="w-full lg:w-1/3 bg-black rounded-lg border border-gray-700 flex flex-col h-[600px] lg:h-full">
                                <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-lg">
                                    <span className="text-xs font-semibold text-white truncate max-w-[150px]">{currentPreviewKey}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => setPreviewPage(p => Math.max(0, p - 1))} className="p-1 hover:bg-gray-700 rounded"><ChevronLeftIcon className="w-4 h-4 text-white" /></button>
                                        <span className="text-xs text-white">{totalPagesForPreview > 0 ? `${previewPage + 1} / ${totalPagesForPreview}` : '0 / 0'}</span>
                                        <button onClick={() => setPreviewPage(p => Math.min(totalPagesForPreview > 0 ? totalPagesForPreview - 1 : 0, p + 1))} className="p-1 hover:bg-gray-700 rounded"><ChevronRightIcon className="w-4 h-4 text-white" /></button>
                                        <button onClick={() => setShowPreviewPanel(false)} className="p-1 hover:bg-gray-700 rounded text-red-400"><XMarkIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-hidden p-2 flex items-center justify-center bg-gray-900">
                                    {filePreviews[currentPreviewKey]?.[previewPage] ? (
                                        <img
                                            src={filePreviews[currentPreviewKey][previewPage]}
                                            alt="Preview"
                                            className="max-w-full max-h-full object-contain"
                                        />
                                    ) : (
                                        <div className="text-gray-600 flex flex-col items-center">
                                            <LoadingIndicator progress={20} statusText="Loading Preview..." />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-700">
                    <div className="text-sm text-gray-400">
                        {(() => {
                            const count = editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length;
                            return (
                                <div className="flex items-center gap-2">
                                    {count > 0 ? (
                                        <span className="text-red-400 font-bold flex items-center animate-pulse">
                                            <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                                            Action Required: {count} transactions are still Uncategorized.
                                        </span>
                                    ) : (
                                        <span className="text-green-400 font-bold flex items-center">
                                            <CheckIcon className="w-5 h-5 mr-2" />
                                            All transactions categorized. Ready to proceed.
                                        </span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExportStep1} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">
                            Download Work in Progress
                        </button>
                        <button onClick={handleImportStep1} className="px-3 py-2 border border-gray-700 text-white rounded-lg hover:border-white hover:text-white transition-colors text-sm">
                            Import Data
                        </button>
                        <input
                            ref={importStep1InputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleStep1FileSelected}
                        />
                        <button
                            onClick={() => {
                                const uncategorized = editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED'));
                                if (uncategorized.length > 0) {
                                    setUncategorizedCount(uncategorized.length);
                                    setShowUncategorizedAlert(true);
                                    return;
                                }
                                handleConfirmCategories();
                            }}
                            disabled={editedTransactions.length === 0}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all"
                            title={editedTransactions.some(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')) ? "Please categorize all items to continue" : "Continue to next step"}
                        >
                            Continue to Summarization
                        </button>
                    </div>
                </div>
            </div >
        );
    };

    const renderStepSummarization = () => (
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
                        <button
                            onClick={() => importStep2InputRef.current?.click()}
                            className="bg-gray-800 border border-gray-600 rounded text-sm text-gray-400 px-3 py-1.5 hover:text-white hover:border-gray-500 transition-colors flex items-center gap-2"
                        >
                            <ArrowDownIcon className="w-4 h-4" />
                            Import
                        </button>
                        <input
                            ref={importStep2InputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleImportStepSummary}
                        />
                        <button onClick={handleExportStepSummary} className="text-gray-400 hover:text-white"><DocumentArrowDownIcon className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Accounts</th>
                                <th className="px-6 py-3 text-right">Debit {summaryFileFilter !== 'ALL' ? `(${reconciliationData[0]?.currency || currency})` : '(AED)'}</th>
                                <th className="px-6 py-3 text-right">Credit {summaryFileFilter !== 'ALL' ? `(${reconciliationData[0]?.currency || currency})` : '(AED)'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {summaryData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium">{row.category}</td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatDecimalNumber(row.debit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatDecimalNumber(row.credit)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-800 font-bold border-t border-gray-600">
                                <td className="px-6 py-3 text-white">Grand Total {summaryFileFilter === 'ALL' ? 'in AED' : ''}</td>
                                <td className="px-6 py-3 text-right font-mono text-red-400">{formatDecimalNumber(summaryData.reduce((acc, r) => acc + r.debit, 0))}</td>
                                <td className="px-6 py-3 text-right font-mono text-green-400">{formatDecimalNumber(summaryData.reduce((acc, r) => acc + r.credit, 0))}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bank Account Reconciliation Section */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                <h3 className="text-xl font-bold text-white mb-6">Bank Account Reconciliation</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Bank Account (File)</th>
                                <th className="px-6 py-3 text-right">Opening Balance</th>
                                <th className="px-6 py-3 text-right">Total Debit (-)</th>
                                <th className="px-6 py-3 text-right">Total Credit (+)</th>
                                <th className="px-6 py-3 text-right">Calculated Closing</th>
                                <th className="px-6 py-3 text-right">Actual Closing</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Currency</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {reconciliationData.map((recon, idx) => {
                                const isAllFiles = summaryFileFilter === 'ALL';
                                const showDual = isAllFiles && recon.hasConversion;

                                return (
                                    <tr key={idx} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-3 text-white font-medium truncate max-w-xs" title={recon.fileName}>{recon.fileName}</td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col items-end">
                                                <input
                                                    type="text"
                                                    defaultValue={recon.originalOpeningBalance?.toFixed(2) || '0.00'}
                                                    onBlur={(e) => {
                                                        const targetFile = recon.fileName;
                                                        const val = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                                                        setManualBalances(prev => ({
                                                            ...prev,
                                                            [targetFile]: { ...prev[targetFile], opening: val }
                                                        }));
                                                    }}
                                                    className="bg-transparent border-b border-gray-700 text-blue-200 text-right w-24 focus:outline-none focus:border-blue-500"
                                                />
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.openingBalance)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-red-400">{formatDecimalNumber(recon.originalTotalDebit)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.totalDebit)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-green-400">{formatDecimalNumber(recon.originalTotalCredit)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.totalCredit)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-blue-300 font-bold">{formatDecimalNumber(recon.originalCalculatedClosing)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.calculatedClosing)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-white">
                                            <div className="flex flex-col items-end">
                                                <input
                                                    type="text"
                                                    defaultValue={recon.originalClosingBalance?.toFixed(2) || '0.00'}
                                                    onBlur={(e) => {
                                                        const targetFile = recon.fileName;
                                                        const val = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                                                        setManualBalances(prev => ({
                                                            ...prev,
                                                            [targetFile]: { ...prev[targetFile], closing: val }
                                                        }));
                                                    }}
                                                    className="bg-transparent border-b border-gray-700 text-white text-right w-24 focus:outline-none focus:border-blue-500"
                                                />
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.closingBalance)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex justify-center">
                                                {recon.isValid ? (
                                                    <span title="Balanced">
                                                        <CheckIcon className="w-5 h-5 text-green-500" />
                                                    </span>
                                                ) : (
                                                    <span title={`Difference: ${formatDecimalNumber(recon.diff)}`}>
                                                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="text-[10px] text-gray-400">{recon.currency}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {summaryFileFilter === 'ALL' && reconciliationData.length > 1 && (() => {
                                // Calculate Totals by explicitly summing the AED columns of individual rows
                                // This ensures the Grand Total reflects the sum of displayed values, avoiding 0.00 issues
                                const totalOpening = reconciliationData.reduce((sum, r) => sum + (Number(r.openingBalance) || 0), 0);
                                const totalDebit = reconciliationData.reduce((sum, r) => sum + (Number(r.totalDebit) || 0), 0);
                                const totalCredit = reconciliationData.reduce((sum, r) => sum + (Number(r.totalCredit) || 0), 0);
                                const totalCalculatedClosing = reconciliationData.reduce((sum, r) => sum + (Number(r.calculatedClosing) || 0), 0);
                                const totalActualClosing = reconciliationData.reduce((sum, r) => sum + (Number(r.closingBalance) || 0), 0);
                                const isAllBalanced = reconciliationData.every(r => r.isValid);

                                return (
                                    <tr className="bg-blue-900/10 font-bold border-t-2 border-blue-800/50">
                                        <td className="px-6 py-4 text-blue-300 uppercase tracking-wider">Grand Total in AED</td>
                                        <td className="px-6 py-4 text-right font-mono text-blue-200">{formatDecimalNumber(totalOpening)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-red-400">{formatDecimalNumber(totalDebit)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-green-400">{formatDecimalNumber(totalCredit)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-blue-300 shadow-inner">{formatDecimalNumber(totalCalculatedClosing)}</td>
                                        <td className="px-6 py-4 text-right font-mono text-white">{formatDecimalNumber(totalActualClosing)}</td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex justify-center">
                                                {isAllBalanced ? (
                                                    <CheckIcon className="w-6 h-6 text-green-500" />
                                                ) : (
                                                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-xs text-gray-400">AED</td>
                                    </tr>
                                );
                            })()}
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-xs text-gray-500 italic flex items-center">
                    <InformationCircleIcon className="w-3 h-3 mr-1" />
                    Formula: Opening Balance - Total Debit + Total Credit = Closing Balance
                </p>
            </div>

            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <button onClick={handleSummarizationContinue} disabled={editedTransactions.length === 0} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all">
                    Confirm & Continue
                </button>
            </div>
        </div >
    );

    const renderStep3VatDocsUpload = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/5">
                            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">VAT Docs Upload</h3>
                            <p className="text-gray-400 mt-1 max-w-2xl">Upload relevant VAT certificates (VAT 201), sales/purchase ledgers, or other supporting documents.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="min-h-[400px]">
                            <FileUploadArea
                                title="Upload VAT Documents"
                                subtitle="VAT 201 returns, Sales/Purchase Ledgers, etc."
                                icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                                selectedFiles={additionalFiles}
                                onFilesSelect={setAdditionalFiles}
                            />
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
                    {additionalFiles.length === 0 && additionalDetails.vatFileResults && additionalDetails.vatFileResults.length > 0 ? (
                        <button
                            onClick={() => {
                                isManualNavigationRef.current = true; // Prevent hydration from overriding
                                setCurrentStep(4);
                            }}
                            className="flex items-center px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-xl shadow-indigo-900/20 transform hover:-translate-y-0.5 transition-all group"
                        >
                            Continue to Summarization
                            <ChevronRightIcon className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                        </button>
                    ) : (
                        <button
                            onClick={handleExtractAdditionalData}
                            disabled={additionalFiles.length === 0 || isExtracting}
                            className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExtracting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                                    Extracting VAT Data...
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-5 h-5 mr-2" />
                                    Extract & Continue
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    const renderStep4VatSummarization = () => {
        const { periods, grandTotals } = vatStepData;

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
                {/* Header Section */}
                <div className="flex flex-col items-center mb-4">
                    <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg backdrop-blur-xl mb-6">
                        <ClipboardCheckIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-3xl font-black text-white tracking-tighter uppercase">VAT Summarization</h3>
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] opacity-60 mt-1">Consolidated VAT 201 Report (Editable)</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto space-y-8">
                    {/* Sales Section */}
                    <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-800 bg-blue-900/10 flex justify-between items-center">
                            <h4 className="text-sm font-black text-blue-300 uppercase tracking-[0.2em]">Sales (Outputs) - As per FTA</h4>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in {summaryFileFilter === 'ALL' ? 'AED' : (allFileReconciliations.find(r => r.fileName === summaryFileFilter)?.currency || 'AED')}</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-center">
                                <thead className="text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                    <tr>
                                        <th className="py-4 px-4 text-left">Period</th>
                                        <th className="py-4 px-4 text-right">Zero Rated</th>
                                        <th className="py-4 px-4 text-right">Standard Rated</th>
                                        <th className="py-4 px-4 text-right text-blue-400">VAT Amount</th>
                                        <th className="py-4 px-4 text-right bg-blue-900/5 text-blue-200">Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300 text-sm font-mono">
                                    {periods.map((p: any) => {
                                        const data = p.sales;
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

                                        return (
                                            <tr key={p.id} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-white text-sm tracking-tight">{dateRange}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <VatEditableCell
                                                        periodId={p.id}
                                                        field="salesZero"
                                                        value={data.zero}
                                                        vatManualAdjustments={vatManualAdjustments}
                                                        onChange={handleVatAdjustmentChange}
                                                    />
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <VatEditableCell
                                                        periodId={p.id}
                                                        field="salesTv"
                                                        value={data.tv}
                                                        vatManualAdjustments={vatManualAdjustments}
                                                        onChange={handleVatAdjustmentChange}
                                                    />
                                                </td>
                                                <td className="py-4 px-4 text-right text-blue-400">
                                                    <VatEditableCell
                                                        periodId={p.id}
                                                        field="salesVat"
                                                        value={data.vat}
                                                        vatManualAdjustments={vatManualAdjustments}
                                                        onChange={handleVatAdjustmentChange}
                                                    />
                                                </td>
                                                <td className="py-4 px-4 text-right font-black bg-blue-500/5 text-blue-100">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-blue-900/20 font-bold border-t-2 border-gray-800">
                                        <td className="py-5 px-4 text-left font-black text-blue-300 text-sm uppercase italic">Sales Total</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-sm">{formatDecimalNumber(grandTotals.sales.zero)}</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-sm">{formatDecimalNumber(grandTotals.sales.tv)}</td>
                                        <td className="py-5 px-4 text-right text-blue-400 text-sm">{formatDecimalNumber(grandTotals.sales.vat)}</td>
                                        <td className="py-5 px-4 text-right text-white text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatDecimalNumber(grandTotals.sales.total)}</td>
                                    </tr>
                                    <tr className="bg-black/20 border-t border-gray-800/50">
                                        <td className="py-3 px-4 text-left font-bold text-gray-500 text-xs uppercase italic">As per Bank Statements</td>
                                        <td colSpan={3}></td>
                                        <td className="py-3 px-4 text-right text-blue-400/80 font-mono text-sm tracking-tighter">{formatDecimalNumber(bankVatData.grandTotals.sales)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Purchases Section */}
                    <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-800 bg-indigo-900/10 flex justify-between items-center">
                            <h4 className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in {summaryFileFilter === 'ALL' ? 'AED' : (allFileReconciliations.find(r => r.fileName === summaryFileFilter)?.currency || 'AED')}</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-center">
                                <thead className="text-xs font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                    <tr>
                                        <th className="py-4 px-4 text-left">Period</th>
                                        <th className="py-4 px-4 text-right">Zero Rated</th>
                                        <th className="py-4 px-4 text-right">Standard Rated</th>
                                        <th className="py-4 px-4 text-right text-indigo-400">VAT Amount</th>
                                        <th className="py-4 px-4 text-right bg-indigo-900/5 text-indigo-200">Total Purchases</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300 text-sm font-mono">
                                    {periods.map((p: any) => {
                                        const data = p.purchases;
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

                                        return (
                                            <tr key={p.id} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-white text-sm tracking-tight">{dateRange}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <VatEditableCell
                                                        periodId={p.id}
                                                        field="purchasesZero"
                                                        value={data.zero}
                                                        vatManualAdjustments={vatManualAdjustments}
                                                        onChange={handleVatAdjustmentChange}
                                                    />
                                                </td>
                                                <td className="py-4 px-4 text-right">
                                                    <VatEditableCell
                                                        periodId={p.id}
                                                        field="purchasesTv"
                                                        value={data.tv}
                                                        vatManualAdjustments={vatManualAdjustments}
                                                        onChange={handleVatAdjustmentChange}
                                                    />
                                                </td>
                                                <td className="py-4 px-4 text-right text-indigo-400">
                                                    <VatEditableCell
                                                        periodId={p.id}
                                                        field="purchasesVat"
                                                        value={data.vat}
                                                        vatManualAdjustments={vatManualAdjustments}
                                                        onChange={handleVatAdjustmentChange}
                                                    />
                                                </td>
                                                <td className="py-4 px-4 text-right font-black bg-indigo-500/5 text-indigo-100">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-indigo-900/20 font-bold border-t-2 border-gray-800">
                                        <td className="py-5 px-4 text-left font-black text-indigo-300 text-sm uppercase italic">Purchases Total</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-sm">{formatDecimalNumber(grandTotals.purchases.zero)}</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-sm">{formatDecimalNumber(grandTotals.purchases.tv)}</td>
                                        <td className="py-5 px-4 text-right text-indigo-400 text-sm">{formatDecimalNumber(grandTotals.purchases.vat)}</td>
                                        <td className="py-5 px-4 text-right text-white text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatDecimalNumber(grandTotals.purchases.total)}</td>
                                    </tr>
                                    <tr className="bg-black/20 border-t border-gray-800/50">
                                        <td className="py-3 px-4 text-left font-bold text-gray-500 text-xs uppercase italic">As per Bank Statements</td>
                                        <td colSpan={3}></td>
                                        <td className="py-3 px-4 text-right text-indigo-400/80 font-mono text-sm tracking-tighter">{formatDecimalNumber(bankVatData.grandTotals.purchases)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Final Net Card */}
                    <div className="max-w-2xl mx-auto">
                        <div className={`rounded-3xl border-2 p-8 flex flex-col items-center justify-center transition-all ${grandTotals.net >= 0 ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-rose-900/10 border-rose-500/30'}`}>
                            <span className={`text-xs font-black uppercase tracking-[0.3em] mb-4 ${grandTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Total VAT Liability / (Refund)</span>
                            <div className="flex items-baseline gap-3">
                                <span className="text-5xl font-mono font-black text-white tracking-tighter">{formatDecimalNumber(grandTotals.net)}</span>
                                <span className={`text-sm font-bold uppercase tracking-widest ${grandTotals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{currency}</span>
                            </div>
                            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border border-white/5">
                                <InformationCircleIcon className="w-4 h-4 text-gray-500" />
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Calculated as (Total Sales VAT - Total Purchase VAT)</span>
                            </div>
                        </div>
                    </div>


                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-8 border-t border-gray-800/50">
                        <button
                            onClick={handleBack}
                            className="flex items-center px-8 py-3 bg-gray-900/60 hover:bg-gray-800 text-gray-400 hover:text-white font-black rounded-xl border border-gray-800/80 transition-all uppercase text-[10px] tracking-widest"
                        >
                            <ChevronLeftIcon className="w-4 h-4 mr-2" />
                            Back
                        </button>
                        <div className="flex gap-4">
                            <input
                                ref={importStep4InputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={handleStep4FileSelected}
                            />
                            <button
                                onClick={handleImportStep4VAT}
                                className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-green-400 rotate-180 group-hover:scale-110 transition-transform" />
                                Import VAT
                            </button>
                            <button
                                onClick={handleExportStep4VAT}
                                className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400 group-hover:scale-110 transition-transform" />
                                Export Step 4
                            </button>
                            <button
                                onClick={handleVatSummarizationContinue}
                                className="flex items-center px-12 py-3 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-black rounded-xl shadow-2xl shadow-blue-900/40 transform hover:-translate-y-0.5 active:scale-95 transition-all uppercase text-[10px] tracking-[0.2em] group"
                            >
                                Confirm & Continue
                                <ChevronRightIcon className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStepOpeningBalances = () => (
        <div className="space-y-6">
            <OpeningBalancesType1
                onComplete={handleOpeningBalancesComplete}
                onBack={handleBack}
                currency={currency}
                accountsData={openingBalancesData}
                onAccountsDataChange={setOpeningBalancesData}
                onExport={handleExportStep3}
                selectedFiles={openingBalanceFiles}
                onFilesSelect={setOpeningBalanceFiles}
                onExtract={handleExtractOpeningBalances}
                isExtracting={isExtractingOpeningBalances}
                companyName={company?.name}
                periodStart={company?.ctPeriodStart}
                periodEnd={company?.ctPeriodEnd}
            />
        </div>
    );



    const getIconForSection = (label: string) => {
        if (label.includes('Assets')) return AssetIcon;
        if (label.includes('Liabilities')) return ScaleIcon;
        if (label.includes('Incomes') || label.includes('Income')) return IncomeIcon;
        if (label.includes('Expenses')) return ExpenseIcon;
        if (label.includes('Equity')) return EquityIcon;
        return BriefcaseIcon;
    };

    const renderStepAdjustTrialBalance = () => {
        const buckets: Record<string, { debit: number, credit: number, isCustom?: boolean }> = {};

        structure.forEach(item => {
            if (item.type === 'row' || item.type === 'subrow') {
                buckets[item.label] = { debit: 0, credit: 0 };
            }
        });

        const normalize = (s: string) => s.replace(/['’]/g, "'").trim().toLowerCase();
        const bucketKeys = Object.keys(buckets);
        const normalizedBucketMap: Record<string, string> = {};
        bucketKeys.forEach(k => { normalizedBucketMap[normalize(k)] = k; });

        const normalizedMapping: Record<string, string> = {};
        Object.entries(ACCOUNT_MAPPING).forEach(([k, v]) => {
            normalizedMapping[normalize(k)] = v;
        });

        if (adjustedTrialBalance) {
            adjustedTrialBalance.forEach(entry => {
                if (entry.account.toLowerCase() === 'totals') return;

                const normAccount = normalize(entry.account);
                const exactMatch = normalizedBucketMap[normAccount];

                if (exactMatch) {
                    buckets[exactMatch].debit += entry.debit;
                    buckets[exactMatch].credit += entry.credit;
                }
                else {
                    const mappedAccount = normalizedMapping[normAccount];
                    const mappedMatch = mappedAccount ? normalizedBucketMap[normalize(mappedAccount)] : null;

                    if (mappedMatch) {
                        buckets[mappedMatch].debit += entry.debit;
                        buckets[mappedMatch].credit += entry.credit;
                    }
                    else {
                        buckets[entry.account] = { debit: entry.debit, credit: entry.credit, isCustom: true };
                    }
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
                    const hasBreakdown = !!breakdowns[item.label];
                    currentSection.items.push({ ...item, ...vals, hasBreakdown });
                    currentSection.totalDebit += vals.debit;
                    currentSection.totalCredit += vals.credit;
                }
            }
        });
        if (currentSection) sections.push(currentSection);

        Object.entries(buckets).forEach(([accountName, values]) => {
            if (!values.isCustom) return;
            let targetSection = 'Expenses';
            for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
                if (Array.isArray(details)) {
                    if (details.includes(accountName)) { targetSection = mainCat; break; }
                } else {
                    for (const [subGroup, accounts] of Object.entries(details)) {
                        if ((accounts as string[]).includes(accountName)) { targetSection = mainCat; break; }
                    }
                }
            }
            if (targetSection === 'Revenues') targetSection = 'Income';

            // Check custom rows mapping to ensure correct section
            const customMap = customRows.find(r => r.label === accountName);
            if (customMap) {
                targetSection = customMap.parent;
            }

            const section = sections.find(s => s.title === targetSection);
            if (section) {
                const hasBreakdown = !!breakdowns[accountName];
                const newItem = { type: 'row', label: accountName, ...values, isCustom: true, hasBreakdown };

                // Try to insert under the correct sub-header if specified
                let inserted = false;
                if (customMap?.subParent) {
                    // Find the index of the subheader
                    const subIdx = section.items.findIndex(i => i.type === 'subheader' && i.label === customMap.subParent);
                    if (subIdx !== -1) {
                        // Find the insertion point: after the subheader and its existing children
                        // We iterate from subIdx + 1 until we find another header/subheader or end
                        let insertIdx = subIdx + 1;
                        while (insertIdx < section.items.length) {
                            const nextItem = section.items[insertIdx];
                            if (nextItem.type === 'subheader' || nextItem.type === 'header') break;
                            insertIdx++;
                        }
                        section.items.splice(insertIdx, 0, newItem);
                        inserted = true;
                    }
                }

                if (!inserted) {
                    section.items.push(newItem);
                }

                section.totalDebit += values.debit;
                section.totalCredit += values.credit;
            }
        });

        const grandTotal = sections.reduce((acc, curr) => ({ debit: acc.debit + curr.totalDebit, credit: acc.credit + curr.totalCredit }), { debit: 0, credit: 0 });

        return (
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-950 rounded-t-xl">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-blue-400 uppercase tracking-wider">Adjust Trial Balance</h3>
                        <div className="text-sm text-gray-400 mt-1 flex gap-4">
                            <span><span className="font-semibold text-gray-500">CLIENT:</span> {company?.name}</span>
                            {company?.ctPeriodStart && <span><span className="font-semibold text-gray-500">PERIOD:</span> {company.ctPeriodStart} - {company.ctPeriodEnd}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isGeneratingTrialBalance && <span className="text-blue-400 text-sm animate-pulse">Recalculating...</span>}
                        <button
                            onClick={() => setShowGlobalAddAccountModal(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm shadow-md"
                        >
                            <PlusIcon className="w-5 h-5 mr-1.5" /> Add Account
                        </button>
                    </div>
                </div>

                <div className="space-y-px">
                    {sections.map(section => (
                        <div key={section.title} className="border-t border-gray-800 last:border-b-0">
                            <button
                                onClick={() => setOpenTbSection(openTbSection === section.title ? null : section.title)}
                                className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === section.title ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}
                            >
                                <div className="flex items-center space-x-3">
                                    <section.icon className="w-5 h-5 text-gray-400" />
                                    <span className="font-bold text-white uppercase tracking-wide">{section.title}</span>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Debit</span>
                                        <span className="font-mono text-white font-semibold">{formatWholeNumber(section.totalDebit)}</span>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Credit</span>
                                        <span className="font-mono text-white font-semibold">{formatWholeNumber(section.totalCredit)}</span>
                                    </div>
                                    {openTbSection === section.title ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                                </div>
                            </button>

                            {openTbSection === section.title && (
                                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="text-[10px] uppercase bg-gray-800/30 text-gray-500 tracking-widest font-bold">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-gray-700/50 w-1/2">Account Name</th>
                                                    <th className="px-4 py-2 text-right border-b border-gray-700/50 w-1/4">Debit ({currency})</th>
                                                    <th className="px-4 py-2 text-right border-b border-gray-700/50 w-1/4">Credit ({currency})</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.items.map((item, idx) => {
                                                    if (item.type === 'subheader') {
                                                        return (
                                                            <tr key={idx} className="bg-gray-900/50">
                                                                <td colSpan={3} className={`px-2 py-2 font-bold text-xs text-gray-400 border-b border-gray-800/50 pt-5 pb-2`}>
                                                                    {item.label}
                                                                </td>
                                                            </tr>
                                                        );
                                                    } else {
                                                        const padding = item.type === 'subrow' ? 'pl-10' : 'pl-6';
                                                        const isZero = (item.debit || 0) === 0 && (item.credit || 0) === 0;
                                                        return (
                                                            <tr key={idx} className={`hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0 ${isZero ? 'opacity-40' : ''}`}>
                                                                <td className={`py-2 pr-4 text-gray-300 font-medium ${padding}`}>
                                                                    <div className="flex items-center justify-between group">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className={item.isCustom ? 'text-blue-300 italic' : ''}>{item.label}</span>
                                                                            {item.hasBreakdown && (
                                                                                <span className="px-1.5 py-0.5 bg-blue-900/40 text-[9px] text-blue-300 rounded-md border border-blue-500/30 font-bold uppercase tracking-tighter">
                                                                                    {breakdowns[item.label]?.length || 0} items
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleOpenWorkingNote(item.label)}
                                                                            className={`p-1.5 rounded transition-all ${item.hasBreakdown ? 'text-blue-400 bg-blue-900/20 opacity-100 shadow-inner' : 'text-gray-600 hover:text-white hover:bg-gray-700 opacity-0 group-hover:opacity-100'}`}
                                                                            title="View/Edit Breakdown (Working Note)"
                                                                        >
                                                                            <ListBulletIcon className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td className="py-1 px-2 text-right">
                                                                    <TbInput
                                                                        label={item.label}
                                                                        field="debit"
                                                                        value={item.debit}
                                                                        hasBreakdown={item.hasBreakdown}
                                                                        onChange={handleCellChange}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-2 text-right">
                                                                    <TbInput
                                                                        label={item.label}
                                                                        field="credit"
                                                                        value={item.credit}
                                                                        hasBreakdown={item.hasBreakdown}
                                                                        onChange={handleCellChange}
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-gray-950/80 border-t border-gray-800 shadow-inner">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                        <div className="flex items-center space-x-12">
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Grand Total Debit</p>
                                <p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(grandTotal.debit)} <span className="text-xs text-gray-500 font-normal">{currency}</span></p>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Grand Total Credit</p>
                                <p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(grandTotal.credit)} <span className="text-xs text-gray-500 font-normal">{currency}</span></p>
                            </div>
                            <div className="text-left px-6 py-2 bg-gray-900 rounded-xl border border-gray-800">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 text-center">Unbalanced Variance</p>
                                <p className={`font-mono font-bold text-xl text-center ${Math.abs(grandTotal.debit - grandTotal.credit) < 0.01 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>
                                    {formatWholeNumber(grandTotal.debit - grandTotal.credit)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-800/50">
                        <button onClick={handleBack} className="flex items-center px-4 py-2 text-gray-400 hover:text-white font-bold transition-colors">
                            <ChevronLeftIcon className="w-5 h-5 mr-1" /> Back
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={handleExportStep4}
                                className="px-5 py-2.5 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-all border border-gray-700 shadow-md flex items-center"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 text-gray-400" />
                                Export Excel
                            </button>
                            <button
                                onClick={() => handleContinueToProfitAndLoss()} // Ensure all data needed for questionnaire is ready
                                disabled={Math.abs(grandTotal.debit - grandTotal.credit) > 0.01}
                                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center disabled:opacity-50 disabled:grayscale transition-all transform hover:scale-[1.02]"
                                title={Math.abs(grandTotal.debit - grandTotal.credit) > 0.01 ? "Trial Balance must be balanced to generate report" : ""}
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                    {reportsError && <p className="text-red-400 text-sm mt-4 text-center bg-red-900/10 p-2 rounded border border-red-900/20">{reportsError}</p>}
                </div>
            </div>
        );
    };

    const renderStep9LOU = () => {
        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden ring-1 ring-gray-800">
                    <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-blue-900/30 rounded-2xl flex items-center justify-center border border-blue-800">
                                <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight uppercase">Letters of Undertaking (LOU)</h3>
                                <p className="text-sm text-gray-400 mt-1">Upload supporting LOU documents for reference.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <FileUploadArea
                            title="Upload LOU Documents"
                            subtitle="PDF, DOCX, or Images"
                            icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                            selectedFiles={louFiles}
                            onFilesSelect={setLouFiles}
                        />
                    </div>

                    <div className="p-8 bg-black border-t border-gray-800 flex justify-between items-center">
                        <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all">
                            <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                        </button>
                        <button
                            onClick={handleContinueToQuestionnaire}
                            className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center transition-all transform hover:scale-[1.02]"
                        >
                            Proceed to Questionnaire
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep10CtQuestionnaire = () => {
        const handleAnswerChange = (questionId: any, answer: string) => {
            setQuestionnaireAnswers(prev => ({ ...prev, [questionId]: answer }));
        };

        // Initialize current revenue in questionnaire state if not present
        if (ftaFormValues && !questionnaireAnswers['curr_revenue'] && ftaFormValues.actualOperatingRevenue !== undefined) {
            setTimeout(() => {
                setQuestionnaireAnswers(prev => ({
                    ...prev,
                    'curr_revenue': String(ftaFormValues.actualOperatingRevenue)
                }));
            }, 0);
        }

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-12">
                <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
                    <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center border border-blue-800">
                                <QuestionMarkCircleIcon className="w-7 h-7 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white uppercase tracking-tight">Corporate Tax Questionnaire</h3>
                                <p className="text-xs text-gray-400 mt-1">Please provide additional details for final tax computation.</p>
                            </div>
                        </div>
                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-800 px-3 py-1.5 rounded-full border border-gray-700">
                            {Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length} / {CT_QUESTIONS.length} Completed
                        </div>
                    </div>

                    <div className="divide-y divide-gray-800 max-h-[60vh] overflow-y-auto custom-scrollbar bg-black/20">
                        {CT_QUESTIONS.map((q) => (
                            <div key={q.id} className="p-6 hover:bg-white/5 transition-colors group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex gap-4 flex-1">
                                        <span className="text-xs font-bold text-gray-600 font-mono mt-1">{String(q.id).padStart(2, '0')}</span>
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium text-gray-200 leading-relaxed">{q.text}</p>
                                            {ftaFormValues && q.id === 6 && (
                                                <div className="mt-2 space-y-3">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operating Revenue of Current Period</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={questionnaireAnswers['curr_revenue'] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                    setQuestionnaireAnswers(prev => ({ ...prev, 'curr_revenue': val }));
                                                                }}
                                                                className="bg-gray-800 border border-blue-900/50 rounded-lg px-4 py-2 text-white text-sm w-full md:w-64 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all font-mono text-right"
                                                                placeholder="0.00"
                                                            />
                                                            <span className="absolute left-3 top-2 text-gray-500 text-sm">{currency}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operating Revenue for Previous Period</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={questionnaireAnswers['prev_revenue'] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                    setQuestionnaireAnswers(prev => ({ ...prev, 'prev_revenue': val }));
                                                                }}
                                                                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-full md:w-64 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all font-mono text-right"
                                                                placeholder="0.00"
                                                            />
                                                            <span className="absolute left-3 top-2 text-gray-500 text-sm">{currency}</span>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                                        {(() => {
                                                            const currentRev = parseFloat(questionnaireAnswers['curr_revenue']) || 0;
                                                            const prevRev = parseFloat(questionnaireAnswers['prev_revenue']) || 0;
                                                            const totalRev = currentRev + prevRev;
                                                            const isIneligible = currentRev >= 3000000 || prevRev >= 3000000;
                                                            const isSbrPotential = !isIneligible;

                                                            return (
                                                                <>
                                                                    <p className="text-xs text-gray-300 flex justify-between mb-1">
                                                                        <span>Total Revenue:</span>
                                                                        <span className="font-mono font-bold">{currency} {formatWholeNumber(totalRev)}</span>
                                                                    </p>
                                                                    <p className={`text-xs font-bold ${isSbrPotential ? 'text-green-400' : 'text-blue-400'} flex items-center gap-2`}>
                                                                        {isSbrPotential ? (
                                                                            <>
                                                                                <CheckIcon className="w-4 h-4" />
                                                                                Small Business Relief Applicable ( &lt; 3M AED )
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <InformationCircleIcon className="w-4 h-4" />
                                                                                Standard Tax Calculation Applies ( &gt;= 3M AED )
                                                                            </>
                                                                        )}
                                                                    </p>
                                                                    {questionnaireAnswers[6] === 'Yes' && <p className="text-[10px] text-gray-500 mt-1 pl-6">All financial amounts in the final report will be set to 0.</p>}
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {q.id === 11 ? (
                                        <input
                                            type="text"
                                            value={questionnaireAnswers[q.id] || ''}
                                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                                            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm w-40 focus:ring-1 focus:ring-blue-500 outline-none placeholder-gray-600 transition-all font-mono text-right"
                                            placeholder="0"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-xl border border-gray-700 shrink-0">
                                            {(() => {
                                                const currentRev = parseFloat(questionnaireAnswers['curr_revenue']) || 0;
                                                const prevRev = parseFloat(questionnaireAnswers['prev_revenue']) || 0;
                                                const isIneligible = currentRev >= 3000000 || prevRev >= 3000000;
                                                const currentAnswer = (q.id === 6 && isIneligible) ? 'No' : (questionnaireAnswers[q.id] || '');

                                                // Auto-update answer if ineligible
                                                if (isIneligible && questionnaireAnswers[q.id] !== 'No' && q.id === 6) {
                                                    setTimeout(() => handleAnswerChange(6, 'No'), 0);
                                                }

                                                return ['Yes', 'No'].map((option) => (
                                                    <button
                                                        key={option}
                                                        type="button"
                                                        onClick={() => (q.id === 6 && isIneligible) ? null : handleAnswerChange(q.id, option)}
                                                        disabled={q.id === 6 && isIneligible}
                                                        className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentAnswer === option
                                                            ? 'bg-blue-600 text-white shadow-lg'
                                                            : 'text-gray-500 hover:text-white hover:bg-gray-700'
                                                            } ${q.id === 6 && isIneligible ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
                                                    >
                                                        {option}
                                                    </button>
                                                ));
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-gray-950 border-t border-gray-800 flex justify-between items-center">
                        <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all">
                            <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                        </button>
                        <button
                            onClick={handleContinueToReport}
                            disabled={Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length < CT_QUESTIONS.length}
                            className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center disabled:opacity-50 disabled:grayscale transition-all transform hover:scale-[1.02]"
                        >
                            Continue to Report
                            <ChevronRightIcon className="w-5 h-5 ml-2" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep11FinalReport = () => {
        if (!ftaFormValues) return <div className="text-center p-20 bg-gray-900 rounded-xl border border-gray-800">Calculating report data...</div>;

        const iconMap: Record<string, any> = {
            InformationCircleIcon,
            IdentificationIcon,
            BuildingOfficeIcon,
            IncomeIcon,
            AssetIcon,
            ListBulletIcon,
            ChartBarIcon,
            ClipboardCheckIcon
        };

        const sections = REPORT_STRUCTURE.map(s => ({
            ...s,
            icon: iconMap[s.iconName] || InformationCircleIcon
        }));

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
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isDownloadingPdf}
                                className={`flex-1 sm:flex-none px-8 py-2.5 bg-blue-600 text-white font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-blue-500 transform hover:scale-[1.03] flex items-center justify-center ${isDownloadingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isDownloadingPdf ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                        Download PDF
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleExportStepReport}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                Export Step 11
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
                                        <div className="flex flex-col gap-y-4 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                            {section.fields.map(f => {
                                                if (f.type === 'header') {
                                                    return (
                                                        <div key={f.field} className="pt-8 pb-3 border-b border-gray-800/80 mb-4 first:pt-0">
                                                            <h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={f.field} className="flex flex-col py-4 border-b border-gray-800/30 last:border-0 group/field">
                                                        <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-blue-400' : 'text-gray-500 group-hover/field:text-gray-400'}`}>{f.label}</label>
                                                        <div className="bg-gray-900/40 rounded-lg p-1 border border-transparent group-hover/field:border-gray-800/50 transition-all">
                                                            {f.type === 'number' ?
                                                                <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} reportForm={reportForm} onChange={handleReportFormChange} /> :
                                                                <ReportInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} reportForm={reportForm} onChange={handleReportFormChange} />
                                                            }
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-gray-950 border-t border-gray-800 text-center">
                        <p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">
                            This is a system generated document and does not require to be signed.
                        </p>
                    </div>
                </div>
            </div>
        );
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
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStepSummarization()}
            {currentStep === 3 && renderStep3VatDocsUpload()}
            {currentStep === 4 && renderStep4VatSummarization()}
            {currentStep === 5 && renderStepOpeningBalances()}
            {currentStep === 6 && renderStepAdjustTrialBalance()}
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
            {currentStep === 9 && renderStep9LOU()}
            {currentStep === 10 && renderStep10CtQuestionnaire()}
            {currentStep === 11 && renderStep11FinalReport()}

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
                                        <option value="">Select Main Category</option>
                                        <option value="Assets">Assets</option>
                                        <option value="Liabilities">Liabilities</option>
                                        <option value="Equity">Equity</option>
                                        <option value="Income">Income</option>
                                        <option value="Expenses">Expenses</option>
                                    </select>
                                </div>

                                {/* Child Category Select */}
                                {newGlobalAccountMain && !Array.isArray(CHART_OF_ACCOUNTS[newGlobalAccountMain as keyof typeof CHART_OF_ACCOUNTS]) && (
                                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Child Category</label>
                                        <select
                                            value={newGlobalAccountChild}
                                            onChange={(e) => setNewGlobalAccountChild(e.target.value)}
                                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                            required
                                        >
                                            <option value="">Select Child Category...</option>
                                            {Object.keys(CHART_OF_ACCOUNTS[newGlobalAccountMain as keyof typeof CHART_OF_ACCOUNTS]).map(key => (
                                                <option key={key} value={key}>{key.replace(/([A-Z])/g, ' $1').trim()}</option>
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

            {/* Uncategorized Items Alert Modal */}
            {showUncategorizedAlert && createPortal(
                <div className="fixed inset-0 z-[100010] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-red-500/50 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 ring-1 ring-red-500/30">
                        <div className="bg-gradient-to-b from-red-900/20 to-transparent p-6 flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Uncategorized Transactions</h3>
                            <p className="text-gray-300 mb-6 text-sm leading-relaxed">
                                You have <span className="text-red-400 font-bold text-base border-b border-red-500/30 px-1">{uncategorizedCount}</span> transaction{uncategorizedCount !== 1 ? 's' : ''} remaining that must be categorized before you can proceed to summarization.
                            </p>
                            <button
                                onClick={() => setShowUncategorizedAlert(false)}
                                className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 hover:shadow-red-900/40 transform hover:-translate-y-0.5 active:translate-y-0 text-sm uppercase tracking-wide"
                            >
                                I Understand, I'll Fix It
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
