import React from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { DashboardStatusItem, DashboardSummary, Page, User } from '../types';
import type { DashboardFilterParams } from '../services/dashboardService';
import {
    ArrowPathIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    BanknotesIcon,
    BuildingOfficeIcon,
    ChartPieIcon,
    ClockIcon,
    ChevronDownIcon,
    FunnelIcon,
    PlusIcon,
    UserCircleIcon,
    UserGroupIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    XMarkIcon,
} from './icons';
import { useData } from '../contexts/DataContext';

interface DashboardProps {
    setActivePage: (page: Page) => void;
    currentUser: User | null;
    summary: DashboardSummary | null;
    loading: boolean;
    refreshing: boolean;
    error: string;
    filters: DashboardFilterParams;
    onFilterChange: (filters: DashboardFilterParams) => void;
    onRefresh: () => Promise<void>;
}

const scopeLabelMap = {
    super_admin: 'Organization View',
    department_admin: 'Department View',
    user: 'My Workspace',
} as const;

const statusColorMap: Record<string, string> = {
    'Not Started': '#94a3b8',
    'In Progress': '#60a5fa',
    Draft: '#a78bfa',
    Submitted: '#34d399',
    'Completed & Filed': '#10b981',
    Overdue: '#f87171',
    Unknown: '#64748b',
};

const chartGridColor = 'rgba(255,255,255,0.06)';
const axisColor = '#6b7280';

const MONTHS = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

/* ── Reusable sub-components ─────────────────────────────────────── */

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border/60 bg-[#0f1117] px-3.5 py-2.5 shadow-2xl backdrop-blur-sm">
            {label ? <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p> : null}
            <div className="space-y-1.5">
                {payload.map((entry: any) => (
                    <div key={entry.name} className="flex items-center justify-between gap-5 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-semibold tabular-nums text-foreground">{entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ChartCard = ({ title, subtitle, children, className }: { title: string; subtitle: string; children: React.ReactNode; className?: string }) => (
    <div className={`group rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 shadow-sm transition-all hover:border-border hover:shadow-md ${className || ''}`}>
        <div className="mb-4">
            <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {children}
    </div>
);

const ChangeIndicator = ({ value }: { value: number | null | undefined }) => {
    if (value === null || value === undefined) return null;
    const isPositive = value > 0;
    const isZero = value === 0;
    if (isZero) return <span className="text-xs text-muted-foreground">0%</span>;
    return (
        <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
            {isPositive ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
            {isPositive ? '+' : ''}{value}%
        </span>
    );
};

const KpiCard = ({ label, value, icon, tone, note, change }: {
    label: string;
    value: number;
    icon: React.ReactNode;
    tone: string;
    note?: string;
    change?: number | null;
}) => (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm px-5 py-4 shadow-sm transition-all hover:border-border hover:shadow-md">
        <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-[0.04]" style={{ backgroundColor: tone }} />
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    {change !== undefined && <ChangeIndicator value={change} />}
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground">{value.toLocaleString()}</p>
                {note ? <p className="mt-1.5 text-xs text-muted-foreground">{note}</p> : null}
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/40 p-2.5 shrink-0" style={{ color: tone }}>
                {icon}
            </div>
        </div>
    </div>
);

const StatusLegend = ({ items }: { items: DashboardStatusItem[] }) => (
    <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
            <div key={item.label} className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: statusColorMap[item.label] || '#94a3b8' }} />
                        <span className="truncate text-xs text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{item.count}</span>
                </div>
            </div>
        ))}
    </div>
);

/* ── Filter Pill ─────────────────────────────────────────────────── */

const FilterPill = ({ label, value, onChange, children }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    children: React.ReactNode;
}) => {
    const isActive = !!value;
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`h-8 cursor-pointer appearance-none rounded-full pl-3 pr-7 text-xs font-medium outline-none transition-all
                    ${isActive
                        ? 'border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15'
                        : 'border border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
            >
                {children}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        </div>
    );
};

/* ── Unified Header with Filters ─────────────────────────────────── */

const DashboardHeader = ({ greeting, firstName, summary, filters, onFilterChange, onRefresh, refreshing }: {
    greeting: string;
    firstName: string;
    summary: DashboardSummary | null;
    filters: DashboardFilterParams;
    onFilterChange: (f: DashboardFilterParams) => void;
    onRefresh: () => Promise<void>;
    refreshing: boolean;
}) => {
    const hasActiveFilters = !!(filters.month || filters.year || (filters.filingType && filters.filingType !== 'all') || filters.departmentId || filters.userId);

    const activeFilterCount = [
        filters.month,
        filters.year,
        filters.filingType && filters.filingType !== 'all' ? filters.filingType : null,
        filters.departmentId,
        filters.userId,
    ].filter(Boolean).length;

    const todayFormatted = new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <div className="rounded-2xl border border-border/60 bg-card shadow-sm">
            {/* Main header row */}
            <div className="flex flex-col gap-4 px-5 pt-5 pb-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
                        {summary ? (
                            <span className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
                                {scopeLabelMap[summary.scope]}
                            </span>
                        ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {greeting}, {firstName}
                        <span className="mx-2 text-border/60">·</span>
                        {todayFormatted}
                        {summary && summary.scope !== 'super_admin' && summary.departmentName ? (
                            <>
                                <span className="mx-2 text-border/60">·</span>
                                {summary.departmentName}
                            </>
                        ) : null}
                    </p>
                </div>

                <button
                    onClick={() => void onRefresh()}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2 self-start rounded-lg border border-border/50 bg-muted/30 px-3.5 py-2 text-xs font-medium text-foreground transition-all hover:bg-muted/60 hover:shadow-sm disabled:opacity-50"
                >
                    <ArrowPathIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            {/* Divider */}
            <div className="mx-5 border-t border-border/30" />

            {/* Filter row */}
            <div className="flex flex-wrap items-center gap-2 px-5 py-3">
                <div className="flex items-center gap-1.5 mr-1">
                    <FunnelIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Filters</span>
                </div>

                <FilterPill label="Month" value={filters.month ? String(filters.month) : ''} onChange={(v) => onFilterChange({ ...filters, month: v ? parseInt(v) : null })}>
                    <option value="">All Months</option>
                    {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </FilterPill>

                <FilterPill label="Year" value={filters.year ? String(filters.year) : ''} onChange={(v) => onFilterChange({ ...filters, year: v ? parseInt(v) : null })}>
                    <option value="">All Years</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </FilterPill>

                <FilterPill label="Type" value={filters.filingType === 'all' ? '' : (filters.filingType || '')} onChange={(v) => onFilterChange({ ...filters, filingType: (v || 'all') as any })}>
                    <option value="">All Types</option>
                    <option value="vat">VAT</option>
                    <option value="ct">CT</option>
                </FilterPill>

                {summary && summary.scope === 'super_admin' && summary.filterOptions.departments.length > 0 && (
                    <FilterPill label="Department" value={filters.departmentId || ''} onChange={(v) => onFilterChange({ ...filters, departmentId: v || null, userId: null })}>
                        <option value="">All Depts</option>
                        {summary.filterOptions.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </FilterPill>
                )}

                {summary && (summary.scope === 'super_admin' || summary.scope === 'department_admin') && summary.filterOptions.users.length > 0 && (
                    <FilterPill label="User" value={filters.userId || ''} onChange={(v) => onFilterChange({ ...filters, userId: v || null })}>
                        <option value="">All Users</option>
                        {summary.filterOptions.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </FilterPill>
                )}

                {hasActiveFilters && (
                    <button
                        onClick={() => onFilterChange({})}
                        className="ml-1 inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
                    >
                        <XMarkIcon className="h-3 w-3" />
                        Clear {activeFilterCount > 1 ? `(${activeFilterCount})` : ''}
                    </button>
                )}
            </div>
        </div>
    );
};

/* ── Main Dashboard ──────────────────────────────────────────────── */

export const Dashboard: React.FC<DashboardProps> = ({ setActivePage, currentUser, summary, loading, refreshing, error, filters, onFilterChange, onRefresh }) => {
    const { hasPermission } = useData();

    const quickActions = [
        { label: 'New VAT Filing', page: 'projectVatFiling' as Page, permission: 'projects-vat-filing:view' },
        { label: 'New CT Filing', page: 'projectCtFiling' as Page, permission: 'projects-ct-filing:view' },
        { label: 'Customers', page: 'customers' as Page, permission: 'customer-management:view' },
        { label: 'Users', page: 'userManagement' as Page, permission: 'user-management:view' },
    ].filter((action) => hasPermission(action.permission));

    const isUser = summary?.scope === 'user';
    const isSuperAdmin = summary?.scope === 'super_admin';
    const isDeptAdmin = summary?.scope === 'department_admin';

    const workloadData = (isSuperAdmin ? summary?.workloadByDepartment : summary?.workloadByUser || [])
        ?.slice(0, 8)
        .map((item) => ({
            name: item.name.length > 14 ? `${item.name.slice(0, 14)}...` : item.name,
            Pending: item.pending,
            Submitted: item.submitted,
            Overdue: item.overdue,
        })) || [];

    const greeting = React.useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    const firstName = currentUser?.name?.split(' ')[0] || 'User';

    return (
        <div className="space-y-5 text-foreground">
            {/* ── Header + Filters (Unified) ────────────────────── */}
            <DashboardHeader
                greeting={greeting}
                firstName={firstName}
                summary={summary}
                filters={filters}
                onFilterChange={onFilterChange}
                onRefresh={onRefresh}
                refreshing={refreshing}
            />

            {/* ── Error ──────────────────────────────────────────── */}
            {error ? (
                <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0 text-red-400" />
                    {error}
                </div>
            ) : null}

            {/* ── Loading ────────────────────────────────────────── */}
            {loading && !summary ? (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-12 text-center">
                    <ArrowPathIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                    <p className="mt-3 text-sm text-muted-foreground">Loading dashboard...</p>
                </div>
            ) : null}

            {!loading && !summary && !error ? (
                <div className="rounded-2xl border border-border/60 bg-card/80 p-12 text-center text-sm text-muted-foreground">
                    No dashboard data available.
                </div>
            ) : null}

            {summary ? (
                <>
                    {/* ── KPI Cards ──────────────────────────────── */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {/* Show customers/users/departments only for admin roles */}
                        {!isUser && (
                            <KpiCard label="Customers" value={summary.cards.customers} icon={<UserGroupIcon className="h-5 w-5" />} tone="#93c5fd" />
                        )}
                        {isSuperAdmin && (
                            <KpiCard label="Users" value={summary.cards.users} icon={<UserCircleIcon className="h-5 w-5" />} tone="#c4b5fd" />
                        )}
                        {isSuperAdmin && (
                            <KpiCard label="Departments" value={summary.cards.departments} icon={<BuildingOfficeIcon className="h-5 w-5" />} tone="#f9a8d4" />
                        )}
                        <KpiCard
                            label="VAT Filings"
                            value={summary.cards.vatFilings}
                            icon={<ChartPieIcon className="h-5 w-5" />}
                            tone="#60a5fa"
                            change={summary.comparison.vatFilings}
                        />
                        <KpiCard
                            label="CT Filings"
                            value={summary.cards.ctFilings}
                            icon={<BanknotesIcon className="h-5 w-5" />}
                            tone="#34d399"
                            change={summary.comparison.ctFilings}
                        />
                        <KpiCard
                            label="Pending"
                            value={summary.cards.pending}
                            icon={<ClockIcon className="h-5 w-5" />}
                            tone="#fbbf24"
                            note={`${summary.cards.dueThisWeek} due this week`}
                            change={summary.comparison.pending}
                        />
                        <KpiCard
                            label="Submitted"
                            value={summary.cards.submitted}
                            icon={<CheckCircleIcon className="h-5 w-5" />}
                            tone="#34d399"
                            change={summary.comparison.submitted}
                        />
                        <KpiCard
                            label="Overdue"
                            value={summary.cards.overdue}
                            icon={<ExclamationTriangleIcon className="h-5 w-5" />}
                            tone="#f87171"
                            change={summary.comparison.overdue}
                        />
                    </div>

                    {/* ── Row: Summary Ticker ────────────────────── */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Active Filing Customers</p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{summary.cards.activeFilingCustomers}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Due This Month</p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{summary.cards.dueThisMonth}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Completion Rate</p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{summary.completionRate.percentage}%</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/80 px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Total Filings</p>
                            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{summary.completionRate.total}</p>
                        </div>
                    </div>

                    {/* ── Row: Filing Trend + Overall Status ─────── */}
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
                        <ChartCard title="Filing Trend" subtitle="VAT and CT filing volume across the last six months.">
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={summary.filingTrend}>
                                        <defs>
                                            <linearGradient id="vatGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="ctGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke={chartGridColor} vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={35} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11, paddingTop: 8 }} />
                                        <Area type="monotone" dataKey="vat" name="VAT" stroke="#60a5fa" fill="url(#vatGrad)" strokeWidth={2} />
                                        <Area type="monotone" dataKey="ct" name="CT" stroke="#34d399" fill="url(#ctGrad)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Overall Filing Status" subtitle="Status distribution across all visible filings.">
                            <div className="flex h-[280px] flex-col justify-between gap-3">
                                <div className="h-[180px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={summary.overallStatus}
                                                dataKey="count"
                                                nameKey="label"
                                                innerRadius={55}
                                                outerRadius={80}
                                                paddingAngle={3}
                                                strokeWidth={0}
                                            >
                                                {summary.overallStatus.map((item) => (
                                                    <Cell key={item.label} fill={statusColorMap[item.label] || '#94a3b8'} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Completion Rate</p>
                                            <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{summary.completionRate.percentage}%</p>
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground">
                                            <p>{summary.completionRate.submitted} submitted</p>
                                            <p>{summary.completionRate.total} total</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ChartCard>
                    </div>

                    {/* ── Row: VAT Status + CT Status + Quick Actions */}
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                        <ChartCard title="VAT Filing Status" subtitle="Status breakdown for VAT filings.">
                            <div className="mb-3 h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={summary.vatStatus}
                                            dataKey="count"
                                            nameKey="label"
                                            innerRadius={45}
                                            outerRadius={75}
                                            paddingAngle={3}
                                            strokeWidth={0}
                                        >
                                            {summary.vatStatus.map((item) => (
                                                <Cell key={item.label} fill={statusColorMap[item.label] || '#94a3b8'} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <StatusLegend items={summary.vatStatus} />
                        </ChartCard>

                        <ChartCard title="CT Filing Status" subtitle="Status breakdown for CT filings.">
                            <div className="mb-3 h-[200px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={summary.ctStatus}
                                            dataKey="count"
                                            nameKey="label"
                                            innerRadius={45}
                                            outerRadius={75}
                                            paddingAngle={3}
                                            strokeWidth={0}
                                        >
                                            {summary.ctStatus.map((item) => (
                                                <Cell key={item.label} fill={statusColorMap[item.label] || '#94a3b8'} />
                                            ))}
                                        </Pie>
                                        <Tooltip content={<CustomTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <StatusLegend items={summary.ctStatus} />
                        </ChartCard>

                        <ChartCard title="Quick Actions" subtitle="Shortcut access to filing operations.">
                            <div className="grid grid-cols-2 gap-2.5">
                                {quickActions.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => setActivePage(action.page)}
                                        className="rounded-xl border border-border/40 bg-muted/20 p-3.5 text-left transition-all hover:bg-accent hover:border-border hover:shadow-sm"
                                    >
                                        <PlusIcon className="mb-5 h-4 w-4 text-primary" />
                                        <div className="text-xs font-semibold text-foreground">{action.label}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-3.5 space-y-2">
                                <div className="rounded-xl border border-border/40 bg-muted/10 px-3.5 py-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Active Filing Customers</span>
                                        <span className="text-sm font-semibold tabular-nums text-foreground">{summary.cards.activeFilingCustomers}</span>
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border/40 bg-muted/10 px-3.5 py-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">Due This Month</span>
                                        <span className="text-sm font-semibold tabular-nums text-foreground">{summary.cards.dueThisMonth}</span>
                                    </div>
                                </div>
                                {!isUser && (
                                    <div className="rounded-xl border border-border/40 bg-muted/10 px-3.5 py-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-muted-foreground">Departments</span>
                                            <span className="text-sm font-semibold tabular-nums text-foreground">{summary.cards.departments}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ChartCard>
                    </div>

                    {/* ── Row: Workload + Upcoming Due Dates ─────── */}
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_0.7fr]">
                        <ChartCard
                            title={isSuperAdmin ? 'Department Workload' : isDeptAdmin ? 'Team Workload' : 'My Workload'}
                            subtitle={isSuperAdmin ? 'Stacked workload across departments.' : isDeptAdmin ? 'Workload distribution across team members.' : 'Your filing workload summary.'}
                        >
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={workloadData} barGap={2}>
                                        <CartesianGrid stroke={chartGridColor} vertical={false} />
                                        <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={35} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 11, paddingTop: 8 }} />
                                        <Bar dataKey="Submitted" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="Pending" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} />
                                        <Bar dataKey="Overdue" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Upcoming Due Dates" subtitle="Nearest deadlines in your scope.">
                            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {summary.dueDates.length === 0 && (
                                    <p className="py-8 text-center text-xs text-muted-foreground">No upcoming due dates.</p>
                                )}
                                {summary.dueDates.map((item) => (
                                    <div key={`${item.customerId}-${item.filingType}-${item.periodLabel}`} className="rounded-xl border border-border/40 bg-muted/10 px-3.5 py-2.5 transition-colors hover:bg-muted/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-sm font-medium text-foreground">{item.customerName}</p>
                                                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${item.filingType === 'VAT' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                        {item.filingType}
                                                    </span>
                                                </div>
                                                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{item.periodLabel} | {item.assignedUserName}</p>
                                            </div>
                                            <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">{formatDate(item.dueDate)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartCard>
                    </div>

                    {/* ── Row: Customer Attention + Recent Activity ── */}
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <ChartCard title="Customer Attention" subtitle="Customers with open or overdue filings.">
                            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {summary.customerAttention.length === 0 && (
                                    <p className="py-8 text-center text-xs text-muted-foreground">No customers need attention.</p>
                                )}
                                {summary.customerAttention.map((item) => (
                                    <div key={item.customerId} className="rounded-xl border border-border/40 bg-muted/10 px-3.5 py-2.5 transition-colors hover:bg-muted/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-medium text-foreground">{item.customerName}</p>
                                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                                    VAT {item.openVatFilings} | CT {item.openCtFilings} | Next {formatDate(item.nextDueDate)}
                                                </p>
                                            </div>
                                            {item.overdueFilings > 0 && (
                                                <span className="shrink-0 rounded-full border border-red-500/15 bg-red-500/8 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-400">
                                                    {item.overdueFilings} overdue
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartCard>

                        <ChartCard title="Recent Filing Activity" subtitle="Latest workflow updates and filing actions.">
                            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {summary.recentActivity.length === 0 && (
                                    <p className="py-8 text-center text-xs text-muted-foreground">No recent activity.</p>
                                )}
                                {summary.recentActivity.map((item) => (
                                    <div key={item.id} className="rounded-xl border border-border/40 bg-muted/10 px-3.5 py-2.5 transition-colors hover:bg-muted/20">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2 w-2 shrink-0 rounded-full"
                                                        style={{ backgroundColor: item.filingType === 'VAT' ? '#60a5fa' : '#34d399' }}
                                                    />
                                                    <p className="truncate text-sm font-medium text-foreground">{item.customerName}</p>
                                                </div>
                                                <p className="mt-0.5 truncate pl-4 text-[11px] text-muted-foreground">{item.title} | {item.userName}</p>
                                            </div>
                                            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{formatDate(item.createdAt)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartCard>
                    </div>
                </>
            ) : null}
        </div>
    );
};
