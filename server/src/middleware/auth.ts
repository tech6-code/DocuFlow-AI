import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { query } from "../lib/db";

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyChangeThis';

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

  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    const userId = payload.id;
    if (!userId) throw new Error("Invalid token payload");

    const users: any = await query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    // Normalize user object structure to match what routes expect (camelCase vs snake_case might be issue?)
    // Most routes use snake_case from DB directly.
    req.auth = { user: users[0], token };
    req.profile = users[0];
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requirePermission(permissionSlug: string | string[]) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.profile?.role_id) {
      return res.status(403).json({ message: "No role assigned" });
    }

    const roles: any = await query('SELECT * FROM roles WHERE id = ?', [req.profile.role_id]);
    const role = roles[0];

    if (role && role.name.toLowerCase() === "super admin") return next();

    // Fetch permission slugs for this role
    const sql = `
        SELECT p.slug 
        FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        WHERE rp.role_id = ?
    `;
    const rows: any = await query(sql, [req.profile.role_id]);
    const userSlugs = rows.map((r: any) => r.slug);

    const requiredSlugs = Array.isArray(permissionSlug) ? permissionSlug : [permissionSlug];

    const hasPermission = requiredSlugs.some(slug => userSlugs.includes(slug));

    if (!hasPermission) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    return next();
  };
}
