import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PlusIcon, MagnifyingGlassIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { Deal, Customer } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { CustomFieldRenderer } from './CustomFieldRenderer';

interface DealModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (deal: Omit<Deal, 'id'>) => Promise<void>;
    initialData?: Partial<Deal> | null;
    readOnly?: boolean;
}

export const DealModal: React.FC<DealModalProps> = ({ isOpen, onClose, onSave, initialData, readOnly }) => {
    const { customers, salesSettings } = useData();
    const [formData, setFormData] = useState<Omit<Deal, 'id'>>({
        cifNumber: '',
        date: new Date().toISOString().split('T')[0],
        name: '',
        companyName: '',
        brand: '',
        contactNo: '',
        email: '',
        leadSource: '',
        services: '',
        serviceClosed: 'No',
        serviceAmount: 0,
        closingDate: '',
        paymentStatus: 'Pending'
    });

    const [suggestions, setSuggestions] = useState<Customer[]>([]);
    const [showSuggestions, setShowSuggestions] = useState<string | null>(null); // 'cif' or 'company'
    const suggestionRef = useRef<HTMLDivElement>(null);

    const [customFields, setCustomFields] = useState<CustomField[]>([]);
    const [customData, setCustomData] = useState<Record<string, any>>({});

    useEffect(() => {
        salesSettingsService.getCustomFields('deals').then(setCustomFields);
    }, []);

    useEffect(() => {
        if (initialData) {
            setFormData(prev => ({
                ...prev,
                ...initialData,
                date: initialData.date || prev.date,
                serviceClosed: initialData.serviceClosed || prev.serviceClosed,
                serviceAmount: initialData.serviceAmount ?? prev.serviceAmount,
                paymentStatus: initialData.paymentStatus || prev.paymentStatus
            }));
            if (initialData.custom_data) {
                setCustomData(initialData.custom_data);
            }
        } else if (isOpen) {
            setFormData({
                cifNumber: '',
                date: new Date().toISOString().split('T')[0],
                name: '',
                companyName: '',
                brand: '',
                contactNo: '',
                email: '',
                leadSource: '',
                services: '',
                serviceClosed: 'No',
                serviceAmount: 0,
                closingDate: '',
                paymentStatus: 'Pending'
            });
            setCustomData({});
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowSuggestions(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCifChange = (val: string) => {
        setFormData({ ...formData, cifNumber: val });
        if (val.length > 0) {
            const matches = customers.filter(c =>
                (c.cifNumber ? String(c.cifNumber).toLowerCase() : '').includes(val.toLowerCase()) ||
                (c.companyName || '').toLowerCase().includes(val.toLowerCase())
            );
            setSuggestions(matches.slice(0, 5));
            setShowSuggestions('cif');
        } else {
            setSuggestions([]);
            setShowSuggestions(null);
        }
    };

    const handleCompanyChange = (val: string) => {
        setFormData({ ...formData, companyName: val });
        if (val.length > 0) {
            const matches = customers.filter(c =>
                (c.companyName || '').toLowerCase().includes(val.toLowerCase()) ||
                (c.cifNumber ? String(c.cifNumber).toLowerCase() : '').includes(val.toLowerCase())
            );
            setSuggestions(matches.slice(0, 5));
            setShowSuggestions('company');
        } else {
            setSuggestions([]);
            setShowSuggestions(null);
        }
    };

    const selectCustomer = (customer: Customer) => {
        setFormData({
            ...formData,
            cifNumber: customer.cifNumber || '',
            name: `${customer.firstName} ${customer.lastName}`,
            companyName: customer.companyName || '',
            email: customer.email || '',
            contactNo: customer.mobile || customer.workPhone || ''
        });
        setShowSuggestions(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        await onSave({ ...formData, custom_data: customData });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h3 className="text-xl font-bold text-white tracking-tight">
                        {readOnly ? 'View Deal' : (initialData ? 'Edit Deal' : 'Add New Deal')}
                    </h3>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                        <div className="space-y-4">
                            <div className="relative" ref={showSuggestions === 'cif' ? suggestionRef : null}>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">CIF No</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        disabled={readOnly}
                                        placeholder="Type CIF or search..."
                                        className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                        value={formData.cifNumber}
                                        onChange={(e) => handleCifChange(e.target.value)}
                                        onFocus={() => !readOnly && formData.cifNumber && handleCifChange(formData.cifNumber)}
                                    />
                                    {!readOnly && showSuggestions === 'cif' && suggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                                            {suggestions.map(c => (
                                                <div
                                                    key={c.id}
                                                    className="p-3 hover:bg-blue-600/20 cursor-pointer border-b border-gray-700/50 last:border-0 transition-colors"
                                                    onClick={() => selectCustomer(c)}
                                                >
                                                    <div className="font-bold text-white text-sm">{c.cifNumber}</div>
                                                    <div className="text-xs text-gray-400">{c.companyName}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>

                            <div className="relative" ref={showSuggestions === 'company' ? suggestionRef : null}>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Company Name</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    placeholder="Type company name..."
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.companyName}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    onFocus={() => !readOnly && formData.companyName && handleCompanyChange(formData.companyName)}
                                />
                                {!readOnly && showSuggestions === 'company' && suggestions.length > 0 && (
                                    <div className="absolute z-10 w-full mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
                                        {suggestions.map(c => (
                                            <div
                                                key={c.id}
                                                className="p-3 hover:bg-blue-600/20 cursor-pointer border-b border-gray-700/50 last:border-0"
                                                onClick={() => selectCustomer(c)}
                                            >
                                                <div className="font-bold text-white text-sm">{c.companyName}</div>
                                                <div className="text-xs text-gray-400">{c.cifNumber}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Brand</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.brand}
                                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                >
                                    <option value="">Select Brand</option>
                                    {salesSettings.brands.map(brand => (
                                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                                <input
                                    type="email"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Contact No</label>
                                <input
                                    type="text"
                                    required
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.contactNo}
                                    onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Lead Source</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.leadSource}
                                    onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                                >
                                    <option value="">Select Lead Source</option>
                                    {salesSettings.leadSources.map(source => (
                                        <option key={source.id} value={source.id}>{source.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Services</label>
                                <select
                                    disabled={readOnly}
                                    className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    value={formData.services}
                                    onChange={(e) => setFormData({ ...formData, services: e.target.value })}
                                >
                                    <option value="">Select Service</option>
                                    {salesSettings.servicesRequired.map(service => (
                                        <option key={service.id} value={service.id}>{service.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Service Amount (AED)</label>
                            <input
                                type="number"
                                required
                                disabled={readOnly}
                                className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none font-mono ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.serviceAmount}
                                onChange={(e) => setFormData({ ...formData, serviceAmount: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Service Closed</label>
                            <select
                                disabled={readOnly}
                                className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.serviceClosed}
                                onChange={(e) => setFormData({ ...formData, serviceClosed: e.target.value })}
                            >
                                <option value="">Select Status</option>
                                {salesSettings.serviceClosedOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Payment Status</label>
                            <select
                                disabled={readOnly}
                                className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none appearance-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.paymentStatus}
                                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                            >
                                <option value="">Select Status</option>
                                {salesSettings.paymentStatusOptions.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Deal Date</label>
                            <input
                                type="date"
                                required
                                disabled={readOnly}
                                className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1.5">Closing Date</label>
                            <input
                                type="date"
                                disabled={readOnly}
                                className={`w-full bg-gray-800/50 border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={formData.closingDate}
                                onChange={(e) => setFormData({ ...formData, closingDate: e.target.value })}
                            />
                        </div>
                    </div>

                    {customFields.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-gray-800">
                            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Additional Information</h4>
                            <CustomFieldRenderer
                                fields={customFields}
                                data={customData}
                                onChange={(id, val) => setCustomData(prev => ({ ...prev, [id]: val }))}
                                disabled={readOnly}
                                columns={2}
                            />
                        </div>
                    )}
                </form>

                <div className="p-6 border-t border-gray-800 bg-gray-900/80 backdrop-blur-md flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-8 py-2.5 bg-gray-800 text-gray-300 font-bold rounded-xl hover:bg-gray-700 active:scale-95 transition-all border border-gray-700"
                    >
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!readOnly && (
                        <button
                            onClick={handleSubmit}
                            className="px-8 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                        >
                            {initialData ? 'Update Deal' : 'Create Deal'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
