/**
 * Materialize/verify the tenant-scoped inventory receipt indexes.
 * Dry-run is the default; pass --apply to create or safely replace an index.
 *
 *   inventoryreceipts.workspace_date_createdAt_id
 *   { workspaceId: 1, date: -1, createdAt: -1, _id: -1 }
 *
 * The payable index is partial so multiple fully-paid receipts without a
 * payableId remain valid while each linked payable still has one receipt.
 * Never prints the database URI or credentials.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const collectionName = "inventoryreceipts";
const expectedIndexes = [
  {
    name: "workspace_date_createdAt_id",
    key: { workspaceId: 1, date: -1, createdAt: -1, _id: -1 },
    options: {},
  },
  {
    name: "workspaceId_1_payableId_1",
    key: { workspaceId: 1, payableId: 1 },
    options: {
      unique: true,
      partialFilterExpression: { payableId: { $type: "objectId" } },
    },
  },
];

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collectionExists = await db.listCollections({ name: collectionName }).hasNext();
  if (!collectionExists) {
    console.error(`[FAIL] collection '${collectionName}' does not exist.`);
    process.exitCode = 1;
  } else {
    for (const expected of expectedIndexes) {
      const indexes = await db.collection(collectionName).indexes();
      const current = indexes.find((index) => index.name === expected.name);
      const matches =
        current &&
        Object.keys(current.key ?? {}).length === Object.keys(expected.key).length &&
        Object.entries(expected.key).every(([key, value]) => current.key[key] === value) &&
        Boolean(current.unique) === Boolean(expected.options.unique) &&
        JSON.stringify(current.partialFilterExpression ?? null) ===
          JSON.stringify(expected.options.partialFilterExpression ?? null);
      if (matches) {
        console.log(`[PASS] '${expected.name}' already matches the contract.`);
        continue;
      }
      if (
        current &&
        (Object.keys(current.key ?? {}).length !== Object.keys(expected.key).length ||
          !Object.entries(expected.key).every(([key, value]) => current.key[key] === value))
      ) {
        console.error(
          `[FAIL] '${expected.name}' exists with an unexpected key; refusing to replace it.`,
        );
        process.exitCode = 1;
        continue;
      }
      if (!apply) {
        console.log(
          `[dry-run] '${expected.name}' is ${current ? "outdated" : "missing"}; run with --apply to reconcile it.`,
        );
        continue;
      }
      if (current) await db.collection(collectionName).dropIndex(expected.name);
      await db
        .collection(collectionName)
        .createIndex(expected.key, { name: expected.name, ...expected.options });
      console.log(`[APPLY] reconciled '${expected.name}'.`);
    }
  }
} catch (error) {
  console.error("ensure-inventory-receipt-indexes failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
