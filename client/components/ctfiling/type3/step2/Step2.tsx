
import React, { useState, useRef } from 'react';
import { useCtType3 } from '../types';
import { TrialBalanceEntry } from '../../../../types';
import { extractOpeningBalanceDataFromFiles } from '../../../../services/geminiService';
import { CT_REPORTS_ACCOUNTS, formatNumber } from '../types';
import * as XLSX from 'xlsx';
import {
    DocumentArrowDownIcon,
    UploadIcon,
    PlusIcon,
    CheckIcon,
    XMarkIcon,
    ExclamationTriangleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    TrashIcon,
    ClipboardCheckIcon,
    DocumentTextIcon,
    AssetIcon,
    ScaleIcon,
    IncomeIcon,
    ExpenseIcon,
    EquityIcon,
    BriefcaseIcon
} from '../../../icons';
import { LoadingIndicator } from '../../../LoadingIndicator';
import { WorkingNotesModal } from '../../../WorkingNotesModal'; // Assuming it's in components root

export const Step2: React.FC = () => {
    const {
        adjustedTrialBalance,
        setAdjustedTrialBalance,
        isExtractingTB,
        setIsExtractingTB,
        extractionStatus,
        setExtractionStatus,
        extractionAlert,
        setExtractionAlert,
        tbWorkingNotes,
        setTbWorkingNotes,
        handleBack,
        companyName,
        setCurrentStep,
        setShowVatConfirm,
        showVatConfirm
    } = useCtType3();

    const [openTbSection, setOpenTbSection] = useState<string | null>('Assets');
    const [showGlobalAddAccountModal, setShowGlobalAddAccountModal] = useState(false);
    const [newGlobalAccountMain, setNewGlobalAccountMain] = useState('Assets');
    const [newGlobalAccountName, setNewGlobalAccountName] = useState('');

    // TB Notes state
    const [showTbNoteModal, setShowTbNoteModal] = useState(false);
    const [currentTbAccount, setCurrentTbAccount] = useState<string | null>(null);

    const tbFileInputRef = useRef<HTMLInputElement>(null);

    const getIconForSection = (label: string) => {
        if (label.includes('Assets')) return AssetIcon;
        if (label.includes('Liabilities')) return ScaleIcon;
        if (label.includes('Income')) return IncomeIcon;
        if (label.includes('Expenses')) return ExpenseIcon;
        if (label.includes('Equity')) return EquityIcon;
        return BriefcaseIcon;
    };

    const handleExtractTrialBalance = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const files = Array.from(e.target.files) as File[];
        console.log(`[TB Extraction] Starting for ${files.length} file(s).`);

        setIsExtractingTB(true);
        setExtractionStatus(`Initializing file processing (${files.length} file(s))...`);
        setExtractionAlert(null);

        try {
            setExtractionStatus('Gemini AI is analyzing layout and extracting ledger items with strict categorization...');

            // Use the Opening Balance extraction workflow (stricter, category-aware)
            const extractedEntries = await extractOpeningBalanceDataFromFiles(files);
            console.log(`[TB Extraction] AI returned ${extractedEntries?.length || 0} entries.`);

            if (extractedEntries && extractedEntries.length > 0) {
                // Validation: Check if it balances
                const sumDebit = extractedEntries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
                const sumCredit = extractedEntries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
                const variance = Math.abs(sumDebit - sumCredit);

                if (variance > 10) {
                    setExtractionAlert({
                        type: 'warning',
                        message: `Extraction complete, but Trial Balance is out of balance by ${formatNumber(variance)}. Please review the extracted rows below.`
                    });
                } else {
                    setExtractionAlert({ type: 'success', message: 'Trial Balance extracted successfully and balances.' });
                }

                setAdjustedTrialBalance(prev => {
                    const currentMap: Record<string, TrialBalanceEntry> = {};
                    (prev || []).forEach(item => { if (item.account.toLowerCase() !== 'totals') currentMap[item.account.toLowerCase()] = item; });

                    extractedEntries.forEach(extracted => {
                        let mappedName = extracted.account;
                        const standardAccounts = Object.keys(CT_REPORTS_ACCOUNTS);
                        const match = standardAccounts.find(sa => sa.toLowerCase() === extracted.account.toLowerCase());
                        if (match) mappedName = match;

                        const existingNotes = tbWorkingNotes[mappedName] || [];
                        const noteDebit = existingNotes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
                        const noteCredit = existingNotes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

                        // Normalize Category
                        let finalCategory = extracted.category;
                        if (mappedName && CT_REPORTS_ACCOUNTS[mappedName]) finalCategory = CT_REPORTS_ACCOUNTS[mappedName];

                        const debit = Math.abs(Number(extracted.debit) || 0);
                        const credit = Math.abs(Number(extracted.credit) || 0);

                        currentMap[mappedName.toLowerCase()] = {
                            account: mappedName,
                            category: finalCategory,
                            baseDebit: debit,
                            baseCredit: credit,
                            debit: debit + noteDebit,
                            credit: credit + noteCredit
                        };
                    });

                    const newBalance = Object.values(currentMap);
                    // Recalculate Totals
                    const totalDebit = newBalance.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
                    const totalCredit = newBalance.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
                    newBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });

                    return newBalance;
                });
            } else {
                setExtractionAlert({ type: 'error', message: "No entries extracted. Please check the files." });
            }
        } catch (error) {
            console.error("TB Extraction Error:", error);
            setExtractionAlert({ type: 'error', message: "AI Extraction Failed. Please try clear images." });
        } finally {
            setIsExtractingTB(false);
            if (tbFileInputRef.current) tbFileInputRef.current.value = '';
        }
    };

    const applySheetStyling = (worksheet: any, headerRows: number, totalRows: number = 0) => {
        // Basic styling implementation placeholder
        // Ideally this should be a utility reused 
    };

    const handleExportStep2 = () => {
        if (!adjustedTrialBalance) return;
        const tbData = [["STEP 2: ADJUSTED TRIAL BALANCE"], [], ["Account", "Category", "Debit", "Credit"]];
        adjustedTrialBalance.forEach(item => {
            tbData.push([item.account, item.category || '', item.debit || 0, item.credit || 0]);
        });
        const ws = XLSX.utils.aoa_to_sheet(tbData);
        ws['!cols'] = [{ wch: 45 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
        // applySheetStyling(ws, 3, 1); // Skipping detailed styling for now or import it
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
        XLSX.writeFile(wb, "Step2_TrialBalance.xlsx");
    };

    const handleCellChange = (accountLabel: string, field: 'debit' | 'credit', value: string) => {
        const numValue = parseFloat(value) || 0;
        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const newBalance = [...prev];
            const existingIndex = newBalance.findIndex(i => i.account === accountLabel);
            if (existingIndex > -1) {
                const item = newBalance[existingIndex];
                const newBaseDebit = field === 'debit' ? numValue : (item.baseDebit !== undefined ? item.baseDebit : item.debit);
                const newBaseCredit = field === 'credit' ? numValue : (item.baseCredit !== undefined ? item.baseCredit : item.credit);

                const notes = tbWorkingNotes[accountLabel] || [];
                const noteDebit = notes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
                const noteCredit = notes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

                newBalance[existingIndex] = {
                    ...item,
                    baseDebit: newBaseDebit,
                    baseCredit: newBaseCredit,
                    debit: newBaseDebit + noteDebit,
                    credit: newBaseCredit + noteCredit
                };
            }
            else {
                const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
                const newItem = {
                    account: accountLabel,
                    debit: numValue,
                    credit: 0,
                    baseDebit: numValue,
                    baseCredit: 0,
                    [field]: numValue
                };
                if (totalsIdx > -1) newBalance.splice(totalsIdx, 0, newItem);
                else newBalance.push(newItem);
            }

            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const finalTotalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (finalTotalsIdx > -1) newBalance[finalTotalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
            else newBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });
            return newBalance;
        });
    };

    const handleAccountRename = (oldName: string, newName: string) => {
        if (!newName.trim() || oldName === newName) return;

        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            return prev.map(item => item.account === oldName ? { ...item, account: newName } : item);
        });

        if (tbWorkingNotes[oldName]) {
            setTbWorkingNotes(prev => {
                const newNotes = { ...prev };
                newNotes[newName] = newNotes[oldName];
                delete newNotes[oldName];
                return newNotes;
            });
        }
    };

    const handleDeleteAccount = (accountName: string) => {
        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const filtered = prev.filter(item => item.account !== accountName);

            const dataOnly = filtered.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const totalsIdx = filtered.findIndex(i => i.account.toLowerCase() === 'totals');
            if (totalsIdx > -1) {
                filtered[totalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
                return [...filtered];
            } else {
                return [...filtered, { account: 'Totals', debit: totalDebit, credit: totalCredit }];
            }
        });

        setTbWorkingNotes(prev => {
            const newNotes = { ...prev };
            delete newNotes[accountName];
            return newNotes;
        });
    };

    const handleOpenTbNote = (account: string) => {
        setCurrentTbAccount(account);
        setShowTbNoteModal(true);
    };

    const handleSaveTbNote = (notes: { description: string, debit: number, credit: number }[]) => {
        if (!currentTbAccount) return;

        setTbWorkingNotes(prev => ({
            ...prev,
            [currentTbAccount]: notes
        }));

        setAdjustedTrialBalance(prev => {
            if (!prev) return null;
            const newBalance = [...prev];
            const accIndex = newBalance.findIndex(i => i.account === currentTbAccount);
            if (accIndex > -1) {
                const item = newBalance[accIndex];
                const baseDebit = item.baseDebit !== undefined ? item.baseDebit : item.debit;
                const baseCredit = item.baseCredit !== undefined ? item.baseCredit : item.credit;

                const noteDebit = notes.reduce((sum, n) => sum + (Number(n.debit) || 0), 0);
                const noteCredit = notes.reduce((sum, n) => sum + (Number(n.credit) || 0), 0);

                newBalance[accIndex] = {
                    ...item,
                    baseDebit,
                    baseCredit,
                    debit: baseDebit + noteDebit,
                    credit: baseCredit + noteCredit
                };
            }
            // Recalculate Totals
            const dataOnly = newBalance.filter(i => i.account.toLowerCase() !== 'totals');
            const totalDebit = dataOnly.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
            const totalCredit = dataOnly.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);
            const totalsIdx = newBalance.findIndex(i => i.account.toLowerCase() === 'totals');
            if (totalsIdx > -1) newBalance[totalsIdx] = { account: 'Totals', debit: totalDebit, credit: totalCredit };
            else newBalance.push({ account: 'Totals', debit: totalDebit, credit: totalCredit });

            return newBalance;
        });
    };

    const handleGlobalAddAccountSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newGlobalAccountName.trim()) {
            const newItem = { account: newGlobalAccountName.trim(), debit: 0, credit: 0, category: newGlobalAccountMain };
            setAdjustedTrialBalance(prev => {
                if (!prev) return [newItem];
                const newTb = [...prev];
                const totalsIdx = newTb.findIndex(i => i.account === 'Totals');
                if (totalsIdx > -1) newTb.splice(totalsIdx, 0, newItem);
                else newTb.push(newItem);
                return newTb;
            });
            setShowGlobalAddAccountModal(false);
            setNewGlobalAccountName('');
        }
    };


    const grandTotal = {
        debit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.debit || 0,
        credit: adjustedTrialBalance?.find(i => i.account === 'Totals')?.credit || 0
    };
    const sections = ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'];
    const normalizeCategory = (value?: string) => {
        if (!value) return '';
        const v = value.toLowerCase().trim();
        if (v.startsWith('equit')) return 'Equity';
        if (v.startsWith('liab')) return 'Liabilities';
        if (v.startsWith('asset')) return 'Assets';
        if (v.startsWith('income')) return 'Income';
        if (v.startsWith('expense')) return 'Expenses';
        return value;
    };
    const getSectionItems = (sec: string) => (
        adjustedTrialBalance?.filter(i => {
            if (i.account === 'Totals') return false;
            // First check explicit category if present (from extraction or manual add)
            if (i.category) {
                return normalizeCategory(i.category) === sec;
            }
            // Fuzzy match based on account name mapping
            const category = CT_REPORTS_ACCOUNTS[i.account];
            if (category) return category === sec;

            // Fallback fuzzy matching logic
            const lower = i.account.toLowerCase();
            if (sec === 'Income' && (lower.includes('revenue') || lower.includes('income'))) return true;
            if (sec === 'Expenses' && (lower.includes('expense') || lower.includes('cost') || lower.includes('fee') || lower.includes('salary'))) return true;
            if (sec === 'Assets' && (lower.includes('cash') || lower.includes('bank') || lower.includes('receivable') || lower.includes('asset'))) return true;
            if (sec === 'Liabilities' && (lower.includes('payable') || lower.includes('loan') || lower.includes('liability'))) return true;
            if (sec === 'Equity' && (lower.includes('equity') || lower.includes('capital'))) return true;
            return sec === 'Assets' && !Object.values(CT_REPORTS_ACCOUNTS).includes(i.account) &&
                !lower.includes('revenue') && !lower.includes('income') && !lower.includes('expense') &&
                !lower.includes('cost') && !lower.includes('fee') && !lower.includes('salary') &&
                !lower.includes('payable') && !lower.includes('loan') && !lower.includes('liability') &&
                !lower.includes('equity') && !lower.includes('capital');
        }) || []
    );

    return (
        <>
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 bg-gray-950 border-b border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h3 className="text-xl font-bold text-blue-400 uppercase tracking-widest">Adjust Trial Balance</h3>
                    <div className="flex items-center gap-3">
                        <input type="file" ref={tbFileInputRef} className="hidden" onChange={handleExtractTrialBalance} accept="image/*,.pdf" multiple />
                        <button onClick={handleExportStep2} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md">
                            <DocumentArrowDownIcon className="w-5 h-5 mr-1.5" /> Export
                        </button>
                        <button onClick={() => tbFileInputRef.current?.click()} disabled={isExtractingTB} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg text-sm border border-gray-700 transition-all shadow-md disabled:opacity-50">
                            {isExtractingTB ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> Extracting...</> : <><UploadIcon className="w-5 h-5 mr-1.5" /> Upload TB</>}
                        </button>
                        <button onClick={() => setShowGlobalAddAccountModal(true)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-all shadow-md">
                            <PlusIcon className="w-5 h-5 mr-1.5 inline-block" /> Add Account
                        </button>
                    </div>
                </div>

                {extractionAlert && (
                    <div className={`p-4 mx-6 mt-6 rounded-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${extractionAlert.type === 'error' ? 'bg-red-900/10 border-red-900/30 text-red-400' :
                        extractionAlert.type === 'warning' ? 'bg-amber-900/10 border-amber-900/30 text-amber-400' :
                            'bg-green-900/10 border-green-900/30 text-green-400'
                        }`}>
                        {extractionAlert.type === 'error' ? <XMarkIcon className="w-5 h-5 shrink-0" /> :
                            extractionAlert.type === 'warning' ? <ExclamationTriangleIcon className="w-5 h-5 shrink-0" /> :
                                <CheckIcon className="w-5 h-5 shrink-0" />
                        }
                        <div className="flex-1 text-sm font-bold">{extractionAlert.message}</div>
                        <button onClick={() => setExtractionAlert(null)} className="text-gray-500 hover:text-white transition-colors"><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                )}

                {isExtractingTB && (
                    <div className="p-6 border-b border-gray-800 bg-black/40">
                        <LoadingIndicator
                            progress={extractionStatus.includes('Gemini') ? 75 : 30}
                            statusText={extractionStatus || "Gemini AI is reading your Trial Balance table..."}
                            size="compact"
                        />
                    </div>
                )}

                <div className="divide-y divide-gray-800">
                    {sections.map(sec => (
                        <div key={sec}>
                            <button onClick={() => setOpenTbSection(openTbSection === sec ? null : sec)} className={`w-full flex items-center justify-between p-4 transition-colors ${openTbSection === sec ? 'bg-gray-800/80' : 'hover:bg-gray-800/30'}`}>
                                <div className="flex items-center space-x-3">
                                    {React.createElement(getIconForSection(sec), { className: "w-5 h-5 text-gray-400" })}
                                    <span className="font-bold text-white uppercase tracking-wide">{sec}</span>
                                    <span className="text-[10px] bg-gray-800 text-gray-500 font-mono px-2 py-0.5 rounded-full border border-gray-700">
                                        {getSectionItems(sec).length}
                                    </span>
                                </div>
                                {openTbSection === sec ? <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : <ChevronRightIcon className="w-5 h-5 text-gray-500" />}
                            </button>
                            {openTbSection === sec && (
                                <div className="bg-black/40 p-4 border-t border-gray-800/50">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead><tr className="bg-gray-800/30 text-gray-500 text-[10px] uppercase tracking-widest"><th className="px-4 py-2 border-b border-gray-700/50">Account Name</th><th className="px-4 py-2 border-b border-gray-700/50 text-center w-16">Notes</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Debit</th><th className="px-4 py-2 text-right border-b border-gray-700/50">Credit</th></tr></thead>
                                        <tbody>
                                            {getSectionItems(sec).map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-800/20 border-b border-gray-800/30 last:border-0 group">
                                                    <td className="py-2 px-4 text-gray-300 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="text"
                                                                value={item.account}
                                                                onChange={(e) => handleAccountRename(item.account, e.target.value)}
                                                                className="bg-transparent border-0 focus:ring-1 focus:ring-blue-500 rounded px-1 py-0.5 w-full hover:bg-gray-800/50 transition-colors"
                                                            />
                                                            <button
                                                                onClick={() => handleDeleteAccount(item.account)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                                                                title="Delete Account"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="py-2 px-4 text-center">
                                                        <button
                                                            onClick={() => handleOpenTbNote(item.account)}
                                                            className={`p-1.5 rounded-lg transition-all ${tbWorkingNotes[item.account]?.length > 0 ? 'bg-blue-600/20 text-blue-400' : 'text-gray-600 hover:text-blue-400 hover:bg-gray-800'}`}
                                                            title="Add Working Notes"
                                                        >
                                                            {tbWorkingNotes[item.account]?.length > 0 ? <ClipboardCheckIcon className="w-4 h-4" /> : <DocumentTextIcon className="w-4 h-4" />}
                                                        </button>
                                                    </td>
                                                    <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.debit || ''} onChange={e => handleCellChange(item.account, 'debit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                                    <td className="py-1 px-2 text-right"><input type="number" step="0.01" value={item.credit || ''} onChange={e => handleCellChange(item.account, 'credit', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-right font-mono text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none" /></td>
                                                </tr>
                                            ))}
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
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Debit</p><p className="font-mono font-bold text-2xl text-white">{formatNumber(grandTotal.debit)}</p></div>
                            <div><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Grand Total Credit</p><p className="font-mono font-bold text-2xl text-white">{formatNumber(grandTotal.credit)}</p></div>
                        </div>
                        <div className={`px-6 py-2 rounded-xl border font-mono font-bold text-xl ${Math.abs(grandTotal.debit - grandTotal.credit) < 0.1 ? 'text-green-400 border-green-900 bg-green-900/10' : 'text-red-400 border-red-900 bg-red-900/10 animate-pulse'}`}>
                            {Math.abs(grandTotal.debit - grandTotal.credit) < 0.1 ? 'Balanced' : `Variance: ${formatNumber(grandTotal.debit - grandTotal.credit)}`}
                        </div>
                    </div>
                    <div className="flex justify-between mt-8 border-t border-gray-800 pt-6">
                        <button onClick={handleBack} className="text-gray-400 hover:text-white font-bold transition-colors">Back</button>
                        <button onClick={() => setShowVatConfirm(true)} disabled={Math.abs(grandTotal.debit - grandTotal.credit) > 0.1} className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-xl disabled:opacity-50 transition-all">Continue</button>
                    </div>
                </div>
            </div>

            {showVatConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800">
                            <h3 className="text-lg font-bold text-white">Upload VAT Docs?</h3>
                            <p className="text-sm text-gray-400 mt-2">Do you want to upload VAT documents now?</p>
                        </div>
                        <div className="p-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowVatConfirm(false)}
                                className="px-5 py-2 text-gray-400 font-bold hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { setShowVatConfirm(false); setCurrentStep(5); /* Skip VAT */ }}
                                className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg border border-gray-600 transition-all"
                            >
                                Skip & Manual Entry
                            </button>
                            <button
                                onClick={() => { setShowVatConfirm(false); setCurrentStep(3); /* Go to VAT */ }}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow-lg border border-blue-500 transition-all"
                            >
                                Yes, Upload Docs
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showGlobalAddAccountModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                            <h3 className="text-lg font-bold text-blue-400 uppercase tracking-wide">Add New Account</h3>
                            <button onClick={() => setShowGlobalAddAccountModal(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-gray-800"><XMarkIcon className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleGlobalAddAccountSubmit}>
                            <div className="p-6 space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Main Category</label>
                                    <select value={newGlobalAccountMain} onChange={(e) => setNewGlobalAccountMain(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" required>
                                        <option value="Assets">Assets</option><option value="Liabilities">Liabilities</option><option value="Equity">Equity</option><option value="Income">Income</option><option value="Expenses">Expenses</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 tracking-widest">Account Name</label>
                                    <input type="text" value={newGlobalAccountName} onChange={(e) => setNewGlobalAccountName(e.target.value)} className="w-full p-3 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all" placeholder="e.g. Project Development Fees" required autoFocus />
                                </div>
                            </div>
                            <div className="p-4 bg-gray-800/50 border-t border-gray-800 flex justify-end space-x-3">
                                <button type="button" onClick={() => setShowGlobalAddAccountModal(false)} className="px-5 py-2 text-sm text-gray-400 font-bold transition-colors">Cancel</button>
                                <button type="submit" className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl shadow-lg transition-all">Add Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <WorkingNotesModal
                isOpen={showTbNoteModal}
                onClose={() => setShowTbNoteModal(false)}
                title={`Working Notes: ${currentTbAccount}`}
                notes={tbWorkingNotes[currentTbAccount || ''] || []}
                onSave={handleSaveTbNote}
                currency={useCtType3().currency} // Access currency specifically
            />
        </>
    );
};
