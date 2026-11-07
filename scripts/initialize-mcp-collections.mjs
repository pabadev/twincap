/** Safely pre-create empty MCP collections before production index provisioning. */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const names = [
  "mcpauthorizationgrants",
  "mcpauthorizationtransactions",
  "mcpoauthcredentials",
  "mcpauditevents",
];
let failed = false;
try {
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB database was not selected");
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name),
  );
  for (const name of names) {
    if (existing.has(name)) {
      console.log(`[PASS] ${name} exists`);
    } else if (APPLY) {
      await db.createCollection(name);
      console.log(`[CREATED] ${name}`);
    } else {
      console.log(`[MISSING] ${name} — would create empty collection with --apply`);
    }
  }
} catch (error) {
  console.error(`MCP collection initialization failed: ${error?.message ?? error}`);
  failed = true;
} finally {
  await mongoose.disconnect();
}
if (failed) process.exitCode = 1;
