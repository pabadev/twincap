# Roadmap de analítica de TwinCap

Estado: **diseño de roadmap; métricas nuevas no implementadas**
Última revisión: 2026-09-25.

## Convenciones

- **Existente:** valor que la aplicación ya calcula y presenta; conservar su definición y reglas multi-moneda.
- **Preparado:** datos actuales permiten explorar la métrica, pero falta validar semántica, calidad y experiencia antes de publicar.
- **Futuro:** depende de decisiones o capacidades todavía no existentes, especialmente costos/inventario.

No derivar métricas financieras en frontend desde movimientos crudos ni sumar distintas monedas. La fuente y los filtros deben ser explícitos, tenant-scoped y reproducibles.

## Mapa

| Área                 | Existente                                                                                                         | Preparado                                                                     | Futuro                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Resultado financiero | Resumen de ingresos/gastos y evolución disponible según naturaleza/kind de movimiento; multi-moneda por separado. | Comparaciones por periodo con definiciones y límites de lectura documentados. | Alertas de tendencia cuando haya umbrales y consentimiento configurables.                             |
| POS                  | Ventas, pagos, productos y clientes existen en el flujo operativo.                                                | Conteo y total de ventas, con filtros y denominador visibles.                 | Frecuencia por cliente, ticket promedio y cohortes, tras definir anulaciones, devoluciones y periodo. |
| Productos            | Catálogo y líneas de venta actuales.                                                                              | Unidades y ventas por producto donde los datos sean completos.                | Rotación, días sin movimiento y quiebres, una vez que exista inventario confiable.                    |
| Rentabilidad         | No existe costo de venta confiable en este alcance.                                                               | Ningún margen debe presentarse como real mientras falte costo histórico.      | COGS, margen y utilidad tras aprobar e implementar el diseño de costos.                               |
| Negocio              | Dashboard y tendencias de actividad existentes.                                                                   | Segmentación temporal coherente con fechas civiles.                           | Recomendaciones accionables tras validar explicabilidad, utilidad y falsos positivos con beta.        |

## Definiciones que cada métrica requiere

Antes de implementar: pregunta que responde; población y unidad (ventas, líneas o clientes); inclusión/exclusión de anulaciones, pagos parciales y devoluciones; moneda y FX; intervalo y zona de fecha civil; filtros aplicables; tratamiento de datos faltantes; permisos/tenant; límites de carga; empty state; fuente de datos; prueba de reconciliación con registros base.

Ejemplos:

- **Ventas netas** no es suma de cobros cuando hay venta a crédito o pago inicial; debe definirse con la entidad de venta y política de devoluciones.
- **Ticket promedio** debe especificar ventas consideradas y moneda comparable; no es total de movimientos dividido por número de filas.
- **Frecuencia de cliente** requiere identidad estable, periodo y manejo de ventas sin cliente.
- **Rotación** necesita existencias y costo/consumo verificables; no se calcula solo con unidades vendidas si no hay stock inicial y reposición completa.
- **Utilidad/margen** requiere COGS y política FX consistente; ingresos menos egresos de caja no constituye margen del producto.

## Secuencia propuesta

1. Validar con beta qué decisiones quieren tomar los usuarios y revisar la calidad del dato.
2. Congelar definiciones y diseños de filtros para métricas derivadas de ventas existentes.
3. Auditar aislamiento por workspace, límites de lectura y reconciliación antes de consultas nuevas.
4. Publicar solo métricas cuyo nombre coincida con la definición; mostrar moneda, periodo y filtros.
5. Reabrir rentabilidad después de decisiones e implementación de `COSTS-DESIGN.md`.
6. Considerar alertas/recomendaciones únicamente con evidencia de valor, explicación y control del usuario.

No agregar campos predictivos, tracking de eventos externos o dependencias de analítica durante esta ronda.
