import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step2: React.FC = () => {
    const {
        summaryData,
        summaryFileFilter,
        setSummaryFileFilter,
        uniqueFiles,
        handleExportStepSummary,
        DocumentArrowDownIcon,
        formatNumber,
        statementReconciliationData,
        CheckIcon,
        ExclamationTriangleIcon,
        InformationCircleIcon,
        handleBack,
        handleConfirmSummarization
    } = useCtType2StepContext();

    const totalDebit = summaryData.reduce((sum: number, row: any) => sum + row.debit, 0);
    const totalCredit = summaryData.reduce((sum: number, row: any) => sum + row.credit, 0);
    const summaryCurrency = summaryFileFilter === 'ALL' ? 'AED' : (statementReconciliationData[0]?.currency || 'AED');

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
                            {uniqueFiles.map((f: any) => <option key={f} value={f}>{f}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleExportStepSummary(summaryData);
                            }}
                            className="text-gray-400 hover:text-white"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Accounts</th>
                                <th className="px-6 py-3 text-right">Debit {summaryFileFilter !== 'ALL' ? `(${summaryCurrency})` : '(AED)'}</th>
                                <th className="px-6 py-3 text-right">Credit {summaryFileFilter !== 'ALL' ? `(${summaryCurrency})` : '(AED)'}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {summaryData.map((row: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium">{row.category}</td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(row.debit)}</td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(row.credit)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-800/80 font-bold border-t border-gray-700">
                            <tr>
                                <td className="px-6 py-3 text-white uppercase tracking-wider">
                                    {summaryFileFilter === 'ALL' ? 'Grand Total in AED' : 'Grand Total'}
                                </td>
                                <td className="px-6 py-3 text-right font-mono text-red-400">{formatNumber(totalDebit)}</td>
                                <td className="px-6 py-3 text-right font-mono text-green-400">{formatNumber(totalCredit)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

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
                            {statementReconciliationData.map((recon: any, idx: number) => (
                                <tr key={idx} className="hover:bg-gray-800/50">
                                    <td className="px-6 py-3 text-white font-medium truncate max-w-xs" title={recon.fileName}>{recon.fileName}</td>
                                    <td className="px-6 py-3 text-right font-mono text-blue-200">
                                        {summaryFileFilter === 'ALL' ? (
                                            <div className="flex flex-col items-end">
                                                <span>{formatNumber(recon.openingBalance)} {recon.currency}</span>
                                                <span className="text-[10px] text-gray-500">{formatNumber(recon.openingBalanceAed)} AED</span>
                                            </div>
                                        ) : (
                                            <span>{formatNumber(recon.openingBalance)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-red-400">
                                        {summaryFileFilter === 'ALL' ? (
                                            <div className="flex flex-col items-end">
                                                <span>{formatNumber(recon.totalDebit)} {recon.currency}</span>
                                                <span className="text-[10px] text-gray-500">{formatNumber(recon.totalDebitAed)} AED</span>
                                            </div>
                                        ) : (
                                            <span>{formatNumber(recon.totalDebit)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-green-400">
                                        {summaryFileFilter === 'ALL' ? (
                                            <div className="flex flex-col items-end">
                                                <span>{formatNumber(recon.totalCredit)} {recon.currency}</span>
                                                <span className="text-[10px] text-gray-500">{formatNumber(recon.totalCreditAed)} AED</span>
                                            </div>
                                        ) : (
                                            <span>{formatNumber(recon.totalCredit)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-blue-300 font-bold">
                                        {summaryFileFilter === 'ALL' ? (
                                            <div className="flex flex-col items-end">
                                                <span>{formatNumber(recon.calculatedClosing)} {recon.currency}</span>
                                                <span className="text-[10px] text-gray-500">{formatNumber(recon.calculatedClosingAed)} AED</span>
                                            </div>
                                        ) : (
                                            <span>{formatNumber(recon.calculatedClosing)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono text-white">
                                        {summaryFileFilter === 'ALL' ? (
                                            <div className="flex flex-col items-end">
                                                <span>{formatNumber(recon.closingBalance)} {recon.currency}</span>
                                                <span className="text-[10px] text-gray-500">{formatNumber(recon.closingBalanceAed)} AED</span>
                                            </div>
                                        ) : (
                                            <span>{formatNumber(recon.closingBalance)}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <div className="flex justify-center">
                                            {recon.isValid ? (
                                                <span title="Balanced">
                                                    <CheckIcon className="w-5 h-5 text-green-500" />
                                                </span>
                                            ) : (
                                                <span title={`Difference: ${formatNumber(recon.diff)}`}>
                                                    <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="text-[10px] text-gray-400">{recon.currency}</span>
                                    </td>
                                </tr>
                            ))}
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
                <button onClick={handleConfirmSummarization} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                    Confirm & Continue
                </button>
            </div>
        </div>
    );
};
