import React, { useState, useMemo, useRef } from 'react';
import {
    ChevronDownIcon,
    ChevronRightIcon,
    PlusIcon,
    AssetIcon,
    ScaleIcon,
    EquityIcon,
    IncomeIcon,
    ExpenseIcon,
    DocumentArrowDownIcon,
    XMarkIcon,
    SparklesIcon,
    UploadIcon,
    CalendarDaysIcon,
    DocumentTextIcon,
    TrashIcon,
    ChevronLeftIcon
} from './icons';
import type { OpeningBalanceCategory, OpeningBalanceAccount } from '../types';
import { CHART_OF_ACCOUNTS } from '../services/geminiService';

interface OpeningBalancesType1Props {
    onComplete: () => void;
    onBack: () => void;
    currency: string;
    accountsData: OpeningBalanceCategory[];
    onAccountsDataChange: (data: OpeningBalanceCategory[]) => void;
    onExport?: () => void;
    selectedFiles: File[];
    onFilesSelect: (files: File[]) => void;
    onExtract: () => void;
    isExtracting: boolean;

    companyName?: string;
    periodStart?: string;
    periodEnd?: string;
}

const formatDecimalNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(num);
};

const formatWholeNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(num);
};

export const OpeningBalancesType1: React.FC<OpeningBalancesType1Props> = ({
    onComplete,
    onBack,
    currency,
    accountsData,
    onAccountsDataChange,
    onExport,
    selectedFiles,
    onFilesSelect,
    onExtract,
    isExtracting,
    companyName,
    periodStart,
    periodEnd
}) => {
    const [openSection, setOpenSection] = useState<string | null>('Assets');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [migrationDate, setMigrationDate] = useState('2024-01-01');

    // Add Account State
    const [newAccountMain, setNewAccountMain] = useState<string>('Assets');
    const [newAccountSub, setNewAccountSub] = useState<string>('');
    const [newAccountName, setNewAccountName] = useState<string>('');


    const fileInputRef = useRef<HTMLInputElement>(null);

    const { totalDebit, totalCredit, difference, isBalanced } = useMemo(() => {
        let debit = 0;
        let credit = 0;
        accountsData.forEach(cat => {
            cat.accounts.forEach(acc => {
                debit += acc.debit;
                credit += acc.credit;
            });
        });
        const diff = debit - credit;
        return {
            totalDebit: debit,
            totalCredit: credit,
            difference: diff,
            isBalanced: Math.abs(diff) < 0.01
        };
    }, [accountsData]);

    const handleAccountChange = (categoryName: string, accountIndex: number, field: 'debit' | 'credit' | 'name', value: string | number) => {
        const newData = accountsData.map(cat => {
            if (cat.category === categoryName) {
                const updatedAccounts = [...cat.accounts];
                const numValue = typeof value === 'string' && field !== 'name' ? parseFloat(value) || 0 : value;
                updatedAccounts[accountIndex] = { ...updatedAccounts[accountIndex], [field]: field === 'name' ? value : numValue };
                return { ...cat, accounts: updatedAccounts };
            }
            return cat;
        });
        onAccountsDataChange(newData);
    };

    const handleDeleteAccount = (categoryName: string, accountIndex: number) => {
        if (!confirm('Are you sure you want to delete this account?')) return;
        const newData = accountsData.map(cat => {
            if (cat.category === categoryName) {
                const updatedAccounts = [...cat.accounts];
                updatedAccounts.splice(accountIndex, 1);
                return { ...cat, accounts: updatedAccounts };
            }
            return cat;
        });
        onAccountsDataChange(newData);
    };

    const handleAddAccount = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAccountName.trim()) return;

        const newData = accountsData.map(cat => {
            if (cat.category === newAccountMain) {
                const newAccount: OpeningBalanceAccount = {
                    name: newAccountName.trim(),
                    debit: 0,
                    credit: 0,
                    isNew: true,
                    subCategory: newAccountSub || (cat.category === 'Equity' ? undefined : 'Other')
                };
                return { ...cat, accounts: [...cat.accounts, newAccount] };
            }
            return cat;
        });

        onAccountsDataChange(newData);
        setOpenSection(newAccountMain);
        setIsAddModalOpen(false);
        setNewAccountName('');
        setNewAccountSub('');
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            onFilesSelect([...selectedFiles, ...newFiles]);
        }
    };

    const handleRemoveFile = (index: number) => {
        const newFiles = [...selectedFiles];
        newFiles.splice(index, 1);
        onFilesSelect(newFiles);
    };



    const subCategoryOptions = useMemo(() => {
        if (newAccountMain === 'Equity') return [];
        const section = CHART_OF_ACCOUNTS[newAccountMain as keyof typeof CHART_OF_ACCOUNTS];
        if (typeof section === 'object' && !Array.isArray(section)) {
            return Object.keys(section);
        }
        return [];
    }, [newAccountMain]);

    return (
        <div className="space-y-6">
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-950 rounded-t-xl gap-4">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-blue-400 uppercase tracking-wider">Opening Balances</h3>
                        <div className="text-sm text-gray-400 mt-1 flex gap-4">
                            {companyName && <span><span className="font-semibold text-gray-500">CLIENT:</span> {companyName}</span>}
                            {periodStart && <span><span className="font-semibold text-gray-500">PERIOD:</span> {periodStart} - {periodEnd}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            multiple
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx"
                        />
                        <button onClick={handleUploadClick} disabled={isExtracting} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md disabled:opacity-50">
                            {isExtracting ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Extracting...</> : <><UploadIcon className="w-5 h-5 mr-1.5" /> Upload</>}
                        </button>
                        {selectedFiles.length > 0 && !isExtracting && (
                            <button onClick={onExtract} className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-sm shadow-md transition-all">
                                <SparklesIcon className="w-5 h-5 mr-1.5" /> Extract
                            </button>
                        )}
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm shadow-md"
                        >
                            <PlusIcon className="w-5 h-5 mr-1.5" /> Add Account
                        </button>
                    </div>
                </div>

                {/* File List */}
                {selectedFiles.length > 0 && (
                    <div className="px-6 py-3 bg-gray-900/50 border-b border-gray-800">
                        <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 animate-fadeIn group hover:border-gray-600 transition-colors">
                                    <DocumentTextIcon className="w-4 h-4 text-purple-400 mr-2" />
                                    <span className="text-xs text-gray-300 mr-2 max-w-[150px] truncate font-medium">{file.name}</span>
                                    <button onClick={() => handleRemoveFile(index)} className="text-gray-500 hover:text-red-400"><XMarkIcon className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}


                {/* Sections */}
                <div className="space-y-px">
                    {accountsData.map(section => {
                        const sectionDebit = section.accounts.reduce((sum, acc) => sum + acc.debit, 0);
                        const sectionCredit = section.accounts.reduce((sum, acc) => sum + acc.credit, 0);

                        return (
                            <div key={section.category} className="border-t border-gray-800 last:border-b-0">
                                <button
                                    onClick={() => setOpenSection(openSection === section.category ? null : section.category)}
                                    className={`w-full flex items-center justify-between p-4 transition-colors ${openSection === section.category ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <section.icon className="w-5 h-5 text-gray-400" />
                                        <span className="font-bold text-white uppercase tracking-wide">{section.category}</span>
                                        <span className="text-[10px] bg-gray-800 text-gray-500 font-mono px-2 py-0.5 rounded-full border border-gray-700">{section.accounts.length}</span>
                                    </div>
                                    <div className="flex items-center gap-10">
                                        <div className="text-right hidden sm:block">
                                            <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Debit</span>
                                            <span className="font-mono text-white font-semibold">{formatWholeNumber(sectionDebit)}</span>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <span className="text-[10px] text-gray-500 uppercase mr-3 tracking-tighter">Credit</span>
                                            <span className="font-mono text-white font-semibold">{formatWholeNumber(sectionCredit)}</span>
                                        </div>
                                        {openSection === section.category ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                                    </div>
                                </button>

                                {openSection === section.category && (
                                    <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left border-collapse">
                                                <thead className="text-[10px] uppercase bg-gray-800/30 text-gray-500 tracking-widest font-bold">
                                                    <tr>
                                                        <th className="px-4 py-2 border-b border-gray-700/50 w-1/2">Account Name</th>
                                                        <th className="px-4 py-2 text-right border-b border-gray-700/50 w-1/4">Debit ({currency})</th>
                                                        <th className="px-4 py-2 text-right border-b border-gray-700/50 w-1/4">Credit ({currency})</th>
                                                        <th className="px-2 py-2 border-b border-gray-700/50 w-8"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        const grouped = section.accounts.reduce((groups, acc, idx) => {
                                                            const sub = acc.subCategory || 'Other';
                                                            if (!groups[sub]) groups[sub] = [];
                                                            groups[sub].push({ account: acc, index: idx });
                                                            return groups;
                                                        }, {} as Record<string, { account: OpeningBalanceAccount; index: number }[]>);

                                                        if (section.accounts.length === 0) {
                                                            return (
                                                                <tr>
                                                                    <td colSpan={4} className="py-4 text-center text-gray-600 text-xs italic">
                                                                        No accounts yet. Click "Add Account" to start.
                                                                    </td>
                                                                </tr>
                                                            );
                                                        }

                                                        return (Object.entries(grouped) as [string, { account: OpeningBalanceAccount; index: number }[]][]).map(([subCat, items]) => (
                                                            <React.Fragment key={subCat}>
                                                                {section.category !== 'Equity' && subCat !== 'Other' && (
                                                                    <tr className="bg-white/5">
                                                                        <td colSpan={4} className="px-4 py-1.5 font-bold text-[10px] text-blue-300 border-b border-gray-800/50 uppercase tracking-wider pl-4">
                                                                            {subCat}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                                {items.map(({ account: acc, index: idx }) => (
                                                                    <tr key={idx} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0 group">
                                                                        <td className="py-2 px-4 text-gray-300 font-medium pl-8">
                                                                            <input
                                                                                type="text"
                                                                                value={acc.name}
                                                                                onChange={(e) => handleAccountChange(section.category, idx, 'name', e.target.value)}
                                                                                className="bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-full hover:bg-gray-800/50 transition-colors"
                                                                            />
                                                                        </td>
                                                                        <td className="py-1 px-2 text-right">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={acc.debit !== 0 ? acc.debit : ''}
                                                                                onChange={(e) => handleAccountChange(section.category, idx, 'debit', e.target.value)}
                                                                                className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700 hover:border-gray-500`}
                                                                                placeholder="0.00"
                                                                            />
                                                                        </td>
                                                                        <td className="py-1 px-2 text-right">
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                value={acc.credit !== 0 ? acc.credit : ''}
                                                                                onChange={(e) => handleAccountChange(section.category, idx, 'credit', e.target.value)}
                                                                                className={`w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-700 hover:border-gray-500`}
                                                                                placeholder="0.00"
                                                                            />
                                                                        </td>
                                                                        <td className="py-1 px-2 text-center">
                                                                            <button
                                                                                onClick={() => handleDeleteAccount(section.category, idx)}
                                                                                className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                                                                            >
                                                                                <TrashIcon className="w-4 h-4" />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </React.Fragment>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Totals */}
                <div className="p-6 bg-gray-950/80 border-t border-gray-800 shadow-inner">
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6">
                        <div className="flex items-center space-x-12">
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Grand Total Debit</p>
                                <p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(totalDebit)} <span className="text-xs text-gray-500 font-normal">{currency}</span></p>
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">Grand Total Credit</p>
                                <p className="font-mono font-bold text-2xl text-white">{formatWholeNumber(totalCredit)} <span className="text-xs text-gray-500 font-normal">{currency}</span></p>
                            </div>
                            <div className="text-left px-6 py-2 bg-gray-900 rounded-xl border border-gray-800">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1 text-center">Unbalanced Variance</p>
                                <p className={`font-mono font-bold text-xl text-center ${isBalanced ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>
                                    {formatWholeNumber(difference)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-6 border-t border-gray-800/50">
                        <button onClick={onBack} className="flex items-center px-4 py-2 text-gray-400 hover:text-white font-bold transition-colors">
                            <ChevronLeftIcon className="w-5 h-5 mr-1" /> Back
                        </button>
                        <div className="flex gap-4">
                            {onExport && (
                                <button
                                    onClick={onExport}
                                    className="px-5 py-2.5 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-all border border-gray-700 shadow-md flex items-center"
                                >
                                    <DocumentArrowDownIcon className="w-5 h-5 mr-2 text-gray-400" />
                                    Export Excel
                                </button>
                            )}
                            <button
                                onClick={onComplete}
                                disabled={!isBalanced && totalDebit > 0}
                                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl shadow-blue-900/30 flex items-center disabled:opacity-50 disabled:grayscale transition-all transform hover:scale-[1.02]"
                            >
                                Continue
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Account Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleAddAccount}>
                                <div className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Main Category</label>
                                        <select
                                            value={newAccountMain}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewAccountMain(val);
                                                setNewAccountSub('');
                                            }}
                                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                            required
                                        >
                                            <option value="Assets">Assets</option>
                                            <option value="Liabilities">Liabilities</option>
                                            <option value="Equity">Equity</option>
                                            <option value="Income">Income</option>
                                            <option value="Expenses">Expenses</option>
                                        </select>
                                    </div>

                                    {subCategoryOptions.length > 0 && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Child Category</label>
                                            <select
                                                value={newAccountSub}
                                                onChange={(e) => setNewAccountSub(e.target.value)}
                                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                                required
                                            >
                                                <option value="" disabled>Select Child Category...</option>
                                                {subCategoryOptions.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Account Name</label>
                                        <input
                                            type="text"
                                            value={newAccountName}
                                            onChange={(e) => setNewAccountName(e.target.value)}
                                            className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="e.g. Savings Account - HSBC"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-800/50 border-t border-gray-800 flex justify-end space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsAddModalOpen(false)}
                                        className="px-5 py-2 text-sm text-gray-400 hover:text-white font-bold transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl shadow-lg transition-all"
                                    >
                                        Add Account
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Note Modal */}
            {/* Note Modal - Removed */}
        </div>
    );
};
