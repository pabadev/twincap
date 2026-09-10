/**
 * R15.2 C1 infrastructure contract check: verify the IDEMPOTENCY indexes
 * exist on the idempotencies collection with the exact expected properties.
 *
 * Expected contract:
 *   idempotencies ── userId_1_action_1_key_1  unique { userId, action, key }
 *   idempotencies ── createdAt_1              TTL { createdAt } 24h
 *
 * The unique compound is what makes idempotency-key replay ENFORCED at the
 * database level (R12 C1); the TTL keeps the collection bounded. If either
 * is missing or drifted, duplicate submissions stop deduping and claims
 * accumulate forever — so this check must pass BEFORE deploy.
 *
 * READ-ONLY: lists indexes only, never mutates. Exits 0 when the full
 * contract holds, 1 otherwise (missing/wrong-property index = FAIL).
 *
 * Usage:
 *   node scripts/verify-idempotency-indexes.mjs            # expects MONGODB_URI env
 *   node --env-file=.env.local scripts/verify-idempotency-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const CONTRACTS = [
  {
    name: "idempotencies",
    index: {
      name: "userId_1_action_1_key_1",
      key: { userId: 1, action: 1, key: 1 },
      unique: true,
    },
  },
  {
    name: "idempotencies",
    index: {
      name: "createdAt_1",
      key: { createdAt: 1 },
      expireAfterSeconds: 24 * 60 * 60,
    },
  },
];

let failed = false;

function propsMatch(existing, expected) {
  if (!existing) return false;
  const keyMatch =
    Object.keys(existing.key ?? {}).length === Object.keys(expected.key).length &&
    Object.entries(expected.key).every(([k, v]) => existing.key?.[k] === v);
  if (!keyMatch) return false;
  if (expected.unique !== undefined && !!existing.unique !== expected.unique) {
    return false;
  }
  if (
    expected.expireAfterSeconds !== undefined &&
    existing.expireAfterSeconds !== expected.expireAfterSeconds
  ) {
    return false;
  }
  return true;
}

try {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const contract of CONTRACTS) {
    const colName = contract.name;
    const exists = await db.listCollections({ name: colName }).hasNext();
    if (!exists) {
      console.error(`[FAIL] collection '${colName}' does not exist on this cluster.`);
      failed = true;
      continue;
    }

    const indexes = await db.collection(colName).indexes();
    console.log(`\n== ${colName} (${indexes.length} index(es)) ==`);

    const exp = contract.index;
    const idx = indexes.find((i) => i.name === exp.name);

    if (!idx) {
      console.error(`[FAIL] missing index '${exp.name}'.`);
      failed = true;
    } else if (!propsMatch(idx, exp)) {
      console.error(
        `[FAIL] '${exp.name}' mismatch: expected ${JSON.stringify(exp)}, got key=${JSON.stringify(idx.key)}, unique=${!!idx.unique}, expireAfterSeconds=${idx.expireAfterSeconds}.`,
      );
      failed = true;
    } else {
      console.log(`[PASS] '${exp.name}' — ${JSON.stringify(idx.key)}`);
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT VIOLATED — fix indexes before deploy."
        : "CONTRACT OK — idempotency indexes verified on production."),
  );
} catch (err) {
  console.error("verify-idempotency-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;