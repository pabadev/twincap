import { describe, it, expect, vi } from "vitest";
import { getUserBalances } from "./balance";
import { computeAccountLiveBalance } from "./movements/compute-live-balance";
import type { MovementRepository } from "../domain/repositories";
import type { Movement, MovementLink } from "../domain/movement";
import type { LiveBalanceDeps } from "./movements/compute-live-balance";

/** Minimal fake MovementRepository for balance tests. */
function fakeMovementRepo(overrides: Partial<MovementRepository> = {}): MovementRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByWorkspaceId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    findByAccountIdForBalance: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteByRefId: vi.fn().mockResolvedValue(0),
    countByCategoryId: vi.fn().mockResolvedValue(0),
    countOpeningMovements: vi.fn().mockResolvedValue(0),
    findPaged: async () => ({ items: [], nextCursor: null }),
    findByWorkspaceIdAndDateRange: vi.fn().mockResolvedValue([]),
    findByWorkspaceIdForBalance: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

/** Every parent repo resolves nothing by default → movements are orphans. */
function fakeDeps(
  overrides: Partial<LiveBalanceDeps> = {},
): LiveBalanceDeps {
  return {
    transferRepo: { findById: vi.fn().mockResolvedValue(null) },
    creditReceivedRepo: { findById: vi.fn().mockResolvedValue(null) },
    creditGrantedRepo: { findById: vi.fn().mockResolvedValue(null) },
    saleRepo: { findById: vi.fn().mockResolvedValue(null) },
    payableRepo: { findById: vi.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

interface FakeMovementInput {
  id: string;
  accountId: string;
  signedAmount: number;
  link?: MovementLink;
  createdAt?: Date;
}

function fakeMovement(partial: FakeMovementInput): Movement {
  return {
    workspaceId: "user-1",
    categoryId: "cat-1",
    type: partial.signedAmount >= 0 ? "income" : "expense",
    amount: { amount: partial.signedAmount, currency: "COP" } as never,
    date: new Date(),
    context: "Personal",
    createdAt: partial.createdAt ?? new Date("2026-09-20"),
    ...partial,
  } as unknown as Movement;
}

const MODERN = new Date("2026-09-20"); // after R15.1 cutoff → strict id lookup

describe("getUserBalances", () => {
  it("sums per-account balances from live movements only", async () => {
    const movements = [
      // Manual movements (no link) are always live.
      fakeMovement({ id: "m1", accountId: "acc-1", signedAmount: 1000 }),
      fakeMovement({ id: "m2", accountId: "acc-1", signedAmount: -300 }),
      // Opening movement: refId IS the account id → survives when the account
      // is in the provided live set.
      fakeMovement({
        id: "m3",
        accountId: "acc-2",
        signedAmount: 500,
        link: { kind: "opening", refId: "acc-2", opId: "op-3" },
      }),
    ];
    const repo = fakeMovementRepo({
      findByWorkspaceIdForBalance: vi.fn().mockResolvedValue(movements),
    });
    const deps = fakeDeps();

    const balances = await getUserBalances(
      "user-1",
      [{ id: "acc-1" }, { id: "acc-2" }],
      repo,
      deps,
    );

    expect(balances.get("acc-1")).toBe(700);
    expect(balances.get("acc-2")).toBe(500);
    expect(balances.size).toBe(2);
  });

  it("excludes orphan movements whose linked parent no longer exists", async () => {
    const movements = [
      // transfer parent exists → live.
      fakeMovement({
        id: "m1",
        accountId: "acc-1",
        signedAmount: -1000,
        link: { kind: "transfer", refId: "tr-live", opId: "op-1" },
        createdAt: MODERN,
      }),
      // transfer parent gone → orphan, excluded.
      fakeMovement({
        id: "m2",
        accountId: "acc-1",
        signedAmount: -2000,
        link: { kind: "transfer", refId: "tr-gone", opId: "op-2" },
        createdAt: MODERN,
      }),
      // sale payment parent exists (total 50000) → live.
      fakeMovement({
        id: "m3",
        accountId: "acc-2",
        signedAmount: 50000,
        link: { kind: "salePayment", refId: "sale-live", opId: "op-3" },
        createdAt: MODERN,
      }),
      // sale payment parent gone → orphan, excluded.
      fakeMovement({
        id: "m4",
        accountId: "acc-2",
        signedAmount: 99999,
        link: { kind: "salePayment", refId: "sale-gone", opId: "op-4" },
        createdAt: MODERN,
      }),
    ];
    const repo = fakeMovementRepo({
      findByWorkspaceIdForBalance: vi.fn().mockResolvedValue(movements),
    });
    const deps = fakeDeps({
      transferRepo: {
        findById: vi.fn().mockImplementation(async (_ws: string, id: string) =>
          id === "tr-live" ? { id: "tr-live" } : null,
        ),
      },
      saleRepo: {
        findById: vi.fn().mockImplementation(async (_ws: string, id: string) =>
          id === "sale-live"
            ? { id: "sale-live", accountId: "acc-2", date: new Date(), total: { amount: 50000 } }
            : null,
        ),
      },
    });

    const balances = await getUserBalances(
      "user-1",
      [{ id: "acc-1" }, { id: "acc-2" }],
      repo,
      deps,
    );

    expect(balances.get("acc-1")).toBe(-1000);
    expect(balances.get("acc-2")).toBe(50000);
  });

  it("uses ONLY the provided accounts as live for opening movements", async () => {
    const movements = [
      fakeMovement({
        id: "m1",
        accountId: "acc-1",
        signedAmount: 300,
        link: { kind: "opening", refId: "acc-1", opId: "op-1" },
      }),
      // Opening whose refId is NOT in the provided accounts → orphan.
      fakeMovement({
        id: "m2",
        accountId: "acc-ghost",
        signedAmount: 777,
        link: { kind: "opening", refId: "acc-ghost", opId: "op-2" },
      }),
    ];
    const repo = fakeMovementRepo({
      findByWorkspaceIdForBalance: vi.fn().mockResolvedValue(movements),
    });

    const balances = await getUserBalances(
      "user-1",
      [{ id: "acc-1" }],
      repo,
      fakeDeps(),
    );

    expect(balances.get("acc-1")).toBe(300);
    expect(balances.has("acc-ghost")).toBe(false);
  });

  it("returns empty map when user has no movements", async () => {
    const repo = fakeMovementRepo({
      findByWorkspaceIdForBalance: vi.fn().mockResolvedValue([]),
    });

    const balances = await getUserBalances("user-1", [{ id: "acc-1" }], repo, fakeDeps());

    expect(balances.size).toBe(0);
  });

  it("handles negative balances correctly", async () => {
    const movements = [
      fakeMovement({ id: "m1", accountId: "acc-1", signedAmount: -200 }),
      fakeMovement({ id: "m2", accountId: "acc-1", signedAmount: -100 }),
    ];
    const repo = fakeMovementRepo({
      findByWorkspaceIdForBalance: vi.fn().mockResolvedValue(movements),
    });

    const balances = await getUserBalances("user-1", [{ id: "acc-1" }], repo, fakeDeps());

    expect(balances.get("acc-1")).toBe(-300);
  });

  it("computeAccountLiveBalance rejects when Σ signedAmount overflows the safe-integer range (R15.3 §18 guard)", async () => {
    const nearMax = Number.MAX_SAFE_INTEGER - 5000; // both values individually safe…
    const movements = [
      fakeMovement({ id: "m1", accountId: "acc-1", signedAmount: nearMax }),
      fakeMovement({ id: "m2", accountId: "acc-1", signedAmount: 9000 }), // …sum EXCEEDS the safe range
    ];
    const repo = fakeMovementRepo({
      findByAccountIdForBalance: vi.fn().mockResolvedValue(movements),
    });

    await expect(
      computeAccountLiveBalance("user-1", "acc-1", repo, fakeDeps()),
    ).rejects.toThrow(/unsafe minor-units value/);
  });
});