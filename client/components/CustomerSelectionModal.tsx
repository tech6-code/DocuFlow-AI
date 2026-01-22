
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-700 flex flex-col max-h-[80vh]">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">Select Customer</h2>
                        <p className="text-sm text-gray-400">Choose a customer to proceed to <span className="text-white font-semibold">{targetPageTitle}</span>.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name, company, or TRN..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-3 pl-10 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-gray-900 text-white placeholder-gray-500"
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
                                    className="w-full text-left bg-gray-800/50 hover:bg-gray-700 border border-gray-700 hover:border-gray-500 p-4 rounded-xl transition-all group flex items-center justify-between"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center group-hover:bg-gray-600 transition-colors">
                                            <UserGroupIcon className="w-5 h-5 text-gray-300 group-hover:text-white" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-white text-base">
                                                {customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`}
                                            </h4>
                                            <div className="flex items-center text-xs text-gray-400 mt-1 space-x-2">
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
                                    <div className="text-gray-500 group-hover:text-white transition-colors text-sm font-medium px-3 py-1 rounded-md bg-gray-800 group-hover:bg-blue-600/20 group-hover:text-blue-400">
                                        Select
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                            <p>No customers found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-800 bg-gray-900/50 rounded-b-2xl">
                    <button
                        onClick={onAddNew}
                        className="w-full flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Add New Customer
                    </button>
                </div>
            </div>
        </div>
    );
};
