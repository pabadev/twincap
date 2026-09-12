import { RateLimitModel } from '../models/rate-limit';

/**
 * Max re-entries of `check()` after a genuine E11000 duplicate-key create
 * race. The bound guarantees the create-loser path terminates: 1 first
 * attempt + up to 3 retries, then the last E11000 error propagates
 * (R15.3.1 P1.1 — no unbounded recursion).
 */
const MAX_E11000_CREATE_RETRIES = 3;

/**
 * True only for a MongoDB duplicate-key error (error code 11000). Any other
 * error — network, server selection, cast, validation — must NOT be treated
 * as a benign retry condition (R15.3.1 P1.1): such an error propagates
 * untouched instead of re-entering the check path.
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown })?.code === 11000;
}

export interface RateLimitConfig {
  /** Max attempts allowed within the window. */
  maxAttempts: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  attempts: number;
  resetAt: Date;
}

/**
 * MongoDB-backed fixed window rate limiter with an atomic increment (R14-C, §5).
 *
 * Each unique key (e.g. `login:email:ip`) gets a counter that resets
 * after the window expires (via TTL index on `expiresAt`). The unique index
 * on `key` guarantees one document per key, so concurrent `$inc` writes
 * serialize on the same document — every attempt is counted, with no
 * find-then-save race.
 */
export class MongoRateLimiter {
  constructor(private readonly config: RateLimitConfig) {}

  /**
   * Check and increment the attempt counter for a given key.
   * Returns `{ allowed: false }` when the limit is exceeded.
   */
  async check(key: string): Promise<RateLimitResult> {
    return this.checkWithCreateRetry(key, MAX_E11000_CREATE_RETRIES);
  }

  /**
   * Internal bounded variant of `check()`. `retriesLeft` limits how many
   * times a genuine E11000 create race re-enters the FULL check path (which
   * then hits the active-window `$inc` path of the concurrent winner). Any
   * non-duplicate error is rethrown untouched — no retry, original error
   * preserved. When E11000 persists past the bound, the last duplicate-key
   * error propagates instead of looping.
   */
  private async checkWithCreateRetry(
    key: string,
    retriesLeft: number,
  ): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.windowMs);
    const expiresAt = new Date(now.getTime() + this.config.windowMs);

    // Atomic $inc on the ACTIVE window document. The unique index on `key`
    // guarantees one document per key, so concurrent $inc writes serialize on
    // the same doc — every attempt is counted, no find-then-save race (R14-C §5).
    const active = await RateLimitModel.findOneAndUpdate(
      { key, windowStart: { $gte: windowStart } },
      { $inc: { attempts: 1 } },
      { new: true },
    );

    if (active) {
      return {
        allowed: active.attempts <= this.config.maxAttempts,
        attempts: active.attempts,
        resetAt: active.expiresAt,
      };
    }

    // No active window (first attempt or lapsed window): clean any STALE entry
    // for the same key, then create the fresh window. The conditional delete
    // only removes an expired doc, so a concurrent winner's fresh doc is never
    // wiped. The unique index makes a concurrent create loser throw E11000 →
    // bounded retry, which now hits the active-window $inc path above. ANY
    // non-duplicate create error propagates immediately (no retry, original
    // error preserved) — a network/server/validation failure must never loop.
    await RateLimitModel.deleteOne({ key, windowStart: { $lt: windowStart } });
    try {
      await RateLimitModel.create({
        key,
        attempts: 1,
        windowStart: now,
        expiresAt,
      });
    } catch (error: unknown) {
      if (!isDuplicateKeyError(error)) throw error;
      if (retriesLeft <= 0) throw error;
      return this.checkWithCreateRetry(key, retriesLeft - 1);
    }

    return { allowed: true, attempts: 1, resetAt: expiresAt };
  }

  /**
   * Reset the counter for a given key (e.g. after successful login).
   */
  async reset(key: string): Promise<void> {
    await RateLimitModel.deleteMany({ key });
  }
}

// Pre-configured instances
export const loginRateLimiter = new MongoRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const registerRateLimiter = new MongoRateLimiter({
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const passwordChangeRateLimiter = new MongoRateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const forgotPasswordRateLimiter = new MongoRateLimiter({
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

export const resendVerificationRateLimiter = new MongoRateLimiter({
  maxAttempts: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// Coarse per-IP gate for /api/monitor (R14-C). Generous limit so legitimate
// crash reports are never lost; Fase G adds fingerprint + cooldown throttling.
export const monitorRateLimiter = new MongoRateLimiter({
  maxAttempts: 120,
  windowMs: 15 * 60 * 1000, // 15 minutes
});

// Per-fingerprint alert throttle for the error monitor (R14-G §6): at most
// ONE alert email per error fingerprint per 30 minutes. check() combines the
// "has it alerted recently?" read with the "mark it alerted" write in ONE
// atomic call — the first check consumes the single allowed attempt, any
// further check within the window returns allowed:false (skip the email).
export const monitorAlertRateLimiter = new MongoRateLimiter({
  maxAttempts: 1,
  windowMs: 30 * 60 * 1000, // 30 minutes
});