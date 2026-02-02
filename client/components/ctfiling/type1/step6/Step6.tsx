import React from 'react';
import { useOutletContext } from 'react-router-dom';
import {
    PlusIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ListBulletIcon,
    DocumentArrowDownIcon,
    ChevronLeftIcon,
    AssetIcon,
    ScaleIcon,
    IncomeIcon,
    ExpenseIcon,
    EquityIcon,
    BriefcaseIcon
} from '../../../icons';
import { TbInput, formatWholeNumber } from '../../../CtType1Results';
import { CtType1Context, CT_TYPE1_TB_STRUCTURE, CT_TYPE1_ACCOUNT_MAPPING } from '../types';
import { CHART_OF_ACCOUNTS } from '../../../../services/geminiService';

export const Step6: React.FC = () => {
    const {
        company,
        adjustedTrialBalance,
        isGeneratingTrialBalance,
        setShowGlobalAddAccountModal,
        openTbSection,
        setOpenTbSection,
        handleOpenWorkingNote,
        handleCellChange,
        handleExportStep4,
        handleContinueToProfitAndLoss,
        handleBack,
        reportsError,
        currency,
        customRows,
        breakdowns
    } = useOutletContext<CtType1Context>();

    const getIconForSection = (label: string) => {
        if (label.includes('Assets')) return AssetIcon;
        if (label.includes('Liabilities')) return ScaleIcon;
        if (label.includes('Incomes') || label.includes('Income')) return IncomeIcon;
        if (label.includes('Expenses')) return ExpenseIcon;
        if (label.includes('Equity')) return EquityIcon;
        return BriefcaseIcon;
    };

    const buckets: Record<string, { debit: number, credit: number, isCustom?: boolean }> = {};

    CT_TYPE1_TB_STRUCTURE.forEach(item => {
        if (item.type === 'row' || item.type === 'subrow') {
            buckets[item.label] = { debit: 0, credit: 0 };
        }
    });

    const normalize = (s: string) => s.replace(/['’]/g, "'").trim().toLowerCase();
    const bucketKeys = Object.keys(buckets);
    const normalizedBucketMap: Record<string, string> = {};
    bucketKeys.forEach(k => { normalizedBucketMap[normalize(k)] = k; });

    const normalizedMapping: Record<string, string> = {};
    Object.entries(CT_TYPE1_ACCOUNT_MAPPING).forEach(([k, v]) => {
        normalizedMapping[normalize(k)] = v;
    });

    if (adjustedTrialBalance) {
        adjustedTrialBalance.forEach(entry => {
            if (entry.account.toLowerCase() === 'totals') return;

            const normAccount = normalize(entry.account);
            const exactMatch = normalizedBucketMap[normAccount];

            if (exactMatch) {
                buckets[exactMatch].debit += entry.debit;
                buckets[exactMatch].credit += entry.credit;
            }
            else {
                const mappedAccount = normalizedMapping[normAccount];
                const mappedMatch = mappedAccount ? normalizedBucketMap[normalize(mappedAccount)] : null;

                if (mappedMatch) {
                    buckets[mappedMatch].debit += entry.debit;
                    buckets[mappedMatch].credit += entry.credit;
                }
                else {
                    buckets[entry.account] = { debit: entry.debit, credit: entry.credit, isCustom: true };
                }
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

    CT_TYPE1_TB_STRUCTURE.forEach(item => {
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
                const hasBreakdown = !!breakdowns[item.label];
                currentSection.items.push({ ...item, ...vals, hasBreakdown });
                currentSection.totalDebit += vals.debit;
                currentSection.totalCredit += vals.credit;
            }
        }
    });
    if (currentSection) sections.push(currentSection);

    Object.entries(buckets).forEach(([accountName, values]) => {
        if (!values.isCustom) return;
        let targetSection = 'Expenses';
        for (const [mainCat, details] of Object.entries(CHART_OF_ACCOUNTS)) {
            if (Array.isArray(details)) {
                if (normalize(details as unknown as string).includes(normalize(accountName))) { targetSection = mainCat; break; }
            } else {
                for (const [subGroup, accounts] of Object.entries(details as any)) {
                    if ((accounts as string[]).some(a => normalize(a) === normalize(accountName))) { targetSection = mainCat; break; }
                }
            }
        }
        if (targetSection === 'Revenues') targetSection = 'Income';

        // Check custom rows mapping to ensure correct section
        const customMap = customRows.find(r => r.label === accountName);
        if (customMap) {
            targetSection = customMap.parent;
        }

        const section = sections.find(s => s.title === targetSection);
        if (section) {
            const hasBreakdown = !!breakdowns[accountName];
            const newItem = { type: 'row', label: accountName, ...values, isCustom: true, hasBreakdown };

            // Try to insert under the correct sub-header if specified
            let inserted = false;
            if (customMap?.subParent) {
                // Find the index of the subheader
                const subIdx = section.items.findIndex(i => i.type === 'subheader' && i.label === customMap.subParent);
                if (subIdx !== -1) {
                    // Find the insertion point: after the subheader and its existing children
                    let insertIdx = subIdx + 1;
                    while (insertIdx < section.items.length) {
                        const nextItem = section.items[insertIdx];
                        if (nextItem.type === 'subheader' || nextItem.type === 'header') break;
                        insertIdx++;
                    }
                    section.items.splice(insertIdx, 0, newItem);
                    inserted = true;
                }
            }

            if (!inserted) {
                section.items.push(newItem);
            }

            section.totalDebit += values.debit;
            section.totalCredit += values.credit;
        }
    });

    const grandTotal = sections.reduce((acc, curr) => ({ debit: acc.debit + curr.totalDebit, credit: acc.credit + curr.totalCredit }), { debit: 0, credit: 0 });

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm">
                <div className="p-6 border-b border-gray-700 flex justify-between items-center bg-gray-950 rounded-t-xl">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-blue-400 uppercase tracking-wider">Adjust Trial Balance</h3>
                        <div className="text-sm text-gray-400 mt-1 flex gap-4">
                            <span><span className="font-semibold text-gray-500">CLIENT:</span> {company?.name}</span>
                            {company?.ctPeriodStart && <span><span className="font-semibold text-gray-500">PERIOD:</span> {company.ctPeriodStart} - {company.ctPeriodEnd}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {isGeneratingTrialBalance && <span className="text-blue-400 text-sm animate-pulse">Recalculating...</span>}
                        <button
                            onClick={() => setShowGlobalAddAccountModal(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm shadow-md"
                        >
                            <PlusIcon className="w-5 h-5 mr-1.5" /> Add Account
                        </button>
                    </div>
                </div>

                <div className="space-y-px">
                    {sections.map(section => (
                        <div key={section.title} className="border-t border-gray-800 last:border-b-0">
                            <button
                                onClick={() => setOpenTbSection(openTbSection === section.title ? null : section.title)}
                                className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === section.title ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}
                            >
                                <div className="flex items-center space-x-3">
                                    <section.icon className="w-5 h-5 text-gray-400" />
                                    <span className="font-bold text-white uppercase tracking-wide">{section.title}</span>
                                </div>
                                <div className="flex items-center gap-10">
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Debit</span>
                                        <span className="font-mono text-white font-semibold">{formatWholeNumber(section.totalDebit)}</span>
                                    </div>
                                    <div className="text-right hidden sm:block">
                                        <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Credit</span>
                                        <span className="font-mono text-white font-semibold">{formatWholeNumber(section.totalCredit)}</span>
                                    </div>
                                    {openTbSection === section.title ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                                </div>
                            </button>

                            {openTbSection === section.title && (
                                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="text-[10px] uppercase bg-gray-800/30 text-gray-500 tracking-widest font-bold">
                                                <tr>
                                                    <th className="px-4 py-2 border-b border-gray-700/50 w-1/2">Account Name</th>
                                                    <th className="px-4 py-2 text-right border-b border-gray-700/50 w-1/4">Debit ({currency})</th>
                                                    <th className="px-4 py-2 text-right border-b border-gray-700/50 w-1/4">Credit ({currency})</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800/50">
                                                {section.items.map((item, idx) => (
                                                    item.type === 'subheader' ? (
                                                        <tr key={`sh-${idx}`} className="bg-gray-900/40">
                                                            <td colSpan={3} className="px-4 py-1.5 text-[9px] font-black text-blue-500/70 border-l-2 border-blue-600/30 uppercase tracking-[0.2em]">
                                                                {item.label}
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        <tr key={item.label} className="hover:bg-white/5 transition-colors group">
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex flex-col">
                                                                        <span className={`font-medium ${item.isCustom ? 'text-blue-300' : 'text-gray-200'}`}>{item.label}</span>
                                                                        {item.isCustom && <span className="text-[10px] text-blue-500 uppercase font-bold tracking-tighter">Manual/Custom Row</span>}
                                                                        {item.hasBreakdown && (
                                                                            <span className="text-[10px] text-green-500 flex items-center mt-1">
                                                                                <ListBulletIcon className="w-3 h-3 mr-1" /> Working Note Attached
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <button
                                                                        onClick={() => handleOpenWorkingNote(item.label)}
                                                                        className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${item.hasBreakdown ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white hover:bg-gray-600'}`}
                                                                        title="Add/Edit Working Note"
                                                                    >
                                                                        <ListBulletIcon className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono">
                                                                <TbInput
                                                                    label={item.label}
                                                                    field="debit"
                                                                    value={item.debit}
                                                                    hasBreakdown={item.hasBreakdown}
                                                                    onChange={handleCellChange}
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2.5 text-right font-mono text-white">
                                                                <TbInput
                                                                    label={item.label}
                                                                    field="credit"
                                                                    value={item.credit}
                                                                    hasBreakdown={item.hasBreakdown}
                                                                    onChange={handleCellChange}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-6 bg-black rounded-b-xl border-t border-gray-700">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Trial Balance Status</h4>
                            <div className="flex items-center gap-3">
                                <div className={`h-2.5 w-2.5 rounded-full ${Math.abs(grandTotal.debit - grandTotal.credit) < 0.01 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500 animate-pulse'}`} />
                                <span className="text-white font-bold tracking-tight">
                                    {Math.abs(grandTotal.debit - grandTotal.credit) < 0.01 ? 'Balanced' : 'Unbalanced'}
                                </span>
                                {Math.abs(grandTotal.debit - grandTotal.credit) >= 0.01 && (
                                    <span className="text-red-400 text-xs font-mono ml-2">
                                        (Diff: {formatWholeNumber(Math.abs(grandTotal.debit - grandTotal.credit))})
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-12">
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Debits</p>
                                <p className="text-2xl font-black text-white font-mono">{currency} {formatWholeNumber(grandTotal.debit)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Credits</p>
                                <p className="text-2xl font-black text-white font-mono">{currency} {formatWholeNumber(grandTotal.credit)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-800">
                        <button onClick={handleBack} className="flex items-center px-6 py-3 bg-transparent text-gray-500 hover:text-white font-bold transition-all group">
                            <ChevronLeftIcon className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" /> Back
                        </button>
                        <div className="flex items-center gap-4">
                            <button onClick={handleExportStep4} className="flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-xl transition-all shadow-lg border border-gray-700">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2" /> Export TB
                            </button>
                            <button
                                onClick={handleContinueToProfitAndLoss}
                                disabled={Math.abs(grandTotal.debit - grandTotal.credit) >= 0.01}
                                className="flex items-center px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 disabled:grayscale transform hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Continue to P&L
                                <ChevronRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {reportsError && (
                <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm flex items-center">
                    <span className="mr-2">⚠️</span>
                    {reportsError}
                </div>
            )}
        </div>
    );
};
