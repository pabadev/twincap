/**
 * Ensure the production indexes required by the MCP OAuth records.
 * Dry-run by default; pass --apply to create missing indexes. Never drops or
 * changes an existing index and never prints the MongoDB URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const VERIFY = process.argv.includes("--verify");
const contracts = [
  {
    collection: "mcpauthorizationgrants",
    indexes: [
      { name: "userId_1", key: { userId: 1 } },
      { name: "userId_1_status_1_consentedAt_-1", key: { userId: 1, status: 1, consentedAt: -1 } },
      { name: "userId_1_clientId_1_status_1", key: { userId: 1, clientId: 1, status: 1 } },
    ],
  },
  {
    collection: "mcpauthorizationtransactions",
    indexes: [
      { name: "transactionId_1", key: { transactionId: 1 }, unique: true },
      { name: "expiresAt_1", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ],
  },
  {
    collection: "mcpoauthcredentials",
    indexes: [
      { name: "tokenHash_1", key: { tokenHash: 1 }, unique: true },
      { name: "grantId_1", key: { grantId: 1 } },
      {
        name: "grantId_1_credentialType_1_status_1",
        key: { grantId: 1, credentialType: 1, status: 1 },
      },
      { name: "expiresAt_1", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
    ],
  },
  {
    collection: "mcpauditevents",
    indexes: [
      { name: "actorUserId_1_createdAt_-1", key: { actorUserId: 1, createdAt: -1 } },
      { name: "grantId_1_createdAt_-1", key: { grantId: 1, createdAt: -1 } },
    ],
  },
];

let failed = false;
try {
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB database was not selected");
  const collections = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name),
  );
  for (const contract of contracts) {
    console.log(`\n=== ${contract.collection} ===`);
    if (!collections.has(contract.collection)) {
      console.error(`[FAIL] collection missing; app must create it before index provisioning`);
      failed = true;
      continue;
    }
    const collection = db.collection(contract.collection);
    const existing = await collection.indexes();
    for (const expected of contract.indexes) {
      const sameKey = existing.find(
        (index) => JSON.stringify(index.key) === JSON.stringify(expected.key),
      );
      const valid =
        sameKey &&
        Boolean(sameKey.unique) === Boolean(expected.unique) &&
        sameKey.expireAfterSeconds === expected.expireAfterSeconds;
      if (valid) {
        console.log(`[PASS] ${expected.name}`);
      } else if (sameKey) {
        console.error(
          `[FAIL] conflicting index on ${JSON.stringify(expected.key)}; resolve manually`,
        );
        failed = true;
      } else if (existing.some((index) => index.name === expected.name)) {
        console.error(`[FAIL] index name ${expected.name} exists with a different key`);
        failed = true;
      } else if (APPLY) {
        await collection.createIndex(expected.key, {
          name: expected.name,
          ...(expected.unique ? { unique: true } : {}),
          ...(expected.expireAfterSeconds !== undefined
            ? { expireAfterSeconds: expected.expireAfterSeconds }
            : {}),
        });
        console.log(`[CREATED] ${expected.name}`);
      } else {
        console.log(`[MISSING] ${expected.name} — would create with --apply`);
        if (VERIFY) failed = true;
      }
    }
  }
} catch (error) {
  console.error(`MCP index check failed: ${error?.message ?? error}`);
  failed = true;
} finally {
  await mongoose.disconnect();
}
if (failed) process.exitCode = 1;
