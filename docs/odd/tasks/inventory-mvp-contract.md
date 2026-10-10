# TwinCap — Contrato propuesto de inventario compartido

> Estado: **aprobado por el fundador (2026-09-28)**  
> Ronda: Producto 1 — Flujos claros para pequeños negocios  
> Alcance: base común para insumos, venta granular, recepción simple de inventario, fórmulas de productos preparados y combos. Ampliación aprobada por el fundador el 2026-09-28.

## Objetivo de producto

Un dueño de pequeño negocio debe poder responder rápidamente: qué productos tiene, cuántos quedan, qué cambió y por qué. El inventario complementa Caja y POS; no intenta administrar compras, proveedores, órdenes, costos contables ni operaciones de ERP.

## Vocabulario

- **Producto con existencias:** artículo que consume o repone una cantidad de inventario.
- **Servicio:** concepto vendible que no mantiene existencias.
- **Unidad base:** medida en la que se almacena la existencia (por ejemplo, unidad, gramo, mililitro o centímetro).
- **Movimiento de inventario:** registro inmutable de una entrada, salida, venta, reversa o corrección.
- **Combo:** producto vendible cuya disponibilidad deriva de sus componentes; no mantiene una existencia duplicada propia.
- **Insumo:** producto cuyo saldo se consume al preparar otros artículos; puede ser solo de inventario o también vendible.
- **Fórmula:** composición versionada de un producto preparado; cada componente tiene cantidad en la unidad propia del insumo.
- **Entrada de inventario:** recepción sencilla de insumos comprados, sin órdenes ni planificación de compras.

## Experiencia esperada

- La ficha de producto muestra de forma directa si controla existencias, su cantidad disponible y unidad.
- Las entradas/salidas manuales solicitan cantidad y motivo breve; su historial explica quién cambió qué y cuándo.
- Un servicio no muestra controles de stock.
- POS indica la unidad junto a la cantidad/precio y avisa con claridad cuando no hay disponibilidad suficiente.
- El sistema no genera movimientos financieros al ajustar existencias. El efecto financiero solo aparece cuando se registra una venta o un movimiento financiero explícito.
- Ninguna pantalla promete costo, margen o utilidad si TwinCap no cuenta con costos confiables.
- Una recepción puede guardar proveedor y comprobante como datos informativos y enlazarse a su pago o cuenta por pagar.
- La recepción de cantidades por sí sola no genera egresos. El pago se registra mediante las operaciones financieras existentes y queda enlazado a la recepción.
- Los insumos pueden marcarse como insumo, vendible o ambos usos.

## Modelo común propuesto

1. El catálogo conserva producto/servicio y recibe un indicador explícito de control de existencias.
2. El producto con existencias define una unidad base y una precisión en unidades enteras escaladas. No usar `float` binario para cantidades. Una conversión define un factor entero hacia esa unidad base.
3. La disponibilidad se representa en unidades mínimas enteras. La UI convierte y presenta el valor en la unidad configurada.
4. Un registro de inventario guarda workspace, producto/componente, delta firmado en unidades mínimas, unidad visible, motivo/origen, fecha, usuario y referencia opcional a venta/reversa.
5. La disponibilidad y el registro de movimiento se actualizan atómicamente. La política inicial propuesta prohíbe existencia negativa, incluso bajo ventas concurrentes.
6. Un ajuste equivocado se corrige con un movimiento compensatorio enlazado; no se edita ni elimina el registro histórico.
7. Cada consulta y mutación se limita al workspace activo. Los IDs de producto, combo y venta deben validarse dentro del mismo workspace.
8. Se añade recepción simple de cantidades ya compradas, sin órdenes, cotizaciones, gestión avanzada de proveedor ni logística ERP.
9. Una fórmula de producto preparado no es un combo: la fórmula consume ingredientes para producir un artículo vendible; el combo agrupa artículos vendibles.
10. Una venta personalizada puede ajustar los componentes usados para esa venta; POS valida existencias y guarda el snapshot para reversiones.

## Límites de alcance

- TwinCap no incorpora un módulo completo de Compras. Sí incorpora una recepción básica de insumos para registrar cantidad recibida y vincularla a su pago; no administra órdenes de compra, cotizaciones ni operación de proveedores.
- No se registra costo promedio, lote, vencimiento, ubicación, transferencia entre bodegas, reserva ni orden de compra.
- No se calcula costo de venta, margen bruto ni valuación de existencias. Las cantidades y pagos quedan trazables pero no distribuyen el costo de compra a cada venta.
- El contrato define las reglas compartidas; las fases 5–8 implementan granularidad, entradas, fórmulas y combos de forma separada.
- El precio POS y el dinero siguen las reglas monetarias actuales. El dominio financiero congelado no se cambia para soportar cantidades fraccionarias.

## Reglas para cantidades granulares

- Una unidad base granular puede ser g, ml o cm; kg, l y m se representan como conversiones enteras a la unidad base elegida.
- No se infieren conversiones entre dimensiones (masa↔volumen) ni entre unidades sin relación física conocida.
- El producto define la precisión que acepta; el POS rechaza una cantidad más precisa que la configurada.
- El precio por unidad conserva semántica explícita (por ejemplo, precio por kg) y se convierte a minor units con una regla de redondeo documentada antes de implementar.
- Una línea de venta guarda snapshot de cantidad, unidad, factor aplicado, precio, importe y nombre del producto para preservar el historial aunque cambie la configuración del catálogo.

## Reglas para combos

- Un combo tiene líneas de componentes de producto con cantidades expresadas en unidades de cada producto; no se puede incluir a sí mismo ni crear ciclos.
- La disponibilidad del combo se calcula a partir de todos sus componentes y no se almacena como saldo independiente.
- Una venta de combo descuenta cada componente en una única transacción; si un componente no alcanza, no se registra ningún descuento ni venta parcial.
- La venta conserva un snapshot de la composición y los factores usados. Cambiar la receta solo afecta ventas futuras.
- Los servicios no pueden ser componentes de un combo con descuento de stock en la primera entrega.

## Cambios posteriores a una venta

- Cancelar/revertir una venta restaura exactamente las cantidades descontadas por su snapshot, una sola vez, con referencia a la venta original.
- Editar una venta ya contabilizada como inventario requiere una operación atómica que compense las cantidades anteriores y aplique las nuevas. Si una edición no puede reservar el nuevo conjunto completo, se conserva íntegra la versión anterior.
- La clave/idempotencia de la operación evita doble descuento o doble reposición ante reintentos.

## Decisiones aprobadas

1. No permitir stock negativo.
2. Los ajustes manuales quedan fuera de Caja/resultado financiero y requieren motivo.
3. Unidades iniciales: unidad, mg/g/kg, ml/l y mm/cm/m, con conversión solo dentro de cada dimensión.
4. Los combos descuentan componentes y no mantienen saldo propio.
5. Las ediciones/cancelaciones deben compensar y aplicar stock dentro de la misma transacción; preservar el snapshot histórico.
6. La recepción sin pago no contabiliza un egreso; un pago se registra como gasto Business existente y una compra a crédito usa Créditos por pagar Business. La recepción enlaza esos registros para impedir duplicados.
7. La recepción admite líneas de insumo/cantidad/unidad; proveedor y comprobante son opcionales. No se crearán órdenes ni un catálogo obligatorio de proveedores.
8. Las fórmulas guardan versión y composición; las ventas personalizadas guardan el consumo real. La venta descuenta existencias dentro de su transacción y la reversa usa ese snapshot.

## Criterios de aceptación de diseño

- Un usuario distingue existencias, servicios y combos sin aprender términos de ERP.
- Cada cifra de stock tiene unidad visible y trazabilidad.
- No hay doble conteo de combos ni saldo por servicio.
- Las ventas concurrentes no producen stock negativo ni descuentos parciales.
- El inventario no altera por sí solo saldos de cuenta, resultado económico ni cuentas por pagar.
- Las consultas y escrituras respetan aislamiento por workspace.

## Addendum: rentabilidad básica para beta (2026-10-08)

El fundador autorizó una ampliación acotada para que los negocios puedan consultar costos y utilidad antes de beta. Este addendum **actualiza** las exclusiones de costo/margen/utilidad del alcance original; conserva la prohibición de crear un módulo completo de Compras y no cambia las reglas de recepción, POS, cuentas por pagar ni contexto financiero.

La especificación de fuente de verdad, costo promedio ponderado móvil, inventario inicial no valorado, ajustes, snapshots de costo en venta, reversas, métricas y límites está en [`profitability-beta-core.md`](profitability-beta-core.md). La implementación debe seguir sus fases y criterios. Hasta que P1–P3 estén completos, ninguna pantalla debe insinuar que TwinCap calcula rentabilidad total.
