import React from 'react';
import { useCtType2 } from '../Layout';
import { MagnifyingGlassIcon, FunnelIcon, ArrowsRightLeftIcon, ClipboardCheckIcon, PencilIcon, SparklesIcon } from '../../../icons';
import { formatWholeNumber, formatDate } from '../types';
import { CategoryDropdown } from '../CategoryDropdown';

export const Step1: React.FC = () => {
    const {
        editedTransactions,
        searchTerm,
        setSearchTerm,
        filterCategory,
        setFilterCategory,
        customCategories,
        handleCategorySelection,
        handleBulkCategoryChange,
        selectedTxs,
        setSelectedTxs,
        bulkCategory,
        setBulkCategory,
        hasUncategorized,
        setCurrentStep,
        onProcess,
        isProcessing,
        progress,
        progressMessage,
        appState,
        currency
    } = useCtType2();

    const filteredTransactions = editedTransactions.filter(tx => {
        const matchesSearch = !searchTerm ||
            tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            tx.reference?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = filterCategory === 'ALL' ||
            (filterCategory === 'UNCATEGORIZED' && (!tx.category || tx.category === 'UNCATEGORIZED')) ||
            tx.category === filterCategory;

        return matchesSearch && matchesCategory;
    });

    const handleSelectTx = (id: string) => {
        setSelectedTxs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedTxs(filteredTransactions.map(t => t.id));
        } else {
            setSelectedTxs([]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/50 p-4 rounded-xl border border-gray-800">
                <div className="flex-1 w-full md:w-auto relative">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <FunnelIcon className="w-4 h-4 text-gray-500" />
                        <CategoryDropdown
                            value={filterCategory}
                            onChange={setFilterCategory}
                            customCategories={customCategories}
                            showAllOption={true}
                            className="min-w-[200px]"
                        />
                    </div>
                    {selectedTxs.length > 0 && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
                            <CategoryDropdown
                                value={bulkCategory}
                                onChange={setBulkCategory}
                                customCategories={customCategories}
                                placeholder="Bulk Category..."
                                className="min-w-[200px]"
                            />
                            <button
                                onClick={handleBulkCategoryChange}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all"
                            >
                                Apply to {selectedTxs.length}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-950 border-b border-gray-800">
                                <th className="p-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                        checked={selectedTxs.length > 0 && selectedTxs.length === filteredTransactions.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Debit</th>
                                <th className="p-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Credit</th>
                                <th className="p-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Classification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {filteredTransactions.map((tx) => (
                                <tr key={tx.id} className={`hover:bg-white/5 transition-colors group ${selectedTxs.includes(tx.id) ? 'bg-blue-600/5' : ''}`}>
                                    <td className="p-4">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            checked={selectedTxs.includes(tx.id)}
                                            onChange={() => handleSelectTx(tx.id)}
                                        />
                                    </td>
                                    <td className="p-4 text-xs font-mono text-gray-400 whitespace-nowrap">{formatDate(tx.date)}</td>
                                    <td className="p-4">
                                        <p className="text-sm text-white font-medium line-clamp-1" title={tx.description}>{tx.description}</p>
                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{tx.reference}</p>
                                    </td>
                                    <td className="p-4 text-right text-sm font-mono text-red-400">{tx.debit > 0 ? formatWholeNumber(tx.debit) : '-'}</td>
                                    <td className="p-4 text-right text-sm font-mono text-green-400">{tx.credit > 0 ? formatWholeNumber(tx.credit) : '-'}</td>
                                    <td className="p-4">
                                        <CategoryDropdown
                                            value={tx.category || 'UNCATEGORIZED'}
                                            onChange={(val) => handleCategorySelection(tx.id, val)}
                                            customCategories={customCategories}
                                            className="min-w-[220px]"
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex justify-between items-center bg-gray-900 p-6 rounded-2xl border border-gray-800">
                <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Uncategorized</span>
                        <span className={`text-xl font-black font-mono ${hasUncategorized ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                            {filteredTransactions.filter(t => !t.category || t.category === 'UNCATEGORIZED').length}
                        </span>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => {
                            if (!onProcess) return;
                            if (!hasUncategorized) {
                                setCurrentStep(2);
                                return;
                            }
                            Promise.resolve(onProcess('transactions')).then(() => setCurrentStep(2));
                        }}
                        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 active:translate-y-0"
                    >
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};
