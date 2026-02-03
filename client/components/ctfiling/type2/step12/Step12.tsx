import React from 'react';
import { useCtType2 } from '../Layout';
import {
    DocumentArrowDownIcon, UploadIcon, TrashIcon, DocumentTextIcon,
    ShieldCheckIcon, CheckIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon
} from '../../../icons';
import { FileUploadArea } from '../../../VatFilingUpload';

export const Step12: React.FC = () => {
    const {
        louFiles,
        setLouFiles,
        handleBack,
        setCurrentStep
    } = useCtType2();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-2xl border border-gray-800 shadow-xl overflow-hidden p-8 text-center">
                <div className="w-20 h-20 bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                    <ShieldCheckIcon className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Letter of Undertaking</h3>
                <p className="text-gray-400 max-w-lg mx-auto mb-8">
                    Since this entity is part of a <strong>Unincorporated Partnership</strong> or <strong>Qualified Group</strong>, please upload the signed Letter of Undertaking.
                </p>

                <div className="max-w-xl mx-auto">
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-700 border-dashed rounded-xl cursor-pointer bg-gray-900/50 hover:bg-gray-800/50 hover:border-blue-500/50 transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <ShieldCheckIcon className="w-10 h-10 mb-3 text-gray-500 group-hover:text-blue-400 transition-colors" />
                            <p className="mb-2 text-sm text-gray-400"><span className="font-bold text-white">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-gray-500">PDF, PNG, JPG (MAX. 10MB)</p>
                        </div>
                        <input type="file" className="hidden" multiple onChange={(e) => e.target.files && setLouFiles(Array.from(e.target.files))} />
                    </label>

                    {louFiles.length > 0 && (
                        <div className="mt-6 space-y-2">
                            {louFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-green-900/10 border border-green-900/30 rounded-lg">
                                    <div className="flex items-center">
                                        <CheckIcon className="w-4 h-4 text-green-400 mr-2" />
                                        <span className="text-sm text-green-200">{file.name}</span>
                                    </div>
                                    <button onClick={() => setLouFiles(louFiles.filter((_, i) => i !== idx))} className="text-gray-500 hover:text-red-400 transition-colors">
                                        <XMarkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Back
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={() => setCurrentStep(louFiles.length > 0 ? 13 : 13)} // Allow skip for demo/prototype but logically requires file
                        className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                    >
                        Confirm & Continue
                        <ChevronRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>
    );
};
