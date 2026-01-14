import type { WorkingNoteEntry } from '../types';
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
    QuestionMarkCircleIcon // Add QuestionMarkCircleIcon import
} from './icons';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    // Format to 0 if almost zero
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
    // Check if already DD/MM/YYYY
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const renderReportField = (fieldValue: any) => {
    if (!fieldValue) return '';
    if (typeof fieldValue === 'object') {
        return JSON.stringify(fieldValue, null, 2);
    }
    return String(fieldValue);
};

const getChildCategory = (category: string) => {
    if (!category) return '';
    const parts = category.split('|');
    return parts[parts.length - 1].trim();
};

const resolveCategoryPath = (category: string | undefined): string => {
    if (!category || category === 'UNCATEGORIZED' || category === '') return 'UNCATEGORIZED';

    // Normalize function for fuzzy matching
    const normalize = (s: string) => s.trim().toLowerCase()
        .replace(/[–—]/g, '-') // Replace various dashes
        .replace(/['"“”]/g, '') // Remove quotes
        .replace(/&/g, 'and')
        .replace(/\s+/g, ' ');

    const normalizedInput = normalize(category);

    // If it's already a path, try to validate the parts
    if (category.includes('|')) {
        const parts = category.split('|').map(p => normalize(p.trim()));
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

    return 'UNCATEGORIZED';
};

// Helper for resolveCategoryPath to get the exact casing from CoA
const getChildByValue = (items: string[], normalizedValue: string): string => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[–—]/g, '-').replace(/['"“”]/g, '').replace(/&/g, 'and').replace(/\s+/g, ' ');
    return items.find(i => normalize(i) === normalizedValue) || normalizedValue;
};

const applySheetStyling = (worksheet: any, headerRows: number, totalRows: number = 0) => {
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { fgColor: { rgb: "FF111827" } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const totalStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FF374151" } } };
    const cellBorder = { style: 'thin', color: { rgb: "FF4B5563" } };
    const border = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const numberFormat = '#,##0.00;[Red]-#,##0.00';
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

    const [pnlValues, setPnlValues] = useState<Record<string, number>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, number>>({});

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

    // Keep editedTransactions in sync with prop transactions on initial load and updates
    useEffect(() => {
        const normalized = transactions.map(t => ({
            ...t,
            category: resolveCategoryPath(t.category)
        }));
        setEditedTransactions(normalized);
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

    const renderCategoryOptions = useMemo(() => {
        const options: React.ReactNode[] = [];
        options.push(<option key="UNCATEGORIZED" value="UNCATEGORIZED" className="text-red-400 font-bold bg-gray-900 italic">Uncategorized</option>);
        options.push(<option key="__NEW__" value="__NEW__" className="text-blue-400 font-bold bg-gray-900">+ Add New Category</option>);

        if (customCategories.length > 0) {
            options.push(
                <optgroup label="Custom Categories" key="Custom">
                    {customCategories.map(c => <option key={c} value={c}>{getChildCategory(c)}</option>)}
                </optgroup>
            );
        }

        Object.entries(CHART_OF_ACCOUNTS).forEach(([mainCategory, sub]) => {
            if (Array.isArray(sub)) {
                options.push(
                    <optgroup label={mainCategory} key={mainCategory}>
                        {sub.map(item => (
                            <option key={`${mainCategory} | ${item}`} value={`${mainCategory} | ${item}`}>
                                {item}
                            </option>
                        ))}
                    </optgroup>
                );
            } else if (typeof sub === 'object') {
                options.push(
                    <optgroup label={mainCategory} key={mainCategory}>
                        {Object.entries(sub).map(([subGroup, items]) =>
                            items.map(item => (
                                <option key={`${mainCategory} | ${subGroup} | ${item}`} value={`${mainCategory} | ${subGroup} | ${item}`}>
                                    {item}
                                </option>
                            ))
                        )}
                    </optgroup>
                );
            }
        });
        return options;
    }, [customCategories]);

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
        const corporateTaxLiability = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;

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
                    revenue: ftaFormValues.operatingRevenue,
                    cost_of_revenue: ftaFormValues.derivingRevenueExpenses,
                    gross_profit: ftaFormValues.grossProfit,
                    other_income: ftaFormValues.otherNonOpRevenue + ftaFormValues.dividendsReceived + ftaFormValues.interestIncome + ftaFormValues.gainAssetDisposal + ftaFormValues.forexGain, // Approximate mapping
                    // Add more explicit mappings if available in ftaFormValues
                    administrative_expenses: ftaFormValues.salaries + ftaFormValues.depreciation + ftaFormValues.otherExpenses, // Rough mapping example

                    // Defaults for now if not explicitly separated in ftaFormValues
                    unrealised_gain_loss_fvtpl: 0,
                    share_profits_associates: 0,
                    gain_loss_revaluation_property: 0,
                    impairment_losses_ppe: 0,
                    impairment_losses_intangible: 0,
                    business_promotion_selling: ftaFormValues.entertainment,
                    foreign_exchange_loss: ftaFormValues.forexLoss,
                    selling_distribution_expenses: 0,
                    finance_costs: ftaFormValues.interestExpense,
                    depreciation_ppe: ftaFormValues.depreciation,
                    profit_loss_year: ftaFormValues.netProfit,

                    provisions_corporate_tax: ftaFormValues.corporateTaxLiability,
                    profit_after_tax: ftaFormValues.netProfit - ftaFormValues.corporateTaxLiability
                };
            });

            setBalanceSheetValues(prev => {
                if (Object.keys(prev).length > 0) return prev;

                return {
                    // Assets
                    property_plant_equipment: ftaFormValues.ppe + ftaFormValues.intangibleAssets, // Grouping for simplified view
                    total_non_current_assets: ftaFormValues.totalNonCurrentAssets,

                    cash_bank_balances: ftaFormValues.totalCurrentAssets - ftaFormValues.otherNonCurrentAssets, // Rough calc for demo, refine with specific fields if available
                    inventories: 0, // Need to map if available
                    trade_receivables: 0, // Need to map if available
                    advances_deposits_receivables: 0,
                    related_party_transactions_assets: ftaFormValues.otherNonCurrentAssets, // Assuming generic bucket
                    total_current_assets: ftaFormValues.totalCurrentAssets,

                    total_assets: ftaFormValues.totalAssets,

                    // Equity
                    share_capital: ftaFormValues.shareCapital,
                    statutory_reserve: 0,
                    retained_earnings: ftaFormValues.retainedEarnings,
                    shareholders_current_accounts: ftaFormValues.otherEquity,
                    total_equity: ftaFormValues.totalEquity,

                    // Liabilities
                    employees_end_service_benefits: 0,
                    bank_borrowings_non_current: ftaFormValues.totalNonCurrentLiabilities,
                    total_non_current_liabilities: ftaFormValues.totalNonCurrentLiabilities,

                    short_term_borrowings: 0,
                    related_party_transactions_liabilities: 0,
                    trade_other_payables: ftaFormValues.totalCurrentLiabilities,
                    total_current_liabilities: ftaFormValues.totalCurrentLiabilities,

                    total_liabilities: ftaFormValues.totalLiabilities,
                    total_equity_liabilities: ftaFormValues.totalEquityLiabilities
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

    const handleCategorySelection = (value: string, context: { type: 'row' | 'bulk' | 'replace' | 'filter', rowIndex?: number }) => {
        if (value === '__NEW__') {
            setPendingCategoryContext(context);
            setNewCategoryMain('');
            setNewCategorySub('');
            setShowAddCategoryModal(true);
        } else {
            if (context.type === 'row' && context.rowIndex !== undefined) {
                setEditedTransactions(prev => {
                    const updated = [...prev];
                    updated[context.rowIndex!] = { ...updated[context.rowIndex!], category: resolveCategoryPath(value) };
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
        if (newCategoryMain && newCategorySub.trim()) {
            const formattedName = `${newCategoryMain} | ${newCategorySub.trim()}`;
            setCustomCategories(prev => [...prev, formattedName]);
            if (pendingCategoryContext) {
                handleCategorySelection(formattedName, pendingCategoryContext);
            }
            setShowAddCategoryModal(false);
            setPendingCategoryContext(null);
        }
    };

    const handleAutoCategorize = async () => {
        if (editedTransactions.length === 0) return;
        setIsAutoCategorizing(true);
        try {
            const categorized = await categorizeTransactionsByCoA(editedTransactions);
            const normalized = categorized.map(t => ({
                ...t,
                category: resolveCategoryPath(t.category || 'UNCATEGORIZED')
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
                // Extract per-file Field 8, Field 11, and period dates using all page parts
                const totals = await extractVat201Totals(parts);
                return {
                    fileName: file.name,
                    salesField8: totals.salesTotal,
                    expensesField11: totals.expensesTotal,
                    periodFrom: totals.periodFrom,
                    periodTo: totals.periodTo
                };
            }));

            setAdditionalDetails({ vatFileResults: results });
            if (results.length > 0) {
                setCurrentStep(4); // Automatically move to VAT Summarization on success
            }
        } catch (e) {
            console.error("Failed to extract per-file VAT totals", e);
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
                    const amount = parseFloat(String(value)) || 0;
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
        const shareCapitalValue = shareCapitalKey ? parseFloat(String(additionalDetails[shareCapitalKey])) : 0;

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
                .filter(acc => acc.debit > 0 || acc.debit > 0)
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
            return {
                account,
                debit: net > 0 ? net : 0,
                credit: net < 0 ? Math.abs(net) : 0
            };
        });

        // Auto-populate Share Capital from customer details
        if (company?.shareCapital) {
            const shareCapitalValue = parseFloat(String(company.shareCapital)) || 0;
            if (shareCapitalValue > 0) {
                const shareCapitalIndex = combinedTrialBalance.findIndex(
                    entry => entry.account === 'Share Capital / Owner’s Equity'
                );

                if (shareCapitalIndex > -1) {
                    // Update existing entry
                    combinedTrialBalance[shareCapitalIndex] = {
                        ...combinedTrialBalance[shareCapitalIndex],
                        credit: shareCapitalValue,
                        debit: 0
                    };
                } else {
                    // Add new entry
                    combinedTrialBalance.push({
                        account: 'Share Capital / Owner’s Equity',
                        debit: 0,
                        credit: shareCapitalValue
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
        setTempBreakdown(existin => JSON.parse(JSON.stringify(existing.length ? existing : [])));
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
        if (Object.keys(breakdowns).length === 0) return;

        setAdjustedTrialBalance(prevData => {
            if (!prevData) return null;
            return prevData.map(item => {
                if (breakdowns[item.account]) {
                    const entries = breakdowns[item.account];
                    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                    return { ...item, debit: totalDebit, credit: totalCredit };
                }
                return item;
            });
        });

    }, [breakdowns]);

    const handleWorkingNoteChange = (index: number, field: keyof BreakdownEntry, value: string | number) => {
        setTempBreakdown(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddBreakdownRow = () => {
        setTempBreakdown(prev => [...prev, { description: '', debit: 0, credit: 0 }]);
    };

    const handleRemoveBreakdownRow = (index: number) => {
        setTempBreakdown(prev => prev.filter((_, i) => i !== index));
    };

    const saveWorkingNote = () => {
        if (!currentWorkingAccount) return;

        const validRows = tempBreakdown.filter(r => r.description.trim() !== '' || r.debit !== 0 || r.credit !== 0);

        setBreakdowns(prev => ({ ...prev, [currentWorkingAccount]: validRows }));

        const totalDebit = validRows.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
        const totalCredit = validRows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);

        setAdjustedTrialBalance(prev => {
            if (!prev) return prev;
            const newBalance = [...prev];
            const existingIndex = newBalance.findIndex(item => item.account === currentWorkingAccount);

            if (existingIndex > -1) {
                newBalance[existingIndex] = {
                    ...newBalance[existingIndex],
                    debit: totalDebit,
                    credit: totalCredit
                };
            } else {
                newBalance.splice(newBalance.length - 1, 0, {
                    account: currentWorkingAccount,
                    debit: totalDebit,
                    credit: totalCredit
                });
            }
            return newBalance;
        });

        setWorkingNoteModalOpen(false);
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
            const newItem = { account: newGlobalAccountName.trim(), debit: 0, credit: 0 };

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

    const handlePnlChange = (id: string, value: number) => {
        setPnlValues(prev => ({ ...prev, [id]: value }));
    };

    const handleBalanceSheetChange = (id: string, value: number) => {
        setBalanceSheetValues(prev => ({ ...prev, [id]: value }));
    };

    const handleExportStepPnl = () => {
        const data = pnlStructure.filter(i => i.type === 'item' || i.type === 'total').map(item => {
            const notes = pnlWorkingNotes[item.id];
            const notesStr = notes ? notes.map(n => `${n.description}: ${n.amount}`).join('; ') : '';
            return {
                Item: item.label,
                Amount: pnlValues[item.id] || 0,
                'Working Notes': notesStr
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Profit & Loss");
        XLSX.writeFile(wb, `${companyName || 'Company'}_ProfitAndLoss.xlsx`);
    };

    const handleExportStepBS = () => {
        const data = bsStructure.filter(i => i.type === 'item' || i.type === 'total' || i.type === 'grand_total').map(item => {
            const notes = bsWorkingNotes[item.id];
            const notesStr = notes ? notes.map(n => `${n.description}: ${n.amount}`).join('; ') : '';
            return {
                Item: item.label,
                Amount: balanceSheetValues[item.id] || 0,
                'Working Notes': notesStr
            };
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
        XLSX.writeFile(wb, `${companyName || 'Company'}_BalanceSheet.xlsx`);
    };

    const handleExportToExcel = () => {
        const workbook = XLSX.utils.book_new();

        // --- Sheet 1: Step 1 - Review Transactions ---
        if (editedTransactions.length > 0) {
            const step1Data = editedTransactions.map(t => ({
                Date: formatDate(t.date),
                Description: typeof t.description === 'string' ? t.description : JSON.stringify(t.description),
                Debit: t.debit || null,
                Credit: t.credit || null,
                Balance: t.balance,
                Category: getChildCategory(t.category || ''),
            }));
            const worksheet = XLSX.utils.json_to_sheet(step1Data);
            worksheet['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 40 }];
            applySheetStyling(worksheet, 1, 1);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Step 1 - Transactions');
        }

        // --- Sheet 2: Step 2 - Summarization ---
        if (summaryData.length > 0) {
            const step2Data = summaryData.map(s => ({
                Category: s.category,
                Debit: s.debit,
                Credit: s.credit
            }));
            const ws2 = XLSX.utils.json_to_sheet(step2Data);
            applySheetStyling(ws2, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws2, 'Step 2 - Summary');
        }

        // --- Sheet 3: Step 4 - VAT Summarization ---
        const fileResults = additionalDetails.vatFileResults || [];
        if (fileResults.length > 0) {
            const step4Data = fileResults.map((res: any) => ({
                "File Name": res.fileName,
                "VAT Period From": res.periodFrom || "N/A",
                "VAT Period To": res.periodTo || "N/A",
                "Sales Total (Field 8)": res.salesField8,
                "Expenses Total (Field 11)": res.expensesField11
            }));
            const wsVat = XLSX.utils.json_to_sheet(step4Data);
            applySheetStyling(wsVat, 1, 1);
            XLSX.utils.book_append_sheet(workbook, wsVat, 'Step 4 - VAT Summarization');
        }

        // --- Sheet 4: Step 5 - Opening Balances ---
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
            applySheetStyling(ws5, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws5, 'Step 5 - Opening Balances');
        }

        // --- Sheet 5: Step 6 - Adjusted Trial Balance ---
        if (adjustedTrialBalance) {
            const step6Data = adjustedTrialBalance.map(item => ({
                Account: item.account,
                Debit: item.debit || null,
                Credit: item.credit || null,
            }));
            const ws6 = XLSX.utils.json_to_sheet(step6Data);
            applySheetStyling(ws6, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws6, "Step 6 - Trial Balance");
        }

        // --- Sheet 6: Step 7 - Profit & Loss ---
        const pnlData = pnlStructure.filter(i => i.type === 'item' || i.type === 'total').map(item => ({
            Item: item.label,
            Amount: pnlValues[item.id] || 0,
            'Working Notes': pnlWorkingNotes[item.id] ? pnlWorkingNotes[item.id].map(n => `${n.description}: ${n.amount}`).join('; ') : ''
        }));
        const ws7 = XLSX.utils.json_to_sheet(pnlData);
        XLSX.utils.book_append_sheet(workbook, ws7, "Step 7 - Profit & Loss");

        // --- Sheet 7: Step 8 - Balance Sheet ---
        const bsData = bsStructure.filter(i => i.type === 'item' || i.type === 'total' || i.type === 'grand_total').map(item => ({
            Item: item.label,
            Amount: balanceSheetValues[item.id] || 0,
            'Working Notes': bsWorkingNotes[item.id] ? bsWorkingNotes[item.id].map(n => `${n.description}: ${n.amount}`).join('; ') : ''
        }));
        const ws8 = XLSX.utils.json_to_sheet(bsData);
        XLSX.utils.book_append_sheet(workbook, ws8, "Step 8 - Balance Sheet");

        // --- Sheet 8: Step 9 - LOU ---
        const louData = louFiles.length > 0
            ? louFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const wsLou = XLSX.utils.json_to_sheet(louData);
        XLSX.utils.book_append_sheet(workbook, wsLou, "Step 9 - LOU");

        // --- Sheet 9: Step 10 - Questionnaire ---
        const qData = CT_QUESTIONS.map(q => ({
            "Question": q.text,
            "Answer": questionnaireAnswers[q.id] || '-'
        }));
        const wsQ = XLSX.utils.json_to_sheet(qData);
        wsQ['!cols'] = [{ wch: 80 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsQ, "Step 10 - Questionnaire");

        // --- Sheet 10: Step 11 - Final Report ---
        const finalExportData = getFinalReportExportData();
        const wsFinal = XLSX.utils.aoa_to_sheet(finalExportData);
        wsFinal['!cols'] = [{ wch: 60 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, wsFinal, "Step 11 - Final Report");

        XLSX.writeFile(workbook, `${companyName || 'Company'}_Complete_Filing.xlsx`);
    };

    const getFinalReportExportData = () => {
        const data: any[][] = [
            ["FEDERATION TAX AUTHORITY - CORPORATE TAX RETURN"],
            ["Generated Date", new Date().toLocaleDateString()],
            [],
        ];

        REPORT_STRUCTURE.forEach(section => {
            data.push([section.title.toUpperCase()]);
            section.fields.forEach(field => {
                if (field.type === 'header') {
                    data.push([field.label.replace(/---/g, '').trim().toUpperCase()]);
                } else {
                    const value = reportForm[field.field] !== undefined ? reportForm[field.field] : '';
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
            Debit: t.debit || 0,
            Credit: t.credit || 0,
            Category: (t.category === 'UNCATEGORIZED' || !t.category) ? 'Uncategorized' : getChildCategory(resolveCategoryPath(t.category)),
            Confidence: (t.confidence || 0) + '%'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categorized Transactions");
        XLSX.writeFile(wb, `${companyName || 'Company'}_Transactions_Step1.xlsx`);
    };

    const handleExportStepSummary = () => {
        const wsData = summaryData.map(d => ({
            "Account": d.category,
            "Debit": d.debit,
            "Credit": d.credit
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1, 1);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Summarization");
        XLSX.writeFile(wb, `${companyName || 'Company'}_Summarization_Step2.xlsx`);
    };

    const handleExportStep4VAT = () => {
        const fileResults = additionalDetails.vatFileResults || [];
        const wsData = fileResults.map((res: any) => ({
            "File Name": res.fileName,
            "VAT Period From": res.periodFrom || "N/A",
            "VAT Period To": res.periodTo || "N/A",
            "Sales Total (Field 8)": res.salesField8,
            "Expenses Total (Field 11)": res.expensesField11
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1, 1);
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
        const data = adjustedTrialBalance.map(tb => ({
            Account: tb.account,
            Debit: tb.debit,
            Credit: tb.credit
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
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
        setPnlValues(prev => ({ ...prev, [newItem.id]: 0 }));
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
        setBalanceSheetValues(prev => ({ ...prev, [newItem.id]: 0 }));
    };

    const handleUpdatePnlWorkingNote = (accountId: string, notes: WorkingNoteEntry[]) => {
        setPnlWorkingNotes(prev => ({ ...prev, [accountId]: notes }));

        // Recalculate the value for this account
        const total = notes.reduce((sum, note) => sum + (note.amount || 0), 0);
        setPnlValues(prev => ({ ...prev, [accountId]: total }));
    };

    const handleUpdateBsWorkingNote = (accountId: string, notes: WorkingNoteEntry[]) => {
        setBsWorkingNotes(prev => ({ ...prev, [accountId]: notes }));

        // Recalculate
        const total = notes.reduce((sum, note) => sum + (note.amount || 0), 0);
        setBalanceSheetValues(prev => ({ ...prev, [accountId]: total }));
    };

    const handleContinueToProfitAndLoss = () => {
        setCurrentStep(7);
    };

    const handleContinueToBalanceSheet = () => {
        setCurrentStep(8);
    };

    const handleContinueToLOU = () => {
        setCurrentStep(9);
    };

    const handleContinueToQuestionnaire = () => {
        setCurrentStep(10);
    };

    const handleContinueToReport = () => {
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

    const summaryData = useMemo(() => {
        const txsToSummarize = summaryFileFilter === 'ALL'
            ? editedTransactions
            : editedTransactions.filter(t => t.sourceFile === summaryFileFilter);

        const groups: Record<string, { debit: number, credit: number }> = {};

        txsToSummarize.forEach(t => {
            const cat = getChildCategory(t.category || '(blank)');
            if (!groups[cat]) groups[cat] = { debit: 0, credit: 0 };
            groups[cat].debit += t.debit || 0;
            groups[cat].credit += t.credit || 0;
        });

        return Object.entries(groups)
            .map(([cat, vals]) => ({ category: cat, ...vals }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [editedTransactions, summaryFileFilter]);

    const reconciliationData = useMemo(() => {
        return uniqueFiles.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);
            const totalDebit = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCredit = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);
            const openingBalance = stmtSummary?.openingBalance || 0;
            const closingBalance = stmtSummary?.closingBalance || 0;
            const calculatedClosing = openingBalance - totalDebit + totalCredit;
            const diff = Math.abs(calculatedClosing - closingBalance);
            return {
                fileName,
                openingBalance,
                totalDebit,
                totalCredit,
                calculatedClosing,
                closingBalance,
                isValid: diff < 0.1,
                diff
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions]);

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
        const currentKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        if (currentKey && fileSummaries && fileSummaries[currentKey]) {
            return fileSummaries[currentKey];
        }
        return summary;
    }, [selectedFileFilter, fileSummaries, summary, uniqueFiles]);

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
        const hasPreviews = !!(currentPreviewKey && filePreviews[currentPreviewKey]);
        const totalPagesForPreview = filePreviews[currentPreviewKey]?.length || 0;

        // console.log("CtType1Results.renderStep1: `filteredTransactions` state:", filteredTransactions); // Removed diagnostic log

        return (
            <div className="space-y-6">

                {!balanceValidation.isValid && (
                    <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-4 flex items-start gap-4 animate-pulse">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-red-300 font-bold text-sm uppercase tracking-wider mb-1">Balance Mismatch Warning</h4>
                            <p className="text-red-200/70 text-xs leading-relaxed">
                                The sum of transactions (Net: {(balanceValidation.diff).toFixed(2)}) doesn't match the statement's reported closing balance.
                                Expected: {formatNumber(balanceValidation.actualClosing)} {currency} vs Calculated: {formatNumber(balanceValidation.calculatedClosing)} {currency}.
                                <br />
                                <span className="font-bold">Recommendation:</span> Please check if any pages were skipped or if Column Mapping (Debit/Credit) is correct.
                            </p>
                        </div>
                    </div>
                )}

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
                        value={String(filteredTransactions.filter(t => !t.category || t.category.toLowerCase().includes('uncategorized')).length)}
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
                                <button onClick={handleClearFilters} className="text-sm text-red-400 hover:text-red-300">Clear</button>
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
                            disabled={isAutoCategorizing}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center disabled:opacity-50"
                        >
                            <SparklesIcon className="w-3 h-3 mr-1" />
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
                                    {filteredTransactions.length > 0 ? (
                                        filteredTransactions.map((t) => (
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
                                                        value={t.category || 'UNCATEGORIZED'}
                                                        onChange={(e) => handleCategorySelection(e.target.value, { type: 'row', rowIndex: t.originalIndex })}
                                                        className={`w-full bg-gray-900/50 text-[11px] py-1.5 px-3 rounded-lg border appearance-none cursor-pointer transition-all ${(!t.category || t.category.toUpperCase().includes('UNCATEGORIZED'))
                                                            ? 'border-red-500/30 text-red-300 hover:border-red-500/50'
                                                            : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                                                            } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none shadow-inner`}
                                                    >
                                                        {renderCategoryOptions}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button onClick={() => handleDeleteTransaction(t.originalIndex)} className="text-gray-600 hover:text-red-400">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
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
                        {!showPreviewPanel && (
                            <button onClick={() => setShowPreviewPanel(true)} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-gray-800 border border-gray-600 rounded-l-md text-white hover:bg-gray-700 z-20">
                                <EyeIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-700">
                    <div className="text-sm text-gray-400">
                        <span className="text-white font-bold">{editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length}</span> uncategorized items remaining.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExportStep1} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">
                            Download Work in Progress
                        </button>
                        <button onClick={handleConfirmCategories} disabled={editedTransactions.length === 0} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50">
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
                        <button onClick={handleExportStepSummary} className="text-gray-400 hover:text-white"><DocumentArrowDownIcon className="w-5 h-5" /></button>
                    </div>
                </div>
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
                            {summaryData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium">{row.category}</td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(row.debit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(row.credit)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-800 font-bold border-t border-gray-600">
                                <td className="px-6 py-3 text-white">Grand Total</td>
                                <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(summaryData.reduce((acc, r) => acc + r.debit, 0))}</td>
                                <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(summaryData.reduce((acc, r) => acc + r.credit, 0))}</td>
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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {reconciliationData.map((recon, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium truncate max-w-xs" title={recon.fileName}>{recon.fileName}</td>
                                    <td className="px-6 py-3 text-right font-mono text-blue-200">{formatNumber(recon.openingBalance)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(recon.totalDebit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(recon.totalCredit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-blue-300 font-bold">{formatNumber(recon.calculatedClosing)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(recon.closingBalance)}</td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex justify-center">
                                            {recon.isValid ? (
                                                <span title="Balanced">
                                                    <CheckIcon className="w-5 h-5 text-green-500" />
                                                </span>
                                            ) : (
                                                <span title={`Difference: ${formatNumber(recon.diff)}`}>
                                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
        </div>
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
                </div>
            </div>
        </div>
    );

    const renderStep4VatSummarization = () => {
        const fileResults = additionalDetails.vatFileResults || [];

        // Calculate totals
        const totalSales = fileResults.reduce((sum: number, res: any) => sum + (res.salesField8 || 0), 0);
        const totalExpenses = fileResults.reduce((sum: number, res: any) => sum + (res.expensesField11 || 0), 0);

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center text-center space-y-3 mb-4">
                    <div className="w-16 h-16 bg-blue-900/20 rounded-2xl flex items-center justify-center border border-blue-800/50 mb-2">
                        <ClipboardCheckIcon className="w-10 h-10 text-blue-400" />
                    </div>
                    <h3 className="text-3xl font-black text-white tracking-tight uppercase">VAT Summarization</h3>
                    <p className="text-gray-400 font-bold max-w-lg uppercase tracking-widest text-[10px]">Review the extracted VAT return period and totals for each document.</p>
                </div>

                <div className="max-w-6xl mx-auto">
                    <div className="bg-[#0F172A] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden group">
                        <div className="p-8 border-b border-gray-800 bg-[#0A0F1D]/50 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-blue-900/20 rounded-lg border border-blue-800/30">
                                    <SparklesIcon className="w-5 h-5 text-blue-400" />
                                </div>
                                <h4 className="text-lg font-bold text-white tracking-tight uppercase">Per-File Extraction Results</h4>
                            </div>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleExportStep4VAT}
                                    className="flex items-center px-4 py-2 bg-gray-800/50 hover:bg-gray-700 text-gray-300 hover:text-white font-bold rounded-xl border border-gray-700 transition-all uppercase text-[8px] tracking-widest gap-2"
                                >
                                    <DocumentArrowDownIcon className="w-3.5 h-3.5" />
                                    Export CSV/Excel
                                </button>
                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-gray-800/50 px-4 py-1.5 rounded-full border border-gray-700/50">
                                    {fileResults.length} {fileResults.length === 1 ? 'FILE' : 'FILES'} PROCESSED
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#0A0F1D]/30">
                                        <th className="px-8 py-5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] border-b border-gray-800">File Name</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] border-b border-gray-800 text-center">VAT Return Period</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-green-500 uppercase tracking-[0.2em] border-b border-gray-800 text-right">Sales (Field 8)</th>
                                        <th className="px-8 py-5 text-[10px] font-black text-red-500 uppercase tracking-[0.2em] border-b border-gray-800 text-right">Expenses (Field 11)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/50">
                                    {fileResults.length > 0 ? (
                                        <>
                                            {fileResults.map((res: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-blue-900/5 transition-colors group/row">
                                                    <td className="px-8 py-6">
                                                        <div className="flex items-center gap-3">
                                                            <DocumentTextIcon className="w-5 h-5 text-gray-500 group-hover/row:text-blue-400 transition-colors" />
                                                            <span className="text-sm font-bold text-gray-300 truncate max-w-[300px]">{res.fileName}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-6 text-center">
                                                        {res.periodFrom && res.periodTo ? (
                                                            <div className="inline-flex items-center gap-2 bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-800/30">
                                                                <CalendarDaysIcon className="w-4 h-4 text-blue-400" />
                                                                <span className="text-sm font-bold text-blue-300 tabular-nums">
                                                                    {res.periodFrom} - {res.periodTo}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-600 italic">Period not found</span>
                                                        )}
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <span className="text-lg font-black text-white tabular-nums tracking-tight">
                                                            {formatNumber(res.salesField8 || 0)}
                                                        </span>
                                                    </td>
                                                    <td className="px-8 py-6 text-right">
                                                        <span className="text-lg font-black text-white tabular-nums tracking-tight">
                                                            {formatNumber(res.expensesField11 || 0)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Totals Row */}
                                            <tr className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border-t-2 border-blue-500/30">
                                                <td className="px-8 py-6" colSpan={2}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-500/20 rounded-lg">
                                                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                        </div>
                                                        <span className="text-base font-black text-white uppercase tracking-wider">Overall Total</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="inline-flex items-center gap-2 bg-green-900/30 px-4 py-2 rounded-lg border border-green-500/30">
                                                        <span className="text-xl font-black text-green-400 tabular-nums tracking-tight">
                                                            {formatNumber(totalSales)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="inline-flex items-center gap-2 bg-red-900/30 px-4 py-2 rounded-lg border border-red-500/30">
                                                        <span className="text-xl font-black text-red-400 tabular-nums tracking-tight">
                                                            {formatNumber(totalExpenses)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </>
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center">
                                                    <ExclamationTriangleIcon className="w-12 h-12 text-gray-800 mb-4" />
                                                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No individual file data available.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-6 bg-blue-900/10 border-t border-gray-800 flex items-start gap-4">
                            <InformationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                            <p className="text-[11px] text-blue-200/60 font-medium leading-relaxed uppercase tracking-wider">
                                These figures are extracted strictly from Box 8 (Sales) and Box 11 (Expenses) of each individual <span className="text-blue-400 font-bold">VAT 201 Return</span>. No cross-file aggregation has been applied.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-8 max-w-5xl mx-auto">
                    <button
                        onClick={handleBack}
                        className="flex items-center px-8 py-4 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white font-black rounded-2xl border border-gray-800 transition-all uppercase text-xs tracking-widest"
                    >
                        <ChevronLeftIcon className="w-5 h-5 mr-3" />
                        Back
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={handleVatSummarizationContinue}
                            className="flex items-center px-12 py-4 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-900/40 transform hover:-translate-y-1 transition-all uppercase text-xs tracking-[0.2em] group"
                        >
                            Confirm & Continue
                            <ChevronRightIcon className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStepOpeningBalances = () => (
        <div className="space-y-6">
            <OpeningBalances
                onComplete={handleOpeningBalancesComplete}
                currency={currency}
                accountsData={openingBalancesData}
                onAccountsDataChange={setOpeningBalancesData}
                onExport={handleExportStep3}
                selectedFiles={openingBalanceFiles}
                onFilesSelect={setOpeningBalanceFiles}
                onExtract={handleExtractOpeningBalances}
                isExtracting={isExtractingOpeningBalances}
            />
            <div className="flex justify-start">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
            </div>
        </div>
    );

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

    const renderStepAdjustTrialBalance = () => {
        const buckets: Record<string, { debit: number, credit: number, isCustom?: boolean }> = {};

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
            const section = sections.find(s => s.title === targetSection);
            if (section) {
                const hasBreakdown = !!breakdowns[accountName];
                section.items.push({ type: 'row', label: accountName, ...values, isCustom: true, hasBreakdown });
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
                                        <span className="font-mono text-white font-semibold">{formatNumber(section.totalDebit)}</span>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Credit</span>
                                        <span className="font-mono text-white font-semibold">{formatNumber(section.totalCredit)}</span>
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
                                                                        <span className={item.isCustom ? 'text-blue-300 italic' : ''}>{item.label}</span>
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
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={item.debit !== 0 ? item.debit : ''}
                                                                        onChange={(e) => handleCellChange(item.label, 'debit', e.target.value)}
                                                                        className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700 ${item.hasBreakdown ? 'opacity-60 cursor-not-allowed bg-gray-900' : 'hover:border-gray-500'}`}
                                                                        placeholder="0.00"
                                                                        disabled={item.hasBreakdown}
                                                                    />
                                                                </td>
                                                                <td className="py-1 px-2 text-right">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={item.credit !== 0 ? item.credit : ''}
                                                                        onChange={(e) => handleCellChange(item.label, 'credit', e.target.value)}
                                                                        className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700 ${item.hasBreakdown ? 'opacity-60 cursor-not-allowed bg-gray-900' : 'hover:border-gray-500'}`}
                                                                        placeholder="0.00"
                                                                        disabled={item.hasBreakdown}
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
                                <p className="font-mono font-bold text-2xl text-white">{formatNumber(grandTotal.debit)} <span className="text-xs text-gray-500 font-normal">{currency}</span></p>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Grand Total Credit</p>
                                <p className="font-mono font-bold text-2xl text-white">{formatNumber(grandTotal.credit)} <span className="text-xs text-gray-500 font-normal">{currency}</span></p>
                            </div>
                            <div className="text-left px-6 py-2 bg-gray-900 rounded-xl border border-gray-800">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 text-center">Unbalanced Variance</p>
                                <p className={`font-mono font-bold text-xl text-center ${Math.abs(grandTotal.debit - grandTotal.credit) < 0.01 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>
                                    {formatNumber(grandTotal.debit - grandTotal.credit)}
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
                                                                        <span className="font-mono font-bold">{currency} {formatNumber(totalRev)}</span>
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
                                onClick={handleExportStepReport}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                Export Step 10
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
                                                            {f.type === 'number' ? <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} /> : <ReportInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} />}
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
                    data={pnlValues}
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
                    data={balanceSheetValues}
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

            {showVatFlowModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
                        <h3 className="font-bold mb-4 text-white text-center">{vatFlowQuestion === 1 ? 'VAT 201 Certificates Available?' : 'Sales/Purchase Ledgers Available?'}'</h3>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleVatFlowAnswer(false)} className="px-6 py-2 border border-gray-700 rounded-lg text-white font-semibold hover:bg-gray-800 transition-colors uppercase text-xs">No</button>
                            <button onClick={() => handleVatFlowAnswer(true)} className="px-6 py-2 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-500 transition-colors uppercase text-xs">Yes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Working Note (Breakdown) Modal */}
            {workingNoteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
                                        <td className="px-4 py-3 text-right font-mono">{formatNumber(tempBreakdown.reduce((sum, item) => sum + (item.debit || 0), 0))}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatNumber(tempBreakdown.reduce((sum, item) => sum + (item.credit || 0), 0))}</td>
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
                                <span>Saving will update the main account total automatically.</span>
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
                </div>
            )}
        </div>
    );
};
