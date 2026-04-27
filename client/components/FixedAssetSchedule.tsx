import React, { useState, useEffect, useMemo } from 'react';
import type { FixedAssetCategory, WorkingNoteEntry } from '../types';
import { PlusIcon, XMarkIcon, TrashIcon, ExclamationTriangleIcon, ChevronLeftIcon } from './icons';

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

interface FixedAssetScheduleProps {
    categories: FixedAssetCategory[];
    onChange: (categories: FixedAssetCategory[]) => void;
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

export const FixedAssetSchedule: React.FC<FixedAssetScheduleProps> = ({
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
            // Additions = Closing - Opening + Disposals (to balance the equation)
            const expectedAdditions = Math.max(0, cat.costClosing - cat.costOpening + cat.costDisposals);
            // Dep eliminations = Opening + Charge - Closing
            const expectedElim = Math.max(0, cat.accDepOpening + cat.accDepCharge - cat.accDepClosing);

            if (Math.abs(cat.costAdditions - expectedAdditions) > 0.5 ||
                Math.abs(cat.accDepElimOnDisposal - expectedElim) > 0.5) {
                needsUpdate = true;
                return { ...cat, costAdditions: expectedAdditions, accDepElimOnDisposal: expectedElim };
            }
            return cat;
        });

        if (needsUpdate) onChange(updated);
    }, [categories, trialBalanceLocked]);

    const updateCategory = (index: number, field: keyof FixedAssetCategory, value: number | string) => {
        const updated = categories.map((cat, i) => i === index ? { ...cat, [field]: value } : cat);
        onChange(updated);
    };

    const addCategory = () => {
        onChange([...categories, {
            name: 'New Asset Category',
            costOpening: 0, costAdditions: 0, costDisposals: 0, costClosing: 0,
            accDepOpening: 0, accDepCharge: 0, accDepElimOnDisposal: 0, accDepClosing: 0
        }]);
    };

    const removeCategory = (index: number) => {
        if (categories.length <= 1) return;
        onChange(categories.filter((_, i) => i !== index));
    };

    // Totals row
    const totals = useMemo(() => {
        const sum = (field: keyof FixedAssetCategory) => categories.reduce((s, c) => s + (typeof c[field] === 'number' ? c[field] as number : 0), 0);
        return {
            costOpening: sum('costOpening'), costAdditions: sum('costAdditions'),
            costDisposals: sum('costDisposals'), costClosing: sum('costClosing'),
            accDepOpening: sum('accDepOpening'), accDepCharge: sum('accDepCharge'),
            accDepElimOnDisposal: sum('accDepElimOnDisposal'), accDepClosing: sum('accDepClosing'),
        };
    }, [categories]);

    // Validation
    const costWarnings = useMemo(() => categories.map(cat => {
        const expected = cat.costOpening + cat.costAdditions - cat.costDisposals;
        return Math.abs(expected - cat.costClosing) > 0.5;
    }), [categories]);

    const depWarnings = useMemo(() => categories.map(cat => {
        const expected = cat.accDepOpening + cat.accDepCharge - cat.accDepElimOnDisposal;
        return Math.abs(expected - cat.accDepClosing) > 0.5;
    }), [categories]);

    const nbvCurrent = (cat: FixedAssetCategory) => cat.costClosing - Math.abs(cat.accDepClosing);
    const nbvPrevious = (cat: FixedAssetCategory) => cat.costOpening - Math.abs(cat.accDepOpening);
    const totalNbvCurrent = totals.costClosing - Math.abs(totals.accDepClosing);
    const totalNbvPrevious = totals.costOpening - Math.abs(totals.accDepOpening);

    const colCount = categories.length + 2; // description + categories + total

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Fixed Asset Schedule</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Property, Plant & Equipment breakdown ({currency})</p>
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

                {/* Table */}
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

                            {/* Opening */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">As at {previousPeriodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i}>
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.costOpening} />
                                            : <EditableCell value={cat.costOpening} onChange={(v) => updateCategory(i, 'costOpening', v)} />}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.costOpening} bold /></td>
                            </tr>

                            {/* Additions - auto-calculated when locked */}
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

                            {/* Disposals - editable */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Deductions during the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><EditableCell value={cat.costDisposals} onChange={(v) => updateCategory(i, 'costDisposals', v)} className="bg-primary/5 border-primary/20" displayInBrackets /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.costDisposals} bold displayInBrackets /></td>
                            </tr>

                            {/* Closing */}
                            <tr className="border-b-2 border-border hover:bg-muted/20">
                                <td className="px-3 py-1 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i} className="relative">
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.costClosing} bold />
                                            : <>
                                                <EditableCell value={cat.costClosing} onChange={(v) => updateCategory(i, 'costClosing', v)} />
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

                            {/* Spacer */}
                            <tr><td colSpan={colCount} className="h-3"></td></tr>

                            {/* ===== ACCUMULATED DEPRECIATION SECTION ===== */}
                            <tr className="bg-muted/50">
                                <td colSpan={colCount} className="px-3 py-2 text-xs font-black text-foreground uppercase tracking-wider italic">Accumulated Depreciation</td>
                            </tr>

                            {/* Dep Opening */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">As at {previousPeriodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i}>
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.accDepOpening} />
                                            : <EditableCell value={cat.accDepOpening} onChange={(v) => updateCategory(i, 'accDepOpening', v)} />}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.accDepOpening} bold /></td>
                            </tr>

                            {/* Charge for year - from trial balance when locked */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Depreciation for the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}>
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.accDepCharge} />
                                            : <EditableCell value={cat.accDepCharge} onChange={(v) => updateCategory(i, 'accDepCharge', v)} className="bg-primary/5 border-primary/20" />}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.accDepCharge} bold /></td>
                            </tr>

                            {/* Eliminated on disposal - auto-calculated when locked */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Deductions during the year</td>
                                {categories.map((cat, i) => {
                                    const computedElim = trialBalanceLocked
                                        ? Math.max(0, cat.accDepOpening + cat.accDepCharge - cat.accDepClosing)
                                        : cat.accDepElimOnDisposal;
                                    return (
                                        <td key={i}>
                                            {trialBalanceLocked
                                                ? <ReadOnlyCell value={computedElim} displayInBrackets />
                                                : <EditableCell value={cat.accDepElimOnDisposal} onChange={(v) => updateCategory(i, 'accDepElimOnDisposal', v)} className="bg-primary/5 border-primary/20" displayInBrackets />}
                                        </td>
                                    );
                                })}
                                <td><ReadOnlyCell value={trialBalanceLocked ? categories.reduce((s, c) => s + Math.max(0, c.accDepOpening + c.accDepCharge - c.accDepClosing), 0) : totals.accDepElimOnDisposal} bold displayInBrackets /></td>
                            </tr>

                            {/* Dep Closing */}
                            <tr className="border-b-2 border-border hover:bg-muted/20">
                                <td className="px-3 py-1 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i} className="relative">
                                        {trialBalanceLocked
                                            ? <ReadOnlyCell value={cat.accDepClosing} bold />
                                            : <>
                                                <EditableCell value={cat.accDepClosing} onChange={(v) => updateCategory(i, 'accDepClosing', v)} />
                                                {depWarnings[i] && (
                                                    <div className="absolute right-1 top-0.5" title={`Expected: ${formatAccounting(cat.accDepOpening + cat.accDepCharge - cat.accDepElimOnDisposal)}`}>
                                                        <ExclamationTriangleIcon className="w-3.5 h-3.5 text-status-warning" />
                                                    </div>
                                                )}
                                            </>}
                                    </td>
                                ))}
                                <td><ReadOnlyCell value={totals.accDepClosing} bold /></td>
                            </tr>

                            {/* Spacer */}
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

                    {/* Validation warnings */}
                    {(costWarnings.some(Boolean) || depWarnings.some(Boolean)) && (
                        <div className="mt-4 p-3 bg-status-warning-soft/20 border border-status-warning/30 rounded-lg">
                            <div className="flex items-center gap-2 text-xs font-bold text-status-warning mb-1">
                                <ExclamationTriangleIcon className="w-4 h-4" /> Validation Warnings
                            </div>
                            {costWarnings.map((warn, i) => warn && (
                                <div key={`c-${i}`} className="text-xs text-muted-foreground ml-6">
                                    {categories[i].name}: Cost closing ({formatAccounting(categories[i].costClosing)}) does not match Opening + Additions - Disposals ({formatAccounting(categories[i].costOpening + categories[i].costAdditions - categories[i].costDisposals)})
                                </div>
                            ))}
                            {depWarnings.map((warn, i) => warn && (
                                <div key={`d-${i}`} className="text-xs text-muted-foreground ml-6">
                                    {categories[i].name}: Depreciation closing ({formatAccounting(categories[i].accDepClosing)}) does not match Opening + Charge - Eliminated ({formatAccounting(categories[i].accDepOpening + categories[i].accDepCharge - categories[i].accDepElimOnDisposal)})
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border bg-muted/50 flex justify-between items-center shrink-0">
                    <div className="text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{categories.length}</span> asset {categories.length === 1 ? 'category' : 'categories'} &middot; Net Book Value: <span className="font-bold text-foreground">{currency} {formatAccounting(totalNbvCurrent)}</span>
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
 * PPE movement schedule entry from audit report extraction.
 * If available, this is used as the primary source for fixed asset initialization.
 */
export interface PpeMovementEntry {
    category: string;
    costOpening?: number | null;
    costAdditions?: number | null;
    costDisposals?: number | null;
    costClosing?: number | null;
    depOpening?: number | null;
    depCharge?: number | null;
    depDisposals?: number | null;
    depClosing?: number | null;
}

/**
 * Initialize FixedAssetCategory[] from BS working notes (property_plant_equipment).
 * If ppeMovementSchedule is available from the audit report extraction, use it as primary source.
 * Otherwise, extracts cost accounts and accumulated depreciation accounts, groups by category name.
 */
export const initFixedAssetsFromWorkingNotes = (
    bsNotes: WorkingNoteEntry[] | Record<string, WorkingNoteEntry[]>,
    pnlDepNotes?: WorkingNoteEntry[],
    ppeMovementSchedule?: PpeMovementEntry[]
): FixedAssetCategory[] => {
    // If PPE movement schedule is available from extraction, use it directly
    if (Array.isArray(ppeMovementSchedule) && ppeMovementSchedule.length > 0) {
        return ppeMovementSchedule
            .filter(entry => entry.category && entry.category.trim())
            .map(entry => ({
                name: entry.category.trim(),
                costOpening: Math.abs(entry.costOpening || 0),
                costAdditions: Math.abs(entry.costAdditions || 0),
                costDisposals: Math.abs(entry.costDisposals || 0),
                costClosing: Math.abs(entry.costClosing || 0),
                accDepOpening: Math.abs(entry.depOpening || 0),
                accDepCharge: Math.abs(entry.depCharge || 0),
                accDepElimOnDisposal: Math.abs(entry.depDisposals || 0),
                accDepClosing: Math.abs(entry.depClosing || 0),
            }));
    }

    let relevantBsNotes = Array.isArray(bsNotes) ? bsNotes : Object.values(bsNotes).flat();
    if (relevantBsNotes.length === 0) return [];

    const cleanDesc = (d: string) => d.replace(/\[Grouped Selected TB\]\s*/i, '').trim();
    const isAccDep = (d: string) => /^accumulated\s+depreci?ation/i.test(d);
    const normalizeName = (value: string) => cleanDesc(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const fixedAssetKeywords = [
        'asset', 'plant', 'equipment', 'machinery', 'machine', 'motor', 'vehicle', 'furniture',
        'fixture', 'computer', 'office', 'tool', 'leasehold', 'building', 'warehouse',
        'truck', 'container', 'generator', 'air condition',
        'signboard', 'renovation', 'freehold', 'right of use',
        'laptop', 'monitor', 'printer', 'scanner', 'phone', 'tablet',
        'electronic', 'it equipment', 'hardware'
    ];
    const exactMatchKeywords = ['car', 'van', 'bus', 'tv'];
    const excludedKeywords = [
        'cash', 'bank', 'current', 'receivable', 'payable', 'inventory', 'stock', 'prepaid', 'deposit',
        'vat', 'tax', 'loan', 'borrow', 'equity', 'capital', 'retained', 'revenue', 'income',
        'expense', 'liabil', 'intangible', 'goodwill', 'patent', 'trademark',
        'software', 'license', 'licence', 'copyright', 'copywright', 'brand', 'franchise', 'amorti'
    ];
    const isLikelyFixedAssetName = (value: string) => {
        const normalized = normalizeName(value);
        if (!normalized) return false;
        if (excludedKeywords.some(keyword => normalized.includes(keyword))) return false;
        if (fixedAssetKeywords.some(keyword => normalized.includes(keyword))) return true;
        return exactMatchKeywords.some(kw => new RegExp(`\\b${kw}s?\\b`).test(normalized));
    };
    const stripAccDep = (d: string) => d.replace(/^accumulated\s+depreci?ation\s*(of|on|[-–—])?\s*/i, '').trim();
    const stripDepreciation = (d: string) => d.replace(/^depreci?ation\s*(of|on|for|[-–—])?\s*/i, '').trim();

    // Reject intangible-side accounts (Software/Patent/Goodwill/Accumulated Amortisation/etc.)
    // even when they happen to be filed under property_plant_equipment in saved data
    // — those belong to the Intangible Asset Schedule, not the Fixed Asset Schedule.
    const INTANGIBLE_DESC_KEYWORDS = [
        'intangible', 'goodwill', 'patent', 'trademark', 'trade mark',
        'copyright', 'copywright', 'license', 'licence', 'software', 'brand',
        'franchise', 'formula', 'domain'
    ];
    const isIntangibleSideDesc = (raw: string) => {
        const lower = String(raw || '').toLowerCase();
        if (/amorti[sz]/i.test(lower)) return true;
        return INTANGIBLE_DESC_KEYWORDS.some(k => lower.includes(k));
    };

    if (!Array.isArray(bsNotes)) {
        relevantBsNotes = Object.entries(bsNotes).flatMap(([key, notes]) =>
            (notes || []).filter(note => {
                const desc = cleanDesc(note.description || '');
                if (!desc) return false;
                if (isIntangibleSideDesc(desc)) return false;
                if (key === 'property_plant_equipment') return true;
                if (isAccDep(desc)) return true;
                return isLikelyFixedAssetName(desc) || isLikelyFixedAssetName(key.replace(/^custom_/, '').replace(/_/g, ' '));
            })
        );
    }
    if (relevantBsNotes.length === 0) return [];

    // Build cost map: { categoryName: { cur, prev } }
    const costMap: Record<string, { cur: number; prev: number }> = {};
    const accDepMap: Record<string, { cur: number; prev: number }> = {};

    for (const note of relevantBsNotes) {
        const desc = cleanDesc(note.description);
        if (!desc) continue;

        const cur = note.currentYearAmount ?? note.amount ?? 0;
        const prev = note.previousYearAmount ?? 0;

        if (isAccDep(desc)) {
            const catName = stripAccDep(desc) || desc;
            if (!accDepMap[catName]) accDepMap[catName] = { cur: 0, prev: 0 };
            accDepMap[catName].cur += cur;
            accDepMap[catName].prev += prev;
        } else {
            if (!costMap[desc]) costMap[desc] = { cur: 0, prev: 0 };
            costMap[desc].cur += cur;
            costMap[desc].prev += prev;
        }
    }

    // Match accumulated depreciation to cost categories using fuzzy matching
    const costCategories = Object.keys(costMap);
    const matchToCostCat = (depCatName: string): string => {
        const lower = depCatName.toLowerCase();
        return costCategories.find(c => c.toLowerCase() === lower)
            || costCategories.find(c => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()))
            || depCatName;
    };

    // Build depreciation expense map from P&L notes
    const depExpMap: Record<string, { cur: number }> = {};
    if (pnlDepNotes) {
        for (const note of pnlDepNotes) {
            const desc = cleanDesc(note.description);
            if (!desc) continue;
            // Strip both "Accumulated Depreciation ..." and "Depreciation ..." prefixes
            const stripped = stripAccDep(desc) !== desc ? stripAccDep(desc) : (stripDepreciation(desc) || desc);
            const matched = matchToCostCat(stripped);
            if (!depExpMap[matched]) depExpMap[matched] = { cur: 0 };
            depExpMap[matched].cur += (note.currentYearAmount ?? note.amount ?? 0);
        }
    }

    // Build categories
    const allCatNames = new Set([...costCategories]);
    // Also add accDep categories that didn't match to ensure no data is lost
    for (const depCat of Object.keys(accDepMap)) {
        const matched = matchToCostCat(depCat);
        if (!costMap[matched]) allCatNames.add(depCat);
    }

    const result: FixedAssetCategory[] = [];
    for (const name of allCatNames) {
        const cost = costMap[name] || { cur: 0, prev: 0 };
        const accDep = Object.entries(accDepMap)
            .filter(([depName]) => matchToCostCat(depName) === name)
            .reduce(
                (sum, [, values]) => ({ cur: sum.cur + values.cur, prev: sum.prev + values.prev }),
                { cur: 0, prev: 0 }
            );
        const depExp = depExpMap[name] || { cur: 0 };

        const costOpen = Math.abs(cost.prev);
        const costClose = Math.abs(cost.cur);
        const depOpen = Math.abs(accDep.prev);
        const depClose = Math.abs(accDep.cur);
        const depCharge = Math.abs(depExp.cur) || Math.max(0, depClose - depOpen);
        // Additions & disposals will be auto-calculated by the component when trialBalanceLocked=true
        // Initialize disposals to 0, additions = closing - opening (net difference)
        result.push({
            name,
            costOpening: costOpen,
            costAdditions: Math.max(0, costClose - costOpen),
            costDisposals: 0,
            costClosing: costClose,
            accDepOpening: depOpen,
            accDepCharge: depCharge,
            accDepElimOnDisposal: Math.max(0, depOpen + depCharge - depClose),
            accDepClosing: depClose,
        });
    }

    return result;
};

/**
 * Determines if a trial balance account name is a fixed asset or accumulated depreciation account.
 * Used by all CT types to route these accounts to property_plant_equipment in BS mapping
 * and exclude them from other working notes.
 */
export const isFixedAssetAccount = (accountName: string): boolean => {
    const lower = accountName.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Accumulated depreciation of fixed assets
    if (/accumulated\s+depreci/i.test(lower)) return true;

    const fixedAssetKeywords = [
        'plant', 'equipment', 'machinery', 'machine', 'motor vehicle', 'vehicle',
        'furniture', 'fixture', 'tool', 'leasehold', 'building', 'warehouse',
        'office supplies', 'office equipment', 'computer', 'ppe',
        'truck', 'container', 'generator', 'air condition',
        'signboard', 'renovation', 'freehold', 'right of use',
        'laptop', 'monitor', 'printer', 'scanner', 'phone', 'tablet',
        'electronic', 'it equipment', 'hardware'
    ];
    // Short keywords that need word-boundary matching to avoid false positives
    const exactMatchKeywords = ['car', 'van', 'bus', 'tv'];
    const excludedKeywords = [
        'cash', 'bank', 'receivable', 'payable', 'inventory', 'stock', 'prepaid',
        'vat', 'tax', 'loan', 'borrow', 'equity', 'capital', 'retained', 'revenue',
        'income', 'expense', 'liabil', 'intangible', 'goodwill', 'patent', 'trademark',
        'advance', 'deposit', 'current asset',
        'software', 'license', 'licence', 'copyright', 'copywright', 'brand', 'franchise', 'amorti'
    ];

    if (excludedKeywords.some(kw => lower.includes(kw))) return false;
    if (fixedAssetKeywords.some(kw => lower.includes(kw))) return true;
    // Word-boundary match for short keywords (e.g. "car" should not match "discard")
    return exactMatchKeywords.some(kw => new RegExp(`\\b${kw}s?\\b`).test(lower));
};
