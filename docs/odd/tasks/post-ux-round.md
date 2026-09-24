# Post-UX Round Tasks

> **Contrato de cierre vigente**: `docs/Cierre_UX-UI.md` (auditado 2026-09-23 contra master
> `3b80f3e`). Este cluster COMPLEMENTA la ronda (no reemplaza clusters 1–11): completa,
> valida, documenta y cierra la ronda Post-UX/UI.

## Cluster 12 — Cierre definitivo de la ronda (docs/Cierre_UX-UI.md)

### Matriz requisito → estado (FASE 1, auditoría 2026-09-23)

| Requisito (Cierre)                     | Estado verificado                                                                                                              | Observación                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| §6 Orden cronológico                   | ✅ Implementado (cluster 10 B1: "_id: -1" tiebreaker + "+1ms" en legs; tests en movement-repository/transfers/credits-granted) | Pendiente menor: movements-list.tsx re-sort solo por date (L162) — limpieza                                                                       |
| §5 Confirmación cierre POS             | ❌ Pendiente — OBLIGATORIO                                                                                                     | Modal compartido cierra incondicional (modal.tsx L46–69); extender con confirmOnClose                                                             |
| §4 Venta POS desktop                   | ❌ Pendiente                                                                                                                   | SaleForm único max-w-2xl; bifurcar presentación "lg:" sin tocar createSale                                                                        |
| §7 Corrección saldo inicial            | ⚠️ GAP real — decisión de dominio                                                                                              | setInitialAccountBalance rechaza si ya existe opening; corrección = cambio en dominio financiero (freeze) → auditar + decisión del fundador ANTES |
| §8–9 Categorías sugeridas              | ❌ Pendiente                                                                                                                   | Solo seed de 8 categorías (user-bootstrap.ts); falta catálogo LATAM + selección múltiple idempotente                                              |
| §10 Clients/Catalog                    | ❌ Decisión no registrada                                                                                                      | Ambos solo-búsqueda hoy; documentar decisión                                                                                                      |
| §11 Offline                            | ❌ Doc pendiente; fase 1 parcial                                                                                               | sw.js v7 cubre estáticos; falta indicador/detección; NO sincronización financiera                                                                 |
| §12 PT-BR prep                         | ⚠️ Parcial                                                                                                                     | LOCALES es/en; separar locale/moneda/formato/plural y documentar                                                                                  |
| §13/§14 Costos + Analítica             | ❌ Docs pendientes                                                                                                             | Solo diseño documental, cero implementación                                                                                                       |
| §15–24 Auditoría transversal + pruebas | Pendiente FASE 5–7                                                                                                             | Cards OK (tablas retiradas); forma desktop el gap principal                                                                                       |

### Orden de ejecución (FASE 4+)

- [x] **C12-1 (§5)** Confirmación de cierre accidental en Venta POS ✅ `e081821` `feat(pos): confirm modal close with unsaved sale changes` — Modal `onRequestClose` opt-in (backward-compatible), dirty tracking en sale-form (`dirtyRef`: lineItems/cliente/pago/moneda/pago inicial/clients locales), ConfirmDialog como hermano del Modal (focus traps disjuntos), ambas monturas (FAB + sale-list), 4 claves i18n es/en; 11 tests nuevos (7 sale-form + 4 modal); tsc/lint/prettier limpio, 31/31 targeted (spot-check del orquestador 27/27)
- [x] **C12-2 (§7)** Corrección de saldo inicial — ✅ `b207265` `feat(accounts): correct initial balance via opening edit` (opción B autorizada): use case `correctInitialBalance` transaccional (CAS `__v` → ConflictError; touch cuenta última escritura; `findOpeningMovement` nuevo en port+repo, session-aware), action con idempotencia P1.2 + withAudit prevValue, UI "Corregir saldo inicial" en accounts/page (visible solo con opening existente), i18n es/en, 7 tests unit + matriz §7; tsc/lint/prettier limpio, 421/421 targeted, spot-check tsc EXIT 0
- [x] **C12-3 (§4)** Venta POS desktop — ✅ `b484c50` `feat(pos): desktop sale layout`: grid `lg:grid-cols-[1fr_20rem]` en 3 zonas, Modal size `xl` (max-w-5xl) en ambas monturas, mobile intacta, lógica `createSale` sin tocar; 6 tests nuevos, tsc/lint/prettier limpio
- [x] **C12-3b (§4+§16)** Ajuste jerarquía visual según `docs/form_ventas.md` — ✅ `a9c8148` `feat(pos): desktop sale form visual hierarchy` (size:exception 519 líneas, unidad cohesiva): tabla de artículos con header único sin labels repetidos + columna Subtotal right-align, format-on-blur con separadores de miles (`type="text" inputMode="decimal"`, parsing defensivo, pasted input), Agregar artículo = botón secundario / Crear artículo = link discreto, trash gris→rojo hover, TOTAL prominente sobre acciones, warning ámbar cliente-a-crédito, hintClassName en form-field, X/Cancelar/ESC unificados por el guard C12-1; 8 tests nuevos (27/27), tsc EXIT 0; reglas globales de forms anotadas en este doc para consolidar en UX-DESIGN-SYSTEM (C12-7)
- [x] **C12-3b (§4)** Venta POS desktop — refinamiento jerarquía visual — ✅ `feat(pos): desktop sale form visual hierarchy`: tabla desktop con header row único + filas sin labels repetidas (mobile mantiene labels), columna Subtotal por línea (desktop), formato numérico con separadores de miles on-blur (input text + inputMode decimal, parseo defensivo), alineación derecha numéricos, botón "+ Agregar artículo" secundario (variant="secondary"), "Crear artículo" como link discreto, icono eliminar neutral→rojo on-hover, hint crédito con tint amber cuando falta cliente, TOTAL prominente antes de acciones, footer Cancelar+Crearventa mismo path guardado (C12-1); FormField extiende con `hintClassName`; 8 tests nuevos (27/27 sale-form), tsc/lint/prettier limpio
- [x] **C12-3c (§4)** Patrón POS estándar: search único arriba + tabla de artículos — ✅ `feat(pos): single search add + items table (POS pattern)`: combobox superior "Buscar o agregar artículo..." con teclado (↑↓ Enter Esc), selecciona agrega al carrito (duplicado incrementa cantidad), tabla semántica con header único [Artículo | Cant. | Precio unit. | Subtotal | Acciones], sin selects por fila, subtotal como texto formateado right-align, mobile con labels compactos + aria-labels, dirty tracking actualizado (carrito vacío = initial state), 33 tests (6 nuevos POS pattern), tsc/lint/prettier limpio
- [x] **C12-3d (§4+§16)** Layout estable + propagación inmediata (product owner) — ✅ `f5047a6` `fix(pos): stable modal layout + immediate catalog propagation`: merge local `localCatalogItems` (patrón `localClients`), snapshot completo en tabla, modal desktop altura fija scroll solo en filas (header sticky), columna derecha independiente, hint a-crédito legible, footer fijo Total+acciones (mobile fluye natural); 42/42 + 4/4 tests, tsc EXIT 0, spot-check OK
- [x] **C12-3e (§4+§16)** Arquitectura Flexbox 3 bloques (especificación literal PO) — ✅ `797662c` `fix(pos): 3-part flex modal layout with isolated scrolls`: Modal `variant="workspace"` aditivo (`max-h-[85vh] w-[90vw] max-w-[960px] overflow-hidden`; 26 consumidores intactos), header/body/footer flex estáticos, body `lg:grid-cols-[1fr_320px] gap-6`, scroll solo filas (header fuera del scroll) y columna derecha con overflow-y propio, tabla grid sin scroll horizontal, footer fusilado, hint a-crédito `#F59E0B` verificado sobre `--tc-surface-card`; mobile natural bajo lg; 42+14+4 tests, tsc EXIT 0
- [x] **C12-3f (§4+§16)** Layout fijo definitivo header/footer + scroll solo filas — ✅ `6f8fdb6` `fix(pos): enforce fixed header/footer with rows-only scroll`: cadena flex con `min-h-0` en cada descendiente entre dialog y rows-scroll (root-cause del overflow), dialog `lg:h-[85vh] lg:w-[92vw] lg:max-w-[1080px]` (altura definida, no solo max-h), header/footer `shrink-0 relative z-10`, columna derecha `overflow-hidden` (fija, sin scroll), tabla grid `grid-cols-[2fr_64px_110px_110px_44px]` (Acciones nunca truncado), 6 tests nuevos de invariantes (dialog size, min-h-0 chain, rows overflow, header/footer shrink-0, right column fixed, 40-row stress test); 48/48 tests, tsc/lint/prettier limpio
- [x] **C12-3g (§4+§16)** Fine-tuning real-browser (1366×653) — ✅ `ea3ecb9` `fix(pos): wider taller modal, one-line footer, credit-mode fit`: modal workspace `lg:h-[90vh] lg:w-[94vw] lg:max-w-[1180px]` (up from 85vh/92vw/1080px), footer UNA sola fila (Total + Cancelar + Crear venta inline, `py-3 px-4` compact), columna derecha compacta (labels `text-xs`, inputs `h-9`, `space-y-2`, "Crear cliente" `mb-0`) para que Modo de pago + Cuenta + Cliente + hint + Pago inicial + Fecha quepan sin scroll en viewport 650px alto, hint crédito amber-500 fijo en source (FormField skip default `text-zinc-500` cuando `hintClassName` presente — root-cause del gris), tabla grid `2fr_60px_110px_110px_48px` + `pr-2` en rows-container reserva espacio para scrollbar (Acciones nunca truncado, header/rows lockstep); FormField/Input/Select extienden con `labelClassName`; 53/53 tests (5 nuevos C12-3g), tsc/lint/prettier limpio
- [ ] **C12-4 (§8–9)** Categorías sugeridas LATAM — taxonomía + bulk create idempotente por workspace + superficie UX + tests
- [ ] **C12-5 (§6)** Limpieza orden frontend (sort por date DESC completo, no re-sort visual)
- [x] **C12-6 (§10)** DECISIÓN DEL FUNDADOR (2026-09-23): Clients y Catálogo quedan **solo-búsqueda sin filtros** (volumen beta, cards+debounce cubren el uso; reevaluar con crecida) — documento de decisión pendiente en FASE 8
- [ ] **C12-7 (FASE 3)** Docs: offline-architecture, PT-BR prep, COSTS-DESIGN, ANALYTICS-ROADMAP
- [ ] **C12-8 (FASE 1 offline)** Indicador offline + estados mínimos (sin cola financiera)
- [ ] **C12-9 (FASE 5–6)** Auditoría transversal §15–24 + correcciones derivadas
- [ ] **C12-10 (FASE 7)** Validación integral: tsc/lint/build/Vitest (timeout ≥ 45 min)/E2E/a11y
- [ ] **C12-11 (FASE 8–9)** Docs de cierre + informe final A-H + checklist 22 criterios (Cierre §29)

### Verificación

- Suite completa reglamentaria: `pnpm test` con timeout ≥ 45 min (2_700_000 ms)
- E2E flaky conocido (`destination stream closed early`, register limiter): rerun una sola vez
- Freeze: toque cero al dominio financiero salvo lo autorizado explícitamente para C12-2

## Cluster 10 — Beta round 4

### Phase B

- [x] **B1 — Same-day ordering (finding 5)** — `fix(movements)` commit f97ff6d
  - Multi-leg creation use cases (transfer, credit-granted add-abono with capital+interest split) give subsequent legs +1ms createdAt for deterministic same-day sorting.
  - Movement repository sorts append `_id: -1` as final tiebreaker (6 query sites: findByWorkspaceId, findPaged, findByAccountId, findByAccountIdForBalance, findByWorkspaceIdAndDateRange, findByWorkspaceIdForBalance).
  - Backfill script `scripts/backfill-movement-createdAt.mjs` recovers missing createdAt from ObjectId timestamp (dry-run by default, `--apply` to write). Dry-run executed: 0 movement docs missing createdAt.
  - Tests: transfers.test.ts and credits-granted.test.ts assert tiebreaker contract; movement-repository.test.ts asserts sort signature includes `_id: -1`.

- [x] **B2 — /clients hardening + live diagnosis (finding 1)** — `fix(clients)` commit 6414058
  - Client domain constructor uses null-safe trim for phone/email/note (`?? ""` before trim) to prevent TypeError on legacy docs with explicit null.
  - Clients page replaces `user.workspaceId!` non-null assertion with explicit guard: redirects to /login when workspaceId is absent.
  - **Diagnosis**: queried errorevents collection (2026-09-19 to 2026-09-22) — collection is empty (0 events). No client-related errors to investigate. Connection successful via MONGODB_URI from .env.local.

- [x] **B3 — Documentation** — this file
  - Cluster 10 Phase B tasks tracked with commit hashes and evidence lines.

### Verification

- `pnpm exec tsc --noEmit`: passed (no errors)
- `pnpm lint`: pre-existing warnings only; no new errors in touched files
- `pnpm exec prettier --check`: all touched files formatted correctly
- Targeted vitest: 113 tests passed (transfers, credits-granted, movement-repository)
- Backfill script dry-run: 0 movement docs missing createdAt

### Global form rules (from form_ventas.md, pending UX-DESIGN-SYSTEM consolidation)

> These rules extend beyond the sale form. Consolidate into `docs/UX-DESIGN-SYSTEM.md` in a later docs phase.

1. **Primary vs secondary button distinction**: primary actions use `variant="primary"` (filled blue); secondary actions use `variant="secondary"` (neutral background) or discreet text links. Never compete in color/weight.
2. **Labels once per table**: desktop tables render ONE header row with column labels; rows do NOT repeat labels. Mobile keeps stacked cards with labels (only affordance at narrow widths).
3. **Numeric right-aligned + thousands separator on blur**: numeric inputs (quantity, price, amount) use `text-right` alignment. Format with thousands separators on blur (display formatted, store raw); parse defensively (strip non-numeric, handle pasted formatted input).
4. **Trash neutral→red on hover**: delete/remove icons use neutral gray base (`text-zinc-400`/`text-zinc-500`); hover/focus transitions to destructive red (`hover:text-danger`). Maintains accessible focus treatment and ≥44px touch target.
5. **Total just above main action**: the TOTAL amount renders in prominent position (larger font, semibold) immediately before the footer action row (Cancelar + primary button).
6. **Dark-mode input resting border**: inputs in dark mode have a visible thin border (`dark:border-surface-border`) so interactive zones are delimited against the card background. Avoid ultra-low-contrast resting states.
7. **Faint-text legibility floor**: secondary hints/warnings must meet minimum legibility (avoid `text-zinc-300` on dark backgrounds). When a hint is a business-rule warning (e.g. "client required for credit"), raise it with warning tint (`text-amber-*`) and `font-medium`.
8. **Logical grouping flow**: form sections follow a linear flow (articles → payment/client → total → actions). Desktop grid positions sections for horizontal space use; mobile stacks in the same logical order.
