/**
 * R14-Fase O restore-test tool: restores a backup directory (produced by
 * backup-atlas.mjs) into a NEW temporary database on the same cluster and
 * verifies per-collection document counts against the manifest.
 *
 * The source database is NEVER modified. Default target: <sourceDb>_restore_test.
 *
 * Usage:
 *   node --env-file=.env.local scripts/restore-atlas.mjs --dir backups/2026-09-07-143022
 *   node --env-file=.env.local scripts/restore-atlas.mjs --dir <dir> --target-db <name>
 *   node --env-file=.env.local scripts/restore-atlas.mjs --dir <dir> --target-db <name> --drop
 *   node --env-file=.env.local scripts/restore-atlas.mjs --dir <dir> --target-db <name> --drop --skip-restore
 *
 * Flags:
 *   --dir <dir>          Backup directory with manifest.json + <collection>.json (required)
 *   --target-db <name>   Target database. Default: <sourceDb>_restore_test from the manifest.
 *   --drop               Drop the target database before restoring (idempotent no-op if absent).
 *   --keep               Default behavior (target kept after restore) — accepted for clarity, no-op.
 *   --skip-restore       Cleanup-only mode: drop the target database and exit. Requires --drop.
 *
 * SAFETY (absolute):
 *   - The target database name can NEVER equal the manifest's source database (abort).
 *   - No collection of the source database is ever modified.
 *   - If the target database already exists and --drop is NOT passed, the script refuses.
 */
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import path from "node:path";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

/**
 * JSON reviver paired with backup-atlas.mjs's typePreservingReplacer:
 * rebuilds ObjectId ({ $oid }) and Date ({ $date }) markers into real BSON
 * types so restored documents match what the app queries with.
 */
function typePreservingReviver(_key, value) {
  if (value && typeof value === "object") {
    if (typeof value.$oid === "string") {
      return new mongoose.Types.ObjectId(value.$oid);
    }
    if (typeof value.$date === "string") {
      return new Date(value.$date);
    }
  }
  return value;
}

const dir = argValue("--dir");
if (!dir) {
  console.error("--dir <backupdir> is required (directory containing manifest.json)");
  process.exit(1);
}

const drop = args.includes("--drop");
const skipRestore = args.includes("--skip-restore");
// --keep is the default behavior; accepted explicitly for clarity, no-op.

if (skipRestore && !drop) {
  console.error(
    "--skip-restore requires --drop (cleanup-only mode drops the target database).",
  );
  process.exit(1);
}

// --- Load and validate the manifest (local file; nothing connected yet) --------
let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
} catch (err) {
  console.error(
    `restore-atlas failed: cannot read ${path.join(dir, "manifest.json")}: ${err?.message ?? err}`,
  );
  process.exit(1);
}

const sourceDb = manifest.sourceDb;
if (typeof sourceDb !== "string" || !Array.isArray(manifest.counts)) {
  console.error(
    "restore-atlas failed: manifest.json is malformed (expected sourceDb + counts[]).",
  );
  process.exit(1);
}

const targetDb = argValue("--target-db") ?? `${sourceDb}_restore_test`;

if (targetDb === sourceDb) {
  console.error(
    `SAFETY ABORT: target database name equals the source database ('${sourceDb}'). ` +
      "The restore script must never write into the source db.",
  );
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(uri);
    const target = mongoose.connection.useDb(targetDb, { noListener: true }).db;

    if (skipRestore) {
      await target.dropDatabase();
      console.log(`Cleanup complete: dropped target database '${targetDb}'.`);
      return;
    }

    // A database "exists" if it has at least one collection (MongoDB only
    // materializes a db once it holds data). Privilege-free existence check.
    const existing = await target.listCollections().toArray();
    if (existing.length > 0 && !drop) {
      console.error(
        `Target database '${targetDb}' already exists (${existing.length} collection(s)) and --drop was not passed. ` +
          "Refusing to overwrite. Re-run with --drop (drops ONLY the target) or pick a different --target-db.",
      );
      process.exitCode = 1;
      return;
    }

    if (drop) {
      await target.dropDatabase();
      console.log(`Dropped target database '${targetDb}'.`);
    }

    // --- Restore -----------------------------------------------------------------
    for (const { collection, count } of manifest.counts) {
      const docs = JSON.parse(
        await readFile(path.join(dir, `${collection}.json`), "utf8"),
        typePreservingReviver,
      );
      if (!Array.isArray(docs) || docs.length !== count) {
        throw new Error(
          `'${collection}.json' does not contain a JSON array of exactly ${count} docs`,
        );
      }
      await target.createCollection(collection);
      if (docs.length > 0) {
        await target.collection(collection).insertMany(docs, { ordered: false });
      }
      console.log(`  restored ${collection}: ${docs.length} doc(s)`);
    }

    // --- Verification (hard requirement) ------------------------------------------
    const restoredNames = new Set(
      (await target.listCollections().toArray()).map((c) => c.name),
    );
    let failed = false;

    console.log("\nVerification table:");
    console.log(
      `  ${"Collection".padEnd(24)} ${"manifest".padStart(10)} ${"restored".padStart(10)}  result`,
    );

    for (const { collection, count } of manifest.counts) {
      if (!restoredNames.has(collection)) {
        console.log(
          `  ${collection.padEnd(24)} ${String(count).padStart(10)} ${"-".padStart(10)}  MISSING`,
        );
        failed = true;
        continue;
      }
      const restored = await target.collection(collection).countDocuments();
      const ok = restored === count;
      if (!ok) failed = true;
      console.log(
        `  ${collection.padEnd(24)} ${String(count).padStart(10)} ${String(restored).padStart(10)}  ${ok ? "PASS" : "FAIL"}`,
      );
    }

    if (failed) {
      console.error(
        "\nVERIFICATION FAILED — restored counts do not match the manifest. Do not trust this restore.",
      );
      process.exitCode = 1;
      return;
    }

    // --- Spot checks (best-effort, informational) ----------------------------------
    for (const name of ["users", "workspaces", "movements"]) {
      const entry = manifest.counts.find((c) => c.collection === name);
      if (!entry) continue;
      const count = await target.collection(name).countDocuments();
      const expectation =
        entry.count > 0 ? "> 0 confirmed" : "0 (empty in backup)";
      console.log(`  spot check ${name}: ${count} doc(s) — ${expectation}`);
    }

    const totalDocs = manifest.counts.reduce((acc, c) => acc + c.count, 0);
    console.log("");
    console.log(
      `RESTORE PASSED — '${targetDb}' (${manifest.counts.length} collection(s), ${totalDocs} doc(s)).`,
    );
    console.log("The restored database is available for an app-level check.");
    console.log(
      `Drop it with: node --env-file=.env.local scripts/restore-atlas.mjs --dir "${dir}" --target-db ${targetDb} --drop --skip-restore`,
    );
    console.log("Source database was NOT modified.");
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error("restore-atlas failed:", err?.message ?? err);
  process.exitCode = 1;
});