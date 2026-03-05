import React, { useState, useCallback } from 'react';
import type { ExtractedDataObject } from '../types';
import {
    RefreshIcon,
    DocumentArrowDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClipboardIcon,
    ClipboardCheckIcon,
    IdentificationIcon,
    BriefcaseIcon,
    DocumentTextIcon,
} from './icons';
import { useData } from '../contexts/DataContext';

interface GenericResultsProps {
    data: ExtractedDataObject[];
    onReset: () => void;
    previewUrls: string[];
    title: string;
}

declare const XLSX: any;

const formatLabel = (key: string) => {
    const result = key.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
};

const getDocTypeIcon = (type: string) => {
    switch (type) {
        case 'Emirates ID':
        case 'Passport':
        case 'Visa':
            return <IdentificationIcon className="w-5 h-5 text-foreground" />;
        case 'Trade License':
            return <BriefcaseIcon className="w-5 h-5 text-foreground" />;
        default:
            return <DocumentTextIcon className="w-5 h-5 text-foreground" />;
    }
};

const DataCard: React.FC<{ document: ExtractedDataObject }> = ({ document }) => {
    return (
        <div className="bg-muted rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 bg-muted border-b border-border flex items-center space-x-3">
                <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-muted rounded-lg ring-1 ring-gray-600">
                    {getDocTypeIcon(document.documentType)}
                </div>
                <div>
                    <h3 className="font-semibold text-foreground">{document.documentType}</h3>
                    <p className="text-sm text-muted-foreground">{document.documentTitle}</p>
                </div>
            </div>
            <div className="p-4">
                <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6 text-sm">
                    {Object.entries(document.data).map(([key, value]) => (
                        <div key={key}>
                            <dt className="font-semibold text-muted-foreground">{formatLabel(key)}</dt>
                            <dd className="text-foreground mt-1 whitespace-pre-wrap">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
            </div>
        </div>
    );
};

export const GenericResults: React.FC<GenericResultsProps> = ({ data, onReset, previewUrls, title }) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [copied, setCopied] = useState(false);
    const { hasPermission } = useData();

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, previewUrls.length - 1));
    };

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 0));
    };

    const getExportPermissionId = useCallback(() => {
        if (!data || data.length === 0) return '';
        const docType = data[0].documentType;
        switch (docType) {
            case 'Emirates ID':
            case 'Passport':
            case 'Visa':
                return 'official-ids:export';
            case 'Trade License':
                return 'business-documents:export';
            default:
                return '';
        }
    }, [data]);

    const handleExportExcel = useCallback(() => {
        const workbook = XLSX.utils.book_new();

        data.forEach((doc, index) => {
            const docData = Object.entries(doc.data).map(([key, value]) => [
                formatLabel(key),
                Array.isArray(value) ? value.join(', ') : value
            ]);

            const worksheet = XLSX.utils.aoa_to_sheet([["Field", "Value"], ...docData]);
            worksheet['!cols'] = [{ wch: 30 }, { wch: 50 }];

            // Fix: Ensure the sheet name is always a string by wrapping the expression with `String()`.
            // This prevents a runtime error from calling .slice() on a number if the document title is empty.
            const safeSheetName = `${doc.documentType.slice(0, 15)}_${String(doc.documentTitle.replace(/[^a-zA-Z0-9]/g, '') || index + 1).slice(0, 10)}`;
            XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
        });

        XLSX.writeFile(workbook, `${title.replace(/\s/g, '_')}_Export.xlsx`);
    }, [data, title]);

    const copyToClipboard = useCallback(() => {
        try {
            const textToCopy = JSON.stringify(data.map(d => d.data), null, 2);
            navigator.clipboard.writeText(textToCopy).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } catch (e) {
            console.error("Failed to copy to clipboard", e);
        }
    }, [data]);

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h2 className="text-3xl font-bold text-foreground text-center sm:text-left">Extraction Complete</h2>
                <div className="flex items-center flex-wrap justify-center gap-3">
                    {hasPermission(getExportPermissionId()) && (
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center px-4 py-2 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                            Export XLSX
                        </button>
                    )}
                    <button
                        onClick={copyToClipboard}
                        className="flex items-center px-4 py-2 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm"
                    >
                        {copied ? <ClipboardCheckIcon className="w-5 h-5 mr-2 text-green-400" /> : <ClipboardIcon className="w-5 h-5 mr-2" />}
                        {copied ? 'Copied!' : 'Copy JSON'}
                    </button>
                    <button
                        onClick={onReset}
                        className="flex items-center px-4 py-2 bg-card text-foreground font-semibold rounded-lg hover:bg-muted transition-colors text-sm shadow-sm"
                    >
                        <RefreshIcon className="w-5 h-5 mr-2" />
                        Start Over
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-base font-semibold text-muted-foreground">Document Preview</h3>
                        {previewUrls.length > 1 && (
                            <span className="text-sm text-muted-foreground font-mono">
                                {currentPage + 1} / {previewUrls.length}
                            </span>
                        )}
                    </div>
                    <div className="p-2 bg-background rounded-lg relative shadow-sm border border-border">
                        <img src={previewUrls[currentPage]} alt={`Document Preview Page ${currentPage + 1}`} className="rounded-md object-contain max-h-[70vh] w-full" />
                        {previewUrls.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 0}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-muted rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === previewUrls.length - 1}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-muted rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    aria-label="Next page"
                                >
                                    <ChevronRightIcon className="w-6 h-6" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {data.length > 0 ? (
                        data.map((doc, index) => <DataCard key={index} document={doc} />)
                    ) : (
                        <div className="bg-muted text-center p-8 rounded-lg border border-border shadow-sm">
                            <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Data Extracted</h3>
                            <p className="text-muted-foreground">The AI could not find any relevant data in the documents provided.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
