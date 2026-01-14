import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';
import { User } from '../types';

export interface CustomersFilters {
    // Core
    cifNumber?: string;
    name?: string; // Global "Name" search (Company or Individual)
    type?: string;
    email?: string;
    mobile?: string;
    workPhone?: string;
    ownerId?: string;
    currency?: string;
    language?: string;

    // Business Details
    entityType?: string;
    entitySubType?: string;
    businessActivity?: string;
    tradeLicenseNumber?: string;
    tradeLicenseAuthority?: string;
    businessRegistrationNumber?: string;
    incorporationDate?: string;
    tradeLicenseIssueDate?: string;
    tradeLicenseExpiryDate?: string;
    isFreezone?: string; // 'true' | 'false'
    freezoneName?: string;
    shareCapital?: string;

    // Addresses
    billingAddress?: string;
    shippingAddress?: string;

    // Tax & Financials
    trn?: string;
    taxTreatment?: string;
    vatRegisteredDate?: string;
    vatReportingPeriod?: string;
    placeOfSupply?: string;
    paymentTerms?: string;

    // Corporate Tax
    corporateTaxTreatment?: string;
    corporateTaxTrn?: string;
    corporateTaxRegisteredDate?: string;

    // Other
    remarks?: string;
    portalAccess?: string; // 'true' | 'false'
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

    const SectionHeader = ({ title }: { title: string }) => (
        <div className="col-span-full mt-4 mb-2 border-b border-gray-800 pb-2">
            <h4 className="text-sm font-bold text-blue-400 uppercase tracking-wider">{title}</h4>
        </div>
    );

    const InputField = ({ label, name, type = 'text', placeholder = 'Contains...' }: { label: string, name: keyof CustomersFilters, type?: string, placeholder?: string }) => (
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
            <input
                type={type}
                name={name}
                value={filters[name] || ''}
                onChange={handleChange}
                placeholder={placeholder}
                className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm hover:border-gray-600"
            />
        </div>
    );

    const SelectField = ({ label, name, options }: { label: string, name: keyof CustomersFilters, options: { value: string, label: string }[] }) => (
        <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
            <div className="relative">
                <select
                    name={name}
                    value={filters[name] || ''}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm hover:border-gray-600 cursor-pointer"
                >
                    <option value="">All</option>
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl border border-gray-800 flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-gray-900 rounded-t-2xl">
                    <div>
                        <h3 className="text-xl font-bold text-white">Filter Customers</h3>
                        <p className="text-gray-400 text-sm mt-0.5">Refine your search with specific criteria</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-all">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    <form id="filter-form" onSubmit={handleSubmit} className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-5">

                            <SectionHeader title="Basic Information" />
                            <InputField label="Name / Company" name="name" placeholder="Search name..." />
                            <InputField label="CIF Number" name="cifNumber" />
                            <InputField label="Email" name="email" />
                            <InputField label="Mobile" name="mobile" />
                            <InputField label="Work Phone" name="workPhone" />
                            <SelectField label="Customer Type" name="type" options={[{ value: 'business', label: 'Business' }, { value: 'individual', label: 'Individual' }]} />
                            <SelectField label="Sales Person" name="ownerId" options={users.map(u => ({ value: u.id, label: u.name }))} />
                            <InputField label="Language" name="language" />

                            <SectionHeader title="Business Details" />
                            <InputField label="Entity Type" name="entityType" />
                            <InputField label="Entity Sub-Type" name="entitySubType" />
                            <InputField label="Business Activity" name="businessActivity" />
                            <InputField label="Trade License #" name="tradeLicenseNumber" />
                            <InputField label="Business Reg. #" name="businessRegistrationNumber" />
                            <InputField label="Issuing Authority" name="tradeLicenseAuthority" />
                            <SelectField label="Freezone?" name="isFreezone" options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} />
                            <InputField label="Freezone Name" name="freezoneName" />
                            <InputField label="Incorporation Date" name="incorporationDate" type="date" />
                            <InputField label="License Issue Date" name="tradeLicenseIssueDate" type="date" />
                            <InputField label="License Expiry" name="tradeLicenseExpiryDate" type="date" />

                            <SectionHeader title="Tax & Financials" />
                            <InputField label="TRN" name="trn" />
                            <InputField label="Tax Treatment" name="taxTreatment" />
                            <InputField label="Opening Balance" name="shareCapital" placeholder="Amount..." />
                            <InputField label="Currency" name="currency" />
                            <InputField label="Place of Supply" name="placeOfSupply" />
                            <InputField label="Payment Terms" name="paymentTerms" />
                            <InputField label="VAT Reg. Date" name="vatRegisteredDate" type="date" />
                            <SelectField label="VAT Reporting" name="vatReportingPeriod" options={[{ value: 'Monthly', label: 'Monthly' }, { value: 'Quarterly', label: 'Quarterly' }]} />

                            <SectionHeader title="Corporate Tax" />
                            <InputField label="CT TRN" name="corporateTaxTrn" />
                            <InputField label="CT Treatment" name="corporateTaxTreatment" />
                            <InputField label="CT Reg. Date" name="corporateTaxRegisteredDate" type="date" />

                            <SectionHeader title="Addresses & Other" />
                            <div className="md:col-span-2">
                                <InputField label="Billing Address" name="billingAddress" />
                            </div>
                            <div className="md:col-span-2">
                                <InputField label="Shipping Address" name="shippingAddress" />
                            </div>
                            <div className="md:col-span-2">
                                <InputField label="Remarks" name="remarks" />
                            </div>
                            <SelectField label="Portal Access" name="portalAccess" options={[{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]} />

                        </div>
                    </form>
                </div>

                <div className="p-5 border-t border-gray-800 flex justify-end space-x-3 bg-gray-900 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-5 py-2.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-xl transition-all"
                    >
                        Reset Filters
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-transparent hover:bg-gray-800 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="filter-form"
                        className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};

