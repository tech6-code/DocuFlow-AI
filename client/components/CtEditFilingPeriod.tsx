
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { ctFilingService } from '../services/ctFilingService';
import { CtFilingPeriod, Company } from '../types';
import { ChevronLeftIcon, BuildingOfficeIcon, CalendarDaysIcon } from './icons';
import { SimpleLoading } from './SimpleLoading';

export const CtEditFilingPeriod: React.FC = () => {
    const { customerId, typeName, periodId } = useParams<{ customerId: string, typeName: string, periodId: string }>();
    const navigate = useNavigate();
    const { projectCompanies } = useData();

    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        periodFrom: '',
        periodTo: '',
        dueDate: '',
        status: 'Not Started'
    });

    useEffect(() => {
        const fetchDetails = async () => {
            if (!customerId || !periodId) return;

            try {
                const foundCompany = projectCompanies.find(c => c.id === customerId);
                if (foundCompany) setCompany(foundCompany);

                const period = await ctFilingService.getFilingPeriodById(periodId);
                if (period) {
                    setFormData({
                        periodFrom: period.periodFrom ? new Date(period.periodFrom).toISOString().split('T')[0] : '',
                        periodTo: period.periodTo ? new Date(period.periodTo).toISOString().split('T')[0] : '',
                        dueDate: period.dueDate ? new Date(period.dueDate).toISOString().split('T')[0] : '',
                        status: period.status || 'Not Started'
                    });
                } else {
                    setError("Filing period not found");
                }
            } catch (err: any) {
                setError(err.message || "Failed to load details");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [customerId, periodId, projectCompanies]);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!periodId) return;

        setSubmitting(true);
        setError(null);

        try {
            await ctFilingService.updateFilingPeriod(periodId, {
                periodFrom: formData.periodFrom,
                periodTo: formData.periodTo,
                dueDate: formData.dueDate,
                status: formData.status
            });

            // Navigate back to the list
            navigate(`/projects/ct-filing/${customerId}/${typeName}/filing-periods`);
        } catch (err: any) {
            setError(err.message || "Failed to update filing period");
            setSubmitting(false);
        }
    };

    if (loading) return <SimpleLoading message="Loading filing details..." />;

    if (error) {
        return (
            <div className="min-h-full bg-background text-foreground p-8 flex flex-col items-center justify-center">
                <div className="text-destructive mb-4">{error}</div>
                <button onClick={() => navigate(-1)} className="text-primary hover:underline">Go Back</button>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-background text-foreground p-8 flex items-center justify-center">
            <div className="w-full max-w-lg">
                <button
                    onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/filing-periods`)}
                    className="mb-8 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
                >
                    <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to List
                </button>

                <div className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-border bg-muted/20">
                        <div className="flex items-center space-x-4 mb-2">
                            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
                                <BuildingOfficeIcon className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-foreground tracking-tight">Edit Filing Period</h2>
                                <p className="text-sm text-muted-foreground">{company?.name}</p>
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest">Period From</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    value={formData.periodFrom}
                                    onChange={(e) => handleChange('periodFrom', e.target.value)}
                                    className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none outline-none"
                                />
                                <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest">Period To</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    value={formData.periodTo}
                                    onChange={(e) => handleChange('periodTo', e.target.value)}
                                    className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none outline-none"
                                />
                                <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest">Due Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    value={formData.dueDate}
                                    onChange={(e) => handleChange('dueDate', e.target.value)}
                                    className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none outline-none"
                                />
                                <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase mb-2 tracking-widest">Status</label>
                            <div className="relative">
                                <select
                                    value={formData.status}
                                    onChange={(e) => handleChange('status', e.target.value)}
                                    className="w-full p-3 bg-muted border border-border rounded-xl text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none transition-all outline-none"
                                >
                                    <option value="Not Started">Not Started</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Submitted">Submitted</option>
                                    <option value="Overdue">Overdue</option>
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
                                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="px-6 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground bg-transparent hover:bg-muted/50 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-8 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-extrabold rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transform hover:translate-y-px"
                            >
                                {submitting ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
