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

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ message: "Missing auth token" });

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
}

export function requirePermission(permissionId: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
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

    const hasPermission = (rolePerms || []).some((p: any) => p.permission_id === permissionId);
    if (!hasPermission) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
}
