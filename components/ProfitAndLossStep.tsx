import React, { useState } from 'react';
import { ArrowRightIcon, ChevronLeftIcon, DocumentArrowDownIcon } from './icons';

export interface ProfitAndLossItem {
    id: string;
    label: string;
    type: 'header' | 'item' | 'total' | 'subsection_header';
    indent?: boolean;
    isEditable?: boolean;
}

interface ProfitAndLossStepProps {
    onNext: () => void;
    onBack: () => void; // Passed but currently handled by parent state for back, UI button calls this.
    data: Record<string, number>;
    onChange: (id: string, value: number) => void;
    onExport: () => void;
    structure?: ProfitAndLossItem[]; // Optional for backward compat if needed, but should be required now
    onAddAccount?: (item: ProfitAndLossItem & { sectionId: string }) => void;
}
import { PlusIcon, XMarkIcon } from './icons';

export const PNL_ITEMS: ProfitAndLossItem[] = [
    { id: 'revenue', label: 'Revenue', type: 'item', isEditable: true },
    { id: 'cost_of_revenue', label: 'Cost of revenue', type: 'item', isEditable: true },
    { id: 'gross_profit', label: 'Gross profit', type: 'total', isEditable: true },

    { id: 'other_income', label: 'Other income', type: 'item', isEditable: true },
    { id: 'unrealised_gain_loss_fvtpl', label: 'Unrealised gain/(loss) on investments at fair value through profit or loss (FVTPL)', type: 'item', isEditable: true },
    { id: 'share_profits_associates', label: 'Share of profits of associates', type: 'item', isEditable: true },
    { id: 'gain_loss_revaluation_property', label: 'Gain/(loss) on revaluation of investment property', type: 'item', isEditable: true },
    { id: 'impairment_losses_ppe', label: 'Impairment losses on property, plant and equipment', type: 'item', isEditable: true },
    { id: 'impairment_losses_intangible', label: 'Impairment losses on intangible assets', type: 'item', isEditable: true },
    { id: 'business_promotion_selling', label: 'Business Promotion & Selling Expenses', type: 'item', isEditable: true },
    { id: 'foreign_exchange_loss', label: 'Foreign Exchange Loss', type: 'item', isEditable: true },
    { id: 'selling_distribution_expenses', label: 'Selling and distribution expenses', type: 'item', isEditable: true },
    { id: 'administrative_expenses', label: 'Administrative expenses', type: 'item', isEditable: true },
    { id: 'finance_costs', label: 'Finance costs', type: 'item', isEditable: true },
    { id: 'depreciation_ppe', label: 'Depreciation on property, plant and equipment', type: 'item', isEditable: true },

    { id: 'profit_loss_year', label: 'Profit / (loss) for the year', type: 'total', isEditable: true },

    { id: 'other_comprehensive_income', label: 'Other comprehensive income', type: 'header' },
    { id: 'items_not_reclassified', label: 'Items that will not be reclassified subsequently to profit or loss', type: 'subsection_header', indent: true },
    { id: 'gain_revaluation_property', label: 'Gain on revaluation of property', type: 'item', indent: true, isEditable: true },
    { id: 'share_gain_loss_revaluation_associates', label: 'Share of gain/(loss) on property revaluation of associates', type: 'item', indent: true, isEditable: true },

    { id: 'items_may_reclassified', label: 'Items that may be reclassified subsequently to profit or loss', type: 'subsection_header', indent: true },
    { id: 'changes_fair_value_available_sale', label: 'Changes in fair value of available-for-sale investments', type: 'item', indent: true, isEditable: true },
    { id: 'changes_fair_value_available_sale_reclassified', label: 'Changes in fair value of available-for-sale investments reclassified to profit or loss', type: 'item', indent: true, isEditable: true },
    { id: 'exchange_difference_translating', label: 'Exchange difference on translating foreign operation', type: 'item', indent: true, isEditable: true },

    { id: 'total_comprehensive_income', label: 'Total comprehensive income/ (loss) for the year', type: 'total', isEditable: true },

    { id: 'provisions_corporate_tax', label: 'Provisions for corporate tax', type: 'item', isEditable: true },
    { id: 'profit_after_tax', label: 'Profit after Tax', type: 'item', isEditable: true },
];

export const ProfitAndLossStep: React.FC<ProfitAndLossStepProps> = ({ onNext, onBack, data, onChange, onExport, structure = PNL_ITEMS, onAddAccount }) => {

    const [showAddModal, setShowAddModal] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountSection, setNewAccountSection] = useState('');

    const handleAddSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newAccountName && newAccountSection && onAddAccount) {
            const newItem: ProfitAndLossItem & { sectionId: string } = {
                id: newAccountName.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
                label: newAccountName,
                type: 'item',
                isEditable: true,
                sectionId: newAccountSection,
                indent: true // Default to indented for custom items? Or maybe check section type.
            };
            onAddAccount(newItem);
            setShowAddModal(false);
            setNewAccountName('');
            setNewAccountSection('');
        }
    };

    // Filter potential sections (headers) for the dropdown
    const sections = structure.filter(i => i.type === 'header' || i.type === 'subsection_header' || i.type === 'total'); // Allow adding after totals too? Maybe just headers/subheaders.

    const handleInputChange = (id: string, inputValue: string) => {
        // Allow typing, but storing as number in parent.
        // For smoother typing we might need local state if we want to allow invalid partials like "0."
        // But for simplicity with prop-driven change, let's just parse float.
        // A better approach for forms is distinct display value vs stored value, 
        // but here we will just parse whatever is valid or 0.
        // Actually, to support "1." or "-" we need to be careful.
        // Let's assume the parent handles state and we just pass parsed number.
        const val = parseFloat(inputValue);
        if (!isNaN(val)) {
            onChange(id, val);
        } else if (inputValue === '' || inputValue === '-') {
            onChange(id, 0); // Or handle visually
        }
    };

    // Helper to format for display - we need to handle the fact that parent stores numbers
    const getDisplayValue = (id: string) => {
        const val = data[id];
        if (val === undefined || val === null) return '0.00';
        return val.toFixed(2);
    };

    return (
        <div className="w-full max-w-5xl mx-auto bg-gray-900 rounded-xl border border-gray-800 shadow-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900 z-10 w-full">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <span className="bg-blue-600 w-2 h-8 rounded-full"></span>
                    Profit & Loss Statement
                </h2>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center px-4 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 font-semibold rounded-lg transition-colors border border-blue-600/30"
                    >
                        <PlusIcon className="w-5 h-5 mr-2" />
                        Add Account
                    </button>
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
                        className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
                    >
                        Confirm & Continue
                        <ArrowRightIcon className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-[#0a0f1a] custom-scrollbar">
                <div className="bg-gray-900 text-white max-w-4xl mx-auto shadow-xl ring-1 ring-gray-800 rounded-lg min-h-[800px] relative">

                    <div className="p-12">
                        <div className="space-y-1">
                            {structure.map((item) => (
                                <div
                                    key={item.id}
                                    className={`
                                        flex items-center justify-between py-3 border-b border-gray-800/50 hover:bg-gray-800/30 px-3 transition-colors rounded
                                        ${item.type === 'total' || item.type === 'header' ? 'font-bold text-lg mt-6 mb-2 text-white' : 'font-normal text-base text-gray-300'}
                                        ${item.type === 'subsection_header' ? 'italic text-gray-400 mt-4 mb-1' : ''}
                                    `}
                                >
                                    <div className={`flex-1 ${item.indent ? 'pl-8' : ''}`}>
                                        {item.label}
                                    </div>

                                    {(item.type === 'item' || item.type === 'total') && (
                                        <div className="w-48 text-right">
                                            {item.isEditable ? (
                                                <div className="relative group">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs group-focus-within:text-blue-400 transition-colors">AED</span>
                                                    <input
                                                        type="number" // Using number type for simpler handling in this iteration
                                                        step="0.01"
                                                        value={data[item.id] || ''}
                                                        onChange={(e) => handleInputChange(item.id, e.target.value)}
                                                        className={`
                                                            w-full text-right bg-transparent border-b border-gray-700 focus:border-blue-500 outline-none py-1.5 px-1 font-mono text-white
                                                            group-hover:border-gray-600 transition-colors placeholder-gray-700
                                                            ${item.type === 'total' ? 'font-bold text-blue-200' : ''}
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
                Review the generated Profit & Loss figures. Adjust if necessary before proceeding.
            </div>

            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-white">Add New Account</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubmit}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Section</label>
                                    <select
                                        value={newAccountSection}
                                        onChange={(e) => setNewAccountSection(e.target.value)}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                        required
                                    >
                                        <option value="">Select a section...</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>{s.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Account Name</label>
                                    <input
                                        type="text"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-blue-500 outline-none"
                                        placeholder="e.g. Marketing Expenses"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-gray-800/50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-gray-400 hover:text-white font-semibold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-colors"
                                >
                                    Add Account
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
