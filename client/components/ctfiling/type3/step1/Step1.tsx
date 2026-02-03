
import React from 'react';
import { useCtType3 } from '../types';
import { OpeningBalances } from '../../../OpeningBalances';
import { extractOpeningBalanceDataFromFiles } from '../../../../services/geminiService';
import * as XLSX from 'xlsx';

export const Step1: React.FC = () => {
    const {
        currency,
        openingBalancesData,
        setOpeningBalancesData,
        openingBalanceFiles,
        setOpeningBalanceFiles,
        isExtractingOpeningBalances,
        setIsExtractingOpeningBalances,
        setAdjustedTrialBalance,
        setCurrentStep,
        onReset
    } = useCtType3();

    const handleOpeningBalancesComplete = () => {
        setCurrentStep(2); // Trial Balance step
    };

    const handleExtractOpeningBalances = async () => {
        if (openingBalanceFiles.length === 0) return;

        // Safety clear to ensure absolutely no previous trial balance leads
        setAdjustedTrialBalance(null);

        setIsExtractingOpeningBalances(true);
        try {
            const extractedEntries = await extractOpeningBalanceDataFromFiles(openingBalanceFiles);

            if (extractedEntries && extractedEntries.length > 0) {
                setOpeningBalancesData(prev => {
                    // Create a deep copy AND clear previous automated extractions to prevent stale data
                    const newData = prev.map(cat => ({
                        ...cat,
                        accounts: cat.accounts
                            .filter(acc => acc.subCategory !== 'Extracted')
                            .map(acc => ({ ...acc }))
                    }));

                    // Helper to update or add an account
                    const upsertAccount = (categoryName: string, accountName: string, debit: number, credit: number) => {
                        const category = newData.find(c => c.category === categoryName);
                        if (!category) return false;

                        // Normalize for fuzzy match
                        const normName = accountName.toLowerCase().trim();
                        const existingAccount = category.accounts.find(
                            acc => acc.name.toLowerCase().trim() === normName
                        );

                        if (existingAccount) {
                            existingAccount.debit = (existingAccount.debit || 0) + debit;
                            existingAccount.credit = (existingAccount.credit || 0) + credit;
                        } else {
                            category.accounts.push({
                                name: accountName,
                                debit,
                                credit,
                                subCategory: 'Extracted'
                            });
                        }
                        return true;
                    };

                    extractedEntries.forEach(entry => {
                        if (entry.category) {
                            upsertAccount(entry.category, entry.account, entry.debit || 0, entry.credit || 0);
                        }
                    });

                    return newData;
                });
            }
        } catch (error) {
            console.error("Extraction error:", error);
            // Handle error (maybe set alert in context if available)
        } finally {
            setIsExtractingOpeningBalances(false);
        }
    };

    const handleExportOpeningBalances = () => {
        if (!openingBalancesData) return;

        // Flatten data for export
        const rows = [
            ['Category', 'Sub-Category', 'Account Name', 'Debit', 'Credit']
        ];

        openingBalancesData.forEach(cat => {
            cat.accounts.forEach(acc => {
                rows.push([
                    cat.category,
                    acc.subCategory || '',
                    acc.name,
                    acc.debit || 0,
                    acc.credit || 0
                ]);
            });
        });

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Opening Balances");
        XLSX.writeFile(wb, "Opening_Balances.xlsx");
    };

    return (
        <div className="space-y-6">
            <OpeningBalances
                onComplete={handleOpeningBalancesComplete}
                currency={currency}
                accountsData={openingBalancesData}
                onAccountsDataChange={setOpeningBalancesData}
                onExport={handleExportOpeningBalances}
                selectedFiles={openingBalanceFiles}
                onFilesSelect={setOpeningBalanceFiles}
                onExtract={handleExtractOpeningBalances}
                isExtracting={isExtractingOpeningBalances}
            />
            <div className="flex justify-start">
                <button onClick={onReset} className="px-4 py-2 text-gray-400 hover:text-white font-medium transition-colors">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );
};
