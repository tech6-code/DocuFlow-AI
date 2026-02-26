import { apiFetch } from "./apiClient";
import type { VatFilingPeriod } from "../types";

export const vatFilingService = {
  async getFilingPeriods(customerId: string): Promise<VatFilingPeriod[]> {
    const data = await apiFetch(`/vat/filing-periods?customerId=${encodeURIComponent(customerId)}`);
    return data || [];
  },

  async addFilingPeriod(period: Omit<VatFilingPeriod, "id" | "createdAt" | "updatedAt">): Promise<VatFilingPeriod | null> {
    const data = await apiFetch("/vat/filing-periods", {
      method: "POST",
      body: JSON.stringify(period),
    });
    return data || null;
  },

  async getFilingPeriodById(id: string): Promise<VatFilingPeriod | null> {
    const data = await apiFetch(`/vat/filing-periods/${encodeURIComponent(id)}`);
    return data || null;
  },

  async updateFilingPeriod(id: string, updates: Partial<VatFilingPeriod>): Promise<VatFilingPeriod | null> {
    const data = await apiFetch(`/vat/filing-periods/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return data || null;
  },

  async deleteFilingPeriod(id: string): Promise<boolean> {
    await apiFetch(`/vat/filing-periods/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return true;
  },
};
