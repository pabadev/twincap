# TwinCap — Diseño Conceptual del Resumen

> **Fase**: UX-5 · **Fecha**: 13 de septiembre de 2026 · **Estado**: DISEÑO PROPUESTO (pendiente de aprobación según protocolo)
> **Fuente normativa**: `docs/freeze + UX-UI.md` (prompt maestro, §§2, 8, 9, 10, 16, 25, 40, 41, 56)
> **Documentos relacionados**: `UX-INFORMATION-ARCHITECTURE.md` (DEC-IA-01/07), `UX-DESIGN-SYSTEM.md` (DEC-DS-01/02/09/12), `UX-UI-AUDIT.md` (H-17/H-18/H-07), `UX-ROADMAP.md` (ronda vigente, fase UX-5), `UX-COMPETITIVE-RESEARCH.md` (lección 2)
> **Alcance**: Diseño CONCEPTUAL. Este documento NO implementa código: todo lo nuevo que el frontend necesite recibir se declara como extensión del **snapshot** servidor (nunca del dominio), y las extensiones de dominio se marcan como **bloqueadas**.

---

## 1. Objetivo y encuadre

### 1.1 Objetivo

Definir el diseño conceptual de la página **Resumen** (hoy "Dashboard"/"Panel", véase DEC-IA-01) que cumple la Regla de Oro del prompt maestro (§41): **cinco preguntas respondidas en diez segundos**, con cifras veraces, sin recálculo en el frontend y sin tocar el dominio financiero congelado (PROJECT-RULES §18).

### 1.2 Relación con las decisiones aprobadas

Este documento **ejecuta** — no redefine — las decisiones ya aprobadas por el fundador:

| Decisión | Qué ejecuta aquí |
|---|---|
| DEC-IA-01 | El módulo se llama **Resumen** ("Summary" en inglés) en todo texto visible; "Dashboard"/"Panel" queda solo como término interno de código/ruta. |
| DEC-IA-07 | El nivel 1 del Resumen muestra **Disponible por moneda + Resultado del período**. |
| DEC-IA (jerarquía, sección 9) | Estructura en 5 niveles (N1…N5) y selector de período explícito (§9.3), conservando los filtros ya existentes. |
| DEC-DS-01/02 | Tokens de color y tipografía: **Sora** para cifras N1, títulos de nivel 1 y hero; **Geist Sans** para cuerpo y el resto. |
| DEC-DS-09 | Mapeo completo de los 12 estados a las regiones del Resumen (sección 7). |
| DEC-DS-12 | Confianza visible: fuentes de datos y fechas de actualización legibles en cada nivel. |

### 1.3 Reglas innegociables

1. **Cero recálculo en el frontend**: el frontend presenta lo que el servidor entrega en el snapshot. Ninguna métrica se calcula en el cliente; una resta simple de presentación (Resultado = ingresos − gastos por moneda) se declara y, para el rigor estricto del §40, se entrega también desde el servidor (véase 3.2).
2. **Cero llamadas nuevas al dominio**: todo dato faltante se resuelve con agregación server-side sobre las entidades que el Resumen **ya lee** (cuentas, movimientos, categorías, créditos recibidos/otorgados, pagables, ventas, transferencias). No hay métodos nuevos de repositorio ni reglas nuevas.
3. **Cero cambios de cálculo**: las reglas económicas vigentes (proyecto §9.1) son intocables; las métricas nuevas se derivan de los agregadores existentes (`countsTowardEconomicResult`, buckets mensuales reales, `pending` derivados).
4. **Por moneda, sin FX**: ninguna cifra suma divisas distintas (R15.3.1 P1.3; `MultiCurrencyValue` ya lo garantiza: suma solo en la ruta mono-moneda).
5. **Fechas civiles con timezone explícita** (§9.6): todos los períodos se calculan sobre fecha civil del cliente (patrón A2: `tzOffsetMinutes`, hoy 300 = UTC−5), nunca con el reloj UTC del servidor y jamás con offsets ±1 día.

### 1.4 Convención de veracidad

Cada afirmación sobre la plataforma lleva una etiqueta:

- **[EXISTENTE]** — verificado en el código actual (lectura realizada el 13-09-2026).
- **[DISEÑO PROPUESTO]** — decisión de esta fase; propone desplazar/renombrar lo existente o nueva presentación.
- **[REQUIERE EXTENSIÓN SNAPSHOT]** — el dato no llega hoy al frontend; se agrega server-side en `buildDashboardSnapshot` con los insumos que ya lee. Sin cambios de dominio ni de repositorios.
- **[BLOQUEADO — DOMINIO CONGELADO]** — requiere cambio de entidad/regla de dominio; se documenta como trabajo futuro post-freeze, nunca se diseña como cambio.

---

## 2. Estructura visual por niveles

La jerarquía DEC-IA (sección 9) se mapea a regiones de la página. El orden N1→N5 es **el mismo en los tres breakpoints** (mismo modelo mental móvil/desktop); lo que cambia es el layout.

| Nivel | Región | Propósito (pregunta que responde) |
|---|---|---|
| **N1** | Hero: **Resultado del período** + **Disponible por moneda** + variación % | "¿Estoy ganando o perdiendo? ¿Cuánto tengo disponible?" |
| **N2** | Desglose: ingresos, gastos, Top 5 categorías, split Personal/Negocio, financiamiento (colapsable) | "¿De dónde viene? ¿Por qué?" |
| **N3** | Evolución: gráfico 6/12 meses reales + selector de moneda | "¿Cómo viene la tendencia?" |
| **N4** | Atención: Por cobrar / Por pagar + alertas condicionales (empty por defecto) | "¿Hay algo que requiera mi acción?" — NUNCA una pared de alertas (§25) |
| **N5** | Detalle: movimientos recientes (10), cuentas, posición financiera, accesos a módulos | "¿Qué pasó exactamente? ¿A dónde voy para profundizar?" |

### 2.1 Wireframe — móvil 375px (columna única)

```
┌──────────────────────────────────────┐
│ Resumen          ⡇  [Mes|Año|12m]    │  header (48px)
├──────────────────────────────────────┤
│ • Resultado · sept        [ver+18% ] │  N1 HERO (sin scroll móvil)
│   ▲ +$1.250.000                      │  Sora 30px, signo+color semántico
│   vs ago: ▲ +$190.000                │  variación inline
│ • Disponible por moneda              │
│   COP $3.400.000                     │  máx 3 monedas, sin sumar divisas
│                                       │
├──────────────────────────────────────┤
│ Ingresos            +$2.100.000      │  N2 DESGLOSE
│ Gastos              −$850.000        │
│ ┌ Personal ▸ ┌ Negocio ▸             │  split conservado (colapsable)
│ Top 5 · este mes                     │
│  1) Sueldos      +$1.400.000         │
│  2) Ventas POS   +$350.000           │
│  ▾ ver 3 más                         │
│ Financiamiento ▸ (colapsable)        │
├──────────────────────────────────────┤
│ Evolución  [Mensual|Anual]           │  N3 (compacto: 160px alto)
│  ▂▃▅▂▇█▃▄  [moneda: COP ▾]         │
├──────────────────────────────────────┤
│ Atención                             │  N4
│  Por cobrar    COP $900.000          │
│  Por pagar     COP $350.000          │  empty default: "Nada requiere
│  ⚠ Pago vencido · Proveedor X 7d    │  tu atención" → sin tarjetas
│  [Revisar]                           │  máx 3 alertas (sección 5)
├──────────────────────────────────────┤
│ Movimientos recientes                │  N5 (10 ítems)
│  +$450.000 Ventas POS  12 sep ▸      │
│  −$120.000 Mercado     11 sep ▸      │
│  ▾ ver todos                          │
│ Cuentas (desglose por cuenta)        │
│  Caja COP $1.900.000                 │
│  Banco COP $1.500.000                │
│ Posición financiera ▸                │
│ Accesos: Movimientos · Ventas ·      │
│  Créditos · Pagos · Transferencias   │
├──────────────────────────────────────┤
│[+ Nuevo ] [Venta] [Abono]            │  barra de acciones fija inferior
└──────────────────────────────────────┘   (sección 6)
```

### 2.2 Wireframe — tablet 768px (grid de 2 columnas)

```
┌──────────────────────────────────────────────────┐
│ Resumen          [Mes|Año|12m]  [+ Nvo][▸ Venta] │  header
├──────────────────────────────────────────────────┤
│ N1 HERO · full width (2 panes)                   │
│ ┌ Resultado · sept ─────────┐ ┌ Disponible ─────┐│
│ │ ▲ +$1.250.000  ver +18%   │ │ COP $3.400.000  ││
│ │ vs ago: ▲ +$190.000       │ │ USD $1.200      ││
│ └───────────────────────────┘ └─────────────────┘│
├─────────────────────────────┬────────────────────┤
│ N2 DESGLOSE                 │ N3 EVOLUCIÓN       │
│ Ingresos   +$2.100.000      │ [Mensual|Anual]    │
│ Gastos     −$850.000        │  ▂▃▅▂▇█▃▄▅▆▇█      │
│ Top 5 (2 col)               │  [moneda: COP ▾]   │
│ Personal/Negocio · Financ ▸ │                   │
├─────────────────────────────┴────────────────────┤
│ N4 ATENCIÓN                                      │
│ ┌ Por cobrar COP $900k ┐ ┌⚠ Pago vencido·7d ┐   │
│ │ Por pagar  COP $350k │ │ [Revisar]         │   │
│ └──────────────────────┘ └───────────────────┘   │
├──────────────────────────────┬───────────────────┤
│ N5 DETALLE                   │                   │
│ Movimientos recientes (10)   │ Cuentas           │
│                              │ Posición fin ▸    │
│                              │ Accesos a módulos │
└──────────────────────────────┴───────────────────┘
```

### 2.3 Wireframe — desktop 1280px (max-w-screen-2xl)

```
┌──────────────────────────────────────────────────────────────────┐
│ Resumen          [Mes|Año|12m]   [+ Nuevo] [+ Venta] [+ Abono]   │
├──────────────────────────────────────────────────────────────────┤
│ N1 HERO · full width (2 panes)                                   │
│ ┌ Resultado · sept ─────────────────┐ ┌ Disponible por moneda ─┐ │
│ │ ▲ +$1.250.000          ver +18%   │ │ COP $3.400.000         │ │
│ │ vs ago: ▲ +$190.000               │ │ USD $1.200             │ │
│ │ Fuente: snapshot · corte 12 sep    │ └───────────────────────┘ │
│ └────────────────────────────────────┘                          │
├──────────────────────────────────────────┬───────────────────────┤
│ N2 DESGLOSE                              │ N3 EVOLUCIÓN          │
│ Ingresos +$2.100.000  Gastos −$850.000   │ [Mensual|Anual]       │
│ Top 5 ingresos/gastos (2 col, tablas)    │  ▂▃▅▂▇█▃▄▅▆▇█        │
│ Personal ▸ · Negocio ▸ · Financiamiento ▸│  [moneda: COP ▾]      │
├──────────────────────────────────────────┴───────────────────────┤
│ N4 ATENCIÓN                                                     │
│ ┌ Por cobrar  COP $900.000 ┐ ┌ Por pagar COP $350.000 ┐ ┌⚠ … ┐ │
│ └──────────────────────────┘ └─────────────────────────┘ └─────┘ │
├───────────────────────────────────────────┬──────────────────────┤
│ N5 DETALLE (2/3)                          │ N5 (1/3)             │
│ Movimientos recientes (10)                │ Cuentas              │
│  · tabla fecha|categoría|cuenta|monto     │ Posición financiera  │
│  [Exportar CSV] [Ver todos]               │ Accesos a módulos    │
└───────────────────────────────────────────┴──────────────────────┘
```

### 2.4 Notas de lectura de los wireframes

- Color semántico SOLO donde hay significado financiero: verde si Resultado ≥ 0, rojo si < 0 (nunca color como único canal: siempre signo explícito +/−; neutro en 0). Disponible usa texto legible, no semántica de "ganancia".
- La variación % es **inline a la cifra del hero** (etiqueta + flecha), nunca una tarjeta separada: reduce a 4 el número de tarjetas del nivel 1 y garantiza "sin scroll en móvil para las cifras N1".
- El gráfico conserva el patrón existente (barras `bg-income`/`bg-expense`, alternancia Mensual/Anual, selector de moneda) y añade los estados dispuestos en turno (sección 7).
- N4 por defecto NO ocupa espacio: con empty state solo se ven Por cobrar / Por pagar; las alertas aparecen solo cuando existen condiciones (sección 5).

---

## 3. Definición exacta de métricas

> Signo: ingresos y abonos recuperadores de capital positivos; gastos negativos. "Este mes" = mes civil actual del cliente. "Resultado" = ingresos económicos − gastos económicos del período (agnóstico al `type`; ver §40.1).

### 3.1 Tabla maestra

| # | Métrica (es/en) | Fórmula de negocio (qué kinds la componen) | Origen en el snapshot | Breakpoints | Estado vacío |
|---|---|---|---|---|---|
| 1 | **Resultado del período** / *Period result* | Σ ingresos económicos − Σ gastos económicos del período, por moneda. Los kinds económicos se resuelven con `countsTowardEconomicResult` (context-aware): excluye transferencias, apertura, capital de financiamiento (`creditReceivedPrincipal`, `creditGrantedPrincipal`), abonos de crédito otorgado standalone (solo el excedente `creditGrantedAbonoInterest` es ingreso; `creditGrantedWriteOff` es gasto); el abono de venta POS a crédito con context Business SÍ es ingreso. | `currencyBreakdown[].income − expenses` [EXISTENTE ✗ operands] → campo `result` nuevo por moneda **[REQUIERE EXTENSIÓN SNAPSHOT]** | 375 / 768 / 1280 | Hero: "Sin movimientos este período" (ver 7) |
| 2 | **Disponible por moneda** / *Available by currency* | Σ saldos de cuentas de la moneda (firmado, sin FX). No es resultado económico: es flujo (proyecto §9.2, "saldo ≠ resultado"). | `currencyBreakdown[].balance` **[EXISTENTE]** (máx 3 monedas por saldo |descendente; "+N más" en detalle) | 375 / 768 / 1280 | Sin cuentas → CTA "Crear cuenta" (first-use, patrón existente del onboarding) |
| 3 | **Variación % vs período anterior** / *Change vs previous period* | ((valor período / valor período anterior) − 1) × 100, por moneda, para Resultado y para Ingresos/Gastos. Mes scope: vs mes civil anterior (buckets reales `monthlyData`); Año/12m: vs período anterior equivalente. Si no hay dato anterior → "—" (NUNCA 0 % engañoso). | `monthlyData` [EXISTENTE, datos] → campos `resultChangePct`, `incomeChangePct`, `expenseChangePct` por moneda **[REQUIERE EXTENSIÓN SNAPSHOT]** (Año/12m requieren ventana ampliada, ver 8.2 de este doc / 4.2) | 375 / 768 / 1280 | Sin período anterior → "—" |
| 4 | **Ingresos del período** / *Period income* | Σ ingresos económicos por moneda (mismos kinds que #1). | `currencyBreakdown[].income` **[EXISTENTE]** | 375 / 768 / 1280 | `noIncomeData` (existente) |
| 5 | **Gastos del período** / *Period expenses* | Σ gastos económicos por moneda. | `currencyBreakdown[].expenses` **[EXISTENTE]** | 375 / 768 / 1280 | `noExpenseData` (existente) |
| 6 | **Top 5 categorías** / *Top 5 categories* | Primeras 5 filas de ingresos/gastos del mes, por moneda (el servidor ya entrega `incomeRows`/`expenseRows` ordenadas descendente; `slice(0,5)` es presentación, no cálculo). | `incomeRows`, `expenseRows`, `incomeTotals`, `expenseTotals` **[EXISTENTE]** | 768 / 1280 (tabla doble); 375 (lista concisa) | `noIncomeData`/`noExpenseData` |
| 7 | **Split Personal/Negocio** / *Personal/Business split* | Ingresos/gastos del mes por contexto y moneda (resumen contextual). | `contextSummary` **[EXISTENTE]** | 375 (colapsable) / 768 / 1280 | Sin datos de un contexto → se oculta ese contexto |
| 8 | **Flujos de financiamiento** / *Financing flows* | Entradas/salidas de financiamiento del mes (capital de créditos recibidos/otorgados; NO económicas). | `financingInflow`, `financingOutflow` **[EXISTENTE]** | colapsable en N2 (todos los breakpoints) | Sin flujos → sub-región oculta |
| 9 | **Evolución 6 meses** / *6-month trend* | Serie mensual real de ingresos/gastos (últimos 6 meses civiles, el último = mes actual). | `monthlyData` **[EXISTENTE]** | 768 / 1280; 375 compacto 160px | EmptyState: "Sin movimientos en este período" |
| 10 | **Evolución anual** / *Annual trend* | Serie mensual real del año civil actual (12 buckets). | `yearlyData` **[EXISTENTE]** | 768 / 1280; 375 (toggle Mensual/Anual) | EmptyState |
| 11 | **Por cobrar** / *Receivables* | Σ pendientes por cobrar, por moneda: `CreditGranted.pending` (no castigados) + `Sale.pending` de ventas a crédito (POS), más antiguo primero. | datos en el [EXISTENTE] agregador `computeActivosPasivos` (fusionados en activos) → campo `receivables` nuevo por moneda **[REQUIERE EXTENSIÓN SNAPSHOT]** | 375 / 768 / 1280 | "Nada por cobrar" |
| 12 | **Por pagar** / *Payables* | Σ pendientes por pagar, por moneda: `CreditReceived.pending` + `Payable.pending`, con vencimiento más próximo primero (usa `dueDate`, que existe en Payable). | ídem → campo `payables` nuevo por moneda **[REQUIERE EXTENSIÓN SNAPSHOT]** | 375 / 768 / 1280 | "Nada por pagar" |
| 13 | **Movimientos recientes (10)** / *Recent movements (10)* | 10 movimientos más recientes del mes civil actual. El snapshot hoy serializa 5 (`recentMovements`). | `recentMovements` **[EXISTENTE]** → slice server-side ampliado a 10 **[REQUIERE EXTENSIÓN SNAPSHOT leve]** | 375 (lista) / 768 / 1280 (tabla) | `noMovementsMessage` (existente) |
| 14 | **Desglose por cuenta** / *Accounts* | Saldo por cuenta (nombre, moneda, saldo firmado). | `accountBalances` **[EXISTENTE]** | 375 / 768 / 1280 (panel 1/3 en desktop) | `noAccountsMessage` (existente) |
| 15 | **Posición financiera** / *Financial position* | Activos, pasivos y neto por moneda (activos = saldos + créditos otorgados pendientes no castigados; pasivos = créditos recibidos + payables pendientes; sin FX). | `positionData` **[EXISTENTE]** (llega por separado de `page.tsx`) | 768 / 1280 (panel 1/3); 375 colapsable en N5 | `noPositionData` (existente) |
| 16 | **Accesos a módulos** / *Module shortcuts* | Grilla de accesos a movimientos, transferencias, créditos recibidos/otorgados, cuentas por pagar, ventas POS. | grilla `DashboardReportsGrid` **[EXISTENTE]** → se REUBICA en N5 (relocation, sin nueva funcionalidad) **[DISEÑO PROPUESTO]** | 375 / 768 / 1280 | No aplica (siempre visible; el módulo destino tiene su propio vacío) |

### 3.2 Extensiones de snapshot necesarias (lista exacta)

Todas viven en `src/core/application/dashboard/build-dashboard-snapshot.ts` y tipos derivados (`dashboard-types.ts`), usando SOLO insumos ya leídos. Cero cambios de repositorio, cero cambios de dominio, cero reglas nuevas:

- `CurrencyBreakdown` + campo `result: Money` (por moneda): ingresos − gastos del período, ya con signo.
- `DashboardMonthlySummary` + `resultChangePct`, `incomeChangePct`, `expenseChangePct` (por moneda), derivados de los buckets de `monthlyData`.
- Snapshot + `receivables: CurrencyBreakdown[]` y `payables: CurrencyBreakdown[]` (por moneda; totales de 11 y 12 de la tabla; la lista itemizada vive en el fetch de N4 si el módulo destino la necesita).
- `recentMovements`: slice 5 → 10.

### 3.3 Bloqueos por freeze

| Necesidad | Bloqueo | Trabajo futuro (post-freeze) |
|---|---|---|
| Alerta "cobro vencido" de créditos otorgados/ventas a crédito | `CreditGranted` y `Sale` **no tienen `dueDate`** en el dominio congelado ([EXISTENTE][BLOQUEADO — DOMINIO CONGELADO]); `Pending` siempre se deriva, nunca se almacena | Extensión de dominio: `dueDate` en `CreditGranted` (+ `Sale.on-credit`), con su impacto en reglas de amortización. Se documenta en el backlog como entrada de extensión de dominio, sin diseñar aquí |
| Vencidos de **Por pagar** | **SÍ factible**: `Payable.dueDate?` existe como opcional ([EXISTENTE]). Si falta → sin alerta, solo orden "más próximo primero" | — (ninguno; se diseña en 5.1) |

---

## 4. Periodos y filtros

### 4.1 Período por defecto y timezone

- El Resumen abre en **Mes = mes civil actual del cliente**. Todas las métricas N1/N2/N5-recientes siguen ese corte.
- Regla de fechas (§9.6): el servidor recibe `tzOffsetMinutes` del cliente (patrón A2 existente, hoy 300 = UTC−5) y calcula `from`/`to` como instantes civiles: **inicio del mes civil** → **inicio del mes siguiente**, ambos midnight-UTC del cliente. Prohibido compensar con ±1 día.
- "Corte de datos": el hero muestra la fecha de corte del snapshot (fuente veraz, DEC-DS-12; hoy el builder lo calcula en `computeDashboardWindow` y el doc lo expone como **"corte 12 sep"** en nice a las 20:00 hora local) — **[DISEÑO PROPUESTO]**: exponer en el snapshot `dataAsOf` (fecha civil) y mostrarlo bajo el hero y en el pie del gráfico.
- El snapshot no lleva `dataAsOf` hoy **[REQUIERE EXTENSIÓN SNAPSHOT leve]**: derivar del `from`/`to` del período (un `Date` civil, sin timezone importada).

### 4.2 Selector de período

- **[DISEÑO PROPUESTO]** [Mes | Año | 12m] con `aria-pressed` (cierra H-18): píldoras en el header del Resumen (móvil: misma fila del header, compactas). El selector se reintroduce tras su retiro en la N2 pre-beta, respaldado por DEC-IA §9.3 ("selector de período explícito; los filtros ya existen — conservar").
- Semántica:
  - **Mes** (default): N1/N2/N5-recientes del mes civil actual.
  - **Año**: N1/N2 del año civil actual (agregación server-side de los 12 buckets de `yearlyData`; hoy la serie existe para el gráfico, los totales anuales son nueva agregación) **[REQUIERE EXTENSIÓN SNAPSHOT]**.
  - **12m**: últimos 12 meses civiles. La ventana de lectura actual (`computeDashboardWindow` = año civil ∪ últimos 6 meses) **no cubre** el caso (p. ej. cortar 12 meses atrás desde septiembre deja fuera meses del año previo) → ampliar la ventana (`from` más atrás) con el mismo método del repositorio **[REQUIERE EXTENSIÓN SNAPSHOT]**, sin métodos nuevos ni cambios de dominio.
- El cambio de período se resuelve por Server Action (`getDashboardSnapshotAction` gana el parámetro `period`); el frontend solo pide otro corte. No hay recálculo local.

### 4.3 Filtros viajeros (contrato)

- **[DISEÑO PROPUESTO]** Toda acción "Revisar"/"Ver todos"/fila de movimiento navega con un contrato explícito de query params: `?periodo=MES|ANO|12M&mes=YYYY-MM&cuenta=<id>&categoria=<id>`. El Resumen los emite; los módulos destino los consumen como **estado inicial**.
- Impacto declarado: la página de Movimientos HOY no lee `searchParams` ([EXISTENTE]); sus filtros son estado cliente (`selectedAccountId`, `scope`, `typeTemp` en `movements-list.tsx`). Consumir el contrato como estado inicial es trabajo de UX-6 (no de esta fase) — **[DISEÑO PROPUESTO, ejecución diferida]**, queda registrado como dependencia de UX-6/UX-10.
- Los filtros existentes del Resumen (cuenta, categoría, contexto) se conservan tal cual ([EXISTENTE]), sin sumar lógica.

---

## 5. Alertas

Principios (§25): **nunca una pared de alertas**; región N4 con empty state por defecto; máximo **3 alertas visibles** a la vez (prioridad: vencimiento > saldo negativo > gasto atípico); formato compacto (icono + título + 1 línea + [Revisar]); "Revisar" navega con filtro viajero (4.3).

### 5.1 Umbrales exactos

| Alerta (es/en) | Condición | Origen | Comportamiento al resolverse |
|---|---|---|---|
| **Pago vencido** / *Overdue payment* | `Payable.dueDate` < hoy (fecha civil) ∧ `Payable.pending > 0` (el pending siempre es derivado, nunca almacenado) | Payables ya leídos → **[REQUIERE EXTENSIÓN SNAPSHOT]** (lista de id + días de atraso, por moneda) | Desaparece sola cuando `pending = 0` ([Payable.pending] derivado; el abono la resuelve) |
| **Saldo negativo** / *Negative balance* | `currencyBreakdown[].balance < 0` (por moneda) | **[EXISTENTE]** (balance firmado por moneda); la regla de flag es **[DISEÑO PROPUESTO]** | Desaparece sola cuando el saldo ≥ 0; además la cuenta con saldo negativo muestra estado `danger` + microcopy "Saldo negativo" (DEC-DS-12) — estado de cuenta, NO banner |
| **Gasto atípico** / *Unusual expense* | `gastoMes > 1,5 × promedio(gastos de los 3 meses civiles completos anteriores)` ∧ `(gastoMes − promedio) ≥ 0,1 × ingresoMes`, por moneda. Umbral PROPUESTO (dato de configuración de fase, no de dominio) | Promedios derivables server-side de `monthlyData` **[REQUIERE EXTENSIÓN SNAPSHOT]** | Las condiciones se re-evalúan con cada corte; el dismiss (5.2) la silencia hasta el próximo mes |

### 5.2 Diseño y no repetición

- Cada alerta: icono + título + una línea de contexto + [Revisar] (filtro viajero). La alerta de pago vencido "Revisar" → módulo Por pagar; el Resumen no filtra el módulo hoy (sin FilterBar), se registra que UX-7 (Por pagar) podrá consumir el contrato — **[DISEÑO PROPUESTO, ejecución diferida]**.
- **Dismiss** (por alerta, no por categoría): botón "x" que guarda un id determinista (p. ej. `pago-vencido-<id>`, `neg-COP`, `gasto-atipico-<mes>-<moneda>`) en `localStorage` (`twincap.alertDismissed.v1`). **Solo ids, nunca montos** (cumple §45). El saldo negativo y el pago vencido **nunca se silencian permanentemente** (son estados, no eventos); el dismiss solo aplica al gasto atípico (evento del mes, el id cambia de mes a mes).
- No se persisten en servidor (sin nueva colección, sin dominio): local ⇄ resolución automática es suficiente en esta etapa.

### 5.3 Cobro vencido

No se diseña la alerta de "cobro vencido" para créditos otorgados/ventas a crédito: el dominio no expone vencimiento ([BLOQUEADO — DOMINIO CONGELADO], sección 3.3). La tarjeta **Por cobrar** mitiga mientras tanto listando los pendientes **más antiguos primero** con días de antigüedad (dato derivado de las fechas que sí existen) — **[DISEÑO PROPUESTO]**.

---

## 6. Acciones rápidas

### 6.1 Ubicación

- **Desktop (768/1280)**: botones en el header del Resumen: **[+ Nuevo movimiento]** (primario), [Nueva venta], [Registrar abono]. Destinos: `/movements`, `/pos/sales`, páginas de créditos — sin navegación nueva.
- **Móvil (375)**: barra de acciones **fija inferior**, centrada, por encima del safe-area, solo en el Resumen: [+ Nuevo] (primario, el que más se repite) + [Venta] + [Abono]. No interfiere con el FAB de feedback existente (abajo-derecha del `dashboard-content`) porque la barra ocupa el borde inferior completo y el FAB queda a su derecha con offset de seguridad — **[DISEÑO PROPUESTO]**; si en UX-10 colisionan, se resuelve en esa fase (registrado).

### 6.2 Justificación

Benchmark, lección 2 (UX-2): **registrar es la acción de menor fricción** en finanzas personales; un solo toque desde el Resumen esté donde esté la vista.

### 6.3 Copia

es/en, castellano neutro (sin voseo): `Nuevo movimiento` / `New movement`, `Nueva venta` / `New sale`, `Registrar abono` / `Record payment`. En móvil `+ Nuevo` / `+ New`.

---

## 7. Estados explícitos por región

Los 12 estados de DEC-DS-09 mapeados al Resumen:

| Estado | Región | Implementación |
|---|---|---|
| Default | Todas | Contenido en reposo según 2.x |
| Loading | Dashboard completo | Skeleton por región (existe `loading.tsx` rico [EXISTENTE]; se mantiene y se alinea a los 5 niveles) |
| Saving | Solo donde el Resumen participa (quick actions) | Botones con spinner + disabled (patrón DS) |
| Success | Todas | Estado de reposo |
| Error | Por región | Cartel parcial por región (patrón DS "error con reintento"); nunca rompe las demás regiones |
| Empty | N1 (hero), N2, N3, N4, N5 | `noIncomeData`, `noExpenseData`, `noMovementsMessage`, `noPositionData`, `noAccountsMessage` [EXISTENTES]; N4 por defecto vacío ("Nada requiere tu atención") **[DISEÑO PROPUESTO]**; hero vacío: "Sin movimientos este período" + CTA crear cuenta (first-use) **[DISEÑO PROPUESTO]** |
| Disabled | Selector de moneda en N3 sin datos | Deshabilitado por moneda sin datos |
| Featured | Resultado del hero (N1) | Primera tarjeta con énfasis (Sora + semántica) |
| Progress | Barra de progreso del mes (ingresos vs objetivo) — se omite: el dominio no tiene objetivos en esta ronda | No aplica hoy (sin datos de objetivo; se declara y no se fabrica) |
| Busy | Re-corte de período | `aria-busy` en la región que se refresca (no bloquea el resto) — **[DISEÑO PROPUESTO]** (hoy `aria-busy` global) — **[DISEÑO PROPUESTO]** |
| Failure | Snapshot fuera de servicio | Pantalla completa + reintento (patrón DS) |
| Focus | Elementos interactivos | Anillos de foco visibles (patrón existente) |

Nota de progreso/objetivos: la ronda actual no define objetivos financieros — **no se diseña** una barra de progreso inventada; el hueco se documenta en el backlog.

---

## 8. TTI (H-17)

Hallazgo H-17: TTI actual **no es verificable** con los criterios del roadmap (§83: frío < 10 s). Este diseño no garantiza — **mide** y propone.

### 8.1 Protocolo de medición propuesto (ejecución UX-5.1 "medición")

- Build de producción + medición **fría** (primer hit, caché vacía) y **caliente** (hit repetido) en los 3 breakpoints, con DevTools/Lighthouse (movile-3G + cable, sinoficina) y registro en el doc de la fase.
- Objetivo: frío < 10 s (roadmap §83); caliente < 2 s.

### 8.2 Hipótesis de mejora (todas PROPUESTA — se validan por medición, no por fe)

1. **Reducir lecturas duplicadas**: hoy la página lee el repositorio de movimientos dos veces (serie del período + saldos por cuenta); una sola lectura con split en memoria reduce I/O (sin cambio de dominio).
2. **react cache / RSC caching del builder**: el snapshot puro es cacheable por inputs; evaluar memoización por request scope (cache React), manteniendo `force-dynamic` global.
3. **Streaming por región**: Suspense por región (hero → desglose → resto) con skeletons; la Regla de Oro se satisface apenas llega el hero (N1), sin esperar N5 — el orden de streaming se define con este diseño.
4. **connectDb**: se mantiene global-singleton con no-op en caliente ([EXISTENTE], `proxy.ts`); cold start solo del proceso.
5. **Lazy-load del gráfico** (N3) y de los accesos (N5): segundo tiempo de carga, después de hero+N2.

---

## 9. Mapeo de hallazgos que cierra

| Hallazgo | Cierre propuesto |
|---|---|
| H-07 (naming del Resumen "Informes"/"Panel") | DEC-IA-01 aplicado: módulo **Resumen / Summary**. i18n: `Nav.dashboard` → `"Resumen"` (es) / `"Summary"` (en); `Dashboard.dashboard` → `"Panel"` (es) / `"Dashboard"` (en) y título del `<h1>` del Resumen = `"Resumen"` **[DISEÑO PROPUESTO, i18n es/en en paridad]** |
| H-17 (TTI no verificable) | Sección 8: protocolo de medición + hipótesis POR PROBAR (ninguna se declara ejecutada) |
| H-18 (`aria-pressed` en alternadores) | Selector de período (4.2) y toggle Mensual/Anual del gráfico (N3) con `aria-pressed`, siguiendo el patrón existente del MonthlyChart **[DISEÑO PROPUESTO]** |
| Deficiencia "Resumen débil en N1" (auditoría, sección B.8) | Hero N1 con Resultado + Disponible + variación, sin scroll en móvil, con fuentes de datos visibles (DEC-DS-12) |
| Grilla de reportes alta en la página | Relocación a N5 "Accesos" (2.1/2.2/2.3); el usuario no pierde el camino hacia los módulos desde el Resumen — **[DISEÑO PROPUESTO]** |
| `recentMovements` de 5 | Ampliación a 10 (3.2) |
| Filtros de Movimientos no accesibles por URL | Contrato de filtro viajero (4.3), ejecución en UX-6 — **[DISEÑO PROPUESTO, ejecución diferida]** |

---

## 10. Criterios de aceptación del diseño

### 10.1 Regla de Oro verificable (5 preguntas en 10 s) — mapeo pregunta → región

| Pregunta (§41) | Región que la responde |
|---|---|
| "¿Tengo más o menos plata que el mes pasado, y cuánto?" | N1 hero: Resultado + variación % inline |
| "¿Cuánto tengo disponible hoy?" | N1 hero: Disponible por moneda |
| "¿De dónde salió / a dónde se fue la plata?" | N2 desglose: ingresos/gastos + Top 5 + Personal/Negocio |
| "¿En qué va la tendencia?" | N3 evolución: gráfico 6/12 meses reales |
| "¿Hay algo que requiera acción?" | N4 atención: Por cobrar / Por pagar + alertas (empty por defecto) |

Verificación: un usuario que no conoce TwinCap responde las 5 en ≤ 10 s con los wireframes en 375/768/1280 (sesión de prueba con el fundador, sin datos reales).

### 10.2 Resto de criterios

1. **Paridad es/en**: toda etiqueta nueva tiene clave en `messages/es.json` y `messages/en.json`, castellano neutro (sin voseo ni regionalismos).
2. **Mismo modelo mental móvil/desktop**: los 5 niveles y su orden son idénticos en los 3 breakpoints (solo cambia la composición).
3. **Cero llamadas nuevas al dominio**: ninguna línea nueva fuera de los agregadores del dashboard existentes; repositorios iguales; reglas económicas intactas.
4. **Cero cambios de cálculo**: la única aritmética nueva (resultado, variación %, pendientes por cobrar/pagar) se resuelve en el servidor con los mismos `kinds`; el frontend no suma divisas entre sí.
5. **Sin scroll en móvil para las cifras N1** (mandato): el hero cabe completo en el primer viewport de 375 px (la prueba con datos lo confirma).

---

## 11. Tabla de decisiones (DEC-R)

| # | Decisión |
|---|---|
| DEC-R-01 | N1 hero = Resultado del período + Disponible por moneda + variación % inline; Sora; sin scroll en móvil. Ejecuta DEC-IA-07 y DEC-DS-02. |
| DEC-R-02 | Semántica de color SOLO con significado (Resultado ≥ 0/ < 0), siempre con signo explícito adicional; Disponible sin semántica de ganancia. |
| DEC-R-03 | N2 desglose = ingresos/gastos + Top 5 + split Personal/Negocio + Financiamiento colapsable (se conserva lo existente, se reordena). |
| DEC-R-04 | N3 evolución = gráfico real 6/12 m con toggle `aria-pressed` y selector de moneda (patrón existente conservado). |
| DEC-R-05 | N4 atención = Por cobrar / Por pagar + alertas condicionales (máx 3); empty por defecto; formato compacto con [Revisar]. |
| DEC-R-06 | Alertas: pago vencido (`Payable.dueDate` < hoy ∧ pending > 0), saldo negativo (balance < 0, estado de cuenta + warning en N4), gasto atípico (umbral 1.5×/10 % propuesto). Cobro vencido BLOQUEADO (dominio congelado; por cobrar se ordena por antigüedad). |
| DEC-R-07 | Extensiones de snapshot server-side exactas (3.2): `result`, variaciones %, `receivables`/`payables`, `recentMovements` 10, `dataAsOf`. Cero cambios de dominio/repos. |
| DEC-R-08 | Selector de período Mes/Año/12m server-side; default mes civil; ventana ampliada para 12m (mismo repo); timezone civil del cliente explícita (A2). |
| DEC-R-09 | Contrato de filtro viajero `?periodo=&mes=&cuenta=&categoria=`; Movimientos lo consume como estado inicial en UX-6 (ejecución diferida, registrada). |
| DEC-R-10 | Acciones rápidas: header en desktop; barra inferior fija en móvil (Nuevo movimiento primario). Evita perder el acceso en vistas largas (lección 2 del benchmark). |
| DEC-R-11 | Estados por región (sección 7) con `aria-busy` regional y error parcial; sin barra de progreso de objetivos (no existen en el dominio). |
| DEC-R-12 | Grilla de reportes relocada a N5 "Accesos" (renaming según DEC-IA-01); el acceso a cada módulo se conserva desde el Resumen. |

---

## 12. Descendencia a otras fases (no ejecutar aquí)

| Fase | Qué recibe de este diseño |
|---|---|
| UX-6 (Detalle de movimientos) | Contrato de filtro viajero como estado inicial; `searchParams` en la ruta |
| UX-7 (Por pagar / payables) | Consumo del contrato viajero para la alerta de pago vencido |
| UX-10 (Componentes finos) | Skeleton regional por Suspense; barra de acciones móvil vs FAB de feedback |
| UX-11/12 (Consistencia y TTI) | Resultados de la medición 8.1; validación de la Regla de Oro con datos reales |
| Backlog (post-freeze) | `dueDate` en `CreditGranted`/`Sale` para la alerta de cobro vencido (ver 3.3); objetivos financieros si el producto los adopta (ver 7) |

---

## Apéndice A — Fuentes verificadas (lectura del 13-09-2026)

- `src/app/(main)/dashboard/page.tsx`, `actions.ts`, `loading.tsx`
- `src/components/dashboard/{dashboard-content, summary-cards, dashboard-filters, recent-movements, monthly-chart, position-cards, dashboard-reports-grid, dashboard-snapshot}.tsx`
- `src/core/application/dashboard/{dashboard-types, build-dashboard-snapshot, compute-dashboard-window, compute-dashboard-summary, compute-yearly-evolution, compute-context-summary, compute-category-summary}.ts`
- `src/core/application/{economic-result, compute-activos-pasivos}.ts`
- `src/core/domain/{credit-granted, credit-received, payable, sale}.ts`
- `src/proxy.ts`, `messages/es.json`, `messages/en.json`
- Docs normativos: `docs/freeze + UX-UI.md`, `UX-INFORMATION-ARCHITECTURE.md`, `UX-DESIGN-SYSTEM.md`, `UX-UI-AUDIT.md`, `UX-ROADMAP.md`, `UX-COMPETITIVE-RESEARCH.md`

---

*Documento de diseño propuesto — sujeto a aprobación. Al aprobarse, las extensiones de snapshot (3.2) abrirán la fase de implementación UX-5 siguiendo el protocolo de ronda.*