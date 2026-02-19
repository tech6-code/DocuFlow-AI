
import React, { useState, useRef } from 'react';
import { UploadIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from './icons';

interface FileUploadProps {
    onFileSelect: (file: File | null) => void;
    selectedFile: File | null;
    previewUrls: string[];
    pdfPassword: string;
    onPasswordChange: (password: string) => void;
    title?: string;
    subtitle?: string;
    uploadButtonText?: string;
    onProcess?: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
    onFileSelect,
    selectedFile,
    previewUrls,
    pdfPassword,
    onPasswordChange,
    title = "Upload",
    subtitle = "Choose a PDF or image and import.",
    uploadButtonText = "Add File",
    onProcess
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileSelect(e.target.files[0]);
            setCurrentPage(0);
        } else {
            onFileSelect(null);
            setCurrentPage(0);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    }

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, previewUrls.length - 1));
    };

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 0));
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
            <div className="lg:col-span-3 flex flex-col gap-6">
                <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                    <h3 className="text-lg font-semibold mb-1 text-foreground">{title}</h3>
                    <p className="text-muted-foreground mb-4 text-sm">{subtitle}</p>

                    <div className="space-y-4">
                        <div className="relative">
                            <LockClosedIcon className="w-5 h-5 text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={pdfPassword}
                                onChange={(e) => onPasswordChange(e.target.value)}
                                placeholder="Enter password (optional)"
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
                        <p className="text-xs text-muted-foreground">Leave empty for non-protected PDFs.</p>
                    </div>

                    <div className="mt-6 border-t border-border pt-5 flex justify-end">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*,application/pdf"
                        />
                        <button
                            onClick={handleButtonClick}
                            className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm"
                        >
                            <UploadIcon className="w-5 h-5 mr-2" />
                            {uploadButtonText}
                        </button>
                    </div>
                </div>
                <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                    <h3 className="text-base font-semibold mb-2 text-foreground">Selected file</h3>
                    <div className="bg-muted text-foreground/80 rounded-md px-4 py-3 text-sm border border-border mb-4">
                        {selectedFile ? selectedFile.name : 'No file selected.'}
                    </div>
                    {selectedFile && onProcess && (
                        <button
                            onClick={onProcess}
                            className="w-full flex items-center justify-center px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-sm shadow-md"
                        >
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            Process Document
                        </button>
                    )}
                </div>
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
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 0}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-muted/70 rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeftIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleNextPage}
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
