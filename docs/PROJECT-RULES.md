# TWINCAP — PROJECT-RULES.md (FUENTE MAESTRA DE REGLAS DEL PROYECTO)

> **ESTE ARCHIVO ES LA FUENTE MAESTRA DE REGLAS DEL PROYECTO.** Es de lectura obligatoria.
>
> **Todo agente o desarrollador que trabaje sobre TwinCap DEBE leer este archivo al inicio de cada sesión de trabajo y DEBE volver a leerlo después de cualquier compactación, resumen de contexto, recuperación de sesión o pérdida parcial del contexto.**
>
> Después de cualquier compactación de contexto, resumen automático, recuperación de sesión o pérdida parcial del contexto, la primera acción del agente debe ser volver a leer `docs/PROJECT-RULES.md` antes de modificar código o tomar decisiones arquitectónicas. Esto NO es opcional.
>
> **Ninguna regla crítica del proyecto debe existir únicamente en la memoria de un agente, conversación, issue, comentario temporal o contexto de sesión. Si una decisión es relevante para la arquitectura, seguridad, integridad financiera, UX funcional o comportamiento esperado del producto, debe quedar registrada en este archivo.**
>
> Este archivo es VIVO: cada nueva decisión arquitectónica, financiera, de seguridad, concurrencia o UX que implique una regla funcional, restricción técnica o invariante del dominio DEBE incorporarse aquí cuando sea establecida. Cuando una nueva regla contradiga una anterior: (1) no ocultar la contradicción; (2) identificar la regla anterior; (3) documentar que fue reemplazada; (4) indicar la razón; (5) dejar únicamente la regla nueva como vigente; (6) conservar, cuando sea útil, un historial breve de decisiones.
>
> Al iniciar cualquier nueva ronda, el agente debe leer `AGENTS.md`, `docs/PROJECT-RULES.md` y el documento maestro de auditoría vigente antes de realizar cambios. Cada nueva ronda debe comprobar si las modificaciones propuestas contradicen alguna regla previamente establecida.
>
> **Prohibición de duplicación de reglas**: si existe información equivalente en varios documentos, `PROJECT-RULES.md` es la fuente maestra de reglas. Los informes de auditoría son históricos y se conservan, pero no constituyen fuente normativa divergente.

---

## 1. Propósito del proyecto

TwinCap es un **SaaS de finanzas personales y pequeños negocios** (etapa: beta cerrada / prototipo funcional en producción).

- La funcionalidad existente tiene PRIORIDAD sobre cualquier mejora estética.
- Durante la beta cada usuario tiene un solo Workspace personal (equipos/membership múltiples desactivados); no existe selector de workspaces ni UI de equipos en esta etapa.
- NO existe módulo de Compras — no inventarlo ni implementarlo.
- La siguiente ronda UX/UI debe poder comenzar sobre una base financiera considerada suficientemente estable.

## 2. Arquitectura

### 2.1. Arquitectura Hexagonal (inquebrantable)

```
src/
├── core/
│   ├── domain/              ← Entidades, value objects, errores de dominio
│   ├── application/         ← Use cases por feature
│   │   └── ports.ts         ← Interfaces de repositorios y servicios
├── infrastructure/
│   ├── models/              ← Modelos Mongoose
│   ├── repositories/        ← Implementaciones de repositorios
│   ├── auth/                ← Lógica de autenticación
│   ├── transactions/        ← Unit of Work / transacciones reales
│   └── config/              ← Configuración
├── components/
│   ├── ui/                  ← Componentes reutilizables
│   └── [feature]/           ← Componentes de presentación por módulo
├── i18n/                    ← Internacionalización custom
└── app/                     ← App Router (rutas, layouts, pages, API routes)
```

### 2.2. Reglas de capas

1. **`core/domain/`** — Solo entidades, value objects y errores. Sin dependencias de infraestructura.
2. **`core/application/`** — Solo use cases. Dependen de `ports.ts` (interfaces), nunca de implementaciones.
3. **`infrastructure/`** — Implementa puertos de `ports.ts`. Modelos Mongoose, repositories, auth.
4. **`components/`** — Solo presentación. Sin lógica de negocio, sin llamadas directas a repositorios.
5. **`app/`** — Rutas y pages. Conectan infrastructure con components.

### 2.3. Conexión a base de datos

- Cada server action o route handler DEBE llamar `await connectDb()` (desde `@/infrastructure/db/connection`) antes de usar cualquier repository/modelo.
- NO instanciar repositories a nivel de módulo — crearlos después de que `connectDb()` haya resuelto (el singleton sobrevive HMR).
- Violarlo causa `buffering timed out after 10000ms`.

### 2.4. Unit of Work

- Toda operación multi-documento DEBE ejecutarse dentro de `uow.withTransaction(...)` (`MongoUnitOfWork` sobre `session.withTransaction`).
- Todos los repositories que participan en la misma operación DEBEN recibir y usar la MISMA session/TransactionHandle.
- Un repository que acepta `session?: ClientSession` DEBE usarla en TODAS las operaciones correspondientes (una session aceptada y luego ignorada es un defecto).
- Un read de un documento escrito por la propia transacción NO puede hacerse sin session (no vería los cambios aún no commiteados).

### 2.5. Frontera server→client (serialización)

- React solo acepta objetos planos y built-ins (`Date`, `Map`, `Set`) como props de Server a Client Component.
- Dentro del `toJSON()` de una entidad, todo valor DEBE ser literal, primitivo, `Date` o una llamada explícita a `.toJSON()`.
- NUNCA pasar instancias de clases de dominio (`Money`, entidades, etc.) dentro del snapshot.
- La frontera NO está protegida por TypeScript: que compile no significa que sea JSON-safe.
- Los tipos `Serialized*` se derivan de `ReturnType<Entidad['toJSON']>`.

## 3. Multi-tenancy

- Aislamiento por **workspace/tenant** a nivel de `workspaceId`; el usuario accede vía su `Membership`.
- Toda query DEBE filtrar por `workspaceId`. Falta de filtro = defecto.
- PROHIBIDO confiar únicamente en IDs enviados por el cliente — validar pertenencia en backend.
- Ante recursos inexistentes o pertenecientes a otro workspace, el comportamiento esperado es `NotFoundError` — jamás exponer datos de otro tenant ni distinguir por mensaje el "no existe" del "no es tuyo" cuando la distinción filtre datos.

## 4. Dinero

- Representación monetaria SIEMPRE en **minor units** (enteros).
- **PROHIBIDO usar floats para cálculos financieros.**
- Toda suma financiera relevante DEBE usar la abstracción monetaria segura y centralizada: `sumSafeMinorUnits()` (núcleo único de agregación monetaria guardada). Queda prohibido `reduce((sum, x) => sum + x.amount.amount, 0)` en agregaciones financieras.
- `Money.plus/minus` re-validan (`MoneyError` → `error.invalidAmount`).
- Límites seguros y overflow: usar `assertSafeMinorUnits` cuando corresponda.
- Regla de truthiness en dinero: cuando `0` es un valor válido, NUNCA usar `input.amount ? ...` — usar `input.amount !== undefined` (o equivalente). Patrón prohibido: `input.amount ? new Money(...) : existing.amount` (con amount=0 desincroniza abono↔movement).
- Invariante: está prohibido asumir una moneda silenciosamente (`?? 'COP'`, `|| 'COP'`, fallback de moneda) cuando la moneda real no puede determinarse. La UI debe resolver la moneda real o mostrar estado inconsistente/error — nunca inventar una moneda. En particular, si una cuenta no resuelve moneda (cadena sale items → accounts) se debe `throw` — jamás `?? 'COP'` (R15.3.2 F5: `sale-list.tsx` / `export-csv.ts`).

## 5. Saldos

- Definición única de saldo: `computeAccountLiveBalance` + `MovementRepository.findByAccountIdForBalance(tx?)`. `aggregateBalance` está ELIMINADO del código (no reintroducirlo).
- El saldo se deriva de la suma de movimientos válidos (supervivientes de `filterMovementsWithLiveParents`): `saldo = suma de movimientos válidos`.
- Los saldos del dashboard/posición financiera derivan del `kind`/naturaleza de cada movimiento — jamás sumar ciegamente por `type`.
- Saldo negativo es un estado permitido (política F5): el sistema NO bloquea la intención del usuario por fondos insuficientes, sino que presenta `InsufficientFundsWarning` estructurado + confirmación del saldo negativo. La UI muestra saldo negativo en rojo.

## 6. Multimoneda

- Moneda de origen y moneda de destino son campos independientes; `amount` de origen y `amount` de destino también.
- PROHIBIDO asumir que una transferencia usa una sola cantidad para ambas monedas.
- Cálculo de tasa: `deriveExchangeRate()` en dominio (sourceMajor/destinationMajor, exponentes ISO 4217); `effectiveExchangeRate` siempre derivado.
- NO convertir monedas en la UI — agrupar por moneda de forma honesta.
- Un abono desde cuenta de moneda distinta a la deuda debe rechazarse.

## 7. Atomicidad

- Operaciones multi-documento financieras DEBEN usar transacciones MongoDB (`uow.withTransaction` + misma session en todos los repos).
- Operaciones single-document pueden usar operaciones atómicas de documento.
- La pregunta de atomicidad es: ¿puede la operación quedar parcialmente aplicada?

## 8. Concurrencia — REGLA FUNDAMENTAL (R15.3.2)

> **Toda operación que pueda modificar directa o indirectamente el saldo de una cuenta debe participar en el mecanismo de serialización/concurrencia de TODAS las cuentas afectadas por esa operación.**

- Una operación financiera debe proteger mediante el mecanismo de concurrencia correspondiente TODA cuenta cuyo saldo pueda cambiar como consecuencia de dicha operación.
- NO basta con "¿usa transacción?" — también hay que responder "¿qué cuentas pueden cambiar?" y "¿todas participan en el mismo mecanismo de serialización?".
- La serialización financiera (¿puede competir con otra operación sobre el mismo saldo sin mecanismo común de conflicto?) es DISTINTA de la atomicidad (¿puede quedar parcialmente aplicada?). La matriz debe representar ambas por separado.
- Método de serialización: `touch()` de la cuenta (bump de `__v`) DENTRO de la misma transacción que escribe los movements. Un touch fuera de la transacción NO da la garantía.
- Los **11 use cases que mueven dinero** tocan la cuenta de pago como **ÚLTIMA escritura** dentro de la transacción, vía el helper `touchAccounts` (dedupe por Set de cuentas + ejecución secuencial — `touch-accounts.ts:33-38`). El touch es un shared-document write (`$set {updatedAt}`, SIN CAS): su valor es de conflicto, no de datos (R15.3.2 F4).
- Mecanismo de serialización separado: `bumpVersion` + CAS (ver §9).
- Atributos exigidos operación por operación (matriz): atomicidad + serialización + CAS cuando corresponda + idempotencia cuando corresponda + tenant isolation + integridad referencial + seguridad monetaria.

### 8.1. Matriz de cuentas afectadas (mínimo obligatorio)

| Operación                           | Cuenta(s) afectada(s)                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| createMovement                      | cuenta                                                     |
| updateMovement amount               | cuenta                                                     |
| updateMovement account A→B          | **A + B**                                                  |
| deleteMovement                      | cuenta                                                     |
| createTransfer                      | origen + destino                                           |
| updateTransfer sourceAmount         | origen                                                     |
| updateTransfer destinationAmount    | destino                                                    |
| updateTransfer source + destination | origen + destino                                           |
| updateTransfer account change       | no aplica al diseño actual (no se permite cambiar cuentas) |
| deleteTransfer                      | origen + destino                                           |
| createSale                          | cuenta                                                     |
| updateSale                          | no aplica (no existe use case updateSale)                  |
| deleteSale                          | cuenta(s) de los movements eliminados (venta + abonos)     |
| createAbono                         | cuenta                                                     |
| editAbono                           | cuenta                                                     |
| deleteAbono                         | cuenta                                                     |
| editPrincipal                       | cuenta                                                     |
| deleteCreditReceived                | cuenta(s) afectadas                                        |
| deleteCreditGranted                 | cuenta(s) afectadas                                        |
| deletePayable                       | cuenta(s) afectadas                                        |
| writeOff                            | cuenta afectada                                            |
| cualquier operación nueva           | debe añadirse a la matriz                                  |

### 8.2. Prohibición de Promise.all con ClientSession

> PROHIBIDO ejecutar `Promise.all` (o `Promise.allSettled`) sobre queries/updates que compartan la misma `ClientSession`. Con sesión MongoDB activa, las operaciones DEBEN ser secuenciales. El driver MongoDB NO admite operaciones concurrentes sobre una misma session (MongoServerError 251 / hangs).

## 9. CAS (Optimistic Concurrency)

- Documentos con CAS: Movement (`__v`), Transfer (version), agregados financieros (CreditReceived, CreditGranted, Payable — `credit.version`), Account (touch).
- Cómo se obtiene la versión: `doc.__v ?? 0` (Mongoose) o campo `version` explícito.
- Comparación y escritura: `runVersionedUpdate` (filtro por `__v: expectedVersion` + `$inc`).
- Ante conflicto: `ConflictError` (p. ej. `MOVEMENT_MODIFIED_MSG`); el cliente recibe error de conflicto y reintenta con la versión nueva.
- PROHIBIDO confiar únicamente en una versión proporcionada por el cliente como garantía de integridad: la versión client-side se usa como entrada del CAS, la garantía vive en el filtro atómico de Mongo.
- En operaciones multi-cuenta, si una operación toca dos cuentas y ambas son la misma, el touch/bump NO debe dispararse dos veces (dedupe por cuenta dentro de la operación).

## 10. Idempotencia

- Operaciones idempotentes: todas las creaciones financieras con `idempotencyKey` OBLIGATORIA: createMovement, createTransfer, createSale, createCreditReceived, createCreditGranted, createPayable, setInitialBalance (y las definidas como idempotentes en actions).
- La key se reclama ANTES de ejecutar (claim atómico con índice unique `(userId, action, key)` + TTL 24h deterministas; E11000 → `duplicateRequest`).
- Se considera `committed` cuando la transacción principal hizo commit.
- **PROHIBIDO liberar una idempotency key después de un commit exitoso simplemente porque falló una operación post-commit** (gate `committed`: la key jamás se libera post-commit; revalidatePath es best-effort).
- Deletes: por diseño no usan idempotency key — son idempotentes por naturaleza (segundo intento → NotFoundError). No introducir idempotency keys en deletes sin decisión explícita documentada.
- Retry: un retry (transacción, transient error, E11000) NUNCA puede producir duplicación.

## 11. Opening balances

- Una sola apertura por cuenta: guard de aplicación (`countOpeningMovements` + `ConflictError`) + índice único parcial `link.kind=opening` en movements + atomicidad.
- Comportamiento ante concurrencia: el guard y el índice deben impedir doble opening incluso bajo carrera.
- `setInitialBalance` corre dentro de `uow.withTransaction`.

## 12. Integridad referencial

- Movimientos del sistema usan `link` (kind + refId) — referencias a padres vivos (movimientos, transfers, créditos, payables, ventas).
- Lectura de movimientos: `filterMovementsWithLiveParents` (fail-closed — un movement del sistema cuyo padre no existe se EXCLUYE del saldo).
- Reconciliación: `findOrphanMovements` + `runReconcileDiagnosis` (honesto: nunca finge reparar; clasifica manual/unknown-kind/reconciled/orphan/ambiguous). Unknown y ambiguous se EXCLUYEN del saldo.
- Comportamiento conservador ante datos legacy: `isModernRecord` (cutoff 2026-09-09) — agregados modernos sin movement obligatorio → `ConflictError`; legacy → warn+continue con reconciliación.
- Invariante permanente: `saldo = suma de movimientos válidos`. Ninguna operación nueva puede crear caminos que rompan esta propiedad.

## 13. Seguridad

- **JWT encriptado A256GCM (jose)** + bcryptjs. NUNCA hardcodear tokens, secrets o credenciales.
- Toda operación sensible DEBE validar JWT en backend. NUNCA confiar solo en restricciones del frontend.
- Auth protection NO vive en proxy/middleware — vive en el route tree (`(main)/layout.tsx` con `getCurrentUser()`).
- Cookies httpOnly/secure; sesiones con `sessionVersion` (cambiar la contraseña invalida sesiones anteriores).
- Tokens de reset/verify (one-time): garantía de **un token activo por (user, purpose)** bajo concurrencia — índice partial unique `(userId, purpose)` filtered `used:false` en AuthToken (`auth-token.ts:50-53`) + revoke-before-insert + retry E11000; los flujos de auth con token one-time (reset password / verify email) DEBEN consumir el token y actualizar el usuario en la MISMA transacción (`uow.withTransaction`; puertos `AuthTokenStore.consume` / `UserRepository.update` con `tx?`; hash fuera de la tx) — consumir sin actualizar quema tokens si el update falla (R15.3.2 §26).
- Rate limiting: IP real desde `headers()` (x-real-ip → primer x-forwarded-for → unknown); limiter atómico `findOneAndUpdate` + `$inc` + índice único + retry E11000; gate monitor 120/15min. Modelo de confianza: detrás de Vercel los headers de IP son normalizados por el proxy confiable; fuera de Vercel un cliente puede falsificar headers (la garantía explícita vive en PROJECT-RULES y en la doc de despliegue).
- **Lockout por EMAIL** (además del rate limiter por IP): 5 fallos/60min → lockout de 30 min desde el ÚLTIMO fallo (cada fallo nuevo mientras está bloqueado estira el lockout) — mitiga la rotación de IPs (`infrastructure/auth/login-attempts.ts`, Clock inyectable; R15.3.2 F5).
- Security headers de producción: CSP con nonce por request, HSTS, nosniff, Referrer-Policy, Permissions-Policy deny-by-default, `frame-ancestors 'none'`.
- Auditoría: `OperationLogger` + `withAudit` — 37 operaciones financieras críticas + auth instrumentadas; registro mínimo durable en Mongo sin PII; best-effort sin transacciones (mutación primero, log después, señal stderr).
- Validar datos en backend siempre; sanitizar inputs del usuario; verificar autorización antes de cada operación sobre datos.
- CSRF: aplicar las protecciones del framework vigente (Next.js Server Actions).

## 14. Testing

- Ejecutar con `pnpm test` (Vitest). **NUNCA npm/npx/yarn.**
- Typecheck: `pnpm exec tsc --noEmit`. Lint: `pnpm lint`. Build: `pnpm build`. E2E: `pnpm test:e2e` (Playwright).
- **Timeout de la suite completa (REGLAMENTARIO)**: la suite Vitest mide **~21 min** (2026-09-14, 131 archivos / 1439 tests, serial por replset `fileParallelism: false`). El timeout por defecto del runner de comandos (120s) NO alcanza y cualquier corrida completa sin timeout explícito muere a los 2 minutos. REGLA: toda corrida completa de `pnpm test` debe ejecutarse con **timeout ≥ 45 min (2_700_000 ms)** en el runner; el job CI `quality` corre con `timeout-minutes: 60` (cubre install + typegen + tsc + lint + tests + build, cf. `.github/workflows/ci.yml`). Reintentos: NUNCA reintentar con el default de 2 min — un reintento legítimo usa el timeout correcto y registra el error real antes. Per-test ya configurado (60s en `vitest.config.ts`); el wall-clock total no se gobierna en vitest.
- Todo test de concurrencia/transacción real DEBE usar MongoDB real — `MongoMemoryReplSet` (pin 7.0.41, `launchTimeout: 45_000`, `vi.clearAllMocks()` primero en beforeEach, guarded `if (mongod) await mongod.stop()`).
- Los tests deben demostrar INVARIANTES (saldo final = suma de movimientos válidos, sin movimientos parcialmente aplicados), no solo "normalmente funciona".
- Los **write-skew sobre saldos derivados** se cubren con tests de pares concurrentes (grupos A–F, N=10–25) que reconcilian el ledger final tras las carreras (R15.3.2 F6 §20; `concurrency-write-skew-pairs.test.ts`).
- Los tests de concurrencia deben ejecutarse con stress (N iteraciones) cuando sea viable.
- Prohibido declarar PASS sin ejecutar. Distinguir siempre: VERIFICADO POR EJECUCIÓN / VERIFICADO POR INSPECCIÓN / NO VERIFICABLE EN ESTE ENTORNO.
- No suppressar tests que fallen.

## 15. UX/UI (reglas funcionales vigentes que la futura ronda UX DEBE respetar)

- i18n: todo texto visible nuevo DEBE existir en `messages/es.json` y `messages/en.json` (paridad). NUNCA hardcodear textos en componentes. Español NEUTRO (prohibido voseo/regionalismos en UI).
- Textos de dominio generados automáticamente (notas de movimientos sistema, categorías sintéticas) NUNCA se persisten acoplados a un idioma: se derivan en render vía `link.kind`/identificadores estructurados + i18n.
- Mobile-first: 3 breakpoints (375px, 768px, 1280px). No usar `overflow-x: auto` como única solución.
- Componentes reutilizables → `src/components/ui/`; específicos de módulo → `src/components/[modulo]/`.
- Iconos: Lucide React vía `src/components/ui/icon.tsx`.
- UI DEBE mostrar estado inconsistente/error cuando la moneda real no puede determinarse — jamás un fallback monetario silencioso.
- Conservar: saludo, filtros, Activos/Pasivos, evolución anual, cards, balances, dark mode, i18n, responsive, loading/empty/error states, accesibilidad, navegación, seguridad.
- No introducir de nuevo `Account.scope` — `Movement.context` es la fuente de Personal/Negocio.
- No cambiar la semántica de Activos/Pasivos — independientes de filtros de actividad.
- No inventar columnas en tablas de resumen: 4 columnas máximo, justificadas por utilidad.
- No mostrar todos los reportes simultáneamente — menú de acceso.

## 16. Principios financieros (inquebrantables)

1. **Transferencia interna ≠ ingreso ni gasto**: mover dinero entre cuentas propias cambia dónde está el dinero, no el resultado económico.
2. **Saldo de cuenta ≠ resultado económico**: el flujo de dinero y el resultado financiero son cosas distintas.
3. **Crédito recibido ≠ compra a crédito**: recibir financiamiento es deuda; adquirir un bien a crédito es una obligación (`Payable`). El total de un `Payable` NUNCA se recontabiliza como gasto cuando se registran sus pagos.
4. **Venta ≠ cobro necesariamente**: una venta a crédito genera cuenta por cobrar sin que el dinero haya entrado.
5. Las métricas del dashboard deben derivar del `kind`/naturaleza de cada movimiento — jamás sumar ciegamente por `type`.
6. **Fechas financieras = fechas civiles**: distinguir instante temporal de fecha de negocio; PROHIBIDO compensar con offsets ±1 día sin entender la causa raíz; toda conversión/formateo debe ser explícito respecto de timezone.
7. **Crédito otorgado: el abono amortiza primero el capital, solo el interés es ingreso**: en créditos otorgados standalone (Personal), cada abono recupera primero el capital prestado (`creditGrantedAbono`, NO económico); SOLO el excedente sobre el principal (`creditGrantedAbonoInterest`) es ingreso. La baja por incobrable (`creditGrantedWriteOff`) registra GASTO por el capital no recuperado (principal − Σ capital recuperado; el interés no realizado NO es pérdida) y excluye el crédito del activo en Posición Financiera. El pago inicial de una venta POS a crédito es un caso aparte: reusa el kind `creditGrantedAbono` con context Business y SÍ es ingreso (`salePayment`-equivalente), por lo que `countsTowardEconomicResult` es context-aware.

## 17. Decisiones históricas relevantes (por qué existen las reglas)

- **R15.2**: se adoptó la definición única de saldo (eliminación de `aggregateBalance`) tras detectar múltiples agregaciones divergentes del saldo real. Cualquier reintroducción de una agregación paralela es regresión.
- **R15.1 F1**: se eliminó `Promise.all` en `updateTransfer` porque la sesión MongoDB usada concurrentemente causaba `MongoServerError 251` → retry infinito → E2E colgada. La lección se generalizó: session compartida = serial.
- **R15.3**: el dominio financiero se declaró FROZEN con verificación real (suite 1340/1340 + índices materializados en Atlas). R15.3.1 añadió hardening sin cambiar modelos (0 cambios de contrato). R15.3.2 verifica que el freeze sea REAL y no documental.
- **R15.3.1 P1.2**: gate `committed` en actions — antes, un fallo post-commit liberaba la idempotency key y el retry del usuario duplicaba la operación.
- **R13**: cambio de tenant de `userId` a `workspaceId` (autorizado por el usuario; single-user queda como caso degenerado de workspace personal).
- **R9**: la regla de amortización capital-primero de créditos otorgados proviene de una decisión explícita del fundador (2026-08-30).
- **R3**: `Movement.context` reemplazó `Account.scope` (decisión D3-bis) — no reintroducir `Account.scope`.
- **R1-6**: la arquitectura hexagonal y los principios financieros 1-5 datan de las primeras auditorías; el principio 7 se añadió en R9.
- **Pre-commit GGA deshabilitado permanentemente**: la sesión de revisión hacia staging masivo y dejaba el índice corrupto (`invalid object ... Error building trees`). NO volver a habilitarlo. La verificación de calidad es `pnpm test` + `pnpm exec tsc --noEmit`.

## 18. Reglas transversales de trabajo

- **Gestor de paquetes: pnpm exclusivo.** NUNCA `npm`, `npx`, `yarn` ni `cnpm` (regla global extendida). Usar `pnpm exec` / `pnpm dlx` en lugar de `npx`.
- Commits convencionales: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:` — un commit por unidad de trabajo lógica.
- NO añadir "Co-Authored-By" ni atribución de IA a los commits.
- NO commitear secrets o datos sensibles.
- Sin hook GGA (deshabilitado permanentemente, ver §17).
- Máximo UNA dependencia nueva por fase (justificada). Preferir soluciones nativas.
- Next.js 16: usar `src/proxy.ts` (NO `middleware.ts`) para intercepción request-level. Leer la doc en `node_modules/next/dist/docs/` antes de escribir código Next.
- **Estilo de código — comillas dobles (OBLIGATORIO): todo código TS/TSX/JSON usa comillas dobles SIEMPRE** (`.prettierrc` → `singleQuote: false`). Prohibido escribir single quotes en código nuevo o modificado "porque el archivo legacy las usa". Todo archivo tocado DEBE quedar prettier-clean antes de commitear: `pnpm exec prettier --write <archivos tocados>` (o `pnpm format`) y verificar con `pnpm exec prettier --check <archivos>`; el orquestador normaliza si un agente usó single quotes. Los archivos legacy con single quotes NO se migran en masa (decisión 2026-09-04, mega-diff evitado — ver `docs/AUDIT-AND-PLAN-HISTORY.md` Fase 10); se normalizan naturalmente cuando se tocan. La fuente de verdad es el config del repo, NO el estilo local del archivo.
- No usar `window.location.reload()`.
- No modificar archivos sin relación con la ronda salvo razón documentada. No introducir temporales/logs/secretos/dumps/artefactos de build.

## 18. Freeze del dominio financiero (REGLA PERMANENTE — autorizado 2026-09-13)

> **Desde R15.3.2, el dominio financiero de TwinCap se considera CONGELADO.** Las futuras etapas de UX/UI, crecimiento y producto DEBEN consumir sus contratos y reglas existentes. Cualquier reapertura del dominio financiero requiere evidencia de un defecto real y aprobación explícita.

- **El dominio financiero está congelado. UX/UI puede modificar la forma en que las reglas se presentan, pero no las reglas mismas.** Documento de referencia: `docs/FINANCIAL-DOMAIN-FREEZE.md`.
- Prohibido (por razones de UX/UI, estética, conveniencia de frontend, preferencia personal o similitud con competidores): rediseñar reglas financieras, cambiar la fuente de verdad, cambiar el modelo monetario, introducir floats, reintroducir `aggregateBalance`, modificar la semántica de saldos negativos, modificar reglas de transferencias, modificar reglas de multimoneda, modificar garantías de atomicidad/concurrencia, eliminar CAS, eliminar idempotencia, eliminar mecanismos de serialización, cambiar la semántica de movimientos, alterar la integridad referencial, alterar garantías de multi-tenancy, o alterar la lógica financiera para simplificar componentes visuales.
- Procedimiento excepcional de reapertura: (1) detener la modificación; (2) documentar el hallazgo; (3) indicar exactamente qué regla del dominio afecta; (4) explicar por qué constituye un defecto real; (5) determinar impacto; (6) proponer la corrección mínima necesaria; (7) solicitar aprobación explícita antes de modificar el dominio congelado.
- No se permite romper el freeze por: preferencias estéticas, comodidad del frontend, simplificación de componentes, reducción de código, cambios de nombres, preferencias personales del agente, similitud con un competidor, "me parece más intuitivo", o deseos de implementar una funcionalidad nueva.

## 19. Historial de versiones de este archivo

| Fecha                        | Cambio                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-13 (inicio etapa UX) | §18 nueva: freeze formal del dominio financiero (por decisión del fundador 2026-09-13, auditoría externa aprobó R15.3.2) + procedimiento excepcional de reapertura.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---                          | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-13                   | Versión inicial — consolidación de reglas vigentes (R1–R15.3.1) + reglas nuevas de R15.3.2 (regla fundamental de concurrencia, matriz de cuentas afectadas, Promise.all prohibido, dedupe de touch, idempotencia de deletes, sin fallbacks monetarios silenciosos). Pendiente de actualización al cierre de R15.3.2 con las reglas descubiertas durante la implementación.                                                                                                                                                                                                                                                                                         |
| 2026-09-13 (cierre R15.3.2)  | Reglas R15.3.2 F4/F5/F6/§26 incorporadas: touch como **última escritura** en los 11 use cases que mueven dinero (helper `touchAccounts`, dedupe + secuencial); **atomicidad consume+update** de tokens one-time (reset/verify con `uow.withTransaction`, puertos con `tx?`); **1 token activo por (user, purpose)** con índice partial unique + revoke-before-insert + retry E11000; **lockout por email** (5/60min → 30min desde el último fallo); prohibición de fallback de moneda reforzada (sale items/export-csv → `throw`); **write-skew §20** con pares concurrentes A–F (N=10–25). La fila previa ("pendiente de actualización") queda superada por esta. |

---

_Regla de mantenimiento: toda regla nueva establecida durante el desarrollo DEBE incorporarse a este archivo (ver encabezado). La fuente maestra es este archivo; los informes de auditoría son históricos._
