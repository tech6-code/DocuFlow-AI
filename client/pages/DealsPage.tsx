import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon, AdjustmentsIcon, FunnelIcon, ArrowDownTrayIcon } from '../components/icons';
import { CustomizeColumnsModal } from '../components/CustomizeColumnsModal';
import { DealModal } from '../components/DealModal';
import { DealsFilterModal, DealsFilters } from '../components/DealsFilterModal';
import { Pagination } from '../components/Pagination';
import { Deal } from '../types';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { DealListSidebar } from '../components/DealListSidebar';
import { DealDetail } from '../components/DealDetail';
import { readExcel, exportToExcel } from '../utils/excelUtils';

interface ColumnConfig {
    key: keyof Deal | 'actions' | string;
    label: string;
    visible: boolean;
}

export const DealsPage: React.FC = () => {
    const { deals, deleteDeal, addDeal, updateDeal, users, salesSettings, hasPermission } = useData();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Table / Modal Logic state (retained for table view)
    const [searchTerm, setSearchTerm] = useState('');
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [isDealModalOpen, setIsDealModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<DealsFilters>({});
    const [editingDeal, setEditingDeal] = useState<Deal | Partial<Deal> | null>(null);

    // Pagination & Selection State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
    const [customFields, setCustomFields] = useState<CustomField[]>([]);

    useEffect(() => {
        const state = location.state as { prefill?: Partial<Deal> };
        if (state?.prefill) {
            setEditingDeal(state.prefill);
            setIsDealModalOpen(true);
            // Clear the location state to prevent modal from re-opening on refresh
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    const [columns, setColumns] = useState<ColumnConfig[]>(() => {
        const saved = localStorage.getItem('deals_columns');
        const defaultColumns = [
            { key: 'selection', label: '', visible: true },
            { key: 'cifNumber', label: 'CIF No', visible: true },
            { key: 'date', label: 'Date', visible: true },
            { key: 'name', label: 'Name', visible: true },
            { key: 'companyName', label: 'Company Name', visible: true },
            { key: 'winProbability', label: 'Win Probability', visible: true },
            { key: 'brand', label: 'Brand', visible: true },
            { key: 'contactNo', label: 'Contact No', visible: true },
            { key: 'email', label: 'Email', visible: true },
            { key: 'leadSource', label: 'Lead Source', visible: true },
            { key: 'services', label: 'Services', visible: true },
            { key: 'serviceClosed', label: 'Service Closed', visible: true },
            { key: 'serviceAmount', label: 'Service Amount', visible: true },
            { key: 'closingDate', label: 'Closing Date', visible: true },
            { key: 'paymentStatus', label: 'Payment Status', visible: true },
        ];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                return defaultColumns.map(defCol => {
                    const savedCol = parsed.find((p: ColumnConfig) => p.key === defCol.key);
                    return savedCol ? { ...defCol, visible: savedCol.visible } : defCol;
                });
            } catch (e) {
                return defaultColumns;
            }
        }
        return defaultColumns;
    });

    useEffect(() => {
        const fetchCustomFields = async () => {
            try {
                const fields = await salesSettingsService.getCustomFields('deals');
                setCustomFields(fields);

                setColumns(prev => {
                    const existingKeys = new Set(prev.map(c => c.key));
                    const newCols = fields
                        .filter(f => !existingKeys.has(f.id))
                        .map(f => ({
                            key: f.id,
                            label: f.label,
                            visible: false
                        }));

                    if (newCols.length === 0) return prev;

                    const saved = localStorage.getItem('deals_columns');
                    let mergedCols = [...prev, ...newCols];

                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            mergedCols = mergedCols.map(col => {
                                const savedCol = parsed.find((p: ColumnConfig) => p.key === col.key);
                                return savedCol ? { ...col, visible: savedCol.visible } : col;
                            });
                        } catch (e) { /* ignore */ }
                    }

                    return mergedCols;
                });
            } catch (error) {
                console.error("Failed to load custom fields", error);
            }
        };
        fetchCustomFields();
    }, []);

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

            // 1. Check Custom Fields
            const customField = customFields.find(f => f.id === String(key));
            if (customField) {
                const cfValue = deal.custom_data?.[key];
                if (!cfValue) return false;
                return String(cfValue).toLowerCase().includes(filterValue.toLowerCase());
            }

            const dealValue = deal[key as keyof Deal];
            if (dealValue === undefined || dealValue === null) return false;

            // Exact match for selects
            if (['brand', 'leadSource', 'services', 'serviceClosed', 'paymentStatus', 'date', 'closingDate'].includes(String(key))) {
                return String(dealValue) === filterValue;
            }

            // Partial match for text inputs (and serviceAmount for now)
            return String(dealValue).toLowerCase().includes(filterValue.toLowerCase());
        });

        return matchesSearch && matchesFilters;
    });

    const totalPages = Math.ceil(filteredDeals.length / itemsPerPage);
    const paginatedDeals = filteredDeals.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleSelectDeal = (id: string) => {
        setSelectedDeals(prev =>
            prev.includes(id) ? prev.filter(dealId => dealId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedDeals.length === paginatedDeals.length) {
            setSelectedDeals([]);
        } else {
            setSelectedDeals(paginatedDeals.map(d => d.id));
        }
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedDeals.length} deals?`)) {
            selectedDeals.forEach(id => deleteDeal(id));
            setSelectedDeals([]);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this deal?')) {
            deleteDeal(id);
            if (id === id) {
                navigate('/sales/deals');
            }
        }
    };

    const handleSaveDeal = async (dealData: Omit<Deal, 'id'>) => {
        if (editingDeal && 'id' in editingDeal) {
            await updateDeal({ ...dealData, id: editingDeal.id } as Deal);
        } else {
            await addDeal(dealData);
        }
        setIsDealModalOpen(false);
        setEditingDeal(null);
    };

    const handleEdit = (deal: Deal) => {
        navigate(`/sales/deals/edit/${deal.id}`);
    };

    const handleAdd = () => {
        navigate('/sales/deals/create');
    };

    const handleApplyFilters = (filters: DealsFilters) => {
        setActiveFilters(filters);
        setIsFilterModalOpen(false);
    };

    const handleResetFilters = () => {
        setActiveFilters({});
        setIsFilterModalOpen(false);
    };

    const handleExport = () => {
        const dataToExport = filteredDeals.map(deal => ({
            'CIF Number': deal.cifNumber,
            'Date': deal.date,
            'Name': deal.name,
            'Company Name': deal.companyName,
            'Brand': getBrandName(deal.brand),
            'Contact No': deal.contactNo,
            'Email': deal.email,
            'Lead Source': getLeadSourceName(deal.leadSource),
            'Services': getServiceName(deal.services),
            'Service Closed': deal.serviceClosed,
            'Service Amount': deal.serviceAmount,
            'Closing Date': deal.closingDate,
            'Payment Status': deal.paymentStatus,
            'Remarks': deal.remarks || ''
        }));
        exportToExcel(dataToExport, 'Deals_Export');
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await readExcel(e.target.files[0]);
                if (data && data.length > 0) {
                    let importedCount = 0;
                    for (const row of data) {
                        const findIdByName = (list: { id: string, name: string }[], name: string) => {
                            if (!name) return '';
                            const item = list.find(i => i.name.toLowerCase() === String(name).toLowerCase());
                            return item ? item.id : '';
                        };

                        const newDeal: any = {
                            date: row['Date'] || new Date().toISOString().split('T')[0],
                            name: row['Name'] || '',
                            companyName: row['Company Name'] || '',
                            brand: findIdByName(salesSettings.brands, row['Brand']) || row['Brand'] || '',
                            contactNo: row['Contact No'] || '',
                            email: row['Email'] || '',
                            leadSource: findIdByName(salesSettings.leadSources, row['Lead Source']) || row['Lead Source'] || '',
                            services: findIdByName(salesSettings.servicesRequired, row['Services']) || row['Services'] || '', // Assuming services maps to servicesRequired for now
                            serviceClosed: row['Service Closed'] || 'No',
                            serviceAmount: row['Service Amount'] || 0,
                            closingDate: row['Closing Date'] || '',
                            paymentStatus: row['Payment Status'] || 'Pending',
                            remarks: row['Remarks'] || ''
                        };

                        // Basic validation
                        if (newDeal.companyName) {
                            await addDeal(newDeal);
                            importedCount++;
                        }
                    }
                    alert(`Successfully imported ${importedCount} deals.`);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import Excel file');
            }
        }
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

    const getProbColor = (prob: string) => {
        switch (prob) {
            case 'High': return 'text-green-400 bg-green-400/10 border-green-400/20';
            case 'Medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
            case 'Low': return 'text-red-400 bg-red-400/10 border-red-400/20';
            default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
        }
    };

    const renderCell = (deal: Deal, key: string) => {
        // Handle custom fields
        const customField = customFields.find(f => f.id === key);
        if (customField) {
            const value = deal.custom_data?.[key];
            if (value === undefined || value === null || value === '') return '-';
            if (customField.type === 'checkbox') return value ? 'Yes' : 'No';
            return String(value);
        }

        switch (key) {
            case 'selection':
                return (
                    <input
                        type="checkbox"
                        checked={selectedDeals.includes(deal.id)}
                        onChange={() => handleSelectDeal(deal.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-offset-gray-900"
                    />
                );
            case 'cifNumber':
                return <span className="font-mono text-blue-400">{deal.cifNumber}</span>;
            case 'brand':
                return <span className="text-gray-300">{getBrandName(deal.brand)}</span>;
            case 'services':
                return <span className="text-gray-300">{getServiceName(deal.services)}</span>;
            case 'leadSource':
                return <span className="text-gray-300">{getLeadSourceName(deal.leadSource)}</span>;
            case 'winProbability':
                const prob = deal.custom_data?.aiProbability?.winProbability;
                if (prob) {
                    return (
                        <div className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-bold ${getProbColor(prob)}`}>
                            {prob}
                        </div>
                    );
                }
                return <span className="text-gray-600 text-xs italic">N/A</span>;
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

    // --- Master-Detail View ---
    if (id) {
        return (
            <div className="flex h-screen bg-gray-950 overflow-hidden">
                {/* Left Sidebar (25% width) */}
                <div className="w-1/4 min-w-[300px] border-r border-gray-800 bg-gray-900 border-b-0">
                    <DealListSidebar
                        deals={deals}
                        onAddDeal={hasPermission('sales-deals:create') ? handleAdd : undefined}
                    />
                </div>

                {/* Right Details Panel (75% width) */}
                <div className="flex-1 bg-gray-900 overflow-hidden">
                    <DealDetail
                        deals={deals}
                        salesSettings={salesSettings}
                        onEdit={hasPermission('sales-deals:edit') ? (deal) => handleEdit(deal) : undefined}
                        onDelete={hasPermission('sales-deals:delete') ? (dealId) => {
                            if (window.confirm('Are you sure you want to delete this deal?')) {
                                deleteDeal(dealId);
                                navigate('/sales/deals');
                            }
                        } : undefined}
                    />
                </div>
                {/* Re-use existing Deal Modal for Editing/Adding within detail view context if needed */}
                <DealModal
                    isOpen={isDealModalOpen}
                    onClose={() => setIsDealModalOpen(false)}
                    onSave={handleSaveDeal}
                    initialData={editingDeal}
                />
            </div>
        );
    }

    // --- Table View (Root) ---
    return (
        <div>
            <CustomizeColumnsModal
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                columns={columns}
                onSave={(newCols) => {
                    setColumns(newCols);
                    localStorage.setItem('deals_columns', JSON.stringify(newCols));
                    setIsCustomizeModalOpen(false);
                }}
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
                customFields={customFields}
            />

            <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-900/50 backdrop-blur-xl">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Deals Management</h2>
                        <p className="text-sm text-gray-500 mt-1">Manage and track your active business deals</p>
                    </div>
                    <div className="flex space-x-3">
                        {selectedDeals.length > 0 && hasPermission('sales-deals:delete') && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center px-4 py-2.5 bg-red-900/30 text-red-400 font-semibold rounded-xl hover:bg-red-900/50 transition-colors text-sm border border-red-900/50"
                            >
                                <TrashIcon className="w-5 h-5 mr-2" /> Delete ({selectedDeals.length})
                            </button>
                        )}
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleImport}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center px-4 py-2.5 bg-gray-800 font-semibold rounded-xl hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                            title="Import Deals"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5 mr-2 rotate-180" /> Import
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center px-4 py-2.5 bg-gray-800 font-semibold rounded-xl hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                            title="Export Deals"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5 mr-2" /> Export
                        </button>
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
                            disabled={!hasPermission('sales-deals:create')}
                            className="flex items-center px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-500 active:scale-95 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
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
                                        {col.key === 'selection' ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedDeals.length > 0 && selectedDeals.length === paginatedDeals.length}
                                                onChange={handleSelectAll}
                                                className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-offset-gray-900"
                                            />
                                        ) : (
                                            col.label
                                        )}
                                    </th>
                                ))}
                                <th className="px-6 py-5 font-bold text-right sticky right-0 bg-gray-900 shadow-[-12px_0_12px_-10px_rgba(0,0,0,0.5)]">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {paginatedDeals.length > 0 ? (
                                paginatedDeals.map((deal) => (
                                    <tr
                                        key={deal.id}
                                        className={`group hover:bg-gray-800/30 transition-all duration-200 cursor-pointer ${selectedDeals.includes(deal.id) ? 'bg-blue-900/10' : ''}`}
                                        onClick={() => navigate(`/sales/deals/${deal.id}`)}
                                    >
                                        {visibleColumns.map(col => (
                                            <td key={`${deal.id}-${col.key}`} className="px-6 py-4 whitespace-nowrap">
                                                {renderCell(deal, col.key)}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-right whitespace-nowrap sticky right-0 bg-gray-900/80 backdrop-blur-md group-hover:bg-gray-800/80 transition-colors shadow-[-12px_0_12px_-10px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end space-x-1">
                                                <button
                                                    onClick={() => navigate(`/sales/deals/${deal.id}`)}
                                                    className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                                                    title="View"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(deal)}
                                                    disabled={!hasPermission('sales-deals:edit')}
                                                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(deal.id)}
                                                    disabled={!hasPermission('sales-deals:delete')}
                                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    totalItems={filteredDeals.length}
                    itemsPerPage={itemsPerPage}
                    itemName="deals"
                />
            </div>
        </div>
    );
};
