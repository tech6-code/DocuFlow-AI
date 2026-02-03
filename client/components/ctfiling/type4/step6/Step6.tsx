
import React from 'react';
import { useCtType4 } from '../types';
import { FileUploadArea } from '../../../VatFilingUpload';
import * as XLSX from 'xlsx';
import {
    DocumentTextIcon,
    DocumentArrowDownIcon,
    DocumentDuplicateIcon,
    ChevronLeftIcon
} from '../../../icons';

export const Step6: React.FC = () => {
    const {
        louFiles,
        setLouFiles,
        setCurrentStep,
        companyName
    } = useCtType4();

    const applySheetStyling = (worksheet: any, headerRows: number) => {
        // Placeholder
    };

    const handleExportLou = () => {
        const louData = [["STEP 6: LOU DOCUMENTS (REFERENCE ONLY)"], [], ["Filename", "Size (bytes)", "Status"]];
        louFiles.forEach(file => {
            louData.push([file.name, file.size, "Uploaded"]);
        });
        const ws = XLSX.utils.aoa_to_sheet(louData);
        ws['!cols'] = [{ wch: 50 }, { wch: 20 }, { wch: 15 }];
        applySheetStyling(ws, 3);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "LOU Documents");
        XLSX.writeFile(wb, `${companyName}_Step6_LOU.xlsx`);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden p-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-2xl flex items-center justify-center border border-blue-500/30">
                            <DocumentTextIcon className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-tight">Letters of Undertaking (LOU)</h3>
                            <p className="text-gray-400 mt-1">Upload supporting LOU documents for reference.</p>
                        </div>
                    </div>
                    <button onClick={handleExportLou} className="flex items-center gap-2 px-4 py-2 bg-[#0F172A] border border-gray-800 rounded-xl text-xs font-bold text-gray-400 hover:text-white transition-all transform hover:scale-105">
                        <DocumentArrowDownIcon className="w-4 h-4" /> Export
                    </button>
                </div>

                <FileUploadArea
                    title="Upload LOU Documents"
                    subtitle="PDF, DOCX, or Images"
                    icon={<DocumentDuplicateIcon className="w-6 h-6" />}
                    selectedFiles={louFiles}
                    onFilesSelect={setLouFiles}
                />

                <div className="mt-8 flex justify-between items-center bg-[#0F172A]/50 p-6 rounded-2xl border border-gray-800/50">
                    <button onClick={() => setCurrentStep(5)} className="flex items-center px-6 py-3 text-gray-400 hover:text-white font-bold transition-all"><ChevronLeftIcon className="w-5 h-5 mr-2" /> Back</button>
                    <button onClick={() => setCurrentStep(7)} className="px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl transform hover:-translate-y-0.5 transition-all">Proceed to Questionnaire</button>
                </div>
            </div>
        </div>
    );
};
