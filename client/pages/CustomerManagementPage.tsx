import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { CustomerListSidebar } from '../components/CustomerListSidebar';
import { CustomerDetail } from '../components/CustomerDetail';
import { CustomerManagement } from '../components/CustomerManagement';
import { useData } from '../contexts/DataContext';
import { CustomerModal } from '../components/CustomerModal';
import { Customer, DocumentUploadPayload } from '../types';

export const CustomerManagementPage: React.FC = () => {
    // 1. Context and Hooks
    const { customers, users, addCustomer, updateCustomer, deleteCustomer, hasPermission } = useData();
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams<{ id: string }>();

    // 2. Local State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Partial<Customer> | null>(null);

    // 3. Permissions
    const canCreate = hasPermission('customer-management:create');
    const canEdit = hasPermission('customer-management:edit');
    const canDelete = hasPermission('customer-management:delete');

    // 4. Effects
    // Handle Lead Conversion Prefill (Common for both views)
    useEffect(() => {
        const state = location.state as any;
        const prefillData = state?.prefill;
        if (prefillData && !isModalOpen) {
            setEditingCustomer(prefillData);
            setIsModalOpen(true);
            // Clear state
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    // 5. Handlers
    const handleAddClick = () => {
        setEditingCustomer(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (customer: Customer) => {
        setEditingCustomer(customer);
        setIsModalOpen(true);
    };

    const handleSaveCustomer = async (customer: Omit<Customer, 'id'> | Customer, documents?: DocumentUploadPayload[]) => {
        if ('id' in customer) {
            await updateCustomer(customer, documents);
        } else {
            await addCustomer(customer, documents);
        }
        setIsModalOpen(false);
        setEditingCustomer(null);
    };

    const handleDeleteCustomer = async (customerId: string) => {
        await deleteCustomer(customerId);
        if (id === customerId) {
            navigate('/customers');
        }
    };

    const handleTableCustomerClick = (customer: Customer) => {
        navigate(`/customers/${customer.id}`);
    };

    // 6. Render

    // --- Table View (Root) ---
    if (!id) {
        return (
            <div>
                <CustomerManagement
                    customers={customers}
                    users={users}
                    onAddCustomer={addCustomer}
                    onUpdateCustomer={updateCustomer}
                    onDeleteCustomer={deleteCustomer}
                    onSelectCustomerProject={(cust, page) => {
                        // Handle navigation to project pages
                        // This logic was previously inline or missing, just logging for now
                        console.log("Project intent:", cust, page);
                    }}
                    onCustomerClick={handleTableCustomerClick}
                    initialCustomerData={editingCustomer || undefined}
                />
            </div>
        );
    }

    // --- Split View (Detail) ---
    return (
        <div className="flex h-screen bg-background overflow-hidden">
            {/* Left Sidebar (25% width) */}
            <div className="w-1/4 min-w-[300px] border-r border-border bg-card">
                <CustomerListSidebar
                    customers={customers}
                    onAddCustomer={handleAddClick}
                    canCreate={canCreate}
                />
            </div>

            {/* Right Details Panel (75% width) */}
            <div className="flex-1 bg-card overflow-hidden">
                <CustomerDetail
                    customers={customers}
                    onEdit={handleEditClick}
                    onDelete={handleDeleteCustomer}
                    canEdit={canEdit}
                    canDelete={canDelete}
                />
            </div>

            {/* Modals for Split View */}
            {isModalOpen && (
                <CustomerModal
                    customer={editingCustomer}
                    users={users}
                    onSave={handleSaveCustomer}
                    onClose={() => { setIsModalOpen(false); setEditingCustomer(null); }}
                    viewOnly={false}
                />
            )}
        </div>
    );
};
