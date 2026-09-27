# Ronda Post-UX/UI — Informe final de cierre (C12-11)

> Fecha: 2026-09-26 · Contrato: `docs/Cierre_UX-UI.md` §26 (informe A-H) + §29/FASE 10 (checklist).
> Base: `master` @ `2359e9f` + unidad de trabajo local sin commitear (ver §B).
> Evidencia detallada: `docs/POST-UX-AUDIT.md` (17 requisitos), `docs/A11Y-RESPONSIVE-REPORT.md` (axe/responsive light+dark), tracker `docs/odd/tasks/post-ux-round.md`.

## A. Hallazgos (clasificados por severidad)

| #   | Severidad           | Hallazgo                                                                                                                                                                                                                                                                                                                       | Origen                                           |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 1   | **Critical (prod)** | Crash de serialización RSC en empty states: server pages pasaban forwardRef de lucide (`icon={Users}`, default `Inbox`) al client `Icon` → `Functions cannot be passed directly to Client Components` y página 500 cuando la lista estaba vacía (clients, accounts, categories + cualquier EmptyState por defecto)             | Destapado por el audit sweep (§C12-9)            |
| 2   | **Serious (a11y)**  | Contraste light: `zinc-500` sobre superficies pastel = 4.06-4.33:1 (< 4.5 requerido), causa sistémica en ~65 sitios + tokens `success/info/debt` light insuficientes                                                                                                                                                           | axe sweep                                        |
| 3   | **Serious (a11y)**  | Contraste dark: pares `dark:*` heredados del fix light (2.28-3.67:1) + `--tc-primary` dark usado como TEXTO (3.66:1)                                                                                                                                                                                                           | axe sweep pasada dark                            |
| 4   | **Serious (a11y)**  | Tabla legal `/cookies` scrollable horizontal sin acceso por teclado                                                                                                                                                                                                                                                            | axe sweep                                        |
| 5   | **Serious (E2E)**   | Suite E2E roja: 6 passed / 8 failed / 3 flaky / 18 did not run — dos causas raíz: (a) specs POS desactualizados vs rewrite C12-3b/c + rename C12-4; (b) tormenta de revalidación (12 rutas del sidebar × 2 re-fetch tras cada mutación por prefetch de `<Link>`) amplificando latencia y colgando formularios en `Creating...` | Diagnóstico C12-10 con traces + probes de timing |
| 6   | **Minor (entorno)** | En Windows local, server actions de escritura 2.7-4.5 s vs 202-479 ms del mismo código en bare Node/Vitest; mongod exonerado (57 ms/tx). Factor ambiental del proceso prod local; CI Linux sano (31 passed)                                                                                                                    | Probes C12-10                                    |
| 7   | **Minor (hygiene)** | Turbopack copiaba mongoose a `.next/node_modules` (copia plana paralela)                                                                                                                                                                                                                                                       | Diagnóstico C12-10                               |

## B. Correcciones (qué se modificó y dónde)

**Producto (código):**

1. `src/components/ui/icon.tsx` — deja de ser `'use client'` → componente compartido; el prop `icon` nunca cruza la frontera RSC (fix hallazgo 1).
2. Contraste light: `text-zinc-500 dark:text-zinc-400` → `text-zinc-600 dark:text-zinc-400` (más de 20 archivos de UI); `text-zinc-400` de texto → `text-zinc-600` (contadores de abonos, monedas de summary-cards); gráficos no-textuales → `zinc-500` (chevron Select, EmptyState, trash POS); tokens light `globals.css`: `--tc-success` → `#047857`, `--tc-info` → `#1d4ed8`, `--tc-debt` → `#9a3412`.
3. Contraste dark: labels dashboard y copyright landing → `dark:text-zinc-400`; **nuevo token `--tc-primary-soft`** (light = alias de primary; dark = `#60a5fa`, 7.2:1) + migración `dark:text-primary` → `dark:text-primary-soft` (17 archivos); excepción deliberada: Button `inverse` conserva `text-primary` sin flip (blanco sobre gradiente brand, 4.82:1 ambos temas).
4. `src/components/legal/legal-page.tsx` — `tabIndex={0}` + `focus-visible` en el wrapper `overflow-x-auto`.
5. `src/app/(main)/nav.tsx` — `prefetch={false}` en los links del sidebar (rutas force-dynamic: el prefetch moría igual; loading.tsx cubre la navegación).
6. `next.config.ts` — `serverExternalPackages: ["mongoose"]` (hygiene, sin efecto medible).

**Tests:** 7. `e2e/credits-pos.spec.ts` + `e2e/measure-scroll.spec.ts` — actualizados a la UI real C12-3c/C12-4 (searcher combobox, labels products & services, price formateado). 8. `e2e/audit-sweep.spec.ts` (NUEVO) — sweep standalone axe WCAG (2a/2aa/21aa/22aa) + 120 capturas (20 rutas × 375/768/1280 × light+dark) con datos sembrados; gate 0 critical/serious en ambos temas; excluido del suite permanente vía `testIgnore` condicional (`AUDIT_INCLUDE_SWEEP=1` lo habilita).

**Documentación:** 9. `docs/A11Y-RESPONSIVE-REPORT.md` (NUEVO) · `docs/POST-UX-AUDIT.md` (C12-9 cerrada) · `docs/odd/tasks/post-ux-round.md` (C12-9/10/11 cerradas) · `docs/AUDIT-AND-PLAN.md` (estado) · `AGENTS.md` + `.gitignore` (higiene GGA/gentle-ai, heredada de la sesión previa).

## C. Decisiones de producto

1. **Clients/Catalog solo-búsqueda durante beta** (C12-6, fundador 2026-09-23) — reevaluar al crecer el volumen.
2. **Prefetch desactivado en el sidebar** — el router cache de rutas force-dynamic muere en cada `revalidatePath`; el costo/beneficio no justifica el storm.
3. **Split del token primario** (`--tc-primary` bg vs `--tc-primary-soft` texto) — un solo token no puede satisfacer restricciones de contraste opuestas en dark.
4. **Excepción Button `inverse`** — fondo blanco fijo sobre gradiente brand: sin flip de texto.
5. **Sweep axe como herramienta standalone** — excluida del gate regular (18 min); invocación explícita `AUDIT_INCLUDE_SWEEP=1`.
6. **`serverExternalPackages: ["mongoose"]`** — práctica documentada, higiene.

## D. No implementado deliberadamente (con estado documental)

| Área                                             | Estado                                                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Offline: cache/sync de datos financieros         | **diseñado** (`OFFLINE-ARCHITECTURE.md`); implementado solo indicador de conectividad (fase segura C12-8) |
| PT-BR                                            | **preparado** (`I18N-PT-BR-PREP.md`); locale NO habilitado                                                |
| Costos/inventario COGS                           | **diseñado** (`COSTS-DESIGN.md`); sin implementación                                                      |
| Analítica futura                                 | **diseñada** (`ANALYTICS-ROADMAP.md`); sin métricas nuevas                                                |
| Módulo Compras                                   | **fuera de alcance** (prohibido inventarlo — AGENTS.md)                                                   |
| Teams/Billing                                    | post-beta, fuera de alcance                                                                               |
| Axe sobre modales abiertos / estados hover-focus | **pendiente documentado** (limitación de axe; foco/trap cubierto por tests UX-9 S1-S4 y E2E de flujos)    |

## E. Riesgos restantes (reales)

1. **Factor ambiental Windows-local**: server actions de escritura 2-4.5 s bajo `next start` local (bare Node: 0.2-0.5 s). No afecta CI ni producción (Vercel/Linux); monitorear TTI en prod si se reporta lentitud.
2. **Flaky E2E conocidos** (documentados §24 del contrato): `destination stream closed early` + register limiter — regla: 1 retry máximo; en la corrida final 35/35 no aparecieron.
3. **CI E2E**: la última corrida CI (36224383118) aún no incluye los fixes de specs de esta unidad; verificación esperada en el push (31 passed + 2 specs corregidos).
4. **axe limitado a estilo computado por defecto**: hover/focus y modales abiertos fuera del gate (documentado en A11Y-RESPONSIVE-REPORT).

## F. Tests (resultados completos)

| Gate                                           | Resultado                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| `tsc --noEmit`                                 | EXIT 0                                                                              |
| `pnpm lint`                                    | EXIT 0 (0 errores, 10 warnings preexistentes)                                       |
| Prettier (tocados)                             | limpio                                                                              |
| Vitest completo (`pnpm test`, timeout 2.7M ms) | **1695/1695, 162 archivos, 1717.84 s**                                              |
| E2E completa (`pnpm test:e2e`, runner ≥90 min) | **35/35 passed en 28.6 min** (antes 6/8/3/18 en 55.1 min)                           |
| Audit sweep axe light+dark                     | **0 violaciones critical/serious** (20 rutas × 2 viewports × 2 temas); 120 capturas |
| Galería responsive                             | light **aprobada por el owner**; dark **aprobada por el owner**                     |
| Parity i18n (`pnpm parity`)                    | 4/4 (gate declarado en el repo)                                                     |

## G. Confirmación financiera

Se confirman explícitamente **INTACTOS**:

- **Atomicidad** — `MongoUnitOfWork.withTransaction` sin cambios; los únicos diffs en `src/infrastructure/transactions` y `src/core` son de formato prettier en archivos tocados (comillas), cero lógica.
- **Idempotencia** — claims/gates P1.2 intactos; `e2e/audit-sweep.spec.ts` usa el flujo estándar de forms.
- **Concurrencia** — matriz §23/CAS sin cambios; ninguna escritura nueva fuera de `uow.withTransaction`.
- **Aislamiento (tenant)** — sin cambios; el sweep corre con usuario real y workspace propio.
- **Multi-moneda** — sin cambios; el sweep incluye transferencia COP↔USD solo como sembrado visual.
- **Invariantes financieras (principios 1-7 de AGENTS.md)** — sin cambios; el freeze financiero del contrato (§2 del Cierre) NO fue reabierto: la excepción C12-2 (corrección de saldo inicial) ya estaba aprobada e implementada antes de esta pasada.

## H. Offline (estado por capas)

- **Implementado**: indicador de conectividad accesible (`ConnectivityNotice`, C12-8) en el layout autenticado; service worker de shell público (cache de rutas no autenticadas, jamás datos de usuario).
- **Preparado**: arquitectura completa documentada (`OFFLINE-ARCHITECTURE.md`) con frontera cache pública/auth y estrategia de sincronización futura.
- **Diseñado**: cola/sync financiera offline (post-beta, documento de arquitectura §futuro).
- **Pendiente**: cualquier cache de datos autenticados o escritura offline — deliberadamente NO implementado en esta ronda (fase segura).

---

## Checklist de cierre — los 22 apartados de requisito (§4–§25 del contrato)

| §   | Apartado                              | Estado                              | Evidencia                                                                               |
| --- | ------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| 4   | Venta POS desktop                     | ✅ implementado                     | C12-3 + b/c/d/e/f/g/h/i (tracker); specs E2E actualizados; 35/35                        |
| 5   | Confirmación de cierre accidental POS | ✅ implementado                     | C12-1 (`e081821`); modal dirty-guard; tests modal + sale-form                           |
| 6   | Orden cronológico de movimientos      | ✅ implementado                     | C12-5; cursor `date/createdAt/_id` DESC; regresiones nuevas                             |
| 7   | Corrección del saldo inicial          | ✅ implementado                     | C12-2 (`b207265`); transacción+CAS+auditoría+idempotencia; excepción al freeze aprobada |
| 8   | Categorías sugeridas (backend)        | ✅ implementado                     | C12-4; allowlist + workspace idempotente                                                |
| 9   | Experiencia de categorías sugeridas   | ✅ implementado                     | catálogo LATAM opt-in, sin preselección; refinamientos 2026-09-24                       |
| 10  | Clients/Catalog — decisión            | ✅ registrada                       | C12-6: solo-búsqueda durante beta (fundador)                                            |
| 11  | Offline — arquitectura + fase segura  | ✅ arch. documentada + indicador    | `OFFLINE-ARCHITECTURE.md` + C12-8 `ConnectivityNotice`                                  |
| 12  | Preparación PT-BR                     | ✅ preparado (locale no habilitado) | `I18N-PT-BR-PREP.md`                                                                    |
| 13  | Diseño de costos                      | ✅ diseñado (no implementado)       | `COSTS-DESIGN.md`                                                                       |
| 14  | Roadmap de analítica                  | ✅ diseñado (no implementado)       | `ANALYTICS-ROADMAP.md`                                                                  |
| 15  | Cards y listas                        | ✅ verificado                       | responsive sweep 375/768/1280; `MovementCard` en 5 listas                               |
| 16  | Formularios                           | ✅ verificado                       | labels/asociación (UX-9/10); sweep visual; F5 informado                                 |
| 17  | Resumen                               | ✅ verificado                       | N1-N5 (UX-5); sweep dashboard con datos                                                 |
| 18  | Accesibilidad                         | ✅ **0 violaciones axe light+dark** | `A11Y-RESPONSIVE-REPORT.md`; UX-9 focus trap/labels                                     |
| 19  | Responsive                            | ✅ verificado visualmente           | 120 capturas aprobadas por el owner                                                     |
| 20  | Saldos y valores extremos             | ✅ verificado                       | E2E negative-balance/multicurrency 35/35; formatter central                             |
| 21  | Auditoría global post-UX              | ✅ completa (17/17)                 | `docs/POST-UX-AUDIT.md` + hallazgos corregidos (§A de este informe)                     |
| 22  | Pruebas consolidadas                  | ✅ ejecutadas                       | Vitest 1695/1695 · E2E 35/35 · tsc/lint/build · axe light+dark                          |
| 23  | Nuevas pruebas obligatorias           | ✅ cubiertas                        | specs POS actualizados, sweep standalone, regresiones C12-5                             |
| 24  | Flaky tests conocidos                 | ✅ regla aplicada                   | 1 retry máx.; corrida final sin flaky                                                   |
| 25  | Documentación de cierre               | ✅ actualizada                      | tracker + AUDIT-AND-PLAN + 4 informes; histórico intacto                                |

**Criterio de éxito §29**: todos los pendientes del contrato resueltos ✅ · decisión registrada ✅ · arquitectura offline documentada ✅ · fase segura offline ✅ · PT-BR preparado ✅ · costos diseñados ✅ · analítica documentada ✅ · auditoría global completa ✅ · pruebas completas ejecutadas ✅ · regresiones cubiertas ✅ · documentación actualizada ✅ · informe final generado (este documento) ✅ · 22 criterios comprobados ✅ · **sin regresión financiera ✅ (§G)**.

> **Declaración**: con la evidencia anterior, la Ronda Post-UX/UI queda lista para el cierre formal. La declaración definitiva se emite con el commit/push de la unidad de trabajo (aviso del fundador), conforme al protocolo R3.13.
