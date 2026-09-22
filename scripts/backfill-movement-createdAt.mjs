/**
 * Backfill missing `createdAt` on legacy Movement documents.
 *
 * Root cause: early movement inserts predate the createdAt field; without it,
 * same-day sorting falls back to insertion order (non-deterministic across
 * restarts). ObjectId embeds a real timestamp (first 4 bytes), so
 * `_id.getTimestamp()` recovers the actual creation instant.
 *
 * Usage:
 *   MONGODB_URI="..." node scripts/backfill-movement-createdAt.mjs          # dry run
 *   MONGODB_URI="..." node scripts/backfill-movement-createdAt.mjs --apply  # write
 *
 * Dry run prints counts and a sample; --apply loops updateMany until 0 matches.
 * Fail-closed: any error aborts with exit code 1.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const mode = apply ? "[APPLY]" : "[DRY RUN]";

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const movements = db.collection("movements");

  // Find docs where createdAt is missing or null
  const filter = {
    $or: [{ createdAt: { $exists: false } }, { createdAt: null }],
  };

  const count = await movements.countDocuments(filter);
  console.log(`${mode} Movement docs missing createdAt: ${count}`);

  if (count === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  // Sample up to 5 docs for visibility
  const sample = await movements
    .find(filter)
    .project({ _id: 1, date: 1, type: 1, accountId: 1 })
    .limit(5)
    .toArray();

  console.log(`${mode} Sample (up to 5):`);
  for (const doc of sample) {
    const ts = doc._id.getTimestamp();
    console.log(
      `  _id=${doc._id} date=${doc.date?.toISOString?.() ?? doc.date} type=${doc.type} accountId=${doc.accountId} recoveredCreatedAt=${ts.toISOString()}`,
    );
  }

  if (!apply) {
    console.log(`${mode} Re-run with --apply to write. No changes made.`);
    process.exit(0);
  }

  // Apply: loop until 0 matches (updateMany with filter, set createdAt from _id)
  let totalUpdated = 0;
  let pass = 0;
  while (true) {
    pass++;
    const docsToUpdate = await movements.find(filter).project({ _id: 1 }).limit(1000).toArray();

    if (docsToUpdate.length === 0) break;

    // Bulk write: one updateOne per doc (createdAt derived from its own _id)
    const bulkOps = docsToUpdate.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { createdAt: doc._id.getTimestamp() } },
      },
    }));

    const result = await movements.bulkWrite(bulkOps, { ordered: false });
    totalUpdated += result.modifiedCount;
    console.log(
      `${mode} Pass ${pass}: matched=${docsToUpdate.length} modified=${result.modifiedCount}`,
    );
  }

  console.log(
    `${mode} Backfill complete: ${totalUpdated} document(s) updated across ${pass} pass(es).`,
  );
} catch (err) {
  console.error("backfill-movement-createdAt failed:", err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
