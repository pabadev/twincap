# Archive Report — ux-12-polish-final

**Date**: 2026-09-18
**Status**: COMPLETE
**Artifact store**: openspec
**Chain**: cc71576..49c0d8d — 10 commits (e538341, 846fd37, 7cc2a71, 1f554b5, 8463e96, 6355e50, f18c230, bfa690d, dcc7fb9, 49c0d8d), 54 files, +2,026/−236, zero frozen-path changes, size:exception recorded (session budget 2,500 lines).

## Final State (per Final-State Authority)

Final numbers carried from the orchestrator's launch facts and the persisted evidence on HEAD `49c0d8d`; intermediate snapshots (`apply-progress`, `verify-report`) are treated as history only.

- **Gates at verify (fresh, on final tree)**: tsc 0 errors; `pnpm lint` 0 errors / 9 warnings (7 pre-existing + 2 new-in-phase — see W-1 below); `pnpm parity` 4/4; `pnpm build` OK; full Vitest suite **153 files / 1577 tests green** (24m50s, explicit runner timeout 3,000,000 ms).
- **Axe re-scan**: **0 violations total** (0 × 4 triaged rules × 20/20 combos), `scanGaps: []`. Raw evidence: `evidence/a11y-scan-raw.json`.
- **Frozen-domain diff**: `cc71576..HEAD` EMPTY (zero `src/core/`, `src/infrastructure/`, Mongoose models).
- **Contrast finals (HYBRID, DEC-DS-01 executed)**: light `--tc-primary` `#1447E6` (card 5.75), dark `--tc-primary` `#0069F5` (white 4.84), hovers `#0055D1` / blue-800 oklch ramp, light surface-muted 6.51, expense `#B91C1C` 5.45, income `#05523B` → landed `#067855` 4.62 (pre-check candidate `#05523B` refined at apply; final measured 4.62 — see `evidence/contrast-ratio-precheck.md` §5). CC-4 fixed per-site (cyan-800 5.73 / amber-800 5.59 equivalents; wordmark-only usage; brand-gold/teal tokens kept for decorative contexts). CC-6 closed via the dark primary token with **zero button.tsx color diff** (D6 surfaces untouched).
- **Spec walk**: 24 requirements / 49 scenario headings, COMPLIANT; 2 MANUAL verifications (responsive/keyboard spot checks), performed at apply.
- **Tasks**: 49/49 complete.
- **Verification**: sdd-verify COMPLETE — 0 CRITICAL, 1 WARNING, 3 SUGGESTIONS (see verify-report.md; WARNING and SUGGESTIONS dispositioned below).

## Findings Handling (archive-time)

- **W-1 (warning)** — Report §1 wording "9 pre-existing warnings" was imprecise: 2 of the 9 are NEW, from `filter-bar-a11y.test.tsx` created by e538341. **Fixed in the archive commit**: §1 line now reads "0 errors / 9 warnings (7 pre-existing + 2 new-in-phase)". W-1 CLOSED.
- **S-1 (suggestion)** — `evidence/contrast-ratio-precheck.md` lacked a supersession annotation at interim-value rows and had a duplicated "## 5." heading. **Fixed in the archive commit**: one-line supersession note added above the tables (interim rows retained for audit traceability; final values + axe re-scan arbiter supersede), and the second section renumbered "## 6. Per-site CC classes". S-1 CLOSED.
- **S-2 / S-3 (suggestions)** — state.yaml long-scalar formatting and CLI-form deviation: ACCEPTED as recorded in verify-report (no repo change warranted; the state file is an SDD hint, not repo style-governed).

## Stale-Requirement Supersession (spec sync)

Per the sdd-spec archive-time merge rule, the MAIN spec `openspec/specs/ui-token-compliance/spec.md` contained the stale requirement **"Global token correction stays deferred to UX-12"**. During the delta sync it was REMOVED (superseded by the ADDED "DEC-DS-01 hybrid execution — token VALUE corrections" requirement, now part of the canonical spec), and the Purpose section was annotated accordingly (deferral → executed). This is a deliberate, documented supersession directed at archive time — not a destructive merge.

## Stage Closure

**The UX/UI stage (2026-09-13 → 2026-09-18) CLOSES with this archive.** The stage comprised the domain/entity freeze decision and the UX-UI.md roadmap executed as 12 fases (UX-1..UX-12). §56 stage-closing declaration is written with evidence pointers in `docs/UX-12-VALIDATION-REPORT.md`; the `ux-stage-closeout` canonical spec now encodes the closure contract. **H-01..H-19: ALL CLOSED** — see the 19-findings table in `docs/UX-12-VALIDATION-REPORT.md` (H-14 act 2 = back-button file deletion, commit 7cc2a71-era unit; H-16 act 2 = toast aria-label removal, commit e538341-era unit — both completed this phase).

## Residuals (documented, accepted — not silently skipped)

1. §7.3 dark `text-primary` links ≈ 4.0:1 outside the 5 scanned routes, under the per-site triage policy (recorded in the validation report's residuals; spec's "triaged, not patched" scenario satisfied).
2. UX-11 Part B attestation caveat — historical, recorded in the UX-11 report (not a UX-12 finding).

## Synced Deltas → Canonical Specs

| Capability | Action | Details |
|---|---|---|
| ui-token-compliance | Updated | 5 ADDED reqs appended via `gentle-ai sdd-archive-compose` (exit 0); stale "deferred to UX-12" requirement REMOVED (superseded) |
| alert-component | Updated | 5 ADDED reqs appended via compose (exit 0) |
| navigation-ia | Updated | 4 ADDED reqs appended via compose (exit 0) |
| filter-bar-a11y | Created | Full spec copied mechanically (`diff -r` readback: EMPTY) |
| ux-stage-closeout | Created | Full spec copied mechanically (`diff -r` readback: EMPTY) |

**Source of truth updated**: `openspec/specs/{ui-token-compliance,alert-component,navigation-ia,filter-bar-a11y,ux-stage-closeout}/spec.md`.

## Archive Contents (observed)

- proposal.md: present
- specs/ (5 deltas): present
- tasks.md: 49/49 complete; 0 unfinished
- apply-progress.md: present (intermediate snapshot — superseded final facts above)
- verify-report.md: present (intermediate snapshot at HEAD 49c0d8d; findings dispositioned above)
- evidence/: present (a11y-scan-raw.json, contrast-ratio-precheck.md + scripts, u3-banner-migration.cjs)
- design.md: not present at change root — design decisions were embedded in tasks.md (DD-T1..DD-T4) and state.yaml notes, per the orchestrator's plan for this change; stored as-is, no gap repair attempted.

## SDD Cycle Complete

Implementation: COMPLETE (10 commits, gates green, axe 0). Verification: COMPLETE (0 CRITICAL; W-1 and S-1 fixed in archive commit; S-2/S-3 accepted). Unfinished tasks: none observed.
