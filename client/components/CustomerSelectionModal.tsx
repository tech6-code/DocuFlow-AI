
import React, { useState } from 'react';
import type { Customer } from '../types';
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon, UserGroupIcon, IdentificationIcon } from './icons';

interface CustomerSelectionModalProps {
    customers: Customer[];
    onSelect: (customer: Customer) => void;
    onAddNew: () => void;
    onClose: () => void;
    targetPageTitle: string;
}

export const CustomerSelectionModal: React.FC<CustomerSelectionModalProps> = ({ 
    customers, 
    onSelect, 
    onAddNew, 
    onClose, 
    targetPageTitle 
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredCustomers = customers.filter(customer => {
        const name = customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`;
        return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.trn && customer.trn.includes(searchTerm));
    });

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-muted rounded-2xl shadow-2xl w-full max-w-2xl border border-border flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-border flex justify-between items-center bg-muted rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Select Customer</h2>
                        <p className="text-sm text-muted-foreground">Choose a customer to proceed to <span className="text-foreground font-semibold">{targetPageTitle}</span>.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 border-b border-border bg-muted">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, company, or TRN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-3 pl-10 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-muted text-foreground placeholder:text-muted-foreground"
                            autoFocus
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {filteredCustomers.length > 0 ? (
                        <div className="space-y-2">
                            {filteredCustomers.map(customer => (
                                <button
                                    key={customer.id}
                                    onClick={() => onSelect(customer)}
                                    className="w-full text-left bg-muted hover:bg-muted border border-border hover:border-border p-4 rounded-xl transition-all group flex items-center justify-between"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted transition-colors">
                                            <UserGroupIcon className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-foreground text-base">
                                                {customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`}
                                            </h4>
                                            <div className="flex items-center text-xs text-muted-foreground mt-1 space-x-2">
                                                {customer.companyName && <span>{customer.companyName}</span>}
                                                {customer.companyName && customer.trn && <span>•</span>}
                                                {customer.trn && (
                                                    <span className="flex items-center">
                                                        <IdentificationIcon className="w-3 h-3 mr-1" />
                                                        {customer.trn}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground group-hover:text-foreground transition-colors text-sm font-medium px-3 py-1 rounded-md bg-muted group-hover:bg-blue-600/20 group-hover:text-blue-400">
                                        Select
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                            <p>No customers found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border bg-muted rounded-b-2xl">
                    <button
                        onClick={onAddNew}
                        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-500 text-foreground font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Add New Customer
                    </button>
                </div>
            </div>
        </div>
    );
};

