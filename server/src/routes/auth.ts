import { Router } from "express";
import { query } from "../lib/db";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeyChangeThis';

async function resolveDefaultRoleId() {
  const rows: any = await query('SELECT id, name FROM roles ORDER BY created_at ASC');
  if (rows.length === 0) return null;

  const preferred = rows.find((r: any) =>
    String(r.name || "").toLowerCase().includes("finance") ||
    String(r.name || "").toLowerCase().includes("clerk")
  );

  return (preferred || rows[0]).id;
}

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const users: any = await query('SELECT * FROM users WHERE email = ?', [email]);
  const user = users[0];

  if (!user || user.password === undefined) {
    // If password is null (maybe migrated user?), deny
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    session: { access_token: token, refresh_token: token },
    user: { id: user.id, email: user.email }, // Mimic Supabase user object minimal fields
    profile: user
  });
});

router.post("/register", async (req, res) => {
  const { name, email, password, roleId, departmentId } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  // Check existing
  const existing: any = await query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0) {
    return res.status(400).json({ message: "User already exists" });
  }

  const hash = await bcrypt.hash(password, 10);
  const resolvedRoleId = roleId || (await resolveDefaultRoleId());
  const id = randomUUID();

  try {
    await query(
      'INSERT INTO users (id, email, password, name, role_id, department_id) VALUES (?, ?, ?, ?, ?, ?)',
      [id, email, hash, name, resolvedRoleId, departmentId || null]
    );

    const users: any = await query('SELECT * FROM users WHERE id = ?', [id]);
    const user = users[0];

    return res.status(201).json({ user: { id: user.id, email: user.email }, profile: user });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: "RefreshToken required" });

  try {
    const payload: any = jwt.verify(refreshToken, JWT_SECRET);
    // Issue new token
    const token = jwt.sign({ id: payload.id, email: payload.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ session: { access_token: token, refresh_token: token }, user: { id: payload.id } });
  } catch (e) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  return res.json({ user: req.auth?.user || null, profile: req.profile || null });
});

router.post("/logout", (_req, res) => {
  return res.json({ ok: true });
});

export default router;
