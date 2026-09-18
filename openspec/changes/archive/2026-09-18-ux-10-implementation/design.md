# Design: UX-10 — Final Implementation Sweep (§53 Remaining Steps)

## Technical Approach

UI-only implementation sweep in six ordered work units (S1..S6), one conventional commit each (S2 splits in two), all on `master`. The design philosophy is **honest scope, bounded diffs**: every sub-phase touches only files already enumerated in the proposal/specs, the frozen domain (`src/core/`, `src/infrastructure/`, Mongoose models) is untouched, and the UX-8 byte-identical surfaces and UX-9 a11y wiring are preserved as invariants.

All paths below were **re-anchored against the real tree on 2026-09-18**. Two corrections vs. the proposal were verified:

1. The sidebar nav lives at **`src/app/(main)/nav.tsx`** — NOT `src/components/nav.tsx` as the proposal states.
2. `verify-banner.tsx` lives at **`src/app/(main)/profile/verify-banner.tsx`** and `transfer-form.tsx` at **`src/app/(main)/transfers/transfer-form.tsx`** — NOT under `src/components/…` as the proposal's table implies.

The five BackButton call sites match proposal line numbers exactly (verified): `sale-list.tsx:103`, `catalog-list.tsx:42`, `payables-list.tsx:63`, `credits-received-list.tsx:59`, `credits-granted-list.tsx:63`. These are the only 5 importers of `src/components/ui/back-button.tsx` in the tree; the component itself becomes dead code — whether to delete it is deferred to UX-12 (deleting it is harmless but is not part of this change's approved scope; its file stays with zero importers).

### Slices

| Slice | Commit | Summary |
|-------|--------|---------|
| S1 | C1 `chore` | Commit the pending `feature5Title` i18n rename (already applied in the working copy, verified unstaged) |
| S2a | C2 `feat` | Nav four-tier restructure + group headers + Configuración group + footer relocation |
| S2b | C3 `refactor` | BackButton removal from the 5 root lists (H-14) |
| S3 | C4 `refactor` | Empty states: `clients`, `categories` per-section, `catalog-list` noResults dedup + exclusion register |
| S4a | C5 `refactor` | Two token-literal fixes (`transfer-form` danger, `button` inverse hover) |
| S4b | C6 `fix` | D6 contrast AA local sub-set (Button success, Toast info, Badge tints, modal close) |
| S5 | C7 `feat` | Extract `Alert` + migrate 4 danger banners + verify-banner info variant |
| S6 | C8 `feat` | Extract `FormField` (D8) + migrate the design-fixed field list (6 sites) |

## Architecture Decisions

### Decision: FormField component API and exact migration list (D8 — resolvable open item #1)

**Choice**: Create `src/components/ui/form-field.tsx` exporting a field-shell wrapper that centralizes the `htmlFor`/label/error/`aria-invalid`/`aria-describedby` wiring. API:

```tsx
interface FormFieldProps {
  /** Stable field id — reused for <label htmlFor>, hint id and error id. */
  id: string;
  label: string;
  required?: boolean;
  /** Dimmed label + disabled pass-through to the control (UX-4 DS:90). */
  disabled?: boolean;
  /** Validation error: renders adjacent as <p id="{id}-error" class="text-danger text-xs">. */
  error?: string;
  /** Neutral helper text, announced via aria-describedby (e.g. sale-form credit-client hint). */
  hint?: string;
  /** Single control element (Input, Select, raw <textarea>, …). Wiring is injected via cloneElement. */
  children: ReactElement;
}

export function FormField({ id, label, required, disabled, error, hint, children }: FormFieldProps) {
  // 1. Read the child's own aria-invalid / aria-describedby props (fallthrough semantics).
  // 2. Build hintId=${id}-hint / errorId=${id}-error.
  // 3. cloneElement(child, { id, required, disabled, "aria-invalid": childInvalid ?? (error ? true : undefined),
  //    "aria-describedby": join(hintId, errorId, child's original describedby fallback) })
  // 4. Render: <div> <label htmlFor={id} class matches ui/Input label class/> {control} {hint p} {error p} </div>
}
```

Implementation notes (mirrors `src/components/ui/input.tsx:21-47` conventions — identical label classes `mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300` and error classes `mt-1 text-xs text-danger`, id derivation `${id}-error`):

- Single-element children only (`Children.only` semantics via the `ReactElement` type) — wiring injected with `cloneElement`; consumer-passed `aria-invalid` wins over the error-derived flag (preserves the UX-9 manual-override path proven at `fields-a11y.test.tsx:118-123`).
- Explicit `id` is REQUIRED (unlike `Input`'s label-derived id heuristic) — sale-form line items use dynamic ids (`item-${idx}`) and the label-click heuristic is the exact anti-pattern D8 removes.
- No i18n inside the component: label/error/hint arrive pre-translated (label-agnostic, ConfirmDialog/MoneyActionConfirmation precedent; satisfies the "no human-language strings persisted" domain rule).

**Migration list — design-fixed, 6 field sites across 2 files** (bounded to SUBMISSION SURFACES whose markup contains hand-rolled label/aria plumbing NOT already handled by `Input`/`Select`):

| # | File / site | Current state | Migration |
|---|-------------|--------------|-----------|
| 1 | `src/app/(main)/pos/sales/sale-form.tsx:268-272` line-items header label | `<label>` with NO `htmlFor` (not a control label — stays a group caption, see below) | NOT wrapped (it is a section header with buttons, not a field) — it is inventoried here as a documented non-use |
| 2 | `sale-form.tsx:297-313` line-item ITEM column | idx-0 `<label>` without association to `item-${idx}` (a11y bug) | `FormField id={`item-${idx}`}` wrapping the existing `<Select>` (only idx 0 renders the label: FormField replaces the conditional `idx === 0` label with its own `label`, `aria-hidden` on duplicates — simpler: render `<FormField>` on every row and `showLabel={idx === 0}`? NO — see API note below) |

**API note (decided)**: the line-item pattern renders column headers only on the FIRST row. Two options were weighed: (a) an optional `hideLabel?: boolean` prop on FormField; (b) keeping the conditional in the form via `showLabel`. Decided: add optional **`showLabel?: boolean` (default `true`)**. When `false`, the `<label>` is replaced by `<span aria-hidden="true" className="mb-1 block text-sm font-medium …">{label}</span>` so the group column header stays visually aligned but is not duplicated to AT (exactly one `<label htmlFor>` exists per column, pointing at row 0's control). This keeps a single FormField API with zero per-idx branching in the form.

| # | Site | Migration |
|---|------|-----------|
| 2 | `sale-form.tsx` item column (`item-${idx}`) | FormField, label {t("item")}, showLabel={idx===0}, wrapping Select |
| 3 | `sale-form.tsx` qty column (`qty-${idx}`) | FormField, label {t("qty")}, wrapping Input |
| 4 | `sale-form.tsx` unitPrice column (`price-${idx}`) | FormField, label {t("unitPrice")}, wrapping Input |
| 5 | `sale-form.tsx:226-230` client-required hint block | FormField around the clientId `<Select>`, `hint={needsClient ? t("clientRequiredForCredit") : undefined}` — replaces the manual `aria-describedby="clientId-warning"` pairing (the paragraph id changes from `clientId-warning` to `clientId-hint`; wiring is now centralized, announcement behavior identical) |
| 6 | `sale-form.tsx:233-255` initialPayment block | FormField around the `<Input>` with `error={initialPaymentInvalid ? (parsedInitialPayment > total ? t("initialPaymentExceedsTotal") : tError("invalidData")) : undefined}` — replaces the currently UNASSOCIATED error `<p>` (`sale-form.tsx:247-253`, no id, no aria binding today) with the `${id}-error`.RowStyle. The Input's own `error`-prop border styling is NOT used (FormField owns the error text; the input gets `aria-invalid` injected, and `aria-describedby` follows) |
| 7 | `src/components/feedback/feedback-widget.tsx:116-133` message textarea | The only submission form with hand-rolled `<label htmlFor>` + raw `<textarea>` — wrap in FormField (`id="feedback-message"`, label, required) — byte-identical copy (keys `messageLabel`/`messagePlaceholder` untouched) |

That is **6 real FormField usages (5 in sale-form, 1 in feedback-widget)** — matching the approved DS figure "~6 usos" exactly.

**Excluded, with rationale** (bounded-diff discipline; recorded here, blocked from a silent "migrate everything"):
- The 9 submission forms using `Input`/`Select` exclusively (`movement-form`, `transfer-form`, both credit forms, client-form, account-form, payable-form, category-form, profile-form, abono/edit forms, catalog-form) do NOT migrate: their label/error/aria wiring is already centralized at the control-component level (UX-9 delivered it, pinned by `src/components/ui/__tests__/fields-a11y.test.tsx`). Passing them through a second wrapper would duplicate the pattern, not centralize it.
- The 21 hand-rolled `<label htmlFor>` filter-selectors in list surfaces (`movements-list.tsx:263,283,304`, `transfers-list.tsx:91,102`, `payables-list.tsx:101-138`, `credits-{received,granted}-list.tsx`, `sale-list.tsx:162-199`): they are filter bars, not submission forms; their associations are correct today; migrating them would blow the bounded diff and touch surfaces UX-10 only reaches for BackButton/noResults. **Deferred to UX-12** (FilterBar extraction candidate, DS §10) — recorded, not silent.

**Alternatives considered**: (1) Refactor `Input`/`Select`/`PasswordInput` to compose FormField internally — rejected: touches three UX-9-pinned components for zero visible user value while fields-a11y tests pin their exact DOM; higher regression risk than value. (2) Children-as-function API — rejected as foreign to the codebase's plain-function component style. (3) Render-prop/context — same objection.

**Placement & barrel**: `src/components/ui/form-field.tsx` + barrel export in `src/components/ui/index.ts`.

### Decision: /help shell placement (DEC-IA-10 — open item #2)

**Choice**: KEEP `/help` at `src/app/help/page.tsx` (standalone route outside `(main)`), link it from the Configuración group. No route move.

**Rationale** (verified): `src/app/help/page.tsx` is a self-contained server component with its own header/footer shell (`getT('Help')` at line 23 cited in the orchestration brief — verified, plus a landing-legal footer nav). Moving it under `(main)` would: (1) couple a public informational page to the authenticated `(main)/layout.tsx` + `MainNav` (behavior change out of scope); (2) force a route migration risk for zero presentational gain; (3) diverge from the existing pattern that `/privacy`, `/terms`, `/cookies` (the `(legal)` group) are also standalone full-page routes linked from context. The spec requires only that Ayuda APPEARS in the Configuración group — a `<Link href="/help">` nav item satisfies it; active-state `pathname.startsWith("/help")` works unchanged. The page's content, `getT('Help')` usage, and standalone shell are untouched.

**Alternatives considered**: relocating under `(main)` (rejected above). When UX-12 revisits IA, the option stays open — recorded here as the decision trail.

### Decision: Nav tier structure (DEC-IA-02/03/04/10 — open item #3)

**Choice**: Replace the flat `NAV_ITEMS` + `"separator"` sentinels + `<hr>` rendering (`src/app/(main)/nav.tsx:39-54`, `211-217`) with a grouped data model:

```tsx
interface NavItem { href: string; key: string; icon: LucideIcon; color: string }

const NAV_GROUPS: readonly {
  headerKey: string | null;          // null → Tier 1, no header
  items: readonly NavItem[];
}[] = [
  { headerKey: null,               items: [ /* Tier 1 — Comprensión */ ] },
  { headerKey: "groupOperation",   items: [ /* Ventas, Cuentas, Clientes */ ] },
  { headerKey: "groupCommitments", items: [ /* Créditos otorgados, Créditos recibidos, Cuentas por pagar */ ] },
  { headerKey: "groupSettings",    items: [ /* Productos, Categorías, Mi perfil, Comentarios, Ayuda */ ] },
];
```

with `ANALYTICS_NAV_ITEM` (`nav.tsx:59-64`) appended as the last item of the Compromisos group's item array when `canViewAnalytics` is true (Replaces `buildNavItems`'s separator-append at `nav.tsx:70-73`; the conditional-analytics behavior and R13-G comment are PRESERVED — the tier list is pure data over it).

Concrete mapping (icons/colors preserved from the current items; reorder only):

- **Tier 1 (no header)**: `/dashboard` (LayoutDashboard, text-primary), `/movements` (List, text-zinc-600 dark:text-zinc-400)
- **Tier 2 — "Operación"**: `/pos/sales` (ShoppingCart, text-income → "Ventas"), `/accounts` (Landmark, text-info), `/clients` (Users, text-info)
- **Tier 3 — "Compromisos"**: `/credits/granted` first ("por cobrar" first per DEC-IA-02, Landmark, text-expense), `/credits/received` (CreditCard, text-income), `/payables` (Receipt, text-warning), conditional `/analytics` (BarChart3, text-violet-500) last
- **Tier 4 — "Configuración"**: `/pos/catalog` (Package, text-brand-gold), `/categories` (Tag, text-brand-gold), `/profile` (User icon, moved from footer `nav.tsx:258-268`), `/feedback` (MessageSquare icon, moved from footer `nav.tsx:269-283`), `/help` (LifeBuoy icon, new)

Note: `/transfers` LEAVES the nav — the current `nav.tsx:45` item is absent from the approved four-tier IA (`docs/UX-INFORMATION-ARCHITECTURE.md` §38 tier table lists no transfers entry). The `/transfers` route remains reachable (Movimientos/New Transfer entry, unchanged). The Nav.transfers i18n key stays in `messages/*.json` untouched (still referenced by Movements surface — no usage-test breakage).

**Rendering rules preserved from the current implementation** (`nav.tsx:208-249`): same `<nav className="flex-1 overflow-y-auto px-2 py-3 lg:px-2 lg:py-2">` + `<ul className="space-y-0.5 …">` skeleton; items render identical `<Link>` markup with `aria-current="page"`, exact-match `/dashboard` vs prefix-match active logic (`nav.tsx:218-221`, lifted verbatim), TouchTarget wrapper, active classes `bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary`. First-link ref (`firstLinkRef`, focus trap entry point at `nav.tsx:121,226`) attaches to the FIRST link of the list — `/dashboard` — preserving the `nav.test.tsx:140` invariant. Group headers render as `<li aria-hidden="false"><span className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 lg:pt-3">{t(headerKey)}</span></li>` — visually discreet, NOT focusable (spans, not buttons/links) so the drawer Tab-cycle math (nav.test S3.1) is unaffected. The `<hr>` separator branch is deleted entirely.

**Perfil/Comentarios migration mechanics (DEC-IA-10)**: Profile becomes a regular `<Link href="/profile">` item in Tier 4 (reuses existing `Nav.profile` key, User icon). Comentarios has NO route — it is a button wired to `FeedbackDialog` + `submitFeedbackAction` server action (`nav.tsx:269-283`, `FeedbackDialog open={feedbackOpen}` at `nav.tsx:368`). Design: keep it a `<button type="button">` rendered INSIDE the Tier 4 `<ul>` with the exact same visual/nav-item classes and TouchTarget as link items (existing footer button classes reused), preserving `onClick={setOpen(false); setFeedbackOpen(true)}`, the `aria-label={t("feedback")}`, and the dialog wiring — server-action coupling untouched. A `/feedback` route would be an invented route (out of scope, DEC-IA-09 spirit applies to reports only but the same honesty rule holds: no invented routes).

**Footer after relocation** contains ONLY: email display (`nav.tsx:253-256`), theme toggle, language toggle, Salir + ConfirmDialog (`nav.tsx:284-310`) — DEC-IA-11 closed-state invariant preserved.

**i18n keys** (namespace `Nav`, es/en; neutral Spanish, no voseo):

| Key | es | en | Status |
|-----|----|----|--------|
| `groupOperation` | `Operación` | `Operations` | NEW both |
| `groupCommitments` | `Compromisos` | `Commitments` | NEW both |
| `groupSettings` | `Configuración` | `Settings` | NEW both |
| `help` | `Ayuda` | `Help` | NEW both (no Nav.help exists today) |
| `posCatalog` | `Productos` | `Products` | VALUE rename (from `Catálogo POS`) |
| `posSales` | `Ventas` | `Sales` | VALUE rename (from `Ventas POS`) |
| `profile`, `feedback` | `Mi perfil`, `Comentarios` | `My profile`, `Feedback` | EXISTING, reused for group items |

Decision: keep semantic keys `posCatalog`/`posSales` unchanged (only values rename) — zero key churn, `pnpm parity` and the messages-usage test stay green; key-name cosmetics are not worth a byte-diff in two locale files' history. Recipient surfaces elsewhere reuse `Referral`-style keys only via `Nav.*` lookups in nav itself.

**Alternatives considered**: nav-links array with mixed separators (status quo, rejected — that is the debt being removed); collapsible Tier 4 on mobile (IA doc suggests it — OUT of scope for UX-10: interaction-model change with responsive risk, superficially similar to DEC-IA-04 but not in the approved slice; recorded as UX-12 candidate).

### Decision: H-10 exclusion register (open item #4) — where it lives

**Choice**: Two-layer register: (1) the full documented table lives in this design doc (§ Migration/Rollout below — "H-10 Exclusion Register"); (2) each of the four sites gets a 1–3-line source comment AT the sub-state referencing the decision trail — `H-10 EXCLUSION (UX-10): …rationale - see openspec/changes/ux-10-implementation/design.md`. Code comments are the discoverable marker for future phases (UX-12 N1/minimalism passes) — a future grep for "H-10 EXCLUSION" finds every intentional sub-state. Verified real sites:

- `src/components/dashboard/dashboard-content.tsx:339-344` — `noAccountsMessage` inside the accounts Card.
- `src/components/dashboard/summary-table.tsx:41-42` — `emptyMessage` prop `<p>`.
- `src/components/dashboard/summary-hero.tsx:86-88` — zero-currency dash `<p>—</p>`.
- `src/app/(main)/global-movement-provider.tsx:212-215` — `noAccounts` inline `<p>` inside the modal host.

### Decision: Alert component API (open item #5)

**Choice**: `src/components/ui/alert.tsx` — presentational, no state, following `empty-state.tsx`/`button.tsx` plain-function patterns:

```tsx
interface AlertProps {
  variant: "danger" | "info";
  title?: string;                  // optional bold lead line (verify-banner needs two text lines)
  children: React.ReactNode;       // message body (i18n-resolved by caller)
  action?: React.ReactNode;        // optional right-side action slot (verify-banner resend button)
}

const variantStyles = {
  danger: "rounded-md bg-danger/10 text-danger",
  info:   "rounded-md bg-info/10 text-info dark:bg-info/15 dark:text-info-light*", // see Contrast note
} as const;
```

- Shell: `<div role={title ? "alert" : undefined} className="flex items-center justify-between gap-3 p-3 text-sm">` — when a `title` exists, render `<p className="font-medium">{title}</p><p className={...}>{children}</p>` left block + `{action}` right; without title it renders single-message (the 4 migrated banners are title-less so the DOM delta per site is minimal). `role="alert"` only for danger (live announcement of form errors); info renders polite (no role spam on page-load banners).
  Actually — decided: `role="alert"` on danger always (matches today's error-surfacing intent; background form-error banners), plain div for info.
- Icon: lucide via the `Icon` wrapper (`src/components/ui/icon.tsx`, consistent with toast.tsx:65 & nav.tsx): `danger → AlertCircle`, `info → Info`, `size="sm"`, colored by the variant text class.
- `pnpm parity` untouched: all five migrated banners are BY COPY byte-identical (existing keys, verified sites). Pilot copy check: `sale-form.tsx:161-163` renders `translateError(state.error)`; that call, the trigger conditions and the i18n keys are untouched — ONLY the wrapper element + classes change.

**Migration mapping** (verified real line anchors):
| File | Current | Target |
|------|---------|--------|
| `src/app/(main)/pos/sales/sale-form.tsx:160-164` | `<div className="rounded-md bg-danger/10 p-3 text-sm text-danger">{translateError(state.error)}</div>` | `<Alert variant="danger">{translateError(state.error)}</Alert>` |
| `src/app/(main)/pos/sales/sale-detail-modal.tsx:75-79` | `<p className="rounded-md bg-danger/10 p-3 text-sm text-danger">{tError(...)}</p>` | `<Alert variant="danger">…</Alert>` |
| `src/app/(main)/pos/sales/abono-form.tsx:102-106` | div danger banner | `<Alert variant="danger">` |
| `src/app/(main)/pos/catalog/catalog-form.tsx:70-74` | div danger banner | `<Alert variant="danger">` |
| `src/app/(main)/profile/verify-banner.tsx:36-46` | amber ad-hoc banner (title/description + resend Button, `sendVerification` flow via `resendVerificationAction` at :27-34) | `<Alert variant="info" title={title} action={<Button variant="secondary" size="sm" …>{resend}</Button>}>{description}</Alert>` — copy (`title`/`description`/`resend` props, caller-supplied translated strings) and trigger (`VerifyBanner` render condition, caller-controlled) byte-identical; the resend button keeps its exact handlers. Appearance change amber→info token palette is accepted (spec-mandated) |

**Out (deferral)**: `ErrorState` NOT created — `src/app/*/error.tsx` surfaces are 1 real use; documented here + in the alert spec; ErrorState is a UX-12 candidate if error.tsx usage grows.

**Placement**: `src/components/ui/alert.tsx` + barrel export `src/components/ui/index.ts` + test file (below).

**Note on scope discipline**: three additional `bg-danger/10` banners exist OUT of spec scope in `(auth)` surfaces (`auth-form.tsx:48`, `forgot-password-form.tsx:27`, `reset-password-form.tsx:27`) — NOT migrated (the spec pins exactly 4 danger sites); recorded as UX-12 backlog candidates.

### Decision: Contrast AA local sub-set classes (D6 — open item #6) — exact before→after

All four changes are LOCAL; zero `--tc-*` token edits (guard: `git diff src/app/globals.css` token block must be empty).

| Component | Before (verified) | After | Result |
|-----------|-------------------|-------|--------|
| `src/components/ui/button.tsx:19-20` `success` | `bg-success text-white hover:bg-success/90 focus:ring-success` | `bg-teal-700 text-white hover:bg-teal-800 focus:ring-success` | white-on-teal-700 ≈ 4.66 ≥ 4.5 (was 3.65). teal sits in the same hue family as `--tc-success` (`oklch 0.596 0.145 163`), so the brand hue continuity holds; dark mode same values (white-on-teal is theme-independent for the text/bg pair) |
| `src/components/ui/toast.tsx:22` `info` | `bg-info text-white` | `bg-blue-700 text-white` | ≈ 5.2 ≥ 4.5 (was 3.17). Toast `success`/`error`/`warning` stay untouched (Toast success pending for UX-12; toast dismis­ser `hover:bg-white/20` unchanged — no microcopy key touched, UX-8 freeze safe because keys live in messages, not classes) |
| `src/components/ui/badge.tsx:11-15` | `bg-{variant}/10 text-{variant}` (success/danger/warning/info/debt) | `bg-{variant}/10 text-zinc-900 dark:text-zinc-100` for success/info/warning; `bg-danger/10 text-danger dark:text-danger/90`→ `text-zinc-900 dark:text-zinc-100` too -- uniformly: all tinted variants → `text-zinc-900 dark:text-zinc-100` | neutral 900/12px text on any `/10` tint over card ≈ ≥ 7:1 in light, ≥ 8:1 in dark (was 1.74–2.92). Hue identity carried by the pill's tinted background; raises contrast for ALL five variants uniformly (spec calls this "visible pill contrast increase — accepted appearance change") |
| `src/components/ui/modal.tsx:86` close button | `text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300` | `text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300` | light icon 2.16 → 4.07 ≥ 3:1 non-text; dark-mode value preserved EXACTLY via explicit `dark:text-zinc-400` |

Wait — Badge `danger`: it is also used to show negative/debt semantics where `text-danger` hue matters for meaning (danger = negative badge). Decision above already moves ALL bundled variants to neutral text — the hue meaning remains via bg tint. If apply-time review shows the neutral-text option regresses readability contextually, the fallback within-spec alternative is tint opacity raise (`/10` → `/20`) + darker variant text (`text-emerald-700`, `text-sky-700`, `text-rose-700`, `text-amber-700`, `text-neutral-700`-debt) — takes precedence per-variant ONLY if a usage R-REVIEW flags it; default remains the uniform neutral-text option.

**Constraint hold-fast**: Toast microcopy KEYS byte-identical (UX-8) — S4b touches classes only; `src/i18n/messages-toast-microcopy.test.ts` remains green untouched.

### Decision: Token-literal fixes (open item #7)

- `src/app/(main)/transfers/transfer-form.tsx:376`: `text-red-600 dark:text-red-400` → `text-danger` (the dd inside the transfer summary). `--tc-danger` IS the red token (oklch 0.577 0.245 27.325); dark-mode guarantee holds because `text-danger` maps to the same `--color-danger` in both modes (globals.css:49).
- `src/components/ui/button.tsx:26` `inverse`: `bg-white text-primary hover:bg-indigo-50 focus:ring-primary dark:bg-white dark:text-primary` → replace `hover:bg-indigo-50` with `hover:bg-primary/10` (indigo-white tint ≈ `primary` at 10% over white — the codebase's endorsed hover-tone-percentage pattern is used elsewhere: nav active `bg-primary/10` at nav.tsx:231, success IconButtons `hover:bg-success/10` at action-icon-button.tsx:34). DEC-DS-03 brand discipline: brand accents from primary, no raw indigo literal.

### Decision: Work-unit commit plan (open item #8)

| # | Slice | Commit message | Files |
|---|-------|----------------|-------|
| C1 | S1 | `chore(i18n): commit feature5Title rename pending in tree (H-07 periphery)` | `messages/es.json`, `messages/en.json` |
| C2 | S2a | `feat(nav): four-tier sidebar with group headers and Configuración group` | `src/app/(main)/nav.tsx`, `messages/es.json`, `messages/en.json` |
| C3 | S2b | `refactor(nav): remove BackButton from the five root list pages (H-14)` | `src/app/(main)/pos/sales/sale-list.tsx`, `…/pos/catalog/catalog-list.tsx`, `…/payables/payables-list.tsx`, `…/credits/received/credits-received-list.tsx`, `…/credits/granted/credits-granted-list.tsx` |
| C4 | S3 | `refactor(empty-states): unify clients, categories sections and catalog noResults onto EmptyState (H-10 residue)` | 3 surface files + `dashboard-content.tsx`/`summary-table.tsx`/`summary-hero.tsx`/`global-movement-provider.tsx` (comment-only H-10 exclusion markers) |
| C5 | S4a | `refactor(tokens): replace raw red/indigo color literals with design tokens (DEC-DS-01/03)` | `src/app/(main)/transfers/transfer-form.tsx`, `src/components/ui/button.tsx` (inverse line only) |
| C6 | S4b | `fix(contrast): AA local sub-set — Button success, Toast info, Badge tints, modal close (D6)` | `src/components/ui/button.tsx`, `toast.tsx`, `badge.tsx`, `modal.tsx` |
| C7 | S5 | `feat(ui): extract Alert component and migrate five banner surfaces (DEC-DS-06)` | NEW `src/components/ui/alert.tsx`, `src/components/ui/index.ts`, NEW `src/components/ui/ui-alert.test.tsx` (or `__tests__/alert.test.tsx`), `sale-form.tsx`, `sale-detail-modal.tsx`, `abono-form.tsx`, `catalog-form.tsx`, `verify-banner.tsx`, `sale-form.test.tsx` (if DOM assertions need it) |
| C8 | S6 | `feat(ui): extract FormField and migrate six field sites (D8) + D7 decision record (see design)` | NEW `src/components/ui/form-field.tsx`, `src/components/ui/index.ts`, NEW `src/components/ui/__tests__/form-field.test.tsx`, `sale-form.tsx`, `src/components/feedback/feedback-widget.tsx`, plus `docs:` note in change folder if any decision text needs to move from design doc to tasks (apply-time) |

D7 record lives in this design doc (committed with the change folder to the repo, so the record exists in-tree — satisfies the spec's "decision artifact in the design documentation" requirement); its commit gate is docs-only (tsc/lint minimum). No separate C9 planned; if apply needs a docs touch-up it adds `docs(ux-10): decision trail fixes` at phase end.

IBM-freeze guardrails honored: C1 isolates pre-existing i18n diff before C2's i18n renames (spec S1.2 scenario "S2 diff contains only S2-related keys"). C6 independent from C5 so a D6 visual regression reverts alone. C3 reverts alone.

## Data Flow

All presentational; no data flow changes. The only "flow" note is nav rendering and FeedbackDialog wiring:

```
            ┌────────────────────────────────────────────┐
            │ MainNav (src/app/(main)/nav.tsx)           │
            │                                            │
            │ isLoggedIn ? renderNavGroups() : guestShell │
            │                                            │
            │ NAV_GROUPS (Tier1..4)                       │
            │   └─ header span (i18n Nav.group*)          │
            │   └─ <Link|button> + TouchTarget + aria-…    │
            │                                            │
            │ footer: email + theme + lang + Salir ──┐    │
            └────────────────────────────────────────┼────┘
  Comentarios (nav item, Tier 4) ──setFeedbackOpen──▶ FeedbackDialog
      (nav footer relocates it into the group;          │
       server action submitFeedbackAction ─────────────┘
       inside /feedback/actions.ts, unchanged)
```

Form rendering through FormField (new):

```
sale-form.tsx ─ uses ─▶ FormField (ui/form-field.tsx)
                          │  label htmlFor=id
                          │  cloneElement(child, aria-invalid / aria-describedby ids)
                          ├─▶ Select (line-item) / Input (initialPayment) / raw textarea (feedback)
                          └─ error <p id="{id}-error"> / hint <p id="{id}-hint">
```

Payment/banner rendering:

```
form state.error ──▶ <Alert variant="danger">translateError(...)</Alert>
profile unverified ─▶ <VerifyBanner> ─▶ <Alert variant="info" title action=resend>
```

No server↔client boundary changes; VerifyBanner's `title/description/resend` remain caller-translated strings (plain objects).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `messages/es.json`, `messages/en.json` | Modify | S1: feature5Title already renamed (commit working copy); S2: Nav value renames `posCatalog`/`posSales` + NEW `groupOperation`/`groupCommitments`/`groupSettings`/`help` |
| `src/app/(main)/nav.tsx` | Modify | NAV_GROUPS data model (replacing flat NAV_ITEMS + separators), group-header `<li>` rendering, footer relocation (profile+feedback→Tier 4), new LifeBuoy import (help), analytics conditional into Compromisos group. All drawer/inert/trap/Escape/first-link/TouchTarget logic preserved verbatim |
| 5 root-list files (see C3) | Modify | Delete `<BackButton />` lines (`sale-list.tsx:103`, `catalog-list.tsx:42`, `payables-list.tsx:63`, `credits-received-list.tsx:59`, `credits-granted-list.tsx:63` + each import line) |
| `src/app/(main)/clients/page.tsx` | Modify | Lines 39-46 → `<EmptyState icon={<Icon icon={Users} size="xl"/>} title={t("noClients")} description={t("emptyDescription")}/>` (keys exist — no i18n churn) |
| `src/app/(main)/categories/page.tsx` | Modify | `CategorySection` empty branch (lines 69-79) → per-section `<EmptyState icon={<Icon icon={Tags} size="lg"/>} title={emptyMessage}/>` keeping `noIncome`/`noExpense` semantics intact (message promoted from `<p>` to EmptyState title; same key, parity untouched) |
| `src/app/(main)/pos/catalog/catalog-list.tsx:85-92` | Modify | Results `<p>` loses the `: t('noResults')` branch (counter renders only when filteredItems.length > 0; zero-match emptiness shows the existing EmptyState at 102-106 exclusively) — plus `<BackButton/>` removal in C3 |
| `src/app/(main)/transfers/transfer-form.tsx` | Modify | Line 376 literal → `text-danger` |
| `src/components/ui/button.tsx` | Modify | `inverse` hover literal → `hover:bg-primary/10` (C5) and `success` variant AA fix (C6) |
| `src/components/ui/toast.tsx` | Modify | `info` variant class (C6) |
| `src/components/ui/badge.tsx` | Modify | Tinted-variant text classes (C6) |
| `src/components/ui/modal.tsx` | Modify | Close icon `zinc-400→zinc-500` (C6) |
| `src/components/ui/alert.tsx` (NEW) | Create | Alert component (danger/info variants) |
| `src/components/ui/index.tsx` (`index.ts`) | Modify | Export Alert and FormField |
| `src/app/(main)/pos/sales/sale-form.tsx` | Modify | Banner → Alert (C7); FormField migration of 5 field sites (C8) |
| `src/app/(main)/pos/sales/sale-detail-modal.tsx` | Modify | Banner → Alert (C7) |
| `src/app/(main)/pos/sales/abono-form.tsx` | Modify | Banner → Alert (C7) |
| `src/app/(main)/pos/catalog/catalog-form.tsx` | Modify | Banner → Alert (C7) |
| `src/app/(main)/profile/verify-banner.tsx` | Modify | Amber ad-hoc → shared Alert info variant (C7) |
| `src/components/ui/form-field.tsx` (NEW) | Create | FormField field-shell component (D8) |
| `src/components/feedback/feedback-widget.tsx` | Modify | Message textarea → FormField (C8) |
| `src/components/dashboard/dashboard-content.tsx` | Modify | Comment-only: H-10 exclusion note at the empty-accounts card |
| `src/components/dashboard/summary-table.tsx` | Modify | Comment-only H-10 exclusion note |
| `src/components/dashboard/summary-hero.tsx` | Modify | Comment-only H-10 exclusion note |
| `src/app/(main)/global-movement-provider.tsx` | Modify | Comment-only H-10 exclusion note |
| `src/components/ui/__tests__/alert.test.tsx` (NEW) | Create | Alert render tests |
| `src/components/ui/__tests__/form-field.test.tsx` (NEW) | Create | FormField a11y wiring tests |
| `src/components/ui/__tests__/nav.test.tsx` | Modify | Add DEC-IA-02/03 tier/structure assertions (see Testing Strategy) |
| `src/core/`, `src/infrastructure/`, Mongoose models | **None** | Frozen — `git diff --stat` scope check per slice |

## Interfaces / Contracts

### Alert

```tsx
type AlertVariant = "danger" | "info";

interface AlertProps {
  variant: AlertVariant;
  title?: string;            // optional bold lead
  children: React.ReactNode; // message body (pre-translated)
  action?: React.ReactNode;  // optional trailing visual (button/link)
}
```

Class contract: `danger → "flex items-center justify-between gap-3 rounded-md bg-danger/10 p-3 text-sm text-danger"`, `info → "… bg-info/10 … text-info dark:bg-info/15 dark:text-info-soft"` — the exact `bg-danger/10 text-danger` residue pattern from the four inlined sites (`sale-form.tsx:161`, `sale-detail-modal.tsx:76`, `abono-form.tsx:103`, `catalog-form.tsx:71`) and the info analog for verify-banner (amber tones ⇄ info token — appearance change per spec). `{title, description}` two-line layout in verify-banner is composed through the optional `title` + `children` pair; the resend `Button` sits in `action`.

### FormField (D8)

```tsx
interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  showLabel?: boolean;      // default true; false → aria-hidden column header (line-item rows 1+)
  children: ReactElement;   // exactly one control (Input | Select | textarea | raw element)
}
```

Rendered DOM shape (parity with ui/Input internals):

```html
<div>
  <label for="{id}" class="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
  {control /* id, disabled, required, aria-invalid?, aria-describedby="{id}-hint {id}-error"? */}
  <p id="{id}-hint" class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">…</p>   <!-- optional -->
  <p id="{id}-error" class="mt-1 text-xs text-danger">…</p>                       <!-- optional -->
</div>
```

Purity rules: no i18n imports, no server coupling, no context — fully serializable plain component. All wiring, including `showLabel=false`'s decorative header, stays inside FormField — the migrated forms contain ZERO hand-rolled `htmlFor`/`aria-describedby`/`aria-invalid` plumbing for these sites (spec acceptance).

## Testing Strategy

Test-file layout follows the verified repo pattern: UI component tests live in `src/components/ui/__tests__/` (mixed `renderToStaticMarkup` non-interactive + `jsdom` mounted variants), page/module tests colocated. Execution: prefer FILTERED runs during apply (`pnpm test src/components/ui src/app/(main)/pos`, plus other affected dirs) and full `pnpm test` with **explicit timeout ≥ 2_700_000 ms** as regulatory. There are no E2E additions; existing Playwright suites must stay green if executed in verify.

| Layer | What to Test | Approach / File |
|-------|-------------|-----------------|
| Unit (DOM, static) | Alert: danger renders banner classes + AlertCircle icon + role="alert"; info variant renders without role and honors `title`/`action`; copy flows through `children` | NEW `src/components/ui/__tests__/alert.test.tsx` (renderToStaticMarkup, mirrors `fields-a11y.test.tsx` style) |
| Unit (DOM, static) | FormField: `for={id}` / `id={id}` association; error → `aria-invalid="true"` + `aria-describedby` includes `{id}-error`; no error → neither attribute; hint → adorned-describedby; `showLabel=false` renders exactly one `<label>` per visible group; disabled prop reaches the control; consumer `aria-invalid` passthrough (parity with `fields-a11y.test.tsx:118-123`) | NEW `src/components/ui/__tests__/form-field.test.tsx` |
| Unit (DOM, jsdom) | Nav groups: assert EXACT tier/head order — Resumen(/dashboard) & Movimientos before any group header; header spans for keys `groupOperation`/`groupCommitments`/`groupSettings` appear before their group's first link; `/help` link exists inside Configuración group; footer contains email/theme/lang/logout but NO `/profile` link or feedback button; feedback button inside the group still opens feedback state (FeedbackDialog mocked); `aria-current` only on the active-route item; first focusable anchor is `/dashboard`; analytics last-in-Compromisos iff `canViewAnalytics` | UPDATE `src/components/ui/__tests__/nav.test.tsx` (its mocks are reusable — `useT` returns the key so structure asserts are key-name-based and locale-independent; keeps mocking UX-9 invariants intact) |
| Unit (existing suites — MUST stay green) | BackButton removal (`sale-list`, `catalog-list`, `payables-list`, `credits-received-list`, `credits-granted-list` suites), banner→Alert surfaces (`sale-form.test.tsx:1-163` exists, will be updated in-commit if it asserts on the banner DOM shape), messages-parity/messages-usage/messages-toast-microcopy + aria-literal-guard suites (`src/i18n/*.test.ts` — the S2 renames/trims are exercised here), movements/transfer/credits form suites | `pnpm test` (filtered paths first: `pnpm test src/components src/app/(main)/pos "src/app/(main)/credits" src/app/(main)/payables src/app/(main)/clients src/app/(main)/categories src/app/(main)/transfers src/i18n` — full suite at verify) |
| Integration | Full Vitest suite at slice gates AND phase end — zero domain code touched, so the §47 financial regression checklist (dashboard metrics, transfer≠expense, Payable/payments accounting, credit-granted abono/interest/write-off) is verified entirely via existing db/infrastructure suites | `pnpm test` with command timeout ≥ 2_700_000 ms, serial replset per config |
| E2E | Not expanded (out of scope) | Existing Playwright suite must stay green in verify gates |
| Manual gates per slice | Responsive 375/768/1280 px (nav drawer + headers; forms' label/error; banners on mobile), a11y spot check (aria-current per route, form label/error announcements, banner semantics), `git diff --stat` scope check (zero `src/core`/`src/infrastructure` entries), `pnpm parity` for all i18n-touching slices (C1, C2) | §46 checklist |

## Threat Matrix

N/A — no routing/shell/subprocess/VCS/PR-automation/executable-file classification/process-integration boundary. Presentation-only React component and CSS-class changes: no new routes (including no `/reports`), no shell commands, no process integration. `git` usage is limited to conventional commits following repo policy (no automation designed here).

## Migration / Rollout

No data migration, no feature flags, no phasing beyond the commit ordering (C1 must precede C2's `messages/*.json` edits; C6 reverts independently of C5). Rollback is per-commit `git revert` in reverse order — everything is presentational + i18n strings; no state to unwind. `src/components/ui/back-button.tsx` remains in-tree with zero importers after C3 — dead-code removal is deferred to UX-12 (not invented into this clean scope).

## D7 decision record (pos-sale-confirmation)

**Decision (D7, founder-approved 2026-09-18): POS sale creation gets NO informed confirmation.** No confirmation modal is added; `sale-form.tsx` creation proceeds directly on submit, exactly as today. Delete-sale and cobro confirmations delivered in UX-6 (MoneyActionConfirmation surfaces) remain untouched.

**Rationale, complete per spec**:
1. **Create-flow parity**: POS sale creation is treated the same as movement and account creation, which have no informed confirmation — introducing a confirmation only for this one create flow would be inconsistent microcopy/pattern.
2. **Non-destructive nature**: create is not destroy — it does not irreversibly remove data; the financial risk profile of a create (correctable/editable downstream) is materially different from a delete or a large irreversible payment event.
3. **Existing confirmations preserved**: delete-sale and cobro (payment collection) KEEP their MoneyActionConfirmation-style gates (UX-6 deliverable) — they remain the destructive/high-stakes flows; sale creation does not match that risk bar.

Also: **D8 decision (2026-09-18): EXTRACT FormField NOW** — the approved decision, whose exact component contract and fixed migration list are decided above. Both records live in this doc's repository-committed change folder.

**ErrorState deferral** (alert capability): recorded — error.tsx has 1 real in-tree surface; the 2+ threshold fails; ErrorState stays a UX-12 candidate.

## H-10 Exclusion Register (empty-state-consistency)

| Site | Verified location | Exclusion rationale |
|------|-------------------|---------------------|
| Dashboard accounts card | `src/components/dashboard/dashboard-content.tsx:339-344` (`noAccountsMessage` inside Card) | N1 dashboard minimalism — a full EmptyState with icon+action would fight the dashboard's compact grid language; the inline one-line Card text is the approved N1 pattern |
| Category summary table | `src/components/dashboard/summary-table.tsx:41-42` (`emptyMessage` prop) | N1 dashboard minimalism — the summary blocks live inside a bordered table shell where a big centered EmptyState would misalign the panel rhythm |
| Summary hero zero currency | `src/components/dashboard/summary-hero.tsx:86-88` (`<p>—</p>` zero-currency) | N1 dashboard minimalism — a bare `—` is the intentional zero-dash visual convention of the hero (deliberate typography, not a missing state) |
| Global movement provider modal hint | `src/app/(main)/global-movement-provider.tsx:212-215` (`noAccounts` <p>) | Inline contextual pre-content hint inside the movement modal, not a list surface empty state — EmptyState's centered iconography would misrepresent the "you need an account first" guidance as a page-level empty state |

Register persistence: full table HERE (this doc, versioned with the change), plus the `H-10 EXCLUSION (UX-10): …` source comments added at each of the four sites in commit C4. Future phases (UX-12) find it either by reading this doc or by grepping the sites.

## Open Questions

- [x] D6 contrast sub-set — RESOLVED (founder-approved local sub-set; documented above). Deferred residue: global `--tc-*` correction → UX-12 (recorded; `git diff` on the globals.css token block must stay empty as the enforcement gate).
- [x] D7 POS sale-creation confirmation — RESOLVED: no confirmation UI; rationale recorded above.
- [x] D8 FormField — RESOLVED: extract now; API + 6-site migration list fixed above.
- [x] FormField exact form list — RESOLVED (open item #1): 5 sites in `sale-form.tsx` + 1 in `feedback-widget.tsx`; filter-bar labels deferred to UX-12.
- [x] /help placement — RESOLVED: keep standalone route (`src/app/help/page.tsx`), link from Configuración group.
- [x] Nav tier structure — RESOLVED: exact NAV_GROUPS data mapping documented above (i18n keys `groupOperation`/`groupCommitments`/`groupSettings` + `help` NEW; value renames for `posCatalog`/`posSales`).
- [x] H-10 exclusion register — RESOLVED: design table + per-site source comments.
- [x] Alert API — RESOLVED: variant + optional title/action + Icon wrapper, danger/info classes per contract; ErrorState deferred.
- [x] Contrast sub-set classes — RESOLVED with exact before→after pairs (Button success `bg-teal-700 hover:bg-teal-800`; Toast info `bg-blue-700`; Badge → neutral zinc-900/zinc-100 text over `/{variant}/10` tint; Modal close `zinc-400→zinc-500 + dark:text-zinc-400 preserved`).
- [x] Token-literal fixes — RESOLVED: `text-danger` for transfer-form:376; `hover:bg-primary/10` for button.tsx inverse hover.
- [x] Work-unit commit plan — RESOLVED: C1..C8 mapping documented above (S2 split into nav-restructure + back-button-removal commits).
