import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { handleAiAction } from "../ai/handlers";
import * as gemini from "../ai/geminiService";
import multer from "multer";
import { query } from "../lib/db";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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
  extractCorporateTaxCertificateData: ["projects-ct-filing:view"],
  extractOpeningBalanceData: ["projects-bookkeeping:view", "projects-vat-filing:view"],
};

async function enforcePermissions(req: AuthedRequest, res: Response, action: string) {
  const requiredPerms = actionPerms[action];
  if (!requiredPerms || !req.profile?.role_id) return true;

  const [role]: any = await query('SELECT name FROM roles WHERE id = ?', [req.profile.role_id]);

  if (role && role.name.toUpperCase() === "SUPER ADMIN") return true;

  const sql = `
       SELECT p.slug 
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = ?
    `;
  const rows: any = await query(sql, [req.profile.role_id]);
  const userSlugs = rows.map((r: any) => r.slug);

  const hasAccess = requiredPerms.some(slug => userSlugs.includes(slug));

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
