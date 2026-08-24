import { getSessionCookie } from "./session-cookie";
import { joseSessionManager } from "./session";

export async function getCurrentUser(): Promise<{ userId: string; email?: string } | null> {
  const payload = await getSessionCookie(joseSessionManager);
  if (!payload?.sub) return null;
  return { userId: payload.sub, email: payload.email };
}
