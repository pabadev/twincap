# TWINCAP — AUDITORÍA UX/UI — FASE UX-1 (SOLO LECTURA)

> **Fecha:** 2026-09-13
> **Estado:** COMPLETADA — informe de lectura única; sin modificación de código
> **Fuente normativa:** `docs/freeze + UX-UI.md` (prompt maestro, §5 y §36)
> **Documentos relacionados:** `docs/FINANCIAL-DOMAIN-FREEZE.md` (dominio congelado), `docs/PROJECT-RULES.md` (§15/§18), `docs/UX-COMPETITIVE-RESEARCH.md` (UX-2), `docs/UX-INFORMATION-ARCHITECTURE.md` (UX-3), `docs/UX-DESIGN-SYSTEM.md` (UX-4), `docs/UX-ROADMAP.md` (plan maestro)

---

## 1. Ficha técnica

| Campo | Valor |
|---|---|
| Proyecto | TwinCap (SaaS de finanzas personales y pequeños negocios) |
| Fase | UX-1 — Auditoría UX/UI del estado actual |
| Alcance | Estado actual de la UI/UX. **SOLO LECTURA.** Dominio financiero **CONGELADO** (no auditado): se consumen sus contratos, no se rediseñan sus reglas |
| Método | Lectura completa del código relevante de UI (`src/app`, `src/components`, `src/i18n`, `messages/`); toda evidencia citada como `file:line` fue verificada por lectura |
| Hallazgos NO VERIFICABLES | Requieren ejecución (build/medición) — etiquetados como tales; NO fueron declarados verificados |
| Clasificación de severidad | P0 (impide usar/comprender) · P1 (deteriora confianza/claridad/conversión) · P2 (mejora importante) · P3 (polish). Uso restringido: P0/P1 solo para lo que realmente lo amerita (§52) |

## 2. Resumen ejecutivo

- **Sin hallazgos P0/P1 de flujo:** no hay flujos rotos ni errores sin manejo en el código leído. Los hallazgos graves son de tipografía y tokens (H-01, H-02), no de funcionalidad.
- **19 hallazgos documentados** (H-01…H-19): 2 de impacto alto (P2), 12 mejoras importantes (P2/P3) y 1 NO VERIFICABLE (H-17, requiere ejecución).
- **El sistema visual existe pero se improvisa en bordes:** hay tokens `--tc-*` → `@theme inline` y dark mode por clase (verificado), y a la vez Arial en `body`, gradiente indigo crudo en el hero, utilidades Tailwind inexistentes (patrón shadcn) que se degeneran en no-op silencioso, y Sora restringido a los headers de tablas.
- **El patrón de formularios es maduro y consistente:** `useActionState` + `IdempotencyField` + `tzOffset` + toast + `useActionError`, fieldset/legend, validaciones inline, modales anidados fuera del form.
- **El dashboard actual es el antecesor directo del nuevo "Resumen":** jerarquía rica ya verificada (saludo, banner onboarding, filtros, SummaryCards, grilla de cuentas, 6 reportes, 2 SummaryTables, Top-3, gráfico mensual/anual, movimientos recientes, Posición Financiera; nunca suma cross-currency) — el rediseño (UX-5) parte de una base sólida.
- **Cumplimiento de regla de idioma:** grep sin coincidencias de voseo/regionalismos en UI — el español neutro se cumple (respuesta al encargo, punto 9).

---

## 3. A. HALLAZGOS

### 3.1. Tabla resumen

| ID | Sev. | Área | Problema en una línea | Evidencia |
|---|---|---|---|---|
| H-01 | P2 | Analítica / Créditos | Utilidades Tailwind inexistentes (`muted-foreground`, `card`) → no-op silencioso: Analítica pierde color muted y MetricCards no pintan fondo; preview "Total a pagar" pierde énfasis | `src/app/(analytics)/analytics/page.tsx:31,68,69,72`; `src/app/(main)/credits/granted/credit-form.tsx:154`; `src/app/(main)/credits/received/credit-form.tsx:154`; `src/app/globals.css:40-69` |
| H-02 | P2 | Global tipografía | `body` renderiza en Arial: identidad Geist muerta; Sora solo en headers de tabla | `src/app/globals.css:98-102` vs `:66-68`; `src/components/ui/table.tsx:54` |
| H-03 | P2 | Navegación a11y/i18n | `aria-label` del toggle de tema hardcodeado en INGLÉS (es y en) | `src/app/(main)/nav.tsx:222` y `:270` |
| H-04 | P2 | Global 404 | No existe `not-found.tsx` (glob confirmado); 404 default Next.js EN sin shell ni localización | `notFound()` en `(analytics)/layout.tsx:33` y `(analytics)/page.tsx:23` |
| H-05 | P2 | Modal a11y | Sin focus trap ni gestión de foco: Tab puede salir del diálogo | `src/components/ui/modal.tsx:28-44,59-61` |
| H-06 | P2 | Créditos — confirmación | "Marcar como pagado" (abono por saldo pendiente) se ejecuta SIN confirmación; contraste con write-off que sí usa ConfirmDialog danger | `src/app/(main)/credits/received/mark-as-paid-button.tsx:20-39` (+ gemelo en granted) vs `write-off-button.tsx:51-64` |
| H-07 | P2 | Dashboard/Navegación naming | Mismo módulo con dos nombres: nav "Informes" vs sección "Reportes" vs feature "Reportes y gráficos" | `messages/es.json:30` (`Nav.dashboard`), `:147` (`Dashboard.reports`), `:667` (`feature5Title`) |
| H-08 | P3 | Microcopy toasts | 29 claves "…exitosamente" — patrón robótico, sin verbo+objeto | `messages/es.json:575-606` |
| H-09 | P3 | Tablas móvil | Scroll horizontal como única solución (rompe regla mobile-first) | `src/components/ui/table.tsx:13-21` (TableShell `overflow-x-auto`); mitigación `src/app/(main)/movements/movements-list.tsx:332` (`min-w-[700px]`) |
| H-10 | P3 | Clientes/Categorías empty states | Empty states inline duplicados vs componente `EmptyState` existente | `src/app/(main)/clients/page.tsx:41-46`, `src/app/(main)/categories/page.tsx`; `src/components/ui/empty-state.tsx:11-23` (usado en `movements-list.tsx:311,319`) |
| H-11 | P3 | Drawer móvil a11y | Sin focus trap completo; targets 36px < 44px | `src/app/(main)/nav.tsx:107-133` (drawer), `:72-79` (focus inicial), `:81-88` (Escape), `:218-243` (controles `h-9`) |
| H-12 | P3 | Modal aria | `aria-label={title}`: si falta `title`, el diálogo queda sin nombre | `src/components/ui/modal.tsx:61` |
| H-13 | P3 | POS formulario | Asterisco manual en label; Select sin `required` → sin `aria-required` | `src/app/(main)/pos/sales/sale-form.tsx:206` |
| H-14 | P3 | Navegación BackButton | BackButton redundante con sidebar; destino no obvio | `movements-list.tsx:201`; presente también en accounts/categories/clients/transfers |
| H-15 | P3 | Layout anchos | Anchos divergentes entre páginas (listas vs formularios vs sin límite) | `movements-list.tsx:200` (`max-w-3xl`); clients/categories (`max-w-3xl`); accounts sin límite; shell `max-w-screen-2xl` (`src/app/(main)/layout.tsx:27-38`) |
| H-16 | P3 | Toasts a11y | Doble anuncio: `aria-live="polite"` en el provider + `role="alert"` por ítem | `src/components/ui/toast-provider.tsx:57-61`; `src/components/ui/toast.tsx:63-64` |
| H-17 | **NO VERIFICABLE** | Dashboard 10s | TTI no medible sin ejecutar; análisis de código: cold start puede superar 10s; caliente plausible <2s | `src/app/(main)/dashboard/page.tsx:24` (force-dynamic), `:39` (connectDb), `:50-53,:61-71` (dos `Promise.all` con 8 repos); `src/proxy.ts` (connectDb por request) |
| H-18 | P3 | Dashboard a11y toggles | Botones Mensual/Anual sin `aria-pressed` ni `role="tab"` | `src/app/(main)/dashboard/dashboard-content.tsx:353-373` |
| H-19 | P3 | Landing consistencia | Paleta indigo cruda Tailwind en hero vs tokens de marca (brand-teal/gold) en el resto del landing | `src/components/landing/hero.tsx:12`; `src/app/globals.css:16-37`; `features.tsx:31`, `benefits.tsx:19-25` |

### 3.2. Detalle por hallazgo

#### H-01 — Utilidades Tailwind inexistentes (no-op silencioso) · P2

- **Problema:** `@theme inline` (globals.css:40-69) NO define `--color-muted-foreground` ni `--color-card` (patrón shadcn). Las clases que las usan no generan CSS: Tailwind las ignora silenciosamente.
- **Efecto verificado por lectura:** Analítica pierde el color muted (texto secundario ilegible como tal); las MetricCards no renderizan fondo; el preview "Total a pagar" de los formularios de crédito pierde énfasis visual.
- **Usuario afectado:** fundador (Analítica) y usuarios de créditos (comprensión del total a pagar antes de guardar).
- **Recomendación:** sustituir por tokens REALES existentes (`text-surface-muted`, `bg-surface-card`) o agregar los tokens faltantes explícitamente; eliminar el patrón shadcn residual.
- **Dependencia/impacto:** alimenta el Design System (UX-4, DEC-DS-01); sin ella, el rediseño propaga el mismo no-op.

#### H-02 — Cuerpo en Arial; identidad tipográfica muerta · P2

- **Problema:** `body { font-family: Arial, Helvetica, sans-serif }` (globals.css:98-102) pisa las variables `--font-sans` (Geist) y `--font-display` (Sora) definidas en `:66-68`. Sora solo aparece en los headers de tabla (`table.tsx:54`).
- **Efecto:** la identidad Geist/Sora existe en configuración pero no en el render; el producto se ve genérico.
- **Recomendación:** `body { font-family: var(--font-geist-sans) }` + decisión sistemática de uso de `--font-display` (números principales del Resumen, títulos de nivel 1 — ver UX-4 DEC-DS-02).

#### H-03 — `aria-label` del toggle de tema en inglés · P2

- **Problema:** `aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}` hardcodeado (nav.tsx:222 y :270) — visible solo para lectores de pantalla, pero en inglés para ambos idiomas.
- **Recomendación:** mover a `messages/{es,en}.json` (paridad i18n, español neutro).

#### H-04 — 404 default de Next.js, en inglés, sin shell · P2

- **Problema:** no existe `src/app/not-found.tsx` (glob confirmado). `notFound()` lanzado en `(analytics)/layout.tsx:33` y `:page.tsx:23` produce el 404 default de Next.js EN, sin shell de la app ni localización.
- **Recomendación:** crear `src/app/not-found.tsx` localizado (es/en) con enlace al dashboard/inicio y el shell visual de TwinCap.

#### H-05 — Modal sin focus trap · P2

- **Problema:** `modal.tsx` maneja Escape y bloquea el scroll del body (`:28-44`), y declara `role="dialog"` + `aria-modal="true"` (`:59-61`), pero NO gestiona el foco: Tab puede salir del diálogo y el foco de retorno al cerrar no está garantizado. El drawer móvil sí enfoca el primer link al abrir (`nav.tsx:72-79`) — buen patrón a replicar.
- **Recomendación:** foco inicial al abrir, trampa de foco (loop), restaurar foco al cerrar.

#### H-06 — "Marcar como pagado" sin confirmación · P2

- **Problema:** `mark-as-paid-button.tsx:20-39` (y su gemelo en granted) ejecuta un abono por el saldo pendiente SIN confirmación. Contraste: `write-off-button.tsx:51-64` usa `ConfirmDialog` danger.
- **Impacto:** operación financiera irreversible de un clic; incoherencia de patrones entre acciones destructivas del mismo módulo.
- **Recomendación:** agregar `ConfirmDialog` (monto pendiente + cuenta destino) o confirmación inline antes de ejecutar.

#### H-07 — Naming en conflicto: "Informes" vs "Reportes" · P2

- **Problema:** el mismo módulo tiene dos nombres: `Nav.dashboard: "Informes"` (es.json:30, en.json:29 "Reports") vs `Dashboard.reports: "Reportes"` (es.json:147) vs `feature5Title: "Reportes y gráficos"` (es.json:667).
- **Recomendación:** unificar. Decisión tomada en UX-3 (DEC-IA-01): el módulo visible pasa a llamarse **"Resumen"** (es) / **"Summary"** (en); "Reportes" queda reservado para las secciones de reportes del Resumen. "Dashboard" permanece como término técnico interno (§8).

#### H-08 — Microcopy: 29 toasts "…exitosamente" · P3

- **Problema:** patrón robótico `"{Algo} {procesado/actualizado} exitosamente"` (es.json:575-606, 29 claves).
- **Recomendación (ejemplos):** "Movimiento guardado", "Cuenta eliminada" (verbo + objeto, §22). Detalle en UX-4 (DEC-DS-08) y ejecución en UX-8.

#### H-09 — Tablas móvil: scroll horizontal como única solución · P3

- **Problema:** `TableShell` con `overflow-x-auto` (table.tsx:13-21); `movements-list.tsx:332` aplica `min-w-[700px]` como mitigación. Rompe la regla "no usar `overflow-x: auto` como única solución" (PROJECT-RULES §15).
- **Recomendación:** evaluar card-stacking de filas < 640px (patrón MovementCard) manteniendo `min-w` sistemático como respaldo de densidad; decisión de IA/DS en UX-3/UX-4 (DEC-IA-08, DEC-DS-11).

#### H-10 — Empty states duplicados inline · P3

- **Problema:** `clients/page.tsx:41-46` y `categories/page.tsx` duplican el empty state inline, mientras existe `EmptyState` (`empty-state.tsx:11-23`) ya usado en `movements-list.tsx:311,319`.
- **Recomendación:** usar `<EmptyState>` en todas partes (patrón base; H-08/H-10 convergen en UX-4).

#### H-11 — Drawer móvil: sin focus trap completo y targets pequeños · P3

- **Evidencia:** drawer `nav.tsx:107-133`; foco inicial al primer link `:72-79`; Escape `:81-88`; controles `h-9` (36px) `:218-243`.
- **Problema:** la salida del drawer no hace loop de foco (después del último elemento Tab sale al documento); targets 36px < 44px recomendado (WCAG 2.5.5 / práctica iOS/Android).
- **Recomendación:** loop de foco + altura/área táctil 40-44px.

#### H-12 — Dialog sin nombre cuando falta título · P3

- **Problema:** `modal.tsx:61` `aria-label={title}` — si el caller no pasa `title`, el diálogo queda sin nombre accesible.
- **Recomendación:** fallback `closeLabel || tCommon('close')` o exigir `title` como obligatorio.

#### H-13 — POS: asterisco manual y sin `aria-required` · P3

- **Problema:** `sale-form.tsx:206` construye `Cliente *` con asterisco manual; el `Select` no recibe `required`, por lo que no emite `aria-required` para lectores de pantalla.
- **Recomendación:** pasar `required` real al Select y eliminar el `*` manual (el navegador/componente lo deriva).

#### H-14 — BackButton redundante con sidebar · P3

- **Evidencia:** `movements-list.tsx:201`; presente en accounts/categories/clients/transfers.
- **Problema:** los módulos raíz ya son alcanzables desde el sidebar; el back genera redundancia y destino no obvio.
- **Recomendación:** evaluar quitarlo de módulos raíz del sidebar o mantenerlo solo cuando exista entrada previa real (deep link/detalle). Decisión de IA: DEC-IA-05.

#### H-15 — Anchos divergentes · P3

- **Evidencia:** `movements-list.tsx:200` `max-w-3xl`; clients/categories `max-w-3xl`; accounts sin límite; shell `max-w-screen-2xl` (`(main)/layout.tsx:27-38`).
- **Recomendación:** ancho canónico para listas/tablas y para formularios (decisión IA DEC-IA-06; valores en DS DEC-DS-04).

#### H-16 — Toasts: doble anuncio a lectores de pantalla · P3

- **Evidencia:** `toast-provider.tsx:57-61` `aria-live="polite"` (región viva) + `toast.tsx:63-64` `role="alert"` por ítem.
- **Problema:** el mismo mensaje se anuncia dos veces.
- **Recomendación:** una sola vía de anuncio (región viva por ítem O `role="alert"` — decidir en DS DEC-DS-10).

#### H-17 — Dashboard 10s: NO VERIFICABLE · requiere ejecución

- **Evidencia de código:** `dashboard/page.tsx:24` `force-dynamic`; `:39` `connectDb()`; `:50-53` y `:61-71` dos `Promise.all` con 8 repos; `proxy.ts` `connectDb()` en cada request (cold start).
- **Análisis:** cold start puede superar los 10s (conexión + 8 repos + snapshot server-side); en caliente es plausible <2s. **No medible sin ejecutar** — no se declara verificado.
- **Recomendación:** medir TTI con build de producción (UX-5/UX-11); considerar caché RSC y evitar `connectDb()` en proxy salvo cold-start.

#### H-18 — Toggles Mensual/Anual sin `aria-pressed` · P3

- **Evidencia:** `dashboard-content.tsx:353-373`.
- **Recomendación:** `aria-pressed` (o patrón tabs con `role="tablist"`/`tab`).

#### H-19 — Landing: gradiente indigo crudo fuera de marca · P3

- **Evidencia:** `hero.tsx:12` `bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900` vs tokens de marca `brand-teal`/`brand-gold` (globals.css:16-37) usados en el resto del landing (`features.tsx:31`, `benefits.tsx:19-25`).
- **Recomendación:** re-mapear el gradiente a tokens de marca (DS DEC-DS-03).

---

## 4. B. RESPUESTAS AL ENCARGO (11 PUNTOS DEL PROMPT MAESTRO)

### 1. Inventario de rutas

- **App raíz:** `app/` (layout, page landing, loading, error, global-error, `src/proxy.ts`)
- **Auth:** `(auth)/` login, register, forgot-password, reset-password, verify-email
- **Legal:** `(legal)/` privacy, terms, cookies, data-policy
- **Analítica:** `(analytics)/` layout, analytics (condicional fundador)
- **Principal:** `(main)/` dashboard, accounts, categories, movements, transfers, credits/{received,granted}, payables, clients, pos/{catalog,sales}, profile, feedback
- **Otros:** help, `api/monitor`

### 2. Inventario de componentes `ui/` (21)

`action-icon-button`, `back-button`, `badge`, `button`, `card`, `confirm-dialog`, `empty-state`, `entity-delete-button`, `icon`, `idempotency-field`, `input`, `logo`, `modal`, `password-input`, `searchable-select`, `select`, `skeleton`, `table`, `toast`, `toast-provider`, `index`.

### 3. Navegación

- **Desktop:** sidebar fija; **móvil:** drawer sobre overlay (Escape, foco inicial al primer link).
- `NAV_ITEMS` con separadores de grupo y color por ítem (`nav.tsx:17-32`).
- **Analítica:** ítem condicional de fundador (`nav.tsx:37-51`).
- **Pie de sidebar (autenticado):** email, link a perfil, Comentarios, toggle tema (36px), idioma, Salir con `ConfirmDialog` danger.
- **Guest:** idioma + Login/Register.
- Grupos actuales: `[dashboard]` · `[accounts, categories, movements, transfers]` · `[credits×2, payables]` · `[clients, pos×2]` · `[analytics]`.

### 4. Patrones visuales

- **Hay sistema:** tokens `--tc-*` (globals.css:16-37) → `@theme inline` (:40-69), dark por clase (:71-96).
- **Hay improvisación verificada:** tipografía Arial (H-02), hero indigo (H-19), zinc crudo en toggles/nav, tokens shadcn inexistentes (H-01), Sora solo en `th` (H-02), empty states duplicados (H-10).
- **Consistente:** cards, tablas surface, forms con labels+errores, toasts, modales.

### 5. Estados por página

- Con loading+empty+error: dashboard, movements, accounts, transfers, categories, clients, credits×2, payables, pos×2.
- Sin loading propio: profile, analytics; auth cubierto por el root loading.
- 404: default Next.js EN (H-04). `global-error` bilingüe estático (verificado).

### 6. Responsive

- Móvil: 1 columna, drawer, modales con scroll interno, tablas con `overflow-x` (H-09).
- Tablet/desktop: sidebar + grids 2/4 cols + `max-w-screen-2xl`.
- Targets 36px (H-11). **Verificación visual: NO VERIFICABLE sin ejecución.**

### 7. Formularios

- **Patrón único maduro:** `useActionState` + `IdempotencyField` + `tzOffset` + toast + `useActionError`; fieldset/legend; validaciones inline; modales anidados fuera del form.
- Deuda: asterisco manual sin `aria-required` (H-13).

### 8. Dashboard 10s

- **Jerarquía verificada (lectura):** saludo → banner onboarding (si 1 cuenta) → filtros → SummaryCards → grilla de cuentas → 6 reportes → 2 SummaryTables → Top-3 → gráfico mensual/anual → movimientos recientes → Posición Financiera. **Nunca suma cross-currency** (verificado).
- **Ruta crítica:** `force-dynamic` + `connectDb()` + 2 `Promise.all` con 8 repos + snapshot server-side + skeleton rico. **TTI: NO VERIFICABLE sin ejecutar (H-17).**

### 9. Microcopy

- 29 toasts "…exitosamente" (H-08); "Informes" vs "Reportes" (H-07); aria-labels en inglés (H-03).
- **NINGÚN voseo/regionalismo** (grep sin coincidencias — cumple la regla de español neutro).
- Notas de sistema derivadas en render vía `link.kind` + i18n — patrón correcto (cumple §15 PROJECT-RULES).

### 10. Accesibilidad

- **Fortalezas:** `aria-current` en nav, `aria-expanded` en FAQ, `aria-busy` en dashboard, `scope="col"` en tablas, labels con `htmlFor`, región live de toasts, `role="dialog"`/`aria-modal`, drawer con Escape + foco inicial, focus ring.
- **Deudas:** sin focus trap (H-05/H-11), `aria-label` EN (H-03), doble anuncio de toast (H-16), asterisco manual (H-13), toggles sin `aria-pressed` (H-18), diálogo sin nombre (H-12), targets 36px (H-11).

### 11. Onboarding

- Banner "Crea tus cuentas" solo con cuenta fija sembrada; empty states por módulo; `welcomeUser`; banner de verificación de email.
- **NO existe tour guiado.** Oportunidad: checklist de primeros pasos (patrón incremental, benchmark UX-2 lección 4).

---

## 5. C. Buenas prácticas confirmadas

1. **ConfirmDialog danger en acciones destructivas** (logout, write-off, entity-delete) — con la excepción H-06.
2. **Idempotencia en TODAS las acciones de creación financiera** (`IdempotencyField` + gate post-commit) — visible también en la UX: retry nunca duplica.
3. **Auth sin enumeración + rate limit + lockout por email** — la UX de login es consistente con la seguridad del dominio.
4. **Re-sync por contenido sin perder paginación** en Movimientos (re-sync por contenido tras revalidación).
5. **Modales anidados fuera del form + `tzOffset` explícito** en formularios financieros y POS.

---

## 6. D. Priorización sugerida

1. **H-01 / H-02 / H-03** — bajo riesgo, alto impacto (tokens, tipografía, aria i18n). Insumo directo del Design System (UX-4) e implementación temprana.
2. **H-04 / H-07** — rápidos; tocan es/en (404 localizado, naming unificado).
3. **H-05 / H-16 / H-18 / H-13** — a11y de componentes base (modal, toast, toggles, select).
4. **H-06** — decisión de producto (confirmación financiera; propuesta: ConfirmDialog con monto pendiente + cuenta destino).
5. **H-08 / H-10 / H-14 / H-15 / H-19** — consistencia (microcopy, empty states, navegación, anchos, marca).
6. **H-17** — medir TTI del Resumen (Requiere ejecución; sin medición no hay diseño informado del Resumen 10s).

La priorización final P0–P3 con mapeo a fases está en `docs/UX-ROADMAP.md` (§52, tabla de prioridades).

---

## 7. Coherencia con el resto de la etapa

| Documento | Qué consume de esta auditoría |
|---|---|
| `UX-INFORMATION-ARCHITECTURE.md` | H-07 (naming), H-14 (back), H-15 (anchos), inventario rutas/nav |
| `UX-DESIGN-SYSTEM.md` | H-01 (tokens), H-02 (tipografía), H-19 (marca), H-16/H-05/H-11/H-12/H-13/H-18 (a11y) |
| `UX-ROADMAP.md` | Priorización P0–P3 completa; mapeo hallazgo → fase |