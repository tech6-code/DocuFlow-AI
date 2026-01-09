import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MainHeader } from './Header';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

export const Layout: React.FC = () => {
    const { currentUser, logout } = useAuth();
    const { departments, roles } = useData();
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const location = useLocation();

    const getPageTitle = (pathname: string) => {
        if (pathname === '/' || pathname === '/dashboard') return 'Dashboard';
        if (pathname.startsWith('/roles')) return 'Roles & Permissions';
        if (pathname.startsWith('/users')) return 'User Management';
        if (pathname.startsWith('/departments')) return 'Departments';
        if (pathname.startsWith('/customers')) return 'Customers';
        if (pathname.startsWith('/bank-statements')) return 'Bank Statements';
        if (pathname.startsWith('/invoices')) return 'Invoices & Bills';
        if (pathname.startsWith('/emirates-id')) return 'Emirates ID';
        if (pathname.startsWith('/passport')) return 'Passport';
        if (pathname.startsWith('/visa')) return 'Visa';
        if (pathname.startsWith('/trade-license')) return 'Trade License';
        if (pathname.startsWith('/analysis')) return 'Statement Analysis';
        if (pathname.startsWith('/projects/bookkeeping')) return 'Bookkeeping';
        if (pathname.startsWith('/projects/vat-filing')) return 'VAT Filing';
        if (pathname.startsWith('/projects/ct-filing')) return 'Corporate Tax Filing';
        if (pathname.startsWith('/projects/registration')) return 'Registration';
        if (pathname.startsWith('/projects/audit-report')) return 'Audit Report';
        if (pathname.startsWith('/settings')) return 'Settings';
        if (pathname.startsWith('/audit-logs')) return 'Audit Logs';
        if (pathname.startsWith('/integrations')) return 'Integrations';
        if (pathname.startsWith('/sales/leads')) return 'Leads Management';
        if (pathname.startsWith('/sales/deals')) return 'Deals Management';
        return 'DocuFlow';
    };

    return (
        <div className="flex h-screen bg-black text-white font-sans">
            <Sidebar
                isCollapsed={isSidebarCollapsed}
                roles={roles}
            />
            <div className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
                <MainHeader
                    title={getPageTitle(location.pathname)}
                    subtitle="AI Document Processing"
                    currentUser={currentUser}
                    departments={departments}
                    onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    onLogout={logout}
                />
                <main className={`flex-1 overflow-y-auto custom-scrollbar ${location.pathname.includes('/projects/ct-filing') ? '' : 'p-8'}`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
