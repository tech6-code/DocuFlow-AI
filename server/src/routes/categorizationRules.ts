import { Router } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { applyLocalRules } from "../ai/geminiService.js";

const router = Router();

/**
 * POST /api/categorization-rules/apply
 * Apply LOCAL_RULES (keyword-based) to a batch of transactions.
 * Body: { transactions: Transaction[] }
 */
router.post("/apply", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { transactions } = req.body;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: "transactions must be an array" });
    }

    // Apply LOCAL_RULES for uncategorized transactions (keyword matching)
    const result = applyLocalRules(transactions);
    let appliedCount = 0;
    result.forEach((t: any, i: number) => {
      const wasCategorized = transactions[i]?.category && !transactions[i].category.toUpperCase().includes('UNCATEGORIZED');
      if (!wasCategorized && t.category && !t.category.toUpperCase().includes('UNCATEGORIZED')) {
        appliedCount++;
      }
    });

    res.json({ transactions: result, appliedCount });
  } catch (err: any) {
    console.error("Error applying categorization rules:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
