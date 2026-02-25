
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
    visibleSections?: InvoiceResultsSection[];
    showExportButton?: boolean;
}

export type InvoiceResultsSection =
    | 'sales'
    | 'purchase'
    | 'documents'
    | 'salesTotal'
    | 'purchaseTotal'
    | 'vatSummary'
    | 'vatReturn';

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

const getInvoiceConfidence = (invoice: Invoice): number | null => {
    const raw = (invoice as Invoice & { confidence?: number | string | null }).confidence;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.min(100, Math.round(parsed)));
};

const getConfidenceLevel = (score: number) => {
    if (score >= 80) return { label: 'High', color: 'bg-green-500/10 text-green-500 border-green-500/20', icon: CheckIcon };
    if (score >= 50) return { label: 'Medium', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: ExclamationTriangleIcon };
    return { label: 'Low', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: ExclamationTriangleIcon };
};

const getConfidenceTextColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-destructive';
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

    const normalizedConfidence = getInvoiceConfidence(invoice);
    const confidenceInfo = normalizedConfidence !== null ? getConfidenceLevel(normalizedConfidence) : null;

    return (
        <div className={`bg-card rounded-xl border overflow-hidden shadow-sm group transition-all duration-300 ${invoice.isVerified ? 'border-green-500/50 ring-1 ring-green-500/20' : 'border-border'}`}>
            <div className="p-4 bg-muted/50 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h3 className="font-semibold text-foreground">Invoice: {invoice.invoiceId}</h3>
                            {invoice.invoiceType === 'sales' ? (
                                <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">Sales</span>
                            ) : (
                                <span className="text-xs font-semibold bg-orange-500/10 text-orange-500 px-2.5 py-0.5 rounded-full border border-orange-500/20">Purchase</span>
                            )}
                            {invoice.isVerified && (
                                <span className="flex items-center text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                    <CheckIcon className="w-3 h-3 mr-1" /> Verified
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {invoice.invoiceType === 'sales' ? `To: ${invoice.customerName}` : `From: ${invoice.vendorName}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {confidenceInfo && (
                        <div className={`flex items-center px-3 py-1 rounded-full border text-xs font-medium ${confidenceInfo.color}`}>
                            <confidenceInfo.icon className="w-3.5 h-3.5 mr-1.5" />
                            {confidenceInfo.label} ({normalizedConfidence}%)
                        </div>
                    )}

                    <div className="h-6 w-px bg-border mx-1"></div>

                    <button
                        onClick={() => onVerify(index)}
                        className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${invoice.isVerified
                            ? 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20'
                            : 'bg-muted text-foreground border-border hover:bg-green-600 hover:border-green-600 hover:text-white'
                            }`}
                        title={invoice.isVerified ? "Unverify" : "Mark as Verified"}
                    >
                        {invoice.isVerified ? 'Verified' : 'Verify'}
                    </button>

                    <button
                        onClick={() => onEdit(invoice, index)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
                <div><span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Entity</span> {invoice.invoiceType === 'sales' ? invoice.customerName : invoice.vendorName}</div>
                <div><span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Date</span> {formatDate(invoice.invoiceDate)}</div>
                <div><span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Net Amount (AED)</span> {formatNumber(invoice.totalBeforeTaxAED || 0)}</div>
                <div><span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Tax Amount (AED)</span> {formatNumber(invoice.totalTaxAED || 0)}</div>
                <div><span className="font-semibold text-muted-foreground block text-xs uppercase mb-1">Total (AED)</span> <span className="text-foreground font-bold">{formatNumber(invoice.totalAmountAED || 0)}</span></div>
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
    onUpdateInvoice,
    visibleSections,
    showExportButton = true
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
        const amountColumns = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'];

        const buildInvoiceWorksheet = (items: Invoice[], isSales: boolean) => {
            const sheetName = isSales ? "Sales Invoices Summary" : "Purchase Invoices Summary";
            const trnHeader = isSales ? "Customer TRN" : "Supplier TRN";
            const headers = [
                "Date",
                "Invoice Number",
                "Supplier/Vendor",
                "Party",
                trnHeader,
                "Currency",
                "Before Tax Amount",
                "VAT",
                "Zero Rated",
                "Net Amount",
                "Before Tax Amount (AED)",
                "VAT (AED)",
                "Zero Rated (AED)",
                "Net Amount (AED)",
                "Confidence"
            ];

            if (items.length === 0) {
                const placeholder = XLSX.utils.aoa_to_sheet([
                    headers,
                    new Array(headers.length).fill(""),
                    ["No invoices captured for this section yet.", ...new Array(headers.length - 1).fill("")]
                ]);
                placeholder['!cols'] = headers.map(() => ({ wch: 18 }));
                return { sheet: placeholder, name: sheetName };
            }

            const rows = items.map((inv) => ({
                Date: formatDate(inv.invoiceDate),
                "Invoice Number": inv.invoiceId,
                "Supplier/Vendor": inv.vendorName,
                Party: inv.customerName,
                [trnHeader]: isSales ? inv.customerTrn : inv.vendorTrn,
                Currency: inv.currency,
                "Before Tax Amount": inv.totalBeforeTax || 0,
                VAT: inv.totalTax || 0,
                "Zero Rated": inv.zeroRated || 0,
                "Net Amount": inv.totalAmount,
                "Before Tax Amount (AED)": inv.totalBeforeTaxAED || 0,
                "VAT (AED)": inv.totalTaxAED || 0,
                "Zero Rated (AED)": inv.zeroRatedAED || 0,
                "Net Amount (AED)": inv.totalAmountAED || 0,
                Confidence: getInvoiceConfidence(inv) !== null ? `${getInvoiceConfidence(inv)}%` : "N/A"
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
            const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1:A1");
            for (let R = 1; R <= range.e.r; ++R) {
                amountColumns.forEach(col => {
                    const cellRef = `${col}${R + 1}`;
                    if (worksheet[cellRef]) worksheet[cellRef].z = numberFormat;
                });
            }

            worksheet['!cols'] = [
                { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 },
                { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
                { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }
            ];

            return { sheet: worksheet, name: sheetName };
        };

        const salesWorksheetInfo = buildInvoiceWorksheet(salesInvoices, true);
        XLSX.utils.book_append_sheet(workbook, salesWorksheetInfo.sheet, salesWorksheetInfo.name);

        const purchaseWorksheetInfo = buildInvoiceWorksheet(purchaseInvoices, false);
        XLSX.utils.book_append_sheet(workbook, purchaseWorksheetInfo.sheet, purchaseWorksheetInfo.name);

        const salesTotalData = [
            ["Metric", "Amount (AED)"],
            ["Standard Rated Supplies", salesSummary.standardRatedSupplies],
            ["Output Tax", salesSummary.outputTax],
            ["Zero Rated Supplies", salesSummary.zeroRatedSupplies],
            ["Exempted Supplies", salesSummary.exemptedSupplies],
            ["Total Amount (Inc. VAT)", salesSummary.totalAmountIncludingVat]
        ];
        const salesTotalSheet = XLSX.utils.aoa_to_sheet(salesTotalData);
        salesTotalSheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, salesTotalSheet, "Sales Total");

        const purchaseTotalData = [
            ["Metric", "Amount (AED)"],
            ["Standard Rated Expenses", purchaseSummary.standardRatedExpenses],
            ["Input Tax", purchaseSummary.inputTax],
            ["Zero Rated Expenses", purchaseSummary.zeroRatedExpenses],
            ["Exempted Expenses", purchaseSummary.exemptedExpenses],
            ["Total Amount (Inc. VAT)", purchaseSummary.totalAmountIncludingVat]
        ];
        const purchaseTotalSheet = XLSX.utils.aoa_to_sheet(purchaseTotalData);
        purchaseTotalSheet['!cols'] = [{ wch: 40 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, purchaseTotalSheet, "Purchase Total");

        const vatSummaryData = [
            ["VAT Summary"],
            [],
            ["Sales (Outputs)", "Amount (AED)", "VAT Amount (AED)"],
            ["Standard Rated Supplies", salesSummary.standardRatedSupplies, salesSummary.outputTax],
            ["Reverse Charge Provisions (Supplies)", 0, 0],
            ["Zero Rated Supplies", salesSummary.zeroRatedSupplies, 0],
            ["Exempted Supplies", salesSummary.exemptedSupplies, 0],
            ["Goods Imported into UAE", 0, 0],
            ["Total Amount", vatReturn.sales.totalAmount, vatReturn.sales.totalVat],
            [],
            ["Expenses (Inputs)", "Amount (AED)", "VAT Amount (AED)"],
            ["Standard Rated Expenses", purchaseSummary.standardRatedExpenses, purchaseSummary.inputTax],
            ["Reverse Charge Provisions (Expenses)", 0, 0],
            ["Total Amount", vatReturn.expenses.totalAmount, vatReturn.expenses.totalVat],
            [],
            ["Net VAT Value", "Amount (AED)"],
            ["Total Value of due tax for the period", vatReturn.net.dueTax],
            ["Total Value of recoverable tax for the period", vatReturn.net.recoverableTax],
            ["VAT Payable for the Period", vatReturn.net.payableTax],
            ["Fund Available FTA", 0],
            ["NET VAT PAYABLE FOR THE PERIOD", vatReturn.net.netVatPayable]
        ];
        const vatSummarySheet = XLSX.utils.aoa_to_sheet(vatSummaryData);
        vatSummarySheet['!cols'] = [{ wch: 38 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, vatSummarySheet, "VAT Summary");

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
        const vatReturnSheet = XLSX.utils.aoa_to_sheet(vatReturnData);
        vatReturnSheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
        XLSX.utils.book_append_sheet(workbook, vatReturnSheet, "VAT Return");

        XLSX.writeFile(workbook, 'DocuFlow_Invoice_Report.xlsx');
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
    const isSectionVisible = useCallback((section: InvoiceResultsSection) => {
        return !visibleSections || visibleSections.includes(section);
    }, [visibleSections]);
    const showSalesSummarySection = hasSales && isSectionVisible('sales');
    const showPurchaseSummarySection = hasPurchases && isSectionVisible('purchase');
    const showDocumentsSection = isSectionVisible('documents');
    const showSalesTotalSection = hasSales && isSectionVisible('salesTotal');
    const showPurchaseTotalSection = hasPurchases && isSectionVisible('purchaseTotal');
    const showVatSummarySection = (hasSales || hasPurchases) && isSectionVisible('vatSummary');
    const showVatReturnSection = (hasSales || hasPurchases) && isSectionVisible('vatReturn');

    return (
        <div>
            {/* Header & Actions - REMOVED */}
            {/* Verification Progress Bar - REMOVED */}

            {showExportButton && (
                <div className="flex justify-end mb-6">
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={invoices.length === 0}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition ${invoices.length
                            ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                            : "bg-muted text-muted-foreground border-border cursor-not-allowed"
                            }`}
                        title="Download invoice and VAT summaries as Excel"
                    >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        <span>Download Excel</span>
                    </button>
                </div>
            )}

            {/* 1. Sales Invoices Summary Table */}
            {showSalesSummarySection && (
                <div className="space-y-4 mb-8">
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold text-foreground">Sales Invoices Summary</h3>
                            <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                                {salesInvoices.length} Sales
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-muted-foreground">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
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

                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Before Tax (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">VAT (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Zero Rated (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Net Amount (AED)</th>

                                        <th className="px-4 py-3 font-semibold text-center">Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv, index) => {
                                        if (inv.invoiceType !== 'sales') return null;
                                        return (
                                            <tr key={index} className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => document.getElementById(`invoice-card-${index}`)?.scrollIntoView({ behavior: 'smooth' })}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border bg-primary/10 text-primary border-primary/20">
                                                        Sales
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-foreground">{formatDate(inv.invoiceDate)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.invoiceId}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.vendorName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.customerName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.customerTrn || '-'}</td>
                                                <td className="px-4 py-3 text-center">{inv.currency}</td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatNumber(inv.totalBeforeTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatNumber(inv.totalTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatNumber(inv.zeroRated || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground font-semibold">{formatNumber(inv.totalAmount)}</td>

                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatNumber(inv.totalBeforeTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatNumber(inv.totalTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatNumber(inv.zeroRatedAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary font-semibold">{formatNumber(inv.totalAmountAED || 0)}</td>

                                                {(() => {
                                                    const confidence = getInvoiceConfidence(inv);
                                                    return (
                                                        <td className={`px-4 py-3 text-center font-mono font-semibold ${confidence !== null ? getConfidenceTextColor(confidence) : 'text-muted-foreground/60'}`}>
                                                            {confidence !== null ? `${confidence}%` : 'N/A'}
                                                        </td>
                                                    );
                                                })()}
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
            {showPurchaseSummarySection && (
                <div className="space-y-4 mb-8">
                    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center justify-between">
                            <h3 className="font-semibold text-foreground">Purchase Invoices Summary</h3>
                            <span className="text-xs font-semibold bg-orange-500/10 text-orange-500 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                                {purchaseInvoices.length} Purchases
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-muted-foreground">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold whitespace-nowrap">Type</th>
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

                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Before Tax (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">VAT (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Zero Rated (AED)</th>
                                        <th className="px-4 py-3 font-semibold text-right whitespace-nowrap text-primary/80">Net Amount (AED)</th>

                                        <th className="px-4 py-3 font-semibold text-center">Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv, index) => {
                                        if (inv.invoiceType === 'sales') return null;
                                        return (
                                            <tr key={index} className="border-b border-border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => document.getElementById(`invoice-card-${index}`)?.scrollIntoView({ behavior: 'smooth' })}>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-semibold border bg-orange-500/10 text-orange-500 border-orange-500/20">
                                                        Purchase
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-foreground">{formatDate(inv.invoiceDate)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.invoiceId}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.vendorName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.customerName}</td>
                                                <td className="px-4 py-3 whitespace-nowrap">{inv.vendorTrn || '-'}</td>
                                                <td className="px-4 py-3 text-center">{inv.currency}</td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatNumber(inv.totalBeforeTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatNumber(inv.totalTax || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatNumber(inv.zeroRated || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground font-semibold">{formatNumber(inv.totalAmount)}</td>

                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatNumber(inv.totalBeforeTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatNumber(inv.totalTaxAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary/80">{formatNumber(inv.zeroRatedAED || 0)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-primary font-semibold">{formatNumber(inv.totalAmountAED || 0)}</td>

                                                {(() => {
                                                    const confidence = getInvoiceConfidence(inv);
                                                    return (
                                                        <td className={`px-4 py-3 text-center font-mono font-semibold ${confidence !== null ? getConfidenceTextColor(confidence) : 'text-muted-foreground/60'}`}>
                                                            {confidence !== null ? `${confidence}%` : 'N/A'}
                                                        </td>
                                                    );
                                                })()}
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
            {showDocumentsSection && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
                    <div className="lg:col-span-1">
                        <div className="flex justify-between items-center mb-3 px-2">
                            <h3 className="text-base font-semibold text-muted-foreground">Document Preview</h3>
                            {previewUrls.length > 1 && (
                                <span className="text-sm text-muted-foreground/60 font-mono">
                                    {currentPage + 1} / {previewUrls.length}
                                </span>
                            )}
                        </div>
                        <div className="p-2 bg-background rounded-lg relative shadow-sm border border-border sticky top-6">
                            {previewUrls.length > 0 ? (
                                <img src={previewUrls[currentPage]} alt={`Document Preview Page ${currentPage + 1}`} className="rounded-md object-contain max-h-[70vh] w-full" />
                            ) : (
                                <div className="rounded-md border border-dashed border-border min-h-[280px] flex items-center justify-center text-sm text-muted-foreground bg-muted/30">
                                    No document preview available
                                </div>
                            )}
                            {previewUrls.length > 1 && (
                                <>
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 0}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-background/50 rounded-full text-foreground hover:bg-background/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeftIcon className="w-6 h-6" />
                                    </button>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === previewUrls.length - 1}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-background/50 rounded-full text-foreground hover:bg-background/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
            )}

            {/* 4 & 5. Sales & Purchase Totals */}
            {(showSalesTotalSection || showPurchaseTotalSection) && (
                <div className="space-y-8 mb-8">
                    {showSalesTotalSection && (
                        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                            <div className="flex items-center mb-4">
                                <BanknotesIcon className="w-6 h-6 text-primary mr-2" />
                                <h3 className="text-xl font-bold text-foreground">Sales Total</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Standard Rated Supplies</p>
                                    <p className="text-lg font-mono font-bold text-foreground">{formatNumber(salesSummary.standardRatedSupplies)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output Tax</p>
                                    <p className="text-lg font-mono font-bold text-primary">{formatNumber(salesSummary.outputTax)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Zero Rated Supplies</p>
                                    <p className="text-lg font-mono font-bold text-foreground">{formatNumber(salesSummary.zeroRatedSupplies)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Exempted Supplies</p>
                                    <p className="text-lg font-mono font-bold text-foreground">{formatNumber(salesSummary.exemptedSupplies)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border bg-primary/10">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Amount (Inc. VAT)</p>
                                    <p className="text-lg font-mono font-bold text-green-500">{formatNumber(salesSummary.totalAmountIncludingVat)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">Standard + Output Tax</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {showPurchaseTotalSection && (
                        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                            <div className="flex items-center mb-4">
                                <BriefcaseIcon className="w-6 h-6 text-orange-500 mr-2" />
                                <h3 className="text-xl font-bold text-foreground">Purchase Total</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Standard Rated Expenses</p>
                                    <p className="text-lg font-mono font-bold text-foreground">{formatNumber(purchaseSummary.standardRatedExpenses)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Input Tax</p>
                                    <p className="text-lg font-mono font-bold text-primary">{formatNumber(purchaseSummary.inputTax)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Zero Rated Expenses</p>
                                    <p className="text-lg font-mono font-bold text-foreground">{formatNumber(purchaseSummary.zeroRatedExpenses)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Exempted Expenses</p>
                                    <p className="text-lg font-mono font-bold text-foreground">{formatNumber(purchaseSummary.exemptedExpenses)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">AED</p>
                                </div>
                                <div className="bg-muted p-3 rounded-lg border border-border bg-orange-500/10">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Amount (Inc. VAT)</p>
                                    <p className="text-lg font-mono font-bold text-green-500">{formatNumber(purchaseSummary.totalAmountIncludingVat)}</p>
                                    <p className="text-[10px] text-muted-foreground/60 mt-1">Standard + Input Tax</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 6. VAT Summary */}
            {showVatSummarySection && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-6 mb-8">
                    <div className="flex items-center mb-6 border-b border-border pb-4">
                        <ChartBarIcon className="w-6 h-6 text-primary mr-2" />
                        <h3 className="text-xl font-bold text-foreground">VAT Summary</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Sales Column */}
                        <div className="bg-muted/50 rounded-lg p-5 border border-border">
                            <h4 className="flex items-center text-sm font-bold text-primary uppercase mb-4">
                                <BanknotesIcon className="w-4 h-4 mr-2" /> Sales (Outputs)
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Standard Rated Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(salesSummary.standardRatedSupplies)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Output Tax</span>
                                    <span className="text-primary font-mono font-bold">{formatNumber(salesSummary.outputTax)} AED</span>
                                </div>
                                <div className="pt-2 border-t border-border flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total (Std + Tax)</span>
                                    <span className="text-foreground font-mono font-bold">{formatNumber(salesSummary.totalAmountIncludingVat)} AED</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-muted-foreground">Zero Rated Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(salesSummary.zeroRatedSupplies)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Exempted Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(salesSummary.exemptedSupplies || 0)} AED</span>
                                </div>
                            </div>
                        </div>

                        {/* Purchase Column */}
                        <div className="bg-muted/50 rounded-lg p-5 border border-border">
                            <h4 className="flex items-center text-sm font-bold text-orange-500 uppercase mb-4">
                                <BriefcaseIcon className="w-4 h-4 mr-2" /> Purchase (Inputs)
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Standard Rated Expenses</span>
                                    <span className="text-foreground font-mono">{formatNumber(purchaseSummary.standardRatedExpenses)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Input Tax</span>
                                    <span className="text-primary font-mono font-bold">{formatNumber(purchaseSummary.inputTax)} AED</span>
                                </div>
                                <div className="pt-2 border-t border-border flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total (Std + Tax)</span>
                                    <span className="text-foreground font-mono font-bold">{formatNumber(purchaseSummary.totalAmountIncludingVat)} AED</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-muted-foreground">Zero Rated Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(purchaseSummary.zeroRatedExpenses)} AED</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Exempted Expenses</span>
                                    <span className="text-foreground font-mono">{formatNumber(purchaseSummary.exemptedExpenses || 0)} AED</span>
                                </div>
                            </div>
                        </div>

                        {/* Net Payable Column */}
                        <div className="bg-muted/80 rounded-lg p-5 border border-border flex flex-col justify-center">
                            <h4 className="text-sm font-bold text-muted-foreground uppercase mb-4 text-center">Net VAT Position</h4>
                            <div className="text-center space-y-2">
                                <p className="text-muted-foreground text-sm">Output Tax - Input Tax</p>
                                <div className={`text-3xl font-mono font-bold ${vatReturn.net.netVatPayable >= 0 ? 'text-green-500' : 'text-destructive'}`}>
                                    {formatNumber(vatReturn.net.netVatPayable)} <span className="text-lg text-muted-foreground/60 font-normal">AED</span>
                                </div>
                                <p className="text-xs text-muted-foreground/60 uppercase tracking-wider">
                                    {vatReturn.net.netVatPayable >= 0 ? 'Net VAT Payable' : 'Net VAT Refundable'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. VAT Return Detailed Table */}
            {showVatReturnSection && (
                <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center mb-6 border-b border-border pb-4">
                        <ChartPieIcon className="w-6 h-6 text-purple-500 mr-2" />
                        <h3 className="text-xl font-bold text-foreground">VAT Return</h3>
                    </div>

                    {/* VAT on Sales Section */}
                    <div className="mb-8">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2 border-l-4 border-primary">
                            VAT on Sales and All Other Outputs
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">Description</th>
                                        <th className="px-6 py-3 text-right">Amount (AED)</th>
                                        <th className="px-6 py-3 text-right">VAT Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card/50">
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Standard Rated Supplies</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(salesSummary.standardRatedSupplies)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(salesSummary.outputTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Reverse Charge Provisions (Supplies)</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Zero Rated Supplies</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(salesSummary.zeroRatedSupplies)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Exempted Supplies</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(salesSummary.exemptedSupplies)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Goods Imported into UAE</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                    </tr>
                                    <tr className="bg-muted font-bold text-foreground">
                                        <td className="px-6 py-3">Total Amount</td>
                                        <td className="px-6 py-3 text-right font-mono text-primary">{formatNumber(vatReturn.sales.totalAmount)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-primary">{formatNumber(vatReturn.sales.totalVat)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* VAT on Expenses Section */}
                    <div className="mb-8">
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2 border-l-4 border-orange-500">
                            VAT on Expenses and All Other Inputs
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                                    <tr>
                                        <th className="px-6 py-3 w-1/2">Description</th>
                                        <th className="px-6 py-3 text-right">Amount (AED)</th>
                                        <th className="px-6 py-3 text-right">VAT Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card/50">
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Standard Rated Expenses</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(purchaseSummary.standardRatedExpenses)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(purchaseSummary.inputTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Reverse Charge Provisions (Expenses)</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                    </tr>
                                    <tr className="bg-muted font-bold text-foreground">
                                        <td className="px-6 py-3">Total Amount</td>
                                        <td className="px-6 py-3 text-right font-mono text-orange-500">{formatNumber(vatReturn.expenses.totalAmount)}</td>
                                        <td className="px-6 py-3 text-right font-mono text-orange-500">{formatNumber(vatReturn.expenses.totalVat)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Net VAT Value Section */}
                    <div>
                        <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 px-2 border-l-4 border-green-500">
                            Net VAT Value
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-muted/80">
                                    <tr>
                                        <th className="px-6 py-3 w-2/3">Description</th>
                                        <th className="px-6 py-3 text-right">Amount (AED)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border bg-card/50">
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Total Value of due tax for the period</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground font-bold">{formatNumber(vatReturn.net.dueTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Total Value of recoverable tax for the period</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground font-bold">{formatNumber(vatReturn.net.recoverableTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">VAT Payable for the Period</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">{formatNumber(vatReturn.net.payableTax)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 text-muted-foreground">Fund Available FTA</td>
                                        <td className="px-6 py-3 text-right font-mono text-foreground">0.00</td>
                                    </tr>
                                    <tr className="bg-muted">
                                        <td className="px-6 py-4 text-foreground font-bold uppercase">Net VAT Payable for the Period</td>
                                        <td className={`px-6 py-4 text-right font-mono text-xl font-bold ${vatReturn.net.netVatPayable >= 0 ? 'text-green-500' : 'text-destructive'}`}>
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
