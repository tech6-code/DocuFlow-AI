import { apiFetch } from "./apiClient";
import { Deal, DealFollowUp, DealNote, DealDocument, DealHistoryItem } from "../types";

export const dealService = {
  async getDeals(): Promise<Deal[]> {
    const data = await apiFetch("/deals");
    return data || [];
  },

  async createDeal(deal: Omit<Deal, "id"> & { userId?: string }): Promise<Deal | null> {
    const data = await apiFetch("/deals", {
      method: "POST",
      body: JSON.stringify(deal)
    });
    return data || null;
  },

  async updateDeal(id: string, deal: Partial<Deal>): Promise<Deal | null> {
    const data = await apiFetch(`/deals/${id}`, {
      method: "PUT",
      body: JSON.stringify(deal)
    });
    return data || null;
  },

  async deleteDeal(id: string): Promise<boolean> {
    await apiFetch(`/deals/${id}`, { method: "DELETE" });
    return true;
  },

  async getDealFollowUps(dealId: string): Promise<DealFollowUp[]> {
    const data = await apiFetch(`/deals/${dealId}/followups`);
    return data || [];
  },

  async createDealFollowUp(followUp: Partial<DealFollowUp>, _userId: string): Promise<DealFollowUp | null> {
    const data = await apiFetch(`/deals/${followUp.dealId}/followups`, {
      method: "POST",
      body: JSON.stringify(followUp)
    });
    return data || null;
  },

  async updateDealFollowUp(id: string, followUp: Partial<DealFollowUp>, _userId: string): Promise<DealFollowUp | null> {
    const data = await apiFetch(`/deals/${followUp.dealId}/followups/${id}`, {
      method: "PUT",
      body: JSON.stringify(followUp)
    });
    return data || null;
  },

  async deleteDealFollowUp(id: string, dealId: string): Promise<boolean> {
    await apiFetch(`/deals/${dealId}/followups/${id}`, { method: "DELETE" });
    return true;
  },

  async getDealNotes(dealId: string): Promise<DealNote[]> {
    const data = await apiFetch(`/deals/${dealId}/notes`);
    return data || [];
  },

  async createDealNote(note: Partial<DealNote>, _userId: string): Promise<DealNote | null> {
    const data = await apiFetch(`/deals/${note.dealId}/notes`, {
      method: "POST",
      body: JSON.stringify(note)
    });
    return data || null;
  },

  async updateDealNote(id: string, note: Partial<DealNote>, _userId: string): Promise<DealNote | null> {
    const data = await apiFetch(`/deals/${note.dealId}/notes/${id}`, {
      method: "PUT",
      body: JSON.stringify(note)
    });
    return data || null;
  },

  async deleteDealNote(id: string, dealId: string): Promise<boolean> {
    await apiFetch(`/deals/${dealId}/notes/${id}`, { method: "DELETE" });
    return true;
  },

  async getDealDocuments(dealId: string): Promise<DealDocument[]> {
    const data = await apiFetch(`/deals/${dealId}/documents`);
    return data || [];
  },

  async uploadDealDocument(dealId: string, file: File, _userId: string): Promise<DealDocument | null> {
    const form = new FormData();
    form.append("document", file);

    const data = await apiFetch(`/deals/${dealId}/documents`, {
      method: "POST",
      body: form
    });

    return data || null;
  },

  async deleteDealDocument(id: string, filePath: string, dealId: string): Promise<boolean> {
    const query = filePath ? `?filePath=${encodeURIComponent(filePath)}` : "";
    await apiFetch(`/deals/${dealId}/documents/${id}${query}`, { method: "DELETE" });
    return true;
  },

  async getDealHistory(dealId: string): Promise<DealHistoryItem[]> {
    const data = await apiFetch(`/deals/${dealId}/history`);
    return data || [];
  }
};
