# TWINCAP — PLAN DE IMPLEMENTACIÓN · RONDA 2

> **Este documento es el plan maestro y documento de continuidad del proyecto.**
>
> **Cualquier agente que trabaje en el proyecto DEBE leer `AGENTS.md` y este documento ANTES de empezar.**
>
> **Después de una compactación o en una nueva sesión, lo PRIMERO es leer este archivo.**
>
> Lineamientos de la ronda actual: `Ronda 2.md` (raíz del repositorio).

---

## ESTADO ACTUAL (última actualización: 2026-08-21)

| Ronda | Estado |
|-------|--------|
| Ronda 1 — fases 0–22 | ✅ Completa (última fase commiteada: `4fb98b6`) |
| **Ronda 2 — Auditoría y mejoras** | 🟢 Fase 0 ✅ · Fase 1 ✅ (`72f9814`) · Fase 2 ✅ (`1a79b95`) · Fase 3 ✅ (`73d2d7d`) · Fase 4 ✅ (`51a3a3f`) · Fase 5 ✅ (`a0e912c` + fixes `09a7c23`, `1c536d2`) · Fase 6 ✅ (`6d720ca`, desplegada) · **Fase 7 ✅ implementada y commiteada 2026-08-22 — pausa; Fase 8 espera aviso explícito** |

> ⚠️ **REGLA CRÍTICA DE LA RONDA 2:** la ronda comienza con **AUDITORÍA**, no con implementación.
> Prohibido escribir código hasta presentar el plan definitivo por fases y recibir aprobación explícita del usuario.

---

## RONDA 1 — RESUMEN HISTÓRICO (cerrada)

| Fase | Descripción | Commit |
|------|-------------|--------|
| 0 | Auditoría completa del proyecto | — |
| 1 | Design system tokens + componentes UI base (Button, Input, Card, Modal, Table, Select, Icon, EmptyState) | — |
| 2 | Refactor de formularios — UI compartida, formato centralizado, i18n, fechas por defecto | — |
| 3 | Empty states, loading skeletons, error boundaries en 8 páginas de listas | — |
| 4 | Dashboard — tarjetas resumen, gráfico mensual, movimientos recientes | — |
| 5 | Módulo Clientes — CRUD completo (dominio, use cases, repositorio, actions, páginas) | — |
| 6 | Sistema toast — 9 server actions refactorizados, 10 componentes de delete | — |
| 7 | Testing — 273 tests en 28 archivos | — |
| 8 | Manejo centralizado de errores — `handleActionError`, 22 formularios | `d1c69da` |
| 9 | Responsive — tablas, forms, nav, text truncation | `065116b` |
| 10 | PWA — manifest, iconos SVG, service worker, meta tags | `5d9ac75` |
| 11 | Performance — queries paralelas, memoización i18n, structuredClone | `4aea037` |
| 12 | Movimientos — filtro "Todas las cuentas" por defecto | `e994f36` |
| 13 | POS Venta — selector de cliente con "Cliente general" | `20b6a8d` |
| 14 | POS — búsqueda de productos con debounce 300ms | `a4ffc43` |
| 15 | Créditos — edición de abonos | `ec82fb9` |
| 16 | Formularios en modales — patrón Button→Modal→Form en 6 módulos | `6aeb199` |
| 17 | Botones de acción con iconos — Trash2, Pencil, Eye en 13 archivos | `1d75ca4` |
| 18 | Selector de idioma mejorado — icono Languages, responsive | `ea18cd9` |
| 19 | Logo TwinCap — SVG + rename GlobalMoney→TwinCap + favicon | `a7ca089` |
| 20 | Landing page pública — Hero, Features, Benefits, FAQ, CTA, Footer | `4ae68f5` |
| 21 | Auth en landing — sesión activa → redirect a dashboard | `abd24a2` |
| 22 | Búsqueda de clientes — debounce 300ms | `4fb98b6` |

Las especificaciones detalladas de estas fases quedaron en el historial de git; este documento fue reescrito el 2026-08-21 para dar paso a la Ronda 2.

---

# RONDA 2 — AUDITORÍA, CORRECCIÓN, UX/UI Y EVOLUCIÓN FUNCIONAL

Iniciada: 2026-08-21 · Fuente autoritativa: `Ronda 2.md`

## R2.1 — Contexto y objetivos

Segunda ronda de auditoría y mejora sobre TwinCap. Los hallazgos provienen de **pruebas reales sobre la aplicación**: son hechos verificados, no hipótesis.

Objetivos de la ronda:

1. Corregir los problemas funcionales encontrados.
2. Corregir problemas de responsive.
3. Mejorar la consistencia de la UI.
4. Mejorar la experiencia de formularios.
5. Mejorar el sistema de feedback al usuario.
6. Resolver correctamente el flujo financiero de compras a crédito.
7. Consolidar un sistema visual coherente.
8. Revisar la arquitectura antes de introducir nuevas entidades financieras.
9. Detectar problemas adicionales.
10. Documentar todo el trabajo en este archivo.

**Principio final:** mejorar sin romper. TwinCap ya funciona; no se reescribe. Cada cambio debe responder sí a: *¿esto hace a TwinCap más correcta, consistente, usable, mantenible o preparada para crecer?*

## R2.2 — Flujo obligatorio de la ronda

```
LEER CONTEXTO → AUDITAR → ANALIZAR → IDENTIFICAR DEPENDENCIAS → PLANIFICAR
→ DOCUMENTAR → PRESENTAR PLAN → ESPERAR APROBACIÓN → IMPLEMENTAR FASE
→ PROBAR → DOCUMENTAR → DETENERSE
```

- NO implementar mejoras en la etapa de auditoría.
- NO modificar código hasta que el usuario apruebe la primera fase.
- La auditoría (Fase 0) debe producir los entregables de R2.9.

## R2.3 — Reglas inquebrantables

**Stack fijo** (no migrar, no sustituir): Next.js 16.3.1 · React 19 · TypeScript 5 strict · Tailwind CSS 4 · MongoDB Atlas · Mongoose 8 · Jose · bcryptjs · Zod 4 · Vitest · pnpm 11 · Lucide React.

- **pnpm únicamente** — prohibido npm/yarn.
- **Arquitectura Clean/Hexagonal** (`core/domain`, `core/application`, `infrastructure`, `components`, `i18n`, `app`): no romperla para resolver rápido un problema. `core/domain` sin imports de infraestructura; `core/application` depende de ports, no de implementaciones; `components` solo presentación; `app` conecta rutas/actions/UI.
- **Base de datos:** todo server action o route handler con Mongoose ejecuta `await connectDb()` primero y crea los repositories después, nunca a nivel de módulo.
- **Multi-tenancy:** cada usuario administra exclusivamente sus datos. Autorización verificada en backend en toda operación sensible. Sin equipos, colaboradores ni permisos internos.
- **i18n:** todo texto visible nuevo en `messages/es.json` y `messages/en.json`. Cero textos hardcodeados. Ya se detectaron sin traducir: `Tipo`, `Currency`, `Logout`.
- **Iconografía:** solo Lucide React vía wrapper `src/components/ui/icon.tsx`. No instalar otra librería ni crear SVG manuales cuando Lucide cubra la necesidad.
- **Testing:** `pnpm test`. Cada fase que modifique comportamiento funcional incluye/actualiza tests. Nunca ocultar ni eliminar tests fallidos.
- **Verificación de fin de fase:** `pnpm test` + `pnpm lint` + `pnpm build` (cuando corresponda).

## R2.4 — Hallazgos de la ronda (H1–H21)

| ID | Hallazgo | Notas clave | Fase sugerida* |
|----|----------|-------------|:---:|
| H1 | Menú hamburguesa no funciona en pantallas pequeñas | Debe abrir/cerrar el sidebar/nav móvil, funcionar con teclado, cerrarse al navegar, no producir overflow, respetar sesión. Auditar layout, sidebar, estado del menú, breakpoints, problemas Server/Client Component | 2 |
| H2 | Tablas más angostas que su contenedor | Auditar TODAS las tablas (Movimientos, Clientes, Transferencias, Créditos, Ventas, Catálogo y otras). Crear comportamiento común: width, min-width, columnas, padding, responsive, encabezados, acciones | 2 |
| H3 | Navegación a `/` recarga toda la página o no hay feedback | Analizar navegación completa vs App Router, `loading.tsx`, Server/Client split, redirects innecesarios. Objetivo: transición fluida. **No introducir solución artificial que oculte una recarga real** | 2 |
| H4 | Acciones de tabla deben ser solo iconos | Icon-only cuando el significado sea claro. Cada icono: tooltip accesible, `aria-label`, hover, focus, disabled. Hover con fondo circular. Color semántico: editar neutro/primario, eliminar rojo, confirmar verde, advertencia ámbar, cerrar neutro. Sin exagerar color. Auditar todos los módulos | 1 |
| H5 | Columna "Tipo" de Movimientos siempre en inglés | ES: Ingreso/Gasto · EN: Income/Expense. Vía sistema i18n, no lógica hardcodeada en la tabla. Auditar otros campos similares | 1 |
| H6 | "Agregar movimiento" bloqueado con filtro "Todas las cuentas" | El filtro de la tabla y la cuenta del nuevo movimiento son conceptos distintos. El botón SIEMPRE abre el formulario; la cuenta se solicita dentro (dato obligatorio). Si hay cuenta concreta filtrada, evaluar preselección por conveniencia UX — analizar antes de implementar | 4 |
| H7 | Formularios demasiado largos (especialmente Nuevo Movimiento) | Menos espacio vertical, tipografía compacta, inputs delgados, 2 columnas en desktop / 1 en móvil, agrupación lógica. Preferencia: Grupo 1 Selección (cuenta, tipo, categoría, fecha, opciones) → Grupo 2 Datos introducidos (monto, descripción, notas). Evaluar según lógica de cada formulario, no aplicar ciegamente | 3 |
| H8 | Acceso global a ingresos y gastos | Acción accesible desde cualquier vista autenticada (botón flotante, persistente o acción rápida — analizar cuál da mejor UX sin cubrir contenido). Desde Dashboard, Movimientos, Cuentas, Transferencias, Créditos, POS, Catálogo, Clientes y cualquier módulo autenticado. Reutilizar el formulario de movimientos, permitir iniciar directo en Nuevo ingreso o Nuevo gasto. Respetar cuenta, categoría, fecha, moneda, validaciones, i18n, reglas de dominio | 3 |
| H9 | Créditos recibidos/otorgados: edición y registro de abonos fallan | Contradice el estado documentado (use cases ya contemplan lifecycle y abonos). **NO asumir que falta backend.** Auditar primero: entidades, use cases, repositories, server actions, componentes, modales, formularios, relaciones con movimientos, cálculos de saldo. Determinar si el problema es backend, frontend, conexión UI→use case, validación, permisos, estado, modal, i18n o errores silenciosos. Corregir la causa real | 5 |
| H10 | **Compras a crédito / obligaciones por pagar** | **Requisito funcional más importante de la ronda. Requiere análisis de dominio ANTES de programar** (ver R2.5). Caso: compra de un bien a crédito sin recepción de dinero, con obligación frente al proveedor. NO implementar automáticamente como "Crédito Recibido". NO crear módulo de Compras; dejar base razonable para el futuro | 7 |
| H11 | Sidebar debe ocupar exactamente la altura disponible | Fijo/sticky según arquitectura actual, sin desplazarse con el contenido, manteniendo visibles usuario/email, selector de idioma y botón Salir. Funcionar en distintas alturas y en móvil. Evitar alturas mágicas tipo `height: 100vh` si rompen headers/safe areas; analizar el layout real y usar solución robusta | 2 |
| H12 | Botones de idioma y Salir inconsistentes | Dimensiones consistentes; el texto no debe alterar la altura. Cambiar "Cerrar sesión" por "Salir" + icono apropiado. Altura constante, ES/EN, hover/focus, tooltip si el sidebar está colapsado | 2 |
| H13 | Alturas de inputs inconsistentes (selects más delgados que inputs) | Unificar input, select, date, number, textarea y botones de formulario: tipografía ligeramente compacta, padding, line-height, border y radius unificados. Estilo preferido: controles compactos/delgados. **Resolver en los componentes UI reutilizables** (`src/components/ui/input.tsx`, `select.tsx`, …), no con decenas de correcciones individuales | 1 |
| H14 | Ventas POS a crédito | "Cliente general" NO válido para venta a crédito (cliente real obligatorio). Pago inicial registrable: 0 o monto positivo. La venta debe reflejarse en **Créditos Otorgados** permitiendo visualizar, registrar abonos, editar y calcular saldo. Coherencia: Venta POS → Cliente → Pago inicial → Crédito otorgado → Abonos → Saldo. **Sin duplicar movimientos ni contabilizar dos veces el dinero.** Auditar el flujo financiero existente antes de modificarlo | 6 |
| H15 | Tabla de transferencias muestra el valor dos veces | Mostrar UNA sola vez, color neutro, mismo tamaño tipográfico que el resto de tablas, ancho de columna razonable. Redistribuir columnas para aprovechar el contenedor | 8 |
| H16 | "Currency" sin traducir en Agregar Cuenta | Localizar correctamente. Auditar otros campos similares | 1 |
| H17 | Detalle de venta con información insuficiente | Mostrar como mínimo, cuando los datos existan: número/id de venta, fecha, cliente, estado, productos, cantidades, precios, subtotal, total, pago inicial, saldo pendiente, método de pago, información del crédito si corresponde. **No inventar datos que el dominio no tenga**; si falta información fundamental en la entidad Sale, indicarlo primero. Debe servir para venta de contado y a crédito | 6 |
| H18 | `alert()` nativos del navegador | Eliminarlos progresivamente. Acciones destructivas → Modal de confirmación; operaciones → Toast. Ejemplo: eliminar venta = modal "¿Deseas eliminar esta venta?" (Cancelar/Eliminar) + toast "Venta eliminada correctamente". Revisar TODAS las acciones destructivas (catálogo, movimientos, clientes, cuentas, créditos, etc.), no solo ejemplos | 1 |
| H19 | Aplicación demasiado sobria — falta color | Incorporar más color SIN saturar: usarlo para estados, acciones, categorías, métricas, ingresos, gastos, créditos, alertas, navegación y elementos destacados. Base neutra + design system existente; evitar colores arbitrarios por pantalla | 1 |
| H20 | Cursor pointer faltante en elementos interactivos | Ya solicitado antes y aún incumplido. Auditar TODOS los interactivos: botones, links, icon buttons, tabs, selects custom, acciones de tabla, menú, selector de idioma, sidebar, cards clicables, botones flotantes. Solución **centralizada en componentes UI**, no `cursor-pointer` manual por pantalla | 1 |
| H21 | Perfil de usuario | **NO implementar en esta ronda** → registrado como Roadmap (R2.14). Podría incluir: foto, nombre, datos personales, email, preferencias, idioma, eliminación de cuenta, cambio de contraseña | — |

\* Fase sugerida según la estructura preliminar de R2.8; la auditoría puede reordenarla si demuestra un orden técnicamente superior.

## R2.5 — H10 en detalle: obligaciones por compras a crédito

Caso real: el usuario compra un producto a crédito (ej. un perfume). No recibió dinero; tiene una obligación de pago. Datos posibles: valor total, pago inicial, saldo pendiente, abonos posteriores, fecha de compra, fecha de vencimiento opcional, descripción/proveedor. Actualmente no hay forma adecuada de registrar este escenario.

**Diferencia conceptual obligatoria:**

- **Crédito recibido:** el usuario recibe dinero/prestación financiera y queda obligado a devolverlo.
- **Compra a crédito / cuenta por pagar:** el usuario adquiere un bien o servicio y queda con una obligación frente al proveedor/vendedor.

Son conceptos diferentes. Determinar el modelo de dominio más coherente con TwinCap comparando al menos:

- **Alternativa A:** entidad **Cuenta por pagar / Payable**
- **Alternativa B:** entidad **Compra a crédito** que genera una obligación asociada
- **Alternativa C:** extender el modelo de créditos recibidos
- **Alternativa D:** otra solución arquitectónicamente más adecuada

No elegir solo por facilidad de implementación. Evaluar: semántica financiera, futuras compras, proveedores, pagos iniciales, abonos, saldo, reportes, dashboard, movimientos, cuentas, posibilidad futura de módulo Compras y compatibilidad con Clean/Hexagonal.

**Pago inicial:** puede ser 0, mayor que 0, nunca superior al valor total. Recalcular `saldo = total − pagoInicial − suma(abonos)` (adaptar al modelo de dominio). Validar en backend, nunca confiar solo en el frontend.

**Mini propuesta de dominio obligatoria antes de implementar** — debe responder:

1. ¿Qué entidad representa una obligación por compra?
2. ¿Es diferente de CreditReceived?
3. ¿Cómo se relaciona con una cuenta?
4. ¿Cómo se registra el pago inicial?
5. ¿Cómo se registran abonos?
6. ¿Cómo se calcula saldo?
7. ¿Cómo afecta los movimientos?
8. ¿Cómo afecta los balances?
9. ¿Cómo se relacionará posteriormente con proveedores?
10. ¿Cómo podría evolucionar hacia un futuro módulo Compras?

**No implementar hasta que el usuario apruebe la decisión de dominio.**

## R2.6 — Sistemas transversales

**Toast:** auditar el existente (creado en Ronda 1, Fase 6). Si existe, reutilizarlo y extenderlo; si no, diseñar uno ligero y coherente con la arquitectura, sin librería adicional sin justificar. Debe contemplar: éxito, error, advertencia, información, duración, cierre manual y accesibilidad.

**Confirmación:** modales de confirmación consistentes en toda la app: título, descripción, cancelar, confirmar, estado loading, ESC cuando sea apropiado, focus management, feedback posterior. **Una sola implementación compartida — no duplicar por módulo.**

## R2.7 — Auditoría transversal obligatoria

Además de H1–H21, revisar:

- **UX:** estados vacíos, loading, errores, confirmaciones, feedback, navegación, accesibilidad.
- **Responsive:** probar conceptualmente 375px, 768px y 1280px.
- **i18n:** buscar textos visibles hardcodeados.
- **UI:** botones inconsistentes, alturas diferentes, iconos diferentes, tamaños de texto inconsistentes, spacing inconsistente, colores arbitrarios.
- **Accesibilidad:** labels, aria-label, navegación por teclado, focus, contraste, modales, tooltips, botones icon-only.
- **Arquitectura:** lógica de negocio en componentes, duplicación, imports incorrectos entre capas, repositories mal instanciados, llamadas a DB sin `connectDb()`.
- **Seguridad:** acceso cruzado entre tenants, endpoints sin autorización, IDs manipulables, operaciones sensibles protegidas solo en frontend.

## R2.8 — Principios de solución

**Una solución estructural, no N parches (obligatorio):**

- Diez botones de eliminar inconsistentes → NO diez soluciones: crear/mejorar `ActionIconButton` o equivalente existente.
- Diez formularios con alturas distintas → corregir `Input`, `Select`, `DateInput`, etc., en `src/components/ui/`.
- Diez tablas con problemas → crear un patrón común, no copiar estilos.

La meta: una corrección estructural mejore múltiples módulos.

**Componentización:** antes de crear un componente → (1) buscar si ya existe, (2) determinar si puede reutilizarse, (3) extenderlo si es apropiado, (4) crear uno nuevo solo si tiene sentido. Genéricos en `src/components/ui/`; específicos en `src/components/[feature]/`.

## R2.9 — Entregables de la auditoría (resultado esperado ANTES de implementar)

En la primera interacción de trabajo de esta ronda, **sin escribir código**, entregar:

1. **Resumen ejecutivo** — estado actual de TwinCap.
2. **Auditoría técnica** — qué se encontró en el código.
3. **Matriz de hallazgos** — para cada H: estado, causa probable, impacto, prioridad, complejidad, dependencias, fase sugerida.
4. **Problemas adicionales** — hallazgos no presentes en la lista original.
5. **Propuesta de arquitectura para obligaciones/compras a crédito** — comparar alternativas A–D y recomendar una.
6. **Propuesta de evolución visual** — cómo aumentar ligeramente el color sin perder el carácter financiero/profesional.
7. **Propuesta de componentes reutilizables** — qué crear o mejorar.
8. **Plan definitivo por fases** — ordenado por dependencia, riesgo, impacto y prioridad.
9. **Criterios de aceptación por fase.**
10. **Cambios que NO deben hacerse** — documentado explícitamente.
11. **Preguntas** — solo si existe una decisión que no pueda resolverse inspeccionando el código.

## R2.10 — Plan DEFINITIVO por fases (post-auditoría, reemplaza la estructura preliminar)

Reordenado tras la auditoría de Fase 0 (ver R2.16) según dependencias reales del código. La auditoría demostró que un bug sistémico (`structuredClone` sobre entidades, P1) explica los síntomas de H9/H14/H17 y debe corregirse antes que cualquier trabajo visual o funcional sobre créditos/POS. Requiere aprobación explícita del usuario.

| Fase | Contenido | Hallazgos | Criterios de aceptación clave |
|------|-----------|-----------|-------------------------------|
| 0 | Auditoría completa + documentación (entregables R2.9) | R2.16 | ✅ Completada 2026-08-21 |
| 1 | **Serialización de entidades + i18n crítico**: reemplazar `structuredClone(entidad)` por serialización que preserve getters/toJSON en las 6 páginas afectadas; claves faltantes `Accounts.currency`, `CreditsReceived.currency`, `CreditsGranted.currency` (es/en); mapear enums crudos vía i18n (tipo de movimiento H5, tipo ítem POS, frecuencia de créditos); aria-labels del toast a i18n. Tests del helper de serialización | P1, H5, H16 | Saldo/pending visibles y botón "abonar" presente en créditos y ventas; "Tipo" localizado ES/EN; label de moneda localizado; sin NaN en ventas |
| 2 | **Fundaciones UI compartidas**: conectar tokens oklch existentes a `@theme` para generar utilidades; `cursor-pointer` centralizado en componentes ui (H20); alturas unificadas input/select/textarea con altura explícita + `appearance-none` en select (H13); variantes de tamaño de Modal (sm/md/lg); componente `ActionIconButton` icon-only con aria-label/tooltip/hover circular/colores semánticos/disabled (H4); adoptar y generalizar el `ConfirmDeleteButton` muerto → `ConfirmDialog` compartido y migrar los 10 `confirm()` nativos (H18); variante warning del toast | H13, H19 base, H20, H4, H18 | Un solo patrón de acción por icono en toda la app; cero `confirm()` nativos; selects e inputs misma altura; cursor pointer en todos los interactivos vía componentes compartidos |
| 3 | **Layout, navegación y carga**: sidebar desktop fijado al viewport (wrapper `lg:h-screen`, main con scroll propio; móvil ya correcto con `fixed inset-y-0`) (H11); unificar botones inferiores + icono LogOut + clave nueva "Salir" es/en (H12); depurar hamburguesa en runtime — sospecha principal: service worker sirviendo JS stale (probar network-first/skipWaiting para navigations y JS) — y añadir a11y: aria-expanded/controls, Escape, bloqueo de scroll de fondo (H1); corregir cadena `/`→redirect→dashboard: evaluar destino directo del link según sesión y/o loading.tsx en raíz y dashboard (sin ocultar recargas artificiales) (H3); añadir loading.tsx faltantes (raíz, dashboard, clients); cookie NEXT_LOCALE con SameSite/Secure; evaluar reemplazo de `window.location.reload()` del toggle de idioma | H1, H3, H11, H12 | Sidebar con controles inferiores siempre visibles en desktop; navegación a inicio fluida con skeleton; drawer operable por teclado y accesible |
| 4 | **Tablas y acciones**: decidir entre revivir `ui/table.tsx` (preferido, ya trae min-w-full) o parche estructural `w-full` + `min-w` en las 8 tablas hand-rolled (H2); migrar todas las acciones de tabla a `ActionIconButton` de Fase 2 (movements, transfers, clients, accounts, categories ×2, abonos de créditos, listas POS) (H4 fin); transferencias: monto UNA vez, color neutro, redistribución de columnas (H15) | H2, H4, H15 | Ninguna tabla deja espacio muerto a la derecha; montos de transferencia una sola vez; acciones consistentes con tooltip y aria |
| 5 | **Movimientos**: eliminar compuerta del filtro — el formulario SIEMPRE abre con cuenta como campo obligatorio dentro; preselección de cuenta si hay filtro concreto (decidir UX al iniciar la fase) (H6); compactar Nuevo Movimiento: agrupación Selección→Datos introducidos, 2 columnas desktop usando modal lg de Fase 2, 1 columna móvil (H7); acción global ingreso/gasto desde cualquier vista autenticada: provider hermano de ToastProvider en `(main)/layout` + trigger flotante, fetch perezoso de cuentas/categorías al abrir, reutilizando el mismo formulario (H8) | H6, H7, H8 | Agregar movimiento funciona con filtro "Todas las cuentas"; formulario compacto; ingreso/gasto alcanzable desde todos los módulos autenticados |
| 6 | **Créditos**: cablear `edit-principal` (use case existe y está testeado en ambas variantes): server actions received+granted + formulario de edición (H9); agregar delete-abono para créditos (paridad con ventas: use case existe, faltan action+botón); corregir deriva de saldo: `editAbono` debe actualizar también el movimiento vinculado (atómico); verificación end-to-end de editar crédito / registrar / editar / borrar abono post-Fase 1 | H9 | Editar monto de crédito refleja movimiento principal (ya cascada) y editar/borrar abono mantiene saldo == movimientos; UI completa operable |
| 7 | **POS Ventas**: cliente real obligatorio cuando paymentMode=on-credit (validación backend + form) (H14); pago inicial: campo DTO + form (0 permitido, ≤ total), genera 1 movimiento income parcial kind salePayment; vínculo venta↔crédito otorgado (campo de referencia nuevo), visible/editable/abonable desde Créditos Otorgados; SIN doble contabilidad (diseñar mapa de movimientos antes de codear y presentarlo) ; detalle de venta completo: id, fecha, cliente, modo/estado, ítems con nombre resuelto (join catálogo), cantidad, precio unitario, subtotal, total, pago inicial, pendiente, abonos, cuenta, moneda; contado y crédito (H17) | H14, H17 | Venta a crédito aparece en Créditos Otorgados con saldo correcto; abono único genera un único movimiento; detalle muestra todo dato existente en la entidad sin inventar campos |
| 8 | **Obligaciones / compras a crédito** — COMPUERTA: mini propuesta de dominio (R2.5, 10 preguntas, alternativas A–D) → aprobación del usuario → implementación. Recomendación previa de auditoría: Alternativa A (+patrones de D): entidad `Payable` espejo del stack CreditReceived (template identificado en R2.16), abonos embebidos, saldo derivado, movimientos system-linked kinds nuevos (`payableInitialPayment`, `payableAbono`); pago inicial 0 ⇒ 0 movimientos al crear. NO módulo Compras | H10 | Dominio aprobado; CRUD completo con pagos iniciales, abonos y saldo consistente con movimientos/balances; base lista para futuro Compras |
| 9 | **Consistencia visual y módulos restantes**: migrar colores semánticos hardcodeados (green/emerald/rose/red dispersos ~90 usos) a utilidades de tokens de Fase 2 — estandariza emerald vs green y rose vs red (H19 fin); pulido cuentas/categorías/dashboard; barrido de traducciones restantes; estados vacíos y feedback revisados | H19, residuales H5/H16 | Paleta semántica única vía tokens; cero colores arbitrarios por pantalla; dark mode intacto |
| 10 | **Auditoría transversal final + estabilización**: barridos UX/responsive 375-768-1280/i18n/accesibilidad/seguridad/arquitectura de R2.7; resolver deuda detectada en auditoría: contrato findById (port vs NotFoundError), campos dropeados en add-sale-abono, dead code (editSaleLineItem wire-o-remove, ui/table decisión final); roundtrip extra de DB por navegación ((main)/layout solo para email); `pnpm test` + `pnpm lint` + `pnpm build` verdes; actualización de este documento y roadmap (perfil usuario sigue en roadmap) | R2.7, P-lista | Los tres comandos en verde; checklist transversal sin CRITICAL pendiente |

Compuertas de aprobación dentro del flujo: Fase 8 (decisión de dominio H10). Decisiones menores que se presentan al iniciar su fase: preselección de cuenta (F5), mapa de movimientos POS (F7).

La numeración respeta la estructura preliminar del usuario salvo: fundaciones divididas en dos (serialización primero porque desbloquea créditos/POS), tablas separadas de layout (dependen de ActionIconButton de Fase 2), y consistencia visual al final (aplica tokens construidos en Fase 2).

## R2.11 — Protocolo de implementación por fase

**Antes:** explicar brevemente qué se modificará, archivos probables, riesgos y pruebas.

**Durante:** implementar ÚNICAMENTE la fase aprobada. No introducir funcionalidades de otras fases. Si aparece una dependencia crítica: DETENERSE y explicarla.

**Después:** ejecutar `pnpm test`, `pnpm lint`, `pnpm build` (cuando corresponda) e informar:

- Cambios realizados
- Archivos modificados
- Tests
- Resultado
- Problemas encontrados
- Pendientes
- Nuevos hallazgos

Luego: **DETENERSE Y ESPERAR APROBACIÓN.**

## R2.12 — Criterios de aceptación de una fase

Compilar NO basta. Una fase está terminada cuando:

- Funciona.
- No rompe funcionalidades anteriores.
- Respeta arquitectura, i18n y multi-tenancy.
- Funciona en móvil y desktop.
- Maneja loading, error y estado vacío cuando corresponda.
- Tiene feedback al usuario.
- Incluye tests cuando haya lógica funcional nueva.

## R2.13 — Reglas de alcance y dependencias

**Cambios de alcance:** si durante una fase algo requiere modificar código fuera de su alcance, NO hacerlo automáticamente. Explicar por qué es necesario, qué archivos afecta, qué riesgo tiene y qué alternativas existen. Solicitar aprobación.

**Dependencias:** no instalar nuevas salvo necesidad real. Escalafón de preferencia: (1) código existente, (2) componentes existentes, (3) APIs nativas, (4) capacidades de Next.js/React, (5) capacidades de Tailwind, (6) dependencias ya instaladas, (7) nueva dependencia como último recurso. Máximo UNA nueva por fase salvo justificación excepcional. Si se propone una: explicar por qué, qué problema resuelve, por qué no puede resolverse con lo existente y qué impacto tiene.

## R2.14 — Cambios que NO deben hacerse

- No implementar nada antes de la aprobación del plan definitivo (incluida la decisión de dominio de H10).
- No crear un módulo de Compras — solo dejar base razonable para el futuro.
- No cambiar el stack, ni migrar frameworks, ni introducir otra librería de componentes UI o de iconos.
- No reescribir la aplicación; no introducir soluciones artificiales que solo oculten recargas reales (H3).
- No implementar el módulo de perfil de usuario en esta ronda (roadmap).
- No crear una solución diferente por pantalla para el mismo problema — ir siempre al componente/patrón compartido.
- No hardcodear textos visibles ni confiar en validaciones solo-frontend.
- No ocultar ni eliminar tests fallidos.

## R2.15 — Roadmap futuro (registrado, fuera de esta ronda)

- **Perfil de usuario (H21):** foto, nombre, datos personales, email, preferencias, idioma, eliminación de cuenta, cambio de contraseña. Implementar solo si el análisis encuentra una dependencia directa.
- **Módulo Compras:** evolución natural de H10; la solución de obligaciones debe dejar la base lista para que exista posteriormente.

## R2.16 — Resultados de la auditoría (Fase 0, 2026-08-21)

Método: 4 exploraciones paralelas de solo lectura sobre el código real (layout/navegación · dominio créditos/ventas · tablas/feedback · formularios/i18n). Sin modificaciones.

### Salud general verificada

- `connectDb()` en 29/30 actions (la excepción es logout, sin DB) ✓ — sin repositories a nivel de módulo ✓
- Capas limpias: ningún componente importa models/repos; scoping por userId consistente en todo el stack, incluidos `$push/$pull` ✓
- i18n: paridad es/en perfecta (327/327 claves) ✓
- Cero `alert()` nativos; cero doble contabilidad hoy (venta a crédito genera 0 movimientos)

### Causas raíz verificadas (H1–H20)

| H | Estado | Causa raíz (evidencia) |
|---|--------|------------------------|
| H1 | Código estático correcto; falla runtime | Sospecha principal: `public/sw.js` stale-while-revalidate sirve JS viejo tras redeploy → hidratación muerta (`return cached \|\| fetched`). Agravado: drawer sin aria-expanded/Escape/focus-trap y con scroll de fondo |
| H2 | Confirmado estructural | Tablas hand-rolled con `min-w-[Npx]` SIN `w-full` → shrink-to-fit. `ui/table.tsx` existe pero es DEAD CODE (0 imports). 8+ tablas duplican el patrón |
| H3 | Confirmado | `/` redirige authed→`/dashboard` (commit abd24a2): doble fetch RSC, ambos force-dynamic con queries DB, sin loading.tsx en ninguna pata. Toggle de idioma además usa `window.location.reload()`. Faltan loading.tsx en raíz/(main)/dashboard/clients |
| H4 | Confirmado | Botones Trash2/Pencil/Eye con TEXTO, no icon-only; sin ActionIconButton compartido; estilos dispersos (ghost rojo vs raw indigo) |
| H5 | Confirmado trivial | `movements-list.tsx:153` renderiza `{movement.type}` crudo ("income"/"expense"). Claves YA existen (`Movements.income`=Ingreso). Mismo patrón crudo: tipo ítem POS (`sale-form.tsx:195`) y frecuencia de créditos (×2 listas `:83`) |
| H6 | Confirmado | Compuerta DENTRO del modal: `selectedAccountId==='all'` muestra mensaje estático en vez del form (`movements-list.tsx:63-73`). El botón siempre abre el modal; filtro es useState local |
| H7 | Confirmado | `movement-form.tsx` 7 campos apilados `space-y-4`; TODOS los modales limitados a `max-w-md` (`modal.tsx:48`) → imposible 2 columnas. Violadores también: account/category/client forms |
| H8 | Confirmado | Form montado SOLO en movements-list. Montaje global viable: provider hermano de ToastProvider en `(main)/layout`; fetch perezoso recomendado para no penalizar cada página |
| H9 | **NO es backend** | `structuredClone(entidad)` en pages destruye getters de prototipo → `credit.pending`===undefined client-side → botón "abonar" oculto (`pending>0` falso), tabla de abonos oculta, badge "paidInFull". Backend completo y correcto. Además: edit-principal existe+testeado pero SIN action ni form; delete-abono sin action/botón en créditos; ⚠️ P10 desactualizada: la cascada de editAbono SÍ existía desde 08c4d13 (ver corrección en Fase 6) |
| H10 | Sin concepto existente | Venta on-credit: NO crea CreditGranted, sin campo de linkage, sin pago inicial (ni DTO ni form), "Cliente general" permitido en ambos modos. Template a replicar identificado (stack CreditReceived completo) |
| H11 | Confirmado desktop-only | Wrapper `flex min-h-screen` (no viewport-lock) + aside `lg:static` → sidebar crece con el contenido; controles inferiores quedan fuera de pantalla. Móvil OK (`fixed inset-y-0`) |
| H12 | Confirmado | Idioma: outline+icono vs Salida: filled solo-texto; clave actual "Cerrar sesión"/"Logout"; no existe "Salir"; literales 'EN'/'ES' hardcodeados (nav.tsx:113,151) |
| H13 | Confirmado | Clases de input/select BYTE-IDénticas; la diferencia es rendering nativo del `<select>` → fix = altura explícita (h-10) / appearance-none en componentes compartidos |
| H14 | Confirmado | Ver H10 + falta validación de cliente real; sin riesgo de doble conteo hoy porque no se genera nada |
| H15 | Confirmado | `transfers-list.tsx:93-106`: celda única renderiza SIEMPRE −monto y +monto aunque sea misma moneda |
| H16 | Confirmado trivial | Clave `Accounts.currency` NO existe → fallback `ns[key]??key` imprime literal "currency" en ambos idiomas. Igual en CreditsReceived/CreditsGranted. (Catalog.currency sí existe) |
| H17 | Confirmado | Detalle = fila expandida (`sale-list.tsx:138-170`): faltan nombres de ítems (itemId nunca resuelto), precio unitario, cuenta, createdAt, visibilidad soft-delete; moneda heurística (primer ítem) |
| H18 | Parcial | 0 alert(); 10 `confirm()` nativos copy-paste en deletes. `ConfirmDeleteButton` en ui/ EXISTE pero DEAD CODE (0 imports). Abonos de crédito no son borrables (sí los de venta) |
| H19 | Base construida y sin usar | Tokens oklch semánticos DEFINIDOS en globals.css (success/danger/warning/info/debt/income/expense, light+dark) pero generan 0 utilidades (@theme inline solo mapea bg/fg/fonts) y nadie los consume. Realidad: indigo/zinc + green(30)/red(57)/emerald/rose/amber/sky/orange dispersos e inconsistentes |
| H20 | Confirmado masivo | Solo 2 usos de cursor-pointer en toda la app (filas de créditos); Button/Select/Modal/Card/SearchableSelect todos lo carecen (Tailwind v4 quitó pointer default) |

### Hallazgos adicionales (no estaban en la lista)

- **P1 (crítico, sistémico):** `structuredClone(entidad)` en 6 páginas (credits ×2, transfers, pos/sales, pos/catalog, movements) destruye getters/toJSON — causa única de los síntomas H9/H14/H17 del lado UI.
- P2: dead code — `ui/table.tsx`, `ConfirmDeleteButton`, use case `editSaleLineItem` (exportado, jamás cableado).
- P3: `add-sale-abono.ts:69-80` reconstruye Sale dropeando clientId/deletedAt/stockRestored (trampa latente).
- P4: contrato repos `findById`: port declara `Promise<X|null>` pero implementaciones lanzan NotFoundError.
- P5: roundtrip extra de DB por navegación: `(main)/layout` corre getCurrentUser+findById solo para renderizar un email.
- P6: cookie NEXT_LOCALE sin SameSite/Secure.
- P7: toast sin variante warning; aria-labels en inglés hardcodeado ("Dismiss", "Notifications").
- P8: inconsistencia semántica de color emerald vs green y rose vs red entre Badge/Toast/listas.
- P9: drawer móvil sin focus management ni Escape ni bloqueo de scroll; links sin aria-current.
- P10: ~~edit-abono de crédito no actualiza movimiento vinculado~~ **CORREGIDO 2026-08-22 (Fase 6): afirmación desactualizada** — la cascada SÍ existía desde `08c4d13` (17/08, previo a esta auditoría), verificada en use case + mapper + `$set` + tests preexistentes.
- P11: falta delete-abono en créditos (paridad con ventas).
- P12: toggle de idioma fuerza recarga completa (window.location.reload).
- P13: detalle de venta no distingue ventas soft-deleted.

### Template para Payable (Fase 8) — stack CreditReceived a replicar

domain/credit-received.ts (+port en repositories.ts) → infrastructure/models → mappers → repositories → core/application/credits-received/{create,add-abono,edit-abono,delete-abono,delete,edit-principal}+dto → app/(main)/credits/received/{actions,page,*-form,*-list}.

---

## PROTOCOLO POST-COMPACTACIÓN

Si el contexto se compacta o inicia nueva sesión:

1. **Leer este archivo completo** (`docs/AUDIT-AND-PLAN.md`)
2. **Leer `AGENTS.md`**
3. **Buscar en Engram:** `mem_search(query: "TwinCap ronda 2 fase", project: "globalmoney")`
4. **Identificar la fase actual** comparando el último commit con la tabla de estado de arriba
5. **Continuar desde la fase pendiente**, respetando el protocolo R2.11 (detenerse y esperar aprobación al terminar cada fase)
6. Recordar: si el estado es "auditoría pendiente" o "plan sin aprobar", NO implementar nada

---

## BITÁCORA

- 2026-08-19 — Creación del plan maestro (Ronda 1, 12 fases identificadas).
- 2026-08-20 — Ronda 1 completada: fases 0–22 ejecutadas y commiteadas.
- 2026-08-21 — Reescritura del documento para la **Ronda 2** (fuente: `Ronda 2.md`). Estado: Fase 0 (auditoría) pendiente; implementación bloqueada hasta aprobación del plan.
- 2026-08-21 — **Fase 0 completada.** Auditoría técnica del código real (4 exploraciones paralelas, read-only). Causas raíz verificadas H1–H20 + 13 hallazgos adicionales → sección R2.16. Descubrimiento clave: bug sistémico P1 (`structuredClone` destruye getters) explica los síntomas de H9/H14/H17 — el backend de créditos/abonos está completo y correcto. R2.10 reemplazada por el plan definitivo de 10 fases reordenado por dependencias reales. Esperando aprobación del usuario para iniciar Fase 1.
- 2026-08-21 — **Fase 1 implementada (serialización + i18n crítico).** Plan aprobado por el usuario. Cambios: helper `src/lib/serialize.ts` (`serializeEntity`/`serializeEntities` vía `toJSON()`) + tests; `toJSON()` + tipos `Serialized*` agregados a Account, Category, Client, CatalogItem, Movement, Transfer (Credit/Sale ya los tenían, se exportaron sus DTO types); las 6 páginas afectadas (credits ×2, transfers, pos/sales, pos/catalog, movements) serializan con `toJSON` en vez de `structuredClone`; componentes cliente re-tipados a `Serialized*`. i18n: claves nuevas `Common.dismiss/notifications`, `Accounts.currency`, `CreditsReceived.currency`, `CreditsGranted.currency` (es/en, paridad intacta); enums crudos mapeados: tipo de movimiento → `t(movement.type)` (claves existentes), tipo ítem POS → `tCatalog(type_*)`, frecuencia créditos → `t(credit.frequency)` (claves weekly/biweekly/monthly existentes); aria-labels del toast a i18n. Verificación: **279/279 tests ✅ · lint 0 errores (8 warnings preexistentes en edit-abono-forms, se limpian en Fase 6) · build ✅**. Fix manual post-agente: fixtures de 4 test files usaban `userId: ''` en `new Category(...)` y el constructor lo valida — corregido a `'user-1'`. Commit de la fase + `Ronda 2.md` (lineamientos de la ronda, antes sin trackear) en un solo commit. **PAUSA: el usuario pedirá explícitamente continuar con Fase 2.**
- 2026-08-21 — **Fase 2 implementada (fundaciones UI compartidas).** Aviso explícito del usuario recibido. Cambios: (1) tokens oklch semánticos ahora generan utilidades Tailwind — vars renombradas a `--tc-*` en `:root` + dark media query, mapeadas en `@theme inline` como `--color-*` → utilidades dinámicas `bg-success`, `text-danger`, `ring-primary`, modificadores de opacidad incluidos; grep previo confirmó cero consumidores externos de los nombres viejos; dark mode intacto (prefers-color-scheme). (2) `cursor-pointer` centralizado en Button/Select/SearchableSelect/Modal-close (H20). (3) Alturas unificadas `h-10` en Input/Select/SearchableSelect-trigger; Select con `appearance-none` + chevron Lucide posicionado, sigue server-renderable con forwardRef (H13). (4) Modal `size?: sm|md|lg` (default md = comportamiento actual píxel-idéntico; lg=max-w-2xl para Fase 5). (5) Nuevo `ui/action-icon-button.tsx`: icon-only circular, tonos neutral/primary/danger/success/warning mapeados a utilidades de token, aria-label + title tooltip, loading/disabled (H4 — adopción masiva en Fase 4). (6) H18: nuevo `ui/entity-delete-button.tsx` (flujo único: trigger→ConfirmDialog→action imperativa `(null, formData)`→toast→refresh, soporta multi-campo y stopPropagation para filas clickeables) + `ui/confirm-dialog.tsx` (sobre Modal size=sm); los 10 delete buttons migrados a wrappers finos (−586/+208 líneas); **cero `confirm()` nativos**; dead code `ui/confirm-delete-button.tsx` eliminado. Desviaciones intencionales documentadas: triggers mantienen su visual previo (ghost+rojo, no danger filled), diálogo permanece abierto con spinner durante la petición, errores thrown ahora logueados por consola, bug preexistente corregido (accounts/movements/transfers/categories mostraban label literal "delete" por clave faltante → ahora `Common.delete`). (7) Toast variante `warning` (amber-500 + AlertTriangle); tipo `ToastVariant` unificado en una sola fuente. Test nuevo: `src/i18n/messages-parity.test.ts` (paridad recursiva es/en — sin claves nuevas necesarias). Verificación: **281/281 tests ✅ · lint 0 errores (mismos 8 warnings conocidos) · build ✅**. Pendiente consciente: dropdown nativo del Select conserva opciones del OS (delta visual solo en el control cerrado). Commit único de la fase. **PAUSA: el usuario pedirá explícitamente continuar con Fase 3 (layout/navegación/carga).**
- 2026-08-21 — **Fase 3 implementada (layout, navegación y carga).** Aviso explícito del usuario recibido. Cambios: (H11) wrapper `(main)/layout` → `min-h-screen lg:h-screen lg:overflow-hidden`; aside interno flex-col (nav `flex-1 overflow-y-auto`, bloque inferior `mt-auto`) → desktop sin scroll de página, `<main>` único scroll, controles inferiores siempre visibles; móvil intacto. (H12) claves nuevas `Nav.exit` "Salir"/"Log out" + eliminada la muerta `Nav.logout` (única consumidora era nav.tsx); botón Salir con icono LogOut y estilo idéntico al selector de idioma (ambos h-10 outline); literales 'EN'/'ES' se mantienen a propósito (autónimos del idioma, práctica estándar — decisión documentada). (H1) runtime ya mitigado por 9cb9c51 (SW network-first) — esta fase NO tocó la estrategia; se corrigió el hallazgo pendiente de review: STATIC_ASSETS deja de precachear `/` y `/dashboard` (HTML autenticado persistido cross-user) → CACHE_NAME v4; drawer: aria-expanded/aria-controls, Escape cierra, scroll-lock de fondo (con guard matchMedia ≥lg para no trabar el body si se redimensiona con drawer abierto), aria-current="page", focus al primer link al abrir y retorno al hamburguesa al cerrar. (H3) NAV_ITEMS[0] ahora apunta directo a `/dashboard` (elimina la cadena `/`→redirect→dashboard en el click normal; el redirect de `/` queda para bookmarks); loading.tsx nuevos en raíz (mínimo), dashboard (espeja estructura real: header+4 cards+2 col+accounts) y clients (mismo contenedor max-w-3xl). (P6) cookie NEXT_LOCALE con `sameSite:'lax'` + `secure` en producción. (P12) toggle de idioma: `router.refresh()` en vez de `window.location.reload()` — seguro porque los mensajes fluyen server→cliente por props en cada pasada RSC sin caché module-level (verificado en mapeo); html lang se actualiza vía RSC. Verificación: **281/281 tests ✅ · lint 0 errores (mismos 8 warnings conocidos) · build ✅**. Pendiente de prueba humana en browser: drawer por teclado, scrollbar única en desktop, toggle ES↔EN sin recarga visible, purga de cache v3 del SW. Commit único de la fase. **PAUSA: el usuario pedirá explícitamente continuar con Fase 4 (tablas y acciones).**
- 2026-08-22 — **Fase 4 implementada (tablas y acciones).** Aviso explícito del usuario recibido. Antes de la fase se diagnosticó (Engram obs #91) el error móvil al entrar tras cada deploy: teléfono con el SW viejo v1 (stale-first para TODO + precache de HTML autenticado de `/dashboard`); resuelto por el usuario limpiando datos del sitio — el sw.js actual (v4, network-first) ya era correcto; mejora opcional pendiente: auto-recuperación ante chunks stale (purge + un solo reload por sesión). Cambios de la fase (23 archivos, +103/−89): (H2) DECISIÓN DOCUMENTADA: NO revivir `ui/table.tsx` — su API genérica `Column<T>` no apta para filas con badges/celdas compuestas/acciones interactivas (reescritura de alto churn sin beneficio); parche estructural elegido: `w-full` junto al `min-w-[Npx]` existente en las 5 tablas hand-rolled (transfers 700 · movements 600 · clients 500 · accounts 400 · categories 300) → llenan el contenedor en desktop, mantienen scroll horizontal a 375px; contenedores overflow-x verificados; abonos sub-tables ya estaban bien (`min-w-full`); `ui/table.tsx` sigue dead code — remoción final decidida en Fase 10. (H4 fin) todas las acciones de fila ahora icon-only vía `ActionIconButton`: `EntityDeleteButton` extendido con prop `iconOnly` (trigger = ActionIconButton tone danger, fallback Trash2) reutilizando íntegro el pipeline ConfirmDialog→action→toast→refresh + stopPropagation; los 10 delete buttons migrados sin overrides divergentes (accounts ganó su Trash2 faltante); inline: editar abono ×2 → Pencil/primary (stopPropagation preservado), detalles venta → Eye/EyeOff primary con label dinámico `Sales.details`/`Sales.hide`, editar catálogo → Pencil/primary con `Catalog.edit`; `ActionIconButton.onClick` ahora recibe MouseEvent (cero consumidores previos, verificado); los CTAs etiquetados "Agregar abono"/Cancelar NO se convirtieron a propósito (toggle icon-only destruiría la affordance cancelar). (H15) transferencias: misma moneda → UN solo monto neutro (`font-medium text-zinc-900 dark:text-white text-sm nowrap`, mismo tamaño que otras tablas); monedas distintas → `X CUR → Y CUR` + rate existente; header plural `Transfers.amounts` → reutilizada `Common.amount`; espacio redistribuido (fecha nowrap, descripción 200→280px, nota cap 200px). i18n: única clave nueva `Common.edit` es/en (paridad ✅); `Transfers.amounts` quedó huérfana → barrido Fase 9. Verificación: **281/281 tests ✅ · lint 0 errores (8 warnings conocidos) · build ✅ · tsc --noEmit ✅** — re-verificado independientemente por el orquestador tras el agente. Hallazgos fuera de alcance registrados: header de columna de acciones en clients usa `Clients.delete` ("Eliminar") en vez de "Acciones" como el resto (cosmético); heurística de moneda en sale-list sigue pendiente (H17/Fase 7). Pendiente de prueba humana: tap targets a 375px en panel expandido de créditos (CTA Plus + trash cercanos). **PAUSA: el usuario pedirá explícitamente continuar con Fase 5 (movimientos).**
- 2026-08-22 — **Fase 5 implementada (movimientos).** Aviso explícito del usuario recibido. Decisión menor presentada al iniciar la fase y aprobada: PRESELECCIÓN DE CUENTA activada (filtro de cuenta concreta ⇒ form abre con esa cuenta; filtro "Todas las cuentas" ⇒ vacía). Cambios: (H6) compuerta eliminada — "Agregar movimiento" SIEMPRE abre el formulario; cuenta ahora es select obligatorio dentro del form; validación backend verificada intacta (constructor `Movement` lanza con accountId vacío, movement.ts:103). (H7) form compacto en dos fieldsets etiquetados "Selección"/"Datos ingresados", grid 1 col móvil / 2 cols sm+ dentro de `Modal size="lg"` (max-w-2xl de Fase 2); cero campos removidos, semántica de validación intacta. (H8) nuevo `GlobalMovementProvider` en `(main)/layout.tsx`: contexto `useQuickMovement() → openQuickMovement({type?, accountId?})`; DESVIACIÓN JUSTIFICADA del plan: monta DENTRO de ToastProvider envolviendo `<main>` (no hermano) porque MovementForm consume useToast que lanza fuera del provider; FAB fija bottom-right con safe-area insets, z-30 (bajo drawer z-40 y Modal/Toast z-50), speed-dial Ingreso/Egreso (TrendingUp/TrendingDown) con Plus↔X morph, capa transparente outside-tap, Escape, aria-expanded/controls, focus al abrir vuelve al FAB al cerrar; fetch perezoso UNA sola vez por sesión (caché one-shot con estado error→retry) vía NUEVAS actions read-only `listAccountsAction`/`listCategoriesAction` (getCurrentUser → connectDb → repos dentro de la función → serializeEntities, boundary respetado); movements-list elimina su modal local y rutea por el provider (UNA sola instancia del patrón formulario); presets aplican frescos porque Modal hace `if (!open) return null` (remount). Helper puro nuevo `resolveDefaultAccountId` (+`filterCategoriesByType` extraído) en src/lib/movement-form.ts con 8 tests. i18n: 5 claves nuevas `Movements.quickAdd`, `quickAddMenu`, `groupSelection`, `groupDetails`, `selectAccount` es/en (paridad ✅); reutilizadas income/expense/newMovement/noAccounts/loading/retry. Verificación: **289/289 tests (31 archivos) · lint 0 errores (8 warnings conocidos) · build ✅ · tsc --noEmit ✅** — re-verificado independientemente por el orquestador. ⚠️ Hallazgo fuera de alcance PRIORIZABLE: `create-movement` NO verifica existencia/ownership de la cuenta — un accountId fabricado crearía un movimiento huérfano (sin leak cross-user: balances derivan de queries scoped por userId; gap de integridad referencial). Requiere agregar repo de cuentas como param del use case → tratar en Fase 10 o fix puntual aprobado. Otros registrados: currency del form no se alinea automáticamente con la moneda de la cuenta elegida (preexistente); clave muerta `Movements.selectAccountToAdd` y condición residual → Fase 10. Pendiente prueba humana: FAB vs CTAs de página a 375px, legends en dark mode. **PAUSA: el usuario pedirá explícitamente continuar con Fase 6 (créditos).**
- 2026-08-22 — **Fases 5/6 fixes post-prueba humana + Fase 6 implementada (créditos).** Fixes de la Fase 5 reportados por el usuario y verificados: (09a7c23) el speed-dial del FAB no lanzaba el modal — capa invisible outside-tap (positioned) pintaba sobre los botones estáticos del menú (paint order CSS); fix: `relative` en el contenedor del menú, mismo patrón del Modal propio. GOTCHA registrado: jsdom/vitest NO detectan bugs de paint-order/hit-testing — testing manual obligatorio para overlays. (1c536d2) Modal compartido sin max-height ni scroll: formularios largos quedaban recortados arriba/abajo por centrado flex; fix estructural en ui/modal.tsx: root p-4, diálogo flex max-h-full flex-col, header/actions shrink-0, cuerpo min-h-0 flex-1 overflow-y-auto — TODOS los modales de la app heredan el arreglo. FASE 6: (H9a) edit-principal cableado ×2: actions `editCreditReceivedAction`/`editCreditGrantedAction` + forms nuevos `edit-credit-form.tsx` (Modal md, patrón catalog-list editingItem; Pencil ActionIconButton en fila header con stopPropagation; moneda oculta a propósito — es derivada de la cuenta al leer, los mappers persisten solo principal.amount, un select editable sería no-op silencioso). (H9b) delete-abono ×2 con paridad total de ventas: actions nuevas + EntityDeleteButton iconOnly en tablas de abonos; los use cases ya hacían `$pull` del abono embebido + delete del movimiento vinculado vía abono.movementId. (P10) **CORRECCIÓN DE AUDITORÍA**: la cascada editAbono→movimiento ya existía desde `08c4d13` (17/08, ANTERIOR a la auditoría del 21/08) — verificada por el orquestador con evidencia (git show + tests preexistentes "keeps saldo == sum(movements)"). No se re-implementó; se endurecieron tests (+8: invariante embedded abono == movimiento, skip sin movementId, errores). Atomicidad: SIN transacción Mongo — ports no aceptan ClientSession y cambiar todas las firmas es rediseño de infraestructura fuera de alcance; dual-writes dentro de la invocación única del use case con limitación documentada en comentarios en los 6 use cases dual-write (create/add/edit/delete abono, editPrincipal, deleteCredit). (Item 4 prometido desde Fase 1) los 8 warnings históricos de edit-abono-forms eliminados → lint queda 0 errores / 0 warnings. i18n: 4 claves nuevas `CreditsReceived.editCredit`, `CreditsReceived.confirmDeleteAbono`, `CreditsGranted.editCredit`, `CreditsGranted.confirmDeleteAbono` es/en; toasts reutilizados. Verificación: **297/297 tests (31 archivos) · lint 0 err / 0 warnings · build ✅ · tsc ✅** — re-verificado independientemente por el orquestador. Hallazgos fuera de alcance: P4 muerde créditos — findById lanza NotFoundError vs port Promise<X|null>: si el usuario borra directamente un movimiento vinculado desde Movements, editar/borrar ese abono falla duro ("Movement not found") → Fase 10; drift latente: EditAbonoInput.accountId llega al movimiento pero nunca se persiste al abono embebido (creditRepo.editAbono carece del campo) — hoy inexercitado; SIN guard para borrar movimientos system-linked desde Movements (rompe saldo↔balance por diseño) → decisión de producto Fase 10. Pendiente E2E humano: editar monto principal refleja movimiento y recalcula pending; add/edit/delete abono mantiene saldo==balance tras refresh; principal < suma abonos muestra toast de conflicto; delete-abono elimina el movimiento de la lista; ES/EN del modal nuevo; pencil/trash no disparan expansión de fila. **PAUSA: el usuario pedirá explícitamente continuar con Fase 7 (POS ventas).**
- 2026-08-22 — **Fase 6 desplegada (`6d720ca` push) + Fase 7 implementada (POS Ventas).** MAPA DE MOVIMIENTOS presentado al usuario y aprobado ANTES de codear (regla R2.10 anti doble-contabilidad), versión aprobada: contado sin cambios (1 income total, kind `salePayment`); venta a crédito auto-crea CreditGranted VINCULADO con campo nuevo `saleId`, principal guardado = total − pagoInicial (deuda NETA), SIN movimiento de principal (salió mercadería, no dinero); pagoInicial>0 → exactamente 1 income kind `salePayment`; abonos posteriores ya existentes (income, `creditGrantedAbono`). Invariante: pending ≡ total − inicial − Σabonos. Decisión del usuario: pagoInicial = total PERMITIDO → crédito nace pagado. Cuotas/frecuencia vacías para créditos de venta (pago libre). El crédito standalone NO cambia (sigue con su gasto de principal). Implementación: (H14 backend) `CreateSaleInput.initialPayment?: number` + validación UP-FRONT antes de cualquier write (on-credit exige cliente real existente del usuario; inicial ∈ [0,total]); params nuevos del use case: ClientRepository + CreditGrantedRepository; helper `buildSalePaymentMovement` deduplica el movimiento de pago. (H14 form) selector de cliente obligatorio en modo crédito + campo pagoInicial solo visible en crédito, default 0, validación client-side ≤ total. (H17) use case `get-sale-detail` + action + `sale-detail-modal.tsx`: id, fecha, cliente resuelto, modo, estado derivado paid/pending, cuenta, tabla de ítems con nombre resuelto por join de catálogo (deleted→fallback i18n), cantidad, precio unitario, subtotal, total, inicial y pendiente condicionales a on-credit, abonos del crédito vinculado (si está gestionado en Créditos muestra nota `managedInCredits` sin acciones inline). **Hallazgo de dominio:** `Money` exigía amount>0 globalmente → un crédito nacido pagado (principal=0) era irrepresentable; solución acotada `Money.nonNegative()` SOLO para principals de crédito (constructor estricto intacto para los ~15 flujos transaccionales); mapper reconstruction actualizado o el 0 persistido explotaba al cargar. Edge conocido: edit-principal sigue usando Money estricto → no se puede editar principal HACIA 0 (ya es 0 en ese caso). Fix post-agente por orquestador: error lint `react-hooks/set-state-in-effect` en sale-detail-modal (setState síncrono en effect, incluida la traza dentro de fetchDetail) → reestructurado a ESTADO DERIVADO (loading ≔ detail.id !== saleId; setState solo en continuaciones async con guard `cancelled`; caché se limpia en handleClose) + 4 type-imports sin usar en el test eliminados. Lección: la regla nueva de react-hooks traza funciones llamadas desde el effect body — derivar en render es la salida canónica, no microtasks. Verificación: **314/314 tests (32 archivos, +1) · lint 0 err / 0 warnings · tsc ✅ · build ✅** — re-verificado independientemente por el orquestador. Pendiente E2E humano: venta a crédito sin cliente real → bloqueada en form y backend; inicial > total → rechazada; crédito aparece en Créditos Otorgados con saldo neto correcto; detalle muestra todos los campos; inicial = total → badge pagado; abonar desde Otorgados actualiza el pendiente del detalle tras reabrir. **PAUSA: Fase 8 (espejo para payables/cuentas por pagar) espera aviso explícito.**
