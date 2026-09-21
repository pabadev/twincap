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
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../infrastructure/repositories/account-repository";
import { MongoMovementRepository } from "../../../infrastructure/repositories/movement-repository";
import { MongoCategoryRepository } from "../../../infrastructure/repositories/category-repository";
import { MongoCreditReceivedRepository } from "../../../infrastructure/repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../../../infrastructure/repositories/credit-granted-repository";
import { MongoPayableRepository } from "../../../infrastructure/repositories/payable-repository";
import { MongoSaleRepository } from "../../../infrastructure/repositories/sale-repository";
import { MongoTransferRepository } from "../../../infrastructure/repositories/transfer-repository";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import { DashboardContent } from "../../../components/dashboard/dashboard-content";
import { ContentContainer } from "../../../components/ui/content-container";
import { computeActivosPasivos } from "../../../core/application/compute-activos-pasivos";
import type { DashboardFilters } from "../../../components/dashboard/dashboard-filters";
import { makeCategoryLabelResolver } from "../../../lib/resolve-category-label";
import { SYSTEM_NOTES_NAMESPACE } from "../../../lib/system-note";

export const dynamic = "force-dynamic";

/**
 * Restore dashboard filters from the traveling-filter query contract (UX-5
 * §4.3). Unknown/invalid values are ignored so a stale or tampered URL can
 * never produce a filter select with no matching option.
 */
function filtersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
  accounts: Array<{ id: string }>,
  categories: Array<{ id: string }>,
): DashboardFilters {
  const scope = params.scope === "Personal" || params.scope === "Business" ? params.scope : "all";
  const accountId =
    typeof params.cuenta === "string" && accounts.some((a) => a.id === params.cuenta)
      ? params.cuenta
      : "all";
  const categoryId =
    typeof params.categoria === "string" && categories.some((c) => c.id === params.categoria)
      ? params.categoria
      : "all";
  return { scope, accountId, categoryId };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/login");

  const t = await getT("Dashboard");
  const locale = await getLocale();

  await connectDb();
  const userRepo = new MongoUserRepository();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const categoryRepo = new MongoCategoryRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();
  const creditGrantedRepo = new MongoCreditGrantedRepository();
  const payableRepo = new MongoPayableRepository();
  const saleRepo = new MongoSaleRepository();
  const transferRepo = new MongoTransferRepository();

  const [userEntity, accounts] = await Promise.all([
    userRepo.findById(user.userId),
    listAccounts(user.workspaceId!, accountRepo),
  ]);

  // R14-I: snapshot reads the union window (current civil year ∪ last 6 civil
  // months); balances keep reading FULL history (R7-A semantics unchanged).
  // Page server render uses the same default tzOffsetMinutes (0) as
  // buildDashboardSnapshot below.
  const { from, to } = computeDashboardWindow(new Date());

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

  // R6-P1: defensive filter — drop movements whose linked parent is gone
  // (orphans from a deletion that failed to cascade must not reach the
  // dashboard or its aggregations). R15.2: shared assembly via
  // collectLiveParentIds (single source of truth with actions.ts).
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
  const serializedCategories = categories.map((c) => c.toJSON());

  // Restore filters from the traveling-filter query contract (UX-5 §4.3).
  // Validation against real entity IDs prevents stale/tampered URLs from
  // producing unresolvable filter selects.
  const initialFilters = filtersFromSearchParams(params, accounts, serializedCategories);

  // R7-A: derive each account's balance from the LIVE (parent-filtered) movements.
  const balanceByAccount = accountBalancesFromMovements(accounts, liveBalanceMovements);

  const accountBalances = accounts.map((account) => ({
    id: account.id,
    name: account.name,
    currency: account.currency,
    isFixed: account.isFixed,
    balance: balanceByAccount.get(account.id) ?? 0,
  }));

  // §13: explicit fallback via DEFAULT_CURRENCY — no silent hardcoded string.
  const primaryCurrency = accounts.length > 0 ? accounts[0].currency : DEFAULT_CURRENCY;

  const positionData = computeActivosPasivos({
    accounts: accountBalances,
    creditsGranted: creditsGranted.map((c) => ({
      principal: { currency: c.principal.currency },
      pending: c.pending,
      writtenOff: Boolean(c.writtenOff),
    })),
    creditsReceived,
    payables,
  });

  const tSystemNotes = await getT(SYSTEM_NOTES_NAMESPACE);
  const resolveCategoryLabel = makeCategoryLabelResolver({
    categories: serializedCategories,
    tSystemNotes,
    tDashboard: t,
  });

  const initialSnapshot = buildDashboardSnapshot({
    accounts: accountBalances,
    categories: serializedCategories,
    movements: liveMovements,
    filters: initialFilters,
    locale,
    primaryCurrency,
    resolveCategoryLabel,
    // N4 (UX-5): attention section — receivables + payables pendings and
    // overdue payables are derived here from the entities the page already
    // reads; `pending` is a derived number getter, currency comes from the
    // credit/payable principal or total (same pattern as computeActivosPasivos).
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

  return (
    <ContentContainer>
      <DashboardContent
        accounts={accountBalances}
        categories={serializedCategories}
        primaryCurrency={primaryCurrency}
        locale={locale}
        userLabel={t("welcomeBack")}
        userName={userEntity?.name}
        noAccountsMessage={t("noAccounts")}
        noMovementsMessage={t("noMovements")}
        positionData={positionData.positions}
        initialSnapshot={initialSnapshot}
      />
    </ContentContainer>
  );
}
