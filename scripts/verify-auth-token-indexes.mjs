/**
 * R15.3.2 P2-3 infrastructure contract check: verify the AUTH-TOKEN indexes
 * exist on the authtokens collection with the exact expected properties.
 *
 * Expected contract (declared in `src/infrastructure/models/auth-token.ts:42-56`):
 *   authtokens ── userId_1_purpose_1_createdAt_-1  { userId: 1, purpose: 1, createdAt: -1 }
 *   authtokens ── userId_1_purpose_1    partial UNIQUE { userId: 1, purpose: 1 }
 *                 (partialFilterExpression: { used: false })
 *   authtokens ── expiresAt_1           TTL { expiresAt: 1 }, expireAfterSeconds: 0
 *
 * The partial unique index is what makes the R15.3.2 P2-3 invariant
 * (ONE active token per (userId, purpose)) ENFORCED at the database level:
 * only used:false tokens compete for uniqueness, consume()'s used:true flip
 * frees the slot, and concurrent creates resolve via E11000 → revoke-retry
 * (newest wins) — `auth-token-repository.ts`. The compound backs the
 * active-token lookup (newest first); the TTL auto-expires tokens.
 *
 * Field-level `index: true` / `unique: true` declarations on the schema
 * (userId, purpose, tokenHash) are only materialized by Mongoose autoIndex
 * ON (local/dev); production runs with autoIndex OFF (R15.2-C1), so they are
 * NOT part of this contract.
 *
 * READ-ONLY: lists indexes only, never mutates. Exits 0 when the full
 * contract holds, 1 otherwise (missing/wrong-property index = FAIL, or an
 * index on the same key without the contract properties = FAIL).
 *
 * Usage:
 *   node scripts/verify-auth-token-indexes.mjs            # expects MONGODB_URI env
 *   node --env-file=.env.local scripts/verify-auth-token-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

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

function describe(idx) {
  const parts = [JSON.stringify(idx.key)];
  if (idx.unique) parts.push("unique");
  if (idx.partialFilterExpression) parts.push(`partial ${JSON.stringify(idx.partialFilterExpression)}`);
  if (idx.expireAfterSeconds !== undefined) parts.push(`TTL ${idx.expireAfterSeconds}s`);
  return parts.join(" ");
}

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

    for (const exp of CONTRACT.indexes) {
      const byProps = indexes.find((i) => propsMatch(i, exp));
      if (!byProps) {
        const sameKey = indexes.find((i) => keyMatches(i, exp));
        if (sameKey) {
          console.error(
            `[FAIL] '${sameKey.name}' is NOT a matching contract index (expected ${describe(exp)}, got key=${JSON.stringify(sameKey.key)}, unique=${!!sameKey.unique}, partial=${JSON.stringify(sameKey.partialFilterExpression ?? null)}, expireAfterSeconds=${sameKey.expireAfterSeconds}).`,
          );
        } else {
          console.error(`[FAIL] missing index '${exp.name}' — ${describe(exp)}.`);
        }
        failed = true;
      } else {
        console.log(`[PASS] '${byProps.name}' — ${describe(byProps)} (${exp.id})`);
      }
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT VIOLATED — fix indexes before deploy."
        : "CONTRACT OK — auth-token indexes verified on production."),
  );
} catch (err) {
  console.error("verify-auth-token-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;