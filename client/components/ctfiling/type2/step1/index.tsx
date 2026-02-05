import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step1: React.FC = () => {
    const {
        selectedFileFilter,
        uniqueFiles,
        statementPreviewUrls,
        allFilesBalancesAed,
        fileSummaries,
        activeSummary,
        editedTransactions,
        currency,
        ResultsStatCard,
        formatNumber,
        ArrowUpRightIcon,
        ArrowDownIcon,
        MagnifyingGlassIcon,
        ListBulletIcon,
        ExclamationTriangleIcon,
        DocumentDuplicateIcon,
        filteredTransactions,
        searchTerm,
        setSearchTerm,
        filterCategory,
        setFilterCategory,
        handleCategorySelection,
        renderCategoryOptions,
        setSelectedFileFilter,
        bulkCategory,
        handleBulkApplyCategory,
        selectedIndices,
        handleBulkDelete,
        findText,
        setFindText,
        replaceCategory,
        handleFindReplace,
        handleAutoCategorize,
        isAutoCategorizing,
        SparklesIcon,
        ArrowRightIcon,
        handleSelectAll,
        handleSelectRow,
        formatDate,
        handleDeleteTransaction,
        showPreviewPanel,
        setPreviewPage,
        previewPage,
        ChevronLeftIcon,
        ChevronRightIcon,
        XMarkIcon,
        setShowPreviewPanel,
        EyeIcon,
        DocumentTextIcon,
        TrashIcon,
        handleExportStep1,
        handleConfirmCategories
    } = useCtType2StepContext();

    const currentPreviewKey = selectedFileFilter !== 'ALL' ? selectedFileFilter : (uniqueFiles[0] || '');
    const isAllFiles = selectedFileFilter === 'ALL';

    const aggregatedOpening = allFilesBalancesAed.opening;
    const aggregatedClosing = allFilesBalancesAed.closing;

    const selectedSummary = (!isAllFiles && currentPreviewKey && fileSummaries)
        ? fileSummaries[currentPreviewKey]
        : activeSummary;
    const selectedTransactions = !isAllFiles
        ? editedTransactions.filter((t: any) => t.sourceFile === currentPreviewKey)
        : [];
    const selectedCurrency = selectedTransactions.find((t: any) => t.originalCurrency)?.originalCurrency
        || selectedTransactions.find((t: any) => t.currency)?.currency
        || currency
        || 'AED';

    const openingOriginal = selectedSummary?.originalOpeningBalance ?? selectedSummary?.openingBalance ?? 0;
    const closingOriginal = selectedSummary?.originalClosingBalance ?? selectedSummary?.closingBalance ?? 0;
    const openingAed = selectedSummary?.openingBalance ?? openingOriginal;
    const closingAed = selectedSummary?.closingBalance ?? closingOriginal;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <ResultsStatCard
                    label="Opening Balance"
                    value={isAllFiles ? `${formatNumber(aggregatedOpening)} AED` : `${formatNumber(openingOriginal)} ${selectedCurrency}`}
                    subValue={isAllFiles ? undefined : `${formatNumber(openingAed)} AED`}
                    color="text-blue-300"
                    icon={<ArrowUpRightIcon className="w-4 h-4" />}
                />
                <ResultsStatCard
                    label="Closing Balance"
                    value={isAllFiles ? `${formatNumber(aggregatedClosing)} AED` : `${formatNumber(closingOriginal)} ${selectedCurrency}`}
                    subValue={isAllFiles ? undefined : `${formatNumber(closingAed)} AED`}
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
                    value={String(filteredTransactions.filter((t: any) => !t.category || t.category.toLowerCase().includes('uncategorized')).length)}
                    color="text-red-400"
                    icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-400" />}
                />
                <ResultsStatCard
                    label="Files"
                    value={String(uniqueFiles.length)}
                    icon={<DocumentDuplicateIcon className="w-5 h-5" />}
                />
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-4">
                <div className="flex flex-col xl:flex-row gap-4 justify-between mb-4">
                    <div className="flex flex-wrap gap-3 items-center flex-1">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <select
                            value={filterCategory}
                            onChange={(e) => handleCategorySelection(e.target.value, { type: 'filter' })}
                            className="py-2 px-3 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500 max-w-[200px]"
                        >
                            <option value="ALL">All Categories</option>
                            <option value="UNCATEGORIZED">Uncategorized Only</option>
                            {renderCategoryOptions}
                        </select>
                        <select
                            value={selectedFileFilter}
                            onChange={(e) => setSelectedFileFilter(e.target.value)}
                            className="py-2 px-3 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:border-blue-500 max-w-[200px]"
                        >
                            <option value="ALL">All Files</option>
                            {uniqueFiles.map((f: any) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        {(searchTerm || filterCategory !== 'ALL' || selectedFileFilter !== 'ALL') && (
                            <button onClick={() => { setSearchTerm(''); setFilterCategory('ALL'); setSelectedFileFilter('ALL'); }} className="text-sm text-red-400 hover:text-red-300">Clear</button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
                        <span className="text-xs text-gray-400 font-semibold px-2">Bulk Actions:</span>
                        <select
                            value={bulkCategory}
                            onChange={(e) => handleCategorySelection(e.target.value, { type: 'bulk' })}
                            className="py-1.5 px-2 bg-gray-900 border border-gray-600 rounded text-xs text-white focus:outline-none"
                        >
                            <option value="">Select Category...</option>
                            {renderCategoryOptions}
                        </select>
                        <button
                            onClick={handleBulkApplyCategory}
                            disabled={!bulkCategory || selectedIndices.size === 0}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded disabled:opacity-50"
                        >
                            Apply
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={selectedIndices.size === 0}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded disabled:opacity-50"
                        >
                            <span className="inline-flex items-center gap-1">
                                <TrashIcon className="w-3 h-3" />
                                Delete
                            </span>
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 mb-4 bg-gray-800 p-2 rounded-lg border border-gray-700 items-center">
                    <span className="text-xs text-gray-400 font-semibold px-2">Find & Replace Category:</span>
                    <input
                        type="text"
                        placeholder="Description contains..."
                        value={findText}
                        onChange={(e) => setFindText(e.target.value)}
                        className="py-1.5 px-2 bg-gray-900 border border-gray-600 rounded text-xs text-white focus:outline-none"
                    />
                    <ArrowRightIcon className="w-4 h-4 text-gray-500" />
                    <select
                        value={replaceCategory}
                        onChange={(e) => handleCategorySelection(e.target.value, { type: 'replace' })}
                        className="py-1.5 px-2 bg-gray-900 border border-gray-600 rounded text-xs text-white focus:outline-none"
                    >
                        <option value="">Select New Category...</option>
                        {renderCategoryOptions}
                    </select>
                    <button
                        onClick={handleFindReplace}
                        disabled={!findText || !replaceCategory}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded disabled:opacity-50"
                    >
                        Replace All
                    </button>
                    <div className="flex-1"></div>
                    <button
                        onClick={handleAutoCategorize}
                        disabled={isAutoCategorizing}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded flex items-center disabled:opacity-50"
                    >
                        <SparklesIcon className="w-3 h-3 mr-1" />
                        {isAutoCategorizing ? 'Running AI...' : 'Auto-Categorize'}
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[600px] relative">
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
                                    <th className="px-4 py-3 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((t: any) => (
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
                                                    <span className="text-red-400 text-xs">{formatNumber(t.originalDebit)}</span>
                                                    <span className="text-[9px] text-gray-500 font-sans tracking-tighter">({formatNumber(t.debit)} AED)</span>
                                                </div>
                                            ) : (
                                                <span className="text-red-400">{t.debit > 0 ? formatNumber(t.debit) : '-'}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono">
                                            {t.originalCredit !== undefined ? (
                                                <div className="flex flex-col">
                                                    <span className="text-green-400 text-xs">{formatNumber(t.originalCredit)}</span>
                                                    <span className="text-[9px] text-gray-500 font-sans tracking-tighter">({formatNumber(t.credit)} AED)</span>
                                                </div>
                                            ) : (
                                                <span className="text-green-400">{t.credit > 0 ? formatNumber(t.credit) : '-'}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-[10px] text-gray-500 font-black uppercase tracking-widest text-center">
                                            {t.originalCurrency || t.currency || 'AED'}
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={t.category || 'UNCATEGORIZED'}
                                                onChange={(e) => handleCategorySelection(e.target.value, { type: 'row', rowIndex: t.originalIndex })}
                                                className={`w-full bg-gray-900/70 text-xs p-1 rounded border ${(!t.category || t.category.toLowerCase().includes('uncategorized')) ? 'border-red-500/50 text-red-200' : 'border-gray-700 text-gray-100'
                                                    } focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none`}
                                            >
                                                <option value="UNCATEGORIZED">Uncategorized</option>
                                                {renderCategoryOptions}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => handleDeleteTransaction(t.originalIndex)} className="text-gray-600 hover:text-red-400">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="text-center py-10 text-gray-500">No transactions found.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {showPreviewPanel && statementPreviewUrls.length > 0 && (
                        <div className="w-[40%] bg-gray-900 rounded-lg border border-gray-700 flex flex-col h-full overflow-hidden">
                            <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bank Statement Preview</h4>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPreviewPage(Math.max(0, previewPage - 1))}
                                        disabled={previewPage === 0}
                                        className="p-1 hover:bg-gray-800 rounded disabled:opacity-50 text-gray-400"
                                    >
                                        <ChevronLeftIcon className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs text-gray-500 font-mono">
                                        {previewPage + 1} / {statementPreviewUrls.length}
                                    </span>
                                    <button
                                        onClick={() => setPreviewPage(Math.min(statementPreviewUrls.length - 1, previewPage + 1))}
                                        disabled={previewPage === statementPreviewUrls.length - 1}
                                        className="p-1 hover:bg-gray-800 rounded disabled:opacity-50 text-gray-400"
                                    >
                                        <ChevronRightIcon className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowPreviewPanel(false)} className="mx-1 text-gray-500 hover:text-white">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-gray-900/50">
                                {statementPreviewUrls[previewPage] ? (
                                    <img
                                        src={statementPreviewUrls[previewPage]}
                                        alt={`Page ${previewPage + 1}`}
                                        className="max-w-full shadow-lg border border-gray-800"
                                    />
                                ) : (
                                    <div className="text-gray-500 text-xs flex flex-col items-center justify-center h-full">
                                        <DocumentTextIcon className="w-8 h-8 mb-2 opacity-20" />
                                        <span>No preview available</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {!showPreviewPanel && statementPreviewUrls.length > 0 && (
                        <button
                            onClick={() => setShowPreviewPanel(true)}
                            className="absolute right-0 top-0 m-2 p-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg hover:bg-gray-700 text-gray-400 hover:text-white z-20"
                            title="Show Preview"
                        >
                            <EyeIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex justify-between items-center bg-gray-900 p-4 rounded-xl border border-gray-700">
                <div className="text-sm text-gray-400">
                    <span className="text-white font-bold">{editedTransactions.filter((t: any) => !t.category || t.category.toLowerCase().includes('uncategorized')).length}</span> uncategorized items remaining.
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportStep1} className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors text-sm">
                        Download Work in Progress
                    </button>
                    <button onClick={handleConfirmCategories} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                        Continue to Summarization
                    </button>
                </div>
            </div>
        </div >
    );
};
