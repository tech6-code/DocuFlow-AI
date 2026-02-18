
import React, { useState } from 'react';
import { BuildingOfficeIcon, CalendarDaysIcon, IdentificationIcon, ChevronLeftIcon, BriefcaseIcon, ClockIcon, UploadIcon, SparklesIcon } from './icons';
import type { Company } from '../types';
import { extractBusinessEntityDetails } from '../services/geminiService';

interface CtCompanyDetailsFormProps {
    onConfirm: (companyData: Omit<Company, 'id'>) => void;
    onCancel: () => void;
}

const fileToPart = (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const result = event.target?.result as string;
            const base64 = result.split(',')[1];
            resolve({ inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } });
        };
        reader.onerror = reject;
    });
};

const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.startDate && val.endDate) return `${val.startDate} - ${val.endDate}`;
        if (val.start && val.end) return `${val.start} - ${val.end}`;
        return '';
    }
    return '';
};

// Robust helper to convert various date string formats to YYYY-MM-DD
const convertToIsoDate = (dateStr: string): string => {
    if (!dateStr) return '';

    const cleanStr = dateStr.trim();

    // 1. Check if already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;

    // 2. Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmyMatch = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
    }

    // 3. Try Generic Date Parse
    const date = new Date(cleanStr);
    if (!isNaN(date.getTime())) {
        try {
            return date.toISOString().split('T')[0];
        } catch (e) {
            // fallback
        }
    }

    return '';
};

export const CtCompanyDetailsForm: React.FC<CtCompanyDetailsFormProps> = ({
    onConfirm,
    onCancel
}) => {
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        trn: '',
        incorporationDate: '',
        businessType: 'Limited Liability Company',
        financialYear: '',
        reportingPeriod: '',
        periodStart: '',
        periodEnd: '',
        dueDate: ''
    });
    const [isExtracting, setIsExtracting] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name) {
            onConfirm(formData);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsExtracting(true);
            try {
                const files = Array.from(e.target.files);
                const parts = await Promise.all(files.map((file: File) => fileToPart(file)));
                const extractedRaw = await extractBusinessEntityDetails(parts);

                // Sanitize extracted object values
                const extracted: any = {};
                Object.keys(extractedRaw).forEach(key => {
                    extracted[key] = safeString(extractedRaw[key]);
                });

                let financialYear = '';
                let reportingPeriod = '';
                let periodStart = '';
                let periodEnd = '';
                let dueDate = '';

                if (extracted.firstCorporateTaxPeriodStart && extracted.firstCorporateTaxPeriodEnd) {
                    // Simple logic to guess Financial Year from start date
                    const startYear = extracted.firstCorporateTaxPeriodStart.split(/[\/\-]/).pop();
                    if (startYear && startYear.length === 4) financialYear = startYear;

                    reportingPeriod = `${extracted.firstCorporateTaxPeriodStart} - ${extracted.firstCorporateTaxPeriodEnd}`;
                    periodStart = extracted.firstCorporateTaxPeriodStart;
                    periodEnd = extracted.firstCorporateTaxPeriodEnd;
                }

                if (extracted.corporateTaxFilingDueDate) {
                    dueDate = extracted.corporateTaxFilingDueDate;
                }

                setFormData(prev => ({
                    ...prev,
                    name: extracted.companyName || prev.name,
                    address: extracted.billingAddress || prev.address,
                    trn: extracted.corporateTaxTrn || extracted.trn || prev.trn,
                    incorporationDate: convertToIsoDate(extracted.incorporationDate) || prev.incorporationDate,
                    businessType: extracted.entityType || prev.businessType,
                    financialYear: financialYear || prev.financialYear,
                    reportingPeriod: reportingPeriod || prev.reportingPeriod,
                    periodStart: periodStart || prev.periodStart,
                    periodEnd: periodEnd || prev.periodEnd,
                    dueDate: dueDate || prev.dueDate,
                }));

            } catch (err) {
                console.error("Failed to extract company details", err);
            } finally {
                setIsExtracting(false);
            }
        }
    };

    return (
        <div className="max-w-3xl mx-auto">
            <button
                onClick={onCancel}
                className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Companies
            </button>

            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Add New Company</h2>
                <p className="mt-2 text-lg text-muted-foreground">Enter the entity details to begin Corporate Tax Filing.</p>
            </div>

            {/* Upload Section */}
            <div className="bg-card/50 p-6 rounded-xl border border-dashed border-border mb-8 flex flex-col items-center justify-center text-center">
                <div className="mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-2">
                        {isExtracting ? <SparklesIcon className="w-6 h-6 text-primary animate-pulse" /> : <UploadIcon className="w-6 h-6 text-muted-foreground" />}
                    </div>
                    <h3 className="text-foreground font-semibold">Auto-fill from Documents</h3>
                    <p className="text-sm text-muted-foreground mt-1">Upload Trade License or Tax Certificate to automatically populate details.</p>
                </div>
                <label className={`flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer transition-colors ${isExtracting ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <span className="text-sm font-semibold">{isExtracting ? 'Extracting...' : 'Upload Document'}</span>
                    <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} disabled={isExtracting} />
                </label>
            </div>

            <div className="bg-card p-8 rounded-xl border border-border shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Client Name *</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <BuildingOfficeIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="block w-full pl-10 p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                    placeholder="e.g. Acme Corp LLC"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Address</label>
                            <textarea
                                name="address"
                                rows={2}
                                value={formData.address}
                                onChange={handleChange}
                                className="block w-full p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                placeholder="Enter registered office address"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Incorporation Date</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <CalendarDaysIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                                <input
                                    type="date"
                                    name="incorporationDate"
                                    value={formData.incorporationDate}
                                    onChange={handleChange}
                                    className="block w-full pl-10 p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Type of Business Registration</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <BriefcaseIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                                <input
                                    type="text"
                                    name="businessType"
                                    value={formData.businessType}
                                    onChange={handleChange}
                                    className="block w-full pl-10 p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                    placeholder="e.g. Limited Liability Company"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Financial Year</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <ClockIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                                <input
                                    type="text"
                                    name="financialYear"
                                    value={formData.financialYear}
                                    onChange={handleChange}
                                    className="block w-full pl-10 p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                    placeholder="e.g. 2024"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Reporting Period</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <CalendarDaysIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                                <input
                                    type="text"
                                    name="reportingPeriod"
                                    value={formData.reportingPeriod}
                                    onChange={handleChange}
                                    className="block w-full pl-10 p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                    placeholder="e.g. Jan 1 - Dec 31"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-muted-foreground mb-2">Tax Registration Number (TRN)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <IdentificationIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                                <input
                                    type="text"
                                    name="trn"
                                    value={formData.trn}
                                    onChange={handleChange}
                                    className="block w-full pl-10 p-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-primary focus:border-primary transition-colors outline-none"
                                    placeholder="15-digit TRN"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-3">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="w-full flex justify-center py-3 px-4 border border-border rounded-lg shadow-sm text-sm font-bold text-muted-foreground bg-transparent hover:bg-muted transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                        >
                            Add Company
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
