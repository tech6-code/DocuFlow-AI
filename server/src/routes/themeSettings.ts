import { Router } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { AuthedRequest, requireAuth } from "../middleware/auth";

const router = Router();

const readThemeObject = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
};

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth?.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { data, error } = await supabaseAdmin
    .from("user_theme_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return res.status(500).json({ message: error.message });
  return res.json(data || null);
});

const upsertThemeSettings = async (req: AuthedRequest, res: any) => {
  const userId = req.auth?.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const lightTheme = readThemeObject(req.body?.lightTheme ?? req.body?.light_theme);
  const darkTheme = readThemeObject(req.body?.darkTheme ?? req.body?.dark_theme);

  const { data: existing, error: readError } = await supabaseAdmin
    .from("user_theme_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) return res.status(500).json({ message: readError.message });

  if (existing?.id) {
    const { data, error } = await supabaseAdmin
      .from("user_theme_settings")
      .update({
        light_theme: lightTheme,
        dark_theme: darkTheme,
        updated_at: new Date().toISOString()
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) return res.status(500).json({ message: error.message });
    return res.json(data);
  }

  const { data, error } = await supabaseAdmin
    .from("user_theme_settings")
    .insert({
      user_id: userId,
      light_theme: lightTheme,
      dark_theme: darkTheme
    })
    .select("*")
    .single();

  if (error) return res.status(500).json({ message: error.message });
  return res.status(201).json(data);
};

router.post("/me", requireAuth, async (req: AuthedRequest, res) => {
  return upsertThemeSettings(req, res);
});

router.put("/me", requireAuth, async (req: AuthedRequest, res) => {
  return upsertThemeSettings(req, res);
});

router.delete("/me", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.auth?.user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const { error } = await supabaseAdmin
    .from("user_theme_settings")
    .delete()
    .eq("user_id", userId);

  if (error) return res.status(500).json({ message: error.message });
  return res.json({ ok: true });
});

export default router;
