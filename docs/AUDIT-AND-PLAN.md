# TWINCAP — PLAN DE IMPLEMENTACIÓN

> **Este documento es el plan maestro y documento de continuidad del proyecto.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` y este documento ANTES de empezar.**
>
> **Después de una compactación o en una nueva sesión, lo PRIMERO es leer este archivo.**
>
> Lineamientos de la ronda actual: `Ronda4.md` (raíz del repositorio) — documento de requerimientos, NO archivo de estado.

---

## ESTADO ACTUAL (última actualización: 2026-08-29)

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
| **Ronda 9 — Créditos otorgados: amortización capital/interés + baja incobrable · Fix cuentas con saldo inicial · Saldo inicial para cuenta existente** | 🟡 **EN CURSO (2026-08-29; APROBADO por el usuario).** Regla del usuario: abonos de créditos otorgados amortizan primero el principal; solo el excedente es ingreso. Nueva acción "dar de baja crédito incobrable" registra gasto por capital no recuperado. **R9-H1:** cuentas creadas CON saldo inicial no se pueden eliminar (el movimiento `opening` propio bloquea el guard ACC-4). **R9-H2:** la cuenta fija "Efectivo" del seed no tiene opción para establecerle saldo inicial (solo `createAccount` al crear cuentas nuevas). Auditoría + plan en sección R9 (fases A–G). **Fase A COMPLETADA y DESPLEGADA (2026-08-29):** fix R9-H1 — commits `36998a1` + `64014dc`. **Fase B COMPLETADA (2026-08-29):** saldo inicial para cuenta existente (R9-H2) — commits `bc0d260` + `4fafa89`; suite **548/548**. **Fase C COMPLETADA y DESPLEGADA (2026-08-29):** dominio + kinds — suite **564/564**, tsc limpio; push `4757080`. **Fase D COMPLETADA (2026-08-29):** use cases granted (split en origen + edit/delete con 2 movimientos + write-off + action) — suite **586/586**, tsc limpio. **Fase E COMPLETADA (2026-08-29):** posición financiera (excluye writtenOff del activo en `computeActivosPasivos` + dashboard) — suite **589/589**, tsc limpio. **Siguiente: Fase F (UI + i18n).** |

> ⚠️ **REGLA CRÍTICA (heredada de Ronda 2):** la ronda comienza con **AUDITORÍA**, no con implementación.
> Prohibido escribir código hasta presentar el plan definitivo por fases y recibir aprobación explícita del usuario.
> Cada fase se implementa SOLO con su aviso explícito (protocolo R3.13).

---

## RONDAS ANTERIORES — RESUMEN HISTÓRICO

### Ronda 1 (cerrada 2026-08-20)

22 fases: design system + componentes UI base, refactor formularios, empty/loading/error states, dashboard base, módulo Clientes, sistema toast, testing (273 tests), manejo centralizado de errores, responsive, PWA base, performance, filtros movimientos, POS (cliente general, búsqueda), edición de abonos, formularios en modales, acciones icon-only, selector de idioma, logo TwinCap, landing pública, auth redirect, búsqueda clientes. Última fase: `4fb98b6`. Detalle completo en git history.

### Ronda 2 (cerrada 2026-08-23)

Auditoría Fase 0 (causas raíz H1–H20 verificadas + 13 hallazgos adicionales P1–P13) y 10 fases implementadas:

| Fase | Contenido | Commit |
|------|-----------|--------|
| 1 | Serialización `toJSON()` (reemplazó `structuredClone`) + i18n crítico | `72f9814` |
| 2 | Fundaciones UI: tokens oklch → utilidades, alturas h-10, Modal sm/md/lg, ActionIconButton, ConfirmDialog/EntityDeleteButton | `1a79b95` |
| 3 | Layout: sidebar viewport-lock desktop, drawer accesible, navegación directa, loading skeletons | `73d2d7d` |
| 4 | Tablas w-full + acciones icon-only + monto único en transferencias | `51a3a3f` |
| 5 | Movimientos: compuerta eliminada, form compacto 2 col, FAB global ingreso/gasto (+fixes `09a7c23`, `1c536d2`) | `a0e912c` |
| 6 | Créditos: edición principal + borrado de abonos ×2 | `6d720ca` |
| 7 | POS: venta a crédito → crédito vinculado neto + pago inicial + detalle completo de venta | `5473ede` |
| 8 | Payables: módulo cuentas por pagar (Alternativa A espejo CreditReceived) | `1cf77d4` |
| 9 | Paleta semántica única vía tokens oklch (155 usos → 0) | `e101adc` |
| 10 | Estabilización: contrato findById ×10 repos, dead code, JWT con claim email | `6673e44` |

Post-ronda: rebranding PWA (íconos PNG desde pack blanco + 44 splash iOS vía scripts sharp, `25e1a57`); logo in-app PNG oficial `isotipo-twincap.png` + wordmark Sora bicolor (`750d56c`, `911dd6b`). **Pendiente heredado:** regenerar TODOS los íconos PWA desde `isotipo_twincap_ok.png` transparente (decisión del usuario 2026-08-24) → absorbido por F11.

Estado técnico al cierre: 342/342 tests (34 archivos), lint 0/0, tsc ✅, build ✅.

---

# RONDA 3 — AUDITORÍA INTEGRAL, CORRECCIÓN FINANCIERA Y EVOLUCIÓN FUNCIONAL

Iniciada: 2026-08-24 · Fuente autoritativa: `TwinCap Ronda 3.md`

## R3.1 — Contexto y objetivos

Objetivos de la ronda (del documento fuente): **A)** corrección financiera (fechas, ingresos/gastos, transferencias, créditos, ventas, abonos, payables, balances, dashboard); **B)** UX/UI y consistencia móvil+desktop; **C)** dashboard financiero potente; **D)** evolución funcional con criterio; **E)** preparación comercial.

Restricciones permanentes reconfirmadas: cada usuario administra exclusivamente sus datos; NO introducir equipos/colaboradores/roles salvo auditoría que lo demuestre indispensable y aprobación previa; NO crear módulo Compras automáticamente; no reescribir TwinCap.

## R3.2 — Flujo obligatorio de la ronda

```
LEER CONTEXTO → INSPECCIONAR → AUDITAR → ANALIZAR → DEPENDENCIAS → PRIORIZAR
→ DOCUMENTAR (este archivo) → PRESENTAR PLAN → ESPERAR APROBACIÓN
→ IMPLEMENTAR FASE → PROBAR → DOCUMENTAR → DETENERSE
```

Prohibido durante la auditoría: escribir código, fixes "aprovechando que ya estamos ahí", modificar archivos para probar hipótesis. Problemas nuevos descubiertos se documentan (R3.6) sin corregirlos todavía.

## R3.3 — Reglas inquebrantables

Stack fijo (no migrar/sustituir): Next.js 16 · React 19 · TypeScript strict · Tailwind CSS 4 · MongoDB Atlas · Mongoose 8 · Jose · bcryptjs · Zod · Vitest · pnpm · Lucide React. Arquitectura hexagonal intacta. `connectDb()` antes de repositories. Multi-tenancy verificado en backend. i18n es/en paridad, español neutro, textos automáticos localizables (ver reglas nuevas en AGENTS.md). Principios financieros §7 del documento fuente (ya consignados como regla permanente en AGENTS.md). Máximo UNA dependencia nueva por fase con justificación. Testing por fase (`pnpm test` + lint + build/tsc). Sin hook GGA. Fechas: PROHIBIDO compensar con ±1 día sin entender causa raíz.

## R3.4 — Auditoría Fase 0 (2026-08-24) — método y salud general

Método: 6 exploraciones paralelas de solo lectura sobre el código real (fechas+serialización temporal · dominio financiero/dashboard/agregaciones · i18n/notas automáticas/formato monetario/español · UI consistencia/branding/filtros · auth/temas/PWA · invalidación/perfil/transversal). Sin modificaciones.

Salud general verificada:

- `connectDb()` 100% en actions/pages/layouts que tocan DB; cero repositories a nivel de módulo ✓
- Cero violaciones de capas (ningún componente importa infrastructure/application) ✓
- Tenant isolation consistente en spot-checks (delete account/category, abonos crédito/payable, ventas) ✓
- Frontera server→client limpia: todas las páginas serializan vía `toJSON()`; cero `structuredClone` remanente ✓
- Cero TODO/FIXME/HACK en src ✓
- 342/342 tests en 34 archivos ✓

## R3.5 — Matriz de hallazgos verificados

> **Todos los hallazgos HR3-01 a HR3-23 fueron resueltos en las Fases 1–12 de Ronda 3.**
> Solo permanecen como roadmap los items HR3-24 (Compras), HR3-25 (features comerciales) y HR3-26 (blog).

| ID | Requisito | Estado | Fase |
|----|-----------|--------|:---:|
| HR3-24 | 5.11 Módulo Compras | Payable ya cubre obligaciones. Compras completa requiere proveedores/inventario/costos. Decisión D8: Evolucionar Payable → Compras posteriormente | roadmap |
| HR3-25 | 5.25 Features comerciales | Export CSV, comparación mes vs mes, presupuestos, flujo de caja. Ver R3.11 | roadmap |
| HR3-26 | 5.26 Blog interno | Registrado. Ver R3.15 | roadmap |

## R3.6 — Hallazgos adicionales (resueltos en R3 + R4)

> **Todos los hallazgos A1–A16 fueron resueltos en Rondas 3 y 4.**
> Los items A1 y A2 del Dashboard (performance y multi-moneda) persisten como deuda técnica — ver sección R4.

## R3.7 — Decisiones de dominio (todas aprobadas y ejecutadas en R3)

> **D1–D8 fueron aprobadas por el usuario y ejecutadas en las Fases 1–12 de Ronda 3.**
> D3 fue revertida a D3-bis (Movement.context como fuente de verdad, no Account.scope) tras reporte del usuario sobre cuentas compartidas.

## R3.8 — Matriz de filtros propuesta (post-D3)

Ámbito P/N aplica vía cuenta (fuente de verdad = Account.scope). Sin imponer ámbito donde no aporta valor.

| Tabla | Ámbito | Fecha/rango | Categoría | Tipo | Estado | Búsqueda |
|-------|:---:|:---:|:---:|:---:|:---:|:---:|
| Movements | ✔ (vía cuenta) | ✔ | ✔ | ✔ ing/egr | — | — |
| Transfers | ✔ (cuenta origen/destino) | ✔ | — | — | — | — |
| Credits recibidos/otorgados | ✔ (vía cuenta) | opcional | — | — | ✔ pendiente/pagado | ✔ contraparte |
| Payables | ✔ (vía cuenta) | vencimiento | — | — | ✔ pendiente/pagado | ✔ contraparte |
| Sales (POS) | ✔ (vía cuenta) | ✔ | — | — | ✔ contado/crédito | ✔ cliente |
| Catalog | — | — | — | tipo prod/serv | — | ✔ (existe) |
| Clients | — | — | — | — | — | ✔ (existe) |
| Accounts | selector/agrupación visual | — | — | — | — | — |
| Categories | — | — | — | split ing/egr existente basta | — | — |

Dashboard: sistema central de filtros composables (ámbito → cuenta → categoría → período) — F4.

## R3.9 — Análisis del módulo Compras (HR3-24)

Qué resolvería: registrar adquisiciones con vínculo catálogo/proveedor, incremento de inventario, documentos de compra (líneas), costos para margen. Relaciones necesarias hoy inexistentes: Suppliers (entidad nueva), Inventory (valoración/cost basis), líneas de compra (patrón Sale.items), integración contable gasto-inventario (devengo).

Comparativa: **A) No implementar** — Payable ya registra la obligación con pagos parciales y vencimiento; el dolor restante es inventario/costos, no la obligación. **B) Compra mínima** — duplicaría semántica con Payable o exigiría refactor inmediato del mismo. **C) Evolución Payable→Compras** — camino natural: añadir proveedor estructurado + referencia opcional a ítems cuando exista inventario. **D)** n/a.

**Recomendación: A ahora + roadmap C** (gate: validación comercial + diseño de inventario). Queda PROHIBIDO crear el módulo sin nueva aprobación explícita.

## R3.10 — Análisis del perfil (HR3-21)

Necesario para el producto actual: nombre visible (bienvenida), cambio de contraseña (seguridad básica ausente), idioma persistido server-side. Diferible: foto (requiere servicio externo o storage propio — decisión de dependencias), eliminación de cuenta (flujo sensible, mejor con soporte definido), preferencias avanzadas. Recomendación D5(a): F10 implementa mínimo viable sin dependencias nuevas; foto se decide aparte.

## R3.11 — Auditoría comercial priorizada (HR3-25)

Criterio valor/esfuerzo/dependencia — NO convertir en lista infinita:

1. **Alto valor, bajo costo**: exportación CSV (movimientos/ventas), comparación mes vs mes anterior, labels de estado claros.
2. **Alto valor, costo medio**: presupuestos mensuales básicos, flujo de caja simple (proyección desde balances+pendientes), recurrencias.
3. **Mediano plazo**: metas/alertas, reportes por período, indicadores de negocio (requiere costos/inventario), proveedores (pre-Compras).
4. **Largo plazo / comercial**: planes y límites, features premium, onboarding guiado, conciliación, BI/análisis avanzado, capacidades IA.

Ninguna entra en Ronda 3 salvo lo ya planificado (F4 dashboard); resto alimenta roadmap (R3.15).

## R3.12 — Plan por fases (TODAS COMPLETADAS en R3)

| Fase | Contenido | Estado |
|------|-----------|--------|
| F0 | Auditoría completa | ✅ |
| F1 | Corrección financiera fundamental (fechas, transferencias, gráfico, formateo) | ✅ |
| F2 | Textos automáticos e i18n estructural | ✅ |
| F3 | Clasificación Personal/Negocio | ✅ |
| F4 | Dashboard financiero avanzado (filtros, Activos/Pasivos, evolución anual) | ✅ |
| F5 | Consistencia de tablas y ventas | ✅ |
| F6 | Invalidación y datos frescos | ✅ |
| F7 | UX de autenticación | ✅ |
| F8 | Branding, landing y navegación | ✅ |
| F9 | Tema claro/oscuro completo | ✅ |
| F10 | Perfil de usuario mínimo | ✅ |
| F11 | PWA final | ✅ |
| F12 | Cierre de ronda | ✅ |

## R3.13 — Protocolo de implementación por fase

**Antes:** explicar brevemente qué se hará, archivos probables, riesgos y pruebas. Decisiones menores de la fase se presentan ANTES de codear.
**Durante:** implementar ÚNICAMENTE la fase aprobada. Dependencia fuera de alcance → DETENERSE y explicar (por qué, archivos, riesgo, alternativas, recomendación).
**Después:** `pnpm test` + lint + build/tsc cuando corresponda; informar cambios/archivos/tests/resultados/problemas/pendientes/nuevos hallazgos; commit convencional por unidad lógica; **DETENERSE Y ESPERAR APROBACIÓN** para la siguiente fase.
Criterios de fase terminada: funciona, no rompe, respeta arquitectura/i18n/multi-tenancy/dominio financiero, móvil+desktop, loading/error/empty cuando corresponda, feedback al usuario, tests cuando haya lógica nueva.

## R3.14 — Cambios que NO deben hacerse

No implementar nada antes de aprobar este plan y sus compuertas D1–D8 · no crear módulo Compras · no crear multiusuario/equipos/colaboradores · no cambiar stack ni librerías UI/iconos/charts externas · no reescribir TwinCap · no compensar fechas con offsets ±1 día · no contar transferencias internas como ingreso/gasto · no persistir nuevo texto humano generado por el dominio · no hardcodear textos visibles · no soluciones por-pantalla para problemas compartidos · no `window.location.reload()` como solución general · no ocultar/eliminar tests fallidos · no habilitar el hook GGA · no instalar dependencias sin justificar (máx 1/fase) · no inventar FX/conversiones de moneda · no implementar features del análisis comercial sin aprobación.

## R3.15 — Roadmap futuro (registrado, fuera de esta ronda)

- **Blog interno** (HR3-26): educación financiera + SEO + autoridad de marca. Iniciativa futura documentada; no implementar salvo que una auditoría lo justifique.
- **Evolución Compras** (camino C de D8): Payable → proveedores estructurados + líneas de compra + inventario/costos, tras validación comercial.
- **Features comerciales** priorizadas en R3.11 (exportación, presupuestos, flujo de caja, recurrencias, planes/monetización a largo plazo).
- **Refinamiento devengo opcional**: separar flujos de financiamiento del resultado operativo (extensión de D2) si el negocio lo demanda.

---

# RONDA 4 — REDISEÑO Y EVOLUCIÓN DEL DASHBOARD FINANCIERO

Iniciada: 2026-08-26 · Fuente autoritativa: `Ronda4.md`

## R4.1 — Contexto y objetivos

**Evolutionary redesign** del Dashboard existente, NO una reescritura. Aprovecha las bases de Ronda 3 (filtros composables, Activos/Pasivos por moneda, evolución anual, use cases extraídos) para elevar la experiencia de usuario.

Objetivos principales (del documento fuente):

1. **Jerarquía visual clara**: filtros → indicadores principales → cuentas → resumen ingresos/gastos → reportes.
2. **Resumen de ingresos y gastos por categoría**: tablas con totalizadores, scroll interno, responsive.
3. **Menú de reportes**: grid de cards clicables que agrupen reportes existentes.
4. **Filtros como pieza central**: composables (ámbito/cuenta/categoría/período), todas las métricas dependientes recalculan.
5. **Movimientos**: orden de columnas corregido (Fecha → Monto → Categoría → Nota → Tipo → Acciones), categoría visible.
6. **Responsive mejorado**: mobile-first, 2 columnas para métricas/cuentas, sin truncar datos.
7. **Bug visual**: esquinas de cards de cuentas.

Restricciones heredadas intactas: cada usuario administra exclusivamente sus datos; NO crear módulo Compras; no reescribir TwinCap; arquitectura hexagonal; sin nuevas dependencias UI/gráficos/tablas.

## R4.2 — Estado actual del código (post-Ronda 3)

La Ronda 3 dejó el Dashboard con:

| Capa | Implementación actual |
|------|----------------------|
| Filtros | `dashboard-filters.tsx` — scope/cuenta/categoría/periodo, badges removibles, estado React (no URL) |
| Métricas | 4 cards (Balance, Ingresos, Gastos, Posición financiera) via `compute-dashboard-summary.ts` |
| Cuentas | Cards de cuentas existentes |
| Activos/Pasivos | `compute-activos-pasivos.ts` + `position-cards.tsx` — por moneda, sin FX |
| Evolución | `compute-yearly-evolution.ts` — serie mensual 12 meses |
| Orquestación | `dashboard-content.tsx` — server+client composition |
| Gráfico | `monthly-chart.tsx` — barras con track flex corregido en F1 |
| Movimientos | Tabla existente en `/movements` — orden de columnas actual no coincide con R4 |
| UI Kit | Card, Table, Button, Icon, EmptyState, Modal, Select, etc. en `src/components/ui/` |

**Pendientes de Ronda 3 relevantes para R4:**
- A1: Dashboard carga TODOS los movimientos (sin límite/proyección) — latencia degradará con el tiempo. **Pendiente confirmada: verificar si persiste.**
- A2: Cross-currency excluye silenciosamente monedas ≠ primera cuenta. **Ya mitigado parcialmente por D4 (agrupación por moneda en Activos/Pasivos), pero puede persistir en métricas principales.**

## R4.3 — Reglas inquebrantables (heredadas + nuevas de R4)

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

## R4.4 — Plan por fases (propuesta — REQUIERE APROBACIÓN)

| Fase | Contenido | Dependencias | Criterios de aceptación clave |
|------|-----------|--------------|-------------------------------|
| **A** | **Auditoría y preparación** — Solo inspección. Inspeccionar implementación actual del Dashboard (componentes, server/client, datos, filtros, agregaciones, métricas, Activos/Pasivos, gráfico, rutas de reportes, tabla Movimientos, Card de cuentas, formatters, i18n, pendientes R3 relevantes, problema de carga completa, cross-currency, categorías sintéticas, regresiones). No modificar código. | — | Mapa completo del estado actual del Dashboard; identificación de componentes reutilizables vs. nuevos necesarios; verificación de A1 y A2 |
| **B** | **Rediseño estructural del Dashboard** — Jerarquía visual (filtros → 4 indicadores → cards cuentas → grid reportes). Rediseño de 4 métricas principales: 1 fila desktop, 2 columnas mobile. Fix esquinas redondeadas en cards de cuentas. Grid de reportes clicables (iconos Lucide + texto + navegación). i18n para nuevos textos. | A | 4 métricas en fila desktop / 2 cols mobile; esquinas de cuentas correctas; grid de reportes con hover/focus/accessibilidad; dark/light; cero textos hardcodeados |
| **C** | **Resumen de ingresos y gastos** — Dos tablas (Ingresos / Gastos) con 4 columnas justificadas. Agregación por categoría respetando filtros composables y reglas financieras. Totalizadores fijos (header + footer siempre visibles, cuerpo scrolleable). Responsive: desktop lado a lado, móvil apilado. Multi-moneda agrupada. | A, B | Tablas muestran categorías y valores correctos; totalizadores = suma de filas; scroll interno funciona; responsive 375/768/1280; filtros recalculan todo; transferencias excluidas; monedas no mezcladas |
| **D** | **Integración y comportamiento de filtros** — Asegurar que todas las tablas y métricas filtrables respondan correctamente a filtros combinados. Verificar multi-moneda en métricas principales. Verificar rendimiento (A1). Revisar estado de A2 (cross-currency). | B, C | Filtros combinados (ámbito+cuenta+categoría+período) recalculan métricas Y tablas; totales = sum(filtrado); sin explosión de estados; rendimiento aceptable; multi-moneda honesta |
| **E** | **Movimientos responsive** — Orden de columnas: Fecha → Monto → Categoría → Nota → Tipo → Acciones. Categoría visible correctamente (reales + sintéticas + i18n). Mobile: Fecha/Monto primero, scroll horizontal como fallback sin ser solución exclusiva. Responsive 375/768/1280. | A | Orden correcto de columnas; categoría visible sin IDs/claves crudos; mobile legible; sin truncar montos; acciones accesibles |
| **F** | **QA final** — i18n paridad es/en; dark/light completo; responsive 375/768/1280; accesibilidad (keyboard, focus, aria, contraste); tests de agregaciones nuevas; typecheck; lint; build. | B–E | `pnpm test` + `pnpm lint` + `pnpm exec tsc --noEmit` + `pnpm build` verdes; 0 textos hardcodeados; parity i18n verificada; ambos temas funcionales; responsive verificado |

**Nota:** La división definitiva puede cambiar después de la auditoría Fase A.

### Dependencias entre fases

```
A ──┬──► B ──┬──► D
    │        │
    └──► C ──┘
              │
              └──► E (depende solo de A para entender Movimientos)
                        │
                        └──► F (todas las anteriores deben estar completas)
```

## R4.5 — Criterios de aceptación funcionales (del documento fuente)

La Ronda 4 se considera completa cuando:

### Dashboard principal
- [ ] La información principal aparece inmediatamente al entrar
- [ ] 4 métricas en 1 fila (desktop) / 2 columnas (mobile)
- [ ] Cards de cuentas con distribución legible
- [ ] Esquinas de cards de cuentas correctamente redondeadas
- [ ] Resumen de ingresos existe y muestra categorías + valores
- [ ] Resumen de gastos existe y muestra categorías + valores
- [ ] Totalizadores siempre visibles (header + footer)
- [ ] Cuerpo de tablas scrolleable, header/footer fijos

### Filtros
- [ ] Filtros combinables: Ámbito + Cuenta + Categoría + Período
- [ ] Análisis Personal vs Negocio posible
- [ ] Filtrado por cuenta, categoría, período
- [ ] Totales cambian al aplicar filtros (nunca total global con filas filtradas)
- [ ] No se cuentan transferencias como ingresos/gastos
- [ ] No se mezclan monedas incorrectamente
- [ ] Activos/Pasivos independientes de filtros de actividad (conservar semántica R3)

### Reportes
- [ ] Reportes secundarios agrupados en grid de cards clicables
- [ ] Cada card: icono Lucide + texto + navegación + hover/focus + dark/light
- [ ] Reportes existentes siguen funcionando

### Movimientos
- [ ] Orden: Fecha → Monto → Categoría → Nota → Tipo → Acciones
- [ ] Categoría visible (reales + sintéticas + i18n)
- [ ] En móvil: Fecha/Monto primero
- [ ] Sin montos truncados, sin textos críticos truncados

### Transversal
- [ ] Sin `COP COP` ni formatos monetarios duplicados
- [ ] Sin textos nuevos hardcodeados
- [ ] ES y EN con paridad
- [ ] Dark/light funcionan correctamente
- [ ] Tenant isolation intacto
- [ ] Tests pasan
- [ ] TypeScript pasa
- [ ] ESLint pasa
- [ ] Build pasa

## R4.6 — Restricciones explícitas

NO:
- reescribir TwinCap
- cambiar Next.js / React / Tailwind / Mongoose
- cambiar arquitectura
- instalar librerías de UI / gráficos / tablas
- crear módulo Compras
- crear equipos/colaboradores/roles
- inventar FX
- volver a mover Personal/Negocio a `Account.scope`
- eliminar filtros existentes
- eliminar Activos/Pasivos
- eliminar evolución anual
- contar transferencias como ingresos/gastos
- hardcodear textos
- usar `window.location.reload()` como solución
- crear soluciones duplicadas para problemas que ya tienen componentes reutilizables
- sacrificar accesibilidad por estética
- sacrificar legibilidad por conseguir un número determinado de columnas
- ocultar información importante en móvil
- modificar las reglas financieras establecidas

## R4.7 — Testing requerido

Toda lógica nueva de agregación debe tener tests:

- **Ingresos por categoría**: múltiples movimientos, categorías diferentes, filtro período, filtro Personal, filtro Negocio, filtro cuenta, combinación de filtros, ausencia de resultados.
- **Gastos por categoría**: mismos escenarios.
- **Totales**: `sum(filas) === totalFooter`.
- **Transferencias**: verificar que NO aparecen como ingresos/gastos.
- **Multi-moneda**: verificar que no se mezclan monedas.
- **Filtros combinados**: Negocio + cuenta X + categoría Y + rango de fechas.
- **Responsive**: verificación manual/automatizada en 375px, 768px, 1280px.

## R4.8 — Regla sobre Ronda 3

La Ronda 3 está cerrada. No tratar sus documentos como fases pendientes de re-ejecutar. Usar `AUDIT-AND-PLAN.md` como contexto histórico y fuente de decisiones ya tomadas.

Si se encuentra un comportamiento que contradice lo documentado como completado en R3, primero determinar si:
1. el código actual cambió después de la documentación
2. existe una regresión
3. el comportamiento documentado ya no corresponde al producto
4. o se está interpretando incorrectamente la implementación

No rehacer fases de R3 automáticamente. Los pendientes históricos solo se incorporan cuando sigan siendo relevantes para el alcance de R4.

## R4.9 — Auditoría Fase A: hallazgos de inspección (2026-08-26)

### Inventario de archivos del Dashboard

| Archivo | Descripción |
|---------|-------------|
| `src/app/(main)/dashboard/page.tsx` | Server component: auth, DB, fetching de TODOS los datos, serialización |
| `src/app/(main)/dashboard/loading.tsx` | Skeleton placeholder (4 cards, chart, 3 account cards) |
| `src/components/dashboard/dashboard-content.tsx` | Client orchestrator: estado de filtros, derivación vía useMemo |
| `src/components/dashboard/dashboard-filters.tsx` | 4 filtros: scope, account, category, period (con badges) |
| `src/components/dashboard/summary-cards.tsx` | 3 métricas: Balance Total, Ingresos Mes, Gastos Mes |
| `src/components/dashboard/position-cards.tsx` | Activos/Pasivos/Net por moneda (server-computed) |
| `src/components/dashboard/monthly-chart.tsx` | CSS bar chart: 6 meses ingreso vs gasto |
| `src/components/dashboard/recent-movements.tsx` | Últimos 5 movimientos filtrados |
| `src/components/dashboard/index.ts` | Barrel re-exports |

**Nota:** NO existe `account-cards.tsx` separado — las cards de cuentas se renderizan inline en `dashboard-content.tsx:257-276`.

### Flujo de datos

```
page.tsx (SERVER)                           dashboard-content.tsx (CLIENT)
─────────────────                           ─────────────────────────────
1. getCurrentUser()                         State: filters, chartView
2. connectDb()
3. Promise.all([                            Props recibidos:
   userRepo.findById(),                       accounts, movements (TODOS), categories,
   listAccounts()])                           primaryCurrency, locale, labels,
4. Promise.all([                              yearlyData, positionData
   balances,                                → useMemo: filter logic
   movementRepo.findByUserId() SIN LÍMITE,  → useMemo: accountBalances by filter
   categoryRepo.findByUserId(),             → useMemo: computeDashboardSummary
   creditReceivedRepo.findByUserId(),       → useMemo: computeYearlyEvolution
   creditGrantedRepo.findByUserId(),
   payableRepo.findByUserId()])
5. computeActivosPasivos() → positionData
6. computeYearlyEvolution() → yearlyData (MUERTO: cliente ignora y recalcula)
7. Serializar → DashboardContent
```

### Hallazgos clave

> R4-A3 a R4-A10 fueron resueltos en Ronda 4 (Fases B→F). Solo persisten A1 y A2.

| ID | Hallazgo | Severidad | Estado |
|----|----------|:---------:|--------|
| R4-A1 | Dashboard carga TODOS los movimientos sin límite/proyección — `findByUserId` sin restricción. Serializa todos como props React. Filtrado client-side en useMemo. | 🔴 | **PENDIENTE** |
| R4-A2 | Summary cards usan UNA moneda (`accounts[0].currency`). Total balance mezcla monedas. Solo Position Cards agrupa correctamente. Ingresos/gastos en otras monedas = $0 silencioso. | 🔴 | **PENDIENTE** |

### Componentes UI disponibles

`Card`, `Button`, `Badge`, `Modal`, `Select`, `SearchableSelect`, `Input`, `PasswordInput`, `EmptyState`, `Skeleton`, `Icon`, `ActionIconButton`, `ConfirmDialog`, `EntityDeleteButton`, `Toast`, `Logo`. **Faltan: Table, Tabs, Tooltip.**

### Rutas existentes (candidatas a grid de reportes)

`/accounts`, `/categories`, `/movements`, `/transfers`, `/credits/received`, `/credits/granted`, `/payables`, `/clients`, `/pos/catalog`, `/pos/sales`, `/profile`.

### Plan Fases B–F (TODAS COMPLETADAS en R4)

| Fase | Contenido | Estado |
|------|-----------|--------|
| B | Card fix, SummaryCards 4 métricas, jerarquía reordenada, grid reportes, i18n | ✅ `cd1bdd2` |
| C | computeCategorySummary + SummaryTable + dos tablas resumen | ✅ `80dd92c` |
| D | Gráfico anual respeta filtros + tests combinados | ✅ `5dea992` |
| E | Movimientos: columna Category + reorder + responsive | ✅ `10d6e0b` |
| F | QA final: 428/428 tests, tsc, build, i18n paridad | ✅ `ac358ed` |

---

# RONDA 5 — INTEGRIDAD FINANCIERA, CRÉDITOS CON CUOTAS, FIX DASHBOARD, ONBOARDING

Iniciada: 2026-08-26 · **Replanteada 2026-08-27** tras hallazgos críticos de integridad reportados por el usuario.

## R5.1 — Contexto y objetivos

Cinco sugerencias del usuario, agrupadas en fases:

1. **Créditos con cuotas**: registrar número y valor de cuotas al crear un crédito. Cada abono descuenta del total a pagar (no del dinero recibido). Botón "Marcar como pagado" para cancelación manual.
2. **Fix filtro de mes**: las tablas de ingresos/gastos del dashboard no responden al filtro de período (bug confirmado: `current_month` es un no-op).
3. **Onboarding**: nuevos usuarios solo reciben cuenta fija "Efectivo" (Nequi eliminada del seed). Orientación para crear cuentas propias.
4. **Usuarios antiguos**: permitir eliminar cuentas fijas obsoletas (Nequi).
5. **Centrar body**: verificar y aplicar centrado del contenido.

## R5.2 — Hallazgos de auditoría

### Créditos con cuotas

- Campos `installments` y `frequency` existen pero son **puramente informativos** (CRED-R-1). No hay `installmentValue`.
- `pending = principal - sum(abonos)` — no distingue entre dinero recibido y total a pagar con intereses.
- Créditos POS (con `saleId`) se crean con principal cero y no deben requerir cuotas.
- Créditos standalone (sin `saleId`) son los que necesitan cuotas obligatorias.

### Filtro de mes (BUG CONFIRMADO)

- En `dashboard-content.tsx`, el filtro `current_month` **no tiene rama de filtrado**. Solo `this_year` filtra.
- `filteredMovements` contiene TODOS los movimientos cuando `period === 'current_month'`.
- Componentes afectados: tablas de resumen, top categorías, movimientos recientes.

### Seed data

- `seedUser()` crea 2 cuentas fijas: **Efectivo** (COP) y **Nequi** (COP), ambas `isFixed: true`.
- Nequi no existe en todos los países → eliminar del seed.
- No hay guía de onboarding para nuevos usuarios.

### Body centering

- `<main>` ya tiene `max-w-screen-2xl mx-auto` (centra hasta 1536px).
- El `<body>` y el contenedor flex del layout no tienen restricción de ancho adicional.

## R5.3 — Reglas inquebrantables (heredadas)

Todas las reglas de R3 y R4 vigentes. Adicionales:

- **UNA sola fuente de verdad para la deuda de una venta a crédito:** el `CreditGranted` es dueño único de la deuda; la `Sale` on-credit **no acumula `sale.abonos` propios** y deriva su saldo del crédito vinculado.
- **El pago inicial de una venta on-credit se registra como el PRIMER abono del `CreditGranted`** (no como movimiento suelto), de modo que `credit.pending = total − Σabonos` y la venta muestra el pago inicial y el saldo correctos.
- **Cascada de borrado simétrica:** eliminar una venta a crédito borra el crédito vinculado + todos sus movimientos (pago inicial/abonos); el manejo inverso aplica al eliminar un crédito de venta.
- **`installmentValue` es obligatorio cuando `installments > 0`** en créditos standalone.
- **Créditos POS (con `saleId`)** no requieren cuotas (su deuda es el `principal` neto).
- **"Marcar como pagado"** crea un abono por el `pending` restante (no un flag separado).
- **Toda acción que modifique movimientos DEBE revalidar `/movements`** (regla de R3 F6, reforzada y centralizada).
- **Nequi** se elimina del seed para nuevos usuarios; usuarios existentes conservan su cuenta Nequi (ya no es fixed).
- **Efectivo** permanece como cuenta fija ineliminable para todos los usuarios.

## R5.4 — Hallazgos críticos de integridad (reportados por el usuario + auditoría 2026-08-27)

El usuario reportó 6 síntomas. La auditoría profunda (3 exploraciones: dominio/aplicación, UI/invalidación, infraestructura) confirmó que comparten UNA causa raíz de diseño.

### Causa raíz: dos fuentes de verdad para la misma deuda

Al crear una venta a crédito se crean **dos entidades separadas**, cada una con su **propia lista de abonos embebida** (`sale.abonos` y `credit.abonos`), que **ningún write sincroniza**. El vínculo `CreditGranted.saleId` es solo informativo (String sin índice ni FK).

| Síntoma | Causa raíz (archivos) |
|---------|------------------------|
| Venta 150.000 / pago inicial 20.000 → saldo 150.000 en ventas y 130.000 en créditos | El pago inicial NO se persiste como abono; solo crea un `Movement` suelto (`salePayment`). `Sale.pending=total` (150.000), `Credit.pending=principal neto` (130.000). `create-sale.ts:126-153` |
| Abonos de créditos no se reflejan en ventas y viceversa | `addSaleAbono` escribe solo `sale.abonos`; `addCreditGrantedAbono` escribe solo `credit.abonos`. `sales/add-sale-abono.ts:46-52`, `credits-granted/add-abono.ts:47-53` |
| Borrar venta no borra el crédito otorgado | `deleteSale` no consulta el repo de créditos; deja el `CreditGranted` (con sus abonos `refId=creditId`) huérfano alimentando el dashboard. `sales/delete-sale.ts`, `credits-granted/delete-credit-granted.ts` |
| Borrar abono: toast error + desaparece + sigue en Movimientos | Borrado NO atómico: `$pull` del abono (se comete) + `movementRepo.delete` (2º write). Si el 2º falla → toast error, abono borrado de DB, movimiento huérfano. `credits-granted/delete-abono.ts:31-36` |
| Movimientos no se actualizan sin refresh | Faltan `revalidatePath('/movements')` en 7 de 9 actions (regla de F6 violada); las listas cliente usan `useState(initial...)` que no se re-sincroniza con props tras `router.refresh()`. |
| Datos eliminados siguen en el dashboard | Consecuencia de los orphan movements que no se borran realmente (doble escritura) + revalidación incompleta. |

### Bugs de infraestructura adicionales (latentes, corregir en F)

1. **`toTransferDocData` omite `movementIds`** — las transferencias nunca persisten su vínculo a sus 2 movements → `reconcile` las marca incompletas.
2. **Soft-delete de Sale es vestigial** — el dominio/modelo/reconciler lo contemplan (`deletedAt`/`stockRestored`), pero `toSaleDocData` nunca los persiste y `sale-repository` hace hard-delete (`findOneAndDelete`).
3. **`GlobalMovementProvider.invalidateData()` es código muerto** — nadie lo consume; y no cachea la tabla de movimientos (solo cuentas/categorías del modal rápido).
4. **`reconcile.ts` fase apply es no-op** y no cruza `CreditGranted.saleId` contra ventas inexistentes.

## R5.4b — Plan por fases (REPLANTEADO 2026-08-27, aprobado)

| Fase | Contenido | Dependencias | Criterios de aceptación clave |
|------|-----------|:---:|-------------------------------|
| **A** | **Modelo de integridad venta↔crédito — Dominio + use cases** — `CreditGranted` dueño único de la deuda on-credit; `Sale` delega saldo al crédito vinculado; pago inicial = 1er abono del crédito; `pending` unificado; cascada de borrado venta↔crédito↔movimientos. Tests domain + use cases. | — | Una sola fuente de verdad; pending correcto en venta y crédito; cascada de borrado completa; suite verde |
| **B** | **Eliminación y movimientos** — Centralizar invalidación (helper único `revalidatePath('/movements')` en todas las actions); borrado de abono atómico (orden de writes seguro) para eliminar toast de error + movimiento huérfano; sincronizar la tabla de movimientos (re-fetch tras operaciones). | A | Toda action que toca movimientos revalida `/movements`; borrado de abono no deja orphans; tabla actualiza sin refresh |
| **C** | **Créditos con cuotas — Dominio + Infra + UI** — `installmentValue: Money`, `totalToPay`; pago inicial dentro del flujo unificado; "Marcar como pagado". Forms + progreso "3/12". | A | `installmentValue` obligatorio si `installments>0`; progresso visible; botón funciona; i18n es/en |
| **D** | **Fix filtro de mes** — Rama `current_month` en `filteredMovements` (dashboard). | — | Filtro recalcula tablas/top/recientes; tests |
| **E** | **Seed + Onboarding + Body centering** — Seed solo "Efectivo" fija; Nequi → no fixed; onboarding con ejemplos; centrado 375/768/1280. | — | Seed 1 cuenta; migración; onboarding visible; centrado |
| **F** | **Reparación datos legacy + QA final** — Migración/`reconcile` para: ventas legacy on-credit sin crédito vinculado, créditos huérfanos de ventas borradas, transferencias sin `movementIds`; corregir soft-delete vestigial; QA integral (i18n, dark/light, responsive, tests, tsc, build). | A–E | Suite verde, tsc limpio, build, datos legacy reparados |

### Dependencias entre fases

```
A ──► B ──► (C,D,E en paralelo) ──► F (QA)
A ──► C
```

## R5.5 — Decisiones de dominio

| ID | Decisión | Justificación |
|----|----------|---------------|
| R5-D0 | El `CreditGranted` es la ÚNICA fuente de verdad de la deuda on-credit; `Sale` no acumula abonos propios y deriva su saldo del crédito | Elimina la duplicación de raíz; coherente con el principio "una fuente de verdad" (como Movement.context en D3-bis) |
| R5-D0b | El pago inicial de una venta on-credit se registra como primer abono del crédito | Hace que la venta y el crédito muestren el pago inicial y el saldo correctos, con una sola lista de abonos |
| R5-D0c | Cascada de borrado simétrica venta↔crédito↔movimientos | Evita entidades huérfanas y movimientos que alimentan el dashboard con datos borrados |
| R5-D1 | `installmentValue` obligatorio cuando `installments > 0` | Evita inconsistencia: sin valor de cuota no se puede calcular total a pagar |
| R5-D2 | Créditos POS (con `saleId`) no requieren cuotas | Su deuda es el principal neto |
| R5-D3 | "Marcar como pagado" crea abono por pending restante | Mantiene registros financieros honestos (total abonos = total a pagar) |
| R5-D4 | Nequi eliminada del seed, no de la DB existente | Backward-compatible: usuarios existentes conservan su cuenta |
| R5-D5 | Efectivo permanece como cuenta fija ineliminable | Cuenta base para todos los usuarios, todos los países |

## R5.6 — Restricciones explícitas

NO:
- Mantener dos listas de abonos no sincronizadas para la misma deuda on-credit
- Permitir que el pago inicial quede solo como movimiento suelto sin representación en el saldo
- Borrar venta/crédito dejando entidades huérfanas ni movimientos que alimenten el dashboard
- Fingir éxito en un borrado de abono cuando el movimiento persiste (evitar toast-error + dato huérfano)
- Requerir cuotas en créditos POS (con `saleId`)
- Crear un flag `status: 'paid'` separado (usar abono)
- Eliminar cuentas Nequi de usuarios existentes
- Agregar dependencias nuevas
- Modificar reglas financieras establecidas
- Hardcodear textos

---

# RONDA 6 — HALLAZGO POST-R5: VENTAS ELIMINADAS SIGUEN VISIBLES EN MOVIMIENTOS Y DASHBOARD

Iniciada: 2026-08-28 · Tipo: auditoría de defecto + propuesta de mejora (sin implementación aún)

## R6.1 — Síntoma reportado

El usuario reporta que **ventas eliminadas siguen siendo visibles** en la tabla de movimientos y en el dashboard, **afectando los informes** (ingresos inflados). A pesar de que Ronda 5 (Fases A–F) implementó la cascada de borrado venta↔crédito↔movimientos (R5-D0c) y la invalidación centralizada, persisten movimientos de ventas ya eliminadas.

## R6.2 — Auditoría (2026-08-28, solo lectura)

Método: exploración de código (dominio/aplicación ventas, repositorios, dashboard, tabla de movimientos) + **inspección read-only contra Atlas** para confirmar el síntoma con datos reales.

### Causa raíz fundamental

Existe **UNA causa raíz estructural** que explica la persistencia:

> **Ni `findByUserId`/`findPaged` del repositorio de movimientos, ni el dashboard, ni la tabla de movimientos verifican que el padre referenciado por `link.refId` (venta/crédito) siga existiendo.** No hay join, populate, ni filtro de existencia de padre. La ÚNICA protección es que `deleteSale` borre físicamente los movimientos. Si por cualquier razón un movimiento queda en la BD, queda visible **indefinidamente** y suma en todos los agregados.

### Hueco confirmado en `deleteSale` (Hueco 1 — el que produjo el huérfano real)

`src/core/application/sales/delete-sale.ts:52-60` construye `movementIdsToDelete` solo si:
1. `linkedCredit && m.link?.refId === linkedCredit.id` — movimientos del crédito (initial abono + abonos).
2. `m.link?.refId === saleId` — salePayment legacy.

**Problema:** si el movimiento `salePayment`/`creditGrantedAbono` guarda un `link.refId` con el **UUID legacy** (formato `<uuid>`, de ventas/créditos creados antes de la migración a ObjectId), ese `refId` **no matchea** ni `saleId` ni `creditId` (ObjectIds actuales). Al borrar la venta, ese movimiento **sobrevive** y queda huérfano. Este caso está documentado en `src/lib/legacy-repair.ts` (acciones `DeleteOrphanMovementAction`/`RelinkMovementRefIdAction`) y fue reparado one-off en R5-F, pero **`deleteSale` no lo previene** si vuelve a ocurrir.

### Otros huecos / riesgos estructurales (Huecos 2–5)

- **Hueco 2 — Crédito con `saleId` roto:** si el `CreditGranted` quedó con `saleId` vacío o apuntando a un UUID viejo, `deleteSale` no encuentra `linkedCredit` (`credits.find(c => c.saleId === saleId)` en línea 47) y **no borra los movimientos `creditGrantedAbono`/`creditGrantedPrincipal`** de ese crédito. (No presente en el estado actual de Atlas, pero es un riesgo latente de la misma familia.)
- **Hueco 3 — Borrado no transaccional:** Atlas shared tier no soporta multi-doc transactions. `deleteSale` borra movimientos → crédito → venta de forma separada y tolerante. Un fallo a mitad deja movimientos huérfanos sin que NADA los limpie después.
- **Hueco 4 — Sin limpieza defensiva:** no existe ningún mecanismo (periódico, en lectura, o de garbage collection) que detecte/elimine movimientos huérfanos. El único "limpia-huérfanos" es el script one-off `reconcile-legacy.mjs`, que no corre en producción de forma continua.
- **Hueco 5 — Soft-delete vestigial de Sale:** el modelo/mapper/reconciler contemplan `deletedAt`/`stockRestored` pero `sale-repository` hace hard-delete (`findOneAndDelete`). Si alguna vez se usó el soft-delete legacy, la cascada tampoco corrió (hallazgo R5.4 latent, no corregido en F).

## R6.3 — Confirmación con datos reales (Atlas, read-only)

Inspección directa de las colecciones `sales`, `creditgranteds`, `creditreceiveds`, `movements`:

| Métrica | Valor |
|---------|-------|
| Ventas | 14 |
| Créditos otorgados | 8 |
| Créditos recibidos | 3 |
| Movimientos | 100 |
| Cuentas / Usuarios | 16 / 7 |
| Ventas soft-deleted vestigiales | 0 |

**Hallazgo confirmado — 1 movimiento `salePayment` huérfano:**
- `mv = 6a9134098b0de779c4a4f1ab` · usuario `pruebas2@mail.com` · **ingreso 50.000 COP** · fecha 2026-08-14
- `link.refId = d86e48ee-6521-420d-8346-b6e5833232c6` — **UUID legacy** que no matchea ninguna venta/crédito actual.
- Pertenecía a una venta ya **eliminada**; al borrarla, `deleteSale` no lo alcanzó por el mismatch de refId.
- 0 créditos huérfanos; 0 movimientos `creditGrantedAbono` huérfanos.

**Impacto financiero:** aparece como **ingreso de 50.000** en la tabla de movimientos y suma en `compute-dashboard-summary`, `compute-category-summary` y `compute-yearly-evolution` (solo excluyen `transfer`/`opening`; `salePayment` cuenta). Infla ingresos del período e informes.

## R6.4 — Propuestas de mejora (NO implementadas; requieren aprobación)

Priorizadas por valor/riesgo/esfuerzo/alcance:

| # | Propuesta | Qué resuelve | Alcance / Riesgo |
|---|-----------|--------------|------------------|
| **P1** | **Limpieza defensiva de movimientos huérfanos en lectura (filtro de existencia de padre)** en `findByUserId`/`findPaged`/dashboard: excluir movimientos `salePayment`/`creditGrantedAbono`/`creditGrantedPrincipal`/`creditReceivedPrincipal`/`transfer` cuyo `link.refId` no resuelva a una venta/crédito/transfer viva. | Cura el síntoma de forma permanente en toda lectura (movimientos + dashboard + informes), sin depender de que `deleteSale` nunca falle. | Requiere cargar ventas/créditos/transfers en el repo (o un filtro Mongo con `$in`). Riesgo: leve costo de query. Es la defensa más robusta contra la familia completa (Huecos 1–4). | ✅ **IMPLEMENTADO (P1 v2)** — `filterMovementsWithLiveParents` en `src/core/application/movements/filter-live-linked-movements.ts`, aplicado a `dashboard/page.tsx` y `movements/page.tsx`. V2 agrega **reconciliación por valor** (accountId + fecha de negocio + monto) para refId UUID legacy que referencian padres vivos, evitando ocultar gastos legítimos. |
| **P2** | **Robustecer `deleteSale`** para cubrir movimientos cuyo `refId` no matchea el id actual: borrar por id de venta Y por **UUID legacy conocidos** (batch `deleteMany({ 'link.refId': { $in: [saleId, legacyUuid...] } })`). Alternativa: que el modelo persista el mapa `legacyRefIds` o que la cascada use deleteMany por refId en vez de lista por id. | Elimina el Hueco 1 y 2 de raíz en la ruta de borrado (no solo en lectura). | Escala del cambio baja-media. Complementa P1 (P1 es la red de seguridad; P2 corrige la causa en el borrado). | ✅ **IMPLEMENTADO** — `deleteSale` reescrito para cascada `deleteByRefId(saleId)` + `deleteByRefId(creditId)` (formato-agnóstico, cubre ObjectId y UUID legacy), sin listar previamente. |
| **P3** | **Hacer el borrado de movimientos del padre robusto vía `deleteMany`** (una sola operación por refId en vez de N `delete` por id), tolerante y sin depender de listar previamente. | Reduce el hueco 3 (menos ventanas de fallo), simplifica código. | Baja. | ✅ **IMPLEMENTADO** — `MovementRepository.deleteByRefId(userId, refId)` vía `deleteMany({ userId, 'link.refId': refId })` en `movement-repository.ts`. |
| **P4** | **Suite de tests de expurgo**: test de `deleteSale` sobre una venta legacy con movimiento `refId` UUID distinto → verificar que ese movimiento se borra; y test de la limpieza en lectura (P1) con padre inexistente. | Fija el contrato y previene regresiones. | Baja, acompaña P1/P2. | ✅ **IMPLEMENTADO** — 20 tests de `filterMovementsWithLiveParents` (incl. reconciliación por valor) + tests de `deleteSale` ajustados a `deletedByRefId`; fakes de `MovementRepository` actualizados (10 archivos). |
| **P5** | **Limpiar el huérfano real de producción** (`6a9134098b0de779c4a4f1ab`, 50.000 COP, usuario pruebas2): eliminar el movimiento huérfano (o si se desea conservar el dato de la venta, crear un mecanismo de anulación). | Corrige el dato actual en Atlas que el usuario está viendo. | One-off; requiere confirmación de si el dato debe eliminarse o anularse. | ✅ **IMPLEMENTADO** (aprobación usuario 2026-08-28: "Relink + corregir P1 por valor") — `scripts/clean-orphan-movements.mjs` idempotente (dry-run/--apply): **1 relink** del crédito vivo `6a9194b3b917614ec8d8c041` → `refId = 6a9194b3b917614ec8d8c03e`, **1 borrado** del huérfano `6a9134098b0de779c4a4f1ab`. Idempotencia verificada: 0 relinks / 0 huérfanos. |
| **P6** | (Opcional) **Soft-delete con `deletedAt` en ventas/créditos** + exclusión en lecturas — decidir si se abandona el vestigio (Hueco 5) o se estandariza. | Elimina el vestigio inconsistente. | Media; requiere decisión de producto. No urgente. | ⏸️ Pendiente de decisión de producto (no implementado). |

**Recomendación:** implementar **P1 + P2 + P4** (red de seguridad en lectura + corrección de la causa en borrado + tests) y **P5** (limpieza del huérfano real con confirmación del usuario). P3 y P6 quedan como refuerzo/roadmap. — **P1–P5 IMPLEMENTADOS y verificados (2026-08-28). P6 queda como decisión de producto pendiente.**

## R6.6 — Implementación completada (2026-08-28)

**Alcance:** P1 (filtro + reconciliación por valor), P3 (`deleteByRefId`), P2 (cascada `deleteSale`), P4 (tests), P5 (datos Atlas). Suite **513/513** (28 filtro + 20 nuevos + ajustes), `tsc --noEmit` limpio.

**Hallazgo crítico durante la implementación:** la validación de P5 contra Atlas reveló que NO todos los movimientos con refId no-resuelto son huérfanos puros. Solo 2 de ~66 movimientos con `link` usan refId UUID legacy: (1) `salePayment` de venta eliminada (huérfano real → borrar), (2) `creditGrantedPrincipal` del crédito VIVO `6a9194b3b917614ec8d8c03e` (20.000 COP, usuario fjpaba) cuyo refId legacy no coincidía con el `_id` ObjectId del padre → **relink**, no borrado. Esto obligó a la **P1 v2 (reconciliación por valor)**: un refId legacy que no resuelve por id se reconcilia contra padres vivos por `accountId + fecha de negocio (clave UTC) + monto espejo`, evitando ocultar gastos legítimos. Abonos de crédito y payables NO se reconcilian por valor (no hay datos legacy; el abono no espeja el total del padre).

**Script:** `scripts/clean-orphan-movements.mjs` — clasifica cada movimiento con refId no-resuelto en RELINK (padre vivo por valor) u ORPHAN (sin padre), idempotente, dry-run por defecto y `--apply`.

## R6.7 — Decisión de producto pendiente: P6 (soft-delete vestigial)

**Estado:** documentado tras cerrar R6 (2026-08-28). Anotado para una próxima ronda, **no implementado**.

**Problema:** el modelo de venta conserva campos de soft-delete a medio terminar (`deletedAt`, `stockRestored`) en entidad, modelo Mongoose y mapper, con lógica que los lee (reconcile.ts detecta ventas con `deletedAt` pero sin `stockRestored`; legacy-repair.ts tiene acción `PurgeSoftDeletedSaleAction`), **pero** el flujo real de borrado (`deleteSale`) es hard delete físico. Hay dos mecanismos de borrado en paralelo: un vestigio inconsistente e inconcluso.

**Decisión tomada con el usuario (2026-08-28): Opción A — abandonar el soft-delete.** Borrar siempre es físico (como ya es con P1-P5). Implica, en una ronda futura: eliminar `deletedAt`/`stockRestored` de `src/core/domain/sale.ts`, `src/infrastructure/models/sale.ts`, `src/infrastructure/mappers/sale.ts`, y quitar la lógica relacionada en `src/infrastructure/consistency/reconcile.ts` y `src/lib/legacy-repair.ts` (acción `PurgeSoftDeletedSaleAction`), más tests. No urgente, sin impacto funcional; es limpieza de deuda técnica.

**Alternativa descartada:** Opción B (estandarizar soft-delete conservando historial) — requeriría tocar todas las lecturas de ventas y es un cambio de producto.

## R6.5 — Reglas respetadas

Auditoría de solo lectura: NO se escribió código ni se mutó la DB. Arquitectura hexagonal intacta. Multi-tenancy no comprometido (el huérfano y las propuestas respetan el aislamiento por `userId`). i18n / principios financieros / stack intactos. **En implementación:** se respetó el aislamiento por `userId` (filtros y `deleteByRefId` scoped por `userId`); operaciones de datos en Atlas acotadas al relink/borrado del movimiento objetivo, sin tocar montos ni otros datos.

---

# RONDA 7 — INFLADO RESIDUAL DE CARDS (BALANCE/ACTIVOS/PATRIMONIO) + RAÍZ UUID↔OBJECTID

## R7.1 — Síntoma reportado (2026-08-28, post-R6)

Para `pruebas2@mail.com`, **eliminar ventas sigue inflando las cards** del dashboard: **Balance total**, **Patrimonio** y **Activos** (Posición financiera) muestran valores por encima de lo real, **aunque la tabla de Movimientos ya las oculta** (tras P1 de R6). El incumplimiento reportado era: "eliminé venta, el Balance total / Patrimonio / Activos sigue inflado".

## R7.2 — Auditoría (2026-08-28, solo lectura: código + Atlas read-only)

### Hallazgo A — `aggregateBalance` NO excluye movimientos huérfanos (defecto de código)

- `MongoMovementRepository.aggregateBalance` (aprox. líneas 179–196 de `src/infrastructure/repositories/movement-repository.ts`) hace `$sum: "$signedAmount"` sobre **TODOS** los movimientos de una cuenta, **sin** filtrar por liveness del padre (`link.refId`). No aplica el filtro defensivo de P1 (que solo cubre `findByUserId`/`findPaged`/`allMovements` del dashboard/tabla).
- Las cards **Balance total** y la **Posición financiera** (Activos/Pasivos/Patrimonio) derivan de estos balances de cuenta:
  - `Activos = Σ balance de cuentas + Σ CreditGranted.pending`
  - `Pasivos = Σ CreditReceived.pending + Σ Payable.pending`
  - `Patrimonio = Activos − Pasivos`
  Ver `src/core/application/compute-activos-pasivos.ts`. Como `aggregateBalance` suma los huérfanos, las tres cards quedan infladas aunque la tabla los oculte. **Esto explica exactamente el reporte.**

### Hallazgo B — 2 movimientos huérfanos vigentes en `pruebas2` (150.000 COP)

Auditoría read-only contra Atlas confirmó **2 movimientos `salePayment` huérfanos** que inflan el balance del Efectivo de `pruebas2@mail.com`:

| `_id` | refId (UUID legacy) | monto | fecha | causa |
|---|---|---|---|---|
| `6a91aff0c9453e006659c122` | `a915a2f4-8307-4b2b-bef6-68c935bcf1df` | 100.000 COP | 2026-08-08 | venta original eliminada (mismatch UUID↔ObjectId) |
| `6a91b04938326c01557efc91` | `afd4a2ca-83d4-4196-89f1-66bd9a61f998` | 50.000 COP | 2026-08-10 | venta original eliminada (mismatch UUID↔ObjectId) |

No se borraron durante R6 porque fueron creados **después** de que el script de limpieza P5 corrió (los movimientos quedan con `link.refId` UUID que nunca matchea el `_id` ObjectId de su venta, ver Hallazgo C). Conteos actuales en pruebas2: 14 ventas, 9 creditgranted, 3 creditreceived, 3 payables, 7 transfers, 103 movimientos, 16 cuentas.

### Hallazgo C — RAÍZ: ids de dominio (UUID) vs `_id` real (ObjectId) — proceso duplicado confirmado

**Esta es la causa estructural de los huérfanos y del Reporte R6.** Flujo real confirmado en código:

1. El dominio genera el id con `crypto.randomUUID()` vía el puerto `IdGenerator` (`src/core/application/ports.ts`), inyectado en cada action como `const ids = { generate: () => crypto.randomUUID() }` (12 archivos de actions).
2. Al persistir, el **mapper descarta ese id**: `toMovementDocData` (`src/infrastructure/mappers/movement.ts`) y `toSaleDocData` (`src/infrastructure/mappers/sale.ts`) escriben `userId/accountId/categoryId` como `new Types.ObjectId(...)` pero **NO escriben `_id`**. Cada modelo Mongoose sin `_id` explícito → Mongo asigna un `_id: ObjectId` nuevo (p.ej. `6a91aff0c9453e006659c122`).
3. Al leer, el mapper pone `doc._id.toString()` (el **ObjectId**, no el UUID) como `id` de la entidad.

→ **El UUID generado en el dominio NUNCA es la identidad real** (se pierde en el primer write). Todo id de dominio es trabajo muerto.

**Consecuencia crítica (mismatch):** en `create-sale` (`src/core/application/sales/create-sale.ts`), el movimiento `salePayment` se construye con `link: { refId: args.saleId }` donde `saleId` es el **UUID del dominio** generado antes de persistir la venta. Pero la venta recibe un **ObjectId** distinto al guardarse. Entonces:

- `movement.link.refId` (UUID) **nunca coincide** con `sale._id` (ObjectId) real de su venta.
- `deleteSale` recibe `sale.id = ObjectId` (toma de la lectura) y `deleteByRefId(userId, ObjectId)` no encuentra el movimiento (refId=UUID) → **el movimiento sobrevive al borrado → infla el balance**.
- El filtro P1 de lectura oculta el huérfano de la tabla, pero `aggregateBalance` lo sigue sumando (Hallazgo A).

**El bug es estructural y VIGENTE** (aplica a TODA venta/crédito creada hoy, no solo datos legacy): mientras `create-sale` siga generando `refId` con un UUID descartable, cada venta crea un movimiento que el borrado físico no alcanza.

### Resumen de causas y prioridad

| # | defecto | tipo | impacto |
|---|---|---|---|
| A | `aggregateBalance` sin filtro de liveness | código (defensa) | cards Balance/Activos/Patrimonio infladas |
| B | 2 huérfanos en pruebas2 (150.000 COP) | datos | lo que el usuario ve hoy |
| C | ids UUID de dominio descartados → refId mismatch | **arquitectura (raíz)** | ventas/créditos nuevos siguen generando huérfanos |

## R7.3 — Plan propuesto (NO implementado; requiere aprobación)

Se plantea en 3 unidades, de menor a mayor alcance. **Todas preservan aislamiento por `userId` y arquitectura hexagonal** (core sin importar infra).

- **R7-A (defensa de lectura — fija las cards en todos los usuarios):** que el dashboard derive los balances de cuenta desde los **movimientos ya filtrados por P1** (`filterMovementsWithLiveParents`) en lugar de `aggregateBalance` crudo. Reemplaza la fuente de verdad de `accountBalances` (que alimenta Balance total y `computeActivosPasivos`) por una suma por cuenta de los movimientos vivos. Bajo riesgo, no toca infra ni `aggregateBalance` para otras páginas (accounts page). Requiere tests + ajuste de page.tsx.
- **R7-B (raíz — ids generados directamente en Mongoose/ObjectId):** corregir la generación de ids para que el `_id` real sea la identidad desde el principio, eliminando el UUID descartado. Dos sub-opciones (a documentar/especificar antes de ejecutar):
  - **B1 (cirugía acotada):** en los use cases que crean padres con movimientos vinculados (`create-sale`, `create-credit-granted`, `create-credit-received`, `create-transfer`), **capturar el ObjectId real** que devuelve el repo tras `create(...)` y usarlo para el `link.refId` del movimiento (reordenar creación: padre → capturar id real → movimiento). Elimina el mismatch para datos futuros sin migrar dato alguno. Riesgo medio, alcance acotado.
  - **B2 (refactor de arquitectura, grande):** eliminar `randomUUID()` del dominio y generar/inyectar ObjectId como id de entidad en todas las entidades. Cambio masivo (todas las entidades, use cases, tests, refs), requiere migrar todos los refs UUID existentes. Alto riesgo; solo bajo aprobación explícita.
  - Recomendación: **B1** (raíz suficiente para detener nuevos huérfanos, mínimo riesgo); B2 queda como deuda técnica a evaluar por separado.
- **R7-C (datos):** limpiar los 2 huérfanos de `pruebas2` con `scripts/clean-orphan-movements.mjs` (borrado, no relink — son ventas efectivamente eliminadas). Requiere confirmación (operación sobre Atlas).

**Criterios de éxito:** tras R7-A+C, las cards Balance total / Activos / Patrimonio de `pruebas2` coinciden con la suma de movimientos visibles; sin huérfanos en la DB. Tras R7-B, una venta nueva eliminada **no** deja movimiento (cascada por ObjectId la borra), verificable con un test de integración del use case.

## R7.4 — Reglas respetadas en la auditoría

Auditoría 100% de solo lectura (sin writes de código ni mutación de DB). Multi-tenancy intacto (`userId` en todas las queries/acciones). Archivos revisados: `movement-repository.ts`, `compute-activos-pasivos.ts`, `ports.ts`, `mappers/movement.ts`, `mappers/sale.ts`, `sale-repository.ts`, `create-sale.ts`, actions (12), modelos `movement.ts`/`sale.ts`. No se ejecutó ninguna operación de escritura contra Atlas.

## R7.4 — Implementación completada (2026-08-28): R7-A + R7-B

**R7-B (raíz — ids nuevos como ObjectId persistidos como `_id`, mata los UUID):**
- Nuevo `src/infrastructure/config/id-generator.ts` → `objectIdGenerator: IdGenerator` que devuelve `new Types.ObjectId().toString()`.
- 11 server actions reemplazaron `const ids = { generate: () => crypto.randomUUID() }` por `const ids = objectIdGenerator`.
- 6 repos del Grupo B persisten `_id: entity.id` SOLO en su método `create` (NO en el mapper `toXxxDocData`, porque `update` lo reusa con `$set` y Mongo no permite mutar `_id`): `MovementModel.create({ ...docData, _id: movement.id })` en movement/sale/credit-granted/credit-received/payable/transfer. Así `link.refId`/`saleId`/`movementId` SIEMPRE coinciden con el `_id` real del padre → `deleteSale` (por ObjectId) ya no deja huérfanos. El Grupo A (Account/Category/CatalogItem/Client/User) NO se tocó (sus ids se referencian como ObjectId y ya son consistentes).
- Decisión de formato (con usuario): **ObjectId nuevo** (no UUID persistido). Datos legacy no se migran (conviven; todo el código los trata como string).

**R7-A (defensa — dashboard deja de inflarse con huérfanos):**
- Nuevo use case puro `accountBalancesFromMovements` (`src/core/application/movements/balance-from-movements.ts`, exportado desde el index) que suma `signedAmount` por `accountId` sobre una lista YA filtrada por liveness.
- `dashboard/page.tsx` ahora deriva `accountBalances` desde `liveMovements` (movimientos que pasaron el filtro P1) en vez de `movementRepo.aggregateBalance` crudo. Con esto Balance total / Activos / Patrimonio (Posición financiera) excluyen huérfanos.
- 4 tests nuevos en `balance-from-movements.test.ts` (suma por cuenta, cuenta sin movimientos → Map contract, exclusión de huérfano salePayment, reconciliación por valor de salePayment legacy).
- Suite **517/517** (48 archivos), `tsc --noEmit` limpio, `pnpm build` OK.

**R7-C (datos, APLICADO 2026-08-28 con confirmación del usuario):** dry-run de `scripts/clean-orphan-movements.mjs` sobre la DB completa detectó **0 relinks** y **2 huérfanos** (ambos de `pruebas2@mail.com`: `6a91aff0c9453e006659c122` salePayment 100.000 COP y `6a91b04938326c01557efc91` salePayment 50.000 COP, ventas ya eliminadas). Con `--apply` se borraron esos 2. **Idempotencia verificada: 0/0** (sin huérfanos ni relinks pendientes en toda la DB). No hubo ningún otro huérfano en ninguna cuenta.

**Estado: Ronda 7 (R7-A + R7-B + R7-C) COMPLETA.**

## R7.5 — Reglas respetadas en la implementación

Arquitectura hexagonal intacta: el helper `accountBalancesFromMovements` está en `core/application` (puro, sin dependencias de infra); el generador ObjectId está en `infrastructure` (implementación concreta del puerto `IdGenerator`); los repos viven en infra. Multi-tenancy preservado (todo scoped por `userId`). NO se ejecutó ninguna escritura contra Atlas (R7-C pendiente). i18n / principios financieros / stack intactos.

---

# RONDA 9 — CRÉDITOS OTORGADOS: AMORTIZACIÓN CAPITAL/INTERÉS + BAJA POR INCOBRABLE

Iniciada: 2026-08-29 · Fuente: decisión del usuario sobre créditos otorgados (aplica SOLO al contexto financiero Personal standalone; ventas a crédito quedan intactas — opción 1 del usuario).

## R9.1 — Contexto y regla de negocio aprobada

El usuario confirmó la regla para **créditos otorgados standalone (Personal, sin `saleId`)**:

- **Regla de amortización (capital primero):** cada abono **amortiza primero el principal** (capital prestado); SOLO el excedente sobre el principal (interés) es ingreso real. Reconocimiento cronológico: si el acuerdo es devolver exactamente lo prestado, TODO el flujo es recuperación de capital y NO genera ingreso.
- **Baja por incobrable (write-off):** nueva acción manual en créditos otorgados. Ante deudor que no paga o no termina de pagar: (1) registra un **GASTO real** por el **capital NO recuperado** (`principal` − Σ porciones de capital amortizadas); (2) elimina el `pending` del activo (ya no es cuenta por cobrar); (3) el **interés no realizado NO es pérdida** (nunca fue ingreso) — simplemente deja de existir. La pérdida aparece en "Gastos del mes" del mes en que se da de baja.
- **NO aplica a ventas a crédito (Business/sale-born):** sus abonos conservan el tratamiento actual (`creditGrantedAbono` = ingreso completo, vía flujo `addSaleAbono` con kind `salePayment`).
- **NO aplica a créditos recibidos:** sus abonos siguen siendo gasto (dinero que sale al banco) — sin cambios.

## R9.2 — Auditoría del estado actual (2026-08-29, solo lectura)

Verificado por lectura directa (mapper `explore` + archivos clave):

1. **No existe desglose capital/interés en ningún nivel.** `CreditGranted.totalToPay = installmentValue × installments` mete el interés implícito EN el abono; cada abono se registra como UN movimiento `income` `creditGrantedAbono` por el **monto total** (`add-abono.ts` líneas 56–68). `pending = totalToPay − Σ abonos`.
2. **`MOVEMENT_LINK_KINDS`**: 9 kinds (const array + unión derivada + guard `isMovementLinkKind`): opening, transfer, creditReceivedPrincipal, creditReceivedAbono, creditGrantedPrincipal, creditGrantedAbono, salePayment, payableInitialPayment, payableAbono. `MovementLink = { kind, refId, opId }` (sin campos extra). `Movement.context`: `"Personal" | "Business"` opcional, serializado en `toJSON()`.
3. **Rutas separadas verificadas:**
   - Créditos standalone: `add-abono.ts` de `credits-granted` (context **Personal**, kind `creditGrantedAbono`).
   - Ventas a crédito: `add-sale-abono.ts` de `sales` (context **Business**, kind **`salePayment`**, NUNCA `creditGrantedAbono`). El crédito sale-born solo se abona vía su venta. → Cambiar `creditGrantedAbono` para standalone **NO toca** ventas.
4. **`mark-as-paid.ts`** reusa `addAbono` con el `pending` exacto (heredará el split automáticamente). **`edit-abono.ts`** actualiza el movimiento vinculado por `movementId`; **`delete-abono.ts`** borra movimiento + `$pull`. Con split, ambos deben manejar los movimientos de capital e interés.
5. **Repositorio `CreditGrantedRepository`**: sin método de cierre/estado — el estado se deriva de `pending`. `addAbono` es `$push` atómico idempotente por `movementId`. No hay campo `status` en modelo ni entidad.
6. **`economic-result.ts`** (R8): `NON_ECONOMIC_LINK_KINDS` = `{transfer, opening, creditReceivedPrincipal, creditGrantedPrincipal}`; `creditGrantedAbono` cuenta como ingreso (idéntico Personal/Business). El nuevo capital recuperado debe quedar FUERA y la nueva porción interés DENTRO.
7. **Categorías sintéticas**: ids fijos (credit `...001`, creditGranted `...002`, transfer `...003`, sale `...004`, opening `...005`, payable `...006`), resolución por `id+type`, `creditGrantedCategory('income'|'expense')` reusa la `...002`. El write-off puede reusar `creditGrantedCategory('expense')` sin categoría nueva.
8. **UI**: patrón a replicar = `mark-as-paid-button.tsx` (client → action → toast → `router.refresh()`) + `markAsPaidAction` en `actions.ts` (getCurrentUser → connectDb → repos → use case → `revalidateMovementData`). `pending` se deriva del snapshot serializado; badge "pagado" cuando `pending <= 0`. No existe badge de estado para incobrable.
9. **Posición financiera** (`compute-activos-pasivos.ts`): `activos += CreditGranted.pending` si `pending > 0`. El write-off debe excluir el crédito del activo.

## R9-H1 — Bug del usuario: cuentas con saldo inicial no se eliminan (2026-08-29)

**Reporte:** las cuentas creadas CON saldo inicial no pueden eliminarse; las creadas sin saldo sí.

**Auditoría (solo lectura):** `deleteAccount` (`delete-account.ts`) bloquea cuando `countReferences > 0`. `MongoAccountRepository.countReferences` cuenta `MovementModel.countDocuments({ userId, accountId })` — es decir **TODOS** los movimientos de la cuenta. `createAccount` con `initialBalance > 0` crea un movimiento `opening` con `accountId = accountId` y `link.refId = accountId` → esa cuenta SIEMPRE tiene 1 "referencia" → `deleteAccount` la rechaza con `ConflictError('Account has references...')`. Cuenta sin saldo → 0 movimientos → se borra sin problema.

**Causa raíz:** el movimiento `opening` es **intrínseco de la cuenta** (su propia creación, análogo a `salePayment` con la venta o `creditGrantedPrincipal` con el crédito), NO una referencia externa. El guard ACC-4 debe contar SOLO referencias reales (movimientos manuales income/expense, transfer legs, créditos, ventas, payables), nunca el opening propio. Además, siguiendo el patrón de cascada existente (deleteSale/deleteCreditGranted borran sus movimientos vinculados), **la cuenta debe borrar su/los opening en cascada** — dejarlo huérfano inflaría balances (bug R6/R7 que ya se corrigió).

**Fix propuesto (Fase A):**
- `countReferences`: excluir movimientos `opening` de la cuenta → filtro `{ userId, accountId, 'link.kind': { $ne: 'opening' } }` en el count de movements. Las demás referencias (transfers, créditos, ventas, payables) siguen bloqueando.
- `deleteAccount`: acepta `movementRepo`; encuentra los openings vía `movementRepo.findByAccountId` + filtro `link.kind === 'opening'` y los borra con tolerancia (NotFoundError → continuar); luego borra la cuenta (orden movimiento-primero, patrón R5-B). Cuenta con movimientos manuales o referencias reales sigue bloqueada por ACC-4.
- Action `deleteAccountAction`: instancia `MongoMovementRepository` y lo pasa (ya revalida `/movements` y `/dashboard`).
- Tests: cuenta con solo opening → se elimina (cuenta + movimiento); cuenta con opening + movimiento manual → bloqueada; fixed → ValidationError; countReferences ya no cuenta openings.

## R9-H2 — Gap del usuario: no se puede establecer saldo inicial a la cuenta fija "Efectivo" (2026-08-29)

**Reporte:** la cuenta "Efectivo" (única fija por defecto del seed) no tiene opción para establecerle saldo inicial.

**Auditoría (solo lectura):**
- `seedUser` (`user-bootstrap.ts`) crea la cuenta fija Efectivo **sin ningún movimiento** (no pasa por `createAccount`; no tiene opening). Para usuarios nuevos, su única cuenta queda en 0 sin forma de cargarle el efectivo real inicial.
- `createAccount` acepta `initialBalance > 0` y crea el opening, pero **solo al crear una cuenta nueva**. La Efectivo ya existe desde el registro → el camino `initialBalance` no le aplica.
- `updateAccount` solo permite cambiar `name` (ACC-2 currency inmutable; no toca saldo).
- No existe ningún use case/UI para **asignar saldo inicial a una cuenta existente** (grep: `initialBalance` solo en `create-account.ts` + form de creación).

**Diseño propuesto (Fase B):**
- Nuevo use case puro `setInitialAccountBalance(userId, accountId, amount, accountRepo, movementRepo, ids)`: valida cuenta existe; `amount > 0` (ValidationError si <= 0); la cuenta debe estar "limpia" → `accountRepo.countReferences(userId, accountId) === 0` (misma definición de "sin historial" que ACC-4; incluye la Efectivo recién registrada, excluye cualquier cuenta con movimientos/referencias reales); crea el movimiento `opening` con el MISMO patrón de `createAccount` (income, `openingCategory()`, context Personal, `link: { kind: 'opening', refId: accountId, opId }`) usando la currency de la cuenta. Reutiliza la cascada de Fase A: si luego se borra la cuenta, el opening se limpia.
- Action server `setInitialBalanceAction` (`'use server'`, auth → connectDb → repos → use case → revalidate `/accounts`, `/dashboard`, `/movements`).
- UI: en `accounts/page.tsx`, mostrar acción "Establecer saldo inicial" solo para cuentas SIN movimientos — derivable sin queries extra: `!balances.has(account.id)` (getUserBalances solo agrega cuentas con movimientos). Modal con input de monto (patrón AccountForm) + toast + refresh. Visible también para la cuenta fija Efectivo (es el caso objetivo).
- i18n es/en nuevas keys (`setInitialBalance`, `setInitialBalanceDescription`, `balanceToSet`, `initialBalanceSet` toast, etc.). Español neutro.
- Tests: use case (setea sobre cuenta limpia + Efectivo fija; rechaza ya-con-movimientos/referencias; rechaza monto <= 0; not found); action; UI smoke si aplica.

## R9.3 — Plan propuesto (NO implementado; requiere aprobación)

### Decisiones de diseño (D9.1–D9.4)

- **D9.1 — Split en el origen (uso de casos), no en lectura:** el desglose capital/interés se computa cuando se crea/edita el abono, en `add-abono.ts`, porque ahí se tiene el crédito completo (principal + abonos previos en orden cronológico). Los agregadores del dashboard siguen filtrando por `link.kind` (arquitectura R8 intacta).
- **D9.2 — Tres kinds nuevos:**
  - `creditGrantedAbono` **cambia de significado para standalone** → ahora representa SOLO la porción de **capital recuperado** (no económico) en créditos standalone. Ventas/Business siguen usando `salePayment`; el kind `creditGrantedAbono` queda exclusivamente para el flujo standalone (Personal).
  - `creditGrantedAbonoInterest` (NUEVO, income, **económico**) → porción de interés del abono.
  - `creditGrantedWriteOff` (NUEVO, expense, **económico**) → gasto por baja incobrable (capital no recuperado).
  - La exclusión de `creditGrantedAbono` del resultado (para standalone) se hace por kind en `NON_ECONOMIC_LINK_KINDS`.
- **D9.3 — Amortización cronológica pura (helper `splitAbonoCapitalInterest`):** para cada abono del crédito (en orden), `capitalPortion = min(abono, principal − capitalRecoveredSoFar)`; `interestPortion = abono − capitalPortion`. `capitalRecoveredSoFar = Σ capitalPortion de abonos previos`. El abono embedded conserva su `amount` total (para `pending`/totalToPay) y gana `interestAmount?`/`capitalAmount?` informativos.
- **D9.4 — Write-off:** nuevo use case `writeOffCreditGranted` — valida crédito existe, NO sale-born (`ConflictError` con el mismo mensaje que delete), no ya incobrable (`pending > 0`); calcula `capitalLost = principal − Σ capitalPortion de abonos` (NO usa `pending`, que incluye interés no realizado); crea movimiento `creditGrantedWriteOff` (expense, Personal, categoría sintética `creditGranted`) por `capitalLost`; **marca el crédito como incobrable** → nuevo campo `writtenOff?: { date, movementId }` en entidad/modelo; `computeActivosPasivos` excluye `writtenOff` del activo. Posición Financiera ya no muestra el pending como activo; el historial del mes de la baja muestra el gasto.

### Fases

| Fase | Contenido |
|------|-----------|
| **A — Fix: eliminar cuentas con saldo inicial (R9-H1)** | `countReferences` excluye movimientos `opening` (`'link.kind': { $ne: 'opening' }`); `deleteAccount` acepta `movementRepo` y borra en cascada los openings (tolerante, orden movimiento-primero); `deleteAccountAction` pasa el repo; tests (solo opening → elimina; opening + movimiento manual → bloquea; fixed → ValidationError; countReferences sin openings). |
| **B — Saldo inicial para cuenta existente (R9-H2)** | Nuevo use case `setInitialAccountBalance` (cuenta existe; `amount > 0`; cuenta limpia vía `countReferences === 0`; crea opening con el MISMO patrón de `createAccount`); action server `setInitialBalanceAction` con revalidación `/accounts` `/dashboard` `/movements`; UI: acción "Establecer saldo inicial" en `accounts/page.tsx` para cuentas sin movimientos (`!balances.has(account.id)`), modal con monto (patrón AccountForm); i18n es/en; tests use case + action. |
| **C — Dominio + kinds** | `MOVEMENT_LINK_KINDS` += `creditGrantedAbonoInterest`, `creditGrantedWriteOff` (+ guard). Helper puro `splitAbonoCapitalInterest` (`core/application` o `domain`). `CreditGranted`: campos `interestAmount?`/`capitalAmount?` por abono + `writtenOff?`; toJSON. `economic-result.ts`: `creditGrantedAbono` → NON_ECONOMIC + `creditGrantedAbonoInterest`/`creditGrantedWriteOff` económicos. Tests del helper + economic-result. |
| **D — Use cases granted** | `add-abono.ts`: split y 1–2 movimientos (solo capital, solo interés, o ambos) con `context: Personal`, `opId` nuevo por movimiento; `mark-as-paid` hereda. `edit-abono.ts`/`delete-abono.ts`: manejar movimientos de capital + interés (update/delete ambos). `writeOffCreditGranted` nuevo + action `writeOffCreditAction`. Actualizar fakes y tests. |
| **E — Infra + posición financiera** | Modelo `credit-granted.ts`: campos `interestAmount?`/`capitalAmount?` en abono + `writtenOff?` padre; mapper ida/vuelta. `compute-activos-pasivos.ts`: filtro `writtenOff`. Sujeto a alcance: edición/borrado de abonos con split (mismo `movementId` vs dos movimientos). |
| **F — UI + i18n** | Botón "Dar de baja" (`WriteOffButton`, patrón MarkAsPaid, variant danger + confirm dialog) visible solo si `pending > 0 && !saleId && !writtenOff`; badge "Incobrable"/"Written off"; ocultar/deshabilitar agregar abono / marcar pagado / editar / borrar cuando `writtenOff`; mostrar porciones capital/interés en el detalle si aplica; keys i18n es/en (`writeOff`, `writeOffConfirm`, `writtenOff`, `creditWrittenOff` toast). Tests de acciones/ui. |
| **G — QA + docs** | Suite completa + tsc + build. Actualización de este documento (estado, bitácora) y `AGENTS.md` si aplica (principios financieros). |

### Criterios de éxito

1. Crédito standalone presta 100.000, 2 cuotas de 55.000: abono 1 → 100% capital (no ingreso); abono 2 → 45.000 capital (no ingreso) + 10.000 interés (ingreso). Dashboard: ingreso = 10.000, no 110.000.
2. Acuerdo sin interés (totalToPay = principal): todos los abonos recuperación de capital, ingreso = 0.
3. Write-off con deudor que no pagó nada: gasto = principal completo; `pending` desaparece del activo; interés no realizado NO genera gasto adicional.
4. Write-off con deudor que pagó 55.000 de 100.000: gasto = 45.000 (no 55.000 ni el pending con interés).
5. Ventas a crédito y créditos recibidos: comportamiento completamente intacto (suite existente verde).
6. **(R9-H1)** Una cuenta creada CON saldo inicial y sin movimientos manuales puede eliminarse (el movimiento `opening` se borra en cascada; ya no bloquea). Una cuenta con movimientos manuales/transferencia/crédito/venta/payable sigue bloqueada. El dashboard no queda con movimientos huérfanos tras la eliminación.
7. **(R9-H2)** Un usuario nuevo puede establecer el saldo inicial de su cuenta fija "Efectivo" (y de cualquier cuenta sin movimientos) desde `/accounts`: aparece el movimiento `opening`, el saldo de la cuenta y del dashboard se actualizan, y el botón desaparece al existir movimientos. Una cuenta con movimientos/referencias NO ofrece la opción.

---

## PROTOCOLO POST-COMPACTACIÓN

Si el contexto se compacta o inicia nueva sesión:

1. **Leer este archivo completo** (`docs/AUDIT-AND-PLAN.md`)
2. **Leer `AGENTS.md`**
3. **Buscar en Engram:** `mem_search(query: "TwinCap", project: "twincap")`
4. **Identificar el estado actual** — Rondas 1–5 completadas. **Ronda 6 COMPLETADA (P1–P5, 2026-08-28).** **Ronda 7 COMPLETADA (2026-08-28):** R7-A (dashboard deriva balances de movimientos filtrados P1) + R7-B (ids ObjectId persistidos como `_id`, mata los UUID/duplicación) + R7-C (2 huérfanos de pruebas2 limpiados en Atlas, idempotencia 0/0) — TODO implementado y verificado (517/517, tsc, build). **Ronda 8 COMPLETADA (2026-08-28):** capital financiero fuera del resultado económico (`economic-result.ts` centralizado) + card "Flujos de financiamiento"; suite **536/536**, tsc, build; commits `f11c1b8`, `799aef8`, `dbd60e2`, `15f81cb`, `454f2fa`. **Ronda 9 APROBADA Y EN CURSO (2026-08-29):** créditos otorgados — amortización capital primero + solo excedente = ingreso + acción "dar de baja crédito incobrable" + R9-H1 (fix cuentas con saldo inicial) + R9-H2 (saldo inicial para cuenta existente/Efectivo). Plan aprobado; **Fases A–E completadas (A: fix R9-H1 commits `36998a1`+`64014dc`; B: R9-H2 commits `bc0d260`+`4fafa89`; C: dominio+kinds, suite 564/564, push `4757080`; D: use cases granted, suite 586/586, push `a8a5a70`; E: posición financiera, suite 589/589). Siguiente: Fase F (UI + i18n).** Deuda técnica acumulada: R4-A1 (performance), R4-A2 (multi-moneda), R6-P6 (soft-delete vestigial).
5. **Esperar aviso del usuario para implementar la siguiente fase**

---

## BITÁCORA

- 2026-08-19 — Creación del plan maestro (Ronda 1, 12 fases identificadas).
- 2026-08-20 — Ronda 1 completada: fases 0–22 ejecutadas y commiteadas.
- 2026-08-21 → 2026-08-23 — Ronda 2 completa: auditoría Fase 0 (H1–H20 + P1–P13), plan definitivo de 10 fases, fases 1–10 implementadas y commiteadas (ver tabla histórica arriba). Post-ronda: rebranding PWA + logo in-app definitivo. Detalle fase a fase: git history de este documento.
- 2026-08-24 — **Reescritura del documento para la RONDA 3** (fuente: `TwinCap Ronda 3.md`, aportada por el usuario con especificaciones estructuradas). **Fase 0 completada:** auditoría técnica del código real mediante 6 exploraciones paralelas de solo lectura. Causas raíz verificadas HR3-01…26 + 16 hallazgos adicionales (R3.6). Claves: bug de fechas = medianoche UTC + formatter sin timezone (desplazamiento −1 día universal); leak confirmado de transferencias en resultados del dashboard (balances correctos); mecanismo exacto del gráfico comprimido por flex-shrink; doble COP = concatenación sobre salida currency-styled ×15 sites; síntoma de invalidación = caché one-shot del GlobalMovementProvider (las actions SÍ revalidaban); autoComplete de login roto bajo español; colisión real logo/botón-cerrar en drawer móvil; temas sin tokens de superficie (355 pares dark: manuales). Plan definitivo de 12 fases propuesto (R3.12) + 8 decisiones de dominio para aprobación (R3.7). AGENTS.md actualizado: principios financieros permanentes, español neutro, textos automáticos localizables, corrección de la descripción del proxy (no hace auth). ~~ESPERANDO APROBACIÓN del usuario~~.
- 2026-08-24 (mismo día) — **PLAN APROBADO por el usuario**, decisiones D1–D8 según recomendación, sin ajustes solicitados. Requerimiento adicional incorporado: **orden cronológico descendente en tablas** (fecha + hora, más recientes arriba, desempate al segundo dentro del mismo día) → registrado como HR3-27, asignado a F5 con criterios de aceptación propios. **Inicio de FASE 1** (corrección financiera fundamental).
- 2026-08-24 (mismo día) — **FASE 1 COMPLETADA** en 4 unidades de trabajo commiteadas: WU1 `9ac8ea4` convención de fechas civiles (`formatDate` fija `timeZone:'UTC'`; nuevo `src/lib/date.ts` con `toDateInputValue` local / `businessDateToInputValue` UTC para prefills de edición; TZ America/Bogota fijada vía `env.TZ` del config de vitest — setupFiles solo no alcanza porque los workers ya arrancaron; bucketing mensual UTC explícito); WU2 `93aaf48` use case `compute-dashboard-summary` excluye transferencias (ambas piernas) y opening de ingresos/gastos, créditos/ventas/payables conservan tratamiento (semántica D2 congelada en tests); WU3 `c7edd57` track del gráfico `flex-1 min-w-0` con labels fuera del track proporcional (9M vs 6M ⇒ ~98px vs ~66px a 260px); WU4 `cb7cd46` formateo monetario unificado (~22 concatenaciones `{currency}` eliminadas en 13 componentes; duplicados dashboard/accounts/sale-form eliminados). Suite final 358/358 en 36 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador. Desvíos justificados: prefills de edit-dialogs usan getters UTC (fechas almacenadas) mientras "hoy" usa getters locales; filtro de mes de las cards movido a igualdad de clave UTC (corrige exclusión del día 1 en Bogota). Observaciones fuera de alcance registradas para sus fases: label `(COP)` de abono-form (contexto field-label), silent `?? 'COP'` sale-list (F5), caché one-shot GlobalMovementProvider (F6), cargas completas (F4).
- 2026-08-25 — **FASE 12 COMPLETADA** — Cierre de Ronda 3. Auditoría transversal §6: 0 CRITICAL, 7 MINOR (no bloqueantes). (1) Arquitectura: hexagonal verified, 2 minor imports core→infra in auth; (2) Seguridad: tenant isolation, JWE, bcrypt, env validation — all green; (3) i18n: 21 namespaces, paridad es/en, sin voseo; (4) Responsive: 375/768/1280 verified; (5) Accesibilidad: aria-labels, focus, Escape, contrast — all green; (6) Testing: 412/412 tests, 42 archivos; (7) tsc limpio. Fixes de usuario incluidos en la ronda: sort por fecha de movimiento, logout confirmation, select placeholders "Seleccionar", transición theme suave 0.3s, badge "Pagado" en créditos pagados, payables mobile column fix. **RONDA 3 CERRADA.**
- 2026-08-25 — **FIXES DE USUARIO** (`a7ce152`, 16 archivos). Mejoras solicitadas directamente: (1) Sort por fecha de movimiento en vez de createdAt; (2) ConfirmDialog en logout del sidebar; (3) Payables mobile: min-w-[140px] en columna acreedor; (4) 9 forms con placeholder "Seleccionar" para prevenir submits accidentales; (5) Transición CSS suave 0.3s al cambiar tema (clase añadida post-render para evitar FOUC); (6) Créditos pagados: opacity-60 + badge verde "Pagado"/"Paid".
- 2026-08-25 — **FASE 11 COMPLETADA** (`f962775`, 10 archivos). PWA final (HR3-22/23, A16, D7): (1) 6 iconos regenerados desde `isotipo_twincap_ok.png` transparente con fondo oscuro `#0f172a` (slate-900) — icon-192/512 normales (65% content), icon-maskable-192/512 (74% safe area), apple-touch-icon 180×180, favicon-32; (2) `manifest.json`: `background_color` y `theme_color` → `#0f172a` (antes `#ffffff`/`#6366f1`); (3) `layout.tsx`: meta `theme-color` → `#0f172a`; (4) SW cache bump `v5→v6` para invalidar iconos cached; (5) `splash_screens/icon.png` regenerado con mismo fondo. Sin flash blanco en launchers oscuros. Splash screens de dispositivo (44 variantes iOS) regeneradas por el usuario externamente.
- 2026-08-26 — **INICIO RONDA 4** — Rediseño y evolución del Dashboard financiero (fuente: `Ronda4.md`). Plan maestro actualizado. Documento: este archivo. **FASE A completada:** auditoría de solo inspección del Dashboard actual. Hallazgos: A1 persiste (carga completa sin límite), A2 persiste (exclusiones silenciosas cross-currency en summary cards), sin componente Table UI (hand-rolled HTML), bug Card border-radius (inner header sin radius), dead prop yearlyData, yearly chart ignora filtros, sin rutas de reportes, columna categoría ausente en Movements, 1 aria-label hardcodeado inglés. Plan ajustado: 6 fases (A–F) con dependencias documentadas.
- 2026-08-26 — **FASE B COMPLETADA** — Rediseño estructural del Dashboard (10 archivos, 2 nuevos). (1) Card fix: `overflow-hidden` en wrapper soluciona bug de border-radius del header; (2) SummaryCards: 4 métricas (Balance, Ingresos, Gastos, Patrimonio) en `grid-cols-2 lg:grid-cols-4`; (3) DashboardContent: jerarquía reordenada (filtros → indicators → accounts → reports grid → chart → position), prop `yearlyData` eliminada (dead), `netPosition` derivado de `positionData`; (4) ReportCard + DashboardReportsGrid: grid de 6 reportes clicables (Movimientos, Transferencias, Créditos Recibidos/Otorgados, Payables, Ventas) con icons Lucide, hover/focus/a11y; (5) i18n: 8 keys nuevas en es/en (reports + report* + removeFilter); (6) dashboard-filters: 4× aria-label i18n; (7) page.tsx: limpieza de imports muertos. Suite 412/412, tsc limpio. Commit `cd1bdd2`.
- 2026-08-26 — **FASE C COMPLETADA** — Resumen de ingresos/gastos por categoría (7 archivos, 3 nuevos). (1) `computeCategorySummary` use case: agrupa movimientos por categoryId, excluye transfer/opening, ordena por monto DESC, retorna income/expense separados + totales; (2) `SummaryTable` component: header fijo + body scrolleable (`max-h-[300px] sm:max-h-[400px]`) + footer fijo con TOTAL, grid `grid-cols-[1fr_auto]`, empty state; (3) DashboardContent: dos tablas lado a lado (`lg:grid-cols-2`) — Resumen de Ingresos + Resumen de Gastos, derivadas de `filteredMovements` (respeta filtros composables); (4) 9 tests nuevos (transfers excluded, multi-currency, sorting, empty, mixed); (5) i18n: 8 keys nuevas (incomeExpenseSummary, incomeSummary, expenseSummary, summaryCategory, summaryAmount, total, noIncomeData, noExpenseData). Suite 421/421, tsc limpio. Commit `80dd92c`.
- 2026-08-26 — **FASE D COMPLETADA** — Integración y comportamiento de filtros (2 archivos modificados). (1) Fix: `computeYearlyEvolution` ahora recibe `filteredMovements` en vez de `allMovements` — el gráfico anual respeta scope/account/category/period; (2) 7 tests nuevos de filtros combinados sobre `computeCategorySummary` (sorting, multi-currency, transfers excluded, opening excluded, empty, category ID preservation). Verificación: todas las métricas filtrables (ingresos, gastos, tablas, gráfico mensual/anual, movimientos recientes) responden correctamente a los 4 filtros composables. Activos/Pasivos se mantienen independientes de filtros de actividad (correcto por diseño). Multi-moneda: honesto (sin FX), solo muestra moneda del scope activo. Suite 428/428, tsc limpio. Commit `5dea992`.
- 2026-08-26 — **FASE E COMPLETADA** — Movimientos responsive (2 archivos modificados). (1) Reorden de columnas: Date → Amount → Category → Note → Type → Actions (§20); (2) Nueva columna Category con resolución real + synthetic categories (§22); (3) Responsive: mobile (375px) muestra Date/Amount/Type/Actions, tablet (768px) agrega Category, desktop (1280px) todas las 6 columnas (§21); (4) Server component page.tsx ahora carga categories y las pasa a MovementsList; (5) Accessibility: `scope="col"` en todos los `<th>`. Suite 428/428, tsc limpio. Commit `10d6e0b`.
- 2026-08-26 — **FASE F COMPLETADA — RONDA 4 COMPLETADA** — QA final. Verificaciones: (1) `pnpm test`: 428/428 tests pasan (43 archivos); (2) `tsc --noEmit`: limpio; (3) `pnpm build`: exitoso (todas las rutas compiladas); (4) i18n paridad: Dashboard (50 keys), Movements (35 keys), Common (22 keys) — todos con paridad EN/ES completa; (5) Sin texto hardcodeado en 10 componentes auditados; (6) Dark/light mode: surface tokens y zinc colors consistentes en todos los componentes nuevos. **Resumen de Ronda 4:** 6 fases (A→F), ~15 archivos modificados/creados, 4 commits (`cd1bdd2`, `80dd92c`, `5dea992`, `10d6e0b`). Nuevos: `computeCategorySummary` (use case), `SummaryTable` (component), `ReportCard` + `DashboardReportsGrid`. Fixes: Card overflow-hidden, yearly chart filtered. Movements: columna Category + responsive. Suite: 428/428 → tsc limpio → build exitoso.
- 2026-08-25 — **FASE 10 COMPLETADA** (`9e5eab8`, 14 archivos). Perfil de usuario mínimo (D5, HR3-21): (1) Entidad User: campos `name?`/`locale?` agregados (backward-compatible, `toJSON()` incluido); (2) Mongoose model + mapper actualizados; (3) Página `/profile` con 2 Cards: info personal (nombre, email disabled, Select idioma) y cambio contraseña (actual + nueva + confirmar, bcrypt verify); (4) Server actions: `updateProfileAction` (name+locale), `changePasswordAction` (bcrypt compare → hash → update); (5) Dashboard saludo personalizado "Bienvenido, {name}" cuando tiene nombre; (6) Nav sidebar: link "Mi perfil" con icono User en sección inferior; (7) i18n namespace Profile en es/en. 412/412 tests (5 nuevos), tsc limpio.
- 2026-08-25 — **FASE 9 COMPLETADA** (commits `14c76d5` + `fddf567`, 34 archivos, +194/−76). Tema claro/oscuro completo (D6, HR3-20, A15): (1) CSS foundation — `@media (prefers-color-scheme: dark)` → class-based `.dark` via `@custom-variant dark (&:where(.dark, .dark *))`; `color-scheme: light dark` en `:root` para formularios nativos; (2) Anti-flash script inline en `<head>` lee `localStorage('twincap-theme')` antes del paint; `suppressHydrationWarning` en `<html>`; (3) `ThemeProvider` (React context) con 3 modos `light|dark|system`, persistencia localStorage, listener OS media query; (4) Theme toggle Sun/Moon en nav sidebar (auth + guest) — 3-state cycle; (5) Surface tokens: `--tc-surface-{bg,card,border,muted,input,overlay}` con valores light/dark; (6) Token unificación: Button primary `bg-indigo-600→bg-primary`, Toast info `bg-indigo-600→bg-info`, focus rings `ring-indigo-500→ring-primary` en input/select/password-input/searchable-select/action-icon-button; FAB `bg-indigo-600→bg-primary`; nav active `bg-indigo-50 text-indigo-700→bg-primary/10 text-primary`; (7) UI kit dark: pairs → surface tokens (card, input, select, modal, badge, skeleton, empty-state); (8) Toast warning contrast `text-white→text-zinc-900` (WCAG); (9) Migración completa de 18 componentes de página (listas, edit forms, auth, landing) — solo hero.tsx gradient intencional y `hover:bg-indigo-50` en button inverse retenidos. Suite 407/407, tsc limpio. **Fase 9 = HR3-20 completada.**
- 2026-08-25 — **FASE 8 COMPLETADA** (`3693d55`, 20 archivos, +144/−111). Branding, landing y navegación (HR3-17/18/19, A5/A6/A10): (1) Hero — `<h1>TwinCap</h1>` hardcodeado reemplazado por `{t('heroTitle')}` (i18n); variante `inverse` agregada a Button (elimina className overrides `bg-white text-indigo-700` en hero); (2) 14 CTAs hand-rolled `bg-indigo-600 px-4 py-2...` reemplazados por `<Button variant="primary" size="sm">` en 14 archivos (accounts, categories, clients, movements, transfers, credits×2, payables, catalog, sales, nav guest login, edit-abono×3); (3) EmptyState adoption en accounts y categories pages (antes hand-rollaban markup idéntico al componente); (4) Sidebar agrupada: NAV_ITEMS plano → NAV_GROUPS con 4 secciones (General/Finanzas/Crédito/Negocio) + section headers `text-xs font-semibold uppercase`; (5) Close button explícito en drawer móvil (`<X>` icon, z-50, `lg:hidden`); (6) i18n: heroTitle + 4 nav group keys en en/es. Suite 407/407, tsc limpio. **Esperando aviso explícito para FASE 9.**
- 2026-08-25 — **FASE 7b COMPLETADA** (`599cc88`, 4 archivos, +22/−2). Confirm-password en registro: campo condicional `authMode='register'`, validación server-side `password !== confirmPassword`, i18n keys confirmPassword/passwordMismatch en en/es.
- 2026-08-25 — **FASE 7 COMPLETADA** (`77bacea`, 6 archivos, +73/−5). UX de autenticación (HR3-15/16): (1) `password-input.tsx` creado — componente `PasswordInput` con `forwardRef`, toggle ojo (`Eye`/`EyeOff` via icon.tsx), `aria-label` i18n, `aria-pressed`, `tabIndex={-1}` en botón, styling idéntico a `Input`; (2) `AuthForm` — nuevo prop `authMode: 'login' | 'register'`, `autoComplete` ahora usa `authMode` en vez de comparar título i18n contra string inglés hardcoded (bug que rompía autofill en español); (3) Login/register pages pasan `authMode`; (4) i18n keys `showPassword`/`hidePassword` agregados en en/es. Suite 407/407, tsc limpio. **Esperando aviso explícito para FASE 8.**
- 2026-08-25 — **FASE 6 COMPLETADA** (`6293d52`, 5 archivos, +17/−1). Invalidación y datos frescos (HR3-14): (1) `deleteSaleAbonoAction` ahora revalía `/accounts`, `/dashboard`, `/movements` además de `/pos/sales` (antes solo revalidaba la ruta propia); (2) `editAbonoAction` en payables, credits/received, credits/granted ahora revalía `/dashboard` y `/movements` además de las rutas propias + `/accounts` (antes faltaban ambas); (3) `GlobalMovementProvider` expone `invalidateData()` vía context — al llamarlo, `data` se resetea a `null` y el próximo open del modal FAB re-fetch accounts/categories (antes era one-shot forever). Patrón documentado: toda acción que modifique balances DEBE revalía `/accounts` + `/dashboard`; toda acción que modifique movimientos DEBE revalía `/movements`. Suite 407/407 en 42 archivos, tsc limpio. **Esperando aviso explícito para FASE 7.**
- 2026-08-25 — **FASE 5 COMPLETADA** (`05a206d`, 17 archivos, +480/−84). Consistencia de tablas y ventas: (1) HR3-27 — sort DESC uniforme con tiebreaker `createdAt: -1` en los 6 repos de entidades financieras (movement×2, transfer, credit-received, credit-granted, sale, payable); sort `name: 1` agregado a Account/Category/Catalog (antes sin sort, insertion order); client-side sort redundante eliminado en movements-list. (2) HR3-12 — filtros secundarios client-side en Transfers (rango fecha), Credits Received/Granted (fecha + estado + búsqueda contraparte), Payables (vencimiento + estado + búsqueda proveedor), Sales (fecha + estado modo pago + búsqueda cliente); 47 claves i18n nuevas en es/en. (3) HR3-11 — fila resumida de ventas muestra nombre del primer artículo + indicador "+N más" (resolución vía catalogMap). (4) HR3-13 — CTA abono unificado: `<Button variant="success" size="sm">` en Credits×2 y Payables; `<Button variant="ghost" size="sm">` en Sales (acción inline). (5) A9 — chip responsive drift corregido en Payables (abono count ahora siempre visible como en Credits). (6) A8 — FIXME registrado para silent COP fallback en sale-list (resolución requiere accountId→currency lookup). Suite 407/407 en 42 archivos, tsc limpio. **Esperando aviso explícito para FASE 6.**
- 2026-08-25 — **FASE 4 COMPLETADA** — Dashboard financiero avanzado (D4). Suite 407/407 en 42 archivos (+15 tests, +2 archivos nuevos), tsc limpio. WU-A: sistema de filtros composables (`dashboard-filters.tsx` — scope/cuenta/categoría/periodo con badges removibles, estado React; position data calculada server-side independiente de filtros). WU-B: Activos/Pasivos por moneda (`compute-activos-pasivos.ts` + `position-cards.tsx`) — definiciones D4 congeladas: activos = Σ aggregateBalance + Σ CreditGranted.pending; pasivos = Σ CreditReceived.pending + Σ Payable.pending; neto por moneda sin FX; tarjeta `pendingCredits` eliminada (reemplazada). WU-C: evolución anual (`compute-yearly-evolution.ts`) — serie mensual 12 meses de ingresos/gastos con exclusión de transfer/opening; gráfico de barras mensual con título toggle. WU-D: use cases extraídos a core/application con tests (8 activos/pasivos + 7 evolución anual). WU-E: i18n 23 claves nuevas en ambos catálogos, componentes client orchestrados vía `dashboard-content.tsx`. Desvíos: A1 perf (carga completa) deferred; Activos/Pasivos no dependen de movement filters (estado actual, no actividad filtrada); filter state es React useState (no URL params).

- 2026-08-24 (mismo día) — **CORRECCIÓN ARQUITECTÓNICA D3-bis** (`2d8ca7d`, 47 archivos + 2 scripts, +código/−código). El usuario reportó que sus cuentas son COMPARTIDAS (un solo efectivo para ambos mundos) y que la clasificación debía vivir en los movimientos, no en las cuentas. La auditoría original malinterpretó el picker Manual/P/N existente como plomería incompleta en vez de la intención de diseño del producto. Reversión completa: `Account.scope` eliminado (entity, modelo, mapper, UI alta/chip/reclassificación, use cases, backfill, scripts); `Movement.context` vuelve opcional (undefined = neutro, exento del filtro automáticamente); formulario restaura el picker Personal/Negocio + nueva capacidad de edición de contexto en movimientos existentes; defaults de flujo sistema: ventas POS → Business, créditos/payables/opening → Personal (editable), transfers → undefined (neutrales); filtros simplificados (`scopeFilter === m.context`); notas de transferencia simplificadas (sin etiqueta de alcance); migración histórica (`scripts/migrate-sale-context.mjs`) reclasifica salePayment + creditGrantedAbono-con-saleId a Business. Suite 392/392 en 40 archivos, tsc limpio. Decisiones: D3(a) reversada a Movement.context; transfers neutras; defaults editables; migración parcial más edición manual. **Pendiente: ejecutar migración contra Atlas tras deploy.**
- 2026-08-24 (mismo día) — **REMEDIACIÓN F3** (`c892065`, 12 archivos, +260/−10). Reporte del usuario: ventas POS clasificadas Personal y transferencias ambiguas bajo filtro de ámbito. Causa raíz 1 confirmada: cuentas pre-F3 quedaron 'Personal' por backfill/default y NO existía UI de edición de scope (desvío documentado de F3). Fix: use case `updateAccountScope` + acción server con tenant guard + `AccountScopeButton` (icon action → Modal sm → Select) en cada cuenta; cambio de clasificación puro, los filtros lo recogen en vivo (resolución por account map, sin migración). Causa raíz 2: nota derivada "Transferencia entre cuentas propias" no nombraba contraparte. Decisión de UX aprobada por el usuario: mantener piernas visibles bajo filtro con etiqueta directional — "Transferencia hacia Nequi (Negocio)" / "Transfer from Efectivo (Personal)" vía nuevas claves SystemNotes (scope con claves dedicadas porque las del filtro son adjetivos plurales); fallback plain si faltan refs; leg que no matchea ningún endpoint cae a plain, nunca dirección falsa. Suite 411/411 en 42 archivos (+12), tsc limpio. Acción operativa del usuario tras deploy: reclasificar sus cuentas de venta como Negocio.
- 2026-08-24 (mismo día) — **FASE 3 COMPLETADA** (`154e990`, 41 archivos, +1071/−88). Clasificación Personal/Negocio D3(a): `Account.scope` enum requerido default 'Personal' como ÚNICA fuente de verdad; backfill idempotente no destructivo (`src/infrastructure/migrations/backfill-account-scope.ts` + `scripts/backfill-account-scope.mjs` para ejecutar contra Atlas — (ejecutado contra Atlas 2026-08-24: matched=10, modified=10)); herencia automática de contexto en los 11 flujos sistema (cero hardcodes 'Personal'; transferencias cross-scope → cada pierna hereda SU cuenta, decisión menor aprobada); picker Personal/Negocio eliminado del formulario manual (contexto deriva server-side de la cuenta, nunca del cliente); select de scope en alta de cuentas + chip sutil Business (scope inmutable post-creación, misma convención que currency); filtro Ámbito en Movements resolviendo account-ids-por-scope (jamás vía context persistido histórico), deshabilitado con cuenta específica seleccionada; helper `listAccountIdsByScope` exportado como base de F4. Suite 399/399 en 41 archivos (+26 netos), tsc limpio, verificación independiente. Desvíos: NO existe UI de edición de cuentas → scope solo en creación; use cases de créditos/payables ahora resuelven la cuenta ANTES de validar negocio (cambia orden de errores en inputs dobles inválidos, tests ajustados); movimientos históricos conservan context:'Personal' crudo aunque su cuenta sea Business — correcto por diseño (filtros vía account ids). Nota: el primer intento de delegación murió por fallo del proveedor dejando WIP a medio camino; el reintento lo detectó y completó. **Esperando aviso explícito para FASE 4.**
- 2026-08-24 (mismo día) — **FASE 2 COMPLETADA** (`66b3301`, 21 archivos, +743/−58). Textos automáticos e i18n estructural: (1) HR3-05 — los 11 generadores de notas sistema dejaron de persistir texto inglés; nueva capa de presentación `src/lib/system-note.ts` deriva el texto en render desde `link.kind` + contraparte vía namespace `SystemNotes` (22 claves es/en, variante `Plain` sin nombre cuando el padre no está); nota persistida queda solo como fallback para huérfanos/históricos; la nota escrita por el usuario en transferencias sigue ganando verbatim (el literal legacy "Transfer" se trata como auto-generado); transfers-list no cambió porque renderiza la nota propia de la entidad Transfer (dato del usuario). (2) A4 — dashboard resuelve las 6 categorías sintéticas vía i18n (`src/lib/synthetic-category-label.ts`), mata el "uncategorized". (3) HR3-06 — clave `Categories.type` agregada + NUEVO test de cobertura de uso `src/i18n/messages-usage.test.ts` que escanea todo src y verifica cada clave referenciada estáticamente en AMBOS catálogos; el scanner destapó 5 huecos latentes de producción (`CreditsReceived.amount/account`, `CreditsGranted.amount/account`, `Sales.amount`) corregidos; `'SystemNotes'`/`'Payables'` incorporados a la unión `Namespace` de types.ts. (4) HR3-07 — barrido voseo→tuteo (~35 claves) en Landing/Auth/empty states/Errors/Toast. Suite 373/373 en 39 archivos (+15 tests), tsc limpio, verificación independiente del orquestador. Observación registrada para F4/A1: movements/page.tsx ahora carga repos extra para resolver labels (rendimiento a revisar en F4). **Esperando aviso explícito para FASE 3.**
- 2026-08-26 — **INICIO RONDA 5** — Créditos con cuotas, fix dashboard, onboarding. Auditoría completada (4 exploraciones paralelas: créditos, cuentas/onboarding, layout/centering, dashboard month filter). Hallazgos: (1) `installments`/`frequency` informativos sin `installmentValue`; (2) BUG confirmado: filtro `current_month` es no-op en `dashboard-content.tsx`; (3) seed crea 2 cuentas fijas (Efectivo + Nequi) — Nequi debe eliminarse; (4) body ya centrado vía `max-w-screen-2xl mx-auto` en `<main>`. Plan 6 fases (A–F) aprobado por usuario. Decisiones dominio: R5-D1 a R5-D5. Commits previos de Ronda 5 anterior: `c996ff1`, `3b073ea`, `b6dba3f`, `e523520` (fases A–C parciales). **Mañana: Fase A — créditos con cuotas (dominio + infra).**
- 2026-08-27 — **REPLANTEO RONDA 5 APROBADO** — El usuario reportó 6 hallazgos críticos de integridad (ventas y transferencias eliminadas no se reflejan en Movimientos sin refresh; pago inicial no se refleja en la venta; venta a crédito 150.000 / 20.000 inicial muestra saldo 150.000 en ventas y 130.000 en créditos; abonos desde créditos no se reflejan en ventas y viceversa; borrar abono da toast de error, desaparece de la vista pero sigue en Movimientos; borrar venta a crédito no borra el crédito otorgado; datos eliminados siguen en el dashboard). Auditoría profunda (3 exploraciones paralelas: dominio/aplicación, UI/invalidación, infraestructura) confirmó **UNA causa raíz: dos fuentes de verdad para la misma deuda on-credit** (`sale.abonos` y `credit.abonos` independientes, vinculadas solo por un `saleId` informativo). Diseño propuesto (Opción A): **el `CreditGranted` es dueño único de la deuda; la `Sale` on-credit no acumula abonos propios; el pago inicial se registra como primer abono del crédito; cascada de borrado simétrica venta↔crédito↔movimientos**. Añadido bug de infra latente: `toTransferDocData` omite `movementIds` y soft-delete de Sale es vestigial. Plan replanteado en 6 fases (A integridad modelo, B eliminación/movimientos/invalidación, C cuotas, D filtro mes, E seed/onboarding/centering, F reparación legacy+QA). Suite base 426/428 (2 timeout bcrypt por entorno). **Documento actualizado. Comienza implementación Fase A.**
- 2026-08-27 (mismo día) — **FASE A IMPLEMENTADA (sin commit)** — Integridad del modelo on-credit (R5-D0/R5-D0b/R5-D0c). Nuevo modelo: `CreditGranted.principal = total` (dueño único de la deuda); el pago inicial de la venta se registra como **primer abono del crédito** con movimiento `creditGrantedAbono` (refId=creditId, context **Business**, amount=initialPayment — decisión D3-bis: flujo POS es comercial, frente a abonos de créditos standalone que siguen Personal); sin pago inicial no se crea ningún movimiento. `create-sale.ts`: helper `buildInitialPaymentMovement` (id del Movement = `movementId` del abono). Cascada de borrado simétrica: `delete-sale.ts` agregó `CreditGrantedRepository` — borra movimientos del crédito (refId=creditId) + legacy (refId=saleId) + el crédito + la venta; `delete-credit-granted.ts` **bloquea** créditos con `saleId` (ConflictError, mensaje exportado `SALE_BORN_CREDIT_DELETE_MSG`). Borrado de movimientos TOLERANTE en ambos (NotFoundError → continuar; no hay transacciones multi-doc en Atlas shared). `get-sale-detail.ts`: derivación dual — NUEVO (principal===total) → `initialPayment=abonos[0]`; LEGACY → `initialPayment=total−principal`. UI: `page.tsx` pasa `creditInitialPaymentBySaleId` (abonos[0]) a `SaleList`, que muestra "Pago inicial:" (clave i18n `Sales.initialPaymentLabel`, es/en) solo cuando >0; `deleteSaleAction` pasa `MongoCreditGrantedRepository` y revalida `/movements`. Tests: 7 nuevos/reescritos (create sale con/sin inicial, initialPayment=total, cascada deleteSale, tolerancia deleteSale, bloqueo deleteCreditGranted, tolerancia deleteCreditGranted, 3 de get-sale-detail NUEVO/LEGACY). Suite 432/434 (2 timeout bcrypt preexistentes), tsc limpio. Verificación pendiente: build + QA. Pendiente aviso explícito para **FASE B** (eliminación/refresco Movimientos/invalidación).
- 2026-08-27 (mismo día) — **FASE A COMMITEADA** — Commit `fd1a3d6` ("fix(sales): Fase A — una sola fuente de verdad venta-crédito (R5-D0)", 13 archivos, +445/−68). Suite 434/434, tsc limpio.
- 2026-08-27 (mismo día) — **FASE B IMPLEMENTADA (sin commit)** — Eliminación y sincronización de Movimientos (R5-B). (1) **Invalidación centralizada**: nuevo `src/lib/revalidate.ts` con `revalidateMovementData(moduleRoute)` — revalida la ruta del módulo + `/accounts` + `/dashboard` + `/movements`; reemplaza los bloques inline 3/4-línea en `credits/granted/actions.ts`, `credits/received/actions.ts`, `payables/actions.ts` (incluye `/movements` que antes faltaba). (2) **`/movements` en ventas**: `createSaleAction` y `addSaleAbonoAction` ahora revalidan `/movements`. (3) **Atomicidad de borrado de abonos**: 4 use cases (`credits-granted/delete-abono.ts`, `credits-received/delete-abono.ts`, `payables/delete-abono.ts`, `sales/delete-sale-abono.ts`) invierten el orden a "movimiento primero, $pull después" + borrado TOLERANTE (NotFoundError → continuar): un fallo a mitad deja el abono intacto (deuda pendiente, sin movimiento fantasma que infle saldos). (4) **Tabla sincronizada**: `movements-list.tsx` agrega `useEffect` que re-sincroniza `movements`+`nextCursor` con `initialMovements`/`initialCursor` tras `router.refresh()`. (5) **Fix mapper transferencias**: `toTransferDocData` ahora persiste `movementIds` (como **strings planos** — los movements usan custom string ids UUID, NO ObjectId: envolverlos habría lanzado) + `createdAt`; `deleteTransfer` puede revertir ambas patas y no deja movimientos huérfanos contando en balances. Tests: 14 nuevos (2 mapper transfer + 4×3 atomicidad en los 4 delete-abono: orden movimiento-antes-de-$pull, tolerancia movimiento ya borrado, propagación de errores no-NotFound sin $pull). Suite **448/448**, tsc limpio. **Verificación pendiente: build + QA. Pendiente aviso explícito para FASE C (créditos con cuotas).**
- 2026-08-28 — **FASE C COMPLETADA** (~32 archivos). Créditos con cuotas (R5-C, R5-D1, R5-D3). (1) **Dominio**: `installmentValue?: Money` en CreditGranted/CreditReceived; getter `totalToPay` = `installmentValue × installments` con fallback a `principal` (legacy sin valor + créditos POS R5-D2); `pending` y guard de sobrepago ahora contra `totalToPay`; `toJSON()` expone `installmentValue` + `totalToPay`. (2) **Use cases**: create ×2 validan R5-D1 (`ValidationError` si `installments > 0` sin `installmentValue` — validación en el use case, no en el constructor, para que la reconstrucción de docs legacy no lance); propagación de `installmentValue` en add/edit/delete-abono y edit-principal ×2; nuevos `markAsPaid` ×2 (abono por el `pending` exacto reusando `addAbono` — R5-D3; `ConflictError` si ya pagado). (3) **Infra**: campo `installmentValue` en modelos + mappers (minor units). (4) **Actions**: `markAsPaidAction` ×2 con `revalidateMovementData` (invalidación centralizada de Fase B); create actions leen `installmentValue` del form. (5) **UI**: forms muestran "Valor de cuota" + "Total a pagar" en vivo cuando `installments > 0` (formatAmount + locale); lists muestran "Total a pagar" + progreso "X/N cuotas pagadas" (`floor(Σabonos/valor)`, i18n `installmentProgress`) + botón "Marcar como pagado" (`MarkAsPaidButton`, variant success, solo `pending > 0`). (6) **i18n**: 8 claves es/en (installmentValueLabel, totalToPayLabel, markAsPaid ×2 namespaces, installmentProgress ×2, creditMarkedAsPaid en Toast). Tests: 448/448 (1 ajustado a R5-D1 — el test legacy de createCreditReceived ahora pasa `installmentValue` y verifica `totalToPay`), tsc limpio, build OK. **Pendiente aviso explícito para FASE D (fix filtro de mes).**
- 2026-08-28 — **FASE D COMPLETADA** — Fix filtro de mes en dashboard (R5.2 bug confirmado: `current_month` era no-op). (1) Nuevo helper puro `src/lib/movement-period-filter.ts` con `filterMovementsByPeriod(movements, period, now?)` — `now` inyectable para tests deterministas; `current_month` compara clave UTC year-month (convención D1/F1: `getUTCFullYear`+`getUTCMonth`; business dates = medianoche UTC); `this_year` conserva exactamente el comportamiento previo. (2) `dashboard-content.tsx`: la rama `period` delega al helper — `current_month` AHORA filtra; las derivadas de `filteredMovements` (cards de resumen, tablas ingresos/gastos por categoría, top categorías, gráficos, recientes) recalculan con el período. (3) Tests: 7 nuevos (current_month incluye mes actual/excluye mes previo/excluye mismo mes año anterior/ISO timestamps/vacío; this_year incluye año/excluye otros años). Suite **455/455**, tsc limpio, build OK. **Pendiente aviso explícito para FASE E (seed + onboarding + body centering).**
- 2026-08-28 (mismo día) — **FASE E COMPLETADA** — Seed, onboarding y body centering (R5-D4/R5-D5). (1) **Seed**: `FIXED_ACCOUNTS` ahora solo `Efectivo` (Nequi eliminada — R5-D4); test del seed actualizado a "creates 1 fixed account and 8 default categories" (idempotencia 2 llamadas → 2 cuentas). El seed solo corre en `register.ts`, así que los usuarios existentes no se ven afectados. (2) **Migración**: nuevo `scripts/unfix-legacy-nequi.mjs` idempotente y no destructivo (`name === "Nequi" && isFixed: true` → `isFixed: false`) — libera las Nequi legadas para renombrarlas/eliminarlas (sugerencia #4); replicando el patrón de `migrate-sale-context.mjs` (mongoose, `MONGODB_URI`). **EJEcutada contra Atlas 2026-08-28: matched=7 modified=7** (7 cuentas Nequi de usuarios existentes pasaron a `isFixed: false`; ahora renombrables/eliminables). (3) **Onboarding visible**: card en `dashboard-content.tsx` (cliente) cuando el usuario aún solo tiene la cuenta fija del seed (`accountBalances.length === 1 && accountBalances[0].isFixed`): título "Crea tus cuentas", cuerpo con ejemplos (Nequi, bancos, caja del negocio), CTA "Crear cuenta" → `/accounts` (patrón `<Link><Button>` de hero.tsx); 3 claves i18n es/en (`onboardingTitle`, `onboardingBody`, `onboardingCta`); español neutro. (4) **Body centering**: verificado — `<main>` ya centra vía `max-w-screen-2xl mx-auto` en `(main)/layout.tsx` (hallazgo de auditoría R5.2); sin cambios requeridos. Suite **455/455**, tsc limpio, build OK. **Aviso explícito recibido: ejecuta Fase F.**
- 2026-08-28 (mismo día) — **INICIO RONDA 6 (auditoría de defecto)** — El usuario reporta ventas eliminadas aún visibles en movimientos y dashboard. Auditoría de solo lectura (exploración de código + inspección read-only contra Atlas) identificó **una causa raíz estructural**: las lecturas de movimientos (`findByUserId`/`findPaged`/dashboard/tabla) NO verifican que el padre de `link.refId` (venta/crédito) siga existiendo, y `deleteSale` no cubre movimientos con `refId` UUID legacy (mismatch contra ObjectId actual). **Confirmado contra Atlas:** 1 movimiento `salePayment` huérfano (`6a9134098b0de779c4a4f1ab`, ingreso 50.000 COP, usuario pruebas2, refId UUID legacy `d86e48ee-6521-420d-8346-b6e5833232c6`) que infla informes. Propuestas P1–P6 documentadas (sección R6): P1 limpieza defensiva en lectura, P2 robustecer deleteSale, P3 deleteMany, P4 tests, P5 limpiar huérfano real, P6 soft-delete vestigial. **APROBADO por el usuario (2026-08-28): ejecutar P1–P5.**

- 2026-08-28 (mismo día) — **RONDA 7 IMPLEMENTADA R7-A + R7-B (código)** — Cortar de raíz los UUID + arreglar cards infladas. **R7-B1 (ids ObjectId):** nuevo `src/infrastructure/config/id-generator.ts` (`objectIdGenerator` = `new Types.ObjectId().toString()`); 11 server actions cambian de `{ generate: () => crypto.randomUUID() }` a `objectIdGenerator`. **R7-B2 (persistir `_id`):** los 6 repos del Grupo B (movement, sale, credit-granted, credit-received, payable, transfer) ahora persisten `_id: entity.id` SOLO en su método `create` (`Model.create({ ...docData, _id: x.id })`), NO en el mapper `toXxxDocData` (lo reusan los `update` con `$set` y Mongo no permite mutar `_id`) → `link.refId`/`saleId`/`movementId` SIEMPRE coinciden con el `_id` real del padre → `deleteSale` ya no deja huérfanos. Grupo A (Account/Category/Catalog/Client/User) intacto. **R7-A (defensa dashboard):** nuevo use case puro `accountBalancesFromMovements` + `dashboard/page.tsx` deriva `accountBalances` desde `liveMovements` (filtro P1) en vez de `aggregateBalance` crudo → Balance total / Activos / Patrimonio excluyen huérfanos. **4 tests nuevos** (suma por cuenta, Map contract, exclusión huérfano, reconciliación por valor). Suite **517/517** (48 archivos), `tsc --noEmit` limpio, `pnpm build` OK. Decisión de formato con usuario: **ObjectId nuevo** (mata UUID), datos legacy no se migran. **Pendiente R7-C (datos): limpiar huérfanos en Atlas — requiere confirmación del usuario.**
- 2026-08-28 (mismo día) — **INICIO RONDA 7 (auditoría de defecto post-R6)** — El usuario reporta que eliminar ventas sigue inflando las cards Balance total / Patrimonio / Activos (Posición financiera) de `pruebas2` aun con la tabla de Movimientos ya filtrando (P1). Auditoría 100% de solo lectura (código + Atlas read-only). **Hallazgo A (código):** `aggregateBalance` suma `$sum` sobre TODOS los movimientos de una cuenta sin excluir huérfanos — alimenta Balance total + `computeActivosPasivos` (Activos/Pasivos/Patrimonio) → cards infladas aunque P1 oculte los huérfanos en la tabla. **Hallazgo B (datos):** 2 movimientos `salePayment` huérfanos vigentes en `pruebas2` (100.000 + 50.000 COP), creados tras la limpieza P5 → 150.000 COP inflando el Efectivo. **Hallazgo C (RAÍZ — UUID↔ObjectId, proceso duplicado confirmado):** el dominio genera `crypto.randomUUID()` (puerto `IdGenerator`), pero el **mapper descarta ese id** (`toMovementDocData`/`toSaleDocData` no escriben `_id`) → Mongo asigna `_id: ObjectId` real, y al releer la entidad usa el ObjectId. En `create-sale` el movimiento `salePayment` guarda `link.refId` = UUID del dominio (generado antes de persistir) que **jamás coincide** con el ObjectId real de la venta → `deleteSale` (por ObjectId) no lo borra y el huérfano sobrevive inflando el balance. Bug **estructural y vigente** (aplica a ventas/créditos nuevos). **Plan documentado R7-A/B/C** (defensa de lecturas en dashboard, raíz ids por captura del ObjectId real = B1 recomendado vs refactor masivo B2, y limpieza de los 2 huérfanos). **A la espera de aprobación para ejecutar.**
- 2026-08-28 (mismo día) — **RONDA 6 IMPLEMENTADA — P1–P5 COMPLETADOS** (ventas eliminadas ya no inflan movimientos/dashboard). (1) **P3**: `MovementRepository.deleteByRefId(userId, refId)` vía `deleteMany({ userId, 'link.refId': refId })`. (2) **P2**: `deleteSale` reescrito — cascada `deleteByRefId(saleId)` + `deleteByRefId(creditId)` (formato-agnóstico), sin listar previamente. (3) **P1**: nuevo use case puro `filterMovementsWithLiveParents` aplicado a `dashboard/page.tsx` (antes de serializar) y `movements/page.tsx` (antes de `firstPage.items`). **Durante la validación de P5 contra Atlas se descubrió que 2 movimientos portaban refId UUID legacy (de ~66 con link) y que uno NO era huérfano**: el `creditGrantedPrincipal` del crédito VIVO `6a9194b3b917614ec8d8c03e` (20.000 COP, usuario fjpaba) tenía refId UUID que no coincidía con el `_id` ObjectId → **P1 v2** (reconciliación por valor: accountId + fecha de negocio + monto espejo, para créditos/ventas con refId legacy que referencian padres vivos; abonos/payables no se reconcilian). (4) **P4**: 20+ tests del filtro (incl. reconciliación por valor) + tests `deleteSale` a `deletedByRefId`; fakes de `MovementRepository` actualizados (10 archivos). (5) **P5**: `scripts/clean-orphan-movements.mjs` idempotente — **1 relink** (`...c041` → `refId = ...c03e`, gasto legítimo conservado) + **1 borrado** (huérfano `...f1ab`); idempotencia verificada (0/0). Suite **513/513** en 47 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador. **P6 queda como decisión de producto pendiente.**
- 2026-08-28 (mismo día) — **FASE F COMPLETADA** — Reparación legacy contra Atlas (R5-F). Investigación previa (scripts _inspect) corrigió el diagnóstico: (1) los 2 "créditos huérfanos" (`6a8a4bb9...fde`, `6a8a4c4b...c6`) NO son huérfanos — créditos vivos con `saleId` UUID legacy que matchean sus ventas por account/fecha/principal==total → **relink del saleId**, no borrado; (2) los "orphan transfers" previos eran bug del matcher (transfers usan `sourceAccountId`/`destinationAccountId`, no `accountId`) — las 7 transfers SÍ tienen sus patas; solo 4 pares de movimientos transfer son huérfanos reales (transfers borradas pre-R5-B sin cascada); (3) la venta `6a8a4516...896` YA tiene crédito (`6a8a4516...899`, principal 10000 = pending real) → vincular, no duplicar; (4) patrón confirmado: movimientos legacy conservan `link.refId` UUID mientras padres actuales son ObjectId. Nuevos: `src/lib/legacy-repair.ts` (plan puro, contrato `CreateSaleCreditAction`/`LinkSaleCreditAction`/`DeleteOrphanCreditAction`/`LinkTransferMovementsAction`/`RelinkMovementRefIdAction`/`DeleteOrphanMovementAction`/`PurgeSoftDeletedSaleAction`; resolvers con match exacto preferido y parcial on-credit como fallback) + `scripts/reconcile-legacy.mjs` (dry-run/--apply idempotente; importa el módulo TS vía type-stripping de Node v24; localiza legs por valor; `MONGODB_URI` env). **Aplicado contra Atlas 2026-08-28: 45 acciones** — 2 create_sale_credit (ventas `6a84e267...`→30000, `6a890299...`→100000), 3 link_sale_credit (`6a8a4516`, `6a8a4bb9`, `6a8a4c4b`), 7 link_transfer_movements, 16 relink_movement_ref_id (10 salePayment + 3 creditGrantedPrincipal + 3 creditReceivedPrincipal), 18 delete_orphan_movement (8 transfer + 10 salePayment), 0 purge/delete_orphan_credit. **Idempotencia verificada: 0 issues restantes.** Nota: el candidato `6a8a4c33...` del análisis previo NO existe en Atlas (no reparado). Suite **485/485** (30 tests del módulo repair), tsc limpio, build OK. **Corrección post-QA (`1396928`)**: auditoría del tenant real (Francisco, `fjpaba1989@gmail.com`) con el criterio EXACTO de la app (`findOrphanMovements`) destapó 1 residuo — `6a8a4c33...e8` (salePayment 20000 → venta paid-in-full `6a8a4c33...e5`) con refId UUID sin relinkear; causa raíz: `sameBusinessDate` usaba ventana `|diff| ≤ 24h` (20-08 y 21-08 a medianoche contaban como mismo día → 2 candidatas exactas → ambiguous → skip silencioso, ni relink ni borrado; además viola la regla de fechas civiles). Fix: comparación de día calendario UTC (`getUTCFullYear/getUTCMonth/getUTCDate`), re-aplicado con `--apply` (1 relink). **Auditoría global post-fix con criterio de la app: 0 huérfanos, 0 ventas on-credit sin crédito, 0 transfers sin legs válidos** (14 salePayment + 14 transfer + 6+3+3 credit*/payableAbono, todo vinculado). Suite 485/485, tsc limpio, build OK. **RONDA 5 COMPLETADA.**
- 2026-08-28 (mismo día) — **RONDA 8 — Capital financiero fuera del resultado económico del dashboard (refinamiento de D2, roadmap R3.15).** Decisión del usuario validada: el **capital financiero** (`creditReceivedPrincipal` = desembolso de un crédito recibido → deuda, no ingreso; `creditGrantedPrincipal` = dinero prestado a un tercero → activo, no gasto) queda **FUERA** del resultado económico (ingresos/gastos del dashboard). La exclusión es SOLO por `link.kind`, sin usar `context`. **Conservan su tratamiento**: `creditReceivedAbono` (cuotas pagadas, siguen gasto), `creditGrantedAbono` (cuotas cobradas, ingreso — Personal y Business idéntico), `salePayment`, `payableInitialPayment`/`payableAbono`; `transfer`/`opening` siguen excluidos. Implementación: nuevo módulo compartido `src/core/application/economic-result.ts` (set canónico `NON_ECONOMIC_LINK_KINDS` = transfer/opening + capitales financieros; `FINANCING_CAPITAL_LINK_KINDS` y predicado `countsTowardEconomicResult` centralizados) consumido por los 3 agregadores (dashboard-summary, category-summary, yearly-evolution) y por el breakdown multi-moneda del dashboard. `DashboardMonthlySummary` gana `financingInflow`/`financingOutflow` (mes actual, moneda del scope, default 0). UI: la card "Patrimonio" de las SummaryCards es reemplazada por la card "Flujos de financiamiento" (neto del mes con signo +/−, i18n `financingThisMonth` es/en); el `useMemo netPosition` y su prop se eliminan de dashboard-content (position-cards conserva su propio cálculo). Tests actualizados + 7 nuevos (capitales fuera del resultado pero dentro de los flows; abonos/ventas/payables dentro; filters de mes/moneda en flows). Suite y tsc verificados. **Es la extensión de la semántica D2 que estaba postergada en el roadmap R3.15.**
- 2026-08-29 — **INICIO RONDA 9 (planificación; NO implementado).** Decisión del usuario sobre créditos otorgados (contexto Personal standalone; ventas a crédito quedan intactas): (1) **amortización capital primero** — cada abono amortiza el principal; SOLO el excedente sobre el principal es ingreso (reconocimiento cronológico; acuerdo sin interés → todo recuperación de capital, cero ingreso); (2) **baja por incobrable** — nueva acción manual que registra GASTO por el capital NO recuperado (`principal − Σ capitalPortion`; el interés no realizado NO es pérdida) y saca el `pending` del activo en Posición Financiera; el gasto aparece en el mes de la baja. Auditoría solo lectura completada (mapper + archivos clave): `MOVEMENT_LINK_KINDS` (9 kinds, const array + guard); rutas separadas confirmadas (standalone → `add-abono.ts` context Personal kind `creditGrantedAbono`; ventas → `add-sale-abono.ts` context Business kind `salePayment` → cambiar `creditGrantedAbono` NO toca ventas); `markAsPaid` reusa addAbono; sin método de cierre en repo (estado derivado de pending); `economic-result.ts` hoy cuenta `creditGrantedAbono` como ingreso. Diseño D9.1–D9.4 (split en el origen vía helper `splitAbonoCapitalInterest`; kinds nuevos `creditGrantedAbonoInterest` + `creditGrantedWriteOff`; `creditGrantedAbono` pasa a NO económico para standalone; campo `writtenOff?` en entidad/modelo; write-off reusa categoría sintética `creditGranted`). **Hallazgo R9-H1 agregado (2026-08-29):** el usuario reporta que cuentas creadas CON saldo inicial no se pueden eliminar (las sin saldo sí). Causa raíz verificada: `MongoAccountRepository.countReferences` cuenta TODOS los movimientos de la cuenta `{ userId, accountId }`, INCLUIDO el movimiento `opening` que la cuenta crea para sí misma (`createAccount` con `initialBalance > 0` → `link.refId = accountId`) → `countReferences = 1` → `deleteAccount` bloquea con `ConflictError`. El `opening` es intrínseco de la cuenta, no una referencia externa; el guard ACC-4 debe excluirlo y la cuenta debe borrar en cascada su opening (patrón deleteSale/deleteCreditGranted). Plan renumerado a 6 fases (A fix R9-H1, B dominio+kinds, C use cases granted, D infra+posición, E UI+i18n, F QA+docs). Plan completo en sección R9. **A la espera de aprobación del usuario para implementar.**
- 2026-08-29 (mismo día) — **R9-H2 agregado a la Ronda 9 (solicitud del usuario).** Reporte: la cuenta fija "Efectivo" (única del seed) no tiene opción para establecerle saldo inicial. Causa raíz verificada: `seedUser` crea la Efectivo SIN movimientos (no pasa por `createAccount`); `initialBalance` solo existe en `createAccountActions`/form de creación; `updateAccount` solo cambia nombre → no hay ningún camino para asignarle saldo a una cuenta ya existente (en particular la fija). Plan: nueva Fase B — use case `setInitialAccountBalance` (cuenta existe; `amount > 0`; cuenta limpia vía `countReferences === 0`; crea movement `opening` con el mismo patrón de `createAccount`); action `setInitialBalanceAction` con revalidación; UI: botón "Establecer saldo inicial" en `/accounts` para cuentas sin movimientos (`!balances.has(account.id)`), visible también para la fija; i18n es/en; tests. Fases renumeradas a A–G. **Plan completo en sección R9. A la espera de aprobación del usuario para implementar.**
- 2026-08-29 (mismo día) — **FASE A COMPLETADA (R9-H1, sin commit).** Fix: cuentas creadas CON saldo inicial ya se pueden eliminar. (1) `MongoAccountRepository.countReferences`: el conteo de movimientos excluye `'link.kind': { $ne: 'opening' }` → el opening propio de la cuenta ya no es una "referencia" que bloquee la eliminación; transfers/créditos/ventas/payables/manuales siguen bloqueando. (2) `deleteAccount` (use case): nueva firma con `movementRepo: MovementRepository`; tras el guard ACC-4 borra en cascada los openings de la cuenta (`findByAccountId` + filtro `link.kind === 'opening'`), tolerante a `NotFoundError` (race → continúa), orden movimiento-primero (patrón R5-B); luego borra la cuenta. (3) `deleteAccountAction`: instancia `MongoMovementRepository` y lo pasa (acción ya revalidaba `/accounts`, `/dashboard`, `/movements`, `/transfers`). (4) Tests: +4 en `accounts.test.ts` (cascada y orden, tolerancia a opening inexistente, solo borra openings no manuales, firma nueva en los 3 existentes) + actualización del mock en `actions.test.ts` (patrón hoisted para MongoMovementRepository). `account-repository.test.ts` NO se tocó (mockear 6 modelos para countReferences era muy invasivo; cobertura queda en use case + actions). Suite **540/540** en 51 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador (filtro + cascada + 15/15 módulo accounts). **Archivos: account-repository.ts, delete-account.ts, actions.ts, accounts.test.ts, actions.test.ts.** **Aviso explícito para FASE B (saldo inicial para cuenta existente / Efectivo).**
- 2026-08-29 (mismo día) — **FASE B COMPLETADA (R9-H2, sin commit).** Saldo inicial para cuenta existente. (1) **Use case** `setInitialAccountBalance(userId, { accountId, amount }, accountRepo, movementRepo, ids)`: NotFoundError si la cuenta no existe; ValidationError si `amount <= 0`; ConflictError si `countReferences > 0` (cuenta con historial no puede recibir saldo inicial — misma definición de ACC-4); crea movement `opening` con patrón idéntico a `createAccount` (openingCategory, income, `Money(amount, account.currency)` — respeta la currency de la cuenta, context Personal, `link {kind:'opening', refId: accountId, opId}`); devuelve el Movement. (2) **Action** `setInitialBalanceAction`: getCurrentUser → connectDb → repos → use case → revalidate `/accounts` `/dashboard` `/movements` → `{ success: 'initialBalanceSet' }`. (3) **UI**: nuevo `initial-balance-button.tsx` (cliente) — botón `secondary/sm` abre Modal con form (Input number `balanceToSet` min=1 + hidden `accountId`, useActionState + toast + router.refresh + cierre); `page.tsx` muestra el botón en cada fila cuando `!balances.has(account.id)` (cuenta sin movimientos, derivado de getUserBalances sin queries extra) — visible TAMBIÉN para la fija Efectivo. (4) **i18n**: `Accounts.setInitialBalance`, `setInitialBalanceDescription`, `balanceToSet`, `saving`; `Toast.initialBalanceSet` (es/en, español neutro). (5) **Tests**: +6 use case (patrón opening, retorno, amount<=0, con referencias, inexistente, currency de la cuenta) +2 action (éxito capturando el movement, unauthenticated). Suite **548/548** en 51 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador (use case + action + componente + 23/23 módulo accounts). **Archivos: set-initial-balance.ts (NUEVO), index.ts, actions.ts, initial-balance-button.tsx (NUEVO), page.tsx, es.json, en.json, accounts.test.ts, actions.test.ts.** **Aviso explícito para FASE C (dominio + kinds: MOVEMENT_LINK_KINDS += creditGrantedAbonoInterest/creditGrantedWriteOff, helper splitAbonoCapitalInterest, campos abono/writtenOff, economic-result).**
- 2026-08-29 (mismo día) — **FASE D COMPLETADA** (17 archivos: 14 modificados + 3 nuevos; sin commit aún al momento de escribir). Use cases granted (D9.1–D9.4). (1) **add-abono con split en el origen**: standalone (sin `saleId`) → `splitAbonoCapitalInterest` sobre abonos+nuevo; 1–2 movimientos (`creditGrantedAbono` capital NON-ECONÓMICO + `creditGrantedAbonoInterest` interés ingreso, ambos context Personal, opId propio); el abono embebido conserva `amount` TOTAL (pending/totalToPay intactos) y gana `capitalAmount`/`interestAmount` + vínculo `interestMovementId`; caso límite 100% interés → un solo movimiento, `movementId` apunta al de interés; créditos sale-born conservan comportamiento legacy (nunca split — el pago inicial POS Business sigue siendo ingreso completo). (2) **edit-abono con 2 movimientos**: detecta abono con split (`!saleId` + algún marcador); recomputa el split cronológico completo manteniendo la posición del editado; sincroniza ambos movimientos — crea interés cuando aparece (si capital > 0), lo actualiza si persiste, lo BORRA movimiento-primero (R5-B) + `$unset` de `interestMovementId`/porciones cuando el interés cae a 0; caso 100% interés actualiza el primario; legacy/pre-R9 sin marcadores → comportamiento previo intacto (resolved values only, evitando `$unset` accidental por `undefined`). (3) **delete-abono**: borra TAMBIÉN `interestMovementId` (orden movimiento-primero, tolerante NotFoundError) antes del `$pull`; legacy intacto. (4) **write-off** `writeOffCreditGranted` + `writeOffCreditAction`: guards en orden (NotFound → sale-born con `SALE_BORN_CREDIT_DELETE_MSG` → ya escritoOff → pending ≤ 0 → sin pérdida de capital); `capitalLost = principal − Σ capitalPortion` (recomputado cronológico desde el helper — NO de `pending`, que incluye interés no realizado; legacy sin marcadores contabilizado igual); crea UN movimiento `creditGrantedWriteOff` (expense, Personal, categoría sintética creditGranted expense, link refId crédito + opId) y marca `writtenOff { date, movementId }`; devuelve el crédito actualizado; action con revalidación centralizada retorna `{ success: 'creditWrittenOff' }` (UI/i18n → Fase F). (5) **DESVÍO JUSTIFICADO — mínimo infra autorizado**: para que add/edit/delete/write-off no dejen movimientos huérfanos (R5/R6), la Fase D incorporó lo mínimo de Fase E: schema abonos (capitalAmount/interestAmount/interestMovementId), schema padre (`writtenOff`), mappers ida/vuelta, `editAbono` con `$unset` (undefined explícito → $unset; documentado en el contrato del repo), `markWrittenOff` ($set), y `CreditAbono.interestMovementId` (compartido; received solo tolera). Fase E queda reducida a: `compute-activos-pasivos` excluyendo writtenOff del activo + QA. (6) **Tests**: +22 (addAbono R9 ×4: capital-only/split/100% interés/legacy sale-born; editAbono R9 ×5: shrink, interés→0 con unset, interés aparece, 100% sin duplicado, date-only legacy con guard; deleteAbono ×2; writeOff ×7; markAsPaid split ×1; actions ×3); fakes actualizados por cambio de contrato (sales/get-sale-detail/reconcile). Suite **586/586** en 54 archivos, `tsc --noEmit` limpio (verificación independiente del orquestador: corrida propia + diff estratégico add/edit/delete/write-off/model/mapper/repo). **Archivos: write-off-credit-granted.ts (NUEVO), actions.test.ts (NUEVO), add-abono.ts, edit-abono.ts, delete-abono.ts, index.ts, repositories.ts, credit-received.ts, credit-granted.ts, credit-granted-repository.ts, mappers/credit-granted.ts, models/credit-granted.ts, actions.ts, credits-granted.test.ts, sales.test.ts, get-sale-detail.test.ts, reconcile.test.ts.** **Aviso explícito para FASE E (posición financiera: excluir writtenOff del activo + QA completa).**
- 2026-08-29 (mismo día) — **FASE E COMPLETADA** (3 archivos; sin commit aún al momento de escribir). Posición financiera (D9.4 parte final). (1) **`compute-activos-pasivos.ts`**: el input `creditsGranted` gana `writtenOff?: boolean` (opcional — no rompe callers); el loop de activos salta el crédito con `writtenOff` además del `pending <= 0` existente → un crédito dado de baja ya no cuenta como activo (dejó de ser cobrable; el gasto por pérdida ya quedó en el historial vía Fase D, y el `pending` no se toca). JSDoc actualizado. (2) **`dashboard/page.tsx`**: el ÚNICO caller pasa `writtenOff: Boolean(c.writtenOff)` en el map (las entidades `CreditGranted` se usan server-side en el dashboard; `toJSON()` ya expone `writtenOff`). (3) **Tests**: +3 en `compute-activos-pasivos.test.ts` (writtenOff true → no suma; sin writtenOff → suma intacto; mezcla vivo/castigado). Suite **589/589** en 54 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador (diff + corrida propia). **Archivos: compute-activos-pasivos.ts, dashboard/page.tsx, compute-activos-pasivos.test.ts.** **Aviso explícito para FASE F (UI + i18n: botón "Dar de baja" WriteOffButton variant danger + confirm dialog, badge "Incobrable"/"Written off", ocultar/deshabilitar abono/marcar pagado/editar/borrar cuando writtenOff, mostrar porciones capital/interés en detalle, keys es/en, tests de acciones/ui).**
- 2026-08-29 (mismo día) — **FASE C COMPLETADA** (10 archivos: 7 modificados + 3 nuevos; sin commit aún al momento de escribir). Dominio + kinds (D9.1–D9.4). (1) **kinds**: `MOVEMENT_LINK_KINDS` += `creditGrantedAbonoInterest` + `creditGrantedWriteOff` (guard derivado automático). (2) **Helper puro** `splitAbonoCapitalInterest` en `src/core/application/credits-granted/split-abono.ts` (cerca del consumer de Fase D): amortización cronológica `capitalPortion = min(abono, principal − capitalRecoveredSoFar)`, `interestPortion = abono − capitalPortion`; usa **minor units number** (no Money) porque las porciones pueden ser 0 (todo capital o todo interés) y `Money` rechaza `amount <= 0`; el use case de Fase D envolverá con Money al persistir. (3) **Entidad**: `CreditAbono` (compartido received/granted) gana `capitalAmount?`/`interestAmount?` opcionales (informativos, received solo los tolera); `CreditGranted` gana `writtenOff?: { date, movementId }` en input/entidad/toJSON SIN validación en constructor (la enforce vive en el use case de Fase D); toJSON serializa abonos con las porciones vía `.toJSON()` (frontera server→client segura). (4) **economía**: `creditGrantedAbono` → `NON_ECONOMIC_LINK_KINDS`; `creditGrantedAbonoInterest`/`creditGrantedWriteOff` quedan económicos (no en el set); `salePayment`/received/payables intactos. (5) **DESVÍO JUSTIFICADO — predicado context-aware**: la auditoría del plan (R9.2.3) asumía "ventas usan salePayment", pero la realidad del código es que el **pago inicial de una venta POS a crédito reusa el kind `creditGrantedAbono` con context Business** (`create-sale.ts:237`, primer abono del crédito, decisión R5/D3-bis; `sales.test.ts:589,690` lo convalida). Excluir `creditGrantedAbono` incondicionalmente habría roto el criterio de éxito 5 (ventas intactas: el pago inicial es ingreso comercial). Solución: `countsTowardEconomicResult` devuelve TRUE para `creditGrantedAbono` + context `Business` (pago inicial POS) y FALSE para Personal/undefined (recuperación de capital standalone) — ÚNICA excepción al "exclusión solo por kind" de R8, documentada en el JSDoc. (6) **Tests**: +16 (10 economic-result + 6 split-abono: incluye criterios 1 y 2 de R9.3 + bordes); 3 tests R8 actualizados al nuevo contrato (dashboard-summary: standalone NO ingreso vs POS initial payment SÍ ingreso; category-summary y yearly-evolution: income de crédito otorgado ahora `creditGrantedAbonoInterest`). Suite **564/564** en 53 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador (diff completo + corrida propia de suite y tsc). **Archivos: movement.ts, credit-received.ts, credit-granted.ts, economic-result.ts, split-abono.ts (NUEVO), split-abono.test.ts (NUEVO), economic-result.test.ts (NUEVO), compute-dashboard-summary.test.ts, compute-category-summary.test.ts, compute-yearly-evolution.test.ts.** **Aviso explícito para FASE D (use cases granted: add-abono con split + mark-as-paid hereda + edit/delete con 2 movimientos + writeOff + action).**
