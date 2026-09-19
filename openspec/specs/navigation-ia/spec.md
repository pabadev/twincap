# Navigation IA Specification

## Purpose

Sidebar navigation information architecture for TwinCap: four-tier ordering with named group headers, nav label catalog renames, "Configuración" grouping with footer relocation, and removal of the redundant BackButton from root list pages (H-14). Implements DEC-IA-02/03/04/10 and DEC-IA-05 from `docs/UX-INFORMATION-ARCHITECTURE.md`. This capability is presentation-only: routes, modules, and domain behavior are frozen.

Cross-cutting constraints that bind every requirement in this spec: UI-only (zero changes in `src/core/`, `src/infrastructure/`, Mongoose models), i18n parity (`messages/es.json` + `messages/en.json`, neutral Spanish, no voseo), branch `master` (never `main`), conventional commits.

## Requirements

### Requirement: S1 i18n tree hygiene prerequisite

The pending uncommitted `messages/es.json` / `messages/en.json` diff (the `feature5Title` rename "Reportes y gráficos" → "Análisis e insights" / "Analysis & insights", H-07 periphery) MUST be committed as the FIRST work unit of this change, before any other unit that touches `messages/*.json`, so that later i18n slices are not entangled with a dangling diff. The commit MUST be a conventional commit (`chore:`) on branch `master`.

#### Scenario: Pending rename committed first

- GIVEN the working copy contains the uncommitted `feature5Title` rename in `messages/es.json` and `messages/en.json`
- WHEN the S1 work unit is applied
- THEN `git status` shows no dangling diff in `messages/*.json`
- AND `messages/es.json` contains `"feature5Title": "Análisis e insights"` and `messages/en.json` contains `"feature5Title": "Analysis & insights"`
- AND `pnpm parity` passes

#### Scenario: S2 depends on clean tree

- GIVEN S1 has been committed
- WHEN S2 (nav restructure) touches `messages/*.json`
- THEN the S2 diff contains only S2-related key changes, with no S1 residue mixed in

### Requirement: Four-tier navigation ordering (DEC-IA-02)

The authenticated sidebar MUST render navigation items grouped in exactly four tiers, in this order:

- **Tier 1 — Comprensión** (no group header): Resumen/Summary (`/dashboard`), Movimientos/Transactions (`/movements`).
- **Tier 2 — Operación**: Ventas/Sales (`/pos/sales`), Cuentas/Accounts (`/accounts`), Clientes/Clients (`/clients`).
- **Tier 3 — Compromisos**: Créditos otorgados/Credits granted (`/credits/granted`), Créditos recibidos/Credits received (`/credits/received`), Cuentas por pagar/Payables (`/payables`), and conditionally Analítica/Analytics (`/analytics`).
- **Tier 4 — Configuración**: Productos/Products (`/pos/catalog`), Categorías/Categories (`/categories`), Mi perfil/My profile (`/profile`), Comentarios/Feedback (`/feedback`), Ayuda/Help (`/help`).

The Tier 3 ordering MUST place "por cobrar" (credits granted — money the business is owed, a recurring critical task) first. Routes MUST NOT change; only order, grouping, and labels change. The legacy flat order and the `<hr>` separator elements in the nav MUST be replaced by the tier/group structure.

#### Scenario: Full authenticated nav order

- GIVEN an authenticated user renders the sidebar
- WHEN the nav list is rendered
- THEN the items appear in the tier order: Resumen, Movimientos, [Operación header] Ventas, Cuentas, Clientes, [Compromisos header] Créditos otorgados, Créditos recibidos, Cuentas por pagar, [Configuración header] Productos, Categorías, Mi perfil, Comentarios, Ayuda

#### Scenario: Conditional analytics item

- GIVEN a user WITHOUT analytics authorization
- WHEN the sidebar renders
- THEN no Analytics item appears anywhere in the nav
- GIVEN the founder (authorized) user
- WHEN the sidebar renders
- THEN Analytics appears as the last item of the Compromisos tier

### Requirement: Named group headers (DEC-IA-03)

Tiers 2, 3, and 4 MUST render a discrete group header label ("Operación", "Compromisos", "Configuración") above their items. Tier 1 MUST have NO group header. Group headers MUST be visually discreet (secondary to nav items) and their text MUST come from i18n keys present in both `messages/es.json` and `messages/en.json` in neutral Spanish (no voseo).

#### Scenario: Headers render above groups

- GIVEN an authenticated user renders the sidebar
- WHEN the nav is displayed
- THEN exactly three group headers are visible: "Operación", "Compromisos", "Configuración" (localized)
- AND no header precedes the Tier 1 items

#### Scenario: Header i18n parity

- GIVEN the group header keys are added to `messages/es.json`
- WHEN `pnpm parity` runs
- THEN the same keys exist in `messages/en.json` with English equivalents and parity passes

### Requirement: Nav label catalog renames

The visible nav labels MUST be renamed by i18n keys only: "Catálogo POS" → "Productos" (en: "Products") and "Ventas POS" → "Ventas" (en: "Sales"). "POS" is technical jargon removed from user-facing labels. Routes (`/pos/catalog`, `/pos/sales`) MUST NOT change. No other nav label semantics change in this capability.

#### Scenario: Labels renamed in both locales

- GIVEN an authenticated user with locale `es`
- WHEN the sidebar renders
- THEN `/pos/catalog` reads "Productos" and `/pos/sales` reads "Ventas"
- GIVEN locale `en`
- WHEN the sidebar renders
- THEN `/pos/catalog` reads "Products" and `/pos/sales` reads "Sales"
- AND `pnpm parity` passes

#### Scenario: Routes unchanged after rename

- GIVEN the renamed labels
- WHEN the user clicks the Products or Sales nav item
- THEN navigation lands on `/pos/catalog` or `/pos/sales` respectively (unchanged routes)

### Requirement: Configuración grouping and footer relocation (DEC-IA-10)

The sidebar footer entries Mi perfil (`/profile`) and Comentarios (`/feedback`) MUST be relocated from the footer into the "Configuración" group as regular nav items. The footer MUST retain only the global session controls: user email display, theme toggle, language toggle, and Salir/Logout (with its existing ConfirmDialog). This closes the "footer aglomerado" problem: profile and feedback become navigable items, global controls stay invariant.

#### Scenario: Profile and feedback in Configuración group

- GIVEN an authenticated user renders the sidebar
- WHEN the Configuración group is displayed
- THEN Mi perfil and Comentarios appear as group items alongside Productos, Categorías, and Ayuda

#### Scenario: Footer keeps only global controls

- GIVEN an authenticated user renders the sidebar
- WHEN the footer region is displayed
- THEN it contains the email, theme toggle, language toggle, and Salir — and no Profile or Feedback links
- AND clicking Salir still opens the existing confirmation dialog

### Requirement: /help placement decision

The existing `/help` route (currently outside the `(main)` shell at `src/app/help/page.tsx`) MUST be incorporated into the "Configuración" nav group. The shell/route placement (keeping the standalone route and linking to it, or relocating the page under the `(main)` shell for sidebar consistency) MUST be explicitly decided in the design artifact with rationale — this is a documented decision, not a silent default. No help content changes are in scope.

#### Scenario: Help appears in the nav group

- GIVEN an authenticated user renders the sidebar
- WHEN the Configuración group is displayed
- THEN Ayuda/Help appears as a group item linking to `/help`

#### Scenario: Placement decision is documented

- GIVEN the S2 design work is done
- WHEN the design artifact is reviewed
- THEN it contains an explicit `/help` placement decision (keep standalone vs. move under `(main)` shell) with rationale

### Requirement: BackButton removal from root list pages (H-14, DEC-IA-05)

The redundant `BackButton` MUST be removed from the 5 root list pages reachable from the sidebar: `src/app/(main)/pos/sales/sale-list.tsx`, `src/app/(main)/pos/catalog/catalog-list.tsx`, `src/app/(main)/payables/payables-list.tsx`, `src/app/(main)/credits/received/credits-received-list.tsx`, `src/app/(main)/credits/granted/credits-granted-list.tsx` — including their `back-button` imports. This closes H-14: root modules show no back control; the sidebar is the path back. This removal MUST be an isolated conventional commit (`refactor:`) so it can be reverted independently of the nav restructure.

#### Scenario: BackButton absent from all five root lists

- GIVEN any of the 5 root list pages is rendered
- WHEN the page header area is inspected
- THEN no BackButton renders and no back-button import remains in the file

#### Scenario: Navigation path preserved

- GIVEN a user on `/payables` (or any of the 5 lists)
- WHEN they want to go elsewhere
- THEN the sidebar provides navigation to all modules (no dead-end)

### Requirement: Active states and a11y invariants preserved

The nav restructure MUST preserve existing active-state and accessibility behavior: `aria-current="page"` on the active item, exact-match for `/dashboard` and prefix-match for other items, the mobile drawer focus trap, `inert` gating below `lg`, Escape-to-close, body scroll lock, and TouchTarget ≥44px hit areas on all nav controls (UX-9 R-3 / RTT-1 invariants).

#### Scenario: Active state after restructure

- GIVEN the user is on `/credits/granted`
- WHEN the sidebar renders
- THEN the Créditos otorgados item carries `aria-current="page"` and its active styling, and no other item does

#### Scenario: Mobile drawer a11y preserved

- GIVEN a mobile viewport (< 1024px)
- WHEN the drawer is opened and closed
- THEN focus moves to the first link on open, returns to the hamburger on close, Tab stays trapped while open, Escape closes it, and body scroll is locked

### Requirement: No /reports route (DEC-IA-09)

This change MUST NOT create a `/reports` route or any new reports view. Paso 11 (Reportes) is audit-confirmed already closed; the route is explicitly out of scope.

#### Scenario: No reports route introduced

- GIVEN the whole change is applied
- WHEN the app routes are inspected
- THEN no `/reports` route exists and no nav item points to one

### Requirement: Frozen domain and route stability

All navigation changes MUST be presentation-only: no route paths added/removed/renamed (except the documented `/help` shell-placement decision), zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models, and no change to session/auth behavior (logout still goes through the existing server action).

#### Scenario: Scope check on diff

- GIVEN all S1+S2 work units are committed
- WHEN `git diff --stat` is inspected against the base commit
- THEN no file under `src/core/` or `src/infrastructure/` appears

### Requirement: Responsive and gate compliance for S2

The restructured nav MUST be verified at 375px, 768px, and 1280px (drawer + desktop sidebar, group headers legible at all three). Each S2 work unit MUST pass the §46 gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (with explicit timeout ≥ 2_700_000 ms — regulatory, full suite ~21 min), `pnpm build`, responsive check, and a11y spot check. Commits are conventional, on branch `master`.

#### Scenario: Gates green after nav restructure

- GIVEN the nav restructure commit is staged
- WHEN the gate suite runs
- THEN tsc, lint, build, and the full Vitest suite (run with timeout ≥ 2_700_000 ms) all pass
- AND the nav renders correctly at 375px, 768px, and 1280px
### Requirement: BackButton file deleted (H-14 act 2)

UX-10 removed BackButton usage from all root list pages (H-14 act 1). This change completes "act 2": the now-dead component file `src/components/ui/back-button.tsx` (0 importers, verified 2026-09-18) MUST be deleted, AND its literal-file assertion in `src/__tests__/touch-target-imports.test.ts` (lines ~21-25) MUST be removed in the SAME commit, so the suite cannot reference the removed file and stays green. The deletion MUST be its own isolated conventional commit (`refactor:`) so it can be reverted independently.

#### Scenario: File deleted and test in same unit

- GIVEN the deletion commit is applied
- WHEN `src/components/ui/` is inspected
- THEN `back-button.tsx` does not exist
- AND `touch-target-imports.test.ts` contains no BackButton assertion in that same commit

#### Scenario: Importer grep re-check before deletion

- GIVEN the deletion unit starts
- WHEN an import search for `back-button` runs against `src/`
- THEN 0 importers are found (if any appear, the deletion is blocked and the unit is re-scoped — not force-deleted)

#### Scenario: Suite green after deletion

- GIVEN the deletion commit
- WHEN the tests touching `touch-target-imports.test.ts` run
- THEN they pass (the literal-file assertion is gone, remaining assertions intact)

### Requirement: focus-visible ring unification (DS line 164)

Components still using `focus:ring-2` (checked against the touched set, canonical: `button.tsx` and any `focus:ring-2` users in the touched files) MUST migrate to the unified `focus-visible` ring pattern per the design system (DS "foco visible consistente" rule, ~line 164), with `src/components/ui/action-icon-button.tsx:67` as the REFERENCE implementation. The ring: `focus-visible:ring` styled with the `primary` token (not `focus:ring-2`, which also draws a ring on programmatic focus). Keyboard focus visibility MUST be preserved everywhere; no focus outline is silently removed.

#### Scenario: Button adopts focus-visible ring

- GIVEN `button.tsx` currently uses `focus:ring-2`
- WHEN the unification is applied
- THEN the Button uses the focus-visible pattern consistent with `action-icon-button.tsx:67` (ring on keyboard focus, with the primary token)
- AND Tab-navigation still shows a visible ring on the focused Button

#### Scenario: No focus:ring-2 in the touched set

- GIVEN the unification commit
- WHEN the touched component set is grep'd for `focus:ring-2`
- THEN the grep returns 0 occurrences in the migrated files
- AND mouse clicks do not draw a focus ring (focus-visible semantics)

#### Scenario: Keyboard a11y preserved

- GIVEN a user navigating entirely by keyboard
- WHEN they Tab through buttons and other unified-focus components
- THEN every focusable control shows a visible focus indicator (no regression versus before)

### Requirement: Nav contrast fixes have ONE implementation home (CC-3 + CC-7)

The nav group-label contrast fix (CC-3, `nav.tsx:248`) and the nav active-tint contrast fix (CC-7, `nav.tsx:268`) MUST land in EXACTLY ONE implementation home — either this capability's unit or the `ui-token-compliance` per-site unit — never duplicated across both. The assignment MUST be recorded in the change design; whichever unit holds it owns both the edit and the contrast evidence for these surfaces.

#### Scenario: No duplicated contrast edit

- GIVEN both the navigation-ia and ui-token-compliance units are applied
- WHEN `nav.tsx` lines 248/268 are inspected
- THEN the contrast fixes appear exactly once (single edit, single evidence pointer)
- AND the chosen home for CC-3/CC-7 is documented in the change design

### Requirement: Frozen domain and gates for the cleanup/polish unit

The cleanup (back-button deletion) and polish (focus-visible unification) MUST be presentation-only: zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models, no route changes, no i18n key changes (no visible strings touched). Each unit's conventional commit on `master` MUST pass `pnpm exec tsc --noEmit`, `pnpm lint`, the full Vitest suite (explicit timeout ≥ 2_900_000 ms), `pnpm build`, and responsive verification at 375/768/1280 px.

#### Scenario: Scope check on diff

- GIVEN the cleanup/polish commits are staged
- WHEN `git diff --stat` is inspected
- THEN no file under `src/core/` or `src/infrastructure/` appears and no `messages/*.json` key changes

#### Scenario: Gates green after cleanup and polish

- GIVEN both units are staged
- WHEN the gate battery runs
- THEN tsc, lint, build, and the full Vitest suite (explicit timeout ≥ 2_900_000 ms) pass
