# H1 — Prueba manual de aislamiento entre 2 usuarios (Beta QA)

> **Ronda 13, Fase H1 (P0-k de la auditoría).** Verifica en el **entorno desplegado** que un usuario solo ve sus propios datos (aislamiento por `workspaceId`). Complementa los 38 tests automatizados de tenant isolation: esto prueba el sistema real, con sesiones reales, contra la base de producción.

## Prerequisitos

- [ ] Dos cuentas activas en producción: **Usuario A** y **Usuario B** (si no tenés dos cuentas, registrá una segunda con otro email).
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

---

## Paso 5 — Cierre

- [ ] Cerrar sesión de A y B, volver a entrar: ambas sesiones siguen intactas y cada uno ve solo sus datos.
- [ ] Si alguna verificación **falló**: anotar el paso exacto, captura de pantalla y el navegador/contexto; reportarlo como bug (no continuar).

## Resultado

- **Fecha de ejecución:** ________________
- **Usuarios usados:** A = ______________, B = ______________
- **Pass/Fail:** ☐ PASS completo ☐ FAIL (pasos con ×: ______________)

---

*Este checklist se ejecuta manualmente contra producción; los tests automatizados de aislamiento ya cubren la misma semántica en CI (38+ tests, suite 849/849 al cierre de R13-H3).*