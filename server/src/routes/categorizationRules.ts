import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize a transaction description into a matchable pattern.
 * Strips reference numbers, dates, amounts, UUIDs, and collapses whitespace.
 */
export const normalizeDescription = (desc: string): string => {
  return desc
    .toLowerCase()
    // Remove reference numbers like REF:123456, TXN:ABC123, /REF/123
    .replace(/\b(ref|txn|trn|rrn|utr|arn|irn)[:\s#/]*[a-z0-9-]+/gi, "")
    // Remove date patterns (dd/mm/yyyy, yyyy-mm-dd, dd-mm-yy, etc.)
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, "")
    // Remove standalone numbers (amounts, IDs) of 4+ digits
    .replace(/\b\d{4,}\b/g, "")
    // Remove UUIDs
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
    // Remove currency symbols and amounts like AED 500.00
    .replace(/\b(aed|usd|eur|gbp|inr)\s*[\d,.]+/gi, "")
    // Collapse whitespace and trim
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Normalize a description for matching: strips short words (< 2 chars) so
 * patterns extracted from one description match future similar ones reliably.
 * e.g. "b/o 1765 group insignia" → normalizeDescription → "b o group insignia"
 *      → normalizeForMatching → "group insignia"
 */
const normalizeForMatching = (desc: string): string => {
  const normalized = normalizeDescription(desc);
  return normalized.split(" ").filter(w => w.length >= 2).join(" ");
};

/**
 * Extract a pattern and type from a normalized description.
 * Returns the best pattern for matching future similar transactions.
 */
const extractPattern = (description: string): { pattern: string; patternType: "exact" | "contains" | "prefix" } => {
  const matchNorm = normalizeForMatching(description);
  if (!matchNorm || matchNorm.length < 3) {
    return { pattern: matchNorm, patternType: "exact" };
  }

  const words = matchNorm.split(" ");
  if (words.length <= 3) {
    // Short descriptions → exact match on meaningful words
    return { pattern: matchNorm, patternType: "exact" };
  }

  // Take the first 4 meaningful words as a prefix pattern
  const prefix = words.slice(0, 4).join(" ");
  return { pattern: prefix, patternType: "prefix" };
};

/**
 * Match a transaction description against a set of learned rules.
 */
export const matchLearnedRules = (
  transactions: any[],
  rules: Array<{ pattern: string; pattern_type: string; category: string; direction: string | null; times_applied: number }>
): any[] => {
  if (!rules || rules.length === 0) return transactions;

  // Sort rules: higher times_applied = higher priority, exact > prefix > contains
  const typeOrder: Record<string, number> = { exact: 0, prefix: 1, contains: 2 };
  const sortedRules = [...rules].sort((a, b) => {
    const typeDiff = (typeOrder[a.pattern_type] ?? 3) - (typeOrder[b.pattern_type] ?? 3);
    if (typeDiff !== 0) return typeDiff;
    return (b.times_applied || 0) - (a.times_applied || 0);
  });

  return transactions.map((t) => {
    const isUncategorized = !t.category || t.category.toUpperCase().includes("UNCATEGORIZED");
    if (!isUncategorized) return t;

    // Use normalizeForMatching (strips short words) so it matches the same way patterns were extracted
    const matchNorm = normalizeForMatching(t.description || "");
    if (!matchNorm) return t;

    const isCredit = (t.credit || 0) > 0 && (t.credit || 0) > (t.debit || 0);

    for (const rule of sortedRules) {
      // Direction check
      if (rule.direction === "debit" && isCredit) continue;
      if (rule.direction === "credit" && !isCredit) continue;

      let matched = false;
      if (rule.pattern_type === "exact") {
        matched = matchNorm === rule.pattern;
      } else if (rule.pattern_type === "prefix") {
        matched = matchNorm.startsWith(rule.pattern);
      } else {
        // contains
        matched = matchNorm.includes(rule.pattern);
      }

      if (matched) {
        return { ...t, category: rule.category, _learnedRule: true };
      }
    }
    return t;
  });
};

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /api/categorization-rules/learn
 * Save user corrections as learned rules.
 * Body: { corrections: [{ description, category, direction }], customerId?, userId? }
 */
router.post("/learn", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { corrections, customerId } = req.body;
    if (!Array.isArray(corrections) || corrections.length === 0) {
      return res.status(400).json({ error: "No corrections provided" });
    }

    let savedCount = 0;
    for (const correction of corrections) {
      const { description, category, direction, source } = correction;
      if (!description || !category) continue;

      const { pattern, patternType } = extractPattern(description);
      if (!pattern) continue;

      // Upsert: if same pattern exists, update category and increment count
      const { error } = await supabaseAdmin
        .from("categorization_rules")
        .upsert(
          {
            user_id: userId,
            customer_id: customerId || null,
            pattern,
            pattern_type: patternType,
            category,
            direction: direction || null,
            source: source || "user_correction",
            times_applied: 1,
            active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,customer_id,pattern,direction",
            ignoreDuplicates: false,
          }
        );

      if (error) {
        // If upsert fails due to unique constraint format, try update
        const { data: existing } = await supabaseAdmin
          .from("categorization_rules")
          .select("id, times_applied")
          .eq("user_id", userId)
          .eq("pattern", pattern)
          .is("customer_id", customerId || null)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin
            .from("categorization_rules")
            .update({
              category,
              direction: direction || null,
              times_applied: (existing.times_applied || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabaseAdmin.from("categorization_rules").insert({
            user_id: userId,
            customer_id: customerId || null,
            pattern,
            pattern_type: patternType,
            category,
            direction: direction || null,
            source: source || "user_correction",
            times_applied: 1,
            active: true,
          });
        }
      }
      savedCount++;
    }

    res.json({ success: true, savedCount });
  } catch (err: any) {
    console.error("Error saving categorization rules:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/**
 * POST /api/categorization-rules/apply
 * Apply learned rules to a batch of transactions.
 * Body: { transactions: Transaction[], customerId? }
 */
router.post("/apply", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { transactions, customerId } = req.body;
    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: "transactions must be an array" });
    }

    // Fetch learned rules: customer-specific first, then user-global
    let query = supabaseAdmin
      .from("categorization_rules")
      .select("pattern, pattern_type, category, direction, times_applied")
      .eq("user_id", userId)
      .eq("active", true)
      .order("times_applied", { ascending: false });

    if (customerId) {
      query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
    } else {
      query = query.is("customer_id", null);
    }

    const { data: rules, error } = await query;
    if (error) {
      console.error("Error fetching categorization rules:", error);
      return res.json({ transactions }); // fallback: return unchanged
    }

    const result = matchLearnedRules(transactions, rules || []);
    const appliedCount = result.filter((t: any) => t._learnedRule).length;

    // Clean up the _learnedRule marker before returning
    const cleaned = result.map((t: any) => {
      const { _learnedRule, ...rest } = t;
      return rest;
    });

    res.json({ transactions: cleaned, appliedCount });
  } catch (err: any) {
    console.error("Error applying categorization rules:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/**
 * GET /api/categorization-rules?customerId=X
 * List all learned rules for the current user.
 */
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const customerId = req.query.customerId as string | undefined;

    let query = supabaseAdmin
      .from("categorization_rules")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .order("times_applied", { ascending: false });

    if (customerId) {
      query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ rules: data || [] });
  } catch (err: any) {
    console.error("Error fetching categorization rules:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/**
 * DELETE /api/categorization-rules/:id
 * Soft-delete a learned rule.
 */
router.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.auth?.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("categorization_rules")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting categorization rule:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
