
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Company } from '../types';
import { BuildingOfficeIcon, PlusIcon, ChevronLeftIcon, IdentificationIcon, TrashIcon, XMarkIcon, CalendarDaysIcon, ArrowUpRightIcon } from './icons';

interface CtFilingDashboardProps {
    company: Company;
    onNewFiling: (periodFrom: string, periodTo: string) => void;
    onBack: () => void;
}

interface FilingRecord {
    id: string;
    periodFrom: string;
    periodTo: string;
    dueDate: string;
    submitDate: string;
    status: string;
    position: string;
}

// Helper to convert date object to YYYY-MM-DD string for inputs
const toInputDate = (date: Date): string => {
    if (isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
};

// Helper to parse DD/MM/YYYY or YYYY-MM-DD strings into a Date object
const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr) return null;

    // Try YYYY-MM-DD
    const ymd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymd) {
        return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
    }

    // Try DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = dateStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
        return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
    }

    // Try new Date() fallback
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

export const CtFilingDashboard: React.FC<CtFilingDashboardProps> = ({ company, onNewFiling, onBack }) => {
    const [filings, setFilings] = useState<FilingRecord[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newFiling, setNewFiling] = useState<Partial<FilingRecord>>({
        periodFrom: '',
        periodTo: '',
        dueDate: '',
        status: 'Not Started',
        position: ''
    });

    useEffect(() => {
        try {
            const saved = localStorage.getItem(`ct_filings_${company.id}`);
            if (saved) {
                setFilings(JSON.parse(saved));
            } else {
                // Auto-populate first filing from customer details if no previous data exists
                const initialFilings: FilingRecord[] = [];

                const start = parseDateString(company.ctPeriodStart || '');
                const end = parseDateString(company.ctPeriodEnd || '');
                const due = parseDateString(company.ctDueDate || '');

                if (start && end) {
                    initialFilings.push({
                        id: Date.now().toString(),
                        periodFrom: toInputDate(start),
                        periodTo: toInputDate(end),
                        dueDate: due ? toInputDate(due) : '',
                        submitDate: '',
                        status: 'Not Started',
                        position: ''
                    });
                }

                setFilings(initialFilings);
            }
        } catch (e) {
            console.error("Failed to load CT filings:", e);
            setFilings([]);
        }
    }, [company]);

    useEffect(() => {
        if (filings.length > 0) {
            localStorage.setItem(`ct_filings_${company.id}`, JSON.stringify(filings));
        }
    }, [filings, company.id]);

    const handleChange = (id: string, field: keyof FilingRecord, value: string) => {
        setFilings(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const handleDeleteRow = (id: string) => {
        if (window.confirm('Are you sure you want to delete this filing entry?')) {
            setFilings(prev => prev.filter(f => f.id !== id));
        }
    };

    const handleOpenAddModal = () => {
        let nextStartStr = '';
        let nextEndStr = '';
        let nextDueStr = '';

        if (filings.length === 0) {
            if (company.ctPeriodStart) {
                const start = parseDateString(company.ctPeriodStart);
                if (start) nextStartStr = toInputDate(start);
            }
            if (company.ctPeriodEnd) {
                const end = parseDateString(company.ctPeriodEnd);
                if (end) nextEndStr = toInputDate(end);
            }
            if (company.ctDueDate) {
                const due = parseDateString(company.ctDueDate);
                if (due) nextDueStr = toInputDate(due);
            }

            if (nextStartStr && !nextEndStr) {
                const start = new Date(nextStartStr);
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                end.setDate(end.getDate() - 1);
                nextEndStr = toInputDate(end);
            }

            if (nextEndStr && !nextDueStr) {
                const end = new Date(nextEndStr);
                const dueYear = end.getFullYear() + 1;
                const due = new Date(dueYear, 8, 30);
                nextDueStr = toInputDate(due);
            }

        } else {
            const sortedFilings = [...filings].sort((a, b) => new Date(a.periodTo).getTime() - new Date(b.periodTo).getTime());
            const lastFiling = sortedFilings[sortedFilings.length - 1];

            if (lastFiling.periodTo) {
                const lastEnd = new Date(lastFiling.periodTo);
                const nextStart = new Date(lastEnd);
                nextStart.setDate(lastEnd.getDate() + 1);
                nextStartStr = toInputDate(nextStart);

                const nextEnd = new Date(nextStart);
                nextEnd.setFullYear(nextEnd.getFullYear() + 1);
                nextEnd.setDate(nextEnd.getDate() - 1);
                nextEndStr = toInputDate(nextEnd);

                const dueYear = nextEnd.getFullYear() + 1;
                const nextDue = new Date(dueYear, 8, 30);
                nextDueStr = toInputDate(nextDue);
            }
        }

        setNewFiling({
            periodFrom: nextStartStr,
            periodTo: nextEndStr,
            dueDate: nextDueStr,
            status: 'Not Started',
            position: ''
        });

        setIsModalOpen(true);
    };

    const handleSaveNewFiling = (e: React.FormEvent) => {
        e.preventDefault();
        const record: FilingRecord = {
            id: Date.now().toString(),
            periodFrom: newFiling.periodFrom || '',
            periodTo: newFiling.periodTo || '',
            dueDate: newFiling.dueDate || '',
            submitDate: '',
            status: newFiling.status || 'Not Started',
            position: newFiling.position || ''
        };
        setFilings(prev => [record, ...prev]);
        setIsModalOpen(false);
        setNewFiling({ periodFrom: '', periodTo: '', dueDate: '', status: 'Not Started', position: '' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <button
                        onClick={onBack}
                        className="text-sm text-muted-foreground hover:text-foreground flex items-center mb-3 transition-colors"
                    >
                        <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Customers
                    </button>
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center ring-1 ring-border shadow-lg">
                            <BuildingOfficeIcon className="w-7 h-7 text-foreground" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground tracking-tight">{company.name}</h2>
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                                <IdentificationIcon className="w-4 h-4 mr-1.5 text-muted-foreground/50" />
                                <span className="font-mono">{company.trn || 'No TRN'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add Filing Period
                </button>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider w-32">Period From</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider w-32">Period To</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider w-32">Due Date</th>
                                <th scope="col" className="px-6 py-4 font-bold tracking-wider w-40">Status</th>
                                <th scope="col" className="px-4 py-4 font-bold tracking-wider text-center w-24">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filings.map((filing, index) => (
                                <tr key={filing.id} className="border-b border-border hover:bg-accent/50 transition-colors group">
                                    <td className="px-6 py-2">
                                        <input
                                            type="date"
                                            value={filing.periodFrom}
                                            onChange={(e) => handleChange(filing.id, 'periodFrom', e.target.value)}
                                            className="bg-transparent border-none text-foreground w-full focus:ring-0 p-0 placeholder-muted-foreground/30"
                                        />
                                    </td>
                                    <td className="px-6 py-2">
                                        <input
                                            type="date"
                                            value={filing.periodTo}
                                            onChange={(e) => handleChange(filing.id, 'periodTo', e.target.value)}
                                            className="bg-transparent border-none text-foreground w-full focus:ring-0 p-0 placeholder-muted-foreground/30"
                                        />
                                    </td>
                                    <td className="px-6 py-2">
                                        <input
                                            type="date"
                                            value={filing.dueDate}
                                            onChange={(e) => handleChange(filing.id, 'dueDate', e.target.value)}
                                            className="bg-transparent border-none text-foreground w-full focus:ring-0 p-0 placeholder-muted-foreground/30"
                                        />
                                    </td>
                                    <td className="px-6 py-2">
                                        <select
                                            value={filing.status}
                                            onChange={(e) => handleChange(filing.id, 'status', e.target.value)}
                                            className={`bg-transparent border-none w-full focus:ring-0 p-0 text-sm font-medium ${filing.status === 'Submitted' ? 'text-emerald-600' :
                                                    filing.status === 'Overdue' ? 'text-destructive' :
                                                        filing.status === 'In Progress' ? 'text-primary' : 'text-muted-foreground'
                                                }`}
                                        >
                                            <option value="Not Started" className="bg-background text-muted-foreground">Not Started</option>
                                            <option value="In Progress" className="bg-background text-primary">In Progress</option>
                                            <option value="Submitted" className="bg-background text-emerald-600">Submitted</option>
                                            <option value="Overdue" className="bg-background text-destructive">Overdue</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {(filing.status === 'Not Started' || filing.status === 'In Progress') ? (
                                                <button
                                                    onClick={() => onNewFiling(filing.periodFrom, filing.periodTo)}
                                                    className="text-primary hover:text-primary/80 transition-colors p-1"
                                                    title="Start Filing"
                                                >
                                                    <ArrowUpRightIcon className="w-5 h-5" />
                                                </button>
                                            ) : (
                                                <div className="w-7"></div>
                                            )}
                                            <button
                                                onClick={() => handleDeleteRow(filing.id)}
                                                className="text-muted-foreground/50 hover:text-destructive transition-all p-1"
                                                title="Delete Entry"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filings.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="text-center py-12 text-muted-foreground italic">
                                        No filings found. Click "Add Filing Period" to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <h3 className="text-lg font-bold text-foreground">Add Filing Period</h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-accent"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNewFiling}>
                            <div className="p-6 space-y-5">
                                <p className="text-sm text-muted-foreground mb-2">Dates auto-calculated based on {filings.length > 0 ? 'previous filing' : 'customer details'}.</p>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Period From</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={newFiling.periodFrom}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, periodFrom: e.target.value }))}
                                            className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none"
                                        />
                                        <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-muted-foreground/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Period To</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={newFiling.periodTo}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, periodTo: e.target.value }))}
                                            className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none"
                                        />
                                        <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-muted-foreground/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Due Date</label>
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={newFiling.dueDate}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, dueDate: e.target.value }))}
                                            className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none"
                                        />
                                        <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-muted-foreground/50 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                                    <div className="relative">
                                        <select
                                            value={newFiling.status}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full p-3 bg-muted border border-border rounded-lg text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-primary appearance-none transition-all"
                                        >
                                            <option value="Not Started">Not Started</option>
                                            <option value="In Progress">In Progress</option>
                                            <option value="Submitted">Submitted</option>
                                            <option value="Overdue">Overdue</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                            <svg className="w-4 h-4 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-border flex justify-end space-x-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground bg-transparent hover:bg-accent rounded-lg transition-colors border border-transparent hover:border-border"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-lg transition-all shadow-lg shadow-primary/20"
                                >
                                    Save Period
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
