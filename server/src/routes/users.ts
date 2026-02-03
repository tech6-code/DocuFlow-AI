import { Router } from "express";
import { randomUUID } from "crypto";
import { query } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const data = await query('SELECT * FROM users');
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const data: any = await query('SELECT * FROM users WHERE id = ?', [id]);
  if (data.length === 0) return res.status(404).json({ message: "User not found" });
  return res.json(data[0]);
});

router.post("/", requireAuth, requirePermission("user-management:create"), async (req, res) => {
  const { name, email, roleId, departmentId, password } = req.body || {};
  if (!name || !email || !roleId) {
    return res.status(400).json({ message: "name, email, and roleId are required" });
  }

  const userId = req.body?.id || randomUUID();
  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  try {
    const sql = `INSERT INTO users (id, name, email, role_id, department_id, password) VALUES (?, ?, ?, ?, ?, ?)`;
    await query(sql, [userId, name, email, roleId, departmentId || null, passwordHash]);

    const [user]: any = await query('SELECT * FROM users WHERE id = ?', [userId]);
    return res.status(201).json(user);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id", requireAuth, requirePermission("user-management:edit"), async (req, res) => {
  const { id } = req.params;
  const { name, email, roleId, departmentId } = req.body || {};

  const updates: string[] = [];
  const params: any[] = [];

  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (email !== undefined) { updates.push('email = ?'); params.push(email); }
  if (roleId !== undefined) { updates.push('role_id = ?'); params.push(roleId); }
  if (departmentId !== undefined) { updates.push('department_id = ?'); params.push(departmentId || null); }

  if (updates.length > 0) {
    params.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    try {
      await query(sql, params);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  }

  try {
    const users: any = await query('SELECT * FROM users WHERE id = ?', [id]);
    return res.json(users[0]);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("user-management:delete"), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
