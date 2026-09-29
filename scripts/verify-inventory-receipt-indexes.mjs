/** Read-only verification of inventory receipt history and payable indexes. */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const collectionName = "inventoryreceipts";
const expectedIndexes = [
  {
    name: "workspace_date_createdAt_id",
    key: { workspaceId: 1, date: -1, createdAt: -1, _id: -1 },
  },
  {
    name: "workspaceId_1_payableId_1",
    key: { workspaceId: 1, payableId: 1 },
    unique: true,
    partialFilterExpression: { payableId: { $type: "objectId" } },
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
    const indexes = await db.collection(collectionName).indexes();
    for (const expected of expectedIndexes) {
      const current = indexes.find((index) => index.name === expected.name);
      const matches =
        current &&
        Object.keys(current.key ?? {}).length === Object.keys(expected.key).length &&
        Object.entries(expected.key).every(([key, value]) => current.key[key] === value) &&
        Boolean(current.unique) === Boolean(expected.unique) &&
        JSON.stringify(current.partialFilterExpression ?? null) ===
          JSON.stringify(expected.partialFilterExpression ?? null);
      if (!matches) {
        console.error(`[FAIL] missing or mismatched '${expected.name}'.`);
        process.exitCode = 1;
      } else {
        console.log(`[PASS] '${expected.name}' — ${JSON.stringify(current.key)}`);
      }
    }
  }
} catch (error) {
  console.error("verify-inventory-receipt-indexes failed:", error?.message ?? error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
