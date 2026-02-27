import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Company, WorkingNoteEntry } from '../types';
import {
    DocumentArrowDownIcon,
    CheckIcon,
    SparklesIcon,
    BriefcaseIcon,
    ChevronDownIcon,
    ListBulletIcon,
    ChartBarIcon,
    ClipboardCheckIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    IdentificationIcon,
    BuildingOfficeIcon,
    IncomeIcon,
    AssetIcon,
    ChevronLeftIcon,
    ShieldCheckIcon,
    DocumentDuplicateIcon,
    DocumentTextIcon,
    XMarkIcon,
    PlusIcon,
    TrashIcon,
    UploadIcon,
    ChevronRightIcon,
    CheckCircleIcon
} from './icons';
import { FileUploadArea } from './VatFilingUpload';
import { ProfitAndLossStep, PNL_ITEMS, type ProfitAndLossItem } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS, type BalanceSheetItem } from './BalanceSheetStep';
import { useCtWorkflow } from '../hooks/useCtWorkflow';
import { ctFilingService } from '../services/ctFilingService';

import { extractGenericDetailsFromDocuments, extractAuditReportDetails, extractVat201Totals } from '../services/geminiService';
import type { Part } from '@google/genai';

declare const XLSX: any;
declare const pdfjsLib: any;

interface CtType4ResultsProps {
    currency: string;
    companyName: string;
    onReset: () => void;
    company: Company | null;
    customerId: string;
    ctTypeId: string;
    periodId: string;
    conversionId: string | null;
    period?: { start: string; end: string } | null;
}

type Type4PnlCurrencyConfig = {
    selectedCurrency: string;
    customCurrency: string;
    exchangeRateToAed: number;
};

const TYPE4_PNL_CURRENCY_OPTIONS = ['AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD'] as const;

const normalizeType4PnlCurrencyConfig = (
    value: Partial<Type4PnlCurrencyConfig> | undefined,
    fallbackCurrency = 'AED'
): Type4PnlCurrencyConfig => {
    const fallback = (fallbackCurrency || 'AED').trim().toUpperCase();
    const isKnownFallback = TYPE4_PNL_CURRENCY_OPTIONS.includes(fallback as typeof TYPE4_PNL_CURRENCY_OPTIONS[number]);
    const selectedCurrency = (value?.selectedCurrency || (isKnownFallback ? fallback : 'CUSTOM')).toString().trim().toUpperCase();
    const customCurrency = (value?.customCurrency || (!isKnownFallback ? fallback : '')).toString().trim().toUpperCase().slice(0, 10);
    const parsedRate = Number(value?.exchangeRateToAed);
    const exchangeRateToAed = Number.isFinite(parsedRate) && parsedRate > 0 ? parsedRate : 1;

    return {
        selectedCurrency: selectedCurrency || 'AED',
        customCurrency,
        exchangeRateToAed
    };
};

const getType4PnlDisplayCurrency = (config: Type4PnlCurrencyConfig) => {
    if (config.selectedCurrency === 'CUSTOM') {
        return config.customCurrency.trim().toUpperCase() || 'CUSTOM';
    }
    return config.selectedCurrency || 'AED';
};

const convertAmountToAed = (amount: number, sourceCurrency: string, exchangeRateToAed: number) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    const safeCurrency = (sourceCurrency || 'AED').trim().toUpperCase();
    const safeRate = Number.isFinite(exchangeRateToAed) && exchangeRateToAed > 0 ? exchangeRateToAed : 1;
    if (safeCurrency === 'AED') return safeAmount;
    return safeAmount * safeRate;
};

const convertWorkingNotesToAed = (
    incoming: Record<string, WorkingNoteEntry[]>,
    sourceCurrency: string,
    exchangeRateToAed: number
): Record<string, WorkingNoteEntry[]> => {
    const safeCurrency = (sourceCurrency || 'AED').trim().toUpperCase();

    return Object.fromEntries(
        Object.entries(incoming || {}).map(([key, rows]) => [
            key,
            (rows || []).map((row) => {
                const currentRaw = Number(row.currentYearAmount ?? row.amount ?? 0) || 0;
                const previousRaw = Number(row.previousYearAmount ?? 0) || 0;
                const currentAed = convertAmountToAed(currentRaw, safeCurrency, exchangeRateToAed);
                const previousAed = convertAmountToAed(previousRaw, safeCurrency, exchangeRateToAed);

                return {
                    ...row,
                    currentYearAmount: currentAed,
                    previousYearAmount: previousAed,
                    amount: currentAed,
                    originalAmount: currentRaw,
                    currency: safeCurrency
                };
            })
        ])
    );
};

const RefreshIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
);

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
        const pagesToProcess = Math.min(pdf.numPages, 20);
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

const fileToPart = (file: File): Promise<Part> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64 = result.split(',')[1];
            resolve({ inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } });
        };
        reader.onerror = reject;
    });
};

const formatNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDecimalNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    return Math.round(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const toNumber = (val: any): number => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[,()]/g, '').trim();
        const neg = val.includes('(') && val.includes(')');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : (neg ? -parsed : parsed);
    }
    return 0;
};

const findItemAmountForYear = (item: any, year: 'current' | 'previous' = 'current'): number | undefined => {
    if (!item) return undefined;
    const currentCandidates = [
        item.amount,
        item.currentYearAmount,
        item.current_year_amount,
        item.amountCurrentYear,
        item.value,
        item.currentValue,
        item.currentYear,
        item.thisYear,
        item.this_year,
        item.year1,
        item.current,
        item.current_amount
    ];
    const previousCandidates = [
        item.previousYearAmount,
        item.previous_year_amount,
        item.amountPreviousYear,
        item.previousYear,
        item.priorYear,
        item.previous,
        item.comparativeAmount,
        item.comparativeValue,
        item.lastYear,
        item.year2,
        item.previousValue,
        item.prior,
        item.previous_amount
    ];
    const candidates = year === 'previous' ? previousCandidates : currentCandidates;
    for (const v of candidates) {
        const n = toNumber(v);
        if (n !== 0) return n;
    }
    // Fall back to array-like containers used by some extractors.
    const listCandidates = [item.amounts, item.values, item.yearlyAmounts, item.columns, item.periods];
    for (const list of listCandidates) {
        if (Array.isArray(list) && list.length > 0) {
            const idx = year === 'previous' ? 1 : 0;
            const raw = list[idx];
            const n = typeof raw === 'object' && raw !== null
                ? (year === 'previous'
                    ? toNumber(raw.previousYearAmount ?? raw.previousYear ?? raw.previous ?? raw.amount ?? raw.value)
                    : toNumber(raw.currentYearAmount ?? raw.currentYear ?? raw.current ?? raw.amount ?? raw.value))
                : toNumber(raw);
            if (n !== 0) return n;
            if (typeof raw === 'object' && raw !== null) {
                const fallback = year === 'previous'
                    ? [raw.previous, raw.previousYear, raw.prior, raw.y2, raw.amount2, raw.value2]
                    : [raw.current, raw.currentYear, raw.thisYear, raw.y1, raw.amount1, raw.value1];
                for (const v of fallback) {
                    const fn = toNumber(v);
                    if (fn !== 0) return fn;
                }
            }
        } else if (list && typeof list === 'object') {
            const objCandidates = year === 'previous'
                ? [list.previous, list.previousYear, list.prior, list.y2, list.comparative, list.comparativeAmount, list.previousValue]
                : [list.current, list.currentYear, list.thisYear, list.y1, list.amount, list.value, list.currentValue];
            for (const v of objCandidates) {
                const n = toNumber(v);
                if (n !== 0) return n;
            }
        }
    }

    // Distinguish "missing" from real zero by returning 0 only when a likely field exists.
    const hasLikelyField = year === 'previous'
        ? ['previousYearAmount', 'previous_year_amount', 'amountPreviousYear', 'previousYear', 'priorYear', 'comparativeAmount', 'comparativeValue', 'lastYear', 'year2', 'previousValue', 'prior', 'previous_amount']
            .some(k => Object.prototype.hasOwnProperty.call(item, k))
        : ['amount', 'currentYearAmount', 'current_year_amount', 'amountCurrentYear', 'value', 'currentValue', 'currentYear', 'thisYear', 'this_year', 'year1', 'current_amount']
            .some(k => Object.prototype.hasOwnProperty.call(item, k));
    return hasLikelyField ? 0 : undefined;
};

const findItemAmount = (item: any): number => {
    return findItemAmountForYear(item, 'current') ?? 0;
};

const findItemPreviousAmount = (item: any): number | undefined => {
    return findItemAmountForYear(item, 'previous');
};

const findAmountInItems = (items: any[] | undefined, keywords: string[]): number => {
    if (!items || items.length === 0) return 0;
    const lowerKeys = keywords.map(k => k.toLowerCase());
    const match = items.find((item: any) => {
        const desc = String(item?.description || '').toLowerCase();
        return lowerKeys.some(k => desc.includes(k));
    });
    return match ? findItemAmount(match) : 0;
};

const findAmountInItemsForYear = (items: any[] | undefined, keywords: string[], year: 'current' | 'previous'): number | undefined => {
    if (!items || items.length === 0) return undefined;
    const lowerKeys = keywords.map(k => k.toLowerCase());
    const match = items.find((item: any) => {
        const desc = String(item?.description || '').toLowerCase();
        return lowerKeys.some(k => desc.includes(k));
    });
    if (!match) return undefined;
    return findItemAmountForYear(match, year);
};

const flattenBsItems = (bs: any): any[] => {
    const flat: any[] = [];
    const pushItems = (arr: any[] | undefined) => {
        if (!arr) return;
        arr.forEach((group: any) => {
            if (Array.isArray(group?.items)) {
                flat.push(...group.items);
            }
        });
    };
    pushItems(bs?.assets);
    pushItems(bs?.liabilities);
    if (Array.isArray(bs?.equity)) flat.push(...bs.equity);
    if (Array.isArray(bs?.items)) flat.push(...bs.items);
    if (Array.isArray(bs?.rows)) flat.push(...bs.rows);
    return flat;
};

const addNote = (notes: Record<string, WorkingNoteEntry[]>, key: string, desc: string, amount: number, previousAmount: number = 0) => {
    if (!desc || (amount === 0 && previousAmount === 0)) return;
    if (!notes[key]) notes[key] = [];
    notes[key].push({
        description: desc,
        currentYearAmount: amount,
        previousYearAmount: previousAmount,
        amount
    });
};

const mapPnlItemsToNotes = (items: any[]): Record<string, WorkingNoteEntry[]> => {
    const notes: Record<string, WorkingNoteEntry[]> = {};
    items.forEach(item => {
        const desc = String(item?.description || '').trim();
        const rawAmount = findItemAmount(item);
        const rawPrevAmount = findItemPreviousAmount(item) ?? 0;
        if (!desc || (rawAmount === 0 && rawPrevAmount === 0)) return;
        const lower = desc.toLowerCase();
        const amount = rawAmount;
        const previousAmount = rawPrevAmount;
        const isCostOfRevenue =
            lower.includes('cost of revenue') ||
            lower.includes('cost of sales') ||
            lower.includes('cost of goods') ||
            lower.includes('cogs');

        // Check specific expense labels before generic "revenue" to avoid
        // mapping "Cost of revenue" rows into the Revenue working note.
        if (isCostOfRevenue) {
            addNote(notes, 'cost_of_revenue', desc, amount, previousAmount);
        } else if (
            (lower.includes('revenue') || lower.includes('sales') || lower.includes('turnover')) &&
            !lower.includes('cost of')
        ) {
            addNote(notes, 'revenue', desc, amount, previousAmount);
        } else if (lower.includes('gross profit')) {
            addNote(notes, 'gross_profit', desc, amount, previousAmount);
        } else if (lower.includes('general and administrative') || lower.includes('administrative') || lower.includes('admin')) {
            addNote(notes, 'administrative_expenses', desc, amount, previousAmount);
        } else if (lower.includes('bank') && lower.includes('finance')) {
            addNote(notes, 'finance_costs', desc, amount, previousAmount);
        } else if (lower.includes('depreciation') || lower.includes('amortisation')) {
            addNote(notes, 'depreciation_ppe', desc, amount, previousAmount);
        } else if (lower.includes('net profit') && lower.includes('after tax')) {
            addNote(notes, 'profit_after_tax', desc, amount, previousAmount);
        } else if (lower.includes('net profit') || lower.includes('profit for the year') || lower.includes('profit/(loss) for the year')) {
            addNote(notes, 'profit_loss_year', desc, amount, previousAmount);
        } else if (lower.includes('provision for corporate tax')) {
            addNote(notes, 'provisions_corporate_tax', desc, amount, previousAmount);
        } else if (lower.includes('total comprehensive')) {
            addNote(notes, 'total_comprehensive_income', desc, amount, previousAmount);
        }
    });
    return notes;
};

const sanitizePnlWorkingNotes = (incoming: Record<string, WorkingNoteEntry[]>): Record<string, WorkingNoteEntry[]> => {
    const notes: Record<string, WorkingNoteEntry[]> = { ...incoming };
    const revenueRows = Array.isArray(notes.revenue) ? [...notes.revenue] : [];
    if (revenueRows.length === 0) return notes;

    const keepRevenue: WorkingNoteEntry[] = [];
    const moveToCost: WorkingNoteEntry[] = [];

    revenueRows.forEach((row) => {
        const desc = String(row?.description || '').toLowerCase();
        const isCostOfRevenue =
            desc.includes('cost of revenue') ||
            desc.includes('cost of sales') ||
            desc.includes('cost of goods') ||
            desc.includes('cogs');

        if (isCostOfRevenue) moveToCost.push(row);
        else keepRevenue.push(row);
    });

    if (moveToCost.length === 0) return notes;

    const existingCost = Array.isArray(notes.cost_of_revenue) ? [...notes.cost_of_revenue] : [];
    const dedupedCost = [...existingCost];
    moveToCost.forEach((row) => {
        const key = `${row.description}|${row.currentYearAmount ?? row.amount ?? 0}|${row.previousYearAmount ?? 0}`;
        const exists = dedupedCost.some(r => `${r.description}|${r.currentYearAmount ?? r.amount ?? 0}|${r.previousYearAmount ?? 0}` === key);
        if (!exists) dedupedCost.push(row);
    });

    notes.revenue = keepRevenue;
    notes.cost_of_revenue = dedupedCost;
    return notes;
};

const mapBsItemsToNotes = (items: any[]): Record<string, WorkingNoteEntry[]> => {
    const notes: Record<string, WorkingNoteEntry[]> = {};
    items.forEach(item => {
        const desc = String(item?.description || '').trim();
        const rawAmount = findItemAmount(item);
        const rawPrevAmount = findItemPreviousAmount(item) ?? 0;
        if (!desc || (rawAmount === 0 && rawPrevAmount === 0)) return;
        const lower = desc.toLowerCase();
        const amount = rawAmount;
        const previousAmount = rawPrevAmount;

        if (lower.includes('trade receivables')) {
            addNote(notes, 'trade_receivables', desc, amount, previousAmount);
        } else if (lower.includes('cash and cash equivalents') || lower.includes('cash') || lower.includes('bank')) {
            addNote(notes, 'cash_bank_balances', desc, amount, previousAmount);
        } else if (lower.includes('accounts & other payables') || lower.includes('accounts payable') || lower.includes('payables')) {
            addNote(notes, 'trade_other_payables', desc, amount, previousAmount);
        } else if (lower.includes("shareholder") && lower.includes("current account")) {
            addNote(notes, 'shareholders_current_accounts', desc, amount, previousAmount);
        } else if (lower.includes('share capital') || lower.includes('capital')) {
            addNote(notes, 'share_capital', desc, amount, previousAmount);
        } else if (lower.includes('retained earnings')) {
            addNote(notes, 'retained_earnings', desc, amount, previousAmount);
        } else if (lower.includes('total current assets')) {
            addNote(notes, 'total_current_assets', desc, amount, previousAmount);
        } else if (lower.includes('total assets')) {
            addNote(notes, 'total_assets', desc, amount, previousAmount);
        } else if (lower.includes('total current liabilities')) {
            addNote(notes, 'total_current_liabilities', desc, amount, previousAmount);
        } else if (lower.includes('total liabilities')) {
            addNote(notes, 'total_liabilities', desc, amount, previousAmount);
        } else if (lower.includes('total equity')) {
            addNote(notes, 'total_equity', desc, amount, previousAmount);
        } else if (lower.includes('total liabilities and shareholders') || lower.includes('total liabilities and equity')) {
            addNote(notes, 'total_equity_liabilities', desc, amount, previousAmount);
        }
    });
    return notes;
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

const formatDate = (dateStr: any) => {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return String(dateStr);
        return date.toLocaleDateString('en-GB');
    } catch (e) {
        return String(dateStr);
    }
};

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = [
        "Audit Report Upload",
        "VAT Docs Upload",
        "VAT Summarization",
        "Profit & Loss",
        "Balance Sheet",
        "Tax Computation",
        "LOU",
        "Signed FS & LOU",
        "CT Questionnaire",
        "Final Report"
    ];
    return (
        <div className="flex items-center w-full max-w-4xl mx-auto mb-8 overflow-x-auto pb-2">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isActive = currentStep === stepNumber;
                return (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center text-center z-10 px-2 min-w-[120px]">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-primary border-primary' : isActive ? 'border-primary bg-background' : 'border-muted bg-muted/20'}`}>
                                {isCompleted ? <CheckIcon className="w-6 h-6 text-primary-foreground" /> : <span className={`font-bold text-lg ${isActive ? 'text-foreground' : 'text-muted-foreground/40'}`}>{stepNumber}</span>}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground/40'}`}>{step}</p>
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



export const CtType4Results: React.FC<CtType4ResultsProps> = ({ currency, companyName, onReset, company, customerId,
    ctTypeId,
    periodId,
    conversionId,
    period
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const isHydrated = useRef(false);
    const [auditFiles, setAuditFiles] = useState<File[]>([]);
    const [extractedDetails, setExtractedDetails] = useState<Record<string, any>>({});
    const [isExtracting, setIsExtracting] = useState(false);
    const [openExtractedSection, setOpenExtractedSection] = useState<string | null>(null);

    // VAT State (Type 3 parity)
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [isExtractingVat, setIsExtractingVat] = useState(false);

    // LOU State
    const [louFiles, setLouFiles] = useState<File[]>([]);
    const [signedFsLouFiles, setSignedFsLouFiles] = useState<File[]>([]);



    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [reportForm, setReportForm] = useState<any>({});
    const [louData, setLouData] = useState({
        date: new Date().toISOString().split('T')[0],
        to: 'The VAT Consultant LLC',
        subject: 'Management Representation regarding Corporate Tax Computation and Filing',
        taxablePerson: reportForm.taxableNameEn || companyName || '',
        taxPeriod: `FOR THE PERIOD FROM ${period?.start || reportForm.periodFrom || '-'} TO ${period?.end || reportForm.periodTo || '-'}`,
        trn: company?.corporateTaxTrn || company?.trn || '',
        content: `We, the Management of ${reportForm.taxableNameEn || companyName || '[Company Name]'}, confirm that the Corporate Tax filing is based on the Audited Financial Statements for the period ending ${period?.end || reportForm.periodTo || '[Date]'}, as prepared by our independent auditors. We declare that all adjustments and disclosures are consistent with the audited report. We acknowledge that The VAT Consultant LLC has used these audited figures as the starting point for the tax computation. While these records have been externally verified, we maintain ultimate responsibility for the tax return's compliance and for providing the original audit report and schedules to the FTA upon request.`,
        signatoryName: '',
        designation: ''
    });
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isDownloadingLouPdf, setIsDownloadingLouPdf] = useState(false);

    useEffect(() => {
        if (!period?.start && !period?.end) return;

        setReportForm((prev: any) => {
            const nextPeriodFrom = period?.start || prev?.periodFrom || '';
            const nextPeriodTo = period?.end || prev?.periodTo || '';
            const nextPeriodDescription = nextPeriodFrom && nextPeriodTo
                ? `Tax Period ${nextPeriodFrom} to ${nextPeriodTo}`
                : (prev?.periodDescription || '');
            const nextTaxPeriodDescription = nextPeriodDescription;

            if (
                prev?.periodFrom === nextPeriodFrom &&
                prev?.periodTo === nextPeriodTo &&
                prev?.periodDescription === nextPeriodDescription &&
                prev?.taxPeriodDescription === nextTaxPeriodDescription
            ) {
                return prev;
            }

            return {
                ...prev,
                periodFrom: nextPeriodFrom,
                periodTo: nextPeriodTo,
                periodDescription: nextPeriodDescription,
                taxPeriodDescription: nextTaxPeriodDescription
            };
        });
    }, [period?.start, period?.end, reportForm?.periodFrom, reportForm?.periodTo, reportForm?.periodDescription, reportForm?.taxPeriodDescription]);

    const [showVatConfirm, setShowVatConfirm] = useState(false);
    const [selectedDocCategory, setSelectedDocCategory] = useState<string>('');
    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [pnlStructure, setPnlStructure] = useState<ProfitAndLossItem[]>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<BalanceSheetItem[]>(BS_ITEMS);
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [pnlCurrencyConfig, setPnlCurrencyConfig] = useState<Type4PnlCurrencyConfig>(() => normalizeType4PnlCurrencyConfig(undefined, currency));
    const [extractionVersion, setExtractionVersion] = useState(0);
    const [pnlDirty, setPnlDirty] = useState(false);
    const [bsDirty, setBsDirty] = useState(false);
    const [showSbrModal, setShowSbrModal] = useState(false);
    const [taxComputationEdits, setTaxComputationEdits] = useState<Record<string, number>>({});

    const ftaFormValues = useMemo(() => {
        const pnl = pnlValues || {};
        const bs = balanceSheetValues || {};

        const netProfit = pnl.profit_loss_year?.currentYear || 0;
        const totalAssets = bs.total_assets?.currentYear || 0;
        const totalEquity = bs.total_equity?.currentYear || 0;
        const actualOperatingRevenue = pnl.revenue?.currentYear || 0;

        const threshold = 375000;
        const taxableIncome = Math.max(0, netProfit);
        const corporateTaxLiability = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;

        return {
            netProfit,
            totalAssets,
            totalEquity,
            actualOperatingRevenue,
            taxableIncome,
            corporateTaxLiability,
            netTaxPosition: corporateTaxLiability
        };
    }, [pnlValues, balanceSheetValues]);

    const pnlDisplayCurrency = useMemo(() => getType4PnlDisplayCurrency(pnlCurrencyConfig), [pnlCurrencyConfig]);
    const pnlRateToAed = useMemo(() => {
        const parsed = Number(pnlCurrencyConfig.exchangeRateToAed);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }, [pnlCurrencyConfig.exchangeRateToAed]);
    const showOriginalEquivalent = pnlDisplayCurrency !== 'AED' && pnlRateToAed > 0;
    const formatOriginalEquivalentFromAed = useCallback((aedAmount: number) => {
        if (!showOriginalEquivalent) return null;
        if (!pnlDisplayCurrency || pnlDisplayCurrency === 'AED') return null;
        if (!Number.isFinite(pnlRateToAed) || pnlRateToAed <= 0) return null;
        const originalValue = (Number(aedAmount) || 0) / pnlRateToAed;
        return `${pnlDisplayCurrency} ${new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(originalValue)}`;
    }, [showOriginalEquivalent, pnlDisplayCurrency, pnlRateToAed]);

    const { workflowData, saveStep } = useCtWorkflow({
        conversionId
    });

    const handleDownloadPDF = async () => {
        setIsDownloadingPdf(true);
        try {
            const sections = REPORT_STRUCTURE.map((section: any) => ({
                title: section.title,
                rows: (section.fields || []).map((field: any) => ({
                    type: field.type === 'header' ? 'header' : 'field',
                    label: field.label,
                    value: field.type === 'header' ? '' : reportForm[field.field]
                }))
            }));

            const blob = await ctFilingService.downloadFinalStepPdf({
                companyName: reportForm.taxableNameEn || companyName,
                period: `FOR THE PERIOD FROM ${period?.start || reportForm.periodFrom || '-'} TO ${period?.end || reportForm.periodTo || '-'}`,
                title: 'Corporate Tax Return - Final Step Report',
                sections
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(reportForm.taxableNameEn || companyName || 'CT_Final_Step_Report').replace(/\s+/g, '_')}_Final_Step.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Download PDF error:', error);
            alert('Failed to generate final step PDF: ' + error.message);
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    const handleDownloadFinancialStatementsPDF = async () => {
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

            const pnlStructureForPdf = pnlStructure.map(item => ({ id: item.id, label: item.label, type: item.type }));
            const bsStructureForPdf = bsStructure.map(item => ({ id: item.id, label: item.label, type: item.type }));

            const blob = await ctFilingService.downloadPdf({
                companyName: reportForm.taxableNameEn || companyName,
                period: `FOR THE PERIOD FROM ${period?.start || reportForm.periodFrom || '-'} TO ${period?.end || reportForm.periodTo || '-'}`,
                pnlStructure: pnlStructureForPdf,
                pnlValues,
                bsStructure: bsStructureForPdf,
                bsValues: balanceSheetValues,
                location: locationText,
                pnlWorkingNotes,
                bsWorkingNotes
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `CT_Filing_Report_${(reportForm.taxableNameEn || companyName || 'Company').replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Download financial statements PDF error:', error);
            alert('Failed to generate financial statements PDF: ' + error.message);
        } finally {
            setIsDownloadingPdf(false);
        }
    };

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

    const handleSaveStep = useCallback(async (
        stepId: number,
        status: 'draft' | 'completed' | 'submitted' = 'completed',
        stepDataOverride?: Record<string, any>
    ) => {
        if (!customerId || !ctTypeId || !periodId) return;

        const stepNames: Record<number, string> = {
            0: 'metadata',
            1: 'audit_report',
            2: 'vat_upload',
            3: 'vat_summarization',
            4: 'profit_loss',
            5: 'balance_sheet',
            6: 'tax_computation',
            7: 'lou_upload',
            8: 'signed_fs_lou',
            9: 'questionnaire',
            10: 'final_report'
        };

        try {
            let stepData: any = {};
            const stepName = stepNames[stepId] || `step_${stepId}`;
            const stepKey = `type-4_step-${stepId}_${stepName}`;

            switch (stepId) {
                case 0:
                    stepData = { currentStep };
                    break;
                case 1:
                    stepData = {
                        auditFiles: auditFiles.map(f => ({ name: f.name, size: f.size })),
                        extractedDetails,
                        selectedDocCategory,
                        pnlCurrencyConfig
                    };
                    break;
                case 2:
                    stepData = {
                        additionalFiles: additionalFiles.map(f => ({ name: f.name, size: f.size }))
                    };
                    break;
                case 3:
                    stepData = { vatManualAdjustments, additionalDetails };
                    break;
                case 4:
                    stepData = { pnlValues, pnlStructure, pnlWorkingNotes, pnlCurrencyConfig };
                    break;
                case 5:
                    stepData = { balanceSheetValues, bsStructure, bsWorkingNotes };
                    break;
                case 6:
                    stepData = { taxComputationValues: ftaFormValues, taxComputation: taxComputationEdits };
                    break;
                case 7:
                    stepData = { louData };
                    break;
                case 8:
                    stepData = { signedFsLouFiles: signedFsLouFiles.map(f => ({ name: f.name, size: f.size })) };
                    break;
                case 9:
                    stepData = { questionnaireAnswers };
                    break;
                case 10:
                    stepData = { reportForm };
                    break;
            }

            const finalStepData = stepDataOverride ? { ...stepData, ...stepDataOverride } : stepData;
            await saveStep(stepKey, stepId, finalStepData, status);
        } catch (error) {
            console.error(`Failed to save step ${stepId}:`, error);
        }
    }, [
        customerId, ctTypeId, periodId,
        auditFiles, extractedDetails, selectedDocCategory,
        additionalFiles, vatManualAdjustments, additionalDetails,
        pnlValues, pnlStructure, pnlWorkingNotes, pnlCurrencyConfig,
        balanceSheetValues, bsStructure, bsWorkingNotes,
        louFiles, signedFsLouFiles, questionnaireAnswers, reportForm, ftaFormValues, taxComputationEdits,
        saveStep
    ]);

    useEffect(() => {
        if (workflowData && workflowData.length > 0) {
            // Restore current step to the latest step found - ONLY ONCE
            if (!isHydrated.current) {
                // First, check for explicit currentStep metadata (Step 0)
                const metadataStep = workflowData.find(s => s.step_number === 0);
                if (metadataStep && metadataStep.data?.currentStep) {
                    setCurrentStep(metadataStep.data.currentStep);
                } else {
                    // Fallback to highest completed step + 1, but GUARD Step 1 -> 2 transition
                    const sortedSteps = [...workflowData].filter(s => s.step_number > 0).sort((a, b) => b.step_number - a.step_number);
                    const latestStep = sortedSteps[0];
                    if (latestStep) {
                        if (latestStep.step_number === 1) {
                            // NEVER auto-advance from Step 1 to Step 2. 
                            // This ensures the VAT popup is always triggered manually.
                            setCurrentStep(1);
                        } else if (latestStep.step_number < 10) {
                            setCurrentStep(latestStep.step_number + 1);
                        } else {
                            setCurrentStep(latestStep.step_number);
                        }
                    }
                }
                isHydrated.current = true;
            }

            for (const step of workflowData) {
                const sData = step.data;
                if (!sData) continue;

                switch (step.step_number) {
                    case 1:
                        if (sData.auditFiles) {
                            setAuditFiles(sData.auditFiles.map((f: any) => new File([], f.name, { type: 'application/pdf' })));
                        }
                        if (sData.extractedDetails) setExtractedDetails(sData.extractedDetails);
                        if (sData.selectedDocCategory) setSelectedDocCategory(sData.selectedDocCategory);
                        if (sData.pnlCurrencyConfig) setPnlCurrencyConfig(normalizeType4PnlCurrencyConfig(sData.pnlCurrencyConfig, currency));
                        break;
                    case 2:
                        if (sData.additionalFiles) {
                            setAdditionalFiles(sData.additionalFiles.map((f: any) => new File([], f.name, { type: 'application/pdf' })));
                        }
                        break;
                    case 3:
                        if (sData.vatManualAdjustments) setVatManualAdjustments(sData.vatManualAdjustments);
                        if (sData.additionalDetails) setAdditionalDetails(sData.additionalDetails);
                        break;
                    case 4:
                        if (sData.pnlValues) setPnlValues(sData.pnlValues);
                        if (sData.pnlStructure) setPnlStructure(sData.pnlStructure);
                        if (sData.pnlWorkingNotes) setPnlWorkingNotes(sanitizePnlWorkingNotes(sData.pnlWorkingNotes));
                        if (sData.pnlCurrencyConfig) setPnlCurrencyConfig(normalizeType4PnlCurrencyConfig(sData.pnlCurrencyConfig, currency));
                        break;
                    case 5:
                        if (sData.balanceSheetValues) setBalanceSheetValues(sData.balanceSheetValues);
                        if (sData.bsStructure) setBsStructure(sData.bsStructure);
                        if (sData.bsWorkingNotes) setBsWorkingNotes(sData.bsWorkingNotes);
                        break;
                    case 6:
                        if (sData.taxComputation) setTaxComputationEdits(sData.taxComputation);
                        break; // Tax Computation
                    case 7:
                        if (sData.louData) {
                            setLouData(sData.louData);
                        }
                        break;
                    case 8:
                        if (sData.signedFsLouFiles) {
                            setSignedFsLouFiles(sData.signedFsLouFiles.map((f: any) => new File([], f.name, { type: 'application/pdf' })));
                        }
                        break;
                    case 9:
                        if (sData.questionnaireAnswers) setQuestionnaireAnswers(sData.questionnaireAnswers);
                        break;
                    case 10:
                        if (sData.reportForm) setReportForm(sData.reportForm);
                        break;
                }
            }
        }
    }, [workflowData]);

    // Auto-save Step 10 when reached
    useEffect(() => {
        if (currentStep === 10) {
            handleSaveStep(10);
        }
    }, [currentStep, handleSaveStep]);

    const finalDisplayData = useMemo(() => {
        if (!extractedDetails || Object.keys(extractedDetails).length === 0) return {};

        const sectionTitles: Record<string, string> = {
            generalInformation: "General Information",
            auditorsReport: "Auditor's Report",
            managersReport: "Manager's Report",
            statementOfFinancialPosition: "Statement of Financial Position",
            statementOfComprehensiveIncome: "Statement of Comprehensive Income",
            statementOfChangesInEquity: "Statement of Changes in Shareholders' Equity",
            statementOfCashFlows: "Statement of Cash Flows"
        };

        const grouped: Record<string, any> = {};
        Object.entries(extractedDetails).forEach(([k, v]) => {
            const title = sectionTitles[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            grouped[title] = v;
        });

        return grouped;
    }, [extractedDetails]);

    const vatStepData = useMemo(() => {
        const fileResults = additionalDetails.vatFileResults || [];

        const periods = fileResults.map((res: any, index: number) => {
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


    useEffect(() => {
        // Map structured extraction data to flat report fields
        const genInfo = extractedDetails?.generalInformation || {};
        const pnl = extractedDetails?.statementOfComprehensiveIncome || {};
        const bs = extractedDetails?.statementOfFinancialPosition || {};
        const other = extractedDetails?.otherInformation || {};
        const audit = extractedDetails?.auditorsReport || {};

        setReportForm((prev: any) => {
            // SBR Logic Calculation: "Yes" means relief claimed
            const isSbrApplicable = questionnaireAnswers[6] === 'Yes';

            const applySbr = (val: any) => isSbrApplicable ? 0 : val;

            return {
                ...prev,
                dueDate: prev.dueDate || company?.ctDueDate || '30/09/2025',
                periodDescription: prev.periodDescription || (period?.start && period?.end ? `Tax Year End ${period.end.split('/').pop()}` : `Tax Year End ${company?.ctPeriodEnd?.split('/').pop() || '2024'}`),
                periodFrom: prev.periodFrom || period?.start || company?.ctPeriodStart || '01/01/2024',
                periodTo: prev.periodTo || period?.end || company?.ctPeriodEnd || '31/12/2024',
                taxableNameEn: prev.taxableNameEn || genInfo.companyName || companyName,
                entityType: prev.entityType || 'Legal Person - Incorporated',
                trn: prev.trn || genInfo.trn || company?.trn || '',
                primaryBusiness: prev.primaryBusiness || genInfo.principalActivities || 'General Trading activities',
                address: prev.address || genInfo.registeredOffice || company?.address || '',
                mobileNumber: prev.mobileNumber || '+971...',
                emailId: prev.emailId || 'admin@docuflow.in',
                declarationDate: prev.declarationDate || new Date().toLocaleDateString('en-GB'),
                preparedBy: prev.preparedBy || 'Taxable Person',
                declarationConfirmed: prev.declarationConfirmed || 'Yes',

                // P&L Data carry-forward (Applied SBR)
                operatingRevenue: isSbrApplicable ? 0 : (pnl.revenue || prev.operatingRevenue || 0),
                derivingRevenueExpenses: applySbr(pnl.costOfSales || prev.derivingRevenueExpenses || 0),
                grossProfit: applySbr(pnl.grossProfit || prev.grossProfit || 0),
                otherNonOpRevenue: applySbr(pnl.otherIncome || prev.otherNonOpRevenue || 0),
                interestExpense: applySbr(pnl.financeCosts || prev.interestExpense || 0),
                netProfit: applySbr(pnl.netProfit || prev.netProfit || 0),
                totalComprehensiveIncome: applySbr(pnl.totalComprehensiveIncome || prev.totalComprehensiveIncome || 0),
                accountingIncomeTaxPeriod: applySbr(pnl.netProfit || prev.netProfit || 0),

                // Balance Sheet Data carry-forward (Applied SBR)
                totalAssets: applySbr(bs.totalAssets || prev.totalAssets || 0),
                totalLiabilities: applySbr(bs.totalLiabilities || prev.totalLiabilities || 0),
                totalEquity: applySbr(bs.totalEquity || prev.totalEquity || 0),
                totalCurrentAssets: applySbr(bs.totalCurrentAssets || prev.totalCurrentAssets || 0),
                totalCurrentLiabilities: applySbr(bs.totalCurrentLiabilities || prev.totalCurrentLiabilities || 0),
                totalNonCurrentAssets: applySbr(bs.totalNonCurrentAssets || (bs.totalAssets - bs.totalCurrentAssets) || prev.totalNonCurrentAssets || 0),
                totalNonCurrentLiabilities: applySbr(bs.totalNonCurrentLiabilities || (bs.totalLiabilities - bs.totalCurrentLiabilities) || prev.totalNonCurrentLiabilities || 0),
                totalEquityLiabilities: applySbr((bs.totalEquity + bs.totalLiabilities) || prev.totalEquityLiabilities || 0),
                ppe: applySbr(bs.ppe || prev.ppe || 0),
                intangibleAssets: applySbr(bs.intangibleAssets || prev.intangibleAssets || 0),
                shareCapital: applySbr(bs.shareCapital || prev.shareCapital || 0),
                retainedEarnings: applySbr(bs.retainedEarnings || prev.retainedEarnings || 0),

                // Other Data carry-forward
                avgEmployees: other.avgEmployees || prev.avgEmployees || 0,
                ebitda: other.ebitda || prev.ebitda || 0,
                audited: Object.keys(audit).length > 0 ? 'Yes' : 'No',

                actualOperatingRevenue: pnl.revenue || prev.operatingRevenue || 0
            };
        });
    }, [company, companyName, extractedDetails, questionnaireAnswers]);

    useEffect(() => {
        if (!extractedDetails || Object.keys(extractedDetails).length === 0) return;
        // Allow mapping on hydration if values are not yet dirty
        // if (extractionVersion === 0) return; 

        const pnl = extractedDetails?.statementOfComprehensiveIncome || {};
        const bs = extractedDetails?.statementOfFinancialPosition || {};
        const pnlItems = Array.isArray(pnl.items) ? pnl.items : (Array.isArray(pnl.rows) ? pnl.rows : []);
        const bsItems = flattenBsItems(bs);
        const pnlNotesFromExtract = mapPnlItemsToNotes(pnlItems);
        const bsNotesFromExtract = mapBsItemsToNotes(bsItems);
        const hasPrevPnlData = pnlItems.some((item: any) => findItemPreviousAmount(item) !== undefined);
        const hasPrevBsData = bsItems.some((item: any) => findItemPreviousAmount(item) !== undefined);
        const sourceCurrency = pnlDisplayCurrency || 'AED';
        const rateToAed = pnlRateToAed;
        const toAedRounded = (value: number) => Math.round(convertAmountToAed(Number(value) || 0, sourceCurrency, rateToAed));

        const revenue =
            toNumber(pnl.revenue) ||
            toNumber(pnl.totalRevenue) ||
            toNumber(pnl.sales) ||
            findAmountInItems(pnlItems, ["revenue", "sales", "turnover"]);
        const costOfSales =
            toNumber(pnl.costOfSales) ||
            toNumber(pnl.costOfGoodsSold) ||
            toNumber(pnl.costOfSalesAndServices) ||
            findAmountInItems(pnlItems, ["cost of sales", "cost of goods", "cogs", "cost of revenue"]);
        const grossProfit = toNumber(pnl.grossProfit) || findAmountInItems(pnlItems, ["gross profit"]);
        const otherIncome = toNumber(pnl.otherIncome) || findAmountInItems(pnlItems, ["other income"]);
        const adminExpenses =
            toNumber(pnl.administrativeExpenses) ||
            toNumber(pnl.adminExpenses) ||
            findAmountInItems(pnlItems, ["general and administrative", "administrative", "admin expenses"]);
        const financeCosts = toNumber(pnl.financeCosts) || findAmountInItems(pnlItems, ["bank & finance", "bank and finance", "finance charges", "bank charges"]);
        const profitFromOps = findAmountInItems(pnlItems, ["profit from operating activities"]);
        const provisionTax = findAmountInItems(pnlItems, ["provision for corporate tax"]);
        const profitAfterTax = findAmountInItems(pnlItems, ["net profit for the year after tax", "profit after tax"]);
        const depreciation = toNumber(pnl.depreciation) || findAmountInItems(pnlItems, ["depreciation", "amortisation"]);
        const netProfit =
            toNumber(pnl.netProfit) ||
            toNumber(pnl.profitForTheYear) ||
            findAmountInItems(pnlItems, ["net profit", "profit for the year", "profit/(loss) for the year"]);
        const totalCompIncome = toNumber(pnl.totalComprehensiveIncome) || findAmountInItems(pnlItems, ["total comprehensive"]);
        const revenuePrev = findAmountInItemsForYear(pnlItems, ["revenue", "sales", "turnover"], 'previous') ?? 0;
        const costOfSalesPrev = findAmountInItemsForYear(pnlItems, ["cost of sales", "cost of goods", "cogs", "cost of revenue"], 'previous') ?? 0;
        const grossProfitPrev = findAmountInItemsForYear(pnlItems, ["gross profit"], 'previous') ?? 0;
        const otherIncomePrev = findAmountInItemsForYear(pnlItems, ["other income"], 'previous') ?? 0;
        const adminExpensesPrev = findAmountInItemsForYear(pnlItems, ["general and administrative", "administrative", "admin expenses"], 'previous') ?? 0;
        const financeCostsPrev = findAmountInItemsForYear(pnlItems, ["bank & finance", "bank and finance", "finance charges", "bank charges"], 'previous') ?? 0;
        const profitFromOpsPrev = findAmountInItemsForYear(pnlItems, ["profit from operating activities"], 'previous') ?? 0;
        const provisionTaxPrev = findAmountInItemsForYear(pnlItems, ["provision for corporate tax"], 'previous') ?? 0;
        const profitAfterTaxPrev = findAmountInItemsForYear(pnlItems, ["net profit for the year after tax", "profit after tax"], 'previous') ?? 0;
        const depreciationPrev = findAmountInItemsForYear(pnlItems, ["depreciation", "amortisation"], 'previous') ?? 0;
        const netProfitPrev = findAmountInItemsForYear(pnlItems, ["net profit", "profit for the year", "profit/(loss) for the year"], 'previous') ?? 0;
        const totalCompIncomePrev = findAmountInItemsForYear(pnlItems, ["total comprehensive"], 'previous') ?? 0;

        let normalizedRevenue = Math.abs(revenue);
        let normalizedCost = costOfSales;
        let normalizedGross = grossProfit;
        if (normalizedGross !== 0 && normalizedCost !== 0) {
            const derivedRevenue = normalizedGross + Math.abs(normalizedCost);
            if (normalizedRevenue === 0 || Math.abs(normalizedRevenue - derivedRevenue) > Math.max(1, Math.abs(derivedRevenue) * 0.02)) {
                normalizedRevenue = derivedRevenue;
            }
        }
        if (normalizedRevenue !== 0 && normalizedGross !== 0) {
            const derivedCost = normalizedRevenue - normalizedGross;
            if (normalizedCost === 0 || Math.abs(Math.abs(normalizedCost) - Math.abs(derivedCost)) > Math.max(1, Math.abs(derivedCost) * 0.02)) {
                normalizedCost = -Math.abs(derivedCost);
            }
        }
        if (normalizedGross === 0 && normalizedRevenue !== 0 && normalizedCost !== 0) {
            normalizedGross = normalizedRevenue - Math.abs(normalizedCost);
        }
        let normalizedRevenuePrev = Math.abs(revenuePrev);
        let normalizedCostPrev = costOfSalesPrev;
        let normalizedGrossPrev = grossProfitPrev;
        if (normalizedGrossPrev !== 0 && normalizedCostPrev !== 0) {
            const derivedRevenuePrev = normalizedGrossPrev + Math.abs(normalizedCostPrev);
            if (normalizedRevenuePrev === 0 || Math.abs(normalizedRevenuePrev - derivedRevenuePrev) > Math.max(1, Math.abs(derivedRevenuePrev) * 0.02)) {
                normalizedRevenuePrev = derivedRevenuePrev;
            }
        }
        if (normalizedRevenuePrev !== 0 && normalizedGrossPrev !== 0) {
            const derivedCostPrev = normalizedRevenuePrev - normalizedGrossPrev;
            if (normalizedCostPrev === 0 || Math.abs(Math.abs(normalizedCostPrev) - Math.abs(derivedCostPrev)) > Math.max(1, Math.abs(derivedCostPrev) * 0.02)) {
                normalizedCostPrev = -Math.abs(derivedCostPrev);
            }
        }
        if (normalizedGrossPrev === 0 && normalizedRevenuePrev !== 0 && normalizedCostPrev !== 0) {
            normalizedGrossPrev = normalizedRevenuePrev - Math.abs(normalizedCostPrev);
        }

        const totalAssets = toNumber(bs.totalAssets) || findAmountInItems(bsItems, ["total assets"]);
        const totalLiabilities = toNumber(bs.totalLiabilities) || findAmountInItems(bsItems, ["total liabilities"]);
        const totalEquity = toNumber(bs.totalEquity) || findAmountInItems(bsItems, ["total equity"]);
        const totalCurrentAssets =
            toNumber(bs.totalCurrentAssets) ||
            toNumber(bs.currentAssets) ||
            findAmountInItems(bsItems, ["total current assets", "current assets"]);
        const totalCurrentLiabilities =
            toNumber(bs.totalCurrentLiabilities) ||
            toNumber(bs.currentLiabilities) ||
            findAmountInItems(bsItems, ["total current liabilities", "current liabilities"]);
        const totalNonCurrentAssets =
            toNumber(bs.totalNonCurrentAssets) ||
            toNumber(bs.nonCurrentAssets) ||
            findAmountInItems(bsItems, ["total non-current assets", "total non current assets", "non-current assets", "non current assets"]);
        const totalNonCurrentLiabilities =
            toNumber(bs.totalNonCurrentLiabilities) ||
            toNumber(bs.nonCurrentLiabilities) ||
            findAmountInItems(bsItems, ["total non-current liabilities", "total non current liabilities", "non-current liabilities", "non current liabilities"]);
        const ppe = toNumber(bs.ppe) || findAmountInItems(bsItems, ["property, plant", "property plant", "ppe"]);
        const shareCapital = toNumber(bs.shareCapital) || findAmountInItems(bsItems, ["share capital"]);
        const retainedEarnings = toNumber(bs.retainedEarnings) || findAmountInItems(bsItems, ["retained earnings", "retained earnings & appropriation"]);
        const shareholdersCurrent = findAmountInItems(bsItems, ["shareholder's current account", "shareholders' current account"]);
        const tradeReceivables = findAmountInItems(bsItems, ["trade receivables"]);
        const cashAndEquiv = findAmountInItems(bsItems, ["cash and cash equivalents"]);
        const accountsPayable = findAmountInItems(bsItems, ["accounts & other payables", "accounts and other payables"]);
        const totalAssetsPrev = findAmountInItemsForYear(bsItems, ["total assets"], 'previous') ?? 0;
        const totalLiabilitiesPrev = findAmountInItemsForYear(bsItems, ["total liabilities"], 'previous') ?? 0;
        const totalEquityPrev = findAmountInItemsForYear(bsItems, ["total equity"], 'previous') ?? 0;
        const totalCurrentAssetsPrev = findAmountInItemsForYear(bsItems, ["total current assets", "current assets"], 'previous') ?? 0;
        const totalCurrentLiabilitiesPrev = findAmountInItemsForYear(bsItems, ["total current liabilities", "current liabilities"], 'previous') ?? 0;
        const totalNonCurrentAssetsPrev = findAmountInItemsForYear(bsItems, ["total non-current assets", "total non current assets", "non-current assets", "non current assets"], 'previous') ?? 0;
        const totalNonCurrentLiabilitiesPrev = findAmountInItemsForYear(bsItems, ["total non-current liabilities", "total non current liabilities", "non-current liabilities", "non current liabilities"], 'previous') ?? 0;
        const ppePrev = findAmountInItemsForYear(bsItems, ["property, plant", "property plant", "ppe"], 'previous') ?? 0;
        const shareCapitalPrev = findAmountInItemsForYear(bsItems, ["share capital"], 'previous') ?? 0;
        const retainedEarningsPrev = findAmountInItemsForYear(bsItems, ["retained earnings", "retained earnings & appropriation"], 'previous') ?? 0;
        const shareholdersCurrentPrev = findAmountInItemsForYear(bsItems, ["shareholder's current account", "shareholders' current account"], 'previous') ?? 0;
        const tradeReceivablesPrev = findAmountInItemsForYear(bsItems, ["trade receivables"], 'previous') ?? 0;
        const cashAndEquivPrev = findAmountInItemsForYear(bsItems, ["cash and cash equivalents"], 'previous') ?? 0;
        const accountsPayablePrev = findAmountInItemsForYear(bsItems, ["accounts & other payables", "accounts and other payables"], 'previous') ?? 0;

        if (!pnlDirty) {
            const normalizeNotes = (incoming: Record<string, WorkingNoteEntry[]>) => {
                const normalized: Record<string, WorkingNoteEntry[]> = {};
                Object.entries(incoming).forEach(([key, rows]) => {
                    normalized[key] = (rows as WorkingNoteEntry[]).map((row) => {
                        const amount = row.amount ?? row.currentYearAmount ?? 0;
                        return {
                            ...row,
                            currentYearAmount: row.currentYearAmount ?? amount,
                            previousYearAmount: row.previousYearAmount ?? 0,
                            amount
                        };
                    });
                });
                return normalized;
            };

            setPnlWorkingNotes(
                sanitizePnlWorkingNotes(
                    convertWorkingNotesToAed(normalizeNotes(pnlNotesFromExtract), sourceCurrency, rateToAed)
                )
            );
            setPnlValues(prev => ({
                ...prev,
                revenue: { currentYear: toAedRounded(normalizedRevenue) || prev.revenue?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(normalizedRevenuePrev) : (prev.revenue?.previousYear || 0) },
                cost_of_revenue: { currentYear: toAedRounded(normalizedCost) || prev.cost_of_revenue?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(normalizedCostPrev) : (prev.cost_of_revenue?.previousYear || 0) },
                gross_profit: { currentYear: toAedRounded(normalizedGross) || prev.gross_profit?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(normalizedGrossPrev) : (prev.gross_profit?.previousYear || 0) },
                other_income: { currentYear: toAedRounded(otherIncome) || prev.other_income?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(otherIncomePrev) : (prev.other_income?.previousYear || 0) },
                administrative_expenses: { currentYear: toAedRounded(adminExpenses) || prev.administrative_expenses?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(adminExpensesPrev) : (prev.administrative_expenses?.previousYear || 0) },
                finance_costs: { currentYear: toAedRounded(financeCosts) || prev.finance_costs?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(financeCostsPrev) : (prev.finance_costs?.previousYear || 0) },
                depreciation_ppe: { currentYear: toAedRounded(depreciation) || prev.depreciation_ppe?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(depreciationPrev) : (prev.depreciation_ppe?.previousYear || 0) },
                profit_loss_year: { currentYear: toAedRounded(netProfit || profitFromOps) || prev.profit_loss_year?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(netProfitPrev || profitFromOpsPrev) : (prev.profit_loss_year?.previousYear || 0) },
                total_comprehensive_income: { currentYear: toAedRounded(totalCompIncome) || prev.total_comprehensive_income?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(totalCompIncomePrev) : (prev.total_comprehensive_income?.previousYear || 0) },
                provisions_corporate_tax: { currentYear: toAedRounded(provisionTax) || prev.provisions_corporate_tax?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(provisionTaxPrev) : (prev.provisions_corporate_tax?.previousYear || 0) },
                profit_after_tax: { currentYear: toAedRounded(profitAfterTax || netProfit) || prev.profit_after_tax?.currentYear || 0, previousYear: hasPrevPnlData ? toAedRounded(profitAfterTaxPrev || netProfitPrev) : (prev.profit_after_tax?.previousYear || 0) }
            }));
        }

        if (!bsDirty) {
            setBsWorkingNotes(convertWorkingNotesToAed(bsNotesFromExtract, sourceCurrency, rateToAed));
            setBalanceSheetValues(prev => ({
                ...prev,
                property_plant_equipment: { currentYear: toAedRounded(ppe) || prev.property_plant_equipment?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(ppePrev) : (prev.property_plant_equipment?.previousYear || 0) },
                total_non_current_assets: { currentYear: toAedRounded(totalNonCurrentAssets) || prev.total_non_current_assets?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalNonCurrentAssetsPrev) : (prev.total_non_current_assets?.previousYear || 0) },
                cash_bank_balances: { currentYear: toAedRounded(cashAndEquiv) || prev.cash_bank_balances?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(cashAndEquivPrev) : (prev.cash_bank_balances?.previousYear || 0) },
                trade_receivables: { currentYear: toAedRounded(tradeReceivables) || prev.trade_receivables?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(tradeReceivablesPrev) : (prev.trade_receivables?.previousYear || 0) },
                total_current_assets: { currentYear: toAedRounded(totalCurrentAssets) || prev.total_current_assets?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalCurrentAssetsPrev) : (prev.total_current_assets?.previousYear || 0) },
                total_assets: { currentYear: toAedRounded(totalAssets) || prev.total_assets?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalAssetsPrev) : (prev.total_assets?.previousYear || 0) },
                share_capital: { currentYear: toAedRounded(shareCapital) || prev.share_capital?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(shareCapitalPrev) : (prev.share_capital?.previousYear || 0) },
                retained_earnings: { currentYear: toAedRounded(retainedEarnings) || prev.retained_earnings?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(retainedEarningsPrev) : (prev.retained_earnings?.previousYear || 0) },
                shareholders_current_accounts: { currentYear: toAedRounded(shareholdersCurrent) || prev.shareholders_current_accounts?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(shareholdersCurrentPrev) : (prev.shareholders_current_accounts?.previousYear || 0) },
                total_equity: { currentYear: toAedRounded(totalEquity) || prev.total_equity?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalEquityPrev) : (prev.total_equity?.previousYear || 0) },
                trade_other_payables: { currentYear: toAedRounded(accountsPayable) || prev.trade_other_payables?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(accountsPayablePrev) : (prev.trade_other_payables?.previousYear || 0) },
                total_non_current_liabilities: { currentYear: toAedRounded(totalNonCurrentLiabilities) || prev.total_non_current_liabilities?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalNonCurrentLiabilitiesPrev) : (prev.total_non_current_liabilities?.previousYear || 0) },
                total_current_liabilities: { currentYear: toAedRounded(totalCurrentLiabilities) || prev.total_current_liabilities?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalCurrentLiabilitiesPrev) : (prev.total_current_liabilities?.previousYear || 0) },
                total_liabilities: { currentYear: toAedRounded(totalLiabilities) || prev.total_liabilities?.currentYear || 0, previousYear: hasPrevBsData ? toAedRounded(totalLiabilitiesPrev) : (prev.total_liabilities?.previousYear || 0) },
                total_equity_liabilities: {
                    currentYear: toAedRounded((totalEquity || 0) + (totalLiabilities || 0)) || prev.total_equity_liabilities?.currentYear || 0,
                    previousYear: hasPrevBsData ? toAedRounded((totalEquityPrev || 0) + (totalLiabilitiesPrev || 0)) : (prev.total_equity_liabilities?.previousYear || 0)
                }
            }));
        }
    }, [extractedDetails, extractionVersion, pnlDirty, bsDirty, pnlDisplayCurrency, pnlRateToAed]);

    useEffect(() => {
        if (!pnlValues && !balanceSheetValues) return;
        setReportForm((prev: any) => {
            const next = {
                ...prev,
                operatingRevenue: pnlValues.revenue?.currentYear ?? prev.operatingRevenue ?? 0,
                derivingRevenueExpenses: pnlValues.cost_of_revenue?.currentYear ?? prev.derivingRevenueExpenses ?? 0,
                grossProfit: pnlValues.gross_profit?.currentYear ?? prev.grossProfit ?? 0,
                salaries: prev.salaries ?? 0,
                depreciation: pnlValues.depreciation_ppe?.currentYear ?? prev.depreciation ?? 0,
                otherExpenses: prev.otherExpenses ?? 0,
                netProfit: pnlValues.profit_loss_year?.currentYear ?? prev.netProfit ?? 0,
                accountingIncomeTaxPeriod: pnlValues.profit_loss_year?.currentYear ?? prev.accountingIncomeTaxPeriod ?? prev.netProfit ?? 0,
                totalCurrentAssets: balanceSheetValues.total_current_assets?.currentYear ?? prev.totalCurrentAssets ?? 0,
                totalNonCurrentAssets: balanceSheetValues.total_non_current_assets?.currentYear ?? prev.totalNonCurrentAssets ?? 0,
                totalAssets: balanceSheetValues.total_assets?.currentYear ?? prev.totalAssets ?? 0,
                totalCurrentLiabilities: balanceSheetValues.total_current_liabilities?.currentYear ?? prev.totalCurrentLiabilities ?? 0,
                totalNonCurrentLiabilities: balanceSheetValues.total_non_current_liabilities?.currentYear ?? prev.totalNonCurrentLiabilities ?? 0,
                totalLiabilities: balanceSheetValues.total_liabilities?.currentYear ?? prev.totalLiabilities ?? 0,
                totalEquity: balanceSheetValues.total_equity?.currentYear ?? prev.totalEquity ?? 0,
                totalEquityLiabilities: balanceSheetValues.total_equity_liabilities?.currentYear ?? prev.totalEquityLiabilities ?? 0,
                ppe: balanceSheetValues.property_plant_equipment?.currentYear ?? prev.ppe ?? 0,
                shareCapital: balanceSheetValues.share_capital?.currentYear ?? prev.shareCapital ?? 0,
                retainedEarnings: balanceSheetValues.retained_earnings?.currentYear ?? prev.retainedEarnings ?? 0
            };

            const same = Object.keys(next).every(key => next[key] === prev[key]);
            return same ? prev : next;
        });
    }, [pnlValues, balanceSheetValues]);

    useEffect(() => {
        setReportForm((prev: any) => {
            const toNum = (val: any) => (typeof val === 'number' && !isNaN(val) ? val : (parseFloat(val) || 0));
            const accountingIncome = toNum(prev.accountingIncomeTaxPeriod);
            const taxableIncomeBeforeAdj = accountingIncome;

            const taxLossesUtilised = toNum(prev.taxLossesUtilised);
            const taxLossesClaimed = toNum(prev.taxLossesClaimed);
            const preGroupingLosses = toNum(prev.preGroupingLosses);
            const taxCredits = toNum(prev.taxCredits);

            const taxableIncomeTaxPeriod = taxableIncomeBeforeAdj - taxLossesUtilised - taxLossesClaimed - preGroupingLosses;
            const taxableIncomeForTax = Math.max(0, taxableIncomeTaxPeriod);
            const threshold = 375000;
            const corporateTaxLiability =
                taxableIncomeForTax > threshold ? (taxableIncomeForTax - threshold) * 0.09 : 0;
            const corporateTaxPayable = Math.max(0, corporateTaxLiability - taxCredits);

            if (
                prev.taxableIncomeBeforeAdj === taxableIncomeBeforeAdj &&
                prev.taxableIncomeTaxPeriod === taxableIncomeTaxPeriod &&
                prev.corporateTaxLiability === corporateTaxLiability &&
                prev.corporateTaxPayable === corporateTaxPayable
            ) {
                return prev;
            }

            return {
                ...prev,
                taxableIncomeBeforeAdj,
                taxableIncomeTaxPeriod,
                corporateTaxLiability,
                corporateTaxPayable
            };
        });
    }, [
        reportForm.accountingIncomeTaxPeriod,
        reportForm.taxableIncomeBeforeAdj,
        reportForm.taxLossesUtilised,
        reportForm.taxLossesClaimed,
        reportForm.preGroupingLosses,
        reportForm.taxCredits
    ]);

    useEffect(() => {
        if (!pnlWorkingNotes) return;
        setPnlValues(prev => {
            const next = { ...prev };
            Object.entries(pnlWorkingNotes).forEach(([id, notes]) => {
                const typedNotes = notes as WorkingNoteEntry[];
                const currentTotal = typedNotes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
                const previousTotal = typedNotes.reduce((sum, n) => sum + (n.previousYearAmount ?? 0), 0);
                next[id] = {
                    currentYear: currentTotal,
                    previousYear: previousTotal
                };
            });
            return next;
        });
    }, [pnlWorkingNotes]);

    useEffect(() => {
        setPnlValues(prev => {
            const get = (id: string, year: 'currentYear' | 'previousYear') => prev[id]?.[year] || 0;
            const hasGrossNote = (pnlWorkingNotes?.gross_profit?.length || 0) > 0;
            const hasNetNote = (pnlWorkingNotes?.profit_loss_year?.length || 0) > 0;
            const hasTotalCompNote = (pnlWorkingNotes?.total_comprehensive_income?.length || 0) > 0;

            const calcTotals = (year: 'currentYear' | 'previousYear') => {
                const revenue = Math.abs(get('revenue', year));
                const costOfRevenue = Math.abs(get('cost_of_revenue', year));
                const otherIncome = Math.abs(get('other_income', year));
                const unrealised = Math.abs(get('unrealised_gain_loss_fvtpl', year));
                const shareProfits = Math.abs(get('share_profits_associates', year));
                const revaluation = Math.abs(get('gain_loss_revaluation_property', year));
                const impairmentPpe = Math.abs(get('impairment_losses_ppe', year));
                const impairmentInt = Math.abs(get('impairment_losses_intangible', year));
                const businessPromotion = Math.abs(get('business_promotion_selling', year));
                const forexLoss = Math.abs(get('foreign_exchange_loss', year));
                const sellingDist = Math.abs(get('selling_distribution_expenses', year));
                const admin = Math.abs(get('administrative_expenses', year));
                const financeCosts = Math.abs(get('finance_costs', year));
                const depreciation = Math.abs(get('depreciation_ppe', year));

                const totalIncome = revenue + otherIncome + unrealised + shareProfits + revaluation;
                const totalExpenses = costOfRevenue + impairmentPpe + impairmentInt + businessPromotion + forexLoss + sellingDist + admin + financeCosts + depreciation;
                const grossProfit = revenue - costOfRevenue;
                const profitLossYear = totalIncome - totalExpenses;

                return { grossProfit, profitLossYear };
            };

            const current = calcTotals('currentYear');
            const previous = calcTotals('previousYear');

            const next = {
                ...prev,
                gross_profit: {
                    currentYear: hasGrossNote ? get('gross_profit', 'currentYear') : current.grossProfit,
                    previousYear: hasGrossNote ? get('gross_profit', 'previousYear') : previous.grossProfit
                },
                profit_loss_year: {
                    currentYear: hasNetNote ? get('profit_loss_year', 'currentYear') : current.profitLossYear,
                    previousYear: hasNetNote ? get('profit_loss_year', 'previousYear') : previous.profitLossYear
                },
                total_comprehensive_income: {
                    currentYear: hasTotalCompNote ? get('total_comprehensive_income', 'currentYear') : (hasNetNote ? get('profit_loss_year', 'currentYear') : current.profitLossYear),
                    previousYear: hasTotalCompNote ? get('total_comprehensive_income', 'previousYear') : (hasNetNote ? get('profit_loss_year', 'previousYear') : previous.profitLossYear)
                }
            };

            const same =
                prev.gross_profit?.currentYear === next.gross_profit.currentYear &&
                prev.gross_profit?.previousYear === next.gross_profit.previousYear &&
                prev.profit_loss_year?.currentYear === next.profit_loss_year.currentYear &&
                prev.profit_loss_year?.previousYear === next.profit_loss_year.previousYear &&
                prev.total_comprehensive_income?.currentYear === next.total_comprehensive_income.currentYear &&
                prev.total_comprehensive_income?.previousYear === next.total_comprehensive_income.previousYear;

            return same ? prev : next;
        });
    }, [pnlWorkingNotes, pnlValues]);

    useEffect(() => {
        setPnlValues(prev => {
            const netProfitCurrent = prev.profit_loss_year?.currentYear ?? 0;
            const netProfitPrevious = prev.profit_loss_year?.previousYear ?? 0;
            const threshold = 375000;
            const calcTax = (val: number) => {
                const taxable = Math.max(0, val);
                return taxable > threshold ? (taxable - threshold) * 0.09 : 0;
            };
            const corporateTaxCurrent = calcTax(netProfitCurrent);
            const corporateTaxPrevious = calcTax(netProfitPrevious);
            const profitAfterTaxCurrent = netProfitCurrent - corporateTaxCurrent;
            const profitAfterTaxPrevious = netProfitPrevious - corporateTaxPrevious;

            const next = {
                ...prev,
                provisions_corporate_tax: {
                    currentYear: corporateTaxCurrent,
                    previousYear: corporateTaxPrevious
                },
                profit_after_tax: {
                    currentYear: profitAfterTaxCurrent,
                    previousYear: profitAfterTaxPrevious
                }
            };

            const same =
                prev.provisions_corporate_tax?.currentYear === next.provisions_corporate_tax.currentYear &&
                prev.provisions_corporate_tax?.previousYear === next.provisions_corporate_tax.previousYear &&
                prev.profit_after_tax?.currentYear === next.profit_after_tax.currentYear &&
                prev.profit_after_tax?.previousYear === next.profit_after_tax.previousYear;

            return same ? prev : next;
        });
    }, [pnlValues.profit_loss_year?.currentYear, pnlValues.profit_loss_year?.previousYear]);

    useEffect(() => {
        if (!bsWorkingNotes) return;
        setBalanceSheetValues(prev => {
            const next = { ...prev };
            Object.entries(bsWorkingNotes).forEach(([id, notes]) => {
                const typedNotes = notes as WorkingNoteEntry[];
                const currentTotal = typedNotes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
                const previousTotal = typedNotes.reduce((sum, n) => sum + (n.previousYearAmount ?? 0), 0);
                next[id] = {
                    currentYear: currentTotal,
                    previousYear: previousTotal
                };
            });
            return next;
        });
    }, [bsWorkingNotes]);

    const handleSkipQuestionnaire = useCallback(async () => {
        await handleSaveStep(7);
        setCurrentStep(8);
    }, [handleSaveStep]);

    const handleExtractData = async () => {
        if (auditFiles.length === 0) return;
        setIsExtracting(true);
        try {
            const partsArray = await Promise.all(auditFiles.map(async (file) => fileToGenerativeParts(file)));
            const parts = partsArray.flat();

            let data: Record<string, any> = {};
            if (selectedDocCategory === 'audit_report' || selectedDocCategory === 'financial_statements') {
                data = await extractAuditReportDetails(parts);
            } else {
                data = await extractGenericDetailsFromDocuments(parts);
            }

            setExtractedDetails(data);
            setExtractionVersion(prev => prev + 1);
            setPnlDirty(false);
            setBsDirty(false);

            if (Object.keys(data).length > 0) {
                // Focus on the first available section
                setOpenExtractedSection(Object.keys(data)[0]);
            }
        } catch (e) {
            console.error("Extraction failed", e);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleExtractAdditionalData = async () => {
        if (additionalFiles.length === 0) return;
        setIsExtractingVat(true);
        try {
            const results = await Promise.all(additionalFiles.map(async (file) => {
                const parts = await fileToGenerativeParts(file);
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

            const anyData = results.some(r => r.sales.total > 0 || r.purchases.total > 0 || r.netVatPayable !== 0);
            if (!anyData) {
                alert("We couldn't extract any significant VAT data from the uploaded files. Please ensure they are valid VAT 201 returns and try again.");
                setIsExtractingVat(false);
                return;
            }

            setAdditionalDetails({ vatFileResults: results });
            await handleSaveStep(2);
            setCurrentStep(3);
        } catch (e: any) {
            console.error("Failed to extract per-file VAT totals", e);
            alert(`VAT extraction failed: ${e.message || "Unknown error"}. Please try again.`);
        } finally {
            setIsExtractingVat(false);
        }
    };

    const handleVatSummarizationContinue = async () => {
        await handleSaveStep(3);
        setCurrentStep(4); // To Profit & Loss
    };

    const handleVatAdjustmentChange = (periodId: string, field: string, value: string) => {
        setVatManualAdjustments(prev => ({
            ...prev,
            [periodId]: {
                ...(prev[periodId] || {}),
                [field]: value
            }
        }));
    };

    const getVatExportRows = React.useCallback((vatData: any) => {
        const { periods, grandTotals } = vatData;
        const rows: any[] = [];
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

        rows.push([
            "GRAND TOTAL", grandTotals.sales.zero, grandTotals.sales.tv, grandTotals.sales.vat, grandTotals.sales.total,
            "GRAND TOTAL", grandTotals.purchases.zero, grandTotals.purchases.tv, grandTotals.purchases.vat, grandTotals.purchases.total,
            grandTotals.net
        ]);
        return rows;
    }, []);

    const buildVatSummaryRows = (title: string) => {
        const rows: any[][] = [[title], []];

        rows.push(["VAT FILE RESULTS"]);
        if (Array.isArray(additionalDetails.vatFileResults) && additionalDetails.vatFileResults.length > 0) {
            rows.push([
                "File Name", "Period From", "Period To",
                "Sales (Zero)", "Sales (Standard)", "Sales VAT", "Sales Total",
                "Purchases (Zero)", "Purchases (Standard)", "Purchases VAT", "Purchases Total",
                "Net VAT Payable"
            ]);
            additionalDetails.vatFileResults.forEach((res: any) => {
                rows.push([
                    res.fileName || '-',
                    formatDate(res.periodFrom),
                    formatDate(res.periodTo),
                    res.sales?.zeroRated || 0,
                    res.sales?.standardRated || 0,
                    res.sales?.vatAmount || 0,
                    res.sales?.total || 0,
                    res.purchases?.zeroRated || 0,
                    res.purchases?.standardRated || 0,
                    res.purchases?.vatAmount || 0,
                    res.purchases?.total || 0,
                    res.netVatPayable || 0
                ]);
            });
        } else {
            rows.push(["No files uploaded"]);
        }

        rows.push([], ["VAT SUMMARY"], [
            "Period",
            "Sales Zero", "Sales Standard", "Sales VAT", "Sales Total",
            "Purchases Zero", "Purchases Standard", "Purchases VAT", "Purchases Total",
            "Net VAT"
        ]);

        vatStepData.periods.forEach((p: any) => {
            const periodLabel = `${p.periodFrom} - ${p.periodTo}`;
            rows.push([
                periodLabel,
                p.sales.zero,
                p.sales.tv,
                p.sales.vat,
                p.sales.total,
                p.purchases.zero,
                p.purchases.tv,
                p.purchases.vat,
                p.purchases.total,
                p.net
            ]);
        });

        rows.push([
            "GRAND TOTAL",
            vatStepData.grandTotals.sales.zero,
            vatStepData.grandTotals.sales.tv,
            vatStepData.grandTotals.sales.vat,
            vatStepData.grandTotals.sales.total,
            vatStepData.grandTotals.purchases.zero,
            vatStepData.grandTotals.purchases.tv,
            vatStepData.grandTotals.purchases.vat,
            vatStepData.grandTotals.purchases.total,
            vatStepData.grandTotals.net
        ]);

        return rows;
    };

    const handleExportStep4VAT = () => {
        const workbook = XLSX.utils.book_new();
        const exportData = getVatExportRows(vatStepData);

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        applySheetStyling(worksheet, 2, 1);

        XLSX.utils.book_append_sheet(workbook, worksheet, "VAT Summarization");
        XLSX.writeFile(workbook, `${companyName}_Step3_VAT_Summarization.xlsx`);
    };

    const handlePnlChange = (id: string, year: 'currentYear' | 'previousYear', value: number) => {
        setPnlDirty(true);
        setPnlValues(prev => ({
            ...prev,
            [id]: {
                currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
            }
        }));
    };

    const handleBalanceSheetChange = (id: string, year: 'currentYear' | 'previousYear', value: number) => {
        setBsDirty(true);
        setBalanceSheetValues(prev => ({
            ...prev,
            [id]: {
                currentYear: year === 'currentYear' ? value : (prev[id]?.currentYear || 0),
                previousYear: year === 'previousYear' ? value : (prev[id]?.previousYear || 0)
            }
        }));
    };

    const handleAddPnlAccount = (item: ProfitAndLossItem & { sectionId: string }) => {
        setPnlStructure(prev => {
            const index = prev.findIndex(i => i.id === item.sectionId);
            if (index === -1) return prev;
            const newStructure = [...prev];
            newStructure.splice(index + 1, 0, { ...item, type: 'item', isEditable: true });
            return newStructure;
        });
    };

    const handleAddBsAccount = (item: BalanceSheetItem & { sectionId: string }) => {
        setBsStructure(prev => {
            const index = prev.findIndex(i => i.id === item.sectionId);
            if (index === -1) return prev;
            const newStructure = [...prev];
            newStructure.splice(index + 1, 0, { ...item, type: 'item', isEditable: true });
            return newStructure;
        });
    };

    const handleUpdatePnlWorkingNote = (id: string, notes: WorkingNoteEntry[]) => {
        setPnlDirty(true);
        setPnlWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const currentTotal = notes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, n) => sum + (n.previousYearAmount ?? 0), 0);
        setPnlValues(prev => ({
            ...prev,
            [id]: {
                currentYear: currentTotal,
                previousYear: previousTotal
            }
        }));
    };

    const handleUpdateBsWorkingNote = (id: string, notes: WorkingNoteEntry[]) => {
        setBsDirty(true);
        setBsWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const currentTotal = notes.reduce((sum, n) => sum + (n.currentYearAmount ?? n.amount ?? 0), 0);
        const previousTotal = notes.reduce((sum, n) => sum + (n.previousYearAmount ?? 0), 0);
        setBalanceSheetValues(prev => ({
            ...prev,
            [id]: {
                currentYear: currentTotal,
                previousYear: previousTotal
            }
        }));
    };

    const handleExportStepPnl = () => {
        const wb = XLSX.utils.book_new();
        const includeOriginalEquivalent = showOriginalEquivalent && !!pnlDisplayCurrency && pnlRateToAed > 0;
        const data = pnlStructure.map(item => {
            const currentAed = pnlValues[item.id]?.currentYear || 0;
            const previousAed = pnlValues[item.id]?.previousYear || 0;
            return includeOriginalEquivalent
                ? {
                    'Item': item.label,
                    'Current Year (AED)': currentAed,
                    'Previous Year (AED)': previousAed,
                    [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                    [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                }
                : {
                    'Item': item.label,
                    'Current Year (AED)': currentAed,
                    'Previous Year (AED)': previousAed
                };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Profit and Loss");

        const pnlNotesItems: any[] = [];
        Object.entries(pnlWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = pnlStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    const currentAed = n.currentYearAmount ?? n.amount ?? 0;
                    const previousAed = n.previousYearAmount ?? 0;
                    pnlNotesItems.push(
                        includeOriginalEquivalent
                            ? {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed,
                                [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                                [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                            }
                            : {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed
                            }
                    );
                });
            }
        });

        const wsNotes = XLSX.utils.json_to_sheet(
            pnlNotesItems.length > 0
                ? pnlNotesItems
                : (includeOriginalEquivalent
                    ? [{ "Linked Item": "", "Description": "", "Current Year (AED)": 0, "Previous Year (AED)": 0, [`Current Year (${pnlDisplayCurrency})`]: 0, [`Previous Year (${pnlDisplayCurrency})`]: 0 }]
                    : [{ "Linked Item": "", "Description": "", "Current Year (AED)": 0, "Previous Year (AED)": 0 }])
        );
        wsNotes['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(wsNotes, 1);
        XLSX.utils.book_append_sheet(wb, wsNotes, "PNL - Working Notes");

        XLSX.writeFile(wb, `${companyName}_Profit_And_Loss.xlsx`);
    };

    const handleExportStepBS = () => {
        const wb = XLSX.utils.book_new();
        const includeOriginalEquivalent = showOriginalEquivalent && !!pnlDisplayCurrency && pnlRateToAed > 0;
        const data = bsStructure.map(item => {
            const currentAed = balanceSheetValues[item.id]?.currentYear || 0;
            const previousAed = balanceSheetValues[item.id]?.previousYear || 0;
            return includeOriginalEquivalent
                ? {
                    'Item': item.label,
                    'Current Year (AED)': currentAed,
                    'Previous Year (AED)': previousAed,
                    [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                    [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                }
                : {
                    'Item': item.label,
                    'Current Year (AED)': currentAed,
                    'Previous Year (AED)': previousAed
                };
        });
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");

        const bsNotesItems: any[] = [];
        Object.entries(bsWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = bsStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    const currentAed = n.currentYearAmount ?? n.amount ?? 0;
                    const previousAed = n.previousYearAmount ?? 0;
                    bsNotesItems.push(
                        includeOriginalEquivalent
                            ? {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed,
                                [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                                [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                            }
                            : {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed
                            }
                    );
                });
            }
        });

        const wsNotes = XLSX.utils.json_to_sheet(
            bsNotesItems.length > 0
                ? bsNotesItems
                : (includeOriginalEquivalent
                    ? [{ "Linked Item": "", "Description": "", "Current Year (AED)": 0, "Previous Year (AED)": 0, [`Current Year (${pnlDisplayCurrency})`]: 0, [`Previous Year (${pnlDisplayCurrency})`]: 0 }]
                    : [{ "Linked Item": "", "Description": "", "Current Year (AED)": 0, "Previous Year (AED)": 0 }])
        );
        wsNotes['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(wsNotes, 1);
        XLSX.utils.book_append_sheet(wb, wsNotes, "BS - Working Notes");

        XLSX.writeFile(wb, `${companyName}_Balance_Sheet.xlsx`);
    };




    const handleExportExcel = () => {
        const workbook = XLSX.utils.book_new();
        const includeOriginalEquivalent = showOriginalEquivalent && !!pnlDisplayCurrency && pnlRateToAed > 0;
        const originalHeader = includeOriginalEquivalent ? `Original (${pnlDisplayCurrency})` : null;

        // --- 1. Final Return Sheet ---
        const exportData: any[][] = [];

        // Helper value getter with SBR logic
        const getValue = (field: string) => {
            const isSmallBusinessRelief = questionnaireAnswers[6] === 'Yes';
            const financialFields = [
                'accountingIncomeTaxPeriod', 'taxableIncomeTaxPeriod', 'corporateTaxLiability', 'corporateTaxPayable',
                'totalAssets', 'totalLiabilities', 'totalEquity', 'netProfit', 'totalCurrentAssets', 'totalNonCurrentAssets',
                'totalCurrentLiabilities', 'totalNonCurrentLiabilities', 'totalEquityLiabilities',
                'operatingRevenue', 'derivingRevenueExpenses', 'grossProfit', 'salaries', 'depreciation', 'otherExpenses',
                'nonOpExpensesExcl', 'netInterest', 'ppe', 'shareCapital', 'fines', 'donations', 'entertainment',
                'dividendsReceived', 'otherNonOpRevenue', 'interestIncome', 'interestExpense',
                'gainAssetDisposal', 'lossAssetDisposal', 'netGainsAsset', 'forexGain', 'forexLoss', 'netForex',
                'ociIncomeNoRec', 'ociLossNoRec', 'ociIncomeRec', 'ociLossRec', 'ociOtherIncome', 'ociOtherLoss',
                'totalComprehensiveIncome', 'intangibleAssets', 'financialAssets', 'otherNonCurrentAssets',
                'retainedEarnings', 'otherEquity', 'avgEmployees', 'ebitda',
                'shareProfitsEquity', 'accountingNetProfitsUninc', 'gainsDisposalUninc', 'gainsLossesReportedFS',
                'realisationBasisAdj', 'transitionalAdj', 'dividendsResident', 'incomeParticipatingInterests',
                'taxableIncomeForeignPE', 'incomeIntlAircraftShipping', 'adjQualifyingGroup', 'adjBusinessRestructuring',
                'adjNonDeductibleExp', 'adjInterestExp', 'adjRelatedParties', 'adjQualifyingInvestmentFunds',
                'otherAdjustmentsTax', 'taxableIncomeBeforeAdj', 'taxLossesUtilised', 'taxLossesClaimed',
                'preGroupingLosses', 'taxCredits'
            ];

            if (isSmallBusinessRelief && financialFields.includes(field)) {
                return 0;
            }
            return reportForm[field];
        };

        // Title Row
        exportData.push(["CORPORATE TAX RETURN - FEDERAL TAX AUTHORITY"]);
        if (includeOriginalEquivalent) {
            exportData.push(["Values are in AED", "", `${originalHeader} at 1 ${pnlDisplayCurrency} = ${pnlRateToAed.toFixed(6)} AED`]);
        }
        exportData.push([]);

        REPORT_STRUCTURE.forEach(section => {
            exportData.push([section.title.toUpperCase()]);
            section.fields.forEach(field => {
                if (field.type === 'header') {
                    exportData.push([field.label.replace(/---/g, '').trim()]);
                } else {
                    const label = field.label;
                    let value = getValue(field.field);
                    let originalValue: number | string = '';
                    if (value === undefined || value === null || value === '') {
                        value = '';
                    } else if (field.type === 'number') {
                        if (typeof value !== 'number') value = parseFloat(value) || 0;
                        if (includeOriginalEquivalent) {
                            originalValue = Number.isFinite(value) ? (value / pnlRateToAed) : '';
                        }
                    }
                    exportData.push(includeOriginalEquivalent ? [label, value, originalValue] : [label, value]);
                }
            });
            exportData.push([]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        const wscols = includeOriginalEquivalent ? [{ wch: 60 }, { wch: 25 }, { wch: 25 }] : [{ wch: 60 }, { wch: 25 }];
        worksheet['!cols'] = wscols;

        // Number format
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
            const cell = worksheet[cellRef];
            if (cell && cell.t === 'n') cell.z = '#,##0.00';
            if (includeOriginalEquivalent) {
                const origCellRef = XLSX.utils.encode_cell({ c: 2, r: R });
                const origCell = worksheet[origCellRef];
                if (origCell && origCell.t === 'n') origCell.z = '#,##0.00';
            }
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, "Final Return");

        // --- 2. Tax Computation Sheet ---
        const taxData: (string | number)[][] = [
            ["Tax Computation Summary"],
            includeOriginalEquivalent ? ["Field", "Value (AED)", `Value (${pnlDisplayCurrency})`] : ["Field", "Value (AED)"],
        ];
        if (includeOriginalEquivalent) {
            taxData.splice(1, 0, [`Converted to AED using rate: 1 ${pnlDisplayCurrency} = ${pnlRateToAed.toFixed(6)} AED`]);
        }
        if (ftaFormValues) {
            const taxRows: [string, number][] = [
                ["Accounting Net Profit or Loss", ftaFormValues.netProfit || 0],
                ["Adjustments (Exemptions/Reliefs)", 0],
                ["Total Taxable Income", ftaFormValues.taxableIncome || 0],
                ["Corporate Tax Payable", ftaFormValues.corporateTaxLiability || 0],
            ];
            taxRows.forEach(([label, aedVal]) => {
                taxData.push(
                    includeOriginalEquivalent
                        ? [label, aedVal, aedVal / pnlRateToAed]
                        : [label, aedVal]
                );
            });
        }
        const wsTax = XLSX.utils.aoa_to_sheet(taxData);
        wsTax['!cols'] = includeOriginalEquivalent ? [{ wch: 40 }, { wch: 20 }, { wch: 20 }] : [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsTax, "Tax Computation");

        // --- 3. Profit & Loss Sheet ---
        const pnlHeaders: (string | number)[] = includeOriginalEquivalent
            ? ["Account", "Current Year (AED)", "Previous Year (AED)", `Current Year (${pnlDisplayCurrency})`, `Previous Year (${pnlDisplayCurrency})`]
            : ["Account", "Current Year", "Previous Year"];
        const pnlData: (string | number)[][] = [["Profit & Loss Statement"]];
        if (includeOriginalEquivalent) {
            pnlData.push([`Converted to AED using rate: 1 ${pnlDisplayCurrency} = ${pnlRateToAed.toFixed(6)} AED`]);
        }
        pnlData.push(pnlHeaders);
        pnlStructure.forEach((item: any) => {
            const val = pnlValues[item.id] || { currentYear: 0, previousYear: 0 };
            if (item.type === 'header') {
                pnlData.push(includeOriginalEquivalent ? [item.label.toUpperCase(), "", "", "", ""] : [item.label.toUpperCase(), "", ""]);
            } else if (item.type !== 'spacer') {
                const currentAed = Number(val.currentYear || 0);
                const previousAed = Number(val.previousYear || 0);
                if (includeOriginalEquivalent) {
                    pnlData.push([
                        item.label,
                        currentAed,
                        previousAed,
                        currentAed / pnlRateToAed,
                        previousAed / pnlRateToAed
                    ]);
                } else {
                    pnlData.push([item.label, currentAed, previousAed]);
                }
            }
        });
        const wsPnl = XLSX.utils.aoa_to_sheet(pnlData);
        wsPnl['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsPnl, "Profit & Loss");

        // --- 4. Balance Sheet ---
        const bsHeaders: (string | number)[] = includeOriginalEquivalent
            ? ["Account", "Current Year (AED)", "Previous Year (AED)", `Current Year (${pnlDisplayCurrency})`, `Previous Year (${pnlDisplayCurrency})`]
            : ["Account", "Current Year", "Previous Year"];
        const bsData: (string | number)[][] = [["Balance Sheet"]];
        if (includeOriginalEquivalent) {
            bsData.push([`Converted to AED using rate: 1 ${pnlDisplayCurrency} = ${pnlRateToAed.toFixed(6)} AED`]);
        }
        bsData.push(bsHeaders);
        bsStructure.forEach((item: any) => {
            const val = balanceSheetValues[item.id] || { currentYear: 0, previousYear: 0 };
            if (item.type === 'header') {
                bsData.push(includeOriginalEquivalent ? [item.label.toUpperCase(), "", "", "", ""] : [item.label.toUpperCase(), "", ""]);
            } else if (item.type !== 'spacer') {
                const currentAed = Number(val.currentYear || 0);
                const previousAed = Number(val.previousYear || 0);
                if (includeOriginalEquivalent) {
                    bsData.push([
                        item.label,
                        currentAed,
                        previousAed,
                        currentAed / pnlRateToAed,
                        previousAed / pnlRateToAed
                    ]);
                } else {
                    bsData.push([item.label, currentAed, previousAed]);
                }
            }
        });
        const wsBs = XLSX.utils.aoa_to_sheet(bsData);
        wsBs['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsBs, "Balance Sheet");

        // --- 5. VAT Summary ---
        const vatData: (string | number)[][] = [["VAT Summary"], ["Category", "Amount (AED)"]];
        if (vatStepData?.grandTotals) {
            vatData.push(["Total Sales (Outputs)", vatStepData.grandTotals.sales.total || 0]);
            vatData.push(["Total Sales VAT", vatStepData.grandTotals.sales.vat || 0]);
            vatData.push(["Total Purchases (Inputs)", vatStepData.grandTotals.purchases.total || 0]);
            vatData.push(["Total Purchases Recoverable VAT", vatStepData.grandTotals.purchases.recoverableVat || 0]);
            const netVat = (vatStepData.grandTotals.sales.vat - vatStepData.grandTotals.purchases.recoverableVat);
            vatData.push(["Net VAT Payable/Refundable", netVat || 0]);
        }
        const wsVat = XLSX.utils.aoa_to_sheet(vatData);
        wsVat['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsVat, "VAT Summary");

        // Match the required final report tab order shown in Excel UI.
        const finalReportSheetOrder = ["Profit & Loss", "Balance Sheet", "VAT Summary", "Tax Computation", "Final Return"];
        const remainingSheets = workbook.SheetNames.filter((name: string) => !finalReportSheetOrder.includes(name));
        workbook.SheetNames = [
            ...finalReportSheetOrder.filter((name) => workbook.Sheets[name]),
            ...remainingSheets
        ];

        XLSX.writeFile(workbook, `${companyName || 'Company'}_CT_Final_Report_Comprehensive.xlsx`);
    };

    const handleExportAll = () => {
        const workbook = XLSX.utils.book_new();
        const includeOriginalEquivalent = showOriginalEquivalent && !!pnlDisplayCurrency && pnlRateToAed > 0;

        // Common Helpers
        const formatKeyStr = (key: string) => {
            return key
                .replace(/([A-Z])/g, ' $1') // Split camelCase
                .replace(/_/g, ' ')        // Split snake_case
                .trim()
                .replace(/\b\w/g, c => c.toUpperCase());
        };

        const formatCellValue = (val: any): any => {
            if (val === null || val === undefined) return "";
            if (typeof val === 'number') return val;
            if (Array.isArray(val)) {
                if (val.length === 0) return "";
                return val.map(item => formatCellValue(item)).join(" | ");
            }
            if (typeof val === 'object') {
                return Object.entries(val)
                    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${formatCellValue(v)}`)
                    .join(", ");
            }
            return String(val);
        };

        // 1. Audit Extraction Sheet
        const auditExportData: any[][] = [];
        const auditSectionTitles: Record<string, string> = {
            generalInformation: "GENERAL INFORMATION",
            auditorsReport: "AUDITOR'S REPORT",
            managersReport: "MANAGER'S REPORT",
            statementOfFinancialPosition: "STATEMENT OF FINANCIAL POSITION",
            statementOfComprehensiveIncome: "STATEMENT OF COMPREHENSIVE INCOME",
            statementOfChangesInEquity: "STATEMENT OF CHANGES IN SHAREHOLDERS' EQUITY",
            statementOfCashFlows: "STATEMENT OF CASH FLOWS",
            otherInformation: "OTHER INFORMATION"
        };

        const pushAuditDataRecursively = (data: any, target: any[][], depth = 0) => {
            if (data === null || data === undefined) return;

            if (Array.isArray(data)) {
                if (data.length === 0) return;
                if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
                    const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
                    target.push(["".padStart(depth * 4), ...keys.map(k => formatKeyStr(k))]);
                    data.forEach(item => {
                        target.push(["".padStart(depth * 4), ...keys.map(k => formatCellValue(item[k]))]);
                    });
                } else {
                    data.forEach(item => {
                        if (typeof item === 'object') {
                            pushAuditDataRecursively(item, target, depth + 1);
                        } else {
                            target.push(["".padStart(depth * 4) + "- " + String(item)]);
                        }
                    });
                }
                return;
            }

            if (typeof data === 'object') {
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        target.push([formatKeyStr(key).toUpperCase()]);
                        pushAuditDataRecursively(value, target, depth + 1);
                    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                        target.push([formatKeyStr(key).toUpperCase()]);
                        pushAuditDataRecursively(value, target, depth + 1);
                    } else {
                        target.push([formatKeyStr(key), formatCellValue(value)]);
                    }
                });
                return;
            }
            target.push([formatCellValue(data)]);
        };

        auditExportData.push(["AUDIT REPORT EXTRACTION - " + (companyName || "COMPANY").toUpperCase()]);
        auditExportData.push([]);

        const sectionsOrdered = [
            'generalInformation', 'auditorsReport', 'managersReport',
            'statementOfFinancialPosition', 'statementOfComprehensiveIncome',
            'statementOfChangesInEquity', 'statementOfCashFlows', 'otherInformation'
        ];

        sectionsOrdered.forEach(sectionKey => {
            const content = extractedDetails[sectionKey];
            if (content && Object.keys(content).length > 0) {
                auditExportData.push([auditSectionTitles[sectionKey] || sectionKey.toUpperCase()]);
                auditExportData.push([]);
                pushAuditDataRecursively(content, auditExportData);
                auditExportData.push([]);
                auditExportData.push([]);
            }
        });

        const auditWs = XLSX.utils.aoa_to_sheet(auditExportData);
        auditWs['!cols'] = [{ wch: 45 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
        const auditRange = XLSX.utils.decode_range(auditWs['!ref'] || "A1");
        for (let R = auditRange.s.r; R <= auditRange.e.r; ++R) {
            for (let C = 1; C <= auditRange.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                const cell = auditWs[cellRef];
                if (cell && cell.t === 'n') cell.z = '#,##0.00';
            }
        }
        XLSX.utils.book_append_sheet(workbook, auditWs, "Audit Extraction");

        // 2. VAT Summarization Sheet
        const vatSummaryRows = buildVatSummaryRows("VAT SUMMARIZATION DETAILS");
        const vatWs = XLSX.utils.aoa_to_sheet(vatSummaryRows);
        vatWs['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
        ];
        applySheetStyling(vatWs, 3);
        XLSX.utils.book_append_sheet(workbook, vatWs, "VAT Summarization");

        // 3. Profit & Loss
        const pnlData = pnlStructure
            .filter(item => item.type === 'item' || item.type === 'total')
            .map(item => {
                const currentAed = pnlValues[item.id]?.currentYear || 0;
                const previousAed = pnlValues[item.id]?.previousYear || 0;
                return includeOriginalEquivalent
                    ? {
                        "Item": item.label,
                        "Current Year (AED)": currentAed,
                        "Previous Year (AED)": previousAed,
                        [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                        [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                    }
                    : {
                        "Item": item.label,
                        "Current Year (AED)": currentAed,
                        "Previous Year (AED)": previousAed
                    };
            });
        const pnlWs = XLSX.utils.json_to_sheet(pnlData);
        pnlWs['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(pnlWs, 1);
        XLSX.utils.book_append_sheet(workbook, pnlWs, "Profit & Loss");

        const pnlNotesItems: any[] = [];
        Object.entries(pnlWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = pnlStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    const currentAed = n.currentYearAmount ?? n.amount ?? 0;
                    const previousAed = n.previousYearAmount ?? 0;
                    pnlNotesItems.push(
                        includeOriginalEquivalent
                            ? {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed,
                                [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                                [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                            }
                            : {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed
                            }
                    );
                });
            }
        });
        if (pnlNotesItems.length > 0) {
            const pnlNotesWs = XLSX.utils.json_to_sheet(pnlNotesItems);
            pnlNotesWs['!cols'] = includeOriginalEquivalent
                ? [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
                : [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(pnlNotesWs, 1);
            XLSX.utils.book_append_sheet(workbook, pnlNotesWs, "PNL - Working Notes");
        }

        // 4. Balance Sheet
        const bsData = bsStructure
            .filter(item => item.type === 'item' || item.type === 'total' || item.type === 'grand_total')
            .map(item => {
                const currentAed = balanceSheetValues[item.id]?.currentYear || 0;
                const previousAed = balanceSheetValues[item.id]?.previousYear || 0;
                return includeOriginalEquivalent
                    ? {
                        "Item": item.label,
                        "Current Year (AED)": currentAed,
                        "Previous Year (AED)": previousAed,
                        [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                        [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                    }
                    : {
                        "Item": item.label,
                        "Current Year (AED)": currentAed,
                        "Previous Year (AED)": previousAed
                    };
            });
        const bsWs = XLSX.utils.json_to_sheet(bsData);
        bsWs['!cols'] = includeOriginalEquivalent
            ? [{ wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
            : [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(bsWs, 1);
        XLSX.utils.book_append_sheet(workbook, bsWs, "Balance Sheet");

        const bsNotesItems: any[] = [];
        Object.entries(bsWorkingNotes).forEach(([id, notes]) => {
            const typedNotes = notes as WorkingNoteEntry[];
            if (typedNotes && typedNotes.length > 0) {
                const itemLabel = bsStructure.find(s => s.id === id)?.label || id;
                typedNotes.forEach(n => {
                    const currentAed = n.currentYearAmount ?? n.amount ?? 0;
                    const previousAed = n.previousYearAmount ?? 0;
                    bsNotesItems.push(
                        includeOriginalEquivalent
                            ? {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed,
                                [`Current Year (${pnlDisplayCurrency})`]: currentAed / pnlRateToAed,
                                [`Previous Year (${pnlDisplayCurrency})`]: previousAed / pnlRateToAed
                            }
                            : {
                                "Linked Item": itemLabel,
                                "Description": n.description,
                                "Current Year (AED)": currentAed,
                                "Previous Year (AED)": previousAed
                            }
                    );
                });
            }
        });
        if (bsNotesItems.length > 0) {
            const bsNotesWs = XLSX.utils.json_to_sheet(bsNotesItems);
            bsNotesWs['!cols'] = includeOriginalEquivalent
                ? [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }]
                : [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(bsNotesWs, 1);
            XLSX.utils.book_append_sheet(workbook, bsNotesWs, "BS - Working Notes");
        }

        // 2. LOU Reference Sheet
        const louData: any[][] = [];
        louData.push(["LOU / REFERENCE DOCUMENTS"]);
        louData.push([]);
        louData.push(["Filename", "Size", "Type"]);
        if (louFiles.length > 0) {
            louFiles.forEach(f => {
                louData.push([f.name, (f.size / 1024).toFixed(2) + " KB", f.type || "N/A"]);
            });
        } else {
            louData.push(["No documents uploaded in this step."]);
        }
        const louWs = XLSX.utils.aoa_to_sheet(louData);
        louWs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(workbook, louWs, "LOU Reference");

        // 3. Questionnaire Sheet
        const questData: any[][] = [];
        questData.push(["CORPORATE TAX QUESTIONNAIRE"]);
        questData.push([]);
        questData.push(["No.", "Question", "Answer"]);
        CT_QUESTIONS.forEach(q => {
            questData.push([q.id, q.text, questionnaireAnswers[q.id] || "N/A"]);
        });
        const questWs = XLSX.utils.aoa_to_sheet(questData);
        questWs['!cols'] = [{ wch: 5 }, { wch: 80 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(workbook, questWs, "Questionnaire");

        // 4. Final Report Sheet
        const reportData: any[][] = [];
        const safeCompanyName = (companyName || 'Company');
        reportData.push(["CORPORATE TAX RETURN - FINAL REPORT"]);
        reportData.push(["Company:", safeCompanyName.toUpperCase()]);
        reportData.push([]);

        const getReportValue = (field: string) => {
            const isSmallBusinessRelief = questionnaireAnswers[6] === 'Yes';
            const financialFields = [
                'accountingIncomeTaxPeriod', 'taxableIncomeTaxPeriod', 'corporateTaxLiability', 'corporateTaxPayable',
                'totalAssets', 'totalLiabilities', 'totalEquity', 'netProfit', 'totalCurrentAssets', 'totalNonCurrentAssets',
                'totalCurrentLiabilities', 'totalNonCurrentLiabilities', 'totalEquityLiabilities',
                'operatingRevenue', 'derivingRevenueExpenses', 'grossProfit', 'salaries', 'depreciation', 'otherExpenses',
                'nonOpExpensesExcl', 'netInterest', 'ppe', 'shareCapital', 'fines', 'donations', 'entertainment',
                'dividendsReceived', 'otherNonOpRevenue', 'interestIncome', 'interestExpense',
                'gainAssetDisposal', 'lossAssetDisposal', 'netGainsAsset', 'forexGain', 'forexLoss', 'netForex',
                'ociIncomeNoRec', 'ociLossNoRec', 'ociIncomeRec', 'ociLossRec', 'ociOtherIncome', 'ociOtherLoss',
                'totalComprehensiveIncome', 'intangibleAssets', 'financialAssets', 'otherNonCurrentAssets',
                'retainedEarnings', 'otherEquity', 'avgEmployees', 'ebitda',
                'shareProfitsEquity', 'accountingNetProfitsUninc', 'gainsDisposalUninc', 'gainsLossesReportedFS',
                'realisationBasisAdj', 'transitionalAdj', 'dividendsResident', 'incomeParticipatingInterests',
                'taxableIncomeForeignPE', 'incomeIntlAircraftShipping', 'adjQualifyingGroup', 'adjBusinessRestructuring',
                'adjNonDeductibleExp', 'adjInterestExp', 'adjRelatedParties', 'adjQualifyingInvestmentFunds',
                'otherAdjustmentsTax', 'taxableIncomeBeforeAdj', 'taxLossesUtilised', 'taxLossesClaimed',
                'preGroupingLosses', 'taxCredits'
            ];
            if (isSmallBusinessRelief && financialFields.includes(field)) return 0;
            return reportForm[field];
        };

        REPORT_STRUCTURE.forEach(section => {
            reportData.push([section.title.toUpperCase()]);
            section.fields.forEach(field => {
                if (field.type === 'header') {
                    reportData.push([field.label.replace(/---/g, '').trim()]);
                } else {
                    let value = getReportValue(field.field);
                    if (value === undefined || value === null || value === '') {
                        value = '';
                    } else if (field.type === 'number') {
                        if (typeof value !== 'number') value = parseFloat(value) || 0;
                    }
                    reportData.push([field.label, value]);
                }
            });
            reportData.push([]);
        });
        const reportWs = XLSX.utils.aoa_to_sheet(reportData);
        reportWs['!cols'] = [{ wch: 60 }, { wch: 25 }];
        const reportRange = XLSX.utils.decode_range(reportWs['!ref'] || "A1");
        for (let R = reportRange.s.r; R <= reportRange.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
            const cell = reportWs[cellRef];
            if (cell && cell.t === 'n') cell.z = '#,##0.00';
        }
        XLSX.utils.book_append_sheet(workbook, reportWs, "Final Report");

        XLSX.writeFile(workbook, `${companyName || 'Company'}_Full_Filing_Report.xlsx`);
    };

    const handleExportExtractedData = () => {
        const workbook = XLSX.utils.book_new();
        const exportData: any[][] = [];

        // Formatting helpers
        const formatKeyStr = (key: string) => {
            return key
                .replace(/([A-Z])/g, ' $1') // Split camelCase
                .replace(/_/g, ' ')        // Split snake_case
                .trim()
                .replace(/\b\w/g, c => c.toUpperCase());
        };

        const formatCellValue = (val: any): any => {
            if (val === null || val === undefined) return "";
            if (typeof val === 'number') return val;
            if (Array.isArray(val)) {
                if (val.length === 0) return "";
                return val.map(item => formatCellValue(item)).join(" | ");
            }
            if (typeof val === 'object') {
                return Object.entries(val)
                    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${formatCellValue(v)}`)
                    .join(", ");
            }
            return String(val);
        };

        const sectionTitles: Record<string, string> = {
            generalInformation: "GENERAL INFORMATION",
            auditorsReport: "AUDITOR'S REPORT",
            managersReport: "MANAGER'S REPORT",
            statementOfFinancialPosition: "STATEMENT OF FINANCIAL POSITION",
            statementOfComprehensiveIncome: "STATEMENT OF COMPREHENSIVE INCOME",
            statementOfChangesInEquity: "STATEMENT OF CHANGES IN SHAREHOLDERS' EQUITY",
            statementOfCashFlows: "STATEMENT OF CASH FLOWS"
        };

        const pushDataRecursively = (data: any, depth = 0) => {
            if (data === null || data === undefined) return;

            if (Array.isArray(data)) {
                if (data.length === 0) return;

                // If it's a table (array of objects)
                if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
                    const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
                    // Add header row
                    exportData.push(["".padStart(depth * 4), ...keys.map(k => formatKeyStr(k))]);
                    // Add data rows
                    data.forEach(item => {
                        exportData.push(["".padStart(depth * 4), ...keys.map(k => formatCellValue(item[k]))]);
                    });
                } else {
                    // Simple array
                    data.forEach(item => {
                        if (typeof item === 'object') {
                            pushDataRecursively(item, depth + 1);
                        } else {
                            exportData.push(["".padStart(depth * 4) + "- " + String(item)]);
                        }
                    });
                }
                return;
            }

            if (typeof data === 'object') {
                Object.entries(data).forEach(([key, value]) => {
                    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        exportData.push([formatKeyStr(key).toUpperCase()]);
                        pushDataRecursively(value, depth + 1);
                    } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                        // For arrays of objects (tables), keep the key as a header
                        exportData.push([formatKeyStr(key).toUpperCase()]);
                        pushDataRecursively(value, depth + 1);
                    } else {
                        exportData.push([formatKeyStr(key), formatCellValue(value)]);
                    }
                });
                return;
            }

            exportData.push([formatCellValue(data)]);
        };

        // Title Row
        exportData.push(["AUDIT REPORT EXTRACTION - " + (companyName || "COMPANY").toUpperCase()]);
        exportData.push([]);

        // Sections
        const sectionsOrdered = [
            'generalInformation', 'auditorsReport', 'managersReport',
            'statementOfFinancialPosition', 'statementOfComprehensiveIncome',
            'statementOfChangesInEquity', 'statementOfCashFlows'
        ];

        sectionsOrdered.forEach(sectionKey => {
            const content = extractedDetails[sectionKey];
            if (content && Object.keys(content).length > 0) {
                exportData.push([sectionTitles[sectionKey] || sectionKey.toUpperCase()]);
                exportData.push([]);
                pushDataRecursively(content);
                exportData.push([]);
                exportData.push([]); // Gap between sections
            }
        });

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);

        // Col widths
        worksheet['!cols'] = [{ wch: 45 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];

        // Number formatting for the second column (and beyond for tables)
        const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = 1; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                const cell = worksheet[cellRef];
                if (cell && cell.t === 'n') {
                    cell.z = '#,##0.00';
                }
            }
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, "Extraction Results");

        // Add VAT Summarization Sheet (Type 3 parity)
        const vatExportData = buildVatSummaryRows("VAT SUMMARIZATION DETAILS");
        const vatWorksheet = XLSX.utils.aoa_to_sheet(vatExportData);
        vatWorksheet['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
        ];
        applySheetStyling(vatWorksheet, 3);
        XLSX.utils.book_append_sheet(workbook, vatWorksheet, "VAT Summarization");

        XLSX.writeFile(workbook, `${companyName || 'Company'}_Audit_Extraction.xlsx`);
    };

    const handleExportQuestionnaire = () => {
        const data = CT_QUESTIONS.map(q => ({ "No.": q.id, "Question": q.text, "Answer": questionnaireAnswers[q.id] || "N/A" }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CT Questionnaire");
        XLSX.writeFile(wb, `${companyName}_CT_Questionnaire.xlsx`);
    };

    const iconMap: Record<string, any> = {
        InformationCircleIcon, IdentificationIcon, BuildingOfficeIcon, IncomeIcon, AssetIcon, ListBulletIcon, ChartBarIcon, ClipboardCheckIcon
    };

    const renderStepVatDocsUpload = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-border bg-muted/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/5">
                            <DocumentTextIcon className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-foreground tracking-tight">VAT Docs Upload</h3>
                            <p className="text-muted-foreground mt-1 max-w-2xl">Upload relevant VAT certificates (VAT 201)</p>
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
                    onClick={async () => { await handleSaveStep(2); setCurrentStep(1); }}
                    className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExtractAdditionalData}
                        disabled={additionalFiles.length === 0 || isExtractingVat}
                        className="flex items-center px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-xl shadow-primary/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExtractingVat ? (
                            <>
                                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-3"></div>
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

    const renderStepProfitAndLoss = () => (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <ProfitAndLossStep
                onNext={async () => { await handleSaveStep(4); setCurrentStep(5); }}
                onBack={async () => { await handleSaveStep(4); setCurrentStep(3); }}
                data={pnlValues}
                structure={pnlStructure}
                onChange={handlePnlChange}
                onExport={handleExportStepPnl}
                onAddAccount={handleAddPnlAccount}
                workingNotes={pnlWorkingNotes}
                onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
                displayCurrency="AED"
                secondaryCurrency={showOriginalEquivalent ? pnlDisplayCurrency : undefined}
                exchangeRateToDisplay={pnlRateToAed}
                showSecondaryConverted={showOriginalEquivalent}
            />
        </div>
    );

    const handleContinueFromBalanceSheet = async () => {
        await handleSaveStep(5);
        const revenue =
            Number(questionnaireAnswers['curr_revenue']) ||
            pnlValues.revenue?.currentYear ||
            Number(reportForm.actualOperatingRevenue) ||
            Number(reportForm.operatingRevenue) ||
            ftaFormValues?.actualOperatingRevenue ||
            0;
        if (revenue < 3000000 && revenue > 0) {
            setShowSbrModal(true);
        } else {
            setCurrentStep(6);
        }
    };

    const renderStepBalanceSheet = () => (
        <BalanceSheetStep
            onNext={handleContinueFromBalanceSheet}
                onBack={async () => { await handleSaveStep(5, 'draft'); setCurrentStep(4); }}
            data={balanceSheetValues}
            structure={bsStructure}
            onChange={handleBalanceSheetChange}
            onExport={handleExportStepBS}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
            onDownloadPDF={handleDownloadFinancialStatementsPDF}
            displayCurrency="AED"
            secondaryCurrency={showOriginalEquivalent ? pnlDisplayCurrency : undefined}
            exchangeRateToDisplay={pnlRateToAed}
            showSecondaryConverted={showOriginalEquivalent}
        />
    );

    const handleExportTaxComputation = () => {
        const wb = XLSX.utils.book_new();
        const includeOriginalEquivalent = showOriginalEquivalent && !!pnlDisplayCurrency && pnlRateToAed > 0;
        const sheetData: (string | number)[][] = [
            ["Tax Computation Summary"],
            includeOriginalEquivalent ? ["Field", "Value (AED)", `Value (${pnlDisplayCurrency})`] : ["Field", "Value (AED)"],
        ];

        if (includeOriginalEquivalent) {
            sheetData.splice(1, 0, [`Converted to AED using rate: 1 ${pnlDisplayCurrency} = ${pnlRateToAed.toFixed(6)} AED`]);
        }

        if (ftaFormValues) {
            const taxSummary = REPORT_STRUCTURE.find(s => s.id === 'tax-summary');
            const profit = ftaFormValues.netProfit || 0;
            const isSbrClaimed = questionnaireAnswers[6] === 'Yes';
            const getDefaultValue = (field: string) => {
                if (field === 'accountingIncomeTaxPeriod' || field === 'taxableIncomeBeforeAdj' || field === 'taxableIncomeTaxPeriod') {
                    return profit;
                }
                if (field === 'corporateTaxLiability' || field === 'corporateTaxPayable') {
                    return (!isSbrClaimed && profit > 375000) ? (profit - 375000) * 0.09 : 0;
                }
                return Number(reportForm[field]) || 0;
            };

            taxSummary?.fields.forEach((f: any) => {
                if (f.type === 'header') return;
                const aedVal = taxComputationEdits[f.field] ?? getDefaultValue(f.field);
                sheetData.push(
                    includeOriginalEquivalent
                        ? [f.label, aedVal, aedVal / pnlRateToAed]
                        : [f.label, aedVal]
                );
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = includeOriginalEquivalent ? [{ wch: 40 }, { wch: 20 }, { wch: 20 }] : [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "Tax Computation");
        XLSX.writeFile(wb, `CT_Tax_Computation_${company?.name || 'Draft'}.xlsx`);
    };

    const renderStep6TaxComputation = () => {
        if (!ftaFormValues) return null;
        const taxSummary = REPORT_STRUCTURE.find(s => s.id === 'tax-summary');
        if (!taxSummary) return null;

        const profit = ftaFormValues.netProfit || 0;
        const isSbrClaimed = questionnaireAnswers[6] === 'Yes';

        const getDefaultValue = (field: string) => {
            if (field === 'accountingIncomeTaxPeriod' || field === 'taxableIncomeBeforeAdj' || field === 'taxableIncomeTaxPeriod') {
                return profit;
            }
            if (field === 'corporateTaxLiability' || field === 'corporateTaxPayable') {
                return (!isSbrClaimed && profit > 375000) ? (profit - 375000) * 0.09 : 0;
            }
            return Number(reportForm[field]) || 0;
        };

        const handleConfirmTaxComputation = async () => {
            const mergedTaxData = taxSummary.fields
                .filter((f: any) => f.type !== 'header')
                .reduce((acc: Record<string, number>, f: any) => {
                    acc[f.field] = taxComputationEdits[f.field] ?? getDefaultValue(f.field);
                    return acc;
                }, {});

            setReportForm((prev: any) => ({ ...prev, ...mergedTaxData }));
            setTaxComputationEdits(prev => ({ ...prev, ...mergedTaxData }));
            await handleSaveStep(6, 'completed', { taxComputation: mergedTaxData });
            setCurrentStep(7);
        };

        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden ring-1 ring-border">
                    <div className="p-8 border-b border-border flex justify-between items-center bg-background">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-primary/20/30 rounded-2xl flex items-center justify-center border border-blue-800">
                                <ChartBarIcon className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">Tax Computation</h3>
                                <p className="text-sm text-muted-foreground mt-1">Review and edit the tax calculation for this period.</p>
                            </div>
                        </div>
                        {isSbrClaimed && (
                            <div className="px-4 py-2 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center gap-2">
                                <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                <span className="text-xs font-bold text-green-400 uppercase tracking-tighter">Small Business Relief Claimed</span>
                            </div>
                        )}
                    </div>

                    <div className="p-8 space-y-4 bg-background/30 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 gap-4">
                            {taxSummary.fields.map((f: any) => {
                                if (f.type === 'header') {
                                    return (
                                        <div key={f.field} className="col-span-full pt-4 border-b border-border/50 pb-2">
                                            <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">{f.label.replace(/-/g, '').trim()}</h4>
                                        </div>
                                    );
                                }

                                const currentValue = taxComputationEdits[f.field] ?? getDefaultValue(f.field);
                                return (
                                    <div key={f.field} className={`flex justify-between items-center p-4 bg-muted/20 rounded-xl border border-border/50 ${f.highlight ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : ''}`}>
                                        <span className={`text-xs font-bold text-muted-foreground uppercase tracking-tight ${f.highlight ? 'text-primary' : ''}`}>{f.label}</span>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={currentValue}
                                                    onChange={(e) => setTaxComputationEdits(prev => ({ ...prev, [f.field]: parseFloat(e.target.value) || 0 }))}
                                                    className={`font-mono font-bold text-base text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-all w-48 ${f.highlight ? 'text-primary' : 'text-foreground'}`}
                                                />
                                                <span className="text-[10px] opacity-60 ml-0.5">AED</span>
                                            </div>
                                            {showOriginalEquivalent && (
                                                <div className="text-[10px] text-muted-foreground text-right mt-1">
                                                    ({formatOriginalEquivalentFromAed(currentValue)})
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-8 bg-background border-t border-border flex justify-between items-center">
                        <button
                            onClick={async () => { await handleSaveStep(6, 'draft'); setCurrentStep(5); }}
                            className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                        >
                            <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
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
                                onClick={handleConfirmTaxComputation}
                                className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl shadow-primary/20 flex items-center transition-all transform hover:scale-[1.02]"
                            >
                                Confirm & Proceed to LOU
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSbrModal = () => {
        if (!showSbrModal) return null;
        const sbrRevenue =
            Number(questionnaireAnswers['curr_revenue']) ||
            pnlValues.revenue?.currentYear ||
            Number(reportForm.actualOperatingRevenue) ||
            Number(reportForm.operatingRevenue) ||
            ftaFormValues?.actualOperatingRevenue ||
            0;

        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-card rounded-[2.5rem] border border-border shadow-2xl w-full max-w-xl overflow-hidden ring-1 ring-border/50 animate-in zoom-in-95 duration-500">
                    <div className="p-10 text-center space-y-8 relative">
                        <div className="mx-auto w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/20 shadow-inner group transition-transform duration-500 hover:scale-110">
                            <SparklesIcon className="w-12 h-12 text-primary animate-pulse" />
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-3xl font-black text-foreground uppercase tracking-tighter">Small Business Relief</h3>
                            <p className="text-muted-foreground font-medium leading-relaxed max-w-md mx-auto">
                                Based on your revenue of <span className="text-primary font-bold">{currency} {formatNumber(sbrRevenue)}</span>, you are eligible for Small Business Relief.
                            </p>
                        </div>

                        <div className="bg-muted/30 rounded-2xl p-6 border border-border/50 backdrop-blur-sm shadow-inner">
                            <p className="text-xs text-muted-foreground leading-relaxed italic">
                                SBR allows eligible taxable persons to be treated as having no taxable income for a relevant tax period. This will be reflected in your final tax computation.
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                onClick={() => {
                                    setShowSbrModal(false);
                                    setCurrentStep(6);
                                }}
                                className="flex-1 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0"
                            >
                                Continue with Relief
                            </button>
                            <button
                                onClick={() => {
                                    setShowSbrModal(false);
                                    setCurrentStep(6);
                                }}
                                className="flex-1 px-8 py-4 bg-muted hover:bg-muted/80 text-foreground font-black uppercase text-xs tracking-[0.2em] rounded-2xl transition-all border border-border"
                            >
                                Standard Calculation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderStepFinalReport = () => {
        const isSmallBusinessRelief = questionnaireAnswers[6] === 'Yes';
        return (
            <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden ring-1 ring-border">
                    <div className="p-8 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center bg-muted/50 gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
                                <SparklesIcon className="w-10 h-10 text-primary-foreground" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-foreground uppercase tracking-tighter">Corporate Tax Return</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">{reportForm.taxableNameEn}</p>
                                    <span className="h-1 w-1 bg-border rounded-full"></span>
                                    <p className="text-xs text-primary font-mono">DRAFT READY</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 w-full sm:w-auto">
                            <button onClick={async () => { await handleSaveStep(10, 'draft'); setCurrentStep(9); }} className="flex-1 sm:flex-none px-6 py-2.5 border border-border text-muted-foreground hover:text-foreground rounded-xl font-bold text-xs uppercase transition-all hover:bg-muted">Back</button>
                            <button
                                onClick={handleDownloadPDF}
                                disabled={isDownloadingPdf}
                                className="flex-1 sm:flex-none px-8 py-2.5 border border-border text-foreground font-black uppercase text-xs rounded-xl transition-all hover:bg-muted/70 disabled:opacity-50"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                            </button>
                            <button onClick={handleExportExcel} className="flex-1 sm:flex-none px-8 py-2.5 bg-foreground text-background font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-foreground/90 transform hover:scale-[1.03]">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" /> Export
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-border">
                        {REPORT_STRUCTURE.map(section => {
                            const Icon = iconMap[section.iconName] || InformationCircleIcon;
                            return (
                                <div key={section.id} className="group">
                                    <button onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)} className={`w-full flex items-center justify-between p-6 transition-all ${openReportSection === section.title ? 'bg-accent/40' : 'hover:bg-accent/20'}`}>
                                        <div className="flex items-center gap-5">
                                            <div className={`p-2.5 rounded-xl border transition-all ${openReportSection === section.title ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted border-border text-muted-foreground group-hover:border-border group-hover:text-muted-foreground/80'}`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className={`font-black uppercase tracking-widest text-xs ${openReportSection === section.title ? 'text-foreground' : 'text-muted-foreground'}`}>{section.title}</span>
                                        </div>
                                        <ChevronDownIcon className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${openReportSection === section.title ? 'rotate-180 text-foreground' : ''}`} />
                                    </button>
                                    {openReportSection === section.title && (
                                        <div className="p-8 bg-muted/40 border-t border-border/50 animate-in slide-in-from-top-1 duration-300">
                                            <div className="flex flex-col gap-y-4 bg-card/50 border border-border rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                                {section.fields.map(f => {
                                                    if (f.type === 'header') return <div key={f.field} className="pt-8 pb-3 border-b border-border/80 mb-4 first:pt-0"><h4 className="text-sm font-black text-primary uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4></div>;

                                                    let value = reportForm[f.field];
                                                    // Zero out financials if SBR
                                                    const financialFields = [
                                                        'accountingIncomeTaxPeriod', 'taxableIncomeTaxPeriod', 'corporateTaxLiability', 'corporateTaxPayable',
                                                        'totalAssets', 'totalLiabilities', 'totalEquity', 'netProfit', 'totalCurrentAssets', 'totalNonCurrentAssets',
                                                        'totalCurrentLiabilities', 'totalNonCurrentLiabilities', 'totalEquityLiabilities',
                                                        'operatingRevenue', 'derivingRevenueExpenses', 'grossProfit', 'salaries', 'depreciation', 'otherExpenses',
                                                        'nonOpExpensesExcl', 'netInterest', 'ppe', 'shareCapital', 'fines', 'donations', 'entertainment',
                                                        'dividendsReceived', 'otherNonOpRevenue', 'interestIncome', 'interestExpense',
                                                        'gainAssetDisposal', 'lossAssetDisposal', 'netGainsAsset', 'forexGain', 'forexLoss', 'netForex',
                                                        'ociIncomeNoRec', 'ociLossNoRec', 'ociIncomeRec', 'ociLossRec', 'ociOtherIncome', 'ociOtherLoss',
                                                        'totalComprehensiveIncome', 'intangibleAssets', 'financialAssets', 'otherNonCurrentAssets',
                                                        'retainedEarnings', 'otherEquity', 'avgEmployees', 'ebitda',
                                                        'shareProfitsEquity', 'accountingNetProfitsUninc', 'gainsDisposalUninc', 'gainsLossesReportedFS',
                                                        'realisationBasisAdj', 'transitionalAdj', 'dividendsResident', 'incomeParticipatingInterests',
                                                        'taxableIncomeForeignPE', 'incomeIntlAircraftShipping', 'adjQualifyingGroup', 'adjBusinessRestructuring',
                                                        'adjNonDeductibleExp', 'adjInterestExp', 'adjRelatedParties', 'adjQualifyingInvestmentFunds',
                                                        'otherAdjustmentsTax', 'taxableIncomeBeforeAdj', 'taxLossesUtilised', 'taxLossesClaimed',
                                                        'preGroupingLosses', 'taxCredits'
                                                    ];
                                                    if (isSmallBusinessRelief && financialFields.includes(f.field)) value = 0;

                                                    return (
                                                        <div key={f.field} className="flex flex-col py-4 border-b border-border/30 last:border-0 group/field">
                                                            <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-primary' : 'text-muted-foreground group-hover/field:text-muted-foreground/80'}`}>{f.label}</label>
                                                            <div className="bg-muted/40 rounded-lg p-1 border border-transparent group-hover/field:border-border/50 transition-all">
                                                                {f.type === 'number' ? (
                                                                    <div className="px-2 py-1">
                                                                        <div className="flex items-center justify-end gap-2">
                                                                            <input type="text" value={formatNumber(value || 0)} readOnly className={`bg-transparent border-none text-right font-mono text-sm font-bold text-foreground focus:ring-0 w-full ${f.highlight ? 'text-primary/80' : ''}`} />
                                                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">AED</span>
                                                                        </div>
                                                                        {showOriginalEquivalent && (
                                                                            <div className="text-[10px] text-muted-foreground text-right mt-1">
                                                                                ({formatOriginalEquivalentFromAed(Number(value) || 0)})
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <input type="text" value={value || ''} readOnly className={`bg-transparent border-none text-right font-medium text-sm text-muted-foreground focus:ring-0 w-full ${f.highlight ? 'text-primary/80' : ''}`} />
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderStepVatSummarization = () => {
        const { periods, grandTotals } = vatStepData;

        const renderEditableCell = (periodId: string, field: string, value: number) => {
            const displayValue = vatManualAdjustments[periodId]?.[field] ?? (value === 0 ? '' : value.toString());
            return (
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => handleVatAdjustmentChange(periodId, field, e.target.value)}
                    className="w-full bg-transparent text-right outline-none focus:bg-accent/20 px-2 py-1 rounded transition-colors font-mono"
                    placeholder="0.00"
                />
            );
        };

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-lg backdrop-blur-xl mb-6">
                        <ClipboardCheckIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-3xl font-black text-foreground tracking-tighter uppercase">VAT Summarization</h3>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] opacity-60 mt-1">Consolidated VAT 201 Report (Editable)</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-border bg-primary/10 flex justify-between items-center">
                            <h4 className="text-sm font-black text-primary uppercase tracking-[0.2em]">Sales (Outputs) - As per FTA</h4>
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
                                        <th className="py-4 px-4 text-right bg-primary/5 text-primary/80">Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody className="text-muted-foreground text-xs font-mono">
                                    {periods.map((p: any) => {
                                        const data = p.sales;
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

                                        return (
                                            <tr key={p.id} className="border-b border-border/40 hover:bg-accent/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-foreground text-[10px] tracking-tight">{dateRange}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'salesZero', data.zero)}</td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'salesTv', data.tv)}</td>
                                                <td className="py-4 px-4 text-right text-primary">{renderEditableCell(p.id, 'salesVat', data.vat)}</td>
                                                <td className="py-4 px-4 text-right font-black bg-primary/5 text-primary/80">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-primary/20 font-bold border-t-2 border-border">
                                        <td className="py-5 px-4 text-left font-black text-primary text-[10px] uppercase italic">Sales Total</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.sales.zero)}</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.sales.tv)}</td>
                                        <td className="py-5 px-4 text-right text-primary">{formatDecimalNumber(grandTotals.sales.vat)}</td>
                                        <td className="py-5 px-4 text-right text-foreground text-base tracking-tighter">{formatDecimalNumber(grandTotals.sales.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-card rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-border bg-emerald-500/10 flex justify-between items-center">
                            <h4 className="text-sm font-black text-emerald-500 uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Figures in AED</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-center">
                                <thead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
                                    <tr>
                                        <th className="py-4 px-4 text-left">Period</th>
                                        <th className="py-4 px-4 text-right">Zero Rated</th>
                                        <th className="py-4 px-4 text-right">Standard Rated</th>
                                        <th className="py-4 px-4 text-right text-emerald-500">VAT Amount</th>
                                        <th className="py-4 px-4 text-right bg-emerald-500/5 text-emerald-400">Total Purchases</th>
                                    </tr>
                                </thead>
                                <tbody className="text-muted-foreground text-xs font-mono">
                                    {periods.map((p: any) => {
                                        const data = p.purchases;
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

                                        return (
                                            <tr key={p.id} className="border-b border-border/40 hover:bg-accent/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-foreground text-[10px] tracking-tight">{dateRange}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'purchasesZero', data.zero)}</td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'purchasesTv', data.tv)}</td>
                                                <td className="py-4 px-4 text-right text-emerald-500">{renderEditableCell(p.id, 'purchasesVat', data.vat)}</td>
                                                <td className="py-4 px-4 text-right font-black bg-emerald-500/5 text-emerald-400">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-emerald-500/20 font-bold border-t-2 border-border">
                                        <td className="py-5 px-4 text-left font-black text-emerald-500 text-[10px] uppercase italic">Purchases Total</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.purchases.zero)}</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.purchases.tv)}</td>
                                        <td className="py-5 px-4 text-right text-emerald-500">{formatDecimalNumber(grandTotals.purchases.vat)}</td>
                                        <td className="py-5 px-4 text-right text-foreground text-base tracking-tighter">{formatDecimalNumber(grandTotals.purchases.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-emerald-500/10 border border-border rounded-2xl p-8 shadow-inner">
                        <div className="flex items-center justify-between">
                            <div>
                                <h5 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Net VAT Position</h5>
                                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">Output VAT minus Input VAT</p>
                            </div>
                            <div className="text-right">
                                <span className={`text-3xl font-black ${grandTotals.net >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                                    {formatDecimalNumber(grandTotals.net)}
                                </span>
                                <span className="ml-2 text-xs text-muted-foreground font-bold uppercase tracking-widest">AED</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between pt-4">
                        <button onClick={async () => { await handleSaveStep(3); setCurrentStep(2); }} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all">
                            <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={handleExportStep4VAT}
                                className="flex items-center px-6 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl shadow-xl transition-all"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Export Summary
                            </button>
                            <button onClick={handleVatSummarizationContinue} className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">
                                Continue to Profit &amp; Loss
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const formatKey = (key: string) => {
        return key
            .replace(/([A-Z])/g, ' $1') // Split camelCase
            .replace(/_/g, ' ')        // Split snake_case
            .trim()
            .replace(/\b\w/g, c => c.toUpperCase());
    };

    const renderValue = (data: any): React.ReactNode => {
        if (data === null || data === undefined) return <span className="text-muted-foreground italic">N/A</span>;

        if (Array.isArray(data)) {
            if (data.length === 0) return <span className="text-muted-foreground italic">Empty</span>;

            // Check if it's a table-like array (array of objects)
            if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
                const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
                return (
                    <div className="overflow-x-auto rounded-lg border border-border/50 mt-2">
                        <table className="w-full text-[10px] text-left border-collapse">
                            <thead>
                                <tr className="bg-muted border-b border-border">
                                    {keys.map(key => (
                                        <th key={key} className="py-2.5 px-3 text-muted-foreground font-bold uppercase tracking-tighter whitespace-nowrap">{formatKey(key)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((row: any, idx: number) => (
                                    <tr key={idx} className="border-b border-border/30 last:border-0 hover:bg-accent/5 transition-colors">
                                        {keys.map(key => (
                                            <td key={key} className="py-2.5 px-3 text-foreground">
                                                {renderValue(row[key])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            }

            // Simple array
            return (
                <ul className="list-disc list-inside space-y-1 mt-1">
                    {data.map((item, idx) => (
                        <li key={idx} className="text-foreground text-[11px] leading-relaxed">
                            {typeof item === 'object' ? renderValue(item) : String(item)}
                        </li>
                    ))}
                </ul>
            );
        }

        if (typeof data === 'object') {
            return (
                <div className="space-y-3 mt-2 pl-4 border-l-2 border-primary/20 bg-primary/[0.02] py-2 rounded-r-lg">
                    {Object.entries(data).map(([subK, subV]) => (
                        <div key={subK} className="flex flex-col gap-1">
                            <span className="text-[9px] text-primary/60 font-black uppercase tracking-widest">{subK.replace(/_/g, ' ')}</span>
                            <div className="text-xs">{renderValue(subV)}</div>
                        </div>
                    ))}
                </div>
            );
        }

        if (typeof data === 'number') return <span className="text-foreground font-mono font-bold tracking-tight">{formatNumber(data)}</span>;

        return <span className="text-foreground text-xs font-medium leading-relaxed">{String(data)}</span>;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center border border-border shadow-inner group transition-transform hover:scale-105">
                        <ShieldCheckIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase">{companyName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-primary/80"><BriefcaseIcon className="w-3.5 h-3.5" /> TYPE 4 WORKFLOW (AUDIT REPORT)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={handleExportAll}
                        disabled={currentStep !== 10}
                        className={`flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg border border-primary/50 transition-all ${currentStep !== 10 ? 'opacity-50 cursor-not-allowed grayscale' : 'transform hover:scale-105'}`}
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All Data
                    </button>
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-black text-[10px] uppercase tracking-widest rounded-xl border border-border"><RefreshIcon className="w-4 h-4 mr-2" /> Start Over</button>
                </div>
            </div>

            <Stepper currentStep={currentStep} />

            {/* Step 1: Upload & Extract */}
            {currentStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header Card: Upload & Configuration */}
                    <div className="bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-border bg-muted/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-primary/30">
                                    <DocumentDuplicateIcon className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight">Audit Report Upload & Extraction</h3>
                                    <p className="text-muted-foreground mt-1 max-w-2xl">Upload reports and extracting financial data.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleExtractData}
                                disabled={auditFiles.length === 0 || isExtracting || !selectedDocCategory}
                                className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase text-xs tracking-widest rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                {isExtracting ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                {isExtracting ? 'Extracting...' : 'Extract Data'}
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Document Category Selection */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <BriefcaseIcon className="w-5 h-5 text-primary" />
                                    <h4 className="font-bold text-foreground uppercase text-xs tracking-widest">Document Category <span className="text-destructive">*</span></h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className={`flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all group ${selectedDocCategory === 'audit_report' ? 'border-primary bg-primary/10 ring-1 ring-primary/50' : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-border/80'}`}>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedDocCategory === 'audit_report' ? 'border-primary' : 'border-muted-foreground'}`}>
                                            {selectedDocCategory === 'audit_report' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                        </div>
                                        <input type="radio" name="docCategory" value="audit_report" checked={selectedDocCategory === 'audit_report'} onChange={(e) => setSelectedDocCategory(e.target.value)} className="hidden" />
                                        <span className={`font-medium group-hover:text-foreground ${selectedDocCategory === 'audit_report' ? 'text-foreground' : 'text-muted-foreground'}`}>Audit report signed by auditors</span>
                                    </label>
                                    <label className={`flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all group ${selectedDocCategory === 'financial_statements' ? 'border-primary bg-primary/10 ring-1 ring-primary/50' : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-border/80'}`}>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedDocCategory === 'financial_statements' ? 'border-primary' : 'border-muted-foreground'}`}>
                                            {selectedDocCategory === 'financial_statements' && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                                        </div>
                                        <input type="radio" name="docCategory" value="financial_statements" checked={selectedDocCategory === 'financial_statements'} onChange={(e) => setSelectedDocCategory(e.target.value)} className="hidden" />
                                        <span className={`font-medium group-hover:text-foreground ${selectedDocCategory === 'financial_statements' ? 'text-foreground' : 'text-muted-foreground'}`}>Financial statements signed by board members</span>
                                    </label>
                                </div>
                            </div>

                            {/* File Upload */}
                            <div className="space-y-4">
                                <FileUploadArea title="Upload Documents to Analyze" icon={<DocumentDuplicateIcon className="w-6 h-6" />} selectedFiles={auditFiles} onFilesSelect={setAuditFiles} />
                            </div>
                        </div>
                    </div>


                    {/* Extracted Results Section (Collapsible Dropdowns) */}
                    {Object.keys(finalDisplayData).length > 0 && (
                        <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="p-8 border-b border-border flex justify-between items-center bg-muted/30">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                        <SparklesIcon className="w-7 h-7 text-primary" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-foreground uppercase text-sm tracking-widest">Extracted Information</h4>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight mt-1">Review and verify the data extracted from your reports</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={handleExportExtractedData} className="px-6 py-2.5 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-bold uppercase rounded-xl border border-border transition-all flex items-center gap-2 shadow-lg">
                                        <DocumentArrowDownIcon className="w-4 h-4" /> Export Excel
                                    </button>
                                </div>
                            </div>
                            <div className="divide-y divide-border">
                                {Object.entries(finalDisplayData).map(([k, v]) => {
                                    const sectionTitle = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                    const isOpen = openExtractedSection === k;
                                    const val = v as any;

                                    return (
                                        <div key={k} className="group">
                                            <button
                                                onClick={() => setOpenExtractedSection(isOpen ? null : k)}
                                                className={`w-full flex items-center justify-between p-6 transition-all ${isOpen ? 'bg-accent/40' : 'hover:bg-accent/20'}`}
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className={`p-2.5 rounded-xl border transition-all ${isOpen ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted border-border text-muted-foreground group-hover:border-border/80 group-hover:text-foreground'}`}>
                                                        <SparklesIcon className="w-5 h-5" />
                                                    </div>
                                                    <span className={`font-black uppercase tracking-widest text-xs ${isOpen ? 'text-foreground' : 'text-muted-foreground'}`}>{sectionTitle}</span>
                                                </div>
                                                <ChevronDownIcon className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180 text-foreground' : ''}`} />
                                            </button>

                                            {isOpen && (
                                                <div className="p-8 bg-background/40 border-t border-border/50 animate-in slide-in-from-top-1 duration-300">
                                                    <div className="flex flex-col gap-y-4 bg-card/50 border border-border rounded-xl p-8 shadow-inner max-w-4xl mx-auto overflow-x-auto">
                                                        {typeof val === 'object' && val !== null ? (
                                                            Object.entries(val).map(([nestedK, nestedV]) => {
                                                                return (
                                                                    <div key={nestedK} className="flex flex-col py-4 border-b border-border/30 last:border-0 group/field">
                                                                        <div className="flex flex-col gap-2">
                                                                            <label className="text-[11px] font-black uppercase tracking-widest text-primary group-hover/field:text-primary/80 shrink-0">
                                                                                {nestedK.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                                                                            </label>
                                                                            <div className="pl-2">
                                                                                {renderValue(nestedV)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="py-2 text-muted-foreground italic">No data available for this section.</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {Object.keys(extractedDetails).length > 0 && (
                        <div className="space-y-4 pt-4">
                            <div className="bg-card rounded-2xl border border-border shadow-xl p-5">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                    <div>
                                        <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Foreign Currency Exchange Rate</h4>
                                        <p className="text-xs text-muted-foreground mt-1">Set the exchange rate to translate all items in foreign currency to AED.</p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[220px_220px_220px] gap-3 w-full lg:w-auto">
                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Currency</label>
                                            <select
                                                value={pnlCurrencyConfig.selectedCurrency}
                                                onChange={(e) => setPnlCurrencyConfig(prev => ({ ...prev, selectedCurrency: e.target.value.toUpperCase() }))}
                                                className="w-full h-10 px-3 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                            >
                                                {TYPE4_PNL_CURRENCY_OPTIONS.map(code => (
                                                    <option key={code} value={code}>{code}</option>
                                                ))}
                                                <option value="CUSTOM">Custom</option>
                                            </select>
                                        </div>

                                        {pnlCurrencyConfig.selectedCurrency === 'CUSTOM' && (
                                            <div>
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Custom Code</label>
                                                <input
                                                    type="text"
                                                    maxLength={10}
                                                    value={pnlCurrencyConfig.customCurrency}
                                                    onChange={(e) => setPnlCurrencyConfig(prev => ({ ...prev, customCurrency: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') }))}
                                                    className="w-full h-10 px-3 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                                    placeholder="e.g. SGD"
                                                />
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Exchange Rate to AED</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.000001"
                                                    value={pnlCurrencyConfig.exchangeRateToAed || ''}
                                                    onChange={(e) => {
                                                        const next = parseFloat(e.target.value);
                                                        setPnlCurrencyConfig(prev => ({ ...prev, exchangeRateToAed: Number.isFinite(next) ? next : 0 }));
                                                    }}
                                                    onBlur={() => {
                                                        setPnlCurrencyConfig(prev => ({
                                                            ...prev,
                                                            exchangeRateToAed: prev.exchangeRateToAed > 0 ? Number(prev.exchangeRateToAed.toFixed(6)) : 1
                                                        }));
                                                    }}
                                                    className="w-full h-10 pl-3 pr-16 bg-background border border-border rounded-xl text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                                                    placeholder="1.000000"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">AED</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                    <span className="px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20">
                                        1 {pnlDisplayCurrency} = {(pnlCurrencyConfig.exchangeRateToAed || 1).toFixed(6)} AED
                                    </span>
                                    <span className="text-muted-foreground">
                                        This will be used as currency reference for the Financial statements.
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center">
                                <button onClick={onReset} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Change Type</button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await handleSaveStep(1);
                                        } catch (err) {
                                            console.error("Failed to save step 1 from bottom button:", err);
                                        }
                                        setShowVatConfirm(true);
                                    }}
                                    className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    )}
                    {showVatConfirm && (
                        <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
                                <div className="p-6 border-b border-border">
                                    <h3 className="text-lg font-bold text-foreground">Upload VAT Docs?</h3>
                                    <p className="text-sm text-muted-foreground mt-2">Do you want to upload VAT documents now?</p>
                                </div>
                                <div className="p-6 flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowVatConfirm(false)}
                                        className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setShowVatConfirm(false);
                                            await handleSaveStep(1);
                                            setCurrentStep(4);
                                        }}
                                        className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm"
                                    >
                                        No, Skip
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setShowVatConfirm(false);
                                            await handleSaveStep(1);
                                            setCurrentStep(2);
                                        }}
                                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm"
                                    >
                                        Yes, Upload
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: VAT Docs Upload */}
            {currentStep === 2 && renderStepVatDocsUpload()}

            {/* Step 3: VAT Summarization */}
            {currentStep === 3 && renderStepVatSummarization()}

            {/* Step 4: Profit & Loss */}
            {currentStep === 4 && renderStepProfitAndLoss()}

            {/* Step 5: Balance Sheet */}
            {currentStep === 5 && renderStepBalanceSheet()}

            {/* Step 6: Tax Computation */}
            {currentStep === 6 && renderStep6TaxComputation()}

            {/* Step 7: LOU Review */}
            {currentStep === 7 && (
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
                                    <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">For and on behalf of</span>
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
                            <button
                                onClick={async () => {
                                    await handleSaveStep(7, 'draft');
                                    setCurrentStep(6);
                                }}
                                className="flex items-center px-6 py-3 text-muted-foreground hover:text-foreground font-bold transition-all"
                            >
                                <ChevronLeftIcon className="w-5 h-5 mr-2" />
                                Back to Computation
                            </button>
                            <div className="flex gap-4">
                                <button
                                    onClick={async () => {
                                        await handleSaveStep(7);
                                        setCurrentStep(8);
                                    }}
                                    className="flex items-center px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl shadow-xl shadow-primary/20 transform hover:-translate-y-1 active:translate-y-0 transition-all uppercase text-xs tracking-[0.2em]"
                                >
                                    Confirm & Continue
                                    <ChevronRightIcon className="w-5 h-5 ml-2" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 8: Signed FS & LOU Upload */}
            {currentStep === 8 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                    <UploadIcon className="w-8 h-8 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-foreground tracking-tight uppercase">Signed FS and LOU Upload</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Upload the signed Financial Statements and Letter of Undertaking.</p>
                                </div>
                            </div>
                        </div>
                        <FileUploadArea
                            title="Upload Signed FS & LOU"
                            subtitle="PDF, JPEG, or PNG files"
                            icon={<UploadIcon className="w-8 h-8" />}
                            selectedFiles={signedFsLouFiles}
                            onFilesSelect={setSignedFsLouFiles}
                        />
                        <div className="mt-8 flex justify-between items-center bg-background/50 p-6 rounded-2xl border border-border/50">
                            <button onClick={async () => { await handleSaveStep(8, 'draft'); setCurrentStep(7); }} className="flex items-center px-6 py-3 text-muted-foreground font-bold hover:text-foreground transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                            <div className="flex gap-4">
                                <button onClick={async () => { await handleSaveStep(8); setCurrentStep(9); }} className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground/80 font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest shadow-lg">Skip</button>
                                <button onClick={async () => { await handleSaveStep(8); setCurrentStep(9); }} className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Proceed to Questionnaire</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 9: Questionnaire */}
            {currentStep === 9 && (
                <div className="space-y-6 max-w-5xl mx-auto pb-12">
                    <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/30">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20"><InformationCircleIcon className="w-7 h-7 text-primary" /></div>
                                <div><h3 className="text-xl font-bold text-foreground uppercase tracking-tight">Corporate Tax Questionnaire</h3><p className="text-xs text-muted-foreground mt-1">Please answer for final tax computation.</p></div>
                            </div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-4 py-2 rounded-full border border-border">
                                {Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length} / {CT_QUESTIONS.length} Completed
                            </div>
                        </div>

                        {(() => {
                            // Initialize current revenue in questionnaire state if not present
                            if (reportForm && !questionnaireAnswers['curr_revenue'] && reportForm.actualOperatingRevenue !== undefined) {
                                setTimeout(() => {
                                    setQuestionnaireAnswers(prev => ({
                                        ...prev,
                                        'curr_revenue': String(reportForm.actualOperatingRevenue)
                                    }));
                                }, 0);
                            }
                            return null;
                        })()}

                        <div className="divide-y divide-border max-h-[60vh] overflow-y-auto custom-scrollbar bg-accent/5">
                            {CT_QUESTIONS.map((q) => (
                                <div key={q.id} className="p-6 hover:bg-accent/10 transition-colors group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex gap-4 flex-1">
                                            <span className="text-xs font-bold text-muted-foreground font-mono mt-1">{String(q.id).padStart(2, '0')}</span>
                                            <div>
                                                <p className="text-sm font-medium text-foreground leading-relaxed">{q.text}</p>
                                                {q.id === 6 && (
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
                                                                    className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground text-sm w-full md:w-64 focus:ring-1 focus:ring-primary outline-none placeholder-muted-foreground/60 transition-all font-mono text-right"
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
                                                                    className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground text-sm w-full md:w-64 focus:ring-1 focus:ring-primary outline-none placeholder-muted-foreground/60 transition-all font-mono text-right"
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
                                                                        <p className="text-xs text-muted-foreground flex justify-between mb-1">
                                                                            <span>Total Revenue:</span>
                                                                            <span className="font-mono font-bold">{currency} {formatNumber(totalRev)}</span>
                                                                        </p>
                                                                        <p className={`text-xs font-bold ${isSbrPotential ? 'text-emerald-500' : 'text-primary'} flex items-center gap-2`}>
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
                                                onChange={(e) => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground text-sm w-40 focus:ring-1 focus:ring-primary outline-none placeholder-muted-foreground/60 transition-all font-mono text-right"
                                                placeholder="0"
                                            />
                                        ) : (
                                            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border shrink-0">
                                                {(() => {
                                                    const currentRev = parseFloat(questionnaireAnswers['curr_revenue']) || 0;
                                                    const prevRev = parseFloat(questionnaireAnswers['prev_revenue']) || 0;
                                                    const isIneligible = currentRev >= 3000000 || prevRev >= 3000000;
                                                    const currentAnswer = (q.id === 6 && isIneligible) ? 'No' : (questionnaireAnswers[q.id] || '');

                                                    const handleAnswerChange = (questionId: any, answer: string) => {
                                                        setQuestionnaireAnswers(prev => ({ ...prev, [questionId]: answer }));
                                                    };

                                                    if (isIneligible && questionnaireAnswers[q.id] !== 'No' && q.id === 6) {
                                                        setTimeout(() => handleAnswerChange(6, 'No'), 0);
                                                    }

                                                    return ['Yes', 'No'].map((opt) => (
                                                        <button
                                                            key={opt}
                                                            onClick={() => (q.id === 6 && isIneligible) ? null : handleAnswerChange(q.id, opt)}
                                                            disabled={q.id === 6 && isIneligible}
                                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentAnswer === opt
                                                                ? 'bg-primary text-primary-foreground shadow-lg'
                                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                                                } ${q.id === 6 && isIneligible ? 'cursor-not-allowed opacity-50 grayscale' : ''}`}
                                                        >
                                                            {opt}
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 bg-muted/30 border-t border-border flex justify-between items-center">
                            <div className="flex gap-4">
                                <button onClick={async () => { await handleSaveStep(9, 'draft'); setCurrentStep(8); }} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                                <button onClick={handleExportQuestionnaire} className="flex items-center px-6 py-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-xl border border-border transition-all uppercase text-[10px] tracking-widest"><DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Export</button>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={async () => { await handleSaveStep(9); setCurrentStep(10); }}
                                    className="px-6 py-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest shadow-lg"
                                >
                                    Skip
                                </button>
                                <button onClick={async () => { await handleSaveStep(9); setCurrentStep(10); }} disabled={Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length < CT_QUESTIONS.length} className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl shadow-primary/20 flex items-center disabled:opacity-50 transition-all transform hover:scale-[1.02]">Final Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 10: Final Report */}
            {currentStep === 10 && renderStepFinalReport()}

            {renderSbrModal()}

        </div>
    );
};
