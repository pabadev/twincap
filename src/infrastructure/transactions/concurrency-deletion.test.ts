import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, NotFoundError } from "../../core/domain/errors";
import { createPayable } from "../../core/application/payables/create-payable";
import { addAbono as addPayableAbono } from "../../core/application/payables/add-abono";
import { deletePayable } from "../../core/application/payables/delete-payable";
import { createCreditReceived } from "../../core/application/credits-received/create-credit-received";
import { addAbono as addCreditReceivedAbono } from "../../core/application/credits-received/add-abono";
import { deleteCreditReceived } from "../../core/application/credits-received/delete-credit-received";
import { createCreditGranted } from "../../core/application/credits-granted/create-credit-granted";
import { addAbono as addCreditGrantedAbono } from "../../core/application/credits-granted/add-abono";
import { deleteCreditGranted } from "../../core/application/credits-granted/delete-credit-granted";
import { splitAbonoCapitalInterest } from "../../core/application/credits-granted/split-abono";
import { deleteAccount } from "../../core/application/accounts/delete-account";
import { createMovement } from "../../core/application/movements/create-movement";
import { deleteSale } from "../../core/application/sales/delete-sale";
import { addSaleAbono } from "../../core/application/sales/add-sale-abono";
import { createSale } from "../../core/application/sales/create-sale";
import { MongoPayableRepository } from "../repositories/payable-repository";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { MongoClientRepository } from "../repositories/client-repository";
import { MongoCategoryRepository } from "../repositories/category-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { PayableModel } from "../models/payable";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { MovementModel } from "../models/movement";
import { SaleModel } from "../models/sale";
import { CatalogItemModel } from "../models/catalog";
import { CategoryModel } from "../models/category";

/**
 * R15.1 Fase 3 — transactional delete concurrency for payables,
 * credits-received and credits-granted.
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * Fase 2/4/5 suites: latest mongod crashes on Windows).
 *
 * What this suite proves (delete-sale pattern moved to payables/credits):
 *   1. ATOMICITY + single-winner: N=5 concurrent deletes of the SAME aggregate
 *      converge to EXACTLY ONE fulfilled; the other 4 abort with NotFoundError
 *      after their transaction re-executes on a post-commit snapshot (the
 *      aggregate read happens INSIDE the tx and the aggregate delete is the
 *      final write). ZERO NoSuchTransaction / TransientTransactionError leak.
 *   2. NO ORPHAN MOVEMENTS: after the winner commits, no movement remains with
 *      link.refId === deleted aggregate id (the deleteByRefId cascade ran in
 *      the same transaction as the aggregate delete).
 *   3. SEQUENTIAL IDEMPOTENCY: deleting an already-deleted payable rejects
 *      with NotFoundError and leaves zero partial state — the transaction
 *      abort restores the pre-delete state.
 *   4. DELETE × CREATE RACES (matriz R15.1 "Eliminaciones"): deletePayable /
 *      deleteCreditReceived / deleteCreditGranted / deleteSale racing N addAbono
 *      writers, plus deleteAccount racing createMovement. Terminal states are
 *      clean: aggregate gone → 0 linked movements; aggregate alive → every
 *      committed create added exactly its movements. Zero NoSuchTransaction /
 *      TransientTransactionError. deleteAccount is the exception: it is NOT
 *      transactional (no uow), so its guard is best-effort — the orphan window
 *      is asserted honestly and flagged (TODO R15.1-6e), not faked.
 */
describe("concurrencia deletes transaccionales (R15.1 Fase 3)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const SRC = "bbbbbbbbbbbbbbbbbbbbbbbb";

  const D = new Date("2025-06-01");

  const payableRepo = () => new MongoPayableRepository();
  const creditReceivedRepo = () => new MongoCreditReceivedRepository();
  const creditGrantedRepo = () => new MongoCreditGrantedRepository();
  const movementRepo = () => new MongoMovementRepository();
  const accountRepo = () => new MongoAccountRepository();
  const uow = () => new MongoUnitOfWork();

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_concurrency_deletion"));
    await seedAccount();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await PayableModel.deleteMany({});
    await CreditReceivedModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await MovementModel.deleteMany({});
    await AccountModel.deleteMany({});
    await SaleModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await CategoryModel.deleteMany({});
    await seedAccount();
  });

  async function seedAccount(): Promise<void> {
    await AccountModel.create([
      { _id: SRC, workspaceId: WS, name: "Source", currency: "COP", isFixed: false },
    ]);
  }

  /** Movements still referencing an aggregate id (orphan check). */
  async function linkedMovementCount(refId: string): Promise<number> {
    return MovementModel.countDocuments({ workspaceId: WS, "link.refId": refId });
  }

  function assertNoTransactionErrors(settled: PromiseSettledResult<unknown>[]): void {
    for (const s of settled) {
      if (s.status === "rejected") {
        const msg = s.reason?.message ?? String(s.reason);
        expect(msg).not.toContain("NoSuchTransaction");
        expect(msg).not.toContain("TransientTransactionError");
      }
    }
  }

  /**
   * Ruta de aborto LIMPIA en las carreras delete × create:
   * - NotFoundError → el agregado ya no existe (borrado ganó antes del commit
   *   del create; la tx re-ejecuta y la lectura fresca no encuentra el
   *   agregado).
   * - ConflictError → el guard de re-validación (overpayment / pending) cortó
   *   el create en la re-lectura fresca.
   * Cualquier otra clase de rechazo sería una fuga de estado (CAS, validación
   * inesperada) y debe fallar el test.
   */
  function assertCleanAborts(settled: PromiseSettledResult<unknown>[]): void {
    for (const s of settled) {
      if (s.status === "rejected") {
        const ok = s.reason instanceof NotFoundError || s.reason instanceof ConflictError;
        expect(ok, `unexpected rejection class: ${s.reason?.message ?? String(s.reason)}`).toBe(true);
      }
    }
  }

  describe("deletePayable × 5 concurrentes", () => {
    it("exactamente 1 gana; 4 abortan con NotFoundError; 0 huérfanos", async () => {
      const payable = await createPayable(
        WS,
        { counterparty: "Proveedor SA", total: 100_000, currency: "COP", accountId: SRC, date: D },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      await addPayableAbono(
        WS,
        payable.id,
        { amount: 40_000, currency: "COP", accountId: SRC, date: D },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      expect(await linkedMovementCount(payable.id)).toBe(1);

      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          deletePayable(WS, payable.id, payableRepo(), movementRepo(), uow()),
        ),
      );

      assertNoTransactionErrors(settled);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(NotFoundError);
      }

      // El payable no existe y ningún movement quedó huérfano apuntándole.
      expect(await PayableModel.countDocuments({ _id: payable.id, workspaceId: WS })).toBe(0);
      expect(await linkedMovementCount(payable.id)).toBe(0);
    }, 120_000);
  });

  describe("deleteCreditReceived × 5 concurrentes", () => {
    it("exactamente 1 gana; 4 abortan con NotFoundError; 0 huérfanos", async () => {
      const credit = await createCreditReceived(
        WS,
        { counterparty: "Banco XYZ", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditReceivedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      await addCreditReceivedAbono(
        WS,
        credit.id,
        { amount: 30_000, currency: "COP", accountId: SRC, date: D },
        creditReceivedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      expect(await linkedMovementCount(credit.id)).toBe(2); // principal + abono

      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          deleteCreditReceived(WS, credit.id, creditReceivedRepo(), movementRepo(), uow()),
        ),
      );

      assertNoTransactionErrors(settled);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(NotFoundError);
      }

      expect(await CreditReceivedModel.countDocuments({ _id: credit.id, workspaceId: WS })).toBe(0);
      expect(await linkedMovementCount(credit.id)).toBe(0);
    }, 120_000);
  });

  describe("deleteCreditGranted × 5 concurrentes", () => {
    it("exactamente 1 gana; 4 abortan con NotFoundError; 0 huérfanos", async () => {
      const credit = await createCreditGranted(
        WS,
        { counterparty: "Cliente", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditGrantedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      // Crédito standalone (sin saleId) — el primer abono recupera capital.
      await addCreditGrantedAbono(
        WS,
        credit.id,
        { amount: 30_000, currency: "COP", accountId: SRC, date: D },
        creditGrantedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      expect(await linkedMovementCount(credit.id)).toBe(2); // principal + abono capital

      const settled = await Promise.allSettled(
        Array.from({ length: 5 }, () =>
          deleteCreditGranted(WS, credit.id, creditGrantedRepo(), movementRepo(), uow()),
        ),
      );

      assertNoTransactionErrors(settled);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      const rejected = settled.filter((s) => s.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(NotFoundError);
      }

      expect(await CreditGrantedModel.countDocuments({ _id: credit.id, workspaceId: WS })).toBe(0);
      expect(await linkedMovementCount(credit.id)).toBe(0);
    }, 120_000);
  });

  describe("idempotencia secuencial", () => {
    it("borrar dos veces el mismo payable → 2º NotFoundError, sin estado parcial", async () => {
      const payable = await createPayable(
        WS,
        { counterparty: "Proveedor SA", total: 100_000, currency: "COP", accountId: SRC, date: D },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      await addPayableAbono(
        WS,
        payable.id,
        { amount: 40_000, currency: "COP", accountId: SRC, date: D },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );

      await expect(
        deletePayable(WS, payable.id, payableRepo(), movementRepo(), uow()),
      ).resolves.toBeUndefined();
      expect(await linkedMovementCount(payable.id)).toBe(0);

      // Segunda ejecución: el abort de la transacción no deja estado parcial.
      await expect(
        deletePayable(WS, payable.id, payableRepo(), movementRepo(), uow()),
      ).rejects.toThrow(NotFoundError);
      expect(await PayableModel.countDocuments({ _id: payable.id, workspaceId: WS })).toBe(0);
      expect(await linkedMovementCount(payable.id)).toBe(0);
    }, 120_000);
  });

  describe("deletePayable × addPayableAbono (N=10)", () => {
    it("interleave fijo 5 deletes + 5 abonos → borrado gana o payable vivo coherente; 0 huérfanos", async () => {
      const payable = await createPayable(
        WS,
        { counterparty: "Proveedor SA", total: 100_000, currency: "COP", accountId: SRC, date: D },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      // Payable sin abono previo → 0 movimientos ligados en el seed.

      const settled = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0
            ? deletePayable(WS, payable.id, payableRepo(), movementRepo(), uow())
            : addPayableAbono(
                WS,
                payable.id,
                { amount: 30_000, currency: "COP", accountId: SRC, date: D },
                payableRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);

      const deleted = (await PayableModel.countDocuments({ _id: payable.id, workspaceId: WS })) === 0;
      const fulfilled = settled.filter((s) => s.status === "fulfilled").length;

      if (deleted) {
        // Terminal A: el delete ganó → el cascade (deleteByRefId, misma tx)
        // arrastró TODO movimiento ligado, incluso los abonos que alcanzaron
        // a confirmar antes del commit del borrado.
        expect(await linkedMovementCount(payable.id)).toBe(0);
      } else {
        // Terminal B (defensivo): payable vivo → cada abono confirmado dejó
        // exactamente 1 movimiento ligado (los deletes NO pudieron ganar).
        expect(await linkedMovementCount(payable.id)).toBe(fulfilled);
      }
    }, 120_000);
  });

  describe("deleteCreditReceived × addCreditReceivedAbono (N=10)", () => {
    it("interleave fijo 5 deletes + 5 abonos → borrado gana o crédito vivo coherente; 0 huérfanos", async () => {
      const credit = await createCreditReceived(
        WS,
        { counterparty: "Banco XYZ", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditReceivedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      // Seed: 1 movimiento (el principal). El race decide si queda 1 + abonos o 0.

      const settled = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0
            ? deleteCreditReceived(WS, credit.id, creditReceivedRepo(), movementRepo(), uow())
            : addCreditReceivedAbono(
                WS,
                credit.id,
                { amount: 30_000, currency: "COP", accountId: SRC, date: D },
                creditReceivedRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);

      const deleted = (await CreditReceivedModel.countDocuments({ _id: credit.id, workspaceId: WS })) === 0;
      const fulfilled = settled.filter((s) => s.status === "fulfilled").length;

      if (deleted) {
        // Terminal A: delete ganó → cascade del principal + abonos confirmados.
        expect(await linkedMovementCount(credit.id)).toBe(0);
      } else {
        // Terminal B (defensivo): crédito vivo → principal + 1 movimiento por abono.
        expect(await linkedMovementCount(credit.id)).toBe(1 + fulfilled);
      }
    }, 120_000);
  });

  describe("deleteCreditGranted × addCreditGrantedAbono (N=10)", () => {
    it("interleave fijo 5 deletes + 5 abonos (crédito standalone) → borrado gana o split coherente; 0 huérfanos", async () => {
      const credit = await createCreditGranted(
        WS,
        { counterparty: "Cliente", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditGrantedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      // Crédito standalone (sin saleId) → seed: único movimiento del principal.
      // Cada abono ganador produce 1-2 movimientos según el split capital/interés:
      // el conteo esperado se DERIVA de los abonos realmente embebidos (el split
      // es puro y determinístico sobre la secuencia cronológica final).

      const settled = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0
            ? deleteCreditGranted(WS, credit.id, creditGrantedRepo(), movementRepo(), uow())
            : addCreditGrantedAbono(
                WS,
                credit.id,
                { amount: 30_000, currency: "COP", accountId: SRC, date: D },
                creditGrantedRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);

      const deleted = (await CreditGrantedModel.countDocuments({ _id: credit.id, workspaceId: WS })) === 0;

      if (deleted) {
        expect(await linkedMovementCount(credit.id)).toBe(0);
      } else {
        const credits = await creditGrantedRepo().findByWorkspaceId(WS);
        const after = credits.find((c) => c.id === credit.id);
        if (!after) throw new Error("invariant: crédito vivo pero no re-visible por el repo");
        const splits = splitAbonoCapitalInterest(
          after.principal.amount,
          after.abonos.map((a) => ({ amount: a.amount.amount })),
        );
        const abonoMovements = splits.reduce(
          (sum, s) => sum + (s.capitalAmount > 0 ? 1 : 0) + (s.interestAmount > 0 ? 1 : 0),
          0,
        );
        // 1 (principal) + movimientos reales derivados del split.
        expect(await linkedMovementCount(credit.id)).toBe(1 + abonoMovements);
      }
    }, 120_000);
  });

  describe("deleteAccount × createMovement (N=10)", () => {
    it("10 createMovement vs 1 deleteAccount → doble-ganador imposible; 0 movimientos huérfanos (6e)", async () => {
      // createMovement exige una categoría REAL (MOV-2/MOV-3: categoryRepo.findById
      // workspace-scoped) — se siembra una antes de la carrera.
      const CATEGORY_ID = "999999999999999999999999";
      await CategoryModel.create({
        _id: CATEGORY_ID,
        workspaceId: WS,
        name: "Manual income",
        type: "income",
      });

      const settled = await Promise.allSettled([
        ...Array.from({ length: 10 }, () =>
          createMovement(
            WS,
            {
              accountId: SRC,
              type: "income",
              amount: 50_000,
              currency: "COP",
              date: D,
              categoryId: CATEGORY_ID,
              context: "Personal",
            },
            movementRepo(),
            new MongoCategoryRepository(),
            objectIdGenerator,
            accountRepo(),
            uow(),
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const createResults = settled.slice(0, 10);
      const deleteResult = settled[10];

      const accountExists = (await AccountModel.countDocuments({ _id: SRC, workspaceId: WS })) > 0;
      const accountMovements = await MovementModel.countDocuments({ workspaceId: WS, accountId: SRC });
      const fulfilledCreates = createResults.filter((s) => s.status === "fulfilled").length;

      // Consistencia contable incondicional: el único escritor de movimientos en
      // SRC es createMovement → cada promesa fulfilled = exactamente 1 documento.
      expect(accountMovements).toBe(fulfilledCreates);
      for (const r of createResults) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(NotFoundError); // cuenta ya borrada
        }
      }

      if (accountExists) {
        // Guard-ganó (ACC-4): el delete vio una referencia y abortó con su
        // mensaje exacto; la cuenta vive y los 10 movimientos quedaron.
        if (deleteResult.status !== "rejected") {
          throw new Error("invariant: cuenta viva ⇒ el delete DEBE haber rechazado");
        }
        expect(deleteResult.reason).toBeInstanceOf(ConflictError);
        expect((deleteResult.reason as Error).message).toBe("Account has references and cannot be deleted");
        expect(createResults.filter((s) => s.status === "fulfilled")).toHaveLength(10);
      } else {
        // Delete-ganó: la cuenta está borrada. R15.1-6e cerró la ventana:
        // deleteAccount corre TODO en uow.withTransaction (delete-account.ts)
        // — guard countReferences con tx + delete final con tx — mientras
        // createMovement toca el MISMO documento de cuenta dentro de su
        // transacción (accountRepo.touch, shared-document write). La carrera
        // entre el guard y el borrado es ahora un write-write conflict sobre
        // el doc de la cuenta: el perdedor aborta y re-ejecuta sobre el
        // snapshot del ganador → cuenta borrada ⇒ 0 movimientos huérfanos.
        if (deleteResult.status !== "fulfilled") {
          throw new Error("invariant: cuenta borrada ⇒ el delete DEBE haber ganado");
        }
        // El criterio R15.1 "cuenta borrada → 0 movimientos" queda garantizado
        // por el diseño 6e (touch + transacción en ambos lados); si este
        // escenario encuentra un huérfano en el futuro, es un fallo real.
        expect(accountMovements).toBe(0);
      }
    }, 120_000);
  });

  describe("deleteSale × addSaleAbono (N=10)", () => {
    it("interleave fijo 5 deletes + 5 abonos → borrado gana o sale vivo coherente; 0 huérfanos", async () => {
      const CATALOG_ITEM = "cccccccccccccccccccccccc";
      await CatalogItemModel.create({
        _id: CATALOG_ITEM,
        workspaceId: WS,
        name: "Consultoria",
        unitPrice: 50_000,
        currency: "COP",
        type: "service",
      });

      // Sale paid-in-full SIN crédito ligado (create-sale.ts:146-157): la única
      // deuda es la del sale y su ledger = 1 movimiento salePayment.
      const sale = await createSale(
        WS,
        {
          items: [{ itemId: CATALOG_ITEM, quantity: 2, unitPrice: 50_000 }],
          date: D,
          paymentMode: "paid-in-full",
          accountId: SRC,
          currency: "COP",
        },
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        movementRepo(),
        objectIdGenerator,
        new MongoClientRepository(),
        creditGrantedRepo(),
        accountRepo(),
        uow(),
      );
      expect(await linkedMovementCount(sale.id)).toBe(1);

      const settled = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0
            ? deleteSale(
                WS,
                sale.id,
                new MongoSaleRepository(),
                new MongoCatalogItemRepository(),
                movementRepo(),
                creditGrantedRepo(),
                uow(),
              )
            : addSaleAbono(
                WS,
                sale.id,
                { amount: 30_000, currency: "COP", accountId: SRC, date: D },
                new MongoSaleRepository(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);

      const deleted = (await SaleModel.countDocuments({ _id: sale.id, workspaceId: WS })) === 0;
      const fulfilled = settled.filter((s) => s.status === "fulfilled").length;

      if (deleted) {
        // Terminal A: delete ganó → deleteByRefId(saleId) barrió el movimiento
        // del total + los abonos confirmados; sin crédito ligado no hay más.
        expect(await linkedMovementCount(sale.id)).toBe(0);
        expect(await CreditGrantedModel.countDocuments({ workspaceId: WS, saleId: sale.id })).toBe(0);
      } else {
        // Terminal B (defensivo): sale vivo → 1 (el total) + 1 por abono ganador.
        expect(await linkedMovementCount(sale.id)).toBe(1 + fulfilled);
      }
    }, 120_000);
  });
});