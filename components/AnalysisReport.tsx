
import React, { useMemo, useState } from 'react';
import type { AnalysisResult, Transaction } from '../types';
import { 
    ChartPieIcon, 
    ArrowUpIcon, 
    ArrowDownIcon, 
    ScaleIcon, 
    SparklesIcon, 
    ChevronDownIcon, 
    ChevronRightIcon, 
    CalendarDaysIcon
} from './icons';

interface AnalysisReportProps {
    analysis: AnalysisResult;
    transactions: Transaction[];
    currency: string;
}

const formatCurrency = (amount: number, currencyCode: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
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

const CashFlowCard = ({ label, value, icon, color }: { label: string, value: string, icon: React.ReactNode, color: string }) => (
    <div className={`p-4 rounded-lg border ${color} bg-opacity-5`}>
        <div className="flex items-center space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
            <div>
                <p className="text-sm text-gray-400">{label}</p>
                <p className="font-bold text-lg font-mono text-white">{value}</p>
            </div>
        </div>
    </div>
);

export const AnalysisReport: React.FC<AnalysisReportProps> = ({ analysis, transactions, currency }) => {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

    const spendingData = useMemo(() => {
        const categoryMap: Record<string, { total: number; transactions: Transaction[] }> = {};
        
        transactions.forEach(t => {
            // Filter for expenses (debit > 0) and exclude generic Income types from spending report
            if (t.debit > 0 && t.category && t.category !== 'Income' && t.category !== 'Salary') {
                if (!categoryMap[t.category]) {
                    categoryMap[t.category] = { total: 0, transactions: [] };
                }
                categoryMap[t.category].total += t.debit;
                categoryMap[t.category].transactions.push(t);
            }
        });

        const sortedCategories = Object.entries(categoryMap)
            .map(([name, data]) => ({
                name,
                total: data.total,
                transactions: data.transactions.sort((a, b) => b.debit - a.debit) // Sort transactions by amount desc
            }))
            .sort((a, b) => b.total - a.total); // Sort categories by total desc

        const maxTotal = Math.max(...sortedCategories.map(c => c.total), 1);

        return { categories: sortedCategories, maxTotal };
    }, [transactions]);

    const barColors = ['bg-gray-200', 'bg-gray-300', 'bg-gray-400', 'bg-gray-500', 'bg-gray-600'];

    const toggleCategory = (categoryName: string) => {
        setExpandedCategory(prev => prev === categoryName ? null : categoryName);
    };

    return (
        <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-sm space-y-8">
            <h2 className="text-2xl font-bold text-white border-b border-gray-800 pb-4">Spending Analysis Report</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CashFlowCard 
                    label="Total Income"
                    value={formatCurrency(analysis.cashFlow.totalIncome, currency)}
                    icon={<ArrowUpIcon className="w-5 h-5 text-green-400"/>}
                    color="bg-green-900/50 border-green-800"
                />
                <CashFlowCard 
                    label="Total Expenses"
                    value={formatCurrency(analysis.cashFlow.totalExpenses, currency)}
                    icon={<ArrowDownIcon className="w-5 h-5 text-red-400"/>}
                    color="bg-red-900/50 border-red-800"
                />
                <CashFlowCard 
                    label="Net Cash Flow"
                    value={formatCurrency(analysis.cashFlow.netCashFlow, currency)}
                    icon={<ScaleIcon className="w-5 h-5 text-yellow-400"/>}
                    color="bg-yellow-900/50 border-yellow-800"
                />
            </div>
            
            <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <SparklesIcon className="w-6 h-6 mr-3 text-gray-300" />
                    AI Financial Summary
                </h3>
                <p className="text-gray-300 bg-gray-800 p-4 rounded-lg border border-gray-700 whitespace-pre-wrap leading-relaxed">{analysis.spendingSummary}</p>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Spending Chart */}
                <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Spending Breakdown</h3>
                    <div className="space-y-3">
                        {spendingData.categories.slice(0, 8).map((category, index) => (
                            <div key={category.name}>
                                <div className="flex justify-between items-center mb-1 text-sm">
                                    <span className="font-medium text-gray-300">{category.name}</span>
                                    <span className="font-mono font-semibold">{formatCurrency(category.total, currency)}</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                    <div 
                                        className={`${barColors[index % barColors.length]} h-2.5 rounded-full`}
                                        style={{ width: `${(category.total / spendingData.maxTotal) * 100}%`}}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recurring Payments */}
                <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Potential Recurring Payments</h3>
                    {analysis.recurringPayments.length > 0 ? (
                        <ul className="space-y-2">
                        {analysis.recurringPayments.map((payment, index) => {
                            const isString = typeof payment === 'string';
                            const label = isString ? payment : payment.description;
                            const amount = isString ? null : payment.amount;
                            const freq = isString ? null : payment.frequency;

                            return (
                                <li key={index} className="p-3 bg-gray-800 border border-gray-700 rounded-md flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-200">{label}</span>
                                        {freq && <span className="text-xs text-gray-500">{freq}</span>}
                                    </div>
                                    {amount !== null && (
                                        <span className="font-mono font-semibold text-white">
                                            {formatCurrency(amount, currency)}
                                        </span>
                                    )}
                                </li>
                            );
                        })}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">No recurring payments identified.</p>
                    )}
                </div>
            </div>

            {/* Detailed Transaction Breakdown */}
            <div>
                <h3 className="text-lg font-semibold text-white mb-4 border-t border-gray-800 pt-6">Detailed Spending Breakdown</h3>
                <div className="space-y-3">
                    {spendingData.categories.map((category) => (
                        <div key={category.name} className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/50">
                            <button 
                                onClick={() => toggleCategory(category.name)}
                                className="w-full p-4 flex items-center justify-between hover:bg-gray-800 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    {expandedCategory === category.name ? 
                                        <ChevronDownIcon className="w-5 h-5 text-gray-400" /> : 
                                        <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                                    }
                                    <div className="text-left">
                                        <p className="font-semibold text-white">{category.name}</p>
                                        <p className="text-xs text-gray-400">{category.transactions.length} transactions</p>
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-white">{formatCurrency(category.total, currency)}</span>
                            </button>
                            
                            {expandedCategory === category.name && (
                                <div className="bg-gray-950/50 border-t border-gray-800">
                                    <table className="w-full text-sm text-left text-gray-400">
                                        <thead className="text-xs text-gray-500 uppercase bg-gray-900 border-b border-gray-800">
                                            <tr>
                                                <th className="px-6 py-3 font-medium">Date</th>
                                                <th className="px-6 py-3 font-medium">Description</th>
                                                <th className="px-6 py-3 font-medium text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {category.transactions.map((t, idx) => (
                                                <tr key={idx} className="border-b border-gray-800 last:border-b-0 hover:bg-gray-900/50">
                                                    <td className="px-6 py-3 font-mono text-xs whitespace-nowrap">
                                                        <div className="flex items-center">
                                                            <CalendarDaysIcon className="w-3 h-3 mr-2 opacity-50"/>
                                                            {formatDate(t.date)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-white">{typeof t.description === 'object' ? JSON.stringify(t.description) : t.description}</td>
                                                    <td className="px-6 py-3 text-right font-mono text-red-300">{formatCurrency(t.debit, currency)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};
