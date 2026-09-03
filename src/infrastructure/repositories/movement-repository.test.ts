import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Mock the Mongoose models the repository depends on, so tests never touch a DB.
const movementFind = vi.fn();
const categoryFind = vi.fn();
const accountFind = vi.fn();

vi.mock("../models/movement", () => ({
  MovementModel: { find: (...args: unknown[]) => movementFind(...args) },
}));
vi.mock("../models/category", () => ({
  CategoryModel: { find: (...args: unknown[]) => categoryFind(...args) },
}));
vi.mock("../models/account", () => ({
  AccountModel: { find: (...args: unknown[]) => accountFind(...args) },
}));

import { MongoMovementRepository } from "./movement-repository";

/** Minimal fake document shaped like the parts of MovementDocument the repo reads. */
function fakeMovementDoc(overrides: Partial<Record<string, unknown>>) {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    accountId: new Types.ObjectId(),
    type: "income",
    categoryId: new Types.ObjectId(),
    date: new Date("2026-08-29T00:00:00.000Z"),
    createdAt: new Date(),
    amount: 100000,
    signedAmount: 100000,
    note: undefined,
    context: "Personal",
    link: undefined,
    toJSON: undefined,
    ...overrides,
  } as unknown as import("../models/movement").MovementDocument;
}

function fakeAccountDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    name: "Efectivo",
    currency: "COP" as const,
    isFixed: false,
    createdAt: new Date(),
    ...overrides,
  } as unknown as import("../models/account").AccountDocument;
}

function fakeCategoryDoc(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: new Types.ObjectId(),
    workspaceId: new Types.ObjectId(),
    name: "Sueldo",
    type: "income" as const,
    createdAt: new Date(),
    ...overrides,
  } as unknown as import("../models/category").CategoryDocument;
}

/** Simulate the chained query: find().sort().exec() -> exec returns the array. */
function execResult(result: unknown[]) {
  return {
    sort: () => ({ exec: vi.fn().mockResolvedValue(result) }),
    exec: vi.fn().mockResolvedValue(result),
  } as unknown as ReturnType<typeof movementFind>;
}

/** Simulate the paged query: find().sort().limit(limit+1).exec(), honouring limit. */
function pagedExecResult(result: unknown[], limit: number) {
  const limited = result.slice(0, limit + 1);
  return {
    sort: () => ({
      limit: () => ({ exec: vi.fn().mockResolvedValue(limited) }),
    }),
  } as unknown as ReturnType<typeof movementFind>;
}

describe("MongoMovementRepository orphan guard (R8)", () => {
  let repo: MongoMovementRepository;
  // The repo passes workspaceId/accountId through `new Types.ObjectId()`, so they
  // must be valid 24-hex ObjectId strings here.
  const UID = new Types.ObjectId().toString();
  const ACCOUNT_ID = new Types.ObjectId().toString();

  beforeEach(() => {
    repo = new MongoMovementRepository();
    movementFind.mockReset();
    categoryFind.mockReset();
    accountFind.mockReset();
  });

  it("findByWorkspaceId skips a movement whose account does not exist (orphan), instead of crashing", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    // Two movements: one references the live account, one references a missing account.
    const live = fakeMovementDoc({
      accountId: account._id,
      categoryId: category._id,
    });
    const orphan = fakeMovementDoc({
      accountId: new Types.ObjectId(), // no matching Account
      categoryId: category._id,
    });

    movementFind.mockImplementation(() => execResult([live, orphan]));
    // resolveBulkDependencies fetches all categories and accounts referenced.
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceId(UID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(live._id.toString());
  });

  it("findByWorkspaceId still maps every movement when all accounts resolve", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const m1 = fakeMovementDoc({ accountId: account._id, categoryId: category._id });
    const m2 = fakeMovementDoc({ accountId: account._id, categoryId: category._id });

    movementFind.mockImplementation(() => execResult([m1, m2]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceId(UID);
    expect(result).toHaveLength(2);
  });

  it("findByWorkspaceId reconstructs the Money currency from the live account", async () => {
    const account = fakeAccountDoc({ currency: "USD" });
    const category = fakeCategoryDoc();
    const live = fakeMovementDoc({ accountId: account._id, categoryId: category._id });

    movementFind.mockImplementation(() => execResult([live]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const [result] = await repo.findByWorkspaceId(UID);
    expect(result.amount.currency).toBe("USD");
    expect(result.amount.amount).toBe(100000);
  });

  it("findPaged skips orphan movements", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const live = fakeMovementDoc({ accountId: account._id, categoryId: category._id });
    const orphan = fakeMovementDoc({
      accountId: new Types.ObjectId(),
      categoryId: category._id,
    });

    movementFind.mockImplementation(() => pagedExecResult([live, orphan], 10));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const { items, nextCursor } = await repo.findPaged(UID, 10);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(live._id.toString());
    expect(nextCursor).toBeDefined();
  });

  it("findByAccountId skips orphan movements", async () => {
    const account = fakeAccountDoc({ _id: new Types.ObjectId(ACCOUNT_ID) });
    const category = fakeCategoryDoc();
    const live = fakeMovementDoc({ accountId: ACCOUNT_ID, categoryId: category._id });
    // References the queried account id? No — a different (missing) account id,
    // but still within the returned doc set; it must be skipped, not crash.
    const orphan = fakeMovementDoc({
      accountId: new Types.ObjectId().toString(),
      categoryId: category._id,
    });

    movementFind.mockImplementation(() => execResult([live, orphan]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByAccountId(UID, ACCOUNT_ID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(live._id.toString());
  });
});
