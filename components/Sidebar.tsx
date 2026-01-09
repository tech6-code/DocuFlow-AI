
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    ChartBarIcon,
    BuildingOfficeIcon,
    ShieldCheckIcon,
    UsersIcon,
    BanknotesIcon,
    DocumentTextIcon,
    IdentificationIcon,
    PaperAirplaneIcon,
    BriefcaseIcon,
    LightBulbIcon,
    FolderIcon,
    UserGroupIcon,
    ScaleIcon,
    ChartPieIcon,
    ClipboardCheckIcon,
    MagnifyingGlassIcon,
    Cog6ToothIcon,
    ListBulletIcon,
    PuzzlePieceIcon
} from './icons';
import type { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

interface SidebarNavLinkProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isCollapsed?: boolean;
}

const SidebarNavLink: React.FC<SidebarNavLinkProps> = ({ to, icon, label, isCollapsed = false }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) => `flex w-full items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-left group ${isActive
                ? 'bg-gray-800 text-white shadow-md border border-gray-700'
                : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
            title={isCollapsed ? label : undefined}
        >
            {({ isActive }) => (
                <>
                    <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
                        {icon}
                    </span>
                    {!isCollapsed && <span className="truncate">{label}</span>}
                </>
            )}
        </NavLink>
    )
};


interface SidebarProps {
    isCollapsed: boolean;
    roles: Role[];
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, roles }) => {
    const { currentUser } = useAuth();
    const { hasPermission } = useData();

    const getRoleName = () => {
        if (!currentUser) return '';
        const role = roles.find(r => r.id === currentUser.roleId);
        return role ? role.name.toUpperCase().replace(/\s+/g, '_') : '';
    };

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col h-full transition-all duration-300 ease-in-out`}>
            <div className="h-16 flex items-center justify-center px-4 border-b border-gray-800 flex-shrink-0 overflow-hidden whitespace-nowrap">
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                        {isCollapsed ? 'DF' : 'DocuFlow'}
                    </h2>
                    {!isCollapsed && <p className="text-xs text-gray-400 -mt-1 transition-opacity duration-300">Document Processing Suite</p>}
                </div>
            </div>

            {!isCollapsed && (
                <div className="px-4 py-4 flex-shrink-0 transition-opacity duration-300">
                    <div className="bg-gray-800 border border-gray-700 rounded-md text-center py-1 min-h-[1.5rem]">
                        <p className="text-xs font-bold text-gray-300 tracking-wider">{getRoleName()}</p>
                    </div>
                </div>
            )}

            <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar pb-4 mt-4">
                <div>
                    {!isCollapsed ? (
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300">Administration</h3>
                    ) : (
                        <div className="h-px bg-gray-800 my-3 mx-2" />
                    )}
                    <div className="space-y-1">
                        {hasPermission('dashboard:view') && <SidebarNavLink
                            icon={<ChartBarIcon className="w-5 h-5" />}
                            label="Dashboard"
                            to="/dashboard"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('departments:view') && <SidebarNavLink
                            icon={<BuildingOfficeIcon className="w-5 h-5" />}
                            label="Departments"
                            to="/departments"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('role-management:view') && <SidebarNavLink
                            icon={<ShieldCheckIcon className="w-5 h-5" />}
                            label="Roles & Permissions"
                            to="/roles-permissions"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('user-management:view') && <SidebarNavLink
                            icon={<UsersIcon className="w-5 h-5" />}
                            label="User Management"
                            to="/users"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('customer-management:view') && <SidebarNavLink
                            icon={<UserGroupIcon className="w-5 h-5" />}
                            label="Customers"
                            to="/customers"
                            isCollapsed={isCollapsed}
                        />}
                    </div>
                </div>
                <div>
                    {!isCollapsed ? (
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300">Sales</h3>
                    ) : (
                        <div className="h-px bg-gray-800 my-3 mx-2" />
                    )}
                    <div className="space-y-1">
                        {hasPermission('sales:view') && <SidebarNavLink
                            icon={<UsersIcon className="w-5 h-5" />}
                            label="Leads"
                            to="/sales/leads"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('sales:view') && <SidebarNavLink
                            icon={<BriefcaseIcon className="w-5 h-5" />}
                            label="Deals"
                            to="/sales/deals"
                            isCollapsed={isCollapsed}
                        />}
                    </div>
                </div>
                <div>
                    {!isCollapsed ? (
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300">Projects</h3>
                    ) : (
                        <div className="h-px bg-gray-800 my-3 mx-2" />
                    )}
                    <div className="space-y-1">
                        {hasPermission('projects:view') && <SidebarNavLink
                            icon={<ScaleIcon className="w-5 h-5" />}
                            label="Bookkeeping"
                            to="/projects/bookkeeping"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('projects:view') && <SidebarNavLink
                            icon={<ChartPieIcon className="w-5 h-5" />}
                            label="VAT Filing"
                            to="/projects/vat-filing"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('projects:view') && <SidebarNavLink
                            icon={<BriefcaseIcon className="w-5 h-5" />}
                            label="CT Filing"
                            to="/projects/ct-filing"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('projects:view') && <SidebarNavLink
                            icon={<ClipboardCheckIcon className="w-5 h-5" />}
                            label="Registration"
                            to="/projects/registration"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('projects:view') && <SidebarNavLink
                            icon={<MagnifyingGlassIcon className="w-5 h-5" />}
                            label="Audit Report"
                            to="/projects/audit-report"
                            isCollapsed={isCollapsed}
                        />}
                    </div>
                </div>
                <div>
                    {!isCollapsed ? (
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300">Converts</h3>
                    ) : (
                        <div className="h-px bg-gray-800 my-3 mx-2" />
                    )}
                    <div className="space-y-1">
                        {hasPermission('bank-statements:view') && <SidebarNavLink
                            icon={<BanknotesIcon className="w-5 h-5" />}
                            label="Bank Statements"
                            to="/bank-statements"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('invoices-&-bills:view') && <SidebarNavLink
                            icon={<DocumentTextIcon className="w-5 h-5" />}
                            label="Invoices & Bills"
                            to="/invoices"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('emirates-id:view') && <SidebarNavLink
                            icon={<IdentificationIcon className="w-5 h-5" />}
                            label="Emirates ID"
                            to="/emirates-id"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('passport:view') && <SidebarNavLink
                            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m-3-3.75l-3 1.5m3-1.5l3 1.5m-3-1.5V15m3 2.25v-6.75a3.375 3.375 0 0 0-3.375-3.375H8.25a3.375 3.375 0 0 0-3.375 3.375v6.75a3.375 3.375 0 0 0 3.375 3.375h9a3.375 3.375 0 0 0 3.375-3.375V9.75" /></svg>}
                            label="Passport"
                            to="/passport"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('visa:view') && <SidebarNavLink
                            icon={<PaperAirplaneIcon className="w-5 h-5" />}
                            label="Visa"
                            to="/visa"
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('trade-license:view') && <SidebarNavLink
                            icon={<BriefcaseIcon className="w-5 h-5" />}
                            label="Trade License"
                            to="/trade-license"
                            isCollapsed={isCollapsed}
                        />}
                    </div>
                </div>
                <div>
                    {!isCollapsed ? (
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300">Analysis</h3>
                    ) : (
                        <div className="h-px bg-gray-800 my-3 mx-2" />
                    )}
                    <div className="space-y-1">
                        {hasPermission('bank-statement-analysis:view') && <SidebarNavLink
                            icon={<LightBulbIcon className="w-5 h-5" />}
                            label="Statement Analysis"
                            to="/analysis"
                            isCollapsed={isCollapsed}
                        />}
                    </div>
                </div>
                <div>
                    {!isCollapsed ? (
                        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 transition-opacity duration-300">System</h3>
                    ) : (
                        <div className="h-px bg-gray-800 my-3 mx-2" />
                    )}
                    <div className="space-y-1">
                        <SidebarNavLink
                            icon={<PuzzlePieceIcon className="w-5 h-5" />}
                            label="Integrations"
                            to="/integrations"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarNavLink
                            icon={<ListBulletIcon className="w-5 h-5" />}
                            label="Audit Logs"
                            to="/audit-logs"
                            isCollapsed={isCollapsed}
                        />
                        <SidebarNavLink
                            icon={<Cog6ToothIcon className="w-5 h-5" />}
                            label="Settings"
                            to="/settings"
                            isCollapsed={isCollapsed}
                        />
                    </div>
                </div>
            </nav>

            {!isCollapsed && (
                <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0 bg-gray-900 transition-opacity duration-300">
                    <p className="text-xs text-gray-500">&copy; 2025 DocuFlow - Document Processing Suite</p>
                </div>
            )}
        </aside>
    );
}

