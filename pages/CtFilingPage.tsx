import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
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

// UI Components
import { CtFilingTypeSelection } from '../components/CtFilingTypeSelection';
import { CtFilingDashboard } from '../components/CtFilingDashboard';
import { CtType1Results } from '../components/CtType1Results';
import { CtType2Results } from '../components/CtType2Results';
import { CtType3Results } from '../components/CtType3Results';
import { CtCompanyList } from '../components/CtCompanyList';
import { ChevronLeftIcon } from '../components/icons';
import { VatFilingUpload } from '../components/VatFilingUpload';

export const CtFilingPage: React.FC = () => {
    const { currentUser } = useAuth();
    const {
        projectCompanies,
        knowledgeBase,
        addHistoryItem,
        addCustomer
    } = useData();

    // State from ProjectPageWrapper
    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [vatInvoiceFiles, setVatInvoiceFiles] = useState<File[]>([]);
    const [vatStatementFiles, setVatStatementFiles] = useState<File[]>([]);
    const [pdfPassword, setPdfPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyTrn, setCompanyTrn] = useState('');
    const [ctFilingType, setCtFilingType] = useState<number | null>(null);
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
        setCtFilingType(null);
        setSelectedPeriod(null);
        setViewMode('dashboard');
        setStatementPreviewUrls([]);
        setInvoicePreviewUrls([]);
    }, [auditReport]);

    const processFiles = useCallback(async () => {
        setAppState('loading');
        setProgress(10);
        setProgressMessage('Preparing documents...');

        try {
            let localTransactions: Transaction[] = [];
            let localSummary: BankStatementSummary | null = null;
            let localCurrency: string = 'AED';
            let localSalesInvoices: Invoice[] = [];
            let localPurchaseInvoices: Invoice[] = [];
            let localExtractedData: ExtractedDataObject[] = [];
            let localFileSummaries: Record<string, BankStatementSummary> = {};

            if (ctFilingType === 1) {
                if (vatStatementFiles.length > 0) {
                    setProgressMessage('Processing Bank Statements...');
                    let allRawTransactions: Transaction[] = [];
                    let firstSummary: BankStatementSummary | null = null;
                    let processedCurrency = 'AED';
                    let processedCount = 0;

                    for (const file of vatStatementFiles) {
                        const parts = await convertFileToParts(file);
                        const result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                        const taggedTransactions = result.transactions.map(t => ({ ...t, sourceFile: file.name }));
                        allRawTransactions = [...allRawTransactions, ...taggedTransactions];
                        if (!firstSummary) { firstSummary = result.summary; processedCurrency = result.currency; }
                        localFileSummaries[file.name] = result.summary;
                        processedCount++;
                    }
                    const filteredByPeriod = filterTransactionsByDate(allRawTransactions, selectedPeriod?.start, selectedPeriod?.end);
                    localTransactions = deduplicateTransactions(filteredByPeriod);
                    localSummary = firstSummary;
                    localCurrency = processedCurrency;
                    setProgress(100);
                }
            } else if (ctFilingType === 2) {
                if (vatStatementFiles.length > 0) {
                    let allRawTransactions: Transaction[] = [];
                    for (const file of vatStatementFiles) {
                        const parts = await convertFileToParts(file);
                        const result = await extractTransactionsFromImage(parts, selectedPeriod?.start, selectedPeriod?.end);
                        allRawTransactions = [...allRawTransactions, ...result.transactions.map(t => ({ ...t, sourceFile: file.name }))];
                        if (!localSummary) localSummary = result.summary;
                        localFileSummaries[file.name] = result.summary;
                        localCurrency = result.currency;
                    }
                    localTransactions = deduplicateTransactions(filterTransactionsByDate(allRawTransactions, selectedPeriod?.start, selectedPeriod?.end));
                }
                if (vatInvoiceFiles.length > 0) {
                    setProgressMessage('Processing Invoices...');
                    let invParts: Part[] = [];
                    for (const file of vatInvoiceFiles) {
                        const parts = await convertFileToParts(file);
                        invParts = [...invParts, ...parts];
                    }
                    const invResult = await extractInvoicesData(invParts, knowledgeBase, companyName, companyTrn);
                    localSalesInvoices = invResult.invoices.filter(i => i.invoiceType === 'sales');
                    localPurchaseInvoices = invResult.invoices.filter(i => i.invoiceType === 'purchase');
                    if (vatStatementFiles.length === 0) localCurrency = invResult.invoices[0]?.currency || 'AED';
                }
                setProgress(100);
            }

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
                transactions: localTransactions,
                summary: localSummary || undefined,
                currency: localCurrency,
                salesInvoices: localSalesInvoices,
                purchaseInvoices: localPurchaseInvoices,
                extractedData: localExtractedData
            });

        } catch (e: any) {
            setError(e.message);
            setAppState('error');
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
            const tbEntries: TrialBalanceEntry[] = Object.entries(balances).map(([account, { debit, credit }]) => ({ account, debit, credit }));
            tbEntries.push({ account: 'Bank Account', debit: bankDebit, credit: bankCredit });
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

    const handleStartFiling = (start: string, end: string) => {
        setSelectedPeriod({ start: start.trim(), end: end.trim() });
        setViewMode('upload');
    };

    if (!selectedCompany) {
        return <CtCompanyList
            companies={projectCompanies}
            onSelectCompany={(comp) => { setSelectedCompany(comp); if (comp) { setCompanyName(comp.name); setCompanyTrn(comp.trn); } }}
            title="Select Company for CT Filing"
        />;
    }

    if (appState === 'loading') {
        return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;
    }

    if (appState === 'error') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-red-500 mb-4 text-lg font-semibold">Error Processing</div>
                <p className="text-gray-400 mb-6">{error}</p>
                <button onClick={handleReset} className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200">Try Again</button>
            </div>
        );
    }

    if (appState === 'success' && !ctFilingType) {
        return <CtFilingTypeSelection onSelectType={setCtFilingType} onBack={handleReset} />;
    }

    if (appState === 'success') {
        if (ctFilingType === 1) {
            return <CtType1Results
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
                companyName={selectedCompany.name}
                onReset={handleReset}
                summary={summary}
                previewUrls={statementPreviewUrls}
                company={selectedCompany}
                fileSummaries={fileSummaries}
                statementFiles={vatStatementFiles}
            />;
        }
        if (ctFilingType === 2) {
            return <CtType2Results
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
                companyName={selectedCompany.name}
                onReset={handleReset}
                summary={summary}
                previewUrls={statementPreviewUrls}
                company={selectedCompany}
                fileSummaries={fileSummaries}
                statementFiles={vatStatementFiles}
                invoiceFiles={vatInvoiceFiles}
                onVatInvoiceFilesSelect={setVatInvoiceFiles}
                pdfPassword={pdfPassword}
                onPasswordChange={setPdfPassword}
                onCompanyNameChange={setCompanyName}
                onCompanyTrnChange={setCompanyTrn}
                onProcess={processFiles}
            />;
        }
        if (ctFilingType === 3) {
            return <CtType3Results
                trialBalance={trialBalance}
                auditReport={auditReport}
                isGeneratingTrialBalance={isGeneratingTrialBalance}
                isGeneratingAuditReport={isGeneratingAuditReport}
                reportsError={reportsError}
                onGenerateTrialBalance={handleGenerateTrialBalance}
                onGenerateAuditReport={handleGenerateAuditReport}
                currency={currency}
                companyName={selectedCompany.name}
                onReset={handleReset}
                company={selectedCompany}
            />;
        }
    }

    if (viewMode === 'dashboard') {
        return <CtFilingDashboard company={selectedCompany} onNewFiling={handleStartFiling} onBack={() => setSelectedCompany(null)} />;
    }

    if (viewMode === 'upload') {
        if (!ctFilingType) return <CtFilingTypeSelection onSelectType={setCtFilingType} onBack={() => setViewMode('dashboard')} />;

        return (
            <div className="space-y-6">
                <button onClick={() => { setCtFilingType(null); setViewMode('dashboard'); }} className="text-gray-400 hover:text-white flex items-center text-sm"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
                <h2 className="text-xl font-bold text-white">{ctFilingType === 1 ? 'Upload Bank Statements' : 'Upload Statements & Invoices'}</h2>
                <VatFilingUpload
                    invoiceFiles={vatInvoiceFiles}
                    onInvoiceFilesSelect={setVatInvoiceFiles}
                    statementFiles={vatStatementFiles}
                    onStatementFilesSelect={setVatStatementFiles}
                    pdfPassword={pdfPassword}
                    onPasswordChange={setPdfPassword}
                    companyName={selectedCompany.name}
                    onCompanyNameChange={setCompanyName}
                    companyTrn={selectedCompany.trn}
                    onCompanyTrnChange={setCompanyTrn}
                    showInvoiceUpload={ctFilingType === 2}
                    showStatementUpload={true}
                    onProcess={processFiles}
                />
            </div>
        );
    }

    return null;
};

