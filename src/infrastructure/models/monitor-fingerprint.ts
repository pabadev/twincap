import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Per-IP fingerprint budget for the /api/monitor route (R14-G, §6).
 *
 * One document per (ip, 15-min fixed window): the `key` embeds the BUCKET
 * START (`monitor-fp:<ip>:<windowStartMs>`), so every request inside the same
 * 15-minute slice resolves to the SAME document while a lapsed bucket is
 * never queried again (the TTL index sweeps it later).
 *
 * `fingerprints` holds the distinct fingerprints seen in the window. The
 * unique index on `key` guarantees exactly one document per window so
 * concurrent `$addToSet` writes serialize on the same document (no
 * find-then-save race) — an attacker flooding new fingerprints ends with
 * EXACTLY MAX_FINGERPRINTS_PER_IP entries, never unbounded growth.
 *
 * Readers/writers are the monitor guard (`monitor-guard.ts`); the route never
 * touches this model directly.
 */
const MonitorFingerprintSchema = new Schema(
  {
    /** `monitor-fp:<ip>:<windowStartMs>` — unique per (ip, fixed window). */
    key: { type: String, required: true, unique: true },
    /** Sanitized client IP (see client-ip.ts). */
    ip: { type: String, required: true },
    /** Distinct fingerprints observed in this window (bounded by the guard). */
    fingerprints: { type: [String], required: true, default: [] },
    /** Fixed-window bucket start (aligned to 15-min boundaries). */
    windowStart: { type: Date, required: true },
    /** TTL: MongoDB auto-deletes the doc after the window lapses. */
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false },
);

// TTL index — MongoDB auto-deletes after expiresAt (same pattern as rate-limit).
MonitorFingerprintSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type MonitorFingerprintDocument = InferSchemaType<
  typeof MonitorFingerprintSchema
>;

export const MonitorFingerprintModel =
  mongoose.models.MonitorFingerprint ||
  mongoose.model('MonitorFingerprint', MonitorFingerprintSchema);