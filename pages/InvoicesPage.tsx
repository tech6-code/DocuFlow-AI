import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { InvoiceUpload } from '../components/InvoiceUpload';
import { InvoiceResults } from '../components/InvoiceResults';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { extractInvoicesData } from '../services/geminiService';


import { Invoice, DocumentHistoryItem } from '../types';

import { generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';

// Helpers moved to utils/fileUtils.ts

export const InvoicesPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { knowledgeBase, addToKnowledgeBase, addHistoryItem } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [pdfPassword, setPdfPassword] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyTrn, setCompanyTrn] = useState('');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Results
    const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
    const [purchaseInvoices, setPurchaseInvoices] = useState<Invoice[]>([]);

    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');

    const handleFileSelect = async (files: File[] | File | null) => {
        if (!files) { setSelectedFiles([]); setPreviewUrls([]); return; }
        const fileArray = Array.isArray(files) ? files : [files];
        setSelectedFiles(fileArray);
        const urls = await generatePreviewUrls(fileArray);
        setPreviewUrls(urls);
    };

    const processFiles = async () => {
        setAppState('loading');
        setProgress(10);
        setProgressMessage('Preparing invoices...');
        try {
            let allParts: Part[] = [];
            for (const file of selectedFiles) {
                const parts = await convertFileToParts(file);
                allParts = [...allParts, ...parts];
            }
            setProgress(30);
            setProgressMessage('Extracting data with Gemini AI...');

            const result = await extractInvoicesData(allParts, knowledgeBase, companyName, companyTrn);

            const sales = result.invoices.filter(i => i.invoiceType === 'sales');
            const purchases = result.invoices.filter(i => i.invoiceType === 'purchase');

            setSalesInvoices(sales);
            setPurchaseInvoices(purchases);

            setProgress(100);
            setAppState('success');

            const historyItem: DocumentHistoryItem = {
                id: Date.now().toString(),
                type: 'Invoices & Bills',
                title: `Invoices Batch (${result.invoices.length})`,
                processedAt: new Date().toISOString(),
                pageCount: selectedFiles.length,
                processedBy: currentUser?.name || 'User',
                salesInvoices: sales,
                purchaseInvoices: purchases
            };
            addHistoryItem(historyItem);

        } catch (e: any) {
            console.error(e);
            alert(e.message || "Failed to process invoices.");
            setAppState('error');
        }
    };

    const resetState = () => {
        setAppState('initial');
        setSalesInvoices([]);
        setPurchaseInvoices([]);
        setSelectedFiles([]);
        setPreviewUrls([]);
    };

    if (appState === 'loading') {
        return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;
    }

    if (appState === 'success') {
        return <InvoiceResults invoices={[...salesInvoices, ...purchaseInvoices]} onReset={resetState} previewUrls={previewUrls} knowledgeBase={knowledgeBase} onAddToKnowledgeBase={addToKnowledgeBase} onUpdateInvoice={() => { }} />;
    }

    return (
        <>
            <InvoiceUpload
                onFilesSelect={handleFileSelect}
                selectedFiles={selectedFiles}
                showCompanyFields={true}
                pageConfig={{ title: 'Invoices & Bills', subtitle: 'Upload invoices for analysis', uploadButtonText: 'Add Invoices' }}
                knowledgeBase={knowledgeBase}
                pdfPassword={pdfPassword}
                onPasswordChange={setPdfPassword}
                companyName={companyName}
                onCompanyNameChange={setCompanyName}
                companyTrn={companyTrn}
                onCompanyTrnChange={setCompanyTrn}
                onProcess={() => setIsConfirmModalOpen(true)}
            />
            <ConfirmationDialog isOpen={isConfirmModalOpen} onConfirm={() => { setIsConfirmModalOpen(false); processFiles(); }} onCancel={() => setIsConfirmModalOpen(false)} title="Start Processing?">
                Are you sure you want to process {selectedFiles.length} files?
            </ConfirmationDialog>
        </>
    );
};
