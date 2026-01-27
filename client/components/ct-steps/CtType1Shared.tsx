import React, { useState, useEffect, useRef } from 'react';
import {
    ChevronDownIcon,
    PlusIcon,
    CheckIcon,
    AssetIcon,
    BanknotesIcon,
    EquityIcon,
    IncomeIcon,
    ExpenseIcon
} from '../icons';
import { CHART_OF_ACCOUNTS } from '../../services/geminiService';

// --- Constants ---

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

export const ACCOUNT_MAPPING: Record<string, string> = {
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
    }
];

// --- Utility Functions ---

export const formatDecimalNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatWholeNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const getChildCategory = (category: string) => {
    if (!category) return '';
    const parts = category.split('|');
    return parts[parts.length - 1].trim();
};

export const formatDate = (dateStr: any) => {
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

export const getQuarter = (dateStr?: string) => {
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

export const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split(/[\/\-\.]/);
    if (parts.length < 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
};

export const getChildByValue = (items: string[], normalizedValue: string): string => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[–—]/g, '-').replace(/['"“”]/g, '').replace(/&/g, 'and').replace(/\s+/g, ' ');
    return items.find(i => normalize(i) === normalizedValue) || normalizedValue;
};

export const resolveCategoryPath = (category: string | undefined, customCategories: string[] = []): string => {
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

export const applySheetStyling = (worksheet: any, headerRows: number, totalRows: number = 0, customNumberFormat: string = '#,##0;[Red]-#,##0') => {
    // Note: XLSX should be provided globally or imported
    const headerStyle = { font: { bold: true, color: { rgb: "FFFFFFFF" } }, fill: { fgColor: { rgb: "FF111827" } }, alignment: { horizontal: 'center', vertical: 'center' } };
    const totalStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FF374151" } } };
    const cellBorder = { style: 'thin', color: { rgb: "FF4B5563" } };
    const border = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };
    const numberFormat = customNumberFormat;
    const quantityFormat = '#,##0';

    if (worksheet['!ref']) {
        // @ts-ignore
        const XLSX = window.XLSX;
        if (!XLSX) return;

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

// --- Shared Components ---

export const ResultsStatCard = ({ label, value, secondaryValue, color = "text-white", secondaryColor = "text-gray-400", icon }: { label: string, value: string, secondaryValue?: string, color?: string, secondaryColor?: string, icon?: React.ReactNode }) => (
    <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex items-center justify-between shadow-sm h-full">
        <div className="flex flex-col">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
            {secondaryValue && <p className={`text-[10px] font-mono mt-0.5 ${secondaryColor}`}>{secondaryValue}</p>}
        </div>
        {icon && <div className="text-gray-600 opacity-50 ml-2">{icon}</div>}
    </div>
);

export const CategoryDropdown = ({
    value,
    onChange,
    customCategories,
    placeholder = "Select Category...",
    className = "",
    showAllOption = false
}: {
    value: string;
    onChange: (val: string) => void;
    customCategories: string[];
    placeholder?: string;
    className?: string;
    showAllOption?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isUncategorized = (!value || value === 'UNCATEGORIZED' || value.toLowerCase().includes('uncategorized')) && value !== 'ALL';
    const currentLabel = value === 'ALL' ? 'All Categories' : (isUncategorized ? 'Uncategorized' : getChildCategory(value) || placeholder);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900 border ${isUncategorized ? 'border-red-500/30' : (value === 'ALL' ? 'border-indigo-500/30' : 'border-slate-700')} rounded-lg hover:border-blue-500/50 transition-all text-left outline-none min-h-[32px]`}
            >
                <span className={`text-[11px] truncate ${isUncategorized ? 'text-red-400 font-bold italic' : (value === 'ALL' ? 'text-indigo-300 font-bold' : 'text-slate-200')}`}>
                    {currentLabel}
                </span>
                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : 'text-slate-500'}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full min-w-[260px] bg-slate-900 border border-slate-700 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-150">
                    <div className="max-h-[320px] overflow-y-auto custom-scrollbar overflow-x-hidden">
                        {/* Static Actions */}
                        <div className="p-1 space-y-0.5">
                            {showAllOption && (
                                <button
                                    type="button"
                                    onClick={() => { onChange('ALL'); setIsOpen(false); }}
                                    className="w-full text-left px-3 py-2 hover:bg-blue-600 rounded-lg text-[11px] text-indigo-300 font-bold transition-colors"
                                >
                                    All Categories
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { onChange('UNCATEGORIZED'); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 hover:bg-blue-600 rounded-lg text-[11px] text-red-400 font-bold italic transition-colors"
                            >
                                Uncategorized
                            </button>
                            <button
                                type="button"
                                onClick={() => { onChange('__NEW__'); setIsOpen(false); }}
                                className="w-full text-left px-3 py-2 hover:bg-blue-600 rounded-lg text-[11px] text-blue-400 font-bold transition-colors flex items-center gap-2"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Add New Category
                            </button>
                        </div>

                        <div className="h-px bg-slate-800 my-1 mx-2" />

                        {/* Chart of Accounts */}
                        <div className="p-1 pb-4">
                            {Object.entries(CHART_OF_ACCOUNTS).map(([mainCategory, sub]) => {
                                const relatedCustom = customCategories.filter(c => c.startsWith(`${mainCategory} |`));
                                const standardOptions: string[] = [];

                                if (Array.isArray(sub)) {
                                    sub.forEach(item => standardOptions.push(`${mainCategory} | ${item}`));
                                } else if (typeof sub === 'object') {
                                    Object.entries(sub).forEach(([subGroup, items]) =>
                                        items.forEach(item => standardOptions.push(`${mainCategory} | ${subGroup} | ${item}`))
                                    );
                                }

                                if (relatedCustom.length === 0 && standardOptions.length === 0) return null;

                                return (
                                    <div key={mainCategory} className="mt-2">
                                        <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-white flex items-center gap-2 opacity-80">
                                            {mainCategory === 'Assets' && <AssetIcon className="w-3.5 h-3.5" />}
                                            {mainCategory === 'Liabilities' && <BanknotesIcon className="w-3.5 h-3.5" />}
                                            {mainCategory === 'Equity' && <EquityIcon className="w-3.5 h-3.5" />}
                                            {mainCategory === 'Income' && <IncomeIcon className="w-3.5 h-3.5" />}
                                            {mainCategory === 'Expenses' && <ExpenseIcon className="w-3.5 h-3.5" />}
                                            {mainCategory}
                                        </div>

                                        <div className="space-y-0.5">
                                            {relatedCustom.map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => { onChange(c); setIsOpen(false); }}
                                                    className={`w-full text-left px-8 py-1.5 hover:bg-blue-600 rounded-lg text-[11px] transition-colors ${value === c ? 'bg-blue-600 text-white font-bold' : 'text-blue-300'}`}
                                                >
                                                    {getChildCategory(c)} (Custom)
                                                </button>
                                            ))}

                                            {standardOptions.map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => { onChange(c); setIsOpen(false); }}
                                                    className={`w-full text-left px-8 py-1.5 hover:bg-blue-600 rounded-lg text-[11px] transition-colors ${value === c ? 'bg-blue-600 text-white font-bold' : 'text-slate-300'}`}
                                                >
                                                    {getChildCategory(c)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Stepper = ({ currentStep }: { currentStep: number }) => {
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
