# Delta for alert-component

## ADDED Requirements

### Requirement: Success variant (DEC-DS-06 pull-rule met)

The `Alert` component (`src/components/ui/alert.tsx`) MUST gain a `success` variant, following the SAME component contract as the existing `danger`/`info` variants (token palette, icon, message, optional action slot, `src/components/ui/` patterns, no external library). The DEC-DS-06 2+ real-uses threshold is met by the 2 auth success banners (`forgot-password-form.tsx:22`, `reset-password-form.tsx:22`).

#### Scenario: Success variant renders

- GIVEN `Alert` with `variant="success"` and a message
- WHEN it renders
- THEN it shows the success-styled banner with the given message and a success-class icon, consistent with the danger/info contract

#### Scenario: Success variant uses ≥ 2 real call sites

- GIVEN the variant signature and the migrated files
- WHEN the code tree is inspected
- THEN at least 2 components render `Alert variant="success"` (the forgot/reset success twins)

### Requirement: Migrate 4 remaining ad-hoc danger banners (byte-identical copy)

The 4 remaining ad-hoc danger banners MUST be migrated to `<Alert variant="danger">`:

- `src/components/(auth)/auth-form.tsx:48`
- `src/app/(auth)/forgot-password/forgot-password-form.tsx:27`
- `src/app/(auth)/reset-password/reset-password-form.tsx:27`
- `src/components/feedback/feedback-widget.tsx:71`

The migration MUST reuse the EXISTING i18n keys — banner copy and trigger conditions (when the banner appears/disappears) MUST remain byte-identical to current behavior. No new copy keys for migrated banners; `pnpm parity` MUST pass after the migration.

#### Scenario: Auth form danger banner via Alert

- GIVEN the condition that today shows the auth-form danger banner is true
- WHEN the auth form renders
- THEN the banner is an `Alert` (danger) with the SAME i18n key/copy as before
- AND the banner no longer appears when the condition clears

#### Scenario: Forgot/reset danger banners via Alert

- GIVEN the forgot-password and reset-password forms render their danger messages
- WHEN either form shows the danger state
- THEN the message is rendered by `Alert` (danger) with byte-identical copy and identical trigger

#### Scenario: Feedback widget danger banner via Alert

- GIVEN the feedback widget shows its danger banner (e.g. submit failure)
- WHEN the message renders
- THEN it is rendered by `Alert` (danger) with byte-identical copy

### Requirement: Migrate 2 success banners to the success variant

The 2 auth success banners (`forgot-password-form.tsx:22`, `reset-password-form.tsx:22`) MUST be migrated to `<Alert variant="success">`, preserving byte-identical copy (existing i18n keys), trigger conditions, and any action the banners carry.

#### Scenario: Forgot/reset success banners via Alert

- GIVEN the success conditions in forgot-password and reset-password flows
- WHEN the banner renders
- THEN it is an `Alert` (success) with the same i18n copy and trigger as the current ad-hoc banner

#### Scenario: Copy byte-identical (parity gate)

- GIVEN all 6 banner migrations (4 danger + 2 success) are applied
- WHEN `pnpm parity` and the i18n diff are inspected
- THEN parity passes and zero banner copy keys changed (byte-identical messages files for these keys)

### Requirement: ErrorState stays NOT created

`ErrorState` MUST NOT be created in this change. The existing documented deferral stands; this change does not revisit it.

#### Scenario: No ErrorState in tree

- GIVEN this change is applied
- WHEN `src/components/ui/` is inspected
- THEN no `error-state.tsx` exists

### Requirement: Frozen domain and gates for the Alert unit

The Alert work MUST be presentational only: no changes to form validation logic, trigger conditions, data flow, `src/core/`, `src/infrastructure/`, or Mongoose models. Per-surface tests updated in the same commit if they assert on DOM structure. The unit MUST be a conventional commit (`feat:` or `refactor:`) on branch `master` and MUST pass `pnpm exec tsc --noEmit`, `pnpm lint`, the full Vitest suite (explicit timeout ≥ 2_900_000 ms), `pnpm build`, `pnpm parity`, responsive check at 375/768/1280 px, and an a11y spot check (banner semantics legible to assistive tech).

#### Scenario: Scope check on diff

- GIVEN the Alert unit commit is staged
- WHEN `git diff --stat` is inspected
- THEN only `alert.tsx`, the 4 migrated banner files (+ their tests) appear — nothing under `src/core/` or `src/infrastructure/`

#### Scenario: Gates green after migration

- GIVEN the Alert unit commit is staged
- WHEN the gate battery runs
- THEN tsc, lint, build, parity, and the full Vitest suite (explicit timeout ≥ 2_900_000 ms) pass
- AND all migrated banners render correctly at 375px, 768px, and 1280px
