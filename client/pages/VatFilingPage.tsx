import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import {
    extractTransactionsFromImage,
    extractTransactionsFromText,
    extractInvoicesData,
    deduplicateTransactions
} from '../services/geminiService';
import {
    Transaction,
    BankStatementSummary,
    Invoice,
    Company
} from '../types';
import { generatePreviewUrls, convertFileToParts, extractTextFromPDF, Part } from '../utils/fileUtils';

// UI Components
import { VatFilingDashboard } from '../components/VatFilingDashboard';
import { VatFilingConversionsList } from '../components/VatFilingConversionsList';
import { VatFilingUpload } from '../components/VatFilingUpload';
import { CtCompanyList } from '../components/CtCompanyList';
import { TransactionTable } from '../components/TransactionTable';
import { ReconciliationTable } from '../components/ReconciliationTable';
import { InvoiceResults, type InvoiceResultsSection } from '../components/InvoiceResults';
import { ChevronLeftIcon, DocumentArrowDownIcon, PlusIcon, TrashIcon } from '../components/icons';
import { vatFilingService } from '../services/vatFilingService';

declare const XLSX: any;

const normalizeDateToken = (value: string) => value.trim().toLowerCase();

const isMissingInvoiceDate = (value?: string | null) => {
    const normalized = normalizeDateToken(String(value ?? ''));
    return !normalized || ['n/a', 'na', '-', '--', 'unknown', 'null', 'undefined'].includes(normalized);
};

const toDateKey = (value?: string | null): number | null => {
    if (!value || isMissingInvoiceDate(value)) return null;
    const raw = String(value).trim();

    const dmyMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmyMatch) {
        const day = Number(dmyMatch[1]);
        const month = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);
        if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
        return (year * 10000) + (month * 100) + day;
    }

    const ymdMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
        const year = Number(ymdMatch[1]);
        const month = Number(ymdMatch[2]);
        const day = Number(ymdMatch[3]);
        if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
        return (year * 10000) + (month * 100) + day;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return (parsed.getFullYear() * 10000) + ((parsed.getMonth() + 1) * 100) + parsed.getDate();
};

const formatInvoiceDateForUi = (value?: string | null) => {
    if (isMissingInvoiceDate(value)) return 'N/A';
    const raw = String(value).trim();
    const dmyMatch = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (dmyMatch) {
        return `${String(Number(dmyMatch[1])).padStart(2, '0')}/${String(Number(dmyMatch[2])).padStart(2, '0')}/${dmyMatch[3]}`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
};

const formatVatAmount = (amount: number | undefined | null) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount) || 0);

const getInvoiceConfidenceForUi = (invoice: Invoice): number | null => {
    const parsed = Number((invoice as Invoice & { confidence?: number | string | null }).confidence);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const getInvoiceCategoryLabel = (invoice: Invoice) =>
    invoice.invoiceType === 'sales' ? 'Sales' : 'Purchase';

const formatNumberForExport = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const getTransactionDescriptionText = (transaction: Transaction) =>
    typeof transaction.description === 'string'
        ? transaction.description
        : JSON.stringify(transaction.description ?? '');

const normalizeReconText = (value: unknown) =>
    String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

type VatReconciliationEditRow = {
    transactionIndex: number;
    matchedInvoiceIndex: number | null;
    status: 'Matched' | 'Unmatched';
};

const toNumberSafe = (value: unknown, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

const getReconInvoiceAmount = (invoice: Invoice) =>
    Number(invoice.totalAmountAED ?? invoice.totalAmount ?? 0) || 0;

const getReconInvoiceDirection = (invoice: Invoice): 'credit' | 'debit' =>
    invoice.invoiceType === 'sales' ? 'credit' : 'debit';

const getReconInvoiceParty = (invoice: Invoice) =>
    invoice.invoiceType === 'sales'
        ? (invoice.customerName || invoice.vendorName || '')
        : (invoice.vendorName || invoice.customerName || '');

const getReconTransactionDirection = (transaction: Transaction): 'credit' | 'debit' | 'none' => {
    const credit = Number(transaction.credit) || 0;
    const debit = Number(transaction.debit) || 0;
    if (credit > 0 && credit >= debit) return 'credit';
    if (debit > 0 && debit > credit) return 'debit';
    return 'none';
};

const getReconTransactionAmount = (transaction: Transaction) => {
    const direction = getReconTransactionDirection(transaction);
    if (direction === 'credit') return Number(transaction.credit) || 0;
    if (direction === 'debit') return Number(transaction.debit) || 0;
    return 0;
};

const isReconAmountMatch = (a: number, b: number) => Math.abs(a - b) <= 0.1;

const getReconciliationMatchStatus = (
    transaction: Transaction,
    invoice: Invoice | null
): 'Matched' | 'Unmatched' => {
    if (!invoice) return 'Unmatched';
    const txDirection = getReconTransactionDirection(transaction);
    if (txDirection === 'none') return 'Unmatched';
    const txAmount = getReconTransactionAmount(transaction);
    if (txAmount <= 0) return 'Unmatched';
    const invoiceDirection = getReconInvoiceDirection(invoice);
    if (invoiceDirection !== txDirection) return 'Unmatched';
    const invoiceAmount = getReconInvoiceAmount(invoice);
    return isReconAmountMatch(invoiceAmount, txAmount) ? 'Matched' : 'Unmatched';
};

const buildInvoiceExportRows = (invoices: Invoice[]) => {
    return invoices.map((invoice) => ({
        Date: formatInvoiceDateForUi(invoice.invoiceDate),
        Type: getInvoiceCategoryLabel(invoice),
        'Invoice Number': invoice.invoiceId || 'N/A',
        'Supplier/Vendor': invoice.vendorName || 'N/A',
        Party: invoice.customerName || 'N/A',
        'Supplier TRN': invoice.vendorTrn || 'N/A',
        'Customer TRN': invoice.customerTrn || 'N/A',
        Currency: invoice.currency || 'N/A',
        'Before Tax Amount': formatNumberForExport(invoice.totalBeforeTax),
        VAT: formatNumberForExport(invoice.totalTax),
        'Zero Rated': formatNumberForExport(invoice.zeroRated),
        'Net Amount': formatNumberForExport(invoice.totalAmount),
        'Before Tax (AED)': formatNumberForExport(invoice.totalBeforeTaxAED ?? invoice.totalBeforeTax),
        'VAT (AED)': formatNumberForExport(invoice.totalTaxAED ?? invoice.totalTax),
        'Zero Rated (AED)': formatNumberForExport(invoice.zeroRatedAED),
        'Net Amount (AED)': formatNumberForExport(invoice.totalAmountAED ?? invoice.totalAmount),
        Confidence: getInvoiceConfidenceForUi(invoice) !== null ? `${getInvoiceConfidenceForUi(invoice)}%` : 'N/A',
    }));
};

const buildAutoReconciliationExportRows = (transactions: Transaction[], invoices: Invoice[]) => {
    const indexedTransactions = transactions
        .map((transaction, idx) => ({
            idx,
            transaction,
            dateKey: toDateKey(transaction.date) ?? 0,
            direction: getReconTransactionDirection(transaction),
            amount: getReconTransactionAmount(transaction),
            searchableText: normalizeReconText(`${transaction.date} ${getTransactionDescriptionText(transaction)} ${transaction.sourceFile || ''}`),
        }))
        .sort((a, b) => {
            if (a.dateKey !== b.dateKey) return a.dateKey - b.dateKey;
            return (a.transaction.originalIndex ?? a.idx) - (b.transaction.originalIndex ?? b.idx);
        });

    const indexedInvoices = invoices
        .map((invoice, idx) => ({
            idx,
            invoice,
            dateKey: toDateKey(invoice.invoiceDate) ?? 0,
            direction: getReconInvoiceDirection(invoice),
            amount: getReconInvoiceAmount(invoice),
            partyName: getReconInvoiceParty(invoice),
        }))
        .sort((a, b) => {
            if (a.dateKey !== b.dateKey) return a.dateKey - b.dateKey;
            return a.idx - b.idx;
        });

    const usedInvoices = new Set<number>();

    return indexedTransactions.map((txRow) => {
        let matchedInvoice = undefined as typeof indexedInvoices[number] | undefined;
        let reason = '';

        if (txRow.direction === 'none' || txRow.amount <= 0) {
            reason = 'No clear debit/credit direction';
        } else {
            const candidates = indexedInvoices.filter(inv =>
                !usedInvoices.has(inv.idx) &&
                inv.direction === txRow.direction &&
                isReconAmountMatch(inv.amount, txRow.amount)
            );

            if (candidates.length > 0) {
                const nameMatchedCandidate = candidates.find(inv => {
                    const firstToken = normalizeReconText(inv.partyName).split(' ').find(token => token.length > 2);
                    return !!firstToken && txRow.searchableText.includes(firstToken);
                });
                matchedInvoice = nameMatchedCandidate || candidates[0];
                usedInvoices.add(matchedInvoice.idx);
                reason = 'Matched by amount and direction';
            } else {
                reason = 'No invoice amount matched this bank transaction';
            }
        }

        const tx = txRow.transaction;
        return {
            'Bank Date': formatInvoiceDateForUi(tx.date),
            'Bank Description': getTransactionDescriptionText(tx),
            'Bank Debit': formatNumberForExport(tx.debit),
            'Bank Credit': formatNumberForExport(tx.credit),
            'Bank Balance': formatNumberForExport(tx.balance),
            'Bank Match Amount': formatNumberForExport(txRow.amount),
            Status: matchedInvoice ? 'Matched' : 'Unmatched',
            'Matched Invoice Net Amount': matchedInvoice ? formatNumberForExport(matchedInvoice.invoice.totalAmount) : 0,
        };
    });
};

const buildAutoReconciliationSuggestionMap = (transactions: Transaction[], invoices: Invoice[]) => {
    const indexedTransactions = transactions
        .map((transaction, idx) => ({
            idx,
            transaction,
            dateKey: toDateKey(transaction.date) ?? 0,
            direction: getReconTransactionDirection(transaction),
            amount: getReconTransactionAmount(transaction),
            searchableText: normalizeReconText(`${transaction.date} ${getTransactionDescriptionText(transaction)} ${transaction.sourceFile || ''}`),
        }))
        .sort((a, b) => {
            if (a.dateKey !== b.dateKey) return a.dateKey - b.dateKey;
            return (a.transaction.originalIndex ?? a.idx) - (b.transaction.originalIndex ?? b.idx);
        });

    const indexedInvoices = invoices
        .map((invoice, idx) => ({
            idx,
            invoice,
            dateKey: toDateKey(invoice.invoiceDate) ?? 0,
            direction: getReconInvoiceDirection(invoice),
            amount: getReconInvoiceAmount(invoice),
            partyName: getReconInvoiceParty(invoice),
        }))
        .sort((a, b) => {
            if (a.dateKey !== b.dateKey) return a.dateKey - b.dateKey;
            return a.idx - b.idx;
        });

    const usedInvoices = new Set<number>();
    const suggestionMap = new Map<number, number>();

    indexedTransactions.forEach((txRow) => {
        if (txRow.direction === 'none' || txRow.amount <= 0) return;

        const candidates = indexedInvoices.filter(inv =>
            !usedInvoices.has(inv.idx) &&
            inv.direction === txRow.direction &&
            isReconAmountMatch(inv.amount, txRow.amount)
        );

        if (candidates.length === 0) return;

        const nameMatchedCandidate = candidates.find(inv => {
            const firstToken = normalizeReconText(inv.partyName).split(' ').find(token => token.length > 2);
            return !!firstToken && txRow.searchableText.includes(firstToken);
        });

        const selected = nameMatchedCandidate || candidates[0];
        usedInvoices.add(selected.idx);
        suggestionMap.set(txRow.idx, selected.idx);
    });

    return suggestionMap;
};

const buildEditedReconciliationExportRows = (
    transactions: Transaction[],
    invoices: Invoice[],
    edits: VatReconciliationEditRow[]
) => {
    const editMap = new Map<number, VatReconciliationEditRow>();
    edits.forEach((row) => editMap.set(row.transactionIndex, row));

    return transactions.map((tx, index) => {
        const edit = editMap.get(index);
        const matchedInvoice = edit && edit.matchedInvoiceIndex !== null
            ? invoices[edit.matchedInvoiceIndex] || null
            : null;

        return {
            'Bank Date': formatInvoiceDateForUi(tx.date),
            'Bank Description': getTransactionDescriptionText(tx),
            'Bank Debit': formatNumberForExport(tx.debit),
            'Bank Credit': formatNumberForExport(tx.credit),
            'Bank Balance': formatNumberForExport(tx.balance),
            'Bank Match Amount': formatNumberForExport(getReconTransactionAmount(tx)),
            Status: matchedInvoice ? (edit?.status || 'Matched') : 'Unmatched',
            'Matched Invoice Net Amount': matchedInvoice ? formatNumberForExport(matchedInvoice.totalAmount) : 0,
        };
    });
};

const buildSheet = (rows: Array<Record<string, unknown>>, emptyMessage: string) => {
    if (!rows.length) {
        return XLSX.utils.aoa_to_sheet([[emptyMessage]]);
    }
    return XLSX.utils.json_to_sheet(rows);
};

type VatExcelSheetFormatOptions = {
    headerRows?: number;
    columnWidths?: Array<number | { wch: number }>;
    autoFilter?: boolean;
    leftAlignColumns?: number[];
};

const getExcelHeaderValue = (worksheet: any, columnIndex: number, headerRow = 0) => {
    const cellRef = XLSX.utils.encode_cell({ c: columnIndex, r: headerRow });
    return String(worksheet[cellRef]?.v ?? '');
};

const shouldRightAlignExcelColumn = (headerLabel: string) => {
    const label = headerLabel.toLowerCase();
    return [
        'amount',
        'debit',
        'credit',
        'balance',
        'vat',
        'total',
        'opening',
        'closing',
        'deposits',
        'withdrawals',
        'net change',
        'confidence',
    ].some(token => label.includes(token));
};

const shouldCenterAlignExcelColumn = (headerLabel: string) => {
    const label = headerLabel.toLowerCase();
    return [
        'date',
        'type',
        'currency',
        'status',
        'direction',
        'trn',
        'confidence',
    ].some(token => label.includes(token));
};

const getExcelAutoColumnWidths = (worksheet: any, min = 12, max = 60) => {
    if (!worksheet['!ref']) return [];
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const widths: Array<{ wch: number }> = [];

    for (let col = range.s.c; col <= range.e.c; col++) {
        let longest = min;
        for (let row = range.s.r; row <= range.e.r; row++) {
            const cellRef = XLSX.utils.encode_cell({ c: col, r: row });
            const cell = worksheet[cellRef];
            if (!cell || cell.v == null) continue;
            const cellText = typeof cell.v === 'string'
                ? cell.v
                : (typeof cell.v === 'number' ? cell.v.toFixed(2) : String(cell.v));
            const lines = cellText.split('\n');
            const lineLongest = Math.max(...lines.map(line => line.length));
            longest = Math.max(longest, Math.min(max, lineLongest + 2));
        }
        widths.push({ wch: Math.min(max, Math.max(min, longest)) });
    }

    return widths;
};

const applyVatExcelSheetFormatting = (worksheet: any, options: VatExcelSheetFormatOptions = {}) => {
    if (!worksheet || !worksheet['!ref']) return;

    const headerRows = options.headerRows ?? 1;
    const borderColor = { rgb: 'FFD1D5DB' };
    const border = {
        top: { style: 'thin', color: borderColor },
        bottom: { style: 'thin', color: borderColor },
        left: { style: 'thin', color: borderColor },
        right: { style: 'thin', color: borderColor },
    };
    const headerStyle = {
        font: { name: 'Calibri', bold: true, color: { rgb: 'FF111827' }, sz: 11 },
        fill: { fgColor: { rgb: 'FFF3F4F6' } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    };
    const bodyStyle = {
        font: { name: 'Calibri', color: { rgb: 'FF111827' }, sz: 10 },
        alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    };

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellRef = XLSX.utils.encode_cell({ c: col, r: row });
            const cell = worksheet[cellRef];
            if (!cell) continue;

            const headerLabel = getExcelHeaderValue(worksheet, col, 0);
            const isHeader = row < headerRows;

            cell.s = {
                ...(cell.s || {}),
                border,
                ...(isHeader ? headerStyle : bodyStyle),
            };

            if (isHeader) {
                cell.s.font = {
                    ...(cell.s.font || {}),
                    name: 'Calibri',
                    bold: true,
                    sz: 11,
                    color: { rgb: 'FF111827' },
                };
            }

            if (!isHeader) {
                const isNumericCell = typeof cell.v === 'number';
                const forceLeftAlign = options.leftAlignColumns?.includes(col) ?? false;
                const align = forceLeftAlign
                    ? 'left'
                    : (isNumericCell || shouldRightAlignExcelColumn(headerLabel)
                        ? 'right'
                        : (shouldCenterAlignExcelColumn(headerLabel) ? 'center' : 'left'));
                cell.s.alignment = { ...(cell.s.alignment || {}), horizontal: align, vertical: 'top', wrapText: true };

                if (typeof cell.v === 'number') {
                    const lowerHeader = headerLabel.toLowerCase();
                    if (lowerHeader.includes('confidence')) {
                        cell.z = '0';
                    } else {
                        cell.z = '#,##0.00';
                    }
                }
            }
        }
    }

    worksheet['!cols'] = options.columnWidths
        ? options.columnWidths.map((width) => (typeof width === 'number' ? { wch: width } : width))
        : getExcelAutoColumnWidths(worksheet);

    worksheet['!rows'] = worksheet['!rows'] || [];
    worksheet['!rows'][0] = { hpt: 22 };

    if (options.autoFilter === true && range.e.r >= 0) {
        worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { c: range.s.c, r: 0 }, e: { c: range.e.c, r: 0 } }) };
    } else if (worksheet['!autofilter']) {
        delete worksheet['!autofilter'];
    }
};

export const VatFilingPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { customerId: routeCustomerId, periodId, vatFilingPeriodId, conversionId } = useParams<{
        customerId?: string;
        periodId?: string;
        vatFilingPeriodId?: string;
        conversionId?: string;
    }>();
    const { currentUser } = useAuth();
    const { projectCompanies, knowledgeBase, addHistoryItem, salesSettings } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [vatInvoiceFiles, setVatInvoiceFiles] = useState<File[]>([]);
    const [vatStatementFiles, setVatStatementFiles] = useState<File[]>([]);
    const [pdfPassword, setPdfPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyTrn, setCompanyTrn] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState<{ start: string, end: string } | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<Invoice[]>([]);
    const [summary, setSummary] = useState<BankStatementSummary | null>(null);
    const [currency, setCurrency] = useState('AED');
    const [fileSummaries, setFileSummaries] = useState<Record<string, BankStatementSummary>>({});
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'dashboard' | 'upload'>('dashboard');
    const [statementPreviewUrls, setStatementPreviewUrls] = useState<string[]>([]);
    const [invoicePreviewUrls, setInvoicePreviewUrls] = useState<string[]>([]);
    const [resultsTab, setResultsTab] = useState<
        'bank-statement'
        | 'bank-reconciliation'
        | 'sales'
        | 'purchase'
        | 'others'
        | 'sales-total'
        | 'purchase-total'
        | 'vat-summary'
        | 'vat-return'
    >('bank-statement');
    const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [reconciliationEdits, setReconciliationEdits] = useState<VatReconciliationEditRow[]>([]);
    const [hasLoadedSavedReconciliationEdits, setHasLoadedSavedReconciliationEdits] = useState(false);
    const [vatAdjustments, setVatAdjustments] = useState<{
        sales: {
            standardRatedSupplies?: number;
            outputTax?: number;
            zeroRatedSupplies?: number;
            exemptedSupplies?: number;
        };
        purchase: {
            standardRatedExpenses?: number;
            inputTax?: number;
            zeroRatedExpenses?: number;
            exemptedExpenses?: number;
        };
        vatReturn: {
            dueTax?: number;
            recoverableTax?: number;
            payableTax?: number;
            fundAvailableFta?: number;
            netVatPayable?: number;
        };
    }>({ sales: {}, purchase: {}, vatReturn: {} });

    const resolvedPeriodId = periodId || vatFilingPeriodId || null;
    const isConversionsListRoute = Boolean(routeCustomerId && resolvedPeriodId && !conversionId && location.pathname.includes('/conversions'));
    const isConversionViewRoute = Boolean(routeCustomerId && resolvedPeriodId && conversionId && location.pathname.includes('/conversions/'));
    const isEditMode = useMemo(() => new URLSearchParams(location.search).get('mode') === 'edit', [location.search]);

    useEffect(() => {
        if (!routeCustomerId) {
            if (selectedCompany) {
                setSelectedCompany(null);
                setCompanyName('');
                setCompanyTrn('');
                setViewMode('dashboard');
            }
            return;
        }

        if (!projectCompanies || projectCompanies.length === 0) return;

        const matchedCompany = projectCompanies.find(c => String(c.id) === String(routeCustomerId));
        if (!matchedCompany) return;

        const isDifferentCompany = String(selectedCompany?.id || '') !== String(matchedCompany.id);
        setSelectedCompany(prev => (prev?.id === matchedCompany.id ? prev : matchedCompany));
        if (isDifferentCompany) {
            setCompanyName(matchedCompany.name || '');
            setCompanyTrn(matchedCompany.trn || '');
            setViewMode('dashboard');
        }
    }, [routeCustomerId, projectCompanies, selectedCompany]);

    useEffect(() => {
        if (!routeCustomerId || !resolvedPeriodId) {
            if (!resolvedPeriodId && appState === 'initial' && viewMode === 'upload') {
                setViewMode('dashboard');
                setSelectedPeriod(null);
                setSelectedPeriodId(null);
            }
            return;
        }

        if (!selectedCompany || String(selectedCompany.id) !== String(routeCustomerId)) return;

        let mounted = true;
        vatFilingService.getFilingPeriodById(resolvedPeriodId)
            .then((period) => {
                if (!mounted || !period) return;
                if (String(period.customerId) !== String(routeCustomerId)) return;
                setSelectedPeriodId(period.id);
                setSelectedPeriod({ start: period.periodFrom, end: period.periodTo });
                if (!isConversionsListRoute) {
                    setViewMode('upload');
                }
            })
            .catch((err) => {
                console.error('Failed to load VAT filing period from route:', err);
            });

        return () => { mounted = false; };
    }, [routeCustomerId, resolvedPeriodId, selectedCompany, appState, viewMode, isConversionsListRoute]);

    useEffect(() => {
        if (!isConversionViewRoute || !conversionId) return;
        if (!selectedCompany || !routeCustomerId) return;

        let mounted = true;
        setAppState('loading');
        setProgress(20);
        setProgressMessage('Loading saved conversion...');

        vatFilingService.getConversionById(conversionId)
            .then((conversion) => {
                if (!mounted || !conversion) return;
                if (String(conversion.customerId) !== String(routeCustomerId)) return;
                if (resolvedPeriodId && String(conversion.periodId) !== String(resolvedPeriodId)) return;

                const data = (conversion.data || {}) as Record<string, any>;
                const loadedTransactions = Array.isArray(data.transactions) ? data.transactions as Transaction[] : [];
                const loadedSales = Array.isArray(data.salesInvoices) ? data.salesInvoices as Invoice[] : [];
                const loadedPurchase = Array.isArray(data.purchaseInvoices) ? data.purchaseInvoices as Invoice[] : [];
                const loadedSummary = (data.summary || null) as BankStatementSummary | null;
                const loadedCurrency = typeof data.currency === 'string' && data.currency ? data.currency : 'AED';
                const loadedFileSummaries = (data.fileSummaries && typeof data.fileSummaries === 'object')
                    ? data.fileSummaries as Record<string, BankStatementSummary>
                    : {};
                const loadedPeriod = data.selectedPeriod && typeof data.selectedPeriod === 'object'
                    ? data.selectedPeriod as { start: string; end: string }
                    : null;
                const loadedReconciliationEdits = Array.isArray(data.reconciliationEdits)
                    ? (data.reconciliationEdits as VatReconciliationEditRow[])
                    : [];
                const loadedVatAdjustments = data.vatAdjustments && typeof data.vatAdjustments === 'object'
                    ? data.vatAdjustments as {
                        sales: Record<string, number>;
                        purchase: Record<string, number>;
                        vatReturn: Record<string, number>;
                    }
                    : { sales: {}, purchase: {}, vatReturn: {} };

                setTransactions(loadedTransactions);
                setSalesInvoices(loadedSales);
                setPurchaseInvoices(loadedPurchase);
                setSummary(loadedSummary);
                setCurrency(loadedCurrency);
                setFileSummaries(loadedFileSummaries);
                setStatementPreviewUrls([]);
                setInvoicePreviewUrls([]);
                if (loadedPeriod?.start && loadedPeriod?.end) {
                    setSelectedPeriod({ start: loadedPeriod.start, end: loadedPeriod.end });
                }
                setSelectedPeriodId(conversion.periodId);
                setReconciliationEdits(loadedReconciliationEdits);
                setHasLoadedSavedReconciliationEdits(loadedReconciliationEdits.length > 0);
                setVatAdjustments({
                    sales: loadedVatAdjustments.sales || {},
                    purchase: loadedVatAdjustments.purchase || {},
                    vatReturn: loadedVatAdjustments.vatReturn || {},
                });

                const hasExtractedBankStatementData = !!loadedSummary || Object.keys(loadedFileSummaries).length > 0;
                setResultsTab(
                    hasExtractedBankStatementData
                        ? 'bank-statement'
                        : (loadedSales.length > 0 ? 'sales' : 'purchase')
                );
                setAppState('success');
            })
            .catch((err) => {
                console.error('Failed to load saved VAT conversion:', err);
                if (!mounted) return;
                setError('Failed to load saved conversion.');
                setAppState('error');
            });

        return () => { mounted = false; };
    }, [isConversionViewRoute, conversionId, selectedCompany, routeCustomerId, resolvedPeriodId]);

    useEffect(() => {
        const suggestionMap = buildAutoReconciliationSuggestionMap(transactions, [...salesInvoices, ...purchaseInvoices]);
        setReconciliationEdits((prev) => {
            const next: VatReconciliationEditRow[] = [];
            for (let index = 0; index < transactions.length; index += 1) {
                const existing = prev.find((row) => row.transactionIndex === index);
                if (existing) {
                    const matchedInvoiceIndex = existing.matchedInvoiceIndex;
                    const isIndexValid = matchedInvoiceIndex !== null && matchedInvoiceIndex >= 0 && matchedInvoiceIndex < (salesInvoices.length + purchaseInvoices.length);
                    const selectedInvoice = isIndexValid ? ([...salesInvoices, ...purchaseInvoices][matchedInvoiceIndex!] || null) : null;
                    const status = getReconciliationMatchStatus(transactions[index], selectedInvoice);
                    next.push({
                        transactionIndex: index,
                        matchedInvoiceIndex: isIndexValid ? matchedInvoiceIndex : null,
                        status,
                    });
                } else {
                    const suggestedInvoiceIndex = hasLoadedSavedReconciliationEdits ? null : (suggestionMap.get(index) ?? null);
                    const suggestedInvoice = suggestedInvoiceIndex !== null
                        ? ([...salesInvoices, ...purchaseInvoices][suggestedInvoiceIndex] || null)
                        : null;
                    const status = getReconciliationMatchStatus(transactions[index], suggestedInvoice);
                    next.push({
                        transactionIndex: index,
                        matchedInvoiceIndex: suggestedInvoiceIndex,
                        status,
                    });
                }
            }
            return next;
        });
    }, [transactions, salesInvoices, purchaseInvoices, hasLoadedSavedReconciliationEdits]);

    const classifyInvoice = useCallback((invoice: Invoice): Invoice => {
        const rawType = ((invoice as Invoice & { invoiceType?: string }).invoiceType || '').toLowerCase().trim();
        if (rawType === 'sales' || rawType === 'purchase') {
            return { ...invoice, invoiceType: rawType };
        }

        const normalize = (value: string) => value ? value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
        const companyTrnNormalized = normalize(companyTrn || '');
        const companyNameNormalized = normalize(companyName || '');
        const vendorTrnNormalized = normalize(invoice.vendorTrn || '');
        const customerTrnNormalized = normalize(invoice.customerTrn || '');
        const vendorNameNormalized = normalize(invoice.vendorName || '');
        const customerNameNormalized = normalize(invoice.customerName || '');

        const isSalesByTrn = companyTrnNormalized && vendorTrnNormalized &&
            (companyTrnNormalized === vendorTrnNormalized ||
                companyTrnNormalized.includes(vendorTrnNormalized) ||
                vendorTrnNormalized.includes(companyTrnNormalized));

        const isPurchaseByTrn = companyTrnNormalized && customerTrnNormalized &&
            (companyTrnNormalized === customerTrnNormalized ||
                companyTrnNormalized.includes(customerTrnNormalized) ||
                customerTrnNormalized.includes(companyTrnNormalized));

        if (isSalesByTrn) return { ...invoice, invoiceType: 'sales' };
        if (isPurchaseByTrn) return { ...invoice, invoiceType: 'purchase' };

        const isSalesByName = companyNameNormalized && vendorNameNormalized &&
            (companyNameNormalized.includes(vendorNameNormalized) ||
                vendorNameNormalized.includes(companyNameNormalized));
        const isPurchaseByName = companyNameNormalized && customerNameNormalized &&
            (companyNameNormalized.includes(customerNameNormalized) ||
                customerNameNormalized.includes(companyNameNormalized));

        if (isSalesByName) return { ...invoice, invoiceType: 'sales' };
        if (isPurchaseByName) return { ...invoice, invoiceType: 'purchase' };

        return { ...invoice, invoiceType: 'purchase' };
    }, [companyName, companyTrn]);

    const getInvoiceKey = useCallback((invoice: Invoice) => {
        const date = (invoice.invoiceDate || '').trim().toLowerCase();
        const id = (invoice.invoiceId || '').trim().toLowerCase();
        const amount = Number(invoice.totalAmountAED ?? invoice.totalAmount ?? 0).toFixed(2);
        const vendor = (invoice.vendorName || '').trim().toLowerCase();
        const customer = (invoice.customerName || '').trim().toLowerCase();
        return `${date}|${id}|${amount}|${vendor}|${customer}`;
    }, []);

    useEffect(() => {
        if (appState === 'success') {
            if (vatStatementFiles.length > 0) generatePreviewUrls(vatStatementFiles).then(setStatementPreviewUrls);
            if (vatInvoiceFiles.length > 0) generatePreviewUrls(vatInvoiceFiles).then(setInvoicePreviewUrls);
        }
    }, [appState, vatStatementFiles, vatInvoiceFiles]);

    const handleReset = useCallback(() => {
        setAppState('initial');
        setError(null);
        setTransactions([]);
        setSalesInvoices([]);
        setPurchaseInvoices([]);
        setSummary(null);
        setFileSummaries({});
        setVatInvoiceFiles([]);
        setVatStatementFiles([]);
        setSelectedPeriod(null);
        setSelectedPeriodId(null);
        setReconciliationEdits([]);
        setHasLoadedSavedReconciliationEdits(false);
        setVatAdjustments({ sales: {}, purchase: {}, vatReturn: {} });
        setViewMode('dashboard');
        setStatementPreviewUrls([]);
        setInvoicePreviewUrls([]);
        setResultsTab('bank-statement');
    }, []);

    const processFiles = useCallback(async () => {
        setAppState('loading'); setProgress(10); setProgressMessage('Processing documents...');
        try {
            let localTransactions: Transaction[] = [];
            let localSummary: BankStatementSummary | null = null;
            let localCurrency: string = 'AED';
            let localSalesInvoices: Invoice[] = [];
            let localPurchaseInvoices: Invoice[] = [];
            const localFileSummaries: Record<string, BankStatementSummary> = {};

            if (vatStatementFiles.length > 0) {
                let allRaw: Transaction[] = [];
                let fileIndex = 0;

                for (const file of vatStatementFiles) {
                    fileIndex += 1;
                    setProgressMessage(`Processing bank statement ${fileIndex}/${vatStatementFiles.length}...`);

                    const isPdfFile = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
                    let statementResult: { transactions: Transaction[]; summary: BankStatementSummary; currency: string } | null = null;

                    if (isPdfFile) {
                        try {
                            const extractedText = await extractTextFromPDF(file);
                            if (extractedText && extractedText.trim().length > 100) {
                                statementResult = await extractTransactionsFromText(
                                    extractedText
                                );
                            }
                        } catch (textError) {
                            console.warn(`[VAT Filing] Text extraction failed for ${file.name}, falling back to image extraction`, textError);
                        }
                    }

                    if (!statementResult) {
                        const parts = await convertFileToParts(file);
                        statementResult = await extractTransactionsFromImage(
                            parts
                        );
                    }

                    allRaw.push(...statementResult.transactions.map(t => ({ ...t, sourceFile: file.name })));
                    localFileSummaries[file.name] = statementResult.summary;

                    if (!localSummary) localSummary = statementResult.summary;
                    localCurrency = statementResult.currency || localCurrency;
                }

                localTransactions = deduplicateTransactions(allRaw);
            }

            if (vatInvoiceFiles.length > 0) {
                const mergedInvoices: Invoice[] = [];
                for (const file of vatInvoiceFiles) {
                    const fileParts: Part[] = await convertFileToParts(file);
                    const res = await extractInvoicesData(fileParts, knowledgeBase, companyName, companyTrn) as { invoices: Invoice[] };
                    const normalizedInvoices = Array.isArray(res?.invoices) ? (res.invoices as Invoice[]) : [];
                    mergedInvoices.push(...normalizedInvoices.map((invoice) => classifyInvoice(invoice)));
                }

                const seen = new Set<string>();
                const uniqueInvoices = mergedInvoices.filter((invoice) => {
                    const key = getInvoiceKey(invoice);
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                localSalesInvoices = uniqueInvoices.filter(i => i.invoiceType === 'sales');
                localPurchaseInvoices = uniqueInvoices.filter(i => i.invoiceType === 'purchase');
            }

            const hasExtractedBankStatementData = vatStatementFiles.length > 0 && (!!localSummary || Object.keys(localFileSummaries).length > 0);
            setTransactions(localTransactions);
            setSummary(localSummary);
            setCurrency(localCurrency);
            setSalesInvoices(localSalesInvoices);
            setPurchaseInvoices(localPurchaseInvoices);
            setFileSummaries(localFileSummaries);
            setReconciliationEdits([]);
            setHasLoadedSavedReconciliationEdits(false);
            setVatAdjustments({ sales: {}, purchase: {}, vatReturn: {} });
            setResultsTab(
                hasExtractedBankStatementData
                    ? 'bank-statement'
                    : (localSalesInvoices.length > 0 ? 'sales' : 'purchase')
            );
            setAppState('success');
            addHistoryItem({
                id: Date.now().toString(),
                type: 'VAT Filing',
                title: `VAT Filing - ${selectedCompany?.name}`,
                processedAt: new Date().toISOString(),
                pageCount: vatStatementFiles.length + vatInvoiceFiles.length,
                processedBy: currentUser?.name || 'User',
                customerId: selectedCompany?.id,
                serviceId: salesSettings.servicesRequired.find(s => s.name === 'VAT Filing')?.id,
                transactions: localTransactions,
                summary: localSummary || undefined,
                salesInvoices: localSalesInvoices,
                purchaseInvoices: localPurchaseInvoices,
                currency: localCurrency
            });
        } catch (e: any) { setError(e.message); setAppState('error'); }
    }, [vatStatementFiles, vatInvoiceFiles, selectedPeriod, knowledgeBase, companyName, companyTrn, currentUser, addHistoryItem, selectedCompany, classifyInvoice, getInvoiceKey]);

    const handleStartFiling = (start: string, end: string, periodId?: string) => {
        setSelectedPeriod({ start, end });
        setSelectedPeriodId(periodId || null);
        setViewMode('upload');
        if (selectedCompany?.id && periodId) {
            navigate(`/projects/vat-filing/${selectedCompany.id}/periods/${periodId}/upload`);
        }
    };

    const updateTransactionField = (index: number, field: keyof Transaction, value: string) => {
        setTransactions((prev) => prev.map((row, rowIndex) => {
            if (rowIndex !== index) return row;
            if (field === 'debit' || field === 'credit' || field === 'balance' || field === 'confidence') {
                return { ...row, [field]: toNumberSafe(value, 0) } as Transaction;
            }
            return { ...row, [field]: value } as Transaction;
        }));
    };

    const addTransactionRow = () => {
        setTransactions((prev) => [
            ...prev,
            {
                date: '',
                description: '',
                debit: 0,
                credit: 0,
                balance: 0,
                confidence: 0,
                currency: currency || 'AED',
            }
        ]);
    };

    const removeTransactionRow = (index: number) => {
        setTransactions((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    };

    const updateSummaryField = (key: string, value: string) => {
        setSummary((prev) => {
            const base = (prev || {}) as Record<string, unknown>;
            const numeric = Number(value);
            const parsedValue: unknown = value.trim() === '' ? '' : (Number.isFinite(numeric) ? numeric : value);
            return { ...base, [key]: parsedValue } as unknown as BankStatementSummary;
        });
    };

    const updateInvoiceField = (bucket: 'sales' | 'purchase', index: number, field: keyof Invoice, value: string) => {
        const setBucket = bucket === 'sales' ? setSalesInvoices : setPurchaseInvoices;
        setBucket((prev) => prev.map((row, rowIndex) => {
            if (rowIndex !== index) return row;
            const numericFields: Array<keyof Invoice> = [
                'totalBeforeTax', 'totalTax', 'zeroRated', 'totalAmount',
                'totalBeforeTaxAED', 'totalTaxAED', 'zeroRatedAED', 'totalAmountAED', 'confidence'
            ];
            if (numericFields.includes(field)) {
                return { ...row, [field]: toNumberSafe(value, 0) } as Invoice;
            }
            return { ...row, [field]: value } as Invoice;
        }));
    };

    const addInvoiceRow = (bucket: 'sales' | 'purchase') => {
        const setBucket = bucket === 'sales' ? setSalesInvoices : setPurchaseInvoices;
        setBucket((prev) => [
            ...prev,
            {
                invoiceId: '',
                vendorName: '',
                customerName: '',
                invoiceDate: '',
                totalBeforeTax: 0,
                totalTax: 0,
                zeroRated: 0,
                totalAmount: 0,
                totalBeforeTaxAED: 0,
                totalTaxAED: 0,
                zeroRatedAED: 0,
                totalAmountAED: 0,
                currency: 'AED',
                lineItems: [],
                invoiceType: bucket,
                vendorTrn: '',
                customerTrn: '',
                confidence: 0,
            }
        ]);
    };

    const removeInvoiceRow = (bucket: 'sales' | 'purchase', index: number) => {
        const setBucket = bucket === 'sales' ? setSalesInvoices : setPurchaseInvoices;
        setBucket((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    };

    const updateReconciliationEdit = (transactionIndex: number, matchedInvoiceIndexRaw: string) => {
        const trimmed = String(matchedInvoiceIndexRaw ?? '').trim();
        const matchedInvoiceIndex = trimmed === ''
            ? null
            : (() => {
                const parsed = Number(trimmed);
                return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
            })();
        const selectedInvoice = matchedInvoiceIndex !== null
            ? ([...salesInvoices, ...purchaseInvoices][matchedInvoiceIndex] || null)
            : null;
        const tx = transactions[transactionIndex];
        const status = tx ? getReconciliationMatchStatus(tx, selectedInvoice) : 'Unmatched';
        setReconciliationEdits((prev) => prev.map((row) => {
            if (row.transactionIndex !== transactionIndex) return row;
            return {
                ...row,
                matchedInvoiceIndex,
                status,
            };
        }));
    };

    const updateVatAdjustmentField = (
        section: 'sales' | 'purchase' | 'vatReturn',
        field: string,
        value: string
    ) => {
        setVatAdjustments((prev) => ({
            ...prev,
            [section]: {
                ...(prev[section] || {}),
                [field]: toNumberSafe(value, 0),
            },
        }));
    };

    if (!selectedCompany) return <CtCompanyList companies={projectCompanies} onSelectCompany={(comp) => {
        if (!comp) return;
        setSelectedCompany(comp);
        setCompanyName(comp.name);
        setCompanyTrn(comp.trn);
        navigate(`/projects/vat-filing/${comp.id}`);
    }} title="Select Company for VAT Filing" />;
    if (appState === 'loading') return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;
    if (appState === 'error') return <div className="text-center p-10"><div className="text-destructive mb-4">{error}</div><button onClick={handleReset} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Try Again</button></div>;
    if (isConversionsListRoute && resolvedPeriodId) {
        return (
            <VatFilingConversionsList
                company={selectedCompany}
                periodId={resolvedPeriodId}
                onBackToPeriods={() => navigate(`/projects/vat-filing/${selectedCompany.id}`)}
                onOpenConversion={(id) => navigate(`/projects/vat-filing/${selectedCompany.id}/periods/${resolvedPeriodId}/conversions/${id}`)}
                onEditConversion={(id) => navigate(`/projects/vat-filing/${selectedCompany.id}/periods/${resolvedPeriodId}/conversions/${id}?mode=edit`)}
                onNewUpload={() => navigate(`/projects/vat-filing/${selectedCompany.id}/periods/${resolvedPeriodId}/upload`)}
            />
        );
    }

    if (appState === 'success') {
        const hasBankTransactions = transactions.length > 0;
        const hasBankStatementData = hasBankTransactions || !!summary || Object.keys(fileSummaries).length > 0;
        const periodFromKey = toDateKey(selectedPeriod?.start);
        const periodToKey = toDateKey(selectedPeriod?.end);
        const isInvoiceWithinSelectedPeriod = (invoice: Invoice) => {
            const invoiceDateKey = toDateKey(invoice.invoiceDate);
            if (invoiceDateKey === null) return false;
            if (periodFromKey === null || periodToKey === null) return true;
            return invoiceDateKey >= periodFromKey && invoiceDateKey <= periodToKey;
        };
        const inPeriodSalesInvoices = salesInvoices.filter(isInvoiceWithinSelectedPeriod);
        const inPeriodPurchaseInvoices = purchaseInvoices.filter(isInvoiceWithinSelectedPeriod);
        const hasAnyInvoices = salesInvoices.length > 0 || purchaseInvoices.length > 0;
        const hasInvoicesInPeriod = inPeriodSalesInvoices.length > 0 || inPeriodPurchaseInvoices.length > 0;
        const hasSales = inPeriodSalesInvoices.length > 0;
        const hasPurchases = inPeriodPurchaseInvoices.length > 0;
        const allInvoices = [...salesInvoices, ...purchaseInvoices];
        const allInPeriodInvoices = [...inPeriodSalesInvoices, ...inPeriodPurchaseInvoices];
        const allInvoicesWithReference = [
            ...salesInvoices.map((invoice, index) => ({ invoice, sourceType: 'sales' as const, sourceIndex: index })),
            ...purchaseInvoices.map((invoice, index) => ({ invoice, sourceType: 'purchase' as const, sourceIndex: index })),
        ];
        const inPeriodSalesInvoicesWithReference = salesInvoices
            .map((invoice, sourceIndex) => ({ invoice, sourceIndex }))
            .filter(({ invoice }) => isInvoiceWithinSelectedPeriod(invoice));
        const inPeriodPurchaseInvoicesWithReference = purchaseInvoices
            .map((invoice, sourceIndex) => ({ invoice, sourceIndex }))
            .filter(({ invoice }) => isInvoiceWithinSelectedPeriod(invoice));
        const otherInvoices = allInvoicesWithReference
            .map(({ invoice, sourceType, sourceIndex }, index) => {
                const invoiceDateKey = toDateKey(invoice.invoiceDate);
                const missingDate = invoiceDateKey === null;
                const outOfRange = !missingDate && periodFromKey !== null && periodToKey !== null
                    ? (invoiceDateKey < periodFromKey || invoiceDateKey > periodToKey)
                    : false;

                if (!missingDate && !outOfRange) return null;

                return {
                    id: `${invoice.invoiceId || 'no-id'}-${index}`,
                    invoice,
                    sourceType,
                    sourceIndex,
                };
            })
            .filter(Boolean) as Array<{ id: string; invoice: Invoice; sourceType: 'sales' | 'purchase'; sourceIndex: number }>;
        const invoiceResultsVisibleSectionsByTab: Partial<Record<typeof resultsTab, InvoiceResultsSection[]>> = {
            sales: ['sales'],
            purchase: ['purchase'],
            'sales-total': ['salesTotal'],
            'purchase-total': ['purchaseTotal'],
            'vat-summary': ['vatSummary'],
            'vat-return': ['vatReturn'],
        };

        const tabs = [
            { id: 'bank-statement' as const, label: 'Bank Statement', enabled: hasBankStatementData },
            { id: 'bank-reconciliation' as const, label: 'Bank Reconciliation', enabled: hasBankTransactions && hasAnyInvoices },
            { id: 'sales' as const, label: 'Sales', enabled: hasSales },
            { id: 'purchase' as const, label: 'Purchase', enabled: hasPurchases },
            { id: 'others' as const, label: 'Others', enabled: otherInvoices.length > 0 || hasAnyInvoices },
            { id: 'sales-total' as const, label: 'Sales Total', enabled: hasSales },
            { id: 'purchase-total' as const, label: 'Purchase Total', enabled: hasPurchases },
            { id: 'vat-summary' as const, label: 'VAT Summary', enabled: hasInvoicesInPeriod },
            { id: 'vat-return' as const, label: 'VAT Return', enabled: hasInvoicesInPeriod },
        ];

        const activeTabIsEnabled = tabs.some(tab => tab.id === resultsTab && tab.enabled);
        const fallbackTab = tabs.find(tab => tab.enabled)?.id ?? 'bank-statement';
        const activeTab = activeTabIsEnabled ? resultsTab : fallbackTab;

        const salesSummaryData = {
            standardRatedSupplies: toNumberSafe(vatAdjustments.sales.standardRatedSupplies, inPeriodSalesInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0)),
            outputTax: toNumberSafe(vatAdjustments.sales.outputTax, inPeriodSalesInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0)),
            zeroRatedSupplies: toNumberSafe(vatAdjustments.sales.zeroRatedSupplies, inPeriodSalesInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0)),
            exemptedSupplies: toNumberSafe(vatAdjustments.sales.exemptedSupplies, 0),
        };
        const purchaseSummaryData = {
            standardRatedExpenses: toNumberSafe(vatAdjustments.purchase.standardRatedExpenses, inPeriodPurchaseInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0)),
            inputTax: toNumberSafe(vatAdjustments.purchase.inputTax, inPeriodPurchaseInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0)),
            zeroRatedExpenses: toNumberSafe(vatAdjustments.purchase.zeroRatedExpenses, inPeriodPurchaseInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0)),
            exemptedExpenses: toNumberSafe(vatAdjustments.purchase.exemptedExpenses, 0),
        };
        const salesTotalAmountIncludingVat = salesSummaryData.standardRatedSupplies + salesSummaryData.outputTax;
        const purchaseTotalAmountIncludingVat = purchaseSummaryData.standardRatedExpenses + purchaseSummaryData.inputTax;
        const vatReturnData = {
            sales: {
                totalAmount: salesSummaryData.standardRatedSupplies + salesSummaryData.zeroRatedSupplies + salesSummaryData.exemptedSupplies,
                totalVat: salesSummaryData.outputTax,
            },
            expenses: {
                totalAmount: purchaseSummaryData.standardRatedExpenses + purchaseSummaryData.zeroRatedExpenses + purchaseSummaryData.exemptedExpenses,
                totalVat: purchaseSummaryData.inputTax,
            },
        };
        const vatNetData = {
            dueTax: toNumberSafe(vatAdjustments.vatReturn.dueTax, vatReturnData.sales.totalVat),
            recoverableTax: toNumberSafe(vatAdjustments.vatReturn.recoverableTax, vatReturnData.expenses.totalVat),
            payableTax: toNumberSafe(vatAdjustments.vatReturn.payableTax, vatReturnData.sales.totalVat),
            fundAvailableFta: toNumberSafe(vatAdjustments.vatReturn.fundAvailableFta, 0),
            netVatPayable: toNumberSafe(vatAdjustments.vatReturn.netVatPayable, vatReturnData.sales.totalVat - vatReturnData.expenses.totalVat),
        };

        const handleSaveDraft = async () => {
            if (!selectedCompany?.id) return;
            const effectivePeriodId = selectedPeriodId || resolvedPeriodId;
            if (!effectivePeriodId) {
                alert('Cannot save draft: filing period id not found.');
                return;
            }

            const conversionPayload = {
                selectedPeriod,
                transactions,
                summary,
                currency,
                fileSummaries,
                salesInvoices,
                purchaseInvoices,
                reconciliationEdits,
                vatAdjustments,
            };

            try {
                setIsSavingDraft(true);

                if (conversionId) {
                    await vatFilingService.updateConversion(conversionId, {
                        status: 'draft',
                        data: conversionPayload,
                    });
                } else {
                    const created = await vatFilingService.createConversion({
                        customerId: selectedCompany.id,
                        periodId: effectivePeriodId,
                        status: 'draft',
                        data: conversionPayload,
                    });

                    if (created?.id) {
                        navigate(`/projects/vat-filing/${selectedCompany.id}/periods/${effectivePeriodId}/conversions/${created.id}`);
                    }
                }
            } catch (saveError) {
                console.error('Failed to save VAT draft conversion:', saveError);
                alert('Failed to save draft conversion.');
            } finally {
                setIsSavingDraft(false);
            }
        };

        const handleDownloadVatFilingExcel = () => {
            if (typeof XLSX === 'undefined') {
                console.error('XLSX library is not loaded.');
                return;
            }

            const workbook = XLSX.utils.book_new();
            const appendJsonSheet = (
                name: string,
                rows: Array<Record<string, unknown>>,
                emptyMessage: string,
                columnWidths?: Array<number | { wch: number }>,
                formatOptions?: Omit<VatExcelSheetFormatOptions, 'columnWidths'>
            ) => {
                const sheet = buildSheet(rows, emptyMessage);
                applyVatExcelSheetFormatting(sheet, { columnWidths, ...(formatOptions || {}) });
                XLSX.utils.book_append_sheet(workbook, sheet, name);
            };
            const appendAoaSheet = (
                name: string,
                data: any[][],
                columnWidths?: Array<number | { wch: number }>,
                formatOptions?: Omit<VatExcelSheetFormatOptions, 'columnWidths'>
            ) => {
                const sheet = XLSX.utils.aoa_to_sheet(data);
                applyVatExcelSheetFormatting(sheet, { columnWidths, ...(formatOptions || {}) });
                XLSX.utils.book_append_sheet(workbook, sheet, name);
            };

            const bankAccountSummaryRows: Array<Record<string, unknown>> = [];
            if (summary) {
                Object.entries(summary).forEach(([key, value]) => {
                    if (key === 'fileBalances') return;
                    bankAccountSummaryRows.push({
                        Field: key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()),
                        Value: typeof value === 'object' && value !== null ? JSON.stringify(value) : value,
                    });
                });
            }
            bankAccountSummaryRows.push(
                { Field: 'Detected Currency', Value: currency },
                { Field: 'Total Transactions', Value: transactions.length },
                { Field: 'Total Debits', Value: transactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0) },
                { Field: 'Total Credits', Value: transactions.reduce((sum, t) => sum + (Number(t.credit) || 0), 0) },
                { Field: 'Net Change', Value: transactions.reduce((sum, t) => sum + (Number(t.credit) || 0) - (Number(t.debit) || 0), 0) },
            );
            appendJsonSheet('Bank Account Summary', bankAccountSummaryRows, 'No bank account summary data', [40, 95], { leftAlignColumns: [1] });

            appendJsonSheet(
                'Bank Statement',
                transactions.map((t) => ({
                    Date: formatInvoiceDateForUi(t.date),
                    Description: getTransactionDescriptionText(t),
                    Debit: formatNumberForExport(t.debit),
                    Credit: formatNumberForExport(t.credit),
                    Balance: formatNumberForExport(t.balance),
                    Currency: currency,
                    'Source File': t.sourceFile || 'N/A',
                })),
                'No bank statement transactions',
                [14, 65, 16, 16, 16, 12, 28]
            );

            appendJsonSheet(
                'Bank Reconciliation',
                reconciliationEdits.some((row) => row.matchedInvoiceIndex !== null)
                    ? buildEditedReconciliationExportRows(transactions, allInvoices, reconciliationEdits)
                    : buildAutoReconciliationExportRows(transactions, allInvoices),
                'No bank reconciliation data',
                [14, 60, 14, 14, 16, 18, 14, 24]
            );

            const invoiceSheetWidths = [14, 12, 18, 35, 35, 20, 20, 12, 18, 12, 14, 16, 18, 14, 18, 18, 12];
            appendJsonSheet('UAE - Invoices', buildInvoiceExportRows(allInPeriodInvoices), 'No invoice transactions', invoiceSheetWidths);
            appendJsonSheet('UAE - Sales', buildInvoiceExportRows(inPeriodSalesInvoices), 'No sales invoice transactions', invoiceSheetWidths);
            appendJsonSheet('UAE - Purchase', buildInvoiceExportRows(inPeriodPurchaseInvoices), 'No purchase invoice transactions', invoiceSheetWidths);
            appendJsonSheet('Others', buildInvoiceExportRows(otherInvoices.map(row => row.invoice)), 'No other invoice transactions', invoiceSheetWidths);

            appendAoaSheet('Sales Total', [
                ['Metric', 'Amount (AED)'],
                ['Standard Rated Supplies', salesSummaryData.standardRatedSupplies],
                ['Output Tax', salesSummaryData.outputTax],
                ['Zero Rated Supplies', salesSummaryData.zeroRatedSupplies],
                ['Exempted Supplies', salesSummaryData.exemptedSupplies],
                ['Sales Total (Std + Tax)', salesTotalAmountIncludingVat],
            ], [42, 22]);

            appendAoaSheet('Purchase Total', [
                ['Metric', 'Amount (AED)'],
                ['Standard Rated Expenses', purchaseSummaryData.standardRatedExpenses],
                ['Input Tax', purchaseSummaryData.inputTax],
                ['Zero Rated Expenses', purchaseSummaryData.zeroRatedExpenses],
                ['Exempted Expenses', purchaseSummaryData.exemptedExpenses],
                ['Purchase Total (Std + Tax)', purchaseTotalAmountIncludingVat],
            ], [42, 22]);

            appendAoaSheet('VatSummary', [
                ['Section', 'Metric', 'Amount (AED)'],
                ['Sales', 'Standard Rated Supplies', salesSummaryData.standardRatedSupplies],
                ['Sales', 'Output Tax', salesSummaryData.outputTax],
                ['Sales', 'Zero Rated Supplies', salesSummaryData.zeroRatedSupplies],
                ['Sales', 'Exempted Supplies', salesSummaryData.exemptedSupplies],
                ['Sales', 'Total (Std + Tax)', salesTotalAmountIncludingVat],
                ['Purchase', 'Standard Rated Expenses', purchaseSummaryData.standardRatedExpenses],
                ['Purchase', 'Input Tax', purchaseSummaryData.inputTax],
                ['Purchase', 'Zero Rated Expenses', purchaseSummaryData.zeroRatedExpenses],
                ['Purchase', 'Exempted Expenses', purchaseSummaryData.exemptedExpenses],
                ['Purchase', 'Total (Std + Tax)', purchaseTotalAmountIncludingVat],
                ['Net', 'Net VAT Position', vatNetData.netVatPayable],
            ], [16, 36, 22]);

            appendAoaSheet('Vat Return', [
                ['Section', 'Description', 'Amount (AED)', 'VAT Amount (AED)'],
                ['VAT on Sales and All Other Outputs', 'Standard Rated Supplies', salesSummaryData.standardRatedSupplies, salesSummaryData.outputTax],
                ['VAT on Sales and All Other Outputs', 'Reverse Charge Provisions (Supplies)', 0, 0],
                ['VAT on Sales and All Other Outputs', 'Zero Rated Supplies', salesSummaryData.zeroRatedSupplies, 0],
                ['VAT on Sales and All Other Outputs', 'Exempted Supplies', salesSummaryData.exemptedSupplies, 0],
                ['VAT on Sales and All Other Outputs', 'Goods Imported into UAE', 0, 0],
                ['VAT on Sales and All Other Outputs', 'Total Amount', vatReturnData.sales.totalAmount, vatReturnData.sales.totalVat],
                [],
                ['VAT on Expenses and All Other Inputs', 'Standard Rated Expenses', purchaseSummaryData.standardRatedExpenses, purchaseSummaryData.inputTax],
                ['VAT on Expenses and All Other Inputs', 'Reverse Charge Provisions (Expenses)', 0, 0],
                ['VAT on Expenses and All Other Inputs', 'Total Amount', vatReturnData.expenses.totalAmount, vatReturnData.expenses.totalVat],
                [],
                ['Net VAT Value', 'Total Value of due tax for the period', vatNetData.dueTax, ''],
                ['Net VAT Value', 'Total Value of recoverable tax for the period', vatNetData.recoverableTax, ''],
                ['Net VAT Value', 'VAT Payable for the Period', vatNetData.payableTax, ''],
                ['Net VAT Value', 'Fund Available FTA', 0, ''],
                ['Net VAT Value', 'Net VAT Payable for the Period', vatNetData.netVatPayable, ''],
            ], [34, 48, 20, 20]);

            const safeCompanyName = (selectedCompany.name || 'company').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
            const periodLabel = selectedPeriod ? `${selectedPeriod.start}_to_${selectedPeriod.end}` : 'period';
            XLSX.writeFile(workbook, `VAT_Filing_${safeCompanyName}_${periodLabel}.xlsx`);
        };

        const commonDownloadExcelButton = (
            <button
                type="button"
                onClick={handleDownloadVatFilingExcel}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border bg-primary text-primary-foreground border-primary hover:bg-primary/90 transition-colors"
            >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Download Excel
            </button>
        );

        const saveDraftButton = (
            <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border bg-background text-foreground border-border hover:bg-muted transition-colors disabled:opacity-60"
            >
                {isSavingDraft ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Save Draft')}
            </button>
        );

        const renderInvoiceResultsTab = (sections: InvoiceResultsSection[]) => (
            <InvoiceResults
                invoices={[...inPeriodSalesInvoices, ...inPeriodPurchaseInvoices]}
                previewUrls={invoicePreviewUrls}
                knowledgeBase={knowledgeBase}
                onAddToKnowledgeBase={() => { }}
                onUpdateInvoice={(index, invoice) => {
                    const salesSourceIndexes = inPeriodSalesInvoicesWithReference.map((row) => row.sourceIndex);
                    const purchaseSourceIndexes = inPeriodPurchaseInvoicesWithReference.map((row) => row.sourceIndex);
                    if (index < salesSourceIndexes.length) {
                        const sourceIndex = salesSourceIndexes[index];
                        if (sourceIndex === undefined) return;
                        setSalesInvoices((prev) => prev.map((row, rowIndex) => (rowIndex === sourceIndex ? invoice : row)));
                    } else {
                        const purchaseOffset = index - salesSourceIndexes.length;
                        const sourceIndex = purchaseSourceIndexes[purchaseOffset];
                        if (sourceIndex === undefined) return;
                        setPurchaseInvoices((prev) => prev.map((row, rowIndex) => (rowIndex === sourceIndex ? invoice : row)));
                    }
                }}
                onReset={() => { }}
                visibleSections={sections}
                showExportButton={false}
            />
        );

        const allInvoicesForEdit = [...salesInvoices, ...purchaseInvoices];
        const inputClassName = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground";

        const renderEditableInvoiceTable = (
            bucket: 'sales' | 'purchase',
            rows: Array<{ invoice: Invoice; sourceIndex: number }>
        ) => (
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-foreground">{bucket === 'sales' ? 'Sales Invoices' : 'Purchase Invoices'}</h3>
                    <button
                        type="button"
                        onClick={() => addInvoiceRow(bucket)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Add Row
                    </button>
                </div>
                {rows.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No invoices in this section.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-muted-foreground">
                            <thead className="text-xs uppercase bg-muted/80">
                                <tr>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2">Invoice No</th>
                                    <th className="px-3 py-2">Supplier/Vendor</th>
                                    <th className="px-3 py-2">Party</th>
                                    <th className="px-3 py-2 text-right">Before Tax</th>
                                    <th className="px-3 py-2 text-right">VAT</th>
                                    <th className="px-3 py-2 text-right">Net</th>
                                    <th className="px-3 py-2 text-right">Before Tax (AED)</th>
                                    <th className="px-3 py-2 text-right">VAT (AED)</th>
                                    <th className="px-3 py-2 text-right">Net (AED)</th>
                                    <th className="px-3 py-2 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(({ invoice, sourceIndex }, displayIndex) => (
                                    <tr key={`${bucket}-${displayIndex}`} className="border-b border-border last:border-b-0">
                                        <td className="px-3 py-2"><input className={inputClassName} value={invoice.invoiceDate || ''} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'invoiceDate', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input className={inputClassName} value={invoice.invoiceId || ''} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'invoiceId', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input className={inputClassName} value={invoice.vendorName || ''} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'vendorName', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input className={inputClassName} value={invoice.customerName || ''} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'customerName', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalBeforeTax || 0)} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'totalBeforeTax', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalTax || 0)} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'totalTax', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalAmount || 0)} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'totalAmount', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalBeforeTaxAED || 0)} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'totalBeforeTaxAED', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalTaxAED || 0)} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'totalTaxAED', e.target.value)} /></td>
                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalAmountAED || 0)} onChange={(e) => updateInvoiceField(bucket, sourceIndex, 'totalAmountAED', e.target.value)} /></td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => removeInvoiceRow(bucket, sourceIndex)}
                                                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                title="Remove invoice row"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );

        return (
            <div className="space-y-8">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <button onClick={() => { handleReset(); navigate(`/projects/vat-filing/${selectedCompany.id}`); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Dashboard</button>
                        <h2 className="text-xl font-bold text-foreground">VAT Filing Results - {selectedCompany.name}</h2>
                        {isEditMode && <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/30">Edit Mode</span>}
                    </div>

                    <div className="bg-card border border-border rounded-2xl p-2">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => tab.enabled && setResultsTab(tab.id)}
                                    disabled={!tab.enabled}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors ${activeTab === tab.id
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : tab.enabled
                                            ? 'bg-background text-foreground border-border hover:bg-muted'
                                            : 'bg-muted/50 text-muted-foreground border-border opacity-60 cursor-not-allowed'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeTab !== 'bank-statement' && (
                        <div className="flex justify-end gap-2">
                            {saveDraftButton}
                            {commonDownloadExcelButton}
                        </div>
                    )}
                </div>

                {activeTab === 'bank-statement' && hasBankStatementData && (
                    <div className="space-y-4">
                        {!hasBankTransactions && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                                Bank statement was extracted, but no transactions could be detected from the uploaded file.
                                Please verify the statement quality/format and try again.
                            </div>
                        )}
                        {!isEditMode ? (
                            <TransactionTable
                                transactions={transactions}
                                onReset={() => { }}
                                previewUrls={statementPreviewUrls}
                                summary={summary}
                                currency={currency}
                                analysis={null}
                                isAnalyzing={false}
                                analysisError={null}
                                onAnalyze={() => { }}
                                summaryTitle="Bank Statement Summary"
                                hideAnalyzeAction={true}
                                hideCopyCsvAction={true}
                                previewPosition="right"
                                uiVariant="vat"
                                hideTransactionConfidenceColumn={true}
                                extraActionsBeforeExport={
                                    <div className="flex items-center gap-2">
                                        {saveDraftButton}
                                        {commonDownloadExcelButton}
                                    </div>
                                }
                                hideExportXlsxAction={true}
                            />
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-card border border-border rounded-xl p-4">
                                    <h3 className="text-lg font-semibold text-foreground mb-3">Bank Statement Summary</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {Object.entries(summary || {}).map(([key, value]) => (
                                            <div key={key}>
                                                <label className="block text-xs text-muted-foreground mb-1">{key.replace(/([A-Z])/g, ' $1')}</label>
                                                <input
                                                    className={inputClassName}
                                                    value={String(value ?? '')}
                                                    onChange={(e) => updateSummaryField(key, e.target.value)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-card border border-border rounded-xl overflow-hidden">
                                    <div className="p-4 border-b border-border flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-foreground">Bank Transactions</h3>
                                        <button type="button" onClick={addTransactionRow} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-muted">
                                            <PlusIcon className="w-4 h-4" /> Add Row
                                        </button>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs uppercase bg-muted/80 text-muted-foreground">
                                                <tr>
                                                    <th className="px-3 py-2">Date</th>
                                                    <th className="px-3 py-2">Description</th>
                                                    <th className="px-3 py-2">Debit</th>
                                                    <th className="px-3 py-2">Credit</th>
                                                    <th className="px-3 py-2">Balance</th>
                                                    <th className="px-3 py-2">Confidence</th>
                                                    <th className="px-3 py-2 text-center">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactions.map((tx, index) => (
                                                    <tr key={`tx-${index}`} className="border-b border-border last:border-b-0">
                                                        <td className="px-3 py-2"><input className={inputClassName} value={tx.date || ''} onChange={(e) => updateTransactionField(index, 'date', e.target.value)} /></td>
                                                        <td className="px-3 py-2"><input className={inputClassName} value={String(tx.description || '')} onChange={(e) => updateTransactionField(index, 'description', e.target.value)} /></td>
                                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(tx.debit || 0)} onChange={(e) => updateTransactionField(index, 'debit', e.target.value)} /></td>
                                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(tx.credit || 0)} onChange={(e) => updateTransactionField(index, 'credit', e.target.value)} /></td>
                                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(tx.balance || 0)} onChange={(e) => updateTransactionField(index, 'balance', e.target.value)} /></td>
                                                        <td className="px-3 py-2"><input type="number" step="0.01" className={inputClassName} value={Number(tx.confidence || 0)} onChange={(e) => updateTransactionField(index, 'confidence', e.target.value)} /></td>
                                                        <td className="px-3 py-2 text-center">
                                                            <button type="button" onClick={() => removeTransactionRow(index)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Remove transaction row">
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'bank-reconciliation' && hasBankTransactions && hasAnyInvoices && (
                    !isEditMode ? (
                        <ReconciliationTable
                            invoices={[...salesInvoices, ...purchaseInvoices]}
                            transactions={transactions}
                            currency={currency}
                            mode="auto-amount"
                        />
                    ) : (
                        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-border">
                                <h3 className="text-lg font-semibold text-foreground">Editable Bank Reconciliation</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-xs uppercase bg-muted/80 text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2">Transaction</th>
                                            <th className="px-3 py-2">Matched Invoice</th>
                                            <th className="px-3 py-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transactions.map((tx, txIndex) => {
                                            const edit = reconciliationEdits.find((row) => row.transactionIndex === txIndex) || { matchedInvoiceIndex: null, status: 'Unmatched' as const };
                                            return (
                                                <tr key={`recon-${txIndex}`} className="border-b border-border last:border-b-0">
                                                    <td className="px-3 py-2">
                                                        <div className="text-foreground font-medium">{formatInvoiceDateForUi(tx.date)}</div>
                                                        <div className="text-xs text-muted-foreground">{getTransactionDescriptionText(tx)}</div>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono">
                                                            <span className="inline-flex items-center rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-400">
                                                                Debit: {formatVatAmount(Number(tx.debit) || 0)}
                                                            </span>
                                                            <span className="inline-flex items-center rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-green-400">
                                                                Credit: {formatVatAmount(Number(tx.credit) || 0)}
                                                            </span>
                                                            <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-muted-foreground">
                                                                Balance: {formatVatAmount(Number(tx.balance) || 0)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <select
                                                            className={inputClassName}
                                                            value={edit.matchedInvoiceIndex ?? ''}
                                                            onChange={(e) => updateReconciliationEdit(txIndex, e.target.value)}
                                                        >
                                                            <option value="">No Matched Invoice</option>
                                                            {allInvoicesForEdit.map((invoice, invoiceIndex) => (
                                                                <option key={`inv-${invoiceIndex}`} value={invoiceIndex}>
                                                                    {invoice.invoiceId || 'N/A'} | {formatVatAmount(Number(invoice.totalAmountAED ?? invoice.totalAmount ?? 0))}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${edit.status === 'Matched' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'}`}>
                                                            {edit.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )
                )}

                {activeTab === 'others' && hasAnyInvoices && (
                    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Other Invoice Transactions</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Invoices with date outside the selected filing period or date marked as N/A.
                                </p>
                            </div>
                            <div className="text-sm font-medium text-muted-foreground">
                                Period: <span className="text-foreground">{formatInvoiceDateForUi(selectedPeriod?.start)} - {formatInvoiceDateForUi(selectedPeriod?.end)}</span>
                            </div>
                        </div>

                        {otherInvoices.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-muted-foreground">
                                    <thead className="text-xs uppercase bg-muted/80 text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Invoice Number</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Supplier/Vendor</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Party</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Supplier TRN</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer TRN</th>
                                            <th className="px-4 py-3 font-semibold whitespace-nowrap">Currency</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Before Tax Amount</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">VAT</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Net Amount</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Before Tax (AED)</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">VAT (AED)</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Zero Rated (AED)</th>
                                            <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Net Amount (AED)</th>
                                            <th className="px-4 py-3 font-semibold text-center whitespace-nowrap">Confidence</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {otherInvoices.map(({ id, invoice, sourceType, sourceIndex }) => (
                                            <tr key={id} className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-foreground">
                                                    {isEditMode ? (
                                                        <input className={inputClassName} value={invoice.invoiceDate || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'invoiceDate', e.target.value)} />
                                                    ) : formatInvoiceDateForUi(invoice.invoiceDate)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-foreground">
                                                    {isEditMode ? (
                                                        <input className={inputClassName} value={invoice.invoiceId || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'invoiceId', e.target.value)} />
                                                    ) : (invoice.invoiceId || 'N/A')}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${invoice.invoiceType === 'sales'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                                        }`}>
                                                        {getInvoiceCategoryLabel(invoice)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">{isEditMode ? <input className={inputClassName} value={invoice.vendorName || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'vendorName', e.target.value)} /> : (invoice.vendorName || 'N/A')}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{isEditMode ? <input className={inputClassName} value={invoice.customerName || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'customerName', e.target.value)} /> : (invoice.customerName || 'N/A')}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{isEditMode ? <input className={inputClassName} value={invoice.vendorTrn || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'vendorTrn', e.target.value)} /> : (invoice.vendorTrn || 'N/A')}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{isEditMode ? <input className={inputClassName} value={invoice.customerTrn || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'customerTrn', e.target.value)} /> : (invoice.customerTrn || 'N/A')}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{isEditMode ? <input className={inputClassName} value={invoice.currency || ''} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'currency', e.target.value)} /> : (invoice.currency || 'N/A')}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalBeforeTax || 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'totalBeforeTax', e.target.value)} /> : formatVatAmount(invoice.totalBeforeTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalTax || 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'totalTax', e.target.value)} /> : formatVatAmount(invoice.totalTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalAmount || 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'totalAmount', e.target.value)} /> : formatVatAmount(invoice.totalAmount)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalBeforeTaxAED ?? invoice.totalBeforeTax ?? 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'totalBeforeTaxAED', e.target.value)} /> : formatVatAmount(invoice.totalBeforeTaxAED ?? invoice.totalBeforeTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalTaxAED ?? invoice.totalTax ?? 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'totalTaxAED', e.target.value)} /> : formatVatAmount(invoice.totalTaxAED ?? invoice.totalTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.zeroRatedAED || 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'zeroRatedAED', e.target.value)} /> : formatVatAmount(invoice.zeroRatedAED)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary font-semibold">{isEditMode ? <input type="number" step="0.01" className={inputClassName} value={Number(invoice.totalAmountAED ?? invoice.totalAmount ?? 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'totalAmountAED', e.target.value)} /> : formatVatAmount(invoice.totalAmountAED ?? invoice.totalAmount)}</td>
                                                <td className="px-4 py-3 text-center font-mono font-semibold">
                                                    {isEditMode ? (
                                                        <input type="number" step="0.01" className={inputClassName} value={Number(invoice.confidence || 0)} onChange={(e) => updateInvoiceField(sourceType, sourceIndex, 'confidence', e.target.value)} />
                                                    ) : (
                                                        getInvoiceConfidenceForUi(invoice) !== null ? `${getInvoiceConfidenceForUi(invoice)}%` : 'N/A'
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                No invoices found outside the selected period, and no invoices with N/A date.
                            </div>
                        )}
                    </div>
                )}

                {isEditMode && activeTab === 'sales' && renderEditableInvoiceTable('sales', inPeriodSalesInvoicesWithReference)}
                {isEditMode && activeTab === 'purchase' && renderEditableInvoiceTable('purchase', inPeriodPurchaseInvoicesWithReference)}

                {isEditMode && activeTab === 'sales-total' && (
                    <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm text-muted-foreground mb-1">Standard Rated Supplies</label><input type="number" step="0.01" className={inputClassName} value={salesSummaryData.standardRatedSupplies} onChange={(e) => updateVatAdjustmentField('sales', 'standardRatedSupplies', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Output Tax</label><input type="number" step="0.01" className={inputClassName} value={salesSummaryData.outputTax} onChange={(e) => updateVatAdjustmentField('sales', 'outputTax', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Zero Rated Supplies</label><input type="number" step="0.01" className={inputClassName} value={salesSummaryData.zeroRatedSupplies} onChange={(e) => updateVatAdjustmentField('sales', 'zeroRatedSupplies', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Exempted Supplies</label><input type="number" step="0.01" className={inputClassName} value={salesSummaryData.exemptedSupplies} onChange={(e) => updateVatAdjustmentField('sales', 'exemptedSupplies', e.target.value)} /></div>
                    </div>
                )}

                {isEditMode && activeTab === 'purchase-total' && (
                    <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm text-muted-foreground mb-1">Standard Rated Expenses</label><input type="number" step="0.01" className={inputClassName} value={purchaseSummaryData.standardRatedExpenses} onChange={(e) => updateVatAdjustmentField('purchase', 'standardRatedExpenses', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Input Tax</label><input type="number" step="0.01" className={inputClassName} value={purchaseSummaryData.inputTax} onChange={(e) => updateVatAdjustmentField('purchase', 'inputTax', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Zero Rated Expenses</label><input type="number" step="0.01" className={inputClassName} value={purchaseSummaryData.zeroRatedExpenses} onChange={(e) => updateVatAdjustmentField('purchase', 'zeroRatedExpenses', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Exempted Expenses</label><input type="number" step="0.01" className={inputClassName} value={purchaseSummaryData.exemptedExpenses} onChange={(e) => updateVatAdjustmentField('purchase', 'exemptedExpenses', e.target.value)} /></div>
                    </div>
                )}

                {isEditMode && activeTab === 'vat-summary' && (
                    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                        <h3 className="text-lg font-semibold text-foreground">VAT Summary Adjustments</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-sm text-muted-foreground mb-1">Sales Standard Rated Supplies</label><input type="number" step="0.01" className={inputClassName} value={salesSummaryData.standardRatedSupplies} onChange={(e) => updateVatAdjustmentField('sales', 'standardRatedSupplies', e.target.value)} /></div>
                            <div><label className="block text-sm text-muted-foreground mb-1">Sales Output Tax</label><input type="number" step="0.01" className={inputClassName} value={salesSummaryData.outputTax} onChange={(e) => updateVatAdjustmentField('sales', 'outputTax', e.target.value)} /></div>
                            <div><label className="block text-sm text-muted-foreground mb-1">Purchase Standard Rated Expenses</label><input type="number" step="0.01" className={inputClassName} value={purchaseSummaryData.standardRatedExpenses} onChange={(e) => updateVatAdjustmentField('purchase', 'standardRatedExpenses', e.target.value)} /></div>
                            <div><label className="block text-sm text-muted-foreground mb-1">Purchase Input Tax</label><input type="number" step="0.01" className={inputClassName} value={purchaseSummaryData.inputTax} onChange={(e) => updateVatAdjustmentField('purchase', 'inputTax', e.target.value)} /></div>
                        </div>
                    </div>
                )}

                {isEditMode && activeTab === 'vat-return' && (
                    <div className="bg-card border border-border rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm text-muted-foreground mb-1">Due Tax</label><input type="number" step="0.01" className={inputClassName} value={vatNetData.dueTax} onChange={(e) => updateVatAdjustmentField('vatReturn', 'dueTax', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Recoverable Tax</label><input type="number" step="0.01" className={inputClassName} value={vatNetData.recoverableTax} onChange={(e) => updateVatAdjustmentField('vatReturn', 'recoverableTax', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Payable Tax</label><input type="number" step="0.01" className={inputClassName} value={vatNetData.payableTax} onChange={(e) => updateVatAdjustmentField('vatReturn', 'payableTax', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Fund Available FTA</label><input type="number" step="0.01" className={inputClassName} value={vatNetData.fundAvailableFta} onChange={(e) => updateVatAdjustmentField('vatReturn', 'fundAvailableFta', e.target.value)} /></div>
                        <div><label className="block text-sm text-muted-foreground mb-1">Net VAT Payable</label><input type="number" step="0.01" className={inputClassName} value={vatNetData.netVatPayable} onChange={(e) => updateVatAdjustmentField('vatReturn', 'netVatPayable', e.target.value)} /></div>
                    </div>
                )}

                {!isEditMode && invoiceResultsVisibleSectionsByTab[activeTab] && hasInvoicesInPeriod && renderInvoiceResultsTab(invoiceResultsVisibleSectionsByTab[activeTab] as InvoiceResultsSection[])}

                {!tabs.some(tab => tab.id === activeTab && tab.enabled) && (
                    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                        No data available for this tab.
                    </div>
                )}
            </div>
        );
    }

    if (viewMode === 'dashboard') return <VatFilingDashboard company={selectedCompany} onNewFiling={handleStartFiling} onContinueFiling={handleStartFiling} onShowConversions={(periodIdValue) => {
        navigate(`/projects/vat-filing/${selectedCompany.id}/periods/${periodIdValue}/conversions`);
    }} onBack={() => {
        setSelectedCompany(null);
        setCompanyName('');
        setCompanyTrn('');
        navigate('/projects/vat-filing');
    }} />;

    return (
        <div className="space-y-6">
            <button onClick={() => { setViewMode('dashboard'); setSelectedPeriod(null); navigate(`/projects/vat-filing/${selectedCompany.id}`); }} className="text-muted-foreground hover:text-foreground flex items-center text-sm font-medium transition-colors"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
            <VatFilingUpload
                invoiceFiles={vatInvoiceFiles} onInvoiceFilesSelect={setVatInvoiceFiles}
                statementFiles={vatStatementFiles} onStatementFilesSelect={setVatStatementFiles}
                statementAllowMultiple={false}
                pdfPassword={pdfPassword} onPasswordChange={setPdfPassword}
                companyName={selectedCompany.name} onCompanyNameChange={setCompanyName}
                companyTrn={selectedCompany.trn} onCompanyTrnChange={setCompanyTrn}
                onProcess={processFiles}
            />
        </div>
    );
};

