# Atomicity Matrix — Multi-Document Operations (Ronda 15, Fases 1–7 + R15.1 6e + R15.2)

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

Fase 5 (transfers + editPrincipal + CAS sobre Account) delivered la familia de
transfers y el editPrincipal restante: `createTransfer` ahora lee AMBAS cuentas
y valida el saldo de origen DENTRO de `uow.withTransaction` (snapshot-consistente
vía `AccountRepository.findById(tx?)` + `computeAccountLiveBalance` sobre
`MovementRepository.findByAccountIdForBalance(tx?)` — el saldo de cuenta
unificado de R15.2-B; `aggregateBalance` ya no existe en el código),
escribe Transfer + 2 Movements con el tx y cierra con un CAS bump (helper F4
`runVersionedUpdate`: `$inc: { __v: 1 }`) SOLO sobre la cuenta de ORIGEN
(`AccountRepository.bumpVersion`); si el bump falla lanza
`ConflictError(DEBT_MODIFIED_MSG)` y aborta el tx — bajo transfers concurrentes
del mismo origen gana EXACTAMENTE uno y el resto falla por re-validación, de modo
que `sourceBalance` jamás puede quedar negativo. `updateTransfer`, `deleteTransfer`
y `editPrincipal` ×2 (received/granted, patrón de la fase anterior: reads +
guards + `credit.update` con `expectedVersion` + cascada de movements, todo
dentro del tx) son totalmente transaccionales. Cobertura real (replSet pin
7.0.41): `src/infrastructure/transactions/concurrency-transfers.test.ts`.

Fase 6 cerró los tres flujos que quedaban sin atomicidad real: `deleteSale`
(§9) — toda la cascada (lectura de la venta, stock restores ×N, `deleteMany`
de movements por refId de venta y crédito vinculado, delete del crédito y delete
final de la venta) corre en `uow.withTransaction`, y la idempotencia ante
requests duplicados/concurrentes se apoya en la re-lectura dentro del tx + el
`NotFoundError` del `saleRepo.delete` final: el perdedor aborta sin tocar stock
(restaurado EXACTAMENTE una vez). `createAccount` con opening (§11) reemplaza la
compensación manual R8 (`try/catch` → `accountRepo.delete`) por rollback real —
cuando el movement de apertura falla, la cuenta creada en el mismo tx se aborta.
`register` (§12) envuelve User + Workspace + Membership + seed
(`WorkspaceBootstrapper`: 1 cuenta fija + 8 categorías) en una sola transacción:
cualquier fallo (incluido el seed) deja CERO documentos parciales. Para que
`createAccount` funcionara dentro del tx se corrigió un defecto en
`MongoMovementRepository.resolveDependencies`: las lecturas de Account/Category
ahora aceptan y usan la sesión (sin ella, la cuenta recién creada en el mismo tx
era invisible → `NotFoundError`). Cobertura real (replSet pin 7.0.41):
`src/infrastructure/transactions/use-case-rollback-fase6.test.ts` — deleteSale
SUCCESS / FAIL_STEP_LAST (rollback del stock ya restaurado) / retry duplicado /
N=10/25/50 concurrentes (1 gana, stock restaurado una vez); createAccount
SUCCESS / FAIL / retry; register SUCCESS / FAIL_SEED (0 documentos parciales) /
retry (sin duplicados por índices únicos).

Fase 7 (verificación §25/§14) entregó la suite de integridad
`src/infrastructure/transactions/integrity-suite.test.ts` (replSet pin 7.0.41,
mismo molde F2/F4/F6: reales repos + `MongoUnitOfWork` + use cases reales):
verifica los invariantes financieros sobre transacciones REALES sin repetir
coberturas previas — write-off concurrente N=10/50/100 sobre la MISMA deuda
(exactamente 1 gana, EXACTAMENTE UN solo movimiento de gasto
`creditGrantedWriteOff`, `__v == 1`); deleteSale concurrente N=100 (F6 ya cubría
N=10/25/50; stock restaurado exactamente 1 vez, perdedores `NotFoundError`);
invariante de sobrepago (pending nunca negativo: N abonos paralelos que superan
el principal convergen a exactamente floor(P/abono) ganadores y ningún
documento almacena pending < 0); net-zero same-currency (Σ signedAmount de ambas
patas == 0) y cross-currency con la fórmula FX documentada
(`dest_minor == src_minor × rate × 10^(destExp − srcExp)`, validada con
100.00 USD @ 4000 → 400_000 COP y 200.00 USD @ 5000 → 1_000_000 COP — el gap §9f
de NO-validación del cuadre en producción queda deliberadamente fuera de
alcance); invariante de venta a crédito (principal del `CreditGranted` ==
`sale.total`; `pending === total − Σ abonos`; el pago inicial es el PRIMER abono
del crédito con refId = creditId y contexto Business; los abonos posteriores por
la rama sale-born mantienen el invariante); invariante de inventario
(stock_final == stock_inicial − Σ cantidades de ventas ACTIVAS + restauraciones;
las ventas soft-deleted — `deletedAt` — nunca cuentan como activas); y rollback
real del write-off con FAIL_STEP en la ÚLTIMA escritura (`markWrittenOff`
falla): el movement de gasto ya creado dentro del tx se aborta junto con él
(atomicidad real, no compensación).

## Decision table

| Operación | Documentos implicados | Estado actual | Decisión |
|---|---|---|---|
| `createTransfer` | Transfer + 2 Movements (expense/income) | ✅ **YA transaccional + CAS sobre Account** (R15 F5) | **Transacción** — implementada (R14-B + Fase 5): lecturas de ambas cuentas, validación de saldo y moneda, ids, 3 writes y CAS bump al final (`bumpVersion` de la cuenta origen) DENTRO del tx; bump fallido → `ConflictError(DEBT_MODIFIED_MSG)` + abort. Bajo N transfers concurrentes del mismo origen gana exactamente 1; los perdedores fallan por re-validación (fondos insuficientes tras el retry), nunca saldo negativo. |
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
| `editPrincipal` (CreditReceived) | CreditReceived update (full doc) + Movement update (principal) | ✅ **YA transaccional + CAS** (R15 F5) | **Transacción** — implementada (Fase 5): mismo patrón que `writeOffCreditGranted` (reads + guards + `update` con `expectedVersion` + cascada de movement dentro de `uow.withTransaction`). |
| `editPrincipal` (CreditGranted) | CreditGranted update (full doc) + Movement update (principal) | ✅ **YA transaccional + CAS** (R15 F5) | **Transacción** — implementada (Fase 5): idem; conserva el `saleId` en el snapshot del CreditGranted. |
| `updateTransfer` | Transfer update + 1–2 Movement updates (expense/income) | ✅ **YA transaccional** (R15 F5 + R15.2 policy F5) | **Transacción** — implementada (Fase 5 + R15.2): reads de cuenta y chequeo de SALDO (policy F5) con tx; delta `new−old` calculado en el tx — sin cambio real de sourceAmount → warning `insufficient_funds` con CERO escrituras; writes de transfer + movements con tx dentro de `uow.withTransaction`. |
| `deleteTransfer` | Movement delete ×2 + Transfer delete | ✅ **YA transaccional** (R15 F5) | **Transacción** — implementada (Fase 5): deletes de movements con tx (NotFound tolerante, orden expense→income) + `transferRepo.delete(..., tx)` dentro de `uow.withTransaction`. |
| `deleteSale` | stock increments ×N + Movement `deleteMany` (sale refId) + Movement `deleteMany` (credit refId) + CreditGranted delete + Sale delete | ✅ **YA transaccional + idempotente** (R15 F6) | **Transacción** — implementada (Fase 6, §9): toda la cascada (lectura de la venta y del ítem, stock restores, deletes de movements por refId, delete del crédito vinculado, delete final de la venta) dentro de `uow.withTransaction` con todas las lecturas/escrituras en la sesión. Idempotencia: la re-lectura en tx + `NotFoundError` del `saleRepo.delete` final hace que un request duplicado/concurrente aborte SIN volver a restaurar stock — restaurado exactamente 1 vez (verificado N=10/25/50). |
| `createAccount` con opening | Account create + Movement create (`opening`) | ✅ **YA transaccional** (R15 F6) | **Transacción** — implementada (Fase 6, §11): Account + opening movement en `uow.withTransaction`; la compensación manual R8 (`try/catch` → `accountRepo.delete`) fue ELIMINADA — el rollback real aborta la cuenta si el movement falla. Fix de causa raíz necesario: `MongoMovementRepository.resolveDependencies` ahora lee Account/Category con la sesión del tx (sin sesión la cuenta recién creada era invisible). |
| `register` / onboarding | User + Workspace + Membership + seed (`WorkspaceBootstrapper`: cuenta fija + categorías) | ✅ **YA transaccional** (R15 F6) | **Transacción** — implementada (Fase 6, §12): User + Workspace + Membership + seed (1 cuenta + 8 categorías) en UNA `uow.withTransaction`; `hasher.hash` y el pre-check de email duplicado quedan FUERA del tx; ids acuñados DENTRO del callback. Un fallo en cualquier paso (incluido el seed) deja CERO documentos parciales; el retry manual del registro converge sin duplicados (índices únicos de email y userId+workspaceId lo verifican). |
| `deleteCreditReceived` | Movement deletes (tolerantes, `NotFound → continue`) + CreditReceived delete | NO | **Justificado** — cascada idempotente ordenada hijos→padre con borrado tolerante (R5-B); un fallo parcial deja movimientos huérfanos que la defensa de lectura (`filter-live-linked-movements`) oculta y `reconcile.ts` detecta/limpia; no rompe ningún invariante financiero entre dos deletes independientes. R14-B declaró deliberadamente los deletes NO-transaccionales. Candidata a transaccionalizar en una ronda futura si el reconcile reporta huérfanos. |
| `deletePayable` | Movement deletes (tolerantes) + Payable delete | NO | **Justificado** — misma justificación que `deleteCreditReceived`. |
| `deleteCreditGranted` (standalone) | Movement deletes (tolerantes) + CreditGranted delete | NO | **Justificado** — misma justificación; los créditos sale-born NO se borran por esta vía (ConflictError R5-D0c) sino por `deleteSale` (Fase 6 transaccional). |
| `movement` standalone writes (`createMovement`, `updateMovement`, `deleteMovement`) | 1 documento | — | **Justificado** — documento único: atomicidad nativa de Mongo. |
| `setInitialAccountBalance` | 1 Movement create | — | **Justificado** — documento único. |
| `createAccount` sin opening | 1 Account create | — | **Justificado** — documento único. |
| `editTotal` (Payable) | 1 Payable update | — | **Justificado** — documento único; sin cascada de movimientos por diseño (`edit-total.ts`: "NO movement cascade"). |
| `deleteAccount` | Movement deletes + Account delete (+ touch de saldo dentro del tx) | ✅ **YA transaccional** (R15.1 6e) | **Transacción** — implementada (R15.1 6e): `countReferences` (7 referencias, counts SERIALES con la sesión del tx en `account-repository.ts:169-180`) como guard de pre-condición + touch de saldo en el mismo tx; los deletes hijos→padre corren dentro de `uow.withTransaction`; bajo create-vs-delete concurrente el touch + counts en la sesión impiden "perdonar" saldo de una cuenta recién creada (write-skew cerrado). R15.2 no cambió este mecanismo. |
| Lecturas y validaciones (findById/findByWorkspaceId, validaciones de saldo/moneda) | N/A | — | **Justificado** — las lecturas del AGREGADO DE DEUDA (findById/findByWorkspaceId con `tx?`) y las validaciones de saldo/moneda que derivan de él corren DENTRO del tx desde Fase 3 (snapshot-consistent); `AccountRepository.findById(tx?)` (F5) y el saldo de cuenta unificado R15.2-B (`computeAccountLiveBalance` sobre `MovementRepository.findByAccountIdForBalance(tx?)` — reemplazó a `aggregateBalance(tx?)`) participan del tx cuando el agregado validado es una cuenta (createTransfer/updateTransfer), y `MovementRepository.resolveDependencies` es session-aware desde F6 (el opening de `createAccount` lee la cuenta recién creada con la sesión). La protección bajo concurrencia es CAS sobre `__v` (Fase 4, implementada; Fase 5 para Account). |

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
    re-lecto contra estado fresco, no por CAS). En Fase 5 el mismo mecanismo se
    extendió a `Account` para `createTransfer`: `AccountRepository.bumpVersion`
    (CAS sobre `__v` de la cuenta origen, verificado con N=10/50/100 transfers
    paralelos en `concurrency-transfers.test.ts`).
5. **Criterio R15.5.2** ("todas las operaciones financieras críticas con
    atomicidad real") se cumple al cerrar las Fases 2–7 (las 6 fases cerradas — la
    Fase 6 cerró `deleteSale`, `createAccount` con opening y `register`, y la
    Fase 7 agregó la suite de integridad §25/§14 que verifica los invariantes
    financieros sobre transacciones reales: `integrity-suite.test.ts`); las filas
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
| `CatalogItemRepository` | `decrementStock` (R14-B), `incrementStock`, `findById` (Fase 6, lectura del ítem dentro del tx de `deleteSale`) |
| `AccountRepository` | `create` (Fase 6: opening de `createAccount` + cuenta fija del seed de `register`), `delete` (Fase 6), `findById` (F5), `bumpVersion` (F5) |
| `UserRepository` | `create` (Fase 6: onboarding de `register`) |
| `WorkspaceRepository` | `create` (Fase 6: onboarding de `register`) |
| `MembershipRepository` | `create` (Fase 6: onboarding de `register`) |
| `CategoryRepository` | `create` (Fase 6: seed de `register`) |

No recibieron `tx?`: los deletes de CreditReceived/Payable (justificados como
tolerantes en la matriz), `deleteCreditGranted` standalone y `deleteAccount`
(justificados, ver matriz) y los deletes de User/Workspace/Membership/Category
(no transaccionales por diseño — solo la creación participa del onboarding). El
`WorkspaceBootstrapper.bootstrap(workspaceId, tx?)` y `seedUser(..., tx?)`
(autorizados en Fase 6) enhebran el tx a los creates de Account y Category del
seed. `MovementRepository.resolveDependencies` es session-aware desde Fase 6
(defecto corrigido: sin sesión, la cuenta creada en el mismo tx era invisible).

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

### Contrato de Fase 5 (Account con CAS + lecturas del tx para transfers)

`AccountRepository` recibe la versión de `Account` (`version: doc.__v ?? 0` en el
mapper, default 0) y dos métodos nuevos:

| Repositorio | Métodos |
|---|---|
| `AccountRepository` | `findById(workspaceId, id, tx?)` (lectura con sesión), `bumpVersion(workspaceId, accountId, expectedVersion, tx?): Promise<boolean>` |
| `MovementRepository` | `findByAccountIdForBalance(workspaceId, accountId, tx?)` (lectura del saldo vivo con sesión; definición ÚNICA de saldo junto a `computeAccountLiveBalance`, R15.2-B — reemplazó a `aggregateBalance`) |

Semántica: `bumpVersion` ejecuta `runVersionedUpdate(AccountModel, {_id,
workspaceId}, {}, expectedVersion, session)` — update `{}` + `$inc: { __v: 1 }`
+ timestamps — y devuelve `matchedCount > 0` SIN traducir el fallo (el caller
mapea `false` → `ConflictError(DEBT_MODIFIED_MSG)` dentro del tx, abortando).
`computeAccountLiveBalance` (use case puro, `core/application/movements/
compute-live-balance.ts`) delega en `findByAccountIdForBalance`, que lee los
movimientos de la cuenta (filtro workspace+account, proyección mínima, SESIÓN
del tx cuando se llama dentro de una transacción) y suma `signedAmount` SIN
excluir transfers/cancelados/huérfanos — esto es CORRECTO para el saldo de la
cuenta (los transfers sí mueven saldo); la exclusión de transfers del resultado
económico vive en `core/application/economic-result.ts`
(`NON_ECONOMIC_LINK_KINDS`) y la exclusión de huérfanos del dashboard en
`accountBalancesFromMovements` (R7-A). Desde R15.2 este es el ÚNICO saldo
oficial (`aggregateBalance` eliminado). `createTransfer` (F5) y `updateTransfer`
(R15.2, policy F5: delta `new−old` + warning `insufficient_funds` con CERO
escrituras si no hay cambio real) lo usan DENTRO del tx (snapshot-consistente
con las escrituras previas del mismo tx); `deleteTransfer` reutiliza
`findById(tx?)` para las lecturas de cuenta. Verificación real:
`src/infrastructure/transactions/concurrency-transfers.test.ts` — N=10/50/100
transfers paralelos del mismo origen (exactamente 1 gana; `__v` origen == 1;
saldos finales correctos; perdedores por re-validación de fondos), rollback de
create/update/deleteTransfer y de editPrincipal ×2 con cascada fallida (crédito
intacto y `__v` sin mover); §36 verifica la policy F5 del updateTransfer.