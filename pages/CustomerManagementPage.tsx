import React from 'react';
import { useLocation } from 'react-router-dom';
import { CustomerManagement } from '../components/CustomerManagement';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';

export const CustomerManagementPage: React.FC = () => {
    const { customers, users, addCustomer, updateCustomer, deleteCustomer } = useData();
    const navigate = useNavigate();
    const location = useLocation();
    const prefillData = location.state?.prefill;

    return (
        <CustomerManagement
            customers={customers}
            users={users}
            onAddCustomer={addCustomer}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={deleteCustomer}
            initialCustomerData={prefillData}
            onSelectCustomerProject={(cust, page) => {
                // Logic to navigate to project page with this customer selected?
                // The CustomerManagement component calls this when "Manage Projects" is clicked.
                // In App.tsx it set selectedCompany and navigated.
                // Here we can't easily set 'selectedCompany' in ProjectPageWrapper from here unless we pass it via URL or Global State.
                // Since we don't have global 'selectedCompany' state anymore (it's in ProjectPageWrapper), we need a way.
                // We can pass state via router location state.

                // Helper to parse period
                const parsePeriodString = (str: string | undefined) => {
                    if (!str) return { start: '', end: '' };
                    const parts = str.split(/(?:\s+to\s+|\s+-\s+)/i);
                    if (parts.length === 2) return { start: parts[0].trim(), end: parts[1].trim() };
                    return { start: '', end: '' };
                };
                const { start, end } = parsePeriodString(cust.firstVatFilingPeriod);
                const companyData = {
                    ...cust, name: cust.type === 'business' ? cust.companyName : `${cust.firstName} ${cust.lastName}`, address: cust.billingAddress, trn: cust.trn, incorporationDate: cust.incorporationDate || '', businessType: cust.entityType || '', financialYear: new Date().getFullYear().toString(), reportingPeriod: cust.vatReportingPeriod || '', periodStart: start, periodEnd: end, dueDate: cust.vatFilingDueDate,
                    ctPeriodStart: cust.firstCorporateTaxPeriodStart, ctPeriodEnd: cust.firstCorporateTaxPeriodEnd, ctDueDate: cust.corporateTaxFilingDueDate
                };

                // Navigate to the target page and pass company data in state
                // Need to map 'page' type to route.
                let path = '/';
                if (page === 'projectFinancialOverview') path = '/projects/bookkeeping';
                else if (page === 'projectVatFiling') path = '/projects/vat-filing';
                else if (page === 'projectCtFiling') path = '/projects/ct-filing';
                else if (page === 'projectRegistration') path = '/projects/registration';
                else if (page === 'projectAuditReport') path = '/projects/audit-report';

                navigate(path, { state: { selectedCompany: companyData } });
            }}
        />
    );
};
