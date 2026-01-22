import { apiFetch } from "./apiClient";
import type { Department } from "../types";

export const departmentService = {
  async getDepartments(): Promise<Department[]> {
    const data = await apiFetch("/departments");
    return data || [];
  },

  async createDepartment(name: string): Promise<Department | null> {
    const data = await apiFetch("/departments", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    return data || null;
  },

  async updateDepartment(department: Department): Promise<Department | null> {
    const data = await apiFetch(`/departments/${department.id}`, {
      method: "PUT",
      body: JSON.stringify({ name: department.name })
    });
    return data || null;
  },

  async deleteDepartment(id: string): Promise<boolean> {
    await apiFetch(`/departments/${id}`, { method: "DELETE" });
    return true;
  }
};
