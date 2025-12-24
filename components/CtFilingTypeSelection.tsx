
import React from 'react';
import { ArrowRightIcon, BanknotesIcon, DocumentTextIcon, ChartPieIcon, ShieldCheckIcon, ChevronLeftIcon } from './icons';

interface CtFilingTypeSelectionProps {
    onSelectType: (type: number) => void;
    onBack?: () => void;
}

interface OptionCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}

const OptionCard: React.FC<OptionCardProps> = ({ icon, title, description, onClick }) => (
    <button 
        onClick={onClick} 
        className="w-full text-left p-6 bg-gray-900 rounded-lg border border-gray-700 hover:bg-gray-800 hover:border-gray-600 transition-all group flex items-start space-x-4"
        aria-label={`Select ${title}: ${description}`}
    >
        <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center ring-1 ring-gray-700 flex-shrink-0">
            {icon}
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <ArrowRightIcon className="w-5 h-5 text-gray-500 group-hover:text-white group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-gray-400 mt-1">{description}</p>
        </div>
    </button>
);

export const CtFilingTypeSelection: React.FC<CtFilingTypeSelectionProps> = ({ onSelectType, onBack }) => {
    const options = [
        { type: 1, title: "Type 1", description: "Bank Statement", icon: <BanknotesIcon className="w-7 h-7 text-white" /> },
        { type: 2, title: "Type 2", description: "Bank Statement & Invoices/Bills", icon: <DocumentTextIcon className="w-7 h-7 text-white" /> },
        { type: 3, title: "Type 3", description: "Trial Balance", icon: <ChartPieIcon className="w-7 h-7 text-white" /> },
        { type: 4, title: "Type 4", description: "Internal & External Audit Report", icon: <ShieldCheckIcon className="w-7 h-7 text-white" /> }
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {onBack && (
                <button 
                    onClick={onBack} 
                    className="mb-6 text-sm text-gray-400 hover:text-white flex items-center transition-colors"
                >
                    <ChevronLeftIcon className="w-4 h-4 mr-1"/> Back to Dashboard
                </button>
            )}
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-white tracking-tight">New Corporate Tax Filing</h2>
                <p className="mt-2 text-lg text-gray-400">Please select the type of documents you need to file.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map(opt => (
                    <OptionCard 
                        key={opt.type}
                        icon={opt.icon}
                        title={opt.title}
                        description={opt.description}
                        onClick={() => onSelectType(opt.type)}
                    />
                ))}
            </div>
        </div>
    );
};
