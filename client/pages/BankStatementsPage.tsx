import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { BankStatementUpload } from '../components/DocumentUploads';
import { TransactionTable } from '../components/TransactionTable';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { analyzeTransactions, extractTransactionsFromImage } from '../services/geminiService';
import { generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';
import { Transaction, BankStatementSummary, AnalysisResult, DocumentHistoryItem } from '../types';

// Helpers moved to utils/fileUtils.ts

export const BankStatementsPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { addHistoryItem } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [pdfPassword, setPdfPassword] = useState('');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Results
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<BankStatementSummary | null>(null);
    const [currency, setCurrency] = useState('AED');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

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

    const processFiles = async () => {
        setAppState('loading');
        setProgress(10);
        setProgressMessage('Processing documents...');
        try {
            let allParts: Part[] = [];
            for (const file of selectedFiles) {
                const parts = await convertFileToParts(file);
                allParts = [...allParts, ...parts];
            }
            setProgress(30);
            setProgressMessage('Analyzing with Gemini AI...');

            const result = await extractTransactionsFromImage(allParts);

            setTransactions(result.transactions);
            setSummary(result.summary);
            setCurrency(result.currency);

            setProgress(100);
            setAppState('success');

            const historyItem: DocumentHistoryItem = {
                id: Date.now().toString(),
                type: 'Bank Statements',
                title: `Statement - ${result.summary.accountNumber || 'Unknown'}`,
                processedAt: new Date().toISOString(),
                pageCount: selectedFiles.length,
                processedBy: currentUser?.name || 'User',
                transactions: result.transactions,
                summary: result.summary,
                currency: result.currency
            };
            addHistoryItem(historyItem);

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            setAppState('error');
        }
    };

    const handleAnalyze = async () => {
        if (transactions.length === 0) return;
        setIsAnalyzing(true);
        setAnalysisError(null);
        try {
            const result = await analyzeTransactions(transactions);
            setAnalysis(result.analysis);
            setTransactions(result.categorizedTransactions);
        } catch (err: any) {
            setAnalysisError(err.message || "Analysis failed");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const resetState = () => {
        setAppState('initial');
        setTransactions([]);
        setSummary(null);
        setAnalysis(null);
        setSelectedFiles([]);
        setPreviewUrls([]);
        setError(null);
    };

    if (appState === 'loading') {
        return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;
    }

    if (appState === 'success') {
        return <TransactionTable transactions={transactions} onReset={resetState} previewUrls={previewUrls} summary={summary} currency={currency} analysis={analysis} isAnalyzing={isAnalyzing} analysisError={analysisError} onAnalyze={handleAnalyze} />;
    }

    return (
        <>
            <BankStatementUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFiles[0]}
                previewUrls={previewUrls}
                pdfPassword={pdfPassword}
                onPasswordChange={setPdfPassword}
                onProcess={() => setIsConfirmModalOpen(true)}
            />
            <ConfirmationDialog isOpen={isConfirmModalOpen} onConfirm={() => { setIsConfirmModalOpen(false); processFiles(); }} onCancel={() => setIsConfirmModalOpen(false)} title="Start Processing?">
                Are you sure you want to process the selected files?
            </ConfirmationDialog>
        </>
    );
};
