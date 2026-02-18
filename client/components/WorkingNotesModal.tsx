import React, { useState, useEffect } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon } from './icons';

interface NoteEntry {
    description: string;
    debit: number;
    credit: number;
}

interface WorkingNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (notes: NoteEntry[]) => void;
    accountName: string;
    baseDebit: number;
    baseCredit: number;
    initialNotes?: NoteEntry[];
    currency?: string;
}

export const WorkingNotesModal: React.FC<WorkingNotesModalProps> = ({
    isOpen,
    onClose,
    onSave,
    accountName,
    baseDebit,
    baseCredit,
    initialNotes = [],
    currency = 'AED'
}) => {
    const [notes, setNotes] = useState<NoteEntry[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Clone initial notes to avoid direct mutation
            setNotes(initialNotes.length > 0 ? JSON.parse(JSON.stringify(initialNotes)) : []);
        }
    }, [isOpen]);

    const handleAddNote = () => {
        setNotes([...notes, { description: '', debit: 0, credit: 0 }]);
    };

    const handleRemoveNote = (index: number) => {
        const newNotes = [...notes];
        newNotes.splice(index, 1);
        setNotes(newNotes);
    };

    const handleNoteChange = (index: number, field: keyof NoteEntry, value: string | number) => {
        const newNotes = [...notes];
        newNotes[index] = { ...newNotes[index], [field]: value };
        setNotes(newNotes);
    };

    const calculateTotals = () => {
        const totalNoteDebit = notes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
        const totalNoteCredit = notes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

        const finalDebit = baseDebit + totalNoteDebit;
        const finalCredit = baseCredit + totalNoteCredit;

        return { finalDebit, finalCredit };
    };

    const { finalDebit, finalCredit } = calculateTotals();

    const handleSave = () => {
        // Filter out empty notes
        const validNotes = notes.filter(n => n.description.trim() !== '' || n.debit > 0 || n.credit > 0);
        onSave(validNotes);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-border bg-muted/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Working Notes</h2>
                        <p className="text-sm text-primary font-mono mt-1">{accountName}</p>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-muted rounded-lg">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-background">

                    {/* Original Balance (Read-only) */}
                    <div className="bg-muted/30 rounded-xl border border-border p-4">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Original Balance (Brought Forward)</h3>
                        <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-6 text-sm font-medium text-muted-foreground italic">Original Extracted Amount</div>
                            <div className="col-span-3 text-right font-mono text-sm text-foreground">{baseDebit.toLocaleString()} <span className="text-[10px]">{currency}</span></div>
                            <div className="col-span-3 text-right font-mono text-sm text-foreground">{baseCredit.toLocaleString()} <span className="text-[10px]">{currency}</span></div>
                        </div>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Adjustments & Notes</h3>
                            <button onClick={handleAddNote} className="text-xs flex items-center gap-1 text-primary hover:text-primary/80 font-bold transition-colors">
                                <PlusIcon className="w-4 h-4" /> Add Note
                            </button>
                        </div>

                        {notes.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl text-muted-foreground text-sm">
                                No working notes added. Click "Add Note" to create one.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-4 px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                                    <div className="col-span-5">Description</div>
                                    <div className="col-span-3 text-right">Debit (+/-)</div>
                                    <div className="col-span-3 text-right">Credit (+/-)</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {notes.map((note, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-muted/50 p-3 rounded-lg border border-border hover:border-muted-foreground/30 transition-colors">
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={note.description}
                                                onChange={e => handleNoteChange(idx, 'description', e.target.value)}
                                                placeholder="Enter note details..."
                                                className="w-full bg-transparent border-none focus:ring-0 text-sm text-foreground placeholder-muted-foreground/50 p-0"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                value={note.debit || ''}
                                                onChange={e => handleNoteChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-background border border-border rounded px-2 py-1 text-right font-mono text-sm text-foreground focus:border-primary outline-none"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                value={note.credit || ''}
                                                onChange={e => handleNoteChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-background border border-border rounded px-2 py-1 text-right font-mono text-sm text-foreground focus:border-primary outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button onClick={() => handleRemoveNote(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Totals Summary */}
                    <div className="bg-primary/10 rounded-xl border border-primary/20 p-4 mt-4">
                        <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-6 text-sm font-bold text-primary">Adjusted Closing Balance</div>
                            <div className="col-span-3 text-right font-mono text-sm font-bold text-foreground">{finalDebit.toLocaleString()} <span className="text-[10px] text-muted-foreground">{currency}</span></div>
                            <div className="col-span-3 text-right font-mono text-sm font-bold text-foreground">{finalCredit.toLocaleString()} <span className="text-[10px] text-muted-foreground">{currency}</span></div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-border bg-muted/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2.5 bg-transparent border border-border text-muted-foreground hover:text-foreground rounded-lg font-bold text-sm transition-all hover:bg-muted">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold text-sm shadow-lg shadow-primary/20 transition-all transform hover:scale-[1.02]">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
