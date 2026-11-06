# Ronda de evolución de producto — TwinCap

> Estado: **ABIERTA — evolución de producto en curso**  
> Inicio: 2026-11-06  
> Tracker activo y acumulativo para nuevos requerimientos del fundador.

## Propósito

Dar seguimiento a mejoras funcionales de TwinCap posteriores al cierre de la ronda pre-beta. Esta ronda puede recibir requerimientos nuevos; cada uno se registra con alcance, dependencias, prioridad y criterios de aceptación antes de implementarse. Agregar un requerimiento al tracker no implica por sí solo autorizar su implementación, salvo indicación explícita del fundador.

## Reglas de la ronda

- Preservar primero los flujos y principios financieros existentes.
- Mantener arquitectura hexagonal, aislamiento por `workspaceId`, i18n es/en y diseño mobile-first.
- Toda operación de servidor que use Mongoose debe conectar con `connectDb()` antes de crear repositorios.
- Diseñar/actualizar pruebas con cada cambio; la ejecución sigue la política diferida del proyecto hasta la verificación final o solicitud expresa.
- Para cada requerimiento nuevo, registrar origen/fecha, prioridad, dependencias, alcance aprobado y criterios de aceptación.
- No ampliar a facturación electrónica, numeración fiscal ni impresión silenciosa sin requerimiento y discovery específicos.

## Índice de requerimientos

| ID | Requerimiento | Estado | Prioridad |
| --- | --- | --- | --- |
| RP-01 | Comprobantes de venta PDF e impresión térmica desde historial | En curso | P1 |
| RP-02 | Reportes descargables: resumen, ventas, clientes e inventario | En curso | P1 |
| RP-03+ | Reservado para requerimientos que se agreguen durante la ronda | Sin definir | — |

---

## RP-01 — Comprobantes de venta PDF e impresión térmica

**Origen:** solicitud del fundador, 2026-11-06.  
**Estado:** implementación local parcial; verificación funcional y cierre pendientes.  
**Objetivo:** permitir consultar, descargar e imprimir un comprobante legible de una venta ya registrada desde el historial del POS, en papel térmico y carta.

### Alcance propuesto

1. Formatos disponibles: **58 mm predeterminado**, **80 mm** y **carta**.
2. Desde cada venta del historial, una acción **Comprobante** abre una vista previa y permite elegir formato, visualizar, descargar PDF o imprimir mediante el diálogo del navegador.
3. La selección inicial será 58 mm. Recordar la última opción en el dispositivo/sesión es una mejora opcional; evitar preferencias de negocio persistentes en el primer corte.
4. El comprobante usa los datos históricos guardados en la venta, no el catálogo actual.
5. Contenido base: nombre del workspace como encabezado, referencia estable y legible derivada del ID si no existe número de venta visible, fecha, cliente (o cliente general), artículos, cantidades, precio unitario, subtotal de líneas y total.
6. Estado de pago: venta de contado se muestra pagada; venta a crédito incluye importe abonado y saldo pendiente, consultando la deuda vinculada con las mismas reglas que el detalle actual de venta. No contabilizar abonos como ventas adicionales.
7. No presentar el comprobante como factura ni incluir campos fiscales en este alcance.
8. El PDF tendrá maquetación adecuada para cada tamaño; impresión usa la ruta estándar del navegador/PWA. Sin promesa de impresión silenciosa ni control de corte ESC/POS.

### Diseño de interacción

- **Móvil:** acción compacta por tarjeta, que abre un panel/modal de comprobante con selector de tamaño y acciones claras.
- **Escritorio:** acción en la fila/tarjeta de venta; la vista previa concentra selector y acciones.
- Mantener disponible la acción en ventas históricas permitidas por el flujo actual; definir explícitamente el comportamiento de ventas eliminadas antes de codificar.
- Textos visibles y errores en `messages/es.json` y `messages/en.json`.

### Criterios de aceptación propuestos

- Desde el historial se puede abrir la vista previa de una venta propia y elegir 58 mm, 80 mm o carta.
- Visualizar, descargar e imprimir producen el mismo contenido y total para el formato escogido.
- Venta de contado y venta a crédito (sin abonos, con abono inicial y con abonos posteriores) muestran correctamente pago y saldo.
- El contenido conserva nombres/precios de venta histórica aunque el catálogo cambie o el artículo se elimine.
- Una venta de otro workspace no puede consultarse mediante ID manipulado; errores no filtran su existencia.
- El comprobante no cambia datos, movimientos, existencias ni saldos.
- Layout probado en los tres formatos y en viewport móvil/escritorio; no se exige acceso directo a impresora ni corte automático.
- Pruebas unitarias/de integración de composición, autorización y casos financieros diseñadas y añadidas; ejecutar en la fase final conforme a la regla de tests.

### Dependencias y decisiones por confirmar durante el diseño técnico

- Confirmar contrato exacto de `SaleDetailSnapshot`, incluida la obtención de abono inicial/saldo para créditos vinculados.
- Confirmar acceso actual al nombre del workspace desde el historial/detalle; por ahora es el único dato de negocio identificado para encabezado.
- Determinar mecanismo de PDF compatible con el stack existente y navegadores objetivo, sin añadir dependencia salvo justificarla.
- Validar tratamiento de venta eliminada y los detalles de fecha civil/zona horaria en la representación.
- Precisar dimensiones/márgenes de carta y comportamiento del botón imprimir en PWA móvil durante implementación.

### Fuera de alcance por ahora

- Impresión silenciosa, comandos ESC/POS, conexión Bluetooth/USB directa o agente local.
- Numeración fiscal/legal, impuestos no modelados, factura electrónica, QR fiscal o integración con autoridad tributaria.
- Perfil editable del negocio (dirección, teléfono, logo); podrá añadirse como requerimiento de ronda aparte.
- Reimpresión con marca de copia, correo/WhatsApp o almacenamiento permanente de PDFs.

### Estado de implementación (2026-11-06)

- `jspdf` agregado; PDFs generados para 58 mm, 80 mm y carta.
- Acceso de comprobante en cierre de venta e historial; descarga e impresión funcionales en la prueba disponible.
- Vista previa en iframe HTML con ancho del formato; TypeScript, Prettier y pruebas de PDF/formulario pasaron en el entorno.
- El 2026-11-06 se corrigió la sincronización del modal al cambiar entre ventas: la venta cargada y la vista previa ahora se asocian al ID de venta, evitando un reset de estado por efecto. Commit local `e8971b7`.
- Pendiente: cierre UX verificado por fundador; suite que depende de MongoMemory falla al iniciar Mongod en este entorno; `next build` bloqueado por fetch de Google Fonts; prueba física en impresoras.
- RP-01 no se declara cerrado hasta resolver la verificación de la interfaz del cierre, el acceso de historial diferenciado y la validación visual/impresión. El estado actual del checkout incluye el arreglo del modal indicado arriba; no implica que los pendientes de verificación estén resueltos.

---

## RP-02 — Reportes descargables para lectura y seguimiento

**Origen/fecha:** solicitud del fundador, 2026-11-06.  
**Estado:** planificación por fases.  
**Prioridad:** P1.  
**Necesidad:** permitir guardar, compartir y consultar fuera de TwinCap los datos ya resumidos en el dashboard y reportes operativos que actualmente no explican sus totales.

### Revisión previa y mejoras incorporadas

- Dashboard tiene tres scopes: **Todo**, **Personal** y **Negocio**; filtros de período mensual/anual y, según scope, cuenta/categoría. Negocio usa rango civil propio. El PDF debe reflejar exactamente la vista y filtros activos e indicar su período.
- Los datos financieros pueden tener más de una moneda. Todo resumen/listado debe agrupar subtotales por moneda; queda prohibido totalizar COP, USD, MXN, EUR o BRL juntos.
- Ventas ya ofrece CSV con columnas de total, pagado y pendiente, pero no cierra con totales del período. El resumen faltante debe computarse desde las ventas filtradas; venta=resultado económico y abono=recuperación/cobro, sin sumar abonos como nuevas ventas.
- Movimientos ya cuenta con exportación CSV con filtros. No duplicar su exportador; mejorar a PDF podría evaluarse luego solo si los usuarios necesitan un formato imprimible.
- Los costos faltantes de inventario se deben identificar como desconocidos; no inventar valor de existencias o rentabilidad.
- Agregar fecha de generación, intervalo civil, scope, filtros relevantes y moneda a cada reporte; títulos como “Reporte de TwinCap”, nunca factura o estado fiscal.
- El PDF generado debe usar datos del servidor del workspace actual; no confiar en cifras manipulables enviadas por el cliente. Los filtros pueden viajar desde UI, pero se validan y aplican en backend.

### Plan por fases

#### Fase 0 — Contratos de reporte y criterios comunes

- Definir modelo común de metadatos: título, workspace, fecha de generación, intervalo civil, scope/filtros, locale y advertencias de datos incompletos.
- Reutilizar el patrón de generación PDF incorporado en RP-01; justificar si se necesita una capa distinta para documentos multipágina.
- Confirmar comportamiento cuando el reporte no contiene datos, tiene muchas filas o incluye varias monedas.
- Criterio de salida: especificación de datos/cálculos y diseño responsive de entrada/descarga acordados antes de código.

#### Fase 1 — Totalización del reporte de ventas (CSV primero)

**Estado:** implementada localmente; verificación enfocada aprobada (2026-11-06).

- Mantener filtros actuales: rango de fechas, estado y búsqueda de cliente; asegurar que la consulta y la exportación usan el mismo conjunto filtrado.
- Añadir resumen: cantidad de ventas, ventas brutas por moneda, cobrado por moneda, pendiente por moneda. Mostrar claramente “ventas” separado de “cobros”.
- Incluir el bloque de totales al final del CSV existente y mostrarlo también en la página, coherente con filtros.
- Para varias monedas, una línea/bloque por moneda; no presentar total global convertido.
- Criterios: fechas civiles inclusivas; sin abonos duplicando ventas; ventas a crédito con cobrado/pending correctos; filtros coinciden entre lista, resumen y exportación; dataset vacío devuelve ceros/estado vacío explícito.

**Implementación y evidencia:** la lista ahora aplica el mismo filtro puro que la exportación y presenta cuenta de ventas y totales vendido/cobrado/pendiente agrupados por moneda. El CSV incluye el mismo resumen al final. Los créditos enlazados usan el saldo del crédito como fuente de verdad. `tsc --noEmit`, Prettier y `export-csv.test.ts` (14/14) pasan; la suite completa diferida queda para el cierre RP-02.

#### Fase 2 — PDF del reporte de ventas

**Estado:** implementada localmente; verificación enfocada aprobada (2026-11-06).

- Agregar descarga PDF desde Ventas reutilizando los mismos filtros y datos de la Fase 1.
- Incluir resumen totalizado, detalle de ventas y medios/estado de pago pertinentes, paginación y fecha de generación.
- En filtros activos, imprimirlos en el encabezado; mantener la descarga usable en móvil.
- Criterios: valores exactamente iguales a CSV/lista para mismo filtro, agrupación por moneda, texto bilingüe, paginación sin filas partidas/recortadas.

**Implementación y evidencia:** descarga PDF multipágina desde Ventas con filtros del reporte y los mismos totales/monedas que CSV. Los nombres históricos de artículo se priorizan sobre el catálogo. `tsc --noEmit`, Prettier y suites `export-csv` + `sales-report-pdf` pasan (15/15). Queda verificación visual del layout con listas largas.

#### Fase 3 — PDF del resumen del dashboard (los tres scopes)

**Estado:** implementación local; chequeo de tipos aprobado (2026-11-06). La verificación visual y las pruebas enfocadas se acumulan para la Fase 6.

- Agregar “Descargar PDF” en Dashboard.
- Exportar el scope activo: Todo, Personal o Negocio. Todo respeta filtros existentes; Personal/Negocio respetan clasificación y exclusiones actuales.
- Incluir período mes/año o rango del tab Negocio, fecha, métricas visibles de resultado/flujo/posición, desglose por moneda, tablas/categorías y notas financieras relevantes.
- No incluir bloques que no aparecen en el scope o que el producto ya oculta por diseño. Distinguir saldo disponible/posición de resultado económico.
- Criterios: comprobar que el PDF coincide con la pantalla para cada scope y filtro; movimientos de sistema/legacy excluidos siguen excluidos; no mezclar monedas; rango de Negocio usa fecha civil inclusiva.

**Implementación:** botón de descarga en el encabezado del dashboard y PDF multipágina basado en el snapshot agregado por servidor con filtros activos. Incluye scope, período, filtros legibles, métricas y tablas de categorías por moneda; posición solo en Todo; métricas de negocio para su rango civil consultadas desde el endpoint autenticado existente. No suma monedas entre sí. `tsc --noEmit` pasó; Prettier aplicado. Suites enfocadas y revisión visual quedan pendientes para la verificación integrada.

#### Fase 4 — Estado de cuenta del cliente

**Estado:** implementación local; chequeo de tipos aprobado (2026-11-06). Pruebas enfocadas y revisión visual pendientes para la Fase 6.

- Añadir descarga desde el perfil/historial de cliente: período configurable, ventas, pagos/abonos y saldo actual por venta.
- Usar las mismas fuentes de verdad de ventas y crédito enlazado; identificar ventas borradas/anuladas según la política existente, sin revivirlas en totales.
- Contenido compartible, con datos mínimos necesarios; no filtrar información de otros clientes/workspaces.
- Criterios: saldo y abonos concilian con las pantallas de venta/créditos; cliente sin actividad; pagos parciales; varias monedas separadas; autorización cross-workspace.

**Implementación:** el perfil del cliente ofrece fechas civiles opcionales y genera el PDF con todas las ventas activas del cliente en ese intervalo, no solo la página visible. Un endpoint autenticado verifica el cliente dentro del workspace, pagina la lectura completa y toma el saldo actual del crédito vinculado como fuente de verdad; cada venta incluye sus abonos y saldo pendiente actual. Los totales permanecen separados por moneda.

#### Fase 5 — Reporte de inventario

**Estado:** implementación local; chequeo de tipos aprobado (2026-11-06). Pruebas enfocadas y revisión visual pendientes para la Fase 6.

- Añadir reporte descargable de existencias actuales con artículo, unidad, stock, umbral/alerta si existe y última actualización disponible.
- Valoración solo si cada dato necesario tiene costo rastreado confiable; si hay faltantes, señalarlos y dejar el valor como incompleto, nunca asumir costo cero.
- Criterios: respeta productos/servicios/insumos que correspondan al inventario actual, unidades y combos/preparados según modelo existente; reconcile cantidades con el catálogo; sin compras ni historial de proveedores.

**Implementación:** botón PDF desde el catálogo con productos y existencias actuales, disponibilidad derivada de combos, unidades localizadas y valores conocidos agrupados por moneda. Existencias sin costo confiable y combos con valor desconocido se marcan como incompletos; los servicios quedan fuera del inventario físico. El modelo no expone umbral de alerta ni fecha de última actualización, por lo que esos datos no se inventan.

#### Fase 6 — Verificación integrada y cierre

- Diseñar suites enfocadas y pruebas de permisos, moneda, rangos civiles, consistencia de totales CSV↔PDF y layout multipágina.
- Ejecutar primero suites enfocadas y luego `pnpm test` completo (timeout reglamentario ≥45 min), `tsc --noEmit`, lint, Prettier y build según reglas del proyecto.
- Revisión visual en móvil (375), tablet (768), desktop (1280); revisar PDFs y abrir/impresión desde navegador.
- Documentar límites de vista previa/impresión por navegador y no declarar PASS a pruebas no ejecutadas.

### Fuera de alcance inicial de RP-02

- Exportar estado contable oficial, declaración de impuestos, facturación electrónica, conciliación bancaria, conversiones FX o rentabilidad completa basada en costos ausentes.
- Rehacer el CSV de movimientos que ya existe; una mejora PDF de movimientos queda para evidencia de necesidad.
- Exportación automática programada, correo/WhatsApp o almacenamiento externo.

### Dependencias entre fases

1. Fase 0 fija contratos comunes.
2. Fases 1 y 2 son dependientes y preceden al PDF del dashboard para validar totales monetarios.
3. Fase 3 reutiliza arquitectura PDF y reglas de filtros/scope.
4. Fases 4–5 son reportes independientes, pero consumen la capa común de presentación y reglas de seguridad/moneda.
5. Fase 6 cierra el conjunto completo una vez implementado todo el alcance incluido.

### Requerimientos futuros sugeridos para evaluar, no incluidos aún

- Descarga de reporte de movimientos en PDF, si los usuarios requieren una hoja imprimible además del CSV existente.
- Preferencias de encabezado de negocio (nombre, contacto, logo), aplicables a tickets y reportes; conviene tratarlo como configuración única compartida en una fase propia.
- Reporte de pagos vencidos/antigüedad de cartera y cuentas por pagar, si usuarios beta lo solicitan; requiere definir intervalos y reglas de vencimiento antes de reportar.

---

## Plantilla para requerimientos nuevos

Duplicar para cada nuevo pedido:

```md
## RP-XX — Título

**Origen/fecha:**  
**Estado:** recibido / análisis / planificado / autorizado / en curso / verificado / cerrado  
**Prioridad:** P0–P3

### Necesidad y resultado esperado

### Alcance propuesto

### Criterios de aceptación

### Dependencias y decisiones

### Fuera de alcance
```

## Bitácora

- 2026-11-06: se crea la ronda acumulativa con RP-01 a partir del requerimiento de comprobantes PDF/térmicos.
- 2026-11-06: fundador solicita incorporar reportes descargables; se revisan exports existentes, scopes del dashboard, reglas multimoneda, ventas/créditos e inventario. Se agrega RP-02 por fases con ventas totalizadas como primera entrega y dashboard/cliente/inventario en fases siguientes.
