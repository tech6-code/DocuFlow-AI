import React, { useState, useMemo } from 'react';
import type { OpeningBalanceCategory, OpeningBalanceAccount } from '../types';
import { CHART_OF_ACCOUNTS } from '../services/geminiService';
import {
    CalendarDaysIcon,
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
    DocumentTextIcon,
    TrashIcon,
    ClipboardCheckIcon
} from './icons';
import type { WorkingNoteEntry } from '../types';


// Helper to extract account names from the structured CoA while preserving sub-categories
const getAccountsFromCoA = (sectionKey: 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses'): OpeningBalanceAccount[] => {
    // User requested all dropdowns (accordions) to be empty initially
    return [];
};

// New Helper for Type 1 to populate accounts
const getAccountsFromCoAType1 = (sectionKey: 'Assets' | 'Liabilities' | 'Equity' | 'Income' | 'Expenses'): OpeningBalanceAccount[] => {
    const section = CHART_OF_ACCOUNTS[sectionKey];
    const accounts: OpeningBalanceAccount[] = [];

    if (Array.isArray(section)) {
        section.forEach(acc => {
            accounts.push({ name: acc, debit: 0, credit: 0, subCategory: undefined });
        });
    } else {
        Object.entries(section).forEach(([subCat, accs]) => {
            (accs as string[]).forEach(acc => {
                // Determine subCategory based on key (basic mapping for display)
                // For nested structure like Assets -> CurrentAssets, subCategory is CurrentAssets
                accounts.push({ name: acc, debit: 0, credit: 0, subCategory: subCat });
            });
        });
    }
    return accounts;
};

export const initialAccountData: OpeningBalanceCategory[] = [
    { category: 'Assets', icon: AssetIcon, accounts: getAccountsFromCoA('Assets') },
    { category: 'Liabilities', icon: ScaleIcon, accounts: getAccountsFromCoA('Liabilities') },
    { category: 'Equity', icon: EquityIcon, accounts: getAccountsFromCoA('Equity') },
    { category: 'Income', icon: IncomeIcon, accounts: getAccountsFromCoA('Income') },
    { category: 'Expenses', icon: ExpenseIcon, accounts: getAccountsFromCoA('Expenses') },
];

export const initialAccountDataType1: OpeningBalanceCategory[] = [
    { category: 'Assets', icon: AssetIcon, accounts: getAccountsFromCoAType1('Assets') },
    { category: 'Liabilities', icon: ScaleIcon, accounts: getAccountsFromCoAType1('Liabilities') },
    { category: 'Equity', icon: EquityIcon, accounts: getAccountsFromCoAType1('Equity') },
    { category: 'Income', icon: IncomeIcon, accounts: getAccountsFromCoAType1('Income') },
    { category: 'Expenses', icon: ExpenseIcon, accounts: getAccountsFromCoAType1('Expenses') },
];

const formatCurrencyForDisplay = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

const formatNumberInput = (amount?: number) => {
    if (amount === undefined || amount === null) return '';
    return String(Math.round(amount));
};

interface AccountCategoryDetailProps {
    category: OpeningBalanceCategory;
    onAccountChange: (categoryName: string, accountIndex: number, field: 'debit' | 'credit' | 'name', value: string | number) => void;
    onDeleteAccount: (categoryName: string, accountIndex: number) => void;
    currency: string;
    workingNotes?: Record<string, WorkingNoteEntry[]>;
    onOpenNotes: (accountName: string) => void;
}

const AccountCategoryDetail: React.FC<AccountCategoryDetailProps> = ({ category, onAccountChange, onDeleteAccount, currency, workingNotes, onOpenNotes }) => {
    // Group accounts by sub-category
    const grouped = useMemo(() => {
        const groups: Record<string, { account: OpeningBalanceAccount; index: number }[]> = {};
        category.accounts.forEach((acc, index) => {
            const sub = acc.subCategory || 'Other';
            if (!groups[sub]) groups[sub] = [];
            groups[sub].push({ account: acc, index });
        });
        return groups;
    }, [category.accounts]);

    return (
        <div className="bg-black/40 p-4 border-t border-gray-800/50">
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-gray-900 text-gray-400 text-[10px] uppercase tracking-widest font-semibold border-y border-gray-800">
                            <th className="px-4 py-3 text-left">Account Name</th>
                            <th className="px-4 py-3 text-center w-16">Notes</th>
                            <th className="px-4 py-3 text-right">Debit</th>
                            <th className="px-4 py-3 text-right">Credit</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Fix: Explicitly type the result of Object.entries to avoid 'unknown' type errors during mapping on line 103 */}
                        {(Object.entries(grouped) as [string, { account: OpeningBalanceAccount; index: number }[]][]).map(([subCat, items]) => (
                            <React.Fragment key={subCat}>
                                {category.category !== 'Equity' && (
                                    <tr className="bg-gray-800/10">
                                        <td colSpan={4} className={`px-4 py-2 font-bold text-xs text-gray-500 border-b border-gray-800/50 italic`}>
                                            {subCat}
                                        </td>
                                    </tr>
                                )}
                                {items.map(({ account: acc, index }) => (
                                    <tr key={index} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0 group">
                                        <td className="py-2 px-4 text-gray-300 font-medium">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={acc.name}
                                                    onChange={(e) => onAccountChange(category.category, index, 'name', e.target.value)}
                                                    className="bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-full hover:bg-gray-800/50 transition-colors"
                                                />
                                                <button
                                                    onClick={() => onDeleteAccount(category.category, index)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                                                    title="Delete Account"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            <button
                                                onClick={() => onOpenNotes(acc.name)}
                                                className={`p-1.5 rounded-lg transition-all ${workingNotes && workingNotes[acc.name]?.length > 0 ? 'bg-blue-600/20 text-blue-400' : 'text-gray-600 hover:text-blue-400 hover:bg-gray-800'}`}
                                                title="Add Working Notes"
                                            >
                                                {workingNotes && workingNotes[acc.name]?.length > 0 ? <ClipboardCheckIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
                                            </button>
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                            <input
                                                type="number"
                                                step="1"
                                                value={formatNumberInput(acc.debit)}
                                                onChange={(e) => onAccountChange(category.category, index, 'debit', Math.round(parseFloat(e.target.value) || 0))}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="py-1 px-2 text-right">
                                            <input
                                                type="number"
                                                step="1"
                                                value={formatNumberInput(acc.credit)}
                                                onChange={(e) => onAccountChange(category.category, index, 'credit', Math.round(parseFloat(e.target.value) || 0))}
                                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


interface OpeningBalancesProps {
    onComplete: () => void;
    currency: string;
    accountsData: OpeningBalanceCategory[];
    onAccountsDataChange: (data: OpeningBalanceCategory[]) => void;
    onExport?: () => void;
    selectedFiles: File[];
    onFilesSelect: (files: File[]) => void;
    onExtract: () => void;
    isExtracting: boolean;
    workingNotes?: Record<string, WorkingNoteEntry[]>;
    onUpdateWorkingNotes?: (accountName: string, notes: WorkingNoteEntry[]) => void;
}

export const OpeningBalances: React.FC<OpeningBalancesProps> = ({
    onComplete,
    currency,
    accountsData,
    onAccountsDataChange,
    onExport,
    selectedFiles,
    onFilesSelect,
    onExtract,
    isExtracting,
    workingNotes,
    onUpdateWorkingNotes
}) => {
    const [migrationDate, setMigrationDate] = useState('2024-01-01');
    const [openCategory, setOpenCategory] = useState<string | null>('Assets');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Note Modal State
    const [noteModalOpen, setNoteModalOpen] = useState(false);
    const [currentNoteAccount, setCurrentNoteAccount] = useState<string | null>(null);
    const [currentNoteText, setCurrentNoteText] = useState('');

    const [newAccountMain, setNewAccountMain] = useState<string>('Assets');
    const [newAccountSub, setNewAccountSub] = useState<string>('');
    const [newAccountName, setNewAccountName] = useState<string>('');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

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

    const toggleCategory = (categoryName: string) => {
        setOpenCategory(prev => (prev === categoryName ? null : categoryName));
    };

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

    const handleOpenNotes = (accountName: string) => {
        setCurrentNoteAccount(accountName);
        const existingNotes = workingNotes?.[accountName] || [];
        setCurrentNoteText(existingNotes.map(n => n.description).join('\n'));
        setNoteModalOpen(true);
    };

    const handleSaveNote = () => {
        if (currentNoteAccount && onUpdateWorkingNotes) {
            const notes = currentNoteText.split('\n').filter(t => t.trim()).map(t => ({
                id: Date.now().toString() + Math.random(),
                description: t,
                timestamp: new Date().toISOString(),
                user: 'User'
            }));
            onUpdateWorkingNotes(currentNoteAccount, notes);
        }
        setNoteModalOpen(false);
    };

    const handleGlobalAddAccount = (e: React.FormEvent) => {
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
        setOpenCategory(newAccountMain);
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
            const updatedFiles = [...selectedFiles, ...newFiles];
            onFilesSelect(updatedFiles);
        }
    };

    const handleRemoveFile = (index: number) => {
        const newFiles = [...selectedFiles];
        newFiles.splice(index, 1);
        onFilesSelect(newFiles);
    };

    const handleContinue = () => {
        if (!isBalanced) return;
        onComplete();
    };

    // Sub-category options based on selected main category
    const subCategoryOptions = useMemo(() => {
        if (newAccountMain === 'Equity') return [];
        const section = CHART_OF_ACCOUNTS[newAccountMain as keyof typeof CHART_OF_ACCOUNTS];
        if (typeof section === 'object' && !Array.isArray(section)) {
            return Object.keys(section);
        }
        return [];
    }, [newAccountMain]);

    return (
        <div className="bg-[#0B1120] rounded-3xl border border-gray-800 shadow-2xl overflow-hidden">
            {/* Header Section matching Trial Balance style */}
            <div className="p-8 border-b border-gray-800 bg-[#0F172A]/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h3 className="text-2xl font-bold text-white tracking-tight uppercase">Adjust Opening Balance</h3>
                        <p className="text-gray-400 mt-1">Review, adjust, and reconcile your opening balances before proceeding.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {onExport && (
                            <button onClick={onExport} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
                                <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export
                            </button>
                        )}
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
                        <button onClick={() => setIsAddModalOpen(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md">
                            <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-6">
                    <div className="flex items-center space-x-4 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
                        <label htmlFor="migrationDate" className="text-xs font-bold text-gray-400 flex items-center uppercase tracking-wider">
                            <CalendarDaysIcon className="w-4 h-4 mr-2 text-gray-500" />
                            Opening Balance as on
                        </label>
                        <input
                            type="date"
                            id="migrationDate"
                            value={migrationDate}
                            onChange={e => setMigrationDate(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-md text-white text-xs p-1.5 focus:ring-1 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    {selectedFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedFiles.map((file, index) => (
                                <div key={index} className="flex items-center bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 animate-fadeIn group hover:border-gray-600 transition-colors">
                                    <DocumentTextIcon className="w-4 h-4 text-purple-400 mr-2" />
                                    <span className="text-xs text-gray-300 mr-2 max-w-[150px] truncate font-medium">{file.name}</span>
                                    <button onClick={() => handleRemoveFile(index)} className="text-gray-500 hover:text-red-400"><XMarkIcon className="w-3.5 h-3.5" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="divide-y divide-gray-800">
                {accountsData.map(cat => (
                    <div key={cat.category} className="group">
                        <button
                            onClick={() => toggleCategory(cat.category)}
                            className={`w-full flex items-center justify-between p-4 transition-colors ${openCategory === cat.category ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}
                        >
                            <div className="flex items-center space-x-3">
                                <cat.icon className={`w-5 h-5 ${openCategory === cat.category ? 'text-gray-200' : 'text-gray-500'}`} />
                                <span className="font-bold text-white uppercase tracking-wide">{cat.category}</span>
                                <span className="text-[10px] bg-gray-800 text-gray-500 font-mono px-2 py-0.5 rounded-full border border-gray-700">{cat.accounts.length}</span>
                            </div>
                            {openCategory === cat.category ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                        </button>
                        {openCategory === cat.category && (
                            <AccountCategoryDetail
                                category={cat}
                                onAccountChange={handleAccountChange}
                                onDeleteAccount={handleDeleteAccount}
                                currency={currency}
                                workingNotes={workingNotes}
                                onOpenNotes={handleOpenNotes}
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="p-6 bg-black border-t border-gray-800">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex gap-12">
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Debit</p><p className="font-mono font-bold text-2xl text-white">{formatCurrencyForDisplay(totalDebit)}</p></div>
                        <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Credit</p><p className="font-mono font-bold text-2xl text-white">{formatCurrencyForDisplay(totalCredit)}</p></div>
                    </div>
                    <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(difference) < 0.1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                        {Math.abs(difference) < 0.1 ? 'Balanced' : `Variance: ${formatCurrencyForDisplay(difference)}`}
                    </div>
                </div>
                <div className="flex justify-between mt-8 border-t border-gray-800 pt-6">
                    <div className="flex-1"></div>
                    <button onClick={handleContinue} disabled={!isBalanced && totalDebit > 0} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">
                        {totalDebit > 0 ? 'Continue' : 'Continue (Skip)'}
                    </button>
                </div>
            </div>

            {/* Global Add Account Modal */}
            {
                isAddModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                            <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                                <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <form onSubmit={handleGlobalAddAccount}>
                                <div className="p-6 space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Main Category</label>
                                        <select
                                            value={newAccountMain}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setNewAccountMain(val);
                                                setNewAccountSub(''); // Reset sub on main change
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
            {noteModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950/50">
                            <h3 className="text-lg font-bold text-white uppercase tracking-wide">Working Notes: <span className="text-blue-400">{currentNoteAccount}</span></h3>
                            <button onClick={() => setNoteModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6">
                            <textarea
                                value={currentNoteText}
                                onChange={(e) => setCurrentNoteText(e.target.value)}
                                className="w-full h-40 bg-gray-800 border border-gray-700 rounded-xl p-4 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono leading-relaxed"
                                placeholder="Enter your working notes, adjustments, or comments here..."
                                autoFocus
                            />
                        </div>
                        <div className="p-4 bg-gray-950/30 border-t border-gray-800 flex justify-end gap-3">
                            <button onClick={() => setNoteModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white font-bold text-sm">Cancel</button>
                            <button onClick={handleSaveNote} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm shadow-md">Save Notes</button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};
