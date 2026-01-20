import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import {
    extractTransactionsFromImage,
    generateAuditReport as generateAuditReportService,
    filterTransactionsByDate,
    deduplicateTransactions
} from '../services/geminiService';
import {
    Transaction,
    BankStatementSummary,
    DocumentHistoryItem,
    TrialBalanceEntry,
    FinancialStatements,
    Company
} from '../types';
import { convertFileToParts } from '../utils/fileUtils';

// UI Components
import { CtCompanyList } from '../components/CtCompanyList';
import { VatFilingUpload } from '../components/VatFilingUpload';
import { CtType1Results } from '../components/CtType1Results'; // Audi Report uses TB/Audit Report logic like CtType 1
import { ChevronLeftIcon } from '../components/icons';

export const AuditReportPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { projectCompanies, addHistoryItem, salesSettings } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [vatStatementFiles, setVatStatementFiles] = useState<File[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<BankStatementSummary | null>(null);
    const [trialBalance, setTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [auditReport, setAuditReport] = useState<FinancialStatements | null>(null);
    const [isGeneratingTrialBalance, setIsGeneratingTrialBalance] = useState(false);
    const [isGeneratingAuditReport, setIsGeneratingAuditReport] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleReset = useCallback(() => {
        setAppState('initial'); setTransactions([]); setSummary(null); setTrialBalance(null); setAuditReport(null);
    }, []);

    const processFiles = useCallback(async () => {
        setAppState('loading'); setProgress(20);
        try {
            let allRaw = [];
            for (const file of vatStatementFiles) {
                const res = await extractTransactionsFromImage(await convertFileToParts(file));
                allRaw.push(...res.transactions.map(t => ({ ...t, sourceFile: file.name })));
                if (!summary) setSummary(res.summary);
            }
            const localTxs = deduplicateTransactions(allRaw);
            setTransactions(localTxs); setAppState('success');
            addHistoryItem({
                id: Date.now().toString(),
                type: 'Audit Report',
                title: `Audit - ${selectedCompany?.name}`,
                processedAt: new Date().toISOString(),
                pageCount: vatStatementFiles.length,
                processedBy: currentUser?.name || 'User',
                customerId: selectedCompany?.id,
                serviceId: salesSettings.servicesRequired.find(s => s.name === 'Audit Report' || s.name === 'Audit')?.id,
                transactions: localTxs
            });
        } catch (e: any) { setAppState('error'); }
    }, [vatStatementFiles, selectedCompany, currentUser, addHistoryItem, summary]);

    const handleGenerateTrialBalance = (txs: Transaction[]) => {
        setIsGeneratingTrialBalance(true);
        setTimeout(() => {
            const balances: Record<string, { debit: number, credit: number }> = {};
            txs.forEach(t => {
                const account = (t.category || 'Uncategorized').split('|').pop()?.trim() || 'Uncategorized';
                if (!balances[account]) balances[account] = { debit: 0, credit: 0 };
                if (t.debit > 0) balances[account].debit += t.debit;
                if (t.credit > 0) balances[account].credit += t.credit;
            });
            setTrialBalance(Object.entries(balances).map(([account, { debit, credit }]) => ({ account, debit, credit })));
            setIsGeneratingTrialBalance(false);
        }, 1000);
    };

    const handleGenerateAuditReport = async (tb: TrialBalanceEntry[], company: string) => {
        setIsGeneratingAuditReport(true);
        try {
            const { report } = await generateAuditReportService(tb, company);
            setAuditReport(report);
        } finally { setIsGeneratingAuditReport(false); }
    };

    if (!selectedCompany) return <CtCompanyList companies={projectCompanies} onSelectCompany={setSelectedCompany} title="Select Company for Audit Report" />;
    if (appState === 'loading') return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText="Processing bank statements..." /></div>;

    if (appState === 'success') {
        return <CtType1Results
            transactions={transactions} trialBalance={trialBalance} auditReport={auditReport}
            isGeneratingTrialBalance={isGeneratingTrialBalance} isGeneratingAuditReport={isGeneratingAuditReport}
            onUpdateTransactions={setTransactions} onGenerateTrialBalance={handleGenerateTrialBalance} onGenerateAuditReport={handleGenerateAuditReport}
            currency="AED" companyName={selectedCompany.name} onReset={handleReset} summary={summary}
            previewUrls={[]} company={selectedCompany} fileSummaries={{}} statementFiles={vatStatementFiles}
        />;
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white">Audit Report - {selectedCompany.name}</h2>
            <VatFilingUpload
                invoiceFiles={[]} onInvoiceFilesSelect={() => { }}
                statementFiles={vatStatementFiles} onStatementFilesSelect={setVatStatementFiles}
                showInvoiceUpload={false} onProcess={processFiles}
            />
        </div>
    );
};

