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
 * MongoDB-backed sliding window rate limiter.
 *
 * Each unique key (e.g. `login:email:ip`) gets a counter that resets
 * after the window expires (via TTL index on `expiresAt`).
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

    // Try to find an existing entry within the current window
    const existing = await RateLimitModel.findOne({
      key,
      windowStart: { $gte: windowStart },
    });

    if (existing) {
      // Increment attempts
      existing.attempts += 1;
      existing.expiresAt = expiresAt; // Extend TTL
      await existing.save();

      return {
        allowed: existing.attempts <= this.config.maxAttempts,
        attempts: existing.attempts,
        resetAt: existing.expiresAt,
      };
    }

    // No existing entry — create a new one (first attempt)
    await RateLimitModel.create({
      key,
      attempts: 1,
      windowStart: now,
      expiresAt,
    });

    return {
      allowed: true,
      attempts: 1,
      resetAt: expiresAt,
    };
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
