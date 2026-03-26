
import React, { useRef, useState } from 'react';
import { PlusIcon, XMarkIcon, BrainIcon, TrashIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, SparklesIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';
import type { Invoice } from '../types';

interface InvoiceUploadProps {
    onFilesSelect: (files: File[]) => void;
    selectedFiles: File[];
    showCompanyFields: boolean;
    pageConfig: {
        title: string;
        subtitle: string;
        uploadButtonText: string;
    };
    knowledgeBase?: Invoice[];
    onRemoveFromKnowledgeBase?: (invoiceId: string, vendorName: string) => void;
    pdfPassword: string;
    onPasswordChange: (password: string) => void;
    companyName?: string;
    onCompanyNameChange?: (name: string) => void;
    companyTrn?: string;
    onCompanyTrnChange?: (trn: string) => void;
    onProcess?: () => void;
    previewUrls?: string[];
    pageCountPerFile?: number[];
}

export const InvoiceUpload: React.FC<InvoiceUploadProps> = ({
    onFilesSelect,
    selectedFiles,
    showCompanyFields,
    pageConfig,
    knowledgeBase,
    onRemoveFromKnowledgeBase,
    pdfPassword,
    onPasswordChange,
    companyName,
    onCompanyNameChange,
    companyTrn,
    onCompanyTrnChange,
    onProcess,
    previewUrls = [],
    pageCountPerFile = []
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);

    const getFileStartPage = (fileIndex: number): number => {
        let start = 0;
        for (let i = 0; i < fileIndex && i < pageCountPerFile.length; i++) {
            start += pageCountPerFile[i];
        }
        return start;
    };

    const getFileIndexForPage = (page: number): number => {
        let accumulated = 0;
        for (let i = 0; i < pageCountPerFile.length; i++) {
            accumulated += pageCountPerFile[i];
            if (page < accumulated) return i;
        }
        return 0;
    };

    const handleFileClick = (fileIndex: number) => {
        setSelectedFileIndex(fileIndex);
        setCurrentPage(getFileStartPage(fileIndex));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const combinedFiles = [...selectedFiles];
            newFiles.forEach((newFile: File) => {
                if (!combinedFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)) {
                    combinedFiles.push(newFile);
                }
            });
            onFilesSelect(combinedFiles);
            setCurrentPage(0);
            setSelectedFileIndex(0);
        }
    };

    const handleRemoveFile = (fileToRemove: File) => {
        onFilesSelect(selectedFiles.filter(file => file !== fileToRemove));
        setCurrentPage(0);
        setSelectedFileIndex(0);
    };

    const handleAddFilesClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 flex flex-col gap-6">
                {showCompanyFields && onCompanyNameChange && onCompanyTrnChange && (
                    <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="country" className="block text-sm font-medium text-foreground/80 mb-1">Country</label>
                                <select id="country" className="w-full p-2 border border-border rounded-md bg-muted text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition cursor-not-allowed" disabled>
                                    <option>UAE</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="companyName" className="block text-sm font-medium text-foreground/80 mb-1">Company Name</label>
                                <input type="text" id="companyName" placeholder="Enter your company name" value={companyName} onChange={(e) => onCompanyNameChange(e.target.value)} className="w-full p-2 border border-border bg-muted text-foreground rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
                            </div>
                            <div>
                                <label htmlFor="companyTrn" className="block text-sm font-medium text-foreground/80 mb-1">Company TRN</label>
                                <input type="text" id="companyTrn" placeholder="Enter your 15-digit TRN" value={companyTrn} onChange={(e) => onCompanyTrnChange(e.target.value)} className="w-full p-2 border border-border bg-muted text-foreground rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition" />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Providing your company name helps the AI accurately classify invoices as sales or purchases.</p>
                    </div>
                )}

                <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-lg font-semibold flex items-center text-foreground">
                                Documents
                                <span className="ml-2 text-sm font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                                    {selectedFiles.length}
                                </span>
                            </h3>
                            <p className="text-muted-foreground text-sm">{pageConfig.subtitle}</p>
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*,application/pdf"
                            multiple
                        />
                        <button
                            onClick={handleAddFilesClick}
                            className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" />
                            {pageConfig.uploadButtonText || 'Add Files'}
                        </button>
                    </div>

                    <div className="mb-4">
                        <div className="relative">
                            <LockClosedIcon className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={pdfPassword}
                                onChange={(e) => onPasswordChange(e.target.value)}
                                placeholder="Enter password for protected PDFs"
                                className="w-full pl-10 pr-10 py-2 border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-primary outline-none transition bg-muted text-foreground"
                                aria-label="PDF password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Provide a password if any of the uploaded PDFs are encrypted.</p>
                    </div>

                    <div className="border border-border rounded-lg p-2 min-h-[8rem] max-h-[24rem] overflow-y-auto bg-muted/50 mb-4 custom-scrollbar">
                        {selectedFiles.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground text-sm">No files yet.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {selectedFiles.map((file, index) => (
                                    <li
                                        key={index}
                                        onClick={() => handleFileClick(index)}
                                        className={`flex items-center justify-between p-2 border rounded-md shadow-sm cursor-pointer transition-colors ${
                                            selectedFileIndex === index
                                                ? 'bg-primary/10 border-primary ring-1 ring-primary/30'
                                                : 'bg-card border-border hover:bg-muted'
                                        }`}
                                    >
                                        <span className="text-sm text-foreground/80 truncate pr-2">{file.name}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(file); }}
                                            className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            aria-label={`Remove ${file.name}`}
                                        >
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {selectedFiles.length > 0 && onProcess && (
                        <button
                            onClick={onProcess}
                            className="w-full flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-sm shadow-md"
                        >
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            Process {selectedFiles.length} Invoices
                        </button>
                    )}
                </div>

                {showCompanyFields && knowledgeBase && onRemoveFromKnowledgeBase && (
                    <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                        <h3 className="text-lg font-semibold flex items-center mb-4 text-foreground">
                            <BrainIcon className="w-6 h-6 mr-3 text-muted-foreground" />
                            Invoice Knowledge Base
                            <span className="ml-2 text-sm font-bold bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                                {knowledgeBase.length}
                            </span>
                        </h3>
                        {knowledgeBase.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Your knowledge base is empty. After processing invoices, add them here to improve future AI accuracy.</p>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground mb-4">The AI will use these learned invoices as examples to better understand your document layouts.</p>
                                <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                    {knowledgeBase.map((invoice, index) => (
                                        <li key={index} className="flex items-center justify-between bg-muted/50 p-2 border border-border rounded-md">
                                            <div className="truncate pr-2">
                                                <p className="text-sm font-medium text-foreground truncate">{invoice.vendorName}</p>
                                                <p className="text-xs text-muted-foreground truncate">ID: {invoice.invoiceId}</p>
                                            </div>
                                            <button
                                                onClick={() => onRemoveFromKnowledgeBase(invoice.invoiceId, invoice.vendorName)}
                                                className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                                                aria-label={`Remove ${invoice.vendorName} invoice`}
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <div className="lg:col-span-2">
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm aspect-[4/5] flex items-center justify-center relative">
                    {previewUrls.length > 0 ? (
                        <>
                            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 px-2">
                                <h3 className="text-sm font-semibold text-foreground/80 drop-shadow-md">Preview</h3>
                                {previewUrls.length > 1 && (
                                    <span className="text-xs text-foreground bg-background/70 px-2 py-1 rounded-full backdrop-blur-sm font-mono border border-border">
                                        {currentPage + 1} / {previewUrls.length}
                                    </span>
                                )}
                            </div>
                            <img src={previewUrls[currentPage]} alt={`Page ${currentPage + 1}`} className="max-w-full max-h-full object-contain rounded-md" />
                            {previewUrls.length > 1 && (
                                <>
                                    <button
                                        onClick={() => {
                                            const newPage = Math.max(currentPage - 1, 0);
                                            setCurrentPage(newPage);
                                            setSelectedFileIndex(getFileIndexForPage(newPage));
                                        }}
                                        disabled={currentPage === 0}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-muted/70 rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeftIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            const newPage = Math.min(currentPage + 1, previewUrls.length - 1);
                                            setCurrentPage(newPage);
                                            setSelectedFileIndex(getFileIndexForPage(newPage));
                                        }}
                                        disabled={currentPage === previewUrls.length - 1}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-muted/70 rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        aria-label="Next page"
                                    >
                                        <ChevronRightIcon className="w-6 h-6" />
                                    </button>
                                </>
                            )}
                        </>
                    ) : (
                        <p className="text-muted-foreground">Select a file to preview</p>
                    )}
                </div>
            </div>
        </div>
    );
};
