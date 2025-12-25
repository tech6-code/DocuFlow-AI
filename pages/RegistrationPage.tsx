import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { extractProjectDocuments } from '../services/geminiService';
import { ExtractedDataObject, Company } from '../types';
import { convertFileToParts } from '../utils/fileUtils';

// UI Components
import { CtCompanyList } from '../components/CtCompanyList';
import { VatFilingUpload } from '../components/VatFilingUpload';
import { GenericResults } from '../components/GenericResults';
import { ChevronLeftIcon } from '../components/icons';

export const RegistrationPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { projectCompanies, addHistoryItem } = useData();

    const [appState, setAppState] = useState<'initial' | 'loading' | 'success' | 'error'>('initial');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [extractedData, setExtractedData] = useState<ExtractedDataObject[]>([]);
    const [progress, setProgress] = useState(0);
    const [progressMessage, setProgressMessage] = useState('');

    const handleReset = useCallback(() => {
        setAppState('initial'); setSelectedFiles([]); setExtractedData([]);
    }, []);

    const processFiles = useCallback(async () => {
        setAppState('loading'); setProgress(20); setProgressMessage('Analyzing registration documents...');
        try {
            let allParts = [];
            for (const file of selectedFiles) allParts.push(...(await convertFileToParts(file)));
            const res = await extractProjectDocuments(allParts, selectedCompany?.name || '', selectedCompany?.trn || '');
            const localExtracted: ExtractedDataObject[] = [
                ...res.emiratesIds.map(d => ({ documentType: 'Emirates ID', documentTitle: d.name, data: d })),
                ...res.tradeLicenses.map(d => ({ documentType: 'Trade License', documentTitle: d.companyName, data: d }))
            ];
            setExtractedData(localExtracted); setAppState('success');
            addHistoryItem({
                id: Date.now().toString(), type: 'Registration', title: `Registration - ${selectedCompany?.name}`, processedAt: new Date().toISOString(), pageCount: selectedFiles.length, processedBy: currentUser?.name || 'User',
                extractedData: localExtracted
            });
        } catch (e: any) { setAppState('error'); }
    }, [selectedFiles, selectedCompany, currentUser, addHistoryItem]);

    if (!selectedCompany) return <CtCompanyList companies={projectCompanies} onSelectCompany={setSelectedCompany} title="Select Company for Registration" />;
    if (appState === 'loading') return <div className="flex items-center justify-center h-full"><LoadingIndicator progress={progress} statusText={progressMessage} /></div>;

    if (appState === 'success') {
        return (
            <div className="space-y-8">
                <button onClick={handleReset} className="text-sm text-gray-400 hover:text-white flex items-center"><ChevronLeftIcon className="w-4 h-4 mr-1" /> Back</button>
                <GenericResults results={extractedData} />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Registration - {selectedCompany.name}</h2>
                <button onClick={() => setSelectedCompany(null)} className="text-sm text-gray-400 hover:text-white">Switch Company</button>
            </div>
            <VatFilingUpload
                invoiceFiles={selectedFiles} onInvoiceFilesSelect={setSelectedFiles}
                showStatementUpload={false} invoiceUploadTitle="Upload Registration Documents"
                onProcess={processFiles} companyName={selectedCompany.name} companyTrn={selectedCompany.trn}
            />
        </div>
    );
};

