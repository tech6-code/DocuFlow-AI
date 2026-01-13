
import React, { useState, useEffect } from 'react';
import { XMarkIcon, PencilIcon, CalendarDaysIcon as CalendarIcon, UsersIcon as UserIcon, PhoneIcon, EnvelopeIcon, BriefcaseIcon, TagIcon, ChatBubbleBottomCenterTextIcon, MagnifyingGlassIcon, SparklesIcon, ArrowPathIcon } from './icons';
import { Lead, User, SalesSettings } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { generateLeadScore } from '../services/geminiService';
import { useData } from '../contexts/DataContext';

interface LeadViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead | null;
    users: User[];
    salesSettings: SalesSettings;
    onEdit: (id: string) => void;
}

interface DetailItemProps {
    label: string;
    value: string | undefined;
    icon: any;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, icon: Icon }) => (
    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-800 flex items-start space-x-3">
        <div className="p-2 bg-gray-900/50 rounded-lg text-gray-400">
            <Icon className="w-4 h-4" />
        </div>
        <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm text-white font-medium">{value || '-'}</p>
        </div>
    </div>
);

export const LeadViewModal: React.FC<LeadViewModalProps> = ({ isOpen, onClose, lead, users, salesSettings, onEdit }) => {
    const { updateLead } = useData();
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);

    useEffect(() => {
        if (isOpen && lead) {
            salesSettingsService.getCustomFields('leads').then(setCustomFields);
            if (lead.custom_data?.aiScore) {
                setAiAnalysis(lead.custom_data.aiScore);
            } else {
                setAiAnalysis(null);
            }
        }
    }, [isOpen, lead]);

    if (!isOpen || !lead) return null;

    const handleAnalyzeLead = async () => {
        setIsAnalyzing(true);
        try {
            const analysis = await generateLeadScore(lead);
            setAiAnalysis(analysis);

            // Persist the score
            const updatedLead = {
                ...lead,
                custom_data: {
                    ...lead.custom_data,
                    aiScore: analysis
                }
            };
            updateLead(lead.id, updatedLead);
        } catch (error) {
            console.error("Failed to analyze lead", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getBrandName = (id: string) => salesSettings.brands.find(b => b.id === id)?.name || id || '-';
    // ... (rest of helper functions)
    const getOwnerName = (id: string) => salesSettings.leadOwners.find(o => o.id === id)?.name || id || '-';
    const getQualificationName = (id: string) => salesSettings.leadQualifications.find(q => q.id === id)?.name || id || '-';
    const getServiceName = (id: string) => salesSettings.servicesRequired.find(s => s.id === id)?.name || id || '-';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Follow up': return 'bg-yellow-900/40 text-yellow-300 border border-yellow-800';
            case 'Submitted': return 'bg-purple-900/40 text-purple-300 border border-purple-800';
            case 'Lost to competitor': return 'bg-red-900/40 text-red-300 border border-red-800';
            case 'Convert as customer': return 'bg-emerald-900/40 text-emerald-300 border border-emerald-800';
            case 'Dropped': return 'bg-gray-700/40 text-gray-300 border border-gray-600';
            case 'Waiting for client replay': return 'bg-orange-900/40 text-orange-300 border border-orange-800';
            case 'Others': return 'bg-indigo-900/40 text-indigo-300 border border-indigo-800';
            default: return 'bg-gray-700 text-gray-300 border border-gray-600';
        }
    };

    const renderCustomValue = (field: CustomField, value: any) => {
        if (value === undefined || value === null || value === '') return '-';
        if (field.type === 'checkbox') return value ? 'Yes' : 'No';
        return String(value);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">{lead.companyName}</h2>
                        <div className="flex items-center space-x-3">
                            <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${getStatusColor(lead.status)}`}>
                                {lead.status}
                            </span>
                            <span className="text-gray-500 text-xs flex items-center">
                                <CalendarIcon className="w-3 h-3 mr-1" />
                                Added {lead.date}
                            </span>
                        </div>
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => onEdit(lead.id)}
                            className="p-2 bg-blue-600/10 text-blue-400 rounded-full hover:bg-blue-600/20 transition-colors"
                            title="Edit Lead"
                        >
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 bg-gray-800 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[70vh] custom-scrollbar">

                    {/* AI Insights Section */}
                    <div className="mb-8 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-xl border border-indigo-500/20 p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <SparklesIcon className="w-24 h-24 text-indigo-400" />
                        </div>

                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest flex items-center">
                                <SparklesIcon className="w-4 h-4 mr-2" />
                                AI Insights
                            </h3>
                            <button
                                onClick={handleAnalyzeLead}
                                disabled={isAnalyzing}
                                className="text-xs flex items-center px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
                            >
                                {isAnalyzing ? (
                                    <>Analyzing...</>
                                ) : (
                                    <>
                                        <ArrowPathIcon className="w-3 h-3 mr-1.5" />
                                        {aiAnalysis ? 'Refresh Analysis' : 'Analyze Lead'}
                                    </>
                                )}
                            </button>
                        </div>

                        {aiAnalysis ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                                <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-900/40 rounded-lg border border-indigo-500/20">
                                    <div className="text-3xl font-bold text-white mb-1">{aiAnalysis.score}<span className="text-lg text-gray-500 font-normal">/100</span></div>
                                    <div className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Lead Score</div>
                                </div>
                                <div className="md:col-span-2 space-y-3">
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Rationale</p>
                                        <p className="text-sm text-gray-200 leading-relaxed">{aiAnalysis.rationale}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">Recommended Action</p>
                                        <p className="text-sm text-indigo-300 font-medium">{aiAnalysis.nextAction}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 relative z-10">
                                <p className="text-sm text-gray-400 mb-2">Get AI-powered insights on this lead's quality and conversion probability.</p>
                                <button
                                    onClick={handleAnalyzeLead}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20"
                                >
                                    Generate Analysis
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section: Contact */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Contact Information</h3>
                            <div className="space-y-3">
                                <DetailItem label="Email Address" value={lead.email} icon={EnvelopeIcon} />
                                <DetailItem label="Mobile Number" value={lead.mobileNumber} icon={PhoneIcon} />
                            </div>
                        </div>

                        {/* Section: Professional */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Professional Details</h3>
                            <div className="space-y-3">
                                <DetailItem label="Brand" value={getBrandName(lead.brand || '')} icon={TagIcon} />
                                <DetailItem label="Lead Source" value={lead.leadSource} icon={MagnifyingGlassIcon} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section: Management */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Management</h3>
                            <div className="space-y-3">
                                <DetailItem label="Lead Owner" value={getOwnerName(lead.leadOwner || '')} icon={UserIcon} />
                                <DetailItem label="Qualification" value={getQualificationName(lead.leadQualification || '')} icon={BriefcaseIcon} />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Section: Service */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Service & Timeline</h3>
                            <div className="space-y-3">
                                <DetailItem label="Service Required" value={getServiceName(lead.serviceRequired || '')} icon={BriefcaseIcon} />
                                <DetailItem label="Expected Closing" value={lead.closingDate} icon={CalendarIcon} />
                            </div>
                        </div>
                    </div>

                    {/* Remarks Section */}
                    <div className="mt-8 space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Remarks & Notes</h3>
                        <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800 flex items-start space-x-3">
                            <div className="p-2 bg-gray-900/50 rounded-lg text-gray-400">
                                <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed italic">
                                {lead.remarks || 'No additional remarks provided for this lead.'}
                            </p>
                        </div>
                    </div>

                    {/* Custom Fields Section */}
                    {customFields.length > 0 && (
                        <div className="mt-8 space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Additional Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {customFields.map(field => {
                                    const value = lead.custom_data?.[field.id];
                                    return (
                                        <DetailItem
                                            key={field.id}
                                            label={field.label}
                                            value={renderCustomValue(field, value)}
                                            icon={BriefcaseIcon}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-800 flex justify-end bg-gray-900/30">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
