# Alert Component Specification

## Purpose

Extract a reusable `Alert` component into `src/components/ui/` (DEC-DS-06: abstraction only at 2+ real uses — the threshold is now met with 4 danger banners + 1 info banner) and migrate the five ad-hoc banner surfaces onto it. The copy and triggers stay byte-identical where UX-8 froze them. ErrorState is explicitly NOT created (does not meet the 2+ real-uses threshold; deferral documented).

Cross-cutting constraints: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), every new visible string in `messages/es.json` AND `messages/en.json` (neutral Spanish, no voseo, `pnpm parity`), Toast keys byte-identical (Alert MUST NOT touch Toast copy), conventional commits on `master`.

## Requirements

### Requirement: Reusable Alert component

A new `Alert` component MUST be created at `src/components/ui/alert.tsx`, following the existing `src/components/ui/` component patterns (Tailwind v4 tokens, no external library). It MUST support at minimum two variants:

- `danger`: error/warning banners (danger token palette).
- `info`: informational banners (info token palette).

The component MUST render an icon, a message, and (optionally) an action slot, consistent with the existing ad-hoc banners' visual semantics.

#### Scenario: Danger variant renders

- GIVEN `Alert` with `variant="danger"` and a message
- WHEN it renders
- THEN it shows the danger-styled banner with the given message and an error-class icon

#### Scenario: Info variant renders

- GIVEN `Alert` with `variant="info"` and a message
- WHEN it renders
- THEN it shows the info-styled banner with the given message

#### Scenario: Placement rule respected

- GIVEN the new component is added
- WHEN the file tree is inspected
- THEN `Alert` lives at `src/components/ui/alert.tsx` (reusable, not module-scoped)

### Requirement: Migrate four danger banners (byte-identical copy)

The four ad-hoc danger banners MUST be migrated to `<Alert variant="danger">`:

- `src/app/(main)/pos/sales/sale-form.tsx` (~lines 161-162)
- `src/app/(main)/pos/sales/sale-detail-modal.tsx` (~line 76)
- `src/app/(main)/pos/sales/abono-form.tsx` (~lines 103-104)
- `src/app/(main)/pos/catalog/catalog-form.tsx` (~lines 71-72)

The migration MUST reuse the EXISTING i18n keys — the banner copy and its trigger conditions (when the banner appears/disappears) MUST remain byte-identical to current behavior. No new copy keys for the migrated banners.

#### Scenario: Sale form danger banner via Alert

- GIVEN the condition that today shows the sale-form danger banner is true
- WHEN the sale form renders
- THEN the banner is an `Alert` (danger) with the SAME i18n key/copy as before
- AND the banner no longer appears when the condition clears

#### Scenario: Sale detail modal danger banner via Alert

- GIVEN the sale-detail-modal renders its danger message
- WHEN the modal is open
- THEN the message is rendered by `Alert` (danger) with byte-identical copy

#### Scenario: Abono form danger banner via Alert

- GIVEN the abono-form condition shows the danger banner
- WHEN the form renders
- THEN the banner is an `Alert` (danger) with byte-identical copy and identical trigger

#### Scenario: Catalog form danger banner via Alert

- GIVEN the catalog-form condition shows the danger banner
- WHEN the form renders
- THEN the banner is an `Alert` (danger) with byte-identical copy and identical trigger

#### Scenario: Toast keys untouched

- GIVEN the UX-8 freeze on 30 Toast keys (verb+object microcopy)
- WHEN the Alert migration diff is inspected
- THEN zero Toast-related i18n keys are modified (`messages/*.json` Toast section byte-identical)

### Requirement: Migrate profile verify banner to info variant

The dedicated verification banner component (`src/components/profile/verify-banner.tsx`) MUST be refactored to render the shared `Alert` with `variant="info"`, preserving its copy (existing i18n keys), its trigger (shown when applicable per verification state), and any action/link it contains.

#### Scenario: Verify banner via shared Alert

- GIVEN the profile verification state that today shows the verify banner
- WHEN the profile page renders
- THEN the banner is rendered through `Alert` (info) with the same copy, trigger, and action as before

#### Scenario: Verified profile shows no banner

- GIVEN a profile state where the verify banner is not applicable
- WHEN the profile page renders
- THEN no banner renders

### Requirement: ErrorState NOT created (documented deferral)

An `ErrorState` component MUST NOT be created in this change: `error.tsx` usage does not meet the 2+ real-uses threshold (DEC-DS-06 pull-rule). The deferral MUST be documented explicitly in the design/decision artifact — not silence. ErrorState remains a candidate for UX-12 if usage grows.

#### Scenario: No ErrorState in tree

- GIVEN the S5 work units are applied
- WHEN `src/components/ui/` is inspected
- THEN no `error-state.tsx` exists
- AND the design artifact contains the documented deferral with rationale

### Requirement: Frozen domain and no behavior change

The Alert extraction and migration MUST be presentational only: no changes to form validation logic, trigger conditions, data flow, `src/core/`, `src/infrastructure/`, or Mongoose models. Per-surface tests updated in the same commit if they assert on DOM structure.

#### Scenario: Scope check on diff

- GIVEN the S5 commit is staged
- WHEN `git diff --stat` is inspected
- THEN only `src/components/ui/alert.tsx` (new), the five migrated files, their tests, and (if needed) i18n files appear — nothing under `src/core/` or `src/infrastructure/`

### Requirement: Gates for S5

The S5 work unit MUST be a conventional commit (`feat:`) on branch `master` and MUST pass the §46 gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (explicit timeout ≥ 2_700_000 ms), `pnpm build`, responsive check at 375/768/1280 px (banners readable on mobile), and a11y spot check (banner semantics legible to assistive tech). `pnpm parity` MUST pass if any i18n key is touched (not expected given byte-identical copy).

#### Scenario: Gates green after Alert migration

- GIVEN the S5 commit is staged
- WHEN the gate suite runs
- THEN tsc, lint, build, and the full Vitest suite (timeout ≥ 2_700_000 ms) all pass
- AND all five migrated surfaces render correctly at 375px, 768px, and 1280px
