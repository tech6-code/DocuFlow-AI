
import React from 'react';
import type { Customer, Page } from '../types';
import { ChartPieIcon, BriefcaseIcon, XMarkIcon, ScaleIcon, MagnifyingGlassIcon, ClipboardCheckIcon } from './icons';

interface CustomerProjectsModalProps {
    customer: Customer;
    onSelectProject: (page: Page) => void;
    onClose: () => void;
}

const ProjectOption = ({ icon, title, description, onClick }: { icon: React.ReactNode, title: string, description: string, onClick: () => void }) => (
    <button 
        onClick={onClick}
        className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:bg-gray-700 hover:border-gray-500 transition-all text-left group flex flex-col h-full shadow-sm"
    >
        <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center ring-1 ring-gray-600 mb-4 group-hover:scale-110 transition-transform">
            {icon}
        </div>
        <h3 className="text-lg font-bold text-white mb-1">{title}</h3>
        <p className="text-sm text-gray-400">{description}</p>
    </button>
);

export const CustomerProjectsModal: React.FC<CustomerProjectsModalProps> = ({ customer, onSelectProject, onClose }) => {
    const customerName = customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl border border-gray-700 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-white">Projects for {customerName}</h2>
                        <p className="text-sm text-gray-400">Select a workflow to proceed.</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <ProjectOption 
                            icon={<ScaleIcon className="w-6 h-6 text-blue-400"/>}
                            title="Bookkeeping"
                            description="Centralized view of financial documents and analysis."
                            onClick={() => onSelectProject('projectFinancialOverview')}
                        />
                        <ProjectOption 
                            icon={<ChartPieIcon className="w-6 h-6 text-green-400"/>}
                            title="VAT Filing"
                            description="Upload invoices and statements for VAT return."
                            onClick={() => onSelectProject('projectVatFiling')}
                        />
                        <ProjectOption 
                            icon={<BriefcaseIcon className="w-6 h-6 text-purple-400"/>}
                            title="Corporate Tax Filing"
                            description="Manage corporate tax returns and filings."
                            onClick={() => onSelectProject('projectCtFiling')}
                        />
                        <ProjectOption 
                            icon={<MagnifyingGlassIcon className="w-6 h-6 text-orange-400"/>}
                            title="Audit Report"
                            description="Generate IFRS-compliant audit reports."
                            onClick={() => onSelectProject('projectAuditReport')}
                        />
                        <ProjectOption 
                            icon={<ClipboardCheckIcon className="w-6 h-6 text-yellow-400"/>}
                            title="Registration"
                            description="Upload IDs and licenses for registration."
                            onClick={() => onSelectProject('projectRegistration')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
