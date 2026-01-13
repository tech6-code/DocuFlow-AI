import React, { useState } from 'react';
import { Deal } from '../types';
import { useNavigate, useParams } from 'react-router-dom';
import { MagnifyingGlassIcon, PlusIcon, ArrowLeftIcon } from './icons';

interface DealListSidebarProps {
    deals: Deal[];
    onAddDeal?: () => void;
}

export const DealListSidebar: React.FC<DealListSidebarProps> = ({ deals, onAddDeal }) => {
    const navigate = useNavigate();
    const { id: selectedId } = useParams<{ id: string }>();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredDeals = deals.filter(deal => {
        return (deal.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (deal.name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    });

    return (
        <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-full">
            <div className="p-4 border-b border-gray-800">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => navigate('/sales/deals')}
                            className="p-1 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                            title="Back to List"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-semibold text-white">Deals</h2>
                    </div>
                    {onAddDeal && (
                        <button
                            onClick={onAddDeal}
                            className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                            title="Add Deal"
                        >
                            <PlusIcon className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search deals..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filteredDeals.length > 0 ? (
                    filteredDeals.map(deal => {
                        const isSelected = selectedId === deal.id;

                        return (
                            <div
                                key={deal.id}
                                onClick={() => navigate(`/sales/deals/${deal.id}`)}
                                className={`p-4 border-b border-gray-800 cursor-pointer transition-colors ${isSelected ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : 'hover:bg-gray-800/50 border-l-4 border-l-transparent'
                                    }`}
                            >
                                <h3 className={`font-medium text-sm mb-1 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                    {deal.companyName}
                                </h3>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-gray-500 truncate">{deal.name}</p>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400`}>
                                        {deal.paymentStatus}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        No deals found.
                    </div>
                )}
            </div>
        </div>
    );
};
