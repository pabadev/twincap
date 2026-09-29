import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { getCurrentUser } from "../../../../infrastructure/auth/getCurrentUser";
import { connectDb } from "../../../../infrastructure/db/connection";
import { MongoClientRepository } from "../../../../infrastructure/repositories/client-repository";
import { MongoSaleRepository } from "../../../../infrastructure/repositories/sale-repository";
import { MongoCreditGrantedRepository } from "../../../../infrastructure/repositories/credit-granted-repository";
import { getLocale, getT } from "../../../../i18n/server";
import { serializeEntities } from "@/lib/serialize";
import { ArrowLeft } from "lucide-react";
import { Icon } from "../../../../components/ui/icon";
import { ClientActivity } from "../client-activity";

const PAGE_SIZE = 15;

export default async function ClientHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const authUser = await getCurrentUser();
  if (!authUser?.workspaceId) redirect("/login");
  const [{ clientId }, query, t, locale] = await Promise.all([
    params,
    searchParams,
    getT("Clients"),
    getLocale(),
  ]);
  if (!Types.ObjectId.isValid(clientId)) notFound();

  const pageValue = Array.isArray(query.page) ? query.page[0] : query.page;
  const parsedPage = pageValue && /^\d+$/.test(pageValue) ? Number(pageValue) : 1;
  const requestedPage = Number.isSafeInteger(parsedPage) ? Math.max(1, parsedPage) : 1;

  await connectDb();
  const clientRepo = new MongoClientRepository();
  const saleRepo = new MongoSaleRepository();
  const creditRepo = new MongoCreditGrantedRepository();
  const client = await clientRepo.findById(authUser.workspaceId, clientId);
  if (!client) notFound();

  const history = await saleRepo.findByClientIdPage(
    authUser.workspaceId,
    client.id,
    (requestedPage - 1) * PAGE_SIZE,
    PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil(history.total / PAGE_SIZE));
  if (requestedPage > totalPages) {
    redirect(
      requestedPage === 1 ? `/clients/${client.id}` : `/clients/${client.id}?page=${totalPages}`,
    );
  }
  const credits = await creditRepo.findBySaleIds(
    authUser.workspaceId,
    history.sales.map((sale) => sale.id),
  );

  const baseHref = `/clients/${encodeURIComponent(client.id)}`;
  const previousHref = requestedPage > 2 ? `${baseHref}?page=${requestedPage - 1}` : baseHref;
  const nextHref = `${baseHref}?page=${requestedPage + 1}`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/clients"
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Icon icon={ArrowLeft} size="sm" />
        {t("title")}
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{client.name}</h1>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("phone")}</dt>
            <dd className="text-zinc-900 dark:text-white">{client.phone || t("phoneMissing")}</dd>
          </div>
          {client.email && (
            <div>
              <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("email")}</dt>
              <dd className="text-zinc-900 dark:text-white">{client.email}</dd>
            </div>
          )}
          {client.note && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("note")}</dt>
              <dd className="whitespace-pre-wrap text-zinc-900 dark:text-white">{client.note}</dd>
            </div>
          )}
        </dl>
      </header>

      <ClientActivity
        sales={serializeEntities(history.sales)}
        credits={serializeEntities(credits)}
      />

      {history.total > PAGE_SIZE && (
        <nav
          aria-label={t("salesHistory")}
          className="mt-6 flex items-center justify-between gap-3"
        >
          {requestedPage > 1 ? (
            <Link
              href={previousHref}
              className="rounded-md border border-surface-border px-3 py-2 text-sm text-zinc-700 hover:bg-surface-bg dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t("previousPage")}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-zinc-600 dark:text-zinc-400">
            {t("clientPageSummary", { page: String(requestedPage), pages: String(totalPages) })}
          </span>
          {requestedPage < totalPages ? (
            <Link
              href={nextHref}
              className="rounded-md border border-surface-border px-3 py-2 text-sm text-zinc-700 hover:bg-surface-bg dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {t("nextPage")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
