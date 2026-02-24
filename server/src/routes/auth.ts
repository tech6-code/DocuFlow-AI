import { Router } from "express";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";

const router = Router();

function isSupabaseNetworkTimeout(err: unknown) {
  const anyErr = err as any;
  const causeCode = anyErr?.cause?.code;
  const msg = String(anyErr?.message || "");
  return causeCode === "UND_ERR_CONNECT_TIMEOUT" || msg.toLowerCase().includes("fetch failed");
}

function handleSupabaseRouteError(res: any, err: unknown, fallbackMessage: string) {
  console.error("[AuthRoute] Supabase request failed:", err);
  if (isSupabaseNetworkTimeout(err)) {
    return res.status(503).json({ message: "Supabase service unavailable. Please try again." });
  }
  return res.status(500).json({ message: fallbackMessage });
}

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

  try {
    console.log("Attempting login for:", email);
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("Supabase login error:", error);
    }

    if (error || !data.session) {
      return res.status(401).json({ message: error?.message || "Invalid credentials" });
    }

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return res.json({ session: data.session, user: data.user, profile: profile || null });
  } catch (err) {
    return handleSupabaseRouteError(res, err, "Login failed");
  }
});

router.post("/register", async (req, res) => {
  const { name, email, password, roleId, departmentId } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  try {
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
  } catch (err) {
    return handleSupabaseRouteError(res, err, "Registration failed");
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) {
    return res.status(400).json({ message: "refreshToken is required" });
  }

  try {
    const { data, error } = await supabaseAnon.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      return res.status(401).json({ message: error?.message || "Failed to refresh session" });
    }

    return res.json({ session: data.session, user: data.user });
  } catch (err) {
    return handleSupabaseRouteError(res, err, "Session refresh failed");
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: req.auth?.user || null, profile: req.profile || null });
});

router.post("/logout", (_req, res) => {
  return res.json({ ok: true });
});

export default router;
