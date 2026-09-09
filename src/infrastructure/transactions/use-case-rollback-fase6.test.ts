import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { NotFoundError } from "../../core/domain/errors";
import { createAccount } from "../../core/application/accounts/create-account";
import { register } from "../../core/application/auth/register";
import { deleteSale } from "../../core/application/sales/delete-sale";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoCategoryRepository } from "../repositories/category-repository";
import { MongoUserRepository } from "../repositories/user-repository";
import { MongoWorkspaceRepository } from "../repositories/workspace-repository";
import { MongoMembershipRepository } from "../repositories/membership-repository";
import { MongoSaleRepository } from "../repositories/sale-repository";
import { MongoCatalogItemRepository } from "../repositories/catalog-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoWorkspaceBootstrapper } from "../seeding/user-bootstrap";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { CategoryModel } from "../models/category";
import { UserModel } from "../models/user";
import { WorkspaceModel } from "../models/workspace";
import { MembershipModel } from "../models/membership";
import { SaleModel } from "../models/sale";
import { CatalogItemModel } from "../models/catalog";
import { MovementModel } from "../models/movement";
import { CreditGrantedModel } from "../models/credit-granted";

/**
 * R15 Fase 6 — REAL multi-document transaction (rollback + idempotency) tests
 * for deleteSale, createAccount and register against a shared single-node
 * MongoMemoryReplSet.
 *
 * deleteSale  (§9): the whole cascade (stock restore + movement deletes +
 *                   credit delete + sale delete) is atomic; a failure in the
 *                   FINAL write rolls back the already-applied stock restore.
 *                   Idempotency: a duplicate/concurrent request finds the sale
 *                   already gone → NotFoundError → stock restored EXACTLY once.
 * createAccount (§11): account + opening movement commit atomically; the old
 *                      R8 manual compensation is gone — rollback is real.
 * register      (§12): User + Workspace + Membership + seed (1 account, 8
 *                      categories) commit atomically or none do.
 *
 * BINARY PIN (R15-F2, regla permanente): mongod DEBE pinarse a 7.0.41 (latest
 * crashea en Windows). Mismo pin que la suite Fase 2 use-case-rollback y la
 * Fase 4 concurrency-abonos.
 */
describe("R15 Fase 6 — use-case transactions: deleteSale, createAccount, register", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const ACCOUNT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const CATALOG_ID = "cccccccccccccccccccccccc";
  const SALE_ID = "dddddddddddddddddddddddd";
  const CREDIT_ID = "eeeeeeeeeeeeeeeeeeeeeeee";

  const createAccountInput = {
    name: "Ahorros",
    currency: "COP" as const,
    initialBalance: 50000,
  };

  const fakeHasher = {
    hash: async (password: string) => `hashed:${password}`,
    compare: async () => true,
  };

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_f6"));
    await AccountModel.create({
      _id: ACCOUNT_ID,
      workspaceId: WS,
      name: "Cash",
      currency: "COP",
      isFixed: false,
    });
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({ workspaceId: WS });
    await AccountModel.deleteMany({});
    await CategoryModel.deleteMany({});
    await UserModel.deleteMany({});
    await WorkspaceModel.deleteMany({});
    await MembershipModel.deleteMany({});
    await SaleModel.deleteMany({});
    await CatalogItemModel.deleteMany({});
    await MovementModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    // Re-seed the shared cash account that sale/catalog/movement fixtures rely on.
    await AccountModel.create({
      _id: ACCOUNT_ID,
      workspaceId: WS,
      name: "Cash",
      currency: "COP",
      isFixed: false,
    });
  });

  describe("deleteSale (§9)", () => {
    async function seedSaleWithCredit() {
      await CatalogItemModel.create({
        _id: CATALOG_ID,
        workspaceId: WS,
        name: "Pan",
        unitPrice: 5000,
        currency: "COP",
        type: "product",
        stock: 5,
      });
      await SaleModel.create({
        _id: SALE_ID,
        workspaceId: WS,
        items: [{ itemId: CATALOG_ID, quantity: 2, unitPrice: 5000, subtotal: 10000 }],
        date: new Date("2025-06-01"),
        paymentMode: "on-credit",
        accountId: ACCOUNT_ID,
        total: 10000,
        abonos: [],
        stockRestored: false,
      });
      await CreditGrantedModel.create({
        _id: CREDIT_ID,
        workspaceId: WS,
        counterparty: "Juan Pérez",
        principal: 10000,
        accountId: ACCOUNT_ID,
        date: new Date("2025-06-01"),
        saleId: SALE_ID,
        abonos: [],
      });
      await MovementModel.create([
        // Income that references the sale (legacy salePayment).
        {
          workspaceId: WS,
          accountId: ACCOUNT_ID,
          type: "income",
          amount: 10000,
          signedAmount: 10000,
          date: new Date("2025-06-01"),
          categoryId: ACCOUNT_ID,
          link: { kind: "salePayment", refId: SALE_ID, opId: objectIdGenerator.generate() },
        },
        // Income that references the sale-born credit (creditGrantedAbono).
        {
          workspaceId: WS,
          accountId: ACCOUNT_ID,
          type: "income",
          amount: 2000,
          signedAmount: 2000,
          date: new Date("2025-06-02"),
          categoryId: ACCOUNT_ID,
          link: { kind: "creditGrantedAbono", refId: CREDIT_ID, opId: objectIdGenerator.generate() },
        },
      ]);
    }

    it("commits the whole cascade on success — stock restored once, all docs gone", async () => {
      await seedSaleWithCredit();

      await deleteSale(
        WS,
        SALE_ID,
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        new MongoMovementRepository(),
        new MongoCreditGrantedRepository(),
        new MongoUnitOfWork(),
      );

      expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
      // Restore 2 units: 5 → 7 exactly once.
      const item = await CatalogItemModel.findById(CATALOG_ID);
      expect(item!.stock).toBe(7);
    }, 60_000);

    it("rolls back the stock restore and movement deletes when the FINAL sale delete fails (FAIL_STEP_LAST)", async () => {
      await seedSaleWithCredit();

      const saleRepo = new MongoSaleRepository();
      vi.spyOn(saleRepo, "delete").mockImplementationOnce(async () => {
        throw new Error("boom: sale delete fails");
      });

      await expect(
        deleteSale(
          WS,
          SALE_ID,
          saleRepo,
          new MongoCatalogItemRepository(),
          new MongoMovementRepository(),
          new MongoCreditGrantedRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: sale delete fails");

      // Nothing survived: stock NOT restored, sale/movements/credit intact.
      const item = await CatalogItemModel.findById(CATALOG_ID);
      expect(item!.stock).toBe(5);
      expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(2);
    }, 60_000);

    it("is idempotent on a duplicate request — stock restored exactly once, second call throws NotFound", async () => {
      await seedSaleWithCredit();

      await deleteSale(
        WS,
        SALE_ID,
        new MongoSaleRepository(),
        new MongoCatalogItemRepository(),
        new MongoMovementRepository(),
        new MongoCreditGrantedRepository(),
        new MongoUnitOfWork(),
      );
      const itemAfterFirst = await CatalogItemModel.findById(CATALOG_ID);
      expect(itemAfterFirst!.stock).toBe(7);

      // Duplicate (retry of the same logical delete): sale is gone → NotFound,
      // stock NOT restored a second time (rollback undoes the re-increment).
      await expect(
        deleteSale(
          WS,
          SALE_ID,
          new MongoSaleRepository(),
          new MongoCatalogItemRepository(),
          new MongoMovementRepository(),
          new MongoCreditGrantedRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow(NotFoundError);

      const item = await CatalogItemModel.findById(CATALOG_ID);
      expect(item!.stock).toBe(7);
      expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    }, 60_000);

    it.each([10, 25, 50])(
      "N=%i concurrent duplicate deletes → exactly 1 wins, stock restored once",
      async (n) => {
        await seedSaleWithCredit();

        const settled = await Promise.allSettled(
          Array.from({ length: n }, () =>
            deleteSale(
              WS,
              SALE_ID,
              new MongoSaleRepository(),
              new MongoCatalogItemRepository(),
              new MongoMovementRepository(),
              new MongoCreditGrantedRepository(),
              new MongoUnitOfWork(),
            ),
          ),
        );

        const winners = settled.filter((s) => s.status === "fulfilled");
        const losers = settled.filter((s) => s.status === "rejected");
        expect(winners.length).toBe(1);
        for (const loser of losers) {
          expect(loser.reason).toBeInstanceOf(NotFoundError);
        }

        const item = await CatalogItemModel.findById(CATALOG_ID);
        expect(item!.stock).toBe(7);
        expect(await SaleModel.countDocuments({ workspaceId: WS })).toBe(0);
        expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(0);
        expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
      },
      120_000,
    );
  });

  describe("createAccount (§11)", () => {
    it("commits account + opening movement as ONE unit on success", async () => {
      const account = await createAccount(
        WS,
        createAccountInput,
        new MongoAccountRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoUnitOfWork(),
      );

      expect(account.id).toMatch(/^[0-9a-f]{24}$/);
      expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(2); // cash + new
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    }, 60_000);

    it("rolls back the account when the opening movement write fails — no R8 manual compensation", async () => {
      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: opening movement write fails");
      });

      await expect(
        createAccount(
          WS,
          createAccountInput,
          new MongoAccountRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: opening movement write fails");

      // Nothing persisted — account rolled back by the transaction.
      expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1); // only cash
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    }, 60_000);

    it("retries cleanly after a failed attempt — no leaked documents", async () => {
      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: opening movement write fails");
      });

      await expect(
        createAccount(
          WS,
          createAccountInput,
          new MongoAccountRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: opening movement write fails");
      expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);

      // Retry with a fresh repo → exactly one account + one movement.
      const account = await createAccount(
        WS,
        createAccountInput,
        new MongoAccountRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoUnitOfWork(),
      );
      expect(account.id).toMatch(/^[0-9a-f]{24}$/);
      expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(2);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    }, 60_000);
  });

  describe("register (§12)", () => {
    async function bootstrap() {
      const accountRepo = new MongoAccountRepository();
      const categoryRepo = new MongoCategoryRepository();
      return {
        accountRepo,
        categoryRepo,
        bootstrapper: new MongoWorkspaceBootstrapper(accountRepo, categoryRepo),
      };
    }

    it("commits User + Workspace + Membership + seed atomically on success", async () => {
      const { accountRepo, categoryRepo, bootstrapper } = await bootstrap();

      const result = await register(
        { email: "f6@example.com", password: "password123" },
        new MongoUserRepository(),
        accountRepo,
        categoryRepo,
        fakeHasher,
        objectIdGenerator,
        new MongoWorkspaceRepository(),
        new MongoMembershipRepository(),
        bootstrapper,
        new MongoUnitOfWork(),
      );

      expect(result.userId).toMatch(/^[0-9a-f]{24}$/);
      expect(await UserModel.countDocuments({})).toBe(1);
      expect(await WorkspaceModel.countDocuments({})).toBe(1);
      expect(await MembershipModel.countDocuments({})).toBe(1);
      // Seed: 1 fixed account + 8 categories, all in the same workspace.
      expect(await AccountModel.countDocuments({})).toBe(2); // cash (beforeAll) + seeded
      expect(await CategoryModel.countDocuments({})).toBe(8);
    }, 60_000);

    it("rolls back the WHOLE onboarding when a seed write fails — no partial user/workspace", async () => {
      const { accountRepo, categoryRepo, bootstrapper } = await bootstrap();
      // First seed category write fails → abort.
      vi.spyOn(categoryRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: seed category write fails");
      });

      await expect(
        register(
          { email: "f6-fail@example.com", password: "password123" },
          new MongoUserRepository(),
          accountRepo,
          categoryRepo,
          fakeHasher,
          objectIdGenerator,
          new MongoWorkspaceRepository(),
          new MongoMembershipRepository(),
          bootstrapper,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: seed category write fails");

      // Nothing survived: no user, workspace, membership, seed account or category.
      expect(await UserModel.countDocuments({})).toBe(0);
      expect(await WorkspaceModel.countDocuments({})).toBe(0);
      expect(await MembershipModel.countDocuments({})).toBe(0);
      // Only the shared cash account from beforeAll remains.
      expect(await AccountModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await CategoryModel.countDocuments({})).toBe(0);
    }, 60_000);

    it("retries cleanly after a failed attempt — no duplicated onboarding", async () => {
      const { accountRepo, categoryRepo, bootstrapper } = await bootstrap();
      vi.spyOn(categoryRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: seed category write fails");
      });

      await expect(
        register(
          { email: "f6-retry@example.com", password: "password123" },
          new MongoUserRepository(),
          accountRepo,
          categoryRepo,
          fakeHasher,
          objectIdGenerator,
          new MongoWorkspaceRepository(),
          new MongoMembershipRepository(),
          bootstrapper,
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: seed category write fails");
      expect(await UserModel.countDocuments({})).toBe(0);

      // Retry: exactly one of each — the failed tx left no duplicates to trip
      // the unique indexes (email on User, userId+workspaceId on Membership).
      await register(
        { email: "f6-retry@example.com", password: "password123" },
        new MongoUserRepository(),
        accountRepo,
        categoryRepo,
        fakeHasher,
        objectIdGenerator,
        new MongoWorkspaceRepository(),
        new MongoMembershipRepository(),
        bootstrapper,
        new MongoUnitOfWork(),
      );
      expect(await UserModel.countDocuments({})).toBe(1);
      expect(await WorkspaceModel.countDocuments({})).toBe(1);
      expect(await MembershipModel.countDocuments({})).toBe(1);
      expect(await CategoryModel.countDocuments({})).toBe(8);
      const seededAccounts = await AccountModel.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(
          (await WorkspaceModel.findOne({}))._id,
        ),
      });
      expect(seededAccounts).toBe(1);
    }, 60_000);
  });
});
