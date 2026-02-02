import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    DocumentArrowDownIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon
} from '../../../icons';
import {
    formatDecimalNumber
} from '../../../CtType1Results';
import { CtType1Context } from '../types';

export const Step2: React.FC = () => {
    const {
        summaryFileFilter,
        setSummaryFileFilter,
        uniqueFiles,
        reconciliationData,
        currency,
        summaryData,
        handleExportStepSummary,
        overallSummary,
        handleBack,
        handleSummarizationContinue,
        editedTransactions
    } = useOutletContext<CtType1Context>();

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
                        <button onClick={handleExportStepSummary} className="text-gray-400 hover:text-white">
                            <DocumentArrowDownIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-gray-700">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th className="px-6 py-3">Accounts</th>
                                <th className="px-6 py-3 text-right">Debit {summaryFileFilter !== 'ALL' ? `(${reconciliationData[0]?.currency || currency})` : '(AED)'}</th>
                                <th className="px-6 py-3 text-right">Credit {summaryFileFilter !== 'ALL' ? `(${reconciliationData[0]?.currency || currency})` : '(AED)'}</th>
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
                                    <td className="px-6 py-4 text-right font-mono text-blue-200">{formatDecimalNumber(overallSummary?.openingBalance || 0)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-red-400">{formatDecimalNumber(reconciliationData.reduce((s, r) => s + r.totalDebit, 0))}</td>
                                    <td className="px-6 py-4 text-right font-mono text-green-400">{formatDecimalNumber(reconciliationData.reduce((s, r) => s + r.totalCredit, 0))}</td>
                                    <td className="px-6 py-4 text-right font-mono text-blue-300 shadow-inner">{formatDecimalNumber(overallSummary?.closingBalance || 0)}</td>
                                    <td className="px-6 py-4 text-right font-mono text-white">{formatDecimalNumber(overallSummary?.closingBalance || 0)}</td>
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
