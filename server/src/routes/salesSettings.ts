import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { randomUUID } from "crypto";

const router = Router();

function buildSimpleRoutes(table: string) {
  const allowed = ["lead_sources", "service_required", "lead_qualifications", "brands", "lead_owners"];
  if (!allowed.includes(table)) throw new Error("Invalid table configuration");

  router.get(`/${table}`, requireAuth, async (_req, res) => {
    try {
      const data = await query(`SELECT * FROM ${table} ORDER BY name`);
      return res.json(data);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  router.post(`/${table}`, requireAuth, requirePermission("sales-settings:create"), async (req, res) => {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ message: "name is required" });

    const id = randomUUID();
    try {
      await query(`INSERT INTO ${table} (id, name) VALUES (?, ?)`, [id, name]);
      const [row]: any = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return res.status(201).json(row);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  router.put(`/${table}/:id`, requireAuth, requirePermission("sales-settings:edit"), async (req, res) => {
    const { id } = req.params;
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ message: "name is required" });

    try {
      await query(`UPDATE ${table} SET name = ? WHERE id = ?`, [name, id]);
      const [row]: any = await query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return res.json(row);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });

  router.delete(`/${table}/:id`, requireAuth, requirePermission("sales-settings:delete"), async (req, res) => {
    const { id } = req.params;
    try {
      await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return res.json({ ok: true });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  });
}

buildSimpleRoutes("lead_sources");
buildSimpleRoutes("service_required");
buildSimpleRoutes("lead_qualifications");
buildSimpleRoutes("brands");
buildSimpleRoutes("lead_owners");

router.get("/custom-fields", requireAuth, async (req, res) => {
  const module = String(req.query.module || "leads");
  try {
    const data = await query('SELECT * FROM custom_fields WHERE module = ? ORDER BY sort_order ASC', [module]);
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.post("/custom-fields", requireAuth, requirePermission("sales-custom-fields:create"), async (req, res) => {
  const field = req.body || {};
  const id = randomUUID();
  try {
    const sql = `INSERT INTO custom_fields (id, module, label, type, required, options, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    await query(sql, [id, field.module, field.label, field.type, field.required, JSON.stringify(field.options), field.sort_order]);
    const [newField]: any = await query('SELECT * FROM custom_fields WHERE id = ?', [id]);
    return res.status(201).json(newField);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.put("/custom-fields/:id", requireAuth, requirePermission("sales-custom-fields:edit"), async (req, res) => {
  const { id } = req.params;
  const field = req.body || {};

  const updates = [];
  const params = [];

  if (field.label !== undefined) { updates.push('label = ?'); params.push(field.label); }
  if (field.type !== undefined) { updates.push('type = ?'); params.push(field.type); }
  if (field.required !== undefined) { updates.push('required = ?'); params.push(field.required); }
  if (field.options !== undefined) { updates.push('options = ?'); params.push(JSON.stringify(field.options)); }
  if (field.sort_order !== undefined) { updates.push('sort_order = ?'); params.push(field.sort_order); }

  if (updates.length > 0) {
    params.push(id);
    try {
      await query(`UPDATE custom_fields SET ${updates.join(', ')} WHERE id = ?`, params);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  }

  try {
    const [updated]: any = await query('SELECT * FROM custom_fields WHERE id = ?', [id]);
    return res.json(updated);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

router.delete("/custom-fields/:id", requireAuth, requirePermission("sales-custom-fields:delete"), async (req, res) => {
  const { id } = req.params;
  try {
    await query('DELETE FROM custom_fields WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
