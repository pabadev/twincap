# H1 — Prueba manual de aislamiento entre 2 usuarios (Beta QA)

> **Ronda 14, Fase O (P0-c/P0-k de la auditoría) — versión ampliada del checklist R13-H1.** Verifica en el **entorno desplegado** que un usuario solo ve sus propios datos (aislamiento por `workspaceId`). Esta versión agrega al Paso 4 la **matriz de sondeo cross-user por entidad** (§19 de la auditoría) y el **registro de la versión probada** en el Paso 5. Complementa los 38 tests automatizados de tenant isolation: esto prueba el sistema real, con sesiones reales, contra la base de producción. **Sigue siendo obligatoria para la beta.**

## Prerequisitos

- [ ] Dos cuentas activas en producción: **Usuario A** y **Usuario B** (si no tienes dos cuentas, registra una segunda con otro email).
- [ ] Poder abrir la app en **dos navegadores/ventanas de incógnito** (una por usuario) para comparar en paralelo.
- [ ] Anotar en qué navegador está cada uno (ej. A = Chrome, B = Edge/incógnito).

---

## Paso 1 — Registro y login

| # | Verificación | ¿OK? |
|---|---|---|
| 1.1 | El Usuario A se registra y entra a `/dashboard` (está logueado). | ☐ |
| 1.2 | Con la otra ventana, el Usuario B se registra y entra a `/dashboard`. | ☐ |
| 1.3 | Ningún dashboard muestra datos del otro usuario (están vacíos o solo los propios). | ☐ |

---

## Paso 2 — Datos financieros (A crea, B no ve)

> Ejecutar los pasos 2.1–2.4 con el **Usuario A**, luego verificar con el **Usuario B**.

| # | Aún como Usuario A: | ¿OK? |
|---|---|---|
| 2.1 | Crear una cuenta (ej. "Banco Beta") con un saldo inicial distinto (ej. $500.000). | ☐ |
| 2.2 | Registrar un movimiento de ingreso (ej. "Sueldo") y uno de gasto (ej. "Mercado"). | ☐ |
| 2.3 | Crear una categoría propia, un crédito (recibido o otorgado) y un pago a proveedor (Payable). | ☐ |
| 2.4 | Crear un cliente, un ítem de catálogo y una venta POS. | ☐ |

| # | Ahora con el Usuario B: | ¿OK? |
|---|---|---|
| 2.5 | **Dashboard**: no muestra ni el saldo, ni los movimientos, ni las ventas de A. Números propios de B (cero o los que B creó). | ☐ |
| 2.6 | **Cuentas**: no aparece "Banco Beta" de A. | ☐ |
| 2.7 | **Movimientos**: no aparece ningún movimiento de A (ni los de B si B no creó). | ☐ |
| 2.8 | **Categorías**: no aparecen las categorías de A. | ☐ |
| 2.9 | **Créditos / Payables**: no aparecen los créditos ni pagos de A. | ☐ |
| 2.10 | **Clientes / Catálogo / Ventas POS**: no aparecen cliente, ítem ni venta de A. | ☐ |

---

## Paso 3 — Aislamiento inverso (B crea, A no ve)

| # | Usuario B crea: | ¿OK? |
|---|---|---|
| 3.1 | Una cuenta, un movimiento y una venta propios. | ☐ |
| 3.2 | Verificar en la ventana de A que **ninguno** de los datos de B aparece en dashboard/cuentas/movimientos/ventas/clientes/catálogo. | ☐ |

---

## Paso 4 — Acceso directo por URL (probando la frontera)

> Un usuario no debe poder abrir los datos de otro ni adivinando la URL.

| # | Verificación | ¿OK? |
|---|---|---|
| 4.1 | Con B logueado, pegar en la URL una ruta tipo `/movements` y `/accounts` — debe verse la propia, no error ni datos de A. | ☐ |
| 4.2 | Con B logueado, intentar una URL con un id de A (si se conoce, ej. una venta/cuenta de A): la app no debe exponer el detalle; debe devolver no-encontrado o redirigir. | ☐ |
| 4.3 | **Analytics**: el módulo `/analytics` debe estar **oculto** para B (no aparece en el menú; si se pega la URL → 404) y **visible** solo para el founder. | ☐ |

### Paso 4.4 — Matriz de sondeo cross-user por entidad (R14-O, §19)

> **Contexto verificado en R14-O:** la app **no tiene rutas de detalle por id** (no existen
> `/accounts/[id]`, `/movements/[id]`, etc.) — todas las páginas son **listados planos
> scopeados al workspace** y los ids solo viajan por **server actions**. Por eso, con
> **Usuario A logueado** y conociendo ids de entidades creadas por **Usuario B** (ventana/contexto separado):
>
> 1. Pegar **cada URL directa** en el navegador de A y **esperar la carga completa** (los listados son clientes; las pestañas Network muestran los server actions).
> 2. En la pestaña **Network**, revisar cada server action: debe responder 200/302 **solo con datos del workspace de A**. Cualquier payload que contenga datos de B (ids, montos, nombres) es un **fallo de seguridad**, aunque la UI no los muestre.
> 3. Probar **mutación**: reenviar desde Network un server action (o editar el formulario con devtools) inyectando un **id de una entidad de B**. La operación debe **rechazarse o ser no-op**. Un mensaje tipo "no tienes acceso a la entidad X" que revele la **existencia** del id de B también es un fallo (información lateral).

| Entidad | Ruta con id de B (URL directa) | Resultado esperado | Resultado real | OK? |
|---|---|---|---|---|
| Cuentas | `/accounts` | Carga vacía o solo datos propios de A; sin datos de B; sin mensaje que revele existencia | ✅ PASS (2026-09-08): mutación inyectada con accountId de B (`6a9f85fb...` TEST-B Banco B) desde sesión de A → envelope `error.notFound` en respuesta + Atlas verificado sin cambios en cuentas de B. | ☑ |
| Movimientos | `/movements` | ídem | ✅ PASS (2026-09-08): `updateMovementAction` inyectado con movementId de B (`6a9f86a4...`) desde sesión de A → envelope `error.notFound` en respuesta. | ☑ |
| Transferencias | `/transfers` | ídem | ✅ PASS (2026-09-08): sondeo de URL con A → solo datos propios, server actions 200 OK, sin payloads de B (B no tiene transferencias). | ☑ |
| Créditos recibidos | `/credits/received` | ídem | ✅ PASS (2026-09-08): sondeo de URL con A → solo datos propios, server actions 200 OK (B sin créditos recibidos). | ☑ |
| Créditos otorgados | `/credits/granted` | ídem | ✅ PASS (2026-09-08): sondeo de URL con A → solo datos propios, server actions 200 OK (B sin créditos otorgados). | ☑ |
| Payables | `/payables` | ídem | ✅ PASS (2026-09-08): sondeo de URL con A → solo datos propios, server actions 200 OK (B sin payables). | ☑ |
| Ventas POS | `/pos/sales` | ídem | ✅ PASS (2026-09-08): `getSaleDetailAction` inyectado con saleId de B (`6a9f86a4...`) desde sesión de A → `{"ok":false,"error":"error.notFound"}` — detalle rechazado sin fuga. | ☑ |
| Clientes | `/clients` | ídem | ✅ PASS (2026-09-08): fetch inyectado con clientId de B (`6a9f8672...`) desde sesión de A → STATUS 200 con error-toast, SIN mutar B (el name en DB siguió siendo el editado legítimamente desde ventana de B: "TEST-B Cliente B edit", no el "TEST Cliente edit 5" del payload). Verificado server-side en Atlas. | ☑ |
| Categorías | `/categories` | ídem | ✅ PASS (2026-09-08): `updateCategoryAction` inyectado con categoryId de B (`6a9921ba30...`) desde sesión de A → envelope `error.notFound`. | ☑ |
| Ítems de catálogo | `/pos/catalog` | ídem | ✅ PASS (2026-09-08): `updateCatalogItemAction` inyectado con itemId de B (`6a9f869d5d...`) desde sesión de A → envelope `error.notFound`. | ☑ |

> Registrar para cada fila: lo visible en pantalla, el status de cada server action (200/302 vs 404/error) y si algún payload contenía datos de B.

---

## Paso 5 — Cierre

- [x] Cerrar sesión de A y B, volver a entrar: ambas sesiones siguen intactas y cada uno ve solo sus datos. ✅ (2026-09-08, verificado por el fundador)
- [x] Registrar la **versión/commit probado** (recomendado: `git rev-parse --short HEAD` o el deploy id de Vercel) y anotarlo en el Resultado.
- [x] Si alguna verificación **falló**: anotar el paso exacto, captura de pantalla y el navegador/contexto; reportarlo como bug (no continuar). — Ninguna falló.

## Resultado

- **Fecha de ejecución:** 2026-09-08 (inicio 2026-09-07, retomado y completado 2026-09-08)
- **Versión/commit probado:** `dccca1d` (fix analytics opaque 404; deploy Vercel twincap.vercel.app)
- **Usuarios usados:** A = cuenta principal del fundador (workspace `6a8922639bc1a626829342b7`, Brave), B = cuenta de prueba TEST-B (workspace `6a9921ba308259ec809b8b07`, Edge/incógnito)
- **Pass/Fail:** ☑ PASS completo (10/10 en matriz 4.4; notas: 4.3 /analytics requería fix previo `dccca1d` que quedó verificado con 404 opaco sin sidebar)
  - Incidencia menor registrada (no fallo de seguridad): durante 4.4 Clientes hubo datos de B editados legítimamente desde la ventana de B mientras se buscaba "Edit and Resend" en Brave; se verificó server-side que el fetch inyectado desde A con clientId de B NO mutó B (payload `TEST Cliente edit 5` nunca apareció en DB de B) → PASS confirmado.

---

*Este checklist se ejecuta manualmente contra producción; los tests automatizados de aislamiento ya cubren la misma semántica en CI (38+ tests, suite 849/849 al cierre de R13-H3). Versión ampliada **R14-Fase O** — sigue siendo obligatoria para la beta.*