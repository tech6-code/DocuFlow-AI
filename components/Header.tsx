
import React, { useState } from 'react';
import { Bars3Icon, ArrowRightIcon, BellIcon, MagnifyingGlassIcon, CheckIcon, InformationCircleIcon, ExclamationTriangleIcon } from './icons';
import type { User, Department, Notification } from '../types';

interface MainHeaderProps {
    title: string;
    subtitle: string;
    currentUser: User | null;
    departments: Department[];
    onMenuClick: () => void;
    onLogout?: () => void;
}

const UserDisplay = ({ currentUser, departments, onLogout }: { currentUser: User | null, departments: Department[], onLogout?: () => void }) => {
    if (!currentUser) return null;
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
    
    const userDepartment = departments.find(d => d.id === currentUser.departmentId)?.name;

    return (
        <div className="relative group flex items-center gap-4">
            <div className="flex items-center space-x-3 cursor-default">
                <div className="w-9 h-9 bg-gray-700 border border-gray-600 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm">
                    {initials}
                </div>
                <div className="hidden md:block text-right">
                    <p className="font-semibold text-sm text-white leading-tight">{currentUser.name}</p>
                    <div className="text-xs text-gray-400 flex items-center justify-end gap-1">
                        <span>{currentUser.email}</span>
                        {userDepartment && (
                            <>
                                <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                                <span className="text-blue-400">{userDepartment}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {onLogout && (
                <button 
                    onClick={onLogout}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors"
                    title="Sign Out"
                >
                    <ArrowRightIcon className="w-5 h-5" />
                </button>
            )}
        </div>
    );
};

const NotificationDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([
        { id: '1', title: 'Analysis Complete', message: 'Bank Statement #102 has been analyzed successfully.', time: '2 mins ago', read: false, type: 'success' },
        { id: '2', title: 'VAT Return Due', message: 'Upcoming VAT return for Acme Corp is due in 3 days.', time: '1 hour ago', read: false, type: 'warning' },
        { id: '3', title: 'New User Added', message: 'Sarah Connor joined the Finance department.', time: '5 hours ago', read: true, type: 'info' },
    ]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleToggle = () => setIsOpen(!isOpen);

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const getIcon = (type: string) => {
        switch(type) {
            case 'success': return <CheckIcon className="w-4 h-4 text-green-400" />;
            case 'warning': return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />;
            default: return <InformationCircleIcon className="w-4 h-4 text-blue-400" />;
        }
    };

    return (
        <div className="relative">
            <button 
                onClick={handleToggle}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors relative"
            >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-gray-900 animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
                            <h3 className="font-semibold text-white text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="text-xs text-blue-400 hover:text-blue-300">Mark all read</button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length > 0 ? (
                                notifications.map(notification => (
                                    <div key={notification.id} className={`p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${!notification.read ? 'bg-gray-800/20' : ''}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">{getIcon(notification.type)}</div>
                                            <div>
                                                <p className={`text-sm ${!notification.read ? 'text-white font-medium' : 'text-gray-400'}`}>{notification.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{notification.message}</p>
                                                <p className="text-[10px] text-gray-600 mt-1">{notification.time}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-gray-500 text-sm">No notifications</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export const MainHeader: React.FC<MainHeaderProps> = ({ title, subtitle, currentUser, departments, onMenuClick, onLogout }) => {
  return (
    <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-30">
      <div className="mx-auto px-6">
        <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
                <button onClick={onMenuClick} className="p-2 -ml-2 rounded-full hover:bg-gray-700 transition-colors lg:hidden">
                    <Bars3Icon className="w-6 h-6 text-gray-400" />
                </button>
                <div className="hidden sm:block">
                    <h1 className="text-xl font-bold text-white tracking-tight leading-none">
                        {title}
                    </h1>
                    {/* <p className="text-xs text-gray-400 mt-1">{subtitle}</p> */}
                </div>
            </div>

            {/* Global Search Bar */}
            <div className="flex-1 max-w-xl mx-4 hidden md:block">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MagnifyingGlassIcon className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-lg leading-5 bg-gray-800 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                        placeholder="Search documents, customers, or transactions..."
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-gray-600 text-xs border border-gray-700 rounded px-1.5 py-0.5">⌘K</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <NotificationDropdown />
                <UserDisplay currentUser={currentUser} departments={departments} onLogout={onLogout} />
            </div>
        </div>
      </div>
    </header>
  );
};
