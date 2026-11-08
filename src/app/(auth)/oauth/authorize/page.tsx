import { redirect } from "next/navigation";
import { getCurrentUser, isAuthenticationRecent } from "@/infrastructure/auth/getCurrentUser";
import { connectDb } from "@/infrastructure/db/connection";
import { env } from "@/infrastructure/config/env";
import {
  getMcpResource,
  isMcpEnabledForUser,
  ALLOWED_MCP_CAPABILITIES,
  MCP_CAPABILITY,
  MCP_MOVEMENTS_CAPABILITY,
  OPENCODE_CLIENT_ID,
} from "@/infrastructure/mcp/config";
import {
  getVerifiedOpenCodeClient,
  isAllowedOpenCodeRedirect,
} from "@/infrastructure/mcp/opencode-client";
import {
  createAuthorizationTransaction,
  findPendingAuthorizationTransaction,
} from "@/infrastructure/mcp/oauth-service";
import { getT } from "@/i18n/server";
import { getClientIp } from "@/infrastructure/auth/client-ip";
import { mcpAuthorizationRateLimiter } from "@/infrastructure/auth/rate-limiter";
import { approveMcpConsent, denyMcpConsent } from "./actions";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
function one(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const t = await getT("Mcp");
  const txId = one(params.tx);
  if (!txId) {
    const clientId = one(params.client_id);
    const responseType = one(params.response_type);
    const redirectUri = one(params.redirect_uri);
    const state = one(params.state);
    const challenge = one(params.code_challenge);
    const challengeMethod = one(params.code_challenge_method);
    const resource = one(params.resource);
    const scope = one(params.scope);
    if (Array.isArray(params.resource) || Array.isArray(params.scope)) {
      return <Message title={t("authorizationUnavailable")} detail={t("invalidRequest")} />;
    }
    if (
      clientId !== OPENCODE_CLIENT_ID ||
      responseType !== "code" ||
      !redirectUri ||
      !state ||
      state.length < 16 ||
      state.length > 512 ||
      !challenge ||
      !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
      challengeMethod !== "S256" ||
      (resource && resource !== getMcpResource().toString()) ||
      (scope !== null &&
        (!scope.split(" ").filter(Boolean).includes(MCP_CAPABILITY) ||
          scope
            .split(" ")
            .filter(Boolean)
            .some((value) => !ALLOWED_MCP_CAPABILITIES.includes(value))))
    )
      return <Message title={t("authorizationUnavailable")} detail={t("invalidRequest")} />;

    if (!env.MCP_ENABLED)
      return <Message title={t("authorizationUnavailable")} detail={t("pilotDisabled")} />;
    await connectDb();
    const rateLimit = await mcpAuthorizationRateLimiter.check(`mcp-auth:${await getClientIp()}`);
    if (!rateLimit.allowed)
      return <Message title={t("authorizationUnavailable")} detail={t("tooManyRequests")} />;
    let client;
    try {
      client = await getVerifiedOpenCodeClient();
    } catch {
      return (
        <Message title={t("authorizationUnavailable")} detail={t("clientMetadataUnavailable")} />
      );
    }
    if (!isAllowedOpenCodeRedirect(redirectUri, client))
      return <Message title={t("authorizationUnavailable")} detail={t("invalidRequest")} />;
    const requestedCapabilities = scope
      ? scope.split(" ").filter((value) => ALLOWED_MCP_CAPABILITIES.includes(value))
      : [MCP_CAPABILITY];
    const transactionId = await createAuthorizationTransaction({
      clientId,
      clientName: client.clientName,
      clientUri: client.clientUri,
      redirectUri,
      state,
      codeChallenge: challenge,
      resource: getMcpResource().toString(),
      requestedCapabilities: requestedCapabilities.length
        ? requestedCapabilities
        : [MCP_CAPABILITY],
    });
    redirect(`/oauth/authorize?tx=${transactionId}`);
  }

  if (!/^[0-9a-f-]{36}$/i.test(txId))
    return <Message title={t("authorizationUnavailable")} detail={t("transactionExpired")} />;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?tx=${txId}`)}`);
  if (!isAuthenticationRecent(user.authTime)) {
    redirect(`/login?reauth=1&next=${encodeURIComponent(`/oauth/authorize?tx=${txId}`)}`);
  }
  if (!isMcpEnabledForUser(user.userId))
    return (
      <Message title={t("authorizationUnavailable")} detail={t("pilotNotEnabledForAccount")} />
    );
  await connectDb();
  const transaction = await findPendingAuthorizationTransaction(txId);
  if (
    !transaction ||
    transaction.clientId !== OPENCODE_CLIENT_ID ||
    transaction.resource !== getMcpResource().toString()
  ) {
    return <Message title={t("authorizationUnavailable")} detail={t("transactionExpired")} />;
  }
  const client = await getVerifiedOpenCodeClient().catch(() => null);
  if (!client || !isAllowedOpenCodeRedirect(transaction.redirectUri, client))
    return (
      <Message title={t("authorizationUnavailable")} detail={t("clientMetadataUnavailable")} />
    );
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("consentTitle")}</h1>
      <p>{t("consentIntro", { client: client.clientName })}</p>
      <dl className="space-y-2 rounded-xl border p-4">
        <div>
          <dt className="font-semibold">{t("account")}</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t("dataScope")}</dt>
          <dd>{t("personalScope")}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t("permissions")}</dt>
          <dd>{t("summaryRead")}</dd>
        </div>
      </dl>
      <p className="text-sm text-zinc-600">{t("modelDataNotice")}</p>
      <div className="flex gap-3">
        <form action={denyMcpConsent}>
          <input type="hidden" name="tx" value={txId} />
          <button className="rounded-lg border px-4 py-2" type="submit">
            {t("deny")}
          </button>
        </form>
        <form action={approveMcpConsent}>
          <input type="hidden" name="tx" value={txId} />
          {transaction.requestedCapabilities?.includes(MCP_MOVEMENTS_CAPABILITY) && (
            <label className="mb-3 flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="grantMovements"
                value="on"
                defaultChecked
                className="mt-1"
              />
              <span>
                <span className="block font-medium">{t("movementsScopeLabel")}</span>
                <span className="block text-zinc-600">{t("movementsScopeHint")}</span>
              </span>
            </label>
          )}
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-white" type="submit">
            {t("approve")}
          </button>
        </form>
      </div>
    </main>
  );
}

function Message({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto max-w-lg space-y-3 p-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p>{detail}</p>
    </main>
  );
}
