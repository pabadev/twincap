import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createCreditReceived } from "../../core/application/credits-received/create-credit-received";
import { createCreditGranted } from "../../core/application/credits-granted/create-credit-granted";
import { createPayable } from "../../core/application/payables/create-payable";
import { MongoCreditReceivedRepository } from "../repositories/credit-received-repository";
import { MongoCreditGrantedRepository } from "../repositories/credit-granted-repository";
import { MongoPayableRepository } from "../repositories/payable-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { objectIdGenerator } from "../config/id-generator";
import { MongoUnitOfWork } from "./mongo-unit-of-work";
import { AccountModel } from "../models/account";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { PayableModel } from "../models/payable";
import { MovementModel } from "../models/movement";

/**
 * R15 Fase 2 — real multi-document transaction (rollback) tests for the three
 * creation use cases that now run inside `uow.withTransaction`:
 *   createCreditReceived, createCreditGranted, createPayable.
 *
 * Shared single MongoMemoryReplSet (one mongod): the use cases are exercised
 * against the REAL repositories + REAL MongoUnitOfWork, and the committed
 * view is asserted through the models directly.
 *
 * Proves, for each use case:
 *   SUCCESS → both documents persist
 *   FAILURE → neither persists (full rollback)
 *   RETRY   → exactly one set, no duplicates
 *
 * NOTE on ids: the repos persist the entity-generated id as the real `_id`
 * (an ObjectId-typed field), so `objectIdGenerator` (valid 24-hex strings)
 * is required — a non-hex deterministic id fails the ObjectId cast.
 *
 * BINARY PIN (R15-F2, regla permanente para tests que arrancan mongod en
 * Windows): el binario mongod DEBE pinarse a 7.0.41. La versión LATEST
 * (8.2.6) crashea en Windows (exit 14, 0xC000001D en tcmalloc, ~1 min tras
 * arrancar; deja ghost reference que `stop()` no limpia). El pin se hereda
 * de R14-J `global-setup` (E2E). NO usar el default — usar el default hizo
 * que esta suite fallara intermitentemente con ECONNREFUSED a mitad del
 * archivo (mongod muerto) y "Cannot cleanup because instance.mongodProcess
 * is still defined" en afterAll.
 */
describe("R15 Fase 2 — use-case creation transactions (real rollback)", () => {
  let mongod: MongoMemoryReplSet;

  const WS = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const ACCOUNT_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

  const creditReceivedInput = {
    counterparty: "Juan",
    principal: 100_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date: new Date("2025-06-01"),
  };

  const creditGrantedInput = {
    counterparty: "Distribuidora",
    principal: 250_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date: new Date("2025-06-01"),
  };

  const payableWithPayment = {
    counterparty: "Proveedor",
    total: 300_000,
    initialPayment: 50_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date: new Date("2025-06-01"),
  };

  const payableWithoutPayment = {
    counterparty: "Proveedor",
    total: 300_000,
    currency: "COP" as const,
    accountId: ACCOUNT_ID,
    date: new Date("2025-06-01"),
  };

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_tx"));
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
    await CreditReceivedModel.deleteMany({});
    await CreditGrantedModel.deleteMany({});
    await PayableModel.deleteMany({});
    await MovementModel.deleteMany({});
  });

  describe("createCreditReceived", () => {
    it("commits both the credit and principal income movement on success", async () => {
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      expect(await CreditReceivedModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(credit.id).toMatch(/^[0-9a-f]{24}$/);
    });

    it("rolls back the credit when the movement write fails", async () => {
      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: principal movement write fails");
      });

      await expect(
        createCreditReceived(
          WS,
          creditReceivedInput,
          new MongoCreditReceivedRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: principal movement write fails");

      // Committed view: NOTHING survived the abort.
      expect(await CreditReceivedModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    });

    it("retries cleanly after a failed attempt — no duplicates", async () => {
      const movementRepo = new MongoMovementRepository();

      // Attempt 1: movement write fails → whole transaction rolls back.
      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: principal movement write fails");
      });
      await expect(
        createCreditReceived(
          WS,
          creditReceivedInput,
          new MongoCreditReceivedRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: principal movement write fails");
      expect(await CreditReceivedModel.countDocuments({ workspaceId: WS })).toBe(0);

      // Attempt 2 (retry): same inputs, same id generator → if anything had
      // leaked, counts would now be > 1. Verifies zero duplication.
      const credit = await createCreditReceived(
        WS,
        creditReceivedInput,
        new MongoCreditReceivedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(credit.id).toMatch(/^[0-9a-f]{24}$/);
      expect(await CreditReceivedModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    });
  });

  describe("createCreditGranted", () => {
    it("commits both the credit granted and principal expense movement on success", async () => {
      const credit = await createCreditGranted(
        WS,
        creditGrantedInput,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(credit.id).toMatch(/^[0-9a-f]{24}$/);
    });

    it("rolls back the credit granted when the movement write fails", async () => {
      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: principal expense write fails");
      });

      await expect(
        createCreditGranted(
          WS,
          creditGrantedInput,
          new MongoCreditGrantedRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: principal expense write fails");

      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    });

    it("retries cleanly after a failed attempt — no duplicates", async () => {
      const movementRepo = new MongoMovementRepository();

      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: principal expense write fails");
      });
      await expect(
        createCreditGranted(
          WS,
          creditGrantedInput,
          new MongoCreditGrantedRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: principal expense write fails");
      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(0);

      const credit = await createCreditGranted(
        WS,
        creditGrantedInput,
        new MongoCreditGrantedRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(credit.id).toMatch(/^[0-9a-f]{24}$/);
      expect(await CreditGrantedModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    });
  });

  describe("createPayable", () => {
    it("commits payable + initial-payment movement as ONE unit on success", async () => {
      const payable = await createPayable(
        WS,
        payableWithPayment,
        new MongoPayableRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );

      expect(await PayableModel.countDocuments({ workspaceId: WS })).toBe(1);
      // exactly ONE movement (the initial payment)
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(payable.id).toMatch(/^[0-9a-f]{24}$/);
    });

    it("rolls back the payable when the initial-payment movement fails", async () => {
      const movementRepo = new MongoMovementRepository();
      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: initial payment write fails");
      });

      await expect(
        createPayable(
          WS,
          payableWithPayment,
          new MongoPayableRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: initial payment write fails");

      // Both rolled back.
      expect(await PayableModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    });

    it("rolls back the payable when the payable write itself fails", async () => {
      const payableRepo = new MongoPayableRepository();
      vi.spyOn(payableRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: payable write fails");
      });

      await expect(
        createPayable(
          WS,
          payableWithoutPayment,
          payableRepo,
          new MongoMovementRepository(),
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: payable write fails");

      expect(await PayableModel.countDocuments({ workspaceId: WS })).toBe(0);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(0);
    });

    it("retries cleanly after a failed attempt — no duplicates", async () => {
      const movementRepo = new MongoMovementRepository();

      vi.spyOn(movementRepo, "create").mockImplementationOnce(async () => {
        throw new Error("boom: initial payment write fails");
      });
      await expect(
        createPayable(
          WS,
          payableWithPayment,
          new MongoPayableRepository(),
          movementRepo,
          objectIdGenerator,
          new MongoAccountRepository(),
          new MongoUnitOfWork(),
        ),
      ).rejects.toThrow("boom: initial payment write fails");
      expect(await PayableModel.countDocuments({ workspaceId: WS })).toBe(0);

      const payable = await createPayable(
        WS,
        payableWithPayment,
        new MongoPayableRepository(),
        new MongoMovementRepository(),
        objectIdGenerator,
        new MongoAccountRepository(),
        new MongoUnitOfWork(),
      );
      expect(payable.id).toMatch(/^[0-9a-f]{24}$/);
      expect(await PayableModel.countDocuments({ workspaceId: WS })).toBe(1);
      expect(await MovementModel.countDocuments({ workspaceId: WS })).toBe(1);
    });
  });
});