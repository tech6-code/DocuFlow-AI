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

    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
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

    useEffect(() => {
        if (!roles.length) {
            setSelectedRoleId(null);
            return;
        }
        if (!selectedRoleId || !roles.some((r) => r.id === selectedRoleId)) {
            setSelectedRoleId(roles[0].id);
        }
    }, [roles, selectedRoleId]);

    const selectedRole = roles.find((role) => role.id === selectedRoleId) || null;

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

    const getSelectedRolePermissions = () => {
        if (!selectedRole) return [];
        return editedPermissionsByRole[selectedRole.id] || [];
    };

    const setSelectedRolePermissions = (nextPermissions: string[]) => {
        if (!selectedRole) return;
        setEditedPermissionsByRole(prev => ({ ...prev, [selectedRole.id]: nextPermissions }));
        setDirtyRoleIds(prev => {
            const next = new Set(prev);
            next.add(selectedRole.id);
            return next;
        });
    };

    const handlePermissionChange = (permissionId: string, checked: boolean) => {
        if (!selectedRole || !selectedRole.isEditable || !canEditRoles) return;

        const current = getSelectedRolePermissions();
        const next = checked
            ? Array.from(new Set([...current, permissionId]))
            : current.filter(id => id !== permissionId);
        setSelectedRolePermissions(next);
    };

    const findPermissionByAction = (permissions: Permission[], action: 'view' | 'create' | 'edit' | 'delete') => {
        const exact = permissions.find((p) => p.id.toLowerCase().endsWith(`:${action}`));
        if (exact) return exact;
        return permissions.find((p) => p.label.toLowerCase().startsWith(action));
    };

    const hasAllModulePermissions = (permissions: Permission[]) => {
        const selected = new Set(getSelectedRolePermissions());
        return permissions.length > 0 && permissions.every((p) => selected.has(p.id));
    };

    const handleToggleFullModule = (permissions: Permission[], checked: boolean) => {
        if (!selectedRole || !selectedRole.isEditable || !canEditRoles) return;
        const selected = new Set(getSelectedRolePermissions());
        if (checked) {
            permissions.forEach((p) => selected.add(p.id));
        } else {
            permissions.forEach((p) => selected.delete(p.id));
        }
        setSelectedRolePermissions(Array.from(selected));
    };

    const handleSaveSelectedRole = async () => {
        if (!selectedRole || !canEditRoles || !dirtyRoleIds.has(selectedRole.id)) return;
        setIsSaving(true);
        try {
            await Promise.resolve(onUpdateRolePermissions(selectedRole.id, editedPermissionsByRole[selectedRole.id] || []));
            setDirtyRoleIds(prev => {
                const next = new Set(prev);
                next.delete(selectedRole.id);
                return next;
            });
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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                <div className="lg:col-span-1">
                    <div className="bg-card rounded-xl border border-border p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-foreground">Roles</h3>
                            <button
                                onClick={handleOpenAddModal}
                                disabled={!canCreateRoles}
                                className="inline-flex items-center text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
                            >
                                <PlusIcon className="w-4 h-4 mr-1.5" />
                                Add Role
                            </button>
                        </div>

                        <ul className="space-y-1.5">
                            {roles.map((role) => (
                                <li key={role.id}>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedRoleId(role.id)}
                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedRoleId === role.id
                                            ? 'bg-muted border-border'
                                            : 'bg-transparent border-transparent hover:bg-muted/30'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground flex items-center">
                                                    {!role.isEditable && <LockClosedIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />}
                                                    <span className="truncate">{role.name}</span>
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">{role.description}</p>
                                            </div>
                                            {role.isEditable && (
                                                <div className="flex items-center gap-1">
                                                    {canEditRoles && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleOpenEditModal(role); }}
                                                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                                            aria-label={`Edit ${role.name}`}
                                                        >
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDeleteRoles && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(role); }}
                                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                                            aria-label={`Delete ${role.name}`}
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className="lg:col-span-3">
                    {selectedRole ? (
                        <div className="bg-card rounded-xl border border-border overflow-hidden">
                            <div className="p-6 border-b border-border flex items-start justify-between gap-3">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground flex items-center">
                                        {selectedRole.name}
                                        {!selectedRole.isEditable && <LockClosedIcon className="w-4 h-4 ml-2 text-muted-foreground" />}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">Manage permissions for this role.</p>
                                </div>
                                <button
                                    onClick={handleSaveSelectedRole}
                                    disabled={!canEditRoles || !dirtyRoleIds.has(selectedRole.id) || isSaving}
                                    className="inline-flex items-center px-4 py-2 bg-muted text-foreground font-semibold rounded-md hover:bg-muted/80 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckIcon className="w-4 h-4 mr-1.5" />
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/60">
                                        <tr className="border-b border-border">
                                            <th className="py-4 px-6 text-left font-semibold text-foreground w-[280px]">Modules</th>
                                            <th className="py-4 px-4 text-center font-semibold text-foreground w-[90px]">Full</th>
                                            <th className="py-4 px-4 text-center font-semibold text-foreground w-[90px]">View</th>
                                            <th className="py-4 px-4 text-center font-semibold text-foreground w-[90px]">Create</th>
                                            <th className="py-4 px-4 text-center font-semibold text-foreground w-[90px]">Edit</th>
                                            <th className="py-4 px-4 text-center font-semibold text-foreground w-[90px]">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedPermissions.map(({ category, permissions }) => (
                                            <tr key={category} className="border-b border-border hover:bg-muted/10">
                                                <td className="py-4 px-6 text-foreground font-semibold">{category}</td>
                                                <td className="py-4 px-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={hasAllModulePermissions(permissions)}
                                                        onChange={(e) => handleToggleFullModule(permissions, e.target.checked)}
                                                        disabled={!selectedRole.isEditable || !canEditRoles || permissions.length === 0}
                                                        className="h-5 w-5 rounded border-border bg-muted text-primary focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                </td>
                                                {(['view', 'create', 'edit', 'delete'] as const).map((action) => {
                                                    const permission = findPermissionByAction(permissions, action);
                                                    if (!permission) {
                                                        return (
                                                            <td key={`${category}-${action}`} className="py-4 px-4 text-center text-muted-foreground">-</td>
                                                        );
                                                    }
                                                    return (
                                                        <td key={`${category}-${action}`} className="py-4 px-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={(editedPermissionsByRole[selectedRole.id] || []).includes(permission.id)}
                                                                onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                                                                disabled={!selectedRole.isEditable || !canEditRoles}
                                                                className="h-5 w-5 rounded border-border bg-muted text-primary focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card rounded-xl border border-border shadow-sm p-8 text-center text-muted-foreground">
                            No role selected.
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
