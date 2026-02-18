
import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Role, Permission } from '../types';
import { PlusIcon, TrashIcon, LockClosedIcon, CheckIcon, PencilIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { RoleModal } from './RoleModal';

interface RolesPermissionsProps {
    roles: Role[];
    allPermissions: Permission[];
    onUpdateRolePermissions: (roleId: string, permissions: string[]) => void;
    onUpdateRoleDetails: (roleId: string, name: string, description: string) => void;
    onAddRole: (name: string, description: string) => void;
    onDeleteRole: (roleId: string) => void;
}

export const RolesPermissions: React.FC<RolesPermissionsProps> = ({ roles, allPermissions, onUpdateRolePermissions, onUpdateRoleDetails, onAddRole, onDeleteRole }) => {
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [editedPermissions, setEditedPermissions] = useState<string[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const { hasPermission } = useData();
    const prevRolesLength = useRef(roles.length);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);

    const selectedRole = roles.find(r => r.id === selectedRoleId);

    // Effect to handle selection changes and role deletions
    useEffect(() => {
        const roleExists = roles.some(r => r.id === selectedRoleId);

        if (selectedRoleId && !roleExists) {
            // If selected role was deleted, select the first one
            setSelectedRoleId(roles.length > 0 ? roles[0].id : null);
        } else if (!selectedRoleId && roles.length > 0) {
            // If no role is selected, select the first one
            setSelectedRoleId(roles[0].id);
        }
    }, [roles, selectedRoleId]);

    // Effect to update the form when the selected role changes
    useEffect(() => {
        if (selectedRole) {
            setEditedPermissions(selectedRole.permissions);
            setIsDirty(false);
        }
    }, [selectedRole]);


    // UX Improvement: Auto-select a newly added role.
    useEffect(() => {
        if (roles.length > prevRolesLength.current) {
            const newRole = roles[roles.length - 1]; // Assumes new role is added to the end
            if (newRole) {
                setSelectedRoleId(newRole.id);
            }
        }
        prevRolesLength.current = roles.length;
    }, [roles]);

    const handlePermissionChange = (permissionId: string, checked: boolean) => {
        if (!selectedRole || !selectedRole.isEditable) return;
        setIsDirty(true);
        setEditedPermissions(prev =>
            checked ? [...prev, permissionId] : prev.filter(p => p !== permissionId)
        );
    };

    const handleSaveChanges = () => {
        if (selectedRole) {
            onUpdateRolePermissions(selectedRole.id, editedPermissions);
            setIsDirty(false);
        }
    };

    const handleDelete = (role: Role) => {
        if (window.confirm(`Are you sure you want to delete the "${role.name}" role? This action cannot be undone.`)) {
            onDeleteRole(role.id);
        }
    };

    const handleOpenAddModal = () => {
        if (!hasPermission('role-management:create')) return;
        setEditingRole({});
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (role: Role) => {
        if (!hasPermission('role-management:edit')) return;
        setEditingRole(role);
        setIsModalOpen(true);
    };

    const handleSaveRole = (roleData: { name: string; description: string; id?: string }) => {
        if (roleData.id) {
            onUpdateRoleDetails(roleData.id, roleData.name, roleData.description);
        } else {
            onAddRole(roleData.name, roleData.description);
        }
        setIsModalOpen(false);
    };

    // Group permissions by category for the table
    const groupedPermissions = useMemo(() => {
        const groups: Record<string, Permission[]> = {};
        allPermissions.forEach(p => {
            if (!groups[p.category]) groups[p.category] = [];
            groups[p.category].push(p);
        });
        return groups;
    }, [allPermissions]);

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1">
                    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-semibold text-foreground">Roles</h3>
                            <button
                                onClick={handleOpenAddModal}
                                disabled={!hasPermission('role-management:create')}
                                className="flex items-center text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
                            >
                                <PlusIcon className="w-4 h-4 mr-1.5" /> Add Role
                            </button>
                        </div>
                        <ul className="space-y-1">
                            {roles.map(role => (
                                <li key={role.id}>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        className={`w-full text-left p-3 rounded-md flex justify-between items-center transition-colors cursor-pointer ${selectedRoleId === role.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
                                        onClick={() => setSelectedRoleId(role.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedRoleId(role.id); }}
                                    >
                                        <div>
                                            <p className="font-semibold text-sm flex items-center">
                                                {!role.isEditable && <LockClosedIcon className={`w-3.5 h-3.5 mr-2 ${selectedRoleId === role.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`} />}
                                                {role.name}
                                            </p>
                                            <p className={`text-xs ${selectedRoleId === role.id ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{role.description}</p>
                                        </div>
                                        {role.isEditable && (
                                            <div className="flex items-center space-x-1">
                                                {hasPermission('role-management:edit') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(role); }}
                                                        className={`p-1.5 rounded transition-colors ${selectedRoleId === role.id ? 'hover:bg-primary-foreground/10 text-primary-foreground' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                                                        aria-label={`Edit ${role.name}`}
                                                    >
                                                        <PencilIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {hasPermission('role-management:delete') && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                                                        className={`p-1.5 rounded transition-colors ${selectedRoleId === role.id ? 'hover:bg-primary-foreground/10 text-primary-foreground' : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'}`}
                                                        aria-label={`Delete ${role.name}`}
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="lg:col-span-3">
                    {selectedRole ? (
                        <div className="bg-card rounded-lg border border-border shadow-sm">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
                                    <div>
                                        <h2 className="text-xl font-bold flex items-center text-foreground">
                                            {selectedRole.name}
                                            {/* Fix: Use a `span` with a `title` attribute for tooltips instead of adding a `title` prop directly to a custom component, which can cause React warnings. */}
                                            {!selectedRole.isEditable && <span title="This role cannot be edited."><LockClosedIcon className="w-4 h-4 ml-2 text-muted-foreground" /></span>}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">Manage permissions for this role.</p>
                                    </div>
                                    {selectedRole.isEditable && (
                                        <button
                                            onClick={handleSaveChanges}
                                            disabled={!isDirty || !hasPermission('role-management:edit')}
                                            className="flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                                        >
                                            <CheckIcon className="w-5 h-5 mr-2" />
                                            Save Changes
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted text-left">
                                        <tr>
                                            <th className="py-3 px-6 font-semibold text-muted-foreground">Category</th>
                                            <th className="py-3 px-4 font-semibold text-muted-foreground">Action</th>
                                            <th className="py-3 px-4 font-semibold text-muted-foreground text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(groupedPermissions).map(([category, perms], catIndex) => (
                                            <React.Fragment key={category}>
                                                {(perms as Permission[]).map((p, index) => (
                                                    <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${index === 0 ? 'border-t border-border' : ''}`}>
                                                        <td className="py-3 px-6 font-medium text-foreground">
                                                            {index === 0 ? category : ''}
                                                        </td>
                                                        <td className="py-3 px-4 text-muted-foreground">
                                                            <div className="flex flex-col">
                                                                <span className="text-foreground font-medium">{p.label}</span>
                                                                <span className="text-xs text-muted-foreground/70">{p.description}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={editedPermissions.includes(p.id)}
                                                                onChange={(e) => handlePermissionChange(p.id, e.target.checked)}
                                                                disabled={!selectedRole.isEditable || !hasPermission('role-management:edit')}
                                                                className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full bg-card min-h-[300px] p-6 rounded-lg border border-border shadow-sm">
                            <p className="text-muted-foreground">Select a role to view its permissions or add a new one.</p>
                        </div>
                    )}
                </div>
            </div>
            {isModalOpen && editingRole && (
                <RoleModal
                    role={editingRole}
                    onSave={handleSaveRole}
                    onClose={() => setIsModalOpen(false)}
                />
            )}
        </>
    );
};
