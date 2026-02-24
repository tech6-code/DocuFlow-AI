import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice } from "../types";
import { BanknotesIcon, BriefcaseIcon } from "./icons";

interface InvoiceSummarizationViewProps {
    salesInvoices: Invoice[];
    purchaseInvoices: Invoice[];
    currency: string;
    companyName: string;
    companyTrn?: string;
    onSalesInvoicesChange?: (invoices: Invoice[]) => void;
    onPurchaseInvoicesChange?: (invoices: Invoice[]) => void;
}

const formatNumber = (amount: number) => {
    if (typeof amount !== "number" || isNaN(amount)) return "0.00";
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

const toAmount = (value: unknown): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const getAedPreTax = (inv: Invoice): number => toAmount(inv.totalBeforeTaxAED ?? inv.totalBeforeTax ?? 0);
const getAedVat = (inv: Invoice): number => toAmount(inv.totalTaxAED ?? inv.totalTax ?? 0);
const getAedTotal = (inv: Invoice): number => {
    const explicitTotal = inv.totalAmountAED ?? inv.totalAmount;
    if (explicitTotal !== undefined && explicitTotal !== null) return toAmount(explicitTotal);
    return getAedPreTax(inv) + getAedVat(inv);
};

const getOrigPreTax = (inv: Invoice): number => toAmount(inv.totalBeforeTax ?? inv.totalBeforeTaxAED ?? 0);
const getOrigVat = (inv: Invoice): number => toAmount(inv.totalTax ?? inv.totalTaxAED ?? 0);
const getOrigTotal = (inv: Invoice): number => {
    const explicitTotal = inv.totalAmount ?? inv.totalAmountAED;
    if (explicitTotal !== undefined && explicitTotal !== null) return toAmount(explicitTotal);
    return getOrigPreTax(inv) + getOrigVat(inv);
};

const PAYMENT_MODE_OPTIONS: Array<NonNullable<Invoice["paymentMode"]>> = [
    "Bank",
    "Cash",
    "owners current account"
];

const PAYMENT_STATUS_OPTIONS: Array<NonNullable<Invoice["paymentStatus"]>> = [
    "Paid",
    "Unpaid"
];

const isUnpaidPaymentStatus = (value?: string) =>
    String(value || "").trim().toLowerCase() === "unpaid";


type EditableInvoiceField =
    | "invoiceDate"
    | "invoiceId"
    | "vendorName"
    | "customerName"
    | "totalBeforeTax"
    | "totalTax"
    | "totalBeforeTaxAED"
    | "totalTaxAED"
    | "paymentMode"
    | "paymentStatus";
type InvoiceBucket = "sales" | "purchase";
type InvoiceRow = { inv: Invoice; idx: number; key: string };

const rowKey = (bucket: InvoiceBucket, idx: number) => `${bucket}:${idx}`;

const matchesInvoiceSearch = (inv: Invoice, term: string) => {
    const q = term.trim().toLowerCase();
    if (!q) return true;
    const haystack = [
        inv.invoiceDate || "",
        inv.invoiceId || "",
        inv.vendorName || "",
        inv.customerName || "",
        inv.currency || "",
        inv.paymentMode || "",
        inv.paymentStatus || "",
        String(getAedPreTax(inv)),
        String(getAedVat(inv)),
        String(getAedTotal(inv))
    ].join(" ").toLowerCase();
    return haystack.includes(q);
};

export const InvoiceSummarizationView: React.FC<InvoiceSummarizationViewProps> = ({
    salesInvoices,
    purchaseInvoices,
    currency,
    onSalesInvoicesChange,
    onPurchaseInvoicesChange
}) => {
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    const updateAmounts = (inv: Invoice, field: EditableInvoiceField, value: string): Invoice => {
        const val = toAmount(value);
        const isAed = !inv.currency || inv.currency === "AED";

        // Calculate conversion rate from existing data if possible
        const rate = (inv.totalAmountAED && inv.totalAmount && inv.totalAmount !== 0)
            ? (inv.totalAmountAED / inv.totalAmount)
            : 1;

        let tbt = inv.totalBeforeTax ?? 0;
        let tt = inv.totalTax ?? 0;
        let tbtAed = inv.totalBeforeTaxAED ?? 0;
        let ttAed = inv.totalTaxAED ?? 0;

        if (field === "totalBeforeTax") {
            tbt = val;
            tbtAed = isAed ? val : parseFloat((val * rate).toFixed(2));
        } else if (field === "totalTax") {
            tt = val;
            ttAed = isAed ? val : parseFloat((val * rate).toFixed(2));
        } else if (field === "totalBeforeTaxAED") {
            tbtAed = val;
            if (isAed) tbt = val;
        } else if (field === "totalTaxAED") {
            ttAed = val;
            if (isAed) tt = val;
        }

        return {
            ...inv,
            totalBeforeTax: tbt,
            totalTax: tt,
            totalAmount: parseFloat((tbt + tt).toFixed(2)),
            totalBeforeTaxAED: tbtAed,
            totalTaxAED: ttAed,
            totalAmountAED: parseFloat((tbtAed + ttAed).toFixed(2))
        };
    };

    const updateSalesInvoiceField = useCallback((index: number, field: EditableInvoiceField, value: string) => {
        if (!onSalesInvoicesChange) return;
        const next = salesInvoices.map((inv, i) => {
            if (i !== index) return inv;
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED" || field === "totalBeforeTax" || field === "totalTax") return updateAmounts(inv, field, value);
            if (field === "paymentStatus") {
                const statusValue = value as Invoice["paymentStatus"];
                return {
                    ...inv,
                    paymentStatus: statusValue,
                    status: statusValue || inv.status,
                    paymentMode: isUnpaidPaymentStatus(statusValue) ? "" : (inv.paymentMode || "")
                };
            }
            return { ...inv, [field]: value };
        });
        onSalesInvoicesChange(next);
    }, [onSalesInvoicesChange, salesInvoices]);

    const updatePurchaseInvoiceField = useCallback((index: number, field: EditableInvoiceField, value: string) => {
        if (!onPurchaseInvoicesChange) return;
        const next = purchaseInvoices.map((inv, i) => {
            if (i !== index) return inv;
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED" || field === "totalBeforeTax" || field === "totalTax") return updateAmounts(inv, field, value);
            if (field === "paymentStatus") {
                const statusValue = value as Invoice["paymentStatus"];
                return {
                    ...inv,
                    paymentStatus: statusValue,
                    status: statusValue || inv.status,
                    paymentMode: isUnpaidPaymentStatus(statusValue) ? "" : (inv.paymentMode || "")
                };
            }
            return { ...inv, [field]: value };
        });
        onPurchaseInvoicesChange(next);
    }, [onPurchaseInvoicesChange, purchaseInvoices]);

    const salesRows = useMemo<InvoiceRow[]>(
        () => salesInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("sales", idx) })).filter((row) => matchesInvoiceSearch(row.inv, invoiceSearchTerm)),
        [salesInvoices, invoiceSearchTerm]
    );
    const purchaseRows = useMemo<InvoiceRow[]>(
        () => purchaseInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("purchase", idx) })).filter((row) => matchesInvoiceSearch(row.inv, invoiceSearchTerm)),
        [purchaseInvoices, invoiceSearchTerm]
    );

    const visibleKeys = useMemo(() => [...salesRows.map((r) => r.key), ...purchaseRows.map((r) => r.key)], [salesRows, purchaseRows]);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
    const salesAllSelected = salesRows.length > 0 && salesRows.every((row) => selectedKeys.has(row.key));
    const purchaseAllSelected = purchaseRows.length > 0 && purchaseRows.every((row) => selectedKeys.has(row.key));

    const toggleSelected = useCallback((key: string, checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (checked) next.add(key);
            else next.delete(key);
            return next;
        });
    }, []);

    const toggleVisibleSelection = useCallback((checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            visibleKeys.forEach((key) => {
                if (checked) next.add(key);
                else next.delete(key);
            });
            return next;
        });
    }, [visibleKeys]);

    const toggleSalesSelection = useCallback((checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            salesRows.forEach((row) => {
                if (checked) next.add(row.key);
                else next.delete(row.key);
            });
            return next;
        });
    }, [salesRows]);

    const togglePurchaseSelection = useCallback((checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            purchaseRows.forEach((row) => {
                if (checked) next.add(row.key);
                else next.delete(row.key);
            });
            return next;
        });
    }, [purchaseRows]);

    const deleteSingle = useCallback((bucket: InvoiceBucket, index: number) => {
        if (bucket === "sales" && onSalesInvoicesChange) {
            onSalesInvoicesChange(salesInvoices.filter((_, idx) => idx !== index));
        }
        if (bucket === "purchase" && onPurchaseInvoicesChange) {
            onPurchaseInvoicesChange(purchaseInvoices.filter((_, idx) => idx !== index));
        }
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            next.delete(rowKey(bucket, index));
            return next;
        });
    }, [onPurchaseInvoicesChange, onSalesInvoicesChange, purchaseInvoices, salesInvoices]);

    const deleteSelected = useCallback(() => {
        if (selectedKeys.size === 0) return;

        const salesToDelete = new Set<number>();
        const purchasesToDelete = new Set<number>();

        selectedKeys.forEach((key) => {
            const [bucket, rawIdx] = key.split(":");
            const idx = Number(rawIdx);
            if (!Number.isFinite(idx)) return;
            if (bucket === "sales") salesToDelete.add(idx);
            if (bucket === "purchase") purchasesToDelete.add(idx);
        });

        if (salesToDelete.size > 0 && onSalesInvoicesChange) {
            onSalesInvoicesChange(salesInvoices.filter((_, idx) => !salesToDelete.has(idx)));
        }
        if (purchasesToDelete.size > 0 && onPurchaseInvoicesChange) {
            onPurchaseInvoicesChange(purchaseInvoices.filter((_, idx) => !purchasesToDelete.has(idx)));
        }

        setSelectedKeys(new Set());
    }, [onPurchaseInvoicesChange, onSalesInvoicesChange, purchaseInvoices, salesInvoices, selectedKeys]);

    useEffect(() => {
        // Keep selection clean after list refreshes/imports.
        setSelectedKeys(new Set());
    }, [salesInvoices.length, purchaseInvoices.length]);

    const hasSales = salesInvoices.length > 0;
    const hasPurchases = purchaseInvoices.length > 0;

    return (
        <div className="space-y-6">
            {hasSales || hasPurchases ? (
                <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6">
                    <div className="space-y-8">
                        <div className="bg-muted/40 border border-border rounded-xl p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                            <input
                                type="text"
                                value={invoiceSearchTerm}
                                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                placeholder="Search sales + purchase invoices (date, invoice no, supplier, customer, amount)..."
                                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={allVisibleSelected}
                                    onChange={(e) => toggleVisibleSelection(e.target.checked)}
                                    className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                                />
                                Select All Visible
                            </label>
                            <button
                                onClick={deleteSelected}
                                disabled={selectedKeys.size === 0}
                                className="px-3 py-2 rounded-lg text-xs font-bold border border-red-500/50 text-red-600 dark:text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Delete Selected ({selectedKeys.size})
                            </button>
                        </div>

                        {hasSales && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-bold text-foreground flex items-center">
                                    <BanknotesIcon className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" /> Sales Transactions
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-border bg-muted/20">
                                    <table className="w-full text-sm text-left text-muted-foreground">
                                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium">
                                            <tr>
                                                <th className="px-4 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={salesAllSelected}
                                                        onChange={(e) => toggleSalesSelection(e.target.checked)}
                                                        className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                                                    />
                                                </th>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Invoice No</th>
                                                <th className="px-4 py-3">Supplier</th>
                                                <th className="px-4 py-3">Customer</th>
                                                <th className="px-4 py-3">Currency</th>
                                                <th className="px-4 py-3 text-right">Pre-Tax</th>
                                                <th className="px-4 py-3 text-right">VAT</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                                <th className="px-4 py-3">Payment Status</th>
                                                <th className="px-4 py-3">Payment Mode</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {salesRows.map(({ inv, idx, key }) => (
                                                <tr key={key} className="hover:bg-muted/40 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedKeys.has(key)}
                                                            onChange={(e) => toggleSelected(key, e.target.checked)}
                                                            className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.invoiceDate || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "invoiceDate", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.invoiceId || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "invoiceId", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.vendorName || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "vendorName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.customerName || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "customerName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-bold text-foreground">{inv.currency || "AED"}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={getOrigPreTax(inv)}
                                                                onChange={(e) => updateSalesInvoiceField(idx, "totalBeforeTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                            />
                                                            {inv.currency && inv.currency !== "AED" && (
                                                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                    {formatNumber(getAedPreTax(inv))} AED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={getOrigVat(inv)}
                                                                onChange={(e) => updateSalesInvoiceField(idx, "totalTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                            />
                                                            {inv.currency && inv.currency !== "AED" && (
                                                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                    {formatNumber(getAedVat(inv))} AED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-mono text-foreground font-bold text-xs">{formatNumber(getOrigTotal(inv))}</span>
                                                            {inv.currency && inv.currency !== "AED" && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {formatNumber(getAedTotal(inv))} AED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentStatus || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "paymentStatus", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentMode || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "paymentMode", e.target.value)}
                                                            disabled={isUnpaidPaymentStatus(inv.paymentStatus)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_MODE_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => deleteSingle("sales", idx)}
                                                            className="px-2 py-1 text-[10px] font-bold rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {salesRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={12} className="px-4 py-4 text-center text-xs text-gray-500">
                                                        No sales invoices match the current search.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold">
                                            <tr>
                                                <td colSpan={6} className="px-4 py-3 text-right text-muted-foreground">Total Sales</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatNumber(salesInvoices.reduce((s, i) => s + getAedPreTax(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 text-lg">{formatNumber(salesInvoices.reduce((s, i) => s + getAedVat(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground text-lg">{formatNumber(salesInvoices.reduce((s, i) => s + getAedTotal(i), 0))}</td>
                                                <td className="px-4 py-3"></td>
                                                <td className="px-4 py-3"></td>
                                                <td className="px-4 py-3"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {hasPurchases && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-bold text-foreground flex items-center">
                                    <BriefcaseIcon className="w-5 h-5 mr-2 text-orange-500 dark:text-orange-400" /> Purchase Transactions
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-border bg-muted/20">
                                    <table className="w-full text-sm text-left text-muted-foreground">
                                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium">
                                            <tr>
                                                <th className="px-4 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={purchaseAllSelected}
                                                        onChange={(e) => togglePurchaseSelection(e.target.checked)}
                                                        className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                                                    />
                                                </th>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Invoice No</th>
                                                <th className="px-4 py-3">Supplier</th>
                                                <th className="px-4 py-3">Customer</th>
                                                <th className="px-4 py-3">Currency</th>
                                                <th className="px-4 py-3 text-right">Pre-Tax</th>
                                                <th className="px-4 py-3 text-right">VAT</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                                <th className="px-4 py-3">Payment Status</th>
                                                <th className="px-4 py-3">Payment Mode</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {purchaseRows.map(({ inv, idx, key }) => (
                                                <tr key={key} className="hover:bg-muted/40 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedKeys.has(key)}
                                                            onChange={(e) => toggleSelected(key, e.target.checked)}
                                                            className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.invoiceDate || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "invoiceDate", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.invoiceId || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "invoiceId", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.vendorName || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "vendorName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.customerName || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "customerName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-bold text-foreground">{inv.currency || "AED"}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={getOrigPreTax(inv)}
                                                                onChange={(e) => updatePurchaseInvoiceField(idx, "totalBeforeTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                            />
                                                            {inv.currency && inv.currency !== "AED" && (
                                                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                    {formatNumber(getAedPreTax(inv))} AED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={getOrigVat(inv)}
                                                                onChange={(e) => updatePurchaseInvoiceField(idx, "totalTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                            />
                                                            {inv.currency && inv.currency !== "AED" && (
                                                                <span className="text-[10px] text-muted-foreground mt-0.5">
                                                                    {formatNumber(getAedVat(inv))} AED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-mono text-foreground font-bold text-xs">{formatNumber(getOrigTotal(inv))}</span>
                                                            {inv.currency && inv.currency !== "AED" && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {formatNumber(getAedTotal(inv))} AED
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentStatus || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "paymentStatus", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentMode || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "paymentMode", e.target.value)}
                                                            disabled={isUnpaidPaymentStatus(inv.paymentStatus)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_MODE_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => deleteSingle("purchase", idx)}
                                                            className="px-2 py-1 text-[10px] font-bold rounded border border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/10"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {purchaseRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={12} className="px-4 py-4 text-center text-xs text-gray-500">
                                                        No purchase invoices match the current search.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold">
                                            <tr>
                                                <td colSpan={6} className="px-4 py-3 text-right text-muted-foreground">Total Purchases</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatNumber(purchaseInvoices.reduce((s, i) => s + getAedPreTax(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 text-lg">{formatNumber(purchaseInvoices.reduce((s, i) => s + getAedVat(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground text-lg">{formatNumber(purchaseInvoices.reduce((s, i) => s + getAedTotal(i), 0))}</td>
                                                <td className="px-4 py-3"></td>
                                                <td className="px-4 py-3"></td>
                                                <td className="px-4 py-3"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-muted/30 text-center p-8 rounded-lg border border-border shadow-sm">
                    <h3 className="text-xl font-semibold text-foreground mb-2">No Invoices Processed</h3>
                    <p className="text-muted-foreground">Please upload and process invoices to see a summary.</p>
                </div>
            )}
        </div>
    );
};
