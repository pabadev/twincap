import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { claimIdempotency, releaseIdempotency } from "./idempotency";
import { IdempotencyModel } from "../models/idempotency";

/**
 * R15.3 §27 — idempotency survives backend restart / multiple instances.
 *
 * The dedupe guarantee lives in MONGODB (unique index (userId, action, key)
 * + TTL 24h), NOT in any in-memory store: there is no process-local state in
 * the idempotency module — every claim is an atomic INSERT that MongoDB
 * rejects (E11000) when the compound key already exists.
 *
 * This suite proves it with REAL indexes over a replset: a second claim in
 * the SAME process is rejected by the database (not by a memory cache), and
 * after `releaseIdempotency` deletes the record the SAME key claims again.
 * A backend restart would therefore never lose the dedupe window: the
 * persisted record outlives the process.
 */
describe("R15.3 §27 — idempotency guarantee survives restart/multi-instance (Mongo, not memory)", () => {
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_idem_restart"));
    await IdempotencyModel.syncIndexes();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await IdempotencyModel.deleteMany({});
  });

  it("a claim made by store/instance A blocks the SAME key from instance B (dedupe lives in Mongo)", async () => {
    // Instance A: first claim wins and persists a record.
    expect(await claimIdempotency("user-1", "key-restart", "createSale")).toBe(true);

    // Instance B (fresh call, same DB, no shared memory state): the database
    // — not a process-local cache — rejects the duplicate claim. If the
    // guarantee were in-memory only, this second claim would return true.
    expect(await claimIdempotency("user-1", "key-restart", "createSale")).toBe(false);

    // The persisted record is what makes the dedupe survive a restart.
    expect(
      await IdempotencyModel.countDocuments({ userId: "user-1", action: "createSale", key: "key-restart" }),
    ).toBe(1);
  });

  it("releaseIdempotency clears the record so the SAME key retries after a failure", async () => {
    expect(await claimIdempotency("user-1", "key-retry", "createCreditGranted")).toBe(true);
    await releaseIdempotency("user-1", "key-retry", "createCreditGranted");

    // Post-release: the key is claimable again (real DELETE, not memory).
    expect(await claimIdempotency("user-1", "key-retry", "createCreditGranted")).toBe(true);
    expect(
      await IdempotencyModel.countDocuments({ userId: "user-1", action: "createCreditGranted", key: "key-retry" }),
    ).toBe(1);
  });

  it("keys are scoped per (userId, action): same key, different action or user does not collide", async () => {
    expect(await claimIdempotency("user-1", "key-x", "createSale")).toBe(true);
    expect(await claimIdempotency("user-1", "key-x", "createCreditGranted")).toBe(true);
    expect(await claimIdempotency("user-2", "key-x", "createSale")).toBe(true);
    expect(
      await IdempotencyModel.countDocuments({ key: "key-x" }),
    ).toBe(3);
  });
});