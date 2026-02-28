

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Transaction, TrialBalanceEntry, FinancialStatements, OpeningBalanceCategory, Company } from '../types';
import {
    RefreshIcon,
    BriefcaseIcon,
    LightBulbIcon,
    ScaleIcon,
    AssetIcon,
    IncomeIcon,
    ExpenseIcon,
    EquityIcon,
    ListBulletIcon,
    InformationCircleIcon,
    IdentificationIcon,
    QuestionMarkCircleIcon,
    BuildingOfficeIcon,
    ChartBarIcon,
    CheckIcon,
    CheckCircleIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    DocumentArrowDownIcon,
    PlusIcon,
    TrashIcon,
    DocumentDuplicateIcon,
    UploadIcon,
    SparklesIcon,
    ChevronDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClipboardCheckIcon,
    DocumentTextIcon,
    ShieldCheckIcon
} from './icons';
import { useCtWorkflow } from '../hooks/useCtWorkflow';
import * as XLSX from 'xlsx';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { FileUploadArea } from './VatFilingUpload';
import {
    extractVat201Totals,
    extractOpeningBalanceDataFromFiles,
    CHART_OF_ACCOUNTS
} from '../services/geminiService';
import { ctFilingService } from '../services/ctFilingService';
import { ProfitAndLossStep, PNL_ITEMS, type ProfitAndLossItem } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS, type BalanceSheetItem } from './BalanceSheetStep';
import type { WorkingNoteEntry } from '../types';
import type { Part } from '@google/genai';
import { LoadingIndicator } from './LoadingIndicator';
import { WorkingNotesModal } from './WorkingNotesModal';


const CT_REPORTS_ACCOUNTS: Record<string, string> = {
    // Income
    'Sales Revenue – Goods': 'Income',
    'Service Revenue': 'Income',
    'Other Operating Income': 'Income',
    'Interest Income': 'Income',
    'Miscellaneous Income': 'Income',
    // Expenses
    'Cost of Goods Sold (COGS)': 'Expenses',
    'Direct Service Costs (Subcontractors, Project Costs)': 'Expenses',
    'Rent Expense': 'Expenses',
    'Utilities (Electricity, Water, Internet)': 'Expenses',
    'Office Supplies & Stationery': 'Expenses',
    'Repairs & Maintenance': 'Expenses',
    'Insurance Expense': 'Expenses',
    'Marketing & Advertising': 'Expenses',
    'Travel & Entertainment': 'Expenses',
    'Professional Fees (Legal, Audit, Consulting)': 'Expenses',
    'IT & Software Subscriptions': 'Expenses',
    'Transportation & Logistics': 'Expenses',
    'Bank Charges & Interest Expense': 'Expenses',
    'Commission Expenses': 'Expenses',
    'Salaries & Wages': 'Expenses',
    'Staff Benefits (Medical, EOSB Contributions)': 'Expenses',
    'Training & Development': 'Expenses',
    'VAT Expense (non-recoverable)': 'Expenses',
    'Corporate Tax Expense': 'Expenses',
    'Government Fees & Licenses': 'Expenses',
    'Depreciation – Furniture & Equipment': 'Expenses',
    'Depreciation – Vehicles': 'Expenses',
    'Amortization – Intangibles': 'Expenses',
    'Bad Debt Expense': 'Expenses',
    'Miscellaneous Expense': 'Expenses',
    // Assets
    'Cash on Hand': 'Assets',
    'Bank Accounts': 'Assets',
    'Accounts Receivable': 'Assets',
    'Advances to Suppliers': 'Assets',
    'Prepaid Expenses': 'Assets',
    'Inventory – Goods': 'Assets',
    'Work-in-Progress – Services': 'Assets',
    'VAT Recoverable (Input VAT)': 'Assets',
    'Furniture & Equipment': 'Assets',
    'Vehicles': 'Assets',
    'Intangibles (Software, Patents)': 'Assets',
    // Liabilities
    'Accounts Payable': 'Liabilities',
    'Accrued Expenses': 'Liabilities',
    'Advances from Customers': 'Liabilities',
    'Short-Term Loans': 'Liabilities',
    'VAT Payable (Output VAT)': 'Liabilities',
    'Corporate Tax Payable': 'Liabilities',
    'Long-Term Loans': 'Liabilities',
    'Employee End-of-Service Benefits Provision': 'Liabilities',
    // Equity
    'Share Capital / Owner’s Equity': 'Equity',
    'Retained Earnings': 'Equity',
    'Current Year Profit/Loss': 'Equity',
    'Dividends / Owner’s Drawings': 'Equity',
    "Owner's Current Account": 'Equity'
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

type AccountLookupEntry = { category: string; subCategory?: string; name: string };

type TrialBalanceUpdateAuditEntry = {
    accountCode: string;
    column: string;
    oldValue: number | null;
    newValue: number | null;
};

type TrialBalanceUpdatePreviewRow = {
    rowNumber: number;
    accountCode: string;
    ledgerName: string;
    matchedBy: 'accountCode' | 'ledgerName';
    updates: TrialBalanceUpdateAuditEntry[];
};

type TbCoaCustomTarget = {
    name: string;
    category: string;
    subCategory?: string;
};

type TbCoaCustomTargetDialogState = {
    category: string;
    subCategory?: string;
    value: string;
    error?: string;
};

type TbCoaCustomTargetDeleteDialogState = {
    name: string;
    category: string;
    subCategory?: string;
};

type TbYearImportMode = 'auto' | 'current_only' | 'previous_only';
type TbNoteYearScope = 'current' | 'previous';

type TbWorkingNoteEntry = {
    description: string;
    debit: number;
    credit: number;
    yearScope?: TbNoteYearScope;
};

const normalizeAccountName = (value?: string | null) => {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizeTbNoteYearScope = (scope?: string): TbNoteYearScope => (
    scope === 'previous' ? 'previous' : 'current'
);

const normalizeTbYearImportMode = (mode?: string): TbYearImportMode => (
    mode === 'current_only' || mode === 'previous_only' ? mode : 'auto'
);

const applyTbYearImportModeToAmounts = (
    amounts: { debit: number; credit: number; previousDebit: number; previousCredit: number },
    mode: TbYearImportMode
) => {
    const clean = (value: unknown) => {
        const num = Number(value) || 0;
        return Math.abs(num) <= 0.01 ? 0 : num;
    };
    const debit = clean(amounts.debit);
    const credit = clean(amounts.credit);
    const previousDebit = clean(amounts.previousDebit);
    const previousCredit = clean(amounts.previousCredit);

    if (mode === 'current_only') {
        const currentHasValues = Math.abs(debit) > 0.01 || Math.abs(credit) > 0.01;
        const sourceDebit = currentHasValues ? debit : previousDebit;
        const sourceCredit = currentHasValues ? credit : previousCredit;
        return {
            debit: sourceDebit,
            credit: sourceCredit,
            previousDebit: 0,
            previousCredit: 0
        };
    }

    if (mode === 'previous_only') {
        const previousHasValues = Math.abs(previousDebit) > 0.01 || Math.abs(previousCredit) > 0.01;
        const sourceDebit = previousHasValues ? previousDebit : debit;
        const sourceCredit = previousHasValues ? previousCredit : credit;
        return {
            debit: 0,
            credit: 0,
            previousDebit: sourceDebit,
            previousCredit: sourceCredit
        };
    }

    return { debit, credit, previousDebit, previousCredit };
};

const applyTbYearImportModeToEntries = (entries: TrialBalanceEntry[], mode: TbYearImportMode): TrialBalanceEntry[] => {
    if (mode === 'auto') return entries;
    return entries.map((entry) => {
        if (entry.account.toLowerCase() === 'totals') return entry;
        const adjusted = applyTbYearImportModeToAmounts({
            debit: Number(entry.debit) || 0,
            credit: Number(entry.credit) || 0,
            previousDebit: Number(entry.previousDebit) || 0,
            previousCredit: Number(entry.previousCredit) || 0
        }, mode);

        const next: TrialBalanceEntry = {
            ...entry,
            debit: adjusted.debit,
            credit: adjusted.credit,
            previousDebit: adjusted.previousDebit,
            previousCredit: adjusted.previousCredit
        };

        if (entry.baseDebit !== undefined || entry.baseCredit !== undefined || entry.basePreviousDebit !== undefined || entry.basePreviousCredit !== undefined) {
            next.baseDebit = mode === 'previous_only' ? (entry.baseDebit ?? entry.debit ?? 0) : adjusted.debit;
            next.baseCredit = mode === 'previous_only' ? (entry.baseCredit ?? entry.credit ?? 0) : adjusted.credit;
            next.basePreviousDebit = mode === 'current_only' ? (entry.basePreviousDebit ?? entry.previousDebit ?? 0) : adjusted.previousDebit;
            next.basePreviousCredit = mode === 'current_only' ? (entry.basePreviousCredit ?? entry.previousCredit ?? 0) : adjusted.previousCredit;
        }

        return next;
    });
};

const getTbWorkingNoteTotals = (notes: TbWorkingNoteEntry[] = []) => {
    return notes.reduce((acc, note) => {
        const scope = normalizeTbNoteYearScope(note?.yearScope);
        const debit = Number(note?.debit) || 0;
        const credit = Number(note?.credit) || 0;
        if (scope === 'previous') {
            acc.previousDebit += debit;
            acc.previousCredit += credit;
        } else {
            acc.currentDebit += debit;
            acc.currentCredit += credit;
        }
        return acc;
    }, { currentDebit: 0, currentCredit: 0, previousDebit: 0, previousCredit: 0 });
};

const getTbRowBaseAmounts = (item: TrialBalanceEntry, notes: TbWorkingNoteEntry[] = []) => {
    const noteTotals = getTbWorkingNoteTotals(notes);
    const currentDebit = Number(item.debit) || 0;
    const currentCredit = Number(item.credit) || 0;
    const previousDebit = Number(item.previousDebit) || 0;
    const previousCredit = Number(item.previousCredit) || 0;

    return {
        noteTotals,
        baseDebit: item.baseDebit !== undefined ? (Number(item.baseDebit) || 0) : (currentDebit - noteTotals.currentDebit),
        baseCredit: item.baseCredit !== undefined ? (Number(item.baseCredit) || 0) : (currentCredit - noteTotals.currentCredit),
        basePreviousDebit: item.basePreviousDebit !== undefined ? (Number(item.basePreviousDebit) || 0) : (previousDebit - noteTotals.previousDebit),
        basePreviousCredit: item.basePreviousCredit !== undefined ? (Number(item.basePreviousCredit) || 0) : (previousCredit - noteTotals.previousCredit)
    };
};

const buildTbTotalsRow = (entries: TrialBalanceEntry[] | null): TrialBalanceEntry => {
    const dataRows = (entries || []).filter(item => item.account.toLowerCase() !== 'totals');
    return {
        account: 'Totals',
        debit: round2(dataRows.reduce((sum, item) => sum + (Number(item.debit) || 0), 0)),
        credit: round2(dataRows.reduce((sum, item) => sum + (Number(item.credit) || 0), 0)),
        previousDebit: round2(dataRows.reduce((sum, item) => sum + (Number(item.previousDebit) || 0), 0)),
        previousCredit: round2(dataRows.reduce((sum, item) => sum + (Number(item.previousCredit) || 0), 0))
    };
};

const getTrialBalanceRowsWithComputedTotals = (entries: TrialBalanceEntry[] | null): TrialBalanceEntry[] => {
    const dataRows = (entries || []).filter(item => item.account.toLowerCase() !== 'totals');
    if (dataRows.length === 0) return [];
    return [...dataRows, buildTbTotalsRow(dataRows)];
};

const formatCoaHierarchyLabel = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2');
const createTbCoaParentTargetName = (parentLabel: string) => `Other ${parentLabel} (Grouped)`;

const ACCOUNT_LOOKUP: Record<string, AccountLookupEntry> = (() => {
    const lookup: Record<string, AccountLookupEntry> = {};
    Object.entries(CHART_OF_ACCOUNTS).forEach(([category, section]) => {
        if (Array.isArray(section)) {
            section.forEach((name) => {
                lookup[normalizeAccountName(name)] = { category, name };
            });
        } else {
            Object.entries(section).forEach(([subCategory, accounts]) => {
                (accounts as string[]).forEach((name) => {
                    lookup[normalizeAccountName(name)] = { category, subCategory, name };
                });
            });
        }
    });
    return lookup;
})();

const TB_COA_GROUP_PARENT_TARGETS = (() => {
    const categoryTargets: Record<string, string> = {};
    const subCategoryTargets: Record<string, Record<string, string>> = {};
    const lookup: Record<string, AccountLookupEntry> = {};

    Object.entries(CHART_OF_ACCOUNTS).forEach(([category, section]) => {
        const categoryTargetName = createTbCoaParentTargetName(category);
        categoryTargets[category] = categoryTargetName;

        const categoryTargetKey = normalizeAccountName(categoryTargetName);
        if (!ACCOUNT_LOOKUP[categoryTargetKey]) {
            lookup[categoryTargetKey] = { category, name: categoryTargetName };
        }

        if (!Array.isArray(section)) {
            subCategoryTargets[category] = {};
            Object.keys(section).forEach((subCategory) => {
                const subCategoryLabel = formatCoaHierarchyLabel(subCategory);
                const subCategoryTargetName = createTbCoaParentTargetName(subCategoryLabel);
                subCategoryTargets[category][subCategory] = subCategoryTargetName;

                const subCategoryTargetKey = normalizeAccountName(subCategoryTargetName);
                if (!ACCOUNT_LOOKUP[subCategoryTargetKey]) {
                    lookup[subCategoryTargetKey] = {
                        category,
                        subCategory,
                        name: subCategoryTargetName
                    };
                }
            });
        }
    });

    return { categoryTargets, subCategoryTargets, lookup };
})();

const TB_COA_GROUP_ACCOUNT_LOOKUP: Record<string, AccountLookupEntry> = {
    ...ACCOUNT_LOOKUP,
    ...TB_COA_GROUP_PARENT_TARGETS.lookup
};

const normalizeDebitCredit = (debitValue: number, creditValue: number) => {
    let debit = Number(debitValue) || 0;
    let credit = Number(creditValue) || 0;

    if (debit < 0 && credit <= 0) {
        credit = Math.abs(debit);
        debit = 0;
    } else if (credit < 0 && debit <= 0) {
        debit = Math.abs(credit);
        credit = 0;
    }

    return {
        debit: Math.abs(debit),
        credit: Math.abs(credit)
    };
};

const inferCategoryFromAccount = (accountName: string) => {
    const lower = accountName.toLowerCase();
    if (lower.includes('equity') || lower.includes('capital') || lower.includes('retained earnings') || lower.includes('drawing') || lower.includes('dividend') || lower.includes('reserve') || lower.includes('share') || lower.includes('owner s account')) {
        return 'Equity';
    }
    if (lower.includes('payable') || lower.includes('loan') || lower.includes('liability') || lower.includes('due to') || lower.includes('advance from') || lower.includes('accrual') || lower.includes('provision') || lower.includes('vat output') || lower.includes('tax payable') || lower.includes('overdraft') || lower.includes('accrued')) {
        return 'Liabilities';
    }
    if (lower.includes('expense') || lower.includes('cost') || lower.includes('salary') || lower.includes('wages') || lower.includes('rent') || lower.includes('advertising') || lower.includes('audit') || lower.includes('bank charge') || lower.includes('consulting') || lower.includes('utilities') || lower.includes('electricity') || lower.includes('water') || lower.includes('insurance') || lower.includes('repair') || lower.includes('maintenance') || lower.includes('stationery') || lower.includes('printing') || lower.includes('postage') || lower.includes('travel') || lower.includes('ticket') || lower.includes('accommodation') || lower.includes('meal') || lower.includes('entertainment') || lower.includes('depreciation') || lower.includes('amortization') || lower.includes('bad debt') || lower.includes('charity') || lower.includes('donation') || lower.includes('fine') || lower.includes('penalty') || lower.includes('freight') || lower.includes('shipping') || lower.includes('software') || lower.includes('subscription') || lower.includes('license') || lower.includes('purchase') || lower.includes('training') || lower.includes('staff benefits') || lower.includes('transportation') || lower.includes('logistics') || lower.includes('commission')) {
        return 'Expenses';
    }
    if (lower.includes('revenue') || lower.includes('income') || lower.includes('sale') || lower.includes('turnover') || lower.includes('commission') || lower.includes('fee') || lower.includes('interest income')) {
        return 'Income';
    }
    return 'Assets';
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
    customerId?: string;
    ctTypeId?: string;
    periodId?: string;
    conversionId: string | null;
    period?: { start: string; end: string } | null;
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
    if (typeof amount !== 'number' || isNaN(amount)) return '0';
    return Math.round(amount).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
};

const formatDecimalNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    return Math.round(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const formatVarianceNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    const abs = Math.abs(amount);
    if (abs >= 1000) {
        return Math.round(amount).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
    }
    return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const formatUpdateValue = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) return '-';
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const round2 = (val: number) => {
    return Math.round((val + Number.EPSILON) * 100) / 100;
};

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ["Opening Balance", "Trial Balance", "VAT Docs Upload", "VAT Summarization", "Profit & Loss", "Balance Sheet", "Tax Computation", "LOU", "Signed FS & LOU", "CT Questionnaire", "Final Report"];
    return (
        <div className="flex items-center w-full max-w-6xl mx-auto mb-8 overflow-x-auto pb-2">
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

const PNL_STRUCTURE_TYPE3 = [
    { id: 'revenue', label: 'Revenue', type: 'item' },
    { id: 'cost_of_revenue', label: 'Cost of Revenue', type: 'item' },
    { id: 'gross_profit', label: 'Gross Profit', type: 'total' },
    { id: 'administrative_expenses', label: 'Administrative Expenses', type: 'item' },
    { id: 'selling_distribution_expenses', label: 'Selling & Distribution Expenses', type: 'item' },
    { id: 'business_promotion_selling', label: 'Business Promotion & Selling', type: 'item' },
    { id: 'finance_costs', label: 'Finance Costs', type: 'item' },
    { id: 'depreciation_ppe', label: 'Depreciation (PPE)', type: 'item' },
    { id: 'foreign_exchange_loss', label: 'Foreign Exchange Gain/Loss', type: 'item' },
    { id: 'other_income', label: 'Other Income', type: 'item' },
    { id: 'profit_loss_year', label: 'Profit / (Loss) for the Year', type: 'grand_total' }
];

const BS_STRUCTURE_TYPE3 = [
    { id: 'property_plant_equipment', label: 'Property, Plant & Equipment', type: 'item' },
    { id: 'intangible_assets', label: 'Intangible Assets', type: 'item' },
    { id: 'long_term_investments', label: 'Long-term Investments', type: 'item' },
    { id: 'total_non_current_assets', label: 'Total Non-current Assets', type: 'total' },
    { id: 'cash_bank_balances', label: 'Cash & Bank Balances', type: 'item' },
    { id: 'inventories', label: 'Inventories', type: 'item' },
    { id: 'trade_receivables', label: 'Trade Receivables', type: 'item' },
    { id: 'advances_deposits_receivables', label: 'Advances, Deposits & Other Receivables', type: 'item' },
    { id: 'total_current_assets', label: 'Total Current Assets', type: 'total' },
    { id: 'total_assets', label: 'Total Assets', type: 'grand_total' },
    { id: 'share_capital', label: 'Share Capital', type: 'item' },
    { id: 'retained_earnings', label: 'Retained Earnings', type: 'item' },
    { id: 'shareholders_current_accounts', label: 'Shareholders Current Accounts', type: 'item' },
    { id: 'total_equity', label: 'Total Equity', type: 'total' },
    { id: 'employees_end_service_benefits', label: 'Employees End of Service Benefits', type: 'item' },
    { id: 'bank_borrowings_non_current', label: 'Bank Borrowings (Non-current)', type: 'item' },
    { id: 'total_non_current_liabilities', label: 'Total Non-current Liabilities', type: 'total' },
    { id: 'short_term_borrowings', label: 'Short-term Borrowings', type: 'item' },
    { id: 'trade_other_payables', label: 'Trade & Other Payables', type: 'item' },
    { id: 'related_party_transactions_liabilities', label: 'Related Party Transactions', type: 'item' },
    { id: 'total_current_liabilities', label: 'Total Current Liabilities', type: 'total' },
    { id: 'total_equity_liabilities', label: 'Total Equity & Liabilities', type: 'grand_total' }
];

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
    company,
    customerId,
    ctTypeId,
    periodId,
    conversionId,
    period
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [showSbrModal, setShowSbrModal] = useState(false);
    const isHydrated = useRef(false);
    const { workflowData, saveStep, refresh } = useCtWorkflow({ conversionId });

    const handleSaveStep = async (
        stepId: number,
        status: 'draft' | 'completed' | 'submitted' = 'completed',
        stepDataOverride?: Record<string, unknown>
    ) => {
        if (!customerId || !ctTypeId || !periodId) return;

        const stepNames: Record<number, string> = {
            1: 'opening_balances',
            2: 'adjust_trial_balance',
            3: 'additional_files',
            4: 'additional_details',
            5: 'profit_loss',
            6: 'balance_sheet',
            7: 'tax_computation',
            8: 'lou_upload',
            9: 'signed_fs_lou_upload',
            10: 'questionnaire',
            11: 'final_report'
        };

        try {
            let stepData = {};
            const stepName = stepNames[stepId] || `step_${stepId}`;
            const stepKey = `type-3_step-${stepId}_${stepName}`;
            switch (stepId) {
                case 1: stepData = { openingBalancesData, obWorkingNotes }; break;
                case 2: {
                    const latestSavedStep2 = [...(workflowData || [])]
                        .filter((step) => step.step_number === 2 && Array.isArray((step.data as any)?.adjustedTrialBalance))
                        .sort((a, b) => {
                            const ta = new Date((a.updated_at as any) || 0).getTime();
                            const tb = new Date((b.updated_at as any) || 0).getTime();
                            return tb - ta;
                        })[0];

                    const savedRows = ((latestSavedStep2?.data as any)?.adjustedTrialBalance || []) as TrialBalanceEntry[];
                    const savedByAccount = new Map<string, TrialBalanceEntry>();
                    savedRows.forEach((row) => {
                        if (!row?.account || row.account.toLowerCase() === 'totals') return;
                        savedByAccount.set(normalizeAccountName(row.account), row);
                    });

                    const persistedTrialBalance = getTrialBalanceRowsWithComputedTotals(adjustedTrialBalance).map((entry) => {
                        if (entry.account.toLowerCase() === 'totals') {
                            return {
                                ...entry,
                                debit: round2(Number(entry.debit) || 0),
                                credit: round2(Number(entry.credit) || 0),
                                previousDebit: round2(Number(entry.previousDebit) || 0),
                                previousCredit: round2(Number(entry.previousCredit) || 0),
                            };
                        }

                        const notes = tbWorkingNotes[entry.account] || [];
                        const noteTotals = getTbWorkingNoteTotals(notes);
                        const currentDebit = Number(entry.debit) || 0;
                        const currentCredit = Number(entry.credit) || 0;
                        const previousDebit = Number(entry.previousDebit) || 0;
                        const previousCredit = Number(entry.previousCredit) || 0;

                        const baseDebit = entry.baseDebit !== undefined ? (Number(entry.baseDebit) || 0) : (currentDebit - noteTotals.currentDebit);
                        const baseCredit = entry.baseCredit !== undefined ? (Number(entry.baseCredit) || 0) : (currentCredit - noteTotals.currentCredit);
                        const basePreviousDebit = entry.basePreviousDebit !== undefined ? (Number(entry.basePreviousDebit) || 0) : (previousDebit - noteTotals.previousDebit);
                        const basePreviousCredit = entry.basePreviousCredit !== undefined ? (Number(entry.basePreviousCredit) || 0) : (previousCredit - noteTotals.previousCredit);

                        const currentSideZeroed = Math.abs(currentDebit) <= 0.01 && Math.abs(currentCredit) <= 0.01;
                        const previousSideZeroed = Math.abs(previousDebit) <= 0.01 && Math.abs(previousCredit) <= 0.01;
                        const hasCurrentBase = Math.abs(baseDebit) > 0.01 || Math.abs(baseCredit) > 0.01;
                        const hasPreviousBase = Math.abs(basePreviousDebit) > 0.01 || Math.abs(basePreviousCredit) > 0.01;

                        const persistedDebit = currentSideZeroed && hasCurrentBase ? (baseDebit + noteTotals.currentDebit) : currentDebit;
                        const persistedCredit = currentSideZeroed && hasCurrentBase ? (baseCredit + noteTotals.currentCredit) : currentCredit;
                        const persistedPreviousDebit = previousSideZeroed && hasPreviousBase ? (basePreviousDebit + noteTotals.previousDebit) : previousDebit;
                        const persistedPreviousCredit = previousSideZeroed && hasPreviousBase ? (basePreviousCredit + noteTotals.previousCredit) : previousCredit;

                        const savedRow = savedByAccount.get(normalizeAccountName(entry.account));
                        const keepSavedCurrent = !hasCurrentBase && Math.abs(persistedDebit) <= 0.01 && Math.abs(persistedCredit) <= 0.01;
                        const keepSavedPrevious = !hasPreviousBase && Math.abs(persistedPreviousDebit) <= 0.01 && Math.abs(persistedPreviousCredit) <= 0.01;

                        const finalDebit = keepSavedCurrent ? (Number(savedRow?.debit) || 0) : persistedDebit;
                        const finalCredit = keepSavedCurrent ? (Number(savedRow?.credit) || 0) : persistedCredit;
                        const finalPreviousDebit = keepSavedPrevious ? (Number(savedRow?.previousDebit) || 0) : persistedPreviousDebit;
                        const finalPreviousCredit = keepSavedPrevious ? (Number(savedRow?.previousCredit) || 0) : persistedPreviousCredit;

                        return {
                            ...entry,
                            debit: round2(finalDebit),
                            credit: round2(finalCredit),
                            previousDebit: round2(finalPreviousDebit),
                            previousCredit: round2(finalPreviousCredit),
                            baseDebit: round2(baseDebit),
                            baseCredit: round2(baseCredit),
                            basePreviousDebit: round2(basePreviousDebit),
                            basePreviousCredit: round2(basePreviousCredit),
                        };
                    });

                    stepData = { adjustedTrialBalance: persistedTrialBalance, tbWorkingNotes, tbYearImportMode };
                    break;
                }
                case 3: stepData = {
                    additionalFiles: additionalFiles.map(f => ({ name: f.name, size: f.size })),
                    additionalDetails
                }; break;
                case 4: stepData = { additionalDetails }; break;
                case 5: stepData = { pnlValues, pnlWorkingNotes }; break;
                case 6: stepData = { balanceSheetValues, bsWorkingNotes }; break;
                case 7: stepData = { taxComputation: taxComputationEdits }; break;
                case 8: stepData = { louData }; break;
                case 9: stepData = { signedFsLouFiles: signedFsLouFiles.map(f => ({ name: f.name, size: f.size })) }; break;
                case 10: stepData = { questionnaireAnswers }; break;
                case 11: stepData = { reportForm }; break;
            }
            const finalStepData = stepDataOverride ? { ...stepData, ...stepDataOverride } : stepData;
            await saveStep(stepKey, stepId, finalStepData, status);
        } catch (error) {
            console.error(`Failed to save step ${stepId}:`, error);
        }
    };

    const handleContinueToTaxComp = async () => {
        await handleSaveStep(6);
        const revenue =
            Number(questionnaireAnswers['curr_revenue']) ||
            ftaFormValues?.actualOperatingRevenue ||
            Number(reportForm.actualOperatingRevenue) ||
            Number(reportForm.operatingRevenue) ||
            0;
        if (revenue < 3000000) {
            setShowSbrModal(true);
        } else {
            setCurrentStep(7);
        }
    };

    const hydrateOpeningBalancesData = (savedData: unknown): OpeningBalanceCategory[] => {
        if (!Array.isArray(savedData)) return [];
        return savedData.map((category) => {
            const typedCategory = category as Partial<OpeningBalanceCategory> & { accounts?: unknown[] };
            const seedCategory = initialAccountData.find((seed) => seed.category === typedCategory.category);

            return {
                category: typedCategory.category || seedCategory?.category || 'Assets',
                icon: seedCategory?.icon || AssetIcon,
                accounts: Array.isArray(typedCategory.accounts)
                    ? typedCategory.accounts.map((account) => {
                        const typedAccount = (account && typeof account === 'object')
                            ? (account as unknown as Record<string, unknown>)
                            : {};
                        return {
                            name: String(typedAccount.name || ''),
                            debit: Number(typedAccount.debit) || 0,
                            credit: Number(typedAccount.credit) || 0,
                        };
                    })
                    : [],
            };
        });
    };

    // Hydration useEffect
    useEffect(() => {
        if (workflowData && workflowData.length > 0) {
            let shouldRepopulateFromTbFlow = false;
            // Find max step to restore currentStep - ONLY ONCE
            if (!isHydrated.current) {
                const sortedSteps = [...workflowData].sort((a, b) => b.step_number - a.step_number);
                const latestStep = sortedSteps[0];
                if (latestStep && latestStep.step_number >= 1) {
                    setCurrentStep(latestStep.step_number === 11 ? 11 : latestStep.step_number + 1);
                }
                isHydrated.current = true;
            }

            for (const step of workflowData) {
                const sData = step.data;
                if (!sData) continue;

                switch (step.step_number) {
                    case 1:
                        if (sData.openingBalancesData) setOpeningBalancesData(hydrateOpeningBalancesData(sData.openingBalancesData));
                        if (sData.obWorkingNotes) setObWorkingNotes(sData.obWorkingNotes);
                        shouldRepopulateFromTbFlow = true;
                        break;
                    case 2:
                        if (sData.adjustedTrialBalance) setAdjustedTrialBalance(sData.adjustedTrialBalance);
                        if (sData.tbWorkingNotes) setTbWorkingNotes(sData.tbWorkingNotes);
                        if (sData.tbYearImportMode) setTbYearImportMode(normalizeTbYearImportMode(sData.tbYearImportMode));
                        shouldRepopulateFromTbFlow = true;
                        break;
                    case 3:
                        if (sData.additionalFiles) {
                            setAdditionalFiles(sData.additionalFiles.map((f: any) => new File([], f.name, { type: 'application/octet-stream' })));
                        }
                        if (sData.additionalDetails) setAdditionalDetails(sData.additionalDetails);
                        break;
                    case 4:
                        if (sData.additionalDetails) setAdditionalDetails(sData.additionalDetails);
                        break;
                    case 5:
                        if (sData.pnlValues) setPnlValues(sData.pnlValues);
                        if (sData.pnlWorkingNotes) setPnlWorkingNotes(sData.pnlWorkingNotes);
                        break;
                    case 6:
                        if (sData.balanceSheetValues) setBalanceSheetValues(sData.balanceSheetValues);
                        if (sData.bsWorkingNotes) setBsWorkingNotes(sData.bsWorkingNotes);
                        break;
                    case 7:
                        if (sData.taxComputation) {
                            setTaxComputationEdits(sData.taxComputation);
                        }
                        break;
                    case 8:
                        if (sData.louData) {
                            setLouData(sData.louData);
                        }
                        break;
                    case 9:
                        if (sData.signedFsLouFiles) {
                            setSignedFsLouFiles(sData.signedFsLouFiles.map((f: any) => new File([], f.name, { type: 'application/octet-stream' })));
                        }
                        break;
                    case 10:
                        if (sData.questionnaireAnswers) setQuestionnaireAnswers(sData.questionnaireAnswers);
                        break;
                    case 11:
                        if (sData.reportForm) setReportForm(sData.reportForm);
                        break;
                }
            }

            if (shouldRepopulateFromTbFlow) {
                setAutoPopulateTrigger(prev => prev + 1);
            }
        }
    }, [workflowData]);
    // Initialize with a deep copy to prevent global mutation of the imported constant
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(() =>
        initialAccountData.map(cat => ({
            ...cat,
            accounts: cat.accounts.map(acc => ({ ...acc }))
        }))
    );
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);
    const [summaryFileFilter] = useState('ALL');
    const allFileReconciliations: { fileName: string, currency: string }[] = [];

    // Auto-save Step 9 when reached
    useEffect(() => {
        if (currentStep === 11) {
            handleSaveStep(11);
        }
    }, [currentStep]);

    // Reset Trial Balance when back on Opening Balance step to ensure regeneration from fresh data
    useEffect(() => {
        if (currentStep === 1) {
            setAdjustedTrialBalance(null);
        }
    }, [currentStep]);
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);
    const [louFiles, setLouFiles] = useState<File[]>([]);
    const [signedFsLouFiles, setSignedFsLouFiles] = useState<File[]>([]);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState<string>('');
    const [extractionAlert, setExtractionAlert] = useState<{ type: 'error' | 'warning' | 'success', message: string } | null>(null);
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [showVatConfirm, setShowVatConfirm] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);


    // Working Notes State
    const [obWorkingNotes, setObWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [tbWorkingNotes, setTbWorkingNotes] = useState<Record<string, TbWorkingNoteEntry[]>>({});
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});

    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');
    const [reportForm, setReportForm] = useState<any>({});
    const [louData, setLouData] = useState({
        place: 'DUBAI',
        date: new Date().toISOString().split('T')[0],
        to: 'The VAT Consultant LLC',
        subject: 'Management Representation regarding Corporate Tax Computation and Filing',
        taxablePerson: reportForm.taxableNameEn || companyName || '',
        taxPeriod: `FOR THE PERIOD FROM ${period?.start || reportForm.periodFrom || '-'} TO ${period?.end || reportForm.periodTo || '-'}`,
        trn: company?.corporateTaxTrn || company?.trn || '',
        content: `We, the Management of ${reportForm.taxableNameEn || companyName || '[Company Name]'}, confirm that the Financial Statements (Trial Balance/Statement of Profit or Loss and Balance Sheet) provided for this Corporate Tax filing have been prepared by us in accordance with applicable accounting standards. We declare that these statements are true and complete, despite not being externally audited. We acknowledge that The VAT Consultant LLC has prepared the tax return based on these management accounts without independent verification. We accept full responsibility for the accuracy of these figures and for providing any supporting evidence requested by the FTA.`,
        signatoryName: '',
        designation: ''
    });
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
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('PDF Download error:', error);
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

            const normalizePdfValue = (value: unknown) => {
                if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
                if (typeof value === 'string') {
                    const parsed = parseTrialBalanceNumberFlexible(value);
                    if (parsed.isValid) return Math.round(parsed.value);
                }
                const fallback = Number(value);
                if (!Number.isFinite(fallback)) return 0;
                return Math.round(fallback);
            };

            const readPdfYearPair = (
                source: Record<string, any>,
                id: string
            ): { currentYear: number; previousYear: number } => {
                const raw = source?.[id];
                if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                    return {
                        currentYear: normalizePdfValue(
                            raw.currentYear ?? raw.current ?? raw.cy ?? raw.amount ?? raw.value ?? 0
                        ),
                        previousYear: normalizePdfValue(
                            raw.previousYear ?? raw.previous ?? raw.py ?? 0
                        )
                    };
                }

                // Legacy payload fallback: single numeric value treated as current year.
                return {
                    currentYear: normalizePdfValue(raw),
                    previousYear: 0
                };
            };

            const mapPdfRowType = (type?: string) => (
                type === 'grand_total' ? 'total' : type
            );
            const normalizeYearPair = (pair?: { currentYear: number; previousYear: number }) => ({
                currentYear: normalizePdfValue(pair?.currentYear ?? 0),
                previousYear: normalizePdfValue(pair?.previousYear ?? 0)
            });
            const hasNonZeroValue = (pair?: { currentYear: number; previousYear: number }) => {
                const normalized = normalizeYearPair(pair);
                return normalized.currentYear !== 0 || normalized.previousYear !== 0;
            };
            const isNumericRowType = (type?: string) =>
                type === 'item' || type === 'total' || type === 'grand_total';

            const sourcePnlStructure: Array<{ id: string; label: string; type?: string }> = (pnlStructure.length ? pnlStructure : PNL_ITEMS).map((item: any) => ({
                id: item.id,
                label: item.label ?? '',
                type: item.type
            }));
            const sourceBsStructure: Array<{ id: string; label: string; type?: string }> = (bsStructure.length ? bsStructure : BS_ITEMS).map((item: any) => ({
                id: item.id,
                label: item.label ?? '',
                type: item.type
            }));

            const pnlValuesRaw = sourcePnlStructure.reduce((acc, item) => {
                acc[item.id] = readPdfYearPair(pnlValues as Record<string, any>, item.id);
                return acc;
            }, {} as Record<string, { currentYear: number; previousYear: number }>);

            const filterPdfStructureByValues = (
                rows: Array<{ id: string; label: string; type?: string }>,
                values: Record<string, { currentYear: number; previousYear: number }>,
                secondaryHeaderType: 'subheader' | 'subsection_header',
                alwaysKeepNumericRowIds?: Set<string>
            ) => {
                const shouldKeepRow = (item: { id: string; type?: string }, idx: number, allRows: { id: string; type?: string }[]) => {
                    if (isNumericRowType(item.type)) {
                        if (alwaysKeepNumericRowIds?.has(item.id)) return true;
                        return hasNonZeroValue(values[item.id]);
                    }

                    if (item.type === 'header' || item.type === secondaryHeaderType) {
                        const boundaryIdx = allRows.findIndex((next, nextIdx) => {
                            if (nextIdx <= idx) return false;
                            if (item.type === 'header') return next.type === 'header';
                            return next.type === 'header' || next.type === secondaryHeaderType;
                        });
                        const end = boundaryIdx >= 0 ? boundaryIdx : allRows.length;
                        return allRows.slice(idx + 1, end).some(next =>
                            isNumericRowType(next.type) && hasNonZeroValue(values[next.id])
                        );
                    }

                    return true;
                };

                return rows.filter((item, idx, allRows) => shouldKeepRow(item, idx, allRows));
            };

            let filteredPnlStructure = filterPdfStructureByValues(sourcePnlStructure, pnlValuesRaw, 'subsection_header');

            const grossProfitValue = pnlValuesRaw['gross_profit'];
            if (hasNonZeroValue(grossProfitValue)) {
                const grossTemplate = sourcePnlStructure.find(item => item.id === 'gross_profit') || {
                    id: 'gross_profit',
                    label: 'Gross profit',
                    type: 'total'
                };
                const profitIdx = filteredPnlStructure.findIndex(item => item.id === 'profit_loss_year');
                const grossIdx = filteredPnlStructure.findIndex(item => item.id === 'gross_profit');

                if (grossIdx === -1) {
                    const insertAt = profitIdx >= 0 ? profitIdx : filteredPnlStructure.length;
                    filteredPnlStructure.splice(insertAt, 0, grossTemplate);
                } else if (profitIdx >= 0 && grossIdx > profitIdx) {
                    const [grossRow] = filteredPnlStructure.splice(grossIdx, 1);
                    filteredPnlStructure.splice(profitIdx, 0, grossRow);
                }
            }

            const pnlStructureForPdf = filteredPnlStructure.map(item => ({
                id: item.id,
                label: item.label,
                type: mapPdfRowType(item.type)
            }));

            const pnlValuesForPdf = pnlStructureForPdf.reduce((acc, item) => {
                acc[item.id] = normalizeYearPair(pnlValuesRaw[item.id]);
                return acc;
            }, {} as Record<string, { currentYear: number; previousYear: number }>);

            const bsValuesRaw = sourceBsStructure.reduce((acc, item) => {
                acc[item.id] = readPdfYearPair(balanceSheetValues as Record<string, any>, item.id);
                return acc;
            }, {} as Record<string, { currentYear: number; previousYear: number }>);

            const bsEquityAlwaysKeepIds = (() => {
                const ids = new Set<string>();
                let inEquity = false;

                sourceBsStructure.forEach((row) => {
                    const isEquityHeader = row.id === 'equity_header' || row.label?.trim().toLowerCase() === 'equity';
                    if (isEquityHeader) inEquity = true;

                    if (inEquity && isNumericRowType(row.type)) ids.add(row.id);

                    if (
                        inEquity &&
                        !isEquityHeader &&
                        (row.type === 'subheader' || row.type === 'header')
                    ) {
                        inEquity = false;
                    }
                });

                return ids;
            })();

            const filteredBsStructure = filterPdfStructureByValues(
                sourceBsStructure,
                bsValuesRaw,
                'subheader',
                bsEquityAlwaysKeepIds
            );

            const bsStructureForPdf = filteredBsStructure.map(item => ({
                id: item.id,
                label: item.label,
                type: mapPdfRowType(item.type)
            }));

            const bsValuesForPdf = bsStructureForPdf.reduce((acc, item) => {
                acc[item.id] = normalizeYearPair(bsValuesRaw[item.id]);
                return acc;
            }, {} as Record<string, { currentYear: number; previousYear: number }>);

            const blob = await ctFilingService.downloadPdf({
                companyName: reportForm.taxableNameEn || companyName,
                period: `FOR THE PERIOD FROM ${period?.start || reportForm.periodFrom || '-'} TO ${period?.end || reportForm.periodTo || '-'}`,
                pnlStructure: pnlStructureForPdf,
                pnlValues: pnlValuesForPdf,
                bsStructure: bsStructureForPdf,
                bsValues: bsValuesForPdf,
                location: locationText,
                pnlWorkingNotes,
                bsWorkingNotes
            });

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `CT_Filing_Report_${companyName.replace(/\s+/g, '_')}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Financial statements PDF download error:', error);
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
    const [taxComputationEdits, setTaxComputationEdits] = useState<Record<string, number>>({});

    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [pnlStructure, setPnlStructure] = useState<ProfitAndLossItem[]>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<BalanceSheetItem[]>(BS_ITEMS);

    // Safety: recover default report structures if a corrupted state leaves them empty.
    useEffect(() => {
        if (pnlStructure.length === 0) {
            setPnlStructure(PNL_ITEMS.map(item => ({ ...item })));
        }
        if (bsStructure.length === 0) {
            setBsStructure(BS_ITEMS.map(item => ({ ...item })));
        }
    }, [pnlStructure, bsStructure]);

    const [showTbNoteModal, setShowTbNoteModal] = useState(false);
    const [currentTbAccount, setCurrentTbAccount] = useState<string | null>(null);
    const [tbGroupExtractedRowsToNotes, setTbGroupExtractedRowsToNotes] = useState(true);
    const [tbYearImportMode, setTbYearImportMode] = useState<TbYearImportMode>('auto');
    const [tbSelectedAccounts, setTbSelectedAccounts] = useState<Record<string, boolean>>({});
    const [showTbCoaGroupModal, setShowTbCoaGroupModal] = useState(false);
    const [tbCoaSearch, setTbCoaSearch] = useState('');
    const [tbCoaTargetAccount, setTbCoaTargetAccount] = useState<string>('Bank Accounts');
    const [tbCoaCustomTargets, setTbCoaCustomTargets] = useState<TbCoaCustomTarget[]>([]);
    const [tbCoaCustomTargetDialog, setTbCoaCustomTargetDialog] = useState<TbCoaCustomTargetDialogState | null>(null);
    const [tbCoaCustomTargetDeleteDialog, setTbCoaCustomTargetDeleteDialog] = useState<TbCoaCustomTargetDeleteDialogState | null>(null);

    type TbExcelMapping = {
        account: number | null;
        category: number | null;
        debit: number | null;
        credit: number | null;
        previousDebit: number | null;
        previousCredit: number | null;
    };

    const tbFileInputRef = useRef<HTMLInputElement>(null);
    const tbExcelInputRef = useRef<HTMLInputElement>(null);
    const lastSavedStep2SnapshotRef = useRef('');
    const [autoPopulateTrigger, setAutoPopulateTrigger] = useState(0);
    const [showTbExcelModal, setShowTbExcelModal] = useState(false);
    const [tbExcelFile, setTbExcelFile] = useState<File | null>(null);
    const [tbExcelSheetNames, setTbExcelSheetNames] = useState<string[]>([]);
    const [tbExcelSheetName, setTbExcelSheetName] = useState<string>('');
    const [tbExcelHeaders, setTbExcelHeaders] = useState<string[]>([]);
    const [tbExcelRows, setTbExcelRows] = useState<unknown[][]>([]);
    const [tbExcelMapping, setTbExcelMapping] = useState<TbExcelMapping>({
        account: null,
        category: null,
        debit: null,
        credit: null,
        previousDebit: null,
        previousCredit: null
    });
    const tbUpdateExcelInputRef = useRef<HTMLInputElement>(null);
    const tbUpdateJsonInputRef = useRef<HTMLInputElement>(null);
    const [showTbUpdateModal, setShowTbUpdateModal] = useState(false);
    const [tbUpdateExcelFile, setTbUpdateExcelFile] = useState<File | null>(null);
    const [tbUpdateJsonFile, setTbUpdateJsonFile] = useState<File | null>(null);
    const [tbUpdateJsonLabel, setTbUpdateJsonLabel] = useState('');
    const [tbUpdateJsonData, setTbUpdateJsonData] = useState<any>(null);
    const [tbUpdateSheetNames, setTbUpdateSheetNames] = useState<string[]>([]);
    const [tbUpdateSheetName, setTbUpdateSheetName] = useState('');
    const [tbUpdatePreview, setTbUpdatePreview] = useState<TrialBalanceUpdatePreviewRow[]>([]);
    const [tbUpdateAuditLog, setTbUpdateAuditLog] = useState<TrialBalanceUpdateAuditEntry[]>([]);
    const [tbUpdateStats, setTbUpdateStats] = useState<{ matchedRows: number; updatedCells: number; sheetName: string }>({
        matchedRows: 0,
        updatedCells: 0,
        sheetName: ''
    });
    const [tbUpdateLoading, setTbUpdateLoading] = useState(false);
    const [tbUpdateError, setTbUpdateError] = useState<string | null>(null);

    // Debounced auto-save for Step 2 to persist CY + PY TB data immediately after imports/edits.
    useEffect(() => {
        if (currentStep !== 2 || !adjustedTrialBalance || adjustedTrialBalance.length === 0) return;

        const snapshot = JSON.stringify({
            adjustedTrialBalance: getTrialBalanceRowsWithComputedTotals(adjustedTrialBalance),
            tbWorkingNotes,
            tbYearImportMode
        });

        if (snapshot === lastSavedStep2SnapshotRef.current) return;

        const timer = setTimeout(async () => {
            try {
                await handleSaveStep(2, 'draft');
                lastSavedStep2SnapshotRef.current = snapshot;
            } catch (error) {
                console.error('Auto-save failed for Step 2:', error);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [currentStep, adjustedTrialBalance, tbWorkingNotes, tbYearImportMode, handleSaveStep]);

    // VAT Step Data Calculation (mirrors Type 1 flow)
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

    // Bank VAT Data placeholder (Type 3 has no transaction-level data)
    const bankVatData = useMemo(() => ({
        grandTotals: { sales: 0, purchases: 0 }
    }), []);

    type YearKey = 'currentYear' | 'previousYear';

    const normalizeTrialBalanceEntries = (entries: TrialBalanceEntry[] | null): TrialBalanceEntry[] => {
        if (!entries) return [];
        return entries.filter(e => e.account.toLowerCase() !== 'totals');
    };

    const getTrialBalanceEntriesForYear = (entries: TrialBalanceEntry[] | null, yearKey: YearKey): TrialBalanceEntry[] => {
        return normalizeTrialBalanceEntries(entries).map((entry) => ({
            ...entry,
            debit: yearKey === 'previousYear' ? (Number(entry.previousDebit) || 0) : (Number(entry.debit) || 0),
            credit: yearKey === 'previousYear' ? (Number(entry.previousCredit) || 0) : (Number(entry.credit) || 0)
        }));
    };

    const openingBalancesToTrialBalance = (data: OpeningBalanceCategory[]): TrialBalanceEntry[] => {
        const entries: TrialBalanceEntry[] = [];
        data.forEach(cat => {
            cat.accounts.forEach(acc => {
                entries.push({
                    account: acc.name,
                    debit: Number(acc.debit) || 0,
                    credit: Number(acc.credit) || 0,
                    category: cat.category
                });
            });
        });
        return entries;
    };

    const mergeYearValues = (
        currentValues: Record<string, { currentYear: number; previousYear: number }>,
        previousValues: Record<string, { currentYear: number; previousYear: number }>
    ) => {
        const merged: Record<string, { currentYear: number; previousYear: number }> = {};
        const keys = new Set([...Object.keys(currentValues), ...Object.keys(previousValues)]);
        keys.forEach(key => {
            merged[key] = {
                currentYear: currentValues[key]?.currentYear || 0,
                previousYear: previousValues[key]?.previousYear || 0
            };
        });
        return merged;
    };

    const mergeNotesByDescription = (
        currentNotes: Record<string, WorkingNoteEntry[]>,
        previousNotes: Record<string, WorkingNoteEntry[]>
    ) => {
        const merged: Record<string, WorkingNoteEntry[]> = {};
        const keys = new Set([...Object.keys(currentNotes), ...Object.keys(previousNotes)]);

        keys.forEach(key => {
            const byDesc: Record<string, WorkingNoteEntry> = {};

            (currentNotes[key] || []).forEach(note => {
                const desc = (note.description || '').trim();
                if (!byDesc[desc]) byDesc[desc] = { description: desc, currentYearAmount: 0, previousYearAmount: 0, amount: 0 };
                byDesc[desc].currentYearAmount = (byDesc[desc].currentYearAmount || 0) + (note.currentYearAmount ?? note.amount ?? 0);
                byDesc[desc].amount = byDesc[desc].currentYearAmount || 0;
            });

            (previousNotes[key] || []).forEach(note => {
                const desc = (note.description || '').trim();
                if (!byDesc[desc]) byDesc[desc] = { description: desc, currentYearAmount: 0, previousYearAmount: 0, amount: 0 };
                byDesc[desc].previousYearAmount = (byDesc[desc].previousYearAmount || 0) + (note.previousYearAmount ?? 0);
            });

            merged[key] = Object.values(byDesc).filter(n =>
                (n.currentYearAmount || 0) !== 0 || (n.previousYearAmount || 0) !== 0 || (n.description || '').trim() !== ''
            );
        });

        return merged;
    };

    const mapEntriesToPnl = (entries: TrialBalanceEntry[], yearKey: YearKey) => {
        const pnlMapping: Record<string, { currentYear: number; previousYear: number }> = {};
        const pnlNotes: Record<string, WorkingNoteEntry[]> = {};

        const addNote = (key: string, description: string, amount: number) => {
            if (!pnlNotes[key]) pnlNotes[key] = [];
            pnlNotes[key].push({
                description,
                currentYearAmount: yearKey === 'currentYear' ? amount : 0,
                previousYearAmount: yearKey === 'previousYear' ? amount : 0,
                amount: yearKey === 'currentYear' ? amount : 0,
                currency: 'AED'
            });
        };

        entries.forEach(entry => {
            const accountLower = entry.account.toLowerCase();
            const normalizedCategory = normalizeOpeningBalanceCategory(entry.category) || inferCategoryFromAccount(entry.account);
            const netAmount = round2(entry.credit - entry.debit);
            const absAmount = round2(Math.abs(netAmount));
            if (absAmount === 0) return;
            let matched = false;

            const pushValue = (key: string) => {
                matched = true;
                pnlMapping[key] = {
                    currentYear: round2((pnlMapping[key]?.currentYear || 0) + (yearKey === 'currentYear' ? absAmount : 0)),
                    previousYear: round2((pnlMapping[key]?.previousYear || 0) + (yearKey === 'previousYear' ? absAmount : 0))
                };
                addNote(key, entry.account, absAmount);
            };

            if (accountLower.includes('sales') || accountLower.includes('service revenue') ||
                accountLower.includes('commission') || accountLower.includes('rent revenue') ||
                accountLower.includes('interest income') || (accountLower.includes('revenue') && !accountLower.includes('cost'))) {
                pushValue('revenue');
            } else if (accountLower.includes('cogs') || accountLower.includes('cost of goods') ||
                accountLower.includes('raw material') || accountLower.includes('direct labor') ||
                accountLower.includes('factory overhead') || accountLower.includes('freight inward') ||
                accountLower.includes('carriage inward') || accountLower.includes('direct cost') ||
                accountLower.includes('purchase')) {
                pushValue('cost_of_revenue');
            } else if (accountLower.includes('gain on disposal') || accountLower.includes('dividend received') ||
                accountLower.includes('discount received') || accountLower.includes('bad debts recovered') ||
                accountLower.includes('other income') || accountLower.includes('miscellaneous income')) {
                pushValue('other_income');
            } else if (accountLower.includes('unrealised') || accountLower.includes('fvtpl') || accountLower.includes('fair value')) {
                pushValue('unrealised_gain_loss_fvtpl');
            } else if (accountLower.includes('share of profit') || accountLower.includes('associate')) {
                pushValue('share_profits_associates');
            } else if (accountLower.includes('revaluation') && (accountLower.includes('property') || accountLower.includes('investment'))) {
                pushValue('gain_loss_revaluation_property');
            } else if (accountLower.includes('impairment') && (accountLower.includes('equip') || accountLower.includes('machin') || accountLower.includes('land') || accountLower.includes('build'))) {
                pushValue('impairment_losses_ppe');
            } else if (accountLower.includes('impairment') && (accountLower.includes('goodwill') || accountLower.includes('patent') || accountLower.includes('trademark'))) {
                pushValue('impairment_losses_intangible');
            } else if (accountLower.includes('advertising') || accountLower.includes('marketing') ||
                accountLower.includes('sales commission') || accountLower.includes('delivery') ||
                accountLower.includes('freight outward') || accountLower.includes('travel') ||
                accountLower.includes('entertainment') || accountLower.includes('business promotion')) {
                pushValue('business_promotion_selling');
            } else if (accountLower.includes('foreign exchange') || accountLower.includes('exchange rate') || accountLower.includes('forex')) {
                pushValue('foreign_exchange_loss');
            } else if (accountLower.includes('sales staff') || accountLower.includes('warehouse rent') ||
                accountLower.includes('packaging') || accountLower.includes('shipping') || accountLower.includes('distribution')) {
                pushValue('selling_distribution_expenses');
            } else if (accountLower.includes('office rent') || accountLower.includes('utility') ||
                accountLower.includes('electricity') || accountLower.includes('water') ||
                accountLower.includes('office supplie') || accountLower.includes('legal fee') ||
                accountLower.includes('accounting fee') || accountLower.includes('admin salar') ||
                accountLower.includes('insurance') || accountLower.includes('general expense') ||
                accountLower.includes('admin') || accountLower.includes('stationery') ||
                accountLower.includes('repair') || accountLower.includes('subscription') ||
                accountLower.includes('license') || accountLower.includes('professional') ||
                accountLower.includes('fee')) {
                pushValue('administrative_expenses');
            } else if (accountLower.includes('interest expense') || accountLower.includes('bank charge') ||
                accountLower.includes('loan interest') || accountLower.includes('finance cost')) {
                pushValue('finance_costs');
            } else if (accountLower.includes('salary') || accountLower.includes('wage') ||
                accountLower.includes('personnel') || accountLower.includes('staff') ||
                accountLower.includes('rental') || accountLower.includes('maintenance') ||
                accountLower.includes('energy') || accountLower.includes('fuel') ||
                accountLower.includes('parking') || accountLower.includes('postal') ||
                accountLower.includes('postage') || accountLower.includes('courier') ||
                accountLower.includes('telecom') || accountLower.includes('telecommunication') ||
                accountLower.includes('telephone') || accountLower.includes('internet')) {
                pushValue('administrative_expenses');
            } else if (accountLower.includes('amort')) {
                pushValue('depreciation_ppe');
            } else if (accountLower.includes('depreciation')) {
                pushValue('depreciation_ppe');
            }

            if (!matched && normalizedCategory === 'Income') {
                if (accountLower.includes('interest') || accountLower.includes('dividend') ||
                    accountLower.includes('discount') || accountLower.includes('gain') ||
                    accountLower.includes('misc') || accountLower.includes('other')) {
                    pushValue('other_income');
                } else {
                    pushValue('revenue');
                }
            } else if (!matched && normalizedCategory === 'Expenses') {
                if (accountLower.includes('depreciation') || accountLower.includes('amort')) {
                    pushValue('depreciation_ppe');
                } else if (accountLower.includes('interest') || accountLower.includes('bank charge') || accountLower.includes('finance')) {
                    pushValue('finance_costs');
                } else {
                    pushValue('administrative_expenses');
                }
            }
        });

        const getYearVal = (key: string, year: YearKey) => pnlMapping[key]?.[year] || 0;
        const revenue = getYearVal('revenue', yearKey);
        const costOfRevenue = getYearVal('cost_of_revenue', yearKey);
        const otherIncome = getYearVal('other_income', yearKey);
        const unrealised = getYearVal('unrealised_gain_loss_fvtpl', yearKey);
        const shareProfits = getYearVal('share_profits_associates', yearKey);
        const revaluation = getYearVal('gain_loss_revaluation_property', yearKey);
        const impairmentPpe = getYearVal('impairment_losses_ppe', yearKey);
        const impairmentInt = getYearVal('impairment_losses_intangible', yearKey);
        const businessPromotion = getYearVal('business_promotion_selling', yearKey);
        const forexLoss = getYearVal('foreign_exchange_loss', yearKey);
        const sellingDist = getYearVal('selling_distribution_expenses', yearKey);
        const admin = getYearVal('administrative_expenses', yearKey);
        const financeCosts = getYearVal('finance_costs', yearKey);
        const depreciation = getYearVal('depreciation_ppe', yearKey);

        const totalIncome = round2(revenue + otherIncome + unrealised + shareProfits + revaluation);
        const totalExpenses = round2(costOfRevenue + impairmentPpe + impairmentInt + businessPromotion + forexLoss + sellingDist + admin + financeCosts + depreciation);
        const grossProfit = round2(revenue - costOfRevenue);
        const profitLossYear = round2(totalIncome - totalExpenses);

        pnlMapping['gross_profit'] = {
            currentYear: yearKey === 'currentYear' ? grossProfit : (pnlMapping['gross_profit']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? grossProfit : (pnlMapping['gross_profit']?.previousYear || 0)
        };
        pnlMapping['profit_loss_year'] = {
            currentYear: yearKey === 'currentYear' ? profitLossYear : (pnlMapping['profit_loss_year']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? profitLossYear : (pnlMapping['profit_loss_year']?.previousYear || 0)
        };
        pnlMapping['total_comprehensive_income'] = {
            currentYear: yearKey === 'currentYear' ? profitLossYear : (pnlMapping['total_comprehensive_income']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? profitLossYear : (pnlMapping['total_comprehensive_income']?.previousYear || 0)
        };
        pnlMapping['profit_after_tax'] = {
            currentYear: yearKey === 'currentYear' ? profitLossYear : (pnlMapping['profit_after_tax']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? profitLossYear : (pnlMapping['profit_after_tax']?.previousYear || 0)
        };

        return { values: pnlMapping, notes: pnlNotes };
    };

    const mapEntriesToBalanceSheet = (entries: TrialBalanceEntry[], yearKey: YearKey) => {
        const bsMapping: Record<string, { currentYear: number; previousYear: number }> = {};
        const bsNotes: Record<string, WorkingNoteEntry[]> = {};

        const addNote = (key: string, description: string, amount: number) => {
            if (!bsNotes[key]) bsNotes[key] = [];
            bsNotes[key].push({
                description,
                currentYearAmount: yearKey === 'currentYear' ? amount : 0,
                previousYearAmount: yearKey === 'previousYear' ? amount : 0,
                amount: yearKey === 'currentYear' ? amount : 0,
                currency: 'AED'
            });
        };

        entries.forEach(entry => {
            const accountLower = entry.account.toLowerCase();
            const normalizedCategory = normalizeOpeningBalanceCategory(entry.category) || inferCategoryFromAccount(entry.account);
            const debitAmount = entry.debit;
            const creditAmount = entry.credit;
            let matched = false;

            const pushValue = (key: string, val: number) => {
                const rounded = round2(val);
                matched = true;
                bsMapping[key] = {
                    currentYear: round2((bsMapping[key]?.currentYear || 0) + (yearKey === 'currentYear' ? rounded : 0)),
                    previousYear: round2((bsMapping[key]?.previousYear || 0) + (yearKey === 'previousYear' ? rounded : 0))
                };
                if (rounded !== 0) addNote(key, entry.account, rounded);
            };

            if (accountLower.includes('cash') || accountLower.includes('bank')) {
                const val = debitAmount - creditAmount;
                pushValue('cash_bank_balances', val);
            } else if (accountLower.includes('accounts receivable') || accountLower.includes('debtor') ||
                accountLower.includes('bills receivable') || accountLower.includes('receivable')) {
                const val = debitAmount - creditAmount;
                pushValue('trade_receivables', val);
            } else if (accountLower.includes('inventory') || accountLower.includes('stock')) {
                const val = debitAmount - creditAmount;
                pushValue('inventories', val);
            } else if (accountLower.includes('prepaid') || accountLower.includes('advance') ||
                accountLower.includes('deposit') || (accountLower.includes('office supplies') && debitAmount > 0)) {
                const val = debitAmount - creditAmount;
                pushValue('advances_deposits_receivables', val);
            } else if (accountLower.includes('marketable securit')) {
                const val = debitAmount - creditAmount;
                pushValue('advances_deposits_receivables', val);
            } else if (accountLower.includes('property') || accountLower.includes('plant') ||
                accountLower.includes('equipment') || accountLower.includes('vehicle') || accountLower.includes('ppe')) {
                const val = debitAmount - creditAmount;
                pushValue('property_plant_equipment', val);
            } else if (accountLower.includes('intangible') || accountLower.includes('goodwill') ||
                accountLower.includes('patent') || accountLower.includes('trademark')) {
                const val = debitAmount - creditAmount;
                pushValue('intangible_assets', val);
            } else if (accountLower.includes('investment') || accountLower.includes('financial asset')) {
                const val = debitAmount - creditAmount;
                pushValue('long_term_investments', val);
            } else if (accountLower.includes('other asset')) {
                const val = debitAmount - creditAmount;
                pushValue('other_non_current_assets', val);
            } else if (accountLower.includes('accounts payable') || accountLower.includes('creditor') ||
                accountLower.includes('payable')) {
                const val = creditAmount - debitAmount;
                pushValue('trade_other_payables', val);
            } else if (accountLower.includes('due to') || accountLower.includes('related party')) {
                const val = creditAmount - debitAmount;
                pushValue('related_party_transactions_liabilities', val);
            } else if (accountLower.includes('accrued') || accountLower.includes('accrual')) {
                const val = creditAmount - debitAmount;
                pushValue('trade_other_payables', val);
            } else if (accountLower.includes('advance from') || accountLower.includes('customer advance')) {
                const val = creditAmount - debitAmount;
                pushValue('trade_other_payables', val);
            } else if (accountLower.includes('short-term loan') || accountLower.includes('overdraft') || accountLower.includes('bank loan')) {
                const val = creditAmount - debitAmount;
                pushValue('short_term_borrowings', val);
            } else if (accountLower.includes('vat payable') || accountLower.includes('output vat') || accountLower.includes('tax payable')) {
                const val = creditAmount - debitAmount;
                pushValue('trade_other_payables', val);
            } else if (accountLower.includes('long-term loan') || accountLower.includes('long term loan') || accountLower.includes('non current loan') || accountLower.includes('long term borrowing')) {
                const val = creditAmount - debitAmount;
                pushValue('bank_borrowings_non_current', val);
            } else if (accountLower.includes('end of service') || accountLower.includes('gratuity') || accountLower.includes('provision')) {
                const val = creditAmount - debitAmount;
                pushValue('employees_end_service_benefits', val);
            } else if (accountLower.includes('share capital') || accountLower.includes('capital') || accountLower.includes('equity')) {
                const val = creditAmount - debitAmount;
                pushValue('share_capital', val);
            } else if (accountLower.includes('retained earning') || accountLower.includes('retained earnings')) {
                const val = creditAmount - debitAmount;
                pushValue('retained_earnings', val);
            } else if (accountLower.includes('drawing') || accountLower.includes('dividend')) {
                const val = creditAmount - debitAmount;
                pushValue('shareholders_current_accounts', val);
            }

            if (!matched) {
                if (normalizedCategory === 'Assets') {
                    const val = debitAmount - creditAmount;
                    if (Math.abs(val) > 0.01) pushValue('other_non_current_assets', val);
                } else if (normalizedCategory === 'Liabilities') {
                    const val = creditAmount - debitAmount;
                    if (Math.abs(val) > 0.01) {
                        if (accountLower.includes('loan') || accountLower.includes('borrow') || accountLower.includes('term')) {
                            pushValue('bank_borrowings_non_current', val);
                        } else if (accountLower.includes('related')) {
                            pushValue('related_party_transactions_liabilities', val);
                        } else {
                            pushValue('trade_other_payables', val);
                        }
                    }
                } else if (normalizedCategory === 'Equity') {
                    const val = creditAmount - debitAmount;
                    if (Math.abs(val) > 0.01) {
                        if (accountLower.includes('retained') || accountLower.includes('reserve') || accountLower.includes('profit') || accountLower.includes('loss')) {
                            pushValue('retained_earnings', val);
                        } else if (accountLower.includes('drawing') || accountLower.includes('dividend') || accountLower.includes('current account')) {
                            pushValue('shareholders_current_accounts', val);
                        } else {
                            pushValue('share_capital', val);
                        }
                    }
                }
            }
        });

        const yearVal = (key: string) => bsMapping[key]?.[yearKey] || 0;
        const totalNonCurrentAssets = round2(yearVal('property_plant_equipment') + yearVal('intangible_assets') + yearVal('long_term_investments'));
        const totalCurrentAssets = round2(yearVal('cash_bank_balances') + yearVal('inventories') + yearVal('trade_receivables') + yearVal('advances_deposits_receivables') + yearVal('related_party_transactions_assets'));
        const totalAssets = round2(totalNonCurrentAssets + totalCurrentAssets);

        let totalEquity = round2(yearVal('share_capital') + yearVal('statutory_reserve') + yearVal('retained_earnings') + yearVal('shareholders_current_accounts'));
        const totalNonCurrentLiabilities = round2(yearVal('employees_end_service_benefits') + yearVal('bank_borrowings_non_current'));
        const totalCurrentLiabilities = round2(yearVal('short_term_borrowings') + yearVal('related_party_transactions_liabilities') + yearVal('trade_other_payables'));
        const totalLiabilities = round2(totalNonCurrentLiabilities + totalCurrentLiabilities);
        let totalEquityLiabilities = round2(totalEquity + totalLiabilities);

        const balanceDiff = round2(totalAssets - totalEquityLiabilities);
        if (Math.abs(balanceDiff) > 0.01) {
            const adjustedRetained = round2(yearVal('retained_earnings') + balanceDiff);
            bsMapping['retained_earnings'] = {
                currentYear: yearKey === 'currentYear' ? adjustedRetained : (bsMapping['retained_earnings']?.currentYear || 0),
                previousYear: yearKey === 'previousYear' ? adjustedRetained : (bsMapping['retained_earnings']?.previousYear || 0)
            };
            addNote('retained_earnings', 'Auto balance adjustment', balanceDiff);
            totalEquity = round2(totalEquity + balanceDiff);
            totalEquityLiabilities = round2(totalEquity + totalLiabilities);
        }

        bsMapping['total_non_current_assets'] = {
            currentYear: yearKey === 'currentYear' ? totalNonCurrentAssets : (bsMapping['total_non_current_assets']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalNonCurrentAssets : (bsMapping['total_non_current_assets']?.previousYear || 0)
        };
        bsMapping['total_current_assets'] = {
            currentYear: yearKey === 'currentYear' ? totalCurrentAssets : (bsMapping['total_current_assets']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalCurrentAssets : (bsMapping['total_current_assets']?.previousYear || 0)
        };
        bsMapping['total_assets'] = {
            currentYear: yearKey === 'currentYear' ? totalAssets : (bsMapping['total_assets']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalAssets : (bsMapping['total_assets']?.previousYear || 0)
        };
        bsMapping['total_equity'] = {
            currentYear: yearKey === 'currentYear' ? totalEquity : (bsMapping['total_equity']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalEquity : (bsMapping['total_equity']?.previousYear || 0)
        };
        bsMapping['total_non_current_liabilities'] = {
            currentYear: yearKey === 'currentYear' ? totalNonCurrentLiabilities : (bsMapping['total_non_current_liabilities']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalNonCurrentLiabilities : (bsMapping['total_non_current_liabilities']?.previousYear || 0)
        };
        bsMapping['total_current_liabilities'] = {
            currentYear: yearKey === 'currentYear' ? totalCurrentLiabilities : (bsMapping['total_current_liabilities']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalCurrentLiabilities : (bsMapping['total_current_liabilities']?.previousYear || 0)
        };
        bsMapping['total_liabilities'] = {
            currentYear: yearKey === 'currentYear' ? totalLiabilities : (bsMapping['total_liabilities']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalLiabilities : (bsMapping['total_liabilities']?.previousYear || 0)
        };
        bsMapping['total_equity_liabilities'] = {
            currentYear: yearKey === 'currentYear' ? totalEquityLiabilities : (bsMapping['total_equity_liabilities']?.currentYear || 0),
            previousYear: yearKey === 'previousYear' ? totalEquityLiabilities : (bsMapping['total_equity_liabilities']?.previousYear || 0)
        };

        return { values: bsMapping, notes: bsNotes };
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
        if (!autoPopulateTrigger) return;

        const currentEntries = getTrialBalanceEntriesForYear(adjustedTrialBalance, 'currentYear');
        const previousTbEntries = getTrialBalanceEntriesForYear(adjustedTrialBalance, 'previousYear');
        const hasPreviousTbValues = previousTbEntries.some(entry =>
            Math.abs(Number(entry.debit) || 0) > 0.01 || Math.abs(Number(entry.credit) || 0) > 0.01
        );
        const previousEntries = hasPreviousTbValues
            ? previousTbEntries
            : openingBalancesToTrialBalance(openingBalancesData);

        const pnlCurrent = mapEntriesToPnl(currentEntries, 'currentYear');
        const pnlPrevious = mapEntriesToPnl(previousEntries, 'previousYear');
        const bsCurrent = mapEntriesToBalanceSheet(currentEntries, 'currentYear');
        const bsPrevious = mapEntriesToBalanceSheet(previousEntries, 'previousYear');

        const mergedPnlValues = mergeYearValues(pnlCurrent.values, pnlPrevious.values);
        const mergedBsValues = mergeYearValues(bsCurrent.values, bsPrevious.values);
        const mergedPnlNotes = mergeNotesByDescription(pnlCurrent.notes, pnlPrevious.notes);
        const mergedBsNotes = mergeNotesByDescription(bsCurrent.notes, bsPrevious.notes);

        setPnlValues(prev => ({ ...prev, ...mergedPnlValues }));
        setBalanceSheetValues(prev => ({ ...prev, ...mergedBsValues }));
        setPnlWorkingNotes(prev => ({ ...prev, ...mergedPnlNotes }));
        setBsWorkingNotes(prev => ({ ...prev, ...mergedBsNotes }));
    }, [autoPopulateTrigger, adjustedTrialBalance, openingBalancesData]);

    // Recovery path: if user lands on P&L/BS before auto-populate ran, trigger it once from the current TB.
    useEffect(() => {
        const hasTbRows = !!adjustedTrialBalance?.some(item => item.account.toLowerCase() !== 'totals');
        if (!hasTbRows) return;

        if (currentStep === 5 && Object.keys(pnlValues).length === 0) {
            setAutoPopulateTrigger(prev => prev + 1);
            return;
        }

        if (currentStep === 6 && Object.keys(balanceSheetValues).length === 0) {
            setAutoPopulateTrigger(prev => prev + 1);
        }
    }, [currentStep, adjustedTrialBalance, pnlValues, balanceSheetValues]);

    // MASTER DATA SYNC EFFECT - Ensure final report uses customer details
    useEffect(() => {
        if (company) {
            setReportForm((prev: any) => ({
                ...prev,
                taxableNameEn: company.name || prev.taxableNameEn || '',
                trn: company.corporateTaxTrn || company.trn || prev.trn || '',
                entityType: company.businessType || prev.entityType || '',
                entitySubType: company.entitySubType || prev.entitySubType || '',
                primaryBusiness: company.primaryBusiness || prev.primaryBusiness || '',
                address: company.address || prev.address || '',
                mobileNumber: company.mobileNumber || prev.mobileNumber || '',
                landlineNumber: company.landlineNumber || prev.landlineNumber || '',
                emailId: company.emailId || prev.emailId || '',
                poBox: company.poBox || prev.poBox || '',
                periodDescription: prev.periodDescription || (period?.start && period?.end ? `Tax Year End ${period.end.split('/').pop()}` : `Tax Year End ${company?.ctPeriodEnd?.split('/').pop() || '2024'}`),
                versionDescription: prev.versionDescription || 'Amendment/Voluntary Disclosure',
                periodFrom: prev.periodFrom || period?.start || company?.ctPeriodStart || '01/01/2024',
                periodTo: prev.periodTo || period?.end || company?.ctPeriodEnd || '31/12/2024',
                dueDate: company.ctDueDate || prev.dueDate || '',
            }));
        }
    }, [company]);

    useEffect(() => {
        if (ftaFormValues) {
            setReportForm((prev: any) => ({
                ...prev,
                netTaxPosition: ftaFormValues.corporateTaxLiability,
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
                taxableIncomeTaxPeriod: prev.taxableIncomeTaxPeriod,
                corporateTaxLiability: prev.corporateTaxLiability,
                corporateTaxPayable: prev.corporateTaxPayable,
                declarationDate: prev.declarationDate || new Date().toLocaleDateString('en-GB'),
                preparedBy: prev.preparedBy || 'Taxable Person',
                declarationConfirmed: prev.declarationConfirmed || 'Yes'
            }));
        }
    }, [ftaFormValues]);

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

    const handleBack = async () => {
        if (currentStep === 1) return;
        await handleSaveStep(currentStep);
        setCurrentStep(prev => prev - 1);
    };

    const handleSkipQuestionnaire = useCallback(async () => {
        await handleSaveStep(8);
        setCurrentStep(9);
    }, [handleSaveStep]);

    const handleExtractAdditionalData = async () => {
        if (additionalFiles.length === 0) return;
        setIsExtracting(true);
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
                setIsExtracting(false);
                return;
            }

            setAdditionalDetails({ vatFileResults: results });
            await handleSaveStep(3);
            setCurrentStep(4);
        } catch (e: any) {
            console.error("Failed to extract per-file VAT totals", e);
            alert(`VAT extraction failed: ${e.message || "Unknown error"}. Please try again.`);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleVatSummarizationContinue = async () => {
        await handleSaveStep(4);
        setCurrentStep(5); // To Profit & Loss
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

    const handleExportStep4VAT = () => {
        const workbook = XLSX.utils.book_new();
        const exportData = getVatExportRows(vatStepData);

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        applySheetStyling(worksheet, 2, 1);

        XLSX.utils.book_append_sheet(workbook, worksheet, "VAT Summarization");
        XLSX.writeFile(workbook, `${companyName}_Step4_VAT_Summarization.xlsx`);
    };

    const handleOpeningBalancesComplete = async () => {
        await handleSaveStep(1);
        setCurrentStep(2); // Trial Balance step
    };

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

    const handleExportFinalExcel = () => {
        const workbook = XLSX.utils.book_new();

        // --- 1. Trial Balance Sheet (first tab as requested) ---
        const finalTbData: (string | number | null)[][] = [
            ["Adjusted Trial Balance"],
            [],
            ["Account", "Category", "Current Year Debit", "Current Year Credit", "Previous Year Debit", "Previous Year Credit"]
        ];
        const finalTbRows = getTrialBalanceRowsWithComputedTotals(adjustedTrialBalance);
        if (finalTbRows.length > 0) {
            finalTbRows.forEach(item => {
                finalTbData.push([
                    item.account,
                    item.category || '',
                    item.debit ?? null,
                    item.credit ?? null,
                    item.previousDebit ?? null,
                    item.previousCredit ?? null
                ]);
            });
        } else {
            finalTbData.push(["No Trial Balance data available", "", null, null, null, null]);
        }
        const wsFinalTb = XLSX.utils.aoa_to_sheet(finalTbData);
        wsFinalTb['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
        applySheetStyling(wsFinalTb, 3, 1);
        XLSX.utils.book_append_sheet(workbook, wsFinalTb, "Trial Balance");

        // --- 2. Final Return Sheet ---
        const reportData: any[][] = [];
        reportData.push(["CORPORATE TAX RETURN - FEDERAL TAX AUTHORITY"]);
        reportData.push([]);

        // Helper to get helper value
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

        // Simple number formatting for report
        const range = XLSX.utils.decode_range(wsReport['!ref'] || 'A1:A1');
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
            const cell = wsReport[cellRef];
            if (cell && cell.t === 'n') cell.z = '#,##0.00';
        }

        XLSX.utils.book_append_sheet(workbook, wsReport, "Final Return");

        // --- 3. Tax Computation Sheet ---
        const taxData: (string | number)[][] = [
            ["Tax Computation Summary"],
            ["Field", "Value (AED)"],
        ];
        if (ftaFormValues) {
            taxData.push(["Accounting Net Profit or Loss", ftaFormValues.netProfit || 0]);
            taxData.push(["Adjustments (Exemptions/Reliefs)", 0]);
            taxData.push(["Total Taxable Income", ftaFormValues.taxableIncome || 0]);
            taxData.push(["Corporate Tax Payable", ftaFormValues.corporateTaxLiability || 0]);
        }
        const wsTax = XLSX.utils.aoa_to_sheet(taxData);
        wsTax['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsTax, "Tax Computation");

        // --- 4. Profit & Loss Sheet ---
        const pnlData: (string | number)[][] = [["Profit & Loss Statement"], ["Account", "Current Year", "Previous Year"]];
        pnlStructure.forEach((item: any) => {
            const val = pnlValues[item.id] || { currentYear: 0, previousYear: 0 };
            if (item.type === 'header') {
                pnlData.push([item.label.toUpperCase(), "", ""]);
            } else if (item.type !== 'spacer') {
                pnlData.push([item.label, val.currentYear || 0, val.previousYear || 0]);
            }
        });
        const wsPnl = XLSX.utils.aoa_to_sheet(pnlData);
        wsPnl['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsPnl, "Profit & Loss");

        // --- 5. Balance Sheet ---
        const bsData: (string | number)[][] = [["Balance Sheet"], ["Account", "Current Year", "Previous Year"]];
        bsStructure.forEach((item: any) => {
            const val = balanceSheetValues[item.id] || { currentYear: 0, previousYear: 0 };
            if (item.type === 'header') {
                bsData.push([item.label.toUpperCase(), "", ""]);
            } else if (item.type !== 'spacer') {
                bsData.push([item.label, val.currentYear || 0, val.previousYear || 0]);
            }
        });
        const wsBs = XLSX.utils.aoa_to_sheet(bsData);
        wsBs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, wsBs, "Balance Sheet");

        // Match final report tab order requested by business/export template.
        workbook.SheetNames = [
            "Trial Balance",
            "Profit & Loss",
            "Balance Sheet",
            "Tax Computation",
            "Final Return",
        ].filter((sheetName) => workbook.Sheets[sheetName]);

        XLSX.writeFile(workbook, `${companyName || 'Company'}_CT_Final_Report_Comprehensive.xlsx`);
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
        const tbRowsForExport = getTrialBalanceRowsWithComputedTotals(adjustedTrialBalance);
        if (tbRowsForExport.length === 0) return;
        const tbData: (string | number | null)[][] = [["STEP 2: ADJUSTED TRIAL BALANCE"], [], ["Account", "Category", "Current Year Debit", "Current Year Credit", "Previous Year Debit", "Previous Year Credit"]];
        tbRowsForExport.forEach(item => {
            tbData.push([
                item.account,
                item.category || '',
                item.debit || null,
                item.credit || null,
                item.previousDebit ?? null,
                item.previousCredit ?? null
            ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(tbData);
        ws['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
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
        const tbRowsForExport = getTrialBalanceRowsWithComputedTotals(adjustedTrialBalance);
        const tbData: (string | number | null)[][] = [["STEP 2: ADJUSTED TRIAL BALANCE"], [], ["Account", "Category", "Current Year Debit", "Current Year Credit", "Previous Year Debit", "Previous Year Credit"]];
        tbRowsForExport.forEach(item => {
            tbData.push([
                item.account,
                item.category || '',
                item.debit || null,
                item.credit || null,
                item.previousDebit ?? null,
                item.previousCredit ?? null
            ]);
        });
        const tbWs = XLSX.utils.aoa_to_sheet(tbData);
        tbWs['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 24 }, { wch: 24 }, { wch: 24 }, { wch: 24 }];
        applySheetStyling(tbWs, 3, 1);
        XLSX.utils.book_append_sheet(workbook, tbWs, "2. Trial Balance");

        // Step 2.5: TB Working Notes
        const tbNotesItems: any[] = [];
        Object.entries(tbWorkingNotes).forEach(([account, notesArg]) => {
            const notes = notesArg as TbWorkingNoteEntry[];
            if (notes && notes.length > 0) {
                notes.forEach(n => {
                    tbNotesItems.push({
                        "Linked Account": account,
                        "Description": n.description,
                        "Year": normalizeTbNoteYearScope(n.yearScope) === 'previous' ? 'Previous Year' : 'Current Year',
                        "Debit (AED)": n.debit,
                        "Credit (AED)": n.credit
                    });
                });
            }
        });
        if (tbNotesItems.length > 0) {
            const ws2 = XLSX.utils.json_to_sheet(tbNotesItems);
            ws2['!cols'] = [{ wch: 40 }, { wch: 50 }, { wch: 18 }, { wch: 20 }, { wch: 20 }];
            applySheetStyling(ws2, 1);
            XLSX.utils.book_append_sheet(workbook, ws2, "Step 2 - TB Working Notes");
        }

        // Step 3: VAT Docs Upload
        const vatDocs = additionalFiles.length > 0
            ? additionalFiles.map(file => ({ "File Name": file.name, "Status": "Uploaded" }))
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

        // Step 8: Signed FS & LOU
        const signedData = [["STEP 8: SIGNED FS & LOU DOCUMENTS (REFERENCE ONLY)"], [], ["Filename", "Size (bytes)", "Status"]];
        signedFsLouFiles.forEach(file => {
            signedData.push([file.name, file.size, "Uploaded"]);
        });
        const signedWs = XLSX.utils.aoa_to_sheet(signedData);
        signedWs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 15 }];
        applySheetStyling(signedWs, 3);
        XLSX.utils.book_append_sheet(workbook, signedWs, "8. Signed FS & LOU");

        // Step 9: Questionnaire
        const qData = [["STEP 9: CT QUESTIONNAIRE"], [], ["No.", "Question", "Answer"]];
        CT_QUESTIONS.forEach(q => {
            qData.push([q.id, q.text, questionnaireAnswers[q.id] || "N/A"]);
        });
        const qWs = XLSX.utils.aoa_to_sheet(qData);
        qWs['!cols'] = [{ wch: 10 }, { wch: 80 }, { wch: 15 }];
        applySheetStyling(qWs, 3);
        XLSX.utils.book_append_sheet(workbook, qWs, "9. Questionnaire");

        // Step 10: Final Report
        const reportData: any[][] = [
            ["STEP 10: CORPORATE TAX RETURN - FINAL REPORT"],
            ["Company Name", reportForm.taxableNameEn || company?.name || companyName],
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
        XLSX.utils.book_append_sheet(workbook, reportWs, "10. Final Report");

        // Keep Trial Balance as the first tab in Export All for easier review.
        if (workbook.Sheets["2. Trial Balance"]) {
            workbook.SheetNames = [
                "2. Trial Balance",
                ...workbook.SheetNames.filter(name => name !== "2. Trial Balance")
            ];
        }

        XLSX.writeFile(workbook, `${companyName}_CT_Type3_Complete_Filing.xlsx`);
    };

    const handleExportStepLou = () => {
        const wb = XLSX.utils.book_new();
        const data = louFiles.map(f => ({ "File Name": f.name, "Size": f.size, "Status": "Uploaded" }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "LOU Documents");
        XLSX.writeFile(wb, `${companyName}_LOU_Documents.xlsx`);
    };

    const handleExportStepSignedFsLou = () => {
        const wb = XLSX.utils.book_new();
        const data = signedFsLouFiles.map(f => ({ "File Name": f.name, "Size": f.size, "Status": "Uploaded" }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Signed FS and LOU");
        XLSX.writeFile(wb, `${companyName}_Signed_FS_LOU.xlsx`);
    };

    const handleExportStepQuestionnaire = () => {
        const wb = XLSX.utils.book_new();
        const data = CT_QUESTIONS.map(q => ({ "No": q.id, "Question": q.text, "Answer": questionnaireAnswers[q.id] || "N/A" }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Questionnaire");
        XLSX.writeFile(wb, `${companyName}_CT_Questionnaire.xlsx`);
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

    const handleCellChange = (accountLabel: string, field: 'debit' | 'credit' | 'previousDebit' | 'previousCredit', value: string) => {
        const numValue = parseFloat(value) || 0;
        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const newBalance = [...prev];
            const existingIndex = newBalance.findIndex(i => i.account === accountLabel);
            if (existingIndex > -1) {
                const item = newBalance[existingIndex];
                const notes = (tbWorkingNotes[accountLabel] || []) as TbWorkingNoteEntry[];
                const { noteTotals, baseDebit, baseCredit, basePreviousDebit, basePreviousCredit } = getTbRowBaseAmounts(item, notes);
                if (field === 'previousDebit' || field === 'previousCredit') {
                    const newBasePreviousDebit = field === 'previousDebit' ? numValue : basePreviousDebit;
                    const newBasePreviousCredit = field === 'previousCredit' ? numValue : basePreviousCredit;
                    newBalance[existingIndex] = {
                        ...item,
                        basePreviousDebit: newBasePreviousDebit,
                        basePreviousCredit: newBasePreviousCredit,
                        previousDebit: newBasePreviousDebit + noteTotals.previousDebit,
                        previousCredit: newBasePreviousCredit + noteTotals.previousCredit
                    };
                } else {
                    const newBaseDebit = field === 'debit' ? numValue : baseDebit;
                    const newBaseCredit = field === 'credit' ? numValue : baseCredit;

                    newBalance[existingIndex] = {
                        ...item,
                        baseDebit: newBaseDebit,
                        baseCredit: newBaseCredit,
                        debit: newBaseDebit + noteTotals.currentDebit,
                        credit: newBaseCredit + noteTotals.currentCredit
                    };
                }
            }
            else {
                const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
                const newItem = {
                    account: accountLabel,
                    debit: field === 'debit' ? numValue : 0,
                    credit: field === 'credit' ? numValue : 0,
                    previousDebit: field === 'previousDebit' ? numValue : 0,
                    previousCredit: field === 'previousCredit' ? numValue : 0,
                    baseDebit: field === 'debit' ? numValue : 0,
                    baseCredit: field === 'credit' ? numValue : 0,
                    basePreviousDebit: field === 'previousDebit' ? numValue : 0,
                    basePreviousCredit: field === 'previousCredit' ? numValue : 0,
                    [field]: numValue
                };
                if (totalsIdx > -1) newBalance.splice(totalsIdx, 0, newItem);
                else newBalance.push(newItem);
            }
            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalsRow = buildTbTotalsRow(dataOnly);
            const finalTotalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (finalTotalsIdx > -1) newBalance[finalTotalsIdx] = totalsRow;
            else newBalance.push(totalsRow);
            return newBalance;
        });
        setAutoPopulateTrigger(prev => prev + 1);
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

        if (tbSelectedAccounts[oldName] !== undefined) {
            setTbSelectedAccounts(prev => {
                const next = { ...prev };
                next[newName] = !!next[oldName];
                delete next[oldName];
                return next;
            });
        }

        setAutoPopulateTrigger(prev => prev + 1);
    };

    const handleDeleteAccount = (accountName: string) => {
        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const filtered = prev.filter(item => item.account !== accountName);

            // Recalculate Totals
            const dataOnly = filtered.filter(i => i.account.toLowerCase() !== 'totals');
            const totalsRow = buildTbTotalsRow(dataOnly);
            const totalsIdx = filtered.findIndex(i => i.account.toLowerCase() === 'totals');
            if (totalsIdx > -1) {
                filtered[totalsIdx] = totalsRow;
                return [...filtered];
            } else {
                return [...filtered, totalsRow];
            }
        });

        setTbWorkingNotes(prev => {
            const newNotes = { ...prev };
            delete newNotes[accountName];
            return newNotes;
        });

        setTbSelectedAccounts(prev => {
            if (prev[accountName] === undefined) return prev;
            const next = { ...prev };
            delete next[accountName];
            return next;
        });

        setAutoPopulateTrigger(prev => prev + 1);
    };

    const handleOpenTbNote = (account: string) => {
        setCurrentTbAccount(account);
        setShowTbNoteModal(true);
    };

    const handleSaveTbNote = (notes: TbWorkingNoteEntry[]) => {
        if (!currentTbAccount) return;
        const existingNotesForAccount = (tbWorkingNotes[currentTbAccount] || []) as TbWorkingNoteEntry[];
        const newNoteTotals = getTbWorkingNoteTotals(notes);

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
                const baseAmounts = getTbRowBaseAmounts(item, existingNotesForAccount);

                newBalance[accIndex] = {
                    ...item,
                    baseDebit: baseAmounts.baseDebit,
                    baseCredit: baseAmounts.baseCredit,
                    basePreviousDebit: baseAmounts.basePreviousDebit,
                    basePreviousCredit: baseAmounts.basePreviousCredit,
                    debit: baseAmounts.baseDebit + newNoteTotals.currentDebit,
                    credit: baseAmounts.baseCredit + newNoteTotals.currentCredit,
                    previousDebit: baseAmounts.basePreviousDebit + newNoteTotals.previousDebit,
                    previousCredit: baseAmounts.basePreviousCredit + newNoteTotals.previousCredit
                };
            }

            // Recalculate Totals
            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalsRow = buildTbTotalsRow(dataOnly);
            const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (totalsIdx > -1) newBalance[totalsIdx] = totalsRow;
            else newBalance.push(totalsRow);

            return newBalance;
        });
        setAutoPopulateTrigger(prev => prev + 1);
    };

    const parseTrialBalanceNumberFlexible = (value: unknown): { value: number; isValid: boolean; isEmpty: boolean } => {
        if (value === undefined || value === null) return { value: 0, isValid: true, isEmpty: true };
        if (typeof value === 'number') return { value, isValid: true, isEmpty: false };

        let raw = String(value).trim();
        if (!raw) return { value: 0, isValid: true, isEmpty: true };

        // Remove common formatting noise while preserving separators/signs.
        raw = raw
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, '')
            .replace(/[A-Za-z$€£AED]/g, '');

        if (!raw) return { value: 0, isValid: true, isEmpty: true };

        const isParenNegative = raw.startsWith('(') && raw.endsWith(')');
        raw = raw.replace(/[()]/g, '');
        if (!raw) return { value: 0, isValid: true, isEmpty: true };

        const commaCount = (raw.match(/,/g) || []).length;
        const dotCount = (raw.match(/\./g) || []).length;
        const lastComma = raw.lastIndexOf(',');
        const lastDot = raw.lastIndexOf('.');

        let normalized = raw;

        if (commaCount > 0 && dotCount > 0) {
            // Use the last separator as decimal marker, treat the other as thousand separator.
            if (lastComma > lastDot) {
                normalized = raw.replace(/\./g, '').replace(/,/g, '.');
            } else {
                normalized = raw.replace(/,/g, '');
            }
        } else if (commaCount > 0) {
            const parts = raw.split(',');
            const lastPart = parts[parts.length - 1] || '';
            const allPrevAreTriplets = parts.slice(1, -1).every(p => p.length === 3);
            const looksDecimalComma = commaCount === 1
                ? (lastPart.length > 0 && lastPart.length <= 2)
                : (lastPart.length > 0 && lastPart.length <= 2 && allPrevAreTriplets);
            normalized = looksDecimalComma ? raw.replace(/,/g, '.') : raw.replace(/,/g, '');
        } else if (dotCount > 1) {
            const parts = raw.split('.');
            const lastPart = parts[parts.length - 1] || '';
            const allPrevAreTriplets = parts.slice(1, -1).every(p => p.length === 3);
            const looksDecimalWithDotThousands = lastPart.length > 0 && lastPart.length <= 2 && allPrevAreTriplets;
            normalized = looksDecimalWithDotThousands
                ? parts.slice(0, -1).join('') + '.' + lastPart
                : raw.replace(/\./g, '');
        }

        normalized = normalized.replace(/[^0-9.\-]/g, '');
        if (!normalized || normalized === '-' || normalized === '.') {
            return { value: 0, isValid: false, isEmpty: false };
        }

        // Prevent malformed values with multiple decimal points after normalization.
        const decimalPoints = (normalized.match(/\./g) || []).length;
        if (decimalPoints > 1) return { value: 0, isValid: false, isEmpty: false };

        const num = Number(normalized);
        if (Number.isNaN(num)) return { value: 0, isValid: false, isEmpty: false };
        return { value: isParenNegative ? -Math.abs(num) : num, isValid: true, isEmpty: false };
    };

    const parseTrialBalanceNumber = (value: unknown) => {
        const parsed = parseTrialBalanceNumberFlexible(value);
        return parsed.isValid ? parsed.value : 0;
    };

    const parseTrialBalanceNumberStrict = (value: unknown) => {
        return parseTrialBalanceNumberFlexible(value);
    };

    const normalizeTbExtractedAmount = (value: unknown) => {
        const num = Number(value) || 0;
        return Math.abs(num) <= 0.01 ? 0 : num;
    };

    const normalizeTbDebitCreditPair = (debitValue: unknown, creditValue: unknown) => {
        const normalized = normalizeDebitCredit(Number(debitValue) || 0, Number(creditValue) || 0);
        return {
            debit: normalizeTbExtractedAmount(normalized.debit),
            credit: normalizeTbExtractedAmount(normalized.credit)
        };
    };

    const getColumnLabel = (index: number) => {
        let label = '';
        let n = index + 1;
        while (n > 0) {
            const rem = (n - 1) % 26;
            label = String.fromCharCode(65 + rem) + label;
            n = Math.floor((n - 1) / 26);
        }
        return label;
    };

    const normalizeTbHeaderText = (value: unknown) => String(value ?? '')
        .toLowerCase()
        .replace(/[_\-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const shouldSkipTbAccountLikeRow = (accountValue: unknown) => {
        const name = normalizeTbHeaderText(accountValue);
        if (!name) return true;
        if ([
            'account',
            'account name',
            'account code',
            'ledger',
            'description',
            'particular',
            'debit',
            'credit',
            'net debit',
            'net credit',
            'amount'
        ].includes(name)) return true;
        if (name === 'total' || name === 'totals') return true;
        if (name.startsWith('total ') || name.startsWith('sub total') || name.startsWith('subtotal')) return true;
        if (name.includes('grand total') || name.includes('trial balance total')) return true;
        if (name.includes('total debit') || name.includes('total credit') || name.includes('total amount')) return true;
        if (name.includes('difference') || name.includes('variance')) return true;
        if (name.includes('carried forward') || name.includes('brought forward')) return true;
        if (/^(opening|closing)\s+balance\b/.test(name)) return true;
        return false;
    };

    const detectTbExcelHeaderRowIndex = (rows: unknown[][]) => {
        // Some accounting exports add many metadata/title rows before the TB grid.
        const maxScanRows = Math.min(rows.length, 80);
        let best: { index: number; score: number; keywordHits: number } = { index: -1, score: -Infinity, keywordHits: 0 };

        const rowHasValues = (row: unknown[]) => row.some(cell => String(cell ?? '').trim() !== '');

        for (let rowIndex = 0; rowIndex < maxScanRows; rowIndex += 1) {
            const row = rows[rowIndex] || [];
            if (!rowHasValues(row)) continue;

            let score = 0;
            let nonEmpty = 0;
            let keywordHits = 0;
            const matchedKinds = new Set<string>();

            row.forEach((cell) => {
                const raw = String(cell ?? '').trim();
                if (!raw) return;
                nonEmpty += 1;

                const header = normalizeTbHeaderText(raw);
                const numeric = parseTrialBalanceNumberStrict(raw);
                if (!numeric.isEmpty && numeric.isValid) score -= 2;
                if (/[a-z]/i.test(raw)) score += 0.5;
                if (raw.length > 60) score -= 1.5;

                const isAccount = /\b(account|ledger|description|particular|name)\b/.test(header);
                const isCategory = /\b(category|class|type|group)\b/.test(header);
                const isDebit = /\b(debit|dr)\b/.test(header);
                const isCredit = /\b(credit|cr)\b/.test(header);

                if (isAccount && !matchedKinds.has('account')) { matchedKinds.add('account'); keywordHits += 1; score += 6; }
                if (isCategory && !matchedKinds.has('category')) { matchedKinds.add('category'); keywordHits += 1; score += 4; }
                if (isDebit && !matchedKinds.has('debit')) { matchedKinds.add('debit'); keywordHits += 1; score += 5; }
                if (isCredit && !matchedKinds.has('credit')) { matchedKinds.add('credit'); keywordHits += 1; score += 5; }
            });

            if (nonEmpty === 1) score -= 4; // likely title row
            if (nonEmpty >= 2 && nonEmpty <= 12) score += 2;
            if (matchedKinds.has('account') && (matchedKinds.has('debit') || matchedKinds.has('credit'))) score += 3;
            if (matchedKinds.has('debit') && matchedKinds.has('credit')) score += 2;

            // Header row is usually followed by numeric/text data.
            const nextRows = rows.slice(rowIndex + 1, rowIndex + 5);
            let nextRowDataSignals = 0;
            nextRows.forEach((next) => {
                let numericCells = 0;
                let textCells = 0;
                next.forEach((cell) => {
                    const raw = String(cell ?? '').trim();
                    if (!raw) return;
                    const parsed = parseTrialBalanceNumberStrict(raw);
                    if (!parsed.isEmpty && parsed.isValid) numericCells += 1;
                    else if (/[a-z]/i.test(raw)) textCells += 1;
                });
                if (numericCells > 0 && textCells > 0) nextRowDataSignals += 1;
            });
            score += nextRowDataSignals;

            if (score > best.score) {
                best = { index: rowIndex, score, keywordHits };
            }
        }

        if (best.index < 0) return null;
        if (best.keywordHits >= 2 && best.score >= 7) return best.index;
        return null;
    };

    const rowLooksLikeDebitCreditHeader = (row: unknown[] = []) => {
        let debitHits = 0;
        let creditHits = 0;
        row.forEach((cell) => {
            const h = normalizeTbHeaderText(cell);
            if (!h) return;
            if (/\bdebit\b/.test(h) || h === 'dr') debitHits += 1;
            if (/\bcredit\b/.test(h) || h === 'cr') creditHits += 1;
        });
        return debitHits > 0 && creditHits > 0;
    };

    const tbCategoryKeywordRegex = /\bassets?|liabilit(?:y|ies)|equity|income|expenses?|revenue|profit|loss\b/;
    const tbAmountKeywordRegex = /\b(debit|credit|dr|cr|trial|trail|closing|balance|amount)\b/;

    const hasTbCurrentYearLabel = (normalized: string) => {
        if (!normalized) return false;
        if (/\bcy\b/.test(normalized)) return true;
        if (/^(current|this)$/.test(normalized)) return true;
        if (/\b(current|this)\s+(?:fiscal\s+)?year\b/.test(normalized)) return true;
        if (/\b(current|this)\s+period\b/.test(normalized)) return true;
        return /\b(current|this)\b/.test(normalized)
            && tbAmountKeywordRegex.test(normalized)
            && !tbCategoryKeywordRegex.test(normalized);
    };

    const hasTbPreviousYearLabel = (normalized: string) => {
        if (!normalized) return false;
        if (/\bpy\b/.test(normalized)) return true;
        if (/^(previous|prior|last)$/.test(normalized)) return true;
        if (/\b(previous|prior|last)\s+(?:fiscal\s+)?year\b/.test(normalized)) return true;
        if (/\b(previous|prior|last)\s+period\b/.test(normalized)) return true;
        return /\b(previous|prior|last)\b/.test(normalized)
            && tbAmountKeywordRegex.test(normalized)
            && !tbCategoryKeywordRegex.test(normalized);
    };

    const hasTbYearMarker = (normalized: string) => {
        if (!normalized) return false;
        if (/\b(19|20)\d{2}\b/.test(normalized)) return true;
        if (/\bfy\b/.test(normalized)) return true;
        if (/\bfiscal\s+year\b/.test(normalized)) return true;
        if (/\byear\s+(ended|ending|to|from)\b/.test(normalized)) return true;
        return hasTbCurrentYearLabel(normalized) || hasTbPreviousYearLabel(normalized);
    };

    const rowHasYearContext = (row: unknown[] = []) => {
        return row.some((cell) => {
            const normalized = normalizeTbHeaderText(cell);
            return hasTbYearMarker(normalized);
        });
    };

    const isTbLabelHeaderCell = (value: unknown) => {
        const normalized = normalizeTbHeaderText(value);
        if (!normalized) return false;
        return [
            'account',
            'account name',
            'account title',
            'account code',
            'ledger',
            'ledger name',
            'description',
            'particular',
            'particulars',
            'name',
            'category',
            'sub category',
            'subcategory',
            'class',
            'type',
            'group'
        ].includes(normalized);
    };

    const rowHasTbLabelContext = (row: unknown[] = []) => {
        let headerHits = 0;
        let numericCells = 0;

        row.forEach((cell) => {
            const raw = String(cell ?? '').trim();
            if (!raw) return;
            const parsed = parseTrialBalanceNumberStrict(raw);
            if (!parsed.isEmpty && parsed.isValid) {
                numericCells += 1;
                return;
            }
            if (isTbLabelHeaderCell(raw)) headerHits += 1;
        });

        if (headerHits === 0) return false;
        return numericCells === 0;
    };

    const getDebitCreditHeaderStrength = (row: unknown[] = []) => {
        let debitHits = 0;
        let creditHits = 0;
        let trialHits = 0;
        let closingHits = 0;
        row.forEach((cell) => {
            const h = normalizeTbHeaderText(cell);
            if (!h) return;
            if (/\bdebit\b/.test(h) || h === 'dr') debitHits += 1;
            if (/\bcredit\b/.test(h) || h === 'cr') creditHits += 1;
            if (/\btrial\b/.test(h) || /\btrail\b/.test(h)) trialHits += 1;
            if (/\bclosing\b/.test(h)) closingHits += 1;
        });
        const score = (debitHits > 0 ? 4 : 0)
            + (creditHits > 0 ? 4 : 0)
            + Math.min(trialHits, 4)
            + Math.min(closingHits, 4)
            + Math.min(debitHits + creditHits, 6);
        return { debitHits, creditHits, trialHits, closingHits, score };
    };

    const isYearLikeTbLabel = (value: unknown) => {
        const normalized = normalizeTbHeaderText(value);
        return hasTbYearMarker(normalized);
    };

    const buildCompositeTbHeaders = (rows: unknown[][], headerRowIndex: number, maxCols: number) => {
        const windowStart = Math.max(0, headerRowIndex - 6);
        const windowEnd = Math.min(rows.length - 1, headerRowIndex + 6);
        const candidates: number[] = [];
        for (let idx = windowStart; idx <= windowEnd; idx += 1) {
            const row = rows[idx] || [];
            if (row.some(cell => String(cell ?? '').trim() !== '')) candidates.push(idx);
        }

        const childCandidateIdx = candidates
            .map((idx) => ({
                idx,
                strength: getDebitCreditHeaderStrength(rows[idx] || []),
                distance: Math.abs(idx - headerRowIndex)
            }))
            .filter(item => item.strength.debitHits > 0 && item.strength.creditHits > 0)
            .sort((a, b) => {
                if (b.strength.score !== a.strength.score) return b.strength.score - a.strength.score;
                return a.distance - b.distance;
            })[0]?.idx ?? headerRowIndex;

        const childRow = rows[childCandidateIdx] || [];

        const yearCandidateIdx = candidates
            .filter(idx => idx !== childCandidateIdx && rowHasYearContext(rows[idx] || []))
            .sort((a, b) => {
                const aDist = Math.abs(a - childCandidateIdx);
                const bDist = Math.abs(b - childCandidateIdx);
                if (aDist !== bDist) return aDist - bDist;
                // Prefer rows above the debit/credit child row (common multi-row TB header layout).
                if (a < childCandidateIdx && b > childCandidateIdx) return -1;
                if (b < childCandidateIdx && a > childCandidateIdx) return 1;
                return a - b;
            })[0] ?? -1;

        const labelCandidateIdx = candidates
            .filter(idx => idx !== childCandidateIdx && idx !== yearCandidateIdx && rowHasTbLabelContext(rows[idx] || []))
            .sort((a, b) => {
                const aDist = Math.abs(a - childCandidateIdx);
                const bDist = Math.abs(b - childCandidateIdx);
                if (aDist !== bDist) return aDist - bDist;
                return a - b;
            })[0] ?? -1;

        const selectedHeaderRows = [childCandidateIdx, yearCandidateIdx, labelCandidateIdx]
            .filter((idx): idx is number => idx >= 0);
        const dataStartIndex = (selectedHeaderRows.length > 0 ? Math.max(...selectedHeaderRows) : headerRowIndex) + 1;

        const yearRow = yearCandidateIdx >= 0 ? (rows[yearCandidateIdx] || []) : [];
        const labelRow = labelCandidateIdx >= 0 ? (rows[labelCandidateIdx] || []) : [];

        let lastYearLabel = '';
        const yearLabels = Array.from({ length: maxCols }, (_, idx) => {
            const raw = String(yearRow[idx] ?? '').trim();
            if (raw && isYearLikeTbLabel(raw)) {
                lastYearLabel = raw;
                return raw;
            }
            return lastYearLabel;
        });

        const headers = Array.from({ length: maxCols }, (_, idx) => {
            const year = String(yearLabels[idx] ?? '').trim();
            const label = String(labelRow[idx] ?? '').trim();
            const child = String(childRow[idx] ?? '').trim();
            const parts: string[] = [];
            const seen = new Set<string>();
            const pushPart = (value: string) => {
                if (!value) return;
                const norm = normalizeTbHeaderText(value);
                if (!norm || seen.has(norm)) return;
                seen.add(norm);
                parts.push(value);
            };

            pushPart(year);
            if (isTbLabelHeaderCell(label)) pushPart(label);
            pushPart(child);

            if (parts.length > 0) return parts.join(' ').trim();
            return `Column ${getColumnLabel(idx)}`;
        });

        return { headers, dataStartIndex };
    };

    const loadTbExcelSheet = async (file: File, preferredSheet?: string) => {
        if (!XLSX?.read || !XLSX?.utils) {
            throw new Error('Excel library not loaded.');
        }
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetNames = workbook.SheetNames;
        const sheetName = preferredSheet
            || sheetNames.find((name: string) => name.toLowerCase().includes('trial'))
            || sheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', blankrows: false }) as unknown[][];
        const nonEmptyRows = rows.filter(row => row.some(cell => String(cell ?? '').trim() !== ''));
        const headerRowIndex = detectTbExcelHeaderRowIndex(nonEmptyRows);
        const maxCols = nonEmptyRows.reduce((max, row) => Math.max(max, row.length || 0), 0);

        let headers: string[] = [];
        let dataRows: unknown[][] = [];

        if (headerRowIndex !== null) {
            const composite = buildCompositeTbHeaders(nonEmptyRows, headerRowIndex, Math.max(maxCols, (nonEmptyRows[headerRowIndex] || []).length));
            headers = composite.headers;
            dataRows = nonEmptyRows.slice(composite.dataStartIndex);
        } else {
            headers = Array.from({ length: maxCols }, (_, idx) => `Column ${getColumnLabel(idx)}`);
            dataRows = nonEmptyRows;
        }

        return { sheetNames, sheetName, headers, rows: dataRows };
    };

    const guessTbExcelMapping = (headers: string[], rows: unknown[][] = []): TbExcelMapping => {
        const normalized = headers.map(normalizeTbHeaderText);
        const headerWords = normalized.map(h => h.split(/[^a-z0-9]+/).filter(Boolean));
        const hasWord = (idx: number, word: string) => headerWords[idx]?.includes(word);
        const headerIncludes = (idx: number, text: string) => normalized[idx]?.includes(text);
        const headerYear = normalized.map(h => {
            const match = h.match(/\b(19|20)\d{2}\b/);
            return match ? Number(match[0]) : null;
        });
        const distinctYears = Array.from(new Set(headerYear.filter((y): y is number => y !== null))).sort((a, b) => b - a);
        const detectedCurrentYear = distinctYears[0] ?? null;
        const detectedPreviousYear = distinctYears[1] ?? null;
        const isPreviousContext = (idx: number) =>
            hasTbPreviousYearLabel(normalized[idx])
            || (detectedPreviousYear !== null && headerYear[idx] === detectedPreviousYear);
        const isCurrentContext = (idx: number) =>
            hasTbCurrentYearLabel(normalized[idx])
            || (detectedCurrentYear !== null && headerYear[idx] === detectedCurrentYear);
        const isDebitHeader = (idx: number) =>
            /\bdebit\b/.test(normalized[idx]) || hasWord(idx, 'dr') || headerIncludes(idx, 'debit amount');
        const isCreditHeader = (idx: number) =>
            /\bcredit\b/.test(normalized[idx]) || hasWord(idx, 'cr') || headerIncludes(idx, 'credit amount');
        const isTrialHeader = (idx: number) =>
            /\btrial\b/.test(normalized[idx]) || /\btrail\b/.test(normalized[idx]);
        const isClosingHeader = (idx: number) =>
            /\bclosing\b/.test(normalized[idx]) || /\bclosing balance\b/.test(normalized[idx]);

        const findHeaderIndex = (matcher: (idx: number) => boolean) =>
            normalized.findIndex((_, idx) => matcher(idx));

        let accountIdx = findHeaderIndex((idx) =>
            /\b(account|ledger|description|particular)\b/.test(normalized[idx])
            || (hasWord(idx, 'name') && (hasWord(idx, 'account') || hasWord(idx, 'ledger')))
        );
        let categoryIdx = findHeaderIndex((idx) =>
            /\b(category|class|type|group)\b/.test(normalized[idx])
        );
        // CT Type 3 preference: use Closing Balance columns first, then fall back to Trial/Trail columns.
        let previousDebitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && isPreviousContext(idx) && isClosingHeader(idx));
        let previousCreditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && isPreviousContext(idx) && isClosingHeader(idx));
        let debitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && !isPreviousContext(idx) && isCurrentContext(idx) && isClosingHeader(idx));
        let creditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && !isPreviousContext(idx) && isCurrentContext(idx) && isClosingHeader(idx));

        if (debitIdx < 0) {
            debitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && !isPreviousContext(idx) && isCurrentContext(idx) && isTrialHeader(idx));
        }
        if (creditIdx < 0) {
            creditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && !isPreviousContext(idx) && isCurrentContext(idx) && isTrialHeader(idx));
        }
        if (previousDebitIdx < 0) {
            previousDebitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && isPreviousContext(idx) && isTrialHeader(idx));
        }
        if (previousCreditIdx < 0) {
            previousCreditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && isPreviousContext(idx) && isTrialHeader(idx));
        }

        if (debitIdx < 0) {
            debitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && !isPreviousContext(idx) && isClosingHeader(idx));
        }
        if (creditIdx < 0) {
            creditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && !isPreviousContext(idx) && isClosingHeader(idx));
        }
        if (previousDebitIdx < 0) {
            previousDebitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && isPreviousContext(idx) && isClosingHeader(idx));
        }
        if (previousCreditIdx < 0) {
            previousCreditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && isPreviousContext(idx) && isClosingHeader(idx));
        }
        if (debitIdx < 0) {
            debitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && !isPreviousContext(idx) && !isClosingHeader(idx));
        }
        if (creditIdx < 0) {
            creditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && !isPreviousContext(idx) && !isClosingHeader(idx));
        }
        if (previousDebitIdx < 0) {
            previousDebitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && isPreviousContext(idx) && !isClosingHeader(idx));
        }
        if (previousCreditIdx < 0) {
            previousCreditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && isPreviousContext(idx) && !isClosingHeader(idx));
        }
        if (debitIdx < 0) {
            debitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && !isPreviousContext(idx));
        }
        if (creditIdx < 0) {
            creditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && !isPreviousContext(idx));
        }
        if (previousDebitIdx < 0) {
            previousDebitIdx = findHeaderIndex((idx) => isDebitHeader(idx) && isPreviousContext(idx));
        }
        if (previousCreditIdx < 0) {
            previousCreditIdx = findHeaderIndex((idx) => isCreditHeader(idx) && isPreviousContext(idx));
        }

        // Fallback for two-year TB exports where the child row is detected but year labels are missing/incomplete.
        const closingDebitCandidates = normalized
            .map((_, idx) => idx)
            .filter((idx) => isDebitHeader(idx) && isClosingHeader(idx))
            .sort((a, b) => a - b);
        const closingCreditCandidates = normalized
            .map((_, idx) => idx)
            .filter((idx) => isCreditHeader(idx) && isClosingHeader(idx))
            .sort((a, b) => a - b);
        const trialDebitCandidates = normalized
            .map((_, idx) => idx)
            .filter((idx) => isDebitHeader(idx) && isTrialHeader(idx) && !isClosingHeader(idx))
            .sort((a, b) => a - b);
        const trialCreditCandidates = normalized
            .map((_, idx) => idx)
            .filter((idx) => isCreditHeader(idx) && isTrialHeader(idx) && !isClosingHeader(idx))
            .sort((a, b) => a - b);

        if (debitIdx < 0 && closingDebitCandidates.length > 0) {
            debitIdx = closingDebitCandidates[0];
        }
        if (previousDebitIdx < 0 && closingDebitCandidates.length > 1) {
            previousDebitIdx = closingDebitCandidates.find((idx) => idx !== debitIdx) ?? closingDebitCandidates[1];
        }
        if (creditIdx < 0 && closingCreditCandidates.length > 0) {
            creditIdx = closingCreditCandidates[0];
        }
        if (previousCreditIdx < 0 && closingCreditCandidates.length > 1) {
            previousCreditIdx = closingCreditCandidates.find((idx) => idx !== creditIdx) ?? closingCreditCandidates[1];
        }

        if (debitIdx < 0 && trialDebitCandidates.length > 0) {
            debitIdx = trialDebitCandidates[0];
        }
        if (previousDebitIdx < 0 && trialDebitCandidates.length > 1) {
            previousDebitIdx = trialDebitCandidates.find((idx) => idx !== debitIdx) ?? trialDebitCandidates[1];
        }
        if (creditIdx < 0 && trialCreditCandidates.length > 0) {
            creditIdx = trialCreditCandidates[0];
        }
        if (previousCreditIdx < 0 && trialCreditCandidates.length > 1) {
            previousCreditIdx = trialCreditCandidates.find((idx) => idx !== creditIdx) ?? trialCreditCandidates[1];
        }

        const columnCount = Math.max(
            headers.length,
            rows.reduce((max, row) => Math.max(max, row.length || 0), 0)
        );
        const sampleRows = rows
            .filter(row => row.some(cell => String(cell ?? '').trim() !== ''))
            .slice(0, 200);

        if ((accountIdx < 0 || debitIdx < 0 || creditIdx < 0 || categoryIdx < 0 || previousDebitIdx < 0 || previousCreditIdx < 0) && columnCount > 0 && sampleRows.length > 0) {
            const stats = Array.from({ length: columnCount }, () => ({
                nonEmpty: 0,
                numericCount: 0,
                textCount: 0,
                categoryLikeCount: 0,
                uniqueText: new Set<string>()
            }));

            sampleRows.forEach((row) => {
                for (let col = 0; col < columnCount; col += 1) {
                    const raw = String(row[col] ?? '').trim();
                    if (!raw) continue;
                    const parsed = parseTrialBalanceNumberStrict(raw);
                    const stat = stats[col];
                    stat.nonEmpty += 1;
                    if (!parsed.isEmpty && parsed.isValid) {
                        stat.numericCount += 1;
                        continue;
                    }
                    if (/[a-z]/i.test(raw)) {
                        stat.textCount += 1;
                        const norm = normalizeTbHeaderText(raw);
                        stat.uniqueText.add(norm);
                        if (/^(assets?|liabilit(?:y|ies)|equity|income|expenses?|current assets?|non current assets?|current liabilities?|non current liabilities?)$/.test(norm)) {
                            stat.categoryLikeCount += 1;
                        }
                    }
                }
            });

            const used = new Set<number>([accountIdx, categoryIdx, debitIdx, creditIdx, previousDebitIdx, previousCreditIdx].filter((v): v is number => v >= 0));

            if (accountIdx < 0) {
                let bestCol = -1;
                let bestScore = -Infinity;
                stats.forEach((s, idx) => {
                    if (used.has(idx)) return;
                    const score = (s.textCount * 2) + Math.min(s.uniqueText.size, 20) - (s.numericCount * 2) - (s.categoryLikeCount * 3);
                    if (s.textCount === 0 || s.nonEmpty === 0) return;
                    if (score > bestScore) {
                        bestScore = score;
                        bestCol = idx;
                    }
                });
                if (bestCol >= 0) {
                    accountIdx = bestCol;
                    used.add(bestCol);
                }
            }

            if (categoryIdx < 0) {
                let bestCol = -1;
                let bestScore = -Infinity;
                stats.forEach((s, idx) => {
                    if (used.has(idx)) return;
                    const score = (s.categoryLikeCount * 5) + s.textCount - s.numericCount;
                    if (s.categoryLikeCount <= 0) return;
                    if (score > bestScore) {
                        bestScore = score;
                        bestCol = idx;
                    }
                });
                if (bestCol >= 0) {
                    categoryIdx = bestCol;
                    used.add(bestCol);
                }
            }

            const numericCandidates = stats
                .map((s, idx) => ({
                    idx,
                    score: (s.numericCount * 3) + s.nonEmpty - (s.textCount * 2)
                }))
                .filter(item => !used.has(item.idx) && item.score > 0)
                .sort((a, b) => b.score - a.score);

            if (debitIdx < 0 && creditIdx < 0 && numericCandidates.length >= 2) {
                const topTwo = numericCandidates.slice(0, 2).map(c => c.idx).sort((a, b) => a - b);
                debitIdx = topTwo[0];
                creditIdx = topTwo[1];
                used.add(debitIdx);
                used.add(creditIdx);
            } else {
                if (debitIdx < 0 && numericCandidates.length > 0) {
                    debitIdx = numericCandidates[0].idx;
                    used.add(debitIdx);
                }
                if (creditIdx < 0) {
                    const next = numericCandidates.find(c => c.idx !== debitIdx);
                    if (next) {
                        creditIdx = next.idx;
                        used.add(creditIdx);
                    }
                }
            }

            const remainingNumericCandidates = stats
                .map((s, idx) => ({
                    idx,
                    score: (s.numericCount * 3) + s.nonEmpty - (s.textCount * 2)
                }))
                .filter(item => !used.has(item.idx) && item.score > 0)
                .sort((a, b) => b.score - a.score);

            if (previousDebitIdx < 0 && previousCreditIdx < 0 && remainingNumericCandidates.length >= 2) {
                const topTwo = remainingNumericCandidates.slice(0, 2).map(c => c.idx).sort((a, b) => a - b);
                previousDebitIdx = topTwo[0];
                previousCreditIdx = topTwo[1];
            } else {
                if (previousDebitIdx < 0 && remainingNumericCandidates.length > 0) {
                    previousDebitIdx = remainingNumericCandidates[0].idx;
                }
                if (previousCreditIdx < 0) {
                    const next = remainingNumericCandidates.find(c => c.idx !== previousDebitIdx);
                    if (next) previousCreditIdx = next.idx;
                }
            }
        }

        return {
            account: accountIdx >= 0 ? accountIdx : null,
            category: categoryIdx >= 0 ? categoryIdx : null,
            debit: debitIdx >= 0 ? debitIdx : null,
            credit: creditIdx >= 0 ? creditIdx : null,
            previousDebit: previousDebitIdx >= 0 ? previousDebitIdx : null,
            previousCredit: previousCreditIdx >= 0 ? previousCreditIdx : null
        };
    };

    const createTbExcelRowAmountResolver = (headers: string[], mapping: TbExcelMapping) => {
        const normalized = headers.map(normalizeTbHeaderText);
        const headerWords = normalized.map(h => h.split(/[^a-z0-9]+/).filter(Boolean));
        const hasWord = (idx: number, word: string) => headerWords[idx]?.includes(word);
        const headerYear = normalized.map(h => {
            const match = h.match(/\b(19|20)\d{2}\b/);
            return match ? Number(match[0]) : null;
        });
        const distinctYears = Array.from(new Set(headerYear.filter((y): y is number => y !== null))).sort((a, b) => b - a);
        const detectedCurrentYear = distinctYears[0] ?? null;
        const detectedPreviousYear = distinctYears[1] ?? null;

        const isPreviousContext = (idx: number) =>
            idx >= 0 && (
                /\b(previous|prior|last)\b/.test(normalized[idx])
                || hasWord(idx, 'py')
                || (detectedPreviousYear !== null && headerYear[idx] === detectedPreviousYear)
            );
        const isDebitHeader = (idx: number) =>
            idx >= 0 && (/\bdebit\b/.test(normalized[idx]) || hasWord(idx, 'dr'));
        const isCreditHeader = (idx: number) =>
            idx >= 0 && (/\bcredit\b/.test(normalized[idx]) || hasWord(idx, 'cr'));
        const isTrialHeader = (idx: number) =>
            idx >= 0 && (/\btrial\b/.test(normalized[idx]) || /\btrail\b/.test(normalized[idx]));
        const isClosingHeader = (idx: number) =>
            idx >= 0 && (/\bclosing\b/.test(normalized[idx]) || /\bclosing balance\b/.test(normalized[idx]));

        type TbPairSource = 'closing' | 'trial' | 'mapped';
        type TbPair = { debit: number; credit: number; source: TbPairSource };
        type YearScope = 'current' | 'previous';

        const parseCell = (row: unknown[], idx: number | null) => (
            normalizeTbExtractedAmount(idx !== null && idx >= 0 ? parseTrialBalanceNumber(row[idx]) : 0)
        );

        const nonZeroCount = (pair: TbPair) => {
            let count = 0;
            if (Math.abs(pair.debit) > 0.01) count += 1;
            if (Math.abs(pair.credit) > 0.01) count += 1;
            return count;
        };

        const getMappedPairKind = (debitIdx: number | null, creditIdx: number | null): TbPairSource => {
            const indices = [debitIdx, creditIdx].filter((v): v is number => v !== null && v >= 0);
            const hasClosing = indices.some(isClosingHeader);
            const hasTrial = indices.some(isTrialHeader);
            if (hasClosing && !hasTrial) return 'closing';
            if (hasTrial && !hasClosing) return 'trial';
            return 'mapped';
        };

        const findPairForScope = (scope: YearScope, kind: 'closing' | 'trial') => {
            const inScope = (idx: number) => scope === 'previous' ? isPreviousContext(idx) : !isPreviousContext(idx);
            const anchorDebitIdx = scope === 'current' ? mapping.debit : mapping.previousDebit;
            const anchorCreditIdx = scope === 'current' ? mapping.credit : mapping.previousCredit;
            const debitCandidates = normalized
                .map((_, idx) => idx)
                .filter((idx) => inScope(idx) && isDebitHeader(idx) && (kind === 'closing' ? isClosingHeader(idx) : isTrialHeader(idx)));
            const creditCandidates = normalized
                .map((_, idx) => idx)
                .filter((idx) => inScope(idx) && isCreditHeader(idx) && (kind === 'closing' ? isClosingHeader(idx) : isTrialHeader(idx)));

            if (debitCandidates.length === 0 && creditCandidates.length === 0) return null;
            const sortByAnchor = (candidates: number[], anchor: number | null) => {
                if (anchor === null || anchor < 0 || candidates.length <= 1) return candidates;
                return [...candidates].sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor));
            };
            const sortedDebitCandidates = sortByAnchor(debitCandidates, anchorDebitIdx);
            const sortedCreditCandidates = sortByAnchor(creditCandidates, anchorCreditIdx);
            return {
                debitIdx: sortedDebitCandidates[0] ?? null,
                creditIdx: sortedCreditCandidates[0] ?? null
            };
        };

        const resolveYearPair = (row: unknown[], scope: YearScope): TbPair => {
            const primaryDebitIdx = scope === 'current' ? mapping.debit : mapping.previousDebit;
            const primaryCreditIdx = scope === 'current' ? mapping.credit : mapping.previousCredit;
            const primaryKind = getMappedPairKind(primaryDebitIdx, primaryCreditIdx);
            const primaryPair: TbPair = {
                debit: parseCell(row, primaryDebitIdx),
                credit: parseCell(row, primaryCreditIdx),
                source: primaryKind
            };

            const closingPairIdx = findPairForScope(scope, 'closing');
            const trialPairIdx = findPairForScope(scope, 'trial');
            const closingPair: TbPair | null = closingPairIdx ? {
                debit: parseCell(row, closingPairIdx.debitIdx),
                credit: parseCell(row, closingPairIdx.creditIdx),
                source: 'closing'
            } : null;
            const trialPair: TbPair | null = trialPairIdx ? {
                debit: parseCell(row, trialPairIdx.debitIdx),
                credit: parseCell(row, trialPairIdx.creditIdx),
                source: 'trial'
            } : null;

            const hasMappedDebit = primaryDebitIdx !== null && primaryDebitIdx >= 0;
            const hasMappedCredit = primaryCreditIdx !== null && primaryCreditIdx >= 0;
            const hasExplicitMapping = hasMappedDebit || hasMappedCredit;
            const primaryHasValues = nonZeroCount(primaryPair) > 0;
            const fallbackPairs = [closingPair, trialPair].filter((pair): pair is TbPair => pair !== null);
            const fallbackHasValues = fallbackPairs.some(pair => nonZeroCount(pair) > 0);

            // Respect mapped columns first; only fall back to auto-detected pairs when mapped values are empty.
            if (hasExplicitMapping && (primaryHasValues || !fallbackHasValues)) {
                if (nonZeroCount(primaryPair) === 2) {
                    if (Math.abs(primaryPair.debit) >= Math.abs(primaryPair.credit)) {
                        return { ...primaryPair, credit: 0 };
                    }
                    return { ...primaryPair, debit: 0 };
                }
                return primaryPair;
            }

            const candidates: TbPair[] = [
                primaryPair,
                ...(closingPair ? [closingPair] : []),
                ...(trialPair ? [trialPair] : [])
            ];

            const uniqueCandidates = candidates.filter((candidate, idx, arr) => {
                return arr.findIndex(other =>
                    other.source === candidate.source
                    && Math.abs(other.debit - candidate.debit) <= 0.000001
                    && Math.abs(other.credit - candidate.credit) <= 0.000001
                ) === idx;
            });

            const scorePair = (pair: TbPair) => {
                const count = nonZeroCount(pair);
                const magnitude = Math.abs(pair.debit) + Math.abs(pair.credit);
                const maxSide = Math.max(Math.abs(pair.debit), Math.abs(pair.credit), 0);
                const minSide = Math.min(Math.abs(pair.debit), Math.abs(pair.credit), maxSide);
                const sideRatio = maxSide > 0 ? (minSide / maxSide) : 0;
                const sourceBonus = pair.source === 'closing' ? 20 : pair.source === 'trial' ? 10 : 0;
                const shapeScore = count === 1 ? 100 : count === 0 ? 0 : -(40 + Math.round(sideRatio * 30));
                const magnitudeScore = Math.min(magnitude, 1_000_000_000) / 1_000_000;
                return shapeScore + sourceBonus + magnitudeScore;
            };

            uniqueCandidates.sort((a, b) => scorePair(b) - scorePair(a));
            const best = uniqueCandidates[0] ?? primaryPair;

            // If we still ended up with both sides populated, keep the dominant side only.
            if (nonZeroCount(best) === 2) {
                if (Math.abs(best.debit) >= Math.abs(best.credit)) {
                    return { ...best, credit: 0 };
                }
                return { ...best, debit: 0 };
            }

            return best;
        };

        return (row: unknown[]) => {
            const current = resolveYearPair(row, 'current');
            const previous = resolveYearPair(row, 'previous');
            return {
                debit: current.debit,
                credit: current.credit,
                previousDebit: previous.debit,
                previousCredit: previous.credit
            };
        };
    };

    const resolveTbExcelRowAmountsWithImportMode = (
        row: unknown[],
        mapping: TbExcelMapping,
        resolveRowAmounts: (nextRow: unknown[]) => { debit: number; credit: number; previousDebit: number; previousCredit: number },
        yearMode: TbYearImportMode
    ) => {
        const raw = resolveRowAmounts(row);
        const hasCurrentMapping = mapping.debit !== null || mapping.credit !== null;
        const hasPreviousMapping = mapping.previousDebit !== null || mapping.previousCredit !== null;

        // If both year sets are explicitly mapped, trust mapping and do not zero out one side by mode.
        if (hasCurrentMapping && hasPreviousMapping) {
            return raw;
        }

        return applyTbYearImportModeToAmounts(raw, yearMode);
    };

    const buildTrialBalanceEntriesFromMapping = (
        rows: unknown[][],
        mapping: TbExcelMapping,
        headers: string[] = tbExcelHeaders,
        yearMode: TbYearImportMode = tbYearImportMode
    ) => {
        const entries: TrialBalanceEntry[] = [];
        const resolveRowAmounts = createTbExcelRowAmountResolver(headers, mapping);

        rows.forEach((row) => {
            const accountRaw = mapping.account !== null ? String(row[mapping.account] ?? '').trim() : '';
            if (!accountRaw) return;
            if (shouldSkipTbAccountLikeRow(accountRaw)) return;

            const resolvedAmounts = resolveTbExcelRowAmountsWithImportMode(row, mapping, resolveRowAmounts, yearMode);
            const currentNormalized = normalizeTbDebitCreditPair(resolvedAmounts.debit, resolvedAmounts.credit);
            const previousNormalized = normalizeTbDebitCreditPair(resolvedAmounts.previousDebit, resolvedAmounts.previousCredit);
            const debitValue = currentNormalized.debit;
            const creditValue = currentNormalized.credit;
            const previousDebitValue = previousNormalized.debit;
            const previousCreditValue = previousNormalized.credit;
            if (debitValue === 0 && creditValue === 0 && previousDebitValue === 0 && previousCreditValue === 0) return;
            const rawCategory = mapping.category !== null ? String(row[mapping.category] ?? '').trim() : '';
            const normalizedCategory = normalizeOpeningBalanceCategory(rawCategory) || (rawCategory || undefined);

            entries.push({
                account: accountRaw,
                category: normalizedCategory,
                debit: debitValue,
                credit: creditValue,
                previousDebit: previousDebitValue,
                previousCredit: previousCreditValue
            });
        });

        return entries;
    };

    const updateTrialBalanceEntries = (
        entries: TrialBalanceEntry[],
        options?: { replace?: boolean; groupDuplicateExtractedToNotes?: boolean; yearImportMode?: TbYearImportMode }
    ) => {
        const AUTO_GROUP_NOTE_PREFIX = '[Auto Grouped Extract] ';
        const shouldGroupDuplicateExtractedRows = !!options?.groupDuplicateExtractedToNotes;
        const yearImportMode = normalizeTbYearImportMode(options?.yearImportMode);
        const nextTbNotes: Record<string, TbWorkingNoteEntry[]> = shouldGroupDuplicateExtractedRows
            ? JSON.parse(JSON.stringify(tbWorkingNotes || {}))
            : tbWorkingNotes;
        const touchedGroupedAccounts = new Set<string>();

        const getNotesForAccount = (accountName: string) => (nextTbNotes[accountName] || []);
        const clearAutoGroupedNotes = (accountName: string) => {
            if (!shouldGroupDuplicateExtractedRows || touchedGroupedAccounts.has(accountName)) return;
            touchedGroupedAccounts.add(accountName);
            const existing = nextTbNotes[accountName] || [];
            nextTbNotes[accountName] = existing.filter(n => !String(n.description || '').startsWith(AUTO_GROUP_NOTE_PREFIX));
        };
        const appendAutoGroupedNote = (
            accountName: string,
            sourceLabel: string,
            debit: number,
            credit: number,
            yearScope: TbNoteYearScope
        ) => {
            if (!shouldGroupDuplicateExtractedRows) return;
            if (Math.abs(debit) <= 0.01 && Math.abs(credit) <= 0.01) return;
            clearAutoGroupedNotes(accountName);
            const existing = nextTbNotes[accountName] || [];
            nextTbNotes[accountName] = [
                ...existing,
                {
                    description: `${AUTO_GROUP_NOTE_PREFIX}${sourceLabel || accountName}`,
                    debit,
                    credit,
                    yearScope
                }
            ];
        };

        setAdjustedTrialBalance(prev => {
            const currentMap: Record<string, TrialBalanceEntry> = {};
            if (!options?.replace) {
                (prev || []).forEach(item => {
                    if (item.account.toLowerCase() !== 'totals') currentMap[item.account.toLowerCase()] = item;
                });
            }

            const incomingCounts: Record<string, number> = {};
            entries.forEach(extracted => {
                if (!extracted.account || extracted.account.toLowerCase() === 'totals') return;
                const baseDebit = normalizeTbExtractedAmount(extracted.debit);
                const baseCredit = normalizeTbExtractedAmount(extracted.credit);
                const extractedPreviousDebit = normalizeTbExtractedAmount(extracted.previousDebit ?? 0);
                const extractedPreviousCredit = normalizeTbExtractedAmount(extracted.previousCredit ?? 0);
                if (baseDebit === 0 && baseCredit === 0 && extractedPreviousDebit === 0 && extractedPreviousCredit === 0) return;
                let mappedName = extracted.account;
                const standardAccounts = Object.keys(CT_REPORTS_ACCOUNTS);
                const match = standardAccounts.find(sa => sa.toLowerCase() === extracted.account.toLowerCase());
                if (match) mappedName = match;

                let finalCategory = extracted.category;
                const normCat = normalizeOpeningBalanceCategory(extracted.category);
                if (normCat) finalCategory = normCat;

                const mapKey = mappedName.toLowerCase();
                incomingCounts[mapKey] = (incomingCounts[mapKey] || 0) + 1;

                if (shouldGroupDuplicateExtractedRows && incomingCounts[mapKey] > 1) {
                    appendAutoGroupedNote(mappedName, extracted.account, baseDebit, baseCredit, 'current');
                    appendAutoGroupedNote(mappedName, extracted.account, extractedPreviousDebit, extractedPreviousCredit, 'previous');
                    const groupedNotes = getNotesForAccount(mappedName);
                    const groupedNoteTotals = getTbWorkingNoteTotals(groupedNotes);
                    const existingItem = currentMap[mapKey];
                    if (existingItem) {
                        const existingBaseAmounts = getTbRowBaseAmounts(existingItem, groupedNotes);
                        const mergedBaseDebit = existingBaseAmounts.baseDebit;
                        const mergedBaseCredit = existingBaseAmounts.baseCredit;
                        const mergedBasePreviousDebit = existingBaseAmounts.basePreviousDebit;
                        const mergedBasePreviousCredit = existingBaseAmounts.basePreviousCredit;
                        currentMap[mapKey] = {
                            ...existingItem,
                            category: existingItem.category || finalCategory,
                            baseDebit: mergedBaseDebit,
                            baseCredit: mergedBaseCredit,
                            basePreviousDebit: mergedBasePreviousDebit,
                            basePreviousCredit: mergedBasePreviousCredit,
                            debit: mergedBaseDebit + groupedNoteTotals.currentDebit,
                            credit: mergedBaseCredit + groupedNoteTotals.currentCredit,
                            previousDebit: mergedBasePreviousDebit + groupedNoteTotals.previousDebit,
                            previousCredit: mergedBasePreviousCredit + groupedNoteTotals.previousCredit
                        };
                    }
                    return;
                }

                clearAutoGroupedNotes(mappedName);
                const effectiveNotes = getNotesForAccount(mappedName);
                const noteTotals = getTbWorkingNoteTotals(effectiveNotes);
                const existingItem = currentMap[mapKey];
                const existingBaseAmounts = existingItem ? getTbRowBaseAmounts(existingItem, effectiveNotes) : null;
                const mergedBaseDebit = yearImportMode === 'previous_only' && existingBaseAmounts ? existingBaseAmounts.baseDebit : baseDebit;
                const mergedBaseCredit = yearImportMode === 'previous_only' && existingBaseAmounts ? existingBaseAmounts.baseCredit : baseCredit;
                const mergedBasePreviousDebit = yearImportMode === 'current_only' && existingBaseAmounts ? existingBaseAmounts.basePreviousDebit : extractedPreviousDebit;
                const mergedBasePreviousCredit = yearImportMode === 'current_only' && existingBaseAmounts ? existingBaseAmounts.basePreviousCredit : extractedPreviousCredit;

                currentMap[mapKey] = {
                    ...(existingItem || {}),
                    ...extracted,
                    account: mappedName,
                    category: finalCategory,
                    baseDebit: mergedBaseDebit,
                    baseCredit: mergedBaseCredit,
                    basePreviousDebit: mergedBasePreviousDebit,
                    basePreviousCredit: mergedBasePreviousCredit,
                    debit: mergedBaseDebit + noteTotals.currentDebit,
                    credit: mergedBaseCredit + noteTotals.currentCredit,
                    previousDebit: mergedBasePreviousDebit + noteTotals.previousDebit,
                    previousCredit: mergedBasePreviousCredit + noteTotals.previousCredit
                };
            });

            const newEntries = Object.values(currentMap);
            return [...newEntries, buildTbTotalsRow(newEntries)];
        });
        if (shouldGroupDuplicateExtractedRows) {
            setTbWorkingNotes(nextTbNotes);
        }
        setAutoPopulateTrigger(prev => prev + 1);
    };

    const tbExcelValidation = useMemo(() => {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (tbExcelRows.length === 0) {
            errors.push('No data rows detected.');
            return {
                errors,
                warnings,
                stats: {
                    totalRows: 0,
                    sumDebit: 0,
                    sumCredit: 0,
                    variance: 0,
                    sumPreviousDebit: 0,
                    sumPreviousCredit: 0,
                    previousVariance: 0
                }
            };
        }

        const mappingValues = [
            tbExcelMapping.account,
            tbExcelMapping.category,
            tbExcelMapping.debit,
            tbExcelMapping.credit,
            tbExcelMapping.previousDebit,
            tbExcelMapping.previousCredit
        ]
            .filter((v): v is number => v !== null);
        const duplicates = mappingValues.filter((v, i) => mappingValues.indexOf(v) !== i);
        if (duplicates.length > 0) errors.push('Each field must map to a unique column.');

        if (tbExcelMapping.account === null) errors.push('Map the Account column.');
        if (tbExcelMapping.debit === null) errors.push('Map the Current Year Debit column.');
        if (tbExcelMapping.credit === null) errors.push('Map the Current Year Credit column.');
        if (tbExcelMapping.category === null) warnings.push('Category not mapped; accounts will be auto-classified.');

        let missingAccount = 0;
        let missingAccountWithAmounts = 0;
        let invalidNumbers = 0;
        let totalRows = 0;
        let sumDebit = 0;
        let sumCredit = 0;
        let sumPreviousDebit = 0;
        let sumPreviousCredit = 0;
        const resolveRowAmounts = createTbExcelRowAmountResolver(tbExcelHeaders, tbExcelMapping);

        tbExcelRows.forEach((row) => {
            const rowHasValues = row.some(cell => String(cell ?? '').trim() !== '');
            if (!rowHasValues) return;

            const accountRaw = tbExcelMapping.account !== null ? String(row[tbExcelMapping.account] ?? '').trim() : '';
            if (!accountRaw) {
                missingAccount += 1;
                const resolved = resolveTbExcelRowAmountsWithImportMode(row, tbExcelMapping, resolveRowAmounts, tbYearImportMode);
                const currentNormalized = normalizeTbDebitCreditPair(resolved.debit, resolved.credit);
                const previousNormalized = normalizeTbDebitCreditPair(resolved.previousDebit, resolved.previousCredit);
                if (
                    currentNormalized.debit !== 0
                    || currentNormalized.credit !== 0
                    || previousNormalized.debit !== 0
                    || previousNormalized.credit !== 0
                ) {
                    missingAccountWithAmounts += 1;
                }
                return;
            }
            if (shouldSkipTbAccountLikeRow(accountRaw)) return;
            totalRows += 1;

            if (tbExcelMapping.debit !== null) {
                const parsed = parseTrialBalanceNumberStrict(row[tbExcelMapping.debit]);
                if (!parsed.isValid) invalidNumbers += 1;
            }

            if (tbExcelMapping.credit !== null) {
                const parsed = parseTrialBalanceNumberStrict(row[tbExcelMapping.credit]);
                if (!parsed.isValid) invalidNumbers += 1;
            }

            if (tbExcelMapping.previousDebit !== null) {
                const parsed = parseTrialBalanceNumberStrict(row[tbExcelMapping.previousDebit]);
                if (!parsed.isValid) invalidNumbers += 1;
            }

            if (tbExcelMapping.previousCredit !== null) {
                const parsed = parseTrialBalanceNumberStrict(row[tbExcelMapping.previousCredit]);
                if (!parsed.isValid) invalidNumbers += 1;
            }

            const resolved = resolveTbExcelRowAmountsWithImportMode(row, tbExcelMapping, resolveRowAmounts, tbYearImportMode);
            const currentNormalized = normalizeTbDebitCreditPair(resolved.debit, resolved.credit);
            const previousNormalized = normalizeTbDebitCreditPair(resolved.previousDebit, resolved.previousCredit);
            sumDebit += currentNormalized.debit;
            sumCredit += currentNormalized.credit;
            sumPreviousDebit += previousNormalized.debit;
            sumPreviousCredit += previousNormalized.credit;
        });

        if (missingAccountWithAmounts > 0) {
            warnings.push(`${missingAccountWithAmounts} row(s) had amounts but blank Account and were skipped.`);
        } else if (missingAccount > 0) {
            warnings.push(`${missingAccount} row(s) with blank Account were skipped.`);
        }
        if (invalidNumbers > 0) errors.push(`${invalidNumbers} row(s) have invalid Debit/Credit values.`);
        if (totalRows === 0) errors.push('No data rows detected.');

        const variance = Math.abs(sumDebit - sumCredit);
        if (variance > 0.01) warnings.push(`Trial Balance variance: ${formatNumber(variance)}.`);
        const previousVariance = Math.abs(sumPreviousDebit - sumPreviousCredit);
        if ((tbExcelMapping.previousDebit !== null || tbExcelMapping.previousCredit !== null) && previousVariance > 0.01) {
            warnings.push(`Previous Year variance: ${formatNumber(previousVariance)}.`);
        }
        if (
            tbYearImportMode !== 'auto'
            && (tbExcelMapping.debit !== null || tbExcelMapping.credit !== null)
            && (tbExcelMapping.previousDebit !== null || tbExcelMapping.previousCredit !== null)
        ) {
            warnings.push('Year Import mode is ignored for Excel because both CY and PY columns are mapped explicitly.');
        }

        return {
            errors,
            warnings,
            stats: { totalRows, sumDebit, sumCredit, variance, sumPreviousDebit, sumPreviousCredit, previousVariance }
        };
    }, [tbExcelRows, tbExcelMapping, tbExcelHeaders, tbYearImportMode]);

    const tbExcelPreview = useMemo(() => {
        const preview: { account: string; category: string; debit: number; credit: number; previousDebit: number; previousCredit: number }[] = [];
        const resolveRowAmounts = createTbExcelRowAmountResolver(tbExcelHeaders, tbExcelMapping);
        for (let i = 0; i < tbExcelRows.length && preview.length < 8; i += 1) {
            const row = tbExcelRows[i];
            const accountRaw = tbExcelMapping.account !== null ? String(row[tbExcelMapping.account] ?? '').trim() : '';
            if (!accountRaw) continue;
            if (shouldSkipTbAccountLikeRow(accountRaw)) continue;
            const rawCategory = tbExcelMapping.category !== null ? String(row[tbExcelMapping.category] ?? '').trim() : '';
            const resolved = resolveTbExcelRowAmountsWithImportMode(row, tbExcelMapping, resolveRowAmounts, tbYearImportMode);
            const currentNormalized = normalizeTbDebitCreditPair(resolved.debit, resolved.credit);
            const previousNormalized = normalizeTbDebitCreditPair(resolved.previousDebit, resolved.previousCredit);
            preview.push({
                account: accountRaw,
                category: rawCategory,
                debit: currentNormalized.debit,
                credit: currentNormalized.credit,
                previousDebit: previousNormalized.debit,
                previousCredit: previousNormalized.credit
            });
        }
        return preview;
    }, [tbExcelRows, tbExcelMapping, tbExcelHeaders, tbYearImportMode]);

    const handleImportTrialBalanceExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsExtractingTB(true);
        setExtractionStatus('Reading Excel file...');
        setExtractionAlert(null);

        try {
            const { sheetNames, sheetName, headers, rows } = await loadTbExcelSheet(file);
            if (!rows || rows.length === 0) {
                setExtractionAlert({ type: 'error', message: 'No Trial Balance rows found in the Excel file. Please check the sheet format.' });
                return;
            }

            setTbExcelFile(file);
            setTbExcelSheetNames(sheetNames);
            setTbExcelSheetName(sheetName);
            setTbExcelHeaders(headers);
            setTbExcelRows(rows);
            setTbExcelMapping(guessTbExcelMapping(headers, rows));
            setShowTbExcelModal(true);
        } catch (err) {
            console.error('TB Excel import failed', err);
            setExtractionAlert({ type: 'error', message: 'Unable to read the Excel file. Please use a valid .xlsx/.xls file.' });
        } finally {
            setIsExtractingTB(false);
            setExtractionStatus('');
            if (tbExcelInputRef.current) tbExcelInputRef.current.value = '';
        }
    };

    const handleTbExcelSheetChange = async (nextSheet: string) => {
        if (!tbExcelFile) return;
        setIsExtractingTB(true);
        setExtractionStatus('Loading sheet...');
        try {
            const { sheetName, headers, rows } = await loadTbExcelSheet(tbExcelFile, nextSheet);
            setTbExcelSheetName(sheetName);
            setTbExcelHeaders(headers);
            setTbExcelRows(rows);
            setTbExcelMapping(guessTbExcelMapping(headers, rows));
        } catch (err) {
            console.error('TB Excel sheet load failed', err);
            setExtractionAlert({ type: 'error', message: 'Unable to load the selected sheet.' });
        } finally {
            setIsExtractingTB(false);
            setExtractionStatus('');
        }
    };

    const resetTbExcelModal = () => {
        setShowTbExcelModal(false);
        setTbExcelFile(null);
        setTbExcelSheetNames([]);
        setTbExcelSheetName('');
        setTbExcelHeaders([]);
        setTbExcelRows([]);
        setTbExcelMapping({ account: null, category: null, debit: null, credit: null, previousDebit: null, previousCredit: null });
    };

    const resetTbUpdateModal = () => {
        setShowTbUpdateModal(false);
        setTbUpdateExcelFile(null);
        setTbUpdateJsonFile(null);
        setTbUpdateJsonLabel('');
        setTbUpdateJsonData(null);
        setTbUpdateSheetNames([]);
        setTbUpdateSheetName('');
        setTbUpdatePreview([]);
        setTbUpdateAuditLog([]);
        setTbUpdateStats({ matchedRows: 0, updatedCells: 0, sheetName: '' });
        setTbUpdateError(null);
        setTbUpdateLoading(false);
        if (tbUpdateExcelInputRef.current) tbUpdateExcelInputRef.current.value = '';
        if (tbUpdateJsonInputRef.current) tbUpdateJsonInputRef.current.value = '';
    };

    const handleTbUpdateExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setTbUpdateExcelFile(file);
        setTbUpdatePreview([]);
        setTbUpdateAuditLog([]);
        setTbUpdateStats({ matchedRows: 0, updatedCells: 0, sheetName: '' });
        setTbUpdateError(null);

        try {
            if (!XLSX?.read) throw new Error('Excel library not loaded.');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetNames = workbook.SheetNames || [];
            setTbUpdateSheetNames(sheetNames);
            setTbUpdateSheetName(sheetNames[0] || '');
        } catch (err) {
            console.error('Failed to read Excel sheet names', err);
            setTbUpdateSheetNames([]);
            setTbUpdateSheetName('');
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const handleTbUpdateJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setTbUpdateJsonFile(file);
        setTbUpdateJsonLabel(file.name);
        setTbUpdatePreview([]);
        setTbUpdateAuditLog([]);
        setTbUpdateStats({ matchedRows: 0, updatedCells: 0, sheetName: '' });
        setTbUpdateError(null);

        try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            setTbUpdateJsonData(parsed);
        } catch (err) {
            console.error('Failed to parse JSON', err);
            setTbUpdateJsonData(null);
            setTbUpdateError('Invalid JSON file. Please upload a valid PDF extraction JSON.');
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    const handleUseCurrentTbForUpdate = () => {
        if (!adjustedTrialBalance || adjustedTrialBalance.length === 0) {
            setTbUpdateError('No extracted Trial Balance data is available to use.');
            return;
        }
        const entries = normalizeTrialBalanceEntries(adjustedTrialBalance).map(entry => ({
            ledgerName: entry.account,
            debit: Number(entry.debit) || 0,
            credit: Number(entry.credit) || 0,
            balance: round2((Number(entry.debit) || 0) - (Number(entry.credit) || 0))
        }));
        setTbUpdateJsonData(entries);
        setTbUpdateJsonFile(null);
        setTbUpdateJsonLabel('Current extracted Trial Balance');
        setTbUpdatePreview([]);
        setTbUpdateAuditLog([]);
        setTbUpdateStats({ matchedRows: 0, updatedCells: 0, sheetName: '' });
        setTbUpdateError(null);
    };

    const downloadBase64File = (base64: string, fileName: string, mimeType: string) => {
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i += 1) {
            byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const handleDownloadTbUpdateAuditLog = () => {
        if (!tbUpdateAuditLog.length) return;
        const blob = new Blob([JSON.stringify(tbUpdateAuditLog, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'trial_balance_update_audit_log.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const runTbUpdate = async (dryRun: boolean) => {
        if (!tbUpdateExcelFile) {
            setTbUpdateError('Select an Excel file to update.');
            return;
        }
        if (!tbUpdateJsonData) {
            setTbUpdateError('Provide PDF extracted JSON data.');
            return;
        }

        setTbUpdateLoading(true);
        setTbUpdateError(null);

        try {
            const result = await ctFilingService.updateTrialBalanceExcel({
                excelFile: tbUpdateExcelFile,
                pdfJson: tbUpdateJsonData,
                sheetName: tbUpdateSheetName || undefined,
                dryRun
            });

            setTbUpdatePreview(result?.preview || []);
            setTbUpdateAuditLog(result?.auditLog || []);
            setTbUpdateStats({
                matchedRows: result?.matchedRows || 0,
                updatedCells: result?.updatedCells || 0,
                sheetName: result?.sheetName || tbUpdateSheetName
            });

            if (!dryRun && result?.fileBase64) {
                downloadBase64File(
                    result.fileBase64,
                    result.fileName || `updated_${tbUpdateExcelFile.name}`,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                );
            }
        } catch (err: any) {
            console.error('Excel update failed', err);
            setTbUpdateError(err?.message || 'Unable to update Excel file.');
        } finally {
            setTbUpdateLoading(false);
        }
    };

    const handleConfirmTbExcelImport = () => {
        if (tbExcelValidation.errors.length > 0) return;
        const entries = buildTrialBalanceEntriesFromMapping(tbExcelRows, tbExcelMapping, tbExcelHeaders, tbYearImportMode);
        if (!entries.length) {
            setExtractionAlert({ type: 'error', message: 'No Trial Balance rows found after applying the mapping.' });
            resetTbExcelModal();
            return;
        }

        const sumDebit = entries.reduce((s, entry) => s + (Number(entry.debit) || 0), 0);
        const sumCredit = entries.reduce((s, entry) => s + (Number(entry.credit) || 0), 0);
        const variance = Math.abs(sumDebit - sumCredit);

        if (variance > 10) {
            setExtractionAlert({
                type: 'warning',
                message: `Excel import complete, but Trial Balance is out of balance by ${formatNumber(variance)}. Please review the imported rows below.`
            });
        } else {
            setExtractionAlert({ type: 'success', message: 'Trial Balance imported from Excel and balances.' });
        }

        updateTrialBalanceEntries(entries, {
            replace: tbYearImportMode === 'auto',
            groupDuplicateExtractedToNotes: tbGroupExtractedRowsToNotes,
            yearImportMode: tbYearImportMode
        });
        resetTbExcelModal();
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
            const extractedEntries = await extractOpeningBalanceDataFromFiles(files, { mode: 'ct3_trial_balance' });
            console.log(`[TB Extraction] AI returned ${extractedEntries?.length || 0} entries.`);

            if (extractedEntries && extractedEntries.length > 0) {
                const adjustedEntriesForMode = applyTbYearImportModeToEntries(extractedEntries, tbYearImportMode);
                const sumDebit = adjustedEntriesForMode.reduce((s, e) => s + (Number(e.debit) || 0), 0);
                const sumCredit = adjustedEntriesForMode.reduce((s, e) => s + (Number(e.credit) || 0), 0);
                const variance = Math.abs(sumDebit - sumCredit);

                if (variance > 10) {
                    setExtractionAlert({
                        type: 'warning',
                        message: `Extraction complete, but Trial Balance is out of balance by ${formatNumber(variance)}. Please review the extracted rows below.`
                    });
                } else {
                    setExtractionAlert({ type: 'success', message: 'Trial Balance extracted successfully and balances.' });
                }

                updateTrialBalanceEntries(
                    adjustedEntriesForMode,
                    {
                        groupDuplicateExtractedToNotes: tbGroupExtractedRowsToNotes,
                        yearImportMode: tbYearImportMode
                    }
                );
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
                            .filter(acc => !acc.subCategory?.startsWith('Extracted'))
                            .map(acc => ({ ...acc }))
                    }));

                    // Helper to update or add an account
                    const upsertAccount = (categoryName: string, accountName: string, debit: number, credit: number, subCategory?: string) => {
                        const category = newData.find(c => c.category === categoryName);
                        if (!category) return false;

                        // Normalize for fuzzy match
                        const normalizedSearch = normalizeAccountName(accountName);

                        // 1. Try exact name match
                        // MODIFIED: Do NOT merge extracted accounts. Always append. 
                        // This fixes the issue where distinct rows (e.g. multiple "Cash" entries or similar names) were getting merged/lost.
                        // We trust the AI to give us distinct rows.

                        /* 
                        let targetAccount = category.accounts.find(a =>
                            a.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch
                        );
                        */

                        const hasExactMatch = category.accounts.some(acc =>
                            normalizeAccountName(acc.name) === normalizedSearch
                            && Math.abs(acc.debit) === Math.abs(debit)
                            && Math.abs(acc.credit) === Math.abs(credit)
                        );
                        if (hasExactMatch) return false;

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
                                subCategory: subCategory || 'Extracted'
                            });
                            return true;
                        }
                    };

                    // Iterate through extracted entries
                    extractedEntries.forEach(entry => {
                        const normalizedAmounts = normalizeDebitCredit(entry.debit || 0, entry.credit || 0);
                        // if (debit === 0 && credit === 0) return; // ALLOW ZERO VALUES

                        const rawName = String(entry.account || '').trim();
                        if (!rawName) return;

                        const lookup = ACCOUNT_LOOKUP[normalizeAccountName(rawName)];
                        const name = lookup?.name || rawName;

                        let targetCategory = normalizeOpeningBalanceCategory(entry.category)
                            || lookup?.category
                            || CT_REPORTS_ACCOUNTS[name]
                            || CT_REPORTS_ACCOUNTS[rawName];

                        if (!targetCategory) {
                            targetCategory = inferCategoryFromAccount(name);
                        }

                        const subCategory = lookup?.subCategory ? `Extracted - ${lookup.subCategory}` : 'Extracted';
                        upsertAccount(targetCategory, name, normalizedAmounts.debit, normalizedAmounts.credit, subCategory);
                    });

                    return newData;
                });
                setAutoPopulateTrigger(prev => prev + 1);
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

        if (!XLSX?.utils) {
            alert('Excel export is not available right now.');
            return;
        }

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        worksheet['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 15 }];
        applySheetStyling(worksheet, 0, 0); // reuse styling helper from export helpers
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Opening Balances');
        XLSX.writeFile(workbook, `${companyName}_OpeningBalances.xlsx`);
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
            className={`w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:ring-0 p-1 text-foreground transition-all text-xs font-medium outline-none ${className}`}
        />
    );

    const ReportNumberInput = ({ field, className = "" }: { field: string, className?: string }) => (
        <input
            type="number"
            step="0.01"
            value={reportForm[field] || 0}
            onChange={(e) => handleReportFormChange(field, parseFloat(e.target.value) || 0)}
            className={`w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:ring-0 p-1 text-right font-mono text-foreground transition-all text-xs font-bold outline-none ${className}`}
        />
    );

    const getCurrentTbEntry = () => {
        if (!currentTbAccount || !adjustedTrialBalance) return { baseDebit: 0, baseCredit: 0, basePreviousDebit: 0, basePreviousCredit: 0 };
        const item = adjustedTrialBalance.find(i => i.account === currentTbAccount);
        if (!item) return { baseDebit: 0, baseCredit: 0, basePreviousDebit: 0, basePreviousCredit: 0 };
        const notes = (tbWorkingNotes[currentTbAccount] || []) as TbWorkingNoteEntry[];
        const baseAmounts = getTbRowBaseAmounts(item, notes);
        return {
            baseDebit: baseAmounts.baseDebit,
            baseCredit: baseAmounts.baseCredit,
            basePreviousDebit: baseAmounts.basePreviousDebit,
            basePreviousCredit: baseAmounts.basePreviousCredit
        };
    };

    const getSelectedTrialBalanceRows = () => {
        if (!adjustedTrialBalance) return [] as TrialBalanceEntry[];
        return adjustedTrialBalance.filter(item => item.account.toLowerCase() !== 'totals' && !!tbSelectedAccounts[item.account]);
    };

    const handleOpenTbCoaGroupModal = () => {
        const selectedRows = getSelectedTrialBalanceRows();
        if (selectedRows.length === 0) {
            setExtractionAlert({ type: 'warning', message: 'Select one or more Trial Balance rows to group into a Chart of Accounts item.' });
            return;
        }
        setTbCoaSearch('');
        setShowTbCoaGroupModal(true);
    };

    const handleApplyTbCoaGrouping = () => {
        if (!adjustedTrialBalance) return;

        const targetAccount = (tbCoaTargetAccount || '').trim();
        if (!targetAccount) {
            setExtractionAlert({ type: 'warning', message: 'Select a target Chart of Accounts item before grouping.' });
            return;
        }

        const selectedRows = getSelectedTrialBalanceRows();
        if (selectedRows.length === 0) {
            setExtractionAlert({ type: 'warning', message: 'No Trial Balance rows are selected.' });
            return;
        }

        const rowsToMove = selectedRows.filter(row => row.account !== targetAccount);
        if (rowsToMove.length === 0) {
            setExtractionAlert({ type: 'warning', message: 'Selected rows already point to the target account. Choose another target or select different rows.' });
            setShowTbCoaGroupModal(false);
            return;
        }

        const nextTbNotes: Record<string, TbWorkingNoteEntry[]> =
            JSON.parse(JSON.stringify(tbWorkingNotes || {}));
        const targetExistingNotes = nextTbNotes[targetAccount] || [];
        const targetNotesToAppend = rowsToMove.map((row) => ({
            description: `[Grouped Selected TB] ${row.account}`,
            debit: Number(row.debit) || 0,
            credit: Number(row.credit) || 0,
            yearScope: 'current' as const
        }));
        nextTbNotes[targetAccount] = [...targetExistingNotes, ...targetNotesToAppend];

        rowsToMove.forEach((row) => {
            delete nextTbNotes[row.account];
        });

        const rowsWithoutTotals = adjustedTrialBalance.filter(item => item.account.toLowerCase() !== 'totals');
        const removedNames = new Set(rowsToMove.map(r => r.account));
        let nextRows = rowsWithoutTotals.filter(item => !removedNames.has(item.account));
        const groupedPreviousDebit = rowsToMove.reduce((sum, row) => sum + (Number(row.previousDebit) || 0), 0);
        const groupedPreviousCredit = rowsToMove.reduce((sum, row) => sum + (Number(row.previousCredit) || 0), 0);

        const normalizedTargetAccount = normalizeAccountName(targetAccount);
        const customTargetLookup = tbCoaCustomTargets.find(item => normalizeAccountName(item.name) === normalizedTargetAccount);
        const targetLookup = TB_COA_GROUP_ACCOUNT_LOOKUP[normalizedTargetAccount]
            || (customTargetLookup ? {
                category: customTargetLookup.category,
                subCategory: customTargetLookup.subCategory,
                name: customTargetLookup.name
            } : undefined);
        const targetIndex = nextRows.findIndex(item => item.account === targetAccount);
        if (targetIndex === -1) {
            nextRows.push({
                account: targetAccount,
                category: targetLookup?.category || 'Assets',
                baseDebit: 0,
                baseCredit: 0,
                basePreviousDebit: 0,
                basePreviousCredit: 0,
                debit: 0,
                credit: 0,
                previousDebit: 0,
                previousCredit: 0
            });
        }

        const finalTargetIndex = nextRows.findIndex(item => item.account === targetAccount);
        if (finalTargetIndex > -1) {
            const targetRow = nextRows[finalTargetIndex];
            const targetNotes = (nextTbNotes[targetAccount] || []) as TbWorkingNoteEntry[];
            const noteTotals = getTbWorkingNoteTotals(targetNotes);
            const baseAmounts = getTbRowBaseAmounts(targetRow, targetNotes);

            nextRows[finalTargetIndex] = {
                ...targetRow,
                category: targetRow.category || targetLookup?.category || 'Assets',
                baseDebit: baseAmounts.baseDebit,
                baseCredit: baseAmounts.baseCredit,
                basePreviousDebit: baseAmounts.basePreviousDebit,
                basePreviousCredit: baseAmounts.basePreviousCredit,
                debit: baseAmounts.baseDebit + noteTotals.currentDebit,
                credit: baseAmounts.baseCredit + noteTotals.currentCredit,
                previousDebit: baseAmounts.basePreviousDebit + noteTotals.previousDebit + groupedPreviousDebit,
                previousCredit: baseAmounts.basePreviousCredit + noteTotals.previousCredit + groupedPreviousCredit
            };
        }

        setTbWorkingNotes(nextTbNotes);
        setAdjustedTrialBalance([...nextRows, buildTbTotalsRow(nextRows)]);
        setTbSelectedAccounts({});
        setShowTbCoaGroupModal(false);
        setAutoPopulateTrigger(prev => prev + 1);

        const groupedDebit = rowsToMove.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
        const groupedCredit = rowsToMove.reduce((sum, row) => sum + (Number(row.credit) || 0), 0);
        setExtractionAlert({
            type: 'success',
            message: `Grouped ${rowsToMove.length} selected row(s) into "${targetAccount}" as notes. Added Debit ${formatNumber(groupedDebit)} / Credit ${formatNumber(groupedCredit)}.`
        });
    };

    const handleAddCustomTbCoaTarget = (category: string, subCategory?: string) => {
        setTbCoaCustomTargetDialog({
            category,
            subCategory,
            value: '',
            error: ''
        });
    };

    const handleConfirmAddCustomTbCoaTarget = () => {
        if (!tbCoaCustomTargetDialog) return;

        const { category, subCategory } = tbCoaCustomTargetDialog;
        const scopeLabel = subCategory ? `${category} / ${formatCoaHierarchyLabel(subCategory)}` : category;
        const name = tbCoaCustomTargetDialog.value.trim();
        if (!name) {
            setTbCoaCustomTargetDialog(prev => prev ? { ...prev, error: 'Custom account name cannot be empty.' } : prev);
            return;
        }

        const normalizedName = normalizeAccountName(name);
        const existingBuiltIn = TB_COA_GROUP_ACCOUNT_LOOKUP[normalizedName];
        if (existingBuiltIn) {
            setTbCoaTargetAccount(existingBuiltIn.name);
            setTbCoaCustomTargetDialog(null);
            setExtractionAlert({ type: 'warning', message: `"${existingBuiltIn.name}" already exists in Chart of Accounts and has been selected.` });
            return;
        }

        const existingCustom = tbCoaCustomTargets.find(item => normalizeAccountName(item.name) === normalizedName);
        if (existingCustom) {
            setTbCoaTargetAccount(existingCustom.name);
            setTbCoaCustomTargetDialog(null);
            setExtractionAlert({ type: 'warning', message: `"${existingCustom.name}" already exists in custom targets and has been selected.` });
            return;
        }

        setTbCoaCustomTargets(prev => [...prev, { name, category, subCategory }]);
        setTbCoaTargetAccount(name);
        setTbCoaCustomTargetDialog(null);
        setExtractionAlert({ type: 'success', message: `Custom target "${name}" added under ${scopeLabel}.` });
    };

    const handleDeleteCustomTbCoaTarget = (name: string, category: string, subCategory?: string) => {
        const normalizedName = normalizeAccountName(name);
        const scopeLabel = subCategory ? `${category} / ${formatCoaHierarchyLabel(subCategory)}` : category;

        setTbCoaCustomTargets(prev => prev.filter(item => !(
            normalizeAccountName(item.name) === normalizedName
            && item.category === category
            && (item.subCategory || '') === (subCategory || '')
        )));

        if (normalizeAccountName(tbCoaTargetAccount) === normalizedName) {
            setTbCoaTargetAccount('');
        }

        setExtractionAlert({ type: 'success', message: `Custom target "${name}" removed from ${scopeLabel}.` });
    };

    const handleRequestDeleteCustomTbCoaTarget = (name: string, category: string, subCategory?: string) => {
        setTbCoaCustomTargetDeleteDialog({ name, category, subCategory });
    };

    const handleConfirmDeleteCustomTbCoaTarget = () => {
        if (!tbCoaCustomTargetDeleteDialog) return;
        const { name, category, subCategory } = tbCoaCustomTargetDeleteDialog;
        setTbCoaCustomTargetDeleteDialog(null);
        handleDeleteCustomTbCoaTarget(name, category, subCategory);
    };

    const renderTbCoaGroupModal = () => {
        if (!showTbCoaGroupModal) return null;

        const selectedRows = getSelectedTrialBalanceRows();
        const selectedDebit = selectedRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0);
        const selectedCredit = selectedRows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0);
        const search = tbCoaSearch.trim().toLowerCase();
        const categoryOrder = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];
        const formatSubCategoryLabel = formatCoaHierarchyLabel;
        const getCustomTargetsForBlock = (category: string, subCategory?: string) => (
            tbCoaCustomTargets
                .filter(item => item.category === category && (item.subCategory || '') === (subCategory || ''))
                .map(item => item.name)
        );
        const isCustomTargetInBlock = (account: string, category: string, subCategory?: string) => {
            const normalizedAccount = normalizeAccountName(account);
            return tbCoaCustomTargets.some(item =>
                normalizeAccountName(item.name) === normalizedAccount
                && item.category === category
                && (item.subCategory || '') === (subCategory || '')
            );
        };

        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border bg-background/50 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-black text-foreground uppercase tracking-widest">Group Selected TB Rows To Chart Of Accounts</h3>
                            <p className="text-xs text-muted-foreground mt-1">Select a target COA account. Selected Trial Balance rows will be added as notes and summed into the target account.</p>
                        </div>
                        <button onClick={() => setShowTbCoaGroupModal(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-0 flex-1 min-h-0">
                        <div className="border-r border-border bg-background/30 p-5 overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Selected Rows</h4>
                                <span className="text-[10px] font-bold px-2 py-1 rounded-full border border-border bg-muted text-muted-foreground">
                                    {selectedRows.length} rows
                                </span>
                            </div>
                            <div className="space-y-2">
                                {selectedRows.length === 0 ? (
                                    <div className="text-sm text-muted-foreground border border-dashed border-border rounded-xl p-4 text-center">
                                        No rows selected.
                                    </div>
                                ) : (
                                    selectedRows.map((row, idx) => (
                                        <div key={`${row.account}-${idx}`} className="rounded-xl border border-border bg-card/60 p-3">
                                            <div className="text-sm font-semibold text-foreground truncate">{row.account}</div>
                                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                                                <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Debit</div>
                                                    <div className="font-mono font-bold text-foreground text-right">{formatNumber(Number(row.debit) || 0)}</div>
                                                </div>
                                                <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit</div>
                                                    <div className="font-mono font-bold text-foreground text-right">{formatNumber(Number(row.credit) || 0)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/10 p-4">
                                <div className="text-[10px] uppercase tracking-[0.2em] font-black text-primary mb-2">Selected Total</div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <div className="text-muted-foreground text-xs">Debit</div>
                                        <div className="font-mono font-bold text-foreground">{formatNumber(selectedDebit)}</div>
                                    </div>
                                    <div>
                                        <div className="text-muted-foreground text-xs">Credit</div>
                                        <div className="font-mono font-bold text-foreground">{formatNumber(selectedCredit)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 overflow-y-auto bg-background/10">
                            <div className="mb-4 flex flex-col md:flex-row md:items-center gap-3">
                                <input
                                    type="text"
                                    value={tbCoaSearch}
                                    onChange={(e) => setTbCoaSearch(e.target.value)}
                                    placeholder="Search chart of accounts (e.g. Bank Accounts)"
                                    className="w-full md:flex-1 bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                                />
                                <div className="text-xs font-semibold text-muted-foreground bg-muted/50 border border-border rounded-xl px-3 py-2">
                                    Target: <span className="text-foreground font-bold">{tbCoaTargetAccount || 'Not selected'}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {categoryOrder.map((category) => {
                                    const section = (CHART_OF_ACCOUNTS as any)[category];
                                    if (!section) return null;

                                    const blocks: { subCategory?: string; accounts: string[] }[] = [];
                                    const categoryParentTarget = TB_COA_GROUP_PARENT_TARGETS.categoryTargets[category];
                                    const categoryCustomTargets = getCustomTargetsForBlock(category);

                                    if (Array.isArray(section)) {
                                        blocks.push({
                                            accounts: Array.from(new Set([
                                                categoryParentTarget,
                                                ...(section as string[]),
                                                ...categoryCustomTargets
                                            ].filter(Boolean) as string[]))
                                        });
                                    } else {
                                        if (categoryParentTarget) {
                                            blocks.push({
                                                accounts: Array.from(new Set([categoryParentTarget, ...categoryCustomTargets].filter(Boolean) as string[]))
                                            });
                                        } else if (categoryCustomTargets.length > 0) {
                                            blocks.push({ accounts: Array.from(new Set(categoryCustomTargets)) });
                                        }
                                        Object.entries(section).forEach(([subCategory, accounts]) => {
                                            const parentSubTarget = TB_COA_GROUP_PARENT_TARGETS.subCategoryTargets[category]?.[subCategory];
                                            const blockCustomTargets = getCustomTargetsForBlock(category, subCategory);
                                            blocks.push({
                                                subCategory,
                                                accounts: Array.from(new Set([
                                                    parentSubTarget,
                                                    ...(accounts as string[]),
                                                    ...blockCustomTargets
                                                ].filter(Boolean) as string[]))
                                            });
                                        });
                                    }

                                    const filteredBlocks = blocks
                                        .map((block) => ({
                                            ...block,
                                            accounts: block.accounts.filter((account) => !search || account.toLowerCase().includes(search))
                                        }))
                                        .filter((block) => block.accounts.length > 0);

                                    if (filteredBlocks.length === 0) return null;

                                    return (
                                        <div key={category} className="rounded-2xl border border-border bg-card/60 overflow-hidden">
                                            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                                                <div className="text-sm font-black uppercase tracking-widest text-foreground">{category}</div>
                                                <div className="text-[10px] font-bold text-muted-foreground bg-background border border-border rounded-full px-2 py-0.5">
                                                    {filteredBlocks.reduce((sum, b) => sum + b.accounts.length, 0)} items
                                                </div>
                                            </div>
                                            <div className="p-3 space-y-3">
                                                {filteredBlocks.map((block) => (
                                                    <div key={`${category}-${block.subCategory || 'root'}`}>
                                                        {block.subCategory && (
                                                            <div className="flex items-center justify-between gap-2 px-2 mb-2">
                                                                <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-muted-foreground">
                                                                    {formatSubCategoryLabel(block.subCategory)}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAddCustomTbCoaTarget(category, block.subCategory)}
                                                                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary hover:text-primary/80 transition-colors"
                                                                >
                                                                    <PlusIcon className="w-3 h-3" />
                                                                    Add
                                                                </button>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {!block.subCategory && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAddCustomTbCoaTarget(category)}
                                                                    className="md:col-span-2 text-left rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-2.5 transition-colors"
                                                                >
                                                                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                                                                        <PlusIcon className="w-4 h-4" />
                                                                        Add Custom Account in {category}
                                                                    </div>
                                                                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                        Creates a new selectable target for grouping
                                                                    </div>
                                                                </button>
                                                            )}
                                                            {block.accounts.map((account) => {
                                                                const isSelected = tbCoaTargetAccount === account;
                                                                const isCustomTarget = isCustomTargetInBlock(account, category, block.subCategory);
                                                                return (
                                                                    <div key={`${category}-${account}`} className="relative">
                                                                        {isCustomTarget && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleRequestDeleteCustomTbCoaTarget(account, category, block.subCategory);
                                                                                }}
                                                                                className="absolute top-2 right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-md border border-red-500/20 bg-background/80 text-red-400 hover:text-red-300 hover:border-red-400/40 hover:bg-red-500/10 transition-colors"
                                                                                title={`Delete custom account "${account}"`}
                                                                                aria-label={`Delete custom account ${account}`}
                                                                            >
                                                                                <TrashIcon className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setTbCoaTargetAccount(account)}
                                                                            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${isCustomTarget ? 'pr-12' : ''} ${isSelected
                                                                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                                                                : 'border-border bg-background/40 hover:bg-muted/40 hover:border-muted-foreground/30'}`}
                                                                        >
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="text-sm font-semibold text-foreground leading-tight">{account}</div>
                                                                                {isSelected && <CheckIcon className="w-4 h-4 text-primary shrink-0" />}
                                                                            </div>
                                                                            <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                                                                                {category}{block.subCategory ? ` / ${formatSubCategoryLabel(block.subCategory)}` : ''}
                                                                            </div>
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-5 border-t border-border bg-background/40 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-xs text-muted-foreground">
                            Selected rows will be removed from the list and added as TB notes under the selected COA account.
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setShowTbCoaGroupModal(false)} className="px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyTbCoaGrouping}
                                disabled={selectedRows.length === 0 || !tbCoaTargetAccount}
                                className="px-6 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl text-sm font-extrabold shadow-lg transition-all"
                            >
                                Group To "{tbCoaTargetAccount || 'COA'}"
                            </button>
                        </div>
                    </div>

                    {tbCoaCustomTargetDialog && (
                        <div className="absolute inset-0 z-20 bg-background/75 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="absolute inset-0" onClick={() => setTbCoaCustomTargetDialog(null)} />
                            <div
                                className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-5"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-base font-black text-foreground uppercase tracking-wider">Add Custom Account</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {tbCoaCustomTargetDialog.subCategory
                                                ? `Add under ${tbCoaCustomTargetDialog.category} / ${formatSubCategoryLabel(tbCoaCustomTargetDialog.subCategory)}`
                                                : `Add under ${tbCoaCustomTargetDialog.category}`}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTbCoaCustomTargetDialog(null)}
                                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <form
                                    className="mt-4 space-y-3"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleConfirmAddCustomTbCoaTarget();
                                    }}
                                >
                                    <div>
                                        <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">
                                            Account Name
                                        </label>
                                        <input
                                            type="text"
                                            autoFocus
                                            value={tbCoaCustomTargetDialog.value}
                                            onChange={(e) => setTbCoaCustomTargetDialog(prev => prev ? { ...prev, value: e.target.value, error: '' } : prev)}
                                            placeholder="e.g. Security Deposit - Office"
                                            className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                                        />
                                        {tbCoaCustomTargetDialog.error && (
                                            <div className="mt-2 text-xs text-red-400">{tbCoaCustomTargetDialog.error}</div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end gap-3 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setTbCoaCustomTargetDialog(null)}
                                            className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm font-extrabold shadow-lg transition-all"
                                        >
                                            Add Account
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {tbCoaCustomTargetDeleteDialog && (
                        <div className="absolute inset-0 z-30 bg-background/75 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="absolute inset-0" onClick={() => setTbCoaCustomTargetDeleteDialog(null)} />
                            <div
                                className="relative w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-5"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h4 className="text-base font-black text-foreground uppercase tracking-wider">Delete Custom Account</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {tbCoaCustomTargetDeleteDialog.subCategory
                                                ? `${tbCoaCustomTargetDeleteDialog.category} / ${formatSubCategoryLabel(tbCoaCustomTargetDeleteDialog.subCategory)}`
                                                : tbCoaCustomTargetDeleteDialog.category}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTbCoaCustomTargetDeleteDialog(null)}
                                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                                    <div className="text-sm text-foreground">
                                        Delete custom account <span className="font-bold">"{tbCoaCustomTargetDeleteDialog.name}"</span>?
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        This removes the custom target from the COA picker list only.
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTbCoaCustomTargetDeleteDialog(null)}
                                        className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmDeleteCustomTbCoaTarget}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-extrabold shadow-lg transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderAdjustTB = () => {
        const grandTotal = {
            debit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.debit || 0,
            credit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.credit || 0
        };
        const grandTotalPrevious = (adjustedTrialBalance || [])
            .filter(i => i.account !== 'Totals')
            .reduce((acc, item) => ({
                debit: acc.debit + (Number(item.previousDebit) || 0),
                credit: acc.credit + (Number(item.previousCredit) || 0)
            }), { debit: 0, credit: 0 });
        const STRICT_BALANCE_TOLERANCE = 0.1;
        const ROUNDING_BALANCE_TOLERANCE = 1;
        const cyVariance = round2(Math.abs(grandTotal.debit - grandTotal.credit));
        const pyVariance = round2(Math.abs(grandTotalPrevious.debit - grandTotalPrevious.credit));
        const isCyStrictBalanced = cyVariance <= STRICT_BALANCE_TOLERANCE;
        const isPyStrictBalanced = pyVariance <= STRICT_BALANCE_TOLERANCE;
        const isCyWithinTolerance = cyVariance <= ROUNDING_BALANCE_TOLERANCE;
        const isPyWithinTolerance = pyVariance <= ROUNDING_BALANCE_TOLERANCE;
        const selectedTbCount = getSelectedTrialBalanceRows().length;
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
            <>
                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                    <div className="p-6 bg-background border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="text-xl font-bold text-primary uppercase tracking-widest shrink-0">Adjust Trial Balance</h3>
                        <div className="w-full md:flex-1 md:min-w-0">
                            <div className="overflow-x-auto custom-scrollbar pb-1">
                                <div className="flex items-center gap-3 min-w-max md:justify-end pr-1">
                                    <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" multiple />
                                    <input type="file" ref={tbExcelInputRef} className="hidden" onChange={handleImportTrialBalanceExcel} accept=".xlsx,.xls" />
                                    <button onClick={handleExportStep2} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md">
                                        <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export
                                    </button>
                                    <button onClick={() => setShowTbUpdateModal(true)} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md">
                                        <DocumentDuplicateIcon className="w-5 h-5 mr-1.5" /> Update Excel
                                    </button>
                                    <button onClick={() => tbExcelInputRef.current?.click()} disabled={isExtractingTB} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md disabled:opacity-50">
                                        <UploadIcon className="w-5 h-5 mr-1.5" /> Import Excel
                                    </button>
                                    <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 hover:bg-muted/40 border border-border rounded-lg text-xs shadow-md transition-colors">
                                        <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-muted-foreground">Year Import</span>
                                        <div className="relative">
                                            <select
                                                value={tbYearImportMode}
                                                onChange={(e) => setTbYearImportMode(normalizeTbYearImportMode(e.target.value))}
                                                className="appearance-none min-w-[150px] bg-background/80 hover:bg-background text-foreground text-xs font-bold border border-border rounded-md px-3 py-1.5 pr-8 outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                                                title="Choose where single-year TB values should be imported"
                                            >
                                                <option value="auto">Auto (CY + PY)</option>
                                                <option value="current_only">Current Year Only</option>
                                                <option value="previous_only">Previous Year Only</option>
                                            </select>
                                            <ChevronDownIcon className="w-4 h-4 text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                    <button onClick={() => tbFileInputRef.current?.click()} disabled={isExtractingTB} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md disabled:opacity-50">
                                        {isExtractingTB ? <><div className="w-3 h-3 border-2 border-white/30 border-t-primary-foreground rounded-full animate-spin mr-2"></div> Extracting...</> : <><UploadIcon className="w-5 h-5 mr-1.5" /> Upload TB</>}
                                    </button>
                                    <button
                                        onClick={handleOpenTbCoaGroupModal}
                                        disabled={selectedTbCount === 0}
                                        className="flex items-center px-4 py-2 bg-background hover:bg-muted/50 text-foreground font-bold rounded-lg text-sm border border-border transition-all shadow-md disabled:opacity-50"
                                        title="Group selected rows into a chart of accounts item"
                                    >
                                        <ListBulletIcon className="w-5 h-5 mr-1.5" /> Group to COA
                                        {selectedTbCount > 0 && (
                                            <span className="ml-2 text-[10px] font-black bg-primary/15 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                                {selectedTbCount}
                                            </span>
                                        )}
                                    </button>
                                    <button onClick={() => setShowGlobalAddAccountModal(true)} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-all shadow-md">
                                        <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                                    </button>
                                    <label className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-xs font-semibold text-muted-foreground">
                                        <input
                                            type="checkbox"
                                            checked={tbGroupExtractedRowsToNotes}
                                            onChange={(e) => setTbGroupExtractedRowsToNotes(e.target.checked)}
                                            className="accent-primary"
                                        />
                                        Group Extracted Duplicates to Notes
                                    </label>
                                </div>
                            </div>
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
                            <button onClick={() => setExtractionAlert(null)} className="text-muted-foreground hover:text-foreground transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                        </div>
                    )}

                    {isExtractingTB && (
                        <div className="p-6 border-b border-border bg-background/40">
                            <LoadingIndicator
                                progress={extractionStatus.includes('Gemini') ? 75 : 30}
                                statusText={extractionStatus || "Gemini AI is reading your Trial Balance table..."}
                                size="compact"
                            />
                        </div>
                    )}

                    <div className="divide-y divide-border">
                        {sections.map(sec => (
                            <div key={sec}>
                                <button onClick={() => setOpenTbSection(openTbSection === sec ? null : sec)} className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === sec ? 'bg-muted/80' : 'hover:bg-muted/30'}`}>
                                    <div className="flex items-center space-x-3">
                                        {React.createElement(getIconForSection(sec), { className: "w-5 h-5 text-muted-foreground" })}
                                        <span className="font-bold text-foreground uppercase tracking-wide">{sec}</span>
                                        <span className="text-[10px] bg-muted text-muted-foreground font-mono px-2 py-0.5 rounded-full border border-border">
                                            {getSectionItems(sec).length}
                                        </span>
                                    </div>
                                    {openTbSection === sec ? <ChevronDownIcon className="w-5 h-5 text-muted-foreground" /> : <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />}
                                </button>
                                {openTbSection === sec && (
                                    <div className="bg-background/40 p-4 border-t border-border/50 overflow-x-auto">
                                        <table className="w-full min-w-[1100px] text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/20 text-muted-foreground text-[10px] uppercase tracking-widest">
                                                    <th rowSpan={2} className="px-2 py-2 border-b border-border/50 text-center w-12 align-middle">Select</th>
                                                    <th rowSpan={2} className="px-4 py-2 border-b border-border/50 align-middle">Account Name</th>
                                                    <th rowSpan={2} className="px-4 py-2 border-b border-border/50 text-center w-16 align-middle">Notes</th>
                                                    <th colSpan={2} className="px-4 py-2 border-b border-border/50 text-center">Current Year</th>
                                                    <th colSpan={2} className="px-4 py-2 border-b border-border/50 text-center">Previous Year</th>
                                                </tr>
                                                <tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-widest">
                                                    <th className="px-4 py-2 text-right border-b border-border/50">Debit</th>
                                                    <th className="px-4 py-2 text-right border-b border-border/50">Credit</th>
                                                    <th className="px-4 py-2 text-right border-b border-border/50">Debit</th>
                                                    <th className="px-4 py-2 text-right border-b border-border/50">Credit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getSectionItems(sec).map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-muted/20 border-b border-border/30 last:border-0 group">
                                                        <td className="py-2 px-2 text-center align-middle">
                                                            <input
                                                                type="checkbox"
                                                                checked={!!tbSelectedAccounts[item.account]}
                                                                onChange={(e) => setTbSelectedAccounts(prev => ({ ...prev, [item.account]: e.target.checked }))}
                                                                className="w-4 h-4 accent-primary cursor-pointer"
                                                                aria-label={`Select ${item.account}`}
                                                            />
                                                        </td>
                                                        <td className="py-2 px-4 text-foreground/80 font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={item.account}
                                                                    onChange={(e) => handleAccountRename(item.account, e.target.value)}
                                                                    className="bg-transparent border-0 focus:ring-1 focus:ring-primary rounded px-1 py-0.5 w-full hover:bg-muted/50 transition-colors"
                                                                />
                                                                <button
                                                                    onClick={() => handleDeleteAccount(item.account)}
                                                                    className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition-all"
                                                                    title="Delete Account"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="py-2 px-4 text-center">
                                                            <button
                                                                onClick={() => handleOpenTbNote(item.account)}
                                                                className={`p-1.5 rounded-lg transition-all ${tbWorkingNotes[item.account]?.length > 0 ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-primary hover:bg-muted'}`}
                                                                title="Add Working Notes"
                                                            >
                                                                {tbWorkingNotes[item.account]?.length > 0 ? <ClipboardCheckIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
                                                            </button>
                                                        </td>
                                                        <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.debit || ''} onChange={e => handleCellChange(item.account, 'debit', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs focus:ring-1 focus:ring-primary outline-none" /></td>
                                                        <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.credit || ''} onChange={e => handleCellChange(item.account, 'credit', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs focus:ring-1 focus:ring-primary outline-none" /></td>
                                                        <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.previousDebit || ''} onChange={e => handleCellChange(item.account, 'previousDebit', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs focus:ring-1 focus:ring-primary outline-none" /></td>
                                                        <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.previousCredit || ''} onChange={e => handleCellChange(item.account, 'previousCredit', e.target.value)} className="w-full bg-muted border border-border rounded px-2 py-1.5 text-right font-mono text-foreground text-xs focus:ring-1 focus:ring-primary outline-none" /></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-6 bg-background border-t border-border">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
                                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-wider">CY Total Debit</p>
                                        <p className="font-mono font-bold text-lg md:text-xl xl:text-2xl text-foreground leading-tight break-all tabular-nums">
                                            {formatUpdateValue(grandTotal.debit)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-wider">CY Total Credit</p>
                                        <p className="font-mono font-bold text-lg md:text-xl xl:text-2xl text-foreground leading-tight break-all tabular-nums">
                                            {formatUpdateValue(grandTotal.credit)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-wider">PY Total Debit</p>
                                        <p className="font-mono font-bold text-lg md:text-xl xl:text-2xl text-foreground leading-tight break-all tabular-nums">
                                            {formatUpdateValue(grandTotalPrevious.debit)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 min-w-0">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1 tracking-wider">PY Total Credit</p>
                                        <p className="font-mono font-bold text-lg md:text-xl xl:text-2xl text-foreground leading-tight break-all tabular-nums">
                                            {formatUpdateValue(grandTotalPrevious.credit)}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-2 w-full xl:w-[320px]">
                                    <div className={`w-full px-5 py-3 rounded-xl border font-mono font-bold text-lg md:text-xl leading-tight ${isCyStrictBalanced ? 'text-green-400 border-green-900 bg-green-900/10' : isCyWithinTolerance ? 'text-amber-300 border-amber-900 bg-amber-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                                        {isCyStrictBalanced
                                            ? 'CY Balanced'
                                            : isCyWithinTolerance
                                                ? `CY Variance: ${formatVarianceNumber(cyVariance)} (rounding)`
                                                : `CY Variance: ${formatVarianceNumber(cyVariance)}`}
                                    </div>
                                    <div className={`w-full px-5 py-3 rounded-xl border font-mono font-bold text-sm md:text-base leading-tight ${isPyStrictBalanced ? 'text-green-400 border-green-900 bg-green-900/10' : isPyWithinTolerance ? 'text-amber-300 border-amber-900 bg-amber-900/10' : 'text-amber-400 border-amber-900 bg-amber-900/10'}`}>
                                        {isPyStrictBalanced
                                            ? 'PY Balanced'
                                            : isPyWithinTolerance
                                                ? `PY Variance: ${formatVarianceNumber(pyVariance)} (rounding)`
                                                : `PY Variance: ${formatVarianceNumber(pyVariance)}`}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-between mt-8 border-t border-border pt-6">
                            <button onClick={handleBack} className="text-muted-foreground hover:text-foreground font-bold transition-colors">Back</button>
                            <button onClick={() => setShowVatConfirm(true)} disabled={!isCyWithinTolerance} className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                        </div>
                    </div>
                </div>
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
                                        await handleSaveStep(2);
                                        setCurrentStep(5);
                                    }}
                                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm"
                                >
                                    No, Skip
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowVatConfirm(false);
                                        await handleSaveStep(2);
                                        setCurrentStep(3);
                                    }}
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm"
                                >
                                    Yes, Upload
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showTbExcelModal && (
                    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-foreground">Import Trial Balance (Excel)</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Map columns and preview before importing. The importer auto-detects the header row when possible.</p>
                                </div>
                                <button onClick={resetTbExcelModal} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6 overflow-y-auto min-h-0 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Sheet</label>
                                        <select
                                            value={tbExcelSheetName}
                                            onChange={(e) => handleTbExcelSheetChange(e.target.value)}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                            disabled={tbExcelSheetNames.length <= 1}
                                        >
                                            {tbExcelSheetNames.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                        {tbExcelFile && (
                                            <p className="text-[11px] text-muted-foreground mt-2">File: {tbExcelFile.name}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Account Column</label>
                                        <select
                                            value={tbExcelMapping.account ?? ''}
                                            onChange={(e) => setTbExcelMapping(prev => ({ ...prev, account: e.target.value === '' ? null : Number(e.target.value) }))}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            <option value="">Select column...</option>
                                            {tbExcelHeaders.map((header, idx) => (
                                                <option key={`acct-${idx}`} value={idx}>{`${getColumnLabel(idx)} - ${header}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Category Column (Optional)</label>
                                        <select
                                            value={tbExcelMapping.category ?? ''}
                                            onChange={(e) => setTbExcelMapping(prev => ({ ...prev, category: e.target.value === '' ? null : Number(e.target.value) }))}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            <option value="">Not mapped</option>
                                            {tbExcelHeaders.map((header, idx) => (
                                                <option key={`cat-${idx}`} value={idx}>{`${getColumnLabel(idx)} - ${header}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Current Year Debit</label>
                                        <select
                                            value={tbExcelMapping.debit ?? ''}
                                            onChange={(e) => setTbExcelMapping(prev => ({ ...prev, debit: e.target.value === '' ? null : Number(e.target.value) }))}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            <option value="">Select column...</option>
                                            {tbExcelHeaders.map((header, idx) => (
                                                <option key={`debit-${idx}`} value={idx}>{`${getColumnLabel(idx)} - ${header}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Current Year Credit</label>
                                        <select
                                            value={tbExcelMapping.credit ?? ''}
                                            onChange={(e) => setTbExcelMapping(prev => ({ ...prev, credit: e.target.value === '' ? null : Number(e.target.value) }))}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            <option value="">Select column...</option>
                                            {tbExcelHeaders.map((header, idx) => (
                                                <option key={`credit-${idx}`} value={idx}>{`${getColumnLabel(idx)} - ${header}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Previous Year Debit (Optional)</label>
                                        <select
                                            value={tbExcelMapping.previousDebit ?? ''}
                                            onChange={(e) => setTbExcelMapping(prev => ({ ...prev, previousDebit: e.target.value === '' ? null : Number(e.target.value) }))}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            <option value="">Not mapped</option>
                                            {tbExcelHeaders.map((header, idx) => (
                                                <option key={`prev-debit-${idx}`} value={idx}>{`${getColumnLabel(idx)} - ${header}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Previous Year Credit (Optional)</label>
                                        <select
                                            value={tbExcelMapping.previousCredit ?? ''}
                                            onChange={(e) => setTbExcelMapping(prev => ({ ...prev, previousCredit: e.target.value === '' ? null : Number(e.target.value) }))}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            <option value="">Not mapped</option>
                                            {tbExcelHeaders.map((header, idx) => (
                                                <option key={`prev-credit-${idx}`} value={idx}>{`${getColumnLabel(idx)} - ${header}`}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-end">
                                        <div className="text-xs text-muted-foreground">
                                            <div>Total rows: <span className="text-foreground font-semibold">{tbExcelValidation.stats.totalRows}</span></div>
                                            <div>CY Debit: <span className="text-foreground font-semibold">{formatNumber(tbExcelValidation.stats.sumDebit)}</span></div>
                                            <div>CY Credit: <span className="text-foreground font-semibold">{formatNumber(tbExcelValidation.stats.sumCredit)}</span></div>
                                            <div>CY Variance: <span className="text-foreground font-semibold">{formatNumber(tbExcelValidation.stats.variance)}</span></div>
                                            <div>PY Debit: <span className="text-foreground font-semibold">{formatNumber(tbExcelValidation.stats.sumPreviousDebit || 0)}</span></div>
                                            <div>PY Credit: <span className="text-foreground font-semibold">{formatNumber(tbExcelValidation.stats.sumPreviousCredit || 0)}</span></div>
                                            <div>PY Variance: <span className="text-foreground font-semibold">{formatNumber(tbExcelValidation.stats.previousVariance || 0)}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {tbExcelValidation.errors.length > 0 && (
                                    <div className="p-4 rounded-xl border border-red-900/40 bg-red-900/10 text-red-400 text-sm">
                                        {tbExcelValidation.errors.map((err, idx) => (
                                            <div key={`tb-err-${idx}`}>{err}</div>
                                        ))}
                                    </div>
                                )}
                                {tbExcelValidation.warnings.length > 0 && (
                                    <div className="p-4 rounded-xl border border-amber-900/40 bg-amber-900/10 text-amber-300 text-sm">
                                        {tbExcelValidation.warnings.map((warn, idx) => (
                                            <div key={`tb-warn-${idx}`}>{warn}</div>
                                        ))}
                                    </div>
                                )}

                                <div className="bg-background/40 border border-border rounded-xl overflow-hidden">
                                    <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Preview</div>
                                    <div className="max-h-64 overflow-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-widest">
                                                    <th className="px-4 py-2 border-b border-border/50">Account</th>
                                                    <th className="px-4 py-2 border-b border-border/50">Category</th>
                                                    <th className="px-4 py-2 border-b border-border/50 text-right">CY Debit</th>
                                                    <th className="px-4 py-2 border-b border-border/50 text-right">CY Credit</th>
                                                    <th className="px-4 py-2 border-b border-border/50 text-right">PY Debit</th>
                                                    <th className="px-4 py-2 border-b border-border/50 text-right">PY Credit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tbExcelPreview.length === 0 && (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No preview rows available.</td>
                                                    </tr>
                                                )}
                                                {tbExcelPreview.map((row, idx) => (
                                                    <tr key={`tb-preview-${idx}`} className="border-b border-border/30 last:border-0">
                                                        <td className="px-4 py-2 text-foreground/80">{row.account}</td>
                                                        <td className="px-4 py-2 text-muted-foreground">{row.category || '-'}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-foreground/90">{formatNumber(row.debit)}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-foreground/90">{formatNumber(row.credit)}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-foreground/90">{formatNumber(row.previousDebit || 0)}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-foreground/90">{formatNumber(row.previousCredit || 0)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0 bg-card">
                                <button
                                    onClick={resetTbExcelModal}
                                    className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmTbExcelImport}
                                    disabled={tbExcelValidation.errors.length > 0}
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
                                >
                                    Import & Replace
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {showTbUpdateModal && (
                    <div className="fixed inset-0 bg-background/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-hidden">
                        <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold text-foreground">Update Excel (PDF JSON)</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Match by Account Code, fallback to Ledger Name. Only existing rows are updated.</p>
                                </div>
                                <button onClick={resetTbUpdateModal} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6 overflow-y-auto min-h-0 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Excel File</label>
                                        <input
                                            type="file"
                                            ref={tbUpdateExcelInputRef}
                                            onChange={handleTbUpdateExcelFile}
                                            className="hidden"
                                            accept=".xlsx,.xls"
                                        />
                                        <button onClick={() => tbUpdateExcelInputRef.current?.click()} className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm font-bold hover:bg-muted/80 transition-all">
                                            Select Excel File
                                        </button>
                                        {tbUpdateExcelFile && (
                                            <p className="text-[11px] text-muted-foreground mt-2">File: {tbUpdateExcelFile.name}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">PDF JSON</label>
                                        <input
                                            type="file"
                                            ref={tbUpdateJsonInputRef}
                                            onChange={handleTbUpdateJsonFile}
                                            className="hidden"
                                            accept=".json,application/json"
                                        />
                                        <button onClick={() => tbUpdateJsonInputRef.current?.click()} className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm font-bold hover:bg-muted/80 transition-all">
                                            Select JSON File
                                        </button>
                                        {tbUpdateJsonLabel && (
                                            <p className="text-[11px] text-muted-foreground mt-2">Source: {tbUpdateJsonLabel}</p>
                                        )}
                                    </div>
                                </div>

                                {tbUpdateSheetNames.length > 1 && (
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Sheet</label>
                                        <select
                                            value={tbUpdateSheetName}
                                            onChange={(e) => setTbUpdateSheetName(e.target.value)}
                                            className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                                        >
                                            {tbUpdateSheetNames.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={handleUseCurrentTbForUpdate}
                                        disabled={!adjustedTrialBalance || adjustedTrialBalance.length === 0}
                                        className="px-4 py-2 bg-muted border border-border rounded-lg text-xs font-bold text-foreground/90 hover:text-foreground hover:bg-muted/80 transition-all disabled:opacity-50"
                                    >
                                        Use Current Extracted TB
                                    </button>
                                    <p className="text-[11px] text-muted-foreground">Account codes must be present in the JSON to match by code.</p>
                                </div>

                                {tbUpdateError && (
                                    <div className="p-4 rounded-xl border border-red-900/40 bg-red-900/10 text-red-400 text-sm">
                                        {tbUpdateError}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-background/60 border border-border rounded-xl p-4">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Matched Rows</p>
                                        <p className="text-lg font-mono text-foreground">{tbUpdateStats.matchedRows}</p>
                                    </div>
                                    <div className="bg-background/60 border border-border rounded-xl p-4">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Updated Cells</p>
                                        <p className="text-lg font-mono text-foreground">{tbUpdateStats.updatedCells}</p>
                                    </div>
                                    <div className="bg-background/60 border border-border rounded-xl p-4">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Sheet</p>
                                        <p className="text-lg font-mono text-foreground">{tbUpdateStats.sheetName || tbUpdateSheetName || '-'}</p>
                                    </div>
                                </div>

                                <div className="bg-background/40 border border-border rounded-xl overflow-hidden">
                                    <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground uppercase tracking-widest">Preview Updates</div>
                                    <div className="max-h-64 overflow-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead>
                                                <tr className="bg-muted/30 text-muted-foreground text-[10px] uppercase tracking-widest">
                                                    <th className="px-4 py-2 border-b border-border/50">Account Code</th>
                                                    <th className="px-4 py-2 border-b border-border/50">Ledger Name</th>
                                                    <th className="px-4 py-2 border-b border-border/50">Matched By</th>
                                                    <th className="px-4 py-2 border-b border-border/50">Updates</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tbUpdatePreview.length === 0 && (
                                                    <tr>
                                                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No preview data yet.</td>
                                                    </tr>
                                                )}
                                                {tbUpdatePreview.map((row) => (
                                                    <tr key={`tb-update-${row.rowNumber}`} className="border-b border-border/30 last:border-0">
                                                        <td className="px-4 py-2 text-foreground/80 font-mono">{row.accountCode || '-'}</td>
                                                        <td className="px-4 py-2 text-foreground/80">{row.ledgerName || '-'}</td>
                                                        <td className="px-4 py-2 text-muted-foreground">{row.matchedBy === 'accountCode' ? 'Account Code' : 'Ledger Name'}</td>
                                                        <td className="px-4 py-2 text-xs text-foreground/80">
                                                            {row.updates.map((update, idx) => (
                                                                <div key={`${row.rowNumber}-${idx}`} className="flex items-center justify-between gap-3">
                                                                    <span className="text-muted-foreground">{update.column}</span>
                                                                    <span className="font-mono text-foreground/90">{formatUpdateValue(update.oldValue)} -&gt; {formatUpdateValue(update.newValue)}</span>
                                                                </div>
                                                            ))}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-border flex flex-col md:flex-row justify-between gap-3 shrink-0 bg-card">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleDownloadTbUpdateAuditLog}
                                        disabled={tbUpdateAuditLog.length === 0}
                                        className="px-4 py-2 bg-muted border border-border rounded-lg text-xs font-bold text-foreground/80 hover:text-foreground hover:bg-muted/80 transition-all disabled:opacity-50"
                                    >
                                        Download Audit Log
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={resetTbUpdateModal}
                                        className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => runTbUpdate(true)}
                                        disabled={tbUpdateLoading || !tbUpdateExcelFile || !tbUpdateJsonData}
                                        className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-lg text-sm disabled:opacity-50"
                                    >
                                        {tbUpdateLoading ? 'Working...' : 'Preview'}
                                    </button>
                                    <button
                                        onClick={() => runTbUpdate(false)}
                                        disabled={tbUpdateLoading || !tbUpdateExcelFile || !tbUpdateJsonData}
                                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm disabled:opacity-50"
                                    >
                                        {tbUpdateLoading ? 'Working...' : 'Update Excel'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        );
    };

    const renderStep3VatDocsUpload = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-border bg-background/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-primary/50/30 shadow-lg shadow-blue-500/5">
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
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExtractAdditionalData}
                        disabled={additionalFiles.length === 0 || isExtracting}
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

    const renderStep4ProfitAndLoss = () => (
        <ProfitAndLossStep
            onNext={async () => { await handleSaveStep(5); setCurrentStep(6); }}
            onBack={handleBack}
            data={pnlValues}
            structure={pnlStructure.length ? pnlStructure : PNL_ITEMS}
            onChange={handlePnlChange}
            onExport={handleExportStepPnl}
            onAddAccount={handleAddPnlAccount}
            workingNotes={pnlWorkingNotes}
            onUpdateWorkingNotes={handleUpdatePnlWorkingNote}
        />
    );

    const renderStep5BalanceSheet = () => (
        <BalanceSheetStep
            onNext={handleContinueToTaxComp}
            onBack={handleBack}
            data={balanceSheetValues}
            structure={bsStructure.length ? bsStructure : BS_ITEMS}
            onChange={handleBalanceSheetChange}
            onExport={handleExportStepBS}
            onDownloadPDF={handleDownloadFinancialStatementsPDF}
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

        if (ftaFormValues) {
            const profit = ftaFormValues.netProfit || 0;
            const isSbrClaimed = questionnaireAnswers[6] === 'Yes';
            const defaultLiability = (!isSbrClaimed && profit > 375000) ? (profit - 375000) * 0.09 : 0;

            sheetData.push(["Accounting Net Profit or Loss", taxComputationEdits['accountingIncomeTaxPeriod'] ?? profit]);
            sheetData.push(["Taxable Income Before Adjustment", taxComputationEdits['taxableIncomeBeforeAdj'] ?? profit]);
            sheetData.push(["Taxable Income (Tax Period)", taxComputationEdits['taxableIncomeTaxPeriod'] ?? profit]);
            sheetData.push(["Corporate Tax Liability", taxComputationEdits['corporateTaxLiability'] ?? defaultLiability]);
            sheetData.push(["Corporate Tax Payable", taxComputationEdits['corporateTaxPayable'] ?? defaultLiability]);
        }

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, "Tax Computation");
        XLSX.writeFile(wb, `CT_Tax_Computation_${company?.name || 'Draft'}.xlsx`);
    };

    const renderStep7TaxComputation = () => {
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
            return Number((reportForm as Record<string, unknown>)[field]) || 0;
        };

        const handleConfirmTaxComputation = async () => {
            const mergedTaxData = taxSummary.fields
                .filter((f: any) => f.type !== 'header')
                .reduce((acc: Record<string, number>, f: any) => {
                    acc[f.field] = taxComputationEdits[f.field] ?? getDefaultValue(f.field);
                    return acc;
                }, {});

            setReportForm((prev: any) => ({ ...prev, ...mergedTaxData }));
            await handleSaveStep(7, 'completed', { taxComputation: mergedTaxData });
            setCurrentStep(8);
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
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={currentValue}
                                                onChange={(e) => setTaxComputationEdits(prev => ({ ...prev, [f.field]: parseFloat(e.target.value) || 0 }))}
                                                className={`font-mono font-bold text-base text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-all w-48 ${f.highlight ? 'text-primary' : 'text-foreground'}`}
                                            />
                                            <span className="text-[10px] opacity-60 ml-0.5">{currency}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="p-8 bg-background border-t border-border flex justify-between items-center">
                        <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all">
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
            ftaFormValues?.actualOperatingRevenue ||
            Number(reportForm.actualOperatingRevenue) ||
            Number(reportForm.operatingRevenue) ||
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
                                    setCurrentStep(7);
                                }}
                                className="flex-1 px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-xs tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 transition-all transform hover:-translate-y-1 active:translate-y-0"
                            >
                                Continue with Relief
                            </button>
                            <button
                                onClick={() => {
                                    setShowSbrModal(false);
                                    setCurrentStep(7);
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
        if (!ftaFormValues) return <div className="text-center p-20 bg-card rounded-xl border border-border">Calculating report data...</div>;

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
                    className={`bg-transparent border-none text-right font-mono text-sm font-bold text-foreground focus:ring-0 w-full ${className}`}
                />
            );
        };

        const ReportInput = ({ field, className = "" }: { field: string, className?: string }) => (
            <input
                type="text"
                value={reportForm[field] || ''}
                readOnly
                className={`bg-transparent border-none text-right font-medium text-sm text-foreground/80 focus:ring-0 w-full ${className}`}
            />
        );

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
                                className="flex-1 sm:flex-none px-8 py-2.5 border border-border text-foreground font-black uppercase text-xs rounded-xl transition-all hover:bg-muted/70 disabled:opacity-50"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                            </button>
                            <button
                                onClick={handleExportFinalExcel}
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-background text-foreground font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-muted/70 transform hover:scale-[1.03]"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                Export
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-border">
                        {sections.map(section => (
                            <div key={section.id} className="group">
                                <button
                                    onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)}
                                    className={`w-full flex items-center justify-between p-6 transition-all ${openReportSection === section.title ? 'bg-background/40' : 'hover:bg-background/20'}`}
                                >
                                    <div className="flex items-center gap-5">
                                        <div className={`p-2.5 rounded-xl border transition-all ${openReportSection === section.title ? 'bg-primary border-primary/50 text-primary-foreground shadow-lg shadow-primary/10' : 'bg-card border-border text-muted-foreground group-hover:border-border group-hover:text-muted-foreground'}`}>
                                            <section.icon className="w-5 h-5" />
                                        </div>
                                        <span className={`font-black uppercase tracking-widest text-xs ${openReportSection === section.title ? 'text-foreground' : 'text-muted-foreground'}`}>{section.title}</span>
                                    </div>
                                    <ChevronDownIcon className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${openReportSection === section.title ? 'rotate-180 text-foreground' : ''}`} />
                                </button>
                                {openReportSection === section.title && (
                                    <div className="p-8 bg-background/40 border-t border-border/50 animate-in slide-in-from-top-1 duration-300">
                                        <div className="flex flex-col gap-y-4 bg-background/50 border border-border rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                            {section.fields.map(f => {
                                                if (f.type === 'header') {
                                                    return (
                                                        <div key={f.field} className="pt-8 pb-3 border-b border-border/80 mb-4 first:pt-0">
                                                            <h4 className="text-sm font-black text-primary uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={f.field} className="flex flex-col py-4 border-b border-border/30 last:border-0 group/field">
                                                        <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-primary' : 'text-muted-foreground group-hover/field:text-muted-foreground'}`}>{f.label}</label>
                                                        <div className="bg-card/40 rounded-lg p-1 border border-transparent group-hover/field:border-border/50 transition-all">
                                                            {f.type === 'number' ? <ReportNumberInput field={f.field} className={f.highlight ? 'text-primary/70' : ''} /> : <ReportInput field={f.field} className={f.highlight ? 'text-primary/70' : ''} />}
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

                    <div className="p-6 bg-background border-t border-border text-center">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
                            This is a system generated document and does not require to be signed.
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    const renderStep4VatSummarization = () => {
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

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
                <div className="flex flex-col items-center mb-4">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/50/20 shadow-lg backdrop-blur-xl mb-6">
                        <ClipboardCheckIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-3xl font-black text-foreground tracking-tighter uppercase">VAT Summarization</h3>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] opacity-60 mt-1">Consolidated VAT 201 Report (Editable)</p>
                    </div>
                </div>

                <div className="max-w-6xl mx-auto space-y-8">
                    <div className="bg-background rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-border bg-primary/10 flex justify-between items-center">
                            <h4 className="text-sm font-black text-primary/80 uppercase tracking-[0.2em]">Sales (Outputs) - As per FTA</h4>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Figures in {summaryFileFilter === 'ALL' ? 'AED' : (allFileReconciliations.find(r => r.fileName === summaryFileFilter)?.currency || 'AED')}</span>
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
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

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
                                                <td className="py-4 px-4 text-right font-black bg-muted/30 text-blue-100">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-primary/20/20 font-bold border-t-2 border-border">
                                        <td className="py-5 px-4 text-left font-black text-primary/80 text-[10px] uppercase italic">Sales Total</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.sales.zero)}</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.sales.tv)}</td>
                                        <td className="py-5 px-4 text-right text-primary">{formatDecimalNumber(grandTotals.sales.vat)}</td>
                                        <td className="py-5 px-4 text-right text-foreground text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatDecimalNumber(grandTotals.sales.total)}</td>
                                    </tr>
                                    <tr className="bg-background/20 border-t border-border/50">
                                        <td className="py-3 px-4 text-left font-bold text-muted-foreground text-[10px] uppercase italic">As per Bank Statements</td>
                                        <td colSpan={3}></td>
                                        <td className="py-3 px-4 text-right text-primary/80 font-mono text-sm tracking-tighter">{formatDecimalNumber(bankVatData.grandTotals.sales)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-background rounded-[2rem] border border-border shadow-2xl overflow-hidden">
                        <div className="px-8 py-5 border-b border-border bg-muted/30 flex justify-between items-center">
                            <h4 className="text-sm font-black text-foreground uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Figures in {summaryFileFilter === 'ALL' ? 'AED' : (allFileReconciliations.find(r => r.fileName === summaryFileFilter)?.currency || 'AED')}</span>
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
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

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
                                                <td className="py-4 px-4 text-right font-black bg-muted/20 text-foreground">{formatDecimalNumber(data.total)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-muted/40 font-bold border-t-2 border-border">
                                        <td className="py-5 px-4 text-left font-black text-foreground text-[10px] uppercase italic">Purchases Total</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.purchases.zero)}</td>
                                        <td className="py-5 px-4 text-right text-muted-foreground text-xs">{formatDecimalNumber(grandTotals.purchases.tv)}</td>
                                        <td className="py-5 px-4 text-right text-primary">{formatDecimalNumber(grandTotals.purchases.vat)}</td>
                                        <td className="py-5 px-4 text-right text-foreground text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatDecimalNumber(grandTotals.purchases.total)}</td>
                                    </tr>
                                    <tr className="bg-background/20 border-t border-border/50">
                                        <td className="py-3 px-4 text-left font-bold text-muted-foreground text-[10px] uppercase italic">As per Bank Statements</td>
                                        <td colSpan={3}></td>
                                        <td className="py-3 px-4 text-right text-primary/80 font-mono text-sm tracking-tighter">{formatDecimalNumber(bankVatData.grandTotals.purchases)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="max-w-2xl mx-auto">
                        <div className={`rounded-3xl border-2 p-8 flex flex-col items-center justify-center transition-all ${grandTotals.net >= 0 ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-rose-900/10 border-rose-500/30'}`}>
                            <span className={`text-xs font-black uppercase tracking-[0.3em] mb-4 ${grandTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Total VAT Liability / (Refund)</span>
                            <div className="flex items-baseline gap-3">
                                <span className="text-5xl font-mono font-black text-foreground tracking-tighter">{formatDecimalNumber(grandTotals.net)}</span>
                                <span className={`text-sm font-bold uppercase tracking-widest ${grandTotals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{currency}</span>
                            </div>
                            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-background/40 rounded-full border border-white/5">
                                <InformationCircleIcon className="w-4 h-4 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Calculated as (Total Sales VAT - Total Purchase VAT)</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-8 border-t border-border/50">
                        <button
                            onClick={handleBack}
                            className="flex items-center px-8 py-3 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground font-black rounded-xl border border-border/80 transition-all uppercase text-[10px] tracking-widest"
                        >
                            <ChevronLeftIcon className="w-4 h-4 mr-2" />
                            Back
                        </button>
                        <div className="flex gap-4">
                            <button
                                onClick={handleExportStep4VAT}
                                className="flex items-center px-6 py-3 bg-background/5 hover:bg-background/10 text-foreground font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                            >
                                <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-primary group-hover:scale-110 transition-transform" />
                                Export Step 4
                            </button>
                            <button
                                onClick={handleVatSummarizationContinue}
                                className="flex items-center px-12 py-3 bg-muted/40 hover:from-blue-600 hover:to-blue-500 text-foreground font-black rounded-xl shadow-2xl shadow-blue-900/40 transform hover:-translate-y-0.5 active:scale-95 transition-all uppercase text-[10px] tracking-[0.2em] group"
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

    const renderStep8LOU = () => (
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
                        onClick={() => setCurrentStep(7)}
                        className="flex items-center px-6 py-3 text-muted-foreground hover:text-foreground font-bold transition-all"
                    >
                        <ChevronLeftIcon className="w-5 h-5 mr-2" />
                        Back to Computation
                    </button>
                    <div className="flex gap-4">
                        <button
                            onClick={async () => {
                                await handleSaveStep(8);
                                setCurrentStep(9);
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
    );

    const renderStep9SignedFsLouUpload = () => (
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
                    <button onClick={handleExportStepSignedFsLou} className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all transform hover:scale-105">
                        <DocumentArrowDownIcon className="w-4 h-4" /> Export
                    </button>
                </div>
                <FileUploadArea
                    title="Upload Signed FS & LOU"
                    subtitle="PDF, JPEG, or PNG files"
                    icon={<UploadIcon className="w-8 h-8" />}
                    selectedFiles={signedFsLouFiles}
                    onFilesSelect={setSignedFsLouFiles}
                />
                <div className="mt-8 flex justify-between items-center bg-background/50 p-6 rounded-2xl border border-border/50">
                    <button onClick={() => setCurrentStep(8)} className="flex items-center px-6 py-3 text-muted-foreground font-bold hover:text-foreground transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                    <div className="flex gap-4">
                        <button onClick={async () => { await handleSaveStep(9); setCurrentStep(10); }} className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground/80 font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest shadow-lg">Skip</button>
                        <button onClick={async () => { await handleSaveStep(9); setCurrentStep(10); }} className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Proceed to Questionnaire</button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep10CtQuestionnaire = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-background rounded-3xl border border-border shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-border flex justify-between items-center bg-background/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-muted/40 rounded-2xl flex items-center justify-center border border-indigo-500/30">
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
                                    <p className="text-sm font-medium text-foreground/90 leading-relaxed">{q.text}</p>
                                </div>
                                {q.id === 11 ? (
                                    <input type="text" value={questionnaireAnswers[q.id] || ''} onChange={(e) => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} className="bg-muted border border-border rounded-lg px-4 py-2 text-foreground text-sm w-40 focus:ring-1 focus:ring-primary outline-none font-mono text-right" placeholder="0" />
                                ) : (
                                    <div className="flex items-center gap-2 bg-background p-1 rounded-xl border border-border shrink-0 shadow-inner">
                                        {['Yes', 'No'].map((option) => (
                                            <button key={option} type="button" onClick={() => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: option }))} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${questionnaireAnswers[q.id] === option ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>{option}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-8 bg-background border-t border-border flex justify-between items-center">
                    <div className="flex gap-4">
                        <button onClick={() => setCurrentStep(9)} className="flex items-center px-6 py-3 bg-transparent text-muted-foreground hover:text-foreground font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                        <button onClick={handleExportStepQuestionnaire} className="flex items-center gap-2 px-6 py-3 bg-muted border border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground transition-all transform hover:scale-105"><DocumentArrowDownIcon className="w-5 h-5" /> Export Answers</button>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={async () => { await handleSaveStep(10); setCurrentStep(11); }} className="px-6 py-3 bg-muted hover:bg-muted/80 text-foreground/80 font-bold rounded-xl border border-border transition-all uppercase text-xs tracking-widest shadow-lg">Skip</button>
                        <button onClick={async () => { await handleSaveStep(10); setCurrentStep(11); }} disabled={Object.keys(questionnaireAnswers).filter(k => !isNaN(Number(k))).length < CT_QUESTIONS.length} className="px-10 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold rounded-xl shadow-xl flex items-center disabled:opacity-50 disabled:grayscale transition-all">Generate Final Report <ChevronRightIcon className="w-5 h-5 ml-2" /></button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep11FinalReport = () => renderStepFinalReport();

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="bg-card/50 backdrop-blur-md p-6 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center border border-border shadow-inner group transition-transform hover:scale-105">
                        <BuildingOfficeIcon className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground tracking-tight uppercase">{companyName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-primary/80"><BriefcaseIcon className="w-3.5 h-3.5" /> TYPE 3 WORKFLOW (TRIAL BALANCE)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={handleExportAll}
                        disabled={currentStep !== 11}
                        className="flex items-center px-4 py-2 bg-muted/80 hover:bg-muted/80 text-foreground font-black text-[10px] uppercase tracking-widest rounded-xl border border-border/50 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-colors"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All
                    </button>
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-black text-[10px] uppercase tracking-widest rounded-xl border border-border/50">
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
                basePreviousDebit={getCurrentTbEntry().basePreviousDebit}
                basePreviousCredit={getCurrentTbEntry().basePreviousCredit}
                initialNotes={currentTbAccount ? tbWorkingNotes[currentTbAccount] : []}
                currency={currency}
            />
            {renderTbCoaGroupModal()}

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
                    <div className="flex justify-start"><button onClick={onReset} className="px-4 py-2 text-muted-foreground hover:text-foreground font-medium transition-colors">Back to Dashboard</button></div>
                </div>
            )}

            {currentStep === 2 && renderAdjustTB()}

            {currentStep === 3 && renderStep3VatDocsUpload()}

            {currentStep === 4 && renderStep4VatSummarization()}

            {currentStep === 5 && renderStep4ProfitAndLoss()}

            {currentStep === 6 && renderStep5BalanceSheet()}

            {currentStep === 7 && renderStep7TaxComputation()}

            {currentStep === 8 && renderStep8LOU()}

            {currentStep === 9 && renderStep9SignedFsLouUpload()}

            {currentStep === 10 && renderStep10CtQuestionnaire()}

            {currentStep === 11 && renderStep11FinalReport()}
            {renderSbrModal()}

            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-background">
                            <h3 className="text-lg font-bold text-primary uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const accountName = newGlobalAccountName.trim();
                            if (!accountName) return;
                            const selectedCategory = normalizeOpeningBalanceCategory(newGlobalAccountMain) || newGlobalAccountMain;
                            const newItem: TrialBalanceEntry = {
                                account: accountName,
                                category: selectedCategory,
                                debit: 0,
                                credit: 0,
                                previousDebit: 0,
                                previousCredit: 0
                            };
                            setAdjustedTrialBalance(prev => {
                                if (!prev) return [newItem];
                                const newTb = [...prev];
                                const totalsIdx = newTb.findIndex(i => i.account === 'Totals');
                                if (totalsIdx > -1) newTb.splice(totalsIdx, 0, newItem);
                                else newTb.push(newItem);
                                return newTb;
                            });
                            setAutoPopulateTrigger(prev => prev + 1);
                            setShowGlobalAddAccountModal(false);
                            setNewGlobalAccountName('');
                        }}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Main Category</label>
                                    <select value={newGlobalAccountMain} onChange={(e) => setNewGlobalAccountMain(e.target.value)} className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all" required>
                                        <option value="Assets">Assets</option><option value="Liabilities">Liabilities</option><option value="Equity">Equity</option><option value="Income">Income</option><option value="Expenses">Expenses</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 tracking-widest">Account Name</label>
                                    <input type="text" value={newGlobalAccountName} onChange={(e) => setNewGlobalAccountName(e.target.value)} className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="e.g. Project Development Fees" required autoFocus />
                                </div>
                            </div>
                            <div className="p-4 bg-muted/50 border-t border-border flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowGlobalAddAccountModal(false)} className="px-5 py-2 text-sm text-muted-foreground font-bold transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-extrabold rounded-xl shadow-lg transition-all">Add Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
