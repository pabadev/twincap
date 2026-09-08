import mongoose, { Schema, type InferSchemaType } from 'mongoose';

/**
 * Persistent record of a user feedback submission (R14-L §11).
 *
 * Technical/infrastructure record — NOT a domain entity. Each document stores
 * the REAL delivery outcome (`delivered` | `failed`) of the feedback email so
 * the submit action can return an honest result and no feedback is ever lost.
 * Unlike OperationLog this record MAY carry contact info (`email`) because
 * support needs to follow up with the author.
 *
 * Writes are best-effort: a failed feedback write must never break the submit
 * flow (see feedback-repository).
 */
export const FeedbackSchema = new Schema(
  {
    /** Feedback kind: 'comment' | 'bug' | 'suggestion'. */
    kind: {
      type: String,
      required: true,
      enum: ['comment', 'bug', 'suggestion'],
    },
    /** The user's feedback message. */
    message: { type: String, required: true },
    /** Author — the user id. */
    userId: { type: String, required: true, index: true },
    /** Optional contact info — support follow-up (unlike OperationLog). */
    email: { type: String },
    /** Locale the feedback was submitted in. */
    locale: { type: String, required: true },
    /** Page the feedback was submitted from, when known. */
    page: { type: String },
    /** Real email delivery outcome: 'delivered' | 'failed'. */
    result: {
      type: String,
      required: true,
      enum: ['delivered', 'failed'],
    },
    attemptedAt: { type: Date, required: true, index: true },
  },
  { timestamps: false, versionKey: false },
);

// Composite index for support triage: all feedback of a user, newest first.
FeedbackSchema.index({ userId: 1, attemptedAt: -1 });

export type FeedbackDocument = InferSchemaType<typeof FeedbackSchema>;

export const FeedbackModel =
  mongoose.models.Feedback ||
  mongoose.model('Feedback', FeedbackSchema);