import React from 'react';
import {
    UploadIcon,
    ArrowPathIcon,
    CheckIcon,
    DocumentTextIcon,
    XMarkIcon,
    SparklesIcon
} from '../icons';

interface CtType1Step9Props {
    louFiles: File[];
    setLouFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isAnalyzingLou: boolean;
    handleAnalyzeLou: () => Promise<void>;
    handleBack: () => void;
    setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
}

export const CtType1Step9: React.FC<CtType1Step9Props> = ({
    louFiles,
    setLouFiles,
    isAnalyzingLou,
    handleAnalyzeLou,
    handleBack,
    setCurrentStep
}) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setLouFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setLouFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30 shadow-lg shadow-purple-500/5">
                            <DocumentTextIcon className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Step 9: LOU Upload</h3>
                            <p className="text-gray-400 mt-1 max-w-lg">Upload Letter of Undertaking or other legal supporting documents for compliance analysis.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <label className="cursor-pointer group">
                            <div className="border-2 border-dashed border-gray-700 group-hover:border-purple-500 rounded-2xl p-12 flex flex-col items-center justify-center transition-all bg-gray-800/20 group-hover:bg-purple-500/5 h-full min-h-[300px]">
                                <UploadIcon className="w-16 h-16 text-gray-600 group-hover:text-purple-400 mb-6 transition-colors" />
                                <span className="text-white font-bold group-hover:text-purple-300 text-lg">Choose PDF Files</span>
                                <span className="text-gray-500 text-xs mt-3 uppercase tracking-widest font-black opacity-60">Legal Documents only</span>
                                <input type="file" multiple accept="application/pdf" className="hidden" onChange={handleFileChange} />
                            </div>
                        </label>

                        <div className="bg-black/40 rounded-2xl p-6 border border-gray-800 min-h-[300px]">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex justify-between items-center">
                                Selected Documents
                                <span className="bg-gray-800 px-2.5 py-1 rounded-full text-white">{louFiles.length}</span>
                            </h4>
                            {louFiles.length === 0 ? (
                                <div className="h-48 flex flex-col items-center justify-center text-gray-700 italic text-sm">
                                    <DocumentTextIcon className="w-12 h-12 mb-3 opacity-10" />
                                    No files attached
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {louFiles.map((file, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-gray-800/40 rounded-xl group border border-gray-700/50 hover:border-purple-500/30 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                                                    <DocumentTextIcon className="w-5 h-5 text-red-400" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-white font-bold truncate max-w-[140px]">{file.name}</span>
                                                    <span className="text-[9px] text-gray-500 uppercase">PDF • {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                                                </div>
                                            </div>
                                            <button onClick={() => removeFile(idx)} className="p-2 text-gray-600 hover:text-red-400 transition-colors">
                                                <XMarkIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest transition-all">Go Back</button>
                <div className="flex gap-4">
                    <button onClick={() => setCurrentStep(10)} className="px-6 py-3 text-gray-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-all">Skip Step</button>
                    <button
                        onClick={handleAnalyzeLou}
                        disabled={louFiles.length === 0 || isAnalyzingLou}
                        className="flex items-center px-10 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black rounded-xl shadow-2xl shadow-purple-900/20 transform hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                    >
                        {isAnalyzingLou ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin mr-3" />
                                <span className="uppercase tracking-widest text-xs">Analyzing Legal docs...</span>
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-5 h-5 mr-3 text-purple-200" />
                                <span className="uppercase tracking-widest text-xs">Analyze & Continue</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
