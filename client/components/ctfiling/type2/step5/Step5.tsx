import React from 'react';
import { useCtType2 } from '../Layout';
import { ReconciliationTable } from '../../../ReconciliationTable';
import { ArrowsRightLeftIcon, DocumentArrowDownIcon } from '../../../icons';
import { formatWholeNumber } from '../types';

export const Step5: React.FC = () => {
    const {
        salesInvoices,
        purchaseInvoices,
        editedTransactions,
        currency,
        handleBack,
        handleExportStep5Reconciliation,
        handleReconContinue
    } = useCtType2();

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Bank Reconciliation</h2>
            <p className="text-gray-400">Match extracted invoices against bank statement transactions.</p>
            <ReconciliationTable
                invoices={[...salesInvoices, ...purchaseInvoices]}
                transactions={editedTransactions}
                currency={currency}
            />
            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportStep5Reconciliation}
                        className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg border border-white/10 transition-all text-sm"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400" />
                        Export Step 5
                    </button>
                    <button onClick={handleReconContinue} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};
