import { redirect } from "next/navigation";
import { listCatalogItems } from "../../../../../core/application/catalog";
import { listInventoryReceiptsPage } from "../../../../../core/application/inventory/list-inventory-receipts-page";
import { connectDb } from "../../../../../infrastructure/db/connection";
import { getCurrentUser } from "../../../../../infrastructure/auth/getCurrentUser";
import { MongoAccountRepository } from "../../../../../infrastructure/repositories/account-repository";
import { MongoCatalogItemRepository } from "../../../../../infrastructure/repositories/catalog-repository";
import { MongoInventoryReceiptRepository } from "../../../../../infrastructure/repositories/inventory-receipt-repository";
import { MongoPayableRepository } from "../../../../../infrastructure/repositories/payable-repository";
import { MongoUserRepository } from "../../../../../infrastructure/repositories/user-repository";
import { serializeEntities } from "../../../../../lib/serialize";
import { ReceiptHistoryList } from "./receipt-history-list";

function readCivilDate(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export default async function InventoryReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const authUser = await getCurrentUser();
  if (!authUser?.workspaceId) redirect("/login");
  await connectDb();

  const params = await searchParams;
  const pageValue = typeof params.page === "string" ? Number(params.page) : 1;
  const page =
    Number.isSafeInteger(pageValue) && pageValue > 0 && pageValue <= 100_000 ? pageValue : 1;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  let dateFrom = readCivilDate(params.from);
  let dateTo = readCivilDate(params.to);
  let filterError =
    (params.from !== undefined && !dateFrom) || (params.to !== undefined && !dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) {
    dateFrom = undefined;
    dateTo = undefined;
    filterError = true;
  }

  const accountRepo = new MongoAccountRepository();
  const catalogRepo = new MongoCatalogItemRepository();
  const receiptRepo = new MongoInventoryReceiptRepository();
  const userRepo = new MongoUserRepository();
  const payableRepo = new MongoPayableRepository();

  const [user, items, accounts, result] = await Promise.all([
    userRepo.findById(authUser.userId),
    listCatalogItems(authUser.workspaceId, catalogRepo),
    accountRepo.findByWorkspaceId(authUser.workspaceId),
    listInventoryReceiptsPage(
      authUser.workspaceId,
      { page, search, dateFrom, dateTo },
      receiptRepo,
    ),
  ]);
  if (!user) redirect("/login");
  // Outstanding payables only: a FULLY paid payable must not keep its
  // receipt flagged "Balance outstanding" (badge derives pending>0, not
  // payable existence). Existing ids distinguish truly-missing payables
  // (delete) from fully-paid ones.
  const receiptPayableIds = result.items.flatMap((receipt) =>
    receipt.payableId ? [receipt.payableId] : [],
  );
  const payableIds = await payableRepo.findOutstandingIds(authUser.workspaceId, receiptPayableIds);
  const existingPayableIds = await payableRepo.findExistingIds(
    authUser.workspaceId,
    receiptPayableIds,
  );
  const missingPayableIds = receiptPayableIds.filter((id) => !existingPayableIds.includes(id));

  return (
    <ReceiptHistoryList
      items={serializeEntities(items)}
      accounts={serializeEntities(accounts)}
      receipts={serializeEntities(result.items)}
      payableIds={payableIds}
      missingPayableIds={[...new Set(missingPayableIds)]}
      search={search}
      dateFrom={dateFrom ?? ""}
      dateTo={dateTo ?? ""}
      page={result.page}
      totalPages={result.totalPages}
      total={result.total}
      filterError={filterError}
    />
  );
}
