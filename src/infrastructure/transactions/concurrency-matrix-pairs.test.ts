import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, NotFoundError, ValidationError, DEBT_MODIFIED_MSG } from "../../core/domain/errors";
import { createMovement } from "../../core/application/movements/create-movement";
import { updateMovement } from "../../core/application/movements/update-movement";
import { createTransfer } from "../../core/application/transfers/create-transfer";
import { updateTransfer } from "../../core/application/transfers/update-transfer";
import { createSale } from "../../core/application/sales/create-sale";
import { createPayable } from "../../core/application/payables/create-payable";
import { addAbono as addPayableAbono } from "../../core/application/payables/add-abono";
import { editAbono as editPayableAbono } from "../../core/application/payables/edit-abono";
import { deletePayable } from "../../core/application/payables/delete-payable";
import { deleteAccount } from "../../core/application/accounts/delete-account";
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
import { OPENING_CATEGORY_ID } from "../../core/domain/synthetic-categories";

/**
 * R15.3.1 §10 — concurrency matrix: cross-aggregate pairs.
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — latest mongod
 * crashes on Windows). Same launch convention as the sibling suites.
 *
 * §10 mandates evidence of SAFETY for the listed pairs, not an artificial test
 * for each: each pair is proven by its protecting mechanism (transactional
 * guard, shared-document conflict point, CAS) OR a dedicated race here. This
 * suite covers the pairs that the existing suites do NOT exercise:
 *
 *   1. createSale × updateMovement      (§10 pair 5) — same-account write-write
 *      serialization: the sale touches SRC inside its tx, the edit touches SRC
 *      too. All 10 concurrent ops must commit (driver retry), ledger coherent,
 *      0 NoSuchTransaction / TransientTransactionError.
 *   2. updateTransfer × deleteAccount   (§10 pair 7) — the transfer IS a
 *      reference: deleteAccount's ACC-4 guard (session-snapshot counts) must
 *      deterministically reject EVERY delete with the exact ConflictError
 *      message, in every interleaving.
 *   3. updateTransfer × updateMovement  (discovered, not a listed pair) —
 *      same-account serialization between the transfer edit (bumpVersion) and
 *      the movement edit (touch), plus the MOV-5 structural shield: a transfer
 *      leg is a linked/system movement and updateMovement must reject it.
 *      NOTE: transfer edits are CAS-guarded (R15.3 §5) — under concurrency
 *      they commit atomically or abort with ConflictError(DEBT_MODIFIED_MSG);
 *      the driver only replays WriteConflict, so a fallen-behind CAS is a
 *      clean business abort, never a partial write.
 *   4. editAbono(payable) × deletePayable (discovered, not a listed pair) —
 *      both write the shared abono-movement doc and the payable doc. Terminal
 *      must be clean either way: when the payable is gone, ZERO linked
 *      movements remain (deleteByRefId cascade); edits re-executing on the
 *      post-delete snapshot abort cleanly (ConflictError/NotFoundError).
 *
 * CODE CHANGE VERDICT: no defect found — the mechanisms hold; this suite is
 * the missing EVIDENCE, not a fix.
 */
describe("R15.3.1 §10 — concurrency matrix cross-aggregate pairs", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const SRC = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const DST = "cccccccccccccccccccccccc";
  const CAT_A = "dddddddddddddddddddddddd";
  const CATALOG_ITEM = "eeeeeeeeeeeeeeeeeeeeeeee";
  const DATE = new Date("2025-06-01");

  const accountInput = (id: string, name: string) => ({
    _id: id,
    workspaceId: WS,
    name,
    currency: "COP" as const,
    isFixed: false,
  });

  /** Seed the source balance via a synthetic opening movement (unique opId). */
  async function seedSourceBalance(amount: number): Promise<void> {
    await MovementModel.create({
      workspaceId: WS,
      accountId: SRC,
      type: "income",
      amount,
      signedAmount: amount,
      date: DATE,
      categoryId: OPENING_CATEGORY_ID,
      link: { kind: "opening", refId: SRC, opId: "op-seed-src-matrix" },
    });
  }

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

  /**
   * Every rejection must be a KNOWN clean business abort. Anything else
   * (NoSuchTransaction, TransientTransactionError, raw WriteConflict, ...)
   * is a real defect and fails the assertion with the original error.
   */
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
        expect((s.reason as Error)?.message ?? String(s.reason)).not.toContain("NoSuchTransaction");
        expect((s.reason as Error)?.message ?? String(s.reason)).not.toContain("TransientTransactionError");
        expect((s.reason as Error)?.message ?? String(s.reason)).not.toContain("WriteConflict");
      }
    }
  }

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_matrix_pairs"));
    await AccountModel.create([
      accountInput(SRC, "Source"),
      accountInput(DST, "Destination"),
    ]);
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await PayableModel.deleteMany({});
    await SaleModel.deleteMany({});
    await TransferModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await CategoryModel.deleteMany({});
    await MovementModel.deleteMany({});
    // Accounts are recreated so the source account `__v` starts at 0 (a
    // previous test's bump must not leak into this one).
    await AccountModel.deleteMany({});
    await AccountModel.create([
      accountInput(SRC, "Source"),
      accountInput(DST, "Destination"),
    ]);
    await CategoryModel.create({
      _id: CAT_A,
      workspaceId: WS,
      name: "Manual income",
      type: "income",
    });
    await CatalogItemModel.create({
      _id: CATALOG_ITEM,
      workspaceId: WS,
      name: "Widget",
      unitPrice: 20_000,
      currency: "COP",
      type: "product",
      stock: 100,
    });
  });

  /** Seed N manual movements on SRC (income, real category). */
  async function seedManualMovements(count: number, baseAmount: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const m = await createMovement(
        WS,
        {
          accountId: SRC,
          type: "income",
          amount: baseAmount,
          currency: "COP",
          date: DATE,
          categoryId: CAT_A,
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

  // ---------------------------------------------------------------------------
  // 1. §10 pair 5 — createSale × updateMovement (same-account serialization)
  // ---------------------------------------------------------------------------
  it("§10 pair 5 — N createSale × N updateMovement on the SAME account: all commit, ledger coherent, 0 NoSuchTransaction", async () => {
    const N = 5;
    const SALE_AMOUNT = 20_000;
    const BASE = 10_000;

    const movementIds = await seedManualMovements(N, BASE);

    const settled = await Promise.allSettled([
      // 5 movement edits (amount change → touch SRC inside the edit tx)
      ...movementIds.map((id, i) =>
        updateMovement(
          WS,
          { movementId: id, amount: BASE + i * 1_000 },
          new MongoMovementRepository(),
          new MongoCategoryRepository(),
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ),
      // 5 paid-in-full sales on the same account (touches SRC inside the tx)
      ...Array.from({ length: N }, () =>
        createSale(
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
        ),
      ),
    ]);

    // Both flows serialize on the SRC account doc (touch vs touch): the
    // driver's withTransaction retry makes EVERY op commit — no warnings, no
    // rejections (unlike the transfer-funds pair, there is nothing to reject).
    assertCleanAborts(settled);
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    expect(fulfilled).toHaveLength(2 * N);

    // Ledger on SRC: edited incomes + sale incomes.
    const editedSum = movementIds.reduce((sum, _, i) => sum + BASE + i * 1_000, 0);
    expect(await balanceOn(SRC)).toBe(editedSum + N * SALE_AMOUNT);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2 * N);

    const stock = (await CatalogItemModel.findById(CATALOG_ITEM).lean()) as unknown as {
      stock: number;
    } | null;
    expect(stock!.stock).toBe(100 - N);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // 2. §10 pair 7 — updateTransfer × deleteAccount (guard wins deterministically)
  // ---------------------------------------------------------------------------
  it("§10 pair 7 — N updateTransfer × N deleteAccount: EVERY delete rejected by the ACC-4 reference guard, legs coherent", async () => {
    const N = 5;
    const INITIAL = 100_000;
    const TRANSFER_AMOUNT = 40_000;

    await seedSourceBalance(INITIAL);
    const transfer = (
      await createTransfer(
        WS,
        {
          sourceAccountId: SRC,
          destinationAccountId: DST,
          sourceAmount: TRANSFER_AMOUNT,
          sourceCurrency: "COP",
          date: DATE,
          note: "Seed transfer",
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
      )
    ).transfer!;

    const settled = await Promise.allSettled([
      // 5 transfer edits — the transfer doc is the CAS conflict point
      ...Array.from({ length: N }, (_, i) =>
        updateTransfer(
          WS,
          transfer.id,
          { sourceAmount: 20_000 + i * 2_000, destinationAmount: 20_000 + i * 2_000 },
          new MongoTransferRepository(),
          new MongoMovementRepository(),
          new MongoAccountRepository(),
          new MongoCreditReceivedRepository(),
          new MongoCreditGrantedRepository(),
          new MongoSaleRepository(),
          new MongoPayableRepository(),
          new MongoUnitOfWork(),
        ),
      ),
      // 5 account deletes — all must lose to ACC-4
      ...Array.from({ length: N }, () =>
        deleteAccount(
          WS,
          SRC,
          new MongoAccountRepository(),
          new MongoMovementRepository(),
          new MongoUnitOfWork(),
        ),
      ),
    ]);

    assertCleanAborts(settled);

    // Deterministic by construction: the transfer IS a reference
    // (countReferences joins the delete tx session) and no edit can remove it
    // (TRA-5: accountIds are immutable). In EVERY interleaving the delete's
    // guard read sees the transfer → ConflictError. Not even a NotFoundError
    // is possible: the account is never deleted.
    const deletes = settled.slice(N);
    const fulfilledDeletes = deletes.filter((s) => s.status === "fulfilled");
    expect(fulfilledDeletes, "ACC-4 guard must reject every delete attempt").toHaveLength(0);
    for (const s of deletes as PromiseRejectedResult[]) {
      expect(s.status).toBe("rejected");
      expect(s.reason).toBeInstanceOf(ConflictError);
      expect((s.reason as ConflictError).message).toBe("Account has references and cannot be deleted");
    }

    // The account survived and the transfer + legs stayed coherent.
    expect(await AccountModel.countDocuments({ _id: SRC })).toBe(1);
    const t = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
      sourceAmount: number;
      movementIds?: { expenseId?: string; incomeId?: string };
    };
    const expense = (await MovementModel.findById(t.movementIds!.expenseId).lean()) as unknown as {
      amount: number;
    };
    expect(expense.amount).toBe(t.sourceAmount);

    // The edits are CAS-guarded (transfer `__v` + source-account bumpVersion,
    // R15.3 §5): under concurrency they commit atomically or abort with
    // ConflictError(DEBT_MODIFIED_MSG) — NEVER a partial write. How many
    // commit is schedule-dependent (0..N); what matters is that rejection is
    // only ever the clean CAS abort and coherence below always holds.
    const edits = settled.slice(0, N);
    for (const s of edits) {
      if (s.status === "rejected") {
        expect(s.reason).toBeInstanceOf(ConflictError);
        expect((s.reason as ConflictError).message).toBe(DEBT_MODIFIED_MSG);
      }
    }

    // Ledger on SRC stays coherent with the FINAL transfer state: the expense
    // leg is the only balance-affecting movement and mirrors sourceAmount.
    expect(await balanceOn(SRC)).toBe(INITIAL - t.sourceAmount);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // 3. discovered — updateTransfer × updateMovement (serialization + MOV-5)
  // ---------------------------------------------------------------------------
  it("updateTransfer × updateMovement: same-account serialization keeps legs and ledger coherent; MOV-5 shields leg edits", async () => {
    const N = 5;
    const INITIAL = 100_000;
    const TRANSFER_AMOUNT = 30_000;
    const BASE = 5_000;

    await seedSourceBalance(INITIAL);
    const transfer = (
      await createTransfer(
        WS,
        {
          sourceAccountId: SRC,
          destinationAccountId: DST,
          sourceAmount: TRANSFER_AMOUNT,
          sourceCurrency: "COP",
          date: DATE,
          note: "Seed transfer",
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
      )
    ).transfer!;
    const movementIds = await seedManualMovements(N, BASE);

    const settled = await Promise.allSettled([
      // 5 transfer edits (balance-affecting → bumpVersion on SRC)
      ...Array.from({ length: N }, (_, i) =>
        updateTransfer(
          WS,
          transfer.id,
          { sourceAmount: 20_000 + i * 1_000, destinationAmount: 20_000 + i * 1_000 },
          new MongoTransferRepository(),
          new MongoMovementRepository(),
          new MongoAccountRepository(),
          new MongoCreditReceivedRepository(),
          new MongoCreditGrantedRepository(),
          new MongoSaleRepository(),
          new MongoPayableRepository(),
          new MongoUnitOfWork(),
        ),
      ),
      // 5 movement edits (amount change → touch SRC)
      ...movementIds.map((id, i) =>
        updateMovement(
          WS,
          { movementId: id, amount: BASE + i * 500 },
          new MongoMovementRepository(),
          new MongoCategoryRepository(),
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ),
    ]);

    // Movement edits ALWAYS commit (touch is a non-CAS write — write-write
    // conflicts replay via the driver). Transfer edits are CAS-guarded
    // (transfer `__v` + source-account bump): an edit that falls behind
    // commits atomically or rejects with ConflictError(DEBT_MODIFIED_MSG) —
    // the schedule decides the split, coherence below always holds.
    assertCleanAborts(settled);
    const fulfilled = settled.filter((s) => s.status === "fulfilled");
    expect(fulfilled.length).toBeGreaterThanOrEqual(N);
    for (const s of settled.slice(0, N)) {
      if (s.status === "rejected") {
        expect(s.reason).toBeInstanceOf(ConflictError);
        expect((s.reason as ConflictError).message).toBe(DEBT_MODIFIED_MSG);
      }
    }

    // Transfer legs still mirror the transfer (the edit cascade is atomic).
    const t = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
      sourceAmount: number;
      movementIds?: { expenseId?: string; incomeId?: string };
    };
    const expense = (await MovementModel.findById(t.movementIds!.expenseId).lean()) as unknown as {
      amount: number;
    };
    expect(expense.amount).toBe(t.sourceAmount);

    // Ledger on SRC: opening − final transfer + Σ edited incomes.
    const editedSum = movementIds.reduce((sum, _, i) => sum + BASE + i * 500, 0);
    expect(await balanceOn(SRC)).toBe(INITIAL - t.sourceAmount + editedSum);
    expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1 + 2 + N);

    // MOV-5: a transfer leg is a linked/system movement — direct edits are
    // structurally forbidden, so the legs can never diverge via updateMovement.
    await expect(
      updateMovement(
        WS,
        { movementId: t.movementIds!.expenseId!, amount: 1 },
        new MongoMovementRepository(),
        new MongoCategoryRepository(),
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      ),
    ).rejects.toThrow(ValidationError);
  }, 120_000);

  // ---------------------------------------------------------------------------
  // 4. discovered — editAbono(payable) × deletePayable (shared abono movement)
  // ---------------------------------------------------------------------------
  it("editAbono(payable) × deletePayable: terminal always clean — payable gone ⇒ 0 linked movements; every abort is NotFound/Conflict", async () => {
    const EDIT_COUNT = 5;
    const TOTAL = 100_000;
    const INITIAL_PAYMENT = 20_000;
    const ABONO_SEED = 20_000;

    const payable = await createPayable(
      WS,
      {
        counterparty: "Proveedor",
        total: TOTAL,
        currency: "COP",
        initialPayment: INITIAL_PAYMENT,
        accountId: SRC,
        date: DATE,
      },
      new MongoPayableRepository(),
      new MongoMovementRepository(),
      objectIdGenerator,
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
    const seeded = await addPayableAbono(
      WS,
      payable.id,
      { amount: ABONO_SEED, currency: "COP", accountId: SRC, date: DATE },
      new MongoPayableRepository(),
      new MongoMovementRepository(),
      objectIdGenerator,
      new MongoAccountRepository(),
      new MongoUnitOfWork(),
    );
    const abonoId = seeded.abonos[seeded.abonos.length - 1].id;

    // Interleave: even slots edit the abono, odd slots delete the payable.
    const ops: Array<() => Promise<unknown>> = [];
    for (let i = 0; i < 2 * EDIT_COUNT; i++) {
      if (i % 2 === 0) {
        const amount = 10_000 + (i / 2) * 1_000;
        ops.push(() =>
          editPayableAbono(
            WS,
            payable.id,
            abonoId,
            { amount },
            new MongoPayableRepository(),
            new MongoMovementRepository(),
            new MongoAccountRepository(),
            new MongoUnitOfWork(),
          ),
        );
      } else {
        ops.push(() =>
          deletePayable(
            WS,
            payable.id,
            new MongoPayableRepository(),
            new MongoMovementRepository(),
            new MongoAccountRepository(),
            new MongoUnitOfWork(),
          ),
        );
      }
    }

    const settled = await Promise.allSettled(ops.map((fn) => fn()));

    // Every rejection must be a clean business abort; transaction-level errors
    // (NoSuchTransaction, TransientTransactionError) are defects.
    assertCleanAborts(settled);

    const edits = settled.filter((_, i) => i % 2 === 0);
    const deletes = settled.filter((_, i) => i % 2 === 1);

    // The delete side re-executes until it commits (withTransaction retry), and
    // once the payable doc is gone NO edit can commit: its re-execution reads
    // the post-delete snapshot → NotFoundError, or its non-CAS movement update
    // + CAS abono update match nothing → ConflictError. Editing can never
    // resurrect the aggregate. Terminal is DETERMINISTIC: payable deleted.
    const fulfilledDeletes = deletes.filter((s) => s.status === "fulfilled");
    expect(fulfilledDeletes.length).toBeGreaterThanOrEqual(1);

    const payableGone = (await PayableModel.countDocuments({ workspaceId: WS })) === 0;
    expect(payableGone, "5 retrying deletes must eventually delete the payable").toBe(true);

    // Cascade: zero movements linked to the payable (initial + abono + any
    // committed edit's movement all have link.refId === payableId).
    const linked = await MovementModel.countDocuments({
      workspaceId: WS,
      "link.refId": payable.id,
    });
    expect(linked).toBe(0);

    // Deletes after the committed one abort cleanly with NotFoundError.
    for (const s of deletes) {
      if (s.status === "rejected") {
        expect(s.reason).toBeInstanceOf(NotFoundError);
        expect((s.reason as NotFoundError).message).toBe("Payable not found");
      }
    }
    // Edits that ran AFTER the winning delete must not have written anything
    // (they aborted via NotFound on the fresh snapshot). Edits that committed
    // BEFORE the delete are implied by the 0-linked-movements assertion.
    for (const s of edits) {
      if (s.status === "rejected") {
        expect(
          s.reason instanceof NotFoundError || s.reason instanceof ConflictError,
          `unexpected edit rejection: ${(s.reason as Error)?.message ?? String(s.reason)}`,
        ).toBe(true);
      }
    }
  }, 120_000);
});