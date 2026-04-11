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

/**
 * Deduplicate rules by pattern+direction with priority: customer-specific > user-specific > global.
 * If the same pattern exists at multiple levels, keep the highest-priority one.
 */
const GLOBAL_USER_ID = "00000000-0000-0000-0000-000000000000";

const deduplicateRules = (
  rules: Array<{ pattern: string; pattern_type: string; category: string; direction: string | null; times_applied: number; user_id?: string; customer_id?: string | null }>,
  userId?: string,
  customerId?: string
) => {
  const seen = new Map<string, typeof rules[0]>();
  // Priority score: customer-specific(3) > user-specific(2) > global(1)
  const priority = (r: typeof rules[0]) => {
    if (r.customer_id && r.user_id !== GLOBAL_USER_ID) return 3; // customer-specific
    if (r.user_id && r.user_id !== GLOBAL_USER_ID) return 2;     // user-specific
    return 1;                                                      // global
  };

  for (const rule of rules) {
    const key = `${rule.pattern}|${rule.direction || '__any__'}`;
    const existing = seen.get(key);
    if (!existing || priority(rule) > priority(existing)) {
      seen.set(key, rule);
    }
  }
  return Array.from(seen.values());
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

    // Helper: upsert a single rule (insert or update times_applied + category)
    const upsertRule = async (ruleUserId: string, ruleCustomerId: string | null, pattern: string, patternType: string, category: string, direction: string | null, source: string) => {
      // Try to find existing rule
      let query = supabaseAdmin
        .from("categorization_rules")
        .select("id, times_applied, category")
        .eq("user_id", ruleUserId)
        .eq("pattern", pattern);

      if (ruleCustomerId) {
        query = query.eq("customer_id", ruleCustomerId);
      } else {
        query = query.is("customer_id", null);
      }
      if (direction) {
        query = query.eq("direction", direction);
      } else {
        query = query.is("direction", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        // Update: increment times_applied, update category if changed
        await supabaseAdmin
          .from("categorization_rules")
          .update({
            category,
            times_applied: (existing.times_applied || 0) + 1,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Insert new rule
        await supabaseAdmin.from("categorization_rules").insert({
          user_id: ruleUserId,
          customer_id: ruleCustomerId,
          pattern,
          pattern_type: patternType,
          category,
          direction,
          source,
          times_applied: 1,
          active: true,
        });
      }
    };

    let savedCount = 0;
    for (const correction of corrections) {
      const { description, category, direction, source } = correction;
      if (!description || !category) continue;

      const { pattern, patternType } = extractPattern(description);
      if (!pattern) continue;

      const dir = direction || null;
      const src = source || "user_correction";

      // 1) Save GLOBAL rule (shared across all users and customers)
      await upsertRule(GLOBAL_USER_ID, null, pattern, patternType, category, dir, src);

      // 2) Save user+customer-specific rule (for priority override)
      if (customerId) {
        await upsertRule(userId, customerId, pattern, patternType, category, dir, src);
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

    // Fetch learned rules: global + user-specific + customer-specific
    const userFilter = `user_id.eq.${GLOBAL_USER_ID},user_id.eq.${userId}`;
    let query = supabaseAdmin
      .from("categorization_rules")
      .select("pattern, pattern_type, category, direction, times_applied, user_id, customer_id")
      .or(userFilter)
      .eq("active", true)
      .order("times_applied", { ascending: false });

    if (customerId) {
      query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
    } else {
      query = query.is("customer_id", null);
    }

    const { data: rawRules, error } = await query;
    // Deduplicate: customer-specific > user-specific > global (by pattern+direction)
    const rules = deduplicateRules(rawRules || [], userId, customerId);
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

    // Fetch global + user-specific rules
    let query = supabaseAdmin
      .from("categorization_rules")
      .select("*")
      .or(`user_id.eq.${GLOBAL_USER_ID},user_id.eq.${userId}`)
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
      .or(`user_id.eq.${userId},user_id.eq.${GLOBAL_USER_ID}`);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting categorization rule:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

export default router;
