import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon, Bars3Icon, CheckIcon } from './icons';

interface Column {
    key: string;
    label: string;
    visible: boolean;
}

interface CustomizeColumnsModalProps {
    isOpen: boolean;
    onClose: () => void;
    columns: Column[];
    onSave: (columns: Column[]) => void;
}

export const CustomizeColumnsModal: React.FC<CustomizeColumnsModalProps> = ({ isOpen, onClose, columns, onSave }) => {
    const [localColumns, setLocalColumns] = useState<Column[]>(columns);
    const [searchTerm, setSearchTerm] = useState('');
    const draggingItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    useEffect(() => {
        setLocalColumns(columns);
    }, [columns, isOpen]);

    if (!isOpen) return null;

    const handleToggle = (index: number) => {
        const newColumns = [...localColumns];
        newColumns[index].visible = !newColumns[index].visible;
        setLocalColumns(newColumns);
    };

    const handleSort = () => {
        const draggedIndex = draggingItem.current;
        const targetIndex = dragOverItem.current;

        if (draggedIndex === null || targetIndex === null || draggedIndex === targetIndex) {
            draggingItem.current = null;
            dragOverItem.current = null;
            return;
        }

        const newColumns = [...localColumns];
        const draggedItemContent = newColumns[draggedIndex];
        newColumns.splice(draggedIndex, 1);
        newColumns.splice(targetIndex, 0, draggedItemContent);

        draggingItem.current = null;
        dragOverItem.current = null;
        setLocalColumns(newColumns);
    };

    const onDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        draggingItem.current = index;
        // e.dataTransfer.effectAllowed = "move"; // Optional visual feedback
        // Create ghost image if desired
    };

    const onDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        dragOverItem.current = index;
        // Avoid aggressive re-rendering on every enter, 
        // but for smooth visual feedback, updating state here (swapping) is common in simple lists.
        // For now, simpler implementation: sort ONLY on drop/end. 
        // Actually, live sorting is better UX. Let's try live sort if it's not too jittery.
        // No, for stability without a library, 'sort on drop' is safer. 
        // BUT standard practice is to show the gap. 
        // Let's stick to simple swap on drop for V1 to ensure it works reliably first.
    };

    const onDragEnd = () => {
        handleSort();
    };


    const filteredColumns = localColumns.map((col, index) => ({ col, index })).filter(({ col }) =>
        col.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedCount = localColumns.filter(c => c.visible).length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-md border border-gray-700 flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Customize Columns</h3>
                        <p className="text-sm text-gray-400">{selectedCount} of {localColumns.length} Selected</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-800">
                    <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search columns..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-800 text-white rounded-lg pl-9 pr-4 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {filteredColumns.map(({ col, index }) => (
                        <div
                            key={col.key}
                            draggable
                            onDragStart={(e) => onDragStart(e, index)}
                            onDragEnter={(e) => onDragEnter(e, index)}
                            onDragEnd={onDragEnd}
                            onDragOver={(e) => e.preventDefault()} // Necessary to allow dropping
                            className="flex items-center p-3 rounded-lg hover:bg-gray-800/50 group cursor-move select-none"
                        >
                            <Bars3Icon className="w-5 h-5 text-gray-500 mr-3 cursor-grab active:cursor-grabbing" />
                            <div className="flex-1 flex items-center">
                                <label className="flex items-center cursor-pointer w-full">
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${col.visible ? 'bg-blue-600 border-blue-600' : 'border-gray-600 bg-gray-800'}`}>
                                        {col.visible && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={col.visible}
                                        onChange={() => handleToggle(index)}
                                    />
                                    <span className="text-gray-200 text-sm font-medium">{col.label}</span>
                                </label>
                            </div>
                        </div>
                    ))}
                    {filteredColumns.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            No columns found.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-end space-x-3 bg-gray-900/50 rounded-b-lg">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(localColumns)}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-900/20 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
