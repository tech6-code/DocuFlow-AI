import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { SimpleLoading } from '../components/SimpleLoading';
import { ctFilingService } from '../services/ctFilingService';
import {
    extractTransactionsFromImage,
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
import { generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';

declare const XLSX: any;

// UI Components
import { CtFilingTypeSelection } from '../components/CtFilingTypeSelection';
import { CtFilingDashboard } from '../components/CtFilingDashboard';
import { CtType1Results } from '../components/CtType1Results';
import { CtType2Results } from '../components/CtType2Results';
import { CtType3Results } from '../components/CtType3Results';
import { CtType4Results } from '../components/CtType4Results';
import { CtCompanyList } from '../components/CtCompanyList';
import { ChevronLeftIcon } from '../components/icons';
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
                setCompanyTrn(company.trn);
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
            const normalizeInvoiceType = (invoice: Invoice): Invoice => {
                const rawType = (invoice as Invoice & { invoiceType?: string }).invoiceType;
                if (rawType === 'sales' || rawType === 'purchase') {
                    return { ...invoice, invoiceType: rawType };
                }
                return { ...invoice, invoiceType: 'purchase' };
            };

            if (ctFilingType === 1) {
                if (vatStatementFiles.length > 0) {
                    console.log(`[CT Filing] Received ${vatStatementFiles.length} bank statement files for processing.`);
                    setProgressMessage('Processing Bank Statements...');
                    let allRawTransactions: Transaction[] = [];
                    let firstSummary: BankStatementSummary | null = null;
                    let processedCurrency = 'AED';
                    let processedCount = 0;

                    for (const file of vatStatementFiles) {
                        console.log(`[CT Filing] Starting extraction for file: ${file.name}`);
                        const parts = await convertFileToParts(file);
                        const result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                        console.log(`[CT Filing] Extraction completed for ${file.name}. Found ${result.transactions.length} transactions.`);
                        const taggedTransactions = result.transactions.map(t => ({ ...t, sourceFile: file.name }));
                        allRawTransactions = [...allRawTransactions, ...taggedTransactions];
                        if (!firstSummary) { firstSummary = result.summary; processedCurrency = result.currency; }
                        localFileSummaries[file.name] = result.summary;
                        processedCount++;
                    }
                    const filteredByPeriod = filterTransactionsByDate(allRawTransactions, selectedPeriod?.start, selectedPeriod?.end);
                    localTransactions = deduplicateTransactions(filteredByPeriod);
                    console.log(`[CT Filing] Final transactions count after period filter and deduplication: ${localTransactions.length}`);
                    localSummary = firstSummary;
                    localCurrency = processedCurrency;
                    setProgress(100);
                }
            } else if (ctFilingType === 2) {
                if (!invoicesOnly && vatStatementFiles.length > 0) {
                    let allRawTransactions: Transaction[] = [];
                    for (const file of vatStatementFiles) {
                        if (file.name.match(/\.xlsx?$/i)) {
                            console.log(`[CT Filing] Processing Excel file: ${file.name}`);
                            try {
                                await new Promise<void>((resolve, reject) => {
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                        try {
                                            const data = new Uint8Array(e.target?.result as ArrayBuffer);
                                            const workbook = XLSX.read(data, { type: 'array' });
                                            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                                            const rows: any[] = XLSX.utils.sheet_to_json(firstSheet);

                                            const extracted = rows.map((row: any, idx: number) => ({
                                                date: row['Date'] || '',
                                                description: row['Description'] || '',
                                                debit: row['Debit'] || 0,
                                                credit: row['Credit'] || 0,
                                                category: (row['Category'] || '').replace(/^\d+\s+/, ''),
                                                balance: row['Balance'] || 0,
                                                currency: row['Currency'] || 'AED',
                                                confidence: 100,
                                                sourceFile: file.name,
                                                originalIndex: idx
                                            }));

                                            allRawTransactions = [...allRawTransactions, ...extracted];
                                            if (!localSummary) {
                                                localSummary = {
                                                    openingBalance: 0, closingBalance: 0,
                                                    totalDeposits: extracted.reduce((s: number, t: any) => s + (Number(t.credit) || 0), 0),
                                                    totalWithdrawals: extracted.reduce((s: number, t: any) => s + (Number(t.debit) || 0), 0),
                                                    accountHolder: 'Excel Upload', accountNumber: '', statementPeriod: ''
                                                };
                                            }
                                            resolve();
                                        } catch (err) { reject(err); }
                                    };
                                    reader.onerror = reject;
                                    reader.readAsArrayBuffer(file);
                                });
                            } catch (err) {
                                console.error("Error parsing Excel:", err);
                            }
                        } else {
                            const parts = await convertFileToParts(file);
                            const result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                            allRawTransactions = [...allRawTransactions, ...result.transactions.map(t => ({ ...t, sourceFile: file.name }))];
                            if (!localSummary) localSummary = result.summary;
                            localFileSummaries[file.name] = result.summary;
                            localCurrency = result.currency;
                        }
                    }
                    localTransactions = deduplicateTransactions(filterTransactionsByDate(allRawTransactions, selectedPeriod?.start, selectedPeriod?.end));
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
                setTransactions(localTransactions);
                setSummary(localSummary);
                setCurrency(localCurrency);
                setSalesInvoices(localSalesInvoices);
                setPurchaseInvoices(localPurchaseInvoices);
                setExtractedData(localExtractedData);
                setFileSummaries(localFileSummaries);
                setAppState('success');

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
    }, [ctFilingType, vatStatementFiles, vatInvoiceFiles, selectedPeriod, knowledgeBase, companyName, companyTrn, selectedCompany, currentUser, addHistoryItem]);

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
                        statementFiles={vatStatementFiles}
                    />
                )}
                {ctFilingType === 2 && (
                    <CtType2Results
                        appState={appState}
                        transactions={transactions}
                        salesInvoices={salesInvoices}
                        purchaseInvoices={purchaseInvoices}
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
                        statementFiles={vatStatementFiles}
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
                    pdfPassword={pdfPassword}
                    onPasswordChange={setPdfPassword}
                    companyName={selectedCompany?.name || ''}
                    onCompanyNameChange={setCompanyName}
                    companyTrn={selectedCompany?.trn || ''}
                    onCompanyTrnChange={setCompanyTrn}
                    showInvoiceUpload={false}
                    showStatementUpload={true}
                    onProcess={processFiles}
                />
            </div>
        </div>
    );
};


