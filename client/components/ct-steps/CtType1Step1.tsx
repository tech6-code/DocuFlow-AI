import React, { useState, useMemo, useEffect } from 'react';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    XMarkIcon,
    SparklesIcon,
    TrashIcon,
    ArrowRightIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EyeIcon,
    ExclamationTriangleIcon,
    ArrowUpRightIcon,
    ArrowDownIcon,
    ListBulletIcon,
    DocumentDuplicateIcon,
    CheckIcon
} from '../icons';
import {
    formatDecimalNumber,
    formatDate,
    CategoryDropdown,
    ResultsStatCard,
    resolveCategoryPath
} from './CtType1Shared';
import { LoadingIndicator } from '../LoadingIndicator';
import type { Transaction, BankStatementSummary } from '../../types';

interface CtType1Step1Props {
    transactions: Transaction[];
    editedTransactions: Transaction[];
    setEditedTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    customCategories: string[];
    summary: BankStatementSummary | null;
    fileSummaries?: Record<string, BankStatementSummary>;
    uniqueFiles: string[];
    currency: string;
    filePreviews: Record<string, string[]>;
    isAutoCategorizing: boolean;
    handleAutoCategorize: () => Promise<void>;
    handleConfirmCategories: () => void;
    handleExportStep1: () => void;
    handleDeleteTransaction: (index: number) => void;
}

export const CtType1Step1: React.FC<CtType1Step1Props> = ({
    transactions,
    editedTransactions,
    setEditedTransactions,
    customCategories,
    summary,
    fileSummaries,
    uniqueFiles,
    currency,
    filePreviews,
    isAutoCategorizing,
    handleAutoCategorize,
    handleConfirmCategories,
    handleExportStep1,
    handleDeleteTransaction
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');
    const [selectedFileFilter, setSelectedFileFilter] = useState<string>('ALL');
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [findText, setFindText] = useState('');
    const [replaceCategory, setReplaceCategory] = useState('');
    const [bulkCategory, setBulkCategory] = useState('');
    const [previewPage, setPreviewPage] = useState(0);
    const [showPreviewPanel, setShowPreviewPanel] = useState(true);

    // Filtered transactions for display
    const filteredTransactions = useMemo(() => {
        return editedTransactions
            .map((t, idx) => ({ ...t, originalIndex: idx }))
            .filter(t => {
                const matchesSearch = !searchTerm || (typeof t.description === 'string' && t.description.toLowerCase().includes(searchTerm.toLowerCase()));
                const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
                const matchesFile = selectedFileFilter === 'ALL' || t.sourceFile === selectedFileFilter;
                return matchesSearch && matchesCategory && matchesFile;
            });
    }, [editedTransactions, searchTerm, filterCategory, selectedFileFilter]);

    const activeSummary = useMemo(() => {
        if (selectedFileFilter === 'ALL') return summary;
        if (selectedFileFilter && fileSummaries && fileSummaries[selectedFileFilter]) {
            return fileSummaries[selectedFileFilter];
        }
        return summary;
    }, [selectedFileFilter, fileSummaries, summary]);

    const balanceValidation = useMemo(() => {
        if (!activeSummary || editedTransactions.length === 0) return { isValid: true, diff: 0 };

        const relevantTxs = selectedFileFilter !== 'ALL'
            ? editedTransactions.filter(t => t.sourceFile === selectedFileFilter)
            : editedTransactions;

        if (relevantTxs.length === 0) return { isValid: true, diff: 0, actualClosing: 0, calculatedClosing: 0 };

        const opening = Number(activeSummary.openingBalance) || 0;
        const closing = Number(activeSummary.closingBalance) || 0;

        const sumDebit = relevantTxs.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
        const sumCredit = relevantTxs.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);

        const calculatedClosing = opening - sumDebit + sumCredit;
        const diff = Math.abs(calculatedClosing - closing);

        return {
            isValid: diff < 1.0,
            diff,
            calculatedClosing,
            actualClosing: closing
        };
    }, [activeSummary, editedTransactions, selectedFileFilter]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIndices = new Set(filteredTransactions.map(t => t.originalIndex));
            setSelectedIndices(allIndices);
        } else {
            setSelectedIndices(new Set());
        }
    };

    const handleSelectRow = (originalIndex: number, checked: boolean) => {
        const newSelected = new Set(selectedIndices);
        if (checked) {
            newSelected.add(originalIndex);
        } else {
            newSelected.delete(originalIndex);
        }
        setSelectedIndices(newSelected);
    };

    const handleCategorySelection = (val: string, context: { type: string, rowIndex?: number }) => {
        if (val === '__NEW__') {
            // This should trigger a global modal, we might need a prop for this
            // For now, let's assume the parent handles it if we pass a special value or if we handle it here
            // In the original code, it sets pendingCategoryContext and showAddCategoryModal
            return;
        }

        if (context.type === 'filter') setFilterCategory(val);
        else if (context.type === 'bulk') setBulkCategory(val);
        else if (context.type === 'replace') setReplaceCategory(val);
        else if (context.type === 'row' && context.rowIndex !== undefined) {
            setEditedTransactions(prev => {
                const updated = [...prev];
                updated[context.rowIndex!] = { ...updated[context.rowIndex!], category: val };
                return updated;
            });
        }
    };

    const handleBulkApplyCategory = () => {
        if (!bulkCategory || selectedIndices.size === 0) return;
        setEditedTransactions(prev => {
            const updated = [...prev];
            selectedIndices.forEach(idx => {
                updated[idx] = { ...updated[idx], category: bulkCategory };
            });
            return updated;
        });
        setSelectedIndices(new Set());
    };

    const handleFindReplace = () => {
        if (!findText || !replaceCategory) return;
        let count = 0;
        setEditedTransactions(prev => prev.map(t => {
            if (typeof t.description === 'string' && t.description.toLowerCase().includes(findText.toLowerCase())) {
                count++;
                return { ...t, category: replaceCategory };
            }
            return t;
        }));
        setFindText('');
        if (count > 0) alert(`Updated categories for ${count} transactions.`);
    };

    const handleBulkDelete = () => {
        if (selectedIndices.size === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIndices.size} selected transactions?`)) {
            setEditedTransactions(prev => prev.filter((_, idx) => !selectedIndices.has(idx)));
            setSelectedIndices(new Set());
        }
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterCategory('ALL');
        setSelectedFileFilter('ALL');
    };

    const isAllFiles = selectedFileFilter === 'ALL';
    const fileTransactions = isAllFiles ? editedTransactions : editedTransactions.filter(t => t.sourceFile === selectedFileFilter);
    const fileCurrency = !isAllFiles ? (fileTransactions.find(t => t.originalCurrency)?.originalCurrency || 'AED') : 'AED';
    const isMultiCurrency = !isAllFiles && fileCurrency !== 'AED';

    const currentPreviewKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
    const hasPreviews = !!(currentPreviewKey && filePreviews[currentPreviewKey]);
    const totalPagesForPreview = filePreviews[currentPreviewKey]?.length || 0;

    return (
        <div className="space-y-6">
            {!balanceValidation.isValid && (
                <div className="bg-red-900/40 border border-red-500/50 rounded-xl p-4 flex items-start gap-4 animate-pulse">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-red-300 font-bold text-sm uppercase tracking-wider mb-1">Balance Mismatch Warning</h4>
                        <p className="text-red-200/70 text-xs leading-relaxed">
                            The sum of transactions (Net: {(balanceValidation.diff).toFixed(2)}) doesn't match the statement's reported closing balance.
                            Expected: {formatDecimalNumber(balanceValidation.actualClosing)} {isMultiCurrency ? fileCurrency : currency} vs Calculated: {formatDecimalNumber(balanceValidation.calculatedClosing)} {isMultiCurrency ? fileCurrency : currency}.
                            <br />
                            <span className="font-bold">Recommendation:</span> Please check if any pages were skipped or if Column Mapping (Debit/Credit) is correct.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <ResultsStatCard
                    label="Opening Balance"
                    value={isMultiCurrency && activeSummary?.originalOpeningBalance !== undefined
                        ? `${formatDecimalNumber(activeSummary.originalOpeningBalance)} ${fileCurrency}`
                        : activeSummary?.openingBalance !== undefined
                            ? `${formatDecimalNumber(activeSummary.openingBalance)} AED`
                            : 'N/A'}
                    secondaryValue={isMultiCurrency && activeSummary?.openingBalance !== undefined
                        ? `${formatDecimalNumber(activeSummary.openingBalance)} AED`
                        : undefined}
                    color="text-blue-300"
                    icon={<ArrowUpRightIcon className="w-4 h-4" />}
                />
                <ResultsStatCard
                    label="Closing Balance"
                    value={isMultiCurrency && activeSummary?.originalClosingBalance !== undefined
                        ? `${formatDecimalNumber(activeSummary.originalClosingBalance)} ${fileCurrency}`
                        : activeSummary?.closingBalance !== undefined
                            ? `${formatDecimalNumber(activeSummary.closingBalance)} AED`
                            : 'N/A'}
                    secondaryValue={isMultiCurrency && activeSummary?.closingBalance !== undefined
                        ? `${formatDecimalNumber(activeSummary.closingBalance)} AED`
                        : undefined}
                    color="text-purple-300"
                    icon={<ArrowDownIcon className="w-4 h-4" />}
                />
                <ResultsStatCard
                    label="Total Count"
                    value={String(filteredTransactions.length)}
                    icon={<ListBulletIcon className="w-5 h-5" />}
                />
                <ResultsStatCard
                    label="Uncategorized"
                    value={String(filteredTransactions.filter(t => !t.category || t.category.toLowerCase().includes('uncategorized')).length)}
                    color="text-red-400"
                    icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-400" />}
                />
                <ResultsStatCard
                    label="Files"
                    value={String(uniqueFiles.length)}
                    icon={<DocumentDuplicateIcon className="w-5 h-5" />}
                />
            </div>

            <div className="bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 shadow-2xl px-6 py-5 mb-6">
                <div className="flex flex-wrap items-center gap-6 mb-5 pb-5 border-b border-slate-700/20">
                    <div className="flex items-center gap-2 text-slate-400 self-center">
                        <FunnelIcon className="w-5 h-5 text-slate-500/80" />
                        <span className="text-[10px] font-black uppercase tracking-[0.25em] whitespace-nowrap pt-0.5">Filters</span>
                    </div>

                    <div className="relative group self-center">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search description..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 h-10 bg-slate-950/50 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 w-64 transition-all"
                        />
                    </div>

                    <div className="flex items-center h-10 bg-slate-950/50 rounded-xl border border-slate-700 px-1 gap-1 self-center">
                        <CategoryDropdown
                            value={filterCategory}
                            onChange={(val) => handleCategorySelection(val, { type: 'filter' })}
                            customCategories={customCategories}
                            className="min-w-[180px]"
                            showAllOption={true}
                        />
                        <div className="w-px h-4 bg-slate-700"></div>
                        <select
                            value={selectedFileFilter}
                            onChange={(e) => setSelectedFileFilter(e.target.value)}
                            className="h-full px-3 bg-transparent border-none rounded-lg text-sm text-slate-300 focus:outline-none focus:ring-0 max-w-[180px] cursor-pointer"
                        >
                            <option value="ALL">All Files</option>
                            {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                    </div>

                    {(searchTerm || filterCategory !== 'ALL' || selectedFileFilter !== 'ALL') && (
                        <button
                            onClick={handleClearFilters}
                            className="flex items-center gap-1.5 h-10 px-4 text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 rounded-xl transition-all self-center"
                        >
                            <XMarkIcon className="w-4 h-4" />
                            Clear
                        </button>
                    )}

                    <div className="flex-1"></div>

                    <button
                        onClick={handleAutoCategorize}
                        disabled={isAutoCategorizing}
                        className={`h-10 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-xl shadow-indigo-500/10 flex items-center transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed self-center`}
                    >
                        <SparklesIcon className="w-4 h-4 mr-2 text-violet-200" />
                        {isAutoCategorizing ? 'AI Analysis...' : 'Auto-Categorize'}
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-8">
                    <div className="flex items-center gap-4 bg-slate-950/20 px-4 h-12 rounded-2xl border border-slate-800/60 shadow-inner">
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] whitespace-nowrap pt-0.5">Bulk Label</span>
                        <CategoryDropdown
                            value={bulkCategory}
                            onChange={(val) => handleCategorySelection(val, { type: 'bulk' })}
                            customCategories={customCategories}
                            className="min-w-[160px]"
                        />
                        <button
                            onClick={handleBulkApplyCategory}
                            disabled={!bulkCategory || selectedIndices.size === 0}
                            className="h-8 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-lg transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 shadow-lg shadow-indigo-600/10 active:scale-95"
                        >
                            Apply
                        </button>
                        <div className="w-px h-4 bg-slate-700/50 mx-1"></div>
                        <button
                            onClick={handleBulkDelete}
                            disabled={selectedIndices.size === 0}
                            className="h-8 px-4 border border-rose-500/20 text-rose-400/60 hover:border-rose-500 hover:bg-rose-500 hover:text-white text-[11px] font-black rounded-lg transition-all disabled:opacity-20 disabled:grayscale active:scale-95"
                        >
                            <TrashIcon className="w-3.5 h-3.5 inline mr-1.5" />
                            Delete ({selectedIndices.size})
                        </button>
                    </div>

                    <div className="flex items-center gap-4 bg-slate-950/20 px-4 h-12 rounded-2xl border border-slate-800/60 shadow-inner">
                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em] whitespace-nowrap pt-0.5">Search & Replace</span>
                        <input
                            type="text"
                            placeholder="Match..."
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            className="h-8 px-3 bg-slate-900/50 border border-slate-700/50 rounded-lg text-[11px] text-white focus:outline-none focus:border-emerald-500/50 transition-all w-32 placeholder:text-slate-600"
                        />
                        <ArrowRightIcon className="w-3.5 h-3.5 text-slate-700" />
                        <CategoryDropdown
                            value={replaceCategory}
                            onChange={(val) => handleCategorySelection(val, { type: 'replace' })}
                            customCategories={customCategories}
                            className="min-w-[160px]"
                        />
                        <button
                            onClick={handleFindReplace}
                            disabled={!findText || !replaceCategory}
                            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black rounded-lg transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:opacity-50 shadow-lg shadow-emerald-600/10 active:scale-95"
                        >
                            Run
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 h-[600px] relative mt-6">
                    <div className="flex-1 overflow-auto bg-black/20 rounded-lg border border-gray-700 min-h-[400px]">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 w-10">
                                        <input
                                            type="checkbox"
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            checked={filteredTransactions.length > 0 && selectedIndices.size === filteredTransactions.length}
                                            className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3 text-right">Debit</th>
                                    <th className="px-4 py-3 text-right">Credit</th>
                                    <th className="px-4 py-3">Currency</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3 w-10 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.length > 0 ? (
                                    filteredTransactions.map((t) => (
                                        <tr key={t.originalIndex} className={`border-b border-gray-800 hover:bg-gray-800/50 ${selectedIndices.has(t.originalIndex) ? 'bg-blue-900/10' : ''}`}>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.has(t.originalIndex)}
                                                    onChange={(e) => handleSelectRow(t.originalIndex, e.target.checked)}
                                                    className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                                />
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                                            <td className="px-4 py-2 text-white max-w-xs truncate" title={typeof t.description === 'string' ? t.description : JSON.stringify(t.description)}>
                                                {typeof t.description === 'string' ? t.description : JSON.stringify(t.description)}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {t.originalDebit !== undefined ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-red-400 text-xs">{formatDecimalNumber(t.originalDebit)}</span>
                                                        <span className="text-[9px] text-gray-500 font-sans tracking-tighter">({formatDecimalNumber(t.debit)} AED)</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-red-400">{t.debit > 0 ? formatDecimalNumber(t.debit) : '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono">
                                                {t.originalCredit !== undefined ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-green-400 text-xs">{formatDecimalNumber(t.originalCredit)}</span>
                                                        <span className="text-[9px] text-gray-500 font-sans tracking-tighter">({formatDecimalNumber(t.credit)} AED)</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-green-400">{t.credit > 0 ? formatDecimalNumber(t.credit) : '-'}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 text-[10px] text-gray-500 font-black uppercase tracking-widest text-center">
                                                {t.currency || 'AED'}
                                            </td>
                                            <td className="px-4 py-2">
                                                <CategoryDropdown
                                                    value={t.category || 'UNCATEGORIZED'}
                                                    onChange={(val) => handleCategorySelection(val, { type: 'row', rowIndex: t.originalIndex })}
                                                    customCategories={customCategories}
                                                    className="w-full"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleDeleteTransaction(t.originalIndex)}
                                                    className="text-red-500/50 hover:text-red-500 transition-colors p-1"
                                                    title="Delete Transaction"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-gray-500">No transactions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {showPreviewPanel && hasPreviews && (
                        <div className="w-full lg:w-1/3 bg-black rounded-lg border border-gray-700 flex flex-col h-[600px] lg:h-full">
                            <div className="p-2 border-b border-gray-700 flex justify-between items-center bg-gray-800 rounded-t-lg">
                                <span className="text-xs font-semibold text-white truncate max-w-[150px]">{currentPreviewKey}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => setPreviewPage(p => Math.max(0, p - 1))} className="p-1 hover:bg-gray-700 rounded"><ChevronLeftIcon className="w-4 h-4 text-white" /></button>
                                    <span className="text-xs text-white">{totalPagesForPreview > 0 ? `${previewPage + 1} / ${totalPagesForPreview}` : '0 / 0'}</span>
                                    <button onClick={() => setPreviewPage(p => Math.min(totalPagesForPreview > 0 ? totalPagesForPreview - 1 : 0, p + 1))} className="p-1 hover:bg-gray-700 rounded"><ChevronRightIcon className="w-4 h-4 text-white" /></button>
                                    <button onClick={() => setShowPreviewPanel(false)} className="p-1 hover:bg-gray-700 rounded text-red-400"><XMarkIcon className="w-5 h-5" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden p-2 flex items-center justify-center bg-gray-900">
                                {filePreviews[currentPreviewKey]?.[previewPage] ? (
                                    <img
                                        src={filePreviews[currentPreviewKey][previewPage]}
                                        alt="Preview"
                                        className="max-w-full max-h-full object-contain"
                                    />
                                ) : (
                                    <div className="text-gray-600 flex flex-col items-center">
                                        <LoadingIndicator progress={20} statusText="Loading Preview..." />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {!showPreviewPanel && (
                        <button onClick={() => setShowPreviewPanel(true)} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-gray-800 border border-gray-600 rounded-l-md text-white hover:bg-gray-700 z-20">
                            <EyeIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-700">
                <div className="text-sm text-gray-400">
                    {(() => {
                        const count = editedTransactions.filter(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')).length;
                        return (
                            <div className="flex items-center gap-2">
                                {count > 0 ? (
                                    <span className="text-red-400 font-bold flex items-center animate-pulse">
                                        <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                                        Action Required: {count} transactions are still Uncategorized.
                                    </span>
                                ) : (
                                    <span className="text-green-400 font-bold flex items-center">
                                        <CheckIcon className="w-5 h-5 mr-2" />
                                        All transactions categorized. Ready to proceed.
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportStep1} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">
                        Download Work in Progress
                    </button>
                    <button
                        onClick={handleConfirmCategories}
                        disabled={editedTransactions.length === 0 || editedTransactions.some(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED'))}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg disabled:opacity-50 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all"
                        title={editedTransactions.some(t => !t.category || t.category.toUpperCase().includes('UNCATEGORIZED')) ? "Please categorize all items to continue" : "Continue to next step"}
                    >
                        Continue to Summarization
                    </button>
                </div>
            </div>
        </div>
    );
};
