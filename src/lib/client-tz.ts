import { cookies } from "next/headers";

const COOKIE_NAME = "CLIENT_TZ_OFFSET";
// Sanitization bound: ±14h in whole minutes, integer only. Anything else
// falls back to 0 (the server's UTC clock — the pre-cookie behavior).
const MIN_OFFSET = -14 * 60;
const MAX_OFFSET = 14 * 60;

/**
 * Read the client civil-clock offset cookie written by `ClientTzBootstrap`
 * (`Date.getTimezoneOffset()`: minutes east of UTC — 300 for UTC-5).
 *
 * Server Components render before any client JS, so the "current period"
 * windows (dashboard) cannot ask the browser: they need the offset from the
 * established cookie channel (NEXT_LOCALE precedent). Returns 0 when the
 * cookie is absent (first visit) — the client-side A2 mount-sync corrects
 * that first paint and this read becomes correct from the next navigation.
 */
export async function getClientTzOffsetMinutes(): Promise<number> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < MIN_OFFSET || parsed > MAX_OFFSET) return 0;
  return parsed;
}
