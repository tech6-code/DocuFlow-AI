import React from 'react';
import { RolesPermissions } from '../components/RolesPermissions';
import { useData } from '../contexts/DataContext';

export const RolesPermissionsPage: React.FC = () => {
    const {
        roles,
        permissionsList,
        updateRolePermissions,
        updateRoleDetails,
        addRole,
        deleteRole
    } = useData();

    return (
        <RolesPermissions
            roles={roles}
            allPermissions={permissionsList}
            onUpdateRolePermissions={updateRolePermissions}
            onUpdateRoleDetails={updateRoleDetails}
            onAddRole={addRole}
            onDeleteRole={deleteRole}
        />
    );
};
