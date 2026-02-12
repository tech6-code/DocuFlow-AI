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
import { generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';

// UI Components
import { VatFilingDashboard } from '../components/VatFilingDashboard';
import { VatFilingUpload } from '../components/VatFilingUpload';
import { CtCompanyList } from '../components/CtCompanyList';
import { TransactionTable } from '../components/TransactionTable';
import { ReconciliationTable } from '../components/ReconciliationTable';
import { InvoiceResults } from '../components/InvoiceResults';
import { ChevronLeftIcon } from '../components/icons';

export const VatFilingPage: React.FC = () => {
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
        setAppState('initial'); setError(null); setTransactions([]); setSalesInvoices([]); setPurchaseInvoices([]); setSummary(null); setFileSummaries({}); setVatInvoiceFiles([]); setVatStatementFiles([]); setSelectedPeriod(null); setViewMode('dashboard'); setStatementPreviewUrls([]); setInvoicePreviewUrls([]);
    }, []);

    const processFiles = useCallback(async () => {
        setAppState('loading'); setProgress(10); setProgressMessage('Processing documents...');
        try {
            let localTransactions: Transaction[] = [];
            let localSummary: BankStatementSummary | null = null;
            let localCurrency: string = 'AED';
            let localSalesInvoices: Invoice[] = [];
            let localPurchaseInvoices: Invoice[] = [];

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
                const mergedInvoices: Invoice[] = [];
                for (const file of vatInvoiceFiles) {
                    const fileParts: Part[] = await convertFileToParts(file);
                    const res = await extractInvoicesData(fileParts, knowledgeBase, companyName, companyTrn);
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

            setTransactions(localTransactions); setSummary(localSummary); setCurrency(localCurrency); setSalesInvoices(localSalesInvoices); setPurchaseInvoices(localPurchaseInvoices); setAppState('success');
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
                salesInvoices: localSalesInvoices,
                purchaseInvoices: localPurchaseInvoices,
                currency: localCurrency
            });
        } catch (e: any) { setError(e.message); setAppState('error'); }
    }, [vatStatementFiles, vatInvoiceFiles, selectedPeriod, knowledgeBase, companyName, companyTrn, currentUser, addHistoryItem, selectedCompany, classifyInvoice, getInvoiceKey]);

    const handleStartFiling = (start: string, end: string) => { setSelectedPeriod({ start, end }); setViewMode('upload'); };

    if (!selectedCompany) return <CtCompanyList companies={projectCompanies} onSelectCompany={(comp) => { setSelectedCompany(comp); if (comp) { setCompanyName(comp.name); setCompanyTrn(comp.trn); } }} title="Select Company for VAT Filing" />;
    if (appState === 'loading') return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;
    if (appState === 'error') return <div className="text-center p-10"><div className="text-red-500 mb-4">{error}</div><button onClick={handleReset} className="px-4 py-2 bg-white text-black rounded">Try Again</button></div>;

    if (appState === 'success') {
        return (
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white flex items-center transition-colors"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Dashboard</button>
                    <h2 className="text-xl font-bold text-white">VAT Filing Results - {selectedCompany.name}</h2>
                </div>
                {transactions.length > 0 && <TransactionTable transactions={transactions} onReset={() => { }} previewUrls={statementPreviewUrls} summary={summary} currency={currency} analysis={null} isAnalyzing={false} analysisError={null} onAnalyze={() => { }} />}
                {transactions.length > 0 && (salesInvoices.length > 0 || purchaseInvoices.length > 0) && <ReconciliationTable invoices={[...salesInvoices, ...purchaseInvoices]} transactions={transactions} currency={currency} />}
                {(salesInvoices.length > 0 || purchaseInvoices.length > 0) && <InvoiceResults invoices={[...salesInvoices, ...purchaseInvoices]} previewUrls={invoicePreviewUrls} knowledgeBase={knowledgeBase} onAddToKnowledgeBase={() => { }} onUpdateInvoice={() => { }} onReset={() => { }} />}
            </div>
        );
    }

    if (viewMode === 'dashboard') return <VatFilingDashboard company={selectedCompany} onNewFiling={handleStartFiling} onContinueFiling={handleStartFiling} onBack={() => setSelectedCompany(null)} />;

    return (
        <div className="space-y-6">
            <button onClick={() => setViewMode('dashboard')} className="text-gray-400 hover:text-white flex items-center text-sm"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
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

