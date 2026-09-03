/**
 * R13-F5 one-off migration: backfill personal Workspaces + owner Memberships
 * for every existing user, and migrate each financial document's tenant field
 * from the OLD `userId` to `workspaceId`.
 *
 * Option B: each existing user gets exactly ONE personal Workspace whose `_id`
 * EQUALS the user's `_id`, and ONE owner Membership scoped to it. Because a
 * personal Workspace `_id` equals its owner's `userId`, renaming `userId` ->
 * `workspaceId` is a plain field rename (the value already IS the workspace id).
 *
 * Fully idempotent — safe to re-run any number of times:
 *   - Workspaces/Memberships are upserted keyed on identity ($setOnInsert), so
 *     re-runs are no-ops.
 *   - The rename matches only docs that still have `userId` AND lack
 *     `workspaceId`; `$rename` preserves the value.
 *
 * The testable/proven version of this logic lives in
 * `src/infrastructure/migrations/migrate-workspace.ts`. This runner mirrors it
 * with raw collections so it can be executed by plain Node (no tsx), matching
 * the other `scripts/*.mjs` one-off migrations.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/migrate-workspace.mjs
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

// Collection names (Mongoose default pluralization; keep in sync with models).
const FINANCIAL_COLLECTIONS = [
  "accounts",
  "categories",
  "movements",
  "transfers",
  "creditreceiveds",
  "creditgranteds",
  "payables",
  "clients",
  "catalogitems",
  "sales",
];

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  // 1-2. Backfill workspaces + memberships per user.
  const users = await db.collection("users").find({}, { projection: { _id: 1, createdAt: 1 } }).toArray();
  let workspacesCreated = 0;
  let membershipsCreated = 0;

  for (const user of users) {
    const ws = await db.collection("workspaces").updateOne(
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
    workspacesCreated += ws.upsertedCount ?? 0;

    const ms = await db.collection("memberships").updateOne(
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
    membershipsCreated += ms.upsertedCount ?? 0;
  }

  console.log(`workspaces created: ${workspacesCreated}`);
  console.log(`memberships created: ${membershipsCreated}`);

  // 3. Drop every collection index whose key references the legacy `userId`
  //    BEFORE the rename. `$rename` moves the stored field but NOT index
  //    definitions: after the rename a `userId`-led index keeps keying on the
  //    now-missing field (every doc -> null), which breaks multi-user/workspace
  //    UNIQUE compound indexes (E11000 collision) and leaves a stale index.
  //    The categories UNIQUE index `userId_1_name_1_type_1` is the case that
  //    bit the first production run (same-name+type across users became
  //    {userId:null, name, type} duplicates).
  for (const coll of FINANCIAL_COLLECTIONS) {
    const indexes = await db.collection(coll).listIndexes().toArray();
    for (const idx of indexes) {
      if (idx.name !== "_id_" && idx.key && Object.prototype.hasOwnProperty.call(idx.key, "userId")) {
        await db.collection(coll).dropIndex(idx.name);
        console.log(`dropped index ${idx.name} on ${coll}`);
      }
    }
  }

  // 4. Rename tenant field in all financial collections.
  for (const coll of FINANCIAL_COLLECTIONS) {
    const r = await db
      .collection(coll)
      .updateMany(
        { userId: { $exists: true }, workspaceId: { $exists: false } },
        { $rename: { userId: "workspaceId" } },
      );
    console.log(
      `${coll}: matched=${r.matchedCount} modified=${r.modifiedCount}`,
    );
  }

  // 5. Recreate the tenant-scoped UNIQUE constraint that the legacy categories
  //    index expressed: `(workspaceId, name, type)` is the value-preserving
  //    equivalent of `(userId, name, type)` in this beta (one workspace == one
  //    personal workspace whose _id equals the owner's userId).
  await db.collection("categories").createIndex(
    { workspaceId: 1, name: 1, type: 1 },
    { unique: true, name: "workspaceId_1_name_1_type_1", background: true },
  );
  console.log("created index workspaceId_1_name_1_type_1 on categories");
} catch (err) {
  console.error("migrate-workspace failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
