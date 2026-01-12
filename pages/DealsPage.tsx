import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon, AdjustmentsIcon, FunnelIcon, ChevronRightIcon } from '../components/icons';
import { CustomizeColumnsModal } from '../components/CustomizeColumnsModal';
import { DealModal } from '../components/DealModal';
import { DealViewModal } from '../components/DealViewModal';
import { DealsFilterModal, DealsFilters } from '../components/DealsFilterModal';
import { Deal } from '../types';

interface ColumnConfig {
    key: keyof Deal | 'actions' | string;
    label: string;
    visible: boolean;
}

export const DealsPage: React.FC = () => {
    const { deals, deleteDeal, addDeal, updateDeal, users, salesSettings } = useData();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState('');
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [activeFilters, setActiveFilters] = useState<DealsFilters>({});
    const [editingDeal, setEditingDeal] = useState<Deal | Partial<Deal> | null>(null);

    useEffect(() => {
        const state = location.state as { prefill?: Partial<Deal> };
        if (state?.prefill) {
            setEditingDeal(state.prefill);
            setIsDealModalOpen(true);
            // Clear the location state to prevent modal from re-opening on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'cifNumber', label: 'CIF No', visible: true },
        { key: 'date', label: 'Date', visible: true },
        { key: 'name', label: 'Name', visible: true },
        { key: 'companyName', label: 'Company Name', visible: true },
        { key: 'brand', label: 'Brand', visible: true },
        { key: 'contactNo', label: 'Contact No', visible: true },
        { key: 'email', label: 'Email', visible: true },
        { key: 'leadSource', label: 'Lead Source', visible: true },
        { key: 'services', label: 'Services', visible: true },
        { key: 'serviceClosed', label: 'Service Closed', visible: true },
        { key: 'serviceAmount', label: 'Service Amount', visible: true },
        { key: 'closingDate', label: 'Closing Date', visible: true },
        { key: 'paymentStatus', label: 'Payment Status', visible: true },
    ]);

    const filteredDeals = deals.filter(deal => {
        // Global Search
        const matchesSearch =
            (deal.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (deal.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (deal.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (deal.cifNumber ? String(deal.cifNumber).toLowerCase() : '').includes(searchTerm.toLowerCase());

        // Advanced Filters
        const matchesFilters = (Object.keys(activeFilters) as Array<keyof DealsFilters>).every(key => {
            const filterValue = activeFilters[key];
            if (!filterValue) return true; // Skip empty filters

            const dealValue = deal[key as keyof Deal];
            if (dealValue === undefined || dealValue === null) return false;

            // Exact match for selects
            if (['brand', 'leadSource', 'services', 'serviceClosed', 'paymentStatus', 'date', 'closingDate'].includes(key)) {
                return String(dealValue) === filterValue;
            }

            // Partial match for text inputs (and serviceAmount for now)
            return String(dealValue).toLowerCase().includes(filterValue.toLowerCase());
        });

        return matchesSearch && matchesFilters;
    });

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this deal?')) {
            deleteDeal(id);
        }
    };

    const handleSaveDeal = async (dealData: Omit<Deal, 'id'>) => {
        if (editingDeal) {
            await updateDeal({ ...dealData, id: editingDeal.id } as Deal);
        } else {
            await addDeal(dealData);
        }
        setIsDealModalOpen(false);
        setEditingDeal(null);
    };

    const handleEdit = (deal: Deal) => {
        setEditingDeal(deal);
        setIsDealModalOpen(true);
    };

    const handleAdd = () => {
        setEditingDeal(null);
        setIsDealModalOpen(true);
    };

    const handleApplyFilters = (filters: DealsFilters) => {
        setActiveFilters(filters);
        setIsFilterModalOpen(false);
    };

    const handleResetFilters = () => {
        setActiveFilters({});
        setIsFilterModalOpen(false);
    };

    // Helper functions to resolve UUIDs to names
    const getBrandName = (brandId: string): string => {
        const brand = salesSettings.brands.find(b => b.id === brandId);
        return brand?.name || brandId;
    };

    const getServiceName = (serviceId: string): string => {
        const service = salesSettings.servicesRequired.find(s => s.id === serviceId);
        return service?.name || serviceId;
    };

    const getLeadSourceName = (sourceId: string): string => {
        const source = salesSettings.leadSources.find(s => s.id === sourceId);
        return source?.name || sourceId;
    };

    const renderCell = (deal: Deal, key: string) => {
        switch (key) {
            case 'cifNumber':
                return <span className="font-mono text-blue-400">{deal.cifNumber}</span>;
            case 'brand':
                return <span className="text-gray-300">{getBrandName(deal.brand)}</span>;
            case 'services':
                return <span className="text-gray-300">{getServiceName(deal.services)}</span>;
            case 'leadSource':
                return <span className="text-gray-300">{getLeadSourceName(deal.leadSource)}</span>;
            case 'serviceAmount':
                const amount = Number(deal.serviceAmount) || 0;
                return <span className="font-mono text-emerald-400 font-semibold">{new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(amount)}</span>;
            case 'paymentStatus':
                const statusColors: Record<string, string> = {
                    'Paid': 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
                    'Pending': 'bg-yellow-900/40 text-yellow-300 border-yellow-800',
                    'Overdue': 'bg-red-900/40 text-red-300 border-red-800',
                    'Partial': 'bg-blue-900/40 text-blue-300 border-blue-800'
                };
                return (
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusColors[deal.paymentStatus] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                        {deal.paymentStatus}
                    </span>
                );
            case 'serviceClosed':
                return (
                    <span className={`px-2 py-1 text-xs font-medium rounded-md border ${deal.serviceClosed === 'Yes' ? 'bg-emerald-900/20 text-emerald-400 border-emerald-900/50' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {deal.serviceClosed}
                    </span>
                );
            case 'email':
                return <span className="text-gray-300 hover:text-blue-400 transition-colors cursor-pointer">{deal.email}</span>;
            default:
                // @ts-ignore
                return <span className="text-gray-300">{deal[key] || '-'}</span>;
        }
    };

    const visibleColumns = columns.filter(c => c.visible);

    return (
        <div>
            <CustomizeColumnsModal
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                columns={columns}
                onSave={(newCols) => { setColumns(newCols); setIsCustomizeModalOpen(false); }}
            />

            <DealModal
                isOpen={isDealModalOpen}
                onClose={() => setIsDealModalOpen(false)}
                onSave={handleSaveDeal}
                initialData={editingDeal}
            />

            <DealsFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
                initialFilters={activeFilters}
                salesSettings={salesSettings}
            />

            <DealViewModal
                isOpen={isViewModalOpen}
                onClose={() => {
                    setIsViewModalOpen(false);
                    setSelectedDeal(null);
                }}
                deal={selectedDeal}
                salesSettings={salesSettings}
                onEdit={(deal) => {
                    setIsViewModalOpen(false);
                    handleEdit(deal);
                }}
            />

            <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-xl">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Deals Management</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage and track your active business deals</p>
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={() => setIsFilterModalOpen(true)}
                            className={`flex items-center px-4 py-2.5 bg-gray-800 font-semibold rounded-xl hover:bg-gray-700 transition-colors text-sm border border-gray-700 ${Object.keys(activeFilters).length > 0 ? 'text-blue-400 border-blue-900 ring-1 ring-blue-900' : 'text-gray-400'}`}
                            title="Filter Deals"
                        >
                            <FunnelIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsCustomizeModalOpen(true)}
                            className="p-2.5 bg-gray-800 text-gray-400 rounded-xl hover:bg-gray-700 hover:text-white transition-all border border-gray-700 shadow-inner"
                            title="Customize Columns"
                        >
                            <AdjustmentsIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleAdd}
                            className="flex items-center px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/20"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" /> New Deal
                        </button>
                    </div>
                </div>

                <div className="p-4 bg-gray-900/30 border-b border-gray-800">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search deals by CIF, company, or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[11px] text-gray-500 uppercase tracking-widest bg-gray-900 border-b border-gray-800">
                            <tr>
                                {visibleColumns.map(col => (
                                    <th key={col.key} className="px-6 py-5 font-bold whitespace-nowrap">
                                        {col.label}
                                    </th>
                                ))}
                                <th className="px-6 py-5 font-bold text-right sticky right-0 bg-gray-900 shadow-[-12px_0_12px_-10px_rgba(0,0,0,0.5)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {filteredDeals.length > 0 ? (
                                filteredDeals.map((deal) => (
                                    <tr key={deal.id} className="group hover:bg-gray-800/30 transition-all duration-200">
                                        {visibleColumns.map(col => (
                                            <td key={`${deal.id}-${col.key}`} className="px-6 py-4 whitespace-nowrap">
                                                {renderCell(deal, col.key)}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-right whitespace-nowrap sticky right-0 bg-gray-900/80 backdrop-blur-md group-hover:bg-gray-800/80 transition-colors shadow-[-12px_0_12px_-10px_rgba(0,0,0,0.5)]">
                                            <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    onClick={() => {
                                                        setSelectedDeal(deal);
                                                        setIsViewModalOpen(true);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                    title="View"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(deal)}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(deal.id)}
                                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                    title="Delete"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={visibleColumns.length + 1} className="py-24">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-6">
                                                <MagnifyingGlassIcon className="w-10 h-10 text-gray-600 opacity-50" />
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-300">No deals found</h3>
                                            <p className="text-gray-500 mt-2 max-w-xs text-center">We couldn't find any deals matching your search criteria.</p>
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                className="mt-6 px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all font-medium border border-gray-700"
                                            >
                                                Clear search
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex justify-between items-center text-xs text-gray-500">
                    <div>Showing {filteredDeals.length} of {deals.length} deals</div>
                    <div className="flex space-x-1">
                        <button className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30" disabled>Previous</button>
                        <button className="px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-30" disabled>Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

