import React, { useEffect, useState, useRef } from 'react';
import { XMarkIcon, DocumentArrowDownIcon } from './icons';

interface PdfPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    pdfBlob: Blob | null;
    fileName: string;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
    isOpen,
    onClose,
    pdfBlob,
    fileName
}) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isOpen || !pdfBlob) {
            if (blobUrlRef.current) {
                window.URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
                setBlobUrl(null);
            }
            return;
        }
        const url = window.URL.createObjectURL(pdfBlob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        return () => {
            window.URL.revokeObjectURL(url);
            blobUrlRef.current = null;
        };
    }, [isOpen, pdfBlob]);

    // Keyboard: Escape to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [isOpen]);

    const handleDownload = () => {
        if (!pdfBlob) return;
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-background z-[80] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="PDF Preview"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">PDF Preview</h3>
                    <span className="text-xs text-muted-foreground truncate max-w-[300px]">{fileName}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownload}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg text-xs uppercase tracking-wide transition-colors shadow-lg flex items-center gap-2"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        Download PDF
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        aria-label="Close preview"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* PDF Viewer - Full Screen */}
            <div className="flex-1 min-h-0">
                {blobUrl ? (
                    <iframe
                        src={blobUrl}
                        title="PDF Preview"
                        className="w-full h-full border-0"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm text-muted-foreground">Loading preview...</p>
                    </div>
                )}
            </div>
        </div>
    );
};
