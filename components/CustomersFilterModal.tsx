import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';
import { User } from '../types';

export interface CustomersFilters {
    cifNumber?: string;
    name?: string;
    email?: string;
    mobile?: string;
    trn?: string;
    entityType?: string;
    businessActivity?: string;
    tradeLicenseNumber?: string;
    ownerId?: string;
}

interface CustomersFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyFilters: (filters: CustomersFilters) => void;
    onResetFilters: () => void;
    initialFilters: CustomersFilters;
    users: User[];
}

export const CustomersFilterModal: React.FC<CustomersFilterModalProps> = ({
    isOpen,
    onClose,
    onApplyFilters,
    onResetFilters,
    initialFilters,
    users
}) => {
    const [filters, setFilters] = useState<CustomersFilters>(initialFilters);

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
                    <h3 className="text-lg font-semibold text-white">Filter Customers</h3>
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

                            {/* Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={filters.name || ''}
                                    onChange={handleChange}
                                    placeholder="Company or Person name..."
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

                            {/* Mobile */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Mobile</label>
                                <input
                                    type="text"
                                    name="mobile"
                                    value={filters.mobile || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* TRN */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">TRN</label>
                                <input
                                    type="text"
                                    name="trn"
                                    value={filters.trn || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Entity Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Entity Type</label>
                                <input
                                    type="text"
                                    name="entityType"
                                    value={filters.entityType || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Business Activity */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Business Activity</label>
                                <input
                                    type="text"
                                    name="businessActivity"
                                    value={filters.businessActivity || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Trade License Number */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Trade License #</label>
                                <input
                                    type="text"
                                    name="tradeLicenseNumber"
                                    value={filters.tradeLicenseNumber || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Sales Person (Owner) */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Sales Person</label>
                                <select
                                    name="ownerId"
                                    value={filters.ownerId || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
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
