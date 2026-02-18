
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
                const typeNum = typeName.replace('type', '');
                const targetName = `CT Type ${typeNum}`;
                const matchedType = types.find(t => t.name.toLowerCase() === targetName.toLowerCase());

                if (matchedType) {
                    setCurrentType(matchedType);

                    // Fetch existing periods to see if we need to calculate subsequent one
                    const existingPeriods = await ctFilingService.getFilingPeriods(customerId, matchedType.id);

                    if (existingPeriods.length > 0) {
                        // Calculate next period from the latest one
                        const latest = existingPeriods[0]; // sorted by period_from desc
                        const lastEnd = new Date(latest.periodTo);
                        const nextStart = new Date(lastEnd);
                        nextStart.setDate(nextStart.getDate() + 1);

                        const startStr = nextStart.toISOString().split('T')[0];
                        calculateAndSetDates(startStr);
                    } else if (foundCompany) {
                        // Use company details for the first period
                        let startStr = '';
                        if (foundCompany.ctPeriodStart) {
                            if (foundCompany.ctPeriodStart.includes('/')) {
                                const parts = foundCompany.ctPeriodStart.split('/');
                                startStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
                            } else {
                                startStr = foundCompany.ctPeriodStart;
                            }
                        }

                        if (startStr) {
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
        const start = new Date(startDate);

        // Period To: 1 year later minus 1 day
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + 1);
        end.setDate(end.getDate() - 1);

        // Due Date: 9 months after Period To
        const due = new Date(end);
        due.setMonth(due.getMonth() + 9);

        setFormData(prev => ({
            ...prev,
            periodFrom: startDate,
            periodTo: end.toISOString().split('T')[0],
            dueDate: due.toISOString().split('T')[0]
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
    if (!company || !currentType) return <div className="p-8 text-center text-red-500">Resource not found</div>;

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
