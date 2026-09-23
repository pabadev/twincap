import { redirect } from "next/navigation";
import { getT, getLocale } from "../../../i18n/server";
import { listAccounts } from "../../../core/application/accounts";
import { getUserBalances } from "../../../core/application/balance";
import { getCurrentUser } from "../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../infrastructure/repositories/account-repository";
import { MongoMovementRepository } from "../../../infrastructure/repositories/movement-repository";
import { MongoCreditReceivedRepository } from "../../../infrastructure/repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../../../infrastructure/repositories/credit-granted-repository";
import { MongoSaleRepository } from "../../../infrastructure/repositories/sale-repository";
import { MongoPayableRepository } from "../../../infrastructure/repositories/payable-repository";
import { MongoTransferRepository } from "../../../infrastructure/repositories/transfer-repository";
import { MongoUserRepository } from "../../../infrastructure/repositories/user-repository";
import { connectDb } from "../../../infrastructure/db/connection";
import { AccountsPageClient } from "./accounts-page-client";
import { DeleteAccountButton } from "./delete-account-button";
import { InitialBalanceButton } from "./initial-balance-button";
import { RenameAccountButton } from "./rename-account-button";
import { formatAmountParts } from "../../../lib/format";
import { EmptyState } from "../../../components/ui/empty-state";
import { Card } from "../../../components/ui/card";
import { Icon } from "../../../components/ui/icon";
import { Wallet } from "lucide-react";

export default async function AccountsPage() {
  const authUser = await getCurrentUser();
  if (!authUser) redirect("/login");

  const t = await getT("Accounts");
  const locale = await getLocale();

  await connectDb();
  const accountRepo = new MongoAccountRepository();
  const movementRepo = new MongoMovementRepository();
  const userRepo = new MongoUserRepository();
  const user = await userRepo.findById(authUser.userId);
  if (!user) redirect("/login");

  // R15.2: getUserBalances needs the live accounts (opening movements resolve
  // against them) and the parent repos to resolve link parents — listed first
  // so the balance read is sequential (accounts → full history → parents).
  const accounts = await listAccounts(authUser.workspaceId!, accountRepo);
  const balances = await getUserBalances(authUser.workspaceId!, accounts, movementRepo, {
    transferRepo: new MongoTransferRepository(),
    creditReceivedRepo: new MongoCreditReceivedRepository(),
    creditGrantedRepo: new MongoCreditGrantedRepository(),
    saleRepo: new MongoSaleRepository(),
    payableRepo: new MongoPayableRepository(),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("title")}</h1>
        <AccountsPageClient defaultCurrency={user.defaultCurrency} />
      </div>

      {accounts.length === 0 && (
        <EmptyState
          icon={<Icon icon={Wallet} size="xl" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      )}

      {/* Cards are the only representation (product decision 2026-09-21).
          Beta round 4: same visual format as the dashboard "¿Dónde está mi
          dinero?" account cards (Card + currency caps + large balance +
          fixed badge), keeping the rename/initial-balance/delete actions as
          a footer row. */}
      <div className="grid gap-3 sm:grid-cols-2">
        {accounts.map((account) => {
          const balance = balances.get(account.id) ?? 0;
          const parts = formatAmountParts(balance, account.currency, locale);
          return (
            <div key={account.id} data-id={account.id} className="relative">
              {/* Beta round 4: the "Fijo" badge is an overlay pinned to the
                  card's top-right corner (z-10, absolute) so it never adds a
                  row and keeps every card the same height in the grid. */}
              {account.isFixed && (
                <span className="absolute right-3 top-3 z-10 inline-block rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  {t("fixed")}
                </span>
              )}
              <Card title={account.name}>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    {account.currency}
                  </span>
                  <span className="min-w-0 break-words text-lg font-semibold tabular-nums sm:text-xl">
                    {parts.sign}
                    {parts.suffixFirst ? (
                      <>
                        <span className="whitespace-nowrap shrink-0">{parts.suffix}</span>{" "}
                        <span>{parts.amount}</span>
                      </>
                    ) : (
                      <>
                        <span>{parts.amount}</span>{" "}
                        <span className="whitespace-nowrap shrink-0">{parts.suffix}</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <RenameAccountButton accountId={account.id} accountName={account.name} />
                  {!balances.has(account.id) && (
                    <InitialBalanceButton accountId={account.id} currency={account.currency} />
                  )}
                  {!account.isFixed && <DeleteAccountButton accountId={account.id} />}
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
