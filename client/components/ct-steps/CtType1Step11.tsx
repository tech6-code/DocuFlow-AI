import React from 'react';
import {
    ChartBarIcon,
    ArrowPathIcon,
    SparklesIcon,
    ChevronLeftIcon
} from '../icons';

interface CtType1Step11Props {
    reportForm: any;
    isGeneratingReport: boolean;
    handleReportFormChange: (field: string, value: any) => void;
    handleBack: () => void;
    handleGenerateFinalReport: () => Promise<void>;
    questionnaireAnswers: Record<number, string>;
}

export const CtType1Step11: React.FC<CtType1Step11Props> = ({
    reportForm,
    isGeneratingReport,
    handleReportFormChange,
    handleBack,
    handleGenerateFinalReport,
    questionnaireAnswers
}) => {
    const isSbrActive = questionnaireAnswers[6] === 'Yes';

    const ReportInput = ({ field, label, type = "text", placeholder = "" }: { field: string, label: string, type?: string, placeholder?: string }) => {
        let value = reportForm[field] || '';
        const isDisabled = isSbrActive && type === 'number';
        if (isDisabled) value = 0;

        return (
            <div className={`space-y-1.5 ${isDisabled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">{label}</label>
                <input
                    type={type}
                    value={value}
                    disabled={isDisabled}
                    placeholder={placeholder}
                    onChange={(e) => handleReportFormChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                    className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-all font-medium placeholder:text-gray-600"
                />
            </div>
        );
    };

    const ReportNumberInput = ({ field, label }: { field: string, label: string }) => {
        const value = isSbrActive ? 0 : (reportForm[field] || 0);

        return (
            <div className={`space-y-1.5 ${isSbrActive ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">{label}</label>
                <input
                    type="number"
                    step="0.01"
                    value={value}
                    disabled={isSbrActive}
                    onChange={(e) => handleReportFormChange(field, parseFloat(e.target.value) || 0)}
                    className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-right text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono font-bold"
                />
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
            <div className="bg-[#0B1120] rounded-[2.5rem] border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-10 border-b border-gray-800 bg-gradient-to-r from-blue-900/10 to-indigo-900/10 flex justify-between items-center">
                    <div className="flex items-center gap-6">
                        <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg shadow-blue-500/5">
                            <ChartBarIcon className="w-10 h-10 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-3xl font-black text-white tracking-tight uppercase">Final CT Report</h3>
                            <p className="text-gray-400 mt-1 font-medium italic">Configure filing parameters and generate your comprehensive tax report.</p>
                        </div>
                    </div>
                </div>

                <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* General Information */}
                    <div className="space-y-8">
                        <h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em] border-l-4 border-blue-500 pl-4 py-1">Business Identifiers</h4>
                        <div className="grid grid-cols-1 gap-6">
                            <ReportInput field="trn" label="Tax Registration Number (TRN)" placeholder="100XXXXXXXXXXXXX" />
                            <ReportInput field="licenseNumber" label="Trade License Number" />
                            <ReportInput field="legalEntityType" label="Legal Entity Type" />
                        </div>
                    </div>

                    {/* Tax Parameters */}
                    <div className="space-y-8">
                        <h4 className="text-sm font-black text-indigo-400 uppercase tracking-[0.2em] border-l-4 border-indigo-500 pl-4 py-1">Tax Adjustments</h4>
                        <div className="grid grid-cols-1 gap-6">
                            {isSbrActive && (
                                <div className="p-4 bg-emerald-900/10 border border-emerald-500/30 rounded-xl mb-4">
                                    <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mb-1">Small Business Relief Active</p>
                                    <p className="text-xs text-gray-400 leading-relaxed italic">Taxable income and specific adjustments are locked as SBR applies.</p>
                                </div>
                            )}
                            <ReportNumberInput field="disallowedEntertainment" label="Disallowed Entertainment (50%)" />
                            <ReportNumberInput field="finesPenalties" label="Fines & Penalties" />
                            <ReportNumberInput field="donationsDisallowed" label="Disallowed Donations" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={handleBack} className="flex items-center px-10 py-4 bg-transparent text-gray-400 hover:text-white font-black text-xs uppercase tracking-[0.2em] transition-all">
                    <ChevronLeftIcon className="w-5 h-5 mr-2" />
                    Adjust Questionnaire
                </button>
                <div className="flex gap-6 items-center">
                    <button
                        onClick={handleGenerateFinalReport}
                        disabled={isGeneratingReport}
                        className="px-20 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-3xl shadow-2xl shadow-blue-500/40 transform hover:-translate-y-2 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale uppercase tracking-widest text-sm flex items-center"
                    >
                        {isGeneratingReport ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin mr-4" />
                                Analyzing & Generating...
                            </>
                        ) : (
                            <>
                                <SparklesIcon className="w-5 h-5 mr-4 text-blue-200" />
                                Generate Intelligence Report
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
