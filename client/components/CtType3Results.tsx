

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
import { extractGenericDetailsFromDocuments, CHART_OF_ACCOUNTS, extractTrialBalanceData, extractVatCertificateData, extractVat201Totals } from '../services/geminiService';
import { ProfitAndLossStep, PNL_ITEMS, type ProfitAndLossItem } from './ProfitAndLossStep';
import { BalanceSheetStep, BS_ITEMS, type BalanceSheetItem } from './BalanceSheetStep';
import type { WorkingNoteEntry } from '../types';
import type { Part } from '@google/genai';
import { LoadingIndicator } from './LoadingIndicator';


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

const fileToPart = async (file: File): Promise<Part> => {
    const parts = await fileToGenerativeParts(file);
    return parts[0];
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
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>(initialAccountData);
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [vatFiles, setVatFiles] = useState<File[]>([]);
    const [vatDetails, setVatDetails] = useState<any>({});
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);
    const [isExtractingVat, setIsExtractingVat] = useState(false);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);
    const [louFiles, setLouFiles] = useState<File[]>([]);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');
    const [reportForm, setReportForm] = useState<any>({});

    const [pnlValues, setPnlValues] = useState<Record<string, number>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, number>>({});
    const [pnlStructure, setPnlStructure] = useState<ProfitAndLossItem[]>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<BalanceSheetItem[]>(BS_ITEMS);
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});

    const [workingNoteModalOpen, setWorkingNoteModalOpen] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string>('');
    const [tempBreakdown, setTempBreakdown] = useState<WorkingNoteEntry[]>([]);

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

    useEffect(() => {
        if (ftaFormValues) {
            setPnlValues(prev => {
                if (Object.keys(prev).length > 0) return prev;
                return {
                    revenue: ftaFormValues.operatingRevenue,
                    cost_of_revenue: ftaFormValues.derivingRevenueExpenses,
                    gross_profit: ftaFormValues.grossProfit,
                    administrative_expenses: ftaFormValues.salaries + ftaFormValues.otherExpenses,
                    depreciation_ppe: ftaFormValues.depreciation,
                    profit_loss_year: ftaFormValues.netProfit,
                    total_comprehensive_income: ftaFormValues.netProfit,
                    profit_after_tax: ftaFormValues.netProfit
                };
            });

            setBalanceSheetValues(prev => {
                if (Object.keys(prev).length > 0) return prev;
                return {
                    property_plant_equipment: ftaFormValues.ppe,
                    total_non_current_assets: ftaFormValues.ppe,
                    cash_bank_balances: ftaFormValues.totalCurrentAssets,
                    total_current_assets: ftaFormValues.totalCurrentAssets,
                    total_assets: ftaFormValues.totalAssets,
                    share_capital: ftaFormValues.shareCapital,
                    retained_earnings: ftaFormValues.netProfit,
                    total_equity: ftaFormValues.shareCapital + ftaFormValues.netProfit,
                    total_non_current_liabilities: ftaFormValues.totalNonCurrentLiabilities,
                    total_current_liabilities: ftaFormValues.totalCurrentLiabilities,
                    total_liabilities: ftaFormValues.totalLiabilities,
                    total_equity_liabilities: ftaFormValues.totalAssets
                };
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
                const totals = await extractVat201Totals(parts);
                return {
                    fileName: file.name,
                    salesField8: totals.salesTotal,
                    expensesField11: totals.expensesTotal,
                    periodFrom: totals.periodFrom,
                    periodTo: totals.periodTo
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

    const handleOpeningBalancesComplete = () => {
        const tbEntries: TrialBalanceEntry[] = openingBalancesData.flatMap(cat =>
            cat.accounts.filter(acc => acc.debit > 0 || acc.credit > 0).map(acc => ({
                account: acc.name,
                debit: acc.debit,
                credit: acc.credit
            }))
        );

        // Auto-populate Share Capital from customer details
        if (company?.shareCapital) {
            const shareCapitalValue = parseFloat(String(company.shareCapital)) || 0;
            if (shareCapitalValue > 0) {
                const shareCapitalIndex = tbEntries.findIndex(
                    entry => entry.account === 'Share Capital / Owner’s Equity'
                );

                if (shareCapitalIndex > -1) {
                    // Update existing entry
                    tbEntries[shareCapitalIndex] = {
                        ...tbEntries[shareCapitalIndex],
                        credit: shareCapitalValue,
                        debit: 0
                    };
                } else {
                    // Add new entry
                    tbEntries.push({
                        account: 'Share Capital / Owner’s Equity',
                        debit: 0,
                        credit: shareCapitalValue
                    });
                }
            }
        }

        const totalDebit = tbEntries.reduce((s, i) => s + i.debit, 0);
        const totalCredit = tbEntries.reduce((s, i) => s + i.credit, 0);
        tbEntries.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });
        setAdjustedTrialBalance(tbEntries);
        setCurrentStep(2); // Trial Balance step
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
        const vatData: any[][] = [["STEP 3: VAT SUMMARIZATION DETAILS"], [], ["Field", "Value"]];
        Object.entries(vatDetails).forEach(([key, value]) => {
            vatData.push([key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), renderReportField(value)]);
        });

        // Add reconciliation table
        vatData.push([], ["RECONCILIATION AGAINST TRIAL BALANCE"], ["Description", "Official VAT Cert", "Adjusted TB Figure", "Variance", "Status"]);

        const salesVat = vatDetails.standardRatedSuppliesVatAmount || 0;
        const purchaseVat = vatDetails.standardRatedExpensesVatAmount || 0;
        const tbOutputVat = Math.abs(adjustedTrialBalance?.find(i => i.account === 'VAT Payable (Output VAT)')?.credit || 0);
        const tbInputVat = Math.abs(adjustedTrialBalance?.find(i => i.account === 'VAT Recoverable (Input VAT)')?.debit || 0);

        vatData.push(
            ["Output VAT (Sales)", salesVat, tbOutputVat, Math.abs(salesVat - tbOutputVat), isMatch(salesVat, tbOutputVat) ? "MATCHED" : "VARIANCE"],
            ["Input VAT (Purchases)", purchaseVat, tbInputVat, Math.abs(purchaseVat - tbInputVat), isMatch(purchaseVat, tbInputVat) ? "MATCHED" : "VARIANCE"]
        );

        const ws = XLSX.utils.aoa_to_sheet(vatData);
        ws['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
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

        // Step 3: VAT Details
        const vatData: any[][] = [["STEP 3: VAT SUMMARIZATION DETAILS"], [], ["Field", "Value"]];
        Object.entries(vatDetails).forEach(([key, value]) => {
            vatData.push([key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), renderReportField(value)]);
        });
        vatData.push([], ["RECONCILIATION AGAINST TRIAL BALANCE"], ["Description", "Official VAT Cert", "Adjusted TB Figure", "Variance", "Status"]);
        const salesVat = vatDetails.standardRatedSuppliesVatAmount || 0;
        const purchaseVat = vatDetails.standardRatedExpensesVatAmount || 0;
        const tbOutputVat = Math.abs(adjustedTrialBalance?.find(i => i.account === 'VAT Payable (Output VAT)')?.credit || 0);
        const tbInputVat = Math.abs(adjustedTrialBalance?.find(i => i.account === 'VAT Recoverable (Input VAT)')?.debit || 0);
        vatData.push(
            ["Output VAT (Sales)", salesVat, tbOutputVat, Math.abs(salesVat - tbOutputVat), isMatch(salesVat, tbOutputVat) ? "MATCHED" : "VARIANCE"],
            ["Input VAT (Purchases)", purchaseVat, tbInputVat, Math.abs(purchaseVat - tbInputVat), isMatch(purchaseVat, tbInputVat) ? "MATCHED" : "VARIANCE"]
        );
        const vatWs = XLSX.utils.aoa_to_sheet(vatData);
        vatWs['!cols'] = [{ wch: 40 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
        applySheetStyling(vatWs, 3);
        XLSX.utils.book_append_sheet(workbook, vatWs, "3. VAT Summary");

        // Step 4: LOU Documents
        const louData = [["STEP 4: LOU DOCUMENTS (REFERENCE ONLY)"], [], ["Filename", "Size (bytes)", "Status"]];
        louFiles.forEach(file => {
            louData.push([file.name, file.size, "Uploaded"]);
        });
        const louWs = XLSX.utils.aoa_to_sheet(louData);
        louWs['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 15 }];
        applySheetStyling(louWs, 3);
        XLSX.utils.book_append_sheet(workbook, louWs, "4. LOU Documents");

        // Step 5: Questionnaire
        const qData = [["STEP 5: CT QUESTIONNAIRE"], [], ["No.", "Question", "Answer"]];
        CT_QUESTIONS.forEach(q => {
            qData.push([q.id, q.text, questionnaireAnswers[q.id] || "N/A"]);
        });
        const qWs = XLSX.utils.aoa_to_sheet(qData);
        qWs['!cols'] = [{ wch: 10 }, { wch: 80 }, { wch: 15 }];
        applySheetStyling(qWs, 3);
        XLSX.utils.book_append_sheet(workbook, qWs, "5. Questionnaire");

        // Step 6: Final Report
        const reportData: any[][] = [
            ["STEP 6: CORPORATE TAX RETURN - FINAL REPORT"],
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
        XLSX.utils.book_append_sheet(workbook, reportWs, "6. Final Report");

        XLSX.writeFile(workbook, `${companyName}_CT_Type3_Complete_Filing.xlsx`);
    };

    const handlePnlChange = (id: string, value: number) => {
        setPnlValues(prev => ({ ...prev, [id]: value }));
    };

    const handleBalanceSheetChange = (id: string, value: number) => {
        setBalanceSheetValues(prev => ({ ...prev, [id]: value }));
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
        const total = notes.reduce((sum, n) => sum + (n.amount || 0), 0);
        handlePnlChange(id, total);
    };

    const handleUpdateBsWorkingNote = (id: string, notes: WorkingNoteEntry[]) => {
        setBsWorkingNotes(prev => ({ ...prev, [id]: notes }));
        const total = notes.reduce((sum, n) => sum + (n.amount || 0), 0);
        handleBalanceSheetChange(id, total);
    };

    const handleExportStepPnl = () => {
        const wb = XLSX.utils.book_new();
        const data = pnlStructure.map(item => ({
            'Item': item.label,
            'Amount': pnlValues[item.id] || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Profit and Loss");
        XLSX.writeFile(wb, `${companyName}_Profit_And_Loss.xlsx`);
    };

    const handleExportStepBS = () => {
        const wb = XLSX.utils.book_new();
        const data = bsStructure.map(item => ({
            'Item': item.label,
            'Amount': balanceSheetValues[item.id] || 0
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Balance Sheet");
        XLSX.writeFile(wb, `${companyName}_Balance_Sheet.xlsx`);
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



    const handleExtractOpeningBalances = async () => {
        if (openingBalanceFiles.length === 0) return;
        setIsExtractingOpeningBalances(true);
        try {
            const parts = await Promise.all(openingBalanceFiles.map(async (file) => fileToPart(file)));
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

                {isExtractingTB && <div className="p-6 border-b border-gray-800 bg-black/40"><LoadingIndicator progress={60} statusText="Gemini AI is reading your Trial Balance table..." size="compact" /></div>}

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
            onNext={() => setCurrentStep(5)}
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
            onNext={() => setCurrentStep(6)}
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
                        disabled={currentStep !== 8}
                        className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed transition-colors"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All
                    </button>
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50">
                        <RefreshIcon className="w-4 h-4 mr-2" /> Start Over
                    </button>
                </div>
            </div>

            <Stepper currentStep={currentStep} />

            {currentStep === 1 && (
                <div className="space-y-6">
                    <OpeningBalances
                        onComplete={handleOpeningBalancesComplete}
                        currency={currency}
                        accountsData={openingBalancesData}
                        onAccountsDataChange={setOpeningBalancesData}
                        onExport={handleExportStep1}
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

            {currentStep === 4 && (
                (() => {
                    const fileResults = vatDetails.vatFileResults || [];
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
                })()
            )}

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
                                onClick={() => setCurrentStep(8)}
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

            {currentStep === 8 && renderStepFinalReport()}

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
