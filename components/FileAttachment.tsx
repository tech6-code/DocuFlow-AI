import React, { useRef } from 'react';
import { AttachedDocument } from '../types';
import { PaperClipIcon, XMarkIcon, ArrowDownTrayIcon } from './icons';

interface FileAttachmentProps {
    documents: AttachedDocument[];
    onDocumentsChange: (docs: AttachedDocument[]) => void;
    readOnly?: boolean;
}

export const FileAttachment: React.FC<FileAttachmentProps> = ({ documents, onDocumentsChange, readOnly }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            const newDocs: AttachedDocument[] = [];

            for (const file of files) {
                const base64 = await convertToBase64(file);
                newDocs.push({
                    id: crypto.randomUUID(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64,
                    uploadDate: new Date().toISOString()
                });
            }

            onDocumentsChange([...documents, ...newDocs]);

            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const convertToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleDelete = (id: string) => {
        onDocumentsChange(documents.filter(doc => doc.id !== id));
    };

    const handleDownload = (doc: AttachedDocument) => {
        const link = document.createElement('a');
        link.href = doc.data;
        link.download = doc.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };



    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <PaperClipIcon className="w-4 h-4" />
                    Attachments
                </h4>
                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
                    >
                        <PaperClipIcon className="w-4 h-4" />
                        Add Files
                    </button>
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                />
            </div>

            {documents.length === 0 ? (
                <div className="text-sm text-gray-500 italic bg-gray-800/30 p-4 rounded-lg border border-gray-800 text-center">
                    No files attached.
                </div>
            ) : (
                <div className="space-y-2">
                    {documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700 hover:bg-gray-800 transition-colors group">
                            <div className="flex items-center space-x-3 overflow-hidden">
                                <div className="p-2 bg-gray-700/50 rounded-lg">
                                    <PaperClipIcon className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm text-gray-200 font-medium truncate">{doc.name}</p>
                                    <p className="text-xs text-gray-500">{formatSize(doc.size)} • {new Date(doc.uploadDate).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    type="button"
                                    onClick={() => handleDownload(doc)}
                                    className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                    title="Download"
                                >
                                    <ArrowDownTrayIcon className="w-4 h-4" />
                                </button>
                                {!readOnly && (
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(doc.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Delete"
                                    >
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
