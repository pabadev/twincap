/**
 * R14-G infrastructure contract: materialize the SECURITY indexes of the
 * monitor route on the PRODUCTION cluster BEFORE the route receives traffic.
 *
 * Same pattern and guarantees as `migrate-rate-limit-unique-index.mjs`:
 * idempotent, non-destructive, dry-run by default, `--apply` to mutate,
 * never prints credentials. Deployment checklist P0 (auditor, 2026-09-07):
 *
 *   monitorfingerprints ── key_1       unique, on { key: 1 }
 *                       └─ expiresAt_1 TTL,   on { expiresAt: 1 }, expireAfterSeconds: 0
 *   monitorcooldowns   ── key_1       unique, on { key: 1 }
 *                       └─ expiresAt_1 TTL,   on { expiresAt: 1 }, expireAfterSeconds: 0
 *
 * Behavior:
 *   - Creates ONLY the two collections above (createCollection when missing).
 *   - Creates ONLY the four expected indexes with the exact contract
 *     properties. `createIndex` is idempotent by name+properties: an exact
 *     match is a no-op (never recreated pointlessly).
 *   - An existing index with the SAME NAME but DIFFERENT properties is a
 *     conflict → reported as FAIL, never silently mutated.
 *   - READ-ONLY in dry-run: prints exactly what apply would do.
 *
 * Usage:
 *   node scripts/ensure-monitor-indexes.mjs              # dry-run
 *   node scripts/ensure-monitor-indexes.mjs --apply     # mutate
 *   node --env-file=.env.local scripts/ensure-monitor-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const CONTRACT = [
  {
    name: "monitorfingerprints",
    indexes: [
      { name: "key_1", key: { key: 1 }, options: { unique: true } },
      { name: "expiresAt_1", key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
  {
    name: "monitorcooldowns",
    indexes: [
      { name: "key_1", key: { key: 1 }, options: { unique: true } },
      { name: "expiresAt_1", key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },
];

let failed = false;

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const spec of CONTRACT) {
    const colName = spec.name;
    const exists = await db.listCollections({ name: colName }).hasNext();
    console.log(`\n== ${colName} ==`);
    console.log(`collection: ${exists ? "exists" : "MISSING"}`);

    if (!exists && APPLY) {
      await db.createCollection(colName);
      console.log("  [APPLY] created collection.");
    } else if (!exists) {
      console.log("  [dry-run] would create collection.");
    }

    const indexes = exists || APPLY ? await db.collection(colName).indexes() : [];
    const indexNames = new Set(indexes.map((i) => i.name));

    for (const exp of spec.indexes) {
      if (!indexNames.has(exp.name)) {
        if (APPLY) {
          await db.collection(colName).createIndex(exp.key, { ...exp.options, name: exp.name });
          console.log(`  [APPLY] created index '${exp.name}' ${JSON.stringify(exp.key)}` +
            (exp.options.unique ? " unique" : "") +
            (exp.options.expireAfterSeconds !== undefined ? ` TTL ${exp.options.expireAfterSeconds}s` : "") +
            ".");
        } else {
          console.log(`  [dry-run] would create index '${exp.name}' ${JSON.stringify(exp.key)}` +
            (exp.options.unique ? " unique" : "") +
            (exp.options.expireAfterSeconds !== undefined ? ` TTL ${exp.options.expireAfterSeconds}s` : "") +
            ".");
        }
        continue;
      }

      // Index already exists: verify it matches the contract EXACTLY.
      const idx = indexes.find((i) => i.name === exp.name);
      const keyMatch =
        Object.keys(idx.key ?? {}).length === Object.keys(exp.key).length &&
        Object.entries(exp.key).every(([k, v]) => idx.key?.[k] === v);
      const uniqueMatch = exp.options.unique === undefined || !!idx.unique === exp.options.unique;
      const ttlMatch =
        exp.options.expireAfterSeconds === undefined ||
        idx.expireAfterSeconds === exp.options.expireAfterSeconds;

      if (keyMatch && uniqueMatch && ttlMatch) {
        console.log(`  [PASS] '${exp.name}' already exists and matches contract — no-op.`);
      } else {
        console.error(
          `  [FAIL] '${exp.name}' EXISTS with different properties (key=${JSON.stringify(idx.key)}, unique=${idx.unique}, expireAfterSeconds=${idx.expireAfterSeconds}) — refusing to mutate silently.`,
        );
        failed = true;
      }
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT CONFLICT — index(es) exist with wrong properties; fix manually before applying."
        : APPLY
          ? "APPLY COMPLETE — contract materialized."
          : "DRY-RUN COMPLETE — no changes made. Re-run with --apply to materialize."),
  );
} catch (err) {
  console.error("ensure-monitor-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;