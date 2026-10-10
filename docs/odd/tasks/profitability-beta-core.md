# TwinCap — Núcleo de rentabilidad para beta

> Estado: **autorizado por el fundador para documentación e implementación gradual (2026-10-08)**  
> Ronda: ampliación acotada de producto pre-beta  
> Relacionado: `docs/odd/tasks/inventory-mvp-contract.md`

## Objetivo

Permitir que un negocio responda, con cifras trazables, cuánto vendió, cuánto costó el inventario vendido, qué utilidad bruta obtuvo y qué resultado muestran los gastos que registró. No convertir TwinCap en un sistema contable ni agregar un módulo completo de Compras.

## Auditoría local

- `InventoryReceipt` ya conserva importe asignado por línea, cantidad, moneda, proveedor opcional y vínculo a cuenta por pagar.
- Las entradas de inventario incrementan existencias en la misma transacción que crea la recepción.
- `InventoryStockRecord` conserva deltas y referencias de apertura, ajuste, recepción, venta y reversa; no conserva valor/costo.
- `CatalogItem` conserva existencias, unidad y precio de venta; no conserva valoración de inventario.
- `Sale` conserva precio/importe y snapshots de cantidades consumidas por fórmula/combo, pero no snapshot de costo.
- No se conocen los costos iniciales de inventarios preexistentes. No se puede derivar rentabilidad histórica completa a partir de movimientos de cantidad.
- Los movimientos de pago de una venta y los abonos de una venta a crédito no son una segunda venta. Para resultados, la fuente de ingresos comerciales es la venta registrada, no la suma de cobros.

## Contrato de rentabilidad v1

### Métricas

1. **Ventas:** importe de ventas registradas en su fecha de negocio, independientemente de si fueron cobradas al contado o a crédito.
2. **Costo de lo vendido:** valor asignado a la cantidad de inventario consumida por esas ventas.
3. **Utilidad bruta:** ventas menos costo de lo vendido.
4. **Gastos del negocio registrados:** gastos económicos de contexto Business en el período, excluyendo transferencias, financiación y pagos de obligaciones que ya representaron la compra.
5. **Resultado del negocio registrado:** utilidad bruta menos gastos de negocio registrados.

La UI explicará que el resultado depende de los datos registrados y no equivale a utilidad neta contable/tributaria. Impuestos, nómina, costos indirectos y costos de servicios quedan fuera de v1. Transporte, herramientas, materiales no controlados como inventario y otros costos generales se registran como gastos de Negocio desde el FAB o Movimientos; se restan una sola vez del resultado por período, sin requerir asignarlos a cada venta.

### Valoración de inventario

- Método: **costo promedio ponderado móvil** por producto, en la moneda inmutable del producto. No se promedian ni convierten monedas.
- La recepción ya tiene `lineAmount` por artículo y cantidad. En inventario valorado, una recepción agrega su cantidad y su importe al saldo valorado; si existen cantidades sin costo conocido, el saldo permanece incompleto hasta que el usuario establezca el valor inicial.
- Cada producto con existencias preexistentes requiere un valor de apertura explícito para habilitar rentabilidad completa. El costo faltante se representa como **desconocido**, nunca como cero.
- Ajuste negativo: reduce existencias y valor al promedio vigente. Ajuste positivo: requiere valor explícito para la cantidad añadida; no se inventa el costo.
- Venta: el costo aplicado se calcula transaccionalmente desde el promedio vigente y se congela en un snapshot en la venta. El redondeo se hace en unidades menores enteras y debe conservar el saldo exacto al liquidar toda la existencia.
- Receta personalizada: suma el costo de los componentes y cantidades efectivamente consumidos guardados por la venta.
- Combo: suma el costo de los componentes consumidos según el snapshot de composición de esa venta.
- Reversa: restaura cantidades y costo originales de la venta; no recalcula con costos actuales.
- Un período con ventas de productos de costo desconocido se presenta como **incompleto**, sin declarar utilidad como si ese costo fuera cero.
- Apertura de costo crea una base desde la fecha de apertura. No se recalculan ventas históricas sin evidencia suficiente.

### Límites

- Sin órdenes, cotizaciones, administración avanzada de proveedores ni módulo de Compras.
- Sin lotes/FIFO, vencimientos, costos de mano de obra/fabricación, impuestos, FX, nómina ni afirmaciones de contabilidad legal.
- Sin utilidad histórica retroactiva para períodos cuyo costo de apertura no puede reconstruirse.
- Los servicios no consumen inventario: para el margen bruto v1 su costo de inventario es cero (no “desconocido”). Los gastos de prestación se registran de forma general en contexto Negocio y reducen el resultado del período, sin atribución por servicio.

## Fases de implementación

### P0 — Contrato y auditoría ✅

Documentar reglas, auditar datos actuales y enlazar este tracker desde el plan maestro. Sin cambios de producto.

### P1 — Valuación de existencias

#### P1a — Reglas puras de valoración ✅

Implementar el cálculo reutilizable de recepción ponderada y retiro con redondeo entero reproducible, incluido costo desconocido. Prueba enfocada: `inventory-valuation.test.ts` 6/6 PASSED. No hubo suite completa.

#### P1b — Valuación persistida de inventario ✅

Se agregó `inventoryValueMinor` por producto; apertura, recepción y ajustes actualizan cantidad y valor dentro de sus transacciones. Los productos legacy con existencias y costo desconocido pueden fijar su valor total inicial desde el control de existencias, sin modificar cantidad. Ajustes positivos requieren valor explícito; los retiros usan promedio móvil. La bitácora conserva deltas monetarios. Pruebas enfocadas: 66/66 PASSED; typecheck EXIT 0; Prettier check EXIT 0. No se ejecutó la suite completa.

### P2 — Snapshot de costo en ventas ✅

Cada venta valora el consumo físico desde el promedio vigente dentro de su transacción, agrupa consumos por producto (incluidas líneas directas, recetas y combos), guarda el costo por componente y el total conocido/desconocido, y actualiza existencias/valor con guardas optimistas. La reversa repone cantidad y costo snapshoteado; si una venta histórica o desconocida se revierte, el valor del stock vuelve a desconocido en vez de asumir costo cero. Se rechaza mezclar monedas entre un artículo vendido y sus componentes porque v1 no convierte FX.

La UI reutiliza el modal de detalle de venta: presenta costo por línea y utilidad bruta cuando el costo de inventario es conocido. Para servicios muestra “Sin costo de inventario” y considera su costo cero; los gastos asociados registrados aparte se restan en la analítica del período. Costos de producto realmente desconocidos siguen marcando la utilidad incompleta. La UI es responsive (tabla existente en escritorio, filas apiladas en móvil y tablet) y usa i18n es/en.

Verificación enfocada P2: 88/88 PASSED (ventas, detalle, reversa transaccional, dominio, mapper y valoración); el grupo combinado de regresión P1+P2 quedó en 100/100. `tsc --noEmit` EXIT 0; Prettier check EXIT 0. No se ejecutó suite completa.

### P3 — Agregados y presentación ✅

**Decisión de navegación (2026-10-09):** el Resumen conserva su función de panorama personal/negocio y ofrece un acceso directo a una vista separada `/business-analytics`, presentada en la UI como **Resumen del negocio** y también visible en la navegación general. No se reutiliza `/analytics`, que es analítica interna del producto y sigue restringida al fundador. Tampoco se añade una pestaña a Personal: la utilidad y los filtros no aplican al contexto personal. La vista ofrece fechas Desde/Hasta y resultados separados por moneda.

Implementado: agregado puro por rango civil y moneda; reconoce ventas por fecha de venta; expone ventas, costo conocido, utilidad bruta, gastos y resultado registrado; marca incompletitud si alguna venta del período tiene costo de producto desconocido. También deriva cantidad y promedio de ventas, saldo actual pendiente por cobrar de las ventas del rango y los cinco productos/servicios con mayor importe vendido por moneda. Excluye transferencias, movimientos de Personal, pagos/abonos de cuentas por pagar, pagos de recepción de inventario y movimientos huérfanos para evitar contaminar el resultado. El resumen del negocio es accesible desde el Resumen general y la navegación, con filtros Desde/Hasta y cifras separadas por moneda. Su lenguaje prioriza “Vendiste”, “Te quedó después de esos gastos” y “Pendiente por cobrar”; no exige distribuir gastos entre ventas.

**Ajuste de alcance autorizado por el fundador (2026-10-09):** los servicios no tienen costo de inventario; sus ventas se consideran con costo de inventario cero, por lo que pueden mostrar el total de su venta como utilidad bruta registrada. Transporte, herramientas y otros gastos se registran en contexto Negocio desde el FAB/Movimientos y se restan al calcular el resultado general por período, sin forzar asignación a una venta. `getSaleDetail` y la analítica distinguen el tipo de catálogo `service` de productos con costo desconocido; el detalle muestra “Sin costo de inventario”.

Verificación enfocada P3: 21/21 PASSED (agregado, acceso desde Resumen, navegación, paridad y uso de i18n); `tsc --noEmit` EXIT 0; Prettier check PASSED. ESLint scoped: 0 errores y 1 warning preexistente en `nav.tsx` sobre la ref del botón hamburguesa. No se ejecutó la suite completa.

**Corrección posterior solicitada por el fundador (2026-10-09):** servicios sin costo de inventario ya no hacen incompleta la utilidad: se muestran con costo de inventario cero y aportan su subtotal a utilidad bruta. Gastos generales (transporte, herramientas y similares) se siguen registrando como gastos Business separados y reducen el resultado total del período. Los productos con costo desconocido continúan marcando el resultado como incompleto. Pruebas focalizadas de la corrección: 20/20 PASSED (agregación por período, detalle de venta e i18n); `tsc --noEmit` EXIT 0; ESLint 0 errores y Prettier PASSED. No se ejecutó suite completa.

**Refinamiento de resumen solicitado por el fundador (2026-10-09):** la vista debe aportar más valor que el Resumen general filtrado por Negocio y explicar las cifras en lenguaje común. Mostrar cantidad de ventas, promedio por venta, saldo pendiente por cobrar (excluyendo créditos castigados), top cinco por importe vendido, productos sin costo como incompletitud y resumen de dinero después de costos/gastos registrados.

Implementado y verificado: 23/23 pruebas focalizadas (agregado, acceso desde Resumen, navegación y i18n); `tsc --noEmit` EXIT 0; Prettier check PASSED; ESLint 0 errores y 1 warning preexistente de `nav.tsx`. No se ejecutó la suite completa.

**Corrección de saldo pendiente (2026-10-09):** se detectó que ventas con `paymentMode: "paid-in-full"` no almacenan abonos embebidos porque su cobro se registra como movimiento. El getter genérico `Sale.pending` interpretaba esa ausencia como saldo igual al total. El dominio ahora retorna cero para venta pagada al contado, y el agregado de negocio ignora cualquier `pending` stale para ese modo; así listado, CSV, resumen y serialización coinciden. La deuda de venta a crédito sigue viniendo del crédito vinculado, con fallback a abonos de ventas legacy.

Verificación enfocada de la corrección: 89/89 PASSED (dominio Sale, agregado Business, CSV, detalle y casos de venta/abonos); `tsc --noEmit` EXIT 0; ESLint 0 errores/warnings; Prettier check PASSED. Suite completa diferida a P4.

### P4 — E2E de aceptación para rentabilidad ✅

**Siguiente fase.** La ronda pre-beta diseñó E2E-01..10 antes de esta ampliación; esos diez escenarios no cubren los nuevos contratos ni las pantallas nuevas. Añadir un pack dedicado (propuesto: `e2e/business-profitability.spec.ts`) con recorridos de usuario reales, reaprovechando helpers existentes y sin reemplazar E2E-01..10:

1. **E2E-11 — Valoración → venta → detalle inmutable → período:** establecer el valor inicial de existencias legacy, recibir inventario con costo, comprobar el costo promedio móvil a través del costo snapshoteado en POS/detalle, cambiar el costo vigente después de la venta y confirmar que su detalle no cambia. La analítica del rango civil explícito debe reconocer la venta, sumar costo/utilidad y no contabilizar como gasto una recepción a crédito aún no pagada.
2. **E2E-12 — Servicio, costo desconocido, crédito y gastos:** registrar una venta a crédito de un producto con existencia sin valoración, una venta de servicio y un gasto Business. Comprobar que el detalle del servicio indique que no tiene costo de inventario, que el resumen muestre la incompletitud del producto, cuente ventas y promedio, reste el gasto y refleje el saldo pendiente de la venta a crédito. El cobro posterior no se suma como una segunda venta; esta regla permanece también cubierta por las pruebas de agregado/dominio si no hay un recorrido UI estable de abono disponible.

Mantener aislados los casos que no son adecuados para UI lenta o frágil (límites numéricos, redondeo, concurrencia/rollback, ciclos de fórmula/combo, monedas mezcladas y reversa exact-once) en las pruebas de dominio/aplicación/replSet ya previstas. Añadir asserts de `workspaceId` para valoración, snapshot de costo y analítica en la fase de aislamiento de la ronda pre-beta. No etiquetar el pack anterior como cobertura de esta ampliación.

**Evidencia de implementación y aceptación (2026-10-09):** `e2e/business-profitability.spec.ts` implementa los dos recorridos; E2E-11 y E2E-12 pasaron por separado con el cargador oficial `.env.e2e` (Playwright + MongoDB local; cada caso reportó `ok 1`). Prettier, ESLint scoped y `tsc --noEmit` pasan. La traza localizó primero un locator de detalle con nombre accesible incorrecto; después E2E-11 reveló un defecto real: el rango explícito del Resumen del negocio desplazaba las fechas civiles por el offset del cliente y excluía ventas guardadas a medianoche UTC. Se corrigió el intervalo en `src/app/(main)/business-analytics/page.tsx`; el E2E confirmó que venta, costo y utilidad aparecen en el período. E2E-12 quedó ajustado al contrato de servicio: no hay costo de inventario y su margen bruto refleja el importe vendido. La corrida aislada de ambos casos terminó cada test en verde, pero el proceso Playwright/servidor quedó colgado después de apagar mongod y hubo que interrumpirlo manualmente; la corrida consolidada de P5 deberá confirmar el cierre limpio del pack.

### P5 — Verificación final integrada ⏳

**Estado al 2026-10-09:** suites enfocadas integradas cubiertas por la corrida completa. `pnpm test` ejecutado con watchdog explícito de 45 minutos: **198 archivos, 1.894 tests aprobados, 0 fallidos**, duración 1.549,47 s. La primera corrida completa había reportado 3 archivos/6 tests fallidos; se corrigieron los tres defectos y los casos afectados pasaron enfocados antes de repetir el conjunto completo: saldo pendiente de ventas pagadas al contado, carrera de borrado/abono (el fixture ahora crea una venta a crédito real) y CAS de recepción para documentos de inventario legacy con valor ausente.

`tsc --noEmit` EXIT 0; `pnpm build` EXIT 0 (incluye `/business-analytics`); Prettier check de todos los archivos modificados EXIT 0. ESLint scoped sobre todos los TS/TSX modificados: 0 errores y 1 warning intencional de restauración de foco en `nav.tsx`. El `pnpm lint` general se interrumpió porque recorrió el artefacto grande `playwright-report/trace`; no se toma como gate completado.

E2E-11 y E2E-12 pasan por separado, pero el pack pre-beta consolidado no está aceptado: Playwright inició 55 casos y reportó 9 fallos (rate limiter, saldo de cuenta en write-off y delete movement, select de categoría/timeout de aislamiento, apertura duplicada concurrente, cierre de modal de crédito, confirmación de movimiento y timeouts de multicurrency/saldo negativo). Hubo además bloqueo del reporter/servidor tras detener mongod, sin resumen de cierre limpio. El fallo aislado de saldo negativo se completó con timeout de 180 s; el E2E integrado se debe repetir con diagnóstico por caso y resolver los flujos que fallen en condiciones normales.

Una selección diagnóstica aislada de cinco tests de concurrencia/multimoneda/saldo volvió a mostrar el problema de cierre del runner: el caso de `dashboard-period` falló porque `--grep` omitió su setup serial (`serial user not registered yet`); los demás avanzaron hasta teardown, mongod se apagó y el reporter volvió a quedarse colgado. Esa ejecución se interrumpió manualmente y se registra como inconclusa, no como PASS. Evitar seleccionar tests seriales por grep si dependen de fixtures anteriores.

**Actualización P5 (2026-10-09):** se desactivó la reutilización de cualquier servidor Next existente en Playwright y el puerto local predeterminado ahora es 3011; el cargador E2E añade `replicaSet=rs0` al endpoint local fijo 37017 cuando falta, y CI declara el parámetro explícitamente. La corrida consolidada de 55 casos terminó: 48 PASSED, 3 FAILED y 4 omitidos por la política serial tras fallos; los tres casos fallidos fueron write-off con saldo, alerta de saldo negativo del dashboard y borrado de movimiento. E2E-11/12 y E2E-01..10 pasaron en esa corrida. Playwright volvió a quedar abierto tras `mongod stopped` sin resumen final; el proceso se interrumpió, por lo que no se declara un cierre limpio.

Los dos casos de saldo que fallaron se repitieron después de hacer que sus helpers esperen el toast explícito `Initial balance set`: ambos pasaron (write-off y borrado de movimiento). Esto confirma una condición de sincronización del helper, aunque la suite completa aún debe repetirse para confirmar la corrección integrada. El caso de alerta negativa no se repitió aisladamente porque su fixture depende de escenarios seriales anteriores; en la misma suite, el E2E separado de saldo negativo pasó. Prettier y `tsc --noEmit` pasan. ESLint acotado pasó sin hallazgos; ESLint sobre `src` y `e2e` completo terminó con 0 errores y 16 warnings preexistentes.

**P5 sigue abierto.** Pendiente: repetir el pack completo y resolver/reclasificar la alerta de dashboard; lograr cierre limpio de Playwright; terminar lint general o documentar comando equivalente que excluya artefactos generados; verificar aislamiento cross-workspace para valoración/snapshot/analítica; completar backup/restore; verificar índices Atlas en modo lectura (la consulta anterior no llegó a Atlas por timeout DNS); completar revisión visual clara/oscura y CTAs; matriz de hallazgos e informe final. La suite unitaria completa ya está verde, pero no basta para cerrar la ronda.

## Pruebas focalizadas requeridas

- Apertura conocida/desconocida; importes cero, límites de seguridad y moneda.
- Recepción sobre inventario valorado y no valorado; costo ponderado y total de stock.
- Ajuste negativo al promedio; ajuste positivo con costo y rechazo si falta.
- Venta de producto granular; producto con costo desconocido; rechazo ante concurrencia/stock insuficiente sin efectos parciales.
- Receta personalizada, combo, cambios posteriores de receta/combo y snapshot inmutable.
- Reversa de ventas: inventario y valor restaurados una sola vez.
- Ventas a crédito reconocidas en fecha de venta; cobros posteriores no duplican ingreso.
- Gastos Business restados una vez; transferencias/financiamiento/pagos de payable no contaminan resultado.
- Agregación por moneda sin conversiones; período parcialmente incompleto no declara rentabilidad total.
- Aislamiento por `workspaceId` y fronteras de serialización plain-object.

## Criterios de aceptación

- El dueño puede encontrar la utilidad bruta de una venta y de un período, con su definición visible.
- Cada importe de costo puede rastrearse a apertura, recepción, ajuste o snapshot de venta.
- Cambiar costos o fórmulas no modifica la historia de ventas.
- Cobros, transferencias y pagos de obligaciones no duplican el resultado económico.
- Costos desconocidos se hacen visibles y no inflan utilidad.
- Servicios sin inventario no bloquean la utilidad; los gastos registrados en Negocio se restan del resultado del período una sola vez.
- El resumen del negocio muestra actividad de ventas, promedio, por cobrar y productos/servicios más vendidos con palabras de usuario.
- Ningún usuario accede a inventario o ventas de otro workspace.
- Sin regresiones de los flujos actuales de POS, recepción, pagos, reversas y dashboard.

## Estado

- P0: completada el 2026-10-08.
- P1a: completada el 2026-10-08; 6/6 enfocadas.
- P1b: completada el 2026-10-08; 66 pruebas enfocadas, typecheck y formato PASSED.
- P2: completada el 2026-10-08; 88 pruebas enfocadas (100/100 en regresión combinada P1+P2), typecheck y formato PASSED.
- P3: completada el 2026-10-09; verificación enfocada 21/21, typecheck, formato y ESLint (0 errores).
- P3 + refinamientos: verificados con 23/23 enfocadas; corrección de saldo pendiente verificada con 89/89 pruebas enfocadas, typecheck, lint scoped, Prettier.
- P4 (E2E de aceptación nuevos): completada con E2E-11 y E2E-12 en verde aislados; pendiente confirmar el cierre limpio del runner al ejecutar el pack integrado de P5.
- P5 (verificación final integrada): en curso; unit suite completa (198/198 archivos, 1.894/1.894 tests), typecheck, build y Prettier completados; el pack E2E sigue sin veredicto limpio y faltan gates de aislamiento/backup/índices/visual/cierre.
- Suite completa: ejecutada tras corregir los 6 fallos iniciales; resultado final 1.894/1.894 PASSED en 1.549,47 s con timeout ≥45 min.
