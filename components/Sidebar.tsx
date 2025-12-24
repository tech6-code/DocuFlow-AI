
import React from 'react';
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
import type { Role, Page } from '../types';
import { usePermissions } from '../App';

interface SidebarNavLinkProps {
  page: Page;
  activePage: Page;
  icon: React.ReactNode;
  label: string;
  isCollapsed?: boolean;
  onClick: (page: Page) => void;
}

const SidebarNavLink: React.FC<SidebarNavLinkProps> = ({ page, activePage, icon, label, isCollapsed = false, onClick }) => {
    const isActive = activePage === page;
    return (
    <button
      onClick={() => onClick(page)}
      className={`flex w-full items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2.5 rounded-lg transition-all duration-200 text-sm font-medium text-left group ${
        isActive
          ? 'bg-gray-800 text-white shadow-md border border-gray-700'
          : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
      }`}
      title={isCollapsed ? label : undefined}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-blue-400' : 'text-gray-500 group-hover:text-gray-300'}`}>
        {icon}
      </span>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </button>
)};
  

interface SidebarProps {
    onProjectClick: (page: Page) => void; // Legacy prop, kept for interface compatibility if needed, but we use onNavigate mostly
    isCollapsed: boolean;
    roles: Role[];
    activePage: Page; // New prop
    onNavigate: (page: Page) => void; // New prop
}

export const Sidebar: React.FC<SidebarProps> = ({ onProjectClick, isCollapsed, roles, activePage, onNavigate }) => {
    const { hasPermission, currentUser } = usePermissions();

    const getRoleName = () => {
        if (!currentUser) return '';
        const role = roles.find(r => r.id === currentUser.roleId);
        return role ? role.name.toUpperCase().replace(/\s+/g, '_') : '';
    };

    // Wrapper to handle special project logic (resetting state) via onProjectClick if necessary
    // But since App handles state reset on page change, simple navigation is fine.
    const handleNav = (page: Page) => {
        if (page.startsWith('project') || page === 'bankStatements' || page === 'invoicesAndBills') {
             onProjectClick(page); // This triggers resetState in parent
        } else {
             onNavigate(page);
        }
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
                            page="dashboard"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                         {hasPermission('departments:view') && <SidebarNavLink 
                            icon={<BuildingOfficeIcon className="w-5 h-5" />} 
                            label="Departments" 
                            page="departments"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                         {hasPermission('role-management:view') && <SidebarNavLink 
                            icon={<ShieldCheckIcon className="w-5 h-5" />} 
                            label="Roles & Permissions" 
                            page="rolesAndPermissions"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('user-management:view') && <SidebarNavLink 
                            icon={<UsersIcon className="w-5 h-5" />} 
                            label="User Management"
                            page="userManagement"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('customer-management:view') && <SidebarNavLink 
                            icon={<UserGroupIcon className="w-5 h-5" />} 
                            label="Customers"
                            page="customers"
                            activePage={activePage}
                            onClick={handleNav}
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
                            page="projectFinancialOverview"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('projects:view') && <SidebarNavLink 
                            icon={<ChartPieIcon className="w-5 h-5" />} 
                            label="VAT Filing" 
                            page="projectVatFiling"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                         {hasPermission('projects:view') && <SidebarNavLink 
                            icon={<BriefcaseIcon className="w-5 h-5" />} 
                            label="CT Filing" 
                            page="projectCtFiling"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                         {hasPermission('projects:view') && <SidebarNavLink 
                            icon={<ClipboardCheckIcon className="w-5 h-5" />} 
                            label="Registration" 
                            page="projectRegistration"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                         {hasPermission('projects:view') && <SidebarNavLink 
                            icon={<MagnifyingGlassIcon className="w-5 h-5" />} 
                            label="Audit Report" 
                            page="projectAuditReport"
                            activePage={activePage}
                            onClick={handleNav}
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
                            page="bankStatements"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('invoices-&-bills:view') && <SidebarNavLink 
                            icon={<DocumentTextIcon className="w-5 h-5" />} 
                            label="Invoices & Bills" 
                            page="invoicesAndBills"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('emirates-id:view') && <SidebarNavLink 
                            icon={<IdentificationIcon className="w-5 h-5" />} 
                            label="Emirates ID"
                            page="emiratesId"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('passport:view') && <SidebarNavLink
                            icon={<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h6m-3-3.75l-3 1.5m3-1.5l3 1.5m-3-1.5V15m3 2.25v-6.75a3.375 3.375 0 0 0-3.375-3.375H8.25a3.375 3.375 0 0 0-3.375 3.375v6.75a3.375 3.375 0 0 0 3.375 3.375h9a3.375 3.375 0 0 0 3.375-3.375V9.75" /></svg>}
                            label="Passport"
                            page="passport"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('visa:view') && <SidebarNavLink
                            icon={<PaperAirplaneIcon className="w-5 h-5" />}
                            label="Visa"
                            page="visa"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />}
                        {hasPermission('trade-license:view') && <SidebarNavLink
                            icon={<BriefcaseIcon className="w-5 h-5" />}
                            label="Trade License"
                            page="tradeLicense"
                            activePage={activePage}
                            onClick={handleNav}
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
                            page="bankStatementAnalysis"
                            activePage={activePage}
                            onClick={handleNav}
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
                            page="integrations"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />
                        <SidebarNavLink 
                            icon={<ListBulletIcon className="w-5 h-5" />} 
                            label="Audit Logs"
                            page="auditLogs"
                            activePage={activePage}
                            onClick={handleNav}
                            isCollapsed={isCollapsed}
                        />
                        <SidebarNavLink 
                            icon={<Cog6ToothIcon className="w-5 h-5" />} 
                            label="Settings"
                            page="settings"
                            activePage={activePage}
                            onClick={handleNav}
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
