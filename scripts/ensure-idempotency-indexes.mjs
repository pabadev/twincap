/**
 * R15.2 C1 infrastructure contract: materialize the IDEMPOTENCY indexes on
 * the idempotencies collection BEFORE server actions dedupe in production.
 *
 * Same pattern and guarantees as `ensure-dashboard-indexes.mjs` (R14-I):
 * idempotent, non-destructive, dry-run by default, `--apply` to mutate,
 * never prints credentials.
 *
 *   idempotencies ── userId_1_action_1_key_1  unique { userId, action, key }
 *   idempotencies ── createdAt_1              TTL { createdAt } 24h
 *
 * The unique compound is the dedupe guarantee: a duplicate Server Action
 * submission racing the same (userId, action, key) cannot insert twice
 * (idempotency key replay depends on ENFORCED uniqueness, not on application
 * checks). The TTL index auto-expires claims after 24h so the collection
 * cannot grow unbounded.
 *
 * Both indexes are declared with MongoDB's default generated names (the
 * Mongoose schema in `src/infrastructure/models/idempotency.ts` does not
 * assign explicit names), so the contract matches the auto-generated
 * `userId_1_action_1_key_1` / `createdAt_1`.
 *
 * Behavior:
 *   - Creates ONLY the missing indexes above.
 *   - `createIndex` is idempotent by name+properties: an exact match is a
 *     no-op (never recreated pointlessly).
 *   - An existing index with the SAME NAME but DIFFERENT properties is a
 *     conflict → reported as FAIL, never silently mutated (fail-closed).
 *   - READ-ONLY in dry-run: prints exactly what apply would do.
 *
 * Usage:
 *   node scripts/ensure-idempotency-indexes.mjs              # dry-run
 *   node scripts/ensure-idempotency-indexes.mjs --apply      # mutate
 *   node --env-file=.env.local scripts/ensure-idempotency-indexes.mjs
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
    const exp = contract.index;
    const exists = await db.listCollections({ name: colName }).hasNext();
    console.log(`\n== ${colName} ==`);
    console.log(`collection: ${exists ? "exists" : "MISSING"}`);

    if (!exists) {
      console.error(
        `  [FAIL] collection '${colName}' does not exist; nothing to index.`,
      );
      failed = true;
      continue;
    }

    const indexes = await db.collection(colName).indexes();
    const idx = indexes.find((i) => i.name === exp.name);

    if (!idx) {
      if (APPLY) {
        await db.collection(colName).createIndex(exp.key, {
          name: exp.name,
          ...(exp.unique !== undefined ? { unique: exp.unique } : {}),
          ...(exp.expireAfterSeconds !== undefined
            ? { expireAfterSeconds: exp.expireAfterSeconds }
            : {}),
        });
        console.log(
          `  [APPLY] created index '${exp.name}' ${JSON.stringify(exp.key)}.`,
        );
      } else {
        console.log(
          `  [dry-run] MISSING index '${exp.name}' ${JSON.stringify(exp.key)} — would create with --apply.`,
        );
      }
    } else if (propsMatch(idx, exp)) {
      console.log(
        `  [PASS] '${exp.name}' already exists and matches contract — no-op.`,
      );
    } else {
      console.error(
        `  [FAIL] '${exp.name}' EXISTS with different properties (key=${JSON.stringify(idx.key)}, unique=${!!idx.unique}, expireAfterSeconds=${idx.expireAfterSeconds}) — refusing to mutate silently.`,
      );
      failed = true;
    }
  }

  console.log(
    "\n" +
      (failed
        ? "CONTRACT CONFLICT — an index exists with wrong properties; fix manually before applying."
        : APPLY
          ? "APPLY COMPLETE — contract materialized."
          : "DRY-RUN COMPLETE — no changes made. Re-run with --apply to materialize."),
  );
} catch (err) {
  console.error("ensure-idempotency-indexes failed:", err?.message ?? err);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

process.exitCode = failed ? 1 : process.exitCode;