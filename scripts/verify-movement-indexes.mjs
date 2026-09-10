/**
 * R15.2 C1 infrastructure contract check: verify the MOVEMENT indexes exist
 * on the movements collection with the exact expected properties.
 *
 * Expected contract:
 *   movements ── link.opId_1  partial UNIQUE { "link.opId": 1 }  (MOV-5)
 *                 (partialFilterExpression: { "link.opId": { $exists: true } })
 *   movements ── workspace_date_createdAt  { workspaceId, date: -1, createdAt: -1 }
 *                 (owned by ensure-dashboard-indexes.mjs, R14-I)
 *
 * MOV-5 is what makes system-generated movement replay idempotent at the
 * database level: the partition-filtered unique key on link.opId means a
 * re-driven financial event can never double-register its ledger movements.
 * The dashboard compound backs the windowed read; it is verified here too
 * (read-only) so one check covers the movements contracts that deploy needs.
 *
 * READ-ONLY: lists indexes only, never mutates. Exits 0 when the full
 * contract holds, 1 otherwise (missing/wrong-property index = FAIL, or an
 * index on the same key without the unique/partial properties = FAIL).
 *
 * Usage:
 *   node scripts/verify-movement-indexes.mjs            # expects MONGODB_URI env
 *   node --env-file=.env.local scripts/verify-movement-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const MOV5 = {
  name: "movements",
  index: {
    name: "link.opId_1",
    key: { "link.opId": 1 },
    unique: true,
    partialFilterExpression: { "link.opId": { $exists: true } },
  },
};

const DASHBOARD = {
  name: "movements",
  index: {
    name: "workspace_date_createdAt",
    key: { workspaceId: 1, date: -1, createdAt: -1 },
  },
};

let failed = false;

function mov5Matches(idx) {
  if (!idx) return false;
  const keyMatch =
    Object.keys(idx.key ?? {}).length === 1 && idx.key?.["link.opId"] === 1;
  if (!keyMatch || !idx.unique) return false;
  const partial = idx.partialFilterExpression ?? {};
  return JSON.stringify(partial) === JSON.stringify(MOV5.index.partialFilterExpression);
}

function dashMatches(idx) {
  if (!idx) return false;
  const keyMatch =
    Object.keys(idx.key ?? {}).length === Object.keys(DASHBOARD.index.key).length &&
    Object.entries(DASHBOARD.index.key).every(([k, v]) => idx.key?.[k] === v);
  return keyMatch;
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const colName = MOV5.name;
  const exists = await db.listCollections({ name: colName }).hasNext();
  if (!exists) {
    console.error(`[FAIL] collection '${colName}' does not exist on this cluster.`);
    failed = true;
  } else {
    const indexes = await db.collection(colName).indexes();
    console.log(`\n== ${colName} (${indexes.length} index(es)) ==`);

    // ── MOV-5 partial unique ─────────────────────────────────────────
    const byName = indexes.find((i) => i.name === MOV5.index.name);
    const byProps = indexes.find(mov5Matches);
    if (!byProps) {
      const sameKey = indexes.find(
        (i) => Object.keys(i.key ?? {}).length === 1 && i.key?.["link.opId"] === 1,
      );
      if (sameKey) {
        console.error(
          `[FAIL] link.opId index '${sameKey.name}' is NOT a partial unique matching the contract (unique=${!!sameKey.unique}, partial=${JSON.stringify(sameKey.partialFilterExpression ?? null)}).`,
        );
      } else {
        console.error(`[FAIL] missing partial unique index '${MOV5.index.name}'.`);
      }
      failed = true;
    } else {
      console.log(
        `[PASS] '${byName?.name ?? byProps.name}' — partial unique on ${JSON.stringify(MOV5.index.key)} (MOV-5)`,
      );
    }

    // ── R14-I dashboard compound (verify only) ───────────────────────
    const dashIdx = indexes.find(dashMatches);
    if (!dashIdx) {
      console.error(
        `[FAIL] missing index '${DASHBOARD.index.name}' — run verify-dashboard-indexes.mjs / ensure-dashboard-indexes.mjs (owner).`,
      );
      failed = true;
    } else {
      console.log(
        `[PASS] '${dashIdx.name}' — ${JSON.stringify(dashIdx.key)} (R14-I, owner: ensure-dashboard-indexes.mjs)`,
      );
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT VIOLATED — fix indexes before deploy."
        : "CONTRACT OK — movement indexes verified on production."),
  );
} catch (err) {
  console.error("verify-movement-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;