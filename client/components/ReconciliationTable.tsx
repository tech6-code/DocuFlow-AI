import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Invoice, Transaction } from '../types';
import {
    CheckIcon,
    XMarkIcon,
    ArrowsRightLeftIcon,
    MagnifyingGlassIcon
} from './icons';

interface ReconciliationTableProps {
    invoices: Invoice[];
    transactions: Transaction[];
    currency: string;
    initialMatches?: Record<string, string>;
    onMatchesChange?: (matches: Record<string, string>) => void;
}

type MatchStatus = 'Matched' | 'Unmatched';
type PaymentStatusFilter = 'ALL' | 'PAID' | 'UNPAID';
type RowFilter = 'ALL' | 'MATCHED' | 'UNMATCHED';

interface IndexedInvoice {
    key: string;
    invoice: Invoice;
    amount: number;
    direction: 'credit' | 'debit';
    partyName: string;
    paymentStatus: 'paid' | 'unpaid' | 'unknown';
    searchableText: string;
}

interface IndexedTransaction {
    key: string;
    rowIndex: number;
    transaction: Transaction;
    amount: number;
    direction: 'credit' | 'debit' | 'none';
    searchableText: string;
}

interface RowEvaluation {
    row: IndexedTransaction;
    selectedInvoice?: IndexedInvoice;
    status: MatchStatus;
    reason: string;
}

const AMOUNT_TOLERANCE = 0.1;

const normalizeText = (value: unknown) =>
    String(value ?? '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const parseDateToTime = (dateStr: string) => {
    const ts = new Date(dateStr).getTime();
    return Number.isFinite(ts) ? ts : 0;
};

const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount || 0);
};

const getInvoiceAmount = (invoice: Invoice) =>
    Number(invoice.totalAmountAED ?? invoice.totalAmount ?? 0) || 0;

const getInvoiceDirection = (invoice: Invoice): 'credit' | 'debit' =>
    invoice.invoiceType === 'sales' ? 'credit' : 'debit';

const getInvoicePartyName = (invoice: Invoice) =>
    invoice.invoiceType === 'sales'
        ? (invoice.customerName || invoice.vendorName || '')
        : (invoice.vendorName || invoice.customerName || '');

const getInvoicePaymentStatus = (invoice: Invoice): 'paid' | 'unpaid' | 'unknown' => {
    const normalized = normalizeText(invoice.paymentStatus || invoice.status || '');
    if (normalized.includes('unpaid')) return 'unpaid';
    if (normalized.includes('paid')) return 'paid';
    return 'unknown';
};

const getInvoiceKey = (invoice: Invoice, index: number) => {
    const amount = getInvoiceAmount(invoice);
    const party = getInvoicePartyName(invoice);
    return [
        invoice.invoiceType || 'unknown',
        invoice.invoiceId || `idx-${index}`,
        invoice.invoiceDate || '',
        amount.toFixed(2),
        normalizeText(party),
        index
    ].join('|');
};

const getTransactionDirection = (transaction: Transaction): 'credit' | 'debit' | 'none' => {
    const credit = Number(transaction.credit) || 0;
    const debit = Number(transaction.debit) || 0;

    if (credit > 0 && credit >= debit) return 'credit';
    if (debit > 0 && debit > credit) return 'debit';
    return 'none';
};

const getTransactionAmount = (transaction: Transaction) => {
    const direction = getTransactionDirection(transaction);
    if (direction === 'credit') return Number(transaction.credit) || 0;
    if (direction === 'debit') return Number(transaction.debit) || 0;
    return 0;
};

const getTransactionKey = (transaction: Transaction, index: number) => {
    const description = typeof transaction.description === 'string'
        ? transaction.description
        : JSON.stringify(transaction.description ?? '');
    return [
        transaction.sourceFile || 'no-file',
        transaction.originalIndex ?? index,
        transaction.date || '',
        Number(transaction.debit) || 0,
        Number(transaction.credit) || 0,
        normalizeText(description)
    ].join('|');
};

const isAmountMatch = (a: number, b: number) => Math.abs(a - b) <= AMOUNT_TOLERANCE;

const getInvoiceOptionLabel = (entry: IndexedInvoice, currency: string, isTaken: boolean) => {
    const statusLabel = entry.paymentStatus === 'paid'
        ? 'Paid'
        : entry.paymentStatus === 'unpaid'
            ? 'Unpaid'
            : 'Unknown';
    const takenLabel = isTaken ? ' [Already matched]' : '';
    return `${entry.invoice.invoiceId || 'No ID'} | ${entry.partyName || 'No Party'} | ${formatAmount(entry.amount)} ${currency} | ${statusLabel}${takenLabel}`;
};

export const ReconciliationTable: React.FC<ReconciliationTableProps> = ({
    invoices,
    transactions,
    currency,
    initialMatches,
    onMatchesChange
}) => {
    const [rowFilter, setRowFilter] = useState<RowFilter>('ALL');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('ALL');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [manualMatches, setManualMatches] = useState<Record<string, string>>({});
    const hasHydratedInitialMatches = useRef(false);

    const indexedTransactions = useMemo<IndexedTransaction[]>(() => {
        return transactions
            .map((transaction, rowIndex) => {
                const description = typeof transaction.description === 'string'
                    ? transaction.description
                    : JSON.stringify(transaction.description ?? '');
                return {
                    key: getTransactionKey(transaction, rowIndex),
                    rowIndex,
                    transaction,
                    amount: getTransactionAmount(transaction),
                    direction: getTransactionDirection(transaction),
                    searchableText: normalizeText(`${transaction.date} ${description} ${transaction.sourceFile || ''}`)
                };
            })
            .sort((a, b) => {
                const dateDiff = parseDateToTime(a.transaction.date) - parseDateToTime(b.transaction.date);
                if (dateDiff !== 0) return dateDiff;
                return a.rowIndex - b.rowIndex;
            });
    }, [transactions]);

    const indexedInvoices = useMemo<IndexedInvoice[]>(() => {
        return invoices
            .map((invoice, index) => {
                const amount = getInvoiceAmount(invoice);
                const partyName = getInvoicePartyName(invoice);
                return {
                    key: getInvoiceKey(invoice, index),
                    invoice,
                    amount,
                    direction: getInvoiceDirection(invoice),
                    partyName,
                    paymentStatus: getInvoicePaymentStatus(invoice),
                    searchableText: normalizeText(`${invoice.invoiceId} ${partyName} ${invoice.invoiceDate} ${amount}`)
                };
            })
            .sort((a, b) => {
                const dateDiff = parseDateToTime(a.invoice.invoiceDate) - parseDateToTime(b.invoice.invoiceDate);
                if (dateDiff !== 0) return dateDiff;
                return a.key.localeCompare(b.key);
            });
    }, [invoices]);

    const invoiceByKey = useMemo(() => {
        const map = new Map<string, IndexedInvoice>();
        indexedInvoices.forEach(entry => map.set(entry.key, entry));
        return map;
    }, [indexedInvoices]);

    const validTxKeys = useMemo(() => new Set(indexedTransactions.map(entry => entry.key)), [indexedTransactions]);
    const validInvoiceKeys = useMemo(() => new Set(indexedInvoices.map(entry => entry.key)), [indexedInvoices]);

    useEffect(() => {
        if (hasHydratedInitialMatches.current) return;
        if (!initialMatches || Object.keys(initialMatches).length === 0) return;

        const hydrated: Record<string, string> = {};
        Object.entries(initialMatches as Record<string, string>).forEach(([txKey, invoiceKey]) => {
            const invoiceMatchKey = String(invoiceKey);
            if (validTxKeys.has(txKey) && validInvoiceKeys.has(invoiceMatchKey)) {
                hydrated[txKey] = invoiceMatchKey;
            }
        });
        setManualMatches(hydrated);
        hasHydratedInitialMatches.current = true;
    }, [initialMatches, validTxKeys, validInvoiceKeys]);

    useEffect(() => {
        setManualMatches(prev => {
            let changed = false;
            const next: Record<string, string> = {};
            Object.entries(prev as Record<string, string>).forEach(([txKey, invoiceKey]) => {
                const invoiceMatchKey = String(invoiceKey);
                if (validTxKeys.has(txKey) && validInvoiceKeys.has(invoiceMatchKey)) {
                    next[txKey] = invoiceMatchKey;
                } else {
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [validTxKeys, validInvoiceKeys]);

    const autoMatchedDefaults = useMemo(() => {
        const defaults: Record<string, string> = {};
        const usedInvoiceKeys = new Set<string>();

        indexedTransactions.forEach(txRow => {
            if (txRow.direction === 'none' || txRow.amount <= 0) return;

            const candidates = indexedInvoices.filter(inv =>
                !usedInvoiceKeys.has(inv.key) &&
                inv.direction === txRow.direction &&
                isAmountMatch(inv.amount, txRow.amount)
            );

            if (candidates.length === 0) return;

            const nameMatchedCandidate = candidates.find(inv => {
                const firstToken = normalizeText(inv.partyName).split(' ').find(token => token.length > 2);
                return !!firstToken && txRow.searchableText.includes(firstToken);
            });

            const selected = nameMatchedCandidate || candidates[0];
            defaults[txRow.key] = selected.key;
            usedInvoiceKeys.add(selected.key);
        });

        return defaults;
    }, [indexedInvoices, indexedTransactions]);

    useEffect(() => {
        setManualMatches(prev => {
            const next = { ...prev };
            let changed = false;
            const usedInvoiceKeys = new Set(Object.values(next));

            indexedTransactions.forEach(txRow => {
                if (next[txRow.key]) return;
                const suggested = autoMatchedDefaults[txRow.key];
                if (!suggested || usedInvoiceKeys.has(suggested)) return;
                next[txRow.key] = suggested;
                usedInvoiceKeys.add(suggested);
                changed = true;
            });

            return changed ? next : prev;
        });
    }, [autoMatchedDefaults, indexedTransactions]);

    useEffect(() => {
        onMatchesChange?.(manualMatches);
    }, [manualMatches, onMatchesChange]);

    const filteredInvoiceOptions = useMemo(() => {
        const search = normalizeText(invoiceSearch);
        return indexedInvoices.filter(entry => {
            if (paymentStatusFilter === 'PAID' && entry.paymentStatus !== 'paid') return false;
            if (paymentStatusFilter === 'UNPAID' && entry.paymentStatus !== 'unpaid') return false;
            if (search && !entry.searchableText.includes(search)) return false;
            return true;
        });
    }, [indexedInvoices, paymentStatusFilter, invoiceSearch]);

    const rowEvaluations = useMemo<RowEvaluation[]>(() => {
        return indexedTransactions.map(row => {
            const selectedInvoiceKey = manualMatches[row.key];
            const selectedInvoice = selectedInvoiceKey ? invoiceByKey.get(selectedInvoiceKey) : undefined;

            if (!selectedInvoice) {
                return {
                    row,
                    status: 'Unmatched',
                    reason: 'No Selected Invoice'
                };
            }

            if (row.direction === 'none' || row.amount <= 0) {
                return {
                    row,
                    selectedInvoice,
                    status: 'Unmatched',
                    reason: 'Bank transaction has no clear debit/credit direction'
                };
            }

            if (selectedInvoice.direction !== row.direction) {
                return {
                    row,
                    selectedInvoice,
                    status: 'Unmatched',
                    reason: 'Direction mismatch (Sales vs Purchase)'
                };
            }

            if (!isAmountMatch(selectedInvoice.amount, row.amount)) {
                return {
                    row,
                    selectedInvoice,
                    status: 'Unmatched',
                    reason: 'Amount mismatch'
                };
            }

            return {
                row,
                selectedInvoice,
                status: 'Matched',
                reason: 'Exact amount and direction match'
            };
        });
    }, [indexedTransactions, manualMatches, invoiceByKey]);

    const stats = useMemo(() => {
        const total = rowEvaluations.length;
        const matched = rowEvaluations.filter(row => row.status === 'Matched').length;
        const unmatched = total - matched;
        const matchedPercentage = total > 0 ? Math.round((matched / total) * 100) : 0;

        return { total, matched, unmatched, matchedPercentage };
    }, [rowEvaluations]);

    const filteredRows = useMemo(() => {
        if (rowFilter === 'ALL') return rowEvaluations;
        if (rowFilter === 'MATCHED') return rowEvaluations.filter(row => row.status === 'Matched');
        return rowEvaluations.filter(row => row.status === 'Unmatched');
    }, [rowEvaluations, rowFilter]);

    const getRowOptions = (row: RowEvaluation) => {
        const selected = row.selectedInvoice;
        const options = [...filteredInvoiceOptions];
        if (selected && !options.some(option => option.key === selected.key)) {
            options.unshift(selected);
        }
        return options;
    };

    const getUsedInvoiceKeysByOtherRows = (currentTxKey: string) => {
        const used = new Set<string>();
        Object.entries(manualMatches as Record<string, string>).forEach(([txKey, invoiceKey]) => {
            const invoiceMatchKey = String(invoiceKey);
            if (txKey !== currentTxKey && invoiceMatchKey) {
                used.add(invoiceMatchKey);
            }
        });
        return used;
    };

    return (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b border-border">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-foreground flex items-center">
                            <ArrowsRightLeftIcon className="w-6 h-6 mr-3 text-primary" />
                            Bank Reconciliation
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Match each bank transaction to invoices using dropdown selection.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-muted p-3 rounded-lg border border-border">
                        <div className="text-center px-2">
                            <p className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Matched</p>
                            <p className="text-xl font-bold text-green-500">
                                {stats.matched}
                                <span className="text-sm text-muted-foreground/60"> / {stats.total}</span>
                            </p>
                        </div>
                        <div className="w-px h-8 bg-border"></div>
                        <div className="text-center px-2">
                            <p className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Unmatched</p>
                            <p className="text-xl font-bold text-destructive">{stats.unmatched}</p>
                        </div>
                        <div className="w-px h-8 bg-border"></div>
                        <div className="text-center px-2">
                            <p className="text-xs text-muted-foreground uppercase font-semibold text-[10px]">Matched %</p>
                            <p className="text-xl font-bold text-foreground">{stats.matchedPercentage}%</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={invoiceSearch}
                            onChange={(e) => setInvoiceSearch(e.target.value)}
                            placeholder="Search invoices (ID, party, amount)"
                            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-sm"
                        />
                    </div>
                    <select
                        value={paymentStatusFilter}
                        onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatusFilter)}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                    >
                        <option value="ALL">Invoices: All</option>
                        <option value="PAID">Invoices: Paid</option>
                        <option value="UNPAID">Invoices: Unpaid</option>
                    </select>
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => setRowFilter('ALL')}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${rowFilter === 'ALL' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                        >
                            All Rows
                        </button>
                        <button
                            onClick={() => setRowFilter('MATCHED')}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${rowFilter === 'MATCHED' ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                        >
                            Matched
                        </button>
                        <button
                            onClick={() => setRowFilter('UNMATCHED')}
                            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${rowFilter === 'UNMATCHED' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                        >
                            Unmatched
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-xs uppercase text-muted-foreground font-semibold">
                        <tr>
                            <th className="px-6 py-4 w-[44%] border-r border-border">Bank Transaction</th>
                            <th className="px-6 py-4 w-[38%] border-r border-border">Invoice Match</th>
                            <th className="px-6 py-4 w-[18%] text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredRows.map(row => {
                            const tx = row.row.transaction;
                            const txDescription = typeof tx.description === 'string'
                                ? tx.description
                                : JSON.stringify(tx.description ?? '');
                            const rowOptions = getRowOptions(row);
                            const usedByOthers = getUsedInvoiceKeysByOtherRows(row.row.key);

                            return (
                                <tr key={row.row.key} className="hover:bg-accent/50 transition-colors align-top">
                                    <td className="px-6 py-4 border-r border-border">
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <span className="font-mono text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                                {tx.sourceFile || 'N/A'}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground mb-3" title={txDescription}>
                                            {txDescription || '-'}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="rounded-md border border-border bg-background/50 p-2">
                                                <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Debit</p>
                                                <p className="font-mono font-semibold text-red-400">
                                                    {formatAmount(Number(tx.debit) || 0)} {currency}
                                                </p>
                                            </div>
                                            <div className="rounded-md border border-border bg-background/50 p-2">
                                                <p className="text-muted-foreground uppercase tracking-wider text-[10px]">Credit</p>
                                                <p className="font-mono font-semibold text-green-400">
                                                    {formatAmount(Number(tx.credit) || 0)} {currency}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-6 py-4 border-r border-border">
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
                                        {row.selectedInvoice && (
                                            <div className="mt-3 p-2 rounded-md border border-border bg-background/50">
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="font-semibold text-foreground">{row.selectedInvoice.invoice.invoiceId || 'No ID'}</span>
                                                    <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded border ${row.selectedInvoice.invoice.invoiceType === 'sales'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                                        }`}>
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
                                        )}
                                    </td>

                                    <td className="px-6 py-4 text-center">
                                        {row.status === 'Matched' && (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 bg-green-500/10 rounded-full flex items-center justify-center border border-green-500/30">
                                                    <CheckIcon className="w-5 h-5 text-green-500" />
                                                </div>
                                                <span className="text-[11px] font-semibold text-green-500">Matched</span>
                                            </div>
                                        )}
                                        {row.status === 'Unmatched' && (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center border border-destructive/30">
                                                    <XMarkIcon className="w-5 h-5 text-destructive" />
                                                </div>
                                                <span className="text-[11px] font-semibold text-destructive">Unmatched</span>
                                            </div>
                                        )}
                                        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{row.reason}</p>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredRows.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground text-sm">
                                    No rows match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
