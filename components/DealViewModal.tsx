
import React from 'react';
import { XMarkIcon, PencilIcon, CalendarDaysIcon as CalendarIcon, UsersIcon, PhoneIcon, EnvelopeIcon, BriefcaseIcon, TagIcon, BanknotesIcon, CreditCardIcon, CheckCircleIcon, HashtagIcon } from './icons';
import { Deal, SalesSettings } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { useState, useEffect } from 'react';

interface DealViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    deal: Deal | null;
    salesSettings: SalesSettings;
    onEdit: (deal: Deal) => void;
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

export const DealViewModal: React.FC<DealViewModalProps> = ({ isOpen, onClose, deal, salesSettings, onEdit }) => {
    const [customFields, setCustomFields] = useState<CustomField[]>([]);

    useEffect(() => {
        if (isOpen) {
            salesSettingsService.getCustomFields('deals').then(setCustomFields);
        }
    }, [isOpen]);

    if (!isOpen || !deal) return null;

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <h2 className="text-xl font-bold text-white">{deal.companyName}</h2>
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
                            className="p-2 bg-blue-600/10 text-blue-400 rounded-full hover:bg-blue-600/20 transition-colors"
                            title="Edit Deal"
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
