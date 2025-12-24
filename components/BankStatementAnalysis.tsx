
import React, { useState, useMemo, useEffect } from 'react';
import type { DocumentHistoryItem, Transaction } from '../types';
import { StatementDetailView } from './StatementDetailView';
import { BanknotesIcon, CalendarDaysIcon, TrashIcon } from './icons';
import { useData } from '../contexts/DataContext';

interface BankStatementAnalysisProps {
    documentHistory: DocumentHistoryItem[];
    onUpdateHistoryItem: (updatedItem: DocumentHistoryItem) => void;
    onDeleteHistoryItem: (id: string) => void;
    onAnalyzeTransactions: (historyItemId: string, transactionsToAnalyze: Transaction[]) => Promise<void>;
    isAnalyzing: boolean;
    analysisError: string | null;
}

export const BankStatementAnalysis: React.FC<BankStatementAnalysisProps> = ({
    documentHistory,
    onUpdateHistoryItem,
    onDeleteHistoryItem,
    onAnalyzeTransactions,
    isAnalyzing,
    analysisError
}) => {
    const [selectedStatementId, setSelectedStatementId] = useState<string | null>(null);
    const { hasPermission } = useData();
    const canDelete = hasPermission('bank-statement-analysis:delete');

    const statementHistory = useMemo(() => {
        return documentHistory
            .filter(item => item.type === 'Bank Statements')
            .sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
    }, [documentHistory]);

    const selectedStatement = useMemo(() => {
        return statementHistory.find(item => item.id === selectedStatementId) || null;
    }, [selectedStatementId, statementHistory]);

    // Effect to manage selection when the list changes (e.g., on load or after deletion)
    useEffect(() => {
        const selectedExists = statementHistory.some(item => item.id === selectedStatementId);

        if (!selectedExists && statementHistory.length > 0) {
            // If the selected ID is no longer valid, or if nothing is selected, select the first item.
            setSelectedStatementId(statementHistory[0].id);
        } else if (statementHistory.length === 0) {
            // If the list becomes empty, clear the selection.
            setSelectedStatementId(null);
        }
    }, [statementHistory, selectedStatementId]);

    const handleDelete = (idToDelete: string) => {
        if (window.confirm('Are you sure you want to delete this processed statement? This action cannot be undone.')) {
            onDeleteHistoryItem(idToDelete);
        }
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 h-[calc(100vh-10rem)]">
            <div className="lg:col-span-1 bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-sm h-full flex flex-col">
                <h3 className="text-lg font-semibold text-white mb-4 px-2">Processed Statements</h3>
                <div className="overflow-y-auto flex-1 pr-1">
                    {statementHistory.length > 0 ? (
                        <ul className="space-y-2">
                            {statementHistory.map(item => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => setSelectedStatementId(item.id)}
                                        className={`w-full text-left p-3 rounded-md transition-colors group flex justify-between items-start ${selectedStatementId === item.id
                                            ? 'bg-gray-800 border-gray-600 border'
                                            : 'hover:bg-gray-800/50'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-white truncate flex items-center">
                                                <BanknotesIcon className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                                                {item.title}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1 flex items-center">
                                                <CalendarDaysIcon className="w-3 h-3 mr-1.5" />
                                                {new Date(item.processedAt).toLocaleDateString('en-GB')}
                                            </p>
                                        </div>
                                        {canDelete && (
                                            <div
                                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                            >
                                                <div
                                                    className="p-1.5 rounded-full hover:bg-red-900/50 text-gray-400 hover:text-red-400"
                                                    aria-label={`Delete statement ${item.title}`}
                                                    title="Delete Statement"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </div>
                                            </div>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-10">
                            No bank statements have been processed yet.
                        </p>
                    )}
                </div>
            </div>

            <div className="lg:col-span-3 h-full overflow-y-auto">
                {selectedStatement ? (
                    <StatementDetailView
                        key={selectedStatement.id} // Re-mount component on statement change
                        statement={selectedStatement}
                        onUpdateStatement={onUpdateHistoryItem}
                        onAnalyzeTransactions={onAnalyzeTransactions}
                        isAnalyzing={isAnalyzing}
                        analysisError={analysisError}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-sm">
                        <p className="text-gray-500">Select a statement to view its analysis.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
