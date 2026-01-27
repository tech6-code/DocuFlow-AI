import React, { useMemo } from 'react';
import {
    ClipboardCheckIcon,
    ExclamationTriangleIcon,
    DocumentArrowDownIcon
} from '../icons';
import {
    formatDecimalNumber,
    getQuarter
} from './CtType1Shared';
import type { Transaction } from '../../types';

interface CtType1Step4Props {
    vatFileResults: any[];
    vatManualAdjustments: any;
    handleVatAdjustmentChange: (quarter: string, field: string, value: string) => void;
    handleBack: () => void;
    handleVatSummarizationContinue: () => void;
    editedTransactions: Transaction[];
    currency: string;
}

export const CtType1Step4: React.FC<CtType1Step4Props> = ({
    vatFileResults,
    vatManualAdjustments,
    handleVatAdjustmentChange,
    handleBack,
    handleVatSummarizationContinue,
    editedTransactions,
    currency
}) => {
    const vatStepData = useMemo(() => {
        const quarters = {
            'Q1': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' },
            'Q2': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' },
            'Q3': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' },
            'Q4': { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0, hasData: false, startDate: '', endDate: '' }
        };

        vatFileResults.forEach((res: any) => {
            const q = getQuarter(res.periodFrom) as keyof typeof quarters;
            if (quarters[q]) {
                quarters[q].hasData = true;
                if (!quarters[q].startDate) quarters[q].startDate = res.periodFrom;
                if (!quarters[q].endDate) quarters[q].endDate = res.periodTo;

                quarters[q].sales.zero += (res.sales?.zeroRated || 0);
                quarters[q].sales.tv += (res.sales?.standardRated || 0);
                quarters[q].sales.vat += (res.sales?.vatAmount || 0);
                quarters[q].purchases.zero += (res.purchases?.zeroRated || 0);
                quarters[q].purchases.tv += (res.purchases?.standardRated || 0);
                quarters[q].purchases.vat += (res.purchases?.vatAmount || 0);
            }
        });

        const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];
        quarterKeys.forEach((q) => {
            const adj = vatManualAdjustments[q] || {};
            const qData = quarters[q as keyof typeof quarters];

            if (adj.salesZero !== undefined) qData.sales.zero = parseFloat(adj.salesZero) || 0;
            if (adj.salesTv !== undefined) qData.sales.tv = parseFloat(adj.salesTv) || 0;
            if (adj.salesVat !== undefined) qData.sales.vat = parseFloat(adj.salesVat) || 0;

            if (adj.purchasesZero !== undefined) qData.purchases.zero = parseFloat(adj.purchasesZero) || 0;
            if (adj.purchasesTv !== undefined) qData.purchases.tv = parseFloat(adj.purchasesTv) || 0;
            if (adj.purchasesVat !== undefined) qData.purchases.vat = parseFloat(adj.purchasesVat) || 0;

            qData.sales.total = qData.sales.zero + qData.sales.tv + qData.sales.vat;
            qData.purchases.total = qData.purchases.zero + qData.purchases.tv + qData.purchases.vat;
            qData.net = qData.sales.vat - qData.purchases.vat;
        });

        const grandTotals = quarterKeys.reduce((acc, q) => {
            const data = quarters[q as keyof typeof quarters];
            return {
                sales: {
                    zero: acc.sales.zero + data.sales.zero,
                    tv: acc.sales.tv + data.sales.tv,
                    vat: acc.sales.vat + data.sales.vat,
                    total: acc.sales.total + data.sales.total
                },
                purchases: {
                    zero: acc.purchases.zero + data.purchases.zero,
                    tv: acc.purchases.tv + data.purchases.tv,
                    vat: acc.purchases.vat + data.purchases.vat,
                    total: acc.purchases.total + data.purchases.total
                },
                net: acc.net + data.net
            };
        }, { sales: { zero: 0, tv: 0, vat: 0, total: 0 }, purchases: { zero: 0, tv: 0, vat: 0, total: 0 }, net: 0 });

        return { quarters, grandTotals };
    }, [vatFileResults, vatManualAdjustments]);

    const bankVatData = useMemo(() => {
        const quarters = {
            'Q1': { sales: 0, purchases: 0 },
            'Q2': { sales: 0, purchases: 0 },
            'Q3': { sales: 0, purchases: 0 },
            'Q4': { sales: 0, purchases: 0 }
        };

        editedTransactions.forEach(t => {
            const q = getQuarter(t.date) as keyof typeof quarters;
            if (quarters[q]) {
                const category = t.category || '';
                const isSales = category.startsWith('Income');
                const isPurchases = category.startsWith('Expenses');

                if (isSales) {
                    quarters[q].sales += (t.credit || 0) - (t.debit || 0);
                } else if (isPurchases) {
                    quarters[q].purchases += (t.debit || 0) - (t.credit || 0);
                }
            }
        });

        const grandTotals = Object.values(quarters).reduce((acc, q) => {
            return {
                sales: acc.sales + q.sales,
                purchases: acc.purchases + q.purchases
            };
        }, { sales: 0, purchases: 0 });

        return { quarters, grandTotals };
    }, [editedTransactions]);

    const { quarters, grandTotals } = vatStepData;
    const quarterKeys = ['Q1', 'Q2', 'Q3', 'Q4'];

    const ValidationWarning = ({ expected, actual, label }: { expected: number, actual: number, label: string }) => {
        if (Math.abs(expected - actual) > 1) {
            return (
                <div className="flex items-center text-[10px] text-orange-400 mt-1">
                    <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
                    <span>Sum mismatch (Calc: {formatDecimalNumber(actual)})</span>
                </div>
            );
        }
        return null;
    };

    const renderEditableCell = (quarter: string, field: string, value: number) => {
        const displayValue = vatManualAdjustments[quarter]?.[field] ?? (value === 0 ? '' : value.toString());
        return (
            <input
                type="text"
                value={displayValue}
                onChange={(e) => handleVatAdjustmentChange(quarter, field, e.target.value)}
                className="w-full bg-transparent text-right outline-none focus:bg-white/10 px-2 py-1 rounded transition-colors font-mono"
                placeholder="0.00"
            />
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-12">
            <div className="flex flex-col items-center mb-4">
                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-lg backdrop-blur-xl mb-6">
                    <ClipboardCheckIcon className="w-8 h-8 text-blue-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-3xl font-black text-white tracking-tighter uppercase">VAT Summarization</h3>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px] opacity-60 mt-1">Consolidated VAT 201 Report (Editable)</p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto space-y-8">
                {/* Sales Section */}
                <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                    <div className="px-8 py-5 border-b border-gray-800 bg-blue-900/10 flex justify-between items-center">
                        <h4 className="text-sm font-black text-blue-300 uppercase tracking-[0.2em]">Sales (Outputs) - As per FTA</h4>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in {currency}</span>
                    </div>
                    <div className="p-2 overflow-x-auto">
                        <table className="w-full text-center">
                            <thead className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                <tr>
                                    <th className="py-4 px-4 text-left">Period</th>
                                    <th className="py-4 px-4 text-right">Zero Rated</th>
                                    <th className="py-4 px-4 text-right">Standard Rated</th>
                                    <th className="py-4 px-4 text-right text-blue-400">VAT Amount</th>
                                    <th className="py-4 px-4 text-right bg-blue-900/5 text-blue-200">Total Sales</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300 text-xs font-mono">
                                {quarterKeys.map((q) => {
                                    const qFullData = quarters[q as keyof typeof quarters];
                                    const data = qFullData.sales;
                                    const bankSales = bankVatData.quarters[q as keyof typeof bankVatData.quarters].sales;

                                    return (
                                        <tr key={q} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                            <td className="py-4 px-4 text-left">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-white font-black">{q}</span>
                                                    <span className="text-[9px] text-gray-500 font-sans tracking-tight">{qFullData.hasData ? `${qFullData.startDate} - ${qFullData.endDate}` : 'No Data'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right">{renderEditableCell(q, 'salesZero', data.zero)}</td>
                                            <td className="py-4 px-4 text-right">{renderEditableCell(q, 'salesTv', data.tv)}</td>
                                            <td className="py-4 px-4 text-right text-blue-400">
                                                {renderEditableCell(q, 'salesVat', data.vat)}
                                                <ValidationWarning expected={data.vat} actual={data.tv * 0.05} label="VAT" />
                                            </td>
                                            <td className="py-4 px-4 text-right bg-blue-900/5 font-black text-blue-200">
                                                {formatDecimalNumber(data.total)}
                                                <ValidationWarning expected={data.total} actual={bankSales} label="Summary" />
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-blue-900/20 font-black">
                                    <td className="py-6 px-4 text-left text-blue-300 uppercase tracking-widest">Grand Total</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.sales.zero)}</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.sales.tv)}</td>
                                    <td className="py-6 px-4 text-right text-blue-400">{formatDecimalNumber(grandTotals.sales.vat)}</td>
                                    <td className="py-6 px-4 text-right bg-blue-900/30 text-blue-100 text-sm shadow-inner">{formatDecimalNumber(grandTotals.sales.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Purchases Section */}
                <div className="bg-[#0B1120] rounded-[2rem] border border-gray-800 shadow-2xl overflow-hidden">
                    <div className="px-8 py-5 border-b border-gray-800 bg-emerald-900/10 flex justify-between items-center">
                        <h4 className="text-sm font-black text-emerald-300 uppercase tracking-[0.2em]">Purchases (Inputs) - As per FTA</h4>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Figures in {currency}</span>
                    </div>
                    <div className="p-2 overflow-x-auto">
                        <table className="w-full text-center">
                            <thead className="text-[9px] font-black uppercase tracking-widest text-gray-500 border-b border-gray-800">
                                <tr>
                                    <th className="py-4 px-4 text-left">Period</th>
                                    <th className="py-4 px-4 text-right">Zero Rated</th>
                                    <th className="py-4 px-4 text-right">Standard Rated</th>
                                    <th className="py-4 px-4 text-right text-emerald-400">VAT Amount</th>
                                    <th className="py-4 px-4 text-right bg-emerald-900/5 text-emerald-200">Total Purchases</th>
                                </tr>
                            </thead>
                            <tbody className="text-gray-300 text-xs font-mono">
                                {quarterKeys.map((q) => {
                                    const qFullData = quarters[q as keyof typeof quarters];
                                    const data = qFullData.purchases;
                                    const bankPurchases = bankVatData.quarters[q as keyof typeof bankVatData.quarters].purchases;

                                    return (
                                        <tr key={q} className="border-b border-gray-800/40 hover:bg-white/5 transition-colors group">
                                            <td className="py-4 px-4 text-left">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-white font-black">{q}</span>
                                                    <span className="text-[9px] text-gray-500 font-sans tracking-tight">{qFullData.hasData ? `${qFullData.startDate} - ${qFullData.endDate}` : 'No Data'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 text-right">{renderEditableCell(q, 'purchasesZero', data.zero)}</td>
                                            <td className="py-4 px-4 text-right">{renderEditableCell(q, 'purchasesTv', data.tv)}</td>
                                            <td className="py-4 px-4 text-right text-emerald-400">
                                                {renderEditableCell(q, 'purchasesVat', data.vat)}
                                                <ValidationWarning expected={data.vat} actual={data.tv * 0.05} label="VAT" />
                                            </td>
                                            <td className="py-4 px-4 text-right bg-emerald-900/5 font-black text-emerald-200">
                                                {formatDecimalNumber(data.total)}
                                                <ValidationWarning expected={data.total} actual={bankPurchases} label="Summary" />
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-emerald-900/20 font-black">
                                    <td className="py-6 px-4 text-left text-emerald-300 uppercase tracking-widest">Grand Total</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.purchases.zero)}</td>
                                    <td className="py-6 px-4 text-right">{formatDecimalNumber(grandTotals.purchases.tv)}</td>
                                    <td className="py-6 px-4 text-right text-emerald-400">{formatDecimalNumber(grandTotals.purchases.vat)}</td>
                                    <td className="py-6 px-4 text-right bg-emerald-900/30 text-emerald-100 text-sm shadow-inner">{formatDecimalNumber(grandTotals.purchases.total)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Net Position Row */}
                <div className="flex flex-col md:flex-row gap-6 mt-12">
                    <div className="flex-1 bg-gradient-to-br from-slate-900 to-black rounded-[2rem] border border-gray-700 p-8 flex items-center justify-between shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <ClipboardCheckIcon className="w-32 h-32" />
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mb-2">Net VAT {grandTotals.net >= 0 ? 'Payable' : 'Refundable'}</p>
                            <h2 className={`text-4xl font-black ${grandTotals.net >= 0 ? 'text-blue-400' : 'text-emerald-400'} tracking-tighter`}>
                                {formatDecimalNumber(Math.abs(grandTotals.net))} <span className="text-xl opacity-50 ml-1">{currency}</span>
                            </h2>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Status</p>
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${grandTotals.net >= 0 ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                                {grandTotals.net >= 0 ? 'Liability to FTA' : 'Refund from FTA'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-8">
                    <button onClick={handleBack} className="text-gray-500 hover:text-white font-bold uppercase tracking-widest text-[11px] transition-colors border-b border-transparent hover:border-gray-500 pb-1">Go Back</button>
                    <button
                        onClick={handleVatSummarizationContinue}
                        className="px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-blue-500/20 transform hover:-translate-y-1 transition-all active:scale-95 uppercase tracking-widest text-xs"
                    >
                        Confirm Summarization
                    </button>
                </div>
            </div>
        </div>
    );
};
