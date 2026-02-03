import React from 'react';
import { useCtType2 } from '../Layout';
import { AssetIcon, ScaleIcon, BanknotesIcon, ArrowRightIcon, ArrowPathIcon, ArrowUpRightIcon, ArrowDownIcon } from '../../../icons';
import { formatWholeNumber, formatNumber } from '../types';

export const Step2: React.FC = () => {
    const {
        summary,
        currency,
        handleBack,
        handleExportStep2Summarization,
        setCurrentStep
    } = useCtType2();

    if (!summary) return <div>No summary available.</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0B1120] rounded-2xl p-6 border border-gray-800 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <AssetIcon className="w-24 h-24 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Total Deposits</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white tracking-tighter">{formatWholeNumber(summary.totalCredit)}</span>
                        <span className="text-xs font-bold text-green-500 uppercase">{currency}</span>
                    </div>
                </div>

                <div className="bg-[#0B1120] rounded-2xl p-6 border border-gray-800 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <ScaleIcon className="w-24 h-24 text-white" />
                    </div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Total Withdrawals</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white tracking-tighter">{formatWholeNumber(summary.totalDebit)}</span>
                        <span className="text-xs font-bold text-red-500 uppercase">{currency}</span>
                    </div>
                </div>

                <div className="bg-[#1e1b4b] rounded-2xl p-6 border border-indigo-500/30 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BanknotesIcon className="w-24 h-24 text-indigo-400" />
                    </div>
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] mb-4">Net Movement</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white tracking-tighter">{formatWholeNumber(summary.totalCredit - summary.totalDebit)}</span>
                        <span className="text-xs font-bold text-indigo-400 uppercase">{currency}</span>
                    </div>
                </div>
            </div>

            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <h3 className="text-xl font-bold text-white">Bank Reconciliation Summary</h3>
                </div>
                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center">
                                <ArrowUpRightIcon className="w-4 h-4 mr-2" /> Inflows Analysis
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between p-4 bg-gray-950/50 rounded-xl border border-gray-800/50">
                                    <span className="text-gray-400 text-sm">Customer Deposits</span>
                                    <span className="text-white font-mono font-bold">{formatWholeNumber(summary.totalCredit)} {currency}</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center">
                                <ArrowDownIcon className="w-4 h-4 mr-2" /> Outflows Analysis
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between p-4 bg-gray-950/50 rounded-xl border border-gray-800/50">
                                    <span className="text-gray-400 text-sm">Operating Expenses</span>
                                    <span className="text-white font-mono font-bold">{formatWholeNumber(summary.totalDebit)} {currency}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportStep2Summarization}
                        className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg border border-white/10 transition-all text-sm"
                    >
                        Export Step 2
                    </button>
                    <button onClick={() => setCurrentStep(3)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl transition-all">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};
