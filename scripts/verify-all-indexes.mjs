/**
 * Post-deploy orchestrator: run EVERY index-contract verifier in series and
 * report a single aggregate verdict.
 *
 * Covers the full production index contract, one script per domain:
 *   - dashboard  (verify-dashboard-indexes.mjs,  R14-I)
 *   - monitor    (verify-monitor-indexes.mjs,    R14-G)
 *   - movement   (verify-movement-indexes.mjs,   R15.2 C1 / R15.3 §4)
 *   - idempotency(verify-idempotency-indexes.mjs,R15.2 C1)
 *   - auth-token (verify-auth-token-indexes.mjs, R15.3.2 P2-3)
 *
 * READ-ONLY: each verifier is spawned as its OWN process via
 * `spawnSync(process.execPath, ...)` with the same env, so every contract
 * gets its own mongoose connect/disconnect — connections are never shared
 * across scripts. `--apply` is NEVER passed: this file cannot mutate Atlas.
 *
 * READ-ONLY: this script never mutates anything; any drift is reported as
 * FAIL and the process exits 1 (CONTRACT VIOLATED). To MATERIALIZE missing
 * indexes, run the owning `scripts/ensure-*-indexes.mjs --apply` first and
 * re-run this verifier.
 *
 * Usage:
 *   node scripts/verify-all-indexes.mjs               # expects MONGODB_URI env
 *   node --env-file=.env.local scripts/verify-all-indexes.mjs
 *
 * Never prints credentials or the full URI.
 */
import { spawnSync } from "node:child_process";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI environment variable is required");
  process.exit(1);
}

const VERIFIERS = [
  "scripts/verify-dashboard-indexes.mjs",
  "scripts/verify-monitor-indexes.mjs",
  "scripts/verify-movement-indexes.mjs",
  "scripts/verify-idempotency-indexes.mjs",
  "scripts/verify-auth-token-indexes.mjs",
];

let failed = 0;

for (const script of VERIFIERS) {
  console.log(`\n=== ${script} ===`);
  const res = spawnSync(process.execPath, [script], {
    env: process.env,
    stdio: "inherit",
  });
  if (res.error) {
    console.error(`[FAIL] ${script} — could not spawn: ${res.error.message}`);
    failed += 1;
  } else if (res.status === 0) {
    console.log(`[PASS] ${script}`);
  } else {
    console.error(
      `[FAIL] ${script} — exit code ${res.status ?? "unknown"} (see output above).`,
    );
    failed += 1;
  }
}

console.log(
  "\n" +
    (failed
      ? `CONTRACT VIOLATED — ${failed}/${VERIFIERS.length} contract(s) failed.`
      : "ALL CONTRACTS OK — every index contract verified on production."),
);

process.exitCode = failed ? 1 : process.exitCode;