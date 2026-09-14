# TWINCAP — ARQUITECTURA DE INFORMACIÓN — FASE UX-3

> **Fecha:** 2026-09-13
> **Estado:** ENTREGADA — documento de DISEÑO PROPUESTO (pendiente aprobación, protocolo R3.13)
> **Fuente normativa:** `docs/freeze + UX-UI.md` (prompt maestro §8/§9/§26/§27/§38/§41/)
> **Documentos relacionados:** `docs/UX-UI-AUDIT.md` (UX-1 — evidencia H-07/H-14/H-15), `docs/UX-COMPETITIVE-RESEARCH.md` (UX-2 — lecciones 1-3 y 8), `docs/UX-DESIGN-SYSTEM.md` (UX-4), `docs/UX-ROADMAP.md` (plan maestro)
> **Convención de veracidad:** VERIFICADO = resultado de auditoría/lectura; DISEÑO PROPUESTO = decisión de esta fase.

---

## 1. Base normativa y evidencia

| Fuente | Contenido que obliga |
|---|---|
| §8 | El Dashboard se trata conceptualmente como **RESUMEN**; el nombre visible prioriza "Resumen"; "Dashboard" solo como término técnico interno |
| §9 | Jerarquía de 5 niveles: ¿qué tan bien o mal estoy? → ¿por qué? → ¿qué cambió? → ¿qué debería revisar? → detalle |
| §26 | Progressive disclosure: esencial → contexto → detalle → configuración avanzada |
| §27 | Auditoría de navegación: nombres comprensibles, sin duplicación, sin opciones enterradas, mismo modelo mental móvil/desktop |
| §38 | Módulos con protagonismo diferenciado; CONFIGURACIÓN al final; no todos iguales |
| §41 | Regla de Oro: en 10 segundos saber cuánto tengo, qué pasa, si estoy mejor/peor, dónde está el problema y qué revisar |
| H-07 | Naming en conflicto "Informes" (nav) vs "Reportes" (sección) vs "Reportes y gráficos" (feature) — `messages/es.json:30,147,667` |
| H-14 | BackButton redundante con sidebar (`movements-list.tsx:201` y módulos raíz) |
| H-15 | Anchos divergentes (`max-w-3xl` vs sin límite vs `max-w-screen-2xl`) |
| Benchmark UX-2 | Lección 1 (Resumen = producto), 2 (fricción mínima), 3 (terminología de negocio), 8 (contexto LATAM móvil) |

---

## 2. Concepto central: el Resumen como "centro de comprensión financiera"

El prompt maestro cierra con la intención explícita: **no un dashboard lleno de KPIs, sino un centro de comprensión financiera**. La arquitectura de información de TwinCap se organiza alrededor de una sola tesis:

> Al abrir TwinCap, el usuario sabe dónde está financieramente en 5–10 segundos.

Eso NO significa "más cards en pantalla". Significa **progressive disclosure** (§26): el primer nivel responde el estado con un mínimo de números; cada nivel inferior explica el anterior. La navegación existe para alimentar esa visión (registrar, consultar, cobrar, pagar), no para competir con ella.

## 3. Decisión de naming unificado

| Término | Rol | Detalle |
|---|---|---|
| **Resumen** (es) / **Summary** (en) | Nombre visible del módulo principal | Reemplaza `Nav.dashboard: "Informes"` (es) / `"Reports"` (en). Resuelve H-07 |
| **Dashboard** | Término técnico interno | Ruta `/dashboard`, identificadores, código, documentación técnica. No se muestra al usuario |
| **Reportes** (es) / **Reports** (en) | Nombre de las secciones de reportes del Resumen y de la futura vista de reportes | Mantiene `Dashboard.reports: "Reportes"`; elimina la ambigüedad con "Informes" |
| **Ventas** (es) / **Sales** (en) | Nombre visible de `/pos/sales` | Reemplaza "Ventas POS": "POS" es jerga técnica que no aporta al dueño del negocio; la ruta se conserva |
| **Productos** (es) / **Products** (en) | Nombre visible de `/pos/catalog` | Reemplaza "Catálogo POS"; conversa con "Clientes" |

Cambios de nombre = cambios SOLO de etiqueta i18n y título de página. **No se altera ninguna ruta** (ver §5); el impacto en el dominio es nulo (cumple §18 PROJECT-RULES).

## 4. Navegación principal propuesta

### 4.1. Orden, nombres y rutas (DISEÑO PROPUESTO)

La navegación actual (VERIFICADO, `nav.tsx:17-32`) se reordena en 4 grupos con protagonismo diferenciado. Las rutas del App Router **se conservan íntegras** (salvo evidencia; la única ruta nueva propuesta es `/reports`, marcada como FUTURA).

| Tier | Grupo | Ítem (es / en) | Ruta | Cambio vs actual |
|---|---|---|---|---|
| **Tier 1 — Comprensión** | — | **Resumen** / Summary | `/dashboard` | Rename "Informes"→"Resumen" (H-07) |
| **Tier 1 — Comprensión** | — | **Movimientos** / Transactions | `/movements` | Se mantiene, asciende a Tier 1 (es el área más frecuente, §12) |
| Tier 2 — Operación | — | **Ventas** / Sales | `/pos/sales` | Rename "Ventas POS" |
| Tier 2 — Operación | — | **Cuentas** / Accounts | `/accounts` | Se mantiene |
| Tier 2 — Operación | — | **Clientes** / Clients | `/clients` | Se mantiene |
| Tier 3 — Compromisos | — | **Créditos otorgados** / Credits granted | `/credits/granted` | Reorden: "por cobrar" primero (lo que te deben, tarea recurrente) |
| Tier 3 — Compromisos | — | **Créditos recibidos** / Credits received | `/credits/received` | Se mantiene |
| Tier 3 — Compromisos | — | **Cuentas por pagar** / Payables | `/payables` | Se mantiene (el nombre ya es lenguaje de negocio) |
| Tier 3 — Compromisos | condicional | **Analítica** / Analytics | `/analytics` | Se mantiene (solo fundador, `nav.tsx:37-51`) |
| Tier 4 — Configuración | — | **Productos** / Products | `/pos/catalog` | Rename "Catálogo POS" + reubicación |
| Tier 4 — Configuración | — | **Categorías** / Categories | `/categories` | Reubicación (configuración de clasificación, no operación diaria) |
| Tier 4 — Configuración | — | **Mi perfil** / My profile | `/profile` | Reubicación desde footer (`nav.tsx:197-204`) |
| Tier 4 — Configuración | — | **Comentarios** / Feedback | `/feedback` | Reubicación desde footer (`nav.tsx:205-216`) |
| Tier 4 — Configuración | — | **Ayuda** / Help | `/help` | Incorporación al grupo (ruta existente) |
| Footer (global) | — | Email · Tema · Idioma · **Salir** | — | Perfil/Comentarios salen del footer; los controles globales permanecen (DEC-IA-11) |

### 4.2. Protagonismo diferenciado

Los tiers NO son solo orden: son **jerarquía visual** (§38 — "no asumir que todos necesitan igual protagonismo").

- **Tier 1**: batería de 2 ítems, sin encabezado de grupo, tamaño de fuente base, icono alineado con la marca. Es lo primero que el usuario ve.
- **Tier 2**: grupo "Operación" con encabezado de sección discreto. Acciones diarias de registro.
- **Tier 3**: grupo "Compromisos" con encabezado. Lo que hay que atender (cobrar/pagar) — está por encima de la configuración pero por debajo de la operación.
- **Tier 4**: grupo "Configuración" colapsado por defecto en móvil (progressive disclosure §26), al final. Sin protagonismo; los ítems duermen hasta que se les necesita.
- **Footer**: controles globales (tema, idioma) + email + Salir con ConfirmDialog. Invariantes de sesión.

### 4.3. Navegación secundaria (Dentro de cada módulo)

- **Detalle → lista**: al entrar a un detalle (movimiento, cuenta, crédito, venta) desde una lista, la lista conserva filtros/paginación (patrón ya verificado: re-sync por contenido).
- **BackButton** (H-14): **solo cuando existe entrada previa real** (deep link, detalle, o navegación desde un módulo distinto). Los módulos raíz alcanzables desde el sidebar NO muestran back (DEC-IA-05). Es el comportamiento inverso al actual (hoy aparece en módulos raíz).
- **Tabs/cabeceras internas**: Créditos usa pestañas internas Received/Granted/Payables si se consolida la agrupación visual; las rutas permanecen separadas (sin redirecciones nuevas).
- **Enlaces cruzados** (ver §6) reemplazan la necesidad de "saltar de módulo": Resumen → módulo; Ventas → Cliente → Clientes; Crédito → Movimientos del cliente.

## 5. Jerarquía de módulos: acciones principales vs secundarias (DISEÑO PROPUESTO)

| Módulo | Acción principal (botón/fab primario) | Acciones secundarias | Naturaleza |
|---|---|---|---|
| Resumen | Cambiar período / profundizar en una card | Accesos a módulos (movimientos, cuentas, cobros) | Comprensión |
| Movimientos | **Nuevo movimiento** | Filtrar, buscar, editar, eliminar, exportar | Operación |
| Ventas (POS) | **Nueva venta** | Catálogo, cliente rápido, abono, ver venta | Operación |
| Cuentas | **Nueva cuenta** | Depósito/retiro, saldo inicial, editar | Operación |
| Clientes | **Nuevo cliente** | Historial de deuda, ventas del cliente | Operación |
| Créditos otorgados | **Nuevo crédito** | Registrar abono, dar de baja (write-off) | Compromiso |
| Créditos recibidos | **Nuevo crédito** | Marcar como pagado (con confirmación, H-06) | Compromiso |
| Cuentas por pagar | **Nuevo pago** | Registrar pago parcial | Compromiso |
| Analítica (fundador) | Explorar | Exportar | Comprensión avanzada |
| Productos | **Nuevo producto** | Editar stock/precio | Configuración |
| Categorías | **Nueva categoría** | Renombrar, mover | Configuración |
| Mi perfil / Comentarios / Ayuda | Ver/editar | — | Configuración |

Regla transversal: **una sola acción principal por pantalla** (benchmark: menor fricción; §30: no feature bloat).

## 6. Relaciones entre módulos (DISEÑO PROPUESTO)

```
                    ┌─────────────────────────────┐
                    │   RESUMEN (centro)          │
                    │   N1 estoy → N5 detalle      │
                    └──────┬──────────┬───────────┘
          profundiza en    │          │  acciones rápidas
                           ▼          ▼
              ┌────────────────┐  ┌──────────────────┐
              │   MOVIMIENTOS  │  │  VENTAS (POS)     │
              │ (listado+det.) │  │ (registro rápido) │
              └───────┬────────┘  └────┬───┬──────────┘
                      │                │   │
                      ▼                ▼   ▼
              ┌───────────────┐  ┌──────────┐  ┌───────────┐
              │  CUENTAS      │  │ CLIENTES │  │ PRODUCTOS │
              └───────────────┘  └──────────┘  └───────────┘
                      │
                      ▼
        ┌───────────────────────────────┐
        │ COMPROMISOS: Créditos otorg. │
        │ / recibidos / Cuentas por    │
        │ pagar (→ Movimientos)         │
        └───────────────────────────────┘
```

- **Ventas → Clientes/Productos**: al crear una venta, acceso a "crear cliente/producto" sin salir del flujo (patrón ya existente en POS: cliente rápido).
- **Compromisos → Movimientos**: cada abono/pago genera movimientos; el detalle del compromiso enlaza a los movimientos asociados (`link.kind` + refId, sin exponer instancias — frontera server→client §2.5).
- **Resumen → todo**: cada card de nivel 1-4 profundiza en su módulo con el contexto ya filtrado (período, cuenta, categoría) — el filtro viaja, no se pierde.
- **Cuentas → Movimientos**: desde una cuenta, ver sus movimientos filtrados por cuenta.

## 7. Mobile vs desktop: mismo modelo mental (DISEÑO PROPUESTO)

- **Misma jerarquía, mismo orden, mismos nombres** en ambos breakpoints (§27: "¿la navegación cambia de forma inesperada?" → NO). El drawer móvil reproduce EXACTAMENTE el orden de la sidebar desktop, incluidos los grupos.
- **Mismo modelo mental del Resumen**: N1→N5 idéntico; cambia el layout (1 columna vs grid), nunca el orden ni la semántica.
- **La forma sigue a la tarea (§11), no al dispositivo**: Movimientos es tabla densa en desktop (DataTable, escaneo y comparación) y **lista de cards** en móvil <640px (MovementCard: QUÉ/CUÁNDO/DÓNDE/CUÁNTO/MONEDA/EFECTO per §12). Resumen usa cards en AMBOS. Esto resuelve H-09 (overflow-x como única solución).
- **Acciones**: en móvil, la acción principal es siempre alcanzable (botón fijo inferior si la pantalla es larga); en desktop, botón superior derecho.
- **Tier 4 colapsable** en móvil; en desktop siempre visible pero al final, visualmente silencioso.

## 8. Anchos canónicos (DISEÑO PROPUESTO — resuelve H-15)

| Tipo de página | Ancho canónico | Páginas |
|---|---|---|
| Listas/tablas/detalle | `max-w-6xl` | Movimientos, Cuentas, Clientes, Categorías, Créditos, Payables, Ventas listado, Productos |
| Formularios | `max-w-xl` | Nueva cuenta, nuevo movimiento, nuevo crédito, venta POS (flujo modal), perfil |
| Centro de comprensión (Resumen) | `max-w-screen-2xl` | Solo Resumen (usa el ancho para comparación y jerarquía, §42) |
| Auth/Legal/Landing | sin cambio | — |

Justificación: hoy `movements/clients/categories` usan `max-w-3xl` (angosto para tablas densas), accounts no tiene límite (inconsistente) y el shell usa `max-w-screen-2xl` para todo. El ancho pasa a ser **función del tipo de tarea**, no de la página.

---
## 9. El Resumen: jerarquía de 5 niveles (§9) y Regla de Oro (§41)

### 9.1. Mapeo de la jerarquía a regiones concretas de la página

| Nivel | Pregunta que responde | Región del Resumen (DISEÑO) | Contenido |
|---|---|---|---|
| **NIVEL 1** | ¿Qué tan bien o mal estoy? | **Hero de estado** (primera pantalla, sin scroll) | **Resultado del período** (número único, con signo claro) + **Disponible por moneda** (nunca suma cross-currency). Máx. 2-3 cifras |
| **NIVEL 2** | ¿Por qué? | **Desglose de resultado** | Ingresos y Gastos del período (2 cifras) + Top 5 categorías de gasto/ingreso. Se abre al mirar la cifra del N1 |
| **NIVEL 3** | ¿Qué cambió? | **Evolución** | Variación % vs período anterior (junto a la cifra, no en card separada) + gráfico mensual de 6/12 meses reales (patrón existente) |
| **NIVEL 4** | ¿Qué debería revisar? | **Atención** | Cards de compromisos: **Por cobrar** (créditos otorgados + ventas a crédito) y **Por pagar** (créditos recibidos + payables) + **Alertas** condicionales (saldo negativo, cobros vencidos, gasto atípico). Región con empty state por defecto — nunca pared de alertas (§25) |
| **NIVEL 5** | Detalle | **Detalle y profundización** | Movimientos recientes (10) + enlaces a módulos con filtro viajero (período/cuenta/categoría) + Posición Financiera (existente) + accesos directos |

### 9.2. La Regla de Oro (§41) mapeada

| Pregunta de los 10 segundos | Dónde se responde |
|---|---|
| 1. ¿Cuánto tengo? | N1 — Disponible por moneda |
| 2. ¿Qué está pasando? | N1/N2 — Resultado del período + desglose visible sin navegar |
| 3. ¿Estoy mejor o peor? | N3 — Variación vs período anterior (legible al lado de la cifra) |
| 4. ¿Dónde está el problema, si existe? | N4 — Compromisos y alertas (solo si hay algo; empty state si no) |
| 5. ¿Qué debería revisar? | N4 → enlace directo a la acción (cobrar, pagar, revisar cuenta) |

**Criterio de aceptación del diseño (heredado por UX-5):** un usuario sin entrenamiento debe responder las 5 preguntas en 10 segundos mirando la página (validación en UX-11).

### 9.3. Filtros y período

- Período por defecto: **mes civil actual**; selector de período explícito (los filtros ya existen — conservar).
- Fecha financiera = fecha civil (§16, regla 6): el selector trabaja con fechas de negocio, nunca con instantes.
- Nunca convertir monedas en la UI (§10 PROJECT-RULES): cada cifra del Resumen es **por moneda**; cuando una métrica admita agrupación, se agrupa de forma honesta (COP-first, sin FX — patrón verificado en dashboard multi-moneda de R15).

## 10. Cards prioritarias (§10 — decisión justificada)

El §10 lista 8 cards conceptuales (Disponible, Ingresos, Gastos, Resultado, Por cobrar, Por pagar, Variación, Alertas) y advierte: **NO implementar todas automáticamente**. Decisión:

| Card | ¿Se implementa? | Nivel | Justificación (datos disponibles + valor) |
|---|---|---|---|
| **Disponible** | SÍ | N1 | Responde "¿cuánto tengo?" (Regla de Oro 1). Fuente: saldos por cuenta (`computeAccountLiveBalance`), ya calculados en el snapshot del dashboard actual. Por moneda, sin suma cross-currency |
| **Resultado del período** | SÍ | N1 | Responde "¿estoy mejor o peor?" (Regla de Oro 3). Fuente: kinds con `countsTowardEconomicResult` context-aware (Personal/Business), ya calculados; sin recontar financiamiento ni capital de créditos (principios 1-3 y 7) |
| **Ingresos / Gastos** | SÍ, como **desglose** del Resultado (N2), NO como cards independientes de N1 | N2 | Explican el "¿por qué?" sin competir con el N1 (jerarquía §9; evitar 8 cards de igual peso §10) |
| **Por cobrar** | SÍ | N4 | Responde "¿quién me debe y desde cuándo?" (benchmark, pregunta #2 del dashboard ideal). Fuente: agregados de créditos otorgados + ventas a crédito, ya existentes |
| **Por pagar** | SÍ | N4 | Responde "¿tengo deudas pendientes?" (§8 prioridad 6). Fuente: créditos recibidos + payables |
| **Variación** | SÍ, como **contexto del Resultado** (N3), NO card independiente | N3 | "¿Qué cambió?" vive junto a la cifra que explica; card separada añade ruido visual |
| **Alertas** | SÍ, **condicional** (solo con señales reales) | N4 | §25: la inteligencia aparece solo cuando agrega valor; empty state por defecto. Señales: saldo negativo, cobros vencidos, gasto atípico vs promedio reciente |

**Explícitamente NO se implementan** (hoy): cards de "flujos de financiamiento" en N1 (ya existe card de financiamiento en el dashboard — se conserva como sub-región de N2 si aporta), comparaciones mes a mes como cards, porcentajes sin explicación (§10 prohibido: números sin contexto).

Evidencia del diseño: la jerarquía del dashboard ACTUAL (VERIFICADO, audit punto 8: saludo → banner → filtros → SummaryCards → cuentas → reportes → Top-3 → gráfico → movimientos recientes → Posición Financiera) ya contiene toda la materia prima; el rediseño reordenará esa materia prima por niveles, no creará datos nuevos (cumple §32: frontend presenta, backend calcula).

## 11. Tabla de decisiones IA (DEC-IA)

| ID | Decisión | Justificación | Evidencia | Impacto |
|---|---|---|---|---|
| DEC-IA-01 | Nombre visible **"Resumen"** (es) / "Summary" (en); "Dashboard" solo técnico; "Reportes" reservado a las secciones | El nombre debe describir lo que el usuario obtiene (comprensión), no la herramienta técnica | §8; H-07; es.json:29/147/667 | i18n es/en, título de página, nav; sin ruta |
| DEC-IA-02 | Reorden del nav en 4 tiers (Comprensión / Operación / Compromisos / Configuración); "por cobrar" primero en Compromisos | Protagonismo diferenciado §38; cobro = tarea recurrente crítica | §38; §27; audit punto 3 (grupos actuales); benchmark lección 1/3 | `nav.tsx` NAV_ITEMS (solo orden/etiquetas) + i18n |
| DEC-IA-03 | Grupos de navegación nombrados (Operación, Compromisos, Configuración) con encabezados discretos; rutas intactas | La agrupación comunica naturaleza sin romper modelos mentales existentes | §27 (agrupar opciones); audit punto 3 | UI del sidebar |
| DEC-IA-04 | Categorías y Productos se mueven al grupo Configuración | Son configuración de clasificación/catálogo, no operación diaria | §26 progressive disclosure; H-15 (consistencia) | Posición en nav; rutas intactas |
| DEC-IA-05 | BackButton SOLO con entrada previa real; sin back en módulos raíz del sidebar | Back sin origen degrada la orientación; los módulos raíz ya están en el sidebar | H-14; benchmark lección 1 (fricción innecesaria) | movements/accounts/categories/clients/transfers |
| DEC-IA-06 | Ancho canónico por tipo de tarea (listas `max-w-6xl`; formularios `max-w-xl`; Resumen `max-w-screen-2xl`) | La tarea define el contenedor, no la página | H-15; §42 (desktop aprovecha espacio para comprensión) | Layouts de páginas |
| DEC-IA-07 | Cards del Resumen: solo las 7 justificadas del §10, con niveles asignados (N1: Disponible+Resultado; N2: desglose; N3: variación; N4: compromisos+alertas condicional) | No convertir el Resumen en pared de números; cada card responde una pregunta | §9; §10; §25; audit punto 8 (datos disponibles) | UX-5 (rediseño Resumen) |
| DEC-IA-08 | Mismo modelo mental móvil/desktop: mismo orden y nombres; forma según tarea (tabla desktop ↔ card list móvil en Movimientos) | La navegación no debe cambiar de forma inesperada; la forma sigue a la tarea | §27; §11; H-09 | UX-7 (responsive), DS (DataTable/MovementCard) |
| DEC-IA-09 | Reportes: sin ítem de nav por ahora; viven como secciones del Resumen; ruta `/reports` queda PROPUESTA FUTURA cuando la fase reportes la materialice | No inventar rutas sin producto detrás; los reportes ya existen como secciones | §38; inventario de rutas (audit punto 1: no existe /reports) | Fase reportes (UX-10, paso 11) |
| DEC-IA-10 | Configuración al final agrupando Perfil, Comentarios, Ayuda (+Categorías/Productos) sobre rutas existentes | §38: Configuración sin protagonismo; hoy perfil/feedback están enterrados en un footer aglomerado | §38; nav.tsx:190-244; H-03 (controles globales) | Nav + footer; rutas intactas |
| DEC-IA-11 | Tema e idioma permanecen como controles globales persistentes en el footer (no dentro de Configuración); se localizan sus `aria-label` | Controles globales ≠ módulo; moverlos degradaría accesibilidad; el idioma debe cambiarse desde cualquier pantalla | §27; H-03; audit punto 3 | i18n + a11y |
| DEC-IA-12 | Analítica se mantiene condicional (fundador) y se ubica al final del grupo Compromisos/Reportes, antes de Configuración | No exponer funciones que no aplican al usuario; respetar política R13-G | nav.tsx:37-51; audit punto 3 | Nav (condicional ya existente) |

## 12. Relación con el resto de la etapa

| Documento | Relación |
|---|---|
| `UX-DESIGN-SYSTEM.md` | Implementa visualmente estas decisiones: components MetricCard/SummaryCard/MovementCard/DataTable (DS §componentes y §responsive) |
| `UX-ROADMAP.md` | UX-5 ejecuta DEC-IA-07 (Resumen); UX-10 pasos 1-2 ejecutan DEC-IA-01/02/03/05/06/10/11/12; UX-7 ejecuta DEC-IA-08 |
| `UX-UI-AUDIT.md` | Fuente de evidencia (H-07/H-14/H-15) |

**Regla de mantenimiento:** toda decisión de IA aprobada que genere una regla funcional permanente debe incorporarse a `docs/PROJECT-RULES.md` (§15) al ejecutarse su fase.