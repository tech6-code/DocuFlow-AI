
import React, { useState } from 'react';
import { Bars3Icon, ArrowRightIcon, BellIcon, MagnifyingGlassIcon, CheckIcon, InformationCircleIcon, ExclamationTriangleIcon } from './icons';
import type { User, Department, Notification } from '../types';
import { ThemeToggle } from './ThemeToggle';

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
    const initials = currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    const userDepartment = departments.find(d => d.id === currentUser.departmentId)?.name;

    return (
        <div className="relative group flex items-center gap-4">
            <div className="flex items-center space-x-3 cursor-default">
                <div className="w-9 h-9 bg-muted border border-border rounded-full flex items-center justify-center text-foreground font-bold text-xs flex-shrink-0 shadow-sm">
                    {initials}
                </div>
                <div className="hidden md:block text-right">
                    <p className="font-semibold text-sm text-foreground leading-tight">{currentUser.name}</p>
                    <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <span>{currentUser.email}</span>
                        {userDepartment && (
                            <>
                                <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                                <span className="text-primary">{userDepartment}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            {onLogout && (
                <button
                    onClick={onLogout}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors"
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
        switch (type) {
            case 'success': return <CheckIcon className="w-4 h-4 text-green-400" />;
            case 'warning': return <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />;
            default: return <InformationCircleIcon className="w-4 h-4 text-blue-400" />;
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleToggle}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full transition-colors relative"
            >
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full ring-2 ring-background animate-pulse"></span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-2 w-80 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="p-4 border-b border-border flex justify-between items-center bg-popover">
                            <h3 className="font-semibold text-foreground text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="text-xs text-primary hover:underline">Mark all read</button>
                            )}
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length > 0 ? (
                                notifications.map(notification => (
                                    <div key={notification.id} className={`p-4 border-b border-border hover:bg-accent transition-colors ${!notification.read ? 'bg-muted/50' : ''}`}>
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">{getIcon(notification.type)}</div>
                                            <div>
                                                <p className={`text-sm ${!notification.read ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{notification.title}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">{notification.message}</p>
                                                <p className="text-[10px] text-muted-foreground/70 mt-1">{notification.time}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-muted-foreground text-sm">No notifications</div>
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
        <header className="bg-background/80 backdrop-blur-lg border-b border-border sticky top-0 z-30">
            <div className="mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center space-x-4">
                        <button onClick={onMenuClick} className="p-2 -ml-2 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                            <Bars3Icon className="w-6 h-6" />
                        </button>
                        <div className="hidden sm:block">
                            <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">
                                {title}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <ThemeToggle />
                        <NotificationDropdown />
                        <UserDisplay currentUser={currentUser} departments={departments} onLogout={onLogout} />
                    </div>
                </div>
            </div>
        </header>
    );
};

export const Header = MainHeader;
