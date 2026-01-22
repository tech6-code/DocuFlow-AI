import { Router } from "express";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

async function resolveDefaultRoleId() {
  const { data } = await supabaseAdmin
    .from("roles")
    .select("id,name")
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return null;

  const preferred = data.find((r: any) =>
    String(r.name || "").toLowerCase().includes("finance") ||
    String(r.name || "").toLowerCase().includes("clerk")
  );

  return (preferred || data[0]).id;
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return res.status(401).json({ message: error?.message || "Invalid credentials" });
  }

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("id", data.user.id)
    .single();

  return res.json({ session: data.session, user: data.user, profile: profile || null });
});

router.post("/register", async (req, res) => {
  const { name, email, password, roleId, departmentId } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

  if (error || !created.user) {
    return res.status(400).json({ message: error?.message || "Failed to create user" });
  }

  const resolvedRoleId = roleId || (await resolveDefaultRoleId());

  const profilePayload = {
    id: created.user.id,
    name,
    email,
    role_id: resolvedRoleId,
    department_id: departmentId || null
  };

  const { error: profileError } = await supabaseAdmin
    .from("users")
    .insert([profilePayload]);

  if (profileError) {
    return res.status(500).json({
      message: "User created, but profile insert failed",
      detail: profileError.message
    });
  }

  return res.status(201).json({ user: created.user, profile: profilePayload });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "refreshToken is required" });
  }

  const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    return res.status(401).json({ message: error?.message || "Failed to refresh session" });
  }

  return res.json({ session: data.session, user: data.user });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: req.auth?.user || null, profile: req.profile || null });
});

router.post("/logout", (_req, res) => {
  return res.json({ ok: true });
});

export default router;
