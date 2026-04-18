
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { ctFilingService } from '../services/ctFilingService';
import { CtType, Company } from '../types';
import {
    ChevronLeftIcon,
    CalendarDaysIcon,
    ArrowRightIcon,
    XMarkIcon
} from './icons';
import { SimpleLoading } from './SimpleLoading';

const parseDateString = (dateStr?: string | null): Date | null => {
    if (!dateStr) return null;

    const trimmed = dateStr.trim();
    if (!trimmed) return null;

    const ymd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
        const date = new Date(0);
        date.setFullYear(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
        date.setHours(0, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
        const date = new Date(0);
        date.setFullYear(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
        date.setHours(0, 0, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const fallback = new Date(trimmed);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const toInputDate = (date: Date | null): string => {
    if (!date || Number.isNaN(date.getTime())) return '';
    const y = String(date.getFullYear()).padStart(4, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const CtAddFilingPeriod: React.FC = () => {
    const { customerId, typeName } = useParams<{ customerId: string, typeName: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { projectCompanies } = useData();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [company, setCompany] = useState<Company | null>(null);
    const [currentType, setCurrentType] = useState<CtType | null>(null);

    const [formData, setFormData] = useState({
        periodFrom: '',
        periodTo: '',
        dueDate: '',
        status: 'Not Started'
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!customerId || !typeName) return;

            setLoading(true);
            try {
                // Find company
                const foundCompany = projectCompanies.find(c => c.id === customerId);
                if (foundCompany) setCompany(foundCompany);

                // Fetch CT types
                const types = await ctFilingService.getCtTypes();
                const typeNum = (typeName.match(/\d+/)?.[0] || '').trim();
                const targetName = `CT Type ${typeNum}`;
                const matchedType =
                    types.find(t => t.name.toLowerCase() === targetName.toLowerCase()) ||
                    (typeNum ? types.find(t => new RegExp(`\\btype\\s*${typeNum}\\b`, 'i').test(t.name)) : undefined);

                if (matchedType) {
                    setCurrentType(matchedType);

                    // Fetch existing periods to see if we need to calculate subsequent one
                    const existingPeriods = await ctFilingService.getFilingPeriods(customerId, matchedType.id);

                    if (existingPeriods.length > 0) {
                        // Calculate next period from the latest one
                        const latest = existingPeriods[0]; // sorted by period_from desc
                        const lastEnd = parseDateString(latest.periodTo);
                        if (lastEnd) {
                            const nextStart = new Date(lastEnd);
                            nextStart.setDate(nextStart.getDate() + 1);

                            const startStr = toInputDate(nextStart);
                            if (startStr) calculateAndSetDates(startStr);
                        }
                    } else if (foundCompany) {
                        // Use company details from CT certificate for the first period
                        const startStr = toInputDate(parseDateString(foundCompany.ctPeriodStart));
                        const endStr = toInputDate(parseDateString(foundCompany.ctPeriodEnd));
                        const dueStr = toInputDate(parseDateString(foundCompany.ctDueDate));

                        if (startStr && endStr && dueStr) {
                            // Use exact dates from certificate for the first period
                            setFormData(prev => ({
                                ...prev,
                                periodFrom: startStr,
                                periodTo: endStr,
                                dueDate: dueStr
                            }));
                        } else if (startStr) {
                            // Fallback to auto-calculation if certificate dates are incomplete
                            calculateAndSetDates(startStr);
                        }
                    }
                }
            } catch (error) {
                console.error("Error initializing add period form:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [customerId, typeName, projectCompanies]);

    const calculateAndSetDates = (startDate: string) => {
        const start = parseDateString(startDate);
        if (!start || start.getFullYear() < 1900) {
            setFormData(prev => ({
                ...prev,
                periodFrom: startDate,
                periodTo: '',
                dueDate: ''
            }));
            return;
        }

        // Period To: 1 year later minus 1 day
        const end = new Date(0);
        end.setFullYear(start.getFullYear() + 1, start.getMonth(), start.getDate() - 1);
        end.setHours(0, 0, 0, 0);

        // Due Date: 9 months after Period To
        const due = new Date(0);
        due.setFullYear(end.getFullYear(), end.getMonth() + 9, end.getDate());
        due.setHours(0, 0, 0, 0);

        setFormData(prev => ({
            ...prev,
            periodFrom: startDate,
            periodTo: toInputDate(end),
            dueDate: toInputDate(due)
        }));
    };

    const handlePeriodFromChange = (value: string) => {
        calculateAndSetDates(value);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerId || !currentType || !currentUser) return;

        setSaving(true);
        try {
            await ctFilingService.addFilingPeriod({
                userId: currentUser.id,
                customerId: customerId,
                ctTypeId: currentType.id,
                periodFrom: formData.periodFrom,
                periodTo: formData.periodTo,
                dueDate: formData.dueDate,
                status: formData.status
            });

            navigate(`/projects/ct-filing/${customerId}/${typeName}/filing-periods`);
        } catch (error: any) {
            alert("Error saving period: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SimpleLoading message="Initialising form..." />;
    if (!company || !currentType) return <div className="p-8 text-center text-status-danger">Resource not found</div>;

    return (
        <div className="min-h-full bg-background text-foreground p-8">
            <button
                onClick={() => navigate(`/projects/ct-filing/${customerId}/${typeName}/filing-periods`)}
                className="mb-6 text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to List
            </button>

            <div className="max-w-2xl mx-auto">
                <div className="bg-card rounded-xl border border-border shadow-2xl overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center space-x-4 mb-8">
                            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center ring-1 ring-primary/50">
                                <CalendarDaysIcon className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground tracking-tight">Add Filing Period</h2>
                                <p className="text-muted-foreground text-sm mt-1">
                                    Creating for {company.name} - <span className="text-primary">{currentType.name}</span>
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Period From</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.periodFrom}
                                        onChange={(e) => handlePeriodFromChange(e.target.value)}
                                        className="w-full p-4 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Period To</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.periodTo}
                                        onChange={(e) => setFormData(prev => ({ ...prev, periodTo: e.target.value }))}
                                        className="w-full p-4 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Due Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                        className="w-full p-4 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                        className="w-full p-4 bg-muted border border-border rounded-lg text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                    >
                                        <option value="Not Started">Not Started</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                        <option value="Completed & Filed">Completed & Filed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className={`w-full flex items-center justify-center p-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-all shadow-lg shadow-primary/20 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {saving ? 'Saving...' : 'Save Period'}
                                    {!saving && <ArrowRightIcon className="w-5 h-5 ml-2" />}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="px-8 py-4 bg-muted/50 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            * Dates are auto-calculated based on CT rules: 1-year period and 9-month filing window.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

