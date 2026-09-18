# Tasks: UX-11 — Validation (Real Evidence, §48)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950–1,300 additions (docs ~450, e2e-a11y ~300, openspec artifacts ~460, manifest/lock ~40) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (U1+U2: dep + scan harness) → PR 2 (U3+U4: evidence runs) → PR 3 (U5: docs + openspec) |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

> **Correction to the single-pr forecast assumption:** the change touches zero product code, but every deliverable is a NEW file (`e2e-a11y/**`, the two docs, `openspec/changes/ux-11-validation/**`), and new files count every line as an addition in the 400-line budget (`additions + deletions`). The "small docs+harness diff" intuition is true in *severity* (nothing product-risky) but not in *raw line count*. Two acceptable resolutions, founder's choice before apply: (a) `size:exception` on a single PR (matches the single-pr strategy; review burden is docs/harness, not logic), or (b) a 3-PR feature-branch chain per the table above. This is a team decision — not made unilaterally in this phase.

### Suggested Work Units

All five units fit ONE PR today (single-pr strategy); the split above applies only if the founder rejects `size:exception`. Each unit = exactly one conventional commit. No push.

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 | `@axe-core/playwright` devDep only | PR 1 | `pnpm exec tsc --noEmit` (0) + `git status --porcelain` shows only manifest pair | N/A — no runnable scenario; reason: dependency-only change, no src change (explicitly NOT a vitest run per session contract) | `pnpm remove @axe-core/playwright` |
| U2 | a11y scan spec + config, standalone | PR 1 | `node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.a11y.config.ts` (on port 3200) | Production build webServer + local mongod replset (`e2e/global-setup.ts`), seeded data per task 2.x | `git rm -r e2e-a11y playwright.a11y.config.ts` |
| U3 | Fresh gate battery + §47 mapping evidence | PR 2 | the five gates themselves (`tsc --noEmit`, `lint`, `parity`, `build`, `pnpm test` @ ≥2_900_000 ms) | Full Vitest suite (serial replset, ~21 min) — explicit timeout mandatory | Revert commit; results are evidence files only |
| U4 | TTI "after" run + before/after table | PR 2 | spec-header TTI command (task 4.x) with pre-flight checks | `e2e-tti` harness verbatim, port 3100, production build | Revert commit; product code untouched by design |
| U5 | Usability protocol + validation report | PR 3 | `pnpm parity` (docs carry i18n-quoted strings; parity sanity) | N/A — docs-only; reason: no executable scenario beyond parity gate | `git rm` the two docs + revert openspec edits |

---

## Phase 0: Preconditions (before U1)

- [ ] 0.1 Verify clean tree: `git status --porcelain` returns empty (expected HEAD at UX-10 close; baseline `3f70887` per proposal — confirm current HEAD, record it in the report's methodology section).
- [ ] 0.2 Verify all sanctioned paths exist as references: `e2e/load-e2e-env.cjs`, `e2e/helpers.ts` (`registerUser`, `seedFinancialData`), `e2e/global-setup.ts` / `e2e/global-teardown.ts`, `e2e-tti/measure-tti.spec.ts`, `playwright.tti.config.ts` (read-only references — none of these files are edit targets).
- [ ] 0.3 Record in `openspec/changes/ux-11-validation/state.yaml` notes that the TTI isolation mechanism is `testDir: './e2e'` (main config) — NOT a `testMatch` glob; task 2.5's exclusion proof targets `testDir`, satisfying the spec's "testMatch MUST provably exclude" scenario structurally (a non-matching testDir cannot match anything, so the negative check is equivalent and stricter).

## Phase 1: U1 — Dependency (`chore(deps)` commit)

- [ ] 1.1 Run `pnpm add -D @axe-core/playwright` (single devDep; founder approval GIVEN 2026-09-18). No runtime dependency added.
- [ ] 1.2 Verify `package.json` diff shows ONLY the new devDependency entry and `pnpm-lock.yaml` updated consistently (`pnpm install` clean).
- [ ] 1.3 Verify no other manifest change and `pnpm exec tsc --noEmit` still returns 0 (per session contract: no vitest run for U1 — no `src/` change exists).
- [ ] 1.4 Commit: `chore(deps): add @axe-core/playwright for standalone a11y scan (UX-11)`.

## Phase 2: U2 — a11y scan harness (`test(a11y)` commit)

- [ ] 2.1 Create root config `playwright.a11y.config.ts` mirroring `playwright.tti.config.ts` (read-only reference) isolation shape: `testDir: './e2e-a11y'`, `fullyParallel: false`, `workers: 1`, `reuseExistingServer: false`, `globalSetup: './e2e/global-setup.ts'` + ./e2e/global-teardown.ts (read-only refs), production-build `webServer.command: 'pnpm exec next build && pnpm exec next start --port 3200'`, `port: 3200` (MUST differ from 3100), `timeout: 300_000`. Header comment states the run command and that the scan is NOT part of CI/CI e2e.
- [ ] 2.2 Create `e2e-a11y/scan.spec.ts`: authenticated contexts via the existing `e2e/helpers.ts` storageState pattern (`registerUser`/`seedFinancialData`); scan matrix `/dashboard`, `/movements`, `/pos/sales`, `/credits/granted`, `/help` × viewports 375 + 1280 × themes light + dark = 20 combinations, each combination asserted to render meaningful content before running AxeBuilder (`new AxeBuilder({ page }).analyze()`).
- [ ] 2.3 Seed guard (design clarification 2): before scanning, seed via `e2e/helpers.ts` — `registerUser` + `seedFinancialData` shape + ONE open granted credit + ONE POS catalog item — so `/credits/granted` and `/pos/sales` render real content. If any of the 20 combos still cannot render meaningful content, emit an explicit console line `A11Y-SCAN-GAP: <route>/<viewport>/<theme> rationale` and record it as a documented scan gap in the report — NEVER silently skip a combo.
- [ ] 2.4 Output: collect all violations with route/viewport/theme/ruleId/selectors/targets/impact and write them (a) to console and (b) to a JSON artifact `openspec/changes/ux-11-validation/evidence/a11y-scan-raw.json` for U5 triage.
- [ ] 2.5 Isolation proof: add a structural negative check (test or scripted assertion shipped with the spec) evaluating the main `playwright.config.ts` against `e2e-a11y/scan.spec.ts`: because its `testDir` is `./e2e`, the a11y path is outside every potential match — assert this programmatically so the exclusion is provable, not asserted in prose.
- [ ] 2.6 Run the scan once end-to-end; capture the real output (20 combos, violation list). Fix NOTHING under `src/` regardless of what axe finds — violations are report findings for U5 triage; P0/P1 findings escalate to the orchestrator/founder (acceptance gate), they do not block writing the harness itself.
- [ ] 2.7 Commit evidence + harness: `test(a11y): standalone axe scan spec for 5 routes × 2 viewports × 2 themes (UX-11)`.

## Phase 3: U3 — Fresh gates + §47 freeze re-check (`test(gates)` commit)

- [ ] 3.1 Run fresh (from this tree, this run — never copied from UX-10): `pnpm exec tsc --noEmit` → record count (expect 0 errors); `pnpm lint` → record count; `pnpm parity` → record result; `pnpm build` → record success/failure verbatim.
- [ ] 3.2 Run `pnpm test` (full suite, 131 files, serial replset) with explicit command timeout **≥ 2_900_000 ms** — never the default 120 s; if anything times out or fails, record the real error verbatim before any retry.
- [ ] 3.3 Map each of the 13 §47 freeze items (`docs/freeze + UX-UI.md` lines 1487–1499: create/edit/delete movement, transfers, multi-currency, negative balance, credits, abonos, POS, opening balances, multi-account operations, idempotency, tenant isolation) to at least one concrete suite/test reference + its fresh pass status; the mapping table must contain EXACTLY 13 rows and a note correcting the inherited "15 rows" count slip from the UX-10 verify table. Store the raw gate outputs + mapping draft in `openspec/changes/ux-11-validation/evidence/gates-<date>.md`.
- [ ] 3.4 Commit: `test(gates): fresh §47 gate battery results with 13-item freeze mapping (UX-11)`.

## Phase 4: U4 — TTI "after" measurement (`test(tti)` commit)

- [ ] 4.1 Pre-flight (design clarifications 1 + 3): confirm `git status --porcelain` clean; confirm local mongod replset binary availability (same requirement as the e2e suite); verify `git diff` over `e2e-tti/**` and `playwright.tti.config.ts` is EMPTY (verbatim-reuse precondition — fail the task, do not patch the harness, if not).
- [ ] 4.2 Run the spec-header command form verbatim: `node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.tti.config.ts` (NOT the shorter variant in `docs/UX-5-TTI-REPORT.md` §5 — that one was flagged imprecise). All 9 samples must be produced; with explicit runner timeout ≥ 300_000 ms for the whole command (config timeout is 240 s per spec + 300 s webServer boot).
- [ ] 4.3 Before/after table: pair each of the 9 UX-5 baseline rows (cold 375/3G hero 2.381 / DCL 1.197 / load 3.093; hot-1/hot-2 375; cold 768 2.330 / hot-1 2.296 / hot-2 3.702; cold 1280 2.270 / hot-1 2.882 / hot-2 3.300) with real "after" values from this run. Every "after" cell is a real measured number — no placeholders, no copies.
- [ ] 4.4 Variance protocol (design clarification 1): judge cold-hero and hot-peak per breakpoint. Baseline points are UX-5 single cold runs, so compare the after run's cold-hero medians per breakpoint against the baseline cold point. If any point exceeds its baseline counterpart by more than +20%, run the noise-analysis protocol BEFORE declaring regression: repeat the affected point ×3, take the median, and re-evaluate against the baseline with the median. Only then either (a) document the cause (machine load, GC, build nondeterminism) or (b) record the regression as an open finding — never silently, never weaken the gate, never patch `src/`.
- [ ] 4.5 Criteria check: cold hero-N1 < 10 s at 375/768/1280 (§8.1 / Golden Rule §41); deviation §2.1 declarations reproduced verbatim in the report skeleton input; record any benign artifacts (e.g. `The destination stream closed early.` server log) as the baseline did.
- [ ] 4.6 Commit raw numbers + table draft to `openspec/changes/ux-11-validation/evidence/tti-after-<date>.md`: `test(tti): TTI after-run measurement with before/after table vs UX-5 baseline (UX-11)`.

## Phase 5: U5 — Founder docs + report (`docs(ux-11)` commit)

- [ ] 5.1 Create `docs/UX-11-USABILITY-PROTOCOL.md`: structural headings bilingual (EN primary / ES secondary); ALL task scripts and user-facing text in NEUTRAL SPANISH, no voseo, no regionalisms (project i18n rule). Contents: (1) exactly 4 tasks — registrar una venta en `/pos/sales`; registrar un gasto en `/movements`; entender el Resumen en 10 segundos en `/dashboard` quoting the 5 §41 questions VERBATIM from `docs/freeze + UX-UI.md:1374–1389` (¿Cuánto tengo? / ¿Qué está pasando? / ¿Estoy mejor o peor? / ¿Dónde está el problema, si existe? / ¿Qué debería revisar?); cobrar un crédito otorgado en `/credits/granted` including MoneyActionConfirmation comprehension; (2) seeded-data recipe reusing the `e2e/helpers.ts` `registerUser`/`seedFinancialData` shape (read-only reference) + one open granted credit, reproducible without agent context; (3) observation guide (time-on-task, hesitations, MAC/F5 comprehension); (4) success criteria per task; (5) the 4/5 Golden-Rule pass rule (≥ 4 of 5 users pass the Resumen task); (6) `/help` explicitly allowed as support surface, with usage recorded by the observer.
- [ ] 5.2 Create `docs/UX-11-VALIDATION-REPORT.md`: methodology (dates, HEADs, commands verbatim); TTI before/after table with REAL U4 numbers + noise-analysis outcomes + verbatim-predeclared §2.1 deviations; §47 gate mapping with REAL U3 results (13 rows + 15-rows correction note); a11y scan triage table from U2 evidence (every violation: route, viewport, theme, axe rule id, impacted selector/file, triage level P0/P1/other with rationale; documented scan gaps from task 2.3 listed explicitly; zero-P0/P1 confirmed or escalated).
- [ ] 5.3 Part B sections, each labeled **PENDING FOUNDER** with placeholder structure ready to receive results and NOTHING pre-filled: usability results table (5 users × 4 tasks); manual a11y S8.3 / S12.2 / S13.1; visual passes UX-10 task 9.5 / UX-7 RSL-8 / UX-8 filter-zero.
- [ ] 5.4 Verdict section (design clarification 4): explicit wording **BLOCKED — pending Part B (founder-executed)**, plus the founder checklist verbatim as an actionable block: (1) run the 5 usability sessions per `docs/UX-11-USABILITY-PROTOCOL.md`; (2) execute manual a11y S8.3 / S12.2 / S13.1; (3) execute visual passes 9.5 / RSL-8 / filter-zero; then final acceptance may only be declared when: no open P0/P1, Golden Rule ≥ 4/5 users, financial regression ZERO (suite + tsc + lint + build). Any open P0/P1 or TTI regression finding from Part A feeds this section explicitly.
- [ ] 5.5 Update `openspec/changes/ux-11-validation/tasks.md` checkboxes as completed (this file) and confirm the change's file inventory matches spec `Freeze and delivery constraints` exactly.
- [ ] 5.6 Commit: `docs(ux-11): usability protocol + validation report (Part A real, Part B pending founder) (UX-11)`.

## Phase 6: Final audit (verification only — no commit)

- [ ] 6.1 Frozen-scope audit: `git diff <start-HEAD>..HEAD -- src/` is EMPTY (both `src/product-code` and `src/core`+`src/infrastructure`; hard boundary); confirm `e2e-tti/**` and `playwright.tti.config.ts` appear unmodified; confirm the full changed-file inventory contains ONLY `package.json`, `pnpm-lock.yaml`, `e2e-a11y/**`, `playwright.a11y.config.ts`, `docs/UX-11-VALIDATION-REPORT.md`, `docs/UX-11-USABILITY-PROTOCOL.md`, `openspec/changes/ux-11-validation/**`.
- [ ] 6.2 Verify Review Workload Forecast against the real diff (`git diff --stat`); if the real count differs materially from the ~950–1,300 estimate, update the forecast table above with the actual number before hand-off.
- [ ] 6.3 Confirm zero commits pushed (`git log origin/master..HEAD` shows the 5 unit commits; no push action taken anywhere).
