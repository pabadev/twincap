import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import type { ErrorSeverity } from '../../core/application/ports';

/**
 * Persisted error event for the error monitoring system (R13-D).
 *
 * Technical/infrastructure record — NOT a domain entity. Stores ONE document
 * per unique error fingerprint (grouping/dedupe): the first occurrence fixes
 * `firstSeen` and `occurrenceCount: 1`; each subsequent occurrence increments
 * `occurrenceCount` and refreshes `lastSeen`.
 *
 * STRICT SANITIZATION (permanent rule, R13-D #9): the document NEVER stores
 * passwords, JWTs, cookies, Authorization headers, full request bodies, bank
 * data, financial amounts, unnecessary PII or rawData. `stack` is truncated
 * (4000) and `message` truncated (500); ONLY an allowlisted subset of context
 * keys is persisted (see the sanitizer, not this model). `firstUserId`/
 * `lastUserId` are the actor id — NEVER an email.
 *
 * Writes are best-effort: a failed write must never break the operation it
 * accompanies (see error-event-repository).
 */
export const ErrorEventSchema = new Schema(
  {
    /** Stable grouping key — hash of name+message+code+primary stack frame. */
    fingerprint: { type: String, required: true },
    /** Truncated (≤500) error message. */
    message: { type: String, required: true },
    /** Error class name, when present. */
    name: { type: String },
    /** Truncated (≤4000) stack trace. */
    stack: { type: String },
    severity: { type: String, required: true, enum: ['fatal', 'error', 'warning'] as ErrorSeverity[] },
    /** True = expected/known error (never alerted); false = unexpected crash. */
    expected: { type: Boolean, required: true },
    /** Short classified error code, when present (truncated ≤200). */
    code: { type: String },
    /** Environment (e.g. 'development' | 'production' from NODE_ENV). */
    environment: { type: String },
    /** Optional release/git sha. */
    release: { type: String },
    /** Allowlisted, sanitized context subdocument (No PII/payloads). */
    context: { type: Schema.Types.Mixed },
    firstSeen: { type: Date, required: true },
    lastSeen: { type: Date, required: true },
    /** Times this exact fingerprint has occurred. */
    occurrenceCount: { type: Number, required: true, default: 1 },
    /** Actor id of the first occurrence — NEVER an email. */
    firstUserId: { type: String },
    /** Actor id of the most recent occurrence — NEVER an email. */
    lastUserId: { type: String },
  },
  { timestamps: false, versionKey: false },
);

// Unique index for dedupe: a fingerprint can only exist once in the table.
ErrorEventSchema.index({ fingerprint: 1 }, { unique: true });

export type ErrorEventDocument = InferSchemaType<typeof ErrorEventSchema>;

export const ErrorEventModel =
  mongoose.models.ErrorEvent ||
  mongoose.model('ErrorEvent', ErrorEventSchema);
