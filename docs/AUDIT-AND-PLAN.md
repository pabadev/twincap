# TWINCAP — PLAN DE IMPLEMENTACIÓN

> **Este documento es el plan maestro y documento de continuidad del proyecto.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` y este documento ANTES de empezar.**
>
> **Después de una compactación o en una nueva sesión, lo PRIMERO es leer este archivo.**
>
> Lineamientos de la ronda actual: sección `RONDA 14` de este archivo (plan vigente).

---

> ⚠️ **REGLA CRÍTICA (heredada de Ronda 2):** la ronda comienza con **AUDITORÍA**, no con implementación.
> Prohibido escribir código hasta presentar el plan definitivo por fases y recibir aprobación explícita del usuario.
> Cada fase se implementa SOLO con su aviso explícito (protocolo R3.13).

---

## ESTADO ACTUAL (última actualización: 2026-09-06)

| Ronda | Estado |
|-------|--------|
| Ronda 1 — fases 0–22 | ✅ Completa |
| Ronda 2 — Auditoría y mejoras | ✅ Completa (Fases 0–10 + post-ronda branding; detalle en git history del doc y `Ronda 2.md`) |
| Ronda 3 — Auditoría integral, corrección financiera, dashboard, evolución funcional | ✅ **COMPLETADA (2026-08-25).** 12 fases ejecutadas y verificadas. Auditoría final: 0 CRITICAL, 7 MINOR (no bloqueantes). Suite 412/412 tests en 42 archivos, tsc limpio. Fixes de usuario incluidos: sort por fecha, logout confirmation, placeholders "Seleccionar", transición theme suave, badge "Pagado" en créditos. |
| **Ronda 4 — Rediseño y evolución del Dashboard financiero** | ✅ **COMPLETADA (2026-08-26).** 6 fases (A→F). Dashboard rediseñado: jerarquía visual, tablas resumen ingresos/gastos por categoría, filtros composables, gráfico anual filtrado, movimientos responsive con columna Category. Suite 428/428, tsc, build limpios. Commits: `cd1bdd2`, `80dd92c`, `5dea992`, `10d6e0b`. |
| **Ronda 5 — Integridad financiera, créditos con cuotas, fix dashboard, onboarding** | ✅ **COMPLETADA (2026-08-28).** A ✅ `fd1a3d6` · B ✅ `154dac8` · C ✅ `0a68517` · D ✅ `e460b37` · E ✅ `a57c03b` (seed fija + onboarding) · **F ✅ `c5d198a` + `1396928`** (reparación legacy: 46 acciones aplicadas contra Atlas — 45 + relink post-QA; auditoría global con criterio de la app: 0 huérfanos, 0 ventas on-credit sin crédito, 0 transfers inválidas) · QA ✅ (suite 485/485, tsc, build). Commits previos de una ronda 5 anterior (no reemplazada): `c996ff1`, `3b073ea`, `b6dba3f`, `e523520`. |
| **Ronda 6 — Hallazgo post-R5: ventas eliminadas visibles** | ✅ **IMPLEMENTADA (2026-08-28).** Causa raíz estructural: lecturas de movimientos NO verificaban existencia del padre de `link.refId`; `deleteSale` no cubría movimientos con `refId` UUID legacy. **P1** filtro de lectura con reconciliación por valor (P1 v2), **P3** `deleteByRefId` (`deleteMany`), **P2** `deleteSale` cascada robusta por refId, **P4** tests, **P5** datos Atlas (1 relink de crédito vivo + 1 borrado de huérfano real). Suite **513/513**, tsc limpio. Detalle en sección R6. |
| **Ronda 7 — Raíz UUID↔ObjectId + cards infladas** | ✅ **COMPLETADA (2026-08-28).** R7-A dashboard deriva balances de movimientos filtrados P1; R7-B ids ObjectId persistidos como `_id`; R7-C 2 huérfanos de pruebas2 limpiados (idempotencia 0/0). Suite **517/517**, tsc, build. Detalle sección R7. |
| **Ronda 8 — Capital financiero fuera del resultado económico** | ✅ **COMPLETADA (2026-08-28).** `economic-result.ts` centraliza `NON_ECONOMIC_LINK_KINDS` (transfer, opening, creditReceivedPrincipal, creditGrantedPrincipal); card "Flujos de financiamiento" reemplaza "Patrimonio"; `financingInflow/Outflow`; currencyBreakdown filtrado. Suite **536/536**, tsc, build. Commits `f11c1b8`, `799aef8`, `dbd60e2`, `15f81cb`, `454f2fa`. |
| **Ronda 9 — Créditos otorgados: amortización capital/interés + baja incobrable · Fix cuentas con saldo inicial · Saldo inicial para cuenta existente** | ✅ **COMPLETADA (2026-08-30).** Regla del usuario: abonos de créditos otorgados amortizan primero el principal; solo el excedente es ingreso. Nueva acción "dar de baja crédito incobrable" registra gasto por capital no recuperado. **R9-H1:** cuentas creadas CON saldo inicial no se pueden eliminar (el movimiento `opening` propio bloquea el guard ACC-4). **R9-H2:** la cuenta fija "Efectivo" del seed no tiene opción para establecerle saldo inicial (solo `createAccount` al crear cuentas nuevas). Auditoría + plan en sección R9 (fases A–G). **Fase A COMPLETADA y DESPLEGADA (2026-08-29):** fix R9-H1 — commits `36998a1` + `64014dc`. **Fase B COMPLETADA (2026-08-29):** saldo inicial para cuenta existente (R9-H2) — commits `bc0d260` + `4fafa89`; suite **548/548**. **Fase C COMPLETADA y DESPLEGADA (2026-08-29):** dominio + kinds — suite **564/564**, tsc limpio; push `4757080`. **Fase D COMPLETADA (2026-08-29):** use cases granted (split en origen + edit/delete con 2 movimientos + write-off + action) — suite **586/586**, tsc limpio. **Fase E COMPLETADA (2026-08-29):** posición financiera (excluye writtenOff del activo en `computeActivosPasivos` + dashboard) — suite **589/589**, tsc limpio. **Fase F COMPLETADA (2026-08-30):** UI + i18n del write-off — botón `WriteOffButton` (danger + ConfirmDialog) → `writeOffCreditAction`; badge "Incobrable"; card castigada; ocultamiento de acciones (editar/abono/borrar) cuando writtenOff; filtro de estado "Incobrable" (writtenOff) excluido de Pendiente/Pagado; columnas Capital/Interés en detalle de abonos; i18n es/en (7 claves nuevas). Suite **589/589**, tsc limpio. **Fase G COMPLETADA (2026-08-30):** QA final — `pnpm build` exitoso, suite **589/589**, tsc limpio; docs cerradas (estado, bitácora, protocolo post-compactación); `AGENTS.md` actualizado (principio financiero 7: amortización capital primero + write-off). Push `68eb9c6`. **RONDA 9 COMPLETADA.** |
| **Ronda 10 — 5 solicitudes de producto del usuario** | ✅ **COMPLETADA (2026-08-30).** Auditoría completada (solicitudes 1–5 analizadas) y plan por fases (A–F) aprobado por el usuario. **Fase A ✅** `1a27cf0 fix(i18n)`: toasts de error de eliminación traducidos y descriptivos — `handle-action-error.ts` mapea 6 mensajes de borrado a claves `error.*` descriptivas, `entity-delete-button.tsx` usa `useT('error')` + strip del prefijo, +6 claves es/en, test nuevo (11 tests). **Fase B ✅** `728308f feat(dashboard)`: card "Flujos de financiamiento" muestra "Créditos recibidos" y "Créditos otorgados" en dos líneas (sin neto grande), solo UI + +2 claves i18n. **Fase C ✅** `7295f91 fix(transfers,dashboard)`: mensaje de fondos insuficientes de transferencias corregido y traducido (helper `use-action-error.ts`) + saldo de cuenta negativo en rojo. **Fase D ✅** `256c5e7 feat(validation)`: fechas futuras rechazadas en UI (`max` = hoy) y backend (movements, transfers, credits, payables, pos/sales) + claves i18n. **Fase E ✅** `d10c54b feat(sales)`: crear cliente y artículo desde Nueva venta — modales anidados con auto-selección; `createClientAction`/`createCatalogItemAction` devuelven snapshot serializado para que el form de venta seleccione la entidad creada; 2 tests nuevos por action. **Fase F ✅**: QA final — suite **614/614** (57 archivos), tsc y build limpios; docs cerradas (estado, bitácora). Push `5621616..fc5b03d` master → origin. **⚠️ DEPLOY FALLIDO según GitHub (reportado por el usuario 2026-08-30): la versión desplegada NO tenía la UI de Fase E (síntoma: modales de cliente/artículo ausentes).** Al momento de escribir, la causa del fallo no es visible desde el entorno local (repo privado, sin `gh` CLI, sin logs de CI en el repo — no hay `.github/workflows`, `vercel.json` ni `netlify.toml`; el push fue a `https://github.com/pabadev/twincap`). Re-despliegue pendiente tras la Ronda 11. |
| **Ronda 11 — Funcionalidades backend sin UI (4 casos) + re-deploy** | ✅ **IMPLEMENTADA (2026-08-30).** Auditoría previa: 4 funciones con backend listo pero sin UI. **Caso 1** editar cliente: `updateClientAction` ahora comparte envelope `ClientActionResult` con `createClientAction` (devuelve snapshot `client.toJSON()`), `client-form.tsx` con modo edición + botón lápiz en `clients-list.tsx` (modal `Clients.editTitle`), +3 tests. **Caso 2** renombrar cuenta: `updateAccountAction` + `rename-account-button.tsx` (modal con Input, `Accounts.renameTitle`), botón en `accounts/page.tsx` para todas las filas, revalida `/accounts /dashboard /movements /transfers`, +3 tests. **Caso 3** renombrar categoría: `updateCategoryAction` + `rename-category-button.tsx` (modal `Categories.editTitle`), botón en `categories/page.tsx`, revalida `/categories /movements`, +3 tests. **Caso 4** editar transferencia: `updateTransferAction` (usa case `updateTransfer`, sin tocar cuentas — TRA-5), `transfer-form.tsx` con modo edición (selects bloqueados, monedas inicializadas, `mirroredDest` para misma moneda, fecha vía `businessDateToInputValue`), botón lápiz en `transfers-list.tsx` (modal `Transfers.editTitle`), revalida `/transfers /accounts /dashboard /movements`, +3 tests. i18n es/en: +11 claves (renameTitle/editTitle/updating/updateClient/updateTransfer/transferUpdated). Suite **625/625** (59 archivos), tsc EXIT 0, build EXIT 0. Pendiente: commits por unidad, push y verificación de re-deploy. **Postscript (2026-08-30/31):** deploy de R11 OK, pero los modales anidados de Fase E no hacían submit — un `<form>` no puede contener otro `<form>` (los `Modal` de `ClientForm`/`CatalogForm` vivían dentro del form de la venta; el navegador ligaba sus controles al form padre). Fix `e3b31b6 fix(sales)`: ambos modales movidos fuera del árbol del form (hermanos), botones `type="button"` que los abren quedan dentro. Único archivo afectado (verificado por grep <form+<Modal). Suite 625/625, tsc, build. Push `6dd576c..e3b31b6`. |

| **Ronda 12 — Production & Commercial Hardening** | 🟢 **COMPLETADA (2026-09-02)** — **FASE A COMPLETADA (2026-08-31)**, **FASE B COMPLETADA (2026-08-31)**, **FASE C-1 COMPLETADA (2026-08-31)**, **FASE C-2 COMPLETADA (2026-08-31)**, **FASE C-3 COMPLETADA (2026-09-02)**, **FASE C-4 COMPLETADA (2026-09-02)** — basadas en la auditoría externa `docs/TwinCap - Evaluación 2 ChatGPT.md` (30/08/2026) provista por el usuario como base de diseño. Foco: seguridad, fundamentos de negocio, robustez, eficiencia y escalabilidad comercial — NO features nuevas. Fases A–C definidas en sección R12. **A1 rate limiting auth** y **A2 idempotencia client-provided** (suite 637/637; commits `4a2a3ac`, `0826855`, `a803902`). **B1 tenant isolation (38 tests) + B2 consistencia + `docs/CONSISTENCY-AUDIT.md` + fixes `deleteCreditReceived`/`deletePayable`/`updateClient`** (suite 677/677; commit `86c7a30`). **C1 dashboard eficiente**: agregación server-side reactiva — el cliente deja de recibir la lista completa de movimientos; recibe un snapshot agregado + últimos 5 (suite 690/690). **C2 observabilidad/audit trail**: `OperationLogger` (ports) + `OperationLog`/`MongoOperationLogger` (infra) + wrapper `withAudit` — 37 operaciones financieras críticas + auth instrumentadas; registro mínimo durable en Mongo sin PII; best-effort sin transacciones (mutación primero, log después, señal stderr). Suite **709/709**, tsc limpio. **Fix extra (fuera de C2, aprobado):** test `build-dashboard-snapshot.test.ts` era date-stale (fixtures fijos en ago-2026 → roto al pasar a sep-2026); ahora derive fechas del reloj real. **C3 E2E Playwright**: suite de 24 flujos críticos aditiva (zero src/), entregada como 4 PRs stacked-to-main mergeados a master. **C4 limpieza identidad `globalmoney` → TwinCap**: commit `fff19b3` (package.json + referencias obvias; docs de auditoría conservadas como evidencia de P10). Detalle sección R12 / bitácora 2026-08-31 y 2026-09-02. **RONDA 12 CERRADA.** |
| **Ronda 13 — Beta Readiness & Product Validation** | 🟡 **EN CURSO (2026-09-02)** — basada en la auditoría externa `docs/Auditoría Pre-Beta ChatGPT.md`. Foco: convertir el software en un servicio **operable, legalmente preparado y medible** para una beta cerrada con usuarios reales (10–20), y **preparar la base de multiusuario (Workspace + Membership)** sin activar aún la funcionalidad Teams visible. Incluye **cambio de regla explícito y justificado**: de tenant basado en `userId` a tenant basado en `workspaceId` (autorizado por el usuario; el single-user queda como caso degenerado de un workspace personal). NO implementa Teams/Billing/Compras (post-beta). Plan por fases A–H en sección R13. **FASE A COMPLETADA (2026-09-02): CI automática GitHub Actions** — `.github/workflows/ci.yml` (jobs `quality` typecheck+lint+vitest+build, y `e2e` Playwright serial) + **limpieza del lint del repo** (estaba roto: 86 problemas/55 errores → 0/0: refactor `idempotency-field` a lazy useState, `SortIcon` fuera del render, disables puntuales justificados en server-action/theme-hydration, tipado de `any` en tests, override `no-require-imports` para `.cjs`, limpieza de warnings). Suite **709/709**, `tsc --noEmit` EXIT 0, `lint` EXIT 0. **FASE B COMPLETADA (2026-09-02).** **FASE C COMPLETADA (2026-09-03)** — 4 páginas legales bilingües `/privacy`, `/terms`, `/cookies`, `/data-policy` + contenido `src/content/legal/` + enlaces desde landing/auth; suite **722/722**, tsc/lint/build EXIT 0; commit `71865eb`. **FASE D COMPLETADA (2026-09-03)** — error monitoring + alertas (commits `6bd9b77` + `22a933c`, suite **750/750**). **FASE E COMPLETADA (2026-09-03)** — feedback en producto + centro de ayuda `/help` (commit `507cf61` + push `682a016..507cf61` junto al commit de emails `2daf633`). **FASE F COMPLETADA (2026-09-03)** — Workspace foundation multiusuario estructural (el cambio de regla R13.2). **F1** dominio `Workspace` + `Membership` (commit `2d0a372`, +tests). **F2** auth: derive `workspaceId` en sesión + alta de Workspace/Membership(owner) al registrarse (commit `bd5e4e1`). **F3** migración de las 10+ entidades financieras de `userId` → `workspaceId` como frontera de aislamiento, preservando `userId` como actor (commit `1d599ce`). **F4** rework de la suite de tenant isolation a semántica workspace + compartición same-workspace (commit `6a0f156`, ~+296/−69). **F5** backfill: cada usuario existente recibe 1 Workspace personal (`_id` = su `userId`) + 1 Membership owner; renombra `userId`→`workspaceId` en las 10 colecciones financieras — idempotente, 3 tests (commit `ba36036`). **AGENTS.md** actualizado (R13.2.4): regla de tenant pasa a `workspaceId` con aislacion por Workspace, español neutro (commit `48cbe28`). Suite **791/791** (77 archivos), `tsc --noEmit` EXIT 0. **Ejecución de producción (Atlas, DB `globalmoney`):** deploy `8a31462` (Vercel OK) + migración ejecutada — 12 workspaces + 12 memberships(owner), 383 docs financieros renombrados `userId`→`workspaceId` (0 restantes), índice único de categorías recreado como `workspaceId_1_name_1_type_1`. ⚠️ En la primera corrida en producción se descubrió un defecto crítico NO cubierto por tests: el índice único `userId_1_name_1_type_1` de categorías rompía el `$rename` (E11000 por duplicados `userId:null` entre usuarios). Fix commiteado (`8974236`): se dropean los índices `userId`-led antes del rename y se recrea el constraint único scoped a `workspaceId`; +test de regresión E11000. Suite **791/791** (76 archivos), `tsc --noEmit` EXIT 0, deploy `8974236` OK. **FASE G COMPLETADA (2026-09-04): Analítica de producto** — evento `AnalyticsEvent` sin PII + puerto `AnalyticsReporter` + repo best-effort; eventos instrumentados en 6 server actions detrás del flag opt-in `ANALYTICS_ENABLED`; página `/analytics` con activation/retention/usage. Suite **801/801** (+10 tests), tsc/lint/build EXIT 0. **Ronda 13 EN CURSO — siguiente: Fase H (Beta QA, Definition of Beta y lanzamiento).** |
| **Ronda 14 — Confiabilidad financiera y cierre pre-beta** | 🟡 **EN CURSO (2026-09-06).** Basada en la auditoría externa `docs/audit_pre_ronda_14.md` (Auditoría 2.0). Foco: **confiabilidad financiera** (moneda, atomicidad, rate limiter real), hardening de auth/monitor/CI, corrección de analytics/dashboard y cierre de los bloqueos de beta (backup/restore real, smoke test, legal, aislamiento). Fase 0 (higiene documental: este archivo + histórico) **COMPLETADA**; Fase D (Next.js 16.3.4) **COMPLETADA (2026-09-06)** — suite 919/919, tsc/lint/build EXIT 0. Plan completo por fases 0 + A–O en sección R14. **ESPERANDO APROBACIÓN para la siguiente fase (E — configuración de producción) (protocolo R3.13).** |

## PENDIENTES OPERATIVOS HEREDADOS (cerrados en R13, pendientes de ejecución/operación)

1. **R13-H1 — Checklist de aislamiento en producción**: `docs/beta-qa-isolation-checklist.md` sin ejecutar por el fundador (requiere 2 cuentas). → Ronda 14, Fase O.
2. **R13-G/hardening — Analytics**: activar `ANALYTICS_ENABLED=true` y setear `ANALYTICS_EXCLUDE_EMAILS=fjpaba1989@gmail.com` en Vercel cuando se quiera empezar a medir (decisión del fundador).
3. **R13-H2 — Definition of Beta**: Grupo B con Backup/restore (P0-c) y smoke test (P0-b) abiertos. → Ronda 14, Fases J/O.
4. **R13-C — Legal**: placeholders `[RAZÓN SOCIAL]`, `[NIT]`, `[DIRECCIÓN]`, `[CORREO DE CONTACTO]`, `[CIUDAD/PAÍS]` por reemplazar; revisión con abogado antes de beta comercial. → Ronda 14, Fase O.
5. **Segunda oleada — Backburner**: "leyenda de SOL", ajustes igl/insight y hoja de ruta futura siguen en pausa deliberada (decisión del usuario 2026-09-04). La herramienta prettier está instalada como devDependency pero NO se aplicó formateo masivo (estado medido, sin `--write`).

## REGLAS INQUEBRANTABLES (heredadas de R4.3)

### De Ronda 3 / AGENTS.md (todas vigentes)
- Arquitectura hexagonal intacta
- `connectDb()` antes de repositories
- Multi-tenancy verificado en backend
- i18n es/en paridad, español neutro
- Principios financieros (transferencia ≠ ingreso/gasto, saldo ≠ resultado, etc.)
- Máximo UNA dependencia nueva por fase (justificada)
- Sin hook GGA
- Fechas: sin offsets ±1 día sin causa raíz
- pnpm exclusivo
- Sin window.location.reload()

### Nuevas de R4 (del documento fuente)
- **No volver a introducir `Account.scope`** — Movement.context es la fuente de Personal/Negocio (decisión D3-bis de R3)
- **No cambiar la semántica de Activos/Pasivos** — independientes de filtros de actividad (estado R3)
- **No inventar columnas** en las tablas de resumen: 4 columnas máximo, justificadas por utilidad
- **No mostrar todos los reportes simultáneamente** — menú de acceso, no listado completo
- **No convertir monedas** — agrupar por moneda de forma honesta
- **No contar transferencias como ingreso/gasto** — conservar exclusión de F1
- **Conservar saludo, filtros, Activos/Pasivos, evolución anual, cards, balances, dark mode, i18n, responsive, loading/empty/error states, accesibilidad, navegación, seguridad**


> **Protocolo R3.13 (resumen):** cada fase comienza con auditoría (nunca código), se presenta el plan definitivo por fases para aprobación explícita del usuario, y cada fase se implementa SOLO con su aviso explícito. Detalle completo en `docs/AUDIT-AND-PLAN-HISTORY.md` (sección Ronda 3, R3.13).

---

# RONDA 14 — CONFIABILIDAD FINANCIERA Y CIERRE PRE-BETA

Iniciada: 2026-09-06 · Fuente base de diseño: **auditoría externa** `docs/audit_pre_ronda_14.md` (Auditoría 2.0, provista por el usuario como insumo posterior al cierre de R13). `AUDIT-AND-PLAN.md` sigue siendo el plan maestro; la auditoría aporta los hallazgos priorizados que esta ronda implementa.

## R14.1 — Contexto y objetivo

La Auditoría 2.0 cambia ligeramente el diagnóstico respecto a la conclusión optimista post-R13: no falta funcionalidad, falta **confiabilidad**. Su veredicto (§26): beta privada de 2–3 usuarios técnicos 🟠 **sí, con supervisión intensa**; beta privada de 10–20 usuarios 🔴 **todavía no**; beta pública 🔴 **no**; SaaS comercial 🔴 **no**. El diagrama de madurez (§27) lo resume: Auth 🟢, QA 🟢, SaaS 🟠, Tenant 🟢, Observabilidad 🟢, **Integridad financiera 🔴**.

Directiva del usuario (2026-09-06): planificar la Ronda 14 atendiendo **todos** los hallazgos — soluciones de fondo para los críticos y sin dejar ninguno afuera, incluidos los menores — dividida en suficientes fases para un alcance grande y complejo, respetando las reglas del proyecto.

La auditoría confirma además una lección de testing (§24): **849 tests no equivalen a 849 garantías**. Encontró un defecto real invisible para la suite: `link.saleId` definido en el dominio (R13 F4) pero **ni persiste ni reconstruye** `src/infrastructure/mappers/movement.ts`. La razón: la suite prueba `use case → fake repository`, no `domain → mapper → mongoose → mapper → domain`. La próxima capa de testing debe concentrarse en **persistencia real + invariantes + fallos parciales + entradas hostiles** (§25).

## R14.2 — Auditoría de verificación (2026-09-06, solo lectura)

> **Nota de vigencia:** la Auditoría 2.0 se elaboró sobre un ZIP del repositorio; sus números de suite/fechas pueden no coincidir con `master`. La verificación de esta sección se hizo contra `master` al 2026-09-06 (post-Fase 10 de la segunda oleada: suite **919/919** en 87 archivos, `tsc --noEmit` EXIT 0, `lint` EXIT 0, `build` EXIT 0; último commit pusheado `11366a7`).

Todos los hallazgos se contrastaron contra `master` con evidencia `file:line`. Resultado: **todos reales** (ninguno inventado ni obsoleto).

| ID | Hallazgo (auditoría §) | Veredicto en master (evidencia) | Fase |
|---|---|---|---|
| §3 | El backend no protege realmente la moneda de la cuenta | ✅ REAL — el repo de movimientos reconstruye la moneda desde la cuenta viva al leer (`movement-repository.test.ts:133`); el catálogo NO almacena `currency` (reconstrucción vía `resolveAccountCurrency` en `catalog-repository.ts`); `create-transfer.ts` acepta cross-currency validando solo la forma (source ≠ destination; D3 resuelve cuentas) | A |
| §4 | Operaciones financieras no atómicas | ✅ REAL — operaciones multi-documento sin transacción (inventario documentado en `docs/CONSISTENCY-AUDIT.md`) | B |
| §5 | Rate limiting de auth no usa la IP real | ✅ REAL — `(auth)/actions.ts:78` lee `formData.get('_ip') || 'unknown'`; claves `register:${ip}`; `rate-limiter.ts` NO atómico (`findOne` → `attempts++/save` → `create`) | C |
| §6 | `/api/monitor` puede abusarse | ✅ REAL — validación zod estricta (message≤500, name≤100, stack≤4000) pero **sin** rate limit ni throttle por fingerprint | G |
| §7 | El dashboard "eficiente" carga todos los movimientos en backend | ✅ REAL — `build-dashboard-snapshot.ts` agrega sobre el set completo por ventana | I |
| §8 | Activation no representa lo que promete | ✅ REAL — solo eventos "first" deduplicados (`firstLogin`/`firstMovement`); sin evento regular por movimiento | H |
| §9 | Analytics viola la regla explícita de i18n | ✅ REAL — `src/app/(main)/analytics/page.tsx` hardcodea "Analytics Dashboard", "Product metrics…", "Registered", "Logged In", "First Movements" | H |
| §10 | Email de producción puede apuntar a localhost | ✅ REAL — `env.ts`: `RESEND_API_KEY`/`RESEND_FROM`/`APP_BASE_URL` opcionales; `auth-email-deps.ts:25` → `baseUrl: env.APP_BASE_URL ?? 'http://localhost:3000'` | E |
| §11 | Feedback puede decir "enviado" sin enviarse | ✅ REAL — `feedback-alerter.ts` (patrón fail-safe de `error-alerter`) nunca lanza; `submitFeedbackAction` responde ok aunque el transporte falle; sin persistencia | L |
| §12 | Tokens one-time con ventana de concurrencia | ✅ REAL — `auth-token-repository.ts` `markUsed` vía `updateMany`; la ventana real es el hueco find→use del use case | F |
| §13 | Cambiar la contraseña no invalida sesiones anteriores | ✅ REAL — sin `sessionVersion` en usuario/sesión | F |
| §14 | Pequeñas violaciones de las reglas de arquitectura | ✅ REAL — `register.ts:7` importa `../../../infrastructure/seeding/user-bootstrap`; `logout.ts:1` importa `../../../infrastructure/auth/session-cookie`; `build-dashboard-snapshot.ts:1–3` importa tipos de `../../../components/dashboard/*` | K |
| §15 | `findByIdRaw()` rompe parcialmente la pureza del aislamiento | ✅ REAL — `src/core/domain/repositories.ts:97` (Transfer) + `transfer-repository.ts:68` (ignora `workspaceId`) | K |
| §16 | Dependencias: actualizar Next.js antes de beta | ✅ REAL — `next 16.3.1` + `eslint-config-next 16.3.1` (CVEs corregidos en 16.3.4) | D |
| §17 | CI tiene dos detalles que corregir | ✅ REAL — `.github/workflows/ci.yml` dispara en `[main]` (repo usa `master`); usa `npx playwright install` (viola pnpm-exclusivo) | J |
| §18 | Backup/restore sigue siendo un bloqueo real | ✅ REAL — Atlas M0 sin backups automáticos; sin restore probado (P0-c de Definition of Beta sigue abierto) | O |
| §19 | Checklist manual de aislamiento sigue obligatorio | ✅ REAL — `docs/beta-qa-isolation-checklist.md` existe sin ejecutar por el fundador | O |
| §20 | Legal existe pero no está listo para producción | ✅ REAL — páginas con placeholders `[RAZÓN SOCIAL]`, `[NIT]`, `[DIRECCIÓN]`, `[CORREO DE CONTACTO]`, `[CIUDAD/PAÍS]`; revisión con abogado pendiente | O |
| §21 | Inconsistencia de branding residual | ✅ REAL — `session-cookie.ts:4` `COOKIE_NAME = "gm_session"`; las páginas legales la nombran; residuos `gm_*` | M |
| §24 | Defecto invisible para los tests: `link.saleId` no se persiste ni reconstruye | ✅ REAL — `src/infrastructure/mappers/movement.ts` escribe/lee solo `kind/refId/opId`; `saleId` (agregado a dominio + schema en R13-F4) se pierde en el round-trip | N |

Verificados como reales además: el acceso a `/analytics` restringido por política `AnalyticsAuthorizer` (R13-G hardening) y la **exclusión del owner pendiente en Vercel** (`ANALYTICS_EXCLUDE_EMAILS=fjpaba1989@gmail.com`); `'Unauthorized'` queda SOLO en `handle-action-error.ts` (Fase 8 segunda oleada); rate limiters también presentes en profile (`password:${userId}`, `resendVerify:${userId}`).

## R14.3 — Plan por fases (PROPUESTA — Fase 0 APROBADA y ejecutada; el resto REQUIERE APROBACIÓN)

Siguiendo el protocolo R3.13: auditoría → plan → aprobación → fase → tests → docs → detenerse. Cada fase se implementa SOLO con aviso explícito del usuario.

| Fase | Contenido | Hallazgos | Dependencias |
|------|-----------|-----------|:---:|
| **0 — Higiene documental** | ✅ **APROBADA Y EJECUTADA (2026-09-06).** Rondas 1–13 + bitácora archivadas en `docs/AUDIT-AND-PLAN-HISTORY.md` (testimonio verbatim). Maestro compactado: ESTADO ACTUAL (R1–R13 + R14), pendientes operativos heredados, reglas inquebrantables (R4.3), plan R14, protocolo post-compactación. | — | — |
| **A — Integridad de moneda** | Validación backend: toda operación monetaria valida `currency` contra la cuenta (movements, credits, payables, transfers, opening balance). **Catálogo persiste `currency`** (hoy se reconstruye desde la cuenta). Venta POS valida las 3 monedas (artículo de catálogo vs cuenta de cobro vs venta). Créditos/payables con moneda inmutable (rechazar edición que la cambie). Transferencia cross-currency: validación estricta (cuentas origen/destino + rate explícito; sin inventar FX — regla R3.14). Tests adversariales de moneda (estrategia §25-A: COP account + USD movement → reject, etc.). | §3 | 0 |
| **B — Atomicidad financiera** | Operaciones multi-documento críticas con atomicidad: transfer, sale, crédito otorgado/recibido, abono, deleteSale (riesgo de doble-restore), opening balance, delete cascades. Revisar inventario `docs/CONSISTENCY-AUDIT.md`. Tests de fallo parcial (estrategia §25-B: falla en 2º documento → sin corrupción financiera). **Decisión de infraestructura requerida (ver R14.6).** | §4 | 0, C (tests concurrentes para verificar) |
| **C — Rate limiter real** | IP real desde `headers()` (`x-forwarded-for`/`x-real-ip`) en lugar de `formData.get('_ip')` (`(auth)/actions.ts:78`). Atomicidad del limiter: `findOneAndUpdate` con `$inc` + upsert + índice único sobre la clave (reemplaza `findOne` → `attempts++/save` → `create`). Aplicar a auth (register/login/forgot), profile (password/resendVerify) y monitor. Tests concurrentes (estrategia §25-C: mismo rate-limit key). | §5 | 0 |
| **D — Next.js 16.3.4** | ✅ **COMPLETADA (2026-09-06).** `next` + `eslint-config-next` 16.3.1 → 16.3.4. CVEs cubiertos (security release 2026-08-25, 16.3.3 + follow-up 16.3.4): GHSA-p293-qw3h-jr36 / CVE-2026-75604 — RCE sin autenticar por path traversal en servidores Windows (crítico); GHSA-2xp9-vwfh-vxw4 — RCE sin autenticar en Image Optimization con AVIF (crítico, libheif via sharp; AVIF re-habilitado en 16.3.4 con upstream fix). Suite **919/919** (87 archivos), `tsc --noEmit` EXIT 0, `lint` EXIT 0, `build` EXIT 0. | §16 | 0 |
| **E — Configuración de producción** | En `env.ts`: hacer obligatorias en producción `MONGODB_URI`, `AUTH_SECRET`, `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM` (hoy opcionales; `auth-email-deps.ts:25` cae a localhost). `.env.example` documentado. | §10 | D |
| **F — Auth hardening** | Consumo atómico de tokens one-time: `markUsed` condicional (updateMany "unused + unexpired" y verificación de `modifiedCount` como prueba de consumo). Invalidación de sesiones tras password change/reset: `sessionVersion` en el usuario, sesión porta la versión. Tests concurrentes del mismo token (estrategia §25-C). | §12, §13 | E |
| **G — Protección `/api/monitor`** | Rate limit por IP + fingerprint, global cooldown, throttle de alertas por fingerprint (los payload caps ya existen vía zod). Un abuso no genera spam de alertas. | §6 | C |
| **H — Corrección de analytics** | Evento regular `movementCreated` (hoy solo `firstMovement` dedup → activation no mide el patrón real); activation definida con datos reales (≥3 movimientos en 2 días, ya computada). Página `/analytics` 100 % i18n es/en (hoy strings hardcodeados). | §8, §9 | 0 |
| **I — Dashboard: límites de carga** | `build-dashboard-snapshot.ts` agrega sobre el set completo por ventana; pasar a lectura por ventana (mes/6/12) con límite real + índices compuestos. **No** replicar la lógica de orphans/context/multi-moneda en `$group` (riesgo de divergencia silenciosa); usar ventanas + funciones puras existentes. Cifras idénticas a la suite actual. | §7 | A (depende de la integridad de moneda para no esconder datos) |
| **J — CI/devops** | `ci.yml`: trigger en `master` (hoy `main`); `pnpm exec playwright install --with-deps chromium` (hoy `npx`). Documentar GitHub branch protection requerida en el plan de lanzamiento. Smoke test post-deploy (P0.7) documentado y con checklist en `docs/beta-launch-plan.md`. | §17, P0.7 | D |
| **K — Arquitectura: violaciones puntuales** | Puertos para romper imports infra/component desde core: `register.ts:7` → puerto `WorkspaceBootstrapper`; `logout.ts:1` → `SessionManager`; `build-dashboard-snapshot.ts:1–3` → tipos movidos a core. Encapsular `findByIdRaw` (contrato `repositories.ts:97`, impl `transfer-repository.ts:68`) con acceso scoped por `workspaceId`. Sin reestructurar capas. | §14, §15 | 0 |
| **L — Feedback persistente** | Modelo `Feedback` + repo (estados delivered/failed); `submitFeedbackAction` reporta envío real; el alerter conserva el transporte pero el resultado distingue "enviado" de "falló". | §11 | 0 |
| **M — Cookie rename `gm_session` → `twincap_session`** | `session-cookie.ts:4` + páginas legales que la nombran + tests/e2e. Efecto: una invalidación única de sesiones activas (aceptable pre-beta). Residuos `gm_*` revisados. | §21 | F (misma zona de sesión) |
| **N — Mapper round-trip + capa de testing (§25)** | Fix `src/infrastructure/mappers/movement.ts`: persistir/reconstruir `link.saleId`. **Estrategia de testing §25 completa**: A currency adversarial, B partial failure, C concurrent requests, D mapper round-trip (domain → mongo → domain con igualdad semántica), E producción-like (staging; mojón a futuro). | §24, §25 | A, C (bases para A/C); D añade `movement-mapper.roundtrip.test.ts` |
| **O — Backup/restore real + cierre de beta** | Backup + restore **REAL probado contra Atlas** (P0-c), no documental. Checklist de aislamiento (§19) ampliado y **ejecutado por el fundador**. Placeholders legales (§20) resueltos o decisión explícita para beta cerrada controlada. Smoke test post-deploy ejecutado. Actualizar `docs/definition-of-beta.md` (Grupo B) al cerrar P0-c y P0-b/smoke. | §18, §19, §20, P0.6, P0.7 | J, N |

## R14.4 — Orden de ejecución y dependencias

```
0 → D → E → (A, B, C) → F → G → (H, I) → J → N → (K, L, M) → O
```

- **0** primero (archivo histórico + maestro compacto; base de todo).
- **D** y **E** primeras entre las técnicas: upgrade rápido + configuración de producción; desbloquean CI (J) y email (F/O).
- **A/B/C** (moneda, atomicidad, rate limiter) independientes entre sí; B requiere la decisión de infraestructura de R14.6.
- **F** y **G** hardening (sesión + monitor) después del rate limiter real (C).
- **H/I** corrección de producto con la integridad de moneda ya cerrada (A).
- **N** después de A/C: valida la capa de persistencia con tests adversariales antes de tocar atomicidad.
- **K/L/M** limpieza estructural sin urgencia de orden interno.
- **O** cierra: requiere la mayoría de las anteriores para declarar la beta lista.

## R14.5 — Criterios de éxito

1. **0**: maestro compacto con estado + reglas R4.3 + plan R14 + protocolo; histórico testimonial con rondas 1–13 y bitácora; **0 contenido perdido** (todo encabezado del original existe en uno de los dos archivos).
2. **A**: nada con moneda ≠ moneda de la cuenta persiste ni se lee; catálogo almacena `currency`; venta valida catálogo/cuenta/venta; créditos/payables con moneda inmutable; tests adversariales de moneda (§25-A) en verde.
3. **B**: operaciones críticas multi-doc con atomicidad real (transacción sobre replica set o compensación probada); tests de fallo parcial (§25-B) sin corrupción; suite previa verde.
4. **C**: IP real en rate limiter; operación atómica con índice único; tests concurrentes (§25-C); auth + profile + monitor cubiertos.
5. **D**: ✅ `next` + `eslint-config-next` 16.3.4 instalados; suite **919/919**, `tsc --noEmit` EXIT 0, `lint` EXIT 0, `build` EXIT 0. CVEs de agosto 2026 cubiertos (GHSA-p293-qw3h-jr36 Windows RCE, GHSA-2xp9-vwfh-vxw4 AVIF RCE).
6. **E**: `env.ts` exige las 5 variables en producción; `.env.example` documentado; fallback localhost imposible en prod.
7. **F**: un token solo se consume una vez bajo concurrencia; password change/reset invalida sesiones previas.
8. **G**: `/api/monitor` con rate limit + cooldown; un abuso no genera spam de alertas.
9. **H**: activation con evento regular de movimientos; página `/analytics` 100 % i18n es/en (paridad).
10. **I**: snapshot del dashboard lee por ventana con límite real; cifras idénticas a la suite existente (sin divergencia silenciosa).
11. **J**: CI corre en `master`; `pnpm exec playwright`; branch protection documentada; smoke test post-deploy documentado.
12. **K**: register/logout/build-dashboard-snapshot sin imports infra/component en core; `findByIdRaw` encapsulado y scoped.
13. **L**: feedback persiste con estado delivered/failed; un envío fallido no dice "enviado".
14. **M**: cookie `twincap_session`; páginas legales actualizadas; suite e2e verde.
15. **N**: `movement.ts` persiste/reconstruye `saleId`; tests §25-A/B/C/D/E implementados (E como mojón o staging).
16. **O**: backup+restore REAL probado contra Atlas; checklist de aislamiento ejecutado (Pass/Fail documentado); placeholders legales resueltos o decisión explícita; Definition of Beta sin gaps P0; smoke test ejecutado tras deploy.

## R14.6 — Restricciones

- **NO** features nuevas de producto (los cambios de analytics/dashboard son correcciones de exactitud, no features).
- **NO** Teams activo, **NO** Billing, **NO** Compras (reglas heredadas e inquebrantables).
- **NO** reescribir la arquitectura hexagonal (punto fuerte); K corrige violaciones puntuales creando puertos, no reestructurando capas.
- **NO** replicar la lógica de orphans/context/multi-moneda en agregaciones Mongo `$group` (R12-C1, riesgo de divergencia silenciosa de cifras).
- **NO** scripting/transformación de monedas inventada: toda transferencia cross-currency exige rate explícito (R3.14).
- Máximo **UNA dependencia nueva por fase**, documentada y justificada.
- Cada fase se implementa SOLO con aviso explícito (protocolo R3.13): auditoría → plan → aprobación → fase → tests → docs → detenerse.
- pnpm exclusivo (`pnpm exec playwright …`, nunca `npx`); commits convencionales sin Co-Authored-By; sin hook GGA; español neutro; i18n es/en paridad.
- La suite debe permanecer verde por fase: `pnpm test` + `tsc --noEmit`; `lint` y `build` EXIT 0.
- **Decisión pendiente (Fase B):** la atomicidad multi-documento real requiere transacciones sobre **replica set**; Atlas free tier M0 es standalone (sin transacciones). Al llegar a B, presentar al usuario las opciones: (a) patrón compensación/saga apoyado en la idempotencia existente (sin nueva infraestructura), (b) ascender a cluster M2+ con transacciones (costo mensual), (c) riesgo residual documentado. **Sin decisión explícita NO se implementa B.**

## R14.7 — Qué se hace y qué NO en esta ronda (resumen)

**SÍ:** integridad de moneda (A), atomicidad (B), rate limiter real (C), upgrade Next (D), configuración de producción (E), auth hardening (F), protección monitor (G), analytics correcta (H), dashboard limitado (I), CI correcta (J), puertos de arquitectura (K), feedback persistente (L), cookie rename (M), mapper round-trip + capa de testing §25 (N), backup/restore real + cierre de Definition of Beta (O).

**NO:** features nuevas; Teams/Billing/Compras; Mongoose 9; security headers avanzados; métricas sofisticadas/analytics completos; optimización avanzada (P2 de la auditoría); app móvil; factura electrónica; IA/BI.

---

## PROTOCOLO POST-COMPACTACIÓN

Si el contexto se compacta o inicia nueva sesión:

1. **Leer este archivo** (`docs/AUDIT-AND-PLAN.md`) y **`AGENTS.md`**.
2. **Buscar en Engram:** `mem_search(query: "TwinCap", project: "twincap")`.
3. **Identificar el estado actual** — Rondas 1–13 cerradas (resumen en la tabla ESTADO ACTUAL; detalle y bitácora testimoniales en `docs/AUDIT-AND-PLAN-HISTORY.md`). **Ronda 14 EN CURSO (2026-09-06):** Fase 0 completada (archivo histórico + maestro compacto + plan R14 aprobado). Orden de ejecución de fases en R14.4; criterios de éxito en R14.5.
4. **Esperar aviso del usuario para implementar la siguiente fase.**