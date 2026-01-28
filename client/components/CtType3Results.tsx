

import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Transaction, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, BankStatementSummary, Company } from '../types';
import {
    RefreshIcon,
    DocumentArrowDownIcon,
    CheckIcon,
    SparklesIcon,
    PlusIcon,
    ChevronLeftIcon,
    BriefcaseIcon,
    LightBulbIcon,
    ScaleIcon,
    ArrowUpRightIcon,
    ArrowDownIcon,
    AssetIcon,
    IncomeIcon,
    ExpenseIcon,
    ChevronDownIcon,
    EquityIcon,
    ListBulletIcon,
    ExclamationTriangleIcon,
    DocumentDuplicateIcon,
    InformationCircleIcon,
    IdentificationIcon,
    QuestionMarkCircleIcon,
    ChevronRightIcon,
    XMarkIcon,
    TrashIcon,
    BuildingOfficeIcon,
    ChartBarIcon,
    UploadIcon,
    ClipboardCheckIcon,
    DocumentTextIcon,
    ChartPieIcon,
    CalendarDaysIcon
} from './icons';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { FileUploadArea } from './VatFilingUpload';
import {
    extractBusinessEntityDetails,
    extractTradeLicenseDetailsForCustomer,
    extractCorporateTaxCertificateData,
    extractVat201Totals,
    extractTrialBalanceData,
    extractOpeningBalanceDataFromFiles
} from '../services/geminiService';
import { ProfitAndLossStep, PNL_ITEMS, type ProfitAndLossItem } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS, type BalanceSheetItem } from './BalanceSheetStep';
import type { WorkingNoteEntry } from '../types';
import type { Part } from '@google/genai';
import { LoadingIndicator } from './LoadingIndicator';
import { WorkingNotesModal } from './WorkingNotesModal';


const CT_REPORTS_ACCOUNTS: Record<string, string> = {
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

const fileToPart = async (file: File): Promise<Part> => {
    const parts = await fileToGenerativeParts(file);
    return parts[0];
};

const normalizeOpeningBalanceCategory = (value?: string | null) => {
    if (!value) return null;
    const aiCat = value.toLowerCase().trim();
    if (aiCat === 'assets' || aiCat.includes('asset')) return 'Assets';
    if (aiCat === 'liabilities' || aiCat.includes('liab') || aiCat.includes('payable')) return 'Liabilities';
    if (aiCat === 'equity' || aiCat.includes('equity') || aiCat.includes('capital')) return 'Equity';
    if (aiCat === 'income' || aiCat.includes('income') || aiCat.includes('revenue') || aiCat.includes('sales')) return 'Income';
    if (aiCat === 'expenses' || aiCat.includes('expense') || aiCat.includes('cost')) return 'Expenses';
    return null;
};


const generateFilePreviews = async (file: File): Promise<string[]> => {
    const urls: string[] = [];
    if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width; canvas.height = viewport.height;
        if (context) await page.render({ canvasContext: context, viewport }).promise;
        urls.push(canvas.toDataURL());
    } else {
        urls.push(URL.createObjectURL(file));
    }
    return urls;
};

declare const XLSX: any;
declare const pdfjsLib: any;


interface CtType3ResultsProps {
    trialBalance: TrialBalanceEntry[] | null;
    auditReport: FinancialStatements | null;
    isGeneratingTrialBalance: boolean;
    isGeneratingAuditReport: boolean;
    reportsError: string | null;
    onGenerateTrialBalance: (transactions: Transaction[]) => void;
    onGenerateAuditReport: (trialBalance: TrialBalanceEntry[], companyName: string) => void;
    currency: string;
    companyName: string;
    onReset: () => void;
    company: Company | null;
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

const isMatch = (val1: number, val2: number) => Math.abs(val1 - val2) < 5;

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

const renderReportField = (fieldValue: any) => {
    if (fieldValue === null || fieldValue === undefined) return '';
    if (typeof fieldValue === 'number') return fieldValue;
    if (typeof fieldValue === 'object') {
        try {
            return JSON.stringify(fieldValue);
        } catch {
            return String(fieldValue);
        }
    }
    return String(fieldValue);
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

const formatNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const formatDecimalNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

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

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ["Opening Balance", "Trial Balance", "VAT Docs Upload", "VAT Summarization", "Profit & Loss", "Balance Sheet", "LOU Upload", "CT Questionnaire", "Final Report"];
    return (
        <div className="flex items-center w-full max-w-6xl mx-auto mb-8 overflow-x-auto pb-2">
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isCompleted = currentStep > stepNumber;
                const isActive = currentStep === stepNumber;
                return (
                    <React.Fragment key={step}>
                        <div className="flex flex-col items-center text-center z-10 px-2 min-w-[120px]">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-white border-white' : isActive ? 'border-white bg-gray-800' : 'border-gray-600 bg-gray-950'}`}>
                                {isCompleted ? <CheckIcon className="w-6 h-6 text-black" /> : <span className={`font-bold text-lg ${isActive ? 'text-white' : 'text-gray-500'}`}>{stepNumber}</span>}
                            </div>
                            <p className={`mt-2 text-xs font-semibold ${isCompleted || isActive ? 'text-white' : 'text-gray-500'}`}>{step}</p>
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



export const CtType3Results: React.FC<CtType3ResultsProps> = ({
    trialBalance,
    auditReport,
    isGeneratingTrialBalance,
    isGeneratingAuditReport,
    reportsError,
    onGenerateTrialBalance,
    onGenerateAuditReport,
    currency,
    companyName,
    onReset,
    company
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    // Initialize with a deep copy to prevent global mutation of the imported constant
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(() =>
        initialAccountData.map(cat => ({
            ...cat,
            accounts: cat.accounts.map(acc => ({ ...acc }))
        }))
    );
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [vatFiles, setVatFiles] = useState<File[]>([]);
    const [vatDetails, setVatDetails] = useState<any>({});
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);

    // Reset Trial Balance when back on Opening Balance step to ensure regeneration from fresh data
    useEffect(() => {
        if (currentStep === 1) {
            setAdjustedTrialBalance(null);
        }
    }, [currentStep]);
    const [isExtractingVat, setIsExtractingVat] = useState(false);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);
    const [louFiles, setLouFiles] = useState<File[]>([]);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState<string>('');
    const [extractionAlert, setExtractionAlert] = useState<{ type: 'error' | 'warning' | 'success', message: string } | null>(null);
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');

    // Working Notes State
    const [obWorkingNotes, setObWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [tbWorkingNotes, setTbWorkingNotes] = useState<Record<string, { description: string, debit: number, credit: number }[]>>({});
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});

    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');
    const [reportForm, setReportForm] = useState<any>({});

    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [pnlStructure, setPnlStructure] = useState<ProfitAndLossItem[]>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<BalanceSheetItem[]>(BS_ITEMS);

    const [showTbNoteModal, setShowTbNoteModal] = useState(false);
    const [currentTbAccount, setCurrentTbAccount] = useState<string | null>(null);

    const tbFileInputRef = useRef<HTMLInputElement>(null);

    // VAT Step Data Calculation
    const vatStepData = useMemo(() => {
        const fileResults = vatDetails.vatFileResults || [];
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
                if (!quarters[q].startDate) quarters[q].startDate = res.periodFrom;
                if (!quarters[q].endDate) quarters[q].endDate = res.periodTo;

                quarters[q].sales.zero += (res.sales?.zeroRated || 0);
                quarters[q].sales.tv += (res.sales?.standardRated || res.sales?.saleTotal || res.salesField8 || 0);
                quarters[q].sales.vat += (res.sales?.vatAmount || 0);
                quarters[q].purchases.zero += (res.purchases?.zeroRated || 0);
                quarters[q].purchases.tv += (res.purchases?.standardRated || res.purchases?.expenseTotal || res.expensesField11 || 0);
                quarters[q].purchases.vat += (res.purchases?.vatAmount || 0);
            }
        });

        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
        quarterKeys.forEach((q) => {
            const adj = vatManualAdjustments[q] || {};
            const qData = quarters[q as keyof typeof quarters];

            if (adj.salesZero !== undefined) qData.sales.zero = parseFloat(adj.salesZero) || 0;
            if (adj.field8 !== undefined) qData.sales.tv = parseFloat(adj.field8) || 0; // Adjusting Sales Standard Rated (Field 8 approx)
            if (adj.salesVat !== undefined) qData.sales.vat = parseFloat(adj.salesVat) || 0;

            if (adj.purchasesZero !== undefined) qData.purchases.zero = parseFloat(adj.purchasesZero) || 0;
            if (adj.field11 !== undefined) qData.purchases.tv = parseFloat(adj.field11) || 0; // Adjusting Expenses Standard Rated (Field 11 approx)
            if (adj.purchasesVat !== undefined) qData.purchases.vat = parseFloat(adj.purchasesVat) || 0;

            // Recalculate VAT if needed, but for now we trust extracted or manual overrides
            // Note: If fields 8 and 11 are totals including VAT, we should treat them accordingly. 
            // CtType1 treated them as base amounts in some contexts, but let's stick to the override logic.

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
    }, [vatDetails.vatFileResults, vatManualAdjustments]);

    // Mock Bank VAT Data since CtType3 doesn't have transaction-level data
    const bankVatData = useMemo(() => {
        return {
            quarters: {
                'Q1': { sales: 0, purchases: 0 },
                'Q2': { sales: 0, purchases: 0 },
                'Q3': { sales: 0, purchases: 0 },
                'Q4': { sales: 0, purchases: 0 }
            },
            grandTotals: { sales: 0, purchases: 0 }
        };
    }, []);

    const getVatExportRows = React.useCallback((vatData: any) => {
        const { quarters, grandTotals } = vatData;
        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
        const rows: any[] = [];
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

        rows.push([
            "GRAND TOTAL", grandTotals.sales.zero, grandTotals.sales.tv, grandTotals.sales.vat, grandTotals.sales.total,
            "GRAND TOTAL", grandTotals.purchases.zero, grandTotals.purchases.tv, grandTotals.purchases.vat, grandTotals.purchases.total,
            grandTotals.net
        ]);
        return rows;
    }, []);

    // Calculate FTA Figures from Adjusted Trial Balance
    const ftaFormValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;

        // Normalize category names to handle variations
        const normalizeCategory = (value?: string) => {
            if (!value) return '';
            const v = value.toLowerCase().trim();
            if (v.startsWith('equit')) return 'Equity';
            if (v.startsWith('liab')) return 'Liabilities';
            if (v.startsWith('asset')) return 'Assets';
            if (v.startsWith('income') || v.startsWith('revenue')) return 'Income';
            if (v.startsWith('expense')) return 'Expenses';
            return value;
        };

        // Get category from item (use category field if available, otherwise infer from account name)
        const getCategory = (item: any) => {
            if (item.category) return normalizeCategory(item.category);
            const mapped = CT_REPORTS_ACCOUNTS[item.account];
            if (mapped) return mapped;
            // Fallback keyword matching
            const lower = item.account.toLowerCase();
            if (lower.includes('revenue') || lower.includes('income') || lower.includes('sales')) return 'Income';
            if (lower.includes('expense') || lower.includes('cost') || lower.includes('fee') || lower.includes('salary')) return 'Expenses';
            if (lower.includes('cash') || lower.includes('bank') || lower.includes('receivable') || lower.includes('asset') || lower.includes('inventory')) return 'Assets';
            if (lower.includes('payable') || lower.includes('loan') || lower.includes('liability')) return 'Liabilities';
            if (lower.includes('equity') || lower.includes('capital')) return 'Equity';
            return 'Assets'; // Default fallback
        };

        // Sum by category
        const getSumByCategory = (category: string) => {
            return adjustedTrialBalance.reduce((acc, item) => {
                if (item.account === 'Totals') return acc;
                if (getCategory(item) === category) {
                    return acc + (item.debit - item.credit);
                }
                return acc;
            }, 0);
        };

        // Get specific account sum (for backwards compatibility with exact account names)
        const getSum = (labels: string[]) => {
            if (!adjustedTrialBalance) return 0;
            const labelsLower = labels.map(l => l.toLowerCase());
            return adjustedTrialBalance.reduce((acc, item) => {
                if (labelsLower.includes(item.account.toLowerCase())) {
                    return acc + (item.debit - item.credit);
                }
                return acc;
            }, 0);
        };

        // Calculate Income (Revenue) - typically credit balance, so we use Math.abs of negative value
        const totalIncome = Math.abs(getSumByCategory('Income'));

        // For more granular breakdown, try to find specific accounts, fall back to category totals
        const operatingRevenue = Math.abs(getSum(['Sales Revenue', 'Sales to related Parties', 'Revenue', 'Sales'])) || totalIncome;

        // Calculate Expenses - typically debit balance
        const totalExpenses = Math.abs(getSumByCategory('Expenses'));
        const derivingRevenueExpenses = Math.abs(getSum(['Direct Cost (COGS)', 'Purchases from Related Parties', 'Cost of Goods Sold', 'COGS'])) || totalExpenses * 0.4; // Estimate 40% if not found

        const grossProfit = operatingRevenue - derivingRevenueExpenses;

        const salaries = Math.abs(getSum(['Salaries & Wages', 'Staff Benefits', 'Salaries', 'Wages']));
        const depreciation = Math.abs(getSum(['Depreciation', 'Amortization – Intangibles', 'Amortization']));
        const otherExpenses = totalExpenses - derivingRevenueExpenses - salaries - depreciation;
        const nonOpExpensesExcl = salaries + depreciation + otherExpenses;

        const dividendsReceived = Math.abs(getSum(['Dividends received', 'Dividend Income']));
        const otherNonOpRevenue = Math.abs(getSum(['Other non-operating Revenue', 'Other Operating Income', 'Other Income']));

        const interestIncome = Math.abs(getSum(['Interest Income', 'Interest from Related Parties']));
        const interestExpense = Math.abs(getSum(['Interest Expense', 'Interest to Related Parties']));
        const netInterest = interestIncome - interestExpense;

        const netProfit = grossProfit - nonOpExpensesExcl + dividendsReceived + otherNonOpRevenue + netInterest;

        // Assets - typically debit balance
        const totalAssetsByCategory = Math.abs(getSumByCategory('Assets'));
        const totalCurrentAssets = Math.abs(getSum(['Cash on Hand', 'Bank Accounts', 'Cash', 'Bank', 'Accounts Receivable', 'Due from related Parties', 'Prepaid Expenses', 'Deposits', 'VAT Recoverable (Input VAT)', 'Inventory – Goods', 'Work-in-Progress – Services', 'Inventory'])) || totalAssetsByCategory * 0.7; // Estimate 70% current
        const ppe = Math.abs(getSum(['Property, Plant & Equipment', 'Property, Plant and Equipment', 'Furniture & Equipment', 'Vehicles', 'Fixed Assets', 'PPE'])) || totalAssetsByCategory * 0.3; // Estimate 30% non-current
        const totalNonCurrentAssets = ppe;
        const totalAssets = totalAssetsByCategory || (totalCurrentAssets + totalNonCurrentAssets);

        // Liabilities - typically credit balance, so Math.abs of positive value
        const totalLiabilitiesByCategory = Math.abs(getSumByCategory('Liabilities'));
        const totalCurrentLiabilities = Math.abs(getSum(['Accounts Payable', 'Due to Related Parties', 'Accrued Expenses', 'Advances from Customers', 'Short-Term Loans', 'VAT Payable (Output VAT)', 'Corporate Tax Payable'])) || totalLiabilitiesByCategory * 0.7;
        const totalNonCurrentLiabilities = Math.abs(getSum(['Long-Term Liabilities', 'Long-Term Loans', 'Loans from Related Parties', 'Employee End-of-Service Benefits Provision'])) || totalLiabilitiesByCategory * 0.3;
        const totalLiabilities = totalLiabilitiesByCategory || (totalCurrentLiabilities + totalNonCurrentLiabilities);

        // Equity - typically credit balance
        const totalEquityByCategory = Math.abs(getSumByCategory('Equity'));
        const shareCapital = Math.abs(getSum(["Share Capital / Owner's Equity", 'Share Capital', 'Capital', 'Owners Equity'])) || totalEquityByCategory;
        const totalEquity = shareCapital;
        const totalEquityLiabilities = totalEquity + totalLiabilities;

        const taxableIncome = Math.max(0, netProfit);
        const threshold = 375000;
        const corporateTaxLiability = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;

        // SBR Logic: Use explicit Question 6 answer ("Yes" means relief claimed)
        const isReliefClaimed = questionnaireAnswers[6] === 'Yes';

        if (isReliefClaimed) {
            return {
                operatingRevenue: 0, derivingRevenueExpenses: 0, grossProfit: 0,
                salaries: 0, depreciation: 0, otherExpenses: 0, nonOpExpensesExcl: 0,
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
            salaries, depreciation, otherExpenses, nonOpExpensesExcl,
            dividendsReceived, otherNonOpRevenue,
            interestIncome, interestExpense, netInterest,
            netProfit,
            totalCurrentAssets, ppe, totalNonCurrentAssets, totalAssets,
            totalCurrentLiabilities, totalNonCurrentLiabilities, totalLiabilities,
            shareCapital, totalEquity, totalEquityLiabilities,
            taxableIncome, corporateTaxLiability,
            actualOperatingRevenue: operatingRevenue
        };
    }, [adjustedTrialBalance, questionnaireAnswers]);

    // Debug logging
    useEffect(() => {
        console.log('==== DEBUG P&L DATA FLOW ====');
        console.log('adjustedTrialBalance:', adjustedTrialBalance);
        console.log('ftaFormValues:', ftaFormValues);
        console.log('pnlValues:', pnlValues);
        console.log('balanceSheetValues:', balanceSheetValues);
    }, [adjustedTrialBalance, ftaFormValues, pnlValues, balanceSheetValues]);

    useEffect(() => {
        if (ftaFormValues) {
            setPnlValues({
                revenue: { currentYear: ftaFormValues.operatingRevenue, previousYear: 0 },
                cost_of_revenue: { currentYear: ftaFormValues.derivingRevenueExpenses, previousYear: 0 },
                gross_profit: { currentYear: ftaFormValues.grossProfit, previousYear: 0 },
                administrative_expenses: { currentYear: ftaFormValues.salaries + ftaFormValues.otherExpenses, previousYear: 0 },
                depreciation_ppe: { currentYear: ftaFormValues.depreciation, previousYear: 0 },
                profit_loss_year: { currentYear: ftaFormValues.netProfit, previousYear: 0 },
                total_comprehensive_income: { currentYear: ftaFormValues.netProfit, previousYear: 0 },
                profit_after_tax: { currentYear: ftaFormValues.netProfit, previousYear: 0 }
            });

            setBalanceSheetValues({
                property_plant_equipment: { currentYear: ftaFormValues.ppe, previousYear: 0 },
                total_non_current_assets: { currentYear: ftaFormValues.ppe, previousYear: 0 },
                cash_bank_balances: { currentYear: ftaFormValues.totalCurrentAssets, previousYear: 0 },
                total_current_assets: { currentYear: ftaFormValues.totalCurrentAssets, previousYear: 0 },
                total_assets: { currentYear: ftaFormValues.totalAssets, previousYear: 0 },
                share_capital: { currentYear: ftaFormValues.shareCapital, previousYear: 0 },
                retained_earnings: { currentYear: ftaFormValues.netProfit, previousYear: 0 },
                total_equity: { currentYear: ftaFormValues.shareCapital + ftaFormValues.netProfit, previousYear: 0 },
                total_non_current_liabilities: { currentYear: ftaFormValues.totalNonCurrentLiabilities, previousYear: 0 },
                total_current_liabilities: { currentYear: ftaFormValues.totalCurrentLiabilities, previousYear: 0 },
                total_liabilities: { currentYear: ftaFormValues.totalLiabilities, previousYear: 0 },
                total_equity_liabilities: { currentYear: ftaFormValues.totalAssets, previousYear: 0 }
            });
        }
    }, [ftaFormValues]);

    useEffect(() => {
        if (ftaFormValues) {
            setReportForm((prev: any) => ({
                ...prev,
                dueDate: prev.dueDate || company?.ctDueDate || '30/09/2025',
                periodDescription: prev.periodDescription || `Tax Year End ${company?.ctPeriodEnd?.split('/').pop() || '2024'}`,
                periodFrom: prev.periodFrom || company?.ctPeriodStart || '01/01/2024',
                periodTo: prev.periodTo || company?.ctPeriodEnd || '31/12/2024',
                netTaxPosition: ftaFormValues.corporateTaxLiability,
                taxableNameEn: prev.taxableNameEn || companyName,
                entityType: prev.entityType || 'Legal Person - Incorporated',
                trn: prev.trn || company?.trn || '',
                primaryBusiness: prev.primaryBusiness || 'General Trading activities',
                address: prev.address || company?.address || '',
                mobileNumber: prev.mobileNumber || '+971...',
                emailId: prev.emailId || 'admin@docuflow.in',
                operatingRevenue: ftaFormValues.operatingRevenue,
                derivingRevenueExpenses: ftaFormValues.derivingRevenueExpenses,
                grossProfit: ftaFormValues.grossProfit,
                salaries: ftaFormValues.salaries,
                depreciation: ftaFormValues.depreciation,
                otherExpenses: ftaFormValues.otherExpenses,
                nonOpExpensesExcl: ftaFormValues.nonOpExpensesExcl,
                netProfit: ftaFormValues.netProfit,
                totalCurrentAssets: ftaFormValues.totalCurrentAssets,
                ppe: ftaFormValues.ppe,
                totalNonCurrentAssets: ftaFormValues.totalNonCurrentAssets,
                totalAssets: ftaFormValues.totalAssets,
                totalCurrentLiabilities: ftaFormValues.totalCurrentLiabilities,
                totalNonCurrentLiabilities: ftaFormValues.totalNonCurrentLiabilities,
                totalLiabilities: ftaFormValues.totalLiabilities,
                shareCapital: ftaFormValues.shareCapital,
                totalEquity: ftaFormValues.totalEquity,
                totalEquityLiabilities: ftaFormValues.totalEquityLiabilities,
                accountingIncomeTaxPeriod: ftaFormValues.netProfit,
                taxableIncomeTaxPeriod: ftaFormValues.taxableIncome,
                corporateTaxLiability: ftaFormValues.corporateTaxLiability,
                corporateTaxPayable: ftaFormValues.corporateTaxLiability,
                declarationDate: prev.declarationDate || new Date().toLocaleDateString('en-GB'),
                preparedBy: prev.preparedBy || 'Taxable Person',
                declarationConfirmed: prev.declarationConfirmed || 'Yes'
            }));
        }
    }, [ftaFormValues, company, companyName]);

    const handleBack = () => {
        if (currentStep === 1) return;
        setCurrentStep(prev => prev - 1);
    };

    const handleExtractVatData = async () => {
        if (vatFiles.length === 0) return;
        setIsExtractingVat(true);
        try {
            const results = await Promise.all(vatFiles.map(async (file) => {
                const parts = await fileToGenerativeParts(file);
                // Extract per-file Field 8, Field 11, and period dates using all page parts
                const totals = await extractVat201Totals(parts as any) as any;
                return {
                    fileName: file.name,
                    periodFrom: totals.periodFrom,
                    periodTo: totals.periodTo,
                    sales: {
                        zeroRated: totals.sales?.zeroRated || 0,
                        standardRated: totals.sales?.standardRated || 0,
                        vatAmount: totals.sales?.vatAmount || 0,
                        total: totals.sales?.total || 0
                    },
                    purchases: {
                        zeroRated: totals.purchases?.zeroRated || 0,
                        standardRated: totals.purchases?.standardRated || 0,
                        vatAmount: totals.purchases?.vatAmount || 0,
                        total: totals.purchases?.total || 0
                    },
                    netVatPayable: totals.netVatPayable || 0
                };
            }));

            setVatDetails({ vatFileResults: results });
            if (results.length > 0) {
                setCurrentStep(4); // Automatically move to VAT Summarization on success
            }
        } catch (e) {
            console.error("Failed to extract per-file VAT totals", e);
        } finally {
            setIsExtractingVat(false);
        }
    };

    const handleVatSummarizationContinue = () => {
        setCurrentStep(5); // To Profit & Loss
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

    const handleExportStep4VAT = () => {
        const workbook = XLSX.utils.book_new();
        const exportData = getVatExportRows(vatStepData);

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        applySheetStyling(worksheet, 2, 1);

        XLSX.utils.book_append_sheet(workbook, worksheet, "VAT Summarization");
        XLSX.writeFile(workbook, `${companyName}_Step4_VAT_Summarization.xlsx`);
    };

    const handleOpeningBalancesComplete = () => {
        setCurrentStep(2); // Trial Balance step
    };

    const buildVatSummaryRows = (title: string) => {
        const rows: any[][] = [[title], [], ["Field", "Value"]];
        const labelize = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

        Object.entries(vatDetails).forEach(([key, value]) => {
            if (value === null || value === undefined) return;
            if (typeof value === 'object') return; // avoid [object Object]
            rows.push([labelize(key), renderReportField(value)]);
        });

        rows.push([], ["VAT FILE RESULTS"]);
        if (Array.isArray(vatDetails.vatFileResults) && vatDetails.vatFileResults.length > 0) {
            rows.push([
                "File Name", "Period From", "Period To",
                "Sales (Zero)", "Sales (Standard)", "Sales VAT", "Sales Total",
                "Purchases (Zero)", "Purchases (Standard)", "Purchases VAT", "Purchases Total",
                "Net VAT Payable"
            ]);
            vatDetails.vatFileResults.forEach((res: any) => {
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

        rows.push([], ["VAT QUARTER SUMMARY"]);
        rows.push([
            "Quarter",
            "Sales Zero", "Sales Standard", "Sales VAT", "Sales Total",
            "Purchases Zero", "Purchases Standard", "Purchases VAT", "Purchases Total",
            "Net VAT"
        ]);

        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
        quarterKeys.forEach(q => {
            const data = vatStepData.quarters[q as keyof typeof vatStepData.quarters];
            rows.push([
                q,
                data.sales.zero,
                data.sales.tv,
                data.sales.vat,
                data.sales.total,
                data.purchases.zero,
                data.purchases.tv,
                data.purchases.vat,
                data.purchases.total,
                data.net
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

        // Reconciliation table
        rows.push([], ["RECONCILIATION AGAINST TRIAL BALANCE"], ["Description", "Official VAT Cert", "Adjusted TB Figure", "Variance", "Status"]);
        const salesVat = vatDetails.standardRatedSuppliesVatAmount || 0;
        const purchaseVat = vatDetails.standardRatedExpensesVatAmount || 0;
        const tbOutputVat = Math.abs(adjustedTrialBalance?.find(i => i.account === 'VAT Payable (Output VAT)')?.credit || 0);
        const tbInputVat = Math.abs(adjustedTrialBalance?.find(i => i.account === 'VAT Recoverable (Input VAT)')?.debit || 0);
        rows.push(
            ["Output VAT (Sales)", salesVat, tbOutputVat, Math.abs(salesVat - tbOutputVat), isMatch(salesVat, tbOutputVat) ? "MATCHED" : "VARIANCE"],
            ["Input VAT (Purchases)", purchaseVat, tbInputVat, Math.abs(purchaseVat - tbInputVat), isMatch(purchaseVat, tbInputVat) ? "MATCHED" : "VARIANCE"]
        );

        return rows;
    };

    const handleExportFinalExcel = () => {
        const workbook = XLSX.utils.book_new();
        const exportData: any[][] = [];

        // Helper to get helper value
        const getValue = (field: string) => {
            return reportForm[field];
        };

        // Title Row
        exportData.push(["CORPORATE TAX RETURN - FEDERAL TAX AUTHORITY"]);
        exportData.push([]);

        REPORT_STRUCTURE.forEach(section => {
            // Section Title
            exportData.push([section.title.toUpperCase()]);

            section.fields.forEach(field => {
                if (field.type === 'header') {
                    // Sub-headers
                    exportData.push([field.label.replace(/---/g, '').trim()]);
                } else {
                    const label = field.label;
                    let value = getValue(field.field);

                    if (value === undefined || value === null || value === '') {
                        value = '';
                    } else if (field.type === 'number') {
                        if (typeof value !== 'number') value = parseFloat(value) || 0;
                    }

                    exportData.push([label, value]);
                }
            });
            exportData.push([]); // Empty row between sections
        });

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);

        // Styling attempt (basic col widths)
        const wscols = [
            { wch: 60 }, // Column A width
            { wch: 25 }  // Column B width
        ];
        worksheet['!cols'] = wscols;

        // Apply number format to column B where applicable
        // This acts as a best-effort since we have mixed types in col B
        // Ideally we iterate cells to apply formats
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellAddress = { c: 1, r: R }; // Column B
            const cellRef = XLSX.utils.encode_cell(cellAddress);
            const cell = worksheet[cellRef];
            if (cell && cell.t === 'n') {
                cell.z = '#,##0.00';
            }
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, "Final Report");
        XLSX.writeFile(workbook, `${companyName || 'Company'}_CT_Final_Report.xlsx`);
    };

    const handleExportStep1 = () => {
        const obData = [["STEP 1: OPENING BALANCES"], [], ["Category", "Account", "Debit", "Credit"]];
        openingBalancesData.forEach(cat => {
            cat.accounts.filter(acc => acc.debit > 0 || acc.credit > 0).forEach(acc => {
                obData.push([cat.category, acc.name, acc.debit, acc.credit]);
            });
        });
        const ws = XLSX.utils.aoa_to_sheet(obData);
        ws['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        applySheetStyling(ws, 3);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
        XLSX.writeFile(wb, `${companyName}_Step1_OpeningBalances.xlsx`);
    };

    const handleExportStep2 = () => {
        if (!adjustedTrialBalance) return;
        const tbData = [["STEP 2: ADJUSTED TRIAL BALANCE"], [], ["Account", "Debit", "Credit"]];
        adjustedTrialBalance.forEach(item => {
            tbData.push([item.account, item.debit || null, item.credit || null]);
        });
        const ws = XLSX.utils.aoa_to_sheet(tbData);
        ws['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 3, 1);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
        XLSX.writeFile(wb, `${companyName}_Step2_TrialBalance.xlsx`);
    };

    const handleExportStep3 = () => {
        const vatData = buildVatSummaryRows("STEP 3: VAT SUMMARIZATION DETAILS");
        const ws = XLSX.utils.aoa_to_sheet(vatData);
        ws['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
        ];
        applySheetStyling(ws, 3);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VAT Details");
        XLSX.writeFile(wb, `${companyName}_Step3_VATSummary.xlsx`);
    };

    const handleExportStep6 = () => {
        const louData = [["STEP 6: LOU DOCUMENTS (REFERENCE ONLY)"], [], ["Filename", "Size (bytes)", "Status"]];
        louFiles.forEach(file => {
            louData.push([file.name, file.size, "Uploaded"]);
        });
        const ws = XLSX.utils.aoa_to_sheet(louData);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 15 }];
        applySheetStyling(ws, 3);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "LOU Documents");
        XLSX.writeFile(wb, `${companyName}_Step6_LOU.xlsx`);
    };

    const handleExportStep7 = () => {
        const qData = [["STEP 7: CORPORATE TAX QUESTIONNAIRE"], [], ["No.", "Question", "Answer"]];
        CT_QUESTIONS.forEach(q => {
            qData.push([q.id, q.text, questionnaireAnswers[q.id] || "N/A"]);
        });
        const ws = XLSX.utils.aoa_to_sheet(qData);
        ws['!cols'] = [{ wch: 10 }, { wch: 80 }, { wch: 15 }];
        applySheetStyling(ws, 3);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Questionnaire");
        XLSX.writeFile(wb, `${companyName}_Step7_Questionnaire.xlsx`);
    };

    const handleExportAll = () => {
        if (!adjustedTrialBalance || !ftaFormValues) return;

        const workbook = XLSX.utils.book_new();
        const isSmallBusinessRelief = questionnaireAnswers[6] === 'Yes';

        // Helper to get value with SBR logic
        const getValue = (field: string) => {
            const financialFields = [
                'accountingIncomeTaxPeriod', 'taxableIncomeTaxPeriod', 'corporateTaxLiability', 'corporateTaxPayable',
                'totalAssets', 'totalLiabilities', 'totalEquity', 'netProfit', 'totalCurrentAssets', 'totalNonCurrentAssets',
                'totalCurrentLiabilities', 'totalNonCurrentLiabilities', 'totalEquityLiabilities',
                'operatingRevenue', 'derivingRevenueExpenses', 'grossProfit', 'salaries', 'depreciation', 'otherExpenses',
                'nonOpExpensesExcl', 'netInterest', 'ppe', 'shareCapital'
            ];
            if (isSmallBusinessRelief && financialFields.includes(field)) return 0;
            return reportForm[field] || 0;
        };

        // Step 1: Opening Balances
        const obData = [["STEP 1: OPENING BALANCES"], [], ["Category", "Account", "Debit", "Credit"]];
        openingBalancesData.forEach(cat => {
            cat.accounts.filter(acc => acc.debit > 0 || acc.credit > 0).forEach(acc => {
                obData.push([cat.category, acc.name, acc.debit, acc.credit]);
            });
        });
        const obWs = XLSX.utils.aoa_to_sheet(obData);
        obWs['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        applySheetStyling(obWs, 3);
        XLSX.utils.book_append_sheet(workbook, obWs, "1. Opening Balances");

        // Step 2: Trial Balance
        const tbData = [["STEP 2: ADJUSTED TRIAL BALANCE"], [], ["Account", "Debit", "Credit"]];
        adjustedTrialBalance.forEach(item => {
            tbData.push([item.account, item.debit || null, item.credit || null]);
        });
        const tbWs = XLSX.utils.aoa_to_sheet(tbData);
        tbWs['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(tbWs, 3, 1);
        XLSX.utils.book_append_sheet(workbook, tbWs, "2. Trial Balance");

        // Step 2.5: TB Working Notes
        const tbNotesItems: any[] = [];
        Object.entries(tbWorkingNotes).forEach(([account, notesArg]) => {
            const notes = notesArg as { description: string, debit: number, credit: number }[];
            if (notes && notes.length > 0) {
                notes.forEach(n => {
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
            const ws2 = XLSX.utils.json_to_sheet(tbNotesItems);
            ws2['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws2, 1);
            XLSX.utils.book_append_sheet(workbook, ws2, "Step 2 - TB Working Notes");
        }

        // Step 3: VAT Docs Upload
        const vatDocs = vatFiles.length > 0
            ? vatFiles.map(file => ({ "File Name": file.name, "Status": "Uploaded" }))
            : [{ "File Name": "No files uploaded", "Status": "-" }];
        const vatDocsWs = XLSX.utils.json_to_sheet(vatDocs);
        vatDocsWs['!cols'] = [{ wch: 50 }, { wch: 20 }];
        applySheetStyling(vatDocsWs, 1);
        XLSX.utils.book_append_sheet(workbook, vatDocsWs, "3. VAT Docs Upload");

        // Step 4: VAT Summarization
        const vatData = buildVatSummaryRows("STEP 4: VAT SUMMARIZATION DETAILS");
        const vatWs = XLSX.utils.aoa_to_sheet(vatData);
        vatWs['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
        ];
        applySheetStyling(vatWs, 3);
        XLSX.utils.book_append_sheet(workbook, vatWs, "4. VAT Summarization");

        // Step 5: Profit & Loss
        const pnlData = pnlStructure
            .filter(item => item.type === 'item' || item.type === 'total')
            .map(item => ({
                "Item": item.label,
                "Current Year (AED)": pnlValues[item.id]?.currentYear || 0,
                "Previous Year (AED)": pnlValues[item.id]?.previousYear || 0
            }));
        const pnlWs = XLSX.utils.json_to_sheet(pnlData);
        pnlWs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(pnlWs, 1);
        XLSX.utils.book_append_sheet(workbook, pnlWs, "5. Profit & Loss");

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
            const pnlNotesWs = XLSX.utils.json_to_sheet(pnlNotesItems);
            pnlNotesWs['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(pnlNotesWs, 1);
            XLSX.utils.book_append_sheet(workbook, pnlNotesWs, "Step 5 - PNL Working Notes");
        }

        // Step 6: Balance Sheet
        const bsData = bsStructure
            .filter(item => item.type === 'item' || item.type === 'total' || item.type === 'grand_total')
            .map(item => ({
                "Item": item.label,
                "Current Year (AED)": balanceSheetValues[item.id]?.currentYear || 0,
                "Previous Year (AED)": balanceSheetValues[item.id]?.previousYear || 0
            }));
        const bsWs = XLSX.utils.json_to_sheet(bsData);
        bsWs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(bsWs, 1);
        XLSX.utils.book_append_sheet(workbook, bsWs, "6. Balance Sheet");

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
            const bsNotesWs = XLSX.utils.json_to_sheet(bsNotesItems);
            bsNotesWs['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(bsNotesWs, 1);
            XLSX.utils.book_append_sheet(workbook, bsNotesWs, "Step 6 - BS Working Notes");
        }

        // Step 7: LOU Documents
        const louData = [["STEP 7: LOU DOCUMENTS (REFERENCE ONLY)"], [], ["Filename", "Size (bytes)", "Status"]];
        louFiles.forEach(file => {
            louData.push([file.name, file.size, "Uploaded"]);
        });
        const louWs = XLSX.utils.aoa_to_sheet(louData);
        louWs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 15 }];
        applySheetStyling(louWs, 3);
        XLSX.utils.book_append_sheet(workbook, louWs, "7. LOU Upload");

        // Step 8: Questionnaire
        const qData = [["STEP 8: CT QUESTIONNAIRE"], [], ["No.", "Question", "Answer"]];
        CT_QUESTIONS.forEach(q => {
            qData.push([q.id, q.text, questionnaireAnswers[q.id] || "N/A"]);
        });
        const qWs = XLSX.utils.aoa_to_sheet(qData);
        qWs['!cols'] = [{ wch: 10 }, { wch: 80 }, { wch: 15 }];
        applySheetStyling(qWs, 3);
        XLSX.utils.book_append_sheet(workbook, qWs, "8. Questionnaire");

        // Step 9: Final Report
        const reportData: any[][] = [
            ["STEP 9: CORPORATE TAX RETURN - FINAL REPORT"],
            ["Company Name", reportForm.taxableNameEn || companyName],
            ["Generated Date", new Date().toLocaleDateString()],
            []
        ];
        REPORT_STRUCTURE.forEach(section => {
            reportData.push([section.title.toUpperCase()], []);
            section.fields.forEach(f => {
                if (f.type === 'header') {
                    reportData.push([f.label.replace(/---/g, '').trim().toUpperCase()]);
                } else if (f.type === 'number') {
                    reportData.push([f.label, getValue(f.field)]);
                } else {
                    reportData.push([f.label, reportForm[f.field] || '']);
                }
            });
            reportData.push([]);
        });
        const reportWs = XLSX.utils.aoa_to_sheet(reportData);
        reportWs['!cols'] = [{ wch: 65 }, { wch: 45 }];
        applySheetStyling(reportWs, 4);
        XLSX.utils.book_append_sheet(workbook, reportWs, "9. Final Report");

        XLSX.writeFile(workbook, `${companyName}_CT_Type3_Complete_Filing.xlsx`);
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
        const data = pnlStructure.map(item => ({
            'Item': item.label,
            'Current Year (AED)': pnlValues[item.id]?.currentYear || 0,
            'Previous Year (AED)': pnlValues[item.id]?.previousYear || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Profit and Loss");

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

        const wsNotes = XLSX.utils.json_to_sheet(
            pnlNotesItems.length > 0
                ? pnlNotesItems
                : [{ "Linked Item": "", "Description": "", "Current Year (AED)": 0, "Previous Year (AED)": 0 }]
        );
        wsNotes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(wsNotes, 1);
        XLSX.utils.book_append_sheet(wb, wsNotes, "PNL - Working Notes");

        XLSX.writeFile(wb, `${companyName}_Profit_And_Loss.xlsx`);
    };

    const handleExportStepBS = () => {
        const wb = XLSX.utils.book_new();
        const data = bsStructure.map(item => ({
            'Item': item.label,
            'Current Year (AED)': balanceSheetValues[item.id]?.currentYear || 0,
            'Previous Year (AED)': balanceSheetValues[item.id]?.previousYear || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(ws, 1);
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");

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

        const wsNotes = XLSX.utils.json_to_sheet(
            bsNotesItems.length > 0
                ? bsNotesItems
                : [{ "Linked Item": "", "Description": "", "Current Year (AED)": 0, "Previous Year (AED)": 0 }]
        );
        wsNotes['!cols'] = [{ wch: 50 }, { wch: 50 }, { wch: 20 }, { wch: 20 }];
        applySheetStyling(wsNotes, 1);
        XLSX.utils.book_append_sheet(wb, wsNotes, "BS - Working Notes");

        XLSX.writeFile(wb, `${companyName}_Balance_Sheet.xlsx`);
    };

    const handleCellChange = (accountLabel: string, field: 'debit' | 'credit', value: string) => {
        const numValue = parseFloat(value) || 0;
        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const newBalance = [...prev];
            const existingIndex = newBalance.findIndex(i => i.account === accountLabel);
            if (existingIndex > -1) {
                const item = newBalance[existingIndex];
                const newBaseDebit = field === 'debit' ? numValue : (item.baseDebit !== undefined ? item.baseDebit : item.debit);
                const newBaseCredit = field === 'credit' ? numValue : (item.baseCredit !== undefined ? item.baseCredit : item.credit);

                // Recalculate current debit/credit based on new base + existing notes
                const notes = tbWorkingNotes[accountLabel] || [];
                const noteDebit = notes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
                const noteCredit = notes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

                newBalance[existingIndex] = {
                    ...item,
                    baseDebit: newBaseDebit,
                    baseCredit: newBaseCredit,
                    debit: newBaseDebit + noteDebit,
                    credit: newBaseCredit + noteCredit
                };
            }
            else {
                const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
                const newItem = {
                    account: accountLabel,
                    debit: numValue,
                    credit: 0,
                    baseDebit: numValue,
                    baseCredit: 0,
                    [field]: numValue
                };
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
    };

    const handleAccountRename = (oldName: string, newName: string) => {
        if (!newName.trim() || oldName === newName) return;

        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            return prev.map(item => item.account === oldName ? { ...item, account: newName } : item);
        });

        if (tbWorkingNotes[oldName]) {
            setTbWorkingNotes(prev => {
                const newNotes = { ...prev };
                newNotes[newName] = newNotes[oldName];
                delete newNotes[oldName];
                return newNotes;
            });
        }
    };

    const handleDeleteAccount = (accountName: string) => {
        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const filtered = prev.filter(item => item.account !== accountName);

            // Recalculate Totals
            const dataOnly = filtered.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const totalsIdx = filtered.findIndex(i => i.account.toLowerCase() === 'totals');
            if (totalsIdx > -1) {
                filtered[totalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
                return [...filtered];
            } else {
                return [...filtered, { account: 'Totals', debit: totalDebit, credit: totalCredit }];
            }
        });

        setTbWorkingNotes(prev => {
            const newNotes = { ...prev };
            delete newNotes[accountName];
            return newNotes;
        });
    };

    const handleOpenTbNote = (account: string) => {
        setCurrentTbAccount(account);
        setShowTbNoteModal(true);
    };

    const handleSaveTbNote = (notes: { description: string, debit: number, credit: number }[]) => {
        if (!currentTbAccount) return;

        setTbWorkingNotes(prev => ({
            ...prev,
            [currentTbAccount]: notes
        }));

        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const newBalance = [...prev];
            const accIndex = newBalance.findIndex(i => i.account === currentTbAccount);
            if (accIndex > -1) {
                const item = newBalance[accIndex];
                const baseDebit = item.baseDebit !== undefined ? item.baseDebit : item.debit; // Fallback if base not set
                const baseCredit = item.baseCredit !== undefined ? item.baseCredit : item.credit;

                const noteDebit = notes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
                const noteCredit = notes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

                newBalance[accIndex] = {
                    ...item,
                    baseDebit, // Ensure base is preserved
                    baseCredit,
                    debit: baseDebit + noteDebit,
                    credit: baseCredit + noteCredit
                };
            }

            // Recalculate Totals
            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (totalsIdx > -1) newBalance[totalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
            else newBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });

            return newBalance;
        });
    };

    const handleExtractTrialBalance = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files) as File[];
        console.log(`[TB Extraction] Starting for ${files.length} file(s).`);

        setIsExtractingTB(true);
        setExtractionStatus(`Initializing file processing (${files.length} file(s))...`);
        setExtractionAlert(null);

        try {
            setExtractionStatus('Gemini AI is analyzing layout and extracting ledger items with strict categorization...');

            // Use the Opening Balance extraction workflow (stricter, category-aware)
            const extractedEntries = await extractOpeningBalanceDataFromFiles(files);
            console.log(`[TB Extraction] AI returned ${extractedEntries?.length || 0} entries.`);

            if (extractedEntries && extractedEntries.length > 0) {
                // Validation: Check if it balances
                const sumDebit = extractedEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
                const sumCredit = extractedEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
                const variance = Math.abs(sumDebit - sumCredit);

                if (variance > 10) {
                    setExtractionAlert({
                        type: 'warning',
                        message: `Extraction complete, but Trial Balance is out of balance by ${formatNumber(variance)}. Please review the extracted rows below.`
                    });
                } else {
                    setExtractionAlert({ type: 'success', message: 'Trial Balance extracted successfully and balances.' });
                }

                setAdjustedTrialBalance(prev => {
                    const currentMap: Record<string, TrialBalanceEntry> = {};
                    (prev || []).forEach(item => { if (item.account.toLowerCase() !== 'totals') currentMap[item.account.toLowerCase()] = item; });

                    extractedEntries.forEach(extracted => {
                        let mappedName = extracted.account;
                        const standardAccounts = Object.keys(CT_REPORTS_ACCOUNTS);
                        const match = standardAccounts.find(sa => sa.toLowerCase() === extracted.account.toLowerCase());
                        if (match) mappedName = match;

                        const existingNotes = tbWorkingNotes[mappedName] || [];
                        const noteDebit = existingNotes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
                        const noteCredit = existingNotes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

                        // Normalize Category
                        let finalCategory = extracted.category;
                        const normCat = normalizeOpeningBalanceCategory(extracted.category);
                        if (normCat) finalCategory = normCat;

                        currentMap[mappedName.toLowerCase()] = {
                            ...extracted,
                            account: mappedName,
                            category: finalCategory, // Persist the category from extraction
                            baseDebit: extracted.debit,
                            baseCredit: extracted.credit,
                            debit: (extracted.debit || 0) + noteDebit,
                            credit: (extracted.credit || 0) + noteCredit
                        };
                    });

                    const newEntries = Object.values(currentMap);

                    // Sort entries for better UX (optional but nice)
                    // newEntries.sort((a, b) => (a.category || '').localeCompare(b.category || '') || a.account.localeCompare(b.account));

                    const totalDebit = newEntries.reduce((s, i) => s + (Number(i.debit) || 0), 0);
                    const totalCredit = newEntries.reduce((s, i) => s + (Number(i.credit) || 0), 0);
                    return [...newEntries, { account: 'Totals', debit: totalDebit, credit: totalCredit }];
                });
            } else {
                setExtractionAlert({ type: 'error', message: 'AI could not detect any ledger accounts in this file. Please ensure the file contains a Trial Balance table.' });
            }
        } catch (err) {
            console.error("TB extraction failed", err);
            setExtractionAlert({ type: 'error', message: 'An unexpected error occurred during extraction. Please try again with a clearer file.' });
        } finally {
            setIsExtractingTB(false);
            setExtractionStatus('');
            if (tbFileInputRef.current) tbFileInputRef.current.value = '';
        }
    };



    const handleExtractOpeningBalances = async () => {
        if (openingBalanceFiles.length === 0) return;

        // Safety clear to ensure absolutely no previous trial balance leads
        setAdjustedTrialBalance(null);

        setIsExtractingOpeningBalances(true);
        try {
            const extractedEntries = await extractOpeningBalanceDataFromFiles(openingBalanceFiles);

            if (extractedEntries && extractedEntries.length > 0) {
                setOpeningBalancesData(prev => {
                    // Create a deep copy AND clear previous automated extractions to prevent stale data
                    const newData = prev.map(cat => ({
                        ...cat,
                        accounts: cat.accounts
                            .filter(acc => acc.subCategory !== 'Extracted')
                            .map(acc => ({ ...acc }))
                    }));

                    // Helper to update or add an account
                    const upsertAccount = (categoryName: string, accountName: string, debit: number, credit: number) => {
                        const category = newData.find(c => c.category === categoryName);
                        if (!category) return false;

                        // Normalize for fuzzy match
                        const normalizedSearch = accountName.toLowerCase().replace(/[^a-z0-9]/g, '');

                        // 1. Try exact name match
                        // MODIFIED: Do NOT merge extracted accounts. Always append. 
                        // This fixes the issue where distinct rows (e.g. multiple "Cash" entries or similar names) were getting merged/lost.
                        // We trust the AI to give us distinct rows.

                        /* 
                        let targetAccount = category.accounts.find(a =>
                            a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch
                        );
                        */

                        let targetAccount = null; // Force new entry

                        if (targetAccount) {
                            // (Unreachable with null, but keeping structure if we revert)
                        } else {
                            // Add as new account
                            category.accounts.push({
                                name: accountName,
                                debit: debit,
                                credit: credit,
                                isNew: true,
                                subCategory: 'Extracted'
                            });
                            return true;
                        }
                    };

                    // Iterate through extracted entries
                    extractedEntries.forEach(entry => {
                        const debit = entry.debit || 0;
                        const credit = entry.credit || 0;
                        // if (debit === 0 && credit === 0) return; // ALLOW ZERO VALUES

                        const name = entry.account;
                        let targetCategory = CT_REPORTS_ACCOUNTS[name] || 'Assets'; // Default to Assets if unknown

                        const normalizedCategory = normalizeOpeningBalanceCategory(entry.category);
                        if (normalizedCategory) {
                            targetCategory = normalizedCategory;
                        }

                        // Fallback categorization logic based on keywords (only if AI category failed or was missing)
                        if (!normalizedCategory) {
                            if (!CT_REPORTS_ACCOUNTS[name]) {
                                const lower = name.toLowerCase();
                                console.log(`[Auto-Categorize] Processing '${name}'...`);

                                // EQUITY
                                if (lower.includes('equity') || lower.includes('capital') || lower.includes('retained earnings') || lower.includes('drawing') || lower.includes('dividend') || lower.includes('reserve') || lower.includes('share')) {
                                    targetCategory = 'Equity';
                                }
                                // LIABILITIES
                                else if (lower.includes('payable') || lower.includes('loan') || lower.includes('liability') || lower.includes('due to') || lower.includes('advance from') || lower.includes('accrual') || lower.includes('provision') || lower.includes('vat output') || lower.includes('tax payable') || lower.includes('overdraft')) {
                                    targetCategory = 'Liabilities';
                                }
                                // EXPENSES (Check AFTER Liabilities/Equity to avoid grabbing "Salary Payable")
                                else if (lower.includes('expense') || lower.includes('cost') || lower.includes('salary') || lower.includes('wages') || lower.includes('rent') || lower.includes('advertising') || lower.includes('audit') || lower.includes('bank charge') || lower.includes('consulting') || lower.includes('utilities') || lower.includes('electricity') || lower.includes('water') || lower.includes('insurance') || lower.includes('repair') || lower.includes('maintenance') || lower.includes('stationery') || lower.includes('printing') || lower.includes('postage') || lower.includes('travel') || lower.includes('ticket') || lower.includes('accommodation') || lower.includes('meal') || lower.includes('entertainment') || lower.includes('depreciation') || lower.includes('amortization') || lower.includes('bad debt') || lower.includes('charity') || lower.includes('donation') || lower.includes('fine') || lower.includes('penalty') || lower.includes('freight') || lower.includes('shipping') || lower.includes('software') || lower.includes('subscription') || lower.includes('license') || lower.includes('purchase')) {
                                    targetCategory = 'Expenses';
                                }
                                // INCOME (Check LAST to avoid grabbing "Cost of Sales")
                                else if (lower.includes('revenue') || lower.includes('income') || lower.includes('sale') || lower.includes('turnover') || lower.includes('commission') || lower.includes('fee')) {
                                    targetCategory = 'Income';
                                }
                                // ASSETS (Default)
                                else {
                                    targetCategory = 'Assets';
                                }
                                console.log(`[Auto-Categorize] '${name}' -> ${targetCategory}`);
                            }
                        }

                        upsertAccount(targetCategory, name, debit, credit);
                    });

                    return newData;
                });
            }
        } catch (e: any) {
            console.error("Failed to extract opening balances", e);
            alert(`Failed to extract data: ${e.message || "Unknown error"}. Please check server logs.`);
        } finally {
            setIsExtractingOpeningBalances(false);
        }
    };

    const handleExportOpeningBalances = () => {
        if (!openingBalancesData) return;

        // Flatten data for export
        const rows = [
            ['Category', 'Sub-Category', 'Account Name', 'Debit', 'Credit']
        ];

        openingBalancesData.forEach(cat => {
            cat.accounts.forEach(acc => {
                rows.push([
                    cat.category,
                    acc.subCategory || '',
                    acc.name,
                    String(acc.debit),
                    String(acc.credit)
                ]);
            });
        });

        // Convert to CSV
        const csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Opening_Balances_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleUpdateObWorkingNote = (accountName: string, notes: WorkingNoteEntry[]) => {
        setObWorkingNotes(prev => ({
            ...prev,
            [accountName]: notes
        }));
    };

    const getIconForSection = (label: string) => {
        if (label.includes('Assets')) return AssetIcon;
        if (label.includes('Liabilities')) return ScaleIcon;
        if (label.includes('Income')) return IncomeIcon;
        if (label.includes('Expenses')) return ExpenseIcon;
        if (label.includes('Equity')) return EquityIcon;
        return BriefcaseIcon;
    };

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

    const getCurrentTbEntry = () => {
        if (!currentTbAccount || !adjustedTrialBalance) return { baseDebit: 0, baseCredit: 0 };
        const item = adjustedTrialBalance.find(i => i.account === currentTbAccount);
        if (!item) return { baseDebit: 0, baseCredit: 0 };
        return {
            baseDebit: item.baseDebit !== undefined ? item.baseDebit : item.debit, // Fallback if no base set yet
            baseCredit: item.baseCredit !== undefined ? item.baseCredit : item.credit
        };
    };

    const renderAdjustTB = () => {
        const grandTotal = {
            debit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.debit || 0,
            credit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.credit || 0
        };
        const sections = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];
        const normalizeCategory = (value?: string) => {
            if (!value) return '';
            const v = value.toLowerCase().trim();
            if (v.startsWith('equit')) return 'Equity';
            if (v.startsWith('liab')) return 'Liabilities';
            if (v.startsWith('asset')) return 'Assets';
            if (v.startsWith('income')) return 'Income';
            if (v.startsWith('expense')) return 'Expenses';
            return value;
        };
        const getSectionItems = (sec: string) => (
            adjustedTrialBalance?.filter(i => {
                if (i.account === 'Totals') return false;
                if (i.category) {
                    return normalizeCategory(i.category) === sec;
                }
                const category = CT_REPORTS_ACCOUNTS[i.account];
                if (category) return category === sec;
                const lower = i.account.toLowerCase();
                if (sec === 'Income' && (lower.includes('revenue') || lower.includes('income'))) return true;
                if (sec === 'Expenses' && (lower.includes('expense') || lower.includes('cost') || lower.includes('fee') || lower.includes('salary'))) return true;
                if (sec === 'Assets' && (lower.includes('cash') || lower.includes('bank') || lower.includes('receivable') || lower.includes('asset'))) return true;
                if (sec === 'Liabilities' && (lower.includes('payable') || lower.includes('loan') || lower.includes('liability'))) return true;
                if (sec === 'Equity' && (lower.includes('equity') || lower.includes('capital'))) return true;
                return sec === 'Assets' && !Object.values(CT_REPORTS_ACCOUNTS).includes(i.account) &&
                    !lower.includes('revenue') && !lower.includes('income') && !lower.includes('expense') &&
                    !lower.includes('cost') && !lower.includes('fee') && !lower.includes('salary') &&
                    !lower.includes('payable') && !lower.includes('loan') && !lower.includes('liability') &&
                    !lower.includes('equity') && !lower.includes('capital');
            }) || []
        );

        return (
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 bg-gray-950 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Adjust Trial Balance</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" multiple />
                        <button onClick={handleExportStep2} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
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

                {extractionAlert && (
                    <div className={`p-4 mx-6 mt-6 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${extractionAlert.type === 'error' ? 'bg-red-900/10 border-red-900/30 text-red-400' :
                        extractionAlert.type === 'warning' ? 'bg-amber-900/10 border-amber-900/30 text-amber-400' :
                            'bg-green-900/10 border-green-900/30 text-green-400'
                        }`}>
                        {extractionAlert.type === 'error' ? <XMarkIcon className="w-5 h-5 shrink-0" /> :
                            extractionAlert.type === 'warning' ? <ExclamationTriangleIcon className="w-5 h-5 shrink-0" /> :
                                <CheckIcon className="w-5 h-5 shrink-0" />
                        }
                        <div className="flex-1 text-sm font-bold">{extractionAlert.message}</div>
                        <button onClick={() => setExtractionAlert(null)} className="text-gray-500 hover:text-white transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                )}

                {isExtractingTB && (
                    <div className="p-6 border-b border-gray-800 bg-black/40">
                        <LoadingIndicator
                            progress={extractionStatus.includes('Gemini') ? 75 : 30}
                            statusText={extractionStatus || "Gemini AI is reading your Trial Balance table..."}
                            size="compact"
                        />
                    </div>
                )}

                <div className="divide-y divide-gray-800">
                    {sections.map(sec => (
                        <div key={sec}>
                            <button onClick={() => setOpenTbSection(openTbSection === sec ? null : sec)} className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === sec ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}>
                                <div className="flex items-center space-x-3">
                                    {React.createElement(getIconForSection(sec), { className: "w-5 h-5 text-gray-400" })}
                                    <span className="font-bold text-white uppercase tracking-wide">{sec}</span>
                                    <span className="text-[10px] bg-gray-800 text-gray-500 font-mono px-2 py-0.5 rounded-full border border-gray-700">
                                        {getSectionItems(sec).length}
                                    </span>
                                </div>
                                {openTbSection === sec ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                            </button>
                            {openTbSection === sec && (
                                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead><tr className="bg-gray-800/30 text-gray-500 text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-gray-700/50">Account Name</th><th className="px-4 py-2 border-b border-gray-700/50 text-center w-16">Notes</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Debit</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Credit</th></tr></thead>
                                        <tbody>
                                            {getSectionItems(sec).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0 group">
                                                    <td className="py-2 px-4 text-gray-300 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={item.account}
                                                                onChange={(e) => handleAccountRename(item.account, e.target.value)}
                                                                className="bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-full hover:bg-gray-800/50 transition-colors"
                                                            />
                                                            <button
                                                                onClick={() => handleDeleteAccount(item.account)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                                                                title="Delete Account"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-4 text-center">
                                                        <button
                                                            onClick={() => handleOpenTbNote(item.account)}
                                                            className={`p-1.5 rounded-lg transition-all ${tbWorkingNotes[item.account]?.length > 0 ? 'bg-blue-600/20 text-blue-400' : 'text-gray-600 hover:text-blue-400 hover:bg-gray-800'}`}
                                                            title="Add Working Notes"
                                                        >
                                                            {tbWorkingNotes[item.account]?.length > 0 ? <ClipboardCheckIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.debit || ''} onChange={e => handleCellChange(item.account, 'debit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                                    <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.credit || ''} onChange={e => handleCellChange(item.account, 'credit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                                </tr>
                                            ))}
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
                        <button onClick={() => setCurrentStep(3)} disabled={Math.abs(grandTotal.debit - grandTotal.credit) > 0.1} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep3VatSummarization = () => {
        const tbSales = ftaFormValues?.operatingRevenue || 0;
        const tbPurchases = ftaFormValues?.derivingRevenueExpenses || 0;
        const tbSalesVat = Math.abs((adjustedTrialBalance?.find(i => i.account === 'VAT Payable (Output VAT)')?.credit || 0) - (adjustedTrialBalance?.find(i => i.account === 'VAT Payable (Output VAT)')?.debit || 0));
        const tbPurchaseVat = Math.abs((adjustedTrialBalance?.find(i => i.account === 'VAT Recoverable (Input VAT)')?.debit || 0) - (adjustedTrialBalance?.find(i => i.account === 'VAT Recoverable (Input VAT)')?.credit || 0));

        const reconciliationData = [
            {
                label: 'Standard Rated Supplies (Sales)',
                certAmount: vatDetails.standardRatedSuppliesAmount || 0,
                tbAmount: tbSales,
                certVat: vatDetails.standardRatedSuppliesVatAmount || 0,
                tbVat: tbSalesVat,
                icon: ArrowUpRightIcon,
                color: 'text-green-400'
            },
            {
                label: 'Standard Rated Expenses (Purchases/COGS)',
                certAmount: vatDetails.standardRatedExpensesAmount || 0,
                tbAmount: tbPurchases,
                certVat: vatDetails.standardRatedExpensesVatAmount || 0,
                tbVat: tbPurchaseVat,
                icon: ArrowDownIcon,
                color: 'text-red-400'
            }
        ];

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/5">
                                <ChartBarIcon className="w-8 h-8 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white tracking-tight">VAT Summarization & Reconciliation</h3>
                                <p className="text-gray-400 mt-1 max-w-2xl">Upload VAT Returns to verify your Trial Balance figures against official VAT records.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div className="min-h-[400px]">
                                <FileUploadArea
                                    title="Upload VAT Documents"
                                    subtitle="VAT Returns or Certificates"
                                    icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                                    selectedFiles={vatFiles}
                                    onFilesSelect={setVatFiles}
                                />
                            </div>
                            <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 flex flex-col min-h-[400px] justify-center items-center text-center">
                                {isExtractingVat ? (
                                    <div className="w-full"><LoadingIndicator progress={70} statusText="Gemini AI is analyzing VAT documents..." size="compact" /></div>
                                ) : Object.keys(vatDetails).length > 0 ? (
                                    <div className="w-full space-y-6">
                                        <div className="flex items-center justify-center gap-2 text-green-400 bg-green-400/10 py-2 px-4 rounded-full w-fit mx-auto mb-4">
                                            <CheckIcon className="w-5 h-5" />
                                            <span className="text-xs font-bold uppercase tracking-widest">Document Parsed Successfully</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Sales (Cert)</p>
                                                <p className="text-lg font-mono text-white">{formatNumber(vatDetails.standardRatedSuppliesAmount || 0)}</p>
                                            </div>
                                            <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Expenses (Cert)</p>
                                                <p className="text-lg font-mono text-white">{formatNumber(vatDetails.standardRatedExpensesAmount || 0)}</p>
                                            </div>
                                        </div>
                                        <button onClick={handleExtractVatData} className="text-xs text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">Re-Extract Data</button>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="w-16 h-16 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4"><SparklesIcon className="w-8 h-8 text-blue-400" /></div>
                                        <h4 className="text-xl font-bold text-white tracking-tight">Ready to verify with Gemini AI</h4>
                                        <p className="text-gray-400 max-w-xs mx-auto text-sm">Upload your VAT Returns. We will cross-check them with your Adjusted Trial Balance.</p>
                                        <button onClick={handleExtractVatData} disabled={vatFiles.length === 0} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl disabled:opacity-50 transition-all transform hover:scale-105">Extract & Reconcile</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {Object.keys(vatDetails).length > 0 && (
                            <div className="mt-12 overflow-hidden rounded-2xl border border-gray-800 bg-[#0F172A]/30 transition-all animate-in fade-in zoom-in-95 duration-500">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#0F172A] border-b border-gray-800">
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Official VAT Cert</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Adjusted TB Figure</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Variance</th>
                                            <th className="p-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {reconciliationData.map((item, idx) => {
                                            const amountMatched = isMatch(item.certAmount, item.tbAmount);
                                            const vatMatched = isMatch(item.certVat, item.tbVat);

                                            return (
                                                <React.Fragment key={idx}>
                                                    <tr className="hover:bg-gray-800/30 transition-colors">
                                                        <td className="p-5">
                                                            <div className="flex items-center gap-3">
                                                                <item.icon className={`w-5 h-5 ${item.color}`} />
                                                                <div>
                                                                    <p className="text-sm font-bold text-white">{item.label}</p>
                                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Net Amount</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-5 text-right font-mono text-sm text-white">{formatNumber(item.certAmount)}</td>
                                                        <td className="p-5 text-right font-mono text-sm text-gray-400">{formatNumber(item.tbAmount)}</td>
                                                        <td className={`p-5 text-right font-mono text-sm ${amountMatched ? 'text-gray-500' : 'text-orange-400'}`}>{formatNumber(Math.abs(item.certAmount - item.tbAmount))}</td>
                                                        <td className="p-5 text-center">
                                                            {amountMatched ? (
                                                                <div className="flex items-center justify-center text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mx-auto w-fit">MATCHED</div>
                                                            ) : (
                                                                <div className="flex items-center justify-center text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mx-auto w-fit">VARIANCE</div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                    <tr className="bg-black/20 border-b border-gray-800/50">
                                                        <td className="p-3 pl-14 text-[9px] text-gray-500 uppercase font-black tracking-widest">VAT (5%)</td>
                                                        <td className="p-3 text-right font-mono text-xs text-white opacity-60">{formatNumber(item.certVat)}</td>
                                                        <td className="p-3 text-right font-mono text-xs text-gray-500">{formatNumber(item.tbVat)}</td>
                                                        <td className={`p-3 text-right font-mono text-xs ${vatMatched ? 'text-gray-600' : 'text-orange-500'}`}>{formatNumber(Math.abs(item.certVat - item.tbVat))}</td>
                                                        <td className="p-3 text-center">
                                                            <div className={`w-2 h-2 rounded-full mx-auto ${vatMatched ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                                                        </td>
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                    <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                    <button onClick={() => setCurrentStep(4)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Continue to P&L</button>
                </div>
            </div>
        );
    };

    const renderStep4ProfitAndLoss = () => (
        <ProfitAndLossStep
            onNext={() => setCurrentStep(6)}
            onBack={handleBack}
            data={pnlValues}
            structure={pnlStructure}
            onChange={handlePnlChange}
            onExport={handleExportStepPnl}
            onAddAccount={handleAddPnlAccount}
            workingNotes={pnlWorkingNotes}
            onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
        />
    );

    const renderStep5BalanceSheet = () => (
        <BalanceSheetStep
            onNext={() => setCurrentStep(7)}
            onBack={handleBack}
            data={balanceSheetValues}
            structure={bsStructure}
            onChange={handleBalanceSheetChange}
            onExport={handleExportStepBS}
            onAddAccount={handleAddBsAccount}
            workingNotes={bsWorkingNotes}
            onUpdateWorkingNotes={handleUpdateBsWorkingNote}
        />
    );

    const renderStepFinalReport = () => {
        if (!ftaFormValues) return <div className="text-center p-20 bg-gray-900 rounded-xl border border-gray-800">Calculating report data...</div>;

        const isSmallBusinessRelief = questionnaireAnswers[6] === 'Yes';

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

        const ReportNumberInput = ({ field, className = "" }: { field: string, className?: string }) => {
            let value = reportForm[field] || 0;

            return (
                <input
                    type="text"
                    value={formatNumber(value)}
                    readOnly
                    className={`bg-transparent border-none text-right font-mono text-sm font-bold text-white focus:ring-0 w-full ${className}`}
                />
            );
        };

        const ReportInput = ({ field, className = "" }: { field: string, className?: string }) => (
            <input
                type="text"
                value={reportForm[field] || ''}
                readOnly
                className={`bg-transparent border-none text-right font-medium text-sm text-gray-300 focus:ring-0 w-full ${className}`}
            />
        );

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
                                onClick={handleExportFinalExcel}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                Export
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

    const renderStep4VatSummarization = () => {
        const { quarters, grandTotals } = vatStepData;
        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];

        const renderEditableCell = (quarter: string, field: string, value: number) => {
            const displayValue = vatManualAdjustments[quarter]?.[field as keyof typeof vatManualAdjustments[string]] ?? (value === 0 ? '' : value.toString());
            return (
                <input
                    type="text"
                    value={displayValue}
                    onChange={(e) => handleVatAdjustmentChange(quarter, field, e.target.value)}
                    className="w-full bg-transparent text-right outline-none focus:bg-white/10 px-2 py-1 rounded transition-colors font-mono"
                    placeholder="0.00"
                />
            );
        };

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
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
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in {currency}</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-center">
                                <thead className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                    <tr>
                                        <th className="py-4 px-4 text-left">Period</th>
                                        <th className="py-4 px-4 text-right">Zero Rated</th>
                                        <th className="py-4 px-4 text-right">Standard Rated</th>
                                        <th className="py-4 px-4 text-right text-blue-400">VAT Amount</th>
                                        <th className="py-4 px-4 text-right bg-blue-900/5 text-blue-200">Total Sales</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300 text-xs font-mono">
                                    {quarterKeys.map((q) => {
                                        const qFullData = quarters[q as keyof typeof quarters];
                                        const data = qFullData.sales;
                                        const dateRange = qFullData.startDate && qFullData.endDate ? `(${qFullData.startDate} - ${qFullData.endDate})` : '';

                                        return (
                                            <tr key={q} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-white text-[10px] tracking-tight">{q}</span>
                                                        {dateRange && <span className="text-[10px] text-blue-400/80 font-bold font-mono tracking-tight">{dateRange}</span>}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(q, 'salesZero', data.zero)}</td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(q, 'field8', data.tv)}</td>
                                                <td className="py-4 px-4 text-right text-blue-400">{renderEditableCell(q, 'salesVat', data.vat)}</td>
                                                <td className="py-4 px-4 text-right font-black bg-blue-500/5 text-blue-100">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-blue-900/20 font-bold border-t-2 border-gray-800">
                                        <td className="py-5 px-4 text-left font-black text-blue-300 text-[10px] uppercase italic">Sales Total</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatDecimalNumber(grandTotals.sales.zero)}</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatDecimalNumber(grandTotals.sales.tv)}</td>
                                        <td className="py-5 px-4 text-right text-blue-400">{formatDecimalNumber(grandTotals.sales.vat)}</td>
                                        <td className="py-5 px-4 text-right text-white text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatDecimalNumber(grandTotals.sales.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Purchases Section */}
                    <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-800 bg-indigo-900/10 flex justify-between items-center">
                            <h4 className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in {currency}</span>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-center">
                                <thead className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                    <tr>
                                        <th className="py-4 px-4 text-left">Period</th>
                                        <th className="py-4 px-4 text-right">Zero Rated</th>
                                        <th className="py-4 px-4 text-right">Standard Rated</th>
                                        <th className="py-4 px-4 text-right text-indigo-400">VAT Amount</th>
                                        <th className="py-4 px-4 text-right bg-indigo-900/5 text-indigo-200">Total Purchases</th>
                                    </tr>
                                </thead>
                                <tbody className="text-gray-300 text-xs font-mono">
                                    {quarterKeys.map((q) => {
                                        const qFullData = quarters[q as keyof typeof quarters];
                                        const data = qFullData.purchases;
                                        const dateRange = qFullData.startDate && qFullData.endDate ? `(${qFullData.startDate} - ${qFullData.endDate})` : '';

                                        return (
                                            <tr key={q} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-white text-[10px] tracking-tight">{q}</span>
                                                        {dateRange && <span className="text-[10px] text-indigo-400/80 font-bold font-mono tracking-tight">{dateRange}</span>}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(q, 'purchasesZero', data.zero)}</td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(q, 'field11', data.tv)}</td>
                                                <td className="py-4 px-4 text-right text-indigo-400">{renderEditableCell(q, 'purchasesVat', data.vat)}</td>
                                                <td className="py-4 px-4 text-right font-black bg-indigo-500/5 text-indigo-100">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-indigo-900/20 font-bold border-t-2 border-gray-800">
                                        <td className="py-5 px-4 text-left font-black text-indigo-300 text-[10px] uppercase italic">Purchases Total</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatDecimalNumber(grandTotals.purchases.zero)}</td>
                                        <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatDecimalNumber(grandTotals.purchases.tv)}</td>
                                        <td className="py-5 px-4 text-right text-indigo-400">{formatDecimalNumber(grandTotals.purchases.vat)}</td>
                                        <td className="py-5 px-4 text-right text-white text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatDecimalNumber(grandTotals.purchases.total)}</td>
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
                            <button
                                onClick={handleExportStep4VAT}
                                className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400 group-hover:scale-110 transition-transform" />
                                Export Excel
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
                            <span className="flex items-center gap-1.5 text-blue-400/80"><BriefcaseIcon className="w-3.5 h-3.5" /> TYPE 3 WORKFLOW (TRIAL BALANCE)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={handleExportAll}
                        disabled={currentStep !== 9}
                        className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-colors"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All
                    </button>
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50">
                        <RefreshIcon className="w-4 h-4 mr-2" /> Start Over
                    </button>
                </div>
            </div>

            <WorkingNotesModal
                isOpen={showTbNoteModal}
                onClose={() => setShowTbNoteModal(false)}
                onSave={handleSaveTbNote}
                accountName={currentTbAccount || ''}
                baseDebit={getCurrentTbEntry().baseDebit}
                baseCredit={getCurrentTbEntry().baseCredit}
                initialNotes={currentTbAccount ? tbWorkingNotes[currentTbAccount] : []}
                currency={currency}
            />

            <Stepper currentStep={currentStep} />

            {currentStep === 1 && (
                <div className="space-y-6">
                    <OpeningBalances
                        onComplete={handleOpeningBalancesComplete}
                        currency={currency}
                        accountsData={openingBalancesData}
                        onAccountsDataChange={setOpeningBalancesData}
                        onExport={handleExportOpeningBalances}
                        selectedFiles={openingBalanceFiles}
                        onFilesSelect={setOpeningBalanceFiles}
                        onExtract={handleExtractOpeningBalances}
                        isExtracting={isExtractingOpeningBalances}
                    />
                    <div className="flex justify-start"><button onClick={onReset} className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors">Back to Dashboard</button></div>
                </div>
            )}

            {currentStep === 2 && renderAdjustTB()}

            {currentStep === 3 && (
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
                                        selectedFiles={vatFiles}
                                        onFilesSelect={setVatFiles}
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
                                onClick={handleExtractVatData}
                                disabled={vatFiles.length === 0 || isExtractingVat}
                                className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExtractingVat ? (
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
            )}

            {currentStep === 4 && renderStep4VatSummarization()}

            {currentStep === 5 && renderStep4ProfitAndLoss()}

            {currentStep === 6 && renderStep5BalanceSheet()}

            {currentStep === 7 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                                    <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white tracking-tight">Letters of Undertaking (LOU)</h3>
                                    <p className="text-gray-400 mt-1">Upload supporting LOU documents for reference.</p>
                                </div>
                            </div>
                            <button onClick={handleExportStep6} className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all transform hover:scale-105">
                                <DocumentArrowDownIcon className="w-4 h-4" /> Export
                            </button>
                        </div>

                        <FileUploadArea
                            title="Upload LOU Documents"
                            subtitle="PDF, DOCX, or Images"
                            icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                            selectedFiles={louFiles}
                            onFilesSelect={setLouFiles}
                        />

                        <div className="mt-8 flex justify-between items-center bg-[#0F172A]/50 p-6 rounded-2xl border border-gray-800/50">
                            <button onClick={handleBack} className="flex items-center px-6 py-3 text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                            <button onClick={() => setCurrentStep(8)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Proceed to Questionnaire</button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 8 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-[#0F172A]/50">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                    <QuestionMarkCircleIcon className="w-8 h-8 text-indigo-400" />
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

                        {(() => {
                            // Initialize current revenue in questionnaire state if not present
                            if (ftaFormValues && !questionnaireAnswers['curr_revenue'] && ftaFormValues.actualOperatingRevenue !== undefined) {
                                setTimeout(() => {
                                    setQuestionnaireAnswers(prev => ({
                                        ...prev,
                                        'curr_revenue': String(ftaFormValues.actualOperatingRevenue)
                                    }));
                                }, 0);
                            }
                            return null;
                        })()}

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
                                                onChange={(e) => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
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

                                                    const handleAnswerChange = (questionId: any, answer: string) => {
                                                        setQuestionnaireAnswers(prev => ({ ...prev, [questionId]: answer }));
                                                    };

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
                            <div className="flex gap-4">
                                <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all">
                                    <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                                </button>
                                <button onClick={handleExportStep7} className="flex items-center gap-2 px-6 py-3 bg-gray-800 border border-gray-700 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all transform hover:scale-105">
                                    <DocumentArrowDownIcon className="w-5 h-5" /> Export Answers
                                </button>
                            </div>
                            <button
                                onClick={() => setCurrentStep(9)}
                                disabled={Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length < CT_QUESTIONS.length}
                                className="px-10 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-xl shadow-indigo-900/30 flex items-center disabled:opacity-50 disabled:grayscale transition-all transform hover:scale-[1.02]"
                            >
                                Generate Final Report
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 9 && renderStepFinalReport()}

            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); if (newGlobalAccountName.trim()) { const newItem = { account: newGlobalAccountName.trim(), debit: 0, credit: 0 }; setAdjustedTrialBalance(prev => { if (!prev) return [newItem]; const newTb = [...prev]; const totalsIdx = newTb.findIndex(i => i.account === 'Totals'); if (totalsIdx > -1) newTb.splice(totalsIdx, 0, newItem); else newTb.push(newItem); return newTb; }); setShowGlobalAddAccountModal(false); setNewGlobalAccountName(''); } }}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Main Category</label>
                                    <select value={newGlobalAccountMain} onChange={(e) => setNewGlobalAccountMain(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" required>
                                        <option value="Assets">Assets</option><option value="Liabilities">Liabilities</option><option value="Equity">Equity</option><option value="Income">Income</option><option value="Expenses">Expenses</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Account Name</label>
                                    <input type="text" value={newGlobalAccountName} onChange={(e) => setNewGlobalAccountName(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Project Development Fees" required autoFocus />
                                </div>
                            </div>
                            <div className="p-4 bg-gray-800/50 border-t border-gray-800 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowGlobalAddAccountModal(false)} className="px-5 py-2 text-sm text-gray-400 font-bold transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl shadow-lg transition-all">Add Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
