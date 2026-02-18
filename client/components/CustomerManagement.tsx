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
import { Pagination } from './Pagination';
import { salesSettingsService, CustomField } from '../services/salesSettingsService';

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
    const [customFields, setCustomFields] = useState<CustomField[]>([]);

    // Pagination & Selection State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

    const [columns, setColumns] = useState<ColumnConfig[]>(() => {
        const saved = localStorage.getItem('customers_columns');
        const defaultColumns = [
            { key: 'selection', label: '', visible: true },
            { key: 'cifNumber', label: 'CIF', visible: true },
            { key: 'name', label: 'Name', visible: true },
            { key: 'contactInfo', label: 'Contact Info', visible: true },
            { key: 'trn', label: 'TRN', visible: true },
            { key: 'receivables', label: 'Receivables', visible: true },

            // Basic Info
            { key: 'type', label: 'Customer Type', visible: false },
            { key: 'salutation', label: 'Salutation', visible: false },
            { key: 'firstName', label: 'First Name', visible: false },
            { key: 'lastName', label: 'Last Name', visible: false },
            { key: 'companyName', label: 'Company Name', visible: false },
            { key: 'email', label: 'Email', visible: false },
            { key: 'workPhone', label: 'Work Phone', visible: false },
            { key: 'mobile', label: 'Mobile', visible: false },
            { key: 'currency', label: 'Currency', visible: false },
            { key: 'language', label: 'Language', visible: false },

            // Business Details
            { key: 'entityType', label: 'Entity Type', visible: false },
            { key: 'entitySubType', label: 'Entity Sub Type', visible: false },
            { key: 'incorporationDate', label: 'Incorporation Date', visible: false },
            { key: 'tradeLicenseAuthority', label: 'Trade License Authority', visible: false },
            { key: 'tradeLicenseNumber', label: 'Trade License #', visible: false },
            { key: 'tradeLicenseIssueDate', label: 'Trade License Issue Date', visible: false },
            { key: 'tradeLicenseExpiryDate', label: 'Trade License Expiry Date', visible: false },
            { key: 'businessActivity', label: 'Business Activity', visible: false },
            { key: 'isFreezone', label: 'Is Freezone', visible: false },
            { key: 'freezoneName', label: 'Freezone Name', visible: false },
            { key: 'authorisedSignatories', label: 'Authorised Signatories', visible: false },
            { key: 'shareCapital', label: 'Share Capital', visible: false },

            // Address
            { key: 'billingAddress', label: 'Billing Address', visible: false },
            { key: 'shippingAddress', label: 'Shipping Address', visible: false },

            // Tax & Financials
            { key: 'taxTreatment', label: 'Tax Treatment', visible: false },
            { key: 'vatRegisteredDate', label: 'VAT Registered Date', visible: false },
            { key: 'firstVatFilingPeriod', label: 'First VAT Filing Period', visible: false },
            { key: 'vatFilingDueDate', label: 'VAT Filing Due Date', visible: false },
            { key: 'vatReportingPeriod', label: 'VAT Reporting Period', visible: false },
            { key: 'corporateTaxTreatment', label: 'Corporate Tax Treatment', visible: false },
            { key: 'corporateTaxTrn', label: 'Corporate Tax TRN', visible: false },
            { key: 'corporateTaxRegisteredDate', label: 'CT Registered Date', visible: false },
            { key: 'corporateTaxPeriod', label: 'Corporate Tax Period', visible: false },
            { key: 'firstCorporateTaxPeriodStart', label: 'First CT Period Start', visible: false },
            { key: 'firstCorporateTaxPeriodEnd', label: 'First CT Period End', visible: false },
            { key: 'corporateTaxFilingDueDate', label: 'CT Filing Due Date', visible: false },
            { key: 'businessRegistrationNumber', label: 'Business Reg #', visible: false },
            { key: 'placeOfSupply', label: 'Place of Supply', visible: false },
            { key: 'paymentTerms', label: 'Payment Terms', visible: false },

            // Other
            { key: 'remarks', label: 'Remarks', visible: false },
            { key: 'portalAccess', label: 'Portal Access', visible: false },
            { key: 'ownerId', label: 'Sales Person', visible: false },
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

    // Effect to handle navigation from Leads -> Convert
    React.useEffect(() => {
        if (initialCustomerData && !isModalOpen) {
            setEditingCustomer(initialCustomerData);
            setIsModalOpen(true);
        }
    }, [initialCustomerData]);

    React.useEffect(() => {
        const fetchCustomFields = async () => {
            try {
                const fields = await salesSettingsService.getCustomFields('customers');
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

                    const saved = localStorage.getItem('customers_columns');
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

            // 1. Check Custom Fields
            const customField = customFields.find(f => f.id === key);
            if (customField) {
                const cfValue = customer.custom_data?.[key];
                if (!cfValue) return false;
                return String(cfValue).toLowerCase().includes(filterValue.toLowerCase());
            }

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

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handleSelectCustomer = (id: string) => {
        setSelectedCustomers(prev =>
            prev.includes(id) ? prev.filter(customerId => customerId !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => {
        if (selectedCustomers.length === paginatedCustomers.length) {
            setSelectedCustomers([]);
        } else {
            setSelectedCustomers(paginatedCustomers.map(c => c.id));
        }
    };

    const handleBulkDelete = () => {
        if (window.confirm(`Are you sure you want to delete ${selectedCustomers.length} customers?`)) {
            selectedCustomers.forEach(id => onDeleteCustomer(id));
            setSelectedCustomers([]);
        }
    };

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
        // Handle custom fields
        const customField = customFields.find(f => f.id === key);
        if (customField) {
            const value = customer.custom_data?.[key];
            if (value === undefined || value === null || value === '') return '-';
            if (customField.type === 'checkbox') return value ? 'Yes' : 'No';
            return String(value);
        }

        switch (key) {
            case 'selection':
                return (
                    <input
                        type="checkbox"
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={() => handleSelectCustomer(customer.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-border bg-muted text-primary focus:ring-offset-background"
                    />
                );
            case 'cifNumber':
                return <span className="text-primary font-medium font-mono text-sm">{customer.cifNumber || '-'}</span>;
            case 'name':
                return (
                    <p className="font-medium text-foreground text-base">
                        {customer.type === 'business' ? customer.companyName : `${customer.firstName} ${customer.lastName}`}
                    </p>
                );
            case 'contactInfo':
                return (
                    <>
                        {customer.email && (
                            <div className="flex items-center mb-1 text-muted-foreground">
                                <EnvelopeIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground/60" />
                                {customer.email}
                            </div>
                        )}
                        {customer.workPhone && (
                            <div className="flex items-center text-muted-foreground/80 text-xs">
                                <span className="mr-2">Work:</span>
                                {customer.workPhone}
                            </div>
                        )}
                        {customer.mobile && (
                            <div className="flex items-center text-muted-foreground/80 text-xs">
                                <span className="mr-2">Mob:</span>
                                {customer.mobile}
                            </div>
                        )}
                    </>
                );
            case 'trn':
                return customer.trn ? (
                    <span className="flex items-center text-muted-foreground font-mono text-xs bg-muted px-2 py-1 rounded border border-border w-fit">
                        {customer.trn}
                    </span>
                ) : <span className="text-muted-foreground/40">-</span>;
            case 'receivables':
                return <span className="font-mono text-foreground">{formatCurrency(customer.openingBalance, customer.currency)}</span>;
            case 'ownerId':
                return <span className="text-muted-foreground">{getOwnerName(customer.ownerId)}</span>;
            default:
                // @ts-ignore
                const val = customer[key];
                if (typeof val === 'boolean') {
                    return <span className="text-muted-foreground">{val ? 'Yes' : 'No'}</span>;
                }
                return <span className="text-muted-foreground">{val || val === 0 ? String(val) : '-'}</span>;
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
                <div className="bg-card rounded-lg border border-border shadow-sm">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-card/50">
                        <div className="flex items-center space-x-3">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Customers</h2>
                                <p className="text-sm text-muted-foreground">Total customers: {customers.length}</p>
                            </div>
                        </div>
                        <div className="flex space-x-3">
                            {selectedCustomers.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center px-4 py-2 bg-destructive/10 text-destructive font-semibold rounded-lg hover:bg-destructive/20 transition-colors text-sm border border-destructive/30"
                                >
                                    <TrashIcon className="w-5 h-5 mr-2" /> Delete ({selectedCustomers.length})
                                </button>
                            )}
                            <button
                                onClick={() => setIsFilterModalOpen(true)}
                                className={`flex items-center px-4 py-2 bg-muted font-semibold rounded-lg hover:bg-muted/80 transition-colors text-sm border border-border ${Object.keys(activeFilters).length > 0 ? 'text-primary border-primary ring-1 ring-primary' : 'text-muted-foreground'}`}
                                title="Filter Customers"
                            >
                                <FunnelIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setIsCustomizeModalOpen(true)}
                                className="flex items-center px-4 py-2 bg-muted text-muted-foreground font-semibold rounded-lg hover:bg-muted/80 transition-colors text-sm border border-border"
                                title="Customize Columns"
                            >
                                <AdjustmentsIcon className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleOpenAddModal}
                                disabled={!canCreate}
                                className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PlusIcon className="w-5 h-5 mr-2" /> Add Customer
                            </button>
                        </div>
                    </div>
                    <div className="p-4 border-b border-border bg-card">
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search by name, company, email, or TRN..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-2.5 pl-10 border border-border rounded-lg outline-none transition bg-muted text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                                aria-label="Search customers"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-muted-foreground">
                            <thead className="text-xs text-muted-foreground uppercase bg-card border-b border-border">
                                <tr>
                                    {visibleColumns.map(col => (
                                        <th key={col.key} scope="col" className={`px-6 py-3 font-semibold ${col.key === 'receivables' ? 'text-right' : ''}`}>
                                            {col.key === 'selection' ? (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCustomers.length > 0 && selectedCustomers.length === paginatedCustomers.length}
                                                    onChange={handleSelectAll}
                                                    className="rounded border-border bg-muted text-primary focus:ring-offset-background"
                                                />
                                            ) : (
                                                col.label
                                            )}
                                        </th>
                                    ))}
                                    <th scope="col" className="px-6 py-3 font-semibold text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedCustomers.length > 0 ? (
                                    paginatedCustomers.map(customer => (
                                        <tr
                                            key={customer.id}
                                            className={`border-b border-border hover:bg-muted/50 cursor-pointer transition-colors ${selectedCustomers.includes(customer.id) ? 'bg-primary/10' : ''}`}
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
                                                        className="p-2 rounded hover:bg-muted transition-colors text-primary hover:text-primary/80"
                                                        title="View Projects"
                                                    >
                                                        <FolderIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenViewModal(customer); }}
                                                        className="p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                                        title="View Details"
                                                    >
                                                        <EyeIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(customer); }}
                                                        disabled={!canEdit}
                                                        className="p-2 rounded hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                                                        title="Edit Details"
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(customer.id); }}
                                                        disabled={!canDelete}
                                                        className="p-2 rounded hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="w-4 h-4 text-destructive group-hover:text-destructive/80" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={visibleColumns.length + 1} className="text-center p-8 text-muted-foreground">
                                            No customers found.
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
                        totalItems={filteredCustomers.length}
                        itemsPerPage={itemsPerPage}
                        itemName="customers"
                    />
                </div>
            )}

            <CustomersFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApplyFilters={handleApplyFilters}
                onResetFilters={handleResetFilters}
                initialFilters={activeFilters}
                users={users}
                customFields={customFields}
            />

            <CustomizeColumnsModal
                isOpen={isCustomizeModalOpen}
                onClose={() => setIsCustomizeModalOpen(false)}
                columns={columns}
                onSave={(newCols) => {
                    setColumns(newCols);
                    localStorage.setItem('customers_columns', JSON.stringify(newCols));
                    setIsCustomizeModalOpen(false);
                }}
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
