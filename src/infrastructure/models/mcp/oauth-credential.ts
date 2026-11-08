import mongoose, { Schema, type InferSchemaType } from "mongoose";

export const McpOAuthCredentialSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    credentialType: {
      type: String,
      enum: ["authorization_code", "access_token", "refresh_token"],
      required: true,
    },
    grantId: { type: String, required: true, index: true },
    clientId: { type: String, required: true },
    resource: { type: String, required: true },
    redirectUri: { type: String },
    codeChallenge: { type: String },
    status: {
      type: String,
      enum: ["active", "consumed", "revoked"],
      required: true,
      default: "active",
    },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date },
  },
  { timestamps: true, versionKey: false },
);

McpOAuthCredentialSchema.index({ grantId: 1, credentialType: 1, status: 1 });
McpOAuthCredentialSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type McpOAuthCredentialDocument = InferSchemaType<typeof McpOAuthCredentialSchema>;

export const McpOAuthCredentialModel =
  (mongoose.models.McpOAuthCredential as mongoose.Model<McpOAuthCredentialDocument> | undefined) ||
  mongoose.model<McpOAuthCredentialDocument>("McpOAuthCredential", McpOAuthCredentialSchema);
