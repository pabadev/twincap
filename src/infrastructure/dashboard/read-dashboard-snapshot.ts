import { DEFAULT_CURRENCY } from "@/core/domain/currency";
import { listAccounts } from "@/core/application/accounts";
import {
  accountBalancesFromMovements,
  collectLiveParentIds,
  filterMovementsWithLiveParents,
} from "@/core/application/movements";
import { buildDashboardSnapshot } from "@/core/application/dashboard/build-dashboard-snapshot";
import { computeDashboardWindow } from "@/core/application/dashboard/compute-dashboard-window";
import type { DashboardFilters } from "@/core/application/dashboard/dashboard-types";
import { MongoAccountRepository } from "@/infrastructure/repositories/account-repository";
import { MongoCategoryRepository } from "@/infrastructure/repositories/category-repository";
import { MongoCreditGrantedRepository } from "@/infrastructure/repositories/credit-granted-repository";
import { MongoCreditReceivedRepository } from "@/infrastructure/repositories/credit-received-repository";
import { MongoMovementRepository } from "@/infrastructure/repositories/movement-repository";
import { MongoPayableRepository } from "@/infrastructure/repositories/payable-repository";
import { MongoSaleRepository } from "@/infrastructure/repositories/sale-repository";
import { MongoTransferRepository } from "@/infrastructure/repositories/transfer-repository";
import { getLocale, getT } from "@/i18n/server";
import { makeCategoryLabelResolver } from "@/lib/resolve-category-label";
import { SYSTEM_NOTES_NAMESPACE } from "@/lib/system-note";

/**
 * Shared dashboard read composition for the authenticated dashboard and MCP.
 * Callers must await connectDb() before invoking this function.
 */
export async function readDashboardSnapshot(
  workspaceId: string,
  filters: DashboardFilters,
  tzOffsetMinutes = 0,
) {
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const categoryRepo = new MongoCategoryRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();
  const creditGrantedRepo = new MongoCreditGrantedRepository();
  const payableRepo = new MongoPayableRepository();
  const saleRepo = new MongoSaleRepository();
  const transferRepo = new MongoTransferRepository();

  const accounts = await listAccounts(workspaceId, accountRepo);
  const { from: defaultFrom, to: defaultTo } = computeDashboardWindow(new Date(), tzOffsetMinutes);
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
    movementRepo.findByWorkspaceIdAndDateRange(workspaceId, from, to),
    movementRepo.findByWorkspaceIdForBalance(workspaceId),
    categoryRepo.findByWorkspaceId(workspaceId),
    creditReceivedRepo.findByWorkspaceId(workspaceId),
    creditGrantedRepo.findByWorkspaceId(workspaceId),
    payableRepo.findByWorkspaceId(workspaceId),
    saleRepo.findByWorkspaceId(workspaceId),
    transferRepo.findByWorkspaceId(workspaceId),
  ]);

  const liveParents = collectLiveParentIds({
    accounts,
    transfers,
    creditsReceived,
    creditsGranted,
    sales,
    payables,
  });
  const liveMovements = filterMovementsWithLiveParents(windowedMovements, liveParents);
  const liveBalanceMovements = filterMovementsWithLiveParents(balanceMovements, liveParents);
  const balanceByAccount = accountBalancesFromMovements(accounts, liveBalanceMovements);
  const accountsWithBalance = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    isFixed: account.isFixed,
    balance: balanceByAccount.get(account.id) ?? 0,
  }));
  const serializedCategories = categories.map((category) => category.toJSON());
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

  return buildDashboardSnapshot({
    accounts: accountsWithBalance,
    categories: serializedCategories,
    movements: liveMovements,
    filters,
    locale,
    primaryCurrency,
    resolveCategoryLabel,
    tzOffsetMinutes,
    payables: payables.map((payable) => ({
      id: payable.id,
      pending: { amount: payable.pending, currency: payable.total.currency },
      dueDate: payable.dueDate,
      description: payable.counterparty,
    })),
    creditsGranted: creditsGranted.map((credit) => ({
      pending: { amount: credit.pending, currency: credit.principal.currency },
      writtenOff: Boolean(credit.writtenOff),
    })),
    creditsReceived: creditsReceived.map((credit) => ({
      pending: { amount: credit.pending, currency: credit.principal.currency },
    })),
  });
}
