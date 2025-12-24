
import React, { useState, useEffect } from 'react';
import type { Transaction, Invoice, BankStatementSummary, ExtractedDataObject, Page, TrialBalanceEntry, FinancialStatements, Company } from '../types';
import { LoadingIndicator } from './LoadingIndicator';
import { CtFilingTypeSelection } from './CtFilingTypeSelection';
import { CtFilingDashboard } from './CtFilingDashboard';
import { VatFilingDashboard } from './VatFilingDashboard';
import { VatFilingUpload } from './VatFilingUpload';
import { CtType1Results } from './CtType1Results';
import { CtType2Results } from './CtType2Results';
import { CtType3Results } from './CtType3Results';
import { CtCompanyList } from './CtCompanyList';
import { InvoiceResults } from './InvoiceResults';
import { TransactionTable } from './TransactionTable'; // Corrected import path
import { ReconciliationTable } from './ReconciliationTable';
import { ChevronLeftIcon } from './icons';
import { generatePreviewUrls } from '../utils/fileUtils';

interface ProjectPageProps {
    appState: 'initial' | 'loading' | 'success' | 'error';
    handleReset: () => void;
    transactions: Transaction[];
    salesInvoices: Invoice[];
    purchaseInvoices: Invoice[];
    summary: BankStatementSummary | null;
    currency: string;
    previewUrls: string[];
    knowledgeBase: Invoice[];
    onAddToKnowledgeBase: (invoice: Invoice) => void;
    onRemoveFromKnowledgeBase: (invoiceId: string, vendorName: string) => void;
    error: string | null;
    progress: number;
    progressMessage: string;
    onFilesSelect: (files: File[]) => void;
    selectedFiles: File[];
    pdfPassword: string;
    onPasswordChange: (password: string) => void;
    companyName: string;
    onCompanyNameChange: (name: string) => void;
    companyTrn: string;
    onCompanyTrnChange: (trn: string) => void;
    pageConfig: { title: string; subtitle: string; uploadButtonText?: string };
    extractedData: ExtractedDataObject[];
    vatInvoiceFiles: File[];
    onVatInvoiceFilesSelect: (files: File[]) => void;
    vatStatementFiles: File[];
    onVatStatementFilesSelect: (files: File[]) => void;
    ctFilingType: number | null;
    onCtFilingTypeSelect: (type: number | null) => void;
    onUpdateTransactionCategory: (index: number, category: string) => void;
    onSuggestCategory: () => void;
    isSuggestingCategory: boolean;
    suggestionError: string | null;
    onGenerateTrialBalance: (transactions: Transaction[]) => void;
    onGenerateAuditReport: (trialBalance: TrialBalanceEntry[], companyName: string) => void;
    onUpdateProjectTransactions: (transactions: Transaction[]) => void;
    trialBalance: TrialBalanceEntry[] | null;
    auditReport: FinancialStatements | null;
    isGeneratingTrialBalance: boolean;
    isGeneratingAuditReport: boolean;
    reportsError: string | null;
    companies: Company[];
    selectedCompany: Company | null;
    onAddCompany: (company: Omit<Company, 'id'>) => void;
    onSelectCompany: (company: Company | null) => void;
    onUpdateSalesInvoice: (index: number, invoice: Invoice) => void;
    onUpdatePurchaseInvoice: (index: number, invoice: Invoice) => void;
    fileSummaries: Record<string, BankStatementSummary>;
    onProcess?: () => void;
    onPeriodSelect?: (start: string, end: string) => void;
}

export const ProjectPage: React.FC<ProjectPageProps> = (props) => {
    const {
        appState,
        selectedCompany,
        onSelectCompany,
        onAddCompany,
        companies,
        pageConfig,
        ctFilingType,
        onCtFilingTypeSelect,
        handleReset,
        transactions,
        salesInvoices,
        purchaseInvoices,
        onUpdateProjectTransactions,
        onUpdateSalesInvoice,
        onUpdatePurchaseInvoice,
        knowledgeBase,
        onAddToKnowledgeBase,
        vatStatementFiles,
        vatInvoiceFiles,
        onProcess,
        onPeriodSelect,
        onVatInvoiceFilesSelect, // Destructure missing prop
        pdfPassword, // Destructure missing prop
        onPasswordChange, // Destructure missing prop
        onCompanyNameChange, // Destructure missing prop
        onCompanyTrnChange // Destructure missing prop
    } = props;

    const [viewMode, setViewMode] = useState<'dashboard' | 'upload'>('dashboard');
    const [statementPreviewUrls, setStatementPreviewUrls] = useState<string[]>([]);
    const [invoicePreviewUrls, setInvoicePreviewUrls] = useState<string[]>([]);

    const isCt = pageConfig.title === 'Corporate Tax Filing';
    const isVat = pageConfig.title === 'VAT Filing';

    // Generate previews when success state is reached and files exist
    useEffect(() => {
        if (appState === 'success') {
            // Generate Statement Previews
            if (vatStatementFiles && vatStatementFiles.length > 0) {
                generatePreviewUrls(vatStatementFiles).then(setStatementPreviewUrls);
            }
            // Generate Invoice Previews
            if (vatInvoiceFiles && vatInvoiceFiles.length > 0) {
                generatePreviewUrls(vatInvoiceFiles).then(setInvoicePreviewUrls);
            }
        }
    }, [appState, vatStatementFiles, vatInvoiceFiles]);

    const handleLocalReset = () => {
        setViewMode('dashboard');
        setStatementPreviewUrls([]);
        setInvoicePreviewUrls([]);
        handleReset();
    };

    const handleStartFiling = (start: string, end: string) => {
        onPeriodSelect?.(start, end);
        setViewMode('upload');
    };

    if (!selectedCompany) {
        return <CtCompanyList
            companies={companies}
            onSelectCompany={onSelectCompany}
            title={pageConfig.title === 'Corporate Tax Filing' ? 'Select Company for CT Filing' : 'Select Company'}

        />;
    }

    if (appState === 'loading') {
        return (
            <div className="flex items-center justify-center h-full">
                <LoadingIndicator progress={props.progress} statusText={props.progressMessage} />
            </div>
        );
    }

    if (appState === 'error') {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="text-red-500 mb-4 text-lg font-semibold">Error Processing Documents</div>
                <p className="text-gray-400 mb-6 max-w-md">{props.error}</p>
                <button onClick={handleLocalReset} className="px-5 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200">Try Again</button>
            </div>
        );
    }

    // After loading, if there is no Ct Filing type, redirect to select one.
    if (isCt && appState === 'success' && !ctFilingType) {
        return (
            <CtFilingTypeSelection
                onSelectType={onCtFilingTypeSelect}
                onBack={() => { setViewMode('dashboard'); handleLocalReset(); }}
            />
        );
    }

    if (appState === 'success') {
        if (isCt && ctFilingType === 1) {
            return <CtType1Results
                transactions={transactions}
                trialBalance={props.trialBalance}
                auditReport={props.auditReport}
                isGeneratingTrialBalance={props.isGeneratingTrialBalance}
                isGeneratingAuditReport={props.isGeneratingAuditReport}
                reportsError={props.reportsError}
                onUpdateTransactions={onUpdateProjectTransactions}
                onGenerateTrialBalance={props.onGenerateTrialBalance}
                onGenerateAuditReport={props.onGenerateAuditReport}
                currency={props.currency}
                companyName={selectedCompany.name}
                onReset={handleLocalReset}
                summary={props.summary}
                previewUrls={statementPreviewUrls} // Pass local statement previews
                company={selectedCompany}
                fileSummaries={props.fileSummaries}
                statementFiles={props.vatStatementFiles}
            />
        }

        if (isCt && ctFilingType === 2) {
            return <CtType2Results
                appState={appState} // Pass missing prop
                transactions={transactions}
                salesInvoices={salesInvoices}
                purchaseInvoices={purchaseInvoices}
                trialBalance={props.trialBalance}
                auditReport={props.auditReport}
                isGeneratingTrialBalance={props.isGeneratingTrialBalance}
                isGeneratingAuditReport={props.isGeneratingAuditReport}
                reportsError={props.reportsError}
                onUpdateTransactions={onUpdateProjectTransactions}
                onGenerateTrialBalance={props.onGenerateTrialBalance}
                onGenerateAuditReport={props.onGenerateAuditReport}
                currency={props.currency}
                companyName={selectedCompany.name}
                onReset={handleLocalReset}
                summary={props.summary}
                previewUrls={statementPreviewUrls} // Pass local statement previews
                company={selectedCompany}
                fileSummaries={props.fileSummaries}
                statementFiles={props.vatStatementFiles}
                invoiceFiles={props.vatInvoiceFiles}
                onVatInvoiceFilesSelect={onVatInvoiceFilesSelect} // Pass missing prop
                pdfPassword={pdfPassword} // Pass missing prop
                onPasswordChange={onPasswordChange} // Pass missing prop
                onCompanyNameChange={onCompanyNameChange} // Pass missing prop
                onCompanyTrnChange={onCompanyTrnChange} // Pass missing prop
                onProcess={onProcess} // Pass missing prop
            />
        }

        if (isCt && ctFilingType === 3) {
            return <CtType3Results
                trialBalance={props.trialBalance}
                auditReport={props.auditReport}
                isGeneratingTrialBalance={props.isGeneratingTrialBalance}
                isGeneratingAuditReport={props.isGeneratingAuditReport}
                reportsError={props.reportsError}
                onGenerateTrialBalance={props.onGenerateTrialBalance}
                onGenerateAuditReport={props.onGenerateAuditReport}
                currency={props.currency}
                companyName={selectedCompany.name}
                onReset={handleLocalReset}
                company={selectedCompany}
            />
        }

        // Generic Result View
        return (
            <div className="space-y-8">
                <div className="flex justify-between items-center">
                    <button onClick={handleLocalReset} className="text-sm text-gray-400 hover:text-white flex items-center transition-colors">
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Dashboard
                    </button>
                    <h2 className="text-xl font-bold text-white">{pageConfig.title} Results - {selectedCompany.name}</h2>
                </div>

                {transactions.length > 0 && (
                    <TransactionTable
                        transactions={transactions}
                        onReset={() => { }}
                        previewUrls={statementPreviewUrls.length > 0 ? statementPreviewUrls : props.previewUrls}
                        summary={props.summary}
                        currency={props.currency}
                        analysis={null}
                        isAnalyzing={false}
                        analysisError={null}
                        onAnalyze={() => { }}
                    />
                )}

                {(salesInvoices.length > 0 || purchaseInvoices.length > 0) && transactions.length > 0 && (
                    <ReconciliationTable
                        invoices={[...salesInvoices, ...purchaseInvoices]}
                        transactions={transactions}
                        currency={props.currency}
                    />
                )}

                {(salesInvoices.length > 0 || purchaseInvoices.length > 0) && (
                    <InvoiceResults
                        invoices={[...salesInvoices, ...purchaseInvoices]}
                        onReset={() => { }}
                        previewUrls={invoicePreviewUrls.length > 0 ? invoicePreviewUrls : props.previewUrls}
                        knowledgeBase={knowledgeBase}
                        onAddToKnowledgeBase={onAddToKnowledgeBase}
                        onUpdateInvoice={(index, invoice) => {
                            if (invoice.invoiceType === 'sales') {
                                const sIndex = salesInvoices.findIndex(i => i.invoiceId === invoice.invoiceId);
                                if (sIndex >= 0) onUpdateSalesInvoice(sIndex, invoice);
                            } else {
                                const pIndex = purchaseInvoices.findIndex(i => i.invoiceId === invoice.invoiceId);
                                if (pIndex >= 0) onUpdatePurchaseInvoice(pIndex, invoice);
                            }
                        }}
                    />
                )}
            </div>
        );
    }

    // Dashboard View
    if (viewMode === 'dashboard') {
        if (isCt) {
            return <CtFilingDashboard
                company={selectedCompany}
                onNewFiling={handleStartFiling}
                onBack={() => onSelectCompany(null)}
            />;
        }
        if (isVat) {
            return <VatFilingDashboard
                company={selectedCompany}
                onNewFiling={handleStartFiling}
                onContinueFiling={handleStartFiling}
                onBack={() => onSelectCompany(null)}
            />;
        }
        return (
            <div className="text-center py-10">
                <h2 className="text-2xl text-white mb-4">{pageConfig.title}</h2>
                <p className="text-gray-400 mb-6">Manage your {pageConfig.title.toLowerCase()} for {selectedCompany.name}</p>
                <div className="space-x-4">
                    <button onClick={() => onSelectCompany(null)} className="px-6 py-3 bg-gray-700 text-white rounded-lg">Switch Company</button>
                    <button onClick={() => setViewMode('upload')} className="px-6 py-3 bg-blue-600 text-white rounded-lg">Start New Session</button>
                </div>
            </div>
        );
    }

    // Upload View
    if (viewMode === 'upload') {
        if (isCt) {
            if (!ctFilingType) {
                return <CtFilingTypeSelection
                    onSelectType={onCtFilingTypeSelect}
                    onBack={() => setViewMode('dashboard')}
                />;
            }

            if (ctFilingType === 1) {
                return (
                    <div className="space-y-6">
                        <button onClick={() => { onCtFilingTypeSelect(null); setViewMode('dashboard'); }} className="text-gray-400 hover:text-white flex items-center text-sm"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
                        <h2 className="text-xl font-bold text-white">Upload Bank Statements</h2>
                        <VatFilingUpload
                            invoiceFiles={[]}
                            onInvoiceFilesSelect={() => { }}
                            statementFiles={props.vatStatementFiles}
                            onStatementFilesSelect={props.onVatStatementFilesSelect}
                            pdfPassword={props.pdfPassword}
                            onPasswordChange={props.onPasswordChange}
                            companyName={selectedCompany.name}
                            onCompanyNameChange={props.onCompanyNameChange}
                            companyTrn={selectedCompany.trn}
                            onCompanyTrnChange={props.onCompanyTrnChange}
                            showInvoiceUpload={false}
                            statementUploadTitle="Bank Statements"
                            onProcess={onProcess}
                        />
                    </div>
                );
            }

            return (
                <div className="space-y-6">
                    <button onClick={() => { onCtFilingTypeSelect(null); setViewMode('dashboard'); }} className="text-gray-400 hover:text-white flex items-center text-sm"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
                    <VatFilingUpload
                        invoiceFiles={props.vatInvoiceFiles}
                        onInvoiceFilesSelect={props.onVatInvoiceFilesSelect}
                        statementFiles={props.vatStatementFiles}
                        onStatementFilesSelect={props.onVatStatementFilesSelect}
                        pdfPassword={props.pdfPassword}
                        onPasswordChange={props.onPasswordChange}
                        companyName={selectedCompany.name}
                        onCompanyNameChange={props.onCompanyNameChange}
                        companyTrn={selectedCompany.trn}
                        onCompanyTrnChange={props.onCompanyTrnChange}
                        showInvoiceUpload={ctFilingType === 2} // Type 3 bypassed upload via App.tsx, Type 2 needs invoices
                        showStatementUpload={ctFilingType === 2}
                        onProcess={onProcess}
                    />
                </div>
            );
        }

        if (isVat) {
            return (
                <div className="space-y-6">
                    <button onClick={() => setViewMode('dashboard')} className="text-gray-400 hover:text-white flex items-center text-sm"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Dashboard</button>
                    <VatFilingUpload
                        invoiceFiles={props.vatInvoiceFiles}
                        onInvoiceFilesSelect={props.onVatInvoiceFilesSelect}
                        statementFiles={props.vatStatementFiles}
                        onStatementFilesSelect={props.onVatStatementFilesSelect}
                        pdfPassword={props.pdfPassword}
                        onPasswordChange={props.onPasswordChange}
                        companyName={selectedCompany.name}
                        onCompanyNameChange={props.onCompanyNameChange}
                        companyTrn={selectedCompany.trn}
                        onCompanyTrnChange={props.onCompanyTrnChange}
                        onProcess={onProcess}
                    />
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <button onClick={() => setViewMode('dashboard')} className="text-gray-400 hover:text-white flex items-center text-sm"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
                <VatFilingUpload
                    invoiceFiles={props.selectedFiles}
                    onInvoiceFilesSelect={props.onFilesSelect}
                    showStatementUpload={false}
                    invoiceUploadTitle={pageConfig.uploadButtonText || "Upload Documents"}
                    pdfPassword={props.pdfPassword}
                    onPasswordChange={props.onPasswordChange}
                    companyName={selectedCompany.name}
                    onCompanyNameChange={props.onCompanyNameChange}
                    companyTrn={selectedCompany.trn}
                    onCompanyTrnChange={props.onCompanyTrnChange}
                    onProcess={onProcess}
                />
            </div>
        );
    }

    return null;
};
