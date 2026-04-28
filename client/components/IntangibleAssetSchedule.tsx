import React, { useState, useEffect, useMemo } from 'react';
import type { IntangibleAssetCategory, WorkingNoteEntry } from '../types';
import { PlusIcon, XMarkIcon, TrashIcon, ExclamationTriangleIcon } from './icons';

const formatAccounting = (val: number): string => {
    if (Math.abs(val) < 0.5) return '-';
    const rounded = Math.round(val);
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(rounded));
    return rounded < 0 ? `(${formatted})` : formatted;
};

const formatBracketDisplay = (val: number): string => {
    if (Math.abs(val) < 0.5) return '-';
    const rounded = Math.round(val);
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(rounded));
    return `(${formatted})`;
};

interface IntangibleAssetScheduleProps {
    categories: IntangibleAssetCategory[];
    onChange: (categories: IntangibleAssetCategory[]) => void;
    onClose: () => void;
    currency?: string;
    periodEnd?: string;
    previousPeriodEnd?: string;
    trialBalanceLocked?: boolean;
}

const EditableCell = ({ value, onChange, className = '', displayAbsolute = false, displayInBrackets = false }: {
    value: number;
    onChange: (val: number) => void;
    className?: string;
    displayAbsolute?: boolean;
    displayInBrackets?: boolean;
}) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
    const [isFocused, setIsFocused] = useState(false);
    const normalizedValue = displayAbsolute ? Math.abs(value) : value;
    const displayValue = displayInBrackets ? formatBracketDisplay(normalizedValue) : formatAccounting(normalizedValue);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(normalizedValue === 0 ? '' : Math.round(normalizedValue).toString());
        }
    }, [normalizedValue, isFocused]);

    return (
        <input
            type="text"
            inputMode="decimal"
            value={isFocused ? localValue : (normalizedValue === 0 ? '' : displayValue)}
            onChange={(e) => {
                setLocalValue(e.target.value);
                const cleaned = e.target.value.replace(/,/g, '').replace(/[()]/g, '');
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed)) onChange(Math.round(Math.abs(parsed)));
                else if (e.target.value === '' || e.target.value === '-') onChange(0);
            }}
            onFocus={() => {
                setIsFocused(true);
                setLocalValue(normalizedValue === 0 ? '' : Math.round(normalizedValue).toString());
            }}
            onBlur={() => setIsFocused(false)}
            className={`w-full text-right bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-2 py-1.5 font-mono text-sm outline-none transition-colors text-foreground ${className}`}
            placeholder="0"
        />
    );
};

const ReadOnlyCell = ({ value, bold = false, highlight = false, displayAbsolute = false, displayInBrackets = false }: { value: number; bold?: boolean; highlight?: boolean; displayAbsolute?: boolean; displayInBrackets?: boolean }) => (
    <div className={`text-right px-2 py-1.5 font-mono text-sm ${bold ? 'font-bold text-foreground' : 'text-muted-foreground'} ${highlight ? 'bg-primary/5' : ''}`}>
        {displayInBrackets ? formatBracketDisplay(displayAbsolute ? Math.abs(value) : value) : formatAccounting(displayAbsolute ? Math.abs(value) : value)}
    </div>
);

export const IntangibleAssetSchedule: React.FC<IntangibleAssetScheduleProps> = ({
    categories,
    onChange,
    onClose,
    currency = 'AED',
    periodEnd = 'December 31, 2024',
    previousPeriodEnd = 'December 31, 2023',
    trialBalanceLocked = true
}) => {
    const [editingHeader, setEditingHeader] = useState<number | null>(null);

    // Auto-calculate derived fields when trial balance values are locked
    useEffect(() => {
        if (!trialBalanceLocked || categories.length === 0) return;

        let needsUpdate = false;
        const updated = categories.map(cat => {
            const expectedAdditions = Math.max(0, cat.costClosing - cat.costOpening + cat.costDisposals);
            const expectedElim = Math.max(0, cat.accAmortOpening + cat.accAmortCharge - cat.accAmortClosing);

            if (Math.abs(cat.costAdditions - expectedAdditions) > 0.5 ||
                Math.abs(cat.accAmortElimOnDisposal - expectedElim) > 0.5) {
                needsUpdate = true;
                return { ...cat, costAdditions: expectedAdditions, accAmortElimOnDisposal: expectedElim };
            }
            return cat;
        });

        if (needsUpdate) onChange(updated);
    }, [categories, trialBalanceLocked]);

    const updateCategory = (index: number, field: keyof IntangibleAssetCategory, value: number | string) => {
        const updated = categories.map((cat, i) => i === index ? { ...cat, [field]: value } : cat);
        onChange(updated);
    };

    const addCategory = () => {
        onChange([...categories, {
            name: 'New Intangible Asset',
            costOpening: 0, costAdditions: 0, costDisposals: 0, costClosing: 0,
            accAmortOpening: 0, accAmortCharge: 0, accAmortElimOnDisposal: 0, accAmortClosing: 0
        }]);
    };

    const removeCategory = (index: number) => {
        if (categories.length <= 1) return;
        onChange(categories.filter((_, i) => i !== index));
    };

    const totals = useMemo(() => {
        const sum = (field: keyof IntangibleAssetCategory) => categories.reduce((s, c) => s + (typeof c[field] === 'number' ? c[field] as number : 0), 0);
        return {
            costOpening: sum('costOpening'), costAdditions: sum('costAdditions'),
            costDisposals: sum('costDisposals'), costClosing: sum('costClosing'),
            accAmortOpening: sum('accAmortOpening'), accAmortCharge: sum('accAmortCharge'),
            accAmortElimOnDisposal: sum('accAmortElimOnDisposal'), accAmortClosing: sum('accAmortClosing'),
        };
    }, [categories]);

    const costWarnings = useMemo(() => categories.map(cat => {
        const expected = cat.costOpening + cat.costAdditions - cat.costDisposals;
        return Math.abs(expected - cat.costClosing) > 0.5;
    }), [categories]);

    const amortWarnings = useMemo(() => categories.map(cat => {
        const expected = cat.accAmortOpening + cat.accAmortCharge - cat.accAmortElimOnDisposal;
        return Math.abs(expected - cat.accAmortClosing) > 0.5;
    }), [categories]);

    const nbvCurrent = (cat: IntangibleAssetCategory) => cat.costClosing - Math.abs(cat.accAmortClosing);
    const nbvPrevious = (cat: IntangibleAssetCategory) => cat.costOpening - Math.abs(cat.accAmortOpening);
    const totalNbvCurrent = totals.costClosing - Math.abs(totals.accAmortClosing);
    const totalNbvPrevious = totals.costOpening - Math.abs(totals.accAmortOpening);

    // Parallel to FixedAssetSchedule's isCostMissing — unlock cost cells for rows that
    // only have amortisation populated, so users can repair incomplete TB data.
    const isCostMissing = (cat: IntangibleAssetCategory) =>
        cat.costOpening === 0 && cat.costClosing === 0 &&
        (cat.accAmortOpening > 0 || cat.accAmortClosing > 0 || cat.accAmortCharge > 0);

    const colCount = categories.length + 2;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Intangible Asset Schedule</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Intangible asset & amortisation breakdown ({currency})</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={addCategory} className="flex items-center px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 font-bold rounded-lg transition-colors border border-primary/20 text-xs">
                            <PlusIcon className="w-3.5 h-3.5 mr-1" /> Add Category
                        </button>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1.5">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 bg-background">
                    <table className="w-full text-sm border-collapse min-w-[700px]">
                        <thead>
                            <tr className="border-b-2 border-primary">
                                <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider w-[240px] min-w-[200px]">Description</th>
                                {categories.map((cat, i) => (
                                    <th key={i} className="text-center px-2 py-2 min-w-[130px] group">
                                        {editingHeader === i ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                value={cat.name}
                                                onChange={(e) => updateCategory(i, 'name', e.target.value)}
                                                onBlur={() => setEditingHeader(null)}
                                                onKeyDown={(e) => e.key === 'Enter' && setEditingHeader(null)}
                                                className="w-full text-center bg-muted border border-primary rounded px-2 py-1 text-xs font-bold text-foreground outline-none"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center gap-1">
                                                <span
                                                    className="text-xs font-bold text-foreground cursor-pointer hover:text-primary transition-colors underline decoration-dashed underline-offset-2"
                                                    onClick={() => setEditingHeader(i)}
                                                    title="Click to rename"
                                                >
                                                    {cat.name}
                                                </span>
                                                {categories.length > 1 && (
                                                    <button onClick={() => removeCategory(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5" title="Remove category">
                                                        <TrashIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </th>
                                ))}
                                <th className="text-center px-2 py-2 min-w-[130px] text-xs font-bold text-foreground uppercase">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* ===== COST SECTION ===== */}
                            <tr className="bg-muted/50">
                                <td colSpan={colCount} className="px-3 py-2 text-xs font-black text-foreground uppercase tracking-wider">Cost</td>
                            </tr>

                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">As at {previousPeriodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i}>
                                        {trialBalanceLocked && !isCostMissing(cat)
                                            ? <ReadOnlyCell value={cat.costOpening} />
                                            : <EditableCell value={cat.costOpening} onChange={(v) => updateCategory(i, 'costOpening', v)} className={isCostMissing(cat) ? "bg-status-warning-soft/20 border-status-warning/40" : ""} />}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.costOpening} bold /></td>
                            </tr>

                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Additions during the year</td>
                                {categories.map((cat, i) => {
                                    const computedAdditions = trialBalanceLocked
                                        ? Math.max(0, cat.costClosing - cat.costOpening + cat.costDisposals)
                                        : cat.costAdditions;
                                    return (
                                        <td key={i}>
                                            {trialBalanceLocked
                                                ? <ReadOnlyCell value={computedAdditions} />
                                                : <EditableCell value={cat.costAdditions} onChange={(v) => updateCategory(i, 'costAdditions', v)} className="bg-primary/5 border-primary/20" />}
                                        </td>
                                    );
                                })}
                                <td><ReadOnlyCell value={trialBalanceLocked ? categories.reduce((s, c) => s + Math.max(0, c.costClosing - c.costOpening + c.costDisposals), 0) : totals.costAdditions} bold /></td>
                            </tr>

                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Deductions during the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><EditableCell value={cat.costDisposals} onChange={(v) => updateCategory(i, 'costDisposals', v)} className="bg-primary/5 border-primary/20" displayInBrackets /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.costDisposals} bold displayInBrackets /></td>
                            </tr>

                            <tr className="border-b-2 border-border hover:bg-muted/20">
                                <td className="px-3 py-1 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i} className="relative">
                                        {trialBalanceLocked && !isCostMissing(cat)
                                            ? <ReadOnlyCell value={cat.costClosing} bold />
                                            : <>
                                                <EditableCell value={cat.costClosing} onChange={(v) => updateCategory(i, 'costClosing', v)} className={isCostMissing(cat) ? "bg-status-warning-soft/20 border-status-warning/40" : ""} />
                                                {costWarnings[i] && (
                                                    <div className="absolute right-1 top-0.5" title={`Expected: ${formatAccounting(cat.costOpening + cat.costAdditions - cat.costDisposals)}`}>
                                                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-status-warning" />
                                                    </div>
                                                )}
                                            </>}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.costClosing} bold /></td>
                            </tr>

                            <tr><td colSpan={colCount} className="h-3"></td></tr>

                            {/* ===== ACCUMULATED AMORTISATION SECTION ===== */}
                            <tr className="bg-muted/50">
                                <td colSpan={colCount} className="px-3 py-2 text-xs font-black text-foreground uppercase tracking-wider italic">Accumulated Amortisation</td>
                            </tr>

                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">As at {previousPeriodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i}>
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.accAmortOpening} />
                                            : <EditableCell value={cat.accAmortOpening} onChange={(v) => updateCategory(i, 'accAmortOpening', v)} />}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.accAmortOpening} bold /></td>
                            </tr>

                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Amortisation for the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}>
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.accAmortCharge} />
                                            : <EditableCell value={cat.accAmortCharge} onChange={(v) => updateCategory(i, 'accAmortCharge', v)} className="bg-primary/5 border-primary/20" />}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.accAmortCharge} bold /></td>
                            </tr>

                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Deductions during the year</td>
                                {categories.map((cat, i) => {
                                    const computedElim = trialBalanceLocked
                                        ? Math.max(0, cat.accAmortOpening + cat.accAmortCharge - cat.accAmortClosing)
                                        : cat.accAmortElimOnDisposal;
                                    return (
                                        <td key={i}>
                                            {trialBalanceLocked
                                                ? <ReadOnlyCell value={computedElim} displayInBrackets />
                                                : <EditableCell value={cat.accAmortElimOnDisposal} onChange={(v) => updateCategory(i, 'accAmortElimOnDisposal', v)} className="bg-primary/5 border-primary/20" displayInBrackets />}
                                        </td>
                                    );
                                })}
                                <td><ReadOnlyCell value={trialBalanceLocked ? categories.reduce((s, c) => s + Math.max(0, c.accAmortOpening + c.accAmortCharge - c.accAmortClosing), 0) : totals.accAmortElimOnDisposal} bold displayInBrackets /></td>
                            </tr>

                            <tr className="border-b-2 border-border hover:bg-muted/20">
                                <td className="px-3 py-1 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i} className="relative">
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.accAmortClosing} bold />
                                            : <>
                                                <EditableCell value={cat.accAmortClosing} onChange={(v) => updateCategory(i, 'accAmortClosing', v)} />
                                                {amortWarnings[i] && (
                                                    <div className="absolute right-1 top-0.5" title={`Expected: ${formatAccounting(cat.accAmortOpening + cat.accAmortCharge - cat.accAmortElimOnDisposal)}`}>
                                                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-status-warning" />
                                                    </div>
                                                )}
                                            </>}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.accAmortClosing} bold /></td>
                            </tr>

                            <tr><td colSpan={colCount} className="h-3"></td></tr>

                            {/* ===== NET BOOK VALUE SECTION ===== */}
                            <tr className="bg-muted/50">
                                <td colSpan={colCount} className="px-3 py-2 text-xs font-black text-foreground uppercase tracking-wider">Net Book Value</td>
                            </tr>

                            <tr className="border-b border-border/50 bg-primary/5">
                                <td className="px-3 py-2 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><ReadOnlyCell value={nbvCurrent(cat)} bold highlight /></td>
                                ))}
                                <td><ReadOnlyCell value={totalNbvCurrent} bold highlight /></td>
                            </tr>

                            <tr className="border-b-2 border-double border-primary">
                                <td className="px-3 py-2 font-bold text-foreground">As at {previousPeriodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><ReadOnlyCell value={nbvPrevious(cat)} bold /></td>
                                ))}
                                <td><ReadOnlyCell value={totalNbvPrevious} bold /></td>
                            </tr>
                        </tbody>
                    </table>

                    {(costWarnings.some(Boolean) || amortWarnings.some(Boolean)) && (
                        <div className="mt-4 p-3 bg-status-warning-soft/20 border border-status-warning/30 rounded-lg">
                            <div className="flex items-center gap-2 text-xs font-bold text-status-warning mb-1">
                                <ExclamationTriangleIcon className="w-4 h-4" /> Validation Warnings
                            </div>
                            {costWarnings.map((warn, i) => warn && (
                                <div key={`c-${i}`} className="text-xs text-muted-foreground ml-6">
                                    {categories[i].name}: Cost closing ({formatAccounting(categories[i].costClosing)}) does not match Opening + Additions - Disposals ({formatAccounting(categories[i].costOpening + categories[i].costAdditions - categories[i].costDisposals)})
                                </div>
                            ))}
                            {amortWarnings.map((warn, i) => warn && (
                                <div key={`a-${i}`} className="text-xs text-muted-foreground ml-6">
                                    {categories[i].name}: Amortisation closing ({formatAccounting(categories[i].accAmortClosing)}) does not match Opening + Charge - Eliminated ({formatAccounting(categories[i].accAmortOpening + categories[i].accAmortCharge - categories[i].accAmortElimOnDisposal)})
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-muted/50 flex justify-between items-center shrink-0">
                    <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{categories.length}</span> intangible {categories.length === 1 ? 'category' : 'categories'} &middot; Net Book Value: <span className="font-bold text-foreground">{currency} {formatAccounting(totalNbvCurrent)}</span>
                    </div>
                    <button onClick={onClose} className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-sm transition-colors shadow-lg">
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Determines if a trial-balance account name is an intangible-asset
 * (or accumulated-amortisation contra) account. Used by all CT types to route
 * these rows into the intangible_assets BS bucket instead of PPE.
 */
export const isIntangibleAssetAccount = (accountName: string): boolean => {
    const lower = accountName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Accumulated amortisation (any asset) — always intangible-side.
    if (/accumulated\s+amorti[sz]/i.test(lower)) return true;
    // Amortisation expense / charge — also intangible side.
    if (/\bamorti[sz]ation\b/i.test(lower)) return true;

    const intangibleKeywords = [
        'intangible', 'goodwill', 'patent', 'trademark', 'trade mark',
        'copyright', 'copywright', 'license', 'licence', 'software', 'brand',
        'franchise', 'formula', 'domain',
        'intellectual property', 'intelectual property'
    ];
    const excludedKeywords = [
        'cash', 'bank', 'receivable', 'payable', 'inventory', 'stock', 'prepaid',
        'vat', 'tax', 'loan', 'borrow', 'equity', 'capital', 'retained', 'revenue',
        'income', 'expense', 'liabil', 'advance', 'deposit', 'current asset'
    ];

    if (excludedKeywords.some(kw => lower.includes(kw))) return false;
    return intangibleKeywords.some(kw => lower.includes(kw));
};

const INTANGIBLE_NAME_KEYWORDS = [
    'intangible', 'goodwill', 'patent', 'trademark', 'trade mark',
    'copyright', 'copywright', 'license', 'licence', 'software', 'brand',
    'franchise', 'formula', 'domain',
    'intellectual property', 'intelectual property'
];

/**
 * Initialise IntangibleAssetCategory[] from BS working notes (intangible_assets)
 * and P&L amortisation notes. Mirrors initFixedAssetsFromWorkingNotes but keyed
 * on "Accumulated Amortisation - X" / "Amortisation - X" descriptions so that
 * each named intangible (e.g. "Software", "Patent - Brand A") becomes its own
 * schedule column, paired with its amortisation contra account and P&L charge.
 */
export const initIntangibleAssetsFromWorkingNotes = (
    bsNotes: WorkingNoteEntry[] | Record<string, WorkingNoteEntry[]>,
    pnlAmortNotes?: WorkingNoteEntry[],
    intangibleBsValue?: { currentYear: number; previousYear: number }
): IntangibleAssetCategory[] => {
    let relevantBsNotes = Array.isArray(bsNotes) ? bsNotes : Object.values(bsNotes).flat();
    if (relevantBsNotes.length === 0 && !pnlAmortNotes?.length) return [];

    const cleanDesc = (d: string) => d.replace(/\[Grouped Selected TB\]\s*/i, '').trim();
    const isAccAmort = (d: string) => /^accumulated\s+amorti[sz]ation/i.test(d);
    const isAmortExpense = (d: string) => /^amorti[sz]ation/i.test(d);
    const normalizeName = (value: string) => cleanDesc(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const excludedNameKeywords = [
        'cash', 'bank', 'current', 'receivable', 'payable', 'inventory', 'stock', 'prepaid', 'deposit',
        'vat', 'tax', 'loan', 'borrow', 'equity', 'capital', 'retained', 'revenue', 'income',
        'expense', 'liabil', 'property', 'plant', 'equipment', 'machinery', 'vehicle',
        'furniture', 'fixture', 'building', 'warehouse', 'tool'
    ];
    const isLikelyIntangibleName = (value: string) => {
        const normalized = normalizeName(value);
        if (!normalized) return false;
        if (excludedNameKeywords.some(keyword => normalized.includes(keyword))) return false;
        return INTANGIBLE_NAME_KEYWORDS.some(keyword => normalized.includes(keyword));
    };
    const stripAccAmort = (d: string) => d.replace(/^accumulated\s+amorti[sz]ation\s*(of|on|[-–—:/])?\s*/i, '').trim();
    const stripAmort = (d: string) => d.replace(/^amorti[sz]ation\s*(of|on|for|[-–—:/])?\s*/i, '').trim();

    if (!Array.isArray(bsNotes)) {
        // Pre-pass: collect the asset names that have an "Accumulated Amortisation - X" pair.
        // Any cost-side account whose description matches one of these names is intangible by
        // association — handles typos / unusual names that don't match the keyword list
        // (e.g. "Copywright" instead of "Copyright").
        const amortPairedNames = new Set<string>();
        for (const notes of Object.values(bsNotes)) {
            for (const note of notes || []) {
                const desc = cleanDesc(note.description || '');
                if (!desc || !isAccAmort(desc)) continue;
                const stripped = stripAccAmort(desc);
                if (stripped) amortPairedNames.add(stripped.toLowerCase());
            }
        }

        relevantBsNotes = Object.entries(bsNotes).flatMap(([key, notes]) =>
            (notes || []).filter(note => {
                const desc = cleanDesc(note.description || '');
                if (!desc) return false;
                if (key === 'intangible_assets') return true;
                if (isAccAmort(desc)) return true;
                if (amortPairedNames.has(desc.toLowerCase())) return true;
                return isLikelyIntangibleName(desc) || isLikelyIntangibleName(key.replace(/^custom_/, '').replace(/_/g, ' '));
            })
        );
    }

    const costMap: Record<string, { cur: number; prev: number }> = {};
    const amortMap: Record<string, { cur: number; prev: number }> = {};

    for (const note of relevantBsNotes) {
        const desc = cleanDesc(note.description);
        if (!desc) continue;

        const cur = note.currentYearAmount ?? note.amount ?? 0;
        const prev = note.previousYearAmount ?? 0;

        if (isAccAmort(desc)) {
            const catName = stripAccAmort(desc) || desc;
            if (!amortMap[catName]) amortMap[catName] = { cur: 0, prev: 0 };
            amortMap[catName].cur += cur;
            amortMap[catName].prev += prev;
        } else {
            if (!costMap[desc]) costMap[desc] = { cur: 0, prev: 0 };
            costMap[desc].cur += cur;
            costMap[desc].prev += prev;
        }
    }

    const costCategories = Object.keys(costMap);
    const STOP_TOKENS = new Set(['of', 'on', 'for', 'and', 'the', 'a', 'an', 'to', 'at']);
    const tokenize = (s: string) =>
        s.toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 0 && !STOP_TOKENS.has(t));

    const matchToCostCat = (amortCatName: string): string => {
        const trimmed = amortCatName.trim();
        if (!trimmed || /^accumulated\s+amorti[sz]ation$/i.test(trimmed)) {
            if (costCategories.length === 1) return costCategories[0];
            return amortCatName;
        }
        const lower = trimmed.toLowerCase();
        const exact = costCategories.find(c => c.toLowerCase() === lower);
        if (exact) return exact;

        const amortTokens = tokenize(trimmed);
        if (amortTokens.length > 0) {
            let bestMatch: string | null = null;
            let bestScore = 0;
            for (const cat of costCategories) {
                const catTokens = tokenize(cat);
                if (catTokens.length === 0) continue;
                const overlap = catTokens.filter(t => amortTokens.includes(t)).length;
                const minSize = Math.min(catTokens.length, amortTokens.length);
                if (overlap >= Math.max(1, Math.ceil(minSize / 2)) && overlap > bestScore) {
                    bestScore = overlap;
                    bestMatch = cat;
                }
            }
            if (bestMatch) return bestMatch;
        }
        return costCategories.find(c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase())) || amortCatName;
    };

    // Build amortisation-expense map from P&L notes (entries whose description begins
    // with "Amortisation" / "Amortization" — either format).
    const amortExpMap: Record<string, { cur: number }> = {};
    if (pnlAmortNotes) {
        for (const note of pnlAmortNotes) {
            const desc = cleanDesc(note.description);
            if (!desc) continue;
            const stripped = stripAccAmort(desc) !== desc
                ? stripAccAmort(desc)
                : (isAmortExpense(desc) ? (stripAmort(desc) || desc) : desc);
            const matched = matchToCostCat(stripped);
            if (!amortExpMap[matched]) amortExpMap[matched] = { cur: 0 };
            amortExpMap[matched].cur += (note.currentYearAmount ?? note.amount ?? 0);
        }
    }

    const allCatNames = new Set([...costCategories]);
    for (const amortCat of Object.keys(amortMap)) {
        const matched = matchToCostCat(amortCat);
        if (!costMap[matched]) allCatNames.add(amortCat);
    }

    const result: IntangibleAssetCategory[] = [];
    for (const name of allCatNames) {
        const cost = costMap[name] || { cur: 0, prev: 0 };
        const amort = Object.entries(amortMap)
            .filter(([amortName]) => matchToCostCat(amortName) === name)
            .reduce(
                (sum, [, values]) => ({ cur: sum.cur + values.cur, prev: sum.prev + values.prev }),
                { cur: 0, prev: 0 }
            );
        const amortExp = amortExpMap[name] || { cur: 0 };

        const costOpen = Math.abs(cost.prev);
        const costClose = Math.abs(cost.cur);
        const amortOpen = Math.abs(amort.prev);
        const amortClose = Math.abs(amort.cur);
        const amortCharge = Math.abs(amortExp.cur) || Math.max(0, amortClose - amortOpen);

        result.push({
            name,
            costOpening: costOpen,
            costAdditions: Math.max(0, costClose - costOpen),
            costDisposals: 0,
            costClosing: costClose,
            accAmortOpening: amortOpen,
            accAmortCharge: amortCharge,
            accAmortElimOnDisposal: Math.max(0, amortOpen + amortCharge - amortClose),
            accAmortClosing: amortClose,
        });
    }

    // BS-value fallback: if cost rows came up zero but amortisation exists and the BS
    // intangible_assets line has a value, derive cost from NBV + Accumulated Amortisation.
    if (intangibleBsValue && result.length > 0) {
        const totalCostClose = result.reduce((s, r) => s + r.costClosing, 0);
        const totalCostOpen = result.reduce((s, r) => s + r.costOpening, 0);
        const totalAmortClose = result.reduce((s, r) => s + r.accAmortClosing, 0);
        const totalAmortOpen = result.reduce((s, r) => s + r.accAmortOpening, 0);

        const distributeCost = (
            year: 'currentYear' | 'previousYear',
            closingField: 'costClosing' | 'costOpening',
            amortField: 'accAmortClosing' | 'accAmortOpening'
        ) => {
            const bsVal = intangibleBsValue[year] || 0;
            if (!bsVal) return;
            const impliedCost = Math.abs(bsVal) + result.reduce((s, r) => s + r[amortField], 0);
            if (impliedCost <= 0) return;
            const totalAmort = result.reduce((s, r) => s + r[amortField], 0);
            if (result.length === 1) {
                result[0][closingField] = impliedCost;
            } else if (totalAmort > 0) {
                for (const r of result) {
                    r[closingField] = (r[amortField] / totalAmort) * impliedCost;
                }
            } else {
                const share = impliedCost / result.length;
                for (const r of result) r[closingField] = share;
            }
        };

        if (totalCostClose === 0 && totalAmortClose > 0) {
            distributeCost('currentYear', 'costClosing', 'accAmortClosing');
        }
        if (totalCostOpen === 0 && totalAmortOpen > 0) {
            distributeCost('previousYear', 'costOpening', 'accAmortOpening');
        }

        for (const r of result) {
            r.costAdditions = Math.max(0, r.costClosing - r.costOpening);
        }
    }

    return result;
};
