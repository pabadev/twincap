import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createTransfer } from "../../core/application/transfers/create-transfer";
import { updateTransfer } from "../../core/application/transfers/update-transfer";
import { deleteTransfer } from "../../core/application/transfers/delete-transfer";
import { editPrincipal as editPrincipalReceived } from "../../core/application/credits-received/edit-principal";
import { editPrincipal as editPrincipalGranted } from "../../core/application/credits-granted/edit-principal";
import { createCreditReceived } from "../../core/application/credits-received/create-credit-received";
import { createCreditGranted } from "../../core/application/credits-granted/create-credit-granted";
import { MongoTransferRepository } from "../repositories/transfer-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoPayableRepository } from "../repositories/payable-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { TransferModel } from "../models/transfer";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { MovementModel } from "../models/movement";
import { OPENING_CATEGORY_ID } from "../../core/domain/synthetic-categories";

/**
 * R15 Fase 5 — transfer concurrency (CAS on the source account `__v`) and the
 * transactional update/delete/edit-principal cascades.
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * Fase 2/4 suites: latest mongod crashes on Windows).
 *
 * What this suite proves:
 *   1. CONCURRENCY: N parallel createTransfer from the SAME source account
 *      converge to EXACTLY one winner; every loser (R15.1 Fase 5) returns the
 *      structured insufficient-funds WARNING after the driver's WriteConflict
 *      retry re-validates on the fresh snapshot — no throw, no writes. The odd
 *      seed (X=100_001, amount=ceil(X/2)=50_001) guarantees `2×amount > X`:
 *      no two transfers of `amount` can ever both be funded, so funding a
 *      second one is impossible by construction.
 *   1b. CONFIRMED negative balance: N=10 concurrent transfers with
 *      `confirmNegativeBalance: true` ALL register (CAS serializes them) and
 *      the source ends negative — declared financial reality is recorded.
 *   2. ROLLBACK createTransfer: a failing 2nd movement write leaves NO trace
 *      (criterion §7: transfer + movements commit or roll back together).
 *   3. ROLLBACK updateTransfer: the 3rd write (income-movement update) failing
 *      leaves the transfer AND both movements unchanged.
 *   4. deleteTransfer: tolerant when a movement is already gone; a failure on
 *      the 2nd movement delete rolls back the 1st deletion and the transfer.
 *   5. editPrincipal (received + granted): a failing movement cascade leaves
 *      the credit intact and `__v` unmoved (no partial CAS).
 */
describe("R15 Fase 5 — transfer concurrency and transactional cascades", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const SRC = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const DST = "cccccccccccccccccccccccc";

  /**
   * Build a createTransfer input. `confirmNegativeBalance` (R15.1 Fase 5)
   * enables the negative-balance policy: without it a deficit returns a
   * structured warning instead of throwing.
   */
  const transferInput = (sourceAmount: number, confirmNegativeBalance = false) => ({
    sourceAccountId: SRC,
    destinationAccountId: DST,
    sourceAmount,
    sourceCurrency: "COP" as const,
    date: new Date("2025-06-01"),
    note: "Test transfer",
    ...(confirmNegativeBalance ? { confirmNegativeBalance: true } : {}),
  });

  const creditReceivedInput = {
    counterparty: "Banco XYZ",
    principal: 100_000,
    currency: "COP" as const,
    accountId: SRC,
    date: new Date("2025-06-01"),
  };

  const creditGrantedInput = {
    counterparty: "Cliente",
    principal: 100_000,
    currency: "COP" as const,
    accountId: SRC,
    date: new Date("2025-06-01"),
  };

  /** Seed the source balance via a synthetic opening movement (unique opId). */
  async function seedSourceBalance(amount: number): Promise<void> {
    await MovementModel.create({
      workspaceId: WS,
      accountId: SRC,
      type: "income",
      amount,
      signedAmount: amount,
      date: new Date("2025-06-01"),
      categoryId: OPENING_CATEGORY_ID,
      link: { kind: "opening", refId: SRC, opId: "op-seed-src-1" },
    });
  }

  async function sourceBalance(): Promise<number> {
    const rows = await MovementModel.aggregate([
      {
        $match: {
          workspaceId: new mongoose.Types.ObjectId(WS),
          accountId: new mongoose.Types.ObjectId(SRC),
        },
      },
      { $group: { _id: null, total: { $sum: "$signedAmount" } } },
    ]);
    return rows.length > 0 ? rows[0].total : 0;
  }

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_transfers"));
    await AccountModel.create([
      { _id: SRC, workspaceId: WS, name: "Source", currency: "COP", isFixed: false },
      { _id: DST, workspaceId: WS, name: "Destination", currency: "COP", isFixed: false },
    ]);
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await TransferModel.deleteMany({});
    await CreditReceivedModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await MovementModel.deleteMany({});
    // Accounts are recreated so the source account `__v` starts at 0 for the
    // concurrency test (a previous test's CAS bump must not leak into it).
    await AccountModel.deleteMany({});
    await AccountModel.create([
      { _id: SRC, workspaceId: WS, name: "Source", currency: "COP", isFixed: false },
      { _id: DST, workspaceId: WS, name: "Destination", currency: "COP", isFixed: false },
    ]);
  });

  describe("concurrencia real — N transfers del MISMO origen", () => {
    // X IMPAR de propósito: con X=100_001 y amount=ceil(X/2)=50_001 se cumple
    // 2×amount > X, por lo que a lo sumo UN transfer de amount puede ser
    // financiado jamás (un segundo ganador necesitaría saldo ≥ amount tras el
    // primero, imposible). Con X par (p.ej. 100_000) exactamente DOS transfers
    // de 50_000 podrían ganar serializados — el test exige EXACTAMENTE uno.
    const INITIAL = 100_001;
    const AMOUNT = Math.ceil(INITIAL / 2); // 50_001 > INITIAL/2

    it.each([10, 50, 100])(
      "N=%i → exactamente 1 gana; el resto devuelve warning de fondos (sin escrituras); __v origen == 1",
      async (n) => {
        await seedSourceBalance(INITIAL);

        const settled = await Promise.allSettled(
          Array.from({ length: n }, () =>
            createTransfer(
              WS,
              transferInput(AMOUNT),
              new MongoTransferRepository(),
              new MongoMovementRepository(),
              objectIdGenerator,
              new MongoAccountRepository(),
              new MongoCreditReceivedRepository(),
              new MongoCreditGrantedRepository(),
              new MongoSaleRepository(),
              new MongoPayableRepository(),
              new MongoUnitOfWork(),
            ),
          ),
        );

        // F5: NINGÚN intento falla. Los perdedores no lanzan ConflictError:
        // tras el retry del driver (WriteConflict) re-leen el snapshot fresco
        // y devuelven el warning estructurado sin escribir nada.
        const rejected = settled.filter((s) => s.status === "rejected");
        expect(rejected).toHaveLength(0);
        for (const r of rejected) {
          const msg = r.reason?.message ?? String(r.reason);
          expect(msg).not.toContain("NoSuchTransaction");
          expect(msg).not.toContain("TransientTransactionError");
        }
        const winners = settled.filter(
          (s) => s.status === "fulfilled" && s.value.transfer !== null,
        );
        const warned = settled.filter(
          (s) => s.status === "fulfilled" && s.value.warning !== null,
        );
        expect(winners).toHaveLength(1);
        expect(warned).toHaveLength(n - 1);
        for (const w of warned) {
          if (w.status === "fulfilled") {
            // Todos los perdedores ven el mismo estado final del ganador.
            expect(w.value.warning?.type).toBe("insufficient_funds");
            expect(w.value.warning?.currentBalance).toBe(INITIAL - AMOUNT);
            expect(w.value.warning?.projectedBalance).toBe(INITIAL - 2 * AMOUNT); // −1
            expect(w.value.warning?.currency).toBe("COP");
          }
        }

        // La cuenta origen fue CAS-bumpeada 0→1 por el ganador.
        const srcDoc = await AccountModel.findById(SRC);
        expect(srcDoc!.__v).toBe(1);

        // Saldo real derivado: INITIAL − AMOUNT == floor(INITIAL/2) ≥ 0.
        expect(await sourceBalance()).toBe(INITIAL - AMOUNT);

        // Solo un transfer y sus 2 movements existen (más el opening de seed).
        expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(1);
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(3); // opening + expense + income

        // El destino recibió exactamente el monto del ganador.
        const destRows = await MovementModel.aggregate([
          {
            $match: {
              workspaceId: new mongoose.Types.ObjectId(WS),
              accountId: new mongoose.Types.ObjectId(DST),
            },
          },
          { $group: { _id: null, total: { $sum: "$signedAmount" } } },
        ]);
        expect(destRows.length > 0 ? destRows[0].total : 0).toBe(AMOUNT);
      },
      120_000,
    );

    it(
      "N=10 concurrentes con confirmNegativeBalance=true → TODOS se registran, saldo final negativo, 0 NoSuchTransaction (F5)",
      async () => {
        await seedSourceBalance(100_000);

        const settled = await Promise.allSettled(
          Array.from({ length: 10 }, () =>
            createTransfer(
              WS,
              transferInput(70_000, true),
              new MongoTransferRepository(),
              new MongoMovementRepository(),
              objectIdGenerator,
              new MongoAccountRepository(),
              new MongoCreditReceivedRepository(),
              new MongoCreditGrantedRepository(),
              new MongoSaleRepository(),
              new MongoPayableRepository(),
              new MongoUnitOfWork(),
            ),
          ),
        );

        // Cada intento registra: el CAS serializa y el driver reintenta desde
        // snapshots frescos hasta que los 10 commits encadenan.
        expect(settled.every((s) => s.status === "fulfilled")).toBe(true);
        for (const s of settled) {
          if (s.status === "rejected") {
            const msg = s.reason?.message ?? String(s.reason);
            expect(msg).not.toContain("NoSuchTransaction");
            expect(msg).not.toContain("TransientTransactionError");
          }
        }
        const transfers = settled.filter(
          (s) => s.status === "fulfilled" && s.value.transfer !== null,
        );
        expect(transfers).toHaveLength(10);

        // Saldo final: 100_000 − 10 × 70_000 == −600_000 (negativo → registrado).
        expect(await sourceBalance()).toBe(-600_000);

        // 10 transfers × 2 legs + el opening de seed.
        expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(10);
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(21);

        // El destino recibió 10 × 70_000 == 700_000.
        const destRows = await MovementModel.aggregate([
          {
            $match: {
              workspaceId: new mongoose.Types.ObjectId(WS),
              accountId: new mongoose.Types.ObjectId(DST),
            },
          },
          { $group: { _id: null, total: { $sum: "$signedAmount" } } },
        ]);
        expect(destRows.length > 0 ? destRows[0].total : 0).toBe(700_000);
      },
      120_000,
    );
  });

  describe("concurrencia updateTransfer — sin NoSuchTransaction (R15.1 §5)", () => {
    it("N=10 updates concurrentes sobre el MISMO transfer → 0 NoSuchTransaction, estado coherente", async () => {
      await seedSourceBalance(100_000);
      const created = (
        await createTransfer(
          WS,
          transferInput(70_000),
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

      const settled = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          updateTransfer(
            WS,
            created.id,
            { sourceAmount: 30_000 + i, destinationAmount: 30_000 + i },
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
      );

      for (const s of settled) {
        if (s.status === "rejected") {
          expect(s.reason?.message ?? String(s.reason)).not.toContain("NoSuchTransaction");
          expect(s.reason?.message ?? String(s.reason)).not.toContain("TransientTransactionError");
        }
      }
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      // Todos los updates pueden completar serializados (last-write-wins sin CAS)
      // — lo que NO puede ocurrir es NoSuchTransaction / TransientTransactionError.
      expect(fulfilled.length).toBeGreaterThan(0);

      // El transfer existe con un estado coherente (uno de los updates ganó).
      const transferDoc = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
        sourceAmount: number;
        destinationAmount: number;
        movementIds?: { expenseId?: string; incomeId?: string };
      };
      expect(transferDoc.sourceAmount).toBeGreaterThanOrEqual(30_000);
      const expense = (await MovementModel.findById(transferDoc.movementIds!.expenseId).lean()) as unknown as {
        amount: number;
      };
      const income = (await MovementModel.findById(transferDoc.movementIds!.incomeId).lean()) as unknown as {
        amount: number;
      };
      expect(expense!.amount).toBe(transferDoc.sourceAmount);
      expect(income!.amount).toBe(transferDoc.destinationAmount);
    }, 120_000);

    it("N=50 updates concurrentes → 0 NoSuchTransaction", async () => {
      await seedSourceBalance(100_000);
      const created = (
        await createTransfer(
          WS,
          transferInput(70_000),
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

      const settled = await Promise.allSettled(
        Array.from({ length: 50 }, (_, i) =>
          updateTransfer(
            WS,
            created.id,
            { sourceAmount: 20_000 + (i % 10), destinationAmount: 20_000 + (i % 10) },
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
      );

      for (const s of settled) {
        if (s.status === "rejected") {
          const msg = s.reason?.message ?? String(s.reason);
          expect(msg).not.toContain("NoSuchTransaction");
          expect(msg).not.toContain("TransientTransactionError");
        }
      }

      const transferDoc = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
        sourceAmount: number;
        movementIds?: { expenseId?: string; incomeId?: string };
      };
      expect(transferDoc.sourceAmount).toBeGreaterThanOrEqual(20_000);
      const expense = (await MovementModel.findById(transferDoc.movementIds!.expenseId).lean()) as unknown as {
        amount: number;
      };
      expect(expense!.amount).toBe(transferDoc.sourceAmount);
    }, 120_000);
  });

  describe("rollback createTransfer — un write fallido no deja rastro (criterio §7)", () => {
    it("falla el 2º movement (income) → sin transfer, sin movements, saldo intacto", async () => {
      await seedSourceBalance(100_000);

      const movementRepo = new MongoMovementRepository();
      const realCreate = movementRepo.create.bind(movementRepo);
      // 1st create (expense) runs real; 2nd (income) throws inside the tx.
      vi.spyOn(movementRepo, "create")
        .mockImplementationOnce(async (m, tx) => realCreate(m, tx))
        .mockImplementationOnce(async () => {
          throw new Error("boom: income movement write fails");
        });

      await expect(
        createTransfer(
          WS,
          transferInput(50_000),
          new MongoTransferRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoCreditReceivedRepository(),
          new MongoCreditGrantedRepository(),
          new MongoSaleRepository(),
          new MongoPayableRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: income movement write fails");

      expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(0);
      // El expense de la tx abortada también se revirtió.
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1); // solo opening
      expect(await sourceBalance()).toBe(100_000);
    }, 60_000);
  });

  describe("rollback updateTransfer — el 3er write fallido deja transfer + movements intactos", () => {
    it("transfer y ambos movements conservan montos previos", async () => {
      await seedSourceBalance(100_000);
      await createTransfer(
        WS,
        transferInput(70_000),
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

      const transferDoc = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
        _id: mongoose.Types.ObjectId;
        movementIds?: { expenseId?: string; incomeId?: string };
        sourceAmount: number;
        date: Date;
      };
      const expenseBefore = (await MovementModel.findById(transferDoc.movementIds!.expenseId).lean()) as unknown as {
        amount: number;
        signedAmount: number;
      };
      const incomeBefore = (await MovementModel.findById(transferDoc.movementIds!.incomeId).lean()) as unknown as {
        amount: number;
        signedAmount: number;
      };

      const movementRepo = new MongoMovementRepository();
      const realUpdate = movementRepo.update.bind(movementRepo);
      // 1st update (transfer, repo aparte ok), 2nd (expense) real, 3rd (income) fails.
      vi.spyOn(movementRepo, "update")
        .mockImplementationOnce(async (m, tx) => realUpdate(m, tx))
        .mockImplementationOnce(async () => {
          throw new Error("boom: income movement update fails");
        });

      await expect(
        updateTransfer(
          WS,
          transferDoc._id.toString(),
          { sourceAmount: 30_000, destinationAmount: 30_000 },
          new MongoTransferRepository(),
          movementRepo,
          new MongoAccountRepository(),
          new MongoCreditReceivedRepository(),
          new MongoCreditGrantedRepository(),
          new MongoSaleRepository(),
          new MongoPayableRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: income movement update fails");

      // Criterio §7: transfer + movements quedaron 100% como estaban.
      const transferAfter = (await TransferModel.findById(transferDoc._id).lean()) as unknown as {
        sourceAmount: number;
        date: Date;
      };
      const expenseAfter = (await MovementModel.findById(transferDoc.movementIds!.expenseId).lean()) as unknown as {
        amount: number;
        signedAmount: number;
      };
      const incomeAfter = (await MovementModel.findById(transferDoc.movementIds!.incomeId).lean()) as unknown as {
        amount: number;
        signedAmount: number;
      };
      expect(transferAfter.sourceAmount).toBe(transferDoc.sourceAmount);
      expect(transferAfter.date.toISOString()).toBe(transferDoc.date.toISOString());
      expect(expenseAfter.amount).toBe(expenseBefore.amount);
      expect(expenseAfter.signedAmount).toBe(expenseBefore.signedAmount);
      expect(incomeAfter.amount).toBe(incomeBefore.amount);
      expect(incomeAfter.signedAmount).toBe(incomeBefore.signedAmount);
      expect(await sourceBalance()).toBe(100_000 - 70_000); // el transfer SÍ siguió vigente
    }, 60_000);
  });

  describe("deleteTransfer — tolerancia y rollback", () => {
    it("tolera un movement ya eliminado y completa la limpieza", async () => {
      await seedSourceBalance(100_000);
      await createTransfer(
        WS,
        transferInput(40_000),
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
      const transferDoc = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
        _id: mongoose.Types.ObjectId;
        movementIds?: { expenseId?: string; incomeId?: string };
      };

      // Alguien ya borró el expense fuera del flujo (estado corrupto heredado).
      await MovementModel.findByIdAndDelete(transferDoc.movementIds!.expenseId);

      await expect(
        deleteTransfer(
          WS,
          transferDoc._id.toString(),
          new MongoTransferRepository(),
          new MongoMovementRepository(),
          new MongoUnitOfWork(),
        ),
      ).resolves.toBeUndefined();

      expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1); // solo opening
    }, 60_000);

    it("falla el 2º delete (income) → rollback: transfer y ambos movements siguen existiendo", async () => {
      await seedSourceBalance(100_000);
      await createTransfer(
        WS,
        transferInput(40_000),
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
      const transferDoc = (await TransferModel.findOne({ workspaceId: WS }).lean()) as unknown as {
        _id: mongoose.Types.ObjectId;
        movementIds?: { expenseId?: string; incomeId?: string };
      };

      const movementRepo = new MongoMovementRepository();
      const realDelete = movementRepo.delete.bind(movementRepo);
      // 1st delete (expense) real; 2nd (income) throws inside the tx.
      vi.spyOn(movementRepo, "delete")
        .mockImplementationOnce(async (ws, id, tx) => realDelete(ws, id, tx))
        .mockImplementationOnce(async () => {
          throw new Error("boom: income movement delete fails");
        });

      await expect(
        deleteTransfer(
          WS,
          transferDoc._id.toString(),
          new MongoTransferRepository(),
          movementRepo,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: income movement delete fails");

      // La tx abortó: el expense borrado en el intento se restauró.
      expect(await TransferModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(3); // opening + expense + income
      expect(await sourceBalance()).toBe(60_000);
    }, 60_000);
  });

  describe("rollback editPrincipal — cascada fallida deja el crédito intacto y __v sin mover", () => {
    it("creditReceived: falla el update del movement principal", async () => {
      await seedSourceBalance(50_000);
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(credit.version).toBe(0);

      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "update").mockImplementationOnce(async () => {
        throw new Error("boom: principal movement update fails");
      });

      await expect(
        editPrincipalReceived(
          WS,
          credit.id,
          { principal: 200_000, currency: "COP" },
          new MongoCreditReceivedRepository(),
          movementRepo,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: principal movement update fails");

      const doc = await CreditReceivedModel.findById(credit.id);
      expect(doc!.principal).toBe(100_000); // intacto
      expect(doc!.__v).toBe(0); // CAS sin mover
      const movements = await MovementModel.find({ workspaceId: WS, "link.refId": credit.id });
      expect(movements).toHaveLength(1);
      expect(movements[0].amount).toBe(100_000); // movement intacto
    }, 60_000);

    it("creditGranted: falla el update del movement principal", async () => {
      await seedSourceBalance(50_000);
      const credit = await createCreditGranted(
        WS,
        creditGrantedInput,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(credit.version).toBe(0);

      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "update").mockImplementationOnce(async () => {
        throw new Error("boom: principal movement update fails");
      });

      await expect(
        editPrincipalGranted(
          WS,
          credit.id,
          { principal: 200_000, currency: "COP" },
          new MongoCreditGrantedRepository(),
          movementRepo,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: principal movement update fails");

      const doc = await CreditGrantedModel.findById(credit.id);
      expect(doc!.principal).toBe(100_000); // intacto
      expect(doc!.__v).toBe(0); // CAS sin mover
      const movements = await MovementModel.find({ workspaceId: WS, "link.refId": credit.id });
      expect(movements).toHaveLength(1);
      expect(movements[0].amount).toBe(100_000); // movement intacto
    }, 60_000);
  });
});