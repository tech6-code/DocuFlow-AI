import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { PlusIcon, MagnifyingGlassIcon, EyeIcon, PencilIcon, TrashIcon, AdjustmentsIcon, FunnelIcon, ArrowDownTrayIcon } from '../components/icons';
import { CustomizeColumnsModal } from '../components/CustomizeColumnsModal';
import { LeadsFilterModal, LeadsFilters } from '../components/LeadsFilterModal';
import { Pagination } from '../components/Pagination';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';
import { Lead } from '../types';
import { LeadListSidebar } from '../components/LeadListSidebar';
import { LeadDetail } from '../components/LeadDetail';
import { readExcel, exportToExcel } from '../utils/excelUtils';

interface ColumnConfig {
    key: keyof Lead | 'actions' | string;
    label: string;
    visible: boolean;
}

export const LeadsPage: React.FC = () => {
    const { leads, deleteLead, addLead, users, salesSettings, hasPermission } = useData();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Table View State
    const [searchTerm, setSearchTerm] = useState('');
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<LeadsFilters>({});
    const [customFields, setCustomFields] = useState<CustomField[]>([]);

    // Pagination & Selection State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

    const [columns, setColumns] = useState<ColumnConfig[]>(() => {
        const saved = localStorage.getItem('leads_columns');
        const defaultColumns = [
            { key: 'selection', label: '', visible: true },
            { key: 'sno', label: 'S.No', visible: true },
            { key: 'date', label: 'Date', visible: true },
            { key: 'companyName', label: 'Company Name', visible: true },
            { key: 'mobileNumber', label: 'Mobile Number', visible: true },
            { key: 'email', label: 'Email', visible: true },
            { key: 'aiScore', label: 'AI Score', visible: true },
            { key: 'leadSource', label: 'Lead Source', visible: true },
            { key: 'status', label: 'Status', visible: true },
            { key: 'serviceRequired', label: 'Service Required', visible: false },
            { key: 'leadQualification', label: 'Qualification', visible: false },
            { key: 'leadOwner', label: 'Lead Owner', visible: false },
            { key: 'lastContact', label: 'Last Contact', visible: false },
            { key: 'closingCycle', label: 'Closing Cycle', visible: false },
            { key: 'closingDate', label: 'Closing Date', visible: false },
            { key: 'remarks', label: 'Remarks', visible: false },
        ];
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge saved toggle state with default columns to ensure new code-defined columns appear
                return defaultColumns.map(defCol => {
                    const savedCol = parsed.find((p: ColumnConfig) => p.key === defCol.key);
                    return savedCol ? { ...defCol, visible: savedCol.visible } : defCol;
                });
            } catch (e) {
                console.error("Failed to parse saved columns", e);
                return defaultColumns;
            }
        }
        return defaultColumns;
    });

    useEffect(() => {
        const fetchCustomFields = async () => {
            try {
                const fields = await salesSettingsService.getCustomFields('leads');
                setCustomFields(fields);

                setColumns(prev => {
                    const existingKeys = new Set(prev.map(c => c.key));

                    // Filter out fields that are already in columns
                    const newCols = fields
                        .filter(f => !existingKeys.has(f.id))
                        .map(f => ({
                            key: f.id,
                            label: f.label,
                            visible: false
                        }));

                    if (newCols.length === 0) return prev;

                    // If we have saved columns, we might need to restore visibility for custom fields too if they were saved previously
                    const saved = localStorage.getItem('leads_columns');
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

    const filteredLeads = leads.filter(lead => {
        // Global Search
        const matchesSearch = (lead.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            (lead.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());

        // Advanced Filters
        const matchesFilters = (Object.keys(activeFilters) as Array<keyof LeadsFilters>).every(key => {
            const filterValue = activeFilters[key];
            if (!filterValue) return true; // Skip empty filters

            // 1. Check Custom Fields
            const customField = customFields.find(f => f.id === key);
            if (customField) {
                const cfValue = lead.custom_data?.[key];
                if (!cfValue) return false;
                return String(cfValue).toLowerCase().includes(filterValue.toLowerCase());
            }

            // 2. Standard Fields
            const leadValue = lead[key as keyof Lead];
            if (!leadValue) return false; // If filter exists but lead has no value, it doesn't match

            if (key === 'status' || key === 'leadSource' || key === 'serviceRequired' || key === 'leadQualification' || key === 'leadOwner') {
                return (leadValue as string) === filterValue;
            }

            // Approximate string matching for others
            return (leadValue as string).toLowerCase().includes(filterValue.toLowerCase());
        });

        return matchesSearch && matchesFilters;
    });

    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    const paginatedLeads = filteredLeads.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleSelectLead = (id: string) => {
        setSelectedLeads(prev =>
            prev.includes(id) ? prev.filter(leadId => leadId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedLeads.length === paginatedLeads.length) {
            setSelectedLeads([]);
        } else {
            setSelectedLeads(paginatedLeads.map(l => l.id));
        }
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedLeads.length} leads?`)) {
            selectedLeads.forEach(id => deleteLead(id));
            setSelectedLeads([]);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Are you sure you want to delete this lead?')) {
            deleteLead(id);
            // If deleting currently viewed lead in split view, handled by parent/detail but good to be safe
            if (id === id) {
                navigate('/sales/leads');
            }
        }
    };

    const getBrandName = (id: string) => salesSettings.brands.find(b => b.id === id)?.name || id || '-';
    const getOwnerName = (id: string) => salesSettings.leadOwners.find(o => o.id === id)?.name || id || '-';
    const getQualificationName = (id: string) => salesSettings.leadQualifications.find(q => q.id === id)?.name || id || '-';
    const getServiceName = (id: string) => salesSettings.servicesRequired.find(s => s.id === id)?.name || id || '-';

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Follow up': return 'bg-yellow-900/40 text-yellow-300 border border-yellow-800';
            case 'Submitted': return 'bg-purple-900/40 text-purple-300 border border-purple-800';
            case 'Lost to competitor': return 'bg-red-900/40 text-red-300 border border-red-800';
            case 'Convert as customer': return 'bg-emerald-900/40 text-emerald-300 border border-emerald-800';
            case 'Dropped': return 'bg-gray-700/40 text-gray-300 border border-gray-600';
            case 'Waiting for client replay': return 'bg-orange-900/40 text-orange-300 border border-orange-800';
            case 'Others': return 'bg-indigo-900/40 text-indigo-300 border border-indigo-800';
            default: return 'bg-gray-700 text-gray-300 border border-gray-600';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-400 bg-green-400/10 border-green-400/20';
        if (score >= 50) return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        return 'text-red-400 bg-red-400/10 border-red-400/20';
    };

    const renderCell = (lead: Lead, key: string, index?: number) => {
        // Handle custom fields
        const customField = customFields.find(f => f.id === key);
        if (customField) {
            const value = lead.custom_data?.[key];
            if (value === undefined || value === null || value === '') return '-';
            if (customField.type === 'checkbox') return value ? 'Yes' : 'No';
            return String(value);
        }

        switch (key) {
            case 'selection':
                return (
                    <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-offset-gray-900"
                    />
                );
            case 'sno':
                // Adjust index for pagination
                const absoluteIndex = (currentPage - 1) * itemsPerPage + (index || 0);
                return <span className="text-gray-500">{index !== undefined ? absoluteIndex + 1 : '-'}</span>;
            case 'date':
                return <span className="font-mono text-gray-500">{lead.date}</span>;
            case 'companyName':
                return <span className="font-medium text-white">{lead.companyName}</span>;
            case 'email':
                return <span className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">{lead.email}</span>;
            case 'leadSource':
                return (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-800 text-xs text-gray-300 border border-gray-700">
                        {lead.leadSource}
                    </span>
                );
            case 'status':
                return (
                    <span className={`inline-block whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(lead.status)}`}>
                        {lead.status}
                    </span>
                );
            case 'brand':
                return <span>{getBrandName(lead.brand || '')}</span>;
            case 'leadOwner':
                return <span>{getOwnerName(lead.leadOwner || '')}</span>;
            case 'leadQualification':
                return <span>{getQualificationName(lead.leadQualification || '')}</span>;
            case 'serviceRequired':
                return <span>{getServiceName(lead.serviceRequired || '')}</span>;
            case 'aiScore':
                const score = lead.custom_data?.aiScore?.score;
                if (score !== undefined) {
                    return (
                        <div className={`inline-flex items-center px-2 py-1 rounded-md border text-xs font-bold ${getScoreColor(score)}`}>
                            {score}
                            <span className="ml-1 text-[10px] opacity-70">/ 100</span>
                        </div>
                    );
                }
                return <span className="text-gray-600 text-xs italic">N/A</span>;
            default:
                // @ts-ignore
                return <span>{lead[key] || '-'}</span>;
        }
    };

    const handleSaveColumns = (newColumns: any[]) => {
        setColumns(newColumns);
        localStorage.setItem('leads_columns', JSON.stringify(newColumns));
        setIsCustomizeModalOpen(false);
    };

    const handleApplyFilters = (filters: LeadsFilters) => {
        setActiveFilters(filters);
        setIsFilterModalOpen(false);
    };

    const handleResetFilters = () => {
        setActiveFilters({});
        setIsFilterModalOpen(false);
    };

    const handleExport = () => {
        const dataToExport = filteredLeads.map(lead => ({
            'Date': lead.date,
            'Company Name': lead.companyName,
            'Mobile Number': lead.mobileNumber,
            'Email': lead.email,
            'Lead Source': salesSettings.leadSources.find(s => s.id === lead.leadSource)?.name || lead.leadSource || '-',
            'Status': lead.status,
            'Service Required': salesSettings.servicesRequired.find(s => s.id === lead.serviceRequired)?.name || lead.serviceRequired || '-',
            'Brand': salesSettings.brands.find(b => b.id === lead.brand)?.name || lead.brand || '-',
            'Lead Qualification': salesSettings.leadQualifications.find(q => q.id === lead.leadQualification)?.name || lead.leadQualification || '-',
            'Lead Owner': salesSettings.leadOwners.find(o => o.id === lead.leadOwner)?.name || lead.leadOwner || '-',
            'Remarks': lead.remarks || ''
        }));
        exportToExcel(dataToExport, 'Leads_Export');
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const data = await readExcel(e.target.files[0]);
                if (data && data.length > 0) {
                    let importedCount = 0;
                    for (const row of data) {
                        // Helper to find ID by name (case-insensitive)
                        const findIdByName = (list: { id: string, name: string }[], name: string) => {
                            if (!name) return '';
                            const item = list.find(i => i.name.toLowerCase() === String(name).toLowerCase());
                            return item ? item.id : ''; // Return empty if not found implies manual fix later or keep as is if API supports names (it expects IDs mostly)
                        };

                        const newLead: any = {
                            date: row['Date'] || new Date().toISOString().split('T')[0],
                            companyName: row['Company Name'] || '',
                            mobileNumber: row['Mobile Number'] || '',
                            email: row['Email'] || '',
                            status: row['Status'] || 'Follow up',
                            remarks: row['Remarks'] || '',
                            leadSource: findIdByName(salesSettings.leadSources, row['Lead Source']) || row['Lead Source'] || '',
                            serviceRequired: findIdByName(salesSettings.servicesRequired, row['Service Required']) || row['Service Required'] || '',
                            brand: findIdByName(salesSettings.brands, row['Brand']) || row['Brand'] || '',
                            leadQualification: findIdByName(salesSettings.leadQualifications, row['Lead Qualification']) || row['Lead Qualification'] || '',
                            leadOwner: findIdByName(salesSettings.leadOwners, row['Lead Owner']) || row['Lead Owner'] || ''
                        };

                        // Basic validation
                        if (newLead.companyName) {
                            await addLead(newLead);
                            importedCount++;
                        }
                    }
                    alert(`Successfully imported ${importedCount} leads.`);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('Import failed:', error);
                alert('Failed to import Excel file');
            }
        }
    };

    const visibleColumns = columns.filter(c => c.visible);

    // --- Master-Detail View ---
    if (id) {
        return (
            <div className="flex h-screen bg-gray-950 overflow-hidden">
                {/* Left Sidebar (25% width) */}
                <div className="w-1/4 min-w-[300px] border-r border-gray-800 bg-gray-900 border-b-0">
                    <LeadListSidebar
                        leads={leads}
                        onAddLead={hasPermission('sales-leads:create') ? () => navigate('/sales/leads/create') : undefined}
                    />
                </div>

                {/* Right Details Panel (75% width) */}
                <div className="flex-1 bg-gray-900 overflow-hidden">
                    <LeadDetail
                        leads={leads}
                        users={users}
                        salesSettings={salesSettings}
                        onEdit={hasPermission('sales-leads:edit') ? (leadId) => navigate(`/sales/leads/edit/${leadId}`) : undefined}
                        onDelete={hasPermission('sales-leads:delete') ? (leadId) => {
                            if (window.confirm('Are you sure you want to delete this lead?')) {
                                deleteLead(leadId);
                                navigate('/sales/leads');
                            }
                        } : undefined}
                    />
                </div>
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
                onSave={handleSaveColumns}
            />

            <LeadsFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
                initialFilters={activeFilters}
                users={users}
                customFields={customFields}
            />

            <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
                <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h2 className="text-lg font-semibold text-white">Leads Management</h2>
                        <p className="text-sm text-gray-400 mt-1">Total leads: {leads.length}</p>
                    </div>
                    <div className="flex space-x-3">
                        {selectedLeads.length > 0 && hasPermission('sales-leads:delete') && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center px-4 py-2 bg-red-900/30 text-red-400 font-semibold rounded-lg hover:bg-red-900/50 transition-colors text-sm border border-red-900/50"
                            >
                                <TrashIcon className="w-5 h-5 mr-2" /> Delete ({selectedLeads.length})
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
                            className="flex items-center px-4 py-2 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                            title="Import Leads"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5 mr-2 rotate-180" /> Import
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center px-4 py-2 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                            title="Export Leads"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5 mr-2" /> Export
                        </button>
                        <button
                            onClick={() => setIsFilterModalOpen(true)}
                            className={`flex items-center px-4 py-2 bg-gray-800 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700 ${Object.keys(activeFilters).length > 0 ? 'text-blue-400 border-blue-900 ring-1 ring-blue-900' : 'text-gray-300'}`}
                            title="Filter Leads"
                        >
                            <FunnelIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsCustomizeModalOpen(true)}
                            className="flex items-center px-4 py-2 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                        >
                            <AdjustmentsIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => {
                                navigate('/sales/leads/create');
                            }}
                            disabled={!hasPermission('sales-leads:create')}
                            className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <PlusIcon className="w-5 h-5 mr-2" /> Add Lead
                        </button>
                    </div>
                </div>

                <div className="p-4 border-b border-gray-800 bg-gray-900">
                    <div className="relative">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search leads by company or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2.5 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-900 border-b border-gray-800">
                            <tr>
                                {visibleColumns.map(col => (
                                    <th key={col.key} className="px-6 py-4 font-semibold tracking-wider whitespace-nowrap">
                                        {col.key === 'selection' ? (
                                            <input
                                                type="checkbox"
                                                checked={selectedLeads.length > 0 && selectedLeads.length === paginatedLeads.length}
                                                onChange={handleSelectAll}
                                                className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-offset-gray-900"
                                            />
                                        ) : (
                                            col.label
                                        )}
                                    </th>
                                ))}
                                <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedLeads.length > 0 ? (
                                paginatedLeads.map((lead, index) => (
                                    <tr
                                        key={lead.id}
                                        className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors cursor-pointer ${selectedLeads.includes(lead.id) ? 'bg-blue-900/10' : ''}`}
                                        onClick={() => navigate(`/sales/leads/${lead.id}`)}
                                    >
                                        {visibleColumns.map(col => (
                                            <td key={`${lead.id}-${col.key}`} className="px-6 py-4 whitespace-nowrap">
                                                {renderCell(lead, col.key, index)}
                                            </td>
                                        ))}
                                        <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end space-x-2">
                                                <button
                                                    onClick={() => navigate(`/sales/leads/${lead.id}`)}
                                                    className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-blue-400 transition-colors"
                                                    title="View"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        navigate(`/sales/leads/edit/${lead.id}`);
                                                    }}
                                                    disabled={!hasPermission('sales-leads:edit')}
                                                    className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(lead.id)}
                                                    disabled={!hasPermission('sales-leads:delete')}
                                                    className="p-2 rounded-lg hover:bg-red-900/20 text-gray-400 hover:text-red-400 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    <td colSpan={visibleColumns.length + 1} className="text-center p-12">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <MagnifyingGlassIcon className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-lg font-medium text-gray-400">No leads found</p>
                                            <p className="text-sm">Try adjusting your search terms or add a new lead.</p>
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
                    totalItems={filteredLeads.length}
                    itemsPerPage={itemsPerPage}
                    itemName="leads"
                />
            </div>
        </div>
    );
};
