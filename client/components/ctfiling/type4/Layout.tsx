
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ChartBarIcon,
    CheckIcon,
    TrashIcon,
    ClipboardCheckIcon
} from '../../icons';
import {
    ICtType4Context,
    CtType4Context,
    WorkingNoteEntry,
    ProfitAndLossItem,
    BalanceSheetItem,
    PNL_ITEMS,
    BS_ITEMS,
    CT_QUESTIONS,
    REPORT_STRUCTURE
} from './types';
import { Step1 } from './step1/Step1';
import { Step2 } from './step2/Step2';
import { Step3 } from './step3/Step3';
import { Step4 } from './step4/Step4';
import { Step5 } from './step5/Step5';
import { Step6 } from './step6/Step6';
import { Step7 } from './step7/Step7';
import { Step8 } from './step8/Step8';
import {
    flattenBsItems,
    mapPnlItemsToNotes,
    mapBsItemsToNotes,
    toNumber,
    findAmountInItems,
    formatNumber,
    formatDecimalNumber
} from './utils';

interface CtType4LayoutProps {
    companyName: string;
    currency: string;
    onReset: () => void;
    [key: string]: any;
}

export const Layout: React.FC<CtType4LayoutProps> = (props) => {
    const { companyName, currency, onReset, company } = props;

    // State definitions
    // State definitions
    const location = useLocation();
    const navigate = useNavigate();
    const { customerId, typeName, periodId } = useParams();

    const currentStep = useMemo(() => {
        const match = location.pathname.match(/step-(\d+)/);
        return match ? parseInt(match[1]) : 1;
    }, [location.pathname]);

    const setCurrentStep = useCallback((step: number | ((prev: number) => number)) => {
        const nextStep = typeof step === 'function' ? step(currentStep) : step;
        navigate(`/projects/ct-filing/${customerId}/${typeName}/${periodId}/results/step-${nextStep}`);
    }, [currentStep, navigate, customerId, typeName, periodId]);

    // Step 1: Audit Report Extraction
    const [auditFiles, setAuditFiles] = useState<File[]>([]);
    const [extractedDetails, setExtractedDetails] = useState<Record<string, any>>({});
    const [isExtracting, setIsExtracting] = useState(false);
    const [openExtractedSection, setOpenExtractedSection] = useState<string | null>(null);

    // Step 2: VAT Docs
    const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({}); // Holds vatFileResults
    const [isExtractingVat, setIsExtractingVat] = useState(false);

    // Step 3: VAT Summarization
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [showVatConfirm, setShowVatConfirm] = useState(false);

    // Step 4 & 5: P&L and Balance Sheet
    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [pnlStructure, setPnlStructure] = useState<ProfitAndLossItem[]>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<BalanceSheetItem[]>(BS_ITEMS);
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});

    // Step 6: LOU
    const [louFiles, setLouFiles] = useState<File[]>([]);

    // Step 7: Questionnaire
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});

    // Step 8: Final Report
    const [reportForm, setReportForm] = useState<any>({});
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');

    // Context Global Worker State (for shared modals if any)
    const [workingNoteModalOpen, setWorkingNoteModalOpen] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);

    // --- LOGIC & HELPERS ---

    const handleBack = () => setCurrentStep(prev => prev - 1);

    // VAT Data Logic (Mirrors Type 3 Logic)
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
            return { id: periodId, periodFrom: res.periodFrom, periodTo: res.periodTo, sales, purchases, net: sales.vat - purchases.vat };
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

    // Reset Extracted Data on File Change
    useEffect(() => {
        setExtractedDetails({});
        setReportForm({});
        setOpenExtractedSection(null);
        setPnlValues({});
        setBalanceSheetValues({});
        setPnlWorkingNotes({});
        setBsWorkingNotes({});
    }, [auditFiles]);

    useEffect(() => {
        setAdditionalDetails({});
    }, [additionalFiles]);

    // Populate Report Form from Extraction & Company Data
    useEffect(() => {
        const genInfo = extractedDetails?.generalInformation || {};
        const pnl = extractedDetails?.statementOfComprehensiveIncome || {};
        const bs = extractedDetails?.statementOfFinancialPosition || {};
        const other = extractedDetails?.otherInformation || {};
        const audit = extractedDetails?.auditorsReport || {};

        setReportForm((prev: any) => {
            const isSbrApplicable = questionnaireAnswers[6] === 'Yes';
            const applySbr = (val: any) => isSbrApplicable ? 0 : val;

            return {
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
                declarationDate: prev.declarationDate || new Date().toLocaleDateString('en-GB'),
                preparedBy: prev.preparedBy || 'Taxable Person',
                declarationConfirmed: prev.declarationConfirmed || 'Yes',

                // P&L Data
                operatingRevenue: isSbrApplicable ? 0 : (pnl.revenue || prev.operatingRevenue || 0),
                derivingRevenueExpenses: applySbr(pnl.costOfSales || prev.derivingRevenueExpenses || 0),
                grossProfit: applySbr(pnl.grossProfit || prev.grossProfit || 0),
                otherNonOpRevenue: applySbr(pnl.otherIncome || prev.otherNonOpRevenue || 0),
                interestExpense: applySbr(pnl.financeCosts || prev.interestExpense || 0),
                netProfit: applySbr(pnl.netProfit || prev.netProfit || 0),
                totalComprehensiveIncome: applySbr(pnl.totalComprehensiveIncome || prev.totalComprehensiveIncome || 0),
                accountingIncomeTaxPeriod: applySbr(pnl.netProfit || prev.netProfit || 0),

                // BS Data
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

                // Other
                avgEmployees: other.avgEmployees || prev.avgEmployees || 0,
                ebitda: other.ebitda || prev.ebitda || 0,
                audited: Object.keys(audit).length > 0 ? 'Yes' : 'No',

                actualOperatingRevenue: pnl.revenue || prev.operatingRevenue || 0
            };
        });
    }, [company, companyName, extractedDetails, questionnaireAnswers]);

    // Populate P&L and BS structures from Extraction
    useEffect(() => {
        if (!extractedDetails || Object.keys(extractedDetails).length === 0) return;

        const pnl = extractedDetails?.statementOfComprehensiveIncome || {};
        const bs = extractedDetails?.statementOfFinancialPosition || {};
        const pnlItems = Array.isArray(pnl.items) ? pnl.items : (Array.isArray(pnl.rows) ? pnl.rows : []);
        const bsItems = flattenBsItems(bs);

        // Auto-generate working notes from extraction description matches
        const pnlNotesFromExtract = mapPnlItemsToNotes(pnlItems);
        const bsNotesFromExtract = mapBsItemsToNotes(bsItems);

        setPnlWorkingNotes(prev => ({ ...prev, ...pnlNotesFromExtract }));
        setBsWorkingNotes(prev => ({ ...prev, ...bsNotesFromExtract }));

        // Map values to P&L structure
        // Note: Ideally we map granular items, but here assigning major totals to buckets
        // For brevity, we assume the user will adjust in UI or reliance on mapped notes which sum up?
        // Actually, P&L step aggregates notes? No, P&L step usually takes values directly.
        // In Type 3 refactor, P&L values were derived from Trial Balance mappings.
        // In Type 4, we don't have TB. We have extracted totals or line items.
        // We should populate `pnlValues` based on the extraction heuristics.

        const newPnlValues: Record<string, { currentYear: number; previousYear: number }> = {};
        const newBsValues: Record<string, { currentYear: number; previousYear: number }> = {};

        // Simplified mapping logic based on extraction keys or helpers
        const getVal = (v: any) => toNumber(v);

        if (pnl.revenue) newPnlValues['revenue'] = { currentYear: getVal(pnl.revenue), previousYear: 0 };
        if (pnl.costOfSales) newPnlValues['cost_of_revenue'] = { currentYear: getVal(pnl.costOfSales), previousYear: 0 };
        if (pnl.grossProfit) newPnlValues['gross_profit'] = { currentYear: getVal(pnl.grossProfit), previousYear: 0 };
        if (pnl.administrativeExpenses) newPnlValues['administrative_expenses'] = { currentYear: getVal(pnl.administrativeExpenses), previousYear: 0 };
        if (pnl.financeCosts) newPnlValues['finance_costs'] = { currentYear: getVal(pnl.financeCosts), previousYear: 0 };
        if (pnl.depreciation) newPnlValues['depreciation_ppe'] = { currentYear: getVal(pnl.depreciation), previousYear: 0 };
        if (pnl.netProfit) newPnlValues['profit_loss_year'] = { currentYear: getVal(pnl.netProfit), previousYear: 0 };
        if (pnl.totalComprehensiveIncome) newPnlValues['total_comprehensive_income'] = { currentYear: getVal(pnl.totalComprehensiveIncome), previousYear: 0 };

        if (bs.totalAssets) newBsValues['total_assets'] = { currentYear: getVal(bs.totalAssets), previousYear: 0 };
        if (bs.totalLiabilities) newBsValues['total_liabilities'] = { currentYear: getVal(bs.totalLiabilities), previousYear: 0 };
        if (bs.totalEquity) newBsValues['total_equity'] = { currentYear: getVal(bs.totalEquity), previousYear: 0 };
        if (bs.ppe) newBsValues['property_plant_equipment'] = { currentYear: getVal(bs.ppe), previousYear: 0 };
        if (bs.shareCapital) newBsValues['share_capital'] = { currentYear: getVal(bs.shareCapital), previousYear: 0 };
        if (bs.retainedEarnings) newBsValues['retained_earnings'] = { currentYear: getVal(bs.retainedEarnings), previousYear: 0 };

        setPnlValues(prev => ({ ...prev, ...newPnlValues }));
        setBalanceSheetValues(prev => ({ ...prev, ...newBsValues }));

    }, [extractedDetails]);

    const contextValue: ICtType4Context = {
        currentStep, setCurrentStep,
        auditFiles, setAuditFiles,
        extractedDetails, setExtractedDetails,
        isExtracting, setIsExtracting,
        openExtractedSection, setOpenExtractedSection,
        additionalFiles, setAdditionalFiles,
        additionalDetails, setAdditionalDetails,
        isExtractingVat, setIsExtractingVat,
        vatManualAdjustments, setVatManualAdjustments,
        showVatConfirm, setShowVatConfirm,
        pnlValues, setPnlValues,
        balanceSheetValues, setBalanceSheetValues,
        pnlStructure, setPnlStructure,
        bsStructure, setBsStructure,
        pnlWorkingNotes, setPnlWorkingNotes,
        bsWorkingNotes, setBsWorkingNotes,
        louFiles, setLouFiles,
        questionnaireAnswers, setQuestionnaireAnswers,
        reportForm, setReportForm,
        openReportSection, setOpenReportSection,
        handleBack,
        vatStepData,
        companyName, currency, company, onReset,
        workingNoteModalOpen, setWorkingNoteModalOpen,
        currentWorkingAccount, setCurrentWorkingAccount
    };

    const steps = [
        "Audit Report Upload",
        "VAT Docs Upload",
        "VAT Summarization",
        "Profit & Loss",
        "Balance Sheet",
        "LOU Upload",
        "Questionnaire",
        "Final Report"
    ];

    return (
        <CtType4Context.Provider value={contextValue}>
            <div className="min-h-screen bg-[#0B1120] text-gray-200 font-sans selection:bg-blue-500/30">
                {/* Header */}
                <div className="sticky top-0 z-40 bg-[#0B1120]/80 backdrop-blur-xl border-b border-gray-800 shadow-lg">
                    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <ChartBarIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">C.T. Type 4</span> Filing
                                </h1>
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                                    <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{companyName || 'Unknown Entity'}</span>
                                    <span>•</span>
                                    <span className="font-mono text-indigo-400">{currency}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={onReset} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-400 transition-colors" title="Reset All">
                                <span className="sr-only">Reset</span>
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stepper */}
                <div className="border-b border-gray-800 bg-[#0F172A]/50 pt-8 pb-0 overflow-x-auto">
                    <div className="flex items-center w-full max-w-6xl mx-auto mb-8 px-6">
                        {steps.map((step, index) => {
                            const stepNumber = index + 1;
                            const isCompleted = currentStep > stepNumber;
                            const isActive = currentStep === stepNumber;
                            return (
                                <React.Fragment key={step}>
                                    <div className="flex flex-col items-center text-center z-10 px-2 min-w-[100px] cursor-pointer" onClick={() => setCurrentStep(stepNumber)}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-900/50' :
                                                isActive ? 'border-blue-500 bg-gray-800 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' : 'border-gray-700 bg-gray-900'
                                            }`}>
                                            {isCompleted ? <CheckIcon className="w-5 h-5 text-white" /> : <span className={`font-bold text-sm ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>{stepNumber}</span>}
                                        </div>
                                        <p className={`mt-3 text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${isCompleted ? 'text-blue-400' : isActive ? 'text-white' : 'text-gray-600'
                                            }`}>{step}</p>
                                    </div>
                                    {index < steps.length - 1 && (
                                        <div className="flex-1 h-0.5 bg-gray-800 relative min-w-[20px] mx-2">
                                            <div className={`absolute top-0 left-0 h-full bg-blue-600 transition-all duration-500 shadow-[0_0_10px_rgba(37,99,235,0.5)]`} style={{ width: isCompleted ? '100%' : '0%' }}></div>
                                        </div>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>

                <main className="max-w-7xl mx-auto px-6 py-8 pb-32">
                    <Outlet />
                </main>
            </div>
        </CtType4Context.Provider>
    );
};
