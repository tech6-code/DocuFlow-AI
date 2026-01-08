import React, { useState, useEffect } from 'react';
import { ArrowRightIcon, ChevronLeftIcon, DocumentArrowDownIcon } from './icons';

export interface BalanceSheetItem {
    id: string;
    label: string;
    type: 'header' | 'subheader' | 'item' | 'total' | 'grand_total';
    isEditable?: boolean;
}

interface BalanceSheetStepProps {
    onNext: () => void;
    onBack: () => void;
    data: Record<string, number>;
    onChange: (id: string, value: number) => void;
    onExport: () => void;
}

export const BS_ITEMS: BalanceSheetItem[] = [
    // Assets
    { id: 'assets_header', label: 'Assets', type: 'header' },

    { id: 'non_current_assets_header', label: 'Non-current assets', type: 'subheader' },
    { id: 'property_plant_equipment', label: 'Property, plant and equipment', type: 'item', isEditable: true },
    { id: 'total_non_current_assets', label: 'Total non current assets', type: 'total', isEditable: true },

    { id: 'current_assets_header', label: 'Current assets', type: 'subheader' },
    { id: 'cash_bank_balances', label: 'Cash and bank balances', type: 'item', isEditable: true },
    { id: 'inventories', label: 'Inventories', type: 'item', isEditable: true },
    { id: 'trade_receivables', label: 'Trade receivables', type: 'item', isEditable: true },
    { id: 'advances_deposits_receivables', label: 'Advances, deposits and other receivables', type: 'item', isEditable: true },
    { id: 'related_party_transactions_assets', label: 'Related party transactions', type: 'item', isEditable: true },
    { id: 'total_current_assets', label: 'Total current assets', type: 'total', isEditable: true },

    { id: 'total_assets', label: 'Total assets', type: 'grand_total', isEditable: true },

    // Equity and Liabilities
    { id: 'equity_liabilities_header', label: 'Equity and liabilities', type: 'header' },

    { id: 'equity_header', label: 'Equity', type: 'subheader' },
    { id: 'share_capital', label: 'Share capital', type: 'item', isEditable: true },
    { id: 'statutory_reserve', label: 'Statutory reserve', type: 'item', isEditable: true },
    { id: 'retained_earnings', label: 'Retained earnings', type: 'item', isEditable: true },
    { id: 'shareholders_current_accounts', label: "Shareholders' current accounts:", type: 'item', isEditable: true },
    { id: 'total_equity', label: 'Total equity', type: 'total', isEditable: true },

    { id: 'non_current_liabilities_header', label: 'Non-current liabilities', type: 'subheader' },
    { id: 'employees_end_service_benefits', label: "Employees' end of service benefits", type: 'item', isEditable: true },
    { id: 'bank_borrowings_non_current', label: 'Bank borrowings - non current portion', type: 'item', isEditable: true },
    { id: 'total_non_current_liabilities', label: 'Total non-current liabilities', type: 'total', isEditable: true },

    { id: 'current_liabilities_header', label: 'Current liabilities', type: 'subheader' },
    { id: 'short_term_borrowings', label: 'Short term borrowings', type: 'item', isEditable: true },
    { id: 'related_party_transactions_liabilities', label: 'Related party transactions', type: 'item', isEditable: true },
    { id: 'trade_other_payables', label: 'Trade and other payables', type: 'item', isEditable: true },
    { id: 'total_current_liabilities', label: 'Total current liabilities', type: 'total', isEditable: true },

    { id: 'total_liabilities', label: 'Total liabilities', type: 'total', isEditable: true },

    { id: 'total_equity_liabilities', label: 'Total equity and liabilities', type: 'grand_total', isEditable: true },
];

export const BalanceSheetStep: React.FC<BalanceSheetStepProps> = ({ onNext, onBack, data, onChange, onExport }) => {

    const handleInputChange = (id: string, inputValue: string) => {
        const val = parseFloat(inputValue);
        if (!isNaN(val)) {
            onChange(id, val);
        } else if (inputValue === '' || inputValue === '-') {
            onChange(id, 0);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col h-[85vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10 w-full">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="bg-purple-600 w-2 h-8 rounded-full"></span>
                    Statement of Financial Position
                </h2>
                <div className="flex gap-3">
                    <button
                        onClick={onExport}
                        className="flex items-center px-4 py-2 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors border border-gray-700 shadow-sm"
                    >
                        <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                        Export Excel
                    </button>
                    <button
                        onClick={onBack}
                        className="flex items-center px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-700"
                    >
                        <ChevronLeftIcon className="w-5 h-5 mr-2" />
                        Back
                    </button>
                    <button
                        onClick={onNext}
                        className="flex items-center px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/30"
                    >
                        Confirm & Continue
                        <ArrowRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-[#0a0f1a] custom-scrollbar">
                <div className="bg-gray-900 text-white max-w-4xl mx-auto shadow-xl ring-1 ring-gray-800 rounded-lg min-h-[800px] relative">
                    <div className="p-12">
                        <div className="space-y-2">
                            {BS_ITEMS.map((item) => (
                                <div
                                    key={item.id}
                                    className={`
                                        flex items-center justify-between py-2 border-b border-transparent hover:bg-gray-800/20 px-4 transition-colors rounded
                                        ${item.type === 'header' ? 'text-xl font-black text-white mt-8 mb-4 border-b-2 border-gray-700 pb-2 uppercase tracking-wide' : ''}
                                        ${item.type === 'subheader' ? 'text-lg italic text-purple-200 mt-6 mb-2 pl-4 font-semibold' : ''}
                                        ${item.type === 'total' ? 'font-bold text-white mt-2 border-t border-gray-600 pt-3 pb-2 bg-gray-800/30' : ''}
                                        ${item.type === 'grand_total' ? 'text-xl font-black text-white mt-6 border-t-4 border-double border-purple-500 pt-4 pb-4 bg-purple-900/10' : ''}
                                        ${item.type === 'item' ? 'text-gray-300 font-normal pl-8' : ''}
                                    `}
                                >
                                    <div className="flex-1">
                                        {item.label}
                                    </div>

                                    {(item.type === 'item' || item.type === 'total' || item.type === 'grand_total') && (
                                        <div className="w-48 text-right">
                                            {item.isEditable ? (
                                                <div className="relative group">
                                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-600 text-xs group-focus-within:text-purple-400 transition-colors pointer-events-none">AED</span>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={data[item.id] || ''}
                                                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                                                        className={`
                                                            w-full text-right bg-transparent border-b border-gray-700 focus:border-purple-500 outline-none py-1 px-1 font-mono text-white
                                                            group-hover:border-gray-600 transition-colors placeholder-gray-700
                                                            ${item.type === 'total' || item.type === 'grand_total' ? 'font-bold' : ''}
                                                        `}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-mono text-gray-600">-</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-gray-900 border-t border-gray-800 text-center text-gray-500 text-sm">
                Please ensure Total Assets match Total Equity and Liabilities.
            </div>
        </div>
    );
};
