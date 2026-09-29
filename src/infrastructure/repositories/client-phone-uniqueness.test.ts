import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Client } from "../../core/domain/client";
import { ConflictError } from "../../core/domain/errors";
import { ClientModel } from "../models/client";
import { objectIdGenerator } from "../config/id-generator";
import { MongoClientRepository } from "./client-repository";

describe("client phone uniqueness by workspace", () => {
  let mongod: MongoMemoryReplSet;
  const workspaceA = "aaaaaaaaaaaaaaaaaaaaaaaa";
  const workspaceB = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const phone = "+573001234567";

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({
      binary: { version: "7.0.41" },
      replSet: { count: 1, name: "rs0" },
    });
    await mongoose.connect(mongod.getUri("twincap_client_phone"));
    await ClientModel.syncIndexes();
  }, 60_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  }, 30_000);

  beforeEach(async () => {
    await ClientModel.deleteMany({});
  });

  it("allows the same phone in different workspaces", async () => {
    const repository = new MongoClientRepository();
    await Promise.all([
      repository.create(makeClient(workspaceA, phone)),
      repository.create(makeClient(workspaceB, phone)),
    ]);

    expect(await ClientModel.countDocuments({ phone })).toBe(2);
  });

  it("allows only one concurrent insert of a phone within one workspace", async () => {
    const repository = new MongoClientRepository();
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        repository.create(makeClient(workspaceA, phone, `Cliente ${index}`)),
      ),
    );

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(7);
    for (const result of rejected) {
      expect(result.reason).toBeInstanceOf(ConflictError);
    }
    expect(await ClientModel.countDocuments({ workspaceId: workspaceA, phone })).toBe(1);
  });

  function makeClient(workspaceId: string, clientPhone: string, name = "Cliente"): Client {
    return new Client({
      id: objectIdGenerator.generate(),
      workspaceId,
      name,
      phone: clientPhone,
      email: "",
      note: "",
      createdAt: new Date("2026-09-28T12:00:00.000Z"),
    });
  }
});
