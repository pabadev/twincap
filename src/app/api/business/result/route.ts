import { NextResponse } from "next/server";
import { connectDb } from "../../../../infrastructure/db/connection";
import { getCurrentUser } from "../../../../infrastructure/auth/getCurrentUser";
import { MongoSaleRepository } from "../../../../infrastructure/repositories/sale-repository";
import { MongoMovementRepository } from "../../../../infrastructure/repositories/movement-repository";
import { MongoAccountRepository } from "../../../../infrastructure/repositories/account-repository";
import { MongoTransferRepository } from "../../../../infrastructure/repositories/transfer-repository";
import { MongoCreditReceivedRepository } from "../../../../infrastructure/repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../../../../infrastructure/repositories/credit-granted-repository";
import { MongoPayableRepository } from "../../../../infrastructure/repositories/payable-repository";
import { MongoCatalogItemRepository } from "../../../../infrastructure/repositories/catalog-repository";
import {
  filterMovementsWithLiveParents,
  collectLiveParentIds,
} from "../../../../core/application/movements";
import { aggregateBusinessProfitability } from "../../../../core/application/business-analytics/aggregate-business-profitability";
import { reportUnexpectedErrorAndWait } from "../../../../lib/report-unexpected-error";

/**
 * H-23 (fundador 2026-11-01): the business-result read lives on a ROUTE
 * HANDLER (same page-proxy exclusion rationale as the movements pagination:
 * pure JSON, no flight, no cookie writes). Same pipeline as the
 * /business-analytics page.
 *
 * GET /api/business/result?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ rows: [] }, { status: 401 });
  }

  const url = new URL(request.url);
  const fromText = url.searchParams.get("from") ?? "";
  const toText = url.searchParams.get("to") ?? "";
  if (!validCivilDate(fromText) || !validCivilDate(toText) || fromText > toText) {
    return NextResponse.json({ rows: [] });
  }

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

    return NextResponse.json({
      rows: aggregateRows.map((row) => ({
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
      })),
    });
  } catch (error) {
    // Read path fail-open: the block renders its empty state instead of an
    // exception wall (mirrors the movement paged read).
    await reportUnexpectedErrorAndWait(error);
    return NextResponse.json({ rows: [] });
  }
}

function validCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
