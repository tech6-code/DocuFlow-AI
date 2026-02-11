import React, { useRef, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
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
    excelFiles?: File[];
    onExcelFilesSelect?: (files: File[]) => void;
    showExcelUpload?: boolean;
    excelUploadTitle?: string;
    onProcess?: () => void;
}

export interface FileUploadAreaProps {
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    selectedFiles: File[];
    onFilesSelect: (files: File[]) => void;
    accept?: string;
    extraAction?: React.ReactNode;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({ title, subtitle, icon, selectedFiles, onFilesSelect, accept, extraAction }) => {
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
            className="group relative bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-2xl flex flex-col h-full overflow-hidden transition-all duration-300 hover:bg-slate-900/60 hover:border-slate-600/50"
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {/* Gradient Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/50 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex justify-between items-start mb-6 z-10 relative">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/50 shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 text-blue-400 drop-shadow-md" })}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center tracking-tight">
                            {title}
                            {selectedFiles.length > 0 && (
                                <span className="ml-3 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full px-2.5 py-0.5 min-w-[20px] text-center">
                                    {selectedFiles.length}
                                </span>
                            )}
                        </h3>
                        {subtitle && <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept={accept || "image/*,application/pdf"}
                        multiple
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center px-4 py-2 bg-slate-800/80 hover:bg-blue-600/90 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg border border-slate-700/50 hover:border-blue-500/50 backdrop-blur-sm group/btn"
                    >
                        <PlusIcon className="w-3.5 h-3.5 mr-2 group-hover/btn:rotate-90 transition-transform duration-300" />
                        Add Files
                    </button>
                    {extraAction && <div>{extraAction}</div>}
                </div>
            </div>

            <div className="relative border border-dashed border-slate-700/50 rounded-2xl p-4 min-h-[14rem] bg-slate-950/30 flex-1 flex flex-col transition-colors group-hover:border-slate-600/50 group-hover:bg-slate-950/50">
                {selectedFiles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 bg-slate-800/30 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                            <DocumentTextIcon className="w-8 h-8 text-slate-600 group-hover:text-blue-400/80 transition-colors duration-300" />
                        </div>
                        <p className="text-slate-400 text-sm font-medium mb-1">Drag & drop files here</p>
                        <p className="text-slate-600 text-xs">or click "Add Files" to browse</p>
                    </div>
                ) : (
                    <ul className="space-y-2 h-full overflow-y-auto pr-1 custom-scrollbar z-10">
                        {selectedFiles.map((file, index) => (
                            <li key={index} className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800 hover:border-slate-600 transition-all group/item hover:bg-slate-800/60">
                                <div className="flex items-center min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center mr-3 border border-slate-700/30">
                                        <DocumentTextIcon className="w-4 h-4 text-slate-400 group-hover/item:text-blue-400 transition-colors" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-medium text-slate-200 truncate">{file.name}</span>
                                        <span className="text-[10px] text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveFile(file)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover/item:opacity-100"
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
    excelFiles = [],
    onExcelFilesSelect,
    showExcelUpload = false,
    excelUploadTitle = "Excel Bank Statements",
    onProcess
}) => {
    const handleDownloadTemplate = useCallback(() => {
        if (!XLSX || !XLSX.utils) return;
        const rows = [
            ["Date", "Description", "Debit", "Credit", "Currency", "Category", "Confidence"],
            ["2026-01-01", "Opening balance", "0", "5000", "AED", "Bank Accounts", "90"],
            ["2026-01-05", "Sample invoice payment", "0", "1200", "AED", "Service Revenue", "85"],
            ["2026-01-07", "Office supplies purchase", "450", "0", "AED", "Office Supplies", "88"],
            ["2026-01-10", "Loan repayment", "2500", "0", "AED", "Short-Term Loans", "92"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 12 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, "BankStatementTemplate.xlsx");
    }, []);

    const [showPassword, setShowPassword] = useState(false);

    const hasFiles = invoiceFiles.length > 0 || (statementFiles && statementFiles.length > 0) || (excelFiles && excelFiles.length > 0);

    const showStatements = showStatementUpload && !!statementFiles && !!onStatementFilesSelect;
    const showExcel = showExcelUpload && !!excelFiles && !!onExcelFilesSelect;
    // Calculate how many upload sections are actually visible to size the grid
    const visibleCount = (showInvoiceUpload ? 1 : 0) + (showStatements ? 1 : 0) + (showExcel ? 1 : 0);
    const gridColsClass = visibleCount >= 3 ? 'md:grid-cols-3' : visibleCount === 2 ? 'md:grid-cols-2' : 'md:grid-cols-1';

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Company Details Section */}
            <div className="bg-slate-900/40 backdrop-blur-md p-8 rounded-3xl border border-slate-700/50 shadow-2xl relative overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                    <div>
                        <label htmlFor="country" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Country</label>
                        <div className="relative">
                            <select id="country" className="w-full pl-4 pr-10 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all appearance-none cursor-not-allowed font-medium" disabled>
                                <option>UAE</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="companyName" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Name</label>
                        <input
                            type="text"
                            id="companyName"
                            placeholder="e.g. Acme Corp"
                            value={companyName}
                            onChange={(e) => onCompanyNameChange(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all font-medium"
                        />
                    </div>
                    <div>
                        <label htmlFor="companyTrn" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company TRN</label>
                        <input
                            type="text"
                            id="companyTrn"
                            placeholder="15-digit TRN"
                            value={companyTrn}
                            onChange={(e) => onCompanyTrnChange(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-950/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all font-medium"
                        />
                    </div>
                </div>
                <div className="mt-6 flex items-center text-xs text-slate-500 bg-slate-800/30 p-3 rounded-xl border border-slate-700/30 w-fit">
                    <SparklesIcon className="w-4 h-4 mr-2 text-blue-400" />
                    Providing your company name helps the AI accurately classify invoices.
                </div>
            </div>

            {/* Upload Areas */}
            <div className={`grid grid-cols-1 ${gridColsClass} gap-6 items-stretch`}>
                {showInvoiceUpload && (
                    <FileUploadArea
                        title={invoiceUploadTitle}
                        subtitle={invoiceUploadSubtitle}
                        icon={<DocumentTextIcon className="w-6 h-6" />}
                        selectedFiles={invoiceFiles}
                        onFilesSelect={onInvoiceFilesSelect}
                    />
                )}
                {showStatementUpload && statementFiles && onStatementFilesSelect && (
                    <FileUploadArea
                        title={statementUploadTitle}
                        subtitle={statementUploadSubtitle}
                        icon={<BanknotesIcon className="w-6 h-6" />}
                        selectedFiles={statementFiles}
                        onFilesSelect={onStatementFilesSelect}
                    />
                )}
                {showExcelUpload && excelFiles && onExcelFilesSelect && (
                    <FileUploadArea
                        title={excelUploadTitle}
                        subtitle="Upload .xlsx or .xls files"
                        icon={<BanknotesIcon className="w-6 h-6" />}
                        selectedFiles={excelFiles}
                        onFilesSelect={onExcelFilesSelect}
                        accept=".xlsx,.xls"
                        extraAction={
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-xl border border-transparent bg-white/10 text-white hover:bg-white/20 transition-colors"
                            >
                                Download Template
                            </button>
                        }
                    />
                )}
                {!showInvoiceUpload && !showStatementUpload && !showExcelUpload && (
                    <div className="col-span-full">
                        <FileUploadArea
                            title="Project Documents"
                            icon={<FolderIcon className="w-6 h-6" />}
                            selectedFiles={invoiceFiles}
                            onFilesSelect={onInvoiceFilesSelect}
                        />
                    </div>
                )}
            </div>

            {/* Password Section */}
            <div className="bg-slate-900/40 backdrop-blur-md p-6 rounded-3xl border border-slate-700/50 shadow-sm flex items-center justify-between group hover:border-slate-600/50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/50 text-slate-400 group-hover:text-blue-400 transition-colors">
                        <LockClosedIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 max-w-md">
                        <label htmlFor="pdfPassword" className="block text-sm font-bold text-white mb-1">PDF Password Protection</label>
                        <p className="text-xs text-slate-500">Enter password if any documents are encrypted.</p>
                    </div>
                </div>
                <div className="relative flex-1 max-w-xs">
                    <input
                        id="pdfPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={pdfPassword}
                        onChange={(e) => onPasswordChange(e.target.value)}
                        placeholder="Password (Optional)"
                        className="w-full pl-4 pr-10 py-2.5 bg-slate-950/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none transition-all font-mono text-sm"
                        aria-label="PDF password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                        {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Action Bar */}
            {hasFiles && onProcess && (
                <div className="flex justify-end pt-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <button
                        onClick={onProcess}
                        className="group flex items-center px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl shadow-blue-900/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-blue-400/20"
                    >
                        <SparklesIcon className="w-5 h-5 mr-3 animate-pulse" />
                        <span className="tracking-wide">Process Documents</span>
                        <div className="ml-3 pl-3 border-l border-white/20 text-blue-100 text-sm font-medium">
                            {(invoiceFiles.length + (statementFiles?.length || 0) + (excelFiles?.length || 0))} Files
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};
