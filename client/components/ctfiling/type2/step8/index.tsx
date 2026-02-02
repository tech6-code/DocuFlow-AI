import React from 'react';
import { useCtType2StepContext } from '../CtType2StepContext';

export const Step8: React.FC = () => {
    const {
        openingBalancesData,
        CHART_OF_ACCOUNTS,
        obFileInputRef,
        setOpeningBalanceFiles,
        setNewGlobalAccountName,
        setShowGlobalAddAccountModal,
        isExtractingOpeningBalances,
        LoadingIndicator,
        openingBalanceFiles,
        setOpenObSection,
        openObSection,
        formatWholeNumber,
        ChevronDownIcon,
        ChevronRightIcon,
        handleObCellChange,
        handleBack,
        handleExportStepOpeningBalances,
        handleOpeningBalancesComplete,
        roundAmount,
        DocumentArrowDownIcon,
        PlusIcon,
        AssetIcon,
        ScaleIcon,
        IncomeIcon,
        ExpenseIcon,
        EquityIcon,
        BriefcaseIcon
    } = useCtType2StepContext();

    const ACCOUNT_MAPPING: Record<string, string> = {
        'Cash on Hand': 'Cash on Hand',
        'Bank Accounts': 'Bank Accounts',
        'Accounts Receivable': 'Accounts Receivable',
        'Due from related Parties': 'Due from related Parties',
        'Prepaid Expenses': 'Prepaid Expenses',
        'Advances to Suppliers': 'Prepaid Expenses',
        'Deposits': 'Deposits',
        'VAT Recoverable (Input VAT)': 'VAT Recoverable (Input VAT)',
        'Furniture & Equipment': 'Property, Plant & Equipment',
        'Vehicles': 'Property, Plant & Equipment',
        'Intangibles (Software, Patents)': 'Property, Plant & Equipment',
        'Accounts Payable': 'Accounts Payable',
        'Due to Related Parties': 'Due to Related Parties',
        'Accrued Expenses': 'Accrued Expenses',
        'VAT Payable (Output VAT)': 'VAT Payable (Output VAT)',
        'Long-Term Loans': 'Long-Term Liabilities',
        'Loans from Related Parties': 'Long-Term Liabilities',
        'Employee End-of-Service Benefits Provision': 'Long-Term Liabilities',
        'Share Capital / Ownerâ€™s Equity': 'Share Capital / Ownerâ€™s Equity',
        'Retained Earnings': 'Retained Earnings',
        'Current Year Profit/Loss': 'Retained Earnings',
        'Dividends / Ownerâ€™s Drawings': 'Dividends / Ownerâ€™s Drawings',
        "Owner's Current Account": "Owner's Current Account",
        'Sales Revenue': 'Sales Revenue',
        'Sales to related Parties': 'Sales Revenue',
        'Interest Income': 'Interest Income',
        'Interest from Related Parties': 'Interest Income',
        'Miscellaneous Income': 'Miscellaneous Income',
        'Other Operating Income': 'Miscellaneous Income',
        'Direct Cost (COGS)': 'Direct Cost (COGS)',
        'Purchases from Related Parties': 'Purchases from Related Parties',
        'Salaries & Wages': 'Salaries & Wages',
        'Staff Benefits': 'Salaries & Wages',
        'Training & Development': 'Training & Development',
        'Rent Expense': 'Rent Expense',
        'Utility - Electricity & Water': 'Utility - Electricity & Water',
        'Utility - Telephone & Internet': 'Utility - Telephone & Internet',
        'Office Supplies & Stationery': 'Office Supplies & Stationery',
        'Repairs & Maintenance': 'Repairs & Maintenance',
        'Insurance Expense': 'Insurance Expense',
        'Marketing & Advertising': 'Marketing & Advertising',
        'Travel & Entertainment': 'Travel & Entertainment',
        'Professional Fees (Audit, Consulting)': 'Professional Fees',
        'Legal Fees': 'Legal Fees',
        'IT & Software Subscriptions': 'IT & Software Subscriptions',
        'Fuel Expenses': 'Fuel Expenses',
        'Transportation & Logistics': 'Transportation & Logistics',
        'Interest Expense': 'Interest Expense',
        'Interest to Related Parties': 'Interest to Related Parties',
        'Bank Charges': 'Bank Charges',
        'Corporate Tax Expense': 'Corporate Tax Expense',
        'Government Fees & Licenses': 'Government Fees & Licenses',
        'Depreciation â€“ Furniture & Equipment': 'Depreciation',
        'Depreciation â€“ Vehicles': 'Depreciation',
        'Amortization â€“ Intangibles': 'Depreciation',
        'VAT Expense (non-recoverable)': 'Miscellaneous Expense',
        'Bad Debt Expense': 'Miscellaneous Expense',
        'Miscellaneous Expense': 'Miscellaneous Expense'
    };

    const getIconForSection = (label: string) => {
        if (label.includes('Assets')) return AssetIcon;
        if (label.includes('Liabilities')) return ScaleIcon;
        if (label.includes('Incomes') || label.includes('Income')) return IncomeIcon;
        if (label.includes('Expenses')) return ExpenseIcon;
        if (label.includes('Equity')) return EquityIcon;
        return BriefcaseIcon;
    };

    const buckets: Record<string, { debit: number; credit: number; isCustom?: boolean }> = {};
    const structure = [
        { type: 'header', label: 'Assets' },
        { type: 'subheader', label: 'Current Assets' },
        { type: 'row', label: 'Cash on Hand' },
        { type: 'row', label: 'Bank Accounts' },
        { type: 'row', label: 'Accounts Receivable' },
        { type: 'row', label: 'Due from related Parties' },
        { type: 'row', label: 'Prepaid Expenses' },
        { type: 'row', label: 'Deposits' },
        { type: 'row', label: 'VAT Recoverable (Input VAT)' },
        { type: 'subheader', label: 'Non Current Asset' },
        { type: 'row', label: 'Property, Plant & Equipment' },

        { type: 'header', label: 'Liabilities' },
        { type: 'subheader', label: 'Current Liabilities' },
        { type: 'row', label: 'Accounts Payable' },
        { type: 'row', label: 'Due to Related Parties' },
        { type: 'row', label: 'Accrued Expenses' },
        { type: 'row', label: 'VAT Payable (Output VAT)' },
        { type: 'subheader', label: 'Long-Term Liabilities' },
        { type: 'row', label: 'Long-Term Liabilities' },

        { type: 'header', label: 'Equity' },
        { type: 'row', label: 'Share Capital / Ownerâ€™s Equity' },
        { type: 'row', label: 'Retained Earnings' },
        { type: 'row', label: 'Dividends / Ownerâ€™s Drawings' },
        { type: 'row', label: "Owner's Current Account" },

        { type: 'header', label: 'Income' },
        { type: 'subheader', label: 'Operating Income' },
        { type: 'row', label: 'Sales Revenue' },
        { type: 'subheader', label: 'Other Income' },
        { type: 'row', label: 'Interest Income' },
        { type: 'row', label: 'Miscellaneous Income' },

        { type: 'header', label: 'Expenses' },
        { type: 'subheader', label: 'Direct Costs' },
        { type: 'row', label: 'Direct Cost (COGS)' },
        { type: 'row', label: 'Purchases from Related Parties' },
        { type: 'subheader', label: 'Other Expense' },
        { type: 'row', label: 'Salaries & Wages' },
        { type: 'row', label: 'Training & Development' },
        { type: 'row', label: 'Rent Expense' },
        { type: 'row', label: 'Utility - Electricity & Water' },
        { type: 'row', label: 'Utility - Telephone & Internet' },
        { type: 'row', label: 'Office Supplies & Stationery' },
        { type: 'row', label: 'Repairs & Maintenance' },
        { type: 'row', label: 'Insurance Expense' },
        { type: 'row', label: 'Marketing & Advertising' },
        { type: 'row', label: 'Travel & Entertainment' },
        { type: 'row', label: 'Professional Fees' },
        { type: 'row', label: 'Legal Fees' },
        { type: 'row', label: 'IT & Software Subscriptions' },
        { type: 'row', label: 'Fuel Expenses' },
        { type: 'row', label: 'Transportation & Logistics' },
        { type: 'row', label: 'Interest Expense' },
        { type: 'row', label: 'Interest to Related Parties' },
        { type: 'row', label: 'Bank Charges' },
        { type: 'row', label: 'Corporate Tax Expense' },
        { type: 'row', label: 'Government Fees & Licenses' },
        { type: 'row', label: 'Depreciation' },
        { type: 'row', label: 'Miscellaneous Expense' },
    ];

    structure.forEach(item => {
        if (item.type === 'row' || item.type === 'subrow') {
            buckets[item.label] = { debit: 0, credit: 0 };
        }
    });

    if (openingBalancesData) {
        openingBalancesData.forEach((entry: any) => {
            if (entry.account.toLowerCase() === 'totals') return;

            if (buckets[entry.account]) {
                buckets[entry.account].debit += entry.debit;
                buckets[entry.account].credit += entry.credit;
            }
            else if (ACCOUNT_MAPPING[entry.account] && buckets[ACCOUNT_MAPPING[entry.account]]) {
                buckets[ACCOUNT_MAPPING[entry.account]].debit += entry.debit;
                buckets[ACCOUNT_MAPPING[entry.account]].credit += entry.credit;
            }
            else {
                buckets[entry.account] = { debit: entry.debit, credit: entry.credit, isCustom: true };
            }
        });
    }

    interface TbSection {
        title: string;
        icon: React.FC<React.SVGProps<SVGSVGElement>>;
        items: any[];
        totalDebit: number;
        totalCredit: number;
    }

    const sections: TbSection[] = [];
    let currentSection: TbSection | null = null;

    structure.forEach(item => {
        if (item.type === 'header') {
            if (currentSection) sections.push(currentSection);
            currentSection = {
                title: item.label,
                icon: getIconForSection(item.label),
                items: [],
                totalDebit: 0,
                totalCredit: 0
            };
        } else if (currentSection) {
            if (item.type === 'subheader') {
                currentSection.items.push(item);
            } else {
                const vals = buckets[item.label] || { debit: 0, credit: 0 };
                currentSection.items.push({ ...item, ...vals });
                currentSection.totalDebit += vals.debit;
                currentSection.totalCredit += vals.credit;
            }
        }
    });
    if (currentSection) sections.push(currentSection);

    const obExclTotals = (openingBalancesData || []).filter((item: any) => item.account.toLowerCase() !== 'totals');

    obExclTotals.forEach((entry: any) => {
        if (buckets[entry.account]?.isCustom) {
            let targetSectionTitle = 'Expenses';
            for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
                if (Array.isArray(details)) {
                    if (details.includes(entry.account)) { targetSectionTitle = mainCat; break; }
                } else {
                    for (const [subGroup, accounts] of Object.entries(details)) {
                        if ((accounts as string[]).includes(entry.account)) { targetSectionTitle = mainCat; break; }
                    }
                }
            }
            if (targetSectionTitle === 'Revenues') targetSectionTitle = 'Income';

            const targetSection = sections.find(s => s.title === targetSectionTitle);
            if (targetSection) {
                if (!targetSection.items.some((item: { label: string; }) => item.label === entry.account)) {
                    targetSection.items.push({ type: 'row', label: entry.account, debit: entry.debit, credit: entry.credit, isCustom: true });
                    targetSection.totalDebit += entry.debit;
                    targetSection.totalCredit += entry.credit;
                }
            }
        }
    });

    const grandTotal = sections.reduce((acc, curr) => ({ debit: acc.debit + curr.totalDebit, credit: acc.credit + curr.totalCredit }), { debit: 0, credit: 0 });
    const roundedGrandTotal = {
        debit: roundAmount(grandTotal.debit),
        credit: roundAmount(grandTotal.credit),
    };
    const variance = roundedGrandTotal.debit - roundedGrandTotal.credit;

    return (
        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="p-6 bg-gray-950 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Opening Balances</h3>
                <div className="flex items-center gap-3">
                    <input type="file" ref={obFileInputRef} className="hidden" onChange={(e) => {
                        if (e.target.files) setOpeningBalanceFiles(Array.from(e.target.files));
                    }} accept="image/*,.pdf" multiple />
                    <button onClick={() => obFileInputRef.current?.click()} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
                        <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Upload
                    </button>
                    <button onClick={() => {
                        setNewGlobalAccountName('');
                        setShowGlobalAddAccountModal(true);
                    }} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md">
                        <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                    </button>
                </div>
            </div>

            {isExtractingOpeningBalances && <div className="p-10 border-b border-gray-800 bg-black/40"><LoadingIndicator progress={60} statusText="Gemini AI is reading your documents..." /></div>}

            {openingBalanceFiles.length > 0 && (
                <div className="p-4 bg-gray-800/30 flex flex-wrap gap-2 border-b border-gray-700/50">
                    {openingBalanceFiles.map((f: any, i: number) => (
                        <span key={i} className="text-xs bg-gray-800 border border-gray-700 px-2 py-1 rounded text-gray-300">{f.name}</span>
                    ))}
                </div>
            )}

            <div className="divide-y divide-gray-800">
                {sections.map(sec => (
                    <div key={sec.title}>
                        <button onClick={() => setOpenObSection(openObSection === sec.title ? null : sec.title)} className={`w-full flex items-center justify-between p-4 transition-colors ${openObSection === sec.title ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}>
                            <div className="flex items-center space-x-3">{React.createElement(sec.icon, { className: "w-5 h-5 text-gray-400" })}<span className="font-bold text-white uppercase tracking-wide">{sec.title}</span></div>
                            <div className="flex items-center gap-10">
                                <div className="text-right hidden sm:block">
                                    <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Debit</span>
                                    <span className="font-mono text-white font-semibold">{formatWholeNumber(sec.totalDebit)}</span>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Credit</span>
                                    <span className="font-mono text-white font-semibold">{formatWholeNumber(sec.totalCredit)}</span>
                                </div>
                                {openObSection === sec.title ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                            </div>
                        </button>
                        {openObSection === sec.title && (
                            <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                <table className="w-full text-sm text-left border-collapse">
                                    <thead><tr className="bg-gray-800/30 text-gray-500 text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-gray-700/50">Account Name</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Debit</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Credit</th></tr></thead>
                                    <tbody>
                                        {sec.items.map((item: any, idx: number) => {
                                            if (item.type === 'subheader') {
                                                return (
                                                    <tr key={idx} className="bg-gray-900/50">
                                                        <td colSpan={3} className={`px-2 py-2 font-bold text-xs text-gray-400 border-b border-gray-800/50 pt-4 pb-1`}>{item.label}</td>
                                                    </tr>
                                                );
                                            } else {
                                                return (
                                                    <tr key={idx} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0">
                                                        <td className="py-2 px-4 text-gray-300 font-medium">
                                                            <div className="flex items-center justify-between group">
                                                                <span>{item.label}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-1 px-2 text-right">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                value={item.debit === 0 ? '' : Math.round(item.debit)}
                                                                onChange={e => handleObCellChange(item.label, 'debit', e.target.value)}
                                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs"
                                                            />
                                                        </td>
                                                        <td className="py-1 px-2 text-right">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                value={item.credit === 0 ? '' : Math.round(item.credit)}
                                                                onChange={e => handleObCellChange(item.label, 'credit', e.target.value)}
                                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs"
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="p-6 bg-black border-t border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex gap-12">
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Debit</p><p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(roundedGrandTotal.debit)}</p></div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Credit</p><p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(roundedGrandTotal.credit)}</p></div>
                    </div>
                    <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(variance) < 1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                        {Math.abs(variance) < 1 ? 'Balanced' : `Variance: ${formatWholeNumber(variance)}`}
                    </div>
                </div>
                <div className="flex justify-between mt-8 border-t border-gray-800 pt-6">
                    <button onClick={handleBack} className="px-4 py-2 bg-transparent text-gray-400 hover:text-white font-medium transition-colors">Back</button>
                    <div className="flex gap-4">
                        <button onClick={handleExportStepOpeningBalances} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
                            <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export Excel
                        </button>
                        <button onClick={handleOpeningBalancesComplete} disabled={Math.abs(variance) >= 1} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
