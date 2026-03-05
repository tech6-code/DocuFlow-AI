import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons';
import { Lead, User } from '../types';

export interface LeadsFilters {
    date?: string;
    companyName?: string;
    mobileNumber?: string;
    email?: string;
    leadSource?: string;
    status?: string;
    serviceRequired?: string;
    leadQualification?: string;
    leadOwner?: string;
    lastContact?: string;
    closingCycle?: string;
    closingDate?: string;
    remarks?: string;
    [key: string]: string | undefined;
}

interface LeadsFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyFilters: (filters: LeadsFilters) => void;
    onResetFilters: () => void;
    initialFilters: LeadsFilters;
    users: User[];
    customFields: import('../services/salesSettingsService').CustomField[];
}

export const LeadsFilterModal: React.FC<LeadsFilterModalProps> = ({
    isOpen,
    onClose,
    onApplyFilters,
    onResetFilters,
    initialFilters,
    users,
    customFields
}) => {
    const [filters, setFilters] = useState<LeadsFilters>(initialFilters);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <div className="bg-muted rounded-lg shadow-xl w-full max-w-4xl border border-border flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-border flex justify-between items-center bg-muted rounded-t-lg">
                    <h3 className="text-lg font-semibold text-foreground">Filter Leads</h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="filter-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {/* Date */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={filters.date || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Company Name */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Company Name</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={filters.companyName || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Email</label>
                                <input
                                    type="text"
                                    name="email"
                                    value={filters.email || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Mobile */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Mobile Number</label>
                                <input
                                    type="text"
                                    name="mobileNumber"
                                    value={filters.mobileNumber || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
                                <select
                                    name="status"
                                    value={filters.status || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    <option value="Follow up">Follow up</option>
                                    <option value="Submitted">Submitted</option>
                                    <option value="Lost to competitor">Lost to competitor</option>
                                    <option value="Convert as customer">Convert as customer</option>
                                    <option value="Dropped">Dropped</option>
                                    <option value="Waiting for client replay">Waiting for client replay</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>

                            {/* Lead Source */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Lead Source</label>
                                <select
                                    name="leadSource"
                                    value={filters.leadSource || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    <option value="Agent">Agent</option>
                                    <option value="Call">Call</option>
                                    <option value="Mail">Mail</option>
                                    <option value="Reference">Reference</option>
                                    <option value="Tawk">Tawk</option>
                                    <option value="Whatsapp">Whatsapp</option>
                                </select>
                            </div>

                            {/* Service Required */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Service Required</label>
                                <select
                                    name="serviceRequired"
                                    value={filters.serviceRequired || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    <option value="Bookkeeping">Bookkeeping</option>
                                    <option value="VAT Filing">VAT Filing</option>
                                    <option value="Corporate Tax Filing">Corporate Tax Filing</option>
                                    <option value="Audit Services">Audit Services</option>
                                    <option value="Payroll">Payroll</option>
                                    <option value="Business Setup">Business Setup</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>

                            {/* Qualification */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Qualification</label>
                                <select
                                    name="leadQualification"
                                    value={filters.leadQualification || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    <option value="Hot">Hot</option>
                                    <option value="Warm">Warm</option>
                                    <option value="Cold">Cold</option>
                                </select>
                            </div>

                            {/* Lead Owner */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Lead Owner</label>
                                <select
                                    name="leadOwner"
                                    value={filters.leadOwner || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">All</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Last Contact */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Last Contact</label>
                                <input
                                    type="date"
                                    name="lastContact"
                                    value={filters.lastContact || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Closing Date */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Closing Date</label>
                                <input
                                    type="date"
                                    name="closingDate"
                                    value={filters.closingDate || ''}
                                    onChange={handleChange}
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Closing Cycle */}
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-2">Closing Cycle</label>
                                <input
                                    type="text"
                                    name="closingCycle"
                                    value={filters.closingCycle || ''}
                                    onChange={handleChange}
                                    placeholder="Contains..."
                                    className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            {/* Custom Fields */}
                            {customFields.map(field => (
                                <div key={field.id}>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">{field.label}</label>
                                    {field.type === 'dropdown' || field.type === 'radio' ? (
                                        <select
                                            name={field.id}
                                            value={filters[field.id] || ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="">All</option>
                                            {field.options?.map((opt, idx) => (
                                                <option key={idx} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                            name={field.id}
                                            value={filters[field.id] || ''}
                                            onChange={handleChange}
                                            placeholder={field.type === 'text' || field.type === 'textarea' ? 'Contains...' : ''}
                                            className="w-full p-2.5 bg-muted border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    )}
                                </div>
                            ))}

                        </div>
                    </form>
                </div>

                <div className="p-4 border-t border-border flex justify-end space-x-3 bg-muted rounded-b-lg">
                    <button
                        type="button"
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted border border-border hover:bg-muted rounded-lg transition-colors"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="filter-form"
                        className="px-6 py-2 text-sm font-medium text-foreground bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-900/20 transition-colors"
                    >
                        Search
                    </button>
                </div>
            </div>
        </div>
    );
};

