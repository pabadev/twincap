"use server";

import { redirect } from "next/navigation";
import { DEFAULT_CURRENCY } from "../../../core/domain/currency";
import { getT, getLocale } from "../../../i18n/server";
import { listAccounts } from "../../../core/application/accounts";
import {
  filterMovementsWithLiveParents,
  accountBalancesFromMovements,
  collectLiveParentIds,
} from "../../../core/application/movements";
import { buildDashboardSnapshot } from "../../../core/application/dashboard/build-dashboard-snapshot";
import { computeDashboardWindow } from "../../../core/application/dashboard/compute-dashboard-window";
import { aggregateBusinessProfitability } from "../../../core/application/business-analytics/aggregate-business-profitability";
import { MongoCatalogItemRepository } from "../../../infrastructure/repositories/catalog-repository";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../infrastructure/repositories/account-repository";
import { MongoMovementRepository } from "../../../infrastructure/repositories/movement-repository";
import { MongoCategoryRepository } from "../../../infrastructure/repositories/category-repository";
import { MongoCreditReceivedRepository } from "../../../infrastructure/repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../../../infrastructure/repositories/credit-granted-repository";
import { MongoPayableRepository } from "../../../infrastructure/repositories/payable-repository";
import { MongoSaleRepository } from "../../../infrastructure/repositories/sale-repository";
import { MongoTransferRepository } from "../../../infrastructure/repositories/transfer-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import type { DashboardFilters } from "../../../components/dashboard/dashboard-filters";
import type { DashboardSnapshot } from "../../../components/dashboard/dashboard-snapshot";
import { makeCategoryLabelResolver } from "../../../lib/resolve-category-label";
import { SYSTEM_NOTES_NAMESPACE } from "../../../lib/system-note";
import { reportUnexpectedErrorAndWait } from "../../../lib/report-unexpected-error";
import { trackAnalytics } from "../../../lib/track-analytics";

/**
 * Server action that re-aggregates the dashboard snapshot for a given filter
 * set. The client calls this on every filter change instead of re-filtering
 * and re-aggregating the full movement list in memory — only the aggregate
 * snapshot is sent back across the boundary.
 */
export async function getDashboardSnapshotAction(
  filters: DashboardFilters,
  tzOffsetMinutes = 0,
): Promise<DashboardSnapshot> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  try {
    await connectDb();

    const accountRepo = new MongoAccountRepository();
    const movementRepo = new MongoMovementRepository();
    const categoryRepo = new MongoCategoryRepository();
    const creditReceivedRepo = new MongoCreditReceivedRepository();
    const creditGrantedRepo = new MongoCreditGrantedRepository();
    const payableRepo = new MongoPayableRepository();
    const saleRepo = new MongoSaleRepository();
    const transferRepo = new MongoTransferRepository();

    const accounts = await listAccounts(user.workspaceId!, accountRepo);

    // R14-I: same civil-clock basis as buildDashboardSnapshot below — the
    // tzOffsetMinutes the client already sends. Snapshot reads the union
    // window; balances keep reading FULL history (R7-A, identical numbers).
    // H-19: when the business window is active (scope=Business + from/to), the
    // aggregation window is REPLACED by the tab's own range — a custom range
    // can extend beyond the default union window.
    const { from: defaultFrom, to: defaultTo } = computeDashboardWindow(
      new Date(),
      tzOffsetMinutes,
    );
    const businessRangeActive =
      filters.scope === "Business" &&
      typeof filters.from === "string" &&
      typeof filters.to === "string";
    const from = businessRangeActive
      ? new Date(`${filters.from}T00:00:00.000Z`).getTime() < defaultFrom.getTime()
        ? new Date(`${filters.from}T00:00:00.000Z`)
        : defaultFrom
      : defaultFrom;
    const to = businessRangeActive
      ? (() => {
          const toExclusive = new Date(`${filters.to}T00:00:00.000Z`);
          toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
          return toExclusive.getTime() > defaultTo.getTime() ? toExclusive : defaultTo;
        })()
      : defaultTo;

    const [
      windowedMovements,
      balanceMovements,
      categories,
      creditsReceived,
      creditsGranted,
      payables,
      sales,
      transfers,
    ] = await Promise.all([
      movementRepo.findByWorkspaceIdAndDateRange(user.workspaceId!, from, to),
      movementRepo.findByWorkspaceIdForBalance(user.workspaceId!),
      categoryRepo.findByWorkspaceId(user.workspaceId!),
      creditReceivedRepo.findByWorkspaceId(user.workspaceId!),
      creditGrantedRepo.findByWorkspaceId(user.workspaceId!),
      payableRepo.findByWorkspaceId(user.workspaceId!),
      saleRepo.findByWorkspaceId(user.workspaceId!),
      transferRepo.findByWorkspaceId(user.workspaceId!),
    ]);

    // R6-P1 defensive filter + R7-A balance derivation — same source/pattern
    // as page.tsx. R15.2: shared assembly via collectLiveParentIds (single
    // source of truth; also fixes the actions/page inconsistency where the
    // sale amount was a Money here but minor units in the page — the page
    // shape is the canonical one).
    const liveParents = collectLiveParentIds({
      accounts,
      transfers,
      creditsReceived,
      creditsGranted,
      sales,
      payables,
    });

    const liveMovements = filterMovementsWithLiveParents(windowedMovements, liveParents);
    // R7-A balances derive from the FULL live history (same filter, complete
    // read) — identical numbers to the pre-windowed dashboard.
    const liveBalanceMovements = filterMovementsWithLiveParents(balanceMovements, liveParents);
    const balanceByAccount = accountBalancesFromMovements(accounts, liveBalanceMovements);

    const accountBalancesWithBalance = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      isFixed: account.isFixed,
      balance: balanceByAccount.get(account.id) ?? 0,
    }));

    const serializedCategories = categories.map((c) => c.toJSON());

    // §13: explicit fallback via DEFAULT_CURRENCY — no silent hardcoded string.
    // When the workspace has no accounts yet, the dashboard still needs a
    // currency for aggregation scope; the named constant makes the choice
    // traceable (currency.ts) rather than an anonymous literal.
    const primaryCurrency = accounts.length > 0 ? accounts[0].currency : DEFAULT_CURRENCY;

    const [tDashboard, tSystemNotes, locale] = await Promise.all([
      getT("Dashboard"),
      getT(SYSTEM_NOTES_NAMESPACE),
      getLocale(),
    ]);

    const resolveCategoryLabel = makeCategoryLabelResolver({
      categories: serializedCategories,
      tSystemNotes,
      tDashboard,
    });

    // R13-G: track dashboard view (analytics, best-effort).
    await trackAnalytics("dashboardViewed", user.workspaceId!, user.userId);

    return buildDashboardSnapshot({
      accounts: accountBalancesWithBalance,
      categories: serializedCategories,
      movements: liveMovements,
      filters,
      locale,
      primaryCurrency,
      resolveCategoryLabel,
      tzOffsetMinutes,
      // N4 (UX-5): attention section — same entity→plain-data mapping as
      // page.tsx (pending is a derived number getter; currency comes from the
      // credit/payable principal or total).
      payables: payables.map((p) => ({
        id: p.id,
        pending: { amount: p.pending, currency: p.total.currency },
        dueDate: p.dueDate,
        description: p.counterparty,
      })),
      creditsGranted: creditsGranted.map((c) => ({
        pending: { amount: c.pending, currency: c.principal.currency },
        writtenOff: Boolean(c.writtenOff),
      })),
      creditsReceived: creditsReceived.map((c) => ({
        pending: { amount: c.pending, currency: c.principal.currency },
      })),
    });
  } catch (error) {
    // Report the unexpected crash (fail-safe, never re-raises), then preserve
    // the original behavior: let the exception propagate to the client's
    // generic error surface (the action previously had no try/catch).
    await reportUnexpectedErrorAndWait(error);
    throw error;
  }
}

/**
 * JSON-safe shape of one aggregate row for the Negocio tab (numbers/nulls/
 * strings only — the serialization boundary takes plain literals; the client
 * formats amounts from raw minor units with its own Money helpers).
 */
export interface BusinessSummaryRow {
  currency: string;
  salesMinor: number;
  saleCount: number;
  averageSaleMinor: number | null;
  knownCostMinor: number;
  grossProfitMinor: number | null;
  expensesMinor: number;
  receivableMinor: number;
  registeredResultMinor: number | null;
  incompleteSales: number;
  topItems: Array<{ itemId: string; name: string; salesMinor: number }>;
}

/**
 * Client-facing read for the Negocio tab's business-result block (H-19,
 * fundador 2026-10-31: the business profitability view integrates INTO the
 * Resumen). Pure read — no writes, no revalidation, no idempotency: the
 * response carries only its value (server-actions route contract).
 *
 * Mirrors the /business-analytics page pipeline exactly (same window
 * semantics: civil date at midnight UTC, exclusive end at +1 civil day; the
 * client tz only anchors "today"), then serializes the aggregate rows as a
 * JSON-safe payload (plain numbers/strings/nulls — serialization boundary
 * rule: everything literal, no class instances).
 */
export async function getBusinessResultAction(
  fromText: string,
  toText: string,
): Promise<BusinessSummaryRow[] | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    await connectDb();
    const salesRepo = new MongoSaleRepository();
    const movementRepo = new MongoMovementRepository();
    const accountRepo = new MongoAccountRepository();
    const transferRepo = new MongoTransferRepository();
    const creditReceivedRepo = new MongoCreditReceivedRepository();
    const creditGrantedRepo = new MongoCreditGrantedRepository();
    const payableRepo = new MongoPayableRepository();
    const catalogRepo = new MongoCatalogItemRepository();

    const fromCivil = new Date(`${fromText}T00:00:00.000Z`);
    const afterCivil = new Date(`${toText}T00:00:00.000Z`);
    afterCivil.setUTCDate(afterCivil.getUTCDate() + 1);

    const [
      sales,
      movements,
      accounts,
      transfers,
      creditsReceived,
      creditsGranted,
      payables,
      catalogItems,
    ] = await Promise.all([
      salesRepo.findByWorkspaceId(user.workspaceId!),
      movementRepo.findByWorkspaceIdAndDateRange(user.workspaceId!, fromCivil, afterCivil),
      accountRepo.findByWorkspaceId(user.workspaceId!),
      transferRepo.findByWorkspaceId(user.workspaceId!),
      creditReceivedRepo.findByWorkspaceId(user.workspaceId!),
      creditGrantedRepo.findByWorkspaceId(user.workspaceId!),
      payableRepo.findByWorkspaceId(user.workspaceId!),
      catalogRepo.findByWorkspaceId(user.workspaceId!),
    ]);

    const liveParents = collectLiveParentIds({
      accounts,
      transfers,
      creditsReceived,
      creditsGranted,
      sales,
      payables,
    });

    const aggregateRows = aggregateBusinessProfitability({
      sales,
      movements: filterMovementsWithLiveParents(movements, liveParents),
      serviceItemIds: new Set(
        catalogItems.filter((item) => item.type === "service").map((item) => item.id),
      ),
      catalogItems: catalogItems.map((item) => ({ id: item.id, name: item.name })),
      creditsGranted,
      from: fromCivil,
      toExclusive: afterCivil,
    });

    // JSON-safe projection of the aggregate rows (numbers/nulls/strings only —
    // the serialization boundary takes plain literals).
    return aggregateRows.map((row) => ({
      currency: row.currency,
      salesMinor: row.salesMinor,
      saleCount: row.saleCount,
      averageSaleMinor: row.averageSaleMinor ?? null,
      knownCostMinor: row.knownCostMinor,
      grossProfitMinor: row.grossProfitMinor ?? null,
      expensesMinor: row.expensesMinor,
      receivableMinor: row.receivableMinor,
      registeredResultMinor: row.registeredResultMinor ?? null,
      incompleteSales: row.incompleteSales,
      topItems: row.topItems.map((item) => ({
        itemId: item.itemId,
        name: item.name,
        salesMinor: item.salesMinor,
      })),
    }));
  } catch (error) {
    await reportUnexpectedErrorAndWait(error);
    // Read path: fail-open with an empty set, matching the movements paged
    // action. The UI renders its own empty state instead of an exception wall.
    return [];
  }
}
