# UX-11 — Usability Test Protocol (Founder-Executed)

> Estructura del documento: encabezados bilingües (inglés primario / español secundario); **todos los scripts de tarea y textos para el usuario están en español neutro** (sin voseo, sin regionalismos).
> Owner: Part B (fundador) · Baseline: `docs/freeze + UX-UI.md` §41 (líneas 1374–1389) · Ref: `e2e/helpers.ts` (forma `registerUser`/`seedFinancialData`, solo lectura)

## 1. Overview / Visión general

- **5 usuarios** reales (no agentes), **4 tareas**, una sesión de ~20–30 minutos por usuario.
- Objetivo: validar la Regla de Oro §41 (entender el Resumen en 10 segundos) y los flujos núcleo (venta POS, gasto, cobro de crédito).
- **Regla de aprobación de la Regla de Oro: al menos 4 de 5 usuarios deben pasar la Tarea 3** (entender el Resumen en 10 segundos). Con 3/5 o menos, la Regla de Oro NO pasa.
- **`/help` es superficie de apoyo permitida**: el usuario puede consultar `/help` en cualquier tarea. El observador lo anota (qué pregunta, en qué tarea, cuántas veces).

## 2. Seeded-data recipe / Receta de datos de prueba

Reproducir este estado ANTES de traer al usuario a la sala (top to bottom, sin pasos inventados; espeja `e2e/helpers.ts`):

1. Abrir `/register` y crear una cuenta nueva (email real o de prueba, contraseña segura). El registro land en el Dashboard con la cuenta **"Efectivo" (COP)** ya creada.
2. En `/movements`, "Add Movement":
   - Ingreso, categoría "Salario", monto `1000000` (COP 1,000,000), nota "ingreso mensual", fecha de hoy.
   - Gasto, categoría "Comida", monto `300000` (COP 300,000), nota "compra semanal", fecha de hoy.
3. En `/pos/catalog`, "Add Item": nombre "Producto demo", precio unitario `12000` (COP 12,000), stock `10`.
4. En `/credits/granted`, "Add Credit": deudor "Cliente demo", principal `100000` (COP 100,000), cuenta de pago "Efectivo (COP)", fecha de hoy, **2 cuotas de `55000`** (COP 55,000). **NO registrar abono** — el crédito debe quedar ABIERTO (pendiente COP 110,000).
5. Verificación rápida: Dashboard muestra "Ingresos de este mes" = COP 1,000,000 y "Gastos de este mes" = COP 300,000; `/credits/granted` muestra "Cliente demo" con "Pendiente: COP 110,000".

## 3. Tasks (user language) / Tareas (texto para el usuario)

El observador lee el encabezado tal cual; el usuario ve solo su pantalla. Una sola tarea a la vez.

### Task 1 — Register a POS sale / Registrar una venta

- **Ruta:** `/pos/sales`
- **Script:** "Registra la venta de 2 unidades de 'Producto demo' pagada completa con la cuenta Efectivo." — algo como lo que harías en tu negocio.
- **Criterio de éxito:** la venta aparece listada como "Pagada" con total COP 24,000; el saldo de Efectivo refleja el ingreso.
- **Métricas:** tiempo en tarea, dudas (hesitations), uso de `/help`, comprensión del diálogo de confirmación si aparece (MAC/F5).

### Task 2 — Register an expense / Registrar un gasto

- **Ruta:** `/movements`
- **Script:** "Anotaste una salida: pagaste 45,000 de despensa. Regístralo donde corresponda."
- **Criterio de éxito:** el gasto queda registrado en la cuenta correcta (COP 45,000) y es visible en la lista de movimientos.
- **Métricas:** tiempo, dudas, si fue a la sección correcta al primer intento.

### Task 3 — Understand the Resumen in 10 seconds / Entender el Resumen en 10 segundos

- **Ruta:** `/dashboard`
- **Script:** "Mirá/mira el Resumen durante 10 segundos. Después responde estas 5 preguntas, sin navegar:"
  1. ¿Cuánto tengo?
  2. ¿Qué está pasando?
  3. ¿Estoy mejor o peor?
  4. ¿Dónde está el problema, si existe?
  5. ¿Qué debería revisar?
  - _(Las 5 preguntas de la Regla de Oro §41, `docs/freeze + UX-UI.md:1374–1389`, transcritas textualmente.)_
- **Criterio de éxito (Regla de Oro):** responde con confianza y correcta las 5 — el monto disponible correcto, interpreta ingreso vs gasto del mes, y señala al menos una acción razonable de revisión — **dentro de los 10 segundos de lectura**.
- **Regla de aprobación global:** ≥ **4 de 5 usuarios** deben pasar esta tarea.

### Task 4 — Collect a granted credit / Cobrar un crédito otorgado

- **Ruta:** `/credits/granted`
- **Script:** "'Cliente demo' te abona hoy 55,000 y adelanta otro pago de 55,000 de mañana. Registra el cobro y verifícalo."
- **Criterio de éxito:** registra el/los abono(s) y entiende qué firma el diálogo de confirmación (MoneyActionConfirmation): qué cuenta recibe el dinero y qué efecto tiene en el pendiente; el pendiente baja correctamente (110,000 → 55,000 → Pagado).
- **Métricas:** comprensión del diálogo de confirmación (recuerda qué confirmó), dudas, uso de `/help`.

## 4. Observation guide / Guía de observación

| Aspecto                  | Cómo registrarlo                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Time-on-task**         | Segundos desde el script hasta la confirmación final (cronómetro).                                                                                                      |
| **Hesitations**          | Toda pausa mayor a 3 segundos, retroceso de navegación o intento fallido cuenta como una duda (+1); se anota en qué pantalla ocurrió.                                   |
| **MAC/F5 comprehension** | Cuando aparece un cuadro de confirmación, se anota si el usuario puede decir qué está confirmando (cuenta, monto y efecto en el saldo) sin que el observador lo señale. |
| **`/help` usage**        | Cada consulta se anota: tarea en la que ocurrió, qué buscó y si lo resolvía.                                                                                            |
| **Verbalidad**           | Se pide "piensa en voz alta"; las frases textuales del usuario se transcriben literalmente.                                                                             |

## 5. Success criteria & pass rule / Criterios y regla de aprobación

- Task 1 ✅ / Task 2 ✅ / Task 4 ✅ → éxito binario por usuario; Task 3 ✅ si las 5 preguntas se responden en 10 s (Regla de Oro).
- **Pass global de la Regla de Oro: ≥ 4/5 usuarios pasan la Tarea 3.**
- Cada fallo se registra con causa (no lo entendió / no lo encontró / error de sistema).

## 6. Session wrap-up / Cierre de sesión

- Volcar los resultados por usuario en la **tabla pendiente de `docs/UX-11-VALIDATION-REPORT.md` (Part B)** — sección "Usability results".
- No modificar código; los hallazgos van al verdicto/bloques PENDING FOUNDER.
a