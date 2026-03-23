import React, { useState, useEffect, useMemo } from 'react';
import type { WorkingNoteEntry } from '../types';
import { ArrowRightIcon, ChevronLeftIcon, DocumentArrowDownIcon, PlusIcon, XMarkIcon, ListBulletIcon, TrashIcon, ExclamationTriangleIcon } from './icons';

const formatWholeNumber = (amount: number) => {
    const rounded = Math.round(amount || 0);
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.abs(rounded));
    return rounded < 0 ? `(${formatted})` : formatted;
};

const StableNumberInput = ({
    value,
    onChange,
    className,
    placeholder,
    prefix = "AED",
    displayValue
}: {
    value: number | string,
    onChange: (val: string) => void,
    className: string,
    placeholder: string,
    prefix?: string,
    displayValue?: string
}) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : (value === '' ? '' : value.toString()));
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        const externalRaw = value === 0 ? '' : (value === '' ? '' : value.toString());
        if (isFocused) {
            if (externalRaw !== localValue && parseFloat(externalRaw) !== parseFloat(localValue)) {
                setLocalValue(externalRaw);
            }
            return;
        }
        const externalDisplay = displayValue !== undefined ? displayValue : externalRaw;
        if (externalDisplay !== localValue) {
            setLocalValue(externalDisplay);
        }
    }, [value, displayValue, isFocused, localValue]);

    return (
        <div className="relative group/input">
            {prefix && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted-foreground text-xs group-focus-within/input:text-primary transition-colors pointer-events-none">
                    {prefix}
                </span>
            )}
            <input
                type="text"
                inputMode="decimal"
                value={localValue}
                onChange={(e) => {
                    setLocalValue(e.target.value);
                    onChange(e.target.value);
                }}
                onFocus={() => {
                    setIsFocused(true);
                    setLocalValue(value === 0 ? '' : (value === '' ? '' : value.toString()));
                }}
                className={className}
                placeholder={placeholder}
                onBlur={() => {
                    setIsFocused(false);
                    const externalRaw = value === 0 ? '' : (value === '' ? '' : value.toString());
                    setLocalValue(displayValue !== undefined ? displayValue : externalRaw);
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
    onDownloadPDF?: (signatoryName?: string) => void;
    displayCurrency?: string;
    secondaryCurrency?: string;
    exchangeRateToDisplay?: number;
    showSecondaryConverted?: boolean;
}

export const BS_ITEMS: BalanceSheetItem[] = [
    { id: 'assets_header', label: 'Assets', type: 'header' },
    { id: 'non_current_assets_header', label: 'Non-current assets', type: 'subheader' },
    { id: 'property_plant_equipment', label: 'Property, plant and equipment', type: 'item', isEditable: true },
    { id: 'intangible_assets', label: 'Intangible assets', type: 'item', isEditable: true },
    { id: 'long_term_investments', label: 'Long-term investments', type: 'item', isEditable: true },
    { id: 'other_non_current_assets', label: 'Other non-current assets', type: 'item', isEditable: true },
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
    { id: 'shareholders_current_accounts', label: "Shareholders' current accounts", type: 'item', isEditable: true },
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

export const BalanceSheetStep: React.FC<BalanceSheetStepProps> = ({
    onNext, onBack, data, onChange, onExport, structure = BS_ITEMS, onAddAccount, workingNotes, onUpdateWorkingNotes, onDownloadPDF,
    displayCurrency = 'AED', secondaryCurrency, exchangeRateToDisplay = 1, showSecondaryConverted = false
}) => {

    const [showAddModal, setShowAddModal] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountSection, setNewAccountSection] = useState('');
    const [showBalanceWarning, setShowBalanceWarning] = useState(false);
    const [showPdfSignatoryModal, setShowPdfSignatoryModal] = useState(false);
    const [pdfSignatoryName, setPdfSignatoryName] = useState('');

    const handleContinueAttempt = () => {
        if (isFullyBalanced) {
            onNext();
        } else {
            setShowBalanceWarning(true);
        }
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
        const normalizedValue = inputValue.replace(/,/g, '').trim();
        const isBracketed = /^\(.*\)$/.test(normalizedValue);
        const withoutBrackets = normalizedValue.replace(/[()]/g, '');
        const parsed = parseFloat(withoutBrackets);
        const signed = isBracketed ? -Math.abs(parsed) : parsed;
        const val = Math.round(signed);
        if (!isNaN(val)) {
            onChange(id, year, val);
        } else if (inputValue === '' || inputValue === '-') {
            onChange(id, year, 0);
        }
    };

    const formatEditableAccounting = (amount?: number) => {
        if (amount === undefined || amount === null || Math.abs(amount) < 0.01) return '';
        const rounded = Math.round(amount);
        const formatted = new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(Math.abs(rounded));
        return rounded < 0 ? `(${formatted})` : formatted;
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

    const sections = structure.filter(i => i.type === 'header' || i.type === 'subheader');

    // Dynamically compute all section totals from structure items (includes injected custom items).
    const computedData = useMemo(() => {
        const getD = (id: string, year: 'currentYear' | 'previousYear') => data[id]?.[year] || 0;

        // Collect item ids that appear between the last subheader and a given total id.
        const itemsBefore = (totalId: string): string[] => {
            const items: string[] = [];
            let collecting = false;
            for (const s of structure) {
                if (s.id === totalId) break;
                if (s.type === 'subheader') { items.length = 0; collecting = true; }
                else if (collecting && s.type === 'item') { items.push(s.id); }
                else if (collecting && (s.type === 'total' || s.type === 'grand_total')) { items.length = 0; }
            }
            return items;
        };

        // Round each item to whole integer (matching formatWholeNumber display) before summing,
        // so section totals equal the sum of the integers actually shown on screen.
        const sumItems = (ids: string[], year: 'currentYear' | 'previousYear') =>
            ids.reduce((s, id) => s + Math.round(getD(id, year)), 0);

        const ncaItems = itemsBefore('total_non_current_assets');
        const caItems  = itemsBefore('total_current_assets');
        const eqItems  = itemsBefore('total_equity');
        const nclItems = itemsBefore('total_non_current_liabilities');
        const clItems  = itemsBefore('total_current_liabilities');

        const computed: Record<string, { currentYear: number; previousYear: number }> = {};
        const years = ['currentYear', 'previousYear'] as const;
        for (const year of years) {
            const totalNCA = sumItems(ncaItems, year);
            const totalCA  = sumItems(caItems, year);
            const totalA   = totalNCA + totalCA;
            const totalEq  = sumItems(eqItems, year);
            const totalNCL = sumItems(nclItems, year);
            const totalCL  = sumItems(clItems, year);
            const totalL   = totalNCL + totalCL;
            // Reconcile any ≤1 rounding gap so both grand totals show the same number.
            const totalEL  = Math.abs(totalEq + totalL - totalA) <= 1 ? totalA : (totalEq + totalL);

            const set = (id: string, val: number) => {
                if (!computed[id]) computed[id] = { currentYear: 0, previousYear: 0 };
                computed[id][year] = val;
            };
            set('total_non_current_assets', totalNCA);
            set('total_current_assets', totalCA);
            set('total_assets', totalA);
            set('total_equity', totalEq);
            set('total_non_current_liabilities', totalNCL);
            set('total_current_liabilities', totalCL);
            set('total_liabilities', totalL);
            set('total_equity_liabilities', totalEL);
        }

        return { ...data, ...computed };
    }, [structure, data]);

    const totalAssetsCurrent = Math.round(computedData['total_assets']?.currentYear || 0);
    const totalEqLiabCurrent = Math.round(computedData['total_equity_liabilities']?.currentYear || 0);
    const currentYearDiff = Math.abs(totalAssetsCurrent - totalEqLiabCurrent);
    const isCurrentYearBalanced = currentYearDiff < 1;

    const totalAssetsPrevious = Math.round(computedData['total_assets']?.previousYear || 0);
    const totalEqLiabPrevious = Math.round(computedData['total_equity_liabilities']?.previousYear || 0);
    const previousYearDiff = Math.abs(totalAssetsPrevious - totalEqLiabPrevious);
    const isPreviousYearBalanced = previousYearDiff < 1;

    const isFullyBalanced = isCurrentYearBalanced && isPreviousYearBalanced;

    const handleDownloadPdfClick = () => {
        if (!onDownloadPDF) return;
        setPdfSignatoryName('');
        setShowPdfSignatoryModal(true);
    };

    const handleConfirmDownloadPdf = () => {
        if (!onDownloadPDF) return;
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        const normalizedName = pdfSignatoryName.trim();
        setShowPdfSignatoryModal(false);
        setPdfSignatoryName('');
        setTimeout(() => onDownloadPDF(normalizedName || undefined), 0);
    };

    return (
        <div className="w-full max-w-6xl mx-auto bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="p-6 border-b border-border flex justify-between items-center bg-card z-10 w-full">
                <div className="flex flex-col">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2 shrink-0">
                        <span className="bg-primary w-1.5 h-6 rounded-full"></span>
                        Statement of Financial Position
                    </h2>
                    {!isCurrentYearBalanced && (
                        <div className="flex items-center gap-2 mt-1 text-destructive text-xs font-bold animate-pulse">
                            <XMarkIcon className="w-3 h-3" />
                            Current Year Out of Balance: {currentYearDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AED Difference
                        </div>
                    )}
                    {!isPreviousYearBalanced && (
                        <div className="flex items-center gap-2 mt-1 text-status-warning text-xs font-bold">
                            <ExclamationTriangleIcon className="w-3 h-3" />
                            Previous Year Out of Balance: {previousYearDiff.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} AED Difference
                        </div>
                    )}
                    {isFullyBalanced && totalAssetsCurrent !== 0 && (
                        <div className="flex items-center gap-2 mt-1 text-status-success text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-status-success-soft"></span>
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
                    {onDownloadPDF && (
                        <button onClick={handleDownloadPdfClick} className="flex items-center px-3 py-1.5 bg-muted text-foreground font-bold rounded-lg hover:bg-muted/80 transition-colors border border-border shadow-sm whitespace-nowrap text-xs">
                            <DocumentArrowDownIcon className="w-4 h-4 mr-1.5" /> Download PDF
                        </button>
                    )}
                    <button onClick={onBack} className="flex items-center px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border whitespace-nowrap text-xs font-bold">
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back
                    </button>
                    <button onClick={handleContinueAttempt} className={`flex items-center px-4 py-1.5 font-bold rounded-lg transition-all shadow-lg whitespace-nowrap text-xs ${isFullyBalanced ? 'bg-primary hover:bg-primary/90 text-primary-foreground hover:shadow-primary/30' : 'bg-status-warning-soft hover:bg-status-warning-soft text-foreground'}`}>
                        {isFullyBalanced ? 'Confirm & Continue' : 'Proceed with Warning'} <ArrowRightIcon className="w-4 h-4 ml-1.5" />
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
                                                    <>
                                                        <StableNumberInput value={data[item.id]?.currentYear ?? ''} onChange={(val) => handleInputChange(item.id, 'currentYear', val)} displayValue={formatEditableAccounting(data[item.id]?.currentYear)} className="w-full text-right bg-transparent border-b border-border outline-none py-1 px-1 font-mono text-foreground focus:border-primary group-hover/input:border-muted-foreground transition-colors placeholder-muted-foreground/30" placeholder="0" prefix={displayCurrency} />
                                                        {renderSecondaryLine(data[item.id]?.currentYear ?? 0)}
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="font-mono text-foreground text-lg font-bold">
                                                            {formatWholeNumber(computedData[item.id]?.currentYear || 0)}
                                                        </span>
                                                        {renderSecondaryLine(computedData[item.id]?.currentYear || 0)}
                                                    </>
                                                )}
                                            </div>
                                            <div className="w-48 text-right">
                                                {item.type === 'item' && item.id === 'property_plant_equipment' && <div className="text-[10px] text-muted-foreground uppercase mb-1 font-bold tracking-wider">Previous Year</div>}
                                                {item.isEditable ? (
                                                    <>
                                                        <StableNumberInput value={data[item.id]?.previousYear ?? ''} onChange={(val) => handleInputChange(item.id, 'previousYear', val)} displayValue={formatEditableAccounting(data[item.id]?.previousYear)} className="w-full text-right bg-transparent border-b border-border outline-none py-1 px-1 font-mono text-foreground focus:border-primary group-hover/input:border-muted-foreground transition-colors placeholder-muted-foreground/30" placeholder="0" prefix={displayCurrency} />
                                                        {renderSecondaryLine(data[item.id]?.previousYear ?? 0)}
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="font-mono text-muted-foreground/70">
                                                            {formatWholeNumber(computedData[item.id]?.previousYear || 0)}
                                                        </span>
                                                        {renderSecondaryLine(computedData[item.id]?.previousYear || 0)}
                                                    </>
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

            <div className={`p-4 border-t border-border text-center transition-colors ${!isFullyBalanced ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground'}`}>
                {!isFullyBalanced ? <div className="flex items-center justify-center gap-2 font-bold animate-pulse"><XMarkIcon className="w-5 h-5" /> Balance Sheet Error: Total Assets must equal Total Equity & Liabilities for both Current and Previous Year.</div> : <div className="text-sm">Please ensure Total Assets match Total Equity and Liabilities.</div>}
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
                                        <th className="px-4 py-3 text-right w-[20%]">{`Current Year (${displayCurrency})`}</th>
                                        <th className="px-4 py-3 text-right w-[20%]">{`Previous Year (${displayCurrency})`}</th>
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
                                                {renderSecondaryLine(note.currentYearAmount ?? note.amount ?? 0)}
                                            </td>
                                            <td className="p-2">
                                                <input type="number" value={note.previousYearAmount === 0 ? '' : note.previousYearAmount} onChange={(e) => handleWorkingNoteChange(idx, 'previousYearAmount', parseFloat(e.target.value) || 0)} className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-3 py-1.5 text-right text-foreground outline-none transition-colors font-mono" placeholder="0" />
                                                {renderSecondaryLine(note.previousYearAmount ?? 0)}
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
                                <div className="text-xs flex items-center gap-2"><span className="text-muted-foreground">Current Year Total:</span> <span className="font-mono font-bold text-foreground">{tempWorkingNotes.reduce((sum, n) => sum + (n.currentYearAmount || 0), 0).toFixed(0)} {displayCurrency}</span></div>
                                {showSecondaryConverted && <div className="text-[10px] text-muted-foreground">({formatSecondaryValue(tempWorkingNotes.reduce((sum, n) => sum + (n.currentYearAmount || 0), 0))})</div>}
                                <div className="text-xs flex items-center gap-2"><span className="text-muted-foreground">Previous Year Total:</span> <span className="font-mono font-bold text-foreground">{tempWorkingNotes.reduce((sum, n) => sum + (n.previousYearAmount || 0), 0).toFixed(0)} {displayCurrency}</span></div>
                                {showSecondaryConverted && <div className="text-[10px] text-muted-foreground">({formatSecondaryValue(tempWorkingNotes.reduce((sum, n) => sum + (n.previousYearAmount || 0), 0))})</div>}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setShowWorkingNoteModal(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm">Cancel</button>
                                <button onClick={saveWorkingNote} className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-colors shadow-lg">Save Notes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showBalanceWarning && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl border border-destructive/50 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-destructive/20">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <ExclamationTriangleIcon className="w-8 h-8 text-destructive" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground">Balance Sheet Mismatch</h3>
                            {!isCurrentYearBalanced && (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        Current Year Total Assets (<span className="font-mono font-bold text-foreground">{formatWholeNumber(data['total_assets']?.currentYear || 0)}</span>) do not match Total Equity & Liabilities (<span className="font-mono font-bold text-foreground">{formatWholeNumber(data['total_equity_liabilities']?.currentYear || 0)}</span>).
                                    </p>
                                    <p className="text-xs text-destructive font-bold bg-destructive/10 p-2 rounded">
                                        Current Year Difference: {formatWholeNumber(currentYearDiff)} AED
                                    </p>
                                </>
                            )}
                            {!isPreviousYearBalanced && (
                                <>
                                    <p className="text-sm text-muted-foreground">
                                        Previous Year Total Assets (<span className="font-mono font-bold text-foreground">{formatWholeNumber(data['total_assets']?.previousYear || 0)}</span>) do not match Total Equity & Liabilities (<span className="font-mono font-bold text-foreground">{formatWholeNumber(data['total_equity_liabilities']?.previousYear || 0)}</span>).
                                    </p>
                                    <p className="text-xs text-status-warning font-bold bg-status-warning-soft p-2 rounded">
                                        Previous Year Difference: {formatWholeNumber(previousYearDiff)} AED
                                    </p>
                                </>
                            )}
                            <p className="text-xs text-muted-foreground italic">
                                You can proceed, but please note that this discrepancy might need to be resolved before final submission.
                            </p>
                        </div>
                        <div className="p-4 bg-muted/50 flex gap-3 justify-center border-t border-border">
                            <button onClick={() => setShowBalanceWarning(false)} className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm">Review Changes</button>
                            <button onClick={() => { setShowBalanceWarning(false); onNext(); }} className="px-6 py-2 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold rounded-lg text-sm transition-colors shadow-lg">Proceed Anyway</button>
                        </div>
                    </div>
                </div>
            )}

            {showPdfSignatoryModal && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-border bg-muted/50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-foreground">Authorized Signatory</h3>
                            <button
                                onClick={() => {
                                    setPdfSignatoryName('');
                                    setShowPdfSignatoryModal(false);
                                }}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Enter signatory name to print in PDF footer. Leave empty to download without name.
                            </p>
                            <input
                                type="text"
                                value={pdfSignatoryName}
                                onChange={(e) => setPdfSignatoryName(e.target.value)}
                                placeholder="e.g. Alex Morgan"
                                className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setPdfSignatoryName('');
                                    setShowPdfSignatoryModal(false);
                                    setTimeout(() => onDownloadPDF?.(undefined), 0);
                                }}
                                className="px-4 py-2 text-muted-foreground hover:text-foreground font-semibold text-sm"
                            >
                                Download Without Name
                            </button>
                            <button
                                onClick={handleConfirmDownloadPdf}
                                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-colors shadow-lg"
                            >
                                Download PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


