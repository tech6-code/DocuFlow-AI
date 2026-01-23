import { Router } from "express";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin.from("users").select("*");
  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", id).single();
  if (error) return res.status(404).json({ message: "User not found" });
  return res.json(data);
});

router.post("/", requireAuth, requirePermission("user-management:create"), async (req, res) => {
  const { name, email, roleId, departmentId, password } = req.body || {};
  if (!name || !email || !roleId) {
    return res.status(400).json({ message: "name, email, and roleId are required" });
  }

  let userId = req.body?.id;

  if (password) {
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });
    if (error || !created.user) {
      return res.status(400).json({ message: error?.message || "Failed to create auth user" });
    }
    userId = created.user.id;
  }

  if (!userId) {
    userId = randomUUID();
  }

  const payload = {
    id: userId,
    name,
    email,
    role_id: roleId,
    department_id: departmentId || null
  };

  const { data, error } = await supabaseAdmin.from("users").insert([payload]).select().single();
  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(data);
});

router.put("/:id", requireAuth, requirePermission("user-management:edit"), async (req, res) => {
  const { id } = req.params;
  const { name, email, roleId, departmentId } = req.body || {};

  const payload: any = {};
  if (name !== undefined) payload.name = name;
  if (email !== undefined) payload.email = email;
  if (roleId !== undefined) payload.role_id = roleId;
  if (departmentId !== undefined) payload.department_id = departmentId || null;

  const { data, error } = await supabaseAdmin
    .from("users")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data);
});

router.delete("/:id", requireAuth, requirePermission("user-management:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("users").delete().eq("id", id);
  if (error) return res.status(500).json({ message: error.message });

  try {
    await supabaseAdmin.auth.admin.deleteUser(id);
  } catch (_) {
    // Ignore auth delete failures (user might not exist in auth)
  }

  return res.json({ ok: true });
});

export default router;
