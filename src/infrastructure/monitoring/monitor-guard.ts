import { MonitorFingerprintModel } from '../models/monitor-fingerprint';
import { MonitorCooldownModel } from '../models/monitor-cooldown';

/** Max distinct fingerprints per IP inside one 15-min window. */
export const MAX_FINGERPRINTS_PER_IP = 30;
/** Fixed per-IP window: 15 minutes. */
export const FINGERPRINT_WINDOW_MS = 15 * 60 * 1000;
/** New fingerprints across all IPs that arm the global cooldown, per 5-min window. */
export const GLOBAL_COOLDOWN_THRESHOLD = 30;
/** Global counting window: 5 minutes. */
export const GLOBAL_WINDOW_MS = 5 * 60 * 1000;
/** How long the global cooldown stays active once armed. */
export const GLOBAL_COOLDOWN_MS = 10 * 60 * 1000;
/** Singleton key of the global cooldown document. */
export const MONITOR_GLOBAL_KEY = 'monitor:global';

/**
 * Injectable dependencies (tests substitute clock + models; production uses
 * the defaults). Mirrors the `MonitorDeps` pattern of error-monitor.ts.
 */
export interface MonitorGuardDeps {
  /** Clock for window/cooldown math. Default: real clock. */
  now: () => Date;
  /** Fingerprint budget model. Default: Mongo. */
  fingerprintModel: typeof MonitorFingerprintModel;
  /** Global cooldown model. Default: Mongo. */
  cooldownModel: typeof MonitorCooldownModel;
  /** New-fingerprint count that arms the global cooldown. Default: 30. */
  globalCooldownThreshold: number;
}

/**
 * Anti-spike gate for the PUBLIC /api/monitor route (R14-G, §6).
 *
 * The route is open to any client, so an attacker can mint unlimited NEW
 * fingerprints (a changing `message`/`stack` per request) and force unbounded
 * ErrorEvent growth + one alert email per fresh fingerprint. This guard adds
 * two layers of protection without ever dropping a legitimate crash report:
 *
 *  1. PER-IP BUDGET: at most MAX_FINGERPRINTS_PER_IP distinct fingerprints per
 *     IP per 15-min window. Repeats of a KNOWN fingerprint never consume the
 *     budget (`{ allowed: true, isNew: false }`); only fresh ones do.
 *  2. GLOBAL COOLDOWN: when new fingerprints across ALL IPs exceed the
 *     threshold inside a 5-min window, a 10-min cooldown arms and the route
 *     rejects every request with 429 until it lapses.
 *
 * FAIL-SAFE CONTRACT: these methods NEVER throw. Any unexpected error is
 * logged as a structured stderr JSON line and the call resolves with the
 * permissive result (`allowed: true`) — a broken guard must not block
 * legitimate reports. Callers must establish the DB connection BEFORE using
 * the guard (the route calls `connectDb()`; tests connect directly).
 */
export class MongoMonitorGuard {
  constructor(private readonly deps: Partial<MonitorGuardDeps> = {}) {}

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private get fingerprintModel(): typeof MonitorFingerprintModel {
    return this.deps.fingerprintModel ?? MonitorFingerprintModel;
  }

  private get cooldownModel(): typeof MonitorCooldownModel {
    return this.deps.cooldownModel ?? MonitorCooldownModel;
  }

  private get cooldownThreshold(): number {
    return this.deps.globalCooldownThreshold ?? GLOBAL_COOLDOWN_THRESHOLD;
  }

  /**
   * Fixed-window bucket start for a timestamp: the bucket is derived from the
   * CLOCK (not from the request's arrival instant), so every request inside
   * the same slice shares ONE document and the quota truly resets when the
   * window expires.
   */
  private bucketStartMs(nowMs: number, windowMs: number): number {
    return Math.floor(nowMs / windowMs) * windowMs;
  }

  /**
   * Register a fingerprint for `ip` against the 15-min per-IP budget.
   *
   * Returns `{ allowed, isNew }`:
   *  - known fingerprint            → `{ true,  false }` (repeat, no quota hit)
   *  - fresh fingerprint, quota left → `{ true,  true  }` (atomically added)
   *  - fresh fingerprint, quota full → `{ false, true  }` (rejected)
   * NEVER throws — on any error it logs and fails OPEN (`{ true, true }`).
   */
  async limitFingerprints(
    ip: string,
    fingerprint: string,
  ): Promise<{ allowed: boolean; isNew: boolean }> {
    try {
      const now = this.now();
      const windowStartMs = this.bucketStartMs(
        now.getTime(),
        FINGERPRINT_WINDOW_MS,
      );
      const key = `monitor-fp:${ip}:${windowStartMs}`;
      const expiresAt = new Date(now.getTime() + FINGERPRINT_WINDOW_MS);

      const doc = await this.fingerprintModel.findOne({ key });
      if (doc) {
        const seen =
          Array.isArray(doc.fingerprints) &&
          doc.fingerprints.includes(fingerprint);
        if (seen) {
          // Legitimate repeat of a known fingerprint — never consumes quota.
          return { allowed: true, isNew: false };
        }
        if (doc.fingerprints.length >= MAX_FINGERPRINTS_PER_IP) {
          // Fresh fingerprint but the per-IP budget for this window is gone.
          return { allowed: false, isNew: true };
        }
        // Budget left: CONDITIONAL atomic $addToSet. The filter targets the
        // first out-of-range array index, so concurrent adds serialize on the
        // document's write lock — a flood of distinct fingerprints ends with
        // EXACTLY MAX_FINGERPRINTS_PER_IP entries (no find-then-save race).
        const roomLeft = {
          key,
          [`fingerprints.${MAX_FINGERPRINTS_PER_IP - 1}`]: { $exists: false },
        };
        // Use updateOne + modifiedCount to distinguish a REAL $addToSet
        // (modifiedCount=1) from a no-op (modifiedCount=0) when two
        // concurrent requests send the SAME new fingerprint — the second
        // request matches the doc but $addToSet is a no-op because the
        // element is already present. modifiedCount is a first-class field
        // on UpdateResult (no includeResultMetadata / lastErrorObject
        // gymnastics needed).
        const updateResult = await this.fingerprintModel.updateOne(
          roomLeft,
          { $addToSet: { fingerprints: fingerprint } },
        );
        if (updateResult.matchedCount === 1 && updateResult.modifiedCount === 1) {
          // The $addToSet REALLY added this fingerprint — it is genuinely new.
          return { allowed: true, isNew: true };
        }
        if (updateResult.matchedCount === 1 && updateResult.modifiedCount === 0) {
          // The doc matched but $addToSet was a NO-OP: a concurrent request
          // added the SAME fingerprint already. This is a legitimate repeat,
          // NOT a new fingerprint — it must not consume quota NOR count toward
          // the global cooldown.
          return { allowed: true, isNew: false };
        }
        // Lost a race against concurrent adds (matchedCount=0: filter didn't
        // match because array filled between the earlier findOne and this
        // updateOne): re-check membership so a repeat stays allowed and only
        // a genuinely fresh fingerprint is rejected.
        const recheck = await this.fingerprintModel.findOne({ key });
        const nowSeen =
          Array.isArray(recheck?.fingerprints) &&
          recheck.fingerprints.includes(fingerprint);
        return nowSeen
          ? { allowed: true, isNew: false }
          : { allowed: false, isNew: true };
      }

      // No active bucket (first fingerprint of the window): clean any lapsed
      // doc for the same key (defensive; TTL also sweeps it) and create the
      // fresh bucket. The unique index on `key` makes a concurrent create
      // loser throw E11000 → retry once (the retry then finds the doc and
      // follows the normal path above) — same pattern as MongoRateLimiter.
      await this.fingerprintModel.deleteOne({
        key,
        windowStart: { $lt: new Date(windowStartMs) },
      });
      try {
        await this.fingerprintModel.create({
          key,
          ip,
          fingerprints: [fingerprint],
          windowStart: new Date(windowStartMs),
          expiresAt,
        });
        return { allowed: true, isNew: true };
      } catch {
        return this.limitFingerprints(ip, fingerprint);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'monitor_fingerprint_limit_failed',
          ip,
          error: message,
        }),
      );
      // FAIL-OPEN: an internal failure must never block legitimate reports.
      return { allowed: true, isNew: true };
    }
  }

  /**
   * Whether the GLOBAL cooldown is currently active. NEVER throws — on error
   * it logs and returns `{ inCooldown: false }` (a broken cooldown read must
   * not reject legitimate reports).
   */
  async checkGlobalCooldown(): Promise<{ inCooldown: boolean }> {
    try {
      const doc = await this.cooldownModel.findOne({ key: MONITOR_GLOBAL_KEY });
      const now = this.now();
      const inCooldown =
        doc?.cooldownUntil != null &&
        doc.cooldownUntil.getTime() > now.getTime();
      return { inCooldown };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'monitor_global_cooldown_check_failed',
          error: message,
        }),
      );
      return { inCooldown: false };
    }
  }

  /**
   * Count one NEW fingerprint in the 5-min global window. When the count
   * EXCEEDS the threshold, arms (or extends) the 10-min global cooldown and
   * returns `{ cooldownEntered: true }`. NEVER throws — on error it logs and
   * returns `{ cooldownEntered: false }`.
   *
   * The counting reuses the atomic $inc + E11000-retry pattern of
   * MongoRateLimiter so concurrent registrations are never lost.
   */
  async registerGlobalFingerprint(): Promise<{ cooldownEntered: boolean }> {
    try {
      const now = this.now();
      const threshold = this.cooldownThreshold;
      const windowStartMs = this.bucketStartMs(now.getTime(), GLOBAL_WINDOW_MS);
      const windowStart = new Date(windowStartMs);
      const expiresAt = new Date(now.getTime() + GLOBAL_WINDOW_MS);

      // $inc on the ACTIVE 5-min window (atomic, serialized per doc).
      const active = await this.cooldownModel.findOneAndUpdate(
        { key: MONITOR_GLOBAL_KEY, windowStart: { $gte: windowStart } },
        { $inc: { newFingerprintCount: 1 } },
        { new: true },
      );

      if (active) {
        const exceeded = active.newFingerprintCount > threshold;
        if (exceeded) {
          const cooldownUntil = new Date(now.getTime() + GLOBAL_COOLDOWN_MS);
          // Arm (or extend) the cooldown. `$max` never shortens an active
          // cooldown. The TTL is pushed out to the cooldown end so
          // checkGlobalCooldown can still READ the active cooldown — with the
          // plain 5-min TTL the doc would be swept before the 10-min cooldown
          // elapsed.
          await this.cooldownModel.updateOne(
            { key: MONITOR_GLOBAL_KEY },
            {
              $max: { cooldownUntil, expiresAt: cooldownUntil },
            },
          );
        }
        return { cooldownEntered: exceeded };
      }

      // No active window: clean the lapsed doc (TTL also sweeps it) and create
      // a fresh singleton with count 1. E11000 → retry once (the retry then
      // hits the $inc path above). The route only ever registers while NO
      // cooldown is active, so recreating the window cannot drop an active
      // cooldown in practice (direct callers are tests).
      await this.cooldownModel.deleteOne({
        key: MONITOR_GLOBAL_KEY,
        windowStart: { $lt: windowStart },
      });
      try {
        await this.cooldownModel.create({
          key: MONITOR_GLOBAL_KEY,
          newFingerprintCount: 1,
          windowStart,
          cooldownUntil: null,
          expiresAt,
        });
        return { cooldownEntered: false };
      } catch {
        return this.registerGlobalFingerprint();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'monitor_global_fingerprint_register_failed',
          error: message,
        }),
      );
      return { cooldownEntered: false };
    }
  }
}