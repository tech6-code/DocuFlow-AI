
import React, { useState, useMemo } from 'react';
import type { DocumentHistoryItem, User, Page } from '../types';
import { 
    CalendarDaysIcon,
    DocumentDuplicateIcon, 
    BanknotesIcon, 
    DocumentTextIcon, 
    UsersIcon, 
    PlusIcon,
    ClockIcon,
    WrenchScrewdriverIcon,
    IdentificationIcon,
    BriefcaseIcon,
    UserCircleIcon,
    FolderIcon,
} from './icons';

type DateFilter = 'today' | 'week' | 'month' | 'all';

interface DashboardProps {
    documentHistory: DocumentHistoryItem[];
    setActivePage: (page: Page) => void;
    users: User[];
    currentUser: User | null;
}

const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "just now";
};

const getDocTypeIcon = (type: string, className = "w-4 h-4 text-gray-400") => {
    switch (type) {
        case 'Bank Statements':
            return <BanknotesIcon className={className} />;
        case 'Invoices & Bills':
            return <DocumentTextIcon className={className} />;
        case 'Emirates ID':
        case 'Passport':
        case 'Visa':
            return <IdentificationIcon className={className} />;
        case 'Trade License':
            return <BriefcaseIcon className={className} />;
        case 'Project Workspace': // For backwards compatibility
        case 'Financial Overview':
        case 'VAT Filing Project':
        case 'Corporate Tax Filing Project':
        case 'Registration Project':
        case 'Audit Report Project':
            return <FolderIcon className={className} />;
        default:
            return <ClockIcon className={className} />;
    }
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string | number }) => (
    <div className="bg-gray-900 p-5 rounded-xl border border-gray-700 shadow-sm flex items-center space-x-4">
        <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center ring-1 ring-gray-700">
            {icon}
        </div>
        <div>
            <p className="text-sm text-gray-400 font-medium">{label}</p>
            <p className="text-3xl font-bold font-mono text-white">{value}</p>
        </div>
    </div>
);

const DocumentChart = ({ data }: { data: { name: string; count: number }[] }) => {
    const maxValue = Math.max(...data.map(d => d.count), 1); // Avoid division by zero
    const colors = ['bg-gray-200', 'bg-gray-300', 'bg-gray-400', 'bg-gray-500', 'bg-gray-600'];

    return (
        <div className="space-y-4">
            {data.map((item, index) => (
                <div key={item.name} className="group">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-300 flex items-center">{getDocTypeIcon(item.name, "w-4 h-4 text-gray-400 mr-2")} {item.name}</span>
                        <span className="text-sm font-bold text-white">{item.count}</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div 
                            className={`${colors[index % colors.length]} h-2.5 rounded-full group-hover:opacity-80 transition-all`}
                            style={{ width: `${(item.count / maxValue) * 100}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const Dashboard: React.FC<DashboardProps> = ({ documentHistory, setActivePage, users, currentUser }) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [userFilter, setUserFilter] = useState<string>(currentUser?.id || 'all');

    const { filteredHistory, filterTitle } = useMemo(() => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const weekAgo = today - 6 * 24 * 60 * 60 * 1000;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        const history = documentHistory.filter(item => {
            // User filter
            const userMatch = userFilter === 'all' || users.find(u => u.id === userFilter)?.name === item.processedBy;
            if (!userMatch) return false;

            // Date filter
            const itemDate = new Date(item.processedAt).getTime();
            switch(dateFilter) {
                case 'today': return itemDate >= today;
                case 'week': return itemDate >= weekAgo;
                case 'month': return itemDate >= monthStart;
                case 'all':
                default:
                    return true;
            }
        });

        const userName = userFilter === 'all' ? 'All Users' : users.find(u => u.id === userFilter)?.name || 'Unknown User';
        let dateName = 'All Time';
        if (dateFilter === 'today') dateName = 'Today';
        if (dateFilter === 'week') dateName = 'Last 7 Days';
        if (dateFilter === 'month') dateName = 'This Month';
        
        const title = `Showing activity for ${userName} • ${dateName}`;

        return { filteredHistory: history, filterTitle: title };

    }, [documentHistory, userFilter, dateFilter, users]);

    const stats = useMemo(() => {
        return {
            totalDocs: filteredHistory.length,
            invoices: filteredHistory.filter(item => item.type === 'Invoices & Bills').length,
            statementPages: filteredHistory
                .filter(item => item.type === 'Bank Statements')
                .reduce((sum: number, item) => sum + (Number(item.pageCount) || 0), 0),
            otherDocs: filteredHistory.filter(item => !['Invoices & Bills', 'Bank Statements'].includes(item.type)).length,
        }
    }, [filteredHistory]);

    const getStatLabels = (filter: DateFilter) => {
        switch (filter) {
            case 'today': return { invoices: "Invoices Today", pages: "Pages Today" };
            case 'week': return { invoices: "Invoices (7 Days)", pages: "Pages (7 Days)" };
            case 'month': return { invoices: "Invoices (Month)", pages: "Pages (Month)" };
            default: return { invoices: "Total Invoices", pages: "Total Pages" };
        }
    }
    const statLabels = getStatLabels(dateFilter);

    const docTypeCounts = useMemo(() => {
        const counts = filteredHistory.reduce((acc: Record<string, number>, item) => {
            const currentCount = acc[item.type] || 0;
            acc[item.type] = currentCount + 1;
            return acc;
        }, {} as Record<string, number>);
        
        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => (b.count as number) - (a.count as number));
    }, [filteredHistory]);


    const DateFilterButton = ({ value, label }: { value: DateFilter, label: string }) => (
        <button
            onClick={() => setDateFilter(value)}
            className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${dateFilter === value ? 'bg-white text-black shadow-sm' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xl font-semibold text-white mb-2">Activity Overview</h3>
                <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-sm flex flex-col md:flex-row items-center gap-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <UserCircleIcon className="w-5 h-5 text-gray-400" />
                        <select
                            value={userFilter}
                            onChange={(e) => setUserFilter(e.target.value)}
                            className="w-full md:w-48 bg-transparent text-sm font-semibold text-gray-300 border-0 focus:ring-0"
                        >
                            <option value="all">All Users</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>{user.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="h-6 w-px bg-gray-700 hidden md:block"></div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <DateFilterButton value="today" label="Today" />
                        <DateFilterButton value="week" label="Last 7 Days" />
                        <DateFilterButton value="month" label="This Month" />
                        <DateFilterButton value="all" label="All Time" />
                    </div>
                </div>
            </div>

             <div>
                <p className="text-sm text-gray-400 mb-4">{filterTitle}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard icon={<DocumentDuplicateIcon className="w-6 h-6 text-white" />} label="Documents Processed" value={stats.totalDocs} />
                    <StatCard icon={<DocumentTextIcon className="w-6 h-6 text-white" />} label={statLabels.invoices} value={stats.invoices} />
                    <StatCard icon={<BanknotesIcon className="w-6 h-6 text-white" />} label={statLabels.pages} value={stats.statementPages} />
                    <StatCard icon={<IdentificationIcon className="w-6 h-6 text-white" />} label="Other Documents" value={stats.otherDocs} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold text-white mb-4">Document Types Breakdown</h3>
                    {docTypeCounts.length > 0 ? (
                        <DocumentChart data={docTypeCounts} />
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-10">No documents match the current filters.</p>
                    )}
                </div>
                <div className="bg-gray-900 p-6 rounded-xl border border-gray-700 shadow-sm">
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setActivePage('bankStatements')} className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600">
                            <PlusIcon className="w-6 h-6 text-white mb-2"/>
                            <span className="text-sm font-semibold text-gray-200 text-center">New Statement</span>
                        </button>
                        <button onClick={() => setActivePage('invoicesAndBills')} className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600">
                            <PlusIcon className="w-6 h-6 text-white mb-2"/>
                            <span className="text-sm font-semibold text-gray-200 text-center">New Invoice</span>
                        </button>
                        <button onClick={() => setActivePage('rolesAndPermissions')} className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600">
                            <WrenchScrewdriverIcon className="w-6 h-6 text-gray-300 mb-2"/>
                            <span className="text-sm font-semibold text-gray-200 text-center">Manage Roles</span>
                        </button>
                        <button onClick={() => setActivePage('userManagement')} className="flex flex-col items-center justify-center p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-600">
                            <UsersIcon className="w-6 h-6 text-gray-300 mb-2"/>
                            <span className="text-sm font-semibold text-gray-200 text-center">Manage Users</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden">
                 <h3 className="text-lg font-semibold text-white p-6">Activity Feed</h3>
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-800 text-left">
                            <tr>
                                <th className="py-3 px-6 font-semibold text-gray-300">Document</th>
                                <th className="py-3 px-6 font-semibold text-gray-300">Details</th>
                                {userFilter === 'all' && <th className="py-3 px-6 font-semibold text-gray-300">User</th>}
                                <th className="py-3 px-6 font-semibold text-gray-300 text-right">Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map(item => (
                                    <tr key={item.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                                        <td className="py-3 px-6 font-medium text-gray-300">
                                            <div className="flex items-center gap-3">
                                                {getDocTypeIcon(item.type, "w-5 h-5 text-gray-400")}
                                                <span>{item.type}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-6 text-gray-400">{item.title}</td>
                                        {userFilter === 'all' && <td className="py-3 px-6 text-gray-400">{item.processedBy}</td>}
                                        <td className="py-3 px-6 text-gray-500 text-right">
                                            {/* Use en-GB locale for DD/MM/YYYY format */}
                                            {new Date(item.processedAt).toLocaleDateString('en-GB', { 
                                                day: '2-digit', 
                                                month: '2-digit', 
                                                year: 'numeric'
                                            })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={userFilter === 'all' ? 4 : 3} className="text-center py-12 text-gray-500">
                                        No activity found for the selected filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
};
