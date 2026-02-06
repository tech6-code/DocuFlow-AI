import { apiFetch, getAccessToken, API_BASE } from "./apiClient";
import { CtType, CtFilingPeriod } from "../types";

type Type1BatchSummaryPayload = {
  openingBalance?: number | null;
  closingBalance?: number | null;
  totalCount?: number | null;
  uncategorizedCount?: number | null;
  currency?: string | null;
  summaryJson?: any;
};

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

  async createType1Batch(payload: {
    projectId: string;
    createdBy?: string | null;
    files?: Array<{
      filename: string;
      storagePath?: string | null;
      pages?: number | null;
      passwordUsed?: boolean | null;
      summary?: any;
    }>;
    summary?: Type1BatchSummaryPayload;
  }): Promise<{ batchId: string; files: { id: string; filename: string }[] }> {
    const data = await apiFetch("/ct/type1/step1/batch", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return data as { batchId: string; files: { id: string; filename: string }[] };
  },

  async upsertType1Transactions(payload: {
    batchId: string;
    projectId: string;
    rows: Array<{
      fileId?: string | null;
      rowIndex: number;
      txnDate?: string;
      description?: string;
      debit?: number;
      credit?: number;
      currency?: string;
      category?: string;
      rawJson?: any;
    }>;
  }): Promise<{ ok: boolean; count: number }> {
    const data = await apiFetch("/ct/type1/step1/transactions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return data as { ok: boolean; count: number };
  },

  async deleteType1Transactions(payload: {
    batchId: string;
    rows: Array<{ fileId: string; rowIndex: number }>;
  }): Promise<{ ok: boolean; count: number }> {
    const data = await apiFetch("/ct/type1/step1/transactions/delete", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    return data as { ok: boolean; count: number };
  },

  async completeType1Batch(batchId: string, summary?: Type1BatchSummaryPayload): Promise<boolean> {
    await apiFetch(`/ct/type1/step1/batch/${batchId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", summary })
    });
    return true;
  },

  async getType1LatestBatch(projectId: string): Promise<any> {
    const data = await apiFetch(`/ct/type1/step1/latest?projectId=${encodeURIComponent(projectId)}`);
    return data;
  },

  async getType1Transactions(params: {
    batchId?: string;
    projectId?: string;
    fileId?: string;
    category?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: any[]; page: number; limit: number; total: number; uncategorizedCount: number }> {
    const q = new URLSearchParams();
    if (params.batchId) q.set("batchId", params.batchId);
    if (params.projectId) q.set("projectId", params.projectId);
    if (params.fileId) q.set("fileId", params.fileId);
    if (params.category) q.set("category", params.category);
    if (params.search) q.set("search", params.search);
    if (params.page) q.set("page", String(params.page));
    if (params.limit) q.set("limit", String(params.limit));
    const data = await apiFetch(`/ct/type1/step1/transactions?${q.toString()}`);
    return data;
  },

  async startOverType1Batch(batchId: string): Promise<boolean> {
    await apiFetch(`/ct/type1/step1/batch/${batchId}/start-over`, { method: "POST" });
    return true;
  }
};
