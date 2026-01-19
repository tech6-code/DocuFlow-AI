import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';

import { userService } from '../services/userService';
import { departmentService } from '../services/departmentService';
import { roleService } from '../services/roleService';
import { customerService } from '../services/customerService';
import { leadsService } from '../services/leadsService';
import { dealService } from '../services/dealService';
import { salesSettingsService } from '../services/salesSettingsService';
import { User, Role, Department, Customer, Permission, Company, DocumentUploadPayload, DocumentHistoryItem, Invoice, Lead, Deal, SalesSettings } from '../types';


interface DataContextType {
    roles: Role[];
    permissionsList: Permission[];
    departments: Department[];
    users: User[];
    customers: Customer[];
    projectCompanies: Company[];

    documentHistory: DocumentHistoryItem[];
    addHistoryItem: (item: DocumentHistoryItem) => void;
    updateHistoryItem: (item: DocumentHistoryItem) => void;
    deleteHistoryItem: (id: string) => void;

    knowledgeBase: Invoice[];
    addToKnowledgeBase: (invoice: Invoice) => void;

    addUser: (u: Omit<User, 'id'>) => Promise<void>;
    updateUser: (u: User) => Promise<void>;
    deleteUser: (id: string) => Promise<void>;

    addDepartment: (name: string) => Promise<void>;
    updateDepartment: (d: Department) => Promise<void>;
    deleteDepartment: (id: string) => Promise<void>;

    addRole: (name: string, desc: string) => Promise<void>;
    updateRoleDetails: (id: string, name: string, desc: string) => Promise<void>;
    updateRolePermissions: (id: string, perms: string[]) => Promise<void>;
    deleteRole: (id: string) => Promise<void>;

    addCustomer: (c: Omit<Customer, 'id'>, documents?: DocumentUploadPayload[]) => Promise<void>;
    updateCustomer: (c: Customer, documents?: DocumentUploadPayload[]) => Promise<void>;
    deleteCustomer: (id: string) => Promise<void>;

    leads: Lead[];
    addLead: (lead: Omit<Lead, 'id'>) => Promise<void>;
    updateLead: (lead: Lead) => Promise<void>;
    deleteLead: (id: string) => Promise<void>;

    salesSettings: SalesSettings;
    updateSalesSettings: (settings: SalesSettings) => void;

    deals: Deal[];
    addDeal: (deal: Omit<Deal, 'id'>) => Promise<void>;
    updateDeal: (deal: Deal) => Promise<void>;
    deleteDeal: (id: string) => Promise<void>;

    hasPermission: (permissionId: string) => boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: ReactNode }) => {
    const { currentUser } = useAuth();

    const [roles, setRoles] = useState<Role[]>([]);
    const [permissionsList, setPermissionsList] = useState<Permission[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [documentHistory, setDocumentHistory] = useState<DocumentHistoryItem[]>([]);
    const [knowledgeBase, setKnowledgeBase] = useState<Invoice[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [dbDepts, dbUsers, dbRoles, dbPerms] = await Promise.all([
                    departmentService.getDepartments(),
                    userService.getUsers(),
                    roleService.getRoles(),
                    roleService.getPermissions()
                ]);
                if (dbDepts) setDepartments(dbDepts);
                if (dbUsers) setUsers(dbUsers);
                if (dbRoles) setRoles(dbRoles);
                if (dbPerms) setPermissionsList(dbPerms);
                const dbCustomers = await customerService.getCustomers();
                if (dbCustomers) setCustomers(dbCustomers);
            } catch (e) {
                console.error("Failed to load initial data", e);
            }
        };
        if (currentUser) loadData();
    }, [currentUser]);

    const addUser = async (u: Omit<User, 'id'>) => {
        try {
            const newUser = await userService.createUser(u);
            if (newUser) setUsers(prev => [...prev, newUser]);
        } catch (e: any) {
            alert(e.message || "Failed to add user.");
        }
    };

    const updateUser = async (u: User) => {
        const updatedUser = await userService.updateUser(u);
        if (updatedUser) setUsers(prev => prev.map(user => user.id === u.id ? updatedUser : user));
    };

    const deleteUser = async (id: string) => {
        const success = await userService.deleteUser(id);
        if (success) setUsers(prev => prev.filter(u => u.id !== id));
    };

    const addDepartment = async (name: string) => {
        try {
            const newDept = await departmentService.createDepartment(name);
            if (newDept) setDepartments(prev => [...prev, newDept]);
        } catch (e: any) {
            alert("Failed to add department: " + e.message);
        }
    };

    const updateDepartment = async (d: Department) => {
        try {
            const updated = await departmentService.updateDepartment(d);
            if (updated) setDepartments(prev => prev.map(dept => dept.id === d.id ? updated : d));
        } catch (e: any) {
            alert("Failed to update department: " + e.message);
        }
    };

    const deleteDepartment = async (id: string) => {
        const success = await departmentService.deleteDepartment(id);
        if (success) setDepartments(prev => prev.filter(d => d.id !== id));
        else alert("Failed to delete department. Ensure no users are assigned to it.");
    };

    const addRole = async (name: string, desc: string) => {
        try {
            const newRole = await roleService.createRole(name, desc);
            if (newRole) setRoles(prev => [...prev, newRole]);
        } catch (e: any) {
            alert("Failed to create role: " + e.message);
        }
    };

    const updateRoleDetails = async (id: string, name: string, desc: string) => {
        try {
            await roleService.updateRoleDetails(id, name, desc);
            setRoles(prev => prev.map(r => r.id === id ? { ...r, name, description: desc } : r));
        } catch (e: any) {
            alert("Failed to update role: " + e.message);
        }
    };

    const updateRolePermissions = async (id: string, perms: string[]) => {
        try {
            await roleService.updateRolePermissions(id, perms);
            setRoles(prev => prev.map(r => r.id === id ? { ...r, permissions: perms } : r));
        } catch (e: any) {
            alert("Failed to update permissions: " + e.message);
        }
    };

    const deleteRole = async (id: string) => {
        try {
            await roleService.deleteRole(id);
            setRoles(prev => prev.filter(r => r.id !== id));
        } catch (e: any) {
            alert(e.message);
        }
    };

    const addCustomer = async (c: Omit<Customer, 'id'>, documents?: DocumentUploadPayload[]) => {
        try {
            const customerData = { ...c, ownerId: c.ownerId || currentUser?.id };
            const newCustomer = await customerService.createCustomer(customerData, documents);
            if (newCustomer) setCustomers(prev => [newCustomer, ...prev]);
        } catch (e: any) {
            alert("Failed to create customer: " + e.message);
        }
    };

    const updateCustomer = async (c: Customer, documents?: DocumentUploadPayload[]) => {
        try {
            const updated = await customerService.updateCustomer(c, documents);
            if (updated) setCustomers(prev => prev.map(cust => cust.id === c.id ? updated : cust));
        } catch (e: any) {
            alert("Failed to update customer: " + e.message);
        }
    };

    const deleteCustomer = async (id: string) => {
        try {
            const success = await customerService.deleteCustomer(id);
            if (success) setCustomers(prev => prev.filter(c => c.id !== id));
        } catch (e: any) {
            alert("Failed to delete customer: " + e.message);
        }
    };

    const projectCompanies = useMemo(() => {
        const parsePeriodString = (str: string | undefined) => {
            if (!str) return { start: '', end: '' };
            const parts = str.split(/(?:\s+to\s+|\s+-\s+)/i);
            if (parts.length === 2) return { start: parts[0].trim(), end: parts[1].trim() };
            return { start: '', end: '' };
        };
        return customers.map(c => {
            const { start, end } = parsePeriodString(c.firstVatFilingPeriod);
            const name = c.type === 'business' ? c.companyName : `${c.firstName} ${c.lastName}`;
            return {
                id: c.id, name, address: c.billingAddress, trn: c.trn, corporateTaxTrn: c.corporateTaxTrn, incorporationDate: c.incorporationDate || '', shareCapital: c.shareCapital, businessType: c.entityType || '', financialYear: new Date().getFullYear().toString(), reportingPeriod: c.vatReportingPeriod || '', periodStart: start, periodEnd: end, dueDate: c.vatFilingDueDate,
                ctPeriodStart: c.firstCorporateTaxPeriodStart, ctPeriodEnd: c.firstCorporateTaxPeriodEnd, ctDueDate: c.corporateTaxFilingDueDate,
                shareCapital: c.shareCapital
            } as Company;
        });
    }, [customers]);

    const hasPermission = (permissionId: string) => {
        if (!currentUser) return false;
        const role = roles.find(r => r.id === currentUser.roleId);
        // Super Admin gets all permissions
        if (role?.name?.toUpperCase() === 'SUPER ADMIN') return true;
        return role ? role.permissions.includes(permissionId) : false;
    };

    const addHistoryItem = (item: DocumentHistoryItem) => {
        setDocumentHistory(prev => [item, ...prev]);
    };

    const updateHistoryItem = (item: DocumentHistoryItem) => {
        setDocumentHistory(prev => prev.map(i => i.id === item.id ? item : i));
    };

    const deleteHistoryItem = (id: string) => {
        setDocumentHistory(prev => prev.filter(i => i.id !== id));
    };

    const addToKnowledgeBase = (invoice: Invoice) => {
        setKnowledgeBase(prev => [...prev, invoice]);
    };

    const [salesSettings, setSalesSettings] = useState<SalesSettings>({
        leadSources: [],
        servicesRequired: [],
        leadQualifications: [],
        brands: [],
        leadOwners: [],
        services: ['VAT Filing', 'Registration', 'Audit', 'Bookkeeping'],
        serviceClosedOptions: ['Yes', 'No'],
        paymentStatusOptions: ['Paid', 'Pending', 'Overdue', 'Partial']
    });

    useEffect(() => {
        const loadSalesSettings = async () => {
            try {
                const [sources, services, quails, brands, owners] = await Promise.all([
                    salesSettingsService.getLeadSources(),
                    salesSettingsService.getServicesRequired(),
                    salesSettingsService.getLeadQualifications(),
                    salesSettingsService.getBrands(),
                    salesSettingsService.getLeadOwners()
                ]);
                const extra = salesSettingsService.getExtraSettings();
                setSalesSettings({
                    leadSources: sources,
                    servicesRequired: services,
                    leadQualifications: quails,
                    brands: brands,
                    leadOwners: owners,
                    services: extra.services,
                    serviceClosedOptions: extra.serviceClosedOptions,
                    paymentStatusOptions: extra.paymentStatusOptions
                });
            } catch (error) {
                console.error("Failed to load sales settings", error);
            }
        };
        if (currentUser) loadSalesSettings();
    }, [currentUser]);

    const updateSalesSettings = (newSettings: SalesSettings) => {
        setSalesSettings(newSettings);
        salesSettingsService.saveExtraSettings({
            services: newSettings.services,
            serviceClosedOptions: newSettings.serviceClosedOptions,
            paymentStatusOptions: newSettings.paymentStatusOptions
        });
    };

    const [leads, setLeads] = useState<Lead[]>([]);

    useEffect(() => {
        const fetchLeads = async () => {
            try {
                const dbLeads = await leadsService.getLeads();
                setLeads(dbLeads);
            } catch (error) {
                console.error("Failed to load leads", error);
            }
        };
        if (currentUser) {
            fetchLeads();
        }
    }, [currentUser]);

    const addLead = async (lead: Omit<Lead, 'id'>) => {
        if (!currentUser) return;
        try {
            const newLead = await leadsService.createLead({ ...lead, userId: currentUser.id });
            if (newLead) setLeads(prev => [newLead, ...prev]);
        } catch (e: any) {
            alert("Failed to add lead: " + e.message);
        }
    };

    const updateLead = async (lead: Lead) => {
        try {
            const updatedLead = await leadsService.updateLead(lead);
            if (updatedLead) setLeads(prev => prev.map(l => l.id === lead.id ? updatedLead : l));
        } catch (e: any) {
            alert("Failed to update lead: " + e.message);
        }
    };

    const deleteLead = async (id: string) => {
        try {
            await leadsService.deleteLead(id);
            setLeads(prev => prev.filter(l => l.id !== id));
        } catch (e: any) {
            alert("Failed to delete lead: " + e.message);
        }
    };

    const [deals, setDeals] = useState<Deal[]>([]);

    useEffect(() => {
        const fetchDeals = async () => {
            try {
                const dbDeals = await dealService.getDeals();
                setDeals(dbDeals || []);
            } catch (error) {
                console.error("Failed to load deals", error);
                setDeals([]);
            }
        };
        if (currentUser) {
            fetchDeals();
        }
    }, [currentUser]);

    const addDeal = async (deal: Omit<Deal, 'id'>) => {
        try {
            // Pass the current user's ID to the deal service
            const dealWithUser = { ...deal, userId: currentUser?.id };
            const newDeal = await dealService.createDeal(dealWithUser);
            if (newDeal) setDeals(prev => [newDeal, ...prev]);
        } catch (e: any) {
            alert("Failed to add deal: " + e.message);
        }
    };

    const updateDeal = async (deal: Deal) => {
        try {
            const updatedDeal = await dealService.updateDeal(deal.id, deal);
            if (updatedDeal) setDeals(prev => prev.map(d => d.id === deal.id ? updatedDeal : d));
        } catch (e: any) {
            alert("Failed to update deal: " + e.message);
        }
    };

    const deleteDeal = async (id: string) => {
        try {
            const success = await dealService.deleteDeal(id);
            if (success) setDeals(prev => prev.filter(d => d.id !== id));
        } catch (e: any) {
            alert("Failed to delete deal: " + e.message);
        }
    };

    return (
        <DataContext.Provider value={{
            roles, permissionsList, departments, users, customers, projectCompanies,
            documentHistory, addHistoryItem, updateHistoryItem, deleteHistoryItem,
            knowledgeBase, addToKnowledgeBase,
            addUser, updateUser, deleteUser,
            addDepartment, updateDepartment, deleteDepartment,
            addRole, updateRoleDetails, updateRolePermissions, deleteRole,
            addCustomer, updateCustomer, deleteCustomer,
            leads, addLead, updateLead, deleteLead,
            deals, addDeal, updateDeal, deleteDeal,
            salesSettings, updateSalesSettings,
            hasPermission
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) throw new Error("useData must be used within a DataProvider");
    return context;
};
