
import React, { useMemo, useState } from 'react';
import type { Invoice, Transaction } from '../types';
import {
    CheckIcon,
    XMarkIcon,
    ArrowsRightLeftIcon,
    MagnifyingGlassIcon,
    ExclamationTriangleIcon
} from './icons';

interface ReconciliationTableProps {
    invoices: Invoice[];
    transactions: Transaction[];
    currency: string;
}

interface ReconciliationItem {
    id: string;
    invoice: Invoice;
    transaction?: Transaction;
    status: 'Matched' | 'Unmatched' | 'Potential';
    matchReason?: string;
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const ReconciliationTable: React.FC<ReconciliationTableProps> = ({ invoices, transactions, currency }) => {
    const [filter, setFilter] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');

    const reconciliationData = useMemo(() => {
        const matches: ReconciliationItem[] = [];
        const usedTransactionIndices = new Set<number>();

        // Sort invoices by date
        const sortedInvoices = [...invoices].sort((a, b) => new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());

        // 1. Process Invoices (Match to Transactions)
        sortedInvoices.forEach(inv => {
            const targetAmount = inv.totalAmountAED || inv.totalAmount;
            const isSales = inv.invoiceType === 'sales';

            // Find best matching transaction
            let bestMatchIndex = -1;
            let matchType = 'Unmatched';
            let reason = '';

            // Look for Exact Amount Match + Direction Match
            const candidates = transactions.map((t, idx) => ({ t, idx })).filter(({ t, idx }) => {
                if (usedTransactionIndices.has(idx)) return false;
                const txAmount = isSales ? (t.credit || 0) : (t.debit || 0);
                // Tolerance of 0.1 for floating point diffs
                return Math.abs(txAmount - targetAmount) < 0.1;
            });

            if (candidates.length === 1) {
                bestMatchIndex = candidates[0].idx;
                matchType = 'Matched';
                reason = 'Exact amount match';
            } else if (candidates.length > 1) {
                const nameToMatch = isSales ? (inv.customerName || '') : (inv.vendorName || '');
                const nameMatch = candidates.find(({ t }) =>
                    t.description && typeof t.description === 'string' &&
                    t.description.toLowerCase().includes((nameToMatch.toLowerCase().split(' ')[0] || '___nonexistent___'))
                );

                if (nameMatch) {
                    bestMatchIndex = nameMatch.idx;
                    matchType = 'Matched';
                    reason = 'Amount & Name match';
                } else {
                    bestMatchIndex = candidates[0].idx;
                    matchType = 'Potential';
                    reason = 'Amount match (Name mismatch or missing)';
                }
            }

            if (bestMatchIndex !== -1) {
                usedTransactionIndices.add(bestMatchIndex);
                matches.push({
                    id: inv.invoiceId,
                    invoice: inv,
                    transaction: transactions[bestMatchIndex],
                    status: matchType as 'Matched' | 'Potential',
                    matchReason: reason
                });
            } else {
                matches.push({
                    id: inv.invoiceId,
                    invoice: inv,
                    status: 'Unmatched'
                });
            }
        });

        // 2. Process Remaining (Unmatched) Transactions
        transactions.forEach((t, idx) => {
            if (!usedTransactionIndices.has(idx)) {
                matches.push({
                    id: `unmatched-tx-${idx}-${t.date}-${t.debit || t.credit}`,
                    // Dummy invoice to satisfy type or we can adjust type
                    // Actually, let's keep the type and handle undefined invoice in render if needed,
                    // but better to use a partial or union type.
                    // For now, satisfy interface by casting or providing null.
                    invoice: {
                        invoiceId: 'NEW/UNMATCHED',
                        invoiceDate: t.date,
                        totalAmount: t.debit || t.credit,
                        invoiceType: t.credit > 0 ? 'sales' : 'purchase',
                        status: 'Unmatched Transaction',
                        customerName: 'Bank Transaction',
                        vendorName: 'Bank Transaction',
                        currency: t.currency || 'AED'
                    } as any,
                    transaction: t,
                    status: 'Unmatched'
                });
            }
        });

        return matches;
    }, [invoices, transactions]);

    const stats = useMemo(() => {
        const total = reconciliationData.length;
        const matched = reconciliationData.filter(i => i.status === 'Matched' || i.status === 'Potential').length;
        const percentage = total > 0 ? Math.round((matched / total) * 100) : 0;
        return { total, matched, percentage };
    }, [reconciliationData]);

    const filteredData = reconciliationData.filter(item => {
        if (filter === 'ALL') return true;
        if (filter === 'MATCHED') return item.status === 'Matched' || item.status === 'Potential';
        if (filter === 'UNMATCHED') return item.status === 'Unmatched';
        return true;
    });

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden mb-8">
            <div className="p-6 border-b border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center">
                            <ArrowsRightLeftIcon className="w-6 h-6 mr-3 text-blue-400" />
                            Bank Reconciliation
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Automatic matching of Invoices to Bank Transactions.
                        </p>
                    </div>

                    {/* Stats Card */}
                    <div className="flex items-center gap-4 bg-gray-800 p-3 rounded-lg border border-gray-600">
                        <div className="text-center px-2">
                            <p className="text-xs text-gray-400 uppercase font-semibold">Matched</p>
                            <p className="text-xl font-bold text-green-400">{stats.matched} <span className="text-sm text-gray-500">/ {stats.total}</span></p>
                        </div>
                        <div className="w-px h-8 bg-gray-600"></div>
                        <div className="text-center px-2">
                            <p className="text-xs text-gray-400 uppercase font-semibold">Reconciled</p>
                            <p className="text-xl font-bold text-white">{stats.percentage}%</p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={() => setFilter('ALL')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('MATCHED')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'MATCHED' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                        Matched
                    </button>
                    <button
                        onClick={() => setFilter('UNMATCHED')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'UNMATCHED' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                    >
                        Unmatched
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-800 text-xs uppercase text-gray-400 font-semibold">
                        <tr>
                            <th className="px-6 py-4 w-[45%] border-r border-gray-700">Invoice Details</th>
                            <th className="px-6 py-4 w-[10%] text-center border-r border-gray-700">Status</th>
                            <th className="px-6 py-4 w-[45%]">Bank Transaction</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {filteredData.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                                {/* Invoice Side */}
                                <td className="px-6 py-4 border-r border-gray-800 align-top">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-white">{item.invoice.invoiceId}</span>
                                        <span className="text-gray-400 text-xs">{formatDate(item.invoice.invoiceDate)}</span>
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-gray-300 truncate max-w-[200px]" title={item.invoice.invoiceType === 'sales' ? item.invoice.customerName : item.invoice.vendorName}>
                                            {item.invoice.invoiceType === 'sales' ? item.invoice.customerName : item.invoice.vendorName}
                                        </span>
                                        <span className={`text-xs px-2 py-0.5 rounded border ${item.invoice.invoiceType === 'sales' ? 'bg-blue-900/20 text-blue-300 border-blue-800' : 'bg-orange-900/20 text-orange-300 border-orange-800'}`}>
                                            {item.invoice.invoiceType === 'sales' ? 'Sales' : 'Purchase'}
                                        </span>
                                    </div>
                                    <div className="text-right mt-2">
                                        <span className="text-gray-500 text-xs mr-2">Amount:</span>
                                        <span className="font-mono font-bold text-white">{formatAmount(item.invoice.totalAmountAED || item.invoice.totalAmount)} <span className="text-xs font-normal text-gray-500">{currency}</span></span>
                                    </div>
                                </td>

                                {/* Status Icon */}
                                <td className="px-6 py-4 border-r border-gray-800 text-center align-middle">
                                    {item.status === 'Matched' && (
                                        <div className="flex justify-center">
                                            <div className="w-8 h-8 bg-green-900/30 rounded-full flex items-center justify-center border border-green-600">
                                                <CheckIcon className="w-5 h-5 text-green-400" />
                                            </div>
                                        </div>
                                    )}
                                    {item.status === 'Potential' && (
                                        <div className="flex justify-center">
                                            <div className="w-8 h-8 bg-yellow-900/30 rounded-full flex items-center justify-center border border-yellow-600">
                                                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" />
                                            </div>
                                        </div>
                                    )}
                                    {item.status === 'Unmatched' && (
                                        <div className="flex justify-center">
                                            <div className="w-8 h-8 bg-red-900/30 rounded-full flex items-center justify-center border border-red-600">
                                                <XMarkIcon className="w-5 h-5 text-red-400" />
                                            </div>
                                        </div>
                                    )}
                                </td>

                                {/* Transaction Side */}
                                <td className="px-6 py-4 align-middle">
                                    {item.transaction ? (
                                        <>
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-mono text-xs text-gray-400">{formatDate(item.transaction.date)}</span>
                                                {item.matchReason && <span className="text-[10px] text-gray-500 italic">({item.matchReason})</span>}
                                            </div>
                                            <div className="mb-2">
                                                <p className="text-sm text-gray-200 line-clamp-2" title={typeof item.transaction.description === 'string' ? item.transaction.description : ''}>
                                                    {typeof item.transaction.description === 'string' ? item.transaction.description : JSON.stringify(item.transaction.description)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-gray-500 text-xs mr-2">Cleared:</span>
                                                <span className={`font-mono font-bold ${item.invoice.invoiceType === 'sales' ? 'text-green-400' : 'text-red-400'}`}>
                                                    {formatAmount(item.invoice.invoiceType === 'sales' ? item.transaction.credit : item.transaction.debit)} <span className="text-xs font-normal text-gray-500">{currency}</span>
                                                </span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-500 py-2 border border-dashed border-gray-700 rounded bg-gray-800/30">
                                            <MagnifyingGlassIcon className="w-5 h-5 mb-1 opacity-50" />
                                            <span className="text-xs">No matching transaction</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
