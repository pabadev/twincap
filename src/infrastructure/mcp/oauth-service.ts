import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import mongoose, { Types } from "mongoose";
import { MCP_CAPABILITY } from "./config";
import { createMcpToken, hashMcpToken } from "../auth/mcp-token";
import { McpAuthorizationGrantModel } from "../models/mcp/authorization-grant";
import { McpAuthorizationTransactionModel } from "../models/mcp/authorization-transaction";
import { McpOAuthCredentialModel } from "../models/mcp/oauth-credential";
import { UserModel } from "../models/user";
import { MembershipModel } from "../models/membership";
import { WorkspaceModel } from "../models/workspace";
import { McpAuditEventModel } from "../models/mcp/audit-event";

export const MCP_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1000;
export const MCP_ACCESS_TOKEN_TTL_SECONDS = 10 * 60;
export const MCP_REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const ACCESS_TOKEN_TTL_MS = MCP_ACCESS_TOKEN_TTL_SECONDS * 1000;
const REFRESH_TOKEN_TTL_MS = MCP_REFRESH_TOKEN_TTL_SECONDS * 1000;

export interface NewMcpAuthorizationTransaction {
  clientId: string;
  clientName: string;
  clientUri: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  resource: string;
  /** Capability scopes the client requested (validated subset; always includes MCP_CAPABILITY). */
  requestedCapabilities?: string[];
}

export interface McpTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
  resource: string;
}

export async function createAuthorizationTransaction(
  input: NewMcpAuthorizationTransaction,
): Promise<string> {
  const transactionId = randomUUID();
  await McpAuthorizationTransactionModel.create({
    ...input,
    transactionId,
    capabilities: [MCP_CAPABILITY],
    expiresAt: new Date(Date.now() + MCP_AUTHORIZATION_CODE_TTL_MS),
  });
  return transactionId;
}

export async function findPendingAuthorizationTransaction(transactionId: string) {
  return McpAuthorizationTransactionModel.findOne({
    transactionId,
    status: "pending",
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
}

export async function denyAuthorizationTransaction(transactionId: string): Promise<string | null> {
  const transaction: any = await McpAuthorizationTransactionModel.findOneAndUpdate(
    { transactionId, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: { status: "denied" } },
    { new: true },
  )
    .lean()
    .exec();
  return transaction?.redirectUri ?? null;
}

export async function approveAuthorizationTransaction(input: {
  transactionId: string;
  userId: string;
  personalWorkspaceId: string;
  sessionVersion: number;
  /** Capabilities the user consented to — already subset-validated by the action. */
  grantedCapabilities: string[];
}): Promise<{ code: string; redirectUri: string; state: string; grantId: string } | null> {
  const session = await mongoose.startSession();
  let result: { code: string; redirectUri: string; state: string; grantId: string } | null = null;

  try {
    await session.withTransaction(async () => {
      const transaction: any = await McpAuthorizationTransactionModel.findOneAndUpdate(
        {
          transactionId: input.transactionId,
          status: "pending",
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: "completed" } },
        { new: true, session },
      ).exec();
      if (!transaction) return;

      const grantId = new Types.ObjectId().toString();
      const grant = {
        _id: grantId,
        userId: input.userId,
        clientId: transaction.clientId,
        clientName: transaction.clientName,
        personalWorkspaceId: input.personalWorkspaceId,
        resource: transaction.resource,
        sessionVersion: input.sessionVersion,
        capabilities: input.grantedCapabilities,
        consentedAt: new Date(),
        status: "active",
      };
      await McpAuthorizationGrantModel.create([grant], { session });
      await McpAuditEventModel.create(
        [
          {
            actorUserId: input.userId,
            grantId,
            clientId: transaction.clientId,
            event: "grant.created",
            traceId: randomUUID(),
          },
        ],
        { session },
      );

      const code = createMcpToken();
      await McpOAuthCredentialModel.create(
        [
          {
            tokenHash: hashMcpToken(code),
            credentialType: "authorization_code",
            grantId,
            clientId: transaction.clientId,
            resource: transaction.resource,
            redirectUri: transaction.redirectUri,
            codeChallenge: transaction.codeChallenge,
            expiresAt: new Date(Date.now() + MCP_AUTHORIZATION_CODE_TTL_MS),
          },
        ],
        { session },
      );
      transaction.grantId = grantId;
      await transaction.save({ session });
      result = {
        code,
        redirectUri: transaction.redirectUri,
        state: transaction.state,
        grantId,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
  resource: string;
}): Promise<McpTokenResponse | null> {
  if (!validCodeVerifier(input.codeVerifier)) return null;
  const codeHash = hashMcpToken(input.code);
  const codeRecord: any = await McpOAuthCredentialModel.findOne({
    tokenHash: codeHash,
    credentialType: "authorization_code",
    status: "active",
    expiresAt: { $gt: new Date() },
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    resource: input.resource,
  })
    .lean()
    .exec();
  if (!codeRecord?.codeChallenge || !verifyPkce(input.codeVerifier, codeRecord.codeChallenge)) {
    return null;
  }

  const session = await mongoose.startSession();
  let result: McpTokenResponse | null = null;
  try {
    await session.withTransaction(async () => {
      const consumed: any = await McpOAuthCredentialModel.findOneAndUpdate(
        {
          _id: codeRecord._id,
          status: "active",
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: "consumed", consumedAt: new Date() } },
        { new: true, session },
      ).exec();
      if (!consumed) return;

      const grant: any = await McpAuthorizationGrantModel.findOne({
        _id: consumed.grantId,
        clientId: input.clientId,
        resource: input.resource,
        status: "active",
      })
        .session(session)
        .exec();
      if (!grant) return;

      result = await issueTokenPair({
        grantId: grant._id.toString(),
        actorUserId: grant.userId,
        clientId: grant.clientId,
        resource: grant.resource,
        scope: grant.capabilities.join(" "),
        session,
      });
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function rotateRefreshToken(input: {
  refreshToken: string;
  clientId: string;
  resource: string;
}): Promise<McpTokenResponse | null> {
  const tokenHash = hashMcpToken(input.refreshToken);
  const prior: any = await McpOAuthCredentialModel.findOne({
    tokenHash,
    credentialType: "refresh_token",
    expiresAt: { $gt: new Date() },
    clientId: input.clientId,
    resource: input.resource,
  })
    .lean()
    .exec();
  if (!prior) return null;

  if (prior.status === "consumed") {
    await revokeGrant(prior.grantId);
    return null;
  }
  if (prior.status !== "active") return null;

  const session = await mongoose.startSession();
  let result: McpTokenResponse | null = null;
  try {
    await session.withTransaction(async () => {
      const consumed: any = await McpOAuthCredentialModel.findOneAndUpdate(
        {
          _id: prior._id,
          status: "active",
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: "consumed", consumedAt: new Date() } },
        { new: true, session },
      ).exec();
      if (!consumed) return;

      const grant: any = await McpAuthorizationGrantModel.findOne({
        _id: consumed.grantId,
        clientId: input.clientId,
        resource: input.resource,
        status: "active",
      })
        .session(session)
        .exec();
      if (!grant) return;

      result = await issueTokenPair({
        grantId: grant._id.toString(),
        actorUserId: grant.userId,
        clientId: grant.clientId,
        resource: grant.resource,
        scope: grant.capabilities.join(" "),
        session,
        event: "token.refreshed",
      });
    });
  } finally {
    await session.endSession();
  }

  if (result) return result;

  // A concurrent or replayed refresh that lost the atomic consume race revokes
  // the grant family. This is intentionally fail-closed for duplicate use.
  const afterRace: any = await McpOAuthCredentialModel.findById(prior._id).lean().exec();
  if (afterRace?.status === "consumed") await revokeGrant(prior.grantId);
  return null;
}

async function issueTokenPair(input: {
  grantId: string;
  actorUserId: string;
  clientId: string;
  resource: string;
  scope: string;
  session: mongoose.ClientSession;
  event?: "token.issued" | "token.refreshed";
}): Promise<McpTokenResponse> {
  const accessToken = createMcpToken();
  const refreshToken = createMcpToken();
  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(now + REFRESH_TOKEN_TTL_MS);

  // mongoose 8: `create()` with a session must carry `ordered: true` per document
  // array with >1 element — the only such site was here (access + refresh in one
  // array), which made every token exchange throw during the transaction. Keep
  // the single-document-per-create convention used by the rest of this module.
  await McpOAuthCredentialModel.create(
    [
      {
        tokenHash: hashMcpToken(accessToken),
        credentialType: "access_token",
        grantId: input.grantId,
        clientId: input.clientId,
        resource: input.resource,
        expiresAt: accessExpiresAt,
      },
    ],
    { session: input.session },
  );
  await McpOAuthCredentialModel.create(
    [
      {
        tokenHash: hashMcpToken(refreshToken),
        credentialType: "refresh_token",
        grantId: input.grantId,
        clientId: input.clientId,
        resource: input.resource,
        expiresAt: refreshExpiresAt,
      },
    ],
    { session: input.session },
  );
  await McpAuditEventModel.create(
    [
      {
        actorUserId: input.actorUserId,
        grantId: input.grantId,
        clientId: input.clientId,
        event: input.event ?? "token.issued",
        traceId: randomUUID(),
      },
    ],
    { session: input.session },
  );

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: MCP_ACCESS_TOKEN_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: input.scope,
    resource: input.resource,
  };
}

export async function revokeToken(token: string): Promise<void> {
  const credential: any = await McpOAuthCredentialModel.findOne({
    tokenHash: hashMcpToken(token),
  })
    .lean()
    .exec();
  if (credential) await revokeGrant(credential.grantId);
}

export async function revokeGrant(grantId: string, userId?: string): Promise<boolean> {
  const session = await mongoose.startSession();
  let revoked = false;
  try {
    await session.withTransaction(async () => {
      const filter: Record<string, unknown> = { _id: grantId, status: "active" };
      if (userId) filter.userId = userId;
      const grant: any = await McpAuthorizationGrantModel.findOne(filter).session(session).exec();
      if (!grant) return;
      const updated = await McpAuthorizationGrantModel.updateOne(
        filter,
        { $set: { status: "revoked", revokedAt: new Date() } },
        { session },
      ).exec();
      if (updated.modifiedCount === 0) return;
      await McpOAuthCredentialModel.updateMany(
        { grantId, status: { $in: ["active", "consumed"] } },
        { $set: { status: "revoked" } },
        { session },
      ).exec();
      await McpAuditEventModel.create(
        [
          {
            actorUserId: grant.userId,
            grantId,
            clientId: grant.clientId,
            event: "grant.revoked",
            traceId: randomUUID(),
          },
        ],
        { session },
      );
      revoked = true;
    });
  } finally {
    await session.endSession();
  }
  return revoked;
}

export async function revokeAllGrantsForUser(userId: string): Promise<number> {
  const grants = await McpAuthorizationGrantModel.find({ userId, status: "active" })
    .select({ _id: 1 })
    .lean()
    .exec();
  let count = 0;
  for (const grant of grants) {
    if (await revokeGrant(String(grant._id), userId)) count += 1;
  }
  return count;
}

export async function listActiveGrantsForUser(userId: string) {
  return McpAuthorizationGrantModel.find({ userId, status: "active" })
    .sort({ consentedAt: -1 })
    .select({ clientId: 1, clientName: 1, capabilities: 1, consentedAt: 1, lastUsedAt: 1 })
    .lean()
    .exec();
}

export async function verifyMcpAccessToken(token: string) {
  const credential: any = await McpOAuthCredentialModel.findOne({
    tokenHash: hashMcpToken(token),
    credentialType: "access_token",
    status: "active",
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
  if (!credential) return null;

  const grant: any = await McpAuthorizationGrantModel.findOne({
    _id: credential.grantId,
    status: "active",
    clientId: credential.clientId,
    resource: credential.resource,
  })
    .lean()
    .exec();
  if (
    !grant ||
    !Types.ObjectId.isValid(grant.userId) ||
    !Types.ObjectId.isValid(grant.personalWorkspaceId)
  ) {
    return null;
  }

  const [userValue, membership, workspace] = await Promise.all([
    UserModel.findById(grant.userId).select({ sessionVersion: 1 }).lean().exec(),
    MembershipModel.findOne({
      userId: new Types.ObjectId(grant.userId),
      workspaceId: new Types.ObjectId(grant.personalWorkspaceId),
      status: "active",
    })
      .select({ _id: 1 })
      .lean()
      .exec(),
    WorkspaceModel.findOne({
      _id: new Types.ObjectId(grant.personalWorkspaceId),
      ownerId: new Types.ObjectId(grant.userId),
      status: "active",
    })
      .select({ _id: 1 })
      .lean()
      .exec(),
  ]);
  const user: any = userValue;
  if (
    !user ||
    user.sessionVersion !== grant.sessionVersion ||
    !membership ||
    !workspace ||
    !grant.capabilities.includes(MCP_CAPABILITY)
  ) {
    return null;
  }

  return {
    grantId: grant._id.toString(),
    userId: grant.userId,
    workspaceId: grant.personalWorkspaceId,
    clientId: grant.clientId,
    resource: grant.resource,
    scopes: grant.capabilities,
    expiresAt: credential.expiresAt,
  };
}

export async function getActiveGrantForUser(grantId: string, userId: string) {
  return McpAuthorizationGrantModel.findOne({ _id: grantId, userId, status: "active" })
    .lean()
    .exec();
}

export async function updateGrantLastUsed(grantId: string): Promise<void> {
  await McpAuthorizationGrantModel.updateOne(
    { _id: grantId, status: "active" },
    { $set: { lastUsedAt: new Date() } },
  ).exec();
}

export async function recordMcpToolCall(input: {
  actorUserId: string;
  grantId: string;
  clientId: string;
  traceId: string;
}): Promise<void> {
  await McpAuditEventModel.create({ ...input, event: "tool.called", result: "success" });
}

function validCodeVerifier(verifier: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(verifier);
}

function verifyPkce(verifier: string, challenge: string): boolean {
  const actual = createHash("sha256").update(verifier, "ascii").digest("base64url");
  const expectedBuffer = Buffer.from(challenge, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
