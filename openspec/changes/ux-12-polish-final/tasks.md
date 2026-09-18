# Tasks: UX-12 Polish Final — A11y Structural Fixes, Contrast (Hybrid), Cleanup & Stage Close-Out

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,500–2,000 product/test/docs lines (excl. raw scan JSON evidence artifacts) |
| 400-line budget risk | Medium (session review budget = 2,500 lines, superseding the 400-line default; estimate fits) |
| Chained PRs recommended | No (single-pr strategy confirmed by orchestrator; ~5 conventional commits on `master`, no push) |
| Suggested split | Single PR; 5 work-unit commits (U1–U5) inside it |
| Delivery strategy | single-pr |
| Chain strategy | size-exception (single PR with maintainer-approved 2,500-line budget; approval encoded by orchestrator config) |
| Biggest line drivers | U5 `docs/UX-12-VALIDATION-REPORT.md` (~350 new) + U1 filter-bar astro/tests (~350); raw JSON evidence is artifact, not review prose |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

> Note: estimated total (~1.5–2.0k lines) exceeds the generic 400-line default but fits the session-confirmed `review_budget_lines: 2500` under `delivery_strategy: single-pr`. Units are still independently revertible (one conventional commit each) so review Debt can be taken unit-by-unit within the single PR.

## Design Decisions Resolved in Tasks (zero apply ambiguity)

The delta specs deferred 4 decisions. They are resolved HERE (per sdd-tasks mandate; `navigation-ia` spec records "the assignment MUST be recorded in the change design" — this section is that record):

1. **Design decision DD-T1 — CC-3/CC-7 single home**: Both nav contrast fixes (`nav.tsx:248` group labels = CC-3, `nav.tsx:268` active tint = CC-7) are assigned to **U2 (ui-token-compliance per-site unit)**. They are contrast edit + contrast evidence, one unit, one commit, one evidence pointer. The navigation-ia unit (U4) is confined to focus-visible unification + (U3) back-button deletion — it must NOT touch `nav.tsx` contrast classes.
2. **Design decision DD-T2 — Token darkening values (two-step rule)**: For each corrected token in `src/app/globals.css`, pick the next-darker standard shade step in the same ramp:
   - dark `--tc-primary` (#51a2ff) → a darker blue of the same ramp that yields white-on-token ≥ 4.5:1 (intermediate value first, then final);
   - `--tc-brand-gold` → darker gold reaching ≥ 3:1 vs `--tc-surface-card` for non-text UI contexts (≥ 4.5 if used as text);
   - dark `--tc-surface-muted` → zinc-500-equivalent darker value reaching secondary-on-card ≥ 4.5:1;
   - light `--tc-primary` (4.42: borderline): bump ONLY if a standard ramp step reaches ≥ 4.5 without visible brand distortion; otherwise document as residual with the measured value (the CC-7 nav-surface fix from the UX-11 scan already compensates the flagged surface);
   - `--tc-income`/`--tc-expense`: compute on card background in both themes; correct only if failing.
   A dedicated pre-commit contrast-check task (2.1) computes white(or surface)/`token-hex` WCAG ratios for all candidate values BEFORE the `globals.css` edit is committed; the axe re-scan is the final arbiter.
3. **Design decision DD-T3 — FormField-vs-htmlFor choice in filter bars**: Filter bars are inline horizontal layouts where `FormField`'s block-label structure may not fit. Task-per-file rule: use `FormField` **only when it renders correctly inside the bar layout**; otherwise use bare `htmlFor`/`id` association + `Select` `label`/`id` props (select.tsx:31 derives id from label). ACCEPTANCE per file = axe `label` + `select-name` 0 violations AND existing layout classes preserved (visible layout byte-equivalent); the per-file choice is documented in `apply-progress` for the unit.
4. **Design decision DD-T4 — Axe re-scan evidence path**: Updating `e2e-a11y/scan.spec.ts:254` hard-coded output path from `ux-11-validation` to `openspec/changes/ux-12-polish-final/evidence/` is PART OF THE U1 SCAN UNIT (not U5), so any intermediate scan re-run writes into the owning change's folder. The spec's "Evidence path rule persists" scenario is satisfied by this edit; header comment at `scan.spec.ts:26` is updated in the same line-touch.

## Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 | A11y structural: toast aria-label removal + 18-label/2-select filter-bar retrofit + scan path re-point | PR 1 (single PR) | `pnpm exec vitest run src/__tests__/toast.test.tsx src/__tests__/a11y-filter-bar.test.tsx` (name per actual test files created in 1.4) | axe spot scan on the 5 list pages + a toast-waking page via `node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.a11y.config.ts` (label/select-name/prohibited rules only pre-check) | Revert the `fix(a11y)` commit: 5 list files + `toast-provider.tsx` + `scan.spec.ts` + tests revert cleanly; no state/logic touched |
| U2 | Contrast HYBRID: token value darkening (globals.css) + CC-1..CC-5/CC-7 per-site class fixes + DS §2.1.5 addendum + motion clause | PR 1 | `pnpm exec vitest run src/__tests__ --changedSince master~1` or targeted: any token/snapshot tests touching globals.css | axe re-run pre-check on the affected pages (color-contrast rule) before commit; ratio pre-check script evidence in change dir | Value-only diff: `git revert` restores prior token values + prior per-site classes; visual regression reverts independently |
| U3 | Cleanup: back-button.tsx deletion (with test block removal) + Alert `success` variant + 6 banner migrations | PR 1 | `pnpm exec vitest run src/__tests__/touch-target-imports.test.ts src/__tests__/(alert|auth-form|forgot-password|reset-password|feedback-widget)*` (glob per actual test files) | Manual/attested: auth flows render the banners (existing component tests assert trigger conditions) | Revert restores component + test assertion + banner markup; Alert variant is additive and removable |
| U4 | Polish: focus-visible ring unification (bounded grep-first) | PR 1 | `pnpm exec vitest run src/__tests__/button.test.tsx` (or the focused files actually touched) | N/A with reason — CSS-class swap with no behavioral harness; keyboard-focus a11y preserved by pattern parity (manual Tab spot-check documented) | Revert restores prior ring classes; no logic touched |
| U5 | Close-out: full gate battery + axe re-scan evidence + TTI sample (optional-cheap) + validation report + frozen-domain audit | PR 1 | `pnpm test` (FULL suite, explicit timeout ≥ 2_900_000 ms) + full a11y harness command | `node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.a11y.config.ts` (20/20 combos completed) | Docs/evidence only: deletion of the report/evidence dir is the rollback; no product diff |

---

## Phase 0: Preconditions (before any unit)

- [ ] 0.1 Verify clean working tree: `git status` shows no uncommitted changes; record starting HEAD SHA in `apply-progress` note (frozen-diff anchor for task 6.2). If tree is dirty, STOP and surface to orchestrator.
- [ ] 0.2 Verify the axe triaged rule set matches the harness expectations: confirm `e2e-a11y/scan.spec.ts` collects all four triaged rules (`color-contrast`, `aria-prohibited-attr`, `label`, `select-name`) in its violation capture (read `scan.spec.ts` around lines 193-275); if the harness filters rules differently, note it in apply-progress before U1 (no harness logic change in this phase).
- [ ] 0.3 Confirm prerequisites: `e2e-a11y/`, `playwright.a11y.config.ts`, `@axe-core/playwright` devDependency present (`package.json`); `git rev-parse --verify ux-11` evidence dir `openspec/changes/archive/2026-09-18-ux-11-validation/` exists (dependency archived).
- [ ] 0.4 Re-verify audit file:line anchors against current HEAD for every touched file in the units below (files may have drifted since the 2026-09-18 audit): spot-check `toast-provider.tsx:57-60`, `sale-list.tsx:163-195`, `nav.tsx:248,268`, `summary-hero.tsx:83`, `back-button.tsx` importers, banner sites. Update task line references in apply-progress where drifted (anchor corrections are notes, not scope changes).

## Phase 1: Unit U1 — fix(a11y): toast aria-label removal + filter-bar label association + scan path (one commit)

- [ ] 1.1 In `src/components/ui/toast-provider.tsx` (~lines 57-60): remove the `aria-label` attribute from the `aria-live` container; keep the region inert/silent. Verify inner toast items already provide announcement content (item-level naming / visually-hidden text per H-16 single-channel decision from UX-5/UX-8); if inner naming is insufficient (no text node inside rendered toasts), extend the toast item markup to carry visually-hidden presentational text — still no attribute on the live container.
- [ ] 1.2 Update/extend the toast tests: in the existing toast-provider test file (locate with `grep -rn "ToastProvider" src/__tests__/`), add assertion: rendered live container does NOT have an `aria-label` attribute; keep/adjust existing announcement-UX assertions so announcement behavior remains covered. RED→GREEN per `strict_tdd: true`.
- [ ] 1.3 Retrofit the 5 filter-bar list files (18 labels + 2 selects), applying DD-T3 per file and documenting the per-file choice (FormField vs htmlFor) in apply-progress:
  - [ ] 1.3.1 `src/components/sales/sale-list.tsx` (~163-195): associate 4 labels; the status `<Select>` (bare) gets a name via `label` prop (select.tsx:31 id derivation) or `htmlFor`/`id` wiring. The file is also a CC-1 surface in U2 — in THIS unit touch only the a11y association (contrast classes stay for U2).
  - [ ] 1.3.2 `src/components/credits/credits-granted-list.tsx` (~120-131): associate 4 labels.
  - [ ] 1.3.3 `src/components/credits/credits-received-list.tsx`: associate 4 labels.
  - [ ] 1.3.4 `src/components/payables/payables-list.tsx`: associate 4 labels.
  - [ ] 1.3.5 `src/components/transfers/transfers-list.tsx`: associate the 2 date labels + account/search label.
- [ ] 1.4 Add a unit a11y test asserting label/control association per list file: one test file (e.g., `src/__tests__/filter-bar-a11y.test.tsx`) rendering each list's filter bar and asserting every visible `<label>` has a `htmlFor` matching an existing control `id` (FormFields count via their built-in association, as UX-10 tested them). Structure-only; no filter state/logic changes.
- [ ] 1.5 In `e2e-a11y/scan.spec.ts`: update line ~254 output dir `openspec/changes/ux-11-validation/evidence` → `openspec/changes/ux-12-polish-final/evidence` (create the dir at write time — the harness mkdir pattern already handles it; verify) and update the comment at ~lines 26 and 161/193 test titles only if they embed the change name (cosmetic; keep test IDs stable). Per DD-T4 this belongs to U1, NOT U5.
- [ ] 1.6 Run filtered vitest: `pnpm exec vitest run` on the touched test files (toast + filter-bar-a11y). Parity check NOT needed: no `messages/*.json` changes (no copy changes — i18n keys untouched).
- [ ] 1.7 Unit gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`. Verify `git diff --stat` shows ONLY the 5 list files, `toast-provider.tsx`, `scan.spec.ts`, and the new test file.
- [ ] 1.8 Commit: `fix(a11y): associate filter-bar labels, remove toast live-region aria-label, repoint scan evidence path`.

## Phase 2: Unit U2 — fix(a11y): contrast HYBRID — token corrections + CC-1..CC-7 per-site (one commit)

- [ ] 2.1 Contrast ratio PRE-CHECK (before any `globals.css` edit): compute WCAG contrast ratios for the DD-T2 candidate values (white vs token hex for `--tc-primary` dark candidates; `--tc-surface-card` vs `--tc-brand-gold` candidates; secondary-gray vs surface for `--tc-surface-muted`; `--tc-income`/`--tc-expense` vs card in both themes; light `--tc-primary` candidate). Record each candidate's computed ratio (before + intermediate + after) in `openspec/changes/ux-12-polish-final/evidence/contrast-ratio-precheck.md`. Commit decision recorded there.
- [ ] 2.2 N/A — value-only CSS unit; no new vitest test files (contrast is validated by the precheck ratios + the axe re-scan in U5).
- [ ] 2.3 Edit `src/app/globals.css` per DD-T2 (two-step): darken dark `--tc-primary` (white-on-primary 2.64 → ≥ 4.5), darken `--tc-brand-gold` for UI contexts (2.80 → ≥ 3:1 non-text UI / ≥ 4.5 text), darken dark `--tc-surface-muted` (4.07–4.34 → ≥ 4.5). Value-only: no renames, no new tokens. Decorative `--tc-brand-gold` usages reviewed per-context and their evaluation recorded in the precheck doc.
- [ ] 2.4 Decide light `--tc-primary` (4.42): apply a standard-step bump ONLY if the precheck shows ≥ 4.5 with acceptable brand fidelity; otherwise DON'T change and record the residual (measured 4.42 + rationale) for the U5 report and DS addendum.
- [ ] 2.5 Per-site class fixes for the CC surfaces (only these; NO migration of unflagged ~90 zinc sites):
  - [ ] 2.5.1 CC-1 secondary text `zinc-500`/`zinc-400` in flagged files → classes reaching ≥ 4.5 on their surface: `src/components/dashboard/summary-hero.tsx`, `src/components/dashboard/summary-cards.tsx`, `src/components/ui/movement-card.tsx`, `src/components/credits/credits-granted-list.tsx`, `src/components/sales/sale-list.tsx` (only the flagged sites per pre-check; grep within each file to enumerate).
  - [ ] 2.5.2 CC-2 `src/components/dashboard/summary-hero.tsx:83` highlight color → AA.
  - [ ] 2.5.3 CC-3 `src/app/(main)/nav.tsx:248` group labels → AA (HOME: this unit per DD-T1).
  - [ ] 2.5.4 CC-4 `src/components/ui/logo.tsx:46-47` + `src/app/not-found.tsx:43` wordmark → AA.
  - [ ] 2.5.5 CC-5 `src/app/help/page.tsx:49,96,106` text contrast → AA.
  - [ ] 2.5.6 CC-7 `src/app/(main)/nav.tsx:268` active tint → AA (HOME: this unit per DD-T1).
  - [ ] 2.5.7 CC-6 (dark primary buttons) closes via 2.3 token correction — verify NO separate button edits (`git diff src/components/ui/button.tsx` empty in this commit).
- [ ] 2.6 D6 non-regression check: `git diff src/components/ui/button.tsx src/components/ui/toast.tsx src/components/ui/badge.tsx src/components/ui/modal.tsx` shows NO class changes (D6 baseline preserved).
- [ ] 2.7 DS addendum: update `docs/UX-DESIGN-SYSTEM.md` (per session correction; the spec's "design system" doc = this file) §2.1.5 with a token-level addendum: corrected before/after ratios per token, light `--tc-primary` decision, note that §2.1.5 becomes true at TOKEN level while unflagged CLASS-level zinc grays persist (documented, not silent). Add the 3-line motion addendum (theme ~0.3s, toast ~300ms, accordion ~200ms; explicit "no new animation systems" clause). Zero new animation code.
- [ ] 2.8 Unit gates: `pnpm exec tsc --noEmit`, `pnpm lint`, responsive visual spot-check at 375/768/1280 both themes (manual, screenshot evidence optional in apply-progress), scoped vitest run of any tests touching globals.css/theme if they exist. Full suite is NOT re-run here (U5 runs it once; each unit still passes tsc/lint/build locally).
- [ ] 2.9 Commit: `fix(a11y): corrected contrast via token darkening and targeted CC-site classes (dec-ds-01 hybrid)`.

## Phase 3: Unit U3 — refactor(ui): back-button deletion + Alert success variant + 6 banner migrations (one commit)

- [ ] 3.1 Importer re-check: `grep -r "back-button" src/ md` (case-sensitive + case-insensitive) confirms 0 importers of `src/components/ui/back-button.tsx`. If any importer appears: STOP, block the deletion, surface to orchestrator (spec: re-scope, not force-delete).
- [ ] 3.2 Delete `src/components/ui/back-button.tsx` AND remove the literal-file assertion block in `src/__tests__/touch-target-imports.test.ts` (~lines 21-25) in the SAME commit. Run `pnpm exec vitest run src/__tests__/touch-target-imports.test.ts` — green with remaining assertions intact.
- [ ] 3.3 Add `success` variant to `src/components/ui/alert.tsx` — same contract as `danger`/`info` (token palette, success-class icon via existing Icon wrapper, message, optional action slot, no external lib). Update `src/__tests__/alert`-related test file: add success-variant render + styling assertions (RED→GREEN).
- [ ] 3.4 Migrate 4 danger banners with byte-identical copy (existing i18n keys; trigger conditions unchanged):
  - [ ] 3.4.1 `src/components/(auth)/auth-form.tsx:48` → `<Alert variant="danger">`.
  - [ ] 3.4.2 `src/app/(auth)/forgot-password/forgot-password-form.tsx:27` → Alert danger.
  - [ ] 3.4.3 `src/app/(auth)/reset-password/reset-password-form.tsx:27` → Alert danger.
  - [ ] 3.4.4 `src/components/feedback/feedback-widget.tsx:71` → Alert danger.
- [ ] 3.5 Migrate 2 success twins → `<Alert variant="success">`: `forgot-password-form.tsx:22`, `reset-password-form.tsx:22` (same byte-identical copy/trigger contract).
- [ ] 3.6 Update the per-surface tests that assert DOM structure for the 4 banner files (locate via `grep -rn "auth-form\|forgot-password-form\|reset-password-form\|feedback-widget" src/__tests__/`); assert Alert renders + same i18n key. Copy keys byte-identical: `git diff` over `messages/*.json` must be EMPTY.
- [ ] 3.7 Confirm NO `error-state.tsx` exists in `src/components/ui/` (ErrorState stays undocumented/deferral preserved).
- [ ] 3.8 Unit gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm parity`, `pnpm build`, banner spot-test run; responsive check 375/768/1280.
- [ ] 3.9 Commit: `refactor(ui): delete dead back-button, migrate banners to Alert, add Alert success variant`.

## Phase 4: Unit U4 — style(ui): focus-visible unification (one commit)

- [ ] 4.1 Enumerate first (BOUNDED): `grep -rn "focus:ring-2" src/components/ src/app/ | grep -v "__tests__"` — record the exact touched-set file list in apply-progress before editing (spec says touched set: `button.tsx` canonical + stragglers).
- [ ] 4.2 Migrate each enumerated file to the `focus-visible` pattern of `src/components/ui/action-icon-button.tsx:67` (ring on keyboard focus, primary token). Keyboard focus visibility preserved everywhere; mouse clicks no longer draw rings (focus-visible semantics).
- [ ] 4.3 Update/extend button component test where it asserts ring classes (RED→GREEN as applicable); run focused vitest on the touched component test files.
- [ ] 4.4 Verify zero `focus:ring-2` occurrences remain in the touched set; Tab-navigate keyboard spot check on Button (manual, documented in apply-progress).
- [ ] 4.5 Unit gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`.
- [ ] 4.6 Commit: `style(ui): unify focus-visible ring pattern across touched components`.

## Phase 5: Unit U5 — test(a11y) + docs(closeout): gates, re-scan evidence, validation report (one commit)

- [ ] 5.1 Axe re-scan run: `node e2e/load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test --config playwright.a11y.config.ts` — 20/20 combos COMPLETED (no truncation; verify raw JSON `combos` array length). Raw evidence must land in `openspec/changes/ux-12-polish-final/evidence/` (validates the U1 path re-point). Extract per-rule counts: MUST be 0 violations for `color-contrast`, `aria-prohibited-attr`, `label`, `select-name` across all 20 combos.
- [ ] 5.2 If any of the 4 triaged rules still violates: extract failing combo + site from raw JSON (do NOT patch blindly), fix the specific site, re-run. If an axe structural false positive: adjudicate as documented residual per `ux-stage-closeout` — never a silent skip.
- [ ] 5.3 Gate battery with real results recorded: `pnpm exec tsc --noEmit`; `pnpm lint`; `pnpm parity`; `pnpm build`; full suite `pnpm test` run with explicit timeout ≥ 2_900_000 ms (regulatory; suite ~21 min; NEVER allow a default 120s timeout to kill the run). Record each observed result + duration in the report.
- [ ] 5.4 TTI cold sample @375 (optional-cheap): one cold-load sample at 375px against the `docs/UX-5-TTI-REPORT.md` baseline row (read-only reference; do not edit UX-5 report). If skipped, the report records the omission explicitly.
- [ ] 5.5 Write `docs/UX-12-VALIDATION-REPORT.md` per `ux-stage-closeout` structure (English artifacts): (1) gate battery with real results/durations incl. full-suite timeout config ≥ 2_900_000 ms; (2) axe re-scan proof: 0 × 4 rules × 20 combos + raw evidence path; (3) FINAL H-01..H-19 table (19/19 CLOSED; H-14 act-2 = component file deletion here; H-16 act-2 = single-announcement channel realized via prohibited-attr fix — use the draft table from the UX-11 audit §6 / proposal §6 as input; each row gets an evidence pointer: test/scan entry/commit/doc); (4) §56 stage-closing declaration with evidence pointers; (5) honest residuals: UX-11 Part B attestation caveat, unflagged zinc-class persistence (token-level vs class-level truth), light `--tc-primary` residual if documented (per 2.4), any out-of-band re-scan findings triaged (or explicit "none surfaced").
- [ ] 5.6 Frozen-domain audit: `git diff <start-HEAD-SHA>..HEAD -- src/core/ src/infrastructure/` EMPTY + Mongoose models diff EMPTY; record as the freeze audit gate in the report.
- [ ] 5.7 Commit: `docs(ux-12): close-out validation report, gate battery results, a11y re-scan evidence`.

## Phase 6: Close mechanics (no commit unless fixes were needed)

- [ ] 6.1 Tick ALL task checkboxes in this file (apply marks `[x]` as units complete; this is the final full pass — no unchecked box may remain).
- [ ] 6.2 No-push proof: `git log --oneline master@{u}..master` (or `git status` ahead-count) confirms the 5 unit commits are LOCAL on `master` and untouched remote; NO `git push` in any unit log. Delivery is the orchestrator's job.
- [ ] 6.3 Final consistency: `openspec/changes/ux-12-polish-final/` contains `tasks.md` (all checked), `evidence/` (contrast-ratio-precheck.md + a11y-scan-raw.json), and updated `state.yaml`. Ready for sdd-verify.

---

## Verification Scenarios (mapped from specs)

| Spec scenario | Task |
|---|---|
| filter-bar: toast aria-label removed, announcements preserved | 1.1, 1.2 |
| filter-bar: 5 lists labels/selects associated; structure-only | 1.3.x, 1.4 |
| ui-token: dark primary/gold/surface-muted ≥ ratios; two-step evidenced | 2.1, 2.3 |
| ui-token: light primary bump-or-residual decided | 2.4, 5.5 |
| ui-token: CC-1..CC-7 exactly once; D6 untouched; no global migration | 2.5.x, 2.6 |
| navigation-ia: back-button deleted + test block same unit; importers re-check | 3.1–3.2 |
| navigation-ia: focus-visible unification; keyboard a11y preserved | 4.1–4.4 |
| alert: success variant + ≥2 real call sites; 4+2 migrations byte-identical; parity | 3.3–3.6 |
| ux-stage-closeout: report 5 sections with real data | 5.3–5.5 |
| frozen domain empty diff | 0.1 (anchor), 5.6 |
| no push | 6.2 |
