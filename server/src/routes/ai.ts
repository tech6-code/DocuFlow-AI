import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { handleAiAction } from "../ai/handlers";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();

router.post("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ message: "action is required" });

  // Map actions to required permissions
  const actionPerms: Record<string, string[]> = {
    extractTransactionsFromImage: ["projects:view", "projects-bookkeeping:view", "projects-vat-filing:view"],
    extractInvoicesData: ["invoices-&-bills:upload", "projects-bookkeeping:view", "projects-vat-filing:view"],
    extractProjectDocuments: ["projects:view", "projects-registration:view"],
    analyzeTransactions: ["bank-statement-analysis:view", "projects-bookkeeping:view"],
    categorizeTransactionsByCoA: ["projects-bookkeeping:view", "projects-vat-filing:view"],
    generateTrialBalance: ["projects-bookkeeping:view", "projects-ct-filing:view"],
    extractEmiratesIdData: ["emirates-id:upload", "customer-management:create", "customer-management:edit"],
    extractPassportData: ["passport:upload", "customer-management:create", "customer-management:edit"],
    extractVisaData: ["visa:upload", "customer-management:create", "customer-management:edit"],
    extractTradeLicenseData: ["trade-license:upload", "customer-management:create", "customer-management:edit"],
    extractVat201Totals: ["projects-vat-filing:view"],
    generateAuditReport: ["projects-audit-report:view"],
    generateLeadScore: ["sales:view", "sales-leads:view"],
    generateSalesEmail: ["sales:view", "sales-leads:view", "sales-deals:view"],
    analyzeDealProbability: ["sales:view", "sales-deals:view"],
    parseSmartNotes: ["sales:view", "sales-deals:view"],
    parseLeadSmartNotes: ["sales:view", "sales-leads:view"],
    generateDealScore: ["sales:view", "sales-deals:view"],
    extractCorporateTaxCertificateData: ["projects-ct-filing:view"]
  };

  const requiredPerms = actionPerms[action];

  // Permission Check (Manual logic similar to requirePermission middleware)
  if (requiredPerms && req.profile?.role_id) {
    const { data: role } = await supabaseAdmin
      .from("roles")
      .select("name")
      .eq("id", req.profile.role_id)
      .single();

    if (role?.name?.toUpperCase() !== "SUPER ADMIN") {
      const { data: rolePerms } = await supabaseAdmin
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", req.profile.role_id);

      const assignedIds = (rolePerms || []).map((p: any) => p.permission_id);
      const hasAccess = requiredPerms.some(id => assignedIds.includes(id));

      if (!hasAccess) {
        return res.status(403).json({ message: `Insufficient permissions for action: ${action}` });
      }
    }
  }

  try {
    const result = await handleAiAction(action, payload || {});
    return res.json({ result });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "AI request failed" });
  }
});

export default router;
