import { getSessionCookie } from "./session-cookie";
import { joseSessionManager } from "./session";
import { connectDb } from "../db/connection";
import { MongoUserRepository } from "../repositories/user-repository";
import { MongoMembershipRepository } from "../repositories/membership-repository";

/**
 * Resolves the authenticated current user from the session cookie.
 *
 * R14-F §13 (session invalidation on password change/reset): the JWT carries a
 * `sessionVersion` snapshot; here we ALWAYS load the user from the DB
 * (one indexed findById per authenticated request — a deliberate, accepted
 * cost for a financial app) and compare versions. A missing user OR a version
 * mismatch means the session is invalid → returns null (the (main) layout
 * redirects to /login).
 *
 * Legacy sessions (no `workspaceId` claim, no `sessionVersion` claim) keep the
 * membership-based workspaceId fallback: it only runs when the claim lacks
 * workspaceId, and `sessionVersion` is treated as 0.
 */
export async function getCurrentUser(): Promise<{ userId: string; workspaceId?: string; email?: string } | null> {
  const payload = await getSessionCookie(joseSessionManager);
  if (!payload?.sub) return null;

  await connectDb();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(payload.sub);
  if (!user) return null;

  // R14-F §13: a stale session (created before the last password change/reset)
  // carries an outdated sessionVersion → invalid.
  if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
    return null;
  }

  let workspaceId = payload.workspaceId;

  // Legacy session without workspaceId claim — resolve from DB
  if (!workspaceId) {
    const membershipRepo = new MongoMembershipRepository();
    const memberships = await membershipRepo.findByUserId(payload.sub);
    const active = memberships.find((m) => m.status === "active");
    if (active) {
      workspaceId = active.workspaceId;
    }
  }

  return { userId: payload.sub, workspaceId, email: payload.email };
}