import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { GenericResults } from '../components/GenericResults';
import { extractDataFromImage } from '../services/geminiService';


import { DocumentHistoryItem, ExtractedDataObject } from '../types';

import { generatePreviewUrls, convertFileToParts, Part } from '../utils/fileUtils';

// Helpers moved to utils/fileUtils.ts

interface GenericDocumentPageProps {
    documentType: string;
    // We pass the UploadComponent as a prop to keep it generic, but strictly typed it's hard. 
    // We can just use 'any' or better yet, define the shape.
    // However, different uploads have different props (e.g. some have date overrides).
    // For simplicity, I'll assume the component is passed or we just import them all and switch.
    // Let's pass the Component itself.
    UploadComponent: React.ComponentType<any>;
    title: string;
}

export const GenericDocumentPage: React.FC<GenericDocumentPageProps> = ({ documentType, UploadComponent, title }) => {
    const { currentUser } = useAuth();
    const { addHistoryItem } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

    // Results
    const [extractedData, setExtractedData] = useState<ExtractedDataObject[]>([]);

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
        setProgressMessage('Processing documents...');
        try {
            const results: ExtractedDataObject[] = [];
            let totalSteps = selectedFiles.length * 2;
            let currentStep = 0;

            for (const file of selectedFiles) {
                const parts = await convertFileToParts(file);
                currentStep++;
                setProgress(10 + (currentStep / totalSteps) * 80);
                setProgressMessage(`Analyzing ${file.name}...`);

                // Assuming documentType maps to prompt types in geminiService.
                // The service uses "Emirates ID", "Passport", "Visa", "Trade License".
                // We should pass the exact string needed by geminiService.
                const data = await extractDataFromImage(parts, documentType);

                results.push({
                    documentType: documentType,
                    documentTitle: file.name,
                    data: data
                });
            }

            setExtractedData(results);

            setProgress(100);
            setAppState('success');

            const historyItem: DocumentHistoryItem = {
                id: Date.now().toString(),
                type: documentType, // e.g. 'Emirates ID'
                title: `${documentType} Batch (${results.length})`,
                processedAt: new Date().toISOString(),
                pageCount: selectedFiles.length,
                processedBy: currentUser?.name || 'User',
                extractedData: results
            };
            addHistoryItem(historyItem);

        } catch (e: any) {
            console.error(e);
            alert(e.message || "Failed to process documents.");
            setAppState('error');
        }
    };

    const resetState = () => {
        setAppState('initial');
        setExtractedData([]);
        setSelectedFiles([]);
        setPreviewUrls([]);
    };

    if (appState === 'loading') {
        return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;
    }

    if (appState === 'success') {
        return <GenericResults data={extractedData} onReset={resetState} previewUrls={previewUrls} title={`${title} Results`} />;
    }

    return (
        <>
            <UploadComponent
                onFilesSelect={handleFileSelect} // Note: Check if UploadComponent expects 'onFilesSelect' or 'onFileSelect'. GenericDocumentPage assumes multiple.
                // EmiratesIdUpload uses onFilesSelect (plural)
                // PassportUpload uses onFilesSelect
                // VisaUpload uses onFilesSelect
                // TradeLicenseUpload uses onFilesSelect
                selectedFiles={selectedFiles}
                previewUrls={previewUrls}
                onProcess={() => setIsConfirmModalOpen(true)}
            />
            <ConfirmationDialog isOpen={isConfirmModalOpen} onConfirm={() => { setIsConfirmModalOpen(false); processFiles(); }} onCancel={() => setIsConfirmModalOpen(false)} title="Start Processing?">
                Are you sure you want to process {selectedFiles.length} documents?
            </ConfirmationDialog>
        </>
    );
};
