import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Global anti-spike state for the /api/monitor route (R14-G, §6).
 *
 * Singleton document (`key: 'monitor:global'`) that counts NEW fingerprints
 * observed across ALL IPs inside a 5-min window. When the count exceeds the
 * threshold (30), `cooldownUntil` is set to now + 10 min and every monitor
 * request is rejected with 429 UNTIL the cooldown elapses — a distributed
 * flood of fresh fingerprints cannot keep minting new ErrorEvents + alert
 * emails.
 *
 * The TTL (`expiresAt`) normally follows the 5-min count window (mirroring
 * the rate-limit model). When a cooldown is ENTERED, the guard extends
 * `expiresAt` out to `cooldownUntil` so the active cooldown stays readable
 * for its full 10 minutes and is only swept after it expired.
 *
 * Writers are the monitor guard (`monitor-guard.ts`); the route only READS
 * it via `checkGlobalCooldown()`.
 */
const MonitorCooldownSchema = new Schema(
  {
    /** Singleton key: 'monitor:global'. */
    key: { type: String, required: true, unique: true },
    /** NEW fingerprints counted in the current 5-min window. */
    newFingerprintCount: { type: Number, required: true, default: 0 },
    /** Fixed-window bucket start (aligned to 5-min boundaries). */
    windowStart: { type: Date, required: true },
    /** While set to a FUTURE date, the global cooldown is active. */
    cooldownUntil: { type: Date, default: null },
    /** TTL: MongoDB auto-deletes the doc (extended while cooldown is active). */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false },
);

// TTL index — MongoDB auto-deletes after expiresAt (same pattern as rate-limit).
MonitorCooldownSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type MonitorCooldownDocument = InferSchemaType<
  typeof MonitorCooldownSchema
>;

export const MonitorCooldownModel =
  mongoose.models.MonitorCooldown ||
  mongoose.model('MonitorCooldown', MonitorCooldownSchema);