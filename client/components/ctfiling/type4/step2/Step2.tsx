
import React from 'react';
import { useCtType4 } from '../types';
import { FileUploadArea } from '../../../VatFilingUpload';
import { extractVat201Totals } from '../../../../services/geminiService';
import { convertFileToParts } from '../../../../utils/fileUtils';
import { DocumentTextIcon, DocumentDuplicateIcon, ChevronLeftIcon, SparklesIcon } from '../../../icons';

export const Step2: React.FC = () => {
    const {
        additionalFiles,
        setAdditionalFiles,
        isExtractingVat,
        setIsExtractingVat,
        setAdditionalDetails,
        setCurrentStep
    } = useCtType4();

    const handleExtractAdditionalData = async () => {
        if (additionalFiles.length === 0) return;
        setIsExtractingVat(true);
        try {
            const results = await Promise.all(additionalFiles.map(async (file) => {
                const parts = await convertFileToParts(file);
                const details = await extractVat201Totals(parts) as any;

                if (!details || (details.sales?.total === 0 && details.purchases?.total === 0 && details.netVatPayable === 0)) {
                    console.warn(`Extraction returned empty/null for ${file.name}`);
                }

                return {
                    fileName: file.name,
                    periodFrom: details.periodFrom,
                    periodTo: details.periodTo,
                    sales: {
                        zeroRated: details.sales?.zeroRated || 0,
                        standardRated: details.sales?.standardRated || 0,
                        vatAmount: details.sales?.vatAmount || 0,
                        total: details.sales?.total || 0
                    },
                    purchases: {
                        zeroRated: details.purchases?.zeroRated || 0,
                        standardRated: details.purchases?.standardRated || 0,
                        vatAmount: details.purchases?.vatAmount || 0,
                        total: details.purchases?.total || 0
                    },
                    netVatPayable: details.netVatPayable || 0
                };
            }));

            const anyData = results.some(r => r.sales.total > 0 || r.purchases.total > 0 || r.netVatPayable !== 0);
            if (!anyData) {
                alert("We couldn't extract any significant VAT data from the uploaded files. Please ensure they are valid VAT 201 returns and try again.");
                setIsExtractingVat(false);
                return;
            }

            setAdditionalDetails({ vatFileResults: results });
            setCurrentStep(3); // Proceed to VAT Summary (Step 3)
        } catch (e: any) {
            console.error("Failed to extract per-file VAT totals", e);
            alert(`VAT extraction failed: ${e.message || "Unknown error"}. Please try again.`);
        } finally {
            setIsExtractingVat(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/5">
                            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">VAT Docs Upload</h3>
                            <p className="text-gray-400 mt-1 max-w-2xl">Upload relevant VAT certificates (VAT 201), sales/purchase ledgers, or other supporting documents.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="min-h-[400px]">
                            <FileUploadArea
                                title="Upload VAT Documents"
                                subtitle="VAT 201 returns, Sales/Purchase Ledgers, etc."
                                icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                                selectedFiles={additionalFiles}
                                onFilesSelect={setAdditionalFiles}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button
                    onClick={() => setCurrentStep(1)} // Back to Step 1
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleExtractAdditionalData}
                        disabled={additionalFiles.length === 0 || isExtractingVat}
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isExtractingVat ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                                Extracting VAT Data...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-5 h-5 mr-2" />
                                Extract & Continue
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
