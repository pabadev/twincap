# Atomicity Matrix — Multi-Document Operations (Ronda 15, Fases 1–4)

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

Fase 3 delivered the abono family: `addAbono` ×4 (received/granted/payable +
legacy `addSaleAbono`), `editAbono` ×3 (received/simple, granted/split-sync,
payable), `deleteAbono` ×4 (incl. legacy `deleteSaleAbono`) and `markAsPaid`
×2 all run inside `uow.withTransaction`. The aggregate READ
(`findByWorkspaceId`) and the balance/currency validations that derive from it
now join the transaction session (snapshot-consistent); the Account
(static-reference) validations stay outside. Real replica-set rollback coverage
lives in `src/infrastructure/transactions/use-case-rollback.test.ts`.

Fase 4 (CAS) delivered optimistic concurrency for the same debt aggregates:
every mutating repository method of the 4 debt repos (`update` ×4, `addAbono`
×4, `editAbono` ×4, `deleteAbono` ×4, `markWrittenOff`) accepts an optional
`expectedVersion?: number` after `tx?` and CAS-guards the aggregate version
(`__v` bumped via explicit `$inc`). Inside `uow.withTransaction` the retry loop
(tx 2.0) turns WriteConflicts into re-validation against fresh state — the
loser aborts on a business guard, not on the CAS error; the CAS rejects only
the direct non-transactional path with a stale version. Default version is 0
for every existing document (retro-compatible). Real concurrency coverage lives
in `src/infrastructure/transactions/concurrency-abonos.test.ts`.

## Decision table

| Operación | Documentos implicados | Estado actual | Decisión |
|---|---|---|---|
| `createTransfer` | Transfer + 2 Movements (expense/income) | ✅ **YA transaccional** (R14-B) | **Transacción** — implementada (R14-B). Saldo validado FUERA del tx hoy; la protección bajo concurrencia (CAS sobre `Account`) es Fase 5. |
| `createSale` | stock decrements ×N + Sale + Movements (paid-in-full o initial payment) + CreditGranted (on-credit) | ✅ **YA transaccional** (R14-B) | **Transacción** — implementada (R14-B). |
| `createCreditReceived` | CreditReceived + principal Movement (`creditReceivedPrincipal`) | NO | **Transacción** — Fase 2. |
| `createCreditGranted` | CreditGranted + principal Movement (`creditGrantedPrincipal`) | NO | **Transacción** — Fase 2. |
| `createPayable` | Payable + initial-payment Movement | NO | **Transacción** — Fase 2. |
| `addAbono` (CreditReceived) | CreditReceived `$push` abono + Movement create | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3): lectura del agregado + validación de saldo DENTRO del tx (snapshot-consistente); cuenta de pago validada FUERA (referencia estática). Concurrencia: CAS sobre `__v` (Fase 4). |
| `addAbono` (CreditGranted) | CreditGranted `$push` abono + 1–2 Movements (capital/interest split, `creditGrantedAbono`/`creditGrantedAbonoInterest`) | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3): split R9/D9.1 + saldo validados DENTRO del tx; cuenta receptora validada FUERA. Concurrencia: CAS (Fase 4) + guard `writtenOff` (invariante §6: un crédito dado de baja no acepta abonos). |
| `addAbono` (Payable) | Payable `$push` abono + Movement create | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3). Concurrencia: CAS (Fase 4). |
| `addSaleAbono` (venta a crédito) | Sale `$push` abono + Movement create (`salePayment`) | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3). LEGACY FALLBACK desde R5-D0 (la deuda vive en el CreditGranted vinculado; abonos reales → `addAbono` de créditos-granted rama sale-born). Concurrencia: CAS (Fase 4). |
| `markAsPaid` (received/granted) | Reusa `addAbono` (misma operación) | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3): hereda la decisión de `addAbono`; el guard "ya pagado" se lee FUERA del tx y `uow` se enhebra sin transacción anidada. CAS heredado (Fase 4). |
| `editAbono` (CreditReceived) | CreditReceived `$set` abono + Movement update | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3). Concurrencia: CAS (Fase 4). |
| `editAbono` (CreditGranted, split) | CreditGranted `$set` abono + hasta 3 operaciones de Movement (create/update/delete de los campos split) | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3): resincronización R9/D9.3 del split con orden R5-B (delete-interest primero) dentro del tx. Concurrencia: CAS (Fase 4). |
| `editAbono` (Payable) | Payable `$set` abono + Movement update | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3). Concurrencia: CAS (Fase 4). |
| `editAbono` (Sale) | — | N/A | **N/A** — desde R5-D0 las ventas a crédito no acumulan abonos propios: el total queda como principal del CreditGranted vinculado (R5-D0a) y sus abonos se editan en el crédito (rama sale-born). No existe `editAbono` de Sale en el código (la matriz del borrador lo listaba; corregido en Fase 3). |
| `deleteAbono` (CreditReceived) | Movement delete + CreditReceived `$pull` abono | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3): borrado del movimiento ANTES del `$pull` (R5-B) dentro del tx; NotFound tolerante. Concurrencia: CAS (Fase 4). |
| `deleteAbono` (CreditGranted) | Movement delete ×2 (principal + interest) + CreditGranted `$pull` abono | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3): R5-B con ambos movimientos dentro del tx; NotFound tolerante. Concurrencia: CAS (Fase 4). |
| `deleteAbono` (Payable) | Movement delete + Payable `$pull` abono | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3). Concurrencia: CAS (Fase 4). |
| `deleteSaleAbono` | Movement delete + Sale `$pull` abono | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción** — implementada (Fase 3). LEGACY FALLBACK (ver `addSaleAbono`). Concurrencia: CAS (Fase 4). |
| `writeOffCreditGranted` | Movement create (gasto por capital no recuperado) + `markWrittenOff` | ✅ **YA transaccional + CAS** (R15 F4) | **Transacción + CAS** — implementada (Fase 4): todo el flujo (reads, guards R5-D0c/ya-bajada/ya-pagada/capital-pendiente, expense movement + `markWrittenOff` con `expectedVersion`) corre dentro de `uow.withTransaction`; el guard `writtenOff` en `addAbono` (grants) la complementa para que write-off vs abono final converja a exactamente un ganador tras el retry. |
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
| Lecturas y validaciones (findById/findByWorkspaceId, validaciones de saldo/moneda) | N/A | — | **Justificado** — las lecturas del AGREGADO DE DEUDA (findById/findByWorkspaceId con `tx?`) y las validaciones de saldo/moneda que derivan de él corren DENTRO del tx desde Fase 3 (snapshot-consistent); las referencias estáticas de Account (findById de la cuenta de pago/recepción) se resuelven FUERA del tx (AccountRepository sin `tx?`). La protección bajo concurrencia es CAS sobre `__v` (Fase 4, implementada). |

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
4. **Concurrencia (Fase 4, CERRADA)**: las transacciones (Fases 2–6) garantizan
   atomicidad del fallo, NO exclusión mutua entre operaciones concurrentes. La
   protección contra doble abono / doble baja bajo concurrencia es CAS sobre la
   versión del agregado (`__v`), entregado en Fase 4 para los 4 agregados de
   deuda: `expectedVersion?: number` + `$inc: { __v: 1 }` explícito (helper
   `runVersionedUpdate` en `src/infrastructure/transactions/versioned-update.ts`),
   `ConflictError(DEBT_MODIFIED_MSG)` en el path directo, y retry→re-validación
   dentro de `uow.withTransaction` (los perdedores fallan por guard de negocio
   re-lecto contra estado fresco, no por CAS). El CAS sobre `Account.version`
   para transfers queda en Fase 5 (§10 Opción A).
5. **Criterio R15.5.2** ("todas las operaciones financieras críticas con
   atomicidad real") se cumple al cerrar las Fases 2–6 (Fases 2–4 cerradas); las filas
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

### Contrato de LECTURA entregado en Fase 3

Los 4 agregados de deuda extienden sus métodos de lectura con `tx?` para que el
use case pueda leer el agregado DENTRO de la transacción (snapshot-consistente
con las escrituras posteriores). La resolución de moneda de cuenta que hacen
internamente (`resolveAccountCurrency` / `resolveBulkAccountCurrencies`) recibe
el mismo handle (opcional; sin `tx` se comporta idéntico a Fase 1).

| Repositorio | Métodos de lectura con `tx?` |
|---|---|
| `CreditReceivedRepository` | `findById`, `findByWorkspaceId` |
| `CreditGrantedRepository` | `findById`, `findByWorkspaceId` |
| `PayableRepository` | `findById`, `findByWorkspaceId` |
| `SaleRepository` | `findById`, `findByWorkspaceId` |

`MovementRepository.findById` siguió SIN `tx?` (solo lectura de fusión de campos
inalterados dentro de los edit/delete cascades; el movimiento pre-existe y no
guarda relación con la snapshot del agregado).

### Contrato `expectedVersion` entregado en Fase 4 (CAS)

Toda escritura mutante de los 4 repositorios de deuda acepta
`expectedVersion?: number` INMEDIATAMENTE DESPUÉS de `tx?` (el orden preserva los
call sites pre-F4 y la assignability de los fakes en tests). La versión es 0 por
defecto (docs existentes retro-compatibles; los mappers exponen
`version: doc.__v ?? 0`).

| Repositorio | Métodos con `expectedVersion?` |
|---|---|
| `CreditReceivedRepository` | `update`, `addAbono`, `editAbono`, `deleteAbono` |
| `CreditGrantedRepository` | `update`, `addAbono`, `editAbono`, `deleteAbono`, `markWrittenOff` |
| `PayableRepository` | `update`, `addAbono`, `editAbono`, `deleteAbono` |
| `SaleRepository` | `update`, `addAbono`, `editAbono`, `deleteAbono` |

Semántica de los adaptadores (con `expectedVersion` definido):
`runVersionedUpdate` ejecuta `updateOne` sobre `{ ...filter, __v: expectedVersion }`
+ `$inc: { __v: 1 }`; si `matchedCount === 0`, re-lee el doc (misma sesión) y
traduce: doc inexistente → `NotFoundError`; `__v` distinto → `ConflictError(
DEBT_MODIFIED_MSG)`; `addAbono` con el mismo `movementId` ya presente → retorno
silencioso SIN bump (guard de idempotencia del reintento). Con `expectedVersion`
`undefined` la ruta exacta pre-F4 se conserva (sin filtro de versión ni `$inc`).

Los use cases pasan `credit.version` leído DENTRO del tx y devuelven la entidad
con `version + 1`; `writeOffCreditGranted` quedó íntegro en `uow.withTransaction`
(reads + guards + expense movement + `markWrittenOff` CAS). Verificación real
(replSet pin 7.0.41): `src/infrastructure/transactions/concurrency-abonos.test.ts`
— CAS stale directo, idempotencia de movementId, N=10/50/100 abonos paralelos
sobre un crédito de 100_000 COP (exactamente 3 ganan; `__v == 3`; `pending ==
10_000`; perdedores por re-validación) y write-off vs abono final (exactamente
un ganador; guard `writtenOff`/`paid`).