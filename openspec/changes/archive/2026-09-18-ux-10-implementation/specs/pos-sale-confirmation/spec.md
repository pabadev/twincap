# POS Sale Confirmation Specification

## Purpose

Confirmation semantics for POS sale creation, resolved by founder decision D7 (APPROVED 2026-09-18): POS sale creation gets NO informed confirmation. The decision must exist as an explicit documented artifact with rationale — the deliverable is the decision record, NOT a confirmation UI. Create ≠ destroy (UX-6 already covers delete-sale and cobro with confirmations, which remain untouched).

Cross-cutting constraints: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), no change to sale creation business logic, conventional commits on `master`.

## Requirements

### Requirement: No confirmation gate on POS sale creation (D7 — APPROVED)

The POS sale creation flow (`sale-form.tsx`) MUST NOT gain an informed confirmation step (no MoneyActionConfirmation-style gate, no modal intercept on submit). Sale creation proceeds directly on submit, exactly as today.

#### Scenario: Sale submits without confirmation

- GIVEN a user completes a valid POS sale form
- WHEN they submit
- THEN the sale is created immediately (no confirmation dialog appears between submit and creation)
- AND the resulting sale, stock, and movements behave exactly as before (frozen domain)

### Requirement: D7 decision record with explicit rationale

The no-confirmation outcome MUST be recorded as an explicit decision artifact in the design documentation, including the full rationale:

- **Create-flow parity**: POS sale creation is treated the same as movement and account creation, which have no informed confirmation.
- **Non-destructive nature**: create is not destroy — it does not irreversibly remove data; the risk profile differs from delete operations.
- **Existing confirmations preserved**: delete-sale and cobro (payment collection) KEEP their existing confirmations (delivered in UX-6) — they remain destructive/high-stakes flows.

The record MUST exist in the change's design/decision artifact; a silent default is unacceptable.

#### Scenario: Decision record exists and is complete

- GIVEN the S6 design work is done
- WHEN the design/decision artifact is reviewed
- THEN it contains a D7 entry stating the outcome (no confirmation) and all three rationale points above

#### Scenario: Existing confirmations untouched

- GIVEN a user attempts delete-sale on an existing sale, or a cobro on a credit
- WHEN the flow runs
- THEN the existing MoneyActionConfirmation-style confirmation still appears (zero changes to UX-6 behavior)

### Requirement: No silent behavior drift in sale flow

Aside from the S5 danger-banner→Alert migration (separate capability), the sale creation flow's validation, error display, and success behavior MUST remain unchanged. D7 MUST NOT be implemented as a weakened validation or altered error surface.

#### Scenario: Validation errors still surface

- GIVEN an invalid sale submission (e.g., missing required field, insufficient stock)
- WHEN the user submits
- THEN the same validation errors surface as before (via the existing mechanisms, including the S5 Alert migration for the danger banner)

### Requirement: Gates for S6 decision record

The S6 D7 unit MUST be a conventional commit (`docs:` or `feat:` — `docs:` when it only records the decision) on branch `master` and MUST pass the applicable §46 gates (tsc/lint as minimum for a docs-only unit; full gate suite including `pnpm test` with timeout ≥ 2_700_000 ms and `pnpm build` if any code changes).

#### Scenario: Gates green for the D7 unit

- GIVEN the D7 work unit is committed
- WHEN the applicable gates run
- THEN tsc and lint pass (and full test suite + build pass if code was touched)
