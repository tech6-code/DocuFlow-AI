import React, { useEffect, useMemo, useState } from 'react';
import type { Role, Permission } from '../types';
import { PlusIcon, TrashIcon, LockClosedIcon, CheckIcon, PencilIcon } from './icons';
import { useData } from '../contexts/DataContext';
import { RoleModal } from './RoleModal';

interface RolesPermissionsProps {
    roles: Role[];
    allPermissions: Permission[];
    onUpdateRolePermissions: (roleId: string, permissions: string[]) => void | Promise<void>;
    onUpdateRoleDetails: (roleId: string, name: string, description: string) => void;
    onAddRole: (name: string, description: string) => void;
    onDeleteRole: (roleId: string) => void;
}

export const RolesPermissions: React.FC<RolesPermissionsProps> = ({
    roles,
    allPermissions,
    onUpdateRolePermissions,
    onUpdateRoleDetails,
    onAddRole,
    onDeleteRole
}) => {
    const { hasPermission } = useData();

    const [editedPermissionsByRole, setEditedPermissionsByRole] = useState<Record<string, string[]>>({});
    const [dirtyRoleIds, setDirtyRoleIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);

    const canCreateRoles = hasPermission('role-management:create');
    const canEditRoles = hasPermission('role-management:edit');
    const canDeleteRoles = hasPermission('role-management:delete');

    useEffect(() => {
        const next: Record<string, string[]> = {};
        roles.forEach((role) => {
            next[role.id] = role.permissions || [];
        });
        setEditedPermissionsByRole(next);
        setDirtyRoleIds(new Set());
    }, [roles]);

    const groupedPermissions = useMemo(() => {
        const groups = new Map<string, Permission[]>();

        allPermissions.forEach((permission) => {
            const current = groups.get(permission.category) || [];
            current.push(permission);
            groups.set(permission.category, current);
        });

        return Array.from(groups.entries())
            .map(([category, permissions]) => ({
                category,
                permissions: permissions.sort((a, b) => a.label.localeCompare(b.label))
            }))
            .sort((a, b) => a.category.localeCompare(b.category));
    }, [allPermissions]);

    const handlePermissionChange = (roleId: string, permissionId: string, checked: boolean) => {
        const role = roles.find(r => r.id === roleId);
        if (!role || !role.isEditable) return;

        setEditedPermissionsByRole(prev => {
            const current = prev[roleId] || [];
            const next = checked
                ? Array.from(new Set([...current, permissionId]))
                : current.filter(id => id !== permissionId);
            return { ...prev, [roleId]: next };
        });

        setDirtyRoleIds(prev => {
            const next = new Set(prev);
            next.add(roleId);
            return next;
        });
    };

    const handleSaveAllChanges = async () => {
        if (!canEditRoles || dirtyRoleIds.size === 0) return;

        setIsSaving(true);
        try {
            const updates = Array.from(dirtyRoleIds).map((roleId) =>
                Promise.resolve(onUpdateRolePermissions(roleId, editedPermissionsByRole[roleId] || []))
            );
            await Promise.all(updates);
            setDirtyRoleIds(new Set());
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (role: Role) => {
        if (window.confirm(`Are you sure you want to delete the "${role.name}" role? This action cannot be undone.`)) {
            onDeleteRole(role.id);
        }
    };

    const handleOpenAddModal = () => {
        if (!canCreateRoles) return;
        setEditingRole({});
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (role: Role) => {
        if (!canEditRoles) return;
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

    return (
        <>
            <div className="space-y-6">
                <div className="bg-card p-5 rounded-xl border border-border shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-foreground">Roles & Permissions Matrix</h2>
                            <p className="text-sm text-muted-foreground">Manage access by role across each permission category.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleOpenAddModal}
                                disabled={!canCreateRoles}
                                className="inline-flex items-center text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground px-3 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
                            >
                                <PlusIcon className="w-4 h-4 mr-1.5" />
                                Add Role
                            </button>
                            <button
                                onClick={handleSaveAllChanges}
                                disabled={!canEditRoles || dirtyRoleIds.size === 0 || isSaving}
                                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors text-xs shadow-sm disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
                            >
                                <CheckIcon className="w-4 h-4 mr-1.5" />
                                {isSaving ? 'Saving...' : `Save Changes${dirtyRoleIds.size > 0 ? ` (${dirtyRoleIds.size})` : ''}`}
                            </button>
                        </div>
                    </div>
                    <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {roles.map((role) => (
                            <li key={role.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground flex items-center">
                                        {!role.isEditable && <LockClosedIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />}
                                        <span className="truncate">{role.name}</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">{role.description}</p>
                                </div>
                                {role.isEditable && (
                                    <div className="ml-3 flex items-center gap-1">
                                        {canEditRoles && (
                                            <button
                                                onClick={() => handleOpenEditModal(role)}
                                                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                aria-label={`Edit ${role.name}`}
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        {canDeleteRoles && (
                                            <button
                                                onClick={() => handleDelete(role)}
                                                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                aria-label={`Delete ${role.name}`}
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                {groupedPermissions.map(({ category, permissions }) => (
                    <div key={category} className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-sm">
                                <thead className="bg-muted/60">
                                    <tr className="border-b border-border">
                                        <th className="py-3 px-4 text-left font-semibold text-foreground w-[220px]">{category}</th>
                                        {permissions.map((permission) => (
                                            <th key={permission.id} className="py-3 px-3 text-center font-semibold text-foreground min-w-[150px]">
                                                <div className="flex flex-col items-center">
                                                    <span>{permission.label}</span>
                                                    <span className="text-[10px] font-medium text-muted-foreground mt-0.5 text-center">
                                                        {permission.description}
                                                    </span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {roles.map((role) => (
                                        <tr key={`${category}-${role.id}`} className="border-b last:border-b-0 border-border hover:bg-muted/20">
                                            <td className="py-3 px-4">
                                                <p className="font-medium text-foreground flex items-center">
                                                    {!role.isEditable && <LockClosedIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />}
                                                    {role.name}
                                                </p>
                                            </td>
                                            {permissions.map((permission) => (
                                                <td key={`${role.id}-${permission.id}`} className="py-3 px-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={(editedPermissionsByRole[role.id] || []).includes(permission.id)}
                                                        onChange={(e) => handlePermissionChange(role.id, permission.id, e.target.checked)}
                                                        disabled={!role.isEditable || !canEditRoles}
                                                        className="h-5 w-5 rounded border-border bg-muted text-emerald-600 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
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
