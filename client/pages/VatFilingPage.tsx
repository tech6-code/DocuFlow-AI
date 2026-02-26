import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import {
    extractTransactionsFromImage,
    extractTransactionsFromText,
    extractInvoicesData,
    filterTransactionsByDate,
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
import { VatFilingUpload } from '../components/VatFilingUpload';
import { CtCompanyList } from '../components/CtCompanyList';
import { TransactionTable } from '../components/TransactionTable';
import { ReconciliationTable } from '../components/ReconciliationTable';
import { InvoiceResults, type InvoiceResultsSection } from '../components/InvoiceResults';
import { ChevronLeftIcon, DocumentArrowDownIcon } from '../components/icons';
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
    const { customerId: routeCustomerId, vatFilingPeriodId } = useParams<{ customerId?: string; vatFilingPeriodId?: string }>();
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
        if (!routeCustomerId || !vatFilingPeriodId) {
            if (!vatFilingPeriodId && appState === 'initial' && viewMode === 'upload') {
                setViewMode('dashboard');
                setSelectedPeriod(null);
            }
            return;
        }

        if (!selectedCompany || String(selectedCompany.id) !== String(routeCustomerId)) return;

        let mounted = true;
        vatFilingService.getFilingPeriodById(vatFilingPeriodId)
            .then((period) => {
                if (!mounted || !period) return;
                if (String(period.customerId) !== String(routeCustomerId)) return;
                setSelectedPeriod({ start: period.periodFrom, end: period.periodTo });
                setViewMode('upload');
            })
            .catch((err) => {
                console.error('Failed to load VAT filing period from route:', err);
            });

        return () => { mounted = false; };
    }, [routeCustomerId, vatFilingPeriodId, selectedCompany, appState, viewMode]);

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
        setAppState('initial'); setError(null); setTransactions([]); setSalesInvoices([]); setPurchaseInvoices([]); setSummary(null); setFileSummaries({}); setVatInvoiceFiles([]); setVatStatementFiles([]); setSelectedPeriod(null); setViewMode('dashboard'); setStatementPreviewUrls([]); setInvoicePreviewUrls([]); setResultsTab('bank-statement');
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
                                    extractedText,
                                    selectedPeriod?.start,
                                    selectedPeriod?.end
                                );
                            }
                        } catch (textError) {
                            console.warn(`[VAT Filing] Text extraction failed for ${file.name}, falling back to image extraction`, textError);
                        }
                    }

                    if (!statementResult) {
                        const parts = await convertFileToParts(file);
                        statementResult = await extractTransactionsFromImage(
                            parts,
                            selectedPeriod?.start,
                            selectedPeriod?.end
                        );
                    }

                    allRaw.push(...statementResult.transactions.map(t => ({ ...t, sourceFile: file.name })));
                    localFileSummaries[file.name] = statementResult.summary;

                    if (!localSummary) localSummary = statementResult.summary;
                    localCurrency = statementResult.currency || localCurrency;
                }

                localTransactions = deduplicateTransactions(filterTransactionsByDate(allRaw, selectedPeriod?.start, selectedPeriod?.end));
            }

            if (vatInvoiceFiles.length > 0) {
                const mergedInvoices: Invoice[] = [];
                for (const file of vatInvoiceFiles) {
                    const fileParts: Part[] = await convertFileToParts(file);
                    const res = await extractInvoicesData(fileParts, knowledgeBase, companyName, companyTrn) as { invoices: Invoice[] };
                    mergedInvoices.push(...res.invoices.map(classifyInvoice));
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
        setViewMode('upload');
        if (selectedCompany?.id && periodId) {
            navigate(`/projects/vat-filing/${selectedCompany.id}/vatfiling-period/${periodId}`);
        }
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

    if (appState === 'success') {
        const hasBankTransactions = transactions.length > 0;
        const hasBankStatementData = hasBankTransactions || !!summary || Object.keys(fileSummaries).length > 0;
        const hasInvoices = salesInvoices.length > 0 || purchaseInvoices.length > 0;
        const hasSales = salesInvoices.length > 0;
        const hasPurchases = purchaseInvoices.length > 0;
        const allInvoices = [...salesInvoices, ...purchaseInvoices];
        const periodFromKey = toDateKey(selectedPeriod?.start);
        const periodToKey = toDateKey(selectedPeriod?.end);
        const otherInvoices = allInvoices
            .map((invoice, index) => {
                const invoiceDateKey = toDateKey(invoice.invoiceDate);
                const missingDate = invoiceDateKey === null;
                const outOfRange = !missingDate && periodFromKey !== null && periodToKey !== null
                    ? (invoiceDateKey < periodFromKey || invoiceDateKey > periodToKey)
                    : false;

                if (!missingDate && !outOfRange) return null;

                return {
                    id: `${invoice.invoiceId || 'no-id'}-${index}`,
                    invoice,
                };
            })
            .filter(Boolean) as Array<{ id: string; invoice: Invoice }>;
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
            { id: 'bank-reconciliation' as const, label: 'Bank Reconciliation', enabled: hasBankTransactions && hasInvoices },
            { id: 'sales' as const, label: 'Sales', enabled: hasSales },
            { id: 'purchase' as const, label: 'Purchase', enabled: hasPurchases },
            { id: 'others' as const, label: 'Others', enabled: hasInvoices },
            { id: 'sales-total' as const, label: 'Sales Total', enabled: hasSales },
            { id: 'purchase-total' as const, label: 'Purchase Total', enabled: hasPurchases },
            { id: 'vat-summary' as const, label: 'VAT Summary', enabled: hasInvoices },
            { id: 'vat-return' as const, label: 'VAT Return', enabled: hasInvoices },
        ];

        const activeTabIsEnabled = tabs.some(tab => tab.id === resultsTab && tab.enabled);
        const fallbackTab = tabs.find(tab => tab.enabled)?.id ?? 'bank-statement';
        const activeTab = activeTabIsEnabled ? resultsTab : fallbackTab;

        const salesSummaryData = {
            standardRatedSupplies: salesInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0),
            outputTax: salesInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0),
            zeroRatedSupplies: salesInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0),
            exemptedSupplies: 0,
        };
        const purchaseSummaryData = {
            standardRatedExpenses: purchaseInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0),
            inputTax: purchaseInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0),
            zeroRatedExpenses: purchaseInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0),
            exemptedExpenses: 0,
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
            dueTax: vatReturnData.sales.totalVat,
            recoverableTax: vatReturnData.expenses.totalVat,
            payableTax: vatReturnData.sales.totalVat,
            netVatPayable: vatReturnData.sales.totalVat - vatReturnData.expenses.totalVat,
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
                buildAutoReconciliationExportRows(transactions, allInvoices),
                'No bank reconciliation data',
                [14, 60, 14, 14, 16, 18, 14, 24]
            );

            const invoiceSheetWidths = [14, 12, 18, 35, 35, 20, 20, 12, 18, 12, 14, 16, 18, 14, 18, 18, 12];
            appendJsonSheet('UAE - Invoices', buildInvoiceExportRows(allInvoices), 'No invoice transactions', invoiceSheetWidths);
            appendJsonSheet('UAE - Sales', buildInvoiceExportRows(salesInvoices), 'No sales invoice transactions', invoiceSheetWidths);
            appendJsonSheet('UAE - Purchase', buildInvoiceExportRows(purchaseInvoices), 'No purchase invoice transactions', invoiceSheetWidths);
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

        const renderInvoiceResultsTab = (sections: InvoiceResultsSection[]) => (
            <InvoiceResults
                invoices={[...salesInvoices, ...purchaseInvoices]}
                previewUrls={invoicePreviewUrls}
                knowledgeBase={knowledgeBase}
                onAddToKnowledgeBase={() => { }}
                onUpdateInvoice={() => { }}
                onReset={() => { }}
                visibleSections={sections}
                showExportButton={false}
            />
        );

        return (
            <div className="space-y-8">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                        <button onClick={() => { handleReset(); navigate(`/projects/vat-filing/${selectedCompany.id}`); }} className="text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Dashboard</button>
                        <h2 className="text-xl font-bold text-foreground">VAT Filing Results - {selectedCompany.name}</h2>
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
                        <div className="flex justify-end">
                            {commonDownloadExcelButton}
                        </div>
                    )}
                </div>

                {activeTab === 'bank-statement' && hasBankStatementData && (
                    <div className="space-y-4">
                        {!hasBankTransactions && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                                Bank statement was extracted, but no transactions fall within the selected VAT filing period
                                {selectedPeriod ? ` (${formatInvoiceDateForUi(selectedPeriod.start)} - ${formatInvoiceDateForUi(selectedPeriod.end)})` : ''}.
                                This usually means the uploaded statement dates do not match the selected filing period.
                            </div>
                        )}
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
                            extraActionsBeforeExport={commonDownloadExcelButton}
                            hideExportXlsxAction={true}
                        />
                    </div>
                )}

                {activeTab === 'bank-reconciliation' && hasBankTransactions && hasInvoices && (
                    <ReconciliationTable
                        invoices={[...salesInvoices, ...purchaseInvoices]}
                        transactions={transactions}
                        currency={currency}
                        mode="auto-amount"
                    />
                )}

                {activeTab === 'others' && hasInvoices && (
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
                                        {otherInvoices.map(({ id, invoice }) => (
                                            <tr key={id} className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-foreground">{formatInvoiceDateForUi(invoice.invoiceDate)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-foreground">{invoice.invoiceId || 'N/A'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border ${invoice.invoiceType === 'sales'
                                                        ? 'bg-primary/10 text-primary border-primary/20'
                                                        : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                                        }`}>
                                                        {getInvoiceCategoryLabel(invoice)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">{invoice.vendorName || 'N/A'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{invoice.customerName || 'N/A'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{invoice.vendorTrn || 'N/A'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{invoice.customerTrn || 'N/A'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{invoice.currency || 'N/A'}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatVatAmount(invoice.totalBeforeTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatVatAmount(invoice.totalTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatVatAmount(invoice.totalAmount)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatVatAmount(invoice.totalBeforeTaxAED ?? invoice.totalBeforeTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatVatAmount(invoice.totalTaxAED ?? invoice.totalTax)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatVatAmount(invoice.zeroRatedAED)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary font-semibold">{formatVatAmount(invoice.totalAmountAED ?? invoice.totalAmount)}</td>
                                                <td className="px-4 py-3 text-center font-mono font-semibold">
                                                    {getInvoiceConfidenceForUi(invoice) !== null ? `${getInvoiceConfidenceForUi(invoice)}%` : 'N/A'}
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

                {invoiceResultsVisibleSectionsByTab[activeTab] && hasInvoices && renderInvoiceResultsTab(invoiceResultsVisibleSectionsByTab[activeTab] as InvoiceResultsSection[])}

                {!tabs.some(tab => tab.id === activeTab && tab.enabled) && (
                    <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
                        No data available for this tab.
                    </div>
                )}
            </div>
        );
    }

    if (viewMode === 'dashboard') return <VatFilingDashboard company={selectedCompany} onNewFiling={handleStartFiling} onContinueFiling={handleStartFiling} onBack={() => {
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

