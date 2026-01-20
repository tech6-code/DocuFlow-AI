import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import {
    extractTransactionsFromImage,
    extractInvoicesData,
    filterTransactionsByDate,
    deduplicateTransactions
} from '../services/geminiService';
import {
    Transaction,
    BankStatementSummary,
    Invoice,
    DocumentHistoryItem,
    Company
} from '../types';
import { generatePreviewUrls, convertFileToParts } from '../utils/fileUtils';

// UI Components
import { CtCompanyList } from '../components/CtCompanyList';
import { VatFilingUpload } from '../components/VatFilingUpload';
import { TransactionTable } from '../components/TransactionTable';
import { InvoiceResults } from '../components/InvoiceResults';
import { ReconciliationTable } from '../components/ReconciliationTable';
import { ChevronLeftIcon } from '../components/icons';

export const BookkeepingPage: React.FC = () => {
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
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'dashboard' | 'upload'>('dashboard');
    const [statementPreviewUrls, setStatementPreviewUrls] = useState<string[]>([]);
    const [invoicePreviewUrls, setInvoicePreviewUrls] = useState<string[]>([]);

    useEffect(() => {
        if (appState === 'success') {
            if (vatStatementFiles.length > 0) generatePreviewUrls(vatStatementFiles).then(setStatementPreviewUrls);
            if (vatInvoiceFiles.length > 0) generatePreviewUrls(vatInvoiceFiles).then(setInvoicePreviewUrls);
        }
    }, [appState, vatStatementFiles, vatInvoiceFiles]);

    const handleReset = useCallback(() => {
        setAppState('initial'); setError(null); setTransactions([]); setSalesInvoices([]); setPurchaseInvoices([]); setSummary(null); setVatInvoiceFiles([]); setVatStatementFiles([]); setSelectedPeriod(null); setViewMode('dashboard');
    }, []);

    const processFiles = useCallback(async () => {
        setAppState('loading'); setProgress(10); setProgressMessage('Processing bookkeeping data...');
        try {
            let localTransactions: Transaction[] = [];
            let localSummary: BankStatementSummary | null = null;
            let localCurrency: string = 'AED';
            let localSales: Invoice[] = [];
            let localPurchase: Invoice[] = [];

            if (vatStatementFiles.length > 0) {
                let allRaw = [];
                for (const file of vatStatementFiles) {
                    const res = await extractTransactionsFromImage(await convertFileToParts(file), selectedPeriod?.start, selectedPeriod?.end);
                    allRaw.push(...res.transactions.map(t => ({ ...t, sourceFile: file.name })));
                    if (!localSummary) localSummary = res.summary;
                    localCurrency = res.currency;
                }
                localTransactions = deduplicateTransactions(filterTransactionsByDate(allRaw, selectedPeriod?.start, selectedPeriod?.end));
            }

            if (vatInvoiceFiles.length > 0) {
                let invParts = [];
                for (const file of vatInvoiceFiles) invParts.push(...(await convertFileToParts(file)));
                const res = await extractInvoicesData(invParts, knowledgeBase, companyName, companyTrn);
                localSales = res.invoices.filter(i => i.invoiceType === 'sales');
                localPurchase = res.invoices.filter(i => i.invoiceType === 'purchase');
            }

            setTransactions(localTransactions); setSummary(localSummary); setCurrency(localCurrency); setSalesInvoices(localSales); setPurchaseInvoices(localPurchase); setAppState('success');
            addHistoryItem({
                id: Date.now().toString(),
                type: 'Bookkeeping',
                title: `Bookkeeping - ${selectedCompany?.name}`,
                processedAt: new Date().toISOString(),
                pageCount: vatStatementFiles.length + vatInvoiceFiles.length,
                processedBy: currentUser?.name || 'User',
                customerId: selectedCompany?.id,
                serviceId: salesSettings.servicesRequired.find(s => s.name === 'Bookkeeping')?.id,
                transactions: localTransactions,
                summary: localSummary || undefined,
                currency: localCurrency
            });
        } catch (e: any) { setError(e.message); setAppState('error'); }
    }, [vatStatementFiles, vatInvoiceFiles, selectedPeriod, knowledgeBase, companyName, companyTrn, currentUser, addHistoryItem, selectedCompany]);

    if (!selectedCompany) return <CtCompanyList companies={projectCompanies} onSelectCompany={(comp) => { setSelectedCompany(comp); if (comp) { setCompanyName(comp.name); setCompanyTrn(comp.trn); } }} title="Select Company for Bookkeeping" />;
    if (appState === 'loading') return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;

    if (appState === 'success') {
        return (
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white flex items-center transition-colors"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
                    <h2 className="text-xl font-bold text-white">Bookkeeping Results - {selectedCompany.name}</h2>
                </div>
                {transactions.length > 0 && <TransactionTable transactions={transactions} onReset={() => { }} previewUrls={statementPreviewUrls} summary={summary} currency={currency} analysis={null} isAnalyzing={false} analysisError={null} onAnalyze={() => { }} />}
                {transactions.length > 0 && (salesInvoices.length > 0 || purchaseInvoices.length > 0) && <ReconciliationTable invoices={[...salesInvoices, ...purchaseInvoices]} transactions={transactions} currency={currency} />}
                {(salesInvoices.length > 0 || purchaseInvoices.length > 0) && <InvoiceResults invoices={[...salesInvoices, ...purchaseInvoices]} previewUrls={invoicePreviewUrls} knowledgeBase={knowledgeBase} onAddToKnowledgeBase={() => { }} onUpdateInvoice={() => { }} onReset={() => { }} />}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Bookkeeping - {selectedCompany.name}</h2>
                <button onClick={() => setSelectedCompany(null)} className="text-sm text-gray-400 hover:text-white">Switch Company</button>
            </div>
            <VatFilingUpload
                invoiceFiles={vatInvoiceFiles} onInvoiceFilesSelect={setVatInvoiceFiles}
                statementFiles={vatStatementFiles} onStatementFilesSelect={setVatStatementFiles}
                pdfPassword={pdfPassword} onPasswordChange={setPdfPassword}
                companyName={selectedCompany.name} onCompanyNameChange={setCompanyName}
                companyTrn={selectedCompany.trn} onCompanyTrnChange={setCompanyTrn}
                onProcess={processFiles}
            />
        </div>
    );
};

