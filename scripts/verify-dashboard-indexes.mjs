/**
 * R14-I infrastructure contract check: verify the DASHBOARD load-limit index
 * exists on the movements collection with the exact expected properties.
 *
 * Expected contract:
 *   movements ── workspace_date_createdAt  on { workspaceId: 1, date: -1, createdAt: -1 }
 *
 * This compound index backs the R14-I windowed dashboard read
 * (`findByWorkspaceIdAndDateRange`): equality on workspaceId + range on date
 * + the exact sort used by the query. Without it, the read degrades to a
 * collection scan + in-memory sort as history grows.
 *
 * READ-ONLY: lists indexes only, never mutates. Exits 0 when the full
 * contract holds, 1 otherwise (missing/wrong-property index = FAIL, or a
 * silently-created DUPLICATE index with different properties = FAIL).
 *
 * Usage:
 *   node scripts/verify-dashboard-indexes.mjs            # expects MONGODB_URI env
 *   node --env-file=.env.local scripts/verify-dashboard-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

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
  if (!exists) {
    console.error(`[FAIL] collection '${colName}' does not exist on this cluster.`);
    failed = true;
  } else {
    const indexes = await db.collection(colName).indexes();
    console.log(`\n== ${colName} (${indexes.length} index(es)) ==`);

    const exp = CONTRACT.index;
    const idx = indexes.find((i) => i.name === exp.name);

    if (!idx) {
      console.error(`[FAIL] missing index '${exp.name}'.`);
      failed = true;
    } else {
      const keyMatches =
        Object.keys(idx.key ?? {}).length === Object.keys(exp.key).length &&
        Object.entries(exp.key).every(([k, v]) => idx.key?.[k] === v);

      if (!keyMatches) {
        console.error(
          `[FAIL] '${exp.name}' key mismatch: expected ${JSON.stringify(exp.key)}, got ${JSON.stringify(idx.key)}.`,
        );
        failed = true;
      } else {
        console.log(`[PASS] '${exp.name}' — ${JSON.stringify(idx.key)}`);
      }
    }
  }

  console.log("\n" + (failed ? "CONTRACT VIOLATED — fix indexes before deploy." : "CONTRACT OK — dashboard index verified on production."));
} catch (err) {
  console.error("verify-dashboard-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;