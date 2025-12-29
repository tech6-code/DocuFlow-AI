import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { Company } from '../types';
import { ChevronLeftIcon, ArrowRightIcon, TrashIcon, XMarkIcon, BuildingOfficeIcon } from './icons';

interface FilingPeriod {
    id: string;
    periodFrom: string;
    periodTo: string;
    dueDate: string;
    status: 'Not Started' | 'In Progress' | 'Completed';
}

export const Type2FilingPeriod: React.FC = () => {
    const { customerId } = useParams();
    const navigate = useNavigate();
    const { projectCompanies } = useData();
    const [company, setCompany] = useState<Company | null>(null);
    const [periods, setPeriods] = useState<FilingPeriod[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        periodFrom: '',
        periodTo: '',
        dueDate: '',
        status: 'Not Started' as const
    });

    useEffect(() => {
        if (customerId) {
            const foundCompany = projectCompanies.find(c => c.id === customerId);
            if (foundCompany) {
                setCompany(foundCompany);
            }

            // Load saved periods from localStorage
            const savedPeriods = localStorage.getItem(`ct_periods_${customerId}_type2`);
            if (savedPeriods) {
                setPeriods(JSON.parse(savedPeriods));
            }
        }
    }, [customerId, projectCompanies]);

    const handlePeriodFromChange = (value: string) => {
        setFormData(prev => {
            const newData = { ...prev, periodFrom: value };

            // Auto-calculate Period To (1 year later minus 1 day)
            if (value) {
                const start = new Date(value);
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                end.setDate(end.getDate() - 1);
                const offset = end.getTimezoneOffset();
                const localEnd = new Date(end.getTime() - (offset * 60 * 1000));
                newData.periodTo = localEnd.toISOString().split('T')[0];

                // Auto-calculate Due Date (9 months after Period To)
                const dueDate = new Date(localEnd);
                dueDate.setMonth(dueDate.getMonth() + 9);
                const offsetDue = dueDate.getTimezoneOffset();
                const localDue = new Date(dueDate.getTime() - (offsetDue * 60 * 1000));
                newData.dueDate = localDue.toISOString().split('T')[0];
            }

            return newData;
        });
    };

    const handleAddPeriod = () => {
        if (!formData.periodFrom || !formData.periodTo || !formData.dueDate) return;

        const newPeriod: FilingPeriod = {
            id: Date.now().toString(),
            periodFrom: formData.periodFrom,
            periodTo: formData.periodTo,
            dueDate: formData.dueDate,
            status: formData.status
        };

        const updatedPeriods = [...periods, newPeriod];
        setPeriods(updatedPeriods);
        localStorage.setItem(`ct_periods_${customerId}_type2`, JSON.stringify(updatedPeriods));

        setShowModal(false);
        setFormData({ periodFrom: '', periodTo: '', dueDate: '', status: 'Not Started' });
    };

    const handleDeletePeriod = (id: string) => {
        const updatedPeriods = periods.filter(p => p.id !== id);
        setPeriods(updatedPeriods);
        localStorage.setItem(`ct_periods_${customerId}_type2`, JSON.stringify(updatedPeriods));
    };

    const handleProceed = (period: FilingPeriod) => {
        // Save selected period for the upload page
        localStorage.setItem(`ct_period_${customerId}_type2`, JSON.stringify({
            start: period.periodFrom,
            end: period.periodTo
        }));
        navigate(`/projects/ct-filing/${customerId}/type2/upload`);
    };

    const handleBack = () => {
        navigate(`/projects/ct-filing/${customerId}`);
    };

    if (!company) {
        return <div className="text-white">Loading...</div>;
    }

    return (
        <div className="min-h-screen bg-[#0a0f1a] text-white">
            {/* Back Button */}
            <button
                onClick={handleBack}
                className="mb-6 text-sm text-gray-400 hover:text-white flex items-center transition-colors"
            >
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Back to Type Selection
            </button>

            {/* Company Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center border border-gray-700">
                        <BuildingOfficeIcon className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">{company.name}</h1>
                        <p className="text-sm text-gray-400 flex items-center mt-1">
                            <span className="inline-block w-4 h-4 mr-1">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M3 9h18M9 3v18" />
                                </svg>
                            </span>
                            {company.trn || '104589415900003'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors flex items-center space-x-2"
                >
                    <span className="text-xl">+</span>
                    <span>Add Filing Period</span>
                </button>
            </div>

            {/* Period Table */}
            <div className="bg-[#1a1f2e] rounded-xl border border-gray-700 overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1fr_1fr_120px] gap-4 px-6 py-4 bg-[#0f1419] border-b border-gray-700">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period From</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Period To</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Due Date</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</div>
                </div>

                {periods.length === 0 ? (
                    <div className="px-6 py-12 text-center text-gray-500">
                        <p className="text-lg mb-2">No filing periods added yet</p>
                        <p className="text-sm">Click "Add Filing Period" to create your first period</p>
                    </div>
                ) : (
                    periods.map(period => (
                        <div key={period.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_120px] gap-4 px-6 py-4 border-b border-gray-700 last:border-b-0 items-center hover:bg-gray-800/30 transition-colors">
                            <div className="flex items-center">
                                <input
                                    type="date"
                                    value={period.periodFrom}
                                    readOnly
                                    className="bg-transparent text-white border-none outline-none cursor-default"
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="date"
                                    value={period.periodTo}
                                    readOnly
                                    className="bg-transparent text-white border-none outline-none cursor-default"
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="date"
                                    value={period.dueDate}
                                    readOnly
                                    className="bg-transparent text-white border-none outline-none cursor-default"
                                />
                            </div>
                            <div>
                                <select
                                    value={period.status}
                                    disabled
                                    className="bg-transparent text-gray-400 border-none outline-none cursor-default"
                                >
                                    <option>Not Started</option>
                                    <option>In Progress</option>
                                    <option>Completed</option>
                                </select>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    onClick={() => handleProceed(period)}
                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Proceed to upload"
                                >
                                    <ArrowRightIcon className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => handleDeletePeriod(period.id)}
                                    className="text-gray-400 hover:text-red-400 transition-colors"
                                    title="Delete period"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
                    <div className="bg-[#1e293b] rounded-xl max-w-md w-full border border-gray-700 shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
                            <h2 className="text-xl font-bold text-white">Add Filing Period</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-6 space-y-5">
                            <p className="text-sm text-gray-400">Dates auto-calculated based on previous filing.</p>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Period From</label>
                                <input
                                    type="date"
                                    value={formData.periodFrom}
                                    onChange={(e) => handlePeriodFromChange(e.target.value)}
                                    className="w-full px-4 py-3 bg-[#0f172a] border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Period To</label>
                                <input
                                    type="date"
                                    value={formData.periodTo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, periodTo: e.target.value }))}
                                    className="w-full px-4 py-3 bg-[#0f172a] border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Due Date</label>
                                <input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                                    className="w-full px-4 py-3 bg-[#0f172a] border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                    className="w-full px-4 py-3 bg-[#0f172a] border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="Not Started">Not Started</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                </select>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-700">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-5 py-2.5 text-gray-300 hover:text-white font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddPeriod}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
                            >
                                Save Period
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
