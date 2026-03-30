import type { TrialBalanceEntry } from '../types';

export type PreviousYearCorporateTaxResolution = {
    previousYearCorporateTaxExpense: number | null;
    previousYearCorporateTaxPayable: number | null;
    resolvedPreviousYearCorporateTaxForPnl: number;
    resolvedPreviousYearCorporateTaxForBs: number;
    matchedExpenseAccounts: string[];
    matchedPayableAccounts: string[];
};

const normalizeLabel = (value: string) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

export const isCorporateTaxExpenseLikeLabel = (label: string) => {
    const normalized = normalizeLabel(label);
    if (!normalized) return false;
    const hasCorporateTax =
        normalized.includes('corporate tax') ||
        normalized.includes('income tax');
    if (!hasCorporateTax) return false;

    return (
        normalized.includes('expense') ||
        normalized.includes('provision') ||
        (!normalized.includes('payable') && !normalized.includes('liability'))
    );
};

export const isCorporateTaxPayableLikeLabel = (label: string) => {
    const normalized = normalizeLabel(label);
    if (!normalized) return false;

    const isCorporateTaxPayable =
        normalized.includes('corporate tax payable') ||
        normalized.includes('income tax payable');
    const isGenericTaxPayable =
        normalized.includes('tax payable') &&
        (normalized.includes('corporate') || normalized.includes('income'));

    return isCorporateTaxPayable || isGenericTaxPayable;
};

export const extractPreviousYearCorporateTaxFromTrialBalance = (
    rows: TrialBalanceEntry[] | null | undefined
): PreviousYearCorporateTaxResolution => {
    let previousYearCorporateTaxExpense = 0;
    let previousYearCorporateTaxPayable = 0;
    const matchedExpenseAccounts: string[] = [];
    const matchedPayableAccounts: string[] = [];

    (rows || []).forEach((row) => {
        const account = String(row?.account || '').trim();
        if (!account || normalizeLabel(account) === 'totals') return;

        const previousDebit = Number(row?.previousDebit) || 0;
        const previousCredit = Number(row?.previousCredit) || 0;

        if (isCorporateTaxPayableLikeLabel(account)) {
            const payableAmount = Math.abs(previousCredit - previousDebit);
            if (payableAmount > 0.01) {
                previousYearCorporateTaxPayable += payableAmount;
                matchedPayableAccounts.push(account);
            }
            return;
        }

        if (isCorporateTaxExpenseLikeLabel(account)) {
            const expenseAmount = Math.abs(previousDebit - previousCredit);
            if (expenseAmount > 0.01) {
                previousYearCorporateTaxExpense += expenseAmount;
                matchedExpenseAccounts.push(account);
            }
        }
    });

    const normalizedExpense = previousYearCorporateTaxExpense > 0.01
        ? Math.round(previousYearCorporateTaxExpense)
        : null;
    const normalizedPayable = previousYearCorporateTaxPayable > 0.01
        ? Math.round(previousYearCorporateTaxPayable)
        : null;

    return {
        previousYearCorporateTaxExpense: normalizedExpense,
        previousYearCorporateTaxPayable: normalizedPayable,
        resolvedPreviousYearCorporateTaxForPnl: normalizedExpense ?? normalizedPayable ?? 0,
        resolvedPreviousYearCorporateTaxForBs: normalizedPayable ?? normalizedExpense ?? 0,
        matchedExpenseAccounts,
        matchedPayableAccounts
    };
};
