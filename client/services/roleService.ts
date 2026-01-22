import { apiFetch } from "./apiClient";
import type { Role, Permission } from "../types";

const mapRole = (r: any): Role => ({
  id: r.id,
  name: r.name,
  description: r.description,
  isEditable: r.is_editable,
  permissions: r.permissions || []
});

export const roleService = {
  async getPermissions(): Promise<Permission[]> {
    const data = await apiFetch("/permissions");
    return data || [];
  },

  async getRoles(): Promise<Role[]> {
    const data = await apiFetch("/roles");
    return (data || []).map(mapRole);
  },

  async createRole(name: string, description: string): Promise<Role | null> {
    const data = await apiFetch("/roles", {
      method: "POST",
      body: JSON.stringify({ name, description })
    });

    return data ? mapRole(data) : null;
  },

  async updateRoleDetails(id: string, name: string, description: string): Promise<boolean> {
    await apiFetch(`/roles/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, description })
    });
    return true;
  },

  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<boolean> {
    await apiFetch(`/roles/${roleId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissions: permissionIds })
    });
    return true;
  },

  async deleteRole(id: string): Promise<boolean> {
    await apiFetch(`/roles/${id}`, { method: "DELETE" });
    return true;
  }
};
