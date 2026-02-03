
import React from 'react';
import { useCtType3 } from '../types';
import * as XLSX from 'xlsx';
import {
    ClipboardCheckIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    ChevronLeftIcon,
    DocumentArrowDownIcon,
    ChevronRightIcon,
    BuildingOfficeIcon,
    BriefcaseIcon
} from '../../../icons';

export const Step4: React.FC = () => {
    const {
        vatStepData,
        vatManualAdjustments,
        setVatManualAdjustments,
        summaryFileFilter,
        currentStep,
        setCurrentStep,
        handleBack,
        companyName,
        currency,
        bankVatData,
        additionalDetails
    } = useCtType3();

    // Helper functions
    const formatDecimalNumber = (num: number | undefined | null) => {
        if (num === undefined || num === null || isNaN(num)) return '0.00';
        return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    };

    const formatDate = (dateStr: any) => {
        if (!dateStr) return '-';
        if (typeof dateStr !== 'string') return String(dateStr);
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (e) {
            return dateStr;
        }
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

    const handleVatSummarizationContinue = () => {
        setCurrentStep(5); // To Profit & Loss
    };

    const buildVatSummaryRows = (title: string) => {
        const rows: any[][] = [[title], []];

        rows.push(["VAT FILE RESULTS"]);
        if (Array.isArray(additionalDetails?.vatFileResults) && additionalDetails.vatFileResults.length > 0) {
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

    const applySheetStyling = (worksheet: any, headerRows: number) => {
        // Placeholder
    };

    const handleExportStep4VAT = () => {
        const vatData = buildVatSummaryRows("STEP 4: VAT SUMMARIZATION DETAILS");
        const ws = XLSX.utils.aoa_to_sheet(vatData);
        ws['!cols'] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
        ];
        applySheetStyling(ws, 3);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "VAT Summary");
        XLSX.writeFile(wb, `${companyName}_Step4_VATRefinement.xlsx`);
    };

    const handleExportAll = () => {
        // This seems to be a general export button in the UI, but step 4 specific export is handleExportStep4VAT
    };


    const { periods, grandTotals } = vatStepData;

    const renderEditableCell = (periodId: string, field: string, value: number) => {
        const displayValue = vatManualAdjustments[periodId]?.[field] ?? (value === 0 ? '' : value.toString());
        return (
            <input
                type="text"
                value={displayValue}
                onChange={(e) => handleVatAdjustmentChange(periodId, field, e.target.value)}
                className="w-full bg-transparent text-right outline-none focus:bg-white/10 px-2 py-1 rounded transition-colors font-mono"
                placeholder="0.00"
            />
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
            </div>

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
                                    {periods.map((p: any) => {
                                        const data = p.sales;
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

                                        return (
                                            <tr key={p.id} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-white text-[10px] tracking-tight">{dateRange}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'salesZero', data.zero)}</td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'salesTv', data.tv)}</td>
                                                <td className="py-4 px-4 text-right text-blue-400">{renderEditableCell(p.id, 'salesVat', data.vat)}</td>
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
                                    <tr className="bg-black/20 border-t border-gray-800/50">
                                        <td className="py-3 px-4 text-left font-bold text-gray-500 text-[10px] uppercase italic">As per Bank Statements</td>
                                        <td colSpan={3}></td>
                                        <td className="py-3 px-4 text-right text-blue-400/80 font-mono text-sm tracking-tighter">{formatDecimalNumber(bankVatData.grandTotals.sales)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

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
                                    {periods.map((p: any) => {
                                        const data = p.purchases;
                                        const dateRange = (p.periodFrom && p.periodTo) ? `${p.periodFrom} - ${p.periodTo}` : 'Unknown Period';

                                        return (
                                            <tr key={p.id} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                                <td className="py-4 px-4 text-left">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-black text-white text-[10px] tracking-tight">{dateRange}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'purchasesZero', data.zero)}</td>
                                                <td className="py-4 px-4 text-right">{renderEditableCell(p.id, 'purchasesTv', data.tv)}</td>
                                                <td className="py-4 px-4 text-right text-indigo-400">{renderEditableCell(p.id, 'purchasesVat', data.vat)}</td>
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
                                    <tr className="bg-black/20 border-t border-gray-800/50">
                                        <td className="py-3 px-4 text-left font-bold text-gray-500 text-[10px] uppercase italic">As per Bank Statements</td>
                                        <td colSpan={3}></td>
                                        <td className="py-3 px-4 text-right text-indigo-400/80 font-mono text-sm tracking-tighter">{formatDecimalNumber(bankVatData.grandTotals.purchases)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

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
                                Export Step 4
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
        </div>
    );
};
