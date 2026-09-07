import { RateLimitModel } from '../models/rate-limit';

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
    // retry once, which now hits the active-window $inc path above.
    await RateLimitModel.deleteOne({ key, windowStart: { $lt: windowStart } });
    try {
      await RateLimitModel.create({ key, attempts: 1, windowStart: now, expiresAt });
    } catch {
      return this.check(key);
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