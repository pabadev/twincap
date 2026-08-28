/**
 * R5-E one-off migration: release legacy fixed Nequi accounts.
 *
 * The seed no longer creates a fixed Nequi account (R5-D4/R5-D5); existing
 * users keep their Nequi account, but it stops being fixed so it can be
 * renamed or deleted like any regular account.
 *
 * Idempotent and non-destructive: only updates where name === "Nequi" and
 * isFixed is true. Safe to re-run any number of times.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." node scripts/unfix-legacy-nequi.mjs
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const result = await db
    .collection("accounts")
    .updateMany(
      { name: "Nequi", isFixed: true },
      { $set: { isFixed: false } },
    );

  console.log(
    `legacy Nequi accounts unfixed: matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );
} catch (err) {
  console.error("unfix-legacy-nequi failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}