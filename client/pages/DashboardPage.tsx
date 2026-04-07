import React from 'react';
import { Dashboard } from '../components/Dashboard';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dashboardService, type DashboardFilterParams } from '../services/dashboardService';
import type { DashboardSummary, Page } from '../types';

const pageRouteMap: Partial<Record<Page, string>> = {
    dashboard: '/dashboard',
    customers: '/customers',
    userManagement: '/users',
    rolesAndPermissions: '/roles-permissions',
    departments: '/departments',
    bankStatements: '/bank-statements',
    invoicesAndBills: '/invoices',
    projectVatFiling: '/projects/vat-filing',
    projectCtFiling: '/projects/ct-filing',
    projectRegistration: '/projects/registration',
    projectAuditReport: '/projects/audit-report',
    projectFinancialOverview: '/projects/bookkeeping',
    auditLogs: '/audit-logs',
    integrations: '/integrations',
    settings: '/settings/general',
};

export const DashboardPage: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [summary, setSummary] = React.useState<DashboardSummary | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState('');
    const [filters, setFilters] = React.useState<DashboardFilterParams>({});

    const loadDashboard = React.useCallback(async (mode: 'initial' | 'refresh' | 'filter' = 'initial', overrideFilters?: DashboardFilterParams) => {
        if (mode === 'initial') setLoading(true);
        if (mode === 'refresh' || mode === 'filter') setRefreshing(true);
        setError('');
        try {
            const data = await dashboardService.getSummary(overrideFilters ?? filters);
            setSummary(data);
        } catch (err: any) {
            setError(err?.message || 'Failed to load dashboard');
        } finally {
            if (mode === 'initial') setLoading(false);
            if (mode === 'refresh' || mode === 'filter') setRefreshing(false);
        }
    }, [filters]);

    const handleFilterChange = React.useCallback((newFilters: DashboardFilterParams) => {
        setFilters(newFilters);
        void loadDashboard('filter', newFilters);
    }, [loadDashboard]);

    React.useEffect(() => {
        let active = true;
        if (currentUser) {
            (async () => {
                if (!active) return;
                await loadDashboard('initial');
            })();
        } else {
            setSummary(null);
            setLoading(false);
        }

        return () => {
            active = false;
        };
    }, [currentUser, loadDashboard]);

    return (
        <Dashboard
            currentUser={currentUser}
            summary={summary}
            loading={loading}
            refreshing={refreshing}
            error={error}
            filters={filters}
            onFilterChange={handleFilterChange}
            onRefresh={() => loadDashboard('refresh')}
            setActivePage={(page) => navigate(pageRouteMap[page] || '/dashboard')}
        />
    );
};
