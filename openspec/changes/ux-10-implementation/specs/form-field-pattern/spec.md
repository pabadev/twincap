# Form Field Pattern Specification

## Purpose

FormField label/error/aria pattern, resolved by founder decision D8 (APPROVED 2026-09-18): EXTRACT `FormField` NOW. A new shared `FormField` component MUST be created in `src/components/ui/` centralizing the label + error + aria wiring pattern (per UX-4 DS §10 and UX-9 a11y patterns), and the forms in scope MUST migrate to it. Design fixes the exact form list (the approved DS cites ~6 uses); the spec does not pin an unbounded form list.

Cross-cutting constraints: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), every new visible string in `messages/es.json` AND `messages/en.json` (neutral Spanish, no voseo, `pnpm parity`), conventional commits on `master`.

## Requirements

### Requirement: Shared FormField component (D8 — APPROVED extraction)

A new `FormField` component MUST be created at `src/components/ui/form-field.tsx`, following the existing `src/components/ui/` patterns. It MUST centralize the label + error + aria wiring pattern currently duplicated per-form:

- `htmlFor`/`id` association between label and field control.
- `aria-describedby` binding to the error message element.
- `aria-invalid` set on the control when a validation error is present.
- Error message rendered adjacent to the field.
- Support for disabled state (per UX-4 DS:90).

#### Scenario: FormField renders label association

- GIVEN `FormField` rendered with a label and an input
- WHEN the DOM is inspected
- THEN the label's `htmlFor` matches the input's `id`

#### Scenario: FormField wires error accessibility

- GIVEN `FormField` rendered with a validation error message
- WHEN the DOM is inspected
- THEN the control carries `aria-invalid="true"` and `aria-describedby` pointing to the error message element
- AND the error message is visually adjacent to the field

#### Scenario: Valid field has no error wiring

- GIVEN `FormField` rendered with no error
- WHEN the DOM is inspected
- THEN the control has no `aria-invalid` and no error-describedby binding, and no error message renders

### Requirement: Migration of forms in scope

The forms identified by design (the ~6 uses the approved DS cites; design fixes the exact list) MUST be migrated to the shared `FormField`. The acceptance criterion is NOT an unbounded form list, but: every migrated form passes its existing tests AND its a11y wiring (label association, error binding, invalid state) is centralized in `FormField` rather than hand-rolled per form.

#### Scenario: Migrated forms pass existing tests

- GIVEN the forms selected by design for migration
- WHEN the full Vitest suite runs (timeout ≥ 2_700_000 ms)
- THEN every migrated form's existing tests pass (updated in the same commit if they assert on DOM structure)

#### Scenario: A11y wiring centralized

- GIVEN a migrated form's source
- WHEN inspected
- THEN label/error/aria wiring is done through `FormField` (no hand-rolled duplicate `htmlFor`/`aria-describedby`/`aria-invalid` plumbing left in the migrated form)

#### Scenario: Exact form list decided in design

- GIVEN the S6 design work is done
- WHEN the design artifact is reviewed
- THEN it contains the explicit list of forms migrated to `FormField` with the per-form rationale

### Requirement: No behavior or validation change

The FormField extraction MUST NOT change any form's validation logic, submission behavior, server actions, or error semantics — only the presentation/a11y wiring layer is centralized. Frozen domain applies: no changes in `src/core/`, `src/infrastructure/`, or Mongoose models.

#### Scenario: Validation semantics unchanged

- GIVEN a migrated form with an invalid submission
- WHEN the user submits
- THEN the same validation errors appear with the same copy (only the rendering mechanism is centralized)

#### Scenario: Scope check on diff

- GIVEN the D8 work unit is committed
- WHEN `git diff --stat` is inspected
- THEN only `src/components/ui/form-field.tsx` (new), the migrated forms, their tests, and (if needed) i18n files appear — nothing under `src/core/` or `src/infrastructure/`

### Requirement: Gates and i18n for D8 unit

The D8 work unit MUST be a conventional commit (`feat:` or `refactor:`) on branch `master` and MUST pass the §46 gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (explicit timeout ≥ 2_700_000 ms), `pnpm build`, responsive check at 375/768/1280 px (labels/errors readable on mobile), and an a11y spot check (screen-reader label/error announcement on a migrated form). Any new visible string MUST exist in both locales with `pnpm parity` green.

#### Scenario: Gates green after FormField extraction

- GIVEN the D8 commit is staged
- WHEN the gate suite runs
- THEN tsc, lint, build, and the full Vitest suite (timeout ≥ 2_700_000 ms) all pass
- AND a migrated form announces its label and error correctly to assistive tech
