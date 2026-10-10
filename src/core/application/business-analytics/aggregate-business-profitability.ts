import type { Movement } from "../../domain/movement";
import type { Sale } from "../../domain/sale";
import type { Currency } from "../../domain/currency";
import type { CreditGranted } from "../../domain/credit-granted";
import { sumSafeMinorUnits } from "../../domain/money";
import { countsTowardEconomicResult } from "../economic-result";

export interface BusinessProfitabilityRow {
  currency: Currency;
  salesMinor: number;
  saleCount: number;
  averageSaleMinor: number | null;
  receivableMinor: number;
  knownCostMinor: number;
  grossProfitMinor: number | null;
  expensesMinor: number;
  registeredResultMinor: number | null;
  incompleteSales: number;
  topItems: Array<{ itemId: string; name: string; salesMinor: number }>;
}

/** Aggregate business performance by sale date and currency. Unknown costs
 * remain unknown and never inflate reported profit. */
export function aggregateBusinessProfitability(input: {
  sales: Sale[];
  movements: Movement[];
  serviceItemIds?: ReadonlySet<string>;
  catalogItems?: Array<{ id: string; name: string }>;
  creditsGranted?: CreditGranted[];
  from: Date;
  toExclusive: Date;
}): BusinessProfitabilityRow[] {
  const rows = new Map<string, BusinessProfitabilityRow>();
  const creditBySaleId = new Map(
    (input.creditsGranted ?? [])
      .filter((credit) => credit.saleId)
      .map((credit) => [credit.saleId!, credit]),
  );
  const catalogNameById = new Map((input.catalogItems ?? []).map((item) => [item.id, item.name]));
  const rowFor = (currency: Currency): BusinessProfitabilityRow => {
    const existing = rows.get(currency);
    if (existing) return existing;
    const row: BusinessProfitabilityRow = {
      currency,
      salesMinor: 0,
      saleCount: 0,
      averageSaleMinor: null,
      receivableMinor: 0,
      knownCostMinor: 0,
      grossProfitMinor: 0,
      expensesMinor: 0,
      registeredResultMinor: 0,
      incompleteSales: 0,
      topItems: [],
    };
    rows.set(currency, row);
    return row;
  };

  for (const sale of input.sales) {
    if (sale.deletedAt || sale.date < input.from || sale.date >= input.toExclusive) continue;
    const currency = sale.items[0].unitPrice.currency;
    const row = rowFor(currency);
    row.salesMinor = sumSafeMinorUnits([row.salesMinor, sale.total], "Business analytics sales");
    row.saleCount += 1;
    const linkedCredit = creditBySaleId.get(sale.id);
    const pending = linkedCredit
      ? linkedCredit.writtenOff
        ? 0
        : linkedCredit.pending
      : sale.paymentMode === "paid-in-full"
        ? 0
        : sale.pending;
    if (pending > 0) {
      row.receivableMinor = sumSafeMinorUnits(
        [row.receivableMinor, pending],
        "Business analytics receivables",
      );
    }
    for (const item of sale.items) {
      const existing = row.topItems.find((candidate) => candidate.itemId === item.itemId);
      if (existing) {
        existing.salesMinor = sumSafeMinorUnits(
          [existing.salesMinor, item.subtotal],
          "Business analytics item sales",
        );
      } else {
        row.topItems.push({
          itemId: item.itemId,
          name: catalogNameById.get(item.itemId) ?? "",
          salesMinor: item.subtotal,
        });
      }
    }
    const isKnownCost = (item: Sale["items"][number]) =>
      (item.costSnapshot?.totalCostMinor !== undefined &&
        item.costSnapshot.totalCostMinor !== null) ||
      (input.serviceItemIds?.has(item.itemId) ?? false);
    const costsKnown = sale.items.every(isKnownCost);
    if (!costsKnown) {
      row.incompleteSales += 1;
      row.grossProfitMinor = null;
      row.registeredResultMinor = null;
      continue;
    }
    const cost = sumSafeMinorUnits(
      sale.items.map((item) => item.costSnapshot?.totalCostMinor ?? 0),
      "Business analytics sale cost",
    );
    row.knownCostMinor = sumSafeMinorUnits(
      [row.knownCostMinor, cost],
      "Business analytics known cost",
    );
    const saleGrossProfit = sumSafeMinorUnits(
      [sale.total, -cost],
      "Business analytics gross profit",
    );
    if (row.grossProfitMinor !== null) {
      row.grossProfitMinor = sumSafeMinorUnits(
        [row.grossProfitMinor, saleGrossProfit],
        "Business analytics gross profit",
      );
    }
    if (row.registeredResultMinor !== null) {
      row.registeredResultMinor = sumSafeMinorUnits(
        [row.registeredResultMinor, saleGrossProfit],
        "Business analytics registered result",
      );
    }
  }

  for (const movement of input.movements) {
    if (
      movement.date < input.from ||
      movement.date >= input.toExclusive ||
      movement.context !== "Business" ||
      movement.type !== "expense" ||
      (movement.link &&
        ["payableInitialPayment", "payableAbono", "inventoryReceiptPayment"].includes(
          movement.link.kind,
        )) ||
      !countsTowardEconomicResult(movement)
    )
      continue;
    const row = rowFor(movement.amount.currency);
    row.expensesMinor = sumSafeMinorUnits(
      [row.expensesMinor, movement.amount.amount],
      "Business analytics expenses",
    );
    if (row.registeredResultMinor !== null) {
      row.registeredResultMinor = sumSafeMinorUnits(
        [row.registeredResultMinor, -movement.amount.amount],
        "Business analytics registered result",
      );
    }
  }

  return [...rows.values()]
    .map((row) => ({
      ...row,
      averageSaleMinor: row.saleCount > 0 ? Math.round(row.salesMinor / row.saleCount) : null,
      topItems: row.topItems
        .filter((item) => item.name.length > 0)
        .sort((a, b) => b.salesMinor - a.salesMinor)
        .slice(0, 5),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}
