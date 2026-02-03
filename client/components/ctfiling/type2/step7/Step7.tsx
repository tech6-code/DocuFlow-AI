import React from 'react';
import { useCtType2 } from '../Layout';
import {
    CheckIcon, DocumentTextIcon, ArrowUpRightIcon, ArrowDownIcon, ChartBarIcon,
    InformationCircleIcon, ExclamationTriangleIcon, ChevronLeftIcon, DocumentArrowDownIcon, ChevronRightIcon
} from '../../../icons';
import { formatWholeNumber, formatNumber } from '../types';

export const Step7: React.FC = () => {
    const {
        vatStepData,
        vatManualAdjustments,
        handleVatAdjustmentChange,
        vatCertificateTotals,
        invoiceTotals,
        handleBack,
        handleExportStep7VAT,
        setCurrentStep
    } = useCtType2();

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

    const reconciliationData = [
        {
            label: 'Standard Rated Supplies (Sales)',
            certAmount: vatCertificateTotals.salesAmount,
            invoiceAmount: invoiceTotals.salesAmount,
            certVat: vatCertificateTotals.salesVat,
            invoiceVat: invoiceTotals.salesVat,
            icon: ArrowUpRightIcon,
            color: 'text-green-400'
        },
        {
            label: 'Standard Rated Expenses (Purchases)',
            certAmount: vatCertificateTotals.purchaseAmount,
            invoiceAmount: invoiceTotals.purchaseAmount,
            certVat: vatCertificateTotals.purchaseVat,
            invoiceVat: invoiceTotals.purchaseVat,
            icon: ArrowDownIcon,
            color: 'text-red-400'
        }
    ];

    const isMatch = (val1: number, val2: number) => Math.abs(val1 - val2) < 2;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50 flex justify-between items-center">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-500/5">
                            <ChartBarIcon className="w-8 h-8 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">VAT Summarization & Reconciliation</h3>
                            <p className="text-gray-400 mt-1">Comparing VAT 201 figures with extracted Invoice totals.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-10">
                    {/* VAT 201 Summary */}
                    <div className="max-w-6xl mx-auto space-y-8">
                        <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                            <div className="px-8 py-5 border-b border-gray-800 bg-blue-900/10 flex justify-between items-center">
                                <h4 className="text-sm font-black text-blue-300 uppercase tracking-[0.2em]">Sales (Outputs) - As per FTA</h4>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in AED</span>
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
                                                    <td className="py-4 px-4 text-right font-black bg-blue-500/5 text-blue-100">{formatNumber(data.total)}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-blue-900/20 font-bold border-t-2 border-gray-800">
                                            <td className="py-5 px-4 text-left font-black text-blue-300 text-[10px] uppercase italic">Sales Total</td>
                                            <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatNumber(grandTotals.sales.zero)}</td>
                                            <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatNumber(grandTotals.sales.tv)}</td>
                                            <td className="py-5 px-4 text-right text-blue-400">{formatNumber(grandTotals.sales.vat)}</td>
                                            <td className="py-5 px-4 text-right text-white text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatNumber(grandTotals.sales.total)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                            <div className="px-8 py-5 border-b border-gray-800 bg-indigo-900/10 flex justify-between items-center">
                                <h4 className="text-sm font-black text-indigo-300 uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in AED</span>
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
                                                    <td className="py-4 px-4 text-right font-black bg-indigo-500/5 text-indigo-100">{formatNumber(data.total)}</td>
                                                </tr>
                                            );
                                        })}
                                        <tr className="bg-indigo-900/20 font-bold border-t-2 border-gray-800">
                                            <td className="py-5 px-4 text-left font-black text-indigo-300 text-[10px] uppercase italic">Purchases Total</td>
                                            <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatNumber(grandTotals.purchases.zero)}</td>
                                            <td className="py-5 px-4 text-right text-gray-400 text-xs">{formatNumber(grandTotals.purchases.tv)}</td>
                                            <td className="py-5 px-4 text-right text-indigo-400">{formatNumber(grandTotals.purchases.vat)}</td>
                                            <td className="py-5 px-4 text-right text-white text-base tracking-tighter shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]">{formatNumber(grandTotals.purchases.total)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="max-w-2xl mx-auto">
                            <div className={`rounded-3xl border-2 p-8 flex flex-col items-center justify-center transition-all ${grandTotals.net >= 0 ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-rose-900/10 border-rose-500/30'}`}>
                                <span className={`text-xs font-black uppercase tracking-[0.3em] mb-4 ${grandTotals.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>Total VAT Liability / (Refund)</span>
                                <div className="flex items-baseline gap-3">
                                    <span className="text-5xl font-mono font-black text-white tracking-tighter">{formatNumber(grandTotals.net)}</span>
                                    <span className={`text-sm font-bold uppercase tracking-widest ${grandTotals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>AED</span>
                                </div>
                                <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-black/40 rounded-full border border-white/5">
                                    <InformationCircleIcon className="w-4 h-4 text-gray-500" />
                                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Calculated as (Total Sales VAT - Total Purchase VAT)</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Comparison Table */}
                    <div className="overflow-hidden rounded-2xl border border-gray-800 bg-[#0F172A]/30">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[#0F172A] border-b border-gray-800">
                                    <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest">Description</th>
                                    <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">VAT 201</th>
                                    <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Invoice Sum</th>
                                    <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-center text-right">Difference</th>
                                    <th className="p-5 text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {reconciliationData.map((item, idx) => {
                                    const amountDiff = item.certAmount - item.invoiceAmount;
                                    const vatDiff = item.certVat - item.invoiceVat;
                                    const amountMatched = isMatch(item.certAmount, item.invoiceAmount);
                                    const vatMatched = isMatch(item.certVat, item.invoiceVat);

                                    return (
                                        <React.Fragment key={idx}>
                                            <tr className="hover:bg-gray-800/30 transition-colors">
                                                <td className="p-5">
                                                    <div className="flex items-center gap-3">
                                                        <item.icon className={`w-5 h-5 ${item.color}`} />
                                                        <div>
                                                            <p className="text-sm font-bold text-white">{item.label}</p>
                                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">Net Amount</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-right font-mono text-sm text-white">
                                                    {formatNumber(item.certAmount)}
                                                </td>
                                                <td className="p-5 text-right font-mono text-sm text-gray-300">
                                                    {formatNumber(item.invoiceAmount)}
                                                </td>
                                                <td className={`p-5 text-right font-mono text-sm ${amountMatched ? 'text-gray-500' : 'text-orange-400'}`}>
                                                    {formatNumber(Math.abs(amountDiff))}
                                                </td>
                                                <td className="p-5 text-center">
                                                    {amountMatched ? (
                                                        <div className="flex items-center justify-center text-green-400 bg-green-400/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mx-auto w-fit">
                                                            <CheckIcon className="w-3 h-3 mr-1" /> Matched
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mx-auto w-fit">
                                                            <ExclamationTriangleIcon className="w-3 h-3 mr-1" /> Discrepancy
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                            <tr className="hover:bg-gray-800/30 transition-colors bg-[#0F172A]/10">
                                                <td className="p-5 pl-12">
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-medium">VAT (5%)</p>
                                                </td>
                                                <td className="p-5 text-right font-mono text-sm text-white">
                                                    {formatNumber(item.certVat)}
                                                </td>
                                                <td className="p-5 text-right font-mono text-sm text-gray-300">
                                                    {formatNumber(item.invoiceVat)}
                                                </td>
                                                <td className={`p-5 text-right font-mono text-sm ${vatMatched ? 'text-gray-500' : 'text-orange-400'}`}>
                                                    {formatNumber(Math.abs(vatDiff))}
                                                </td>
                                                <td className="p-5 text-center">
                                                    {vatMatched ? (
                                                        <div className="w-2 h-2 rounded-full bg-green-400 mx-auto ring-4 ring-green-400/10"></div>
                                                    ) : (
                                                        <div className="w-2 h-2 rounded-full bg-orange-400 mx-auto ring-4 ring-orange-400/10"></div>
                                                    )}
                                                </td>
                                            </tr>
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                                <ChartBarIcon className="w-24 h-24 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                                VAT 201 Summary
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Supplies</p>
                                    <p className="text-xl font-mono text-white">{formatNumber(vatCertificateTotals.salesAmount)}</p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Total Expenses</p>
                                    <p className="text-xl font-mono text-white">{formatNumber(vatCertificateTotals.purchaseAmount)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-[#0F172A] rounded-2xl p-6 border border-gray-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 transition-opacity group-hover:opacity-10">
                                <DocumentTextIcon className="w-24 h-24 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 flex items-center">
                                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                Invoice Calculation Sum
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Sales Sum</p>
                                    <p className="text-xl font-mono text-white">{formatNumber(invoiceTotals.salesAmount)}</p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-xl border border-gray-800/50">
                                    <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Purchase Sum</p>
                                    <p className="text-xl font-mono text-white">{formatNumber(invoiceTotals.purchaseAmount)}</p>
                                </div>
                            </div>
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
                        onClick={handleExportStep7VAT}
                        className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        Export Step 7
                    </button>
                    <button
                        onClick={() => setCurrentStep(8)}
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                    >
                        Confirm & Continue
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );
};
