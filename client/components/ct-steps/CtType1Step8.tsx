import React, { useState } from 'react';
import {
    DocumentArrowDownIcon,
    PlusIcon,
    PencilIcon,
    ListBulletIcon,
    ChatBubbleBottomCenterTextIcon,
    ChevronLeftIcon,
    TrashIcon
} from '../icons';
import {
    formatDecimalNumber
} from './CtType1Shared';

interface CtType1Step8Props {
    balanceSheetValues: any;
    computedValues: any;
    bsWorkingNotes: any;
    handleBalanceSheetChange: (id: string, year: 'currentYear' | 'previousYear', value: number) => void;
    handleUpdateBsWorkingNote: (id: string, notes: any[]) => void;
    handleBack: () => void;
    handleContinueToReport: () => void;
    handleExportStepBS: () => void;
    companyName: string;
    currency: string;
}

const bsStructure = [
    { id: 'assets_header', label: 'ASSETS', type: 'header', indent: 0 },
    { id: 'property_plant_equipment', label: 'Property, Plant and Equipment', type: 'item', indent: 1 },
    { id: 'intangible_assets', label: 'Intangible Assets', type: 'item', indent: 1 },
    { id: 'long_term_investments', label: 'Long-term Investments', type: 'item', indent: 1 },
    { id: 'total_non_current_assets', label: 'Total Non-Current Assets', type: 'total', indent: 0 },
    { id: 'cash_bank_balances', label: 'Cash and Bank Balances', type: 'item', indent: 1 },
    { id: 'inventories', label: 'Inventories', type: 'item', indent: 1 },
    { id: 'trade_receivables', label: 'Trade Receivables', type: 'item', indent: 1 },
    { id: 'advances_deposits_receivables', label: 'Advances, Deposits & Other Receivables', type: 'item', indent: 1 },
    { id: 'related_party_transactions_assets', label: 'Related Party Transactions - Assets', type: 'item', indent: 1 },
    { id: 'total_current_assets', label: 'Total Current Assets', type: 'total', indent: 0 },
    { id: 'total_assets', label: 'TOTAL ASSETS', type: 'grand_total', indent: 0 },
    { id: 'equity_header', label: 'EQUITY', type: 'header', indent: 0 },
    { id: 'share_capital', label: 'Share Capital', type: 'item', indent: 1 },
    { id: 'statutory_reserve', label: 'Statutory Reserve', type: 'item', indent: 1 },
    { id: 'retained_earnings', label: 'Retained Earnings', type: 'item', indent: 1 },
    { id: 'shareholders_current_accounts', label: 'Shareholders\' Current Accounts', type: 'item', indent: 1 },
    { id: 'total_equity', label: 'Total Equity', type: 'total', indent: 0 },
    { id: 'liabilities_header', label: 'LIABILITIES', type: 'header', indent: 0 },
    { id: 'employees_end_service_benefits', label: 'Employees\' End of Service Benefits', type: 'item', indent: 1 },
    { id: 'bank_borrowings_non_current', label: 'Bank Borrowings - Non-Current', type: 'item', indent: 1 },
    { id: 'total_non_current_liabilities', label: 'Total Non-Current Liabilities', type: 'total', indent: 0 },
    { id: 'short_term_borrowings', label: 'Short-term Borrowings', type: 'item', indent: 1 },
    { id: 'related_party_transactions_liabilities', label: 'Related Party Transactions - Liabilities', type: 'item', indent: 1 },
    { id: 'trade_other_payables', label: 'Trade & Other Payables', type: 'item', indent: 1 },
    { id: 'total_current_liabilities', label: 'Total Current Liabilities', type: 'total', indent: 0 },
    { id: 'total_liabilities', label: 'TOTAL LIABILITIES', type: 'total', indent: 0 },
    { id: 'total_equity_liabilities', label: 'TOTAL EQUITY & LIABILITIES', type: 'grand_total', indent: 0 },
];

export const CtType1Step8: React.FC<CtType1Step8Props> = ({
    balanceSheetValues,
    computedValues,
    bsWorkingNotes,
    handleBalanceSheetChange,
    handleUpdateBsWorkingNote,
    handleBack,
    handleContinueToReport,
    handleExportStepBS,
    companyName,
    currency
}) => {
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
    const [tempNotes, setTempNotes] = useState<any[]>([]);

    const openNoteModal = (id: string) => {
        setCurrentNoteId(id);
        const existing = bsWorkingNotes[id] || [];
        setTempNotes(existing.length > 0 ? JSON.parse(JSON.stringify(existing)) : [{ description: '', amount: 0 }]);
        setNoteModalOpen(true);
    };

    const handleSaveNote = () => {
        if (currentNoteId) {
            handleUpdateBsWorkingNote(currentNoteId, tempNotes.filter(n => n.description.trim() || n.amount !== 0));
        }
        setNoteModalOpen(false);
    };

    const addNoteRow = () => setTempNotes([...tempNotes, { description: '', amount: 0 }]);
    const removeNoteRow = (idx: number) => setTempNotes(tempNotes.filter((_, i) => i !== idx));
    const updateNote = (idx: number, field: string, value: any) => {
        const updated = [...tempNotes];
        updated[idx] = { ...updated[idx], [field]: value };
        setTempNotes(updated);
    };

    const currentYearTotal = tempNotes.reduce((sum, n) => sum + (parseFloat(n.amount) || 0), 0);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/20">
                    <div>
                        <h3 className="text-xl font-bold text-white uppercase tracking-tight">Statement of Financial Position</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">As at 31 Dec 2024 • Figures in {currency}</p>
                    </div>
                    <button onClick={handleExportStepBS} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 font-bold transition-all border border-gray-700">
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        Export Excel
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-gray-500 uppercase font-black bg-gray-950/50">
                            <tr>
                                <th className="px-8 py-4 w-1/2">Assets, Equity & Liabilities</th>
                                <th className="px-8 py-4 text-right">Current Year</th>
                                <th className="px-8 py-4 text-right">Previous Year</th>
                                <th className="px-8 py-4 text-center w-20">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {bsStructure.map((item) => {
                                const isHeader = item.type === 'header';
                                const isTotal = item.type === 'total';
                                const isGrandTotal = item.type === 'grand_total';
                                const values = computedValues.bs[item.id] || { currentYear: 0, previousYear: 0 };
                                const hasNotes = bsWorkingNotes[item.id] && bsWorkingNotes[item.id].length > 0;

                                if (isHeader) {
                                    return (
                                        <tr key={item.id} className="bg-gray-800/80">
                                            <td colSpan={4} className="px-8 py-3 text-[11px] font-black text-gray-300 uppercase tracking-widest">{item.label}</td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={item.id} className={`${isGrandTotal ? 'bg-blue-950/20 border-t-2 border-blue-900/40' : (isTotal ? 'bg-white/[0.01]' : 'hover:bg-white/[0.02]')} transition-colors group`}>
                                        <td className={`px-8 py-4 ${item.indent > 0 ? 'pl-16' : ''} ${isGrandTotal || isTotal ? 'font-bold text-white uppercase text-[11px] tracking-tight' : 'text-gray-400'}`}>
                                            {item.label}
                                        </td>
                                        <td className="px-8 py-4 text-right font-mono">
                                            {isTotal || isGrandTotal ? (
                                                <span className={`text-sm ${isGrandTotal ? 'text-blue-400 font-black underline decoration-blue-500/30 underline-offset-8' : (values.currentYear >= 0 ? 'text-white' : 'text-red-400')} font-bold`}>
                                                    {formatDecimalNumber(values.currentYear)}
                                                </span>
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={balanceSheetValues[item.id]?.currentYear ?? ''}
                                                    onChange={(e) => handleBalanceSheetChange(item.id, 'currentYear', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent text-right outline-none focus:bg-gray-800 px-2 py-1 rounded text-gray-200"
                                                    placeholder="0.00"
                                                />
                                            )}
                                        </td>
                                        <td className="px-8 py-3 text-right font-mono text-gray-600">
                                            {isTotal || isGrandTotal ? (
                                                formatDecimalNumber(values.previousYear)
                                            ) : (
                                                <input
                                                    type="number"
                                                    value={balanceSheetValues[item.id]?.previousYear ?? ''}
                                                    onChange={(e) => handleBalanceSheetChange(item.id, 'previousYear', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent text-right outline-none focus:bg-gray-800 px-2 py-1 rounded text-gray-500"
                                                    placeholder="0.00"
                                                />
                                            )}
                                        </td>
                                        <td className="px-8 py-3 text-center">
                                            {!isTotal && !isGrandTotal && (
                                                <button
                                                    onClick={() => openNoteModal(item.id)}
                                                    className={`p-1.5 rounded transition-all ${hasNotes ? 'text-blue-400 bg-blue-400/10' : 'text-gray-600 hover:text-blue-400'}`}
                                                >
                                                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-700">
                <button onClick={handleBack} className="text-gray-400 hover:text-white font-bold uppercase tracking-widest text-[11px]">Back</button>
                <button onClick={handleContinueToReport} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-95 uppercase tracking-widest text-xs">
                    Confirm & Proceed: CT Report
                </button>
            </div>

            {/* Note Modal */}
            {noteModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-800/30">
                            <div>
                                <h4 className="text-lg font-bold text-white">Working Note (BS)</h4>
                                <p className="text-xs text-gray-500 mt-0.5">{bsStructure.find(s => s.id === currentNoteId)?.label}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Total Adjustment</p>
                                <p className="text-lg font-black text-blue-400 font-mono">{formatDecimalNumber(currentYearTotal)}</p>
                            </div>
                        </div>
                        <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar">
                            <div className="space-y-3">
                                {tempNotes.map((note, idx) => (
                                    <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-300">
                                        <input
                                            type="text"
                                            value={note.description}
                                            onChange={(e) => updateNote(idx, 'description', e.target.value)}
                                            placeholder="Description"
                                            className="flex-1 bg-gray-800 border-none rounded-lg px-4 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500"
                                        />
                                        <input
                                            type="number"
                                            value={note.amount === 0 ? '' : note.amount}
                                            onChange={(e) => updateNote(idx, 'amount', parseFloat(e.target.value) || 0)}
                                            placeholder="Amount"
                                            className="w-32 bg-gray-800 border-none rounded-lg px-4 py-2 text-sm text-right text-white font-mono focus:ring-1 focus:ring-blue-500"
                                        />
                                        <button onClick={() => removeNoteRow(idx)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addNoteRow} className="mt-4 flex items-center gap-2 text-blue-400 hover:text-blue-300 text-xs font-bold transition-colors">
                                <PlusIcon className="w-4 h-4" />
                                Add Adjustment Row
                            </button>
                        </div>
                        <div className="p-6 border-t border-gray-800 flex justify-end gap-3 bg-gray-800/20">
                            <button onClick={() => setNoteModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-xs font-bold uppercase transition-colors">Cancel</button>
                            <button onClick={handleSaveNote} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all uppercase tracking-widest">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
