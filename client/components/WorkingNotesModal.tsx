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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-800 bg-gray-950/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">Working Notes</h2>
                        <p className="text-sm text-blue-400 font-mono mt-1">{accountName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Original Balance (Read-only) */}
                    <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Original Balance (Brought Forward)</h3>
                        <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-6 text-sm font-medium text-gray-300 italic">Original Extracted Amount</div>
                            <div className="col-span-3 text-right font-mono text-sm text-gray-400">{baseDebit.toLocaleString()} <span className="text-[10px]">{currency}</span></div>
                            <div className="col-span-3 text-right font-mono text-sm text-gray-400">{baseCredit.toLocaleString()} <span className="text-[10px]">{currency}</span></div>
                        </div>
                    </div>

                    {/* Notes List */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Adjustments & Notes</h3>
                            <button onClick={handleAddNote} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold transition-colors">
                                <PlusIcon className="w-4 h-4" /> Add Note
                            </button>
                        </div>

                        {notes.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-gray-800 rounded-xl text-gray-500 text-sm">
                                No working notes added. Click "Add Note" to create one.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-4 px-2 py-1 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                    <div className="col-span-5">Description</div>
                                    <div className="col-span-3 text-right">Debit (+/-)</div>
                                    <div className="col-span-3 text-right">Credit (+/-)</div>
                                    <div className="col-span-1"></div>
                                </div>
                                {notes.map((note, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-4 items-center bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                                        <div className="col-span-5">
                                            <input
                                                type="text"
                                                value={note.description}
                                                onChange={e => handleNoteChange(idx, 'description', e.target.value)}
                                                placeholder="Enter note details..."
                                                className="w-full bg-transparent border-none focus:ring-0 text-sm text-white placeholder-gray-600 p-0"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                value={note.debit || ''}
                                                onChange={e => handleNoteChange(idx, 'debit', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-black/20 border border-gray-700 rounded px-2 py-1 text-right font-mono text-sm text-white focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input
                                                type="number"
                                                value={note.credit || ''}
                                                onChange={e => handleNoteChange(idx, 'credit', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-black/20 border border-gray-700 rounded px-2 py-1 text-right font-mono text-sm text-white focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                            <button onClick={() => handleRemoveNote(idx)} className="text-gray-500 hover:text-red-400 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Totals Summary */}
                    <div className="bg-blue-900/10 rounded-xl border border-blue-900/30 p-4 mt-4">
                        <div className="grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-6 text-sm font-bold text-blue-200">Adjusted Closing Balance</div>
                            <div className="col-span-3 text-right font-mono text-sm font-bold text-white">{finalDebit.toLocaleString()} <span className="text-[10px] text-gray-500">{currency}</span></div>
                            <div className="col-span-3 text-right font-mono text-sm font-bold text-white">{finalCredit.toLocaleString()} <span className="text-[10px] text-gray-500">{currency}</span></div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-gray-800 bg-gray-950/50 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2.5 bg-transparent border border-gray-700 text-gray-400 hover:text-white rounded-lg font-bold text-sm transition-all hover:bg-gray-800">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-900/20 transition-all transform hover:scale-[1.02]">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
