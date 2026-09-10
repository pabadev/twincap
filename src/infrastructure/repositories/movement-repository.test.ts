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
    sort: vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(result) }),
    exec: vi.fn().mockResolvedValue(result),
  } as unknown as ReturnType<typeof movementFind>;
}

/** Simulate the chained query: find().select().sort().exec() -> exec returns the array. */
function selectExecResult(result: unknown[]) {
  const sort = vi.fn().mockReturnValue({ exec: vi.fn().mockResolvedValue(result) });
  return {
    select: vi.fn().mockReturnValue({ sort }),
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

describe("MongoMovementRepository windowed reads (R14-I)", () => {
  let repo: MongoMovementRepository;
  const UID = new Types.ObjectId().toString();
  const FROM = new Date("2026-01-01T00:00:00.000Z");
  const TO = new Date("2026-08-01T00:00:00.000Z");

  beforeEach(() => {
    repo = new MongoMovementRepository();
    movementFind.mockReset();
    categoryFind.mockReset();
    accountFind.mockReset();
  });

  it("findByWorkspaceIdAndDateRange passes workspaceId + $gte/$lt and the same sort", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const m = fakeMovementDoc({ accountId: account._id, categoryId: category._id });

    const chain = execResult([m]);
    movementFind.mockImplementation(() => chain);
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceIdAndDateRange(UID, FROM, TO);

    const [query] = movementFind.mock.calls[0];
    const q = query as {
      workspaceId: Types.ObjectId;
      date: { $gte: Date; $lt: Date };
    };
    expect(q.workspaceId.toString()).toBe(UID);
    expect(q.date.$gte).toBe(FROM);
    expect(q.date.$lt).toBe(TO);

    // Same sort as findByWorkspaceId ({ date: -1, createdAt: -1 })
    const sort = chain.sort as ReturnType<typeof vi.fn>;
    expect(sort).toHaveBeenCalledWith({ date: -1, createdAt: -1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(m._id.toString());
  });

  it("findByWorkspaceIdAndDateRange applies the orphan guard (skips unresolved account/category)", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const live = fakeMovementDoc({ accountId: account._id, categoryId: category._id });
    const orphanAccount = fakeMovementDoc({
      accountId: new Types.ObjectId(), // no matching Account
      categoryId: category._id,
    });
    const orphanCategory = fakeMovementDoc({
      accountId: account._id,
      categoryId: new Types.ObjectId(), // no matching Category, not synthetic
    });

    movementFind.mockImplementation(() => execResult([live, orphanAccount, orphanCategory]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceIdAndDateRange(UID, FROM, TO);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(live._id.toString());
  });

  it("findByWorkspaceIdAndDateRange reconstructs currency from the live account", async () => {
    const account = fakeAccountDoc({ currency: "USD" });
    const category = fakeCategoryDoc();
    const m = fakeMovementDoc({ accountId: account._id, categoryId: category._id });

    movementFind.mockImplementation(() => execResult([m]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const [result] = await repo.findByWorkspaceIdAndDateRange(UID, FROM, TO);
    expect(result.amount.currency).toBe("USD");
    expect(result.amount.amount).toBe(100000);
  });

  it("findByWorkspaceIdAndDateRange returns [] when the window has no movements", async () => {
    movementFind.mockImplementation(() => execResult([]));
    const result = await repo.findByWorkspaceIdAndDateRange(UID, FROM, TO);
    expect(result).toEqual([]);
    // Dependency resolution must NOT run for an empty result set.
    expect(categoryFind).not.toHaveBeenCalled();
    expect(accountFind).not.toHaveBeenCalled();
  });

  it("findByWorkspaceIdForBalance applies the minimal projection select and the same sort", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const m = fakeMovementDoc({ accountId: account._id, categoryId: category._id });

    const chain = selectExecResult([m]);
    movementFind.mockImplementation(() => chain);
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceIdForBalance(UID);

    // The projection must cover exactly the fields the mapper/entity needs and
    // deliberately EXCLUDE note-external fields like updatedAt/signedAmount.
    expect(chain.select).toHaveBeenCalledWith(
      "_id workspaceId accountId type amount date note context link categoryId createdAt",
    );
    const sort = chain.select.mock.results[0].value.sort as ReturnType<typeof vi.fn>;
    expect(sort).toHaveBeenCalledWith({ date: -1, createdAt: -1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(m._id.toString());
    expect(result[0].signedAmount).toBe(100000);
  });

  it("findByWorkspaceIdForBalance applies the orphan guard (skips unresolved account)", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const live = fakeMovementDoc({ accountId: account._id, categoryId: category._id });
    const orphan = fakeMovementDoc({
      accountId: new Types.ObjectId(),
      categoryId: category._id,
    });

    movementFind.mockImplementation(() => selectExecResult([live, orphan]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceIdForBalance(UID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(live._id.toString());
  });

  it("findByWorkspaceIdForBalance returns [] when there are no movements", async () => {
    movementFind.mockImplementation(() => selectExecResult([]));
    const result = await repo.findByWorkspaceIdForBalance(UID);
    expect(result).toEqual([]);
    expect(categoryFind).not.toHaveBeenCalled();
    expect(accountFind).not.toHaveBeenCalled();
  });

  it("findByWorkspaceId (unchanged) still passes its historical tests — no behavioral drift", async () => {
    const account = fakeAccountDoc();
    const category = fakeCategoryDoc();
    const m1 = fakeMovementDoc({ accountId: account._id, categoryId: category._id });
    const m2 = fakeMovementDoc({ accountId: account._id, categoryId: category._id });

    movementFind.mockImplementation(() => execResult([m1, m2]));
    categoryFind.mockImplementation(() => execResult([category]));
    accountFind.mockImplementation(() => execResult([account]));

    const result = await repo.findByWorkspaceId(UID);
    const chain = movementFind.mock.results[0].value;
    expect(chain.sort).toHaveBeenCalledWith({ date: -1, createdAt: -1 });
    expect(result).toHaveLength(2);
  });
});

describe("MongoMovementRepository lite balance read (R15.2 corrective)", () => {
  let repo: MongoMovementRepository;
  const UID = new Types.ObjectId().toString();
  const ACCOUNT_ID = new Types.ObjectId().toString();

  beforeEach(() => {
    repo = new MongoMovementRepository();
    movementFind.mockReset();
    categoryFind.mockReset();
    accountFind.mockReset();
  });

  it("findByAccountIdForBalance maps the lite shape with a minimal projection and NO dependency resolution", async () => {
    const m = fakeMovementDoc({
      _id: new Types.ObjectId(),
      accountId: ACCOUNT_ID,
      type: "income",
      amount: 150000, // the doc persists amount as bare minor units
      signedAmount: 150000,
      date: new Date("2026-09-01T00:00:00.000Z"),
      createdAt: new Date("2026-08-30T00:00:00.000Z"),
      link: { kind: "transfer", refId: "t-1", saleId: undefined, opId: "op-1" },
    });

    const chain = execResult([m]);
    movementFind.mockImplementation(() => chain);
    // The balance path must stay at 1 query — no category/account lookups.
    categoryFind.mockImplementation(() => execResult([]));
    accountFind.mockImplementation(() => execResult([]));

    const result = await repo.findByAccountIdForBalance(UID, ACCOUNT_ID);

    const [query, projection, options] = movementFind.mock.calls[0] as [
      { workspaceId: Types.ObjectId; accountId: Types.ObjectId },
      Record<string, number>,
      { session: unknown },
    ];
    expect(query.workspaceId.toString()).toBe(UID);
    expect(query.accountId.toString()).toBe(ACCOUNT_ID);
    expect(projection).toEqual({
      accountId: 1,
      type: 1,
      amount: 1,
      date: 1,
      createdAt: 1,
      link: 1,
      signedAmount: 1,
    });
    expect(options).toHaveProperty("session");
    expect(chain.sort).toHaveBeenCalledWith({ date: -1, createdAt: -1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(m._id.toString());
    expect(result[0].accountId).toBe(ACCOUNT_ID);
    expect(result[0].type).toBe("income");
    expect(result[0].amount.amount).toBe(150000);
    expect(result[0].signedAmount).toBe(150000);
    expect(result[0].date).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(result[0].createdAt).toEqual(new Date("2026-08-30T00:00:00.000Z"));
    expect(result[0].link).toEqual({
      kind: "transfer",
      refId: "t-1",
      saleId: undefined,
      opId: "op-1",
    });

    // Parity by construction: computeAccountLiveBalance performs NO category
    // check (deleteCategory guards referenced categories) and no account lookup.
    expect(categoryFind).not.toHaveBeenCalled();
    expect(accountFind).not.toHaveBeenCalled();
  });

  it("findByAccountIdForBalance returns [] when the account has no movements", async () => {
    movementFind.mockImplementation(() => execResult([]));
    const result = await repo.findByAccountIdForBalance(UID, ACCOUNT_ID);
    expect(result).toEqual([]);
    expect(categoryFind).not.toHaveBeenCalled();
    expect(accountFind).not.toHaveBeenCalled();
  });
});
