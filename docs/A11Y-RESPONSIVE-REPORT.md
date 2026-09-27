# A11Y + Responsive — Informe de auditoría real (C12-9 / C12-10)

> Fecha: 2026-09-26 · Herramienta: axe-core (Playwright) + capturas responsive reales.
> Ejecutable standalone: `AUDIT_INCLUDE_SWEEP=1 pnpm test:e2e -g "audit sweep" --retries=0`
> Spec: `e2e/audit-sweep.spec.ts` · Salidas (gitignored): `audit-output/responsive-shots/` (galería `index.html` + 120 PNG light+dark), `audit-output/axe-report.json`.

## Alcance

- **13 rutas autenticadas** (dashboard, movements, transfers, accounts, clients, credits granted/received, payables, pos/sales, pos/catalog, categories, profile, help) con usuario real registrado y datos sembrados (movimientos, crédito recibido, payable, ítem de catálogo, venta POS pagada).
- **7 rutas públicas** (landing, login, register, privacy, terms, cookies, data-policy) con contexto fresco sin sesión.
- **3 breakpoints** por PROJECT-RULES: mobile 375, tablet 768, desktop 1280.
- **Ambos temas**: light (contexto por defecto) y dark (contexto nuevo con `localStorage["twincap-theme"]="dark"`, el mecanismo propio de ThemeProvider).
- **axe tags**: `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`.
- **Gate**: 0 violaciones critical/serious EN AMBOS TEMAS. Moderate/minor quedan registradas en `axe-report.json`.

## Resultado final

| Gate                                | Estado                                          |
| ----------------------------------- | ----------------------------------------------- |
| Violaciones axe critical/serious    | **0** (20 rutas × 2 viewports × 2 temas)        |
| Capturas responsive                 | 120 PNG (20 rutas × 3 viewports × light + dark) |
| Errores de runtime durante el sweep | **0**                                           |

## Hallazgos corregidos durante la auditoría

### 1. Crash de serialización RSC en empty states (bug de producción, serious)

- **Síntoma**: `Functions cannot be passed directly to Client Components` ×5 durante el sweep; las server pages (`clients`, `accounts`, `categories` + cualquier `EmptyState` por defecto) pasaban el forwardRef de lucide (`icon={Users}`, default `Inbox`) al client component `Icon` → la página crasheaba en prod cuando la lista estaba vacía.
- **Fix**: `src/components/ui/icon.tsx` deja de ser `'use client'` → componente compartido; el prop `icon` nunca cruza la frontera RSC. lucide-react no tiene side effects ni hooks (solo forwardRef) → válido en ambos grafos.

### 2. Contraste de color light (serious, causa sistémica única)

Causa raíz: `zinc-500 (#71717b)` sobre las superficies pastel claras — 4.33:1 sobre `#f0f3f5` (bg) y 4.06:1 sobre `#e8ecf0` (card); exigido 4.5:1. Correcciones:

- **Masa**: `text-zinc-500 dark:text-zinc-400` → `text-zinc-600 dark:text-zinc-400` (63 instancias, 20 archivos); `text-zinc-500 dark:text-surface-muted` → `text-surface-muted`; footer landing `(zinc-500/zinc-500)` → `zinc-600/zinc-400`; footers `(auth)` y `(legal)` → `zinc-600`.
- **Texto zinc-400 sobre card (2.2:1)**: contadores de abonos (credits-received, payables) y spans de moneda en summary-cards → `text-zinc-600 dark:text-zinc-400`.
- **Gráficos no-textuales (3:1)**: chevron de `Select`, icono de `EmptyState`, trash de sale-form → `zinc-500`.
- **Tokens semánticos light** (`src/app/globals.css`): `--tc-success` → `#047857`, `--tc-info` → `#1d4ed8`, `--tc-debt` → `#9a3412` (los tres fallaban 4.5:1 sobre card; dark theme conserva su set brillante).

### 3. Región scrollable sin acceso por teclado (serious)

- `/cookies` tabla legal con `overflow-x-auto` sin foco posible → `tabIndex={0}` + `focus-visible` ring en `src/components/legal/legal-page.tsx`.

### 4. Contraste de color dark (serious — pasada dark, 12 hallazgos iniciales → 0)

- **Pares `dark:*` deficientes heredados del fix light**: labels del dashboard (`dark:text-zinc-600` = 2.28:1 sobre card `#151921`) → `dark:text-zinc-400`; copyright del landing (`dark:text-zinc-500` = 3.67:1) → `dark:text-zinc-400`; spans de abonos sin par dark → `dark:text-zinc-400`.
- **`--tc-primary` dark como TEXTO (3.66:1)**: el mismo token sirve como bg de botones (necesita oscuro para texto blanco) y texto de links (necesita claro sobre fondo oscuro) — imposible con uno solo. Se introdujo **`--tc-primary-soft`** (light = alias de primary; dark = `#60a5fa`, 7.2:1 sobre `#18181b`) y 17 archivos migrados: `dark:text-primary` → `dark:text-primary-soft`.
- **Excepción deliberada**: el variant `inverse` del Button (CTA del hero sobre el gradiente brand) conserva fondo blanco en dark → su texto usa `text-primary` SIN flip (`#0069f5` sobre blanco = 4.82:1 ✓ en ambos temas); `primary-soft` sobre blanco fallaría (2.54:1).

## Limitaciones documentadas

- Los **diálogos/modales** (formularios POS, confirmaciones F5) no se escanean con axe en estado abierto — su cobertura de foco/trap vive en tests unitarios (UX-9 S1-S4) y E2E de flujos. Los hints amber dentro de modales quedan fuera del gate por esta limitación.
- Estados `hover:`/`focus-visible` no son evaluados por axe (solo estilo computado por defecto); los pares hover se ajustaron por coherencia con los tokens corregidos.

## Verificación

- `tsc --noEmit` EXIT 0 · `pnpm lint` 0 errores (10 warnings preexistentes) · Prettier limpio.
- Suite unitaria completa: `pnpm test` **1695/1695** (ver tracker C12-10).
- Suite E2E reglamentaria: 35/35 (ver tracker C12-10; el sweep es standalone excluido vía `testIgnore` condicional).
