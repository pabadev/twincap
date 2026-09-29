/** Verify the workspace-scoped unique client phone index without reading data. */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const indexName = "workspaceId_1_phone_1_unique";
try {
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
  const db = mongoose.connection.db;
  const indexes = await db.collection("clients").indexes();
  const index = indexes.find((item) => item.name === indexName);
  if (!index) {
    console.error(`${indexName} is missing.`);
    process.exitCode = 1;
  } else if (
    JSON.stringify(index.key) !== JSON.stringify({ workspaceId: 1, phone: 1 }) ||
    index.unique !== true ||
    JSON.stringify(index.partialFilterExpression ?? {}) !== JSON.stringify({ phone: { $gt: "" } })
  ) {
    console.error(`${indexName} exists but does not match the required contract.`);
    process.exitCode = 1;
  } else {
    console.log(`${indexName} contract verified.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Index verification failed.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
