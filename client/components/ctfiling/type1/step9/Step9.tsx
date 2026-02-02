import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    DocumentTextIcon,
    DocumentDuplicateIcon,
    ChevronLeftIcon
} from '../../../icons';
import { FileUploadArea } from '../../../VatFilingUpload';
import { CtType1Context } from '../types';

export const Step9: React.FC = () => {
    const {
        louFiles,
        setLouFiles,
        handleBack,
        handleContinueToQuestionnaire
    } = useOutletContext<CtType1Context>();

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden ring-1 ring-gray-800">
                <div className="p-8 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-blue-900/30 rounded-2xl flex items-center justify-center border border-blue-800">
                            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight uppercase">Letters of Undertaking (LOU)</h3>
                            <p className="text-sm text-gray-400 mt-1">Upload supporting LOU documents for reference.</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    <FileUploadArea
                        title="Upload LOU Documents"
                        subtitle="PDF, DOCX, or Images"
                        icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                        selectedFiles={louFiles}
                        onFilesSelect={setLouFiles}
                    />
                </div>

                <div className="p-8 bg-black border-t border-gray-800 flex justify-between items-center">
                    <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all">
                        <ChevronLeftIcon className="w-5 h-5 mr-2" /> Back
                    </button>
                    <button
                        onClick={handleContinueToQuestionnaire}
                        className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center transition-all transform hover:scale-[1.02]"
                    >
                        Proceed to Questionnaire
                    </button>
                </div>
            </div>
        </div>
    );
};
