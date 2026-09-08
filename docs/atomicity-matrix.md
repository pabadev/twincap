# Atomicity Matrix — Multi-Document Operations (Ronda 15, Fase 1)

## Purpose

Catalog EVERY multi-document write in the system and record an explicit
atomicity decision for it: **transaction**, **atomic Mongo operation**,
**compensation**, or **justified** (no atomicity needed, with reason).
No operation may remain "undecided". This matrix supersedes the R12
`CONSISTENCY-AUDIT.md` inventory for write-atomicity purposes (the R12 audit
was written under the pre-R14 assumption that Atlas M0 cannot run
transactions; R14-B verified empirically that it can and R15 builds on that).

R15 definitions:

- **transacción**: the write phase runs inside `uow.withTransaction(...)` and
  every repo write joins it via `tx?` (real `session.withTransaction`, Atlas M0
  replica set — verified in R14-B).
- **atómica**: a single Mongo operation that is atomic by document/operator
  semantics (`updateOne` + `$push`/`$pull`/`$set`/`$inc`, `deleteMany`, etc.).
- **compensación**: compensating writes that undo a partial state (the legacy
  `createAccount` pattern, to be replaced by a transaction in Fase 6).
- **justificado**: the operation is a single-document write, or the failure
  mode is deliberately tolerated by design (idempotent cascade + read-time
  defense), with the reason stated.

Fase 1 delivered the enabling contract: every write method that a future
phase needs inside a transaction now accepts an optional trailing
`tx?: TransactionHandle` in `src/core/domain/repositories.ts` and threads the
native session (`sessionOf(tx)`) into Mongoose `{ session }` in every Mongo
adapter. The phases below reference that contract.

## Decision table

| Operación | Documentos implicados | Estado actual | Decisión |
|---|---|---|---|
| `createTransfer` | Transfer + 2 Movements (expense/income) | ✅ **YA transaccional** (R14-B) | **Transacción** — implementada (R14-B). Saldo validado FUERA del tx hoy; la protección bajo concurrencia (CAS sobre `Account`) es Fase 5. |
| `createSale` | stock decrements ×N + Sale + Movements (paid-in-full o initial payment) + CreditGranted (on-credit) | ✅ **YA transaccional** (R14-B) | **Transacción** — implementada (R14-B). |
| `createCreditReceived` | CreditReceived + principal Movement (`creditReceivedPrincipal`) | NO | **Transacción** — Fase 2. |
| `createCreditGranted` | CreditGranted + principal Movement (`creditGrantedPrincipal`) | NO | **Transacción** — Fase 2. |
| `createPayable` | Payable + initial-payment Movement | NO | **Transacción** — Fase 2. |
| `addAbono` (CreditReceived) | CreditReceived `$push` abono + Movement create | NO | **Transacción** — Fase 3. Validación de saldo DENTRO del tx; concurrencia (CAS) Fase 4. |
| `addAbono` (CreditGranted) | CreditGranted `$push` abono + 1–2 Movements (capital/interest split, `creditGrantedAbono`/`creditGrantedAbonoInterest`) | NO | **Transacción** — Fase 3. Validación de saldo DENTRO del tx; concurrencia (CAS) Fase 4. |
| `addAbono` (Payable) | Payable `$push` abono + Movement create | NO | **Transacción** — Fase 3. Validación de saldo DENTRO del tx; concurrencia (CAS) Fase 4. |
| `addSaleAbono` (venta a crédito) | Sale `$push` abono + Movement create (`salePayment`) | NO | **Transacción** — Fase 3. Validación de saldo DENTRO del tx; concurrencia (CAS) Fase 4. |
| `markAsPaid` (received/granted) | Reusa `addAbono` (misma operación) | NO | **Transacción** — Fase 3 (hereda la decisión de `addAbono`). |
| `editAbono` (CreditReceived) | CreditReceived `$set` abono + Movement update | NO | **Transacción** — Fase 3. |
| `editAbono` (CreditGranted, split) | CreditGranted `$set` abono + hasta 3 operaciones de Movement (create/update/delete de los campos split) | NO | **Transacción** — Fase 3. |
| `editAbono` (Payable) | Payable `$set` abono + Movement update | NO | **Transacción** — Fase 3. |
| `editAbono` (Sale) | Sale `$set` abono + Movement update | NO | **Transacción** — Fase 3. |
| `deleteAbono` (CreditReceived) | Movement delete + CreditReceived `$pull` abono | NO | **Transacción** — Fase 3. |
| `deleteAbono` (CreditGranted) | Movement delete ×2 (principal + interest) + CreditGranted `$pull` abono | NO | **Transacción** — Fase 3. |
| `deleteAbono` (Payable) | Movement delete + Payable `$pull` abono | NO | **Transacción** — Fase 3. |
| `deleteSaleAbono` | Movement delete + Sale `$pull` abono | NO | **Transacción** — Fase 3. |
| `writeOffCreditGranted` | Movement create (gasto por capital no recuperado) + `markWrittenOff` | NO | **Transacción** — Fase 5. |
| `editPrincipal` (CreditReceived) | CreditReceived update (full doc) + Movement update (principal) | NO | **Transacción** — Fase 5. |
| `editPrincipal` (CreditGranted) | CreditGranted update (full doc) + Movement update (principal) | NO | **Transacción** — Fase 5. |
| `updateTransfer` | Transfer update + 1–2 Movement updates (expense/income) | NO | **Transacción** — Fase 5. |
| `deleteTransfer` | Movement delete ×2 + Transfer delete | NO | **Transacción** — Fase 5. |
| `deleteSale` | stock increments ×N + Movement `deleteMany` (sale refId) + Movement `deleteMany` (credit refId) + CreditGranted delete + Sale delete | NO | **Transacción** — Fase 6, idempotente (stock restaurado 1 sola vez, §9). |
| `createAccount` con opening | Account create + Movement create (`opening`) | NO — hoy **compensación** manual `try/catch` → `accountRepo.delete` (comentario obsoleto de R8) | **Transacción** — Fase 6: reemplaza la compensación por rollback real (criterio R15.5.3). |
| `register` / onboarding | User + Workspace + Membership + seed (`WorkspaceBootstrapper`: cuenta fija + categorías) | NO | **Transacción** — Fase 6 (§12). El fallo parcial hoy deja un usuario sin workspace usable; el retry manual del registro converge, pero la transacción lo garantiza. |
| `deleteCreditReceived` | Movement deletes (tolerantes, `NotFound → continue`) + CreditReceived delete | NO | **Justificado** — cascada idempotente ordenada hijos→padre con borrado tolerante (R5-B); un fallo parcial deja movimientos huérfanos que la defensa de lectura (`filter-live-linked-movements`) oculta y `reconcile.ts` detecta/limpia; no rompe ningún invariante financiero entre dos deletes independientes. R14-B declaró deliberadamente los deletes NO-transaccionales. Candidata a transaccionalizar en una ronda futura si el reconcile reporta huérfanos. |
| `deletePayable` | Movement deletes (tolerantes) + Payable delete | NO | **Justificado** — misma justificación que `deleteCreditReceived`. |
| `deleteCreditGranted` (standalone) | Movement deletes (tolerantes) + CreditGranted delete | NO | **Justificado** — misma justificación; los créditos sale-born NO se borran por esta vía (ConflictError R5-D0c) sino por `deleteSale` (Fase 6 transaccional). |
| `movement` standalone writes (`createMovement`, `updateMovement`, `deleteMovement`) | 1 documento | — | **Justificado** — documento único: atomicidad nativa de Mongo. |
| `setInitialAccountBalance` | 1 Movement create | — | **Justificado** — documento único. |
| `createAccount` sin opening | 1 Account create | — | **Justificado** — documento único. |
| `editTotal` (Payable) | 1 Payable update | — | **Justificado** — documento único; sin cascada de movimientos por diseño (`edit-total.ts`: "NO movement cascade"). |
| `deleteAccount` | Movement deletes + Account delete | NO | **Justificado** — misma justificación que los deletes de débitos (idempotente + orden hijos→padre + `countReferences` como guard de pre-condición). |
| Lecturas y validaciones (findById/findByWorkspaceId, validaciones de saldo/moneda) | N/A | — | **Justificado** — fuera del tx por diseño (R14-B: "validaciones/lecturas quedan FUERA de la transacción"); la protección bajo concurrencia es Fase 4 (CAS). |

## Notas de diseño

1. **Fase 1 no cambia comportamiento**: el parámetro `tx?` es opcional; sin
   `tx` presente, cada adaptador conserva exactamente su ruta anterior (sin
   sesión). Con `tx` presente, la escritura se une a la transacción del caller
   vía `sessionOf(tx)` → `{ session }`.
2. **Escrituras embedded (abonos)**: `addAbono`/`editAbono`/`deleteAbono`/
   `markWrittenOff` son atómicas POR DOCUMENTO (`updateOne` con `$push`/`$set`/
   `$pull`) — la atomicidad multi-documento que falta es la del MOVIMIENTO
   hermano, por eso la decisión es transacción, no "atómica".
3. **Métodos de UPDATE full-doc** (`update` de CreditReceived/CreditGranted/
   Payable/Sale/Transfer/Movement) aceptan `tx?` porque Fase 5 (`editPrincipal`,
   `updateTransfer`) y Fase 3 (`editAbono` cascades) los invocan dentro de
   transacciones.
4. **Concurrencia**: las transacciones (Fases 2–6) garantizan atomicidad del
   fallo, NO exclusión mutua entre operaciones concurrentes. La protección
   contra doble abono / saldo insuficiente / stock negativo bajo concurrencia
   es la Fase 4 (optimistic concurrency / CAS sobre `__v`/versión) para los 4
   agregados de deuda y sobre `Account.version` para transfers (Fase 5, §10
   Opción A).
5. **Criterio R15.5.2** ("todas las operaciones financieras críticas con
   atomicidad real") se cumple al cerrar las Fases 2–6; las filas
   "justificado" de esta matriz son operaciones tolerantes por diseño, no
   deuda pendiente.

## Contrato `tx?` entregado en Fase 1

Repositorios cuyos métodos de escritura aceptan `tx?: TransactionHandle`
(interfaz en `src/core/domain/repositories.ts`; implementación en
`src/infrastructure/repositories/*`):

| Repositorio | Métodos |
|---|---|
| `MovementRepository` | `create` (R14-B), `update`, `delete`, `deleteByRefId` |
| `TransferRepository` | `create` (R14-B), `update`, `delete` |
| `CreditReceivedRepository` | `create`, `update`, `addAbono`, `editAbono`, `deleteAbono` |
| `CreditGrantedRepository` | `create` (R14-B), `update`, `delete`, `addAbono`, `editAbono`, `deleteAbono`, `markWrittenOff` |
| `PayableRepository` | `create`, `update`, `addAbono`, `editAbono`, `deleteAbono` |
| `SaleRepository` | `create` (R14-B), `update`, `delete`, `addAbono`, `editAbono`, `deleteAbono` |
| `CatalogItemRepository` | `decrementStock` (R14-B), `incrementStock` |

No recibieron `tx?` (fuera del alcance de Fase 2/3/5/6): los deletes de
CreditReceived/Payable (justificados como tolerantes en la matriz), y los
repositorios de entidades no financieras (User, Category, Client, Account,
Workspace, Membership) — `createAccount` (Fase 6) mantendrá su compensación
hasta ser reemplazada por transacción y sus writes se resolverán en ese momento.