
import React, { useState } from 'react';
import { useCtType4 } from '../types';
import { FileUploadArea } from '../../../VatFilingUpload';
import { extractAuditReportDetails } from '../../../../services/geminiService';
import { convertFileToParts } from '../../../../utils/fileUtils';
import {
    DocumentTextIcon,
    ArrowPathIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from '@heroicons/react/24/outline';

export const Step1: React.FC = () => {
    const {
        auditFiles, setAuditFiles,
        setIsExtracting, isExtracting,
        setExtractedDetails, extractedDetails,
        openExtractedSection, setOpenExtractedSection,
        setCurrentStep
    } = useCtType4();

    const [extractionError, setExtractionError] = useState<string | null>(null);

    const handleAuditFilesSelect = async (files: File[]) => {
        setAuditFiles(files);
        if (files.length > 0) {
            setIsExtracting(true);
            setExtractionError(null);
            try {
                // Process first file for now (Type 4 assumption: Single Audit Report usually)
                const file = files[0];
                const parts = await convertFileToParts(file);
                const details = await extractAuditReportDetails(parts);
                setExtractedDetails(details);
                setOpenExtractedSection('generalInformation');
            } catch (error: any) {
                console.error("Audit Report Extraction Failed:", error);
                setExtractionError("Failed to extract details from the uploaded audit report. Please try again or fill details manually.");
            } finally {
                setIsExtracting(false);
            }
        }
    };

    const sectionTitles: Record<string, string> = {
        generalInformation: "General Information",
        auditorsReport: "Auditor's Report",
        managersReport: "Manager's Report",
        statementOfFinancialPosition: "Statement of Financial Position",
        statementOfComprehensiveIncome: "Statement of Comprehensive Income",
        statementOfChangesInEquity: "Statement of Changes in Shareholders' Equity",
        statementOfCashFlows: "Statement of Cash Flows"
    };

    const renderExtractedSection = (sectionKey: string, data: any) => {
        if (!data) return null;

        // Helper to render nested objects or arrays (simplified for brevity)
        const renderValue = (val: any): React.ReactNode => {
            if (typeof val === 'object' && val !== null) {
                if (Array.isArray(val)) {
                    return (
                        <div className="space-y-2 mt-2">
                            {val.map((item, i) => (
                                <div key={i} className="pl-4 border-l-2 border-gray-700">
                                    {renderValue(item)}
                                </div>
                            ))}
                        </div>
                    );
                }
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {Object.entries(val).map(([k, v]) => (
                            <div key={k} className="bg-gray-800/50 p-3 rounded-lg">
                                <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <span className="text-sm font-mono text-gray-300">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                            </div>
                        ))}
                    </div>
                );
            }
            return String(val);
        };

        const title = sectionTitles[sectionKey] || sectionKey;
        const isOpen = openExtractedSection === sectionKey;

        return (
            <div key={sectionKey} className="border border-gray-700 rounded-xl overflow-hidden bg-[#1E293B]/30 mb-3">
                <button
                    onClick={() => setOpenExtractedSection(isOpen ? null : sectionKey)}
                    className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${isOpen ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'}`}>
                            <DocumentTextIcon className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-gray-200">{title}</span>
                    </div>
                    {isOpen ? <ChevronDownIcon className="w-5 h-5 text-gray-400" /> : <ChevronRightIcon className="w-5 h-5 text-gray-400" />}
                </button>
                {isOpen && (
                    <div className="p-4 border-t border-gray-700 bg-[#0F172A]/30">
                        {renderValue(data)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-mono text-sm">01</span>
                    Upload Audit Report
                </h2>
                <p className="text-gray-400 text-sm ml-10">
                    Upload the full signed audit report (PDF) to automatically extract financial statements and general information.
                </p>
            </div>

            {/* Upload Area */}
            <FileUploadArea
                title="Audit Report"
                subtitle="PDF only (Signed & Stamped)"
                icon={<DocumentTextIcon className="w-8 h-8 text-gray-400" />}
                selectedFiles={auditFiles}
                onFilesSelect={handleAuditFilesSelect}
                maxFiles={1}
            />

            {/* Extraction Status */}
            {isExtracting && (
                <div className="p-6 bg-blue-900/10 border border-blue-500/20 rounded-xl flex items-center gap-4 animate-pulse">
                    <ArrowPathIcon className="w-6 h-6 text-blue-400 animate-spin" />
                    <div>
                        <p className="text-blue-200 font-medium">Analyzing Audit Report...</p>
                        <p className="text-xs text-blue-300/70 mt-1">Extracting financial position, profit & loss, and company details.</p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {extractionError && (
                <div className="p-6 bg-red-900/10 border border-red-500/20 rounded-xl flex items-center gap-4">
                    <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
                    <p className="text-red-300 text-sm">{extractionError}</p>
                </div>
            )}

            {/* Extracted Details Preview */}
            {!isExtracting && Object.keys(extractedDetails).length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Extracted Data</h3>
                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded border border-green-500/20 flex items-center gap-1">
                            <CheckCircleIcon className="w-3 h-3" /> Extraction Complete
                        </span>
                    </div>
                    <div className="space-y-2">
                        {Object.entries(extractedDetails).map(([key, value]) => renderExtractedSection(key, value))}
                    </div>
                </div>
            )}

            {/* Footer Navigation */}
            <div className="flex justify-end pt-6 border-t border-gray-800">
                <button
                    onClick={() => setCurrentStep(2)}
                    disabled={!extractedDetails || Object.keys(extractedDetails).length === 0}
                    className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                    Continue <ChevronRightIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
