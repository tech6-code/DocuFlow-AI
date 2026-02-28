import { apiFetch } from "./apiClient";
import type { VatFilingPeriod, VatFilingConversion } from "../types";

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

  async listConversions(periodId: string): Promise<VatFilingConversion[]> {
    const data = await apiFetch(`/vat/conversions?periodId=${encodeURIComponent(periodId)}`);
    return data || [];
  },

  async createConversion(payload: {
    customerId: string;
    periodId: string;
    conversionName?: string;
    status?: string;
    data: Record<string, any>;
  }): Promise<VatFilingConversion | null> {
    const data = await apiFetch("/vat/conversions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return data || null;
  },

  async getConversionById(id: string): Promise<VatFilingConversion | null> {
    const data = await apiFetch(`/vat/conversions/${encodeURIComponent(id)}`);
    return data || null;
  },

  async updateConversion(
    id: string,
    updates: Partial<Pick<VatFilingConversion, "conversionName" | "status" | "data">>
  ): Promise<VatFilingConversion | null> {
    const data = await apiFetch(`/vat/conversions/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    return data || null;
  },

  async deleteConversion(id: string): Promise<boolean> {
    await apiFetch(`/vat/conversions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return true;
  },
};
