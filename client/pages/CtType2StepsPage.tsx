import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useData } from '../contexts/DataContext';
import { CtType2Results } from '../components/CtType2Results';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { generateAuditReport as generateAuditReportService } from '../services/geminiService';
import {
    Transaction,
    BankStatementSummary,
    Invoice,
    TrialBalanceEntry,
    FinancialStatements,
    Company,
    ExtractedDataObject
} from '../types';

const SESSION_KEY = 'ct_type2_session';

type StoredSession = {
    customerId?: string;
    companyName?: string;
    companyTrn?: string;
    period?: { start: string; end: string } | null;
    transactions?: Transaction[];
    salesInvoices?: Invoice[];
    purchaseInvoices?: Invoice[];
    summary?: BankStatementSummary | null;
    currency?: string;
    fileSummaries?: Record<string, BankStatementSummary>;
    trialBalance?: TrialBalanceEntry[] | null;
    auditReport?: FinancialStatements | null;
    extractedData?: ExtractedDataObject[];
};

const loadSession = (): StoredSession | null => {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as StoredSession;
    } catch (err) {
        console.error('Failed to read CT Type 2 session', err);
        return null;
    }
};

const saveSession = (session: StoredSession) => {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (err) {
        console.error('Failed to save CT Type 2 session', err);
    }
};

export const CtType2StepsPage: React.FC = () => {
    const { projectCompanies } = useData();
    const navigate = useNavigate();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<{ start: string; end: string } | null>(null);
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

    const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
    const [pdfPassword, setPdfPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyTrn, setCompanyTrn] = useState('');

    useEffect(() => {
        const session = loadSession();
        if (!session) return;

        if (session.customerId) {
            const company = projectCompanies.find(c => c.id === session.customerId) || null;
            setSelectedCompany(company);
            if (company) {
                setCompanyName(session.companyName || company.name);
                setCompanyTrn(session.companyTrn || company.trn);
            }
        }

        if (session.period) setSelectedPeriod(session.period);
        if (session.transactions) setTransactions(session.transactions);
        if (session.salesInvoices) setSalesInvoices(session.salesInvoices);
        if (session.purchaseInvoices) setPurchaseInvoices(session.purchaseInvoices);
        if (session.summary !== undefined) setSummary(session.summary ?? null);
        if (session.currency) setCurrency(session.currency);
        if (session.fileSummaries) setFileSummaries(session.fileSummaries);
        if (session.trialBalance !== undefined) setTrialBalance(session.trialBalance ?? null);
        if (session.auditReport !== undefined) setAuditReport(session.auditReport ?? null);
        if (session.extractedData) setExtractedData(session.extractedData);

        const hasData = !!(session.transactions?.length || session.salesInvoices?.length || session.purchaseInvoices?.length);
        setAppState(hasData ? 'success' : 'initial');
    }, [projectCompanies]);

    useEffect(() => {
        const session: StoredSession = {
            customerId: selectedCompany?.id,
            companyName,
            companyTrn,
            period: selectedPeriod,
            transactions,
            salesInvoices,
            purchaseInvoices,
            summary,
            currency,
            fileSummaries,
            trialBalance,
            auditReport,
            extractedData
        };
        saveSession(session);
    }, [
        auditReport,
        companyName,
        companyTrn,
        currency,
        extractedData,
        fileSummaries,
        purchaseInvoices,
        salesInvoices,
        selectedCompany,
        selectedPeriod,
        summary,
        transactions,
        trialBalance
    ]);

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
        setAuditReport(null);
        setInvoiceFiles([]);
        saveSession({});
        navigate('/projects/ct-filing');
    }, [navigate]);

    const handleGenerateTrialBalance = useCallback((txs: Transaction[]) => {
        setIsGeneratingTrialBalance(true);
        setTimeout(() => {
            const balances: Record<string, { debit: number; credit: number }> = {};
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
        } catch (err) {
            setReportsError('Failed to generate audit report.');
        } finally {
            setIsGeneratingAuditReport(false);
        }
    }, []);

    const handleProcess = useCallback(async () => {
        setError('This step flow requires an active CT Type 2 session. Please start from CT Filing.');
        setAppState('error');
    }, []);

    const hasSession = useMemo(() => transactions.length > 0 || salesInvoices.length > 0 || purchaseInvoices.length > 0, [transactions.length, salesInvoices.length, purchaseInvoices.length]);

    if (!hasSession && appState !== 'loading') {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <div className="flex flex-col items-center justify-center h-72 text-center gap-4">
                    <div className="text-red-400 font-semibold">No CT Type 2 session found</div>
                    <p className="text-gray-400 max-w-lg">
                        Please start a Type 2 filing from CT Filing to generate the data needed for the step routes.
                    </p>
                    <button
                        onClick={() => navigate('/projects/ct-filing')}
                        className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Go to CT Filing
                    </button>
                </div>
            </div>
        );
    }

    if (appState === 'loading') {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <div className="flex items-center justify-center h-full">
                    <LoadingIndicator progress={progress} statusText={progressMessage} title="Analyzing Your Document..." />
                </div>
            </div>
        );
    }

    if (appState === 'error') {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="text-red-500 mb-4 text-lg font-semibold">Error Processing</div>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button onClick={() => navigate('/projects/ct-filing')} className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors">Back to CT Filing</button>
                </div>
            </div>
        );
    }

    if (!selectedCompany) {
        return (
            <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
                <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
                    <div className="text-red-400 font-semibold">Missing company details</div>
                    <p className="text-gray-400 max-w-lg">
                        Please restart the Type 2 workflow from CT Filing.
                    </p>
                    <button
                        onClick={() => navigate('/projects/ct-filing')}
                        className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        Go to CT Filing
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-gradient-to-b from-[#0a0f1a] to-[#000000] text-white p-8">
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
                companyName={companyName || selectedCompany?.name || ''}
                companyTrn={companyTrn || selectedCompany?.trn || ''}
                onReset={handleReset}
                summary={summary}
                previewUrls={[]}
                company={selectedCompany}
                fileSummaries={fileSummaries}
                statementFiles={[]}
                invoiceFiles={invoiceFiles}
                onVatInvoiceFilesSelect={setInvoiceFiles}
                pdfPassword={pdfPassword}
                onPasswordChange={setPdfPassword}
                onCompanyNameChange={setCompanyName}
                onCompanyTrnChange={setCompanyTrn}
                onProcess={handleProcess}
                progress={progress}
                progressMessage={progressMessage}
            />
        </div>
    );
};
