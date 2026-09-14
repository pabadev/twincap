import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditReceived } from "../../../../core/domain/credit-received";
import { Money } from "../../../../core/domain/money";

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repositories, and next/cache
// (the action's revalidateMovementData shells out to revalidatePath).

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoCreditReceivedRepository } = vi.hoisted(() => ({
  MongoCreditReceivedRepository: vi.fn(),
}));
const { MongoMovementRepository } = vi.hoisted(() => ({
  MongoMovementRepository: vi.fn(),
}));
const { MongoAccountRepository } = vi.hoisted(() => ({
  MongoAccountRepository: vi.fn(),
}));
const { trackAnalytics } = vi.hoisted(() => ({ trackAnalytics: vi.fn() }));
const { MongoOperationLogger } = vi.hoisted(() => ({
  MongoOperationLogger: vi.fn(),
}));
const { MongoUnitOfWork } = vi.hoisted(() => ({ MongoUnitOfWork: vi.fn() }));
const { claimIdempotency } = vi.hoisted(() => ({ claimIdempotency: vi.fn() }));
const { releaseIdempotency } = vi.hoisted(() => ({ releaseIdempotency: vi.fn() }));

vi.mock("../../../../infrastructure/auth/getCurrentUser", () => ({ getCurrentUser }));
vi.mock("../../../../infrastructure/db/connection", () => ({ connectDb }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("../../../../infrastructure/repositories/credit-received-repository", () => ({
  MongoCreditReceivedRepository,
}));
vi.mock("../../../../infrastructure/repositories/movement-repository", () => ({
  MongoMovementRepository,
}));
vi.mock("../../../../infrastructure/repositories/account-repository", () => ({
  MongoAccountRepository,
}));
vi.mock("../../../../lib/track-analytics", () => ({ trackAnalytics }));
vi.mock("../../../../infrastructure/repositories/operation-log-repository", () => ({
  MongoOperationLogger,
}));
vi.mock("../../../../infrastructure/transactions/mongo-unit-of-work", () => ({
  MongoUnitOfWork,
}));
vi.mock("../../../../infrastructure/auth/idempotency", () => ({
  claimIdempotency,
  releaseIdempotency,
}));

const { createCreditReceivedAction, addAbonoAction, markAsPaidAction } = await import("./actions");

function makeCreditReceived(): CreditReceived {
  return new CreditReceived({
    id: "cr-1",
    workspaceId: "user-1",
    counterparty: "Banco XYZ",
    principal: new Money(100000, "COP"),
    accountId: "acc-1",
    date: new Date("2026-09-01"),
    createdAt: new Date(),
  });
}

function setupMutationMocks() {
  connectDb.mockResolvedValue(undefined);
  MongoOperationLogger.mockImplementation(() => ({
    log: vi.fn().mockResolvedValue(undefined),
  }));
  MongoUnitOfWork.mockImplementation(() => ({
    withTransaction: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(undefined)),
  }));
  MongoAccountRepository.mockImplementation(() => ({
    findById: vi.fn().mockResolvedValue({
      id: "acc-1",
      workspaceId: "user-1",
      name: "Cash",
      currency: "COP",
      isFixed: false,
    }),
    // R15.2: abonos touch the payment account doc inside the tx.
    touch: vi.fn().mockResolvedValue(true),
  }));
  const addAbono = vi.fn().mockResolvedValue(undefined);
  const createMovement = vi.fn().mockResolvedValue(undefined);
  MongoCreditReceivedRepository.mockImplementation(() => ({
    findByWorkspaceId: vi.fn().mockResolvedValue([makeCreditReceived()]),
    addAbono,
  }));
  MongoMovementRepository.mockImplementation(() => ({
    create: createMovement,
  }));
  releaseIdempotency.mockResolvedValue(undefined);
  revalidatePath.mockResolvedValue(undefined);
  return { addAbono, createMovement };
}

describe("createCreditReceivedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
  });

  it("rejects unauthenticated callers before any data access", async () => {
    const fd = new FormData();
    fd.append("counterparty", "Banco XYZ");
    fd.append("principal", "500000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");
    fd.append("tzOffset", "300");

    const result = await createCreditReceivedAction(null, fd);

    expect(result).toEqual({ error: "error.unauthorized" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCreditReceivedRepository).not.toHaveBeenCalled();
    expect(MongoMovementRepository).not.toHaveBeenCalled();
    expect(MongoAccountRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("emits creditReceivedCreated scoped to the session user after a successful create", async () => {
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    connectDb.mockResolvedValue(undefined);
    trackAnalytics.mockResolvedValue(undefined);
    MongoOperationLogger.mockImplementation(() => ({
      log: vi.fn().mockResolvedValue(undefined),
    }));
    MongoUnitOfWork.mockImplementation(() => ({
      withTransaction: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(undefined)),
    }));
    MongoAccountRepository.mockImplementation(() => ({
      findById: vi.fn().mockResolvedValue({
        id: "acc-1",
        workspaceId: "user-1",
        name: "Cash",
        currency: "COP",
        isFixed: false,
      }),
      // R15.2: createCreditReceived touches the account doc inside the tx.
      touch: vi.fn().mockResolvedValue(true),
    }));
    MongoCreditReceivedRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);

    const fd = new FormData();
    fd.append("counterparty", "Banco XYZ");
    fd.append("principal", "500000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");
    fd.append("tzOffset", "300");
    fd.append("idempotencyKey", "key-credit-received-1");

    const result = await createCreditReceivedAction(null, fd);

    expect(result).toEqual({ success: "creditCreated" });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("creditReceivedCreated", "user-1", "user-1");
    expect(revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("rejects a request without an idempotency key before any data access (R15.1 6a)", async () => {
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });

    const fd = new FormData();
    fd.append("counterparty", "Banco XYZ");
    fd.append("principal", "500000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");
    fd.append("tzOffset", "300");

    const result = await createCreditReceivedAction(null, fd);

    expect(result).toEqual({ error: "error.idempotencyKeyRequired" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(MongoCreditReceivedRepository).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("addAbonoAction — R15.3.1 §21 post-commit failure (mocked)", () => {
  let mutationSpies: ReturnType<typeof setupMutationMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    claimIdempotency.mockReset();
    mutationSpies = setupMutationMocks();
  });

  it("post-commit revalidatePath failure: abono commits, key is NOT released, retry replays as duplicate", async () => {
    const { addAbono, createMovement } = mutationSpies;
    claimIdempotency.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // The FIRST post-commit revalidatePath (inside revalidateMovementData) throws.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error("post-commit revalidate boom");
    });

    const fd = new FormData();
    fd.append("creditId", "cr-1");
    fd.append("amount", "50000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");
    fd.append("tzOffset", "300");
    fd.append("idempotencyKey", "key-abono-post-commit");

    const first = await addAbonoAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: "error.operationFailed" });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation executed exactly once (abono push + linked movement)
    expect(addAbono).toHaveBeenCalledTimes(1);
    expect(createMovement).toHaveBeenCalledTimes(1);
    // (d) the key was NOT released after commit
    expect(releaseIdempotency).not.toHaveBeenCalled();

    // (c) retry with the SAME key → duplicate (claim returns false), no new mutation
    const retry = await addAbonoAction(null, fd);
    expect(retry).toEqual({ error: "error.duplicateRequest" });
    expect(addAbono).toHaveBeenCalledTimes(1);
    expect(createMovement).toHaveBeenCalledTimes(1);
    expect(releaseIdempotency).not.toHaveBeenCalled();
  });
});

describe("markAsPaidAction — R15.3.1 §21 post-commit failure (mocked)", () => {
  let mutationSpies: ReturnType<typeof setupMutationMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    claimIdempotency.mockReset();
    mutationSpies = setupMutationMocks();
  });

  it("post-commit revalidatePath failure: mark-as-paid commits, key is NOT released, retry replays as duplicate", async () => {
    const { addAbono, createMovement } = mutationSpies;
    claimIdempotency.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // The FIRST post-commit revalidatePath (inside revalidateMovementData) throws.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error("post-commit revalidate boom");
    });

    const fd = new FormData();
    fd.append("creditId", "cr-1");
    fd.append("accountId", "acc-1");
    fd.append("idempotencyKey", "key-mark-paid-post-commit");

    const first = await markAsPaidAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: "error.operationFailed" });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation executed exactly once (closing abono push + linked movement)
    expect(addAbono).toHaveBeenCalledTimes(1);
    expect(createMovement).toHaveBeenCalledTimes(1);
    // (d) the key was NOT released after commit
    expect(releaseIdempotency).not.toHaveBeenCalled();

    // (c) retry with the SAME key → duplicate (claim returns false), no new mutation
    const retry = await markAsPaidAction(null, fd);
    expect(retry).toEqual({ error: "error.duplicateRequest" });
    expect(addAbono).toHaveBeenCalledTimes(1);
    expect(createMovement).toHaveBeenCalledTimes(1);
    expect(releaseIdempotency).not.toHaveBeenCalled();
  });

  it("rejects a request without an accountId BEFORE claiming idempotency (H-06)", async () => {
    const fd = new FormData();
    fd.append("creditId", "cr-1");
    fd.append("idempotencyKey", "key-mark-paid-no-account");

    const result = await markAsPaidAction(null, fd);

    expect(result).toEqual({ error: "accountRequired" });
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(connectDb).not.toHaveBeenCalled();
    expect(releaseIdempotency).not.toHaveBeenCalled();
  });
});
