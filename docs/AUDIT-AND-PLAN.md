# GLOBALMONEY — PLAN DE IMPLEMENTACIÓN

> **Este documento es el plan maestro de implementación.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` y este documento ANTES de empezar.**
>
> **Después de una compactación o en una nueva sesión, lo PRIMERO es leer este archivo.**

---

## ESTADO ACTUAL (última actualización: 2026-08-19)

### Completado ✅

| Fase | Descripción | Commit |
|------|-------------|--------|
| 0 | Auditoría completa del proyecto | — |
| 1 | Design system tokens + 6 componentes UI (Button, Input, Card, Modal, Table, Select, Icon, EmptyState) | — |
| 2 | Refactor de formularios — componentes UI compartidos, formato centralizado, i18n, fechas por defecto | — |
| 3 | Empty states, loading skeletons, error boundaries para 8 páginas de listas | — |
| 4 | Dashboard — tarjetas resumen, gráfico mensual, movimientos recientes | — |
| 5 | Módulo Clientes — CRUD completo (dominio, use cases, repositorio, actions, páginas) | — |
| 6 | Sistema de notificaciones toast — 9 server actions refactorizados, todos los formularios con toast+redirect, 10 componentes de delete creados | — |
| 7 | Mejora de testing — 273 tests en 28 archivos | — |
| 8 | Manejo centralizado de errores — `handleActionError`, 22 formularios con traducción de claves | `d1c69da` |
| 9 | Responsive design — tablas con overflow, forms con breakpoints, nav fix, text truncation | `065116b` |
| 10 | PWA — manifest, iconos SVG, service worker, meta tags | `5d9ac75` |
| 11 | Performance — queries paralelas en dashboard, memoización i18n, structuredClone | `4aea037` |
| 12 | Movimientos — Filtro "Todas las cuentas" por defecto, ordenamiento por fecha | `e994f36` |
| 13 | POS Venta — Selector de cliente con "Cliente general" por defecto | `20b6a8d` |
| 14 | POS — Búsqueda de productos con debounce (300ms), case-insensitive | `a4ffc43` |
| 15 | Créditos — Edición de abonos con botón "Editar" en tabla | `ec82fb9` |
| 16 | Formularios en modales — patrón Button→Modal→Form en 6 módulos | `6aeb199` |
| 17 | Botones de acción con iconos — Trash2, Pencil, Eye en 13 archivos | `1d75ca4` |
| 18 | Selector de idioma mejorado — icono Languages, responsive | `ea18cd9` |
| 19 | Logo TwinCap — SVG component + rename GlobalMoney→TwinCap + favicon | `a7ca089` |
| 20 | Landing page pública — Hero, Features, Benefits, FAQ, CTA, Footer | `4ae68f5` |
| 21 | Auth en landing — sesión activa → redirect a dashboard | `pendiente` |

### Pendiente ❌ (3 features del plan original)

| # | Feature | Prioridad | Dependencias |
|---|---------|-----------|--------------|
| 17 | Categorías — Formulario en modal (consistencia) | P2 | #16 ✅ |
| 18 | Botones de acción con iconos (edit, delete, view) | P2 | — |
| 19 | Selector de idioma — icono globe, diseño consistente | P2 | — |
| 20 | Logo TwinCap — SVG/CSS, isotipo, favicon | P2 | — |
| 21 | Landing page pública — Hero, Features, Benefits, FAQ, CTA, Footer | P1 | #20 (logo) |
| 22 | Auth en landing — sesión activa → redirect a dashboard | P1 | #21 |
| 23 | Búsqueda de clientes en lista de clientes | P2 | — |

---

## PLAN POR FASES

### FASE 12 — Movimientos: Filtro "Todo"
**Objetivo:** Agregar opción "Todas las cuentas" como filtro por defecto en movimientos.
**Prioridad:** P1

**Cambios:**
- Agregar opción "Todas las cuentas" al `<Select>` de cuentas en `movements-list.tsx`
- Estado `selectedAccountId` con valor especial `'all'` por defecto
- Cuando `selectedAccountId === 'all'`, mostrar todos los movimientos de todas las cuentas
- Mantener paginación, ordenamiento y filtros existentes

**Archivos:**
- `src/app/(main)/movements/movements-list.tsx`
- `messages/es.json` — clave `Movements.allAccounts`
- `messages/en.json` — clave `Movements.allAccounts`

**Criterios de aceptación:**
- Por defecto se muestran TODOS los movimientos
- El usuario puede filtrar por cuenta individual
- El filtro "Todas las cuentas" aparece primero en el select
- Paginación funciona correctamente con el filtro "Todas"

---

### FASE 13 — POS Venta: Selector de cliente
**Objetivo:** Asociar un cliente a cada venta POS. Default: "Cliente general".
**Prioridad:** P1

**Cambios:**
- Agregar prop `clients` a `SaleFormProps`
- Agregar `<Select>` de cliente con opción "Cliente general" por defecto
- Si la venta es a crédito, validar que no sea "Cliente general"
- El server action debe recibir y guardar `clientId` en la venta
- El modelo de venta ya tiene campo `clientId` — verificar

**Archivos:**
- `src/app/(main)/pos/sales/sale-form.tsx`
- `src/app/(main)/pos/sales/page.tsx` — pasar clients como prop
- `src/app/(main)/pos/sales/sale-list.tsx` — mostrar nombre del cliente
- `src/core/domain/sale.ts` — verificar campo clientId
- `messages/es.json`, `messages/en.json`

**Criterios de aceptación:**
- Todo venta tiene un campo cliente visible
- "Cliente general" es el default
- Venta a crédito requiere cliente real (no "Cliente general")
- El nombre del cliente se muestra en la lista de ventas

---

### FASE 14 — POS: Búsqueda de productos
**Objetivo:** Buscador dinámico con debounce en el catálogo de productos.
**Prioridad:** P1

**Cambios:**
- Agregar `<input>` de búsqueda arriba del grid de productos en `catalog-list.tsx`
- Debounce 300ms antes de filtrar
- Filtrar por nombre del producto (case-insensitive)
- Resultado: filtrar el array `items` en el cliente (ya están cargados)
- Mostrar contador de resultados
- UX fluida en móvil y escritorio

**Archivos:**
- `src/app/(main)/pos/catalog/catalog-list.tsx`
- `messages/es.json`, `messages/en.json`

**Criterios de aceptación:**
- Input de búsqueda visible arriba del grid
- Filtrado con debounce de 300ms
- Case-insensitive
- Muestra "X de Y productos"
- Funciona bien en móvil (input sticky o fixed)

---

### FASE 15 — Créditos: Edición de abonos
**Objetivo:** Permitir editar monto y fecha de abonos existentes.
**Prioridad:** P1

**Cambios:**
- Agregar botón "Editar" (con icono Pencil) en cada fila de abono
- Al hacer click, mostrar formulario inline con los datos actuales
- Validar que el monto editado no exceda el saldo pendiente
- Recalcular: saldo pendiente, total abonado, estado del crédito
- Server action `editAbono` en actions
- El movimiento asociado debe actualizarse si cambia el monto

**Archivos:**
- `src/app/(main)/credits/received/credits-received-list.tsx`
- `src/app/(main)/credits/granted/credits-granted-list.tsx`
- `src/app/(main)/credits/received/actions.ts`
- `src/app/(main)/credits/granted/actions.ts`
- `src/core/application/credits.ts` — nuevo use case
- `src/core/domain/credit.ts` — verificar modelo
- `messages/es.json`, `messages/en.json`

**Criterios de aceptación:**
- Botón "Editar" visible en cada abono
- Formulario con monto y fecha pre-cargados
- Validación de saldo pendiente
- Recálculo automático de totales del crédito
- El movimiento asociado se actualiza correctamente
- Toast de confirmación

---

### FASE 16 — Formularios en modales
**Objetivo:** Unificar todos los formularios CRUD bajo patrón Button→Modal→Form.
**Prioridad:** P2

**Cambios:**
- Wrappe cada formulario en el componente `<Modal>` existente
- Cada lista tiene un botón "Agregar [entidad]" que abre el modal
- Modal se cierra con X, ESC, o después de éxito
- Cerrar modal resetea el formulario
- Aplicar a: movements, transfers, credits (received/granted), catalog
- **NO mover abonos a modal** (ya están inline en la fila expandida)

**Archivos:**
- `src/app/(main)/movements/movements-list.tsx`
- `src/app/(main)/transfers/transfers-list.tsx`
- `src/app/(main)/credits/received/credits-received-list.tsx`
- `src/app/(main)/credits/granted/credits-granted-list.tsx`
- `src/app/(main)/pos/catalog/catalog-list.tsx`
- `src/app/(main)/categories/page.tsx`
- `src/app/(main)/pos/sales/page.tsx` o `sale-form.tsx`

**Criterios de aceptación:**
- TODOS los formularios CRUD abren en modal
- Modal accesible (focus trap, ESC para cerrar)
- Después de crear/editar, el modal se cierra automáticamente
- El formulario se resetea al cerrar el modal
- Consistencia visual en todos los módulos

---

### FASE 17 — Botones de acción con iconos
**Objetivo:** Reemplazar texto plano por iconos en botones de acción de listas.
**Prioridad:** P2

**Cambios:**
- Botón editar: icono `Pencil` + tooltip "Editar"
- Botón eliminar: icono `Trash2` + tooltip "Eliminar"
- Botón ver detalles: icono `Eye` + tooltip "Ver"
- Mantener el texto como fallback en mobile si no hay espacio
- Usar componente `Icon` existente
- Aplicar a todos los delete-*.tsx y botones de acción en listas

**Archivos:**
- `src/app/(main)/movements/delete-movement-button.tsx`
- `src/app/(main)/clients/delete-client-button.tsx`
- `src/app/(main)/pos/catalog/delete-catalog-item-button.tsx`
- `src/app/(main)/credits/received/delete-credit-button.tsx`
- `src/app/(main)/credits/granted/delete-credit-button.tsx`
- `src/app/(main)/categories/delete-category-button.tsx`
- `src/app/(main)/pos/catalog/catalog-list.tsx` — botón editar
- `src/app/(main)/credits/*/credits-*-list.tsx` — botón editar abono

**Criterios de aceptación:**
- Cada botón de acción tiene un icono representativo
- Iconos son consistentes (mismo tamaño, mismo estilo)
- Tooltips en desktop
- Accesible (aria-label)

---

### FASE 18 — Selector de idioma mejorado
**Objetivo:** Selector de idioma con icono globe, diseño consistente y responsive.
**Prioridad:** P2

**Cambios:**
- Agregar icono `Languages` de Lucide al botón
- Estilo consistente con otros botones de nav
- Dropdown o toggle con indicador visual del idioma actual
- Responsive: icono solo en móvil, icono + texto en desktop

**Archivos:**
- `src/app/(main)/nav.tsx`
- `messages/es.json`, `messages/en.json`

**Criterios de aceptación:**
- Icono globe visible
- Altura consistente con otros botones de nav
- Responsive (icono vs icono+texto)
- Funciona correctamente el toggle ES↔EN

---

### FASE 19 — Logo GlobalMoney
**Objetivo:** Logo moderno construido con SVG/CSS.
**Prioridad:** P2

**Cambios:**
- Crear componente `Logo` en `src/components/ui/logo.tsx`
- Concepto: finanzas, crecimiento, tecnología, confianza
- Versiones: logotipo (texto+icono), isotipo (solo icono), favicon
- Tema claro y oscuro
- Usar en nav, login, register, landing page
- Favicon: versión isotipo

**Archivos:**
- `src/components/ui/logo.tsx` — nuevo
- `src/app/(main)/nav.tsx` — reemplazar texto por componente
- `public/favicon.ico` — generar
- `src/app/layout.tsx` — metadata con favicon

**Criterios de aceptación:**
- Logo SVG renderiza correctamente
- Versión para tema claro y oscuro
- Favicon funciona en navegadores
- Logo visible en nav, login, register

---

### FASE 20 — Landing page pública
**Objetivo:** Landing page en `/` con Hero, Features, Benefits, FAQ, CTA, Footer.
**Prioridad:** P1

**Cambios:**
- Reemplazar redirect en `src/app/page.tsx` con landing page real
- Secciones: Hero (título + CTA), Features (6 cards), Benefits, FAQ (acordeón), CTA final, Footer
- SEO: title, meta description, Open Graph, headings jerarquizados
- Responsive: mobile-first
- Usar diseño system existente (colores, tipografía, componentes)
- Links a /login y /register

**Archivos:**
- `src/app/page.tsx` — reemplazar redirect
- `src/components/landing/hero.tsx` — nuevo
- `src/components/landing/features.tsx` — nuevo
- `src/components/landing/faq.tsx` — nuevo
- `src/components/landing/footer.tsx` — nuevo
- `messages/es.json`, `messages/en.json` — textos de landing
- `src/app/layout.tsx` — metadata SEO

**Criterios de aceptación:**
- Landing page carga en `/`
- Hero con título, subtítulo, CTA a registro
- 6 features/beneficios con iconos
- FAQ funcional (acordeón)
- Footer con copyright
- SEO completo (title, description, OG)
- Responsive en 3 breakpoints
- Links funcionales a login/register

---

### FASE 21 — Auth en landing
**Objetivo:** Sin sesión → landing visible. Con sesión → redirect a dashboard.
**Prioridad:** P1

**Cambios:**
- En la landing page, si hay sesión activa, redirect a `/dashboard`
- Si no hay sesión, mostrar landing con botones de login/register
- Usar `getCurrentUser()` en server component
- Mantener navbar con login/register cuando no hay sesión
- Cuando hay sesión, navbar muestra link a Dashboard

**Archivos:**
- `src/app/page.tsx` — lógica de redirect condicional
- `src/app/(main)/nav.tsx` — mostrar login/register si no hay sesión
- `src/components/landing/*` — botones condicionales

**Criterios de aceptación:**
- Usuario sin sesión ve la landing page
- Usuario con sesión es redirigido a /dashboard
- Navbar muestra login/register cuando no hay sesión
- Navbar muestra Dashboard cuando hay sesión
- No hay loops de redirect

---

### FASE 22 — Búsqueda de clientes
**Objetivo:** Buscador en la lista de clientes.
**Prioridad:** P2

**Cambios:**
- Agregar `<input>` de búsqueda arriba de la tabla de clientes
- Debounce 300ms, case-insensitive
- Filtrar por nombre, email, o documento
- Mostrar contador de resultados
- Input responsive

**Archivos:**
- `src/app/(main)/clients/clients-list.tsx`
- `messages/es.json`, `messages/en.json`

**Criterios de aceptación:**
- Input de búsqueda visible
- Filtrado por nombre, email, documento
- Debounce 300ms
- Contador de resultados
- Funciona en móvil

---

## ORDEN DE EJECUCIÓN RECOMENDADO

```
Fase 12 (Movimientos filtro)  ──┐
Fase 14 (Búsqueda productos)  ──┤── Independientes, pueden ejecutarse en paralelo
Fase 17 (Iconos en botones)   ──┤
Fase 18 (Selector idioma)     ──┤
Fase 19 (Logo)                ──┘
         │
         ▼
Fase 13 (Cliente en POS)  ── Fase 15 (Editar abonos)  ── Ambas dependen de Fase 3 (clientes existe)
         │
         ▼
Fase 16 (Forms en modales)  ── Requiere que todos los forms estén estabilizados
         │
         ▼
Fase 20 (Landing page)  ── Fase 21 (Auth en landing)  ── Secuenciales
         │
         ▼
Fase 22 (Búsqueda clientes)  ── Última, refinamiento
```

---

## REGLAS DE EJECUCIÓN

1. **Leer este archivo ANTES de cada fase.**
2. **Una fase a la vez.** Esperar aprobación antes de continuar.
3. **Después de cada fase:** `pnpm tsc --noEmit && pnpm test && pnpm build`
4. **Si falla, la fase NO está terminada.**
5. **Commits convencionales:** `feat:`, `fix:`, `refactor:`
6. **i18n:** todo texto en es.json y en.json
7. **Arquitectura hexagonal:** nunca violar
8. **pnpm:** nunca npm ni yarn

---

## PROTOCOLO POST-COMPACTACIÓN

Si el contexto se compacta o inicia nueva sesión:

1. **Leer este archivo** (`docs/AUDIT-AND-PLAN.md`)
2. **Leer `AGENTS.md`**
3. **Buscar en Engram:** `mem_search(query: "GlobalMoney plan fase", project: "globalmoney")`
4. **Identificar la fase actual** comparando el último commit con la tabla de estado
5. **Continuar desde la fase pendiente**

---

## FECHA DE CREACIÓN
2026-08-19 — Plan maestro reescrito con 12 fases pendientes identificadas.
