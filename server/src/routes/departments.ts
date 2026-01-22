import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requirePermission("departments:view"), async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("departments").select("*").order("name");
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

router.post("/", requireAuth, requirePermission("departments:create"), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });

  const { data, error } = await supabaseAdmin
    .from("departments")
    .insert([{ name }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(data);
});

router.put("/:id", requireAuth, requirePermission("departments:edit"), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });

  const { data, error } = await supabaseAdmin
    .from("departments")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data);
});

router.delete("/:id", requireAuth, requirePermission("departments:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("departments").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

export default router;
