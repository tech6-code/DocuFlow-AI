import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice } from "../types";
import { BanknotesIcon, BriefcaseIcon, ChartBarIcon } from "./icons";

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

const getPreTax = (inv: Invoice): number => toAmount(inv.totalBeforeTaxAED ?? inv.totalBeforeTax ?? 0);
const getVat = (inv: Invoice): number => toAmount(inv.totalTaxAED ?? inv.totalTax ?? 0);
const getTotal = (inv: Invoice): number => {
    const explicitTotal = inv.totalAmountAED ?? inv.totalAmount;
    if (explicitTotal !== undefined && explicitTotal !== null) return toAmount(explicitTotal);
    return getPreTax(inv) + getVat(inv);
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

const classifyInvoiceForSummary = (inv: Invoice, companyName: string, companyTrn?: string): Invoice => {
    const hasCompanyName = Boolean(companyName && companyName.trim());
    const hasCompanyTrn = Boolean(companyTrn && companyTrn.trim());
    if (!hasCompanyName && !hasCompanyTrn) return { ...inv, invoiceType: "purchase" };

    const clean = (value: string) => (value ? value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() : "");
    const uTrn = clean(companyTrn || "");
    const uName = (companyName || "").toLowerCase().trim();
    const normU = uName.replace(/[^a-z0-9]/g, "");

    const vendorName = (
        inv.vendorName ||
        (inv as Invoice & { supplierName?: string; partyName?: string }).supplierName ||
        (inv as Invoice & { partyName?: string }).partyName ||
        ""
    ).toString();
    const vendorTrnRaw = (
        inv.vendorTrn ||
        (inv as Invoice & { supplierTrn?: string; partyTrn?: string }).supplierTrn ||
        (inv as Invoice & { partyTrn?: string }).partyTrn ||
        ""
    ).toString();
    const vTrn = clean(vendorTrnRaw);
    const vName = vendorName.toLowerCase().trim();
    const normV = vName.replace(/[^a-z0-9]/g, "");

    const customerName = (inv.customerName || (inv as Invoice & { buyerName?: string }).buyerName || "").toString();
    const customerTrnRaw = (inv.customerTrn || (inv as Invoice & { buyerTrn?: string }).buyerTrn || "").toString();
    const cTrn = clean(customerTrnRaw);
    const cName = customerName.toLowerCase().trim();
    const normC = cName.replace(/[^a-z0-9]/g, "");

    let isSales = false;
    let isPurchase = false;

    if (uTrn) {
        if (vTrn && (uTrn === vTrn || vTrn.includes(uTrn) || uTrn.includes(vTrn))) isSales = true;
        if (cTrn && (uTrn === cTrn || cTrn.includes(uTrn) || uTrn.includes(cTrn))) isPurchase = true;
    }

    const tokenMatch = (a: string, b: string) => {
        const aTokens = a.split(/\s+/).filter((t) => t.length > 2);
        const bTokens = b.split(/\s+/);
        if (!aTokens.length) return false;
        const matchCount = aTokens.reduce((count, token) => count + (bTokens.some((bt) => bt.includes(token)) ? 1 : 0), 0);
        return matchCount / aTokens.length >= 0.6;
    };

    if (!isSales && !isPurchase && normU && normU.length > 2) {
        if (normV.includes(normU) || normU.includes(normV) || tokenMatch(uName, vName)) isSales = true;
        if (!isSales && (normC.includes(normU) || normU.includes(normC) || tokenMatch(uName, cName))) isPurchase = true;
    }

    if (isSales) return { ...inv, invoiceType: "sales" };
    if (isPurchase) return { ...inv, invoiceType: "purchase" };

    return { ...inv, invoiceType: "purchase" };
};

type EditableInvoiceField =
    | "invoiceDate"
    | "invoiceId"
    | "vendorName"
    | "customerName"
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
        inv.paymentMode || "",
        inv.paymentStatus || "",
        String(getPreTax(inv)),
        String(getVat(inv)),
        String(getTotal(inv))
    ].join(" ").toLowerCase();
    return haystack.includes(q);
};

export const InvoiceSummarizationView: React.FC<InvoiceSummarizationViewProps> = ({
    salesInvoices,
    purchaseInvoices,
    currency,
    companyName,
    companyTrn,
    onSalesInvoicesChange,
    onPurchaseInvoicesChange
}) => {
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    const classifiedInvoices = useMemo(() => {
        const combined = [...salesInvoices, ...purchaseInvoices];
        return combined.map((inv) => classifyInvoiceForSummary(inv, companyName, companyTrn));
    }, [salesInvoices, purchaseInvoices, companyName, companyTrn]);

    const classifiedSalesInvoices = useMemo(
        () => classifiedInvoices.filter((inv) => inv.invoiceType === "sales"),
        [classifiedInvoices]
    );
    const classifiedPurchaseInvoices = useMemo(
        () => classifiedInvoices.filter((inv) => inv.invoiceType === "purchase"),
        [classifiedInvoices]
    );

    const updateAmounts = (inv: Invoice, field: EditableInvoiceField, value: string): Invoice => {
        const preTax = field === "totalBeforeTaxAED" ? toAmount(value) : getPreTax(inv);
        const vat = field === "totalTaxAED" ? toAmount(value) : getVat(inv);
        const total = preTax + vat;
        return {
            ...inv,
            totalBeforeTaxAED: preTax,
            totalTaxAED: vat,
            totalAmountAED: total,
            totalBeforeTax: preTax,
            totalTax: vat,
            totalAmount: total
        };
    };

    const updateSalesInvoiceField = useCallback((index: number, field: EditableInvoiceField, value: string) => {
        if (!onSalesInvoicesChange) return;
        const next = salesInvoices.map((inv, i) => {
            if (i !== index) return inv;
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED") return updateAmounts(inv, field, value);
            return { ...inv, [field]: value };
        });
        onSalesInvoicesChange(next);
    }, [onSalesInvoicesChange, salesInvoices]);

    const updatePurchaseInvoiceField = useCallback((index: number, field: EditableInvoiceField, value: string) => {
        if (!onPurchaseInvoicesChange) return;
        const next = purchaseInvoices.map((inv, i) => {
            if (i !== index) return inv;
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED") return updateAmounts(inv, field, value);
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

    const salesSummary = useMemo(() => {
        const standardRatedSupplies = classifiedSalesInvoices.reduce((sum, inv) => sum + getPreTax(inv), 0);
        const outputTax = classifiedSalesInvoices.reduce((sum, inv) => sum + getVat(inv), 0);
        const zeroRatedSupplies = classifiedSalesInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0);
        const exemptedSupplies = 0;
        const totalAmountIncludingVat = standardRatedSupplies + outputTax;
        return { standardRatedSupplies, outputTax, zeroRatedSupplies, exemptedSupplies, totalAmountIncludingVat };
    }, [classifiedSalesInvoices]);

    const purchaseSummary = useMemo(() => {
        const standardRatedExpenses = classifiedPurchaseInvoices.reduce((sum, inv) => sum + getPreTax(inv), 0);
        const inputTax = classifiedPurchaseInvoices.reduce((sum, inv) => sum + getVat(inv), 0);
        const zeroRatedExpenses = classifiedPurchaseInvoices.reduce((sum, inv) => sum + (inv.zeroRatedAED || 0), 0);
        const exemptedExpenses = 0;
        const totalAmountIncludingVat = standardRatedExpenses + inputTax;
        return { standardRatedExpenses, inputTax, zeroRatedExpenses, exemptedExpenses, totalAmountIncludingVat };
    }, [classifiedPurchaseInvoices]);

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
            sales: { totalAmount: salesTotalAmount, totalVat: salesTotalVat },
            expenses: { totalAmount: expensesTotalAmount, totalVat: expensesTotalVat },
            net: { dueTax, recoverableTax, payableTax, netVatPayable }
        };
    }, [salesSummary, purchaseSummary]);

    const hasSales = salesInvoices.length > 0;
    const hasPurchases = purchaseInvoices.length > 0;

    return (
        <div className="space-y-6">
            {hasSales || hasPurchases ? (
                <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6">
                    <div className="flex items-center mb-6 border-b border-border pb-4">
                        <ChartBarIcon className="w-6 h-6 text-indigo-400 mr-2" />
                        <h3 className="text-xl font-bold text-foreground">Consolidated Invoice Summary</h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="bg-muted/50 rounded-lg p-5 border border-border">
                            <h4 className="flex items-center text-sm font-bold text-blue-500 dark:text-blue-400 uppercase mb-4">
                                <BanknotesIcon className="w-4 h-4 mr-2" /> Sales (Outputs)
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Standard Rated Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(salesSummary.standardRatedSupplies)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Output Tax</span>
                                    <span className="text-blue-500 dark:text-blue-400 font-mono font-bold">{formatNumber(salesSummary.outputTax)} {currency}</span>
                                </div>
                                <div className="pt-2 border-t border-border flex justify-between text-sm">
                                    <span className="text-foreground/80 font-medium">Total (Std + Tax)</span>
                                    <span className="text-foreground font-mono font-bold">{formatNumber(salesSummary.totalAmountIncludingVat)} {currency}</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-muted-foreground">Zero Rated Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(salesSummary.zeroRatedSupplies)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Exempted Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(salesSummary.exemptedSupplies)} {currency}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-5 border border-border">
                            <h4 className="flex items-center text-sm font-bold text-orange-500 dark:text-orange-400 uppercase mb-4">
                                <BriefcaseIcon className="w-4 h-4 mr-2" /> Purchase (Inputs)
                            </h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Standard Rated Expenses</span>
                                    <span className="text-foreground font-mono">{formatNumber(purchaseSummary.standardRatedExpenses)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Input Tax</span>
                                    <span className="text-blue-500 dark:text-blue-400 font-mono font-bold">{formatNumber(purchaseSummary.inputTax)} {currency}</span>
                                </div>
                                <div className="pt-2 border-t border-border flex justify-between text-sm">
                                    <span className="text-foreground/80 font-medium">Total (Std + Tax)</span>
                                    <span className="text-foreground font-mono font-bold">{formatNumber(purchaseSummary.totalAmountIncludingVat)} {currency}</span>
                                </div>
                                <div className="pt-2 flex justify-between text-sm">
                                    <span className="text-muted-foreground">Zero Rated Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(purchaseSummary.zeroRatedExpenses)} {currency}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Exempted Supplies</span>
                                    <span className="text-foreground font-mono">{formatNumber(purchaseSummary.exemptedExpenses)} {currency}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/80 rounded-lg p-5 border border-border flex flex-col justify-center">
                            <h4 className="text-sm font-bold text-muted-foreground uppercase mb-4 text-center">Net VAT Position</h4>
                            <div className="text-center space-y-2">
                                <p className="text-muted-foreground text-sm">Output Tax - Input Tax</p>
                                <div className={`text-3xl font-mono font-bold ${vatReturn.net.netVatPayable >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                    {formatNumber(vatReturn.net.netVatPayable)} <span className="text-lg text-muted-foreground font-normal">{currency}</span>
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                    {vatReturn.net.netVatPayable >= 0 ? "Net VAT Payable" : "Net VAT Refundable"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8 mt-10">
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
                                                <th className="px-4 py-3 text-right">Pre-Tax ({currency})</th>
                                                <th className="px-4 py-3 text-right">VAT ({currency})</th>
                                                <th className="px-4 py-3 text-right">Total ({currency})</th>
                                                <th className="px-4 py-3">Payment Mode</th>
                                                <th className="px-4 py-3">Payment Status</th>
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
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={getPreTax(inv)}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "totalBeforeTaxAED", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={getVat(inv)}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "totalTaxAED", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-foreground font-bold text-xs">{formatNumber(getTotal(inv))}</td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentMode || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "paymentMode", e.target.value)}
                                                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_MODE_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentStatus || ""}
                                                            onChange={(e) => updateSalesInvoiceField(idx, "paymentStatus", e.target.value)}
                                                            className="w-full bg-gray-900/50 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_STATUS_OPTIONS.map((opt) => (
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
                                                    <td colSpan={11} className="px-4 py-4 text-center text-xs text-gray-500">
                                                        No sales invoices match the current search.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold">
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-right text-muted-foreground">Total Sales</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatNumber(salesInvoices.reduce((s, i) => s + getPreTax(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 text-lg">{formatNumber(salesInvoices.reduce((s, i) => s + getVat(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground text-lg">{formatNumber(salesInvoices.reduce((s, i) => s + getTotal(i), 0))}</td>
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
                                                <th className="px-4 py-3 text-right">Pre-Tax ({currency})</th>
                                                <th className="px-4 py-3 text-right">VAT ({currency})</th>
                                                <th className="px-4 py-3 text-right">Total ({currency})</th>
                                                <th className="px-4 py-3">Payment Mode</th>
                                                <th className="px-4 py-3">Payment Status</th>
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
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={getPreTax(inv)}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "totalBeforeTaxAED", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={getVat(inv)}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "totalTaxAED", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-foreground font-bold text-xs">{formatNumber(getTotal(inv))}</td>
                                                    <td className="px-4 py-3">
                                                        <select
                                                            value={inv.paymentMode || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "paymentMode", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/20"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_MODE_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
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
                                                    <td colSpan={11} className="px-4 py-4 text-center text-xs text-gray-500">
                                                        No purchase invoices match the current search.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold">
                                            <tr>
                                                <td colSpan={5} className="px-4 py-3 text-right text-muted-foreground">Total Purchases</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatNumber(purchaseInvoices.reduce((s, i) => s + getPreTax(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 text-lg">{formatNumber(purchaseInvoices.reduce((s, i) => s + getVat(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground text-lg">{formatNumber(purchaseInvoices.reduce((s, i) => s + getTotal(i), 0))}</td>
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
