import { apiFetch } from "./apiClient";
import type { Customer, DocumentUploadPayload, CustomerDocument } from "../types";

export const customerService = {
  async getCustomers(): Promise<Customer[]> {
    const data = await apiFetch("/customers");
    return data || [];
  },

  async createCustomer(customer: Omit<Customer, "id" | "documents">, documents?: DocumentUploadPayload[]): Promise<Customer | null> {
    if (documents && documents.length > 0) {
      const form = new FormData();
      form.append("customer", JSON.stringify(customer));
      form.append("documentTypes", JSON.stringify(documents.map((d) => d.documentType)));
      documents.forEach((doc) => form.append("documents", doc.file));

      const data = await apiFetch("/customers", {
        method: "POST",
        body: form
      });
      return data || null;
    }

    const data = await apiFetch("/customers", {
      method: "POST",
      body: JSON.stringify(customer)
    });
    return data || null;
  },

  async updateCustomer(customer: Customer, newDocuments?: DocumentUploadPayload[]): Promise<Customer | null> {
    if (newDocuments && newDocuments.length > 0) {
      const form = new FormData();
      form.append("customer", JSON.stringify(customer));
      form.append("documentTypes", JSON.stringify(newDocuments.map((d) => d.documentType)));
      newDocuments.forEach((doc) => form.append("documents", doc.file));

      const data = await apiFetch(`/customers/${customer.id}`, {
        method: "PUT",
        body: form
      });
      return data || null;
    }

    const data = await apiFetch(`/customers/${customer.id}`, {
      method: "PUT",
      body: JSON.stringify(customer)
    });
    return data || null;
  },

  async deleteCustomer(id: string): Promise<boolean> {
    await apiFetch(`/customers/${id}`, { method: "DELETE" });
    return true;
  },

  async getCustomerDocuments(customerId: string): Promise<CustomerDocument[]> {
    const data = await apiFetch(`/customers/${customerId}/documents`);
    return data || [];
  }
};
