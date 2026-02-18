import React, { useCallback, useState } from 'react';
import type { DocumentHistoryItem, Transaction } from '../types';
import { useData } from '../contexts/DataContext';
import { AnalysisReport } from './AnalysisReport';
import { LoadingIndicator } from './LoadingIndicator';
import { WrenchScrewdriverIcon, ChartPieIcon, DocumentArrowDownIcon, TrashIcon } from './icons';
import { TRANSACTION_CATEGORIES } from '../services/geminiService';

interface StatementDetailViewProps {
    statement: DocumentHistoryItem;
    onUpdateStatement: (updatedStatement: DocumentHistoryItem) => void;
    onAnalyzeTransactions: (historyItemId: string, transactionsToAnalyze: Transaction[]) => Promise<void>;
    isAnalyzing: boolean;
    analysisError: string | null;
}

// This tells TypeScript that XLSX will be available on the window object
declare const XLSX: any;

const formatCurrency = (amount: number, currencyCode: string = 'USD') => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
};

const getConfidenceColor = (score: number) => {
    if (score > 90) return 'text-green-400';
    if (score > 75) return 'text-yellow-400';
    return 'text-red-400';
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Check if already DD/MM/YYYY
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

export const StatementDetailView: React.FC<StatementDetailViewProps> = ({
    statement,
    onUpdateStatement,
    onAnalyzeTransactions,
    isAnalyzing,
    analysisError
}) => {
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const { hasPermission } = useData();
    const canCategorize = hasPermission('bank-statement-analysis:categorize');
    const canExport = hasPermission('bank-statement-analysis:export');
    const canDelete = hasPermission('bank-statement-analysis:delete');

    const handleToggleSelect = (index: number) => {
        const newSelected = new Set(selectedIndices);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIndices(newSelected);
    };

    const handleToggleSelectAll = () => {
        if (!statement.transactions) return;
        if (selectedIndices.size === statement.transactions.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(statement.transactions.map((_, i) => i)));
        }
    };

    const handleDeleteSelected = () => {
        if (!statement.transactions || selectedIndices.size === 0) return;

        if (!window.confirm(`Are you sure you want to delete ${selectedIndices.size} selected transaction(s)? This will also recalculate all subsequent balances and totals.`)) return;

        const remainingTransactions = statement.transactions.filter((_, index) => !selectedIndices.has(index));

        // Recalculate balances based on opening balance
        let currentBalance = statement.summary?.openingBalance || 0;
        const updatedTransactions = remainingTransactions.map(t => {
            const newBalance = currentBalance + (t.credit || 0) - (t.debit || 0);
            currentBalance = newBalance;
            return {
                ...t,
                balance: Number(newBalance.toFixed(2))
            };
        });

        // Recalculate totals for summary
        const totalWithdrawals = updatedTransactions.reduce((acc, t) => acc + (t.debit || 0), 0);
        const totalDeposits = updatedTransactions.reduce((acc, t) => acc + (t.credit || 0), 0);
        const closingBalance = (statement.summary?.openingBalance || 0) + totalDeposits - totalWithdrawals;

        const updatedStatement: DocumentHistoryItem = {
            ...statement,
            transactions: updatedTransactions,
            summary: statement.summary ? {
                ...statement.summary,
                totalWithdrawals: Number(totalWithdrawals.toFixed(2)),
                totalDeposits: Number(totalDeposits.toFixed(2)),
                closingBalance: Number(closingBalance.toFixed(2)),
            } : undefined,
            // Clear analysis as it's now out of sync
            analysis: undefined
        };

        onUpdateStatement(updatedStatement);
        setSelectedIndices(new Set());
    };

    const handleCategoryChange = (transactionIndex: number, newCategory: string) => {
        if (!statement.transactions) return;

        const updatedTransactions = [...statement.transactions];
        updatedTransactions[transactionIndex] = {
            ...updatedTransactions[transactionIndex],
            category: newCategory
        };

        const updatedStatement = {
            ...statement,
            transactions: updatedTransactions
        };

        onUpdateStatement(updatedStatement);
    };

    const handleExport = useCallback(() => {
        if (!statement.analysis || !statement.transactions) return;

        const workbook = XLSX.utils.book_new();
        const currency = statement.currency || 'USD';
        const currencyFormat = `"${currency}" #,##0.00`;

        // --- Analysis Sheet ---
        const analysisData = [
            ["AI Financial Summary"],
            [statement.analysis.spendingSummary],
            [], // spacer
            ["Cash Flow"],
            ["Total Income", statement.analysis.cashFlow.totalIncome],
            ["Total Expenses", statement.analysis.cashFlow.totalExpenses],
            ["Net Cash Flow", statement.analysis.cashFlow.netCashFlow],
            [], // spacer
            ["Potential Recurring Payments"],
            ...statement.analysis.recurringPayments.map(p => {
                if (typeof p === 'string') return [p];
                return [`${p.description} (${p.frequency || ''})`, p.amount];
            })
        ];

        const analysisWorksheet = XLSX.utils.aoa_to_sheet(analysisData);

        // Merging cells for readability
        analysisWorksheet['!merges'] = [
            XLSX.utils.decode_range("A1:C1"),
            XLSX.utils.decode_range("A2:C2"),
            XLSX.utils.decode_range("A4:C4"),
            XLSX.utils.decode_range("A9:C9"),
        ];

        // Formatting currency cells for analysis
        ['B5', 'B6', 'B7'].forEach(cellRef => {
            const cell = analysisWorksheet[cellRef];
            if (cell) {
                cell.t = 'n';
                cell.z = currencyFormat;
            }
        });

        analysisWorksheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 60 }];

        XLSX.utils.book_append_sheet(workbook, analysisWorksheet, 'Analysis Report');

        // --- Transactions Sheet ---
        const transactionsData = statement.transactions.map(t => ({
            Date: formatDate(t.date),
            Description: t.description,
            Category: t.category || 'N/A',
            Debit: t.debit === 0 ? null : t.debit,
            Credit: t.credit === 0 ? null : t.credit,
            Balance: t.balance,
            'Confidence (%)': t.confidence
        }));

        const transactionsWorksheet = XLSX.utils.json_to_sheet(transactionsData);
        transactionsWorksheet['!cols'] = [
            { wch: 12 }, { wch: 50 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
        ];
        // Format currency columns
        transactionsData.forEach((_row, index) => {
            ['D', 'E', 'F'].forEach(col => {
                const cellRef = `${col}${index + 2}`; // +2 because of header row
                if (transactionsWorksheet[cellRef] && transactionsWorksheet[cellRef].v !== null) {
                    transactionsWorksheet[cellRef].z = currencyFormat;
                }
            });
        });

        XLSX.utils.book_append_sheet(workbook, transactionsWorksheet, 'Categorized Transactions');

        // --- Download ---
        XLSX.writeFile(workbook, `Statement_Analysis_${statement.title.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);

    }, [statement]);

    const formatLabel = (key: string) => {
        const result = key.replace(/([A-Z])/g, " $1");
        return result.charAt(0).toUpperCase() + result.slice(1);
    };

    const renderValue = (value: any) => {
        if (typeof value === 'number') {
            return formatCurrency(value, statement.currency);
        }
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
        }
        return String(value ?? '');
    };

    return (
        <div className="space-y-6">
            <div className="bg-card p-6 rounded-lg border border-border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{statement.title}</h2>
                        <p className="text-sm text-muted-foreground">Processed by {statement.processedBy} on {new Date(statement.processedAt).toLocaleString('en-GB')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedIndices.size === 0}
                            className="flex items-center px-4 py-2 bg-destructive/10 text-destructive font-semibold rounded-lg hover:bg-destructive/20 border border-destructive/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <TrashIcon className="w-5 h-5 mr-2" />
                            Delete Selected {selectedIndices.size > 0 ? `(${selectedIndices.size})` : ''}
                        </button>
                        {!statement.analysis && (
                            <button
                                onClick={() => onAnalyzeTransactions(statement.id, statement.transactions || [])}
                                disabled={isAnalyzing}
                                className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                            >
                                <WrenchScrewdriverIcon className="w-5 h-5 mr-2" />
                                {isAnalyzing ? 'Analyzing...' : 'Analyze Spending'}
                            </button>
                        )}
                        {statement.analysis && canExport && (
                            <button
                                onClick={handleExport}
                                className="flex items-center px-4 py-2 bg-muted text-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors text-sm border border-border"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                                Export Analysis
                            </button>
                        )}
                    </div>
                </div>

                {statement.summary && (
                    <div className="bg-muted/50 p-4 rounded-lg border border-border">
                        <h3 className="text-md font-semibold text-foreground mb-3 flex items-center">
                            <ChartPieIcon className="w-5 h-5 mr-2 text-muted-foreground" />
                            AI Document Summary
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            {Object.entries(statement.summary).map(([key, value]) => (
                                <div key={key}>
                                    <span className="font-semibold text-muted-foreground">{formatLabel(key)}:</span>
                                    <span className="ml-2 text-foreground font-medium whitespace-pre-wrap">
                                        {renderValue(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isAnalyzing && <div className="bg-card p-6 rounded-lg border border-border shadow-sm"><LoadingIndicator progress={50} statusText="Running AI financial analysis..." /></div>}
            {analysisError && <div className="bg-card p-6 rounded-lg border border-destructive/30 shadow-sm text-destructive">Error: {analysisError}</div>}

            {statement.analysis && statement.transactions && (
                <AnalysisReport
                    analysis={statement.analysis}
                    transactions={statement.transactions}
                    currency={statement.currency || 'USD'}
                />
            )}

            <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
                <h3 className="text-lg font-semibold text-foreground p-6">Transactions</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                            <tr>
                                <th scope="col" className="px-6 py-3 font-semibold">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary focus:ring-offset-background"
                                        checked={statement.transactions ? selectedIndices.size === statement.transactions.length && statement.transactions.length > 0 : false}
                                        onChange={handleToggleSelectAll}
                                    />
                                </th>
                                <th scope="col" className="px-6 py-3 font-semibold">Date</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Description</th>
                                <th scope="col" className="px-6 py-3 font-semibold">Category</th>
                                <th scope="col" className="px-6 py-3 text-right font-semibold">Debit</th>
                                <th scope="col" className="px-6 py-3 text-right font-semibold">Credit</th>
                                <th scope="col" className="px-6 py-3 text-right font-semibold">Balance</th>
                                <th scope="col" className="px-6 py-3 text-right font-semibold">Confidence</th>
                                <th scope="col" className="px-6 py-3 text-center font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statement.transactions?.map((t, index) => (
                                <tr key={index} className={`border-t border-border hover:bg-accent/50 transition-colors ${selectedIndices.has(index) ? 'bg-accent/80' : ''}`}>
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-border bg-muted text-primary focus:ring-primary focus:ring-offset-background"
                                            checked={selectedIndices.has(index)}
                                            onChange={() => handleToggleSelect(index)}
                                        />
                                    </td>
                                    <td className="px-6 py-4 font-medium whitespace-nowrap text-foreground">{formatDate(t.date)}</td>
                                    <td className="px-6 py-4">{t.description}</td>
                                    <td className="px-6 py-4">
                                        {canCategorize && statement.analysis ? (
                                            <select
                                                value={t.category || ''}
                                                onChange={(e) => handleCategoryChange(index, e.target.value)}
                                                className="w-40 bg-muted border border-border rounded-md text-xs p-1 focus:ring-primary focus:border-primary text-foreground"
                                            >
                                                <option value="" disabled>Select...</option>
                                                {TRANSACTION_CATEGORIES.map(cat => (
                                                    <option key={cat} value={cat} className="bg-card text-foreground">{cat}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            t.category ? (
                                                <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-full">{t.category}</span>
                                            ) : 'N/A'
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-destructive">{t.debit > 0 ? formatCurrency(t.debit, statement.currency) : '-'}</td>
                                    <td className="px-6 py-4 text-right font-mono text-green-500">{t.credit > 0 ? formatCurrency(t.credit, statement.currency) : '-'}</td>
                                    <td className="px-6 py-4 text-right font-mono text-foreground">{formatCurrency(t.balance, statement.currency)}</td>
                                    <td className={`px-6 py-4 text-right font-mono font-semibold ${getConfidenceColor(t.confidence)}`}>{t.confidence}%</td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => {
                                                const newSelected = new Set([index]);
                                                setSelectedIndices(newSelected);
                                                handleDeleteSelected();
                                            }}
                                            className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-colors"
                                            title="Delete Transaction"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
