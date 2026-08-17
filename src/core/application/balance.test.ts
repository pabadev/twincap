import { describe, it, expect, vi } from "vitest";
import { getAccountBalance, getUserBalances } from "./balance";
import type { MovementRepository } from "../domain/repositories";
import type { Movement } from "../domain/movement";

/** Minimal fake MovementRepository for balance tests. */
function fakeMovementRepo(overrides: Partial<MovementRepository> = {}): MovementRepository {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findByUserId: vi.fn().mockResolvedValue([]),
    findByAccountId: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    aggregateBalance: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

function fakeMovement(partial: Partial<Movement> & { id: string; accountId: string; signedAmount: number }): Movement {
  return {
    userId: "user-1",
    categoryId: "cat-1",
    type: "income",
    amount: { amount: partial.signedAmount, currency: "COP" } as never,
    date: new Date(),
    context: "Personal",
    createdAt: new Date(),
    ...partial,
  } as Movement;
}

describe("getAccountBalance", () => {
  it("returns aggregate balance for the account", async () => {
    const repo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(5000),
    });

    const balance = await getAccountBalance("user-1", "acc-1", repo);

    expect(balance).toBe(5000);
    expect(repo.aggregateBalance).toHaveBeenCalledWith("user-1", "acc-1");
  });

  it("returns 0 when account has no movements", async () => {
    const repo = fakeMovementRepo({
      aggregateBalance: vi.fn().mockResolvedValue(0),
    });

    const balance = await getAccountBalance("user-1", "acc-empty", repo);

    expect(balance).toBe(0);
  });
});

describe("getUserBalances", () => {
  it("returns a map of accountId → balance", async () => {
    const movements = [
      fakeMovement({ id: "m1", accountId: "acc-1", signedAmount: 1000 }),
      fakeMovement({ id: "m2", accountId: "acc-1", signedAmount: -300 }),
      fakeMovement({ id: "m3", accountId: "acc-2", signedAmount: 500 }),
    ];

    const repo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue(movements),
    });

    const balances = await getUserBalances("user-1", repo);

    expect(balances.get("acc-1")).toBe(700);
    expect(balances.get("acc-2")).toBe(500);
    expect(balances.size).toBe(2);
  });

  it("returns empty map when user has no movements", async () => {
    const repo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue([]),
    });

    const balances = await getUserBalances("user-1", repo);

    expect(balances.size).toBe(0);
  });

  it("handles negative balances correctly", async () => {
    const movements = [
      fakeMovement({ id: "m1", accountId: "acc-1", signedAmount: -200 }),
      fakeMovement({ id: "m2", accountId: "acc-1", signedAmount: -100 }),
    ];

    const repo = fakeMovementRepo({
      findByUserId: vi.fn().mockResolvedValue(movements),
    });

    const balances = await getUserBalances("user-1", repo);

    expect(balances.get("acc-1")).toBe(-300);
  });
});
