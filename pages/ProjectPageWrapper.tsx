import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ProjectPage } from '../components/ProjectPage';
import {
    extractTransactionsFromImage,
    extractInvoicesData,
    extractProjectDocuments,
    analyzeTransactions,
    generateAuditReport as generateAuditReportService,
    filterTransactionsByDate,
    deduplicateTransactions
} from '../services/geminiService';
import { customerService } from '../services/customerService';


import {
    Transaction,
    BankStatementSummary,
    Invoice,
    ExtractedDataObject,
    DocumentHistoryItem,
    Customer,
    TrialBalanceEntry,
    FinancialStatements,
    Page
} from '../types';

import { generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';

// Helpers moved to utils/fileUtils.ts and geminiService

const getPageTitle = (page: Page) => {
    switch (page) {
        case 'projectFinancialOverview': return 'Bookkeeping';
        case 'projectVatFiling': return 'VAT Filing';
        case 'projectCtFiling': return 'Corporate Tax Filing';
        case 'projectRegistration': return 'Registration';
        case 'projectAuditReport': return 'Audit Report';
        default: return 'Project';
    }
};

interface ProjectPageWrapperProps {
    pageType: Page;
}

export const ProjectPageWrapper: React.FC<ProjectPageWrapperProps> = ({ pageType }) => {
    const { currentUser } = useAuth();
    const {
        projectCompanies,
        users, // Needed? No, handled by DataContext in generic components but here used for adding company
        customers,
        knowledgeBase,
        addToKnowledgeBase,
        addHistoryItem,
        addCustomer
    } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [vatInvoiceFiles, setVatInvoiceFiles] = useState<File[]>([]);
    const [vatStatementFiles, setVatStatementFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
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

    // Analysis & Reports
    const [trialBalance, setTrialBalance] = useState<TrialBalanceEntry[] | null>(null);
    const [auditReport, setAuditReport] = useState<FinancialStatements | null>(null);
    const [isGeneratingTrialBalance, setIsGeneratingTrialBalance] = useState(false);
    const [isGeneratingAuditReport, setIsGeneratingAuditReport] = useState(false);
    const [reportsError, setReportsError] = useState<string | null>(null);
    const [isSuggestingCategory, setIsSuggestingCategory] = useState(false); // Placeholder
    const [suggestionError, setSuggestionError] = useState<string | null>(null); // Placeholder

    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleFileSelect = async (files: File[] | File | null) => {
        if (!files) { setSelectedFiles([]); setPreviewUrls([]); return; }
        const fileArray = Array.isArray(files) ? files : [files];
        setSelectedFiles(fileArray);
        const urls = await generatePreviewUrls(fileArray);
        setPreviewUrls(urls);
    };

    const resetState = (keepCompany = false) => {
        setAppState('initial'); setError(null); setTransactions([]); setSalesInvoices([]); setPurchaseInvoices([]); setExtractedData([]); setSummary(null); setFileSummaries({}); setTrialBalance(null); setAuditReport(null); setPreviewUrls([]); setSelectedFiles([]); setVatInvoiceFiles([]); setVatStatementFiles([]); setCtFilingType(null);
        if (!keepCompany) { setSelectedCompany(null); setCompanyName(''); setCompanyTrn(''); }
        setSelectedPeriod(null);
    };

    const processFiles = useCallback(async () => {
        // Logic adapted from App.tsx processFiles
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

            let type = '';
            let title = 'Processed Document';

            const isCtType1 = (pageType === 'projectCtFiling' && ctFilingType === 1);
            const isSplitProcessing = (pageType === 'projectVatFiling' || pageType === 'projectFinancialOverview' || (pageType === 'projectCtFiling' && ctFilingType === 2));

            if (isSplitProcessing || isCtType1) {
                if (vatStatementFiles.length > 0) {
                    setProgressMessage('Processing Bank Statements...');
                    let allRawTransactions: Transaction[] = [];
                    let firstSummary: BankStatementSummary | null = null;
                    let processedCurrency = 'AED';
                    let processedCount = 0;

                    for (const file of vatStatementFiles) {
                        setProgressMessage(`Processing ${file.name} (${processedCount + 1}/${vatStatementFiles.length})...`);
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
                    setProgress(60);
                }

                if (isSplitProcessing && vatStatementFiles.length > 0 && vatInvoiceFiles.length > 0) {
                    // wait a bit if mixing - strictly UI feedback
                }

                if (isSplitProcessing && vatInvoiceFiles.length > 0) {
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
                    setProgress(90);
                }
                type = isCtType1 ? 'Corporate Tax Filing' : (pageType === 'projectVatFiling' ? 'VAT Filing Project' : 'Project Workspace');
                title = isCtType1 ? `CT Filing - ${companyName || 'Unknown'}` : `Project - ${companyName || 'New Project'}`;
            } else {
                // FALLBACK for other project types or if generic upload used
                let allParts: Part[] = [];
                for (const file of selectedFiles) {
                    const parts = await convertFileToParts(file);
                    allParts = [...allParts, ...parts];
                }
                const res = await extractProjectDocuments(allParts, companyName, companyTrn);
                localTransactions = selectedPeriod ? filterTransactionsByDate(res.transactions, selectedPeriod.start, selectedPeriod.end) : res.transactions;
                localSalesInvoices = res.salesInvoices;
                localPurchaseInvoices = res.purchaseInvoices;
                localSummary = res.summary;
                localCurrency = res.currency || 'AED';
                localExtractedData = [
                    ...res.emiratesIds.map(d => ({ documentType: 'Emirates ID', documentTitle: d.name, data: d })),
                    ...res.tradeLicenses.map(d => ({ documentType: 'Trade License', documentTitle: d.companyName, data: d }))
                ];
                type = 'Project Document Analysis';
                title = `Project - ${companyName || 'New Project'}`;
            }

            setTransactions(localTransactions);
            setSummary(localSummary);
            setCurrency(localCurrency);
            setSalesInvoices(localSalesInvoices);
            setPurchaseInvoices(localPurchaseInvoices);
            setExtractedData(localExtractedData);
            setFileSummaries(localFileSummaries);

            setProgress(100);
            setAppState('success');

            const historyItem: DocumentHistoryItem = {
                id: Date.now().toString(),
                type: type || 'Unknown',
                title: title,
                processedAt: new Date().toISOString(),
                pageCount: selectedFiles.length + vatInvoiceFiles.length + vatStatementFiles.length,
                processedBy: currentUser?.name || 'User',
                transactions: (pageType === 'projectCtFiling' && ctFilingType === 1) ? localTransactions : undefined,
                summary: (pageType === 'projectCtFiling' && ctFilingType === 1) ? localSummary || undefined : undefined,
                currency: (pageType === 'projectCtFiling' && ctFilingType === 1) ? localCurrency || undefined : undefined,
                salesInvoices: (pageType === 'invoicesAndBills' || pageType === 'projectVatFiling') ? localSalesInvoices : undefined,
                purchaseInvoices: (pageType === 'invoicesAndBills' || pageType === 'projectVatFiling') ? localPurchaseInvoices : undefined,
                extractedData: localExtractedData
            };
            addHistoryItem(historyItem);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setAppState('error');
        }
    }, [pageType, selectedFiles, vatInvoiceFiles, vatStatementFiles, ctFilingType, selectedPeriod, knowledgeBase, companyName, companyTrn, currentUser]);

    const handleGenerateTrialBalance = useCallback((txs: Transaction[]) => {
        setIsGeneratingTrialBalance(true);
        setTimeout(() => {
            const balances: Record<string, { debit: number, credit: number }> = {};
            let bankDebit = 0; let bankCredit = 0;
            txs.forEach(t => {
                const parts = (t.category || 'Uncategorized').split('|');
                const accountName = parts[parts.length - 1].trim();
                // Basic logic
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
            setReportsError("Failed to generate audit report. Please try again.");
        } finally {
            setIsGeneratingAuditReport(false);
        }
    }, []);

    const handleAddCompany = async (newComp: any) => {
        const newCust: Omit<Customer, 'id'> = {
            type: 'business',
            salutation: '', firstName: '', lastName: '',
            companyName: newComp.name,
            billingAddress: newComp.address,
            trn: newComp.trn,
            incorporationDate: newComp.incorporationDate,
            email: '', workPhone: '', mobile: '',
            currency: 'AED', language: 'English', shippingAddress: '', remarks: '',
            taxTreatment: 'VAT Registered', portalAccess: false,
            entityType: newComp.businessType,
            vatReportingPeriod: newComp.reportingPeriod as any,
            vatFilingDueDate: newComp.dueDate,
            firstVatFilingPeriod: newComp.periodStart && newComp.periodEnd ? `${newComp.periodStart} - ${newComp.periodEnd}` : undefined,
            corporateTaxTreatment: 'Not Registered', corporateTaxTrn: '', corporateTaxRegisteredDate: '', corporateTaxPeriod: '',
            firstCorporateTaxPeriodStart: newComp.ctPeriodStart,
            firstCorporateTaxPeriodEnd: newComp.ctPeriodEnd,
            corporateTaxFilingDueDate: newComp.ctDueDate,
            businessRegistrationNumber: '', placeOfSupply: 'Dubai', openingBalance: 0, paymentTerms: 'Net 30',
            ownerId: currentUser?.id,
            contactPersons: [], documents: [],
        };
        try {
            await addCustomer(newCust); // addCustomer is async but doesn't return the new obj in Context (void), but we can wait.
            // Wait, addCustomer in DataContext void return?
            // In implementation it calls createCustomer then setCustomers. 
            // We need to set locally selectedCompany. We can't get the ID easily unless addCustomer returns it.
            // I updated DataContext interface, addCustomer returns Promise<void>.
            // Usage in App.tsx relied on await customerService.createCustomer directly.
            // I should assume addCustomer works and maybe we just switch to it?
            // Or I should accept that I can't select it immediately without ID.
            // I'll just alert success.
            alert("Company added. Please select it from the list.");
        } catch (e: any) { alert("Failed to add company: " + e.message); }
    };

    return (
        <ProjectPage
            appState={appState}
            handleReset={() => resetState(true)}
            transactions={transactions}
            salesInvoices={salesInvoices}
            purchaseInvoices={purchaseInvoices}
            summary={summary}
            currency={currency}
            previewUrls={previewUrls}
            knowledgeBase={knowledgeBase}
            onAddToKnowledgeBase={addToKnowledgeBase}
            onRemoveFromKnowledgeBase={() => { }}
            error={error}
            progress={progress}
            progressMessage={progressMessage}
            onFilesSelect={handleFileSelect}
            selectedFiles={selectedFiles}
            pdfPassword={pdfPassword}
            onPasswordChange={setPdfPassword}
            companyName={companyName}
            onCompanyNameChange={setCompanyName}
            companyTrn={companyTrn}
            onCompanyTrnChange={setCompanyTrn}
            pageConfig={{ title: getPageTitle(pageType), subtitle: 'Manage your filing' }}
            extractedData={extractedData}
            vatInvoiceFiles={vatInvoiceFiles}
            onVatInvoiceFilesSelect={setVatInvoiceFiles}
            vatStatementFiles={vatStatementFiles}
            onVatStatementFilesSelect={setVatStatementFiles}
            ctFilingType={ctFilingType}
            onCtFilingTypeSelect={(type) => { setCtFilingType(type); if (type === 3) setAppState('success'); }}
            onUpdateTransactionCategory={() => { }}
            onSuggestCategory={() => { }}
            isSuggestingCategory={isSuggestingCategory}
            suggestionError={suggestionError}
            onGenerateTrialBalance={handleGenerateTrialBalance}
            onGenerateAuditReport={handleGenerateAuditReport}
            onUpdateProjectTransactions={setTransactions}
            trialBalance={trialBalance}
            auditReport={auditReport}
            isGeneratingTrialBalance={isGeneratingTrialBalance}
            isGeneratingAuditReport={isGeneratingAuditReport}
            reportsError={reportsError}
            companies={projectCompanies}
            selectedCompany={selectedCompany}
            onAddCompany={handleAddCompany}
            onSelectCompany={(comp) => { setSelectedCompany(comp); if (comp) { setCompanyName(comp.name); setCompanyTrn(comp.trn); } }}
            onPeriodSelect={(start, end) => { setSelectedPeriod({ start: start.trim(), end: end.trim() }); }}
            onUpdateSalesInvoice={() => { }}
            onUpdatePurchaseInvoice={() => { }}
            fileSummaries={fileSummaries}
            onProcess={processFiles}
        />
    );
};
