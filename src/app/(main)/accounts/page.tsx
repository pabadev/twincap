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
import { formatAmount } from "../../../lib/format";
import { EmptyState } from "../../../components/ui/empty-state";
import { Icon } from "../../../components/ui/icon";
import { Table, TableShell, THead, Th, TBody, Td } from "../../../components/ui/table";
import { MovementCard } from "../../../components/ui/movement-card";
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

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Icon icon={Wallet} size="xl" />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <TableShell className="max-sm:hidden">
          <Table className="min-w-[400px]">
            <THead>
              <tr>
                <Th>{t("name")}</Th>
                <Th align="right">{t("balance")}</Th>
                <Th align="right">{t("actions")}</Th>
              </tr>
            </THead>
            <TBody>
              {accounts.map((account) => {
                const balance = balances.get(account.id) ?? 0;
                return (
                  <tr key={account.id}>
                    <Td>
                      <span className="text-sm font-medium text-zinc-900 dark:text-white">
                        {account.name}
                      </span>
                      {account.isFixed && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {t("fixed")}
                        </span>
                      )}
                      <span className="ml-2 text-xs text-zinc-400">{account.currency}</span>
                    </Td>
                    <Td align="right">
                      <span
                        className={`text-sm font-medium ${
                          balance >= 0 ? "text-income" : "text-expense"
                        }`}
                      >
                        {formatAmount(balance, account.currency, locale)}
                      </span>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1">
                        <RenameAccountButton accountId={account.id} accountName={account.name} />
                        {!balances.has(account.id) && (
                          <InitialBalanceButton
                            accountId={account.id}
                            currency={account.currency}
                          />
                        )}
                        {!account.isFixed && <DeleteAccountButton accountId={account.id} />}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </TBody>
          </Table>
        </TableShell>
      )}

      {/* Card variant (<640px) */}
      {accounts.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {accounts.map((account) => {
            const balance = balances.get(account.id) ?? 0;
            return (
              <MovementCard
                key={account.id}
                id={account.id}
                className="sm:hidden"
                fields={[
                  {
                    key: "name",
                    label: t("name"),
                    value: account.name,
                    primary: true,
                  },
                  {
                    key: "currency",
                    label: t("currency"),
                    value: account.currency,
                  },
                  ...(account.isFixed
                    ? [
                        {
                          key: "fixed",
                          label: t("fixed"),
                          value: t("fixed"),
                          className:
                            "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                        },
                      ]
                    : []),
                  {
                    key: "balance",
                    label: t("balance"),
                    value: formatAmount(balance, account.currency, locale),
                    className: balance >= 0 ? "text-income" : "text-expense",
                    primary: true,
                  },
                ]}
                actions={
                  <div className="flex items-center gap-1">
                    <RenameAccountButton accountId={account.id} accountName={account.name} />
                    {!balances.has(account.id) && (
                      <InitialBalanceButton accountId={account.id} currency={account.currency} />
                    )}
                    {!account.isFixed && <DeleteAccountButton accountId={account.id} />}
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
