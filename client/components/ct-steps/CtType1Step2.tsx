import React, { useMemo, useState } from 'react';
import {
    DocumentArrowDownIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from '../icons';
import {
    formatDecimalNumber,
    getChildCategory
} from './CtType1Shared';
import type { Transaction, BankStatementSummary } from '../../types';

interface CtType1Step2Props {
    editedTransactions: Transaction[];
    summary: BankStatementSummary | null;
    fileSummaries?: Record<string, BankStatementSummary>;
    uniqueFiles: string[];
    currency: string;
    handleExportStepSummary: () => void;
    handleBack: () => void;
    handleSummarizationContinue: () => void;
}

export const CtType1Step2: React.FC<CtType1Step2Props> = ({
    editedTransactions,
    summary,
    fileSummaries,
    uniqueFiles,
    currency,
    handleExportStepSummary,
    handleBack,
    handleSummarizationContinue
}) => {
    const [summaryFileFilter, setSummaryFileFilter] = useState<string>('ALL');

    const summaryData = useMemo(() => {
        const isAllFiles = summaryFileFilter === 'ALL';
        const fileTransactions = isAllFiles ? editedTransactions : editedTransactions.filter(t => t.sourceFile === summaryFileFilter);

        const groups: { [key: string]: { debit: number, credit: number } } = {};
        fileTransactions.forEach(t => {
            const cat = getChildCategory(t.category || 'UNCATEGORIZED');
            if (!groups[cat]) groups[cat] = { debit: 0, credit: 0 };

            if (isAllFiles) {
                groups[cat].debit += (t.debit || 0);
                groups[cat].credit += (t.credit || 0);
            } else {
                // If filtering by file, show original currency if available
                groups[cat].debit += (t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0));
                groups[cat].credit += (t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0));
            }
        });

        return Object.entries(groups)
            .map(([category, vals]) => ({ category, ...vals }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [editedTransactions, summaryFileFilter]);

    const reconciliationData = useMemo(() => {
        return uniqueFiles.map(fileName => {
            const stmtSummary = fileSummaries ? fileSummaries[fileName] : null;
            const fileTransactions = editedTransactions.filter(t => t.sourceFile === fileName);

            const totalDebitAED = fileTransactions.reduce((sum, t) => sum + (t.debit || 0), 0);
            const totalCreditAED = fileTransactions.reduce((sum, t) => sum + (t.credit || 0), 0);
            const openingBalanceAED = stmtSummary?.openingBalance || 0;
            const closingBalanceAED = stmtSummary?.closingBalance || 0;
            const calculatedClosingAED = openingBalanceAED - totalDebitAED + totalCreditAED;

            // Original Values
            const hasOrig = fileTransactions.some(t => t.originalCurrency && t.originalCurrency !== 'AED');
            const currency = fileTransactions.find(t => t.originalCurrency)?.originalCurrency || 'AED';

            const totalDebitOrig = hasOrig ? fileTransactions.reduce((sum, t) => sum + (t.originalDebit !== undefined ? t.originalDebit : (t.debit || 0)), 0) : totalDebitAED;
            const totalCreditOrig = hasOrig ? fileTransactions.reduce((sum, t) => sum + (t.originalCredit !== undefined ? t.originalCredit : (t.credit || 0)), 0) : totalCreditAED;
            const openingBalanceOrig = hasOrig ? (stmtSummary?.originalOpeningBalance !== undefined ? stmtSummary.originalOpeningBalance : (stmtSummary?.openingBalance || 0)) : openingBalanceAED;
            const closingBalanceOrig = hasOrig ? (stmtSummary?.originalClosingBalance !== undefined ? stmtSummary.originalClosingBalance : (stmtSummary?.closingBalance || 0)) : closingBalanceAED;
            const calculatedClosingOrig = openingBalanceOrig - totalDebitOrig + totalCreditOrig;

            const diff = Math.abs(calculatedClosingOrig - closingBalanceOrig);

            return {
                fileName,
                openingBalance: openingBalanceAED,
                totalDebit: totalDebitAED,
                totalCredit: totalCreditAED,
                calculatedClosing: calculatedClosingAED,
                closingBalance: closingBalanceAED,
                originalOpeningBalance: openingBalanceOrig,
                originalTotalDebit: totalDebitOrig,
                originalTotalCredit: totalCreditOrig,
                originalCalculatedClosing: calculatedClosingOrig,
                originalClosingBalance: closingBalanceOrig,
                isValid: diff < 0.1,
                diff,
                currency,
                hasConversion: hasOrig && currency !== 'AED'
            };
        });
    }, [uniqueFiles, fileSummaries, editedTransactions]);

    const activeCurrency = summaryFileFilter !== 'ALL' ? (reconciliationData.find(r => r.fileName === summaryFileFilter)?.currency || currency) : 'AED';

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white">Transaction Summary</h3>
                    <div className="flex items-center gap-3">
                        <select
                            value={summaryFileFilter}
                            onChange={(e) => setSummaryFileFilter(e.target.value)}
                            className="bg-gray-800 border border-gray-600 rounded text-sm text-white px-3 py-1.5 focus:outline-none"
                        >
                            <option value="ALL">All Files</option>
                            {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <button onClick={handleExportStepSummary} className="text-gray-400 hover:text-white" title="Export Summary">
                            <DocumentArrowDownIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Accounts</th>
                                <th className="px-6 py-3 text-right">Debit ({activeCurrency})</th>
                                <th className="px-6 py-3 text-right">Credit ({activeCurrency})</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {summaryData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium">{row.category}</td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatDecimalNumber(row.debit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatDecimalNumber(row.credit)}</td>
                                </tr>
                            ))}
                            <tr className="bg-gray-800 font-bold border-t border-gray-600">
                                <td className="px-6 py-3 text-white">Grand Total {summaryFileFilter === 'ALL' ? 'in AED' : ''}</td>
                                <td className="px-6 py-3 text-right font-mono text-red-400">{formatDecimalNumber(summaryData.reduce((acc, r) => acc + r.debit, 0))}</td>
                                <td className="px-6 py-3 text-right font-mono text-green-400">{formatDecimalNumber(summaryData.reduce((acc, r) => acc + r.credit, 0))}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bank Account Reconciliation Section */}
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                <h3 className="text-xl font-bold text-white mb-6">Bank Account Reconciliation</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Bank Account (File)</th>
                                <th className="px-6 py-3 text-right">Opening Balance</th>
                                <th className="px-6 py-3 text-right">Total Debit (-)</th>
                                <th className="px-6 py-3 text-right">Total Credit (+)</th>
                                <th className="px-6 py-3 text-right">Calculated Closing</th>
                                <th className="px-6 py-3 text-right">Actual Closing</th>
                                <th className="px-6 py-3 text-center">Status</th>
                                <th className="px-6 py-3 text-center">Currency</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {reconciliationData.map((recon, idx) => {
                                const isAllFiles = summaryFileFilter === 'ALL';
                                const showDual = isAllFiles && recon.hasConversion;

                                return (
                                    <tr key={idx} className="hover:bg-gray-800/50">
                                        <td className="px-6 py-3 text-white font-medium truncate max-w-xs" title={recon.fileName}>{recon.fileName}</td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-blue-200">{formatDecimalNumber(recon.originalOpeningBalance)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.openingBalance)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-red-400">{formatDecimalNumber(recon.originalTotalDebit)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.totalDebit)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-green-400">{formatDecimalNumber(recon.originalTotalCredit)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.totalCredit)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono">
                                            <div className="flex flex-col">
                                                <span className="text-blue-300 font-bold">{formatDecimalNumber(recon.originalCalculatedClosing)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.calculatedClosing)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-right font-mono text-white">
                                            <div className="flex flex-col">
                                                <span className="text-white">{formatDecimalNumber(recon.originalClosingBalance)}</span>
                                                {showDual && <span className="text-[10px] text-gray-500">({formatDecimalNumber(recon.closingBalance)} AED)</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex justify-center">
                                                {recon.isValid ? (
                                                    <span title="Balanced">
                                                        <CheckIcon className="w-5 h-5 text-green-500" />
                                                    </span>
                                                ) : (
                                                    <span title={`Difference: ${formatDecimalNumber(recon.diff)}`}>
                                                        <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="text-[10px] text-gray-400">{recon.currency}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {summaryFileFilter === 'ALL' && reconciliationData.length > 1 && (
                                <tr className="bg-blue-900/10 font-bold border-t-2 border-blue-800/50">
                                    <td className="px-6 py-4 text-blue-300 uppercase tracking-wider">Grand Total in AED</td>
                                    <td className="px-6 py-4 text-right font-mono text-blue-200">{formatDecimalNumber(summary?.openingBalance || 0)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-red-400">{formatDecimalNumber(reconciliationData.reduce((s, r) => s + r.totalDebit, 0))}</td>
                                    <td className="px-6 py-4 text-right font-mono text-green-400">{formatDecimalNumber(reconciliationData.reduce((s, r) => s + r.totalCredit, 0))}</td>
                                    <td className="px-6 py-4 text-right font-mono text-blue-300 shadow-inner">{formatDecimalNumber(summary?.closingBalance || 0)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-white">{formatDecimalNumber(summary?.closingBalance || 0)}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center">
                                            {reconciliationData.every(r => r.isValid) ? (
                                                <CheckIcon className="w-6 h-6 text-green-500" />
                                            ) : (
                                                <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center text-xs text-gray-400">AED</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="mt-4 text-xs text-gray-500 italic flex items-center">
                    <InformationCircleIcon className="w-3 h-3 mr-1" />
                    Formula: Opening Balance - Total Debit + Total Credit = Closing Balance
                </p>
            </div>

            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <button onClick={handleSummarizationContinue} disabled={editedTransactions.length === 0} className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all">
                    Confirm & Continue
                </button>
            </div>
        </div>
    );
};
