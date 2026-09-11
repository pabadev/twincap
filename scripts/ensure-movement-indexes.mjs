/**
 * R15.2 C1 infrastructure contract: materialize the MOVEMENT indexes on the
 * movements collection BEFORE system-linked movements go to production.
 *
 * Same pattern and guarantees as `ensure-dashboard-indexes.mjs` (R14-I):
 * idempotent, non-destructive, dry-run by default, `--apply` to mutate,
 * never prints credentials.
 *
 * Contract:
 *   movements ── link.opId_1            partial UNIQUE { "link.opId": 1 }          (MOV-5)
 *                 (partialFilterExpression: { "link.opId": { $exists: true } })
 *   movements ── workspaceId_1_accountId_1  partial UNIQUE { workspaceId: 1, accountId: 1 }   (R15.3 §4 / ACC-2)
 *                 (partialFilterExpression: { "link.kind": { $eq: "opening" } })
 *
 * MOV-5 is the idempotent-replay guarantee for system-generated movements:
 * the opId is the deterministic link between a movement and its financial
 * origin (sale, credit, transfer...). The partial unique index ENFORCES that
 * no two movements can ever carry the same opId, so a replayed/re-driven
 * financial event cannot double-register its movements on the ledger.
 *
 * The R15.3 §4 index enforces ACC-2: an account holds EXACTLY 0 or 1
 * 'opening' movements (initial balances). The use-case guard
 * (MovementRepository.countOpeningMovements inside the transaction) is the
 * transactional first line; this index is the enforcement backstop that makes
 * a double-registration IMPOSSIBLE even for paths that skip the guard.
 *
 * The dashboard compound index `workspace_date_createdAt` is NOT re-declared
 * here: it is already materialized by `ensure-dashboard-indexes.mjs` (R14-I,
 * same name+key contract). This script VERIFIES it read-only and points the
 * operator to the owning script when it is missing — creating the same index
 * from two places would split the contract, so the check is enough.
 *
 * Behavior:
 *   - Creates ONLY the missing `link.opId_1` and `workspaceId_1_accountId_1`
 *     (opening) partial unique indexes above.
 *   - `createIndex` is idempotent by name+properties: an exact match is a
 *     no-op (never recreated pointlessly).
 *   - An index with the SAME KEY but without the unique/partial properties is
 *     a conflict → reported as FAIL, never silently mutated (fail-closed).
 *   - READ-ONLY in dry-run: prints exactly what apply would do.
 *
 * Usage:
 *   node scripts/ensure-movement-indexes.mjs              # dry-run
 *   node scripts/ensure-movement-indexes.mjs --apply      # mutate
 *   node --env-file=.env.local scripts/ensure-movement-indexes.mjs
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

// MOV-5 partial unique on link.opId. The Mongoose schema does not assign an
// explicit name, so MongoDB's default generated name (`link.opId_1`) is the
// contract name. Matching by key+unique+partial is also accepted because the
// generated name is deterministic per driver version.
const MOV5 = {
  name: "movements",
  index: {
    name: "link.opId_1",
    key: { "link.opId": 1 },
    unique: true,
    partialFilterExpression: { "link.opId": { $exists: true } },
  },
};

// R14-I dashboard compound — OWNED by ensure-dashboard-indexes.mjs:
// verified here (read-only), never created from this script.
const DASHBOARD = {
  name: "movements",
  index: {
    name: "workspace_date_createdAt",
    key: { workspaceId: 1, date: -1, createdAt: -1 },
  },
};

// R15.3 §4 (ACC-2) partial unique on opening movements — created here. The
// Mongoose schema does not assign an explicit name, so MongoDB's default
// generated name (`workspaceId_1_accountId_1`) is the contract name; matching
// by key+unique+partial is accepted too (generated names are deterministic
// per driver version).
const OPENING = {
  name: "movements",
  index: {
    name: "workspaceId_1_accountId_1",
    key: { workspaceId: 1, accountId: 1 },
    unique: true,
    partialFilterExpression: { "link.kind": { $eq: "opening" } },
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

function openingMatches(idx) {
  if (!idx) return false;
  const key =
    Object.keys(idx.key ?? {}).length === 2 &&
    idx.key?.workspaceId === 1 &&
    idx.key?.accountId === 1;
  if (!key || !idx.unique) return false;
  const partial = idx.partialFilterExpression ?? {};
  return JSON.stringify(partial) === JSON.stringify(OPENING.index.partialFilterExpression);
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const colName = MOV5.name;
  const exists = await db.listCollections({ name: colName }).hasNext();
  console.log(`\n== ${colName} ==`);
  console.log(`collection: ${exists ? "exists" : "MISSING"}`);

  if (!exists) {
    console.error(
      `  [FAIL] collection '${colName}' does not exist; nothing to index.`,
    );
    failed = true;
  } else {
    const indexes = await db.collection(colName).indexes();

    // ── MOV-5 partial unique (created here) ──────────────────────────
    const byName = indexes.find((i) => i.name === MOV5.index.name);
    const byProps = indexes.find(mov5Matches);

    if (byProps) {
      if (byName) {
        console.log(
          `  [PASS] '${MOV5.index.name}' partial unique on link.opId already exists and matches contract — no-op.`,
        );
      } else {
        console.log(
          `  [PASS] partial unique on link.opId already exists (name '${byProps.name}' from driver-generated naming) and matches contract — no-op.`,
        );
      }
    } else if (byName) {
      console.error(
        `  [FAIL] '${MOV5.index.name}' EXISTS but is NOT a partial unique matching the contract (key=${JSON.stringify(byName.key)}, unique=${!!byName.unique}, partial=${JSON.stringify(byName.partialFilterExpression ?? null)}) — refusing to mutate silently.`,
      );
      failed = true;
    } else {
      // No candidate: also fail-closed if a NON-unique index on the same key
      // exists (an index that only looks unique by name would break MOV-5's
      // enforcement promise once enforce=true).
      const sameKey = indexes.find(
        (i) => Object.keys(i.key ?? {}).length === 1 && i.key?.["link.opId"] === 1,
      );
      if (sameKey) {
        console.error(
          `  [FAIL] an index on link.opId EXISTS without the unique+partial contract (name='${sameKey.name}', unique=${!!sameKey.unique}) — refusing to mutate silently.`,
        );
        failed = true;
      } else if (APPLY) {
        await db.collection(colName).createIndex(MOV5.index.key, {
          name: MOV5.index.name,
          unique: true,
          partialFilterExpression: MOV5.index.partialFilterExpression,
        });
        console.log(
          `  [APPLY] created index '${MOV5.index.name}' ${JSON.stringify(MOV5.index.key)} unique+partial.`,
        );
      } else {
        console.log(
          `  [dry-run] MISSING index '${MOV5.index.name}' ${JSON.stringify(MOV5.index.key)} unique+partial — would create with --apply.`,
        );
      }
    }

    // ── R15.3 §4 (ACC-2) opening partial unique (created here) ──────
    const opByName = indexes.find((i) => i.name === OPENING.index.name);
    const opByProps = indexes.find(openingMatches);

    if (opByProps) {
      if (opByName) {
        console.log(
          `  [PASS] '${OPENING.index.name}' partial unique on {workspaceId, accountId} (opening) already exists and matches contract — no-op.`,
        );
      } else {
        console.log(
          `  [PASS] partial unique on {workspaceId, accountId} (opening) already exists (name '${opByProps.name}' from driver-generated naming) and matches contract — no-op.`,
        );
      }
    } else if (opByName) {
      console.error(
        `  [FAIL] '${OPENING.index.name}' EXISTS but is NOT a partial unique matching the ACC-2 contract (unique=${!!opByName.unique}, partial=${JSON.stringify(opByName.partialFilterExpression ?? null)}) — refusing to mutate silently.`,
      );
      failed = true;
    } else {
      // Fail-closed if a NON-unique index on the same key exists (a
      // non-unique {workspaceId, accountId} would silently allow the
      // double-opening the contract forbids).
      const sameOpeningKey = indexes.find(
        (i) =>
          Object.keys(i.key ?? {}).length === 2 &&
          i.key?.workspaceId === 1 &&
          i.key?.accountId === 1,
      );
      if (sameOpeningKey) {
        console.error(
          `  [FAIL] an index on {workspaceId, accountId} EXISTS without the unique+partial opening contract (name='${sameOpeningKey.name}', unique=${!!sameOpeningKey.unique}) — refusing to mutate silently.`,
        );
        failed = true;
      } else if (APPLY) {
        await db.collection(colName).createIndex(OPENING.index.key, {
          name: OPENING.index.name,
          unique: true,
          partialFilterExpression: OPENING.index.partialFilterExpression,
        });
        console.log(
          `  [APPLY] created index '${OPENING.index.name}' ${JSON.stringify(OPENING.index.key)} unique+partial (opening).`,
        );
      } else {
        console.log(
          `  [dry-run] MISSING index '${OPENING.index.name}' ${JSON.stringify(OPENING.index.key)} unique+partial (opening) — would create with --apply.`,
        );
      }
    }

    // ── R14-I dashboard compound (owned elsewhere — verify only) ────
    const dashIdx = indexes.find((i) => i.name === DASHBOARD.index.name);
    const dashKeyMatch =
      !!dashIdx &&
      Object.keys(dashIdx.key ?? {}).length === Object.keys(DASHBOARD.index.key).length &&
      Object.entries(DASHBOARD.index.key).every(([k, v]) => dashIdx.key?.[k] === v);
    if (dashKeyMatch) {
      console.log(
        `  [PASS] '${DASHBOARD.index.name}' present (owned by ensure-dashboard-indexes.mjs) — verified, not touched.`,
      );
    } else {
      console.error(
        `  [FAIL] '${DASHBOARD.index.name}' missing or drifted — materialize it with: node scripts/ensure-dashboard-indexes.mjs --apply (NOT from this script).`,
      );
      failed = true;
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT CONFLICT — fix indexes manually before applying (dashboard compound lives in ensure-dashboard-indexes.mjs)."
        : APPLY
          ? "APPLY COMPLETE — MOV-5 + ACC-2 (opening) contracts materialized."
          : "DRY-RUN COMPLETE — no changes made. Re-run with --apply to materialize."),
  );
} catch (err) {
  console.error("ensure-movement-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;