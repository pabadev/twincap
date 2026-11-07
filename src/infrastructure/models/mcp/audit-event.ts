import mongoose, { Schema } from "mongoose";

/** Security events only; never store bearer tokens, prompts, or financial output. */
const McpAuditEventSchema = new Schema(
  {
    actorUserId: { type: String, required: true },
    grantId: { type: String, required: true },
    clientId: { type: String, required: true },
    event: {
      type: String,
      enum: ["grant.created", "grant.revoked", "token.issued", "token.refreshed", "tool.called"],
      required: true,
    },
    result: { type: String, enum: ["success"], required: true, default: "success" },
    traceId: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false, collection: "mcpauditevents" },
);

McpAuditEventSchema.index({ actorUserId: 1, createdAt: -1 });
McpAuditEventSchema.index({ grantId: 1, createdAt: -1 });

export const McpAuditEventModel =
  (mongoose.models.McpAuditEvent as mongoose.Model<any> | undefined) ||
  mongoose.model<any>("McpAuditEvent", McpAuditEventSchema);
