# Consistency Audit — Multi-Document Operations (Ronda 12, Fase B2)

## Purpose

Classify every write that spans more than one MongoDB document, assess the
risk of partial writes (orphan/inconsistent state) under the Atlas free tier
(no multi-document transactions), and record the **bounded, pattern-aligned
fixes** applied in this round.

Scope decision (R12.3): **no MongoDB transactions**. The free tier does not
support multi-document transactions. Defense is done **at read time**
(`reconcile.ts`) plus **idempotent/tolerant write patterns** at the use-case
layer.

## Classification legend

- **Atomic**: a single document write, or multi-write with no cross-document
  invariant that a partial failure can break.
- **Idempotent**: re-running the operation yields the same final state (safe
  to retry on failure).
- **Compensated / read-defended**: partial writes are detected and corrected
  at read/reconcile time, or by a tolerant cascade that cannot strand a
  parent record.
- **Raw window**: multiple independent writes with no compensation — a crash
  between writes leaves a detectable-but-not-auto-fixed intermediate state.

## Inventory

### `createTransfer` — `src/core/application/transfers/create-transfer.ts`

Writes: `transferRepo.create` (:90), `movementRepo.create` expense (:105),
`movementRepo.create` income (:120). Parent-first, then the two linked
movements.

- Invariant: transfer must have an expense + income movement; a movement
  must reference an existing transfer.
- Failure mode: crash after `transferRepo.create` leaves a transfer with zero
  or one movement.
- **Classification**: Raw window, **mitigated in read** by
  `findIncompleteTransfers` in `src/infrastructure/consistency/reconcile.ts`
  (action `complete_parent`, :34–49): it flags transfers whose two movements
  are not both present so they can be completed or flagged.
- **Proof**: `transferRepo.create` is written first with the movement IDs
  captured up front, so recovery knows exactly which movements are expected.

### `createSale` — `src/core/application/sales/create-sale.ts`

Writes (up to six): `catalogRepo.decrementStock` (:94), `saleRepo.create`
(:112), `movementRepo.create` paid-in-full movement (:116), and for the
on-credit path `creditRepo.create` (:162) + `movementRepo.create` initial
payment (:165).

- Invariant: sale, its movements, and (on credit) the linked credit must stay
  consistent; stock decremented must match what the sale consumed.
- Failure mode: partial writes can orphan a sale without its credit/movement,
  or overshoot stock.
- **Classification**: Raw window, mitigated:
  - Stock restore handled by `deleteSale` (`incrementStock`, :42) and the
    reconcile action `restore_stock` (:156).
  - Orphan sale → `delete_orphan` reconcile action (:128) detects and removes
    sales whose linked documents are missing.
- Effect on economic result: movements are the source of truth for the
  dashboard; a stranded sale write that produced no movement does not inflate
  financial metrics, and reconcile flags/removes it.

### `deleteTransfer` — `src/core/application/transfers/delete-transfer.ts`

Deletes the two movements then the transfer. Tolerant to an already-deleted
movement (R5-B pattern, same `try/catch NotFoundError → continue`).

- **Classification**: Idempotent + tolerant.

### `deleteCreditGranted` — `src/core/application/credits-granted/delete-credit-granted.ts`

Deletes linked movements first (:40–47) then the credit (:49). Each movement
delete is wrapped in `try/catch (NotFoundError) continue` — **tolerant** to an
already-removed movement. Sale-born credits are blocked from direct deletion
(`ConflictError`, :32–34) and must go through the sale cascade.

- **Classification**: Idempotent + tolerant.

### `deleteSale` — `src/core/application/sales/delete-sale.ts`

`catalogRepo.incrementStock` (:42), `movementRepo.deleteByRefId` for the sale
(:53) and its linked credit if any (:55), `creditRepo.delete` (:59),
`saleRepo.delete` (:62). Uses `deleteByRefId` (no per-movement NotFoundError
stop), so missing movements do not abort the cascade.

- **Classification**: Idempotent + tolerant (bulk delete by ref, no
  intermediate abort).

### `deleteCreditReceived` — `src/core/application/credits-received/delete-credit-received.ts` ✅ FIXED

Previously deleted each linked movement with no `NotFoundError` tolerance: a
movement already removed by earlier cleanup would throw mid-cascade, stranding
the credit (partial deletion, hard retry).

**Fix (this round)**: aligned with the R5-B pattern used by
`deleteCreditGranted`/`deleteSale`/`deleteTransfer`. Each movement delete is
now `try/catch (NotFoundError) → continue`, so a missing movement no longer
blocks removing the credit.

- **Classification after fix**: Idempotent + tolerant. `creditRepo.delete`
  runs last, so the record is never stranded by the movement cascade.
- **Proof**: new test in `credits-received.test.ts` ("is tolerant of an
  already-deleted linked movement (R5-B)...").

### `deletePayable` — `src/core/application/payables/delete-payable.ts` ✅ FIXED

Same defect as `deleteCreditReceived`: no tolerance for a missing movement,
so a prior cleanup could strand the payable.

**Fix (this round)**: applied the same `try/catch (NotFoundError) → continue`
pattern. `payableRepo.delete` runs last.

- **Classification after fix**: Idempotent + tolerant.
- **Proof**: new test in `payables.test.ts` ("is tolerant of an already-deleted
  linked movement (R5-B)...").

### `updateClient` — `src/core/application/clients/update-client.ts:18` ✅ FIXED

Not a data-corruption window, but a **pattern inconsistency**: threw
`new Error("Client not found")` instead of `NotFoundError`. Ownership guard
was already correct (`findById(userId, clientId)` → null), so there was **no
tenant leak**. The fix restores the shared contract so `handleActionError`
maps it to `error.notFound` instead of the generic `error.operationFailed`.

- **Classification**: consistency-only fix, no data impact.

## Read-time defense (`src/infrastructure/consistency/reconcile.ts`)

| Handler | Action | Detects / repairs |
|---|---|---|
| `findIncompleteTransfers` (:34) | `complete_parent` | Transfer whose expense+income movements are not both present |
| orphan detection (:75) | `delete_orphan` | Stranded/orphan aggregate documents (e.g. sale without linked docs) |
| stock handler (:144) | `restore_stock` | Stock mismatch from interrupted sales |
| general | `flag` | Escalate for manual review when auto-fix is unsafe |

## Residual risk & verdict

- No operation can silently inflate a user's economic result: financial
  metrics derive from `movement` documents; a stranded parent write that
  produced no movement does not affect the dashboard, and reconcile
  detects/removes or flags it.
- The remaining raw windows (`createTransfer`, `createSale`) are **recoverable
  in read** and do not violate tenant isolation.
- The tier does not support multi-document transactions; adopting them would
  require moving off the free Atlas plan — deliberately out of scope (R12.3).
- **No new dependencies**, no architectural change, no migration. Only
  pattern-aligned tolerance fixes with tests.

## Verification

- `pnpm test` — full suite.
- `tenant-isolation.test.ts` — 38 tests proving User A → User B entity → fails.
- New tolerance tests for `deleteCreditReceived`, `deletePayable`.
- Strengthened `updateClient` test asserting `NotFoundError`.
