import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, requirePermission } from "../middleware/auth";

const router = Router();

const SETTINGS_PERMISSIONS = [
  {
    id: "settings:view",
    label: "View Settings",
    description: "Access to system settings.",
    category: "Settings"
  },
  {
    id: "settings:edit",
    label: "Edit Settings",
    description: "Allows user to edit general settings.",
    category: "Settings"
  },
  {
    id: "settings:theme",
    label: "View Theme Settings",
    description: "Access to theme settings.",
    category: "Settings"
  },
  {
    id: "settings:notifications",
    label: "View Notification Settings",
    description: "Access to notification settings.",
    category: "Settings"
  },
  {
    id: "settings:security",
    label: "View Security Settings",
    description: "Access to security settings.",
    category: "Settings"
  }
];

async function ensureSettingsPermissions() {
  const ids = SETTINGS_PERMISSIONS.map((p) => p.id);
  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("id")
    .in("id", ids);

  if (error) throw error;

  const existingIds = new Set((data || []).map((row: any) => row.id));
  const missingPermissions = SETTINGS_PERMISSIONS.filter((p) => !existingIds.has(p.id));

  if (missingPermissions.length === 0) return;

  const { error: insertError } = await supabaseAdmin
    .from("permissions")
    .insert(missingPermissions);

  if (insertError) throw insertError;
}

router.get("/", requireAuth, async (_req, res) => {
  try {
    await ensureSettingsPermissions();
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Failed to sync settings permissions" });
  }

  const { data, error } = await supabaseAdmin
    .from("permissions")
    .select("*")
    .order("category", { ascending: true });

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || []);
});

export default router;
