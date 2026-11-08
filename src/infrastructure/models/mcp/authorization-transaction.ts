import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { MCP_CAPABILITY } from "@/infrastructure/mcp/config";

/** Short-lived server-side state for a single interactive OAuth authorization. */
export const McpAuthorizationTransactionSchema = new Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    clientId: { type: String, required: true },
    clientName: { type: String, required: true, maxlength: 120 },
    clientUri: { type: String, required: true },
    redirectUri: { type: String, required: true },
    state: { type: String, required: true },
    codeChallenge: { type: String, required: true },
    resource: { type: String, required: true },
    capabilities: {
      type: [String],
      required: true,
      default: [],
      enum: ["personal.summary:read"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "denied"],
      required: true,
      default: "pending",
    },
    grantId: { type: String },
    /** Client-requested capability scopes (validated subset of ALLOWED_MCP_CAPABILITIES at authorize time). */
    requestedCapabilities: {
      type: [String],
      default: [MCP_CAPABILITY],
      required: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

McpAuthorizationTransactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type McpAuthorizationTransactionDocument = InferSchemaType<
  typeof McpAuthorizationTransactionSchema
>;

export const McpAuthorizationTransactionModel =
  (mongoose.models.McpAuthorizationTransaction as
    mongoose.Model<McpAuthorizationTransactionDocument> | undefined) ||
  mongoose.model<McpAuthorizationTransactionDocument>(
    "McpAuthorizationTransaction",
    McpAuthorizationTransactionSchema,
  );
