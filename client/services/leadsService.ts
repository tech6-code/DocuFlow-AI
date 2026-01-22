import { apiFetch } from "./apiClient";
import { Lead } from "../types";

export const leadsService = {
  async getLeads(): Promise<Lead[]> {
    const data = await apiFetch("/leads");
    return data || [];
  },

  async deleteLead(id: string): Promise<boolean> {
    await apiFetch(`/leads/${id}`, { method: "DELETE" });
    return true;
  },

  async createLead(lead: Omit<Lead, "id"> & { userId: string }): Promise<Lead | null> {
    const data = await apiFetch("/leads", {
      method: "POST",
      body: JSON.stringify(lead)
    });
    return data || null;
  },

  async updateLead(lead: Lead): Promise<Lead | null> {
    const data = await apiFetch(`/leads/${lead.id}`, {
      method: "PUT",
      body: JSON.stringify(lead)
    });
    return data || null;
  }
};
