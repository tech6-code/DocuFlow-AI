import React, { useState, useEffect } from 'react';
import type { WorkingNoteEntry } from '../types';
import { ArrowRightIcon, ChevronLeftIcon, DocumentArrowDownIcon, PlusIcon, XMarkIcon, ListBulletIcon, TrashIcon } from './icons';

export interface BalanceSheetItem {
    id: string;
    label: string;
    type: 'header' | 'subheader' | 'item' | 'total' | 'grand_total';
    isEditable?: boolean;
}

interface BalanceSheetStepProps {
    onNext: () => void;
    onBack: () => void;
    data: Record<string, { currentYear: number; previousYear: number }>;
    onChange: (id: string, year: 'currentYear' | 'previousYear', value: number) => void;
    onExport: () => void;
    structure?: BalanceSheetItem[];
    onAddAccount?: (item: BalanceSheetItem & { sectionId: string }) => void;
    workingNotes?: Record<string, WorkingNoteEntry[]>;
    onUpdateWorkingNotes?: (id: string, notes: WorkingNoteEntry[]) => void;
}

export const BS_ITEMS: BalanceSheetItem[] = [
    // Assets
    { id: 'assets_header', label: 'Assets', type: 'header' },

    { id: 'non_current_assets_header', label: 'Non-current assets', type: 'subheader' },
    { id: 'property_plant_equipment', label: 'Property, plant and equipment', type: 'item', isEditable: true },
    { id: 'intangible_assets', label: 'Intangible assets', type: 'item', isEditable: true },
    { id: 'long_term_investments', label: 'Long-term investments', type: 'item', isEditable: true },
    { id: 'total_non_current_assets', label: 'Total non current assets', type: 'total', isEditable: true },

    { id: 'current_assets_header', label: 'Current assets', type: 'subheader' },
    { id: 'cash_bank_balances', label: 'Cash and bank balances', type: 'item', isEditable: true },
    { id: 'inventories', label: 'Inventories', type: 'item', isEditable: true },
    { id: 'trade_receivables', label: 'Trade receivables', type: 'item', isEditable: true },
    { id: 'advances_deposits_receivables', label: 'Advances, deposits and other receivables', type: 'item', isEditable: true },
    { id: 'related_party_transactions_assets', label: 'Related party transactions', type: 'item', isEditable: true },
    { id: 'total_current_assets', label: 'Total current assets', type: 'total', isEditable: true },

    { id: 'total_assets', label: 'Total assets', type: 'grand_total', isEditable: true },

    // Equity and Liabilities
    { id: 'equity_liabilities_header', label: 'Equity and liabilities', type: 'header' },

    { id: 'equity_header', label: 'Equity', type: 'subheader' },
    { id: 'share_capital', label: 'Share capital', type: 'item', isEditable: true },
    { id: 'statutory_reserve', label: 'Statutory reserve', type: 'item', isEditable: true },
    { id: 'retained_earnings', label: 'Retained earnings', type: 'item', isEditable: true },
    { id: 'shareholders_current_accounts', label: "Shareholders' current accounts:", type: 'item', isEditable: true },
    { id: 'total_equity', label: 'Total equity', type: 'total', isEditable: true },

    { id: 'non_current_liabilities_header', label: 'Non-current liabilities', type: 'subheader' },
    { id: 'employees_end_service_benefits', label: "Employees' end of service benefits", type: 'item', isEditable: true },
    { id: 'bank_borrowings_non_current', label: 'Bank borrowings - non current portion', type: 'item', isEditable: true },
    { id: 'total_non_current_liabilities', label: 'Total non-current liabilities', type: 'total', isEditable: true },

    { id: 'current_liabilities_header', label: 'Current liabilities', type: 'subheader' },
    { id: 'short_term_borrowings', label: 'Short term borrowings', type: 'item', isEditable: true },
    { id: 'related_party_transactions_liabilities', label: 'Related party transactions', type: 'item', isEditable: true },
    { id: 'trade_other_payables', label: 'Trade and other payables', type: 'item', isEditable: true },
    { id: 'total_current_liabilities', label: 'Total current liabilities', type: 'total', isEditable: true },

    { id: 'total_liabilities', label: 'Total liabilities', type: 'total', isEditable: true },

    { id: 'total_equity_liabilities', label: 'Total equity and liabilities', type: 'grand_total', isEditable: true },
];

export const BalanceSheetStep: React.FC<BalanceSheetStepProps> = ({ onNext, onBack, data, onChange, onExport, structure = BS_ITEMS, onAddAccount, workingNotes, onUpdateWorkingNotes }) => {

    const [showAddModal, setShowAddModal] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountSection, setNewAccountSection] = useState('');

    const formatNumberInput = (amount?: number) => {
        if (amount === undefined || amount === null) return '';
        if (Math.abs(amount) < 0.5) return '';
        return Math.round(amount).toFixed(0);
    };

    // Working Notes State
    const [showWorkingNoteModal, setShowWorkingNoteModal] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);
    const [currentWorkingLabel, setCurrentWorkingLabel] = useState<string>('');
    const [tempWorkingNotes, setTempWorkingNotes] = useState<WorkingNoteEntry[]>([]);

    const handleOpenWorkingNote = (item: BalanceSheetItem) => {
        setCurrentWorkingAccount(item.id);
        setCurrentWorkingLabel(item.label);
        const existingNotes = workingNotes?.[item.id] || [];
        setTempWorkingNotes(existingNotes.length > 0 ? existingNotes : [{ description: '', amount: 0 }]);
        setShowWorkingNoteModal(true);
    };

    const handleWorkingNoteChange = (index: number, field: keyof WorkingNoteEntry, value: string | number) => {
        setTempWorkingNotes(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    };

    const handleAddWorkingNoteRow = () => {
        setTempWorkingNotes(prev => [...prev, { description: '', amount: 0 }]);
    };

    const handleRemoveWorkingNoteRow = (index: number) => {
        setTempWorkingNotes(prev => prev.filter((_, i) => i !== index));
    };

    const saveWorkingNote = () => {
        if (currentWorkingAccount && onUpdateWorkingNotes) {
            const valid = tempWorkingNotes.filter(n => n.description.trim() !== '' || n.amount !== 0);
            onUpdateWorkingNotes(currentWorkingAccount, valid);
            setShowWorkingNoteModal(false);
        }
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccountName && newAccountSection && onAddAccount) {
            const newItem: BalanceSheetItem & { sectionId: string } = {
                id: newAccountName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
                label: newAccountName,
                type: 'item',
                isEditable: true,
                sectionId: newAccountSection
            };
            onAddAccount(newItem);
            setShowAddModal(false);
            setNewAccountName('');
            setNewAccountSection('');
        }
    };

    const sections = structure.filter(i => i.type === 'header' || i.type === 'subheader');

    const handleInputChange = (id: string, year: 'currentYear' | 'previousYear', inputValue: string) => {
        const val = Math.round(parseFloat(inputValue));
        if (!isNaN(val)) {
            onChange(id, year, val);
        } else if (inputValue === '' || inputValue === '-') {
            onChange(id, year, 0);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10 w-full">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 shrink-0">
                    <span className="bg-blue-600 w-1.5 h-6 rounded-full"></span>
                    Statement of Financial Position
                </h2>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center px-3 py-1.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-bold rounded-lg transition-colors border border-blue-600/30 whitespace-nowrap text-xs"
                    >
                        <PlusIcon className="w-4 h-4 mr-1.5" />
                        Add Account
                    </button>
                    <button
                        onClick={onExport}
                        className="flex items-center px-3 py-1.5 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors border border-gray-700 shadow-sm whitespace-nowrap text-xs"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" />
                        Export
                    </button>
                    <button
                        onClick={onBack}
                        className="flex items-center px-3 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-700 whitespace-nowrap text-xs font-bold"
                    >
                        <ChevronLeftIcon className="w-4 h-4 mr-1" />
                        Back
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/30 whitespace-nowrap text-xs"
                    >
                        Confirm & Continue
                        <ArrowRightIcon className="w-4 h-4 ml-1.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-[#0a0f1a] custom-scrollbar">
                <div className="bg-gray-900 text-white max-w-5xl mx-auto shadow-xl ring-1 ring-gray-800 rounded-lg min-h-[800px] relative">
                    <div className="p-12">
                        <div className="space-y-2">
                            {structure.map((item) => (
                                <div
                                    key={item.id}
                                    className={`
                                        flex items-center justify-between py-2 border-b border-transparent hover:bg-gray-800/20 px-4 transition-colors rounded group
                                        ${item.type === 'header' ? 'text-xl font-black text-white mt-8 mb-4 border-b-2 border-gray-700 pb-2 uppercase tracking-wide' : ''}
                                        ${item.type === 'subheader' ? 'text-lg italic text-blue-200 mt-6 mb-2 pl-4 font-semibold' : ''}
                                        ${item.type === 'total' ? 'font-bold text-white mt-2 border-t border-gray-600 pt-3 pb-2 bg-gray-800/30' : ''}
                                        ${item.type === 'grand_total' ? 'text-xl font-black text-white mt-6 border-t-4 border-double border-blue-500 pt-4 pb-4 bg-blue-900/10' : ''}
                                        ${item.type === 'item' ? 'text-gray-300 font-normal pl-8' : ''}
                                    `}
                                >
                                    <div className="flex-1 flex items-center justify-between mr-4">
                                        <span>{item.label}</span>
                                        {(item.type === 'item' || item.type === 'total') && onUpdateWorkingNotes && (
                                            <button
                                                onClick={() => handleOpenWorkingNote(item)}
                                                className={`p-1 rounded transition-all ${workingNotes?.[item.id]?.length ? 'text-blue-400 bg-blue-900/20 opacity-100' : 'text-gray-600 hover:text-gray-400 opacity-0 group-hover:opacity-100'}`}
                                                title="Working Notes"
                                            >
                                                <ListBulletIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {(item.type === 'item' || item.type === 'total' || item.type === 'grand_total') && (
                                        <div className="flex gap-4">
                                            {/* Current Year Column */}
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === 'property_plant_equipment' && (
                                                    <div className="text-[10px] text-gray-500 uppercase mb-1 font-bold tracking-wider">Current Year</div>
                                                )}
                                                {item.isEditable ? (
                                                    <div className="relative group/input">
                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-600 text-xs group-focus-within/input:text-blue-400 transition-colors pointer-events-none">AED</span>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={data[item.id]?.currentYear !== undefined ? Math.round(data[item.id]?.currentYear) : ''}
                                                            onChange={(e) => handleInputChange(item.id, 'currentYear', e.target.value)}
                                                            disabled={!!(workingNotes?.[item.id]?.length)}
                                                            className={`
                                                                w-full text-right bg-transparent border-b border-gray-700 outline-none py-1 px-1 font-mono text-white
                                                                ${!!(workingNotes?.[item.id]?.length) ? 'opacity-70 cursor-not-allowed' : 'focus:border-blue-500 group-hover/input:border-gray-600'}
                                                                transition-colors placeholder-gray-700
                                                                ${item.type === 'total' || item.type === 'grand_total' ? 'font-bold' : ''}
                                                            `}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-gray-600">-</span>
                                                )}
                                            </div>

                                            {/* Previous Year Column */}
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === 'property_plant_equipment' && (
                                                    <div className="text-[10px] text-gray-500 uppercase mb-1 font-bold tracking-wider">Previous Year</div>
                                                )}
                                                {item.isEditable ? (
                                                    <div className="relative group/input">
                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-600 text-xs group-focus-within/input:text-blue-400 transition-colors pointer-events-none">AED</span>
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            value={formatNumberInput(data[item.id]?.previousYear)}
                                                            onChange={(e) => handleInputChange(item.id, 'previousYear', e.target.value)}
                                                            disabled={!!(workingNotes?.[item.id]?.length)}
                                                            className={`
                                                                w-full text-right bg-transparent border-b border-gray-700 outline-none py-1 px-1 font-mono text-white
                                                                ${!!(workingNotes?.[item.id]?.length) ? 'opacity-70 cursor-not-allowed' : 'focus:border-blue-500 group-hover/input:border-gray-600'}
                                                                transition-colors placeholder-gray-700
                                                                ${item.type === 'total' || item.type === 'grand_total' ? 'font-bold' : ''}
                                                            `}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="font-mono text-gray-600">-</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800 text-center text-gray-500 text-sm">
                Please ensure Total Assets match Total Equity and Liabilities.
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-white">Add New Account</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Section</label>
                                    <select
                                        value={newAccountSection}
                                        onChange={(e) => setNewAccountSection(e.target.value)}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                        required
                                    >
                                        <option value="">Select a section...</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Account Name</label>
                                    <input
                                        type="text"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                        placeholder="e.g. Loans from Shareholders"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-gray-800/50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white font-semibold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-colors"
                                >
                                    Add Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showWorkingNoteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <div>
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <ListBulletIcon className="w-5 h-5 text-blue-500" />
                                    Working Notes
                                </h3>
                                <p className="text-sm text-gray-400 mt-1">Breakdown for <span className="text-blue-400 font-semibold">{currentWorkingLabel}</span></p>
                            </div>
                            <button onClick={() => setShowWorkingNoteModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-gray-900/50">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-800/50 border-b border-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 w-3/5">Description</th>
                                        <th className="px-4 py-3 text-right w-1/5">Amount (AED)</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {tempWorkingNotes.map((note, idx) => (
                                        <tr key={idx} className="group hover:bg-gray-800/30">
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={note.description}
                                                    onChange={(e) => handleWorkingNoteChange(idx, 'description', e.target.value)}
                                                    className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-3 py-1.5 text-gray-200 outline-none transition-colors"
                                                    placeholder="Description..."
                                                    autoFocus={idx === tempWorkingNotes.length - 1 && !note.description}
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={formatNumberInput(note.amount)}
                                                    onChange={(e) => handleWorkingNoteChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-3 py-1.5 text-right text-gray-200 outline-none transition-colors font-mono"
                                                    placeholder="0"
                                                    step="1"
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button
                                                    onClick={() => handleRemoveWorkingNoteRow(idx)}
                                                    className="text-gray-600 hover:text-red-400 p-1.5 rounded transition-colors"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={3} className="pt-4">
                                            <button
                                                onClick={handleAddWorkingNoteRow}
                                                className="flex items-center text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wide"
                                            >
                                                <PlusIcon className="w-4 h-4 mr-1" /> Add Row
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="p-4 border-t border-gray-800 bg-gray-950 flex justify-between items-center">
                            <div className="text-sm">
                                <span className="text-gray-500 mr-2">Total:</span>
                                <span className="font-mono font-bold text-white text-lg">
                                    {tempWorkingNotes.reduce((sum, n) => sum + (n.amount || 0), 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowWorkingNoteModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white font-semibold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveWorkingNote}
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-colors shadow-lg shadow-blue-900/20"
                                >
                                    Save Notes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
