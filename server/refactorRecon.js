const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../client/components/ReconciliationTable.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. imports
content = content.replace(
    /import \{\n    CheckIcon,\n    XMarkIcon,\n    ArrowsRightLeftIcon,\n    MagnifyingGlassIcon\n\} from '\.\/icons';/,
    `import {\n    CheckIcon,\n    XMarkIcon,\n    ArrowsRightLeftIcon,\n    MagnifyingGlassIcon,\n    ChevronDownIcon\n} from './icons';`
);

// 2. Props
content = content.replace(
    /initialMatches\?: Record<string, string>;\n    onMatchesChange\?: \(matches: Record<string, string>\) => void;/,
    `initialMatches?: Record<string, string[]>;\n    onMatchesChange?: (matches: Record<string, string[]>) => void;`
);

// 3. RowEvaluation interface
content = content.replace(
    /selectedInvoice\?: IndexedInvoice;/,
    `selectedInvoices: IndexedInvoice[];`
);

// 4. Manual matches state
content = content.replace(
    /const \[manualMatches, setManualMatches\] = useState<Record<string, string>>\(\{\}\);/,
    `const [manualMatches, setManualMatches] = useState<Record<string, string[]>>({});\n    const [activeDropdownRow, setActiveDropdownRow] = useState<string | null>(null);`
);

// 5. autoMatchedDefaults type
content = content.replace(
    /const defaults: Record<string, string> = \{\};/,
    `const defaults: Record<string, string[]> = {};`
);
content = content.replace(
    /defaults\[txRow.key\] = selected.key;/,
    `defaults[txRow.key] = [selected.key];`
);

// 6. hasHydratedInitialMatches
content = content.replace(
    /const hydrated: Record<string, string> = \{\};\n        Object\.entries\(initialMatches as Record<string, string>\)\.forEach\(\(\[txKey, invoiceKey\]\) => \{\n            const invoiceMatchKey = String\(invoiceKey\);\n            if \(validTxKeys\.has\(txKey\) && validInvoiceKeys\.has\(invoiceMatchKey\)\) \{\n                hydrated\[txKey\] = invoiceMatchKey;\n            \}\n        \}\);/,
    `const hydrated: Record<string, string[]> = {};
        Object.entries(initialMatches as Record<string, string[]>).forEach(([txKey, invoiceKeys]) => {
            if (validTxKeys.has(txKey)) {
                const validKeys = (Array.isArray(invoiceKeys) ? invoiceKeys : [invoiceKeys]).map(String).filter(k => validInvoiceKeys.has(k));
                if (validKeys.length > 0) {
                    hydrated[txKey] = validKeys;
                }
            }
        });`
);

// 7. manualMatches sync (setManualMatches prev => ...)
content = content.replace(
    /const next: Record<string, string> = \{\};\n            Object\.entries\(prev as Record<string, string>\)\.forEach\(\(\[txKey, invoiceKey\]\) => \{\n                const invoiceMatchKey = String\(invoiceKey\);\n                if \(validTxKeys\.has\(txKey\) && validInvoiceKeys\.has\(invoiceMatchKey\)\) \{\n                    next\[txKey\] = invoiceMatchKey;\n                \} else \{\n                    changed = true;\n                \}\n            \}\);/,
    `const next: Record<string, string[]> = {};
            Object.entries(prev as Record<string, string[]>).forEach(([txKey, invoiceKeys]) => {
                if (validTxKeys.has(txKey)) {
                    const validKeys = invoiceKeys.filter(k => validInvoiceKeys.has(k));
                    if (validKeys.length === invoiceKeys.length && validKeys.length > 0) {
                        next[txKey] = validKeys;
                    } else if (validKeys.length > 0) {
                        next[txKey] = validKeys;
                        changed = true;
                    } else {
                        changed = true;
                    }
                } else {
                    changed = true;
                }
            });`
);

// 8. autoMatchedDefaults sync effect
content = content.replace(
    /const usedInvoiceKeys = new Set\(Object\.values\(next\)\);/,
    `const usedInvoiceKeys = new Set(Object.values(next).flat());`
);
content = content.replace(
    /const suggested = autoMatchedDefaults\[txRow.key\];\n                if \(!suggested \|\| usedInvoiceKeys\.has\(suggested\)\) return;\n                next\[txRow.key\] = suggested;\n                usedInvoiceKeys\.add\(suggested\);\n                changed = true;/,
    `const suggested = autoMatchedDefaults[txRow.key];
                if (!suggested || suggested.some(k => usedInvoiceKeys.has(k))) return;
                next[txRow.key] = suggested;
                suggested.forEach(k => usedInvoiceKeys.add(k));
                changed = true;`
);

// 9. rowEvaluations
content = content.replace(
    /const selectedInvoiceKey = manualMatches\[row\.key\];\n            const selectedInvoice = selectedInvoiceKey \? invoiceByKey\.get\(selectedInvoiceKey\) : undefined;\n\n            if \(!selectedInvoice\) \{/,
    `const selectedInvoiceKeys = manualMatches[row.key] || [];
            const selectedInvoices = selectedInvoiceKeys.map(k => invoiceByKey.get(k)).filter(Boolean) as IndexedInvoice[];

            if (!selectedInvoices.length) {`
);

content = content.replace(
    /if \(row\.direction === 'none' \|\| row\.amount <= 0\) \{/,
    `// Provide selectedInvoices as empty array
            if (row.direction === 'none' || row.amount <= 0) {`
);
content = content.replace(
    /selectedInvoice,/g,
    `selectedInvoices,`
);

content = content.replace(
    /if \(selectedInvoice\.direction !== row\.direction\) \{/,
    `const hasDirectionMismatch = selectedInvoices.some(inv => inv.direction !== row.direction);
            if (hasDirectionMismatch) {`
);

content = content.replace(
    /if \(!isAmountMatch\(selectedInvoice\.amount, row\.amount\)\) \{/,
    `const sumInvoices = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);
            if (!isAmountMatch(sumInvoices, row.amount)) {`
);

// 10. getRowOptions
content = content.replace(
    /const selected = row\.selectedInvoice;\n        const options = \[\.\.\.filteredInvoiceOptions\];\n        if \(selected && !options\.some\(option => option\.key === selected\.key\)\) \{\n            options\.unshift\(selected\);\n        \}\n        return options;/,
    `const selected = row.selectedInvoices;
        const options = [...filteredInvoiceOptions];
        selected.forEach(sel => {
            if (!options.some(option => option.key === sel.key)) {
                options.unshift(sel);
            }
        });
        return options;`
);

// 11. getUsedInvoiceKeysByOtherRows
content = content.replace(
    /Object\.entries\(manualMatches as Record<string, string>\)\.forEach\(\(\[txKey, invoiceKey\]\) => \{\n            const invoiceMatchKey = String\(invoiceKey\);\n            if \(txKey !== currentTxKey && invoiceMatchKey\) \{\n                used\.add\(invoiceMatchKey\);\n            \}\n        \}\);/,
    `Object.entries(manualMatches as Record<string, string[]>).forEach(([txKey, invoiceKeys]) => {
            if (txKey !== currentTxKey) {
                invoiceKeys.forEach(k => used.add(k));
            }
        });`
);

// 12. Dropdown UI replacement
const oldDropdownCode = `                                        {!isAutoAmountMode ? (
                                            <select
                                                value={row.selectedInvoice?.key || ''}
                                                onChange={(event) => {
                                                    const selectedKey = event.target.value;
                                                    setManualMatches(prev => {
                                                        const next = { ...prev };
                                                        if (!selectedKey) {
                                                            delete next[row.row.key];
                                                        } else {
                                                            next[row.row.key] = selectedKey;
                                                        }
                                                        return next;
                                                    });
                                                }}
                                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                                            >
                                                <option value="">-- No Selected Invoice --</option>
                                                {rowOptions.map(option => {
                                                    const isTaken = usedByOthers.has(option.key);
                                                    return (
                                                        <option key={option.key} value={option.key} disabled={isTaken}>
                                                            {getInvoiceOptionLabel(option, currency, isTaken)}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        ) : (
                                            <div className={\`w-full px-3 py-2 rounded-lg border text-sm \${row.selectedInvoice ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-background text-muted-foreground'}\`}>
                                                {row.selectedInvoice ? 'Matching invoice found' : 'No matching invoice found'}
                                            </div>
                                        )}
                                        {row.selectedInvoice && (
                                            <div className="mt-3 p-2 rounded-md border border-border bg-background/50">
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="font-semibold text-foreground">{row.selectedInvoice.invoice.invoiceId || 'No ID'}</span>
                                                    <span className={\`text-[10px] uppercase tracking-widest px-2 py-1 rounded border \${row.selectedInvoice.invoice.invoiceType === 'sales'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                        }\`}>
                                                        {row.selectedInvoice.invoice.invoiceType === 'sales' ? 'Sales' : 'Purchase'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-muted-foreground truncate mt-1" title={row.selectedInvoice.partyName}>
                                                    {row.selectedInvoice.partyName || 'No party name'}
                                                </p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-xs text-muted-foreground">{formatDate(row.selectedInvoice.invoice.invoiceDate)}</span>
                                                    <span className="text-xs font-mono font-semibold text-foreground">
                                                        {formatAmount(row.selectedInvoice.amount)} {currency}
                                                    </span>
                                                </div>
                                            </div>
                                        )}`;

const newDropdownCode = `                                        {!isAutoAmountMode ? (
                                            <div className="relative">
                                                <div 
                                                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm flex justify-between items-center cursor-pointer hover:bg-muted/10"
                                                    onClick={() => setActiveDropdownRow(activeDropdownRow === row.row.key ? null : row.row.key)}
                                                >
                                                    <span className="truncate">
                                                        {row.selectedInvoices.length === 0 
                                                            ? '-- No Selected Invoice --' 
                                                            : \`\${row.selectedInvoices.length} Selected (\${formatAmount(row.selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0))} \${currency})\`}
                                                    </span>
                                                    <ChevronDownIcon className="w-4 h-4 ml-2 text-muted-foreground" />
                                                </div>
                                                
                                                {activeDropdownRow === row.row.key && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setActiveDropdownRow(null)}></div>
                                                        <div className="absolute z-20 w-full mt-1 max-h-60 overflow-y-auto bg-card rounded-md shadow-lg border border-border p-1 text-sm left-0">
                                                            {rowOptions.length === 0 && (
                                                                <div className="p-2 text-muted-foreground text-center">No options available</div>
                                                            )}
                                                            {rowOptions.map(option => {
                                                                const isTaken = usedByOthers.has(option.key);
                                                                const isSelected = row.selectedInvoices.some(s => s.key === option.key);
                                                                return (
                                                                    <label 
                                                                        key={option.key} 
                                                                        className={\`flex items-start p-2 hover:bg-muted/50 rounded cursor-pointer \${isTaken && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}\`}
                                                                    >
                                                                        <input 
                                                                            type="checkbox" 
                                                                            className="mt-1 mr-2 bg-background border-border"
                                                                            checked={isSelected}
                                                                            disabled={isTaken && !isSelected}
                                                                            onChange={(e) => {
                                                                                setManualMatches(prev => {
                                                                                    const next = { ...prev };
                                                                                    const currentSelection = next[row.row.key] || [];
                                                                                    if (e.target.checked) {
                                                                                        next[row.row.key] = [...currentSelection, option.key];
                                                                                    } else {
                                                                                        next[row.row.key] = currentSelection.filter(k => k !== option.key);
                                                                                        if (next[row.row.key].length === 0) delete next[row.row.key];
                                                                                    }
                                                                                    return next;
                                                                                });
                                                                            }}
                                                                        />
                                                                        <span className="flex-1 leading-tight text-xs">
                                                                            {getInvoiceOptionLabel(option, currency, isTaken && !isSelected)}
                                                                        </span>
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <div className={\`w-full px-3 py-2 rounded-lg border text-sm \${row.selectedInvoices.length > 0 ? 'border-green-500/30 bg-green-500/5' : 'border-border bg-background text-muted-foreground'}\`}>
                                                {row.selectedInvoices.length > 0 ? 'Matching invoice(s) found' : 'No matching invoice found'}
                                            </div>
                                        )}
                                        {row.selectedInvoices.length > 0 && (
                                            <div className="mt-3 flex flex-col gap-2">
                                                {row.selectedInvoices.map((inv, idx) => (
                                                    <div key={idx} className="p-2 rounded-md border border-border bg-background/50 relative">
                                                        <div className="flex justify-between items-center gap-2">
                                                            <span className="font-semibold text-foreground text-xs">{inv.invoice.invoiceId || 'No ID'}</span>
                                                            <span className={\`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border \${inv.invoice.invoiceType === 'sales'
                                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                                : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                                }\`}>
                                                                {inv.invoice.invoiceType === 'sales' ? 'Sales' : 'Purchase'}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-muted-foreground truncate mt-1" title={inv.partyName}>
                                                            {inv.partyName || 'No party name'}
                                                        </p>
                                                        <div className="flex justify-between items-center mt-1">
                                                            <span className="text-[10px] text-muted-foreground">{formatDate(inv.invoice.invoiceDate)}</span>
                                                            <span className="text-xs font-mono font-semibold text-foreground">
                                                                {formatAmount(inv.amount)} {currency}
                                                            </span>
                                                        </div>
                                                        {!isAutoAmountMode && (
                                                            <button 
                                                                onClick={() => {
                                                                    setManualMatches(prev => {
                                                                        const next = { ...prev };
                                                                        const currentSelection = next[row.row.key] || [];
                                                                        next[row.row.key] = currentSelection.filter(k => k !== inv.key);
                                                                        if (next[row.row.key].length === 0) delete next[row.row.key];
                                                                        return next;
                                                                    });
                                                                }}
                                                                className="absolute -top-2 -right-2 bg-background border border-border rounded-full w-5 h-5 flex items-center justify-center hover:bg-destructive/10 text-destructive shadow-sm"
                                                            >
                                                                <XMarkIcon className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                {row.selectedInvoices.length > 1 && (
                                                    <div className="p-2 rounded-md border border-primary/50 bg-primary/10 flex justify-between items-center mt-1">
                                                        <span className="text-[10px] font-bold text-primary uppercase">Total Selected</span>
                                                        <span className="text-xs font-mono font-bold text-primary tracking-wide">
                                                            {formatAmount(row.selectedInvoices.reduce((sum, i) => sum + i.amount, 0))} {currency}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}`;

content = content.replace(oldDropdownCode, newDropdownCode);

fs.writeFileSync(targetFile, content, 'utf8');
console.log('ReconciliationTable refactored successfully.');
