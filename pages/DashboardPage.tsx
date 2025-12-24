import React from 'react';
import { Dashboard } from '../components/Dashboard';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
    const { currentUser } = useAuth();
    const { documentHistory, users } = useData();
    const navigate = useNavigate();

    return (
        <Dashboard
            documentHistory={documentHistory}
            users={users}
            currentUser={currentUser}
            setActivePage={(page) => navigate(page === 'dashboard' ? '/' : `/${page}`)}
        />
    );
};
