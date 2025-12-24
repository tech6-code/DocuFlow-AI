import React, { useMemo } from 'react';
import type { Invoice } from '../types';
import { BanknotesIcon, BriefcaseIcon, ChartBarIcon } from './icons';

interface InvoiceSummarizationViewProps {
    salesInvoices: Invoice[];
    purchaseInvoices: Invoice[];
    currency: string;
}

const formatNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '0.00';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

export const InvoiceSummarizationView: React.FC<InvoiceSummarizationViewProps> = ({ salesInvoices, purchaseInvoices, currency }) => {
    // --- Calculations for VAT Filing Summary (adapted from InvoiceResults) ---
    const salesSummary = useMemo(() => {
        const standardRatedSupplies = salesInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0);
        const outputTax = salesInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0);
        const zeroRatedSupplies = salesInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0);
        const exemptedSupplies = 0; // Assuming no explicit exempted supplies data in current Invoice type
        const totalAmountIncludingVat = standardRatedSupplies + outputTax; 

        return { standardRatedSupplies, outputTax, zeroRatedSupplies, exemptedSupplies, totalAmountIncludingVat };
    }, [salesInvoices]);

    const purchaseSummary = useMemo(() => {
        const standardRatedExpenses = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0);
        const inputTax = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0);
        const zeroRatedExpenses = purchaseInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0);
        const exemptedExpenses = 0; // Assuming no explicit exempted expenses data
        const totalAmountIncludingVat = standardRatedExpenses + inputTax;

        return { standardRatedExpenses, inputTax, zeroRatedExpenses, exemptedExpenses, totalAmountIncludingVat };
    }, [purchaseInvoices]);

    const vatReturn = useMemo(() => {
        const salesTotalAmount = salesSummary.standardRatedSupplies + salesSummary.zeroRatedSupplies + salesSummary.exemptedSupplies;
        const salesTotalVat = salesSummary.outputTax;
        
        const expensesTotalAmount = purchaseSummary.standardRatedExpenses + purchaseSummary.zeroRatedExpenses + purchaseSummary.exemptedExpenses;
        const expensesTotalVat = purchaseSummary.inputTax;

        const dueTax = salesTotalVat;
        const recoverableTax = expensesTotalVat;
        const payableTax = dueTax; 
        const netVatPayable = dueTax - recoverableTax;

        return {
            sales: {
                totalAmount: salesTotalAmount,
                totalVat: salesTotalVat
            },
            expenses: {
                totalAmount: expensesTotalAmount,
                totalVat: expensesTotalVat
            },
            net: {
                dueTax,
                recoverableTax,
                payableTax,
                netVatPayable
            }
        };
    }, [salesSummary, purchaseSummary]);

    const hasSales = salesInvoices.length > 0;
    const hasPurchases = purchaseInvoices.length > 0;

    return (
        <div className="space-y-6">
            {(hasSales || hasPurchases) ? (
                <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                    <div className="flex items-center mb-6 border-b border-gray-800 pb-4">
                        <ChartBarIcon className="w-6 h-6 text-indigo-400 mr-2" />
                        <h3 className="text-xl font-bold text-white">Consolidated Invoice Summary</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Sales Column */}
                        <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                            <h4 className="flex items-center text-sm font-bold text-blue-400 uppercase mb-4">
                                <BanknotesIcon className="w-4 h-4 mr-2" /> Sales (Outputs)
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Standard Rated Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(salesSummary.standardRatedSupplies)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Output Tax</span>
                                    <span className="text-blue-400 font-mono font-bold">{formatNumber(salesSummary.outputTax)} {currency}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-700 flex justify-between text-sm">
                                    <span className="text-gray-300">Total (Std + Tax)</span>
                                    <span className="text-white font-mono font-bold">{formatNumber(salesSummary.totalAmountIncludingVat)} {currency}</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-gray-400">Zero Rated Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(salesSummary.zeroRatedSupplies)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Exempted Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(salesSummary.exemptedSupplies)} {currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Purchase Column */}
                        <div className="bg-gray-800/50 rounded-lg p-5 border border-gray-700">
                            <h4 className="flex items-center text-sm font-bold text-orange-400 uppercase mb-4">
                                <BriefcaseIcon className="w-4 h-4 mr-2" /> Purchase (Inputs)
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Standard Rated Expenses</span>
                                    <span className="text-white font-mono">{formatNumber(purchaseSummary.standardRatedExpenses)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Input Tax</span>
                                    <span className="text-blue-400 font-mono font-bold">{formatNumber(purchaseSummary.inputTax)} {currency}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-700 flex justify-between text-sm">
                                    <span className="text-gray-300">Total (Std + Tax)</span>
                                    <span className="text-white font-mono font-bold">{formatNumber(purchaseSummary.totalAmountIncludingVat)} {currency}</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-gray-400">Zero Rated Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(purchaseSummary.zeroRatedExpenses)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Exempted Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(purchaseSummary.exemptedExpenses)} {currency}</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Payable Column */}
                        <div className="bg-gray-800/80 rounded-lg p-5 border border-gray-700 flex flex-col justify-center">
                            <h4 className="text-sm font-bold text-gray-300 uppercase mb-4 text-center">Net VAT Position</h4>
                            <div className="text-center space-y-2">
                                <p className="text-gray-400 text-sm">Output Tax - Input Tax</p>
                                <div className={`text-3xl font-mono font-bold ${vatReturn.net.netVatPayable >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatNumber(vatReturn.net.netVatPayable)} <span className="text-lg text-gray-500 font-normal">{currency}</span>
                                </div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">
                                    {vatReturn.net.netVatPayable >= 0 ? 'Net VAT Payable' : 'Net VAT Refundable'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-gray-900 text-center p-8 rounded-lg border border-gray-700 shadow-sm">
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">No Invoices Processed</h3>
                    <p className="text-gray-500">Please upload and process invoices to see a summary.</p>
                </div>
            )}
        </div>
    );
};
