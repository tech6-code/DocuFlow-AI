import { CHART_OF_ACCOUNTS } from '../services/geminiService';
import type { OpeningBalanceAccount } from '../types';

declare const XLSX: any;

type AccountLookupEntry = { category: string; subCategory?: string };

const normalizeAccountName = (value?: string | null) => {
    return String(value ?? '')
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

const normalizeCategory = (value?: string | null) => {
    if (!value) return '';
    const v = value.toLowerCase().replace(/\s+/g, ' ').trim();
    if (v === 'profit & loss' || v === 'profit and loss' || v === 'balance sheet') return '';
    if (v.includes('revenue') || v.includes('income') || v.includes('gain') || v.includes('dividend') || v.includes('profit')) return 'Income';
    if (v.includes('expense') || v.includes('cost') || v.includes('loss') || v.includes('depreciation') || v.includes('amortization') || v.includes('impairment') || v.includes('finance cost')) return 'Expenses';
    if (v.includes('asset')) return 'Assets';
    if (v.includes('liabilit') || v.includes('payable') || v.includes('overdraft') || v.includes('loan') || v.includes('debenture')) return 'Liabilities';
    if (v.includes('equity') || v.includes('shareholder') || v.includes('capital') || v.includes('owner')) return 'Equity';
    return '';
};

const parseOpeningBalanceNumber = (value: unknown) => {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    const raw = String(value).trim();
    if (!raw) return 0;
    const hasParens = raw.startsWith('(') && raw.endsWith(')');
    const cleaned = raw.replace(/[^0-9.\-]/g, '');
    const num = Number(cleaned);
    if (Number.isNaN(num)) return 0;
    return hasParens ? -Math.abs(num) : num;
};

const buildAccountLookup = () => {
    const lookup: Record<string, AccountLookupEntry> = {};
    Object.entries(CHART_OF_ACCOUNTS).forEach(([main, section]) => {
        if (Array.isArray(section)) {
            section.forEach(acc => {
                lookup[normalizeAccountName(acc)] = { category: main };
            });
        } else {
            Object.entries(section).forEach(([sub, accounts]) => {
                (accounts as string[]).forEach(acc => {
                    lookup[normalizeAccountName(acc)] = { category: main, subCategory: sub };
                });
            });
        }
    });
    return lookup;
};

const ACCOUNT_LOOKUP = buildAccountLookup();

const inferCategoryFromAccountName = (accountName: string) => {
    const lower = accountName.toLowerCase();
    if (
        lower.includes('equity') ||
        lower.includes('capital') ||
        lower.includes('retained earnings') ||
        lower.includes('owner') ||
        lower.includes('shareholder')
    ) {
        return 'Equity';
    }
    if (
        lower.includes('payable') ||
        lower.includes('liabilit') ||
        lower.includes('loan') ||
        lower.includes('overdraft') ||
        lower.includes('debenture') ||
        lower.includes('bond') ||
        lower.includes('lease') ||
        lower.includes('deferred tax')
    ) {
        return 'Liabilities';
    }
    if (
        lower.includes('expense') ||
        lower.includes('cost') ||
        lower.includes('loss') ||
        lower.includes('depreciation') ||
        lower.includes('amortization') ||
        lower.includes('impairment') ||
        lower.includes('freight') ||
        lower.includes('shipping') ||
        lower.includes('warehouse') ||
        lower.includes('marketing') ||
        lower.includes('advertising') ||
        lower.includes('salary') ||
        lower.includes('wage') ||
        lower.includes('rent') ||
        lower.includes('bank charge')
    ) {
        return 'Expenses';
    }
    if (
        lower.includes('revenue') ||
        lower.includes('income') ||
        lower.includes('gain') ||
        lower.includes('profit') ||
        lower.includes('dividend') ||
        lower.includes('interest income')
    ) {
        return 'Income';
    }
    if (
        lower.includes('asset') ||
        lower.includes('cash') ||
        lower.includes('bank account') ||
        lower.includes('receivable') ||
        lower.includes('inventory') ||
        lower.includes('prepaid') ||
        lower.includes('deposit') ||
        lower.includes('bill receivable') ||
        lower.includes('marketable')
    ) {
        return 'Assets';
    }
    return null;
};

export const resolveOpeningBalanceCategory = (accountName: string): AccountLookupEntry | null => {
    const normalized = normalizeAccountName(accountName);
    if (ACCOUNT_LOOKUP[normalized]) return ACCOUNT_LOOKUP[normalized];
    const inferred = inferCategoryFromAccountName(accountName);
    if (inferred) return { category: inferred };
    return null;
};

export type ImportedOpeningBalanceRow = {
    category: string;
    account: OpeningBalanceAccount;
};

export const parseOpeningBalanceExcel = async (
    file: File
): Promise<{ entries: ImportedOpeningBalanceRow[]; skipped: number }> => {
    if (!XLSX?.read || !XLSX?.utils) {
        throw new Error('Excel library not loaded.');
    }

    const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase();
    const headerScore = (headers: string[]) => {
        const hasAccount = headers.some((h) => h.includes('account'));
        const hasCategory = headers.some((h) => h.includes('category') || h.includes('heading') || h.includes('type') || h.includes('group'));
        const hasDebit = headers.some((h) => h.includes('debit') || h === 'dr');
        const hasCredit = headers.some((h) => h.includes('credit') || h === 'cr');
        const hasBalance = headers.some((h) => h.includes('balance') || h.includes('amount') || h.includes('net'));
        let score = 0;
        if (hasAccount) score += 3;
        if (hasCategory) score += 2;
        if (hasDebit) score += 2;
        if (hasCredit) score += 2;
        if (hasBalance) score += 1;
        return score;
    };

    const getSheetRows = (worksheet: any) =>
        XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as unknown[][];

    const findBestSheet = (workbook: any) => {
        let best = {
            sheetName: workbook.SheetNames[0],
            headerIndex: -1,
            headerRow: [] as unknown[],
            rows: [] as unknown[][],
            score: -1
        };
        workbook.SheetNames.forEach((name: string) => {
            const worksheet = workbook.Sheets[name];
            const rows = getSheetRows(worksheet);
            if (!rows || rows.length === 0) return;
            let localBest = { score: -1, headerIndex: -1, headerRow: rows[0] || [] };
            rows.slice(0, 10).forEach((row, idx) => {
                const headers = row.map(normalizeHeader);
                const score = headerScore(headers);
                if (score > localBest.score) {
                    localBest = { score, headerIndex: idx, headerRow: row };
                }
            });
            const isOpening = name.toLowerCase().includes('opening');
            if (
                localBest.score > best.score ||
                (localBest.score === best.score && isOpening && !best.sheetName.toLowerCase().includes('opening'))
            ) {
                best = { sheetName: name, rows, headerIndex: localBest.headerIndex, headerRow: localBest.headerRow, score: localBest.score };
            }
        });
        return best;
    };

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const bestSheet = findBestSheet(workbook);
    const rows = bestSheet.rows;
    if (!rows || rows.length === 0) return { entries: [], skipped: 0 };

    const headerIndex = bestSheet.headerIndex;
    const hasHeader = headerIndex >= 0 && bestSheet.score > 0;
    const headerRow = hasHeader ? rows[headerIndex] : rows[0];
    const headerValues = headerRow.map(normalizeHeader);
    const findHeaderIndex = (candidates: string[]) =>
        headerValues.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

    let categoryIdx = hasHeader ? findHeaderIndex(['category', 'heading', 'classification', 'type', 'group', 'section']) : -1;
    let accountIdx = hasHeader ? findHeaderIndex(['account', 'account name', 'ledger', 'description']) : 0;
    let debitIdx = hasHeader ? findHeaderIndex(['debit', 'dr']) : -1;
    let creditIdx = hasHeader ? findHeaderIndex(['credit', 'cr']) : -1;
    let balanceIdx = hasHeader ? findHeaderIndex(['balance', 'amount', 'opening balance', 'value', 'net']) : -1;

    const dataRows = rows.slice(hasHeader ? headerIndex + 1 : 0);
    const sampleRow = dataRows.find((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
    const sampleLen = sampleRow ? sampleRow.length : headerRow.length;

    if (categoryIdx < 0 && sampleLen >= 4) categoryIdx = 0;
    if (accountIdx < 0) accountIdx = categoryIdx === 0 ? 1 : 0;
    if ((debitIdx < 0 || creditIdx < 0) && balanceIdx < 0) {
        if (sampleLen >= 4) {
            debitIdx = sampleLen - 2;
            creditIdx = sampleLen - 1;
        } else if (sampleLen >= 3) {
            debitIdx = 1;
            creditIdx = 2;
        }
    }
    if (balanceIdx < 0 && sampleLen === 2) {
        balanceIdx = 1;
    }

    const columnCount = Math.max(
        headerRow.length,
        ...dataRows.slice(0, 25).map(row => row.length)
    );
    if (columnCount > 0) {
        const stats = Array.from({ length: columnCount }, () => ({
            numeric: 0,
            text: 0,
            category: 0,
            nonEmpty: 0
        }));

        const categoryRegex = /(asset|liab|equity|income|expense|revenue|profit|loss)/i;
        const numericRegex = /[0-9]/;

        dataRows.slice(0, 50).forEach((row) => {
            for (let idx = 0; idx < columnCount; idx += 1) {
                const cell = row[idx];
                const raw = String(cell ?? '').trim();
                if (!raw) continue;
                stats[idx].nonEmpty += 1;
                if (numericRegex.test(raw) && !/[a-zA-Z]/.test(raw)) {
                    stats[idx].numeric += 1;
                }
                if (/[a-zA-Z]/.test(raw)) {
                    stats[idx].text += 1;
                }
                if (categoryRegex.test(raw)) {
                    stats[idx].category += 1;
                }
            }
        });

        if (accountIdx < 0 || accountIdx >= columnCount) {
            const candidates = stats
                .map((s, idx) => ({ idx, score: s.text }))
                .sort((a, b) => b.score - a.score);
            accountIdx = candidates[0]?.idx ?? 0;
        }

        if (categoryIdx < 0 || categoryIdx >= columnCount) {
            const candidates = stats
                .map((s, idx) => ({ idx, score: s.category }))
                .sort((a, b) => b.score - a.score);
            const pick = candidates.find(c => c.score > 0 && c.idx !== accountIdx);
            categoryIdx = pick ? pick.idx : categoryIdx;
        }

        if ((debitIdx < 0 || creditIdx < 0) && balanceIdx < 0) {
            const numericColumns = stats
                .map((s, idx) => ({ idx, score: s.numeric }))
                .filter(c => c.score > 0)
                .sort((a, b) => a.idx - b.idx)
                .map(c => c.idx);
            if (numericColumns.length >= 2) {
                debitIdx = numericColumns[0];
                creditIdx = numericColumns[1];
            } else if (numericColumns.length === 1) {
                balanceIdx = numericColumns[0];
            }
        }
    }

    const entries: ImportedOpeningBalanceRow[] = [];
    let skipped = 0;

    const skipTokens = new Set([
        'account',
        'account name',
        'total',
        'totals',
        'profit loss',
        'profit and loss',
        'balance sheet',
        'statement of financial position',
        'statement of profit or loss',
        'trial balance',
        'common trial balance accounts'
    ]);

    dataRows.forEach((row) => {
        const rawAccount = String(row[accountIdx] ?? '').trim();
        if (!rawAccount) return;
        const accountKey = normalizeAccountName(rawAccount);
        if (accountKey.startsWith('step')) return;
        if (skipTokens.has(accountKey)) return;
        if (['assets', 'liabilities', 'equity', 'income', 'expenses'].includes(accountKey)) return;

        const rawCategory = categoryIdx >= 0 ? String(row[categoryIdx] ?? '').trim() : '';
        const normalizedCategory = normalizeCategory(rawCategory);
        const lookupEntry = ACCOUNT_LOOKUP[normalizeAccountName(rawAccount)];
        let inferredCategory = normalizedCategory || lookupEntry?.category || inferCategoryFromAccountName(rawAccount);

        const rawDebit = debitIdx >= 0 ? parseOpeningBalanceNumber(row[debitIdx]) : 0;
        const rawCredit = creditIdx >= 0 ? parseOpeningBalanceNumber(row[creditIdx]) : 0;
        const balanceCell = balanceIdx >= 0 ? row[balanceIdx] : undefined;
        let rawBalance = balanceIdx >= 0 ? parseOpeningBalanceNumber(balanceCell) : 0;
        if (balanceIdx >= 0 && typeof balanceCell === 'string') {
            const normalizedBalance = balanceCell.toLowerCase();
            const hasCr = /\bcr\b/.test(normalizedBalance);
            const hasDr = /\bdr\b/.test(normalizedBalance);
            if (hasCr && !hasDr) rawBalance = -Math.abs(rawBalance);
            if (hasDr && !hasCr) rawBalance = Math.abs(rawBalance);
        }

        if (!inferredCategory) {
            const net = rawBalance || (rawDebit - rawCredit);
            if (net !== 0) {
                inferredCategory = net >= 0 ? 'Assets' : 'Liabilities';
            }
        }
        if (!inferredCategory) {
            skipped += 1;
            return;
        }

        const isDebitNormal = inferredCategory === 'Assets' || inferredCategory === 'Expenses';

        let debit = rawDebit;
        let credit = rawCredit;
        if (debit < 0 && credit === 0) {
            credit = Math.abs(debit);
            debit = 0;
        }
        if (credit < 0 && debit === 0) {
            debit = Math.abs(credit);
            credit = 0;
        }
        if (debit === 0 && credit === 0 && rawBalance !== 0) {
            const abs = Math.abs(rawBalance);
            if (rawBalance >= 0) {
                debit = isDebitNormal ? abs : 0;
                credit = isDebitNormal ? 0 : abs;
            } else {
                debit = isDebitNormal ? 0 : abs;
                credit = isDebitNormal ? abs : 0;
            }
        }

        const accountNames = rawDebit === 0 && rawCredit === 0 && rawBalance === 0 && rawAccount.includes(',')
            ? rawAccount.split(',').map(name => name.trim()).filter(Boolean)
            : [rawAccount];

        accountNames.forEach((name) => {
            const subCategory = lookupEntry?.subCategory || 'Imported';
            entries.push({
                category: inferredCategory,
                account: {
                    name,
                    debit: Math.abs(debit || 0),
                    credit: Math.abs(credit || 0),
                    isNew: true,
                    subCategory
                }
            });
        });
    });

    return { entries, skipped };
};
