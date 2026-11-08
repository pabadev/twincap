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

| ID     | Requerimiento                                                  | Estado                                                                                     | Prioridad        |
| ------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| RP-01  | Comprobantes de venta PDF e impresión térmica desde historial  | En curso                                                                                   | P1               |
| RP-02  | Reportes descargables: resumen, ventas, clientes e inventario  | En curso                                                                                   | P1               |
| RP-03  | Conexión de agentes IA mediante MCP                            | Implementación local; colecciones/índices listos; falta prueba y habilitación              | P1 (provisional) |
| RP-04  | Asistente conversacional que prepara borradores financieros    | Spike Gemini listo en desarrollo; proveedor devolvió 503 al probar catálogo; retry acotado | P1 (provisional) |
| RP-05  | Actualización de la PWA instalada                              | Implementada localmente; push y validación en producción pendientes                        | P1               |
| RP-06+ | Reservado para requerimientos que se agreguen durante la ronda | Sin definir                                                                                | —                |

---

## RP-03 — Diseño base de conexión de agentes IA mediante MCP

**Origen/fecha:** solicitud del fundador, 2026-11-07.
**Estado:** implementación local del piloto OpenCode; colecciones/índices de producción listos; falta verificación completa, configuración de Vercel y despliegue aprobado.

**Prioridad:** P1 provisional; el empaquetado premium y la prioridad comercial siguen pendientes.
**Documento:** `docs/AI-MCP-ARCHITECTURE.md`.

### Alcance de la implementación inicial

**Implementación local (2026-11-07):** Authorization Server con login existente y
consentimiento con reautenticación reciente; CIMD de OpenCode verificado; Authorization
Code + PKCE S256 y callback loopback allowlisted; credenciales aleatorias guardadas como
hash, access tokens de 10 minutos, refresh rotatorio y revocación por grant; metadata OAuth
y Resource Server MCP stateless; tres herramientas Personal de solo lectura (resumen,
movimientos individuales y serie mensual); allowlist, límite por grant y revocación desde
Perfil. La funcionalidad está apagada por defecto. OpenCode solicita los scopes de resumen
y movimientos; la pantalla permite excluir movimientos y el servidor nunca concede scopes
no solicitados. TypeScript y Prettier verificados en la revisión actual; pruebas no
ejecutadas. La reconexión de OpenCode sigue pendiente.
Se incluyen scripts operativos para inicializar colecciones vacías e índices MCP, con
dry-run/lectura por defecto y `--apply` explícito. Por autorización del fundador se
crearon y verificaron las cuatro colecciones e índices en la base de producción; conteo
confirmado de documentos: cero en cada colección. La allowlist local usa el userId único
asociado a la cuenta administradora local, verificada en la base. MCP sigue apagado en
Vercel, el checkout no está enlazado al proyecto y OpenCode aún no se ha conectado. La
validación end-to-end y el despliegue quedan pendientes; revisar todos los criterios antes
de habilitar.

1. Endpoint remoto MCP stateless sobre Streamable HTTP en una Route Handler de Next.js/Vercel.
2. Separar OAuth Authorization Server (login, consentimiento, emisión y revocación de
   tokens) de MCP Resource Server (metadata y validación de bearer token). Pueden compartir
   despliegue al principio; no mezclar sus responsabilidades.
3. Autorización por persona, grant y ámbito. Comenzar con el usuario autenticado y su
   espacio Personal existente, solo lectura. No usar todavía la identidad de suscripción,
   no conceder scopes de escritura ni simular roles multiusuario que aún no están activos.
4. Exponer una herramienta financiera de lectura vertical y acotada que reutilice un caso
   de uso agregado existente; no acceso directo desde herramientas a repositorios.
5. Compatibilidad inicial a verificar con Claude, OpenCode y OpenAI; conservar transportes y OAuth
   desacoplados para clientes MCP compatibles adicionales.
6. Criterios de salida antes de pasar a Negocio/multiusuario: conexión OAuth de extremo a
   extremo; audience/issuer/PKCE/redirects validados; revocación efectiva; llamadas sin
   cookie web; pruebas cross-user, scopes, replay, límites y Vercel; datos y resultados
   coinciden con TwinCap y no se muta información financiera.

### Diseño técnico concreto para que el piloto OpenCode se pueda implementar

La arquitectura `docs/AI-MCP-ARCHITECTURE.md` es el contrato. Esta secuencia elimina las
ambigüedades de implementación sin cerrar las decisiones de producto abiertas:

1. **Authorization Server:** email/contraseña actual + sesión web identifica al usuario;
   consentimiento es reautenticado si la sesión tiene más de 10 minutos. Authorization
   Code + PKCE S256, `state` obligatorio, redirect URI validada y resource indicator.
   Login web no se convierte en OAuth.
2. **Cliente piloto:** CIMD exacto de OpenCode
   `https://opencode.ai/oauth/opencode/client.json`, catálogo TwinCap allowlisted, metadata
   HTTPS verificada y bounded (sin redirect, con timeout/límite, URL/host exactos). No DCR
   abierto ni client secrets para el cliente native público. Conservar callback loopback y
   permitir puerto dinámico solo con host/path exactos del documento nativo.
3. **Discovery:** Protected Resource Metadata RFC 9728 para `${APP_BASE_URL}/api/mcp` y
   Authorization Server Metadata RFC 8414 del issuer `${APP_BASE_URL}`. Publicar issuer,
   endpoints, scope, `authorization_code`, `refresh_token`, `S256`, cliente público y
   audience/recurso. `APP_BASE_URL` explícito; nunca derivarlo del request.
4. **Persistencia:** separar OAuth transaction temporal, grant durable por cada consentimiento
   y credential individual para code/access/refresh. Permitir varias concesiones del mismo
   cliente; no inferir dispositivo si el metadata CIMD no lo identifica. Persistir solo
   hashes SHA-256 de credenciales aleatorias; canje/rotación/replay/revocación con updates
   atómicos e índices. TTL para credenciales vencidas, no para el grant activo.
5. **Resource Server:** Route Handler Next `/api/mcp`, Node.js, Streamable HTTP stateless;
   sin cookie web, body/tiempo/rate bounded y validación de Host/Origin. Token opaco con
   introspección por llamada; validar resource/audience, expiry, actor, `sessionVersion`,
   grant y scope. Las APIs no usan el proxy; `connectDb()` ocurre en cada entrada DB antes
   de crear repos/modelos.
6. **Tool vertical:** `personal.get_financial_summary`, scope `personal.summary:read`,
   periodo month/year, no recibe identidad/workspace. Refactorizar el agregador existente
   del Resumen en un caso de uso compartido y emitir sólo datos planos/minor units por
   moneda. Nunca tocar escrituras ni leer repositorios desde el callback de protocolo.
7. **Superficie de usuario:** consentimiento con identidad verificada OpenCode, ámbito,
   datos que salen hacia el LLM, scope, expiración y revocación; sección Personal
   “Aplicaciones conectadas” para listar/revocar una conexión o revocarlas todas. Una
   sesión Go no otorga un scope TwinCap ni se comparte la clave Go.
8. **Operación inicial:** flag global fail-closed y allowlist de IDs de usuario para piloto;
   fuera del código/cliente, nunca por email. Primero entorno local con base de prueba y
   datos sintéticos; luego Vercel Preview solo tras acordar cómo evitar protección Vercel
   sin publicar secretos. No deploy prod en este requerimiento.

### Criterios de seguridad/interoperabilidad OpenCode

- OpenCode puede descubrir metadata, iniciar OAuth, abrir login/consent, volver al callback
  loopback, canjear code y llamar la herramienta con un bearer válido sin cookie.
- `opencode mcp list` conecta; refresh sucede correctamente; `opencode mcp logout`
  elimina credencial local; revocar desde TwinCap hace fallar la siguiente llamada aunque
  OpenCode conserve una copia de su token.
- Rechazar `client_id` desconocido, metadata malformada/redirigida, redirect URI alterada,
  port/path/host loopback no permitidos, recurso incorrecto, PKCE absent/plain/incorrecto,
  code duplicado/expirado, grant revocado, token expirado y replay de refresh.
- Sesión cookie sola no autentica `/api/mcp`; el bearer no funciona contra otra API/audience.
  Argumentos de herramienta con user/workspace/business IDs son rechazados o ignorados y
  jamás cambian al actor ni el tenant.
- Probar múltiples dispositivos OpenCode con grants separados, revocar uno sin cerrar el
  otro, “revocar todas”, cambio de contraseña/sessionVersion, cold start y Functions
  paralelas. La UI distingue grants por hora de concesión/último uso, no afirma conocer el
  nombre físico de cada equipo.
- Asegurar que prompts, token/API key Go, códigos, datos financieros y texto libre no
  aparezcan en logs, errors ni telemetry. El output de TwinCap puede quedar expuesto a
  retención del modelo según el cliente; advertirlo antes del consentimiento.

El diseño cubre las bases compartidas para clientes MCP como Claude, OpenCode y OpenAI: ámbitos
Personal y Negocio aislados, OAuth propio de TwinCap, autorización por
persona/negocio/capacidad, conector administrable sin heredar los permisos del dueño de
suscripción, herramientas iniciales de solo lectura, escrituras futuras mediante
propuesta y confirmación en TwinCap, auditoría, privacidad, Vercel serverless/stateless,
amenazas, fases, matriz de compatibilidad de proveedores y criterios previos a producción.
Se distinguen ChatGPT como cliente MCP y un agente propio usando la API de OpenAI; son
rutas con UX, disponibilidad y facturación diferentes.

OpenCode se incorpora además como cliente prioritario de prueba: el plan OpenCode Go/Go
Plus paga el uso de modelos dentro de OpenCode y no se comparte con TwinCap. La conexión
al MCP de TwinCap usa OAuth independiente y permisos revocables. La compatibilidad del
flujo real de registro de cliente, PKCE, refresh y revocación queda como criterio de la
fase técnica.

Quedan deliberadamente abiertos el actor que habilita el conector, roles/matriz final,
relación de suscripción y múltiples negocios, consentimiento e historial compartido,
entitlements/precio, límites, retención, clientes MCP soportados y alcance de escrituras.
Resolver discovery y priorización antes de ampliar más allá del alcance técnico inicial.

---

## RP-04 — Asistente conversacional que prepara borradores financieros

**Origen/fecha:** solicitud del fundador, 2026-11-08.
**Estado:** laboratorio local medido en Redmi 15 (sin rendimiento aceptable); spike Gemini server-side con frases y categorías sintéticas. La clave local está configurada; una llamada inicial funcionó antes de enviar catálogo y las posteriores recibieron HTTP 503. Se agregó un retry breve; comprobar clasificación cuando Gemini esté disponible.
**Prioridad:** P1 provisional.
**Documento:** `docs/AI-CONVERSATIONAL-ASSISTANT.md`.

### Objetivo

La persona describe una operación con lenguaje natural y TwinCap prepara el formulario
financiero existente para que ella lo revise, corrija y envíe. Esta experiencia in-app es
independiente de RP-03/MCP: el asistente no es un cliente MCP ni recibe herramientas de
escritura.

### Primera prueba propuesta

- La dirección de producto sigue siendo preparar un gasto Personal desde texto y abrir el
  formulario existente. Transformers.js se mantiene como referencia local; Gemini es ahora
  el proveedor remoto en evaluación, primero en el laboratorio de desarrollo.
- La salida del proveedor es una propuesta estructurada no confiable; solo puede contener
  tipo, importe decimal como texto, nota, fecha civil, sugerencia textual de categoría,
  datos faltantes y una aclaración. Nunca incluye identidad ni IDs financieros.
- Cuenta, moneda, contexto y categoría final se eligen/resuelven en TwinCap. Si el contexto
  no queda claro al inicio, permanece vacío y se marca pendiente; no se deduce de la frase,
  categoría o historial. La persona lo selecciona en el formulario. La cuenta determina la
  moneda según el principio financiero existente.
- Si la frase no incluye fecha, TwinCap propone la fecha civil de hoy; el proveedor solo ayuda
  a interpretar fechas explícitas. Una frase como “gasolina de la moto” puede sugerir la
  categoría “Moto”. El proveedor recibe de antemano las etiquetas de categorías permitidas
  (sin IDs); la sugerencia se valida contra las categorías disponibles del contexto elegido.
  El contexto permanece vacío si no está claro. El laboratorio remoto usa una lista sintética.
- La propuesta precarga el formulario actual; el guardado sigue exclusivamente por su
  Server Action y validaciones actuales, después de una acción explícita de la persona.
- Contrato V1 independiente del proveedor, port `IntentInterpreter` y adaptadores local y
  Gemini. El spike Gemini corre solo en desarrollo, acepta IDs de frases sintéticas
  predefinidas, valida la propuesta y no escribe operaciones. La clave nunca pasa al
  navegador; no habrá fallback remoto silencioso.
- En el nivel gratuito Google puede usar las solicitudes para mejorar sus productos; no se
  deben enviar datos financieros reales. Una primera llamada real se hizo solo con la frase
  sintética fija `expense-gas-10k`; falta ejecutar la matriz completa.
- No guardar el historial de conversación en el servidor durante el piloto.

### Orden de trabajo y gates

1. Spike con hasta dos modelos ONNX pequeños en Android real: descarga fría/caliente,
   caché, latencia, memoria, WebGPU/WASM, calidad de español y validez del contrato.
2. Fijar un set de frases con resultados esperados y umbrales de precisión/latencia antes
   de seleccionar un modelo. Si el dispositivo no alcanza los gates, mantener captura manual
   y no fingir que la inferencia ocurrió.
3. Implementar el flujo de gasto Personal con worker y carga diferida; conectar al formulario
   existente y nunca dar al modelo capacidad de mutación.
4. Revisar regresión financiera, seguridad, privacidad, accesibilidad y responsive en
   mobile/tablet/desktop antes de ampliar a ingresos u otros proveedores/intenciones.

### Evidencia local del spike (2026-11-08)

- Se añadió `@huggingface/transformers` 4.3.2 para el laboratorio de desarrollo `/ai-lab`;
  carga de pesos solo tras acción explícita, sin guardado financiero. El route devuelve 404
  fuera de desarrollo.
- Dos candidatos versionados: Qwen2.5-0.5B-Instruct q4f16 (~483 MB) y Qwen3-0.6B q4f16
  (~570 MB), además de runtime/tokenizer/config. La prueba local muestra progreso, bytes,
  duración de carga/inferencia, comparación de campos y rechazo de salida fuera de schema.
- Gates locales: `tsc --noEmit` pasa; pruebas enfocadas iniciales de parser e i18n **9/9**;
  Prettier pasa en los archivos tocados.
- `next build` no pudo verificar el bundle porque el entorno no alcanzó `fonts.googleapis.com`
  para las fuentes existentes. El laboratorio luego se abrió por ADB en un Redmi 15 conectado.
- Prueba Redmi 15 (2026-11-08): Qwen3 q4f16 descargó 552.1 MB y reportó carga en 108.4 s con
  WebGPU; la inferencia falló porque la GPU no soporta `shader-f16`. Qwen2.5 q4 CPU/WASM descargó
  su variante y reportó carga en 279.7 s; una frase simple permaneció cerca de dos minutos con
  CPU al 97–100 % sin respuesta y se canceló. El modelo más liviano mejora la carga, pero ambos
  caminos probados no ofrecen todavía una experiencia aceptable en este Redmi. Una segunda
  descarga Qwen3 CPU se inició accidentalmente durante una actualización y se detuvo tras 147 MB
  adicionales; no se completó. El laboratorio ahora comprueba `shader-f16` y exige aceptación
  explícita antes de descargar CPU/WASM. No continuar descargas grandes en datos móviles.
  Memoria máxima y calidad de extracción siguen sin medirse; la experiencia para usuarios no
  está implementada.

**La experiencia financiera para usuarios sigue pendiente de evaluación y diseño.** Por
solicitud del fundador, se añadió un spike Gemini de desarrollo para comparar la API alojada
con frases sintéticas fijas. La primera llamada, antes de añadir el catálogo al prompt, tardó
1.0–1.4 s: importe y nota correctos; Gemini inventó una fecha y omitió campos pendientes. La
capa TwinCap normaliza la fecha al valor por defecto de hoy, filtra categorías contra las
etiquetas permitidas y restaura cuenta/categoría/contexto como pendientes. Al añadir la lista
sintética de categorías, las llamadas siguientes fallaron; el último diagnóstico confirmó
HTTP 503 del proveedor, no 429 de cuota. Se implementó un reintento breve y acotado para 503;
todavía no se confirmó en vivo que Gemini elija “Moto” de la lista. Los tests verifican que
la lista se envía y que la salida queda limitada a esas etiquetas. El nivel gratuito puede usar solicitudes para
mejorar productos de Google: no se envían datos reales. El spike no está disponible en
producción, no guarda operaciones y no decide todavía proveedor o precio. Los dos modelos
locales probados no resultaron aceptables en el Redmi 15.

---

## RP-05 — Actualización de la PWA instalada

**Origen/fecha:** solicitud del fundador, 2026-11-08.
**Estado:** implementación local lista para publicar; validación en PWA Android de producción pendiente.
**Prioridad:** P1.
**Objetivo:** detectar nuevas versiones de TwinCap en una PWA Android ya instalada y actualizar el worker sin dejar al cliente fijado indefinidamente a assets antiguos.

### Comportamiento implementado

- Se incrementó el caché del service worker de `twincap-v7` a `twincap-v8`.
- El nuevo worker ya no ejecuta `skipWaiting()` automáticamente durante instalación. Si hay una versión esperando y otra activa, la app presenta “Hay una actualización disponible” / “Actualizar ahora”.
- La persona confirma la actualización; TwinCap envía `SKIP_WAITING` al worker en espera y recarga cuando este toma control. La primera instalación no fuerza una recarga.
- La app pide actualización al registrar el worker, cuando vuelve a primer plano y al recuperar conexión, además de una comprobación periódica cada seis horas. El registro usa `updateViaCache: "none"` para evitar que el navegador valide el script desde una copia HTTP obsoleta.
- Se mantiene fuera de caché el HTML de rutas autenticadas y las rutas API/server actions. Solo se almacenan las rutas públicas y assets estáticos definidos por el service worker.
- Los textos del aviso y botón están en `messages/es.json` y `messages/en.json`.

### Verificación pendiente

- No se ejecutaron pruebas automatizadas de esta parte antes del push, conforme a la instrucción del fundador de dejar las pruebas por ahora.
- Después del deployment, abrir la PWA instalada en el Redmi 15 con conexión y esperar el aviso; tocar “Actualizar ahora” debe activar el worker nuevo y recargar TwinCap. Comprobar después que la versión nueva se mantiene al cerrar y abrir la PWA.
- Confirmar también que una actualización disponible no recarga ni interrumpe la operación mientras la persona no la acepte.

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
