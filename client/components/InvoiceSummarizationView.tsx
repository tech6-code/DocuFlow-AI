import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Invoice } from "../types";
import { BanknotesIcon, BriefcaseIcon, ExclamationTriangleIcon } from "./icons";

interface InvoiceSummarizationViewProps {
    salesInvoices: Invoice[];
    purchaseInvoices: Invoice[];
    otherInvoices?: Invoice[];
    currency: string;
    companyName: string;
    companyTrn?: string;
    onSalesInvoicesChange?: (invoices: Invoice[]) => void;
    onPurchaseInvoicesChange?: (invoices: Invoice[]) => void;
    onOtherInvoicesChange?: (invoices: Invoice[]) => void;
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
    return getAedPreTax(inv) + getAedVat(inv);
};

const getOrigPreTax = (inv: Invoice): number => toAmount(inv.totalBeforeTax ?? inv.totalBeforeTaxAED ?? 0);
const getOrigVat = (inv: Invoice): number => toAmount(inv.totalTax ?? inv.totalTaxAED ?? 0);
const getOrigTotal = (inv: Invoice): number => {
    return getOrigPreTax(inv) + getOrigVat(inv);
};

const getInvoiceRate = (inv: Invoice): number => {
    if (inv.exchangeRate && inv.exchangeRate > 0) return inv.exchangeRate;
    const origTotal = getOrigPreTax(inv) + getOrigVat(inv);
    const aedTotal = toAmount(inv.totalBeforeTaxAED) + toAmount(inv.totalTaxAED);
    if (origTotal > 0 && aedTotal > 0) return parseFloat((aedTotal / origTotal).toFixed(6));
    return 1;
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
    | "exchangeRate"
    | "paymentMode"
    | "paymentStatus";
type InvoiceBucket = "sales" | "purchase" | "other";
type InvoiceRow = { inv: Invoice; idx: number; key: string };
type DuplicateInvoiceGroup = {
    duplicateKey: string;
    invoiceId: string;
    totalAmount: number;
    rows: InvoiceRow[];
};

const rowKey = (bucket: InvoiceBucket, idx: number) => `${bucket}:${idx}`;

const normalizeDuplicateInvoiceId = (value: string) =>
    value.trim().toLowerCase().replace(/[\s/-]+/g, "");

const getRoundedDuplicateAmount = (inv: Invoice) =>
    parseFloat(getOrigTotal(inv).toFixed(2));

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
    otherInvoices = [],
    currency,
    onSalesInvoicesChange,
    onPurchaseInvoicesChange,
    onOtherInvoicesChange
}) => {
    const [invoiceSearchTerm, setInvoiceSearchTerm] = useState("");
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [bulkPaymentStatus, setBulkPaymentStatus] = useState<string>("");
    const [bulkPaymentMode, setBulkPaymentMode] = useState<string>("");

    const updateAmounts = (inv: Invoice, field: EditableInvoiceField, value: string): Invoice => {
        const val = toAmount(value);
        const isAed = !inv.currency || inv.currency === "AED";

        // Calculate conversion rate from existing data if possible
        const rate = getInvoiceRate(inv);

        let tbt = inv.totalBeforeTax ?? 0;
        let tt = inv.totalTax ?? 0;
        let tbtAed = inv.totalBeforeTaxAED ?? 0;
        let ttAed = inv.totalTaxAED ?? 0;
        let newRate = inv.exchangeRate;

        if (field === "exchangeRate") {
            // User changed the exchange rate — recalculate all AED values
            const newRateVal = val > 0 ? val : 1;
            newRate = newRateVal;
            tbtAed = parseFloat((tbt * newRateVal).toFixed(2));
            ttAed = parseFloat((tt * newRateVal).toFixed(2));
        } else if (field === "totalBeforeTax") {
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
            exchangeRate: newRate,
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
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED" || field === "totalBeforeTax" || field === "totalTax" || field === "exchangeRate") return updateAmounts(inv, field, value);
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
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED" || field === "totalBeforeTax" || field === "totalTax" || field === "exchangeRate") return updateAmounts(inv, field, value);
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

    const updateOtherInvoiceField = useCallback((index: number, field: EditableInvoiceField, value: string) => {
        if (!onOtherInvoicesChange) return;
        const next = otherInvoices.map((inv, i) => {
            if (i !== index) return inv;
            if (field === "totalBeforeTaxAED" || field === "totalTaxAED" || field === "totalBeforeTax" || field === "totalTax" || field === "exchangeRate") return updateAmounts(inv, field, value);
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
        onOtherInvoicesChange(next);
    }, [onOtherInvoicesChange, otherInvoices]);

    const salesRows = useMemo<InvoiceRow[]>(
        () => salesInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("sales", idx) })).filter((row) => matchesInvoiceSearch(row.inv, invoiceSearchTerm)),
        [salesInvoices, invoiceSearchTerm]
    );
    const purchaseRows = useMemo<InvoiceRow[]>(
        () => purchaseInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("purchase", idx) })).filter((row) => matchesInvoiceSearch(row.inv, invoiceSearchTerm)),
        [purchaseInvoices, invoiceSearchTerm]
    );
    const otherRows = useMemo<InvoiceRow[]>(
        () => otherInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("other", idx) })).filter((row) => matchesInvoiceSearch(row.inv, invoiceSearchTerm)),
        [otherInvoices, invoiceSearchTerm]
    );

    const duplicateGroups = useMemo<DuplicateInvoiceGroup[]>(() => {
        const grouped = new Map<string, DuplicateInvoiceGroup>();
        const allRows: InvoiceRow[] = [
            ...salesInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("sales", idx) })),
            ...purchaseInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("purchase", idx) })),
            ...otherInvoices.map((inv, idx) => ({ inv, idx, key: rowKey("other", idx) }))
        ];

        allRows.forEach((row) => {
            const invoiceId = normalizeDuplicateInvoiceId(row.inv.invoiceId || "");
            if (!invoiceId) return;

            const totalAmount = getRoundedDuplicateAmount(row.inv);
            const duplicateKey = `${invoiceId}::${totalAmount.toFixed(2)}`;
            const existing = grouped.get(duplicateKey);

            if (existing) {
                existing.rows.push(row);
                return;
            }

            grouped.set(duplicateKey, {
                duplicateKey,
                invoiceId: row.inv.invoiceId || "",
                totalAmount,
                rows: [row]
            });
        });

        return Array.from(grouped.values())
            .filter((group) => group.rows.length > 1)
            .sort((a, b) => b.rows.length - a.rows.length || a.invoiceId.localeCompare(b.invoiceId));
    }, [otherInvoices, purchaseInvoices, salesInvoices]);

    const duplicateRowKeys = useMemo(() => {
        const next = new Set<string>();
        duplicateGroups.forEach((group) => {
            group.rows.forEach((row) => next.add(row.key));
        });
        return next;
    }, [duplicateGroups]);

    const visibleKeys = useMemo(() => [...salesRows.map((r) => r.key), ...purchaseRows.map((r) => r.key), ...otherRows.map((r) => r.key)], [salesRows, purchaseRows, otherRows]);
    const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selectedKeys.has(key));
    const salesAllSelected = salesRows.length > 0 && salesRows.every((row) => selectedKeys.has(row.key));
    const purchaseAllSelected = purchaseRows.length > 0 && purchaseRows.every((row) => selectedKeys.has(row.key));
    const otherAllSelected = otherRows.length > 0 && otherRows.every((row) => selectedKeys.has(row.key));

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

    const toggleOtherSelection = useCallback((checked: boolean) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            otherRows.forEach((row) => {
                if (checked) next.add(row.key);
                else next.delete(row.key);
            });
            return next;
        });
    }, [otherRows]);

    const deleteSingle = useCallback((bucket: InvoiceBucket, index: number) => {
        if (bucket === "sales" && onSalesInvoicesChange) {
            onSalesInvoicesChange(salesInvoices.filter((_, idx) => idx !== index));
        }
        if (bucket === "purchase" && onPurchaseInvoicesChange) {
            onPurchaseInvoicesChange(purchaseInvoices.filter((_, idx) => idx !== index));
        }
        if (bucket === "other" && onOtherInvoicesChange) {
            onOtherInvoicesChange(otherInvoices.filter((_, idx) => idx !== index));
        }
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            next.delete(rowKey(bucket, index));
            return next;
        });
    }, [onPurchaseInvoicesChange, onSalesInvoicesChange, onOtherInvoicesChange, purchaseInvoices, salesInvoices, otherInvoices]);

    const deleteSelected = useCallback(() => {
        if (selectedKeys.size === 0) return;

        const salesToDelete = new Set<number>();
        const purchasesToDelete = new Set<number>();
        const othersToDelete = new Set<number>();

        selectedKeys.forEach((key) => {
            const [bucket, rawIdx] = key.split(":");
            const idx = Number(rawIdx);
            if (!Number.isFinite(idx)) return;
            if (bucket === "sales") salesToDelete.add(idx);
            if (bucket === "purchase") purchasesToDelete.add(idx);
            if (bucket === "other") othersToDelete.add(idx);
        });

        if (salesToDelete.size > 0 && onSalesInvoicesChange) {
            onSalesInvoicesChange(salesInvoices.filter((_, idx) => !salesToDelete.has(idx)));
        }
        if (purchasesToDelete.size > 0 && onPurchaseInvoicesChange) {
            onPurchaseInvoicesChange(purchaseInvoices.filter((_, idx) => !purchasesToDelete.has(idx)));
        }
        if (othersToDelete.size > 0 && onOtherInvoicesChange) {
            onOtherInvoicesChange(otherInvoices.filter((_, idx) => !othersToDelete.has(idx)));
        }

        setSelectedKeys(new Set());
    }, [onPurchaseInvoicesChange, onSalesInvoicesChange, onOtherInvoicesChange, purchaseInvoices, salesInvoices, otherInvoices, selectedKeys]);

    const applyBulkUpdate = useCallback(() => {
        if (selectedKeys.size === 0) return;
        if (!bulkPaymentStatus && !bulkPaymentMode) return;

        const salesToUpdate = new Set<number>();
        const purchasesToUpdate = new Set<number>();
        const othersToUpdate = new Set<number>();

        selectedKeys.forEach((key) => {
            const [bucket, rawIdx] = key.split(":");
            const idx = Number(rawIdx);
            if (!Number.isFinite(idx)) return;
            if (bucket === "sales") salesToUpdate.add(idx);
            if (bucket === "purchase") purchasesToUpdate.add(idx);
            if (bucket === "other") othersToUpdate.add(idx);
        });

        const applyBulkToInvoice = (inv: Invoice): Invoice => {
            let updatedInv = { ...inv };
            if (bulkPaymentStatus) {
                updatedInv.paymentStatus = bulkPaymentStatus as Invoice["paymentStatus"];
                updatedInv.status = bulkPaymentStatus as Invoice["status"];
                if (isUnpaidPaymentStatus(bulkPaymentStatus)) {
                    updatedInv.paymentMode = "";
                }
            }
            if (bulkPaymentMode && !isUnpaidPaymentStatus(updatedInv.paymentStatus)) {
                updatedInv.paymentMode = bulkPaymentMode as Invoice["paymentMode"];
            }
            return updatedInv;
        };

        if (salesToUpdate.size > 0 && onSalesInvoicesChange) {
            onSalesInvoicesChange(salesInvoices.map((inv, idx) =>
                salesToUpdate.has(idx) ? applyBulkToInvoice(inv) : inv
            ));
        }

        if (purchasesToUpdate.size > 0 && onPurchaseInvoicesChange) {
            onPurchaseInvoicesChange(purchaseInvoices.map((inv, idx) =>
                purchasesToUpdate.has(idx) ? applyBulkToInvoice(inv) : inv
            ));
        }

        if (othersToUpdate.size > 0 && onOtherInvoicesChange) {
            onOtherInvoicesChange(otherInvoices.map((inv, idx) =>
                othersToUpdate.has(idx) ? applyBulkToInvoice(inv) : inv
            ));
        }

        setBulkPaymentStatus("");
        setBulkPaymentMode("");
    }, [bulkPaymentStatus, bulkPaymentMode, onPurchaseInvoicesChange, onSalesInvoicesChange, onOtherInvoicesChange, purchaseInvoices, salesInvoices, otherInvoices, selectedKeys]);

    useEffect(() => {
        // Keep selection clean after list refreshes/imports.
        setSelectedKeys(new Set());
    }, [salesInvoices.length, purchaseInvoices.length, otherInvoices.length]);

    const hasSales = salesInvoices.length > 0;
    const hasPurchases = purchaseInvoices.length > 0;
    const hasOthers = otherInvoices.length > 0;

    return (
        <div className="space-y-6">
            {hasSales || hasPurchases || hasOthers ? (
                <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6">
                    <div className="space-y-8">
                        <div className="flex flex-col gap-3">
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

                                <div className="h-6 w-px bg-border hidden lg:block mx-1"></div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <select
                                        value={bulkPaymentStatus}
                                        onChange={(e) => {
                                            setBulkPaymentStatus(e.target.value);
                                            if (isUnpaidPaymentStatus(e.target.value)) setBulkPaymentMode("");
                                        }}
                                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 h-[34px]"
                                    >
                                        <option value="">Status</option>
                                        {PAYMENT_STATUS_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={bulkPaymentMode}
                                        onChange={(e) => setBulkPaymentMode(e.target.value)}
                                        disabled={isUnpaidPaymentStatus(bulkPaymentStatus)}
                                        className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed h-[34px]"
                                    >
                                        <option value="">Mode</option>
                                        {PAYMENT_MODE_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={applyBulkUpdate}
                                        disabled={selectedKeys.size === 0 || (!bulkPaymentStatus && !bulkPaymentMode)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-500/50 text-blue-600 dark:text-blue-300 hover:bg-blue-500/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap h-[34px]"
                                    >
                                        Update ({selectedKeys.size})
                                    </button>
                                </div>

                                <div className="h-6 w-px bg-border hidden lg:block mx-1"></div>

                                <button
                                    onClick={deleteSelected}
                                    disabled={selectedKeys.size === 0}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-status-danger text-status-danger dark:text-status-danger hover:bg-status-danger-soft disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 h-[34px]"
                                >
                                    Delete ({selectedKeys.size})
                                </button>
                            </div>

                            {duplicateGroups.length > 0 && (
                                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                                    <div className="flex items-start gap-3">
                                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold text-foreground">
                                                Potential duplicate invoices detected
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {duplicateGroups.length} duplicate group{duplicateGroups.length > 1 ? "s" : ""} found based on matching invoice number and total amount.
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {duplicateGroups.slice(0, 3).map((group) => `${group.invoiceId || "No invoice no"} (${formatNumber(group.totalAmount)})`).join(", ")}
                                                {duplicateGroups.length > 3 ? ` +${duplicateGroups.length - 3} more` : ""}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
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
                                                <th className="px-4 py-3 text-right">Rate</th>
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
                                                <tr key={key} className={`${duplicateRowKeys.has(key) ? "bg-amber-500/10" : "hover:bg-muted/40"} transition-colors`}>
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
                                                        <div className="space-y-1">
                                                            <input
                                                                type="text"
                                                                value={inv.invoiceId || ""}
                                                                onChange={(e) => updateSalesInvoiceField(idx, "invoiceId", e.target.value)}
                                                                className={`w-full bg-background border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 ${duplicateRowKeys.has(key) ? "border-amber-500/60 focus:ring-amber-500/30" : "border-border focus:ring-blue-500/20"}`}
                                                            />
                                                            {duplicateRowKeys.has(key) && (
                                                                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                    Duplicate invoice no + amount
                                                                </p>
                                                            )}
                                                        </div>
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
                                                        {inv.currency && inv.currency !== "AED" ? (
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                value={getInvoiceRate(inv)}
                                                                onChange={(e) => updateSalesInvoiceField(idx, "exchangeRate", e.target.value)}
                                                                className="w-20 bg-primary/10 border border-primary/30 rounded px-2 py-1 text-xs text-right font-mono text-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                                title={`1 ${inv.currency} = ? AED`}
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
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
                                                            className="px-2 py-1 text-[10px] font-bold rounded border border-status-danger text-status-danger hover:bg-status-danger-soft"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {salesRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={12} className="px-4 py-4 text-center text-xs text-muted-foreground">
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
                                    <BriefcaseIcon className="w-5 h-5 mr-2 text-status-warning dark:text-status-warning" /> Purchase Transactions
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
                                                <th className="px-4 py-3 text-right">Rate</th>
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
                                                <tr key={key} className={`${duplicateRowKeys.has(key) ? "bg-amber-500/10" : "hover:bg-muted/40"} transition-colors`}>
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
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-warning"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1">
                                                            <input
                                                                type="text"
                                                                value={inv.invoiceId || ""}
                                                                onChange={(e) => updatePurchaseInvoiceField(idx, "invoiceId", e.target.value)}
                                                                className={`w-full bg-background border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 ${duplicateRowKeys.has(key) ? "border-amber-500/60 focus:ring-amber-500/30" : "border-border focus:ring-status-warning"}`}
                                                            />
                                                            {duplicateRowKeys.has(key) && (
                                                                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                    Duplicate invoice no + amount
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.vendorName || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "vendorName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-warning"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.customerName || ""}
                                                            onChange={(e) => updatePurchaseInvoiceField(idx, "customerName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-warning"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-bold text-foreground">{inv.currency || "AED"}</td>
                                                    <td className="px-4 py-3">
                                                        {inv.currency && inv.currency !== "AED" ? (
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                value={getInvoiceRate(inv)}
                                                                onChange={(e) => updatePurchaseInvoiceField(idx, "exchangeRate", e.target.value)}
                                                                className="w-20 bg-primary/10 border border-primary/30 rounded px-2 py-1 text-xs text-right font-mono text-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                                title={`1 ${inv.currency} = ? AED`}
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={getOrigPreTax(inv)}
                                                                onChange={(e) => updatePurchaseInvoiceField(idx, "totalBeforeTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-status-warning"
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
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-status-warning"
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
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-warning"
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
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-status-warning disabled:opacity-50 disabled:cursor-not-allowed"
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
                                                            className="px-2 py-1 text-[10px] font-bold rounded border border-status-danger text-status-danger dark:text-status-danger hover:bg-status-danger-soft"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {purchaseRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={12} className="px-4 py-4 text-center text-xs text-muted-foreground">
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

                        {hasOthers && (
                            <div className="space-y-4">
                                <h4 className="text-lg font-bold text-foreground flex items-center">
                                    <BanknotesIcon className="w-5 h-5 mr-2 text-muted-foreground" /> Other Transactions
                                </h4>
                                <div className="overflow-x-auto rounded-xl border border-border bg-muted/20">
                                    <table className="w-full text-sm text-left text-muted-foreground">
                                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-medium">
                                            <tr>
                                                <th className="px-4 py-3 w-10">
                                                    <input
                                                        type="checkbox"
                                                        checked={otherAllSelected}
                                                        onChange={(e) => toggleOtherSelection(e.target.checked)}
                                                        className="rounded border-border bg-background text-blue-600 focus:ring-blue-500"
                                                    />
                                                </th>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Invoice No</th>
                                                <th className="px-4 py-3">Supplier</th>
                                                <th className="px-4 py-3">Customer</th>
                                                <th className="px-4 py-3">Currency</th>
                                                <th className="px-4 py-3 text-right">Rate</th>
                                                <th className="px-4 py-3 text-right">Pre-Tax</th>
                                                <th className="px-4 py-3 text-right">VAT</th>
                                                <th className="px-4 py-3 text-right">Total</th>
                                                <th className="px-4 py-3">Payment Status</th>
                                                <th className="px-4 py-3">Payment Mode</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {otherRows.map(({ inv, idx, key }) => (
                                                <tr key={key} className={`${duplicateRowKeys.has(key) ? "bg-amber-500/10" : "hover:bg-muted/40"} transition-colors`}>
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
                                                            onChange={(e) => updateOtherInvoiceField(idx, "invoiceDate", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1">
                                                            <input
                                                                type="text"
                                                                value={inv.invoiceId || ""}
                                                                onChange={(e) => updateOtherInvoiceField(idx, "invoiceId", e.target.value)}
                                                                className={`w-full bg-background border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 ${duplicateRowKeys.has(key) ? "border-amber-500/60 focus:ring-amber-500/30" : "border-border focus:ring-muted-foreground/30"}`}
                                                            />
                                                            {duplicateRowKeys.has(key) && (
                                                                <p className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                                                    Duplicate invoice no + amount
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.vendorName || ""}
                                                            onChange={(e) => updateOtherInvoiceField(idx, "vendorName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="text"
                                                            value={inv.customerName || ""}
                                                            onChange={(e) => updateOtherInvoiceField(idx, "customerName", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-xs font-bold text-foreground">{inv.currency || "AED"}</td>
                                                    <td className="px-4 py-3">
                                                        {inv.currency && inv.currency !== "AED" ? (
                                                            <input
                                                                type="number"
                                                                step="0.0001"
                                                                value={getInvoiceRate(inv)}
                                                                onChange={(e) => updateOtherInvoiceField(idx, "exchangeRate", e.target.value)}
                                                                className="w-20 bg-primary/10 border border-primary/30 rounded px-2 py-1 text-xs text-right font-mono text-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary/40"
                                                                title={`1 ${inv.currency} = ? AED`}
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col items-end">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={getOrigPreTax(inv)}
                                                                onChange={(e) => updateOtherInvoiceField(idx, "totalBeforeTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
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
                                                                onChange={(e) => updateOtherInvoiceField(idx, "totalTax", e.target.value)}
                                                                className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-right font-mono text-blue-600 dark:text-blue-300 focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
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
                                                            onChange={(e) => updateOtherInvoiceField(idx, "paymentStatus", e.target.value)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground/30"
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
                                                            onChange={(e) => updateOtherInvoiceField(idx, "paymentMode", e.target.value)}
                                                            disabled={isUnpaidPaymentStatus(inv.paymentStatus)}
                                                            className="w-full bg-background border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-muted-foreground/30 disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="">Select</option>
                                                            {PAYMENT_MODE_OPTIONS.map((opt) => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => deleteSingle("other", idx)}
                                                            className="px-2 py-1 text-[10px] font-bold rounded border border-status-danger text-status-danger dark:text-status-danger hover:bg-status-danger-soft"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {otherRows.length === 0 && (
                                                <tr>
                                                    <td colSpan={12} className="px-4 py-4 text-center text-xs text-muted-foreground">
                                                        No other invoices match the current search.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-muted/30 font-bold">
                                            <tr>
                                                <td colSpan={6} className="px-4 py-3 text-right text-muted-foreground">Total Others</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground">{formatNumber(otherInvoices.reduce((s, i) => s + getAedPreTax(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-blue-600 dark:text-blue-400 text-lg">{formatNumber(otherInvoices.reduce((s, i) => s + getAedVat(i), 0))}</td>
                                                <td className="px-4 py-3 text-right font-mono text-foreground text-lg">{formatNumber(otherInvoices.reduce((s, i) => s + getAedTotal(i), 0))}</td>
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


