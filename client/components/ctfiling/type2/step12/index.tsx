import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step12: React.FC = () => {
    const {
        DocumentTextIcon,
        FileUploadArea,
        DocumentDuplicateIcon,
        louFiles,
        setLouFiles,
        handleBack,
        ChevronLeftIcon,
        handleContinueToQuestionnaire,
        ChevronRightIcon
    } = useCtType2StepContext();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/5">
                            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Letter of Undertaking (LOU)</h3>
                            <p className="text-gray-400 mt-1 max-w-2xl">Upload Signed Letter of Undertaking for record purposes.</p>
                        </div>
                    </div>
                </div>
                <div className="p-8">
                    <div className="min-h-[400px]">
                        <FileUploadArea
                            title="Upload LOU Documents"
                            subtitle="Support PDF, JPG, PNG"
                            icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                            selectedFiles={louFiles}
                            onFilesSelect={setLouFiles}
                        />
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
                <button
                    onClick={handleContinueToQuestionnaire}
                    className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all"
                >
                    Continue to Questionnaire
                    <ChevronRightIcon className="w-5 h-5 ml-2" />
                </button>
            </div>
        </div>
    );
};
