/**
 * Email/password authentication routes replacing Manus OAuth.
 * POST /api/auth/login    — sign in with email + password
 * POST /api/auth/register — create account (status=pending until approved by admin)
 * POST /api/auth/logout   — clear session cookie
 * GET  /api/auth/me       — return current user (or 401)
 */
import type { Express } from "express";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { ENV } from "../_core/env";
import { db } from "../db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const COOKIE_NAME = "bvc_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };
}

async function signToken(userId: number): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export function registerAuthRoutes(app: Express) {
  // ── Register ──────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body as {
        email?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
      };

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check for duplicate
      const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const openId = `email:${normalizedEmail}`; // synthetic openId for compatibility

      const [inserted] = await db.insert(users).values({
        email: normalizedEmail,
        passwordHash,
        openId,
        firstName: firstName?.trim() ?? null,
        lastName: lastName?.trim() ?? null,
        name: [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail,
        status: "pending",
        role: "user",
        loginMethod: "email",
      }).$returningId();

      const userId = inserted.id;
      const token = await signToken(userId);

      res.cookie(COOKIE_NAME, token, cookieOptions(COOKIE_MAX_AGE));
      return res.status(201).json({ message: "Account created — awaiting admin approval" });
    } catch (err) {
      console.error("[Auth] register error:", err);
      return res.status(500).json({ error: "Registration failed" });
    }
  });

  // ── Login ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);

      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Update last signed in
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = await signToken(user.id);
      res.cookie(COOKIE_NAME, token, cookieOptions(COOKIE_MAX_AGE));
      return res.json({ message: "Logged in" });
    } catch (err) {
      console.error("[Auth] login error:", err);
      return res.status(500).json({ error: "Login failed" });
    }
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (_req, res) => {
    res.cookie(COOKIE_NAME, "", cookieOptions(0));
    return res.json({ message: "Logged out" });
  });

  // ── Me ────────────────────────────────────────────────────────────────────
  app.get("/api/auth/me", async (req, res) => {
    try {
      const rawCookies = req.headers.cookie ?? "";
      const { parse } = await import("cookie");
      const cookies = parse(rawCookies);
      const token = cookies[COOKIE_NAME];

      if (!token) return res.status(401).json({ error: "Not authenticated" });

      const { jwtVerify } = await import("jose");
      const secret = new TextEncoder().encode(ENV.cookieSecret);
      const { payload } = await jwtVerify(token, secret);
      const userId = payload.userId as number;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(401).json({ error: "User not found" });

      // Don't leak passwordHash
      const { passwordHash: _ph, ...safeUser } = user;
      return res.json(safeUser);
    } catch {
      return res.status(401).json({ error: "Invalid session" });
    }
  });
}
