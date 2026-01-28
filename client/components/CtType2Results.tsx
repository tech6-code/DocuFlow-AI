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
    UploadIcon,
    QuestionMarkCircleIcon
} from './icons';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Transaction, Invoice, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, BankStatementSummary, Company, WorkingNoteEntry } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { ProfitAndLossStep, PNL_ITEMS } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS } from './BalanceSheetStep';
import { FileUploadArea } from './VatFilingUpload';
import { extractGenericDetailsFromDocuments, extractVatCertificateData, extractVat201Totals, CHART_OF_ACCOUNTS, categorizeTransactionsByCoA, extractTrialBalanceData } from '../services/geminiService';
import { convertFileToParts } from '../utils/fileUtils';
import { InvoiceSummarizationView } from './InvoiceSummarizationView';
import { ReconciliationTable } from './ReconciliationTable';

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
            'sales revenue',
            'sales to related parties',
            'service revenue',
            'commission revenue',
            'rent revenue',
            'interest income',
            /^sales$/i
        ]
    },
    {
        id: 'cost_of_revenue',
        keywords: [
            'cost of goods sold',
            'cogs',
            'raw material purchases',
            'direct labor',
            'factory overhead',
            'freight inwards',
            'carriage inwards',
            'direct cost',
            'purchases from related parties'
        ]
    },
    {
        id: 'other_income',
        keywords: [
            'gain on disposal of assets',
            'gains on disposal of assets',
            'dividend received',
            'dividends received',
            'discount received',
            'bad debts recovered'
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
            'advertising expense',
            'marketing expense',
            'sales commissions',
            'delivery/freight outwards',
            'freight outwards',
            'travel expenses',
            'entertainment expenses',
            'marketing & advertising',
            'travel & entertainment',
            'client entertainment'
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
            'salaries for sales staff',
            'warehouse rent',
            'packaging costs',
            'shipping costs'
        ]
    },
    {
        id: 'administrative_expenses',
        keywords: [
            'office rent',
            'utilities expense',
            'office supplies expense',
            'legal fees',
            'accounting fees',
            'administrative salaries',
            'insurance expense',
            'general expenses',
            'office supplies & stationery',
            'professional fees',
            'salaries & wages'
        ]
    },
    {
        id: 'finance_costs',
        keywords: [
            'interest expense',
            'bank charges',
            'loan interest paid',
            'interest to related parties'
        ]
    },
    {
        id: 'depreciation_ppe',
        keywords: [
            'depreciation expense',
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
            'cash and bank',
            'cash equivalents',
            'bank accounts',
            'bank balances',
            'marketable securities',
            /\bcash\b/i,
            /\bbank accounts?\b/i
        ],
        excludeIfMatch: ['bank charges']
    },
    {
        id: 'trade_receivables',
        keywords: [
            'accounts receivable',
            'trade receivables',
            'debtors',
            'bills receivable'
        ]
    },
    {
        id: 'inventories',
        keywords: [
            'inventory',
            'inventories',
            'stock'
        ]
    },
    {
        id: 'advances_deposits_receivables',
        keywords: [
            'prepaid expenses',
            'prepaid',
            'deposits',
            'advances',
            'office supplies',
            'other receivables'
        ]
    },
    {
        id: 'related_party_transactions_assets',
        keywords: [
            'due from related parties',
            'loans to related parties'
        ]
    },
    {
        id: 'property_plant_equipment',
        keywords: [
            'property, plant & equipment',
            'land',
            'building',
            'plant',
            'machinery',
            'equipment',
            'furniture',
            'fixtures',
            'vehicles',
            'long-term investments'
        ]
    },
    {
        id: 'intangible_assets',
        keywords: [
            'patents',
            'trademarks',
            'copyrights',
            'goodwill',
            'licenses',
            'intangible assets'
        ]
    },
    {
        id: 'short_term_borrowings',
        keywords: [
            'short-term loans',
            'short term loans',
            'bank overdraft',
            'current portion of long-term debt',
            'current portion of long term debt',
            'short term borrowings'
        ]
    },
    {
        id: 'related_party_transactions_liabilities',
        keywords: [
            'due to related parties',
            'loans from related parties'
        ]
    },
    {
        id: 'trade_other_payables',
        keywords: [
            'accounts payable',
            'creditors',
            'accrued expenses',
            'salaries payable',
            'interest payable',
            'unearned revenue',
            'bills payable',
            'trade and other payables',
            'vat payable',
            'corporate tax payable',
            'advances from customers'
        ]
    },
    {
        id: 'employees_end_service_benefits',
        keywords: [
            'end-of-service benefits',
            'end of service benefits',
            'employees end of service benefits'
        ]
    },
    {
        id: 'bank_borrowings_non_current',
        keywords: [
            'long-term bank loans',
            'long term bank loans',
            'bonds payable',
            'debentures',
            'lease obligations',
            'long-term loans',
            'long term loans',
            'deferred tax liabilities'
        ]
    },
    {
        id: 'share_capital',
        keywords: [
            "share capital / owner's equity",
            'share capital',
            'common stock',
            "owner's capital",
            /\bcapital\b/i
        ],
        excludeIfMatch: ['expenditure']
    },
    {
        id: 'statutory_reserve',
        keywords: [
            'additional paid-in capital',
            'reserves',
            'statutory reserve'
        ]
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
            'drawings',
            "owner's current account",
            "shareholders' current accounts"
        ],
        negativeIfMatch: ['drawings']
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
    onProcess?: (mode?: 'invoices' | 'all') => Promise<void> | void; // To trigger overall processing in App.tsx
    progress?: number;
    progressMessage?: string;
}

interface BreakdownEntry {
    description: string;
    debit: number;
    credit: number;
}

const ResultsStatCard = ({
    label,
    value,
    subValue,
    color = "text-white",
    icon
}: {
    label: string;
    value: string;
    subValue?: string;
    color?: string;
    icon?: React.ReactNode;
}) => (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-center justify-between shadow-sm">
        <div>
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
            {subValue && <p className="text-[10px] text-gray-500 font-mono mt-1">{subValue}</p>}
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

const roundAmount = (amount: number) => Math.round(Number(amount) || 0);
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


// Step titles for the Stepper component
const getStepperSteps = () => [
    "Review Categories",
    "Bank Summarization",
    "Upload Invoices", // New Step 3
    "Invoice Summarization", // New Step 4
    "Bank Reconciliation",
    "VAT/Additional Docs",
    "VAT Summarization", // New Step 7
    "Opening Balances", // Step 8
    "Adjust Trial Balance", // Step 9
    "Profit & Loss", // Step 10
    "Balance Sheet", // Step 11
    "LOU Upload", // Step 12 (New)
    "CT Questionnaire", // Step 13 (was 12)
    "Generate Final Report" // Step 14 (was 13)
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
        onProcess,
        progress = 0,
        progressMessage = 'Processing...'
    } = props;

    const [currentStep, setCurrentStep] = useState(1);
    const [editedTransactions, setEditedTransactions] = useState<Transaction[]>([]);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(initialAccountData);
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    // State to hold extracted VAT summary details
    const [vatDetails, setVatDetails] = useState<Record<string, any>>({});
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [louFiles, setLouFiles] = useState<File[]>([]);
    // Fix: Declared isAutoCategorizing state
    const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
    const [isProcessingInvoices, setIsProcessingInvoices] = useState(false);
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

    // Preview Panel State
    const [previewPage, setPreviewPage] = useState(0);
    const [showPreviewPanel, setShowPreviewPanel] = useState(true);

    // Questionnaire State
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});

    const [pnlValues, setPnlValues] = useState<Record<string, number>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, number>>({});

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

    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const pnlWorkingNotesInitializedRef = useRef(false);
    const bsWorkingNotesInitializedRef = useRef(false);

    const pnlManualEditsRef = useRef<Set<string>>(new Set());
    const bsManualEditsRef = useRef<Set<string>>(new Set());

    // Final Report Editable Form State
    const [reportForm, setReportForm] = useState<any>({});

    // Breakdown / Working Note State
    const [workingNoteModalOpen, setWorkingNoteModalOpen] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);
    const [tempBreakdown, setTempBreakdown] = useState<BreakdownEntry[]>([]);

    const handleOpenWorkingNote = (accountLabel: string) => {
        setCurrentWorkingAccount(accountLabel);
        const existing = breakdowns[accountLabel] || [];
        setTempBreakdown(JSON.parse(JSON.stringify(existing.length ? existing : [])));
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
        if (Object.keys(breakdowns).length === 0) return;

        setAdjustedTrialBalance(prevData => {
            if (!prevData) return null;

            // 1. Update individual rows based on breakdowns
            const updatedRows = prevData.map(item => {
                const accountKey = item.account; // maintain original key for matching
                // Check if we have a breakdown for this account (exact match or trimmed)
                const breakdownEntry = breakdowns[accountKey] || breakdowns[accountKey.trim()];

                if (breakdownEntry) {
                    const totalDebit = breakdownEntry.reduce((sum, e) => sum + (e.debit || 0), 0);
                    const totalCredit = breakdownEntry.reduce((sum, e) => sum + (e.credit || 0), 0);
                    return { ...item, debit: totalDebit, credit: totalCredit };
                }
                return item;
            });

            // 2. Recalculate Totals
            const dataRows = updatedRows.filter(r => r.account.toLowerCase() !== 'totals');
            const newTotalDebit = dataRows.reduce((sum, r) => sum + (r.debit || 0), 0);
            const newTotalCredit = dataRows.reduce((sum, r) => sum + (r.credit || 0), 0);

            // 3. Update or Append Totals Row
            const totalsIndex = updatedRows.findIndex(r => r.account.toLowerCase() === 'totals');
            const totalsRow = { account: 'Totals', debit: newTotalDebit, credit: newTotalCredit };

            if (totalsIndex !== -1) {
                updatedRows[totalsIndex] = totalsRow;
            } else {
                updatedRows.push(totalsRow);
            }

            return updatedRows;
        });

    }, [breakdowns]);

    const tbFileInputRef = useRef<HTMLInputElement>(null);

    const uniqueFiles = useMemo(() => Array.from(new Set(editedTransactions.map(t => t.sourceFile).filter(Boolean))), [editedTransactions]);

    useEffect(() => {
        if (transactions && transactions.length > 0) {
            const normalized = transactions.map(t => {
                const resolved = resolveCategoryPath(t.category);
                const displayCurrency = t.originalCurrency || t.currency || 'AED';
                return { ...t, category: resolved, currency: displayCurrency };
            });

            // Identify and add unrecognized categories to customCategories
            setCustomCategories(prev => {
                const newCustoms = new Set(prev);
                let changed = false;
                normalized.forEach(t => {
                    // If category exists, doesn't contain pipe (implied not in CoA paths), and not already known
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
    // Auto-advance step effect removed to fix back button navigation issues.
    // The user will manually click "Continue" or "Extract" to proceed.

    // Handle initial reset state when appState is initial (e.g. fresh load or after a full reset from App.tsx)
    useEffect(() => {
        // Fix: Use appState from props
        if (appState === 'initial' && currentStep !== 1) {
            setCurrentStep(1);
        }

        // No auto-advance here; invoice extraction advances in the handler to avoid remount resets.
    }, [appState, currentStep, isProcessingInvoices]);

    const handleContinueToLOU = useCallback(() => {
        setCurrentStep(12);
    }, []);

    const handleContinueToQuestionnaire = useCallback(() => {
        setCurrentStep(13);
    }, []);

    const handleContinueToReport = useCallback(() => {
        setCurrentStep(14);
    }, []);

    const calculatePnLTotals = useCallback((values: Record<string, number>) => {
        const revenue = values.revenue || 0;
        const costOfRevenue = values.cost_of_revenue || 0;
        const grossProfit = revenue - costOfRevenue;

        const totalComprehensive = (values.gain_revaluation_property || 0)
            + (values.share_gain_loss_revaluation_associates || 0)
            + (values.changes_fair_value_available_sale || 0)
            + (values.changes_fair_value_available_sale_reclassified || 0)
            + (values.exchange_difference_translating || 0);

        const profitLossYear = grossProfit
            + (values.other_income || 0)
            + (values.unrealised_gain_loss_fvtpl || 0)
            + (values.share_profits_associates || 0)
            + (values.gain_loss_revaluation_property || 0)
            - (values.impairment_losses_ppe || 0)
            - (values.impairment_losses_intangible || 0)
            - (values.business_promotion_selling || 0)
            - (values.foreign_exchange_loss || 0)
            - (values.selling_distribution_expenses || 0)
            - (values.administrative_expenses || 0)
            - (values.finance_costs || 0)
            - (values.depreciation_ppe || 0);

        const totalComprehensiveIncome = profitLossYear + totalComprehensive;
        const profitAfterTax = profitLossYear - (values.provisions_corporate_tax || 0);

        return {
            gross_profit: grossProfit,
            profit_loss_year: profitLossYear,
            total_comprehensive_income: totalComprehensiveIncome,
            profit_after_tax: profitAfterTax
        };
    }, []);

    const calculateBalanceSheetTotals = useCallback((values: Record<string, number>) => {
        const totalNonCurrentAssets = (values.property_plant_equipment || 0)
            + (values.intangible_assets || 0);

        const totalCurrentAssets = (values.cash_bank_balances || 0)
            + (values.inventories || 0)
            + (values.trade_receivables || 0)
            + (values.advances_deposits_receivables || 0)
            + (values.related_party_transactions_assets || 0);

        const totalAssets = totalNonCurrentAssets + totalCurrentAssets;

        const totalEquity = (values.share_capital || 0)
            + (values.statutory_reserve || 0)
            + (values.retained_earnings || 0)
            + (values.shareholders_current_accounts || 0);

        const totalNonCurrentLiabilities = (values.employees_end_service_benefits || 0)
            + (values.bank_borrowings_non_current || 0);

        const totalCurrentLiabilities = (values.short_term_borrowings || 0)
            + (values.related_party_transactions_liabilities || 0)
            + (values.trade_other_payables || 0);

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
    }, []);

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

    const statementReconciliationData = useMemo(() => {
        const isAllFiles = summaryFileFilter === 'ALL';
        const filesToReconcile = isAllFiles ? uniqueFiles : uniqueFiles.filter(f => f === summaryFileFilter);

        return filesToReconcile.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);

            const originalCurrency = fileTransactions.find(t => t.originalCurrency)?.originalCurrency
                || fileTransactions.find(t => t.currency)?.currency
                || 'AED';

            const totalDebitOriginal = fileTransactions.reduce((sum, t) => sum + ((t.originalDebit !== undefined) ? t.originalDebit : (t.debit || 0)), 0);
            const totalCreditOriginal = fileTransactions.reduce((sum, t) => sum + ((t.originalCredit !== undefined) ? t.originalCredit : (t.credit || 0)), 0);
            const totalDebitAed = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCreditAed = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);

            const openingBalanceOriginal = stmtSummary?.originalOpeningBalance !== undefined
                ? stmtSummary.originalOpeningBalance
                : (stmtSummary?.openingBalance || 0);
            const closingBalanceOriginal = stmtSummary?.originalClosingBalance !== undefined
                ? stmtSummary.originalClosingBalance
                : (stmtSummary?.closingBalance || 0);

            const openingBalanceAed = stmtSummary?.openingBalance || openingBalanceOriginal;
            const closingBalanceAed = stmtSummary?.closingBalance || closingBalanceOriginal;

            const calculatedClosingOriginal = openingBalanceOriginal - totalDebitOriginal + totalCreditOriginal;
            const calculatedClosingAed = openingBalanceAed - totalDebitAed + totalCreditAed;

            const diffOriginal = Math.abs(calculatedClosingOriginal - closingBalanceOriginal);
            const diffAed = Math.abs(calculatedClosingAed - closingBalanceAed);

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
                isValid: isAllFiles ? diffAed < 0.1 : diffOriginal < 0.1,
                diff: isAllFiles ? diffAed : diffOriginal,
                currency: originalCurrency
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions, summaryFileFilter]);

    const invoiceTotals = useMemo(() => {
        const salesAmount = salesInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || inv.totalBeforeTax || 0), 0);
        const salesVat = salesInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || inv.totalTax || 0), 0);
        const purchaseAmount = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || inv.totalBeforeTax || 0), 0);
        const purchaseVat = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || inv.totalTax || 0), 0);

        return { salesAmount, salesVat, purchaseAmount, purchaseVat };
    }, [salesInvoices, purchaseInvoices]);

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
            Object.entries(totals).forEach(([id, value]) => {
                if (!pnlManualEditsRef.current.has(id)) {
                    updated[id] = value;
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
            Object.entries(totals).forEach(([id, value]) => {
                if (!bsManualEditsRef.current.has(id)) {
                    updated[id] = value;
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


    const activeSummary = useMemo(() => {
        const currentKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        if (currentKey && fileSummaries && fileSummaries[currentKey]) {
            return fileSummaries[currentKey];
        }
        return summary;
    }, [selectedFileFilter, fileSummaries, summary, uniqueFiles]);

    const allFilesBalancesAed = useMemo(() => {
        if (!uniqueFiles.length) {
            return {
                opening: summary?.openingBalance || 0,
                closing: summary?.closingBalance || 0
            };
        }
        return uniqueFiles.reduce(
            (totals, fileName) => {
                const stmt = fileSummaries?.[fileName];
                totals.opening += stmt?.openingBalance || 0;
                totals.closing += stmt?.closingBalance || 0;
                return totals;
            },
            { opening: 0, closing: 0 }
        );
    }, [uniqueFiles, fileSummaries, summary]);

    const filteredTransactions = useMemo(() => {
        let txs = editedTransactions.map((t, i) => ({ ...t, originalIndex: i }));
        if (selectedFileFilter !== 'ALL') {
            txs = txs.filter(t => t.sourceFile === selectedFileFilter);
        }
        return txs.filter(t => {
            const desc = String(typeof t.description === 'string' ? t.description : JSON.stringify(t.description || '')).toLowerCase();
            const matchesSearch = desc.includes(searchTerm.toLowerCase());
            const isUncategorized = !t.category || t.category.toLowerCase().includes('uncategorized');
            const matchesCategory = filterCategory === 'ALL'
                || (filterCategory === 'UNCATEGORIZED' ? isUncategorized : resolveCategoryPath(t.category) === filterCategory);
            return matchesSearch && matchesCategory;
        });
    }, [editedTransactions, searchTerm, filterCategory, selectedFileFilter]);

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

    const renderCategoryOptions = useMemo(() => {
        const options: React.ReactNode[] = [];
        options.push(<option key="__NEW__" value="__NEW__" className="text-blue-400 font-bold bg-gray-900">+ Add New Category</option>);

        Object.entries(CHART_OF_ACCOUNTS).forEach(([main, sub]) => {
            const groupOptions: React.ReactNode[] = [];

            // 1. Add Standard Items
            if (Array.isArray(sub)) {
                sub.forEach(item => {
                    groupOptions.push(
                        <option key={`${main} | ${item}`} value={`${main} | ${item}`} className="bg-gray-900 text-white">
                            {item}
                        </option>
                    );
                });
            } else if (typeof sub === 'object') {
                Object.entries(sub).forEach(([sg, items]) => {
                    (items as string[]).forEach(item => {
                        groupOptions.push(
                            <option key={`${main} | ${sg} | ${item}`} value={`${main} | ${sg} | ${item}`} className="bg-gray-900 text-white">
                                {item}
                            </option>
                        );
                    });
                });
            }

            // 2. Add Custom Items belonging to this Main Category
            const relatedCustoms = customCategories.filter(c => c.startsWith(`${main} |`));
            relatedCustoms.forEach(c => {
                groupOptions.push(
                    <option key={c} value={c} className="bg-gray-800 text-blue-200 font-medium">
                        {getChildCategory(c)} (Custom)
                    </option>
                );
            });

            if (groupOptions.length > 0) {
                options.push(
                    <optgroup label={main} key={main}>
                        {groupOptions}
                    </optgroup>
                );
            }
        });

        // Handle any orphans (shouldn't happen with current creation logic, but good fallback)
        const orphanCustoms = customCategories.filter(c => !Object.keys(CHART_OF_ACCOUNTS).some(main => c.startsWith(`${main} |`)));
        if (orphanCustoms.length > 0) {
            options.push(
                <optgroup label="Other Custom" key="Other Custom">
                    {orphanCustoms.map(c => (
                        <option key={c} value={c} className="bg-gray-800 text-blue-200 font-medium">
                            {getChildCategory(c)}
                        </option>
                    ))}
                </optgroup>
            );
        }

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
        // Direct flow: Yes -> Step 6 (VAT Docs), No -> Step 7 (Opening Balances)
        setShowVatFlowModal(false);
        if (answer) {
            setCurrentStep(6);
        } else {
            setCurrentStep(7);
        }
    }, []);

    const handleExtractAdditionalData = useCallback(async () => {
        if (additionalFiles.length === 0) return;
        setIsExtracting(true);
        try {
            const partsArrays = await Promise.all(additionalFiles.map(file => convertFileToParts(file)));
            const parts = partsArrays.flat();
            // Always treat files in this step as VAT documents for extraction
            const details = await extractVatCertificateData(parts);
            const parseAmount = (value: unknown): number | null => {
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                if (typeof value === 'string') {
                    const cleaned = value.replace(/[^0-9.\-]/g, '');
                    const parsed = parseFloat(cleaned);
                    return Number.isFinite(parsed) ? parsed : null;
                }
                return null;
            };
            const isValidNumber = (value: unknown) =>
                typeof value === 'number' && Number.isFinite(value) && value >= 0;
            let fallbackTotals = null as null | { salesTotal: number; expensesTotal: number };

            if (
                !isValidNumber(details?.standardRatedSuppliesAmount) &&
                !isValidNumber(details?.standardRatedExpensesAmount)
            ) {
                try {
                    fallbackTotals = (await extractVat201Totals(parts)) as { salesTotal: number; expensesTotal: number };
                } catch (fallbackError) {
                    console.warn("VAT201 fallback extraction failed:", fallbackError);
                }
            }
            // Store VAT specific fields separately
            const suppliesAmount = parseAmount(details?.standardRatedSuppliesAmount);
            const suppliesVat = parseAmount(details?.standardRatedSuppliesVatAmount);
            const expensesAmount = parseAmount(details?.standardRatedExpensesAmount);
            const expensesVat = parseAmount(details?.standardRatedExpensesVatAmount);

            setVatDetails({
                standardRatedSuppliesAmount: isValidNumber(suppliesAmount)
                    ? suppliesAmount
                    : fallbackTotals?.salesTotal || 0,
                standardRatedSuppliesVatAmount: isValidNumber(suppliesVat)
                    ? suppliesVat
                    : 0,
                standardRatedExpensesAmount: isValidNumber(expensesAmount)
                    ? expensesAmount
                    : fallbackTotals?.expensesTotal || 0,
                standardRatedExpensesVatAmount: isValidNumber(expensesVat)
                    ? expensesVat
                    : 0,
            });
            setCurrentStep(7); // Auto-advance to VAT Summarization
        } catch (e) {
            console.error("Failed to extract additional details", e);
        } finally {
            setIsExtracting(false);
        }
    }, [additionalFiles]);

    const handleExtractOpeningBalances = useCallback(async () => {
        if (openingBalanceFiles.length === 0) return;
        setIsExtractingOpeningBalances(true);
        try {
            const partsArrays = await Promise.all(openingBalanceFiles.map(convertFileToParts));
            const parts = partsArrays.flat();
            const details = await extractGenericDetailsFromDocuments(parts);

            if (details) {
                setOpeningBalancesData(prev => {
                    const newData = [...prev];
                    Object.entries(details).forEach(([key, value]) => {
                        const amount = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
                        if (isNaN(amount)) return;

                        const normalizedKey = key.toLowerCase().replace(/_/g, ' ');

                        // Find matching account in Assets, Liabilities, or Equity
                        let found = false;
                        newData.forEach(category => {
                            category.accounts.forEach(account => {
                                if (found) return;
                                if (account.name.toLowerCase() === normalizedKey || normalizedKey.includes(account.name.toLowerCase())) {
                                    if (category.category === 'Assets') {
                                        account.debit = amount;
                                        account.credit = 0;
                                    } else {
                                        account.credit = amount;
                                        account.debit = 0;
                                    }
                                    found = true;
                                }
                            });
                        });
                    });
                    return newData;
                });
            }
        } catch (e) {
            console.error("Failed to extract opening balances", e);
            alert("Failed to extract data. Please ensure the documents are clear and try again.");
        } finally {
            setIsExtractingOpeningBalances(false);
        }
    }, [openingBalanceFiles]);

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

    const handleExportStepReport = useCallback(() => {
        const data = getFinalReportExportData();
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Styling
        ws['!cols'] = [{ wch: 60 }, { wch: 40 }];

        const range = XLSX.utils.decode_range(ws['!ref'] || "A1:B1");
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellA = ws[XLSX.utils.encode_cell({ c: 0, r: R })];
            const cellB = ws[XLSX.utils.encode_cell({ c: 1, r: R })];

            if (cellA) {
                if (!cellA.s) cellA.s = {};
                // Section Headers
                const isSectionHeader = REPORT_STRUCTURE.some(s => s.title.toUpperCase() === cellA.v);
                if (isSectionHeader) {
                    cellA.s = {
                        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
                        fill: { fgColor: { rgb: "1E40AF" } }, // blue-800
                        alignment: { vertical: "center" }
                    };
                }
                // Field Headers (within sections)
                else {
                    cellA.s = {
                        font: { bold: true, sz: 10 },
                        alignment: { vertical: "center" }
                    };
                }
            }

            if (cellB && typeof cellB.v === 'number') {
                if (!cellB.s) cellB.s = {};
                cellB.z = '#,##0.00';
                cellB.s.alignment = { horizontal: "right" };
            }
        }

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Final Report");
        XLSX.writeFile(wb, `${companyName.replace(/\s/g, '_')}_Final_Report.xlsx`);
    }, [getFinalReportExportData, companyName]);

    const handleContinueToProfitAndLoss = useCallback(() => {
        setCurrentStep(10);
    }, []);

    const handleContinueToBalanceSheet = useCallback(() => {
        setCurrentStep(11);
    }, []);


    const handleReportFormChange = useCallback((field: string, value: any) => {
        setReportForm((prev: any) => ({ ...prev, [field]: value }));
    }, []);

    const handleOpeningBalancesComplete = useCallback(() => {
        // 1. Calculate actual total closing balance from bank statements
        const totalActualClosingBalance = editedTransactions.reduce((sum, t) => sum + (t.credit || 0) - (t.debit || 0), 0) + (summary?.openingBalance || 0);

        // 2. Map Opening Balances (Step 8)
        const obEntries: TrialBalanceEntry[] = openingBalancesData.flatMap(cat =>
            cat.accounts
                .filter(acc => acc.debit > 0 || acc.credit > 0)
                .map(acc => ({ account: acc.name, debit: acc.debit, credit: acc.credit }))
        );

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
    }, [editedTransactions, summary, openingBalancesData, summaryData]);

    const handleExportToExcel = useCallback(() => {
        if (!adjustedTrialBalance || !ftaFormValues) return;
        const workbook = XLSX.utils.book_new();

        // --- Sheet 1: Step 1 - Bank Transactions ---
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
            applySheetStyling(ws1, 1);
            XLSX.utils.book_append_sheet(workbook, ws1, 'Step 1 - Bank Transactions');
        }

        // --- Sheet 2: Step 2 - Bank Summary ---
        if (summaryData.length > 0) {
            const step2Data = summaryData.map(s => ({
                "Category": s.category,
                "Debit (AED)": s.debit,
                "Credit (AED)": s.credit
            }));
            const totalDebit = summaryData.reduce((sum, d) => sum + d.debit, 0);
            const totalCredit = summaryData.reduce((sum, d) => sum + d.credit, 0);
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
        const invoiceData: any[] = [["SALES INVOICES"], ["Invoice #", "Customer", "Date", "Status", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"]];
        salesInvoices.forEach(inv => {
            const customerName = inv.customerName || inv.vendorName || (inv as any).partyName || 'N/A';
            invoiceData.push([
                inv.invoiceId || (inv as any).invoiceNumber || 'N/A',
                customerName,
                formatDate(inv.invoiceDate || (inv as any).date),
                (inv as any).status || 'N/A',
                inv.totalBeforeTaxAED || inv.totalBeforeTax,
                inv.totalTaxAED || inv.totalTax,
                inv.totalAmountAED || inv.totalAmount
            ]);
        });
        invoiceData.push([], ["PURCHASE INVOICES"], ["Invoice #", "Supplier", "Date", "Status", "Pre-Tax (AED)", "VAT (AED)", "Total (AED)"]);
        purchaseInvoices.forEach(inv => {
            const supplierName = inv.vendorName || inv.customerName || (inv as any).partyName || 'N/A';
            invoiceData.push([
                inv.invoiceId || (inv as any).invoiceNumber || 'N/A',
                supplierName,
                formatDate(inv.invoiceDate || (inv as any).date),
                (inv as any).status || 'N/A',
                inv.totalBeforeTaxAED || inv.totalBeforeTax,
                inv.totalTaxAED || inv.totalTax,
                inv.totalAmountAED || inv.totalAmount
            ]);
        });
        const ws4 = XLSX.utils.aoa_to_sheet(invoiceData);
        ws4['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 15 }, { wch: 18 }];
        applySheetStyling(ws4, 2);
        XLSX.utils.book_append_sheet(workbook, ws4, 'Step 4 - Invoice Summary');

        // --- Sheet 5: Step 5 - Bank Reconciliation ---
        if (reconciliationData.length > 0) {
            const reconExport = reconciliationData.map(r => ({
                "Invoice #": r.invoice.invoiceNumber,
                "Partner": r.invoice.partyName,
                "Invoice Amount": r.invoice.totalAmountAED || r.invoice.totalAmount,
                "Bank Matches": r.transaction ? (r.transaction.credit || r.transaction.debit) : 'No Match',
                "Status": r.status
            }));
            const ws5 = XLSX.utils.json_to_sheet(reconExport);
            ws5['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 15 }];
            applySheetStyling(ws5, 1, 1);
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
            ["Standard Rated Supplies", vatDetails.standardRatedSuppliesAmount || 0],
            ["Standard Rated Supplies VAT", vatDetails.standardRatedSuppliesVatAmount || 0],
            ["Standard Rated Expenses", vatDetails.standardRatedExpensesAmount || 0],
            ["Standard Rated Expenses VAT", vatDetails.standardRatedExpensesVatAmount || 0]
        ];
        const ws7 = XLSX.utils.aoa_to_sheet(vatSummaryData);
        ws7['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(ws7, 2);
        XLSX.utils.book_append_sheet(workbook, ws7, 'Step 7 - VAT Summarization');

        // --- Sheet 8: Step 8 - Opening Balances ---
        if (openingBalancesData.length > 0) {
            const step8Data = openingBalancesData.flatMap(cat =>
                cat.accounts.map(acc => ({
                    Category: cat.category,
                    Account: acc.name,
                    Debit: acc.debit || null,
                    Credit: acc.credit || null
                }))
            );
            const ws8 = XLSX.utils.json_to_sheet(step8Data);
            ws8['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
            applySheetStyling(ws8, 1);
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

        // --- Sheet 14: Step 14 - Questionnaire ---
        const qRows: any[][] = [['CORPORATE TAX QUESTIONNAIRE'], []];
        CT_QUESTIONS.forEach(q => {
            qRows.push([q.text, questionnaireAnswers[q.id] || '-']);
        });
        if (questionnaireAnswers['curr_revenue'] || questionnaireAnswers['prev_revenue']) {
            qRows.push([], ['SUPPLEMENTARY DATA', 'VALUE']);
            qRows.push(['Operating Revenue of Current Period', questionnaireAnswers['curr_revenue'] || '0.00']);
            qRows.push(['Operating Revenue for Previous Period', questionnaireAnswers['prev_revenue'] || '0.00']);
        }
        const ws14 = XLSX.utils.aoa_to_sheet(qRows);
        ws14['!cols'] = [{ wch: 80 }, { wch: 20 }];
        applySheetStyling(ws14, 1);
        XLSX.utils.book_append_sheet(workbook, ws14, "Step 14 - Questionnaire");

        // --- Sheet 15: Step 15 - Final Report ---
        const finalReportData = getFinalReportExportData();
        const ws15 = XLSX.utils.aoa_to_sheet(finalReportData);
        ws15['!cols'] = [{ wch: 60 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, ws15, "Step 15 - Final Report");

        XLSX.writeFile(workbook, `${companyName.replace(/\s/g, '_')}_Complete_Type2_Export.xlsx`);
    }, [adjustedTrialBalance, ftaFormValues, editedTransactions, companyName, summaryData, salesInvoices, purchaseInvoices, reconciliationData, vatDetails, invoiceTotals, openingBalancesData, pnlValues, pnlStructure, pnlWorkingNotes, balanceSheetValues, bsStructure, bsWorkingNotes, questionnaireAnswers, louFiles, additionalFiles, invoiceFiles, breakdowns, getFinalReportExportData]);

    const handleExportStep1 = useCallback(() => {
        const wsData = editedTransactions.map(t => ({
            Date: formatDate(t.date),
            Description: typeof t.description === 'object' ? JSON.stringify(t.description) : t.description,
            Debit: t.debit || 0,
            Credit: t.credit || 0,
            Currency: t.currency || 'AED',
            Category: getChildCategory(t.category || ''),
            Confidence: (t.confidence || 0) + '%'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 40 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Categorized Transactions");
        XLSX.writeFile(wb, `${companyName}_Transactions_Step1.xlsx`);
    }, [editedTransactions, companyName]);

    const handleExportStepSummary = useCallback((data: any[]) => {
        const wsData = data.map(d => ({
            "Account": d.category,
            "Debit": d.debit,
            "Credit": d.credit
        }));
        const totalDebit = data.reduce((s, d) => s + d.debit, 0);
        const totalCredit = data.reduce((s, d) => s + d.credit, 0);
        wsData.push({
            "Account": "Grand Total",
            "Debit": totalDebit,
            "Credit": totalCredit
        });

        const ws = XLSX.utils.json_to_sheet(wsData);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1, 1);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Summarization");
        XLSX.writeFile(wb, `${companyName}_Summarization_Step2.xlsx`);
    }, [companyName]);

    const handleExportStepOpeningBalances = useCallback(() => {
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
        XLSX.writeFile(wb, `${companyName}_Opening_Balances.xlsx`);
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
            className={`w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 focus:ring-0 p-1 text-white transition-all text-xs font-medium outline-none ${className}`}
        />
    );

    const ReportNumberInput = ({ field, className = "" }: { field: string, className?: string }) => (
        <input
            type="number"
            step="0.01"
            value={(Math.round(((reportForm[field] || 0) + Number.EPSILON) * 100) / 100).toFixed(2)}
            onChange={(e) => handleReportFormChange(field, parseFloat(e.target.value) || 0)}
            className={`w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 focus:ring-0 p-1 text-right font-mono text-white transition-all text-xs font-bold outline-none ${className}`}
        />
    );


    const renderStep1 = () => {
        const currentPreviewKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
        const hasPreviews = !!(currentPreviewKey && statementPreviewUrls);
        const isAllFiles = selectedFileFilter === 'ALL';

        const aggregatedOpening = allFilesBalancesAed.opening;
        const aggregatedClosing = allFilesBalancesAed.closing;

        const selectedSummary = (!isAllFiles && currentPreviewKey && fileSummaries)
            ? fileSummaries[currentPreviewKey]
            : activeSummary;
        const selectedTransactions = !isAllFiles
            ? editedTransactions.filter(t => t.sourceFile === currentPreviewKey)
            : [];
        const selectedCurrency = selectedTransactions.find(t => t.originalCurrency)?.originalCurrency
            || selectedTransactions.find(t => t.currency)?.currency
            || currency
            || 'AED';

        const openingOriginal = selectedSummary?.originalOpeningBalance ?? selectedSummary?.openingBalance ?? 0;
        const closingOriginal = selectedSummary?.originalClosingBalance ?? selectedSummary?.closingBalance ?? 0;
        const openingAed = selectedSummary?.openingBalance ?? openingOriginal;
        const closingAed = selectedSummary?.closingBalance ?? closingOriginal;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <ResultsStatCard
                        label="Opening Balance"
                        value={isAllFiles ? `${formatNumber(aggregatedOpening)} AED` : `${formatNumber(openingOriginal)} ${selectedCurrency}`}
                        subValue={isAllFiles ? undefined : `${formatNumber(openingAed)} AED`}
                        color="text-blue-300"
                        icon={<ArrowUpRightIcon className="w-4 h-4" />}
                    />
                    <ResultsStatCard
                        label="Closing Balance"
                        value={isAllFiles ? `${formatNumber(aggregatedClosing)} AED` : `${formatNumber(closingOriginal)} ${selectedCurrency}`}
                        subValue={isAllFiles ? undefined : `${formatNumber(closingAed)} AED`}
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
                            <button
                                onClick={handleBulkDelete}
                                disabled={selectedIndices.size === 0}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded disabled:opacity-50"
                            >
                                <span className="inline-flex items-center gap-1">
                                    <TrashIcon className="w-3 h-3" />
                                    Delete
                                </span>
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
                                        <th className="px-4 py-3">Currency</th>
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
                                            <td className="px-4 py-2 text-right font-mono">
                                                {t.originalDebit !== undefined ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-red-400 text-xs">{formatNumber(t.originalDebit)}</span>
                                                        <span className="text-[9px] text-gray-500 font-sans tracking-tighter">({formatNumber(t.debit)} AED)</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-red-400">{t.debit > 0 ? formatNumber(t.debit) : '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {t.originalCredit !== undefined ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-green-400 text-xs">{formatNumber(t.originalCredit)}</span>
                                                        <span className="text-[9px] text-gray-500 font-sans tracking-tighter">({formatNumber(t.credit)} AED)</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-green-400">{t.credit > 0 ? formatNumber(t.credit) : '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-[10px] text-gray-500 font-black uppercase tracking-widest text-center">
                                                {t.originalCurrency || t.currency || 'AED'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <select
                                                    value={t.category || 'UNCATEGORIZED'}
                                                    onChange={(e) => handleCategorySelection(e.target.value, { type: 'row', rowIndex: t.originalIndex })}
                                                    className={`w-full bg-gray-900/70 text-xs p-1 rounded border ${(!t.category || t.category.toLowerCase().includes('uncategorized')) ? 'border-red-500/50 text-red-200' : 'border-gray-700 text-gray-100'
                                                        } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none`}
                                                >
                                                    <option value="UNCATEGORIZED">Uncategorized</option>
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
                                            <td colSpan={8} className="text-center py-10 text-gray-500">No transactions found.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {showPreviewPanel && statementPreviewUrls.length > 0 && (
                            <div className="w-[40%] bg-gray-900 rounded-lg border border-gray-700 flex flex-col h-full overflow-hidden">
                                <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bank Statement Preview</h4>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                                            disabled={previewPage === 0}
                                            className="p-1 hover:bg-gray-800 rounded disabled:opacity-50 text-gray-400"
                                        >
                                            <ChevronLeftIcon className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs text-gray-500 font-mono">
                                            {previewPage + 1} / {statementPreviewUrls.length}
                                        </span>
                                        <button
                                            onClick={() => setPreviewPage(Math.min(statementPreviewUrls.length - 1, previewPage + 1))}
                                            disabled={previewPage === statementPreviewUrls.length - 1}
                                            className="p-1 hover:bg-gray-800 rounded disabled:opacity-50 text-gray-400"
                                        >
                                            <ChevronRightIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => setShowPreviewPanel(false)} className="mx-1 text-gray-500 hover:text-white">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-900/50">
                                    {statementPreviewUrls[previewPage] ? (
                                        <img
                                            src={statementPreviewUrls[previewPage]}
                                            alt={`Page ${previewPage + 1}`}
                                            className="max-w-full shadow-lg border border-gray-800"
                                        />
                                    ) : (
                                        <div className="text-gray-500 text-xs flex flex-col items-center justify-center h-full">
                                            <DocumentTextIcon className="w-8 h-8 mb-2 opacity-20" />
                                            <span>No preview available</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {!showPreviewPanel && statementPreviewUrls.length > 0 && (
                            <button
                                onClick={() => setShowPreviewPanel(true)}
                                className="absolute right-0 top-0 m-2 p-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg hover:bg-gray-700 text-gray-400 hover:text-white z-20"
                                title="Show Preview"
                            >
                                <EyeIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-700">
                    <div className="text-sm text-gray-400">
                        <span className="text-white font-bold">{editedTransactions.filter(t => !t.category || t.category.toLowerCase().includes('uncategorized')).length}</span> uncategorized items remaining.
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExportStep1} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">
                            Download Work in Progress
                        </button>
                        <button onClick={handleConfirmCategories} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                            Continue to Summarization
                        </button>
                    </div>
                </div>
            </div >
        );
    };

    const renderStep2Summarization = () => {
        const totalDebit = summaryData.reduce((sum, row) => sum + row.debit, 0);
        const totalCredit = summaryData.reduce((sum, row) => sum + row.credit, 0);
        const summaryCurrency = summaryFileFilter === 'ALL' ? 'AED' : (statementReconciliationData[0]?.currency || 'AED');

        return (
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
                            <button onClick={() => handleExportStepSummary(summaryData)} className="text-gray-400 hover:text-white"><DocumentArrowDownIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                    {/* Summarized View */}
                    <div className="overflow-x-auto rounded-lg border border-gray-700">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3">Accounts</th>
                                    <th className="px-6 py-3 text-right">Debit {summaryFileFilter !== 'ALL' ? `(${summaryCurrency})` : '(AED)'}</th>
                                    <th className="px-6 py-3 text-right">Credit {summaryFileFilter !== 'ALL' ? `(${summaryCurrency})` : '(AED)'}</th>
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
                            </tbody>
                            <tfoot className="bg-gray-800/80 font-bold border-t border-gray-700">
                                <tr>
                                    <td className="px-6 py-3 text-white uppercase tracking-wider">
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
                                {statementReconciliationData.map((recon, idx) => (
                                    <tr key={idx} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-3 text-white font-medium truncate max-w-xs" title={recon.fileName}>{recon.fileName}</td>
                                        <td className="px-6 py-3 text-right font-mono text-blue-200">
                                            {summaryFileFilter === 'ALL' ? (
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.openingBalance)} {recon.currency}</span>
                                                    <span className="text-[10px] text-gray-500">{formatNumber(recon.openingBalanceAed)} AED</span>
                                                </div>
                                            ) : (
                                                <span>{formatNumber(recon.openingBalance)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-red-400">
                                            {summaryFileFilter === 'ALL' ? (
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.totalDebit)} {recon.currency}</span>
                                                    <span className="text-[10px] text-gray-500">{formatNumber(recon.totalDebitAed)} AED</span>
                                                </div>
                                            ) : (
                                                <span>{formatNumber(recon.totalDebit)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-green-400">
                                            {summaryFileFilter === 'ALL' ? (
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.totalCredit)} {recon.currency}</span>
                                                    <span className="text-[10px] text-gray-500">{formatNumber(recon.totalCreditAed)} AED</span>
                                                </div>
                                            ) : (
                                                <span>{formatNumber(recon.totalCredit)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-blue-300 font-bold">
                                            {summaryFileFilter === 'ALL' ? (
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.calculatedClosing)} {recon.currency}</span>
                                                    <span className="text-[10px] text-gray-500">{formatNumber(recon.calculatedClosingAed)} AED</span>
                                                </div>
                                            ) : (
                                                <span>{formatNumber(recon.calculatedClosing)}</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-white">
                                            {summaryFileFilter === 'ALL' ? (
                                                <div className="flex flex-col items-end">
                                                    <span>{formatNumber(recon.closingBalance)} {recon.currency}</span>
                                                    <span className="text-[10px] text-gray-500">{formatNumber(recon.closingBalanceAed)} AED</span>
                                                </div>
                                            ) : (
                                                <span>{formatNumber(recon.closingBalance)}</span>
                                            )}
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
                                            <span className="text-[10px] text-gray-400">{recon.currency}</span>
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
                    <button onClick={handleConfirmSummarization} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        );
    };

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
                        onClick={() => {
                            if (!onProcess) return;
                            setIsProcessingInvoices(true);
                            Promise.resolve(onProcess('invoices'))
                                .then(() => setCurrentStep(4))
                                .catch((err) => {
                                    console.error("Invoice extraction failed:", err);
                                    alert("Invoice extraction failed. Please try again.");
                                })
                                .finally(() => setIsProcessingInvoices(false));
                        }}
                        className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        Extract Invoices
                    </button>
                </div>
            )}

            {isProcessingInvoices && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-xl mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
                        <LoadingIndicator
                            progress={progress || 60}
                            statusText={progressMessage || "Analyzing invoices..."}
                            title="Analyzing Document"
                        />
                    </div>
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
                        <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 flex flex-col min-h-[450px] justify-center items-center text-center">
                            <div className="mb-6">
                                <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <SparklesIcon className="w-8 h-8 text-blue-400" />
                                </div>
                                <h4 className="text-xl font-bold text-white tracking-tight mb-2">Ready to Extract</h4>
                                <p className="text-gray-400 max-w-xs mx-auto text-sm">Upload your VAT Return document. We will identify Standard Rated Supplies & Expenses automatically.</p>
                            </div>

                            <button
                                onClick={handleExtractAdditionalData}
                                disabled={additionalFiles.length === 0 || isExtracting}
                                className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                            >
                                {isExtracting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                        Processing...
                                    </>
                                ) : (
                                    'Extract & Continue'
                                )}
                            </button>
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
        </div >
    );

    const renderStep7VatSummarization = () => {
        const reconciliationData = [
            {
                label: 'Standard Rated Supplies (Sales)',
                certAmount: vatDetails.standardRatedSuppliesAmount || 0,
                invoiceAmount: invoiceTotals.salesAmount,
                certVat: vatDetails.standardRatedSuppliesVatAmount || 0,
                invoiceVat: invoiceTotals.salesVat,
                icon: ArrowUpRightIcon,
                color: 'text-green-400'
            },
            {
                label: 'Standard Rated Expenses (Purchases)',
                certAmount: vatDetails.standardRatedExpensesAmount || 0,
                invoiceAmount: invoiceTotals.purchaseAmount,
                certVat: vatDetails.standardRatedExpensesVatAmount || 0,
                invoiceVat: invoiceTotals.purchaseVat,
                icon: ArrowDownIcon,
                color: 'text-red-400'
            }
        ];

        const isMatch = (val1: number, val2: number) => Math.abs(val1 - val2) < 2;

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50 flex justify-between items-center">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/5">
                                <ChartBarIcon className="w-8 h-8 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">VAT Summarization & Reconciliation</h3>
                                <p className="text-gray-400 mt-1">Comparing VAT Certificate figures with extracted Invoice totals.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8 space-y-10">
                        {/* Comparison Table */}
                        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0F172A]/30">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#0F172A] border-b border-gray-800">
                                        <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Description</th>
                                        <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">VAT Certificate</th>
                                        <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Invoice Sum</th>
                                        <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-center text-right">Difference</th>
                                        <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {reconciliationData.map((item, idx) => {
                                        const amountDiff = item.certAmount - item.invoiceAmount;
                                        const vatDiff = item.certVat - item.invoiceVat;
                                        const amountMatched = isMatch(item.certAmount, item.invoiceAmount);
                                        const vatMatched = isMatch(item.certVat, item.invoiceVat);

                                        return (
                                            <React.Fragment key={idx}>
                                                {/* Amount Row */}
                                                <tr className="hover:bg-gray-800/30 transition-colors">
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-3">
                                                            <item.icon className={`w-5 h-5 ${item.color}`} />
                                                            <div>
                                                                <p className="text-sm font-bold text-white">{item.label}</p>
                                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Net Amount</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-white">
                                                        {formatNumber(item.certAmount)}
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-gray-300">
                                                        {formatNumber(item.invoiceAmount)}
                                                    </td>
                                                    <td className={`p-5 text-right font-mono text-sm ${amountMatched ? 'text-gray-500' : 'text-orange-400'}`}>
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
                                                {/* VAT Row */}
                                                <tr className="hover:bg-gray-800/30 transition-colors bg-[#0F172A]/10">
                                                    <td className="p-5 pl-12">
                                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">VAT (5%)</p>
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-white">
                                                        {formatNumber(item.certVat)}
                                                    </td>
                                                    <td className="p-5 text-right font-mono text-sm text-gray-300">
                                                        {formatNumber(item.invoiceVat)}
                                                    </td>
                                                    <td className={`p-5 text-right font-mono text-sm ${vatMatched ? 'text-gray-500' : 'text-orange-400'}`}>
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
                            <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                                    <ChartBarIcon className="w-24 h-24 text-white" />
                                </div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                    Vat Certificate Summary
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                        <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Supplies</p>
                                        <p className="text-xl font-mono text-white">{formatNumber(vatDetails.standardRatedSuppliesAmount || 0)}</p>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                        <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Expenses</p>
                                        <p className="text-xl font-mono text-white">{formatNumber(vatDetails.standardRatedExpensesAmount || 0)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                                    <DocumentTextIcon className="w-24 h-24 text-white" />
                                </div>
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                    Invoice Calculation Sum
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                        <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Sales Sum</p>
                                        <p className="text-xl font-mono text-white">{formatNumber(invoiceTotals.salesAmount)}</p>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                        <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Purchase Sum</p>
                                        <p className="text-xl font-mono text-white">{formatNumber(invoiceTotals.purchaseAmount)}</p>
                                    </div>
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
                    <button
                        onClick={() => setCurrentStep(8)}
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                    >
                        Continue to Opening Balances
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        );
    };

    const renderStep8OpeningBalances = () => (
        <div className="space-y-6">
            <OpeningBalances
                onComplete={handleOpeningBalancesComplete}
                currency={currency}
                accountsData={openingBalancesData}
                onAccountsDataChange={setOpeningBalancesData}
                onExport={handleExportStepOpeningBalances}
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
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 bg-gray-950 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Adjust Trial Balance</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" />
                        <button onClick={handleExportStepAdjustTrialBalance} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
                            <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export
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
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Debit</span>
                                        <span className="font-mono text-white font-semibold">{formatWholeNumber(sec.totalDebit)}</span>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Credit</span>
                                        <span className="font-mono text-white font-semibold">{formatWholeNumber(sec.totalCredit)}</span>
                                    </div>
                                    {openTbSection === sec.title ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                                </div>
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
                                                            <td className="py-2 px-4 text-gray-300 font-medium">
                                                                <div className="flex items-center justify-between group">
                                                                    <span>{item.label}</span>
                                                                    <button
                                                                        onClick={() => handleOpenWorkingNote(item.label)}
                                                                        className="p-1.5 rounded transition-all text-gray-600 hover:text-white hover:bg-gray-700 opacity-0 group-hover:opacity-100"
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
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs"
                                                                />
                                                            </td>
                                                            <td className="py-1 px-2 text-right">
                                                                <input
                                                                    type="number"
                                                                    step="1"
                                                                    value={item.credit === 0 ? '' : Math.round(item.credit)}
                                                                    onChange={e => handleCellChange(item.label, 'credit', e.target.value)}
                                                                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs"
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
                <div className="p-6 bg-black border-t border-gray-800">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex gap-12">
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Debit</p><p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(roundedGrandTotal.debit)}</p></div>
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Credit</p><p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(roundedGrandTotal.credit)}</p></div>
                        </div>
                        <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(variance) < 1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                            {Math.abs(variance) < 1 ? 'Balanced' : `Variance: ${formatWholeNumber(variance)}`}
                        </div>
                    </div>
                    <div className="flex justify-between mt-8 border-t border-gray-800 pt-6">
                        <button onClick={handleBack} className="text-gray-400 hover:text-white font-bold transition-colors">Back</button>
                        <button onClick={handleContinueToProfitAndLoss} disabled={Math.abs(variance) >= 1} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                    </div>
                </div>
            </div>
        );
    };

    const pnlDisplayData = useMemo(() => {
        const data: Record<string, { currentYear: number; previousYear: number }> = {};
        pnlStructure.forEach(item => {
            if (item.type === 'item' || item.type === 'total') {
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
            if (item.type === 'item' || item.type === 'total') {
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
            onNext={handleContinueToLOU}
            onBack={handleBack}
            data={bsDisplayData}
            structure={bsStructure}
            onChange={handleBalanceSheetInputChange}
            onExport={handleExportStepBS}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
        />
    );

    const renderStep12LOU = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/5">
                            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Letter of Undertaking (LOU)</h3>
                            <p className="text-gray-400 mt-1 max-w-2xl">Upload Signed Letter of Undertaking for record purposes.</p>
                        </div>
                    </div>
                </div>
                <div className="p-8">
                    <div className="min-h-[400px]">
                        <FileUploadArea
                            title="Upload LOU Documents"
                            subtitle="Support PDF, JPG, PNG"
                            icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                            selectedFiles={louFiles}
                            onFilesSelect={setLouFiles}
                        />
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
                <button
                    onClick={handleContinueToQuestionnaire}
                    className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                >
                    Continue to Questionnaire
                    <ChevronRightIcon className="w-5 h-5 ml-2" />
                </button>
            </div>
        </div>
    );

    const renderStep13CtQuestionnaire = () => {
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
                <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-[#0F172A]/50">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                                <QuestionMarkCircleIcon className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight uppercase">Corporate Tax Questionnaire</h3>
                                <p className="text-sm text-gray-400 mt-1">Please provide additional details for final tax computation.</p>
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-800/50 px-4 py-2 rounded-full border border-gray-700">
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
                                        <div className="flex items-center gap-2 bg-[#0F172A] p-1 rounded-xl border border-gray-800 shrink-0 shadow-inner">
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
                                                            ? 'bg-blue-600 text-white shadow-lg'
                                                            : 'text-gray-500 hover:text-white hover:bg-gray-800'
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

                    <div className="p-8 bg-black border-t border-gray-800 flex justify-between items-center">
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

    const renderStep14FinalReport = () => {
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
                                Export Step 14
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-800">
                        {sections.map(section => (
                            <div key={section.id} className="group">
                                <button
                                    onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)}
                                    className="w-full flex items-center justify-between p-6 hover:bg-gray-800/30 transition-all text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2.5 rounded-xl border transition-all duration-500 ${openReportSection === section.title
                                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-lg shadow-blue-500/10'
                                            : 'bg-gray-800 border-gray-700 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-400'
                                            }`}>
                                            <section.icon className="w-5 h-5" />
                                        </div>
                                        <h4 className={`text-sm font-black uppercase tracking-widest transition-colors ${openReportSection === section.title ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                                            }`}>{section.title}</h4>
                                    </div>
                                    <ChevronDownIcon className={`w-5 h-5 text-gray-600 transition-transform duration-500 ${openReportSection === section.title ? 'rotate-180 text-blue-400' : 'group-hover:text-gray-400'}`} />
                                </button>

                                {openReportSection === section.title && (
                                    <div className="p-8 bg-black/40 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-300">
                                        <div className="flex flex-col gap-y-4 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                            {section.fields.map((f, fIdx) => (
                                                f.type === 'header' ? (
                                                    <div key={f.field} className="pt-8 pb-3 border-b border-gray-800/80 mb-4 first:pt-0">
                                                        <h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                    </div>
                                                ) : (
                                                    <div key={f.field} className="flex flex-col py-4 border-b border-gray-800/30 last:border-0 group/field">
                                                        <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-blue-400' : 'text-gray-500 group-hover/field:text-gray-400'}`}>{f.label}</label>
                                                        <div className="bg-gray-900/40 rounded-lg p-1 border border-transparent group-hover/field:border-gray-800/50 transition-all relative">
                                                            {f.type === 'number' ? (
                                                                <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} />
                                                            ) : (
                                                                <ReportInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} />
                                                            )}
                                                            {f.labelPrefix && (
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-600 uppercase tracking-tighter pointer-events-none">
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
                    <div className="p-6 bg-gray-950 border-t border-gray-800 text-center"><p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">This is a system generated document and does not require to be signed.</p></div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20 relative">
            {appState === 'loading' && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center w-full h-full">
                    <LoadingIndicator progress={progress} statusText={progressMessage} />
                </div>
            )}
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
                    <button
                        onClick={handleExportToExcel}
                        disabled={currentStep !== 14}
                        className={`flex items-center px-4 py-2 font-black text-[10px] uppercase tracking-widest rounded-xl border transition-all ${currentStep === 14
                            ? 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20'
                            : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed opacity-50'
                            }`}
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All (Step 14)
                    </button>
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
            {currentStep === 7 && renderStep7VatSummarization()}
            {currentStep === 8 && renderStep8OpeningBalances()}
            {currentStep === 9 && renderStep9AdjustTrialBalance()}
            {currentStep === 10 && renderStep10ProfitAndLoss()}
            {currentStep === 11 && renderStep11BalanceSheet()}
            {currentStep === 12 && renderStep12LOU()}
            {currentStep === 13 && renderStep13CtQuestionnaire()}
            {currentStep === 14 && renderStep14FinalReport()}

            {showVatFlowModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
                        <h3 className="font-bold mb-4 text-white text-center">VAT 201 Certificates Available?</h3>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => handleVatFlowAnswer(false)} className="px-6 py-2 border border-gray-700 rounded-lg text-white font-semibold hover:bg-gray-800 transition-colors uppercase text-xs">No</button>
                            <button onClick={() => handleVatFlowAnswer(true)} className="px-6 py-2 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-500 transition-colors uppercase text-xs">Yes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Working Note Modal */}
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
                                                    value={entry.debit === 0 ? '' : entry.debit}
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
                                                    value={entry.credit === 0 ? '' : entry.credit}
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
                                                <option key={cat} value={cat} className="bg-gray-900 text-white">{cat}</option>
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
