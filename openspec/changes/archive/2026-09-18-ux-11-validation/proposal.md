# Proposal: UX-11 — Validation (Real Evidence, §48)

## Intent

From UX-0 through UX-10 the project shipped: navigation IA, trims, Resumen N1, a11y remediation (H-14/H-16), contrast tokens, EmptyState/Alert/FormField systems, TTI measurement, and usability/process improvements. Every phase so far was executed and verified by an agent — the roadmap §48 demands **real evidence, not "the agent finished"**. UX-11 exists to produce that evidence: re-run the TTI harness after all UX-10 changes to prove H-17 still holds, re-check the frozen financial domain (§47) with the complete gate battery, add an automated a11y scan so a11y is machine-evidenced (not only documentary), and hand the founder a ready-to-run usability protocol plus a validation report skeleton whose verdict stays blocked until founder-executed Part B sessions complete.

Acceptance criteria (roadmap §UX-11): no open P0/P1; Golden Rule §41 passed by ≥4/5 users; financial regression ZERO (suite + tsc + lint + build).

## Scope

### In Scope (Part A — agent-executable, this change)

1. **TTI "after" measurement (H-17):** re-run the existing UX-5 harness *verbatim* — `e2e-tti/measure-tti.spec.ts` + `playwright.tti.config.ts` with the documented command (`node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.tti.config.ts`). Same metrics (hero-N1-visible, DCL, load), same points (375 cold/3G + hot, 768, 1280), before/after table against `docs/UX-5-TTI-REPORT.md`, and §2.1 deviations declared identically (local `next start` ≠ Vercel serverless cold start; CDP slow-3G; metric is time-to-hero-visible, not idle-window TTI). **No new code in the harness.**
2. **§47 financial regression re-check + gates:** run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm parity`, `pnpm build`, `pnpm test` (explicit timeout ≥ 2_900_000 ms) and map results to the 13 §47 freeze items (movement CRUD/edit/delete, transfers, multimoneda, negative balance, credits, abonos, POS, opening balances, multi-account, idempotency, tenant isolation) using the test inventory in `docs/freeze + UX-UI.md` (§41 at lines 1374–1389, §47 at lines 1480–1499). Fix the "15 rows" count slip inherited from the UX-10 verify table.
3. **Automated a11y audit:** add ONE devDependency `@axe-core/playwright` (founder-approved 2026-09-18; justification: after UX-9 a11y evidence was documentary only, and axe-core is unresolvable under pnpm — it reaches the tree only transitively via `eslint-plugin-jsx-a11y`). New standalone scan spec mirroring the TTI harness pattern: own config dir `e2e-a11y/`, own Playwright config (standalone `testDir`, excluded from CI e2e suite — verify `playwright.config.ts` testMatch does not pick it up), authenticated `storageState` via `e2e/helpers.ts`, production-build webServer. Scans `/dashboard`, `/movements`, `/pos/sales`, `/credits/granted`, `/help` at 375 + 1280, light + dark. Violations triaged P0/P1/other into the report. **Not part of the CI e2e suite.**
4. **Usability test protocol (founder):** `docs/UX-11-USABILITY-PROTOCOL.md` — 4 tasks in user language (registrar venta `/pos/sales`; registrar gasto `/movements` expense; entender el Resumen en 10 s `/dashboard` with the 5 §41 questions verbatim from `docs/freeze + UX-UI.md:1374–1389`; cobrar un crédito `/credits/granted` with MoneyActionConfirmation comprehension), seeded-data recipe (reuse `e2e/helpers.ts` `registerUser`/`seedFinancialData` shape + one open credit-granted), observation guide (time-on-task, hesitations, MAC/F5 comprehension), success criteria per task, 4/5 Golden-Rule pass rule, `/help` as allowed support surface.
5. **Validation report skeleton:** `docs/UX-11-VALIDATION-REPORT.md` — methodology; TTI before/after with **real numbers from the run**; §47 gate mapping with **real results**; a11y scan results (**real**); Part B placeholders: usability results table (5 users × 4 tasks), manual a11y items S8.3 / S12.2 / S13.1, visual passes (UX-10 task 9.5, UX-7 RSL-8, UX-8 filter-zero) — each marked **PENDING FOUNDER**; final verdict section blocked until Part B completes.

### Out of Scope (Part B — founder-only; NOT in this change's execution scope)

- Recruiting and running the 5 usability sessions.
- Manual a11y passes (S8.3 screen-reader test of the single announcement, S12.2 design review of the contrast doc, S13.1 keyboard checklist on the 5 main screens).
- Visual passes (UX-10 task 9.5, UX-7 RSL-8, UX-8 filter-zero).
- Final P0/P1 adjudication and the report's final verdict.
- Any `src/` product-code change (frozen domain §47 is *checked*, never touched).
- A11y remediation of whatever axe finds: findings are triaged and reported; fixes belong to UX-12 (or an ad-hoc fix change) unless trivially out of scope.
- Wiring the a11y scan into CI, creating `/reports` (DEC-IA-09), re-enabling the GGA pre-commit hook.
- Deploy config of any kind; branch is `master` (never `main`); single Vercel project `twincap`.

## Capabilities

> Contract with sdd-spec. Researched `openspec/specs/` (existing: alert-component, empty-state-consistency, form-field-pattern, navigation-ia, pos-sale-confirmation, ui-token-compliance — none modified).

### New Capabilities

- `validation-evidence`: covers the two evidence deliverables — the validation report (methodology, TTI before/after table, §47 gate mapping, a11y triage, Part B pending sections, blocked verdict) and the usability protocol (tasks, seed recipe, observation guide, pass rules). This capability is documentation/evidence-shaped: its requirements govern what the artifacts MUST contain and how they MUST be produced (verbatim harness reuse, real-vs-pending separation, founder-blocking verdict).

### Modified Capabilities

None — no product capability requirement changes. Zero `src/` changes; `src/core/`, `src/infrastructure/`, Mongoose models and `globals.css` untouched (freeze).

## Approach

Five sequential work units, one validation change, single PR:

1. **U1 — `chore(deps)`:** add `@axe-core/playwright` as devDependency (founder approval GIVEN 2026-09-18); the only `package.json`/`pnpm-lock.yaml` change in the whole change.
2. **U2 — `test(a11y)`:** create `e2e-a11y/scan.spec.ts` + `e2e-a11y`-rooted standalone Playwright config (copy the TTI config's isolation shape: own `testDir`, `reuseExistingServer: false`, production-build webServer, global-setup/teardown reuse). Write a negative check that the main `playwright.config.ts` does not match `e2e-a11y/**` (testMatch).
3. **U3 — gates + §47:** run the full gate battery (tsc, lint, parity, build; `pnpm test` with explicit ≥ 2_900_000 ms timeout) and build the §47 item → evidence mapping table, correcting the inherited "15 rows" count slip.
4. **U4 — `test(tti)`:** run the TTI harness verbatim; capture raw numbers; build the before/after table vs `docs/UX-5-TTI-REPORT.md` (baseline 2026-09-14: cold 375/3G hero 2.381 ms, etc.).
5. **U5 — `docs(ux-11)`:** write `docs/UX-11-USABILITY-PROTOCOL.md` and `docs/UX-11-VALIDATION-REPORT.md` with real Part A results and PENDING-FOUNDER Part B sections; verdict blocked.

Suggested commit order (conventional, one per unit): `chore(deps) axe` → `test(a11y) scan spec` → `test(tti) measurement results` → `docs(ux-11) protocol+report`. No push.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `@axe-core/playwright` devDependency (only product-repo manifest change) |
| `pnpm-lock.yaml` | Modified | Lockfile update from the single devDep |
| `e2e-a11y/*` (+ root a11y Playwright config) | New | Standalone axe scan spec + config, excluded from CI suite |
| `e2e-tti/*`, `playwright.tti.config.ts` | **Unmodified** | Harness re-run verbatim; zero code changes |
| `docs/UX-11-VALIDATION-REPORT.md` | New | Validation report (Part A real + Part B pending) |
| `docs/UX-11-USABILITY-PROTOCOL.md` | New | Founder usability protocol |
| `openspec/changes/ux-11-validation/*` | New | proposal.md, state.yaml, later specs/design/tasks/verify |
| `src/**` | **None** | Zero product code changes — hard boundary |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| TTI local-build deviation hurts comparability with UX-5 baseline | Low | Re-run harness verbatim on same protocol/build pipeline; deviations are pre-declared in both reports, margins are large (2.3 s vs 10 s budget) |
| axe false positives dilute the report (color-contrast on tokens, decorative headers) | Med | Triage every violation P0/P1/other with evidence; "other" items documented with rationale, only P0/P1 gate the verdict |
| Full-suite wall time (~21+ min serial replset) + build + TTI harness ≈ 1.5 h machine time | High (certain cost) | Schedule gates once, explicitly set command timeout ≥ 2_900_000 ms; never retry on default 120 s timeout |
| a11y scan spec accidentally picked up by CI e2e suite | Low | Standalone config with own testDir (TTI pattern); explicit testMatch negative check in U2 |
| Scope creep into a11y remediation mid-validation | Med | Remediation is out of scope; findings feed UX-12; only the report freezes evidence |

## Rollback Plan

Revert the commits of any failed unit (`git revert` per conventional commit); no state machines, no migrations, no persisted data. The devDep reverts via `pnpm remove @axe-core/playwright`. The e2e-a11y dir and docs are new files — deletion is a clean revert. Zero rollback risk to src/ because nothing in src/ changes. If the TTI "after" run regresses beyond §8.1 budgets (cold > 10 s to hero N1), do NOT patch product code: report the regression as an open finding for the verdict section (that result is itself valid UX-11 evidence).

## Dependencies

- Founder approval for the one new devDependency — **GIVEN 2026-09-18** ✅.
- Clean working tree at start (verified: HEAD `3f70887`, UX-0..UX-10 complete/archived).
- Base scripts exist: `pnpm lint/parity/build/test` (config.yaml), `e2e/load-e2e-env.cjs`, TTI harness command per spec header.
- Local mongod available for replset global-setup (same requirement as e2e/TTI today).

## Success Criteria

- [ ] **U1:** `@axe-core/playwright` in `package.json` devDependencies; `pnpm-lock.yaml` consistent; no other manifest change.
- [ ] **U2:** `e2e-a11y/` scan spec runs standalone; covers the 5 routes × 2 viewports × 2 themes; main e2e suite's testMatch provably excludes it.
- [ ] **U3:** all gates green: tsc 0, lint 0, parity OK, build OK, full Vitest suite 100% pass (explicit timeout ≥ 2_900_000 ms); §47 mapping table complete over all 13 items with corrected counts.
- [ ] **U4:** TTI before/after table with real run numbers; cold hero-N1 < 10 s (§8.1 / Regla de Oro §41); §2.1 deviations declared identically to baseline.
- [ ] **U5:** protocol + report docs exist; every real section carries actual run output; every Part B section labeled PENDING FOUNDER; verdict explicitly blocked until Part B.
- [ ] No open P0/P1 in Part A evidence (a11y triage + gates); if any P0/P1 appears, it is escalated to the orchestrator, not patched silently.
- [ ] Zero `git diff` in `src/**` at any point.
