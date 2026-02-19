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
    actionSlot?: React.ReactNode;
}

export const FileUploadArea: React.FC<FileUploadAreaProps> = ({ title, subtitle, icon, selectedFiles, onFilesSelect, accept, actionSlot }) => {
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
            className="group relative bg-card backdrop-blur-md p-6 rounded-3xl border border-border shadow-sm flex flex-col h-full overflow-hidden transition-all duration-300 hover:bg-muted/30 hover:border-border"
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {/* Accent line on hover */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex justify-between items-start mb-6 z-10 relative">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-muted rounded-2xl border border-border shadow-inner group-hover:scale-110 transition-transform duration-300">
                        {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6 text-primary drop-shadow-md" })}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground flex items-center tracking-tight">
                            {title}
                            {selectedFiles.length > 0 && (
                                <span className="ml-3 text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 rounded-full px-2.5 py-0.5 min-w-[20px] text-center">
                                    {selectedFiles.length}
                                </span>
                            )}
                        </h3>
                        {subtitle && <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>}
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
                        className="flex items-center px-4 py-2 bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm border border-border group/btn"
                    >
                        <PlusIcon className="w-3.5 h-3.5 mr-2 group-hover/btn:rotate-90 transition-transform duration-300" />
                        Add Files
                    </button>
                    {actionSlot && <div>{actionSlot}</div>}
                </div>
            </div>

            <div className="relative border border-dashed border-border rounded-2xl p-4 min-h-[14rem] bg-muted/30 flex-1 flex flex-col transition-colors group-hover:border-border group-hover:bg-muted/40">
                {selectedFiles.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                            <DocumentTextIcon className="w-8 h-8 text-muted-foreground/40 group-hover:text-primary/60 transition-colors duration-300" />
                        </div>
                        <p className="text-muted-foreground text-sm font-medium mb-1">Drag &amp; drop files here</p>
                        <p className="text-muted-foreground/60 text-xs">or click "Add Files" to browse</p>
                    </div>
                ) : (
                    <ul className="space-y-2 h-full overflow-y-auto pr-1 custom-scrollbar z-10">
                        {selectedFiles.map((file, index) => (
                            <li key={index} className="flex items-center justify-between bg-card p-3 rounded-xl border border-border hover:border-primary/30 transition-all group/item hover:bg-accent/30">
                                <div className="flex items-center min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mr-3 border border-border">
                                        <DocumentTextIcon className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-medium text-foreground truncate">{file.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemoveFile(file)}
                                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover/item:opacity-100"
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
            ["Date", "Description", "Debit", "Credit", "Currency"],
            ["2026-01-01", "Initial deposit into account", "0", "5000", "AED"],
            ["2026-01-05", "Customer payment for services", "0", "1200", "AED"],
            ["2026-01-07", "Stationery and office supplies", "450", "0", "AED"],
            ["2026-01-10", "Partial repayment of facility", "2500", "0", "AED"]
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 10 }];
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
            <div className="bg-card p-8 rounded-3xl border border-border shadow-sm relative overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                    <div>
                        <label htmlFor="country" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Country</label>
                        <div className="relative">
                            <select id="country" className="w-full pl-4 pr-10 py-3 bg-muted border border-border rounded-xl text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all appearance-none cursor-not-allowed font-medium" disabled>
                                <option>UAE</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="companyName" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Company Name</label>
                        <input
                            type="text"
                            id="companyName"
                            placeholder="e.g. Acme Corp"
                            value={companyName}
                            onChange={(e) => onCompanyNameChange(e.target.value)}
                            className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium"
                        />
                    </div>
                    <div>
                        <label htmlFor="companyTrn" className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Company TRN</label>
                        <input
                            type="text"
                            id="companyTrn"
                            placeholder="15-digit TRN"
                            value={companyTrn}
                            onChange={(e) => onCompanyTrnChange(e.target.value)}
                            className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium"
                        />
                    </div>
                </div>
                <div className="mt-6 flex items-center text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl border border-border w-fit">
                    <SparklesIcon className="w-4 h-4 mr-2 text-primary" />
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
                        actionSlot={
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-xl border border-border bg-muted text-foreground hover:bg-accent transition-colors"
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
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex items-center justify-between group hover:border-border transition-colors">
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-muted rounded-2xl border border-border text-muted-foreground group-hover:text-primary transition-colors">
                        <LockClosedIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 max-w-md">
                        <label htmlFor="pdfPassword" className="block text-sm font-bold text-foreground mb-1">PDF Password Protection</label>
                        <p className="text-xs text-muted-foreground">Enter password if any documents are encrypted.</p>
                    </div>
                </div>
                <div className="relative flex-1 max-w-xs">
                    <input
                        id="pdfPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={pdfPassword}
                        onChange={(e) => onPasswordChange(e.target.value)}
                        placeholder="Password (Optional)"
                        className="w-full pl-4 pr-10 py-2.5 bg-muted border border-border rounded-xl text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-mono text-sm"
                        aria-label="PDF password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                        className="group flex items-center px-8 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] border border-primary/20"
                    >
                        <SparklesIcon className="w-5 h-5 mr-3 animate-pulse" />
                        <span className="tracking-wide">Process Documents</span>
                        <div className="ml-3 pl-3 border-l border-primary-foreground/20 text-primary-foreground/80 text-sm font-medium">
                            {(invoiceFiles.length + (statementFiles?.length || 0) + (excelFiles?.length || 0))} Files
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};
