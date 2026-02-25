import React, { useState, useEffect } from 'react';
import { ArrowRightIcon, ChevronLeftIcon, DocumentArrowDownIcon, PlusIcon, XMarkIcon, ListBulletIcon, TrashIcon } from './icons';
import type { WorkingNoteEntry } from '../types';

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
    // Local state to hold the string representation while typing
    const [localValue, setLocalValue] = useState(value === 0 ? '' : (value === '' ? '' : value.toString()));

    // Keep local value in sync with external changes, but avoid overriding while typing
    useEffect(() => {
        const externalStr = value === 0 ? '' : (value === '' ? '' : value.toString());
        if (externalStr !== localValue && parseFloat(externalStr) !== parseFloat(localValue)) {
            setLocalValue(externalStr);
        }
    }, [value]);

    return (
        <div className="relative group/input">
            {prefix && (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs group-focus-within/input:text-primary transition-colors pointer-events-none">
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
                    // Sync back to standard format on blur
                    setLocalValue(value === 0 ? '' : (value === '' ? '' : value.toString()));
                }}
            />
        </div>
    );
};

export interface ProfitAndLossItem {
    id: string;
    label: string;
    type: 'header' | 'item' | 'total' | 'subsection_header';
    indent?: boolean;
    isEditable?: boolean;
}

interface ProfitAndLossStepProps {
    onNext: () => void;
    onBack: () => void;
    data: Record<string, { currentYear: number; previousYear: number }>;
    onChange: (id: string, year: 'currentYear' | 'previousYear', value: number) => void;
    onExport: () => void;
    structure?: ProfitAndLossItem[];
    onAddAccount?: (item: ProfitAndLossItem & { sectionId: string }) => void;
    workingNotes?: Record<string, WorkingNoteEntry[]>;
    onUpdateWorkingNotes?: (id: string, notes: WorkingNoteEntry[]) => void;
    displayCurrency?: string;
    secondaryCurrency?: string;
    exchangeRateToDisplay?: number;
    showSecondaryConverted?: boolean;
}

export const PNL_ITEMS: ProfitAndLossItem[] = [
    { id: 'revenue', label: 'Revenue', type: 'item', isEditable: true },
    { id: 'cost_of_revenue', label: 'Cost of revenue', type: 'item', isEditable: true },
    { id: 'gross_profit', label: 'Gross profit', type: 'total', isEditable: true },

    { id: 'other_income', label: 'Other income', type: 'item', isEditable: true },
    { id: 'unrealised_gain_loss_fvtpl', label: 'Unrealised gain/(loss) on investments at fair value through profit or loss (FVTPL)', type: 'item', isEditable: true },
    { id: 'share_profits_associates', label: 'Share of profits of associates', type: 'item', isEditable: true },
    { id: 'gain_loss_revaluation_property', label: 'Gain/(loss) on revaluation of investment property', type: 'item', isEditable: true },
    { id: 'impairment_losses_ppe', label: 'Impairment losses on property, plant and equipment', type: 'item', isEditable: true },
    { id: 'impairment_losses_intangible', label: 'Impairment losses on intangible assets', type: 'item', isEditable: true },
    { id: 'business_promotion_selling', label: 'Business Promotion & Selling Expenses', type: 'item', isEditable: true },
    { id: 'foreign_exchange_loss', label: 'Foreign Exchange Loss', type: 'item', isEditable: true },
    { id: 'selling_distribution_expenses', label: 'Selling and distribution expenses', type: 'item', isEditable: true },
    { id: 'administrative_expenses', label: 'Administrative expenses', type: 'item', isEditable: true },
    { id: 'finance_costs', label: 'Finance costs', type: 'item', isEditable: true },
    { id: 'depreciation_ppe', label: 'Depreciation on property, plant and equipment', type: 'item', isEditable: true },

    { id: 'profit_loss_year', label: 'Profit / (loss) for the year', type: 'total', isEditable: true },

    { id: 'other_comprehensive_income', label: 'Other comprehensive income', type: 'header' },
    { id: 'items_not_reclassified', label: 'Items that will not be reclassified subsequently to profit or loss', type: 'subsection_header', indent: true },
    { id: 'gain_revaluation_property', label: 'Gain on revaluation of property', type: 'item', indent: true, isEditable: true },
    { id: 'share_gain_loss_revaluation_associates', label: 'Share of gain/(loss) on property revaluation of associates', type: 'item', indent: true, isEditable: true },

    { id: 'items_may_reclassified', label: 'Items that may be reclassified subsequently to profit or loss', type: 'subsection_header', indent: true },
    { id: 'changes_fair_value_available_sale', label: 'Changes in fair value of available-for-sale investments', type: 'item', indent: true, isEditable: true },
    { id: 'changes_fair_value_available_sale_reclassified', label: 'Changes in fair value of available-for-sale investments reclassified to profit or loss', type: 'item', indent: true, isEditable: true },
    { id: 'exchange_difference_translating', label: 'Exchange difference on translating foreign operation', type: 'item', indent: true, isEditable: true },

    { id: 'total_comprehensive_income', label: 'Total comprehensive income/ (loss) for the year', type: 'total', isEditable: true },

    { id: 'provisions_corporate_tax', label: 'Provisions for corporate tax', type: 'item', isEditable: true },
    { id: 'profit_after_tax', label: 'Profit after Tax', type: 'item', isEditable: true },
];

export const ProfitAndLossStep: React.FC<ProfitAndLossStepProps> = ({
    onNext, onBack, data, onChange, onExport, structure = PNL_ITEMS, onAddAccount, workingNotes, onUpdateWorkingNotes, displayCurrency = 'AED',
    secondaryCurrency, exchangeRateToDisplay = 1, showSecondaryConverted = false
}) => {

    const [showAddModal, setShowAddModal] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountSection, setNewAccountSection] = useState('');

    const formatNumberInput = (amount?: number) => {
        if (amount === undefined || amount === null) return '';
        if (Math.abs(amount) < 0.5) return '';
        return Math.round(amount).toFixed(0);
    };

    const formatSecondaryValue = (amount?: number) => {
        if (!showSecondaryConverted || !secondaryCurrency || secondaryCurrency === displayCurrency) return null;
        if (!Number.isFinite(exchangeRateToDisplay) || exchangeRateToDisplay <= 0) return null;
        const safeAmount = Number(amount ?? 0) || 0;
        const originalValue = safeAmount / exchangeRateToDisplay;
        return `${secondaryCurrency} ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(originalValue)}`;
    };

    const renderSecondaryLine = (amount?: number) => {
        const text = formatSecondaryValue(amount);
        if (!text) return null;
        return <div className="text-[10px] text-muted-foreground mt-1 text-right">({text})</div>;
    };

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

    const handleOpenWorkingNote = (item: ProfitAndLossItem) => {
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

            // Sync to parent real-time
            if (currentWorkingAccount && onUpdateWorkingNotes) {
                onUpdateWorkingNotes(currentWorkingAccount, updated.filter(n =>
                    n.description.trim() !== '' ||
                    (n.currentYearAmount !== undefined && n.currentYearAmount !== 0) ||
                    (n.previousYearAmount !== undefined && n.previousYearAmount !== 0)
                ).map(n => ({
                    ...n,
                    amount: n.currentYearAmount || 0
                })));
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
                ).map(n => ({
                    ...n,
                    amount: n.currentYearAmount || 0
                })));
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
            ).map(n => ({
                ...n,
                amount: n.currentYearAmount || 0
            }));
            onUpdateWorkingNotes(currentWorkingAccount, valid);
            setShowWorkingNoteModal(false);
        }
    };

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccountName && newAccountSection && onAddAccount) {
            const newItem: ProfitAndLossItem & { sectionId: string } = {
                id: newAccountName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
                label: newAccountName,
                type: 'item',
                isEditable: true,
                sectionId: newAccountSection,
                indent: true
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

    const sections = structure.filter(i => i.type === 'header' || i.type === 'subsection_header' || i.type === 'total');

    return (
        <div className="w-full max-w-6xl mx-auto bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-card z-10 w-full">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2 shrink-0">
                    <span className="bg-primary w-1.5 h-6 rounded-full"></span>
                    Profit & Loss Statement
                </h2>
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors border border-primary/20 whitespace-nowrap text-xs"
                    >
                        <PlusIcon className="w-4 h-4 mr-1.5" />
                        Add Account
                    </button>
                    <button
                        onClick={onExport}
                        className="flex items-center px-3 py-1.5 bg-muted text-foreground font-bold rounded-lg hover:bg-muted/80 transition-colors border border-border shadow-sm whitespace-nowrap text-xs"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" />
                        Export
                    </button>
                    <button
                        onClick={onBack}
                        className="flex items-center px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border whitespace-nowrap text-xs font-bold"
                    >
                        <ChevronLeftIcon className="w-4 h-4 mr-1" />
                        Back
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-all shadow-lg hover:shadow-primary/30 whitespace-nowrap text-xs"
                    >
                        Confirm & Continue
                        <ArrowRightIcon className="w-4 h-4 ml-1.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-background custom-scrollbar">
                <div className="bg-card text-foreground max-w-5xl mx-auto shadow-xl ring-1 ring-border rounded-lg min-h-[800px] relative">
                    <div className="p-12">
                        <div className="space-y-1">
                            {structure.map((item) => (
                                <div
                                    key={item.id}
                                    className={`
                                        flex items-center justify-between py-3 border-b border-border/50 hover:bg-muted/30 px-3 transition-colors rounded group
                                        ${item.type === 'total' || item.type === 'header' ? 'font-bold text-lg mt-6 mb-2 text-foreground' : 'font-normal text-base text-muted-foreground'}
                                        ${item.type === 'subsection_header' ? 'italic text-muted-foreground/70 mt-4 mb-1' : ''}
                                    `}
                                >
                                    <div className="flex-1 flex items-center justify-between mr-4">
                                        <span className={item.indent ? 'pl-8' : ''}>{item.label}</span>
                                        {(item.type === 'item' || item.type === 'total') && onUpdateWorkingNotes && (
                                            <button
                                                onClick={() => handleOpenWorkingNote(item)}
                                                className={`p-1 rounded transition-all ${workingNotes?.[item.id]?.length ? 'text-primary bg-primary/10 opacity-100' : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'}`}
                                                title="Working Notes"
                                            >
                                                <ListBulletIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    {(item.type === 'item' || item.type === 'total') && (
                                        <div className="flex gap-4">
                                            {/* Current Year Column */}
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === structure[0]?.id && (
                                                    <div className="text-[10px] text-muted-foreground uppercase mb-1 font-bold tracking-wider">Current Year</div>
                                                )}
                                                {item.isEditable ? (
                                                    <>
                                                        <StableNumberInput
                                                            value={data[item.id]?.currentYear ?? ''}
                                                            onChange={(val) => handleInputChange(item.id, 'currentYear', val)}
                                                            className="w-full text-right bg-transparent border-b border-border outline-none py-1.5 px-1 font-mono text-foreground focus:border-primary group-hover/input:border-muted-foreground transition-colors placeholder-muted-foreground/30"
                                                            placeholder="0"
                                                            prefix={displayCurrency}
                                                        />
                                                        {renderSecondaryLine(data[item.id]?.currentYear ?? 0)}
                                                    </>
                                                ) : (
                                                    <span className="font-mono text-muted-foreground/50">-</span>
                                                )}
                                            </div>

                                            {/* Previous Year Column */}
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === structure[0]?.id && (
                                                    <div className="text-[10px] text-muted-foreground uppercase mb-1 font-bold tracking-wider">Previous Year</div>
                                                )}
                                                {item.isEditable ? (
                                                    <>
                                                        <StableNumberInput
                                                            value={data[item.id]?.previousYear ?? ''}
                                                            onChange={(val) => handleInputChange(item.id, 'previousYear', val)}
                                                            className="w-full text-right bg-transparent border-b border-border outline-none py-1.5 px-1 font-mono text-foreground focus:border-primary group-hover/input:border-muted-foreground transition-colors placeholder-muted-foreground/30"
                                                            placeholder="0"
                                                            prefix={displayCurrency}
                                                        />
                                                        {renderSecondaryLine(data[item.id]?.previousYear ?? 0)}
                                                    </>
                                                ) : (
                                                    <span className="font-mono text-muted-foreground/50">-</span>
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

            {showAddModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-border flex justify-between items-center bg-muted/50">
                            <h3 className="text-lg font-bold text-foreground">Add New Account</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Section</label>
                                    <select
                                        value={newAccountSection}
                                        onChange={(e) => setNewAccountSection(e.target.value)}
                                        className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary outline-none"
                                        required
                                    >
                                        <option value="">Select a section...</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5">Account Name</label>
                                    <input
                                        type="text"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary outline-none"
                                        placeholder="e.g. Marketing Expenses"
                                        required
                                    />
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
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                    <ListBulletIcon className="w-5 h-5 text-primary" />
                                    Working Notes
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">Breakdown for <span className="text-primary font-semibold">{currentWorkingLabel}</span></p>
                            </div>
                            <button onClick={() => setShowWorkingNoteModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-background">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 w-[45%]">Description</th>
                                        <th className="px-4 py-3 text-right w-[20%]">{`Current Year (${displayCurrency})`}</th>
                                        <th className="px-4 py-3 text-right w-[20%]">{`Previous Year (${displayCurrency})`}</th>
                                        <th className="px-4 py-3 w-[15%]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {tempWorkingNotes.map((note, idx) => (
                                        <tr key={idx} className="group hover:bg-muted/30">
                                            <td className="p-2">
                                                <input
                                                    type="text"
                                                    value={note.description}
                                                    onChange={(e) => handleWorkingNoteChange(idx, 'description', e.target.value)}
                                                    className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-foreground outline-none transition-colors"
                                                    placeholder="Description..."
                                                />
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={note.currentYearAmount === 0 ? '' : note.currentYearAmount}
                                                    onChange={(e) => handleWorkingNoteChange(idx, 'currentYearAmount', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-right text-foreground outline-none transition-colors font-mono"
                                                    placeholder="0"
                                                />
                                                {renderSecondaryLine(note.currentYearAmount ?? note.amount ?? 0)}
                                            </td>
                                            <td className="p-2">
                                                <input
                                                    type="number"
                                                    value={note.previousYearAmount === 0 ? '' : note.previousYearAmount}
                                                    onChange={(e) => handleWorkingNoteChange(idx, 'previousYearAmount', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-right text-foreground outline-none transition-colors font-mono"
                                                    placeholder="0"
                                                />
                                                {renderSecondaryLine(note.previousYearAmount ?? 0)}
                                            </td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleRemoveWorkingNoteRow(idx)} className="text-muted-foreground hover:text-destructive p-1.5 rounded transition-colors">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={4} className="pt-4">
                                            <button onClick={handleAddWorkingNoteRow} className="flex items-center text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wide">
                                                <PlusIcon className="w-4 h-4 mr-1" /> Add Row
                                            </button>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="p-4 border-t border-border bg-muted/50 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <div className="text-xs flex items-center gap-2">
                                    <span className="text-muted-foreground">Current Year Total:</span>
                                    <span className="font-mono font-bold text-foreground">{tempWorkingNotes.reduce((sum, n) => sum + (n.currentYearAmount || 0), 0).toFixed(0)} {displayCurrency}</span>
                                </div>
                                {showSecondaryConverted && (
                                    <div className="text-[10px] text-muted-foreground">
                                        ({formatSecondaryValue(tempWorkingNotes.reduce((sum, n) => sum + (n.currentYearAmount || 0), 0))})
                                    </div>
                                )}
                                <div className="text-xs flex items-center gap-2">
                                    <span className="text-muted-foreground">Previous Year Total:</span>
                                    <span className="font-mono font-bold text-foreground">{tempWorkingNotes.reduce((sum, n) => sum + (n.previousYearAmount || 0), 0).toFixed(0)} {displayCurrency}</span>
                                </div>
                                {showSecondaryConverted && (
                                    <div className="text-[10px] text-muted-foreground">
                                        ({formatSecondaryValue(tempWorkingNotes.reduce((sum, n) => sum + (n.previousYearAmount || 0), 0))})
                                    </div>
                                )}
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
