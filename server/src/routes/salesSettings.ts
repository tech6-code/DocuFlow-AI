import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

function buildSimpleRoutes(table: string) {
  router.get(`/${table}`, requireAuth, async (_req, res) => {
    const { data, error } = await supabaseAdmin.from(table).select("*").order("name");
    if (error) return res.status(500).json({ message: error.message });
    return res.json(data || []);
  });

  router.post(`/${table}`, requireAuth, requirePermission("sales-settings:create"), async (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ message: "name is required" });
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert([{ name }])
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    return res.status(201).json(data);
  });

  router.put(`/${table}/:id`, requireAuth, requirePermission("sales-settings:edit"), async (req, res) => {
    const { id } = req.params;
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ message: "name is required" });
    const { data, error } = await supabaseAdmin
      .from(table)
      .update({ name })
      .eq("id", id)
      .select()
      .single();
    if (error) return res.status(500).json({ message: error.message });
    return res.json(data);
  });

  router.delete(`/${table}/:id`, requireAuth, requirePermission("sales-settings:delete"), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from(table).delete().eq("id", id);
    if (error) return res.status(500).json({ message: error.message });
    return res.json({ ok: true });
  });
}

buildSimpleRoutes("lead_sources");
buildSimpleRoutes("service_required");
buildSimpleRoutes("lead_qualifications");
buildSimpleRoutes("brands");
buildSimpleRoutes("lead_owners");

router.get("/custom-fields", requireAuth, async (req, res) => {
  const module = String(req.query.module || "leads");
  const { data, error } = await supabaseAdmin
    .from("custom_fields")
    .select("*")
    .eq("module", module)
    .order("sort_order", { ascending: true });

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

router.post("/custom-fields", requireAuth, requirePermission("sales-custom-fields:create"), async (req, res) => {
  const field = req.body || {};
  const { data, error } = await supabaseAdmin
    .from("custom_fields")
    .insert([field])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(data);
});

router.put("/custom-fields/:id", requireAuth, requirePermission("sales-custom-fields:edit"), async (req, res) => {
  const { id } = req.params;
  const field = req.body || {};
  const { data, error } = await supabaseAdmin
    .from("custom_fields")
    .update(field)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data);
});

router.delete("/custom-fields/:id", requireAuth, requirePermission("sales-custom-fields:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("custom_fields").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

export default router;
