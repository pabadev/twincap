import { headers } from 'next/headers';

export const UNKNOWN_IP = 'unknown';

/**
 * Extract the real client IP from request headers (R14-C, §5).
 * Priority: x-real-ip (trusted proxy/Vercel) → first entry of x-forwarded-for
 * (the originating client when proxies append client, proxy1, ...) → 'unknown'.
 * Sanitizes: trims, strips IPv4-mapped IPv6 prefix (::ffff:), strips bracketed
 * IPv6 port, strips IPv4 port, truncates to 64 chars. Never throws.
 */
export function resolveClientIp(h: Headers): string {
  const xRealIp = h.get('x-real-ip');
  const xForwardedFor = h.get('x-forwarded-for');
  const raw = (xRealIp ?? (xForwardedFor ? xForwardedFor.split(',')[0] : '') ?? '').trim();
  if (!raw) return UNKNOWN_IP;
  let ip = raw;
  if (ip.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  const bracketed = ip.match(/^\[(.*?)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  const v4Port = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (v4Port) ip = v4Port[1];
  const clean = ip.trim().slice(0, 64);
  return clean || UNKNOWN_IP;
}

/** Async wrapper for Next 16 (headers() is async). Use inside server actions / route handlers. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return resolveClientIp(h);
}
