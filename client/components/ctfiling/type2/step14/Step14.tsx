import React, { useRef } from 'react';
import { useCtType2 } from '../Layout';
import {
    DocumentArrowDownIcon, ArrowLeftIcon, DocumentTextIcon,
    InformationCircleIcon, IdentificationIcon, BuildingOfficeIcon, IncomeIcon, AssetIcon, ListBulletIcon, ChartBarIcon, ClipboardCheckIcon,
    ChevronDownIcon, ChevronRightIcon
} from '../../../icons';
import { REPORT_STRUCTURE, formatNumber } from '../types';
import { LoadingIndicator } from '../../../LoadingIndicator';

// Helper function
const renderReportField = (fieldValue: any) => {
    if (!fieldValue) return '';
    if (typeof fieldValue === 'object') {
        return JSON.stringify(fieldValue, null, 2);
    }
    return String(fieldValue);
};

export const Step14: React.FC = () => {
    const {
        reportForm,
        setReportForm,
        handleBack,
        isDownloadingPdf,
        showVatFlowModal, // If used in report logic?
        questionnaireAnswers,
        pnlValues,
        balanceSheetValues,
        vatStepData,
        grandTotals, // From VAT
        summary, // Bank Summary
        openReportSection,
        setOpenReportSection,
        companyName,
        companyTrn,
        handleDownloadPdf
    } = useCtType2();

    const reportRef = useRef<HTMLDivElement>(null);

    // Dynamic field value resolver
    const getValuesForReport = (field: string) => {
        // First checks reportForm state (user overrides)
        if (reportForm[field] !== undefined) return reportForm[field];

        // Then falls back to calculated/derived values from previous steps
        switch (field) {
            case 'taxableNameEn': return companyName;
            case 'trn': return companyTrn;
            case 'netTaxPosition':
                return (grandTotals.net >= 0
                    ? `Payable: ${formatNumber(grandTotals.net)}`
                    : `Refundable: ${formatNumber(Math.abs(grandTotals.net))}`);
            case 'netProfit': return pnlValues.netProfit || 0;
            case 'accountingIncomeTaxPeriod': return pnlValues.netProfit || 0;
            case 'taxableIncomeTaxPeriod':
                // Simplified tax calculation logic for Type 2
                // In reality, this would be accounting income +/- adjustments
                return pnlValues.netProfit || 0;
            case 'corporateTaxLiability':
                const profit = pnlValues.netProfit || 0;
                return profit > 375000 ? (profit - 375000) * 0.09 : 0;
            case 'corporateTaxPayable':
                const profit2 = pnlValues.netProfit || 0;
                return profit2 > 375000 ? (profit2 - 375000) * 0.09 : 0;

            // Map other fields from pnlValues, balanceSheetValues, questionnaireAnswers
            // Example:
            case 'operatingRevenue': return pnlValues.operatingRevenue || 0;
            case 'grossProfit': return pnlValues.grossProfit || 0;
            case 'totalAssets': return balanceSheetValues.totalAssets || 0;
            case 'totalLiabilities': return balanceSheetValues.totalLiabilities || 0;
            case 'totalEquity': return balanceSheetValues.totalEquity || 0;

            default: return '';
        }
    };

    const handleReportChange = (field: string, value: any) => {
        setReportForm(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#0B1120] rounded-2xl border border-gray-800 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-bold text-white">Final Report Preview</h3>
                        <p className="text-gray-400 mt-1">Review your Corporate Tax Return data before submission.</p>
                    </div>
                    <button
                        onClick={() => handleDownloadPdf(reportRef)}
                        disabled={isDownloadingPdf}
                        className="flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 transform hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                        {isDownloadingPdf ? (
                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Generatng PDF...</>
                        ) : (
                            <><DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Download PDF Report</>
                        )}
                    </button>
                </div>

                <div className="p-8 bg-gray-50 text-gray-900 overflow-hidden" ref={reportRef}>
                    <div className="mb-10 text-center border-b-2 border-gray-200 pb-6">
                        <img src="/logo-dark.png" alt="Doctry" className="h-12 mx-auto mb-4 opacity-80 grayscale hover:grayscale-0 transition-all" />
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Corporate Tax Return</h1>
                        <p className="text-gray-500 font-medium">United Arab Emirates</p>
                    </div>

                    <div className="space-y-6">
                        {REPORT_STRUCTURE.map((section) => {
                            const IconCmp = {
                                InformationCircleIcon, IdentificationIcon, BuildingOfficeIcon, IncomeIcon, AssetIcon, ListBulletIcon, ChartBarIcon, ClipboardCheckIcon
                            }[section.iconName] || InformationCircleIcon;

                            const isOpen = openReportSection === section.id;

                            return (
                                <div key={section.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden break-inside-avoid">
                                    <button
                                        onClick={() => setOpenReportSection(isOpen ? null : section.id)}
                                        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <IconCmp className="w-5 h-5 text-gray-400" />
                                            <span className="font-bold text-gray-700 uppercase tracking-wide text-sm">{section.title}</span>
                                        </div>
                                        {isOpen ? <ChevronDownIcon className="w-5 h-5 text-gray-400" /> : <ChevronRightIcon className="w-5 h-5 text-gray-400" />}
                                    </button>

                                    {isOpen && (
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                            {section.fields.map((field: any) => {
                                                if (field.type === 'header') {
                                                    return <div key={field.field} className="col-span-2 pt-4 pb-2 border-b border-gray-100 font-bold text-gray-400 text-xs uppercase tracking-widest">{field.label.replace(/---/g, '')}</div>;
                                                }
                                                const rawVal = getValuesForReport(field.field);
                                                const val = field.type === 'number' && typeof rawVal === 'number' ? formatNumber(rawVal) : renderReportField(rawVal);

                                                return (
                                                    <div key={field.field} className={`${field.colSpan ? 'col-span-2' : ''} group`}>
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-blue-500 transition-colors">{field.label}</label>
                                                        {field.highlight ? (
                                                            <div className="text-lg font-black text-gray-900 font-mono bg-gray-50 p-2 rounded border border-gray-100">{field.labelPrefix}{val}</div>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                className="w-full bg-transparent border-b border-gray-200 focus:border-blue-500 outline-none py-1 text-sm font-medium text-gray-800 font-mono transition-colors"
                                                                value={val}
                                                                onChange={(e) => handleReportChange(field.field, e.target.value)}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-12 pt-6 border-t border-gray-200 text-center">
                        <p className="text-xs text-gray-400">Generated by Docuflow AI - Corporate Tax Filing Automation</p>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={handleBack}
                    className="flex items-center px-6 py-3 bg-transparent text-gray-400 hover:text-white font-bold transition-all"
                >
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    Back to Questionnaire
                </button>
                <div className="flex gap-4">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <DocumentTextIcon className="w-5 h-5 text-gray-500" />
                        <span>Print Summary</span>
                    </button>
                    <button
                        onClick={() => { }} // Save draft logic?
                        className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-medium rounded-xl border border-white/10 transition-all text-sm"
                    >
                        Save Draft
                    </button>
                </div>
            </div>
        </div>
    );
};
