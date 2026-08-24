import { cookies } from "next/headers";
import type { SessionClaims, SessionManager } from "../../core/application/ports";

const COOKIE_NAME = "gm_session";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 30 * 24 * 60 * 60, // 30 days
  secure: process.env.NODE_ENV === "production",
};

export async function setSessionCookie(
  sessionManager: SessionManager,
  claims: SessionClaims,
) {
  const token = await sessionManager.create(claims);
  const store = await cookies();
  store.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

export async function getSessionCookie(
  sessionManager: SessionManager,
): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return sessionManager.verify(token);
}

export async function deleteSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
