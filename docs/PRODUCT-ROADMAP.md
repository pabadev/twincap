# Dirección comercial y roadmap de producto de TwinCap

> **Registro de sesión: 2026-11-02.** Consolida la conversación sobre segmentos, precios, captura por voz, comprobantes para negocios y facturación electrónica. Es una dirección de producto y una lista de pendientes; no declara funciones implementadas ni autoriza por sí sola iniciar una fase de código.

## 1. Principio de producto

TwinCap debe ayudar a las personas a entender qué ocurre con su dinero sin exigirles conocimientos contables o tributarios para registrar operaciones cotidianas. La sencillez debe protegerse mientras el producto amplía capacidades para freelancers, pequeños comerciantes, negocios con POS y propietarios de varios negocios.

El cierre de la ronda pre-beta documenta preparación técnica y calidad para abrir una beta. No significa que el producto haya terminado de evolucionar ni que nuevas capacidades sean innecesarias para competir. La beta debe validar el mercado, las prioridades y la retención; no se usará la respuesta hipotética «yo pagaría» como prueba suficiente de disposición a pagar.

## 2. Segmentos prioritarios

| Segmento                                  | Necesidad principal                                                                          | Encaje inicial de TwinCap                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Persona que quiere organizar sus finanzas | Registrar ingresos, gastos, cuentas, deudas y transferencias con claridad                    | Plan gratuito de uso personal, sin empujar una suscripción a quien no necesita funciones de negocio |
| Freelancer o profesional independiente    | Separar finanzas personales y del trabajo, controlar pagos, obligaciones y clientes          | Gratis para empezar; Básico cuando necesite más capacidad, historial, análisis y captura por voz    |
| Tendero o pequeño comerciante             | Registrar ventas y gastos, controlar inventario y fiado, entender cuánto dinero entra y sale | Básico con POS e inventario sencillos, captura rápida y comprobante operativo                       |
| Negocio formal que requiere factura DIAN  | Emitir documentos tributarios y conectar ventas con la operación                             | Segmento potencial sujeto a validar el costo de complejidad fiscal, soporte y proveedor             |
| Equipo pequeño o dueño de varios negocios | Delegar operaciones y revisar negocios desde una vista consolidada                           | Pro futuro, condicionado a roles, usuarios y workspaces múltiples                                   |

## 3. Hipótesis inicial de planes y precios

Precios orientativos en COP por workspace/negocio; no son precios aprobados para publicar. Los límites de productos, clientes e historial son hipótesis para probar y deberán ajustarse a uso y costo reales.

| Plan       |                   Precio hipótesis | Perfil/capacidad                                           | Acceso propuesto                                                                                                                                                                                                                                                    |
| ---------- | ---------------------------------: | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gratis** |                             **$0** | 1 usuario, 1 workspace                                     | Todos los módulos disponibles a escala inicial; hasta 50 productos activos y 25 clientes como límites de escala; resumen y analítica con ventana corta. No limitar movimientos, ventas, abonos ni deudas: conservar registro continuo y acceso a los datos propios. |
| **Básico** | **$29.900/mes** o **$299.000/año** | 1 usuario, 1 negocio                                       | Más capacidad de catálogo y clientes, analítica con más historial, exportaciones, comprobante PDF y una cuota de captura por voz.                                                                                                                                   |
| **Pro**    | **$69.900/mes** o **$699.000/año** | Hipótesis futura: hasta 3 usuarios y 2 negocios/workspaces | Roles, gestión de equipo, vista consolidada y mayor cuota de voz. Como precio de expansión por probar: $9.900/usuario adicional y $14.900/workspace adicional.                                                                                                      |

Los montos anuales equivalen aproximadamente a dos meses sin cobro respecto al mensual. No ofrecer prepago anual como opción principal hasta validar retención y soporte. El plan Pro depende de capacidades que todavía no existen en la beta: billing, multiusuario, roles y workspaces múltiples.

### Referencias de mercado consultadas

Precios públicos consultados el 2026-11-02; pueden cambiar y las ofertas no son equivalentes funcionalmente:

- **Treinta:** su oferta para minimercados muestra Gratis y Básico de $34.900/mes; la oferta general muestra Esencial de $39.900 y Pro de $79.900/mes. El plan gratuito de minimercados limita estadísticas, reportes, clientes y proveedores. [Minimercados](https://www.treinta.co/software-para-minimercados/) · [Planes generales](https://treinta.co/).
- **Alegra Colombia:** publica facturación desde $17.900/mes, POS desde $25.900/mes y planes de contabilidad que empiezan en $74.900/mes. Incluye capacidades fiscales/contables que TwinCap no debe insinuar que ya ofrece. [Planes de Alegra](https://alegra.com/colombia/precios/).
- **Siigo POS:** publica Esencial a $28.750/mes equivalente con pago anual de $345.000 y 240 facturas POS al año; los planes superiores cambian límites y precio. [Planes de Siigo](https://www.siigo.com/precios-siigo/).
- **Loyverse:** ofrece POS base gratis y complementos de pago para historial ilimitado, gestión de empleados e inventario avanzado, con precio por tienda en USD. Es referencia de empaquetado freemium, no comparación directa de precio colombiano. [Precios de Loyverse](https://loyverse.com/pricing).
- **Wallet:** combina registro personal manual gratuito con Premium para automatización y otras funciones. Refuerza que el usuario de finanzas personales puede permanecer gratis si no recibe un motivo claro para pagar. [Wallet](https://budgetbakers.com/es/products/wallet/).

Las referencias sugieren probar Básico alrededor de $29.900/mes y Pro alrededor de $69.900/mes; no demuestran que el usuario vaya a pagar esos precios por TwinCap. La ausencia de facturación DIAN, nómina o sincronización bancaria debe considerarse al posicionar y no compararse como equivalencia con suites contables.

## 4. Cómo validar precio

1. Usar entrevistas para descubrir tareas, problemas y alternativas actuales; no para aceptar respuestas hipotéticas de precio como evidencia de compra.
2. Probar ofertas transparentes con prospectos calificados fuera de la beta. Para Básico, explorar precios reales cercanos a $24.900 y $34.900/mes; para Pro, hacerlo solo cuando equipos/workspaces estén disponibles.
3. Medir conversiones a pago, retención pagada a 60–90 días, cancelaciones, uso por segmento y costo de soporte. Una beta de 10–20 personas ofrece señales direccionales, no una estimación de mercado robusta.
4. No usar pantallas de cobro falsas ni ofrecer a usuarios una capacidad aún no construida. Registrar primero qué segmento abandona por falta de una función concreta.

## 5. Roadmap de capacidades nuevas

Las iniciativas siguientes están pendientes de discovery, diseño y priorización, salvo el
alcance técnico inicial de RP-03, cuya implementación autorizó el fundador el 2026-11-07.
Documentarlas no significa que deban implementarse todas ni que deban entrar en la beta
actual; las fases posteriores de RP-03 requieren sus propios criterios y priorización.

### P0 — Captura de operaciones por voz

- Nueva opción en el FAB que abre un modal prellenado con la operación entendida: ingreso, egreso, transferencia y otros flujos básicos definidos en discovery.
- Evaluar transcripción y una versión ligera de GPT para estructurar la intención y los campos; no permitir que el modelo escriba directamente en la base de datos.
- El usuario revisa y confirma antes de guardar. Si faltan datos o hay ambigüedad, el modal pregunta; nunca inventa cuenta, importe, moneda o fecha.
- Respetar reglas financieras existentes: la cuenta determina la moneda en formularios de una cuenta; transferencias conservan monedas de origen/destino; contexto y fecha de negocio deben preservarse explícitamente.
- Definir manejo de audio/texto, consentimiento, retención, privacidad, precisión, latencia, idiomas, errores y costo por captura aceptada antes de fijar cuotas del plan de pago.
- **Empaquetado hipótesis:** disponible en Básico con cuota mensual; Pro con una cuota mayor o uso razonable. Confirmar costo real antes de publicar el límite.

### P0 — Comprobantes operativos de venta

- PDF descargable/imprimible para la venta y evaluación de impresión en impresoras térmicas comunes.
- El comprobante operativo debe diferenciarse claramente de una factura electrónica; no llamarlo ni presentarlo como documento fiscal si no cumple ese propósito.
- Validar dispositivos, tamaños de papel, conexión y flujo de reimpresión con tenderos reales antes de comprometer compatibilidad amplia.
- **Empaquetado hipótesis:** PDF en Básico; impresión térmica en los planes de Negocio, sujeto a validación de uso y soporte.

**Estado de implementación (2026-11-06):** el requerimiento está en curso como RP-01 en `docs/odd/tasks/post-beta-product-round.md`. La generación PDF y las acciones de vista previa/descarga/impresión ya tienen implementación local parcial; faltan validación UX, revisión visual y validación en impresoras. Este estado no convierte la hipótesis de empaquetado en una decisión aprobada.

### P1 — Discovery de facturación electrónica DIAN

- Medir cuántos negocios objetivo consideran la factura electrónica un requisito para empezar o continuar; identificar segmento, obligación operativa y alternativa actual.
- Evaluar Factus y otros proveedores por API, precios por documento, ambiente de pruebas, disponibilidad, soporte, estados/rechazos, notas y anulaciones, portabilidad, tratamiento de datos y claridad de configuración fiscal.
- Validar el diseño con un especialista tributario antes de definir campos o defaults. La integración técnica de un proveedor no sustituye la responsabilidad del facturador por el contenido.
- Mantener la facturación como modo/módulo opcional de negocio mientras la necesidad no sea universal. Si la evidencia muestra que bloquea el segmento principal, reevaluar prioridad estratégica.

### P1 — Capa fiscal opcional, solo si se aprueba facturación

- Conservar simples los formularios actuales de inventario cuando la facturación esté desactivada.
- Mantener separadas las categorías fiscales de producto de las categorías actuales de movimientos y del `productRole` de inventario.
- Diseñar configuración fiscal del emisor y correspondencia de productos; solo pedir al usuario lo que no pueda resolver con seguridad el proveedor o una configuración revisada.
- Marcar explícitamente los productos pendientes de clasificar; no inferir tarifas tributarias desde nombre, descripción o voz ni aplicar defaults fiscales silenciosos.
- Guardar un snapshot fiscal inmutable en cada línea/documento emitido para que cambios posteriores del catálogo no alteren facturas históricas.
- Diseñar buyer data, numeración/configuración, estados de validación, rechazo y reintentos con el proveedor; verificar el alcance exacto de impuestos y retenciones con asesoría especializada.
- Evitar duplicar ventas, ingresos, movimientos, inventario o cobros al sincronizar factura y POS. La factura es un documento fiscal enlazado a la operación, no un segundo ingreso.

### P2 — Pro, equipos y varios negocios

- Diseñar Membership, invitaciones, roles y permisos por workspace; hoy no hay selector de workspaces ni equipos activos para la beta.
- Diseñar el modelo de propietario con varios workspaces y lectura consolidada sin mezclar ni romper aislamiento de datos.
- Añadir billing, entitlements, límites y manejo de impago/cancelación solo con capacidades y precios aprobados.
- Diseñar e implementar por fases la conexión de agentes IA mediante un servidor MCP remoto compartido por proveedores compatibles. El diseño inicial (RP-03) cubre Claude, ChatGPT/OpenAI, ámbitos Personal/Negocio, OAuth, autorización y consulta de solo lectura; la disponibilidad comercial, el modelo final de roles y las escrituras quedan sujetos a discovery y aprobación por fase. Ver `docs/AI-MCP-ARCHITECTURE.md`.

## 6. Guardrails de producto

- No degradar el registro financiero esencial por límites de plan; preservar los datos y permitir su consulta/exportación.
- No convertir un ticket operativo en una promesa de cumplimiento DIAN.
- No obligar al usuario personal o al comerciante que no factura a configurar IVA/retenciones.
- No delegar decisiones financieras o fiscales a GPT; el modelo propone campos, el usuario confirma y el servidor valida.
- Respetar aislamiento por `workspaceId`, auditoría, idempotencia, semántica financiera e i18n existente en cualquier integración.
- La beta pre-lanzamiento y la validación comercial son hitos diferentes: ninguna de estas iniciativas se considera disponible hasta estar implementada, verificada y comunicada con precisión.
