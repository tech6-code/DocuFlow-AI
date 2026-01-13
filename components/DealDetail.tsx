import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDaysIcon as CalendarIcon, UsersIcon, PhoneIcon, EnvelopeIcon, BriefcaseIcon, TagIcon, BanknotesIcon, CreditCardIcon, CheckCircleIcon, HashtagIcon, SparklesIcon, ArrowPathIcon, ExclamationTriangleIcon, LightBulbIcon, ChartBarIcon, PencilIcon, TrashIcon } from './icons';
import { Deal, SalesSettings } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { generateDealScore } from '../services/geminiService';
import { useData } from '../contexts/DataContext';

interface DealDetailProps {
    deals: Deal[];
    salesSettings: SalesSettings;
    onEdit: (deal: Deal) => void;
    onDelete: (id: string) => void;
}

interface DetailItemProps {
    label: string;
    value: string | number | undefined;
    icon: any;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value, icon: Icon }) => (
    <div className="bg-gray-800/40 p-3 rounded-xl border border-gray-800 flex items-start space-x-3">
        <div className="p-2 bg-gray-900/50 rounded-lg text-gray-400">
            <Icon className="w-4 h-4" />
        </div>
        <div>
            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="text-sm text-white font-medium">{value ?? '-'}</p>
        </div>
    </div>
);

export const DealDetail: React.FC<DealDetailProps> = ({ deals, salesSettings, onEdit, onDelete }) => {
    const { id } = useParams<{ id: string }>();
    const { updateDeal } = useData();
    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<any>(null);

    const deal = deals.find(d => d.id === id);

    useEffect(() => {
        if (deal) {
            salesSettingsService.getCustomFields('deals').then(setCustomFields);
            if (deal.custom_data?.aiScore) {
                setAiAnalysis(deal.custom_data.aiScore);
            } else {
                setAiAnalysis(null);
            }
        }
    }, [deal]);

    if (!id) return <div className="flex items-center justify-center h-full text-gray-500">Select a deal to view details</div>;
    if (!deal) return <div className="flex items-center justify-center h-full text-gray-500">Deal not found</div>;

    const handleAnalyzeDeal = async () => {
        setIsAnalyzing(true);
        try {
            const analysis = await generateDealScore(deal);
            setAiAnalysis(analysis);

            // Persist the analysis
            const updatedDeal = {
                ...deal,
                custom_data: {
                    ...deal.custom_data,
                    aiScore: analysis
                }
            };
            updateDeal(updatedDeal);
        } catch (error) {
            console.error("Failed to analyze deal", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const getBrandName = (brandId: string): string => {
        const brand = salesSettings.brands.find(b => b.id === brandId);
        return brand?.name || brandId;
    };

    const getServiceName = (serviceId: string): string => {
        const service = salesSettings.servicesRequired.find(s => s.id === serviceId);
        return service?.name || serviceId;
    };

    const getLeadSourceName = (sourceId: string): string => {
        const source = salesSettings.leadSources.find(s => s.id === sourceId);
        return source?.name || sourceId;
    };

    const getStatusColor = (status: string) => {
        const statusColors: Record<string, string> = {
            'Paid': 'bg-emerald-900/40 text-emerald-300 border border-emerald-800',
            'Pending': 'bg-yellow-900/40 text-yellow-300 border border-yellow-800',
            'Overdue': 'bg-red-900/40 text-red-300 border border-red-800',
            'Partial': 'bg-blue-900/40 text-blue-300 border border-blue-800'
        };
        return statusColors[status] || 'bg-gray-800 text-gray-300 border border-gray-700';
    };

    const renderCustomValue = (field: CustomField, value: any) => {
        if (value === undefined || value === null || value === '') return '-';
        if (field.type === 'checkbox') return value ? 'Yes' : 'No';
        return String(value);
    };

    return (
        <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gray-900 flex justify-between items-start border-b border-gray-800">
                <div>
                    <div className="flex items-center space-x-2 mb-1">
                        <h1 className="text-xl font-bold text-white">{deal.companyName}</h1>
                        <span className="text-gray-500 text-xs">— {deal.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getStatusColor(deal.paymentStatus)}`}>
                            {deal.paymentStatus}
                        </span>
                        <span className="text-gray-500 text-xs flex items-center">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            Created {deal.date}
                        </span>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <button
                        onClick={() => onEdit(deal)}
                        className="flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                        <PencilIcon className="w-4 h-4 mr-2" /> Edit
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure you want to delete this deal?')) {
                                onDelete(deal.id);
                            }
                        }}
                        className="flex items-center px-3 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/40 transition-colors text-sm"
                    >
                        <TrashIcon className="w-4 h-4 mr-2" /> Delete
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {/* AI Insights Section */}
                <div className="mb-8 bg-gradient-to-br from-indigo-900/20 to-purple-900/20 rounded-xl border border-indigo-500/20 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <SparklesIcon className="w-24 h-24 text-indigo-400" />
                    </div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                        <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-widest flex items-center">
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            Deal Insights (Beta)
                        </h3>
                        <button
                            onClick={handleAnalyzeDeal}
                            disabled={isAnalyzing}
                            className="text-xs flex items-center px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50"
                        >
                            {isAnalyzing ? (
                                <>Analyzing...</>
                            ) : (
                                <>
                                    <ArrowPathIcon className="w-3 h-3 mr-1.5" />
                                    {aiAnalysis ? 'Refresh Analysis' : 'Analyze Deal'}
                                </>
                            )}
                        </button>
                    </div>

                    {aiAnalysis ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
                            <div className="md:col-span-1 flex flex-col items-center justify-center p-4 bg-gray-900/40 rounded-lg border border-indigo-500/20">
                                <div className="text-3xl font-bold text-white mb-1">{aiAnalysis.score}<span className="text-lg text-gray-500 font-normal">/100</span></div>
                                <div className="text-xs text-indigo-300 uppercase tracking-wider font-semibold">Deal Score</div>
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
                            <p className="text-sm text-gray-400 mb-2">Get AI-powered insights on this deal's quality and win probability.</p>
                            <button
                                onClick={handleAnalyzeDeal}
                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/20"
                            >
                                Generate Analysis
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Section: Identifiers */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Identifiers</h3>
                        <div className="space-y-3">
                            <DetailItem label="CIF Number" value={deal.cifNumber} icon={HashtagIcon} />
                            <DetailItem label="Brand" value={getBrandName(deal.brand)} icon={TagIcon} />
                        </div>
                    </div>

                    {/* Section: Contact */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Contact Information</h3>
                        <div className="space-y-3">
                            <DetailItem label="Email Address" value={deal.email} icon={EnvelopeIcon} />
                            <DetailItem label="Contact Number" value={deal.contactNo} icon={PhoneIcon} />
                        </div>
                    </div>
                </div>

                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Section: Service Details */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Service Details</h3>
                        <div className="space-y-3">
                            <DetailItem label="Service Type" value={getServiceName(deal.services)} icon={BriefcaseIcon} />
                            <DetailItem label="Service Closed" value={deal.serviceClosed} icon={CheckCircleIcon} />
                        </div>
                    </div>

                    {/* Section: Financials */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Financials</h3>
                        <div className="space-y-3">
                            <DetailItem
                                label="Service Amount"
                                value={new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(deal.serviceAmount)}
                                icon={BanknotesIcon}
                            />
                            <DetailItem label="Closing Date" value={deal.closingDate} icon={CalendarIcon} />
                        </div>
                    </div>
                </div>

                <div className="mt-8">
                    {/* Section: Marketing */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Source</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailItem label="Lead Source" value={getLeadSourceName(deal.leadSource)} icon={TagIcon} />
                        </div>
                    </div>
                </div>

                {customFields.length > 0 && (
                    <div className="mt-8">
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Additional Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {customFields.map(field => {
                                    const value = deal.custom_data?.[field.id];
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
                    </div>
                )}
            </div>
        </div>
    );
};
