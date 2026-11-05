import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * Product analytics events (R13-G).
 *
 * Infrastructure record — NOT a domain entity. Tracks activation, retention,
 * and usage metrics for the beta. Each document is a single discrete event
 * (no dedupe/upsert — every occurrence is recorded).
 *
 * NO PII: only workspaceId (tenant boundary) and userId (actor id, never email).
 * Writes are best-effort: a failed write must never break the operation it
 * accompanies (see analytics-repository).
 */
export const AnalyticsEventSchema = new Schema(
  {
    /** Event name — see AnalyticsEventName in core/application/ports (first events dedup, regular events append). */
    eventName: { type: String, required: true, index: true },
    /** Tenant boundary — the workspace that owns this event. */
    workspaceId: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Actor id (NEVER an email). */
    userId: { type: String, required: true },
    /** Fixed low-cardinality dimensions; never store financial or user-entered values here. */
    feature: {
      type: String,
      enum: [
        "accounts",
        "categories",
        "movements",
        "transfers",
        "creditReceived",
        "creditGranted",
        "payables",
        "sales",
        "clients",
        "catalog",
        "inventory",
        "exports",
        "support",
      ],
    },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "paymentAdded",
        "paymentUpdated",
        "paymentDeleted",
        "markedPaid",
        "writtenOff",
        "stockAdjusted",
        "openingValueSet",
        "configured",
        "exported",
        "submitted",
      ],
    },
    metricScope: { type: String, enum: ["activation", "retention", "adoption", "support"] },
    context: { type: String, enum: ["Personal", "Business"] },
    /** When the event occurred. Defaults to now. */
    occurredAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false, versionKey: false },
);

// Composite index for querying events per workspace + name (activation/retention queries).
AnalyticsEventSchema.index({ workspaceId: 1, eventName: 1, occurredAt: -1 });

export type AnalyticsEventDocument = InferSchemaType<typeof AnalyticsEventSchema>;

export const AnalyticsEventModel =
  mongoose.models.AnalyticsEvent || mongoose.model("AnalyticsEvent", AnalyticsEventSchema);
