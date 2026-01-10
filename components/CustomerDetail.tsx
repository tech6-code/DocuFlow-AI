import React from 'react';
import { useParams } from 'react-router-dom';
import { Customer } from '../types';
import { EnvelopeIcon, PencilIcon, TrashIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon } from './icons';

interface CustomerDetailProps {
    customers: Customer[];
    onEdit: (customer: Customer) => void;
    onDelete: (id: string) => void;
    canEdit: boolean;
    canDelete: boolean;
}

const formatCurrency = (amount: number, currencyCode: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
};

export const CustomerDetail: React.FC<CustomerDetailProps> = ({ customers, onEdit, onDelete, canEdit, canDelete }) => {
    const { id } = useParams<{ id: string }>();
    const customer = customers.find(c => c.id === id);
    const [activeTab, setActiveTab] = React.useState<'overview' | 'deal'>('overview');
    const [expandedSections, setExpandedSections] = React.useState<string[]>([]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev =>
            prev.includes(section)
                ? prev.filter(s => s !== section)
                : [...prev, section]
        );
    };

    const serviceCategories = [
        'Registration',
        'VAT Filing',
        'CT Filing',
        'Business Setup and PRO',
        'Book keeping',
        'Audit'
    ];

    if (!id) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Select a customer to view details
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500">
                Customer not found
            </div>
        );
    }

    const name = customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`;

    return (
        <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="p-6 bg-gray-900 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">{name}</h1>
                    <div className="flex items-center space-x-2 text-sm text-gray-400">
                        {customer.email && (
                            <span className="flex items-center">
                                <EnvelopeIcon className="w-4 h-4 mr-1" /> {customer.email}
                            </span>
                        )}
                        {customer.trn && (
                            <>
                                <span className="text-gray-600">•</span>
                                <span className="font-mono bg-gray-800 px-2 py-0.5 rounded text-xs">{customer.trn}</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex space-x-2">
                    {canEdit && (
                        <button
                            onClick={() => onEdit(customer)}
                            className="flex items-center px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                            <PencilIcon className="w-4 h-4 mr-2" /> Edit
                        </button>
                    )}
                    {canDelete && (
                        <button
                            onClick={() => {
                                if (window.confirm('Are you sure you want to delete this customer?')) {
                                    onDelete(customer.id);
                                }
                            }}
                            className="flex items-center px-3 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-900/40 transition-colors text-sm"
                        >
                            <TrashIcon className="w-4 h-4 mr-2" /> Delete
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="px-6 border-b border-gray-800">
                <nav className="flex space-x-8">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'overview'
                            ? 'border-blue-500 text-blue-500'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('deal')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'deal'
                            ? 'border-blue-500 text-blue-500'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-700'
                            }`}
                    >
                        Deal
                    </button>
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'overview' ? (
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Contact Information</h3>
                                <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <span className="text-gray-400">Email</span>
                                        <span className="col-span-2 text-white">{customer.email || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <span className="text-gray-400">Mobile</span>
                                        <span className="col-span-2 text-white">{customer.mobile || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <span className="text-gray-400">Work Phone</span>
                                        <span className="col-span-2 text-white">{customer.workPhone || '-'}</span>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Address</h3>
                                <div className="bg-gray-800/50 rounded-lg p-4 text-sm text-white whitespace-pre-line">
                                    {customer.billingAddress || 'No address provided'}
                                </div>
                            </section>
                        </div>

                        <div className="space-y-6">
                            <section>
                                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Financial Overview</h3>
                                <div className="bg-gray-800/50 rounded-lg p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-gray-400">Currency</span>
                                        <span className="text-white text-right font-mono">{customer.currency}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <span className="text-gray-400">Opening Balance</span>
                                        <span className="text-white text-right font-mono">{formatCurrency(customer.openingBalance, customer.currency)}</span>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-4 font-sans">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-semibold text-white">Service Categories</h2>
                            <button className="text-blue-400 text-sm hover:underline flex items-center transition-all">
                                Go to transactions <ChevronRightIcon className="w-4 h-4 ml-1" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {serviceCategories.map((category) => {
                                const isExpanded = expandedSections.includes(category);
                                return (
                                    <div key={category} className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900 shadow-sm">
                                        <div
                                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-800/40 transition-all group"
                                            onClick={() => toggleSection(category)}
                                        >
                                            <div className="flex items-center space-x-4">
                                                <div className="p-1 rounded-md bg-gray-800 group-hover:bg-gray-700 transition-colors">
                                                    {isExpanded ? (
                                                        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </div>
                                                <span className="text-gray-100 font-medium tracking-tight group-hover:text-white transition-colors">
                                                    {category}
                                                </span>
                                            </div>
                                            <button
                                                className="flex items-center px-4 py-1.5 bg-blue-600/10 text-blue-400 rounded-lg hover:bg-blue-600/20 active:scale-95 transition-all text-xs font-bold border border-blue-600/20"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    console.log(`New deal for ${category}`);
                                                }}
                                            >
                                                <PlusIcon className="w-4 h-4 mr-1.5" /> New
                                            </button>
                                        </div>
                                        {isExpanded && (
                                            <div className="px-8 py-10 border-t border-gray-800 bg-gray-950/40 text-center animate-fadeIn">
                                                <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                                                    <PlusIcon className="w-6 h-6 text-gray-500" />
                                                </div>
                                                <p className="text-gray-500 text-sm font-medium">No {category.toLowerCase()} deals found for this customer.</p>
                                                <button
                                                    className="mt-4 text-xs text-blue-500/80 hover:text-blue-400 transition-colors"
                                                    onClick={() => console.log(`Creating deal for ${category}`)}
                                                >
                                                    Click 'New' to add your first deal
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
