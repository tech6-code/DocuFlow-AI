import { apiFetch } from "./apiClient";
import { SalesSettingItem, SalesSettings } from "../types";

export type FieldType = "text" | "textarea" | "number" | "date" | "dropdown" | "radio" | "checkbox";

export interface CustomField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  module: "leads" | "deals" | "customers";
  sort_order?: number;
}

const STORAGE_KEY = "docuflow_sales_settings_extra";

const DEFAULT_EXTRA = {
  brands: [],
  leadOwners: [],
  services: ["VAT Filing", "Registration", "Audit", "Bookkeeping"],
  serviceClosedOptions: ["Yes", "No"],
  paymentStatusOptions: ["Paid", "Pending", "Overdue", "Partial"],
  customFields: [] as CustomField[]
};

export const salesSettingsService = {
  async getLeadSources(): Promise<SalesSettingItem[]> {
    return (await apiFetch("/sales-settings/lead_sources")) || [];
  },

  async addLeadSource(name: string): Promise<SalesSettingItem> {
    return apiFetch("/sales-settings/lead_sources", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  async updateLeadSource(id: string, name: string): Promise<SalesSettingItem> {
    return apiFetch(`/sales-settings/lead_sources/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    });
  },

  async deleteLeadSource(id: string): Promise<void> {
    await apiFetch(`/sales-settings/lead_sources/${id}`, { method: "DELETE" });
  },

  async getServicesRequired(): Promise<SalesSettingItem[]> {
    return (await apiFetch("/sales-settings/service_required")) || [];
  },

  async addServiceRequired(name: string): Promise<SalesSettingItem> {
    return apiFetch("/sales-settings/service_required", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  async updateServiceRequired(id: string, name: string): Promise<SalesSettingItem> {
    return apiFetch(`/sales-settings/service_required/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    });
  },

  async deleteServiceRequired(id: string): Promise<void> {
    await apiFetch(`/sales-settings/service_required/${id}`, { method: "DELETE" });
  },

  async getLeadQualifications(): Promise<SalesSettingItem[]> {
    return (await apiFetch("/sales-settings/lead_qualifications")) || [];
  },

  async addLeadQualification(name: string): Promise<SalesSettingItem> {
    return apiFetch("/sales-settings/lead_qualifications", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  async updateLeadQualification(id: string, name: string): Promise<SalesSettingItem> {
    return apiFetch(`/sales-settings/lead_qualifications/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    });
  },

  async deleteLeadQualification(id: string): Promise<void> {
    await apiFetch(`/sales-settings/lead_qualifications/${id}`, { method: "DELETE" });
  },

  async getBrands(): Promise<SalesSettingItem[]> {
    return (await apiFetch("/sales-settings/brands")) || [];
  },

  async addBrand(name: string): Promise<SalesSettingItem> {
    return apiFetch("/sales-settings/brands", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  async updateBrand(id: string, name: string): Promise<SalesSettingItem> {
    return apiFetch(`/sales-settings/brands/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    });
  },

  async deleteBrand(id: string): Promise<void> {
    await apiFetch(`/sales-settings/brands/${id}`, { method: "DELETE" });
  },

  async getLeadOwners(): Promise<SalesSettingItem[]> {
    return (await apiFetch("/sales-settings/lead_owners")) || [];
  },

  async addLeadOwner(name: string): Promise<SalesSettingItem> {
    return apiFetch("/sales-settings/lead_owners", {
      method: "POST",
      body: JSON.stringify({ name })
    });
  },

  async updateLeadOwner(id: string, name: string): Promise<SalesSettingItem> {
    return apiFetch(`/sales-settings/lead_owners/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    });
  },

  async deleteLeadOwner(id: string): Promise<void> {
    await apiFetch(`/sales-settings/lead_owners/${id}`, { method: "DELETE" });
  },

  async getCustomFields(module: "leads" | "deals" | "customers" = "leads"): Promise<CustomField[]> {
    const data = await apiFetch(`/sales-settings/custom-fields?module=${encodeURIComponent(module)}`);
    return data || [];
  },

  async addCustomField(field: Omit<CustomField, "id">): Promise<CustomField> {
    return apiFetch("/sales-settings/custom-fields", {
      method: "POST",
      body: JSON.stringify(field)
    });
  },

  async updateCustomField(id: string, field: Partial<CustomField>): Promise<CustomField> {
    return apiFetch(`/sales-settings/custom-fields/${id}`, {
      method: "PUT",
      body: JSON.stringify(field)
    });
  },

  async deleteCustomField(id: string): Promise<void> {
    await apiFetch(`/sales-settings/custom-fields/${id}`, { method: "DELETE" });
  },

  getExtraSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const extra = stored ? JSON.parse(stored) : {};
      return {
        ...DEFAULT_EXTRA,
        ...extra,
        brands: [],
        leadOwners: [],
        customFields: []
      };
    } catch (e) {
      return DEFAULT_EXTRA;
    }
  },

  saveExtraSettings(settings: any) {
    const { customFields, ...rest } = settings;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  }
};
