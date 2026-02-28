import React, { useEffect, useMemo, useState } from 'react';
import type { Company, VatFilingConversion } from '../types';
import { vatFilingService } from '../services/vatFilingService';
import { ArrowUpRightIcon, ChevronLeftIcon, EyeIcon, PencilIcon, PlusIcon, TrashIcon } from './icons';
import { ConfirmationDialog } from './ConfirmationDialog';

interface VatFilingConversionsListProps {
    company: Company;
    periodId: string;
    onBackToPeriods: () => void;
    onOpenConversion: (conversionId: string) => void;
    onEditConversion: (conversionId: string) => void;
    onNewUpload: () => void;
}

const formatDateTime = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
};

export const VatFilingConversionsList: React.FC<VatFilingConversionsListProps> = ({
    company,
    periodId,
    onBackToPeriods,
    onOpenConversion,
    onEditConversion,
    onNewUpload
}) => {
    const [loading, setLoading] = useState(false);
    const [conversions, setConversions] = useState<VatFilingConversion[]>([]);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const sorted = useMemo(
        () => [...conversions].sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime()),
        [conversions]
    );

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        vatFilingService.listConversions(periodId)
            .then((rows) => {
                if (!mounted) return;
                setConversions(rows || []);
            })
            .catch((error) => {
                console.error('Failed to load VAT conversions:', error);
                if (mounted) setConversions([]);
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => {
            mounted = false;
        };
    }, [periodId]);

    const handleDelete = async () => {
        if (!deleteTargetId) return;
        try {
            await vatFilingService.deleteConversion(deleteTargetId);
            setConversions(prev => prev.filter(row => row.id !== deleteTargetId));
            setDeleteTargetId(null);
        } catch (error) {
            console.error('Failed to delete VAT conversion:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <button
                        onClick={onBackToPeriods}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors mb-2"
                    >
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to periods
                    </button>
                    <h2 className="text-3xl font-bold text-foreground tracking-tight">VAT Filing - Conversions</h2>
                    <p className="text-muted-foreground mt-2">All saved conversions for this filing period.</p>
                    <p className="text-muted-foreground mt-2">
                        Customer: <span className="font-semibold text-foreground">{company.name}</span>
                        <span className="ml-3 text-sm">TRN: {company.trn || 'N/A'}</span>
                    </p>
                </div>
                <button
                    onClick={onNewUpload}
                    className="inline-flex items-center px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                >
                    <PlusIcon className="w-4 h-4 mr-2" /> New Upload
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs text-foreground uppercase bg-muted border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-bold tracking-wider w-20">No</th>
                                <th className="px-4 py-3 font-bold tracking-wider">Conversion</th>
                                <th className="px-4 py-3 font-bold tracking-wider w-40">Status</th>
                                <th className="px-4 py-3 font-bold tracking-wider">Company Name</th>
                                <th className="px-4 py-3 font-bold tracking-wider w-52">Created</th>
                                <th className="px-4 py-3 font-bold tracking-wider w-52">Last Updated</th>
                                <th className="px-4 py-3 font-bold tracking-wider text-center w-28">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading conversions...</td>
                                </tr>
                            ) : sorted.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No conversions found for this period.</td>
                                </tr>
                            ) : (
                                sorted.map((conversion, index) => (
                                    <tr key={conversion.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                                        <td className="px-4 py-3 text-foreground">{index + 1}</td>
                                        <td className="px-4 py-3 text-foreground font-medium">{conversion.conversionName || `Conversion ${index + 1}`}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-primary/10 text-primary border-primary/20">
                                                {conversion.status || 'draft'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">{company.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(conversion.createdAt)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(conversion.updatedAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => onOpenConversion(conversion.id)}
                                                    className="p-1.5 rounded-md text-primary hover:bg-primary/10 transition-colors"
                                                    title="Show Conversion"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => onEditConversion(conversion.id)}
                                                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                                    title="Edit Conversion"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={onNewUpload}
                                                    className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                                                    title="New Upload"
                                                >
                                                    <ArrowUpRightIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTargetId(conversion.id)}
                                                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                                    title="Delete Conversion"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ConfirmationDialog
                isOpen={!!deleteTargetId}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTargetId(null)}
                title="Delete Conversion"
                confirmText="Delete"
                cancelText="Cancel"
            >
                Are you sure you want to delete this conversion?
            </ConfirmationDialog>
        </div>
    );
};
