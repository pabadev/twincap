import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  DEBT_MODIFIED_MSG,
  MOVEMENT_MODIFIED_MSG,
} from "../../core/domain/errors";
import { createMovement } from "../../core/application/movements/create-movement";
import { updateMovement } from "../../core/application/movements/update-movement";
import { deleteMovement } from "../../core/application/movements/delete-movement";
import { createTransfer, type CreateTransferResult } from "../../core/application/transfers/create-transfer";
import { updateTransfer } from "../../core/application/transfers/update-transfer";
import { deleteTransfer } from "../../core/application/transfers/delete-transfer";
import { createCreditReceived } from "../../core/application/credits-received/create-credit-received";
import { addAbono as addAbonoReceived } from "../../core/application/credits-received/add-abono";
import { editAbono as editAbonoReceived } from "../../core/application/credits-received/edit-abono";
import { deleteAbono as deleteAbonoReceived } from "../../core/application/credits-received/delete-abono";
import { editPrincipal as editPrincipalReceived } from "../../core/application/credits-received/edit-principal";
import { deleteCreditReceived } from "../../core/application/credits-received/delete-credit-received";
import { createCreditGranted } from "../../core/application/credits-granted/create-credit-granted";
import { deleteCreditGranted } from "../../core/application/credits-granted/delete-credit-granted";
import { createSale } from "../../core/application/sales/create-sale";
import { deleteSale } from "../../core/application/sales/delete-sale";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoCategoryRepository } from "../repositories/category-repository";
import { MongoTransferRepository } from "../repositories/transfer-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoPayableRepository } from "../repositories/payable-repository";
import { MongoClientRepository } from "../repositories/client-repository";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { CategoryModel } from "../models/category";
import { CatalogItemModel } from "../models/catalog";
import { MovementModel } from "../models/movement";
import { TransferModel } from "../models/transfer";
import { SaleModel } from "../models/sale";
import { PayableModel } from "../models/payable";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { ClientModel } from "../models/client";
import { OPENING_CATEGORY_ID } from "../../core/domain/synthetic-categories";

/**
 * R15.3.2 Fase 6 — write-skew pairs across the Fase 4/Fase 5 corrections.
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as
 * the sibling suites: latest mongod crashes on Windows).
 *
 * Post-Fase-4 (account-repo + uow signatures) and post-Fase-5 (touchAccounts
 * dedupe + sequential, H2) the following races must hold in EVERY interleaving:
 *
 *   Group A — deleteMovement × (createMovement | updateMovement |
 *              updateTransfer source bump): the account touch serializes all
 *              same-account writers; every commit leaves the ledger coherent,
 *              exactly one "winner" per deleted target, 0 orphans.
 *   Group B — updateMovement(account change) × (createMovement |
 *              createTransfer): the old-account post-CAS touch (Fase 4) closes
 *              the write skew against same-account creates/transfers.
 *   Group C — credits received (editAbono | deleteAbono | editPrincipal) ×
 *              createTransfer: touch(balanceAffected) is the shared conflict
 *              point; the credit keeps exactly-never negative pending and its
 *              linked movements mirror the final amounts.
 *   Group D — updateTransfer(destinationAmount) × createTransfer (same
 *              destination) + deleteTransfer × createTransfer: a destination
 *              edit touches the destination as its LAST write (Fase 4) and a
 *              transfer delete touches BOTH accounts — no stale-balance
 *              projection, no missing conflict point.
 *   Group E — delete of aggregates (credit received, credit granted, sale) ×
 *              createTransfer: the cascade (deleteByRefId + aggregate delete
 *              + account touch) and the create (bump + touch) serialize;
 *              exactly one delete wins, the losers abort cleanly.
 *   Group F — stress N=25: deleteMovement × createMovement (25 pairs) and the
 *              DST_i edit/create fan-out — all ops commit, every balance
 *              reconciles, 0 NoSuchTransaction.
 *
 * CHANGES: this file only adds EVIDENCE — no production code was modified.
 */
describe("R15.3.2 Fase 6 — concurrency write-skew pairs", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const SRC = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const DST = "cccccccccccccccccccccccc";
  const ACCT_A = "dddddddddddddddddddddddd";
  const ACCT_B = "eeeeeeeeeeeeeeeeeeeeeeee";
  const ACCT_C = "ffffffffffffffffffffffff";
  const RECV = "888888888888888888888888";
  const CAT_INCOME = "111111111111111111111111";
  const CATALOG_ITEM = "222222222222222222222222";
  const DATE = new Date("2025-06-01");

  const accountInput = (id: string, name: string) => ({
    _id: id,
    workspaceId: WS,
    name,
    currency: "COP" as const,
    isFixed: false,
  });

  const creditReceivedInput = {
    counterparty: "Cliente",
    principal: 100_000,
    currency: "COP" as const,
    accountId: SRC,
    date: DATE,
  };

  const abonoInput = (amount: number) => ({
    amount,
    currency: "COP" as const,
    accountId: SRC,
    date: new Date("2025-06-02"),
  });

  async function seedOpeningBalance(accountId: string, amountMinor: number): Promise<void> {
    await MovementModel.create({
      workspaceId: WS,
      accountId,
      type: "income",
      amount: amountMinor,
      signedAmount: amountMinor,
      date: DATE,
      categoryId: OPENING_CATEGORY_ID,
      link: { kind: "opening", refId: accountId, opId: objectIdGenerator.generate() },
    });
  }

  /** Σ signedAmount of the movements on a given account (canonical derived balance). */
  async function balanceOn(accountId: string): Promise<number> {
    const rows = await MovementModel.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(WS),
          accountId: new mongoose.Types.ObjectId(accountId),
        },
      },
      { $group: { _id: null, total: { $sum: "$signedAmount" } } },
    ]);
    return rows.length > 0 ? rows[0].total : 0;
  }

  /** Movements that reference a parent aggregate (refId = aggregate id). */
  async function linkedMovementCount(refId: string): Promise<number> {
    return MovementModel.countDocuments({ workspaceId: WS, "link.refId": refId });
  }

  /**
   * Every rejection must be a KNOWN clean business abort. Anything else
   * (NoSuchTransaction, TransientTransactionError, raw WriteConflict, ...)
   * is a real defect and fails the assertion with the original error.
   */
  function assertNoTransactionErrors(settled: PromiseSettledResult<unknown>[]): void {
    for (const s of settled) {
      if (s.status === "rejected") {
        const msg = (s.reason as Error)?.message ?? String(s.reason);
        expect(msg).not.toContain("NoSuchTransaction");
        expect(msg).not.toContain("TransientTransactionError");
        expect(msg).not.toContain("WriteConflict");
      }
    }
  }

  function assertCleanAborts(
    settled: PromiseSettledResult<unknown>[],
    allowed: Array<typeof ConflictError | typeof NotFoundError | typeof ValidationError> = [
      ConflictError,
      NotFoundError,
      ValidationError,
    ],
  ): void {
    for (const s of settled) {
      if (s.status === "rejected") {
        const ok = allowed.some((Klass) => s.reason instanceof Klass);
        expect(
          ok,
          `unexpected rejection: ${(s.reason as Error)?.message ?? String(s.reason)}`,
        ).toBe(true);
        assertNoTransactionErrors(settled);
      }
    }
  }

  /** Rejection messages of a settled batch — used in assertion failure output. */
  function summarizeRejections(settled: PromiseSettledResult<unknown>[]): string {
    return JSON.stringify(
      settled.filter((s) => s.status === "rejected").map((s) => (s.reason as Error)?.message ?? String(s.reason)),
    );
  }

  /** A transfer result must be a committed transfer — never a warning. */
  function expectCommittedTransfer(s: PromiseSettledResult<unknown>): { id: string; sourceAmount: number; destinationAmount: number } {
    expect(s.status).toBe("fulfilled");
    const result = (s as PromiseFulfilledResult<CreateTransferResult>).value;
    expect(result.transfer).not.toBeNull();
    if (result.transfer === null) {
      throw new Error(`unexpected warning result: ${JSON.stringify(result.warning)}`);
    }
    return {
      id: result.transfer.id,
      sourceAmount: result.transfer.sourceAmount.amount,
      destinationAmount: result.transfer.destinationAmount.amount,
    };
  }

  /** The stored transfer's legs must mirror its own amounts exactly. */
  async function assertTransferLegsMirrorTransfer(transferId: string): Promise<void> {
    const raw = await TransferModel.findById(transferId);
    expect(raw).not.toBeNull();
    const t = raw!;
    expect(t.deletedAt).toBeUndefined();
    const expense = t.movementIds?.expenseId
      ? await MovementModel.findById(t.movementIds.expenseId)
      : null;
    const income = t.movementIds?.incomeId
      ? await MovementModel.findById(t.movementIds.incomeId)
      : null;
    expect(expense).not.toBeNull();
    expect(income).not.toBeNull();
    expect(expense!.type).toBe("expense");
    expect(expense!.amount).toBe(t.sourceAmount);
    expect(expense!.accountId.toString()).toBe(t.sourceAccountId.toString());
    expect(expense!.link!.kind).toBe("transfer");
    expect(income!.type).toBe("income");
    expect(income!.amount).toBe(t.destinationAmount);
    expect(income!.accountId.toString()).toBe(t.destinationAccountId.toString());
    expect(income!.link!.kind).toBe("transfer");
  }

  function createTransferOp(input: {
    sourceAccountId: string;
    destinationAccountId: string;
    sourceAmount: number;
    destinationAmount?: number;
    date?: Date;
    note?: string;
  }): Promise<CreateTransferResult> {
    return createTransfer(
      WS,
      {
        sourceAccountId: input.sourceAccountId,
        destinationAccountId: input.destinationAccountId,
        sourceAmount: input.sourceAmount,
        sourceCurrency: "COP",
        ...(input.destinationAmount !== undefined ? { destinationAmount: input.destinationAmount } : {}),
        date: input.date ?? DATE,
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      new MongoTransferRepository(),
      new MongoMovementRepository(),
      objectIdGenerator,
      new MongoAccountRepository(),
      new MongoCreditReceivedRepository(),
      new MongoCreditGrantedRepository(),
      new MongoSaleRepository(),
      new MongoPayableRepository(),
      new MongoUnitOfWork(),
    );
  }

  function updateTransferOp(
    transferId: string,
    input: { sourceAmount?: number; destinationAmount?: number; date?: Date; note?: string },
  ): ReturnType<typeof updateTransfer> {
    return updateTransfer(
      WS,
      transferId,
      {
        ...(input.sourceAmount !== undefined ? { sourceAmount: input.sourceAmount } : {}),
        ...(input.destinationAmount !== undefined ? { destinationAmount: input.destinationAmount } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
      new MongoTransferRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoCreditReceivedRepository(),
      new MongoCreditGrantedRepository(),
      new MongoSaleRepository(),
      new MongoPayableRepository(),
      new MongoUnitOfWork(),
    );
  }

  /** Seed N manual movements (income, real category) on a given account. */
  async function seedManualMovements(accountId: string, count: number, baseAmount: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const m = await createMovement(
        WS,
        {
          accountId,
          type: "income",
          amount: baseAmount,
          currency: "COP",
          date: DATE,
          categoryId: CAT_INCOME,
        },
        new MongoMovementRepository(),
        new MongoCategoryRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      ids.push(m.id);
    }
    return ids;
  }

  function deleteMovementOp(movementId: string): Promise<void> {
    return deleteMovement(
      WS,
      movementId,
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function createMovementOp(accountId: string, amount: number): ReturnType<typeof createMovement> {
    return createMovement(
      WS,
      {
        accountId,
        type: "income",
        amount,
        currency: "COP",
        date: DATE,
        categoryId: CAT_INCOME,
      },
      new MongoMovementRepository(),
      new MongoCategoryRepository(),
      objectIdGenerator,
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function updateMovementOp(movementId: string, input: { amount?: number; accountId?: string }): ReturnType<typeof updateMovement> {
    return updateMovement(
      WS,
      { movementId, ...input },
      new MongoMovementRepository(),
      new MongoCategoryRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function deleteTransferOp(transferId: string): Promise<void> {
    return deleteTransfer(
      WS,
      transferId,
      new MongoTransferRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function editAbonoOp(creditId: string, abonoId: string, amount: number): ReturnType<typeof editAbonoReceived> {
    return editAbonoReceived(
      WS,
      creditId,
      abonoId,
      { amount },
      new MongoCreditReceivedRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function deleteAbonoOp(creditId: string, abonoId: string): ReturnType<typeof deleteAbonoReceived> {
    return deleteAbonoReceived(
      WS,
      creditId,
      abonoId,
      new MongoCreditReceivedRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function editPrincipalOp(creditId: string, principal: number): ReturnType<typeof editPrincipalReceived> {
    return editPrincipalReceived(
      WS,
      creditId,
      { principal, currency: "COP" },
      new MongoCreditReceivedRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function deleteCreditReceivedOp(creditId: string): Promise<void> {
    return deleteCreditReceived(
      WS,
      creditId,
      new MongoCreditReceivedRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function deleteCreditGrantedOp(creditId: string): Promise<void> {
    return deleteCreditGranted(
      WS,
      creditId,
      new MongoCreditGrantedRepository(),
      new MongoMovementRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  function deleteSaleOp(saleId: string): Promise<void> {
    return deleteSale(
      WS,
      saleId,
      new MongoSaleRepository(),
      new MongoCatalogItemRepository(),
      new MongoMovementRepository(),
      new MongoCreditGrantedRepository(),
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
  }

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_write_skew"));
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await SaleModel.deleteMany({});
    await PayableModel.deleteMany({});
    await TransferModel.deleteMany({});
    await CreditReceivedModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await CategoryModel.deleteMany({});
    await MovementModel.deleteMany({});
    await ClientModel.deleteMany({});
    // Accounts are recreated so every account `__v` starts at 0 (a previous
    // test's bump must not leak into this one).
    await AccountModel.deleteMany({});
    await AccountModel.create([
      accountInput(SRC, "Source"),
      accountInput(DST, "Destination"),
      accountInput(ACCT_A, "Acct A"),
      accountInput(ACCT_B, "Acct B"),
      accountInput(ACCT_C, "Acct C"),
    ]);
    await CategoryModel.create({
      _id: CAT_INCOME,
      workspaceId: WS,
      name: "Manual income",
      type: "income",
    });
    await CatalogItemModel.create({
      _id: CATALOG_ITEM,
      workspaceId: WS,
      name: "Widget",
      unitPrice: 50_000,
      currency: "COP",
      type: "product",
      stock: 100,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP A — deleteMovement × (createMovement | updateMovement |
  //            updateTransfer source bump): the account touch serializes
  //            every same-account writer; ledger stays coherent.
  // ─────────────────────────────────────────────────────────────────────────
  describe("Group A — deleteMovement races", () => {
    it("A1 — N=10 deleteMovement × N=10 createMovement (same account): all commit, ledger coherent, 0 orphans", async () => {
      const N = 10;
      const seeded = await seedManualMovements(SRC, N, 1_000);

      const settled = await Promise.allSettled([
        ...seeded.map((id) => deleteMovementOp(id)),
        ...Array.from({ length: N }, () => createMovementOp(SRC, 2_000)),
      ]);

      assertNoTransactionErrors(settled);
      expect(settled.every((s) => s.status === "fulfilled")).toBe(true);

      // Ledger: each delete removed its seeded movement, each create added a
      // new one → exactly N movements remain, all on the seed account.
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(N);
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: { $ne: SRC } })).toBe(0);
      // The deletes removed the seeded +1_000 movements; only the +2_000
      // creates remain.
      expect(await balanceOn(SRC)).toBe(N * 2_000); // 20_000
    }, 120_000);

    it("A2 — N=10 deleteMovement × N=10 updateMovement of the SAME movement: exactly ONE delete wins, COHERENT terminal, 0 orphans", async () => {
      const N = 10;
      const [movementId] = await seedManualMovements(SRC, 1, 30_000);

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => deleteMovementOp(movementId)),
        ...Array.from({ length: N }, (_, i) => updateMovementOp(movementId, { amount: 40_000 + i * 1_000 })),
      ]);

      assertNoTransactionErrors(settled);

      const deletes = settled.slice(0, N);
      const updates = settled.slice(N);
      const deleteWinners = deletes.filter((s) => s.status === "fulfilled");
      expect(deleteWinners.length).toBe(1);
      for (const loser of deletes.filter((s) => s.status === "rejected")) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
        // Losers abort with EITHER the use-case message (fresh read found the
        // movement gone — 'Movement not found') or the repository message (the
        // winning delete committed between the read and the deleteOne →
        // 'Movement <id> not found for user <ws>'). Same monotonic loser.
        const message = (loser.reason as Error).message;
        expect(["Movement not found", `Movement ${movementId} not found for user ${WS}`]).toContain(message);
      }

      // Updates that committed before the winning delete are legal; any
      // rejected update must be a clean business abort (NotFound after the
      // delete, or CAS ConflictError(MOVEMENT_MODIFIED_MSG)).
      // NOTE: an update that loses the CAS re-reads the movement inside the
      // same session — if the delete already won, it translates to NotFound;
      // if another edit won, to ConflictError. Both are legal here.
      for (const u of updates) {
        if (u.status === "rejected") {
          const reason = u.reason as Error;
          const ok = reason instanceof NotFoundError || reason instanceof ConflictError;
          expect(ok, `unexpected update rejection: ${reason?.message ?? String(u.reason)}`).toBe(true);
          if (reason instanceof ConflictError) {
            expect(reason.message).toBe(MOVEMENT_MODIFIED_MSG);
          }
        }
      }
      // A fulfilled update is NOT guaranteed: if the first committed write is a
      // delete, every update re-reads the movement and aborts with NotFound —
      // the terminal is what matters and it is deterministic (see below).

      // THE delete is monotonic: it re-executes until it commits on a live
      // doc, and no update can remove the movement — so in ANY interleaving
      // the terminal is deterministic: the movement is gone, exactly once.
      expect(await MovementModel.countDocuments({ workspaceId: WS, _id: movementId })).toBe(0);
      expect(await linkedMovementCount(movementId)).toBe(0);
      expect(await balanceOn(SRC)).toBe(0);
    }, 120_000);

    it("A3 — N=10 deleteMovement × N=10 updateTransfer(source bump) on the SAME source: deletes all commit, edits never warn, transfer coherent, ledger reconciles", async () => {
      const N = 10;
      await seedOpeningBalance(ACCT_C, 100_000); // source X
      const seedTransferResult = await createTransferOp({
        sourceAccountId: ACCT_C,
        destinationAccountId: DST,
        sourceAmount: 40_000,
      });
      if (seedTransferResult.transfer === null) {
        throw new Error("seed transfer emitted a warning unexpectedly");
      }
      const seedTransfer = seedTransferResult.transfer;
      const manualIds = await seedManualMovements(ACCT_C, N, 2_000);

      const settled = await Promise.allSettled([
        ...manualIds.map((id) => deleteMovementOp(id)),
        ...Array.from({ length: N }, (_, i) =>
          updateTransferOp(seedTransfer.id, { sourceAmount: 30_000 + i * 1_000, destinationAmount: 30_000 + i * 1_000 }),
        ),
      ]);

      assertNoTransactionErrors(settled);
      const deletes = settled.slice(0, N);
      const edits = settled.slice(N);
      expect(deletes.every((s) => s.status === "fulfilled")).toBe(true);

      // Every edit either committed (ledger shows its final amount) or aborted
      // with the transfer CAS — never a warning, never an orphan.
      const editResults = edits
        .filter((s) => s.status === "fulfilled")
        .map((s) => {
          const result = (s as PromiseFulfilledResult<{ transfer: { id: string; sourceAmount: { amount: number } }; warning: unknown }>).value;
          expect(result.transfer).not.toBeNull();
          return result.transfer.sourceAmount.amount;
        });
      expect(editResults.length).toBeGreaterThanOrEqual(1);
      for (const e of edits.filter((s) => s.status === "rejected")) {
        expect(e.reason).toBeInstanceOf(ConflictError);
        expect((e.reason as Error).message).toBe(DEBT_MODIFIED_MSG);
      }

      // Terminal: the manual movements are all gone; the transfer keeps its
      // legs mirroring the LAST COMMITTED edit — commit order is
      // schedule-dependent, so the stored amount must be one of the committed
      // proposals, never an input-array index; X reconciles to
      // opening − final source amount.
      const finalTransfer = await TransferModel.findById(seedTransfer.id);
      expect(finalTransfer).not.toBeNull();
      expect(editResults).toContain(finalTransfer!.sourceAmount);
      await assertTransferLegsMirrorTransfer(seedTransfer.id);
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: ACCT_C })).toBe(2); // opening + expense leg
      expect(await balanceOn(ACCT_C)).toBe(100_000 - finalTransfer!.sourceAmount);
      expect(await balanceOn(DST)).toBe(finalTransfer!.destinationAmount);
    }, 120_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP B — updateMovement(account change) × same-account writers: the
  //           post-CAS touch of the OLD account (Fase 4) closes the skew.
  // ─────────────────────────────────────────────────────────────────────────
  describe("Group B — updateMovement account-change races", () => {
    it("B4 — N=10 updateMovement(A→B) × N=10 createMovement on A: all commit, movement lands on B, A/B ledgers coherent", async () => {
      const N = 10;
      await seedOpeningBalance(ACCT_A, 100_000);
      const [movementId] = await seedManualMovements(ACCT_A, 1, 30_000);

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => updateMovementOp(movementId, { accountId: ACCT_B })),
        ...Array.from({ length: N }, () => createMovementOp(ACCT_A, 10_000)),
      ]);

      assertNoTransactionErrors(settled);
      const updates = settled.slice(0, N);
      const creates = settled.slice(N);

      // The movements reads are session-less by convention (update-movement:
      // `findById` without tx), so an edit can lose its CAS against a peer
      // that committed between read and write → ConflictError(MOVEMENT_MODIFIED_MSG).
      // Winners re-target the SAME doc (accountId already == B → no touch),
      // losers abort atomically — every outcome leaves the terminal coherent.
      const committedUpdates = updates.filter((s) => s.status === "fulfilled");
      expect(committedUpdates.length).toBeGreaterThanOrEqual(1);
      for (const u of updates.filter((s) => s.status === "rejected")) {
        expect(u.reason).toBeInstanceOf(ConflictError);
        expect((u.reason as Error).message).toBe(MOVEMENT_MODIFIED_MSG);
      }
      // createMovement has no CAS path (insert + non-versioned touch) → strict.
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);

      // The movement landed on B exactly once (subsequent edits re-target the
      // same doc with accountId already == B → no touch, single CAS write).
      const moved = await MovementModel.findById(movementId);
      expect(moved).not.toBeNull();
      expect(moved!.accountId.toString()).toBe(ACCT_B);
      expect(moved!.link).toBeUndefined();
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: ACCT_B })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: ACCT_A })).toBe(N + 1); // opening + creates
      expect(await balanceOn(ACCT_A)).toBe(100_000 + N * 10_000); // 200_000
      expect(await balanceOn(ACCT_B)).toBe(30_000);
    }, 120_000);

    it("B5 — N=10 updateMovement(A→B) × N=10 createTransfer A→C: all commit, A/C ledgers coherent with the edits", async () => {
      const N = 10;
      const TRANSFER_AMOUNT = 20_000;
      await seedOpeningBalance(ACCT_A, 300_000);
      const [movementId] = await seedManualMovements(ACCT_A, 1, 30_000);

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => updateMovementOp(movementId, { accountId: ACCT_B })),
        ...Array.from({ length: N }, () =>
          createTransferOp({ sourceAccountId: ACCT_A, destinationAccountId: ACCT_C, sourceAmount: TRANSFER_AMOUNT }),
        ),
      ]);

      assertNoTransactionErrors(settled);
      const updates = settled.slice(0, N);
      const creates = settled.slice(N);

      // Same CAS semantics as B4: movement edits read session-less, so a loser
      // against a peer edit aborts with ConflictError(MOVEMENT_MODIFIED_MSG);
      // winners always land the movement on B. The creates bump A with a
      // session-scoped version (create-transfer), which serializes with the
      // updates' touches via document conflict + replay → all fulfill.
      const committedUpdates = updates.filter((s) => s.status === "fulfilled");
      expect(committedUpdates.length).toBeGreaterThanOrEqual(1);
      for (const u of updates.filter((s) => s.status === "rejected")) {
        expect(u.reason).toBeInstanceOf(ConflictError);
        expect((u.reason as Error).message).toBe(MOVEMENT_MODIFIED_MSG);
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);

      const moved = await MovementModel.findById(movementId);
      expect(moved!.accountId.toString()).toBe(ACCT_B);
      expect(await balanceOn(ACCT_A)).toBe(300_000 - N * TRANSFER_AMOUNT); // 100_000
      expect(await balanceOn(ACCT_B)).toBe(30_000);
      expect(await balanceOn(ACCT_C)).toBe(N * TRANSFER_AMOUNT); // 200_000
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1 + 1 + 2 * N); // opening + moved + legs
    }, 120_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP C — credits received (editAbono | deleteAbono | editPrincipal) ×
  //           createTransfer: the balance-affecting touch is the shared
  //           conflict point; pending NEVER goes negative.
  // ─────────────────────────────────────────────────────────────────────────
  describe("Group C — credits-received × createTransfer races", () => {
    it("C6 — N=10 editAbono × N=10 createTransfer: all commit, abono mirrors the final amount, pending + ledgers coherent", async () => {
      const N = 10;
      const SEED_PRINCIPAL = 100_000;
      const SEED_ABONO = 20_000;
      await seedOpeningBalance(SRC, 200_000);
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      // addAbonoReceived returns the CreditReceived entity (not the abono) —
      // the abono id must be read from its abonos array.
      const withAbono = await addAbonoReceived(
        WS,
        credit.id,
        abonoInput(SEED_ABONO),
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      const abonoId = withAbono.abonos[withAbono.abonos.length - 1].id;

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, (_, i) => editAbonoOp(credit.id, abonoId, 25_000 + i * 1_000)),
        ...Array.from({ length: N }, () => createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: 10_000 })),
      ]);

      assertNoTransactionErrors(settled);
      expect(settled.every((s) => s.status === "fulfilled")).toBe(true);

      // The abono amount is the last committed edit; its movement mirrors it.
      const doc = await CreditReceivedModel.findById(credit.id);
      expect(doc).not.toBeNull();
      expect(doc!.abonos).toHaveLength(1);
      const finalAbono = doc!.abonos[0].amount;
      expect(finalAbono).toBeGreaterThanOrEqual(25_000);
      expect(finalAbono).toBeLessThanOrEqual(34_000);
      const abonoMovement = await MovementModel.findOne({ workspaceId: WS, "link.kind": "creditReceivedAbono", "link.refId": credit.id });
      expect(abonoMovement).not.toBeNull();
      expect(abonoMovement!.amount).toBe(finalAbono);
      expect(doc!.principal).toBe(SEED_PRINCIPAL); // principal unchanged; pending = principal − final abono
      expect(doc!.principal - finalAbono).toBeGreaterThanOrEqual(0);

      expect(await linkedMovementCount(credit.id)).toBe(2); // principal + abono
      expect(await balanceOn(SRC)).toBe(200_000 + SEED_PRINCIPAL - finalAbono - N * 10_000);
      expect(await balanceOn(DST)).toBe(N * 10_000);
    }, 120_000);

    it("C7 — N=10 deleteAbono × N=10 createTransfer: exactly ONE abono delete wins, the rest clean NotFound, pending + ledgers coherent", async () => {
      const N = 10;
      await seedOpeningBalance(SRC, 200_000);
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      const withA1 = await addAbonoReceived(
        WS,
        credit.id,
        abonoInput(20_000),
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      const a1Id = withA1.abonos[withA1.abonos.length - 1].id;
      await addAbonoReceived(
        WS,
        credit.id,
        abonoInput(10_000),
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => deleteAbonoOp(credit.id, a1Id)),
        ...Array.from({ length: N }, () => createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: 10_000 })),
      ]);

      assertNoTransactionErrors(settled);
      const deletes = settled.slice(0, N);
      const creates = settled.slice(N);
      expect(deletes.filter((s) => s.status === "fulfilled").length).toBe(1);
      for (const loser of deletes.filter((s) => s.status === "rejected")) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
        expect((loser.reason as Error).message).toBe("Abono not found");
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);

      const doc = await CreditReceivedModel.findById(credit.id);
      expect(doc!.abonos).toHaveLength(1); // the 10_000 abono survives
      expect(doc!.abonos[0].amount).toBe(10_000);
      expect(doc!.principal - 10_000).toBe(90_000); // pending
      expect(await linkedMovementCount(credit.id)).toBe(2); // principal + surviving abono
      // opening + principal − surviving abono (10_000) − transfers; the 20_000
      // abono movement was deleted together with its abono.
      expect(await balanceOn(SRC)).toBe(200_000 + 100_000 - 10_000 - N * 10_000); // 190_000
      expect(await balanceOn(DST)).toBe(N * 10_000);
    }, 120_000);

    it("C8 — N=10 editPrincipal × N=10 createTransfer: all commit, principal mirrors the final amount, ledgers coherent", async () => {
      const N = 10;
      await seedOpeningBalance(SRC, 200_000);
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, (_, i) => editPrincipalOp(credit.id, 140_000 + i * 1_000)),
        ...Array.from({ length: N }, () => createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: 10_000 })),
      ]);

      assertNoTransactionErrors(settled);
      expect(settled.every((s) => s.status === "fulfilled")).toBe(true);

      const doc = await CreditReceivedModel.findById(credit.id);
      expect(doc).not.toBeNull();
      const finalPrincipal = doc!.principal;
      expect(finalPrincipal).toBeGreaterThanOrEqual(140_000);
      expect(finalPrincipal).toBeLessThanOrEqual(149_000);
      const principalMovement = await MovementModel.findOne({ workspaceId: WS, "link.kind": "creditReceivedPrincipal", "link.refId": credit.id });
      expect(principalMovement).not.toBeNull();
      expect(principalMovement!.amount).toBe(finalPrincipal);
      expect(await linkedMovementCount(credit.id)).toBe(1);
      expect(await balanceOn(SRC)).toBe(200_000 + finalPrincipal - N * 10_000);
      expect(await balanceOn(DST)).toBe(N * 10_000);
    }, 120_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP D — updateTransfer(destination-only) / deleteTransfer ×
  //           createTransfer: the Fase 4 conflict points on the destination.
  // ─────────────────────────────────────────────────────────────────────────
  describe("Group D — transfer edit/delete × createTransfer races", () => {
    it("D9 — N=10 updateTransfer(amount edit, same-currency) × N=10 createTransfer to the SAME destination: committed edits converge, destination ledger reconciles with the final amount", async () => {
      const N = 10;
      const SEED_SOURCE = 100_000;
      const CREATE_AMOUNT = 20_000;
      await seedOpeningBalance(SRC, 400_000);
      const seedTransferResult = await createTransferOp({
        sourceAccountId: SRC,
        destinationAccountId: DST,
        sourceAmount: SEED_SOURCE,
      });
      if (seedTransferResult.transfer === null) {
        throw new Error("seed transfer emitted a warning unexpectedly");
      }
      const seedTransfer = seedTransferResult.transfer;

      const settled = await Promise.allSettled([
        // Same-currency transfers REQUIRE sourceAmount === destinationAmount
        // (Transfer domain), so a dest-adjusting edit moves both amounts.
        // newAmount ≥ 90_000 vs seed 100_000 → delta ≤ 0 → funds check skipped.
        ...Array.from({ length: N }, (_, i) =>
          updateTransferOp(seedTransfer.id, { sourceAmount: 90_000 + i * 2_000, destinationAmount: 90_000 + i * 2_000 }),
        ),
        ...Array.from({ length: N }, () =>
          createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: CREATE_AMOUNT }),
        ),
      ]);

      assertNoTransactionErrors(settled);
      const edits = settled.slice(0, N);
      const creates = settled.slice(N);

      // The transfer read is session-less (update-transfer convention), so an
      // edit can lose its transfer CAS against a peer → clean
      // ConflictError(DEBT_MODIFIED_MSG); every committed edit moves BOTH
      // amounts and cascades legs atomically. The creates bump SRC with a
      // session-scoped version → they serialize via document conflict + replay
      // and always fulfill.
      const committedEdits = edits.filter((s) => s.status === "fulfilled");
      expect(committedEdits.length).toBeGreaterThanOrEqual(1);
      for (const e of edits.filter((s) => s.status === "rejected")) {
        expect(e.reason).toBeInstanceOf(ConflictError);
        expect((e.reason as Error).message).toBe(DEBT_MODIFIED_MSG);
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);
      for (const s of committedEdits) {
        expectCommittedTransfer(s);
      }
      for (const s of creates) {
        expectCommittedTransfer(s);
      }

      // Every edit asserts source === destination and the destination touch
      // (Fase 4) is the shared conflict point for the creates.
      const finalTransfer = await TransferModel.findById(seedTransfer.id);
      expect(finalTransfer).not.toBeNull();
      expect(finalTransfer!.sourceAmount).toBe(finalTransfer!.destinationAmount);
      expect(finalTransfer!.sourceAmount).toBeGreaterThanOrEqual(90_000);
      expect(finalTransfer!.sourceAmount).toBeLessThanOrEqual(108_000);
      await assertTransferLegsMirrorTransfer(seedTransfer.id);
      for (const s of creates) {
        await assertTransferLegsMirrorTransfer(expectCommittedTransfer(s).id);
      }

      expect(await TransferModel.countDocuments({ workspaceId: WS, deletedAt: { $exists: false } })).toBe(N + 1);
      expect(await balanceOn(SRC)).toBe(400_000 - finalTransfer!.sourceAmount - N * CREATE_AMOUNT);
      expect(await balanceOn(DST)).toBe(finalTransfer!.destinationAmount + N * CREATE_AMOUNT);
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: DST })).toBe(N + 1); // seed income leg + creates
    }, 120_000);

    it("D10 — N=10 deleteTransfer × N=10 createTransfer from the SAME source: exactly ONE delete wins, 0 linked movements left, ledgers coherent", async () => {
      const N = 10;
      const SEED_SOURCE = 40_000;
      const CREATE_AMOUNT = 10_000;
      await seedOpeningBalance(SRC, 200_000);
      const seedTransferResult = await createTransferOp({
        sourceAccountId: SRC,
        destinationAccountId: DST,
        sourceAmount: SEED_SOURCE,
      });
      if (seedTransferResult.transfer === null) {
        throw new Error("seed transfer emitted a warning unexpectedly");
      }
      const seedTransfer = seedTransferResult.transfer;

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => deleteTransferOp(seedTransfer.id)),
        ...Array.from({ length: N }, () =>
          createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: CREATE_AMOUNT }),
        ),
      ]);

      assertNoTransactionErrors(settled);
      const deletes = settled.slice(0, N);
      const creates = settled.slice(N);
      expect(deletes.filter((s) => s.status === "fulfilled").length).toBe(1);
      for (const loser of deletes.filter((s) => s.status === "rejected")) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
        // Losers abort with EITHER the use-case message (fresh read found the
        // transfer gone — 'Transfer not found') or the repository message (the
        // winning delete committed in between the read and findOneAndDelete →
        // 'Transfer <id> not found for user <ws>'). Both are clean NotFound
        // aborts of the same monotonic loser.
        const message = (loser.reason as Error).message;
        expect(["Transfer not found", `Transfer ${seedTransfer.id} not found for user ${WS}`]).toContain(message);
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);
      for (const s of creates) {
        expectCommittedTransfer(s);
      }

      // The seed transfer cascade left no trace; the 10 creates are intact
      // and mirror their amounts.
      expect(await linkedMovementCount(seedTransfer.id)).toBe(0);
      expect(await TransferModel.countDocuments({ workspaceId: WS, _id: seedTransfer.id })).toBe(0);
      expect(await TransferModel.countDocuments({ workspaceId: WS, deletedAt: { $exists: false } })).toBe(N);
      for (const s of creates) {
        await assertTransferLegsMirrorTransfer(expectCommittedTransfer(s).id);
      }
      expect(await balanceOn(SRC)).toBe(200_000 - N * CREATE_AMOUNT); // 100_000
      expect(await balanceOn(DST)).toBe(N * CREATE_AMOUNT); // 100_000
    }, 120_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP E — delete of aggregates (credit received, credit granted, sale) ×
  //           createTransfer: the cascade and the create serialize via the
  //           account write; exactly one delete wins.
  // ─────────────────────────────────────────────────────────────────────────
  describe("Group E — aggregate deletion × createTransfer races", () => {
    it("E11 — N=10 deleteCreditReceived × N=10 createTransfer: exactly ONE delete wins, 0 linked movements, ledgers coherent", async () => {
      const N = 10;
      await seedOpeningBalance(SRC, 300_000);
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => deleteCreditReceivedOp(credit.id)),
        ...Array.from({ length: N }, () => createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: 10_000 })),
      ]);

      assertNoTransactionErrors(settled);
      const deletes = settled.slice(0, N);
      const creates = settled.slice(N);
      expect(deletes.filter((s) => s.status === "fulfilled").length).toBe(1);
      for (const loser of deletes.filter((s) => s.status === "rejected")) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
        expect((loser.reason as Error).message).toBe("Credit not found");
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);
      for (const s of creates) {
        expectCommittedTransfer(s);
      }

      expect(await CreditReceivedModel.findById(credit.id)).toBeNull();
      expect(await linkedMovementCount(credit.id)).toBe(0);
      // opening (300k) − 10 transfers (−100k): the principal movement (+100k)
      // is cascade-deleted with the credit → NOT part of the terminal ledger.
      expect(await balanceOn(SRC)).toBe(200_000);
      expect(await balanceOn(DST)).toBe(N * 10_000);
    }, 120_000);

    it("E12 — N=10 deleteCreditGranted × N=10 createTransfer: exactly ONE delete wins, 0 linked movements, ledgers coherent", async () => {
      const N = 10;
      await seedOpeningBalance(SRC, 300_000);
      const credit = await createCreditGranted(
        WS,
        creditReceivedInput,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => deleteCreditGrantedOp(credit.id)),
        ...Array.from({ length: N }, () => createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: 10_000 })),
      ]);

      assertNoTransactionErrors(settled);
      const deletes = settled.slice(0, N);
      const creates = settled.slice(N);
      expect(deletes.filter((s) => s.status === "fulfilled").length).toBe(1);
      for (const loser of deletes.filter((s) => s.status === "rejected")) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
        expect((loser.reason as Error).message).toBe("Credit not found");
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);
      for (const s of creates) {
        expectCommittedTransfer(s);
      }

      expect(await CreditGrantedModel.findById(credit.id)).toBeNull();
      expect(await linkedMovementCount(credit.id)).toBe(0);
      // opening (300k) − 10 transfers (−100k): the principal movement (−100k)
      // is cascade-deleted with the credit grant → NOT part of the terminal
      // ledger.
      expect(await balanceOn(SRC)).toBe(200_000);
      expect(await balanceOn(DST)).toBe(N * 10_000);
    }, 120_000);

    it("E13 — N=10 deleteSale × N=10 createTransfer: exactly ONE delete wins, stock restored exactly once, 0 linked movements", async () => {
      const N = 10;
      const SALE_AMOUNT = 50_000;
      await seedOpeningBalance(SRC, 100_000);
      const sale = await createSale(
        WS,
        {
          items: [{ itemId: CATALOG_ITEM, quantity: 1, unitPrice: SALE_AMOUNT }],
          accountId: SRC,
          date: DATE,
          paymentMode: "paid-in-full",
          currency: "COP",
        },
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoClientRepository(),
        new MongoCreditGrantedRepository(),
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      const settled = await Promise.allSettled([
        ...Array.from({ length: N }, () => deleteSaleOp(sale.id)),
        ...Array.from({ length: N }, () => createTransferOp({ sourceAccountId: SRC, destinationAccountId: DST, sourceAmount: 10_000 })),
      ]);

      assertNoTransactionErrors(settled);
      const deletes = settled.slice(0, N);
      const creates = settled.slice(N);
      expect(deletes.filter((s) => s.status === "fulfilled").length).toBe(1);
      for (const loser of deletes.filter((s) => s.status === "rejected")) {
        expect(loser.reason).toBeInstanceOf(NotFoundError);
        expect((loser.reason as Error).message).toBe("Sale not found");
      }
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);
      for (const s of creates) {
        expectCommittedTransfer(s);
      }

      expect(await SaleModel.findById(sale.id)).toBeNull();
      expect(await linkedMovementCount(sale.id)).toBe(0);
      const catalog = await CatalogItemModel.findById(CATALOG_ITEM);
      expect(catalog!.stock).toBe(100); // restored exactly once
      // opening (100k) − 10 transfers (−100k): the sale income movement (+50k)
      // is cascade-deleted with the sale → NOT part of the terminal ledger.
      expect(await balanceOn(SRC)).toBe(0);
      expect(await balanceOn(DST)).toBe(N * 10_000);
    }, 120_000);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GROUP F — stress N=25
  // ─────────────────────────────────────────────────────────────────────────
  describe("Group F — stress N=25", () => {
    it("F14 — N=25 deleteMovement × N=25 createMovement (same account): all 50 commit, ledger coherent", async () => {
      const N = 25;
      const seeded = await seedManualMovements(SRC, N, 1_000);

      const settled = await Promise.allSettled([
        ...seeded.map((id) => deleteMovementOp(id)),
        ...Array.from({ length: N }, () => createMovementOp(SRC, 2_000)),
      ]);

      assertNoTransactionErrors(settled);
      expect(settled.every((s) => s.status === "fulfilled")).toBe(true);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(N);
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: { $ne: SRC } })).toBe(0);
      // terminal = only the creates: the N seeded (1_000) are deleted, so
      // N × 2_000; the assertion must NOT subtract the deleted seeds.
      expect(await balanceOn(SRC)).toBe(N * 2_000); // 50_000
    }, 120_000);

    it("F15 — N=25 updateTransfer(amount edit) × N=25 createTransfer (DST_i fan-out, 25 source accounts): all 50 commit, EVERY account reconciles", async () => {
      const N = 25;
      const SEED_SOURCE = 10_000;
      const EDIT_DEST = 12_000;
      const CREATE_AMOUNT = 5_000;
      const dstAccounts = Array.from({ length: N }, (_, i) =>
        (400 + i).toString(16).padStart(24, "0"),
      );
      await AccountModel.create(dstAccounts.map((id, i) => accountInput(id, `DST ${i}`)));
      await AccountModel.create([accountInput(RECV, "Receiver")]);

      // Opening funds BOTH the seeds and the edit deltas: after 25 seeds of
      // 10_000 the source sits at 0, and each +2_000 edit would trip the
      // R15.2 D1 funds check (projected = 0 − 2_000 < 0 → warning, no write).
      // Reserve N × (EDIT_DEST − SEED_SOURCE) so every edit projects ≥ 0.
      await seedOpeningBalance(SRC, N * SEED_SOURCE + N * (EDIT_DEST - SEED_SOURCE)); // 300_000
      const seeds: string[] = [];
      for (const dst of dstAccounts) {
        const t = await createTransferOp({
          sourceAccountId: SRC,
          destinationAccountId: dst,
          sourceAmount: SEED_SOURCE,
        });
        if (t.transfer === null) {
          throw new Error("seed transfer emitted a warning unexpectedly");
        }
        seeds.push(t.transfer.id);
      }

      const settled = await Promise.allSettled([
        // Same-currency transfers REQUIRE sourceAmount === destinationAmount,
        // so the dest-raising edit moves both amounts (delta +2_000 → funds
        // check: dst balance ≥ 5_000 → projected ≥ 3_000, never a warning).
        ...seeds.map((id) =>
          updateTransferOp(id, { sourceAmount: EDIT_DEST, destinationAmount: EDIT_DEST }),
        ),
        ...dstAccounts.map((dst) =>
          createTransferOp({ sourceAccountId: dst, destinationAccountId: RECV, sourceAmount: CREATE_AMOUNT }),
        ),
      ]);

      assertNoTransactionErrors(settled);
      const edits = settled.slice(0, N);
      const creates = settled.slice(N);
      // Each edit CAS-writes a DISTINCT seed transfer and bumps its dst_i with
      // a session-scoped version; each create bumps the same dst_i the same
      // way → every pair serializes on dst_i via document conflict + replay.
      // No same-doc CAS loser exists here: all 50 commit deterministically.
      expect(edits.every((s) => s.status === "fulfilled")).toBe(true);
      expect(creates.every((s) => s.status === "fulfilled")).toBe(true);
      // Never mask a fulfilled-but-unwritten result: updateTransfer returns a
      // STRUCTURED warning as a fulfilled promise — assert real writes.
      for (const s of edits) {
        expectCommittedTransfer(s);
      }
      for (const s of creates) {
        expectCommittedTransfer(s);
      }

      // Every destination balance reconciles: seed dest (10_000) edited to
      // 12_000, then a 5_000 create leaves the source → 7_000.
      for (const dst of dstAccounts) {
        expect(await balanceOn(dst)).toBe(EDIT_DEST - CREATE_AMOUNT); // 7_000
      }
      // SRC: opening 300_000 − 25 seed expenses re-cascaded to 12_000 each → 0.
      expect(await balanceOn(SRC)).toBe(0);
      expect(await balanceOn(RECV)).toBe(N * CREATE_AMOUNT); // 125_000
      expect(await TransferModel.countDocuments({ workspaceId: WS, deletedAt: { $exists: false } })).toBe(2 * N);
      // 0 orphans: opening lands on SRC, every leg lands on its own account.
      expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: { $nin: [SRC, RECV, ...dstAccounts] } })).toBe(0);
      // 0 movements referencing unknown transfer parents
      const liveTransferIds = (await TransferModel.find({ workspaceId: WS, deletedAt: { $exists: false } }).lean()).map((t) => String(t._id));
      const orphans = await MovementModel.find({ workspaceId: WS, "link.kind": "transfer", "link.refId": { $nin: liveTransferIds } });
      expect(orphans).toHaveLength(0);
    }, 120_000);
  });
});