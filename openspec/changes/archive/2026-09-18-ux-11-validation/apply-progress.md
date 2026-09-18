# SDD Apply-Progress — ux-11-validation

> topic_key: sdd/ux-11-validation/apply-progress · store: openspec · execution_mode: auto · delivery: single-pr with **size:exception APPROVED by founder (2026-09-18)** — ~1,300+ lines of docs/harness/evidence on one PR (recorded per session contract; realization 2,903 inserted lines / 14 files).
> Branch master · Strict TDD mode: EVIDENCE change — harness specs run RED→GREEN where written-then-run (U2 isolation spec + scan matrix); U3/U4/U5 deliverables are real gate/document output. All numbers below come from runs executed in the apply session (2026-09-18).

## Completed units

| Unit | Commit(s) | Evidence (focused + runtime) | Rollback |
|---|---|---|---|
| U1 dep | `130ae2b` | `pnpm exec tsc --noEmit` → 0 errors; `git status` only manifest pair; runtime N/A (dependency-only, no src change — NOT a vitest run per session contract) | `pnpm remove @axe-core/playwright` |
| U2 a11y harness + scan | `cbb72e3`, `af30be2` | Runtime: `node e2e/load-e2e-env.cjs test --config playwright.a11y.config.ts` → exit 0, 3 passed (5.1 min); 20/20 combos, 50 violation entries (4 distinct rules), 0 scan gaps; raw: `evidence/a11y-scan-raw.json` | `git rm -r e2e-a11y playwright.a11y.config.ts` |
| U3 gates + §47 | `13600ff` | tsc 0; lint 0 err/7 pre-existing warn; parity 4/4; build OK; `pnpm test` timeout 2,900,000 ms → 151 files / **1568 tests passed**, 1463.77 s; 13-item mapping in `evidence/gates-2026-09-18.md` (15-rows slip corrected) | revert commit (evidence files only) |
| U4 TTI | `5c2fd3b` | Harness verbatim (`git diff` empty); run exit 0, 9/9 samples, 2.8 min; cold-hero vs baseline: 375 +7.9%, 768 −15.1%, 1280 +1.2% → noise protocol not triggered; table in `evidence/tti-after-2026-09-18.md` | revert commit |
| U5 docs + report | `f91f473` | `pnpm parity` sanity pass; prettier-clean; report BLOCKED verdict + founder checklist; tasks.md 5.5 checkboxes | `git rm` 2 docs + revert openspec edits |

## Key real numbers

- **Suite:** 1568/1568 passed, 0 failures, 151 files, 24.4 min run.
- **TTI cold hero N1:** 2570 (375/3G), 1978 (768), 2298 (1280) ms — all < 10 s; no >+20% point → noise reruns NOT triggered; verdict: H-17 holds, no TTI regression finding.
- **Axe:** 50 entries / 12 unique rule-triages-level P1 × combos: `color-contrast`(serious, 18 combos), `aria-prohibited-attr`(serious, 16), `label`(critical, 8), `select-name`(critical, 8). **Zero P0, zero scan gaps** → verdict stays BLOCKED with 12 open P1s feeding Part B adjudication. Nothing in `src/` patched.
- **Total lines:** 2,903 insertions across 14 files (~460 docs + ~215 e2e-a11y + ~2,188 openspec incl. raw JSON + 40 manifest).

## Recorded deviations / gotchas

1. Spec-header TTI/a11y command `... load-e2e-env.cjs exec node ...cli.js ...` fails verbatim (`error: unknown command 'exec'` — no `exec` subcommand in this Playwright); executed via the same loader as `test --config ...` (identical CLI/env). Recorded in evidence + report.
2. Playwright `storageState` accepts a **path**, not inline JSON (first scan attempt errored ENOENT; fixed).
3. `getByText("Paid in Full")` case-insensitively matched the hidden status-filter `<option>` → 4 harness scan gaps on first run; fixed by anchoring on the sale card (documented in scan.spec.ts); final run 0 gaps.
4. Artifact language: protocol user-facing text neutral Spanish (no voseo) — verified.
