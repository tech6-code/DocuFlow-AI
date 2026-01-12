import React, { useState } from 'react';
import type { Customer, User, Page, DocumentUploadPayload } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, EnvelopeIcon, EyeIcon, FolderIcon, FunnelIcon, AdjustmentsIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { CustomerModal } from './CustomerModal';
import { CustomerProjectsModal } from './CustomerProjectsModal';
import { ConfirmationDialog } from './ConfirmationDialog';
import { customerService } from '../services/customerService';
import { CustomizeColumnsModal } from './CustomizeColumnsModal';
import { CustomersFilterModal, CustomersFilters } from './CustomersFilterModal';

interface CustomerManagementProps {
    customers: Customer[];
    users: User[];
    onAddCustomer: (customer: Omit<Customer, 'id'>, documents?: DocumentUploadPayload[]) => void;
    onUpdateCustomer: (customer: Customer, documents?: DocumentUploadPayload[]) => void;
    onDeleteCustomer: (customerId: string) => void;
    onSelectCustomerProject: (customer: Customer, page: Page) => void;
    initialCustomerData?: Partial<Customer>;
    onCustomerClick?: (customer: Customer) => void;
}

interface ColumnConfig {
    key: keyof Customer | 'actions' | string;
    label: string;
    visible: boolean;
}

const formatCurrency = (amount: number, currencyCode: string) => {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    } catch (e) {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
};

export const CustomerManagement: React.FC<CustomerManagementProps> = ({ customers, users, onAddCustomer, onUpdateCustomer, onDeleteCustomer, onSelectCustomerProject, initialCustomerData, onCustomerClick }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);
    const [selectedCustomerForProjects, setSelectedCustomerForProjects] = useState<Customer | null>(null);
    const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { hasPermission } = useData();

    // Filtering & Columns State
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
    const [activeFilters, setActiveFilters] = useState<CustomersFilters>({});
    const [columns, setColumns] = useState<ColumnConfig[]>([
        { key: 'cifNumber', label: 'CIF', visible: true },
        { key: 'name', label: 'Name', visible: true },
        { key: 'contactInfo', label: 'Contact Info', visible: true },
        { key: 'trn', label: 'TRN', visible: true },
        { key: 'receivables', label: 'Receivables', visible: true },
        // Initially hidden columns
        { key: 'entityType', label: 'Entity Type', visible: false },
        { key: 'businessActivity', label: 'Business Activity', visible: false },
        { key: 'tradeLicenseNumber', label: 'Trade License #', visible: false },
        { key: 'ownerId', label: 'Sales Person', visible: false },
    ]);

    // Effect to handle navigation from Leads -> Convert
    React.useEffect(() => {
        if (initialCustomerData && !isModalOpen) {
            setEditingCustomer(initialCustomerData);
            setIsModalOpen(true);
        }
    }, [initialCustomerData]); // Run when initialCustomerData changes

    const canCreate = hasPermission('customer-management:create');
    const canEdit = hasPermission('customer-management:edit');
    const canDelete = hasPermission('customer-management:delete');

    const filteredCustomers = customers.filter(customer => {
        // Global Search
        const name = customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`;
        const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            customer.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (customer.trn && customer.trn.includes(searchTerm)) ||
            (customer.cifNumber && customer.cifNumber.toLowerCase().includes(searchTerm.toLowerCase()));

        // Advanced Filters
        const matchesFilters = (Object.keys(activeFilters) as Array<keyof CustomersFilters>).every(key => {
            const filterValue = activeFilters[key];
            if (!filterValue) return true;

            let customerValue: any = customer[key as keyof Customer];

            // Special handling for 'name' filter which checks both companyName and first/last name
            if (key === 'name') {
                const fullName = `${customer.firstName} ${customer.lastName}`;
                return (
                    (customer.companyName || '').toLowerCase().includes(filterValue.toLowerCase()) ||
                    fullName.toLowerCase().includes(filterValue.toLowerCase())
                );
            }

            if (customerValue === undefined || customerValue === null) return false;

            // Exact match for selects (like Sales Person / ownerId)
            if (key === 'ownerId') {
                return String(customerValue) === filterValue;
            }

            // String matching for others
            return String(customerValue).toLowerCase().includes(filterValue.toLowerCase());
        });

        return matchesSearch && matchesFilters;
    });

    const handleOpenAddModal = () => {
        if (!canCreate) return;
        setEditingCustomer(null);
        setIsViewMode(false);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (customer: Customer) => {
        if (!canEdit) return;
        setEditingCustomer(customer);
        setIsViewMode(false);
        setIsModalOpen(true);
    };

    const handleOpenViewModal = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsViewMode(true);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCustomer(null);
        setIsViewMode(false);
    };

    // Modified to accept documents
    const handleSaveCustomer = async (customer: Omit<Customer, 'id'> | Customer, documents?: DocumentUploadPayload[]) => {
        if ('id' in customer) {
            // Update
            onUpdateCustomer(customer, documents);
        } else {
            // Create
            onAddCustomer(customer, documents);
        }
    };

    const handleDeleteClick = (customerId: string) => {
        setCustomerToDelete(customerId);
    };

    const handleConfirmDelete = () => {
        if (customerToDelete) {
            onDeleteCustomer(customerToDelete);
            setCustomerToDelete(null);
        }
    };

    const handleShowProjects = (customer: Customer) => {
        setSelectedCustomerForProjects(customer);
    };

    const handleApplyFilters = (filters: CustomersFilters) => {
        setActiveFilters(filters);
        setIsFilterModalOpen(false);
    };

    const handleResetFilters = () => {
        setActiveFilters({});
        setIsFilterModalOpen(false);
    };

    const getOwnerName = (id?: string) => {
        if (!id) return '-';
        return users.find(u => u.id === id)?.name || id;
    };

    const visibleColumns = columns.filter(c => c.visible);

    const renderCell = (customer: Customer, key: string) => {
        switch (key) {
            case 'cifNumber':
                return <span className="text-blue-400 font-medium font-mono text-sm">{customer.cifNumber || '-'}</span>;
            case 'name':
                return (
                    <p className="font-medium text-white text-base">
                        {customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`}
                    </p>
                );
            case 'contactInfo':
                return (
                    <>
                        {customer.email && (
                            <div className="flex items-center mb-1 text-gray-300">
                                <EnvelopeIcon className="w-3.5 h-3.5 mr-2 text-gray-500" />
                                {customer.email}
                            </div>
                        )}
                        {customer.workPhone && (
                            <div className="flex items-center text-gray-400 text-xs">
                                <span className="mr-2">Work:</span>
                                {customer.workPhone}
                            </div>
                        )}
                        {customer.mobile && (
                            <div className="flex items-center text-gray-400 text-xs">
                                <span className="mr-2">Mob:</span>
                                {customer.mobile}
                            </div>
                        )}
                    </>
                );
            case 'trn':
                return customer.trn ? (
                    <span className="flex items-center text-gray-300 font-mono text-xs bg-gray-800 px-2 py-1 rounded border border-gray-700 w-fit">
                        {customer.trn}
                    </span>
                ) : <span className="text-gray-600">-</span>;
            case 'receivables':
                return <span className="font-mono text-white">{formatCurrency(customer.openingBalance, customer.currency)}</span>;
            case 'ownerId':
                return <span className="text-gray-300">{getOwnerName(customer.ownerId)}</span>;
            default:
                // @ts-ignore
                return <span className="text-gray-300">{customer[key] || '-'}</span>;
        }
    };

    return (
        <div className="h-full">
            {isModalOpen ? (
                <div className="h-full p-8">
                    <CustomerModal
                        customer={editingCustomer}
                        users={users}
                        onSave={handleSaveCustomer}
                        onClose={handleCloseModal}
                        viewOnly={isViewMode}
                        inline={true}
                    />
                </div>
            ) : (
                <div className="bg-gray-900 rounded-lg border border-gray-700 shadow-sm">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <div>
                                <h2 className="text-lg font-semibold text-white">Customers</h2>
                                <p className="text-sm text-gray-400">Total customers: {customers.length}</p>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            <button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={`flex items-center px-4 py-2 bg-gray-800 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700 ${Object.keys(activeFilters).length > 0 ? 'text-blue-400 border-blue-900 ring-1 ring-blue-900' : 'text-gray-300'}`}
                                title="Filter Customers"
                            >
                                <FunnelIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setIsCustomizeModalOpen(true)}
                                className="flex items-center px-4 py-2 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-colors text-sm border border-gray-700"
                                title="Customize Columns"
                            >
                                <AdjustmentsIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleOpenAddModal}
                                disabled={!canCreate}
                                className="flex items-center px-4 py-2 bg-white text-black font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm shadow-sm disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-5 h-5 mr-2" /> Add Customer
                            </button>
                        </div>
                    </div>
                    <div className="p-4 border-b border-gray-800">
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name, company, email, or TRN..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2 pl-10 border border-gray-600 rounded-md focus:ring-2 focus:ring-white focus:border-white outline-none transition bg-gray-800 text-white"
                                aria-label="Search customers"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                <tr>
                                    {visibleColumns.map(col => (
                                        <th key={col.key} scope="col" className={`px-6 py-3 font-semibold ${col.key === 'receivables' ? 'text-right' : ''}`}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th scope="col" className="px-6 py-3 font-semibold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCustomers.length > 0 ? (
                                    filteredCustomers.map(customer => (
                                        <tr
                                            key={customer.id}
                                            className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
                                            onClick={() => onCustomerClick ? onCustomerClick(customer) : handleOpenViewModal(customer)}
                                            title="Click row to view customer details"
                                        >
                                            {visibleColumns.map(col => (
                                                <td key={`${customer.id}-${col.key}`} className={`px-6 py-4 ${col.key === 'receivables' ? 'text-right' : ''}`}>
                                                    {renderCell(customer, col.key)}
                                                </td>
                                            ))}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center space-x-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleShowProjects(customer); }}
                                                        className="p-2 rounded hover:bg-gray-700 transition-colors text-blue-400 hover:text-blue-300"
                                                        title="View Projects"
                                                    >
                                                        <FolderIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenViewModal(customer); }}
                                                        className="p-2 rounded hover:bg-gray-700 transition-colors text-gray-300 hover:text-white"
                                                        title="View Details"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(customer); }}
                                                        disabled={!canEdit}
                                                        className="p-2 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-300 hover:text-white"
                                                        title="Edit Details"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(customer.id); }}
                                                        disabled={!canDelete}
                                                        className="p-2 rounded hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="w-4 h-4 text-red-400 group-hover:text-red-300" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 1} className="text-center p-8 text-gray-500">
                                            No customers found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <CustomersFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
                initialFilters={activeFilters}
                users={users}
            />

            <CustomizeColumnsModal
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                columns={columns}
                onSave={(newCols) => { setColumns(newCols); setIsCustomizeModalOpen(false); }}
            />

            {selectedCustomerForProjects && (
                <CustomerProjectsModal
                    customer={selectedCustomerForProjects}
                    onSelectProject={(page) => {
                        onSelectCustomerProject(selectedCustomerForProjects, page);
                        setSelectedCustomerForProjects(null);
                    }}
                    onClose={() => setSelectedCustomerForProjects(null)}
                />
            )}

            <ConfirmationDialog
                isOpen={!!customerToDelete}
                onConfirm={handleConfirmDelete}
                onCancel={() => setCustomerToDelete(null)}
                title="Delete Customer"
                confirmText="Delete"
                cancelText="Cancel"
            >
                Are you sure you want to delete this customer? This action cannot be undone and may affect associated project data.
            </ConfirmationDialog>
        </div>
    );
};
