# Delta for ui-token-compliance

## ADDED Requirements

### Requirement: DEC-DS-01 hybrid execution — token VALUE corrections

The HYBRID contrast option (founder decision 2026-09-18, executing DEC-DS-01) MUST be implemented as bounded, MEASURED token VALUE corrections in `src/app/globals.css` — value changes only: no token renames, no new tokens. Corrections:

- Dark `--tc-primary`: white-on-primary in dark theme measures 2.64 → MUST darken so white text on the token reaches ≥ 4.5:1 (AA).
- `--tc-brand-gold`: usage in UI-text contexts measures 2.80 vs `--tc-surface-card` → MUST darken so UI-context text contrast ≥ 4.5:1 (or ≥ 3:1 where the context is non-text UI). Decorative (non-text) contexts MAY retain the current value — the separation decorative vs. UI-context MUST be evaluated per usage site.
- Dark `--tc-surface-muted`: secondary text on cards measures 4.07–4.34 → MUST darken so secondary-on-card ≥ 4.5:1.
- Light `--tc-primary`: borderline 4.42 → SHOULD be bumped if a cheap value shift reaches ≥ 4.5:1 without visible brand distortion; otherwise the borderline value and rationale MUST be documented in the DS §2.1.5 addendum.
- `--tc-income` / `--tc-expense`: MUST be verified on card background in both themes; a failing value MUST be corrected.

Darkening SHOULD proceed two-step (intermediate value → render check → final value) to reduce risk of over-darkening the brand. Every corrected token MUST have its before/after ratio recorded in the change evidence and reflected in the DS §2.1.5 addendum.

#### Scenario: Dark primary reaches AA for white text

- GIVEN dark `--tc-primary` before the change measures white-on-primary 2.64
- WHEN the corrected value is applied and measured
- THEN white-on-primary ≥ 4.5:1 and the token diff is value-only (same name, no new tokens)

#### Scenario: Brand gold in UI context passes

- GIVEN `--tc-brand-gold` UI-context usage measured 2.80 vs `--tc-surface-card`
- WHEN the corrected value is applied and measured
- THEN the recorded UI-context ratio ≥ 4.5:1 (or ≥ 3:1 where the usage is non-text UI), with before/after documented
- AND decorative usages are explicitly reviewed and their evaluation per-context recorded

#### Scenario: Dark surface-muted passes for secondary text

- GIVEN dark `--tc-surface-muted` yields secondary-on-card 4.07–4.34
- WHEN the corrected value is applied and measured
- THEN secondary-on-card ≥ 4.5:1 in dark theme

#### Scenario: Light primary bump decision recorded

- GIVEN light `--tc-primary` measures 4.42 (borderline)
- WHEN the change ships
- THEN either the token is bumped to ≥ 4.5:1, or the DS §2.1.5 addendum documents the borderline value with the "not cheap without distortion" rationale

#### Scenario: Two-step darkening intent

- GIVEN a token darkening whose overshoot risk is non-trivial (dark `--tc-primary`, `--tc-brand-gold`)
- WHEN the correction is implemented
- THEN an intermediate value is rendered and evaluated before the final value lands (evidence: recorded intermediate evaluation)

### Requirement: Per-site class fixes for the 7 CC surfaces (bounded — NO global zinc migration)

Exactly the 7 deduplicated axe color-contrast surfaces (CC-1..CC-7) MUST receive per-site class fixes:

- **CC-1** — secondary text `zinc-500`/`zinc-400` in ~9 flagged files (`summary-hero.tsx`, `summary-cards.tsx`, `movement-card.tsx`, `credits-granted-list.tsx`, `sale-list.tsx`) → classes reaching ≥ 4.5:1 on their surfaces.
- **CC-2** — `summary-hero.tsx:83` highlight color → AA.
- **CC-3** — `nav.tsx:248` group label text → AA.
- **CC-4** — `logo.tsx:46-47` + `not-found.tsx:43` wordmark → AA.
- **CC-5** — `help/page.tsx:49,96,106` text contrast → AA.
- **CC-6** — dark primary buttons: closed via the dark `--tc-primary` token correction (no separate button edits).
- **CC-7** — `nav.tsx:268` active tint → AA.

The remaining ~90 unflagged zinc-class sites MUST NOT be migrated (founder chose HYBRID, not global). If CC-3/CC-7 are implemented within `nav.tsx` styling under this capability, they MUST land here and NOT be duplicated in `navigation-ia` (or vice versa — one implementation home per fix, no duplication; the assignment is recorded in the change design).

D6 surfaces (Button success `teal-700`, Toast info `blue-700`, Badge neutral, modal close `zinc-500`) are explicitly OUT — verified NOT present in axe findings; no re-fixing.

#### Scenario: Each CC surface fixed with no migration of unflagged sites

- GIVEN the per-site contrast commit
- WHEN the flagged files are inspected
- THEN each of CC-1..CC-5 and CC-7 has its contrast fix applied (CC-6 closes via token)
- AND unflagged zinc-class sites retain their existing classes (no drive-by migration)

#### Scenario: D6 surfaces untouched

- GIVEN the same commit
- WHEN `button.tsx` (success), `toast.tsx` (info), `badge.tsx`, and `modal.tsx` are inspected
- THEN no class changes appear relative to the D6 baseline

### Requirement: Re-scan gate — 0 color-contrast violations across 20 combos

After token + per-site fixes, the e2e-a11y re-scan (20 combos: both themes × viewports of the existing harness matrix) MUST report **0 violations** for the `color-contrast` rule (the other 3 triaged rules are gated in `filter-bar-a11y`). Raw evidence lands in the owning change's evidence dir. New violation classes outside the 4 triaged rules are NOT silently fixed — they are triaged into the close-out report's residuals.

#### Scenario: Color-contrast gate green

- GIVEN all contrast fixes are committed
- WHEN the 20-combo re-scan runs
- THEN 0 `color-contrast` violations appear across all combos
- AND raw JSON evidence is stored under the change's evidence folder

#### Scenario: Out-of-band findings triaged, not patched

- GIVEN the re-scan surfaces a violation outside the 4 triaged rules
- WHEN the change closes
- THEN the finding appears in the validation report's residuals (adjudicated), not as a silent skip

### Requirement: DS §2.1.5 addendum — token-level truth + motion clause

The design system's contrast record (DS §2.1.5) MUST be updated with an addendum reflecting TOKEN-LEVEL truth: corrected token values with their measured before/after ratios supersede the previous "per-surface estimate" framing, and note that DS §2.1.5 becomes true at token level while CLASS-level zinc grays persist where unflagged (documented, not silent). The addendum MUST also include a 3-line motion clause documenting the EXISTING sanctioned transitions only (theme switching ~0.3s, toast ~300ms, accordion ~200ms) — NO new animation systems, page transitions, or stagger/shimmer (§56 hierarchy: polish documents, does not invent).

#### Scenario: Addendum records token ratios

- GIVEN the DS addendum edit
- WHEN the addendum is read
- THEN each corrected token lists its before/after measured ratio and the light `--tc-primary` decision (bumped or documented-borderline)

#### Scenario: Motion addendum documents without inventing

- GIVEN the motion clause
- WHEN it is read
- THEN it documents only theme 0.3s, toast 300ms, accordion 200ms and forbids new animation systems
- AND zero new animation code ships in this change

### Requirement: Gates for the contrast unit

The contrast work MUST land as its own conventional commit (`fix(a11y):` or `refactor:`) on `master`, separate from the a11y-structural unit, so a visual regression can be reverted independently (revert = restore prior token values + per-site classes; value-only diff). MUST pass `pnpm exec tsc --noEmit`, `pnpm lint`, the full Vitest suite (explicit timeout ≥ 2_900_000 ms), `pnpm build`, and responsive verification at 375/768/1280 px (both themes). Zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models.

#### Scenario: Independent revert of contrast fixes

- GIVEN the contrast commit is landed
- WHEN a visual regression is found
- THEN `git revert` of that commit alone restores prior appearance (values are the entire diff)

#### Scenario: Gates green including full suite with regulatory timeout

- GIVEN the contrast commit is staged
- WHEN the gate battery runs
- THEN tsc, lint, build, and the full Vitest suite (run with explicit timeout ≥ 2_900_000 ms) pass
- AND the re-scan color-contrast gate (20 combos) reports 0 violations
