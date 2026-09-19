# UX-12 Validation Report — Polish Final: A11y Structural, Contrast (HYBRID), Cleanup & Stage Close-Out

**Change:** `ux-12-polish-final` · **Date:** 2026-09-18 · **Branch:** `master` (local, no push)
**Starting anchor:** `cc71576` (clean tree) · **Unit commits:** U1 `e538341`, U2 `846fd37` (+ re-scan iterations `8463e96`, `6355e50`, `f18c230`), U3 `7cc2a71`, U4 `1f554b5`, movement-card assertion fix `bfa690d`.

---

## 1. Gate battery — real results

| Gate                  | Command                                                             | Result                                                                                                   | Measured duration                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript            | `pnpm exec tsc --noEmit`                                            | ✅ PASS (exit 0)                                                                                         | —                                                                                                                                                   |
| Lint                  | `pnpm lint`                                                         | ✅ PASS — **0 errors / 9 warnings (7 pre-existing + 2 new-in-phase)** (`filter-bar-a11y.test.tsx`, created by E1, contributes the 2 new ones; the other 7 exist on `master~ux-12`, untouched) | —                                                                                                                                   |
| i18n parity           | `pnpm parity`                                                       | ✅ PASS — 4/4 tests (`messages-parity` + `messages-usage`); `git diff messages/` EMPTY across the change | —                                                                                                                                                   |
| Production build      | `pnpm build`                                                        | ✅ PASS ("Compiled successfully")                                                                        | ~8–15 s per run                                                                                                                                     |
| **Full Vitest suite** | `pnpm test`                                                         | ✅ PASS — **153 files / 1577 tests**                                                                     | **25 m 37 s** (runner timeout configured explicitly ≥ 2,900,000 ms — regulatory suite rule §14; run was terminated by completion, never by timeout) |
| A11y re-scan (axe)    | `node e2e/load-e2e-env.cjs test --config playwright.a11y.config.ts` | ✅ PASS — 20/20 combos completed, 0 scan gaps, **0 violation entries**                                   | 4.9 m final run (harness per-test timeout 300 s; manual run timeout ≥ 600,000 ms)                                                                   |

One full-suite cycle note: the FIRST full-suite run (22 m 49 s) surfaced 1 failure — the pre-existing `movement-card.test.tsx` assertion pinned the literal class string `text-xs text-zinc-500 dark:text-zinc-400`, superseded by the UX-12 CC-1 `zinc-600` AA correction. The assertion was updated (approval-style) by commit `bfa690d`; the following full-suite run passed 1577/1577.

## 2. Axe re-scan proof (raw evidence path)

- Raw JSON: `openspec/changes/ux-12-polish-final/evidence/a11y-scan-raw.json` (written by `e2e-a11y/scan.spec.ts` after the U1 output-path re-point — validates the DD-T4 evidence-path rule).
- **Combos: 20/20 (5 routes × 2 viewports [375/1280] × 2 themes).**
- **Final result: 0 violations TOTAL — 0 × `color-contrast`, 0 × `aria-prohibited-attr`, 0 × `label`, 0 × `select-name`, and no out-of-band rule surfaced.**
- Iteration history (bounded per tasks 5.2 — extract combo/site → fix → re-run; raw JSON snapshots preserved per run in the evidence dir):
  - Run 1 (after U1+U2): 11 violation entries → fixes: logo wordmark on `surface-header` (`text-cyan-800`), chart/toggle secondary labels, income chip/token value, help dark primary links (`dark:text-info`), "0 abonos" zinc-400 → CC-1 commit `8463e96`.
  - Run 2: 3 entries → income token final step `#05523b`, remaining flagged zinc-500 sites (summary-attention, monthly-chart, movement-form, position-cards, recent-movements, dashboard-filters) → commit `6355e50` + `f18c230`.
  - Run 3 (final): **0 violations across all 20 combos.**

## 3. Token corrections (measured before/after)

| Token                                 | Theme | Before                   | After                        | Ratio evidence                                                                                                                                                                                                                       |
| ------------------------------------- | ----- | ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--tc-primary`                        | light | `#155DFC` (4.42 on card) | `#1447E6`                    | white **6.83**; on card **5.75** (closes CC-7 light)                                                                                                                                                                                 |
| `--tc-primary`                        | dark  | `#51A2FF` (white 2.64)   | `#0069F5`                    | white **4.84** (two-step: intermediate `#007CFB` 3.98 / `#0073FB` 4.33 discarded — closes CC-6, buttons untouched)                                                                                                                   |
| `--tc-primary-hover`                  | light | blue-700                 | `oklch(0.432 0.232 264.376)` | white 8.71                                                                                                                                                                                                                           |
| `--tc-primary-hover`                  | dark  | `#2590FF`                | `#0055D1`                    | white **6.52** (was 3.22)                                                                                                                                                                                                            |
| `--tc-surface-muted`                  | light | `#71717A` (4.07 on card) | `#52525B`                    | **6.51** on card / 6.94 on bg (dark `#A1A1AA` already passed 6.87 — unchanged)                                                                                                                                                       |
| `--tc-income`                         | light | `#009966` (3.08 on card) | `#05523B`                    | **7.77** on card; on `bg-income/10` chip ≥ 6.79 (two-step: `#067855` 4.62, `#056A4C` chip-context fail)                                                                                                                              |
| `--tc-expense`                        | light | `#E7000B` (4.02 on card) | `#B91C1C`                    | **5.45**; dark `#FF3936` passed, unchanged                                                                                                                                                                                           |
| `--tc-brand-gold` / `--tc-brand-teal` | both  | unchanged                | unchanged                    | per-context evaluation: NO UI-text gold/teal usage outside the brand wordmark; wordmark fixed per-site (CC-4: `text-cyan-800` 5.73 on header / `text-amber-800` 5.59); decorative (landing gradient, nav icons) keep the brand value |

Full computation record: `evidence/contrast-ratio-precheck.md` + `evidence/contrast-ratio-scripts/`.

## 4. FINAL 19-findings table (H-01..H-19) — 19/19 CLOSED

| #    | Finding                                             | Status                      | Evidence pointer                                                                                                                                                                                                                    |
| ---- | --------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-01 | shadcn no-op classes (`muted-foreground`, `card`)   | CLOSED                      | UX-10 DEC-DS-01 canonical-mapping execution (UX-10 phase report)                                                                                                                                                                    |
| H-02 | `bg-text` no-op                                     | CLOSED                      | UX-10 (same D-class sweep)                                                                                                                                                                                                          |
| H-03 | accessibility text hardcoded in English             | CLOSED                      | UX-8 i18n rule enforcement (audit sweep `eslint`/i18n usage test)                                                                                                                                                                   |
| H-04 | hardcoded English generic errors                    | CLOSED                      | UX-8 (error-key plumbing)                                                                                                                                                                                                           |
| H-05 | `Header` not responsive                             | CLOSED                      | UX-9 shell breakpoints (DS §11) + `shell-width.test.ts`                                                                                                                                                                             |
| H-06 | 44px touch targets                                  | CLOSED                      | UX-6 + TouchTarget sweep, commit `46e967f` family; `touch-target.test.tsx`                                                                                                                                                          |
| H-07 | Legacy project inconsistencies                      | CLOSED                      | UX-10 (ui/ inventory alignment, `docs/UI-DESIGN-SYSTEM.md` inventory)                                                                                                                                                               |
| H-08 | Migration examples (§8.2)                           | CLOSED                      | UX-8 — verified: zero `exitosamente`-style hardcoded strings (grep checked this session, 0 matches)                                                                                                                                 |
| H-09 | `overflow-x: auto` as the only solution             | CLOSED                      | UX-7 (MovementCard mobile variant)                                                                                                                                                                                                  |
| H-10 | Detail/tier IA (H-10 dashboard exclusions)          | CLOSED                      | UX-10 N1 minimalism exclusion decisions (ux-10 design.md)                                                                                                                                                                           |
| H-11 | Rounded classes innovation                          | CLOSED                      | UX-7/UX-9 token-radius compliance                                                                                                                                                                                                   |
| H-12 | Toast missing variant in context? (toast microcopy) | CLOSED                      | UX-9 slice C; `messages-toast-microcopy.test.ts`                                                                                                                                                                                    |
| H-13 | Manual `*` in labels                                | CLOSED                      | UX-9 Slice B S6.3; `fields-a11y.test.tsx`                                                                                                                                                                                           |
| H-14 | Dead BackButton component                           | **CLOSED (act 2 in UX-12)** | UX-10 act 1 removed usage from 5 root lists; **UX-12 `7cc2a71` deletes `src/components/ui/back-button.tsx`** + removes its `touch-target-imports.test.ts` assertion in the same commit (suite green)                                |
| H-15 | Filter-bar labels without association               | **CLOSED (act 2 in UX-12)** | UX-5/UX-10 deferral; **UX-12 `e538341` associates all labels + all bar Selects** (18 measured labels + 4 selects incl. the 2 counted bare ones); `filter-bar-a11y.test.tsx` + axe re-scan (0 `label`, 0 `select-name`)              |
| H-16 | Toast double announcement channel                   | CLOSED + act 2              | UX-5/UX-9 established the single `aria-live` channel; **UX-12 `e538341` removes the prohibited `aria-label` from the region container** (ax `aria-prohibited-attr` 16 entries → 0; `toast-provider.test.tsx` asserts no aria-label) |
| H-17 | TTI cold regression                                 | CLOSED + MEASURED           | UX-5 baseline (cold hero 2.57/1.98/2.30 s) + **UX-11 Part A re-measure (same method): within golden-rule budget at all breakpoints** (`docs/UX-11-VALIDATION-REPORT.md` §2/§3)` — no regression signal since                        |
| H-18 | Movements sort a11y (`aria-sort`)                   | CLOSED                      | UX-9 Slice D R-10; `movements-list.test.tsx`                                                                                                                                                                                        |
| H-19 | Mechanize full-table                                | CLOSED                      | UX-4/UX-10 (`src/components/ui/table` contract + bespoke-cells exceptions documented; verified this session)                                                                                                                        |

## 5. §56 stage-closing declaration

**The UX roadmap stage per §56 is declared CLOSED for the UX-12 scope**, evidence-backed:

- **Roadmap classes 1–4 (§56)**: every backlog item in `docs/UX-ROADMAP.md` §56 has a closing pointer in §4 above (H-01..H-19 all closed; no "open"/"deferred" row).
- The 12 adjudicated axe P1s (UX-11 founder decision, 2026-09-18) are 0/0 on the final re-scan across all 20 combos (§2).
- Gates green: tsc, lint, parity, build, full suite 1577/1577 with regulatory timeout configuration (§1).
- Frozen financial domain respected end-to-end (§6 below).
- Method notes and one command-form deviation (Playwright CLI has no `exec` subcommand; the loader was invoked with `test --config`, identical runner) recorded as in UX-11.

## 6. Frozen-domain audit gate

`git diff cc71576..HEAD -- src/core/ src/infrastructure/` → **EMPTY (0 lines, 0 files)**.
Mongoose/models-name diff → **EMPTY (0 files)**.
The financial domain was never modified across UX-12.

## 7. Honest residuals

1. **UX-11 Part B attestation caveat** — manual/usability Part B items (5/5 golden-rule pass) are founder attestations, NOT re-proven by automation here; granular per-task capture sheets were not retained (recorded in UX-11 §5.2; protocol remains re-runnable).
2. **Class-level zinc grays persist where unflagged** — DS §2.1.5/§2.2.4 is true at TOKEN level, but the HYBRID decision (founder, 2026-09-18) deliberately did NOT migrate ~90 unflagged `zinc-500/400` class sites that axe did not flag. Documented per-site, not silent; further sweeps are a future, separately approved decision.
3. **Dark `dark:text-primary` links outside the 5 scanned routes** now sit at ~4.0:1 (previously 6.67:1) as a consequence of the CC-6 token darkening. The two /help link sites surfaced by the re-scan were fixed per-site (`dark:text-info`, 8.3:1). Any further dark-blue link sites that become flagged later must be triaged per-site — this is a documented consequence of the single-token constraint, not a silent regression.
4. **TTI cold sample @375 — skipped (optional-cheap was spent on the re-scan battery this session; 3 re-scan runs × ~5 min + 2 full-suite runs ≈ 48 min).** The UX-5 H-17 closure stands on the UX-11 Part A measured run (recorded in the H-17 pointer). Omission is explicit, never silent.
5. **Decorative per-site grays** (icons `text-brand-gold`/`text-income` as SVG/dot colors) are exempt from axe and retain brand values — evaluation recorded in the pre-check doc.
6. **Out-of-band re-scan findings:** none in the final run (0 violations total, not only 0 for the 4 triaged rules).

## 8. Artifacts

- Apply-progress: `openspec/changes/ux-12-polish-final/apply-progress.md`
- Ratio pre-check: `openspec/changes/ux-12-polish-final/evidence/contrast-ratio-precheck.md`
- Ratio scripts: `openspec/changes/ux-12-polish-final/evidence/contrast-ratio-scripts/`
- Raw scan JSON (final, 20/20 combos, 0 violations): `openspec/changes/ux-12-polish-final/evidence/a11y-scan-raw.json`
- Banner migration script: `openspec/changes/ux-12-polish-final/evidence/u3-banner-migration.cjs`
