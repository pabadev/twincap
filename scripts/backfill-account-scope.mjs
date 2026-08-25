/**
 * D3 one-off backfill: set scope='Personal' on legacy account documents
 * created before the field existed (Ronda 3 · Fase 3).
 *
 * Idempotent and non-destructive: only documents where `scope` is missing
 * or null are touched; existing values are never overwritten. Safe to re-run.
 * The tested TypeScript twin of this logic lives in
 * src/infrastructure/migrations/backfill-account-scope.ts — keep both in sync.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/backfill-account-scope.mjs
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  const filter = { $or: [{ scope: { $exists: false } }, { scope: null }] };
  const result = await mongoose.connection
    .collection("accounts")
    .updateMany(filter, { $set: { scope: "Personal" } });
  console.log(
    `backfill-account-scope: matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
} catch (err) {
  console.error("backfill-account-scope failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
