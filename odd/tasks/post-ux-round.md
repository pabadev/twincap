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
- [x] T3: Summary hierarchy: 1) "¿Cuánto tengo disponible?" (keep primary data format),
  2) "Flujo de caja del mes" (renamed from ambiguous wording). Keep N1-N4 philosophy.
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
