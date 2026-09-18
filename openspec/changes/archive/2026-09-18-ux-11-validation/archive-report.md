# SDD Archive Report — ux-11-validation

> Topic key: `sdd/ux-11-validation/archive-report` · store: openspec · archived: 2026-09-18 · execution_mode: auto · delivery: single-pr · branch: master

## Status

**PART A: COMPLETE.** **PHASE STATUS: PARTIALLY COMPLETE — Parte B pending founder.**

UX-11 is a validation change executed in two parts. Part A (agent-executable) completed fully on 2026-09-18. Part B (founder-only: 5 usability sessions, manual a11y S8.3/S12.2/S13.1, visual passes UX-10 task 9.5 / UX-7 RSL-8 / UX-8 filter-zero, final P0/P1 adjudication and verdict) has NOT run. `docs/UX-11-VALIDATION-REPORT.md` verdict = **BLOCKED pending Part B**. Phase acceptance (no open P0/P1 + Golden Rule ≥ 4/5 users + financial regression ZERO) CANNOT be declared yet — the 12 open axe P1s also await founder adjudication/UX-12. This open state is recorded honestly at archive (precedent: RSL-8 founder-pending items documented at archive in UX-7..UX-10). Reopen criteria: founder delivers Part B results.

## Final-State Facts (outrank snapshots)

- Per the persisted `tasks.md`: **36/36 tasks `[x]`** — Part A fully executed; no unfinished Part A task remains.
- **8 conventional commits** `3f70887` → `37443bd`, unpushed (origin/master..HEAD = 8; the orchestrator pushes). One PR, **size:exception approved by founder (2026-09-18)**. Realization: **2,903 insertions / 14 files**.
- **Zero `src/` diff** across the whole change (frozen domain §47 checked, never touched). `e2e-tti/**` and `playwright.tti.config.ts` unmodified (verbatim harness reuse).
- Commits: `130ae2b` (U1 dep), `cbb72e3` + `af30be2` (U2 a11y harness + lint-gate fix), `13600ff` (U3 gates + §47), `5c2fd3b` (U4 TTI), `f91f473` (U5 docs+report), `26b4dca` (apply-progress), `37443bd` (tasks audit checkboxes).

## Part A Evidence (real numbers, 2026-09-18)

- **Gates (U3, `evidence/gates-2026-09-18.md`):** tsc 0 errors; lint 0 errors / 7 pre-existing warnings; parity 4/4; build OK; full Vitest suite **1568/1568 passed** (151 files, ~24.4 min, explicit timeout 2,900,000 ms). §47 mapping: exactly **13 items, all green**; the inherited "15 rows" slip from UX-10 is corrected.
- **TTI after (U4, `evidence/tti-after-2026-09-18.md`):** 9/9 samples. Cold hero-N1: 2570 ms (375/3G), 1978 ms (768), 2298 ms (1280) vs UX-5 baseline 2381/2330/2270 → **+7.9% / −15.1% / +1.2%**. No point exceeds +20% → noise-analysis protocol NOT triggered; both criteria met (all cold < 10 s) → **H-17 holds, no TTI regression finding**.
- **A11y scan (U2, `evidence/a11y-scan-raw.json`):** 20/20 combos scanned, 0 scan gaps. **50 violations / 4 distinct rules triaged → 0 P0 / 12 open P1**: color-contrast (serious, 18 combos), aria-prohibited-attr (serious, 16), label (critical, 8), select-name (critical, 8). Nothing patched in `src/`; the 12 open P1s await founder adjudication and are added to the UX-12 backlog (below).

## Part B — PENDING FOUNDER (open state at archive)

1. Run the 5 usability sessions per `docs/UX-11-USABILITY-PROTOCOL.md` (protocol ready and self-executable).
2. Execute manual a11y: S8.3 (screen reader, single announcement), S12.2 (design review, contrast doc), S13.1 (keyboard checklist, 5 main screens).
3. Execute visual passes: UX-10 task 9.5, UX-7 RSL-8, UX-8 filter-zero.
4. Adjudicate the 12 open axe P1s (remediate via UX-12 or waive with rationale).
5. Final acceptance only when: no open P0/P1, Golden Rule ≥ 4/5 users, financial regression ZERO (suite + tsc + lint + build).

## Founder Checklist (verbatim from `docs/UX-11-VALIDATION-REPORT.md`)

> **BLOQUEADO — pendiente Parte B (ejecutada por el fundador)**
>
> Para desbloquear el veredicto final, ejecutar en orden:
>
> 1. **Sesiones de usabilidad (5 usuarios):** seguir `docs/UX-11-USABILITY-PROTOCOL.md` de arriba a abajo. Registrar tiempo por tarea, dudas/roces, MAC/F5 y uso de `/help` (permitido como superficie de soporte) en la tabla de resultados (5 usuarios × 4 tareas).
> 2. **A11y manual:** completar S8.3 (lector de pantalla sobre el único anuncio de acción), S12.2 (revisión de diseño del documento de contraste) y S13.1 (checklist de teclado sobre las 5 pantallas principales: dashboard, movements, pos/sales, credits/granted, help).
> 3. **Pasadas visuales (mejoras heredadas):** validar UX-10 tarea 9.5, UX-7 RSL-8 y UX-8 filter-zero según sus criterios originales.
> 4. **Adjudicación P0/P1:** revisar la tabla de triaje del escaneo axe (Parte A). Cada P1 abierto requiere decisión del fundador: remediar (vía UX-12 o un cambio ad-hoc) o documentar por qué no bloquea.
> 5. **Criterios de aceptación final (los tres, obligatorios):** (a) sin P0/P1 abiertos; (b) Regla de Oro §41 aprobada por ≥ 4 de 5 usuarios; (c) regresión financiera CERO (suite completa + tsc + lint + build).
>
> Solo cuando los tres criterios estén cumplidos y las secciones Part B completadas, el veredicto pasa de BLOQUEADO a la conclusión final del reporte.

## UX-12 Backlog Additions

From the axe scan (raw selectors/rule counts in `evidence/a11y-scan-raw.json`):

| # | Rule | Impact | Occurrences (route/viewport/theme combos) | Selectors source |
|---|------|--------|---------------------------------------------|------------------|
| 1 | color-contrast | serious | 18 combos | a11y-scan-raw.json (impact: serious, ruleId: color-contrast) |
| 2 | aria-prohibited-attr | serious | 16 combos | a11y-scan-raw.json (impact: serious, ruleId: aria-prohibited-attr) |
| 3 | label | critical | 8 combos | a11y-scan-raw.json (impact: critical, ruleId: label) |
| 4 | select-name | critical | 8 combos | a11y-scan-raw.json (impact: critical, ruleId: select-name) |

Total: 50 violation entries / 12 open P1 triage lines. Remediation (UX-12) must NOT touch `src/core/`, `src/infrastructure/`, or Mongoose models (frozen domain).

## Snapshot Semantics (per Final-State Authority)

`apply-progress.md` is retained as an intermediate snapshot; its numbers agree with the final state (no post-apply rework changed counts). Its "verdict stays BLOCKED with 12 open P1s feeding Part B adjudication" claim is confirmed as the current state. One slip the launch prompt corrected: the "15 rows" §47 count inherited from UX-10 — final tables contain exactly 13 items.

## Archive Mechanics

- Delta spec `specs/validation-evidence/spec.md` (FULL spec, new capability — 7 requirements / 19 scenarios) copied mechanically to `openspec/specs/validation-evidence/spec.md` (7th capability dir); `diff -r` readback empty.
- Change folder moved with `git mv` to `openspec/changes/archive/2026-09-18-ux-11-validation/`; recursive `diff -r` (pre-move snapshot vs destination) empty; archive-report.md additive-only.
- No push; no `src/` change.
