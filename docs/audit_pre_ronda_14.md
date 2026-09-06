Sí. Ya pude revisar el ZIP completo y esta vez hice una **segunda auditoría real sobre el estado actual del código**, tomando `AGENTS.md` y `docs/AUDIT-AND-PLAN.md` como documentos rectores, pero contrastándolos contra la implementación.

La diferencia importante respecto a la auditoría anterior es que **no asumí que algo está resuelto porque el documento diga “COMPLETADA”**.

# Auditoría 2.0 — TwinCap

**Fecha:** 5 de septiembre de 2026  
**Estado analizado:** ZIP `twincap-master` que acabas de proporcionar  
**Alcance:** arquitectura, seguridad, autenticación, multi-tenant, integridad financiera, POS, multi-moneda, producción, CI/CD, observabilidad, analítica, legal, UX y testing.

El ZIP contiene aproximadamente **460 archivos TypeScript/TSX** y **91 archivos de pruebas/specs**. El proyecto ya tiene una madurez considerable.

> **Importante:** no pude ejecutar `pnpm test`, `tsc` ni `build` porque el entorno de esta sesión no pudo descargar `pnpm` desde `registry.npmjs.org`. Por tanto, los resultados `849/849`, `tsc 0`, `lint 0` y `build 0` que aparecen en el documento maestro los tomo como evidencia declarada por el proceso de implementación, **no como una ejecución independiente mía**.

* * *

# 1\. Veredicto ejecutivo

## Mi conclusión

**TwinCap está bastante cerca de una beta privada, pero todavía no lo abriría a usuarios reales sin corregir varios hallazgos que el Definition of Beta actual no contempla.**

La arquitectura es buena.

La separación por Workspace es buena.

La autenticación está mucho mejor.

La observabilidad, CI, feedback, recuperación de contraseña, email verification, analytics y CSV son avances reales.

Pero encontré algo más importante:

> **La segunda auditoría descubrió problemas de integridad financiera que pueden producir datos incorrectos bajo determinadas entradas o fallos parciales.**

Y en un SaaS financiero eso pesa más que tener 849 tests verdes.

### Mi evaluación actual

| Área | Estado |
| --- | --- |
| Arquitectura | 🟢 Muy buena |
| Autenticación | 🟢 Buena |
| Aislamiento tenant | 🟢 Bueno |
| Testing | 🟢 Muy bueno |
| UX/UI | 🟢 Bueno |
| Observabilidad | 🟢 Buena base |
| CI/CD | 🟡 Hay detalles que corregir |
| Multi-moneda | 🔴 Hay un problema importante |
| Integridad transaccional | 🔴 Deuda importante |
| Producción/backup | 🔴 Pendiente |
| Legal | 🟠 Pendiente completar |
| Analítica | 🟠 Instrumentación incompleta |
| Preparación beta | 🟠 **No todavía** |

### Nota global que le pondría hoy

**7,4/10 como producto técnico.**

Pero eso no significa 74 % de funcionalidades.

La lectura correcta sería:

> **Producto técnicamente avanzado, pero con algunos riesgos de integridad que todavía no son aceptables para una aplicación financiera abierta a usuarios externos.**

* * *

# 2\. Lo que realmente mejoró

Primero quiero reconocer algo: **sí se nota el trabajo de R13**.

El documento maestro confirma:

- CI.
- recuperación de contraseña.
- verificación de email.
- Resend.
- políticas legales.
- monitoring.
- feedback.
- Workspace/Membership.
- analytics.
- CSV.
- Definition of Beta.
- checklist de aislamiento.
- plan de lanzamiento.

Y eso también se refleja en el código.

La migración:

**User → Workspace → Membership → financial entities → workspaceId**

está mucho mejor planteada que la arquitectura anterior.

Los tests de aislamiento por workspace son una mejora importante.

La autenticación usa:

- JWE A256GCM.
- bcrypt con 12 rounds.
- tokens de recuperación almacenados como hash.
- expiración.
- rate limiting.
- sesión HttpOnly.

Eso es una base seria para una beta.

* * *

# 3\. 🔴 HALLAZGO P0 — El backend no protege realmente la moneda de la cuenta

Este es probablemente **el hallazgo más importante que encontré**.

El frontend presenta la moneda correctamente, pero varios casos de uso confían en la moneda enviada por `FormData`.

Por ejemplo, `createMovementAction` recibe:

```text
accountId
amount
currency
```

y `createMovement()` hace:

```text
new Money(input.amount, input.currency)
```

Después busca la cuenta, pero **no comprueba que `input.currency === account.currency`**.

Eso significa que un usuario puede enviar manualmente una petición equivalente a:

```text
Cuenta: cuenta COP
Monto: 100
Currency: USD
```

y el backend podría crear el movimiento.

El mismo patrón aparece en varios lugares:

- movimientos;
- transferencias;
- créditos recibidos;
- créditos otorgados;
- abonos;
- ventas;
- otros flujos monetarios.

### El problema es todavía peor

`movement.ts` reconstruye la moneda desde la **moneda de la cuenta** al leer el movimiento.

Por tanto puedes tener una situación conceptualmente así:

```text
Entrada enviada:
100 USD

Cuenta:
COP

Persistencia:
amount = 100

Lectura posterior:
100 COP
```

Es decir:

> **el sistema puede convertir silenciosamente un dato introducido como USD en COP.**

Eso es inaceptable en una aplicación financiera.

### El POS tiene otro problema relacionado

`CatalogItem` tiene `unitPrice` como `Money` en dominio, pero el modelo MongoDB almacena:

```text
unitPrice: number
```

**No almacena currency.**

Después `catalog-repository.ts` reconstruye la moneda del producto usando la moneda de una cuenta del workspace.

Esto hace que el soporte multi-moneda del catálogo sea conceptualmente inconsistente.

El formulario incluso permite seleccionar:

```text
COP
USD
MXN
EUR
```

pero esa moneda no queda realmente asociada al producto en MongoDB.

### Prioridad

🔴 **P0**

### Qué recomiendo

Antes de beta:

1.  Toda operación monetaria debe obtener la moneda autorizada del recurso.
2.  El backend debe rechazar cualquier mismatch.
3.  El catálogo debe almacenar explícitamente `currency`.
4.  Las ventas deben validar:
    - moneda del catálogo;
    - moneda de la cuenta;
    - moneda de la venta.
5.  Los créditos y obligaciones deben conservar una moneda inmutable.

Este punto merece una ronda específica de pruebas adversariales.

* * *

# 4\. 🔴 HALLAZGO P0/P1 — Las operaciones financieras todavía no son atómicas

Este problema ya aparecía parcialmente en la auditoría anterior, pero ahora lo considero **más importante después de ver el estado real del sistema**.

Hay muchas operaciones del tipo:

```text
A
↓
B
↓
C
```

sin transacción.

Por ejemplo, una venta POS hace aproximadamente:

```text
1. comprobar stock
2. disminuir stock
3. crear Sale
4. crear Movement
5. posiblemente crear CreditGranted
6. posiblemente crear otro Movement
```

Si falla el paso 4:

```text
stock disminuido
sale creada
movement no creado
```

La información financiera queda inconsistente.

## Hay otro caso todavía más delicado

`deleteSale()` hace:

```text
1. restaurar stock
2. borrar movements
3. borrar credit
4. borrar sale
```

Si falla el último paso:

```text
stock restaurado
sale todavía existe
movements todavía pueden existir
```

Y un segundo intento puede restaurar stock otra vez.

Eso es una situación real de doble restitución.

* * *

## Transferencias

`createTransfer()`:

```text
create transfer
create expense movement
create income movement
```

Si falla el segundo movement:

```text
Transfer existe
movement de salida existe
movement de entrada no existe
```

Eso afecta directamente el saldo.

* * *

## Créditos

También ocurre en:

```text
createCreditReceived
createCreditGranted
addAbono
editPrincipal
...
```

Hay comentarios en el código reconociendo explícitamente esta limitación.

### Lo positivo

El proyecto sí tiene:

- idempotencia;
- reconciliación;
- movimientos enlazados;
- IDs determinísticos;
- cascadas;
- tests de consistencia.

Eso reduce mucho el riesgo.

Pero:

> **idempotencia no es atomicidad.**

Una operación idempotente puede ejecutarse una sola vez y aun así quedar parcialmente escrita.

### Mi recomendación actual

Aquí cambiaría ligeramente la decisión de la auditoría anterior.

MongoDB Atlas M0 utiliza un replica set y soporta transacciones ACID multi-documento; por tanto, **ya no considero necesario mantener esta deuda simplemente por estar en M0**.

Para operaciones financieras críticas yo introduciría una abstracción transaccional mínima:

```text
UnitOfWork / TransactionContext
```

sin destruir la arquitectura hexagonal.

### Prioridad

🔴 **P0 para beta pública**

🟠 **P1 para una beta privada muy controlada**

* * *

# 5\. 🔴 HALLAZGO P0 — El rate limiting de autenticación no está usando la IP real

Este es otro hallazgo bastante importante.

En `registerAction`:

```text
const ip = formData.get('_ip') as string || 'unknown';
```

y lo mismo ocurre en login.

Pero el formulario de autenticación **no envía realmente `_ip`**.

Por tanto el fallback termina siendo:

```text
unknown
```

### Resultado

El registro termina usando una clave equivalente a:

```text
register:unknown
```

Esto significa que los intentos de registro de diferentes usuarios pueden terminar compartiendo el mismo bucket.

Un atacante podría consumir el límite:

```text
3 registros / 15 min
```

y afectar a otros usuarios.

El login queda igualmente sin la dimensión IP:

```text
login:email:unknown
```

### Segundo problema

`MongoRateLimiter.check()` hace:

```text
findOne()
↓
increment
```

o:

```text
create()
```

Esto no es una operación atómica.

Dos solicitudes concurrentes pueden observar que no existe el registro y ambas intentar crearlo.

Eso puede permitir saltarse el límite o generar documentos duplicados.

### Solución

El rate limiter debería usar una operación atómica:

```text
findOneAndUpdate(..., {$inc: ...}, {upsert:true})
```

con un índice único adecuado.

Y la IP debe derivarse del request, no de `FormData`.

### Prioridad

🔴 **P0 seguridad/auth**

* * *

# 6\. 🟠 HALLAZGO — El endpoint `/api/monitor` puede abusarse

El sistema de monitoring es una buena idea, pero encontré un detalle importante.

El endpoint:

```text
POST /api/monitor
```

es público porque debe poder recibir errores de `global-error.tsx`.

Eso es razonable.

Pero cuando:

```text
ERROR_MONITORING_ENABLED=true
```

un atacante podría enviar artificialmente múltiples errores diferentes.

Y como el sistema hace:

```text
fingerprint
↓
persist
↓
isFirst
↓
email
```

un atacante podría generar fingerprints nuevos y provocar:

- crecimiento de `ErrorEvent`;
- correos de alerta;
- ruido operativo.

### Además

Si Mongo está caído, el reporter puede devolver una condición equivalente a `isFirst`, lo que puede provocar alertas repetidas mientras la persistencia está fallando.

### Recomendación

Agregar al endpoint:

- rate limit independiente;
- límite de payload;
- límite de fingerprints por IP;
- cooldown global;
- posiblemente aceptar únicamente eventos de navegador con un esquema muy reducido;
- no mandar email inmediatamente por cada fingerprint nuevo.

### Prioridad

🟠 **P1**

* * *

# 7\. 🟠 HALLAZGO — El dashboard "eficiente" todavía carga todos los movimientos en backend

La R12 C1 sí solucionó una cosa:

> ya no manda todos los movimientos al cliente.

Eso está bien.

Pero `getDashboardSnapshotAction()` todavía hace:

```text
movementRepo.findByWorkspaceId()
```

y después:

```text
categoryRepo.findByWorkspaceId()
creditReceivedRepo.findByWorkspaceId()
creditGrantedRepo.findByWorkspaceId()
payableRepo.findByWorkspaceId()
saleRepo.findByWorkspaceId()
transferRepo.findByWorkspaceId()
```

Es decir:

> **la optimización fue principalmente de payload y frontera server→client, no de consulta.**

Para 10 usuarios y pocos movimientos:

🟢 perfecto.

Para un workspace con:

```text
50.000 movimientos
10.000 ventas
5.000 créditos
```

la situación cambia completamente.

### Recomendación futura

No lo convertiría en una mega-query Mongo inmediatamente.

Pero sí establecería:

- ventana temporal para dashboard;
- agregaciones Mongo;
- límites;
- índices compuestos;
- lecturas específicas para métricas.

### Prioridad

🟠 **P1**, no bloqueante para una beta pequeña.

* * *

# 8\. 🟠 HALLAZGO — Las métricas de activation no pueden representar realmente lo que prometen

Esto es bastante interesante.

El plan dice:

> Activation = ≥3 movimientos en primeros 2 días.

Pero el sistema registra:

```text
firstMovement
```

y ese evento se deduplica.

Por lo tanto tienes información sobre:

```text
¿hizo al menos un movimiento?
```

pero no necesariamente:

```text
¿hizo 3 movimientos?
```

No existe un evento tipo:

```text
movementCreated
```

regular para poder contar esos movimientos desde analytics.

Entonces la métrica:

```text
Activation ≥3 movements
```

no tiene una base de datos de eventos suficientemente rica para calcularse correctamente.

### Esto es importante porque

podrías abrir la beta y terminar viendo:

```text
Activation: 72 %
```

creyendo que 72 % hizo 3 movimientos,

cuando en realidad quizá significa:

```text
72 % hizo al menos 1 movimiento.
```

### Prioridad

🟠 **P1**

No es seguridad, pero sí puede llevarte a tomar decisiones comerciales equivocadas.

* * *

# 9\. 🟠 HALLAZGO — Analytics viola una regla explícita de i18n

`src/app/(main)/analytics/page.tsx` tiene texto visible hardcodeado:

```text
Analytics Dashboard
Product metrics for the closed beta
Registered
Logged In
Accounts Created
First Movements
...
```

Mientras `AGENTS.md` establece:

> todo texto visible nuevo debe existir en es/en.

Esto no rompe el producto, pero sí significa que:

- español no está realmente completo;
- analytics en inglés queda fijo;
- la paridad de i18n no se cumple.

### Prioridad

🟡 **P2**, pero sencillo de corregir.

* * *

# 10\. 🟠 HALLAZGO — El email de producción puede quedar apuntando a localhost

En `auth-email-deps.ts` existe el fallback:

```text
APP_BASE_URL ?? 'http://localhost:3000'
```

Esto es cómodo para desarrollo.

Pero en producción:

```text
APP_BASE_URL
```

es opcional según `env.ts`.

Por tanto es técnicamente posible desplegar una versión donde:

- registro funciona;
- reset funciona;
- verificación funciona;

pero los enlaces enviados por email apuntan a:

```text
http://localhost:3000
```

### Esto debería ser imposible en producción.

Yo haría:

```text
development:
    APP_BASE_URL opcional

production:
    APP_BASE_URL obligatorio
    RESEND_API_KEY obligatorio
    RESEND_FROM obligatorio
```

### Prioridad

🔴 **P0 operativo para beta**

* * *

# 11\. 🟠 HALLAZGO — Feedback puede decir "enviado" cuando realmente no se envió

El sistema de feedback es:

```text
submitFeedback
↓
Resend
↓
catch
↓
console.error
↓
success
```

`feedback-alerter.ts` explícitamente hace fail-safe y no lanza.

Eso evita que un fallo de email rompa la aplicación, lo cual es bueno.

Pero desde la perspectiva del usuario:

> puede ver "Gracias por tu comentario" aunque Resend haya fallado.

Para una beta pequeña es aceptable.

Para soporte serio, preferiría:

```text
Feedback
↓
persistir
↓
intentar enviar
↓
marcar delivered / failed
```

No hace falta construir un sistema complejo todavía.

### Prioridad

🟡 **P2**

* * *

# 12\. 🟠 HALLAZGO — Los tokens one-time tienen una ventana de concurrencia

El flujo de reset hace conceptualmente:

```text
find token
↓
compare hash
↓
update password
↓
mark token used
```

Dos solicitudes concurrentes podrían validar el mismo token antes de que ambas vean:

```text
used = true
```

Por tanto el concepto de:

> "one-time token"

no está completamente garantizado bajo concurrencia.

No es un ataque práctico trivial, pero en un sistema de recuperación de contraseña conviene que el consumo sea atómico.

### Recomendación

El `markUsed()` debe ser condicional:

```text
WHERE tokenId = X
AND used = false
```

y comprobar que exactamente una operación ganó.

### Prioridad

🟠 **P1 seguridad**

* * *

# 13\. 🟠 HALLAZGO — Cambiar la contraseña no invalida sesiones anteriores

Actualmente una sesión dura:

```text
30 días
```

Si alguien cambia la contraseña, las sesiones anteriores siguen siendo válidas.

Igualmente después de un password reset no existe un mecanismo de:

```text
invalidate all sessions
```

Para una aplicación financiera yo prefiero:

```text
sessionVersion
```

en User.

Por ejemplo:

```text
password reset
↓
increment sessionVersion
↓
sesiones anteriores inválidas
```

### Prioridad

🟠 **P1**

* * *

# 14\. 🟡 HALLAZGO — La arquitectura tiene pequeñas violaciones de sus propias reglas

`AGENTS.md` dice que:

```text
core/application
```

no debe depender de infraestructura.

Pero encontré, entre otros:

```text
src/core/application/auth/register.ts
    → infrastructure/seeding/user-bootstrap
```

y:

```text
src/core/application/auth/logout.ts
    → infrastructure/auth/session-cookie
```

También `build-dashboard-snapshot.ts` depende de tipos de:

```text
components/dashboard
```

Esto no rompe el sistema, pero sí erosiona la arquitectura hexagonal.

### Solución futura

Por ejemplo:

```text
WorkspaceBootstrapper
```

como puerto.

Y:

```text
SessionManager
```

como puerto para logout.

### Prioridad

🟡 **P2**

* * *

# 15\. 🟡 HALLAZGO — `findByIdRaw()` rompe parcialmente la pureza del aislamiento

`TransferRepository` tiene:

```text
findById(workspaceId, id)
```

que está correctamente aislado.

Pero también:

```text
findByIdRaw(id)
```

que ignora `workspaceId`.

Actualmente se utiliza para reconciliación y no encontré una ruta de usuario que lo explote.

Por tanto **no es una vulnerabilidad actual**.

Pero deja una API peligrosa.

Yo lo encapsularía como una operación exclusiva de infraestructura/reconciliación y no como parte del contrato general del repositorio.

### Prioridad

🟡 P2.

* * *

# 16\. 🔴 Dependencias: hay que actualizar Next.js antes de beta

El proyecto está en:

```text
next 16.3.1
```

Pero actualmente existe:

```text
Next.js 16.3.4
```

y Vercel publicó en agosto de 2026 una actualización de seguridad que llevó 16.3 a 16.3.3 por **dos vulnerabilidades críticas**. Una de ellas afecta la Image Optimization API mediante AVIF y otra corresponde a RCE en servidores Windows. ([GitHub](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36?utm_source=chatgpt.com "Unauthenticated Remote Code Execution on windows-hosted servers · Advisory · vercel/next.js · GitHub"))

Aunque el despliegue de TwinCap en Vercel reduce el riesgo específico del problema de Windows y el proyecto aparentemente no utiliza `next/image`, **no abriría el SaaS con 16.3.1**.

Además, 16.3.4 ya está publicado como versión estable actual de esa rama. ([npm](https://www.npmjs.com/package/next?activeTab=versions&utm_source=chatgpt.com "next - npm"))

### Recomendación

Actualizar como mínimo:

```text
next
eslint-config-next
```

a:

```text
16.3.4
```

y volver a ejecutar toda la suite.

### Mongoose

Está en:

```text
8.24.3
```

La versión 8.24.3 ya está por encima del parche 8.24.2 del advisory reciente, por lo que **no encontré aquí un bloqueo de seguridad equivalente al de Next**. ([GitHub](https://github.com/Automattic/mongoose/security/advisories/GHSA-664h-wqgq-64gw?utm_source=chatgpt.com "Prototype pollution in mongoose update casting via __proto__-prefixed dotted path &#40;Schema._getSchema/path getter&#41; · Advisory · Automattic/mongoose · GitHub"))

Pero Mongoose 9 es actualmente la rama principal, mientras 8 ya es una rama anterior. ([GitHub](https://github.com/Automattic/mongoose/blob/master/docs/version-support.md?utm_source=chatgpt.com "mongoose/docs/version-support.md at master · Automattic/mongoose · GitHub"))

No recomiendo migrar Mongoose 9 antes de beta únicamente por "estar actualizado". Eso puede introducir una regresión innecesaria.

* * *

# 17\. 🟠 CI tiene dos detalles que corregir

Encontré esto:

```yaml
on:
  push:
    branches: [main]
  pull_request:
```

Pero TwinCap trabaja sobre:

```text
master
```

Por tanto un push directo a `master` **no dispara el workflow de push**.

El PR sí dispara CI, pero el flujo no coincide con la estrategia declarada.

* * *

Además, en CI aparece:

```text
npx playwright install
```

Mientras `AGENTS.md` establece explícitamente:

> pnpm exclusivo.

Debería ser:

```text
pnpm exec playwright install --with-deps chromium
```

### Y algo todavía más importante

El documento dice:

> "bloquea el merge si falla".

Pero el YAML **no puede por sí solo bloquear merges**.

Para eso necesitas configurar en GitHub:

```text
Branch protection / Ruleset
        ↓
master
        ↓
required status checks
        ↓
CI
```

Eso sí es una condición real de producción.

### Prioridad

🟠 **P1 DevOps**

* * *

# 18\. 🔴 Backup/restore sigue siendo un bloqueo real

Aquí el documento maestro está siendo honesto.

`Definition of Beta` todavía marca:

```text
Backup + restore probado
```

como pendiente.

Y eso continúa siendo correcto.

Especialmente después de haber visto la cantidad de operaciones multi-documento, yo no cambiaría esta decisión.

No basta con:

> "MongoDB Atlas tiene backups."

Hay que demostrar:

```text
backup
 ↓
restore
 ↓
conexión de TwinCap
 ↓
login
 ↓
dashboard
 ↓
datos financieros presentes
```

Y documentarlo.

### Prioridad

🔴 **P0**

* * *

# 19\. 🟠 El checklist manual de aislamiento sigue siendo obligatorio

El documento lo reconoce:

```text
User A
User B
```

deben probarse manualmente en producción.

Yo añadiría además pruebas maliciosas:

### Usuario A intenta:

```text
URL con ID de cuenta de B
URL con ID de movimiento de B
URL con ID de venta de B
URL con ID de cliente de B
URL con ID de crédito de B
```

y el resultado debe ser:

```text
404 / NotFound
sin mutación
sin información lateral
```

Los 38 tests automatizados son excelentes, pero no sustituyen completamente una prueba sobre el deployment real.

* * *

# 20\. 🟠 Legal: ya existe, pero todavía no está listo para producción

Aquí R13 sí hizo exactamente lo que debía.

Existen:

- `/privacy`
- `/terms`
- `/cookies`
- `/data-policy`

Pero permanecen:

```text
[RAZÓN SOCIAL]
[NIT]
[DIRECCIÓN]
[CORREO]
[CIUDAD/PAÍS]
```

Y la propia documentación dice que falta revisión legal.

Por tanto:

### Para desarrollo

🟢 correcto.

### Para beta cerrada controlada

🟠 puede prepararse.

### Para lanzamiento comercial público

🔴 no.

* * *

# 21\. 🟡 Hay una inconsistencia de branding residual

Aunque R12 hizo la limpieza de `GlobalMoney`, todavía existe:

```text
gm_session
```

como cookie.

No representa un riesgo de seguridad importante.

Pero sí es deuda de identidad.

También hay referencias históricas a:

```text
globalmoney
```

en documentos, lo cual está deliberadamente justificado.

Eso está bien.

Lo que sí revisaría después es distinguir claramente:

```text
histórico
```

vs.

```text
runtime actual
```

* * *

# 22\. Lo que NO considero necesario hacer ahora

Después de esta segunda auditoría, **confirmo varias decisiones de la auditoría anterior**.

No construiría todavía:

❌ Teams  
❌ Billing  
❌ suscripciones  
❌ compras  
❌ IA financiera  
❌ BI avanzado  
❌ integración bancaria  
❌ factura electrónica DIAN  
❌ app móvil nativa  
❌ inventario avanzado  
❌ contabilidad formal  
❌ presupuestos complejos  
❌ cashflow avanzado

Esto sigue siendo correcto.

La mayor amenaza de TwinCap ahora no es:

> "le faltan funcionalidades".

Es:

> **"tenemos que demostrar que las funcionalidades que ya existen son confiables."**

* * *

# 23\. Mi nuevo mapa de prioridades

Después de esta auditoría, yo modificaría ligeramente el roadmap.

## 🔴 P0 — antes de usuarios externos

### P0.1 — Integridad de moneda

Corregir:

```text
account.currency
        ↓
backend validation
        ↓
movement / credit / payable / transfer / sale
```

y almacenar `currency` en catálogo.

### P0.2 — Atomicidad financiera

Introducir una solución transaccional para operaciones críticas:

```text
transfer
sale
credit creation
abono
delete sale
opening balance
```

No hace falta rehacer toda la arquitectura.

### P0.3 — Rate limiter real

- IP real;
- atomicidad;
- índices;
- pruebas concurrentes.

### P0.4 — Next.js

Actualizar:

```text
16.3.1 → 16.3.4
```

y volver a pasar toda la suite. ([npm](https://www.npmjs.com/package/next?activeTab=versions&utm_source=chatgpt.com "next - npm"))

### P0.5 — Production configuration

Hacer obligatorios en producción:

```text
MONGODB_URI
AUTH_SECRET
APP_BASE_URL
RESEND_API_KEY
RESEND_FROM
```

según corresponda.

### P0.6 — Backup + restore

Real.

No documental.

### P0.7 — Smoke test

Después de cada deployment.

* * *

# 🟠 P1 — inmediatamente después

1.  Atomic consumption de tokens.
2.  Invalidación de sesiones después de password reset.
3.  Monitoring API rate limit.
4.  Dashboard aggregation/limits.
5.  Corregir analytics activation.
6.  Corregir financing multi-currency.
7.  Tests adversariales de moneda.
8.  CI sobre `master`.
9.  GitHub branch protection.
10. Cambiar `npx` → `pnpm exec`.

* * *

# 🟡 P2 — después de la beta

- limpiar arquitectura residual;
- security headers;
- Mongoose 9;
- métricas más sofisticadas;
- feedback persistente;
- analytics más completos;
- optimización avanzada;
- eliminar residuos `gm_*`;
- etc.

* * *

# 24\. Algo muy positivo: encontré un defecto que los tests no detectaron

Esto es importante.

La situación:

```text
movement link.saleId
```

está definida en el dominio.

Pero `src/infrastructure/mappers/movement.ts` **no persiste ni reconstruye `saleId`**.

El dominio dice:

```text
link.saleId
```

pero el mapper termina guardando:

```text
kind
refId
opId
```

y omite:

```text
saleId
```

Esto es precisamente el tipo de problema que una suite enorme puede no detectar si prueba:

```text
use case → fake repository
```

pero no:

```text
domain
→ mapper
→ mongoose
→ mapper
→ domain
```

Por eso esta auditoría confirma algo importante:

> **849 tests no equivalen automáticamente a 849 garantías.**

La próxima capa de testing de TwinCap debería concentrarse mucho más en:

**persistencia real + invariantes + fallos parciales + entradas hostiles.**

* * *

# 25\. La nueva estrategia de testing que recomiendo

Además de los tests existentes:

### A. Currency adversarial

Probar:

```text
COP account + USD movement → reject
COP account + USD credit → reject
COP account + USD payable → reject
COP → USD transfer → allowed only when accounts match
```

### B. Partial failure

Simular:

```text
saleRepo.create fails
movementRepo.create fails
creditRepo.create fails
stock decrement succeeds but next operation fails
```

y comprobar que:

```text
no financial corruption
```

### C. Concurrent requests

Dos requests simultáneos:

```text
same idempotency key
same rate-limit key
same password-reset token
same stock
same credit abono
```

### D. Mapper round-trip

```text
Domain
→ Mongo document
→ Domain
```

y comprobar igualdad semántica.

### E. Production-like E2E

No solamente:

```text
MongoMemoryServer
```

sino eventualmente un entorno staging real.

* * *

# 26\. ¿Está listo para beta?

Mi respuesta cambia ligeramente respecto a la conclusión optimista del documento maestro.

## Hoy:

### Beta privada de 2–3 usuarios técnicos

🟠 **Sí, con supervisión intensa**, siempre que no se usen operaciones financieras complejas sin validar.

### Beta privada de 10–20 usuarios

🔴 **Todavía no.**

### Beta pública

🔴 **No.**

### SaaS comercial de pago

🔴 **No.**

* * *

# 27\. Pero estamos mucho más cerca de lo que parece

No interpretaría esta auditoría como:

> "TwinCap está mal."

Todo lo contrario.

El panorama es:

```text
                    ANTES
                       │
              prototipo avanzado
                       │
                       ▼
              Rondas 12–13
                       │
                       ▼
              ┌─────────────────┐
              │ TwinCap actual  │
              └─────────────────┘
                │      │      │
             Auth     QA    SaaS
              🟢      🟢      🟠
                │
             Tenant
              🟢
                │
          Observabilidad
              🟢
                │
       Integridad financiera
              🔴
```

El proyecto ya dejó de ser un simple prototipo.

Ahora el cuello de botella es **confiabilidad**, no funcionalidad.

* * *

# 28\. Mi recomendación concreta para la siguiente ronda

Yo **no empezaría R14 con nuevas features**.

Haría una:

## **R14 — Financial Integrity & Production Safety**

Con únicamente:

### Fase A

**Multi-currency integrity**

### Fase B

**Atomic financial operations**

### Fase C

**Rate limiting + auth hardening**

### Fase D

**Mapper/persistence round-trip tests**

### Fase E

**Production QA + backup/restore + smoke**

Y después:

> **abrir la beta.**

No construiría absolutamente nada más antes de eso.

* * *

## Conclusión final

El documento `AUDIT-AND-PLAN.md` está bien encaminado y R13 logró resolver una parte muy grande de la deuda que identificamos originalmente.

Pero **la Definition of Beta actual es demasiado optimista**, porque declara como "cumplido" el núcleo financiero sin considerar suficientemente:

1.  **validación server-side de moneda**;
2.  **atomicidad de operaciones multi-documento**;
3.  **rate limiting realmente basado en IP**;
4.  **concurrencia**;
5.  **fallos parciales**;
6.  **algunas métricas de analytics que no tienen suficientes eventos para representar su definición**.

Los dos primeros son los que más me preocupan.

Y hay un dato especialmente relevante: **Next.js 16.3.1 ya quedó por detrás de la actualización de seguridad 16.3.3, y 16.3.4 es actualmente la versión estable de esa rama**, así que esa actualización debería entrar antes de la beta. ([GitHub](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4?utm_source=chatgpt.com "Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used · Advisory · vercel/next.js · GitHub"))

**Mi veredicto:** TwinCap está aproximadamente en un **80–85 % del camino hacia una beta privada realmente confiable**, pero ese último 15–20 % es precisamente el que contiene los riesgos más delicados. No conviene saltárselo.

Si quieres seguir el mismo protocolo que has venido usando con los agentes, **yo convertiría estos hallazgos en una Ronda 14 formal dentro de `AUDIT-AND-PLAN.md`, con fases, dependencias, criterios de aceptación y tests específicos, sin modificar todavía el código.**