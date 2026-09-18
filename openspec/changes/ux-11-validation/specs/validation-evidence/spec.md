# validation-evidence Specification

## Purpose

Governs the evidence deliverables of UX-11 (roadmap §UX-11, §48 "real evidence, not 'the agent finished'"): the TTI re-measurement (H-17), the §47 financial-freeze regression re-check with the full gate battery, the automated a11y scan, the founder usability protocol, and the validation report whose final verdict stays BLOCKED until founder-executed Part B sessions complete. This capability is documentation/evidence-shaped: its requirements define WHAT the artifacts MUST contain and HOW the evidence MUST be produced. Zero `src/` product-code changes are permitted (freeze §47 is checked, never touched).

Baseline references: `docs/UX-5-TTI-REPORT.md` (2026-09-14: cold 375/3G hero N1 2.381 ms, DCL 1.197 ms, load 3.093 ms; 9 samples), `docs/freeze + UX-UI.md` §41 (lines 1374–1389, Golden Rule), §47 (lines 1480–1499, 13 freeze items), §48 (lines 1506–1517), §56 (lines 1663–1688), and `docs/UX-ROADMAP.md` §UX-11 (lines 154–159).

## Requirements

### Requirement: TTI "after" measurement reuses the UX-5 harness verbatim

The UX-11 TTI re-measurement MUST reuse the existing UX-5 harness without any code modification: `e2e-tti/measure-tti.spec.ts` + `playwright.tti.config.ts`, invoked with the documented command (`node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.tti.config.ts`). The run MUST measure the same metrics (hero-N1-visible, domContentLoaded, load) at the same sample points: cold and hot at 375, 768, and 1280 viewports, plus cold 375 under CDP slow-3G throttling — matching the baseline's 9 samples. The resulting before/after table MUST pair each new sample against its counterpart row in `docs/UX-5-TTI-REPORT.md` §3 and MUST declare the §2.1 deviations verbatim: (1) metric is time-to-hero-N1-visible, not Lighthouse idle-window TTI; (2) local `next start` does not emulate Vercel serverless cold start; (3) slow-3G is CDP-simulated on a local dev machine.

#### Scenario: Harness is run unmodified

- GIVEN the working tree at the UX-11 start commit
- WHEN `git diff` is computed over `e2e-tti/**` and `playwright.tti.config.ts`
- THEN the diff is empty (zero lines changed)
- AND the documented TTI command executes the suite to completion with all 9 samples produced

#### Scenario: Before/after table pairs every baseline sample

- GIVEN the UX-5 baseline of 9 samples (cold 375/3G, hot-1/hot-2 at 375, cold/hot-1/hot-2 at 768, cold/hot-1/hot-2 at 1280)
- WHEN the report's before/after table is inspected
- THEN each of the 9 baseline rows has a corresponding "after" row with real measured values (hero N1, DCL, load in ms)
- AND no placeholder, estimated, or copied-from-baseline value appears in any "after" cell

#### Scenario: Deviations are declared identically to the baseline

- WHEN the report's deviation section is compared to `docs/UX-5-TTI-REPORT.md` §2.1
- THEN all three deviations (no Lighthouse/window-idle TTI; `next start` ≠ serverless cold start; CDP-simulated 3G) are present with the same meaning
- AND no additional undisclosed deviation is introduced silently

### Requirement: TTI regression criteria are evaluated against the UX-5 baseline

The re-measurement MUST be judged by two explicit criteria: (1) cold hero-N1-visible stays below 10 seconds (Golden Rule §41 margin, §8.1 budget), and (2) no sample degrades more than 20% versus its UX-5 baseline counterpart without a documented cause in the report. If either criterion fails, the report MUST record the regression as an open finding feeding the verdict section — product code MUST NOT be patched as a reaction (the regression result is itself valid UX-11 evidence).

#### Scenario: Cold hero stays within the Golden Rule margin

- GIVEN the cold 375/3G "after" sample
- WHEN its hero-N1-visible time is compared to the 10 s budget
- THEN the value is below 10 s and the report marks the cold criterion as met
- AND the same check is applied to the cold 768 and cold 1280 samples

#### Scenario: Degradation beyond 20% requires documented cause

- GIVEN any "after" sample whose metric exceeds its baseline counterpart by more than 20%
- WHEN the report is reviewed
- THEN the sample is flagged and a documented cause analysis accompanies it
- AND if no cause is documented, the report records the regression as an open finding feeding the blocked verdict

#### Scenario: Regression is reported, never patched

- GIVEN a run where any regression criterion fails
- WHEN the change is delivered
- THEN `src/**` remains unmodified and the regression appears as an open finding in the report's verdict section

### Requirement: §47 financial freeze is re-checked with fresh gate results mapped to all 13 items

The validation MUST re-run the complete gate battery with fresh results from the current tree: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm parity`, `pnpm build`, and `pnpm test` — the full Vitest suite MUST be run with an explicit command timeout of at least 2,900,000 ms (regulatory ≥ 45 min; never the default 120 s, and never a retry on a default-timeout expiry without recording the real error first). Each of the 13 §47 freeze items (movement create, movement edit, movement delete, transfers, multi-currency, negative balance, credits, abonos/installments, POS, opening balances, multi-account operations, idempotency, tenant isolation) MUST be mapped to concrete suite/test evidence using the inventory in `docs/freeze + UX-UI.md` §47 (lines 1480–1499). The mapping table MUST contain exactly 13 items — correcting the inherited "15 rows" count slip from the UX-10 verify table.

#### Scenario: All gates run fresh with the regulatory timeout

- GIVEN the current tree at validation time
- WHEN the gate battery is executed
- THEN all five gates produce results from this run (no copied results from UX-10)
- AND the full-suite command was launched with timeout ≥ 2,900,000 ms and completed (or its failure is recorded verbatim)

#### Scenario: Every freeze item maps to concrete evidence

- GIVEN the 13 items listed in §47 (lines 1487–1499)
- WHEN the report's mapping table is inspected
- THEN every item has at least one concrete test/suite reference and its fresh pass status
- AND no item is marked passed without pointing to specific evidence

#### Scenario: Item count is corrected to 13

- WHEN the report's mapping table is counted
- THEN it contains exactly 13 rows (not 15 — the UX-10 inherited slip is corrected)
- AND a note records the correction relative to the UX-10 verify table

### Requirement: Automated a11y scan runs as a standalone, CI-isolated Playwright spec

The change MUST add exactly one new devDependency, `@axe-core/playwright` (founder-approved 2026-09-18; the only manifest change of the entire change), and a standalone a11y scan mirroring the TTI harness isolation pattern: its own directory `e2e-a11y/`, its own Playwright config with its own `testDir`, `reuseExistingServer: false`, production-build webServer, and global setup/teardown reuse — and the main `playwright.config.ts` testMatch MUST provably exclude `e2e-a11y/**` so the scan never joins the CI e2e suite. The scan MUST be authenticated (session via the existing `e2e/helpers.ts` storageState pattern) and MUST cover the pages `/dashboard`, `/movements`, `/pos/sales`, `/credits/granted`, and `/help` at viewports 375 and 1280 in both light and dark themes. The scan is NOT part of the CI e2e suite and MUST NOT be wired into CI in this change.

#### Scenario: Scan is isolated from the CI e2e suite

- GIVEN the main `playwright.config.ts`
- WHEN its testMatch patterns are evaluated against `e2e-a11y/scan.spec.ts`
- THEN no pattern matches the a11y spec, and an explicit negative check (test or structural evidence) demonstrates the exclusion
- AND the a11y suite runs only through its own config and documented command

#### Scenario: Matrix coverage is complete

- GIVEN the scan configuration
- WHEN the executed runs are enumerated
- THEN all 5 routes × 2 viewports (375, 1280) × 2 themes (light, dark) = 20 page/theme/viewport combinations are scanned
- AND every scan context uses an authenticated session

#### Scenario: Single dependency boundary holds

- WHEN `git diff` over `package.json` and `pnpm-lock.yaml` is inspected
- THEN the only dependency change is the addition of `@axe-core/playwright` as a devDependency
- AND no runtime dependency is added

### Requirement: A11y violations are triaged with evidence and gate on the verdict

Every axe violation found by the scan MUST be triaged into P0, P1, or "other" and recorded in the report with file/selector evidence (route, viewport, theme, rule id, impacted node). The Part A acceptance bar is zero open P0/P1 violations from the scan; any P0/P1 MUST either be documented with a remediation plan or escalated for founder adjudication — findings are NEVER silently patched inside UX-11 (remediation belongs to UX-12 or an ad-hoc fix change). "Other" findings MUST be documented with rationale for why they do not gate.

#### Scenario: Every violation carries evidence

- GIVEN a completed scan producing N violations
- WHEN the report's triage table is inspected
- THEN each violation lists route, viewport, theme, axe rule id, and the impacted selector/file
- AND each violation carries a triage level (P0, P1, or other) with rationale

#### Scenario: P0/P1 blocks unless remediated or adjudicated

- GIVEN any violation triaged P0 or P1
- WHEN the report's verdict inputs are assembled
- THEN the verdict remains blocked unless the finding has a documented remediation plan or an explicit founder adjudication
- AND no product-code fix is applied within UX-11 to clear the finding

#### Scenario: Zero P0/P1 keeps Part A green

- GIVEN a scan returning only "other" findings
- WHEN the report is completed
- THEN Part A's a11y section records zero open P0/P1 and each "other" finding has documented rationale

### Requirement: A founder-executable usability protocol is delivered as a document

The change MUST deliver `docs/UX-11-USABILITY-PROTOCOL.md` containing: (1) exactly 4 tasks in the end-user's language (neutral Spanish, no voseo): register a sale at `/pos/sales`, register an expense at `/movements`, understand the Resumen in 10 seconds at `/dashboard` with the 5 Golden Rule questions (§41, `docs/freeze + UX-UI.md:1374–1389`) quoted verbatim, and collect a granted credit at `/credits/granted` including MoneyActionConfirmation comprehension; (2) a seeded-data recipe for reproducing the test environment (reusing the `e2e/helpers.ts` `registerUser`/`seedFinancialData` shape plus one open granted credit); (3) an observation guide (time-on-task, hesitations, MAC/F5 comprehension); (4) success criteria per task; (5) the 4/5 Golden-Rule pass rule (≥ 4 of 5 users must pass the Resumen task); and (6) `/help` explicitly allowed as a support surface during sessions.

#### Scenario: Protocol contains the 4 tasks in user language

- GIVEN `docs/UX-11-USABILITY-PROTOCOL.md`
- WHEN its task list is inspected
- THEN exactly 4 tasks exist covering sale registration, expense registration, Resumen comprehension (with the 5 §41 questions verbatim), and credit collection
- AND all task text is in neutral Spanish with no voseo or regionalisms

#### Scenario: Protocol is self-executable by the founder

- GIVEN the founder with no prior agent context
- WHEN the protocol is followed top to bottom
- THEN the seeded-data recipe reproduces the required state (including one open granted credit) without inventing missing steps
- AND each task has explicit success criteria and the 4/5 Golden-Rule rule is stated

#### Scenario: /help is an allowed support surface

- WHEN the observation guide is read
- THEN it explicitly permits users to consult `/help` during tasks and instructs observers to record such usage

### Requirement: The validation report separates real Part A evidence from PENDING FOUNDER Part B and blocks its verdict

The change MUST deliver `docs/UX-11-VALIDATION-REPORT.md` containing: methodology; the TTI before/after table with real run numbers; the §47 gate mapping with real results; the a11y scan results with triage; and Part B sections — the usability results table (5 users × 4 tasks), the manual a11y items S8.3 / S12.2 / S13.1, and the visual passes (UX-10 task 9.5, UX-7 RSL-8, UX-8 filter-zero) — each explicitly marked PENDING FOUNDER. The report MUST contain a final verdict section that is explicitly BLOCKED until Part B completes. Final acceptance (declared only after Part B) requires: no open P0/P1, Golden Rule passed by ≥ 4/5 users, and financial regression ZERO (suite + tsc + lint + build).

#### Scenario: Part A sections carry real values

- GIVEN the report's Part A sections (TTI, §47 gates, a11y scan)
- WHEN each numeric result is inspected
- THEN it comes from the actual UX-11 runs (matching recorded command output), with no placeholders or values copied from prior-phase reports

#### Scenario: Part B sections are marked PENDING FOUNDER

- GIVEN the report's Part B sections (usability table, S8.3/S12.2/S13.1, visual passes 9.5/RSL-8/filter-zero)
- WHEN each section is inspected
- THEN it is labeled PENDING FOUNDER with a placeholder structure ready to receive founder results
- AND no Part B result is fabricated or pre-filled

#### Scenario: Verdict is blocked until Part B

- GIVEN the report's verdict section before Part B sessions complete
- WHEN the verdict is read
- THEN it is explicitly BLOCKED, naming Part B as the blocking condition and the three final-acceptance criteria (no open P0/P1, Golden Rule ≥ 4/5, financial regression ZERO)

### Requirement: Freeze and delivery constraints hold for the entire change

The change MUST NOT modify anything under `src/**` (hard boundary; `src/core/`, `src/infrastructure/`, Mongoose models, and `globals.css` untouched). The only permitted artifact paths are: `package.json` + `pnpm-lock.yaml` (the single devDependency), `e2e-a11y/` (new scan spec + config), `docs/UX-11-VALIDATION-REPORT.md`, `docs/UX-11-USABILITY-PROTOCOL.md`, and `openspec/changes/ux-11-validation/**`. Work MUST be committed as conventional commits, one per logical work unit (suggested order: `chore(deps)` → `test(a11y)` → `test(tti)` → `docs(ux-11)`), and MUST NOT be pushed — delivery to the remote is the orchestrator's responsibility.

#### Scenario: Zero product-code diff

- GIVEN the full change from its first commit to its last
- WHEN `git diff` is computed over `src/**`
- THEN it is empty at every point and at the end state

#### Scenario: Only sanctioned paths change

- WHEN the change's full file inventory is listed
- THEN it contains only: the dependency manifest pair, `e2e-a11y/**`, the two docs files, and `openspec/changes/ux-11-validation/**`
- AND `e2e-tti/**` and `playwright.tti.config.ts` appear as unmodified

#### Scenario: Commits are unit-scoped and never pushed

- GIVEN the change's commit history
- WHEN the log is inspected
- THEN each work unit has its own conventional commit and no commit is pushed to the remote by this change
