import { getSessionCookie } from "./session-cookie";
import { joseSessionManager } from "./session";
import { connectDb } from "../db/connection";
import { MongoMembershipRepository } from "../repositories/membership-repository";

export async function getCurrentUser(): Promise<{ userId: string; workspaceId?: string; email?: string } | null> {
  const payload = await getSessionCookie(joseSessionManager);
  if (!payload?.sub) return null;

  let workspaceId = payload.workspaceId;

  // Legacy session without workspaceId claim — resolve from DB
  if (!workspaceId) {
    await connectDb();
    const membershipRepo = new MongoMembershipRepository();
    const memberships = await membershipRepo.findByUserId(payload.sub);
    const active = memberships.find((m) => m.status === "active");
    if (active) {
      workspaceId = active.workspaceId;
    }
  }

  return { userId: payload.sub, workspaceId, email: payload.email };
}
