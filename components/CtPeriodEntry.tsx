
import React, { useState, useEffect } from 'react';
import { Company } from '../types';
import { CalendarDaysIcon, ChevronLeftIcon, ArrowRightIcon } from './icons';

interface CtPeriodEntryProps {
    company: Company;
    onContinue: (start: string, end: string) => void;
    onBack: () => void;
}

export const CtPeriodEntry: React.FC<CtPeriodEntryProps> = ({ company, onContinue, onBack }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Pre-populate from company details if available
    useEffect(() => {
        if (company.ctPeriodStart) {
            // Convert DD/MM/YYYY to YYYY-MM-DD for input
            const parts = company.ctPeriodStart.split('/');
            if (parts.length === 3) {
                setStartDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else if (company.ctPeriodStart.includes('-')) {
                setStartDate(company.ctPeriodStart);
            }
        }
        if (company.ctPeriodEnd) {
            const parts = company.ctPeriodEnd.split('/');
            if (parts.length === 3) {
                setEndDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
            } else if (company.ctPeriodEnd.includes('-')) {
                setEndDate(company.ctPeriodEnd);
            }
        }
    }, [company]);

    const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setStartDate(val);

        // Auto-calculate end date (1 year later minus 1 day)
        if (val) {
            const start = new Date(val);
            const end = new Date(start);
            end.setFullYear(end.getFullYear() + 1);
            end.setDate(end.getDate() - 1);

            const offset = end.getTimezoneOffset();
            const localEnd = new Date(end.getTime() - (offset * 60 * 1000));
            setEndDate(localEnd.toISOString().split('T')[0]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (startDate && endDate) {
            onContinue(startDate, endDate);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <button
                onClick={onBack}
                className="mb-6 text-sm text-gray-400 hover:text-white flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Type Selection
            </button>

            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-xl overflow-hidden">
                <div className="p-8">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center ring-1 ring-blue-500/50">
                            <CalendarDaysIcon className="w-7 h-7 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white tracking-tight">Filing Period</h2>
                            <p className="text-gray-400 text-sm mt-1">Specify the period for this Corporate Tax return.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Period From</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        required
                                        value={startDate}
                                        onChange={handleStartDateChange}
                                        className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Period To</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        required
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full flex items-center justify-center p-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-blue-900/20"
                            >
                                Proceed to Document Upload
                                <ArrowRightIcon className="w-5 h-5 ml-2" />
                            </button>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-4 bg-gray-800/50 border-t border-gray-700">
                    <p className="text-xs text-gray-500">
                        * Dates are auto-suggested based on the customer's financial year settings in the knowledge base.
                    </p>
                </div>
            </div>
        </div>
    );
};
