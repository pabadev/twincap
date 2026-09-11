import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose, { type Model } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MovementModel } from "./movement";
import { IdempotencyModel } from "./idempotency";
import { AccountModel } from "./account";
import { CategoryModel } from "./category";
import { ClientModel } from "./client";
import { TransferModel } from "./transfer";
import { SaleModel } from "./sale";
import { CreditReceivedModel } from "./credit-received";
import { CreditGrantedModel } from "./credit-granted";
import { PayableModel } from "./payable";

/**
 * R15.3 §26 — REAL index verification (not schema inspection).
 *
 * "No asumas que una constraint está funcionando simplemente porque existe en
 * un schema." This suite syncs the Mongoose-declared indexes onto a real
 * replset and reads back `collection.indexes()` to prove the critical
 * financial constraints are ENFORCED by MongoDB:
 *
 *   - Movement: partial UNIQUE (workspaceId, accountId) for `link.kind:
 *     'opening'` (R15.3 §4 / ACC-2 backstop) and partial UNIQUE on
 *     `link.opId` (MOV-5 replay dedupe).
 *   - Idempotency: UNIQUE (userId, action, key) + TTL 24h on createdAt
 *     (R15.3 §19/§20).
 *   - Financial repos: the workspaceId_1 index on every hot query path
 *     (movement, account, category, client, transfer, sale, credit*,
 *     payable) — every scoped findById/update/delete query uses it.
 *
 * CAS/versioning mechanism: the debt/transfer documents rely on Mongoose's
 * default `__v` version key (no `versionKey: false` on those schemas) bumped
 * by `runVersionedUpdate` / CAS `findOneAndUpdate`. `__v` is a plain
 * document field — it needs no index and lives in Mongo, so it survives
 * restart and multi-instance by construction (see cas-restart.test.ts).
 *
 * Deployment: these indexes are materialized by the `scripts/ensure-*.mjs`
 * family (`--apply` mutates, dry-run by default; run via
 * `node --env-file=.env.local scripts/ensure-<x>-indexes.mjs --apply` in the
 * deployment flow). This suite verifies the contract the scripts enforce.
 */

type IndexDoc = {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  expireAfterSeconds?: number;
  partialFilterExpression?: Record<string, unknown>;
};

async function indexesOf(model: Model<unknown>): Promise<{
  byName: Map<string, IndexDoc>;
  all: IndexDoc[];
}> {
  const all = (await model.collection.indexes()) as unknown as IndexDoc[];
  return { byName: new Map(all.map((i) => [i.name, i])), all };
}

describe("R15.3 §26 — financial indexes materialized on a real replset", () => {
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_indexes"));
    // syncIndexes materializes every schema-declared index (and is safe on a
    // fresh test cluster — no pre-existing production indexes to drop).
    await Promise.all([
      MovementModel.syncIndexes(),
      IdempotencyModel.syncIndexes(),
      AccountModel.syncIndexes(),
      CategoryModel.syncIndexes(),
      ClientModel.syncIndexes(),
      TransferModel.syncIndexes(),
      SaleModel.syncIndexes(),
      CreditReceivedModel.syncIndexes(),
      CreditGrantedModel.syncIndexes(),
      PayableModel.syncIndexes(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  describe("Movement — R15.3 §4 opening backstop + MOV-5 replay dedupe", () => {
    it("has a partial UNIQUE index on (workspaceId, accountId) for link.kind=opening", async () => {
      const { byName } = await indexesOf(MovementModel);
      const idx = byName.get("workspaceId_1_accountId_1");
      expect(idx, "workspaceId_1_accountId_1 index must exist").toBeDefined();
      expect(idx!.key).toEqual({ workspaceId: 1, accountId: 1 });
      expect(idx!.unique).toBe(true);
      // ACC-2: the partial filter must target ONLY opening movements — a
      // non-opening (workspaceId, accountId) pair must NOT be constrained.
      const partial = JSON.stringify(idx!.partialFilterExpression ?? {});
      expect(partial).toContain("opening");
    });

    it("has a partial UNIQUE index on link.opId (MOV-5 idempotent replay)", async () => {
      const { byName } = await indexesOf(MovementModel);
      const idx = byName.get("link.opId_1");
      expect(idx, "link.opId_1 index must exist").toBeDefined();
      expect(idx!.key).toEqual({ "link.opId": 1 });
      expect(idx!.unique).toBe(true);
      expect(JSON.stringify(idx!.partialFilterExpression ?? {})).toContain("opId");
    });

    it("has the workspace_date_createdAt compound (R14-I dashboard window)", async () => {
      const { byName } = await indexesOf(MovementModel);
      const idx = byName.get("workspace_date_createdAt");
      expect(idx).toBeDefined();
      expect(idx!.key).toEqual({ workspaceId: 1, date: -1, createdAt: -1 });
    });
  });

  describe("Idempotency — R15.3 §19 unique + §20 TTL", () => {
    it("has a UNIQUE index on (userId, action, key)", async () => {
      const { byName } = await indexesOf(IdempotencyModel);
      const idx = byName.get("userId_1_action_1_key_1");
      expect(idx, "userId_1_action_1_key_1 index must exist").toBeDefined();
      expect(idx!.key).toEqual({ userId: 1, action: 1, key: 1 });
      expect(idx!.unique).toBe(true);
    });

    it("has a TTL index on createdAt with expireAfterSeconds 24h", async () => {
      const { byName } = await indexesOf(IdempotencyModel);
      const idx = byName.get("createdAt_1");
      expect(idx, "createdAt_1 TTL index must exist").toBeDefined();
      expect(idx!.key).toEqual({ createdAt: 1 });
      expect(idx!.expireAfterSeconds).toBe(24 * 60 * 60);
    });
  });

  describe("Financial repos — workspaceId_1 on every hot query path", () => {
    it("movement, account, category, client, transfer, sale, credit-received, credit-granted, payable all carry workspaceId_1", async () => {
      const models: Array<{ name: string; model: Model<unknown> }> = [
        { name: "Movement", model: MovementModel },
        { name: "Account", model: AccountModel },
        { name: "Category", model: CategoryModel },
        { name: "Client", model: ClientModel },
        { name: "Transfer", model: TransferModel },
        { name: "Sale", model: SaleModel },
        { name: "CreditReceived", model: CreditReceivedModel },
        { name: "CreditGranted", model: CreditGrantedModel },
        { name: "Payable", model: PayableModel },
      ];
      for (const { name, model } of models) {
        const { byName } = await indexesOf(model);
        const idx = byName.get("workspaceId_1");
        expect(idx, `${name} must carry the workspaceId_1 index`).toBeDefined();
        expect(idx!.key).toEqual({ workspaceId: 1 });
      }
    });
  });
});