# Proposal: UX-12 Polish Final — A11y Structural Fixes, Contrast (Hybrid), Cleanup & Stage Close-Out

## Intent

UX-12 is the closing stage of the UX roadmap (§56): it consumes the UX-11 automated axe audit (rooted in the founder's adjudication of 12 accepted P1s into the UX-12 backlog on 2026-09-18) and drives the final 19-finding table (H-01..H-19) to zero open entries. The audit evidence, verified at file:line on 2026-09-18, encodes four defect classes with exact evidence:

1. **A11y structural violations (P1)**: one prohibited `aria-label` on the toast `aria-live` container (16 axe entries = 1 component, `toast-provider.tsx:57-60`; absent on `/help` which sits outside `(main)`), plus 18 unassociated `<label>` elements and 2 bare selects across the 5 list filter bars. The measured 18 sites supersede the UX-10 D8 deferral estimate ("~21 sites") — this change closes that deferral with the measured inventory. Forms already a11y-hardened (FormFields from UX-10) are NOT touched.
2. **Color contrast (P2)**: the founder chose the HYBRID option — token-level corrections where a token is the root cause (DEC-DS-01 executed toward `--tc-*`), PLUS per-site class fixes for the 7 deduplicated axe surfaces (CC-1..CC-7). The full-global zinc migration (~90 sites) is explicitly NOT chosen.
3. **Dead code + banner duplication (P3)**: `back-button.tsx` has 0 importers; 3 auth danger banners + 1 feedback danger banner are still ad-hoc despite the Alert component existing, and the 2 success twins cross the DEC-DS-06 threshold (2+ uses → `success` variant justified).
4. **Final polish + close-out evidence (P4/P5)**: focus-visible ring unification, a 3-line DS motion addendum (documenting existing sanctioned transitions, no new animations — §56 forbids invention), the full gate battery, the a11y re-scan gate (0 violations for the 4 triaged rules across 20 combos), and `docs/UX-12-VALIDATION-REPORT.md` declaring the stage closed.

This is a UI/CSS/test-harness/docs change only. **The financial domain is frozen: zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models.**

## Scope

### In Scope

- **P1 — a11y structural fixes**:
  - Remove the prohibited `aria-label` from the `aria-live` container in `src/components/ui/toast-provider.tsx:57-60` (axe `aria-prohibited-attr`; the 16 findings collapse to this single component).
  - Associate the 18 unassociated `<label>` elements + 2 bare selects in the 5 list files: `src/components/sales/sale-list.tsx:163-195` (4 labels + status select), `src/components/credits/credits-granted-list.tsx:120-131` (4 labels), `src/components/credits/credits-received-list.tsx` (4), `src/components/payables/payables-list.tsx` (4), `src/components/transfers/transfers-list.tsx` (2 date labels + account/search label). Mechanism: retrofit via existing `FormField` or via `htmlFor`/`id` wiring; for selects, `select.tsx:31` already derives `id` from the `label` prop. This closes the UX-10 D8 deferral with the measured inventory.
  - Extend the a11y re-scan gate: `e2e-a11y/scan.spec.ts:254` currently writes evidence to the `ux-11-validation` path — update the output dir to the UX-12 change evidence dir.
- **P2 — Contrast HYBRID (DEC-DS-01 executed)**:
  - Token value corrections in `src/app/globals.css`: dark `--tc-primary` (white-on-primary in dark = 2.64 → darken to AA for white text), `--tc-brand-gold` (2.80 vs `--tc-surface-card` → darken for UI contexts), dark `--tc-surface-muted` (secondary text on cards 4.07–4.34 → ≥ 4.5). Verify light `--tc-primary` (borderline 4.42; bump if cheap) and `--tc-income`/`--tc-expense` on card.
  - Per-site class fixes for the 7 deduplicated axe color-contrast surfaces: **CC-1** secondary text `zinc-500`/`zinc-400` in ~9 flagged files (`summary-hero.tsx`, `summary-cards.tsx`, `movement-card.tsx`, `credits-granted-list.tsx`, `sale-list.tsx`); **CC-2** `summary-hero.tsx:83`; **CC-3** `nav.tsx:248` group labels; **CC-4** `logo.tsx:46-47` + `not-found.tsx:43` wordmark; **CC-5** `help/page.tsx:49,96,106`; **CC-6** dark primary buttons (closed via token correction); **CC-7** `nav.tsx:268` active tint. NO migration of the other ~90 zinc-class sites.
  - NO re-fixing of D6 surfaces (Button success `teal-700`, Toast info `blue-700`, Badge neutral, modal close `zinc-500`) — verified NOT present in axe findings.
- **P3 — Cleanup**:
  - Delete `src/components/ui/back-button.tsx` (0 importers, verified) AND remove its literal-file assertion in `src/__tests__/touch-target-imports.test.ts:21-25` in the same commit (tests stay green).
  - Migrate 3 `(auth)` danger banners (`auth-form.tsx:48`, `forgot-password-form.tsx:27`, `reset-password-form.tsx:27`) + `feedback-widget.tsx:71` danger → `Alert` component. `Alert` gains a `success` variant for the 2 success twins (`forgot-password-form.tsx:22`, `reset-password-form.tsx:22`) — DEC-DS-06 pull-rule (2+ uses) met. Copy stays byte-identical (existing i18n keys reused; `pnpm parity` unaffected).
- **P4 — Bounded polish**:
  - Unify the `focus-visible` ring pattern: `button.tsx` and any component still using `focus:ring-2` adopt the `focus-visible` pattern of `action-icon-button.tsx:67` (DS line 164).
  - DS motion addendum: 3 lines documenting the existing sanctioned transitions (theme 0.3s, toast 300ms, accordion 200ms). NO new animations, no page transitions, no stagger/shimmer (§56 forbids).
- **P5 — Close-out**:
  - Full gate battery: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm parity`, `pnpm build`, full suite `pnpm test` with explicit timeout ≥ 2,900,000 ms (regulatory).
  - A11y re-scan gate (e2e-a11y harness, 20 combos) with **0 violations** for the 4 triaged rules (`color-contrast`, `aria-prohibited-attr`, `label`, `select-name`); evidence to the UX-12 evidence dir.
  - TTI cold sample @375 (optional, cheap — one row against `docs/UX-5-TTI-REPORT.md` baseline).
  - `docs/UX-12-VALIDATION-REPORT.md`: axe re-scan results, gate results, the FINAL 19-findings table (H-01..H-19 all closed; H-14/H-16 close "act 2" here; draft table from UX-11 audit §6 as input), the §56 stage-closing declaration with evidence pointers, and honest residual notes (UX-11 Part B attestation caveat; per-site grays: DS §2.1.5 becomes true at token level but class-level zinc improvement persists where not flagged — documented, not silent).

### Out of Scope

- The full-global zinc-class migration (~90 remaining unflagged sites) — the founder chose HYBRID, not global.
- Any change in `src/core/`, `src/infrastructure/`, or Mongoose models (frozen financial domain; §47 freeze re-checked, never touched).
- Re-fixing D6 surfaces not in axe findings (Button success, Toast info, Badge neutral, modal close) — verified clean.
- Re-touching forms already a11y-hardened by UX-10 FormFields.
- New animations, page transitions, stagger/shimmer (§56 forbids invention) — the motion addendum documents, it does not add.
- Multiple workspaces, team UI, Compras module (permanently out per project rules).
- Deploy workflows or Vercel changes (single project `twincap`; nothing new).

## Capabilities

> Contract with sdd-spec. Existing capability specs researched in `openspec/specs/` (7 dirs: alert-component, empty-state-consistency, form-field-pattern, navigation-ia, pos-sale-confirmation, ui-token-compliance, validation-evidence).

### New Capabilities

- `filter-bar-a11y`: Label/control association discipline for list filter bars (the 5 list files). Covers the 18-label + 2-select retrofit rule, the Select `label`/`id` association contract (select.tsx derives id from label), the prohibition of bare form controls in filter bars, and the harness evidence path rule (scan output dir points at the owning change's evidence folder).
- `ux-stage-closeout`: Close-out evidence requirements for the final UX roadmap stage: the FINAL 19-findings table (H-01..H-19 zero open), §56 stage-closing declaration with evidence pointers, honest residual notes (attestation caveats, per-site grays documented), and the re-scan gate (0 violations for the 4 triaged axe rules across 20 combos).

### Modified Capabilities

- `ui-token-compliance`: Extends the contrast contract from the D6 local sub-set to the DEC-DS-01 token-level execution: dark `--tc-primary`, `--tc-brand-gold`, dark `--tc-surface-muted` corrections in `globals.css` with measured before/after ratios, light `--tc-primary` bump if cheap, plus the 7 CC per-site class surfaces. The prior spec's "no global token file rewrites" constraint is superseded in favor of bounded, measured token VALUE corrections (not renames, not new tokens).
- `alert-component`: Adds the `success` variant (DEC-DS-06 pull-rule now met by the 2 auth success banners) and migrates the remaining 4 ad-hoc danger banner sites onto `Alert`, with byte-identical copy (existing i18n keys, no parity impact).
- `navigation-ia`: Completes the H-14/H-16 "act 2": the BackButton component itself is deleted (the nav IA spec removed it from root list pages; `navigation-ia` covers nav IA hygiene) with its touch-target test assertion removed in the same unit.

## Approach

Five bounded units (P1–P5), each independently verifiable, ordered so the re-scan gate validates cumulative fixes:

1. **U1 (P1)** — `fix(a11y)`: toast `aria-label` removal + filter-bar label association in the 5 list files (FormFields where the pattern fits, `htmlFor`/`id` + Select `label`/`id` otherwise) + `scan.spec.ts:254` output path re-point. Reuse the existing patterns — no new primitives (Select already derives id from label; FormField already exists).
2. **U2 (P2)** — `fix(a11y)` HYBRID contrast: `globals.css` token value darkening for dark `--tc-primary`, `--tc-brand-gold`, dark `--tc-surface-muted` (measured with real ≥4.5 ratios; two-step darkening with intermediate implementation intent to reduce overshoot risk), then CC-1..CC-7 per-site class swaps. CC-6 closes via the token fix — no separate button edits.
3. **U3 (P3)** — `refactor(ui)` cleanup: back-button deletion + test assertion removal in the SAME commit; banner migrations; `alert.tsx` `success` variant. Copy byte-identical.
4. **U4 (P4)** — `style(ui)` focus-visible unification (grep `focus:ring-2`, migrate to the action-icon-button pattern) + DS motion addendum (docs only).
5. **U5 (P5)** — `test(a11y)` re-scan + `docs(ux-12)` validation report; then the full gate battery with the explicit ≥2,900,000 ms suite timeout.

No new dependencies. No new i18n keys (parity untouched for eviction, full-check once a run touches messages). Conventional commits, one per unit, on `master`, no push.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ui/toast-provider.tsx:57-60` | Modified | Remove prohibited `aria-label` on `aria-live` container (closes 16 axe entries) |
| `src/components/sales/sale-list.tsx:163-195` | Modified | 4 labels associated + status select labeled (CC-1 secondary text also touched here) |
| `src/components/credits/credits-granted-list.tsx:120-131` | Modified | 4 labels associated (CC-1 here too) |
| `src/components/credits/credits-received-list.tsx` | Modified | 4 labels associated |
| `src/components/payables/payables-list.tsx` | Modified | 4 labels associated |
| `src/components/transfers/transfers-list.tsx` | Modified | 2 date labels + account/search label associations |
| `src/app/globals.css` | Modified | Token VALUE corrections: dark `--tc-primary`, `--tc-brand-gold`, dark `--tc-surface-muted`; verify/bump light `--tc-primary`; verify `--tc-income`/`--tc-expense` on card |
| `src/components/dashboard/summary-hero.tsx:83 (+CC-1)` | Modified | CC-2 highlight color to AA; CC-1 secondary text |
| `src/components/dashboard/summary-cards.tsx` | Modified | CC-1 secondary text |
| `src/components/ui/movement-card.tsx` | Modified | CC-1 secondary text |
| `src/app/(main)/nav.tsx:248,268` | Modified | CC-3 group labels, CC-7 active tint |
| `src/components/ui/logo.tsx:46-47` | Modified | CC-4 wordmark contrast |
| `src/app/not-found.tsx:43` | Modified | CC-4 wordmark contrast |
| `src/app/help/page.tsx:49,96,106` | Modified | CC-5 text contrast |
| `src/components/ui/back-button.tsx` | Removed | Dead component (0 importers) |
| `src/__tests__/touch-target-imports.test.ts:21-25` | Modified | BackButton assertion removed (same unit as deletion) |
| `src/components/(auth)/auth-form.tsx:48` | Modified | Danger banner → `Alert variant="danger"` |
| `src/app/(auth)/forgot-password/forgot-password-form.tsx:22,27` | Modified | Success banner → `Alert variant="success"`; danger → `Alert` |
| `src/app/(auth)/reset-password/reset-password-form.tsx:22,27` | Modified | Same twin pattern |
| `src/components/feedback/feedback-widget.tsx:71` | Modified | Danger banner → `Alert` |
| `src/components/ui/alert.tsx` | Modified | New `success` variant |
| `src/components/ui/button.tsx` + any `focus:ring-2` users | Modified | `focus-visible` ring pattern per `action-icon-button.tsx:67` |
| `docs/UI-DESIGN-SYSTEM.md` (motion section) | Modified | 3-line motion addendum (existing sanctioned transitions only) |
| `e2e-a11y/scan.spec.ts:254` | Modified | Evidence output dir → `openspec/changes/ux-12-polish-final/evidence/` |
| `docs/UX-12-VALIDATION-REPORT.md` | New | Final 19-findings table, gates, §56 declaration, residuals |
| `openspec/changes/ux-12-polish-final/**` | New | SDD artifacts + raw scan evidence |
| `src/**` NOT changed | — | `src/core/`, `src/infrastructure/`, Mongoose models frozen (audit gate) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token darkening overshoots (brand colors visibly muted, brand identity loss) | Medium | Two-step darkening with intent confirmation at intermediate value; keep golden tokens' decorative usage (non-text) distinct from UI-text usage; the badge/brand surface that legitimately shows `--tc-brand-gold` at 2.80 for decorative use keeps the value evaluation per-context (UI contexts darken, decorative may pass) |
| Dark/light token interplay regresses one theme while fixing the other | Medium | A11y re-scan gate runs BOTH themes × both viewports (20 combos); `globals.css` diff reviewed per value with measured ratios |
| Filter-bar refactor (labels + FormField retrofit) changes layout/height | Low | Class-level `htmlFor`/`id` retrofit is structure-only; mobile-first verify at 375/768/1280 |
| Deleting back-button while some late importer exists | Low | 0 importers verified 2026-09-18; importers grep re-checked in the unit; test assertion removal is the same commit so the suite cannot silently reference the removed file |
| Alert migration changes copy (frozen triggers) | Low | Byte-identical copy from existing i18n keys; `pnpm parity` gate |
| Audit evidence was pre-verified but code may have drifted since 2026-09-18 audit | Low | Apply phase re-verifies each file:line before editing; tree is clean at change start |
| a11y scan reveals NEW violations beyond the triaged 4 rules (dynamic viewport combos) | Low | Out-of-scope findings are triaged into the report's residuals, not silently fixed; the gate criterion is specifically the 4 triaged rules = 0 |

## Rollback Plan

Per-unit reverts: each unit is one conventional commit — `git revert` re-applies the single unit cleanly. Specifics:

- **Token corrections**: restore the three prior values in `globals.css` (values are the entire diff; no renames or new tokens, so the revert is value-only).
- **Filter-bar a11y**: revert the 5 list files (associations only; no state or logic).
- **back-button**: restore the file + its test assertion (same unit).
- **Alert migration**: revert `alert.tsx` variant + 4 file migrations (component is additive — the `success` variant removability is verified at apply time by re-running the auth flows).
- **e2e-a11y path change**: revert the one path line; the ux-11 path remains in git history.
- **Docs/report**: new files — deletion is the rollback.
- If the re-scan gate still reports violations of the 4 triaged rules after fixes, DO NOT patch blindly: extract the failing combo from the raw JSON, fix the specific site, and re-run. If a violation is structural in axe itself (e.g., a false positive), adjudicate as a documented residual per `ux-stage-closeout`, not a silent skip.
- Zero rollback risk to the financial domain: nothing in `src/core/`, `src/infrastructure/`, or models changes (audit gate confirms empty `git diff` over frozen paths).

## Dependencies

- Prerequisite: UX-11 archived (2026-09-18, state `archived`; Part B closure recorded) and the a11y harness exists (`e2e-a11y/` + `playwright.a11y.config.ts`, currently present).
- Clean working tree at change start (audit file:line evidence is anchored to current HEAD).
- `@axe-core/playwright` devDependency already present (no manifest change).
- Run commands: e2e via `node e2e/load-e2e-env.cjs ...` pattern; full suite `pnpm test` with explicit ≥ 2,900,000 ms timeout; `pnpm parity`; `pnpm exec tsc --noEmit`; `pnpm lint`; `pnpm build`.
- Founder decisions consumed (not open): DEC-DS-01 HYBRID (this change executes it), DEC-DS-06 pull-rule validated for `success` variant, D8 deferral closure with measured 18-label inventory.

## Success Criteria

- [ ] A11y re-scan (20 combos) shows **0 violations** for `color-contrast`, `aria-prohibited-attr`, `label`, `select-name` (the 4 triaged rules); raw evidence in `openspec/changes/ux-12-polish-final/evidence/`, output path updated
- [ ] No `aria-label` on any `aria-live` container; all 18 labels + 2 selects in the 5 list files associated
- [ ] Token ratios measured: dark white-on-primary ≥ 4.5, gold UI contexts ≥ 4.5 vs `--tc-surface-card`, secondary-text-on-card ≥ 4.5 in both themes
- [ ] `back-button.tsx` deleted, `touch-target-imports.test.ts` updated, `pnpm test` on that file green
- [ ] 4 danger banners + 2 success banners render via `Alert` (`success` variant exists); copy byte-identical; `pnpm parity` green
- [ ] No component (touched set) uses `focus:ring-2`; unified `focus-visible` ring
- [ ] DS motion addendum documents the 3 sanctioned transitions; zero new animations
- [ ] Full gate battery green: `tsc --noEmit`, `lint`, `parity`, `build`, full suite (explicit ≥ 2,900,000 ms timeout)
- [ ] `docs/UX-12-VALIDATION-REPORT.md` exists with FINAL H-01..H-19 table (all closed), §56 stage-closing declaration with evidence pointers, and honest residual notes
- [ ] FROZEN DOMAIN audit: `git diff <start-HEAD>..HEAD -- src/core/ src/infrastructure/` and models diff are EMPTY
- [ ] `(optional)` TTI cold @375 sample recorded against the UX-5 baseline row
