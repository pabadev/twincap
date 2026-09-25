# Propuesta de producto: facturación electrónica opcional

**Estado:** oportunidad identificada; pendiente de validación comercial y técnica.  
**Fecha:** 2026-09-25  
**Proveedor considerado:** Factus (Colombia)  
**Decisión de implementación:** no aprobada ni iniciada. Este documento conserva la propuesta y define cómo evaluarla.

## 1. Resumen

Evaluar la integración de TwinCap con un proveedor autorizado de facturación electrónica, comenzando por Factus, para que pequeños negocios puedan emitir facturas electrónicas desde las ventas registradas en el POS.

La facturación sería una capacidad opcional que complementa el propósito de TwinCap: ayudar a entender y administrar las finanzas personales y del pequeño negocio. No busca convertir TwinCap en un ERP, un sistema de inventario avanzado ni un sistema contable completo.

La oportunidad merece validación porque la falta de facturación electrónica puede hacer que algunos negocios potenciales descarten TwinCap aunque les resulte útil para registrar ventas, cobros y obligaciones. La integración podría reducir esa objeción y conservar una experiencia sencilla.

## 2. Problema y oportunidad

TwinCap ya cubre parte del flujo cotidiano de un negocio pequeño: registrar ventas, artículos y servicios, pagos de contado y ventas a crédito, y reflejar el efecto financiero de esas operaciones. Hay usuarios que además necesitan emitir una factura electrónica válida para su cliente.

Si deben salir de TwinCap para facturar, duplicar los datos y luego volver a registrar la venta o el cobro, se introduce fricción y riesgo de inconsistencias. Integrar un proveedor podría unir el registro operativo y financiero con la emisión del documento, sin que TwinCap tenga que desarrollar directamente la transmisión fiscal ante la DIAN.

La necesidad por sí sola no demuestra demanda suficiente. Debe medirse cuántos usuarios potenciales rechazan la propuesta específicamente por esa carencia y si usarían la función con la configuración y el costo que implica.

## 3. Encaje con TwinCap y Factus

El POS de TwinCap ya trabaja con líneas de venta que guardan una referencia de catálogo, cantidad y precio unitario, además de permitir pago de contado o a crédito y asociar un cliente. El catálogo distingue productos de servicios, por lo que conceptos como mantenimiento o reparación pueden representarse como servicios.

Factus documenta endpoints para crear y validar facturas, consultarlas y descargar PDF y XML. Su API recibe datos generales, información del cliente y líneas de productos o servicios con datos fiscales. También documenta facturas a crédito, notas crédito y un ejemplo de factura con orden de servicio.

Referencias técnicas consultadas:

- [Introducción a Factus API](https://developers.factus.com.co/)
- [Crear y validar facturas](https://developers.factus.com.co/facturas/crear-y-validar/)
- [Campos de la factura](https://developers.factus.com.co/facturas/descripcion-de-campos/)
- [Ejemplo de factura con orden de servicio](https://developers.factus.com.co/facturas/ejemplos/estandar-orden-servicio/)
- [Autenticación y tokens](https://developers.factus.com.co/autenticacion/auth/)
- [Crear y validar notas crédito](https://developers.factus.com.co/notas-credito/crear-y-validar/)

La documentación confirma viabilidad a nivel de API; no confirma por sí sola las condiciones comerciales para que TwinCap opere como plataforma integradora para múltiples negocios. Esto debe verificarse directamente con Factus.

## 4. Brechas que TwinCap tendría que resolver

### 4.1. Perfil fiscal del emisor

Antes de emitir, el negocio debe completar y validar la información que requieran Factus y la DIAN: identificación, razón social o nombre, responsabilidades fiscales, dirección, municipio, datos del establecimiento, autorización y rango de numeración, entre otros datos que resulten aplicables.

Debe confirmarse qué configuración realiza el usuario directamente en Factus y qué información puede administrar TwinCap a través de la API.

### 4.2. Datos fiscales del cliente

El registro actual de cliente de TwinCap no contempla todos los datos que puede requerir una factura. La experiencia tendría que recoger, según el tipo de cliente, tipo y número de documento, nombre o razón social y los datos de contacto y ubicación aplicables. Se puede evaluar la consulta de adquirientes de Factus como ayuda para completar información, sin tratarla como sustituto de la revisión del usuario.

### 4.3. Datos fiscales de productos y servicios

El catálogo actual contiene nombre, tipo y precio, pero la emisión puede requerir código de referencia, unidad de medida, precio neto, estándar y tratamiento tributario por línea, entre otros. TwinCap no debe inferir una tarifa o responsabilidad tributaria a partir del nombre del artículo ni asumir que todos los productos o servicios tienen el mismo tratamiento.

La configuración debe ser comprensible para pequeños negocios y permitir los casos aplicables sin exponer innecesariamente toda la complejidad fiscal de la API. La clasificación fiscal correcta debe quedar a cargo del negocio, con orientación de Factus o de su asesor cuando corresponda.

### 4.4. Instantánea y consistencia histórica

La factura debe conservar una instantánea de los datos de emisión usados en ese momento: emisor, cliente, conceptos, cantidades, precios, impuestos y totales. Cambios posteriores en el cliente o en el catálogo no deben alterar la representación de una factura emitida.

La venta, el pago y la factura son registros relacionados, pero representan hechos distintos. Emitir una factura no significa que ya se recibió el dinero. La integración debe conservar los principios financieros existentes de TwinCap, incluyendo las ventas a crédito y sus abonos.

### 4.5. Estados, errores y correcciones

TwinCap necesita mostrar estados claros, por ejemplo pendiente de emisión, en proceso, emitida y rechazada, junto con la explicación útil del error y una acción segura de recuperación. Debe registrar los identificadores y resultados devueltos por Factus y permitir consultar o descargar los documentos.

Los reintentos requieren una referencia única y persistente para impedir duplicados. Los errores de red no deben revertir una venta ya registrada ni su cobro. Una factura validada tampoco debe poder corregirse borrando sin más la venta asociada: las anulaciones o ajustes deben seguir el procedimiento fiscal soportado, como una nota crédito cuando aplique.

## 5. Alcance inicial sugerido

Si la oportunidad supera la validación, iniciar con un alcance deliberadamente limitado:

1. Un negocio emisor por espacio de trabajo durante la beta actual.
2. Factura de venta estándar para una venta POS ya registrada, incluidos productos y servicios.
3. Cliente consumidor final y cliente identificado, sujetos a los casos y requisitos que Factus confirme.
4. Emisión explícita por parte del usuario, sin bloquear la creación de ventas si Factus no responde.
5. Visualización del estado, número e identificador fiscal, y acceso a PDF/XML.
6. Reintento seguro ante errores transitorios y guía para corregir rechazos de datos.
7. Facturas de contado y a crédito, dejando clara la diferencia entre obligación facturada y pagos recibidos.
8. Flujo mínimo de notas crédito para los casos de corrección/anulación que se decidan soportar antes de producción.

Quedarían fuera del primer alcance, salvo que la validación demuestre que son imprescindibles: nómina electrónica, documentos soporte, compras, contabilidad completa, inventario avanzado, múltiples proveedores de facturación y automatizaciones fiscales complejas.

## 6. Validaciones previas a cualquier desarrollo

### Validación con Factus

Solicitar confirmación escrita sobre:

- Uso de la API en un SaaS integrador con varios negocios emisores y NIT/configuración independiente por espacio de trabajo.
- Modelo de autenticación recomendado para este caso y custodia de credenciales por emisor.
- Proceso de alta, habilitación, rangos de numeración y paso de sandbox a producción.
- Tarifas por documentos, paquetes, suscripciones, ambiente de pruebas y costos de soporte.
- Límites de uso, disponibilidad, tiempos de respuesta y canales de soporte.
- Políticas sobre reintentos, referencias duplicadas, documentos pendientes, notas crédito y acceso a PDF/XML.
- Responsabilidades contractuales de Factus y de TwinCap como integrador, y restricciones de marca o comercialización.

### Validación de demanda

Entrevistar usuarios potenciales de servicios técnicos, comercios pequeños y negocios de una sola persona. Medir específicamente:

- Si necesitan emitir factura electrónica y con qué frecuencia.
- Si esa carencia les impediría contratar o usar TwinCap.
- Qué proveedor utilizan hoy y qué les molesta del flujo actual.
- Si aceptarían completar la configuración fiscal en TwinCap y quién les ayuda a clasificar impuestos.
- Qué valor le atribuyen a emitir desde el POS y recibir el PDF/XML asociado a la venta.
- Qué costo adicional considerarían razonable y cómo esperan que se cobre el documento.

## 7. Prueba técnica propuesta

Solo después de confirmar acceso y condiciones adecuadas con Factus, realizar una prueba en sandbox con un emisor de prueba y una venta representativa de servicio. La prueba debe cubrir:

- Autenticación y renovación de tokens desde el servidor.
- Construcción de factura de servicio con los datos requeridos.
- Respuesta aceptada y recuperación de identificadores.
- Descarga o consulta de PDF/XML.
- Rechazo por datos incompletos y presentación clara del motivo.
- Reintento con la misma referencia sin generar una factura duplicada.
- Venta a crédito y separación entre factura emitida y pagos recibidos.
- Nota crédito en el escenario definido para la prueba.

El resultado sería una recomendación de producto y un estimado de implementación; no habilitaría producción por sí mismo.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación propuesta |
| --- | --- |
| Complejidad fiscal reduce la sencillez de TwinCap | Solicitar datos avanzados durante la configuración fiscal o al emitir, con valores predeterminados solo cuando sean legales y confirmados por el usuario. |
| Error tributario en datos de catálogo | No inferir impuestos; hacer explícita la clasificación y señalar que debe confirmarla el negocio. |
| Duplicación de facturas por reintentos | Referencia idempotente por operación, persistencia de estado y consulta antes de repetir emisiones inciertas. |
| Caída de Factus interrumpe el POS | Registrar la venta independientemente y emitir mediante una operación recuperable; comunicar claramente el estado pendiente. |
| Descuadre entre venta, factura y cobro | Mantenerlos como hechos distintos y guardar instantáneas y totales reconciliables. |
| Exposición de credenciales fiscales | Llamadas exclusivamente desde backend, secretos protegidos por emisor, controles de acceso y auditoría. |
| Dependencia de un único proveedor | Aislar Factus detrás de un puerto/adaptador de infraestructura para que el dominio y POS no dependan del formato de su API. |
| Costos o términos inviables para un SaaS | Confirmar costos por documento, modalidad de integrador, soporte y posibilidad de trasladar costos antes de invertir en UX y producción. |
| Corrección indebida de documento fiscal | Bloquear edición/borrado ordinarios tras emisión validada y dirigir al flujo fiscal autorizado. |

## 9. Criterios para decidir avanzar

Recomendar avanzar a un piloto solo si:

1. Factus confirma que el modelo multiemisor/integrador es permitido y técnicamente soportado.
2. Los costos y las condiciones permiten una oferta sostenible para TwinCap y sus usuarios.
3. Las entrevistas confirman que la ausencia de factura es una barrera real y frecuente para el segmento objetivo.
4. La prueba de sandbox cubre emisión, consulta, recuperación de errores, idempotencia y corrección.
5. El diseño puede preservar la simplicidad del flujo POS y la integridad financiera de TwinCap.

Si alguno de estos criterios no se cumple, mantener la propuesta documentada y comparar otros proveedores o posponerla sin incorporarla como promesa comercial.

## 10. Evaluación actual

**Recomendación:** sí vale la pena plantearla como oportunidad prioritaria de descubrimiento y validación. El encaje funcional es claro: TwinCap ya registra ventas de productos y servicios y Factus ofrece una API compatible con la emisión de esos conceptos. La integración podría reducir una objeción comercial real sin exigir que TwinCap construya el motor de transmisión fiscal.

**No se recomienda todavía** anunciar facturación electrónica como función disponible, comprometer una fecha de entrega ni comenzar una integración de producción. Faltan confirmar la modalidad comercial multiemisor, el costo, la demanda del segmento y el esfuerzo de completar datos fiscales y ciclo de vida de documentos.

## 11. Referencias internas

- Dominio de ventas: `src/core/domain/sale.ts`.
- Dominio de catálogo, con tipos producto/servicio: `src/core/domain/catalog.ts`.
- Reglas vigentes de arquitectura, tenant, integridad financiera y conexión con base de datos: `AGENTS.md` y `docs/PROJECT-RULES.md`.
