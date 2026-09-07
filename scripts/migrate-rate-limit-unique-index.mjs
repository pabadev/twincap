/**
 * R14-C one-off migration: prepare the `ratelimits` collection for the
 * new unique index on `key`.
 *
 * The OLD rate limiter was non-atomic (`findOne` → `attempts++/save()` →
 * `create()`) and could leave multiple documents per `key` (sliding-window
 * races). The new schema declares `key: unique: true`, so Mongoose's
 * autoIndex/syncIndexes would fail with E11000 (duplicate key) or
 * IndexOptionsConflict (existing non-unique `key_1` from `index: true`)
 * on the next deploy.
 *
 * Migration steps (idempotent, each one only acts when needed):
 *   1. DEDUPE  — group by `key`, keep the document with the LATEST
 *      `windowStart` (the active window per the new fixed-window logic),
 *      delete every older duplicate for that key.
 *   2. INDEX   — drop the old non-unique `key_1` index if present, then
 *      create `{ key: 1 }` unique (+ keep the TTL index untouched).
 *
 * Dry-run by default; pass `--apply` to mutate. Never prints credentials.
 *
 * Usage:
 *   node scripts/migrate-rate-limit-unique-index.mjs              # dry-run
 *   node scripts/migrate-rate-limit-unique-index.mjs --apply     # mutate
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const COLLECTION = "ratelimits";

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection(COLLECTION);

  // ---- 1. DEDUPE ----------------------------------------------------------
  const dupes = await col
    .aggregate([
      { $group: { _id: "$key", count: { $sum: 1 }, maxWindowStart: { $max: "$windowStart" } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  if (dupes.length === 0) {
    console.log(`No duplicate keys in '${COLLECTION}'.`);
  } else {
    console.log(
      `Found ${dupes.length} key(s) with duplicates (${dupes.reduce((s, d) => s + d.count, 0)} docs total).`,
    );

    if (APPLY) {
      let removed = 0;
      for (const d of dupes) {
        // Delete every doc for this key EXCEPT the one with the max windowStart.
        const result = await col.deleteMany({
          key: d._id,
          windowStart: { $ne: d.maxWindowStart },
        });
        removed += result.deletedCount;
      }
      console.log(`Dedupe applied: ${removed} duplicate document(s) deleted.`);

      // Re-check: zero duplicate keys must remain.
      const remaining = await col
        .aggregate([
          { $group: { _id: "$key", count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
        ])
        .toArray();
      if (remaining.length > 0) {
        console.error(
          `Post-check FAILED: ${remaining.length} key(s) still duplicated after dedupe.`,
        );
        process.exitCode = 1;
      } else {
        console.log("Post-check OK: no duplicate keys remain.");
      }
    } else {
      console.log("Dry-run: no changes made. Re-run with --apply to mutate.");
    }
  }

  // ---- 2. INDEX -----------------------------------------------------------
  const indexes = await col.indexes();
  const keyIndex = indexes.find((i) => i.name === "key_1");
  const ttlIndex = indexes.find((i) => i.name === "expiresAt_1");

  console.log("Current indexes:", indexes.map((i) => i.name).join(", ") || "(none)");

  if (APPLY) {
    // Drop the old non-unique key index if it exists (it will conflict by name).
    if (keyIndex && keyIndex.unique !== true) {
      await col.dropIndex("key_1");
      console.log("Dropped old non-unique 'key_1' index.");
    } else if (keyIndex) {
      console.log("'key_1' already unique — nothing to drop.");
    }

    // Create the unique index (safe after dedupe) if not already present.
    const after = await col.indexes();
    const existingUnique = after.find((i) => i.name === "key_1");
    if (existingUnique?.unique === true) {
      console.log("'key_1' unique index already present.");
    } else {
      await col.createIndex({ key: 1 }, { unique: true });
      console.log("Created unique index on 'key'.");
    }

    if (ttlIndex) {
      console.log("TTL index 'expiresAt_1' preserved.");
    }
  } else {
    console.log(
      keyIndex?.unique === true
        ? "'key_1' is already unique."
        : "'key_1' is NOT unique yet (dry-run — will drop + recreate with --apply).",
    );
  }

  console.log(APPLY ? "Migration complete." : "Dry-run complete. Re-run with --apply to migrate.");
} catch (err) {
  console.error("migrate-rate-limit-unique-index failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}