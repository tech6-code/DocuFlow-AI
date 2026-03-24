import React, { useState, useEffect, useMemo } from 'react';
import type { FixedAssetCategory, WorkingNoteEntry } from '../types';
import { PlusIcon, XMarkIcon, TrashIcon, ExclamationTriangleIcon, ChevronLeftIcon } from './icons';

const formatAccounting = (val: number): string => {
    if (Math.abs(val) < 0.5) return '-';
    const rounded = Math.round(val);
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.abs(rounded));
    return rounded < 0 ? `(${formatted})` : formatted;
};

interface FixedAssetScheduleProps {
    categories: FixedAssetCategory[];
    onChange: (categories: FixedAssetCategory[]) => void;
    onClose: () => void;
    currency?: string;
    periodEnd?: string;
    previousPeriodEnd?: string;
}

const EditableCell = ({ value, onChange, className = '' }: {
    value: number;
    onChange: (val: number) => void;
    className?: string;
}) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (!isFocused) {
            setLocalValue(value === 0 ? '' : Math.round(value).toString());
        }
    }, [value, isFocused]);

    return (
        <input
            type="text"
            inputMode="decimal"
            value={isFocused ? localValue : (value === 0 ? '' : formatAccounting(value))}
            onChange={(e) => {
                setLocalValue(e.target.value);
                const cleaned = e.target.value.replace(/,/g, '').replace(/[()]/g, '');
                const parsed = parseFloat(cleaned);
                if (!isNaN(parsed)) onChange(Math.round(parsed));
                else if (e.target.value === '' || e.target.value === '-') onChange(0);
            }}
            onFocus={() => {
                setIsFocused(true);
                setLocalValue(value === 0 ? '' : Math.round(value).toString());
            }}
            onBlur={() => setIsFocused(false)}
            className={`w-full text-right bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-2 py-1.5 font-mono text-sm outline-none transition-colors text-foreground ${className}`}
            placeholder="0"
        />
    );
};

const ReadOnlyCell = ({ value, bold = false, highlight = false }: { value: number; bold?: boolean; highlight?: boolean }) => (
    <div className={`text-right px-2 py-1.5 font-mono text-sm ${bold ? 'font-bold text-foreground' : 'text-muted-foreground'} ${highlight ? 'bg-primary/5' : ''}`}>
        {formatAccounting(value)}
    </div>
);

export const FixedAssetSchedule: React.FC<FixedAssetScheduleProps> = ({
    categories,
    onChange,
    onClose,
    currency = 'AED',
    periodEnd = 'December 31, 2024',
    previousPeriodEnd = 'December 31, 2023'
}) => {
    const [editingHeader, setEditingHeader] = useState<number | null>(null);

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
                                    <td key={i}><EditableCell value={cat.costOpening} onChange={(v) => updateCategory(i, 'costOpening', v)} /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.costOpening} bold /></td>
                            </tr>

                            {/* Additions */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Additions during the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><EditableCell value={cat.costAdditions} onChange={(v) => updateCategory(i, 'costAdditions', v)} className="bg-primary/5 border-primary/20" /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.costAdditions} bold /></td>
                            </tr>

                            {/* Disposals */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Deductions during the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><EditableCell value={cat.costDisposals} onChange={(v) => updateCategory(i, 'costDisposals', v)} className="bg-primary/5 border-primary/20" /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.costDisposals} bold /></td>
                            </tr>

                            {/* Closing */}
                            <tr className="border-b-2 border-border hover:bg-muted/20">
                                <td className="px-3 py-1 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i} className="relative">
                                        <EditableCell value={cat.costClosing} onChange={(v) => updateCategory(i, 'costClosing', v)} />
                                        {costWarnings[i] && (
                                            <div className="absolute right-1 top-0.5" title={`Expected: ${formatAccounting(cat.costOpening + cat.costAdditions - cat.costDisposals)}`}>
                                                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-status-warning" />
                                            </div>
                                        )}
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
                                    <td key={i}><EditableCell value={cat.accDepOpening} onChange={(v) => updateCategory(i, 'accDepOpening', v)} /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.accDepOpening} bold /></td>
                            </tr>

                            {/* Charge for year */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Depreciation for the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><EditableCell value={cat.accDepCharge} onChange={(v) => updateCategory(i, 'accDepCharge', v)} className="bg-primary/5 border-primary/20" /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.accDepCharge} bold /></td>
                            </tr>

                            {/* Eliminated on disposal */}
                            <tr className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-3 py-1 text-muted-foreground">Deductions during the year</td>
                                {categories.map((cat, i) => (
                                    <td key={i}><EditableCell value={cat.accDepElimOnDisposal} onChange={(v) => updateCategory(i, 'accDepElimOnDisposal', v)} className="bg-primary/5 border-primary/20" /></td>
                                ))}
                                <td><ReadOnlyCell value={totals.accDepElimOnDisposal} bold /></td>
                            </tr>

                            {/* Dep Closing */}
                            <tr className="border-b-2 border-border hover:bg-muted/20">
                                <td className="px-3 py-1 font-bold text-foreground">As at {periodEnd}</td>
                                {categories.map((cat, i) => (
                                    <td key={i} className="relative">
                                        <EditableCell value={cat.accDepClosing} onChange={(v) => updateCategory(i, 'accDepClosing', v)} />
                                        {depWarnings[i] && (
                                            <div className="absolute right-1 top-0.5" title={`Expected: ${formatAccounting(cat.accDepOpening + cat.accDepCharge - cat.accDepElimOnDisposal)}`}>
                                                <ExclamationTriangleIcon className="w-3.5 h-3.5 text-status-warning" />
                                            </div>
                                        )}
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
 * Initialize FixedAssetCategory[] from BS working notes (property_plant_equipment).
 * Extracts cost accounts and accumulated depreciation accounts, groups by category name.
 */
export const initFixedAssetsFromWorkingNotes = (
    bsNotes: WorkingNoteEntry[],
    pnlDepNotes?: WorkingNoteEntry[]
): FixedAssetCategory[] => {
    if (!bsNotes || bsNotes.length === 0) return [];

    const cleanDesc = (d: string) => d.replace(/\[Grouped Selected TB\]\s*/i, '').trim();
    const isAccDep = (d: string) => /^accumulated\s+depreci?ation/i.test(d);
    const stripAccDep = (d: string) => d.replace(/^accumulated\s+depreci?ation\s*(of|on|[-–—])?\s*/i, '').trim();

    // Build cost map: { categoryName: { cur, prev } }
    const costMap: Record<string, { cur: number; prev: number }> = {};
    const accDepMap: Record<string, { cur: number; prev: number }> = {};

    for (const note of bsNotes) {
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
            const stripped = stripAccDep(desc) || desc;
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
        const depKey = Object.keys(accDepMap).find(k => matchToCostCat(k) === name);
        const accDep = depKey ? accDepMap[depKey] : { cur: 0, prev: 0 };
        const depExp = depExpMap[name] || { cur: 0 };

        result.push({
            name,
            costOpening: Math.abs(cost.prev),
            costAdditions: Math.max(0, Math.abs(cost.cur) - Math.abs(cost.prev)),
            costDisposals: Math.max(0, Math.abs(cost.prev) - Math.abs(cost.cur)),
            costClosing: Math.abs(cost.cur),
            accDepOpening: Math.abs(accDep.prev),
            accDepCharge: Math.abs(depExp.cur) || Math.max(0, Math.abs(accDep.cur) - Math.abs(accDep.prev)),
            accDepElimOnDisposal: 0,
            accDepClosing: Math.abs(accDep.cur),
        });
    }

    return result;
};
