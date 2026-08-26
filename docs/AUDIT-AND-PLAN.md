# TWINCAP — PLAN DE IMPLEMENTACIÓN · RONDA 3

> **Este documento es el plan maestro y documento de continuidad del proyecto.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` y este documento ANTES de empezar.**
>
> **Después de una compactación o en una nueva sesión, lo PRIMERO es leer este archivo.**
>
> Lineamientos de la ronda actual: `TwinCap Ronda 3.md` (raíz del repositorio) — documento de requerimientos, NO archivo de estado.

---

## ESTADO ACTUAL (última actualización: 2026-08-24)

| Ronda | Estado |
|-------|--------|
| Ronda 1 — fases 0–22 | ✅ Completa |
| Ronda 2 — Auditoría y mejoras | ✅ Completa (Fases 0–10 + post-ronda branding; detalle en git history del doc y `Ronda 2.md`) |
| **Ronda 3 — Auditoría integral, corrección financiera, dashboard, evolución funcional** | 🔵 **EN CURSO — Plan APROBADO (2026-08-24; D1–D8 según recomendación). HR3-27 incorporado → F5. FASES 1–10 COMPLETADAS y verificadas (F1: `9ac8ea4`, `93aaf48`, `c7edd57`, `cb7cd46`; F2: `66b3301`; F3: `2d8ca7d`; F4: suite 407/407 en 42 archivos; F5: `05a206d`; F6: `6293d52`; F7: `77bacea`; F8: `3693d55`; F9: `cdac9af` 34 archivos, surface tokens, toggle fix, warm pastel light; F10: `9e5eab8` 14 archivos, perfil usuario: name+locale, cambio contraseña, saludo dashboard personalizado, nav link, i18n Profile). Account.scope eliminado; Movement.context como verdad; migración ventas ejecutada (14 modificados). Dashboard avanzado: filtros composables, Activos/Pasivos por moneda, evolución anual. Tablas: sort DESC uniforme, filtros secundarios, venta resumen con nombre artículo, abono buttons unificados. Invalidación: revalidatePath completo en editAbono×3 + deleteSaleAbono; GlobalMovementProvider con invalidateData(). Auth: password-input con toggle ojo accesible, autoComplete fix por authMode, confirm-password. Branding: hero i18n, variante inverse Button, sidebar agrupada General/Finanzas/Crédito/Negocio, close button drawer, EmptyState adoption, 14 CTAs hand-rolled→Button. Tema: 7 surface tokens, theme toggle (clase .dark + anti-flash), Button/Toast/FAB/nav→tokens, Card header diferencial, 0 bg-white en main app. Perfil: name+locale en User, página /profile con 2 cards (info+password), saludo personalizado, nav link con icono User. Esperando aviso explícito para FASE 11.** |

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

Prioridades: P0 crítico · P1 alto · P2 medio · P3 bajo.

| ID | Requisito (doc §) | Estado real verificado | Causa raíz | Prioridad | Fase |
|----|-------------------|------------------------|------------|:---:|:---:|
| HR3-01 | 5.1 Bug fechas | CONFIRMADO sistémico en TODAS las entidades con fecha | `new Date("YYYY-MM-DD")` parsea a medianoche UTC (13 call sites en actions); almacenado así en Mongo; cliente formatea con `formatDate` SIN `timeZone` (`src/lib/format.ts:25-31`) → browser America/Bogota resuelve 00:00Z como día anterior 19:00 → desplazamiento −1 día uniforme en movements/transfers/créditos+abonos/ventas+abonos/payables(+dueDate)/dashboard recent. Cofecto: prefill de forms usa `new Date().toISOString().split('T')[0]` = fecha UTC → "mañana" después de las 19:00 local (10 forms). Latente: bucketing mensual del dashboard en UTC (bordes de mes ±5h). Tests sin TZ fijada y `format.test.ts` evita asertar el día → CI era ciego al bug | P0 | F1 |
| HR3-02 | 5.3 Transferencias inflan resultados | CONFIRMADO leak financiero | Cards mensuales + chart filtran SOLO por `type`+moneda+fecha (`dashboard/page.tsx:111-127`, `computeMonthlyData:40-53`): ambas piernas de cada transferencia entran (income+500k / expense+500k). Ejemplo doc: salario 2M + transferencia 500k ⇒ muestra $2.5M ingreso / $500k gasto (real: $2M / $0). Balances de cuenta CORRECTOS (signedAmount, aggregateBalance). `link.kind` jamás filtrado en read-path. También: opening balance cuenta como income; principal de crédito recibido cuenta como income (política a decidir, D2) | P0 | F1 |
| HR3-03 | 5.14 Gráfico barras iguales | CONFIRMADO mecanismo exacto | Barras dimensionadas % del ancho de fila junto a label numérico inflexible dentro de flex row (`monthly-chart.tsx:41-58`): overflow absorbido por la barra (label tiene min-width auto) → toda barra significativa colapsa a ≈ container−label−gap. En fila ~260px con label ~120px: 100% y 67% convergen a ~132px ambos. No es CSS puntual ni datos: es estructura del track | P0 | F1 |
| HR3-04 | 5.8 Doble "COP COP" | CONFIRMADO estructural | `formatAmount(style:'currency')` ya emite código ("12.345,67 COP" con locale es genérico); ~15 JSX concatenan `{currency}` otra vez (transfers ×2 piernas, créditos ×3 c/u, sale-detail-modal ×6, payables ×3, sale-list, catalog, movements, abono-forms ×3). Además 4 implementaciones de formateo divergentes: canonical `lib/format.ts` + duplicado privado en dashboard (`page.tsx:28-38`) + accounts `toLocaleString` sin style y exponent `??0` (`accounts/page.tsx:14-22`) + raw en sale-form:285 | P0 | F1 |
| HR3-05 | 5.7 Notas automáticas en inglés | CONFIRMADO persistidas | 10 generadores construyen texto inglés EN CREACIÓN dentro de use cases y lo persisten en `Movement.note` (create-sale:173, add-sale-abono:54, create/edit principal+abonos de créditos ×4, payables ×2, transfer default :85/101, account opening:44). Los editores copian el texto viejo verbatim. Render muestra nota cruda (movements-list:138, transfers-list:113). CLAVE A FAVOR: `link.kind` (enum de 9 valores) + counterparty en padres YA están persistidos → texto derivable en render sin migración. Synthetic categories son constantes in-memory (no persistidas) pero dashboard cae en "uncategorized" porque su categoryMap solo trae categorías reales (hallazgo A5) | P1 | F2 |
| HR3-06 | 5.10 Label "type" categorías | CONFIRMADO | Clave `Categories.type` ausente en AMBOS messages JSON; fallback imprime key cruda. El parity test valida ES↔EN pero NO cobertura de uso (claves referenciadas inexistentes pasan inadvertidas) | P1 | F2 |
| HR3-07 | 5.19 Español neutral | CONFIRMADO ~24 claves voseo cordobés | Landing casi entera (heroSubtitle, heroCta "Empezá gratis", featuresTitle "necesitás", feature/benefit/faq/cta…), Auth ("¿Ya tenés cuenta?"), Dashboard/Accounts/Categories/Movements/Catalog empty states, error.unauthorized, Errors.description, Toast.operationFailed | P1 | F2 |
| HR3-08 | 5.12 Personal/Negocio | PARCIALMENTE CONSTRUIDO, sin usar | `Movement.context` EXISTE ('Personal'\|'Business', persistido, elegible en form manual) pero TODOS los movimientos sistema hardcodean 'Personal' (transfers:86/103, credits×4, sales:174, payables:61, opening:45). Account y Category SIN campo scope. Cero queries/agregaciones por context. "Todo mi negocio" hoy NO es respondible. Decisión D3 (fuente de verdad) | P1 | F3 |
| HR3-09 | 5.13 Dashboard filtros | NO EXISTEN filtros combinables | Solo: cuenta (movements), búsqueda (catalog/clients). Agregaciones in-JS tras cargar TODOS los movimientos (findByUserId sin límite); `primaryCurrency = accounts[0].currency` excluye silenciosamente otras monedas en cards/chart/pendingCredits | P1 | F4 |
| HR3-10 | 5.15 Activos/Pasivos | DATOS DISPONIBLES, sin agregar | Getters `pending` existen en CreditGranted/CreditReceived/Payable. Receivables NUNCA consultados en dashboard; tarjeta "pendingCredits" es EN REALIDAD deuda (CreditReceived.pending = pasivo) mal etiquetada; Payable.pending jamás agregado; inventario sin valoración (stock×precio ambiguo sin cost basis). Multi-moneda requiere agrupar por moneda (no hay FX y no debe inventarse). Definiciones a aprobar (D4) | P1 | F4 |
| HR3-11 | 5.4 Tabla resumida ventas | CONFIRMADO | Fila colapsada muestra fecha−total, badge modo, cliente, pendiente y CONTEO de ítems; nombre del primer artículo ausente hasta abrir modal (detalle modal-only, no fila expandible). Fallback ítem eliminado existe (`Sales.itemDeleted`) | P2 | F5 |
| HR3-12 | 5.23 Filtros en tablas | INVENTARIO COMPLETO → matriz R3.8 | Movements: cuenta. Transfers/Credits×2/Payables/Sales: nada. Catalog/Clients: búsqueda debounce (bloque duplicado entre ambos). Accounts/Categories: nada. Cero filtros fecha/tipo/categoría/ámbito en todo el app | P2 | F5 |
| HR3-13 | 5.9 Botón "Agregar abono" | CONFIRMADO inconsistente | Credits received/granted + payables: pill success idéntica BYTE-A-BYTE copy-paste ×3; sales: text-link `text-xs text-success` distinto; submit de abono de venta usa Button md vs sm en el resto. `<Button variant="success" size="sm">` ya modela el tratamiento | P2 | F5 |
| HR3-14 | 5.16 Invalidación categorías/cuentas | CAUSA RAÍZ DISTINTA A LA SUPUESTA | Actions SÍ llaman revalidatePath y forms SÍ hacen router.refresh() (listas propias se actualizan). Culpable real: caché ONE-SHOT de `GlobalMovementProvider` (`global-movement-provider.tsx:79-96`, guard `data !== null`) sobrevive router.refresh() y navegación; MovementForm vive SOLO ahí → pickers de cuenta/categoría del FAB sirven snapshot stale hasta hard reload; borrar categoría y usarla lanza ValidationError visible. Gaps adicionales revalidatePath: deleteSaleAbonoAction solo `/pos/sales` (borra movimiento → saldos /accounts+/dashboard stale), editPayable sin `/accounts`, editAbono ×3 sin `/dashboard` — HOY enmascarados por comportamiento temporal de Next 16.3.1 (refresh blanket on navigate), frágil si upstream lo quita | P0 | F6 |
| HR3-15 | 5.5 Ojo contraseña | NO EXISTE toggle en todo el codebase | Un solo input password (auth-form compartido login/register); Eye/EyeOff solo usados como acción "ver detalle" en ventas | P1 | F7 |
| HR3-16 | 5.6 Autocompletado | BUG REAL confirmado | `autoComplete={title === 'Sign In' ? 'current-password' : 'new-password'}` compara contra título i18n → login en ESPAÑOL recibe 'new-password' (induce generación/guardado de credencial nueva en login). Register correcto ('new-password'). Email OK. Sin confirm-password en registro (decisión menor) | P0 | F7 |
| HR3-17 | 5.2 Logo y branding | CONFIRMADA colisión móvil | Drawer <lg: botón cerrar z-50 (`nav.tsx:81`) pinta DIRECTAMENTE sobre el isotipo del drawer z-40 (`nav.tsx:100`, brand block sin reserva de espacio `:106-108`): glyph X (24..44px) cae dentro del área del isotipo (24..56px). Wordmark sobrevive por ~12px (crowding). Desktop: Logo size md=32px; slogan/tagline inexistente en ningún lado ni claves i18n. Smell adicional: hero renderiza Logo lg + `<h1>TwinCap</h1>` hardcoded fuera de i18n (marca duplicada, A10) | P2 | F8 |
| HR3-18 | 5.18 Landing "Registrarse" | CONFIRMADO riesgo estructural | Hero CTA: `<Button variant="primary" className="bg-white text-indigo-700 hover:bg-indigo-50">` SIN !important → conflicto de propiedades resuelto por ORDEN DEL CSS GENERADO (suerte de cascada): combinaciones perdedoras = blanco-sobre-blanco o indigo-sobre-indigo. Ghost login igual (`text-white hover:bg-white/10` vs dark:text-zinc-300 del ghost). Patrón repetido ×3 en edit-abono forms (ghost+bg-indigo-600) | P2 | F8 |
| HR3-19 | 5.22 Sidebar largo | CONFIRMADO plano | NAV_ITEMS flat 11 entradas sin metadatos de grupo; un solo `<ul space-y-1>`; sin primitivas collapsible/acordeón en nav.tsx. Altura/scroll correctos post-R2 | P2 | F8 |
| HR3-20 | 5.21 Tema claro/oscuro | ARQUITECTURA PARCIAL | Tokens semánticos tienen paridad light/dark 1:1 PERO no existen tokens de superficie (--tc-bg/card/border/muted) → 355 pares `dark:` manuales en 50 archivos + bg-white×33 apareados a mano. Sin switcher (solo prefers-color-scheme); sin `color-scheme`; Button primary hardcodea indigo-600 mientras token --tc-primary (blue-600) está SIN USO → 3 azules conviven; toast info indigo-600 hardcode; warning claro con contraste dudoso sobre texto blanco; themeColor estático indigo-500 (ignora tema OS); manifest bg blanco. Light mode probablemente funcional (pares manuales) pero frágil y de mantenimiento caro. Decisión D6 (switcher manual sí/no) | P1 | F9 |
| HR3-21 | 5.17 Perfil | ROADMAP CONFIRMADO | User = id/email/passwordHash/createdAt únicamente; sin name/foto/preferencias; sin rutas ni actions de perfil; sesión porta sub+email; bootstrap seeding existe. Análisis alcance en R3.10, decisión D5 | P2 | F10 |
| HR3-22 | 5.24 Iconos PWA | PENDIENTE HEREDADO confirmado | Todos los launcher icons derivan de MASTER blanco (`pwa_pack/splash_screens/icon.png`, generate-icons.mjs:25); maskable compone sobre canvas BLANCO ×0.74; isotipo transparente SOLO vive en logo in-app. Consecuencia: flash blanco en launchers oscuros. sw v5 network-first, HTML nunca precacheado, splash excluidas del precache | P2 | F11 |
| HR3-23 | 5.20 PWA ruta inicial | VERIFICADO, decisión de producto | start_url=/dashboard; proxy NO hace auth; sin sesión: bounce servidor → /login (efectivo hoy); con sesión: directo dashboard; cookie gm_session 30 días; offline no arranca ninguna entrada (HTML network-first sin fallback page). Decisión D7 (recomendar mantener) | P3 | F11 |
| HR3-24 | 5.11 Módulo Compras | ANÁLISIS en R3.9 | Payable (R2-F8) ya cubre obligaciones por compra con pagos/abonos/vencimiento. Falta para Compras completo: proveedores, líneas de compra, inventario, costos. Decisión D8 | — | roadmap |
| HR3-25 | 5.25 Features comerciales | ANÁLISIS en R3.11 | — | — | roadmap |
| HR3-26 | 5.26 Blog interno | REGISTRADO roadmap | Ver R3.15 | — | roadmap |

## R3.6 — Hallazgos adicionales (no estaban en la especificación)

| ID | Hallazgo | Impacto | Fase |
|----|----------|---------|:---:|
| A1 | Dashboard carga TODOS los movimientos (sin límite/proyección) para cards+chart+recent (`slice(0,5)` sobre array completo) — latencia degradará con el tiempo | Performance | F4 |
| A2 | Cross-currency: totals excluyen silenciosamente monedas ≠ primera cuenta — números incompletos presentados como completos | Financiero | F4 |
| A3 | Tarjeta "pendingCredits" presenta un PASIVO como métrica genérica — semánticamente engañosa | Financiero/UI | F4 |
| A4 | Movimientos sistema caen en "uncategorized" del dashboard (categoryMap sin categorías sintéticas) | UI/i18n | F2 |
| A5 | 10 CTAs "Agregar X" hand-rolled `rounded-md bg-indigo-600 px-4 py-2 …` en vez de `<Button variant="primary">`; +3 conflictos ghost+indigo en edit-abono forms | Mantenibilidad | F8 |
| A6 | Accounts y Categories hand-roll markup de EmptyState pixel-equivalente al componente `ui/empty-state.tsx`, con lucide raw en vez de wrapper Icon | Consistencia | F8 |
| A7 | `title={selectedAccountId === 'all' ? t('emptyTitle') : t('emptyTitle')}` dead conditional (movements-list:95) | Limpieza | F5 |
| A8 | Sale rows derivan moneda de items[0] con fallback silencioso 'COP' (`sale-list.tsx:90`) | Datos | F5 |
| A9 | Chip de abonos hidden sm:inline en Payables pero siempre visible en credits lists — drift responsive | Consistencia | F5 |
| A10 | Hero landing: Logo lg encima de `<h1>TwinCap</h1>` hardcodeado fuera de i18n — marca duplicada | Branding/i18n | F8 |
| A11 | Tests: vitest sin TZ fijada; fixtures UTC-midnight; format test evita asertar día → clase entera de bugs de fecha invisible para CI | Testing | F1 |
| A12 | Cero tests de agregaciones dashboard (monthlyIncome/Expenses/computeMonthlyData inline en page.tsx); cero tests de wiring revalidatePath; repos Mongo sin integración; cross-currency sin cubrir | Testing | F1/F4 |
| A13 | AGENTS.md describía proxy.ts con auth protection — FALSO (auditado: solo locale+warmup). Corregido en AGENTS.md esta misma sesión | Docs | ✅ |
| A14 | Abonos edit-dialogs muestran fecha CORRECTA (`toISOString().slice(0,10)` roundtrip) mientras la lista de arriba muestra ayer — inconsistencia visible que confirma HR3-01 | Evidencia | F1 |
| A15 | Toast warning: token claro pálido + texto blanco = contraste dudoso; toast info hardcode indigo-600 | UI/a11y | F9 |
| A16 | Offline: cold start PWA falla en cualquiera de las dos rutas (HTML nunca cacheado, sin offline fallback page) | PWA | F11 (nota) |

## R3.7 — Decisiones de dominio que requieren aprobación del usuario

| # | Decisión | Opciones | Recomendación |
|---|----------|----------|---------------|
| D1 | Convención de fechas financieras (HR3-01) | (a) **Fecha civil codificada como medianoche UTC + formateo SIEMPRE con `timeZone:'UTC'`** en el formateador único + prefill calculado con fecha LOCAL del dispositivo + tests con TZ fijada (America/Bogota y UTC). (b) Value Object DateOnly/string end-to-end (migración de tipos en 13 sites + entidades). (c) Zona fija America/Bogota acoplada al producto | **(a)**: cero migración de datos, corrige display/prefill/bucketing con UNA convención explícita documentada; la fecha almacenada ES el día civil ingresado |
| D2 | Política de flujos en ingresos/gastos del dashboard (HR3-02) | (a) **Excluir `link.kind='transfer'` (ambas piernas) y `opening`** de income/expense/cards/chart; créditos/ventas/payables conservan tratamiento actual (modelo caja coherente, anti-doble-contabilidad ya validado). (b) Devengo estricto: reclasificar principales de créditos como financiamiento y abonos de créditos otorgados como cobros-no-ingreso | **(a)**: corrige lo inequívoco (transferencias/apertura NO son resultado económico) sin cambiar todos los números del usuario; el refinamiento devengo queda como posible evolución del dashboard |
| D3 | Fuente de verdad Personal/Negocio (HR3-08) | (a) **Account.scope** (enum required, default 'Personal', backfill inicial guiado): movimientos sistema heredan automáticamente el scope de su cuenta — elimina los hardcode 'Personal'; categoría permanece transversal; queries filtran vía cuenta. (b) Movement.context como fuente (obliga pedir scope en cada flujo sistema). (c) Híbrido cuenta-default + override por movimiento | **(a)**: modelo mental natural ("mis cuentas del negocio"), cero fricción en flujos sistema, una sola verdad |
| D4 | Definiciones Activos/Pasivos (HR3-10) | Activos = Σ saldos de cuentas + Σ CreditGranted.pending (por cobrar). Pasivos = Σ CreditReceived.pending + Σ Payable.pending. Presentación agrupada POR MONEDA sin conversión FX. Renombrar/reclasificar tarjeta pendingCredits | **Aprobación de definición nominal-pendiente por moneda** (disponibilidad/nominal/FX quedan fuera hasta existir tasa real) |
| D5 | Alcance Perfil (HR3-21) | (a) **Mínimo viable**: nombre + cambio de contraseña + preferencia de idioma persistida + bienvenida dashboard con nombre. (b) Ídem + foto vía Cloudinary (dependencia externa). (c) Ídem + foto self-hosted (GridFS/storage propio — complejidad serverless) | **(a)** ahora; foto como decisión separada post-aprobación (Cloudinary solo si el usuario acepta la dependencia) |
| D6 | Arquitectura de temas (HR3-20) | (a) **Modo dual completo con switcher manual**: tokens de superficie (--tc-bg/card/border/muted), estrategia dark por clase (@custom-variant) + script anti-flash + persistencia, migración progresiva empezando por ui kit, color-scheme, themeColor dinámico. (b) Mantener solo-OSS: sanear tokens/brand blues/contrastes sin toggle | **(a)**: expectativa estándar en PWA; el costo mayor es la migración de pares manuales, que (b) también paga parcialmente |
| D7 | Ruta inicial PWA (HR3-23) | Mantener start_url=/dashboard (guest → bounce a login; user → directo) vs cambiar a / (landing primero, +2 taps) | **Mantener**: producto autenticado-first; usuarios recurrentes ganan; conversión de nuevos pasa por landing web, no por la app instalada |
| D8 | Módulo Compras (HR3-24) | A) No implementar en R3. B) Versión mínima compras. C) Evolucionar Payable hacia Compras posteriormente. D) Otra | **A + camino C documentado en roadmap**: payable ya resuelve la necesidad actual; Compras exige proveedores/inventario/costos — gate comercial antes de construirla |

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

## R3.12 — Plan DEFINITIVO por fases (propuesta post-auditoría — REQUIERE APROBACIÓN)

Ordenado por: dependencias → riesgo financiero → impacto UX → complejidad → valor. Compuertas: D1+D2 aprueban F1 · D3 aprueba F3 · D4 aprueba F4 · D5 aprueba F10 · D6 aprueba F9 · decisiones menores se consultan al iniciar su fase.

| Fase | Contenido | Hallazgos | Criterios de aceptación clave |
|------|-----------|-----------|-------------------------------|
| ~~F0~~ | ~~Auditoría completa + este plan~~ | ~~R3.4–R3.11~~ | ✅ Completada 2026-08-24 |
| **F1** | **Corrección financiera fundamental**: convención de fechas D1 (parse/prefill/format/bucketing coherentes + tests TZ-fijados America/Bogota y UTC); exclusión transfer+opening de resultados económicos D2 (extraer agregaciones a use case testeable); fix estructural del track del gráfico (barras proporcionales reales); unificación del formato monetario (un solo formatter, eliminar 3 duplicados y ~15 concatenaciones, guard test) | HR3-01/02/03/04, A2, A11, A14 | Fechas estables en las 7 entidades con fecha en TZ Bogota; ejemplo salario 2M+transfer 500k ⇒ 2M/0; barras 9M vs 6M claramente distintas en 375px; cero "COP COP"; suite verde con TZ forzada |
| **F2** | **Textos automáticos e i18n estructural**: notas sistema derivadas en render de `link.kind` + counterparty (fallback nota persistida si padre eliminado); categorías sintéticas resueltas vía i18n en dashboard (mata "uncategorized"); clave Categories.type + test de cobertura de uso i18n (detecta claves referenciadas faltantes); barrido español neutral (~24 claves) | HR3-05/06/07, A4 | Cero notas inglesas visibles en ES; cambiar idioma cambia notas históricas; "type" localizado; parity+usage tests verdes; cero voseo |
| **F3** | **Clasificación Personal/Negocio (D3)**: Account.scope + migración/backfill + herencia automática en movimientos sistema (elimina hardcodes 'Personal'); filtro ámbito en Movements; base de queries para dashboard | HR3-08 | Consultar "todo mi negocio" posible sin duplicar datos; movimientos sistema clasificados por cuenta; migración reversible y testeada |
| **F4** | **Dashboard financiero avanzado (D4)**: sistema central de filtros composables (ámbito/cuenta/categoría/período); sección Activos y Pasivos con definiciones aprobadas y presentación por moneda; reclasificación tarjeta pendingCredits; gráfico evolución mensual anual (línea vs barras: decidir con evidencia en fase); extraer agregaciones a use cases con tests; queries acotadas (recent limitado, proyecciones) | HR3-09/10, A1, A2, A3 | Filtros combinables sin explosión de estados; activos/pasivos cuadran con listas; multi-moneda honesta (agrupada, no silenciosa); agregaciones testeadas |
| **F5** | **Consistencia de tablas y ventas**: aplicar matriz R3.8 por módulo (filtros secundarios); **orden cronológico descendente uniforme** (fecha de negocio DESC + desempate createdAt DESC, verificado repo por repo — HR3-27); fila resumida de ventas con primer artículo + indicador "+N más"; variante compartida para CTAs de abono (Button success sm) incluida paridad de tamaño; limpieza residuales (dead conditional, silent COP fallback, chip responsive) | HR3-11/12/13/**27**, A7, A8, A9 | Filtros según matriz aprobada; TODAS las tablas muestran más recientes primero con desempate horario correcto (test: dos registros del mismo día 5:41:19 pm vs 5:41:18 pm); nombre de artículo visible pre-detalle con fallback i18n; un solo patrón de botón abono |
| **F6** | **Invalidación y datos frescos**: corregir caché one-shot del GlobalMovementProvider (refetch-on-open/TTL o invalidación tras mutations); completar matriz revalidatePath (deleteSaleAbono→/accounts+/dashboard; editPayable→/accounts; editAbono×3→/dashboard); patrón documentado para futuras entidades | HR3-14 | Crear/borrar categoría o cuenta refleja en formularios del FAB sin reload duro; saldos consistentes tras borrar abono de venta; sin window.location.reload |
| **F7** | **UX de autenticación**: ui/password-input.tsx con toggle ojo accesible (aria-label i18n, aria-pressed, tooltip); fix autoComplete por modo (prop, NO título i18n) en login/register; decisión menor confirm-password; revisión de otros formularios de contraseña | HR3-15/16 | Login ES y EN autocompleta como existing-password; toggle operable por teclado y lector; registro induce generación correcta |
| **F8** | **Branding, landing y navegación**: header drawer móvil con reserva de espacio/z-index (logo nunca bajo botón cerrar) — evaluar logo-en-header vs logo-en-drawer según arquitectura real; logo desktop ampliado + slogan i18n (D9 candidatos en fase); hero sin marca duplicada (h1→i18n); CTA landing con variante segura del Button (sin overrides en cascada); adopción Button primary en 10 CTAs hand-rolled + fix ghost×3; EmptyState component adoption ×2; sidebar agrupada (Finanzas/Crédito/Negocio) collapsible desktop + acordeón drawer con a11y completa | HR3-17/18/19, A5, A6, A10 | 375px sin solapamiento; slogan ES/EN neutral; cascada determinista en todos los botones; sidebar agrupada usable con teclado/Escape en ambos modos |
| **F9** | **Tema claro/oscuro completo (D6)**: tokens superficie + color-scheme + unificación brand blues (Button→token --tc-primary) + toast info/warning contrastes + themeColor dinámico + switcher persistente (clase .dark + script anti-flash) + migración progresiva de pares manuales empezando por ui kit + verificación por superficie (lista §5.21: login/registro/landing/dashboard/tablas/forms/modales/toast/gráficos/badges/nav/PWA) | HR3-20, A15 | Ambos modos completos y legibles en la lista de superficies; switcher respeta OSS inicial; un solo azul primario |
| **F10** | **Perfil de usuario mínimo (D5)**: campos name/locale en User (entidad+modelo+backfill trivial), página perfil, actions con scoping, cambio de contraseña (bcrypt verify), bienvenida dashboard con nombre; foto SOLO si usuario aprueba servicio (Cloudinary u otro) como decisión separada | HR3-21 | CRUD propio sin exponer datos cruzados; contraseña cambiada invalida sesión correctamente según política definida; i18n paridad |
| **F11** | **PWA final**: regenerar icon-192/512/maskable/apple-touch/favicon desde isotipo transparente con fondo sólido bajo maskable (safe area 40%); splash coherentes con marca; verificar manifest/sw tras regeneración (cache bump obligatorio); ruta inicial D7 (mantener, documentado); nota offline A16 registrada | HR3-22/23, A16 | Sin flash blanco en launchers oscuros; instalación Android+iOS+navegador coherente; sw bump sin romper clientes instalados |
| **F12** | **Cierre de ronda**: checklist transversal §6 del doc fuente (arquitectura/seguridad/i18n/responsive 375-768-1280/a11y/testing); resolver deuda detectada en fases; roadmap comercial final (R3.11 + blog); `pnpm test` + lint + build + tsc verdes; actualización de este documento | Transversal | Checklist sin CRITICAL; comandos verdes; docs al día |

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

## PROTOCOLO POST-COMPACTACIÓN

Si el contexto se compacta o inicia nueva sesión:

1. **Leer este archivo completo** (`docs/AUDIT-AND-PLAN.md`)
2. **Leer `AGENTS.md`**
3. **Buscar en Engram:** `mem_search(query: "TwinCap ronda 3", project: "globalmoney")`
4. **Identificar la fase actual** comparando el último commit con la tabla R3.12 y la BITÁCORA
5. **Continuar desde la fase pendiente**, respetando el protocolo R3.13 (detenerse y esperar aprobación al terminar cada fase)
6. Recordar: si el estado es "plan sin aprobar", NO implementar nada; las decisiones D1–D8 aprobadas quedarán anotadas en la BITÁCORA

---

## BITÁCORA

- 2026-08-19 — Creación del plan maestro (Ronda 1, 12 fases identificadas).
- 2026-08-20 — Ronda 1 completada: fases 0–22 ejecutadas y commiteadas.
- 2026-08-21 → 2026-08-23 — Ronda 2 completa: auditoría Fase 0 (H1–H20 + P1–P13), plan definitivo de 10 fases, fases 1–10 implementadas y commiteadas (ver tabla histórica arriba). Post-ronda: rebranding PWA + logo in-app definitivo. Detalle fase a fase: git history de este documento.
- 2026-08-24 — **Reescritura del documento para la RONDA 3** (fuente: `TwinCap Ronda 3.md`, aportada por el usuario con especificaciones estructuradas). **Fase 0 completada:** auditoría técnica del código real mediante 6 exploraciones paralelas de solo lectura. Causas raíz verificadas HR3-01…26 + 16 hallazgos adicionales (R3.6). Claves: bug de fechas = medianoche UTC + formatter sin timezone (desplazamiento −1 día universal); leak confirmado de transferencias en resultados del dashboard (balances correctos); mecanismo exacto del gráfico comprimido por flex-shrink; doble COP = concatenación sobre salida currency-styled ×15 sites; síntoma de invalidación = caché one-shot del GlobalMovementProvider (las actions SÍ revalidaban); autoComplete de login roto bajo español; colisión real logo/botón-cerrar en drawer móvil; temas sin tokens de superficie (355 pares dark: manuales). Plan definitivo de 12 fases propuesto (R3.12) + 8 decisiones de dominio para aprobación (R3.7). AGENTS.md actualizado: principios financieros permanentes, español neutro, textos automáticos localizables, corrección de la descripción del proxy (no hace auth). ~~ESPERANDO APROBACIÓN del usuario~~.
- 2026-08-24 (mismo día) — **PLAN APROBADO por el usuario**, decisiones D1–D8 según recomendación, sin ajustes solicitados. Requerimiento adicional incorporado: **orden cronológico descendente en tablas** (fecha + hora, más recientes arriba, desempate al segundo dentro del mismo día) → registrado como HR3-27, asignado a F5 con criterios de aceptación propios. **Inicio de FASE 1** (corrección financiera fundamental).
- 2026-08-24 (mismo día) — **FASE 1 COMPLETADA** en 4 unidades de trabajo commiteadas: WU1 `9ac8ea4` convención de fechas civiles (`formatDate` fija `timeZone:'UTC'`; nuevo `src/lib/date.ts` con `toDateInputValue` local / `businessDateToInputValue` UTC para prefills de edición; TZ America/Bogota fijada vía `env.TZ` del config de vitest — setupFiles solo no alcanza porque los workers ya arrancaron; bucketing mensual UTC explícito); WU2 `93aaf48` use case `compute-dashboard-summary` excluye transferencias (ambas piernas) y opening de ingresos/gastos, créditos/ventas/payables conservan tratamiento (semántica D2 congelada en tests); WU3 `c7edd57` track del gráfico `flex-1 min-w-0` con labels fuera del track proporcional (9M vs 6M ⇒ ~98px vs ~66px a 260px); WU4 `cb7cd46` formateo monetario unificado (~22 concatenaciones `{currency}` eliminadas en 13 componentes; duplicados dashboard/accounts/sale-form eliminados). Suite final 358/358 en 36 archivos, `tsc --noEmit` limpio, verificación independiente del orquestador. Desvíos justificados: prefills de edit-dialogs usan getters UTC (fechas almacenadas) mientras "hoy" usa getters locales; filtro de mes de las cards movido a igualdad de clave UTC (corrige exclusión del día 1 en Bogota). Observaciones fuera de alcance registradas para sus fases: label `(COP)` de abono-form (contexto field-label), silent `?? 'COP'` sale-list (F5), caché one-shot GlobalMovementProvider (F6), cargas completas (F4).
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
