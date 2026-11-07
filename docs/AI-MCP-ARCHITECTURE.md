# Diseño base: agentes de IA conectados a TwinCap mediante MCP

> **Estado: propuesta de arquitectura para revisión; no autoriza implementación.**
> Fecha: 2026-11-07. Esta propuesta conserva abiertas las decisiones de producto sobre
> quién habilita el conector, cómo se empaqueta y qué roles existirán. Define una base
> común para explorar Claude, OpenAI y otros clientes MCP sin acoplar permisos al proveedor.

## 1. Objetivo

Permitir que una aplicación de IA (por ejemplo Claude) consulte información financiera
de TwinCap y, en una fase posterior, prepare operaciones, manteniendo en TwinCap la
identidad, el aislamiento de datos, las reglas financieras, la autorización y la
auditoría.

MCP es el contrato de conexión y descubrimiento de herramientas. **No es el sistema de
identidad, no define los roles de TwinCap y no concede permisos por sí mismo.** El modelo
propone cuándo llamar una herramienta; TwinCap decide si la llamada es válida y qué
datos puede devolver o cambiar.

## 2. Decisiones de diseño que sí pueden fijarse ahora

1. Mantener aislados los ámbitos **Personal** y **Negocio** en autorización, consultas,
   resultados y auditoría. La autorización de uno no implica la del otro.
2. Derivar la identidad de la persona de un token OAuth validado por TwinCap; ignorar
   cualquier `userId`, rol o identidad sugeridos por argumentos de herramienta.
3. Resolver el negocio objetivo desde los ámbitos autorizados del token y comprobar la
   membresía vigente de la persona. Nunca confiar solo en un `workspaceId` del modelo.
4. Reutilizar casos de uso de TwinCap y sus validaciones. El adaptador MCP no consulta
   Mongo directamente ni replica lógica financiera.
5. Denegar por defecto, conceder capacidades específicas por herramienta, limitar
   resultados y facilitar revocación.
6. Empezar con consultas de solo lectura. Ningún texto del modelo, confirmación del
   cliente MCP o modo de investigación constituye aprobación suficiente para escribir.
7. Mantener independientes la conexión a un proveedor LLM y la autorización de datos
   TwinCap. TwinCap no requiere la clave API de Claude u OpenAI cuando sus productos
   actúan como clientes MCP remotos.

## 3. Modelo conceptual futuro

El modelo objetivo de varios negocios debe distinguir facturación de acceso a datos:

```text
User ── Subscription ownership/billing ── Subscription
  │                                           │
  ├── Personal financial scope               ├── Business/Workspace A
  │                                           │       └── Memberships + role grants
  └── Personal AI connection                 └── Business/Workspace B
                                                  └── Memberships + role grants
```

- La **suscripción** es el límite de plan, facturación, entitlements y políticas
  administrativas. No es por sí misma un tenant de datos financieros.
- Cada **negocio** conserva el aislamiento actual por `workspaceId` (o su sucesor
  explícito) y tiene sus propias membresías.
- El ámbito **Personal** pertenece a un usuario. No es un negocio ni una membresía.
  Compartirlo requiere una delegación personal explícita y separada.
- El **propietario de suscripción** puede eventualmente administrar la habilitación,
  disponibilidad, gasto y límites de la función. Esa condición no lo convierte
  silenciosamente en usuario de todos los datos personales ni sustituye la membresía
  requerida para operar en cada negocio.
- Un **agente/conexión** identifica al cliente MCP y la autorización que una persona
  concedió. No es una persona ni obtiene un rol privilegiado propio.

El código actual implementa `Workspace`, `Membership` y roles `owner`, `admin`,
`member`, `seller`, pero la ronda de beta desactiva multiusuario y workspaces múltiples.
No asumir que el modelo actual ya resuelve suscripción con varios negocios; el diseño
de billing, ownership, traspasos y membresías requiere una fase de producto propia.

## 4. Dos autorizaciones separadas

### 4.1 Habilitación administrativa (decisión de producto abierta)

Una persona propietaria podría habilitar MCP en la suscripción, aprobar clientes
compatibles, imponer límites de uso y decidir si la capacidad está disponible para los
miembros. Alternativamente, la función puede ser individual. Ambas opciones son
compatibles con este diseño.

Habilitar el conector **no concede acceso a ningún dato**. En planes de Claude Team o
Enterprise, la configuración organizacional del conector y la conexión OAuth individual
del usuario son conceptos separados; TwinCap debe conservar esa misma separación.

### 4.2 Concesión de acceso a datos (por la persona que los posee/usa)

En el flujo OAuth de TwinCap, la persona autenticada revisa y concede scopes por ámbito:

- Personal: solo el propio perfil autenticado, a menos que exista una delegación futura.
- Negocio: cada negocio se autoriza por separado y solo si la persona tiene membresía
  activa y las capacidades requeridas.
- Lectura y escritura son capacidades distintas. La primera versión no solicita scopes
  de escritura.

La recomendación es que el conector pueda ser **administrado/habilitado** por el dueño
de la suscripción y que cada persona **autorice sus propios datos**. En solicitudes de
miembros, TwinCap aplica los permisos de quien usa Claude, no los del dueño que habilitó
la integración.

## 5. Experiencia de conexión prevista (Claude y OpenAI como primeros clientes)

1. El usuario agrega la URL del servidor remoto TwinCap en Conectores de Claude. En
   Claude Pro/Max lo agrega el propio usuario; para un workspace Claude Team/Enterprise,
   un owner de Claude puede publicar el conector y cada usuario se conecta a TwinCap.
2. Claude descubre el servidor de autorización de TwinCap y lleva al navegador a TwinCap.
   TwinCap autentica con su flujo web y muestra consentimiento identificando al cliente,
   el registro/versión de su metadata y los permisos solicitados.
3. El usuario selecciona Personal y/o negocios elegibles, scopes, herramientas y una
   explicación comprensible de qué datos se entregarán al proveedor LLM.
4. OAuth Authorization Code + PKCE devuelve a Claude un código de un solo uso. El
   Authorization Server de TwinCap emite credenciales con audiencia del resource server
   MCP, scopes mínimos y vencimiento.
5. En un chat, Claude invoca herramientas disponibles. TwinCap valida el token, vuelve
   a comprobar el acceso vigente y ejecuta un caso de uso.
6. El usuario puede desconectar desde TwinCap o Claude. El Authorization Server revoca
   refresh grant y conexiones/tokens relacionados; el resource server rechaza siguientes
   requests.

La misma API MCP remota de TwinCap debería servir a Claude, productos ChatGPT compatibles
y, cuando convenga, agentes que usen la API de OpenAI. No es necesario construir una API
financiera distinta por proveedor. Sí se necesita una matriz de compatibilidad probada:
OAuth/discovery, refresh, protocolo/transportes, límites de herramientas, aprobación,
disponibilidad web/móvil y comportamiento de datos.

### Rutas de conexión OpenAI

“Conectar OpenAI” puede referirse a dos productos diferentes, y la UX y facturación no
son iguales:

1. **ChatGPT como cliente MCP:** la persona o un administrador añade el servidor remoto
   de TwinCap como app/conector de ChatGPT y autoriza TwinCap mediante su flujo. OpenAI
   actualmente documenta conexiones MCP personalizadas para ChatGPT Business y
   Enterprise/Edu en web; ChatGPT Pro tiene acceso limitado a herramientas read/fetch y
   las conexiones MCP personalizadas en ChatGPT son actualmente web-only. La consola/API
   de administración y capacidades varían por plan. No prometer el uso desde ChatGPT
   móvil hasta que OpenAI habilite esa ruta para los planes/productos relevantes.
2. **Agente propio con API de OpenAI:** un producto (por ejemplo una interfaz futura de
   TwinCap o un agente que construya el cliente) usa Responses API/Agents API para llamar
   el mismo servidor MCP remoto. El uso del modelo/API se factura a la cuenta de
   plataforma/API correspondiente. ChatGPT y API tienen facturación separada; ciertos
   planes elegibles pueden ofrecer créditos API reclamables, que se administran en la
   organización API y no se convierten automáticamente en uso del chat. La aplicación
   cliente debe obtener/renovar el OAuth grant de TwinCap y
   suministrar el token conforme al contrato API en cada llamada que lo requiera. La
   clave API de OpenAI pertenece al backend del desarrollador y nunca se envía al
   navegador, a TwinCap ni al servidor MCP.

Los dos caminos terminan en el mismo servidor y capacidades de TwinCap, pero el login,
la facturación del LLM, la superficie de chat, los approvals del host y la disponibilidad
móvil pertenecen al proveedor/cliente. OpenAI documenta el parámetro remoto `server_url`
para MCP en Responses API y el uso de servidores MCP personalizados en ChatGPT. La
documentación de ChatGPT indica hoy que MCP personalizado no está disponible en móvil;
esto es una restricción del cliente OpenAI, no de Vercel ni de TwinCap.

La app TwinCap seguirá siendo la superficie de administración del grant, consentimiento,
revocación y confirmación propia de escrituras. No asumir que una aprobación presentada
por Claude o ChatGPT sustituye el control de TwinCap. La integración también debe
funcionar con otros clientes MCP compatibles sin lógica financiera específica del
proveedor.

### Compatibilidad de proveedor desacoplada

Mantener un núcleo común de identidad, permisos, herramientas y auditoría. Un catálogo de
compatibilidad/configuración (no reglas de autorización) puede registrar por cliente:

- identificador de proveedor/cliente OAuth verificado y nombre/logo aprobado;
- versiones MCP/transportes certificados (primero Streamable HTTP remoto);
- método de registro de cliente y redirect URIs exactas;
- scopes, refresh-token behavior y duración/reautenticación observada;
- herramientas/annotations/structured output soportados y límites prácticos;
- si el host presenta aprobación, y por qué acciones/superficies;
- disponibilidad por producto/plan y cliente web/desktop/móvil;
- fecha de última prueba, versión SDK/protocolo y estado: experimental, compatible,
  limitado o retirado.

Una ausencia de característica en el host nunca relaja permisos en TwinCap. Evitar
ramificar autorización financiera por nombre de proveedor. Admitir proveedores futuros
por compatibilidad MCP/OAuth verificada; no prometer “cualquier modelo” hasta tener una
matriz de interoperabilidad y soporte.

## 6. Catálogo inicial de herramientas

Herramientas pequeñas, tipadas y de salida acotada. Las fechas son fechas civiles con
zona/regla explícita; los importes conservan su moneda y jamás se totalizan monedas
distintas. Respuestas deben diferenciar saldo, flujo, ventas, cobros, deuda y resultado
económico conforme a las reglas financieras de TwinCap.

### Personal (lectura)

- `personal.get_financial_summary(period, date_range?)`
- `personal.list_movements(date_from, date_to, account?, category?, type?, limit?, cursor?)`
- `personal.list_accounts(include_balances?)`
- `personal.list_credits_granted(status?, due_before?, limit?, cursor?)`
- `personal.list_credits_received(status?, due_before?, limit?, cursor?)`
- `personal.list_payables(status?, due_before?, limit?, cursor?)`

### Negocio (lectura, cada llamada ligada a un business scope autorizado)

- `business.get_summary(date_from, date_to)` — ventas, cobros, gastos y resultado con
  notas de alcance/incompletitud.
- `business.list_sales(date_from, date_to, status?, client?, limit?, cursor?)` — separar
  total vendido, cobrado y pendiente.
- `business.list_receivables(status?, due_before?, limit?, cursor?)`.
- `business.list_payables(status?, due_before?, limit?, cursor?)`.
- `business.list_movements(date_from, date_to, account?, category?, type?, limit?, cursor?)`.
- `business.get_inventory_status(low_stock_only?, limit?, cursor?)` — indicar costos no
  rastreados como desconocidos, nunca como cero.

### Reglas de exposición del catálogo

- `tools/list` puede filtrar las herramientas visibles según scopes otorgados, pero cada
  `tools/call` vuelve a autorizar. Ocultar una herramienta no es control de seguridad.
- El negocio puede venir en un contexto autorizado seleccionado, no de un identificador
  libre que el modelo pueda cambiar para explorar otros tenants. Si el cliente envía un
  ID, TwinCap lo cruza con la concesión OAuth y la membresía activa antes de consultar.
- Los parámetros validan tipo, enum, longitud, rangos civiles, límites y orden. Paginación
  con cursor opaco, firmado o persistido, siempre acotado al usuario, ámbito, filtros y
  versión de consulta.
- Resultados paginados; topes duros y límites de ventana temporal configurable. Rechazar
  consultas ambiguas o demasiado amplias, en lugar de descargar el workspace completo.
- Devolver campos necesarios, no documentos de dominio completos. Excluir credenciales,
  hashes, identificadores de sesión, datos de autenticación y PII no pertinente.
- Los nombres/notas de movimiento y contenido libre son datos no confiables. No deben
  ejecutarse, convertirse en instrucciones de sistema ni utilizarse como autoridad de
  permisos. No reflejar mensajes de error internos ni existencia cross-tenant.
- Incluir fecha/periodo, ámbito, moneda, cobertura/truncamiento y advertencias de datos
  incompletos en resultados para reducir conclusiones inventadas por el modelo.

## 7. Escrituras futuras: propuestas y confirmación fuera de banda

No habilitar escritura en el MVP. Más adelante, usar un flujo de dos etapas:

```text
LLM propone datos → TwinCap valida y muestra borrador → persona revisa en TwinCap
→ consentimiento de un solo uso → caso de uso normal ejecuta → auditoría registra
```

- La persona confirma en la interfaz TwinCap, no solo en la conversación. El cliente puede
  ejecutar llamadas automáticas (p. ej. modos de investigación), y el modelo puede ser
  inducido por prompt injection; una afirmación del cliente de que hubo aprobación no es
  prueba.
- El borrador guarda actor, conexión, negocio, herramienta, payload normalizado, resumen
  de lo que se confirma, expiración corta y hash del payload. Cambiar cualquier campo
  invalida la aprobación. La confirmación es de un solo uso, ligada a la persona y al
  ámbito; no se acepta replay.
- Ejecutar el caso de uso existente del producto con validación de autorización al
  confirmar, autorización vigente, validación financiera, `connectDb()`, unidad
  transaccional cuando aplica e idempotencia para evitar duplicados.
- Mantener la fuente de verdad del formulario: cuenta determina moneda; transferencias
  mantienen origen/destino; fecha civil explícita; abonos, crédito, ventas e inventario
  respetan su semántica existente.
- Toda escritura habilitada requiere permiso explícito separado, paso de aprobación UI,
  límites y pruebas de concurrencia/replay. No ofrecer comandos genéricos tipo
  `execute_sql`, `run_action`, `update_anything` ni borrado en lote.

## 8. OAuth, tokens y ciclo de vida

- El **MCP Resource Server** y el **OAuth Authorization Server** son componentes de
  confianza separados aunque inicialmente compartan dominio, despliegue y código Next.js.
  El Authorization Server gestiona login, consentimiento, autorización, token y
  revocación; el MCP Resource Server solo publica Protected Resource Metadata, valida
  cada bearer token destinado a MCP y aplica scopes. Usar `mcp-handler`/SDK como adaptador
  HTTP de resource server, no como emisor de tokens. No confundir una respuesta MCP 401
  con la implementación del flujo OAuth.
- OAuth Authorization Code + PKCE, TLS, state aleatorio de un solo uso, issuer exacto,
  audience MCP, firma, expiración, scopes, redirect URI exacta y callback validado. No
  pedir/almacenar contraseña del proveedor LLM ni contraseña TwinCap en un campo de
  conector.
- Para clientes nuevos, diseñar registro/prueba de identidad compatible con **Client ID
  Metadata Documents (CIMD)** y prerregistro de clientes conocidos. La revisión MCP
  `2026-07-28` depreca DCR; mantener compatibilidad con clientes anteriores solo si se
  necesita y con consentimiento por cliente, rate limit, redirect URI allowlist y defensa
  frente a SSRF al resolver metadata remota. No tratar nombre/logo remitidos por cliente
  como identidad probada.
- Tokens de acceso breves, audiencia TwinCap y scopes como `personal.summary:read`,
  `personal.movements:read`, `business.sales:read`, asociados a `sub`, `client_id`,
  connection/grant id y ámbitos concedidos. No codificar el rol como permiso duradero.
- Refresh tokens rotatorios, de un solo uso, almacenados solo como hash; detección de
  reutilización revoca el grant. Revocación por usuario, suscripción/administrador según
  política futura, cambio de contraseña, cierre de cuenta, baja de membresía, suspensión
  del negocio o downgrade que quite el entitlement.
- En cada llamada crítica, resolver de nuevo estado de usuario, entitlement, conexión,
  membresía y grant. Si existe caché de autorización, TTL muy corto, invalidez al cambiar
  rol/membresía y política fail-closed si no se puede verificar.
- No aceptar tokens de sesión web ni tokens OAuth del proveedor LLM emitidos para otros
  recursos; no reenviar bearer tokens hacia Mongo u otros servicios.
- Consentimiento por cliente OAuth, scopes y redirect URI. Aplicar consentimiento por
  cliente para evitar confused-deputy. No confiar en client name/logo como identidad
  verificada.
- Separar scopes OAuth gruesos de permisos de negocio: OAuth prueba el grant y la
  capacidad solicitada; la política TwinCap comprueba membresía y permiso actual.

## 9. Política de autorización y roles

Definir permisos atómicos independientemente de nombres de rol. Esquema conceptual:

```text
authorize(actor, client, connection, scope, capability, resource, now)
  → allow | deny + reason code
```

La evaluación incluye: token válido para recurso; conexión activa; plan habilitado;
ámbito Personal del mismo usuario o membresía activa en negocio; permiso asociado al rol;
eventual límite/consentimiento específico; autorización de recurso tenant-scoped.

- Deny-by-default y validación centralizada desde casos de uso/policy, no `if role ===`
  dispersos por tools.
- Un rol nunca debe llamarse `ai` o `agent` para conceder poderes separados. El actor
  efectivo es la persona y la conexión es contexto de auditoría. El agente no puede
  elevar permisos del actor.
- Roles actuales son provisionales para este futuro: `owner/admin/member/seller` no son
  una matriz aprobada. Diseñar por capacidades como `summary.read`, `movements.read`,
  `sales.read`, `inventory.read`, `sales.create`, `movement.create`; asignaciones y
  alcance por negocio se decidirán en la iniciativa de equipos.
- En la beta mono-workspace, leer owner desde la sesión actual no basta para construir
  OAuth multi-negocio; no implementar una traducción implícita entre workspace claim y
  permiso MCP.

## 10. Límites del dominio financiero

- Transferencias propias no son ingreso ni gasto.
- Saldo no es resultado; no mezclar posición y flujo.
- Venta y cobro son métricas distintas. Abonos no vuelven a contabilizar el total vendido.
- Crédito recibido es deuda; payable y pagos respetan su semántica.
- Crédito otorgado: capital recuperado no es ingreso; solo interés lo es. Write-off sigue
  las reglas de dominio existentes.
- Inventario con costo faltante es incompleto/desconocido.
- Multi-moneda siempre muestra grupos separados; el MCP no inventa tasas FX.
- Reportes y herramientas respetan filtros, exclusiones legacy y fechas civiles. Ningún
  texto del LLM modifica hechos financieros o registros persistidos.

## 11. Arquitectura en TwinCap y Vercel

```text
Claude / ChatGPT / otro cliente MCP
  ├─ OAuth Authorization Code + PKCE → TwinCap Authorization Server
  │    ├─ sesión web existente para identificar a la persona
  │    ├─ consentimiento/grants por cliente + scopes/ámbitos
  │    └─ códigos/tokens revocables con audience MCP
  └─ HTTPS Bearer → /api/mcp (Next.js Route Handler, Node.js runtime)
       ├─ MCP Resource Server: metadata + validar token (sin cookie web)
       ├─ construir RequestPrincipal y contexto autorizado por request
       ├─ verificar grant + rol/membresía + entitlement + límites
       ├─ invocar use case de core/application
       ├─ infraestructura/repositories tenant-scoped (connectDb antes de usarlos)
       └─ respuesta estructurada mínima + registro de auditoría
```

- Comenzar con **Streamable HTTP**; evitar SSE legado. Elegir modo sin sesión de proceso
  para escalar en Functions y tolerar cold starts/instancias distintas. No guardar contexto
  de usuario en variables globales o singleton de proceso.
- Implementar la ruta MCP remota en la aplicación Next.js/Vercel es viable; un proceso
  separado no es requisito inicial. Fijar runtime Node.js si SDK/crypto/Mongoose lo
  requieren. La ruta está diseñada como API server-to-server y no depende del layout,
  sesión cookie ni proxy de UI.
- Cumplir regla del repo: toda entrada que accede a Mongoose ejecuta `await connectDb()`
  antes de instanciar/usar repositorios; estos se crean dentro del handler/caso de uso.
- Endpoint de producción accesible desde Anthropic. La protección de despliegue Preview
  de Vercel no debe bloquear arbitrariamente a clientes remotos; probar dominio de
  producción, TLS, callbacks y metadata. No confiar en CORS como autenticación.
- Sin tareas largas ni streaming abierto en la fase inicial. Respuestas pequeñas dentro
  del límite de duración; si luego hay reportes pesados, usar trabajo asíncrono con job
  handle opaco, propietario y expiración, persistido fuera de memoria de Function.
- Configurar máximos de duración, tamaño del body/respuesta, concurrencia, timeout de DB,
  paginación, rate limit distribuido y alarmas de consumo. Proteger costos tanto de
  invocaciones MCP como de consultas a Mongo.
- Construir el servidor MCP por request o usar fábricas sin estado compartido; no mutar
  catálogo o permisos globales entre usuarios. `tools/list` determinista y filtrado por
  grant solo como UX.
- Usar URL canónica estable del proyecto `twincap`; no crear deployment globalmoney ni
  configurar deploy sin aprobación explícita (regla del repo).

## 12. Privacidad, proveedor y experiencia de consentimiento

La conexión hace posible que los datos devueltos por TwinCap lleguen al contexto del LLM
y sean tratados según el producto/configuración del proveedor. Antes del consentimiento,
TwinCap debe explicar en lenguaje claro:

- proveedor/cliente conectado y nombre presentado por OAuth;
- scopes, ámbito Personal/Negocio y negocio seleccionado;
- campos que podrían salir de TwinCap y propósito;
- qué se almacena en TwinCap (grant, tokens hasheados, auditoría) y qué no (conversación
  completa por defecto);
- límites, política de retención de logs y ruta de revocación;
- riesgo de que instrucciones encontradas en notas/documentos intenten inducir acciones.

No registrar prompts completos ni payload financiero sensible por defecto. Auditoría
guarda herramienta, actor, conexión, ámbito, hora, resultado categorizado, duración y
trace id; errores y resultados se redactan/minimizan. Definir retención/borrado conforme a
política de privacidad. Medir sin convertir valores financieros o notas en telemetría.

No asumir que “el modelo no entrena con esto” ni prometer retención de proveedor sin
validar sus términos para el plan concreto. MVP comparte con el proveedor únicamente la salida
necesaria para responder la solicitud. No se envía un dump/snapshot del workspace al
conectar ni se sincronizan datos en segundo plano.

## 13. Amenazas y controles mínimos

| Amenaza                                       | Control de diseño                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Token filtrado/replay                         | Bearer solo en TLS; audience/issuer; acceso breve; refresh rotatorio; revocación; jamás logs de token.                       |
| Cruce de negocio/Personal                     | Tenant y actor se derivan del token/grant; repositorios tenant-scoped; comprobar membresía por llamada y objeto.             |
| Rol cambiado o miembro removido               | Reevaluar permisos vigentes en backend; revocación/invalidez inmediata o caché corta fail-closed.                            |
| Prompt injection en notas o recursos          | Tratar datos como datos no confiables; herramientas estrechas; no ejecución de texto; confirmación UI aparte para escritura. |
| Extracción masiva                             | Periodos y páginas limitadas, rate/quota, audit alerts y scopes por capacidad.                                               |
| Herramienta nueva/ampliada sin consentimiento | Scopes versionados y consentimiento ante scopes nuevos; cambios incompatibles controlados y auditados.                       |
| LLM llama por error dos veces                 | Lecturas idempotentes; escrituras futuras con clave idempotente y confirmación single-use.                                   |
| Confused deputy / cliente malicioso           | Identidad de cliente OAuth, consent por client_id y redirect URI exacta; no credenciales compartidas privilegiadas.          |
| Abuso/DoS/costos                              | Validación de schema/JSON, body limits, rate limiting distribuido, timeouts, cuotas y métricas.                              |
| Fuga por errores o logs                       | Errores MCP genéricos, correlación privada, redacción de PII, no stack traces/model objects.                                 |
| Recurso de un tenant en `id` manipulable      | Resolver por workspace autorizado y responder igual ante inexistente/no autorizado; autorización a nivel objeto.             |
| Política MCP bypasseada desde app web         | Casos de uso mantienen las reglas; pruebas directas a tool y use case; no depender del UI del cliente.                       |

## 14. Límites de plan y medición

El entitlement premium es una regla de TwinCap independiente del OAuth. Comprobarlo en
conexión y en cada llamada, con política aprobada para downgrade, periodo de gracia,
cancelación y conservación de acceso a los datos existentes. Poner límites medibles por
suscripción/usuario/negocio: llamadas, filas devueltas, ventana de fechas, concurrencia y
posible presupuesto de cómputo. No cobrar por “tokens LLM” de Claude, que son relación
usuario-Anthropic; TwinCap podría empaquetar disponibilidad/consultas del conector según
costos reales propios.

Contadores agregados: proveedor/cliente MCP, herramientas por tipo, latencia,
éxito/rechazo por razón, volumen devuelto, límites alcanzados y revocaciones. Nunca usar contenido financiero para
analítica de producto salvo consentimiento y propósito explícitos.

## 15. Fases recomendadas

### Fase A — Contratos sin servidor MCP

- Definir entidades/puertos de conexión OAuth, grants, revocación y política de
  autorización sin asumir multi-workspace terminado.
- Aprobar taxonomía de scopes y semántica Personal/Negocio.
- Matriz de roles→capacidades como parte del diseño de equipos.
- Amenazas, consentimiento, privacidad/retención, modelo de soporte e incidentes.
- Decidir plan y entitlements solo después de estimar costo/validar segmento freelance.

### Fase B — Spike técnico aislado

- Probar endpoint stateless Streamable HTTP en Vercel preview con herramientas sin datos
  financieros; verificar handshake, metadata, cold start, rutas y clientes Claude y
  OpenAI compatibles (ChatGPT web y, separado, Responses API/Agents API).
- Validar OAuth Code+PKCE end-to-end, callback Claude, refresh, revocación y seguridad de
  redirect/client metadata.
- No publicar herramienta sin autorización ni conectar Atlas de producción.

### Fase C — Lectura Personal limitada

- Un usuario conecta su propio Claude a herramientas personales de solo lectura.
- Pruebas cross-user, scopes faltantes, revocación, cambio de sesión, límites, fechas,
  monedas y privacidad.

### Fase D — Lectura multi-negocio

- Depende de billing/subscription, workspaces múltiples y roles operativos aprobados.
- Consentimiento negocio por negocio y verificación de roles por herramienta.
- Claude Team/Enterprise: owner puede publicar endpoint del conector en Claude; cada
  usuario autentica por OAuth propio a TwinCap. No usar credencial compartida.

### Fase E — Propuestas y eventual escritura

- Solo con diseño UI de aprobación, caso financiero, capability, idempotencia, límites,
  logging y análisis de abuso revisados por acción.

## 16. Criterios de aceptación previos a producción

- Un Claude autorizado solo accede a Personal/negocios explícitamente concedidos.
- Manipular business/workspace/account/customer IDs nunca cruza tenant ni revela
  existencia de registros ajenos.
- Remover una membresía, bajar rol, suspender negocio, cambiar password, cancelar plan o
  revocar conexión bloquea llamadas según política aprobada.
- Tokens de sesión de UI, issuer/audience incorrectos, caducados, repetidos y scopes no
  concedidos fallan cerrados.
- Herramientas de solo lectura no cambian documentos, saldos, ventas, inventario ni
  movimientos; cada llamada deja evento audit mínimo.
- Límite de filas/periodo/rate impide extracción completa no autorizada; el usuario
  entiende datos truncados.
- Unidades de moneda, fechas civiles y semántica de resultados coinciden con use cases y
  reportes existentes; nunca se totalizan monedas distintas.
- Concurrencia en múltiples Functions/cold starts no mezcla identidad, sesión, grants o
  respuestas. No hay reliance en estado del proceso.
- Errores no incluyen secretos, stack traces, PII innecesaria ni detalles cross-tenant.
- Consentimiento informa con claridad el traspaso de datos al proveedor; revocación es
  visible y efectiva.
- Verificación por separado con Claude web/Desktop/móvil, ChatGPT web en los planes
  habilitados y un cliente propio de Responses/Agents API. Confirmar disponibilidad móvil
  por producto; no inferirla del protocolo MCP.

## 17. Decisiones pendientes (no bloquean el diseño común)

1. ¿Quién habilita la disponibilidad del conector en TwinCap: dueño de suscripción,
   administrador de negocio o cada usuario?
2. ¿El dueño puede requerir el conector o solo ofrecerlo? Recomendación: puede habilitar
   disponibilidad, nunca obligar a consentir.
3. ¿Conexión OAuth por persona y cliente, o conexión separada por negocio? Recomendación
   inicial: grant por persona + ámbitos enumerados, permitiendo revocar un negocio sin
   revocar todos.
4. ¿Permitir varios clientes/agentes conectados por la misma persona? Es útil para Claude,
   ChatGPT y agentes propios; requiere grants/revocación separados y límites claros.
5. ¿Qué datos personales de clientes puede ver cada rol del negocio? Definir antes de
   exponer búsquedas de clientes o notas.
6. ¿Cuándo se habilitan tools de escritura y qué acciones requieren doble confirmación?
7. ¿Qué historial guarda TwinCap y cuánto tiempo? ¿Debe el administrador del negocio
   conocer que un miembro conectó un proveedor? (No implicar acceso a su chat privado.)
8. ¿Plan/entitlement, cuota y disponibilidad en downgrade o impago?
9. ¿Regiones, residencia, DPA/contratos y política de retención del proveedor LLM?
10. ¿Qué clientes se soportan oficialmente y con qué nivel de compatibilidad/soporte?

No fijar estos detalles mediante defaults técnicos accidentales. Las opciones pendientes
deben configurarse en un lugar que permita evolucionar la política sin cambiar el
protocolo MCP.

## 18. Referencias técnicas

- [Especificación de autorización MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Buenas prácticas de seguridad MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/security_best_practices)
- [Desplegar MCP en Vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel)
- [Guía Vercel: xmcp con Next.js](https://vercel.com/kb/guide/using-xmcp-with-nextjs)
- [Claude: conectores remotos personalizados](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Claude: construcción de conectores remotos](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers)
- [OpenAI API: servidores MCP para Responses API](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [OpenAI: conectar servidores MCP personalizados en ChatGPT](https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt)
- [OpenAI API: conexiones MCP para Agents API](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)
- [OpenAI: facturación separada de ChatGPT y API](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform)
- [OpenAI: créditos API para suscripciones elegibles](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions)

Las especificaciones y capacidades de proveedores cambian; reconfirmar versiones,
transportes y callbacks al iniciar la fase técnica.
