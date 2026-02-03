import React from 'react';
import { useCtType2 } from '../Layout';
import { DocumentTextIcon, DocumentArrowDownIcon } from '../../../icons';
import { formatWholeNumber } from '../types';
import { InvoiceSummarizationView } from '../../../InvoiceSummarizationView';

export const Step4: React.FC = () => {
    const {
        salesInvoices,
        purchaseInvoices,
        currency,
        companyName,
        company,
        companyTrn,
        handleBack,
        handleExportStep4Invoices,
        setCurrentStep
    } = useCtType2();

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Invoice Summarization</h2>
            <p className="text-gray-400">Review the extracted sales and purchase invoices.</p>
            <InvoiceSummarizationView
                salesInvoices={salesInvoices}
                purchaseInvoices={purchaseInvoices}
                currency={currency}
                companyName={companyName || company?.name || ''}
                companyTrn={companyTrn || company?.trn}
            />
            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExportStep4Invoices}
                        className="flex items-center px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-bold rounded-lg border border-white/10 transition-all text-sm"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4 mr-2 text-blue-400" />
                        Export Step 4
                    </button>
                    <button onClick={() => setCurrentStep(5)} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg">
                        Confirm & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};
