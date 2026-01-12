import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';
import { SalesSettings } from '../types';

export interface DealsFilters {
    cifNumber?: string;
    date?: string;
    name?: string;
    companyName?: string;
    brand?: string;
    contactNo?: string;
    email?: string;
    leadSource?: string;
    services?: string;
    serviceClosed?: string;
    serviceAmount?: string;
    closingDate?: string;
    paymentStatus?: string;
}

interface DealsFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyFilters: (filters: DealsFilters) => void;
    onResetFilters: () => void;
    initialFilters: DealsFilters;
    salesSettings: SalesSettings;
}

export const DealsFilterModal: React.FC<DealsFilterModalProps> = ({
    isOpen,
    onClose,
    onApplyFilters,
    onResetFilters,
    initialFilters,
    salesSettings
}) => {
    const [filters, setFilters] = useState<DealsFilters>(initialFilters);

    useEffect(() => {
        setFilters(initialFilters);
    }, [initialFilters, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onApplyFilters(filters);
    };

    const handleReset = () => {
        setFilters({});
        onResetFilters();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-lg shadow-xl w-full max-w-4xl border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-t-lg">
                    <h3 className="text-lg font-semibold text-white">Filter Deals</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="filter-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* CIF Number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">CIF No</label>
                                <input
                                    type="text"
                                    name="cifNumber"
                                    value={filters.cifNumber || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={filters.date || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={filters.name || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Company Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Company Name</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={filters.companyName || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Brand */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Brand</label>
                                <select
                                    name="brand"
                                    value={filters.brand || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {salesSettings.brands.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Contact No */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Contact No</label>
                                <input
                                    type="text"
                                    name="contactNo"
                                    value={filters.contactNo || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                                <input
                                    type="text"
                                    name="email"
                                    value={filters.email || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Lead Source */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Lead Source</label>
                                <select
                                    name="leadSource"
                                    value={filters.leadSource || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {salesSettings.leadSources.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Services */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Services</label>
                                <select
                                    name="services"
                                    value={filters.services || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {salesSettings.servicesRequired.map(item => (
                                        <option key={item.id} value={item.id}>{item.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Service Closed */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Service Closed</label>
                                <select
                                    name="serviceClosed"
                                    value={filters.serviceClosed || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {salesSettings.serviceClosedOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Service Amount */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Service Amount</label>
                                <input
                                    type="number"
                                    name="serviceAmount"
                                    value={filters.serviceAmount || ''}
                                    onChange={handleChange}
                                    placeholder="Exact amount..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Closing Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Closing Date</label>
                                <input
                                    type="date"
                                    name="closingDate"
                                    value={filters.closingDate || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Payment Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Payment Status</label>
                                <select
                                    name="paymentStatus"
                                    value={filters.paymentStatus || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {salesSettings.paymentStatusOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                        </div>
                    </form>
                </div>

                <div className="p-4 border-t border-gray-800 flex justify-end space-x-3 bg-gray-900/50 rounded-b-lg">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="filter-form"
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-900/20 transition-colors"
                    >
                        Search
                    </button>
                </div>
            </div>
        </div>
    );
};
