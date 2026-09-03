import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel } from "../models/user";
import { WorkspaceModel } from "../models/workspace";
import type { WorkspaceDoc } from "../models/workspace";
import { MembershipModel } from "../models/membership";
import type { MembershipDoc } from "../models/membership";
import { AccountModel } from "../models/account";
import { MovementModel } from "../models/movement";
import { SaleModel } from "../models/sale";
import { migrateWorkspace } from "./migrate-workspace";

describe("migrateWorkspace", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri("twincap_migrations");
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    // Clean every collection touched by the migration + the seeded ones.
    await Promise.all([
      UserModel.deleteMany({}),
      WorkspaceModel.deleteMany({}),
      MembershipModel.deleteMany({}),
      AccountModel.deleteMany({}),
      MovementModel.deleteMany({}),
      SaleModel.deleteMany({}),
    ]);
  });

  async function seedLegacyUser(id?: Types.ObjectId) {
    // The user doc is created fresh; then financial docs are seeded with the
    // OLD `userId` field directly (the models now expect `workspaceId`).
    const user = await UserModel.create({
      _id: id ?? new Types.ObjectId(),
      email: "legacy@example.com",
      passwordHash: "x",
    });
    return user;
  }

  async function seedLegacyFinancialDocs(userId: Types.ObjectId) {
    // Insert with raw userId to emulate pre-migration production documents.
    await AccountModel.collection.insertOne({
      _id: new Types.ObjectId(),
      name: "Cuenta 1",
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await MovementModel.collection.insertOne({
      _id: new Types.ObjectId(),
      amount: 100,
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await SaleModel.collection.insertOne({
      _id: new Types.ObjectId(),
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  it("creates a personal workspace + owner membership and renames the tenant field", async () => {
    const user = await seedLegacyUser();
    await seedLegacyFinancialDocs(user._id);

    const result = await migrateWorkspace();

    expect(result.workspacesCreated).toBe(1);
    expect(result.membershipsCreated).toBe(1);

    // Workspace: _id === user._id and ownerId === user._id.
    const ws = (await WorkspaceModel.findById(user._id).lean()) as
      | (WorkspaceDoc & { _id: Types.ObjectId })
      | null;
    expect(ws).not.toBeNull();
    expect(ws!.ownerId.toString()).toBe(user._id.toString());
    expect(ws!.name).toBe("Mi espacio");
    expect(ws!.status).toBe("active");

    // Owner membership scoped to {userId, workspaceId} = user._id.
    const ms = (await MembershipModel.findOne({
      userId: user._id,
      workspaceId: user._id,
    }).lean()) as
      | (MembershipDoc & { _id: Types.ObjectId })
      | null;
    expect(ms).not.toBeNull();
    expect(ms!.role).toBe("owner");
    expect(ms!.status).toBe("active");

    // Tenant field renamed: workspaceId === old userId, no userId left.
    const account = await AccountModel.collection.findOne({});
    expect(account!.workspaceId.toString()).toBe(user._id.toString());
    expect(account!.userId).toBeUndefined();

    const movement = await MovementModel.collection.findOne({});
    expect(movement!.workspaceId.toString()).toBe(user._id.toString());
    expect(movement!.userId).toBeUndefined();

    const sale = await SaleModel.collection.findOne({});
    expect(sale!.workspaceId.toString()).toBe(user._id.toString());
    expect(sale!.userId).toBeUndefined();

    // tenantDocs reports all 10 financial collections, with our 3 matched.
    const renamedCollections = Object.keys(result.tenantDocs).filter(
      (c) => result.tenantDocs[c].matched > 0,
    );
    expect(renamedCollections.sort()).toEqual(["accounts", "movements", "sales"]);
    expect(result.tenantDocs["accounts"]).toEqual({ matched: 1, modified: 1 });
    expect(result.tenantDocs["movements"]).toEqual({ matched: 1, modified: 1 });
    expect(result.tenantDocs["sales"]).toEqual({ matched: 1, modified: 1 });
  });

  it("is idempotent — a second run is a no-op", async () => {
    const user = await seedLegacyUser();
    await seedLegacyFinancialDocs(user._id);

    await migrateWorkspace();

    const wsBefore = await WorkspaceModel.countDocuments({});
    const msBefore = await MembershipModel.countDocuments({});
    const accountBefore = await AccountModel.collection.findOne({});

    const result = await migrateWorkspace();

    expect(result.workspacesCreated).toBe(0);
    expect(result.membershipsCreated).toBe(0);

    // No re-rename: modified counts for every collection are 0.
    const allCollections = ["accounts", "movements", "sales"];
    for (const coll of allCollections) {
      expect(result.tenantDocs[coll].modified).toBe(0);
    }

    // Data unchanged.
    expect(await WorkspaceModel.countDocuments({})).toBe(wsBefore);
    expect(await MembershipModel.countDocuments({})).toBe(msBefore);
    const accountAfter = await AccountModel.collection.findOne({});
    expect(accountAfter!.workspaceId.toString()).toBe(accountBefore!.workspaceId.toString());
    expect(accountAfter!.userId).toBeUndefined();
  });

  it("handles users with no financial documents", async () => {
    await seedLegacyUser();

    const result = await migrateWorkspace();

    expect(result.workspacesCreated).toBe(1);
    expect(result.membershipsCreated).toBe(1);
    // No collection matched anything.
    expect(result.tenantDocs["accounts"]).toEqual({ matched: 0, modified: 0 });
  });
});
