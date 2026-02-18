import React, { useState, useEffect } from 'react';
import type { WorkingNoteEntry } from '../types';
import { ArrowRightIcon, ChevronLeftIcon, DocumentArrowDownIcon, PlusIcon, XMarkIcon, ListBulletIcon, TrashIcon } from './icons';

const formatWholeNumber = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.round(amount || 0));
};

const StableNumberInput = ({
    value,
    onChange,
    className,
    placeholder,
    prefix = "AED"
}: {
    value: number | string,
    onChange: (val: string) => void,
    className: string,
    placeholder: string,
    prefix?: string
}) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : (value === '' ? '' : value.toString()));

    useEffect(() => {
        const externalStr = value === 0 ? '' : (value === '' ? '' : value.toString());
        if (externalStr !== localValue && parseFloat(externalStr) !== parseFloat(localValue)) {
            setLocalValue(externalStr);
        }
    }, [value]);

    return (
        <div className="relative group/input">
            {prefix && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground text-xs group-focus-within/input:text-primary transition-colors pointer-events-none">
                    {prefix}
                </span>
            )}
            <input
                type="number"
                step="1"
                value={localValue}
                onChange={(e) => {
                    setLocalValue(e.target.value);
                    onChange(e.target.value);
                }}
                className={className}
                placeholder={placeholder}
                onBlur={() => {
                    setLocalValue(value === 0 ? '' : (value === '' ? '' : value.toString()));
                }}
            />
        </div>
    );
};

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
    { id: 'assets_header', label: 'Assets', type: 'header' },
    { id: 'non_current_assets_header', label: 'Non-current assets', type: 'subheader' },
    { id: 'property_plant_equipment', label: 'Property, plant and equipment', type: 'item', isEditable: true },
    { id: 'intangible_assets', label: 'Intangible assets', type: 'item', isEditable: true },
    { id: 'long_term_investments', label: 'Long-term investments', type: 'item', isEditable: true },
    { id: 'total_non_current_assets', label: 'Total non current assets', type: 'total', isEditable: false },
    { id: 'current_assets_header', label: 'Current assets', type: 'subheader' },
    { id: 'cash_bank_balances', label: 'Cash and bank balances', type: 'item', isEditable: true },
    { id: 'inventories', label: 'Inventories', type: 'item', isEditable: true },
    { id: 'trade_receivables', label: 'Trade receivables', type: 'item', isEditable: true },
    { id: 'advances_deposits_receivables', label: 'Advances, deposits and other receivables', type: 'item', isEditable: true },
    { id: 'related_party_transactions_assets', label: 'Related party transactions', type: 'item', isEditable: true },
    { id: 'total_current_assets', label: 'Total current assets', type: 'total', isEditable: false },
    { id: 'total_assets', label: 'Total assets', type: 'grand_total', isEditable: false },
    { id: 'equity_liabilities_header', label: 'Equity and liabilities', type: 'header' },
    { id: 'equity_header', label: 'Equity', type: 'subheader' },
    { id: 'share_capital', label: 'Share capital', type: 'item', isEditable: true },
    { id: 'statutory_reserve', label: 'Statutory reserve', type: 'item', isEditable: true },
    { id: 'retained_earnings', label: 'Retained earnings', type: 'item', isEditable: true },
    { id: 'shareholders_current_accounts', label: "Shareholders' current accounts:", type: 'item', isEditable: true },
    { id: 'total_equity', label: 'Total equity', type: 'total', isEditable: false },
    { id: 'non_current_liabilities_header', label: 'Non-current liabilities', type: 'subheader' },
    { id: 'employees_end_service_benefits', label: "Employees' end of service benefits", type: 'item', isEditable: true },
    { id: 'bank_borrowings_non_current', label: 'Bank borrowings - non current portion', type: 'item', isEditable: true },
    { id: 'total_non_current_liabilities', label: 'Total non-current liabilities', type: 'total', isEditable: false },
    { id: 'current_liabilities_header', label: 'Current liabilities', type: 'subheader' },
    { id: 'short_term_borrowings', label: 'Short term borrowings', type: 'item', isEditable: true },
    { id: 'related_party_transactions_liabilities', label: 'Related party transactions', type: 'item', isEditable: true },
    { id: 'trade_other_payables', label: 'Trade and other payables', type: 'item', isEditable: true },
    { id: 'total_current_liabilities', label: 'Total current liabilities', type: 'total', isEditable: false },
    { id: 'total_liabilities', label: 'Total liabilities', type: 'total', isEditable: false },
    { id: 'total_equity_liabilities', label: 'Total equity and liabilities', type: 'grand_total', isEditable: false },
];

export const BalanceSheetStep: React.FC<BalanceSheetStepProps> = ({ onNext, onBack, data, onChange, onExport, structure = BS_ITEMS, onAddAccount, workingNotes, onUpdateWorkingNotes }) => {

    const [showAddModal, setShowAddModal] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountSection, setNewAccountSection] = useState('');

    // Working Notes State
    const [showWorkingNoteModal, setShowWorkingNoteModal] = useState(false);
    const [currentWorkingAccount, setCurrentWorkingAccount] = useState<string | null>(null);
    const [currentWorkingLabel, setCurrentWorkingLabel] = useState<string>('');
    const [tempWorkingNotes, setTempWorkingNotes] = useState<WorkingNoteEntry[]>([]);

    const normalizeWorkingNotes = (notes: WorkingNoteEntry[]) => {
        return notes.map(note => {
            const currentYearAmount = note.currentYearAmount ?? note.amount ?? 0;
            const previousYearAmount = note.previousYearAmount ?? 0;
            return {
                ...note,
                currentYearAmount,
                previousYearAmount,
                amount: note.amount ?? currentYearAmount
            };
        });
    };

    const handleOpenWorkingNote = (item: BalanceSheetItem) => {
        setCurrentWorkingAccount(item.id);
        setCurrentWorkingLabel(item.label);
        const existingNotes = workingNotes?.[item.id] || [];
        setTempWorkingNotes(
            existingNotes.length > 0
                ? normalizeWorkingNotes(existingNotes.map(n => ({
                    ...n,
                    currentYearAmount: n.currentYearAmount ?? n.amount ?? 0,
                    previousYearAmount: n.previousYearAmount ?? 0
                })))
                : [{ description: '', currentYearAmount: 0, previousYearAmount: 0, amount: 0 }]
        );
        setShowWorkingNoteModal(true);
    };

    const handleWorkingNoteChange = (index: number, field: keyof WorkingNoteEntry, value: string | number) => {
        setTempWorkingNotes(prev => {
            const updated = [...prev];
            const next = { ...updated[index], [field]: value };
            if (field === 'currentYearAmount' && typeof value === 'number') {
                next.amount = value;
            }
            updated[index] = next;

            if (currentWorkingAccount && onUpdateWorkingNotes) {
                onUpdateWorkingNotes(currentWorkingAccount, updated.filter(n =>
                    n.description.trim() !== '' ||
                    (n.currentYearAmount !== undefined && n.currentYearAmount !== 0) ||
                    (n.previousYearAmount !== undefined && n.previousYearAmount !== 0)
                ).map(n => ({ ...n, amount: n.currentYearAmount || 0 })));
            }
            return updated;
        });
    };

    const handleAddWorkingNoteRow = () => {
        setTempWorkingNotes(prev => [...prev, { description: '', currentYearAmount: 0, previousYearAmount: 0, amount: 0 }]);
    };

    const handleRemoveWorkingNoteRow = (index: number) => {
        setTempWorkingNotes(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (currentWorkingAccount && onUpdateWorkingNotes) {
                onUpdateWorkingNotes(currentWorkingAccount, updated.filter(n =>
                    n.description.trim() !== '' ||
                    (n.currentYearAmount !== undefined && n.currentYearAmount !== 0) ||
                    (n.previousYearAmount !== undefined && n.previousYearAmount !== 0)
                ).map(n => ({ ...n, amount: n.currentYearAmount || 0 })));
            }
            return updated;
        });
    };

    const saveWorkingNote = () => {
        if (currentWorkingAccount && onUpdateWorkingNotes) {
            const valid = tempWorkingNotes.filter(n =>
                n.description.trim() !== '' ||
                (n.currentYearAmount !== undefined && n.currentYearAmount !== 0) ||
                (n.previousYearAmount !== undefined && n.previousYearAmount !== 0)
            ).map(n => ({ ...n, amount: n.currentYearAmount || 0 }));
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

    const handleInputChange = (id: string, year: 'currentYear' | 'previousYear', inputValue: string) => {
        const val = Math.round(parseFloat(inputValue));
        if (!isNaN(val)) {
            onChange(id, year, val);
        } else if (inputValue === '' || inputValue === '-') {
            onChange(id, year, 0);
        }
    };

    const sections = structure.filter(i => i.type === 'header' || i.type === 'subheader');
    const totalAssets = Math.round(data['total_assets']?.currentYear || 0);
    const totalEqLiab = Math.round(data['total_equity_liabilities']?.currentYear || 0);
    const isBalanced = Math.abs(totalAssets - totalEqLiab) < 1;
    const balanceDiff = Math.abs(totalAssets - totalEqLiab);

    return (
        <div className="w-full max-w-6xl mx-auto bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-card z-10 w-full">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2 shrink-0">
                        <span className="bg-primary w-1.5 h-6 rounded-full"></span>
                        Statement of Financial Position
                    </h2>
                    {!isBalanced && (
                        <div className="flex items-center gap-2 mt-1 text-destructive text-xs font-bold animate-pulse">
                            <XMarkIcon className="w-3 h-3" />
                            Out of Balance: {balanceDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AED Difference
                        </div>
                    )}
                    {isBalanced && totalAssets !== 0 && (
                        <div className="flex items-center gap-2 mt-1 text-emerald-500 text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Balance Sheet is Balanced
                        </div>
                    )}
                </div>
                <div className="flex gap-2 shrink-0">
                    <button onClick={() => setShowAddModal(true)} className="flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors border border-primary/20 whitespace-nowrap text-xs">
                        <PlusIcon className="w-4 h-4 mr-1.5" /> Add Account
                    </button>
                    <button onClick={onExport} className="flex items-center px-3 py-1.5 bg-muted text-foreground font-bold rounded-lg hover:bg-muted/80 transition-colors border border-border shadow-sm whitespace-nowrap text-xs">
                        <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" /> Export
                    </button>
                    <button onClick={onBack} className="flex items-center px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border whitespace-nowrap text-xs font-bold">
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
                    </button>
                    <button onClick={onNext} disabled={!isBalanced} className={`flex items-center px-4 py-1.5 font-bold rounded-lg transition-all shadow-lg whitespace-nowrap text-xs ${isBalanced ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-primary/30' : 'bg-muted text-muted-foreground cursor-not-allowed grayscale'}`}>
                        Confirm & Continue <ArrowRightIcon className="w-4 h-4 ml-1.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-background custom-scrollbar">
                <div className="bg-card text-foreground max-w-5xl mx-auto shadow-xl ring-1 ring-border rounded-lg min-h-[800px] relative">
                    <div className="p-12">
                        <div className="space-y-2">
                            {structure.map((item) => (
                                <div key={item.id} className={`flex items-center justify-between py-2 border-b border-transparent hover:bg-muted/20 px-4 transition-colors rounded group
                                        ${item.type === 'header' ? 'text-xl font-black text-foreground mt-8 mb-4 border-b-2 border-border pb-2 uppercase tracking-wide' : ''}
                                        ${item.type === 'subheader' ? 'text-lg italic text-primary mt-6 mb-2 pl-4 font-semibold' : ''}
                                        ${item.type === 'total' ? 'font-bold text-foreground mt-2 border-t border-border pt-3 pb-2 bg-muted/30' : ''}
                                        ${item.type === 'grand_total' ? 'text-xl font-black text-foreground mt-6 border-t-4 border-double border-primary pt-4 pb-4 bg-primary/10' : ''}
                                        ${item.type === 'item' ? 'text-muted-foreground font-normal pl-8' : ''}`}>
                                    <div className="flex-1 flex items-center justify-between mr-4">
                                        <span>{item.label}</span>
                                        {(item.type === 'item' || item.type === 'total') && onUpdateWorkingNotes && (
                                            <button onClick={() => handleOpenWorkingNote(item)} className={`p-1 rounded transition-all ${workingNotes?.[item.id]?.length ? 'text-primary bg-primary/10 opacity-100' : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'}`} title="Working Notes">
                                                <ListBulletIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                    {(item.type === 'item' || item.type === 'total' || item.type === 'grand_total') && (
                                        <div className="flex gap-4">
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === 'property_plant_equipment' && <div className="text-[10px] text-muted-foreground uppercase mb-1 font-bold tracking-wider">Current Year</div>}
                                                {item.isEditable ? (
                                                    <StableNumberInput value={data[item.id]?.currentYear ?? ''} onChange={(val) => handleInputChange(item.id, 'currentYear', val)} className="w-full text-right bg-transparent border-b border-border outline-none py-1 px-1 font-mono text-foreground focus:border-primary group-hover/input:border-muted-foreground transition-colors placeholder-muted-foreground/30" placeholder="0" />
                                                ) : (
                                                    <span className="font-mono text-foreground text-lg font-bold">
                                                        {formatWholeNumber(data[item.id]?.currentYear || 0)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === 'property_plant_equipment' && <div className="text-[10px] text-muted-foreground uppercase mb-1 font-bold tracking-wider">Previous Year</div>}
                                                {item.isEditable ? (
                                                    <StableNumberInput value={data[item.id]?.previousYear ?? ''} onChange={(val) => handleInputChange(item.id, 'previousYear', val)} className="w-full text-right bg-transparent border-b border-border outline-none py-1 px-1 font-mono text-foreground focus:border-primary group-hover/input:border-muted-foreground transition-colors placeholder-muted-foreground/30" placeholder="0" />
                                                ) : (
                                                    <span className="font-mono text-muted-foreground/70">
                                                        {formatWholeNumber(data[item.id]?.previousYear || 0)}
                                                    </span>
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

            <div className={`p-4 border-t border-border text-center transition-colors ${!isBalanced ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground'}`}>
                {!isBalanced ? <div className="flex items-center justify-center gap-2 font-bold animate-pulse"><XMarkIcon className="w-5 h-5" /> Balance Sheet Error: Total Assets must equal Total Equity & Liabilities. (Difference: {balanceDiff.toLocaleString()} AED)</div> : <div className="text-sm">Please ensure Total Assets match Total Equity and Liabilities.</div>}
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/50">
                            <h3 className="text-lg font-bold text-foreground">Add New Account</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Section</label>
                                    <select value={newAccountSection} onChange={(e) => setNewAccountSection(e.target.value)} className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary outline-none" required>
                                        <option value="">Select a section...</option>
                                        {sections.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Account Name</label>
                                    <input type="text" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. Loans from Shareholders" required />
                                </div>
                            </div>
                            <div className="p-4 bg-muted/50 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm">Cancel</button>
                                <button type="submit" className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-colors shadow-lg">Add Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showWorkingNoteModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/50">
                            <div>
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><ListBulletIcon className="w-5 h-5 text-primary" /> Working Notes</h3>
                                <p className="text-sm text-muted-foreground mt-1">Breakdown for <span className="text-primary font-semibold">{currentWorkingLabel}</span></p>
                            </div>
                            <button onClick={() => setShowWorkingNoteModal(false)} className="text-muted-foreground hover:text-foreground transition-colors"><XMarkIcon className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-background">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 w-[45%]">Description</th>
                                        <th className="px-4 py-3 text-right w-[20%]">Current Year (AED)</th>
                                        <th className="px-4 py-3 text-right w-[20%]">Previous Year (AED)</th>
                                        <th className="px-4 py-3 w-[15%]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {tempWorkingNotes.map((note, idx) => (
                                        <tr key={idx} className="group hover:bg-muted/30">
                                            <td className="p-2">
                                                <input type="text" value={note.description} onChange={(e) => handleWorkingNoteChange(idx, 'description', e.target.value)} className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-foreground outline-none transition-colors" placeholder="Description..." />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={note.currentYearAmount === 0 ? '' : note.currentYearAmount} onChange={(e) => handleWorkingNoteChange(idx, 'currentYearAmount', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-right text-foreground outline-none transition-colors font-mono" placeholder="0" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={note.previousYearAmount === 0 ? '' : note.previousYearAmount} onChange={(e) => handleWorkingNoteChange(idx, 'previousYearAmount', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-right text-foreground outline-none transition-colors font-mono" placeholder="0" />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveWorkingNoteRow(idx)} className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={4} className="pt-4">
                                            <button onClick={handleAddWorkingNoteRow} className="flex items-center text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wide"><PlusIcon className="w-4 h-4 mr-1" /> Add Row</button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/50 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <div className="text-xs flex items-center gap-2"><span className="text-muted-foreground">Current Year Total:</span> <span className="font-mono font-bold text-foreground">{tempWorkingNotes.reduce((sum, n) => sum + (n.currentYearAmount || 0), 0).toFixed(0)}</span></div>
                                <div className="text-xs flex items-center gap-2"><span className="text-muted-foreground">Previous Year Total:</span> <span className="font-mono font-bold text-foreground">{tempWorkingNotes.reduce((sum, n) => sum + (n.previousYearAmount || 0), 0).toFixed(0)}</span></div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowWorkingNoteModal(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm">Cancel</button>
                                <button onClick={saveWorkingNote} className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-colors shadow-lg">Save Notes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
