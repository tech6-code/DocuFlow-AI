import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("*")
    .order("category", { ascending: true });

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

export default router;
