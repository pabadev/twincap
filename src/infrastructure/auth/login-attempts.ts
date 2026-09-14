import type { Clock } from '../../core/application/ports';
import { LoginAttemptModel } from '../models/login-attempt';
import { systemClock } from './system-clock';

/**
 * Login failure accounting per EMAIL (R15.3.2 P2-5).
 *
 * The login rate limiter is keyed by email+IP (fixed window), so an attacker
 * rotating IPs gets a fresh counter per IP. This helper extends the lockout
 * ACROSS rotated IPs by counting failures per normalized email regardless of
 * source IP:
 *
 *   — recordLoginFailure(email, ip)      append one failed attempt
 *   — resetLoginFailures(email)          clear the history (successful login)
 *   — isEmailLockedOut(email)            true when the email is locked
 *   — getLockoutRemaining(email)         ms left of the lockout (0 = none)
 *
 * Rule: >= LOGIN_FAILURE_THRESHOLD failures within the last
 * LOGIN_FAILURE_WINDOW_MS → locked out for EMAIL_LOCKOUT_MS measured from the
 * LAST failure (each new failure while locked extends the lockout). Attempts
 * older than the window drop out of the rolling window automatically.
 *
 * Atomicity: the failure count is read via a single aggregation (one server
 * roundtrip) and each failure is a single insert — no transaction on purpose:
 * failure recording is best-effort by nature and a missed increment never
 * weakens other protections (the per-IP limiter still runs first).
 *
 * Timestamps are injectable through the Clock port (systemClock by default)
 * so the window/lockout math is unit-testable; the TTL cleanup itself is
 * MongoDB's job and is not unit-testable.
 */

/** Failures within the window that trigger the email lockout. */
export const LOGIN_FAILURE_THRESHOLD = 5;
/** Rolling window during which failures accumulate (60 minutes). */
export const LOGIN_FAILURE_WINDOW_MS = 60 * 60 * 1000;
/** Lockout duration measured from the LAST failure (30 minutes). */
export const EMAIL_LOCKOUT_MS = 30 * 60 * 1000;
/** TTL of a login-attempt doc (24h) — the failure window is evaluated at
 *  query time, the doc outlives it for the email+IP audit trail. */
export const LOGIN_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

/** Normalized lockout key: trimmed + lowercase (case/padding-insensitive). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface FailureWindowRow {
  _id: unknown;
  count: number;
  lastFailureAt: Date;
}

/**
 * One aggregation: failures of the email within the rolling window + the
 * newest one (the lockout anchor). Returns null when the window is empty.
 */
async function readFailureWindow(
  email: string,
  clock: Clock,
): Promise<{ count: number; lastFailureAt: Date } | null> {
  const windowStart = new Date(clock.now().getTime() - LOGIN_FAILURE_WINDOW_MS);
  const [row] = await LoginAttemptModel.aggregate<FailureWindowRow>([
    { $match: { email, createdAt: { $gte: windowStart } } },
    { $group: { _id: null, count: { $sum: 1 }, lastFailureAt: { $max: '$createdAt' } } },
  ]).exec();
  return row ? { count: row.count, lastFailureAt: row.lastFailureAt } : null;
}

/** Append one failed attempt for the email (from the given source IP). */
export async function recordLoginFailure(
  email: string,
  ip: string,
  clock: Clock = systemClock,
): Promise<void> {
  const now = clock.now();
  await LoginAttemptModel.create({
    email: normalizeEmail(email),
    ip,
    createdAt: now,
    expiresAt: new Date(now.getTime() + LOGIN_ATTEMPT_TTL_MS),
  });
}

/** Clear the email's failure history (call on successful login). */
export async function resetLoginFailures(email: string): Promise<void> {
  await LoginAttemptModel.deleteMany({ email: normalizeEmail(email) }).exec();
}

/**
 * Milliseconds left of the email lockout (0 when not locked). The lockout
 * lasts EMAIL_LOCKOUT_MS from the LAST failure, so every new failure while
 * locked stretches the remaining time back to the full duration.
 */
export async function getLockoutRemaining(
  email: string,
  clock: Clock = systemClock,
): Promise<number> {
  const row = await readFailureWindow(normalizeEmail(email), clock);
  if (!row || row.count < LOGIN_FAILURE_THRESHOLD) return 0;
  const lockoutEnd = row.lastFailureAt.getTime() + EMAIL_LOCKOUT_MS;
  return Math.max(0, lockoutEnd - clock.now().getTime());
}

/** True when the email is currently locked out (regardless of source IP). */
export async function isEmailLockedOut(
  email: string,
  clock: Clock = systemClock,
): Promise<boolean> {
  return (await getLockoutRemaining(email, clock)) > 0;
}