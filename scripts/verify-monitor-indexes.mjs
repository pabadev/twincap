/**
 * R14-G infrastructure contract check: verify the SECURITY indexes of the
 * monitor route exist on the PRODUCTION cluster with the exact expected
 * properties.
 *
 * These indexes are NOT a secondary optimization — the unique `key_1`
 * participates in the guarantee that two concurrent requests cannot create
 * two fingerprint buckets for the same IP/window (E11000 → retry), and the
 * TTL `expiresAt_1` is what makes window state disappear. Treating them as
 * deployment-day contract is the auditor's requirement (2026-09-07).
 *
 * Expected contract:
 *   monitorfingerprints ── key_1       unique, on { key: 1 }
 *                       └─ expiresAt_1 TTL,   on { expiresAt: 1 }, expireAfterSeconds: 0
 *   monitorcooldowns   ── key_1       unique, on { key: 1 }
 *                       └─ expiresAt_1 TTL,   on { expiresAt: 1 }, expireAfterSeconds: 0
 *
 * READ-ONLY: lists indexes only, never mutates. Exits 0 when the full
 * contract holds, 1 otherwise (missing/wrong-property index = FAIL).
 *
 * Usage:
 *   node scripts/verify-monitor-indexes.mjs            # expects MONGODB_URI env
 *   node --env-file=.env.local scripts/verify-monitor-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const COLLECTIONS = [
  {
    name: "monitorfingerprints",
    expected: [
      { name: "key_1", key: "key", unique: true },
      { name: "expiresAt_1", key: "expiresAt", expireAfterSeconds: 0 },
    ],
  },
  {
    name: "monitorcooldowns",
    expected: [
      { name: "key_1", key: "key", unique: true },
      { name: "expiresAt_1", key: "expiresAt", expireAfterSeconds: 0 },
    ],
  },
];

let failed = false;

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const spec of COLLECTIONS) {
    const colName = spec.name;
    const exists = await db.listCollections({ name: colName }).hasNext();
    if (!exists) {
      console.error(`[FAIL] collection '${colName}' does not exist on this cluster.`);
      failed = true;
      continue;
    }

    const indexes = await db.collection(colName).indexes();
    console.log(`\n== ${colName} (${indexes.length} index(es)) ==`);

    for (const exp of spec.expected) {
      const idx = indexes.find((i) => i.name === exp.name);
      if (!idx) {
        console.error(`[FAIL] missing index '${exp.name}'.`);
        failed = true;
        continue;
      }
      const keyFields = Object.keys(idx.key ?? {});
      const keyMatches = keyFields.length === 1 && keyFields[0] === exp.key;
      const directionOk = (idx.key ?? {})[exp.key] === 1;

      if (!keyMatches || !directionOk) {
        console.error(
          `[FAIL] '${exp.name}' key mismatch: expected { ${exp.key}: 1 }, got ${JSON.stringify(idx.key)}.`,
        );
        failed = true;
        continue;
      }
      if (exp.unique !== undefined && idx.unique !== exp.unique) {
        console.error(
          `[FAIL] '${exp.name}' unique=${idx.unique}, expected ${exp.unique}.`,
        );
        failed = true;
        continue;
      }
      if (exp.expireAfterSeconds !== undefined && idx.expireAfterSeconds !== exp.expireAfterSeconds) {
        console.error(
          `[FAIL] '${exp.name}' expireAfterSeconds=${idx.expireAfterSeconds}, expected ${exp.expireAfterSeconds}.`,
        );
        failed = true;
        continue;
      }
      console.log(`[PASS] '${exp.name}' — ${JSON.stringify(idx.key)}${
        exp.unique ? ", unique" : ""
      }${exp.expireAfterSeconds !== undefined ? `, TTL ${idx.expireAfterSeconds}s` : ""}`);
    }
  }

  console.log("\n" + (failed ? "CONTRACT VIOLATED — fix indexes before deploy." : "CONTRACT OK — security indexes verified on production."));
} catch (err) {
  console.error("verify-monitor-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;