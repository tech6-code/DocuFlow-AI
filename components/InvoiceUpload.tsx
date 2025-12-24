
import React, { useRef, useState } from 'react';
import { PlusIcon, XMarkIcon, BrainIcon, TrashIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, SparklesIcon } from './icons';
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
    onProcess
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      // Combine with existing files, preventing duplicates
      const combinedFiles = [...selectedFiles];
      // Fix: Explicitly type `newFile` as `File` to resolve type inference issues from Array.from(e.target.files).
      newFiles.forEach((newFile: File) => {
        if (!combinedFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)) {
            combinedFiles.push(newFile);
        }
      });
      onFilesSelect(combinedFiles);
    }
  };

  const handleRemoveFile = (fileToRemove: File) => {
    onFilesSelect(selectedFiles.filter(file => file !== fileToRemove));
  };

  const handleAddFilesClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-3 flex flex-col gap-6">
            {showCompanyFields && onCompanyNameChange && onCompanyTrnChange && (
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
            )}

            <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-lg font-semibold flex items-center text-white">
                            Documents
                            <span className="ml-2 text-sm font-bold bg-gray-700 text-gray-300 rounded-full px-2 py-0.5">
                                {selectedFiles.length}
                            </span>
                        </h3>
                        <p className="text-gray-400 text-sm">{pageConfig.subtitle}</p>
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
                        className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        {pageConfig.uploadButtonText || 'Add Files'}
                    </button>
                </div>

                <div className="mb-4">
                    <div className="relative">
                        <LockClosedIcon className="w-5 h-5 text-gray-500 absolute top-1/2 left-3 -translate-y-1/2" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={pdfPassword}
                            onChange={(e) => onPasswordChange(e.target.value)}
                            placeholder="Enter password for protected PDFs"
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
                
                <div className="border border-gray-700 rounded-lg p-2 min-h-[8rem] bg-gray-800 mb-4">
                    {selectedFiles.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                             <p className="text-gray-500 text-sm">No files yet.</p>
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {selectedFiles.map((file, index) => (
                                <li key={index} className="flex items-center justify-between bg-gray-900 p-2 border border-gray-700 rounded-md shadow-sm">
                                    <span className="text-sm text-gray-300 truncate pr-2">{file.name}</span>
                                    <button 
                                        onClick={() => handleRemoveFile(file)}
                                        className="p-1 rounded-full hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
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
                        className="w-full flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors text-sm shadow-md"
                    >
                        <SparklesIcon className="w-4 h-4 mr-2" />
                        Process {selectedFiles.length} Invoices
                    </button>
                )}
            </div>

            {showCompanyFields && knowledgeBase && onRemoveFromKnowledgeBase && (
                <div className="bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold flex items-center mb-4 text-white">
                        <BrainIcon className="w-6 h-6 mr-3 text-gray-300"/>
                        Invoice Knowledge Base
                        <span className="ml-2 text-sm font-bold bg-gray-700 text-gray-300 rounded-full px-2 py-0.5">
                            {knowledgeBase.length}
                        </span>
                    </h3>
                    {knowledgeBase.length === 0 ? (
                        <p className="text-sm text-gray-400">Your knowledge base is empty. After processing invoices, add them here to improve future AI accuracy.</p>
                    ) : (
                        <div className="space-y-2">
                             <p className="text-sm text-gray-400 mb-4">The AI will use these learned invoices as examples to better understand your document layouts.</p>
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2">
                                {knowledgeBase.map((invoice, index) => (
                                    <li key={index} className="flex items-center justify-between bg-gray-800 p-2 border border-gray-700 rounded-md">
                                        <div className="truncate pr-2">
                                            <p className="text-sm font-medium text-white truncate">{invoice.vendorName}</p>
                                            <p className="text-xs text-gray-400 truncate">ID: {invoice.invoiceId}</p>
                                        </div>
                                        <button 
                                            onClick={() => onRemoveFromKnowledgeBase(invoice.invoiceId, invoice.vendorName)}
                                            className="p-1.5 rounded-full hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
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
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-sm aspect-[4/5] flex items-center justify-center">
                <p className="text-gray-500">Select a file to preview</p>
            </div>
        </div>
    </div>
  );
};
