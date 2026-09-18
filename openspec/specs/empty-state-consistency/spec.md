# Empty State Consistency Specification

## Purpose

Unified empty-state presentation across list surfaces: the remaining ad-hoc empty states (`clients`, `categories`, `catalog-list` noResults) migrate to the existing `EmptyState` component (H-10 residue, paso 9), and design-sensitive sub-states that intentionally stay ad-hoc get explicit documented exclusions — decisions, not silence. Closes the H-10 residue left after UX-8 unified noResults on 6 list surfaces with byte-identical copy and triggers.

Cross-cutting constraints: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), every new/changed visible string exists in `messages/es.json` AND `messages/en.json` (neutral Spanish, no voseo, `pnpm parity` gate), existing EmptyState surfaces from UX-8 remain untouched.

## Requirements

### Requirement: Clients empty state migration

The clients page (`src/app/(main)/clients/page.tsx`) ad-hoc empty state (the original H-10 audit evidence) MUST be replaced with the existing `EmptyState` component from `src/components/ui/`. The migration MUST preserve the surface's semantics (no-clients state, primary action to create a client) and MUST reuse existing i18n copy or add new keys to both locales — copy may be refined but MUST be parity-gated.

#### Scenario: Empty clients list renders EmptyState

- GIVEN an authenticated user with zero clients
- WHEN the clients page renders
- THEN the empty area is the shared `EmptyState` component (icon/message/action structure per DS)
- AND the visible strings come from `messages/es.json` / `messages/en.json` keys (parity green)

#### Scenario: Non-empty clients list unaffected

- GIVEN an authenticated user with at least one client
- WHEN the clients page renders
- THEN the client list renders as before and no EmptyState appears

### Requirement: Categories per-section empty states migration

The categories page (`src/app/(main)/categories/page.tsx`) renders per-section empty messages (`noIncome` / `noExpense`) as plain `<p>` elements. Each per-section empty state MUST be replaced with the `EmptyState` component, scoped to its section (income section and expense section independently), preserving each section's distinct message semantics.

#### Scenario: Empty income section shows EmptyState

- GIVEN a workspace with no income categories
- WHEN the categories page renders
- THEN the income section's empty area is an `EmptyState` (not a plain `<p>`)
- AND the expense section is unaffected by the income state

#### Scenario: Empty expense section shows EmptyState

- GIVEN a workspace with no expense categories
- WHEN the categories page renders
- THEN the expense section's empty area is an `EmptyState`

#### Scenario: Both sections populated

- GIVEN a workspace with at least one income and one expense category
- WHEN the categories page renders
- THEN both sections render their category lists with no EmptyState

### Requirement: Catalog-list noResults deduplication

`catalog-list.tsx` currently has a partial duplicate: a plain `noResults` text inside the results counter (line ~89) AND an `EmptyState` already present (line ~102). The plain-text noResults MUST be deduplicated into the `EmptyState` usage so the surface has ONE unified empty/no-results presentation, without breaking the results counter for non-empty results.

#### Scenario: Catalog search with no matches

- GIVEN a catalog filter/search that matches zero products
- WHEN the catalog list renders
- THEN the empty result is presented via `EmptyState` (single unified presentation, no duplicated plain-text noResults message)

#### Scenario: Catalog with results

- GIVEN a catalog filter/search that matches products
- WHEN the catalog list renders
- THEN the results counter and product list render as before, with no EmptyState

### Requirement: Documented exclusions (decision, not silence)

Four surfaces that remain ad-hoc MUST have an explicit documented exclusion with one-line rationale in the design artifact — they MUST NOT be silently omitted:

- `dashboard-content.tsx` (~lines 339-344): N1 dashboard minimalism — design-sensitive sub-state.
- `summary-table.tsx` (~lines 41-42): N1 dashboard minimalism — design-sensitive sub-state.
- `summary-hero.tsx` (~lines 86-88): N1 dashboard minimalism — design-sensitive sub-state.
- `global-movement-provider.tsx` (~lines 212-215): inline modal hint (not a list empty state).

#### Scenario: Exclusion register exists

- GIVEN the S3 design work is done
- WHEN the design artifact is reviewed
- THEN each of the four excluded surfaces has an entry with its documented rationale

#### Scenario: Existing EmptyState surfaces untouched

- GIVEN the 6 list surfaces unified in UX-8 with byte-identical copy and triggers
- WHEN this change is applied
- THEN those surfaces' EmptyState usage, copy, and triggers are byte-identical (no diffs introduced)

### Requirement: Frozen domain and UI-only boundary

The empty-state migrations MUST be presentational only: no data fetching changes, no new queries, no changes in `src/core/`, `src/infrastructure/`, or Mongoose models, no movement `kind` semantics changes. The `EmptyState` component itself is NOT modified (it already exists); this capability only increases its usage.

#### Scenario: Scope check on diff

- GIVEN the S3 work units are committed
- WHEN `git diff --stat` is inspected
- THEN only the three migrated files (plus i18n files and tests) appear — no files under `src/core/` or `src/infrastructure/`
- AND `src/components/ui/empty-state.tsx` shows no behavioral change

### Requirement: Gates and i18n parity for S3

The S3 work unit MUST be a conventional commit (`refactor:`) on branch `master` and MUST pass the §46 gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (explicit timeout ≥ 2_700_000 ms), `pnpm build`, responsive check at 375/768/1280 px, and a11y spot check. If new visible strings are introduced, `pnpm parity` MUST pass.

#### Scenario: Gates green after empty-state migration

- GIVEN the S3 commit is staged
- WHEN the gate suite runs
- THEN tsc, lint, build, and the full Vitest suite (timeout ≥ 2_700_000 ms) all pass
- AND the migrated pages render correctly at 375px, 768px, and 1280px
