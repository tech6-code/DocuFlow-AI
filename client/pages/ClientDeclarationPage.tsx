import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CtCompanyList } from "../components/CtCompanyList";
import { ChevronLeftIcon, DocumentArrowDownIcon, DocumentTextIcon, EyeIcon, XMarkIcon } from "../components/icons";
import { SimpleLoading } from "../components/SimpleLoading";
import { useData } from "../contexts/DataContext";
import { getLouTemplateById, LOU_TEMPLATES, type LouFormData } from "../constants/louTemplates";
import { ctFilingService } from "../services/ctFilingService";
import type { Company } from "../types";

type LouTemplateId = typeof LOU_TEMPLATES[number]["id"];

export const ClientDeclarationPage: React.FC = () => {
    const navigate = useNavigate();
    const { customerId } = useParams<{ customerId: string }>();
    const { projectCompanies } = useData();

    const selectedCompany = useMemo(
        () => projectCompanies.find((company) => company.id === customerId) || null,
        [projectCompanies, customerId]
    );

    const [selectedTemplateId, setSelectedTemplateId] = useState<LouTemplateId>("type1");
    const [formData, setFormData] = useState<LouFormData | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (!selectedCompany) return;
        const { formData: nextFormData } = getLouTemplateById(selectedTemplateId, selectedCompany);
        setFormData(nextFormData);
    }, [selectedCompany, selectedTemplateId]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                window.URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const handleSelectCompany = (company: Company) => {
        navigate(`/client-declaration/${company.id}`);
    };

    const handleChange = (field: keyof LouFormData, value: string) => {
        setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
    };

    const generateLouPdfBlob = async () => {
        if (!selectedCompany || !formData) return;

        return ctFilingService.downloadLouPdf({
            ...formData,
            companyName: selectedCompany.name,
            signatoryTitle: formData.designation
        });
    };

    const handlePreview = async () => {
        setIsPreviewLoading(true);
        try {
            const blob = await generateLouPdfBlob();
            if (!blob) return;

            if (previewUrl) {
                window.URL.revokeObjectURL(previewUrl);
            }

            const nextPreviewUrl = window.URL.createObjectURL(blob);
            setPreviewUrl(nextPreviewUrl);
            setShowPreview(true);
        } catch (error: any) {
            console.error("Preview LOU PDF error:", error);
            alert("Failed to preview LOU PDF: " + error.message);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const handleDownload = async () => {
        if (!selectedCompany) return;

        setIsDownloading(true);
        try {
            const blob = await generateLouPdfBlob();
            if (!blob) return;

            const fileName = `LOU_${selectedCompany.name.replace(/\s+/g, "_")}_${selectedTemplateId.toUpperCase()}.pdf`;
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error("Download LOU PDF error:", error);
            alert("Failed to generate LOU PDF: " + error.message);
        } finally {
            setIsDownloading(false);
        }
    };

    const closePreview = () => {
        setShowPreview(false);
    };

    if (!customerId) {
        return (
            <div className="min-h-full bg-background text-foreground p-8">
                <CtCompanyList
                    companies={projectCompanies}
                    onSelectCompany={handleSelectCompany}
                    title="Select Company for Client Declaration"
                />
            </div>
        );
    }

    if (!selectedCompany) {
        return <SimpleLoading message="Loading customer declaration details..." />;
    }

    if (!formData) {
        return <SimpleLoading message="Preparing declaration template..." />;
    }

    return (
        <div className="min-h-full bg-background text-foreground p-8">
            <button
                onClick={() => navigate("/client-declaration")}
                className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Customers
            </button>

            <div className="mx-auto max-w-7xl space-y-6">
                <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">{selectedCompany.name}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Create and download a client declaration / LOU PDF for this customer.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">Corporate Tax TRN</div>
                                <div className="mt-1 font-medium text-foreground">{selectedCompany.corporateTaxTrn || selectedCompany.trn || "-"}</div>
                            </div>
                            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                                <div className="text-xs uppercase tracking-wide text-muted-foreground">CT Period</div>
                                <div className="mt-1 font-medium text-foreground">
                                    {selectedCompany.ctPeriodStart || "-"} to {selectedCompany.ctPeriodEnd || "-"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                                <DocumentTextIcon className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">LOU Templates</h3>
                                <p className="text-sm text-muted-foreground">Choose one of the 4 existing CT declaration variants.</p>
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {LOU_TEMPLATES.map((template) => {
                                const active = template.id === selectedTemplateId;
                                return (
                                    <button
                                        key={template.id}
                                        type="button"
                                        onClick={() => setSelectedTemplateId(template.id)}
                                        className={`w-full rounded-xl border px-4 py-4 text-left transition-all ${
                                            active
                                                ? "border-primary bg-primary/10 shadow-sm"
                                                : "border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="font-semibold text-foreground">{template.label}</span>
                                            <span className={`text-xs font-semibold uppercase ${active ? "text-primary" : "text-muted-foreground"}`}>
                                                {active ? "Selected" : "Template"}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">{template.description}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card shadow-sm">
                        <div className="border-b border-border px-6 py-5">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h3 className="text-xl font-bold tracking-tight text-foreground">Declaration Editor</h3>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        Edit any field before generating the LOU PDF.
                                    </p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={handlePreview}
                                        disabled={isPreviewLoading}
                                        className="inline-flex items-center justify-center rounded-xl border border-border bg-muted px-5 py-3 font-semibold text-foreground transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <EyeIcon className="mr-2 h-5 w-5" />
                                        {isPreviewLoading ? "Preparing Preview..." : "Preview LOU PDF"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDownload}
                                        disabled={isDownloading}
                                        className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <DocumentArrowDownIcon className="mr-2 h-5 w-5" />
                                        {isDownloading ? "Generating..." : "Download LOU PDF"}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 p-6">
                            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Date</label>
                                    <input
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => handleChange("date", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">To</label>
                                    <input
                                        type="text"
                                        value={formData.to}
                                        onChange={(e) => handleChange("to", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Subject</label>
                                    <input
                                        type="text"
                                        value={formData.subject}
                                        onChange={(e) => handleChange("subject", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Taxable Person</label>
                                    <input
                                        type="text"
                                        value={formData.taxablePerson}
                                        onChange={(e) => handleChange("taxablePerson", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Tax Period</label>
                                    <input
                                        type="text"
                                        value={formData.taxPeriod}
                                        onChange={(e) => handleChange("taxPeriod", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">TRN</label>
                                    <input
                                        type="text"
                                        value={formData.trn}
                                        onChange={(e) => handleChange("trn", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Authorized Signatory Name</label>
                                    <input
                                        type="text"
                                        value={formData.signatoryName}
                                        onChange={(e) => handleChange("signatoryName", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-muted-foreground">Designation</label>
                                    <input
                                        type="text"
                                        value={formData.designation}
                                        onChange={(e) => handleChange("designation", e.target.value)}
                                        className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium text-muted-foreground">Content</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => handleChange("content", e.target.value)}
                                    rows={14}
                                    className="w-full rounded-2xl border border-border bg-muted px-4 py-4 text-foreground outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showPreview && previewUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                        <div className="flex items-center justify-between border-b border-border px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-foreground">LOU PDF Preview</h3>
                                <p className="text-sm text-muted-foreground">
                                    Review the generated declaration before downloading.
                                </p>
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
                                title="LOU PDF Preview"
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
