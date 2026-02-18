
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
        className="w-full text-left p-6 bg-card rounded-lg border border-border hover:bg-accent hover:border-border transition-all group flex items-start space-x-4 shadow-sm"
        aria-label={`Select ${title}: ${description}`}
    >
        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center ring-1 ring-border flex-shrink-0">
            {icon}
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                <ArrowRightIcon className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-muted-foreground mt-1">{description}</p>
        </div>
    </button>
);

export const CtFilingTypeSelection: React.FC<CtFilingTypeSelectionProps> = ({ onSelectType, onBack }) => {
    const options = [
        { type: 1, title: "Type 1", description: "Bank Statement", icon: <BanknotesIcon className="w-7 h-7 text-foreground" /> },
        { type: 2, title: "Type 2", description: "Bank Statement & Invoices/Bills", icon: <DocumentTextIcon className="w-7 h-7 text-foreground" /> },
        { type: 3, title: "Type 3", description: "Trial Balance", icon: <ChartPieIcon className="w-7 h-7 text-foreground" /> },
        { type: 4, title: "Type 4", description: "Audit Report", icon: <ShieldCheckIcon className="w-7 h-7 text-foreground" /> }
    ];

    return (
        <div className="max-w-4xl mx-auto">
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
                >
                    <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Dashboard
                </button>
            )}
            <div className="text-center mb-10">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">New Corporate Tax Filing</h2>
                <p className="mt-2 text-lg text-muted-foreground">Please select the type of documents you need to file.</p>
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
