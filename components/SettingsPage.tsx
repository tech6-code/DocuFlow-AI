
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
            <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>
            
            <div className="bg-gray-900 rounded-xl border border-gray-700 shadow-sm overflow-hidden flex flex-col md:flex-row">
                {/* Sidebar Tabs */}
                <div className="w-full md:w-64 bg-gray-900/50 border-b md:border-b-0 md:border-r border-gray-700 p-2">
                    <nav className="space-y-1">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'general' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                        >
                            <UserCircleIcon className="w-5 h-5 mr-3" />
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'notifications' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                            }`}
                        >
                            <BellIcon className="w-5 h-5 mr-3" />
                            Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab('security')}
                            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                                activeTab === 'security' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
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
                                <h3 className="text-lg font-medium text-white mb-1">Profile Information</h3>
                                <p className="text-sm text-gray-400">Update your account's profile information.</p>
                            </div>
                            <div className="space-y-4 max-w-md">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                                    <input 
                                        type="text" 
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={email}
                                        disabled
                                        className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-2.5 text-gray-400 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-6 border-t border-gray-700">
                                <h3 className="text-lg font-medium text-white mb-1">App Preferences</h3>
                                <p className="text-sm text-gray-400 mb-4">Set your default currency and formatting.</p>
                                <div className="max-w-md">
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Default Currency</label>
                                    <select 
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
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
                                <h3 className="text-lg font-medium text-white mb-1">Notification Preferences</h3>
                                <p className="text-sm text-gray-400">Manage how you receive alerts and updates.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                                    <div>
                                        <p className="text-sm font-medium text-white">Email Notifications</p>
                                        <p className="text-xs text-gray-400">Receive summary reports via email.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={notifications.email} onChange={(e) => setNotifications({...notifications, email: e.target.checked})} />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                                    <div>
                                        <p className="text-sm font-medium text-white">Push Notifications</p>
                                        <p className="text-xs text-gray-400">Receive in-app alerts for completed tasks.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={notifications.push} onChange={(e) => setNotifications({...notifications, push: e.target.checked})} />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                                    <div>
                                        <p className="text-sm font-medium text-white">VAT Deadlines</p>
                                        <p className="text-xs text-gray-400">Alerts 3 days before VAT filing due dates.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={notifications.vatDeadlines} onChange={(e) => setNotifications({...notifications, vatDeadlines: e.target.checked})} />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-medium text-white mb-1">Security Settings</h3>
                                <p className="text-sm text-gray-400">Manage your password and authentication methods.</p>
                            </div>
                            <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                                <p className="text-sm text-yellow-200">
                                    <strong className="font-semibold">Note:</strong> Password changes must be confirmed via email.
                                </p>
                            </div>
                            <div className="max-w-md space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white outline-none focus:border-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Confirm New Password</label>
                                    <input type="password" placeholder="••••••••" className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-white outline-none focus:border-blue-500" />
                                </div>
                                <button className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors">
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
                    className="flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg shadow-blue-900/20 transition-all"
                >
                    <CheckIcon className="w-5 h-5 mr-2" />
                    Save Changes
                </button>
            </div>
        </div>
    );
};
