import React from 'react';
import {
    UploadIcon,
    DocumentTextIcon,
    XMarkIcon,
    ArrowPathIcon
} from '../icons';

interface CtType1Step3Props {
    additionalFiles: File[];
    setAdditionalFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isExtracting: boolean;
    handleExtractAdditionalData: () => Promise<void>;
    handleBack: () => void;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export const CtType1Step3: React.FC<CtType1Step3Props> = ({
    additionalFiles,
    setAdditionalFiles,
    isExtracting,
    handleExtractAdditionalData,
    handleBack,
    setCurrentStep
}) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAdditionalFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight">VAT Returns Upload</h2>
                    <p className="text-gray-400">Please upload your VAT 201 Returns for the tax period to reconcile with bank data.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-4">
                        <label className="block w-full cursor-pointer group">
                            <div className="border-2 border-dashed border-gray-700 group-hover:border-blue-500 rounded-xl p-10 flex flex-col items-center justify-center transition-all bg-gray-800/30 group-hover:bg-blue-500/5">
                                <UploadIcon className="w-12 h-12 text-gray-500 group-hover:text-blue-400 mb-4 transition-colors" />
                                <span className="text-white font-semibold group-hover:text-blue-300">Choose PDF Files</span>
                                <span className="text-gray-500 text-xs mt-2">Only VAT 201 returns (PDF)</span>
                                <input type="file" multiple accept="application/pdf" className="hidden" onChange={handleFileChange} />
                            </div>
                        </label>
                    </div>

                    <div className="bg-black/20 rounded-xl p-4 border border-gray-800 min-h-[200px]">
                        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4 px-2">Selected Documents ({additionalFiles.length})</h4>
                        {additionalFiles.length === 0 ? (
                            <div className="h-40 flex flex-col items-center justify-center text-gray-600 italic text-sm">
                                <DocumentTextIcon className="w-8 h-8 mb-2 opacity-20" />
                                No files selected
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                                {additionalFiles.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg group animate-in slide-in-from-right-2 duration-300">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
                                                <DocumentTextIcon className="w-4 h-4 text-red-400" />
                                            </div>
                                            <span className="text-xs text-gray-300 truncate max-w-[150px] font-medium">{file.name}</span>
                                        </div>
                                        <button onClick={() => removeFile(idx)} className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                                            <XMarkIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center bg-gray-800/50 p-6 rounded-xl border border-gray-700/50">
                    <button onClick={handleBack} className="text-gray-400 hover:text-white font-medium transition-colors">Go Back</button>
                    <div className="flex gap-4">
                        <button onClick={() => setCurrentStep(5)} className="px-6 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors">Skip for Now</button>
                        <button
                            onClick={handleExtractAdditionalData}
                            disabled={additionalFiles.length === 0 || isExtracting}
                            className={`px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-500/20 flex items-center gap-3 transform transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed`}
                        >
                            {isExtracting ? (
                                <>
                                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                    <span>Extracting Data...</span>
                                </>
                            ) : (
                                <span>Start Extraction</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
