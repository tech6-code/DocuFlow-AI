import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase";

export type AuthedRequest = Request & {
  auth?: {
    user: any;
    token: string;
  };
  profile?: any;
};

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token.trim();
}

function isSupabaseNetworkTimeout(err: unknown) {
  const anyErr = err as any;
  const causeCode = anyErr?.cause?.code;
  const msg = String(anyErr?.message || "");
  return causeCode === "UND_ERR_CONNECT_TIMEOUT" || msg.toLowerCase().includes("fetch failed");
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: "Missing auth token" });

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ message: "Invalid auth token" });
    }

    req.auth = { user: data.user, token };

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", data.user.id)
      .single();

    req.profile = profile || null;
    return next();
  } catch (err) {
    console.error("[AuthMiddleware] Supabase auth lookup failed:", err);
    if (isSupabaseNetworkTimeout(err)) {
      return res.status(503).json({ message: "Authentication service unavailable. Please try again." });
    }
    return res.status(500).json({ message: "Authentication check failed" });
  }
}

export function requirePermission(permissionId: string | string[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.profile?.role_id) {
        return res.status(403).json({ message: "No role assigned" });
      }

      const { data: role } = await supabaseAdmin
        .from("roles")
        .select("id,name")
        .eq("id", req.profile.role_id)
        .single();

      if (role?.name?.toUpperCase() === "SUPER ADMIN") return next();

      const { data: rolePerms, error } = await supabaseAdmin
        .from("role_permissions")
        .select("permission_id")
        .eq("role_id", req.profile.role_id);

      if (error) {
        return res.status(500).json({ message: "Failed to load permissions" });
      }

      const assignedIds = (rolePerms || []).map((p: any) => p.permission_id);
      const requiredIds = Array.isArray(permissionId) ? permissionId : [permissionId];

      const hasPermission = requiredIds.some(id => assignedIds.includes(id));

      if (!hasPermission) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      return next();
    } catch (err) {
      console.error("[AuthMiddleware] Permission lookup failed:", err);
      if (isSupabaseNetworkTimeout(err)) {
        return res.status(503).json({ message: "Authorization service unavailable. Please try again." });
      }
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}
