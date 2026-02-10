import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/ct-workflow
 * Fetches all workflow steps for a specific period and CT type.
 * Hydrates the frontend on load.
 */
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
    const { periodId, ctTypeId } = req.query as { periodId?: string; ctTypeId?: string };

    if (!periodId || !ctTypeId) {
        return res.status(400).json({ message: "periodId and ctTypeId are required" });
    }

    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    let query = supabaseAdmin
        .from("ct_workflow_data")
        .select("*")
        .eq("period_id", periodId)
        .eq("ct_type_id", ctTypeId);

    // Authorization: Normal users only see their own records
    if (!isSuperAdmin) {
        query = query.eq("user_id", user.id);
    }

    const { data, error } = await query.order("step_number", { ascending: true });

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    return res.json(data || []);
});

/**
 * POST /api/ct-workflow/upsert
 * Saves or updates a single step's data.
 * Unique on (period_id, ct_type_id, step_key).
 */
router.post("/upsert", requireAuth, async (req: AuthedRequest, res) => {
    const {
        customerId,
        ctTypeId,
        periodId,
        stepNumber,
        stepKey,
        data,
        status
    } = req.body;

    if (!periodId || !ctTypeId || !stepKey) {
        return res.status(400).json({ message: "periodId, ctTypeId, and stepKey are required" });
    }

    const user = req.auth?.user;
    const isSuperAdmin = req.profile?.role_id && await checkIsSuperAdmin(req.profile.role_id);

    // Check if record exists to verify ownership if not admin
    const { data: existing } = await supabaseAdmin
        .from("ct_workflow_data")
        .select("user_id")
        .eq("period_id", periodId)
        .eq("ct_type_id", ctTypeId)
        .eq("step_key", stepKey)
        .maybeSingle();

    if (existing && !isSuperAdmin && existing.user_id !== user.id) {
        return res.status(403).json({ message: "You do not have permission to update this record" });
    }

    const payload = {
        user_id: user.id, // Current user becomes the owner/editor
        customer_id: customerId,
        ct_type_id: ctTypeId,
        period_id: periodId,
        step_number: stepNumber,
        step_key: stepKey,
        data: data || {},
        status: status || "draft",
        updated_at: new Date().toISOString()
    };

    const { data: upserted, error } = await supabaseAdmin
        .from("ct_workflow_data")
        .upsert(payload, { onConflict: "period_id,ct_type_id,step_key" })
        .select()
        .single();

    if (error) {
        return res.status(500).json({ message: error.message });
    }

    return res.json(upserted);
});

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

export default router;
