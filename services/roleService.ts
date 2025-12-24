
import { supabase } from './supabase';
import type { Role, Permission } from '../types';

export const roleService = {
    async getPermissions(): Promise<Permission[]> {
        const { data, error } = await supabase
            .from('permissions')
            .select('*')
            .order('category', { ascending: true });

        if (error) {
            console.error('Error fetching permissions:', error);
            return [];
        }
        return data || [];
    },

    async getRoles(): Promise<Role[]> {
        // Fetch roles and their associated permission IDs via the junction table
        const { data, error } = await supabase
            .from('roles')
            .select(`
                *,
                role_permissions (
                    permission_id
                )
            `)
            .order('created_at');

        if (error) {
            console.error('Error fetching roles:', error);
            return [];
        }

        // Transform Supabase response to match app Role interface
        return data.map((r: any) => ({
            id: r.id, // UUID
            name: r.name,
            description: r.description,
            isEditable: r.is_editable,
            permissions: r.role_permissions.map((rp: any) => rp.permission_id)
        }));
    },

    async createRole(name: string, description: string): Promise<Role | null> {
        const { data, error } = await supabase
            .from('roles')
            .insert([{ name, description, is_editable: true }])
            .select()
            .single();

        if (error) {
            console.error('Error creating role:', error);
            throw new Error(error.message);
        }

        return {
            id: data.id,
            name: data.name,
            description: data.description,
            isEditable: data.is_editable,
            permissions: []
        };
    },

    async updateRoleDetails(id: string, name: string, description: string): Promise<boolean> {
        const { error } = await supabase
            .from('roles')
            .update({ name, description })
            .eq('id', id);

        if (error) {
            console.error('Error updating role:', error);
            throw new Error(error.message);
        }
        return true;
    },

    async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<boolean> {
        // 1. Delete existing permissions for this role
        const { error: deleteError } = await supabase
            .from('role_permissions')
            .delete()
            .eq('role_id', roleId);

        if (deleteError) {
            console.error('Error clearing permissions:', deleteError);
            throw new Error(deleteError.message);
        }

        // 2. Insert new permissions (if any)
        if (permissionIds.length > 0) {
            const rows = permissionIds.map(pid => ({
                role_id: roleId,
                permission_id: pid
            }));

            const { error: insertError } = await supabase
                .from('role_permissions')
                .insert(rows);

            if (insertError) {
                console.error('Error adding permissions:', insertError);
                throw new Error(insertError.message);
            }
        }

        return true;
    },

    async deleteRole(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('roles')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting role:', error);
            throw new Error("Could not delete role. It might be assigned to users.");
        }
        return true;
    }
};
