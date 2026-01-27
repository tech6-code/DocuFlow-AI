import React from 'react';
import {
    PencilIcon,
    PlusIcon,
    InformationCircleIcon,
    ExclamationTriangleIcon
} from '../icons';
import {
    formatWholeNumber
} from './CtType1Shared';
import type { TrialBalanceEntry } from '../../types';

interface CtType1Step6Props {
    adjustedTrialBalance: TrialBalanceEntry[] | null;
    handleCellChange: (accountLabel: string, field: 'debit' | 'credit', value: string) => void;
    handleOpenWorkingNote: (accountLabel: string) => void;
    setShowGlobalAddAccountModal: React.Dispatch<React.SetStateAction<boolean>>;
    handleBack: () => void;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
    breakdowns: Record<string, any[]>;
}

export const CtType1Step6: React.FC<CtType1Step6Props> = ({
    adjustedTrialBalance,
    handleCellChange,
    handleOpenWorkingNote,
    setShowGlobalAddAccountModal,
    handleBack,
    setCurrentStep,
    breakdowns
}) => {
    if (!adjustedTrialBalance) return null;

    const totals = adjustedTrialBalance.find(i => i.account === 'Totals');
    const isBalanced = totals ? totals.debit === totals.credit : true;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-white">Step 6: Adjust Trial Balance</h3>
                        <p className="text-gray-400 text-xs mt-1">Review and adjust account balances. Add working notes for detailed breakdowns.</p>
                    </div>
                    <button
                        onClick={() => setShowGlobalAddAccountModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-all"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Add New Account
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-[10px] text-gray-500 uppercase font-black bg-gray-800/50">
                            <tr>
                                <th className="px-6 py-4">Account Name</th>
                                <th className="px-6 py-4 text-right">Debit (AED)</th>
                                <th className="px-6 py-4 text-right">Credit (AED)</th>
                                <th className="px-6 py-4 text-center">Working Note</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {adjustedTrialBalance.filter(i => i.account !== 'Totals').map((item, idx) => {
                                const hasNote = breakdowns[item.account] && breakdowns[item.account].length > 0;
                                return (
                                    <tr key={idx} className="hover:bg-gray-800/30 group">
                                        <td className="px-6 py-4 text-gray-300 font-medium group-hover:text-white transition-colors">{item.account}</td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={item.debit === 0 ? '' : item.debit}
                                                onChange={(e) => handleCellChange(item.account, 'debit', e.target.value)}
                                                className="w-full bg-transparent text-right outline-none focus:bg-gray-800 px-2 py-1 rounded text-red-400 font-mono"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <input
                                                type="text"
                                                value={item.credit === 0 ? '' : item.credit}
                                                onChange={(e) => handleCellChange(item.account, 'credit', e.target.value)}
                                                className="w-full bg-transparent text-right outline-none focus:bg-gray-800 px-2 py-1 rounded text-green-400 font-mono"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleOpenWorkingNote(item.account)}
                                                className={`p-2 rounded-lg transition-all ${hasNote ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-gray-800 text-gray-500 hover:text-blue-400 border border-transparent hover:border-blue-500/30'}`}
                                                title="Add/Edit Working Note"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        {totals && (
                            <tfoot className="bg-gray-800/80 font-black">
                                <tr>
                                    <td className="px-6 py-4 text-white uppercase tracking-widest text-[10px]">Grand Totals</td>
                                    <td className="px-6 py-4 text-right font-mono text-red-400">{formatWholeNumber(totals.debit)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-green-400">{formatWholeNumber(totals.credit)}</td>
                                    <td className="px-6 py-4 text-center">
                                        {!isBalanced && (
                                            <div className="flex items-center justify-center gap-1 text-red-500 animate-pulse" title="Trial Balance Unbalanced!">
                                                <ExclamationTriangleIcon className="w-4 h-4" />
                                                <span className="text-[10px]">Unbalanced</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                <div className="p-4 bg-blue-900/5 flex items-start gap-3">
                    <InformationCircleIcon className="w-5 h-5 text-blue-400 mt-0.5" />
                    <p className="text-xs text-blue-300 leading-relaxed">
                        The Trial Balance above is automatically derived from your opening balances and summarized bank transactions.
                        Use the <span className="font-bold underline">Working Note</span> feature to provide granular breakdowns for audit purposes.
                        Manual adjustments will directly update the final Profit & Loss and Balance Sheet.
                    </p>
                </div>
            </div>

            <div className="flex justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-700">
                <button onClick={handleBack} className="text-gray-400 hover:text-white font-bold uppercase tracking-widest text-[11px] transition-colors border-b border-transparent hover:border-gray-500 pb-1">Back</button>
                <div className="flex gap-4">
                    {!isBalanced && (
                        <div className="flex items-center gap-2 bg-red-950/30 border border-red-500/30 px-4 py-2 rounded-xl text-red-400 text-[10px] font-bold uppercase">
                            <ExclamationTriangleIcon className="w-4 h-4" />
                            TB Difference: {formatWholeNumber(Math.abs((totals?.debit || 0) - (totals?.credit || 0)))}
                        </div>
                    )}
                    <button
                        onClick={() => setCurrentStep(7)}
                        disabled={!isBalanced}
                        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                    >
                        Generate Financial Statements
                    </button>
                </div>
            </div>
        </div>
    );
};
