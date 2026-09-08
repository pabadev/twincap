import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoUnitOfWork, sessionOf } from "./mongo-unit-of-work";

/**
 * R14-B: real multi-document transactions against an in-memory MongoDB
 * REPLICA SET. Multi-document transactions REQUIRE a replica set — a
 * standalone mongod rejects `startTransaction` with "Transaction numbers are
 * only allowed on a replica set member or mongos".
 *
 * WHY MongoMemoryReplSet (not MongoMemoryServer with instance.replSet):
 * verified empirically in the installed mongodb-memory-server-core@11.2.0
 * sources — `MongoMemoryServer` only FORWARDS `--replSet <name>` to mongod
 * and never issues `replSetInitiate`; only `MongoMemoryReplSet` runs the
 * initiate command and waits for a primary. So the repl-set class is the
 * only shape that actually produces a transaction-ready cluster.
 *
 * BINARY PIN: 7.0.41 (regla permanente en Windows — la LATEST 8.2.6
 * crashea ~1 min tras arrancar: exit 14, 0xC000001D en tcmalloc, ghost
 * reference que `stop()` no limpia). Heredado de R14-J `global-setup`.
 */
describe("MongoUnitOfWork", () => {
  let mongod: MongoMemoryReplSet;
  let col: ReturnType<typeof getProbeCollection>;

  /** Probe document shape: explicit string _id (avoids the default ObjectId typing). */
  interface TxProbeDoc {
    _id: string;
    n: number;
  }

  function getProbeCollection() {
    return mongoose.connection.db!.collection<TxProbeDoc>("tx_probe");
  }

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_tx"));
    col = getProbeCollection();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await col.deleteMany({});
  });

  it("aborts every write when one write fails (partial failure, §25-B)", async () => {
    const uow = new MongoUnitOfWork();
    await expect(
      uow.withTransaction(async (tx) => {
        await col.insertOne({ _id: "a", n: 1 }, { session: sessionOf(tx) });
        await col.insertOne({ _id: "b", n: 2 }, { session: sessionOf(tx) });
        throw new Error("boom later");
      }),
    ).rejects.toThrow("boom later");
    // Read OUTSIDE the transaction → committed view: nothing survived the abort.
    expect(await col.countDocuments({})).toBe(0);
  });

  it("commits every write on success", async () => {
    const uow = new MongoUnitOfWork();
    await uow.withTransaction(async (tx) => {
      await col.insertOne({ _id: "c", n: 3 }, { session: sessionOf(tx) });
      await col.insertOne({ _id: "d", n: 4 }, { session: sessionOf(tx) });
    });
    expect(await col.countDocuments({})).toBe(2);
  });

  it("propagates the failure without committing earlier writes", async () => {
    const uow = new MongoUnitOfWork();
    await expect(
      uow.withTransaction(async (tx) => {
        await col.insertOne({ _id: "e", n: 5 }, { session: sessionOf(tx) });
        await col.insertOne({ _id: "f", n: 6 }, { session: sessionOf(tx) });
        throw new Error("kaboom");
      }),
    ).rejects.toThrow("kaboom");
    expect(await col.countDocuments({})).toBe(0);

    // The error is NOT swallowed and the session is reusable: a fresh
    // transaction commits normally afterwards.
    await uow.withTransaction(async (tx) => {
      await col.insertOne({ _id: "g", n: 7 }, { session: sessionOf(tx) });
    });
    expect(await col.countDocuments({})).toBe(1);
  });
});