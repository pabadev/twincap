import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ConflictError, NotFoundError, ValidationError } from "../../core/domain/errors";
import { createMovement } from "../../core/application/movements/create-movement";
import { updateMovement } from "../../core/application/movements/update-movement";
import { deleteCategory } from "../../core/application/categories/delete-category";
import { deleteAccount } from "../../core/application/accounts/delete-account";
import { deleteClient } from "../../core/application/clients/delete-client";
import { createSale } from "../../core/application/sales/create-sale";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoCategoryRepository } from "../repositories/category-repository";
import { MongoClientRepository } from "../repositories/client-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { MovementModel } from "../models/movement";
import { CategoryModel } from "../models/category";
import { SaleModel } from "../models/sale";
import { ClientModel } from "../models/client";
import { CatalogItemModel } from "../models/catalog";

/**
 * R15.3 P2 — reference-integrity races: Movement → Account/Category and
 * Sale → Client must never point at a deleted entity.
 *
 * REAL repositories + REAL MongoUnitOfWork + REAL use cases against a shared
 * single-node MongoMemoryReplSet (binary PINNED to 7.0.41 — same reason as the
 * other R15 suites: latest mongod crashes on Windows).
 *
 * What each suite proves (shared-document conflict points, R15.1-6e pattern):
 *   §7 updateMovement × deleteAccount — the edit touches the NEW account inside
 *     its transaction BEFORE the movement write; deleteAccount deletes the SAME
 *     doc as its last write. Delete won → every edit re-executes, re-reads the
 *     account as gone → NotFoundError, 0 movements on the deleted account.
 *     Account alive → every committed edit migrated the movement to it.
 *   §8 updateMovement × deleteCategory — the reassignment touches the NEW
 *     category inside its transaction BEFORE the movement write. Delete won →
 *     edits abort NotFoundError, 0 movements referencing the deleted category.
 *     Category alive → the movement migrated to it.
 *   §9 createMovement × deleteCategory — the create touches the category
 *     (shared-document write) BEFORE the insert. Delete won → creates abort
 *     ValidationError, 0 movements referencing the deleted category. Category
 *     alive → every committed create left exactly its movement.
 *   §10 createSale × deleteClient — the on-credit create re-validates and
 *     touches the client inside its transaction BEFORE inserting. Delete won →
 *     creates abort NotFoundError, 0 sales referencing the deleted client.
 *     Client alive → the delete's active-sales guard rejects with ConflictError
 *     and every committed create left its sale.
 *
 * Zero NoSuchTransaction / TransientTransactionError leak in every race; the
 * only legal aborts are the domain errors listed above.
 */
describe("concurrencia referencias (R15.3 P2)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const SRC = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const AUX = "cccccccccccccccccccccccc";
  const CAT_A = "dddddddddddddddddddddddd";
  const CAT_B = "eeeeeeeeeeeeeeeeeeeeeeee";
  const CLIENT = "ffffffffffffffffffffffff";
  const CATALOG_ITEM = "999999999999999999999999";

  const D = new Date("2025-06-01");

  const movementRepo = () => new MongoMovementRepository();
  const accountRepo = () => new MongoAccountRepository();
  const categoryRepo = () => new MongoCategoryRepository();
  const clientRepo = () => new MongoClientRepository();
  const saleRepo = () => new MongoSaleRepository();
  const creditGrantedRepo = () => new MongoCreditGrantedRepository();
  const uow = () => new MongoUnitOfWork();

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_concurrency_references"));
    await seedBase();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await MovementModel.deleteMany({});
    await AccountModel.deleteMany({});
    await CategoryModel.deleteMany({});
    await SaleModel.deleteMany({});
    await ClientModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await seedBase();
  });

  async function seedBase(): Promise<void> {
    await AccountModel.create([
      { _id: SRC, workspaceId: WS, name: "Source", currency: "COP", isFixed: false },
      { _id: AUX, workspaceId: WS, name: "Aux", currency: "COP", isFixed: false },
    ]);
    await CategoryModel.create([
      { _id: CAT_A, workspaceId: WS, name: "Income A", type: "income" },
      { _id: CAT_B, workspaceId: WS, name: "Income B", type: "income" },
    ]);
    await ClientModel.create({
      _id: CLIENT,
      workspaceId: WS,
      name: "Juan Pérez",
    });
    await CatalogItemModel.create({
      _id: CATALOG_ITEM,
      workspaceId: WS,
      name: "Consultoria",
      unitPrice: 50_000,
      currency: "COP",
      type: "service",
    });
  }

  /** A movement on AUX categorized CAT_A — the seed for §7/§8 races. */
  async function seedMovementOnAux(): Promise<string> {
    const movement = await createMovement(
      WS,
      {
        accountId: AUX,
        type: "income",
        amount: 50_000,
        currency: "COP",
        date: D,
        categoryId: CAT_A,
        context: "Personal",
      },
      movementRepo(),
      categoryRepo(),
      objectIdGenerator,
      accountRepo(),
      uow(),
    );
    return movement.id;
  }

  function assertNoTransactionErrors(settled: PromiseSettledResult<unknown>[]): void {
    for (const s of settled) {
      if (s.status === "rejected") {
        const msg = s.reason?.message ?? String(s.reason);
        expect(msg).not.toContain("NoSuchTransaction");
        expect(msg).not.toContain("TransientTransactionError");
        expect(msg).not.toContain("WriteConflict");
      }
    }
  }

  /** Legal aborts only: the loser re-executed and hit a domain guard. */
  function assertCleanAborts(settled: PromiseSettledResult<unknown>[]): void {
    for (const s of settled) {
      if (s.status === "rejected") {
        const ok =
          s.reason instanceof NotFoundError ||
          s.reason instanceof ConflictError ||
          s.reason instanceof ValidationError;
        expect(ok, `unexpected rejection class: ${s.reason?.message ?? String(s.reason)}`).toBe(true);
      }
    }
  }

  describe("§7 updateMovement × deleteAccount (N=10)", () => {
    it("9 migraciones del movement AUX→SRC + 1 delete → doble-ganador imposible; 0 movimientos en cuenta borrada", async () => {
      // The movement lives on AUX; every edit migrates it to SRC while one
      // deleteAccount races them.
      const MOVEMENT = await seedMovementOnAux();

      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          updateMovement(
            WS,
            { movementId: MOVEMENT, accountId: SRC },
            movementRepo(),
            categoryRepo(),
            accountRepo(),
            uow(),
          ),
        ),
        deleteAccount(WS, SRC, accountRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const srcExists = (await AccountModel.countDocuments({ _id: SRC, workspaceId: WS })) > 0;
      const movementsOnSrc = await MovementModel.countDocuments({ workspaceId: WS, accountId: SRC });
      const fulfilledOps = ops.filter((s) => s.status === "fulfilled").length;

      for (const r of ops) {
        if (r.status === "rejected") {
          // The account was already gone when the edit (re)validated it.
          expect(r.reason).toBeInstanceOf(NotFoundError);
        }
      }
      if (srcExists) {
        // Account alive → every committed edit migrated the movement to SRC.
        expect(deleteResult.status, "invariant: cuenta viva ⇒ el delete DEBE haber rechazado").toBe("rejected");
        const reason = deleteResult.status === "rejected" ? deleteResult.reason : null;
        expect(reason).toBeInstanceOf(ConflictError);
        expect(await MovementModel.countDocuments({ workspaceId: WS, accountId: AUX })).toBe(0);
        expect(movementsOnSrc).toBe(fulfilledOps === 0 ? 0 : 1);
      } else {
        // Delete won → the edits aborted and the movement stayed on AUX:
        // no Movement points at the deleted account.
        expect(deleteResult.status).toBe("fulfilled");
        expect(movementsOnSrc).toBe(0);
      }
    }, 120_000);
  });

  describe("§8 updateMovement × deleteCategory (N=10)", () => {
    it("9 reasignaciones del movement → CAT_B + 1 delete de CAT_B → 0 movimientos apuntando a categoría borrada", async () => {
      const MOVEMENT = await seedMovementOnAux();

      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          updateMovement(
            WS,
            { movementId: MOVEMENT, categoryId: CAT_B },
            movementRepo(),
            categoryRepo(),
            accountRepo(),
            uow(),
          ),
        ),
        deleteCategory(WS, CAT_B, categoryRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const catBExists = (await CategoryModel.countDocuments({ _id: CAT_B, workspaceId: WS })) > 0;
      const movementsOnCatB = await MovementModel.countDocuments({ workspaceId: WS, categoryId: CAT_B });

      if (!catBExists) {
        // Delete won → every reassignment aborted (NotFoundError) and the
        // movement kept CAT_A: the deleted category has ZERO references.
        expect(deleteResult.status).toBe("fulfilled");
        expect(movementsOnCatB).toBe(0);
        expect(await MovementModel.countDocuments({ workspaceId: WS, categoryId: CAT_A })).toBe(1);
      } else {
        // Reassignment won (at least one commit) → the delete's reference
        // guard rejected with ConflictError; the category lives with its refs.
        expect(deleteResult.status, "invariant: categoría viva ⇒ el delete DEBE haber rechazado").toBe("rejected");
        const reason = deleteResult.status === "rejected" ? deleteResult.reason : null;
        expect(reason).toBeInstanceOf(ConflictError);
        expect(movementsOnCatB).toBe(1);
      }
    }, 120_000);
  });

  describe("§9 createMovement × deleteCategory (N=10)", () => {
    it("9 creates contra CAT_B + 1 delete de CAT_B → 0 movimientos apuntando a categoría borrada", async () => {
      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createMovement(
            WS,
            {
              accountId: SRC,
              type: "income",
              amount: 50_000,
              currency: "COP",
              date: D,
              categoryId: CAT_B,
              context: "Personal",
            },
            movementRepo(),
            categoryRepo(),
            objectIdGenerator,
            accountRepo(),
            uow(),
          ),
        ),
        deleteCategory(WS, CAT_B, categoryRepo(), movementRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const catBExists = (await CategoryModel.countDocuments({ _id: CAT_B, workspaceId: WS })) > 0;
      const movementsOnCatB = await MovementModel.countDocuments({ workspaceId: WS, categoryId: CAT_B });
      const fulfilledCreates = ops.filter((s) => s.status === "fulfilled").length;

      // Accounting invariant: each committed create = exactly 1 movement.
      expect(movementsOnCatB).toBe(fulfilledCreates);
      if (!catBExists) {
        // Delete won → every create aborted (ValidationError: category gone),
        // including the ones that had already validated the category: the
        // shared-document touch made them conflict with the delete.
        expect(deleteResult.status).toBe("fulfilled");
        expect(movementsOnCatB).toBe(0);
        expect(fulfilledCreates).toBe(0);
      } else {
        // Creates won → the delete's reference guard rejected.
        expect(deleteResult.status, "invariant: categoría viva ⇒ el delete DEBE haber rechazado").toBe("rejected");
        const reason = deleteResult.status === "rejected" ? deleteResult.reason : null;
        expect(reason).toBeInstanceOf(ConflictError);
        expect(fulfilledCreates).toBeGreaterThan(0);
      }
    }, 120_000);
  });

  describe("§10 createSale × deleteClient (N=10)", () => {
    it("9 ventas on-credit contra el client + 1 delete del client → 0 sales apuntando a client borrado", async () => {
      const settled = await Promise.allSettled([
        ...Array.from({ length: 9 }, () =>
          createSale(
            WS,
            {
              items: [{ itemId: CATALOG_ITEM, quantity: 1, unitPrice: 50_000 }],
              date: D,
              paymentMode: "on-credit",
              accountId: SRC,
              currency: "COP",
              clientId: CLIENT,
              initialPayment: 20_000,
            },
            saleRepo(),
            new MongoCatalogItemRepository(),
            movementRepo(),
            objectIdGenerator,
            clientRepo(),
            creditGrantedRepo(),
            accountRepo(),
            uow(),
          ),
        ),
        deleteClient(WS, CLIENT, clientRepo(), saleRepo(), uow()),
      ]);

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);
      const ops = settled.slice(0, 9);
      const deleteResult = settled[9];
      const clientExists = (await ClientModel.countDocuments({ _id: CLIENT, workspaceId: WS })) > 0;
      const salesOnClient = await SaleModel.countDocuments({ workspaceId: WS, clientId: CLIENT });
      const fulfilledSales = ops.filter((s) => s.status === "fulfilled").length;

      // Accounting invariant: each committed sale = exactly 1 sale doc.
      expect(salesOnClient).toBe(fulfilledSales);
      if (!clientExists) {
        // Delete won → every create aborted (NotFoundError) before inserting.
        expect(deleteResult.status).toBe("fulfilled");
        expect(salesOnClient).toBe(0);
        expect(fulfilledSales).toBe(0);
      } else {
        // Creates won → the active-sales guard rejected the delete (D2).
        expect(deleteResult.status, "invariant: client vivo ⇒ el delete DEBE haber rechazado").toBe("rejected");
        const reason = deleteResult.status === "rejected" ? deleteResult.reason : null;
        expect(reason).toBeInstanceOf(ConflictError);
        expect(fulfilledSales).toBeGreaterThan(0);
      }
    }, 120_000);
  });

  describe("§13 createMovement × createMovement (R15.3 §23 fila 13)", () => {
    it("N=10 concurrentes sobre la MISMA cuenta → ningún movimiento perdido; saldo derivado == Σ montos", async () => {
      const n = 10;
      const settled = await Promise.allSettled(
        Array.from({ length: n }, (_, i) =>
          createMovement(
            WS,
            {
              accountId: SRC,
              type: "income",
              amount: 10_000 + i * 1_000,
              currency: "COP",
              date: D,
              categoryId: CAT_A,
              context: "Personal",
            },
            movementRepo(),
            categoryRepo(),
            objectIdGenerator,
            accountRepo(),
            uow(),
          ),
        ),
      );

      assertNoTransactionErrors(settled);
      assertCleanAborts(settled);
      const fulfilled = settled.filter((s) => s.status === "fulfilled");
      // Shared-document write (account touch) serializa: todos los creates
      // pueden ganar (retry del driver) pero NINGUNO se pierde ni duplica.
      expect(fulfilled.length).toBe(n);

      const movements = await MovementModel.find({ workspaceId: WS, accountId: SRC }).lean();
      expect(movements).toHaveLength(n);

      // Invariancia de saldo derivado: cada movement commiteado == 1 documento
      // y el total coincide con Σ amounts (sin doble gasto ni pérdida).
      const amounts = Array.from({ length: n }, (_, i) => 10_000 + i * 1_000);
      const total = movements.reduce(
        (acc, m) => acc + (m as unknown as { signedAmount: number }).signedAmount,
        0,
      );
      expect(total).toBe(amounts.reduce((acc, a) => acc + a, 0));
      expect(new Set(movements.map((m) => String((m as unknown as { _id: unknown })._id))).size).toBe(n);
    }, 120_000);
  });
});