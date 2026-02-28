
import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import {
    ChartBarIcon,
    BuildingOfficeIcon,
    ShieldCheckIcon,
    DocumentTextIcon,
    DocumentDuplicateIcon,
    IdentificationIcon,
    BriefcaseIcon,
    TagIcon,
    UserGroupIcon,
    ScaleIcon,
    ChartPieIcon,
    ClipboardCheckIcon,
    MagnifyingGlassIcon,
    Cog6ToothIcon,
    ListBulletIcon,
    PuzzlePieceIcon,
    UserCircleIcon,
    BankIcon,
    CreditCardIcon,
    CheckCircleIcon
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
                ? 'bg-accent text-accent-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                }`}
            title={isCollapsed ? label : undefined}
        >
            {({ isActive }) => (
                <>
                    <span className={`flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
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

    // Define sidebar structure
    const sidebarSections = useMemo(() => [
        {
            title: 'Administration',
            links: [
                { to: '/dashboard', icon: <ChartBarIcon className="w-5 h-5" />, label: 'Dashboard', permission: 'dashboard:view' },
                { to: '/departments', icon: <BuildingOfficeIcon className="w-5 h-5" />, label: 'Departments', permission: 'departments:view' },
                { to: '/roles-permissions', icon: <ShieldCheckIcon className="w-5 h-5" />, label: 'Roles & Permissions', permission: 'role-management:view' },
                { to: '/users', icon: <UserCircleIcon className="w-5 h-5" />, label: 'User Management', permission: 'user-management:view' },
                { to: '/customers', icon: <UserGroupIcon className="w-5 h-5" />, label: 'Customers', permission: 'customer-management:view' }
            ]
        },
        {
            title: 'Sales',
            links: [
                { to: '/sales/leads', icon: <TagIcon className="w-5 h-5" />, label: 'Leads', permission: 'sales-leads:view' },
                { to: '/sales/deals', icon: <BriefcaseIcon className="w-5 h-5" />, label: 'Deals', permission: 'sales-deals:view' },
                { to: '/sales/settings', icon: <Cog6ToothIcon className="w-5 h-5" />, label: 'Settings', permission: 'sales-settings:view' }
            ]
        },
        {
            title: 'Projects',
            links: [
                { to: '/projects/bookkeeping', icon: <ScaleIcon className="w-5 h-5" />, label: 'Bookkeeping', permission: 'projects-bookkeeping:view' },
                { to: '/projects/vat-filing', icon: <ChartPieIcon className="w-5 h-5" />, label: 'VAT Filing', permission: 'projects-vat-filing:view' },
                { to: '/projects/ct-filing', icon: <DocumentTextIcon className="w-5 h-5" />, label: 'CT Filing', permission: 'projects-ct-filing:view' },
                { to: '/projects/registration', icon: <ClipboardCheckIcon className="w-5 h-5" />, label: 'Registration', permission: 'projects-registration:view' },
                { to: '/projects/audit-report', icon: <MagnifyingGlassIcon className="w-5 h-5" />, label: 'Audit Report', permission: 'projects-audit-report:view' }
            ]
        },
        {
            title: 'Modules',
            links: [
                { to: '/bank-statements', icon: <BankIcon className="w-5 h-5" />, label: 'Bank Statements', permission: 'bank-statements:view' },
                { to: '/invoices', icon: <DocumentDuplicateIcon className="w-5 h-5" />, label: 'Invoices & Bills', permission: 'invoices-&-bills:view' },
                { to: '/emirates-id', icon: <IdentificationIcon className="w-5 h-5" />, label: 'Emirates ID', permission: 'emirates-id:view' },
                { to: '/passport', icon: <CreditCardIcon className="w-5 h-5" />, label: 'Passport', permission: 'passport:view' },
                { to: '/visa', icon: <CheckCircleIcon className="w-5 h-5" />, label: 'Visa', permission: 'visa:view' },
                { to: '/trade-license', icon: <BuildingOfficeIcon className="w-5 h-5" />, label: 'Trade License', permission: 'trade-license:view' }
            ]
        },
        {
            title: 'Analysis',
            links: [
                { to: '/analysis', icon: <MagnifyingGlassIcon className="w-5 h-5" />, label: 'Statement Analysis', permission: 'bank-statement-analysis:view' }
            ]
        },
        {
            title: 'System',
            links: [
                { to: '/integrations', icon: <PuzzlePieceIcon className="w-5 h-5" />, label: 'Integrations', permission: 'integrations:view' },
                { to: '/audit-logs', icon: <ListBulletIcon className="w-5 h-5" />, label: 'Audit Logs', permission: 'audit-logs:view' },
                { to: '/settings', icon: <Cog6ToothIcon className="w-5 h-5" />, label: 'Settings', permission: 'settings:view' }
            ]
        }
    ], []);

    // Filter sections to only show those with at least one visible link
    const visibleSections = useMemo(() => {
        console.log('[Sidebar] Computing visibleSections', {
            currentUser,
            rolesCount: roles.length,
            sectionsCount: sidebarSections.length
        });

        const filtered = sidebarSections
            .map(section => ({
                ...section,
                links: section.links.filter(link => {
                    const hasPerm = hasPermission(link.permission);
                    if (!hasPerm) {
                        console.log('[Sidebar] No permission for:', link.label, link.permission);
                    }
                    return hasPerm;
                })
            }))
            .filter(section => section.links.length > 0);

        console.log('[Sidebar] Visible sections:', filtered.length);
        return filtered;
    }, [sidebarSections, hasPermission, roles, currentUser]);

    return (
        <aside className={`${isCollapsed ? 'w-20' : 'w-64'} flex-shrink-0 bg-card border-r border-border flex flex-col h-full transition-all duration-300 ease-in-out`}>
            <div className="h-16 flex items-center justify-center px-4 border-b border-border flex-shrink-0 overflow-hidden whitespace-nowrap">
                <div className="text-center">
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">
                        {isCollapsed ? 'DF' : 'DocuFlow'}
                    </h2>
                    {!isCollapsed && <p className="text-xs text-muted-foreground -mt-1 transition-opacity duration-300">Document Processing Suite</p>}
                </div>
            </div>

            {!isCollapsed && (
                <div className="px-4 py-4 flex-shrink-0 transition-opacity duration-300">
                    <div className="bg-muted border border-border rounded-md text-center py-1 min-h-[1.5rem]">
                        <p className="text-xs font-bold text-muted-foreground tracking-wider">{getRoleName()}</p>
                    </div>
                </div>
            )}

            <nav className="flex-1 px-3 space-y-6 overflow-y-auto custom-scrollbar pb-4 mt-4">
                {visibleSections.map((section, idx) => (
                    <div key={idx}>
                        {!isCollapsed ? (
                            <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 transition-opacity duration-300">{section.title}</h3>
                        ) : (
                            <div className="h-px bg-border my-3 mx-2" />
                        )}
                        <div className="space-y-1">
                            {section.links.map((link, linkIdx) => (
                                <SidebarNavLink
                                    key={linkIdx}
                                    to={link.to}
                                    icon={link.icon}
                                    label={link.label}
                                    isCollapsed={isCollapsed}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {!isCollapsed && (
                <div className="px-6 py-4 border-t border-border flex-shrink-0 bg-card transition-opacity duration-300">
                    <p className="text-xs text-muted-foreground">&copy; 2025 DocuFlow - Document Processing Suite</p>
                </div>
            )}
        </aside>
    );
}

