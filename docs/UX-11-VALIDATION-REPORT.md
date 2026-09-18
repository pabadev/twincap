# UX-11 — Validation Report (§48 — Real Evidence)

> **Fecha:** 2026-09-18 · **Phase:** UX-11 (Part A agent-executed · Part B founder-attested same day) · **Verdict:** **PASSED** — acceptance met (see §6)
> **Start HEAD:** `3f70887477ba96ef7f232155e0684679591d6b48` (UX-10 archived; verified clean tree) · End HEAD Part A: see Methodology.
> **Acceptance criteria (roadmap §UX-11):** no open P0/P1 · Golden Rule §41 passed by ≥ 4/5 users · financial regression ZERO (suite + tsc + lint + build).

---

## 1. Methodology / Metodología

- **Harness existence:** all Part A evidence was produced on 2026-09-18 in this session from the tree at the HEADs recorded below; **no number in this report is copied from a prior-phase report**.
- **Commits (unit-scoped, conventional):** U1 `chore(deps)` `130ae2b` → U2 `test(a11y)` `cbb72e3` + `af30be2` → U3 `test(gates)` `13600ff` → U4 `test(tti)` `5c2fd3b` → U5 `docs(ux-11)` (this file's commit). Nothing is pushed — the push to `origin/master` is the orchestrator's delivery step.
- Commands executed verbatim (with the one recorded command-form deviation in §3.2 and §4):
  - `pnpm exec tsc --noEmit` · `pnpm lint` · `pnpm parity` · `pnpm build` · `pnpm test` (timeout 2,900,000 ms)
  - a11y scan + TTI through `e2e/load-e2e-env.cjs test --config playwright.a11y.config.ts` / `playwright.tti.config.ts`
- **Zero `src/` changes** — frozen domain §47 is _checked_, never touched (final audit §6).

## 2. Part A — §47 gates with real results / Comprobación de congelado financiero

| Gate                     | Result (this run, 2026-09-18)                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm exec tsc --noEmit` | **0 errors**                                                                                                                 |
| `pnpm lint`              | **0 errors**, 7 warnings (all pre-existing `src/**` files; the new `e2e-a11y/**` and configs are clean)                      |
| `pnpm parity`            | **2 files / 4 tests passed** (6.31 s)                                                                                        |
| `pnpm build`             | **Compiled successfully** (production emitted, exit 0)                                                                       |
| `pnpm test` (full suite) | **151 files / 1568 tests — 1568 passed, 0 failed** · duration 1463.77 s (~24.4 min) · run with explicit 2,900,000 ms timeout |

Financial regression verdict: **ZERO** — all five gates green in the same session.

### §47 freeze mapping — 13 items (exactly 13 rows)

All 13 items PASS in this run; concrete per-item test references in `openspec/changes/ux-11-validation/evidence/gates-2026-09-18.md`. Summary:

| #   | Item                     | Fresh status                                                                     |
| --- | ------------------------ | -------------------------------------------------------------------------------- |
| 1   | crear movimiento         | ✅ PASS (`movements.test.ts` creates L142/L178, movement-repository)             |
| 2   | editar movimiento        | ✅ PASS (`movements.test.ts` edit-touch L722/L834, concurrency-movements)        |
| 3   | eliminar movimiento      | ✅ PASS (delete L953, concurrency-deletion)                                      |
| 4   | transferencias           | ✅ PASS (TRA-2 L252, TRA-1 L565; mapper + repo tests)                            |
| 5   | multimoneda              | ✅ PASS (TRA-3 cross-currency L515; currency fields in account/movement repos)   |
| 6   | saldo negativo           | ✅ PASS (`balance.test.ts` L202 "handles negative balances correctly")           |
| 7   | créditos                 | ✅ PASS (credits-received + credits-granted suites)                              |
| 8   | abonos                   | ✅ PASS ("adds an abono ... creates income movement" L435; concurrency-abonos)   |
| 9   | POS                      | ✅ PASS (`sales.test.ts`, `get-sale-detail.test.ts`, POS e2e specs in inventory) |
| 10  | opening balances         | ✅ PASS (accounts.test + movement-repository opening invariants)                 |
| 11  | operaciones multi-cuenta | ✅ PASS (transfer source/dest resolution, concurrency-matrix-pairs)              |
| 12  | idempotencia             | ✅ PASS (models/idempotency, auth/idempotency, idempotency-restart)              |
| 13  | aislamiento tenant       | ✅ PASS (tenant-isolation.test NotFoundError block; tenant-touch; indexes)       |

**Correction of the inherited "15 rows" slip:** the UX-10 verify table listed 15 rows for this mapping; §47 of `docs/freeze + UX-UI.md` (lines 1487–1499) defines **exactly 13 items** — count verified 2026-09-18. This table has exactly 13 rows. The two UX-10 rows that do not exist in §47 were inflate noise (e.g. duplicates of movement operations), now corrected.

**Note:** the Playwright e2e suite (`pnpm test:e2e`) is not one of the five sanctioned gates and was not re-run in Part A; every row above leans on vitest evidence that passed 100% in this session.

## 3. Part A — TTI "after" run (H-17) with real numbers

Run 2026-09-18, harness verbatim (`git diff` over `e2e-tti/**` + `playwright.tti.config.ts` = empty), all 9 samples produced, run PASS (2.8 min).

| #   | Run      | Viewport | Throttle | Hero N1 before→after (ms)  | DCL before→after (ms) | Load before→after (ms) |
| --- | -------- | -------- | -------- | -------------------------- | --------------------- | ---------------------- |
| 1   | **frío** | 375      | 3g       | 2381 → **2570** (+7.9%)    | 1197 → **1143**       | 3093 → **3123**        |
| 2   | hot-1    | 375      | —        | 2466 → **2260** (−8.4%)    | 1012 → **1310**       | 1702 → **1806**        |
| 3   | hot-2    | 375      | —        | 2391 → **2041** (−14.6%)   | 1271 → **1038**       | 1782 → **1696**        |
| 4   | **frío** | 768      | —        | 2330 → **1978** (−15.1%)   | 1073 → **613**        | 2023 → **1788**        |
| 5   | hot-1    | 768      | —        | 2296 → **3158** (+37.6%) * | 803 → **1069**        | 1838 → **1782**        |
| 6   | hot-2    | 768      | —        | 3702 → **2571** (−30.5%)   | 1801 → **1239**       | 2205 → **1895**        |
| 7   | **frío** | 1280     | —        | 2270 → **2298** (+1.2%)    | 579 → **880**         | 1687 → **1756**        |
| 8   | hot-1    | 1280     | —        | 2882 → **2115** (−26.6%)   | 1864 → **558**        | 2254 → **1554**        |
| 9   | hot-2    | 1280     | —        | 3300 → **3234** (−2.0%)    | 1940 → **2037**       | 2649 → **2388**        |

(*) Row 5 is a hot sample inside the historical hot-peak band the baseline itself recorded (UX-5 hot samples span 2296–3702); its sibling hot-2 read 2571 (−30.5%) in the same context and hot load was flat. Not a gate.

### Variance protocol outcome

Gate = cold-hero per breakpoint: 375 **+7.9%**, 768 **−15.1%**, 1280 **+1.2%** — **no point > +20% → the ×3-rerun noise protocol was NOT triggered**; no regression finding, no cause analysis required.

### Criteria check

- ✅ Cold hero-N1 < 10 s at 375/768/1280: 2.57 / 1.98 / 2.30 s — **§8.1 y Regla de Oro §41 cumplidos** (H-17 sigue mantenido tras UX-10)
- Benign server artifacts: none this run (baseline's "The destination stream closed early." did not appear — 0 occurrences)

### §2.1 deviations (declared verbatim, identical to baseline)

1. **Sin Lighthouse/DevTools**: se usó Navigation Timing + umbral de hero. TTI tipo Lighthouse (ventana idle) no se calculó; la métrica reportada es estrictamente "tiempo hasta contenido N1 visible".
2. **Sin serverless**: `next start` en Node plano no emula el cold start de una función Vercel; el cold start real de plataforma añadiría ~1–2 s (proxy connectDb) en el peor caso, sin invalidar el margen (10 s).
3. **3G simulado por CDP** en el mobile frío (sin "oficina"; máquina de desarrollo local).

**No additional undisclosed deviation.** One command-form note (not a method deviation): the spec-header command `... load-e2e-env.cjs exec node node_modules/@playwright/test/cli.js test ...` errors in the current Playwright CLI (`error: unknown command 'exec'` — this version has no `exec` subcommand); the executed runs used the same loader with `test --config ...`, invoking the identical `@playwright/test/cli.js test`. Recorded in the unit evidence files.

## 4. Part A — Automated a11y scan with real results

Run 2026-09-18 via `playwright.a11y.config.ts` (standalone, production build, port 3200; NOT wired into CI). **Matrix complete: 20/20 combos scanned (5 routes × 375/1280 × light/dark), 0 scan gaps. Raw artifact:** `openspec/changes/ux-11-validation/evidence/a11y-scan-raw.json`.

### Triage (every entry, aggregated per rule × combo)

| Axe rule               | Impact   | Entries | Combos | Triage        | Rationale / evidence                                                                                                                                                                                                                                                                                    |
| ---------------------- | -------- | ------- | ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color-contrast`       | serious  | 18      | 18     | **P1 (open)** | Every combo at both viewports; flagged nodes sit in text using zinc-500/zinc-400 grays vs surface cards (e.g. dashboard helper copy, list metadata). WCAG AA text contrast. Remediation plan owner: UX-12 contrast-token pass (UX-9's S12.2 doc covers decorative pairs, not these text pairs).         |
| `aria-prohibited-attr` | serious  | 16      | 16     | **P1 (open)** | Toast/notification container: `<div aria-live="polite" aria-label="Notifications">` — `aria-label` prohibited on `role="alert"`/`aria-live` wrappers (`.pointer-events-none fixed bottom-4 right-4`). Single-point fix candidate (the toast component), feeds the single-announcement S8.3 manual test. |
| `label`                | critical | 8       | 8      | **P1 (open)** | `input[type="date"]` in sale/credit forms lacks accessible name at some form mounts (POS `/pos/sales`, `/credits/granted` at 375 light). Sight-impaired keyboard users cannot identify the date field.                                                                                                  |
| `select-name`          | critical | 8       | 8      | **P1 (open)** | A bare `<select>` without name in the same form areas.                                                                                                                                                                                                                                                  |

**Part A acceptance bar: zero open P0/P1 — adjudicated by the founder (2026-09-18):** axe impact levels map serious/critical → P1 here. **All 12 triaged violations are P1, zero P0.** Per spec (`validation-evidence`), open P0/P1 keep the verdict BLOCKED and each carries the remediation note above; **NO product code was patched inside UX-11** (freeze §47 + out-of-scope remediation). **Founder adjudication (2026-09-18): all 12 P1s dispositioned as ACCEPTED → committed UX-12 backlog** (rule counts + selectors in §4 tables and `evidence/a11y-scan-raw.json`) — they are no longer "open" for UX-11 acceptance purposes; the real code fixes belong to UX-12.

Documented scan gaps: **none** (0 — every combo rendered meaningful seeded content; harness gap `getByText("Paid in Full")` matching the hidden filter option was fixed in-harness before the reporting run, see `e2e-a11y/scan.spec.ts` comment).

## 5. Part B — COMPLETED (founder attestation, 2026-09-18)

> **Evidence level: FOUNDER ATTESTATION.** The founder executed Part B on 2026-09-18 and attested "las pruebas fueron exitosas" (the tests were successful), with **5/5 users passing**. Granular per-task capture sheets (time-on-task, hesitations, `/help` usage) were NOT retained — the tables below record the attested outcome per user, not protocol-captured observations. Precedent note: this closes the loop the project kept open across UX-7→UX-10 (RSL-8 items).

### 5.1 Usability results (5 users × 4 tasks) — ✅ 5/5 PASSED (attested)

| User | Task 1 venta POS | Task 2 gasto | Task 3 Resumen (10 s) | Task 4 cobro crédito | Time-on-task / hesitations | `/help` usage |
| ---- | ---------------- | ------------ | --------------------- | -------------------- | -------------------------- | ------------- |
| 1    | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested)   | not retained               | not retained  |
| 2    | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested)   | not retained               | not retained  |
| 3    | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested)   | not retained               | not retained  |
| 4    | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested)   | not retained               | not retained  |
| 5    | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested) | ✅ pass (attested)   | not retained               | not retained  |

**Golden Rule §41: 5/5 ≥ 4/5 — criterion MET (attested).**

### 5.2 Manual a11y — ✅ COMPLETED (attested)

| Item                                                   | Scope                                                             | Result              | Notes                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| **S8.3** screen-reader test of the single announcement | one live-region announcement per flow                             | ✅ pass (attested)  | Closes H-16 formally; `aria-prohibited-attr` P1 fix owned by UX-12    |
| **S12.2** design review of the contrast doc            | token pairs incl. those flagged by axe                            | ✅ pass (attested)  | feeds the `color-contrast` P1 remediation (UX-12)                     |
| **S13.1** keyboard checklist on the 5 main screens     | `/dashboard` `/movements` `/pos/sales` `/credits/granted` `/help` | ✅ pass (attested)  |                                                                       |

### 5.3 Visual passes — ✅ COMPLETED (attested)

| Pass                   | Source         | Result             |
| ---------------------- | -------------- | ------------------ |
| responsive layout pass | UX-10 task 9.5 | ✅ pass (attested) |
| RSL-8                  | UX-7           | ✅ pass (attested) |
| filter-zero state      | UX-8           | ✅ pass (attested) |

## 6. Verdict

**PASSED — UX-11 CLOSED (2026-09-18).**

All three acceptance criteria are met:

- **No open P0/P1** — ✅ the 12 axe P1 findings were formally adjudicated by the founder (2026-09-18): **ACCEPTED → committed UX-12 backlog** (0 P0 existed). Disposition recorded in §4; the real code fixes are UX-12's first work items.
- **Golden Rule ≥ 4/5 users** — ✅ **5/5 passed** (founder attestation, §5.1).
- **Financial regression ZERO** — ✅ demonstrated by Part A gates (suite 1568/1568 + tsc 0 + lint 0 + build OK, §3).

No open TTI regression finding (cold hero within budget at all breakpoints, §2).

**Evidence-level caveat (honest record):** Part A evidence is measured (machine-runnable, reproducible). Part B evidence is founder attestation with date — per-task granular capture sheets were not retained. If a future audit requires protocol-level Part B records, the protocol (`docs/UX-11-USABILITY-PROTOCOL.md`) remains re-runnable as-is.

**Next phase:** UX-12 Polish — first work items: the 12 dispositioned axe P1s (`color-contrast`, `aria-prohibited-attr`, `label`, `select-name`), dead `back-button.tsx` deletion, (auth)-surface danger banners → `Alert`, global `--tc-*` contrast correction, FormField filter-bar labels. Requires founder phase approval (R3.13).

---

_Raw evidence: `openspec/changes/ux-11-validation/evidence/{a11y-scan-raw.json, gates-2026-09-18.md, tti-after-2026-09-18.md}`._
