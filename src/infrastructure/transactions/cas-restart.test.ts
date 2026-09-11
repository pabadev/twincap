import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import { MongoTransferRepository } from "../repositories/transfer-repository";
import { TransferModel } from "../models/transfer";
import { MovementModel } from "../models/movement";
import { AccountModel } from "../models/account";
import { OPENING_CATEGORY_ID } from "../../core/domain/synthetic-categories";
import { Money } from "../../core/domain/money";
import { objectIdGenerator } from "../config/id-generator";
import { Transfer } from "../../core/domain/transfer";

/**
 * R15.3 §27 — CAS survives backend restart / multiple instances.
 *
 * The optimistic-concurrency guarantee is the Mongoose `__v` version key
 * stored ON the Mongo document (bumped via `runVersionedUpdate` with
 * `$inc: { __v: 1 }` and matched in the filter as `{ ..., __v: expected }`).
 * There is NO in-memory state involved: two repository INSTANCES (two
 * backend replicas) racing the same document serialize on the persisted
 * version, the loser throws ConflictError(DEBT_MODIFIED_MSG), and after the
 * processes "restart" (fresh repository instances) the persisted document
 * still reflects exactly one winner with `__v` bumped once.
 */
describe("R15.3 §27 — CAS guarantee survives restart/multi-instance (__v on the document)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const SRC = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const DST = "cccccccccccccccccccccccc";

  const date = new Date("2025-06-01");

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_cas_restart"));
    await Promise.all([TransferModel.syncIndexes(), MovementModel.syncIndexes(), AccountModel.syncIndexes()]);
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await TransferModel.deleteMany({});
    await MovementModel.deleteMany({});
    await AccountModel.deleteMany({});
    await AccountModel.create([
      { _id: SRC, workspaceId: WS, name: "Source", currency: "COP", isFixed: false },
      { _id: DST, workspaceId: WS, name: "Dest", currency: "COP", isFixed: false },
    ]);
    await MovementModel.create({
      workspaceId: WS,
      accountId: SRC,
      type: "income",
      amount: 1_000_000,
      signedAmount: 1_000_000,
      date,
      categoryId: OPENING_CATEGORY_ID,
      link: { kind: "opening", refId: SRC, opId: objectIdGenerator.generate() },
    });
  });

  interface StoredTransfer {
    __v: number;
    sourceAmount: number;
  }

  async function seedTransfer(sourceAmount: number): Promise<string> {
    const doc = await TransferModel.create({
      workspaceId: WS,
      sourceAccountId: SRC,
      destinationAccountId: DST,
      sourceAmount,
      destinationAmount: sourceAmount,
      sourceCurrency: "COP",
      destinationCurrency: "COP",
      effectiveExchangeRate: 1,
      date,
      movementIds: { expenseId: "zzzzzzzzzzzzzzzzzzzzzzzz", incomeId: "yyyyyyyyyyyyyyyyyyyyyyyy" },
    });
    return String(doc._id);
  }

  function transferPatch(id: string, sourceAmount: number): Transfer {
    return new Transfer({
      id,
      workspaceId: WS,
      sourceAccountId: SRC,
      destinationAccountId: DST,
      sourceAmount: new Money(sourceAmount, "COP"),
      destinationAmount: new Money(sourceAmount, "COP"),
      sourceCurrency: "COP",
      destinationCurrency: "COP",
      effectiveExchangeRate: 1,
      date,
      createdAt: new Date(),
    });
  }

  it("two repository instances racing the same transfer: one wins, the loser gets ConflictError; persisted state reflects the winner after 'restart'", async () => {
    const transferId = await seedTransfer(100_000);

    // Two INDEPENDENT repository instances (two backend replicas), both
    // holding the SAME expected version (the seed's __v == 0).
    const repoA = new MongoTransferRepository();
    const repoB = new MongoTransferRepository();
    const settled = await Promise.allSettled([
      repoA.update(transferPatch(transferId, 250_000), undefined, 0),
      repoB.update(transferPatch(transferId, 500_000), undefined, 0),
    ]);

    const winners = settled.filter((s) => s.status === "fulfilled");
    const losers = settled.filter((s) => s.status === "rejected");
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const loser = losers[0];
    if (loser.status === "rejected") {
      expect(loser.reason).toBeInstanceOf(ConflictError);
      expect(String(loser.reason?.message ?? "")).toContain(DEBT_MODIFIED_MSG);
    }

    // "Restart": a FRESH repository instance re-reads the document — the
    // winner's amount is persisted and the version moved exactly once.
    const freshRepo = new MongoTransferRepository();
    const persisted = (await TransferModel.findById(transferId).lean()) as unknown as StoredTransfer;
    expect(persisted.__v).toBe(1);
    const winnerAmount = winners[0].status === "fulfilled"
      ? (winners[0].value as unknown as { sourceAmount: { amount: number } }).sourceAmount.amount
      : -1;
    expect(persisted.sourceAmount).toBe(winnerAmount);
    const reloaded = await freshRepo.findById(WS, transferId);
    expect((reloaded!.sourceAmount as unknown as { amount: number }).amount).toBe(winnerAmount);

    // A second CAS update with the STALE version (0) now fails: the version
    // is part of the persisted state, so a restarted replica cannot replay a
    // stale optimistic update.
    await expect(repoA.update(transferPatch(transferId, 750_000), undefined, 0)).rejects.toThrow(DEBT_MODIFIED_MSG);
    // While the CURRENT version (1) still allows the next writer.
    const next = await repoA.update(transferPatch(transferId, 750_000), undefined, 1);
    expect((next.sourceAmount as unknown as { amount: number }).amount).toBe(750_000);
    expect(((await TransferModel.findById(transferId).lean()) as unknown as StoredTransfer).__v).toBe(2);
  });
});