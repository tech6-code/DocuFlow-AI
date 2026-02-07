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

  // ============================================================================
  // SESSION & DATA PERSISTENCE
  // ============================================================================

  async getSession(id: string): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${id}`);
    return data || null;
  },

  async findSessions(params: { customerId?: string; filingPeriodId?: string; status?: string }): Promise<any[]> {
    const query = new URLSearchParams(params as any).toString();
    const data = await apiFetch(`/ct-filing-typetwo/sessions?${query}`);
    return data || [];
  },

  async createSession(session: any): Promise<any | null> {
    const data = await apiFetch("/ct-filing-typetwo/sessions", {
      method: "POST",
      body: JSON.stringify(session)
    });
    return data || null;
  },

  async updateSession(id: string, updates: any): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    return data || null;
  },

  async getBalances(sessionId: string, stepNumber: number): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${sessionId}/balances/${stepNumber}`);
    return data || null;
  },

  async saveBalances(sessionId: string, balances: any): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${sessionId}/balances`, {
      method: "POST",
      body: JSON.stringify(balances)
    });
    return data || null;
  },

  async getTransactions(sessionId: string): Promise<any[]> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${sessionId}/transactions`);
    return data || [];
  },

  async saveTransactionsBulk(sessionId: string, transactions: any[]): Promise<any> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${sessionId}/transactions/bulk`, {
      method: "POST",
      body: JSON.stringify({ transactions })
    });
    return data;
  },

  async updateTransaction(id: string, updates: any): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/transactions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates)
    });
    return data || null;
  },

  async deleteTransaction(id: string): Promise<boolean> {
    await apiFetch(`/ct-filing-typetwo/transactions/${id}`, { method: "DELETE" });
    return true;
  },

  async getStepData(sessionId: string, stepNumber: number): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${sessionId}/step-data/${stepNumber}`);
    return data || null;
  },

  async saveStepData(sessionId: string, stepNumber: number, dataPayload: any): Promise<any | null> {
    const data = await apiFetch(`/ct-filing-typetwo/sessions/${sessionId}/step-data`, {
      method: "POST",
      body: JSON.stringify({
        stepNumber,
        stepName: "Generic Step Data", // You might want to make this dynamic if needed
        data: dataPayload
      })
    });
    return data || null;
  }
};
