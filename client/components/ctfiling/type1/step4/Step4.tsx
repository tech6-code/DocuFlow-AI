import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    ClipboardCheckIcon,
    DocumentArrowDownIcon,
    ChevronLeftIcon
} from '../../../icons';
import {
    formatDecimalNumber,
    VatEditableCell
} from '../../../CtType1Results';
import { CtType1Context } from '../types';

export const Step4: React.FC = () => {
    const {
        vatStepData,
        vatManualAdjustments,
        handleVatAdjustmentChange,
        handleExportVatSummary,
        handleBack,
        handleVatSummarizationContinue
    } = useOutletContext<CtType1Context>();

    const { periods, grandTotals } = vatStepData;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
            {/* Header Section */}
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
                                            <td className="py-4 px-4 text-right">
                                                <VatEditableCell
                                                    periodId={p.id}
                                                    field="salesZero"
                                                    value={data.zero}
                                                    vatManualAdjustments={vatManualAdjustments}
                                                    onChange={handleVatAdjustmentChange}
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <VatEditableCell
                                                    periodId={p.id}
                                                    field="salesTv"
                                                    value={data.tv}
                                                    vatManualAdjustments={vatManualAdjustments}
                                                    onChange={handleVatAdjustmentChange}
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-right text-blue-400">
                                                <VatEditableCell
                                                    periodId={p.id}
                                                    field="salesVat"
                                                    value={data.vat}
                                                    vatManualAdjustments={vatManualAdjustments}
                                                    onChange={handleVatAdjustmentChange}
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-right bg-blue-950/20 font-black text-blue-100">
                                                {formatDecimalNumber(data.total)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-blue-900/20 font-black text-white border-t-2 border-blue-500/30">
                                    <td className="py-6 px-4 text-left uppercase tracking-tighter text-[10px]">Grand Total (Outputs)</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.sales.zero)}</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.sales.tv)}</td>
                                    <td className="py-6 px-4 text-right text-blue-400">{formatDecimalNumber(grandTotals.sales.vat)}</td>
                                    <td className="py-6 px-4 text-right bg-blue-600 text-white shadow-2xl">{formatDecimalNumber(grandTotals.sales.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Purchases Section */}
                <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden mt-10">
                    <div className="px-8 py-5 border-b border-gray-800 bg-emerald-900/10 flex justify-between items-center">
                        <h4 className="text-sm font-black text-emerald-300 uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in AED</span>
                    </div>
                    <div className="p-2 overflow-x-auto">
                        <table className="w-full text-center">
                            <thead className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                <tr>
                                    <th className="py-4 px-4 text-left">Period</th>
                                    <th className="py-4 px-4 text-right">Zero Rated</th>
                                    <th className="py-4 px-4 text-right">Standard Rated</th>
                                    <th className="py-4 px-4 text-right text-emerald-400">VAT Amount</th>
                                    <th className="py-4 px-4 text-right bg-emerald-900/5 text-emerald-200">Total Purchases</th>
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
                                            <td className="py-4 px-4 text-right">
                                                <VatEditableCell
                                                    periodId={p.id}
                                                    field="purchasesZero"
                                                    value={data.zero}
                                                    vatManualAdjustments={vatManualAdjustments}
                                                    onChange={handleVatAdjustmentChange}
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <VatEditableCell
                                                    periodId={p.id}
                                                    field="purchasesTv"
                                                    value={data.tv}
                                                    vatManualAdjustments={vatManualAdjustments}
                                                    onChange={handleVatAdjustmentChange}
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-right text-emerald-400">
                                                <VatEditableCell
                                                    periodId={p.id}
                                                    field="purchasesVat"
                                                    value={data.vat}
                                                    vatManualAdjustments={vatManualAdjustments}
                                                    onChange={handleVatAdjustmentChange}
                                                />
                                            </td>
                                            <td className="py-4 px-4 text-right bg-emerald-950/20 font-black text-emerald-100">
                                                {formatDecimalNumber(data.total)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-emerald-900/20 font-black text-white border-t-2 border-emerald-500/30">
                                    <td className="py-6 px-4 text-left uppercase tracking-tighter text-[10px]">Grand Total (Inputs)</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.purchases.zero)}</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.purchases.tv)}</td>
                                    <td className="py-6 px-4 text-right text-emerald-400">{formatDecimalNumber(grandTotals.purchases.vat)}</td>
                                    <td className="py-6 px-4 text-right bg-emerald-600 text-white shadow-2xl">{formatDecimalNumber(grandTotals.purchases.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Net VAT / Net Settlement Summary */}
                <div className="bg-gradient-to-br from-gray-900 to-black rounded-[2rem] border-2 border-blue-500/20 shadow-2xl p-8 mt-12 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div>
                        <h4 className="text-white font-black text-xl tracking-tight">Net VAT Liability/Refund Recovery</h4>
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Consolidated for selected period</p>
                    </div>
                    <div className="flex items-center gap-12">
                        <div className="text-right">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block mb-1">VAT Payable (Outputs)</span>
                            <span className="text-2xl font-mono text-white tracking-tighter">{formatDecimalNumber(grandTotals.sales.vat)}</span>
                        </div>
                        <div className="text-white text-2xl font-thin opacity-20">-</div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-1">VAT Recoverable (Inputs)</span>
                            <span className="text-2xl font-mono text-white tracking-tighter">{formatDecimalNumber(grandTotals.purchases.vat)}</span>
                        </div>
                        <div className="w-px h-12 bg-white/10 mx-2"></div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest block mb-1">NET VAT AED</span>
                            <span className={`text-4xl font-mono tracking-tighter ${grandTotals.net >= 0 ? 'text-blue-400' : 'text-emerald-400'}`}>
                                {formatDecimalNumber(grandTotals.net)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-8 border-t border-gray-800 mt-12">
                <button
                    onClick={handleBack}
                    className="flex items-center px-8 py-4 bg-transparent text-gray-400 hover:text-white font-black uppercase tracking-widest text-[10px] transition-all"
                >
                    <ChevronLeftIcon className="w-4 h-4 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportVatSummary}
                        className="flex items-center px-8 py-4 bg-gray-800/50 hover:bg-gray-800 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl border border-gray-700 transition-all"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                        Export Summary
                    </button>
                    <button
                        onClick={handleVatSummarizationContinue}
                        className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-2xl shadow-blue-500/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all"
                    >
                        Continue to Opening Balances
                    </button>
                </div>
            </div>
        </div>
    );
};
