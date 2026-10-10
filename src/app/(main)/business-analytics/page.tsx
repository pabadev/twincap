import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { connectDb } from "../../../infrastructure/db/connection";
import { MongoSaleRepository } from "../../../infrastructure/repositories/sale-repository";
import { MongoMovementRepository } from "../../../infrastructure/repositories/movement-repository";
import { MongoAccountRepository } from "../../../infrastructure/repositories/account-repository";
import { MongoTransferRepository } from "../../../infrastructure/repositories/transfer-repository";
import { MongoCreditReceivedRepository } from "../../../infrastructure/repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../../../infrastructure/repositories/credit-granted-repository";
import { MongoPayableRepository } from "../../../infrastructure/repositories/payable-repository";
import { MongoCatalogItemRepository } from "../../../infrastructure/repositories/catalog-repository";
import { aggregateBusinessProfitability } from "../../../core/application/business-analytics/aggregate-business-profitability";
import {
  collectLiveParentIds,
  filterMovementsWithLiveParents,
} from "../../../core/application/movements";
import { getClientTzOffsetMinutes } from "../../../lib/client-tz";
import { formatAmount } from "../../../lib/format";
import { exponentOf } from "../../../core/domain/currency";
import { getLocale, getT } from "../../../i18n/server";
import { ContentContainer } from "../../../components/ui/content-container";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export default async function BusinessAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, params, locale, t, offset] = await Promise.all([
    getCurrentUser(),
    searchParams,
    getLocale(),
    getT("BusinessAnalytics"),
    getClientTzOffsetMinutes(),
  ]);
  if (!user) redirect("/login");

  const localNow = new Date();
  localNow.setTime(localNow.getTime() - offset * 60_000);
  const today = `${localNow.getUTCFullYear()}-${String(localNow.getUTCMonth() + 1).padStart(2, "0")}-${String(localNow.getUTCDate()).padStart(2, "0")}`;
  const monthStart = `${today.slice(0, 7)}-01`;
  const requestedFrom = validDate(params.desde) ? params.desde : monthStart;
  const requestedTo = validDate(params.hasta) ? params.hasta : today;
  const rangeIsValid = requestedFrom <= requestedTo;
  const fromText = requestedFrom;
  const toText = requestedTo;
  const queryFrom = rangeIsValid ? requestedFrom : monthStart;
  const queryTo = rangeIsValid ? requestedTo : today;
  const fromCivil = new Date(`${queryFrom}T00:00:00.000Z`);
  const afterCivil = new Date(`${queryTo}T00:00:00.000Z`);
  afterCivil.setUTCDate(afterCivil.getUTCDate() + 1);
  // Financial dates are civil dates encoded at midnight UTC throughout the
  // domain. The client's offset is only needed to determine the default
  // "today" above; applying it to an explicitly selected date range shifts
  // the interval and drops midnight-UTC sales for users west of UTC.
  const from = fromCivil;
  const toExclusive = afterCivil;

  await connectDb();
  const salesRepo = new MongoSaleRepository();
  const movementRepo = new MongoMovementRepository();
  const accountRepo = new MongoAccountRepository();
  const transferRepo = new MongoTransferRepository();
  const creditReceivedRepo = new MongoCreditReceivedRepository();
  const creditGrantedRepo = new MongoCreditGrantedRepository();
  const payableRepo = new MongoPayableRepository();
  const catalogRepo = new MongoCatalogItemRepository();
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
    movementRepo.findByWorkspaceIdAndDateRange(user.workspaceId!, from, toExclusive),
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
  const rows = aggregateBusinessProfitability({
    sales,
    movements: filterMovementsWithLiveParents(movements, liveParents),
    serviceItemIds: new Set(
      catalogItems.filter((item) => item.type === "service").map((item) => item.id),
    ),
    catalogItems: catalogItems.map((item) => ({ id: item.id, name: item.name })),
    creditsGranted,
    from,
    toExclusive,
  });

  return (
    <ContentContainer className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">{t("summaryTitle")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-surface-muted">{t("intro")}</p>
      </header>

      <Card title={t("period")}>
        <form method="get" className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Input type="date" name="desde" label={t("from")} defaultValue={fromText} />
          <Input type="date" name="hasta" label={t("to")} defaultValue={toText} />
          <Button type="submit">{t("apply")}</Button>
        </form>
      </Card>

      {!rangeIsValid ? (
        <Card>
          <p role="alert" className="text-sm text-danger">
            {t("invalidRange")}
          </p>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <p className="text-sm text-surface-muted">{t("empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-6">
          {rows.map((row) => (
            <Card key={row.currency} title={t("currency", { currency: row.currency })}>
              <dl className="grid grid-cols-1 gap-x-5 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
                <Metric
                  label={t("sales")}
                  value={formatAmount(
                    row.salesMinor / 10 ** exponentOf(row.currency),
                    row.currency,
                    locale,
                  )}
                />
                <Metric label={t("salesCount")} value={String(row.saleCount)} />
                <Metric
                  label={t("averageSale")}
                  value={
                    row.averageSaleMinor === null
                      ? t("notAvailable")
                      : formatAmount(
                          row.averageSaleMinor / 10 ** exponentOf(row.currency),
                          row.currency,
                          locale,
                        )
                  }
                />
                <Metric
                  label={t("cost")}
                  value={formatAmount(
                    row.knownCostMinor / 10 ** exponentOf(row.currency),
                    row.currency,
                    locale,
                  )}
                />
                <Metric
                  label={t("leftAfterProducts")}
                  value={
                    row.grossProfitMinor === null
                      ? t("needsCost")
                      : formatAmount(
                          row.grossProfitMinor / 10 ** exponentOf(row.currency),
                          row.currency,
                          locale,
                        )
                  }
                />
                <Metric
                  label={t("expenses")}
                  value={formatAmount(
                    row.expensesMinor / 10 ** exponentOf(row.currency),
                    row.currency,
                    locale,
                  )}
                />
                <Metric
                  label={t("leftAfterExpenses")}
                  value={
                    row.registeredResultMinor === null
                      ? t("needsCost")
                      : formatAmount(
                          row.registeredResultMinor / 10 ** exponentOf(row.currency),
                          row.currency,
                          locale,
                        )
                  }
                />
                <Metric
                  label={t("toCollect")}
                  value={formatAmount(
                    row.receivableMinor / 10 ** exponentOf(row.currency),
                    row.currency,
                    locale,
                  )}
                  description={t("toCollectHint")}
                />
              </dl>
              {row.incompleteSales > 0 && (
                <p className="mt-4 rounded-md bg-warning/10 p-3 text-sm">
                  {t("incompleteHint", { count: String(row.incompleteSales) })}
                </p>
              )}
              {row.topItems.length > 0 && (
                <section className="mt-6 border-t border-surface-border pt-5 dark:border-zinc-700">
                  <h2 className="mb-3 text-sm font-semibold">{t("topItems")}</h2>
                  <ol className="space-y-2">
                    {row.topItems.map((item, index) => (
                      <li
                        key={item.itemId}
                        className="flex items-center justify-between gap-4 text-sm"
                      >
                        <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                          <span className="mr-2 text-surface-muted">{index + 1}.</span>
                          {item.name}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums">
                          {formatAmount(
                            item.salesMinor / 10 ** exponentOf(row.currency),
                            row.currency,
                            locale,
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-surface-muted">{t("plainLanguageNote")}</p>
    </ContentContainer>
  );
}

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div>
      <dt className="text-sm text-surface-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
      {description && <dd className="mt-1 text-xs text-surface-muted">{description}</dd>}
    </div>
  );
}
