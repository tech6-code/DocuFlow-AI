import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { handleAiAction } from "../ai/handlers";

const router = Router();

router.post("/", requireAuth, async (req, res) => {
  const { action, payload } = req.body || {};
  if (!action) return res.status(400).json({ message: "action is required" });

  try {
    const result = await handleAiAction(action, payload || {});
    return res.json({ result });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "AI request failed" });
  }
});

export default router;
