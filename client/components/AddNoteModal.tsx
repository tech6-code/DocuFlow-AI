import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from './icons';
import { DealNote } from '../types';

interface AddNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (note: Omit<DealNote, 'id' | 'dealId' | 'created'> | Partial<DealNote>) => void;
    initialData?: DealNote | null;
}

const AddNoteModal: React.FC<AddNoteModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
    const [title, setTitle] = useState('');
    const [detail, setDetail] = useState('');
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen && initialData) {
            setTitle(initialData.title);
            setDetail(initialData.detail);
            if (editorRef.current) {
                editorRef.current.innerHTML = initialData.detail;
            }
        } else if (isOpen) {
            // Reset form
            setTitle('');
            setDetail('');
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
            }
        }
    }, [isOpen, initialData]);

    const handleSave = () => {
        if (!detail.trim()) {
            alert('Please enter note details');
            return;
        }

        const formData: Partial<DealNote> = {
            title: title.trim() || 'Untitled Note',
            detail
        };

        if (initialData) {
            formData.id = initialData.id;
        }

        onSave(formData as any);

        // Reset form
        setTitle('');
        setDetail('');
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        onClose();
    };

    const handleCancel = () => {
        setTitle('');
        setDetail('');
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground">{initialData ? 'Edit Deal Note' : 'Add Deal Note'}</h2>
                    <button
                        onClick={handleCancel}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Deal Note Details</h3>

                    {/* Note Title */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Note Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Enter note title"
                            className="w-full bg-muted/50 border border-border rounded-lg p-3 text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Note Detail */}
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Note Detail <span className="text-destructive">*</span>
                        </label>

                        {/* Simple Toolbar */}
                        <div className="bg-muted/30 border border-border rounded-t-lg p-2 flex items-center gap-1 flex-wrap">
                            <button
                                type="button"
                                onClick={() => document.execCommand('bold')}
                                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                title="Bold"
                            >
                                <strong>B</strong>
                            </button>
                            <button
                                type="button"
                                onClick={() => document.execCommand('italic')}
                                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                title="Italic"
                            >
                                <em>I</em>
                            </button>
                            <button
                                type="button"
                                onClick={() => document.execCommand('underline')}
                                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors"
                                title="Underline"
                            >
                                <u>U</u>
                            </button>
                            <div className="w-px h-6 bg-border mx-1"></div>
                            <button
                                type="button"
                                onClick={() => document.execCommand('insertUnorderedList')}
                                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors text-sm"
                                title="Bullet List"
                            >
                                • List
                            </button>
                            <button
                                type="button"
                                onClick={() => document.execCommand('insertOrderedList')}
                                className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors text-sm"
                                title="Numbered List"
                            >
                                1. List
                            </button>
                        </div>

                        {/* Rich Text Editor */}
                        <div
                            ref={editorRef}
                            contentEditable
                            onInput={(e) => setDetail(e.currentTarget.innerHTML)}
                            className="w-full min-h-[200px] bg-muted/50 border border-border border-t-0 rounded-b-lg p-3 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none overflow-auto"
                            style={{ maxHeight: '400px' }}
                            suppressContentEditableWarning
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-start gap-3 p-6 border-t border-border">
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {initialData ? 'Update' : 'Save'}
                    </button>
                    <button
                        onClick={handleCancel}
                        className="px-6 py-2.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddNoteModal;
