import { UserModel } from "../models/user";
import { WorkspaceModel } from "../models/workspace";
import { MembershipModel } from "../models/membership";
import { AccountModel } from "../models/account";
import { CategoryModel } from "../models/category";
import { MovementModel } from "../models/movement";
import { TransferModel } from "../models/transfer";
import { CreditReceivedModel } from "../models/credit-received";
import { CreditGrantedModel } from "../models/credit-granted";
import { PayableModel } from "../models/payable";
import { ClientModel } from "../models/client";
import { CatalogItemModel } from "../models/catalog";
import { SaleModel } from "../models/sale";

export interface MigrateWorkspaceResult {
  workspacesCreated: number;
  membershipsCreated: number;
  tenantDocs: Record<string, { matched: number; modified: number }>;
}

/**
 * R13-F5 migration: backfill personal Workspaces + owner Memberships for every
 * EXISTING user, and migrate each financial document's tenant field from the
 * OLD `userId` to `workspaceId`.
 *
 * Option B (why the rename is trivial): each existing user gets exactly ONE
 * personal Workspace whose `_id` EQUALS the user's `_id`, and ONE owner
 * Membership with `workspaceId` = that same value. Because a personal
 * Workspace `_id` equals its owner's `userId`, renaming each financial
 * document's `userId` -> `workspaceId` is a plain field rename (the value
 * already IS the workspace id). No per-user mapping step is needed.
 *
 * Fully IDEMPOTENT — safe to re-run any number of times:
 *   - Workspaces/Memberships are upserted keyed on identity with $setOnInsert,
 *     so re-runs are no-ops.
 *   - The tenant field rename matches only docs that still have `userId` AND
 *     lack `workspaceId`; `$rename` is a value-preserving key change.
 *
 * Expects mongoose to already be connected (the runner owns connectDb()).
 */
export async function migrateWorkspace(): Promise<MigrateWorkspaceResult> {
  const users = await UserModel.find()
    .select("_id createdAt")
    .lean<Array<{ _id: import("mongoose").Types.ObjectId; createdAt?: Date }>>();

  let workspacesCreated = 0;
  let membershipsCreated = 0;

  for (const user of users) {
    // 1. Personal Workspace with _id === user._id.
    // NOTE: use the raw collection so Mongoose `timestamps` does not inject
    // `updatedAt` into $set and conflict with our own $setOnInsert timestamps.
    const ws = await WorkspaceModel.collection.updateOne(
      { _id: user._id },
      {
        $setOnInsert: {
          ownerId: user._id,
          name: "Mi espacio",
          status: "active",
          createdAt: user.createdAt ?? new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    workspacesCreated += ws.upsertedCount;

    // 2. Owner Membership scoped to that Workspace.
    const ms = await MembershipModel.collection.updateOne(
      { userId: user._id, workspaceId: user._id },
      {
        $setOnInsert: {
          role: "owner",
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    membershipsCreated += ms.upsertedCount;
  }

  // 3. Rename tenant field in all 10 financial collections (userId -> workspaceId).
  const MODELS = [
    AccountModel,
    CategoryModel,
    MovementModel,
    TransferModel,
    CreditReceivedModel,
    CreditGrantedModel,
    PayableModel,
    ClientModel,
    CatalogItemModel,
    SaleModel,
  ];

  const tenantDocs: MigrateWorkspaceResult["tenantDocs"] = {};

  // 3a. Drop every collection index whose key references `userId` BEFORE the
  //     rename. `$rename` changes the stored field but NOT index definitions:
  //     after the rename a `userId`-led index keeps keying on the now-missing
  //     field (every doc -> null), which (i) breaks multi-user/workspace unique
  //     compound indexes with an E11000 collision and (ii) leaves a stale index
  //     that shadows the new `workspaceId` scoping. Examples: a UNIQUE
  //     `userId_1_name_1_type_1` on categories, and any `userId` support index.
  for (const model of MODELS) {
    const indexes = await model.collection.indexes();
    for (const idx of indexes) {
      if (idx.name !== "_id_" && idx.key && Object.prototype.hasOwnProperty.call(idx.key, "userId") && idx.name) {
        await model.collection.dropIndex(idx.name);
      }
    }
  }

  // 3b. Rename the field. Use the raw collection (driver), NOT Mongoose's
  //     Model.updateMany: Mongoose strict mode strips `$rename` of the unknown
  //     legacy path `userId` (no longer part of the schema), silently no-oping
  //     the migration. The raw driver preserves the value and renames normally.
  for (const model of MODELS) {
    const r = await model.collection.updateMany(
      { userId: { $exists: true }, workspaceId: { $exists: false } },
      { $rename: { userId: "workspaceId" } },
    );
    tenantDocs[model.collection.name] = {
      matched: r.matchedCount,
      modified: r.modifiedCount,
    };
  }

  // 3c. Recreate the tenant-scoped unique constraint that the legacy index
  //     expressed. In this beta each workspace == one personal workspace whose
  //     `_id` equals the owner's `userId`, so `(workspaceId, name, type)` is the
  //     value-preserving equivalent of the old `(userId, name, type)` unique
  //     index on categories (one category with a given name+type per tenant).
  await CategoryModel.collection.createIndex(
    { workspaceId: 1, name: 1, type: 1 },
    { unique: true, name: "workspaceId_1_name_1_type_1", background: true },
  );

  return { workspacesCreated, membershipsCreated, tenantDocs };
}
