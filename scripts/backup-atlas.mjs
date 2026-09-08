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
    await writeFile(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
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