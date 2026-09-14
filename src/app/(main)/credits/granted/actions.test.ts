import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreditGranted } from "../../../../core/domain/credit-granted";
import { Money } from "../../../../core/domain/money";

// Server-action wiring is unit-tested with every infrastructure edge mocked:
// auth session, mongoose connection, mongo repository, and next/cache
// (the action's revalidateMovementData shells out to revalidatePath).

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { connectDb } = vi.hoisted(() => ({ connectDb: vi.fn() }));
const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
const { MongoCreditGrantedRepository } = vi.hoisted(() => ({
  MongoCreditGrantedRepository: vi.fn(),
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
vi.mock("../../../../infrastructure/repositories/credit-granted-repository", () => ({
  MongoCreditGrantedRepository,
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

const { createCreditGrantedAction, addAbonoAction, markAsPaidAction, writeOffCreditAction } =
  await import("./actions");

function makeCreditGranted(): CreditGranted {
  return new CreditGranted({
    id: "cg-1",
    workspaceId: "user-1",
    counterparty: "Pedro",
    principal: new Money(100000, "COP"),
    accountId: "acc-1",
    date: new Date("2025-06-01"),
    createdAt: new Date(),
  });
}

function formData(creditId = "cg-1"): FormData {
  const fd = new FormData();
  fd.append("creditId", creditId);
  fd.append("idempotencyKey", "test-key-write-off");
  return fd;
}

function setupGrantedMutationMocks() {
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
    // R15.2: abonos touch the credit's account doc inside the tx.
    touch: vi.fn().mockResolvedValue(true),
  }));
  const addAbono = vi.fn().mockResolvedValue(undefined);
  const createMovement = vi.fn().mockResolvedValue(undefined);
  MongoCreditGrantedRepository.mockImplementation(() => ({
    findByWorkspaceId: vi.fn().mockResolvedValue([makeCreditGranted()]),
    addAbono,
  }));
  MongoMovementRepository.mockImplementation(() => ({
    create: createMovement,
  }));
  releaseIdempotency.mockResolvedValue(undefined);
  revalidatePath.mockResolvedValue(undefined);
  return { addAbono, createMovement };
}

describe("writeOffCreditAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    connectDb.mockResolvedValue(undefined);
    // The duplicate branch logs through MongoOperationLogger unguarded.
    MongoOperationLogger.mockImplementation(() => ({
      log: vi.fn().mockResolvedValue(undefined),
    }));
    MongoUnitOfWork.mockImplementation(() => ({
      withTransaction: vi.fn(async (fn: (tx?: unknown) => Promise<unknown>) => fn(undefined)),
    }));
    // R15.2: writeOffCreditGranted touches the credit's account doc in-tx.
    MongoAccountRepository.mockImplementation(() => ({
      touch: vi.fn().mockResolvedValue(true),
    }));
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByWorkspaceId: vi.fn().mockResolvedValue([makeCreditGranted()]),
      markWrittenOff: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockImplementation(async (movement: unknown) => movement),
    }));
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated callers before any data access", async () => {
    getCurrentUser.mockResolvedValue(null);

    const result = await writeOffCreditAction(null, formData());

    expect(result).toEqual({ error: "error.unauthorized" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCreditGrantedRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("writes off the credit, registers the expense movement and revalidates", async () => {
    const markWrittenOff = vi.fn().mockResolvedValue(undefined);
    const created: unknown[] = [];
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByWorkspaceId: vi.fn().mockResolvedValue([makeCreditGranted()]),
      markWrittenOff,
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockImplementation(async (movement: unknown) => {
        created.push(movement);
        return movement;
      }),
      update: vi.fn().mockImplementation(async (movement: unknown) => movement),
      delete: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await writeOffCreditAction(null, formData());

    expect(result).toEqual({ success: "creditWrittenOff" });
    expect(created).toHaveLength(1);
    const movement = created[0] as {
      type: string;
      amount: { amount: number; currency: string };
      link: { kind: string; refId: string };
    };
    expect(movement.type).toBe("expense");
    expect(movement.amount.amount).toBe(100000);
    expect(movement.link.kind).toBe("creditGrantedWriteOff");
    expect(movement.link.refId).toBe("cg-1");
    expect(markWrittenOff).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("maps a NotFoundError to the i18n notFound toast key", async () => {
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByWorkspaceId: vi.fn().mockResolvedValue([]),
      markWrittenOff: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await writeOffCreditAction(null, formData());

    expect(result).toEqual({ error: "error.notFound" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("§21 R15.3.1 post-commit failure: write-off commits, key is NOT released, retry replays as duplicate", async () => {
    claimIdempotency.mockReset();
    claimIdempotency.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const markWrittenOff = vi.fn().mockResolvedValue(undefined);
    MongoCreditGrantedRepository.mockImplementation(() => ({
      findByWorkspaceId: vi.fn().mockResolvedValue([makeCreditGranted()]),
      markWrittenOff,
    }));
    // The FIRST post-commit revalidatePath (inside revalidateMovementData) throws.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error("post-commit revalidate boom");
    });

    const fd = formData("cg-1");

    const first = await writeOffCreditAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: "error.operationFailed" });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation executed exactly once (write-off expense + marker)
    expect(markWrittenOff).toHaveBeenCalledTimes(1);
    // (d) the key was NOT released after commit
    expect(releaseIdempotency).not.toHaveBeenCalled();

    // (c) retry with the SAME key → duplicate (claim returns false), no new mutation
    const retry = await writeOffCreditAction(null, fd);
    expect(retry).toEqual({ error: "error.duplicateRequest" });
    expect(markWrittenOff).toHaveBeenCalledTimes(1);
    expect(releaseIdempotency).not.toHaveBeenCalled();
  });
});

describe("addAbonoAction — R15.3.1 §21 post-commit failure (mocked)", () => {
  let mutationSpies: ReturnType<typeof setupGrantedMutationMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    claimIdempotency.mockReset();
    mutationSpies = setupGrantedMutationMocks();
  });

  it("post-commit revalidatePath failure: abono commits, key is NOT released, retry replays as duplicate", async () => {
    const { addAbono, createMovement } = mutationSpies;
    claimIdempotency.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // The FIRST post-commit revalidatePath (inside revalidateMovementData) throws.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error("post-commit revalidate boom");
    });

    const fd = new FormData();
    fd.append("creditId", "cg-1");
    fd.append("amount", "50000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");
    fd.append("tzOffset", "300");
    fd.append("idempotencyKey", "key-granted-abono-post-commit");

    const first = await addAbonoAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: "error.operationFailed" });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation executed exactly once (abono push + capital movement)
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
  let mutationSpies: ReturnType<typeof setupGrantedMutationMocks>;

  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });
    claimIdempotency.mockReset();
    mutationSpies = setupGrantedMutationMocks();
  });

  it("post-commit revalidatePath failure: mark-as-paid commits, key is NOT released, retry replays as duplicate", async () => {
    const { addAbono, createMovement } = mutationSpies;
    claimIdempotency.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    // The FIRST post-commit revalidatePath (inside revalidateMovementData) throws.
    revalidatePath.mockImplementationOnce(() => {
      throw new Error("post-commit revalidate boom");
    });

    const fd = new FormData();
    fd.append("creditId", "cg-1");
    fd.append("accountId", "acc-1");
    fd.append("idempotencyKey", "key-granted-mark-paid-post-commit");

    const first = await markAsPaidAction(null, fd);
    // (b) the surfaced error is the post-commit failure, not a success
    expect(first).toEqual({ error: "error.operationFailed" });
    expect(revalidatePath).toHaveBeenCalled();

    // (a) the mutation executed exactly once (closing abono push + capital movement)
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
    fd.append("creditId", "cg-1");
    fd.append("idempotencyKey", "key-granted-mark-paid-no-account");

    const result = await markAsPaidAction(null, fd);

    expect(result).toEqual({ error: "accountRequired" });
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(connectDb).not.toHaveBeenCalled();
    expect(releaseIdempotency).not.toHaveBeenCalled();
  });
});

describe("createCreditGrantedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue(null);
    claimIdempotency.mockResolvedValue(true);
    releaseIdempotency.mockResolvedValue(undefined);
  });

  it("rejects unauthenticated callers before any data access", async () => {
    const fd = new FormData();
    fd.append("counterparty", "Pedro");
    fd.append("principal", "100000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");

    const result = await createCreditGrantedAction(null, fd);

    expect(result).toEqual({ error: "error.unauthorized" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(MongoCreditGrantedRepository).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("emits creditGrantedCreated scoped to the session user after a successful create", async () => {
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
      // R15.2: createCreditGranted touches the account doc inside the tx.
      touch: vi.fn().mockResolvedValue(true),
    }));
    MongoCreditGrantedRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));
    MongoMovementRepository.mockImplementation(() => ({
      create: vi.fn().mockResolvedValue(undefined),
    }));

    const fd = new FormData();
    fd.append("counterparty", "Pedro");
    fd.append("principal", "100000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");
    fd.append("tzOffset", "300");
    fd.append("idempotencyKey", "key-credit-granted-1");

    const result = await createCreditGrantedAction(null, fd);

    expect(result).toEqual({ success: "creditCreated" });
    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith("creditGrantedCreated", "user-1", "user-1");
    expect(revalidatePath).toHaveBeenCalledTimes(4);
  });

  it("rejects a request without an idempotency key before any data access (R15.1 6a)", async () => {
    getCurrentUser.mockResolvedValue({ userId: "user-1", workspaceId: "user-1" });

    const fd = new FormData();
    fd.append("counterparty", "Pedro");
    fd.append("principal", "100000");
    fd.append("currency", "COP");
    fd.append("accountId", "acc-1");
    fd.append("date", "2026-09-01");

    const result = await createCreditGrantedAction(null, fd);

    expect(result).toEqual({ error: "error.idempotencyKeyRequired" });
    expect(connectDb).not.toHaveBeenCalled();
    expect(claimIdempotency).not.toHaveBeenCalled();
    expect(MongoCreditGrantedRepository).not.toHaveBeenCalled();
    expect(trackAnalytics).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
