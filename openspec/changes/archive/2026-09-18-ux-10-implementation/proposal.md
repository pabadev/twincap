# Proposal: UX-10 — Final Implementation Sweep (§53 Order Remaining Steps)

## Intent

UX-10 closes the remaining approved scope of the UX modernization roadmap (docs/UX-ROADMAP.md §53) plus deferred findings from earlier phases, with **honest scope — no invented work**. Phases UX-0..UX-9 are complete. The fresh audit (2026-09-18, evidence verified at file:line) confirmed that paso 6 (Movimientos), paso 10 (Créditos/Abonos), and paso 11 (Reportes) are **already closed in tree** and require zero work. What remains is a set of concrete UI debt items:

- **Tree hygiene**: an uncommitted `messages/*.json` diff (feature5Title rename "Reportes y gráficos" → "Análisis e insights", H-07 periphery) sitting in the working copy.
- **Navigation & config IA** (paso 12 + paso 1 completion): DEC-IA-02/03/04/10 — nav tier reorder, group headers, nav renames, "Configuración" grouping, and removing legacy `BackButton` from root list pages (H-14 residue).
- **H-10 residue**: two remaining ad-hoc empty states (`clients`, `categories`) plus one partial duplicate (`catalog-list` noResults) that predate the `EmptyState` component.
- **Token/color residue**: DEC-DS-01/03 residue — two raw color literals that escaped tokenization.
- **DEC-DS-06 residue**: four ad-hoc danger banners + one info banner; the 2+ uses threshold for an `Alert` component is now met.
- **Paso 8 decision record**: POS sale creation has no confirmation; this needs an explicit documented decision, plus a FormField extract-vs-defer decision.

This change is **UI-only**: the financial domain is frozen. Zero changes in `src/core/`, `src/infrastructure/`, or Mongoose models.

## Scope

### In Scope

- **S1 — Tree hygiene**: commit the pending `messages/es.json` / `messages/en.json` diff (feature5Title rename) as the first work unit. No code change.
- **S2 — Nav & Config (paso 12 + paso 1)**:
  - Reorder nav tiers and add group headers per DEC-IA-02/03/04 (`src/components/nav.tsx:39-54` `NAV_ITEMS`, replacing the flat legacy order and the `<hr>` divider at `nav.tsx:213-215`).
  - Rename nav labels: "Catálogo POS" → "Productos", "Ventas POS" → "Ventas" (`messages/es.json:40-41` + `en.json` equivalents).
  - Add "Configuración" group header grouping Perfil / Comentarios / Ayuda; relocate Profile and Feedback entries currently in the sidebar footer (`nav.tsx:258-283`); decide `/help` placement (route exists at `src/app/help/page.tsx`, outside the `(main)` shell).
  - Remove `BackButton` from the 5 root list pages (`sale-list.tsx:103`, `catalog-list.tsx:42`, `payables-list.tsx:63`, `credits-received-list.tsx:59`, `credits-granted-list.tsx:63`), closing **H-14**.
  - Note: DEC-IA-11 (footer controls + localized aria) is **already closed** (`nav.tsx:289,297`) — declared out.
- **S3 — H-10 empty states unification (paso 9)**:
  - Migrate the remaining ad-hoc empty states to the existing `EmptyState` component: `clients/page.tsx:39-46` (original H-10 audit evidence), `categories/page.tsx:69-79` (per-section `noIncome`/`noExpense` `<p>`), `catalog-list.tsx:89` (`noResults` plain text inside the results counter — partial duplicate of the `EmptyState` already at `:102`).
  - **Document exclusions with rationale** (not silence): `dashboard-content.tsx:339-344`, `summary-table.tsx:41-42`, `summary-hero.tsx:86-88` (N1 dashboard minimalism — design-sensitive sub-states), `global-movement-provider.tsx:212-215` (inline modal hint). Each exclusion gets a one-line documented decision.
- **S4 — Token & color corrections (DEC-DS-01/03 residue)**:
  - `transfer-form.tsx:376`: raw `text-red-600 dark:text-red-400` → `text-danger` token.
  - `button.tsx:26`: residual `hover:bg-indigo-50` → equivalent token.
  - **D6 — Contrast AA sub-set (BLOCKED on founder sign-off)**: per UX-9-CONTRAST-EVIDENCE.md §5 decisions 1-3 — global `--tc-*` correction OR DS doc correction, local sub-set (Button success / Toast info / Badge `/10` tints / modal close `zinc-400`→`zinc-500`), and external tool verification. This is surfaced as a **decision point**, not silently included. If not signed off, S4 ships only the two token-literal fixes above.
- **S5 — Alert component extraction (DEC-DS-06)**:
  - Extract a reusable `Alert` component into `src/components/ui/` (variant: danger at minimum, info as second variant).
  - Migrate 4 ad-hoc danger banners: `sale-form.tsx:161-162`, `sale-detail-modal.tsx:76`, `pos/sales/abono-form.tsx:103-104`, `catalog-form.tsx:71-72`.
  - Migrate the info banner: `profile/verify-banner.tsx` (dedicated component) onto the shared `Alert`.
  - **ErrorState: NOT created** — error.tsx usage does not meet the 2+ real uses threshold; deferral documented.
- **S6 — Paso 8 decision record + FormField decision**:
  - **D7 — POS sale-creation confirmation (BLOCKED on founder decision)**: `sale-form.tsx` creation flow has no informed confirmation. Create ≠ destroy (UX-6 already covered delete-sale and cobro). Options: (a) add a MoneyActionConfirmation-style confirmation to POS sale creation, or (b) document why create stays without one (aligning with how account/movement creation was treated). Resolved during design/tasks; not silently defaulted.
  - **D8 — FormField extract-vs-defer (BLOCKED on founder decision)**: UX-4 DS:90 listed FormField ("~6 usos") as NUEVO but it was never extracted — the label+error+aria pattern is per-form today. Extract only if 2+ real in-scope uses are confirmed; otherwise document the deferral.

### Out of Scope

- **Paso 6 (Movimientos), paso 10 (Créditos/Abonos), paso 11 (Reportes)**: audit-confirmed already closed in tree. `/reports` must NOT be created (DEC-IA-09). Declared out explicitly.
- **DEC-IA-11** (footer nav controls + localized aria): already closed at `nav.tsx:289,297`.
- **H-01, H-02, H-15, H-19-core**: audit-confirmed closed.
- **Any change to `src/core/`, `src/infrastructure/`, Mongoose models, business logic, movement `kind` semantics, or financial calculations** — frozen domain, UI-only phase.
- **New purchases module** — does not exist; do not invent.
- **Workspace selector / multi-team UI** — disabled in beta.

## Capabilities

> Contract for sdd-spec. `openspec/specs/` is currently empty — all capabilities below are new and will land as full specs at archive.

### New Capabilities

- `navigation-ia`: Sidebar navigation information architecture — tier ordering, group headers (including "Configuración" group), nav label catalog (renames), active states, and absence of redundant BackButton on root list pages.
- `empty-state-consistency`: Unified empty-state presentation — EmptyState component usage across list surfaces and documented exclusions for design-sensitive sub-states.
- `ui-token-compliance`: Design-token discipline — danger/success/info color tokens in components; contrast AA sub-set only if founder signs off (D6); documented token corrections.
- `alert-component`: Reusable Alert component (danger/info variants) replacing ad-hoc banners across forms, modals, and profile verification.
- `pos-sale-confirmation`: Confirmation semantics for POS sale creation per the D7 decision outcome (either a confirmation gate or a documented no-confirmation rationale).
- `form-field-pattern`: FormField label/error/aria pattern per the D8 decision outcome (extraction or documented deferral).

### Modified Capabilities

- None — `openspec/specs/` is empty; every affected capability is new.

## Approach

One SDD change, executed as **six work-unit commits aligned to sub-phases S1..S6** (conventional commits, `chore:`/`feat:`/`refactor:` per unit), ordered so that hygiene lands first and decisions gate later slices:

1. `chore: commit pending i18n rename for feature5Title` (S1 — unblocks clean tree).
2. `feat: restructure sidebar navigation with group headers and config group` + `refactor: remove BackButton from root list pages` (S2).
3. `refactor: unify remaining empty states into EmptyState component` + exclusion decision notes in design doc (S3).
4. `refactor: replace raw color literals with design tokens` (S4 core); contrast sub-set only after D6 sign-off.
5. `feat: extract Alert component and migrate ad-hoc banners` (S5).
6. `feat:`/`docs:` per D7/D8 outcomes (S6).

Per sub-phase gates (§46): `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test` (timeout ≥ 45 min — regulatory), `pnpm build`, responsive check at 375/768/1280 px, a11y spot check. At phase end: §47 financial regression checklist (dashboard metrics, transfer vs expense semantics, Payable/Payments accounting, credit-granted abono/interest/write-off — all via existing tests; zero domain code touched, so regression risk is test-run-verified). **i18n parity gate** (`pnpm parity`) after every slice that touches `messages/*.json` (S1, S2, and any slice adding visible strings). Every new visible string exists in `messages/es.json` AND `messages/en.json`, neutral Spanish.

Component placement: `Alert` (and `FormField` if D8 approves extraction) go to `src/components/ui/` per project rules; verify no existing equivalent first (`src/components/ui/` already exports `EmptyState`, `Button`, etc.).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `messages/es.json`, `messages/en.json` | Modified | S1 pending rename committed; S2 nav renames; any new visible strings (parity-gated) |
| `src/components/nav.tsx` | Modified | NAV_ITEMS reorder + group headers + Configuración grouping + footer relocation (S2) |
| `src/app/(main)/pos/sales/sale-list.tsx` | Modified | BackButton removal (S2) |
| `src/app/(main)/pos/catalog/catalog-list.tsx` | Modified | BackButton removal (S2); noResults → EmptyState (S3) |
| `src/app/(main)/payables/payables-list.tsx` | Modified | BackButton removal (S2) |
| `src/app/(main)/credits/received/credits-received-list.tsx` | Modified | BackButton removal (S2) |
| `src/app/(main)/credits/granted/credits-granted-list.tsx` | Modified | BackButton removal (S2) |
| `src/app/help/` (route placement) | Modified/Removed | `/help` placement decision inside Configuración group (S2) |
| `src/app/(main)/clients/page.tsx` | Modified | Ad-hoc empty state → EmptyState (S3) |
| `src/app/(main)/categories/page.tsx` | Modified | Per-section empty `<p>` → EmptyState (S3) |
| `src/components/transfers/transfer-form.tsx` | Modified | `text-red-600 dark:text-red-400` → `text-danger` (S4) |
| `src/components/ui/button.tsx` | Modified | Residual `hover:bg-indigo-50` → token (S4); contrast sub-set only if D6 signed off |
| `src/components/ui/alert.tsx` (new) | New | Alert component (S5) |
| `src/app/(main)/pos/sales/sale-form.tsx` | Modified | Danger banner → Alert (S5); confirmation per D7 (S6) |
| `src/app/(main)/pos/sales/sale-detail-modal.tsx` | Modified | Danger banner → Alert (S5) |
| `src/app/(main)/pos/sales/abono-form.tsx` | Modified | Danger banner → Alert (S5) |
| `src/app/(main)/pos/catalog/catalog-form.tsx` | Modified | Danger banner → Alert (S5) |
| `src/components/profile/verify-banner.tsx` | Modified | Dedicated banner → shared Alert info variant (S5) |
| `src/components/ui/form-field.tsx` (new, conditional) | New | FormField extraction only if D8 approves |
| `src/core/`, `src/infrastructure/`, Mongoose models | **None** | Frozen domain — zero changes (UI-only phase) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Full Vitest suite ~21 min; command-runner default timeout (120 s) kills the run and invites bad retries | High | Always run `pnpm test` with explicit timeout ≥ 2_700_000 ms (regulatory rule §14); never retry on timeout without recording the real error |
| Nav restructure changes every page's mental model — nav is a shared component rendered by all `(main)` routes | Medium | S2 as an isolated work unit; verify active states, i18n parity, and 3 breakpoints; screenshot-compare key routes before/after; revert = single commit revert |
| H-10 exclusion decisions perceived as silent omissions | Medium | Each exclusion gets an explicit documented rationale in design (dashboard minimalism, modal inline hint) — decision, not silence |
| D6 contrast sub-set (global `--tc-*` correction) has wide blast radius | Medium | Gated on founder sign-off; default S4 ships only the two token-literal fixes; global correction is a separate, separately-verifiable unit if approved |
| D7/D8 unresolved at design time stalls S6 | Medium | Decisions surfaced now in this proposal; design/tasks phases present options with tradeoffs for founder; S6 is last so prior units land independently |
| Alert extraction changes copy/semantics subtly across 5 surfaces | Low | Byte-identical copy migration (reuse existing i18n keys); per-surface tests updated in same commit |
| i18n drift (es/en) from nav renames and new strings | Low | `pnpm parity` gate after every i18n-touching slice; neutral Spanish (no voseo) |
| BackButton removal breaks perceived navigation on mobile | Low | Sidebar/nav already provides the path back; verify 375 px breakpoint in §46 gate |

## Rollback Plan

Each sub-phase S1..S6 is exactly one (or two) conventional commits; rollback is `git revert` of that unit's commit(s) in reverse order. No DB migrations, no schema, no API contract changes — everything is presentational and i18n strings, so revert is complete and stateless. If S2 nav restructure reveals a defect after merge, reverting the two S2 commits restores the flat nav + BackButton instantly. If D6's global `--tc-*` correction is approved and causes visual regressions, it lands as its own commit (separate from the S4 core fixes) so it can be reverted independently without touching the token-literal fixes.

## Dependencies

- Founder decisions **D6** (contrast AA sub-set sign-off), **D7** (POS sale-creation confirmation), **D8** (FormField extract-vs-defer) — resolved during design/tasks; D6 additionally blocks part of S4.
- Approved plan: founder approved UX-10 start + S2 inclusion (2026-09-18).
- No new npm dependencies (max-one-library rule; nothing here needs one).
- Clean tree prerequisite: S1 must land before other units to avoid i18n diff entanglement.

## Success Criteria

- [ ] S1: `git status` shows no dangling `messages/*.json` diff; feature5Title rename committed with parity passing.
- [ ] S2: nav renders reordered tiers with group headers (incl. "Configuración"); labels read "Productos"/"Ventas"; BackButton absent from the 5 root lists (H-14 closed); all nav strings present in es.json + en.json (`pnpm parity` green).
- [ ] S3: `clients`, `categories`, and `catalog-list` noResults render via `EmptyState`; exclusions (dashboard, summary, modal hint) documented with rationale in design.
- [ ] S4: `transfer-form.tsx` and `button.tsx` use tokens (no raw red/indigo literals in touched lines); contrast sub-set shipped only if D6 signed off, otherwise marked deferred with the pending decision recorded.
- [ ] S5: `Alert` component exists in `src/components/ui/`; 5 banner surfaces migrated; ErrorState deferral documented.
- [ ] S6: D7 and D8 outcomes recorded as explicit decisions (with implementation or documented deferral) — no silent defaults.
- [ ] Gates: per sub-phase `tsc --noEmit` + `lint` + `test` (≥45 min timeout) + `build` + responsive (375/768/1280) + a11y spot check all green.
- [ ] §47 financial regression checklist passes at phase end with zero changes to `src/core/` / `src/infrastructure/` (verified via `git diff --stat` scope check).
- [ ] Pasos 6/10/11 untouched: no `/reports` route created; existing Movements/Credits/Reports behavior unchanged.
