import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { applyLocalRules } from "../ai/geminiService.js";

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Normalize a transaction description into a matchable pattern.
 * Strips reference numbers, dates, amounts, UUIDs, and collapses whitespace.
 */
export const normalizeDescription = (desc: string): string => {
  return desc
    .toLowerCase()
    // Remove common bank transaction type abbreviations (TRKN, TRAN, TRN, TRXN, TXKN, PRKN, etc.)
    // These vary between OCR runs and bank formats but carry no categorization value
    .replace(/\b(trkn|tran|trxn|txkn|prkn|trsn)\b[.:]?/gi, "")
    // Remove reference numbers like REF:123456, TXN:ABC123, /REF/123
    .replace(/\b(ref|txn|trn|rrn|utr|arn|irn)[:\s#/]*[a-z0-9-]+/gi, "")
    // Remove T/T (telegraphic transfer) abbreviation
    .replace(/\bt\/t\b/gi, "")
    // Remove date patterns (dd/mm/yyyy, yyyy-mm-dd, dd-mm-yy, etc.)
    .replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}\b/g, "")
    // Remove ALL standalone numbers (amounts, IDs, short refs like 100, 24)
    .replace(/\b\d+\b/g, "")
    // Remove alphanumeric reference numbers (mixed letters+digits, 8+ chars like e66750d1061264003)
    .replace(/\b[a-z0-9]*\d[a-z0-9]*[a-z][a-z0-9]*\b/gi, (match) => match.length >= 8 && /\d/.test(match) && /[a-z]/i.test(match) ? "" : match)
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
 * Uses "contains" type for all patterns — matching is done via token-overlap in matchLearnedRules.
 */
const extractPattern = (description: string): { pattern: string; patternType: "exact" | "contains" | "prefix" } => {
  const matchNorm = normalizeForMatching(description);
  if (!matchNorm || matchNorm.length < 3) {
    return { pattern: matchNorm, patternType: "contains" };
  }

  const words = matchNorm.split(" ");
  if (words.length <= 4) {
    // Short descriptions → use all meaningful words as the pattern
    return { pattern: matchNorm, patternType: "contains" };
  }

  // Take the first 5 meaningful words for longer descriptions (more specificity)
  const pattern = words.slice(0, 5).join(" ");
  return { pattern, patternType: "contains" };
};

/**
 * Match a transaction description against learned rules using TWO-LAYER matching:
 *
 * LAYER 1 — Description match (highest confidence):
 *   Normalize the incoming description and compare against stored normalized descriptions.
 *   If the normalized description matches exactly, it's the same transaction type — use it.
 *
 * LAYER 2 — Token-overlap match (fuzzy fallback):
 *   ALL tokens in the stored pattern must appear in the transaction description.
 *   Most specific match (most tokens) wins. Ties broken by times_applied.
 *
 * This two-layer approach ensures:
 *   - Same descriptions always get the same category (Layer 1)
 *   - Similar descriptions with variations still match (Layer 2)
 */
export const matchLearnedRules = (
  transactions: any[],
  rules: Array<{ description?: string; pattern: string; pattern_type: string; category: string; direction: string | null; times_applied: number }>
): any[] => {
  if (!rules || rules.length === 0) return transactions;

  // Pre-compute: normalize descriptions and patterns, tokenize patterns
  const preparedRules = rules.map(rule => {
    const normalizedDesc = rule.description ? normalizeForMatching(rule.description) : null;
    const normalizedPattern = normalizeForMatching(rule.pattern);
    const tokens = normalizedPattern ? normalizedPattern.split(" ").filter(t => t.length >= 2) : [];
    return { ...rule, _normalizedDesc: normalizedDesc, _tokens: tokens, _normalizedPattern: normalizedPattern };
  });

  // Build a description→rule lookup for Layer 1 (fast O(1) matching)
  // If multiple rules match the same description, pick highest priority (customer > user > global, then times_applied)
  const descriptionMap = new Map<string, typeof preparedRules[0]>();
  for (const rule of preparedRules) {
    if (!rule._normalizedDesc) continue;
    const key = `${rule._normalizedDesc}|${rule.direction || "__any__"}`;
    const existing = descriptionMap.get(key);
    if (!existing || (rule.times_applied || 0) > (existing.times_applied || 0)) {
      descriptionMap.set(key, rule);
    }
  }

  return transactions.map((t) => {
    const isUncategorized = !t.category || t.category.toUpperCase().includes("UNCATEGORIZED");
    if (!isUncategorized) return t;

    const matchNorm = normalizeForMatching(t.description || "");
    if (!matchNorm) return t;

    const isCredit = (t.credit || 0) > 0 && (t.credit || 0) > (t.debit || 0);
    const dirKey = isCredit ? "credit" : "debit";

    // ──── LAYER 1: Exact normalized description match (highest confidence) ────
    // Try direction-specific first, then direction-agnostic
    const descMatch =
      descriptionMap.get(`${matchNorm}|${dirKey}`) ||
      descriptionMap.get(`${matchNorm}|__any__`);

    if (descMatch) {
      // Direction validation
      const dirOk = !descMatch.direction ||
        (descMatch.direction === "debit" && !isCredit) ||
        (descMatch.direction === "credit" && isCredit);
      if (dirOk) {
        return { ...t, category: descMatch.category, _learnedRule: true };
      }
    }

    // ──── LAYER 2: Token-overlap pattern match (fuzzy fallback) ────
    const descTokens = new Set(matchNorm.split(" "));

    let bestRule: typeof preparedRules[0] | null = null;
    let bestScore = 0;

    for (const rule of preparedRules) {
      if (rule._tokens.length === 0) continue;

      // Direction check
      if (rule.direction === "debit" && isCredit) continue;
      if (rule.direction === "credit" && !isCredit) continue;

      // Token-overlap: ALL pattern tokens must exist in description
      const matchedCount = rule._tokens.filter(token => descTokens.has(token)).length;
      if (matchedCount < rule._tokens.length) continue;

      // Score by specificity: more matched tokens = more specific = better
      if (
        matchedCount > bestScore ||
        (matchedCount === bestScore && (!bestRule || (rule.times_applied || 0) > (bestRule.times_applied || 0)))
      ) {
        bestRule = rule;
        bestScore = matchedCount;
      }
    }

    if (bestRule) {
      return { ...t, category: bestRule.category, _learnedRule: true };
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
    const upsertRule = async (ruleUserId: string, ruleCustomerId: string | null, pattern: string, patternType: string, category: string, direction: string | null, source: string, originalDescription?: string) => {
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
        const updateData: any = {
          category,
          times_applied: (existing.times_applied || 0) + 1,
          active: true,
          updated_at: new Date().toISOString(),
        };
        // Update description if provided and not already set
        if (originalDescription) updateData.description = originalDescription;
        await supabaseAdmin
          .from("categorization_rules")
          .update(updateData)
          .eq("id", existing.id);
      } else {
        // Insert new rule with original description
        await supabaseAdmin.from("categorization_rules").insert({
          user_id: ruleUserId,
          customer_id: ruleCustomerId,
          description: originalDescription || null,
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
      // Normalize the original description for high-confidence matching
      const normalizedDesc = normalizeForMatching(description);

      // 1) Save GLOBAL rule (shared across all users and customers)
      await upsertRule(GLOBAL_USER_ID, null, pattern, patternType, category, dir, src, normalizedDesc);

      // 2) Save user+customer-specific rule (for priority override)
      if (customerId) {
        await upsertRule(userId, customerId, pattern, patternType, category, dir, src, normalizedDesc);
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

    // PRIORITY ORDER: DB learned rules FIRST (user's explicit corrections),
    // then LOCAL_RULES for remaining uncategorized (hardcoded keyword fallback).
    // User corrections always take priority over hardcoded rules.

    // Step 1: Apply LEARNED_RULES from DB (highest priority — user's saved corrections)
    const userFilter = `user_id.eq.${GLOBAL_USER_ID},user_id.eq.${userId}`;
    let query = supabaseAdmin
      .from("categorization_rules")
      .select("description, pattern, pattern_type, category, direction, times_applied, user_id, customer_id")
      .or(userFilter)
      .eq("active", true)
      .order("times_applied", { ascending: false });

    if (customerId) {
      query = query.or(`customer_id.eq.${customerId},customer_id.is.null`);
    } else {
      query = query.is("customer_id", null);
    }

    const { data: rawRules, error } = await query;
    const rules = deduplicateRules(rawRules || [], userId, customerId);

    let afterLearned = transactions;
    let learnedApplied = 0;
    if (!error && rules && rules.length > 0) {
      afterLearned = matchLearnedRules(transactions, rules);
      learnedApplied = afterLearned.filter((t: any) => t._learnedRule).length;
    } else if (error) {
      console.error("Error fetching categorization rules:", error);
    }

    // Step 2: Apply LOCAL_RULES for remaining uncategorized (keyword fallback)
    const afterLocal = applyLocalRules(afterLearned);
    let localApplied = 0;
    afterLocal.forEach((t: any, i: number) => {
      const wasCategorized = afterLearned[i]?.category && !afterLearned[i].category.toUpperCase().includes('UNCATEGORIZED');
      if (!wasCategorized && t.category && !t.category.toUpperCase().includes('UNCATEGORIZED')) {
        localApplied++;
      }
    });

    const result = afterLocal;
    const appliedCount = learnedApplied + localApplied;

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
