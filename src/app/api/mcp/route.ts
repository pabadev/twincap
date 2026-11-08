import {
  McpServer,
  createMcpHandler,
  requireBearerAuth,
  OAuthError,
  OAuthErrorCode,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { connectDb } from "@/infrastructure/db/connection";
import { env } from "@/infrastructure/config/env";
import {
  getMcpIssuer,
  getMcpResource,
  isAllowedMcpHost,
  isAllowedMcpOrigin,
  isMcpEnabledForUser,
  ALLOWED_MCP_CAPABILITIES,
  MCP_CAPABILITY,
  MCP_MOVEMENTS_CAPABILITY,
  OPENCODE_CLIENT_ID,
} from "@/infrastructure/mcp/config";
import {
  verifyMcpAccessToken,
  getActiveGrantForUser,
  updateGrantLastUsed,
  recordMcpToolCall,
} from "@/infrastructure/mcp/oauth-service";
import { toFinancialSummaryCurrencyRows } from "@/infrastructure/mcp/financial-summary-rows";
import {
  toMonthlySeriesRows,
  toMovementToolRows,
} from "@/infrastructure/mcp/movements-series-rows";
import { readDashboardSnapshot } from "@/infrastructure/dashboard/read-dashboard-snapshot";
import { mcpRateLimiter } from "@/infrastructure/auth/rate-limiter";
import { MongoMovementRepository } from "@/infrastructure/repositories/movement-repository";
import { MongoAccountRepository } from "@/infrastructure/repositories/account-repository";
import { MongoTransferRepository } from "@/infrastructure/repositories/transfer-repository";
import { MongoCreditReceivedRepository } from "@/infrastructure/repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "@/infrastructure/repositories/credit-granted-repository";
import { MongoPayableRepository } from "@/infrastructure/repositories/payable-repository";
import { MongoSaleRepository } from "@/infrastructure/repositories/sale-repository";
import { MongoCategoryRepository } from "@/infrastructure/repositories/category-repository";
import { collectLiveParentIds, filterMovementsWithLiveParents } from "@/core/application/movements";
import { serializeEntities } from "@/lib/serialize";
import { makeCategoryLabelResolver } from "@/lib/resolve-category-label";
import { getLocale, getT } from "@/i18n/server";
import { SYSTEM_NOTES_NAMESPACE } from "@/lib/system-note";
import type { SerializedMovement } from "@/core/domain/movement";
import type { Currency } from "@/core/domain/currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const metadataUrl = new URL(
  "/.well-known/oauth-protected-resource/api/mcp",
  getMcpIssuer(),
).toString();

const verifier = {
  async verifyAccessToken(token: string) {
    await connectDb();
    const principal = await verifyMcpAccessToken(token);
    if (!principal || !isMcpEnabledForUser(principal.userId))
      throw new OAuthError(OAuthErrorCode.InvalidToken, "Invalid access token");
    return {
      token,
      clientId: OPENCODE_CLIENT_ID,
      scopes: principal.scopes,
      expiresAt: Math.floor(principal.expiresAt.getTime() / 1000),
      resource: new URL(principal.resource),
      extra: {
        userId: principal.userId,
        workspaceId: principal.workspaceId,
        grantId: principal.grantId,
      },
    };
  },
};
const authGate = requireBearerAuth({
  verifier,
  requiredScopes: [MCP_CAPABILITY],
  expectedResource: getMcpResource(),
  resourceMetadataUrl: metadataUrl,
});

const handler = createMcpHandler(
  (ctx) => {
    const server = new McpServer({ name: "TwinCap", version: "1.0.0" });
    server.registerTool(
      "personal.get_financial_summary",
      {
        title: "Get personal financial summary",
        description:
          "Read aggregated income, expenses and financial result for the current or current year personal period. " +
          "Amounts are integer minor units per ISO 4217. Each currency row carries `decimals`: " +
          "main-unit amount = minor units / 10^decimals (COP decimals=0 → amounts are already whole pesos, do NOT divide; " +
          "USD/MXN/EUR/BRL decimals=2 → divide by 100). Uses the same economic classification and guarded sums as the dashboard.",
        inputSchema: z.object({ period: z.enum(["month", "year"]).default("month") }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ period }) => {
        const extra = ctx.authInfo?.extra as { userId?: string; grantId?: string } | undefined;
        const grantId = extra?.grantId;
        const userId = extra?.userId;
        if (!grantId || !userId || !isMcpEnabledForUser(userId))
          throw new Error("Authorization expired");
        await connectDb();
        const grant = await getActiveGrantForUser(grantId, userId);
        if (!grant || !grant.capabilities.includes(MCP_CAPABILITY))
          throw new Error("Authorization expired");
        const snapshot = await readDashboardSnapshot(
          grant.personalWorkspaceId,
          { scope: "Personal", accountId: "all", categoryId: "all", period },
          0,
        );
        await updateGrantLastUsed(grantId);
        await recordMcpToolCall({
          actorUserId: userId,
          grantId,
          clientId: ctx.authInfo?.clientId ?? "unknown",
          traceId: randomUUID(),
        });
        const result = {
          scope: "Personal",
          period,
          dataAsOf: snapshot.dataAsOf,
          currencies: toFinancialSummaryCurrencyRows(snapshot.periodComparison ?? []),
        };
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    server.registerTool(
      "personal.list_movements",
      {
        title: "List personal movements",
        description:
          "List the user's personal income/expense movements for the last N civil months (including the current one), newest first. " +
          "Amounts are integer minor units per ISO 4217 with `decimals` per row (COP=0 whole pesos, USD/MXN/EUR/BRL=2). " +
          "Same live-parent filtering as the dashboard: movements linked to deleted parents never appear. " +
          "Requires the personal.movements:read capability.",
        inputSchema: z.object({
          months: z.number().int().min(1).max(12).default(1),
          type: z.enum(["all", "income", "expense"]).default("all"),
          limit: z.number().int().min(1).max(200).default(100),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ months, type, limit }) => {
        const extra = ctx.authInfo?.extra as { userId?: string; grantId?: string } | undefined;
        const grantId = extra?.grantId;
        const userId = extra?.userId;
        if (!grantId || !userId || !isMcpEnabledForUser(userId))
          throw new Error("Authorization expired");
        await connectDb();
        const grant = await getActiveGrantForUser(grantId, userId);
        if (!grant) throw new Error("Authorization expired");
        if (!grant.capabilities.includes(MCP_MOVEMENTS_CAPABILITY))
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "missing_capability",
                  message:
                    "This grant lacks the personal.movements:read capability. Reconnect with 'Detalle de movimientos' enabled in the consent screen.",
                }),
              },
            ],
            isError: true,
          };
        const workspaceId = grant.personalWorkspaceId;

        const now = new Date();
        const windowFrom = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - Math.max(1, months) + 1, 1),
        );
        const windowTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

        const movementRepo = new MongoMovementRepository();
        const accountRepo = new MongoAccountRepository();
        const transferRepo = new MongoTransferRepository();
        const creditReceivedRepo = new MongoCreditReceivedRepository();
        const creditGrantedRepo = new MongoCreditGrantedRepository();
        const payableRepo = new MongoPayableRepository();
        const saleRepo = new MongoSaleRepository();
        const categoryRepo = new MongoCategoryRepository();

        const [
          movements,
          accounts,
          transfers,
          creditsReceived,
          creditsGranted,
          payables,
          sales,
          categories,
        ] = await Promise.all([
          movementRepo.findByWorkspaceIdAndDateRange(workspaceId, windowFrom, windowTo),
          accountRepo.findByWorkspaceId(workspaceId),
          transferRepo.findByWorkspaceId(workspaceId),
          creditReceivedRepo.findByWorkspaceId(workspaceId),
          creditGrantedRepo.findByWorkspaceId(workspaceId),
          payableRepo.findByWorkspaceId(workspaceId),
          saleRepo.findByWorkspaceId(workspaceId),
          categoryRepo.findByWorkspaceId(workspaceId),
        ]);

        const liveParents = collectLiveParentIds({
          accounts,
          transfers,
          creditsReceived,
          creditsGranted,
          sales,
          payables,
        });
        const serialized = serializeEntities(
          filterMovementsWithLiveParents(movements, liveParents),
        ) as SerializedMovement[];

        const currencyByAccount = new Map<string, Currency>(
          accounts.map((a) => [a.id, a.currency as Currency]),
        );
        const accountNameOf = (accountId: string): string | null =>
          accounts.find((a) => a.id === accountId)?.name ?? null;

        const [tDashboard, tSystemNotes, locale] = await Promise.all([
          getT("Dashboard"),
          getT(SYSTEM_NOTES_NAMESPACE),
          getLocale(),
        ]);
        const labelOf = makeCategoryLabelResolver({
          categories: categories.map((category) => category.toJSON()),
          tSystemNotes,
          tDashboard,
        });

        const env = toMovementToolRows(serialized, currencyByAccount, accountNameOf, labelOf, {
          limit,
          type,
        });

        const result = {
          scope: "Personal",
          window: {
            months,
            windowFrom: windowFrom.toISOString(),
            windowTo: windowTo.toISOString(),
          },
          ...env,
        };
        await Promise.all([updateGrantLastUsed(grantId)]);
        await recordMcpToolCall({
          actorUserId: userId,
          grantId: grantId!,
          clientId: ctx.authInfo?.clientId ?? "unknown",
          traceId: randomUUID(),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );
    server.registerTool(
      "personal.get_monthly_series",
      {
        title: "Get personal monthly series",
        description:
          "Civil-month income/expense/result series for the user's personal workspace, newest last, from the same aggregators as the dashboard trend (up to 6 months). " +
          "Amounts are integer minor units per ISO 4217 with `decimals` per row (COP=0 whole pesos, USD/MXN/EUR/BRL=2). " +
          "Requires the personal.movements:read capability.",
        inputSchema: z.object({
          months: z.number().int().min(1).max(6).default(3),
        }),
        annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      },
      async ({ months }) => {
        const extra = ctx.authInfo?.extra as { userId?: string; grantId?: string } | undefined;
        const grantId = extra?.grantId;
        const userId = extra?.userId;
        if (!grantId || !userId || !isMcpEnabledForUser(userId))
          throw new Error("Authorization expired");
        await connectDb();
        const grant = await getActiveGrantForUser(grantId, userId);
        if (!grant) throw new Error("Authorization expired");
        if (!grant.capabilities.includes(MCP_MOVEMENTS_CAPABILITY))
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "missing_capability",
                  message:
                    "This grant lacks the personal.movements:read capability. Reconnect with 'Detalle de movimientos' enabled in the consent screen.",
                }),
              },
            ],
            isError: true,
          };

        const snapshot = await readDashboardSnapshot(grant.personalWorkspaceId, {
          scope: "Personal",
          accountId: "all",
          categoryId: "all",
          period: "month",
        });
        const result = {
          scope: "Personal",
          currency: snapshot.currency,
          series: toMonthlySeriesRows(snapshot.monthlyData, snapshot.currency, months),
        };
        await Promise.all([updateGrantLastUsed(grantId)]);
        await recordMcpToolCall({
          actorUserId: userId,
          grantId: grantId!,
          clientId: ctx.authInfo?.clientId ?? "unknown",
          traceId: randomUUID(),
        });
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: result,
        };
      },
    );

    return server;
  },
  { maxRequestBodySize: 65_536 },
);

export async function POST(request: Request): Promise<Response> {
  if (!env.MCP_ENABLED) return new Response("Not found", { status: 404 });
  if (!isAllowedMcpHost(request) || !isAllowedMcpOrigin(request))
    return new Response("Forbidden", { status: 403 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 65_536) return new Response("Payload too large", { status: 413 });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    return new Response("Unsupported media type", { status: 415 });
  const auth = await authGate(request);
  if (auth instanceof Response) return auth;
  const grantId = (auth.extra as { grantId?: string } | undefined)?.grantId;
  if (!grantId) return Response.json({ error: "invalid_token" }, { status: 401 });
  const limit = await mcpRateLimiter.check(`mcp:${grantId}`);
  if (!limit.allowed) {
    return Response.json(
      { error: "rate_limit_exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }
  return handler.fetch(request, { authInfo: auth });
}
