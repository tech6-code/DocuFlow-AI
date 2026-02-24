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
    UploadIcon,
    QuestionMarkCircleIcon,
    CloudArrowUpIcon
} from './icons';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

import type { Transaction, Invoice, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, BankStatementSummary, Company, WorkingNoteEntry } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { ProfitAndLossStep, PNL_ITEMS } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS } from './BalanceSheetStep';
import { FileUploadArea } from './VatFilingUpload';
import {
    extractGenericDetailsFromDocuments,
    extractVat201Totals,
    CHART_OF_ACCOUNTS,
    categorizeTransactionsByCoA,
    extractTrialBalanceData,
    extractTransactionsFromImage,
    extractTransactionsFromText
} from '../services/geminiService';
import { convertFileToParts, extractTextFromPDF } from '../utils/fileUtils';
import { InvoiceSummarizationView } from './InvoiceSummarizationView';
import { ReconciliationTable } from './ReconciliationTable';
import { ctFilingService } from '../services/ctFilingService';
import { useCtWorkflow } from '../hooks/useCtWorkflow';
import { parseOpeningBalanceExcel, resolveOpeningBalanceCategory } from '../utils/openingBalanceImport';
import { CategoryDropdown, getChildCategory } from './CategoryDropdown';

declare const XLSX: any;

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

const parseCurrencyAmount = (value: string | number) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (!value) return 0;
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getFirstDefinedAmount = (...values: unknown[]): number => {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') return parseCurrencyAmount(value);
    }
    return 0;
};

const getVatPeriodLabel = (periodFrom?: string, periodTo?: string, fileName?: string) => {
    const from = typeof periodFrom === 'string' ? periodFrom.trim() : '';
    const to = typeof periodTo === 'string' ? periodTo.trim() : '';
    if (from && to) return `${from} - ${to}`;
    if (from || to) return `${from || 'Unknown'} - ${to || 'Unknown'}`;
    return fileName || 'Unknown Period';
};

const normalizeVatFileResult = (result: any, fallbackFileName: string) => {
    console.log(`[VAT Data Extraction] Processing file: ${fallbackFileName}`, result);

    // Standard Rated Supplies (Sales)
    const salesStandardRated = getFirstDefinedAmount(
        result?.sales?.standardRated,
        result?.sales?.standard,
        result?.standardRatedSuppliesAmount,
        result?.salesStandardRated
    );

    // Zero Rated Supplies (Sales)
    const salesZeroRated = getFirstDefinedAmount(
        result?.sales?.zeroRated,
        result?.sales?.zero,
        result?.salesZeroRated
    );

    // VAT Amount (Sales)
    const salesVatAmount = getFirstDefinedAmount(
        result?.sales?.vatAmount,
        result?.sales?.vat,
        result?.standardRatedSuppliesVatAmount,
        result?.salesVatAmount
    );

    // Per USER: Total Sales = Standard Rated Supplies + Zero Rated Supplies + VAT Amount
    const salesTotal = salesStandardRated + salesZeroRated + salesVatAmount;

    // Standard Rated Expenses (Purchases)
    const purchaseStandardRated = getFirstDefinedAmount(
        result?.purchases?.standardRated,
        result?.purchases?.standard,
        result?.standardRatedExpensesAmount,
        result?.purchaseStandardRated
    );

    // Zero Rated Expenses (Purchases)
    const purchaseZeroRated = getFirstDefinedAmount(
        result?.purchases?.zeroRated,
        result?.purchases?.zero,
        result?.purchaseZeroRated
    );

    // VAT Amount (Purchases)
    const purchaseVatAmount = getFirstDefinedAmount(
        result?.purchases?.vatAmount,
        result?.purchases?.vat,
        result?.standardRatedExpensesVatAmount,
        result?.purchaseVatAmount
    );

    // Per USER: Total Purchases = Standard Rated Expenses + Zero Rated Expenses + VAT Amount
    const purchaseTotal = purchaseStandardRated + purchaseZeroRated + purchaseVatAmount;

    // Per USER: Net VAT = Total Sales VAT - Total Purchases VAT
    const netVatPayable = salesVatAmount - purchaseVatAmount;

    console.log(`[VAT Data Extraction] Calculated Results for ${fallbackFileName}:`, {
        sales: { standardRated: salesStandardRated, zeroRated: salesZeroRated, vatAmount: salesVatAmount, total: salesTotal },
        purchases: { standardRated: purchaseStandardRated, zeroRated: purchaseZeroRated, vatAmount: purchaseVatAmount, total: purchaseTotal },
        netVat: netVatPayable
    });

    return {
        fileName: result?.fileName || fallbackFileName,
        periodFrom: result?.periodFrom || result?.taxPeriodFrom || result?.returnPeriodFrom || '',
        periodTo: result?.periodTo || result?.taxPeriodTo || result?.returnPeriodTo || '',
        sales: {
            zeroRated: salesZeroRated,
            standardRated: salesStandardRated,
            vatAmount: salesVatAmount,
            total: salesTotal
        },
        purchases: {
            zeroRated: purchaseZeroRated,
            standardRated: purchaseStandardRated,
            vatAmount: purchaseVatAmount,
            total: purchaseTotal
        },
        netVatPayable: netVatPayable
    };
};

type MappingRule = {
    id: string;
    keywords: Array<string | RegExp>;
    negativeIfMatch?: Array<string | RegExp>;
    excludeIfMatch?: Array<string | RegExp>;
};

const normalizeAccountName = (name: string) => {
    return name
        .toLowerCase()
        .replace(/[’]/g, "'")
        .replace(/ƒ\?t/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
};

const matchesPattern = (value: string, pattern: string | RegExp) => {
    if (typeof pattern === 'string') return value.includes(pattern);
    return pattern.test(value);
};

const matchesRule = (name: string, rule: MappingRule) => {
    const isMatch = rule.keywords.some(keyword => matchesPattern(name, keyword));
    if (!isMatch) return false;
    if (rule.excludeIfMatch && rule.excludeIfMatch.some(keyword => matchesPattern(name, keyword))) {
        return false;
    }
    return true;
};

const getEntryAmount = (entry: TrialBalanceEntry, rule: MappingRule, normalizedName: string) => {
    const net = (entry.debit || 0) - (entry.credit || 0);
    const absolute = Math.abs(net);
    if (rule.negativeIfMatch && rule.negativeIfMatch.some(keyword => matchesPattern(normalizedName, keyword))) {
        return -absolute;
    }
    return absolute;
};

const mapTrialBalanceTotals = (entries: TrialBalanceEntry[] | null, rules: MappingRule[]) => {
    const totals: Record<string, number> = {};
    rules.forEach(rule => {
        totals[rule.id] = 0;
    });
    if (!entries) return totals;
    entries.forEach(entry => {
        if (entry.account.toLowerCase() === 'totals') return;
        const normalizedName = normalizeAccountName(entry.account);
        const rule = rules.find(r => matchesRule(normalizedName, r));
        if (!rule) return;
        totals[rule.id] += getEntryAmount(entry, rule, normalizedName);
    });
    return totals;
};

const buildWorkingNotesFromTrialBalance = (
    entries: TrialBalanceEntry[] | null,
    rules: MappingRule[]
): Record<string, WorkingNoteEntry[]> => {
    const notes: Record<string, WorkingNoteEntry[]> = {};
    rules.forEach(rule => {
        notes[rule.id] = [];
    });
    if (!entries) return notes;

    entries.forEach(entry => {
        if (entry.account.toLowerCase() === 'totals') return;
        const normalizedName = normalizeAccountName(entry.account);
        const rule = rules.find(r => matchesRule(normalizedName, r));
        if (!rule) return;
        const amount = getEntryAmount(entry, rule, normalizedName);
        if (amount === 0) return;
        notes[rule.id].push({
            description: entry.account,
            currentYearAmount: amount,
            previousYearAmount: 0,
            amount
        });
    });

    return notes;
};

const PNL_MAPPING: MappingRule[] = [
    {
        id: 'revenue',
        keywords: [
            'sales revenue � goods',
            'service revenue',
            'interest income',
            /^sales$/i
        ]
    },
    {
        id: 'cost_of_revenue',
        keywords: [
            'cost of goods sold (cogs)',
            'cogs',
            'direct service costs',
            'direct service costs (subcontractors, project costs)',
            'direct cost'
        ]
    },
    {
        id: 'other_income',
        keywords: [
            'dividend received',
            'dividends received',
            'other operating income',
            'miscellaneous income'
        ]
    },
    {
        id: 'unrealised_gain_loss_fvtpl',
        keywords: [
            'unrealised gain on fvtpl investments',
            'unrealised loss on fvtpl investments'
        ],
        negativeIfMatch: ['loss']
    },
    {
        id: 'share_profits_associates',
        keywords: ['share of profit from associates']
    },
    {
        id: 'gain_loss_revaluation_property',
        keywords: [
            'gain on revaluation of investment property',
            'loss on revaluation of investment property'
        ],
        negativeIfMatch: ['loss']
    },
    {
        id: 'impairment_losses_ppe',
        keywords: [
            'impairment loss on equipment',
            'impairment loss on machinery',
            'impairment loss on land and building',
            'impairment loss on property, plant and equipment'
        ]
    },
    {
        id: 'impairment_losses_intangible',
        keywords: [
            'impairment loss on goodwill',
            'impairment loss on patents',
            'impairment loss on trademarks',
            'impairment loss on intangible assets'
        ]
    },
    {
        id: 'business_promotion_selling',
        keywords: [
            'marketing & advertising',
            'travel & entertainment',
            'commission expenses',
            'marketing expense',
            'advertising expense',
            'travel expenses',
            'entertainment expenses'
        ]
    },
    {
        id: 'foreign_exchange_loss',
        keywords: [
            'foreign exchange loss',
            'foreign exchange losses',
            'exchange rate difference loss'
        ]
    },
    {
        id: 'selling_distribution_expenses',
        keywords: [
            'transportation & logistics',
            'shipping costs'
        ]
    },
    {
        id: 'administrative_expenses',
        keywords: [
            'rent expense',
            'utilities (electricity, water, internet)',
            'office supplies & stationery',
            'repairs & maintenance',
            'insurance expense',
            'professional fees (legal, audit, consulting)',
            'it & software subscriptions',
            'salaries & wages',
            'staff benefits (medical, eosb contributions)',
            'training & development',
            'vat expense (non-recoverable)',
            'corporate tax expense',
            'government fees & licenses',
            'bad debt expense',
            'miscellaneous expense'
        ]
    },
    {
        id: 'finance_costs',
        keywords: [
            'bank charges & interest expense',
            'interest expense',
            'bank charges'
        ]
    },
    {
        id: 'depreciation_ppe',
        keywords: [
            'depreciation � furniture & equipment',
            'depreciation � vehicles',
            'amortization � intangibles',
            'depreciation',
            'amortization'
        ]
    }
];

const BS_MAPPING: MappingRule[] = [
    {
        id: 'cash_bank_balances',
        keywords: [
            'cash on hand',
            'bank accounts',
            /\bcash\b/i,
            /\bbank accounts?\b/i
        ],
        excludeIfMatch: ['bank charges']
    },
    {
        id: 'trade_receivables',
        keywords: [
            'accounts receivable'
        ]
    },
    {
        id: 'inventories',
        keywords: [
            'inventory � goods',
            'stock'
        ]
    },
    {
        id: 'advances_deposits_receivables',
        keywords: [
            'prepaid expenses',
            'advances to suppliers',
            'work-in-progress � services'
        ]
    },
    {
        id: 'related_party_transactions_assets',
        keywords: []
    },
    {
        id: 'property_plant_equipment',
        keywords: [
            'furniture & equipment',
            'vehicles'
        ]
    },
    {
        id: 'intangible_assets',
        keywords: [
            'intangibles (software, patents)'
        ]
    },
    {
        id: 'long_term_investments',
        keywords: [
            'long-term investments',
            'investments in associates',
            'other long term investments'
        ]
    },
    {
        id: 'short_term_borrowings',
        keywords: [
            'short-term loans'
        ]
    },
    {
        id: 'related_party_transactions_liabilities',
        keywords: []
    },
    {
        id: 'trade_other_payables',
        keywords: [
            'accounts payable',
            'accrued expenses',
            'advances from customers',
            'vat payable (output vat)',
            'corporate tax payable',
            'vat payable'
        ]
    },
    {
        id: 'employees_end_service_benefits',
        keywords: [
            'employee end-of-service benefits provision'
        ]
    },
    {
        id: 'bank_borrowings_non_current',
        keywords: [
            'long-term loans'
        ]
    },
    {
        id: 'share_capital',
        keywords: [
            "share capital / owner's equity",
            /\bcapital\b/i
        ],
        excludeIfMatch: ['expenditure']
    },
    {
        id: 'statutory_reserve',
        keywords: []
    },
    {
        id: 'retained_earnings',
        keywords: [
            'retained earnings',
            'current year profit/loss'
        ]
    },
    {
        id: 'shareholders_current_accounts',
        keywords: [
            'dividends / owner�s drawings',
            "owner's current account"
        ],
        negativeIfMatch: ['dividends']
    }
];

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
    companyTrn?: string;
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
    onUpdateSalesInvoices?: (invoices: Invoice[]) => void;
    onUpdatePurchaseInvoices?: (invoices: Invoice[]) => void;
    onProcess?: (mode?: 'invoices' | 'all') => Promise<void> | void; // To trigger overall processing in App.tsx
    progress?: number;
    progressMessage?: string;
    periodId: string;
    ctTypeId: number;
    customerId: string;
    conversionId: string | null;
    period?: { start: string; end: string } | null;
}

interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

const ResultsStatCard = ({ label, value, secondaryValue, color = "text-foreground", secondaryColor = "text-muted-foreground", icon }: { label: string, value: React.ReactNode, secondaryValue?: string, color?: string, secondaryColor?: string, icon?: React.ReactNode }) => (
    <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-sm h-full transition-all hover:bg-accent/50 group">
        <div className="flex flex-col">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mb-1.5">{label}</p>
            <div className={`text-base font-black font-mono tracking-tight ${color}`}>{value}</div>
            {secondaryValue && <p className={`text-[10px] font-mono mt-1 ${secondaryColor} opacity-80`}>{secondaryValue}</p>}
        </div>
        {icon && (
            <div className="text-muted-foreground/30 bg-muted p-2 rounded-xl border border-border group-hover:scale-110 group-hover:text-primary transition-all duration-300">
                {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
            </div>
        )}
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

const roundAmount = (amount: number) => Math.round(Number(amount) || 0);
const normalizePaymentStatus = (status?: string) => String(status || '').trim().toLowerCase();
const isUnpaidInvoice = (invoice: Invoice) =>
    normalizePaymentStatus(invoice.paymentStatus || invoice.status) === 'unpaid';
const getInvoiceTotalAmount = (invoice: Invoice) => {
    const fallbackTotal = (Number(invoice.totalBeforeTaxAED ?? invoice.totalBeforeTax) || 0)
        + (Number(invoice.totalTaxAED ?? invoice.totalTax) || 0);
    const resolvedTotal = Number(invoice.totalAmountAED ?? invoice.totalAmount ?? fallbackTotal) || 0;
    return roundAmount(resolvedTotal);
};
const updateTrialBalanceAccount = (
    rows: TrialBalanceEntry[] | null,
    accountName: string,
    updates: { debit?: number; credit?: number },
    options: { addIfMissing?: boolean } = {}
): TrialBalanceEntry[] | null => {
    if (!rows && !options.addIfMissing) return rows;

    const dataRows = (rows || [])
        .filter(entry => normalizeAccountName(entry.account) !== 'totals')
        .map(entry => ({ ...entry }));

    const normalizedTarget = normalizeAccountName(accountName);
    const nextDebit = updates.debit !== undefined ? roundAmount(updates.debit) : undefined;
    const nextCredit = updates.credit !== undefined ? roundAmount(updates.credit) : undefined;

    let changed = false;
    const targetIndex = dataRows.findIndex(entry => normalizeAccountName(entry.account) === normalizedTarget);

    if (targetIndex >= 0) {
        const existing = dataRows[targetIndex];
        const updatedEntry = { ...existing };
        if (nextDebit !== undefined && roundAmount(existing.debit) !== nextDebit) {
            updatedEntry.debit = nextDebit;
            changed = true;
        }
        if (nextCredit !== undefined && roundAmount(existing.credit) !== nextCredit) {
            updatedEntry.credit = nextCredit;
            changed = true;
        }
        if (changed) dataRows[targetIndex] = updatedEntry;
    } else if (options.addIfMissing && ((nextDebit || 0) !== 0 || (nextCredit || 0) !== 0)) {
        dataRows.push({
            account: accountName,
            debit: nextDebit || 0,
            credit: nextCredit || 0,
        });
        changed = true;
    }

    const totalDebit = roundAmount(dataRows.reduce((sum, entry) => sum + (Number(entry.debit) || 0), 0));
    const totalCredit = roundAmount(dataRows.reduce((sum, entry) => sum + (Number(entry.credit) || 0), 0));
    const previousTotals = (rows || []).find(entry => normalizeAccountName(entry.account) === 'totals');
    const hasTotalsRowInSource = (rows || []).some(entry => normalizeAccountName(entry.account) === 'totals');
    const shouldKeepTotalsRow = hasTotalsRowInSource || dataRows.length > 0;
    const totalsChanged = shouldKeepTotalsRow
        ? (!previousTotals
            || roundAmount(previousTotals.debit) !== totalDebit
            || roundAmount(previousTotals.credit) !== totalCredit)
        : false;

    if (!changed && !totalsChanged) return rows;

    const nextRows = [...dataRows];
    if (shouldKeepTotalsRow) {
        nextRows.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });
    }
    return nextRows;
};
const formatWholeNumber = (amount: number) => {
    const rounded = roundAmount(amount);
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(rounded);
};

const formatNumberInput = (amount?: number) => {
    if (amount === undefined || amount === null) return '';
    if (Math.abs(amount) < 0.005) return '';
    return (Math.round((amount + Number.EPSILON) * 100) / 100).toFixed(2);
};

const getRowBalance = (t: Transaction) => {
    const credit = t.originalCredit !== undefined ? t.originalCredit : t.credit;
    const debit = t.originalDebit !== undefined ? t.originalDebit : t.debit;
    return (credit || 0) - (debit || 0);
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

// Local getChildCategory removed - now importing from CategoryDropdown.tsx

const normalizeCategoryName = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '');

const getChildByValue = (items: string[], normalizedValue: string): string => {
    const match = items.find(item => normalizeCategoryName(item) === normalizedValue);
    return match || items[0] || normalizedValue;
};

const resolveCategoryPath = (category: string | undefined): string => {
    if (!category) return '';

    const normalizedInput = normalizeCategoryName(category);
    if (!normalizedInput || normalizedInput === 'uncategorized') return '';

    if (category.includes('|')) {
        const parts = category.split('|').map(p => normalizeCategoryName(p));
        const leaf = parts[parts.length - 1];

        for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
            if (Array.isArray(sub)) {
                if (sub.some(item => normalizeCategoryName(item) === leaf)) {
                    return `${main} | ${getChildByValue(sub, leaf)}`;
                }
            } else if (typeof sub === 'object') {
                for (const [subGroup, items] of Object.entries(sub)) {
                    if ((items as string[]).some(item => normalizeCategoryName(item) === leaf)) {
                        return `${main} | ${subGroup} | ${getChildByValue(items as string[], leaf)}`;
                    }
                }
            }
        }
    }

    for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
        if (Array.isArray(sub)) {
            const found = sub.find(item => normalizeCategoryName(item) === normalizedInput);
            if (found) return `${main} | ${found}`;
        } else if (typeof sub === 'object') {
            for (const [subGroup, items] of Object.entries(sub)) {
                const found = (items as string[]).find(item => normalizeCategoryName(item) === normalizedInput);
                if (found) return `${main} | ${subGroup} | ${found}`;
            }
        }
    }

    for (const [main, sub] of Object.entries(CHART_OF_ACCOUNTS)) {
        if (Array.isArray(sub)) {
            const found = sub.find(item => normalizeCategoryName(item).includes(normalizedInput) || normalizedInput.includes(normalizeCategoryName(item)));
            if (found) return `${main} | ${found}`;
        } else if (typeof sub === 'object') {
            for (const [subGroup, items] of Object.entries(sub)) {
                const found = (items as string[]).find(item => normalizeCategoryName(item).includes(normalizedInput) || normalizedInput.includes(normalizeCategoryName(item)));
                if (found) return `${main} | ${subGroup} | ${found}`;
            }
        }
    }

    return category.trim();
};

const applySheetStyling = (worksheet: any, headerRows: number, totalRows: number = 0, customNumberFormat: string = '#,##0.00;[Red]-#,##0.00') => {
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


// Step titles for the Stepper component
const getStepperSteps = () => [
    "Review Categories",
    "Summarization",
    "Upload Invoices",
    "Invoice Summarization",
    "Bank Reconciliation",
    "VAT Docs Upload",
    "VAT Summarization",
    "Opening Balances",
    "Adjust Trial Balance",
    "Profit & Loss",
    "Balance Sheet",
    "Tax Computation",
    "LOU",
    "Signed FS and LOU Upload",
    "CT Questionnaire",
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
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-primary border-primary' :
                                isActive ? 'border-primary bg-background' : 'border-muted bg-muted/20'
                                }`}>
                                {isCompleted ? <CheckIcon className="w-6 h-6 text-primary-foreground" /> : <span className={`font-bold text-lg ${isActive ? 'text-foreground' : 'text-muted-foreground/40'}`}>{stepNumber}</span>}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground/40'
                                }`}>{step}</p>
                        </div>
                        {index < steps.length - 1 && (
                            <div className="flex-1 h-0.5 bg-muted relative min-w-[20px]">
                                <div className={`absolute top-0 left-0 h-full bg-primary transition-all duration-500`} style={{ width: isCompleted ? '100%' : '0%' }}></div>
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
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
        companyTrn,
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
        onUpdateSalesInvoices,
        onUpdatePurchaseInvoices,
        onProcess,
        progress = 0,
        progressMessage = 'Processing...',
        periodId,
        ctTypeId,
        customerId,
        conversionId,
        period
    } = props;

    const [currentStep, setCurrentStep] = useState(1);
    const isHydrated = useRef(false);
    const { workflowData, loading: workflowLoading, saveStep, refresh } = useCtWorkflow({ conversionId });
    const [editedTransactions, setEditedTransactions] = useState<Transaction[]>([]);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [openingBalancesData, setOpeningBalancesData] = useState<TrialBalanceEntry[]>([]);
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [louFiles, setLouFiles] = useState<File[]>([]);
    const [signedFsLouFiles, setSignedFsLouFiles] = useState<File[]>([]);
    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
    const [isProcessingInvoices, setIsProcessingInvoices] = useState(false);
    const [hasProcessedInvoices, setHasProcessedInvoices] = useState(false);
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
    const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
    const [pendingCategoryContext, setPendingCategoryContext] = useState<{ type: 'row' | 'bulk' | 'replace' | 'filter'; rowIndex?: number; } | null>(null);
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openObSection, setOpenObSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [showVatFlowModal, setShowVatFlowModal] = useState(false);
    const [vatFlowQuestion, setVatFlowQuestion] = useState<1 | 2>(1);
    const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownEntry[]>>({});
    const [reconFilter, setReconFilter] = useState<'ALL' | 'Matched' | 'Unmatched'>('ALL');
    const [statementPreviewUrls, setStatementPreviewUrls] = useState<string[]>([]);
    const [invoicePreviewUrls, setInvoicePreviewUrls] = useState<string[]>([]);
    const [persistedSummary, setPersistedSummary] = useState<BankStatementSummary | null>(null);
    const [manualBalances, setManualBalances] = useState<Record<string, { opening?: number, closing?: number }>>({});
    const [sortColumn, setSortColumn] = useState<'date' | null>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [conversionRates, setConversionRates] = useState<Record<string, string>>({});
    const [manualInvoiceMatches, setManualInvoiceMatches] = useState<Record<string, string>>({});
    const [showSbrModal, setShowSbrModal] = useState(false);

    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [pnlValues, setPnlValues] = useState<Record<string, number>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, number>>({});
    const [reportForm, setReportForm] = useState<any>({});

    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [newStatementFiles, setNewStatementFiles] = useState<File[]>([]);
    const [isAddingStatements, setIsAddingStatements] = useState(false);

    // LOU Content State
    const [louData, setLouData] = useState({
        date: new Date().toISOString().split('T')[0],
        to: 'The VAT Consultant LLC',
        subject: 'Management Representation regarding Corporate Tax Computation and Filing',
        taxablePerson: reportForm.taxableNameEn || companyName || '',
        taxPeriod: `FOR THE PERIOD FROM ${period?.start || reportForm.periodFrom || '-'} TO ${period?.end || reportForm.periodTo || '-'}`,
        trn: company?.corporateTaxTrn || company?.trn || '',
        content: `We, the Management of ${reportForm.taxableNameEn || companyName || '[Company Name]'}, confirm that the bank statements, sales/purchase invoices, and VAT records provided for this Corporate Tax filing are true, complete, and accurate. We acknowledge that these documents serve as the primary evidence for all reported transactions. We understand that The VAT Consultant LLC has relied on this data to prepare the computation without conducting an audit of the underlying transactions. We accept full responsibility for any discrepancies or omissions and remain solely liable for providing supporting evidence or justifications should the Federal Tax Authority (FTA) initiate an audit or inquiry.`,
        signatoryName: '',
        designation: ''
    });
    const [isDownloadingLouPdf, setIsDownloadingLouPdf] = useState(false);

    const [pnlStructure, setPnlStructure] = useState<typeof PNL_ITEMS>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<typeof BS_ITEMS>(() => {
        const structure = [...BS_ITEMS];
        const insertIndex = structure.findIndex(item => item.id === 'property_plant_equipment');
        if (insertIndex > -1 && !structure.some(item => item.id === 'intangible_assets')) {
            structure.splice(insertIndex + 1, 0, {
                id: 'intangible_assets',
                label: 'Intangible assets',
                type: 'item',
                isEditable: true
            });
        }
        return structure;
    });
    const pnlWorkingNotesInitializedRef = useRef(false);
    const bsWorkingNotesInitializedRef = useRef(false);

    const [showUncategorizedAlert, setShowUncategorizedAlert] = useState(false);
    const [uncategorizedCount, setUncategorizedCount] = useState(0);

    const pnlManualEditsRef = useRef<Set<string>>(new Set());
    const bsManualEditsRef = useRef<Set<string>>(new Set());
    const reportManualEditsRef = useRef<Set<string>>(new Set());
    const obFileInputRef = useRef<HTMLInputElement>(null);
    const obExcelInputRef = useRef<HTMLInputElement>(null);
    const importStep1InputRef = useRef<HTMLInputElement>(null);
    const importStep4InputRef = useRef<HTMLInputElement>(null);
    const importStep7InputRef = useRef<HTMLInputElement>(null);
    const tbFileInputRef = useRef<HTMLInputElement>(null);

    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [workingNoteModalOpen, setWorkingNoteModalOpen] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);
    const [tempBreakdown, setTempBreakdown] = useState<BreakdownEntry[]>([]);

    const uniqueFiles = useMemo(() => Array.from(new Set(editedTransactions.map(t => t.sourceFile).filter(Boolean))), [editedTransactions]);

    const statementReconciliationData = useMemo(() => {
        const isAllFiles = summaryFileFilter === 'ALL';
        const filesToReconcile = isAllFiles ? uniqueFiles : uniqueFiles.filter(f => f === summaryFileFilter);

        return filesToReconcile.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const persistedFileRec = persistedSummary?.fileBalances?.find(fb => fb.fileName === fileName);
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);

            const originalCurrency = fileTransactions.find(t => t.originalCurrency)?.originalCurrency
                || fileTransactions.find(t => t.currency)?.currency
                || 'AED';

            const totalDebitOriginal = fileTransactions.reduce((sum, t) => sum + ((t.originalDebit !== undefined) ? t.originalDebit : (t.debit || 0)), 0);
            const totalCreditOriginal = fileTransactions.reduce((sum, t) => sum + ((t.originalCredit !== undefined) ? t.originalCredit : (t.credit || 0)), 0);
            const totalDebitAed = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCreditAed = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);

            // Use manual override if available, otherwise fallback to statement summary or persisted summary
            const openingBalanceOriginal = manualBalances[fileName]?.opening ?? (stmtSummary?.originalOpeningBalance !== undefined
                ? stmtSummary.originalOpeningBalance
                : (stmtSummary?.openingBalance !== undefined ? stmtSummary.openingBalance : (persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0)));
            const closingBalanceOriginal = manualBalances[fileName]?.closing ?? (stmtSummary?.originalClosingBalance !== undefined
                ? stmtSummary.originalClosingBalance
                : (stmtSummary?.closingBalance !== undefined ? stmtSummary.closingBalance : (persistedFileRec?.originalClosingBalance ?? persistedFileRec?.closingBalance ?? 0)));

            const rate = parseFloat(conversionRates[fileName] || '');
            const hasManualRate = !isNaN(rate) && rate > 0;

            const openingBalanceAed = manualBalances[fileName]?.opening !== undefined
                ? (hasManualRate ? manualBalances[fileName].opening * rate : manualBalances[fileName].opening)
                : (hasManualRate ? ((stmtSummary?.originalOpeningBalance ?? stmtSummary?.openingBalance ?? persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0) * rate) : (stmtSummary?.openingBalance || persistedFileRec?.openingBalance || openingBalanceOriginal));

            const closingBalanceAed = manualBalances[fileName]?.closing !== undefined
                ? (hasManualRate ? manualBalances[fileName].closing * rate : manualBalances[fileName].closing)
                : (hasManualRate ? ((stmtSummary?.originalClosingBalance ?? stmtSummary?.originalClosingBalance ?? persistedFileRec?.originalClosingBalance ?? persistedFileRec?.originalClosingBalance ?? 0) * rate) : (stmtSummary?.closingBalance || persistedFileRec?.closingBalance || closingBalanceOriginal));

            const calculatedClosingOriginal = openingBalanceOriginal - totalDebitOriginal + totalCreditOriginal;
            const calculatedClosingAed = openingBalanceAed - totalDebitAed + totalCreditAed;

            const diffOriginal = Math.abs(calculatedClosingOriginal - closingBalanceOriginal);
            const diffAed = Math.abs(calculatedClosingAed - closingBalanceAed);

            // Porting normalization logic from Type 1 to ensure consistent behavior
            // If there's a significant mismatch, we prioritize the calculated balance to avoid breaking totals
            const hasOrig = (originalCurrency !== 'AED') || hasManualRate;
            const mismatch = hasOrig ? diffOriginal >= 0.1 : diffAed >= 0.1;

            const normalizedClosingAed = mismatch ? calculatedClosingAed : closingBalanceAed;
            const normalizedClosingOrig = mismatch ? calculatedClosingOriginal : closingBalanceOriginal;
            const normalizedDiffAed = mismatch ? 0 : diffAed;
            const normalizedDiffOrig = mismatch ? 0 : diffOriginal;

            const isBalanced = mismatch ? false : true;

            return {
                fileName,
                openingBalance: openingBalanceOriginal,
                totalDebit: totalDebitOriginal,
                totalCredit: totalCreditOriginal,
                calculatedClosing: calculatedClosingOriginal,
                closingBalance: closingBalanceOriginal, // use actual not normalized
                openingBalanceAed,
                totalDebitAed,
                totalCreditAed,
                calculatedClosingAed,
                closingBalanceAed: closingBalanceAed, // use actual not normalized
                isValid: isBalanced,
                diff: hasOrig ? diffOriginal : diffAed,
                diffAed: diffAed,
                currency: originalCurrency,
                hasConversion: hasOrig
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions, summaryFileFilter, manualBalances, conversionRates, persistedSummary]);

    const allStatementReconciliationData = useMemo(() => {
        return uniqueFiles.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const persistedFileRec = persistedSummary?.fileBalances?.find(fb => fb.fileName === fileName);
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);

            const originalCurrency = fileTransactions.find(t => t.originalCurrency)?.originalCurrency
                || fileTransactions.find(t => t.currency)?.currency
                || 'AED';

            const totalDebitOriginal = fileTransactions.reduce((sum, t) => sum + ((t.originalDebit !== undefined) ? t.originalDebit : (t.debit || 0)), 0);
            const totalCreditOriginal = fileTransactions.reduce((sum, t) => sum + ((t.originalCredit !== undefined) ? t.originalCredit : (t.credit || 0)), 0);
            const totalDebitAed = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCreditAed = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);

            const openingBalanceOriginal = manualBalances[fileName]?.opening ?? (stmtSummary?.originalOpeningBalance !== undefined
                ? stmtSummary.originalOpeningBalance
                : (stmtSummary?.openingBalance !== undefined ? stmtSummary.openingBalance : (persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0)));
            const closingBalanceOriginal = manualBalances[fileName]?.closing ?? (stmtSummary?.originalClosingBalance !== undefined
                ? stmtSummary.originalClosingBalance
                : (stmtSummary?.closingBalance !== undefined ? stmtSummary.closingBalance : (persistedFileRec?.originalClosingBalance ?? persistedFileRec?.closingBalance ?? 0)));

            const rate = parseFloat(conversionRates[fileName] || '');
            const hasManualRate = !isNaN(rate) && rate > 0;

            const openingBalanceAed = manualBalances[fileName]?.opening !== undefined
                ? (hasManualRate ? manualBalances[fileName].opening * rate : manualBalances[fileName].opening)
                : (hasManualRate ? ((stmtSummary?.originalOpeningBalance ?? stmtSummary?.openingBalance ?? persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0) * rate) : (stmtSummary?.openingBalance || persistedFileRec?.openingBalance || openingBalanceOriginal));

            const closingBalanceAed = manualBalances[fileName]?.closing !== undefined
                ? (hasManualRate ? manualBalances[fileName].closing * rate : manualBalances[fileName].closing)
                : (hasManualRate ? ((stmtSummary?.originalClosingBalance ?? stmtSummary?.originalClosingBalance ?? persistedFileRec?.originalOpeningBalance ?? persistedFileRec?.openingBalance ?? 0) * rate) : (stmtSummary?.closingBalance || persistedFileRec?.closingBalance || closingBalanceOriginal));

            const calculatedClosingOriginal = openingBalanceOriginal - totalDebitOriginal + totalCreditOriginal;
            const calculatedClosingAed = openingBalanceAed - totalDebitAed + totalCreditAed;

            const diffOriginal = Math.abs(calculatedClosingOriginal - closingBalanceOriginal);
            const diffAed = Math.abs(calculatedClosingAed - closingBalanceAed);
            const hasOrig = (originalCurrency !== 'AED') || hasManualRate;
            const mismatch = hasOrig ? diffOriginal >= 0.1 : diffAed >= 0.1;
            const isBalanced = mismatch ? false : true;

            return {
                fileName,
                openingBalance: openingBalanceOriginal,
                totalDebit: totalDebitOriginal,
                totalCredit: totalCreditOriginal,
                calculatedClosing: calculatedClosingOriginal,
                closingBalance: closingBalanceOriginal,
                openingBalanceAed,
                totalDebitAed,
                totalCreditAed,
                calculatedClosingAed,
                closingBalanceAed,
                isValid: isBalanced,
                diff: hasOrig ? diffOriginal : diffAed,
                diffAed,
                currency: originalCurrency,
                hasConversion: hasOrig
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions, manualBalances, conversionRates, persistedSummary]);


    // Keep a local summary copy for first-time step save before workflow hydration runs.
    useEffect(() => {
        if (!persistedSummary && summary) {
            setPersistedSummary(summary);
        }
    }, [summary, persistedSummary]);

    const activeSummary = useMemo(() => {
        const currentKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        const recon = statementReconciliationData.find(r => r.fileName === currentKey);

        if (recon) {
            const base = fileSummaries?.[currentKey];
            return {
                ...base,
                openingBalance: recon.openingBalanceAed,
                closingBalance: recon.calculatedClosingAed, // Take from Calculated Closing
                originalOpeningBalance: recon.openingBalance,
                originalClosingBalance: recon.calculatedClosing // Take from Calculated Closing
            };
        }
        return summary;
    }, [selectedFileFilter, fileSummaries, summary, uniqueFiles, statementReconciliationData]);

    const allFilesBalancesAed = useMemo(() => {
        if (!uniqueFiles.length) {
            return {
                opening: summary?.openingBalance || 0,
                closing: summary?.closingBalance || 0
            };
        }

        // Summing up AED values from all reconciled files
        return statementReconciliationData.reduce(
            (totals, recon) => {
                totals.opening += recon.openingBalanceAed || 0;
                totals.closing += recon.calculatedClosingAed || 0; // Take from Calculated Closing
                return totals;
            },
            { opening: 0, closing: 0 }
        );
    }, [uniqueFiles, summary, statementReconciliationData]);

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
        const otherExpenses = Math.abs(getSum(['Office Supplies & Stationery', 'Repairs & Maintenance', 'Insurance Expense', 'Marketing & Advertising', 'Professional Fees (Legal, Audit, Consulting)', 'Professional Fees', 'Legal Fees', 'IT & Software Subscriptions', 'Fuel Expenses', 'Transportation & Logistics', 'Bank Charges', 'Bank Charges & Interest Expense', 'VAT Expense (non-recoverable)', 'Corporate Tax Expense', 'Government Fees & Licenses', 'Bad Debt Expense', 'Miscellaneous Expense', 'Utilities (Electricity, Water, Internet)']));

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

    // Standardized helper to save current step
    const handleSaveStep = useCallback(async (
        stepId: number,
        status: 'draft' | 'completed' | 'submitted' = 'completed',
        stepDataOverride?: Record<string, any>
    ) => {
        if (!customerId || !ctTypeId || !periodId) return;

        const stepNames: Record<number, string> = {
            1: 'categorization',
            2: 'summarization',
            3: 'invoice_upload',
            4: 'invoice_summarization',
            5: 'bank_reconciliation',
            6: 'vat_upload',
            7: 'vat_summarization',
            8: 'opening_balances',
            9: 'adjust_trial_balance',
            10: 'profit_loss',
            11: 'balance_sheet',
            12: 'tax_computation',
            13: 'lou_upload',
            14: 'signed_fs_lou_upload',
            15: 'questionnaire',
            16: 'final_report'
        };

        try {
            let stepData: any = {};
            const stepName = stepNames[stepId] || `step_${stepId}`;
            const stepKey = `type-2_step-${stepId}_${stepName}`;
            switch (stepId) {
                case 1:
                    {
                        const perFileBalances = allStatementReconciliationData.map(r => ({
                            fileName: r.fileName,
                            openingBalance: typeof r.openingBalanceAed === 'number' ? r.openingBalanceAed : 0,
                            closingBalance: typeof r.closingBalanceAed === 'number' ? r.closingBalanceAed : 0,
                            calculatedClosingBalance: typeof r.calculatedClosingAed === 'number' ? r.calculatedClosingAed : 0,
                            totalDebit: typeof r.totalDebitAed === 'number' ? r.totalDebitAed : 0,
                            totalCredit: typeof r.totalCreditAed === 'number' ? r.totalCreditAed : 0,
                            isBalanced: !!r.isValid,
                            status: r.isValid ? 'Balanced' : 'Mismatch',
                            currency: r.currency || 'AED',
                            originalOpeningBalance: typeof r.openingBalance === 'number' ? r.openingBalance : 0,
                            originalClosingBalance: typeof r.closingBalance === 'number' ? r.closingBalance : 0
                        }));
                        const allFilesEntry = {
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
                        const fileBalances = [...perFileBalances, allFilesEntry];

                        const baseSummary = summary || persistedSummary || {
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
                            openingBalance: allFilesBalancesAed.opening,
                            closingBalance: allFilesBalancesAed.closing,
                            fileBalances
                        };

                        stepData = { transactions: editedTransactions, summary: updatedSummary, manualBalances };
                    }
                    break;
                case 2:
                    stepData = { manualBalances, conversionRates };
                    break;
                case 3:
                    stepData = { hasProcessedInvoices: true };
                    break;
                case 4:
                    stepData = { salesInvoices, purchaseInvoices };
                    break;
                case 5:
                    stepData = { statementReconciliationData, manualInvoiceMatches };
                    break;
                case 6:
                    stepData = {
                        additionalFiles: additionalFiles.map(f => ({ name: f.name, size: f.size })),
                        additionalDetails
                    };
                    break;
                case 7:
                    stepData = { vatManualAdjustments };
                    break;
                case 8:
                    stepData = { openingBalances: openingBalancesData };
                    break;
                case 9:
                    stepData = { adjustedTrialBalance };
                    break;
                case 10:
                    stepData = { pnlValues, pnlWorkingNotes };
                    break;
                case 11:
                    stepData = { balanceSheetValues, bsWorkingNotes };
                    break;
                case 12:
                    stepData = { taxComputationValues: ftaFormValues }; // Tax Computation step
                    break;
                case 13:
                    stepData = { louData };
                    break;
                case 14:
                    stepData = { signedFsLouFiles: signedFsLouFiles.map(f => ({ name: f.name, size: f.size })) };
                    break;
                case 15:
                    stepData = { questionnaireAnswers };
                    break;
                case 16:
                    stepData = { reportForm };
                    break;
            }
            if (stepDataOverride) {
                stepData = { ...stepData, ...stepDataOverride };
            }
            await saveStep(stepKey, stepId, stepData, status);
        } catch (error) {
            console.error(`Failed to save step ${stepId}:`, error);
        }
    }, [
        customerId, ctTypeId, periodId, saveStep,
        editedTransactions, summary, persistedSummary, manualBalances, conversionRates,
        salesInvoices, purchaseInvoices, statementReconciliationData, allStatementReconciliationData, manualInvoiceMatches,
        additionalFiles, additionalDetails, vatManualAdjustments,
        openingBalancesData, adjustedTrialBalance,
        pnlValues, pnlWorkingNotes, balanceSheetValues, bsWorkingNotes, allFilesBalancesAed,
        louFiles, questionnaireAnswers, reportForm, ftaFormValues
    ]);

    // Hydrate state from workflow data
    useEffect(() => {
        if (workflowLoading || !workflowData || workflowData.length === 0) return;

        // Restore currentStep to the next available step - ONLY ONCE
        if (!isHydrated.current) {
            const sortedSteps = [...workflowData].sort((a, b) => b.step_number - a.step_number);
            const latestStep = sortedSteps[0];
            if (latestStep && latestStep.step_number >= 1) {
                setCurrentStep(latestStep.step_number === 16 ? 16 : latestStep.step_number + 1);
            }
            isHydrated.current = true;
        }

        for (const step of workflowData) {
            const sData = step.data;
            if (!sData) continue;
            const stepNum = step.step_number;
            const stepKey = step.step_key;

            // Handle both old and new keys for transition if needed, 
            // but primarily focus on step_number for reliability
            switch (stepNum) {
                case 1:
                    if (sData.transactions) {
                        setEditedTransactions(sData.transactions);
                        if (onUpdateTransactions) onUpdateTransactions(sData.transactions);
                    }
                    if (sData.summary) setPersistedSummary(sData.summary);
                    if (sData.manualBalances) setManualBalances(sData.manualBalances);
                    break;
                case 2:
                    if (sData.manualBalances) setManualBalances(sData.manualBalances);
                    if (sData.conversionRates) setConversionRates(sData.conversionRates);
                    break;
                case 3:
                    if (sData.hasProcessedInvoices) setHasProcessedInvoices(true);
                    break;
                case 4:
                    if (sData.salesInvoices) onUpdateSalesInvoices?.(sData.salesInvoices);
                    if (sData.purchaseInvoices) onUpdatePurchaseInvoices?.(sData.purchaseInvoices);
                    break;
                case 5:
                    if (sData.manualInvoiceMatches) setManualInvoiceMatches(sData.manualInvoiceMatches);
                    break;
                case 6:
                    if (sData.additionalFiles) {
                        setAdditionalFiles(sData.additionalFiles.map((f: any) => new File([], f.name, { type: 'application/octet-stream' })));
                    }
                    if (sData.additionalDetails && Object.keys(sData.additionalDetails).length > 0) {
                        setAdditionalDetails(sData.additionalDetails);
                    }
                    break;
                case 7:
                    if (sData.vatManualAdjustments) setVatManualAdjustments(sData.vatManualAdjustments);
                    break;
                case 8:
                    if (sData.openingBalances) setOpeningBalancesData(sData.openingBalances);
                    break;
                case 9:
                    if (sData.adjustedTrialBalance) setAdjustedTrialBalance(sData.adjustedTrialBalance);
                    break;
                case 10:
                    if (sData.pnlValues) setPnlValues(sData.pnlValues);
                    if (sData.pnlWorkingNotes) setPnlWorkingNotes(sData.pnlWorkingNotes);
                    break;
                case 11:
                    if (sData.balanceSheetValues) setBalanceSheetValues(sData.balanceSheetValues);
                    if (sData.bsWorkingNotes) setBsWorkingNotes(sData.bsWorkingNotes);
                    break;
                case 12: break; // Tax Computation
                case 13:
                    if (sData.louData) {
                        setLouData(sData.louData);
                    }
                    if (sData.louFiles) {
                        setLouFiles(sData.louFiles.map((f: any) => new File([], f.name, { type: 'application/octet-stream' })));
                    }
                    break;
                case 14:
                    if (sData.signedFsLouFiles) {
                        setSignedFsLouFiles(sData.signedFsLouFiles.map((f: any) => new File([], f.name, { type: 'application/octet-stream' })));
                    }
                    break;
                case 15:
                    if (sData.questionnaireAnswers) setQuestionnaireAnswers(sData.questionnaireAnswers);
                    break;
                case 16:
                    if (sData.reportForm) setReportForm(sData.reportForm);
                    break;
            }
        }
    }, [workflowLoading, workflowData]);

    const handleRateConversion = useCallback((fileName: string, rateValue: string) => {
        setConversionRates(prev => ({ ...prev, [fileName]: rateValue }));
        const rate = parseFloat(rateValue);
        if (isNaN(rate) || rate <= 0) return;

        setEditedTransactions(prev => {
            return prev.map(t => {
                if (t.sourceFile === fileName) {
                    const originalDebit = t.originalDebit !== undefined ? t.originalDebit : t.debit;
                    const originalCredit = t.originalCredit !== undefined ? t.originalCredit : t.credit;

                    return {
                        ...t,
                        originalDebit,
                        originalCredit,
                        debit: originalDebit * rate,
                        credit: originalCredit * rate
                    };
                }
                return t;
            });
        });
    }, []);

    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountChild, setNewGlobalAccountChild] = useState('');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');
    const [previewPage, setPreviewPage] = useState(0);
    const [showPreviewPanel, setShowPreviewPanel] = useState(false);

    const handleOpenWorkingNote = (accountLabel: string) => {
        setCurrentWorkingAccount(accountLabel);
        const existing = breakdowns[accountLabel] || [];
        setTempBreakdown(JSON.parse(JSON.stringify(existing.length ? existing : [])));
        setWorkingNoteModalOpen(true);
    };

    const handleSaveWorkingNote = () => {
        if (!currentWorkingAccount) return;
        const validEntries = tempBreakdown.filter(e => e.description.trim() !== '' || e.debit > 0 || e.credit > 0);
        setBreakdowns(prev => ({ ...prev, [currentWorkingAccount]: validEntries }));
        setWorkingNoteModalOpen(false);
    };

    useEffect(() => {
        if (Object.keys(breakdowns).length === 0) return;
        setAdjustedTrialBalance(prevData => {
            const currentData = prevData || [];
            const seenAccounts = new Set<string>();
            const updatedRows = currentData.map(item => {
                const accountKey = item.account;
                seenAccounts.add(accountKey.toLowerCase());
                seenAccounts.add(accountKey.trim().toLowerCase());
                const breakdownEntry = breakdowns[accountKey] || breakdowns[accountKey.trim()];
                if (breakdownEntry) {
                    const totalDebit = breakdownEntry.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const totalCredit = breakdownEntry.reduce((sum, e) => sum + (e.credit || 0), 0);
                    return { ...item, debit: totalDebit, credit: totalCredit };
                }
                return item;
            });
            Object.entries(breakdowns).forEach(([accountName, entries]: [string, BreakdownEntry[]]) => {
                if (!seenAccounts.has(accountName.toLowerCase()) && !seenAccounts.has(accountName.trim().toLowerCase())) {
                    const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);
                    if (totalDebit > 0 || totalCredit > 0) {
                        updatedRows.push({ account: accountName, debit: totalDebit, credit: totalCredit });
                    }
                }
            });
            const dataRows = updatedRows.filter(r => r.account.toLowerCase() !== 'totals');
            const newTotalDebit = dataRows.reduce((sum, r) => sum + (r.debit || 0), 0);
            const newTotalCredit = dataRows.reduce((sum, r) => sum + (r.credit || 0), 0);
            const totalsIndex = updatedRows.findIndex(r => r.account.toLowerCase() === 'totals');
            const totalsRow = { account: 'Totals', debit: newTotalDebit, credit: newTotalCredit };
            if (totalsIndex !== -1) updatedRows[totalsIndex] = totalsRow;
            else updatedRows.push(totalsRow);
            return updatedRows;
        });
    }, [breakdowns]);


    useEffect(() => {
        if (transactions && transactions.length > 0) {
            const normalized = transactions.map(t => {
                const resolved = resolveCategoryPath(t.category);
                const displayCurrency = t.originalCurrency || t.currency || 'AED';
                return { ...t, category: resolved, currency: displayCurrency };
            });
            setCustomCategories(prev => {
                const newCustoms = new Set(prev);
                let changed = false;
                normalized.forEach(t => {
                    if (t.category && !t.category.includes('|') && !newCustoms.has(t.category)) {
                        newCustoms.add(t.category);
                        changed = true;
                    }
                });
                return changed ? Array.from(newCustoms) : prev;
            });
            setEditedTransactions(normalized);
        }
    }, [transactions]);

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
    // Auto-advance step effect removed to fix back button navigation issues.
    // The user will manually click "Continue" or "Extract" to proceed.

    // Auto-save Step 14 when reached
    useEffect(() => {
        if (currentStep === 14) {
            handleSaveStep(14);
        }
    }, [currentStep, handleSaveStep]);

    const handleAddNewStatements = useCallback(async () => {
        if (!newStatementFiles.length) return;

        setIsAddingStatements(true);
        try {
            const existingMaxIndex = editedTransactions.reduce((max, t) => {
                const idx = typeof t.originalIndex === 'number' ? t.originalIndex : max;
                return idx > max ? idx : max;
            }, 0);

            let runningIndex = existingMaxIndex + 1;
            const appended: Transaction[] = [];
            const previewEntries: Record<string, string[]> = {};

            for (const file of newStatementFiles) {
                // For now, support PDF/images here. Excel can still be added via the main upload step.
                if (file.name.match(/\.xlsx?$/i)) {
                    console.warn(`[CtType2Results] Skipping Excel file ${file.name} in additional upload; please use the main upload step for Excel statements.`);
                    continue;
                }

                let result: { transactions: Transaction[]; summary?: BankStatementSummary | null; currency?: string } | null = null;

                if (file.type === 'application/pdf') {
                    const text = await extractTextFromPDF(file);
                    if (text && text.trim().length > 100) {
                        result = await extractTransactionsFromText(text);
                    } else {
                        const parts = await convertFileToParts(file);
                        result = await extractTransactionsFromImage(parts as any);
                    }
                } else {
                    const parts = await convertFileToParts(file);
                    result = await extractTransactionsFromImage(parts as any);
                }

                if (result && result.transactions && result.transactions.length) {
                    const tagged = result.transactions.map((t, idx) => ({
                        ...t,
                        sourceFile: file.name,
                        originalIndex: runningIndex + idx
                    }));
                    runningIndex += tagged.length;
                    appended.push(...tagged);

                    if (result.summary) {
                        setManualBalances(prev => ({
                            ...prev,
                            [file.name]: {
                                opening: result.summary?.openingBalance || 0,
                                closing: result.summary?.closingBalance || 0
                            }
                        }));
                    }

                    try {
                        const urls = await generateFilePreviews(file);
                        previewEntries[file.name] = urls;
                    } catch (e) {
                        console.error(`[CtType2Results] Failed to generate previews for additional file ${file.name}`, e);
                    }
                }
            }

            if (appended.length) {
                const merged = [...editedTransactions, ...appended];
                setEditedTransactions(merged);
                onUpdateTransactions(merged);

                if (Object.keys(previewEntries).length > 0) {
                    setStatementPreviewUrls(prev => {
                        const extra = Object.values(previewEntries).flat();
                        return [...prev, ...extra];
                    });
                }
            }

            setNewStatementFiles([]);
        } catch (error: any) {
            console.error('[CtType2Results] Failed to add additional bank statements:', error);
            alert(error?.message || 'Failed to add additional bank statements. Please try again.');
        } finally {
            setIsAddingStatements(false);
        }
    }, [editedTransactions, newStatementFiles, onUpdateTransactions]);

    // Handle initial reset state when appState is initial (e.g. fresh load or after a full reset)
    useEffect(() => {
        if (appState === 'initial' && currentStep !== 1) {
            setCurrentStep(1);
        }
    }, [appState, currentStep]);

    const calculatePnLTotals = useCallback((values: Record<string, number>) => {
        const revenue = values.revenue || 0;
        const costOfRevenue = values.cost_of_revenue || 0;
        const grossProfit = revenue - costOfRevenue;

        // Dynamic components for Profit / (Loss) for the year
        let profitLossYear = grossProfit;
        let totalComprehensive = 0;

        // Mapping sections for dynamic calculation
        // This relies on the structure but we can also use a simplified rule-based approach
        // Profit / Loss = (Income items) - (Expense items)

        pnlStructure.forEach(item => {
            if (item.type !== 'item') return;
            const val = values[item.id] || 0;

            // Income items to add
            if (['other_income', 'unrealised_gain_loss_fvtpl', 'share_profits_associates', 'gain_loss_revaluation_property'].includes(item.id)) {
                profitLossYear += val;
            }
            // Expense items to subtract
            else if (['impairment_losses_ppe', 'impairment_losses_intangible', 'business_promotion_selling', 'foreign_exchange_loss', 'selling_distribution_expenses', 'administrative_expenses', 'finance_costs', 'depreciation_ppe'].includes(item.id)) {
                profitLossYear -= val;
            }
            // If it's a new item added by user, we need to know if it's income or expense.
            // By default, if the section it was added to is income-related:
            // This is complex because we don't store the "nature" (Dr/Cr) in the structure.
            // However, we can look at where it was inserted.
        });

        // Current hardcoded logic for fallback/consistency
        const totalComprehensiveItems = [
            'gain_revaluation_property',
            'share_gain_loss_revaluation_associates',
            'changes_fair_value_available_sale',
            'changes_fair_value_available_sale_reclassified',
            'exchange_difference_translating'
        ];

        totalComprehensiveItems.forEach(id => {
            totalComprehensive += (values[id] || 0);
        });

        const totalComprehensiveIncome = profitLossYear + totalComprehensive;
        const profitAfterTax = profitLossYear - (values.provisions_corporate_tax || 0);

        return {
            gross_profit: grossProfit,
            profit_loss_year: profitLossYear,
            total_comprehensive_income: totalComprehensiveIncome,
            profit_after_tax: profitAfterTax
        };
    }, [pnlStructure]);

    const calculateBalanceSheetTotals = useCallback((values: Record<string, number>) => {
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
                    total += (values[item.id] || 0);
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
    }, [bsStructure]);



    const summaryData = useMemo(() => {
        const isAllFiles = summaryFileFilter === 'ALL';
        const txsToSummarize = isAllFiles
            ? editedTransactions
            : editedTransactions.filter(t => t.sourceFile === summaryFileFilter);

        const groups: Record<string, { debit: number, credit: number }> = {};

        txsToSummarize.forEach(t => {
            const rawCategory = t.category ? getChildCategory(t.category) : 'Uncategorized';
            const cat = rawCategory || 'Uncategorized';
            if (!groups[cat]) groups[cat] = { debit: 0, credit: 0 };

            const debit = (!isAllFiles && t.originalDebit !== undefined) ? t.originalDebit : (t.debit || 0);
            const credit = (!isAllFiles && t.originalCredit !== undefined) ? t.originalCredit : (t.credit || 0);

            groups[cat].debit += debit;
            groups[cat].credit += credit;
        });

        return Object.entries(groups)
            .map(([cat, vals]) => ({ category: cat, ...vals }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [editedTransactions, summaryFileFilter]);

    const invoiceTotals = useMemo(() => {
        const salesAmount = salesInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || inv.totalBeforeTax || 0), 0);
        const salesVat = salesInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || inv.totalTax || 0), 0);
        const purchaseAmount = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || inv.totalBeforeTax || 0), 0);
        const purchaseVat = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || inv.totalTax || 0), 0);

        return { salesAmount, salesVat, purchaseAmount, purchaseVat };
    }, [salesInvoices, purchaseInvoices]);

    const unpaidInvoiceTotals = useMemo(() => {
        const unpaidSalesTotal = salesInvoices.reduce((sum, inv) => {
            if (!isUnpaidInvoice(inv)) return sum;
            return sum + getInvoiceTotalAmount(inv);
        }, 0);

        const unpaidPurchaseTotal = purchaseInvoices.reduce((sum, inv) => {
            if (!isUnpaidInvoice(inv)) return sum;
            return sum + getInvoiceTotalAmount(inv);
        }, 0);

        return {
            sales: roundAmount(unpaidSalesTotal),
            purchase: roundAmount(unpaidPurchaseTotal),
        };
    }, [salesInvoices, purchaseInvoices]);

    useEffect(() => {
        setOpeningBalancesData(prev => {
            const withReceivable = updateTrialBalanceAccount(
                prev,
                'Accounts Receivable',
                { credit: unpaidInvoiceTotals.sales },
                { addIfMissing: true }
            ) || prev;

            return updateTrialBalanceAccount(
                withReceivable,
                'Accounts Payable',
                { debit: unpaidInvoiceTotals.purchase },
                { addIfMissing: true }
            ) || withReceivable;
        });
    }, [unpaidInvoiceTotals.sales, unpaidInvoiceTotals.purchase, openingBalancesData]);

    useEffect(() => {
        setAdjustedTrialBalance(prev => {
            if (!prev) return prev;
            return updateTrialBalanceAccount(
                prev,
                'Accounts Payable',
                { debit: unpaidInvoiceTotals.purchase },
                { addIfMissing: true }
            );
        });
    }, [unpaidInvoiceTotals.purchase, adjustedTrialBalance]);

    const vatStepData = useMemo(() => {
        const fileResults = Array.isArray(additionalDetails.vatFileResults)
            ? additionalDetails.vatFileResults
            : [];

        const normalizedFileResults = fileResults.map((res: any, index: number) =>
            normalizeVatFileResult(res, `VAT Return ${index + 1}`)
        );

        const periods = normalizedFileResults.map((res: any, index: number) => {
            const periodId = `${res.periodFrom || 'unknown'}_${res.periodTo || 'unknown'}_${index}`;
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

            sales.total = sales.zero + sales.tv + sales.vat;
            purchases.total = purchases.zero + purchases.tv + purchases.vat;

            return {
                id: periodId,
                fileName: res.fileName,
                periodFrom: res.periodFrom,
                periodTo: res.periodTo,
                sales,
                purchases,
                net: sales.vat - purchases.vat
            };
        });

        const grandTotals = periods.reduce((acc: any, p: any) => ({
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

    const vatCertificateTotals = useMemo(() => ({
        salesAmount: vatStepData.grandTotals.sales.tv,
        salesVat: vatStepData.grandTotals.sales.vat,
        purchaseAmount: vatStepData.grandTotals.purchases.tv,
        purchaseVat: vatStepData.grandTotals.purchases.vat
    }), [vatStepData]);

    const mappedPnLValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;
        const totals = mapTrialBalanceTotals(adjustedTrialBalance, PNL_MAPPING);
        const baseValues: Record<string, number> = {
            revenue: totals.revenue || 0,
            cost_of_revenue: totals.cost_of_revenue || 0,
            other_income: totals.other_income || 0,
            unrealised_gain_loss_fvtpl: totals.unrealised_gain_loss_fvtpl || 0,
            share_profits_associates: totals.share_profits_associates || 0,
            gain_loss_revaluation_property: totals.gain_loss_revaluation_property || 0,
            impairment_losses_ppe: totals.impairment_losses_ppe || 0,
            impairment_losses_intangible: totals.impairment_losses_intangible || 0,
            business_promotion_selling: totals.business_promotion_selling || 0,
            foreign_exchange_loss: totals.foreign_exchange_loss || 0,
            selling_distribution_expenses: totals.selling_distribution_expenses || 0,
            administrative_expenses: totals.administrative_expenses || 0,
            finance_costs: totals.finance_costs || 0,
            depreciation_ppe: totals.depreciation_ppe || 0,
            gain_revaluation_property: 0,
            share_gain_loss_revaluation_associates: 0,
            changes_fair_value_available_sale: 0,
            changes_fair_value_available_sale_reclassified: 0,
            exchange_difference_translating: 0,
            provisions_corporate_tax: ftaFormValues?.corporateTaxLiability || 0
        };
        return { ...baseValues, ...calculatePnLTotals(baseValues) };
    }, [adjustedTrialBalance, calculatePnLTotals, ftaFormValues]);

    const mappedBalanceSheetValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;
        const totals = mapTrialBalanceTotals(adjustedTrialBalance, BS_MAPPING);
        const baseValues: Record<string, number> = {
            property_plant_equipment: totals.property_plant_equipment || 0,
            intangible_assets: totals.intangible_assets || 0,
            cash_bank_balances: totals.cash_bank_balances || 0,
            inventories: totals.inventories || 0,
            trade_receivables: totals.trade_receivables || 0,
            advances_deposits_receivables: totals.advances_deposits_receivables || 0,
            related_party_transactions_assets: totals.related_party_transactions_assets || 0,
            share_capital: totals.share_capital || 0,
            statutory_reserve: totals.statutory_reserve || 0,
            retained_earnings: totals.retained_earnings || 0,
            shareholders_current_accounts: totals.shareholders_current_accounts || 0,
            employees_end_service_benefits: totals.employees_end_service_benefits || 0,
            bank_borrowings_non_current: totals.bank_borrowings_non_current || 0,
            short_term_borrowings: totals.short_term_borrowings || 0,
            related_party_transactions_liabilities: totals.related_party_transactions_liabilities || 0,
            trade_other_payables: totals.trade_other_payables || 0
        };
        return { ...baseValues, ...calculateBalanceSheetTotals(baseValues) };
    }, [adjustedTrialBalance, calculateBalanceSheetTotals]);


    // Initialize reportForm when ftaFormValues change
    useEffect(() => {
        if (ftaFormValues) {
            setReportForm((prev: any) => ({
                ...prev,
                // Section 1
                referenceNumber: prev.referenceNumber || '230008048117',
                dueDate: prev.dueDate || company?.ctDueDate || '30/09/2025',
                periodDescription: prev.periodDescription || (period?.start && period?.end ? `Tax Year End ${period.end.split('/').pop()}` : `Tax Year End ${company?.ctPeriodEnd?.split('/').pop() || '2024'}`),
                versionDescription: prev.versionDescription || 'Amendment/Voluntary Disclosure',
                periodFrom: prev.periodFrom || period?.start || company?.ctPeriodStart || '01/01/2024',
                periodTo: prev.periodTo || period?.end || company?.ctPeriodEnd || '31/12/2024',
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
                operatingRevenue: mappedPnLValues?.revenue ?? ftaFormValues.operatingRevenue,
                derivingRevenueExpenses: mappedPnLValues?.cost_of_revenue ?? ftaFormValues.derivingRevenueExpenses,
                grossProfit: mappedPnLValues?.gross_profit ?? ftaFormValues.grossProfit,
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
                netProfit: mappedPnLValues?.profit_loss_year ?? ftaFormValues.netProfit,
                // Section 5 (OCI - Image 2)
                ociIncomeNoRec: ftaFormValues.ociIncomeNoRec || 0,
                ociLossNoRec: ftaFormValues.ociLossNoRec || 0,
                ociIncomeRec: ftaFormValues.ociIncomeRec || 0,
                ociLossRec: ftaFormValues.ociLossRec || 0,
                ociOtherIncome: ftaFormValues.ociOtherIncome || 0,
                ociOtherLoss: ftaFormValues.ociOtherLoss || 0,
                totalComprehensiveIncome: mappedPnLValues?.total_comprehensive_income ?? ftaFormValues.totalComprehensiveIncome,
                // Section 6 (SFP - Updated based on images)
                totalCurrentAssets: mappedBalanceSheetValues?.total_current_assets ?? ftaFormValues.totalCurrentAssets,
                ppe: mappedBalanceSheetValues?.property_plant_equipment ?? ftaFormValues.ppe,
                intangibleAssets: mappedBalanceSheetValues?.intangible_assets ?? ftaFormValues.intangibleAssets,
                financialAssets: ftaFormValues.financialAssets,
                otherNonCurrentAssets: ftaFormValues.otherNonCurrentAssets,
                totalNonCurrentAssets: mappedBalanceSheetValues?.total_non_current_assets ?? ftaFormValues.totalNonCurrentAssets,
                totalAssets: mappedBalanceSheetValues?.total_assets ?? ftaFormValues.totalAssets,
                totalCurrentLiabilities: mappedBalanceSheetValues?.total_current_liabilities ?? ftaFormValues.totalCurrentLiabilities,
                totalNonCurrentLiabilities: mappedBalanceSheetValues?.total_non_current_liabilities ?? ftaFormValues.totalNonCurrentLiabilities,
                totalLiabilities: mappedBalanceSheetValues?.total_liabilities ?? ftaFormValues.totalLiabilities,
                shareCapital: mappedBalanceSheetValues?.share_capital ?? ftaFormValues.shareCapital,
                retainedEarnings: mappedBalanceSheetValues?.retained_earnings ?? ftaFormValues.retainedEarnings,
                otherEquity: mappedBalanceSheetValues?.shareholders_current_accounts ?? ftaFormValues.otherEquity,
                totalEquity: mappedBalanceSheetValues?.total_equity ?? ftaFormValues.totalEquity,
                totalEquityLiabilities: mappedBalanceSheetValues?.total_equity_liabilities ?? ftaFormValues.totalEquityLiabilities,
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
    }, [ftaFormValues, company, companyName, mappedPnLValues, mappedBalanceSheetValues]);

    useEffect(() => {
        if (!mappedPnLValues) return;
        setPnlValues(prev => {
            const updated = { ...prev };
            Object.entries(mappedPnLValues).forEach(([id, value]) => {
                if (!pnlManualEditsRef.current.has(id)) {
                    updated[id] = value;
                }
            });
            const totals = calculatePnLTotals(updated);
            Object.entries(totals).forEach(([totalId, totalValue]) => {
                if (!pnlManualEditsRef.current.has(totalId)) {
                    updated[totalId] = totalValue;
                }
            });
            return updated;
        });
    }, [mappedPnLValues, calculatePnLTotals]);

    useEffect(() => {
        if (!mappedBalanceSheetValues) return;
        setBalanceSheetValues(prev => {
            const updated = { ...prev };
            Object.entries(mappedBalanceSheetValues).forEach(([id, value]) => {
                if (!bsManualEditsRef.current.has(id)) {
                    updated[id] = value;
                }
            });
            const totals = calculateBalanceSheetTotals(updated);
            Object.entries(totals).forEach(([totalId, totalValue]) => {
                if (!bsManualEditsRef.current.has(totalId)) {
                    updated[totalId] = totalValue;
                }
            });
            return updated;
        });
    }, [mappedBalanceSheetValues, calculateBalanceSheetTotals]);

    useEffect(() => {
        if (!adjustedTrialBalance) return;

        if (!pnlWorkingNotesInitializedRef.current) {
            const autoNotes = buildWorkingNotesFromTrialBalance(adjustedTrialBalance, PNL_MAPPING);
            setPnlWorkingNotes(prev => {
                const merged = { ...prev };
                let changed = false;
                Object.entries(autoNotes).forEach(([id, notes]) => {
                    if ((!merged[id] || merged[id].length === 0) && notes.length > 0) {
                        merged[id] = notes;
                        changed = true;
                    }
                });
                return changed ? merged : prev;
            });
            pnlWorkingNotesInitializedRef.current = true;
        }

        if (!bsWorkingNotesInitializedRef.current) {
            const autoNotes = buildWorkingNotesFromTrialBalance(adjustedTrialBalance, BS_MAPPING);
            setBsWorkingNotes(prev => {
                const merged = { ...prev };
                let changed = false;
                Object.entries(autoNotes).forEach(([id, notes]) => {
                    if ((!merged[id] || merged[id].length === 0) && notes.length > 0) {
                        merged[id] = notes;
                        changed = true;
                    }
                });
                return changed ? merged : prev;
            });
            bsWorkingNotesInitializedRef.current = true;
        }
    }, [adjustedTrialBalance]);

    const handleDownloadLouPDF = async () => {
        setIsDownloadingLouPdf(true);
        try {
            const blob = await ctFilingService.downloadLouPdf({
                ...louData,
                companyName: reportForm.taxableNameEn || companyName
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `LOU_${(reportForm.taxableNameEn || companyName || 'Company').replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Download LOU PDF error:', error);
            alert('Failed to generate LOU PDF: ' + error.message);
        } finally {
            setIsDownloadingLouPdf(false);
        }
    };

    const handleContinueToTaxComp = useCallback(async () => {
        await handleSaveStep(11);

        // SBR Modal Logic
        const revenue = ftaFormValues?.actualOperatingRevenue || 0;
        if (revenue < 3000000) {
            setShowSbrModal(true);
        } else {
            setCurrentStep(12);
        }
    }, [handleSaveStep, ftaFormValues]);

    const handleContinueToLOU = useCallback(async () => {
        await handleSaveStep(12);
        setCurrentStep(13);
    }, [handleSaveStep]);

    const handleContinueToSignedFsLouUpload = useCallback(async () => {
        await handleSaveStep(13);
        setCurrentStep(14);
    }, [handleSaveStep]);

    const handleContinueToQuestionnaire = useCallback(async () => {
        await handleSaveStep(14);
        setCurrentStep(15);
    }, [handleSaveStep]);

    const handleContinueToReport = useCallback(async () => {
        await handleSaveStep(15);
        setCurrentStep(16);
    }, [handleSaveStep]);

    const handleSkipQuestionnaire = useCallback(async () => {
        await handleSaveStep(15);
        setCurrentStep(16);
    }, [handleSaveStep]);

    // Sync Questionnaire Answers to reportForm
    useEffect(() => {
        if (Object.keys(questionnaireAnswers).length > 0) {
            setReportForm((prev: any) => ({
                ...prev,
                audited: questionnaireAnswers[10] || prev.audited,
                avgEmployees: questionnaireAnswers[11] ? parseFloat(questionnaireAnswers[11]) || prev.avgEmployees : prev.avgEmployees,
                // Add more mappings if needed based on CT_QUESTIONS
            }));
        }
    }, [questionnaireAnswers]);




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

        // Re-sort to original order for the default view, or keep date-sorted?
        // Usually, running balance ONLY makes sense when date-sorted.
        // We will keep them date-sorted per file.
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
            const isUncategorized = !t.category || t.category.toLowerCase().includes('uncategorized');
            const matchesCategory = filterCategory === 'ALL'
                || (filterCategory === 'UNCATEGORIZED' ? isUncategorized : resolveCategoryPath(t.category) === filterCategory);
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

    const handleCategorySelection = useCallback((value: string, context: { type: 'row' | 'bulk' | 'replace' | 'filter', rowIndex?: number }) => {
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
        setNewCategoryError(null);

        if (!newCategoryMain || !newCategorySub.trim()) {
            setNewCategoryError('Please select a main category and enter a sub-category name.');
            return;
        }

        const formattedName = `${newCategoryMain} | ${newCategorySub.trim()}`;
        const normalizedCustom = normalizeCategoryName(newCategorySub);
        if (customCategories.some(cat => normalizeCategoryName(getChildCategory(cat)) === normalizedCustom && cat.startsWith(`${newCategoryMain} |`))) {
            setNewCategoryError('This category already exists.');
            return;
        }

        const existingDefault = CHART_OF_ACCOUNTS[newCategoryMain as keyof typeof CHART_OF_ACCOUNTS];
        if (existingDefault) {
            if (Array.isArray(existingDefault)) {
                if (existingDefault.some(sub => normalizeCategoryName(sub) === normalizedCustom)) {
                    setNewCategoryError('This category already exists in standard accounts.');
                    return;
                }
            } else if (typeof existingDefault === 'object') {
                const allItems = Object.values(existingDefault).flatMap(items => items as string[]);
                if (allItems.some(sub => normalizeCategoryName(sub) === normalizedCustom)) {
                    setNewCategoryError('This category already exists in standard accounts.');
                    return;
                }
            }
        }

        setCustomCategories(prev => [...prev, formattedName]);
        if (pendingCategoryContext) {
            handleCategorySelection(formattedName, pendingCategoryContext);
        }
        setShowAddCategoryModal(false);
        setPendingCategoryContext(null);
    }, [newCategoryMain, newCategorySub, pendingCategoryContext, handleCategorySelection, customCategories]);

    // renderCategoryOptions removed - now using CategoryDropdown component logic

    const handleBack = useCallback(() => {
        if (currentStep === 14) {
            setCurrentStep(13);
        } else if (currentStep === 15) {
            setCurrentStep(14);
        } else {
            setCurrentStep(prev => Math.max(1, prev - 1));
        }
    }, [currentStep]);
    const handleConfirmCategories = useCallback(async () => {
        await handleSaveStep(1);
        onUpdateTransactions(editedTransactions);
        setCurrentStep(2);
    }, [editedTransactions, onUpdateTransactions, handleSaveStep]);
    const handleConfirmSummarization = useCallback(async () => {
        await handleSaveStep(2);
        setCurrentStep(3);
    }, [handleSaveStep]);

    const handleAutoCategorize = useCallback(async () => {
        if (editedTransactions.length === 0) return;
        // Fix: Use the declared setIsAutoCategorizing
        setIsAutoCategorizing(true);
        try {
            const categorized = await categorizeTransactionsByCoA(editedTransactions);
            const normalized = (categorized as any[]).map(t => ({ ...t, category: resolveCategoryPath(t.category) }));

            setCustomCategories(prev => {
                const newCustoms = new Set(prev);
                let changed = false;
                normalized.forEach(t => {
                    if (t.category && !t.category.includes('|') && !newCustoms.has(t.category)) {
                        newCustoms.add(t.category);
                        changed = true;
                    }
                });
                return changed ? Array.from(newCustoms) : prev;
            });

            setEditedTransactions(normalized);
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

    const handleBulkDelete = useCallback(() => {
        if (selectedIndices.size === 0) return;
        const count = selectedIndices.size;
        if (!window.confirm(`Are you sure you want to delete ${count} selected transaction${count === 1 ? '' : 's'}?`)) {
            return;
        }
        setEditedTransactions(prev => prev.filter((_, idx) => !selectedIndices.has(idx)));
        setSelectedIndices(new Set());
    }, [selectedIndices]);

    const handleBulkSwap = useCallback(() => {
        if (selectedIndices.size === 0) return;
        setEditedTransactions(prev => prev.map((t, i) => {
            if (selectedIndices.has(i)) {
                return {
                    ...t,
                    debit: t.credit || 0,
                    credit: t.debit || 0,
                    originalDebit: t.originalCredit,
                    originalCredit: t.originalDebit
                };
            }
            return t;
        }));
        setSelectedIndices(new Set());
    }, [selectedIndices]);

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

        if (currentStep === 8) {
            setOpeningBalancesData(prev => {
                // Check if exists
                if (prev.some(entry => entry.account.toLowerCase() === newEntry.account.toLowerCase())) {
                    alert("Account already exists.");
                    return prev;
                }
                const newTb = [...prev];
                const totalsIdx = newTb.findIndex(i => i.account === 'Totals');
                if (totalsIdx !== -1) {
                    newTb.splice(totalsIdx, 0, newEntry);
                } else {
                    newTb.push(newEntry);
                }
                return newTb;
            });
        } else {
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
        }
        setShowGlobalAddAccountModal(false);
        setNewGlobalAccountName('');
        setNewGlobalAccountChild('');
    }, [adjustedTrialBalance, newGlobalAccountName]);

    const handleReconContinue = useCallback(async () => {
        await handleSaveStep(5);
        setVatFlowQuestion(1);
        setShowVatFlowModal(true);
    }, [handleSaveStep]);

    const handleVatFlowAnswer = useCallback((answer: boolean) => {
        // Direct flow: Yes -> Step 6 (VAT Docs), No -> Step 7 (VAT Summarization)
        setShowVatFlowModal(false);
        if (answer) {
            setCurrentStep(6);
        } else {
            setCurrentStep(7);
        }
    }, [setCurrentStep]);

    const handleVatAdjustmentChange = useCallback((periodId: string, field: string, value: string) => {
        setVatManualAdjustments(prev => {
            const currentUpdates: Record<string, string> = {
                ...(prev[periodId] || {}),
                [field]: value
            };

            // Keep VAT at 5% of standard-rated amount for quick edits
            if (field === 'salesTv') {
                const amount = parseFloat(value) || 0;
                currentUpdates.salesVat = (amount * 0.05).toFixed(2);
            } else if (field === 'purchasesTv') {
                const amount = parseFloat(value) || 0;
                currentUpdates.purchasesVat = (amount * 0.05).toFixed(2);
            }

            return {
                ...prev,
                [periodId]: currentUpdates
            };
        });
    }, []);

    const handleImportStep7VAT = useCallback(() => {
        importStep7InputRef.current?.click();
    }, []);

    const handleStep7FileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            // Expected format (based on handleExportStep7VAT / getVatExportRows):
            // Row 0: Headers
            // Row 1: Sub-headers
            // Row 2+: Data rows
            // Last rows: Grand totals etc.

            if (jsonData.length < 3) {
                alert("The uploaded file does not appear to have the correct format.");
                return;
            }

            const newAdjustments: Record<string, Record<string, string>> = { ...vatManualAdjustments };
            let updatedCount = 0;

            // Iterate through data rows (starting from index 2)
            // Stop if we hit "GRAND TOTAL"
            for (let i = 2; i < jsonData.length; i++) {
                const row = jsonData[i];
                if (!row || row.length === 0 || row[0] === 'GRAND TOTAL') break;

                const periodLabel = row[0];
                if (!periodLabel) continue;

                // Find the period matching this label in vatStepData.periods
                const period = vatStepData.periods.find((p: any) => getVatPeriodLabel(p.periodFrom, p.periodTo, p.fileName) === periodLabel);

                if (period) {
                    const adj: Record<string, string> = {};

                    // Column mapping based on getVatExportRows:
                    // 0: PERIOD, 1: Sales Zero, 2: Sales Standard, 3: Sales VAT, 4: Sales Total
                    // 5: PERIOD (Again), 6: Purchase Zero, 7: Purchase Standard, 8: Purchase VAT, 9: Purchase Total
                    // 10: NET

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
            console.error("Error importing Step 7 VAT:", error);
            alert("Failed to parse the Excel file. Please ensure it is a valid VAT Summarization export.");
        } finally {
            event.target.value = ''; // Reset input
        }
    }, [vatManualAdjustments, vatStepData.periods]);

    const handleExtractAdditionalData = useCallback(async () => {
        if (additionalFiles.length === 0) {
            const emptyVatDetails = { vatFileResults: [] };
            setAdditionalDetails(emptyVatDetails);
            await handleSaveStep(6, 'completed', { additionalDetails: emptyVatDetails });
            setCurrentStep(7);
            return;
        }
        setIsExtracting(true);
        try {
            // Deduplicate files by name and size to prevent duplicate summing
            const uniqueFiles = additionalFiles.filter((file, index, self) =>
                index === self.findIndex((f) => f.name === file.name && f.size === file.size)
            );

            const results = await Promise.all(uniqueFiles.map(async (file, index) => {
                const parts = await convertFileToParts(file);
                const details = await extractVat201Totals(parts as any) as any;
                const normalizedResult = normalizeVatFileResult({ ...details, fileName: file.name }, file.name || `VAT Return ${index + 1}`);

                if (!details || (normalizedResult.sales.total === 0 && normalizedResult.purchases.total === 0 && normalizedResult.netVatPayable === 0)) {
                    console.warn(`Extraction returned empty/null for ${file.name}`);
                }

                return normalizedResult;
            }));

            const anyData = results.some(r => r.sales.total > 0 || r.purchases.total > 0 || r.netVatPayable !== 0);
            if (!anyData) {
                alert("We couldn't extract any significant VAT data from the uploaded files. Please ensure they are valid VAT 201 returns and try again.");
                setIsExtracting(false);
                return;
            }

            const extractedVatDetails = { vatFileResults: results };
            setAdditionalDetails(extractedVatDetails);
            await handleSaveStep(6, 'completed', { additionalDetails: extractedVatDetails });
            setCurrentStep(7); // Auto-advance to VAT Summarization
        } catch (e) {
            console.error("Failed to extract per-file VAT totals", e);
            alert(`VAT extraction failed: ${(e as any)?.message || "Unknown error"}. Please try again.`);
        } finally {
            setIsExtracting(false);
        }
    }, [additionalFiles, handleSaveStep]);

    const handleExtractOpeningBalances = useCallback(async () => {
        if (openingBalanceFiles.length === 0) return;
        setIsExtractingOpeningBalances(true);
        try {
            const partsArrays = await Promise.all(openingBalanceFiles.map(convertFileToParts));
            const parts = partsArrays.flat();
            const details = await extractGenericDetailsFromDocuments(parts);

            if (details) {
                setOpeningBalancesData(prev => {
                    const newTb = [...(prev || [])];
                    Object.entries(details).forEach(([key, value]) => {
                        const amount = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
                        if (isNaN(amount) || amount === 0) return;

                        const accName = key.replace(/_/g, ' '); // simple normalization
                        const resolved = resolveOpeningBalanceCategory(accName);
                        const category = resolved?.category;
                        const isDebitNormal = category === 'Assets' || category === 'Expenses';
                        const absAmount = roundAmount(Math.abs(amount));
                        let debit = absAmount;
                        let credit = 0;

                        if (category) {
                            if (amount >= 0) {
                                debit = isDebitNormal ? absAmount : 0;
                                credit = isDebitNormal ? 0 : absAmount;
                            } else {
                                debit = isDebitNormal ? 0 : absAmount;
                                credit = isDebitNormal ? absAmount : 0;
                            }
                        } else if (amount < 0) {
                            debit = 0;
                            credit = absAmount;
                        }

                        // Check if account exists
                        const existingIdx = newTb.findIndex(e => e.account.toLowerCase() === accName.toLowerCase());

                        if (existingIdx !== -1) {
                            // Update existing
                            newTb[existingIdx] = { ...newTb[existingIdx], debit, credit };
                        } else {
                            newTb.push({ account: accName, debit, credit });
                        }
                    });
                    return newTb;
                });
            }
        } catch (e) {
            console.error("Failed to extract opening balances", e);
            alert("Failed to extract data. Please ensure the documents are clear and try again.");
        } finally {
            setIsExtractingOpeningBalances(false);
        }
    }, [openingBalanceFiles]);

    const handleOpeningBalanceExcelImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const { entries, skipped } = await parseOpeningBalanceExcel(file);
            if (entries.length === 0) {
                alert('No opening balance rows were detected in this Excel file.');
                return;
            }

            const imported = entries.map(entry => ({
                account: entry.account.name,
                debit: roundAmount(entry.account.debit),
                credit: roundAmount(entry.account.credit)
            }));

            setOpeningBalancesData(prev => {
                const existing = prev.filter(item => item.account.toLowerCase() !== 'totals');
                const merged = new Map(existing.map(item => [normalizeAccountName(item.account), item]));
                imported.forEach(item => {
                    merged.set(normalizeAccountName(item.account), item);
                });
                return Array.from(merged.values());
            });

            if (skipped > 0) {
                alert(`Imported with ${skipped} row(s) skipped due to missing or unknown category.`);
            }
        } catch (error) {
            console.error('Opening balance import failed:', error);
            alert('Unable to import Opening Balances. Please use the exported template format.');
        } finally {
            if (event.target) event.target.value = '';
        }
    }, []);

    const allInvoicesForReconciliation = useMemo(() => {
        return [...salesInvoices, ...purchaseInvoices];
    }, [salesInvoices, purchaseInvoices]);

    const reconciliationData = useMemo(() => {
        const results: { invoice: Invoice; transaction?: Transaction; status: 'Matched' | 'Unmatched' }[] = [];
        const usedTxIdx = new Set<number>();

        allInvoicesForReconciliation.forEach(inv => {
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
            } else {
                results.push({ invoice: inv, status: 'Unmatched' });
            }
        });

        return results;
    }, [allInvoicesForReconciliation, editedTransactions]);

    // Fix: Define handleExtractTrialBalance
    const handleExtractTrialBalance = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsExtractingTB(true);
        try {
            const parts = await convertFileToParts(file);
            const extractedEntries = await extractTrialBalanceData(parts);

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

                    const newEntries = Object.values(currentMap).map(entry => ({
                        ...entry,
                        debit: roundAmount(entry.debit),
                        credit: roundAmount(entry.credit),
                    }));

                    const totalDebit = newEntries.reduce((s, i) => s + (Number(i.debit) || 0), 0);
                    const totalCredit = newEntries.reduce((s, i) => s + (Number(i.credit) || 0), 0);

                    return [...newEntries, { account: 'Totals', debit: roundAmount(totalDebit), credit: roundAmount(totalCredit) }];
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
        const numValue = roundAmount(parseFloat(value) || 0);
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
            if (finalTotalsIdx > -1) newBalance[finalTotalsIdx] = { account: 'Totals', debit: roundAmount(totalDebit), credit: roundAmount(totalCredit) };
            else newBalance.push({ account: 'Totals', debit: roundAmount(totalDebit), credit: roundAmount(totalCredit) });
            return newBalance;
        });
    }, []);

    const handleObCellChange = useCallback((accountLabel: string, field: 'debit' | 'credit', value: string) => {
        const numValue = roundAmount(parseFloat(value) || 0);
        setOpeningBalancesData(prev => {
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
            // Recalculate totals for openingBalancesData if a totals row exists
            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const finalTotalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (finalTotalsIdx > -1) newBalance[finalTotalsIdx] = { account: 'Totals', debit: roundAmount(totalDebit), credit: roundAmount(totalCredit) };
            else newBalance.push({ account: 'Totals', debit: roundAmount(totalDebit), credit: roundAmount(totalCredit) });
            return newBalance;
        });
    }, []);

    const handlePnlChange = useCallback((id: string, value: number) => {
        pnlManualEditsRef.current.add(id);
        setPnlValues(prev => {
            const updated = { ...prev, [id]: value };
            const totals = calculatePnLTotals(updated);
            Object.entries(totals).forEach(([totalId, totalValue]) => {
                if (!pnlManualEditsRef.current.has(totalId)) {
                    updated[totalId] = totalValue;
                }
            });
            return updated;
        });
    }, [calculatePnLTotals]);

    const handleBalanceSheetChange = useCallback((id: string, value: number) => {
        bsManualEditsRef.current.add(id);
        setBalanceSheetValues(prev => {
            const updated = { ...prev, [id]: value };
            const totals = calculateBalanceSheetTotals(updated);
            Object.entries(totals).forEach(([totalId, totalValue]) => {
                if (!bsManualEditsRef.current.has(totalId)) {
                    updated[totalId] = totalValue;
                }
            });
            return updated;
        });
    }, [calculateBalanceSheetTotals]);

    const handleAddPnlAccount = useCallback((item: any) => {
        const { sectionId, ...newItem } = item;
        setPnlStructure(prev => {
            const idx = prev.findIndex(i => i.id === sectionId);
            if (idx === -1) return [...prev, newItem];
            const updated = [...prev];
            updated.splice(idx + 1, 0, newItem);
            return updated;
        });
    }, []);

    const handleAddBsAccount = useCallback((item: any) => {
        const { sectionId, ...newItem } = item;
        setBsStructure(prev => {
            const idx = prev.findIndex(i => i.id === sectionId);
            if (idx === -1) return [...prev, newItem];
            const updated = [...prev];
            updated.splice(idx + 1, 0, newItem);
            return updated;
        });
    }, []);

    const handleUpdatePnlWorkingNote = useCallback((id: string, notes: WorkingNoteEntry[]) => {
        setPnlWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const total = notes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
        handlePnlChange(id, total);
    }, [handlePnlChange]);

    const handleUpdateBsWorkingNote = useCallback((id: string, notes: WorkingNoteEntry[]) => {
        setBsWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const total = notes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
        handleBalanceSheetChange(id, total);
    }, [handleBalanceSheetChange]);

    const handleExportStepPnl = useCallback(() => {
        const wsData = pnlStructure.map(item => ({
            "Label": item.label,
            "Amount (AED)": pnlValues[item.id] || 0
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Profit and Loss");
        XLSX.writeFile(wb, `${companyName}_Profit_Loss.xlsx`);
    }, [pnlStructure, pnlValues, companyName]);

    const handleExportStepBS = useCallback(() => {
        const wsData = bsStructure.map(item => ({
            "Label": item.label,
            "Amount (AED)": balanceSheetValues[item.id] || 0
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
        XLSX.writeFile(wb, `${companyName}_Balance_Sheet.xlsx`);
    }, [bsStructure, balanceSheetValues, companyName]);

    const getFinalReportExportData = useCallback(() => {
        const data: any[] = [
            ["FEDERATION TAX AUTHORITY - CORPORATE TAX RETURN"],
            ["Generated on: " + new Date().toLocaleString()],
            []
        ];

        REPORT_STRUCTURE.forEach(section => {
            // Section Header
            data.push([section.title.toUpperCase(), ""]);

            // Fields
            section.fields.forEach(f => {
                if (f.type === 'header') {
                    data.push([f.label.toUpperCase().replace(/---/g, '').trim(), ""]);
                } else {
                    let value = reportForm[f.field];
                    if (f.type === 'number' && typeof value === 'number') {
                        // value is already a number
                    } else if (value === undefined || value === null || value === '') {
                        value = "-";
                    }
                    data.push([f.label.toUpperCase(), value]);
                }
            });

            // Blank row for spacing
            data.push([]);
        });

        return data;
    }, [reportForm]);



    const handleDownloadPDF = useCallback(async () => {
        setIsDownloadingPdf(true);
        try {
            let locationText = 'DUBAI, UAE';
            if (reportForm.address) {
                const parts = reportForm.address.split(',').map((p: string) => p.trim());
                if (parts.length >= 2) {
                    locationText = `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
                } else {
                    locationText = reportForm.address;
                }
            }

            const pnlValuesForPdf: Record<string, { currentYear: number; previousYear: number }> = {};
            pnlStructure.forEach(item => {
                if (item.type === 'item' || item.type === 'total') {
                    const raw = pnlValues[item.id];
                    pnlValuesForPdf[item.id] = {
                        currentYear: Number.isFinite(raw) ? raw : Number(raw) || 0,
                        previousYear: 0
                    };
                }
            });

            const bsValuesForPdf: Record<string, { currentYear: number; previousYear: number }> = {};
            bsStructure.forEach(item => {
                if (item.type === 'item' || item.type === 'total') {
                    const raw = balanceSheetValues[item.id];
                    bsValuesForPdf[item.id] = {
                        currentYear: Number.isFinite(raw) ? raw : Number(raw) || 0,
                        previousYear: 0
                    };
                }
            });

            const blob = await ctFilingService.downloadPdf({
                companyName: reportForm.taxableNameEn || companyName,
                period: `For the period: ${reportForm.periodFrom || '-'} to ${reportForm.periodTo || '-'}`,
                pnlStructure,
                pnlValues: pnlValuesForPdf,
                bsStructure,
                bsValues: bsValuesForPdf,
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
    }, [balanceSheetValues, bsStructure, bsWorkingNotes, companyName, pnlStructure, pnlValues, pnlWorkingNotes, reportForm.address, reportForm.periodFrom, reportForm.periodTo, reportForm.taxableNameEn]);

    const handleContinueToProfitAndLoss = useCallback(async () => {
        await handleSaveStep(9);
        setCurrentStep(10);
    }, [handleSaveStep]);

    const handleContinueToBalanceSheet = useCallback(async () => {
        await handleSaveStep(10);
        setCurrentStep(11);
    }, [handleSaveStep]);


    const handleReportFormChange = useCallback((field: string, value: any) => {
        setReportForm((prev: any) => ({ ...prev, [field]: value }));
    }, []);

    const handleContinueToReconciliation = useCallback(async () => {
        await handleSaveStep(4);
        setCurrentStep(5);
    }, [handleSaveStep]);

    const handleContinueToOpeningBalances = useCallback(async () => {
        await handleSaveStep(7);
        setCurrentStep(8);
    }, [handleSaveStep]);

    const handleOpeningBalancesComplete = useCallback(async () => {
        // 1. Calculate actual total closing balance from bank statements
        const totalActualClosingBalance = editedTransactions.reduce((sum, t) => sum + (t.credit || 0) - (t.debit || 0), 0) + (summary?.openingBalance || 0);

        // 2. Map Opening Balances (Step 8)
        const obEntries: TrialBalanceEntry[] = openingBalancesData
            .filter(acc => (acc.debit > 0 || acc.credit > 0) && acc.account !== 'Totals')
            .map(acc => ({ account: acc.account, debit: acc.debit, credit: acc.credit }));

        // 3. Map Summarized movements from Bank Transactions (Step 2)
        const summarizedMovements = summaryData;

        const combined: { [key: string]: { debit: number, credit: number } } = {};
        const autoBreakdowns: Record<string, BreakdownEntry[]> = {};
        const pushBreakdown = (account: string, entry: BreakdownEntry) => {
            if (!autoBreakdowns[account]) autoBreakdowns[account] = [];
            autoBreakdowns[account].push(entry);
        };

        // Start with Opening Balances
        obEntries.forEach(item => {
            combined[item.account] = { debit: item.debit, credit: item.credit };
            pushBreakdown(item.account, {
                description: 'Opening balance (Step 8)',
                debit: item.debit,
                credit: item.credit
            });
        });

        // Add Categorized Movements
        summarizedMovements.forEach(item => {
            if (combined[item.category]) {
                combined[item.category].debit += item.debit;
                combined[item.category].credit += item.credit;
            } else {
                combined[item.category] = { debit: item.debit, credit: item.credit };
            }
            if (item.debit !== 0 || item.credit !== 0) {
                pushBreakdown(item.category, {
                    description: 'Bank movements (Step 2 summarization)',
                    debit: item.debit,
                    credit: item.credit
                });
            }
        });

        // 4. Set Bank Accounts to the actual total closing balance
        const bankBefore = combined['Bank Accounts'] || { debit: 0, credit: 0 };
        const bankBeforeNet = bankBefore.debit - bankBefore.credit;
        if (totalActualClosingBalance >= 0) {
            combined['Bank Accounts'] = { debit: totalActualClosingBalance, credit: 0 };
        } else {
            combined['Bank Accounts'] = { debit: 0, credit: Math.abs(totalActualClosingBalance) };
        }
        const bankAdjustmentNet = totalActualClosingBalance - bankBeforeNet;
        if (Math.abs(bankAdjustmentNet) > 0.01) {
            pushBreakdown('Bank Accounts', {
                description: 'Bank balance adjustment to statement closing',
                debit: bankAdjustmentNet > 0 ? bankAdjustmentNet : 0,
                credit: bankAdjustmentNet < 0 ? Math.abs(bankAdjustmentNet) : 0
            });
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
            const shareCapitalValue = parseCurrencyAmount(company.shareCapital);
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
                pushBreakdown('Share Capital / Owner’s Equity', {
                    description: 'Share capital from company profile',
                    debit: 0,
                    credit: shareCapitalValue
                });
            }
        }

        // Add Totals row
        const roundedTrialBalance = combinedTrialBalance.map(item => ({
            ...item,
            debit: roundAmount(item.debit),
            credit: roundAmount(item.credit),
        }));
        const totalDebit = roundedTrialBalance.reduce((sum, item) => sum + item.debit, 0);
        const totalCredit = roundedTrialBalance.reduce((sum, item) => sum + item.credit, 0);
        roundedTrialBalance.push({ account: 'Totals', debit: roundAmount(totalDebit), credit: roundAmount(totalCredit) });

        // Persist Step 8 Data
        handleSaveStep(8, { openingBalancesData }, 'completed');

        setBreakdowns(prev => {
            const merged = { ...prev };
            Object.entries(autoBreakdowns).forEach(([account, entries]) => {
                if (!merged[account] || merged[account].length === 0) {
                    merged[account] = entries;
                }
            });
            return merged;
        });
        setAdjustedTrialBalance(roundedTrialBalance);
        setCurrentStep(9); // To Adjust TB
    }, [editedTransactions, summary, openingBalancesData, summaryData, company?.shareCapital, handleSaveStep]);

    const handleExportToExcel = useCallback(() => {
        if (!adjustedTrialBalance || !ftaFormValues) return;
        const workbook = XLSX.utils.book_new();

        // --- Sheet 1: Step 1 - Bank Transactions ---
        const txsToExport = selectedFileFilter === 'ALL'
            ? transactionsWithRunningBalance
            : transactionsWithRunningBalance.filter(t => t.sourceFile === selectedFileFilter);

        if (txsToExport.length > 0) {
            const step1Data = txsToExport.map(t => ({
                "Date": formatDate(t.date),
                "Category": getChildCategory(t.category || 'UNCATEGORIZED'),
                "Description": typeof t.description === 'string' ? t.description : JSON.stringify(t.description),
                "Source File": t.sourceFile || '-',
                "Currency (Orig)": t.originalCurrency || t.currency || 'AED',
                "Debit (Orig)": t.originalDebit || t.debit || 0,
                "Credit (Orig)": t.originalCredit || t.credit || 0,
                "Running Balance": t.runningBalance || 0,
                "Currency (AED)": "AED",
                "Debit (AED)": t.debit || 0,
                "Credit (AED)": t.credit || 0,
                "Confidence": (t.confidence || 0) + '%'
            }));
            const ws1 = XLSX.utils.json_to_sheet(step1Data);
            ws1['!cols'] = [
                { wch: 12 }, { wch: 30 }, { wch: 50 }, { wch: 30 },
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }
            ];
            applySheetStyling(ws1, 1);
            XLSX.utils.book_append_sheet(workbook, ws1, 'Step 1 - Bank Transactions');
        }

        // --- Sheet 2: Step 2 - Bank Summary ---
        // --- Sheet 2: Step 2 - Bank Summary ---
        const summaryGroups: Record<string, { debit: number, credit: number }> = {};
        txsToExport.forEach(t => {
            const cat = getChildCategory(t.category || 'UNCATEGORIZED');
            if (!summaryGroups[cat]) summaryGroups[cat] = { debit: 0, credit: 0 };
            summaryGroups[cat].debit += (t.debit || 0);
            summaryGroups[cat].credit += (t.credit || 0);
        });

        const step2Data = Object.entries(summaryGroups).map(([cat, vals]) => ({
            "Category": cat,
            "Debit (AED)": vals.debit,
            "Credit (AED)": vals.credit
        })).sort((a, b) => a.Category.localeCompare(b.Category));

        if (step2Data.length > 0) {
            const totalDebit = step2Data.reduce((sum, d) => sum + d["Debit (AED)"], 0);
            const totalCredit = step2Data.reduce((sum, d) => sum + d["Credit (AED)"], 0);
            step2Data.push({
                "Category": "GRAND TOTAL",
                "Debit (AED)": totalDebit,
                "Credit (AED)": totalCredit
            });
            const ws2 = XLSX.utils.json_to_sheet(step2Data);
            ws2['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws2, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws2, 'Step 2 - Bank Summary');
        }

        // --- Sheet 3: Step 3 - Invoice Docs ---
        const invoiceDocs = invoiceFiles && invoiceFiles.length > 0
            ? invoiceFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const ws3 = XLSX.utils.json_to_sheet(invoiceDocs);
        ws3['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws3, 1);
        XLSX.utils.book_append_sheet(workbook, ws3, 'Step 3 - Invoice Docs');

        // --- Sheet 4: Step 4 - Invoice Summary ---
        const invoiceData: any[] = [["SALES INVOICES"], ["Invoice #", "Customer", "Date", "Payment Status", "Payment Mode", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"]];
        salesInvoices.forEach(inv => {
            const customerName = inv.customerName || inv.vendorName || (inv as any).partyName || 'N/A';
            invoiceData.push([
                inv.invoiceId || (inv as any).invoiceNumber || 'N/A',
                customerName,
                formatDate(inv.invoiceDate || (inv as any).date),
                (inv.paymentStatus || inv.status || 'N/A'),
                (inv.paymentMode || 'N/A'),
                inv.totalBeforeTaxAED || inv.totalBeforeTax,
                inv.totalTaxAED || inv.totalTax,
                inv.totalAmountAED || inv.totalAmount
            ]);
        });
        invoiceData.push([], ["PURCHASE INVOICES"], ["Invoice #", "Supplier", "Date", "Payment Status", "Payment Mode", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"]);
        purchaseInvoices.forEach(inv => {
            const supplierName = inv.vendorName || inv.customerName || (inv as any).partyName || 'N/A';
            invoiceData.push([
                inv.invoiceId || (inv as any).invoiceNumber || 'N/A',
                supplierName,
                formatDate(inv.invoiceDate || (inv as any).date),
                (inv.paymentStatus || inv.status || 'N/A'),
                (inv.paymentMode || 'N/A'),
                inv.totalBeforeTaxAED || inv.totalBeforeTax,
                inv.totalTaxAED || inv.totalTax,
                inv.totalAmountAED || inv.totalAmount
            ]);
        });
        const ws4 = XLSX.utils.aoa_to_sheet(invoiceData);
        ws4['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
        applySheetStyling(ws4, 2);
        XLSX.utils.book_append_sheet(workbook, ws4, 'Step 4 - Invoice Summary');

        // --- Sheet 5: Step 5 - Bank Reconciliation ---
        const reconToExport = reconciliationData.filter(r => {
            if (selectedFileFilter === 'ALL') return true;
            // If matched, check if transaction is from selected file
            if (r.transaction) return r.transaction.sourceFile === selectedFileFilter;
            // For unmatched invoices, we show them as unmatched in the isolated report?
            // Usually yes, if they were expected to be matched against THIS file.
            // But if they were matched against another file, they shouldn't show as unmatched here?
            // Actually, if we are isolating EVERYTHING, maybe we only show invoices matched to this file.
            // But usually Step 5 is about checking ALL invoices against statements.
            // Let's only include rows where the match (if any) is from this file.
            // If it's an unmatched invoice, we include it if the report is for ALL,
            // but if it's isolated, maybe we only care about what MATCHED this file.
            // Let's filter to only include matched rows for this file or unmatched invoices.
            return true;
        }).map(r => {
            const isMatchForThisFile = r.transaction && (selectedFileFilter === 'ALL' || r.transaction.sourceFile === selectedFileFilter);
            return {
                "Invoice #": r.invoice.invoiceId || '-',
                "Partner": r.invoice.invoiceType === 'sales' ? (r.invoice.customerName || r.invoice.vendorName || '-') : (r.invoice.vendorName || r.invoice.customerName || '-'),
                "Invoice Amount": r.invoice.totalAmountAED || r.invoice.totalAmount,
                "Bank Matches": isMatchForThisFile ? (r.transaction!.credit || r.transaction!.debit) : 'No Match',
                "Status": isMatchForThisFile ? r.status : 'Unmatched'
            };
        });

        if (reconToExport.length > 0) {
            const ws5 = XLSX.utils.json_to_sheet(reconToExport);
            ws5['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
            applySheetStyling(ws5, 1);
            XLSX.utils.book_append_sheet(workbook, ws5, 'Step 5 - Bank Reconciliation');
        }

        // --- Sheet 6: Step 6 - VAT Docs ---
        const vatFiles = additionalFiles.length > 0
            ? additionalFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const ws6 = XLSX.utils.json_to_sheet(vatFiles);
        ws6['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws6, 1);
        XLSX.utils.book_append_sheet(workbook, ws6, 'Step 6 - VAT Docs');

        // --- Sheet 7: Step 7 - VAT Summarization ---
        const vatSummaryData = [
            ["VAT SUMMARIZATION"],
            ["Item", "Amount (AED)"],
            ["Total Sales Amount", invoiceTotals.salesAmount],
            ["Total Sales VAT", invoiceTotals.salesVat],
            ["Total Purchase Amount", invoiceTotals.purchaseAmount],
            ["Total Purchase VAT", invoiceTotals.purchaseVat],
            [],
            ["VAT 201 CERTIFICATE DATA"],
            ["Standard Rated Supplies", vatCertificateTotals.salesAmount],
            ["Standard Rated Supplies VAT", vatCertificateTotals.salesVat],
            ["Standard Rated Expenses", vatCertificateTotals.purchaseAmount],
            ["Standard Rated Expenses VAT", vatCertificateTotals.purchaseVat]
        ];
        const ws7 = XLSX.utils.aoa_to_sheet(vatSummaryData);
        ws7['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws7, 2);
        XLSX.utils.book_append_sheet(workbook, ws7, 'Step 7 - VAT Summarization');

        // --- Sheet 8: Step 8 - Opening Balances ---
        if (openingBalancesData.length > 0) {
            const step8Data = openingBalancesData.filter(i => i.account !== 'Totals').map(acc => ({
                Account: acc.account,
                "Debit (AED)": acc.debit || 0,
                "Credit (AED)": acc.credit || 0
            }));
            const totalDebit = openingBalancesData.reduce((sum, d) => sum + d.debit, 0);
            const totalCredit = openingBalancesData.reduce((sum, d) => sum + d.credit, 0);
            step8Data.push({
                Account: "GRAND TOTAL",
                "Debit (AED)": totalDebit,
                "Credit (AED)": totalCredit
            });
            const ws8 = XLSX.utils.json_to_sheet(step8Data);
            ws8['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }];
            applySheetStyling(ws8, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws8, 'Step 8 - Opening Balances');
        }

        // --- Sheet 9: Step 9 - Trial Balance ---
        if (adjustedTrialBalance) {
            const step9Data = adjustedTrialBalance.map(item => ({
                Account: item.account,
                "Debit (AED)": item.debit || 0,
                "Credit (AED)": item.credit || 0
            }));
            const totalDebit = adjustedTrialBalance.reduce((sum, d) => sum + d.debit, 0);
            const totalCredit = adjustedTrialBalance.reduce((sum, d) => sum + d.credit, 0);
            step9Data.push({
                Account: "GRAND TOTAL",
                "Debit (AED)": totalDebit,
                "Credit (AED)": totalCredit
            });
            const ws9 = XLSX.utils.json_to_sheet(step9Data);
            ws9['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws9, 1, 1);
            XLSX.utils.book_append_sheet(workbook, ws9, "Step 9 - Trial Balance");

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
                const ws9Notes = XLSX.utils.json_to_sheet(tbNotesItems);
                ws9Notes['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
                applySheetStyling(ws9Notes, 1);
                XLSX.utils.book_append_sheet(workbook, ws9Notes, "Step 9 - TB Working Notes");
            }
        }

        // --- Sheet 10: Step 10 - PNL Working Sheet ---
        const pnlRows: any[][] = [['PROFIT & LOSS STATEMENT'], ['Generated Date', new Date().toLocaleDateString()], []];
        pnlRows.push(['ITEM', 'AMOUNT (AED)']);
        pnlStructure.forEach(item => {
            if (item.type === 'header') {
                pnlRows.push([item.label.toUpperCase()]);
            } else if (item.type === 'subsection_header') {
                pnlRows.push([`  ${item.label}`]);
            } else {
                const currentVal = pnlValues[item.id] || 0;
                pnlRows.push([item.label, currentVal]);
            }
        });
        const ws10 = XLSX.utils.aoa_to_sheet(pnlRows);
        ws10['!cols'] = [{ wch: 50 }, { wch: 25 }];
        applySheetStyling(ws10, 4);
        XLSX.utils.book_append_sheet(workbook, ws10, "Step 10 - PNL Working Sheet");

        // Step 10.5: PNL Working Notes
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
            const ws10Notes = XLSX.utils.json_to_sheet(pnlNotesForExport);
            ws10Notes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws10Notes, 1);
            XLSX.utils.book_append_sheet(workbook, ws10Notes, "Step 10 - PNL Working Notes");
        }

        // --- Sheet 11: Step 11 - Balance Sheet ---
        const bsRows: any[][] = [['STATEMENT OF FINANCIAL POSITION'], ['Generated Date', new Date().toLocaleDateString()], []];
        bsRows.push(['ITEM', 'AMOUNT (AED)']);
        bsStructure.forEach(item => {
            if (item.type === 'header') {
                bsRows.push([item.label.toUpperCase()]);
            } else if (item.type === 'subheader') {
                bsRows.push([`  ${item.label}`]);
            } else {
                const currentVal = balanceSheetValues[item.id] || 0;
                bsRows.push([item.label, currentVal]);
            }
        });
        const ws11 = XLSX.utils.aoa_to_sheet(bsRows);
        ws11['!cols'] = [{ wch: 50 }, { wch: 25 }];
        applySheetStyling(ws11, 4);
        XLSX.utils.book_append_sheet(workbook, ws11, "Step 11 - Balance Sheet");

        // --- Sheet 12: Step 12 - BS Working Notes ---
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
            const ws12 = XLSX.utils.json_to_sheet(bsNotesForExport);
            ws12['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws12, 1);
            XLSX.utils.book_append_sheet(workbook, ws12, "Step 12 - BS Working Notes");
        }

        // --- Sheet 13: Step 13 - LOU ---
        const louData = louFiles.length > 0
            ? louFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const ws13 = XLSX.utils.json_to_sheet(louData);
        ws13['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws13, 1);
        XLSX.utils.book_append_sheet(workbook, ws13, "Step 13 - LOU");

        // --- Sheet 14: Step 14 - Signed FS & LOU ---
        const signedFsLouData = signedFsLouFiles.length > 0
            ? signedFsLouFiles.map(f => ({ "File Name": f.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const ws14 = XLSX.utils.json_to_sheet(signedFsLouData);
        ws14['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws14, 1);
        XLSX.utils.book_append_sheet(workbook, ws14, "Step 14 - Signed FS & LOU");

        // --- Sheet 15: Step 15 - Questionnaire ---
        const qRows: any[][] = [['CORPORATE TAX QUESTIONNAIRE'], []];
        CT_QUESTIONS.forEach(q => {
            qRows.push([q.text, questionnaireAnswers[q.id] || '-']);
        });
        if (questionnaireAnswers['curr_revenue'] || questionnaireAnswers['prev_revenue']) {
            qRows.push([], ['SUPPLEMENTARY DATA', 'VALUE']);
            qRows.push(['Operating Revenue of Current Period', questionnaireAnswers['curr_revenue'] || '0.00']);
            qRows.push(['Operating Revenue for Previous Period', questionnaireAnswers['prev_revenue'] || '0.00']);
        }
        const ws15 = XLSX.utils.aoa_to_sheet(qRows);
        ws15['!cols'] = [{ wch: 80 }, { wch: 20 }];
        applySheetStyling(ws15, 1);
        XLSX.utils.book_append_sheet(workbook, ws15, "Step 15 - Questionnaire");

        // --- Sheet 16: Step 16 - Final Report ---
        const finalReportData = getFinalReportExportData();
        const ws16 = XLSX.utils.aoa_to_sheet(finalReportData);
        ws16['!cols'] = [{ wch: 60 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, ws16, "Step 16 - Final Report");

        // --- Sheet 16: Chart of Accounts ---
        const coaData = getCoAListData();
        const wsCoa = XLSX.utils.aoa_to_sheet(coaData);
        wsCoa['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, wsCoa, "Chart of Accounts");

        const exportName = selectedFileFilter === 'ALL'
            ? `${companyName.replace(/\s+/g, '_')}_CT_Filing_Export.xlsx`
            : `${companyName.replace(/\s+/g, '_')}_CT_Filing_Export_${selectedFileFilter.replace(/\s+/g, '_')}.xlsx`;

        XLSX.writeFile(workbook, exportName);
    }, [adjustedTrialBalance, ftaFormValues, transactionsWithRunningBalance, summaryData, invoiceFiles, salesInvoices, purchaseInvoices, reconciliationData, additionalFiles, invoiceTotals, vatCertificateTotals, openingBalancesData, breakdowns, pnlStructure, pnlValues, pnlWorkingNotes, bsStructure, balanceSheetValues, bsWorkingNotes, companyName, reportForm, selectedFileFilter, questionnaireAnswers, louFiles, signedFsLouFiles, getFinalReportExportData]);

    const getVatExportRows = useCallback((vatData: any) => {
        const { periods, grandTotals } = vatData;
        const rows: any[] = [];
        rows.push(["", "SALES (OUTPUTS)", "", "", "", "PURCHASES (INPUTS)", "", "", "", "VAT LIABILITY/(REFUND)"]);
        rows.push(["PERIOD", "ZERO RATED", "STANDARD", "VAT", "TOTAL", "PERIOD", "ZERO RATED", "STANDARD", "VAT", "TOTAL", ""]);

        periods.forEach((p: any) => {
            const periodLabel = getVatPeriodLabel(p.periodFrom, p.periodTo, p.fileName);
            rows.push([
                periodLabel, p.sales.zero, p.sales.tv, p.sales.vat, p.sales.total,
                periodLabel, p.purchases.zero, p.purchases.tv, p.purchases.vat, p.purchases.total,
                p.net
            ]);
        });

        rows.push([
            "GRAND TOTAL", grandTotals.sales.zero, grandTotals.sales.tv, grandTotals.sales.vat, grandTotals.sales.total,
            "GRAND TOTAL", grandTotals.purchases.zero, grandTotals.purchases.tv, grandTotals.purchases.vat, grandTotals.purchases.total,
            grandTotals.net
        ]);
        return rows;
    }, []);

    const handleExportStep7VAT = useCallback(() => {
        const vatRows = getVatExportRows(vatStepData);
        const ws = XLSX.utils.aoa_to_sheet(vatRows);
        ws['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
        ws['!merges'] = [
            { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } },
            { s: { r: 0, c: 6 }, e: { r: 0, c: 9 } }
        ];
        applySheetStyling(ws, 2, 1);
        if (!XLSX?.utils || !XLSX.writeFile) {
            alert("Export failed: Excel library not loaded.");
            return;
        }
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VAT Summarization");
        XLSX.writeFile(wb, `${companyName || 'Company'}_VAT_Summarization_Step7.xlsx`);
    }, [companyName, getVatExportRows, vatStepData]);

    const handleExportStep4Invoices = useCallback(() => {
        if (!XLSX?.utils || !XLSX.writeFile) {
            alert("Export failed: Excel library not loaded.");
            return;
        }

        const invoiceData: any[] = [
            ["SALES INVOICES"],
            ["Invoice #", "Customer", "Date", "Payment Status", "Payment Mode", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"]
        ];

        salesInvoices.forEach(inv => {
            const customerName = inv.customerName || inv.vendorName || (inv as any).partyName || 'N/A';
            invoiceData.push([
                inv.invoiceId || (inv as any).invoiceNumber || 'N/A',
                customerName,
                formatDate(inv.invoiceDate || (inv as any).date),
                (inv.paymentStatus || inv.status || 'N/A'),
                (inv.paymentMode || 'N/A'),
                inv.totalBeforeTaxAED || inv.totalBeforeTax || 0,
                inv.totalTaxAED || inv.totalTax || 0,
                inv.totalAmountAED || inv.totalAmount || 0
            ]);
        });

        invoiceData.push([]);
        invoiceData.push(["PURCHASE INVOICES"]);
        invoiceData.push(["Invoice #", "Supplier", "Date", "Payment Status", "Payment Mode", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"]);
        purchaseInvoices.forEach(inv => {
            const supplierName = inv.vendorName || inv.customerName || (inv as any).partyName || 'N/A';
            invoiceData.push([
                inv.invoiceId || (inv as any).invoiceNumber || 'N/A',
                supplierName,
                formatDate(inv.invoiceDate || (inv as any).date),
                (inv.paymentStatus || inv.status || 'N/A'),
                (inv.paymentMode || 'N/A'),
                inv.totalBeforeTaxAED || inv.totalBeforeTax || 0,
                inv.totalTaxAED || inv.totalTax || 0,
                inv.totalAmountAED || inv.totalAmount || 0
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(invoiceData);
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
        applySheetStyling(ws, 2);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Invoice Summary");
        XLSX.writeFile(wb, `${companyName || 'Company'}_Invoice_Summary_Step4.xlsx`);
    }, [companyName, salesInvoices, purchaseInvoices]);



    const handleExportStep1 = useCallback(() => {
        const txsToExport = selectedFileFilter === 'ALL'
            ? transactionsWithRunningBalance
            : transactionsWithRunningBalance.filter(t => t.sourceFile === selectedFileFilter);

        const wsData = txsToExport.map(t => ({
            "Source File": t.sourceFile || '-',
            Date: formatDate(t.date),
            Description: typeof t.description === 'object' ? JSON.stringify(t.description) : t.description,
            Debit: (t.originalDebit !== undefined) ? t.originalDebit : (t.debit || 0),
            Credit: (t.originalCredit !== undefined) ? t.originalCredit : (t.credit || 0),
            Currency: t.originalCurrency || t.currency || 'AED',
            Category: getChildCategory(t.category || ''),
            Confidence: (t.confidence || 0) + '%'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 40 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categorized Transactions");

        // Append Chart of Accounts sheet
        const coaData = getCoAListData();
        const wsCoa = XLSX.utils.aoa_to_sheet(coaData);
        wsCoa['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, wsCoa, "Chart of Accounts");

        const exportName = selectedFileFilter === 'ALL'
            ? `${companyName}_Transactions_Step1.xlsx`
            : `${companyName}_Transactions_Step1_${selectedFileFilter.replace(/\s+/g, '_')}.xlsx`;

        XLSX.writeFile(wb, exportName);
    }, [transactionsWithRunningBalance, companyName, selectedFileFilter]);

    const handleExportStepSummary = useCallback((data: any[]) => {
        const wb = XLSX.utils.book_new();

        const summaryCurrency = summaryFileFilter === 'ALL' ? 'AED' : (statementReconciliationData[0]?.currency || 'AED');
        const wsData = data.map(d => ({
            "Account": d.category,
            "Debit": d.debit,
            "Credit": d.credit,
            "Currency": summaryCurrency
        }));
        const totalDebit = data.reduce((s, d) => s + d.debit, 0);
        const totalCredit = data.reduce((s, d) => s + d.credit, 0);
        wsData.push({
            "Account": "Grand Total",
            "Debit": totalDebit,
            "Credit": totalCredit,
            "Currency": summaryCurrency
        });

        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
        applySheetStyling(ws, 1, 1, '#,##0.00;[Red]-#,##0.00');
        XLSX.utils.book_append_sheet(wb, ws, "Account Summary");

        if (statementReconciliationData.length > 0) {
            const reconWsData = statementReconciliationData.map(r => ({
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

            if (summaryFileFilter === 'ALL' && statementReconciliationData.length > 1) {
                reconWsData.push({
                    "File Name": "OVERALL TOTAL",
                    "Opening Balance": statementReconciliationData.reduce((s, r) => s + r.openingBalanceAed, 0),
                    "Total Debit (-)": statementReconciliationData.reduce((s, r) => s + r.totalDebitAed, 0),
                    "Total Credit (+)": statementReconciliationData.reduce((s, r) => s + r.totalCreditAed, 0),
                    "Calculated Closing": statementReconciliationData.reduce((s, r) => s + r.calculatedClosingAed, 0),
                    "Actual Closing (Extracted)": statementReconciliationData.reduce((s, r) => s + r.closingBalanceAed, 0),
                    "Difference": 0,
                    "Status": statementReconciliationData.every(r => r.isValid) ? "Balanced" : "Mismatch",
                    "Currency": "AED"
                });
            }

            const wsRecon = XLSX.utils.json_to_sheet(reconWsData);
            wsRecon['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 10 }];
            applySheetStyling(wsRecon, 1, 1, '#,##0.00;[Red]-#,##0.00');
            XLSX.utils.book_append_sheet(wb, wsRecon, "Bank Account Reconciliation Details");
        }

        const exportName = `${companyName || 'Company'}_Summarization_Step2.xlsx`;
        try {
            XLSX.writeFile(wb, exportName);
        } catch (e) {
            console.error("Failed to export summarization", e);
            alert("Failed to export summarization. Please try again.");
        }
    }, [companyName, summaryFileFilter, statementReconciliationData]);

    const handleExportStepOpeningBalances = useCallback(() => {
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
            'Share Capital / Ownerâ€™s Equity': 'Share Capital / Ownerâ€™s Equity',
            'Retained Earnings': 'Retained Earnings',
            'Current Year Profit/Loss': 'Retained Earnings',
            'Dividends / Ownerâ€™s Drawings': 'Dividends / Ownerâ€™s Drawings',
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
            'Depreciation â€“ Furniture & Equipment': 'Depreciation',
            'Depreciation â€“ Vehicles': 'Depreciation',
            'Amortization â€“ Intangibles': 'Depreciation',
            'VAT Expense (non-recoverable)': 'Miscellaneous Expense',
            'Bad Debt Expense': 'Miscellaneous Expense',
            'Miscellaneous Expense': 'Miscellaneous Expense'
        };

        const SECTION_MAP: Record<string, string[]> = {
            Assets: [
                'Cash on Hand',
                'Bank Accounts',
                'Accounts Receivable',
                'Due from related Parties',
                'Prepaid Expenses',
                'Deposits',
                'VAT Recoverable (Input VAT)',
                'Property, Plant & Equipment'
            ],
            Liabilities: [
                'Accounts Payable',
                'Due to Related Parties',
                'Accrued Expenses',
                'VAT Payable (Output VAT)',
                'Long-Term Liabilities'
            ],
            Equity: [
                'Share Capital / Ownerâ€™s Equity',
                'Retained Earnings',
                'Dividends / Ownerâ€™s Drawings',
                "Owner's Current Account"
            ],
            Income: [
                'Sales Revenue',
                'Interest Income',
                'Miscellaneous Income'
            ],
            Expenses: [
                'Direct Cost (COGS)',
                'Purchases from Related Parties',
                'Salaries & Wages',
                'Training & Development',
                'Rent Expense',
                'Utility - Electricity & Water',
                'Utility - Telephone & Internet',
                'Office Supplies & Stationery',
                'Repairs & Maintenance',
                'Insurance Expense',
                'Marketing & Advertising',
                'Travel & Entertainment',
                'Professional Fees',
                'Legal Fees',
                'IT & Software Subscriptions',
                'Fuel Expenses',
                'Transportation & Logistics',
                'Interest Expense',
                'Interest to Related Parties',
                'Bank Charges',
                'Corporate Tax Expense',
                'Government Fees & Licenses',
                'Depreciation',
                'Miscellaneous Expense'
            ]
        };

        const resolveCategory = (account: string) => {
            const normalized = ACCOUNT_MAPPING[account] || account;
            for (const [section, items] of Object.entries(SECTION_MAP)) {
                if (items.includes(normalized)) return section;
            }
            for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
                if (Array.isArray(details)) {
                    if (details.includes(account)) return mainCat === 'Revenues' ? 'Income' : mainCat;
                } else {
                    for (const accounts of Object.values(details)) {
                        if ((accounts as string[]).includes(account)) {
                            return mainCat === 'Revenues' ? 'Income' : mainCat;
                        }
                    }
                }
            }
            return 'Expenses';
        };

        const wsData = openingBalancesData
            .filter(i => i.account !== 'Totals')
            .map(item => ({
                "Category": resolveCategory(item.account),
                "Account": item.account,
                "Debit": item.debit || 0,
                "Credit": item.credit || 0
            }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
        XLSX.writeFile(wb, `${companyName || 'Company'}_Opening_Balances_Step8.xlsx`);
    }, [openingBalancesData, companyName]);

    const handleExportStepAdjustTrialBalance = useCallback(() => {
        if (!adjustedTrialBalance) return;
        const data = adjustedTrialBalance.map(tb => ({
            Account: tb.account,
            Debit: tb.debit,
            Credit: tb.credit
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1, 1);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
        XLSX.writeFile(wb, `${companyName}_Adjusted_Trial_Balance.xlsx`);
    }, [adjustedTrialBalance, companyName]);


    // Fix: Moved ReportInput and ReportNumberInput outside renderStepX functions
    const ReportInput = ({ field, type = "text", className = "" }: { field: string, type?: string, className?: string }) => (
        <input
            type={type}
            value={reportForm[field] || ''}
            onChange={(e) => handleReportFormChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
            className={`w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary/50 focus:ring-0 p-1 text-foreground transition-all text-xs font-medium outline-none ${className}`}
        />
    );

    const ReportNumberInput = ({ field, className = "" }: { field: string, className?: string }) => (
        <input
            type="number"
            step="0.01"
            value={(Math.round(((reportForm[field] || 0) + Number.EPSILON) * 100) / 100).toFixed(2)}
            onChange={(e) => handleReportFormChange(field, parseFloat(e.target.value) || 0)}
            className={`w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary/50 focus:ring-0 p-1 text-right font-mono text-foreground transition-all text-xs font-bold outline-none ${className}`}
        />
    );


    const handleImportStep1 = () => {
        importStep1InputRef.current?.click();
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
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            const defaultSourceFile = selectedFileFilter !== 'ALL'
                ? selectedFileFilter
                : (editedTransactions[0]?.sourceFile || file.name);

            const mapped = rows.map((row) => {
                const rawCategory = String(row['Category'] || '').trim();
                const normalizedCategory =
                    rawCategory && rawCategory.toUpperCase() !== 'UNCATEGORIZED'
                        ? resolveCategoryPath(rawCategory)
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


    const handleBalanceEdit = (type: 'opening' | 'closing', value: string) => {
        // Allow editing if specific file is selected OR if "ALL" is selected but there's only one file
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
        const currentPreviewKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        const isAllFiles = selectedFileFilter === 'ALL';
        const isSingleFileMode = !isAllFiles || uniqueFiles.length === 1;

        const aggregatedOpening = allFilesBalancesAed.opening;
        const aggregatedClosing = allFilesBalancesAed.closing;

        const selectedTransactions = !isAllFiles
            ? editedTransactions.filter(t => t.sourceFile === currentPreviewKey)
            : [];
        const selectedCurrency = selectedTransactions.find(t => t.originalCurrency)?.originalCurrency
            || selectedTransactions.find(t => t.currency)?.currency
            || currency
            || 'AED';

        const isMultiCurrency = !isAllFiles && selectedCurrency !== 'AED';

        return (
            <div className="space-y-6">

                <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-muted-foreground">Additional Bank Statements</p>
                            <p className="text-xs text-muted-foreground">
                                If the client shares an extra bank statement later (for example a new bank account), you can add it here without restarting the filing.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="inline-flex items-center px-3 py-2 text-[11px] font-black uppercase tracking-widest rounded-xl border border-border bg-background cursor-pointer hover:bg-muted transition-colors">
                                <input
                                    type="file"
                                    multiple
                                    className="hidden"
                                    accept=".pdf,image/*,.xls,.xlsx"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        setNewStatementFiles(files);
                                    }}
                                />
                                <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
                                Select Files
                            </label>
                            {newStatementFiles.length > 0 && (
                                <span className="text-[11px] font-mono text-muted-foreground">
                                    {newStatementFiles.length} file{newStatementFiles.length > 1 ? 's' : ''} selected
                                </span>
                            )}
                            <button
                                onClick={handleAddNewStatements}
                                disabled={isAddingStatements || newStatementFiles.length === 0}
                                className="px-4 py-2 bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-widest rounded-xl shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
                            >
                                {isAddingStatements ? (
                                    <>
                                        <span className="w-3 h-3 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="w-3.5 h-3.5" />
                                        Add to Categorisation
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground/80">
                        Note: Excel statements are still best uploaded from the main &quot;Upload Bank Statements&quot; step. PDFs and images are fully supported here.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <ResultsStatCard
                        label="Opening Balance"
                        value={!isSingleFileMode ? (
                            `${formatNumber(aggregatedOpening)} AED`
                        ) : (
                            <div className="flex items-center gap-1 group/input relative">
                                <input
                                    type="text"
                                    key={`opening-${activeSummary?.openingBalance}-${selectedCurrency}`}
                                    defaultValue={isMultiCurrency ? (activeSummary?.originalOpeningBalance?.toFixed(2) || '0.00') : (activeSummary?.openingBalance ? (activeSummary?.openingBalance).toFixed(2) : '0.00')}
                                    onBlur={(e) => handleBalanceEdit('opening', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleBalanceEdit('opening', (e.target as HTMLInputElement).value)}
                                    className="bg-card/40 border border-border/50 rounded px-2 py-0.5 w-full focus:outline-none focus:border-primary/50 text-primary/80 font-black font-mono transition-all pr-8"
                                />
                                <span className="absolute right-2 text-[9px] text-muted-foreground font-bold">{selectedCurrency}</span>
                            </div>
                        )}
                        color="text-primary/80"
                        icon={<ArrowUpRightIcon className="w-4 h-4" />}
                    />
                    <ResultsStatCard
                        label="Closing Balance"
                        value={!isSingleFileMode ? (
                            `${formatNumber(aggregatedClosing)} AED`
                        ) : (
                            <div className="flex items-center gap-1 group/input relative">
                                <input
                                    type="text"
                                    key={`closing-${activeSummary?.closingBalance}-${selectedCurrency}`}
                                    defaultValue={isMultiCurrency ? (activeSummary?.originalClosingBalance?.toFixed(2) || '0.00') : (activeSummary?.closingBalance ? (activeSummary?.closingBalance).toFixed(2) : '0.00')}
                                    onBlur={(e) => handleBalanceEdit('closing', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleBalanceEdit('closing', (e.target as HTMLInputElement).value)}
                                    className="bg-card/40 border border-border/50 rounded px-2 py-0.5 w-full focus:outline-none focus:border-primary/50 text-primary font-black font-mono transition-all pr-8"
                                />
                                <span className="absolute right-2 text-[9px] text-muted-foreground font-bold">{selectedCurrency}</span>
                            </div>
                        )}
                        color="text-primary"
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

                <div className="bg-card/60 backdrop-blur-xl rounded-2xl border border-border/50 p-3 mb-6 space-y-3">
                    {/* Top Row: Global Filters & Search */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-card/40 p-1 rounded-xl border border-border">
                            <div className="flex items-center gap-2 px-3 text-muted-foreground border-r border-border h-8">
                                <FunnelIcon className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Filters</span>
                            </div>
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search description..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 h-9 bg-transparent border-none text-sm text-foreground focus:outline-none w-48 sm:w-64 placeholder:text-muted-foreground font-medium"
                                />
                            </div>
                            <div className="w-px h-5 bg-muted/50"></div>
                            <CategoryDropdown
                                value={filterCategory}
                                onChange={(val) => handleCategorySelection(val, { type: 'filter' })}
                                customCategories={customCategories}
                                className="!h-9 border-none !bg-transparent min-w-[140px] text-xs"
                                showAllOption={true}
                            />
                            <div className="w-px h-5 bg-muted/50"></div>
                            <select
                                value={selectedFileFilter}
                                onChange={(e) => setSelectedFileFilter(e.target.value)}
                                className="h-9 px-3 bg-transparent border-none rounded-lg text-xs text-muted-foreground focus:outline-none focus:ring-0 max-w-[140px] cursor-pointer font-bold"
                            >
                                <option value="ALL">All Files</option>
                                {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>

                        {(searchTerm || filterCategory !== 'ALL' || selectedFileFilter !== 'ALL') && (
                            <button
                                onClick={() => { setSearchTerm(''); setFilterCategory('ALL'); setSelectedFileFilter('ALL'); }}
                                className="h-9 px-3 text-[10px] font-black text-rose-400 hover:bg-rose-400/10 rounded-xl transition-all uppercase tracking-widest"
                            >
                                Clear
                            </button>
                        )}

                        <div className="flex-1"></div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPreviewPanel(!showPreviewPanel)}
                                className={`h-9 px-4 flex items-center gap-2 rounded-xl text-[10px] font-black transition-all border uppercase tracking-widest ${showPreviewPanel ? 'bg-primary border-primary/50 text-primary-foreground shadow-lg shadow-primary/10' : 'bg-card/40 border-border text-muted-foreground hover:text-foreground hover:border-border'}`}
                            >
                                {showPreviewPanel ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                                {showPreviewPanel ? 'Hide' : 'Preview'}
                            </button>

                            <button
                                onClick={handleAutoCategorize}
                                disabled={isAutoCategorizing}
                                className={`h-9 px-5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-black rounded-xl flex items-center transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest border border-primary/20`}
                            >
                                <SparklesIcon className="w-4 h-4 mr-2 text-primary" />
                                {isAutoCategorizing ? 'Analyzing...' : 'Auto-Label'}
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Bulk Operations & Find/Replace */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
                        {/* Bulk Actions */}
                        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/40">
                            <div className="px-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border/40 h-7 flex items-center">
                                Bulk
                            </div>
                            <CategoryDropdown
                                value={bulkCategory}
                                onChange={(val) => handleCategorySelection(val, { type: 'bulk' })}
                                customCategories={customCategories}
                                className="!h-8 border-none !bg-transparent min-w-[140px] text-xs"
                            />
                            <button
                                onClick={handleBulkApplyCategory}
                                disabled={!bulkCategory || selectedIndices.size === 0}
                                className="h-7 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black rounded-lg transition-all disabled:opacity-30 shadow-lg  uppercase"
                            >
                                Apply
                            </button>
                            <button
                                onClick={handleBulkSwap}
                                disabled={selectedIndices.size === 0}
                                className="h-7 px-3 text-primary hover:bg-primary/10 text-[10px] font-black rounded-lg transition-all disabled:opacity-30 uppercase"
                            >
                                <ArrowsRightLeftIcon className="w-3.5 h-3.5 inline mr-1" />
                                Swap
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedIndices.size === 0}
                                className="h-7 px-3 text-rose-400 hover:bg-rose-400/10 text-[10px] font-black rounded-lg transition-all disabled:opacity-30 uppercase"
                            >
                                <TrashIcon className="w-3.5 h-3.5 inline mr-1" />
                                Delete ({selectedIndices.size})
                            </button>
                        </div>

                        {/* Find & Replace */}
                        <div className="flex items-center gap-2 bg-primary/5 p-1 rounded-xl border border-primary/10 ml-auto">
                            <div className="px-3 text-[10px] font-black text-primary/70 uppercase tracking-widest border-r border-primary/10 h-7 flex items-center">
                                Replace
                            </div>
                            <input
                                type="text"
                                placeholder="Find..."
                                value={findText}
                                onChange={(e) => setFindText(e.target.value)}
                                className="h-8 px-3 bg-transparent border-none text-xs text-foreground focus:outline-none w-28 placeholder:text-muted-foreground font-medium"
                            />
                            <ArrowRightIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <CategoryDropdown
                                value={replaceCategory}
                                onChange={(val) => handleCategorySelection(val, { type: 'replace' })}
                                customCategories={customCategories}
                                className="!h-8 border-none !bg-transparent min-w-[140px] text-xs"
                            />
                            <button
                                onClick={handleFindReplace}
                                disabled={!findText || !replaceCategory}
                                className="h-7 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black rounded-lg transition-all disabled:opacity-30 shadow-md uppercase"
                            >
                                Run
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 h-[600px] relative">
                    <div className="flex-1 overflow-auto bg-background/20 rounded-lg border border-border min-h-[400px]">
                        <table className="w-full text-sm text-left text-muted-foreground">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            checked={filteredTransactions.length > 0 && selectedIndices.size === filteredTransactions.length}
                                            className="rounded border-border bg-muted/80 text-primary focus:ring-primary"
                                        />
                                    </th>
                                    <th className="px-4 py-3 cursor-pointer hover:bg-muted/80/50 transition-colors group" onClick={() => handleSort('date')}>
                                        <div className="flex items-center gap-1">
                                            Date
                                            <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                                                {sortColumn === 'date' ? (
                                                    sortDirection === 'asc' ? <ChevronUpIcon className="w-3 h-3 text-primary" /> : <ChevronDownIcon className="w-3 h-3 text-primary" />
                                                ) : (
                                                    <ChevronDownIcon className="w-3 h-3 text-muted-foreground" />
                                                )}
                                            </div>
                                            {sortColumn === 'date' && (
                                                <span className="sr-only">Sorted {sortDirection}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Debit {isMultiCurrency && `(${selectedCurrency})`}</th>
                                    <th className="px-0 py-3 w-8"></th>
                                    <th className="px-4 py-3 text-right">Credit {isMultiCurrency && `(${selectedCurrency})`}</th>

                                    {selectedFileFilter !== 'ALL' && <th className="px-4 py-3 text-right">Running Balance {isMultiCurrency && `(${selectedCurrency})`}</th>}
                                    <th className="px-4 py-3">Currency</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((t) => {

                                    return (
                                        <tr key={t.originalIndex} className={`border-b border-border hover:bg-muted/50 ${selectedIndices.has(t.originalIndex) ? 'bg-primary/10' : ''}`}>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.has(t.originalIndex)}
                                                    onChange={(e) => handleSelectRow(t.originalIndex, e.target.checked)}
                                                    className="rounded border-border bg-muted/80 text-primary focus:ring-primary"
                                                />
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                                            <td className="px-4 py-2 text-foreground max-w-xs truncate" title={typeof t.description === 'string' ? t.description : JSON.stringify(t.description)}>
                                                {typeof t.description === 'string' ? t.description : JSON.stringify(t.description)}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {t.originalDebit !== undefined ? (
                                                    <span className="text-red-400 text-xs">{formatNumber(t.originalDebit)}</span>
                                                ) : (
                                                    <span className="text-red-400">{t.debit > 0 ? formatNumber(t.debit) : '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-0 py-2 text-center align-middle">
                                                <button
                                                    onClick={() => handleSwapDebitCredit(t.originalIndex)}
                                                    className="text-muted-foreground hover:text-primary transition-colors p-1 rounded hover:bg-muted"
                                                    title="Swap Debit/Credit"
                                                >
                                                    <ArrowsRightLeftIcon className="w-3 h-3" />
                                                </button>
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {t.originalCredit !== undefined ? (
                                                    <span className="text-green-400 text-xs">{formatNumber(t.originalCredit)}</span>
                                                ) : (
                                                    <span className="text-green-400">{t.credit > 0 ? formatNumber(t.credit) : '-'}</span>
                                                )}
                                            </td>

                                            {selectedFileFilter !== 'ALL' && (
                                                <td className="px-4 py-2 text-right font-mono text-primary/80">
                                                    {formatNumber(t.runningBalance)}
                                                </td>
                                            )}
                                            <td className="px-4 py-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest text-center">
                                                {isMultiCurrency ? selectedCurrency : (t.originalCurrency || t.currency || 'AED')}
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
                                                <button onClick={() => handleDeleteTransaction(t.originalIndex)} className="text-muted-foreground hover:text-red-400">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="text-center py-10 text-muted-foreground">No transactions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {showPreviewPanel && statementPreviewUrls.length > 0 && (
                        <div className="flex-1 min-w-0 bg-background/20 rounded-xl border border-border/50 flex flex-col h-full overflow-hidden shadow-2xl backdrop-blur-sm">
                            <div className="p-3 border-b border-border flex justify-between items-center bg-background">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bank Statement Preview</h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                                        disabled={previewPage === 0}
                                        className="p-1 hover:bg-muted rounded disabled:opacity-50 text-muted-foreground"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        {previewPage + 1} / {statementPreviewUrls.length}
                                    </span>
                                    <button
                                        onClick={() => setPreviewPage(Math.min(statementPreviewUrls.length - 1, previewPage + 1))}
                                        disabled={previewPage === statementPreviewUrls.length - 1}
                                        className="p-1 hover:bg-muted rounded disabled:opacity-50 text-muted-foreground"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowPreviewPanel(false)} className="mx-1 text-muted-foreground hover:text-foreground">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-card/50">
                                {statementPreviewUrls[previewPage] ? (
                                    <img
                                        src={statementPreviewUrls[previewPage]}
                                        alt={`Page ${previewPage + 1}`}
                                        className="max-w-full shadow-lg border border-border"
                                    />
                                ) : (
                                    <div className="text-muted-foreground text-xs flex flex-col items-center justify-center h-full">
                                        <DocumentTextIcon className="w-8 h-8 mb-2 opacity-20" />
                                        <span>No preview available</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                <div className="flex justify-between items-center bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-border/50 shadow-2xl mt-6">
                    <div className="text-sm text-muted-foreground font-medium italic">
                        <SparklesIcon className="w-4 h-4 inline mr-2 text-violet-400" />
                        <span className="text-foreground font-black">{editedTransactions.filter(t => !t.category || t.category.toLowerCase().includes('uncategorized')).length}</span> uncategorized items remaining.
                    </div>
                    <div className="flex gap-4">
                        <input
                            ref={importStep1InputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleStep1FileSelected}
                        />
                        <button onClick={handleImportStep1} className="h-[44px] px-6 bg-card/40 border border-border/50 text-muted-foreground hover:text-foreground hover:border-border font-black rounded-xl transition-all text-[10px] uppercase tracking-widest active:scale-95 shadow-lg">
                            Import Data
                        </button>
                        <button onClick={handleExportStep1} className="h-[44px] px-6 bg-card/40 border border-border/50 text-muted-foreground hover:text-foreground hover:border-border font-black rounded-xl transition-all text-[10px] uppercase tracking-widest active:scale-95 shadow-lg">
                            Download WIP
                        </button>
                        <button
                            onClick={() => {
                                const uncategorized = editedTransactions.filter(t => !t.category || t.category.toLowerCase().includes('uncategorized'));
                                if (uncategorized.length > 0) {
                                    setUncategorizedCount(uncategorized.length);
                                    setShowUncategorizedAlert(true);
                                    return;
                                }
                                handleConfirmCategories();
                            }}
                            disabled={editedTransactions.length === 0}
                            className="h-[44px] px-10 bg-primary hover:bg-primary/90 text-primary-foreground border border-primary/30 font-black rounded-xl shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:bg-muted disabled:text-muted-foreground disabled:border-border disabled:shadow-none disabled:opacity-60 disabled:translate-y-0 disabled:cursor-not-allowed text-[10px] uppercase tracking-[0.2em]"
                        >
                            Continue to Summarization
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep2Summarization = () => {
        const totalDebit = summaryData.reduce((sum, row) => sum + row.debit, 0);
        const totalCredit = summaryData.reduce((sum, row) => sum + row.credit, 0);
        const summaryCurrency = summaryFileFilter === 'ALL' ? 'AED' : (statementReconciliationData.find(r => r.fileName === summaryFileFilter)?.currency || 'AED');

        return (
            <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-foreground">Transaction Summary</h3>
                        <div className="flex items-center gap-3">
                            <select
                                value={summaryFileFilter}
                                onChange={(e) => setSummaryFileFilter(e.target.value)}
                                className="bg-muted border border-border rounded text-sm text-foreground px-3 py-1.5 focus:outline-none"
                            >
                                <option value="ALL">All Files</option>
                                {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleExportStepSummary(summaryData);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    {/* Summarized View */}
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm text-left text-muted-foreground">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted">
                                <tr>
                                    <th className="px-6 py-3">Accounts</th>
                                    <th className="px-6 py-3 text-right">Debit {summaryFileFilter !== 'ALL' ? `(${summaryCurrency})` : '(AED)'}</th>
                                    <th className="px-6 py-3 text-right">Credit {summaryFileFilter !== 'ALL' ? `(${summaryCurrency})` : '(AED)'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {summaryData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-muted/50">
                                        <td className="px-6 py-3 text-foreground font-medium">{row.category}</td>
                                        <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(row.debit)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(row.credit)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-muted/80 font-bold border-t border-border">
                                <tr>
                                    <td className="px-6 py-3 text-foreground uppercase tracking-wider">
                                        {summaryFileFilter === 'ALL' ? 'Grand Total in AED' : 'Grand Total'}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(totalDebit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(totalCredit)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Bank Account Reconciliation Section */}
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <h3 className="text-xl font-bold text-foreground mb-6">Bank Account Reconciliation</h3>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm text-left text-muted-foreground">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted">
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
                            <tbody className="divide-y divide-border">
                                {statementReconciliationData.map((recon, idx) => {
                                    const isAllFiles = summaryFileFilter === 'ALL';
                                    const showDual = isAllFiles && recon.hasConversion;

                                    return (
                                        <tr key={idx} className="hover:bg-muted/50">
                                            <td className="px-6 py-3 text-foreground font-medium truncate max-w-xs" title={recon.fileName}>{recon.fileName}</td>
                                            <td className="px-6 py-3 text-right font-mono text-primary/70">
                                                <div className="flex flex-col items-end">
                                                    <input
                                                        type="text"
                                                        defaultValue={recon.openingBalance?.toFixed(2) || '0.00'}
                                                        onBlur={(e) => {
                                                            const targetFile = recon.fileName;
                                                            const val = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                                                            setManualBalances(prev => ({
                                                                ...prev,
                                                                [targetFile]: { ...prev[targetFile], opening: val }
                                                            }));
                                                        }}
                                                        className="bg-transparent border-b border-border text-primary/70 text-right w-24 focus:outline-none focus:border-primary/50"
                                                    />
                                                    {showDual && <span className="text-[10px] text-muted-foreground">({formatNumber(recon.openingBalanceAed)} AED)</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-red-400">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.totalDebit)} {recon.currency}</span>
                                                    {showDual && <span className="text-[10px] text-muted-foreground">({formatNumber(recon.totalDebitAed)} AED)</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-green-400">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.totalCredit)} {recon.currency}</span>
                                                    {showDual && <span className="text-[10px] text-muted-foreground">({formatNumber(recon.totalCreditAed)} AED)</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-primary/80 font-bold">
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.calculatedClosing)} {recon.currency}</span>
                                                    {showDual && <span className="text-[10px] text-muted-foreground">({formatNumber(recon.calculatedClosingAed)} AED)</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-right font-mono text-foreground">
                                                <div className="flex flex-col items-end">
                                                    <input
                                                        type="text"
                                                        defaultValue={recon.closingBalance?.toFixed(2) || '0.00'}
                                                        onBlur={(e) => {
                                                            const targetFile = recon.fileName;
                                                            const val = parseFloat(e.target.value.replace(/[^0-9.-]/g, '')) || 0;
                                                            setManualBalances(prev => ({
                                                                ...prev,
                                                                [targetFile]: { ...prev[targetFile], closing: val }
                                                            }));
                                                        }}
                                                        className="bg-transparent border-b border-border text-foreground text-right w-24 focus:outline-none focus:border-primary/50"
                                                    />
                                                    {showDual && <span className="text-[10px] text-muted-foreground">({formatNumber(recon.closingBalanceAed)} AED)</span>}
                                                </div>
                                            </td>
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
                                            <td className="px-6 py-3 text-center">
                                                <span className="text-[10px] text-muted-foreground">{recon.currency}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-primary/10 font-bold border-t-2 border-blue-800/50">
                                {summaryFileFilter === 'ALL' && statementReconciliationData.length > 1 && (() => {
                                    // Calculate Totals by explicitly summing the AED columns of individual rows
                                    const totalOpeningAed = statementReconciliationData.reduce((sum, r) => sum + (Number(r.openingBalanceAed) || 0), 0);
                                    const totalDebitAedSum = statementReconciliationData.reduce((sum, r) => sum + (Number(r.totalDebitAed) || 0), 0);
                                    const totalCreditAedSum = statementReconciliationData.reduce((sum, r) => sum + (Number(r.totalCreditAed) || 0), 0);
                                    const totalCalculatedClosingAed = statementReconciliationData.reduce((sum, r) => sum + (Number(r.calculatedClosingAed) || 0), 0);
                                    const totalActualClosingAed = statementReconciliationData.reduce((sum, r) => sum + (Number(r.closingBalanceAed) || 0), 0);
                                    const isAllBalanced = statementReconciliationData.every(r => r.isValid);

                                    return (
                                        <tr>
                                            <td className="px-6 py-4 text-primary/80 uppercase tracking-wider">Grand Total in AED</td>
                                            <td className="px-6 py-4 text-right font-mono text-primary/70">{formatNumber(totalOpeningAed)}</td>
                                            <td className="px-6 py-4 text-right font-mono text-red-400">{formatNumber(totalDebitAedSum)}</td>
                                            <td className="px-6 py-4 text-right font-mono text-green-400">{formatNumber(totalCreditAedSum)}</td>
                                            <td className="px-6 py-4 text-right font-mono text-primary/80 shadow-inner">{formatNumber(totalCalculatedClosingAed)}</td>
                                            <td className="px-6 py-4 text-right font-mono text-foreground">{formatNumber(totalActualClosingAed)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex justify-center">
                                                    {isAllBalanced ? (
                                                        <CheckIcon className="w-6 h-6 text-green-500" />
                                                    ) : (
                                                        <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-xs text-muted-foreground">AED</td>
                                        </tr>
                                    );
                                })()}
                            </tfoot>
                        </table>
                    </div>
                    <p className="mt-4 text-xs text-muted-foreground italic flex items-center">
                        <InformationCircleIcon className="w-3 h-3 mr-1" />
                        Formula: Opening Balance - Total Debit + Total Credit = Closing Balance
                    </p>
                </div>

                <div className="flex justify-between pt-4">
                    <button onClick={handleBack} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground font-medium transition-colors">Back</button>
                    <button onClick={handleConfirmSummarization} className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-lg">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        );
    };

    const renderStep3UploadInvoices = () => {
        if (isProcessingInvoices) {
            return (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-foreground">Upload Invoices & Bills</h2>
                    <p className="text-muted-foreground">Upload your sales and purchase invoices for extraction and reconciliation.</p>
                    <div className="min-h-[420px] rounded-2xl border border-border bg-card/30 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
                        <LoadingIndicator
                            progress={progress || 60}
                            statusText={progressMessage || "Analyzing invoices..."}
                            title="Analyzing Your Document..."
                        />
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-foreground">Upload Invoices & Bills</h2>
                <p className="text-muted-foreground">Upload your sales and purchase invoices for extraction and reconciliation.</p>
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
                            onClick={() => {
                                if (!onProcess) return;
                                setIsProcessingInvoices(true);
                                Promise.resolve(onProcess('invoices'))
                                    .then(() => {
                                        setHasProcessedInvoices(true);
                                        // Step 3 Persistence
                                        handleSaveStep(3);
                                        setCurrentStep(4);
                                    })
                                    .catch((err) => {
                                        console.error("Invoice extraction failed:", err);
                                        alert("Invoice extraction failed. Please try again.");
                                    })
                                    .finally(() => setIsProcessingInvoices(false));
                            }}
                            className="flex items-center px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                        >
                            <SparklesIcon className="w-5 h-5 mr-2" />
                            Extract & Continue
                        </button>
                    </div>
                )}

                <div className="flex justify-between pt-4">
                    <button onClick={handleBack} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground font-medium transition-colors">Back</button>
                </div>
            </div>
        );
    };

    const renderStep4InvoiceSummarization = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Invoice Summarization</h2>
            <p className="text-muted-foreground">Review the extracted sales and purchase invoices.</p>
            <InvoiceSummarizationView
                salesInvoices={salesInvoices}
                purchaseInvoices={purchaseInvoices}
                currency={currency}
                companyName={companyName || company?.name || ''}
                companyTrn={companyTrn || company?.trn}
                onSalesInvoicesChange={onUpdateSalesInvoices}
                onPurchaseInvoicesChange={onUpdatePurchaseInvoices}
            />
            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground font-medium transition-colors">Back</button>
                <div className="flex gap-4">
                    <button
                        onClick={handleImportStep4Invoices}
                        className="flex items-center px-4 py-2 bg-background/5 hover:bg-background/10 text-foreground font-bold rounded-lg border border-white/10 transition-all text-sm"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-primary rotate-180" />
                        Import Step 4
                    </button>
                    <input
                        ref={importStep4InputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={handleStep4FileSelected}
                    />
                    <button
                        onClick={handleExportStep4Invoices}
                        className="flex items-center px-4 py-2 bg-background/5 hover:bg-background/10 text-foreground font-bold rounded-lg border border-white/10 transition-all text-sm"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-primary" />
                        Export Step 4
                    </button>
                    <button onClick={handleContinueToReconciliation} className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-lg">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );



    const handleImportStep4Invoices = () => {
        importStep4InputRef.current?.click();
    };

    const handleStep4FileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const parseNumber = (value: any) => {
            if (value === undefined || value === null) return 0;
            const cleaned = String(value).replace(/,/g, '').trim();
            const num = Number(cleaned);
            return Number.isNaN(num) ? 0 : num;
        };

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0]; // Assuming first sheet is the one
            const worksheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }); // Read as array of arrays

            // Parse Sales Invoices
            const salesStartRowIndex = rows.findIndex(row => row && row[0] === 'SALES INVOICES');
            const purchaseStartRowIndex = rows.findIndex(row => row && row[0] === 'PURCHASE INVOICES');

            if (salesStartRowIndex !== -1 && onUpdateSalesInvoices) {
                // Headers are at salesStartRowIndex + 1
                // Data starts at salesStartRowIndex + 2
                // Ends at purchaseStartRowIndex (if exists) or end of file
                const dataStartIndex = salesStartRowIndex + 2;
                const dataEndIndex = purchaseStartRowIndex !== -1 ? purchaseStartRowIndex : rows.length;

                const salesRows = rows.slice(dataStartIndex, dataEndIndex).filter(row => row && row.length > 0 && (row[0] || row[1])); // Basic validation

                const mappedSales = salesRows.map((row: any) => {
                    // Headers: "Invoice #", "Customer", "Date", "Payment Status", "Payment Mode", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"
                    // Indices:      0           1         2              3               4             5             6             7
                    const preTax = parseNumber(row[5]);
                    const vat = parseNumber(row[6]);
                    const total = parseNumber(row[7]);

                    return {
                        invoiceId: String(row[0] || ''),
                        customerName: String(row[1] || ''),
                        invoiceDate: String(row[2] || ''), // Ideally parse date if needed, but existing logic might handle strings
                        paymentStatus: String(row[3] || ''),
                        paymentMode: String(row[4] || ''),
                        status: String(row[3] || ''),
                        totalBeforeTaxAED: preTax,
                        totalTaxAED: vat,
                        totalAmountAED: total,
                        // Defaults for other required fields
                        currency: 'AED',
                        lineItems: [],
                        invoiceType: 'sales' as const,
                        totalAmount: total,
                        totalBeforeTax: preTax,
                        totalTax: vat,
                        vendorName: '',
                        dueDate: ''
                    } as Invoice;
                });
                onUpdateSalesInvoices(mappedSales);
            }

            if (purchaseStartRowIndex !== -1 && onUpdatePurchaseInvoices) {
                const dataStartIndex = purchaseStartRowIndex + 2;
                const dataEndIndex = rows.length;
                const purchaseRows = rows.slice(dataStartIndex, dataEndIndex).filter(row => row && row.length > 0 && (row[0] || row[1]));

                const mappedPurchases = purchaseRows.map((row: any) => {
                    // Headers: "Invoice #", "Supplier", "Date", "Payment Status", "Payment Mode", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"
                    const preTax = parseNumber(row[5]);
                    const vat = parseNumber(row[6]);
                    const total = parseNumber(row[7]);

                    return {
                        invoiceId: String(row[0] || ''),
                        vendorName: String(row[1] || ''),
                        invoiceDate: String(row[2] || ''),
                        paymentStatus: String(row[3] || ''),
                        paymentMode: String(row[4] || ''),
                        status: String(row[3] || ''),
                        totalBeforeTaxAED: preTax,
                        totalTaxAED: vat,
                        totalAmountAED: total,
                        // Defaults
                        currency: 'AED',
                        lineItems: [],
                        invoiceType: 'purchase' as const,
                        totalAmount: total,
                        totalBeforeTax: preTax,
                        totalTax: vat,
                        customerName: '',
                        dueDate: ''
                    } as Invoice;
                });
                onUpdatePurchaseInvoices(mappedPurchases);
            }
            alert("Invoices imported successfully!");

        } catch (error) {
            console.error('Failed to import invoices:', error);
            alert("Failed to import invoices. Please check the file format.");
        } finally {
            if (event.target) event.target.value = '';
        }
    };

    const importStep5InputRef = useRef<HTMLInputElement>(null);

    const handleExportStep5Reconciliation = useCallback(() => {
        // Export Matched Data
        const wsData: any[] = [];

        // Combine all transactions and find their matched invoices (if logic exists in ReconciliationTable, we approximate here or just export raw data)
        // Since Reconciliation logic is inside the component, we'll export the raw lists which can be re-imported.
        // Actually, let's export the Transactions with their current details, which covers the User Request "Upload ... make necessary changes or add new lines"

        editedTransactions.forEach(t => {
            wsData.push({
                Type: 'Transaction',
                ID: t.originalIndex,
                Date: formatDate(t.date),
                Description: typeof t.description === 'object' ? JSON.stringify(t.description) : t.description,
                Debit: t.debit || 0,
                Credit: t.credit || 0,
                Currency: t.currency,
                Category: t.category,
                "Source File": t.sourceFile
            });
        });

        // Also export Invoices
        allInvoicesForReconciliation.forEach(inv => {
            wsData.push({
                Type: 'Invoice',
                ID: inv.invoiceId,
                Date: inv.invoiceDate,
                Description: inv.customerName || inv.vendorName,
                Debit: inv.invoiceType === 'purchase' ? inv.totalAmount : 0,
                Credit: inv.invoiceType === 'sales' ? inv.totalAmount : 0,
                Currency: inv.currency,
                Category: inv.invoiceType === 'sales' ? 'Sales' : 'Purchases',
                "Source File": "Invoices"
            });
        });

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Reconciliation Data");
        XLSX.writeFile(wb, `${companyName}_Reconciliation_Step5.xlsx`);
    }, [editedTransactions, allInvoicesForReconciliation, companyName]);

    const handleImportStep5Reconciliation = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets["Reconciliation Data"] || workbook.Sheets[workbook.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);

            let newTransactions: Transaction[] = [...editedTransactions];
            let newSalesInvoices: Invoice[] = [...salesInvoices];
            let newPurchaseInvoices: Invoice[] = [...purchaseInvoices];
            let counts = { tx: 0, sales: 0, purchases: 0 };

            rows.forEach((row: any) => {
                if (row.Type === 'Transaction') {
                    // Update or Add Transaction
                    const idx = typeof row.ID === 'number' ? row.ID : -1;
                    const tx: Transaction = {
                        date: row.Date,
                        description: row.Description,
                        debit: Number(row.Debit) || 0,
                        credit: Number(row.Credit) || 0,
                        currency: row.Currency || 'AED',
                        category: row.Category,
                        sourceFile: row["Source File"],
                        originalIndex: idx >= 0 ? idx : newTransactions.length,
                        balance: 0, // Recalculated later
                        confidence: 100
                    };

                    if (idx >= 0 && idx < newTransactions.length) {
                        newTransactions[idx] = { ...newTransactions[idx], ...tx };
                    } else {
                        newTransactions.push(tx);
                    }
                    counts.tx++;
                } else if (row.Type === 'Invoice') {
                    // We generally don't update invoices here but if user added one:
                    const isSales = row.Credit > 0; // Simplified assumption
                    const inv: Invoice = {
                        invoiceId: String(row.ID),
                        invoiceDate: row.Date,
                        customerName: isSales ? row.Description : '',
                        vendorName: !isSales ? row.Description : '',
                        totalAmount: Math.max(Number(row.Debit), Number(row.Credit)),
                        invoiceType: isSales ? 'sales' : 'purchase',
                        currency: row.Currency || 'AED',
                        status: 'Extracted',
                        // Defaults
                        totalBeforeTax: Math.max(Number(row.Debit), Number(row.Credit)),
                        totalTax: 0,
                        lineItems: []
                    };

                    if (isSales) {
                        const existingIdx = newSalesInvoices.findIndex(i => i.invoiceId === inv.invoiceId);
                        if (existingIdx >= 0) newSalesInvoices[existingIdx] = { ...newSalesInvoices[existingIdx], ...inv };
                        else newSalesInvoices.push(inv);
                        counts.sales++;
                    } else {
                        const existingIdx = newPurchaseInvoices.findIndex(i => i.invoiceId === inv.invoiceId);
                        if (existingIdx >= 0) newPurchaseInvoices[existingIdx] = { ...newPurchaseInvoices[existingIdx], ...inv };
                        else newPurchaseInvoices.push(inv);
                        counts.purchases++;
                    }
                }
            });

            setEditedTransactions(newTransactions);
            if (onUpdateSalesInvoices) onUpdateSalesInvoices(newSalesInvoices);
            if (onUpdatePurchaseInvoices) onUpdatePurchaseInvoices(newPurchaseInvoices);

            alert(`Import Successful!\nUpdated/Added:\nTransactions: ${counts.tx}\nSales Invoices: ${counts.sales}\nPurchase Invoices: ${counts.purchases}`);

        } catch (error) {
            console.error('Import Step 5 failed', error);
            alert("Failed to import reconciliation data.");
        } finally {
            if (event.target) event.target.value = '';
        }
    };

    const renderStep5BankReconciliation = () => (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-foreground">Bank Reconciliation</h2>
            <p className="text-muted-foreground">Match extracted invoices against bank statement transactions.</p>
            <ReconciliationTable
                invoices={allInvoicesForReconciliation}
                transactions={editedTransactions}
                currency={currency}
                initialMatches={manualInvoiceMatches}
                onMatchesChange={setManualInvoiceMatches}
            />
            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground font-medium transition-colors">Back</button>
                <div className="flex gap-4">
                    <div className="flex gap-2">
                        <input
                            ref={importStep5InputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleImportStep5Reconciliation}
                        />
                        <button
                            onClick={() => importStep5InputRef.current?.click()}
                            className="flex items-center px-4 py-2 bg-background/5 hover:bg-background/10 text-foreground font-bold rounded-lg border border-white/10 transition-all text-sm"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-green-400 rotate-180" />
                            Import
                        </button>
                        <button
                            onClick={handleExportStep5Reconciliation}
                            className="flex items-center px-4 py-2 bg-background/5 hover:bg-background/10 text-foreground font-bold rounded-lg border border-white/10 transition-all text-sm"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-primary" />
                            Export Step 5
                        </button>
                    </div>
                    <button onClick={handleReconContinue} className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-lg">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );


    const renderStep6VatAdditionalDocs = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-border bg-background/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-primary/50/30 shadow-lg shadow-blue-500/5">
                            <DocumentTextIcon className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground tracking-tight">VAT Docs Upload</h3>
                            <p className="text-muted-foreground mt-1 max-w-2xl">Upload relevant VAT certificates (VAT 201), sales/purchase ledgers, or other supporting documents.</p>
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
                    className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExtractAdditionalData}
                        disabled={isExtracting}
                        className="flex items-center px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-xl shadow-primary/10 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExtracting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-primary-foreground rounded-full animate-spin mr-3"></div>
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

    const renderStep7VatSummarization = () => {
        const { periods, grandTotals } = vatStepData;

        const renderEditableCell = (periodId: string, field: string, value: number) => {
            const displayValue = vatManualAdjustments[periodId]?.[field] ?? (value === 0 ? '' : value.toString());
            return (
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => handleVatAdjustmentChange(periodId, field, e.target.value)}
                    className="w-full bg-transparent text-right outline-none focus:bg-background/10 px-2 py-1 rounded transition-colors font-mono"
                    placeholder="0.00"
                />
            );
        };

        const reconciliationData = [
            {
                label: 'Standard Rated Supplies (Sales)',
                certAmount: vatCertificateTotals.salesAmount,
                invoiceAmount: invoiceTotals.salesAmount,
                certVat: vatCertificateTotals.salesVat,
                invoiceVat: invoiceTotals.salesVat,
                icon: ArrowUpRightIcon,
                color: 'text-green-400'
            },
            {
                label: 'Standard Rated Expenses (Purchases)',
                certAmount: vatCertificateTotals.purchaseAmount,
                invoiceAmount: invoiceTotals.purchaseAmount,
                certVat: vatCertificateTotals.purchaseVat,
                invoiceVat: invoiceTotals.purchaseVat,
                icon: ArrowDownIcon,
                color: 'text-red-400'
            }
        ];

        const isMatch = (val1: number, val2: number) => Math.abs(val1 - val2) < 2;

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-border bg-background/50 flex justify-between items-center">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/5">
                                <ChartBarIcon className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground tracking-tight">VAT Summarization & Reconciliation</h3>
                                <p className="text-muted-foreground mt-1">Comparing VAT 201 figures with extracted Invoice totals.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-10">
                        {/* VAT 201 Summary */}
                        <div className="max-w-6xl mx-auto space-y-8">
                            <div className="bg-background rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                                <div className="px-8 py-5 border-b border-border bg-primary/10 flex justify-between items-center">
                                    <h4 className="text-sm font-black text-primary/80 uppercase tracking-[0.2em]">Sales (Outputs) - As per FTA</h4>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Figures in AED</span>
                                </div>
                                <div className="p-2 overflow-x-auto">
                                    <table className="w-full text-center">
                                        <thead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="py-4 px-4 text-left">Period</th>
                                                <th className="py-4 px-4 text-right">Zero Rated</th>
                                                <th className="py-4 px-4 text-right">Standard Rated</th>
                                                <th className="py-4 px-4 text-right text-primary">VAT Amount</th>
                                                <th className="py-4 px-4 text-right bg-primary/20/5 text-primary/70">Total Sales</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-foreground/80 text-xs font-mono">
                                            {periods.map((p: any) => {
                                                const data = p.sales;
                                                const dateRange = getVatPeriodLabel(p.periodFrom, p.periodTo, p.fileName);

                                                return (
                                                    <tr key={p.id} className="border-b border-border/40 hover:bg-background/5 transition-colors group">
                                                        <td className="py-4 px-4 text-left">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-black text-foreground text-[10px] tracking-tight">{dateRange}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'salesZero', data.zero)}</td>
                                                        <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'salesTv', data.tv)}</td>
                                                        <td className="py-4 px-4 text-right text-primary">{renderEditableCell(p.id, 'salesVat', data.vat)}</td>
                                                        <td className="py-4 px-4 text-right font-black bg-muted/30 text-blue-100">{formatNumber(data.total)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="bg-primary/20/20 font-bold border-t-2 border-border">
                                                <td className="py-5 px-4 text-left font-black text-primary/80 text-[10px] uppercase italic">Sales Total</td>
                                                <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatNumber(grandTotals.sales.zero)}</td>
                                                <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatNumber(grandTotals.sales.tv)}</td>
                                                <td className="py-5 px-4 text-right text-primary">{formatNumber(grandTotals.sales.vat)}</td>
                                                <td className="py-5 px-4 text-right text-foreground text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatNumber(grandTotals.sales.total)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-background rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                                <div className="px-8 py-5 border-b border-border bg-muted/30 flex justify-between items-center">
                                    <h4 className="text-sm font-black text-foreground uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Figures in AED</span>
                                </div>
                                <div className="p-2 overflow-x-auto">
                                    <table className="w-full text-center">
                                        <thead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                                            <tr>
                                                <th className="py-4 px-4 text-left">Period</th>
                                                <th className="py-4 px-4 text-right">Zero Rated</th>
                                                <th className="py-4 px-4 text-right">Standard Rated</th>
                                                <th className="py-4 px-4 text-right text-primary">VAT Amount</th>
                                                <th className="py-4 px-4 text-right bg-muted/10 text-foreground">Total Purchases</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-foreground/80 text-xs font-mono">
                                            {periods.map((p: any) => {
                                                const data = p.purchases;
                                                const dateRange = getVatPeriodLabel(p.periodFrom, p.periodTo, p.fileName);

                                                return (
                                                    <tr key={p.id} className="border-b border-border/40 hover:bg-background/5 transition-colors group">
                                                        <td className="py-4 px-4 text-left">
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="font-black text-foreground text-[10px] tracking-tight">{dateRange}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'purchasesZero', data.zero)}</td>
                                                        <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'purchasesTv', data.tv)}</td>
                                                        <td className="py-4 px-4 text-right text-primary">{renderEditableCell(p.id, 'purchasesVat', data.vat)}</td>
                                                        <td className="py-4 px-4 text-right font-black bg-muted/20 text-foreground">{formatNumber(data.total)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr className="bg-muted/40 font-bold border-t-2 border-border">
                                                <td className="py-5 px-4 text-left font-black text-foreground text-[10px] uppercase italic">Purchases Total</td>
                                                <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatNumber(grandTotals.purchases.zero)}</td>
                                                <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatNumber(grandTotals.purchases.tv)}</td>
                                                <td className="py-5 px-4 text-right text-primary">{formatNumber(grandTotals.purchases.vat)}</td>
                                                <td className="py-5 px-4 text-right text-foreground text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatNumber(grandTotals.purchases.total)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="max-w-2xl mx-auto">
                                <div className={`rounded-3xl border-2 p-8 flex flex-col items-center justify-center transition-all ${grandTotals.net >= 0 ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-rose-900/10 border-rose-500/30'}`}>
                                    <span className={`text-xs font-black uppercase tracking-[0.3em] mb-4 ${grandTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Total VAT Liability / (Refund)</span>
                                    <div className="flex items-baseline gap-3">
                                        <span className="text-5xl font-mono font-black text-foreground tracking-tighter">{formatNumber(grandTotals.net)}</span>
                                        <span className={`text-sm font-bold uppercase tracking-widest ${grandTotals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>AED</span>
                                    </div>
                                    <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-background/40 rounded-full border border-white/5">
                                        <InformationCircleIcon className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Calculated as (Total Sales VAT - Total Purchase VAT)</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Comparison Table */}
                        <div className="overflow-hidden rounded-2xl border border-border bg-background/30">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-background border-b border-border">
                                        <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest">Description</th>
                                        <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest text-right">VAT 201</th>
                                        <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest text-right">Invoice Sum</th>
                                        <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest text-center text-right">Difference</th>
                                        <th className="p-5 text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {reconciliationData.map((item, idx) => {
                                        const amountDiff = item.certAmount - item.invoiceAmount;
                                        const vatDiff = item.certVat - item.invoiceVat;
                                        const amountMatched = isMatch(item.certAmount, item.invoiceAmount);
                                        const vatMatched = isMatch(item.certVat, item.invoiceVat);

                                        return (
                                            <React.Fragment key={idx}>
                                                <tr className="hover:bg-muted/30 transition-colors">
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-3">
                                                            <item.icon className={`w-5 h-5 ${item.color}`} />
                                                            <div>
                                                                <p className="text-sm font-bold text-foreground">{item.label}</p>
                                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Net Amount</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-foreground">
                                                        {formatNumber(item.certAmount)}
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-foreground/80">
                                                        {formatNumber(item.invoiceAmount)}
                                                    </td>
                                                    <td className={`p-5 text-right font-mono text-sm ${amountMatched ? 'text-muted-foreground' : 'text-orange-400'}`}>
                                                        {formatNumber(Math.abs(amountDiff))}
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        {amountMatched ? (
                                                            <div className="flex items-center justify-center text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mx-auto w-fit">
                                                                <CheckIcon className="w-3 h-3 mr-1" /> Matched
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mx-auto w-fit">
                                                                <ExclamationTriangleIcon className="w-3 h-3 mr-1" /> Discrepancy
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                <tr className="hover:bg-muted/30 transition-colors bg-background/10">
                                                    <td className="p-5 pl-12">
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">VAT (5%)</p>
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-foreground">
                                                        {formatNumber(item.certVat)}
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-foreground/80">
                                                        {formatNumber(item.invoiceVat)}
                                                    </td>
                                                    <td className={`p-5 text-right font-mono text-sm ${vatMatched ? 'text-muted-foreground' : 'text-orange-400'}`}>
                                                        {formatNumber(Math.abs(vatDiff))}
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        {vatMatched ? (
                                                            <div className="w-2 h-2 rounded-full bg-green-400 mx-auto ring-4 ring-green-400/10"></div>
                                                        ) : (
                                                            <div className="w-2 h-2 rounded-full bg-orange-400 mx-auto ring-4 ring-orange-400/10"></div>
                                                        )}
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-background rounded-2xl p-6 border border-border relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                                    <ChartBarIcon className="w-24 h-24 text-foreground" />
                                </div>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                    VAT 201 Summary
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-background/20 p-4 rounded-xl border border-border/50">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Total Supplies</p>
                                        <p className="text-xl font-mono text-foreground">{formatNumber(vatCertificateTotals.salesAmount)}</p>
                                    </div>
                                    <div className="bg-background/20 p-4 rounded-xl border border-border/50">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Total Expenses</p>
                                        <p className="text-xl font-mono text-foreground">{formatNumber(vatCertificateTotals.purchaseAmount)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-background rounded-2xl p-6 border border-border relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                                    <DocumentTextIcon className="w-24 h-24 text-foreground" />
                                </div>
                                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center">
                                    <span className="w-2 h-2 bg-primary/80 rounded-full mr-2"></span>
                                    Invoice Calculation Sum
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-background/20 p-4 rounded-xl border border-border/50">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Sales Sum</p>
                                        <p className="text-xl font-mono text-foreground">{formatNumber(invoiceTotals.salesAmount)}</p>
                                    </div>
                                    <div className="bg-background/20 p-4 rounded-xl border border-border/50">
                                        <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">Purchase Sum</p>
                                        <p className="text-xl font-mono text-foreground">{formatNumber(invoiceTotals.purchaseAmount)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                    >
                        <ChevronLeftIcon className="w-5 h-5 mr-2" />
                        Back
                    </button>
                    <div className="flex gap-4">
                        <input
                            ref={importStep7InputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={handleStep7FileSelected}
                        />
                        <button
                            onClick={handleImportStep7VAT}
                            className="flex items-center px-6 py-3 bg-background/5 hover:bg-background/10 text-foreground font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-green-400 rotate-180 group-hover:scale-110 transition-transform" />
                            Import VAT
                        </button>
                        <button
                            onClick={handleExportStep7VAT}
                            className="flex items-center px-6 py-3 bg-background/5 hover:bg-background/10 text-foreground font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                        >
                            <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-primary group-hover:scale-110 transition-transform" />
                            Export Step 7
                        </button>
                        <button
                            onClick={handleContinueToOpeningBalances}
                            className="flex items-center px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-xl shadow-primary/10 transform hover:-translate-y-0.5 transition-all"
                        >
                            Confirm & Continue
                            <ChevronRightIcon className="w-5 h-5 ml-2" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };
    const renderStep8OpeningBalances = () => {
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

        // Use openingBalancesData instead of adjustedTrialBalance
        if (openingBalancesData) {
            openingBalancesData.forEach(entry => {
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
                    currentSection.items.push({ ...item, ...vals });
                    currentSection.totalDebit += vals.debit;
                    currentSection.totalCredit += vals.credit;
                }
            }
        });
        if (currentSection) sections.push(currentSection);

        // Filter out totals (should not be in openingBalancesData usually, but for safety)
        const obExclTotals = (openingBalancesData || []).filter(item => item.account.toLowerCase() !== 'totals');

        obExclTotals.forEach(entry => {
            if (buckets[entry.account]?.isCustom) {
                let targetSectionTitle = 'Expenses';
                for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
                    if (Array.isArray(details)) {
                        if (details.includes(entry.account)) { targetSectionTitle = mainCat; break; }
                    } else {
                        for (const [subGroup, accounts] of Object.entries(details)) {
                            if ((accounts as string[]).includes(entry.account)) { targetSectionTitle = mainCat; break; }
                        }
                    }
                }
                if (targetSectionTitle === 'Revenues') targetSectionTitle = 'Income';

                const targetSection = sections.find(s => s.title === targetSectionTitle);
                if (targetSection) {
                    // Add only if not already in fixed structure and is custom
                    if (!targetSection.items.some((item: { label: string; }) => item.label === entry.account)) {
                        targetSection.items.push({ type: 'row', label: entry.account, debit: entry.debit, credit: entry.credit, isCustom: true });
                        targetSection.totalDebit += entry.debit;
                        targetSection.totalCredit += entry.credit;
                    }
                }
            }
        });

        const grandTotal = sections.reduce((acc, curr) => ({ debit: acc.debit + curr.totalDebit, credit: acc.credit + curr.totalCredit }), { debit: 0, credit: 0 });
        const roundedGrandTotal = {
            debit: roundAmount(grandTotal.debit),
            credit: roundAmount(grandTotal.credit),
        };
        const variance = roundedGrandTotal.debit - roundedGrandTotal.credit;


        return (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="p-6 bg-background border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-primary uppercase tracking-widest">Opening Balances</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={obFileInputRef} className="hidden" onChange={(e) => {
                            if (e.target.files) setOpeningBalanceFiles(Array.from(e.target.files));
                        }} accept="image/*,.pdf" multiple />
                        <input
                            type="file"
                            ref={obExcelInputRef}
                            className="hidden"
                            onChange={handleOpeningBalanceExcelImport}
                            accept=".xls,.xlsx"
                        />
                        <button onClick={() => obFileInputRef.current?.click()} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md">
                            <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Upload
                        </button>
                        <button
                            onClick={() => obExcelInputRef.current?.click()}
                            disabled={isExtractingOpeningBalances}
                            className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md disabled:opacity-50"
                        >
                            <UploadIcon className="w-5 h-5 mr-1.5" /> Import Excel
                        </button>
                        <button onClick={() => {
                            setNewGlobalAccountName('');
                            setShowGlobalAddAccountModal(true);
                        }} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-all shadow-md">
                            <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                        </button>
                    </div>
                </div>

                {isExtractingOpeningBalances && <div className="p-10 border-b border-border bg-background/40"><LoadingIndicator progress={60} statusText="Gemini AI is reading your documents..." /></div>}

                {openingBalanceFiles.length > 0 && (
                    <div className="p-4 bg-muted/30 flex flex-wrap gap-2 border-b border-border/50">
                        {openingBalanceFiles.map((f, i) => (
                            <span key={i} className="text-xs bg-muted border border-border px-2 py-1 rounded text-foreground/80">{f.name}</span>
                        ))}
                    </div>
                )}

                <div className="divide-y divide-border">
                    {sections.map(sec => (
                        <div key={sec.title}>
                            <button onClick={() => setOpenObSection(openObSection === sec.title ? null : sec.title)} className={`w-full flex items-center justify-between p-4 transition-colors ${openObSection === sec.title ? 'bg-muted/80' : 'hover:bg-muted/30'}`}>
                                <div className="flex items-center space-x-3">{React.createElement(sec.icon, { className: "w-5 h-5 text-muted-foreground" })}<span className="font-bold text-foreground uppercase tracking-wide">{sec.title}</span></div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-muted-foreground uppercase mr-3 tracking-tighter">Debit</span>
                                        <span className="font-mono text-foreground font-semibold">{formatWholeNumber(sec.totalDebit)}</span>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-muted-foreground uppercase mr-3 tracking-tighter">Credit</span>
                                        <span className="font-mono text-foreground font-semibold">{formatWholeNumber(sec.totalCredit)}</span>
                                    </div>
                                    {openObSection === sec.title ? <ChevronDownIcon className="w-5 h-5 text-muted-foreground" /> : <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />}
                                </div>
                            </button>
                            {openObSection === sec.title && (
                                <div className="bg-background/40 p-4 border-t border-border/50">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead><tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-border/50">Account Name</th><th className="px-4 py-2 text-right border-b border-border/50">Debit</th><th className="px-4 py-2 text-right border-b border-border/50">Credit</th></tr></thead>
                                        <tbody>
                                            {sec.items.map((item: any, idx: number) => {
                                                if (item.type === 'subheader') {
                                                    return (
                                                        <tr key={idx} className="bg-card/50">
                                                            <td colSpan={3} className={`px-2 py-2 font-bold text-xs text-muted-foreground border-b border-border/50 pt-4 pb-1`}>{item.label}</td>
                                                        </tr>
                                                    );
                                                } else {
                                                    return (
                                                        <tr key={idx} className="hover:bg-muted/20 border-b border-border/30 last:border-0">
                                                            <td className="py-2 px-4 text-foreground/80 font-medium">
                                                                <div className="flex items-center justify-between group">
                                                                    <span>{item.label}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-1 px-2 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    value={item.debit === 0 ? '' : Math.round(item.debit)}
                                                                    onChange={e => handleObCellChange(item.label, 'debit', e.target.value)}
                                                                    className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    value={item.credit === 0 ? '' : Math.round(item.credit)}
                                                                    onChange={e => handleObCellChange(item.label, 'credit', e.target.value)}
                                                                    className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs"
                                                                />
                                                            </td>
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
                <div className="p-6 bg-background border-t border-border">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-12">
                            <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Grand Total Debit</p><p className="font-mono font-bold text-2xl text-foreground">{formatWholeNumber(roundedGrandTotal.debit)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Grand Total Credit</p><p className="font-mono font-bold text-2xl text-foreground">{formatWholeNumber(roundedGrandTotal.credit)}</p></div>
                        </div>
                        <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(variance) < 1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                            {Math.abs(variance) < 1 ? 'Balanced' : `Variance: ${formatWholeNumber(variance)}`}
                        </div>
                    </div>
                    <div className="flex justify-between mt-8 border-t border-border pt-6">
                        <button onClick={handleBack} className="px-4 py-2 bg-transparent text-muted-foreground hover:text-foreground font-medium transition-colors">Back</button>
                        <div className="flex gap-4">
                            <button onClick={handleExportStepOpeningBalances} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export Excel
                            </button>
                            {/* Allow continuing even if not balanced? Usually Opening Balances MUST balance. The user requested "see totals validated". Step 9 disables. We should probably disable or warn. */}
                            <button onClick={handleOpeningBalancesComplete} disabled={Math.abs(variance) >= 1} className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep9AdjustTrialBalance = () => {
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
                    const hasBreakdown = !!breakdowns[entry.account] && breakdowns[entry.account].length > 0;
                    // Add only if not already in fixed structure and is custom
                    if (!targetSection.items.some((item: { label: string; }) => item.label === entry.account)) {
                        targetSection.items.push({ type: 'row', label: entry.account, debit: entry.debit, credit: entry.credit, isCustom: true, hasBreakdown });
                        targetSection.totalDebit += entry.debit;
                        targetSection.totalCredit += entry.credit;
                    }
                }
            }
        });

        const grandTotal = sections.reduce((acc, curr) => ({ debit: acc.debit + curr.totalDebit, credit: acc.credit + curr.totalCredit }), { debit: 0, credit: 0 });
        const roundedGrandTotal = {
            debit: roundAmount(grandTotal.debit),
            credit: roundAmount(grandTotal.credit),
        };
        const variance = roundedGrandTotal.debit - roundedGrandTotal.credit;

        return (
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-6 bg-background border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-primary uppercase tracking-widest">Adjust Trial Balance</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" />
                        <button onClick={() => setShowGlobalAddAccountModal(true)} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-all shadow-md">
                            <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                        </button>
                    </div>
                </div>

                {isExtractingTB && <div className="p-10 border-b border-border bg-background/40"><LoadingIndicator progress={60} statusText="Gemini AI is reading your Trial Balance table..." /></div>}

                <div className="divide-y divide-border">
                    {sections.map(sec => (
                        <div key={sec.title}>
                            <button onClick={() => setOpenTbSection(openTbSection === sec.title ? null : sec.title)} className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === sec.title ? 'bg-muted/80' : 'hover:bg-muted/30'}`}>
                                <div className="flex items-center space-x-3">{React.createElement(sec.icon, { className: "w-5 h-5 text-muted-foreground" })}<span className="font-bold text-foreground uppercase tracking-wide">{sec.title}</span></div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-muted-foreground uppercase mr-3 tracking-tighter">Debit</span>
                                        <span className="font-mono text-foreground font-semibold">{formatWholeNumber(sec.totalDebit)}</span>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-muted-foreground uppercase mr-3 tracking-tighter">Credit</span>
                                        <span className="font-mono text-foreground font-semibold">{formatWholeNumber(sec.totalCredit)}</span>
                                    </div>
                                    {openTbSection === sec.title ? <ChevronDownIcon className="w-5 h-5 text-muted-foreground" /> : <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />}
                                </div>
                            </button>
                            {openTbSection === sec.title && (
                                <div className="bg-background/40 p-4 border-t border-border/50">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead><tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-border/50">Account Name</th><th className="px-4 py-2 text-right border-b border-border/50">Debit</th><th className="px-4 py-2 text-right border-b border-border/50">Credit</th></tr></thead>
                                        <tbody>
                                            {sec.items.map((item: any, idx: number) => { // Cast item to any to avoid TS errors
                                                if (item.type === 'subheader') {
                                                    return (
                                                        <tr key={idx} className="bg-card/50">
                                                            <td colSpan={3} className={`px-2 py-2 font-bold text-xs text-muted-foreground border-b border-border/50 pt-4 pb-1`}>
                                                                {item.label}
                                                            </td>
                                                        </tr>
                                                    );
                                                } else {

                                                    return (
                                                        <tr key={idx} className="hover:bg-muted/20 border-b border-border/30 last:border-0">
                                                            <td className="py-2 px-4 text-foreground/80 font-medium">
                                                                <div className="flex items-center justify-between group">
                                                                    <span>{item.label}</span>
                                                                    <button
                                                                        onClick={() => handleOpenWorkingNote(item.label)}
                                                                        className="p-1.5 rounded transition-all text-muted-foreground hover:text-foreground hover:bg-muted/80 opacity-0 group-hover:opacity-100"
                                                                        title="View/Edit Breakdown (Working Note)"
                                                                    >
                                                                        <ListBulletIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="py-1 px-2 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    value={item.debit === 0 ? '' : Math.round(item.debit)}
                                                                    onChange={e => handleCellChange(item.label, 'debit', e.target.value)}
                                                                    className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    value={item.credit === 0 ? '' : Math.round(item.credit)}
                                                                    onChange={e => handleCellChange(item.label, 'credit', e.target.value)}
                                                                    className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs"
                                                                />
                                                            </td>
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
                <div className="p-6 bg-background border-t border-border">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-12">
                            <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Grand Total Debit</p><p className="font-mono font-bold text-2xl text-foreground">{formatWholeNumber(roundedGrandTotal.debit)}</p></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Grand Total Credit</p><p className="font-mono font-bold text-2xl text-foreground">{formatWholeNumber(roundedGrandTotal.credit)}</p></div>
                        </div>
                        <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(variance) < 1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                            {Math.abs(variance) < 1 ? 'Balanced' : `Variance: ${formatWholeNumber(variance)}`}
                        </div>
                    </div>
                    <div className="flex justify-between mt-8 border-t border-border pt-6">
                        <button onClick={handleBack} className="text-muted-foreground hover:text-foreground font-bold transition-colors">Back</button>
                        <div className="flex gap-4">
                            <button onClick={handleExportStepAdjustTrialBalance} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export Excel
                            </button>
                            <button onClick={handleContinueToProfitAndLoss} disabled={Math.abs(variance) >= 1} className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const pnlDisplayData = useMemo(() => {
        const data: Record<string, { currentYear: number; previousYear: number }> = {};
        pnlStructure.forEach(item => {
            if (item.type === 'item' || item.type === 'total' || item.type === 'grand_total') {
                data[item.id] = {
                    currentYear: pnlValues[item.id] || 0,
                    previousYear: 0
                };
            }
        });
        return data;
    }, [pnlStructure, pnlValues]);

    const handlePnlInputChange = useCallback((id: string, year: 'currentYear' | 'previousYear', value: number) => {
        if (year === 'currentYear') {
            handlePnlChange(id, value);
        }
    }, [handlePnlChange]);

    const renderStep10ProfitAndLoss = () => (
        <ProfitAndLossStep
            onNext={handleContinueToBalanceSheet}
            onBack={handleBack}
            data={pnlDisplayData}
            structure={pnlStructure}
            onChange={handlePnlInputChange}
            onExport={handleExportStepPnl}
            onAddAccount={handleAddPnlAccount}
            workingNotes={pnlWorkingNotes}
            onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
        />
    );

    const bsDisplayData = useMemo(() => {
        const data: Record<string, { currentYear: number; previousYear: number }> = {};
        bsStructure.forEach(item => {
            if (item.type === 'item' || item.type === 'total' || item.type === 'grand_total') {
                data[item.id] = {
                    currentYear: balanceSheetValues[item.id] || 0,
                    previousYear: 0
                };
            }
        });
        return data;
    }, [bsStructure, balanceSheetValues]);



    const handleBalanceSheetInputChange = useCallback((id: string, year: 'currentYear' | 'previousYear', value: number) => {
        if (year === 'currentYear') {
            handleBalanceSheetChange(id, value);
        }
    }, [handleBalanceSheetChange]);

    const renderStep11BalanceSheet = () => (
        <BalanceSheetStep
            onNext={handleContinueToTaxComp}
            onBack={handleBack}
            data={bsDisplayData}
            structure={bsStructure}
            onChange={handleBalanceSheetInputChange}
            onExport={handleExportStepBS}
            onDownloadPDF={handleDownloadPDF}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
        />
    );

    const handleExportTaxComputation = () => {
        const wb = XLSX.utils.book_new();
        const sheetData: (string | number)[][] = [
            ["Tax Computation Summary"],
            ["Field", "Value (AED)"],
        ];

        const taxSummary = REPORT_STRUCTURE.find(s => s.id === 'tax-summary');
        if (taxSummary) {
            taxSummary.fields.forEach((f: any) => {
                if (f.type !== 'header') {
                    sheetData.push([f.label, reportForm[f.field] || 0]);
                }
            });
        }

        if (questionnaireAnswers[6] === 'Yes') {
            sheetData.push(["Small Business Relief Claimed", "Yes"]);
        }

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "Tax Computation");
        XLSX.writeFile(wb, `CT_Tax_Computation_${company?.name || 'Draft'}.xlsx`);
    };

    const handleExportStepReport = async () => {
        // Save Step 16 Data (Final Report)
        await handleSaveStep(16, {
            reportForm,
            reportManualEdits: Array.from(reportManualEditsRef.current)
        }, 'completed');

        const wb = XLSX.utils.book_new();

        // --- 1. Final Return Sheet ---
        const reportData: any[][] = [];
        reportData.push(["CORPORATE TAX RETURN - FEDERAL TAX AUTHORITY"]);
        reportData.push([]);

        const getReportValue = (field: string) => {
            return reportForm[field];
        };

        REPORT_STRUCTURE.forEach(section => {
            reportData.push([section.title.toUpperCase()]);
            section.fields.forEach(field => {
                if (field.type === 'header') {
                    reportData.push([field.label.replace(/---/g, '').trim()]);
                } else {
                    let value = getReportValue(field.field);
                    if (value === undefined || value === null || value === '') value = '';
                    else if (field.type === 'number' && typeof value !== 'number') value = parseFloat(value) || 0;
                    reportData.push([field.label, value]);
                }
            });
            reportData.push([]);
        });

        const wsReport = XLSX.utils.aoa_to_sheet(reportData);
        wsReport['!cols'] = [{ wch: 60 }, { wch: 25 }];
        const range = XLSX.utils.decode_range(wsReport['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
            const cell = wsReport[cellRef];
            if (cell && cell.t === 'n') cell.z = '#,##0.00';
        }
        XLSX.utils.book_append_sheet(wb, wsReport, "Final Return");

        // --- 2. Tax Computation Sheet ---
        const taxData: (string | number)[][] = [
            ["Tax Computation Summary"],
            ["Field", "Value (AED)"],
        ];
        const taxSummary = REPORT_STRUCTURE.find(s => s.id === 'tax-summary');
        if (taxSummary) {
            taxSummary.fields.forEach((f: any) => {
                if (f.type !== 'header') {
                    taxData.push([f.label, reportForm[f.field] || 0]);
                }
            });
        }
        if (questionnaireAnswers[6] === 'Yes') {
            taxData.push(["Small Business Relief Claimed", "Yes"]);
        }
        const wsTax = XLSX.utils.aoa_to_sheet(taxData);
        wsTax['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsTax, "Tax Computation");

        // --- 3. Profit & Loss Sheet ---
        const pnlData: (string | number)[][] = [["Profit & Loss Statement"], ["Account", "Current Year", "Previous Year"]];
        pnlStructure.forEach((item: any) => {
            const val = pnlValues[item.id] || 0; // Type 2 pnlValues is flat number map?
            if (item.type === 'header') {
                pnlData.push([item.label.toUpperCase(), "", ""]);
            } else if (item.type !== 'spacer') {
                pnlData.push([item.label, val, 0]);
            }
        });
        const wsPnl = XLSX.utils.aoa_to_sheet(pnlData);
        wsPnl['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsPnl, "Profit & Loss");

        // --- 4. Balance Sheet ---
        const bsData: (string | number)[][] = [["Balance Sheet"], ["Account", "Current Year", "Previous Year"]];
        bsStructure.forEach((item: any) => {
            const val = balanceSheetValues[item.id] || 0;
            if (item.type === 'header') {
                bsData.push([item.label.toUpperCase(), "", ""]);
            } else if (item.type !== 'spacer') {
                bsData.push([item.label, val, 0]);
            }
        });
        const wsBs = XLSX.utils.aoa_to_sheet(bsData);
        wsBs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, wsBs, "Balance Sheet");

        XLSX.writeFile(wb, `${companyName || 'Company'}_CT_Final_Report_Comprehensive.xlsx`);
    };

    const renderStep12TaxComputation = () => {
        const taxSummary = REPORT_STRUCTURE.find(s => s.id === 'tax-summary');
        if (!taxSummary) return null;

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden ring-1 ring-border">
                    <div className="p-8 border-b border-border flex justify-between items-center bg-background">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                                <SparklesIcon className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Tax Computation Results</h3>
                                <p className="text-xs text-muted-foreground mt-1">Review the calculated tax figures before proceeding.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-muted/30">
                        <div className="grid grid-cols-1 gap-4">
                            {taxSummary.fields.map((f: any) => (
                                <div key={f.field} className="bg-background/60 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-all group/card flex justify-between items-center">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight group-hover/card:text-primary transition-colors flex-1">
                                        {f.label}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={reportForm[f.field] || 0}
                                            onChange={(e) => setReportForm((prev: any) => ({ ...prev, [f.field]: parseFloat(e.target.value) || 0 }))}
                                            className={`font-mono font-bold text-base text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-all w-48 ${f.highlight ? 'text-primary' : 'text-foreground'}`}
                                        />
                                        <span className="text-[10px] opacity-60 ml-0.5 w-8">{currency}</span>
                                    </div>
                                    {f.highlight && (
                                        <div className="hidden">
                                            {/* Hidden highlight indicator if needed, but styling above handles it */}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-8 border-t border-border flex justify-between items-center bg-background/50">
                        <button
                            onClick={handleBack}
                            className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                        >
                            <ChevronLeftIcon className="w-5 h-5 mr-2" />
                            Back
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={handleExportTaxComputation}
                                className="px-5 py-3 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-all border border-border shadow-md flex items-center"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 text-muted-foreground" />
                                Export Excel
                            </button>
                            <button
                                onClick={handleContinueToLOU}
                                className="flex items-center px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-xl shadow-primary/20 transform hover:-translate-y-0.5 transition-all"
                            >
                                Continue to LOU
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep13LOU = () => (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden ring-1 ring-border">
                <div className="p-8 border-b border-border flex justify-between items-center bg-background">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/20">
                            <DocumentTextIcon className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">CLIENT DECLARATION & REPRESENTATION LETTER</h3>
                            <p className="text-sm text-muted-foreground mt-1">Review and customize the Representation Letter details below.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleDownloadLouPDF}
                        disabled={isDownloadingLouPdf}
                        className="px-6 py-2.5 bg-muted text-foreground font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-muted/80 disabled:opacity-50 flex items-center gap-2"
                    >
                        <DocumentArrowDownIcon className="w-5 h-5 text-muted-foreground" />
                        {isDownloadingLouPdf ? 'Generating...' : 'Download LOU PDF'}
                    </button>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Date</label>
                            <input
                                type="date"
                                value={louData.date}
                                onChange={(e) => setLouData({ ...louData, date: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">To</label>
                            <input
                                type="text"
                                value={louData.to}
                                onChange={(e) => setLouData({ ...louData, to: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Subject</label>
                            <input
                                type="text"
                                value={louData.subject}
                                onChange={(e) => setLouData({ ...louData, subject: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Taxable Person</label>
                            <input
                                type="text"
                                value={louData.taxablePerson}
                                onChange={(e) => setLouData({ ...louData, taxablePerson: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Tax Period</label>
                            <input
                                type="text"
                                value={louData.taxPeriod}
                                onChange={(e) => setLouData({ ...louData, taxPeriod: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">TRN (Corporate Tax)</label>
                            <input
                                type="text"
                                value={louData.trn}
                                onChange={(e) => setLouData({ ...louData, trn: e.target.value })}
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="mt-2 mb-2">
                            <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">For and on behalf of {reportForm.taxableNameEn || companyName || '[Company Name]'}:</span>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Authorized Signatory Name</label>
                            <input
                                type="text"
                                value={louData.signatoryName}
                                onChange={(e) => setLouData({ ...louData, signatoryName: e.target.value })}
                                placeholder="Enter Name"
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Designation</label>
                            <input
                                type="text"
                                value={louData.designation}
                                onChange={(e) => setLouData({ ...louData, designation: e.target.value })}
                                placeholder="Enter Designation"
                                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 mt-4 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Company Stamp</span>
                            <div className="w-12 h-12 border-2 border-dashed border-primary/20 rounded-full flex items-center justify-center">
                                <PlusIcon className="w-5 h-5 text-primary/40" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 flex flex-col">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest">Content</label>
                        <textarea
                            value={louData.content}
                            onChange={(e) => setLouData({ ...louData, content: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-foreground focus:ring-1 focus:ring-primary outline-none transition-all flex-grow min-h-[300px] resize-none leading-relaxed text-sm"
                        />
                    </div>
                </div>

                <div className="p-8 bg-background border-t border-border flex justify-between items-center">
                    <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all">
                        <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={handleContinueToSignedFsLouUpload}
                            className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl shadow-primary/20 flex items-center transition-all transform hover:scale-[1.02]"
                        >
                            Confirm & Continue
                            <ChevronRightIcon className="w-5 h-5 ml-2" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep14SignedFsLouUpload = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-border bg-background/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-primary/50/30 shadow-lg shadow-blue-500/5">
                            <CloudArrowUpIcon className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground tracking-tight">Signed Financial Statements & LOU</h3>
                            <p className="text-muted-foreground mt-1 max-w-2xl">Upload Signed LOU and Signed FS for record purposes.</p>
                        </div>
                    </div>
                </div>
                <div className="p-8">
                    <div className="min-h-[400px]">
                        <FileUploadArea
                            title="Upload Signed FS & LOU"
                            subtitle="Support PDF, JPG, PNG"
                            icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                            selectedFiles={signedFsLouFiles}
                            onFilesSelect={setSignedFsLouFiles}
                        />
                    </div>
                </div>
            </div>
            <div className="flex justify-between items-center pt-4">
                <button
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleContinueToQuestionnaire}
                        className="px-6 py-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest shadow-lg"
                    >
                        Skip
                    </button>
                    <button
                        onClick={handleContinueToQuestionnaire}
                        className="flex items-center px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-xl shadow-primary/10 transform hover:-translate-y-0.5 transition-all"
                    >
                        Continue to Questionnaire
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStep15CtQuestionnaire = () => {
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
                <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-border flex justify-between items-center bg-background/50">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-primary/50/30">
                                <QuestionMarkCircleIcon className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">Corporate Tax Questionnaire</h3>
                                <p className="text-sm text-muted-foreground mt-1">Please provide additional details for final tax computation.</p>
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-4 py-2 rounded-full border border-border">
                            {Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length} / {CT_QUESTIONS.length} Completed
                        </div>
                    </div>

                    <div className="divide-y divide-border max-h-[60vh] overflow-y-auto custom-scrollbar bg-background/20">
                        {CT_QUESTIONS.map((q) => (
                            <div key={q.id} className="p-6 hover:bg-background/5 transition-colors group">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="flex gap-4 flex-1">
                                        <span className="text-xs font-bold text-muted-foreground font-mono mt-1">{String(q.id).padStart(2, '0')}</span>
                                        <div className="flex flex-col">
                                            <p className="text-sm font-medium text-foreground/90 leading-relaxed">{q.text}</p>
                                            {ftaFormValues && q.id === 6 && (
                                                <div className="mt-2 space-y-3">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Operating Revenue of Current Period</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={questionnaireAnswers['curr_revenue'] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                    setQuestionnaireAnswers(prev => ({ ...prev, 'curr_revenue': val }));
                                                                }}
                                                                className="bg-muted border border-blue-900/50 rounded-lg px-4 py-2 text-foreground text-sm w-full md:w-64 focus:ring-1 focus:ring-primary outline-none placeholder-gray-600 transition-all font-mono text-right"
                                                                placeholder="0.00"
                                                            />
                                                            <span className="absolute left-3 top-2 text-muted-foreground text-sm">{currency}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Operating Revenue for Previous Period</label>
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                value={questionnaireAnswers['prev_revenue'] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.target.value.replace(/[^0-9.]/g, '');
                                                                    setQuestionnaireAnswers(prev => ({ ...prev, 'prev_revenue': val }));
                                                                }}
                                                                className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground text-sm w-full md:w-64 focus:ring-1 focus:ring-primary outline-none placeholder-gray-600 transition-all font-mono text-right"
                                                                placeholder="0.00"
                                                            />
                                                            <span className="absolute left-3 top-2 text-muted-foreground text-sm">{currency}</span>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                                                        {(() => {
                                                            const currentRev = parseFloat(questionnaireAnswers['curr_revenue']) || 0;
                                                            const prevRev = parseFloat(questionnaireAnswers['prev_revenue']) || 0;
                                                            const totalRev = currentRev + prevRev;
                                                            const isIneligible = currentRev >= 3000000 || prevRev >= 3000000;
                                                            const isSbrPotential = !isIneligible;

                                                            return (
                                                                <>
                                                                    <p className="text-xs text-foreground/80 flex justify-between mb-1">
                                                                        <span>Total Revenue:</span>
                                                                        <span className="font-mono font-bold">{currency} {formatNumber(totalRev)}</span>
                                                                    </p>
                                                                    <p className={`text-xs font-bold ${isSbrPotential ? 'text-green-400' : 'text-primary'} flex items-center gap-2`}>
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
                                                                    {questionnaireAnswers[6] === 'Yes' && <p className="text-[10px] text-muted-foreground mt-1 pl-6">All financial amounts in the final report will be set to 0.</p>}
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
                                            className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground text-sm w-40 focus:ring-1 focus:ring-primary outline-none placeholder-gray-600 transition-all font-mono text-right"
                                            placeholder="0"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-2 bg-background p-1 rounded-xl border border-border shrink-0 shadow-inner">
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
                                                        className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentAnswer === option
                                                            ? 'bg-primary text-primary-foreground shadow-lg'
                                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
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

                    <div className="p-8 bg-background border-t border-border flex justify-between items-center">
                        <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all">
                            <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={handleSkipQuestionnaire}
                                className="px-6 py-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest shadow-lg"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleContinueToReport}
                                disabled={Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length < CT_QUESTIONS.length}
                                className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl shadow-primary/20 flex items-center disabled:opacity-50 disabled:grayscale transition-all transform hover:scale-[1.02]"
                            >
                                Continue to Report
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep16FinalReport = () => {
        if (!ftaFormValues) return <div className="text-center p-20 bg-card rounded-xl border border-border">Calculating report data...</div>;

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
                <div className="bg-background rounded-2xl border border-border shadow-2xl overflow-hidden ring-1 ring-border">
                    <div className="p-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center bg-background gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-muted/40 rounded-2xl flex items-center justify-center shadow-md">
                                <SparklesIcon className="w-10 h-10 text-foreground" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Corporate Tax Return</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{reportForm.taxableNameEn}</p>
                                    <span className="h-1 w-1 bg-muted/80 rounded-full"></span>
                                    <p className="text-xs text-primary font-mono">DRAFT READY</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button onClick={handleBack} className="flex-1 sm:flex-none px-6 py-2.5 border border-border text-muted-foreground hover:text-foreground rounded-xl font-bold text-xs uppercase transition-all hover:bg-muted">Back</button>
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isDownloadingPdf}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-muted text-foreground font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                            </button>
                            <button
                                onClick={handleExportStepReport}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-background text-foreground font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-muted/70 transform hover:scale-[1.03]"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                Export Step 16
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-border">
                        {sections.map(section => (
                            <div key={section.id} className="group">
                                <button
                                    onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)}
                                    className="w-full flex items-center justify-between p-6 hover:bg-muted/30 transition-all text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-xl border transition-all duration-500 ${openReportSection === section.title
                                            ? 'bg-primary/20 border-primary/50/50 text-primary shadow-lg shadow-blue-500/10'
                                            : 'bg-muted border-border text-muted-foreground group-hover:border-border group-hover:text-muted-foreground'
                                            }`}>
                                            <section.icon className="w-5 h-5" />
                                        </div>
                                        <h4 className={`text-sm font-black uppercase tracking-widest transition-colors ${openReportSection === section.title ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/80'
                                            }`}>{section.title}</h4>
                                    </div>
                                    <ChevronDownIcon className={`w-5 h-5 text-muted-foreground transition-transform duration-500 ${openReportSection === section.title ? 'rotate-180 text-primary' : 'group-hover:text-muted-foreground'}`} />
                                </button>

                                {openReportSection === section.title && (
                                    <div className="p-8 bg-background/40 border-t border-border/50 animate-in slide-in-from-top-1 duration-300">
                                        <div className="flex flex-col gap-y-4 bg-background/50 border border-border rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                            {section.fields.map((f, fIdx) => (
                                                f.type === 'header' ? (
                                                    <div key={f.field} className="pt-8 pb-3 border-b border-border/80 mb-4 first:pt-0">
                                                        <h4 className="text-sm font-black text-primary uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                    </div>
                                                ) : (
                                                    <div key={f.field} className="flex flex-col py-4 border-b border-border/30 last:border-0 group/field">
                                                        <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-primary' : 'text-muted-foreground group-hover/field:text-muted-foreground'}`}>{f.label}</label>
                                                        <div className="bg-card/40 rounded-lg p-1 border border-transparent group-hover/field:border-border/50 transition-all relative">
                                                            {f.type === 'number' ? (
                                                                <ReportNumberInput field={f.field} className={f.highlight ? 'text-primary/70' : ''} />
                                                            ) : (
                                                                <ReportInput field={f.field} className={f.highlight ? 'text-primary/70' : ''} />
                                                            )}
                                                            {f.labelPrefix && (
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground uppercase tracking-tighter pointer-events-none">
                                                                    {f.labelPrefix}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-background border-t border-border text-center"><p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">This is a system generated document and does not require to be signed.</p></div>
                </div>
            </div>
        );
    };

    const renderSbrModal = () => {
        if (!showSbrModal) return null;

        return createPortal(
            <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-xl overflow-hidden ring-1 ring-border/50 animate-in zoom-in-95 duration-500">
                    <div className="p-10 text-center space-y-8 relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>

                        <div className="mx-auto w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 shadow-inner group transition-transform duration-500 hover:scale-110">
                            <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter">Small Business Relief</h3>
                            <p className="text-muted-foreground font-medium leading-relaxed max-w-md mx-auto">
                                Based on your revenue of <span className="text-primary font-bold">{currency} {formatNumber(ftaFormValues?.actualOperatingRevenue || 0)}</span>, you are eligible for Small Business Relief.
                            </p>
                        </div>

                        <div className="bg-muted/30 rounded-2xl p-6 border border-border/50 backdrop-blur-sm">
                            <p className="text-xs text-muted-foreground leading-relaxed italic">
                                SBR allows eligible taxable persons to be treated as having no taxable income for a relevant tax period. This will be reflected in your final tax computation.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                onClick={() => {
                                    setShowSbrModal(false);
                                    setCurrentStep(12);
                                }}
                                className="flex-1 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0"
                            >
                                Continue with Relief
                            </button>
                            <button
                                onClick={() => {
                                    setShowSbrModal(false);
                                    setCurrentStep(12);
                                }}
                                className="flex-1 px-8 py-4 bg-muted hover:bg-muted/80 text-foreground font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all border border-border"
                            >
                                Standard Calculation
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    };

    if (currentStep === 3 && isProcessingInvoices) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center p-4">
                <LoadingIndicator
                    progress={progress || 60}
                    statusText={progressMessage || "Analyzing invoices..."}
                    title="Analyzing Your Document..."
                />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 relative">
            {appState === 'loading' && createPortal(
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[9999] flex items-center justify-center w-full h-full animate-in fade-in duration-500">
                    <LoadingIndicator progress={progress} statusText={progressMessage} title="Analyzing Your Document..." />
                </div>,
                document.body
            )}
            <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center border border-border shadow-inner group transition-transform hover:scale-105">
                        <BuildingOfficeIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase">{companyName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-primary/80"><BriefcaseIcon className="w-3.5 h-3.5" /> TYPE 2 WORKFLOW (BANK + INVOICE)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={handleExportToExcel}
                        disabled={currentStep !== 16}
                        className={`flex items-center px-4 py-2 font-black text-[10px] uppercase tracking-widest rounded-xl border transition-all ${currentStep === 16
                            ? 'bg-primary border-primary/50 text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/10'
                            : 'bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50'
                            }`}
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All (Step 16)
                    </button>
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-black text-[10px] uppercase tracking-widest rounded-xl border border-border/50">
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
            {currentStep === 7 && renderStep7VatSummarization()}
            {currentStep === 8 && renderStep8OpeningBalances()}
            {currentStep === 9 && renderStep9AdjustTrialBalance()}
            {currentStep === 10 && renderStep10ProfitAndLoss()}
            {currentStep === 11 && renderStep11BalanceSheet()}
            {currentStep === 12 && renderStep12TaxComputation()}
            {currentStep === 13 && renderStep13LOU()}
            {currentStep === 14 && renderStep14SignedFsLouUpload()}
            {currentStep === 15 && renderStep15CtQuestionnaire()}
            {currentStep === 16 && renderStep16FinalReport()}

            {renderSbrModal()}

            {showVatFlowModal && createPortal(
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-300">
                    <div className="bg-card rounded-2xl border border-border w-full max-w-sm p-8 shadow-2xl transform animate-in zoom-in-95 duration-300">
                        <h3 className="font-bold mb-6 text-foreground text-center text-xl tracking-tight">VAT 201 Certificates Available?</h3>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleVatFlowAnswer(false)} className="px-8 py-3 border border-border rounded-xl text-foreground font-bold hover:bg-muted transition-all uppercase text-xs tracking-widest">No</button>
                            <button onClick={() => handleVatFlowAnswer(true)} className="px-8 py-3 bg-primary rounded-xl text-primary-foreground font-black hover:bg-primary/90 transition-all uppercase text-xs tracking-widest shadow-lg shadow-primary/20">Yes</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Working Note Modal */}
            {workingNoteModalOpen && createPortal(
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                            <div>
                                <h3 className="text-lg font-bold text-foreground flex items-center">
                                    <ListBulletIcon className="w-5 h-5 mr-2 text-primary" />
                                    Working Note: <span className="text-primary ml-1">{currentWorkingAccount}</span>
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">Add breakdown details for this account.</p>
                            </div>
                            <button onClick={() => setWorkingNoteModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Description</th>
                                        <th className="px-4 py-3 text-right">Debit ({currency})</th>
                                        <th className="px-4 py-3 text-right rounded-tr-lg">Credit ({currency})</th>
                                        <th className="px-2 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {tempBreakdown.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-muted/30">
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={entry.description}
                                                    onChange={(e) => {
                                                        const newTemp = [...tempBreakdown];
                                                        newTemp[idx].description = e.target.value;
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                                                    placeholder="Item description..."
                                                    autoFocus={idx === tempBreakdown.length - 1}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={entry.debit === 0 ? '' : entry.debit}
                                                    onChange={(e) => {
                                                        const newTemp = [...tempBreakdown];
                                                        newTemp[idx].debit = parseFloat(e.target.value) || 0;
                                                        newTemp[idx].credit = 0; // Clear credit if debit is entered
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-right font-mono focus:outline-none focus:border-primary/50 transition-colors"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={entry.credit === 0 ? '' : entry.credit}
                                                    onChange={(e) => {
                                                        const newTemp = [...tempBreakdown];
                                                        newTemp[idx].credit = parseFloat(e.target.value) || 0;
                                                        newTemp[idx].debit = 0; // Clear debit if credit is entered
                                                        setTempBreakdown(newTemp);
                                                    }}
                                                    className="w-full bg-muted border border-border rounded px-3 py-2 text-foreground text-right font-mono focus:outline-none focus:border-primary/50 transition-colors"
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
                                            <td colSpan={4} className="p-8 text-center text-muted-foreground italic border-2 border-dashed border-border rounded-lg mt-2">
                                                No breakdown entries yet. Click "Add Entry" to start.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-primary/10 border-t-2 border-blue-900/30 font-bold text-primary-foreground">
                                    <tr>
                                        <td className="px-4 py-3 text-right text-primary/80">Total:</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatNumber(tempBreakdown.reduce((sum, item) => sum + (item.debit || 0), 0))}</td>
                                        <td className="px-4 py-3 text-right font-mono">{formatNumber(tempBreakdown.reduce((sum, item) => sum + (item.credit || 0), 0))}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>

                            <button
                                onClick={() => setTempBreakdown([...tempBreakdown, { description: '', debit: 0, credit: 0 }])}
                                className="w-full py-3 border border-dashed border-border rounded-xl text-muted-foreground hover:text-foreground hover:border-border hover:bg-muted transition-all flex items-center justify-center font-bold text-sm"
                            >
                                <PlusIcon className="w-5 h-5 mr-2" /> Add Entry
                            </button>
                        </div>

                        <div className="p-6 bg-background border-t border-border flex justify-between items-center">
                            <div className="text-xs text-muted-foreground">
                                <span className="block font-bold text-muted-foreground">Note:</span>
                                <span>Saving will update the main account total automatically.</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setWorkingNoteModalOpen(false)}
                                    className="px-5 py-2.5 text-muted-foreground hover:text-foreground font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveWorkingNote}
                                    className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/10 transition-all transform active:scale-95 flex items-center"
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
                    className="fixed inset-0 bg-background/90 backdrop-blur-md z-[100000] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowAddCategoryModal(false);
                            setPendingCategoryContext(null);
                            setNewCategoryError(null);
                        }
                    }}
                >
                    <div className="bg-background rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden relative group">
                        <div className="absolute inset-0 bg-muted/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                        <div className="p-8 border-b border-border bg-background flex justify-between items-center relative">
                            <div>
                                <h3 className="text-xl font-black text-foreground uppercase tracking-wider bg-clip-text text-transparent">New Category</h3>
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Create a custom mapping</p>
                            </div>
                            <button
                                onClick={() => { setShowAddCategoryModal(false); setPendingCategoryContext(null); setNewCategoryError(null); }}
                                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-muted"
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
                                    <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Main Classification</label>
                                    <div className="relative group/input">
                                        <select
                                            value={newCategoryMain}
                                            onChange={(e) => setNewCategoryMain(e.target.value)}
                                            className="w-full p-4 bg-card/50 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all appearance-none font-medium"
                                            required
                                        >
                                            <option value="">Select a Main Category...</option>
                                            {Object.keys(CHART_OF_ACCOUNTS).map(cat => (
                                                <option key={cat} value={cat} className="bg-card text-foreground">{cat}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <ChevronDownIcon className="w-4 h-4 text-muted-foreground group-hover/input:text-foreground/80 transition-colors" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-primary uppercase tracking-widest">Sub Category Name</label>
                                    <input
                                        type="text"
                                        value={newCategorySub}
                                        onChange={(e) => setNewCategorySub(e.target.value)}
                                        className="w-full p-4 bg-card/50 border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all placeholder-gray-600 font-medium"
                                        placeholder="e.g. Employee Wellness Direct Expenses"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-background/80 border-t border-border flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddCategoryModal(false); setPendingCategoryContext(null); setNewCategoryError(null); }}
                                    className="px-6 py-3 text-xs font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors hover:bg-muted rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10 transform hover:-translate-y-0.5 transition-all w-full sm:w-auto"
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
            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                            <h3 className="text-lg font-bold text-primary uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleGlobalAddAccount}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Main Category</label>
                                    <select
                                        value={newGlobalAccountMain}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNewGlobalAccountMain(val);
                                            setNewGlobalAccountChild('');
                                        }}
                                        className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
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
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Child Category</label>
                                        <select
                                            value={newGlobalAccountChild}
                                            onChange={(e) => setNewGlobalAccountChild(e.target.value)}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
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
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Account Name</label>
                                    <input
                                        type="text"
                                        value={newGlobalAccountName}
                                        onChange={(e) => setNewGlobalAccountName(e.target.value)}
                                        className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        placeholder="e.g. Project Development Fees"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-muted/50 border-t border-border flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setShowGlobalAddAccountModal(false)}
                                    className="px-5 py-2 text-sm text-muted-foreground hover:text-foreground font-bold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-extrabold rounded-xl shadow-lg transition-all"
                                >
                                    Add Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Uncategorized Items Alert Modal */}
            {
                showUncategorizedAlert && createPortal(
                    <div className="fixed inset-0 z-[100010] flex items-center justify-center bg-background/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-card border border-red-500/50 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all scale-100 ring-1 ring-red-500/30">
                            <div className="bg-muted/40 p-6 flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-5 ring-1 ring-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                    <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-xl font-bold text-foreground mb-2">Uncategorized Transactions</h3>
                                <p className="text-foreground/80 mb-6 text-sm leading-relaxed">
                                    You have <span className="text-red-400 font-bold text-base border-b border-red-500/30 px-1">{uncategorizedCount}</span> transaction{uncategorizedCount !== 1 ? 's' : ''} remaining that must be categorized before you can proceed to summarization.
                                </p>
                                <button
                                    onClick={() => setShowUncategorizedAlert(false)}
                                    className="w-full py-3 bg-red-600 hover:bg-red-500 text-foreground font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 hover:shadow-red-900/40 transform hover:-translate-y-0.5 active:translate-y-0 text-sm uppercase tracking-wide"
                                >
                                    I Understand, I'll Fix It
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }
        </div>
    );
};

