/**
 * Local authentication module — email + password login.
 * Replaces Manus OAuth for users who cannot access external auth services.
 * Sessions are signed JWT cookies using the same JWT_SECRET as before.
 */
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";

const SALT_ROUNDS = 12;

// ─── Password Helpers ─────────────────────────────────────────────────────────
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Session Helpers ──────────────────────────────────────────────────────────
function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createLocalSessionToken(openId: string, name: string): Promise<string> {
  const secretKey = getSessionSecret();
  const expiresAt = Math.floor((Date.now() + ONE_YEAR_MS) / 1000);
  return new SignJWT({ openId, appId: ENV.appId || "local", name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expiresAt)
    .sign(secretKey);
}

export async function verifyLocalSession(
  cookieValue: string | undefined | null
): Promise<{ openId: string; name: string } | null> {
  if (!cookieValue) return null;
  try {
    const secretKey = getSessionSecret();
    const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ["HS256"] });
    const { openId, name } = payload as Record<string, unknown>;
    if (typeof openId !== "string" || !openId) return null;
    return { openId, name: typeof name === "string" ? name : "" };
  } catch {
    return null;
  }
}

// ─── Express Routes ───────────────────────────────────────────────────────────
export function registerLocalAuthRoutes(app: Express) {
  /**
   * POST /api/auth/login
   * Body: { email: string, password: string }
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: "Email y contraseña son requeridos" });
      return;
    }

    try {
      const user = await db.getUserByEmail(email.toLowerCase().trim());
      if (!user || !user.passwordHash) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Credenciales incorrectas" });
        return;
      }

      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

      const token = await createLocalSessionToken(user.openId, user.name || "");
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error("[LocalAuth] Login error:", error);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  });

  /**
   * POST /api/auth/register
   * Body: { name: string, email: string, password: string, role?: "user"|"admin" }
   * Only callable by admin users (verified via existing session cookie).
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    // Verify caller is admin via session cookie
    const cookies = req.headers.cookie
      ? Object.fromEntries(req.headers.cookie.split("; ").map(c => c.split("=")))
      : {};
    const sessionToken = cookies[COOKIE_NAME];
    const session = await verifyLocalSession(sessionToken);

    if (!session) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const callerUser = await db.getUserByOpenId(session.openId);
    if (!callerUser || callerUser.role !== "admin") {
      res.status(403).json({ error: "Solo el administrador puede crear usuarios" });
      return;
    }

    const { name, email, password, role = "user" } = req.body ?? {};
    if (!name || !email || !password) {
      res.status(400).json({ error: "Nombre, email y contraseña son requeridos" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }

    try {
      const existing = await db.getUserByEmail(email.toLowerCase().trim());
      if (existing) {
        res.status(409).json({ error: "Ya existe un usuario con ese email" });
        return;
      }

      const passwordHash = await hashPassword(password);
      const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      await db.upsertUser({
        openId,
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        loginMethod: "local",
        role: role === "admin" ? "admin" : "user",
        lastSignedIn: new Date(),
      });

      const newUser = await db.getUserByEmail(email.toLowerCase().trim());
      res.json({ success: true, user: { id: newUser?.id, name, email, role } });
    } catch (error) {
      console.error("[LocalAuth] Register error:", error);
      res.status(500).json({ error: "Error al crear usuario" });
    }
  });

  /**
   * POST /api/auth/change-password
   * Body: { currentPassword: string, newPassword: string }
   */
  app.post("/api/auth/change-password", async (req: Request, res: Response) => {
    const cookies = req.headers.cookie
      ? Object.fromEntries(req.headers.cookie.split("; ").map(c => c.split("=")))
      : {};
    const sessionToken = cookies[COOKIE_NAME];
    const session = await verifyLocalSession(sessionToken);

    if (!session) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Contraseña actual y nueva son requeridas" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
      return;
    }

    try {
      const user = await db.getUserByOpenId(session.openId);
      if (!user || !user.passwordHash) {
        res.status(400).json({ error: "Usuario no encontrado o sin contraseña configurada" });
        return;
      }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) {
        res.status(401).json({ error: "Contraseña actual incorrecta" });
        return;
      }

      const newHash = await hashPassword(newPassword);
      await db.updateUserPassword(user.openId, newHash);
      res.json({ success: true });
    } catch (error) {
      console.error("[LocalAuth] Change password error:", error);
      res.status(500).json({ error: "Error al cambiar contraseña" });
    }
  });

  /**
   * POST /api/auth/delete-user
   * Body: { userId: number }
   * Only callable by admin.
   */
  app.post("/api/auth/delete-user", async (req: Request, res: Response) => {
    const cookies = req.headers.cookie
      ? Object.fromEntries(req.headers.cookie.split("; ").map(c => c.split("=")))
      : {};
    const sessionToken = cookies[COOKIE_NAME];
    const session = await verifyLocalSession(sessionToken);

    if (!session) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    const callerUser = await db.getUserByOpenId(session.openId);
    if (!callerUser || callerUser.role !== "admin") {
      res.status(403).json({ error: "Solo el administrador puede eliminar usuarios" });
      return;
    }

    const { userId } = req.body ?? {};
    if (!userId) {
      res.status(400).json({ error: "userId es requerido" });
      return;
    }

    if (callerUser.id === userId) {
      res.status(400).json({ error: "No puedes eliminar tu propia cuenta" });
      return;
    }

    try {
      await db.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("[LocalAuth] Delete user error:", error);
      res.status(500).json({ error: "Error al eliminar usuario" });
    }
  });
}
