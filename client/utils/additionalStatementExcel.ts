import type { BankStatementSummary, Transaction } from '../types';

declare const XLSX: any;

type ParsedAdditionalStatementExcel = {
    transactions: Transaction[];
    summary: Partial<BankStatementSummary>;
    currency: string;
};

const DATE_KEYS = ['date', 'txn date', 'transaction date', 'posting date', 'value date', 'tx date', 'value_date', 'booking date'];
const DESC_KEYS = ['description', 'details', 'narration', 'transaction details', 'particulars', 'remarks', 'reference', 'memo', 'desc'];
const DEBIT_KEYS = ['debit', 'dr', 'withdrawal', 'out', 'paid out', 'payments', 'debit amount', 'withdrawal amount'];
const CREDIT_KEYS = ['credit', 'cr', 'deposit', 'in', 'paid in', 'receipts', 'credit amount', 'deposit amount'];
const AMOUNT_KEYS = ['amount', 'net amount', 'total', 'transaction amount', 'value', 'sum'];
const BALANCE_KEYS = ['balance', 'bal', 'running balance', 'rem balance', 'closing balance'];

const cleanNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        let clean = value.trim();
        if (!clean) return 0;
        const isNegativeInBrackets = clean.startsWith('(') && clean.endsWith(')');
        if (isNegativeInBrackets) clean = `-${clean.slice(1, -1)}`;
        const num = parseFloat(clean.replace(/[^0-9.-]/g, ''));
        return Number.isFinite(num) ? num : 0;
    }
    return 0;
};

const normalizeDate = (value: unknown): string => {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
    }

    if (typeof value === 'number' && XLSX?.SSF?.parse_date_code) {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed?.y && parsed?.m && parsed?.d) {
            const y = String(parsed.y).padStart(4, '0');
            const m = String(parsed.m).padStart(2, '0');
            const d = String(parsed.d).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    const text = String(value ?? '').trim();
    if (!text) return '';
    const parsedDate = new Date(text);
    if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().slice(0, 10);
    }

    return text;
};

const matchIndex = (headers: string[], keys: string[]) => {
    const exact = headers.findIndex(h => keys.some(k => h === k));
    if (exact !== -1) return exact;
    return headers.findIndex(h => keys.some(k => h.includes(k)));
};

const isLikelyHeaderRow = (row: unknown[]) => {
    const normalized = row.map(cell => String(cell ?? '').toLowerCase().trim());
    let score = 0;
    if (normalized.some(c => DATE_KEYS.some(k => c === k || c.includes(k)))) score += 3;
    if (normalized.some(c => DESC_KEYS.some(k => c === k || c.includes(k)))) score += 2;
    if (normalized.some(c => DEBIT_KEYS.some(k => c === k || c.includes(k)))) score += 2;
    if (normalized.some(c => CREDIT_KEYS.some(k => c === k || c.includes(k)))) score += 2;
    if (normalized.some(c => AMOUNT_KEYS.some(k => c === k || c.includes(k)))) score += 1;
    return score;
};

export const parseAdditionalStatementExcelFile = async (file: File): Promise<ParsedAdditionalStatementExcel | null> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });

    let bestTransactions: Transaction[] = [];
    let bestCurrency = 'AED';
    let bestSummary: Partial<BankStatementSummary> = {
        openingBalance: 0,
        closingBalance: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        accountHolder: 'Excel Upload',
        accountNumber: '',
        statementPeriod: ''
    };

    for (const sheetName of workbook.SheetNames || []) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!rawData.length) continue;

        let headerRowIndex = -1;
        let bestScore = 0;
        const searchDepth = Math.min(rawData.length, 50);
        for (let i = 0; i < searchDepth; i += 1) {
            const score = isLikelyHeaderRow(rawData[i] || []);
            if (score > bestScore) {
                bestScore = score;
                headerRowIndex = i;
            }
        }
        if (headerRowIndex === -1 || bestScore < 3) continue;

        const headers = (rawData[headerRowIndex] || []).map(h => String(h ?? '').toLowerCase().trim());
        const colMap = {
            date: matchIndex(headers, DATE_KEYS),
            desc: matchIndex(headers, DESC_KEYS),
            debit: matchIndex(headers, DEBIT_KEYS),
            credit: matchIndex(headers, CREDIT_KEYS),
            amount: matchIndex(headers, AMOUNT_KEYS),
            balance: matchIndex(headers, BALANCE_KEYS),
            category: matchIndex(headers, ['category', 'account', 'classification', 'type']),
            currency: matchIndex(headers, ['currency', 'curr', 'ccy'])
        };

        if (colMap.desc !== -1) {
            const descHeader = headers[colMap.desc] || '';
            if (colMap.credit === colMap.desc && descHeader.includes('credit') && colMap.desc + 1 < headers.length) {
                colMap.credit = colMap.desc + 1;
            } else if (colMap.debit === colMap.desc && descHeader.includes('debit') && colMap.desc + 1 < headers.length) {
                colMap.debit = colMap.desc + 1;
            }
        }
        if (colMap.credit !== -1 && colMap.credit === colMap.debit) {
            const sameHeader = headers[colMap.credit] || '';
            if (sameHeader.includes('debit') && colMap.credit + 1 < headers.length) colMap.debit = colMap.credit + 1;
            if (sameHeader.includes('credit') && colMap.credit + 1 < headers.length) colMap.credit = colMap.credit + 1;
        }

        const extracted: Transaction[] = [];
        for (let i = headerRowIndex + 1; i < rawData.length; i += 1) {
            const row = rawData[i] || [];
            if (!row.length) continue;

            const parsedDate = colMap.date !== -1 ? normalizeDate(row[colMap.date]) : '';
            if (!parsedDate) continue;

            const description = colMap.desc !== -1 ? String(row[colMap.desc] ?? '').trim() : '';
            const amountVal = colMap.amount !== -1 ? row[colMap.amount] : '';
            let debit = colMap.debit !== -1 ? cleanNumber(row[colMap.debit]) : 0;
            let credit = colMap.credit !== -1 ? cleanNumber(row[colMap.credit]) : 0;
            if (debit === 0 && credit === 0 && amountVal !== '') {
                const amt = cleanNumber(amountVal);
                if (amt < 0) debit = Math.abs(amt);
                else credit = amt;
            }

            if (!description && debit === 0 && credit === 0) continue;

            const currency = String(colMap.currency !== -1 ? (row[colMap.currency] ?? 'AED') : 'AED').trim().toUpperCase() || 'AED';
            extracted.push({
                date: parsedDate,
                description: description || 'No Description',
                debit,
                credit,
                balance: colMap.balance !== -1 ? cleanNumber(row[colMap.balance]) : 0,
                category: String(colMap.category !== -1 ? (row[colMap.category] ?? '') : '').replace(/^\d+\s+/, ''),
                currency,
                originalCurrency: currency,
                confidence: 100,
                sourceFile: file.name,
                originalIndex: i
            } as Transaction);
        }

        if (!extracted.length) continue;

        const sortedByDate = [...extracted].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const firstTx = sortedByDate[0];
        const lastTx = sortedByDate[sortedByDate.length - 1];
        const openingBalance = firstTx.balance ? (firstTx.balance - (firstTx.credit || 0) + (firstTx.debit || 0)) : 0;
        const totalDeposits = extracted.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
        const totalWithdrawals = extracted.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
        const closingBalance = lastTx.balance || (openingBalance - totalWithdrawals + totalDeposits);
        const detectedCurrency = extracted.find(t => t.originalCurrency)?.originalCurrency || extracted[0]?.currency || 'AED';

        if (extracted.length > bestTransactions.length) {
            bestTransactions = extracted;
            bestCurrency = detectedCurrency;
            bestSummary = {
                openingBalance,
                closingBalance,
                totalDeposits,
                totalWithdrawals,
                accountHolder: 'Excel Upload',
                accountNumber: '',
                statementPeriod: ''
            };
        }
    }

    if (!bestTransactions.length) return null;

    return {
        transactions: bestTransactions,
        summary: bestSummary,
        currency: bestCurrency
    };
};
