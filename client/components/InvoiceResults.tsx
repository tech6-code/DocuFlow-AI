
import React, { useState, useCallback, useMemo } from 'react';
import type { Invoice } from '../types';
import {
    RefreshIcon,
    DocumentArrowDownIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClipboardIcon,
    ClipboardCheckIcon,
    BrainIcon,
    DocumentTextIcon,
    PencilIcon,
    CheckIcon,
    ExclamationTriangleIcon,
    BanknotesIcon,
    BriefcaseIcon,
    ChartPieIcon,
    ChartBarIcon
} from './icons';
import { useData } from '../contexts/DataContext';
import { InvoiceEditModal } from './InvoiceEditModal';

interface InvoiceResultsProps {
    invoices: Invoice[];
    onReset: () => void;
    previewUrls: string[];
    knowledgeBase: Invoice[];
    onAddToKnowledgeBase: (invoice: Invoice) => void;
    onUpdateInvoice: (index: number, invoice: Invoice) => void;
}

declare const XLSX: any;

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    // Check if already DD/MM/YYYY
    if (typeof dateStr === 'string' && /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
        return dateStr.replace(/[\-\.]/g, '/');
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatNumber = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) return '-';
    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const getConfidenceLevel = (score: number) => {
    if (score >= 80) return { label: 'High', color: 'bg-green-900/30 text-green-400 border-green-700/50', icon: CheckIcon };
    if (score >= 50) return { label: 'Medium', color: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/50', icon: ExclamationTriangleIcon };
    return { label: 'Low', color: 'bg-red-900/30 text-red-400 border-red-700/50', icon: ExclamationTriangleIcon };
};

const getConfidenceTextColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
};

interface InvoiceItemProps {
    invoice: Invoice;
    index: number;
    onEdit: (invoice: Invoice, index: number) => void;
    knowledgeBase: Invoice[];
    onAddToKnowledgeBase: (invoice: Invoice) => void;
    onVerify: (index: number) => void;
}

const InvoiceItem: React.FC<InvoiceItemProps> = ({
    invoice,
    index,
    onEdit,
    knowledgeBase,
    onAddToKnowledgeBase,
    onVerify
}) => {
    const { hasPermission } = useData();

    const isInKnowledgeBase = knowledgeBase.some(
        (kbInvoice) => kbInvoice.invoiceId === invoice.invoiceId && kbInvoice.vendorName === invoice.vendorName
    );

    const confidenceInfo = invoice.confidence !== undefined ? getConfidenceLevel(invoice.confidence) : null;

    return (
        <div className={`bg-gray-900 rounded-xl border overflow-hidden shadow-sm group transition-all duration-300 ${invoice.isVerified ? 'border-green-500/50 ring-1 ring-green-500/20' : 'border-gray-700'}`}>
            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-white">Invoice: {invoice.invoiceId}</h3>
                            {invoice.invoiceType === 'sales' ? (
                                <span className="text-xs font-semibold bg-blue-900/30 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-700/50">Sales</span>
                            ) : (
                                <span className="text-xs font-semibold bg-orange-900/30 text-orange-300 px-2.5 py-0.5 rounded-full border border-orange-700/50">Purchase</span>
                            )}
                            {invoice.isVerified && (
                                <span className="flex items-center text-xs font-bold text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full border border-green-800">
                                    <CheckIcon className="w-3 h-3 mr-1" /> Verified
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                            {invoice.invoiceType === 'sales' ? `To: ${invoice.customerName}` : `From: ${invoice.vendorName}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {confidenceInfo && (
                        <div className={`flex items-center px-3 py-1 rounded-full border text-xs font-medium ${confidenceInfo.color}`}>
                            <confidenceInfo.icon className="w-3.5 h-3.5 mr-1.5" />
                            {confidenceInfo.label} ({invoice.confidence}%)
                        </div>
                    )}

                    <div className="h-6 w-px bg-gray-700 mx-1"></div>

                    <button
                        onClick={() => onVerify(index)}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${invoice.isVerified
                            ? 'bg-green-900/20 text-green-400 border-green-800 hover:bg-green-900/40'
                            : 'bg-gray-700 text-white border-gray-600 hover:bg-green-700 hover:border-green-600 hover:text-white'
                            }`}
                        title={invoice.isVerified ? "Unverify" : "Mark as Verified"}
                    >
                        {invoice.isVerified ? 'Verified' : 'Verify'}
                    </button>

                    <button
                        onClick={() => onEdit(invoice, index)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                        title="Edit Invoice Details"
                    >
                        <PencilIcon className="w-4 h-4" />
                    </button>

                    {hasPermission('invoices-&-bills:manageKnowledgeBase') && (
                        <button
                            onClick={() => onAddToKnowledgeBase(invoice)}
                            disabled={isInKnowledgeBase}
                            className="flex items-center justify-center w-8 h-8 bg-gray-700 text-white border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed shadow-sm"
                            title={isInKnowledgeBase ? "Learned" : "Add to KB"}
                        >
                            <BrainIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div><span className="font-semibold text-gray-400 block text-xs uppercase mb-1">Entity</span> {invoice.invoiceType === 'sales' ? invoice.customerName : invoice.vendorName}</div>
                <div><span className="font-semibold text-gray-400 block text-xs uppercase mb-1">Date</span> {formatDate(invoice.invoiceDate)}</div>
                <div><span className="font-semibold text-gray-400 block text-xs uppercase mb-1">Net Amount (AED)</span> {formatNumber(invoice.totalBeforeTaxAED || 0)}</div>
                <div><span className="font-semibold text-gray-400 block text-xs uppercase mb-1">Tax Amount (AED)</span> {formatNumber(invoice.totalTaxAED || 0)}</div>
                <div><span className="font-semibold text-gray-400 block text-xs uppercase mb-1">Total (AED)</span> <span className="text-white font-bold">{formatNumber(invoice.totalAmountAED || 0)}</span></div>
            </div>
        </div>
    );
};

export const InvoiceResults: React.FC<InvoiceResultsProps> = ({
    invoices,
    onReset,
    previewUrls,
    knowledgeBase,
    onAddToKnowledgeBase,
    onUpdateInvoice
}) => {
    const [currentPage, setCurrentPage] = useState(0);
    const [copied, setCopied] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [editingIndex, setEditingIndex] = useState<number>(-1);
    const { hasPermission } = useData();

    const verifiedCount = useMemo(() => invoices.filter(i => i.isVerified).length, [invoices]);
    const progress = invoices.length > 0 ? (verifiedCount / invoices.length) * 100 : 0;

    // --- Calculations for VAT Filing Summary ---
    const salesInvoices = useMemo(() => invoices.filter(i => i.invoiceType === 'sales'), [invoices]);
    const purchaseInvoices = useMemo(() => invoices.filter(i => i.invoiceType !== 'sales'), [invoices]);

    const salesSummary = useMemo(() => {
        const standardRatedSupplies = salesInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0);
        const outputTax = salesInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0);
        const zeroRatedSupplies = salesInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0);
        const exemptedSupplies = 0;
        // Total including VAT is defined as Standard Supplies + Output Tax per request for Sales Total Card
        const totalAmountIncludingVat = standardRatedSupplies + outputTax;

        return { standardRatedSupplies, outputTax, zeroRatedSupplies, exemptedSupplies, totalAmountIncludingVat };
    }, [salesInvoices]);

    const purchaseSummary = useMemo(() => {
        const standardRatedExpenses = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalBeforeTaxAED || 0), 0);
        const inputTax = purchaseInvoices.reduce((sum, inv) => sum + (inv.totalTaxAED || 0), 0);
        const zeroRatedExpenses = purchaseInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0);
        const exemptedExpenses = 0;
        // Total including VAT is defined as Standard Expenses + Input Tax per request for Purchase Total Card
        const totalAmountIncludingVat = standardRatedExpenses + inputTax;

        return { standardRatedExpenses, inputTax, zeroRatedExpenses, exemptedExpenses, totalAmountIncludingVat };
    }, [purchaseInvoices]);

    const vatReturn = useMemo(() => {
        // VAT Return Form Logic
        // Sales Side
        const salesTotalAmount = salesSummary.standardRatedSupplies + salesSummary.zeroRatedSupplies + salesSummary.exemptedSupplies;
        const salesTotalVat = salesSummary.outputTax;

        // Purchase Side
        const expensesTotalAmount = purchaseSummary.standardRatedExpenses + purchaseSummary.zeroRatedExpenses + purchaseSummary.exemptedExpenses;
        const expensesTotalVat = purchaseSummary.inputTax;

        // Net VAT Logic
        const dueTax = salesTotalVat;
        const recoverableTax = expensesTotalVat;
        const payableTax = dueTax; // As per specific requirement
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

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, previewUrls.length - 1));
    };

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 0));
    };

    const handleEdit = (invoice: Invoice, index: number) => {
        setEditingInvoice(invoice);
        setEditingIndex(index);
    };

    const handleSaveEdit = (updatedInvoice: Invoice) => {
        if (editingIndex !== -1) {
            onUpdateInvoice(editingIndex, { ...updatedInvoice, isVerified: true });
        }
        setEditingInvoice(null);
        setEditingIndex(-1);
    };

    const handleVerify = (index: number) => {
        const invoice = invoices[index];
        onUpdateInvoice(index, { ...invoice, isVerified: !invoice.isVerified });
    };

    const handleExportExcel = useCallback(() => {
        const workbook = XLSX.utils.book_new();
        const numberFormat = '#,##0.00';

        // 1. VAT Return Sheet
        const vatReturnData = [
            ["VAT RETURN SUMMARY"],
            [""],
            ["VAT ON SALES AND ALL OTHER OUTPUTS", "AMOUNT (AED)", "VAT AMOUNT (AED)"],
            ["Standard Rated Supplies", salesSummary.standardRatedSupplies, salesSummary.outputTax],
            ["Reverse Charge Provisions (Supplies)", 0, 0],
            ["Zero Rated Supplies", salesSummary.zeroRatedSupplies, 0],
            ["Exempted Supplies", salesSummary.exemptedSupplies, 0],
            ["Goods Imported into UAE", 0, 0],
            ["TOTAL AMOUNT", vatReturn.sales.totalAmount, vatReturn.sales.totalVat],
            [""],
            ["VAT ON EXPENSES AND ALL OTHER INPUTS", "AMOUNT (AED)", "VAT AMOUNT (AED)"],
            ["Standard Rated Expenses", purchaseSummary.standardRatedExpenses, purchaseSummary.inputTax],
            ["Reverse Charge Provisions (Expenses)", 0, 0],
            ["TOTAL AMOUNT", vatReturn.expenses.totalAmount, vatReturn.expenses.totalVat],
            [""],
            ["NET VAT VALUE", "AMOUNT (AED)"],
            ["Total Value of due tax for the period", vatReturn.net.dueTax],
            ["Total Value of recoverable tax for the period", vatReturn.net.recoverableTax],
            ["VAT Payable for the Period", vatReturn.net.payableTax],
            ["Fund Available FTA", 0],
            ["NET VAT PAYABLE FOR THE PERIOD", vatReturn.net.netVatPayable]
        ];

        const vatSheet = XLSX.utils.aoa_to_sheet(vatReturnData);
        vatSheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, vatSheet, "VAT Return");

        // 2. Sales Invoices Sheet
        if (salesInvoices.length > 0) {
            const salesData = salesInvoices.map((inv) => ({
                Date: formatDate(inv.invoiceDate),
                "Invoice Number": inv.invoiceId,
                "Supplier/Vendor": inv.vendorName,
                "Party": inv.customerName,
                "Customer TRN": inv.customerTrn,
                "Currency": inv.currency,
                "Before Tax Amount": inv.totalBeforeTax || 0,
                "VAT": inv.totalTax || 0,
                "Zero Rated": inv.zeroRated || 0,
                "Net Amount": inv.totalAmount,
                "Before Tax Amount (AED)": inv.totalBeforeTaxAED || 0,
                "VAT (AED)": inv.totalTaxAED || 0,
                "Zero Rated (AED)": inv.zeroRatedAED || 0,
                "Net Amount (AED)": inv.totalAmountAED || 0,
                "Confidence": inv.confidence ? `${inv.confidence}%` : "N/A"
            }));

            const salesWorksheet = XLSX.utils.json_to_sheet(salesData);
            const range = XLSX.utils.decode_range(salesWorksheet['!ref'] || "A1:A1");
            for (let R = 1; R <= range.e.r; ++R) {
                ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
                    const cellRef = `${col}${R + 1}`;
                    if (salesWorksheet[cellRef]) salesWorksheet[cellRef].z = numberFormat;
                });
            }
            // Set column widths
            salesWorksheet['!cols'] = [
                { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
                { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
                { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 10 }
            ];
            XLSX.utils.book_append_sheet(workbook, salesWorksheet, "Sales Invoices");
        }

        // 3. Purchase Invoices Sheet
        if (purchaseInvoices.length > 0) {
            const purchaseData = purchaseInvoices.map((inv) => ({
                Date: formatDate(inv.invoiceDate),
                "Invoice Number": inv.invoiceId,
                "Supplier/Vendor": inv.vendorName,
                "Party": inv.customerName,
                "Supplier TRN": inv.vendorTrn,
                "Currency": inv.currency,
                "Before Tax Amount": inv.totalBeforeTax || 0,
                "VAT": inv.totalTax || 0,
                "Zero Rated": inv.zeroRated || 0,
                "Net Amount": inv.totalAmount,
                "Before Tax Amount (AED)": inv.totalBeforeTaxAED || 0,
                "VAT (AED)": inv.totalTaxAED || 0,
                "Zero Rated (AED)": inv.zeroRatedAED || 0,
                "Net Amount (AED)": inv.totalAmountAED || 0,
                "Confidence": inv.confidence ? `${inv.confidence}%` : "N/A"
            }));

            const purchaseWorksheet = XLSX.utils.json_to_sheet(purchaseData);
            const range = XLSX.utils.decode_range(purchaseWorksheet['!ref'] || "A1:A1");
            for (let R = 1; R <= range.e.r; ++R) {
                ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].forEach(col => {
                    const cellRef = `${col}${R + 1}`;
                    if (purchaseWorksheet[cellRef]) purchaseWorksheet[cellRef].z = numberFormat;
                });
            }
            purchaseWorksheet['!cols'] = [
                { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 },
                { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
                { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 10 }
            ];
            XLSX.utils.book_append_sheet(workbook, purchaseWorksheet, "Purchase Invoices");
        }

        if (salesInvoices.length === 0 && purchaseInvoices.length === 0) {
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["No Data"]]), "Invoices");
        }

        XLSX.writeFile(workbook, 'VAT_Return_Export.xlsx');
    }, [invoices, salesInvoices, purchaseInvoices, vatReturn, salesSummary, purchaseSummary]);

    const copyToClipboard = useCallback(() => {
        try {
            const textToCopy = JSON.stringify(invoices, null, 2);
            navigator.clipboard.writeText(textToCopy).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            });
        } catch (e) {
            console.error("Failed to copy to clipboard", e);
        }
    }, [invoices]);

    const hasSales = salesInvoices.length > 0;
    const hasPurchases = purchaseInvoices.length > 0;

    return (
        <div>
            {/* Header & Actions - REMOVED */}
            {/* Verification Progress Bar - REMOVED */}

            {/* 1. Sales Invoices Summary Table */}
            {hasSales && (
                <div className="space-y-4 mb-8">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="font-semibold text-white">Sales Invoices Summary</h3>
                            <span className="text-xs font-semibold bg-blue-900/30 text-blue-300 px-2.5 py-0.5 rounded-full border border-blue-700/50">
                                {salesInvoices.length} Sales
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-400">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Invoice Number</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Supplier/Vendor</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Party</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Customer TRN</th>
                                        <th className="px-4 py-3 font-semibold text-center">Currency</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Before Tax Amount</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">VAT</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Zero Rated</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Net Amount</th>

                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">Before Tax (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">VAT (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">Zero Rated (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">Net Amount (AED)</th>

                                        <th className="px-4 py-3 font-semibold text-center">Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv, index) => {
                                        if (inv.invoiceType !== 'sales') return null;
                                        return (
                                            <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer" onClick={() => document.getElementById(`invoice-card-${index}`)?.scrollIntoView({ behavior: 'smooth' })}>
                                                <td className="px-4 py-3 whitespace-nowrap text-white">{formatDate(inv.invoiceDate)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.invoiceId}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.vendorName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.customerName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.customerTrn || '-'}</td>
                                                <td className="px-4 py-3 text-center">{inv.currency}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatNumber(inv.totalBeforeTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatNumber(inv.totalTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatNumber(inv.zeroRated || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-white font-semibold">{formatNumber(inv.totalAmount)}</td>

                                                <td className="px-4 py-3 text-right font-mono text-blue-200">{formatNumber(inv.totalBeforeTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-200">{formatNumber(inv.totalTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-200">{formatNumber(inv.zeroRatedAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-100 font-semibold">{formatNumber(inv.totalAmountAED || 0)}</td>

                                                <td className={`px-4 py-3 text-center font-mono font-semibold ${inv.confidence ? getConfidenceTextColor(inv.confidence) : 'text-gray-500'}`}>
                                                    {inv.confidence ? `${inv.confidence}%` : 'N/A'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Purchase Invoices Summary Table */}
            {hasPurchases && (
                <div className="space-y-4 mb-8">
                    <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                            <h3 className="font-semibold text-white">Purchase Invoices Summary</h3>
                            <span className="text-xs font-semibold bg-orange-900/30 text-orange-300 px-2.5 py-0.5 rounded-full border border-orange-700/50">
                                {purchaseInvoices.length} Purchases
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-400">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Date</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Invoice Number</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Supplier/Vendor</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Party</th>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Supplier TRN</th>
                                        <th className="px-4 py-3 font-semibold text-center">Currency</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Before Tax Amount</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">VAT</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Zero Rated</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Net Amount</th>

                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">Before Tax (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">VAT (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">Zero Rated (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-blue-300">Net Amount (AED)</th>

                                        <th className="px-4 py-3 font-semibold text-center">Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv, index) => {
                                        if (inv.invoiceType === 'sales') return null;
                                        return (
                                            <tr key={index} className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer" onClick={() => document.getElementById(`invoice-card-${index}`)?.scrollIntoView({ behavior: 'smooth' })}>
                                                <td className="px-4 py-3 whitespace-nowrap text-white">{formatDate(inv.invoiceDate)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.invoiceId}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.vendorName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.customerName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.vendorTrn || '-'}</td>
                                                <td className="px-4 py-3 text-center">{inv.currency}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatNumber(inv.totalBeforeTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatNumber(inv.totalTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-gray-300">{formatNumber(inv.zeroRated || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-white font-semibold">{formatNumber(inv.totalAmount)}</td>

                                                <td className="px-4 py-3 text-right font-mono text-blue-200">{formatNumber(inv.totalBeforeTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-200">{formatNumber(inv.totalTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-200">{formatNumber(inv.zeroRatedAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-100 font-semibold">{formatNumber(inv.totalAmountAED || 0)}</td>

                                                <td className={`px-4 py-3 text-center font-mono font-semibold ${inv.confidence ? getConfidenceTextColor(inv.confidence) : 'text-gray-500'}`}>
                                                    {inv.confidence ? `${inv.confidence}%` : 'N/A'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Document Preview & Invoice Items */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                <div className="lg:col-span-1">
                    <div className="flex justify-between items-center mb-3 px-2">
                        <h3 className="text-base font-semibold text-gray-300">Document Preview</h3>
                        {previewUrls.length > 1 && (
                            <span className="text-sm text-gray-500 font-mono">
                                {currentPage + 1} / {previewUrls.length}
                            </span>
                        )}
                    </div>
                    <div className="p-2 bg-black rounded-lg relative shadow-sm border border-gray-700 sticky top-6">
                        <img src={previewUrls[currentPage]} alt={`Document Preview Page ${currentPage + 1}`} className="rounded-md object-contain max-h-[70vh] w-full" />
                        {previewUrls.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevPage}
                                    disabled={currentPage === 0}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-gray-700/70 rounded-full text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    aria-label="Previous page"
                                >
                                    <ChevronLeftIcon className="w-6 h-6" />
                                </button>
                                <button
                                    onClick={handleNextPage}
                                    disabled={currentPage === previewUrls.length - 1}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-gray-700/70 rounded-full text-white hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    aria-label="Next page"
                                >
                                    <ChevronRightIcon className="w-6 h-6" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                    {invoices.map((invoice, index) => (
                        <div key={index} id={`invoice-card-${index}`}>
                            <InvoiceItem
                                index={index}
                                invoice={invoice}
                                onEdit={handleEdit}
                                knowledgeBase={knowledgeBase}
                                onAddToKnowledgeBase={onAddToKnowledgeBase}
                                onVerify={handleVerify}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* 4 & 5. Sales & Purchase Totals */}
            {(hasSales || hasPurchases) && (
                <div className="space-y-8 mb-8">
                    {hasSales && (
                        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                            <div className="flex items-center mb-4">
                                <BanknotesIcon className="w-6 h-6 text-blue-400 mr-2" />
                                <h3 className="text-xl font-bold text-white">Sales Total</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Standard Rated Supplies</p>
                                    <p className="text-lg font-mono font-bold text-white">{formatNumber(salesSummary.standardRatedSupplies)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Output Tax</p>
                                    <p className="text-lg font-mono font-bold text-blue-400">{formatNumber(salesSummary.outputTax)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Zero Rated Supplies</p>
                                    <p className="text-lg font-mono font-bold text-white">{formatNumber(salesSummary.zeroRatedSupplies)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Exempted Supplies</p>
                                    <p className="text-lg font-mono font-bold text-white">{formatNumber(salesSummary.exemptedSupplies)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 bg-blue-900/10">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Amount (Inc. VAT)</p>
                                    <p className="text-lg font-mono font-bold text-green-400">{formatNumber(salesSummary.totalAmountIncludingVat)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Standard + Output Tax</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {hasPurchases && (
                        <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                            <div className="flex items-center mb-4">
                                <BriefcaseIcon className="w-6 h-6 text-orange-400 mr-2" />
                                <h3 className="text-xl font-bold text-white">Purchase Total</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Standard Rated Expenses</p>
                                    <p className="text-lg font-mono font-bold text-white">{formatNumber(purchaseSummary.standardRatedExpenses)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Input Tax</p>
                                    <p className="text-lg font-mono font-bold text-blue-400">{formatNumber(purchaseSummary.inputTax)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Zero Rated Expenses</p>
                                    <p className="text-lg font-mono font-bold text-white">{formatNumber(purchaseSummary.zeroRatedExpenses)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Exempted Expenses</p>
                                    <p className="text-lg font-mono font-bold text-white">{formatNumber(purchaseSummary.exemptedExpenses)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">AED</p>
                                </div>
                                <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 bg-orange-900/10">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Amount (Inc. VAT)</p>
                                    <p className="text-lg font-mono font-bold text-green-400">{formatNumber(purchaseSummary.totalAmountIncludingVat)}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">Standard + Input Tax</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 6. VAT Summary */}
            {(hasSales || hasPurchases) && (
                <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6 mb-8">
                    <div className="flex items-center mb-6 border-b border-gray-800 pb-4">
                        <ChartBarIcon className="w-6 h-6 text-indigo-400 mr-2" />
                        <h3 className="text-xl font-bold text-white">VAT Summary</h3>
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
                                    <span className="text-white font-mono">{formatNumber(salesSummary.standardRatedSupplies)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Output Tax</span>
                                    <span className="text-blue-400 font-mono font-bold">{formatNumber(salesSummary.outputTax)} AED</span>
                                </div>
                                <div className="pt-2 border-t border-gray-700 flex justify-between text-sm">
                                    <span className="text-gray-300">Total (Std + Tax)</span>
                                    <span className="text-white font-mono font-bold">{formatNumber(salesSummary.totalAmountIncludingVat)} AED</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-gray-400">Zero Rated Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(salesSummary.zeroRatedSupplies)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Exempted Supplies</span>
                                    <span className="text-white font-mono">0.00 AED</span>
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
                                    <span className="text-white font-mono">{formatNumber(purchaseSummary.standardRatedExpenses)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Input Tax</span>
                                    <span className="text-blue-400 font-mono font-bold">{formatNumber(purchaseSummary.inputTax)} AED</span>
                                </div>
                                <div className="pt-2 border-t border-gray-700 flex justify-between text-sm">
                                    <span className="text-gray-300">Total (Std + Tax)</span>
                                    <span className="text-white font-mono font-bold">{formatNumber(purchaseSummary.totalAmountIncludingVat)} AED</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-gray-400">Zero Rated Supplies</span>
                                    <span className="text-white font-mono">{formatNumber(purchaseSummary.zeroRatedExpenses)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Exempted Supplies</span>
                                    <span className="text-white font-mono">0.00 AED</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Payable Column */}
                        <div className="bg-gray-800/80 rounded-lg p-5 border border-gray-700 flex flex-col justify-center">
                            <h4 className="text-sm font-bold text-gray-300 uppercase mb-4 text-center">Net VAT Position</h4>
                            <div className="text-center space-y-2">
                                <p className="text-gray-400 text-sm">Output Tax - Input Tax</p>
                                <div className={`text-3xl font-mono font-bold ${vatReturn.net.netVatPayable >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatNumber(vatReturn.net.netVatPayable)} <span className="text-lg text-gray-500 font-normal">AED</span>
                                </div>
                                <p className="text-xs text-gray-500 uppercase tracking-wider">
                                    {vatReturn.net.netVatPayable >= 0 ? 'Net VAT Payable' : 'Net VAT Refundable'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. VAT Return Detailed Table */}
            {(hasSales || hasPurchases) && (
                <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm p-6">
                    <div className="flex items-center mb-6 border-b border-gray-800 pb-4">
                        <ChartPieIcon className="w-6 h-6 text-purple-400 mr-2" />
                        <h3 className="text-xl font-bold text-white">VAT Return</h3>
                    </div>

                    {/* VAT on Sales Section */}
                    <div className="mb-8">
                        <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 px-2 border-l-4 border-blue-500">
                            VAT on Sales and All Other Outputs
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-gray-700">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">Description</th>
                                        <th className="px-6 py-3 text-right">Amount (AED)</th>
                                        <th className="px-6 py-3 text-right">VAT Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-gray-900/50">
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Standard Rated Supplies</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(salesSummary.standardRatedSupplies)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(salesSummary.outputTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Reverse Charge Provisions (Supplies)</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Zero Rated Supplies</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(salesSummary.zeroRatedSupplies)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Exempted Supplies</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(salesSummary.exemptedSupplies)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Goods Imported into UAE</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                    </tr>
                                    <tr className="bg-gray-800 font-bold">
                                        <td className="px-6 py-3 text-white">Total Amount</td>
                                        <td className="px-6 py-3 text-right font-mono text-blue-400">{formatNumber(vatReturn.sales.totalAmount)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-blue-400">{formatNumber(vatReturn.sales.totalVat)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* VAT on Expenses Section */}
                    <div className="mb-8">
                        <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 px-2 border-l-4 border-orange-500">
                            VAT on Expenses and All Other Inputs
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-gray-700">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">Description</th>
                                        <th className="px-6 py-3 text-right">Amount (AED)</th>
                                        <th className="px-6 py-3 text-right">VAT Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-gray-900/50">
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Standard Rated Expenses</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(purchaseSummary.standardRatedExpenses)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(purchaseSummary.inputTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Reverse Charge Provisions (Expenses)</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                    </tr>
                                    <tr className="bg-gray-800 font-bold">
                                        <td className="px-6 py-3 text-white">Total Amount</td>
                                        <td className="px-6 py-3 text-right font-mono text-orange-400">{formatNumber(vatReturn.expenses.totalAmount)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-orange-400">{formatNumber(vatReturn.expenses.totalVat)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Net VAT Value Section */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 px-2 border-l-4 border-green-500">
                            Net VAT Value
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-gray-700">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr>
                                        <th className="px-6 py-3 w-2/3">Description</th>
                                        <th className="px-6 py-3 text-right">Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-gray-900/50">
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Total Value of due tax for the period</td>
                                        <td className="px-6 py-3 text-right font-mono text-white font-bold">{formatNumber(vatReturn.net.dueTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Total Value of recoverable tax for the period</td>
                                        <td className="px-6 py-3 text-right font-mono text-white font-bold">{formatNumber(vatReturn.net.recoverableTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">VAT Payable for the Period</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">{formatNumber(vatReturn.net.payableTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-gray-300">Fund Available FTA</td>
                                        <td className="px-6 py-3 text-right font-mono text-white">0.00</td>
                                    </tr>
                                    <tr className="bg-gray-800">
                                        <td className="px-6 py-4 text-white font-bold uppercase">Net VAT Payable for the Period</td>
                                        <td className={`px-6 py-4 text-right font-mono text-xl font-bold ${vatReturn.net.netVatPayable >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {formatNumber(vatReturn.net.netVatPayable)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {editingInvoice && (
                <InvoiceEditModal
                    invoice={editingInvoice}
                    onSave={handleSaveEdit}
                    onClose={() => setEditingInvoice(null)}
                />
            )}
        </div>
    );
};
