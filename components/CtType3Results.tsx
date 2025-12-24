

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
    ClipboardCheckIcon
} from './icons';
import { OpeningBalances, initialAccountData } from './OpeningBalances';
import { FileUploadArea } from './VatFilingUpload';
import { extractGenericDetailsFromDocuments, CHART_OF_ACCOUNTS, extractTrialBalanceData } from '../services/geminiService';
import type { Part } from '@google/genai';
import { LoadingIndicator } from './LoadingIndicator';

declare const XLSX: any;

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

const applySheetStyling = (worksheet: any) => {
    const numberFormat = '#,##0.00;[Red]-#,##0.00';
    if (worksheet['!ref']) {
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: R })];
                if (cell && typeof cell.v === 'number') {
                    cell.z = numberFormat;
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

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ["Opening Balance", "Trial Balance", "LOU Upload", "CT Questionnaire", "Final Report"];
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
                                <div className={`absolute top-0 left-0 h-full bg-white transition-all duration-500`} style={{width: isCompleted ? '100%' : '0%'}}></div>
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    );
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
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(initialAccountData);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({});
    const [isExtracting, setIsExtracting] = useState(false);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');
    const [reportForm, setReportForm] = useState<any>({});
    
    const tbFileInputRef = useRef<HTMLInputElement>(null);

    // Calculate FTA Figures from Adjusted Trial Balance
    const ftaFormValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;

        const getSum = (labels: string[]) => {
            return labels.reduce((acc, curr) => {
                const item = adjustedTrialBalance.find(i => i.account === curr);
                if (!item) return acc;
                return acc + (item.debit - item.credit);
            }, 0);
        };

        const operatingRevenue = Math.abs(getSum(['Sales Revenue', 'Sales to related Parties']));
        const derivingRevenueExpenses = Math.abs(getSum(['Direct Cost (COGS)', 'Purchases from Related Parties']));
        const grossProfit = operatingRevenue - derivingRevenueExpenses;

        const salaries = Math.abs(getSum(['Salaries & Wages', 'Staff Benefits']));
        const depreciation = Math.abs(getSum(['Depreciation', 'Amortization – Intangibles']));
        const otherExpenses = Math.abs(getSum(['Office Supplies & Stationery', 'Repairs & Maintenance', 'Insurance Expense', 'Marketing & Advertising', 'Professional Fees', 'Legal Fees', 'IT & Software Subscriptions', 'Fuel Expenses', 'Transportation & Logistics', 'Bank Charges', 'VAT Expense (non-recoverable)', 'Corporate Tax Expense', 'Government Fees & Licenses', 'Bad Debt Expense', 'Miscellaneous Expense']));
        const nonOpExpensesExcl = salaries + depreciation + otherExpenses;

        const dividendsReceived = Math.abs(getSum(['Dividends received']));
        const otherNonOpRevenue = Math.abs(getSum(['Other non-operating Revenue', 'Other Operating Income']));

        const interestIncome = Math.abs(getSum(['Interest Income', 'Interest from Related Parties']));
        const interestExpense = Math.abs(getSum(['Interest Expense', 'Interest to Related Parties']));
        const netInterest = interestIncome - interestExpense;

        const netProfit = grossProfit - nonOpExpensesExcl + dividendsReceived + otherNonOpRevenue + netInterest;

        const totalCurrentAssets = Math.abs(getSum(['Cash on Hand', 'Bank Accounts', 'Accounts Receivable', 'Due from related Parties', 'Prepaid Expenses', 'Deposits', 'VAT Recoverable (Input VAT)', 'Inventory – Goods', 'Work-in-Progress – Services']));
        const ppe = Math.abs(getSum(['Property, Plant & Equipment', 'Furniture & Equipment', 'Vehicles']));
        const totalNonCurrentAssets = ppe;
        const totalAssets = totalCurrentAssets + totalNonCurrentAssets;
        
        const totalCurrentLiabilities = Math.abs(getSum(['Accounts Payable', 'Due to Related Parties', 'Accrued Expenses', 'Advances from Customers', 'Short-Term Loans', 'VAT Payable (Output VAT)', 'Corporate Tax Payable']));
        const totalNonCurrentLiabilities = Math.abs(getSum(['Long-Term Liabilities', 'Long-Term Loans', 'Loans from Related Parties', 'Employee End-of-Service Benefits Provision']));
        const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;

        const shareCapital = Math.abs(getSum(['Share Capital / Owner’s Equity']));
        const totalEquity = shareCapital;
        const totalEquityLiabilities = totalEquity + totalLiabilities;

        const taxableIncome = Math.max(0, netProfit);
        const threshold = 375000;
        const corporateTaxLiability = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;

        return {
            operatingRevenue, derivingRevenueExpenses, grossProfit,
            salaries, depreciation, otherExpenses, nonOpExpensesExcl,
            dividendsReceived, otherNonOpRevenue,
            interestIncome, interestExpense, netInterest,
            netProfit,
            totalCurrentAssets, ppe, totalNonCurrentAssets, totalAssets,
            totalCurrentLiabilities, totalNonCurrentLiabilities, totalLiabilities,
            shareCapital, totalEquity, totalEquityLiabilities,
            taxableIncome, corporateTaxLiability
        };
    }, [adjustedTrialBalance]);

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

    const handleBack = () => setCurrentStep(prev => prev - 1);

    const handleOpeningBalancesComplete = () => {
        const tbEntries: TrialBalanceEntry[] = openingBalancesData.flatMap(cat => 
            cat.accounts.filter(acc => acc.debit > 0 || acc.credit > 0).map(acc => ({
                account: acc.name,
                debit: acc.debit,
                credit: acc.credit
            }))
        );
        const totalDebit = tbEntries.reduce((s, i) => s + i.debit, 0);
        const totalCredit = tbEntries.reduce((s, i) => s + i.credit, 0);
        tbEntries.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });
        setAdjustedTrialBalance(tbEntries);
        setCurrentStep(2);
    };

    const handleExportFinalExcel = () => {
        if (!adjustedTrialBalance || !ftaFormValues) return;
        const workbook = XLSX.utils.book_new();
        
        const formData = [
            ["CORPORATE TAX RETURN - FEDERAL TAX AUTHORITY"],
            ["Taxable Person", reportForm.taxableNameEn],
            ["TRN", reportForm.trn],
            ["Period", `${reportForm.periodFrom} to ${reportForm.periodTo}`],
            [],
            ["ACCOUNTING SUMMARY (AED)"],
            ["Operating Revenue", reportForm.operatingRevenue],
            ["Gross Profit", reportForm.grossProfit],
            ["Net Profit", reportForm.netProfit],
            ["Taxable Income", reportForm.taxableIncomeTaxPeriod],
            ["Tax Payable", reportForm.corporateTaxPayable]
        ];
        const formWs = XLSX.utils.aoa_to_sheet(formData);
        XLSX.utils.book_append_sheet(workbook, formWs, "Tax Return Summary");

        const tbData = adjustedTrialBalance.map(item => ({
            Account: item.account,
            Debit: item.debit || null,
            Credit: item.credit || null,
        }));
        const tbWorksheet = XLSX.utils.json_to_sheet(tbData);
        applySheetStyling(tbWorksheet);
        XLSX.utils.book_append_sheet(workbook, tbWorksheet, "Adjusted Trial Balance");
    
        XLSX.writeFile(workbook, `${companyName}_CT_Filing_Type3.xlsx`);
    };

    const handleExportStep1 = () => {
        const flatData = openingBalancesData.flatMap(cat => 
            cat.accounts.filter(acc => acc.debit > 0 || acc.credit > 0).map(acc => ({
                Category: cat.category,
                Account: acc.name,
                Debit: acc.debit,
                Credit: acc.credit
            }))
        );
        const ws = XLSX.utils.json_to_sheet(flatData);
        applySheetStyling(ws);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
        XLSX.writeFile(wb, `${companyName}_Opening_Balances.xlsx`);
    };

    const handleExportStep2 = () => {
        if (!adjustedTrialBalance) return;
        const data = adjustedTrialBalance.map(tb => ({ Account: tb.account, Debit: tb.debit || null, Credit: tb.credit || null }));
        const ws = XLSX.utils.json_to_sheet(data);
        applySheetStyling(ws);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
        XLSX.writeFile(wb, `${companyName}_Adjusted_Trial_Balance.xlsx`);
    };

    const handleExportStep3 = () => {
        const data = Object.entries(additionalDetails).map(([key, value]) => [key, value]);
        const ws = XLSX.utils.aoa_to_sheet([["Field", "Value"], ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "LOU Details");
        XLSX.writeFile(wb, `${companyName}_LOU_Details.xlsx`);
    };

    const handleExportStep4 = () => {
        const data = CT_QUESTIONS.map(q => ({ "No.": q.id, "Question": q.text, "Answer": questionnaireAnswers[q.id] || "N/A" }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CT Questionnaire");
        XLSX.writeFile(wb, `${companyName}_CT_Questionnaire.xlsx`);
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

    const handleExtractTrialBalance = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setIsExtractingTB(true);
        try {
            const part = await fileToPart(file);
            const extractedEntries = await extractTrialBalanceData([part]);
            if (extractedEntries && extractedEntries.length > 0) {
                setAdjustedTrialBalance(prev => {
                    const currentMap: Record<string, TrialBalanceEntry> = {};
                    (prev || []).forEach(item => { if (item.account.toLowerCase() !== 'totals') currentMap[item.account.toLowerCase()] = item; });
                    extractedEntries.forEach(extracted => { currentMap[extracted.account.toLowerCase()] = extracted; });
                    const newEntries = Object.values(currentMap);
                    const totalDebit = newEntries.reduce((s, i) => s + (Number(i.debit) || 0), 0);
                    const totalCredit = newEntries.reduce((s, i) => s + (Number(i.credit) || 0), 0);
                    return [...newEntries, { account: 'Totals', debit: totalDebit, credit: totalCredit }];
                });
            }
        } catch (err) {
            console.error("TB extraction failed", err);
            alert("Failed to extract data from Trial Balance.");
        } finally {
            setIsExtractingTB(false);
            if (tbFileInputRef.current) tbFileInputRef.current.value = '';
        }
    };

    const handleExtractAdditionalData = async () => {
        if (additionalFiles.length === 0) return;
        setIsExtracting(true);
        try {
            const parts = await Promise.all(additionalFiles.map(async (file) => fileToPart(file)));
            const details = await extractGenericDetailsFromDocuments(parts);
            setAdditionalDetails(details || {});
        } catch (e) {
            console.error("Extraction failed", e);
        } finally {
            setIsExtracting(false);
        }
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

    const renderAdjustTB = () => {
        const grandTotal = { 
            debit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.debit || 0, 
            credit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.credit || 0 
        };
        const sections = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];

        return (
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 bg-gray-950 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Adjust Trial Balance</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" />
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

                {isExtractingTB && <div className="p-10 border-b border-gray-800 bg-black/40"><LoadingIndicator progress={60} statusText="Gemini AI is reading your Trial Balance table..." /></div>}

                <div className="divide-y divide-gray-800">
                    {sections.map(sec => (
                        <div key={sec}>
                            <button onClick={() => setOpenTbSection(openTbSection === sec ? null : sec)} className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === sec ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}>
                                <div className="flex items-center space-x-3">{React.createElement(getIconForSection(sec), { className: "w-5 h-5 text-gray-400" })}<span className="font-bold text-white uppercase tracking-wide">{sec}</span></div>
                                {openTbSection === sec ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                            </button>
                            {openTbSection === sec && (
                                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead><tr className="bg-gray-800/30 text-gray-500 text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-gray-700/50">Account Name</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Debit</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Credit</th></tr></thead>
                                        <tbody>
                                            {adjustedTrialBalance?.filter(i => i.account !== 'Totals').map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0">
                                                    <td className="py-2 px-4 text-gray-300 font-medium">{item.account}</td>
                                                    <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.debit || ''} onChange={e => handleCellChange(item.account, 'debit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs" /></td>
                                                    <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.credit || ''} onChange={e => handleCellChange(item.account, 'credit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs" /></td>
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

    const renderStepFinalReport = () => {
        if (!ftaFormValues) return null;

        const sections = [
            {
                id: 'tax-return-info',
                title: 'Corporate Tax Return Information',
                icon: InformationCircleIcon,
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
                icon: IdentificationIcon,
                fields: [
                    { label: 'Taxable Person Name in English', field: 'taxableNameEn' },
                    { label: 'Entity Type', field: 'entityType' },
                    { label: 'TRN', field: 'trn' },
                    { label: 'Primary Business', field: 'primaryBusiness' }
                ]
            },
            {
                id: 'address-details',
                title: 'Address Details',
                icon: BuildingOfficeIcon,
                fields: [
                    { label: 'Address', field: 'address', colSpan: true },
                    { label: 'Mobile Number', field: 'mobileNumber' },
                    { label: 'Email ID', field: 'emailId' }
                ]
            },
            {
                id: 'profit-loss',
                title: 'Statement of Profit or Loss',
                icon: IncomeIcon,
                fields: [
                    { label: 'Operating Revenue (AED)', field: 'operatingRevenue', type: 'number' },
                    { label: 'Expenditure incurred in deriving operating revenue (AED)', field: 'derivingRevenueExpenses', type: 'number' },
                    { label: 'Gross Profit / Loss (AED)', field: 'grossProfit', type: 'number', highlight: true },
                    { label: '--- Non-operating Expense ---', field: '_header_non_op', type: 'header' },
                    { label: 'Salaries, wages and related charges (AED)', field: 'salaries', type: 'number' },
                    { label: 'Depreciation and amortisation (AED)', field: 'depreciation', type: 'number' },
                    { label: 'Other expenses (AED)', field: 'otherExpenses', type: 'number' },
                    { label: 'Non-operating expenses (Excluding other items listed below) (AED)', field: 'nonOpExpensesExcl', type: 'number', highlight: true },
                    { label: '--- Other Items ---', field: '_header_other', type: 'header' },
                    { label: 'Net Interest Income / (Expense) (AED)', field: 'netInterest', type: 'number', highlight: true },
                    { label: 'Net profit / (loss) (AED)', field: 'netProfit', type: 'number', highlight: true }
                ]
            },
            {
                id: 'financial-position',
                title: 'Statement of Financial Position',
                icon: AssetIcon,
                fields: [
                    { label: '--- Assets ---', field: '_header_assets', type: 'header' },
                    { label: 'Total current assets (AED)', field: 'totalCurrentAssets', type: 'number', highlight: true },
                    { label: 'Property, Plant and Equipment (AED)', field: 'ppe', type: 'number' },
                    { label: 'Total assets (AED)', field: 'totalAssets', type: 'number', highlight: true },
                    { label: '--- Liabilities ---', field: '_header_liabilities', type: 'header' },
                    { label: 'Total current liabilities (AED)', field: 'totalCurrentLiabilities', type: 'number', highlight: true },
                    { label: 'Total liabilities (AED)', field: 'totalLiabilities', type: 'number', highlight: true },
                    { label: '--- Equity ---', field: '_header_equity', type: 'header' },
                    { label: 'Share capital (AED)', field: 'shareCapital', type: 'number' },
                    { label: 'Total equity (AED)', field: 'totalEquity', type: 'number', highlight: true },
                    { label: 'Total equity and liabilities (AED)', field: 'totalEquityLiabilities', type: 'number', highlight: true }
                ]
            },
            {
                id: 'tax-summary',
                title: 'Tax Summary',
                icon: ChartBarIcon,
                fields: [
                    { label: '1. Accounting Income for the Tax Period (AED)', field: 'accountingIncomeTaxPeriod', type: 'number' },
                    { label: '23. Taxable Income / (Tax Loss) for the Tax Period (AED)', field: 'taxableIncomeTaxPeriod', type: 'number', highlight: true },
                    { label: '24. Corporate Tax Liability (AED)', field: 'corporateTaxLiability', type: 'number', highlight: true },
                    { label: '26. Corporate Tax Payable (AED)', field: 'corporateTaxPayable', type: 'number', highlight: true }
                ]
            },
            {
                id: 'declaration',
                title: 'Review and Declaration',
                icon: ClipboardCheckIcon,
                fields: [
                    { label: 'Date of Submission', field: 'declarationDate' },
                    { label: 'Confirm who the Tax Return is being prepared by', field: 'preparedBy' },
                    { label: 'I confirm the Declaration', field: 'declarationConfirmed' }
                ]
            }
        ];

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
                             <button onClick={onReset} className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-700 text-gray-500 hover:text-white rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-800">Start Over</button>
                             <button onClick={handleExportFinalExcel} className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block"/>
                                Generate & Export
                            </button>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-800">
                        {sections.map(section => (
                            <div key={section.id} className="group">
                                <button onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)} className={`w-full flex items-center justify-between p-6 transition-all ${openReportSection === section.title ? 'bg-[#1E293B]/40' : 'hover:bg-[#1E293B]/20'}`}>
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-6 shadow-inner">
                                            {section.fields.map(f => {
                                                if (f.type === 'header') {
                                                    return (
                                                        <div key={f.field} className="md:col-span-2 pt-6 pb-2 border-b border-gray-800 mb-2">
                                                            <h4 className="text-sm font-black text-gray-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={f.field} className={`flex flex-col py-3 border-b border-gray-800/50 last:border-0 ${f.colSpan ? 'md:col-span-2' : ''}`}>
                                                        <label className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${f.highlight ? 'text-blue-400' : 'text-gray-500'}`}>{f.label}</label>
                                                        {f.type === 'number' ? <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-300' : ''} /> : <ReportInput field={f.field} className={f.highlight ? 'text-blue-300' : ''} />}
                                                    </div>
                                                );
                                            })}
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
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="bg-gray-900/50 backdrop-blur-md p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 shadow-inner group transition-transform hover:scale-105">
                        <BuildingOfficeIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">{companyName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-blue-400/80"><BriefcaseIcon className="w-3.5 h-3.5"/> TYPE 3 WORKFLOW (TRIAL BALANCE)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50">
                        <RefreshIcon className="w-4 h-4 mr-2" /> Start Over
                    </button>
                </div>
            </div>

            <Stepper currentStep={currentStep} />

            {currentStep === 1 && (
                <div className="space-y-6">
                    <OpeningBalances onComplete={handleOpeningBalancesComplete} currency={currency} accountsData={openingBalancesData} onAccountsDataChange={setOpeningBalancesData} onExport={handleExportStep1} />
                    <div className="flex justify-start"><button onClick={onReset} className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors">Back to Dashboard</button></div>
                </div>
            )}

            {currentStep === 2 && renderAdjustTB()}

            {currentStep === 3 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30"><DocumentDuplicateIcon className="w-8 h-8 text-purple-400" /></div>
                                <div><h3 className="text-2xl font-bold text-white tracking-tight">LOU Upload & Extraction</h3><p className="text-gray-400 mt-1 max-w-2xl">Upload Letter of Undertaking or other supporting documents to finalize the filing preparation.</p></div>
                            </div>
                        </div>
                        <div className="p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <FileUploadArea title="Upload LOU Documents" icon={<DocumentDuplicateIcon className="w-6 h-6"/>} selectedFiles={additionalFiles} onFilesSelect={setAdditionalFiles} />
                                <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 flex flex-col min-h-[400px]">
                                    <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                                        <div className="flex items-center gap-2"><SparklesIcon className="w-5 h-5 text-blue-400" /><h4 className="font-bold text-white uppercase text-xs tracking-widest">Extracted Details</h4></div>
                                        <div className="flex gap-2">
                                            <button onClick={handleExportStep3} disabled={Object.keys(additionalDetails).length === 0} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-[10px] font-black uppercase rounded-lg border border-gray-700 disabled:opacity-50"><DocumentArrowDownIcon className="w-3.5 h-3.5 mr-1 inline-block" /> Export</button>
                                            <button onClick={handleExtractAdditionalData} disabled={additionalFiles.length === 0 || isExtracting} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase rounded-lg shadow-lg disabled:opacity-50">{isExtracting ? 'Extracting...' : 'Extract Data'}</button>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0A0F1D] rounded-xl border border-gray-800 p-4">
                                        {Object.keys(additionalDetails).length > 0 ? (
                                            <ul className="space-y-4">
                                                {Object.entries(additionalDetails).map(([k, v]) => (
                                                    <li key={k} className="flex justify-between items-start gap-4 border-b border-gray-800/50 pb-2 last:border-0"><span className="text-[10px] font-black text-gray-500 uppercase mt-1 shrink-0">{k.replace(/_/g, ' ')}:</span><span className="text-sm text-white text-right font-medium leading-relaxed">{String(v)}</span></li>
                                                ))}
                                            </ul>
                                        ) : <div className="h-full flex flex-col items-center justify-center opacity-30 text-gray-600"><LightBulbIcon className="w-10 h-10 mb-2"/><p className="text-xs font-bold uppercase tracking-widest">No data extracted</p></div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-4">
                        <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                        <button onClick={() => setCurrentStep(4)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Continue</button>
                    </div>
                </div>
            )}

            {currentStep === 4 && (
                <div className="space-y-6 max-w-5xl mx-auto pb-12">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center border border-blue-800"><QuestionMarkCircleIcon className="w-7 h-7 text-blue-400" /></div>
                                <div><h3 className="text-xl font-bold text-white uppercase tracking-tight">Corporate Tax Questionnaire</h3><p className="text-xs text-gray-400 mt-1">Please answer for final tax computation.</p></div>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-800 max-h-[60vh] overflow-y-auto custom-scrollbar bg-black/20">
                            {CT_QUESTIONS.map((q) => (
                                <div key={q.id} className="p-6 hover:bg-white/5 transition-colors group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex gap-4 flex-1"><span className="text-xs font-bold text-gray-600 font-mono mt-1">{String(q.id).padStart(2, '0')}</span><p className="text-sm font-medium text-gray-200 leading-relaxed">{q.text}</p></div>
                                        <div className="flex items-center gap-2 bg-gray-800/50 p-1 rounded-xl border border-gray-700 shrink-0">
                                            {['Yes', 'No'].map((opt) => (
                                                <button key={opt} onClick={() => setQuestionnaireAnswers(prev => ({ ...prev, [q.id]: opt }))} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${questionnaireAnswers[q.id] === opt ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-gray-700'}`}>{opt}</button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 bg-gray-950 border-t border-gray-800 flex justify-between items-center">
                            <div className="flex gap-4">
                                <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                                <button onClick={handleExportStep4} className="flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-xl border border-gray-700 transition-all uppercase text-[10px] tracking-widest"><DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Export</button>
                            </div>
                            <button onClick={() => setCurrentStep(5)} disabled={Object.keys(questionnaireAnswers).length < CT_QUESTIONS.length} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center disabled:opacity-50 transition-all transform hover:scale-[1.02]">Final Report</button>
                        </div>
                    </div>
                </div>
            )}

            {currentStep === 5 && renderStepFinalReport()}

            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); if(newGlobalAccountName.trim()){ const newItem = { account: newGlobalAccountName.trim(), debit: 0, credit: 0 }; setAdjustedTrialBalance(prev => { if(!prev) return [newItem]; const newTb = [...prev]; const totalsIdx = newTb.findIndex(i => i.account === 'Totals'); if(totalsIdx > -1) newTb.splice(totalsIdx, 0, newItem); else newTb.push(newItem); return newTb; }); setShowGlobalAddAccountModal(false); setNewGlobalAccountName(''); }}}>
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