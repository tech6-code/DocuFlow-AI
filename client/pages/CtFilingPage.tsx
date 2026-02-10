import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { SimpleLoading } from '../components/SimpleLoading';
import { ctFilingService } from '../services/ctFilingService';
import {
    extractTransactionsFromImage,
    extractTransactionsFromText,
    extractInvoicesData,
    extractProjectDocuments,
    filterTransactionsByDate,
    deduplicateTransactions,
    generateAuditReport as generateAuditReportService
} from '../services/geminiService';
import {
    Transaction,
    BankStatementSummary,
    Invoice,
    ExtractedDataObject,
    DocumentHistoryItem,
    TrialBalanceEntry,
    FinancialStatements,
    Company
} from '../types';
import { extractTextFromPDF, generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';

declare const XLSX: any;

// UI Components
import { CtFilingTypeSelection } from '../components/CtFilingTypeSelection';
import { CtFilingDashboard } from '../components/CtFilingDashboard';
import { CtType1Results } from '../components/CtType1Results';
import { CtType2Results } from '../components/CtType2Results';
import { CtType3Results } from '../components/CtType3Results';
import { CtType4Results } from '../components/CtType4Results';
import { CtCompanyList } from '../components/CtCompanyList';
import { ChevronLeftIcon, BanknotesIcon } from '../components/icons';
import { VatFilingUpload } from '../components/VatFilingUpload';

export const CtFilingPage: React.FC = () => {
    const { currentUser } = useAuth();
    const {
        projectCompanies,
        knowledgeBase,
        addHistoryItem,
        salesSettings,
    } = useData();
    const { customerId, typeName, periodId } = useParams<{ customerId: string, typeName: string, periodId: string }>();
    const navigate = useNavigate();
    const location = window.location.pathname;

    // Parse typeId and stage from URL path
    const pathParts = location.split('/');
    const typeId = typeName || null;
    const stage = pathParts[pathParts.length - 1]; // 'upload' or other
    const ctFilingType = typeId ? parseInt(typeId.replace('type', '')) : null;

    // State from ProjectPageWrapper
    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error' | 'confirm_balances'>('initial');
    const [showOpeningBalancePopUp, setShowOpeningBalancePopUp] = useState(false);
    const [tempAccountBalances, setTempAccountBalances] = useState<Record<string, { currency: string, opening: number, rate: number }>>({});
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [vatInvoiceFiles, setVatInvoiceFiles] = useState<File[]>([]);
    const [vatStatementFiles, setVatStatementFiles] = useState<File[]>([]);
    const [excelStatementFiles, setExcelStatementFiles] = useState<File[]>([]); // New state for Excel files
    const [pdfPassword, setPdfPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyTrn, setCompanyTrn] = useState('');
    const [selectedPeriod, setSelectedPeriod] = useState<{ start: string, end: string } | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<Invoice[]>([]);
    const [summary, setSummary] = useState<BankStatementSummary | null>(null);
    const [currency, setCurrency] = useState('AED');
    const [extractedData, setExtractedData] = useState<ExtractedDataObject[]>([]);
    const [fileSummaries, setFileSummaries] = useState<Record<string, BankStatementSummary>>({});
    const [trialBalance, setTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [auditReport, setAuditReport] = useState<FinancialStatements | null>(null);
    const [isGeneratingTrialBalance, setIsGeneratingTrialBalance] = useState(false);
    const [isGeneratingAuditReport, setIsGeneratingAuditReport] = useState(false);
    const [reportsError, setReportsError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    // View state from ProjectPage
    const [viewMode, setViewMode] = useState<'dashboard' | 'upload'>('dashboard');
    const [statementPreviewUrls, setStatementPreviewUrls] = useState<string[]>([]);
    const [invoicePreviewUrls, setInvoicePreviewUrls] = useState<string[]>([]);

    // Sync state with URL params
    useEffect(() => {
        if (customerId) {
            const company = projectCompanies.find(c => c.id === customerId);
            if (company) {
                setSelectedCompany(company);
                setCompanyName(company.name);
                setCompanyTrn(company.corporateTaxTrn || company.trn || '');
            }
        } else {
            setSelectedCompany(null);
            setSelectedPeriod(null);
            setAppState('initial');
        }

        if (typeId && periodId && stage === 'upload') {
            const fetchPeriod = async () => {
                const period = await ctFilingService.getFilingPeriodById(periodId);
                if (period) {
                    setSelectedPeriod({
                        start: period.periodFrom,
                        end: period.periodTo
                    });
                } else {
                    // No period found, redirect back to list
                    navigate(`/projects/ct-filing/${customerId}/${typeId}/filing-periods`);
                }
            };
            fetchPeriod();
        } else {
            setSelectedPeriod(null);
        }
    }, [customerId, typeId, periodId, stage, projectCompanies, navigate]);

    useEffect(() => {
        if (appState === 'success') {
            if (vatStatementFiles.length > 0) {
                generatePreviewUrls(vatStatementFiles).then(setStatementPreviewUrls);
            }
            if (vatInvoiceFiles.length > 0) {
                generatePreviewUrls(vatInvoiceFiles).then(setInvoicePreviewUrls);
            }
        }
    }, [appState, vatStatementFiles, vatInvoiceFiles]);

    const handleReset = useCallback(() => {
        setAppState('initial');
        setError(null);
        setTransactions([]);
        setSalesInvoices([]);
        setPurchaseInvoices([]);
        setExtractedData([]);
        setSummary(null);
        setFileSummaries({});
        setTrialBalance(null);
        auditReport && setAuditReport(null);
        setVatInvoiceFiles([]);
        setVatStatementFiles([]);
        setExcelStatementFiles([]);
        // Keep type and period in URL/localStorage unless user explicitly wants to go back
        setStatementPreviewUrls([]);
        setInvoicePreviewUrls([]);
    }, [auditReport]);

    const handleFullReset = useCallback(() => {
        handleReset();
        if (typeId) {
            navigate(`/projects/ct-filing/${customerId}/${typeId}/filing-periods`);
        }
    }, [handleReset, customerId, typeId, navigate]);

    // Helper for strict date filtering and summary recalculation
    const filterAndSummarize = (
        txs: Transaction[],
        period: { start: string, end: string } | null,
        fileSums: Record<string, BankStatementSummary>
    ): { transactions: Transaction[], summary: BankStatementSummary | null } => {
        if (!period) return { transactions: txs, summary: null };

        // 1. Parse Period Dates
        const pStart = period.start ? new Date(period.start) : null;
        const pEnd = period.end ? new Date(period.end) : null;

        if (!pStart || !pEnd || isNaN(pStart.getTime()) || isNaN(pEnd.getTime())) {
            return { transactions: txs, summary: null };
        }

        // 2. Sort Transactions by Date
        const sortedTxs = [...txs].sort((a, b) => {
            const da = new Date(a.date).getTime();
            const db = new Date(b.date).getTime();
            return (isNaN(da) ? 0 : da) - (isNaN(db) ? 0 : db);
        });

        // 3. Determine Baseline Opening Balance
        // Sum opening balances from ALL files to start the running balance
        let runningBalance = Object.values(fileSums).reduce((sum, f) => sum + (f.openingBalance || 0), 0);
        let balanceCurrency = 'AED';

        // 4. Iterate and Filter
        const filtered: Transaction[] = [];
        let periodDeposits = 0;
        let periodWithdrawals = 0;

        sortedTxs.forEach(t => {
            const tDate = new Date(t.date);
            const isValidDate = !isNaN(tDate.getTime());

            const credit = Number(t.credit) || 0;
            const debit = Number(t.debit) || 0;

            if (isValidDate && tDate < pStart) {
                // Before period: adjust running balance
                runningBalance = runningBalance + credit - debit;
            } else if (isValidDate && tDate >= pStart && tDate <= pEnd) {
                // In period: include and track totals
                filtered.push(t);
                periodDeposits += credit;
                periodWithdrawals += debit;
                // Update running balance to track through the period
                runningBalance = runningBalance + credit - debit;
            }
            // After period: ignore
        });

        // 5. Construct New Summary
        // The runningBalance at this point is effectively the Closing Balance of the period
        const newSummary: BankStatementSummary = {
            accountHolder: Object.values(fileSums)[0]?.accountHolder || 'Combined',
            accountNumber: Object.values(fileSums)[0]?.accountNumber || 'Multiple',
            statementPeriod: `${period.start} to ${period.end}`,
            openingBalance: runningBalance - periodDeposits + periodWithdrawals, // Recalculate OB from CB
            closingBalance: runningBalance,
            totalDeposits: periodDeposits,
            totalWithdrawals: periodWithdrawals,
            // Add custom fields if needed or mapped
        };

        return { transactions: filtered, summary: newSummary };
    };

    const processFiles = useCallback(async (mode: 'invoices' | 'all' = 'all') => {
        const invoicesOnly = mode === 'invoices';
        if (!invoicesOnly) {
            setAppState('loading');
            setProgress(10);
            setProgressMessage('Preparing documents...');
        } else {
            setProgress(30);
            setProgressMessage('Processing invoices...');
        }

        try {
            let localTransactions: Transaction[] = [];
            let localSummary: BankStatementSummary | null = null;
            let localCurrency: string = 'AED';
            let localSalesInvoices: Invoice[] = [];
            let localPurchaseInvoices: Invoice[] = [];
            let localExtractedData: ExtractedDataObject[] = [];
            let localFileSummaries: Record<string, BankStatementSummary> = {};

            // Helper to parse Excel files
            const parseExcelFiles = async (files: File[]): Promise<Transaction[]> => {
                let excelTransactions: Transaction[] = [];

                const findValue = (row: any, keys: string[]): any => {
                    const rowKeys = Object.keys(row);
                    for (const key of keys) {
                        const match = rowKeys.find(k => k.toLowerCase().trim() === key.toLowerCase());
                        if (match) return row[match];
                    }
                    return undefined;
                };

                const parseDateSequence = (val: any): string => {
                    if (!val) return '';
                    if (val instanceof Date) return val.toISOString();
                    if (typeof val === 'number') {
                        // Excel serial date
                        return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString();
                    }
                    if (typeof val === 'string') {
                        const cleanVal = val.trim();
                        // Try DD/MM/YYYY or DD-MM-YY
                        const dmy = cleanVal.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
                        if (dmy) {
                            let year = parseInt(dmy[3]);
                            if (year < 100) year += 2000; // Assume 20xx
                            const d = new Date(year, parseInt(dmy[2]) - 1, parseInt(dmy[1]));
                            if (!isNaN(d.getTime())) return d.toISOString();
                        }
                        // Try YYYY-MM-DD
                        const ymd = cleanVal.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
                        if (ymd) {
                            const d = new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
                            if (!isNaN(d.getTime())) return d.toISOString();
                        }
                        // Fallback to standard parse
                        const parsed = Date.parse(cleanVal);
                        if (!isNaN(parsed)) return new Date(parsed).toISOString();
                    }
                    return '';
                };



                for (const file of files) {
                    console.log(`[CT Filing] Processing Excel file: ${file.name}`);
                    try {
                        await new Promise<void>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                try {
                                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                                    // cellDates: true forces date cells to be parsed as JS Date objects
                                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                                    // defval: '' guarantees no undefined for empty cells if needed, but we check raw
                                    const rows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

                                    console.log(`[CT Filing] Raw rows in ${file.name}:`, rows.length);

                                    const extracted = rows.map((row: any, idx: number) => {
                                        // Fuzzy match columns
                                        let dateVal = findValue(row, ['date', 'transaction date', 'txn date', 'posting date', 'value date']);
                                        const descVal = findValue(row, ['description', 'details', 'narration', 'transaction details', 'particulars']) || '';
                                        const debitVal = findValue(row, ['debit', 'dr', 'withdrawal', 'out', 'debit amount']) || 0;
                                        const creditVal = findValue(row, ['credit', 'cr', 'deposit', 'in', 'credit amount']) || 0;
                                        const amountVal = findValue(row, ['amount', 'net amount', 'transaction amount', 'total']); // New: Handle single amount column
                                        const balanceVal = findValue(row, ['balance', 'bal', 'running balance']) || 0;
                                        const categoryVal = findValue(row, ['category', 'account', 'classification']) || '';
                                        const currencyVal = findValue(row, ['currency', 'curr']) || 'AED';

                                        const validDate = parseDateSequence(dateVal);

                                        // Ensure numbers
                                        const cleanNumber = (val: any) => {
                                            if (typeof val === 'number') return val;
                                            if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
                                            return 0;
                                        };

                                        let finalDebit = cleanNumber(debitVal);
                                        let finalCredit = cleanNumber(creditVal);

                                        // Logic for single Amount column
                                        if (finalDebit === 0 && finalCredit === 0 && amountVal !== undefined) {
                                            const amt = cleanNumber(amountVal);
                                            if (amt < 0) {
                                                finalDebit = Math.abs(amt);
                                            } else {
                                                finalCredit = amt;
                                            }
                                        }

                                        return {
                                            date: validDate,
                                            description: String(descVal).trim().replace(/\s+/g, ' '),
                                            debit: finalDebit,
                                            credit: finalCredit,
                                            category: String(categoryVal).replace(/^\d+\s+/, ''),
                                            balance: cleanNumber(balanceVal),
                                            currency: String(currencyVal),
                                            confidence: 100,
                                            sourceFile: file.name,
                                            originalIndex: idx
                                        };
                                    }).filter(t => t.date !== '' && (t.debit !== 0 || t.credit !== 0)); // Filter out empty or invalid rows

                                    console.log(`[CT Filing] Extracted ${extracted.length} rows from ${file.name}`);

                                    // Calculate per-file summary for Excel
                                    localFileSummaries[file.name] = {
                                        openingBalance: 0,
                                        closingBalance: 0,
                                        totalDeposits: extracted.reduce((s, t) => s + (t.credit || 0), 0),
                                        totalWithdrawals: extracted.reduce((s, t) => s + (t.debit || 0), 0),
                                        accountHolder: 'Excel Upload',
                                        accountNumber: '',
                                        statementPeriod: ''
                                    };

                                    excelTransactions = [...excelTransactions, ...extracted];
                                    resolve();
                                } catch (err) { reject(err); }
                            };
                            reader.onerror = reject;
                            reader.readAsArrayBuffer(file);
                        });
                    } catch (err) {
                        console.error("Error parsing Excel:", err);
                    }
                }
                return excelTransactions;
            };

            const normalizeInvoiceType = (invoice: Invoice): Invoice => {
                const rawType = (invoice as Invoice & { invoiceType?: string }).invoiceType;
                if (rawType === 'sales' || rawType === 'purchase') {
                    return { ...invoice, invoiceType: rawType };
                }
                return { ...invoice, invoiceType: 'purchase' };
            };

            if (ctFilingType === 1) {
                if (vatStatementFiles.length > 0 || excelStatementFiles.length > 0) {
                    console.log(`[CT Filing] Received ${vatStatementFiles.length} PDF/Image and ${excelStatementFiles.length} Excel files.`);
                    setProgressMessage('Processing Bank Statements...');
                    let allRawTransactions: Transaction[] = [];
                    let firstSummary: BankStatementSummary | null = null;
                    let processedCurrency = 'AED';

                    // 1. Process Excel Files
                    if (excelStatementFiles.length > 0) {
                        setProgressMessage('Parsing Excel Statements...');
                        const excelTxs = await parseExcelFiles(excelStatementFiles);
                        allRawTransactions = [...allRawTransactions, ...excelTxs];
                        if (excelTxs.length > 0 && !firstSummary) {
                            processedCurrency = excelTxs[0]?.currency || 'AED';
                            firstSummary = localFileSummaries[excelStatementFiles[0].name] || null;
                        }
                    }

                    // 2. Process PDF/Image Files
                    for (const file of vatStatementFiles) {
                        // ... (existing PDF extraction logic) ... 
                        // Re-using existing logic but moved inside loop for clarity if needed, 
                        // or just append to allRawTransactions
                        console.log(`[CT Filing] Starting text-based extraction for file: ${file.name}`);
                        setProgressMessage(`Extracting text from ${file.name}...`);

                        let result;
                        if (file.type === 'application/pdf') {
                            const text = await extractTextFromPDF(file);
                            result = await extractTransactionsFromText(text, selectedPeriod?.start, selectedPeriod?.end);
                        } else {
                            const parts = await convertFileToParts(file);
                            result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                        }

                        const taggedTransactions = result.transactions.map(t => ({ ...t, sourceFile: file.name }));
                        allRawTransactions = [...allRawTransactions, ...taggedTransactions];

                        if (!firstSummary) {
                            firstSummary = result.summary;
                            processedCurrency = result.currency;
                        }
                        localFileSummaries[file.name] = result.summary;
                    }

                    // Strict filtering and verification
                    const filteredResult = filterAndSummarize(deduplicateTransactions(allRawTransactions), selectedPeriod, localFileSummaries);
                    localTransactions = filteredResult.transactions;
                    localSummary = filteredResult.summary || firstSummary;
                    localCurrency = processedCurrency;

                    console.log(`[CT Filing] Final transactions count: ${localTransactions.length}`);
                    setProgress(100);
                }
            }
            else if (ctFilingType === 2) {
                if (!invoicesOnly && (vatStatementFiles.length > 0 || excelStatementFiles.length > 0)) {
                    let allRawTransactions: Transaction[] = [];

                    // 1. Process Excel Files (New dedicated upload)
                    if (excelStatementFiles.length > 0) {
                        setProgressMessage('Parsing Excel Statements...');
                        const excelTxs = await parseExcelFiles(excelStatementFiles);
                        allRawTransactions = [...allRawTransactions, ...excelTxs];
                        if (!localSummary) { // Basic summary if not exists
                            localSummary = {
                                openingBalance: 0, closingBalance: 0,
                                totalDeposits: excelTxs.reduce((s, t) => s + (Number(t.credit) || 0), 0),
                                totalWithdrawals: excelTxs.reduce((s, t) => s + (Number(t.debit) || 0), 0),
                                accountHolder: 'Excel Upload', accountNumber: '', statementPeriod: ''
                            };
                        }
                    }

                    // 2. Process "Bank Statements" box (Existing logic: handles both PDF/Image AND mixed Excel if user dropped here)
                    for (const file of vatStatementFiles) {
                        if (file.name.match(/\.xlsx?$/i)) {
                            // ... (Existing Excel logic - can be replaced by calling parseExcelFiles([file])) ...
                            const excelTxs = await parseExcelFiles([file]);
                            allRawTransactions = [...allRawTransactions, ...excelTxs];
                            if (!firstSummary) firstSummary = localFileSummaries[file.name];
                        } else if (file.type === 'application/pdf') {
                            // ... (Existing PDF logic) ...
                            const text = await extractTextFromPDF(file);
                            const result = await extractTransactionsFromText(text, selectedPeriod?.start, selectedPeriod?.end);
                            const taggedTransactions = result.transactions.map(t => ({ ...t, sourceFile: file.name }));
                            allRawTransactions = [...allRawTransactions, ...taggedTransactions];
                            if (!localSummary) localSummary = result.summary;
                            localFileSummaries[file.name] = result.summary;
                            localCurrency = result.currency;
                        } else {
                            // ... (Existing Image logic) ...
                            const parts = await convertFileToParts(file);
                            const result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                            allRawTransactions = [...allRawTransactions, ...result.transactions.map(t => ({ ...t, sourceFile: file.name }))];
                            if (!localSummary) localSummary = result.summary;
                            localFileSummaries[file.name] = result.summary;
                            localCurrency = result.currency;
                        }
                    }

                    // Strict filtering
                    const filteredResult = filterAndSummarize(deduplicateTransactions(allRawTransactions), selectedPeriod, localFileSummaries);
                    localTransactions = filteredResult.transactions;
                    if (filteredResult.summary) localSummary = filteredResult.summary;

                    console.log(`[CT Filing Type 2] Final transactions count: ${localTransactions.length}`);
                }
                if (vatInvoiceFiles.length > 0) {
                    setProgressMessage('Processing Invoices...');
                    const allInvoices: Invoice[] = [];
                    let fileIndex = 0;
                    for (const file of vatInvoiceFiles) {
                        fileIndex += 1;
                        setProgressMessage(`Processing invoice ${fileIndex}/${vatInvoiceFiles.length}...`);
                        const parts = await convertFileToParts(file);
                        const invResult = await extractInvoicesData(parts, knowledgeBase, companyName, companyTrn);
                        if (invResult?.invoices?.length) {
                            allInvoices.push(...invResult.invoices.map(normalizeInvoiceType));
                        }
                    }
                    localSalesInvoices = allInvoices.filter(i => i.invoiceType === 'sales');
                    localPurchaseInvoices = allInvoices.filter(i => i.invoiceType === 'purchase');
                    if (vatStatementFiles.length === 0) localCurrency = allInvoices[0]?.currency || 'AED';
                }
                setProgress(100);
            }

            if (!invoicesOnly) {
                console.log(`[CT Filing] Setting transactions to state: ${localTransactions.length}`);
                console.log(`[CT Filing] Final Summary - Opening: ${localSummary?.openingBalance}, Closing: ${localSummary?.closingBalance}`);
                setTransactions(localTransactions);
                setSummary(localSummary);
                setCurrency(localCurrency);
                setSalesInvoices(localSalesInvoices);
                setPurchaseInvoices(localPurchaseInvoices);
                setExtractedData(localExtractedData);
                setFileSummaries(localFileSummaries);

                // If we have statement files, prompt for opening balance and currency
                const allStatementFiles = [...vatStatementFiles, ...excelStatementFiles];
                if (allStatementFiles.length > 0) {
                    const tempBalances: Record<string, { currency: string, opening: number, rate: number }> = {};
                    Object.entries(localFileSummaries).forEach(([fileName, summary]) => {
                        tempBalances[fileName] = {
                            currency: (summary as any).currency || localCurrency,
                            opening: summary.openingBalance || 0,
                            rate: 1.0
                        };
                    });
                    setTempAccountBalances(tempBalances);
                    setAppState('confirm_balances');
                    setShowOpeningBalancePopUp(true);
                } else {
                    setAppState('success');
                }

                addHistoryItem({
                    id: Date.now().toString(),
                    type: 'Corporate Tax Filing',
                    title: `CT Filing - ${selectedCompany?.name}`,
                    processedAt: new Date().toISOString(),
                    pageCount: vatStatementFiles.length + vatInvoiceFiles.length,
                    processedBy: currentUser?.name || 'User',
                    customerId: selectedCompany?.id,
                    serviceId: salesSettings.servicesRequired.find(s => s.name === 'CT Filing')?.id,
                    transactions: localTransactions,
                    summary: localSummary || undefined,
                    currency: localCurrency,
                    salesInvoices: localSalesInvoices,
                    purchaseInvoices: localPurchaseInvoices,
                    extractedData: localExtractedData
                });
            } else {
                setSalesInvoices(localSalesInvoices);
                setPurchaseInvoices(localPurchaseInvoices);
                if (localCurrency) setCurrency(localCurrency);
            }

        } catch (e: any) {
            if (!invoicesOnly) {
                setError(e.message);
                setAppState('error');
            } else {
                console.error("Invoice processing error:", e);
                throw e;
            }
        }
    }, [ctFilingType, vatStatementFiles, excelStatementFiles, vatInvoiceFiles, selectedPeriod, knowledgeBase, companyName, companyTrn, selectedCompany, currentUser, addHistoryItem]);

    const handleGenerateTrialBalance = useCallback((txs: Transaction[]) => {
        setIsGeneratingTrialBalance(true);
        setTimeout(() => {
            const balances: Record<string, { debit: number, credit: number }> = {};
            let bankDebit = 0; let bankCredit = 0;
            txs.forEach(t => {
                const accountName = (t.category || 'Uncategorized').split('|').pop()?.trim() || 'Uncategorized';
                if (!balances[accountName]) balances[accountName] = { debit: 0, credit: 0 };
                if (t.debit > 0) { balances[accountName].debit += t.debit; bankCredit += t.debit; }
                if (t.credit > 0) { balances[accountName].credit += t.credit; bankDebit += t.credit; }
            });
            const tbEntries: TrialBalanceEntry[] = Object.entries(balances).map(([account, { debit, credit }]) => ({ account, debit, credit, currency: 'AED' }));
            tbEntries.push({ account: 'Bank Account', debit: bankDebit, credit: bankCredit, currency: 'AED' });
            setTrialBalance(tbEntries);
            setIsGeneratingTrialBalance(false);
        }, 1000);
    }, []);

    const handleGenerateAuditReport = useCallback(async (tb: TrialBalanceEntry[], company: string) => {
        setIsGeneratingAuditReport(true);
        try {
            const { report } = await generateAuditReportService(tb, company);
            setAuditReport(report);
        } catch (err: any) {
            setReportsError("Failed to generate audit report.");
        } finally {
            setIsGeneratingAuditReport(false);
        }
    }, []);

    const handleConfirmBalances = useCallback(() => {
        // Update fileSummaries and overall currency
        const updatedFileSummaries = { ...fileSummaries };
        let updatedTransactions = [...transactions];
        let firstCurrency = '';

        let stepIndex = 0;
        Object.entries(tempAccountBalances).forEach(([fileName, data]) => {
            const typedData = data as { currency: string, opening: number, rate: number };
            if (stepIndex === 0) firstCurrency = typedData.currency;

            // Determine AED values
            const rate = typedData.currency === 'AED' ? 1 : (typedData.rate || 1);
            const openingAED = typedData.opening * rate;

            // Update individual file summary
            if (updatedFileSummaries[fileName]) {
                const currentSummary = updatedFileSummaries[fileName];
                updatedFileSummaries[fileName] = {
                    ...currentSummary,
                    currency: typedData.currency,
                    originalOpeningBalance: typedData.opening,
                    openingBalance: openingAED,
                    // Re-calculate closing balance if we have the totals
                    originalClosingBalance: typedData.opening - (currentSummary.totalWithdrawals || 0) + (currentSummary.totalDeposits || 0),
                    closingBalance: openingAED - ((currentSummary.totalWithdrawals || 0) * rate) + ((currentSummary.totalDeposits || 0) * rate)
                };
            }

            // Update transactions for this file
            updatedTransactions = updatedTransactions.map(t => {
                if (t.sourceFile === fileName) {
                    return {
                        ...t,
                        currency: 'AED',
                        originalCurrency: typedData.currency,
                        originalDebit: t.debit,
                        originalCredit: t.credit,
                        debit: (t.debit || 0) * rate,
                        credit: (t.credit || 0) * rate
                    };
                }
                return t;
            });
            stepIndex++;
        });

        const summaryEntries = Object.values(updatedFileSummaries) as BankStatementSummary[];
        // Update overall summary opening/closing if multiple files
        const consolidatedOpening = summaryEntries.reduce((sum, s) => sum + (s.openingBalance || 0), 0);
        const consolidatedWithdrawals = summaryEntries.reduce((sum, s) => sum + (s.totalWithdrawals || 0), 0);
        const consolidatedDeposits = summaryEntries.reduce((sum, s) => sum + (s.totalDeposits || 0), 0);

        const updatedTotalSummary = summary ? {
            ...summary,
            openingBalance: consolidatedOpening,
            totalWithdrawals: consolidatedWithdrawals,
            totalDeposits: consolidatedDeposits,
            closingBalance: consolidatedOpening - consolidatedWithdrawals + consolidatedDeposits
        } : null;

        setFileSummaries(updatedFileSummaries);
        setTransactions(updatedTransactions);
        setSummary(updatedTotalSummary);
        if (firstCurrency) setCurrency(firstCurrency);

        setShowOpeningBalancePopUp(false);
        setAppState('success');
    }, [tempAccountBalances, fileSummaries, transactions, summary, handleFullReset]);

    const handlePeriodSubmit = (start: string, end: string) => {
        const period = { start, end };
        setSelectedPeriod(period);
        if (typeId) {
            localStorage.setItem(`ct_period_${customerId}_${typeId}`, JSON.stringify(period));
            navigate(`/projects/ct-filing/${customerId}/${typeId}/upload`);
        }
    };

    const handleSelectCompany = (comp: Company) => {
        navigate(`/projects/ct-filing/${comp.id}`);
    };

    const handleSelectFilingType = useCallback((type: number) => {
        navigate(`/projects/ct-filing/${customerId}/type${type}/filing-periods`);
    }, [navigate, customerId]);

    const handleBackToCompanies = () => navigate('/projects/ct-filing');
    const handleBackToTypes = () => navigate(`/projects/ct-filing/${customerId}`);

    // Main render logic
    if (!customerId) {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <CtCompanyList
                    companies={projectCompanies}
                    onSelectCompany={handleSelectCompany}
                    title="Select Company for CT Filing"
                />
            </div>
        );
    }

    if (!typeId) {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <CtFilingTypeSelection onSelectType={handleSelectFilingType} onBack={handleBackToCompanies} />
            </div>
        );
    }

    if (stage === 'upload' && !selectedPeriod) {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <SimpleLoading message="Redirecting to filing period selection..." />
            </div>
        );
    }

    if (appState === 'loading') {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} title="Analyzing Your Document..." /></div>
            </div>
        );
    }

    if (appState === 'error') {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-red-500 mb-4 text-lg font-semibold">Error Processing</div>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <div className="flex space-x-4">
                        <button onClick={handleReset} className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors">Try Again</button>
                        <button onClick={handleFullReset} className="px-5 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors">Start Over</button>
                    </div>
                </div>
            </div>
        );
    }

    if (appState === 'confirm_balances') {
        return (
            <div className="min-h-full bg-[#0a0f1a] text-white p-8 flex items-center justify-center">
                <div className="max-w-4xl w-full">
                    <div className="mb-8 text-center">
                        <h2 className="text-3xl font-bold mb-2">Confirm Statement Details</h2>
                        <p className="text-gray-400">Please verify or enter the currency and opening balance for each uploaded statement.</p>
                    </div>

                    <div className="grid gap-4">
                        {Object.entries(tempAccountBalances).map(([fileName, fileData]) => {
                            const data = fileData as { currency: string, opening: number, rate: number };
                            return (
                                <div key={fileName} className="bg-gray-900/40 border border-gray-800 p-6 rounded-2xl flex flex-wrap items-center gap-6">
                                    <div className="flex-1 min-w-[300px]">
                                        <div className="flex items-center gap-3 mb-1">
                                            <BanknotesIcon className="w-5 h-5 text-blue-400" />
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Statement File</span>
                                        </div>
                                        <p className="text-white font-medium">{fileName}</p>
                                    </div>

                                    <div className="w-32">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Currency</label>
                                        <select
                                            value={data.currency}
                                            onChange={(e) => setTempAccountBalances(prev => ({
                                                ...prev,
                                                [fileName]: { ...prev[fileName], currency: e.target.value }
                                            }))}
                                            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-2 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                        >
                                            <option value="AED">AED</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="SAR">SAR</option>
                                            <option value="QAR">QAR</option>
                                            <option value="OMR">OMR</option>
                                        </select>
                                    </div>

                                    <div className="w-40">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">Opening Balance</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={data.opening}
                                                onChange={(e) => setTempAccountBalances(prev => ({
                                                    ...prev,
                                                    [fileName]: { ...prev[fileName], opening: parseFloat(e.target.value) || 0 }
                                                }))}
                                                className="w-full bg-gray-800/50 border border-gray-700 rounded-xl pl-4 pr-10 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                                                placeholder="0.00"
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 font-bold">{data.currency}</div>
                                        </div>
                                    </div>

                                    {data.currency !== 'AED' && (
                                        <div className="w-40">
                                            <label className="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-1.5 animate-pulse">1 {data.currency} → AED</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.0001"
                                                    value={data.rate}
                                                    onChange={(e) => setTempAccountBalances(prev => ({
                                                        ...prev,
                                                        [fileName]: { ...prev[fileName], rate: parseFloat(e.target.value) || 0 }
                                                    }))}
                                                    className="w-full bg-blue-900/10 border border-blue-500/30 rounded-xl pl-4 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-blue-300 font-bold"
                                                    placeholder="1.0000"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-10 flex justify-center gap-4">
                        <button
                            onClick={handleFullReset}
                            className="px-8 py-3 bg-gray-800/50 text-gray-300 font-semibold rounded-2xl border border-gray-700 hover:bg-gray-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmBalances}
                            className="px-10 py-3 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 shadow-xl shadow-blue-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Confirm and Process Statement
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (appState === 'success' || ctFilingType === 3 || ctFilingType === 4) {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                {ctFilingType === 1 && (
                    <CtType1Results
                        transactions={transactions}
                        trialBalance={trialBalance}
                        auditReport={auditReport}
                        isGeneratingTrialBalance={isGeneratingTrialBalance}
                        isGeneratingAuditReport={isGeneratingAuditReport}
                        reportsError={reportsError}
                        onUpdateTransactions={setTransactions}
                        onGenerateTrialBalance={handleGenerateTrialBalance}
                        onGenerateAuditReport={handleGenerateAuditReport}
                        currency={currency}
                        companyName={selectedCompany?.name || ''}
                        onReset={handleFullReset}
                        summary={summary}
                        previewUrls={statementPreviewUrls}
                        company={selectedCompany!}
                        fileSummaries={fileSummaries}
                        statementFiles={[...vatStatementFiles, ...excelStatementFiles]}
                    />
                )}
                {ctFilingType === 2 && (
                    <CtType2Results
                        appState={appState}
                        transactions={transactions}
                        salesInvoices={salesInvoices}
                        purchaseInvoices={purchaseInvoices}
                        onUpdateSalesInvoices={setSalesInvoices}
                        onUpdatePurchaseInvoices={setPurchaseInvoices}
                        trialBalance={trialBalance}
                        auditReport={auditReport}
                        isGeneratingTrialBalance={isGeneratingTrialBalance}
                        isGeneratingAuditReport={isGeneratingAuditReport}
                        reportsError={reportsError}
                        onUpdateTransactions={setTransactions}
                        onGenerateTrialBalance={handleGenerateTrialBalance}
                        onGenerateAuditReport={handleGenerateAuditReport}
                        currency={currency}
                        companyName={selectedCompany?.name || ''}
                        companyTrn={companyTrn || selectedCompany?.trn || ''}
                        onReset={handleFullReset}
                        summary={summary}
                        previewUrls={statementPreviewUrls}
                        company={selectedCompany!}
                        fileSummaries={fileSummaries}
                        statementFiles={[...vatStatementFiles, ...excelStatementFiles]}
                        invoiceFiles={vatInvoiceFiles}
                        onVatInvoiceFilesSelect={setVatInvoiceFiles}
                        pdfPassword={pdfPassword}
                        onPasswordChange={setPdfPassword}
                        onCompanyNameChange={setCompanyName}
                        onCompanyTrnChange={setCompanyTrn}
                        onProcess={processFiles}
                    />
                )}
                {ctFilingType === 3 && (
                    <CtType3Results
                        trialBalance={trialBalance}
                        auditReport={auditReport}
                        isGeneratingTrialBalance={isGeneratingTrialBalance}
                        isGeneratingAuditReport={isGeneratingAuditReport}
                        reportsError={reportsError}
                        onGenerateTrialBalance={handleGenerateTrialBalance}
                        onGenerateAuditReport={handleGenerateAuditReport}
                        currency={currency}
                        companyName={selectedCompany?.name || ''}
                        onReset={handleFullReset}
                        company={selectedCompany!}
                    />
                )}
                {ctFilingType === 4 && (
                    <CtType4Results
                        currency={currency}
                        companyName={selectedCompany?.name || ''}
                        onReset={handleFullReset}
                        company={selectedCompany!}
                    />
                )}
            </div>
        );
    }

    // Default Upload view if in upload mode or just finished period entry
    return (
        <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
            <div className="space-y-6">
                <button
                    onClick={() => {
                        if (typeId) {
                            navigate(`/projects/ct-filing/${customerId}/${typeId}/filing-periods`);
                        }
                    }}
                    className="text-gray-400 hover:text-white flex items-center text-sm transition-colors"
                >
                    <ChevronLeftIcon className="w-4 h-4 mr-1" /> Change Period
                </button>

                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                        Upload Bank Statements
                    </h2>
                    <div className="px-3 py-1 bg-gray-800 rounded-lg border border-gray-700 text-xs text-blue-400 font-mono">
                        {selectedPeriod!.start} to {selectedPeriod!.end}
                    </div>
                </div>

                <VatFilingUpload
                    invoiceFiles={vatInvoiceFiles}
                    onInvoiceFilesSelect={setVatInvoiceFiles}
                    statementFiles={vatStatementFiles}
                    onStatementFilesSelect={setVatStatementFiles}
                    excelFiles={excelStatementFiles}
                    onExcelFilesSelect={setExcelStatementFiles}
                    pdfPassword={pdfPassword}
                    onPasswordChange={setPdfPassword}
                    companyName={companyName}
                    onCompanyNameChange={setCompanyName}
                    companyTrn={companyTrn}
                    onCompanyTrnChange={setCompanyTrn}
                    showInvoiceUpload={false}
                    showStatementUpload={true}
                    showExcelUpload={true}
                    onProcess={processFiles}
                />
            </div>
        </div>
    );
};



