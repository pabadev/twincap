import { describe, expect, it } from "vitest";
import { toMonthlySeriesRows, toMovementToolRows } from "./movements-series-rows";
import type { MonthBucket } from "@/core/application/compute-dashboard-summary";
import type { SerializedMovement } from "@/core/domain/movement";

const buckets: MonthBucket[] = [
  { month: "2026-08", income: 2511000, expenses: 3440166 },
  { month: "2026-09", income: 2543100, expenses: 3165859 },
  { month: "2026-10", income: 2805000, expenses: 5703444 },
  { month: "2026-11", income: 270000, expenses: 579363 },
];

function movement(overrides: Partial<SerializedMovement> = {}): SerializedMovement {
  return {
    id: "m1",
    workspaceId: "w1",
    accountId: "acc1",
    categoryId: "cat1",
    type: "expense",
    amount: { amount: 20000, currency: "COP" },
    signedAmount: -20000,
    date: new Date("2026-11-07T00:00:00.000Z"),
    note: "Cuota parcial octubre",
    context: undefined,
    link: undefined,
    createdAt: new Date("2026-11-07T01:00:00.000Z"),
    version: 1,
    ...overrides,
  } as unknown as SerializedMovement;
}

describe("toMonthlySeriesRows", () => {
  it("returns the last N buckets in chronological order with decimals per currency", () => {
    const rows = toMonthlySeriesRows(buckets, "COP", 3);
    expect(rows.map((r) => r.month)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(rows.every((r) => r.decimals === 0)).toBe(true);
    expect(rows.every((r) => r.currency === "COP")).toBe(true);
  });

  it("computes result = income − expenses per bucket (USD carries decimals=2)", () => {
    const rows = toMonthlySeriesRows([{ month: "2026-11", income: 500, expenses: 300 }], "USD", 3);
    expect(rows[0]).toMatchObject({
      currency: "USD",
      decimals: 2,
      incomeMinorUnits: 500,
      expensesMinorUnits: 300,
      resultMinorUnits: 200,
    });
  });

  it("months larger than available data degrades to the received set (no fabricated months)", () => {
    const rows = toMonthlySeriesRows([{ month: "2026-11", income: 100, expenses: 200 }], "COP", 12);
    expect(rows).toHaveLength(1);
    expect(rows[0].resultMinorUnits).toBe(-100);
  });
});

describe("toMovementToolRows", () => {
  const lookups = {
    currencyByAccount: new Map([["acc1", "COP" as const]]),
    accountNameOf: (id: string) => (id === "acc1" ? "BBVA" : null),
    labelOf: () => "Padres",
  };

  it("maps signed amounts, currency/decimals, category label, note and account name", () => {
    const env = toMovementToolRows(
      [movement()],
      lookups.currencyByAccount,
      lookups.accountNameOf,
      lookups.labelOf,
      { limit: 10 },
    );
    expect(env).toMatchObject({ total: 1, hasMore: false });
    expect(env.rows[0]).toMatchObject({
      type: "expense",
      amountMinorUnits: -20000,
      currency: "COP",
      decimals: 0,
      category: "Padres",
      note: "Cuota parcial octubre",
      account: "BBVA",
    });
  });

  it("filters by type and reports pre-cap totals with hasMore", () => {
    const second = movement({
      id: "m2",
      type: "income",
      amount: { amount: 30000, currency: "COP" },
      signedAmount: 30000,
      date: new Date("2026-11-06T00:00:00.000Z"),
      createdAt: new Date("2026-11-06T02:00:00.000Z"),
    });
    const env = toMovementToolRows(
      [movement(), second],
      lookups.currencyByAccount,
      lookups.accountNameOf,
      lookups.labelOf,
      { limit: 1, type: "expense" },
    );
    expect(env.total).toBe(1);
    expect(env.rows).toHaveLength(1);
    expect(env.rows[0].id).toBe("m1");
    expect(env.hasMore).toBe(false);
  });

  it("sorts newest first with createdAt as the tiebreaker, capped by limit", () => {
    const older = movement({
      id: "older",
      date: new Date("2026-11-05T00:00:00.000Z"),
      createdAt: new Date("2026-11-05T01:00:00.000Z"),
    });
    const sameDay = movement({ id: "later", createdAt: new Date("2026-11-07T02:00:00.000Z") });
    const env = toMovementToolRows(
      [movement(), older, sameDay],
      lookups.currencyByAccount,
      lookups.accountNameOf,
      lookups.labelOf,
      { limit: 2 },
    );
    expect(env.rows.map((r) => [r.id, r.amountMinorUnits]).map(([id]) => id)).toEqual([
      "later",
      "m1",
    ]);
    expect(env.total).toBe(3);
    expect(env.hasMore).toBe(true);
  });
});
