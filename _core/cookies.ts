/**
 * Shared cookie configuration helpers.
 */
import type { Request } from "express";
import { ENV } from "./env";

export function getSessionCookieOptions(_req: Request) {
  return {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax" as const,
    path: "/",
  };
}
