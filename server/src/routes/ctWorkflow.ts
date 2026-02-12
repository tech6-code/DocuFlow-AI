import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/ct-workflow/conversions/:conversionId
 * Fetches the specific conversion and all its associated steps.
 */
router.get("/conversions/:conversionId", requireAuth, async (req: AuthedRequest, res) => {
    const { conversionId } = req.params;
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Fetch the conversion first to check ownership
    const { data: conversion, error: convError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("id", conversionId)
        .maybeSingle();

    if (convError) return res.status(500).json({ message: convError.message });
    if (!conversion) return res.status(404).json({ message: "Workflow attempt not found" });

    // Authorization: Normal users only see their own conversions
    if (!isSuperAdmin && conversion.user_id !== user.id) {
        return res.status(403).json({ message: "You do not have permission to view this workflow" });
    }

    // Fetch all steps for this specific conversion
    const { data: steps, error: stepsError } = await supabaseAdmin
        .from("ct_workflow_data")
        .select("*")
        .eq("conversion_id", conversionId)
        .order("step_number", { ascending: true });

    if (stepsError) return res.status(500).json({ message: stepsError.message });

    return res.json({
        ...conversion,
        steps: steps || []
    });
});

/**
 * GET /api/ct-workflow/list
 * Lists all conversions for a specific period and CT type.
 */
router.get("/list", requireAuth, async (req: AuthedRequest, res) => {
    const { periodId, ctTypeId: rawCtTypeId } = req.query as { periodId?: string; ctTypeId?: string };

    if (!periodId || !rawCtTypeId) {
        return res.status(400).json({ message: "periodId and ctTypeId are required" });
    }

    const ctTypeId = await resolveCtTypeId(rawCtTypeId);
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    let query = supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("period_id", periodId)
        .eq("ct_type_id", ctTypeId);

    if (!isSuperAdmin) {
        query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    return res.json(data || []);
});

/**
 * POST /api/ct-workflow/conversions
 * Creates a new workflow attempt (conversion).
 */
router.post("/conversions", requireAuth, async (req: AuthedRequest, res) => {
    const { customerId, ctTypeId: rawCtTypeId, periodId } = req.body;

    if (!customerId || !rawCtTypeId || !periodId) {
        return res.status(400).json({ message: "customerId, ctTypeId, and periodId are required" });
    }

    const ctTypeId = await resolveCtTypeId(rawCtTypeId);
    const user = req.auth?.user;

    const payload = {
        user_id: user.id,
        customer_id: customerId,
        ct_type_id: ctTypeId,
        period_id: periodId,
        status: "draft"
    };

    const { data, error } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .insert(payload)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(data);
});

/**
 * POST /api/ct-workflow/upsert
 * Saves or updates a single step's data for a specific conversion.
 * Unique on (conversion_id, step_key).
 */
router.post("/upsert", requireAuth, async (req: AuthedRequest, res) => {
    const {
        conversionId,
        stepNumber,
        stepKey,
        data,
        status,
        // Optional extras for legacy compatibility or direct creation
        customerId,
        ctTypeId: rawCtTypeId,
        periodId
    } = req.body;

    if (!conversionId || !stepKey) {
        return res.status(400).json({ message: "conversionId and stepKey are required" });
    }

    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Verify conversion ownership
    const { data: conversion, error: convError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("id", conversionId)
        .maybeSingle();

    if (convError) return res.status(500).json({ message: convError.message });
    if (!conversion) return res.status(404).json({ message: "Workflow attempt not found" });

    if (!isSuperAdmin && conversion.user_id !== user.id) {
        return res.status(403).json({ message: "You do not have permission to update this workflow" });
    }

    const payload = {
        user_id: conversion.user_id,
        customer_id: conversion.customer_id,
        ct_type_id: conversion.ct_type_id,
        period_id: conversion.period_id,
        conversion_id: conversionId,
        step_number: stepNumber,
        step_key: stepKey,
        data: data || {},
        status: status || "draft",
        updated_at: new Date().toISOString()
    };

    const { data: upserted, error } = await supabaseAdmin
        .from("ct_workflow_data")
        .upsert(payload, { onConflict: "conversion_id,step_key" })
        .select()
        .single();

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    // Update parent filing period status to "In Progress" if it's currently "Not Started"
    const { data: period } = await supabaseAdmin
        .from("ct_filing_periods")
        .select("status")
        .eq("id", conversion.period_id)
        .maybeSingle();

    if (period && period.status !== "In Progress" && period.status !== "Submitted") {
        await supabaseAdmin
            .from("ct_filing_periods")
            .update({ status: "In Progress" })
            .eq("id", conversion.period_id);
    }

    return res.json(upserted);
});

/**
 * PATCH /api/ct-workflow/conversions/:conversionId/status
 * Updates the status of a full conversion attempt.
 */
router.patch("/conversions/:conversionId/status", requireAuth, async (req: AuthedRequest, res) => {
    const { conversionId } = req.params;
    const { status } = req.body;
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    const { data: existing } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("user_id")
        .eq("id", conversionId)
        .maybeSingle();

    if (!existing) return res.status(404).json({ message: "Conversion not found" });
    if (!isSuperAdmin && existing.user_id !== user.id) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    const { data, error } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", conversionId)
        .select()
        .single();

    if (error) return res.status(500).json({ message: error.message });

    // Sync status with parent filing period
    if (status === "submitted" || status === "completed") {
        await supabaseAdmin
            .from("ct_filing_periods")
            .update({ status: "Submitted" })
            .eq("id", data.period_id);
    } else if (status === "draft") {
        await supabaseAdmin
            .from("ct_filing_periods")
            .update({ status: "In Progress" })
            .eq("id", data.period_id);
    }

    return res.json(data);
});

/**
 * Helper to resolve ctTypeId from name if it is a number string.
 */
async function resolveCtTypeId(ctTypeId: string): Promise<string> {
    // If it's already a UUID, return it
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (uuidRegex.test(ctTypeId)) {
        return ctTypeId;
    }

    // Otherwise, try to map from "1", "2", etc. to "CT Type 1", etc.
    const typeNum = ctTypeId.replace(/\D/g, "");
    if (!typeNum) return ctTypeId; // Fallback to original

    const targetName = `CT Type ${typeNum}`;
    const { data: ctType } = await supabaseAdmin
        .from("ct_types")
        .select("id")
        .ilike("name", targetName)
        .maybeSingle();

    return ctType?.id || ctTypeId;
}

/**
 * Helper to check if a user is a Super Admin.
 */
async function checkIsSuperAdmin(roleId: string): Promise<boolean> {
    const { data: role } = await supabaseAdmin
        .from("roles")
        .select("name")
        .eq("id", roleId)
        .single();

    return role?.name?.toUpperCase() === "SUPER ADMIN";
}

/**
 * DELETE /api/ct-workflow/conversions/:conversionId
 * Deletes a conversion and all its associated steps.
 */
router.delete("/conversions/:conversionId", requireAuth, async (req: AuthedRequest, res) => {
    const { conversionId } = req.params;
    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Verify ownership
    const { data: conversion, error: convError } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .select("*")
        .eq("id", conversionId)
        .maybeSingle();

    if (convError) return res.status(500).json({ message: convError.message });
    if (!conversion) return res.status(404).json({ message: "Conversion not found" });

    if (!isSuperAdmin && conversion.user_id !== user.id) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    // Delete steps first (optional if cascade is on, but safer)
    await supabaseAdmin
        .from("ct_workflow_data")
        .delete()
        .eq("conversion_id", conversionId);

    // Delete conversion
    const { error } = await supabaseAdmin
        .from("ct_workflow_data_conversions")
        .delete()
        .eq("id", conversionId);

    if (error) return res.status(500).json({ message: error.message });
    return res.status(204).send();
});

export default router;
