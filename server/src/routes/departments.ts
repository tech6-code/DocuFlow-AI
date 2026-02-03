import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { randomUUID } from "crypto";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const data = await query('SELECT * FROM departments ORDER BY name');
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/", requireAuth, requirePermission("departments:create"), async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });

  const id = randomUUID();
  try {
    await query('INSERT INTO departments (id, name) VALUES (?, ?)', [id, name]);
    const [dept]: any = await query('SELECT * FROM departments WHERE id = ?', [id]);
    return res.status(201).json(dept);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/:id", requireAuth, requirePermission("departments:edit"), async (req, res) => {
  const { id } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ message: "name is required" });

  try {
    await query('UPDATE departments SET name = ? WHERE id = ?', [name, id]);
    const [dept]: any = await query('SELECT * FROM departments WHERE id = ?', [id]);
    return res.json(dept);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/:id", requireAuth, requirePermission("departments:delete"), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM departments WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
