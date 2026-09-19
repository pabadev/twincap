# Filter Bar A11y Specification

## Purpose

Accessibility discipline for list filter bars: every visible `<label>` in a list filter bar MUST be programmatically associated with its control, every filter control MUST have an accessible name, and the ToastProvider live-region container MUST NOT carry prohibited ARIA attributes. This capability closes the UX-10 D8 deferral with the MEASURED inventory (18 unassociated labels + 2 bare selects across 5 list files, verified at file:line on 2026-09-18) and removes the single root-cause component behind the 16 axe `aria-prohibited-attr` entries (toast-provider.tsx:57-60; 1 component, absent on `/help` which sits outside `(main)`).

Measured label inventory (supersedes the UX-10 "~21 sites" estimate):

| List file | Labels | Extra controls |
|---|---|---|
| `src/components/sales/sale-list.tsx:163-195` | 4 | status `<Select>` (bare) |
| `src/components/credits/credits-granted-list.tsx:120-131` | 4 | — |
| `src/components/credits/credits-received-list.tsx` | 4 | — |
| `src/components/payables/payables-list.tsx` | 4 | — |
| `src/components/transfers/transfers-list.tsx` | 2 date labels + 1 account/search label | — |

Cross-cutting constraints: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), forms already a11y-hardened by UX-10 FormFields are NOT re-touched, conventional commits on `master`.

## Requirements

### Requirement: Every filter-bar label is associated with its control

Every visible `<label>` in the 5 list filter-bar files MUST be programmatically associated with the control it names. Acceptable mechanisms, in preference order:

1. Migration to the existing `FormField` component (where the JSX structure fits, as done by UX-10).
2. Native association: `htmlFor` on the `<label>` paired with a matching `id` on the control.

The retrofit MUST be structure-only: filter state, query logic, layout intent, and rendered control set MUST NOT change. The measured 18-label inventory MUST be fully closed — no partial retrofit, no deferral.

#### Scenario: Sale list labels associated

- GIVEN the sale list filter bar renders (`sale-list.tsx`, 4 labels + status select)
- WHEN a screen reader or axe `label` rule inspects each rendered input
- THEN every input has an accessible name derived from its label (FormField or `htmlFor`/`id`)
- AND no visible `<label>` in the file lacks a `htmlFor` target or FormField wrapper

#### Scenario: Credits/Payables/Transfers lists labels associated

- GIVEN `credits-granted-list.tsx` (4 labels), `credits-received-list.tsx` (4), `payables-list.tsx` (4), and `transfers-list.tsx` (3: 2 date labels + account/search label) render their filter bars
- WHEN the axe `label` rule runs against each rendered page
- THEN 0 `label` violations are reported for these pages

#### Scenario: Structure-only retrofit

- GIVEN the retrofit diff for the 5 list files
- WHEN the diff is reviewed
- THEN it touches only label/control association markup (associations, ids, FormField wrappers, classes where needed for identity)
- AND no filter state, query parameter handling, nor control inventory changes

### Requirement: Every filter Select has an accessible name

Every `<Select>` in a list filter bar MUST have an accessible name. The Select component (`select.tsx`, ~line 31) already derives its internal `id` from a `label` prop — filter-bar selects MUST pass the `label` prop (preferred) or an explicit `id` that a visible label references via `htmlFor`. Bare selects with no accessible name are PROHIBITED in filter bars.

#### Scenario: Status select in sale list is named

- GIVEN the sale list filter bar contains the status `<Select>` (today bare)
- WHEN its rendered `<select>` element is inspected (or the axe `select-name` rule runs)
- THEN it has an accessible name (from the Select `label`/`id` association pattern at `select.tsx:31`, or from a `htmlFor`-wired visible label)
- AND the axe `select-name` rule reports 0 violations for the page

#### Scenario: Bare-select rule is structural

- GIVEN a future or existing list filter bar
- WHEN a `<Select>` renders without `label`/`id` association
- THEN this violates the spec — a consume-time check (axe re-scan, see below) MUST catch it

### Requirement: ToastProvider live-region container has no aria-label

The `aria-live` container in `src/components/ui/toast-provider.tsx` (lines ~57-60) MUST NOT carry any `aria-label`. Axe rules (`aria-prohibited-attr`) prohibit it on a region container. Accessibility MUST be preserved WITHOUT re-introducing a prohibited attribute: the container stays inert/silent and announcements derive from the inner toast items (visually-hidden text or item-level naming), consistent with the H-16 single-announcement-channel decision already landed in UX-5/UX-8.

#### Scenario: aria-label removed, accessibility preserved

- GIVEN the toast provider source and its rendered container
- WHEN the live-region container is inspected
- THEN it has NO `aria-label` attribute
- AND the axe `aria-prohibited-attr` rule reports 0 violations on any page that wakes the ToastProvider
- AND toast announcements remain legible to assistive tech (item-level naming/visually-hidden text inside the region)

#### Scenario: Scope note /help stays out

- GIVEN `/help` (outside the `(main)` shell) never mounted ToastProvider with the defect
- WHEN the fix diff is inspected
- THEN the change is contained in `toast-provider.tsx` and no per-page workarounds are added

### Requirement: A11y re-scan gate for filter bars (scan evidence path rule)

The e2e-a11y re-scan harness (`e2e-a11y/scan.spec.ts`, ~line 254) MUST write its raw evidence to the OWNING change's evidence folder — for this change, `openspec/changes/ux-12-polish-final/evidence/` (currently points at the `ux-11-validation` path; re-point required). The re-scan MUST cover 20 combos (themes × viewports of the existing harness matrix) across the 5 list pages + toast-waking pages, and MUST report **0 violations** for the triaged rules `aria-prohibited-attr`, `label`, and `select-name` (the `color-contrast` gate lives in `ui-token-compliance`).

#### Scenario: Re-scan gate green

- GIVEN the a11y fixes are applied and the scan harness re-points its output dir
- WHEN the 20-combo re-scan runs
- THEN the raw JSON evidence lands in `openspec/changes/ux-12-polish-final/evidence/`
- AND violations for `aria-prohibited-attr`, `label`, and `select-name` are 0 across all combos

#### Scenario: Evidence path rule persists

- GIVEN a future UX change re-runs the harness
- WHEN `scan.spec.ts` is inspected
- THEN its output dir points at that change's evidence folder (rule: the path tracks the owning change, never a stale archived change)

### Requirement: Frozen domain and gates for the a11y unit

The filter-bar-a11y work MUST be a conventional commit (`fix(a11y):`) on branch `master`, touching only the 5 list files, `toast-provider.tsx`, and `scan.spec.ts` (path line). Zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models. `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` MUST pass; filter functionality is exercised by existing list-page tests.

#### Scenario: Scope check on diff

- GIVEN the a11y fix commit is staged
- WHEN `git diff --stat` is inspected
- THEN only the 5 list files, `toast-provider.tsx`, and `scan.spec.ts` appear (plus evidence)
- AND no file under `src/core/` or `src/infrastructure/` appears
