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

### `createTransfer` — `src/core/application/transfers/create-transfer.ts` ✅ FIXED (R14-B)

Writes: `transferRepo.create`, `movementRepo.create` expense,
`movementRepo.create` income, ALL inside one real multi-document transaction
(R14-B): `uow.withTransaction` (`MongoUnitOfWork` → `session.withTransaction`)
threads the opaque `TransactionHandle` into each repo write. A failure at ANY
point aborts the whole transaction — **no partial state can persist**.

- Invariant: transfer must have an expense + income movement; a movement
  must reference an existing transfer.
- Failure mode (pre-fix): crash after `transferRepo.create` left a transfer
  with zero or one movement. Post-fix: crash anywhere in the write phase rolls
  back all three documents atomically.
- **Classification**: ~~Raw window~~ → **Atomic (real transaction, R14-B)**.
  Read defense retained as a safety net:
  `findIncompleteTransfers` in `src/infrastructure/consistency/reconcile.ts`
  (action `complete_parent`): flags transfers whose two movements are not both
  present so they can be completed or flagged.
- **Proof**: `session.withTransaction` retries `TransientTransactionError`;
  integration test against `MongoMemoryReplSet` proves abort-on-partial-failure
  leaves 0 documents (§25-B).

### `createSale` — `src/core/application/sales/create-sale.ts` ✅ FIXED (R14-B)

Writes (up to six): `catalogRepo.decrementStock`, `saleRepo.create`,
`movementRepo.create` paid-in-full movement, and for the on-credit path
`creditRepo.create` + `movementRepo.create` initial payment — ALL inside one
real multi-document transaction (R14-B). The whole write phase
(stock decrements → sale → movements → credit) runs under
`uow.withTransaction`; any failure aborts everything.

- Invariant: sale, its movements, and (on credit) the linked credit must stay
  consistent; stock decremented must match what the sale consumed.
- Failure mode (pre-fix): partial writes could orphan a sale without its
  credit/movement, or overshoot stock. Post-fix: failure anywhere → full
  rollback (stock included).
- **Classification**: ~~Raw window~~ → **Atomic (real transaction, R14-B)**.
  Mitigations retained as safety nets:
  - Stock restore handled by `deleteSale` (`incrementStock`) and the
    reconcile action `restore_stock`.
  - Orphan sale → `delete_orphan` reconcile action detects and removes
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
- The two raw windows (`createTransfer`, `createSale`) were **closed in
  R14-B with real multi-document transactions** (verified empirically that
  Atlas M0 is a replica set and supports them). The reconcile read-defenses
  above remain as a safety net, not the primary guarantee.
- **No new dependencies**, no migration. Only the `UnitOfWork` port +
  `MongoUnitOfWork` adapter + optional `tx?` threading in 5 repo methods.

## Verification

- `pnpm test` — full suite.
- `tenant-isolation.test.ts` — 38 tests proving User A → User B entity → fails.
- New tolerance tests for `deleteCreditReceived`, `deletePayable`.
- Strengthened `updateClient` test asserting `NotFoundError`.
