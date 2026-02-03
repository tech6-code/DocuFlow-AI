import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const roles: any = await query('SELECT * FROM roles ORDER BY created_at');

    const permissions: any = await query('SELECT role_id, permission_id FROM role_permissions');

    const mapped = roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      is_editable: r.is_editable,
      permissions: permissions.filter((p: any) => p.role_id === r.id).map((p: any) => p.permission_id)
    }));

    return res.json(mapped);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/", requireAuth, requirePermission("role-management:create"), async (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });
  if (name.trim().toLowerCase() === "super admin") {
    return res.status(400).json({ message: "Cannot create another Super Admin role" });
  }

  const id = randomUUID();
  try {
    // is_editable default true by schema, but explicit is good
    await query('INSERT INTO roles (id, name, description, is_editable) VALUES (?, ?, ?, ?)', [id, name, description, true]);
    const roles: any = await query('SELECT * FROM roles WHERE id = ?', [id]);
    return res.status(201).json({ ...roles[0], permissions: [] });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id", requireAuth, requirePermission("role-management:edit"), async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body || {};

  if (name !== undefined && name.trim().toLowerCase() === "super admin") {
    return res.status(400).json({ message: "Cannot rename a role to Super Admin" });
  }

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }

  if (updates.length > 0) {
    params.push(id);
    try {
      await query(`UPDATE roles SET ${updates.join(', ')} WHERE id = ?`, params);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  }

  return res.json({ ok: true });
});

router.put("/:id/permissions", requireAuth, requirePermission("role-management:edit"), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body || {};
  const permissionIds: string[] = Array.isArray(permissions) ? permissions : [];

  try {
    await query('DELETE FROM role_permissions WHERE role_id = ?', [id]);

    if (permissionIds.length > 0) {
      for (const pid of permissionIds) {
        await query('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [id, pid]);
      }
    }
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("role-management:delete"), async (req, res) => {
  const { id } = req.params;

  // Check if assigned to users
  const users: any = await query('SELECT id FROM users WHERE role_id = ?', [id]);
  if (users.length > 0) {
    return res.status(400).json({ message: "Cannot delete role assigned to users." });
  }

  try {
    await query('DELETE FROM roles WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
