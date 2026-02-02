import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    SparklesIcon,
    DocumentArrowDownIcon,
    ChevronDownIcon,
    InformationCircleIcon,
    IdentificationIcon,
    BuildingOfficeIcon,
    IncomeIcon,
    AssetIcon,
    ListBulletIcon,
    ChartBarIcon,
    ClipboardCheckIcon
} from '../../../icons';
import { CtType1Context, REPORT_STRUCTURE } from '../types';

const ReportInput = ({ field, className = '', reportForm, onChange }: { field: string, className?: string, reportForm: any, onChange: (field: string, value: any) => void }) => (
    <input
        type="text"
        value={reportForm[field] || ''}
        onChange={(e) => onChange(field, e.target.value)}
        className={`w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600 ${className}`}
    />
);

const ReportNumberInput = ({ field, className = '', reportForm, onChange }: { field: string, className?: string, reportForm: any, onChange: (field: string, value: any) => void }) => (
    <div className="relative">
        <input
            type="text"
            value={reportForm[field] || ''}
            onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.-]/g, '');
                onChange(field, val);
            }}
            className={`w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-600 font-mono text-right ${className}`}
            placeholder="0.00"
        />
        <span className="absolute left-3 top-2 text-gray-500 text-sm">AED</span>
    </div>
);

export const Step11: React.FC = () => {
    const {
        ftaFormValues,
        reportForm,
        handleReportFormChange,
        handleExportStepReport,
        openReportSection,
        setOpenReportSection,
        handleDownloadPDF,
        isDownloadingPdf,
        handleBack
    } = useOutletContext<CtType1Context>();

    if (!ftaFormValues) return <div className="text-center p-20 bg-gray-900 rounded-xl border border-gray-800 text-white">Calculating report data...</div>;

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

    const sections = REPORT_STRUCTURE.map(s => ({
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
                            className={`flex-1 sm:flex-none px-8 py-2.5 bg-blue-600 text-white font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-blue-500 transform hover:scale-[1.03] flex items-center justify-center ${isDownloadingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isDownloadingPdf ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                                    Download PDF
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleExportStepReport}
                            className="flex-1 sm:flex-none px-8 py-2.5 bg-white text-black font-black uppercase text-xs rounded-xl transition-all shadow-xl hover:bg-gray-200 transform hover:scale-[1.03]"
                        >
                            <DocumentArrowDownIcon className="w-5 h-5 mr-2 inline-block" />
                            Export Step 11
                        </button>
                    </div>
                </div>

                <div className="divide-y divide-gray-800">
                    {sections.map(section => (
                        <div key={section.id} className="group">
                            <button
                                onClick={() => setOpenReportSection(openReportSection === section.title ? null : section.title)}
                                className={`w-full flex items-center justify-between p-6 transition-all ${openReportSection === section.title ? 'bg-[#1E293B]/40' : 'hover:bg-[#1E293B]/20'}`}
                            >
                                <div className="flex items-center gap-5">
                                    <div className={`p-2.5 rounded-xl border transition-all ${openReportSection === section.title ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-900 border-gray-700 text-gray-500 group-hover:border-gray-600 group-hover:text-gray-400'}`}>
                                        <section.icon className="w-5 h-5" />
                                    </div>
                                    <span className={`font-black uppercase tracking-widest text-xs ${openReportSection === section.title ? 'text-white' : 'text-gray-400'}`}>{section.title}</span>
                                </div>
                                <ChevronDownIcon className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${openReportSection === section.title ? 'rotate-180 text-white' : ''}`} />
                            </button>
                            {openReportSection === section.title && (
                                <div className="p-8 bg-black/40 border-t border-gray-800/50 animate-in slide-in-from-top-1 duration-300">
                                    <div className="flex flex-col gap-y-4 bg-[#0A0F1D]/50 border border-gray-800 rounded-xl p-8 shadow-inner max-w-2xl mx-auto">
                                        {section.fields.map(f => {
                                            if (f.type === 'header') {
                                                return (
                                                    <div key={f.field} className="pt-8 pb-3 border-b border-gray-800/80 mb-4 first:pt-0">
                                                        <h4 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em]">{f.label.replace(/---/g, '').trim()}</h4>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={f.field} className="flex flex-col py-4 border-b border-gray-800/30 last:border-0 group/field">
                                                    <label className={`text-[11px] font-black uppercase tracking-widest mb-2 transition-colors ${f.highlight ? 'text-blue-400' : 'text-gray-500 group-hover/field:text-gray-400'}`}>{f.label}</label>
                                                    <div className="bg-gray-900/40 rounded-lg p-1 border border-transparent group-hover/field:border-gray-800/50 transition-all">
                                                        {f.type === 'number' ?
                                                            <ReportNumberInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} reportForm={reportForm} onChange={handleReportFormChange} /> :
                                                            <ReportInput field={f.field} className={f.highlight ? 'text-blue-200' : ''} reportForm={reportForm} onChange={handleReportFormChange} />
                                                        }
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-gray-950 border-t border-gray-800 text-center">
                    <p className="text-[10px] text-gray-600 font-medium uppercase tracking-[0.2em]">
                        This is a system generated document and does not require to be signed.
                    </p>
                </div>
            </div>
        </div>
    );
};
