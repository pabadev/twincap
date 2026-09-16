# TWINCAP — UX ROADMAP — PLAN MAESTRO DE LA ETAPA UX/UI (FASES UX-0…UX-12)

> **Fecha:** 2026-09-13
> **Estado:** PLAN MAESTRO — UX-0/UX-1/UX-2 COMPLETAS; UX-3/UX-4 APROBADAS (2026-09-14); UX-5 **COMPLETA** (commit `b679cb8` + TTI medido, regla de oro OK — see `docs/UX-5-TTI-REPORT.md`); UX-10 pasos 1-2 + H-15 parcial commiteados (`2960206`, `34510ae`); **H-06 (mark-as-paid) CERRADO (2026-09-14, commit `46e967f`)** — cuenta destino obligatoria + ConfirmDialog, ejecutado como prerequisito de UX-6; UX-6 **COMPLETA Y ARCHIVADA (2026-09-16)** — confirmación informada en flujos core (SDD `ux-6-core-flows`, HEAD `02e883f`, verify PASS 16/16 escenarios); UX-7 **COMPLETA Y ARCHIVADA (2026-09-16)** — responsive mobile + desktop (SDD `ux-7-responsive`, HEAD `f39a9d7`, H-09/H-11/H-15 cerrados, verify PASS 1504/1504, pase visual RSL-8 pendiente fundador); UX-8…UX-12 PLANIFICADAS (requieren aprobación por fase, protocolo R3.13)
> **Fuente normativa:** `docs/freeze + UX-UI.md` (prompt maestro §35/§40/§41/§46/§47/§48/§49/§52/§53/§56)
> **Documentos relacionados:** `docs/FINANCIAL-DOMAIN-FREEZE.md`, `docs/UX-UI-AUDIT.md` (UX-1), `docs/UX-COMPETITIVE-RESEARCH.md` (UX-2), `docs/UX-INFORMATION-ARCHITECTURE.md` (UX-3), `docs/UX-DESIGN-SYSTEM.md` (UX-4), `docs/PROJECT-RULES.md` (§15/§18)

---

## 1. Estado de la etapa

| Fase | Estado | Entregable |
|---|---|---|
| UX-0 — Freeze y documentación | ✅ **COMPLETA** | `docs/FINANCIAL-DOMAIN-FREEZE.md` + `PROJECT-RULES.md` §18 |
| UX-1 — Auditoría | ✅ **COMPLETA** | `docs/UX-UI-AUDIT.md` (19 hallazgos, H-01…H-19) |
| UX-2 — Investigación competitiva | ✅ **COMPLETA** | `docs/UX-COMPETITIVE-RESEARCH.md` (Treinta, Wave, Alegra, QuickBooks + otras) |
| UX-3 — Arquitectura de información | ✅ **APROBADA (2026-09-14)** | `docs/UX-INFORMATION-ARCHITECTURE.md` (DEC-IA-01…12) |
| UX-4 — Design System | ✅ **APROBADO (2026-09-14)** | `docs/UX-DESIGN-SYSTEM.md` (DEC-DS-01…13) |
| UX-5 — Rediseño del Resumen | ✅ **COMPLETA (2026-09-14)** | Diseño conceptual + implementación + TTI medido (`docs/UX-5-TTI-REPORT.md`) |
| UX-6 — Flujos core | ✅ **COMPLETA (2026-09-16)** | Confirmación informada en flujos transaccionales (SDD `ux-6-core-flows`, HEAD `02e883f`) |
| UX-7 — Responsive | ✅ **COMPLETA (2026-09-16)** | Mobile-first deliberado — H-09/H-11/H-15 cerrados (SDD `ux-7-responsive`, HEAD `f39a9d7`) |
| UX-8 — Microcopy + estados + errores | ⏳ PLANIFICADA | Lenguaje y estados |
| UX-9 — Accesibilidad | ⏳ PLANIFICADA | A11y de componentes y páginas |
| UX-10 — Implementación | ⏳ PLANIFICADA | Orden del §53 |
| UX-11 — Validación | ⏳ PLANIFICADA | Evidencia real de uso |
| UX-12 — Polish | ⏳ PLANIFICADA | Condición de éxito §56 |

## 2. Mapa de fases (§35) — detalle

> Criterio transversal (§48): **ninguna fase se cierra porque "el agente terminó"**. Cada fase necesita: entregables, evidencia, validación, documentación y criterios de aceptación verificables.

### UX-0 — FREEZE Y DOCUMENTACIÓN ✅ COMPLETA

- **Objetivo:** cerrar formalmente el dominio financiero como contrato estable antes de tocar UX.
- **Entregables:** `docs/FINANCIAL-DOMAIN-FREEZE.md`; `PROJECT-RULES.md` §18 (regla permanente); prompt maestro `docs/freeze + UX-UI.md`.
- **Evidencia (verificada):** R15.3.2 cerrada y committeada; índices de producción materializados en Atlas; **CONTRACT OK 5/5**; suite 1340/1340; matriz de serialización 18/18.
- **Validación:** auditoría externa aprobó los resultados y autorizó el freeze (2026-09-13).
- **Criterios de aceptación:** documento de freeze completo (§4 del prompt maestro: fecha, alcance, reglas, operaciones, garantías, procedimiento de reapertura) y regla §54/§18 incorporada a PROJECT-RULES.
- **Fases destinatarias:** todas.

### UX-1 — AUDITORÍA UX/UI ✅ COMPLETA

- **Objetivo:** entender el estado real de la UI/UX antes de rediseñar; cero código (§5).
- **Entregable:** `docs/UX-UI-AUDIT.md`.
- **Evidencia:** 19 hallazgos con `file:line` verificados por lectura (H-01…H-19); respuestas a los 11 puntos del encargo; buen uso de severidad (P0/P1 solo donde corresponde; H-17 etiquetado NO VERIFICABLE).
- **Validación:** hallazgos rastreables a código; sin invenciones (la evidencia se re-verificó durante la redacción de este paquete).
- **Criterios de aceptación:** sin P0/P1 de flujo inventados; todo hallazgo con recomendación y usuario afectado; los NO VERIFICABLES marcados como tales.
- **Fases destinatarias:** UX-3, UX-4, UX-5, UX-6, UX-7, UX-8, UX-9, UX-10, UX-12.

### UX-2 — INVESTIGACIÓN COMPETITIVA Y DE USUARIOS ✅ COMPLETA

- **Objetivo:** aprender, no copiar (§6).
- **Entregable:** `docs/UX-COMPETITIVE-RESEARCH.md`.
- **Evidencia:** corpus de reseñas (App Store/Play/TrustRadius/G2/Gartner/PCMag/Reddit) con honestidad denuncia-vs-hecho; 10 patrones positivos, 11 negativos, 10 oportunidades; secciones obligatorias "Lecciones para TwinCap" y "Errores que TwinCap debe evitar".
- **Validación:** distinción verificado/inferido; citas en idioma original; sin URLs inventadas (trazabilidad por plataforma).
- **Criterios de aceptación:** ≥4 competidores cubiertos; ambas secciones obligatorias presentes; aplicabilidad: cada lección referencia una oportunidad concreta.
- **Fases destinatarias:** UX-3, UX-5, UX-8, UX-10.

### UX-3 — ARQUITECTURA DE INFORMACIÓN 📄 ENTREGADA

- **Objetivo:** definir navegación principal/secundaria, jerarquía con protagonismo, naming, rutas (respetando el App Router), y el Resumen como CENTRO de comprensión financiera (§38).
- **Entregable:** `docs/UX-INFORMATION-ARCHITECTURE.md` — 12 decisiones DEC-IA, jerarquía de 5 niveles del §9, Regla de Oro §41 mapeada, cards priorizadas (§10), mismo modelo mental móvil/desktop (§27), anchos canónicos (H-15).
- **Evidencia (consumida):** H-07 (naming), H-14 (back), H-15 (anchos), inventario real de rutas y nav (`nav.tsx:17-32`).
- **Validación:** aprobación explícita del fundador (R3.13) antes de implementar navegación; coherencia cruzada con la auditoría y el benchmark.
- **Criterios de aceptación:** navegación aprobada con nombres es/en; DEC-IA-01 resuelve H-07; ninguna ruta existente cambia sin evidencia; el Resumen queda definido en 5 niveles con la Regla de Oro verificable.
- **Fases destinatarias:** UX-5 (directo), UX-6, UX-7, UX-10.

### UX-4 — DESIGN SYSTEM 📄 ENTREGADO

- **Objetivo:** fundamentos → componentes → patrones → páginas (§39), nunca página por página.
- **Entregable:** `docs/UX-DESIGN-SYSTEM.md` — 13 decisiones DEC-DS; colores desde tokens existentes; tipografía con fix H-02; inventario §31 mapeado a existentes/nuevos; 12 estados explícitos (§15); a11y; responsive por tarea; confianza visible (§14).
- **Evidencia (consumida):** H-01 (tokens), H-02 (tipografía), H-19 (marca), H-05/H-11/H-12/H-13/H-16/H-18 (a11y); tokens verificados en `globals.css:16-69`.
- **Validación:** revisión del fundador; los componentes nuevos se extraen con regla de 2+ usos (§31).
- **Criterios de aceptación:** ninguna página se rediseña sin sistema; DEC-DS-01/02/03 cierran H-01/H-02/H-19 (implementación en UX-10).
- **Fases destinatarias:** UX-5…UX-12 (todas las de implementación).

### UX-5 — REDISEÑO DEL RESUMEN ⏳ PLANIFICADA

- **Objetivo:** convertir `/dashboard` en el **centro de comprensión financiera** (§2 del prompt maestro, §40): el usuario sabe dónde está financieramente en 10 segundos.
- **Entregables:**
  1. `docs/UX-RESUMEN-DESIGN.md` — **diseño conceptual ANTES de implementar** (§40): estructura, jerarquía (5 niveles), cards (DEC-IA-07), métricas, contexto, periodos, alertas, evolución, acciones rápidas, estados vacíos.
  2. Implementación del rediseño (sub-fases: diseño → aprobación → implementación → verificación).
- **Criterios de aceptación (§41 verificado empíricamente):** con build de producción, un usuario sin entrenamiento responde en 10 s: ¿cuánto tengo? ¿qué pasa? ¿mejor o peor? ¿dónde está el problema? ¿qué revisar? — validado con ≥5 usuarios en UX-11. **TTI medido (H-17)**: objetivo frío <10 s sin degradar el resto; el resultado se documenta antes/después.
- **Incluye el P0 de naming (H-07)** (DEC-IA-01).
- **Fases destinatarias:** UX-11 (validación), UX-12 (polish).

### UX-6 — FLUJOS CORE ⏳ PLANIFICADA

- **Objetivo:** rediseñar los flujos transaccionales con fricción mínima (benchmark lección 2) y confirmación informada en toda acción que toca dinero.
- **Alcance:** alta de movimientos, venta POS, transferencia, abonos/cobros, créditos (recibidos/otorgados), cuentas por pagar, escritura de saldo inicial.
- **Criterios de aceptación:**
  - **H-06 (P0):** "marcar como pagado" **CERRADO (2026-09-14)** — ConfirmDialog con monto pendiente + cuenta destino **obligatoria** en recibidos y otorgados (commit `46e967f`, tests financieros `credits-granted`/`tenant-isolation` + actions `accountRequired`, e2e `credits-pos` 7/7). Operaciones equivalentes restantes (abono manual, cobro, transferencia) siguen este patrón.
  - Confirmación informada de saldo negativo (junto al campo, saldo actual/operación/proyectado — F5).
  - Fórmulas sin jerga: abono de crédito explicado en lenguaje de negocio (benchmark oportunidad 3).
  - Gates §46 verdes + regresión financiera §47 CERO (checklist completo al final de la fase).
- **Fases destinatarias:** UX-7, UX-8, UX-9, UX-10, UX-11.

### UX-7 — RESPONSIVE MOBILE + DESKTOP ✅ COMPLETA (2026-09-16)

- **Objetivo:** experiencia deliberada en 375/768/1280 (§19); mobile-first, no mobile-only; mismo modelo mental (§27).
- **Criterios de aceptación — CERRADOS:**
  - **H-09 cerrado:** las 5 tablas densas puras (movements, transfers, clients, accounts, categories) tienen variante card-list <640px (`MovementCard` — `src/components/ui/movement-card.tsx`); `overflow-x` deja de ser la única solución (TableShell condicional `max-sm:hidden`); tabla desktop ≥640px byte-idéntica.
  - **H-11 cerrado (targets):** controles táctiles ≥44px — `TouchTarget` wrapper (`min-h-[44px] min-w-[44px]`) en ActionIconButton, BackButton, nav (hamburger/close/links/footer theme+lang+logout), sort headers, toolbars (Export CSV/Add movement/Load more) y Add transfer (RTT-1 remediation `f39a9d7`).
  - **H-15 cerrado:** anchos canónicos aplicados (DEC-IA-06) — shell `lg:max-w-[min(1536px,calc(100vw_-_3rem))]` (underscore Tailwind v4) en `(main)`/`(analytics)`: margen 24px/lado 1024–1536px, cap 1536px ≥1568px; `max-w-3xl` de analytics justificado (RSL-6).
  - Verificación visual en los 3 breakpoints en las pantallas principales (Resumen, Movimientos, Ventas, Créditos) — **pendiente fundador (RSL-8)**, no bloqueante (precedente UX-6).
- **Evidencia:** SDD `ux-7-responsive` — verify **PASS con warnings** (0 CRITICAL): suite **138 archivos / 1504 tests / 1334.80 s**, tsc limpio; 20 commits conventionales; archive-report Engram `sdd/ux-7-responsive/archive-report`.
- **Fases destinatarias:** UX-11 (validación visual).

### UX-8 — MICROCOPY + ESTADOS + ERRORES ⏳ PLANIFICADA

- **Objetivo:** lenguaje claro/humano/corto/neutro (§22) + estados explícitos (§15) sin implícitos.
- **Criterios de aceptación:**
  - **H-08 cerrado:** los 29 toasts "…exitosamente" migrados a verbo+objeto en es/en.
  - **H-03 cerrado:** todos los `aria-label` (incluido toggle de tema) pasan por `messages/`.
  - **H-04 cerrado:** `src/app/not-found.tsx` localizado es/en con shell y enlace al inicio.
  - Los 12 estados del DS (DEC-DS-09) presentes donde aplican; cada uno responde qué ocurrió / datos seguros / qué hacer.
  - Paridad es/en verificada por lint/script (sin claves faltantes).
- **Fases destinatarias:** UX-9, UX-11.

### UX-9 — ACCESIBILIDAD ⏳ PLANIFICADA

- **Objetivo:** cerrar la deuda a11y en la base de componentes y verificar WCAG 2.1 AA en páginas clave.
- **Criterios de aceptación:**
  - **H-05/H-11 cerrados:** focus trap (modal + drawer), foco inicial y restauración.
  - **H-12/H-13/H-16/H-18 cerrados:** naming de diálogos, `aria-required`, un canal de anuncio, toggles con estado.
  - Navegación completa por teclado en las 5 pantallas principales; contraste AA; sin hallazgos P2 a11y pendientes al cierre.
- **Fases destinatarias:** UX-11.

### UX-10 — IMPLEMENTACIÓN ⏳ PLANIFICADA

- **Objetivo:** ejecutar el orden del §53 (ver §4) aplicando los sistemas aprobados (UX-3/UX-4).
- **Criterios de aceptación:** cada paso del §53 con gates §46 verdes + regresión §47; los P1 (H-01/H-02/H-03/H-04) se cierran en los pasos 1-2 (arquitectura/navegación) y UX-8; sin dependencias nuevas no justificadas (máx 1 por fase, §18); i18n es/en paridad en cada paso.
- **Fases destinatarias:** UX-11, UX-12.

### UX-11 — VALIDACIÓN ⏳ PLANIFICADA

- **Objetivo:** evidencia real, no "el agente terminó" (§48).
- **Entregables:** informe de validación con (1) test de usabilidad: ≥5 usuarios, tareas: registrar venta, registrar gasto, entender el Resumen en 10 s (Regla de Oro §41), cobrar un crédito; (2) medición de TTI (H-17) antes/después; (3) auditoría a11y automatizada + manual; (4) checklist §47 completo.
- **Criterios de aceptación:** sin P0/P1 abiertos; Regla de Oro superada por ≥4/5 usuarios; regresión financiera CERO (suite + tsc + lint + build).
- **Fases destinatarias:** UX-12.

### UX-12 — POLISH FINAL ⏳ PLANIFICADA

- **Objetivo:** refinamiento (micro-interacciones, transiciones, detalles de empty states, P3 residuales H-08/H-19 terminados).
- **Criterios de aceptación:** condición de éxito §56 declarable con evidencia (ver §6); revisión final de los 19 hallazgos con estado cerrado/pendiente-justificado.

## 3. Tabla RESUMEN DE FASES

| Fase | Estado | Entregable | Criterio de cierre principal |
|---|---|---|---|
| UX-0 | ✅ | Freeze + regla §18 | Freeze documentado y aprobado |
| UX-1 | ✅ | Auditoría (19 hallazgos) | Evidencia file:line; severidad sin inflar |
| UX-2 | ✅ | Benchmark | Lecciones + errores obligatorios; honestidad |
| UX-3 | ✅ | Arquitectura de Información (aprobada 2026-09-14) | DEC-IA aprobadas; Resumen en 5 niveles |
| UX-4 | ✅ | Design System (aprobado 2026-09-14) | Fundamentos→componentes→patrones→páginas |
| UX-5 | ✅ | Resumen 5 niveles implementado (`b679cb8`) + TTI medido | Regla de Oro 10 s → hero 2.3–2.4 s frío 375+3G |
| UX-6 | ✅ | Flujos core rediseñados — `MoneyActionConfirmation` + F5 (HEAD `02e883f`) | H-06 cerrado; confirmaciones financieras implementadas |
| UX-7 | ✅ | Responsive 375/768/1280 — `MovementCard` + `TouchTarget` + shell viewport-relative (HEAD `f39a9d7`) | H-09/H-11/H-15 cerrados |
| UX-8 | ⏳ | Microcopy + estados + errores | H-08/H-03/H-04 cerrados; paridad es/en |
| UX-9 | ⏳ | A11y | H-05/H-11/H-12/H-13/H-16/H-18 cerrados |
| UX-10 | ⏳ | Implementación (orden §53) | Gates §46 + regresión §47 en cada paso |
| UX-11 | ⏳ | Validación | ≥5 usuarios; Regla de Oro; TTI; regresión 0 |
| UX-12 | ⏳ | Polish | Condición de éxito §56 |

---
## 4. Priorización de hallazgos (§52)

> Regla §52: P0 = impide usar/comprender; P1 = deteriora significativamente confianza/claridad/conversión; P2 = mejora importante; P3 = polish. **No convertir todo en P0.** El mapa base del encargo se conserva; el ajuste documentado: H-09/H-11/H-12 se agrupan en P2 (misma familia a11y/responsive que H-05/H-16) — no cambia severidad de ningún hallazgo individual, solo completa el mapa.

### 4.1. P0 — impide usar o comprender el producto

| Hallazgo | Fase | Justificación (evidencia) |
|---|---|---|
| **H-06** — "Marcar como pagado" sin confirmación | UX-6 (primera tarea de flujos core) | Operación financiera de un clic sin confirmación = riesgo de error irreparable percibido/real; incoherente con el patrón ConfirmDialog del propio módulo (write-off). Benchmark: patrones negativos 1 y 3 (confianza) |
| **H-17** — TTI del Resumen no medido | UX-5 (medición) + UX-11 (validación) | La Regla de Oro §41 (10 s) es imposible de garantizar sin medición; hoy el análisis de código muestra cold start potencialmente >10 s (force-dynamic + 8 repos + proxy connectDb) |
| **H-07** — Naming "Informes"/"Reportes" | UX-5 (naming dentro del rediseño) | Confusión directa del módulo principal; bloquea la coherencia de navegación (DEC-IA-01). §34: CLARIDAD es criterio de calidad |

### 4.2. P1 — deterioran significativamente confianza/claridad/conversión

| Hallazgo | Fase | Justificación |
|---|---|---|
| **H-01** — Tokens inexistentes (no-op) | UX-4 (definición) + UX-10 (paso 2, implementación) | El sistema de tokens existe; el no-op silencioso degrada Analítica (fundador) y el preview "Total a pagar" (comprensión pre-guardado) |
| **H-02** — Cuerpo en Arial | UX-4 (DEC-DS-02) + UX-10 (paso 2) | Identidad muerta; percepción de producto genérico; Sora mal usado en `th` |
| **H-03** — aria-labels en inglés | UX-8 | a11y e i18n rotos en ambos idiomas; fix trivial en messages/ |
| **H-04** — 404 default EN | UX-8 | Punto de entrada con shell roto e idioma incorrecto; rápido y de alto impacto percibido |

### 4.3. P2 — mejoras importantes

| Hallazgo | Fase | Justificación |
|---|---|---|
| **H-05** — Modal sin focus trap | UX-9 | Base a11y; impacta todos los diálogos |
| **H-11** — Drawer sin trap + targets 36px | UX-9 (trap) + UX-7 (targets) | Base a11y móvil + cumplimiento de targets táctiles |
| **H-16** — Doble anuncio de toast | UX-8/UX-9 | a11y de feedback; decisión única de canal |
| **H-18** — Toggles sin `aria-pressed` | UX-9 | a11y de dashboard |
| **H-13** — Select sin `aria-required` | UX-9 (con UX-6 en formularios) | a11y de formulario POS |
| **H-12** — Dialog sin nombre | UX-9 | a11y de modal base |
| **H-10** — Empty states duplicados | UX-10 (paso 9/10, módulos) | Consistencia; usa componente existente |
| **H-14** — BackButton redundante | UX-10 (paso 1, navegación) | DEC-IA-05: back solo con entrada previa |
| **H-15** — Anchos divergentes | UX-10 (paso 2, arquitectura) + UX-7 | DEC-IA-06: ancho canónico por tipo de tarea |
| **H-09** — Tablas móvil | UX-7 | Responsive por tarea (DataTable↔MovementCard) |

### 4.4. P3 — polish

| Hallazgo | Fase | Justificación |
|---|---|---|
| **H-08** — 29 toasts "…exitosamente" | UX-8 | Consistencia de microcopy; sin impacto funcional |
| **H-19** — Hero indigo fuera de marca | UX-4 (token, DEC-DS-03) + UX-10/UX-12 | Identidad visual; menor prioridad que claridad y confianza |

### 4.5. Tabla de prioridades del roadmap (hallazgo → fase)

| Prioridad | Hallazgos | Fases de ejecución |
|---|---|---|
| **P0** | H-06, H-17, H-07 | UX-5, UX-6, UX-11 |
| **P1** | H-01, H-02, H-03, H-04 | UX-4/UX-10, UX-8 |
| **P2** | H-05, H-11, H-16, H-18, H-13, H-12, H-10, H-14, H-15, H-09 | UX-7, UX-8, UX-9, UX-10 |
| **P3** | H-08, H-19 | UX-4, UX-8, UX-10, UX-12 |

## 5. Orden de implementación (§53)

El §53 fija 13 pasos. Este roadmap los conserva ÍNTEGROS en orden y los agrupa en fases de ejecución; único ajuste documentado: los pasos 1-2 (navegación, arquitectura) se ejecutan como pre-requisito del paso 3 (Resumen) — evidencia de dependencia: DEC-IA-01/02/05/06 definen los nombres y el layout sobre los que el Resumen se monta; implementar el Resumen antes de la navegación obligaría a rehacer ambos (justificado por §53 "el orden puede cambiar si la auditoría demuestra una dependencia diferente").

| # §53 | Paso | Fase de ejecución | Hallazgos que cierra |
|---|---|---|---|
| 1 | Navegación | UX-10 (inicio) — pre-requisito del Resumen | H-07, H-14, H-03 (aria en nav) |
| 2 | Arquitectura | UX-10 (inicio) — pre-requisito del Resumen | H-01, H-02, H-15 |
| 3 | Resumen | UX-5 (diseño conceptual aprobado ANTES — §40) | H-17, H-07 |
| 4 | Flujos core | UX-6 | H-06 |
| 5 | Formularios | UX-6 (patrón FormField de UX-4) | H-13 (en UX-9 para a11y) |
| 6 | Movimientos | UX-6/UX-10 | H-09 (vista móvil en UX-7) |
| 7 | Cuentas | UX-6/UX-10 | — |
| 8 | POS | UX-6/UX-10 | — |
| 9 | Clientes/Productos | UX-10 | H-10 (clientes/categorías) |
| 10 | Créditos/Abonos | UX-6/UX-10 | H-06 (confirmación) |
| 11 | Reportes | UX-10 (secciones del Resumen; `/reports` FUTURA — DEC-IA-09) | — |
| 12 | Configuración | UX-10 | DEC-IA-10/11 |
| 13 | Polish | UX-12 | H-08, H-19 |

## 6. Estrategia del Resumen (UX-5) — diseño conceptual PRIMERO

Regla del §40: **antes de implementar el Resumen, documentar su arquitectura propuesta.** Estado actual:

- **Ya documentado en UX-3 (este paquete):** jerarquía de 5 niveles (§9) mapeada a regiones (hero/desglose/evolución/atención/detalle — sección 9 de `UX-INFORMATION-ARCHITECTURE.md`); Regla de Oro mapeada a las 5 preguntas; cards priorizadas justificadas (DEC-IA-07: Disponible + Resultado en N1, desglose en N2, variación en N3, compromisos + alertas condicionales en N4); filtros y período; no-suma cross-currency.
- **Pendiente en `docs/UX-RESUMEN-DESIGN.md` (entregable de UX-5):** estructura visual por breakpoint (wireframes de los 5 niveles en 375/768/1280), métricas exactas (definición de cada cifra con su `kind` de origen, sin recalcular en frontend), contenido de alertas (umbrales: saldo negativo, cobros vencidos, gasto atípico vs promedio reciente), acciones rápidas (nuevo movimiento, nueva venta, registrar abono), estados vacíos por nivel (first-use, sin datos del período), evolución (gráfico 6/12 meses reales — patrón existente), y medición TTI antes/después (H-17).
- **Orden interno de UX-5:** 1) diseño conceptual (este entregable) → 2) aprobación R3.13 → 3) implementación → 4) verificación §41 con usuarios (en UX-11).

## 7. Reglas transversales (toda fase)

1. **FREEZE del dominio (§18 PROJECT-RULES / FINANCIAL-DOMAIN-FREEZE):** UX/UI se adapta al dominio, nunca a la inversa. Frontend presenta; backend calcula (§32). Cualquier evidencia de defecto financiero real: detener, documentar, proponer corrección mínima, solicitar aprobación (procedimiento §2 del prompt maestro).
2. **No regresión financiera (§47/§49):** tras CADA conjunto significativo de cambios se verifica que siguen funcionando: crear/editar/eliminar movimiento, transferencias, multimoneda, saldo negativo, créditos, abonos, POS, opening balances, operaciones multi-cuenta, idempotencia y aislamiento tenant. **Regresión financiera = bloqueante de fase.**
3. **Gates por fase (§46):** TypeScript (`tsc --noEmit`), lint, tests (Vitest; suites de concurrencia/transacción con `MongoMemoryReplSet`), build. Ninguna fase se cierra con gates rojos ni tests suprimidos.
4. **i18n:** paridad estricta es/en en `messages/`; todo texto visible Y accesible (incluidos `aria-label`) pasa por i18n; español NEUTRO (prohibido voseo/regionalismos).
5. **pnpm exclusivo**; máximo UNA dependencia nueva por fase, justificada y documentada (§18).
6. **Sin feature bloat (§30):** toda funcionalidad nueva requiere problema, usuario afectado, frecuencia, valor, complejidad, impacto UX, impacto dominio, impacto futuro.
7. **Protocolo R3.13 (aprobación por fase):** auditoría → plan → aprobación explícita del fundador → implementación → tests → documentación → detenerse. Cada fase comienza SOLO con su aviso explícito.
8. **Cierre por evidencia (§48):** entregables + evidencia + validación + documentación + criterios de aceptación; nunca "el agente terminó".
9. **No tocar el dominio congelado** por razones visuales (§2 del prompt maestro — lista explícita de prohibiciones).
10. **Auditoría visible:** cuando el sistema toca datos, la UI muestra trazabilidad (vínculos/origen) — patrón DEC-DS-12.

## 8. Condición de éxito (§56)

Esta etapa estará bien encaminada —y solo se declarará terminada— cuando se cumpla:

> CLARIDAD > CANTIDAD · CONFIANZA > EFECTOS · UTILIDAD > DECORACIÓN · COMPRENSIÓN > DENSIDAD · CONSISTENCIA > IMPROVISACIÓN · EXPERIENCIA > FEATURE COUNT

Y especialmente, verificable en UX-11:

> **"Al abrir Resumen, el usuario sabe dónde está financieramente."**

Declarar terminada la etapa por "todas las páginas rediseñadas / colores cambiados / cards agregadas / iconos nuevos" es **explícitamente insuficiente** (§56).

## 9. Próxima acción (protocolo R3.13)

Presentados los entregables UX-0…UX-4 (freeze ✅, auditoría ✅, benchmark ✅, IA 📄, Design System 📄), el siguiente paso es **la aprobación explícita del fundador** para: (1) validar DEC-IA y DEC-DS, (2) autorizar la Fase UX-5 (diseño conceptual del Resumen → `docs/UX-RESUMEN-DESIGN.md`), y (3) autorizar el inicio de implementación según el §53 (pasos 1-2: navegación y arquitectura, que requieren UX-4 aprobado). Ninguna fase posterior comienza sin ese aviso (R3.13).