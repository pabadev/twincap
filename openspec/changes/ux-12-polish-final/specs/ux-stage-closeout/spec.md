# UX Stage Closeout Specification

## Purpose

Close-out evidence requirements for the FINAL UX roadmap stage (UX-12, consuming §56): the validation report that declarations stage officially closed, with audit-grade evidence for all four work classes (a11y structural, contrast HYBRID, cleanup/polish, gates) and an honest residuals record. This capability exists so the §56 stage-closing declaration is EVIDENCE-BACKED, not asserted.

Cross-cutting constraints: docs-only capability (no `src/` behavior changes beyond what sibling capability specs authorize), conventional commits on `master`, full-suite runs MUST use explicit regulatory timeouts.

## Requirements

### Requirement: UX-12 validation report

`docs/UX-12-VALIDATION-REPORT.md` MUST exist and MUST contain, at minimum:

1. **Gate battery with real results**: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm parity`, `pnpm build`, and the full Vitest suite `pnpm test` — each with its ACTUAL observed result and duration, and the full-suite run executed with an explicit timeout ≥ 2_900_000 ms (regulatory; suite measured ~21 min). A claimed-but-not-run gate is a spec violation.
2. **Axe re-scan proof**: 0 violations × 4 triaged rules (`color-contrast`, `aria-prohibited-attr`, `label`, `select-name`) × 20 combos, with raw JSON evidence path under `openspec/changes/ux-12-polish-final/evidence/`.
3. **FINAL 19-findings table (H-01..H-19)**: all 19 rows marked closed — 19/19; H-14 and H-16 close their "act 2" HERE (H-14: component file deletion; H-16: single-announcement channel fully realized with the prohibited-attr fix); each row carries a per-finding evidence pointer (test, scan entry, commit, or doc section).
4. **§56 stage-closing declaration**: the roadmap stage declared closed with evidence pointers to the gates, the re-scan, and the findings table.
5. **Honest residuals section**: (a) the UX-11 Part B attestation caveat (manual/attested items NOT re-proven by automation here, listed as such); (b) class-level zinc grays persist where unflagged — DS §2.1.5 becomes true at TOKEN level but unflagged class-level sites remain, documented rather than silenced; (c) any new out-of-band violation classes the re-scan surfaced, triaged.

#### Scenario: Report contains all five sections with real data

- GIVEN UX-12 implementation and verification are complete
- WHEN `docs/UX-12-VALIDATION-REPORT.md` is reviewed
- THEN it contains the gate battery with real results and durations, the re-scan proof with evidence path, the FINAL H-01..H-19 table (19/19 closed with per-finding pointers), the §56 declaration, and the residuals section
- AND the H-14/H-16 rows explicitly state their act-2 closure in UX-12

#### Scenario: Findings table is actually final

- GIVEN the findings table
- WHEN any row H-01..H-19 is inspected
- THEN its status is CLOSED with an evidence pointer — no row reads "open", "deferred", or "pending"

#### Scenario: Residuals are honest, not silent

- GIVEN the residuals section
- WHEN it is read
- THEN the UX-11 Part B attestation caveat and the unflagged zinc-class persistence are both explicitly recorded
- AND any out-of-band re-scan finding is listed with its adjudication (or the section states none surfaced)

### Requirement: Full-suite re-scan and gates run with explicit timeouts

The close-out's full-suite re-scan and gate battery MUST run with explicit timeout configurations: the full Vitest run with timeout ≥ 2_900_000 ms, and the a11y harness invocation configured so the 20-combo scan completes rather than being killed by a short default. Never retry-timeout with a shorter default; a legitimate retry documents the real error first.

#### Scenario: Suite run configuration verifiable

- GIVEN the gate battery evidence
- WHEN the run configuration is inspected
- THEN the full-suite timeout is ≥ 2_900_000 ms and the measured duration is recorded
- AND the re-scan evidence shows completed combos (20/20), not truncation

### Requirement: Optional TTI cold sample at 375

TTI cold-375 profiling is OPTIONAL and SHOULD be done if cheap: one cold-load sample at 375px recorded against the `docs/UX-5-TTI-REPORT.md` baseline row. If performed, the sample goes in the validation report with the same method as UX-5; if skipped, the report records the omission explicitly (never silent).

#### Scenario: TTI sample recorded or omission documented

- GIVEN the close-out report
- WHEN the TTI section is inspected
- THEN either one cold @375 row is present with method + result vs baseline, or an explicit "skipped, optional" note appears

### Requirement: No push, orchestrator delivers

The close-out units MUST NOT push to any remote: commits land on `master` locally and the ORCHESTRATOR handles delivery/push. No deploy workflow changes; the only Vercel project remains `twincap` (nothing created for `globalmoney`).

#### Scenario: No push in unit logs

- GIVEN the close-out work order
- WHEN the units execute
- THEN no `git push` occurs in any unit commit
- AND delivery is handled at orchestrator level

### Requirement: Frozen domain confirmation in close-out

The validation report MUST include the frozen-domain audit result: `git diff <start-HEAD>..HEAD -- src/core/ src/infrastructure/` and the Mongoose models diff are EMPTY (the financial domain was never touched across the whole stage).

#### Scenario: Frozen diff empty and recorded

- GIVEN the whole UX-12 change is committed
- WHEN the frozen-path diff is computed
- THEN it is EMPTY
- AND the report records that emptiness explicitly as the freeze audit gate
