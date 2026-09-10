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
import { setInitialAccountBalance } from "../../core/application/accounts/set-initial-balance";
import { createMovement } from "../../core/application/movements/create-movement";
import { deleteSale } from "../../core/application/sales/delete-sale";
import { addSaleAbono } from "../../core/application/sales/add-sale-abono";
import { createSale } from "../../core/application/sales/create-sale";
import { writeOffCreditGranted } from "../../core/application/credits-granted/write-off-credit-granted";
import { createTransfer } from "../../core/application/transfers/create-transfer";
import { MongoPayableRepository } from "../repositories/payable-repository";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoTransferRepository } from "../repositories/transfer-repository";
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
import { TransferModel } from "../models/transfer";
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

  // ─── R15.2 matriz "Eliminaciones": deleteAccount × cada operación que
  // escribe movimientos. Cada par demuestra que el doble-ganador es imposible:
  // cuenta viva → el delete aborta con ConflictError (guard de referencias);
  // cuenta borrada → la op re-ejecuta sobre el snapshot fresco y aborta con
  // NotFoundError → 0 movimientos huérfanos. Para los pares cuyo padre debe
  // existir (abonos/writeOff), el propio documento del padre es una referencia
  // → el delete pierde DETERMINÍSTICAMENTE con ConflictError.

  const SRC_MOVEMENTS_MSG = "invariant: cuenta viva ⇒ el delete DEBE haber rechazado";
  const SRC_DELETED_MSG = "invariant: cuenta borrada ⇒ el delete DEBE haber ganado";

  function accountExists(): Promise<boolean> {
    return AccountModel.countDocuments({ _id: SRC, workspaceId: WS }).then((n) => n > 0);
  }

  function movementsOnSrc(): Promise<number> {
    return MovementModel.countDocuments({ workspaceId: WS, accountId: SRC });
  }

  async function assertDeleteConflict(deleteResult: PromiseSettledResult<unknown>): Promise<void> {
    expect(deleteResult.status, SRC_MOVEMENTS_MSG).toBe("rejected");
    const reason = deleteResult.status === "rejected" ? deleteResult.reason : null;
    expect(reason).toBeInstanceOf(ConflictError);
    expect((reason as Error).message).toBe(
      "Account has references and cannot be deleted",
    );
  }

  async function assertDeleteFulfilled(deleteResult: PromiseSettledResult<unknown>): Promise<void> {
    expect(deleteResult.status, SRC_DELETED_MSG).toBe("fulfilled");
  }

  describe("deleteAccount × createSale (N=10)", () => {
    it("9 ventas + 1 delete → doble-ganador imposible; 0 movimientos huérfanos (fila 31)", async () => {
      await CatalogItemModel.create({
        _id: "cccccccccccccccccccccccc",
        workspaceId: WS,
        name: "Consultoria",
        unitPrice: 50_000,
        currency: "COP",
        type: "service",
      });

      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createSale(
            WS,
            {
              items: [{ itemId: "cccccccccccccccccccccccc", quantity: 1, unitPrice: 50_000 }],
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
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const alive = await accountExists();
      const fulfilled = ops.filter((s) => s.status === "fulfilled").length;
      // Cada venta paid-in-full → exactamente 1 salePayment sobre SRC.
      expect(await movementsOnSrc()).toBe(fulfilled);
      for (const r of ops) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(NotFoundError); // cuenta ya borrada
        }
      }
      if (alive) {
        await assertDeleteConflict(deleteResult);
        expect(fulfilled).toBe(9);
      } else {
        await assertDeleteFulfilled(deleteResult);
        expect(await movementsOnSrc()).toBe(0);
        expect(fulfilled).toBe(0);
      }
    }, 120_000);
  });

  describe("deleteAccount × addSaleAbono (seed en SRC)", () => {
    it("3 abonos + 3 deletes interleaved → delete pierde siempre con ConflictError; 0 huérfanos (fila 32)", async () => {
      await CatalogItemModel.create({
        _id: "cccccccccccccccccccccccc",
        workspaceId: WS,
        name: "Consultoria",
        unitPrice: 50_000,
        currency: "COP",
        type: "service",
      });
      const sale = await createSale(
        WS,
        {
          items: [{ itemId: "cccccccccccccccccccccccc", quantity: 2, unitPrice: 50_000 }],
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

      const settled = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0
            ? deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow())
            : addSaleAbono(
                WS,
                sale.id,
                { amount: 10_000, currency: "COP", accountId: SRC, date: D },
                new MongoSaleRepository(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      // El doc del sale + su salePayment son referencias → el guard NUNCA deja
      // pasar al delete: pierde en TODAS las posiciones, la cuenta vive.
      expect(await accountExists()).toBe(true);
      const abonoResults = settled.filter((_, i) => i % 2 === 1);
      expect(abonoResults.every((s) => s.status === "fulfilled")).toBe(true);
      const deleteResults = settled.filter((_, i) => i % 2 === 0);
      for (const d of deleteResults) {
        await assertDeleteConflict(d);
      }
      // 1 salePayment + 1 abono por ganador.
      expect(await movementsOnSrc()).toBe(1 + abonoResults.length);
    }, 120_000);
  });

  describe("deleteAccount × createCreditReceived (N=10)", () => {
    it("9 créditos + 1 delete → doble-ganador imposible; 0 huérfanos (fila 33)", async () => {
      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createCreditReceived(
            WS,
            { counterparty: "Banco XYZ", principal: 100_000, currency: "COP", accountId: SRC, date: D },
            creditReceivedRepo(),
            movementRepo(),
            objectIdGenerator,
            accountRepo(),
            uow(),
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const alive = await accountExists();
      const fulfilled = ops.filter((s) => s.status === "fulfilled").length;
      expect(await movementsOnSrc()).toBe(fulfilled); // 1 principal por crédito
      for (const r of ops) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(NotFoundError);
        }
      }
      if (alive) {
        await assertDeleteConflict(deleteResult);
        expect(fulfilled).toBe(9);
      } else {
        await assertDeleteFulfilled(deleteResult);
        expect(await movementsOnSrc()).toBe(0);
        expect(fulfilled).toBe(0);
      }
    }, 120_000);
  });

  describe("deleteAccount × addCreditReceivedAbono (seed en SRC)", () => {
    it("3 abonos + 3 deletes interleaved → delete pierde siempre; 0 huérfanos (fila 34)", async () => {
      const credit = await createCreditReceived(
        WS,
        { counterparty: "Banco XYZ", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditReceivedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );

      const settled = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0
            ? deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow())
            : addCreditReceivedAbono(
                WS,
                credit.id,
                { amount: 10_000, currency: "COP", accountId: SRC, date: D },
                creditReceivedRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      expect(await accountExists()).toBe(true);
      const abonoResults = settled.filter((_, i) => i % 2 === 1);
      expect(abonoResults.every((s) => s.status === "fulfilled")).toBe(true);
      const deleteResults = settled.filter((_, i) => i % 2 === 0);
      for (const d of deleteResults) {
        await assertDeleteConflict(d);
      }
      expect(await movementsOnSrc()).toBe(1 + abonoResults.length); // principal + abonos
    }, 120_000);
  });

  describe("deleteAccount × createCreditGranted (N=10)", () => {
    it("9 créditos + 1 delete → doble-ganador imposible; 0 huérfanos (fila 35)", async () => {
      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createCreditGranted(
            WS,
            { counterparty: "Cliente", principal: 100_000, currency: "COP", accountId: SRC, date: D },
            creditGrantedRepo(),
            movementRepo(),
            objectIdGenerator,
            accountRepo(),
            uow(),
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const alive = await accountExists();
      const fulfilled = ops.filter((s) => s.status === "fulfilled").length;
      expect(await movementsOnSrc()).toBe(fulfilled); // 1 principal por crédito
      for (const r of ops) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(NotFoundError);
        }
      }
      if (alive) {
        await assertDeleteConflict(deleteResult);
        expect(fulfilled).toBe(9);
      } else {
        await assertDeleteFulfilled(deleteResult);
        expect(await movementsOnSrc()).toBe(0);
        expect(fulfilled).toBe(0);
      }
    }, 120_000);
  });

  describe("deleteAccount × addCreditGrantedAbono (seed en SRC)", () => {
    it("3 abonos + 3 deletes interleaved → delete pierde siempre; 0 huérfanos (fila 36)", async () => {
      const credit = await createCreditGranted(
        WS,
        { counterparty: "Cliente", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditGrantedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );

      const settled = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0
            ? deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow())
            : addCreditGrantedAbono(
                WS,
                credit.id,
                { amount: 10_000, currency: "COP", accountId: SRC, date: D },
                creditGrantedRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      expect(await accountExists()).toBe(true);
      const abonoResults = settled.filter((_, i) => i % 2 === 1);
      expect(abonoResults.every((s) => s.status === "fulfilled")).toBe(true);
      const deleteResults = settled.filter((_, i) => i % 2 === 0);
      for (const d of deleteResults) {
        await assertDeleteConflict(d);
      }
      // 1 principal + 1 abono por ganador (interés 0 → sin leg de interés).
      expect(await movementsOnSrc()).toBe(1 + abonoResults.length);
    }, 120_000);
  });

  describe("deleteAccount × writeOffCreditGranted (seed en SRC)", () => {
    it("3 write-offs + 3 deletes interleaved → delete pierde siempre; 0 huérfanos (fila 37)", async () => {
      const credit = await createCreditGranted(
        WS,
        { counterparty: "Cliente", principal: 100_000, currency: "COP", accountId: SRC, date: D },
        creditGrantedRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );

      const settled = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0
            ? deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow())
            : writeOffCreditGranted(
                WS,
                credit.id,
                creditGrantedRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      expect(await accountExists()).toBe(true);
      const writeOffResults = settled.filter((_, i) => i % 2 === 1);
      // El primer write-off gana; los siguientes abortan (ya castigado).
      expect(writeOffResults.filter((s) => s.status === "fulfilled")).toHaveLength(1);
      for (const r of writeOffResults) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(ConflictError);
        }
      }
      const deleteResults = settled.filter((_, i) => i % 2 === 0);
      for (const d of deleteResults) {
        await assertDeleteConflict(d);
      }
      // 1 principal + 1 write-off.
      expect(await movementsOnSrc()).toBe(2);
    }, 120_000);
  });

  describe("deleteAccount × createPayable (N=10)", () => {
    it("9 payables + 1 delete → doble-ganador imposible; 0 huérfanos (fila 38)", async () => {
      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createPayable(
            WS,
            {
              counterparty: "Proveedor SA",
              total: 100_000,
              initialPayment: 50_000,
              currency: "COP",
              accountId: SRC,
              date: D,
            },
            payableRepo(),
            movementRepo(),
            objectIdGenerator,
            accountRepo(),
            uow(),
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const alive = await accountExists();
      const fulfilled = ops.filter((s) => s.status === "fulfilled").length;
      expect(await movementsOnSrc()).toBe(fulfilled); // 1 initial por payable
      for (const r of ops) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(NotFoundError);
        }
      }
      if (alive) {
        await assertDeleteConflict(deleteResult);
        expect(fulfilled).toBe(9);
      } else {
        await assertDeleteFulfilled(deleteResult);
        expect(await movementsOnSrc()).toBe(0);
        expect(fulfilled).toBe(0);
      }
    }, 120_000);
  });

  describe("deleteAccount × addPayableAbono (seed en SRC)", () => {
    it("3 abonos + 3 deletes interleaved → delete pierde siempre; 0 huérfanos (fila 39)", async () => {
      const payable = await createPayable(
        WS,
        {
          counterparty: "Proveedor SA",
          total: 100_000,
          initialPayment: 20_000,
          currency: "COP",
          accountId: SRC,
          date: D,
        },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );
      await addPayableAbono(
        WS,
        payable.id,
        { amount: 20_000, currency: "COP", accountId: SRC, date: D },
        payableRepo(),
        movementRepo(),
        objectIdGenerator,
        accountRepo(),
        uow(),
      );

      const settled = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          i % 2 === 0
            ? deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow())
            : addPayableAbono(
                WS,
                payable.id,
                { amount: 10_000, currency: "COP", accountId: SRC, date: D },
                payableRepo(),
                movementRepo(),
                objectIdGenerator,
                accountRepo(),
                uow(),
              ),
        ),
      );

      assertNoTransactionErrors(settled);
      expect(await accountExists()).toBe(true);
      const abonoResults = settled.filter((_, i) => i % 2 === 1);
      expect(abonoResults.every((s) => s.status === "fulfilled")).toBe(true);
      const deleteResults = settled.filter((_, i) => i % 2 === 0);
      for (const d of deleteResults) {
        await assertDeleteConflict(d);
      }
      // 1 initial + 1 abono seed + 3 abonos del race.
      expect(await movementsOnSrc()).toBe(2 + abonoResults.length);
    }, 120_000);
  });

  describe("deleteAccount × setInitialBalance (sin seed)", () => {
    it("cuenta sin actividad → el delete gana SIEMPRE; el opening es cascaded; 0 huérfanos (fila 41)", async () => {
      const settled = await Promise.allSettled([
        setInitialAccountBalance(
          WS,
          { accountId: SRC, amount: 100_000 },
          accountRepo(),
          movementRepo(),
          objectIdGenerator,
          uow(),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const op = settled[0];
      const deleteResult = settled[1];
      await assertDeleteFulfilled(deleteResult);
      // El opening NUNCA es referencia (cascade), y el touch comparte doc con el
      // delete → en cualquier interleaving la cuenta termina borrada y sin
      // movimientos. La op termina fulfilled (su opening fue cascaded por el
      // delete) o aborted con NotFoundError — nunca huérfana.
      expect(await accountExists()).toBe(false);
      expect(await movementsOnSrc()).toBe(0);
      if (op.status === "rejected") {
        expect(op.reason).toBeInstanceOf(NotFoundError);
      }
    }, 120_000);
  });

  describe("deleteAccount × createTransfer (destino = cuenta borrada)", () => {
    it("9 transfers AUX→SRC + 1 delete → doble-ganador imposible; 0 huérfanos (fila 40)", async () => {
      const AUX = "dddddddddddddddddddddddd";
      await AccountModel.create({
        _id: AUX,
        workspaceId: WS,
        name: "Aux",
        currency: "COP",
        isFixed: false,
      });
      // R15.2: fund AUX so every transfer takes the real write path instead of
      // the insufficient-funds warning (which fulfills without writing).
      await setInitialAccountBalance(
        WS,
        { accountId: AUX, amount: 1_000_000 },
        accountRepo(),
        movementRepo(),
        objectIdGenerator,
        uow(),
      );

      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createTransfer(
            WS,
            {
              sourceAccountId: AUX,
              destinationAccountId: SRC,
              sourceAmount: 20_000,
              sourceCurrency: "COP",
              date: D,
            },
            new MongoTransferRepository(),
            movementRepo(),
            objectIdGenerator,
            accountRepo(),
            creditReceivedRepo(),
            creditGrantedRepo(),
            new MongoSaleRepository(),
            payableRepo(),
            uow(),
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const alive = await accountExists();
      const fulfilled = ops.filter((s) => s.status === "fulfilled").length;
      // Cada transfer → 1 leg income sobre SRC.
      expect(await movementsOnSrc()).toBe(fulfilled);
      for (const r of ops) {
        if (r.status === "rejected") {
          expect(r.reason).toBeInstanceOf(NotFoundError);
        }
      }
      if (alive) {
        await assertDeleteConflict(deleteResult);
        expect(fulfilled).toBe(9);
      } else {
        await assertDeleteFulfilled(deleteResult);
        expect(await movementsOnSrc()).toBe(0);
        expect(
          await TransferModel.countDocuments({ workspaceId: WS, destinationAccountId: SRC }),
        ).toBe(0);
        expect(fulfilled).toBe(0);
      }
    }, 120_000);
  });
});