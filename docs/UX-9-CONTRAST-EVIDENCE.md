# UX-9 — Evidencia de contraste WCAG AA (R-12)

**Change:** `ux-9-accessibility` · **Slice E (PR #5)** · **Requirement:** R-12 (D6)
**Baseline:** HEAD `731242e`, rama `master`, árbol limpio.
**Estado:** evidencia documental — los tokens globales (`--tc-*`) NO se modifican en UX-9.

---

## 1. Propósito

Documentar los ratios de contraste medidos sobre los tokens reales de `src/app/globals.css`
(light mode `:4-38` y dark mode `:71-96`), verificar la coherencia con la afirmación del
Design System y registrar la decisión de diferir cualquier cambio de tokens a UX-10
(DEC-DS-01).

Esto cumple R-12 del spec:

- S12.1 — al cierre de fase, cero cambios de `--tc-*` (o cada cambio con sign-off documentado).
- S12.2 — ratios tabulados, coherencia DS verificada y decisión UX-10 registrada.

---

## 2. Método

### 2.1 Fórmula WCAG 2.1

Luminancia relativa por canal (WCAG 2.x):

```
c_lin = c / 255
c' = c_lin / 12.92                          si c_lin <= 0.03928
c' = ((c_lin + 0.055) / 1.055) ^ 2.4        si c_lin >  0.03928

L = 0.2126 * R' + 0.7152 * G' + 0.0722 * B'
```

Ratio de contraste (par de colores con luminancias L1 > L2):

```
contrast = (L1 + 0.05) / (L2 + 0.05)
```

Umbrales AA aplicados:

| Tipo                                | Umbral | Aplicado a                                                                           |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------ |
| Texto normal (< 18pt / < 14pt bold) | 4.5:1  | `text-sm` de Button/Toast (14px), `text-xs` de Badge (12px), texto secundario, links |
| Texto grande (≥ 18pt o ≥ 14pt bold) | 3:1    | — (no aplica en los pares medidos)                                                   |
| Componentes de UI / iconos          | 3:1    | iconos `zinc-400`, `brand-gold`, borde/focus                                         |

### 2.2 Conversión oklch → sRGB (CSS Color 4)

Los tokens semánticos están definidos en `oklch()` (`globals.css:16-24` light, `:77-85` dark).
Conversión aplicada en dos pasos:

1. **oklch → oklab:** `a = C·cos(h)`, `b = C·sin(h)` con `h` en radianes.
2. **oklab → sRGB lineal → sRGB gamma:** matrices y funciones de transferencia de la
   especificación CSS Color 4 (referencia: <https://www.w3.org/TR/css-color-4/#color-conversion>).

Valores convertidos (redondeo a hex, idénticos a los consumidos por el navegador):

| Token             | Light (oklch `globals.css`) | sRGB light | Dark (oklch `globals.css`) | sRGB dark |
| ----------------- | --------------------------- | ---------- | -------------------------- | --------- |
| `--tc-primary`    | `0.546 0.245 262.881`       | `#155dfc`  | `0.707 0.165 254.624`      | `#51a2ff` |
| `--tc-success`    | `0.596 0.145 163.225`       | `#009966`  | `0.696 0.17 162.48`        | `#00bc7d` |
| `--tc-info`       | `0.646 0.222 244.38`        | `#0093ff`  | `0.746 0.222 244.38`       | `#00b4ff` |
| `--tc-danger`     | `0.577 0.245 27.325`        | `#e7000b`  | `0.677 0.245 27.325`       | `#ff3936` |
| `--tc-warning`    | `0.769 0.188 70.08`         | `#fe9a00`  | `0.829 0.188 70.08`        | `#ffad00` |
| `--tc-brand-gold` | hex                         | `#c97b06`  | hex                        | `#f8c838` |

Superficies y grises (Tailwind v4, sin conversión):

| Color                  | Valor     |
| ---------------------- | --------- |
| `surface-card` (light) | `#e8ecf0` |
| `surface-bg` (light)   | `#f0f3f5` |
| `surface-card` (dark)  | `#151921` |
| `zinc-400`             | `#a1a1aa` |
| `zinc-500`             | `#71717a` |
| `zinc-900`             | `#18181b` |
| `white`                | `#ffffff` |

---

## 3. Tabla de pares medidos

> Verificación: cálculos propios reproducidos con la fórmula §2.1 sobre los tokens §2.2.
> **No medido con herramienta externa** (ver §6). Veredicto AA texto normal = 4.5:1; UI/iconos = 3:1.

### 3.1 Light mode

| Par                              | Ratio    | Veredicto       | Dónde (verificado)                             |
| -------------------------------- | -------- | --------------- | ---------------------------------------------- |
| `text-white` / `bg-success`      | **3.65** | ❌ AA texto     | `toast.tsx` (variant success), `button.tsx:20` |
| `text-white` / `bg-info`         | **3.17** | ❌ AA texto     | `toast.tsx` (variant info)                     |
| `text-zinc-400` / `surface-card` | **2.16** | ❌ 3:1 UI       | iconos; cerrar modal `modal.tsx:80`            |
| `brand-gold` / `surface-card`    | **2.80** | ❌ 3:1 UI       | iconos de nav `text-brand-gold`                |
| `text-zinc-500` / `surface-card` | **4.07** | ⚠️ < 4.5        | texto secundario sobre tarjetas                |
| `text-zinc-500` / `surface-bg`   | **4.34** | ⚠️ < 4.5        | texto secundario sobre fondo                   |
| `text-primary` / `surface-card`  | **4.42** | ⚠️ borderline   | links/labels (`sale-form.tsx:199`)             |
| `text-white` / `bg-primary`      | **5.25** | ✅              | `button.tsx:16`                                |
| `text-white` / `bg-danger`       | **4.77** | ✅ (borderline) | `toast.tsx` (variant danger), `button.tsx:22`  |
| `text-zinc-900` / `bg-warning`   | **8.30** | ✅              | `toast.tsx` (variant warning)                  |

### 3.2 Dark mode

| Par                                          | Ratio    | Veredicto   | Dónde (verificado)                   |
| -------------------------------------------- | -------- | ----------- | ------------------------------------ |
| `text-white` / `bg-primary` (dark `#51a2ff`) | **2.64** | ❌ AA texto | `button.tsx:16` en dark              |
| `text-white` / `bg-success` (dark `#00bc7d`) | **2.47** | ❌ AA texto | `button.tsx:20`, `toast.tsx` en dark |
| `text-white` / `bg-info` (dark `#00b4ff`)    | **2.34** | ❌ AA texto | `toast.tsx` en dark                  |
| `text-zinc-500` / `surface-card` (dark)      | **3.64** | ⚠️ < 4.5    | texto secundario en dark             |
| `text-zinc-500` / `surface-bg` (dark)        | **4.02** | ⚠️ < 4.5    | texto secundario en dark             |

### 3.3 Badges — variantes de tinte `/10` (`badge.tsx:9-16`)

Los Badge usan `bg-{variant}/10 text-{variant}` (texto `text-xs` = 12px → umbral 4.5:1).
Ratio medido del texto de color sobre el tinte compuesto (`bg-*/10` al 10 % sobre `surface-card`):

| Badge                                    | Tinte compuesto | Ratio    | Veredicto |
| ---------------------------------------- | --------------- | -------- | --------- |
| `success` (`bg-success/10 text-success`) | `#dce8e9`       | **2.92** | ❌        |
| `info` (`bg-info/10 text-info`)          | `#dce8f1`       | **2.55** | ❌        |
| `warning` (`bg-warning/10 text-warning`) | `#e9e8e4`       | **1.74** | ❌        |

> Supuesto: el tinte se compone sobre `surface-card` (superficie típica contenedora).
> Sobre otras superficies el ratio varía ±0.1-0.2, siempre bajo 3:1.

---

## 4. Veredicto de coherencia con el DS §2.1.5

**Afirmación del DS:** `docs/UX-DESIGN-SYSTEM.md` línea 38 (decisión 4 de §2.2
"Fundamentos — Color"; referenciada como **§2.1.5** por `UX-ROADMAP.md:164`):

> "**Contraste:** todo par texto/fondo cumple WCAG AA (4,5:1 texto normal, 3:1 texto grande).
> El texto secundario usa `surface-muted` (hoy `zinc-500` improvisado — migrar)."

**Realidad medida (tabla §3):**

| Gap                                | Valor                      | Contexto                      |
| ---------------------------------- | -------------------------- | ----------------------------- |
| `bg-success` + `text-white`        | 3.65 (light) / 2.47 (dark) | Button success, Toast success |
| `bg-info` + `text-white`           | 3.17 (light) / 2.34 (dark) | Toast info                    |
| Badges `text-*` sobre tinte `/10`  | 1.74 - 2.92                | Badge success/info/warning    |
| `bg-primary` + `text-white` (dark) | 2.64                       | Button primary en dark mode   |
| `zinc-400` iconos / `brand-gold`   | 2.16 / 2.80                | por debajo de 3:1 UI          |
| `zinc-500` texto secundario        | 4.07 - 4.34 (light)        | apenas por debajo de 4.5      |
| `text-primary` sobre tarjeta       | 4.42                       | borderline 4.5                |

**Conclusión:** la afirmación "todo par texto/fondo cumple WCAG AA" **no se sostiene** con
los tokens actuales. Los gaps de mayor impacto están en las variantes semánticas
success/info (Button/Toast), los Badge y el button primary en dark mode. El propio DS ya
declara el `zinc-500` como "improvisado — migrar", coherente con el gap medido
(4.07-4.34 < 4.5).

→ La corrección documental del DS (o su confirmación) se difiere a UX-10/UX-12 junto con
los cambios de tokens; esta evidencia queda como insumo formal.

---

## 5. Decisión de fase (D6 · DEC-DS-01)

1. **Los tokens globales (`--tc-*`) NO se modifican en UX-9.** Cambiar `--tc-*` afecta toda
   la app y es una decisión de diseño (DEC-DS-01; P1 de tokens del §53 del roadmap) →
   diferido a **UX-10**.
2. **Sub-set mínimo LOCAL** (variantes success/info de `button.tsx`/`toast.tsx`, Badge con
   tintes `/10`, `zinc-400 → zinc-500` en iconos de modal) **solo** si el fundador otorga
   sign-off explícito. **Estado actual: sin sign-off → NO ejecutado** (task 5.4 del tasks
   artifact).
3. Cero diffs de tokens en esta fase (S12.1: verificado por diff-check en verify).

### 5.1 Impacto estimado del sub-set aprobado (recomendación condicionada)

| Cambio local propuesto                                                                                                  | Archivo           | Impacto                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| Variante `success` de Button: `bg-success` → tono más oscuro local (sin tocar `--tc-success`)                           | `button.tsx:20`   | Sube el ratio white/verde de 3.65 hacia ≥ 4.5 solo en Button; Toast success queda pendiente |
| Variante `info` de Toast: `bg-info` texto alternativo o tono local                                                      | `toast.tsx`       | 3.17 → ≥ 4.5 en el ítem info                                                                |
| Badge: `text-{variant}` sobre tinte `/10` — subir opacidad del tinte o usar `text-zinc-900`/`text-white` según variante | `badge.tsx:11-15` | 1.74-2.92 → ≥ 4.5 (cambio de apariencia visible: mayor contraste de píldora)                |
| Iconos de cierre modal: `text-zinc-400` → `text-zinc-500`                                                               | `modal.tsx:80`    | 2.16 → 4.07 (⚠️ cumple 3:1 UI, aún < 4.5 para texto)                                        |

Evaluación de costo: los 4 cambios son locales (sin tocar tokens globales ni dark mode),
pero alteran la apariencia de componentes core — por eso requieren sign-off del fundador
(DEC-DS-01) y verificación de diseño.

---

## 6. Limitaciones y verificación pendiente

- **No medido con herramienta externa** (p. ej. axe DevTools, WebAIM Contrast Checker,
  Lighthouse). Los ratios son cálculos propios reproducibles (§2) sobre los tokens de
  `globals.css`.
- **Revisión de diseño pendiente:** la verificación formal del contraste con herramienta
  externa y la decisión final sobre tokens quedan para **UX-10/UX-12** (roadmap §UX-9).
- La investigación de UX-11 (auditoría automatizada/manual completa) debería correr los
  ratios sobre el render real (gradientes, hover `*/90`, tintes sobre superficies
  variables), no solo sobre tokens aislados.
- Los ratios de hover (`bg-success/90`, `hover:bg-*`) no se miden: WCAG evalúa estados de
  reposo; el hover se verifica en la revisión de diseño.

---

## 7. Trazabilidad

| Artifact | Referencia                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| Spec     | R-12 (S12.1/S12.2) — `sdd/ux-9-accessibility/spec`                                                            |
| Explore  | §6 — ratios calculados desde tokens reales — `sdd/ux-9-accessibility/explore`                                 |
| Proposal | D6 — diferir tokens a UX-10; sub-set solo con sign-off — `sdd/ux-9-accessibility/proposal`                    |
| Tokens   | `src/app/globals.css` (`:4-38` light, `:71-96` dark)                                                          |
| DS       | `docs/UX-DESIGN-SYSTEM.md` línea 38 (§2.2, referenciado como §2.1.5 en `UX-ROADMAP.md:164`)                   |
| Tasks    | 5.3 (esta evidencia) y 5.4 (sub-set, condicionada a sign-off — no ejecutada) — `sdd/ux-9-accessibility/tasks` |
