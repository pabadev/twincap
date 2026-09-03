import { describe, expect, it } from "vitest";
import { Movement } from "../../domain/movement";
import type { Category } from "../../domain/category";
import { Money } from "../../domain/money";
import { saleCategory, transferCategory } from "../../domain/synthetic-categories";
import { accountBalancesFromMovements } from "./balance-from-movements";
import { filterMovementsWithLiveParents, type LiveParentIds } from "./filter-live-linked-movements";

function makeCategory(type: "income" | "expense"): Category {
  return type === "income" ? saleCategory("income") : transferCategory("expense");
}

function makeMovement(overrides: Partial<ConstructorParameters<typeof Movement>[0]> = {}): Movement {
  const { type = "income", category, ...rest } = overrides;
  return new Movement({
    id: "mov-1",
    workspaceId: "user-1",
    accountId: "acc-1",
    category: category ?? makeCategory(type),
    type,
    amount: new Money(100000, "COP"),
    date: new Date("2025-01-15"),
    context: "Personal",
    createdAt: new Date(),
    ...rest,
  });
}

function makeSaleLinkMovement(
  id: string,
  accountId: string,
  refId: string,
  amount: number,
  date: Date,
): Movement {
  return new Movement({
    id,
    workspaceId: "user-1",
    accountId,
    category: saleCategory("income"),
    type: "income",
    amount: new Money(amount, "COP"),
    date,
    context: "Business",
    link: { kind: "salePayment", refId, opId: `op-${id}` },
    createdAt: date,
  });
}

describe("accountBalancesFromMovements (R7-A)", () => {
  it("sums signedAmount per account from a live movement list", () => {
    const accounts = [{ id: "acc-1" }, { id: "acc-2" }];
    const movements = [
      makeMovement({ id: "m1", accountId: "acc-1", type: "income", amount: new Money(50000, "COP") }),
      makeMovement({ id: "m2", accountId: "acc-1", type: "expense", amount: new Money(10000, "COP") }),
      makeMovement({ id: "m3", accountId: "acc-2", type: "income", amount: new Money(25000, "COP") }),
    ];

    const balance = accountBalancesFromMovements(accounts, movements);
    expect(balance.get("acc-1")).toBe(40000); // 50000 - 10000
    expect(balance.get("acc-2")).toBe(25000);
  });

  it("returns no balance entry for an account with no live movements", () => {
    const accounts = [{ id: "acc-1" }, { id: "acc-2" }];
    const balance = accountBalancesFromMovements(accounts, [makeMovement({ accountId: "acc-1" })]);
    // Map contract: absent key → undefined (callers default to 0 with `?? 0`)
    expect(balance.get("acc-2")).toBeUndefined();
    expect(balance.get("acc-1")).toBe(100000);
    // dashboard guards absent accounts with `?? 0`
    expect(balance.get("acc-2") ?? 0).toBe(0);
  });

  it("honors the parent filter so orphan sale payments are excluded from the balance", () => {
    const live: LiveParentIds = {
      accounts: new Set(["acc-1"]),
      transfers: new Set(),
      creditsReceived: [],
      creditsGranted: [],
      sales: [{ id: "sale-1", accountId: "acc-1", date: new Date("2025-01-15"), amount: 100000 }],
      payables: new Set(),
    };

    const all = [
      // manual movements — always live
      makeMovement({ id: "m1", accountId: "acc-1", type: "income", amount: new Money(20000, "COP") }),
      // salePayment for a LIVE sale (matches by id) — kept
      makeSaleLinkMovement("m2", "acc-1", "sale-1", 100000, new Date("2025-01-15")),
      // orphan salePayment (no live parent, no value match) — must be filtered
      makeSaleLinkMovement("m3-orphan", "acc-1", "sale-dead", 50000, new Date("2025-02-01")),
    ];

    const liveMovements = filterMovementsWithLiveParents(all, live);
    const balance = accountBalancesFromMovements([{ id: "acc-1" }], liveMovements);

    // 20000 (manual) + 100000 (live sale) = 120000; orphan 50000 excluded
    expect(balance.get("acc-1")).toBe(120000);
    expect(liveMovements.map((m) => m.id)).not.toContain("m3-orphan");
  });

  it("reconciles a legacy-sale payment by value and keeps it in the balance", () => {
    const live: LiveParentIds = {
      accounts: new Set(["acc-1"]),
      transfers: new Set(),
      creditsReceived: [],
      creditsGranted: [],
      // parent sale has ObjectId `_id`, while the movement carries a legacy UUID refId
      sales: [{ id: "sale-1", accountId: "acc-1", date: new Date("2025-01-15"), amount: 100000 }],
      payables: new Set(),
    };

    const all = [
      makeSaleLinkMovement(
        "m2-legacy",
        "acc-1",
        "4f53b6e6-4a2d-4b1c-9e1a-0f2b3c4d5e6f", // legacy UUID refId
        100000,
        new Date("2025-01-15"),
      ),
    ];

    const liveMovements = filterMovementsWithLiveParents(all, live);
    const balance = accountBalancesFromMovements([{ id: "acc-1" }], liveMovements);
    // value reconciliation keeps it (accountId + date + amount mirror) → counted
    expect(balance.get("acc-1")).toBe(100000);
  });
});
