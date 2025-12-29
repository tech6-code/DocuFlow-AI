import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { Company } from '../types';
import { CalendarDaysIcon, ChevronLeftIcon, ArrowRightIcon } from './icons';

export const Type4FilingPeriod: React.FC = () => {
    const { customerId } = useParams();
    const navigate = useNavigate();
    const { projectCompanies } = useData();
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [company, setCompany] = useState<Company | null>(null);

    useEffect(() => {
        if (customerId) {
            const foundCompany = projectCompanies.find(c => c.id === customerId);
            if (foundCompany) {
                setCompany(foundCompany);

                // Pre-populate from company details if available
                if (foundCompany.ctPeriodStart) {
                    const parts = foundCompany.ctPeriodStart.split('/');
                    if (parts.length === 3) {
                        setStartDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else if (foundCompany.ctPeriodStart.includes('-')) {
                        setStartDate(foundCompany.ctPeriodStart);
                    }
                }
                if (foundCompany.ctPeriodEnd) {
                    const parts = foundCompany.ctPeriodEnd.split('/');
                    if (parts.length === 3) {
                        setEndDate(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else if (foundCompany.ctPeriodEnd.includes('-')) {
                        setEndDate(foundCompany.ctPeriodEnd);
                    }
                }

                // Load saved period from localStorage
                const savedPeriod = localStorage.getItem(`ct_period_${customerId}_type4`);
                if (savedPeriod) {
                    const period = JSON.parse(savedPeriod);
                    setStartDate(period.start);
                    setEndDate(period.end);
                }
            }
        }
    }, [customerId, projectCompanies]);

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
        if (startDate && endDate && customerId) {
            const period = { start: startDate, end: endDate };
            localStorage.setItem(`ct_period_${customerId}_type4`, JSON.stringify(period));
            navigate(`/projects/ct-filing/${customerId}/type4/upload`);
        }
    };

    const handleBack = () => {
        navigate(`/projects/ct-filing/${customerId}`);
    };

    if (!company) {
        return <div className="text-white">Loading...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <button
                onClick={handleBack}
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
                            <h2 className="text-2xl font-bold text-white tracking-tight">Type 4 - Filing Period</h2>
                            <p className="text-gray-400 text-sm mt-1">Audit Report filing period for {company.name}</p>
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
