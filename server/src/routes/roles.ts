import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("roles")
    .select("*, role_permissions(permission_id)")
    .order("created_at");

  if (error) return res.status(500).json({ message: error.message });

  const mapped = (data || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    is_editable: r.is_editable,
    permissions: (r.role_permissions || []).map((rp: any) => rp.permission_id)
  }));

  return res.json(mapped);
});

router.post("/", requireAuth, requirePermission("role-management:create"), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });

  if (name.trim().toLowerCase() === "super admin") {
    return res.status(400).json({ message: "Cannot create another Super Admin role" });
  }

  const { data, error } = await supabaseAdmin
    .from("roles")
    .insert([{ name, description, is_editable: true }])
    .select()
    .single();

  if (error) return res.status(500).json({ message: error.message });

  return res.status(201).json({
    id: data.id,
    name: data.name,
    description: data.description,
    is_editable: data.is_editable,
    permissions: []
  });
});

router.put("/:id", requireAuth, requirePermission("role-management:edit"), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body || {};

  if (name && name.trim().toLowerCase() === "super admin") {
    return res.status(400).json({ message: "Cannot rename a role to Super Admin" });
  }

  const { error } = await supabaseAdmin
    .from("roles")
    .update({ name, description })
    .eq("id", id);

  if (error) return res.status(500).json({ message: error.message });

  return res.json({ ok: true });
});

router.put("/:id/permissions", requireAuth, requirePermission("role-management:edit"), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body || {};
  const permissionIds: string[] = Array.isArray(permissions) ? permissions : [];

  const { error: deleteError } = await supabaseAdmin
    .from("role_permissions")
    .delete()
    .eq("role_id", id);

  if (deleteError) return res.status(500).json({ message: deleteError.message });

  if (permissionIds.length > 0) {
    console.log(`[RolesRoute] Updating role ${id} with permissions:`, permissionIds);
    const rows = permissionIds.map((pid) => ({ role_id: id, permission_id: pid }));
    const { error: insertError } = await supabaseAdmin
      .from("role_permissions")
      .insert(rows);
    if (insertError) return res.status(500).json({ message: insertError.message });
  }

  return res.json({ ok: true });
});

router.delete("/:id", requireAuth, requirePermission("role-management:delete"), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabaseAdmin.from("roles").delete().eq("id", id);
  if (error) return res.status(500).json({ message: "Could not delete role. It might be assigned to users." });
  return res.json({ ok: true });
});

export default router;
