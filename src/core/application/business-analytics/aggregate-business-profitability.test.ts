import { describe, expect, it } from "vitest";
import type { Movement } from "../../domain/movement";
import type { Sale } from "../../domain/sale";
import type { CreditGranted } from "../../domain/credit-granted";
import { aggregateBusinessProfitability } from "./aggregate-business-profitability";

const from = new Date("2026-10-01T00:00:00.000Z");
const toExclusive = new Date("2026-11-01T00:00:00.000Z");

function sale(input: {
  date: string;
  total: number;
  cost: number | null;
  currency?: string;
  deletedAt?: Date;
  itemId?: string;
  includeSnapshot?: boolean;
  id?: string;
  paymentMode?: "paid-in-full" | "on-credit";
  pending?: number;
}): Sale {
  return {
    id: input.id ?? `sale-${input.total}`,
    date: new Date(input.date),
    total: input.total,
    deletedAt: input.deletedAt,
    paymentMode: input.paymentMode ?? "on-credit",
    pending: input.pending ?? 0,
    items: [
      {
        unitPrice: { currency: input.currency ?? "COP" },
        itemId: input.itemId ?? "item-1",
        subtotal: input.total,
        ...(input.includeSnapshot === false
          ? {}
          : { costSnapshot: { totalCostMinor: input.cost } }),
      },
    ],
  } as unknown as Sale;
}

function movement(input: {
  type: "income" | "expense";
  amount: number;
  date: string;
  context?: "Business" | "Personal";
  link?: { kind: "transfer" | "payableAbono"; refId: string; opId: string };
}): Movement {
  return {
    type: input.type,
    amount: { amount: input.amount, currency: "COP" },
    date: new Date(input.date),
    context: input.context ?? "Business",
    link: input.link,
  } as unknown as Movement;
}

describe("aggregateBusinessProfitability", () => {
  it("uses sale date, excludes deleted sales and does not count collections as sales", () => {
    const rows = aggregateBusinessProfitability({
      sales: [
        sale({ date: "2026-10-10T12:00:00Z", total: 1000, cost: 400 }),
        sale({ date: "2026-09-30T12:00:00Z", total: 500, cost: 200 }),
        sale({ date: "2026-10-15T12:00:00Z", total: 200, cost: 50, deletedAt: new Date() }),
      ],
      movements: [movement({ type: "income", amount: 600, date: "2026-10-10T12:00:00Z" })],
      from,
      toExclusive,
    });
    expect(rows).toEqual([
      {
        currency: "COP",
        salesMinor: 1000,
        saleCount: 1,
        averageSaleMinor: 1000,
        receivableMinor: 0,
        knownCostMinor: 400,
        grossProfitMinor: 600,
        expensesMinor: 0,
        registeredResultMinor: 600,
        incompleteSales: 0,
        topItems: [],
      },
    ]);
  });

  it("marks profit incomplete and excludes transfers, personal expenses, and payable payments", () => {
    const rows = aggregateBusinessProfitability({
      sales: [sale({ date: "2026-10-10T12:00:00Z", total: 1000, cost: null })],
      movements: [
        movement({ type: "expense", amount: 100, date: "2026-10-10T12:00:00Z" }),
        movement({
          type: "expense",
          amount: 900,
          date: "2026-10-10T12:00:00Z",
          context: "Personal",
        }),
        movement({
          type: "expense",
          amount: 800,
          date: "2026-10-10T12:00:00Z",
          link: { kind: "transfer", refId: "t", opId: "o" },
        }),
        movement({
          type: "expense",
          amount: 700,
          date: "2026-10-10T12:00:00Z",
          link: { kind: "payableAbono", refId: "p", opId: "o" },
        }),
      ],
      from,
      toExclusive,
    });
    expect(rows[0]).toMatchObject({
      salesMinor: 1000,
      knownCostMinor: 0,
      grossProfitMinor: null,
      expensesMinor: 100,
      registeredResultMinor: null,
      incompleteSales: 1,
    });
  });

  it("keeps currencies separate", () => {
    const rows = aggregateBusinessProfitability({
      sales: [
        sale({ date: "2026-10-10T12:00:00Z", total: 1000, cost: 200, currency: "COP" }),
        sale({ date: "2026-10-11T12:00:00Z", total: 500, cost: 100, currency: "USD" }),
      ],
      movements: [],
      from,
      toExclusive,
    });
    expect(rows.map((row) => [row.currency, row.grossProfitMinor])).toEqual([
      ["COP", 800],
      ["USD", 400],
    ]);
  });

  it("treats a service without an inventory snapshot as zero inventory cost and deducts business expenses", () => {
    const rows = aggregateBusinessProfitability({
      sales: [
        sale({
          date: "2026-10-10T12:00:00Z",
          total: 1000,
          cost: null,
          itemId: "service-1",
          includeSnapshot: false,
        }),
      ],
      serviceItemIds: new Set(["service-1"]),
      movements: [movement({ type: "expense", amount: 250, date: "2026-10-10T12:00:00Z" })],
      from,
      toExclusive,
    });

    expect(rows[0]).toMatchObject({
      salesMinor: 1000,
      knownCostMinor: 0,
      grossProfitMinor: 1000,
      expensesMinor: 250,
      registeredResultMinor: 750,
      incompleteSales: 0,
    });
  });

  it("shows sale count, average, current amount to collect, and best-selling items", () => {
    const rows = aggregateBusinessProfitability({
      sales: [
        sale({ id: "sale-a", date: "2026-10-10T12:00:00Z", total: 1000, cost: 400 }),
        sale({ id: "sale-b", date: "2026-10-11T12:00:00Z", total: 500, cost: 200 }),
      ],
      movements: [],
      catalogItems: [{ id: "item-1", name: "Mantenimiento de impresora" }],
      creditsGranted: [
        { saleId: "sale-a", pending: 300 },
        {
          saleId: "sale-b",
          pending: 500,
          writtenOff: { date: new Date("2026-10-12T12:00:00Z"), movementId: "writeoff" },
        },
      ] as unknown as CreditGranted[],
      from,
      toExclusive,
    });

    expect(rows[0]).toMatchObject({
      salesMinor: 1500,
      saleCount: 2,
      averageSaleMinor: 750,
      receivableMinor: 300,
      topItems: [{ itemId: "item-1", name: "Mantenimiento de impresora", salesMinor: 1500 }],
    });
  });

  it("does not report paid-in-full sales as receivables even if legacy pending is stale", () => {
    const rows = aggregateBusinessProfitability({
      sales: [
        sale({
          id: "paid-sale",
          date: "2026-10-10T12:00:00Z",
          total: 1000,
          cost: 400,
          paymentMode: "paid-in-full",
          pending: 1000,
        }),
      ],
      movements: [],
      from,
      toExclusive,
    });

    expect(rows[0].receivableMinor).toBe(0);
  });
});
