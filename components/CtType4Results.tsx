import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Company } from '../types';
import {
    DocumentArrowDownIcon,
    CheckIcon,
    SparklesIcon,
    BriefcaseIcon,
    LightBulbIcon,
    ChevronDownIcon,
    ListBulletIcon,
    ChartBarIcon,
    ClipboardCheckIcon,
    InformationCircleIcon,
    IdentificationIcon,
    BuildingOfficeIcon,
    IncomeIcon,
    AssetIcon,
    ScaleIcon,
    ChevronLeftIcon,
    ShieldCheckIcon,
    DocumentDuplicateIcon
} from './icons';
import { FileUploadArea } from './VatFilingUpload';
import { extractGenericDetailsFromDocuments, extractAuditReportDetails } from '../services/geminiService';
import type { Part } from '@google/genai';

declare const XLSX: any;

interface CtType4ResultsProps {
    currency: string;
    companyName: string;
    onReset: () => void;
    company: Company | null;
}

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

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ["Audit Report Upload", "LOU Upload", "CT Questionnaire", "Final Report"];
    return (
        <div className="flex items-center w-full max-w-4xl mx-auto mb-8 overflow-x-auto pb-2">
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



export const CtType4Results: React.FC<CtType4ResultsProps> = ({ currency, companyName, onReset, company }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [auditFiles, setAuditFiles] = useState<File[]>([]);
    const [extractedDetails, setExtractedDetails] = useState<Record<string, any>>({});
    const [isExtracting, setIsExtracting] = useState(false);
    const [openExtractedSection, setOpenExtractedSection] = useState<string | null>(null);
    // LOU State
    const [louFiles, setLouFiles] = useState<File[]>([]);

    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');
    const [reportForm, setReportForm] = useState<any>({});
    const [selectedDocCategory, setSelectedDocCategory] = useState<string>('');

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

    useEffect(() => {
        // Map structured extraction data to flat report fields
        const genInfo = extractedDetails?.generalInformation || {};
        const pnl = extractedDetails?.statementOfComprehensiveIncome || {};
        const bs = extractedDetails?.statementOfFinancialPosition || {};
        const other = extractedDetails?.otherInformation || {};
        const audit = extractedDetails?.auditorsReport || {};

        setReportForm((prev: any) => ({
            ...prev,
            dueDate: prev.dueDate || company?.ctDueDate || '30/09/2025',
            periodDescription: prev.periodDescription || `Tax Year End ${company?.ctPeriodEnd?.split('/').pop() || '2024'}`,
            periodFrom: prev.periodFrom || company?.ctPeriodStart || '01/01/2024',
            periodTo: prev.periodTo || company?.ctPeriodEnd || '31/12/2024',
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

            // P&L Data carry-forward
            operatingRevenue: pnl.revenue || prev.operatingRevenue || 0,
            derivingRevenueExpenses: pnl.costOfSales || prev.derivingRevenueExpenses || 0,
            grossProfit: pnl.grossProfit || prev.grossProfit || 0,
            otherNonOpRevenue: pnl.otherIncome || prev.otherNonOpRevenue || 0,
            interestExpense: pnl.financeCosts || prev.interestExpense || 0,
            netProfit: pnl.netProfit || prev.netProfit || 0,
            totalComprehensiveIncome: pnl.totalComprehensiveIncome || prev.totalComprehensiveIncome || 0,

            // Balance Sheet Data carry-forward
            totalAssets: bs.totalAssets || prev.totalAssets || 0,
            totalLiabilities: bs.totalLiabilities || prev.totalLiabilities || 0,
            totalEquity: bs.totalEquity || prev.totalEquity || 0,
            totalCurrentAssets: bs.totalCurrentAssets || prev.totalCurrentAssets || 0,
            totalCurrentLiabilities: bs.totalCurrentLiabilities || prev.totalCurrentLiabilities || 0,
            totalNonCurrentAssets: bs.totalNonCurrentAssets || (bs.totalAssets - bs.totalCurrentAssets) || prev.totalNonCurrentAssets || 0,
            totalNonCurrentLiabilities: bs.totalNonCurrentLiabilities || (bs.totalLiabilities - bs.totalCurrentLiabilities) || prev.totalNonCurrentLiabilities || 0,
            totalEquityLiabilities: (bs.totalEquity + bs.totalLiabilities) || prev.totalEquityLiabilities || 0,
            ppe: bs.ppe || prev.ppe || 0,
            intangibleAssets: bs.intangibleAssets || prev.intangibleAssets || 0,
            shareCapital: bs.shareCapital || prev.shareCapital || 0,
            retainedEarnings: bs.retainedEarnings || prev.retainedEarnings || 0,

            // Other Data carry-forward
            avgEmployees: other.avgEmployees || prev.avgEmployees || 0,
            ebitda: other.ebitda || prev.ebitda || 0,
            audited: Object.keys(audit).length > 0 ? 'Yes' : 'No'
        }));
    }, [company, companyName, extractedDetails]);

    const handleExtractData = async () => {
        if (auditFiles.length === 0) return;
        setIsExtracting(true);
        try {
            const parts = await Promise.all(auditFiles.map(async (file) => fileToPart(file)));

            let data: Record<string, any> = {};
            if (selectedDocCategory === 'audit_report' || selectedDocCategory === 'financial_statements') {
                data = await extractAuditReportDetails(parts);
            } else {
                data = await extractGenericDetailsFromDocuments(parts);
            }

            setExtractedDetails(data);

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


    const handleExportExcel = () => {
        const workbook = XLSX.utils.book_new();
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
        exportData.push([]);

        REPORT_STRUCTURE.forEach(section => {
            exportData.push([section.title.toUpperCase()]);
            section.fields.forEach(field => {
                if (field.type === 'header') {
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
            exportData.push([]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(exportData);
        // Basic col widths
        const wscols = [{ wch: 60 }, { wch: 25 }];
        worksheet['!cols'] = wscols;

        // Number format
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellRef = XLSX.utils.encode_cell({ c: 1, r: R });
            const cell = worksheet[cellRef];
            if (cell && cell.t === 'n') cell.z = '#,##0.00';
        }

        XLSX.utils.book_append_sheet(workbook, worksheet, "Final Report");
        XLSX.writeFile(workbook, `${companyName || 'Company'}_CT_Final_Report.xlsx`);
    };

    const handleExportAll = () => {
        const workbook = XLSX.utils.book_new();

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
        reportData.push(["CORPORATE TAX RETURN - FINAL REPORT"]);
        reportData.push(["Company:", companyName.toUpperCase()]);
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

    const renderStepFinalReport = () => {
        const isSmallBusinessRelief = questionnaireAnswers[6] === 'Yes';
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
                            <button onClick={() => setCurrentStep(3)} className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-700 text-gray-500 hover:text-white rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-800">Back</button>
                            <button onClick={handleExportExcel} className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" /> Export
                            </button>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {REPORT_STRUCTURE.map(section => {
                            const Icon = iconMap[section.iconName] || InformationCircleIcon;
                            return (
                                <div key={section.id} className="group">
                                    <button onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)} className={`w-full flex items-center justify-between p-6 transition-all ${openReportSection === section.title ? 'bg-[#1E293B]/40' : 'hover:bg-[#1E293B]/20'}`}>
                                        <div className="flex items-center gap-5">
                                            <div className={`p-2.5 rounded-xl border transition-all ${openReportSection === section.title ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-900 border-gray-700 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-400'}`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <span className={`font-black uppercase tracking-widest text-xs ${openReportSection === section.title ? 'text-white' : 'text-gray-400'}`}>{section.title}</span>
                                        </div>
                                        <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openReportSection === section.title ? 'rotate-180 text-white' : ''}`} />
                                    </button>
                                    {openReportSection === section.title && (
                                        <div className="p-8 bg-black/40 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-300">
                                            <div className="flex flex-col gap-y-4 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                                {section.fields.map(f => {
                                                    if (f.type === 'header') return <div key={f.field} className="pt-8 pb-3 border-b border-gray-800/80 mb-4 first:pt-0"><h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4></div>;

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
                                                        <div key={f.field} className="flex flex-col py-4 border-b border-gray-800/30 last:border-0 group/field">
                                                            <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-blue-400' : 'text-gray-500 group-hover/field:text-gray-400'}`}>{f.label}</label>
                                                            <div className="bg-gray-900/40 rounded-lg p-1 border border-transparent group-hover/field:border-gray-800/50 transition-all">
                                                                {f.type === 'number' ? (
                                                                    <input type="text" value={formatNumber(value || 0)} readOnly className={`bg-transparent border-none text-right font-mono text-sm font-bold text-white focus:ring-0 w-full ${f.highlight ? 'text-blue-200' : ''}`} />
                                                                ) : (
                                                                    <input type="text" value={value || ''} readOnly className={`bg-transparent border-none text-right font-medium text-sm text-gray-300 focus:ring-0 w-full ${f.highlight ? 'text-blue-200' : ''}`} />
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

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="bg-gray-900/50 backdrop-blur-md p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 shadow-inner group transition-transform hover:scale-105">
                        <ShieldCheckIcon className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">{companyName}</h2>
                        <div className="flex items-center gap-4 mt-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5 text-blue-400/80"><BriefcaseIcon className="w-3.5 h-3.5" /> TYPE 4 WORKFLOW (AUDIT REPORT)</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={handleExportAll}
                        disabled={currentStep !== 4}
                        className={`flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg border border-blue-500/50 transition-all ${currentStep !== 4 ? 'opacity-50 cursor-not-allowed grayscale' : 'transform hover:scale-105'}`}
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" /> Export All Data
                    </button>
                    <button onClick={onReset} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl border border-gray-700/50"><RefreshIcon className="w-4 h-4 mr-2" /> Start Over</button>
                </div>
            </div>

            <Stepper currentStep={currentStep} />

            {/* Step 1: Upload & Extract */}
            {currentStep === 1 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header Card: Upload & Configuration */}
                    <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                                    <DocumentDuplicateIcon className="w-8 h-8 text-purple-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white tracking-tight">Audit Report Upload & Extraction</h3>
                                    <p className="text-gray-400 mt-1 max-w-2xl">Upload reports and extracting financial data.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleExtractData}
                                disabled={auditFiles.length === 0 || isExtracting || !selectedDocCategory}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase text-xs tracking-widest rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
                            >
                                {isExtracting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                {isExtracting ? 'Extracting...' : 'Extract Data'}
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Document Category Selection */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <BriefcaseIcon className="w-5 h-5 text-blue-400" />
                                    <h4 className="font-bold text-white uppercase text-xs tracking-widest">Document Category <span className="text-red-500">*</span></h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className={`flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all group ${selectedDocCategory === 'audit_report' ? 'border-blue-500 bg-blue-900/10 ring-1 ring-blue-500/50' : 'border-gray-700 bg-gray-900/30 hover:bg-gray-800 hover:border-gray-600'}`}>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedDocCategory === 'audit_report' ? 'border-blue-500' : 'border-gray-500'}`}>
                                            {selectedDocCategory === 'audit_report' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                        </div>
                                        <input type="radio" name="docCategory" value="audit_report" checked={selectedDocCategory === 'audit_report'} onChange={(e) => setSelectedDocCategory(e.target.value)} className="hidden" />
                                        <span className={`font-medium group-hover:text-white ${selectedDocCategory === 'audit_report' ? 'text-white' : 'text-gray-300'}`}>Audit report signed by auditors</span>
                                    </label>
                                    <label className={`flex items-center gap-4 p-5 rounded-xl border cursor-pointer transition-all group ${selectedDocCategory === 'financial_statements' ? 'border-blue-500 bg-blue-900/10 ring-1 ring-blue-500/50' : 'border-gray-700 bg-gray-900/30 hover:bg-gray-800 hover:border-gray-600'}`}>
                                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedDocCategory === 'financial_statements' ? 'border-blue-500' : 'border-gray-500'}`}>
                                            {selectedDocCategory === 'financial_statements' && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                        </div>
                                        <input type="radio" name="docCategory" value="financial_statements" checked={selectedDocCategory === 'financial_statements'} onChange={(e) => setSelectedDocCategory(e.target.value)} className="hidden" />
                                        <span className={`font-medium group-hover:text-white ${selectedDocCategory === 'financial_statements' ? 'text-white' : 'text-gray-300'}`}>Financial statements signed by board members</span>
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
                        <div className="bg-[#0F172A] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-[#0A0F1D]">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                                        <SparklesIcon className="w-7 h-7 text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="font-black text-white uppercase text-sm tracking-widest">Extracted Information</h4>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight mt-1">Review and verify the data extracted from your reports</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={handleExportExtractedData} className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-bold uppercase rounded-xl border border-gray-700 transition-all flex items-center gap-2 shadow-lg">
                                        <DocumentArrowDownIcon className="w-4 h-4" /> Export Excel
                                    </button>
                                </div>
                            </div>
                            <div className="divide-y divide-gray-800">
                                {Object.entries(finalDisplayData).map(([k, v]) => {
                                    const sectionTitle = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                    const isOpen = openExtractedSection === k;
                                    const val = v as any;

                                    return (
                                        <div key={k} className="group">
                                            <button
                                                onClick={() => setOpenExtractedSection(isOpen ? null : k)}
                                                className={`w-full flex items-center justify-between p-6 transition-all ${isOpen ? 'bg-[#1E293B]/40' : 'hover:bg-[#1E293B]/20'}`}
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className={`p-2.5 rounded-xl border transition-all ${isOpen ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-900 border-gray-700 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-400'}`}>
                                                        <SparklesIcon className="w-5 h-5" />
                                                    </div>
                                                    <span className={`font-black uppercase tracking-widest text-xs ${isOpen ? 'text-white' : 'text-gray-400'}`}>{sectionTitle}</span>
                                                </div>
                                                <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180 text-white' : ''}`} />
                                            </button>

                                            {isOpen && (
                                                <div className="p-8 bg-black/40 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-300">
                                                    <div className="flex flex-col gap-y-4 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-8 shadow-inner max-w-4xl mx-auto overflow-x-auto">
                                                        {typeof val === 'object' && val !== null ? (
                                                            Object.entries(val).map(([nestedK, nestedV]) => {
                                                                const renderValue = (data: any): React.ReactNode => {
                                                                    if (data === null || data === undefined) return <span className="text-gray-600 italic">N/A</span>;

                                                                    if (Array.isArray(data)) {
                                                                        if (data.length === 0) return <span className="text-gray-600 italic">Empty</span>;

                                                                        // Check if it's a table-like array (array of objects)
                                                                        if (typeof data[0] === 'object' && data[0] !== null && !Array.isArray(data[0])) {
                                                                            const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));
                                                                            return (
                                                                                <div className="overflow-x-auto rounded-lg border border-gray-800/50 mt-2">
                                                                                    <table className="w-full text-[10px] text-left border-collapse">
                                                                                        <thead>
                                                                                            <tr className="bg-gray-900/50 border-b border-gray-800">
                                                                                                {keys.map(key => (
                                                                                                    <th key={key} className="py-2.5 px-3 text-gray-500 font-bold uppercase tracking-tighter whitespace-nowrap">{formatKey(key)}</th>
                                                                                                ))}
                                                                                            </tr>
                                                                                        </thead>
                                                                                        <tbody>
                                                                                            {data.map((row: any, idx: number) => (
                                                                                                <tr key={idx} className="border-b border-gray-800/30 last:border-0 hover:bg-white/[0.02] transition-colors">
                                                                                                    {keys.map(key => (
                                                                                                        <td key={key} className="py-2.5 px-3 text-gray-300">
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
                                                                                    <li key={idx} className="text-gray-300 text-[11px] leading-relaxed">
                                                                                        {typeof item === 'object' ? renderValue(item) : String(item)}
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                        );
                                                                    }

                                                                    if (typeof data === 'object') {
                                                                        return (
                                                                            <div className="space-y-3 mt-2 pl-4 border-l-2 border-blue-500/20 bg-blue-500/[0.02] py-2 rounded-r-lg">
                                                                                {Object.entries(data).map(([subK, subV]) => (
                                                                                    <div key={subK} className="flex flex-col gap-1">
                                                                                        <span className="text-[9px] text-[#60A5FA]/60 font-black uppercase tracking-widest">{subK.replace(/_/g, ' ')}</span>
                                                                                        <div className="text-xs">{renderValue(subV)}</div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    if (typeof data === 'number') return <span className="text-white font-mono font-bold tracking-tight">{formatNumber(data)}</span>;

                                                                    return <span className="text-white text-xs font-medium leading-relaxed">{String(data)}</span>;
                                                                };


                                                                const formatKey = (key: string) => {
                                                                    return key
                                                                        .replace(/([A-Z])/g, ' $1') // Split camelCase
                                                                        .replace(/_/g, ' ')        // Split snake_case
                                                                        .trim()
                                                                        .replace(/\b\w/g, c => c.toUpperCase());
                                                                };

                                                                return (
                                                                    <div key={nestedK} className="flex flex-col py-4 border-b border-gray-800/30 last:border-0 group/field">
                                                                        <div className="flex flex-col gap-2">
                                                                            <label className="text-[11px] font-black uppercase tracking-widest text-[#60A5FA] group-hover/field:text-blue-400 shrink-0">
                                                                                {formatKey(nestedK)}
                                                                            </label>
                                                                            <div className="pl-2">
                                                                                {renderValue(nestedV)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div className="py-2 text-gray-400 italic">No data available for this section.</div>
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

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={onReset} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Change Type</button>
                        <button onClick={() => setCurrentStep(2)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Continue</button>
                    </div>
                </div>
            )}

            {/* Step 2: LOU Upload (Reference Only) */}
            {currentStep === 2 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header Card: Upload & Configuration */}
                    <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex items-center gap-5">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                                    <DocumentDuplicateIcon className="w-8 h-8 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white tracking-tight">LOU Upload (Reference Only)</h3>
                                    <p className="text-gray-400 mt-1 max-w-2xl">Upload Letter of Undertaking (LOU) documents as reference.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* File Upload */}
                            <div className="space-y-4">
                                <FileUploadArea title="Upload LOU Documents" icon={<DocumentDuplicateIcon className="w-6 h-6" />} selectedFiles={louFiles} onFilesSelect={setLouFiles} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-4">
                        <button onClick={() => setCurrentStep(1)} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                        <button onClick={() => setCurrentStep(3)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Continue</button>
                    </div>
                </div>
            )}

            {/* Step 3: Questionnaire */}
            {currentStep === 3 && (
                <div className="space-y-6 max-w-5xl mx-auto pb-12">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center border border-blue-800"><InformationCircleIcon className="w-7 h-7 text-blue-400" /></div>
                                <div><h3 className="text-xl font-bold text-white uppercase tracking-tight">Corporate Tax Questionnaire</h3><p className="text-xs text-gray-400 mt-1">Please answer for final tax computation.</p></div>
                            </div>
                        </div>
                        <div className="divide-y divide-gray-800 max-h-[60vh] overflow-y-auto custom-scrollbar bg-black/20">
                            {CT_QUESTIONS.map((q) => (
                                <div key={q.id} className="p-6 hover:bg-white/5 transition-colors group">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex gap-4 flex-1">
                                            <span className="text-xs font-bold text-gray-600 font-mono mt-1">{String(q.id).padStart(2, '0')}</span>
                                            <p className="text-sm font-medium text-gray-200 leading-relaxed">{q.text}</p>
                                        </div>
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
                                <button onClick={() => setCurrentStep(2)} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                                <button onClick={handleExportQuestionnaire} className="flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-xl border border-gray-700 transition-all uppercase text-[10px] tracking-widest"><DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Export</button>
                            </div>
                            <button onClick={() => setCurrentStep(4)} disabled={Object.keys(questionnaireAnswers).length < CT_QUESTIONS.length} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center disabled:opacity-50 transition-all transform hover:scale-[1.02]">Final Report</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 4: Final Report */}
            {currentStep === 4 && renderStepFinalReport()}

        </div>
    );
};
