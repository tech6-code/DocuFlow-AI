
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ChartBarIcon,
    CheckIcon,
    XMarkIcon,
    ClipboardCheckIcon,
    PlusIcon,
    TrashIcon
} from '../../icons';
import {
    ICtType3Context,
    TrialBalanceEntry,
    OpeningBalanceCategory,
    ProfitAndLossItem,
    BalanceSheetItem,
    WorkingNoteEntry,
    CT_REPORTS_ACCOUNTS,
    PNL_ITEMS,
    BS_ITEMS,
    formatNumber,
    round2
} from './types';
import { Step1 } from './step1/Step1';
import { Step2 } from './step2/Step2';
import { Step3 } from './step3/Step3';
import { Step4 } from './step4/Step4';
import { Step5 } from './step5/Step5';
import { Step6 } from './step6/Step6';
import { Step7 } from './step7/Step7';
import { Step8 } from './step8/Step8';
import { Step9 } from './step9/Step9';
import { CtType3Context } from './types';

interface CtType3LayoutProps {
    companyName: string;
    currency: string;
    onReset: () => void;
    // Add other props if needed from parent
    [key: string]: any;
}

export const Layout: React.FC<CtType3LayoutProps> = (props) => {
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

    // Step 1: Opening Balances
    const [openingBalancesData, setOpeningBalancesData] = useState<OpeningBalanceCategory[]>([]);
    const [openingBalanceFiles, setOpeningBalanceFiles] = useState<File[]>([]);
    const [isExtractingOpeningBalances, setIsExtractingOpeningBalances] = useState(false);

    // Step 2: Trial Balance
    const [adjustedTrialBalance, setAdjustedTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [isExtractingTB, setIsExtractingTB] = useState(false);
    const [tbFileInputRef] = useState<any>(null); // Ref handled locally in Step 2 if needed or passed
    const [extractionAlert, setExtractionAlert] = useState<{ type: 'error' | 'warning' | 'success', message: string } | null>(null);
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');
    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');

    // Step 3: VAT Docs
    const [additionalDetails, setAdditionalDetails] = useState<Record<string, any>>({}); // Holds vatFileResults

    // Step 4: VAT Summarization
    const [vatManualAdjustments, setVatManualAdjustments] = useState<Record<string, Record<string, string>>>({});
    const [showVatConfirm, setShowVatConfirm] = useState(false);

    // Step 5 & 6: P&L and Balance Sheet
    const [pnlValues, setPnlValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [balanceSheetValues, setBalanceSheetValues] = useState<Record<string, { currentYear: number; previousYear: number }>>({});
    const [pnlStructure, setPnlStructure] = useState<ProfitAndLossItem[]>(PNL_ITEMS);
    const [bsStructure, setBsStructure] = useState<BalanceSheetItem[]>(BS_ITEMS);

    // Working Notes
    const [obWorkingNotes, setObWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [tbWorkingNotes, setTbWorkingNotes] = useState<Record<string, { description: string, debit: number, credit: number }[]>>({});
    const [pnlWorkingNotes, setPnlWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});
    const [bsWorkingNotes, setBsWorkingNotes] = useState<Record<string, WorkingNoteEntry[]>>({});

    // Step 7: LOU
    const [louFiles, setLouFiles] = useState<File[]>([]);

    // Step 8: Questionnaire
    const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<number, string>>({});

    // Step 9: Final Report
    const [reportForm, setReportForm] = useState<any>({});
    const [openReportSection, setOpenReportSection] = useState<string | null>('Corporate Tax Return Information');

    const [autoPopulateTrigger, setAutoPopulateTrigger] = useState(0);

    // Context Global Worker State
    const [workingNoteModalOpen, setWorkingNoteModalOpen] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);
    const [tempBreakdown, setTempBreakdown] = useState<any[]>([]);

    // --- LOGIC & HELPERS ---

    const handleBack = () => setCurrentStep(prev => prev - 1);

    // VAT Data Logic
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

    const bankVatData = useMemo(() => ({ grandTotals: { sales: 0, purchases: 0 } }), []);

    // Mapping Helpers
    // (Note: Included simplified version of mapping logic for brevity, matches original heuristic)
    const getCategory = (item: any) => {
        if (item.category) {
            const v = item.category.toLowerCase().trim();
            if (v.startsWith('equit')) return 'Equity';
            if (v.startsWith('liab')) return 'Liabilities';
            if (v.startsWith('asset')) return 'Assets';
            if (v.startsWith('income') || v.startsWith('revenue')) return 'Income';
            if (v.startsWith('expense')) return 'Expenses';
            return item.category;
        }
        const mapped = CT_REPORTS_ACCOUNTS[item.account];
        if (mapped) return mapped;
        const lower = item.account.toLowerCase();
        if (lower.includes('revenue') || lower.includes('income') || lower.includes('sales')) return 'Income';
        if (lower.includes('expense') || lower.includes('cost') || lower.includes('fee') || lower.includes('salary')) return 'Expenses';
        if (lower.includes('cash') || lower.includes('bank') || lower.includes('receivable') || lower.includes('asset') || lower.includes('inventory')) return 'Assets';
        if (lower.includes('payable') || lower.includes('loan') || lower.includes('liability')) return 'Liabilities';
        if (lower.includes('equity') || lower.includes('capital')) return 'Equity';
        return 'Assets';
    };

    const normalizeTrialBalanceEntries = (entries: TrialBalanceEntry[] | null): TrialBalanceEntry[] => {
        if (!entries) return [];
        return entries.filter(e => e.account.toLowerCase() !== 'totals');
    };

    const openingBalancesToTrialBalance = (data: OpeningBalanceCategory[]): TrialBalanceEntry[] => {
        const entries: TrialBalanceEntry[] = [];
        data.forEach(cat => {
            cat.accounts.forEach(acc => {
                entries.push({ account: acc.name, debit: Number(acc.debit) || 0, credit: Number(acc.credit) || 0, category: cat.category });
            });
        });
        return entries;
    };

    const mapEntriesToPnl = (entries: TrialBalanceEntry[], yearKey: 'currentYear' | 'previousYear') => {
        const pnlMapping: Record<string, { currentYear: number; previousYear: number }> = {};
        const pnlNotes: Record<string, WorkingNoteEntry[]> = {};
        const addNote = (key: string, description: string, amount: number) => {
            if (!pnlNotes[key]) pnlNotes[key] = [];
            pnlNotes[key].push({ description, currentYearAmount: yearKey === 'currentYear' ? amount : 0, previousYearAmount: yearKey === 'previousYear' ? amount : 0, amount: yearKey === 'currentYear' ? amount : 0, currency: 'AED' });
        };
        entries.forEach(entry => {
            const accountLower = entry.account.toLowerCase();
            const netAmount = round2(entry.credit - entry.debit);
            const absAmount = round2(Math.abs(netAmount));
            if (absAmount === 0) return;
            const pushValue = (key: string) => {
                pnlMapping[key] = {
                    currentYear: round2((pnlMapping[key]?.currentYear || 0) + (yearKey === 'currentYear' ? absAmount : 0)),
                    previousYear: round2((pnlMapping[key]?.previousYear || 0) + (yearKey === 'previousYear' ? absAmount : 0))
                };
                addNote(key, entry.account, absAmount);
            };
            if (accountLower.includes('sales') || accountLower.includes('service revenue') || accountLower.includes('commission') || accountLower.includes('rent revenue') || accountLower.includes('interest income') || (accountLower.includes('revenue') && !accountLower.includes('cost'))) pushValue('revenue');
            else if (accountLower.includes('cogs') || accountLower.includes('cost of goods') || accountLower.includes('raw material') || accountLower.includes('direct labor') || accountLower.includes('factory overhead') || accountLower.includes('freight inward') || accountLower.includes('carriage inward') || accountLower.includes('direct cost') || accountLower.includes('purchase')) pushValue('cost_of_revenue');
            else if (accountLower.includes('gain on disposal') || accountLower.includes('dividend received') || accountLower.includes('discount received') || accountLower.includes('bad debts recovered') || accountLower.includes('other income') || accountLower.includes('miscellaneous income')) pushValue('other_income');
            else if (accountLower.includes('unrealised') || accountLower.includes('fvtpl') || accountLower.includes('fair value')) pushValue('unrealised_gain_loss_fvtpl');
            else if (accountLower.includes('share of profit') || accountLower.includes('associate')) pushValue('share_profits_associates');
            else if (accountLower.includes('revaluation') && (accountLower.includes('property') || accountLower.includes('investment'))) pushValue('gain_loss_revaluation_property');
            else if (accountLower.includes('impairment') && (accountLower.includes('equip') || accountLower.includes('machin') || accountLower.includes('land') || accountLower.includes('build'))) pushValue('impairment_losses_ppe');
            else if (accountLower.includes('impairment') && (accountLower.includes('goodwill') || accountLower.includes('patent') || accountLower.includes('trademark'))) pushValue('impairment_losses_intangible');
            else if (accountLower.includes('advertising') || accountLower.includes('marketing') || accountLower.includes('sales commission') || accountLower.includes('delivery') || accountLower.includes('freight outward') || accountLower.includes('travel') || accountLower.includes('entertainment') || accountLower.includes('business promotion')) pushValue('business_promotion_selling');
            else if (accountLower.includes('foreign exchange') || accountLower.includes('exchange rate') || accountLower.includes('forex')) pushValue('foreign_exchange_loss');
            else if (accountLower.includes('sales staff') || accountLower.includes('warehouse rent') || accountLower.includes('packaging') || accountLower.includes('shipping') || accountLower.includes('distribution')) pushValue('selling_distribution_expenses');
            else if (accountLower.includes('office rent') || accountLower.includes('utility') || accountLower.includes('electricity') || accountLower.includes('water') || accountLower.includes('office supplie') || accountLower.includes('legal fee') || accountLower.includes('accounting fee') || accountLower.includes('admin salar') || accountLower.includes('insurance') || accountLower.includes('general expense') || accountLower.includes('admin') || accountLower.includes('stationery') || accountLower.includes('repair') || accountLower.includes('subscription') || accountLower.includes('license') || accountLower.includes('professional') || accountLower.includes('fee')) pushValue('administrative_expenses');
            else if (accountLower.includes('interest expense') || accountLower.includes('bank charge') || accountLower.includes('loan interest') || accountLower.includes('finance cost')) pushValue('finance_costs');
            else if (accountLower.includes('depreciation')) pushValue('depreciation_ppe');
        });

        const getYearVal = (key: string) => pnlMapping[key]?.[yearKey] || 0;
        const revenue = getYearVal('revenue');
        const costOfRevenue = getYearVal('cost_of_revenue');
        const otherIncome = getYearVal('other_income');
        const unrealised = getYearVal('unrealised_gain_loss_fvtpl');
        const shareProfits = getYearVal('share_profits_associates');
        const revaluation = getYearVal('gain_loss_revaluation_property');
        const impairmentPpe = getYearVal('impairment_losses_ppe');
        const impairmentInt = getYearVal('impairment_losses_intangible');
        const businessPromotion = getYearVal('business_promotion_selling');
        const forexLoss = getYearVal('foreign_exchange_loss');
        const sellingDist = getYearVal('selling_distribution_expenses');
        const admin = getYearVal('administrative_expenses');
        const financeCosts = getYearVal('finance_costs');
        const depreciation = getYearVal('depreciation_ppe');

        const totalIncome = round2(revenue + otherIncome + unrealised + shareProfits + revaluation);
        const totalExpenses = round2(costOfRevenue + impairmentPpe + impairmentInt + businessPromotion + forexLoss + sellingDist + admin + financeCosts + depreciation);
        const grossProfit = round2(revenue - costOfRevenue);
        const profitLossYear = round2(totalIncome - totalExpenses);

        pnlMapping['gross_profit'] = { currentYear: yearKey === 'currentYear' ? grossProfit : 0, previousYear: yearKey === 'previousYear' ? grossProfit : 0 };
        pnlMapping['profit_loss_year'] = { currentYear: yearKey === 'currentYear' ? profitLossYear : 0, previousYear: yearKey === 'previousYear' ? profitLossYear : 0 };
        pnlMapping['total_comprehensive_income'] = { currentYear: yearKey === 'currentYear' ? profitLossYear : 0, previousYear: yearKey === 'previousYear' ? profitLossYear : 0 };
        pnlMapping['profit_after_tax'] = { currentYear: yearKey === 'currentYear' ? profitLossYear : 0, previousYear: yearKey === 'previousYear' ? profitLossYear : 0 };

        return { values: pnlMapping, notes: pnlNotes };
    };

    const mapEntriesToBalanceSheet = (entries: TrialBalanceEntry[], yearKey: 'currentYear' | 'previousYear') => {
        const bsMapping: Record<string, { currentYear: number; previousYear: number }> = {};
        const bsNotes: Record<string, WorkingNoteEntry[]> = {};
        const addNote = (key: string, description: string, amount: number) => {
            if (!bsNotes[key]) bsNotes[key] = [];
            bsNotes[key].push({ description, currentYearAmount: yearKey === 'currentYear' ? amount : 0, previousYearAmount: yearKey === 'previousYear' ? amount : 0, amount: yearKey === 'currentYear' ? amount : 0, currency: 'AED' });
        };
        entries.forEach(entry => {
            const accountLower = entry.account.toLowerCase();
            const debitAmount = entry.debit;
            const creditAmount = entry.credit;
            const pushValue = (key: string, val: number) => {
                const rounded = round2(val);
                bsMapping[key] = {
                    currentYear: round2((bsMapping[key]?.currentYear || 0) + (yearKey === 'currentYear' ? rounded : 0)),
                    previousYear: round2((bsMapping[key]?.previousYear || 0) + (yearKey === 'previousYear' ? rounded : 0))
                };
                if (rounded !== 0) addNote(key, entry.account, rounded);
            };

            if (accountLower.includes('cash') || accountLower.includes('bank')) pushValue('cash_bank_balances', debitAmount - creditAmount);
            else if (accountLower.includes('accounts receivable') || accountLower.includes('debtor') || accountLower.includes('bills receivable') || accountLower.includes('receivable')) pushValue('trade_receivables', debitAmount - creditAmount);
            else if (accountLower.includes('inventory') || accountLower.includes('stock')) pushValue('inventories', debitAmount - creditAmount);
            else if (accountLower.includes('prepaid') || accountLower.includes('advance') || accountLower.includes('deposit') || (accountLower.includes('office supplies') && debitAmount > 0)) pushValue('advances_deposits_receivables', debitAmount - creditAmount);
            else if (accountLower.includes('marketable securit')) pushValue('advances_deposits_receivables', debitAmount - creditAmount);
            else if (accountLower.includes('property') || accountLower.includes('plant') || accountLower.includes('equipment') || accountLower.includes('vehicle') || accountLower.includes('ppe')) pushValue('property_plant_equipment', debitAmount - creditAmount);
            else if (accountLower.includes('intangible') || accountLower.includes('goodwill') || accountLower.includes('patent') || accountLower.includes('trademark')) pushValue('intangible_assets', debitAmount - creditAmount);
            else if (accountLower.includes('investment') || accountLower.includes('financial asset')) pushValue('long_term_investments', debitAmount - creditAmount);
            else if (accountLower.includes('other asset')) pushValue('other_non_current_assets', debitAmount - creditAmount);
            else if (accountLower.includes('accounts payable') || accountLower.includes('creditor') || accountLower.includes('payable')) pushValue('trade_other_payables', creditAmount - debitAmount);
            else if (accountLower.includes('due to') || accountLower.includes('related party')) pushValue('related_party_transactions_liabilities', creditAmount - debitAmount);
            else if (accountLower.includes('accrued') || accountLower.includes('accrual')) pushValue('trade_other_payables', creditAmount - debitAmount);
            else if (accountLower.includes('advance from') || accountLower.includes('customer advance')) pushValue('trade_other_payables', creditAmount - debitAmount);
            else if (accountLower.includes('short-term loan') || accountLower.includes('overdraft') || accountLower.includes('bank loan')) pushValue('short_term_borrowings', creditAmount - debitAmount);
            else if (accountLower.includes('vat payable') || accountLower.includes('output vat') || accountLower.includes('tax payable')) pushValue('trade_other_payables', creditAmount - debitAmount);
            else if (accountLower.includes('long-term loan') || accountLower.includes('long term loan') || accountLower.includes('non current loan') || accountLower.includes('long term borrowing')) pushValue('bank_borrowings_non_current', creditAmount - debitAmount);
            else if (accountLower.includes('end of service') || accountLower.includes('gratuity') || accountLower.includes('provision')) pushValue('employees_end_service_benefits', creditAmount - debitAmount);
            else if (accountLower.includes('share capital') || accountLower.includes('capital') || accountLower.includes('equity')) pushValue('share_capital', creditAmount - debitAmount);
            else if (accountLower.includes('retained earning') || accountLower.includes('retained earnings')) pushValue('retained_earnings', creditAmount - debitAmount);
            else if (accountLower.includes('drawing') || accountLower.includes('dividend')) pushValue('shareholders_current_accounts', creditAmount - debitAmount);
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
            bsMapping['retained_earnings'] = { currentYear: yearKey === 'currentYear' ? adjustedRetained : 0, previousYear: yearKey === 'previousYear' ? adjustedRetained : 0 };
            addNote('retained_earnings', 'Auto balance adjustment', balanceDiff);
            totalEquity = round2(totalEquity + balanceDiff);
            totalEquityLiabilities = round2(totalEquity + totalLiabilities);
        }

        bsMapping['total_non_current_assets'] = { currentYear: yearKey === 'currentYear' ? totalNonCurrentAssets : 0, previousYear: yearKey === 'previousYear' ? totalNonCurrentAssets : 0 };
        bsMapping['total_current_assets'] = { currentYear: yearKey === 'currentYear' ? totalCurrentAssets : 0, previousYear: yearKey === 'previousYear' ? totalCurrentAssets : 0 };
        bsMapping['total_assets'] = { currentYear: yearKey === 'currentYear' ? totalAssets : 0, previousYear: yearKey === 'previousYear' ? totalAssets : 0 };
        bsMapping['total_equity'] = { currentYear: yearKey === 'currentYear' ? totalEquity : 0, previousYear: yearKey === 'previousYear' ? totalEquity : 0 };
        bsMapping['total_non_current_liabilities'] = { currentYear: yearKey === 'currentYear' ? totalNonCurrentLiabilities : 0, previousYear: yearKey === 'previousYear' ? totalNonCurrentLiabilities : 0 };
        bsMapping['total_current_liabilities'] = { currentYear: yearKey === 'currentYear' ? totalCurrentLiabilities : 0, previousYear: yearKey === 'previousYear' ? totalCurrentLiabilities : 0 };
        bsMapping['total_liabilities'] = { currentYear: yearKey === 'currentYear' ? totalLiabilities : 0, previousYear: yearKey === 'previousYear' ? totalLiabilities : 0 };
        bsMapping['total_equity_liabilities'] = { currentYear: yearKey === 'currentYear' ? totalEquityLiabilities : 0, previousYear: yearKey === 'previousYear' ? totalEquityLiabilities : 0 };

        return { values: bsMapping, notes: bsNotes };
    };

    const mergeYearValues = (current: any, previous: any) => {
        const merged: any = {};
        const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
        keys.forEach(key => merged[key] = { currentYear: current[key]?.currentYear || 0, previousYear: previous[key]?.previousYear || 0 });
        return merged;
    };

    const mergeNotesByDescription = (current: any, previous: any) => {
        const merged: any = {};
        const keys = new Set([...Object.keys(current), ...Object.keys(previous)]);
        keys.forEach(key => {
            const byDesc: any = {};
            (current[key] || []).forEach((n: any) => {
                const desc = (n.description || '').trim();
                if (!byDesc[desc]) byDesc[desc] = { description: desc, currentYearAmount: 0, previousYearAmount: 0 };
                byDesc[desc].currentYearAmount = (byDesc[desc].currentYearAmount || 0) + (n.currentYearAmount || n.amount || 0);
            });
            (previous[key] || []).forEach((n: any) => {
                const desc = (n.description || '').trim();
                if (!byDesc[desc]) byDesc[desc] = { description: desc, currentYearAmount: 0, previousYearAmount: 0 };
                byDesc[desc].previousYearAmount = (byDesc[desc].previousYearAmount || 0) + (n.previousYearAmount || 0);
            });
            merged[key] = Object.values(byDesc).filter((n: any) => n.currentYearAmount !== 0 || n.previousYearAmount !== 0);
        });
        return merged;
    };

    // Auto Populate Effect
    useEffect(() => {
        if (!autoPopulateTrigger) return;
        const currentEntries = normalizeTrialBalanceEntries(adjustedTrialBalance);
        const previousEntries = openingBalancesToTrialBalance(openingBalancesData);

        const pnlCurrent = mapEntriesToPnl(currentEntries, 'currentYear');
        const pnlPrevious = mapEntriesToPnl(previousEntries, 'previousYear');
        const bsCurrent = mapEntriesToBalanceSheet(currentEntries, 'currentYear');
        const bsPrevious = mapEntriesToBalanceSheet(previousEntries, 'previousYear');

        setPnlValues(prev => ({ ...prev, ...mergeYearValues(pnlCurrent.values, pnlPrevious.values) }));
        setBalanceSheetValues(prev => ({ ...prev, ...mergeYearValues(bsCurrent.values, bsPrevious.values) }));
        setPnlWorkingNotes(prev => ({ ...prev, ...mergeNotesByDescription(pnlCurrent.notes, pnlPrevious.notes) }));
        setBsWorkingNotes(prev => ({ ...prev, ...mergeNotesByDescription(bsCurrent.notes, bsPrevious.notes) }));
    }, [autoPopulateTrigger, adjustedTrialBalance, openingBalancesData]);

    // FTA Form Values Calculation
    const ftaFormValues = useMemo(() => {
        if (!adjustedTrialBalance) return null;

        const getSumByCategory = (category: string) => {
            return adjustedTrialBalance.reduce((acc, item) => {
                if (item.account === 'Totals') return acc;
                if (getCategory(item) === category) return acc + (item.debit - item.credit);
                return acc;
            }, 0);
        };
        const getSum = (labels: string[]) => {
            const labelsLower = labels.map(l => l.toLowerCase());
            return adjustedTrialBalance.reduce((acc, item) => {
                if (labelsLower.includes(item.account.toLowerCase())) return acc + (item.debit - item.credit);
                return acc;
            }, 0);
        };

        const totalIncome = Math.abs(getSumByCategory('Income'));
        const operatingRevenue = Math.abs(getSum(['Sales Revenue', 'Sales to related Parties', 'Revenue', 'Sales'])) || totalIncome;
        const totalExpenses = Math.abs(getSumByCategory('Expenses'));
        const derivingRevenueExpenses = Math.abs(getSum(['Direct Cost (COGS)', 'Purchases from Related Parties', 'Cost of Goods Sold', 'COGS'])) || totalExpenses * 0.4;
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

        const totalAssetsByCategory = Math.abs(getSumByCategory('Assets'));
        const totalCurrentAssets = Math.abs(getSum(['Cash on Hand', 'Bank Accounts', 'Cash', 'Bank', 'Accounts Receivable', 'Due from related Parties', 'Prepaid Expenses', 'Deposits', 'VAT Recoverable (Input VAT)', 'Inventory – Goods', 'Work-in-Progress – Services', 'Inventory'])) || totalAssetsByCategory * 0.7;
        const ppe = Math.abs(getSum(['Property, Plant & Equipment', 'Property, Plant and Equipment', 'Furniture & Equipment', 'Vehicles', 'Fixed Assets', 'PPE'])) || totalAssetsByCategory * 0.3;
        const totalNonCurrentAssets = ppe;
        const totalAssets = totalAssetsByCategory || (totalCurrentAssets + totalNonCurrentAssets);

        const totalLiabilitiesByCategory = Math.abs(getSumByCategory('Liabilities'));
        const totalCurrentLiabilities = Math.abs(getSum(['Accounts Payable', 'Due to Related Parties', 'Accrued Expenses', 'Advances from Customers', 'Short-Term Loans', 'VAT Payable (Output VAT)', 'Corporate Tax Payable'])) || totalLiabilitiesByCategory * 0.7;
        const totalNonCurrentLiabilities = Math.abs(getSum(['Long-Term Liabilities', 'Long-Term Loans', 'Loans from Related Parties', 'Employee End-of-Service Benefits Provision'])) || totalLiabilitiesByCategory * 0.3;
        const totalLiabilities = totalLiabilitiesByCategory || (totalCurrentLiabilities + totalNonCurrentLiabilities);

        const totalEquityByCategory = Math.abs(getSumByCategory('Equity'));
        const shareCapital = Math.abs(getSum(["Share Capital / Owner's Equity", 'Share Capital', 'Capital', 'Owners Equity'])) || totalEquityByCategory;
        const totalEquity = shareCapital;
        const totalEquityLiabilities = totalEquity + totalLiabilities;

        const taxableIncome = Math.max(0, netProfit);
        const threshold = 375000;
        const corporateTaxLiability = taxableIncome > threshold ? (taxableIncome - threshold) * 0.09 : 0;

        const isReliefClaimed = questionnaireAnswers[6] === 'Yes';

        if (isReliefClaimed) {
            return {
                operatingRevenue: 0, derivingRevenueExpenses: 0, grossProfit: 0,
                salaries: 0, depreciation: 0, otherExpenses: 0, nonOpExpensesExcl: 0,
                dividendsReceived: 0, otherNonOpRevenue: 0,
                interestIncome: 0, interestExpense: 0, netInterest: 0,
                netProfit: 0,
                totalCurrentAssets: 0, ppe: 0, totalNonCurrentAssets: 0, totalAssets: 0,
                totalCurrentLiabilities: 0, totalNonCurrentLiabilities: 0, totalLiabilities: 0,
                shareCapital: 0, totalEquity: 0, totalEquityLiabilities: 0,
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

    // Report Form Sync
    useEffect(() => {
        if (company) {
            setReportForm((prev: any) => ({
                ...prev,
                taxableNameEn: company.name || prev.taxableNameEn || '',
                trn: company.corporateTaxTrn || company.trn || prev.trn || '',
                entityType: company.businessType || prev.entityType || '',
                primaryBusiness: company.primaryBusiness || prev.primaryBusiness || '',
                address: company.address || prev.address || '',
                periodFrom: company.ctPeriodStart || prev.periodFrom || '',
                periodTo: company.ctPeriodEnd || prev.periodTo || ''
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
                accountingIncomeTaxPeriod: ftaFormValues.netProfit
            }));
        }
    }, [ftaFormValues]);

    const contextValue: ICtType3Context = {
        // Missing properties added
        trialBalance: adjustedTrialBalance,
        auditReport: null, // Placeholder or add state if needed
        additionalFiles: [], // Placeholder
        setAdditionalFiles: () => { }, // Placeholder
        summaryFileFilter: '',
        isExtracting: false,
        setIsExtracting: () => { },
        extractionStatus: '',
        setExtractionStatus: () => { },

        reportsError: null,
        isGeneratingTrialBalance: false,
        isGeneratingAuditReport: false,
        onGenerateTrialBalance: () => { },
        onGenerateAuditReport: () => { },

        currentStep, setCurrentStep,
        openingBalancesData, setOpeningBalancesData,
        openingBalanceFiles, setOpeningBalanceFiles,
        isExtractingOpeningBalances, setIsExtractingOpeningBalances,
        adjustedTrialBalance, setAdjustedTrialBalance,
        isExtractingTB, setIsExtractingTB,
        extractionAlert, setExtractionAlert,
        showGlobalAddAccountModal, setShowGlobalAddAccountModal,
        newGlobalAccountMain, setNewGlobalAccountMain,
        newGlobalAccountName, setNewGlobalAccountName,
        openTbSection, setOpenTbSection,
        additionalDetails, setAdditionalDetails,
        vatManualAdjustments, setVatManualAdjustments,
        showVatConfirm, setShowVatConfirm,
        pnlValues, setPnlValues,
        balanceSheetValues, setBalanceSheetValues,
        pnlStructure, setPnlStructure,
        bsStructure, setBsStructure,
        obWorkingNotes, setObWorkingNotes,
        tbWorkingNotes, setTbWorkingNotes,
        pnlWorkingNotes, setPnlWorkingNotes,
        bsWorkingNotes, setBsWorkingNotes,
        louFiles, setLouFiles,
        questionnaireAnswers, setQuestionnaireAnswers,
        reportForm, setReportForm,
        openReportSection, setOpenReportSection,
        autoPopulateTrigger, setAutoPopulateTrigger,
        vatStepData, bankVatData, ftaFormValues,
        handleBack,
        companyName, currency, company, onReset,
        workingNoteModalOpen, setWorkingNoteModalOpen,
        currentWorkingAccount, setCurrentWorkingAccount,
        tempBreakdown, setTempBreakdown
    };

    const steps = [
        "Opening Balances", "Adjust Trial Balance", "VAT Docs Upload", "VAT Summarization",
        "Profit & Loss", "Balance Sheet", "LOU Upload", "Questionnaire", "Final Report"
    ];

    return (
        <CtType3Context.Provider value={contextValue}>
            <div className="min-h-screen bg-[#0B1120] text-gray-200 font-sans selection:bg-blue-500/30">
                {/* Header */}
                <div className="sticky top-0 z-40 bg-[#0B1120]/80 backdrop-blur-xl border-b border-gray-800 shadow-lg">
                    <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                <ChartBarIcon className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-black text-white tracking-tight">
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">C.T. Type 3</span> Filing
                                </h1>
                                <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
                                    <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-300">{companyName || 'Unknown Entity'}</span>
                                    <span>•</span>
                                    <span className="font-mono text-cyan-400">{currency}</span>
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
            </div >

            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (newGlobalAccountName.trim()) {
                                const newItem = { account: newGlobalAccountName.trim(), debit: 0, credit: 0, category: newGlobalAccountMain };
                                setAdjustedTrialBalance(prev => {
                                    if (!prev) return [newItem];
                                    const newTb = [...prev];
                                    const totalsIdx = newTb.findIndex(i => i.account === 'Totals');
                                    if (totalsIdx > -1) newTb.splice(totalsIdx, 0, newItem);
                                    else newTb.push(newItem);
                                    return newTb;
                                });
                                const updateNotes = (setter: any) => {
                                    setter((prev: any) => {
                                        const n = { ...prev };
                                        if (!n[newItem.account]) n[newItem.account] = [];
                                        return n;
                                    })
                                }
                                setShowGlobalAddAccountModal(false);
                                setNewGlobalAccountName('');
                            }
                        }}>
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
        </CtType3Context.Provider >
    );
};
