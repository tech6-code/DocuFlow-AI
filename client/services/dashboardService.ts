import { apiFetch } from "./apiClient";
import type { DashboardAppliedFilters, DashboardSummary } from "../types";

export type DashboardFilterParams = Partial<DashboardAppliedFilters>;

export const dashboardService = {
  async getSummary(filters?: DashboardFilterParams): Promise<DashboardSummary> {
    const params = new URLSearchParams();
    if (filters?.month) params.set("month", String(filters.month));
    if (filters?.year) params.set("year", String(filters.year));
    if (filters?.filingType && filters.filingType !== "all") params.set("filingType", filters.filingType);
    if (filters?.departmentId) params.set("departmentId", filters.departmentId);
    if (filters?.userId) params.set("userId", filters.userId);
    const qs = params.toString();
    return apiFetch(`/dashboard/summary${qs ? `?${qs}` : ""}`);
  }
};
