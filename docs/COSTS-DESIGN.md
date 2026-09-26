# Diseño futuro: costos e inventario

Estado: **diseño; no implementado ni aprobado como alcance de producto**
Última revisión: 2026-09-25.

## Objetivo y frontera

Dar a un negocio una base confiable para entender costo de adquisición, existencias, costo de venta y margen POS. Esta capacidad pertenece al dominio operativo de inventario/productos y debe quedar separada del dominio financiero actual. No modificar movimientos, cuentas, transferencias, saldos o resultado económico para incluir costos estimados.

El catálogo/POS existente puede ser fuente de identidad de producto, pero no debe asumirse que un precio de venta equivale a costo o que un producto existente tiene stock valorizado. La existencia de campos actuales debe auditarse antes de diseñar migraciones.

## Conceptos a modelar

- **Producto vendible:** identidad/SKU/unidad de medida y estado; servicio no almacena existencias.
- **Recepción o ajuste de inventario:** evento cuantitativo trazable con producto, cantidad, costo unitario y origen. No es automáticamente movimiento de caja ni gasto financiero.
- **Costo de adquisición:** costo documentado de entrada. Impuestos recuperables, flete, descuentos y otros costos directos necesitan política configurable/decisión de producto antes de capitalizarse.
- **Valorización:** FIFO y promedio ponderado son alternativas; promedio móvil reduce capas, FIFO mejora trazabilidad por lote. No escoger una por conveniencia técnica: validar con contador/mercado objetivo y definir cambios de método.
- **Costo de venta (COGS):** al confirmar una venta se consume cantidad y se captura un snapshot del costo asignado; editar precio de venta no reescribe costo histórico.
- **Devoluciones, anulaciones y negativos:** definir tratamiento por referencia a la venta/lote original, stock insuficiente, inventario negativo y redondeo. No ocultar el costo desconocido como cero.

## Relación con POS

POS sigue registrando precio, descuentos y pagos según el flujo actual. Futuro enlace producto→línea de venta debe guardar snapshots inmutables suficientes (producto/SKU, cantidad, precio, costo asignado y moneda base del costo). La venta y el costo deben ser consistentes ante concurrencia: no vender existencias ya consumidas ni calcular margen desde el precio actual del catálogo.

Una venta puede tener varias monedas/pagos bajo las reglas existentes; el costo necesita moneda propia y una política FX explícita con fecha/tasa/fuente si se compara con precio en otra moneda. No mezclar montos de moneda distinta ni inventar conversión implícita.

## Métricas y separación financiera

Margen bruto futuro = ventas netas de devoluciones/descuentos − COGS reconocido, en una moneda comparable y con política FX definida. Es analítica operativa; no debe sumar el total del `Payable` o de compras futuras al gasto financiero cuando se registran pagos. Tratamiento contable de inventario, COGS, impuestos y periodo debe validarse por separado antes de llamarlo utilidad contable.

## Decisiones requeridas antes de implementación

1. Segmento y unidades (retail, servicios, productos por peso/talla, variantes, lotes y vencimiento).
2. Método de costo y política de cambio/reexpresión.
3. Compras/recepciones: alcance, proveedores, documentos, gastos adicionales, monedas e impuestos.
4. Permitir/no permitir stock negativo y cómo resolver importación de saldos iniciales.
5. Devoluciones, anulaciones, descuentos, bundles y servicios.
6. Precisión y redondeo minor-unit por moneda y por unidad.
7. Auditoría, permisos, concurrencia, idempotencia y trazabilidad de reversos.
8. Reportes que distinguen margen estimado, margen con costo conocido y utilidad contable validada.

## Secuencia recomendada

Descubrimiento con negocios beta → glosario y decisiones contables → prototipo de flujo de recepción/ajuste → modelo de eventos e invariantes → plan de migración/backfill → simulación de concurrencia y reversos → MVP acotado de inventario → conexión de snapshots POS → analítica de margen. No iniciar implementación hasta decisión explícita de producto y revisión del impacto financiero.
