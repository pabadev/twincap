/**
 * R15.3.2 P2-3 infrastructure contract: materialize the AUTH-TOKEN indexes on
 * the authtokens collection BEFORE the one-active-per-(user,purpose)
 * invariant goes to production.
 *
 * Same pattern and guarantees as `ensure-movement-indexes.mjs` (R15.2 C1):
 * idempotent, non-destructive, dry-run by default, `--apply` to mutate,
 * never prints credentials.
 *
 * Contract (declared in `src/infrastructure/models/auth-token.ts:42-56`):
 *   authtokens ── userId_1_purpose_1_createdAt_-1  { userId: 1, purpose: 1, createdAt: -1 }
 *   authtokens ── userId_1_purpose_1    partial UNIQUE { userId: 1, purpose: 1 }
 *                 (partialFilterExpression: { used: false })
 *   authtokens ── expiresAt_1           TTL { expiresAt: 1 }, expireAfterSeconds: 0
 *
 * The partial unique index is the DB-level backstop of the R15.3.2 P2-3
 * invariant (ONE active token per (userId, purpose)): only active
 * (used:false) tokens compete for uniqueness, consume()'s used:true flip
 * frees the slot, and a concurrent create loser gets E11000 and retries the
 * revoke once (newest wins) — `auth-token-repository.ts`. The compound index
 * backs the active-token lookup (newest first); the TTL index auto-expires
 * tokens after `expiresAt`.
 *
 * Field-level `index: true` / `unique: true` declarations on the schema
 * (userId, purpose, tokenHash) are ONLY materialized when Mongoose autoIndex
 * is ON (local/dev). Production runs with autoIndex OFF (R15.2-C1), so those
 * single-field indexes are NOT part of this contract — this script creates
 * ONLY the three explicit indexes above.
 *
 * Behavior:
 *   - Collection 'authtokens' must EXIST: if it is missing this is a FAIL,
 *     the collection is NEVER created here (the app owns its creation).
 *   - Creates ONLY the missing indexes above. `createIndex` is idempotent by
 *     name+properties: an exact match is a no-op (never recreated
 *     pointlessly). Matching is done by KEY+unique+partial/TTL properties
 *     BEFORE by name (driver-generated names vary by driver version).
 *   - An index with the SAME KEY but WITHOUT the contract properties (e.g.
 *     { userId, purpose } non-unique, or a different partial filter) is a
 *     conflict → reported as FAIL, never silently mutated (fail-closed).
 *   - READ-ONLY in dry-run: prints exactly what apply would do.
 *
 * Usage:
 *   node scripts/ensure-auth-token-indexes.mjs              # dry-run
 *   node scripts/ensure-auth-token-indexes.mjs --apply      # mutate
 *   node --env-file=.env.local scripts/ensure-auth-token-indexes.mjs
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

// Collection name is Mongoose's default pluralization of the 'AuthToken'
// model (`AuthTokenModel.collection.name` === 'authtokens'); the schema
// declares no custom collection name. The Mongoose schema does not assign
// explicit index names either, so MongoDB's default generated names are the
// contract names; matching by key+unique+partial/TTL properties is also
// accepted because generated names are deterministic per driver version.
const CONTRACT = {
  name: "authtokens",
  indexes: [
    {
      id: "lookup",
      name: "userId_1_purpose_1_createdAt_-1",
      key: { userId: 1, purpose: 1, createdAt: -1 },
    },
    {
      id: "one-active",
      name: "userId_1_purpose_1",
      key: { userId: 1, purpose: 1 },
      unique: true,
      partialFilterExpression: { used: false },
    },
    {
      id: "ttl",
      name: "expiresAt_1",
      key: { expiresAt: 1 },
      expireAfterSeconds: 0,
    },
  ],
};

let failed = false;

function keyMatches(existing, expected) {
  const ek = existing.key ?? {};
  const kk = expected.key;
  return (
    Object.keys(ek).length === Object.keys(kk).length &&
    Object.entries(kk).every(([k, v]) => ek[k] === v)
  );
}

function propsMatch(existing, expected) {
  if (!keyMatches(existing, expected)) return false;
  if (!!existing.unique !== (expected.unique ?? false)) return false;
  const gotPartial = existing.partialFilterExpression ?? {};
  if (
    JSON.stringify(gotPartial) !==
    JSON.stringify(expected.partialFilterExpression ?? {})
  ) {
    return false;
  }
  const expTtl = expected.expireAfterSeconds;
  if (expTtl !== undefined && existing.expireAfterSeconds !== expTtl) return false;
  if (expTtl === undefined && existing.expireAfterSeconds !== undefined) return false;
  return true;
}

function describe(idx, exp) {
  const parts = [JSON.stringify(idx.key)];
  if (exp.unique) parts.push("unique");
  if (exp.partialFilterExpression) parts.push(`partial ${JSON.stringify(exp.partialFilterExpression)}`);
  if (exp.expireAfterSeconds !== undefined) parts.push(`TTL ${exp.expireAfterSeconds}s`);
  return parts.join(" ");
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const colName = CONTRACT.name;
  const exists = await db.listCollections({ name: colName }).hasNext();
  console.log(`\n== ${colName} ==`);
  console.log(`collection: ${exists ? "exists" : "MISSING"}`);

  if (!exists) {
    console.error(
      `  [FAIL] collection '${colName}' does not exist; nothing to index and it is NEVER created by this script.`,
    );
    failed = true;
  } else {
    const indexes = await db.collection(colName).indexes();

    for (const exp of CONTRACT.indexes) {
      const byName = indexes.find((i) => i.name === exp.name);
      const byProps = indexes.find((i) => propsMatch(i, exp));

      if (byProps) {
        if (byName) {
          console.log(
            `  [PASS] '${exp.name}' ${describe(exp, exp)} already exists and matches contract — no-op.`,
          );
        } else {
          console.log(
            `  [PASS] ${describe(exp, exp)} already exists (name '${byProps.name}' from driver-generated naming) and matches contract — no-op.`,
          );
        }
      } else if (byName) {
        console.error(
          `  [FAIL] '${exp.name}' EXISTS but does NOT match the contract (key=${JSON.stringify(byName.key)}, unique=${!!byName.unique}, partial=${JSON.stringify(byName.partialFilterExpression ?? null)}, expireAfterSeconds=${byName.expireAfterSeconds}) — refusing to mutate silently.`,
        );
        failed = true;
      } else {
        // Fail-closed: an index on the SAME KEY without the contract
        // properties (e.g. a non-unique { userId, purpose }) would silently
        // break the invariant this contract enforces.
        const sameKey = indexes.find((i) => keyMatches(i, exp));
        if (sameKey) {
          console.error(
            `  [FAIL] an index on ${JSON.stringify(exp.key)} EXISTS without the contract properties (name='${sameKey.name}', unique=${!!sameKey.unique}, partial=${JSON.stringify(sameKey.partialFilterExpression ?? null)}, expireAfterSeconds=${sameKey.expireAfterSeconds}) — refusing to mutate silently.`,
          );
          failed = true;
        } else if (APPLY) {
          const options = { name: exp.name };
          if (exp.unique) options.unique = true;
          if (exp.partialFilterExpression) options.partialFilterExpression = exp.partialFilterExpression;
          if (exp.expireAfterSeconds !== undefined) options.expireAfterSeconds = exp.expireAfterSeconds;
          await db.collection(colName).createIndex(exp.key, options);
          console.log(
            `  [APPLY] created index '${exp.name}' ${describe(exp, exp)}.`,
          );
        } else {
          console.log(
            `  [dry-run] MISSING index '${exp.name}' ${describe(exp, exp)} — would create with --apply.`,
          );
        }
      }
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT CONFLICT — fix indexes manually before applying."
        : APPLY
          ? "APPLY COMPLETE — auth-token contracts materialized."
          : "DRY-RUN COMPLETE — no changes made. Re-run with --apply to materialize."),
  );
} catch (err) {
  console.error("ensure-auth-token-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;