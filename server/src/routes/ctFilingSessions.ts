import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

// Helper functions for data mapping
const mapSessionFromDb = (row: any) => ({
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    filingPeriodId: row.filing_period_id,
    status: row.status,
    currentStep: row.current_step,
    totalSteps: row.total_steps,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
});

const mapSessionToDb = (session: any) => ({
    company_id: session.companyId,
    customer_id: session.customerId,
    filing_period_id: session.filingPeriodId,
    status: session.status,
    current_step: session.currentStep,
    total_steps: session.totalSteps,
    metadata: session.metadata || {}
});

// ============================================================================
// CT FILING SESSIONS
// ============================================================================

// Get all sessions with optional filters
router.get("/sessions", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { companyId, customerId, removed_field, filingPeriodId, status } = req.query;

    let query = supabaseAdmin.from("ct_filing_typetwo").select("*");

    if (companyId) query = query.eq("company_id", companyId);
    if (customerId) query = query.eq("customer_id", customerId);
    if (removed_field) query = query.eq("removed_field", removed_field);
    if (filingPeriodId) query = query.eq("filing_period_id", filingPeriodId);
    if (status) query = query.eq("status", status);

    query = query.order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) return res.status(500).json({ message: error.message });
    return res.json((data || []).map(mapSessionFromDb));
});

// Get single session by ID
router.get("/sessions/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
        .from("ct_filing_typetwo")
        .select("*")
        .eq("id", id)
        .single();

    if (error) return res.status(404).json({ message: error.message });
    return res.json(mapSessionFromDb(data));
});

// Create new session
router.post("/sessions", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const session = req.body || {};
    const { data, error } = await supabaseAdmin
        .from("ct_filing_typetwo")
        .insert([mapSessionToDb(session)])
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.status(201).json(mapSessionFromDb(data));
});

// Update session
router.put("/sessions/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { id } = req.params;
    const updates = req.body || {};

    const dbPayload: any = {};
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.currentStep !== undefined) dbPayload.current_step = updates.currentStep;
    if (updates.totalSteps !== undefined) dbPayload.total_steps = updates.totalSteps;
    if (updates.metadata !== undefined) dbPayload.metadata = updates.metadata;

    const { data, error } = await supabaseAdmin
        .from("ct_filing_typetwo")
        .update(dbPayload)
        .eq("id", id)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(mapSessionFromDb(data));
});

// Delete session
router.delete("/sessions/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("ct_filing_typetwo").delete().eq("id", id);
    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
});

// ============================================================================
// CT FILING STEP BALANCES
// ============================================================================

// Get balances for a specific step
router.get("/sessions/:sessionId/balances/:stepNumber", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId, stepNumber } = req.params;
    const { data, error } = await supabaseAdmin
        .from("ct_filing_step_balances")
        .select("*")
        .eq("ct_type_id", sessionId)
        .eq("step_number", stepNumber)
        .single();

    if (error) return res.status(404).json({ message: error.message });
    return res.json({
        id: data.id,
        sessionId: data.ct_type_id,
        stepNumber: data.step_number,
        stepName: data.step_name,
        openingBalance: parseFloat(data.opening_balance),
        closingBalance: parseFloat(data.closing_balance),
        totalCount: data.total_count,
        uncategorizedCount: data.uncategorized_count,
        filesCount: data.files_count,
        currency: data.currency,
        metadata: data.metadata,
        createdAt: data.created_at,
        updatedAt: data.updated_at
    });
});

// Save or update balances for a step
router.post("/sessions/:sessionId/balances", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId } = req.params;
    const balances = req.body || {};

    const payload = {
        ct_type_id: sessionId,
        step_number: balances.stepNumber,
        step_name: balances.stepName,
        opening_balance: balances.openingBalance || 0,
        closing_balance: balances.closingBalance || 0,
        total_count: balances.totalCount || 0,
        uncategorized_count: balances.uncategorizedCount || 0,
        files_count: balances.filesCount || 0,
        currency: balances.currency || 'AED',
        metadata: balances.metadata || {}
    };

    const { data, error } = await supabaseAdmin
        .from("ct_filing_step_balances")
        .upsert([payload], { onConflict: 'ct_type_id,step_number' })
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.status(201).json({
        id: data.id,
        sessionId: data.ct_type_id,
        stepNumber: data.step_number,
        stepName: data.step_name,
        openingBalance: parseFloat(data.opening_balance),
        closingBalance: parseFloat(data.closing_balance),
        totalCount: data.total_count,
        uncategorizedCount: data.uncategorized_count,
        filesCount: data.files_count,
        currency: data.currency,
        metadata: data.metadata
    });
});

// ============================================================================
// CT FILING TRANSACTIONS
// ============================================================================

// Get all transactions for a session
router.get("/sessions/:sessionId/transactions", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId } = req.params;
    const { data, error } = await supabaseAdmin
        .from("ct_filing_transactions")
        .select("*")
        .eq("ct_type_id", sessionId)
        .order("transaction_date", { ascending: true });

    if (error) return res.status(500).json({ message: error.message });
    return res.json((data || []).map(t => ({
        id: t.id,
        sessionId: t.ct_type_id,
        date: t.transaction_date,
        description: t.description,
        debit: parseFloat(t.debit),
        credit: parseFloat(t.credit),
        currency: t.currency,
        category: t.category,
        isCategorized: t.is_categorized,
        originalCategory: t.original_category,
        userModified: t.user_modified,
        metadata: t.metadata,
        confidence: t.metadata?.confidence || 0, // Map confidence
        sourceFile: t.metadata?.sourceFile || '', // Map sourceFile
        createdAt: t.created_at,
        updatedAt: t.updated_at
    })));
});

// Bulk save transactions
router.post("/sessions/:sessionId/transactions/bulk", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId } = req.params;
    const transactions = req.body.transactions || [];

    console.log(`[Backend] Saving ${transactions.length} transactions for session ${sessionId}`);

    // Helper to parse date
    const parseDate = (dateStr: any) => {
        try {
            if (!dateStr) return new Date().toISOString();
            if (dateStr instanceof Date) return dateStr.toISOString();

            if (typeof dateStr === 'string') {
                // Handle DD/MM/YYYY or D/M/YYYY
                if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(dateStr)) {
                    const parts = dateStr.split(/[\/\-\.]/);
                    // Month is 0-indexed in JS Date? No, in string YYYY-MM-DD it is 1-indexed.
                    // But strictly speaking, we want to return a string for Postgres or a valid ISO string.
                    // Let's format manually to YYYY-MM-DD to be safe for Postgres date column
                    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }

                // Try standard parsing
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) return d.toISOString();
            }

            console.warn(`[Backend] Invalid date format received: "${dateStr}". Fallback to NOW.`);
            return new Date().toISOString();
        } catch (e) {
            console.error(`[Backend] Error parsing date payload: ${dateStr}`, e);
            return new Date().toISOString();
        }
    };

    // Helper to normalize currency
    const allowedCurrencies = new Set(['AED', 'USD', 'EUR', 'GBP', 'SAR']);
    const normalizeCurrency = (curr: any) => {
        if (!curr) return 'AED';
        const up = String(curr).trim().toUpperCase();
        if (allowedCurrencies.has(up)) return up;
        console.warn(`[Backend] Invalid currency "${curr}" replaced with AED`);
        return 'AED';
    };

    try {
        const payload = transactions.map((t: any) => {
            let debit = typeof t.debit === 'number' ? t.debit : parseFloat(t.debit || 0);
            let credit = typeof t.credit === 'number' ? t.credit : parseFloat(t.credit || 0);

            // Ensure non-negative
            debit = Math.abs(debit);
            credit = Math.abs(credit);

            // Ensure mutual exclusivity (netting)
            if (debit > 0 && credit > 0) {
                const net = debit - credit;
                if (net > 0) {
                    debit = net;
                    credit = 0;
                } else {
                    debit = 0;
                    credit = Math.abs(net);
                }
            }

            const row = {
                ct_type_id: sessionId,
                transaction_date: parseDate(t.date),
                description: t.description || 'No Description',
                debit: debit,
                credit: credit,
                currency: normalizeCurrency(t.currency),
                category: t.category === null || t.category === undefined ? null : String(t.category), // Ensure string if present
                is_categorized: t.isCategorized === true || t.isCategorized === 'true', // Strict boolean handling
                original_category: t.originalCategory,
                user_modified: t.userModified === true || t.userModified === 'true',
                metadata: {
                    ...t.metadata,
                    confidence: t.confidence,
                    sourceFile: t.sourceFile,
                    originalCurrency: t.originalCurrency,
                    originalDebit: t.originalDebit,
                    originalCredit: t.originalCredit
                }
            };

            // Constraint Safety: is_categorized=true REQUIRES category to be present
            if (row.is_categorized && !row.category) {
                console.warn("[Backend] Transaction marked categorized but missing category. Forcing is_categorized=false.");
                row.is_categorized = false;
            }

            return row;
        });

        // validation: If payload is empty, we still proceed to clear existing if that's the intent, 
        // but typically mapped transactions should exist.

        // Strategy: Delete all then Insert. 
        // To be safe, we check if delete works.

        const { error: deleteError } = await supabaseAdmin
            .from("ct_filing_transactions")
            .delete()
            .eq("ct_type_id", sessionId);

        if (deleteError) {
            console.error("[Backend] Delete failed:", deleteError);
            return res.status(500).json({ message: "Failed to clear old transactions: " + deleteError.message });
        }

        if (payload.length > 0) {
            const { data, error: insertError } = await supabaseAdmin
                .from("ct_filing_transactions")
                .insert(payload)
                .select();

            if (insertError) {
                console.error("[Backend] Insert failed:", insertError);
                // CRITICAL: We deleted data but failed to insert! 
                // In production, we'd need a rollback. Here we just report error.
                return res.status(500).json({ message: "Failed to insert new transactions: " + insertError.message });
            }

            console.log(`[Backend] Successfully saved ${data?.length} transactions.`);
            return res.status(201).json({ count: data?.length || 0, transactions: data });
        }

        return res.status(200).json({ count: 0, transactions: [] });

    } catch (err: any) {
        console.error("[Backend] Unexpected error in saveTransactionsBulk:", err);
        return res.status(500).json({ message: "Unexpected error: " + err.message });
    }
});

// Update single transaction
router.put("/transactions/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { id } = req.params;
    const updates = req.body || {};

    const dbPayload: any = {};
    if (updates.date !== undefined) dbPayload.transaction_date = updates.date;
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.debit !== undefined) dbPayload.debit = updates.debit;
    if (updates.credit !== undefined) dbPayload.credit = updates.credit;
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.isCategorized !== undefined) dbPayload.is_categorized = updates.isCategorized;
    if (updates.userModified !== undefined) dbPayload.user_modified = updates.userModified;
    if (updates.metadata !== undefined) dbPayload.metadata = updates.metadata;

    const { data, error } = await supabaseAdmin
        .from("ct_filing_transactions")
        .update(dbPayload)
        .eq("id", id)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json({
        id: data.id,
        sessionId: data.ct_type_id,
        date: data.transaction_date,
        description: data.description,
        debit: parseFloat(data.debit),
        credit: parseFloat(data.credit),
        currency: data.currency,
        category: data.category,
        isCategorized: data.is_categorized,
        originalCategory: data.original_category,
        userModified: data.user_modified,
        metadata: data.metadata
    });
});

// Delete transaction
router.delete("/transactions/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from("ct_filing_transactions").delete().eq("id", id);
    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
});

// ============================================================================
// CT FILING STEP DATA
// ============================================================================

// Get step data
router.get("/sessions/:sessionId/step-data/:stepNumber", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId, stepNumber } = req.params;
    const { data, error } = await supabaseAdmin
        .from("ct_filing_step_data")
        .select("*")
        .eq("ct_type_id", sessionId)
        .eq("step_number", stepNumber)
        .single();

    if (error) return res.status(404).json({ message: error.message });
    return res.json({
        id: data.id,
        sessionId: data.ct_type_id,
        stepNumber: data.step_number,
        stepName: data.step_name,
        data: data.data,
        createdAt: data.created_at,
        updatedAt: data.updated_at
    });
});

// Save or update step data
router.post("/sessions/:sessionId/step-data", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId } = req.params;
    const stepData = req.body || {};

    const payload = {
        ct_type_id: sessionId,
        step_number: stepData.stepNumber,
        step_name: stepData.stepName,
        data: stepData.data || {}
    };

    const { data, error } = await supabaseAdmin
        .from("ct_filing_step_data")
        .upsert([payload], { onConflict: 'ct_type_id,step_number' })
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.status(201).json({
        id: data.id,
        sessionId: data.ct_type_id,
        stepNumber: data.step_number,
        stepName: data.step_name,
        data: data.data
    });
});

// ============================================================================
// DELETE ROUTES
// ============================================================================

// Delete balances for a specific step
router.delete("/sessions/:sessionId/balances/:stepNumber", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId, stepNumber } = req.params;
    const { error } = await supabaseAdmin
        .from("ct_filing_step_balances")
        .delete()
        .eq("ct_type_id", sessionId)
        .eq("step_number", stepNumber);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
});

// Delete single transaction
router.delete("/transactions/:id", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin
        .from("ct_filing_transactions")
        .delete()
        .eq("id", id);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
});

// Delete all transactions for a session
router.delete("/sessions/:sessionId/transactions", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId } = req.params;
    const { error } = await supabaseAdmin
        .from("ct_filing_transactions")
        .delete()
        .eq("ct_type_id", sessionId);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
});

// Delete step data
router.delete("/sessions/:sessionId/step-data/:stepNumber", requireAuth, requirePermission(["projects:view", "projects-ct-filing:view"]), async (req, res) => {
    const { sessionId, stepNumber } = req.params;
    const { error } = await supabaseAdmin
        .from("ct_filing_step_data")
        .delete()
        .eq("ct_type_id", sessionId)
        .eq("step_number", stepNumber);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
});

export default router;



