import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Durable audit trail of critical financial operations (R12 C2).
 *
 * Technical/infrastructure record — NOT a domain entity. Each document captures
 * the minimal metadata needed for retrospective auditing: who (userId, never an
 * email), what (action), on which entity (entityType/entityId), outcome
 * (success/error/duplicate), correlation (idempotencyKey), timing and an
 * optional short error code. Deliberately NO PII: no emails, names, tokens,
 * payloads, entity snapshots or stack traces are stored.
 *
 * Writes are best-effort: a failed audit write must never break the financial
 * operation it accompanies (see operation-log-repository).
 */
export const OperationLogSchema = new Schema(
  {
    /** Actor — the user id, NEVER an email. */
    userId: { type: String, required: true, index: true },
    /** Operation name, e.g. 'createMovement', 'deleteSale', 'login'. */
    action: { type: String, required: true },
    /** Entity kind, e.g. 'movement', 'transfer', 'sale', 'auth'. */
    entityType: { type: String, required: true },
    /** Id of the affected entity, when known at that point. */
    entityId: { type: String },
    /** Outcome: 'success' | 'error' | 'duplicate'. */
    result: {
      type: String,
      required: true,
      enum: ['success', 'error', 'duplicate'],
    },
    /** Correlation — the idempotencyKey of the action, when present. */
    correlationId: { type: String },
    /** Milliseconds the operation took. */
    durationMs: { type: Number },
    /** Short classified error code/message (never a stack trace). */
    errorCode: { type: String },
    occurredAt: { type: Date, required: true, index: true },
  },
  { timestamps: false, versionKey: false },
);

// Composite index for retrospective auditing: all ops of a user, newest first.
OperationLogSchema.index({ userId: 1, occurredAt: -1 });

export type OperationLogDocument = InferSchemaType<typeof OperationLogSchema>;

export const OperationLogModel =
  mongoose.models.OperationLog ||
  mongoose.model('OperationLog', OperationLogSchema);
