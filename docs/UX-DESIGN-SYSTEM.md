# TWINCAP — DESIGN SYSTEM — FASE UX-4

> **Fecha:** 2026-09-13
> **Estado:** ENTREGADO — documento de DISEÑO PROPUESTO (pendiente aprobación, protocolo R3.13)
> **Fuente normativa:** `docs/freeze + UX-UI.md` (prompt maestro §20/§21/§31/§39)
> **Documentos relacionados:** `docs/UX-UI-AUDIT.md` (UX-1 — evidencia H-01/H-02/H-05/H-11/H-12/H-13/H-16/H-18/H-19), `docs/UX-INFORMATION-ARCHITECTURE.md` (UX-3 — DEC-IA), `docs/UX-COMPETITIVE-RESEARCH.md` (UX-2 — lecciones 4-7, 10), `docs/UX-ROADMAP.md` (plan maestro)
> **Convención de veracidad:** VERIFICADO = lectura de código; DISEÑO PROPUESTO = decisión de esta fase. El orden del §39 se respeta: **fundamentos → componentes → patrones → páginas** — nunca página por página sin sistema.

---

## 1. Principios del sistema

El Design System no es un catálogo de estilos: es la materialización visual de la condición de éxito del §56.

1. **CLARIDAD > CANTIDAD** — menos elementos, más significado. Cada card responde una pregunta (§10).
2. **CONFIANZA > EFECTOS** — la UX hace visible la robustez del dominio sin inventar garantías (§14).
3. **UTILIDAD > DECORACIÓN** — sin sombras, gradientes o iconos decorativos.
4. **COMPRENSIÓN > DENSIDAD** — la jerarquía de 5 niveles (§9) se respeta en la composición.
5. **CONSISTENCIA > IMPROVISACIÓN** — un token, una fuente, un patrón; nada de estilos por pantalla.
6. **EXPERIENCIA > FEATURE COUNT** — el sistema existe para la tarea del usuario, no para el catálogo de componentes.

---

## 2. Fundamentos — Color

### 2.1. Estado actual (VERIFICADO, `src/app/globals.css`)

- Tokens semánticos `--tc-*` en `:root` (`globals.css:16-37`): `primary`, `success`, `danger`, `warning`, `info`, `debt`, `income`, `expense` + marca `brand-teal`/`brand-gold` + superficie `surface-*` (bg/card/border/muted/input/header/overlay).
- Exposición a Tailwind vía `@theme inline` (`:40-69`): utilidades `bg-primary`, `text-danger`, `border-surface-border`, `bg-surface-card`, etc.
- Bloque `.dark` (`:71-96`) redefine los mismos `--tc-*` — el dark mode es **swap de tokens**, no estilos por componente (garantía a preservar).
- **Ausencias verificadas (H-01):** NO existen `--color-muted-foreground` ni `--color-card` (patrón shadcn). Las clases que las usan son **no-op silencioso** (Analítica, MetricCards, preview "Total a pagar" de créditos).

### 2.2. Decisión (DISEÑO PROPUESTO)

1. **Un solo vocabulario de color:** los tokens `--tc-*` existentes SON el sistema. No se introduce una segunda paleta.
2. **Corrección H-01 (DEC-DS-01):** reemplazar toda clase shadcn inexistente por tokens reales (`text-surface-muted`, `bg-surface-card`, `text-foreground`, `bg-background`). No se agregan `--color-muted-foreground`/`--color-card` solo para complacer a un patrón externo: el mapeo canónico es `muted → surface-muted`, `card → surface-card`.
3. **Roles de uso:** `primary` = acción principal y navegación activa; `success`/`income` y `danger`/`expense` = semántica financiera (ingreso/gasto, positivo/negativo); `warning` = atención (saldo negativo, compromisos); `info`/`debt` = contextos (cuentas, deuda); `brand-teal`/`brand-gold` = identidad (logo, gradientes del landing, acentos puntuales). **Prohibido** color arbitrario por pantalla (hoy: zinc crudo en nav/toggles — H-19 hereda este problema en el hero indigo).
4. **Contraste:** todo par texto/fondo cumple WCAG AA (4,5:1 texto normal, 3:1 texto grande). El texto secundario usa `surface-muted` (hoy `zinc-500` improvisado — migrar).
5. **Saldo negativo = rojo `danger` + soporte no cromático** (signo, etiqueta "negativo") — nunca color como único canal (§16).

## 3. Fundamentos — Tipografía

### 3.1. Estado actual (VERIFICADO)

- Definidas: `--font-sans: var(--font-geist-sans)`, `--font-mono`, `--font-display: var(--font-sora)` (`globals.css:66-68`).
- **Muertas en la práctica (H-02):** `body { font-family: Arial, Helvetica, sans-serif }` (`:98-102`) pisa Geist; Sora solo en `th` de tablas (`table.tsx:54`).

### 3.2. Decisión (DISEÑO PROPUESTO — DEC-DS-02)

| Rol | Familia | Uso |
|---|---|---|
| Texto base | **Geist Sans** (`var(--font-sans)`) | `body`, componentes, tablas, formularios, etiquetas |
| Display | **Sora** (`var(--font-display)`) | **Solo cifras de Nivel 1 del Resumen**, títulos de nivel 1, hero del landing, estadísticas principales. NO en headers de tabla |
| Mono | Geist Mono (`var(--font-mono)`) | Código, claves técnicas, fechas-sello internas si aplica |

Reglas:
- `body { font-family: var(--font-sans) }` — corrección directa del H-02.
- Escala tipográfica fija (puntos de partida, ajustables en implementación): display 2xl 30/1.2 · h1 24 · h2 20 · h3 18 · body 14/16 (móvil/desktop) · small 12 · caption 11. Máx. 4 tamaños visibles por pantalla.
- Los números financieros grandes usan tabular-nums para alinear columnas y evitar saltos.

## 4. Fundamentos — Escalas, radios, sombras, borders

| Token | Valores (DISEÑO PROPUESTO — DEC-DS-04) | Regla |
|---|---|---|
| Spacing | base 4px: 4·8·12·16·24·32·48·64 | Multiplos de 4; nunca valores ad-hoc |
| Radios | `sm` 6 · `md` 10 · `lg` 14 · `full` | Cards/inputs = md; botones = md; chips/badges = full |
| Sombras | **2 niveles máx:** `shadow-surface` (cards sobre bg) y `shadow-elevated` (modal/drawer/dropdown) | Prohibido llenar de sombras (§20) |
| Borders | 1px `border-surface-border` (descansa en el token, cambia solo en dark) | El borde comunica estructura, no decoración |
| Densidad | filas 40px listas/tablas; 44px controles táctiles | Contraste con regla de targets (ver §8) |

## 5. Fundamentos — Dark mode (garantía a preservar)

- **Modelo: swap de tokens en `.dark`** (`globals.css:71-96`), jamás estilos duplicados por componente (VERIFICADO que hoy se cumple mayormente — las excepciones `dark:bg-zinc-*` improvisadas en nav/toast deben migrar a surface tokens).
- Todo componente nuevo se escribe UNA vez y hereda los tokens; `@custom-variant dark` ya existe (`globals.css:2`).
- El usuario elige (toggle footer, DEC-IA-11); `color-scheme` por tema ya verificado (`:8, :73`).

## 6. Componentes — Inventario alineado al §31

| Componente §31 | Estado | Mapa a código actual | Nota de diseño |
|---|---|---|---|
| **MetricCard** | NUEVO | Inline en analytics y dashboard (SummaryCards) | Cardinalidad: título + valor + período + contexto + estado vacío + focus/aria. Base del N1 del Resumen |
| **SummaryCard** | NUEVO | Inline en `dashboard-content` | Variante con desglose (ingresos/gastos como sub-cifras) |
| **MovementCard** | ✅ **IMPLEMENTADO (UX-7)** | `src/components/ui/movement-card.tsx` (field config API); card-list <640px en las 5 listas puras | Formato móvil <640px: QUÉ/CUÁNDO/DÓNDE/CUÁNTO/MONEDA/EFECTO (§12), saldo posterior, acción editar |
| **DataTable** | EXISTE | `ui/table.tsx` (TableShell + Th + row) | Fix `th` tipografía (H-02); `scope="col"` conservado; footer por moneda (totales honestos, sin FX) |
| **EmptyState** | EXISTE | `ui/empty-state.tsx` (usado en movements) | **Usar en todas partes** (H-10); variantes: sin datos / sin resultados de filtro / first-use |
| **ErrorState** | NUEVO | `error.tsx` raíz por ruta existe; falta componente reutilizable | Retry + mensaje honesto + "tus datos no fueron modificados" donde aplique (§14) |
| **LoadingState** | EXISTE (parcial) | `ui/skeleton.tsx` | Composición estándar: skeleton del layout de cada página (ya hay skeleton rico en dashboard — volverlo patrón) |
| **ConfirmDialog** | EXISTE | `ui/confirm-dialog.tsx` | **Reutilizar en todas las acciones que tocan dinero** (H-06: mark-as-paid) |
| **Alert** | NUEVO | No existe banner inline (errores hoy: toast/form) | Variantes warning/error/info; siempre con texto + cierre; no cromático solamente |
| **FormField** | NUEVO | Patrón label+error+fieldset/legend ya existe en forms | Extraer; maneja `htmlFor`, mensaje de error junto al campo, `aria-invalid`, estado disabled |
| **CurrencyInput** | NUEVO | MoneyInput existe en módulos POS/créditos | Wrapper estándar: sin floats, minor units, separadores por locale, moneda fija por contexto |
| **MoneyDisplay** | NUEVO | Formato disperso en listas/cards | Centraliza: formato + moneda explícita + negativo en rojo con signo + tabular-nums |
| **AccountSelector** | NUEVO | `ui/select` + `searchable-select` existentes | Wrapper tipado: moneda visible junto a la cuenta (evita fallback de moneda, §4 PROJECT-RULES) |
| **ClientSelector** | NUEVO | Ídem + autocompletado POS | Crea cliente inline sin salir del flujo (patrón existente) |
| **ProductSelector** | NUEVO | Ídem | Stock/precio visibles; búsqueda con debounce |
| **DateSelector** | NUEVO | `input date` + `ui/input` | Fecha de negocio explícita con timezone resuelta (nunca offsets ±1 día §16); formato por locale |
| **FilterBar** | NUEVO | Filtros inline (movements, dashboard) | Selector período/tipo/cuenta/categoría + limpiar; el filtro "viaja" al profundizar (DEC-IA) |
| **IdempotencyField** | EXISTE | `ui/idempotency-field` | Ya correcto — se conserva tal cual, es condición del dominio |
| **Badge/Button/Input/Card/Logo/Skeleton/Toast/ToastProvider/Modal** | EXISTEN | `ui/*` | Se conservan; ajuste de tokens (H-01) y a11y (ver §8) |

**Reglas de componente (heredadas del §31):**
- **No abstraer prematuramente:** un componente se extrae SOLO cuando hay 2+ usos reales con el mismo patrón (hoy: FilterBar tiene 2 usos, FormField ~6, MoneyDisplay ~15 — están justificados; MetricCard necesita el Resumen para definirse, se extrae en UX-5).
- **No crear genéricos inútiles:** cada componente justifica su API en la tarea del usuario; si un componente solo admite un uso, es código de módulo, no del sistema.
- Antes de crear: verificar `src/components/ui/` (regla ya activa).

## 7. Iconografía (§21)

- **Fuente:** Lucide React vía `ui/icon.tsx` (wrapper existente, VERIFICADO).
- **Significado primero:** cada icono acompaña un label; el icono refuerza, nunca sustituye a la comunicación de una acción crítica (una papera de eliminar sin texto exige label accesible `aria-label` i18n).
- **Roles:** acción (Plus, Pencil, Trash2…), navegación (módulos), estado (alert/check), marca (logo).
- **Tamaños del sistema:** `sm` 16 · `md` 20 · `lg` 24 (vía `icon.tsx`; hoy `h-4/5/6` dispersos → migrar).
- **Prohibido:** iconos solo por estética; iconos distintos para el mismo significado; iconos sin `aria-label` cuando no hay texto visible.

## 8. Microcopy (§22)

### 8.1. Reglas

1. **Claro, humano, corto, directo**, comprensible para una persona sin conocimientos contables.
2. **Verbo + objeto** en feedback de éxito (H-08): "Movimiento guardado", "Cuenta eliminada", "Cliente actualizado" — nunca "Entidad procesada satisfactoriamente" (§22).
3. **Español neutro obligatorio** (prohibido voseo/regionalismos) y paridad es/en en `messages/` (§15 PROJECT-RULES).
4. **Nada de jerga contable en el momento de la acción** (benchmark lección 3): "Crédito otorgado: abono" se presenta como "De lo que te pagó, X cubre lo que prestaste y Y es tu ganancia" cuando el usuario registra un abono.
5. **Los textos de dominio derivados del sistema** (notas de movimientos, categorías sintéticas) se resuelven en render vía `link.kind` + i18n — nunca se persisten acoplados a un idioma (regla vigente, VERIFICADA en su implementación).
6. Los `aria-label` también son microcopy: **todo texto accesible va a `messages/`** (H-03: toggle de tema hoy hardcodeado en inglés).

### 8.2. Ejemplos de migración (H-08)

| Actual (patrón) | Propuesto |
|---|---|
| "Movimiento creado exitosamente" | "Movimiento guardado" |
| "Cuenta eliminada exitosamente" | "Cuenta eliminada" |
| "Venta registrada exitosamente" | "Venta registrada" |
| "Error al procesar" (genérico) | "No pudimos completar la operación. Tus datos no fueron modificados." (§14 — cuando aplica) |

## 9. Estados explícitos (§15)

Cada estado responde 3 preguntas: **¿Qué ocurrió? ¿Los datos están seguros? ¿Qué puede hacer el usuario?** Ningún estado queda implícito.

| Estado | Componente patrón (DS) | ¿Qué ocurrió? | ¿Datos seguros? | ¿Qué puede hacer? |
|---|---|---|---|---|
| loading | LoadingState (skeleton) | "Cargando…" | Ningún dato en pantalla aún | Esperar; nada destructivo disponible |
| empty | EmptyState | "Aún no tienes X" | Sí | CTA de primera acción (New X) |
| success | Toast/confirmación inline | "X guardado/eliminado" | Sí | Continuar con la tarea |
| warning | Alert warning | "Esto requiere atención" (saldo negativo, compromiso vencido) | Sí | Revisar la señal |
| error | ErrorState / Alert error | "No pudimos completar la operación" | **Sí: no quedó nada parcial** (atomicidad visible) | Reintentar / contactar soporte |
| partial | Alert partial | "Algunas secciones no cargaron" | Sí (lo cargado es válido) | Recargar la sección |
| offline | Alert offline | "Sin conexión" | El producto actual es online: no prometer sincronización que no existe | Reconectar; los datos mostrados son los últimos cargados |
| permission | ErrorState permission | "No tienes acceso a esto" | Sí | Volver al destino autorizado (sin enumerar existencia) |
| conflict | Alert conflict + recarga | "El registro cambió en otro dispositivo" (CAS) | Sí | Recargar y relanzar la acción con la versión nueva |
| stale | Alert stale | "Los datos se actualizaron; esta vista quedó atrás" | Sí | Refrescar (re-sync por contenido, patrón ya existente) |
| no results | EmptyState (filtros) | "Sin resultados con estos filtros" | Sí | Limpiar filtros (ya hay copy: `Common.noResults`) |
| first-use | EmptyState first-use + onboarding | "Todavía no hay nada" | Sí | Realizar el primer paso (crear cuenta, registrar venta) |

## 10. Accesibilidad (§18) — decisiones que cierran hallazgos

| Hallazgo | Decisión de sistema |
|---|---|
| H-05 — Modal sin focus trap | **Patrón base:** todo `Modal`/`Drawer` gestiona foco: foco inicial al abrir (primer control), trampa de foco (loop Tab/Shift+Tab), restauración al cerrar. Se implementa UNA vez en `ui/modal.tsx` y se hereda |
| H-11 — Drawer sin trap + targets 36px | Mismo patrón de focus para el drawer; **targets táctiles ≥ 44×44px** en controles (nav footer hoy `h-9`) — WCAG 2.5.8 practical |
| H-12 — Diálogo sin nombre | `Modal`: si no hay `title`, el `aria-label` cae a `closeLabel` o `Common.close`; mejor: `title` obligatorio en la API |
| H-13 — Asterisco manual | Los campos `required` reales emiten `aria-required`; se elimina el `*` manual del label |
| H-16 — Doble anuncio de toast | **Un solo canal de anuncio:** la región vive (`aria-live="polite"`) anuncia por ítem; se elimina `role="alert"` redundante (o se elige alert solo para errores críticos — decisión única, no mezcla) |
| H-18 — Toggles sin estado | Patrón toggle/segmented con `aria-pressed` (o `role="tablist"`/`tab` + `aria-selected` si es navegación) |
| H-03 — aria en inglés | Regla 8.1.6: todo texto accesible pasa por i18n |
| — | Contraste AA (ver §2.1.5); foco visible consistente (`focus-visible` ring con token `primary`); navegación completa por teclado; mensajes de error asociados al campo (`aria-describedby`); **nunca color como único canal** |

## 11. Responsive (§19) — mobile-first, no mobile-only

- Breackpoints fijos: **375 / 768 / 1280** (regla vigente). Cada breakpoint es una decisión deliberada, no "desktop encogido".
- **La forma sigue a la tarea (§11):** DataTable en desktop ↔ MovementCard en <640px (Movimientos); formularios 1 columna en móvil con acción principal sticky; Resumen 1 columna (N1→N5 en orden) ↔ grid desktop (mismo orden visual — DEC-IA-08).
- Sin `overflow-x: auto` como única solución (H-09); las tablas densas obligatorias usan `min-w` + card-list como alternativa móvil.
- Módulos del sistema: **nada de "mobile-only"**: toda pantalla existe en ambos mundos con el mismo modelo mental (§27).
- **Ancho canónico del shell (H-15/DEC-IA-06 — IMPLEMENTADO en UX-7, commits `a5fa8d8`/`9300fcd`/`6c601ed`):** clase `lg:max-w-[min(1536px,calc(100vw_-_3rem))]` en `src/app/(main)/layout.tsx` y `src/app/(analytics)/layout.tsx` (reemplaza `max-w-screen-2xl`). Efecto: margen **24px por lado en viewports 1024–1536px** (ej. shell 1318px @1366px) y **cap 1536px desde ≥1568px**; <1024px sin cambio (`lg:` inactiva). **Nota técnica Tailwind v4:** los espacios dentro del arbitrary value se escriben como **underscores** (`100vw_-_3rem`) — la variante literal con raw spaces (`calc(100vw - 3rem)`) tokeniza en whitespace y genera CSS inalcanzable (hallazgo CRÍTICO verificado con Tailwind v4.3.3, resuelto en el amendment RSL-1 y el commit `6c601ed`). `ContentContainer max-w-7xl` del dashboard NO se modifica (RSL-5); `max-w-3xl` de analytics es ancho de contenido intencional justificado (RSL-6).

## 12. Confianza visible (§14) — la UX hace visible la robustez del dominio

Patrones de sistema que comunican las garantías que YA existen (sin inventar ninguna):

| Garantía del dominio | Patrón UX |
|---|---|
| Saldo negativo = realidad registrada (§16, F5) | `MoneyDisplay` en `danger` + signo + microcopy "Saldo negativo" — nunca bloquear, nunca maquillar; confirmación informada al incurrir |
| Transferencia multimoneda (§17) | Vista origen/destino completa: cuenta, moneda, monto de cada lado + tasa implícita derivada (nunca ocultar la conversión) |
| Idempotencia (retry no duplica) | Envío deshabilitado mientras se procesa; ante `duplicateRequest`: "La operación ya quedó registrada. No se creó un duplicado." |
| Atomicidad (nada parcial) | Mensaje de fallo (§14): "No pudimos completar la operación. Tus datos no fueron modificados." |
| Integridad referencial (vínculos vivos) | El detalle de un movimiento muestra su vínculo/origen (venta, crédito, transferencia) con acceso al padre |
| Fecha = fecha civil | Selectores y etiquetas explícitos: "del 1 al 30 de [mes]" — sin offsets misteriosos |

## 13. Páginas (§39 — derivadas del sistema, no página por página)

Cada página se compone de patrones ya definidos:

- **Resumen:** LoadingState → Hero (MetricCard×2) → desglose (SummaryCard) → evolución (chart con tokens) → compromisos (MetricCard + Alert) → movimientos (MovementCard/DataTable) → Posición Financiera. (Detalle en UX-5.)
- **Listas (Movimientos/Cuentas/Clientes/Créditos/Payables/Productos):** FilterBar + DataTable (desktop) / list (móvil) + EmptyState + ErrorState + acción principal.
- **Formularios:** FormField + CurrencyInput + selectores tipados + IdempotencyField + ConfirmDialog para acciones que tocan dinero + toast de resultado.
- **Auth/Legal/Landing:** tokens de marca (§2); hero con gradiente de marca (H-19).

## 14. Tabla de decisiones DS (DEC-DS)

| ID | Decisión | Justificación | Evidencia | Impacto |
|---|---|---|---|---|
| DEC-DS-01 | Un solo vocabulario de color (tokens `--tc-*`); corregir no-ops shadcn mapeando `muted→surface-muted`, `card→surface-card` | Los tokens existen y son consistentes; el patrón shadcn solo produce no-op silencioso | H-01; globals.css:16-69 | Analítica, credit-forms, MetricCards |
| DEC-DS-02 | Tipografía: `body` = Geist Sans; Sora (display) SOLO en cifras N1, títulos de nivel 1 y hero; `th` en sans-semibold | La identidad tipográfica existe pero está muerta en el render; el display sobreexigido pierde jerarquía | H-02; globals.css:66-68,98-102; table.tsx:54 | Global |
| DEC-DS-03 | Marca: gradientes y acentos desde `brand-teal`/`brand-gold`; eliminar indigo/zinc crudos | La paleta de marca existe y el resto del landing la respeta; el hero quedó fuera | H-19; globals.css:26-28; hero.tsx:12 | Landing, nav, toggles |
| DEC-DS-04 | Escalas fijas: spacing 4px, radios sm/md/lg, 2 sombras, borders `surface-border`, densidad 40/44px | La consistencia se garantiza por token, no por convención | §20; H-15 (anchos por tarea) | Todos los componentes |
| DEC-DS-05 | Dark mode = swap de tokens en `.dark`; migrar excepciones `dark:bg-zinc-*` a surface tokens | El mecanismo ya existe y es correcto; las excepciones improvisadas lo rompen | globals.css:71-96; nav.tsx | Nav, toast, modales |
| DEC-DS-06 | Inventario §31 mapeado (9 existentes, 9 nuevos); abstracción solo con 2+ usos reales | §31: no genéricos inútiles, no abstracción prematura | §31; audit punto 2 (21 componentes) | `src/components/ui/` |
| DEC-DS-07 | Iconos Lucide vía `icon.tsx`; significado > estética; nunca icono solo para acción crítica | §21 | §21; ui/icon.tsx | Todos los módulos |
| DEC-DS-08 | Microcopy humano: verbo+objeto, neutro es, paridad es/en, aria como microcopy | §22; H-08; H-03 | H-08 (29 toasts); H-03 | `messages/*.json` |
| DEC-DS-09 | 12 estados explícitos con componente patrón y las 3 respuestas (qué ocurrió/datos seguros/qué hacer) | §15: no dejar estados implícitos | §15; audit punto 5 | Todas las páginas |
| DEC-DS-10 | A11y base en componentes: focus trap, un canal de anuncio, `aria-required`, `aria-pressed`, naming de diálogos, targets 44px, contraste AA | Cierra H-05/H-11/H-12/H-13/H-16/H-18 en la base, no por parche | H-05/H-11/H-12/H-13/H-16/H-18 | modal, drawer, toast, select, toggles |
| DEC-DS-11 | Responsive por tarea: DataTable↔MovementCard <640px, formularios 1 col + sticky acción; sin `overflow-x` como única solución | §11/§19; la forma sigue a la tarea | H-09; table.tsx:13-21 | Movimientos y todas las tablas |
| DEC-DS-12 | Confianza visible: patrones de saldo negativo, multimoneda, idempotencia, atomicidad, vínculos y fechas (tabla §12) | §14: la UX hace visible la robustez existente, sin inventar garantías | §14/§16/§17; benchmark errores 3/4/11 | MoneyDisplay, forms, confirmaciones |
| DEC-DS-13 | Performance: skeletons por página (patrón existente), lazy de gráficos, sin librerías de UI externas nuevas | §44: UX no degrada performance; las gráficas son el único punto pesado | §44; audit punto 8 (snapshot server-side) | Resumen, dashboard |

## 15. Relación con el resto de la etapa

| Documento | Relación |
|---|---|
| `UX-INFORMATION-ARCHITECTURE.md` | Este sistema implementa sus decisiones (DEC-IA-07 → MetricCard/SummaryCard; DEC-IA-08 → DataTable/MovementCard; DEC-IA-11 → controles globales del footer) |
| `UX-ROADMAP.md` | Los DEC-DS se ejecutan en UX-10 (paso 2 arquitectura, con los P1 de tokens/tipografía); la base a11y en UX-9; los estados/microcopy en UX-8; responsive en UX-7 |
| `UX-UI-AUDIT.md` | Fuente de evidencia (H-01/H-02/H-05/H-11/H-12/H-13/H-16/H-18/H-19) |

**Regla de mantenimiento:** todo componente nuevo aprobado se documenta aquí antes o junto con su implementación; toda regla permanente resultante se incorpora a `docs/PROJECT-RULES.md` (§15).