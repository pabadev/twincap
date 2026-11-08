import mongoose, { Schema, type InferSchemaType } from "mongoose";

/**
 * OAuth authorization owned by one TwinCap user and one registered MCP client.
 * Persist only token digests; bearer credentials themselves are never stored.
 * This record is infrastructure state, not a domain entity.
 */
export const McpAuthorizationGrantSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true, maxlength: 120 },
    personalWorkspaceId: { type: String, required: true },
    resource: { type: String, required: true },
    sessionVersion: { type: Number, required: true, default: 0 },
    capabilities: {
      type: [String],
      required: true,
      default: [],
      enum: [
        "personal.summary:read",
        "personal.movements:read",
        "personal.accounts:read",
        "personal.credits:read",
        "personal.payables:read",
      ],
    },
    consentedAt: { type: Date, required: true },
    status: { type: String, enum: ["active", "revoked"], required: true, default: "active" },
    lastUsedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

McpAuthorizationGrantSchema.index({ userId: 1, status: 1, consentedAt: -1 });
McpAuthorizationGrantSchema.index({ userId: 1, clientId: 1, status: 1 });

export type McpAuthorizationGrantDocument = InferSchemaType<typeof McpAuthorizationGrantSchema>;

export const McpAuthorizationGrantModel =
  (mongoose.models.McpAuthorizationGrant as
    mongoose.Model<McpAuthorizationGrantDocument> | undefined) ||
  mongoose.model<McpAuthorizationGrantDocument>(
    "McpAuthorizationGrant",
    McpAuthorizationGrantSchema,
  );
