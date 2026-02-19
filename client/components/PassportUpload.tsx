
import React, { useRef, useState } from 'react';
import { UploadIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from './icons';

interface PassportUploadProps {
    onFilesSelect: (files: File[]) => void;
    selectedFiles: File[];
    previewUrls: string[];
    onProcess?: () => void;
}

export const PassportUpload: React.FC<PassportUploadProps> = ({
    onFilesSelect,
    selectedFiles,
    previewUrls,
    onProcess
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentPage, setCurrentPage] = useState(0);

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
        }
    };

    const handleRemoveFile = (fileToRemove: File) => {
        onFilesSelect(selectedFiles.filter(file => file !== fileToRemove));
    };

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
                    <h3 className="text-lg font-semibold mb-1 text-foreground">Passport</h3>
                    <p className="text-muted-foreground mb-4 text-sm">Upload passport data pages.</p>

                    <div className="mt-6 border-t border-border pt-5 flex justify-end">
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
                            className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm"
                        >
                            <UploadIcon className="w-5 h-5 mr-2" />
                            Add Documents
                        </button>
                    </div>
                </div>

                <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                    <h3 className="text-base font-semibold mb-2 text-foreground">Selected Documents</h3>
                    <div className="border border-border rounded-lg p-2 min-h-[8rem] bg-muted/50 mb-4">
                        {selectedFiles.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-muted-foreground text-sm">No files yet.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {selectedFiles.map((file, index) => (
                                    <li key={index} className="flex items-center justify-between bg-card p-2 border border-border rounded-md shadow-sm">
                                        <span className="text-sm text-foreground/80 truncate pr-2">{file.name}</span>
                                        <button
                                            onClick={() => handleRemoveFile(file)}
                                            className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
                            Process Documents
                        </button>
                    )}
                </div>
            </div>

            <div className="lg:col-span-2">
                <div className="bg-card p-4 rounded-lg border border-border shadow-sm aspect-[4/5] flex items-center justify-center relative">
                    {previewUrls.length > 0 ? (
                        <>
                            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10 px-2">
                                <h3 className="text-sm font-semibold text-foreground/80 shadow-black drop-shadow-md">Preview</h3>
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
                                    >
                                        <ChevronLeftIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === previewUrls.length - 1}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-muted/70 rounded-full text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
