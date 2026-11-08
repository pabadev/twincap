# Diseño base: agentes de IA conectados a TwinCap mediante MCP

> **Estado: piloto OpenCode implementado localmente; despliegue y conexión real pendientes.**
> Fecha: 2026-11-07. Esta propuesta conserva abiertas las decisiones de producto sobre
> quién habilita el conector, cómo se empaqueta y qué roles existirán. Define una base
> común para explorar Claude, OpenAI, OpenCode y otros clientes MCP sin acoplar permisos al proveedor.

> **Avance local (2026-11-07):** implementación local del flujo OAuth para OpenCode con
> CIMD limitado a su documento oficial, PKCE S256, consentimiento reciente, grant
> revocable, access/refresh tokens opacos almacenados como hashes, rotación de refresh,
> endpoints de descubrimiento/token/revocación, y endpoint MCP remoto stateless. La única
> herramienta es `personal.get_financial_summary`, de solo lectura y limitada a totales
> personales agregados por moneda. El perfil permite revisar y revocar grants. Eventos
> mínimos registran consentimiento, emisión/rotación, revocación y llamadas exitosas, sin
> guardar tokens, prompts ni cifras de respuesta. El 2026-11-07 se crearon las cuatro
> colecciones MCP vacías y se materializaron/verificaron todos los índices requeridos en
> la base configurada; conteo confirmado: cero documentos en cada colección. El entorno
> local queda allowlisted para el userId del fundador. Producción no se habilitó en Vercel,
> no se desplegó código y OpenCode no se ha conectado. Faltan verificación end-to-end,
> revisión del protocolo con OpenCode y despliegue aprobado.

### Preparación de índices en producción

Con `MONGODB_URI` apuntando al entorno correcto, inicializar primero las colecciones
vacías y luego materializar los índices de OAuth, grants, credenciales y auditoría:

```text
pnpm indexes:init:mcp
pnpm indexes:ensure:mcp
pnpm indexes:verify:mcp
```

La verificación global `pnpm indexes:verify` también incluye el contrato MCP. No habilitar
`MCP_ENABLED` si falta un índice o existe un conflicto. En la preparación del piloto
(2026-11-07), la inicialización y materialización se ejecutaron explícitamente sobre la
base configurada; luego el verificador confirmó todos los índices y conteos en cero.

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
   TwinCap. TwinCap no requiere la clave API de Claude, OpenAI ni OpenCode Go cuando sus
   productos actúan como clientes MCP remotos.
8. El login normal de TwinCap permanece con correo/contraseña. OAuth se añade como
   Authorization Server para delegar a clientes MCP; no sustituye ni migra el login web.

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

## 5. Experiencia de conexión prevista (Claude, OpenAI y OpenCode)

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

La misma API MCP remota de TwinCap debería servir a Claude, OpenCode, productos ChatGPT compatibles
y, cuando convenga, agentes que usen la API de OpenAI. No es necesario construir una API
financiera distinta por proveedor. Sí se necesita una matriz de compatibilidad probada:
OAuth/discovery, refresh, protocolo/transportes, límites de herramientas, aprobación,
disponibilidad web/móvil y comportamiento de datos.

### OpenCode como cliente de prueba

OpenCode es un host/agente de IA que actúa como **cliente MCP** y una ruta de validación
temprana para el fundador. OpenCode Go/Go Plus es el **proveedor/plan de modelos dentro
de OpenCode**, no un cliente OAuth de TwinCap. La metadata CIMD de OpenCode identifica a
la aplicación OpenCode; no transmite qué modelo o suscripción eligió el usuario.
Su documentación actual describe servidores remotos mediante Streamable HTTP y OAuth
con autorización en navegador y almacenamiento local de credenciales. La prueba se
configura desde OpenCode apuntando al endpoint remoto de TwinCap y completando el
consentimiento en el navegador; la autorización sigue siendo un grant de TwinCap
revocable, independiente de la suscripción del modelo.

OpenCode Go (US$10) y Go Plus (US$40, según la oferta documentada actualmente) habilitan
modelos dentro de OpenCode. OpenCode consume el modelo con su plan y, cuando el modelo
decide llamar una herramienta, envía una solicitud MCP autenticada con el token OAuth que
TwinCap emitió. No se entrega la API key de Go a TwinCap ni al servidor MCP. Son dos
servicios y permisos independientes. Go y Go Plus están descritos para workspaces de un
solo miembro, lo que encaja con la prueba Personal inicial; no implica acceso a negocios
ni datos de otras personas. OpenCode guarda OAuth MCP localmente: cada instalación/equipo
autoriza su propio grant aunque la persona use la misma suscripción Go; autenticar Go no
copia ni sincroniza la autorización de TwinCap.

La compatibilidad debe verificarse con una matriz de cliente OpenCode (versión estable,
OAuth/PKCE, CIMD o cliente prerregistrado, refresh, revocación, nombres de herramientas,
límites y sesiones). No asumir que el soporte OAuth del cliente equivale a soporte de
todos los métodos de registro; validar la ruta real y exigir redirect URI exacta.

#### Secuencia del piloto OpenCode

1. En OpenCode, el usuario conecta su plan OpenCode Go/Go Plus con `/connect`, introduce
   su propia clave directamente en el cliente y escoge un modelo. Esta configuración no
   se envía a TwinCap.
2. En una ubicación/proyecto dedicado de OpenCode para el piloto, configura un servidor
   remoto `twincap` cuya URL sea `${APP_BASE_URL}/api/mcp`. No agregarlo globalmente al
   OpenCode durante el piloto: reduce los proyectos y sesiones desde los cuales el modelo
   puede pedir datos. La configuración MCP guarda la URL pública, nunca la clave Go ni
   el token TwinCap.
3. Ejecuta `opencode mcp auth twincap` o la acción de autenticar en `/mcps`. OpenCode
   abre el navegador con una solicitud OAuth Authorization Code + PKCE y su identidad
   CIMD. TwinCap autentica con la sesión web existente (correo/contraseña cuando haga
   falta) y muestra una pantalla de consentimiento propia.
4. El consentimiento inicial solo ofrece el ámbito Personal del usuario y la primera
   herramienta de resumen. Tras aceptar, TwinCap redirige el navegador al callback
   loopback de OpenCode (`127.0.0.1` o `localhost`, puerto local dinámico permitido solo
   por el perfil nativo verificado). TwinCap no hace una conexión de red al equipo local.
5. OpenCode canjea el código con su verifier PKCE y obtiene tokens dirigidos únicamente
   al endpoint MCP. El agente llama las herramientas desde sus sesiones; el plan Go
   consume el modelo y TwinCap autentica y autoriza cada llamada de datos.
6. Desconectar en OpenCode (`opencode mcp logout twincap`) borra credenciales locales;
   revocar en TwinCap invalida el grant y todos sus tokens/familia de refresh. La UX de
   TwinCap debe dejar clara esta diferencia y ofrecer revocar la conexión desde la app.

Configuración cliente para la validación una vez que el entorno esté desplegado y habilitado:

```text
# OpenCode: modelo/proveedor independiente
/connect  → OpenCode Go → ingresar la clave Go dentro de OpenCode
/models   → escoger un modelo Go

# OpenCode: acceso a datos TwinCap, agregar solo en el proyecto/perfil dedicado
opencode mcp add twincap --url https://<dominio-canónico-twincap>/api/mcp
opencode mcp auth twincap
opencode mcp list

# Desconectar localmente (no revoca por sí solo el grant del servidor)
opencode mcp logout twincap
```

No generar este archivo de configuración como parte del repositorio ni incluir tokens,
claves, cookies o secretos de loopback. La configuración debe quedar local al perfil de
prueba o al proyecto privado de test. Las credenciales MCP locales de OpenCode no se
sincronizan por tener el mismo plan Go: al probar en otro equipo, autorizar por separado.

La URL es la base pública canónica de TwinCap (APP_BASE_URL en el entorno destino), no
una URL de Preview protegida por Vercel. Para la primera validación, usar entorno Preview
aislado y un usuario interno allowlisted; no habilitar el piloto a todos los usuarios ni
crear una excepción de protección Vercel que exponga el Preview. La habilitación interna
es solo un interruptor operativo del piloto y no decide todavía el plan premium.

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

### Contrato concreto de la primera herramienta personal

La primera capacidad expuesta será `personal.get_financial_summary`, scope
`personal.summary:read`, sin IDs de usuario/workspace en argumentos. Entrada inicial:
`period: "month" | "year"` (default mes civil actual); no aceptar rango abierto, filtros
por texto libre ni paginación en esta herramienta agregada. El caso de uso resuelve al
actor y workspace desde el principal validado y aplica la misma clasificación/semántica
del Resumen de TwinCap. Para evitar duplicar lógica, extraer/reutilizar un caso de uso
compartido por el dashboard y MCP; el handler de protocolo no construye agregados ni
consulta repositorios directamente.

La salida JSON tipada incluirá período civil, hora de corte, scope Personal, totales de
ingresos/gastos/resultado y posición por separado, cada métrica agrupada por moneda,
notas de completitud y límite de respuesta. No incluirá nombres/notas de movimientos,
datos de clientes ni documentos de Mongoose. Las cantidades y monedas se normalizan a
primitivos/objetos planos; los importes conservan unidades menores enteras y el código de
moneda antes de cruzar al SDK/cliente. Anotar la herramienta como solo
lectura y no destructiva; filtrar en `tools/list` según scope y volver a autorizar cada
`tools/call`.

Scope solicitado/consentido no implica acceso por sí solo: la policy comprueba grant,
usuario, sesión vigente, ámbito personal, capability y límites antes de invocar el caso
de uso. Tool annotations ayudan a la UX del agente, pero no son una barrera de seguridad.

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
- `/api/mcp` exige bearer desde `initialize`; sin bearer devuelve `401` con
  `WWW-Authenticate: Bearer` y el `resource_metadata` RFC 9728 correcto. Bearer inválido
  o expirado da `401 invalid_token`; scope insuficiente da `403 insufficient_scope`. Nunca
  responder `tools/list` parcialmente antes de autenticar.
- OAuth Authorization Code + PKCE, TLS, state aleatorio de un solo uso, issuer exacto,
  audience MCP, expiración, scopes, redirect URI exacta y callback validado. El piloto usa
  access/refresh tokens opacos aleatorios con introspección local, no access JWT; así la
  revocación inmediata no depende de rotación de claves. No pedir/almacenar contraseña
  del proveedor LLM ni contraseña TwinCap en un campo de conector.
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

### Contrato de endpoints para el piloto

La base canónica de OAuth será `APP_BASE_URL`; el recurso protegido será
`APP_BASE_URL/api/mcp`. La metadata debe estar publicada sin sesión para permitir
discovery, pero no revela ningún dato financiero:

| Endpoint                                        | Función y requisitos                                                                                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/oauth-protected-resource/api/mcp` | RFC 9728: recurso MCP exacto, issuer/authorization server, scopes soportados y bearer en header.                                                     |
| `/.well-known/oauth-authorization-server`       | RFC 8414: issuer, authorize/token/revoke endpoints, grants y métodos PKCE/auth soportados.                                                           |
| `/oauth/authorize`                              | GET validado: autentica la sesión web, verifica cliente, recurso, scope, redirect URI, response type, state y PKCE; presenta consentimiento TwinCap. |
| `/oauth/consent`                                | POST same-origin/CSRF: registra una decisión explícita; acepta o devuelve `access_denied` solo al redirect URI previamente validado.                 |
| `/oauth/token`                                  | POST form-urlencoded: canjea code una vez con verifier PKCE o rota refresh token; emite token de acceso para audience MCP.                           |
| `/oauth/revoke`                                 | POST: revoca refresh grant/familia; responde según RFC 7009 sin confirmar si un token desconocido existe.                                            |
| `/api/mcp`                                      | Streamable HTTP stateless; bearer requerido; `tools/list` y cada `tools/call` validan grant y permisos actuales.                                     |

El server metadata anuncia Authorization Code y Refresh Token, solo `S256`, cliente
público (`token_endpoint_auth_method: none`) para OpenCode, sin client secret. La solicitud
OAuth debe incluir el resource indicator de TwinCap; el AS fija `aud` al recurso exacto y
el RS rechaza audience ausente o distinta. Aplicar issuer/response `iss`, expiración,
`Cache-Control: no-store` en token/code y respuestas de error sin detalles sensibles.

### Identidad y consentimiento del cliente OpenCode

- Primer cliente habilitado: `client_id` CIMD exacto
  `https://opencode.ai/oauth/opencode/client.json`. La metadata verificada actualmente
  declara cliente nativo `opencode`, autenticación de token `none`, grants
  `authorization_code`/`refresh_token`, response `code` y callbacks loopback. Tratar el
  documento como identidad verificable, no asumir que cualquier URL con nombre OpenCode
  lo es.
- En el piloto, aceptar solo ese `client_id` CIMD en un catálogo local controlado. Hacer
  fetch HTTPS server-side con hostname allowlisted, sin redirects, timeout y límite de
  bytes; verificar que el `client_id` dentro del JSON coincide. No implementar DCR abierto
  ni resolver URLs arbitrarias remitidas por el modelo/cliente.
- Revalidar en `/authorize` y `/token` que el `redirect_uri` pertenece a los callbacks
  declarados. Admitir puerto dinámico solo para loopback nativo: protocolo HTTP,
  hostname `127.0.0.1` o `localhost`, path exacto registrado, sin credenciales, fragmento
  ni query arbitraria. No admitir comodines para otros dominios ni redirigir a URL que
  solo coincida parcialmente.
- Mostrar nombre y origen del cliente verificados, usuario de TwinCap, ámbito personal,
  permisos/herramientas, clases de datos compartidos, proveedor que verá los resultados,
  expiración y ruta de revocación. Requerir aceptación explícita; no asumir que iniciar
  sesión o añadir el conector es consentimiento.
- Usar la sesión web/correo-contraseña actual para identificar a la persona; no crear
  usuarios ni aceptar una identidad enviada por OpenCode. Exigir autenticación reciente
  (máximo 10 minutos desde `iat` de la sesión) antes de aceptar consentimiento; si está
  vencida, pedir contraseña TwinCap en una confirmación reauth y regresar al mismo
  `/authorize` validado. La pantalla debe dejar claro que esto autoriza acceso MCP, no
  vincula el proveedor OpenCode Go.
- Si se añade cliente Claude/OpenAI después, cada identidad y metadata deben incorporarse
  al catálogo y pasar una prueba de redirects/scopes; no relajar validación global para
  acomodar un único host.

### Persistencia y validación de grants

- Separar tres registros MongoDB: (a) **OAuth transaction** temporal, ligada a login y
  consentimiento; (b) **MCP grant** durable por cada concesión consentida; (c) **OAuth
  credential** individual por code/access/refresh. No meter la lista creciente de refresh
  previos en un array del documento grant.
- OAuth transaction: client_id/metadata hash, redirect URI validada, `state`, PKCE
  challenge S256, resource/audience solicitado, scopes, created/consumed/denied y
  expiración corta. La navegación de login recibe solo un handle aleatorio no enumerable
  de esa transacción; reanudar requiere leerla en servidor y no confiar en un `returnTo`
  arbitrario. Consent POST valida Origin, sesión, CSRF y que la transacción siga pendiente.
- Grant persistente: ID aleatorio, usuario y workspace Personal derivados del servidor,
  `client_id` y metadata version/hash, nombre verificado, scopes, consentimiento/versiones
  de política, fechas, status y `sessionVersion`. Permitir varios grants del mismo
  `client_id` (p. ej. dos instalaciones OpenCode); no inventar un nombre de dispositivo
  que CIMD no proporciona. En la lista, distinguir concesiones por fecha/último uso.
- OAuth credential: digest único, grant/transaction ID, tipo (`authorization_code`,
  `access_token`, `refresh_token`), expiración, status (`active`, `consumed`, `revoked`),
  y metadatos mínimos para verificar code/refresh. Índice unique por digest, búsqueda
  compuesta por grant/status y TTL por `expiresAt` para borrar credenciales vencidas; el
  grant padre conserva revocación/auditoría y no tiene TTL mientras exista una conexión.
- Canje code y refresh deben ser atómicos: cambiar `active`→`consumed` con digest y
  vigencia en el filtro, y escribir nuevas credenciales en la misma transacción Mongo.
  Si reaparece un refresh `consumed` antes de su expiry, revocar grant/familia y credenciales
  activas de forma atómica. Nunca revocar otra concesión del mismo cliente por error.
- Token access/refresh/code son secretos aleatorios independientes de alta entropía;
  persistir SHA-256 de sus valores, no el texto plano. SHA-256 es apropiado por la entropía
  del token aleatorio; comparar la identidad consultada con filtros indexados y nunca
  registrar el bearer.
- Access token inicial sugerido: 10 minutos; refresh inicial sugerido: 30 días con
  rotación en cada uso. Estos TTL son valores de piloto, configurables por entorno y
  pendientes de política final. Refresh antiguo reutilizado revoca atómicamente toda la
  familia y exige reconexión. El código dura 5 minutos y se usa una vez.
- Cada llamada MCP hace introspección local tenant-scoped: encontrar token hash no
  expirado/no revocado, grant activo, usuario existente, sessionVersion igual, acceso
  personal vigente, recurso/audience correcto y scopes suficientes. No cachear grants
  durante el piloto para que la revocación tenga efecto inmediato.
- Cambio de contraseña incrementa sessionVersion y, por tanto, invalida grants/token al
  siguiente request; la UI de seguridad permite revocación individual y “revocar todas”.
  Añadir evento de auditoría mínimo (actor, client, grant, evento, timestamp, resultado,
  trace); nunca prompt, bearer, respuesta financiera ni stack.
- La pantalla TwinCap “Aplicaciones conectadas” debe mostrar solo conexiones del usuario
  autenticado: cliente verificado, ámbito, capacidades, concedido/último uso, expiración
  y acción de revocar. No mostrar contenido de conversaciones. El admin/owner del negocio
  no administra conexiones personales de miembros.

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
Claude / OpenCode / ChatGPT / otro cliente MCP
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
- El matcher vigente de `src/proxy.ts` excluye `/api/*`. El resource server no puede
  depender del proxy, `getCurrentUser()` por cookie ni layout: valida el bearer por
  request y llama `connectDb()` en su propia entrada antes de consultar modelos. Las
  páginas/flows del AS pueden usar la sesión web normal.
- Para Vercel, usar runtime Node.js y handler MCP sin estado de sesión por proceso. Atender
  Streamable HTTP moderno y método `POST`/`GET`/`DELETE` según el SDK/versión MCP; pinnear
  la versión SDK y ejecutar la matriz de compatibilidad. Ninguna sesión, identidad,
  authorization code ni grant se conserva en memoria de Function.
- No derivar issuer/recurso de `Host`, `Origin`, `x-forwarded-host` ni callback enviado
  por cliente. Configurar explícitamente `APP_BASE_URL`; requerir HTTPS fuera de localhost
  y fallar cerrado si falta en producción. La metadata y el endpoint deben publicarse en
  el mismo host canónico usado por el consentimiento y el callback.
- El matcher excluye `/api`, así que la protección Host/Origin/CSP de `src/proxy.ts` no
  se aplica al handler MCP. Añadir validación Host contra el host canónico confiable,
  validación Origin con allowlist si el cliente lo envía y defensa contra DNS rebinding;
  los clientes remotos pueden ser server-to-server y CORS nunca es autenticación.
- Limitar body, JSON-RPC batch, tiempo de ejecución, tamaño de salida y filas; aplicar
  limitación distribuida por usuario/grant y cuotas con almacenamiento compartido (no
  `Map` en memoria), tolerantes a varias Functions/cold starts. No iniciar streaming
  prolongado ni jobs sin estado persistido durante el piloto.
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
- Configuración de entorno: `APP_BASE_URL` canónico obligatorio para issuer/recurso;
  `MCP_ENABLED=false` por defecto; y modo piloto con allowlist explícita por `userId`.
  No usar allowlist por correo, no usar fallback desde `VERCEL_URL` y no activar por estar
  suscrito a Go/Plus. Variables faltantes/inválidas fallan cerradas; guardarlas solo como
  configuración del servidor.
- Base de test: base Mongo separada o fixtures sintéticos. No habilitar el MCP sobre una
  copia con datos reales por conveniencia del cliente. Para probar datos del fundador,
  su consentimiento debe ocurrir en sesión interactiva de TwinCap; no preautorizarlo por
  configuración ni enviar snapshots en background.
- OpenCode guarda credenciales OAuth MCP localmente, separadas de `auth.json`/clave del
  proveedor de modelos. No leer, migrar, subir ni sobrescribir la instalación personal de
  OpenCode al configurar este piloto. Entornos CI/Preview nunca imprimen tokens de cliente.

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

### Fase A.1 — Contrato del piloto OpenCode (diseño aprobado como base)

- Mantener correo/contraseña de TwinCap como login de navegador; OAuth MCP es autorización
  separada con Authorization Code + PKCE, cliente público y refresh rotatorio.
- Primer client_id permitido: CIMD verificado de OpenCode. Sin DCR abierto; sin client
  secret; redirect loopback con puerto dinámico solo si el resto de URI coincide con la
  metadata nativa permitida.
- Primer resource: `APP_BASE_URL/api/mcp`; issuer fijo `APP_BASE_URL`; audience obligatoria.
- Primer scope: `personal.summary:read`; primera herramienta `personal.get_financial_summary`
  (mes/año civil). Ninguna cuenta/ID de tenant viene del argumento del modelo.
- Requiere consentimiento reciente (sesión ≤10 minutos o confirmación de contraseña),
  vista de aplicaciones conectadas y revocación personal.
- Piloto local para la cuenta del fundador, con allowlist explícita por userId y
  consentimiento interactivo. Producción permanece apagada hasta preparar índices y
  variables del proyecto `twincap`, y autorizar el despliegue. Use datos sintéticos para
  probar handshake/errores; para datos reales, el fundador debe iniciar y aceptar el
  consentimiento desde TwinCap. No preautorizar ni enviar snapshots en background.
- A.1 no resuelve premium, roles de equipo, OpenAI/Claude hasta probar compatibilidad,
  ni acceso de negocio. Estos siguen en el registro de decisiones.

### Fase B — Spike técnico aislado

- Probar endpoint stateless Streamable HTTP en Vercel preview con herramientas sin datos
  financieros; verificar handshake, metadata, cold start, rutas y clientes Claude, OpenCode y
  OpenAI compatibles (ChatGPT web y, separado, Responses API/Agents API).
- Implementar/probar metadatos RFC 9728/RFC 8414 y Authorization Code+PKCE de punta a
  punta con client CIMD OpenCode, redirect loopback dinámica validada, `state`, audience,
  code de un uso, refresh rotation, revocation y callbacks exactos.
- Configurar OpenCode con URL MCP en un proyecto/perfil dedicado; autenticar en navegador;
  comprobar expiración/refresh, logout local y revocación TwinCap por separado.
- No publicar herramienta financiera en Preview sin consentimiento y autorización; usar
  fixture seguro o un usuario interno aislado, no Atlas de producción.

### Fase C — Lectura Personal limitada

- Un usuario conecta su propio Claude, OpenCode u otro cliente compatible a herramientas personales de solo lectura.
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
- Verificación por separado con Claude web/Desktop/móvil, OpenCode y ChatGPT web en los planes
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
- [OpenCode: servidores MCP remotos y OAuth](https://opencode.ai/docs/mcp-servers)
- [OpenCode: suscripción Go y Go Plus](https://opencode.ai/docs/go/)
- [OpenAI: facturación separada de ChatGPT y API](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform)
- [OpenAI: créditos API para suscripciones elegibles](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions)

Las especificaciones y capacidades de proveedores cambian; reconfirmar versiones,
transportes y callbacks al iniciar la fase técnica.

## 19. Implementación y estado del piloto (2026-11-07)

Del diseño (secciones 1–17) pasamos a implementación local verificada con OpenCode
como cliente de referencia. Alcance exacto del bloque en master pendiente de merge;
la evidencia técnica citada vive en el historial de la sesión (no en repositorio).

### 19.1 Servidor MCP implementado

- **Endpoint**: `POST /api/mcp` (transporte Streamable HTTP, solo POST), host/origin
  en allowlist (`getMcpIssuer()`), `MCP_ENABLED` obligatorio y rate limiter por grant
  (`mcp:${grantId}` con `Retry-After` en 429).
- **OAuth 2.0 authorización**: metadata de recurso protegido
  (`/.well-known/oauth-protected-resource/api/mcp`) + metadata del server de
  autorización (PKCE S256, `client_id_metadata_document_supported`, resource
  parameter). Cliente permitido: CIMD `https://opencode.ai/oauth/opencode/client.json`
  (perfil validado: redirect loopback con puerto libre, `token_endpoint_auth=none`,
  `grant_types=[authorization_code, refresh_token]`). Consent interactivo en
  `/oauth/authorize` con re-autenticación reciente obligatoria (authTime ≤ 10 min),
  transacción TTL 5 min, y tokens emitidos en `/oauth/token` (transacciones Mongo —
  los credentials se persisten solo como hashes; TTL: código 5 min, access 10 min,
  refresh 30 días con rotación y revocación en cascada vía `/oauth/revoke` y el panel
  de conexiones del perfil).
- **Aislamiento de datos**: el grant fija `personalWorkspaceId` al workspace del
  usuario consentiente; toda lectura pasa por repos scoped al workspace. Pilot:
  usuario en allowlist (`MCP_PILOT_USER_IDS`), `MCP_ENABLED` como interruptor.

### 19.2 Herramientas vigentes y contrato de montos

1. `personal.get_financial_summary(period month|year)` — capability
   `personal.summary:read`: income/expenses/result del período civil actual vs
   anterior, mismo agregador que el dashboard.
2. `personal.list_movements(months 1-12, type, limit 1-200)` — capability
   `personal.movements:read`: filas por movimiento (id, fecha ISO, tipo, monto
   firmado en unidades menores, moneda, `decimals`, categoría resuelta, nota,
   cuenta); same live-parent filter que el dashboard (R15.2); newest-first,
   `total` + `hasMore` por encima del límite.
3. `personal.get_monthly_series(months 1-6)` — capability
   `personal.movements:read`: serie civil mensual del workspace personal desde los
   mismos aggregadores del dashboard (límite 6 = base del gráfico de tendencia).

**Contrato monetario obligatorio**: los montos viajan como unidades menores de
ISO 4217 — COP exponent 0 (son pesos enteros, NUNCA dividir por 100), USD/MXN/EUR/BRL
exponent 2. Cada fila de moneda lleva `decimals` (de `CURRENCY_EXPONENTS`;
`null` si la moneda no está en la tabla — el consumidor no debe adivinar escala).
Hallazgo del piloto: un agente que asume centavos universales escala mal el 100 %
los valores en COP; la corrección vivió del lado del contrato (`decimals` por fila +
descripción del tool explícita: "COP decimals=0 → amounts are already whole pesos").

### 19.3 Correcciones verificadas durante la puesta en marcha

1. **`POST /oauth/token` devolvía `server_error` en el 100 % de los cambios de
   código**: `issueTokenPair` llamaba `create()` con sesión y un array de dos
   documentos (access + refresh) — Mongoose 8 exige `ordered: true` en ese patrón y
   lanzaba dentro de la transacción (rollback limpio: el code quedaba activo, no
   había tokens ni audit `token.issued`). Corrección: dos `create()` de un documento
   por llamada, misma convención del resto del módulo. Verificado end-to-end:
   exchange 200 con tokens reales, code consumido una sola vez, audit completo.
2. **Casilla de movimientos fuera del `<form>`**: el checkbox del consent quedaba
   renderizado pero fuera del form de "Autorizar acceso" (`approveMcpConsent`), por
   lo que el grant siempre reflejaba solo `personal.summary:read` aunque la UI
   lo mostrara marcado. Corrección: mover el checkbox dentro del form. Verificado:
   grant con ambas capabilities tras un nuevo consent + llamada real de
   movimientos por protocolo (tools/list 3 tools, 23 movimientos de noviembre,
   serie de 3 meses) con el token del ciclo de depuración.
3. **"Drift" de agregadores descartado (P3 disuelto con evidencia)**: una diferencia
   de 20.000 COP en gastos de noviembre entre summary y serie resultó ser un
   movimiento registrado entre lecturas; comparación en el mismo instante (mismo
   `dataAsOf`) del chiste al peso (`computeDashboardSummary` y
   `computePeriodComparison` comparten `countsTowardEconomicResult`). Regla para
   consumidores: comparar snapshots por `dataAsOf` —financial data evolves between
   calls.

### 19.4 Decisiones del alcance (pilot)

- **Solo lectura, solo personal**: no existe ningún tool de escritura; las
  capabilities modeladas son personal.* — Business (negocio) y créditos/payables
  quedan para bloques futuros, cada uno con su propio consent.
- **Expandiffiltro decidido (2026-11-07)**: movements primero (granularidad alta),
  `personal.accounts:read` después (baja sensibilidad, responde saldo por cuenta),
  credits/payables más adelante con pre-registro económico propio.
- **Consent multi-capability**: la transacción guarda las capabilities pedidas
  (subset validado del scope); la pantalla ofrece la casilla "Detalle de
  movimientos" marcada por defecto solo cuando el cliente pidió ese scope (opt-out)
  y el grant persiste el subconjunto elegido. El perfil OpenCode local solicita
  explícitamente `personal.summary:read personal.movements:read`; el resumen es
  obligatorio y el detalle de movimientos es opcional. El Authorization Server anuncia
  ambos scopes. La Server Action y el caso de uso vuelven a comprobar que los permisos
  concedidos sean subset de los solicitados y permitidos.
  El token puede quedarse corto si el usuario destilda: las tools mueven el estado
  `missing_capability` con instrucción de reconexión, no un silencio.
- **Registro de auditoría**: `grant.created` / `grant.revoked` / `token.issued` /
  `token.refreshed` / `tool.called` con actor, grant y clientId — sin tokens ni
  payload financiero.

### 19.5 Pendiente del bloque

- Verificación final en TUI del usuario (re-conexión del catálogo de tools: OpenCode
  enlista las tools al conectar la sesión — un reconnect es obligatorio tras
  expandir el server).
- Commits por unidad de trabajo lógica y avanzar las docs cruzadas (roadmap/audit).
- Futuro: `personal.accounts:read`, vista de serie multi-scope (Personal/Negocio),
  herramientas de suma con doble confirmación si algún día hay escritura.
