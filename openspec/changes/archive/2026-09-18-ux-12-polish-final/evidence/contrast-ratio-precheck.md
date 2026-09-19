# Contrast ratio pre-check — UX-12 (task 2.1, DD-T2 two-step rule)

All ratios computed with `contrast-ratio-scripts/ratio-check.cjs` (WCAG 2.x relative
luminance, matched to the audit's reported values: white-on-dark-primary 2.64 and
light primary 4.42 reproduce exactly). Axe re-scan (U5) is the final arbiter.

NOTE ON INTERIM VALUES (supersession): the "intermediate/candidate" rows below are
interim evaluations from the DD-T2 two-step process and are SUPERSEDED by the final
token values recorded per section (plus the axe re-scan results, which passed 0/20
combos). They are retained for audit-trail traceability only.

Surfaces (measured `#hex` equivalents of the `oklch()` tokens):

| Theme | Token | Before | Key surface |
|---|---|---|---|
| light | `--tc-primary` | `oklch(0.546 0.245 262.881)` = `#155DFC` | card `#E8ECF0`, bg `#F0F3F5`, white |
| dark  | `--tc-primary` | `oklch(0.707 0.165 254.624)` = `#51A2FF` | white text on buttons, dark surfaces |
| light | `--tc-surface-card` | `#E8ECF0` | |
| light | `--tc-surface-bg` | `#F0F3F5` | |
| dark  | `--tc-surface-card` | `#151921` | |
| dark  | `--tc-surface-bg` / `--background` | `#0B0D11` | |

## 1. Dark `--tc-primary` (CC-6 + feeds CC-7 dark)

| Candidate (same hue 254.624 ramp) | White-on-token | Evaluation |
|---|---|---|
| before `#51A2FF` | **2.64** (audit match) | FAIL |
| intermediate `oklch(0.62 0.205 254.624)` = `#007CFB` | 3.98 | evaluated — still fails |
| intermediate `oklch(0.578 0.228 254.624)` = `#0073FB` | 4.33 | evaluated — still fails (< 4.5) |
| **final** `oklch(0.55 0.235 254.624)` = `#0069F5` | **4.84** | PASS (AA normal text) |

Chosen dark `--tc-primary`: **`oklch(0.55 0.235 254.624)`**.
Dark `--tc-primary-hover`: **`#0055D1`** (white 6.52 — hover keeps ≥ 4.5; before `#2590FF` failed at 3.22).

Consequence recorded honestly: darkening dark primary raises white-on-primary to AA but lowers
primary-as-TEXT on dark surfaces (`#0069F5` on `#151921` = 3.64; before: 6.67). The restore is
impossible inside ONE token (AA-white-on-token needs L ≤ 0.1833; AA-token-on-dark-card needs
L ≥ 0.218 — mutually exclusive). Therefore:

- The flagged dark surfaces (nav active tint — CC-7) get the sanctioned per-site fix at
  `nav.tsx:268`: `dark:text-primary` → `dark:text-white` (white on the `dark:bg-primary/20`
  blend ≈ 11.5:1).
- Formerly-passing dark `text-primary` resting sites (links/forms outside the 5 scanned
  routes, e.g. `/help` footer link on `/help`-dark which was NOT flagged in UX-11, auth pages)
  MAY be newly flagged by the re-scan. Per tasks 5.2 these get bounded per-site extraction
  and fixes; they are NOT mass-migrated here.

## 2. Light `--tc-primary` decision (task 2.4)

| Value | White | On card `#E8ECF0` | Notes |
|---|---|---|---|
| before `#155DFC` | 5.25 | **4.42** | borderline; the flagged CC-7 nav-active surface was ≤ 4.5 blended |
| **bumped** `oklch(0.488 0.243 264.376)` = `#1447E6` (standard one-step darker ramp) | 6.83 | **5.75** | PASS; brand fidelity acceptable (same blue, one ramp step) |

DECISION: BUMP. Light `--tc-primary-hover` → blue-800 ramp step
`oklch(0.432 0.232 264.376)` = `#0936CC` (white 8.71).

## 3. `--tc-brand-gold` per-context evaluation (DD-T2 second clause)

Usages of `--tc-brand-gold` in the tree (grep 2026-09-18): `text-brand-gold` wordmark in
`logo.tsx` / `not-found.tsx` (CC-4, UI-TEXT context, axe-flagged light), decorative nav ICON
colors (`nav.tsx` icons — SVG, axe-exempt), landing hero gradient (decorative bg).
Dark `#F8C838` on dark card = **11.16** PASS (no change).

Decision: **per-site CC-4 fix (logo.tsx, not-found.tsx) instead of token darkening.**
Rationale: gold's only text usage is the brand wordmark, which is also the brand-identity
surface — the two-step token darkening required to reach ≥ 4.5-vs-card (`#92400E`, 5.97)
shifts the brand gold to dark brown globally for a purely decorative-in-remaining-sites
token. CC-4 swaps the wordmark to AA-passing ramp classes locally. Per-context evaluation
recorded per the spec scenario; decorative usages keep the brand value.

| Candidate | vs `#E8ECF0` | Evaluation |
|---|---|---|
| before `#C97B06` | 2.80 | FAIL (text) |
| `#B45309` | 4.23 | below 4.5 on card |
| landed per-site `text-amber-800` = `#92400E` | 5.97 | PASS |
| wordmark teal → `text-cyan-700` = `#0E7490` | 4.51 | PASS (before `#028A95` = 3.49 FAIL) |

## 4. `--tc-surface-muted` (light) — secondary text on cards (4.07–4.34)

| Token | Value | On card | Evaluation |
|---|---|---|---|
| light before | `#71717A` | 4.07 | FAIL (audit match) |
| **light final** | `#52525B` (zinc-600-equivalent darker value, per DD-T2) | **6.51** | PASS |
| dark | `#A1A1AA` (unchanged) | 6.87 on `#151921` | PASS |

Note: DD-T2's "dark `--tc-surface-muted`" wording pointed at the failing context; the measured
failure is the LIGHT value (4.07–4.34 on light cards). Dark value passes. Correction applied to
the light value; dark documented as passing.

## 5. `--tc-income` / `--tc-expense` on card, both themes

| Token | Value | On card | Evaluation |
|---|---|---|---|
| light income before | `oklch(0.596 0.145 163.225)` = `#009966` | 3.08 | FAIL as normal text (`text-sm` call sites exist) |
| **light income final** | `#067855` | **4.62** | PASS |
| dark income | `#00BC7D` (unchanged) | 7.12 | PASS |
| light expense before | `oklch(0.577 0.245 27.325)` = `#E7000B` | 4.02 | FAIL (axe-flagged movement-card amount) |
| **light expense final** | `#B91C1C` | **5.45** | PASS |
| dark expense | `#FF3936` (unchanged) | 4.94 | PASS |

## 6. Per-site CC classes (changelog)

- CC-1: `text-zinc-500` → `text-zinc-600` (6.51 on card / 6.94 on bg) in the 5 axe-flagged
  files only: `summary-hero.tsx`, `summary-cards.tsx`, `movement-card.tsx`,
  `credits-granted-list.tsx`, `sale-list.tsx`. NO migration of unflagged zinc sites.
- CC-2: `summary-hero.tsx` "Data as of" line `text-zinc-400 dark:text-zinc-500` →
  `text-zinc-600 dark:text-zinc-400`.
- CC-3: `nav.tsx` group labels `text-zinc-400 dark:text-zinc-500` → `text-zinc-600 dark:text-zinc-400`.
- CC-4: `logo.tsx` + `not-found.tsx` wordmark: `text-brand-teal` → `text-cyan-700 dark:text-brand-teal`
  and `text-brand-gold` → `text-amber-800 dark:text-brand-gold` (brand tokens retained for
  decorative contexts per §3).
- CC-5: `help/page.tsx:49,106` `text-zinc-500` → `text-zinc-600`; line 96 link closes via the
  light `--tc-primary` bump. (Audit anchor 106 vs measured line for the footer block: footer
  container line ~106; text sites enumerated by grep.)
- CC-6: closed by the dark `--tc-primary` correction. NO button.tsx edits (verified via diff).
- CC-7: `nav.tsx:268` active tint — light fixed by the light-primary bump
  (text-primary on `bg-primary/10`-over-card blend ≈ 5.27); dark per-site
  `dark:text-primary` → `dark:text-white`.

## Commit decision

Execute: section 1 dark primary+hover, section 2 light primary+hover, light
`--tc-surface-muted`, light income/expense, and CC-1/CC-2/CC-3/CC-4/CC-5/CC-7 per-site
classes. Axe re-scan (U5) is the final arbiter.
