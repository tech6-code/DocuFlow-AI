import React, { useState } from 'react';
import { Lead } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { MagnifyingGlassIcon, PlusIcon, ArrowLeftIcon } from './icons';

interface LeadListSidebarProps {
    leads: Lead[];
    onAddLead?: () => void;
}

export const LeadListSidebar: React.FC<LeadListSidebarProps> = ({ leads, onAddLead }) => {
    const navigate = useNavigate();
    const { id: selectedId } = useParams<{ id: string }>();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLeads = leads.filter(lead => {
        return (lead.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex flex-col h-full bg-card border-r border-border w-full">
            <div className="p-4 border-b border-border">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => navigate('/sales/leads')}
                            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Back to List"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-semibold text-foreground">Leads</h2>
                    </div>
                    {onAddLead && (
                        <button
                            onClick={onAddLead}
                            className="p-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors"
                            title="Add Lead"
                        >
                            <PlusIcon className="w-5 h-5 text-primary-foreground" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-muted border border-border rounded-lg text-sm text-foreground placeholder-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredLeads.length > 0 ? (
                    filteredLeads.map(lead => {
                        const isSelected = selectedId === lead.id;

                        return (
                            <div
                                key={lead.id}
                                onClick={() => navigate(`/sales/leads/${lead.id}`)}
                                className={`p-4 border-b border-border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-l-4 border-l-primary' : 'hover:bg-muted/50 border-l-4 border-l-transparent'
                                    }`}
                            >
                                <h3 className={`font-medium text-sm mb-1 ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                                    {lead.companyName}
                                </h3>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground`}>
                                        {lead.status}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                        No leads found.
                    </div>
                )}
            </div>
        </div>
    );
};
