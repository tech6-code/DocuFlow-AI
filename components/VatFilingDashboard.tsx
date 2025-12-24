
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Company } from '../types';
import { BanknotesIcon, PlusIcon, ChevronLeftIcon, IdentificationIcon, TrashIcon, ArrowUpRightIcon, XMarkIcon, CalendarDaysIcon } from './icons';
import { ConfirmationDialog } from './ConfirmationDialog';

interface VatFilingDashboardProps {
    company: Company;
    onNewFiling: (start: string, end: string) => void;
    onBack: () => void;
    onContinueFiling: (start: string, end: string) => void;
}

interface VatFilingRecord {
    id: string;
    periodFrom: string;
    periodTo: string;
    dueDate: string;
    status: string;
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

export const VatFilingDashboard: React.FC<VatFilingDashboardProps> = ({ company, onNewFiling, onBack, onContinueFiling }) => {
    const [filings, setFilings] = useState<VatFilingRecord[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filingToDelete, setFilingToDelete] = useState<string | null>(null);
    const [newFiling, setNewFiling] = useState<Partial<VatFilingRecord>>({
        periodFrom: '',
        periodTo: '',
        dueDate: '',
        status: 'Not Started'
    });

    // Load filings or Initialize First Period from Customer Details
    useEffect(() => {
        try {
            const saved = localStorage.getItem(`vat_filings_${company.id}`);
            if (saved) {
                setFilings(JSON.parse(saved));
            } else {
                const initialFilings: VatFilingRecord[] = [];
                const startDate = parseDateString(company.periodStart || '');
                const endDate = parseDateString(company.periodEnd || '');
                const dueDate = parseDateString(company.dueDate || '');

                if (startDate && endDate) {
                    initialFilings.push({
                        id: Date.now().toString(),
                        periodFrom: toInputDate(startDate),
                        periodTo: toInputDate(endDate),
                        dueDate: dueDate ? toInputDate(dueDate) : '',
                        status: 'Not Started'
                    });
                }
                setFilings(initialFilings);
            }
        } catch (e) {
            console.error("Failed to load VAT filings from storage:", e);
            setFilings([]); 
        }
    }, [company]);

    useEffect(() => {
        if (filings.length > 0) {
             localStorage.setItem(`vat_filings_${company.id}`, JSON.stringify(filings));
        } else {
             localStorage.setItem(`vat_filings_${company.id}`, JSON.stringify([]));
        }
    }, [filings, company.id]);

    const handleChange = (id: string, field: keyof VatFilingRecord, value: string) => {
        setFilings(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    };

    const handleDeleteRow = (id: string) => {
        setFilingToDelete(id);
    };

    const handleConfirmDelete = () => {
        if (filingToDelete) {
            setFilings(prev => prev.filter(f => f.id !== filingToDelete));
            setFilingToDelete(null);
        }
    };

    const handleOpenAddModal = () => {
        if (filings.length > 0) {
            const sortedFilings = [...filings].sort((a, b) => new Date(a.periodTo).getTime() - new Date(b.periodTo).getTime());
            const latest = sortedFilings[sortedFilings.length - 1];

            if (latest.periodTo) {
                const lastEnd = new Date(latest.periodTo);
                const nextStart = new Date(lastEnd);
                nextStart.setDate(lastEnd.getDate() + 1);

                const isMonthly = company.reportingPeriod?.toLowerCase().includes('monthly');
                const nextEnd = new Date(nextStart);
                nextEnd.setMonth(nextStart.getMonth() + (isMonthly ? 1 : 3));
                nextEnd.setDate(nextEnd.getDate() - 1);

                const nextDue = new Date(nextEnd);
                nextDue.setDate(1);
                nextDue.setMonth(nextDue.getMonth() + 1);
                nextDue.setDate(28);

                setNewFiling({
                    periodFrom: toInputDate(nextStart),
                    periodTo: toInputDate(nextEnd),
                    dueDate: toInputDate(nextDue),
                    status: 'Not Started'
                });
            }
        } else {
            setNewFiling({ periodFrom: '', periodTo: '', dueDate: '', status: 'Not Started' });
        }
        setIsModalOpen(true);
    };

    const handleSaveNewFiling = (e: React.FormEvent) => {
        e.preventDefault();
        const record: VatFilingRecord = {
            id: Date.now().toString(),
            periodFrom: newFiling.periodFrom || '',
            periodTo: newFiling.periodTo || '',
            dueDate: newFiling.dueDate || '',
            status: newFiling.status || 'Not Started',
        };
        setFilings(prev => [...prev, record]); 
        setIsModalOpen(false);
        setNewFiling({ periodFrom: '', periodTo: '', dueDate: '', status: 'Not Started' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <button 
                        onClick={onBack} 
                        className="text-sm text-gray-400 hover:text-white flex items-center mb-3 transition-colors"
                    >
                        <ChevronLeftIcon className="w-4 h-4 mr-1"/> Back to Customers
                    </button>
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center ring-1 ring-gray-700 shadow-lg">
                            <BanknotesIcon className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">{company.name}</h2>
                            <div className="flex items-center text-sm text-gray-400 mt-1">
                                <IdentificationIcon className="w-4 h-4 mr-1.5 text-gray-500"/>
                                <span className="font-mono">VAT TRN: {company.trn || 'Not Set'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="flex items-center px-5 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
                >
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Add Filing Period
                </button>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-300 uppercase bg-gray-800 border-b border-gray-700">
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
                                <tr key={filing.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors group">
                                    <td className="px-6 py-2">
                                        <input 
                                            type="date" 
                                            value={filing.periodFrom}
                                            onChange={(e) => handleChange(filing.id, 'periodFrom', e.target.value)}
                                            className="bg-transparent border-none text-white w-full focus:ring-0 p-0 placeholder-gray-600 font-medium"
                                        />
                                    </td>
                                    <td className="px-6 py-2">
                                        <input 
                                            type="date" 
                                            value={filing.periodTo}
                                            onChange={(e) => handleChange(filing.id, 'periodTo', e.target.value)}
                                            className="bg-transparent border-none text-white w-full focus:ring-0 p-0 placeholder-gray-600 font-medium"
                                        />
                                    </td>
                                    <td className="px-6 py-2">
                                        <input 
                                            type="date" 
                                            value={filing.dueDate}
                                            onChange={(e) => handleChange(filing.id, 'dueDate', e.target.value)}
                                            className="bg-transparent border-none text-white w-full focus:ring-0 p-0 placeholder-gray-600 font-medium"
                                        />
                                    </td>
                                    <td className="px-6 py-2">
                                        <select
                                            value={filing.status}
                                            onChange={(e) => handleChange(filing.id, 'status', e.target.value)}
                                            className={`bg-transparent border-none w-full focus:ring-0 p-0 text-sm font-bold ${
                                                filing.status === 'Submitted' ? 'text-green-400' : 
                                                filing.status === 'Overdue' ? 'text-red-400' : 
                                                filing.status === 'In Progress' ? 'text-blue-400' : 'text-gray-400'
                                            }`}
                                        >
                                            <option value="Not Started" className="bg-gray-900 text-gray-400">Not Started</option>
                                            <option value="In Progress" className="bg-gray-900 text-blue-400">In Progress</option>
                                            <option value="Submitted" className="bg-gray-900 text-green-400">Submitted</option>
                                            <option value="Overdue" className="bg-gray-900 text-red-400">Overdue</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {(filing.status === 'Not Started' || filing.status === 'In Progress') ? (
                                                <button 
                                                    onClick={() => onContinueFiling(filing.periodFrom, filing.periodTo)}
                                                    className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                                                    title="Upload Files"
                                                >
                                                    <ArrowUpRightIcon className="w-5 h-5" />
                                                </button>
                                            ) : (
                                                <div className="w-7"></div>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteRow(filing.id)}
                                                className="text-gray-500 hover:text-red-400 transition-all p-1"
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
                                    <td colSpan={5} className="text-center py-12 text-gray-500 italic">
                                        No VAT filings found. Click "Add Filing Period" to auto-generate based on customer details.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}>
                    <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Add Filing Period</h3>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveNewFiling}>
                            <div className="p-6 space-y-5">
                                <p className="text-sm text-gray-400 mb-2">The dates below are auto-calculated based on your filing history and frequency.</p>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Period From</label>
                                    <div className="relative">
                                        <input 
                                            type="date" 
                                            required
                                            value={newFiling.periodFrom}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, periodFrom: e.target.value }))}
                                            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none"
                                        />
                                        <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-gray-500 pointer-events-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Period To</label>
                                    <div className="relative">
                                        <input 
                                            type="date" 
                                            required
                                            value={newFiling.periodTo}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, periodTo: e.target.value }))}
                                            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none"
                                        />
                                        <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-gray-500 pointer-events-none"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Due Date</label>
                                    <div className="relative">
                                        <input 
                                            type="date" 
                                            required
                                            value={newFiling.dueDate}
                                            onChange={(e) => setNewFiling(prev => ({ ...prev, dueDate: e.target.value }))}
                                            className="w-full p-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all appearance-none"
                                        />
                                        <CalendarDaysIcon className="absolute right-3 top-3 w-5 h-5 text-gray-500 pointer-events-none"/>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 py-4 border-t border-gray-800 flex justify-end space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-sm font-semibold text-gray-300 hover:text-white bg-transparent hover:bg-gray-700 rounded-lg transition-colors border border-transparent hover:border-gray-600"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
                                >
                                    Save Period
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            <ConfirmationDialog
                isOpen={!!filingToDelete}
                onConfirm={handleConfirmDelete}
                onCancel={() => setFilingToDelete(null)}
                title="Delete Filing Period"
                confirmText="Delete"
                cancelText="Cancel"
            >
                Are you sure you want to delete this filing period? This action cannot be undone.
            </ConfirmationDialog>
        </div>
    );
};
