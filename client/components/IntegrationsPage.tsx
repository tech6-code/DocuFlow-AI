
import React, { useState } from 'react';
import {
    CheckIcon,
    ArrowUpRightIcon,
    ArrowsRightLeftIcon,
    CloudIcon,
    Cog6ToothIcon,
    XMarkIcon
} from './icons';

interface Integration {
    id: string;
    name: string;
    description: string;
    status: 'connected' | 'disconnected';
    iconText: string;
    iconColor: string;
    connectedAt?: string;
}

const INTEGRATIONS: Integration[] = [
    {
        id: 'quickbooks',
        name: 'QuickBooks Online',
        description: 'Sync invoices, expenses, and bank transactions automatically.',
        status: 'disconnected',
        iconText: 'QB',
        iconColor: 'bg-green-600'
    },
    {
        id: 'xero',
        name: 'Xero',
        description: 'Seamless integration for reconciliation and financial reporting.',
        status: 'disconnected',
        iconText: 'X',
        iconColor: 'bg-blue-500'
    },
    {
        id: 'zoho',
        name: 'Zoho Books',
        description: 'Connect your Zoho workspace for end-to-end accounting automation.',
        status: 'disconnected',
        iconText: 'Z',
        iconColor: 'bg-yellow-500'
    },
    {
        id: 'sap',
        name: 'SAP Business One',
        description: 'Enterprise-grade connector for managing large-scale financial data.',
        status: 'disconnected',
        iconText: 'SAP',
        iconColor: 'bg-blue-800'
    },
    {
        id: 'dynamics',
        name: 'Microsoft Dynamics 365',
        description: 'Integrate with Microsoft ecosystem for comprehensive business management.',
        status: 'disconnected',
        iconText: 'D365',
        iconColor: 'bg-indigo-600'
    },
    {
        id: 'tally',
        name: 'Tally Prime',
        description: 'Bridge the gap between modern AI tools and traditional Tally accounting.',
        status: 'disconnected',
        iconText: 'T',
        iconColor: 'bg-teal-600'
    }
];

export const IntegrationsPage: React.FC = () => {
    const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
    const [connectingId, setConnectingId] = useState<string | null>(null);
    const [configuringId, setConfiguringId] = useState<string | null>(null);

    const handleConnect = (id: string) => {
        setConnectingId(id);
        setTimeout(() => {
            setIntegrations(prev => prev.map(int =>
                int.id === id
                    ? { ...int, status: 'connected', connectedAt: new Date().toISOString() }
                    : int
            ));
            setConnectingId(null);
        }, 2000);
    };

    const handleDisconnect = (id: string) => {
        if (confirm("Are you sure you want to disconnect this integration? Syncing will stop immediately.")) {
            setIntegrations(prev => prev.map(int =>
                int.id === id
                    ? { ...int, status: 'disconnected', connectedAt: undefined }
                    : int
            ));
        }
    };

    const getIntegrationName = (id: string) => {
        return integrations.find(i => i.id === id)?.name || 'Unknown';
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Integrations</h2>
                <p className="text-muted-foreground mt-1">Connect DocuFlow with your favorite accounting software.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map(integration => (
                    <div key={integration.id} className={`bg-card border rounded-xl p-6 transition-all duration-300 flex flex-col justify-between h-full ${integration.status === 'connected' ? 'border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-border hover:border-border/80'}`}>
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg ${integration.iconColor}`}>
                                    {integration.iconText}
                                </div>
                                {integration.status === 'connected' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></div>
                                        Active
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-foreground mb-2">{integration.name}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed mb-6">{integration.description}</p>
                        </div>

                        <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
                            {integration.status === 'connected' ? (
                                <>
                                    <button
                                        onClick={() => setConfiguringId(integration.id)}
                                        className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center transition-colors"
                                    >
                                        <Cog6ToothIcon className="w-4 h-4 mr-2" /> Configure
                                    </button>
                                    <button
                                        onClick={() => handleDisconnect(integration.id)}
                                        className="text-sm font-semibold text-destructive hover:text-destructive/80 transition-colors"
                                    >
                                        Disconnect
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => handleConnect(integration.id)}
                                    disabled={connectingId === integration.id}
                                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {connectingId === integration.id ? (
                                        <>
                                            <ArrowsRightLeftIcon className="w-4 h-4 mr-2 animate-spin" /> Connecting...
                                        </>
                                    ) : (
                                        <>Connect <ArrowUpRightIcon className="w-4 h-4 ml-2" /></>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Configuration Modal */}
            {configuringId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setConfiguringId(null)}>
                    <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
                            <div className="flex items-center">
                                <CloudIcon className="w-5 h-5 text-primary mr-2" />
                                <h3 className="text-lg font-bold text-foreground">{getIntegrationName(configuringId)} Settings</h3>
                            </div>
                            <button
                                onClick={() => setConfiguringId(null)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {[
                                { label: 'Sync Invoices', hint: 'Push processed invoices automatically.', defaultChecked: true },
                                { label: 'Sync Bank Feeds', hint: 'Match statement lines with ledger.', defaultChecked: true },
                                { label: 'Sync Contacts', hint: 'Create new customers/vendors from docs.', defaultChecked: false },
                            ].map(({ label, hint, defaultChecked }) => (
                                <div key={label} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">{label}</p>
                                        <p className="text-xs text-muted-foreground">{hint}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
                                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            ))}
                        </div>
                        <div className="p-4 bg-muted/30 border-t border-border flex justify-end">
                            <button
                                onClick={() => setConfiguringId(null)}
                                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors text-sm shadow-md"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
