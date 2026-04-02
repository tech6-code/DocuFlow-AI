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
import {
    ArrowPathIcon,
    BanknotesIcon,
    BuildingOfficeIcon,
    CalendarDaysIcon,
    ChartBarIcon,
    ChartPieIcon,
    ClipboardCheckIcon,
    ClockIcon,
    DocumentDuplicateIcon,
    PlusIcon,
    UserCircleIcon,
    UserGroupIcon,
} from './icons';
import { useData } from '../contexts/DataContext';

interface DashboardProps {
    setActivePage: (page: Page) => void;
    currentUser: User | null;
    summary: DashboardSummary | null;
    loading: boolean;
    refreshing: boolean;
    error: string;
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
    Overdue: '#f87171',
    Unknown: '#64748b',
};

const chartGridColor = 'rgba(255,255,255,0.08)';
const axisColor = '#8b8fa3';

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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-border bg-[#121317] px-3 py-2 shadow-xl">
            {label ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p> : null}
            <div className="space-y-1.5">
                {payload.map((entry: any) => (
                    <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-muted-foreground">{entry.name}</span>
                        </div>
                        <span className="font-semibold text-foreground">{entry.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
    <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {children}
    </div>
);

const KpiCard = ({ label, value, icon, tone, note }: { label: string; value: number; icon: React.ReactNode; tone: string; note?: string }) => (
    <div className="rounded-[28px] border border-border bg-card px-6 py-5 shadow-sm min-h-[174px]">
        <div className="flex h-full items-start justify-between gap-5">
            <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
                <p className="mt-7 text-[3rem] leading-none font-bold tracking-tight text-foreground">{value}</p>
                {note ? <p className="mt-4 max-w-[9rem] text-sm leading-5 text-muted-foreground">{note}</p> : null}
            </div>
            <div className="rounded-[22px] border border-border bg-muted p-4 shrink-0" style={{ color: tone }}>
                {icon}
            </div>
        </div>
    </div>
);

const StatusLegend = ({ items }: { items: DashboardStatusItem[] }) => (
    <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-muted/30 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColorMap[item.label] || '#94a3b8' }} />
                        <span className="truncate text-sm text-muted-foreground">{item.label}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{item.count}</span>
                </div>
            </div>
        ))}
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ setActivePage, currentUser, summary, loading, refreshing, error, onRefresh }) => {
    const { hasPermission } = useData();

    const quickActions = [
        { label: 'New VAT Filing', page: 'projectVatFiling' as Page, permission: 'projects-vat-filing:view' },
        { label: 'New CT Filing', page: 'projectCtFiling' as Page, permission: 'projects-ct-filing:view' },
        { label: 'Customers', page: 'customers' as Page, permission: 'customer-management:view' },
        { label: 'Users', page: 'userManagement' as Page, permission: 'user-management:view' },
    ].filter((action) => hasPermission(action.permission));

    const workloadData = (summary?.scope === 'super_admin' ? summary.workloadByDepartment : summary?.workloadByUser || [])
        .slice(0, 7)
        .map((item) => ({
            name: item.name.length > 12 ? `${item.name.slice(0, 12)}...` : item.name,
            pending: item.pending,
            submitted: item.submitted,
            overdue: item.overdue,
        }));

    return (
        <div className="space-y-6 text-foreground">
            <div className="rounded-[32px] border border-border bg-gradient-to-br from-card via-card to-muted/10 p-6 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <div className="mb-3 flex items-center gap-3">
                            <h2 className="text-4xl font-semibold tracking-tight text-foreground">Dashboard</h2>
                            {summary ? (
                                <span className="rounded-full border border-border bg-muted px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                    {scopeLabelMap[summary.scope]}
                                </span>
                            ) : null}
                        </div>
                        <p className="text-lg text-muted-foreground">
                            {summary
                                ? `${summary.roleName}${summary.departmentName && summary.scope !== 'super_admin' ? ` | ${summary.departmentName}` : ''}`
                                : currentUser?.name || 'Dashboard'}
                        </p>
                    </div>

                    <button
                        onClick={() => void onRefresh()}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 self-start rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                        <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                </div>

                {summary ? (
                    <div
                        className="mt-7 grid gap-5"
                        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                    >
                        <KpiCard label="Customers" value={summary.cards.customers} icon={<UserGroupIcon className="h-6 w-6" />} tone="#93c5fd" />
                        <KpiCard label="Users" value={summary.cards.users} icon={<UserCircleIcon className="h-6 w-6" />} tone="#c4b5fd" />
                        <KpiCard label="Departments" value={summary.cards.departments} icon={<BuildingOfficeIcon className="h-6 w-6" />} tone="#f9a8d4" />
                        <KpiCard label="VAT Filings" value={summary.cards.vatFilings} icon={<ChartPieIcon className="h-6 w-6" />} tone="#60a5fa" />
                        <KpiCard label="CT Filings" value={summary.cards.ctFilings} icon={<BanknotesIcon className="h-6 w-6" />} tone="#34d399" />
                        <KpiCard label="Pending" value={summary.cards.pending} icon={<ClockIcon className="h-6 w-6" />} tone="#fbbf24" note={`${summary.cards.dueThisWeek} due this week`} />
                        <KpiCard label="Overdue" value={summary.cards.overdue} icon={<DocumentDuplicateIcon className="h-6 w-6" />} tone="#f87171" note={`${summary.cards.submitted} submitted`} />
                    </div>
                ) : null}
            </div>

            {error ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            {loading && !summary ? (
                <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    Loading dashboard summary...
                </div>
            ) : null}

            {!loading && !summary && !error ? (
                <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    No dashboard data available.
                </div>
            ) : null}

            {summary ? (
                <>
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_1fr]">
                        <ChartCard title="Filing Trend" subtitle="VAT and CT filing volume across the last six months.">
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={summary.filingTrend}>
                                        <defs>
                                            <linearGradient id="vatGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="ctGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                                                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid stroke={chartGridColor} vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ color: '#c7cad6', fontSize: 12 }} />
                                        <Area type="monotone" dataKey="vat" name="VAT" stroke="#60a5fa" fill="url(#vatGradient)" strokeWidth={2.5} />
                                        <Area type="monotone" dataKey="ct" name="CT" stroke="#34d399" fill="url(#ctGradient)" strokeWidth={2.5} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Overall Filing Status" subtitle="Interactive status distribution across all visible filings.">
                            <div className="flex h-[320px] flex-col justify-between gap-4">
                                <div className="h-[210px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={summary.overallStatus}
                                                dataKey="count"
                                                nameKey="label"
                                                innerRadius={65}
                                                outerRadius={92}
                                                paddingAngle={3}
                                            >
                                                {summary.overallStatus.map((item) => (
                                                    <Cell key={item.label} fill={statusColorMap[item.label] || '#94a3b8'} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
                                    <div className="flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Completion Rate</p>
                                            <p className="mt-2 text-3xl font-bold text-foreground">{summary.completionRate.percentage}%</p>
                                        </div>
                                        <div className="text-right text-sm text-muted-foreground">
                                            <p>{summary.completionRate.submitted} submitted</p>
                                            <p>{summary.completionRate.total} total</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </ChartCard>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr_0.95fr]">
                        <ChartCard title="VAT Filing Status" subtitle="Real status split for VAT filings.">
                            <div className="mb-4 h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={summary.vatStatus}
                                            dataKey="count"
                                            nameKey="label"
                                            innerRadius={50}
                                            outerRadius={82}
                                            paddingAngle={3}
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

                        <ChartCard title="CT Filing Status" subtitle="Real status split for CT filings.">
                            <div className="mb-4 h-[220px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={summary.ctStatus}
                                            dataKey="count"
                                            nameKey="label"
                                            innerRadius={50}
                                            outerRadius={82}
                                            paddingAngle={3}
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
                            <div className="grid grid-cols-2 gap-3">
                                {quickActions.map((action) => (
                                    <button
                                        key={action.label}
                                        onClick={() => setActivePage(action.page)}
                                        className="rounded-2xl border border-border bg-muted/30 p-4 text-left transition-colors hover:bg-accent"
                                    >
                                        <PlusIcon className="mb-8 h-5 w-5 text-primary" />
                                        <div className="text-sm font-semibold text-foreground">{action.label}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 space-y-3">
                                <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Active Filing Customers</span>
                                        <span className="font-semibold text-foreground">{summary.cards.activeFilingCustomers}</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Due This Month</span>
                                        <span className="font-semibold text-foreground">{summary.cards.dueThisMonth}</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-border bg-muted/20 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Departments</span>
                                        <span className="font-semibold text-foreground">{summary.cards.departments}</span>
                                    </div>
                                </div>
                            </div>
                        </ChartCard>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                        <ChartCard
                            title={summary.scope === 'super_admin' ? 'Department Workload' : 'User Workload'}
                            subtitle="Interactive stacked workload comparison for the current scope."
                        >
                            <div className="h-[320px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={workloadData}>
                                        <CartesianGrid stroke={chartGridColor} vertical={false} />
                                        <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ color: '#c7cad6', fontSize: 12 }} />
                                        <Bar dataKey="pending" name="Pending" stackId="a" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="submitted" name="Submitted" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </ChartCard>

                        <ChartCard title="Upcoming Due Dates" subtitle="Nearest VAT and CT deadlines in your current scope.">
                            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {summary.dueDates.slice(0, 12).map((item) => (
                                    <div key={`${item.customerId}-${item.filingType}-${item.periodLabel}`} className="rounded-2xl border border-border bg-muted/15 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="truncate text-sm font-semibold text-foreground">{item.customerName}</p>
                                                    <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                                        {item.filingType}
                                                    </span>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-muted-foreground">{item.periodLabel} | {item.assignedUserName}</p>
                                            </div>
                                            <span className="shrink-0 text-sm font-semibold text-foreground">{formatDate(item.dueDate)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartCard>
                    </div>

                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                        <ChartCard title="Customer Attention" subtitle="Customers with open or overdue filing load.">
                            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {summary.customerAttention.slice(0, 12).map((item) => (
                                    <div key={item.customerId} className="rounded-2xl border border-border bg-muted/15 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-foreground">{item.customerName}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    VAT {item.openVatFilings} | CT {item.openCtFilings} | Next {formatDate(item.nextDueDate)}
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-300">
                                                {item.overdueFilings} overdue
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ChartCard>

                        <ChartCard title="Recent Filing Activity" subtitle="Latest workflow updates and filing actions.">
                            <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                                {summary.recentActivity.slice(0, 12).map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-border bg-muted/15 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full"
                                                        style={{ backgroundColor: item.filingType === 'VAT' ? '#60a5fa' : '#34d399' }}
                                                    />
                                                    <p className="truncate text-sm font-semibold text-foreground">{item.customerName}</p>
                                                </div>
                                                <p className="mt-1 truncate text-xs text-muted-foreground">{item.title} | {item.userName}</p>
                                            </div>
                                            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
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
