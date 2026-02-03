import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  try {
    const data = await query('SELECT * FROM permissions ORDER BY category ASC');
    return res.json(data);
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

export default router;
