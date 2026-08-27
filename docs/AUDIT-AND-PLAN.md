# TWINCAP — PLAN DE IMPLEMENTACIÓN

> **Este documento es el plan maestro y documento de continuidad del proyecto.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` y este documento ANTES de empezar.**
>
> **Después de una compactación o en una nueva sesión, lo PRIMERO es leer este archivo.**
>
> Lineamientos de la ronda actual: `Ronda4.md` (raíz del repositorio) — documento de requerimientos, NO archivo de estado.

---

## ESTADO ACTUAL (última actualización: 2026-08-26)

| Ronda | Estado |
|-------|--------|
| Ronda 1 — fases 0–22 | ✅ Completa |
| Ronda 2 — Auditoría y mejoras | ✅ Completa (Fases 0–10 + post-ronda branding; detalle en git history del doc y `Ronda 2.md`) |
| Ronda 3 — Auditoría integral, corrección financiera, dashboard, evolución funcional | ✅ **COMPLETADA (2026-08-25).** 12 fases ejecutadas y verificadas. Auditoría final: 0 CRITICAL, 7 MINOR (no bloqueantes). Suite 412/412 tests en 42 archivos, tsc limpio. Fixes de usuario incluidos: sort por fecha, logout confirmation, placeholders "Seleccionar", transición theme suave, badge "Pagado" en créditos. |
| **Ronda 4 — Rediseño y evolución del Dashboard financiero** | ✅ **COMPLETADA (2026-08-26).** 6 fases (A→F). Dashboard rediseñado: jerarquía visual, tablas resumen ingresos/gastos por categoría, filtros composables, gráfico anual filtrado, movimientos responsive con columna Category. Suite 428/428, tsc, build limpios. Commits: `cd1bdd2`, `80dd92c`, `5dea992`, `10d6e0b`. |
| **Ronda 5 — Integridad financiera, créditos con cuotas, fix dashboard, onboarding** | 🔄 **EN PROGRESO (2026-08-27).** Replanteo aprobado por el usuario tras hallazgos críticos de integridad (venta↔crédito con dos fuentes de verdad). Fases A–F + QA. Suite base 426/428 (2 timeout de bcrypt por entorno, ajeno). Commits previos de una ronda 5 anterior (no reemplazada): `c996ff1`, `3b073ea`, `b6dba3f`, `e523520`. |

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

## PROTOCOLO POST-COMPACTACIÓN

Si el contexto se compacta o inicia nueva sesión:

1. **Leer este archivo completo** (`docs/AUDIT-AND-PLAN.md`)
2. **Leer `AGENTS.md`**
3. **Buscar en Engram:** `mem_search(query: "TwinCap", project: "twincap")`
4. **Identificar el estado actual** — Rondas 1–4 completadas. Ronda 5 en progreso (plan aprobado, auditoría completada). Deuda técnica: R4-A1 (performance), R4-A2 (multi-moneda).
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
