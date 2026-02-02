import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    DocumentTextIcon,
    DocumentDuplicateIcon,
    ChevronLeftIcon
} from '../../../icons';
import { FileUploadArea } from '../../../VatFilingUpload';
import { CtType1Context } from '../types';

export const Step3: React.FC = () => {
    const {
        additionalFiles,
        setAdditionalFiles,
        handleBack,
        handleVatUploadContinue,
        isVatProcessing,
        vatProcessingStatus
    } = useOutletContext<CtType1Context>();

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
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={handleVatUploadContinue}
                        disabled={isVatProcessing}
                        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/20 disabled:opacity-50 transition-all flex items-center"
                    >
                        {isVatProcessing ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></div>
                                {vatProcessingStatus || 'Processing...'}
                            </>
                        ) : 'Continue to VAT Summary'}
                    </button>
                </div>
            </div>
        </div>
    );
};
