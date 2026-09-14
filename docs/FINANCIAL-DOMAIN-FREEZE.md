# TWINCAP — FINANCIAL DOMAIN FREEZE (FREEZE FORMAL DEL DOMINIO FINANCIERO)

> **El dominio financiero está congelado. UX/UI puede modificar la forma en que las reglas se presentan, pero no las reglas mismas.**
>
> Documento de estado del freeze formal autorizado por la auditoría externa y el fundador el 2026-09-13.
> Fuente normativa maestra: `docs/PROJECT-RULES.md`. Prompt de la etapa: `docs/freeze + UX-UI.md`.

---

## 1. Fecha del freeze

**2026-09-13** — decisión del fundador tras la aprobación de la auditoría externa sobre los resultados de R15.3.2.

## 2. Versión / ronda que lo origina

- **R15.3** (2026-09-11): cierre de integridad referencial y veredicto §33-H `FINANCIAL DOMAIN FROZEN` (suite 1340/1340 + índices materializados en Atlas).
- **R15.3.1** (2026-09-12): hardening sin cambios de modelos; veredicto §26-L `READY FOR FINANCIAL FREEZE`.
- **R15.3.2** (2026-09-13): cierre definitivo de concurrencia financiera, serialización de saldos (18/18) y consolidación de reglas; veredicto §49: base lista para el cierre final.
- **Auditoría externa (2026-09-13):** aprobó los resultados de R15.3.2 y autorizó el freeze formal del dominio financiero.

## 3. Alcance congelado

El dominio financiero de TwinCap queda FROZEN a partir de R15.3.2 en `master`:

- Reglas financieras (semántica, modelo monetario, cálculos)
- Fuente de verdad de saldos
- Modelo monetario (minor units, sin floats)
- Semántica de saldos negativos
- Reglas de transferencias y multimoneda
- Garantías de atomicidad y concurrencia
- CAS, idempotencia, mecanismos de serialización
- Semántica de movimientos e integridad referencial
- Garantías de multi-tenancy

## 4. Reglas financieras congeladas

Fuente maestra: `docs/PROJECT-RULES.md` (§3–§13, §16). Resumen:

1. **Transferencia interna ≠ ingreso ni gasto** — mover dinero entre cuentas propias no cambia el resultado económico.
2. **Saldo de cuenta ≠ resultado económico** — el flujo de dinero y el resultado financiero son cosas distintas.
3. **Crédito recibido ≠ compra a crédito** — financiamiento es deuda; bien a crédito es `Payable`; el total de un `Payable` nunca se recontabiliza como gasto al registrar pagos.
4. **Venta ≠ cobro necesariamente** — venta a crédito genera cuenta por cobrar sin entrada de dinero.
5. Métricas del dashboard derivan del `kind`/naturaleza de cada movimiento — jamás sumar ciegamente por `type`.
6. **Fechas financieras = fechas civiles** — instante temporal ≠ fecha de negocio; prohibido compensar con offsets ±1 día sin causa raíz; conversión explícita respecto a timezone.
7. **Crédito otorgado: el abono amortiza primero el capital, solo el interés es ingreso** — `creditGrantedAbono` (no económico) recupera capital; `creditGrantedAbonoInterest` (ingreso) es el excedente; `creditGrantedWriteOff` registra gasto por el capital no recuperado; el pago inicial de venta POS a crédito reusa `creditGrantedAbono` con context Business y SÍ es ingreso (context-aware).

## 5. Operaciones cubiertas

Matriz completa de cuenta(s) afectada(s): `docs/PROJECT-RULES.md` §8.1 (mínimo obligatorio). Incluye:

- createMovement / updateMovement (amount y account A→B) / deleteMovement
- createTransfer / updateTransfer (source, destination, ambos) / deleteTransfer
- createSale / deleteSale
- createAbono / editAbono / deleteAbono / editPrincipal
- deleteCreditReceived / deleteCreditGranted / deletePayable / writeOff
- setInitialBalance (opening)
- Cualquier operación nueva DEBE añadirse a la matriz antes de existir.

## 6. Garantías de atomicidad

- Toda operación multi-documento financiera usa transacciones MongoDB reales (`uow.withTransaction` + misma session en todos los repos) — `docs/PROJECT-RULES.md` §7.
- Operaciones single-document usan operaciones atómicas de documento.
- Pregunta de atomicidad: ¿puede la operación quedar parcialmente aplicada?
- Tokens one-time (reset/verify email): consume + update en la MISMA transacción (R15.3.2 §26); hash fuera de la tx.
- Verificación empírica: suite de transacciones 120/120 (12 archivos) + `auth-atomicity` 2/2 con rollback real + 3 tests de rollback REAL en R14.

## 7. Garantías de concurrencia

- **Regla fundamental (R15.3.2):** toda operación que pueda modificar directa o indirectamente el saldo de una cuenta debe participar en el mecanismo de serialización de TODAS las cuentas afectadas.
- Método: `touch()` de la cuenta (bump `__v`) DENTRO de la misma transacción que escribe los movements; `touchAccounts` (dedupe por Set + ejecución secuencial) como ÚLTIMA escritura en los 11 use cases que mueven dinero (`touch-accounts.ts:33-38`).
- Prohibido `Promise.all`/`Promise.allSettled` sobre queries que compartan `ClientSession` (MongoServerError 251 / hangs).
- Write-skew sobre saldos derivados: pares concurrentes A–F (N=10–25) que reconcilian el ledger final (`concurrency-write-skew-pairs.test.ts`, 15/15).
- Matriz de serialización cerrada 18/18 filas FAIL → OK (`docs/R15.3.2-matrix.md`).

## 8. CAS (Optimistic Concurrency)

- Documentos con CAS: Movement (`__v`), Transfer (version), agregados financieros (CreditReceived, CreditGranted, Payable — `credit.version`), Account (touch).
- Versión: `doc.__v ?? 0` o campo `version` explícito.
- Escritura: `runVersionedUpdate` (filtro `__v: expectedVersion` + `$inc`).
- Conflicto → `ConflictError`; la garantía vive en el filtro atómico de Mongo, no en el cliente.
- Dedupe: si una operación toca dos cuentas iguales, el touch/bump NO se dispara dos veces.

## 9. Idempotencia

- Creaciones financieras con `idempotencyKey` OBLIGATORIA: createMovement, createTransfer, createSale, createCreditReceived, createCreditGranted, createPayable, setInitialBalance (y definidas como idempotentes en actions).
- Claim atómico: índice unique `(userId, action, key)` + TTL 24h deterministas; E11000 → `duplicateRequest`.
- Gate `committed`: la key jamás se libera post-commit (R15.3.1 P1.2).
- Deletes: idempotentes por naturaleza (segundo intento → NotFoundError); sin key por diseño.
- Retry nunca produce duplicación.

## 10. Multimoneda

- Moneda de origen/destino independientes; `amount` origen/destino independientes.
- Tasa: `deriveExchangeRate()` (sourceMajor/destinationMajor, exponentes ISO 4217); `effectiveExchangeRate` siempre derivado; la UI NUNCA pide tasa manual.
- NO convertir monedas en la UI — agrupar por moneda de forma honesta.
- Abono desde cuenta de moneda distinta a la deuda → rechazado.
- Prohibido asumir moneda silenciosamente (`?? 'COP'`, `|| 'COP'`, fallback) — la UI resuelve la moneda real o muestra estado inconsistente/error (R15.3.2 F5).

## 11. Saldos negativos

- Estado permitido (política F5): el sistema NO bloquea la intención del usuario por fondos insuficientes.
- `InsufficientFundsWarning` estructurado + confirmación del saldo negativo (saldo actual/operación/proyectado).
- La UI muestra saldo negativo en rojo. Semántica: realidad financiera registrada, no sistema roto.

## 12. Integridad referencial

- Movimientos del sistema usan `link` (kind + refId) — referencias a padres vivos.
- Lectura: `filterMovementsWithLiveParents` (fail-closed — padre inexistente ⇒ excluido del saldo).
- Invariante permanente: `saldo = suma de movimientos válidos`. Ninguna operación nueva puede crear caminos que rompan esta propiedad.

## 13. Fuente de verdad de saldos

- Definición única: `computeAccountLiveBalance` + `MovementRepository.findByAccountIdForBalance(tx?)`.
- `aggregateBalance` ELIMINADO del código — NO reintroducir (cualquier reintroducción es regresión).
- Saldo derivado de la suma de movimientos válidos (supervivientes de `filterMovementsWithLiveParents`).
- Agregaciones monetarias: núcleo único `sumSafeMinorUnits()`; prohibido `reduce((s,x) => s + x.amount.amount, 0)`.

## 14. Opening balances

- Una sola apertura por cuenta: guard `countOpeningMovements` + `ConflictError` + índice único parcial `link.kind=opening` en movements + atomicidad.
- `setInitialBalance` corre dentro de `uow.withTransaction`.
- El backstop MongoDB impide doble opening incluso bajo carrera (verificado en E2E duplicate-opening).

## 15. Multi-tenancy

- Aislamiento por `workspaceId`; el usuario accede vía su `Membership`.
- Toda query DEBE filtrar por `workspaceId`; falta de filtro = defecto.
- Recursos inexistentes o ajenos → `NotFoundError` — jamás exponer datos de otro tenant.
- Verificado: `tenant-touch.test.ts` (workspace boundary con tx real) + 38 tests de aislamiento.

## 16. Reconciliación

- `findOrphanMovements` + `runReconcileDiagnosis` (honesto: nunca finge reparar).
- Clasificación: manual / unknown-kind / reconciled / orphan / ambiguous.
- Unknown y ambiguous se EXCLUYEN del saldo (fail-closed).
- `isModernRecord` (cutoff 2026-09-09): agregados modernos sin movement → `ConflictError`; legacy → warn+continue.

## 17. Índices de producción relevantes

Materializados y verificados en Atlas (`autoIndex` desactivado en producción desde R15.2-C1; la materialización/verificación es vía `scripts/ensure-*.mjs --apply` / `scripts/verify-*.mjs` o el workflow manual `.github/workflows/index-ops.yml` con secret `MONGODB_URI_ATLAS`; el CI normal NUNCA toca Atlas):

- **movements**: opening único parcial `{workspaceId, accountId}` filtered `link.kind=opening` + índices de balance/filtro.
- **idempotency**: unique `{userId, action, key}` + TTL 24h.
- **dashboard** y **monitor**: índices de agregación/rate-limit (`key_1` único + TTL).
- **authtokens**: compound `{userId, purpose, createdAt}` + partial unique `{userId, purpose}` filtered `used:false` (1 token activo) + TTL `expiresAt_1`.

## 18. CONTRACT OK 5/5 (2026-09-13)

Verificación final contra Atlas: **CONTRACT OK 5/5** — dashboard, monitor, movement, idempotency, auth-token. Comando: `pnpm indexes:verify` (orquesta `scripts/verify-all-indexes.mjs`; fail-closed). Los 3 índices de auth-token ya estaban materializados con propiedades exactas antes de desactivar `autoIndex` (verificación `--apply` fue no-op).

## 19. Relación entre dominio financiero y UX/UI

- **UX/UI DEBE ADAPTARSE AL DOMINIO. EL DOMINIO NO DEBE ADAPTARSE A UX/UI.**
- UX/UI puede modificar la forma en que las reglas se presentan (jerarquía, cards, microcopy, navegación, estados), pero NO las reglas mismas.
- Prohibido recalcular saldos financieramente en frontend, duplicar reglas en componentes o crear una segunda fuente de verdad. Frontend presenta; backend/domain calcula y garantiza.
- La UI DEBE hacer visible la robustez existente del dominio (confianza): saldos negativos claros, transferencias entre monedas con ambas cantidades, estados explícitos, mensajes precisos.
- Regresión financiera prohibida: después de cada conjunto significativo de cambios UX se verifica que sigan funcionando crear/editar/eliminar movimientos, transferencias, multimoneda, saldo negativo, créditos, abonos, POS, opening balances, multi-cuenta, idempotencia y aislamiento tenant.

## 20. Procedimiento excepcional para reabrir el freeze

Si durante UX/UI aparece evidencia de un defecto financiero REAL:

1. **Detener** la modificación.
2. **Documentar** el hallazgo.
3. Indicar exactamente qué regla del dominio afecta.
4. Explicar por qué constituye un defecto real.
5. Determinar impacto.
6. Proponer la corrección mínima necesaria.
7. **Solicitar aprobación explícita** antes de modificar el dominio congelado.

NO se permite romper el freeze por: preferencias estéticas, comodidad del frontend, simplificación de componentes, reducción de código, cambios de nombres, preferencias personales del agente, similitud con un competidor, "me parece más intuitivo", o deseos de implementar funcionalidad nueva.

---

## Conclusión

TwinCap tiene, desde R15.3.2 (2026-09-13), un **dominio financiero congelado**: reglas, fuente de verdad, atomicidad, concurrencia, CAS, idempotencia, multimoneda, saldos negativos, integridad referencial, opening balances, multi-tenancy y reconciliación verificados empíricamente y documentados. La etapa UX/UI construye sobre esta base estable.

> **"El dominio financiero está congelado. UX/UI puede modificar la forma en que las reglas se presentan, pero no las reglas mismas."**