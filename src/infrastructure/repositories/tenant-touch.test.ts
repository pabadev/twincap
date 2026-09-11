import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoCategoryRepository } from "../repositories/category-repository";
import { MongoClientRepository } from "../repositories/client-repository";
import { MongoAccountRepository } from "../repositories/account-repository";
import { MongoMovementRepository } from "../repositories/movement-repository";
import { MongoUnitOfWork } from "../transactions/mongo-unit-of-work";
import { CategoryModel } from "../models/category";
import { ClientModel } from "../models/client";
import { AccountModel } from "../models/account";
import { MovementModel } from "../models/movement";
import { objectIdGenerator } from "../config/id-generator";

/**
 * R15.3 §28 — workspace isolation of the R15.3-ADDED repository methods.
 *
 * P2 added `touch` / `findById(tx)` / `countByCategoryId(tx)` as
 * shared-document concurrency primitives. The danger this suite guards
 * against: "no permitas que una corrección de concurrencia elimine
 * accidentalmente un filtro workspaceId" — e.g. an updateOne that drops the
 * workspace filter while joining a session.
 *
 * Every test seeds docs in workspace A and an attacker workspace B (different
 * _id), then calls the new method with B's id/workspace INSIDE a real
 * transaction and asserts the operation cannot see, touch or count A's
 * documents.
 */
describe("R15.3 §28 — workspace isolation of new repo methods (real DB + real tx)", () => {
  let mongod: MongoMemoryReplSet;
  let uow: MongoUnitOfWork;

  const WS_A = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const WS_B = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const ACC_A = "cccccccccccccccccccccccc"; // A's account
  const CAT_A = "eeeeeeeeeeeeeeeeeeeeeeee"; // A's category
  const CLIENT_A = "111111111111111111111111";

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_tenant_touch"));
    await Promise.all([
      AccountModel.syncIndexes(),
      CategoryModel.syncIndexes(),
      ClientModel.syncIndexes(),
      MovementModel.syncIndexes(),
    ]);
    uow = new MongoUnitOfWork();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await AccountModel.deleteMany({});
    await CategoryModel.deleteMany({});
    await ClientModel.deleteMany({});
    await MovementModel.deleteMany({});
    // Tenant A data.
    await AccountModel.create({ _id: ACC_A, workspaceId: WS_A, name: "Cash", currency: "COP", isFixed: false });
    await CategoryModel.create({ _id: CAT_A, workspaceId: WS_A, name: "Food", type: "expense" });
    await ClientModel.create({ _id: CLIENT_A, workspaceId: WS_A, name: "Someone" });
    await MovementModel.create({
      workspaceId: WS_A,
      accountId: ACC_A,
      type: "income",
      amount: 10_000,
      signedAmount: 10_000,
      date: new Date("2025-06-01"),
      categoryId: CAT_A,
      link: { kind: "opening", refId: ACC_A, opId: objectIdGenerator.generate() },
    });
  });

  it("CategoryRepository.findById(tx) with workspace B does not resolve A's category", async () => {
    await uow.withTransaction(async (tx) => {
      const repo = new MongoCategoryRepository();
      expect(await repo.findById(WS_B, CAT_A, tx)).toBeNull();
      expect(await repo.findById(WS_A, CAT_A, tx)).not.toBeNull();
    });
  });

  it("CategoryRepository.touch with workspace B returns false (matchedCount 0, A's doc untouched)", async () => {
    await uow.withTransaction(async (tx) => {
      const repo = new MongoCategoryRepository();
      expect(await repo.touch(WS_B, CAT_A, tx)).toBe(false);
      expect(await repo.touch(WS_A, CAT_A, tx)).toBe(true);
    });
    const cat = (await CategoryModel.findById(CAT_A).lean()) as { updatedAt?: Date };
    expect(cat.updatedAt).toBeDefined();
  });

  it("ClientRepository.touch with workspace B returns false", async () => {
    await uow.withTransaction(async (tx) => {
      const repo = new MongoClientRepository();
      expect(await repo.touch(WS_B, CLIENT_A, tx)).toBe(false);
      expect(await repo.touch(WS_A, CLIENT_A, tx)).toBe(true);
    });
  });

  it("AccountRepository.touch with workspace B returns false", async () => {
    await uow.withTransaction(async (tx) => {
      const repo = new MongoAccountRepository();
      expect(await repo.touch(WS_B, ACC_A, tx)).toBe(false);
      expect(await repo.touch(WS_A, ACC_A, tx)).toBe(true);
    });
  });

  it("MovementRepository.countByCategoryId(tx) counts ZERO of A's movements when asked with workspace B", async () => {
    await uow.withTransaction(async (tx) => {
      const repo = new MongoMovementRepository();
      expect(await repo.countByCategoryId(WS_B, CAT_A, tx)).toBe(0);
      expect(await repo.countByCategoryId(WS_A, CAT_A, tx)).toBe(1);
    });
  });

  it("MovementRepository.countOpeningMovements(tx) is workspace-scoped too", async () => {
    await uow.withTransaction(async (tx) => {
      const repo = new MongoMovementRepository();
      expect(await repo.countOpeningMovements(WS_B, ACC_A, tx)).toBe(0);
      expect(await repo.countOpeningMovements(WS_A, ACC_A, tx)).toBe(1);
    });
  });
});