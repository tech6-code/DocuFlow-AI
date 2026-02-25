import { apiFetch, getAccessToken, API_BASE } from "./apiClient";
import { CtType, CtFilingPeriod } from "../types";

export const ctFilingService = {
  async getCtTypes(): Promise<CtType[]> {
    const data = await apiFetch("/ct/types");
    return data || [];
  },

  async getFilingPeriods(customerId: string, ctTypeId: string): Promise<CtFilingPeriod[]> {
    const data = await apiFetch(`/ct/filing-periods?customerId=${encodeURIComponent(customerId)}&ctTypeId=${encodeURIComponent(ctTypeId)}`);
    return data || [];
  },

  async addFilingPeriod(period: Omit<CtFilingPeriod, "id" | "createdAt">): Promise<CtFilingPeriod | null> {
    const data = await apiFetch("/ct/filing-periods", {
      method: "POST",
      body: JSON.stringify(period)
    });
    return data || null;
  },

  async getFilingPeriodById(periodId: string): Promise<CtFilingPeriod | null> {
    const data = await apiFetch(`/ct/filing-periods/${periodId}`);
    return data || null;
  },

  async deleteFilingPeriod(id: string): Promise<boolean> {
    await apiFetch(`/ct/filing-periods/${id}`, { method: "DELETE" });
    return true;
  },

  async updateFilingPeriod(id: string, updates: Partial<CtFilingPeriod>): Promise<CtFilingPeriod | null> {
    const data = await apiFetch(`/ct/filing-periods/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    return data || null;
  },

  async downloadPdf(payload: any): Promise<Blob> {
    const token = getAccessToken();
    const headers: any = {
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/ct/download-pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Failed to generate PDF");
    }

    return await res.blob();
  },

  async downloadFinalStepPdf(payload: any): Promise<Blob> {
    const token = getAccessToken();
    const headers: any = {
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/ct/download-final-step-pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Failed to generate final step PDF");
    }

    return await res.blob();
  },

  async downloadLouPdf(payload: any): Promise<Blob> {
    const token = getAccessToken();
    const headers: any = {
      "Content-Type": "application/json"
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/ct/download-lou-pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "Failed to generate LOU PDF");
    }

    return await res.blob();
  },

  async updateTrialBalanceExcel(payload: {
    excelFile: File;
    pdfJson: any;
    sheetName?: string;
    dryRun?: boolean;
  }): Promise<any> {
    const formData = new FormData();
    formData.append("excel", payload.excelFile);
    formData.append("pdfJson", JSON.stringify(payload.pdfJson));
    if (payload.sheetName) formData.append("sheetName", payload.sheetName);
    if (payload.dryRun) formData.append("dryRun", "true");

    return apiFetch("/trial-balance/update-excel", {
      method: "POST",
      body: formData
    });
  },

  async saveStepData(payload: {
    conversionId: string;
    stepNumber: number;
    stepKey: string;
    data: any;
    status: "draft" | "completed" | "submitted";
  }): Promise<any> {
    return apiFetch("/ct-workflow/upsert", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async getWorkflowData(conversionId: string): Promise<any> {
    return apiFetch(`/ct-workflow/conversions/${encodeURIComponent(conversionId)}`);
  },

  async listConversions(periodId: string, ctTypeId: string): Promise<any[]> {
    return apiFetch(`/ct-workflow/list?periodId=${encodeURIComponent(periodId)}&ctTypeId=${encodeURIComponent(ctTypeId)}`);
  },

  async createConversion(payload: {
    customerId: string;
    ctTypeId: string;
    periodId: string;
  }): Promise<any> {
    return apiFetch("/ct-workflow/conversions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },

  async updateConversionStatus(conversionId: string, status: string): Promise<any> {
    return apiFetch(`/ct-workflow/conversions/${conversionId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  },

  async deleteConversion(conversionId: string): Promise<boolean> {
    await apiFetch(`/ct-workflow/conversions/${conversionId}`, {
      method: "DELETE"
    });
    return true;
  }
};
