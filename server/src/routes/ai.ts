import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { handleAiAction } from "../ai/handlers";
import * as gemini from "../ai/geminiService";
import multer from "multer";
import { supabaseAdmin } from "../lib/supabase";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const actionPerms: Record<string, string[]> = {
  extractTransactionsFromImage: ["projects:view", "projects-bookkeeping:view", "projects-vat-filing:view", "projects-ct-filing:view", "projects-audit-report:view", "bank-statements:view"],
  extractInvoicesData: ["invoices-&-bills:upload", "projects-bookkeeping:view", "projects-vat-filing:view", "projects-ct-filing:view"],
  extractProjectDocuments: ["projects:view", "projects-registration:view", "projects-ct-filing:view", "projects-audit-report:view", "bank-statements:view"],
  analyzeTransactions: ["bank-statement-analysis:view", "projects-bookkeeping:view", "bank-statements:view"],
  categorizeTransactionsByCoA: ["projects-bookkeeping:view", "projects-vat-filing:view", "projects-ct-filing:view", "projects-audit-report:view", "bank-statements:view"],
  generateTrialBalance: ["projects-bookkeeping:view", "projects-ct-filing:view"],
  extractEmiratesIdData: ["emirates-id:upload", "customer-management:create", "customer-management:edit"],
  extractPassportData: ["passport:upload", "customer-management:create", "customer-management:edit"],
  extractVisaData: ["visa:upload", "customer-management:create", "customer-management:edit"],
  extractTradeLicenseData: ["trade-license:upload", "customer-management:create", "customer-management:edit"],
  extractVat201Totals: ["projects-vat-filing:view", "projects-ct-filing:view", "projects-audit-report:view", "bank-statements:view"],
  generateAuditReport: ["projects-audit-report:view"],
  generateLeadScore: ["sales:view", "sales-leads:view"],
  generateSalesEmail: ["sales:view", "sales-leads:view", "sales-deals:view"],
  analyzeDealProbability: ["sales:view", "sales-deals:view"],
  parseSmartNotes: ["sales:view", "sales-deals:view"],
  parseLeadSmartNotes: ["sales:view", "sales-leads:view"],
  generateDealScore: ["sales:view", "sales-deals:view"],
  extractCorporateTaxCertificateData: ["projects-ct-filing:view"],
  extractOpeningBalanceData: ["projects-bookkeeping:view", "projects-vat-filing:view", "projects-ct-filing:view", "projects-audit-report:view", "bank-statements:view"],
};

async function enforcePermissions(req: AuthedRequest, res: Response, action: string) {
  const requiredPerms = actionPerms[action];
  if (!requiredPerms || !req.profile?.role_id) return true;

  const { data: role } = await supabaseAdmin
    .from("roles")
    .select("name")
    .eq("id", req.profile.role_id)
    .single();

  if (role?.name?.toUpperCase() === "SUPER ADMIN") return true;

  const { data: rolePerms } = await supabaseAdmin
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", req.profile.role_id);

  const assignedIds = (rolePerms || []).map((p: any) => p.permission_id);
  const hasAccess = requiredPerms.some(id => assignedIds.includes(id));

  if (!hasAccess) {
    res.status(403).json({ message: `Insufficient permissions for action: ${action}` });
    return false;
  }

  return true;
}

router.post("/", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ message: "action is required" });

  const ok = await enforcePermissions(req, res, action);
  if (!ok) return;

  try {
    const result = await handleAiAction(action, payload || {});
    return res.json({ result });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "AI request failed" });
  }
});

router.post("/opening-balance-files", requireAuth, upload.array("files"), async (req: AuthedRequest, res: Response) => {
  const ok = await enforcePermissions(req, res, "extractOpeningBalanceData");
  if (!ok) return;

  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) return res.status(400).json({ message: "files are required" });

  try {
    const result = await gemini.extractOpeningBalanceDataFromFiles(
      files.map(f => ({ buffer: f.buffer, mimetype: f.mimetype, originalname: f.originalname }))
    );
    return res.json({ result });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "AI request failed" });
  }
});

export default router;
