import React, { useRef, useState, useCallback } from 'react';
import { PlusIcon, XMarkIcon, BanknotesIcon, DocumentTextIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, FolderIcon, SparklesIcon } from './icons';

interface VatFilingUploadProps {
    onInvoiceFilesSelect: (files: File[]) => void;
    invoiceFiles: File[];
    onStatementFilesSelect?: (files: File[]) => void;
    statementFiles?: File[];
    pdfPassword: string;
    onPasswordChange: (password: string) => void;
    companyName: string;
    onCompanyNameChange: (name: string) => void;
    companyTrn: string;
    onCompanyTrnChange: (trn: string) => void;
    invoiceUploadTitle?: string;
    invoiceUploadSubtitle?: string;
    statementUploadTitle?: string;
    statementUploadSubtitle?: string;
    showInvoiceUpload?: boolean;
    showStatementUpload?: boolean;
    onProcess?: () => void;
}

export interface FileUploadAreaProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    selectedFiles: File[];
    onFilesSelect: (files: File[]) => void;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({ title, subtitle, icon, selectedFiles, onFilesSelect }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            const combined = [...selectedFiles];
            newFiles.forEach((newFile: File) => {
                if (!combined.some(f => f.name === newFile.name && f.size === newFile.size)) {
                    combined.push(newFile);
                }
            });
            onFilesSelect(combined);
        }
    };

    const handleRemoveFile = (fileToRemove: File) => {
        onFilesSelect(selectedFiles.filter(f => f !== fileToRemove));
    };
    
    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files);
            const combined = [...selectedFiles];
            newFiles.forEach((newFile: File) => {
                if (!combined.some(f => f.name === newFile.name && f.size === newFile.size)) {
                    combined.push(newFile);
                }
            });
            onFilesSelect(combined);
        }
    }, [selectedFiles, onFilesSelect]);


    return (
        <div 
            className="bg-[#0F172A] p-6 rounded-2xl border border-gray-800 shadow-sm flex flex-col h-full"
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <div className="flex justify-between items-start mb-6">
                <div className="flex items-start gap-4">
                    <div className="mt-1 text-gray-400">{icon}</div>
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center">
                            {title}
                            <span className="ml-3 text-xs font-bold bg-gray-800 text-gray-400 rounded-full px-2.5 py-1 min-w-[24px] text-center">
                                {selectedFiles.length}
                            </span>
                        </h3>
                        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                    </div>
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
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center px-4 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors text-xs shadow-sm flex-shrink-0 border border-gray-700"
                >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Files
                </button>
            </div>
            <div className="border border-gray-800 rounded-xl p-4 min-h-[14rem] bg-[#0A0F1D]/80 flex-1 flex flex-col">
                {selectedFiles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-lg p-6 group hover:border-gray-600 transition-colors">
                         <DocumentTextIcon className="w-10 h-10 text-gray-700 mb-4 group-hover:text-gray-500 transition-colors" />
                         <p className="text-gray-500 text-sm text-center max-w-[200px]">Drag & drop files here or click "Add Files"</p>
                    </div>
                ) : (
                    <ul className="space-y-2 h-full overflow-y-auto pr-1 custom-scrollbar">
                        {selectedFiles.map((file, index) => (
                            <li key={index} className="flex items-center justify-between bg-gray-900/50 p-3 border border-gray-800 rounded-lg shadow-sm group">
                                <div className="flex items-center min-w-0">
                                    <DocumentTextIcon className="w-4 h-4 text-gray-500 mr-3 flex-shrink-0" />
                                    <span className="text-sm text-gray-300 truncate">{file.name}</span>
                                </div>
                                <button 
                                    onClick={() => handleRemoveFile(file)}
                                    className="p-1 rounded-md hover:bg-red-900/20 text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                    aria-label={`Remove ${file.name}`}
                                >
                                    <XMarkIcon className="w-4 h-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};


export const VatFilingUpload: React.FC<VatFilingUploadProps> = ({
    invoiceFiles,
    onInvoiceFilesSelect,
    statementFiles,
    onStatementFilesSelect,
    pdfPassword,
    onPasswordChange,
    companyName,
    onCompanyNameChange,
    companyTrn,
    onCompanyTrnChange,
    invoiceUploadTitle = "Invoices & Bills",
    invoiceUploadSubtitle,
    statementUploadTitle = "Bank Statements",
    statementUploadSubtitle,
    showInvoiceUpload = true,
    showStatementUpload = true,
    onProcess
}) => {
    const [showPassword, setShowPassword] = useState(false);
    
    const hasFiles = invoiceFiles.length > 0 || (statementFiles && statementFiles.length > 0);

    return (
         <div className="flex flex-col gap-8">
            <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-300 mb-1">Country</label>
                        <select id="country" className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white focus:ring-2 focus:ring-white focus:border-white outline-none transition cursor-not-allowed" disabled>
                            <option>UAE</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
                        <input type="text" id="companyName" placeholder="Enter your company name" value={companyName} onChange={(e) => onCompanyNameChange(e.target.value)} className="w-full p-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none transition" />
                    </div>
                    <div>
                        <label htmlFor="companyTrn" className="block text-sm font-medium text-gray-300 mb-1">Company TRN</label>
                        <input type="text" id="companyTrn" placeholder="Enter your 15-digit TRN" value={companyTrn} onChange={(e) => onCompanyTrnChange(e.target.value)} className="w-full p-2 border border-gray-600 bg-gray-800 text-white rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none transition" />
                    </div>
                </div>
                 <p className="text-xs text-gray-500 mt-2">Providing your company name helps the AI accurately classify invoices as sales or purchases.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {showInvoiceUpload && (
                    <FileUploadArea
                        title={invoiceUploadTitle}
                        subtitle={invoiceUploadSubtitle}
                        icon={<DocumentTextIcon className="w-6 h-6 mr-1" />}
                        selectedFiles={invoiceFiles}
                        onFilesSelect={onInvoiceFilesSelect}
                    />
                )}
                {showStatementUpload && statementFiles && onStatementFilesSelect && (
                    <FileUploadArea
                        title={statementUploadTitle}
                        subtitle={statementUploadSubtitle}
                        icon={<BanknotesIcon className="w-6 h-6 mr-1" />}
                        selectedFiles={statementFiles}
                        onFilesSelect={onStatementFilesSelect}
                    />
                )}
                 {!showInvoiceUpload && !showStatementUpload && (
                     <FileUploadArea
                        title="Project Documents"
                        icon={<FolderIcon className="w-6 h-6 mr-1" />}
                        selectedFiles={invoiceFiles}
                        onFilesSelect={onInvoiceFilesSelect}
                    />
                 )}
            </div>
            
             <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
                <label htmlFor="pdfPassword" className="block text-sm font-medium text-gray-300 mb-2">PDF Password (Optional)</label>
                <div className="relative">
                    <LockClosedIcon className="w-5 h-5 text-gray-500 absolute top-1/2 left-3 -translate-y-1/2" />
                    <input
                        id="pdfPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={pdfPassword}
                        onChange={(e) => onPasswordChange(e.target.value)}
                        placeholder="Enter password for any protected PDFs"
                        className="w-full pl-10 pr-10 py-2 border border-gray-600 rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none transition bg-gray-800 text-white"
                        aria-label="PDF password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Provide a password if any of the uploaded PDFs are encrypted.</p>
            </div>

            {hasFiles && onProcess && (
                <div className="flex justify-end pt-4">
                    <button
                        onClick={onProcess}
                        className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        Start Processing
                    </button>
                </div>
            )}
         </div>
    );
};