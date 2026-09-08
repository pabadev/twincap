/**
 * R14-Fase O backup tool: read-only snapshot of a MongoDB database (Atlas M0)
 * into `backups/<yyyy-mm-dd-hhmmss>/` — one JSON array file per collection
 * plus a `manifest.json` with metadata and per-collection counts.
 *
 * Pure mongoose: no mongodump/mongosh and no external tools required.
 * SAFETY: this script NEVER writes to the source database. It only reads
 * collections and writes JSON files under the output directory. Any error
 * (missing MONGODB_URI, connection failure, collection read error) fails
 * loudly with a non-zero exit — nothing is silently skipped.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backup-atlas.mjs
 *   node --env-file=.env.local scripts/backup-atlas.mjs --source-db twincap
 *   node --env-file=.env.local scripts/backup-atlas.mjs --out backups/custom
 *
 * Never prints credentials or the full URI — only the host is recorded.
 */
import mongoose from "mongoose";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

/** Parse host + database name from a mongodb URI without printing credentials. */
function parseUri(uri) {
  const m = uri.match(
    /^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/]+?)(?:\/([^?]*))?(?:\?.*)?$/,
  );
  if (!m) {
    throw new Error("MONGODB_URI does not look like a mongodb connection string");
  }
  return { host: m[1], db: (m[2] ?? "").split("/").filter(Boolean).pop() };
}

const { host, db: uriDb } = parseUri(uri);

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined;
};

const sourceDb = argValue("--source-db") ?? uriDb;
if (!sourceDb) {
  console.error(
    "Could not infer the source database name from MONGODB_URI (no db name after the host). Pass --source-db <name> explicitly.",
  );
  process.exit(1);
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/**
 * Recursively converts BSON types into EJSON-lite marker objects:
 *   ObjectId -> { $oid: "<hex>" }, Date -> { $date: "<ISO>" }.
 * Plain values (strings, numbers, booleans, null) pass through unchanged.
 *
 * NOTE: this must run BEFORE JSON.stringify — JSON.stringify calls each
 * value's toJSON() first, and bson ObjectId/Date already convert themselves
 * to strings there, so a JSON replacer would never see the original type.
 */
function toEjsonValue(value) {
  if (value instanceof mongoose.Types.ObjectId) {
    return { $oid: value.toHexString() };
  }
  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map(toEjsonValue);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = toEjsonValue(v);
    }
    return out;
  }
  return value;
}

/**
 * JSON replacer that preserves BSON types as EJSON-lite markers:
 *   ObjectId -> { $oid: "<hex>" }, Date -> { $date: "<ISO>" }.
 * Plain strings/numbers/booleans stay untouched. The paired reviver in
 * restore-atlas.mjs rebuilds the original types on read-back.
 *
 * NOTE: kept for reference/documentation; the active serialization path uses
 * toEjsonValue() BEFORE stringify (see writeFile below), because stringify's
 * toJSON() pass would degrade the types before this replacer ever saw them.
 */

const outDir = argValue("--out") ?? path.join("backups", timestamp());

console.log(`Backing up database '${sourceDb}' (host: ${host}) -> ${outDir}`);

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  await mkdir(outDir, { recursive: true });

  const collections = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith("system."))
    .sort();

  if (collections.length === 0) {
    console.warn(
      `No user collections found in '${sourceDb}' — manifest will be empty.`,
    );
  }

  const counts = [];
  let total = 0;

  for (const name of collections) {
    const docs = await db.collection(name).find({}).toArray();
    // Type-preserving serialization (EJSON-lite): ObjectId -> {$oid}, Date -> {$date}.
    // toEjsonValue runs BEFORE JSON.stringify because stringify calls each value's
    // toJSON() first (bson ObjectId/Date already stringify themselves there), which
    // would defeat a JSON replacer. Restored queries then match real ObjectId/Date.
    await writeFile(
      path.join(outDir, `${name}.json`),
      JSON.stringify(toEjsonValue(docs), null, 2),
    );
    counts.push({ collection: name, count: docs.length });
    total += docs.length;
    console.log(`  ${name}: ${docs.length} doc(s)`);
  }

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceDb,
    uriHost: host,
    counts,
  };
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("");
  console.log(`Source db:   ${sourceDb}`);
  console.log(`Collections: ${collections.length} (${total} total doc(s))`);
  console.log(`Output dir:  ${outDir}`);
  console.log("Backup complete.");
} catch (err) {
  console.error("backup-atlas failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}