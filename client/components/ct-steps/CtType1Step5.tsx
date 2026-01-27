import React from 'react';
import {
    UploadIcon,
    ArrowPathIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    DocumentTextIcon,
    XMarkIcon
} from '../icons';
import {
    formatWholeNumber
} from './CtType1Shared';

interface CtType1Step5Props {
    openingBalancesData: any[];
    setOpeningBalancesData: React.Dispatch<React.SetStateAction<any[]>>;
    openingBalanceFiles: File[];
    setOpeningBalanceFiles: React.Dispatch<React.SetStateAction<File[]>>;
    isExtractingOpeningBalances: boolean;
    handleExtractOpeningBalances: () => Promise<void>;
    handleBack: () => void;
    handleOpeningBalancesComplete: () => void;
}

export const CtType1Step5: React.FC<CtType1Step5Props> = ({
    openingBalancesData,
    setOpeningBalancesData,
    openingBalanceFiles,
    setOpeningBalanceFiles,
    isExtractingOpeningBalances,
    handleExtractOpeningBalances,
    handleBack,
    handleOpeningBalancesComplete
}) => {
    const handleValueChange = (catIdx: number, accIdx: number, field: 'debit' | 'credit', value: string) => {
        const num = Math.round(parseFloat(value) || 0);
        setOpeningBalancesData(prev => {
            const newData = [...prev];
            newData[catIdx].accounts[accIdx][field] = num;
            return newData;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setOpeningBalanceFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeFile = (index: number) => {
        setOpeningBalanceFiles(prev => prev.filter((_, i) => i !== index));
    };

    const totalDebit = openingBalancesData.reduce((sum, cat) => sum + cat.accounts.reduce((s: number, a: any) => s + (a.debit || 0), 0), 0);
    const totalCredit = openingBalancesData.reduce((sum, cat) => sum + cat.accounts.reduce((s: number, a: any) => s + (a.credit || 0), 0), 0);
    const isBalanced = totalDebit === totalCredit;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white mb-1">Step 5: Opening Balances</h2>
                        <p className="text-gray-400 text-sm">Enter opening balances from your previous year's Trial Balance or Financial Statements.</p>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 p-4 rounded-xl border border-gray-800">
                        <label className="cursor-pointer group">
                            <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-all">
                                <UploadIcon className="w-5 h-5 text-blue-400" />
                                <span className="text-xs font-bold text-white">Import from TB/FS</span>
                                <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
                            </div>
                        </label>
                        {openingBalanceFiles.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 font-bold uppercase">{openingBalanceFiles.length} Files</span>
                                <button
                                    onClick={handleExtractOpeningBalances}
                                    disabled={isExtractingOpeningBalances}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase rounded shadow-lg disabled:opacity-50"
                                >
                                    {isExtractingOpeningBalances ? 'Extracting...' : 'Start Extraction'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {openingBalanceFiles.length > 0 && (
                    <div className="px-8 py-4 bg-gray-800/40 border-b border-gray-700 flex flex-wrap gap-2">
                        {openingBalanceFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1 bg-gray-900 rounded-full border border-gray-700 group">
                                <DocumentTextIcon className="w-3 h-3 text-gray-400" />
                                <span className="text-[10px] text-gray-300 truncate max-w-[100px]">{f.name}</span>
                                <button onClick={() => removeFile(i)} className="text-gray-500 hover:text-red-400"><XMarkIcon className="w-3 h-3" /></button>
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-8">
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        {openingBalancesData.map((cat, catIdx) => (
                            <div key={catIdx} className="bg-black/20 rounded-xl border border-gray-800 p-5">
                                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-4 pb-2 border-b border-gray-800 flex justify-between">
                                    {cat.category}
                                    <span className="text-gray-600 font-mono">
                                        Subtotal: {formatWholeNumber(cat.accounts.reduce((s: number, a: any) => s + (a.debit || a.credit || 0), 0))}
                                    </span>
                                </h4>
                                <div className="space-y-3">
                                    {cat.accounts.map((acc: any, accIdx: number) => (
                                        <div key={accIdx} className="grid grid-cols-4 gap-3 items-center group">
                                            <span className="col-span-2 text-xs text-gray-300 font-medium group-hover:text-white transition-colors truncate" title={acc.name}>
                                                {acc.name}
                                            </span>
                                            {cat.category === 'Assets' ? (
                                                <>
                                                    <div className="col-span-2 relative">
                                                        <input
                                                            type="text"
                                                            value={acc.debit === 0 ? '' : acc.debit}
                                                            placeholder="0"
                                                            onChange={(e) => handleValueChange(catIdx, accIdx, 'debit', e.target.value)}
                                                            className="w-full bg-gray-800 border-none rounded px-2 py-1 text-xs text-right text-red-400 font-mono focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="col-span-2 relative">
                                                        <input
                                                            type="text"
                                                            value={acc.credit === 0 ? '' : acc.credit}
                                                            placeholder="0"
                                                            onChange={(e) => handleValueChange(catIdx, accIdx, 'credit', e.target.value)}
                                                            className="w-full bg-gray-800 border-none rounded px-2 py-1 text-xs text-right text-green-400 font-mono focus:ring-1 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="px-8 py-6 bg-gray-800/50 border-t border-gray-700 flex justify-between items-center">
                    <div className="flex gap-8">
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Debits</p>
                            <p className="text-xl font-black text-red-400 font-mono">{formatWholeNumber(totalDebit)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Credits</p>
                            <p className="text-xl font-black text-green-400 font-mono">{formatWholeNumber(totalCredit)}</p>
                        </div>
                        <div className="flex items-center gap-3 px-6 border-l border-gray-700">
                            {isBalanced ? (
                                <div className="flex items-center gap-2 text-green-500">
                                    <CheckIcon className="w-6 h-6" />
                                    <span className="text-xs font-black uppercase tracking-widest">Balanced</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-red-500">
                                    <ExclamationTriangleIcon className="w-6 h-6" />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black uppercase tracking-widest">Unbalanced</span>
                                        <span className="text-[10px] font-mono opacity-80">Diff: {formatWholeNumber(Math.abs(totalDebit - totalCredit))}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={handleBack} className="px-6 py-2 text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest">Back</button>
                        <button
                            onClick={handleOpeningBalancesComplete}
                            className={`px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-xl shadow-blue-500/20 transform transition-all active:scale-95`}
                        >
                            Complete & Next Step
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
