# UI Token Compliance Specification

## Purpose

Design-token discipline for color usage (DEC-DS-01/03 residue): two raw color literals that escaped tokenization are corrected, plus the founder-approved contrast AA LOCAL SUB-SET (decision D6, 2026-09-18) — Button success variant, Toast info, Badge `/10` tints, and modal close icon `zinc-400→zinc-500`. The global `--tc-*` token correction is NOT in this change: it stays deferred to UX-12. External tool verification of contrast is part of the sub-set's acceptance evidence.

Cross-cutting constraints: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), no global token file rewrites, dark mode guarantee (DS §5) preserved, conventional commits on `master`.

## Requirements

### Requirement: Transfer-form danger literal to token (DEC-DS-01)

The transfer form (`src/components/transfers/transfer-form.tsx`, line ~376) MUST replace the raw literal `text-red-600 dark:text-red-400` with the `text-danger` design token. No other behavior of the transfer form changes.

#### Scenario: Danger text uses token

- GIVEN the transfer form renders a danger-colored validation/error text
- WHEN the class list is inspected
- THEN it uses the `text-danger` token class (no `text-red-600`/`text-red-400` literals on the touched line)
- AND the visible appearance remains a danger color in both light and dark themes

### Requirement: Button residual indigo literal to token (DEC-DS-03)

The Button component (`src/components/ui/button.tsx`, line ~26) MUST replace the residual raw `hover:bg-indigo-50` with the equivalent brand/token class per DEC-DS-03 (brand accents from `brand-teal`/`brand-gold`, no raw indigo). The change is scoped to the touched variant/line; Button behavior and variants otherwise unchanged.

#### Scenario: No raw indigo on touched line

- GIVEN the Button component source
- WHEN the touched line(s) are inspected
- THEN no `bg-indigo-*` literal remains and the hover accent resolves to a brand/token color
- AND all existing Button variant tests still pass unchanged

### Requirement: Contrast AA local sub-set (D6 — APPROVED 2026-09-18)

Per the founder-approved D6 decision, the contrast AA LOCAL SUB-SET from `docs/UX-9-CONTRAST-EVIDENCE.md` §5 (§5.1 impact table) MUST be implemented as LOCAL changes only, without modifying any global `--tc-*` token:

1. Button `success` variant: darker local success tone (raise white-on-green ratio from 3.65 toward ≥ 4.5) — Toast success remains pending for UX-12.
2. Toast `info` variant: alternative text color or local tone (raise 3.17 toward ≥ 4.5 for the info item).
3. Badge: `text-{variant}` on `/10` tints — raise tint opacity or switch to `text-zinc-900`/`text-white` per variant (raise 1.74–2.92 toward ≥ 4.5; visible pill contrast increase is an accepted appearance change).
4. Modal close icon: `text-zinc-400` → `text-zinc-500` (2.16 → ~4.07; satisfies 3:1 non-text UI).

#### Scenario: Sub-set implemented locally

- GIVEN the D6 sub-set work unit is applied
- WHEN `button.tsx` (success variant), `toast.tsx` (info variant), `badge.tsx`, and `modal.tsx` are inspected
- THEN each of the four local corrections is present
- AND the global token definitions in `globals.css` show ZERO diffs (`--tc-*` untouched)

#### Scenario: Dark mode unaffected

- GIVEN the four local corrections are applied
- WHEN the components render in dark mode
- THEN dark-mode styling remains intact (no regressions from the light-tone adjustments)

#### Scenario: Component tests still green

- GIVEN existing Button, Toast, Badge, and Modal tests
- WHEN the full Vitest suite runs (timeout ≥ 2_700_000 ms)
- THEN all component tests pass with the sub-set applied (appearance-change assertions updated in the same commit if needed)

### Requirement: Global token correction stays deferred to UX-12

This change MUST NOT perform the global `--tc-*` token correction. The deferral MUST be recorded explicitly (decision artifact/design note) so it is not a silent omission. UX-12 owns the global correction with its own separately-verifiable unit.

#### Scenario: No global token diffs

- GIVEN the entire UX-10 change is committed
- WHEN `git diff` against base is inspected for token definition files (e.g., `globals.css` token block)
- THEN no `--tc-*` token value changed

#### Scenario: Deferral documented

- GIVEN D6 scope was narrowed to the local sub-set
- WHEN the design/decision artifact is reviewed
- THEN it records that global `--tc-*` correction is deferred to UX-12 with rationale

### Requirement: Sub-set as isolated work unit

The D6 sub-set changes MUST land as their own conventional commit (`refactor:` or `feat:`), SEPARATE from the two token-literal fixes, so a visual regression can be reverted independently without touching the literal fixes.

#### Scenario: Independent revert

- GIVEN the S4 commits are landed
- WHEN a visual regression is found in the sub-set
- THEN `git revert` of the sub-set commit alone restores prior appearance while the literal fixes remain in place

### Requirement: Gates for S4

The S4 work units MUST pass the §46 gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (explicit timeout ≥ 2_700_000 ms), `pnpm build`, responsive check at 375/768/1280 px, and a11y spot check. If any visible string changes (not expected), `pnpm parity` MUST pass. Commits are conventional, on branch `master`.

#### Scenario: Gates green after token corrections

- GIVEN the S4 commits are staged
- WHEN the gate suite runs
- THEN tsc, lint, build, and the full Vitest suite (timeout ≥ 2_700_000 ms) all pass
