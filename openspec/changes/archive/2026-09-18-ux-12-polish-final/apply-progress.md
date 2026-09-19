# Apply Progress — ux-12-polish-final (openspec artifact store)

Mode: STRICT TDD (`openspec/config.yaml` `rules.apply.tdd: true`, runner Vitest/pnpm).
Execution: auto (sequential U1→U5), delivery `single-pr` with recorded `size:exception`
(orchestrator preflight: `review_budget_lines=2500`; forecast ~1,500–2,000 lines fits budget).
NO push (Proof: `git log --oneline origin/master..master` = 9 local commits at close).
Start anchor: `cc71576` (clean tree; only the untracked openspec change dir).

## Phase 0 — preconditions

- [x] 0.1 Clean tree confirmed (untracked openspec dir only); HEAD `cc71576` recorded as frozen-diff anchor.
- [x] 0.2 Harness rule check: `e2e-a11y/scan.spec.ts` collects ALL axe violations (no rule filter) — the 4 triaged rules fully captured; no harness logic change.
- [x] 0.3 Prereqs present: `e2e-a11y/`, `playwright.a11y.config.ts`, `@axe-core/playwright@^4.13.0`, archive `2026-09-18-ux-11-validation/` exists.
- [x] 0.4 Anchor re-verified (drift noted): the 5 list files live under `src/app/(main)/...` NOT `src/components/**` (proposal affected-area path approximation): `pos/sales/sale-list.tsx`, `credits/{granted,received}/*-list.tsx`, `payables/payables-list.tsx`, `transfers/transfers-list.tsx`. `toast-provider.tsx:57-60` ✓; `nav.tsx:248,268` ✓; `summary-hero.tsx:61,67,83` ✓; back-button 0 importers ✓ (re-grepped); banner lines 48/22/27/27/71 exact ✓. Inventories measured: 18 labels + **4** bare bar Selects (sale, credits granted/received, payables — the spec counted 2; the other 2 were silently bare and would trip `select-name`, so all 4 got names).

## U1 — fix(a11y) `e538341`

Per-file DD-T3 choice (**documented, all bare `htmlFor`/`id` — NO FormField**: inline filter-bar layouts; FormField's block-label markup would change visible layout):
`sale-list.tsx` (sale-filter-{date-from,date-to,status,search}; status Select via `id` prop wired to the visible label), `credits-granted-list.tsx` (credits-granted-filter-_, Select included), `credits-received-list.tsx` (same), `payables-list.tsx` (payables-filter-_, Select included — measured inventory correction), `transfers-list.tsx` (transfers-filter-{date-from,date-to}; NOTE: proposal said "account/search label" — the actual filter bar has ONLY the 2 date labels; no account/search control exists — inventory correction recorded).

Toast: provider's `aria-label` removed; inner toast items carry the message text node (announcement preserved, H-16 channel intact). `useT`/`tCommon` now unused → import dropped (lint-clean).
scan.spec.ts:26 + :254 re-pointed to `ux-12-polish-final/evidence` (DD-T4).
Tests: `toast.test.tsx` (aria-label null + one region + single-channel suite intact) and new `src/app/(main)/filter-bar-a11y.test.tsx` (5 render+association tests, non-empty-loop guards).
RED→GREEN: RED run 6 failing (toast 1 + lists 5) → GREEN 8/8 passing after implementation.
Gates: tsc 0, lint 0 errors, build OK. `git diff --stat` = exactly 8 files (5 lists, toast-provider+test, scan.spec, new test) + openspec artifacts.

## U2 — fix(a11y) contrast HYBRID `846fd37`

Task 2.1 ran FIRST (`evidence/contrast-ratio-precheck.md`): computed white/surface vs candidates with a validated calculator (reproduced audit's 2.64 and 4.42 exactly). Chosen final values: above in the report §3.
Light `--tc-primary` BUMPED (#1447E6) — standard ramp step, no brand distortion → CC-7 light closes. Light `--tc-expense`/`--tc-surface-muted` corrected; light income corrected (two-step, final `#05523B` driven by the re-scan chip contexts). Dark brand tokens already passing → kept (per-context evaluation recorded).
Per-site CC-1 (5 flagged files only), CC-2, CC-3, CC-4 (logo+not-found, dark classes preserved), CC-5 (help 2 text sites; link site closed via token), CC-7 dark (`dark:text-foreground` in nav active), CC-6 via token (button.tsx diff EMPTY ✓, D6 files diff EMPTY ✓ per task 2.6). No unflagged zinc migration.
DS addendum §2.3 (token-level truth + 3-line motion clause, docs-only, Spanish per the existing DS doc).
N/A note (task 2.2): value-only CSS unit — validated by precheck ratios + axe re-scan, as tasks specify.
Gates: tsc 0, lint 0 errors, build OK.

## U3 — refactor(ui) `7cc2a71`

Importer re-check: 0 importer files for `back-button` (only its own file + the test + historical docs). Deletion + assertion block removal in the SAME commit; focused test 2/2 green.
RED→GREEN for the success variant: new alert tests written first (1 failing), then `alert.tsx` extended (`CircleCheck` icon, `bg-success/10`, `text-success`; same props contract) → 7/7.
4 danger + 2 success banners migrated with byte-identical copy (existing i18n keys; `messages/` diff EMPTY; parity 4/4). Trigger conditions untouched. No `error-state.tsx` exists (task 3.7 ✓).
Banner-DOM tests: none exist for the migrated files (feedback-widget is mocked in nav/dashboard-content tests) — per task 3.6, only tests that exist must be updated; none pinned the banner DOM.

## U4 — style(ui) `1f554b5`

Enumerated `focus:ring-2` touched set (grep, pre-edit): `button.tsx`, `toast.tsx`, `global-movement-provider.tsx` (3 sites), `not-found.tsx`. TDD: new `focus-visible.test.ts` written first (3 RED) → migrate all to the `action-icon-button.tsx:67` pattern (`focus-visible:ring-2 …`, variant ring colors kept) → 3/3 GREEN; 0 `focus:ring-2` remain in the touched set. Keyboard focus visibility preserved (ring on keyboard focus only; manual Tab spot-check documented here).
Gates: tsc 0, lint 0, build OK.

## U5 — test(a11y) + docs(closeout)

- Re-scan run 1: 11 entries → bounded per-site iteration (5.2) commits `8463e96`, `6355e50`, `f18c230`; re-runs 5 → 3 → **0 violations × 20/20 combos** (final run 4.9 m, zero scan gaps, not truncated).
- Gate battery final: tsc 0 · lint 0/9 pre-existing warnings · parity 4/4 · build OK · full suite 1577/1577 (25 m 37 s, explicit timeout ≥ 2,900,000 ms). First full run found 1 brittle class-string assertion in `movement-card.test.tsx` → updated (`bfa690d`, approval-style), suite green.
- TTI cold @375: **skipped (explicit)** — reason recorded in the report residuals; H-17 stands on the UX-11 Part A measured run (read-only reference).
- Frozen-domain audit: EMPTY `git diff cc71576..HEAD -- src/core/ src/infrastructure/`, 0 model files (report §6).
- Report: `docs/UX-12-VALIDATION-REPORT.md` (gates with real numbers, re-scan proof, FINAL H-01..H-19 table 19/19 CLOSED with per-finding pointers, §56 declaration, honest residuals).

## TDD Cycle Evidence

| Task          | Test file                                             | Layer                | Safety net      | RED                        | GREEN        | TRIANGULATE                                 | REFACTOR |
| ------------- | ----------------------------------------------------- | -------------------- | --------------- | -------------------------- | ------------ | ------------------------------------------- | -------- |
| 1.1/1.2 toast | `src/components/ui/__tests__/toast.test.tsx` (+suite) | Unit (jsdom)         | ✅ 3/3 baseline | ✅ flipped assertion → RED | ✅ 4/4       | ➖ single channel (spec single behavior)    | ➖       |
| 1.3/1.4       | `src/app/(main)/filter-bar-a11y.test.tsx`             | Unit (static markup) | N/A (new)       | ✅ 5 RED                   | ✅ 5/5       | ✅ 5 per-list cases (different data shapes) | ➖       |
| 2.x           | N/A — value-only CSS (tasks 2.2)                      | —                    | —               | —                          | —            | —                                           | ➖       |
| 3.2           | `src/__tests__/touch-target-imports.test.ts`          | Unit (fs)            | ✅ 3→2          | ➖ removal (approval)      | ✅ 2/2       | ➖                                          | ➖       |
| 3.3           | `src/components/ui/__tests__/alert.test.tsx`          | Unit (static)        | ✅ 5/5          | ✅ 2 new RED               | ✅ 7/7       | ✅ 2 cases (variant + contract)             | ➖       |
| 4.1-4.3       | `src/components/ui/__tests__/focus-visible.test.ts`   | Unit (fs)            | N/A (new)       | ✅ 3 RED                   | ✅ 3/3       | ✅ canonical + touched-set + keyboard-keep  | ➖       |
| 5.x           | full suite + harness                                  | E2E/integration      | —               | —                          | ✅ 1577/1577 | —                                           | ➖       |

## Work Unit / PR boundary

Mode: single PR, 5 unit commits + 4 bounded-fix commits (`size:exception` recorded; final authored lines — see `git diff --stat cc71576..HEAD` excluding openspec evidence JSON). Rollback boundaries per unit: one commit each (report §1/§8 lists hashes).
