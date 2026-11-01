// H-19 (fundador 2026-10-31): the Negocio tab's own civil range drives the
// dashboard aggregation. This suite pins the PURE range summary contract:
// window bounds (inclusive end at midnight-UTC exclusive), bounded monthly
// series, financing capital split, and the cross-currency ignore rule.
import { describe, expect, it } from "vitest";
import {
  computeBusinessRangeSummary,
  type BusinessRangeSummary,
} from "./compute-dashboard-summary";
import type { Movement } from "../domain/movement";
import { Money } from "../domain/money";

function movement(overrides: Partial<Movement> = {}): Movement {
  const account = { id: "acc-1", name: "Cuenta", currency: "COP", isFixed: false };
  return {
    id: "m-" + Math.random().toString(36).slice(2, 9),
    workspaceId: "ws-1",
    accountId: "acc-1",
    categoryId: "cat-1",
    type: "income",
    amount: new Money(10_000, "COP"),
    signedAmount: 10_000,
    date: new Date("2026-10-15T00:00:00.000Z"),
    note: undefined,
    context: "Business",
    link: undefined,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    version: 0,
    ...overrides,
  } as Movement;
}

function summary(movements: Movement[], range: { from: string; to: string }): BusinessRangeSummary {
  return computeBusinessRangeSummary({
    movements,
    currency: "COP",
    from: new Date(`${range.from}T00:00:00.000Z`),
    toExclusive: new Date(
      (() => {
        const d = new Date(`${range.to}T00:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString();
      })(),
    ),
  });
}

describe("computeBusinessRangeSummary (H-19 business window)", () => {
  it("aggregates income and expenses across the WHOLE range window", () => {
    const result = summary(
      [
        movement({
          date: new Date("2026-10-05T00:00:00.000Z"),
          type: "income",
          amount: new Money(500_000, "COP"),
          signedAmount: 500_000,
        }),
        movement({
          date: new Date("2026-10-20T00:00:00.000Z"),
          type: "expense",
          amount: new Money(120_000, "COP"),
          signedAmount: -120_000,
        }),
      ],
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(result.income).toBe(500_000);
    expect(result.expenses).toBe(120_000);
  });

  it("clips movements OUTSIDE the window (inclusive start, exclusive end at +1 civil day)", () => {
    const result = summary(
      [
        movement({
          date: new Date("2026-09-30T00:00:00.000Z"),
          type: "income",
          amount: new Money(400, "COP"),
          signedAmount: 400,
        }),
        movement({
          date: new Date("2026-10-01T00:00:00.000Z"),
          type: "income",
          amount: new Money(700, "COP"),
          signedAmount: 700,
        }),
        movement({
          date: new Date("2026-10-31T00:00:00.000Z"),
          type: "income",
          amount: new Money(11, "COP"),
          signedAmount: 11,
        }),
        movement({
          date: new Date("2026-11-01T00:00:00.000Z"),
          type: "income",
          amount: new Money(999, "COP"),
          signedAmount: 999,
        }),
      ],
      { from: "2026-10-01", to: "2026-10-31" },
    );
    // 10-01 included; 10-31 inside [from, to+1) — to is INCLUSIVE per the
    // civil-range contract; 11-01 (to+1) excluded; 09-30 outside.
    expect(result.income).toBe(700 + 11);
  });

  it("builds a gapless monthly series INSIDE the range, oldest first", () => {
    const result = summary(
      [
        movement({
          date: new Date("2026-08-10T00:00:00.000Z"),
          type: "income",
          amount: new Money(300, "COP"),
          signedAmount: 300,
        }),
        movement({
          date: new Date("2026-10-05T00:00:00.000Z"),
          type: "income",
          amount: new Money(200, "COP"),
          signedAmount: 200,
        }),
      ],
      { from: "2026-08-01", to: "2026-10-31" },
    );
    expect(result.months.map((b) => b.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(result.months[0].income).toBe(300);
    // Empty month in the middle renders a zero bucket (gapless — the chart
    // keeps the civil timeline coherent).
    expect(result.months[1].income).toBe(0);
    expect(result.months[2].income).toBe(200);
  });

  it("ignores movements in other currencies (never summed cross-currency)", () => {
    const result = summary(
      [
        movement({
          type: "income",
          amount: new Money(50_000, "COP"),
          signedAmount: 50_000,
        }),
        movement({ type: "income", amount: new Money(15, "USD"), signedAmount: 15 }),
      ],
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(result.income).toBe(50_000);
  });

  it("separates financing capital from the economic result (credit principals)", () => {
    const result = summary(
      [
        // R15.3.1: credit-received principal = financing inflow, NOT income.
        movement({
          date: new Date("2026-10-10T00:00:00.000Z"),
          type: "income",
          amount: new Money(1_000_000, "COP"),
          signedAmount: 1_000_000,
          link: { kind: "creditReceivedPrincipal", refId: "cr-1", opId: "op-1" } as never,
        }),
        movement({
          date: new Date("2026-10-12T00:00:00.000Z"),
          type: "income",
          amount: new Money(40_000, "COP"),
          signedAmount: 40_000,
        }),
      ],
      { from: "2026-10-01", to: "2026-10-31" },
    );
    expect(result.financingInflow).toBe(1_000_000);
    // Only the abono/income movement reaches the economic result.
    expect(result.income).toBe(40_000);
    expect(result.months[0]).toEqual({
      month: "2026-10",
      income: 40_000,
      expenses: 0,
    });
  });
});
