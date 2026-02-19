
import React, { useState } from 'react';
import { MagnifyingGlassIcon, CheckIcon, XMarkIcon, ListBulletIcon } from './icons';
import type { AuditLog } from '../types';

const MOCK_LOGS: AuditLog[] = [
    { id: '1', user: 'Admin User', action: 'Created User', target: 'John Doe', timestamp: '2023-10-25T10:30:00Z', status: 'Success' },
    { id: '2', user: 'Finance Clerk', action: 'Uploaded Document', target: 'Bank_Statement_Oct.pdf', timestamp: '2023-10-25T11:15:00Z', status: 'Success' },
    { id: '3', user: 'Admin User', action: 'Deleted Customer', target: 'Acme Corp', timestamp: '2023-10-24T16:45:00Z', status: 'Success' },
    { id: '4', user: 'Finance Clerk', action: 'Failed Login', target: 'N/A', timestamp: '2023-10-24T09:00:00Z', status: 'Failed' },
    { id: '5', user: 'System', action: 'Automated Backup', target: 'Database', timestamp: '2023-10-24T02:00:00Z', status: 'Success' },
    { id: '6', user: 'Manager', action: 'Updated Role', target: 'Finance Clerk Role', timestamp: '2023-10-23T14:20:00Z', status: 'Success' },
];

export const AuditLogsPage = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [logs] = useState<AuditLog[]>(MOCK_LOGS);

    const filteredLogs = logs.filter(log =>
        log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.target.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">Audit Logs</h2>
                    <p className="text-sm text-muted-foreground mt-1">Track user activity and system events.</p>
                </div>
                <div className="relative w-full md:w-80">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                    />
                </div>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-muted-foreground">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted border-b border-border">
                            <tr>
                                <th className="px-6 py-4 font-bold">User</th>
                                <th className="px-6 py-4 font-bold">Action</th>
                                <th className="px-6 py-4 font-bold">Target</th>
                                <th className="px-6 py-4 font-bold">Timestamp</th>
                                <th className="px-6 py-4 font-bold text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length > 0 ? (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                                        <td className="px-6 py-4 text-foreground font-medium">{log.user}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-foreground/80">{log.target}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                                        <td className="px-6 py-4 text-center">
                                            {log.status === 'Success' ? (
                                                <span className="inline-flex items-center text-xs font-bold text-green-500">
                                                    <CheckIcon className="w-3.5 h-3.5 mr-1" /> Success
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center text-xs font-bold text-destructive">
                                                    <XMarkIcon className="w-3.5 h-3.5 mr-1" /> Failed
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <ListBulletIcon className="w-10 h-10 mb-3 opacity-50" />
                                            <p>No logs found matching your search.</p>
                                        </div>
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
