import type { Transaction } from '../types';

export const filterTransactionsByDate = (transactions: Transaction[], startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return transactions;
    return transactions.filter(t => {
        const txDate = new Date(t.date).getTime();
        const start = startDate ? new Date(startDate).getTime() : 0;
        const end = endDate ? new Date(endDate).getTime() : Infinity;
        return txDate >= start && txDate <= end;
    });
};

export const deduplicateTransactions = (newTransactions: Transaction[], existingTransactions: Transaction[]) => {
    const existingSignatures = new Set(
        existingTransactions.map(t => `${t.date}-${t.description}-${t.debit}-${t.credit}`)
    );
    return newTransactions.filter(t => {
        const signature = `${t.date}-${t.description}-${t.debit}-${t.credit}`;
        return !existingSignatures.has(signature);
    });
};
