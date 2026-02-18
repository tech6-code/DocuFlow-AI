
import React, { useState } from 'react';
import { UserCircleIcon, BellIcon, LockClosedIcon, CheckIcon } from './icons';

export const SettingsPage = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'security'>('general');

    // Mock States
    const [displayName, setDisplayName] = useState('Admin User');
    const [email, setEmail] = useState('admin@docuflow.com');
    const [currency, setCurrency] = useState('AED');
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        vatDeadlines: true,
        systemUpdates: false
    });

    const handleSave = () => {
        // Logic to save settings would go here
        alert("Settings saved successfully!");
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-foreground mb-6">Settings</h2>

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col md:flex-row">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 bg-muted/30 border-b md:border-b-0 md:border-r border-border p-2">
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'general' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <UserCircleIcon className="w-5 h-5 mr-3" />
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'notifications' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <BellIcon className="w-5 h-5 mr-3" />
                            Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${activeTab === 'security' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                        >
                            <LockClosedIcon className="w-5 h-5 mr-3" />
                            Security
                        </button>
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 md:p-8">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-foreground mb-1">Profile Information</h3>
                                <p className="text-sm text-muted-foreground">Update your account's profile information.</p>
                            </div>
                            <div className="space-y-4 max-w-md">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                                    <input
                                        type="text"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        disabled
                                        className="w-full bg-muted/50 border border-border rounded-lg p-2.5 text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-border">
                                <h3 className="text-lg font-medium text-foreground mb-1">App Preferences</h3>
                                <p className="text-sm text-muted-foreground mb-4">Set your default currency and formatting.</p>
                                <div className="max-w-md">
                                    <label className="block text-sm font-medium text-foreground mb-1">Default Currency</label>
                                    <select
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="AED">AED (United Arab Emirates Dirham)</option>
                                        <option value="USD">USD (United States Dollar)</option>
                                        <option value="EUR">EUR (Euro)</option>
                                        <option value="GBP">GBP (British Pound)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-foreground mb-1">Notification Preferences</h3>
                                <p className="text-sm text-muted-foreground">Manage how you receive alerts and updates.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Email Notifications</p>
                                        <p className="text-xs text-muted-foreground">Receive summary reports via email.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={notifications.email} onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })} />
                                        <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Push Notifications</p>
                                        <p className="text-xs text-muted-foreground">Receive in-app alerts for completed tasks.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={notifications.push} onChange={(e) => setNotifications({ ...notifications, push: e.target.checked })} />
                                        <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-muted rounded-lg border border-border">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">VAT Deadlines</p>
                                        <p className="text-xs text-muted-foreground">Alerts 3 days before VAT filing due dates.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={notifications.vatDeadlines} onChange={(e) => setNotifications({ ...notifications, vatDeadlines: e.target.checked })} />
                                        <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-foreground mb-1">Security Settings</h3>
                                <p className="text-sm text-muted-foreground">Manage your password and authentication methods.</p>
                            </div>
                            <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                                <p className="text-sm text-yellow-200">
                                    <strong className="font-semibold">Note:</strong> Password changes must be confirmed via email.
                                </p>
                            </div>
                            <div className="max-w-md space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Current Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">New Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground outline-none focus:border-primary" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Confirm New Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-muted border border-border rounded-lg p-2.5 text-foreground outline-none focus:border-primary" />
                                </div>
                                <button className="w-full px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg transition-colors border border-border">
                                    Update Password
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="flex items-center px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-lg shadow-primary/20 transition-all"
                >
                    <CheckIcon className="w-5 h-5 mr-2" />
                    Save Changes
                </button>
            </div>
        </div>
    );
};
