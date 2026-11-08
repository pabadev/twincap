"use server";

import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { getCurrentUser } from "@/infrastructure/auth/getCurrentUser";
import { connectDb } from "@/infrastructure/db/connection";
import { MembershipModel } from "@/infrastructure/models/membership";
import { WorkspaceModel } from "@/infrastructure/models/workspace";
import {
  getMcpIssuer,
  getMcpResource,
  isMcpEnabledForUser,
  MCP_CAPABILITY,
  MCP_MOVEMENTS_CAPABILITY,
} from "@/infrastructure/mcp/config";
import {
  getVerifiedOpenCodeClient,
  isAllowedOpenCodeRedirect,
} from "@/infrastructure/mcp/opencode-client";
import {
  approveAuthorizationTransaction,
  denyAuthorizationTransaction,
  findPendingAuthorizationTransaction,
} from "@/infrastructure/mcp/oauth-service";

async function context(formData: FormData) {
  const tx = formData.get("tx");
  if (typeof tx !== "string" || !/^[0-9a-f-]{36}$/i.test(tx)) return null;
  const user = await getCurrentUser();
  if (
    !user?.workspaceId ||
    !user.authTime ||
    Date.now() / 1000 - user.authTime > 600 ||
    !isMcpEnabledForUser(user.userId)
  )
    return null;
  await connectDb();
  if (!Types.ObjectId.isValid(user.userId) || !Types.ObjectId.isValid(user.workspaceId))
    return null;
  const [membership, workspace, transactionValue, client] = await Promise.all([
    MembershipModel.findOne({
      userId: user.userId,
      workspaceId: user.workspaceId,
      status: "active",
    })
      .select({ _id: 1 })
      .lean()
      .exec(),
    WorkspaceModel.findOne({ _id: user.workspaceId, ownerId: user.userId, status: "active" })
      .select({ _id: 1 })
      .lean()
      .exec(),
    findPendingAuthorizationTransaction(tx),
    getVerifiedOpenCodeClient().catch(() => null),
  ]);
  const transaction: any = transactionValue;
  if (
    !membership ||
    !workspace ||
    !transaction ||
    transaction.resource !== getMcpResource().toString() ||
    !client ||
    !isAllowedOpenCodeRedirect(transaction.redirectUri, client)
  )
    return null;
  return { user, tx, transaction };
}

export async function approveMcpConsent(formData: FormData): Promise<void> {
  const data = await context(formData);
  if (!data) redirect("/oauth/authorize?error=invalid_transaction");
  // The consent decision the user just made. Summary read is the base
  // permission (always granted); movements is opt-out via the checkbox
  // (the screen pre-checks it so a plain re-consent upgrades the grant —
  // the user can untick to keep totals-only).
  const grantedCapabilities: string[] = [MCP_CAPABILITY];
  if (formData.get("grantMovements") === "on") {
    if (!data.transaction.requestedCapabilities?.includes(MCP_MOVEMENTS_CAPABILITY)) {
      redirect("/oauth/authorize?error=invalid_transaction");
    }
    grantedCapabilities.push(MCP_MOVEMENTS_CAPABILITY);
  }
  const granted = await approveAuthorizationTransaction({
    transactionId: data.tx,
    userId: data.user.userId,
    personalWorkspaceId: data.user.workspaceId!,
    sessionVersion: data.user.sessionVersion,
    grantedCapabilities,
  });
  if (!granted) redirect("/oauth/authorize?error=invalid_transaction");
  const callback = new URL(granted.redirectUri);
  callback.searchParams.set("code", granted.code);
  callback.searchParams.set("state", granted.state);
  callback.searchParams.set("iss", getMcpIssuer().origin);
  redirect(callback.toString());
}

export async function denyMcpConsent(formData: FormData): Promise<void> {
  const data = await context(formData);
  if (!data) redirect("/oauth/authorize?error=invalid_transaction");
  const denied = await denyAuthorizationTransaction(data.tx);
  if (!denied) redirect("/oauth/authorize?error=invalid_transaction");
  const callback = new URL(denied);
  callback.searchParams.set("error", "access_denied");
  callback.searchParams.set("error_description", "The resource owner denied the request");
  callback.searchParams.set("state", data.transaction.state);
  callback.searchParams.set("iss", getMcpIssuer().origin);
  redirect(callback.toString());
}
