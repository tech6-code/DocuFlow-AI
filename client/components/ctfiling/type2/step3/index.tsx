import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step3: React.FC = () => {
    const {
        FileUploadArea,
        DocumentTextIcon,
        invoiceFiles,
        onVatInvoiceFilesSelect,
        onProcess,
        hasProcessedInvoices,
        setCurrentStep,
        setIsProcessingInvoices,
        setHasProcessedInvoices,
        isProcessingInvoices,
        LoadingIndicator,
        progress,
        progressMessage,
        handleBack,
        SparklesIcon
    } = useCtType2StepContext();

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Upload Invoices & Bills</h2>
            <p className="text-gray-400">Upload your sales and purchase invoices for extraction and reconciliation.</p>
            <FileUploadArea
                title="Invoices & Bills"
                subtitle="Upload invoice PDF or image files."
                icon={<DocumentTextIcon className="w-6 h-6 mr-1" />}
                selectedFiles={invoiceFiles || []}
                onFilesSelect={onVatInvoiceFilesSelect}
            />
            {invoiceFiles && invoiceFiles.length > 0 && onProcess && (
                <div className="flex justify-end pt-4">
                    <button
                        onClick={() => {
                            if (!onProcess) return;
                            if (hasProcessedInvoices) {
                                setCurrentStep(4);
                                return;
                            }
                            setIsProcessingInvoices(true);
                            Promise.resolve(onProcess('invoices'))
                                .then(() => {
                                    setHasProcessedInvoices(true);
                                    setCurrentStep(4);
                                })
                                .catch((err: any) => {
                                    console.error("Invoice extraction failed:", err);
                                    alert("Invoice extraction failed. Please try again.");
                                })
                                .finally(() => setIsProcessingInvoices(false));
                        }}
                        className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <SparklesIcon className="w-5 h-5 mr-2" />
                        Extract & Continue
                    </button>
                </div>
            )}

            {isProcessingInvoices && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-xl mx-4 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-8">
                        <LoadingIndicator
                            progress={progress || 60}
                            statusText={progressMessage || "Analyzing invoices..."}
                            title="Analyzing Document"
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-4">
                <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
            </div>
        </div>
    );
};
