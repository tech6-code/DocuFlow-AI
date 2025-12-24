
import React, { useState, useCallback } from 'react';
import type { Transaction, AnalysisResult, BankStatementSummary } from '../types';
import { 
    ClipboardIcon, 
    ClipboardCheckIcon, 
    RefreshIcon, 
    DocumentArrowDownIcon, 
    ChartPieIcon,
    BanknotesIcon,
    ArrowDownIcon,
    ArrowUpIcon,
    ScaleIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    WrenchScrewdriverIcon,
} from './icons';
import { usePermissions } from '../App';
import { AnalysisReport } from './AnalysisReport';
import { LoadingIndicator } from './LoadingIndicator';

interface TransactionTableProps {
  transactions: Transaction[];
  onReset: () => void;
  previewUrls: string[];
  summary: BankStatementSummary | null;
  currency: string;
  analysis: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  onAnalyze: () => void;
}

// This tells TypeScript that XLSX will be available on the window object
declare const XLSX: any;

const StatCard = ({ icon, label, value, valueColor }: { icon: React.ReactNode, label: string, value: string | number, valueColor?: string }) => (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-sm flex items-center space-x-4">
        <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center ring-1 ring-gray-700">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400">{label}</p>
            <p className={`text-xl font-bold font-mono ${valueColor || 'text-white'}`}>{value}</p>
        </div>
    </div>
);

const formatLabel = (key: string) => {
    const result = key.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
};

const formatDate = (dateStr: any) => {
    if (!dateStr) return '-';
    if (typeof dateStr === 'object') {
        if (dateStr.year && dateStr.month && dateStr.day) {
            return `${String(dateStr.day).padStart(2,'0')}/${String(dateStr.month).padStart(2,'0')}/${dateStr.year}`;
        }
        return JSON.stringify(dateStr);
    }
    // Check if already DD/MM/YYYY
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }
    
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const ActionButton = ({ 
    onClick, 
    disabled, 
    icon, 
    label, 
    variant = 'dark', 
    className = '' 
}: { 
    onClick: () => void, 
    disabled?: boolean, 
    icon: React.ReactNode, 
    label: string, 
    variant?: 'primary' | 'dark' | 'white',
    className?: string
}) => {
    
    // Base classes
    const baseClasses = "group flex items-center justify-center rounded-xl transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none";
    
    // Responsive sizing: Square icon-only on mobile/tablet/laptop, Text included on extra large screens
    const sizingClasses = "w-12 h-12 xl:w-auto xl:h-auto xl:px-5 xl:py-3"; 
    
    let colorClasses = "";
    switch(variant) {
        case 'primary': // Analyze - Primary Color
            colorClasses = "bg-[#E2E8F0] hover:bg-white text-slate-900 border border-slate-200";
            break;
        case 'white': // Start Over - High Contrast
            colorClasses = "bg-white text-black hover:bg-gray-100 border border-transparent";
            break;
        case 'dark': // Secondary actions
        default:
            colorClasses = "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-600";
            break;
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${baseClasses} ${sizingClasses} ${colorClasses} ${className}`}
            title={label}
        >
            <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center">{icon}</span>
            <span className="hidden xl:inline-block ml-2.5 font-bold text-sm whitespace-nowrap">{label}</span>
        </button>
    );
};

export const TransactionTable: React.FC<TransactionTableProps> = ({ 
    transactions, 
    onReset, 
    previewUrls, 
    summary, 
    currency,
    analysis,
    isAnalyzing,
    analysisError,
    onAnalyze
}) => {
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const { hasPermission } = usePermissions();

  const totalDebit = transactions.reduce((acc, t) => acc + t.debit, 0);
  const totalCredit = transactions.reduce((acc, t) => acc + t.credit, 0);
  const netChange = totalCredit - totalDebit;

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, previewUrls.length - 1));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  const formatCurrency = (amount: number, currencyCode: string) => {
    if (amount === 0 && currencyCode !== 'Net Change') return '-';
    try {
        // Return pure number string
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch (e) {
        return amount.toFixed(2);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score > 90) return 'text-green-400';
    if (score > 75) return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const convertToCSV = useCallback(() => {
    const headers = ['Date', 'Description', 'Debit', 'Credit', 'Balance', 'Confidence'];
    const rows = transactions.map(t => {
      const desc = typeof t.description === 'object' ? JSON.stringify(t.description) : t.description;
      return [
        `"${formatDate(t.date)}"`,
        `"${desc.replace(/"/g, '""')}"`,
        t.debit,
        t.credit,
        t.balance,
        t.confidence
      ].join(',')
    });
    return [headers.join(','), ...rows].join('\n');
  }, [transactions]);

  const copyToClipboard = useCallback(() => {
    const csvData = convertToCSV();
    navigator.clipboard.writeText(csvData).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [convertToCSV]);

  const handleExportExcel = useCallback(() => {
    const summaryData = summary ? [
        ["Account Holder", summary.accountHolder],
        ["Account Number", summary.accountNumber],
        ["Statement Period", summary.statementPeriod],
        ["Opening Balance", summary.openingBalance],
        ["Closing Balance", summary.closingBalance],
        ["Total Withdrawals", summary.totalWithdrawals],
        ["Total Deposits", summary.totalDeposits]
    ] : [["AI Summary", "Not available"]];

    const summaryAOA = [
        ["AI Document Summary"],
        ...summaryData,
        [], 
        ["Calculated Transaction Summary"],
        ["Detected Currency", currency],
        ["Total Transactions", transactions.length],
        ["Total Debits", totalDebit],
        ["Total Credits", totalCredit],
        ["Net Change", netChange]
    ];
    
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryAOA);
    summaryWorksheet['!merges'] = [
      XLSX.utils.decode_range("A1:B1"),
      XLSX.utils.decode_range(`A${summaryData.length + 3}:B${summaryData.length + 3}`),
    ];
    summaryWorksheet['!cols'] = [{ wch: 25 }, { wch: 80 }];
    
    // Format numbers in Excel - pure numbers
    const numberFormat = '#,##0.00';
    
    if (summary) {
        ['B5', 'B6', 'B7', 'B8'].forEach(cellRef => { // Opening, Closing, Withdrawals, Deposits
            const cell = summaryWorksheet[cellRef];
            if (cell) {
                cell.t = 'n';
                cell.z = numberFormat;
            }
        });
    }

    // Format calculated currency
    const calculatedStartRow = summaryData.length + 5;
    [`B${calculatedStartRow + 2}`, `B${calculatedStartRow + 3}`, `B${calculatedStartRow + 4}`].forEach(cellRef => {
        const cell = summaryWorksheet[cellRef];
        if (cell) {
            cell.t = 'n';
            cell.z = numberFormat;
        }
    });

    const transactionsData = transactions.map(t => ({
        Date: formatDate(t.date),
        Description: typeof t.description === 'object' ? JSON.stringify(t.description) : t.description,
        Debit: t.debit === 0 ? null : t.debit,
        Credit: t.credit === 0 ? null : t.credit,
        Balance: t.balance,
        'Confidence (%)': t.confidence
    }));
    const transactionsWorksheet = XLSX.utils.json_to_sheet(transactionsData);
    transactionsWorksheet['!cols'] = [
        { wch: 12 }, { wch: 50 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    ];
    transactionsData.forEach((_row, index) => {
        ['C', 'D', 'E'].forEach(col => { // Debit, Credit, Balance
            const cellRef = `${col}${index + 2}`;
            if (transactionsWorksheet[cellRef] && transactionsWorksheet[cellRef].v !== null) {
                transactionsWorksheet[cellRef].z = numberFormat;
            }
        });
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    XLSX.utils.book_append_sheet(workbook, transactionsWorksheet, 'Transactions');
    XLSX.writeFile(workbook, 'Bank_Statement_Export.xlsx');
  }, [transactions, summary, currency, totalDebit, totalCredit, netChange]);

  return (
    <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 w-full">
            <div className="flex items-center gap-5">
                <div className="w-16 h-16 flex-shrink-0 bg-gray-900 rounded-2xl flex items-center justify-center border border-gray-800 shadow-xl">
                    <BanknotesIcon className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">
                        Bank Statement <br className="md:hidden" /> Analysis
                    </h2>
                    <p className="text-sm font-medium text-green-400 mt-1 flex items-center">
                        <span className="relative flex h-2 w-2 mr-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Conversion complete.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto justify-start md:justify-end flex-wrap">
                <ActionButton 
                    onClick={onAnalyze}
                    disabled={isAnalyzing || !!analysis}
                    icon={<WrenchScrewdriverIcon className={`w-5 h-5 ${isAnalyzing ? 'animate-spin' : ''}`} />}
                    label={isAnalyzing ? 'Analyzing...' : (analysis ? 'Analysis Complete' : 'Analyze Spending')}
                    variant="primary"
                />
                
                {hasPermission('bank-statements:export') && (
                    <ActionButton 
                        onClick={handleExportExcel}
                        icon={<DocumentArrowDownIcon className="w-5 h-5" />}
                        label="Export XLSX"
                        variant="dark"
                    />
                )}
                
                <ActionButton 
                    onClick={copyToClipboard}
                    icon={copied ? <ClipboardCheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                    label={copied ? 'Copied!' : 'Copy CSV'}
                    variant="dark"
                />
                
                <ActionButton 
                    onClick={onReset}
                    icon={<RefreshIcon className="w-5 h-5" />}
                    label="Start Over"
                    variant="white"
                />
            </div>
        </div>

        <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard 
                    icon={<BanknotesIcon className="w-6 h-6 text-white" />}
                    label="Detected Currency"
                    value={currency}
                />
                <StatCard 
                    icon={<ArrowDownIcon className="w-6 h-6 text-red-400" />}
                    label="Total Debits"
                    value={formatCurrency(totalDebit, currency)}
                    valueColor="text-red-400"
                />
                <StatCard 
                    icon={<ArrowUpIcon className="w-6 h-6 text-green-400" />}
                    label="Total Credits"
                    value={formatCurrency(totalCredit, currency)}
                    valueColor="text-green-400"
                />
                <StatCard 
                    icon={<ScaleIcon className="w-6 h-6 text-yellow-400" />}
                    label="Net Change"
                    value={formatCurrency(netChange, currency)}
                    valueColor={netChange >= 0 ? "text-green-400" : "text-red-400"}
                />
            </div>
            <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-sm">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <ChartPieIcon className="w-6 h-6 mr-3 text-gray-300" />
                    AI Document Summary
                </h3>
                 {summary ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <tbody>
                                {Object.entries(summary).map(([key, value]) => (
                                    <tr key={key} className="border-b border-gray-800 last:border-b-0">
                                        <td className="py-2 pr-4 font-semibold text-gray-400">{formatLabel(key)}</td>
                                        <td className="py-2 text-white font-medium">
                                            {typeof value === 'number' ? formatCurrency(value, currency) : (typeof value === 'object' && value !== null ? JSON.stringify(value) : value)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500">Summary not available.</p>
                )}
            </div>
        </div>
        
        <div className="mb-8">
            {isAnalyzing && <LoadingIndicator progress={50} statusText={"Running AI financial analysis..."} />}
            {analysisError && (
                 <div className="text-center p-8 bg-gray-900 rounded-lg border border-red-500/30 shadow-sm">
                    <h3 className="text-xl font-semibold text-red-500 mb-2">Analysis Failed</h3>
                    <p className="text-gray-400">{analysisError}</p>
                </div>
            )}
            {analysis && transactions && (
                <AnalysisReport analysis={analysis} transactions={transactions} currency={currency} />
            )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
            <div className="flex flex-col lg:flex-row">
                <div className="lg:w-1/3 p-4 border-b lg:border-b-0 lg:border-r border-gray-800 bg-gray-950">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-base font-semibold text-gray-300">Document Preview</h3>
                        {previewUrls.length > 1 && (
                            <span className="text-sm text-gray-500 font-mono">
                                {currentPage + 1} / {previewUrls.length}
                            </span>
                        )}
                    </div>
                    <div className="p-2 bg-black rounded-lg relative">
                        <img src={previewUrls[currentPage]} alt={`Bank Statement Preview Page ${currentPage + 1}`} className="rounded-md object-contain max-h-[70vh] w-full" />
                        {previewUrls.length > 1 && (
                            <>
                                <button 
                                    onClick={handlePrevPage} 
                                    disabled={currentPage === 0}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-gray-700/70 rounded-full text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <button 
                                    onClick={handleNextPage} 
                                    disabled={currentPage === previewUrls.length - 1}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gray-700/70 rounded-full text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    aria-label="Next page"
                                >
                                    <ChevronRightIcon className="w-6 h-6" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="lg:w-2/3">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                            <th scope="col" className="px-6 py-4 font-semibold">Date</th>
                            <th scope="col" className="px-6 py-4 font-semibold">Description</th>
                            <th scope="col" className="px-6 py-4 text-right font-semibold">Debit</th>
                            <th scope="col" className="px-6 py-4 text-right font-semibold">Credit</th>
                            <th scope="col" className="px-6 py-4 text-right font-semibold">Balance</th>
                            <th scope="col" className="px-6 py-4 text-right font-semibold">Confidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((t, index) => (
                            <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50">
                                <td className="px-6 py-4 font-medium whitespace-nowrap text-white">{formatDate(t.date)}</td>
                                <td className="px-6 py-4">{typeof t.description === 'object' ? JSON.stringify(t.description) : t.description}</td>
                                <td className="px-6 py-4 text-right font-mono text-red-400">{t.debit > 0 ? formatCurrency(t.debit, currency) : '-'}</td>
                                <td className="px-6 py-4 text-right font-mono text-green-400">{t.credit > 0 ? formatCurrency(t.credit, currency) : '-'}</td>
                                <td className="px-6 py-4 text-right font-mono text-white">{formatCurrency(t.balance, currency)}</td>
                                <td className={`px-6 py-4 text-right font-mono font-semibold ${getConfidenceColor(t.confidence)}`}>{t.confidence}%</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
