/**
 * R14-I infrastructure contract: materialize the DASHBOARD load-limit index
 * on the movements collection BEFORE the windowed reads go to production.
 *
 * Same pattern and guarantees as `ensure-monitor-indexes.mjs` (R14-G):
 * idempotent, non-destructive, dry-run by default, `--apply` to mutate,
 * never prints credentials.
 *
 *   movements ── workspace_date_createdAt  on { workspaceId: 1, date: -1, createdAt: -1 }
 *
 * This compound index supports the R14-I windowed dashboard read
 * (`findByWorkspaceIdAndDateRange`): equality on workspaceId + range on date
 * + exact sort. It is NOT a secondary optimization — without it the windowed
 * read falls back to a full collection scan sorted in memory.
 *
 * Behavior:
 *   - Creates ONLY the missing `workspace_date_createdAt` index above.
 *   - `createIndex` is idempotent by name+properties: an exact match is a
 *     no-op (never recreated pointlessly).
 *   - An existing index with the SAME NAME but DIFFERENT properties is a
 *     conflict → reported as FAIL, never silently mutated (fail-closed).
 *   - READ-ONLY in dry-run: prints exactly what apply would do.
 *
 * Usage:
 *   node scripts/ensure-dashboard-indexes.mjs              # dry-run
 *   node scripts/ensure-dashboard-indexes.mjs --apply      # mutate
 *   node --env-file=.env.local scripts/ensure-dashboard-indexes.mjs
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

const CONTRACT = {
  name: "movements",
  index: {
    name: "workspace_date_createdAt",
    key: { workspaceId: 1, date: -1, createdAt: -1 },
  },
};

let failed = false;

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const colName = CONTRACT.name;
  const exists = await db.listCollections({ name: colName }).hasNext();
  console.log(`\n== ${colName} ==`);
  console.log(`collection: ${exists ? "exists" : "MISSING"}`);

  if (!exists) {
    console.error(`  [FAIL] collection '${colName}' does not exist; nothing to index.`);
    failed = true;
  } else {
    const indexes = await db.collection(colName).indexes();
    const exp = CONTRACT.index;
    const idx = indexes.find((i) => i.name === exp.name);

    if (!idx) {
      if (APPLY) {
        await db.collection(colName).createIndex(exp.key, { name: exp.name });
        console.log(`  [APPLY] created index '${exp.name}' ${JSON.stringify(exp.key)}.`);
      } else {
        console.log(`  [dry-run] MISSING index '${exp.name}' ${JSON.stringify(exp.key)} — would create with --apply.`);
      }
    } else {
      // Index already exists: verify it matches the contract EXACTLY.
      const keyMatch =
        Object.keys(idx.key ?? {}).length === Object.keys(exp.key).length &&
        Object.entries(exp.key).every(([k, v]) => idx.key?.[k] === v);

      if (keyMatch) {
        console.log(`  [PASS] '${exp.name}' already exists and matches contract — no-op.`);
      } else {
        console.error(
          `  [FAIL] '${exp.name}' EXISTS with different properties (key=${JSON.stringify(idx.key)}) — refusing to mutate silently.`,
        );
        failed = true;
      }
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT CONFLICT — index exists with wrong properties; fix manually before applying."
        : APPLY
          ? "APPLY COMPLETE — contract materialized."
          : "DRY-RUN COMPLETE — no changes made. Re-run with --apply to materialize."),
  );
} catch (err) {
  console.error("ensure-dashboard-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;