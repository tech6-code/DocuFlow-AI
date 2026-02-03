
import { WorkingNoteEntry } from './types';

export const formatNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const formatDecimalNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    return Math.round(num).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export const toNumber = (val: any): number => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
        const cleaned = val.replace(/[,()]/g, '').trim();
        const neg = val.includes('(') && val.includes(')');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : (neg ? -parsed : parsed);
    }
    return 0;
};

export const findItemAmount = (item: any): number => {
    if (!item) return 0;
    const candidates = [
        item.amount,
        item.currentYearAmount,
        item.amountCurrentYear,
        item.value,
        item.currentYear
    ];
    for (const v of candidates) {
        const n = toNumber(v);
        if (n !== 0) return n;
    }
    return 0;
};

export const findAmountInItems = (items: any[] | undefined, keywords: string[]): number => {
    if (!items || items.length === 0) return 0;
    const lowerKeys = keywords.map(k => k.toLowerCase());
    const match = items.find((item: any) => {
        const desc = String(item?.description || '').toLowerCase();
        return lowerKeys.some(k => desc.includes(k));
    });
    return match ? findItemAmount(match) : 0;
};

export const flattenBsItems = (bs: any): any[] => {
    const flat: any[] = [];
    const pushItems = (arr: any[] | undefined) => {
        if (!arr) return;
        arr.forEach((group: any) => {
            if (Array.isArray(group?.items)) {
                flat.push(...group.items);
            }
        });
    };
    pushItems(bs?.assets);
    pushItems(bs?.liabilities);
    if (Array.isArray(bs?.equity)) flat.push(...bs.equity);
    if (Array.isArray(bs?.items)) flat.push(...bs.items);
    if (Array.isArray(bs?.rows)) flat.push(...bs.rows);
    return flat;
};

const addNote = (notes: Record<string, WorkingNoteEntry[]>, key: string, desc: string, amount: number) => {
    if (!desc || amount === 0) return;
    if (!notes[key]) notes[key] = [];
    notes[key].push({
        description: desc,
        currentYearAmount: amount,
        previousYearAmount: 0,
        amount
    });
};

export const mapPnlItemsToNotes = (items: any[]): Record<string, WorkingNoteEntry[]> => {
    const notes: Record<string, WorkingNoteEntry[]> = {};
    items.forEach(item => {
        const desc = String(item?.description || '').trim();
        const rawAmount = findItemAmount(item);
        if (!desc || rawAmount === 0) return;
        const lower = desc.toLowerCase();
        const amount = rawAmount;

        if (lower.includes('revenue') || lower.includes('sales') || lower.includes('turnover')) {
            addNote(notes, 'revenue', desc, amount);
        } else if (lower.includes('cost of revenue') || lower.includes('cost of sales') || lower.includes('cost of goods') || lower.includes('cogs')) {
            addNote(notes, 'cost_of_revenue', desc, amount);
        } else if (lower.includes('gross profit')) {
            addNote(notes, 'gross_profit', desc, amount);
        } else if (lower.includes('general and administrative') || lower.includes('administrative') || lower.includes('admin')) {
            addNote(notes, 'administrative_expenses', desc, amount);
        } else if (lower.includes('bank') && lower.includes('finance')) {
            addNote(notes, 'finance_costs', desc, amount);
        } else if (lower.includes('depreciation') || lower.includes('amortisation')) {
            addNote(notes, 'depreciation_ppe', desc, amount);
        } else if (lower.includes('net profit') && lower.includes('after tax')) {
            addNote(notes, 'profit_after_tax', desc, amount);
        } else if (lower.includes('net profit') || lower.includes('profit for the year') || lower.includes('profit/(loss) for the year')) {
            addNote(notes, 'profit_loss_year', desc, amount);
        } else if (lower.includes('provision for corporate tax')) {
            addNote(notes, 'provisions_corporate_tax', desc, amount);
        } else if (lower.includes('total comprehensive')) {
            addNote(notes, 'total_comprehensive_income', desc, amount);
        }
    });
    return notes;
};

export const mapBsItemsToNotes = (items: any[]): Record<string, WorkingNoteEntry[]> => {
    const notes: Record<string, WorkingNoteEntry[]> = {};
    items.forEach(item => {
        const desc = String(item?.description || '').trim();
        const rawAmount = findItemAmount(item);
        if (!desc || rawAmount === 0) return;
        const lower = desc.toLowerCase();
        const amount = rawAmount;

        if (lower.includes('trade receivables')) {
            addNote(notes, 'trade_receivables', desc, amount);
        } else if (lower.includes('cash and cash equivalents') || lower.includes('cash') || lower.includes('bank')) {
            addNote(notes, 'cash_bank_balances', desc, amount);
        } else if (lower.includes('accounts & other payables') || lower.includes('accounts payable') || lower.includes('payables')) {
            addNote(notes, 'trade_other_payables', desc, amount);
        } else if (lower.includes("shareholder") && lower.includes("current account")) {
            addNote(notes, 'shareholders_current_accounts', desc, amount);
        } else if (lower.includes('share capital') || lower.includes('capital')) {
            addNote(notes, 'share_capital', desc, amount);
        } else if (lower.includes('retained earnings')) {
            addNote(notes, 'retained_earnings', desc, amount);
        } else if (lower.includes('total current assets')) {
            addNote(notes, 'total_current_assets', desc, amount);
        } else if (lower.includes('total assets')) {
            addNote(notes, 'total_assets', desc, amount);
        } else if (lower.includes('total current liabilities')) {
            addNote(notes, 'total_current_liabilities', desc, amount);
        } else if (lower.includes('total liabilities')) {
            addNote(notes, 'total_liabilities', desc, amount);
        } else if (lower.includes('total equity')) {
            addNote(notes, 'total_equity', desc, amount);
        } else if (lower.includes('total liabilities and shareholders') || lower.includes('total liabilities and equity')) {
            addNote(notes, 'total_equity_liabilities', desc, amount);
        }
    });
    return notes;
};
