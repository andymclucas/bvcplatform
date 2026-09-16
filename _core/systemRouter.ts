/**
 * System-level tRPC procedures (health-check, app version, etc.)
 */
import { router, publicProcedure } from "./trpc";

export const systemRouter = router({
  /** Lightweight health check — returns "ok" */
  health: publicProcedure.query(() => "ok" as const),

  /** Current server timestamp (useful for clock-skew checks) */
  now: publicProcedure.query(() => new Date().toISOString()),
});
