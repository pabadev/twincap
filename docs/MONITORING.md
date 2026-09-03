# Error Monitoring (R13-D)

Sistema de monitoreo y alertas de errores de TwinCap, implementado en la **Fase D de la Ronda 13** (2026-09-03). Complementa el audit trail operacional (R12 C2) que registra operaciones: aquí se capturan **excepciones no controladas y crashes** de render, no operaciones de negocio.

**Decisión clave:** se implementó un backend de observabilidad propio **sin dependencia nueva** (no se usó Sentry ni `@sentry/nextjs`), respetando la restricción "máximo una dependencia nueva por fase, documentada". La única integración externa es el envío de emails de alerta vía **Resend** (SDK directo), la misma infraestructura de email ya autorizada en la Fase B.

## Objetivo

Evitar depender de "el usuario me escribió por WhatsApp": que una excepción no controlada en producción quede **registrada y deduplicada** en MongoDB y opcionalmente **alerte por email**, sin romper jamás la operación original (**fail-safe**) y sin leak de PII ni datos financieros.

## Canal vs. audit trail

| | Audit trail de operaciones (R12 C2) | Error monitoring (R13-D) |
|---|---|---|
| Qué registra | Operaciones de negocio correctas | Excepciones / crashes |
| Dedupe | No | **Sí**, por fingerprint |
| Sensibilidad | Más permisivo | Estricta (sin PII) |
| Alertas | No | Opcional (Resend) |

Los dos canales son independientes y no comparten código de destino.

## Arquitectura

```
puerto  ErrorReporter (core/application/ports.ts)
   │
   ├──► MongoErrorEventRepository (infrastructure/models|repositories)
   │         modelo ErrorEvent: 1 doc por fingerprint, UPSERT con isFirst
   │
   ├──► reportError (infrastructure/monitoring/error-monitor.ts)
   │         fingerprint SHA-1 estable  err_<hex>
   │         normaliza stack a fn + basename de archivo
   │         gate: sin reporter inyectado + ERROR_MONITORING_ENABLED!=='true' → no-op
   │         fail-safe: reporter/alerter que lancen NUNCA propagan
   │
   └──► alertas (infrastructure/monitoring/error-alerter.ts)
           throttle 1 email por fingerprint (solo isFirst)
           solo first + inesperado + severidad fatal|error
           transporte Resend directo (sin tocar el port EmailSender)
```

## Colectores (dónde se reporta)

- **Server actions** — `src/lib/handle-action-error.ts` reporta errores **desconocidos** del `default` (fire-and-forget). Los errores de dominio esperados (`ValidationError`, `NotFoundError`, etc.) no se reportan. Se preserva el contrato síncrono de "un solo string de error".
- **Dashboard** — `src/app/(main)/dashboard/actions.ts` envuelve `getDashboardSnapshotAction` en try/catch, reporta y re-lanza.
- **Auth** — `src/app/(auth)/actions.ts` reporta en los 5 catches; marca `expected: true` para errores de dominio (resultado esperado) y `false` para el resto.
- **Cold start / proxy** — `src/proxy.ts` envuelve `connectDb()` y reporta sin bloquear.
- **Crashes de render (server component)** — `src/app/(main)/error.tsx`, `src/app/error.tsx` (raíz) y `src/app/global-error.tsx` (raíz, reemplaza el root layout). El `global-error` usa **texto estático bilingüe** porque su crash derribó también al `TranslationsProvider`.
- **Bridge cliente → servidor** — los error boundaries son Client Components que no pueden importar server actions; reportan vía `src/lib/client-error-report.ts` (POST best-effort a `POST /api/monitor`, fire-and-forget). El route handler valida el payload con **zod estricto** y responde siempre 200/400 (nunca 500).

## Fingerprint y deduplicación

El fingerprint es un **SHA-1** de `name::message::code::primaryFrame`. El frame principal se normaliza para colapsar variantes de la misma fuente:

- quita `:line:col` y números de línea
- quita prefijos `file://`, `webpack://`, `node:internal`
- normaliza rutas Windows (`\` → `/`) y quita drives absolutos
- **reduce cada frame a `función/nombre + basename`** del archivo, de modo que `file:///app/src/a.ts` (servidor) y `webpack:///./src/a.ts` (bundle) colapsan a lo mismo

Un documento `ErrorEvent` por fingerprint: el primer incidente crea el doc y marca `isFirst: true`; los repetidos **incrementan** `occurrenceCount`, `lastSeen` y `lastUserId`, sin duplicar docs. `isFirst` alimenta el throttle de alertas (solo se alerta la primera aparición de cada fingerprint).

## Sanitización (sin PII ni datos financieros)

`src/infrastructure/monitoring/sanitize.ts` es estricto por defecto:

- `message` (máx 500, default `'unknown_error'` si vacío), `name`, `stack` (máx 4000), `code` (máx 200) — todo truncado.
- `context`: **allowlist** estricta — solo `userId`, `workspaceId`, `path`, `method`, `userAgent`, `correlationId`.
- Rechaza claves sensibles por nombre (`password`, `token`, `authorization`, `cookie`, `session`, `card`, `cvv`, `jwt`, `email`, `headers`, `body`, `rawData`, uploads…) y strings largos sin espacios que parezcan secrets.
- **Nunca** se persisten montos, cuentas, saldos, números de banco ni datos personales.

## Alertas (Resend)

- Transporte **Resend directo** (lazy-import del SDK), patrón idéntico a `ResendEmailSender` de la Fase B, sin tocar el port `EmailSender` (que es semánticamente transaccional: reset/verify, no alertas genéricas).
- Predicado `shouldSendAlert`: solo **first + inesperado + severidad `fatal` o `error`**.
- Dispatcher construido por factory `makeAlertDispatcher(send)` con transporte inyectable (tests), y expuesto como `alertOnIncident`.
- Fail-safe: un envío que falle solo loguea `event:"error_alert_failed"` a stderr y **nunca** rompe el reporte.

## Variables de entorno (opt-in, silencioso hasta activar)

| Var | Default | Descripción |
|---|---|---|
| `ERROR_MONITORING_ENABLED` | `false` | Master switch del monitoreo. **Opt-in**: hasta activarla, `reportError` es no-op silencioso. |
| `ERROR_ALERT_EMAIL` | — | Destinatario de las alertas por email. |
| `APP_RELEASE` | — | Etiqueta de release/entorno para clasificar errores. |

`reportError` lee `process.env` **directamente** (no `getEnv()`) para el gate y el release: así el reporting queda desacoplado de la validez de las env de DB/auth y es testeable sin `MONGODB_URI`/`AUTH_SECRET`. En tests, al inyectar un `reporter`, el gate se omite.

## Fail-safe (regla inquebrantable)

- Sin `reporter` inyectado **y** `ERROR_MONITORING_ENABLED !== 'true'` → `reportError` retorna `null` (no-op).
- Un `reporter` o `alerter` que lance **jamás** propaga: se captura, se loguea y el resultado del otro canal se conserva.
- El route `/api/monitor` nunca responde 5xx; los collectors de cliente nunca lanzan.
- Cada integración (dashboard, auth, proxy, boundaries) preserva su contrato previo (re-lanza o devuelve su respuesta original), el error reportado es adicional.

## Verificación

- Suite nueva `src/infrastructure/monitoring/*.test.ts` (28 tests): sanitize, error-monitor, error-alerter.
- Gate de calidad: **750/750 tests** (70 archivos), `tsc --noEmit` EXIT 0, `lint` EXIT 0, `build` EXIT 0 (incluye `/api/monitor`).

## Migración futura

El puerto `ErrorReporter` y el pipeline (fingerprint → dedupe → alerter) están diseñados para que, si más adelante se decide usar **Sentry** u otro tercero, solo haya que añadir una implementación del puerto (p.ej. `SentryErrorReporter`) que emita a ese backend; el resto de la aplicación (colectores, gate, fail-safe) no cambia.

## Archivos clave

- `src/core/application/ports.ts` — puerto `ErrorReporter` (R13-D)
- `src/infrastructure/models/error-event.ts`, `src/infrastructure/repositories/error-event-repository.ts`
- `src/infrastructure/monitoring/{sanitize,error-monitor,error-alerter}.ts` + tests
- `src/infrastructure/config/env.ts`, `.env.example`
- `src/lib/{report-unexpected-error,handle-action-error,client-error-report}.ts`
- `src/app/api/monitor/route.ts`, `src/app/global-error.tsx`, `src/app/error.tsx`, `src/app/(main)/error.tsx`
- `src/app/(main)/dashboard/actions.ts`, `src/app/(auth)/actions.ts`, `src/proxy.ts`
