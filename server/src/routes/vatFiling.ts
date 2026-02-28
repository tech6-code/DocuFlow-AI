import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission, type AuthedRequest } from "../middleware/auth";

const router = Router();

const mapFromDb = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  customerId: row.customer_id,
  periodFrom: row.period_from,
  periodTo: row.period_to,
  dueDate: row.due_date,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapConversionFromDb = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  customerId: row.customer_id,
  periodId: row.period_id,
  conversionName: row.conversion_name,
  status: row.status,
  data: row.data || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

router.get(
  "/filing-periods",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { customerId } = req.query as { customerId?: string };
    if (!customerId) {
      return res.status(400).json({ message: "customerId is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("vat_filing_period")
      .select("*")
      .eq("customer_id", customerId)
      .order("period_from", { ascending: true });

    if (error) return res.status(500).json({ message: error.message });
    return res.json((data || []).map(mapFromDb));
  }
);

router.post(
  "/filing-periods",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const customerId = body.customerId;
    const periodFrom = body.periodFrom;
    const periodTo = body.periodTo;
    const dueDate = body.dueDate;

    if (!customerId || !periodFrom || !periodTo || !dueDate) {
      return res.status(400).json({ message: "customerId, periodFrom, periodTo and dueDate are required" });
    }

    const payload = {
      user_id: body.userId || req.auth?.user?.id || null,
      customer_id: customerId,
      period_from: periodFrom,
      period_to: periodTo,
      due_date: dueDate,
      status: body.status || "Not Started",
    };

    const { data, error } = await supabaseAdmin
      .from("vat_filing_period")
      .insert([payload])
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.status(201).json(mapFromDb(data));
  }
);

router.get(
  "/filing-periods/:id",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("vat_filing_period")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(mapFromDb(data));
  }
);

router.put(
  "/filing-periods/:id",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { id } = req.params;
    const updates = req.body || {};

    const dbPayload: Record<string, any> = {};
    if (updates.periodFrom !== undefined) dbPayload.period_from = updates.periodFrom;
    if (updates.periodTo !== undefined) dbPayload.period_to = updates.periodTo;
    if (updates.dueDate !== undefined) dbPayload.due_date = updates.dueDate;
    if (updates.status !== undefined) dbPayload.status = updates.status;

    if (Object.keys(dbPayload).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const { data, error } = await supabaseAdmin
      .from("vat_filing_period")
      .update(dbPayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(mapFromDb(data));
  }
);

router.delete(
  "/filing-periods/:id",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin
      .from("vat_filing_period")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
  }
);

router.get(
  "/conversions",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { periodId } = req.query as { periodId?: string };
    if (!periodId) {
      return res.status(400).json({ message: "periodId is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("vat_filing_conversions")
      .select("*")
      .eq("period_id", periodId)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    return res.json((data || []).map(mapConversionFromDb));
  }
);

router.post(
  "/conversions",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req: AuthedRequest, res) => {
    const body = req.body || {};
    const customerId = body.customerId;
    const periodId = body.periodId;

    if (!customerId || !periodId) {
      return res.status(400).json({ message: "customerId and periodId are required" });
    }

    let conversionName = String(body.conversionName || "").trim();
    if (!conversionName) {
      const { count } = await supabaseAdmin
        .from("vat_filing_conversions")
        .select("id", { count: "exact", head: true })
        .eq("period_id", periodId);
      conversionName = `Conversion ${(count || 0) + 1}`;
    }

    const payload = {
      user_id: body.userId || req.auth?.user?.id || null,
      customer_id: customerId,
      period_id: periodId,
      conversion_name: conversionName,
      status: body.status || "draft",
      data: body.data || {},
    };

    const { data, error } = await supabaseAdmin
      .from("vat_filing_conversions")
      .insert([payload])
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: error.message });

    await supabaseAdmin
      .from("vat_filing_period")
      .update({ status: "In Progress" })
      .eq("id", periodId)
      .eq("customer_id", customerId)
      .in("status", ["Not Started", "In Progress"]);

    return res.status(201).json(mapConversionFromDb(data));
  }
);

router.get(
  "/conversions/:id",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from("vat_filing_conversions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(mapConversionFromDb(data));
  }
);

router.put(
  "/conversions/:id",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { id } = req.params;
    const updates = req.body || {};

    const dbPayload: Record<string, any> = {};
    if (updates.conversionName !== undefined) dbPayload.conversion_name = updates.conversionName;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.data !== undefined) dbPayload.data = updates.data;

    if (Object.keys(dbPayload).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const { data, error } = await supabaseAdmin
      .from("vat_filing_conversions")
      .update(dbPayload)
      .eq("id", id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(mapConversionFromDb(data));
  }
);

router.delete(
  "/conversions/:id",
  requireAuth,
  requirePermission(["projects:view", "projects-vat-filing:view"]),
  async (req, res) => {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from("vat_filing_conversions")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
  }
);

export default router;

