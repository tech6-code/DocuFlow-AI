import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CtCompanyList } from "../components/CtCompanyList";
import {
    ChartBarIcon,
    CheckCircleIcon,
    ChevronLeftIcon,
    DocumentArrowDownIcon,
    EyeIcon,
    XMarkIcon
} from "../components/icons";
import { SimpleLoading } from "../components/SimpleLoading";
import { useData } from "../contexts/DataContext";
import { ctFilingService } from "../services/ctFilingService";
import type { Company } from "../types";

type TaxField = {
    label: string;
    field: string;
    type?: "header" | "number";
    highlight?: boolean;
    computed?: boolean;
};

const TAX_COMPUTATION_FIELDS: TaxField[] = [
    { label: "ACCOUNTING INCOME", field: "_header_acc_inc", type: "header" },
    { label: "Accounting Income for the Tax Period (AED)", field: "accountingIncomeTaxPeriod", type: "number" },
    { label: "ACCOUNTING ADJUSTMENTS", field: "_header_acc_adj", type: "header" },
    { label: "Share of profits / (losses) from Equity Method investments (AED)", field: "shareProfitsEquity", type: "number" },
    { label: "Profits / (losses) from Unincorporated Partnerships (AED)", field: "accountingNetProfitsUninc", type: "number" },
    { label: "Gains / (losses) on Unincorporated Partnership disposals (AED)", field: "gainsDisposalUninc", type: "number" },
    { label: "Gains / (losses) not reported in the income statement (AED)", field: "gainsLossesReportedFS", type: "number" },
    { label: "Realisation basis adjustments (AED)", field: "realisationBasisAdj", type: "number" },
    { label: "Transitional adjustments (AED)", field: "transitionalAdj", type: "number" },
    { label: "EXEMPT INCOME", field: "_header_exempt_inc", type: "header" },
    { label: "Dividends received from Resident Persons (AED)", field: "dividendsResident", type: "number" },
    { label: "Income / (losses) from Participating Interests (AED)", field: "incomeParticipatingInterests", type: "number" },
    { label: "Taxable Income from Foreign Permanent Establishment (AED)", field: "taxableIncomeForeignPE", type: "number" },
    { label: "Income from international aircraft / shipping (AED)", field: "incomeIntlAircraftShipping", type: "number" },
    { label: "RELIEFS", field: "_header_reliefs", type: "header" },
    { label: "Qualifying Group adjustments (AED)", field: "adjQualifyingGroup", type: "number" },
    { label: "Business Restructuring Relief (AED)", field: "adjBusinessRestructuring", type: "number" },
    { label: "NONDEDUCTIBLE EXPENDITURE", field: "_header_non_ded_exp", type: "header" },
    { label: "Non-deductible expenditure adjustments (AED)", field: "adjNonDeductibleExp", type: "number" },
    { label: "Interest expenditure adjustments (AED)", field: "adjInterestExp", type: "number" },
    { label: "OTHER ADJUSTMENTS", field: "_header_other_adj_tax", type: "header" },
    { label: "Related Parties transactions adjustments (AED)", field: "adjRelatedParties", type: "number" },
    { label: "Qualifying Investment Funds adjustments (AED)", field: "adjQualifyingInvestmentFunds", type: "number" },
    { label: "Other adjustments (AED)", field: "otherAdjustmentsTax", type: "number" },
    { label: "TAX LIABILITY AND TAX CREDITS", field: "_header_tax_lia_cred", type: "header" },
    { label: "Taxable Income / (Tax Loss) before any Tax Loss adjustments (AED)", field: "taxableIncomeBeforeAdj", type: "number", highlight: true, computed: true },
    { label: "Tax Losses utilised in the current tax Period (AED)", field: "taxLossesUtilised", type: "number" },
    { label: "Tax Losses claimed from other group entities (AED)", field: "taxLossesClaimed", type: "number" },
    { label: "Pre-Grouping Tax Losses (AED)", field: "preGroupingLosses", type: "number" },
    { label: "Taxable Income / (Tax Loss) for the Tax Period (AED)", field: "taxableIncomeTaxPeriod", type: "number", highlight: true, computed: true },
    { label: "Corporate Tax Liability (AED)", field: "corporateTaxLiability", type: "number", highlight: true, computed: true },
    { label: "Tax Credits (AED)", field: "taxCredits", type: "number" },
    { label: "Corporate Tax Payable (AED)", field: "corporateTaxPayable", type: "number", highlight: true, computed: true }
];

const ADJUSTMENT_FIELDS = [
    "shareProfitsEquity",
    "accountingNetProfitsUninc",
    "gainsDisposalUninc",
    "gainsLossesReportedFS",
    "realisationBasisAdj",
    "transitionalAdj",
    "dividendsResident",
    "incomeParticipatingInterests",
    "taxableIncomeForeignPE",
    "incomeIntlAircraftShipping",
    "adjQualifyingGroup",
    "adjBusinessRestructuring",
    "adjNonDeductibleExp",
    "adjInterestExp",
    "adjRelatedParties",
    "adjQualifyingInvestmentFunds",
    "otherAdjustmentsTax"
];

const buildInitialEdits = (): Record<string, number> => {
    const initial: Record<string, number> = {};
    TAX_COMPUTATION_FIELDS.forEach((f) => {
        if (f.type !== "header") initial[f.field] = 0;
    });
    return initial;
};

const computeTaxData = (source: Record<string, number>, sbrClaimed: boolean): Record<string, number> => {
    const toInt = (v: unknown) => Math.round(Number(v) || 0);
    const data: Record<string, number> = {};
    Object.entries(source || {}).forEach(([k, v]) => {
        data[k] = toInt(v);
    });

    if (sbrClaimed) {
        Object.keys(data).forEach((key) => {
            data[key] = 0;
        });
        return data;
    }

    const accountingBase = toInt(data.accountingIncomeTaxPeriod);
    const adjustmentsTotal = ADJUSTMENT_FIELDS.reduce((sum, key) => sum + toInt(data[key]), 0);
    const taxLossesUtilised = toInt(data.taxLossesUtilised);
    const taxLossesClaimed = toInt(data.taxLossesClaimed);
    const preGroupingLosses = toInt(data.preGroupingLosses);
    const taxCredits = toInt(data.taxCredits);

    const taxableIncomeBeforeAdj = toInt(accountingBase + adjustmentsTotal);
    const taxableIncomeTaxPeriod = toInt(taxableIncomeBeforeAdj - taxLossesUtilised - taxLossesClaimed - preGroupingLosses);
    const corporateTaxLiability = toInt(Math.max(0, taxableIncomeTaxPeriod - 375000) * 0.09);
    const corporateTaxPayable = toInt(Math.max(0, corporateTaxLiability - taxCredits));

    data.taxableIncomeBeforeAdj = taxableIncomeBeforeAdj;
    data.taxableIncomeTaxPeriod = taxableIncomeTaxPeriod;
    data.corporateTaxLiability = corporateTaxLiability;
    data.corporateTaxPayable = corporateTaxPayable;

    return data;
};

const formatCurrency = (n: number) => {
    const rounded = Math.round(Number(n) || 0);
    return rounded.toLocaleString("en-US");
};

export const TaxComputationPage: React.FC = () => {
    const navigate = useNavigate();
    const { customerId } = useParams<{ customerId: string }>();
    const [searchParams] = useSearchParams();
    const { projectCompanies } = useData();

    const selectedCompany = useMemo(
        () => projectCompanies.find((company) => company.id === customerId) || null,
        [projectCompanies, customerId]
    );

    const periodFromParam = searchParams.get("from") || "";
    const periodToParam = searchParams.get("to") || "";

    const [edits, setEdits] = useState<Record<string, number>>(buildInitialEdits);
    const [sbrClaimed, setSbrClaimed] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    const [pendingCompany, setPendingCompany] = useState<Company | null>(null);
    const [pendingFromDate, setPendingFromDate] = useState("");
    const [pendingToDate, setPendingToDate] = useState("");
    const [periodError, setPeriodError] = useState<string | null>(null);

    useEffect(() => {
        if (customerId && (!periodFromParam || !periodToParam)) {
            navigate("/tax-computation", { replace: true });
        }
    }, [customerId, periodFromParam, periodToParam, navigate]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                window.URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const computedData = useMemo(() => computeTaxData(edits, sbrClaimed), [edits, sbrClaimed]);

    const handleSelectCompany = (company: Company) => {
        setPendingCompany(company);
        setPendingFromDate(company.ctPeriodStart || "");
        setPendingToDate(company.ctPeriodEnd || "");
        setPeriodError(null);
    };

    const handleClosePeriodModal = () => {
        setPendingCompany(null);
        setPeriodError(null);
    };

    const handleConfirmPeriod = () => {
        if (!pendingCompany) return;
        const from = pendingFromDate.trim();
        const to = pendingToDate.trim();
        if (!from || !to) {
            setPeriodError("Both 'From' and 'To' dates are required.");
            return;
        }
        if (from > to) {
            setPeriodError("'From' date must be on or before the 'To' date.");
            return;
        }
        const params = new URLSearchParams({ from, to });
        navigate(`/tax-computation/${pendingCompany.id}?${params.toString()}`);
        setPendingCompany(null);
        setPeriodError(null);
    };

    const handleFieldChange = (field: string, value: string) => {
        setEdits((prev) => ({ ...prev, [field]: Math.round(parseFloat(value) || 0) }));
    };

    const buildPayload = () => {
        if (!selectedCompany) return null;
        type PdfRow = { label: string; value: number | string; indent?: boolean; bold?: boolean };
        const sections: Array<{ title: string; rows: PdfRow[] }> = [];
        let current: { title: string; rows: PdfRow[] } | null = null;

        const THRESHOLD = 375000;
        const taxableIncomePeriod = Number(computedData.taxableIncomeTaxPeriod) || 0;
        const balance = Math.max(0, taxableIncomePeriod - THRESHOLD);
        const ctLiability = Number(computedData.corporateTaxLiability) || 0;
        const taxCredits = Number(computedData.taxCredits) || 0;
        const ctPayable = Number(computedData.corporateTaxPayable) || 0;

        const breakdownTriggerField = "taxableIncomeTaxPeriod";
        const skipRemainingAfterBreakdown = new Set([
            "corporateTaxLiability",
            "taxCredits",
            "corporateTaxPayable"
        ]);

        TAX_COMPUTATION_FIELDS.forEach((f) => {
            if (f.type === "header") {
                current = { title: f.label, rows: [] };
                sections.push(current);
                return;
            }
            if (!current) return;
            if (skipRemainingAfterBreakdown.has(f.field)) return;

            const value = Number(computedData[f.field]) || 0;
            current.rows.push({ label: f.label, value, bold: !!f.highlight });

            if (f.field === breakdownTriggerField) {
                current.rows.push({
                    label: "Tax Upto 375,000 AED (Nil Rate)",
                    value: "- NIL -",
                    indent: true
                });
                if (balance > 0) {
                    current.rows.push({
                        label: "Balance Taxable Income Above AED 375,000",
                        value: balance,
                        indent: true
                    });
                    current.rows.push({
                        label: `Tax @ 9% of ${balance.toLocaleString("en-US")} (AED)`,
                        value: Math.round(balance * 0.09),
                        indent: true
                    });
                }
                current.rows.push({
                    label: "Corporate Tax Liability (AED)",
                    value: ctLiability,
                    bold: true
                });
                current.rows.push({
                    label: "Tax Credits (AED)",
                    value: taxCredits
                });
                current.rows.push({
                    label: "Corporate Tax Payable (AED)",
                    value: ctPayable,
                    bold: true
                });
            }
        });

        return {
            companyName: selectedCompany.name,
            companyLocation: selectedCompany.address || "",
            periodFromDate: periodFromParam,
            periodToDate: periodToParam,
            sections
        };
    };

    const generatePdfBlob = async () => {
        const payload = buildPayload();
        if (!payload) return;
        return ctFilingService.downloadTaxComputationPdf(payload);
    };

    const handlePreview = async () => {
        setIsPreviewLoading(true);
        try {
            const blob = await generatePdfBlob();
            if (!blob) return;
            if (previewUrl) window.URL.revokeObjectURL(previewUrl);
            const nextPreviewUrl = window.URL.createObjectURL(blob);
            setPreviewUrl(nextPreviewUrl);
            setShowPreview(true);
        } catch (error: any) {
            console.error("Preview Tax Computation PDF error:", error);
            alert("Failed to preview PDF: " + error.message);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!selectedCompany) return;
        setIsDownloading(true);
        try {
            const blob = await generatePdfBlob();
            if (!blob) return;
            const fileName = `TaxComputation_${selectedCompany.name.replace(/\s+/g, "_")}.pdf`;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error("Download Tax Computation PDF error:", error);
            alert("Failed to generate PDF: " + error.message);
        } finally {
            setIsDownloading(false);
        }
    };

    const closePreview = () => setShowPreview(false);

    if (!customerId) {
        return (
            <div className="min-h-full bg-background text-foreground p-8">
                <CtCompanyList
                    companies={projectCompanies}
                    onSelectCompany={handleSelectCompany}
                    title="Select Company for Tax Computation"
                />

                {pendingCompany && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">Enter Filing Period</h3>
                                    <p className="mt-0.5 text-sm text-muted-foreground">
                                        For <span className="font-medium text-foreground">{pendingCompany.name}</span>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClosePeriodModal}
                                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4 px-5 py-5">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                                            From <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={pendingFromDate}
                                            onChange={(e) => {
                                                setPendingFromDate(e.target.value);
                                                if (periodError) setPeriodError(null);
                                            }}
                                            className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                                            To <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={pendingToDate}
                                            onChange={(e) => {
                                                setPendingToDate(e.target.value);
                                                if (periodError) setPeriodError(null);
                                            }}
                                            className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>

                                {periodError && (
                                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
                                        {periodError}
                                    </div>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    The filing period will be used as the Tax Period on the computation sheet.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">
                                <button
                                    type="button"
                                    onClick={handleClosePeriodModal}
                                    className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmPeriod}
                                    disabled={!pendingFromDate || !pendingToDate}
                                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Continue
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (!selectedCompany) {
        return <SimpleLoading message="Loading company details..." />;
    }

    return (
        <div className="min-h-full bg-background text-foreground p-8">
            <button
                onClick={() => navigate("/tax-computation")}
                className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Customers
            </button>

            <div className="mx-auto max-w-6xl space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{selectedCompany.name}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Enter tax computation details manually. Totals and tax liability are calculated automatically.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">Corporate Tax TRN</div>
                                <div className="mt-1 font-medium text-foreground">
                                    {selectedCompany.corporateTaxTrn || selectedCompany.trn || "-"}
                                </div>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">Filing Period</div>
                                <div className="mt-1 font-medium text-foreground">
                                    {periodFromParam || "-"} to {periodToParam || "-"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                                <ChartBarIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight text-foreground">Tax Computation Sheet</h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    All figures in AED. Highlighted rows are computed automatically.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={handlePreview}
                                disabled={isPreviewLoading}
                                className="inline-flex items-center justify-center rounded-xl border border-border bg-muted px-5 py-3 font-semibold text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <EyeIcon className="mr-2 h-5 w-5" />
                                {isPreviewLoading ? "Preparing Preview..." : "Preview PDF"}
                            </button>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <DocumentArrowDownIcon className="mr-2 h-5 w-5" />
                                {isDownloading ? "Generating..." : "Download PDF"}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-6 py-4">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={sbrClaimed}
                                onChange={(e) => setSbrClaimed(e.target.checked)}
                                className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
                            />
                            <span className="text-sm font-medium text-foreground">Small Business Relief Claimed</span>
                        </label>
                        {sbrClaimed && (
                            <div className="flex items-center gap-2 rounded-xl border border-status-success bg-status-success-soft px-3 py-1.5">
                                <CheckCircleIcon className="h-4 w-4 text-status-success" />
                                <span className="text-[11px] font-bold uppercase tracking-tight text-status-success">
                                    SBR applied — all values set to 0
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 p-6">
                        {TAX_COMPUTATION_FIELDS.map((f) => {
                            if (f.type === "header") {
                                return (
                                    <div key={f.field} className="pt-4 pb-2 border-b border-border/50">
                                        <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">
                                            {f.label.replace(/-/g, "").trim()}
                                        </h4>
                                    </div>
                                );
                            }

                            const currentValue = computedData[f.field] ?? 0;
                            const isComputed = !!f.computed || sbrClaimed;

                            return (
                                <div
                                    key={f.field}
                                    className={`flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                                        f.highlight
                                            ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10"
                                            : "bg-muted/20 border-border/50"
                                    }`}
                                >
                                    <span
                                        className={`text-xs font-bold uppercase tracking-tight ${
                                            f.highlight ? "text-primary" : "text-muted-foreground"
                                        }`}
                                    >
                                        {f.label}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {isComputed ? (
                                            <span
                                                className={`font-mono font-bold text-base text-right w-48 ${
                                                    f.highlight ? "text-primary" : "text-foreground"
                                                }`}
                                            >
                                                {formatCurrency(currentValue)}
                                            </span>
                                        ) : (
                                            <input
                                                type="number"
                                                value={currentValue}
                                                onChange={(e) => handleFieldChange(f.field, e.target.value)}
                                                className={`font-mono font-bold text-base text-right bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none transition-all w-48 ${
                                                    f.highlight ? "text-primary" : "text-foreground"
                                                }`}
                                            />
                                        )}
                                        <span className="text-[10px] opacity-60 ml-0.5">AED</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {showPreview && previewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">Tax Computation PDF Preview</h3>
                                <p className="text-sm text-muted-foreground">Review before downloading.</p>
                            </div>
                            <button
                                type="button"
                                onClick={closePreview}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 bg-muted/20 p-4">
                            <iframe
                                title="Tax Computation PDF Preview"
                                src={previewUrl}
                                className="h-full w-full rounded-xl border border-border bg-white"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-4">
                            <button
                                type="button"
                                onClick={closePreview}
                                className="rounded-xl border border-border px-4 py-2.5 font-medium text-foreground transition-colors hover:bg-muted"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <DocumentArrowDownIcon className="mr-2 h-5 w-5" />
                                {isDownloading ? "Generating..." : "Download PDF"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
