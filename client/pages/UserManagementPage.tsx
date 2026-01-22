import React from 'react';
import { UserManagement } from '../components/UserManagement';
import { useData } from '../contexts/DataContext';

export const UserManagementPage: React.FC = () => {
    const { users, roles, departments, addUser, updateUser, deleteUser } = useData();

    return (
        <UserManagement
            users={users}
            roles={roles}
            departments={departments}
            onAddUser={addUser}
            onUpdateUser={updateUser}
            onDeleteUser={deleteUser}
        />
    );
};
