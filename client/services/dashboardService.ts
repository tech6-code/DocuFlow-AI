import { apiFetch } from "./apiClient";
import type { DashboardSummary } from "../types";

export const dashboardService = {
  async getSummary(): Promise<DashboardSummary> {
    return apiFetch("/dashboard/summary");
  }
};
