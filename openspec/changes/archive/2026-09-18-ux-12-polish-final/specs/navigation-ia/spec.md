# Delta for navigation-ia

## ADDED Requirements

### Requirement: BackButton file deleted (H-14 act 2)

UX-10 removed BackButton usage from all root list pages (H-14 act 1). This change completes "act 2": the now-dead component file `src/components/ui/back-button.tsx` (0 importers, verified 2026-09-18) MUST be deleted, AND its literal-file assertion in `src/__tests__/touch-target-imports.test.ts` (lines ~21-25) MUST be removed in the SAME commit, so the suite cannot reference the removed file and stays green. The deletion MUST be its own isolated conventional commit (`refactor:`) so it can be reverted independently.

#### Scenario: File deleted and test in same unit

- GIVEN the deletion commit is applied
- WHEN `src/components/ui/` is inspected
- THEN `back-button.tsx` does not exist
- AND `touch-target-imports.test.ts` contains no BackButton assertion in that same commit

#### Scenario: Importer grep re-check before deletion

- GIVEN the deletion unit starts
- WHEN an import search for `back-button` runs against `src/`
- THEN 0 importers are found (if any appear, the deletion is blocked and the unit is re-scoped — not force-deleted)

#### Scenario: Suite green after deletion

- GIVEN the deletion commit
- WHEN the tests touching `touch-target-imports.test.ts` run
- THEN they pass (the literal-file assertion is gone, remaining assertions intact)

### Requirement: focus-visible ring unification (DS line 164)

Components still using `focus:ring-2` (checked against the touched set, canonical: `button.tsx` and any `focus:ring-2` users in the touched files) MUST migrate to the unified `focus-visible` ring pattern per the design system (DS "foco visible consistente" rule, ~line 164), with `src/components/ui/action-icon-button.tsx:67` as the REFERENCE implementation. The ring: `focus-visible:ring` styled with the `primary` token (not `focus:ring-2`, which also draws a ring on programmatic focus). Keyboard focus visibility MUST be preserved everywhere; no focus outline is silently removed.

#### Scenario: Button adopts focus-visible ring

- GIVEN `button.tsx` currently uses `focus:ring-2`
- WHEN the unification is applied
- THEN the Button uses the focus-visible pattern consistent with `action-icon-button.tsx:67` (ring on keyboard focus, with the primary token)
- AND Tab-navigation still shows a visible ring on the focused Button

#### Scenario: No focus:ring-2 in the touched set

- GIVEN the unification commit
- WHEN the touched component set is grep'd for `focus:ring-2`
- THEN the grep returns 0 occurrences in the migrated files
- AND mouse clicks do not draw a focus ring (focus-visible semantics)

#### Scenario: Keyboard a11y preserved

- GIVEN a user navigating entirely by keyboard
- WHEN they Tab through buttons and other unified-focus components
- THEN every focusable control shows a visible focus indicator (no regression versus before)

### Requirement: Nav contrast fixes have ONE implementation home (CC-3 + CC-7)

The nav group-label contrast fix (CC-3, `nav.tsx:248`) and the nav active-tint contrast fix (CC-7, `nav.tsx:268`) MUST land in EXACTLY ONE implementation home — either this capability's unit or the `ui-token-compliance` per-site unit — never duplicated across both. The assignment MUST be recorded in the change design; whichever unit holds it owns both the edit and the contrast evidence for these surfaces.

#### Scenario: No duplicated contrast edit

- GIVEN both the navigation-ia and ui-token-compliance units are applied
- WHEN `nav.tsx` lines 248/268 are inspected
- THEN the contrast fixes appear exactly once (single edit, single evidence pointer)
- AND the chosen home for CC-3/CC-7 is documented in the change design

### Requirement: Frozen domain and gates for the cleanup/polish unit

The cleanup (back-button deletion) and polish (focus-visible unification) MUST be presentation-only: zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models, no route changes, no i18n key changes (no visible strings touched). Each unit's conventional commit on `master` MUST pass `pnpm exec tsc --noEmit`, `pnpm lint`, the full Vitest suite (explicit timeout ≥ 2_900_000 ms), `pnpm build`, and responsive verification at 375/768/1280 px.

#### Scenario: Scope check on diff

- GIVEN the cleanup/polish commits are staged
- WHEN `git diff --stat` is inspected
- THEN no file under `src/core/` or `src/infrastructure/` appears and no `messages/*.json` key changes

#### Scenario: Gates green after cleanup and polish

- GIVEN both units are staged
- WHEN the gate battery runs
- THEN tsc, lint, build, and the full Vitest suite (explicit timeout ≥ 2_900_000 ms) pass
