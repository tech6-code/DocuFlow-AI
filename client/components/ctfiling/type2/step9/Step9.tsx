import React, { useRef } from 'react';
import { useCtType2 } from '../Layout';
import {
    ArrowPathIcon, DocumentArrowDownIcon, PlusIcon, ArrowsRightLeftIcon, DocumentTextIcon,
    ChartBarIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon
} from '../../../icons';
import { formatWholeNumber, formatNumber } from '../types';
import { LoadingIndicator } from '../../../LoadingIndicator';

export const Step9: React.FC = () => {
    const {
        adjustedTrialBalance,
        handleTrialBalanceChange,
        handleExportStep9TB,
        handleClearAllAdjustments,
        setCurrentStep,
        handleBack,
        grandTotals,
        isGeneratingTrialBalance,
        onGenerateTrialBalance,
        transactions
    } = useCtType2();

    const trialBalanceRef = useRef<HTMLDivElement>(null);

    // Filter out 0 value rows for clean display
    const tbData = (adjustedTrialBalance || []).filter(item =>
        Math.abs(item.debit) > 0.01 || Math.abs(item.credit) > 0.01 ||
        Math.abs(item.adjDebit ?? 0) > 0.01 || Math.abs(item.adjCredit ?? 0) > 0.01
    );

    const totals = tbData.reduce((acc, curr) => ({
        debit: acc.debit + curr.debit,
        credit: acc.credit + curr.credit,
        adjDebit: acc.adjDebit + (curr.adjDebit || 0),
        adjCredit: acc.adjCredit + (curr.adjCredit || 0),
        finalDebit: acc.finalDebit + (curr.finalDebit || 0),
        finalCredit: acc.finalCredit + (curr.finalCredit || 0)
    }), { debit: 0, credit: 0, adjDebit: 0, adjCredit: 0, finalDebit: 0, finalCredit: 0 });

    const isBalanced = Math.abs(totals.finalDebit - totals.finalCredit) < 1;

    if (isGeneratingTrialBalance) {
        return (
            <div className="flex items-center justify-center p-20 bg-gray-900 rounded-xl border border-gray-800">
                <LoadingIndicator progress={undefined} statusText="Generating Trial Balance..." title="Processing" />
            </div>
        );
    }

    if (!adjustedTrialBalance && onGenerateTrialBalance) {
        return (
            <div className="flex flex-col items-center justify-center p-20 bg-gray-900 rounded-xl border border-gray-800 text-center space-y-6">
                <ChartBarIcon className="w-16 h-16 text-gray-600" />
                <h3 className="text-xl font-bold text-white">Trial Balance Not Generated</h3>
                <p className="text-gray-400 max-w-md">The trial balance has not been generated yet. Please generate it to proceed with adjustments.</p>
                <button
                    onClick={() => onGenerateTrialBalance(transactions)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all"
                >
                    Generate Trial Balance
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-2xl border border-gray-800 shadow-xl overflow-hidden" ref={trialBalanceRef}>
                <div className="p-6 border-b border-gray-800 bg-[#0F172A]/50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                            <ChartBarIcon className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Adjust Trial Balance</h3>
                            <p className="text-sm text-gray-400">Make final adjustments before financial statements.</p>
                        </div>
                    </div>
                    {handleClearAllAdjustments && (
                        <button
                            onClick={handleClearAllAdjustments}
                            className="flex items-center px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-bold transition-all border border-red-500/20"
                        >
                            <XMarkIcon className="w-4 h-4 mr-2" />
                            Clear Adjustments
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#0F172A] border-b border-gray-800 text-[10px] uppercase tracking-widest text-gray-500 font-bold">
                                <th className="p-4 sticky left-0 bg-[#0F172A] z-10 w-[30%]">Account Name</th>
                                <th className="p-4 text-right w-[10%]">Unadj. Debit</th>
                                <th className="p-4 text-right w-[10%]">Unadj. Credit</th>
                                <th className="p-4 text-right w-[12%] bg-blue-900/10 text-blue-300 border-l border-blue-900/20">Adj. Debit</th>
                                <th className="p-4 text-right w-[12%] bg-blue-900/10 text-blue-300 border-r border-blue-900/20">Adj. Credit</th>
                                <th className="p-4 text-right w-[13%] font-black text-gray-300">Final Debit</th>
                                <th className="p-4 text-right w-[13%] font-black text-gray-300">Final Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50 text-xs font-mono">
                            {tbData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/30 transition-colors group">
                                    <td className="p-3 pl-4 font-bold text-gray-300 sticky left-0 bg-[#0B1120] group-hover:bg-[#131b2e] transition-colors border-r border-gray-800/50 z-10 w-[30%] truncate" title={row.account}>
                                        {row.account}
                                    </td>
                                    <td className="p-3 text-right text-gray-400 w-[10%]">{row.debit !== 0 ? formatNumber(row.debit) : '-'}</td>
                                    <td className="p-3 text-right text-gray-400 w-[10%]">{row.credit !== 0 ? formatNumber(row.credit) : '-'}</td>

                                    {/* Editable Adjustment Columns */}
                                    <td className="p-1 w-[12%] bg-blue-900/5 border-l border-blue-900/20">
                                        <input
                                            type="number"
                                            value={row.adjDebit === 0 ? '' : row.adjDebit}
                                            onChange={(e) => handleTrialBalanceChange(idx, 'adjDebit', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent text-right text-blue-300 placeholder:text-blue-900/30 focus:bg-blue-900/20 outline-none px-2 py-2 rounded transition-all font-bold"
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td className="p-1 w-[12%] bg-blue-900/5 border-r border-blue-900/20">
                                        <input
                                            type="number"
                                            value={row.adjCredit === 0 ? '' : row.adjCredit}
                                            onChange={(e) => handleTrialBalanceChange(idx, 'adjCredit', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-transparent text-right text-blue-300 placeholder:text-blue-900/30 focus:bg-blue-900/20 outline-none px-2 py-2 rounded transition-all font-bold"
                                            placeholder="0.00"
                                        />
                                    </td>

                                    <td className="p-3 text-right font-black text-gray-200 w-[13%] bg-gray-800/20">{row.finalDebit !== 0 ? formatNumber(row.finalDebit) : '-'}</td>
                                    <td className="p-3 text-right font-black text-gray-200 w-[13%] bg-gray-800/20">{row.finalCredit !== 0 ? formatNumber(row.finalCredit) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-[#0F172A] border-t-2 border-gray-700 font-bold sticky bottom-0 z-20 shadow-[-10px_-10px_30px_rgba(0,0,0,0.5)]">
                            <tr>
                                <td className="p-4 text-white uppercase tracking-widest text-[10px] pl-4 sticky left-0 bg-[#0F172A] z-20">Total</td>
                                <td className="p-4 text-right text-gray-400 font-mono text-xs">{formatNumber(totals.debit)}</td>
                                <td className="p-4 text-right text-gray-400 font-mono text-xs">{formatNumber(totals.credit)}</td>
                                <td className="p-4 text-right text-blue-300 font-mono text-xs bg-blue-900/10 border-l border-blue-900/20">{formatNumber(totals.adjDebit)}</td>
                                <td className="p-4 text-right text-blue-300 font-mono text-xs bg-blue-900/10 border-r border-blue-900/20">{formatNumber(totals.adjCredit)}</td>
                                <td className="p-4 text-right text-white font-mono text-sm shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]">{formatNumber(totals.finalDebit)}</td>
                                <td className="p-4 text-right text-white font-mono text-sm shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]">{formatNumber(totals.finalCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className={`p-4 flex justify-between items-center ${isBalanced ? 'bg-green-500/10' : 'bg-red-500/10'} border-t border-gray-800`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isBalanced ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className={`text-sm font-bold uppercase tracking-widest ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                            {isBalanced ? 'Trial Balance is Balanced' : `Out of Balance by ${formatNumber(Math.abs(totals.finalDebit - totals.finalCredit))}`}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportStep9TB}
                        className="flex items-center px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 transition-all uppercase text-[10px] tracking-widest group"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400 group-hover:scale-110 transition-transform" />
                        Export Trial Balance
                    </button>
                    <button
                        onClick={() => setCurrentStep(10)}
                        disabled={!isBalanced}
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                    >
                        Confirm & Continue
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );
};
