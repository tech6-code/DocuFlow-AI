import React from 'react';
import { DepartmentManagement } from '../components/DepartmentManagement';
import { useData } from '../contexts/DataContext';

export const DepartmentManagementPage: React.FC = () => {
    const { departments, users, addDepartment, updateDepartment, deleteDepartment } = useData();

    return (
        <DepartmentManagement
            departments={departments}
            users={users}
            onAddDepartment={addDepartment}
            onUpdateDepartment={updateDepartment}
            onDeleteDepartment={deleteDepartment}
        />
    );
};
