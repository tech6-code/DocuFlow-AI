import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step14: React.FC = () => {
    const {
        ftaFormValues,
        REPORT_STRUCTURE,
        InformationCircleIcon,
        IdentificationIcon,
        BuildingOfficeIcon,
        IncomeIcon,
        AssetIcon,
        ListBulletIcon,
        ChartBarIcon,
        ClipboardCheckIcon,
        SparklesIcon,
        reportForm,
        handleBack,
        handleDownloadPDF,
        isDownloadingPdf,
        DocumentArrowDownIcon,
        handleExportStepReport,
        setOpenReportSection,
        openReportSection,
        ChevronDownIcon,
        ReportNumberInput,
        ReportInput
    } = useCtType2StepContext();

    if (!ftaFormValues) {
        return <div className="text-center p-20 bg-gray-900 rounded-xl border border-gray-800">Calculating report data...</div>;
    }

    const iconMap: Record<string, any> = {
        InformationCircleIcon,
        IdentificationIcon,
        BuildingOfficeIcon,
        IncomeIcon,
        AssetIcon,
        ListBulletIcon,
        ChartBarIcon,
        ClipboardCheckIcon
    };

    const sections = REPORT_STRUCTURE.map((s: any) => ({
        ...s,
        icon: iconMap[s.iconName] || InformationCircleIcon
    }));

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="bg-[#0F172A] rounded-2xl border border-gray-700 shadow-2xl overflow-hidden ring-1 ring-gray-800">
                <div className="p-8 border-b border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0A0F1D] gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/30">
                            <SparklesIcon className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Corporate Tax Return</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{reportForm.taxableNameEn}</p>
                                <span className="h-1 w-1 bg-gray-700 rounded-full"></span>
                                <p className="text-xs text-blue-400 font-mono">DRAFT READY</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <button onClick={handleBack} className="flex-1 sm:flex-none px-6 py-2.5 border border-gray-700 text-gray-500 hover:text-white rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-800">Back</button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isDownloadingPdf}
                            className="flex-1 sm:flex-none px-8 py-2.5 bg-gray-800 text-white font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                            {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
                        </button>
                        <button
                            onClick={handleExportStepReport}
                            className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                            Export Step 14
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-gray-800">
                    {sections.map((section: any) => (
                        <div key={section.id} className="group">
                            <button
                                onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)}
                                className="w-full flex items-center justify-between p-6 hover:bg-gray-800/30 transition-all text-left"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-xl border transition-all duration-500 ${openReportSection === section.title
                                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-lg shadow-blue-500/10'
                                        : 'bg-gray-800 border-gray-700 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-400'
                                        }`}>
                                        <section.icon className="w-5 h-5" />
                                    </div>
                                    <h4 className={`text-sm font-black uppercase tracking-widest transition-colors ${openReportSection === section.title ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                                        }`}>{section.title}</h4>
                                </div>
                                <ChevronDownIcon className={`w-5 h-5 text-gray-600 transition-transform duration-500 ${openReportSection === section.title ? 'rotate-180 text-blue-400' : 'group-hover:text-gray-400'}`} />
                            </button>

                            {openReportSection === section.title && (
                                <div className="p-8 bg-black/40 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-300">
                                    <div className="flex flex-col gap-y-4 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                        {section.fields.map((f: any, fIdx: number) => (
                                            f.type === 'header' ? (
                                                <div key={f.field} className="pt-8 pb-3 border-b border-gray-800/80 mb-4 first:pt-0">
                                                    <h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                </div>
                                            ) : (
                                                <div key={f.field} className="flex flex-col py-4 border-b border-gray-800/30 last:border-0 group/field">
                                                    <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-blue-400' : 'text-gray-500 group-hover/field:text-gray-400'}`}>{f.label}</label>
                                                    <div className="bg-gray-900/40 rounded-lg p-1 border border-transparent group-hover/field:border-gray-800/50 transition-all relative">
                                                        {f.type === 'number' ? (
                                                            <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} />
                                                        ) : (
                                                            <ReportInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} />
                                                        )}
                                                        {f.labelPrefix && (
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-gray-600 uppercase tracking-tighter pointer-events-none">
                                                                {f.labelPrefix}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                <div className="p-6 bg-gray-950 border-t border-gray-800 text-center"><p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">This is a system generated document and does not require to be signed.</p></div>
            </div>
        </div>
    );
};
