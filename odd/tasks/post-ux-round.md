# Ronda POST-UX — Clúster 1: Lo que el usuario ve

## Objective

Restore discoverability and hierarchy of core user-facing surfaces: Transfers in sidebar,
FAB with exactly 3 actions, Summary hierarchy coherent with beta user priorities, and the
recovered "Load more" button in Movements (cards view).

## Problem

The first UX round regressed several surfaces: Transfers disappeared from the sidebar (still
a live route), the Movements card view (<640px) lost the load-more pagination trigger, and the
Summary card order/wording does not answer the beta user's first question ("¿cuánto tengo
disponible?").

## Why

TwinCap exists to let non-technical users understand their financial situation at a glance.
Every change here must make it easier to: register, understand, detect, or act.

## Scope (cluster 1 only)

- [x] T1: Restore "Transferencias" in sidebar using existing `/transfers` route (no second
      implementation). Verify desktop/mobile, active state, icon, i18n, a11y. Tests if applicable.
      DONE: src/app/(main)/nav.tsx Tier 1 entry + ArrowLeftRight icon; existing i18n key Nav.transfers;
      nav.test.tsx updated (7/7 pass).
- [x] T2: FAB contains exactly Venta POS / Ingreso / Gasto (POS on top), correct flows, session
      permission-aware, responsive, keyboard, aria-labels, touch targets, dark/light. No new form
      logic. Tests for FAB actions.
      DONE: global-movement-provider.tsx speed dial with POS Sale first (router.push to /pos/sales,
      no form duplication), h-11 + min-w-[44px] touch targets, aria-labels; i18n key
      Movements.quickAddPosSale added in es/en.
- [x] T3: Summary hierarchy: 1) "¿Cuánto tengo disponible?" (keep primary data format), 2) "Flujo de caja del mes" (renamed from ambiguous wording). Keep N1-N4 philosophy.
      DONE: summary-hero.tsx reordered (Disponible first, big-number format kept on both cards);
      Dashboard.monthlyCashFlow key added en/es; periodResult key kept for compatibility.
- [x] T4: Movimientos recientes reachable + clearly actionable link to /movements
      (heading + "Ver todos" pattern; not a whole-card click if it contains buttons).
      DONE: recent-movements.tsx adds right-aligned <Link href="/movements"> in heading row with
      Dashboard.viewAllMovements aria-label; existing viewAll key for visible text.
- [x] T5: Recover "Cargar más movimientos" button: move trigger out of <TableShell> to shared
      list level so nextCursor drives both table and card variants. Cursor pagination preserved,
      accumulated rows preserved, h-11 touch target, existing i18n key `loadMore`. Regression test:
      button renders in card variant when nextCursor exists; disappears when cursor exhausted.
      DONE: trigger moved to sibling of TableShell; 3 new regression tests in movements-list.test.tsx
      (render when nextCursor set, absent when null, handler called once on click).

## Constraints

- Ronda prohibitions apply: no financial domain changes, no new UI/chart libs, no
  window.location.reload(), no silent COP fallback.
- pnpm ONLY (npm/npx prohibited even if docs say otherwise).
- Double quotes in all TS/TSX/JSON; prettier-clean touched files.
- All new visible text in messages/es.json and messages/en.json (neutral Spanish).
- Suite timeout ≥ 45 min (2_700_000 ms) for full runs.

## Verification evidence

- pnpm exec tsc --noEmit: 0 errors
- vitest targeted: movements-list (6/6), nav (7/7), dashboard-content (3/3), messages-parity (2/2)
- Orchestrator spot-check re-run: tsc clean, prettier clean, 13/13 tests pass (nav + movements-list)
- eslint: 0 errors, 1 pre-existing warning (nav.tsx:156 exhaustive-deps, not introduced here)

## Next step

Commit T1-T5 as work-unit commits on feature branch; then cluster 2 (monetary integrity).

## Cluster 2 — Monetary integrity + honest currency defaults (§12-14)

Commits: d859149 (aggregation), e563a66 (COP fallbacks), 0ed1783 + 56b71e8 (defaultCurrency + BRL).

- [x] T6 (§12): Fixed 3 unbudgeted `+=` monetary aggregations in build-dashboard-snapshot.ts
      (attention receivables/payables) → sumSafeMinorUnits. Domain-layer `+=` with post-loop
      assertSafeMinorUnits left intact (approved frozen pattern, documented decision).
- [x] T7 (§13): 4 silent "COP" fallbacks replaced with explicit DEFAULT_CURRENCY from
      core/domain/currency.ts. Test fixtures unchanged (controlled data setup).
- [x] T8 (§14): User.defaultCurrency — optional Mongoose field, domain entity, mapper,
      Profile setting with server-side validation, wired to movement/account/transfer/credit/
      payable/catalog forms via layout + providers (fallback chain: account.currency ??
      defaultCurrency ?? DEFAULT_CURRENCY). Edit forms preserve entity currency (correct).
- [x] T9 (§42/BRL): BRL added to CURRENCIES + model enums (PT-BR readiness); UI regression
      movement-form.test.tsx (USD→USD, BRL→BRL, no pref→DEFAULT_CURRENCY).
- Verification: tsc 0 errors; 20/20 targeted tests (currency 5, user 5, profile actions 5,
  movement-form 3, parity 2); prettier clean.
- INCIDENT (documented): an accidental repo-wide prettier run produced a 442-file
  mega-format commit; fully reverted (mixed reset + checkout) and rebuilt as 33-file
  commits. Lesson: never run prettier/checkers at repo scope on this repo; scope strictly
  to touched files. Legacy single-quote files normalize only when touched.

## Next step

Cluster 3 — patterns/forms/notes/a11y (§15-17, §23, §25-28).

## Cluster 3 — Category flows + form density + notes (§15-18)

Commit: 0540d38.

- [x] T10 (§15): Quick category creation in movement form ("+" inline, POS pattern):
      server action returns created snapshot, parent merges state, auto-selects new
      category, form state preserved, no refresh. i18n keys added.
- [x] T11 (§16): FAB stale-category root cause: GlobalMovementProvider cached
      accounts/categories client-side forever (data !== null guard). Fix: closeModal
      resets data → every open fetches fresh. Regression: open→close→reopen fetches
      twice (real behavior test, not smoke).
- [x] T12 (§17): Transfer form groups account selects in 2-col desktop grid;
      movement form already semantically grouped (left as-is, deliberate).
- [x] T13 (§18): Note cell max-w truncate → line-clamp-3 + title attr; full
      content accessible; mobile cards already render full text (deliberate).
- Verification: tsc 0 errors; 34/34 targeted tests (provider 2, movements suite,
  parity); prettier clean; eslint clean.

## Next step

Cluster 4 — standalone §19-24 responsive/cards + venta Quitar button + menus.

## Cluster 4 — Responsive cards + balance overflow + categories grid + Quitar + FAB (§19-24)

Mode: delegated-exploration unavailable this session (OpenCode task transport fails
deterministically: `unknown field "__managed_by"`); orchestrator implemented inline as
single writer after a bounded grep/read map. Reference patterns verified:
transfers/accounts/clients/movements already use TableShell `max-sm:hidden` +
MovementCard `sm:hidden` — they stay untouched. TDD mode: standard (tests alongside
behavior, targeted vitest; source: prior clusters' established pattern, no strict_tdd).

- [x] T14 (§20/§19): credits-received-list — card header stacks on mobile
      (rows: counterparty / metadata / amounts+actions), min-w-0, desktop unchanged.
      DONE: commit df0368a (header flex-col gap-2 → sm:flex-row; amounts+actions row
      justify-between sm:justify-end; counterparty span min-w-0).
- [x] T15 (§20/§19): credits-granted-list — same header fix + abonos inner table
      (up to 5 cols) becomes stacked rows on mobile (table kept on sm+).
      DONE: commit df0368a (header + max-sm:hidden table + sm:hidden stacked abono
      rows with capital/interest line and action row). Received 3-col abonos table
      kept: legible at card width (deliberate, documented).
- [x] T16 (§19/§20): catalog-list — name/price/actions stack on mobile.
      DONE: commit 1f7482f (flex-col → sm:flex-row; price/actions row
      justify-between sm:justify-end).
- [x] T17 (§19/§20): sale-list — data/actions stack on mobile, metadata wraps.
      DONE: commit 1f7482f (same pattern; metadata spans wrap naturally).
- [x] T18 (§20): sale-detail-modal — line items (4 cols) as stacked rows on
      mobile, table kept on sm+.
      DONE: commit 67ebfbd (max-sm:hidden table + sm:hidden rows: name / qty ×
      unit price / tabular-nums subtotal).
- [x] T19 (§21): dashboard account cards + summary-hero available rows —
      min-w-0 + break-words + tabular-nums + responsive size; Card overflow-hidden
      currently CLIPS large balances (worse than overflow).
      DONE: commit b03915d (balance text-lg sm:text-xl + min-w-0 break-words
      tabular-nums; hero rows shrink-0 currency + wrapping value).
- [x] T20 (§22): categories page — Ingresos/Gastos sections in
      `grid gap-6 lg:grid-cols-2`, stacked on mobile (current space-y-6 replaced).
      DONE: commit c14f880 (grid + lg:items-start).
- [x] T21 (§23): sale-form "Quitar" text button (line ~328) → ActionIconButton
      icon-only (Trash2, tone danger, aria-label/title = t("remove"), 44px target).
      DONE: commit 67ebfbd (reuses ActionIconButton primitive: aria-label + title
      tooltip + TouchTarget ≥44px; regression test asserts icon-only).
- [x] T22 (§24): FAB speed dial spacing moderately reduced (outer gap-3→gap-2,
      options gap-2→gap-1.5); touch targets h-11/min-w-[44px] preserved; sidebar nav
      verified already tight (space-y-0.5/lg:space-y-0) — no change.
      DONE: commit c14f880. Sidebar audit: compliant already.
- [x] T23 (§42/§41): regression tests (icon-only remove, responsive structural
      checks, balance tabular-nums) + tsc/eslint/prettier/targeted vitest clean.
      DONE: sale-form.test.tsx +§23 icon-only block (4/4);
      credits-received-list.test.tsx NEW (2/2 structural responsive);
      dashboard-content.test.tsx +§21 overflow block (4/4).
      Evidence: tsc --noEmit 0 errors; eslint 0 errors/warnings on all 13 touched
      files; prettier --check clean; targeted vitest 10/10 (two consecutive runs,
      second one over post-prettier bytes).

Commits (work units): df0368a (T14-15), 1f7482f (T16-17), 67ebfbd (T18+T21),
b03915d (T19), c14f880 (T20+T22). RDD status: off (default) — ordinary checks
only, no review ceremony. Full suite deferred to slice close per cluster plan.

## Next step

Implement cluster 4 task by task, then clusters 5+ (§25-31 a11y/design-system,
§32-36 docs/policies, §37-39 offline, §40 audit, §44-45 final report).

## Next step (updated after cluster 4)

Cluster 5 — §25-28 accessibility (labels explicit, focus-visible unification,
reduced motion) + §29-31 design system (Card API, tokens, Top 3 vs Top 5
decision). Run the full vitest suite (timeout ≥ 45 min) at the next slice
close or feature end, per the delivery budget.

## Cluster 5 — Beta feedback fixes (user report, 2026-09-21)

Five findings from beta testing; inserted ahead of the §25-31 cluster.

- [x] B1: Profile defaultCurrency — select is uncontrolled; React 19 resets
      the form after the action resolves, so the input reverts (blank/—) after a
      green success toast and never shows the saved option. Fix: controlled select
  - router.refresh() on success so the saved value stays visible.
- [x] B2: FAB "Venta POS" navigates via router.push("/pos/sales") while
      Ingreso/Egreso open their form in place. Fix: POS option opens SaleForm in a
      modal in place (fetch catalog/accounts/clients on open via a new
      getSaleFormDataAction; reuse SaleForm — no form logic duplication).
- [x] B3: Sale detail modal shows the internal sale ID (font-mono UUID).
      Decision: remove — internal identifier, no value for register/understand/
      detect/act (§47). Drop saleIdLabel keys (es/en).
- [x] B4: Credits granted/received cards cram all info into a dense header —
      do not follow the Movements card format. Fix: restructure into MovementCard
      visual language (row 1 counterparty+badges+chevron; dl label/value rows for
      date, amount, installments/total/progress, pending emphasized text-debt;
      footer border-t with abono count + edit). Update cluster 4 structural tests.
- [x] B5: Inline category creation from income/expense form: (a) the "+" is a
      tiny bare-text button; (b) submitting the category form triggers hydration
      error "<form> cannot be a descendant of <form>" — the category Modal sits
      INSIDE the movement <form> (form closes AFTER the Modal) and Modal is not a
      portal. Fix: move the Modal outside the form (fragment) — the code comment
      already demanded this, the code contradicted it; replace "+" with a visible
      labeled button (existing i18n key addCategoryInline "Agregar categoría").
- [x] B6: Verification — tsc/eslint/prettier clean; targeted tests updated +
      green (profile select stays populated, category modal outside form, FAB POS
      modal opens, credits rows structural, detail modal has no ID).

Commit plan: c1=B5 (hydration fix is the blocker, categories module), c2=B1,
c3=B2, c4=B3+B4 (sales/credits presentation), c5=docs.

### Cluster 5 completion evidence

- B1: root cause was DEEPER than reported — React 19 resets the DOM form after
  EVERY form action, and controlled fields stay blank when no re-render
  follows (state unchanged → React never rewrites the reset DOM value).
  Fix: profile fields held in controlled draft state; on success the form
  re-mounts (key bump) seeded with the SUBMITTED values; router.refresh()
  re-syncs server props. Test: profile-form.test.tsx NEW (select keeps COP
  after save, name preserved, refresh called).
- B2: getSaleFormDataAction added (accounts/catalog/clients, same
  fetch-on-open pattern); FAB POS opens SaleForm in a size-lg modal in place;
  dial data invalidated on close (§16 pattern). pos/sales/actions.ts was a
  legacy single-quote file — prettier normalization applied on touch (§18).
  Tests: provider +2 (POS modal opens + fetch-once-per-open contract).
- B3: sale ID row removed from sale-detail-modal; saleIdLabel dropped from
  es/en. Decision documented: internal identifier, no user value (§47).
- B4: both credit lists restructured to the Movements card language: row 1 =
  counterparty + badges + chevron; dl label/value rows (Fecha, Monto primary,
  Cuotas n/m + frequency, Total a pagar, Pendiente emphasized text-debt /
  Pagado text-success); footer = abono count + edit on border-t. New i18n key
  installmentsRow (es/en). installmentProgress folded into the Cuotas row
  (n/m format). Cluster 4 structural tests rewritten for the new structure.
- B5: category Modal moved OUTSIDE the movement form (fragment) — the old
  comment demanded this but the code had it inside; hydration error gone.
  Bare "+" replaced with labeled "+ Agregar categoría" button (addCategoryInline,
  Plus icon 12px, 32px min touch, primary/10 hover bg).
- B6: tsc 0 errors; eslint clean on all 10 touched files; prettier clean;
  targeted vitest 17/17 across 6 files (two runs; second on post-prettier
  bytes); messages-parity 2/2.

Commits: 1cde01f (B5), 162708c (B1), 57f5e9f (B2), 210ca7f (B3+B4).

## Cluster 6 — Cards everywhere: tables retired (product decision, 2026-09-21)

User override of §19/§20: remove table views on ALL breakpoints; every list
renders cards (Movements pattern). PC may arrange cards in 2-column grids
(credits, payables). Recorded in docs/Ronda POST-UX.md §19/§20.

- [x] C1: payables-list — 3-column card header → MovementCard row format
      (B4 pattern: identity+chevron / dl rows Fecha+Vence+Nota+Monto+Pendiente /
      footer abono count + edit); list container becomes grid gap-3
      md:grid-cols-2 md:items-start; drop list-level overflow-x-auto.
- [x] C2: credits received/granted — card list becomes grid gap-3
      md:grid-cols-2 md:items-start (2-column arrangement on PC).
- [x] C3: movements-list — delete TableShell table block + sort machinery
      (SortIcon/toggleSort/sortField/sortDir/sortAria; fixed date-desc order
      kept); cards become the only representation (remove sm:hidden); remove
      3 sort-header tests from movements-list.test.tsx.
- [x] C4: clients-list — delete table block; cards everywhere.
- [x] C5: accounts page — delete table block; cards everywhere; drop the
      duplicate length check structure.
- [x] C6: transfers-list — delete table block; cards everywhere.
- [x] C7: categories page — delete table block; cards everywhere; drop the
      now-unused actionsLabel plumbing.
- [x] C8: verification (tsc/eslint/prettier/targeted tests) + this doc.

Card variants already carry the tables' full information and actions
(verified per surface). Inner 3-col abonos tables in payables/received stay:
legible at card width. i18n: no key removals needed (all labels still used).

Commit plan: c1=C1, c2=C2, c3=C3, c4=C4+C7, c5=C5+C6, c6=docs.

### Cluster 6 completion evidence

Commits: e492d88 (C1 payables rows + 2-col grid), cfc7c33 (C2 credits grid),
8fceb41 (C3 movements: -254 lines of table/sort machinery, 3 sort tests
removed with the feature, fixed date-desc order kept), 8cbe6dc (C4+C7 clients
+categories), c73ae95 (C5+C6 accounts +transfers, redundant guard dropped).
docs/Ronda POST-UX.md §19/§20 updated with the 2026-09-21 product decision.
Verification: tsc 0 errors; eslint clean (2 dead sort types found and
removed); prettier clean; targeted vitest 13/13 + 3/3 movements post-fix.
No i18n changes needed (all table labels already used by the card fields).

## Cluster 7 — §26-31: labels, reduced motion, Top 5, Card API, focus/token audit

- [ ] T24 (§31): Top 3 → Top 5 in dashboard-content (spec UX-RESUMEN-DESIGN.md
      is explicitly Top 5, "slice(0,5) es presentación"); disagreement resolved in
      favour of the vigente spec; update tests if any assert 3.
- [ ] T25 (§28): global prefers-reduced-motion media query in globals.css
      (kills transitions/animations app-wide: toast, accordion, nav drawer,
      chevrons, theme + spinners paused) — the canonical single-rule approach
      instead of per-component overrides.
- [ ] T26 (§26): catalog + clients search inputs rely on placeholder alone —
      add aria-label (visible <label> impractical for an inline icon search).
- [ ] T27 (§29): Card gains contentClassName (children wrapper padding);
      migrate the real double-padding consumers (dashboard cards, summary-hero)
      from className="p-_" to contentClassName="p-_"; default stays p-6
      (zero breakage); new ui card unit test.
- [ ] T28 (§27/§30/§25): structural audit recorded — focus pattern already
      focus-visible on interactive primitives (button/icon-button/nav/FAB/report
      cards; inputs keep focus: for border+ring, appropriate); no new raw colors
      introduced this round (§30 rule recorded for the final report); the full
      §25 a11y surface matrix stays for the round-close validation.
- [x] T29: verification + docs.

Commit plan: c1=T24, c2=T25, c3=T26, c4=T27, c5=docs.

### Cluster 7 completion evidence

Commits: 67fe936 (Top 5 per vigente spec — §31 disagreement resolved for the
design doc), e268be0 (globals.css prefers-reduced-motion global rule §28),
4002099 (§26 aria-labels catalog+clients search), 14cd36f (§29 Card
contentClassName; 15 double-padding consumers migrated across 6 dashboard
files; new ui/**tests**/card.test.tsx 3/3).
T28 audit notes: focus pattern on interactive primitives is already
focus-visible (button, action-icon-button, nav, FAB, report-card, not-found);
inputs keep focus: for border+ring (appropriate, inputs are focus-targets);
no new raw colors introduced this round (§30 rule recorded); full §25 a11y
surface matrix deferred to round-close validation (§41).
Verification: tsc 0 errors; eslint clean (after children-as-prop fix in the
new test); prettier clean; targeted vitest 7/7 (card 3 + dashboard-content 4).

## Cluster 8 — Beta round 2 (dashboard analysis proposals)

Four proposals, analyzed per §47 (register/understand/detect/act):

- [ ] U1 (Top Buckets): product-owner proposal ACCEPTED — asymmetric Top:
      incomes sliced to Top 3 (most personal users have ≤3 income categories;
      more than 3 is noise), expenses keep Top 5 (spread, actionable). Fix the
      stale titles (they still say Top 3) with per-section keys; update
      UX-RESUMEN-DESIGN.md row 6 with a dated amendment.
- [ ] U2 (Ver todos): recent-movements "Ver todos" becomes a link with a
      button body (secondary-button styling, semantically still a <Link>);
      h-11 touch target; discoverability on desktop + mobile.
- [ ] U3 (Reports grid): DashboardReportsGrid "Entiende mejor tus finanzas"
      is redundant secondary navigation (all 6 targets already in the sidebar)
      — removes nothing user could not already reach; violates N1 minimalism.
      DELETE component + ReportCard + index re-export + 7 i18n keys (es/en).
- [ ] U4 (Line chart): the current chart is a DIY horizontal bar list —
      rewrite as a NATIVE SVG line chart (income + expenses polylines, points
      with native <title> tooltips, baseline grid, month labels, legend,
      responsive viewBox, dark mode). NO external library (chart.js cleared out):
      single chart in the app today; adopt a lib if charts multiply (recorded
      for §34 analytics roadmap).
- [x] U5: verification + PR.

Commit plan: c1=U1, c2=U2, c3=U3, c4=U4, c5=docs+push.

### Cluster 8 completion evidence

U1: incomeRows.slice(0,3) / expenseRows.slice(0,5); Dashboard titles now
"Top 3 Ingresos"/"Top 5 Gastos" (en: Top 3 Income / Top 5 Expenses);
UX-RESUMEN-DESIGN.md row 6 amended (dated 2026-09-22, proposal accepted).
U2: recent-movements "Ver todos" now a <Link> with secondary-button body
(h-11 touch target), aria-label preserved.
U3: dashboard-reports-grid.tsx + report-card.tsx DELETED; index re-export
removed (tsc caught the leftover); 7 i18n keys dropped from es+en
(messages-parity 2/2, messages-usage green).
U4: monthly-chart.tsx rewritten as native SVG line chart (solid income /
dashed expenses polylines, baseline grid + compact Y labels, native <title>
tooltips per point, month label stride 2 on 12-month series, sr-only data
table, legend, dark tokens, no external dependency). NEW monthly-chart.test.tsx
(3 tests: two polylines, 6 title tooltips + sr-only + no canvas, label
stride 3/6). Verified stroke-/fill-income/expese utilities derive from the
@theme tokens.

- [x] U5: verification (tsc 0, eslint clean, prettier clean, targeted tests
      green 4+3+2+2) + push/PR on a fresh branch from master.

## Cluster 8 delivery

PR #14 (feat/post-ux-round-2 -> master, 5 commits f583b3a..17d28ab) MERGED.
CI: Quality pass, Vercel pass; E2E failed once on duplicate-opening
(concurrency timing sensitivity — known flaky class R15) and PASSED on the
re-run 3m12s; Vercel Production deployment == success after merge
(master 3dcdbed). Reports-grid removal, asymmetric Top, button-bodied
Ver todos link and native SVG line chart are LIVE in production.
