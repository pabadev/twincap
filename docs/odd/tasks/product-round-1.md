# Ronda Producto 1 — Flujos claros para pequeños negocios

> Fecha de inicio: 2026-09-27  
> Estado: **ACTIVA; Fases 1–2 implementadas; Fase 3 con bloqueo operativo de MongoDB; Fase 5 implementada pendiente de verificación; Fase 6 recepción integrada por inspección con incidente de persistencia abierto; Fases 7–8 implementadas por inspección, pendientes de verificación; Fase 9 pendiente; pruebas diferidas**
> Documento maestro: `docs/AUDIT-AND-PLAN.md`  
> Protocolo de pruebas: `AGENTS.md` y `docs/PROJECT-RULES.md` §14.

## Objetivo

Mejorar los flujos cotidianos de un pequeño negocio y preparar la evolución de POS, clientes e inventario con claridad financiera. La ronda no busca convertir TwinCap en un ERP ni crear un módulo de Compras. El dominio financiero permanece congelado: cualquier necesidad de alterarlo se documentará y se detendrá antes de implementarla.

## Decisiones de producto vigentes

- Regla monetaria global: en flujos de una sola cuenta, la moneda la determina la cuenta y solo puede mostrarse como dato ilustrativo; backend obtiene moneda desde la cuenta del workspace. El usuario no elige moneda independiente. Las transferencias mantienen moneda de origen/destino separada.
- Productos combinados (combos) y venta granular por peso/volumen/longitud son capacidades diferentes que convivirán sobre inventario compartido.
- El caso de negocio de insumos revela una tercera capacidad: fórmulas para preparar productos, distintas de combos.
- Registrar recepción de insumos debe enlazarse con los pagos o cuentas por pagar, sin implementar un ERP ni calcular costos/márgenes no confiables.
- Producto y Servicio deben distinguirse visualmente con etiqueta legible en ambos temas.
- Las cards de Catálogo siguen el lenguaje visual de Movimientos, pero tienen jerarquía propia: tipo, precio y segunda fila común de existencias. Producto y Servicio comparten el mismo cuerpo de altura fija y el mismo espacio para acciones; en servicios la fila de existencias indica “No aplica”. La acción de producto se denomina “Ajustar existencias”. El listado usa una columna en móvil, dos en tablet y tres en escritorio.
- Ajuste UI acordado el 2026-09-28: Catálogo deja de usar una sola lista estirada; adopta grilla responsive de 1/2/3 columnas en móvil/tablet/escritorio.
- Ajuste UX 2026-09-28 en Entradas: moneda visible junto a cada cuenta, sin campo informativo duplicado; formulario móvil compacta espaciado y textos secundarios sin reducir el objetivo táctil de controles.
- Categorías de ingresos y gastos pueden usar fondos semánticos muy suaves, conservando contraste.
- En Perfil debe quedar espacio para que el FAB no tape el botón Cambiar contraseña.
- Las cards de cuentas en Resumen siguen el patrón del módulo Cuentas: distintivo Fijo superpuesto arriba a la derecha, cuerpo de dos líneas simétrico y sin acciones.
- Cliente: teléfono obligatorio como único identificador principal, único por workspace y ajeno a la identidad global. Correo y otros contactos son opcionales.
- Formato telefónico propuesto y aceptado para la implementación: entrada legible con formato internacional E.164 (por ejemplo `+57 300 123 4567`); persistencia/comparación canónica como `+573001234567`. Rechazar números sin prefijo de país en vez de inferirlo de locale.
- Registros históricos sin teléfono: mostrar aviso que solicite completarlo. Antes de aplicar índice único, auditar duplicados/valores inválidos por workspace; no fusionar registros automáticamente.
- Para actividad del cliente, la primera versión muestra ventas POS y créditos que puedan enlazarse de forma verificable a esas ventas. No inferir vínculo de créditos standalone a partir del nombre.
- No ejecutar pruebas automáticamente durante las fases. Diseñar/regenerar pruebas para cada cambio y ejecutarlas al cierre según §14.

## Fases y criterios de aceptación

### Fase 0 — Contrato de ronda y protocolo de calidad

- [x] Registrar alcance, orden, decisiones y estado en este tracker y en el documento maestro.
- [x] Actualizar `AGENTS.md` y `docs/PROJECT-RULES.md` para diseñar pruebas al implementar y posponer su ejecución hasta el cierre de la ronda.
- [x] Mantener el dominio financiero congelado y documentar cualquier bloqueo de producto que exija reabrirlo.

### Fase 1 — Simplificación y consistencia visual

- [x] Retirar el selector de moneda del alta manual de Movimientos; mostrar moneda de la cuenta seleccionada y conservar la validación server-side `ACC-1`.
- [x] Alinear las cards de cuentas del Resumen con Cuentas: badge Fijo superpuesto arriba a la derecha, cuerpo de dos líneas y sin acciones.
- [x] Distinguir visualmente etiquetas Producto/Servicio en Catálogo.
- [x] Aplicar tintes verdes/rojos muy suaves a las secciones de Categorías, con contraste light/dark.
- [x] Añadir espacio inferior en Perfil para despejar el botón Cambiar contraseña del FAB.
- [x] Escribir/actualizar tests pertinentes; **no ejecutarlos durante esta fase**.

### Fase 2 — Ventas y créditos POS

- [x] Llevar las cards de ventas al patrón visual de `MovementCard`, conservando datos y acciones propios de venta.
- [x] Pasar el ID exacto del crédito asociado a la venta.
- [x] Añadir acción accesible desde venta hacia Créditos otorgados; al llegar, encontrar y resaltar ese crédito durante 3 segundos, respetando `prefers-reduced-motion`.
- [x] Diseñar tests para el destino exacto y su codificación, ausencia de vínculo, resolución de crédito inexistente, elemento objetivo, duración del resaltado y desplazamiento con movimiento reducido; diferir ejecución.

### Fase 3 — Identidad e historial del cliente

- [x] Exigir y normalizar teléfono internacional E.164 en altas nuevas y cambios.
- [ ] Garantizar unicidad del teléfono por workspace en aplicación e índice Mongo; manejar carrera concurrente.
- [x] Correo y canales secundarios opcionales; no sustituir teléfono como identidad principal ni imponer unicidad al correo.
- [x] Añadir aviso accionable para fichas legacy con teléfono vacío, inválido o no canónico; preservar sus ventas/créditos y no fusionar automáticamente.
- [ ] Ejecutar auditoría de colisiones/valores legacy por workspace antes de crear el índice único; el script dry-run está preparado y el acceso a MongoDB no respondió desde este entorno.
- [x] Añadir una ficha de cliente con ventas y créditos vinculados por relación de datos verificable; consultas tenant-scoped, acotadas y paginadas.
- [x] Diseñar tests unitarios, de acción y de UX para teléfono requerido, normalización, duplicados y fichas legacy; diferir ejecución.

### Fase 4 — Diseño de inventario compartido

- [x] Revisar con el fundador el contrato propuesto de inventario compartido: `docs/odd/tasks/inventory-mvp-contract.md` (aprobación explícita: “ok”, 2026-09-28).
- [x] Preparar borrador de MVP de existencias, unidades base/conversión, ajustes trazables, precisión de cantidad, servicios sin stock y reglas de stock negativo.
- [x] Definir entradas y salidas manuales sin módulo de Compras ni contabilización financiera automática.
- [x] Definir reversos, cancelaciones, ventas concurrentes, auditoría, tenant isolation y datos legacy.
- [x] Entregar contrato y arquitectura antes de persistencia o acciones nuevas.

### Fase 5 — Venta granular

- [x] Implementar unidades y conversiones aprobadas (peso, volumen y/o longitud) sobre el inventario compartido.
- [x] Aceptar cantidades fraccionarias con precisión explícita; evitar aritmética flotante para dinero y documentar la conversión a minor units.
- [x] POS presenta unidad y precio por unidad; el inventario consume la cantidad equivalente en unidad base.
- [x] Cerrar coherencia transaccional entre venta y stock para ventas, reversas y ajustes.
- [x] Mostrar existencia actual y una bitácora útil de entradas/salidas, ventas y reversas.
- [x] Los ajustes manuales exigen motivo y no generan registros en Caja ni en resultado financiero.
- [x] Diseñar pruebas de ajustes, cantidad en unidad base, motivo requerido, servicio sin stock y bloqueo de stock negativo (`adjust-catalog-stock.test.ts`); diferir ejecución.
- [x] Diseñar prueba de simetría de las cards de Producto y Servicio y texto contextual de existencias (`catalog-item-card.test.tsx`); diferir ejecución.
- [x] Diseñar prueba de grilla responsive de Catálogo: 1 columna en móvil, 2 en tablet, 3 en escritorio (`catalog-grid-layout.test.ts`); diferir ejecución.
- [ ] Verificar tipos, lint, formato y suites enfocadas al cierre diferido.
- [x] Diseñar tests de conversiones, redondeo, edición/reversa y concurrencia; diferir ejecución.

### Fase 6 — Entrada simple de insumos y vínculo financiero

- [x] Registrar recepción de varias líneas con insumo, cantidad y unidad; proveedor/comprobante opcionales.
- [x] Permitir capturar la recepción antes de pagar sin modificar Caja/resultado hasta que ocurra un pago real.
- [x] Enlazar egreso inicial y abonos con la recepción; usar Créditos por pagar para saldos pendientes, con contexto Business.
- [x] Conservar referencias entre recepción, movimientos, payable y libro de inventario; impedir doble contabilización.
- [x] Excluir órdenes de compra, cotizaciones, gestión avanzada de proveedores y valuación de inventario.
- [x] Diseñar cobertura de conversión, multi-línea, consistencia financiera, atomicidad, tenant isolation y recepción no pagada; diferir ejecución hasta Fase 9.
- [x] Separar Catálogo e Historial de entradas en rutas y vistas propias, manteniendo navegación secundaria accesible desde ambas.
- [x] Incorporar historial tenant-scoped paginado con búsqueda de proveedor/referencia y rango de fecha civil.
- [x] Al pagar la entrada completa, registrar el egreso real y la trazabilidad sin crear una cuenta por pagar; solo generar payable si queda saldo. Índice opcional/único y prueba transaccional diseñados; pendientes de verificación final y materialización del índice en Atlas.
- [x] Enlazar cada entrada con sus productos y su cuenta por pagar exacta; ofrecer retorno al historial desde la cuenta por pagar.
- [x] Crear contrato de índice para la consulta paginada y registrar scripts de materialización/verificación; materialización en Atlas pendiente de operación autorizada/conectividad.
- [x] Diseñar pruebas de filtros, paginación, aislamiento de tenant, fechas civiles y navegación exacta; diferir ejecución hasta Fase 9.
- [x] Adaptar el formulario de entradas al modal amplio del POS: líneas apiladas en grilla, encabezados compartidos, resumen lateral y controles accesibles/responsivos; prueba de estructura diseñada, no ejecutada.

### Fase 7 — Fórmulas de productos preparados

- [x] Marcar artículos como vendibles, insumos o ambos; ocultar insumos puros del POS normal y rechazar su venta desde backend.
- [x] Configurar fórmulas versionadas con componentes, cantidades/unidades y rendimiento por producto preparado.
- [x] Permitir seleccionar fórmula y ajustar cantidades en ventas personalizadas; guardar snapshot completo.
- [x] Validar y descontar componentes atómicamente al confirmar venta; no duplicar saldo del preparado hecho a pedido.
- [x] Reversar ventas desde snapshots históricos sin depender de la fórmula vigente.
- [x] Diseñar pruebas de fórmulas, unidades, falta de stock, personalización, concurrencia y reversas; diferir ejecución.

### Fase 8 — Combos fijos

- [x] Modelar un combo como agrupación fija de artículos vendibles, distinta de una fórmula de preparación.
- [x] POS vende una línea de combo y descuenta sus componentes de forma atómica.
- [x] Definir precios, disponibilidad, edición/cancelación y preservar la receta histórica usada en cada venta.
- [x] Diseñar tests de composición, conversión granular, falta de stock, concurrencia y reversas; diferir ejecución.

### Fase 9 — Verificación y cierre

- [ ] Ejecutar primero suites enfocadas de cambios nuevos y riesgos de integridad.
- [ ] Ejecutar una única suite Vitest completa con timeout explícito ≥45 minutos; E2E completa solo con timeout ≥90 minutos y si el alcance integrado lo requiere.
- [ ] Ejecutar typecheck, lint, formato y gates necesarios del repo; no declarar PASS sin ejecución.
- [ ] Resolver fallos, documentar resultados, actualizar este tracker y emitir cierre.

## Riesgos y fronteras

- La moneda de un movimiento debe seguir coincidiendo con la moneda de su cuenta; la UI simplifica la elección, no cambia `ACC-1`.
- Un solo identificador telefónico significa que un cliente que cambió de número debe actualizar su ficha. No se puede demostrar identidad entre dos números diferentes sin una relación adicional.
- Email opcional puede señalar una posible ficha existente, pero no debe convertirse silenciosamente en identificador sustituto.
- Unidades fraccionarias afectan cantidad, stock, totales de líneas y snapshots históricos. Deben diseñarse sobre unidades escaladas/precisión definida, no `float` financiero.
- Granularidad, recetas de productos preparados y combos son tres conceptos distintos que comparten el inventario.
- Las nuevas capacidades de inventario no crean Compras ni prometen margen/utilidad sin costo confiable.

## Registro de progreso

### Fase 0

- Plan aprobado por el fundador el 2026-09-27.
- Protocolo de ejecución diferida de pruebas actualizado en los documentos normativos.
- Dominio financiero continúa congelado; Fases 5–6 quedan sujetas a diseño y revisión específica antes de tocar contratos POS/financieros.

### Fase 1

- Inicio autorizado junto con la aprobación del plan (2026-09-27).
- Implementación completa por inspección de archivos.
- Cambios: moneda de movimiento derivada de cuenta; card de cuenta del Resumen con badge fijo superpuesto y sin acciones; etiquetas de catálogo por tipo; fondos semánticos sutiles para categorías; espacio inferior de Perfil.
- Pruebas diseñadas/actualizadas: `movement-form.test.tsx`, `dashboard-content.test.tsx`, `category-section-style.test.ts`, `catalog-type-style.test.ts`, `profile-form.test.tsx`.
- Pruebas **no ejecutadas** por decisión del fundador; quedan para Fase 9.

### Fase 2 — Implementada por inspección

- Hecho por inspección: cards de venta compuestas con `MovementCard`, conservando detalle, abonos, borrado y aviso de crédito administrado.
- Hecho por inspección: `SalesPage` pasa el ID real del `CreditGranted` asociado mediante `saleId`; la venta muestra un enlace accesible a `/credits/granted?highlight=<creditId>`.
- Hecho por inspección: Créditos otorgados valida que el ID exista, centra su card y aplica resaltado por 3 segundos con `motion-reduce:animate-none`.
- Pruebas diseñadas en `sale-credit-links.test.ts`, `credit-highlight.test.ts` y `filter-bar-a11y.test.tsx`: mapeo exacto, URL, ausencia de vínculo/ID, elemento objetivo, duración y preferencia de movimiento reducido.
- Pruebas de esta fase: **no ejecutadas**.

### Fase 3 — En curso

- Implementado por inspección: teléfono obligatorio en formularios/acciones de alta y edición; normalización E.164 sin inferir país; mensaje explícito de formato.
- Implementado por inspección: detección de duplicado por teléfono en el workspace y traducción de errores de formato/duplicidad. El índice único y su garantía ante carreras quedan pendientes de la auditoría de base de datos.
- Implementado por inspección: aviso accionable en Clientes para teléfonos vacíos, inválidos o legados con formato no canónico; edición conserva el ID del cliente y no altera sus relaciones.
- Auditoría: `scripts/ensure-client-phone-index.mjs` es de solo lectura por defecto, omite nombres y números completos en el reporte, y ofrece `--apply` únicamente si los valores no vacíos son canónicos y no hay colisiones. La conexión a MongoDB agotó el tiempo de espera en este entorno; no se aplicó ningún índice ni se modificaron registros.
- La segunda auditoría terminó con `querySrv ETIMEOUT _mongodb._tcp.cluster0.06amtxd.mongodb.net`; falló antes de leer datos. Se añadió `scripts/verify-client-phone-index.mjs`. El índice no está declarado para auto-creación en el modelo: se materializa de forma explícita solo tras auditar la base, evitando activarlo accidentalmente antes de revisar datos legacy.
- Hecho por inspección: `/clients/[clientId]` valida sesión y ObjectId, carga el cliente dentro del workspace, presenta ventas POS paginadas (15 por página) y solo créditos unidos por `saleId`; ambas consultas filtran por workspace. El índice compuesto de historial mejora esas lecturas y las acciones enlazan al crédito exacto.
- Pruebas diseñadas/actualizadas: `client-phone.test.ts`, `clients.test.ts`, `clients/actions.test.ts`, `clients-list.test.tsx` y `client-activity.test.tsx`; también se actualizaron los fakes que implementan los puertos afectados. No ejecutadas.
- Nueva cobertura de integración diseñada: `client-phone-uniqueness.test.ts` comprueba inserciones concurrentes en el mismo workspace y permite el mismo teléfono en workspaces distintos; `models/indexes.test.ts` inspecciona el contrato del índice real en MongoMemoryReplSet. No ejecutadas.
- Pendiente de cierre de esta fase: correr auditoría cuando MongoDB esté accesible, crear/verificar el índice único parcial, y cubrir explícitamente la carrera concurrente con Mongo real. La revisión de código no sustituye esas verificaciones operativas.

### Fase 4 — Contrato aprobado y ampliado

- El fundador aprobó las cinco reglas del contrato con “ok” el 2026-09-28. Ver `inventory-mvp-contract.md`.
- El 2026-09-28 el fundador aprobó llevar el caso de negocio de insumos hasta un flujo integrado. El alcance ahora diferencia: recepción simple de insumos (no Compras ERP), fórmulas para productos preparados y combos fijos.
- Política financiera de diseño: recibir cantidades no crea egresos. Los pagos se vinculan con movimientos Business existentes y las compras a crédito con Créditos por pagar Business. No se calcularán costo de venta ni márgenes. La recepción está implementada por inspección; la validación de todas las fases se ejecuta en Fase 9.
- Fase 5 parcialmente implementada: unidades exactas en átomos enteros, conversión solo dentro de dimensión, snapshot de unidad/cantidad en ventas, actualización de existencias y bitácora para apertura/venta/reversa/ajuste.
- Se añadió control de entradas/salidas manuales con motivo y efecto exclusivamente sobre existencias, y sin movimientos financieros.
- La creación de saldo inicial, decrementos por venta, reversas y ajustes generan una bitácora inmutable dentro de la misma transacción que cambia el saldo.
- Esta implementación aún no está verificada por typecheck o pruebas; ambas quedan diferidas a Fase 9. En esta sesión `pnpm exec prettier` no resolvió el ejecutable desde PowerShell; se usó el binario local directamente y `prettier --check` pasó para los archivos modificados.
- Combos permanecen como fase separada; no se debe describir la ronda como terminada hasta modelar composición y consumo atómico de componentes.

## Continuidad al retomar (2026-09-28)

El fundador pidió retomar la ronda el 2026-09-28. El estado del checkout permanece sin commit; no se ejecutó la suite de pruebas y la auditoría de MongoDB volvió a fallar por `querySrv ETIMEOUT` del DNS de Atlas, sin cambios en la base.

Orden recomendado al retomar:

1. Con MongoDB accesible, ejecutar primero la auditoría read-only de `scripts/ensure-client-phone-index.mjs` (sin `--apply`). Resolver cualquier colisión o valor inválido manualmente, sin fusionar clientes ni eliminar sus relaciones.
2. Cuando la auditoría pase, aplicar el índice con `--apply` y confirmar el resultado con `scripts/verify-client-phone-index.mjs`.
3. La carrera concurrente ya tiene una prueba de integración diseñada en `src/infrastructure/repositories/client-phone-uniqueness.test.ts`; ejecutarla en la Fase 9 para completar la verificación de la Fase 3.
4. Ejecutar en Fase 9 la verificación acumulada de recepción, fórmulas y combos; las tres implementaciones ya están completas por inspección.
5. Mantener pruebas diseñadas pero diferidas. En la Fase 9 ejecutar primero suites enfocadas, luego una única suite completa con timeout explícito ≥45 minutos, y finalmente typecheck/lint/build según las reglas del proyecto.
6. Antes de cualquier commit, revisar el diff completo; el trabajo actual no está commiteado.

### Avance de implementación integral (2026-09-28)

- Fase 6 implementada por inspección: Catálogo permite registrar entradas multi-línea de productos físicos con unidades compatibles, moneda/cuenta seleccionadas, importe pagado ahora y saldo restante. El proveedor es obligatorio cuando queda un saldo pendiente; la referencia sigue siendo opcional.
- La operación crea en una transacción un recibo inmutable, registros de entrada al libro de stock y un payable Business. Pago inicial cero no crea movimiento; pago inicial positivo genera un egreso Business mediante la ruta de payable existente; los abonos futuros heredan el contexto Business.
- Catálogo muestra las 20 entradas recientes y un enlace a Créditos por pagar. La traducción explica qué cambia y cuándo se crea el egreso.
- Pruebas diseñadas, no ejecutadas: `receive-inventory-receipt.test.ts` cubre recepción multi-línea, ingreso al libro de stock, payable Business sin movimiento cuando no hay pago, egreso Business por el pago inicial, proveedor obligatorio ante saldo pendiente, proveedor opcional con pago completo y rollback ante fallo de una línea. `money.test.ts` cubre conversión decimal exacta a minor units y precisión por moneda. Falta materializar pruebas de adapter Mongo tenant-scope/atomicidad y de interfaz.
- La clasificación vendible/insumo/ambos de Fase 7 también quedó implementada: el rol se guarda en catálogo, artículos legacy se leen como vendibles, el POS oculta insumos puros y el caso de uso de venta los rechaza en backend. Se diseñó la prueba de rechazo de venta de insumo en `sales.test.ts`; fórmulas versionadas y personalización de preparados siguen pendientes.
- Auditoría correctiva: una ficha con stock/recibos podía borrarse y dejar registros huérfanos. El borrado de Catálogo ahora comprueba el historial y, desde la acción de servidor, lee/verifica/elimina dentro de una transacción; los recibos y ledger de stock hacen conflicto con la eliminación concurrente del mismo producto.
- Auditoría correctiva: el formulario de recepción convertía moneda en el cliente usando `Number` y redondeo. Ahora envía los decimales como texto y el servidor los convierte a minor units con `decimalAmountToMinorUnits`, rechazando precisión no representable y overflow. La fecha inicial usa `toDateInputValue()` (fecha civil local); ya no deriva de `toISOString()`.
- Auditoría correctiva: las notas automáticas de payable contenían texto español persistido. La recepción ya no genera una nota localizada; la referencia permanece en el recibo. Cuando no se conoce proveedor, usa un valor neutral.
- Auditoría de integridad posterior: la cuenta por pagar de una entrada podía borrarse independientemente, eliminando sus movimientos y dejando vivo el recibo/stock, y su total podía editarse sin cambiar el costo registrado en el recibo. Ahora los casos de uso bloquean ambos cambios con referencia tenant-scoped dentro de la transacción; los abonos siguen permitidos para registrar pagos posteriores. La tarjeta abre el payable exacto o explica cuando el registro histórico ya está huérfano. La creación de recibo reclama idempotencia persistente y el `touch` de cuenta queda como última escritura tras recibir stock y persistir recibo. Se diseñaron pruebas de acción duplicada, referencia protegida, rollback y orden de escritura; diferidas a Fase 9.
- Mejora UX acordada e implementada: Catálogo deja de cargar entradas y cuentas; `/pos/catalog/receipts` administra registro e historial por separado, con filtros de proveedor/referencia y fechas civiles, 20 resultados por página y navegación secundaria compartida. Las líneas enlazan el producto exacto con resaltado, el saldo abre la cuenta por pagar exacta y esa vista ofrece retorno al historial. Las fechas se muestran explícitamente en UTC para conservar la fecha civil persistida. El acceso desde menú mantiene activa la sección Catálogo. Pruebas de aplicación, integración Mongo e índice diseñadas, no ejecutadas.
- El historial añade el índice `workspace_date_createdAt_id` sobre `inventoryreceipts`; antes de desplegar esta consulta debe verificarse/materializarse con `scripts/ensure-inventory-receipt-indexes.mjs --apply` y validarse con `scripts/verify-inventory-receipt-indexes.mjs`. No se ejecutaron contra Atlas.
- Las pruebas siguen diferidas. Prettier y `git diff --check` pasaron. `tsc --noEmit` aún no pasa porque el árbol de pruebas tiene problemas de compilación (entre ellos `@testing-library/react` no instalado y varios fakes/fixtures desactualizados); no se ejecutaron suites.
- Estado de chequeo preciso: typecheck y pruebas de esta corrección no se ejecutaron; las verificaciones continúan diferidas a Fase 9.

### Continuidad inmediata

1. Ejecutar la Fase 9: primero suites enfocadas (incluida la integración Mongo de inventario/combos), luego una única suite completa con timeout explícito ≥45 minutos, y typecheck/lint/build según los gates vigentes.
2. Resolver errores de pruebas/types; verificar el índice telefónico en Atlas cuando el DNS/conexión esté disponible y cubrir navegación exacta al payable de recepción.
3. No cerrar la ronda hasta documentar resultados reales de las verificaciones y los bloqueos operativos que sigan vigentes.

### Fase 7 — Implementada por inspección (2026-09-28)

- Fórmulas inmutables por versión viven en el producto preparado. Cada versión guarda rendimiento, componentes, unidades, cantidades exactas en átomos y fecha; el alta usa CAS transaccional para evitar versiones duplicadas.
- La configuración valida que el producto preparado y cada insumo pertenezcan al workspace, que los insumos controlen existencias y que las unidades coincidan con sus dimensiones. Los insumos quedan protegidos contra eliminación o cambio a producto vendible mientras una fórmula los referencia.
- POS permite vender unidades preparadas existentes o elegir una versión de fórmula para producirlas bajo pedido. En modo fórmula se pueden ajustar las cantidades de cada insumo; la salida preparada no recibe una segunda existencia.
- La venta guarda la versión y el consumo real (ID/nombre/unidad/cantidad base) en cada línea. Componentes repetidos se agregan y descuentan dentro de la transacción de venta; falta de stock aborta todos los cambios. La reversa repone desde ese snapshot aunque cambie la fórmula actual.
- El detalle de venta presenta el consumo histórico. Se diseñaron pruebas de dominio, configuración/versionado, personalización, saldo insuficiente/rollback, protección de referencias, conservación de stock preparado y reversa; no ejecutadas hasta Fase 9.
- Auditoría UX posterior: el rendimiento de fórmula ahora limita su precisión según la unidad del producto; el formulario se remonta al cambiar de producto o de versión para no conservar cantidades anteriores; en venta se muestra el rendimiento concreto y se explica que el consumo escala con la cantidad vendida. Textos disponibles en español e inglés.
- **Pendiente:** verificación de tipos, lint y suites enfocadas de cierre; concurrencia real de recetas/ventas/borrados queda cubierta en `src/infrastructure/transactions/inventory-formulas.test.ts`, diseñada pero no ejecutada.

### Fase 8 — Implementada por inspección (2026-09-28)

- El combo es un producto vendible discreto con precio propio y sin existencia duplicada; requiere saldo cero al convertir un producto sin historial de ventas. No se permiten combos anidados ni productos ya usados por fórmulas como destino de conversión.
- Cada composición se agrega como versión inmutable y admite componentes vendibles con unidades granulares. Los componentes quedan protegidos contra borrado y cambio a insumo puro; disponibilidad muestra el máximo de combos según el componente limitante.
- POS incorpora una línea con precio de combo, presenta la composición y cantidad disponible, y conserva la versión elegida en la línea. La venta escala componentes en unidades base, los descuenta atómicamente y conserva el snapshot real; eliminación repone desde ese snapshot aunque luego cambie la composición.
- No se reciben ni ajustan existencias del combo; los ajustes y las recepciones corresponden a sus componentes. El índice tenant-scoped de referencias de ventas se declara para evitar escanear historiales al convertir productos.
- Pruebas diseñadas, no ejecutadas: dominio/disponibilidad, configuración y versionado, selección de una línea, conversión granular, falta de stock/rollback, concurrencia, protección de referencias y reversa después de cambiar composición (`product-combo.test.ts`, `configure-product-combo.test.ts`, `sales.test.ts`, `inventory-formulas.test.ts`, `models/indexes.test.ts`).
- **Verificado estáticamente:** Prettier y `git diff --check` pasan; las traducciones español/inglés tienen 929 claves coincidentes.
- **Pendiente:** tipos, lint y suites enfocadas en Fase 9; el índice nuevo requiere verificar su materialización en la base de datos cuando corresponda.

### Estado de sesión y archivos relevantes (2026-09-28)

- Working tree compartido y sin commit; esta ronda acumula cambios de múltiples solicitudes anteriores. No hacer reset ni asumir que todos los diffs pertenecen solo a recepción.
- Implementación de recepción: `src/core/application/inventory/receive-inventory-receipt.ts`, `src/core/domain/inventory-receipt.ts`, `src/infrastructure/models/inventory-receipt.ts`, `src/infrastructure/mappers/inventory-receipt.ts`, `src/infrastructure/repositories/inventory-receipt-repository.ts`, y UI/acción en `src/app/(main)/pos/catalog/inventory-receipt-form.tsx` y `actions.ts`.
- Contexto Business de Créditos por pagar se conserva en `src/core/domain/payable.ts`, `src/infrastructure/models/payable.ts`, mapper y casos de uso `src/core/application/payables/*`; revisar especialmente pagos iniciales y abonos.
- Correcciones de auditoría a revisar al retomar: parser `decimalAmountToMinorUnits` en `src/core/domain/money.ts`; guard de eliminación `hasInventoryHistory` en `CatalogItemRepository` y `delete-catalog-item.ts`; conversión de fecha con `toDateInputValue()` en el formulario de recibos; producto supply-only admite precio cero y oculta “precio de venta”.
- Nuevas pruebas diseñadas sin ejecución: `src/core/application/inventory/receive-inventory-receipt.test.ts`, añadidos en `src/core/domain/money.test.ts`, `src/core/application/catalog/catalog.test.ts` y `src/core/application/sales/sales.test.ts`.
- Fórmulas: `src/core/domain/product-formula.ts`, `src/core/application/catalog/configure-product-formula.ts`, `src/infrastructure/transactions/inventory-formulas.test.ts` y `src/app/(main)/pos/catalog/product-formula-form.tsx`; pruebas diseñadas, no ejecutadas.
- Dependencia técnica pendiente: `tsc --noEmit` incluye pruebas y revela `@testing-library/react` ausente, fixtures incompletos en export CSV, fakes de UoW/repositories desactualizados. No instalar paquetes sin justificar; primero valorar reemplazar el test de card por una prueba sin dependencia nueva o documentar el paquete requerido.
- La continuidad queda centralizada en este tracker y en el documento maestro; no depende de un servicio externo de memoria.

### Continuidad de sesión — incidencia de recepción (2026-09-28)

- El fundador reportó que una entrada nueva no queda registrada. En el log compartido, Next muestra `POST /pos/catalog/receipts 200` y `receiveInventoryReceiptAction(null, {})`; ese log solo confirma que la Server Action respondió, no que la transacción se haya confirmado ni qué error ocurrió.
- El mensaje visible del formulario fue **“La operación falló. Intenta de nuevo.”**, que corresponde a `error.operationFailed` para errores inesperados. La acción atrapa el error y no expone su detalle al formulario. No se obtuvo el evento de monitoreo ni el stack trace, por lo que la causa raíz sigue **sin confirmar**.
- Hipótesis prioritaria, condicionada a que la entrada fuese totalmente pagada y por tanto no tenga `payableId`: Atlas podría conservar el índice único anterior `{ workspaceId: 1, payableId: 1 }` sin filtro parcial. Ese contrato permite solo un recibo sin `payableId` por workspace; varias entradas completamente pagadas podrían fallar con E11000. La definición correcta del modelo y el script ya requieren índice parcial `payableId: { $type: "objectId" }`, pero no se confirmó su materialización en Atlas. Si el recibo fallido dejó saldo y sí generaba payable, esta hipótesis no explica por sí sola el fallo.
- Se intentó ejecutar `node scripts/verify-inventory-receipt-indexes.mjs` en esta sesión; abortó antes de conectarse porque `MONGODB_URI` no está disponible en el entorno. No hubo lectura ni modificación de Atlas. El historial registra un intento anterior que falló por `querySrv ETIMEOUT`; no asumir que ese intento anterior o el estado actual identifican el índice activo.
- Próximos pasos al retomar, en orden: (1) obtener del monitor de errores el evento asociado a `receiveInventoryReceipt` / `inventoryReceipt` y su detalle sanitizado; (2) con entorno MongoDB configurado, ejecutar `scripts/verify-inventory-receipt-indexes.mjs` (solo lectura); (3) si el índice payable está desactualizado, revisar el plan de reconciliación y ejecutar `scripts/ensure-inventory-receipt-indexes.mjs --apply`, después verificar de nuevo; (4) reproducir una recepción totalmente pagada y otra con saldo pendiente, confirmar atomicidad de stock, recibo, movimiento/payable e idempotencia. No volver a registrar el mismo formulario hasta aclarar si la operación anterior pudo haberse confirmado; primero revisar historial/stock para evitar duplicados.
- El intento de lectura de terminal de Codex indicó que no hay sesión de terminal adjunta. No se ejecutaron pruebas ni typecheck en esta incidencia; la política de verificación diferida a Fase 9 sigue vigente.

### Incidencia de recepción RESUELTA (2026-09-28/29, sesión de retoma)

- **Acceso a MongoDB restaurado** cargando `.env.local` en el entorno del script (`set -a && . ./.env.local`). Conectividad Atlas OK desde este equipo; los timeouts previos fueron del entorno de sesión anterior.
- **Causa raíz 1 confirmada con evidencia del audit log (`operationlogs`):** dos intentos del 2026-09-29 03:12/03:13 UTC fallaron con `E11000 duplicate key ... index: workspaceId_1_payableId_1 dup key: { workspaceId: ..., payableId: null }`. Atlas conservaba el índice único SIN `partialFilterExpression`; la segunda entrada totalmente pagada del mismo workspace violaba la unicidad. Reconciliado con `scripts/ensure-inventory-receipt-indexes.mjs --apply` (dry-run previo; sin duplicados preexistentes: 0 grupos duplicados de `(workspaceId, payableId)`); verificación posterior `[PASS]` para ambos índices del contrato.
- **Causa raíz 2 descubierta durante la reconciliación:** `toInventoryReceiptDocData` no persistía `_id`; `receiptRepo.create` insertaba con ObjectId autogenerado mientras stock records y el movimiento `inventoryReceiptPayment` referenciaban el id minteado en la transacción → referencias huérfanas estructurales en TODOS los recibos (3/3 afectados). Fix: `_id: new Types.ObjectId(receipt.id)` en el mapper (`src/infrastructure/mappers/inventory-receipt.ts`).
- **Reconciliación de datos:** `scripts/reconcile-inventory-receipt-references.mjs` (dry-run por defecto, correlación 1:1 única por workspace+ventana de 90s, rechaza ambigüedad) re-puntó 4 stock records + 1 movimiento al `_id` real; normalización de tipos a `String` según el schema. Verificación final: 0 referencias fantasma en ambas colecciones.
- **Error del 02:22 UTC** ("Inventory receipt payments require a Business expense linked to its account and receipt") atribuido a una iteración intermedia del código esa tarde; el éxito del 02:28 y la data persistida confirman que el código actual satisface el guard del dominio (`movement.ts`).
- **Verificación honesta:** suites enfocadas ejecutadas — `inventory-receipt-references.test.ts` (6/6, replSet real), `receive-inventory-receipt.test.ts` (5/5), `receipt-idempotency.test.ts` (4/4) = **15/15**. Se agregó test de regresión "allows a second fully-paid receipt without payable in the same workspace" que reproduce el E11000 del incidente. Los tests pre-diseñados ya pinneaban el contrato `_id`; la ejecución diferida permitió que el bug llegara a producción.
- **Pendiente operativo:** el fundador debe reintentar el registro de la entrada en la UI (el caso 03:12 quedó en nada; idempotencia liberó la clave). El servidor dev debe recargar el mapper. Typecheck/lint/build completos siguen diferidos a Fase 9 (el árbol de pruebas tiene issues preexistentes no relacionados).

### Mejoras UX guiadas por el fundador (2026-09-28/29, post-incidencia)

- **Bugs de la pantalla de ventas corregidos** (capturas del fundador): (1) `(unit_unit)` crudo en las líneas del formulario — cruce de namespaces i18n en sale-form (unit_* vive en Catalog, claves combo* en Sales; 6 call sites corregidos); (2) recuadro ilegible del panel de combo/fórmula — `bg-surface-muted` usado como fondo siendo un token de TEXTO (invisible en light); reemplazado por `bg-zinc-100 dark:bg-zinc-800` (patrón del repo) en ambos paneles. `sale-detail-modal` ya estaba correcto.
- **Alta guiada de combos**: el select de Tipo del formulario de catálogo ahora ofrece "Combo" (solo en alta; edición mantiene Producto/Servicio). La opción fija automáticamente la forma exacta que exige `configureProductCombo` (type=product, role=sellable, saleUnit=unit, stock=0) vía inputs ocultos, oculta los campos irrelevantes y tras crear salta directo al modal de composición (sin modales anidados). El dominio financiero y el contrato del server action quedan intactos. Descripción dinámica bajo el select para cada tipo (i18n es/en, paridad 976/976).
- **Tests**: nuevo `catalog-form-combo.test.tsx` (4 tests, patrón createRoot sin testing-library) — opciones del select, hint por tipo, forma oculta del preset, restauro al volver a Producto, edición limitada a producto/servicio. Reparado `actions.test.ts` (mock de MongoUnitOfWork que faltaba tras el wrapper transaccional de la ronda — fallo preexistente de la ejecución diferida). Suites enfocadas: sale-form 57/57, catalog actions 2/2, catalog-form-combo 4/4.
- `tsc --noEmit` mantiene 38 errores PREEXISTENTES de la deuda de Fase 9 (testing-library ausente, fixtures export-csv, fakes); cero errores en archivos tocados hoy.

### Cuarta iteración del fundador (2026-09-29, receta guiada + jerarquía del catálogo)

- **Opción "Receta" en el alta guiada** (espeja la de Combo): fija type=product/sellable/stock=0 y mantiene el select de unidad visible porque ES el rendimiento de la fórmula (relabeled "Unidad de venta (rinde la receta)"). Bug que el test atrapó: `resolvedType` no mapeaba `recipe` → el hidden input habría enviado `type=recipe` inválido al server action; corregido. Al guardar se abre el modal de receta (mismo patrón anti-remount del refresh).
- **Modal de receta ampliado a `lg`** y "Quitar línea" como `ActionIconButton` icon-only (también en combo form). **Reglas del fundador registradas en PROJECT-RULES §15**: acciones de fila icon-first y selects de alta neutros.
- **Preparado en POS: default = fórmula más reciente** (modo existencias queda seleccionable pero ya no es default).
- **Catálogo agrupado por prioridad de venta**: "A la venta" (incluye Productos e insumo) → "Servicios" → "Insumos" colapsados con badge; auto-abre si el highlight del historial de entradas apunta ahí; búsqueda filtra las 3 secciones. Agrupación solo-de-presentación (`catalog-groups.ts`, test pinnea el orden).
- **Cards de Entradas re-diseñadas** sobre el MovementCard compartido (proveedor primario, badge de pago verde/ámbar/rojo-huérfano conservando el caso del payable borrado, breakdown plano de líneas). i18n es/en 994/994.
- **Skeletons sincronizados**: catalog reescrito al layout agrupado; receipts loading.tsx NUEVO (la ruta heredaba el de catalog y saltaba de max-w-6xl a max-w-3xl).
- **Lint del highlight de créditos**: `react-hooks/set-state-in-effect` — highlight derivado del URL con timer de expiración local (estado `highlightExpired`); tests 3/3.

## Estado de commit (2026-09-29)

- **12 commits locales sin pushear** sobre `1a1beac`: `07314a0` feat(product) fases 1-3 · `4048c1a` feat(inventory) fases 4-8 · `75318ea` feat(pos) UI · `0dcb494` chore(inventory) scripts índices+reconciliación · `7f5ae4f` docs · `2012d19` fix(save-card emphasis) · `adae6e5` feat(receta guiada) · `85cd81c` fix(receta modal+reglas) · `a1ed77f` feat(default receta) · `3bb07b6` feat(catalog groups) · `ba2ed1f` fix(cards entradas) · `4c04597` fix(skeletons). Commit pendiente: fix lint highlight + esta documentación.
- **Verificación PRE-PUSH (Fase 9)** documentada con checklist en `docs/AUDIT-AND-PLAN.md`: suites enfocadas de not-redesigned suites, única suite completa ≥45min, `tsc` en 0 (4 BigInt + 26 errores de tests a resolver o documentar decisión de `@testing-library/react`), lint 0 (logrado), build, y auditoría del diff de 12 commits.
- **Índices**: Entradas `[PASS]×2`; teléfono sigue FAIL pendiente de ventana Atlas (scripts listos, operación autorizada pendiente).

### Segunda iteración del fundador (2026-09-29, post-alta guiada)

- **Error 1 — modal de composición no se abía tras crear el combo (RESUELTO, causa raíz confirmada):** `router.refresh()` corría ANTES de `onDone` en el efecto de éxito de `catalog-form`. La página es async con `loading.tsx`: el refresh suspende el árbol, el boundary de loading REEMPLAZA la página y **destruye el estado de cliente** (`comboItem` recién seteado). Evidencia en Atlas: "Combo 3" (05:01 UTC) creado con la forma correcta pero sin composición; "Combo 1/2" creados por vía del botón de card sí tienen composición. Fix: `onDone` primero, `refresh` después (mismo orden aplicado a sale-form por consistencia). Test de flujo `catalog-list-combo-flow.test.tsx` (mock fiel del modal con children montados) reproduce la cadena completa: 1/1.
- **Error 2 — ajuste de existencias rechaza enteros en productos "por unidad" (RESUELTO):** `stock-controls.tsx` usaba `min="0.001"` con `step="1"` para saleUnit=unit; la grilla HTML de validación es `min + N×step` → solo aceptaba 0.001/1.001/2.001 (mensaje exacto de la captura). Fix: `min` alineado al paso (`min=1` para unit, `min=0.001` para fraccionales). La validación server-side (`quantityToBaseUnits` con enteros estrictos para unit) permanece intacta.
- **Error 3 — paneles de combo/fórmula ocupan mucho espacio (RESUELTO):** en el form de ventas el panel informativo del combo ahora colapsa por defecto con toggle "Ver/Ocultar detalles" (encabezado versión+disponibilidad siempre visible); el panel de fórmula mantiene el Select de versión siempre visible y la lista editable de insumos colapsa con "Ver/Ocultar insumos". Claves i18n es/en (paridad 980/980). Estado por línea (`Set` por itemId:idx), colapsado por defecto según pedido del fundador.

### Tercera iteración del fundador (2026-09-29, cards + selects neutros)

- **Cards de catálogo con 5 acciones desbordadas (RESUELTO):** "Ajustar existencias" pasaba de botón etiquetado full-width a `ActionIconButton` (patrón ventas/movimientos, aria-label+title preservados); el footer de la card dejó el grid fijo de 5 tracks por un flex wrap `justify-end gap-1`. Test `catalog-item-card.test.tsx` migrado a `createRoot` (testing-library ausente) y extendido con aserción del footer flexible: 3/3.
- **Cards de ventas resaltan al cliente (RESUELTO):** el campo Cliente subió a la segunda fila con `primary: true` (junto a Total), antes de estado e items.
- **Ancho de Entradas de insumos (RESUELTO):** la página de historial de entradas pasó de `max-w-6xl` a `max-w-3xl` (igual que Ventas/Movimientos); grid de filtros redistribuido (`minmax(0,1fr)_0.7fr_0.7fr_auto_auto`); cards de recibo unificadas al patrón visual de movimientos (`rounded-lg px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900`).
- **Selects con valor neutro por defecto (RESUELTO — alta; edición conserva su valor persistido):** los selects de TODOS los formularios de alta ahora abren en "Seleccionar" en vez de precargar un valor de la lista: Cuentas (moneda), Categorías (tipo), Movimientos (tipo y contexto; la cuenta ya era neutra), Catálogo (tipo/moneda/unidad/rol + hint `typeHint_none`), Ventas (modo de pago; cuenta/cliente ya eran neutros), Créditos otorgados/recibidos y Cuentas por pagar (moneda), Entradas de inventario (líneas nuevas sin producto/unidad precargados). El `defaultCurrency` de perfil deja de inyectarse en los forms (su select propio permanece con el valor persistido). Efecto colateral corregido: `paymentMode` neutro exige que el dirty-check C12-1 compare contra `""`; `currency` de catálogo neutro usa etiqueta `unitPricePlain` hasta elegirla.
- **Tests actualizados al nuevo contrato:** movement-form (moneda derivada tras elegir cuenta, 2/2), catalog-form-combo (select abre vacío, placeholder solo en alta, 4/4), sale-form (57/57 con dirty neutro). Suites enfocadas totales: **71/71 en 7 archivos**.
- `tsc --noEmit`: un error menos que al inicio de la iteración (formatAmount currency narrowing); solo quedan los 4 BigInt preexistentes del target ES2017 en inventory-receipt-form. Cero errores nuevos.
