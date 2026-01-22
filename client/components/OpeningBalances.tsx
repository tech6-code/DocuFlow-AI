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
    DocumentArrowDownIcon,
    XMarkIcon,
    SparklesIcon,
    UploadIcon
} from './icons';


// Helper to extract account names from the structured CoA while preserving sub-categories
const getAccountsFromCoA = (sectionKey: 'Assets' | 'Liabilities' | 'Equity'): OpeningBalanceAccount[] => {
    if (!(sectionKey in CHART_OF_ACCOUNTS)) return [];

    const section = CHART_OF_ACCOUNTS[sectionKey as keyof typeof CHART_OF_ACCOUNTS];

    // If it's an array (like Equity)
    if (Array.isArray(section)) {
        return section.map(name => ({ name, debit: 0, credit: 0 }));
    }

    // If it's an object with sub-categories (like Assets/Liabilities)
    let accounts: OpeningBalanceAccount[] = [];
    if (typeof section === 'object' && section !== null) {
        Object.entries(section).forEach(([subCategory, subArr]) => {
            if (Array.isArray(subArr)) {
                accounts = [...accounts, ...subArr.map(name => ({ name, debit: 0, credit: 0, subCategory }))];
            }
        });
    }
    return accounts;
};

export const initialAccountData: OpeningBalanceCategory[] = [
    {
        category: 'Assets',
        icon: AssetIcon,
        accounts: getAccountsFromCoA('Assets'),
    },
    {
        category: 'Liabilities',
        icon: ScaleIcon,
        accounts: getAccountsFromCoA('Liabilities'),
    },
    {
        category: 'Equity',
        icon: EquityIcon,
        accounts: getAccountsFromCoA('Equity'),
    },
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
    currency: string;
}

const AccountCategoryDetail: React.FC<AccountCategoryDetailProps> = ({ category, onAccountChange, currency }) => {
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
        <div className="bg-black/30 p-4">
            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="text-left font-bold text-[10px] uppercase tracking-widest text-gray-500 pb-2 px-2 w-1/2">ACCOUNTS</th>
                            <th className="text-right font-bold text-[10px] uppercase tracking-widest text-gray-500 pb-2 px-2">DEBIT ({currency})</th>
                            <th className="text-right font-bold text-[10px] uppercase tracking-widest text-gray-500 pb-2 px-2">CREDIT ({currency})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Fix: Explicitly type the result of Object.entries to avoid 'unknown' type errors during mapping on line 103 */}
                        {(Object.entries(grouped) as [string, { account: OpeningBalanceAccount; index: number }[]][]).map(([subCat, items]) => (
                            <React.Fragment key={subCat}>
                                {category.category !== 'Equity' && (
                                    <tr className="bg-gray-800/20">
                                        <td colSpan={3} className={`px-2 py-2 font-bold text-xs text-gray-400 border-b border-gray-800/50 pt-4 pb-1`}>
                                            {subCat}
                                        </td>
                                    </tr>
                                )}
                                {items.map(({ account: acc, index }) => (
                                    <tr key={index} className="border-b border-gray-800/50 last:border-0 hover:bg-white/5">
                                        <td className={`py-2 px-4 text-gray-200 font-medium ${category.category !== 'Equity' ? 'pl-8' : 'pl-4'}`}>
                                            {acc.name}
                                        </td>
                                        <td className="py-2 px-2">
                                            <input
                                                type="number"
                                                step="1"
                                                value={formatNumberInput(acc.debit)}
                                                onChange={(e) => onAccountChange(category.category, index, 'debit', Math.round(parseFloat(e.target.value) || 0))}
                                                className="w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 p-1 text-white text-right font-mono outline-none transition-all"
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="py-2 px-2">
                                            <input
                                                type="number"
                                                step="1"
                                                value={formatNumberInput(acc.credit)}
                                                onChange={(e) => onAccountChange(category.category, index, 'credit', Math.round(parseFloat(e.target.value) || 0))}
                                                className="w-full bg-transparent border-b border-transparent hover:border-gray-700 focus:border-blue-500 p-1 text-white text-right font-mono outline-none transition-all"
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
    isExtracting
}) => {
    const [migrationDate, setMigrationDate] = useState('2024-01-01');
    const [openCategory, setOpenCategory] = useState<string | null>('Assets');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
            // Combine with existing selected files to avoid overwriting or duplicates if preferred
            // Here we just append. You might want to filter duplicates based on name/size/etc. as needed.
            const updatedFiles = [...selectedFiles, ...newFiles];
            onFilesSelect(updatedFiles);
        }
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
        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 bg-gray-950 border-b border-gray-800">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1 uppercase tracking-tight">Opening Balances</h3>
                            <p className="text-xs text-gray-500 max-w-lg leading-relaxed">This step is optional. You can enter opening balances here or click Continue to skip if you don't have them.</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 justify-between">
                        <div className="flex items-center space-x-4 bg-gray-900/50 p-2 rounded-lg border border-gray-800 w-fit">
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

                        <div className="flex gap-3">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                multiple
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,.xls,.xlsx"
                            />
                            <button
                                onClick={handleUploadClick}
                                className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-gray-900/20 border border-gray-700"
                            >
                                <UploadIcon className="w-5 h-5 mr-1.5" /> Upload
                            </button>
                            {selectedFiles.length > 0 && (
                                <button
                                    onClick={onExtract}
                                    disabled={isExtracting}
                                    className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isExtracting ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                            Extracting...
                                        </>
                                    ) : (
                                        <>
                                            <SparklesIcon className="w-5 h-5 mr-1.5" /> Extract
                                        </>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all text-sm shadow-lg shadow-blue-900/20"
                            >
                                <PlusIcon className="w-5 h-5 mr-1.5" /> Add Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="divide-y divide-gray-800">
                {accountsData.map(cat => (
                    <div key={cat.category} className="group">
                        <button
                            onClick={() => toggleCategory(cat.category)}
                            className={`w-full flex items-center justify-between p-4 transition-colors ${openCategory === cat.category ? 'bg-gray-800/40' : 'hover:bg-gray-800/20'}`}
                        >
                            <div className="flex items-center space-x-3">
                                <cat.icon className={`w-5 h-5 ${openCategory === cat.category ? 'text-blue-400' : 'text-gray-500'}`} />
                                <span className="font-bold text-white uppercase tracking-wide">{cat.category}</span>
                                <span className="text-[10px] bg-gray-800 text-gray-500 font-mono px-2 py-0.5 rounded-full border border-gray-700">{cat.accounts.length}</span>
                            </div>
                            {openCategory === cat.category ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                        </button>
                        {openCategory === cat.category && (
                            <AccountCategoryDetail
                                category={cat}
                                onAccountChange={handleAccountChange}
                                currency={currency}
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="p-6 bg-gray-950/80 border-t border-gray-800 shadow-inner">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex flex-wrap items-center gap-10">
                        <div className="text-left">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Debit</p>
                            <p className="font-mono font-bold text-xl text-white">{formatCurrencyForDisplay(totalDebit)} <span className="text-[10px] text-gray-600 font-normal">{currency}</span></p>
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Credit</p>
                            <p className="font-mono font-bold text-xl text-white">{formatCurrencyForDisplay(totalCredit)} <span className="text-[10px] text-gray-600 font-normal">{currency}</span></p>
                        </div>
                        <div className="text-left bg-gray-900 px-4 py-2 rounded-xl border border-gray-800 shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1 text-center">Difference</p>
                            <p className={`font-mono font-bold text-lg text-center ${Math.abs(difference) < 0.01 ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>
                                {formatCurrencyForDisplay(difference)}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4 w-full lg:w-auto">
                        {onExport && (
                            <button
                                onClick={onExport}
                                className="flex-1 lg:flex-none flex items-center justify-center px-5 py-2.5 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-all text-sm border border-gray-700 shadow-md"
                            >
                                <DocumentArrowDownIcon className="w-5 h-5 mr-2 text-gray-400" />
                                Export
                            </button>
                        )}
                        <button
                            onClick={handleContinue}
                            disabled={!isBalanced}
                            className="flex-1 lg:flex-none px-10 py-2.5 bg-white text-black font-extrabold rounded-xl hover:bg-gray-200 transition-all text-sm shadow-xl shadow-white/5 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                        >
                            {totalDebit > 0 ? 'Continue' : 'Continue (Skip)'}
                        </button>
                    </div>
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
        </div >
    );
};
