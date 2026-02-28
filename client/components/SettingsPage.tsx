import React, { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { CheckIcon } from './icons';

type SettingsTab = 'general' | 'notifications' | 'security';
const settingsHeaderDescription: Record<SettingsTab, string> = {
    general: 'Review and update your personal account details.',
    notifications: 'Choose how and when you receive account alerts.',
    security: 'Manage password and security protection preferences.'
};

const Toggle = ({
    checked,
    onChange
}: {
    checked: boolean;
    onChange: (checked: boolean) => void;
}) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
        />
        <span className="w-12 h-7 bg-muted border border-border rounded-full peer-checked:bg-primary peer-checked:border-primary transition-colors" />
        <span className="absolute left-1 top-1 w-5 h-5 bg-background border border-border rounded-full transition-transform peer-checked:translate-x-5 peer-checked:border-primary" />
    </label>
);

export const SettingsPage = () => {
    const { tab } = useParams<{ tab: string }>();
    const [displayName, setDisplayName] = useState('Admin User');
    const [email] = useState('admin@docuflow.com');
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        vatDeadlines: true,
        systemUpdates: false
    });

    const handleSave = () => {
        alert('Settings saved successfully!');
    };

    const activeTab = tab as SettingsTab | undefined;
    if (!activeTab || !['general', 'notifications', 'security'].includes(activeTab)) {
        return <Navigate to="/settings/general" replace />;
    }

    return (
        <div className="max-w-6xl mx-auto px-2 sm:px-0 pb-10 space-y-6">
            <div className="rounded-3xl border border-border bg-card overflow-hidden">
                <div className="p-6 sm:p-8 border-b border-border">
                    <div>
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-black">Account Control Center</p>
                            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground mt-2">Settings</h2>
                            <p className="text-sm text-muted-foreground mt-2">{settingsHeaderDescription[activeTab]}</p>
                        </div>
                    </div>
                </div>

                <section className="p-5 sm:p-8">
                        {activeTab === 'general' && (
                            <div className="space-y-8">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black tracking-tight text-foreground">Profile Information</h3>
                                    <p className="text-sm text-muted-foreground">Update your account profile details.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Display Name</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/40 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Email Address</label>
                                        <input
                                            type="email"
                                            value={email}
                                            disabled
                                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/20 text-muted-foreground cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                            </div>
                        )}

                        {activeTab === 'notifications' && (
                            <div className="space-y-8">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black tracking-tight text-foreground">Notification Preferences</h3>
                                    <p className="text-sm text-muted-foreground">Control which alerts are sent to your inbox and dashboard.</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">Email Notifications</p>
                                            <p className="text-xs text-muted-foreground">Receive summary reports via email.</p>
                                        </div>
                                        <Toggle checked={notifications.email} onChange={(checked) => setNotifications({ ...notifications, email: checked })} />
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">Push Notifications</p>
                                            <p className="text-xs text-muted-foreground">Receive in-app alerts for completed tasks.</p>
                                        </div>
                                        <Toggle checked={notifications.push} onChange={(checked) => setNotifications({ ...notifications, push: checked })} />
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">VAT Deadlines</p>
                                            <p className="text-xs text-muted-foreground">Alerts before VAT filing due dates.</p>
                                        </div>
                                        <Toggle checked={notifications.vatDeadlines} onChange={(checked) => setNotifications({ ...notifications, vatDeadlines: checked })} />
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/20 p-4 flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-bold text-foreground">System Updates</p>
                                            <p className="text-xs text-muted-foreground">News about releases and platform maintenance.</p>
                                        </div>
                                        <Toggle checked={notifications.systemUpdates} onChange={(checked) => setNotifications({ ...notifications, systemUpdates: checked })} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-8">
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black tracking-tight text-foreground">Security Settings</h3>
                                    <p className="text-sm text-muted-foreground">Manage password and account protection details.</p>
                                </div>

                                <div className="rounded-xl border border-yellow-300 bg-yellow-50 dark:border-yellow-600/40 dark:bg-yellow-500/10 p-4">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        <strong className="font-black">Note:</strong> Password changes require email confirmation.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Current Password</label>
                                        <input
                                            type="password"
                                            placeholder="********"
                                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/40 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">New Password</label>
                                        <input
                                            type="password"
                                            placeholder="********"
                                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/40 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Confirm New Password</label>
                                        <input
                                            type="password"
                                            placeholder="********"
                                            className="w-full h-12 px-4 rounded-xl border border-border bg-muted/40 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                        />
                                    </div>
                                </div>

                                <button className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-border bg-muted hover:bg-accent text-foreground font-bold transition-colors">
                                    Update Password
                                </button>
                            </div>
                        )}
                </section>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-[0.14em] text-xs transition-colors"
                >
                    <CheckIcon className="w-4 h-4" />
                    Save Changes
                </button>
            </div>
        </div>
    );
};
